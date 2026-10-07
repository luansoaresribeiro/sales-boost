import { useEffect, useState } from 'react'
import type { CompanyData } from '../../../contexts/CompanyContext'
import { supabase } from '../../../lib/supabase'
import { useLang } from '../../../contexts/LanguageContext'
import { CARD, MUTED, BORDER, D } from './shared'

const ORANGE = '#FF6D29'
const GREEN = '#4ade80'

interface BrandDna {
  voice: string; tone: string; avoid: string
  colors: string[]; fonts: string; logo_url: string; design_notes: string
  meta_synced: boolean
}
const EMPTY: BrandDna = { voice: '', tone: '', avoid: '', colors: [], fonts: '', logo_url: '', design_notes: '', meta_synced: false }

const inputStyle = { width: '100%', boxSizing: 'border-box' as const, padding: '9px 12px', background: 'rgba(255,255,255,0.04)', border: `1px solid ${BORDER}`, borderRadius: '9px', color: 'white', fontSize: '13px', outline: 'none', fontFamily: D }
const labelStyle = { fontSize: '10.5px', fontWeight: 700, color: MUTED, textTransform: 'uppercase' as const, letterSpacing: '0.05em', marginBottom: '5px' }

const TX = {
  pt: {
    title: 'DNA da marca', subtitle: 'Voz, tom e sistema de design — a identidade que a IA usa em tudo.',
    filled: (n: number) => `${n} preenchido(s)`, empty: 'vazio',
    voiceTitle: 'Voz da marca', speak: 'Jeito de falar / personalidade',
    voicePh: "Ex: Próxima e acolhedora, fala como uma amiga que entende do assunto. Usa 'você', evita formalidade.",
    tone: 'Tom', tonePh: 'acolhedor, leve, confiante', avoid: 'O que a marca NUNCA faz/diz', avoidPh: 'Ex: nunca usa gírias, nunca fala de preço baixo',
    design: 'Sistema de design', designHint: 'Preencha à mão agora. Quando a Meta/Instagram conectar, a IA puxa isto sozinha do seu perfil.',
    colors: 'Cores da marca (hex, separadas por vírgula)', autoMeta: 'auto pela Meta', fonts: 'Fontes', fontsPh: 'Ex: Bricolage Grotesque', logoUrl: 'Logo (URL)',
    notes: 'Direção de arte (observações)', notesPh: 'Ex: fotos com luz natural, fundo de madeira, nada de stock genérico. Estilo minimalista.',
    saving: 'Salvando…', save: 'Salvar DNA da marca', saved: '✓ Salvo — a IA já vai usar', synced: '🔗 sincronizado com a Meta',
  },
  en: {
    title: 'Brand DNA', subtitle: 'Voice, tone and design system — the identity the AI uses everywhere.',
    filled: (n: number) => `${n} filled`, empty: 'empty',
    voiceTitle: 'Brand voice', speak: 'Way of speaking / personality',
    voicePh: "E.g. Warm and approachable, talks like a friend who knows the subject. Uses 'you', avoids formality.",
    tone: 'Tone', tonePh: 'welcoming, light, confident', avoid: 'What the brand NEVER does/says', avoidPh: 'E.g. never uses slang, never talks about low prices',
    design: 'Design system', designHint: 'Fill in by hand for now. Once Meta/Instagram is connected, the AI pulls this from your profile on its own.',
    colors: 'Brand colors (hex, comma-separated)', autoMeta: 'auto via Meta', fonts: 'Fonts', fontsPh: 'E.g. Bricolage Grotesque', logoUrl: 'Logo (URL)',
    notes: 'Art direction (notes)', notesPh: 'E.g. photos with natural light, wooden background, no generic stock. Minimalist style.',
    saving: 'Saving…', save: 'Save brand DNA', saved: '✓ Saved — the AI will use it now', synced: '🔗 synced with Meta',
  },
} as const

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={{ ...labelStyle, display: 'flex', alignItems: 'center', gap: '8px' }}>
        {label}
        {hint && <span style={{ fontSize: '9px', fontWeight: 700, color: '#60a5fa', textTransform: 'none', letterSpacing: 0 }}>🔗 {hint}</span>}
      </div>
      {children}
    </div>
  )
}

// DNA da marca — voz + sistema de design. Persiste em brand_dna (real).
// A voz/tom já entram no cérebro do agente; o design (cores/fontes/logo) é
// manual agora e vira auto-preenchido quando a Meta/Instagram conectar.
export default function BrandDnaPanel({ company }: { company: Pick<CompanyData, 'id'> }) {
  const { lang } = useLang()
  const X = TX[lang]
  const [dna, setDna] = useState<BrandDna>(EMPTY)
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [colorsText, setColorsText] = useState('')

  useEffect(() => {
    supabase.from('brand_dna').select('*').eq('company_id', company.id).maybeSingle()
      .then(({ data }) => {
        if (data) {
          const d = data as BrandDna
          setDna({ ...EMPTY, ...d })
          setColorsText((d.colors ?? []).join(', '))
        }
        setLoading(false)
      })
  }, [company.id])

  const set = (patch: Partial<BrandDna>) => { setDna(d => ({ ...d, ...patch })); setSaved(false) }

  const save = async () => {
    setSaving(true)
    const colors = colorsText.split(',').map(c => c.trim()).filter(Boolean)
    const payload = { company_id: company.id, voice: dna.voice, tone: dna.tone, avoid: dna.avoid, colors, fonts: dna.fonts, logo_url: dna.logo_url, design_notes: dna.design_notes, updated_at: new Date().toISOString() }
    const { error } = await supabase.from('brand_dna').upsert(payload, { onConflict: 'company_id' })
    setSaving(false)
    if (!error) { setDna(d => ({ ...d, colors })); setSaved(true); setTimeout(() => setSaved(false), 2500) }
  }

  const filled = [dna.voice, dna.tone, dna.avoid, colorsText, dna.fonts, dna.logo_url].filter(Boolean).length
  const swatches = colorsText.split(',').map(c => c.trim()).filter(Boolean)

  return (
    <div style={{ background: CARD, border: `1px solid ${open ? 'rgba(255,109,41,0.3)' : BORDER}`, borderRadius: '14px', marginBottom: '18px', overflow: 'hidden' }}>
      <button onClick={() => setOpen(o => !o)} style={{ width: '100%', textAlign: 'left', background: 'transparent', border: 'none', cursor: 'pointer', padding: '15px 18px', display: 'flex', alignItems: 'center', gap: '11px', fontFamily: D }}>
        <span style={{ fontSize: '18px' }}>🎨</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: '13.5px', fontWeight: 700, color: 'white' }}>{X.title}</div>
          <div style={{ fontSize: '11px', color: MUTED }}>{X.subtitle}</div>
        </div>
        {!loading && <span style={{ fontSize: '10px', fontWeight: 700, color: filled > 0 ? GREEN : MUTED, background: filled > 0 ? 'rgba(74,222,128,0.1)' : 'rgba(255,255,255,0.05)', borderRadius: '99px', padding: '3px 9px' }}>{filled > 0 ? X.filled(filled) : X.empty}</span>}
        <span style={{ fontSize: '11px', color: MUTED, transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }}>▾</span>
      </button>

      {open && !loading && (
        <div style={{ padding: '4px 18px 18px', borderTop: `1px solid ${BORDER}`, display: 'flex', flexDirection: 'column', gap: '15px' }}>
          <div style={{ fontSize: '10.5px', fontWeight: 700, color: ORANGE, textTransform: 'uppercase', letterSpacing: '0.06em', marginTop: '14px' }}>{X.voiceTitle}</div>
          <Field label={X.speak}>
            <textarea value={dna.voice} onChange={e => set({ voice: e.target.value })} rows={2} placeholder={X.voicePh} style={{ ...inputStyle, resize: 'vertical' }} />
          </Field>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <Field label={X.tone}>
              <input value={dna.tone} onChange={e => set({ tone: e.target.value })} placeholder={X.tonePh} style={inputStyle} />
            </Field>
            <Field label={X.avoid}>
              <input value={dna.avoid} onChange={e => set({ avoid: e.target.value })} placeholder={X.avoidPh} style={inputStyle} />
            </Field>
          </div>

          <div style={{ fontSize: '10.5px', fontWeight: 700, color: ORANGE, textTransform: 'uppercase', letterSpacing: '0.06em', marginTop: '4px' }}>{X.design}</div>
          <div style={{ fontSize: '11px', color: MUTED, lineHeight: 1.5, marginTop: '-6px' }}>
            {X.designHint}
          </div>
          <Field label={X.colors} hint={X.autoMeta}>
            <input value={colorsText} onChange={e => { setColorsText(e.target.value); setSaved(false) }} placeholder="#FF6D29, #150E08, #FFFFFF" style={inputStyle} />
          </Field>
          {swatches.length > 0 && (
            <div style={{ display: 'flex', gap: '7px', flexWrap: 'wrap', marginTop: '-6px' }}>
              {swatches.map((c, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '4px 9px 4px 5px', background: 'rgba(255,255,255,0.03)', border: `1px solid ${BORDER}`, borderRadius: '99px' }}>
                  <span style={{ width: '16px', height: '16px', borderRadius: '5px', background: c, border: '1px solid rgba(255,255,255,0.15)', display: 'inline-block' }} />
                  <span style={{ fontSize: '10.5px', color: MUTED }}>{c}</span>
                </div>
              ))}
            </div>
          )}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <Field label={X.fonts} hint={X.autoMeta}>
              <input value={dna.fonts} onChange={e => set({ fonts: e.target.value })} placeholder={X.fontsPh} style={inputStyle} />
            </Field>
            <Field label={X.logoUrl} hint={X.autoMeta}>
              <input value={dna.logo_url} onChange={e => set({ logo_url: e.target.value })} placeholder="https://…" style={inputStyle} />
            </Field>
          </div>
          <Field label={X.notes}>
            <textarea value={dna.design_notes} onChange={e => set({ design_notes: e.target.value })} rows={2} placeholder={X.notesPh} style={{ ...inputStyle, resize: 'vertical' }} />
          </Field>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button onClick={save} disabled={saving} style={{ padding: '9px 20px', background: ORANGE, color: '#000', fontWeight: 700, fontSize: '13px', border: 'none', borderRadius: '9px', cursor: saving ? 'default' : 'pointer', fontFamily: D }}>
              {saving ? X.saving : X.save}
            </button>
            {saved && <span style={{ fontSize: '12px', fontWeight: 700, color: GREEN }}>{X.saved}</span>}
            {dna.meta_synced && <span style={{ fontSize: '11px', color: '#60a5fa' }}>{X.synced}</span>}
          </div>
        </div>
      )}
    </div>
  )
}
