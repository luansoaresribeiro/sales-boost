// Tela de boas-vindas do trial — aparece UMA vez, na primeira visita ao
// dashboard depois do trial começar. Preço, data de expiração e política de
// cancelamento sempre visíveis aqui, pra nunca surpreender o cliente depois.
import { useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useCompany } from '../../contexts/CompanyContext'
import { getTrialInfo, formatExpiresAt } from '../../lib/trialState'
import { CARD, MUTED, BORDER, ORANGE, D } from './marketingAi/shared'

// Mesmo plano/preço já mostrados na home antes do cadastro (Pro — o mais
// popular) — não inventa número novo, só repete o que já está público.
const PLAN_PRICE_BR = 'R$14,49'
const PLAN_PRICE_US = '$2.99'

export default function TrialStartModal() {
  const { company, refreshCompany } = useCompany()
  const [dismissing, setDismissing] = useState(false)
  const info = getTrialInfo(company)

  if (!company || company.trial_intro_seen_at || info.state !== 'trial_day_1') return null

  const dismiss = async () => {
    setDismissing(true)
    await supabase.from('companies').update({ trial_intro_seen_at: new Date().toISOString() }).eq('id', company.id)
    await refreshCompany()
    setDismissing(false)
  }

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-6" style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)' }}>
      <div style={{ width: '100%', maxWidth: '460px', background: `linear-gradient(180deg, ${CARD}, #100b07)`, border: `1px solid rgba(255,109,41,0.3)`, borderRadius: '20px', padding: '32px', fontFamily: D, boxShadow: '0 24px 80px rgba(0,0,0,0.6)' }}>
        <div style={{ fontSize: '11px', fontWeight: 700, color: ORANGE, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '10px' }}>🚀 Trial de Crescimento ativado</div>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 900, color: 'white', letterSpacing: '-0.02em', lineHeight: 1.2, marginBottom: '12px' }}>
          Seu trial de 3 dias de Crescimento do Negócio começou.
        </h1>
        <p style={{ fontSize: '13.5px', color: MUTED, lineHeight: 1.6, marginBottom: '22px' }}>
          O SalesBoost vai analisar seu negócio, identificar oportunidades de crescimento e te ajudar a agir — tudo automaticamente, nesses 3 dias.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '22px' }}>
          <Row label="Dia" value="1 de 3" />
          <Row label="Termina em" value={formatExpiresAt(info.expiresAt)} />
          <Row label="Hoje" value="R$ 0" valueColor="#4ade80" />
          <Row label="Depois do trial" value={`${PLAN_PRICE_BR}/mês (${PLAN_PRICE_US}/mo)`} />
        </div>

        <div style={{ padding: '11px 14px', background: 'rgba(255,255,255,0.03)', border: `1px solid ${BORDER}`, borderRadius: '10px', fontSize: '11.5px', color: MUTED, lineHeight: 1.6, marginBottom: '22px' }}>
          Você pode cancelar a qualquer momento antes do trial acabar, em Configurações — sem cobrança nenhuma. Nada é cobrado automaticamente ao fim do trial: você decide se quer continuar.
        </div>

        <button onClick={dismiss} disabled={dismissing}
          style={{ width: '100%', padding: '14px', background: ORANGE, color: '#000', fontWeight: 800, fontSize: '13.5px', border: 'none', borderRadius: '11px', cursor: dismissing ? 'wait' : 'pointer' }}>
          {dismissing ? 'Só um instante...' : 'Vamos começar →'}
        </button>
      </div>
    </div>
  )
}

function Row({ label, value, valueColor }: { label: string; value: string; valueColor?: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '9px 0', borderBottom: `1px solid ${BORDER}` }}>
      <span style={{ fontSize: '12.5px', color: MUTED }}>{label}</span>
      <span style={{ fontSize: '13.5px', fontWeight: 700, color: valueColor ?? 'white' }}>{value}</span>
    </div>
  )
}
