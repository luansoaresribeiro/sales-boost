import { useLang } from '../../../contexts/LanguageContext'
import { CARD, MUTED, BORDER, ORANGE, callMarketingAi, timeAgo, type Experiment } from './shared'

const STATUS_COLOR: Record<string, string> = { proposed: '#FBBF24', running: '#60a5fa', completed: '#4ade80', cancelled: 'rgba(255,255,255,0.3)' }
const TX = {
  pt: {
    status: { proposed: 'Proposto pelo Hermes', running: 'Rodando', completed: 'Concluído', cancelled: 'Cancelado' } as Record<string, string>,
    intro: 'Testes controlados que o Hermes propõe quando há uma hipótese real pra validar — nunca criados sozinhos pelo Marketing AI. Você decide quando começar a rodar e registra o resultado real quando terminar.',
    empty: 'Nenhum experimento proposto ainda. O Hermes propõe um quando a Estratégia identificar uma hipótese que vale testar.',
    variable: 'Variável:', variant: 'Variante', start: '▶ Começar', aWon: 'A venceu', bWon: 'B venceu', inconclusive: 'Inconclusivo',
  },
  en: {
    status: { proposed: 'Proposed by Hermes', running: 'Running', completed: 'Completed', cancelled: 'Cancelled' } as Record<string, string>,
    intro: 'Controlled tests Hermes proposes when there is a real hypothesis to validate — never created by Marketing AI alone. You decide when to start running and record the real result when it ends.',
    empty: 'No experiment proposed yet. Hermes proposes one when Strategy identifies a hypothesis worth testing.',
    variable: 'Variable:', variant: 'Variant', start: '▶ Start', aWon: 'A won', bWon: 'B won', inconclusive: 'Inconclusive',
  },
}

export default function ExperimentsTab({ accessToken, experiments, onRefresh }: { accessToken: string; experiments: Experiment[]; onRefresh: () => Promise<void> }) {
  const { lang } = useLang()
  const t = TX[lang]
  const start = async (id: string) => {
    await callMarketingAi(accessToken, 'run_experiment', { experiment_id: id })
    await onRefresh()
  }
  const conclude = async (id: string, winner: 'a' | 'b' | 'inconclusive') => {
    await callMarketingAi(accessToken, 'conclude_experiment', { experiment_id: id, winner, results: {} })
    await onRefresh()
  }

  return (
    <div>
      <div style={{ fontSize: '12.5px', color: MUTED, marginBottom: '18px', lineHeight: 1.6 }}>
        {t.intro}
      </div>

      {experiments.length === 0 ? (
        <div style={{ padding: '32px', textAlign: 'center', color: MUTED, fontSize: '13px', background: CARD, border: `1px solid ${BORDER}`, borderRadius: '12px' }}>
          {t.empty}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {experiments.map(e => (
            <div key={e.id} style={{ padding: '16px', background: CARD, border: `1px solid ${BORDER}`, borderRadius: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px', marginBottom: '8px' }}>
                <div style={{ fontSize: '13px', fontWeight: 700, color: 'white', lineHeight: 1.4 }}>{e.hypothesis}</div>
                <span style={{ flexShrink: 0, fontSize: '9.5px', fontWeight: 700, color: STATUS_COLOR[e.status], padding: '2px 8px', borderRadius: '99px', border: `1px solid ${STATUS_COLOR[e.status]}44`, whiteSpace: 'nowrap' }}>{t.status[e.status]}</span>
              </div>
              <div style={{ fontSize: '11.5px', color: MUTED, marginBottom: '10px' }}>{t.variable} <strong style={{ color: 'white' }}>{e.variable}</strong></div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '10px' }}>
                <div style={{ padding: '8px 10px', background: 'rgba(255,255,255,0.02)', borderRadius: '8px', border: e.winner === 'a' ? '1px solid rgba(74,222,128,0.4)' : 'none' }}>
                  <div style={{ fontSize: '9.5px', color: MUTED, textTransform: 'uppercase', marginBottom: '3px' }}>{t.variant} A{e.winner === 'a' ? ' 🏆' : ''}</div>
                  <div style={{ fontSize: '12px', color: 'white' }}>{e.variant_a}</div>
                </div>
                <div style={{ padding: '8px 10px', background: 'rgba(255,255,255,0.02)', borderRadius: '8px', border: e.winner === 'b' ? '1px solid rgba(74,222,128,0.4)' : 'none' }}>
                  <div style={{ fontSize: '9.5px', color: MUTED, textTransform: 'uppercase', marginBottom: '3px' }}>{t.variant} B{e.winner === 'b' ? ' 🏆' : ''}</div>
                  <div style={{ fontSize: '12px', color: 'white' }}>{e.variant_b}</div>
                </div>
              </div>
              {e.reasoning && <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', fontStyle: 'italic', marginBottom: '10px', lineHeight: 1.5 }}>💡 {e.reasoning}</div>}
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.3)' }}>{timeAgo(e.created_at, lang)}</span>
                <div style={{ display: 'flex', gap: '8px', marginLeft: 'auto' }}>
                  {e.status === 'proposed' && (
                    <button onClick={() => start(e.id)} style={{ padding: '6px 14px', background: ORANGE, color: '#000', fontWeight: 700, fontSize: '11.5px', borderRadius: '7px', border: 'none', cursor: 'pointer' }}>{t.start}</button>
                  )}
                  {e.status === 'running' && (
                    <>
                      <button onClick={() => conclude(e.id, 'a')} style={{ padding: '6px 12px', background: 'rgba(74,222,128,0.1)', border: '1px solid rgba(74,222,128,0.3)', borderRadius: '7px', color: '#4ade80', fontSize: '11px', cursor: 'pointer' }}>{t.aWon}</button>
                      <button onClick={() => conclude(e.id, 'b')} style={{ padding: '6px 12px', background: 'rgba(74,222,128,0.1)', border: '1px solid rgba(74,222,128,0.3)', borderRadius: '7px', color: '#4ade80', fontSize: '11px', cursor: 'pointer' }}>{t.bWon}</button>
                      <button onClick={() => conclude(e.id, 'inconclusive')} style={{ padding: '6px 12px', background: 'transparent', border: `1px solid ${BORDER}`, borderRadius: '7px', color: MUTED, fontSize: '11px', cursor: 'pointer' }}>{t.inconclusive}</button>
                    </>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
