// Widget persistente e discreto do trial — mostra em toda página do
// dashboard enquanto o trial estiver ativo. Some sozinho quando o cliente
// assina ou cancela. Números vêm sempre de contagem real, nunca inventados.
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useCompany } from '../../contexts/CompanyContext'
import { getTrialInfo } from '../../lib/trialState'
import { CARD, MUTED, ORANGE, D } from './marketingAi/shared'

// Mensagem por fase, genérica pelo total de dias do trial (3 nos antigos, 7 nos novos).
function dayMessage(day: number, total: number): string {
  if (day <= 1) return 'Seu Trial de Crescimento do Negócio começou.'
  if (day >= total) return 'Seu trial termina hoje. Veja o que o SalesBoost descobriu.'
  if (day * 2 <= total) return 'O SalesBoost está analisando seu negócio e o mercado.'
  return 'O SalesBoost encontrou novas oportunidades pro seu negócio.'
}

export default function TrialStatusWidget() {
  const { company } = useCompany()
  const navigate = useNavigate()
  const [gp, setGp] = useState<number | null>(null)
  const [opportunities, setOpportunities] = useState<number | null>(null)
  const info = getTrialInfo(company)

  useEffect(() => {
    if (!company?.id || !info.isTrial) return
    let alive = true
    ;(async () => {
      const [{ data: events }, { count }] = await Promise.all([
        supabase.from('progress_events').select('gp').eq('company_id', company.id),
        supabase.from('opportunities').select('id', { count: 'exact', head: true }).eq('company_id', company.id),
      ])
      if (!alive) return
      setGp((events ?? []).reduce((s, e) => s + (e.gp ?? 0), 0))
      setOpportunities(count ?? 0)
    })()
    return () => { alive = false }
  }, [company?.id, info.isTrial])

  if (!company || !info.isTrial || !company.trial_intro_seen_at) return null

  const isExpiring = info.state === 'trial_expiring'

  return (
    <div onClick={() => navigate('/dashboard/trial')}
      style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', padding: '12px 20px', margin: '14px 20px 0', background: CARD, border: `1px solid ${isExpiring ? 'rgba(251,191,36,0.3)' : 'rgba(255,109,41,0.2)'}`, borderRadius: '12px', cursor: 'pointer', fontFamily: D }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
        <span style={{ fontSize: '18px', flexShrink: 0 }}>{isExpiring ? '⏳' : '🚀'}</span>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: '12.5px', fontWeight: 700, color: 'white' }}>
            Trial de Crescimento · Dia {info.dayNumber} de {info.totalDays}
          </div>
          <div style={{ fontSize: '11px', color: MUTED, marginTop: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {info.dayNumber && info.totalDays ? dayMessage(info.dayNumber, info.totalDays) : ''}
          </div>
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexShrink: 0 }}>
        {gp != null && <Stat label="XP" value={`+${gp}`} />}
        {opportunities != null && <Stat label="oportunidades" value={String(opportunities)} />}
        <span style={{ fontSize: '11.5px', fontWeight: 700, color: ORANGE, whiteSpace: 'nowrap' }}>Continuar →</span>
      </div>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ textAlign: 'right' }}>
      <div style={{ fontSize: '13px', fontWeight: 800, color: 'white' }}>{value}</div>
      <div style={{ fontSize: '9.5px', color: MUTED }}>{label}</div>
    </div>
  )
}
