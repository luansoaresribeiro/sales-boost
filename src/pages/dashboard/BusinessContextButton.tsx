import { useState } from 'react'
import { CARD, MUTED, BORDER, D, ORANGE } from './marketingAi/shared'
import BusinessContextTab from './marketingAi/BusinessContextTab'

// Botão flutuante global (todo o dashboard) pro dono registrar mudança/
// novidade do negócio a qualquer momento — sem precisar navegar até
// Configurações. Antes ficava dentro de Informações da empresa; virou essa
// entrada rápida porque é o Agente de Dados que consome esse contexto (ver
// BusinessContextTab.tsx, tabela business_context), e o dono precisa poder
// alimentar isso de qualquer tela, não só de dentro de Configurações.
export default function BusinessContextButton({ companyId }: { companyId: string }) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button onClick={() => setOpen(true)} title="Contexto do Negócio — avisar o Agente de Dados de alguma mudança"
        style={{
          position: 'fixed', right: '24px', bottom: '24px', zIndex: 60, width: '52px', height: '52px', borderRadius: '50%',
          background: ORANGE, border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 8px 24px rgba(255,109,41,0.4)',
        }}>
        <svg viewBox="0 0 24 24" style={{ width: 24, height: 24, fill: 'none', stroke: 'white', strokeWidth: 2.4, strokeLinecap: 'round', strokeLinejoin: 'round' }}>
          <path d="M12 5v14M5 12h14" />
        </svg>
      </button>

      {open && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 70, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}
          onClick={() => setOpen(false)}>
          <div style={{ background: '#0E0B0A', border: `1px solid ${BORDER}`, borderRadius: '18px', width: '100%', maxWidth: '720px', maxHeight: '85vh', overflowY: 'auto', padding: '26px 28px' }}
            onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '14px', marginBottom: '18px' }}>
              <div>
                <div style={{ fontFamily: D, fontSize: '17px', fontWeight: 800, color: 'white' }}>🧠 Contexto do Negócio</div>
                <div style={{ fontSize: '12px', color: MUTED, marginTop: '3px' }}>Avise o Agente de Dados de qualquer mudança ou novidade — ele passa a considerar isso nas próximas decisões.</div>
              </div>
              <button onClick={() => setOpen(false)} style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: '8px', color: MUTED, cursor: 'pointer', fontSize: '15px', padding: '6px 10px', flexShrink: 0, fontFamily: D }}>✕</button>
            </div>
            <BusinessContextTab company={{ id: companyId }} />
          </div>
        </div>
      )}
    </>
  )
}
