import { useEffect, useState } from 'react'
import { supabase } from '../../../lib/supabase'

const ORANGE = '#FF6D29'
const CARD = '#150E08'
const MUTED = '#BABABA'
const BORDER = 'rgba(255,255,255,0.06)'
const D = "'Bricolage Grotesque', system-ui, sans-serif"

// Entendimento do negócio — o que o onboarding conversacional captou. É o
// Business Context que alimenta os agentes. Card auto-contido: carrega e salva
// seus próprios campos, sem depender do save do resto da página.
interface Understanding {
  business_description: string
  ideal_customer: string
  business_stage: string
  primary_goals: string
  main_challenges: string
  current_channels: string
  agent_business_interpretation: string
}
const EMPTY: Understanding = {
  business_description: '', ideal_customer: '', business_stage: '', primary_goals: '',
  main_challenges: '', current_channels: '', agent_business_interpretation: '',
}

const FIELDS: { key: keyof Understanding; label: string; area?: boolean }[] = [
  { key: 'business_description', label: 'O que seu negócio faz', area: true },
  { key: 'ideal_customer', label: 'Cliente ideal', area: true },
  { key: 'business_stage', label: 'Fase do negócio' },
  { key: 'primary_goals', label: 'Objetivo principal' },
  { key: 'main_challenges', label: 'Maior desafio' },
  { key: 'current_channels', label: 'Canais atuais' },
]

export default function BusinessUnderstandingCard({ companyId }: { companyId: string }) {
  const [u, setU] = useState<Understanding>(EMPTY)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    let alive = true
    supabase.from('companies')
      .select('business_description, ideal_customer, business_stage, primary_goals, main_challenges, current_channels, agent_business_interpretation')
      .eq('id', companyId).maybeSingle()
      .then(({ data }) => { if (alive && data) setU({ ...EMPTY, ...Object.fromEntries(Object.entries(data).map(([k, v]) => [k, v ?? ''])) } as Understanding); setLoading(false) })
    return () => { alive = false }
  }, [companyId])

  const set = (k: keyof Understanding) => (v: string) => { setU(p => ({ ...p, [k]: v })); setSaved(false) }

  const save = async () => {
    setSaving(true)
    // Recompõe a interpretação pros agentes a partir do que o dono editou.
    const interpretation = `Negócio "${u.business_description || '—'}". Cliente ideal: ${u.ideal_customer || '—'}. Objetivo: ${u.primary_goals || '—'}. Desafio: ${u.main_challenges || '—'}. Canais: ${u.current_channels || '—'}. Fase: ${u.business_stage || '—'}.`
    await supabase.from('companies').update({ ...u, agent_business_interpretation: interpretation, updated_at: new Date().toISOString() }).eq('id', companyId)
    setU(p => ({ ...p, agent_business_interpretation: interpretation }))
    setSaving(false); setSaved(true); setTimeout(() => setSaved(false), 2500)
  }

  if (loading) return null

  return (
    <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: '14px', padding: '22px 24px', marginBottom: '20px' }}>
      <div style={{ fontSize: '15px', fontWeight: 800, color: 'white', marginBottom: '3px' }}>🧠 Entendimento do negócio</div>
      <p style={{ fontSize: '12px', color: MUTED, marginBottom: '18px', lineHeight: 1.6 }}>
        O que captamos no seu cadastro. Isso é o <strong style={{ color: 'white' }}>contexto que os agentes usam</strong> pra decidir e recomendar. Pode ajustar quando quiser.
      </p>

      {FIELDS.map(f => (
        <div key={f.key} style={{ marginBottom: '14px' }}>
          <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '6px' }}>{f.label}</label>
          {f.area ? (
            <textarea value={u[f.key]} onChange={e => set(f.key)(e.target.value)} rows={2}
              style={{ width: '100%', boxSizing: 'border-box', padding: '10px 13px', background: 'rgba(255,255,255,0.04)', border: `1px solid ${BORDER}`, borderRadius: '10px', color: 'white', fontSize: '13.5px', outline: 'none', fontFamily: 'inherit', resize: 'vertical', lineHeight: 1.5 }} />
          ) : (
            <input value={u[f.key]} onChange={e => set(f.key)(e.target.value)}
              style={{ width: '100%', boxSizing: 'border-box', padding: '10px 13px', background: 'rgba(255,255,255,0.04)', border: `1px solid ${BORDER}`, borderRadius: '10px', color: 'white', fontSize: '13.5px', outline: 'none', fontFamily: 'inherit' }} />
          )}
        </div>
      ))}

      {u.agent_business_interpretation && (
        <div style={{ margin: '4px 0 16px', padding: '12px 14px', background: 'rgba(255,109,41,0.05)', border: '1px solid rgba(255,109,41,0.15)', borderRadius: '10px', fontSize: '12px', color: 'white', lineHeight: 1.6 }}>
          <div style={{ fontSize: '9.5px', fontWeight: 700, color: ORANGE, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>Como a IA resume seu negócio</div>
          {u.agent_business_interpretation}
        </div>
      )}

      <button onClick={save} disabled={saving}
        style={{ padding: '10px 20px', background: saved ? '#4ade80' : ORANGE, color: '#000', fontWeight: 700, fontSize: '13px', border: 'none', borderRadius: '10px', cursor: saving ? 'not-allowed' : 'pointer', fontFamily: D }}>
        {saved ? '✓ Salvo' : saving ? 'Salvando...' : 'Salvar entendimento'}
      </button>
    </div>
  )
}
