import { useEffect, useRef, useState, useCallback } from 'react'
import { supabase } from '../../../lib/supabase'
import { useAuth } from '../../../contexts/AuthContext'
import { track } from '../../../lib/analytics'
import { CARD, MUTED, BORDER, D, inputStyle, SUPABASE_URL, FORMAT_CLASS, FUNNEL_LABEL } from './shared'
import { templateUiLabel, fieldUiLabel, type Template, type Brand } from './formatTemplates'
import { useLang } from '../../../contexts/LanguageContext'
import { STANDARD_FORMATS, safePx, type FormatDef } from './formats'
import { callContentTest } from './TestingArea'

interface Size { w: number; h: number; safe: { top: number; right: number; bottom: number; left: number } }
interface Comp { id: string; title: string; image_url: string | null }
interface Preset { id: string; name: string; formats: { name: string; w: number; h: number }[] }
interface ProductPhoto { id: string; title: string; image_url: string | null }

const ORANGE = '#FF6D29'
const MODS = (en: boolean): { key: string; label: string }[] => [{ key: 'organico', label: en ? 'Organic' : 'Orgânico' }, { key: 'stories', label: 'Stories' }, { key: 'campanhas', label: en ? 'Campaigns' : 'Campanhas' }]
const FUNNEL_EN: Record<string, string> = { topo: 'Top', meio: 'Middle', fundo: 'Bottom' }

const TX = {
  pt: {
    fillErr: 'Erro ao preencher', imgErr: 'Erro ao gerar imagem', varErr: 'Erro ao gerar variações', presetErr: 'Erro ao gerar preset', saveInstrErr: 'Erro ao salvar instrução',
    instrSaved: '✓ Instrução salva — vale pro próximo "Preencher com IA".', pickPreset: 'Escolha um preset.', needColors: 'Defina cores 2ª/destaque no Kit da Marca pra gerar variações.',
    vaultImg: '✅ Imagem gerada com nota boa — já foi direto pro Vault!', testsImg: 'Imagem gerada! Está na Área de Testes (seção Conteúdo), esperando sua aprovação.',
    vars: (n: number, v: number) => `${n} variações geradas (fundo reusado)${v > 0 ? ` — ${v} com nota boa já foram direto pro Vault` : ' na Área de Testes'}.`,
    fmts: (n: number, v: number) => `${n} formatos gerados (fundo reusado)${v > 0 ? ` — ${v} com nota boa já foram direto pro Vault` : ' na Área de Testes'}.`,
    subjectPh: 'Sobre o que é o post? (opcional)', fillAi: '✨ Preencher com IA', hide: 'ocultar', edit: 'editar', instrLabel: 'instrução da IA pra esse formato',
    instrHelp: 'Isso é o comando que já vai pra IA todo "Preencher com IA" — edite pra mudar tom, tamanho ou regra pra esse formato específico.',
    saving: 'Salvando...', saveInstr: '💾 Salvar instrução', productPhoto: 'Foto do produto (da aba Produtos)',
    noPhotos: 'Nenhuma foto ainda — suba em Agente de Dados → Estilos e Visuais → Arquivo → Produtos.', pickProduct: 'Escolha um produto…',
    format: 'Formato', component: 'Componente (opcional)', none: 'nenhum', bgPhoto: 'Fundo (foto)', bgPh: 'Cole a URL de uma foto (asset) — ou deixe vazio e gere com IA',
    genBg: 'Gerar fundo com IA se vazio', genBgCost: '(gasta 1 crédito; variações reusam de graça)',
    captionLabel: 'Legenda do post (vai junto)', captionPh: 'Legenda que acompanha a imagem no Instagram',
    generating: 'Gerando...', generate: '🎨 Gerar imagem', varTitle: 'Recompõe a mesma peça com as outras cores do kit — sem custo de IA', varBtn: '🎨✕ Variações grátis',
    preset: 'Preset…', presetTitle: 'Gera o mesmo conceito em todos os formatos do preset (fundo reusado)', genPreset: '🎯 Gerar preset',
    n1: 'A imagem é montada em camadas ', n2: 'no servidor', n3: ' (mesmo motor do automático). Texto, cores, selo e logo = montagem, ', n4: 'custo zero', n5: '. Só o ', n6: 'fundo', n7: ' (no "Post com Foto") pode gastar IA — e só quando não há um asset pra reusar. Variações reusam o mesmo fundo, de graça. O preview é uma prévia (a fonte final pode variar). Depois de gerar, cai na Área de Testes pra aprovar.',
    defaultInstr: 'Escreva um texto curto, completo e no tom da marca pra esse campo.',
  },
  en: {
    fillErr: 'Error filling in', imgErr: 'Error generating image', varErr: 'Error generating variations', presetErr: 'Error generating preset', saveInstrErr: 'Error saving instruction',
    instrSaved: '✓ Instruction saved — applies to the next "Fill with AI".', pickPreset: 'Pick a preset.', needColors: 'Set the 2nd/accent colors in the Brand Kit to generate variations.',
    vaultImg: '✅ Image generated with a good score — it went straight to the Vault!', testsImg: 'Image generated! It is in the Testing Area (Content section), waiting for your approval.',
    vars: (n: number, v: number) => `${n} variations generated (background reused)${v > 0 ? ` — ${v} with a good score went straight to the Vault` : ' in the Testing Area'}.`,
    fmts: (n: number, v: number) => `${n} formats generated (background reused)${v > 0 ? ` — ${v} with a good score went straight to the Vault` : ' in the Testing Area'}.`,
    subjectPh: 'What is the post about? (optional)', fillAi: '✨ Fill with AI', hide: 'hide', edit: 'edit', instrLabel: 'AI instruction for this format',
    instrHelp: 'This is the command that goes to the AI on every "Fill with AI" — edit it to change tone, length or rules for this specific format.',
    saving: 'Saving...', saveInstr: '💾 Save instruction', productPhoto: 'Product photo (from the Products tab)',
    noPhotos: 'No photos yet — upload them in Data Agent → Styles and Visuals → Archive → Products.', pickProduct: 'Pick a product…',
    format: 'Format', component: 'Component (optional)', none: 'none', bgPhoto: 'Background (photo)', bgPh: 'Paste a photo URL (asset) — or leave empty and generate with AI',
    genBg: 'Generate background with AI if empty', genBgCost: '(costs 1 credit; variations reuse it for free)',
    captionLabel: 'Post caption (goes along)', captionPh: 'Caption that goes with the image on Instagram',
    generating: 'Generating...', generate: '🎨 Generate image', varTitle: 'Recomposes the same piece with the other brand kit colors — no AI cost', varBtn: '🎨✕ Free variations',
    preset: 'Preset…', presetTitle: 'Generates the same concept in all formats of the preset (background reused)', genPreset: '🎯 Generate preset',
    n1: 'The image is built in layers ', n2: 'on the server', n3: ' (same engine as the automation). Text, colors, badge and logo = assembly, ', n4: 'zero cost', n5: '. Only the ', n6: 'background', n7: ' (in "Photo Post") can spend AI — and only when there is no asset to reuse. Variations reuse the same background, for free. The preview is a rough view (the final font may vary). After generating, it goes to the Testing Area for approval.',
    defaultInstr: 'Write a short, complete text in the brand tone for this field.',
  },
} as const
const DEFAULT_INSTRUCTION_EN: Record<string, string> = {
  tweet: 'Write a short, COMPLETE punchline (up to 140 characters), in the brand tone, no emoji — it must fit whole inside the card, never cut off midway.',
  product: 'Write a short button call (up to 4 words, like "Buy now") for the featured product. No emoji.',
  photo: 'Write a short impact line (up to 8 words) to overlay on the photo. No emoji.',
}

// Instrução padrão que o "Preencher com IA" já usa por baixo dos panos hoje
// (ver format-fill) — pedido do dono: isso tem que ficar EDITÁVEL aqui, não
// só um comportamento fixo escondido no backend. Fica salva por empresa +
// formato (marketing_ai_knowledge, module='formato_ai') e é enviada como
// instrução prioritária toda vez que clicar em "Preencher com IA".
const DEFAULT_INSTRUCTION: Record<string, string> = {
  tweet: 'Escreva uma frase de efeito curta e COMPLETA (até 140 caracteres), no tom da marca, sem emoji — tem que caber inteira no card, nunca cortada no meio.',
  product: 'Escreva uma chamada de botão curta (até 4 palavras, tipo "Compre agora") pro produto em destaque. Sem emoji.',
  photo: 'Escreva uma chamada de impacto curta (até 8 palavras) pra sobrepor na foto. Sem emoji.',
}

// Studio de um formato: preenche os campos (à mão ou com IA), vê o preview ao
// vivo e gera a imagem no SERVIDOR (render-format: SVG→PNG, sem navegador) — o
// mesmo motor do piloto automático. O resultado cai na Área de Testes.
export default function FormatStudio({ template, brand, initialKind, companyId, onClose, onSaved }: { template: Template; brand: Brand; initialKind?: string; companyId: string; onClose: () => void; onSaved: () => void }) {
  const { session } = useAuth()
  const { lang } = useLang(); const tx = TX[lang]; const en = lang === 'en'
  const defaultInstr = (en ? DEFAULT_INSTRUCTION_EN : DEFAULT_INSTRUCTION)[template.key] ?? tx.defaultInstr
  const token = session?.access_token ?? ''
  const [instruction, setInstruction] = useState(defaultInstr)
  const [instructionOpen, setInstructionOpen] = useState(false)
  const [instructionRowId, setInstructionRowId] = useState<string | null>(null)
  const [savingInstruction, setSavingInstruction] = useState(false)
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

  // Instrução da IA salva antes pra esse formato — se o dono já editou,
  // usa a dele; senão fica no padrão (ver DEFAULT_INSTRUCTION acima).
  useEffect(() => {
    let alive = true
    supabase.from('marketing_ai_knowledge').select('id, content').eq('company_id', companyId).eq('module', 'formato_ai').eq('kind', template.key).maybeSingle()
      .then(({ data }) => {
        if (!alive) return
        const row = data as { id: string; content: string | null } | null
        setInstructionRowId(row?.id ?? null)
        setInstruction(row?.content || defaultInstr)
      })
    return () => { alive = false }
  }, [companyId, template.key, defaultInstr])

  const saveInstruction = async () => {
    setSavingInstruction(true)
    try {
      if (instructionRowId) {
        await supabase.from('marketing_ai_knowledge').update({ content: instruction.trim() || null }).eq('id', instructionRowId)
      } else {
        const { data } = await supabase.from('marketing_ai_knowledge').insert({
          company_id: companyId, module: 'formato_ai', kind: template.key, title: `Instrução IA — ${template.label}`, content: instruction.trim() || null,
        }).select('id').single()
        if (data) setInstructionRowId(data.id as string)
      }
      setMsg(tx.instrSaved)
    } catch (e) {
      setErr(e instanceof Error ? e.message : tx.saveInstrErr)
    }
    setSavingInstruction(false)
  }

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
        body: JSON.stringify({ template: template.label, fields: template.fields.map(f => ({ key: f.key, label: f.label })), subject, instruction }),
      })
      const r = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(r.error ?? tx.fillErr)
      setFields(f => ({ ...f, ...(r.values ?? {}) }))
      if (!caption && r.values?.text) setCaption(String(r.values.text))
    } catch (e) {
      setErr(e instanceof Error ? e.message : tx.fillErr)
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
        // bg_prompt é conceito VISUAL pro fundo (nunca a headline de verdade
        // — isso é texto que já vai impresso no card depois; mandar pro
        // gerador de imagem ensina a IA a tentar desenhar a frase).
        background: bgUrl || undefined, generate_bg: !!gen, bg_prompt: subject || undefined,
        sticker: isPhoto && sticker ? sticker : undefined,
        width: size?.w, height: size?.h, safe: size?.safe,
      }),
    })
    const r = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(r.error ?? tx.imgErr)
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
      setMsg(wentToVault ? tx.vaultImg : tx.testsImg)
      onSaved()
    } catch (e) {
      setErr(e instanceof Error ? e.message : tx.imgErr)
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
      if (jobs.length === 0) { setErr(tx.needColors); setSaving(false); return }
      let useBg = bg
      let vaulted = 0
      for (const j of jobs) {
        const r = await callRender(j.fl, j.br, useBg || undefined, isPhoto && genBg && !useBg, size)
        if (isPhoto && !useBg && r.bg_url) useBg = r.bg_url // gera 1x, reusa nas próximas
        if (await scoreGenerated(r.id)) vaulted++
      }
      if (useBg && !bg) setBg(useBg)
      track('content_generated', `Gerou ${jobs.length} variações (${template.label})`, { template: template.key, variations: jobs.length, auto_vault: vaulted })
      setMsg(tx.vars(jobs.length, vaulted))
      onSaved()
    } catch (e) {
      setErr(e instanceof Error ? e.message : tx.varErr)
    }
    setSaving(false)
  }

  // Preset: mesmo conceito adaptado a TODOS os formatos do preset. O fundo é
  // gerado no máximo 1x e reusado em todos — trocar formato = re-render (grátis).
  const generatePreset = async () => {
    const preset = presets.find(p => p.id === presetId)
    if (!preset || preset.formats.length === 0) { setErr(tx.pickPreset); return }
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
      setMsg(tx.fmts(preset.formats.length, vaulted))
      onSaved()
    } catch (e) {
      setErr(e instanceof Error ? e.message : tx.presetErr)
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
          <div style={{ fontSize: '15px', fontWeight: 800, color: 'white' }}>{template.icon} {templateUiLabel(template, lang)}</div>
          {FORMAT_CLASS[template.key] && (
            <>
              <span style={{ fontSize: '9px', fontWeight: 800, color: '#A78BFA', background: 'rgba(167,139,250,0.1)', border: '1px solid rgba(167,139,250,0.3)', borderRadius: '99px', padding: '3px 9px', letterSpacing: '0.03em' }}>
                {FORMAT_CLASS[template.key].funnel.map(f => (en ? FUNNEL_EN[f] : FUNNEL_LABEL[f]).toUpperCase()).join(' / ')}
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
              <input value={subject} onChange={e => setSubject(e.target.value)} placeholder={tx.subjectPh} style={{ ...inputStyle, flex: 1 }} />
              <button onClick={fillWithAi} disabled={filling} style={{ padding: '8px 14px', background: filling ? 'rgba(255,109,41,0.4)' : ORANGE, color: '#000', fontWeight: 700, fontSize: '12px', borderRadius: '8px', border: 'none', cursor: filling ? 'wait' : 'pointer', fontFamily: D, whiteSpace: 'nowrap' }}>{filling ? '...' : tx.fillAi}</button>
            </div>
            <button onClick={() => setInstructionOpen(o => !o)} style={{ alignSelf: 'flex-start', background: 'none', border: 'none', color: MUTED, fontSize: '10.5px', cursor: 'pointer', padding: '2px 0', fontFamily: D, textDecoration: 'underline' }}>
              {instructionOpen ? '▾' : '▸'} {instructionOpen ? tx.hide : tx.edit} {tx.instrLabel}
            </button>
            {instructionOpen && (
              <div style={{ padding: '10px 12px', background: 'rgba(255,255,255,0.02)', border: `1px solid ${BORDER}`, borderRadius: '9px' }}>
                <div style={{ fontSize: '10px', color: MUTED, marginBottom: '6px', lineHeight: 1.5 }}>{tx.instrHelp}</div>
                <textarea value={instruction} onChange={e => setInstruction(e.target.value)} rows={3} style={{ ...inputStyle, width: '100%', boxSizing: 'border-box', resize: 'vertical', fontFamily: D, marginBottom: '8px' }} />
                <button onClick={saveInstruction} disabled={savingInstruction} style={{ padding: '6px 13px', background: 'transparent', border: `1px solid ${BORDER}`, borderRadius: '7px', color: ORANGE, fontSize: '11px', fontWeight: 700, cursor: savingInstruction ? 'wait' : 'pointer', fontFamily: D }}>{savingInstruction ? tx.saving : tx.saveInstr}</button>
              </div>
            )}
            {isProduct && (
              <div>
                <label style={{ display: 'block', fontSize: '10px', color: MUTED, marginBottom: '3px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{tx.productPhoto}</label>
                {products.length === 0 ? (
                  <div style={{ fontSize: '11px', color: MUTED, padding: '9px 0' }}>{tx.noPhotos}</div>
                ) : (
                  <select value={fields.productImage ?? ''} onChange={e => set('productImage', e.target.value)} style={{ ...inputStyle, width: '100%', fontFamily: D }}>
                    <option value="">{tx.pickProduct}</option>
                    {products.map(p => <option key={p.id} value={p.image_url ?? ''}>{p.title}</option>)}
                  </select>
                )}
              </div>
            )}
            {template.fields.filter(fd => !(isProduct && fd.key === 'productImage')).map(fd => (
              <div key={fd.key}>
                <label style={{ display: 'block', fontSize: '10px', color: MUTED, marginBottom: '3px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{fieldUiLabel(template, fd, lang)}</label>
                {fd.type === 'textarea'
                  ? <textarea value={fields[fd.key] ?? ''} onChange={e => set(fd.key, e.target.value)} rows={2} style={{ ...inputStyle, width: '100%', boxSizing: 'border-box', resize: 'vertical', fontFamily: D }} />
                  : <input value={fields[fd.key] ?? ''} onChange={e => set(fd.key, e.target.value)} style={{ ...inputStyle, width: '100%', boxSizing: 'border-box' }} />}
              </div>
            ))}
            {isPhoto && (
              <div style={{ borderTop: `1px solid ${BORDER}`, marginTop: '6px', paddingTop: '10px', display: 'flex', flexDirection: 'column', gap: '7px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '10px', color: MUTED, marginBottom: '3px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{tx.format}</label>
                    <select value={fmtKey} onChange={e => setFmtKey(e.target.value)} style={{ ...inputStyle, width: '100%', fontFamily: D }}>
                      {formats.map(f => <option key={f.key} value={f.key}>{f.name} · {f.w}×{f.h}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '10px', color: MUTED, marginBottom: '3px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{tx.component}</label>
                    <select value={sticker} onChange={e => setSticker(e.target.value)} style={{ ...inputStyle, width: '100%', fontFamily: D }}>
                      <option value="">{tx.none}</option>
                      {comps.map(c => <option key={c.id} value={c.image_url ?? ''}>{c.title}</option>)}
                    </select>
                  </div>
                </div>
                <label style={{ display: 'block', fontSize: '10px', color: MUTED, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{tx.bgPhoto}</label>
                <input value={bg} onChange={e => setBg(e.target.value)} placeholder={tx.bgPh} style={{ ...inputStyle, width: '100%', boxSizing: 'border-box' }} />
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '11px', color: 'rgba(255,255,255,0.75)', cursor: 'pointer' }}>
                  <input type="checkbox" checked={genBg} onChange={e => setGenBg(e.target.checked)} style={{ accentColor: ORANGE }} />
                  {tx.genBg} <span style={{ color: MUTED }}>{tx.genBgCost}</span>
                </label>
              </div>
            )}
            <div style={{ borderTop: `1px solid ${BORDER}`, marginTop: '6px', paddingTop: '10px' }}>
              <label style={{ display: 'block', fontSize: '10px', color: MUTED, marginBottom: '5px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{tx.captionLabel}</label>
              <textarea value={caption} onChange={e => setCaption(e.target.value)} rows={2} placeholder={tx.captionPh} style={{ ...inputStyle, width: '100%', boxSizing: 'border-box', resize: 'vertical', fontFamily: D }} />
              <div style={{ display: 'flex', gap: '6px', marginTop: '8px', flexWrap: 'wrap' }}>
                {MODS(en).map(m => (
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
          <button onClick={generate} disabled={saving} style={{ padding: '10px 22px', background: saving ? 'rgba(255,109,41,0.4)' : ORANGE, color: '#000', fontWeight: 700, fontSize: '13px', borderRadius: '9px', border: 'none', cursor: saving ? 'wait' : 'pointer', fontFamily: D }}>{saving ? tx.generating : tx.generate}</button>
          <button onClick={generateVariations} disabled={saving} title={tx.varTitle} style={{ padding: '10px 18px', background: 'transparent', border: `1px solid ${BORDER}`, color: 'white', fontWeight: 700, fontSize: '12.5px', borderRadius: '9px', cursor: saving ? 'wait' : 'pointer', fontFamily: D }}>{tx.varBtn}</button>
          {isPhoto && presets.length > 0 && (
            <>
              <select value={presetId} onChange={e => setPresetId(e.target.value)} style={{ ...inputStyle, fontFamily: D }}>
                <option value="">{tx.preset}</option>
                {presets.map(p => <option key={p.id} value={p.id}>{p.name} ({p.formats.length})</option>)}
              </select>
              <button onClick={generatePreset} disabled={saving || !presetId} title={tx.presetTitle} style={{ padding: '10px 16px', background: 'transparent', border: `1px solid ${BORDER}`, color: presetId ? 'white' : MUTED, fontWeight: 700, fontSize: '12.5px', borderRadius: '9px', cursor: saving || !presetId ? 'default' : 'pointer', fontFamily: D }}>{tx.genPreset}</button>
            </>
          )}
          {msg && <span style={{ fontSize: '11.5px', color: '#4ade80' }}>{msg}</span>}
          {err && <span style={{ fontSize: '11.5px', color: '#f87171' }}>{err}</span>}
        </div>
        <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: '8px', padding: '9px 12px', marginTop: '12px', fontSize: '10.5px', color: MUTED, lineHeight: 1.5 }}>
          {tx.n1}<strong>{tx.n2}</strong>{tx.n3}<strong>{tx.n4}</strong>{tx.n5}<strong>{tx.n6}</strong>{tx.n7}
        </div>
      </div>
    </div>
  )
}
