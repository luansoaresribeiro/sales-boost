import { useState } from 'react'
import { useLang } from '../../../contexts/LanguageContext'
import { supabase } from '../../../lib/supabase'
import { ORANGE, CARD, MUTED, BORDER, callMarketingAi, timeAgo, type StrategyLogRow } from './shared'

const STATUS_COLOR: Record<string, string> = { proposed: '#FBBF24', approved: '#4ade80', dismissed: 'rgba(255,255,255,0.3)', implemented: '#60a5fa' }
const STATUS_LABEL_BY_LANG: Record<'pt' | 'en', Record<string, string>> = {
  pt: { proposed: 'Proposto', approved: 'Aprovado', dismissed: 'Descartado', implemented: 'Implementado' },
  en: { proposed: 'Proposed', approved: 'Approved', dismissed: 'Dismissed', implemented: 'Implemented' },
}
const TX = {
  pt: { err: 'Erro ao gerar recomendação', intro: 'O Hermes lê Tracking + Concorrentes + Marketing Brain e decide o próximo passo, sempre com o porquê.', asking: 'Perguntando ao Hermes...', ask: '🧭 Pedir decisão ao Hermes', none: 'Nenhuma recomendação ainda. Clique em "Pedir recomendação".', approve: '✓ Aprovar', dismiss: 'Descartar' },
  en: { err: 'Error generating recommendation', intro: 'Hermes reads Tracking + Competitors + Marketing Brain and decides the next step, always with the reason why.', asking: 'Asking Hermes...', ask: '🧭 Ask Hermes for a decision', none: 'No recommendations yet. Click "Ask Hermes for a decision".', approve: '✓ Approve', dismiss: 'Dismiss' },
} as const

export default function StrategyTab({ accessToken, log, onRefresh }: { accessToken: string; log: StrategyLogRow[]; onRefresh: () => Promise<void> }) {
  const { lang } = useLang()
  const t = TX[lang]
  const STATUS_LABEL = STATUS_LABEL_BY_LANG[lang]
  const [running, setRunning] = useState(false)
  const [error, setError] = useState('')

  const runStrategy = async () => {
    setRunning(true)
    setError('')
    try {
      await callMarketingAi(accessToken, 'run_strategy')
      await onRefresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : t.err)
    }
    setRunning(false)
  }

  const setStatus = async (id: string, status: string) => {
    await supabase.from('marketing_ai_strategy_log').update({ status }).eq('id', id)
    await onRefresh()
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
        <div style={{ fontSize: '12.5px', color: MUTED }}>{t.intro}</div>
        <button onClick={runStrategy} disabled={running}
          style={{ padding: '8px 16px', background: ORANGE, color: '#000', fontWeight: 700, fontSize: '12px', borderRadius: '8px', border: 'none', cursor: 'pointer' }}>
          {running ? t.asking : t.ask}
        </button>
      </div>
      {error && <div style={{ color: '#f87171', fontSize: '12px', marginBottom: '14px' }}>{error}</div>}

      {log.length === 0 ? (
        <div style={{ padding: '32px', textAlign: 'center', color: MUTED, fontSize: '13px', background: CARD, border: `1px solid ${BORDER}`, borderRadius: '12px' }}>
          {t.none}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {log.map(r => (
            <div key={r.id} style={{ padding: '16px', background: CARD, border: `1px solid ${BORDER}`, borderRadius: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px', marginBottom: '8px' }}>
                <div style={{ fontSize: '13px', fontWeight: 700, color: 'white', lineHeight: 1.4 }}>{r.recommendation}</div>
                <span style={{ flexShrink: 0, fontSize: '9.5px', fontWeight: 700, color: STATUS_COLOR[r.status], padding: '2px 8px', borderRadius: '99px', border: `1px solid ${STATUS_COLOR[r.status]}44`, textTransform: 'uppercase' }}>{STATUS_LABEL[r.status]}</span>
              </div>
              <div style={{ fontSize: '11.5px', color: MUTED, lineHeight: 1.5, marginBottom: '10px' }}>{r.reasoning}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.3)' }}>{timeAgo(r.created_at, lang)}</span>
                {r.status === 'proposed' && (
                  <div style={{ display: 'flex', gap: '8px', marginLeft: 'auto' }}>
                    <button onClick={() => setStatus(r.id, 'approved')} style={{ padding: '5px 12px', background: 'rgba(74,222,128,0.1)', border: '1px solid rgba(74,222,128,0.3)', borderRadius: '7px', color: '#4ade80', fontSize: '11px', fontWeight: 600, cursor: 'pointer' }}>{t.approve}</button>
                    <button onClick={() => setStatus(r.id, 'dismissed')} style={{ padding: '5px 12px', background: 'transparent', border: `1px solid ${BORDER}`, borderRadius: '7px', color: MUTED, fontSize: '11px', cursor: 'pointer' }}>{t.dismiss}</button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
