import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../../../lib/supabase'
import { useAuth } from '../../../contexts/AuthContext'
import { track } from '../../../lib/analytics'
import { CARD, MUTED, BORDER, D, SUPABASE_URL } from './shared'
import { STANDARD_FORMATS, safePx, type FormatDef } from './formats'
import type { Brand } from './formatTemplates'
import { useLang } from '../../../contexts/LanguageContext'

const TX = {
  pt: { pickOne: 'Escolha ao menos um formato.', adaptErr: 'Erro ao adaptar',
    done: (n: number) => `${n} adaptações criadas (sem nova IA). Elas aparecem em "Adaptações" abaixo do original, aguardando aprovação.`,
    title: '✨ Adaptar Conteúdo', original: 'Post original', recompose: '✓ recompõe o layout (tem receita)', reframe: '↺ reenquadra a imagem aprovada (sem receita de camadas)',
    adaptTo: 'Adaptar para (um ou vários)', smart1: '🧠 ', smart2: 'Adaptação inteligente', smart3: ' — o Creative Agent ajusta o texto pra cada formato (encurta pro Story, etc). Só texto, ', smart4: 'sem custo de imagem', smart5: '.',
    adapting: 'Adaptando...', adaptBtn: (n: number) => `✨ Adaptar (${n})`,
    n1: 'O original ', n2: 'não é alterado', n3: '. Cada adaptação é uma nova versão vinculada a ele, recomposta pelo renderer (safe areas, logo, identidade) — ', n4: 'sem consumir crédito de IA',
    n5: ' (reusa a imagem/fundo). As versões entram como rascunho e precisam da sua aprovação.' },
  en: { pickOne: 'Pick at least one format.', adaptErr: 'Error adapting',
    done: (n: number) => `${n} adaptations created (no new AI). They show up under "Adaptations" below the original, awaiting approval.`,
    title: '✨ Adapt Content', original: 'Original post', recompose: '✓ recomposes the layout (has a recipe)', reframe: '↺ reframes the approved image (no layer recipe)',
    adaptTo: 'Adapt to (one or more)', smart1: '🧠 ', smart2: 'Smart adaptation', smart3: ' — the Creative Agent tweaks the text for each format (shortens it for Story, etc). Text only, ', smart4: 'no image cost', smart5: '.',
    adapting: 'Adapting...', adaptBtn: (n: number) => `✨ Adapt (${n})`,
    n1: 'The original ', n2: 'is not changed', n3: '. Each adaptation is a new version linked to it, recomposed by the renderer (safe areas, logo, identity) — ', n4: 'without using AI credits',
    n5: ' (reuses the image/background). Versions are saved as drafts and need your approval.' },
} as const

const ORANGE = '#FF6D29'

export interface VaultPost {
  id: string; kind: string; idea?: string | null; caption?: string | null; cta?: string | null
  format?: string | null; image_url?: string | null
  concept?: { template: string; fields: Record<string, string>; brand?: Brand; background?: string | null; sticker?: string | null } | null
}

// Adaptar Conteúdo — pega um post APROVADO do Vault e gera versões derivadas em
// outros formatos, SEM tocar no original. Prioriza o renderer (recompõe, não
// estica) e REUSA o fundo/assets: nova geração de IA só se não houver imagem.
export default function AdaptModal({ post, companyId, onClose, onDone }: { post: VaultPost; companyId: string; onClose: () => void; onDone: () => void }) {
  const { session } = useAuth()
  const tx = TX[useLang().lang]
  const token = session?.access_token ?? ''
  const [brand, setBrand] = useState<Brand>({ primary: ORANGE, name: 'Marca' })
  const [customFmts, setCustomFmts] = useState<FormatDef[]>([])
  const [sel, setSel] = useState<string[]>(['ig_story'])
  const [smart, setSmart] = useState(true)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState(''); const [err, setErr] = useState('')

  const load = useCallback(async () => {
    const [{ data: bd }, { data: cf }] = await Promise.all([
      supabase.from('brand_dna').select('kit, logo_url').eq('company_id', companyId).maybeSingle(),
      supabase.from('marketing_ai_formats').select('*').eq('active', true),
    ])
    const kit = (bd?.kit as { colors?: { primary?: string[]; accent?: string[]; text?: string; bg?: string }; typography?: { heading?: string } } | null) ?? null
    const c = kit?.colors ?? {}
    setBrand({ primary: c.primary?.[0] || ORANGE, name: 'Marca', primary2: c.primary?.[1], accent: c.accent?.[0], accent2: c.accent?.[1], text: c.text, bg: c.bg, logoUrl: (bd?.logo_url as string | null) ?? undefined, heading: kit?.typography?.heading })
    setCustomFmts(((cf ?? []) as { id: string; name: string; w: number; h: number }[]).map(x => ({ key: 'custom:' + x.id, name: x.name, platform: 'Custom', placement: '', ratio: `${x.w}:${x.h}`, w: x.w, h: x.h, safe: { top: 0.06, right: 0.08, bottom: 0.09, left: 0.08 } })))
  }, [companyId])
  useEffect(() => { load() }, [load])

  const formats = [...STANDARD_FORMATS, ...customFmts]
  const toggle = (k: string) => setSel(s => s.includes(k) ? s.filter(x => x !== k) : [...s, k])

  const adapt = async () => {
    if (sel.length === 0) { setErr(tx.pickOne); return }
    setBusy(true); setErr(''); setMsg('')
    try {
      // Concept: se o original tem receita 'photo', recompõe de verdade. Senão,
      // reaproveita a IMAGEM aprovada como fundo e reenquadra pro novo formato.
      const hasPhoto = post.concept && post.concept.template === 'photo'
      const base = hasPhoto ? post.concept! : { template: 'photo', fields: { headline: post.idea || (post.caption ? post.caption.slice(0, 70) : '') } as Record<string, string>, brand, background: post.image_url ?? null, sticker: null }
      const bg = base.background ?? post.image_url ?? undefined
      const chosen = formats.filter(f => sel.includes(f.key))
      for (const f of chosen) {
        // Adaptação inteligente: o Creative Agent ajusta o texto pro novo formato
        // (só texto, sem custo de imagem). Se falhar, usa o texto original.
        let fl = base.fields ?? {}
        if (smart) {
          try {
            const pr = await fetch(`${SUPABASE_URL}/functions/v1/adapt-plan`, {
              method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
              body: JSON.stringify({ fields: fl, caption: post.caption, format: { name: f.name, ratio: f.ratio, placement: f.placement, w: f.w, h: f.h } }),
            })
            const pj = await pr.json().catch(() => ({}))
            if (pr.ok && pj.fields) fl = { ...fl, ...pj.fields }
          } catch { /* mantém o texto original */ }
        }
        const res = await fetch(`${SUPABASE_URL}/functions/v1/render-format`, {
          method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            template: 'photo', fields: fl, brand: base.brand ?? brand, kind: post.kind,
            caption: post.caption ?? null, subject: post.idea || 'Adaptação', format: f.name,
            background: bg || undefined, generate_bg: false, sticker: (base.sticker as string | null) || undefined,
            width: f.w, height: f.h, safe: safePx(f), source_id: post.id, origin: 'adapt', status: 'adapt',
          }),
        })
        const r = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(r.error ?? tx.adaptErr)
      }
      track('content_adapted', `Adaptou post em ${chosen.length} formatos`, { source: post.id, formats: chosen.length })
      setMsg(tx.done(chosen.length))
      onDone()
    } catch (e) {
      setErr(e instanceof Error ? e.message : tx.adaptErr)
    }
    setBusy(false)
  }

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
      <div onClick={e => e.stopPropagation()} style={{ background: '#0E0B0A', border: `1px solid ${BORDER}`, borderRadius: '16px', width: '100%', maxWidth: '760px', maxHeight: '92vh', overflow: 'auto', padding: '22px' }}>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: '16px' }}>
          <div style={{ fontSize: '15px', fontWeight: 800, color: 'white' }}>{tx.title}</div>
          <button onClick={onClose} style={{ marginLeft: 'auto', background: 'transparent', border: 'none', color: MUTED, fontSize: '20px', cursor: 'pointer' }}>×</button>
        </div>

        {/* Original */}
        <div style={{ display: 'flex', gap: '14px', marginBottom: '18px', padding: '13px', background: CARD, border: `1px solid ${BORDER}`, borderRadius: '12px' }}>
          {post.image_url && <img src={post.image_url} alt="" style={{ width: '92px', height: '92px', objectFit: 'cover', borderRadius: '9px', flexShrink: 0 }} />}
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: '9px', fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '3px' }}>{tx.original} {post.format ? `· ${post.format}` : ''}</div>
            {post.idea && <div style={{ fontSize: '12.5px', fontWeight: 700, color: 'white', marginBottom: '3px' }}>{post.idea}</div>}
            {post.caption && <div style={{ fontSize: '11px', color: MUTED, lineHeight: 1.4, maxHeight: '52px', overflow: 'hidden' }}>{post.caption}</div>}
            <div style={{ fontSize: '10px', color: post.concept?.template === 'photo' ? '#4ade80' : '#FBBF24', marginTop: '5px' }}>
              {post.concept?.template === 'photo' ? tx.recompose : tx.reframe}
            </div>
          </div>
        </div>

        <div style={{ fontSize: '11px', fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '9px' }}>{tx.adaptTo}</div>
        <div style={{ display: 'flex', gap: '7px', flexWrap: 'wrap', marginBottom: '18px' }}>
          {formats.map(f => (
            <button key={f.key} onClick={() => toggle(f.key)} style={{ padding: '7px 12px', borderRadius: '9px', border: `1px solid ${sel.includes(f.key) ? ORANGE : BORDER}`, background: sel.includes(f.key) ? 'rgba(255,109,41,0.12)' : 'transparent', color: sel.includes(f.key) ? ORANGE : 'white', fontSize: '11.5px', fontWeight: 600, cursor: 'pointer', fontFamily: D }}>
              {f.name} <span style={{ color: MUTED, fontWeight: 400 }}>{f.ratio}</span>
            </button>
          ))}
        </div>

        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '11.5px', color: 'rgba(255,255,255,0.8)', cursor: 'pointer', marginBottom: '12px' }}>
          <input type="checkbox" checked={smart} onChange={e => setSmart(e.target.checked)} style={{ accentColor: ORANGE }} />
          {tx.smart1}<strong>{tx.smart2}</strong>{tx.smart3}<strong>{tx.smart4}</strong>{tx.smart5}
        </label>

        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <button onClick={adapt} disabled={busy || sel.length === 0} style={{ padding: '10px 22px', background: busy || sel.length === 0 ? 'rgba(255,109,41,0.4)' : ORANGE, color: '#000', fontWeight: 700, fontSize: '13px', borderRadius: '9px', border: 'none', cursor: busy || sel.length === 0 ? 'default' : 'pointer', fontFamily: D }}>{busy ? tx.adapting : tx.adaptBtn(sel.length)}</button>
          {msg && <span style={{ fontSize: '11.5px', color: '#4ade80' }}>{msg}</span>}
          {err && <span style={{ fontSize: '11.5px', color: '#f87171' }}>{err}</span>}
        </div>
        <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: '8px', padding: '9px 12px', marginTop: '12px', fontSize: '10.5px', color: MUTED, lineHeight: 1.5 }}>
          {tx.n1}<strong>{tx.n2}</strong>{tx.n3}<strong>{tx.n4}</strong>{tx.n5}
        </div>
      </div>
    </div>
  )
}
