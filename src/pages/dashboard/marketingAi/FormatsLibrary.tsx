import { useEffect, useState } from 'react'
import { useAuth } from '../../../contexts/AuthContext'
import { CARD, MUTED, BORDER, D, SUPABASE_URL } from './shared'
import FormatsGallery from './FormatsGallery'
import { useLang } from '../../../contexts/LanguageContext'

const ORANGE = '#FF6D29'
const GREEN = '#4ade80'

const TX = {
  pt: {
    intro: '🧩 Tipos de criativo do seu setor. É a MESMA lista que a estratégia usa pra montar o calendário — cada peça sai das fotos reais dos seus imóveis, de lugares reais em volta ou de dicas conferidas. Texto na arte é sempre montado pela marca (nunca escrito por IA de imagem).',
    surf: { feed: '📝 Feed', stories: '📖 Stories', reels: '🎬 Vídeo', dm: '💬 Direct' } as Record<string, string>,
    status: { live: 'Funciona hoje', needs_material: 'Precisa de material seu', planned: 'Em breve' } as Record<string, string>,
    dm: 'Resposta automática (aprovada por você uma vez)',
    gen: 'Gerar agora', going: '...', ok: '✅ Pedido feito — aparece em Peças avulsas (embaixo do calendário) e em Aprovações em 1–2 min.', err: 'Não deu pra gerar agora.',
    loading: 'Carregando...', none: 'Este setor ainda não tem tipos de criativo configurados.',
  },
  en: {
    intro: '🧩 Creative types for your industry. It is the SAME list the strategy uses to build the calendar — each piece comes from the real photos of your listings, real places nearby or checked tips. Text on the art is always built by the brand (never written by image AI).',
    surf: { feed: '📝 Feed', stories: '📖 Stories', reels: '🎬 Video', dm: '💬 Direct' } as Record<string, string>,
    status: { live: 'Works today', needs_material: 'Needs your material', planned: 'Coming soon' } as Record<string, string>,
    dm: 'Automatic reply (you approve it once)',
    gen: 'Make now', going: '...', ok: '✅ Requested — it shows up in Loose pieces (below the calendar) and in Approvals in 1–2 min.', err: 'Could not make it now.',
    loading: 'Loading...', none: 'This industry has no creative types configured yet.',
  },
} as const
const STATUS_COLOR: Record<string, string> = { live: GREEN, needs_material: '#FBBF24', planned: MUTED }

interface Fmt { key: string; name: string; producer: string; status: string; can_make: boolean; surface: string; media: string | null }

// Padrão visual → Formatos. Até 2026-10-15 aqui ficavam o "motor de imagem"
// manual (Print de Tweet, Post com Foto com fundo de IA…) e um catálogo de
// formatos próprios — os dois geravam pelo fluxo antigo. Pedido do dono:
// nada preso ao fluxo antigo. Agora mostra os tipos de criativo da ficha do
// setor (creative-generate make_now_options) e gera pelo mesmo motor do
// calendário (make_now).
export default function FormatsLibrary({ companyId }: { companyId: string }) {
  const { lang } = useLang(); const tx = TX[lang]
  const { session } = useAuth()
  const token = session?.access_token ?? ''
  const [list, setList] = useState<Fmt[] | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [msg, setMsg] = useState<{ key: string; ok: boolean; text: string } | null>(null)

  const call = (body: Record<string, unknown>) => fetch(`${SUPABASE_URL}/functions/v1/creative-generate`, {
    method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  })

  useEffect(() => {
    if (!token) return
    call({ action: 'make_now_options' }).then(r => r.json()).then((r: { all?: Fmt[] }) => setList(Array.isArray(r.all) ? r.all : []))
      .catch(() => setList([]))
  }, [token, companyId]) // eslint-disable-line react-hooks/exhaustive-deps

  const make = async (f: Fmt) => {
    setBusy(f.key); setMsg(null)
    try {
      const res = await call({ action: 'make_now', format: f.key })
      const r = await res.json().catch(() => ({})) as { error?: string }
      if (!res.ok) throw new Error(r.error ?? tx.err)
      setMsg({ key: f.key, ok: true, text: tx.ok })
    } catch (e) { setMsg({ key: f.key, ok: false, text: e instanceof Error ? e.message : tx.err }) }
    setBusy(null)
  }

  const order = ['live', 'needs_material', 'planned']
  const sorted = [...(list ?? [])].sort((a, b) => order.indexOf(a.status) - order.indexOf(b.status))

  return (
    <div>
      <div style={{ padding: '12px 16px', background: 'rgba(96,165,250,0.06)', border: '1px solid rgba(96,165,250,0.22)', borderRadius: '11px', fontSize: '11.5px', color: 'white', lineHeight: 1.6, marginBottom: '16px' }}>
        {tx.intro}
      </div>

      {list === null ? <div style={{ fontSize: '12px', color: MUTED, marginBottom: '22px' }}>{tx.loading}</div>
        : sorted.length === 0 ? <div style={{ fontSize: '12px', color: MUTED, marginBottom: '22px' }}>{tx.none}</div> : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))', gap: '10px', marginBottom: '24px' }}>
          {sorted.map(f => (
            <div key={f.key} style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: '11px', padding: '12px 13px', display: 'flex', flexDirection: 'column', gap: '6px', opacity: f.status === 'planned' ? 0.6 : 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '9.5px', fontWeight: 700, color: MUTED }}>{tx.surf[f.surface] ?? f.surface}</span>
                <span style={{ fontSize: '9px', fontWeight: 800, color: STATUS_COLOR[f.status] ?? MUTED, marginLeft: 'auto' }}>● {tx.status[f.status] ?? f.status}</span>
              </div>
              <div style={{ fontSize: '12.5px', fontWeight: 700, color: 'white', lineHeight: 1.35 }}>{f.name}</div>
              {f.producer === 'dm' ? <div style={{ fontSize: '10px', color: MUTED }}>{tx.dm}</div>
                : f.media ? <div style={{ fontSize: '10px', color: MUTED }}>{f.media}</div> : null}
              {f.can_make && (
                <button onClick={() => make(f)} disabled={!!busy || !token}
                  style={{ alignSelf: 'flex-start', marginTop: 'auto', padding: '6px 12px', background: ORANGE, color: '#000', fontWeight: 700, fontSize: '11px', borderRadius: '7px', border: 'none', cursor: busy ? 'default' : 'pointer', fontFamily: D, opacity: busy && busy !== f.key ? 0.6 : 1 }}>
                  {busy === f.key ? tx.going : `⚡ ${tx.gen}`}
                </button>
              )}
              {msg?.key === f.key && <div style={{ fontSize: '10.5px', color: msg.ok ? GREEN : '#f87171' }}>{msg.text}</div>}
            </div>
          ))}
        </div>
      )}

      {/* Tamanhos/placements por plataforma — não gera imagem, só re-render. */}
      <FormatsGallery companyId={companyId} />
    </div>
  )
}
