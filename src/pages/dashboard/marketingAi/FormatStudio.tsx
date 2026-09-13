import { useEffect, useRef, useState, useCallback } from 'react'
import { supabase } from '../../../lib/supabase'
import { useAuth } from '../../../contexts/AuthContext'
import { track } from '../../../lib/analytics'
import { CARD, MUTED, BORDER, D, inputStyle, SUPABASE_URL, FORMAT_CLASS, FUNNEL_LABEL } from './shared'
import type { Template, Brand } from './formatTemplates'
import { STANDARD_FORMATS, safePx, type FormatDef } from './formats'
import { callContentTest } from './TestingArea'

interface Size { w: number; h: number; safe: { top: number; right: number; bottom: number; left: number } }
interface Comp { id: string; title: string; image_url: string | null }
interface Preset { id: string; name: string; formats: { name: string; w: number; h: number }[] }
interface ProductPhoto { id: string; title: string; image_url: string | null }

const ORANGE = '#FF6D29'
const MODS: { key: string; label: string }[] = [{ key: 'organico', label: 'Orgânico' }, { key: 'stories', label: 'Stories' }, { key: 'campanhas', label: 'Campanhas' }]

// Studio de um formato: preenche os campos (à mão ou com IA), vê o preview ao
// vivo e gera a imagem no SERVIDOR (render-format: SVG→PNG, sem navegador) — o
// mesmo motor do piloto automático. O resultado cai na Área de Testes.
export default function FormatStudio({ template, brand, initialKind, onClose, onSaved }: { template: Template; brand: Brand; initialKind?: string; onClose: () => void; onSaved: () => void }) {
  const { session } = useAuth()
  const token = session?.access_token ?? ''
  const nodeRef = useRef<HTMLDivElement>(null)
  const [fields, setFields] = useState<Record<string, string>>({ ...template.sample })
  const [subject, setSubject] = useState('')
  const [caption, setCaption] = useState('')
  const [mod, setMod] = useState(initialKind && ['organico', 'stories', 'campanhas'].includes(initialKind) ? initialKind : 'organico')
  const [filling, setFilling] = useState(false)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')
  const [err, setErr] = useState('')
  const isPhoto = template.key === 'photo'
  const isProduct = template.key === 'product'
  const [bg, setBg] = useState('')          // URL do fundo (asset reusado)
  const [genBg, setGenBg] = useState(true)  // gerar fundo com IA se vazio
  const [fmtKey, setFmtKey] = useState('ig_portrait')
  const [sticker, setSticker] = useState('') // URL do componente (camada)
  const [presetId, setPresetId] = useState('')
  const [formats, setFormats] = useState<FormatDef[]>(STANDARD_FORMATS)
  const [comps, setComps] = useState<Comp[]>([])
  const [presets, setPresets] = useState<Preset[]>([])
  const [products, setProducts] = useState<ProductPhoto[]>([])

  // Formatos (padrão + custom ativos), componentes e presets — só p/ o 'photo'.
  // Fotos de produto (aba Produtos, em Estilos e Visuais) — só p/ 'product'.
  const loadExtras = useCallback(async () => {
    if (isProduct) {
      const { data: pp } = await supabase.from('marketing_ai_knowledge').select('id, title, image_url').eq('module', 'visual').eq('kind', 'product').order('created_at', { ascending: false })
      setProducts((pp ?? []) as ProductPhoto[])
      return
    }
    if (!isPhoto) return
    const [{ data: cf }, { data: cp }, { data: pr }] = await Promise.all([
      supabase.from('marketing_ai_formats').select('*').eq('active', true),
      supabase.from('marketing_ai_knowledge').select('id, title, image_url').eq('module', 'visual').eq('kind', 'component').order('created_at', { ascending: false }),
      supabase.from('marketing_ai_presets').select('id, name, formats').order('created_at'),
    ])
    const customFmts = ((cf ?? []) as { id: string; name: string; platform: string | null; placement: string | null; ratio: string | null; w: number; h: number }[])
      .map(c => ({ key: 'custom:' + c.id, name: c.name, platform: c.platform ?? 'Custom', placement: c.placement ?? '', ratio: c.ratio ?? `${c.w}:${c.h}`, w: c.w, h: c.h, safe: { top: 0.06, right: 0.08, bottom: 0.09, left: 0.08 } as FormatDef['safe'] }))
    setFormats([...STANDARD_FORMATS, ...customFmts])
    setComps((cp ?? []) as Comp[])
    setPresets((pr ?? []) as Preset[])
  }, [isPhoto, isProduct])
  useEffect(() => { loadExtras() }, [loadExtras])

  const curFmt = formats.find(f => f.key === fmtKey) ?? STANDARD_FORMATS[1]
  const sizeOf = (f: { w: number; h: number; safe?: FormatDef['safe'] }): Size => ({ w: f.w, h: f.h, safe: safePx(f) })

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const set = (k: string, v: string) => setFields(f => ({ ...f, [k]: v }))

  const fillWithAi = async () => {
    setFilling(true); setErr(''); setMsg('')
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/format-fill`, {
        method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ template: template.label, fields: template.fields.map(f => ({ key: f.key, label: f.label })), subject }),
      })
      const r = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(r.error ?? 'Erro ao preencher')
      setFields(f => ({ ...f, ...(r.values ?? {}) }))
      if (!caption && r.values?.text) setCaption(String(r.values.text))
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Erro ao preencher')
    }
    setFilling(false)
  }

  // Renderiza no SERVIDOR (render-format: SVG→PNG, sem navegador, sem custo de
  // IA de imagem). O MESMO motor do piloto automático — então o que você gera
  // aqui é idêntico ao que sai sozinho. Cai em rascunho na Área de Testes.
  const callRender = async (fl: Record<string, string>, br: Brand, bgUrl?: string, gen?: boolean, size?: Size) => {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/render-format`, {
      method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        template: template.key, fields: fl, brand: br, kind: mod, caption: caption || null, subject: subject || template.label, format: template.label,
        background: bgUrl || undefined, generate_bg: !!gen, bg_prompt: subject || fl.headline || undefined,
        sticker: isPhoto && sticker ? sticker : undefined,
        width: size?.w, height: size?.h, safe: size?.safe,
      }),
    })
    const r = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(r.error ?? 'Erro ao gerar imagem')
    return r as { bg_url?: string | null; id?: string | null }
  }

  // render-format não avalia sozinho — sem isso o post ficava sem
  // quality_score e a Área de Testes travava no botão "Avaliar" pra sempre
  // (nunca chegava a mostrar "Enviar pro Vault"). Nunca derruba o fluxo se falhar.
  // Fluxo novo: classificação boa (coerência + coerência visual) já vai
  // direto pro Vault sozinho — devolve isso pra ajustar a mensagem, senão
  // parece que a peça sumiu sem explicação.
  const scoreGenerated = async (id?: string | null): Promise<boolean> => {
    if (!id) return false
    try { const r = await callContentTest(token, { action: 'score', test_id: id }); return !!r.auto_vault } catch { return false }
  }

  const generate = async () => {
    setSaving(true); setErr(''); setMsg('')
    try {
      const r = await callRender(fields, brand, bg || undefined, isPhoto && genBg, isPhoto ? sizeOf(curFmt) : undefined)
      if (isPhoto && !bg && r.bg_url) setBg(r.bg_url) // guarda o fundo pra reusar de graça
      const wentToVault = await scoreGenerated(r.id)
      track('content_generated', `Gerou imagem de formato (${template.label})`, { template: template.key, auto_vault: wentToVault })
      setMsg(wentToVault ? '✅ Imagem gerada com nota boa — já foi direto pro Vault!' : 'Imagem gerada! Está na Área de Testes (seção Conteúdo), esperando sua aprovação.')
      onSaved()
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Erro ao gerar imagem')
    }
    setSaving(false)
  }

  // Variações "de graça": recompõe a MESMA peça trocando a cor principal pelas
  // outras do kit (e o tema, no tweet). O fundo (foto) é REUSADO — no máximo 1
  // chamada de IA na 1ª peça, as demais herdam o mesmo fundo sem custo.
  const generateVariations = async () => {
    setSaving(true); setErr(''); setMsg('')
    try {
      const size = isPhoto ? sizeOf(curFmt) : undefined
      const alts = [brand.primary2, brand.accent, brand.accent2].filter((c): c is string => !!c && c !== brand.primary).slice(0, 3)
      const jobs: { fl: Record<string, string>; br: Brand }[] = alts.map(c => ({ fl: fields, br: { ...brand, primary: c } }))
      if (template.key === 'tweet') jobs.unshift({ fl: { ...fields, theme: (fields.theme === 'light' ? 'dark' : 'light') }, br: brand })
      if (jobs.length === 0) { setErr('Defina cores 2ª/destaque no Kit da Marca pra gerar variações.'); setSaving(false); return }
      let useBg = bg
      let vaulted = 0
      for (const j of jobs) {
        const r = await callRender(j.fl, j.br, useBg || undefined, isPhoto && genBg && !useBg, size)
        if (isPhoto && !useBg && r.bg_url) useBg = r.bg_url // gera 1x, reusa nas próximas
        if (await scoreGenerated(r.id)) vaulted++
      }
      if (useBg && !bg) setBg(useBg)
      track('content_generated', `Gerou ${jobs.length} variações (${template.label})`, { template: template.key, variations: jobs.length, auto_vault: vaulted })
      setMsg(`${jobs.length} variações geradas (fundo reusado)${vaulted > 0 ? ` — ${vaulted} com nota boa já foram direto pro Vault` : ' na Área de Testes'}.`)
      onSaved()
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Erro ao gerar variações')
    }
    setSaving(false)
  }

  // Preset: mesmo conceito adaptado a TODOS os formatos do preset. O fundo é
  // gerado no máximo 1x e reusado em todos — trocar formato = re-render (grátis).
  const generatePreset = async () => {
    const preset = presets.find(p => p.id === presetId)
    if (!preset || preset.formats.length === 0) { setErr('Escolha um preset.'); return }
    setSaving(true); setErr(''); setMsg('')
    try {
      let useBg = bg
      let vaulted = 0
      for (const fmt of preset.formats) {
        const r = await callRender(fields, brand, useBg || undefined, isPhoto && genBg && !useBg, { w: fmt.w, h: fmt.h, safe: safePx(fmt) })
        if (isPhoto && !useBg && r.bg_url) useBg = r.bg_url
        if (await scoreGenerated(r.id)) vaulted++
      }
      if (useBg && !bg) setBg(useBg)
      track('content_generated', `Gerou preset ${preset.name} (${preset.formats.length} formatos)`, { preset: preset.name, auto_vault: vaulted })
      setMsg(`${preset.formats.length} formatos gerados (fundo reusado)${vaulted > 0 ? ` — ${vaulted} com nota boa já foram direto pro Vault` : ' na Área de Testes'}.`)
      onSaved()
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Erro ao gerar preset')
    }
    setSaving(false)
  }

  // Preview escalado pra caber (largura-alvo ~360px). No 'photo' usa o tamanho
  // do formato escolhido (o layout recompõe pro aspect ratio).
  const pw = isPhoto ? curFmt.w : template.w, ph = isPhoto ? curFmt.h : template.h
  const scale = Math.min(360 / pw, 440 / ph)

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
      <div onClick={e => e.stopPropagation()} style={{ background: '#0E0B0A', border: `1px solid ${BORDER}`, borderRadius: '16px', width: '100%', maxWidth: '860px', maxHeight: '92vh', overflow: 'auto', padding: '22px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '9px', marginBottom: '16px' }}>
          <div style={{ fontSize: '15px', fontWeight: 800, color: 'white' }}>{template.icon} {template.label}</div>
          {FORMAT_CLASS[template.key] && (
            <>
              <span style={{ fontSize: '9px', fontWeight: 800, color: '#A78BFA', background: 'rgba(167,139,250,0.1)', border: '1px solid rgba(167,139,250,0.3)', borderRadius: '99px', padding: '3px 9px', letterSpacing: '0.03em' }}>
                {FORMAT_CLASS[template.key].funnel.map(f => FUNNEL_LABEL[f].toUpperCase()).join(' / ')}
              </span>
              <span style={{ fontSize: '9px', fontWeight: 700, color: '#60a5fa', background: 'rgba(96,165,250,0.1)', border: '1px solid rgba(96,165,250,0.25)', borderRadius: '99px', padding: '3px 9px' }}>
                {FORMAT_CLASS[template.key].objective}
              </span>
            </>
          )}
          <button onClick={onClose} style={{ marginLeft: 'auto', background: 'transparent', border: 'none', color: MUTED, fontSize: '20px', cursor: 'pointer' }}>×</button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '22px', alignItems: 'start' }}>
          {/* Campos */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '9px', minWidth: 0 }}>
            <div style={{ display: 'flex', gap: '8px' }}>
              <input value={subject} onChange={e => setSubject(e.target.value)} placeholder="Sobre o que é o post? (opcional)" style={{ ...inputStyle, flex: 1 }} />
              <button onClick={fillWithAi} disabled={filling} style={{ padding: '8px 14px', background: filling ? 'rgba(255,109,41,0.4)' : ORANGE, color: '#000', fontWeight: 700, fontSize: '12px', borderRadius: '8px', border: 'none', cursor: filling ? 'wait' : 'pointer', fontFamily: D, whiteSpace: 'nowrap' }}>{filling ? '...' : '✨ Preencher com IA'}</button>
            </div>
            {isProduct && (
              <div>
                <label style={{ display: 'block', fontSize: '10px', color: MUTED, marginBottom: '3px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Foto do produto (da aba Produtos)</label>
                {products.length === 0 ? (
                  <div style={{ fontSize: '11px', color: MUTED, padding: '9px 0' }}>Nenhuma foto ainda — suba em Agente de Dados → Estilos e Visuais → Arquivo → Produtos.</div>
                ) : (
                  <select value={fields.productImage ?? ''} onChange={e => set('productImage', e.target.value)} style={{ ...inputStyle, width: '100%', fontFamily: D }}>
                    <option value="">Escolha um produto…</option>
                    {products.map(p => <option key={p.id} value={p.image_url ?? ''}>{p.title}</option>)}
                  </select>
                )}
              </div>
            )}
            {template.fields.filter(fd => !(isProduct && fd.key === 'productImage')).map(fd => (
              <div key={fd.key}>
                <label style={{ display: 'block', fontSize: '10px', color: MUTED, marginBottom: '3px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{fd.label}</label>
                {fd.type === 'textarea'
                  ? <textarea value={fields[fd.key] ?? ''} onChange={e => set(fd.key, e.target.value)} rows={2} style={{ ...inputStyle, width: '100%', boxSizing: 'border-box', resize: 'vertical', fontFamily: D }} />
                  : <input value={fields[fd.key] ?? ''} onChange={e => set(fd.key, e.target.value)} style={{ ...inputStyle, width: '100%', boxSizing: 'border-box' }} />}
              </div>
            ))}
            {isPhoto && (
              <div style={{ borderTop: `1px solid ${BORDER}`, marginTop: '6px', paddingTop: '10px', display: 'flex', flexDirection: 'column', gap: '7px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '10px', color: MUTED, marginBottom: '3px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Formato</label>
                    <select value={fmtKey} onChange={e => setFmtKey(e.target.value)} style={{ ...inputStyle, width: '100%', fontFamily: D }}>
                      {formats.map(f => <option key={f.key} value={f.key}>{f.name} · {f.w}×{f.h}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '10px', color: MUTED, marginBottom: '3px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Componente (opcional)</label>
                    <select value={sticker} onChange={e => setSticker(e.target.value)} style={{ ...inputStyle, width: '100%', fontFamily: D }}>
                      <option value="">nenhum</option>
                      {comps.map(c => <option key={c.id} value={c.image_url ?? ''}>{c.title}</option>)}
                    </select>
                  </div>
                </div>
                <label style={{ display: 'block', fontSize: '10px', color: MUTED, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Fundo (foto)</label>
                <input value={bg} onChange={e => setBg(e.target.value)} placeholder="Cole a URL de uma foto (asset) — ou deixe vazio e gere com IA" style={{ ...inputStyle, width: '100%', boxSizing: 'border-box' }} />
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '11px', color: 'rgba(255,255,255,0.75)', cursor: 'pointer' }}>
                  <input type="checkbox" checked={genBg} onChange={e => setGenBg(e.target.checked)} style={{ accentColor: ORANGE }} />
                  Gerar fundo com IA se vazio <span style={{ color: MUTED }}>(gasta 1 crédito; variações reusam de graça)</span>
                </label>
              </div>
            )}
            <div style={{ borderTop: `1px solid ${BORDER}`, marginTop: '6px', paddingTop: '10px' }}>
              <label style={{ display: 'block', fontSize: '10px', color: MUTED, marginBottom: '5px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Legenda do post (vai junto)</label>
              <textarea value={caption} onChange={e => setCaption(e.target.value)} rows={2} placeholder="Legenda que acompanha a imagem no Instagram" style={{ ...inputStyle, width: '100%', boxSizing: 'border-box', resize: 'vertical', fontFamily: D }} />
              <div style={{ display: 'flex', gap: '6px', marginTop: '8px', flexWrap: 'wrap' }}>
                {MODS.map(m => (
                  <button key={m.key} onClick={() => setMod(m.key)} style={{ padding: '5px 12px', borderRadius: '7px', border: `1px solid ${mod === m.key ? 'rgba(255,109,41,0.4)' : BORDER}`, background: mod === m.key ? 'rgba(255,109,41,0.1)' : 'transparent', color: mod === m.key ? ORANGE : MUTED, fontSize: '11px', cursor: 'pointer', fontFamily: D }}>{m.label}</button>
                ))}
              </div>
            </div>
          </div>

          {/* Preview */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', alignItems: 'center' }}>
            <div style={{ width: template.w * scale, height: template.h * scale, overflow: 'hidden', borderRadius: '10px', border: `1px solid ${BORDER}` }}>
              <div style={{ transform: `scale(${scale})`, transformOrigin: 'top left' }}>
                <div ref={nodeRef} style={{ width: pw, height: ph }}>{template.render(isPhoto ? { ...fields, background: bg } : fields, brand)}</div>
              </div>
            </div>
            <div style={{ fontSize: '9.5px', color: MUTED }}>{isPhoto ? curFmt.name + ' · ' : ''}{pw}×{ph}px</div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginTop: '18px' }}>
          <button onClick={generate} disabled={saving} style={{ padding: '10px 22px', background: saving ? 'rgba(255,109,41,0.4)' : ORANGE, color: '#000', fontWeight: 700, fontSize: '13px', borderRadius: '9px', border: 'none', cursor: saving ? 'wait' : 'pointer', fontFamily: D }}>{saving ? 'Gerando...' : '🎨 Gerar imagem'}</button>
          <button onClick={generateVariations} disabled={saving} title="Recompõe a mesma peça com as outras cores do kit — sem custo de IA" style={{ padding: '10px 18px', background: 'transparent', border: `1px solid ${BORDER}`, color: 'white', fontWeight: 700, fontSize: '12.5px', borderRadius: '9px', cursor: saving ? 'wait' : 'pointer', fontFamily: D }}>🎨✕ Variações grátis</button>
          {isPhoto && presets.length > 0 && (
            <>
              <select value={presetId} onChange={e => setPresetId(e.target.value)} style={{ ...inputStyle, fontFamily: D }}>
                <option value="">Preset…</option>
                {presets.map(p => <option key={p.id} value={p.id}>{p.name} ({p.formats.length})</option>)}
              </select>
              <button onClick={generatePreset} disabled={saving || !presetId} title="Gera o mesmo conceito em todos os formatos do preset (fundo reusado)" style={{ padding: '10px 16px', background: 'transparent', border: `1px solid ${BORDER}`, color: presetId ? 'white' : MUTED, fontWeight: 700, fontSize: '12.5px', borderRadius: '9px', cursor: saving || !presetId ? 'default' : 'pointer', fontFamily: D }}>🎯 Gerar preset</button>
            </>
          )}
          {msg && <span style={{ fontSize: '11.5px', color: '#4ade80' }}>{msg}</span>}
          {err && <span style={{ fontSize: '11.5px', color: '#f87171' }}>{err}</span>}
        </div>
        <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: '8px', padding: '9px 12px', marginTop: '12px', fontSize: '10.5px', color: MUTED, lineHeight: 1.5 }}>
          A imagem é montada em camadas <strong>no servidor</strong> (mesmo motor do automático). Texto, cores, selo e logo = montagem, <strong>custo zero</strong>. Só o <strong>fundo</strong> (no "Post com Foto") pode gastar IA — e só quando não há um asset pra reusar. Variações reusam o mesmo fundo, de graça. O preview é uma prévia (a fonte final pode variar). Depois de gerar, cai na Área de Testes pra aprovar.
        </div>
      </div>
    </div>
  )
}
