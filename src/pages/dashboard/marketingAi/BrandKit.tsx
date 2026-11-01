import { useEffect, useRef, useState, useCallback } from 'react'
import { supabase } from '../../../lib/supabase'
import { useAuth } from '../../../contexts/AuthContext'
import { useLang } from '../../../contexts/LanguageContext'
import { useShowcase } from '../../../contexts/ShowcaseContext'
import { MUTED, BORDER, D, SUPABASE_URL, inputStyle, usableLogoMeta, fetchLogoMeta, type LogoMeta } from './shared'

const ORANGE = '#FF6D29'
const GREEN = '#4ade80'

export interface Kit {
  colors: { primary: string[]; accent: string[]; text: string; bg: string }
  typography: { heading: string; body: string }
  composition: string
}
const EMPTY: Kit = { colors: { primary: ['#FF6D29', '#150E08'], accent: ['#4ade80', '#FBBF24'], text: '#FFFFFF', bg: '#0E0B0A' }, typography: { heading: 'Bricolage Grotesque', body: 'Bricolage Grotesque' }, composition: '' }

// Clareia/escurece um hex (pra mostrar as tonalidades derivadas).
function shade(hex: string, amt: number): string {
  const h = (hex || '#000').replace('#', '')
  const num = parseInt(h.length === 3 ? h.split('').map(c => c + c).join('') : h.padEnd(6, '0'), 16)
  const cl = (v: number) => Math.max(0, Math.min(255, v))
  const r = cl((num >> 16) + amt), g = cl(((num >> 8) & 0xff) + amt), b = cl((num & 0xff) + amt)
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`
}

const TX = {
  pt: {
    builtKit: 'montou o kit sozinho, a partir de', realPhotos: 'fotos reais', fetchedLogo: 'buscou o logo sozinho',
    agentDone: (base: string, logo: boolean) => `✓ O agente ${base}${logo ? ' (logo puxado direto do Instagram)' : ''}.`,
    updatedFrom: (n: number, logo: boolean) => `✓ Atualizado com base em ${n} fotos reais${logo ? ' (logo puxado direto do Instagram)' : ''}.`,
    updateErr: 'Erro ao atualizar', loading: 'Carregando kit...',
    logoColors: '🎨 Cores atualizadas a partir do logo.', undo: 'Desfazer', undone: 'Cores anteriores de volta.', readingLogo: 'Lendo as cores do logo...', fromLogo: '🎨 Pegar cores do logo', logoColorsErr: 'Não consegui ler as cores do logo.',
    introA: '🎨 ', introB: 'Kit da Marca (DNA da marca).', introC: ' Tudo num lugar só: voz, logo, cores, tipografia e composição. É daqui que a geração ', introD: 'filtra e monta as peças', introE: ' pra tudo sair na sua identidade.',
    genA: '🤖 ', genB: 'Gerado pelo agente', genC: ' a partir das suas fotos reais — atualiza sozinho toda semana. Edite e salve abaixo se quiser assumir o controle.',
    updating: 'Atualizando…', updateNow: '🔄 Atualizar agora',
    agentLooking: '🤖 O agente está olhando suas fotos reais (Instagram/Produtos) pra montar o kit sozinho…',
    agentWaiting: '🤖 Assim que houver fotos reais suficientes (Instagram ou Produtos), o agente monta este kit sozinho — sem você precisar escolher nada. Ou preencha manualmente abaixo.',
    voiceTitle: 'Voz da marca', voicePh: 'Jeito de falar / personalidade. Ex: próxima e acolhedora, fala como uma amiga que entende do assunto.',
    tone: 'Tom', tonePh: 'acolhedor, leve, confiante', avoid: 'O que a marca NUNCA faz/diz', avoidPh: 'Ex: nunca usa gírias, nunca fala de preço baixo',
    logo: 'Logo', noLogo: 'sem logo', uploading: 'Enviando...', upload: '＋ Enviar logo', logoPh: 'ou cole a URL do logo',
    colorsTitle: 'Sistema de cores', colorsDesc: '2 principais (usadas em tonalidades diferentes) + 2 de destaque (promoções, alertas). As tonalidades ao lado são geradas sozinhas.',
    primary1: 'Principal 1', primary2: 'Principal 2', accent1: 'Destaque 1 (ex: desconto)', accent2: 'Destaque 2 (ex: alerta/novo)', text: 'Texto', bg: 'Fundo',
    typo: 'Tipografia', headFont: 'Fonte de título', headPh: 'Ex: Bricolage Grotesque', bodyFont: 'Fonte de corpo', bodyPh: 'Ex: Inter',
    composition: 'Composição', compPh: 'Regras de montagem: onde vai o logo, margens de segurança, alinhamento, densidade... Ex: logo sempre no canto inferior direito, muito respiro, texto grande e curto.',
    saving: 'Salvando...', save: 'Salvar Kit da Marca', saved: '✓ Salvo — a geração já usa',
    logoHint: 'Envie o logo em PNG com fundo transparente (ou SVG). É assim que ele aparece limpo nos criativos. O sistema prepara o logo sozinho ao salvar (ou na primeira peça depois de trocar o logo); o botão abaixo só refaz na hora.',
    prevDark: 'Em fundo escuro', prevLight: 'Em fundo claro', preparing: 'Preparando o logo...', prepare: 'Refazer o preparo do logo',
    ready: '✓ Logo pronto para os criativos (PNG transparente).', readyKept: '✓ Logo pronto para os criativos.',
    warnFoto: 'Essa imagem parece uma foto, não um logo. Seus criativos vão usar o nome da marca em texto. Envie o logo em PNG com fundo transparente.',
    warnBg: 'Não consegui deixar o fundo desse logo transparente (o fundo não é liso). Os criativos usam o logo como ele está. Para sair limpo, envie o logo em PNG com fundo transparente.',
    warnFormat: 'Esse formato de imagem não dá pra preparar. Envie o logo em PNG com fundo transparente.',
    svgBig: 'O SVG passou de 500 KB. Exporte o logo em PNG com fundo transparente.', prepErr: 'Não consegui preparar o logo',
  },
  en: {
    builtKit: 'built the kit on its own, from', realPhotos: 'real photos', fetchedLogo: 'fetched the logo on its own',
    agentDone: (base: string, logo: boolean) => `✓ The agent ${base}${logo ? ' (logo pulled straight from Instagram)' : ''}.`,
    updatedFrom: (n: number, logo: boolean) => `✓ Updated based on ${n} real photos${logo ? ' (logo pulled straight from Instagram)' : ''}.`,
    updateErr: 'Error updating', loading: 'Loading kit...',
    logoColors: '🎨 Colors updated from the logo.', undo: 'Undo', undone: 'Previous colors restored.', readingLogo: 'Reading the logo colors...', fromLogo: '🎨 Take colors from logo', logoColorsErr: 'Could not read the logo colors.',
    introA: '🎨 ', introB: 'Brand Kit (brand DNA).', introC: ' Everything in one place: voice, logo, colors, typography and layout. This is what generation ', introD: 'uses to filter and build the pieces', introE: ' so everything comes out in your identity.',
    genA: '🤖 ', genB: 'Generated by the agent', genC: ' from your real photos — it updates itself every week. Edit and save below if you want to take control.',
    updating: 'Updating…', updateNow: '🔄 Update now',
    agentLooking: '🤖 The agent is looking at your real photos (Instagram/Products) to build the kit on its own…',
    agentWaiting: '🤖 Once there are enough real photos (Instagram or Products), the agent builds this kit on its own — nothing for you to choose. Or fill it in manually below.',
    voiceTitle: 'Brand voice', voicePh: 'Way of speaking / personality. E.g. warm and approachable, talks like a friend who knows the subject.',
    tone: 'Tone', tonePh: 'welcoming, light, confident', avoid: 'What the brand NEVER does/says', avoidPh: 'E.g. never uses slang, never talks about low prices',
    logo: 'Logo', noLogo: 'no logo', uploading: 'Uploading...', upload: '＋ Upload logo', logoPh: 'or paste the logo URL',
    colorsTitle: 'Color system', colorsDesc: '2 primary (used in different shades) + 2 accent (promotions, alerts). The shades next to each are generated automatically.',
    primary1: 'Primary 1', primary2: 'Primary 2', accent1: 'Accent 1 (e.g. discount)', accent2: 'Accent 2 (e.g. alert/new)', text: 'Text', bg: 'Background',
    typo: 'Typography', headFont: 'Heading font', headPh: 'E.g. Bricolage Grotesque', bodyFont: 'Body font', bodyPh: 'E.g. Inter',
    composition: 'Layout', compPh: 'Layout rules: where the logo goes, safe margins, alignment, density... E.g. logo always bottom right, lots of breathing room, large short text.',
    saving: 'Saving...', save: 'Save Brand Kit', saved: '✓ Saved — generation already uses it',
    logoHint: 'Upload the logo as a PNG with a transparent background (or SVG). That is how it shows up clean in your creatives. The system prepares the logo by itself when you save (or on the first piece after you change it); the button below just redoes it right now.',
    prevDark: 'On a dark background', prevLight: 'On a light background', preparing: 'Preparing the logo...', prepare: 'Redo logo preparation',
    ready: '✓ Logo ready for creatives (transparent PNG).', readyKept: '✓ Logo ready for creatives.',
    warnFoto: 'This image looks like a photo, not a logo. Your creatives will use the brand name as text. Upload the logo as a PNG with a transparent background.',
    warnBg: 'I could not make this logo background transparent (the background is not flat). Creatives use the logo as it is. For a clean result, upload the logo as a PNG with a transparent background.',
    warnFormat: 'This image format cannot be prepared. Upload the logo as a PNG with a transparent background.',
    svgBig: 'The SVG is over 500 KB. Export the logo as a PNG with a transparent background.', prepErr: 'Could not prepare the logo',
  },
} as const

function ColorInput({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <div style={{ fontSize: '10px', color: MUTED, marginBottom: '4px' }}>{label}</div>
      <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
        <input type="color" value={value} onChange={e => onChange(e.target.value)} style={{ width: '38px', height: '34px', padding: 0, border: `1px solid ${BORDER}`, borderRadius: '7px', background: 'transparent', cursor: 'pointer' }} />
        <input value={value} onChange={e => onChange(e.target.value)} style={{ ...inputStyle, width: '92px' }} />
        <div style={{ display: 'flex', gap: '3px' }}>
          {[40, 0, -40].map(s => <div key={s} title={shade(value, s)} style={{ width: '16px', height: '34px', borderRadius: '4px', background: shade(value, s), border: '1px solid rgba(255,255,255,0.12)' }} />)}
        </div>
      </div>
    </div>
  )
}

// Kit da Marca — o agente decide sozinho a partir dos arquivos reais
// (Instagram + Produtos): roda automaticamente na primeira vez que há fotos
// suficientes, e de novo toda semana (cron), sem precisar de clique. O dono
// só entra manualmente se quiser ajustar — a partir daí (auto_generated=false)
// o agente para de sobrescrever. Persiste em brand_dna (kit jsonb + colors/
// fonts/logo_url planos p/ compatibilidade).
export default function BrandKit({ companyId }: { companyId: string }) {
  const { session } = useAuth()
  const { readOnly } = useShowcase() // vitrine: não dispara a sugestão sozinha ao abrir
  const { lang } = useLang()
  const X = TX[lang]
  const [kit, setKit] = useState<Kit>(EMPTY)
  const [logo, setLogo] = useState('')
  const [voice, setVoice] = useState('')
  const [tone, setTone] = useState('')
  const [avoid, setAvoid] = useState('')
  const [autoGenerated, setAutoGenerated] = useState(true)
  const [hasRow, setHasRow] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [agentBusy, setAgentBusy] = useState(false)
  const [agentMsg, setAgentMsg] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)
  const [logoMsg, setLogoMsg] = useState('')
  const [prevColors, setPrevColors] = useState<Kit['colors'] | null>(null)
  const [readingLogo, setReadingLogo] = useState(false)
  const [logoMeta, setLogoMeta] = useState<LogoMeta | null>(null)
  const [preparing, setPreparing] = useState(false)
  const [procWarn, setProcWarn] = useState('')

  // Logo novo → a IA lê as cores do logo e já salva (brand-kit-suggest
  // from_logo). Fica um "Desfazer" com as cores de antes.
  const colorsFromLogo = async () => {
    if (!session) return
    setReadingLogo(true); setLogoMsg(''); setPrevColors(null)
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/brand-kit-suggest`, {
        method: 'POST', headers: { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'from_logo' }),
      })
      const d = await res.json().catch(() => ({})) as { colors?: Kit['colors']; prev?: Kit['colors'] | null; error?: string }
      if (!res.ok || !d.colors) throw new Error(d.error ?? X.logoColorsErr)
      setKit(k => ({ ...k, colors: d.colors! }))
      setPrevColors(d.prev ?? kit.colors)
      setLogoMsg(X.logoColors)
    } catch (e) { setLogoMsg(e instanceof Error ? e.message : X.logoColorsErr) }
    setReadingLogo(false)
  }
  // Lê logo_meta num select à parte e tolerante: sem a migration (coluna ausente) vira null e a tela segue como antes.
  const loadMeta = useCallback(async () => {
    setLogoMeta(await fetchLogoMeta(companyId))
  }, [companyId])

  // Prepara o logo pros criativos (PNG transparente, logo × foto) — brand-kit-suggest/process_logo.
  const prepareLogo = async (extra: Record<string, unknown> = {}) => {
    if (!session) return
    setPreparing(true); setProcWarn(''); setLogoMsg('')
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/brand-kit-suggest`, {
        method: 'POST', headers: { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'process_logo', ...extra }),
      })
      const d = await res.json().catch(() => ({})) as { logo_url?: string | null; warning?: string | null; colors?: Kit['colors'] | null; prev?: Kit['colors'] | null; error?: string }
      if (!res.ok) throw new Error(d.error ?? X.prepErr)
      if (d.logo_url) setLogo(d.logo_url)
      if (d.warning === 'formato') setProcWarn(X.warnFormat)
      if (d.colors) { setKit(k => ({ ...k, colors: d.colors! })); setPrevColors(d.prev ?? kit.colors); setLogoMsg(X.logoColors) }
      await loadMeta()
    } catch (e) { setLogoMsg(e instanceof Error ? e.message : X.prepErr) }
    setPreparing(false)
  }

  const undoColors = async () => {
    if (!prevColors) return
    const next = { ...kit, colors: prevColors }
    setKit(next)
    await supabase.from('brand_dna').upsert({ company_id: companyId, kit: next, colors: [...prevColors.primary, ...prevColors.accent].filter(Boolean) }, { onConflict: 'company_id' })
    setPrevColors(null); setLogoMsg(X.undone)
  }

  const load = useCallback(async () => {
    const { data } = await supabase.from('brand_dna').select('kit, logo_url, voice, tone, avoid, auto_generated').eq('company_id', companyId).maybeSingle()
    const d = data as { kit: Kit | null; logo_url: string | null; voice: string | null; tone: string | null; avoid: string | null; auto_generated: boolean | null } | null
    if (d?.kit) setKit({ ...EMPTY, ...d.kit, colors: { ...EMPTY.colors, ...d.kit.colors }, typography: { ...EMPTY.typography, ...d.kit.typography } })
    setLogo(d?.logo_url ?? '')
    setVoice(d?.voice ?? ''); setTone(d?.tone ?? ''); setAvoid(d?.avoid ?? '')
    setAutoGenerated(d?.auto_generated ?? true)
    setHasRow(!!d)
    await loadMeta()
    setLoading(false)
    return !!d
  }, [companyId, loadMeta])

  // Primeira visita sem kit nenhum: o agente decide sozinho na hora, sem
  // esperar o cron semanal. Silencioso — só mostra se conseguiu ou não.
  useEffect(() => {
    load().then(async existed => {
      if (existed || !session || readOnly) return
      setAgentBusy(true)
      try {
        const res = await fetch(`${SUPABASE_URL}/functions/v1/brand-kit-suggest`, {
          method: 'POST', headers: { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
        })
        const d = await res.json().catch(() => ({}))
        if (res.ok && d.ok) {
          const base = d.based_on > 0 ? `${X.builtKit} ${d.based_on} ${X.realPhotos}` : X.fetchedLogo
          setAgentMsg(X.agentDone(base, !!d.logo_set))
          await load()
        }
      } catch { /* silencioso — sem fotos reais ainda, tudo bem */ }
      setAgentBusy(false)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId, session])

  const refreshFromAgent = async () => {
    if (!session) return
    setAgentBusy(true); setAgentMsg('')
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/brand-kit-suggest`, {
        method: 'POST', headers: { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
      })
      const d = await res.json().catch(() => ({}))
      if (!res.ok || !d.ok) throw new Error(d.error ?? X.updateErr)
      setAgentMsg(X.updatedFrom(d.based_on, !!d.logo_set))
      await load()
    } catch (e) {
      setAgentMsg(e instanceof Error ? e.message : X.updateErr)
    }
    setAgentBusy(false)
  }

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true); setProcWarn('')
    try {
      // SVG: o bucket não aceita SVG — o texto do arquivo vai direto pra função, que devolve um PNG transparente.
      if (file.type === 'image/svg+xml' || /\.svg$/i.test(file.name)) {
        if (file.size > 500 * 1024) { setLogoMsg(X.svgBig); return }
        const svg = await file.text()
        setAutoGenerated(false)
        setUploading(false)
        await prepareLogo({ svg, colors: true })
        return
      }
      const ext = (file.name.split('.').pop() || 'png').toLowerCase()
      const path = `renders/${companyId}/logo-${crypto.randomUUID()}.${ext}`
      const { error } = await supabase.storage.from('post-images').upload(path, file, { contentType: file.type || 'image/png', upsert: false })
      if (!error) {
        const { data } = supabase.storage.from('post-images').getPublicUrl(path)
        setLogo(data.publicUrl)
        // Salva na hora — sem isso, o logo aparecia na prévia (estado local)
        // mas só ia pro banco de verdade se o dono clicasse "Salvar Kit da
        // Marca" depois, separado. Fácil de esquecer — foi exatamente isso
        // que deixou o logo real de fora dos posts mesmo já "enviado".
        await supabase.from('brand_dna').upsert({ company_id: companyId, logo_url: data.publicUrl }, { onConflict: 'company_id' })
        setAutoGenerated(false)
        setUploading(false)
        await prepareLogo({ colors: true })   // PNG transparente + logo × foto + cores (se for logo)
      }
    } finally { setUploading(false); if (fileRef.current) fileRef.current.value = '' }
  }

  // Salvar manualmente = o dono assume o kit a partir daqui; o agente para
  // de sobrescrever (auto_generated=false).
  const save = async () => {
    setSaving(true)
    const flat = [...kit.colors.primary, ...kit.colors.accent].filter(Boolean)
    await supabase.from('brand_dna').upsert({
      company_id: companyId, kit, logo_url: logo, colors: flat, fonts: kit.typography.heading,
      voice: voice || null, tone: tone || null, avoid: avoid || null, auto_generated: false, updated_at: new Date().toISOString(),
    }, { onConflict: 'company_id' })
    // upsert, não update: empresa pode ainda não ter linha em
    // marketing_ai_config — um update ali daria 0 linhas afetadas sem erro
    // nenhum, e voz/tom pareceriam salvos mas nunca teriam efeito real.
    if (voice || tone) await supabase.from('marketing_ai_config').upsert({ company_id: companyId, brand_voice: voice || null, tone: tone || null }, { onConflict: 'company_id' })
    setAutoGenerated(false)
    setSaving(false); setSaved(true); setTimeout(() => setSaved(false), 2500)
    // Logo salvo por link (ou trocado à mão): prepara sozinho, igual ao upload por arquivo. O botão "refazer" é só atalho.
    if (logo && !usableLogoMeta(logoMeta, logo)) await prepareLogo()
  }

  const setColor = (group: 'primary' | 'accent', i: number, v: string) => setKit(k => ({ ...k, colors: { ...k.colors, [group]: k.colors[group].map((c, idx) => idx === i ? v : c) } }))

  const meta = usableLogoMeta(logoMeta, logo)
  const isFoto = meta?.kind === 'foto'
  const preview = (meta && meta.png_url) || logo   // prefere o PNG preparado (anti logo velha: só se o meta é deste logo)

  if (loading) return <div style={{ fontSize: '12px', color: MUTED }}>{X.loading}</div>

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', maxWidth: '760px' }}>
      <div style={{ padding: '12px 16px', background: 'rgba(167,139,250,0.07)', border: '1px solid rgba(167,139,250,0.25)', borderRadius: '11px', fontSize: '11.5px', color: 'white', lineHeight: 1.6 }}>
        {X.introA}<strong>{X.introB}</strong>{X.introC}<strong>{X.introD}</strong>{X.introE}
      </div>

      {hasRow && autoGenerated && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', padding: '11px 15px', background: 'rgba(74,222,128,0.06)', border: '1px solid rgba(74,222,128,0.22)', borderRadius: '11px', fontSize: '11.5px', color: 'white', lineHeight: 1.6 }}>
          <span>{X.genA}<strong style={{ color: GREEN }}>{X.genB}</strong>{X.genC}</span>
          <button onClick={refreshFromAgent} disabled={agentBusy} style={{ marginLeft: 'auto', flexShrink: 0, padding: '6px 12px', background: 'transparent', border: `1px solid ${BORDER}`, borderRadius: '8px', color: MUTED, fontSize: '11px', fontWeight: 700, cursor: 'pointer', fontFamily: D }}>{agentBusy ? X.updating : X.updateNow}</button>
        </div>
      )}
      {!hasRow && (
        <div style={{ padding: '11px 15px', background: 'rgba(251,191,36,0.06)', border: '1px solid rgba(251,191,36,0.22)', borderRadius: '11px', fontSize: '11.5px', color: 'white', lineHeight: 1.6 }}>
          {agentBusy ? X.agentLooking : X.agentWaiting}
        </div>
      )}
      {agentMsg && <div style={{ fontSize: '11.5px', color: agentMsg.startsWith('✓') ? GREEN : '#f87171' }}>{agentMsg}</div>}

      {/* Voz da marca */}
      <section>
        <div style={{ fontSize: '11px', fontWeight: 800, color: ORANGE, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '10px' }}>{X.voiceTitle}</div>
        <textarea value={voice} onChange={e => setVoice(e.target.value)} rows={2} placeholder={X.voicePh} style={{ ...inputStyle, width: '100%', boxSizing: 'border-box', resize: 'vertical', fontFamily: D, marginBottom: '10px' }} />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
          <div>
            <div style={{ fontSize: '10px', color: MUTED, marginBottom: '4px' }}>{X.tone}</div>
            <input value={tone} onChange={e => setTone(e.target.value)} placeholder={X.tonePh} style={{ ...inputStyle, width: '100%', boxSizing: 'border-box' }} />
          </div>
          <div>
            <div style={{ fontSize: '10px', color: MUTED, marginBottom: '4px' }}>{X.avoid}</div>
            <input value={avoid} onChange={e => setAvoid(e.target.value)} placeholder={X.avoidPh} style={{ ...inputStyle, width: '100%', boxSizing: 'border-box' }} />
          </div>
        </div>
      </section>

      {/* Logo */}
      <section>
        <div style={{ fontSize: '11px', fontWeight: 800, color: ORANGE, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '6px' }}>{X.logo}</div>
        <div style={{ fontSize: '10.5px', color: MUTED, marginBottom: '10px' }}>{X.logoHint}</div>
        <div style={{ display: 'flex', gap: '14px', alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', gap: '10px' }}>
            {([['#0E0B0A', X.prevDark], ['#F5F1EA', X.prevLight]] as const).map(([bg, label]) => (
              <div key={bg} style={{ textAlign: 'center' }}>
                <div style={{ width: '90px', height: '90px', borderRadius: '10px', background: bg, border: `1px solid ${BORDER}`, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', padding: '6px', boxSizing: 'border-box' }}>
                  {preview ? <img src={preview} alt={X.logo} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} /> : <span style={{ fontSize: '10px', color: bg === '#0E0B0A' ? MUTED : '#666' }}>{logo ? '—' : X.noLogo}</span>}
                </div>
                <div style={{ fontSize: '9.5px', color: MUTED, marginTop: '3px' }}>{label}</div>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', flex: 1, minWidth: '240px' }}>
            <input ref={fileRef} type="file" accept="image/png,image/svg+xml" onChange={onFile} style={{ display: 'none' }} />
            <button onClick={() => fileRef.current?.click()} disabled={uploading || preparing} style={{ alignSelf: 'flex-start', padding: '8px 15px', background: ORANGE, color: '#000', fontWeight: 700, fontSize: '12px', borderRadius: '8px', border: 'none', cursor: 'pointer', fontFamily: D }}>{uploading ? X.uploading : X.upload}</button>
            <input value={logo} onChange={e => setLogo(e.target.value)} placeholder={X.logoPh} style={inputStyle} />
            {logo && (
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <button onClick={async () => { await supabase.from('brand_dna').upsert({ company_id: companyId, logo_url: logo }, { onConflict: 'company_id' }); await prepareLogo() }} disabled={preparing || readingLogo}
                  style={{ padding: '6px 12px', background: 'transparent', border: `1px solid ${BORDER}`, borderRadius: '8px', color: ORANGE, fontSize: '11px', fontWeight: 700, cursor: 'pointer', fontFamily: D }}>
                  {preparing ? X.preparing : X.prepare}
                </button>
                <button onClick={async () => { await supabase.from('brand_dna').upsert({ company_id: companyId, logo_url: logo }, { onConflict: 'company_id' }); await colorsFromLogo() }} disabled={readingLogo || preparing}
                  style={{ padding: '6px 12px', background: 'transparent', border: `1px solid ${BORDER}`, borderRadius: '8px', color: ORANGE, fontSize: '11px', fontWeight: 700, cursor: 'pointer', fontFamily: D }}>
                  {readingLogo ? X.readingLogo : X.fromLogo}
                </button>
              </div>
            )}
          </div>
        </div>
        {isFoto && <div style={{ marginTop: '10px', padding: '9px 13px', background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.35)', borderRadius: '9px', fontSize: '11.5px', color: '#FBBF24', lineHeight: 1.55 }}>{X.warnFoto}</div>}
        {meta && !isFoto && !meta.png_url && !procWarn && <div style={{ marginTop: '10px', padding: '9px 13px', background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.35)', borderRadius: '9px', fontSize: '11.5px', color: '#FBBF24', lineHeight: 1.55 }}>{X.warnBg}</div>}
        {procWarn && <div style={{ marginTop: '10px', padding: '9px 13px', background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.35)', borderRadius: '9px', fontSize: '11.5px', color: '#FBBF24', lineHeight: 1.55 }}>{procWarn}</div>}
        {meta && !isFoto && meta.png_url && !preparing && <div style={{ marginTop: '10px', fontSize: '11.5px', color: GREEN }}>{meta.bg_removed ? X.ready : X.readyKept}</div>}
        {(logoMsg || readingLogo || preparing) && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '10px', fontSize: '11.5px', color: logoMsg.startsWith('🎨') || logoMsg === X.undone ? GREEN : readingLogo || preparing ? MUTED : '#f87171' }}>
            <span>{preparing ? X.preparing : readingLogo ? X.readingLogo : logoMsg}</span>
            {prevColors && !readingLogo && !preparing && <button onClick={undoColors} style={{ padding: '4px 10px', background: 'transparent', border: `1px solid ${BORDER}`, borderRadius: '7px', color: 'white', fontSize: '11px', cursor: 'pointer', fontFamily: D }}>↶ {X.undo}</button>}
          </div>
        )}
      </section>

      {/* Cores */}
      <section>
        <div style={{ fontSize: '11px', fontWeight: 800, color: ORANGE, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '4px' }}>{X.colorsTitle}</div>
        <div style={{ fontSize: '10.5px', color: MUTED, marginBottom: '12px' }}>{X.colorsDesc}</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: '14px' }}>
          <ColorInput label={X.primary1} value={kit.colors.primary[0]} onChange={v => setColor('primary', 0, v)} />
          <ColorInput label={X.primary2} value={kit.colors.primary[1]} onChange={v => setColor('primary', 1, v)} />
          <ColorInput label={X.accent1} value={kit.colors.accent[0]} onChange={v => setColor('accent', 0, v)} />
          <ColorInput label={X.accent2} value={kit.colors.accent[1]} onChange={v => setColor('accent', 1, v)} />
          <ColorInput label={X.text} value={kit.colors.text} onChange={v => setKit(k => ({ ...k, colors: { ...k.colors, text: v } }))} />
          <ColorInput label={X.bg} value={kit.colors.bg} onChange={v => setKit(k => ({ ...k, colors: { ...k.colors, bg: v } }))} />
        </div>
      </section>

      {/* Tipografia */}
      <section>
        <div style={{ fontSize: '11px', fontWeight: 800, color: ORANGE, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '10px' }}>{X.typo}</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
          <div>
            <div style={{ fontSize: '10px', color: MUTED, marginBottom: '4px' }}>{X.headFont}</div>
            <input value={kit.typography.heading} onChange={e => setKit(k => ({ ...k, typography: { ...k.typography, heading: e.target.value } }))} placeholder={X.headPh} style={{ ...inputStyle, width: '100%', boxSizing: 'border-box' }} />
          </div>
          <div>
            <div style={{ fontSize: '10px', color: MUTED, marginBottom: '4px' }}>{X.bodyFont}</div>
            <input value={kit.typography.body} onChange={e => setKit(k => ({ ...k, typography: { ...k.typography, body: e.target.value } }))} placeholder={X.bodyPh} style={{ ...inputStyle, width: '100%', boxSizing: 'border-box' }} />
          </div>
        </div>
      </section>

      {/* Composição */}
      <section>
        <div style={{ fontSize: '11px', fontWeight: 800, color: ORANGE, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '10px' }}>{X.composition}</div>
        <textarea value={kit.composition} onChange={e => setKit(k => ({ ...k, composition: e.target.value }))} rows={3} placeholder={X.compPh} style={{ ...inputStyle, width: '100%', boxSizing: 'border-box', resize: 'vertical', fontFamily: D }} />
      </section>

      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <button onClick={save} disabled={saving} style={{ padding: '10px 22px', background: ORANGE, color: '#000', fontWeight: 700, fontSize: '13px', borderRadius: '9px', border: 'none', cursor: saving ? 'default' : 'pointer', fontFamily: D }}>{saving ? X.saving : X.save}</button>
        {saved && <span style={{ fontSize: '12px', fontWeight: 700, color: GREEN }}>{X.saved}</span>}
      </div>
    </div>
  )
}
