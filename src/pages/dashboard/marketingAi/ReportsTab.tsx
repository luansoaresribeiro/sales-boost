import { useState } from 'react'
import { useLang } from '../../../contexts/LanguageContext'
import { CARD, MUTED, BORDER, ORANGE, PILLAR_LABEL, PILLAR_ICON, IMPACT_COLOR, IMPACT_LABEL, REPORT_TYPE_LABEL, callMarketingAi, timeAgo, type Insight, type StrategyLogRow, type MarketingReport } from './shared'

const REPORT_TYPES = ['weekly', 'monthly', 'campaign', 'executive', 'growth', 'audience'] as const

const TX = {
  pt: {
    err: 'Erro ao gerar relatório', title: 'Relatórios gerados', generating: 'Gerando...', empty: 'Nenhum relatório gerado ainda. Clique num dos tipos acima.',
    byPillar: 'Resumo por pilar', byPillarSub: 'Quantos insights cada inteligência já gerou, do mais recente pro mais antigo.', open: 'em aberto',
    all: 'Todos os insights', noInsights: 'Nenhum insight gerado ainda.', approved: 'Recomendações aprovadas/implementadas',
    noApproved: 'Nenhuma recomendação aprovada ainda — veja a aba Marketing Brain.',
    types: null as Record<string, string> | null, pillars: null as Record<string, string> | null, impact: null as Record<string, string> | null,
  },
  en: {
    err: 'Error generating report', title: 'Generated reports', generating: 'Generating...', empty: 'No report generated yet. Click one of the types above.',
    byPillar: 'Summary by pillar', byPillarSub: 'How many insights each intelligence has generated, newest to oldest.', open: 'open',
    all: 'All insights', noInsights: 'No insight generated yet.', approved: 'Approved/implemented recommendations',
    noApproved: 'No recommendation approved yet — see the Marketing Brain tab.',
    types: { weekly: 'Weekly', monthly: 'Monthly', campaign: 'Campaign', executive: 'Executive', growth: 'Growth', audience: 'Audience' } as Record<string, string> | null,
    pillars: { tracking: 'Tracking', content: 'Content', competitor: 'Competitors', strategy: 'Strategy' } as Record<string, string> | null,
    impact: { high: 'High impact', medium: 'Medium impact', low: 'Low impact' } as Record<string, string> | null,
  },
}

export default function ReportsTab({
  accessToken, insights, strategyLog, reports, onRefresh,
}: {
  accessToken: string; insights: Insight[]; strategyLog: StrategyLogRow[]; reports: MarketingReport[]; onRefresh: () => Promise<void>
}) {
  const { lang } = useLang()
  const tx = TX[lang]
  const typeLabel = (k: string) => tx.types?.[k] ?? REPORT_TYPE_LABEL[k]
  const pillars = ['tracking', 'content', 'competitor', 'strategy'] as const
  const implemented = strategyLog.filter(s => s.status === 'implemented' || s.status === 'approved')
  const [generating, setGenerating] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [error, setError] = useState('')

  const generate = async (type: string) => {
    setGenerating(type)
    setError('')
    try {
      await callMarketingAi(accessToken, 'generate_report', { report_type: type })
      await onRefresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : tx.err)
    }
    setGenerating(null)
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap', gap: '10px' }}>
        <div style={{ fontSize: '13px', fontWeight: 700, color: 'white' }}>{tx.title}</div>
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
          {REPORT_TYPES.map(t => (
            <button key={t} onClick={() => generate(t)} disabled={generating !== null}
              style={{ padding: '6px 12px', background: 'transparent', border: `1px solid ${BORDER}`, borderRadius: '7px', color: generating === t ? ORANGE : MUTED, fontSize: '11px', cursor: 'pointer' }}>
              {generating === t ? tx.generating : `+ ${typeLabel(t)}`}
            </button>
          ))}
        </div>
      </div>
      {error && <div style={{ color: '#f87171', fontSize: '12px', marginBottom: '14px' }}>{error}</div>}

      {reports.length === 0 ? (
        <div style={{ padding: '24px', textAlign: 'center', color: MUTED, fontSize: '12.5px', background: CARD, border: `1px solid ${BORDER}`, borderRadius: '12px', marginBottom: '24px' }}>
          {tx.empty}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '24px' }}>
          {reports.map(r => (
            <div key={r.id} style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: '10px', overflow: 'hidden' }}>
              <div onClick={() => setExpanded(expanded === r.id ? null : r.id)} style={{ padding: '12px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', gap: '10px' }}>
                <div>
                  <div style={{ fontSize: '12.5px', fontWeight: 600, color: 'white' }}>{r.title}</div>
                  <div style={{ fontSize: '10.5px', color: MUTED, marginTop: '2px' }}>{typeLabel(r.report_type)} · {timeAgo(r.created_at, lang)}</div>
                </div>
                <span style={{ color: MUTED, fontSize: '12px', flexShrink: 0 }}>{expanded === r.id ? '▲' : '▼'}</span>
              </div>
              {expanded === r.id && (
                <div style={{ padding: '0 14px 14px', fontSize: '12px', color: 'rgba(255,255,255,0.75)', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{r.summary}</div>
              )}
            </div>
          ))}
        </div>
      )}

      <div style={{ fontSize: '13px', fontWeight: 700, color: 'white', marginBottom: '4px' }}>{tx.byPillar}</div>
      <div style={{ fontSize: '11.5px', color: MUTED, marginBottom: '16px' }}>{tx.byPillarSub}</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '24px' }}>
        {pillars.map(p => {
          const items = insights.filter(i => i.pillar === p)
          return (
            <div key={p} style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: '12px', padding: '16px' }}>
              <div style={{ fontSize: '18px', marginBottom: '6px' }}>{PILLAR_ICON[p]}</div>
              <div style={{ fontSize: '10.5px', color: MUTED, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>{tx.pillars?.[p] ?? PILLAR_LABEL[p]}</div>
              <div style={{ fontSize: '22px', fontWeight: 800, color: 'white' }}>{items.length}</div>
              <div style={{ fontSize: '10.5px', color: 'rgba(255,255,255,0.35)' }}>{items.filter(i => i.status === 'open').length} {tx.open}</div>
            </div>
          )
        })}
      </div>

      <div style={{ fontSize: '13px', fontWeight: 700, color: 'white', marginBottom: '10px' }}>{tx.all}</div>
      {insights.length === 0 ? (
        <div style={{ color: MUTED, fontSize: '12.5px', marginBottom: '24px' }}>{tx.noInsights}</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '24px' }}>
          {insights.map(ins => (
            <div key={ins.id} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', padding: '10px 14px', background: CARD, border: `1px solid ${BORDER}`, borderRadius: '10px' }}>
              <span style={{ fontSize: '14px', flexShrink: 0 }}>{PILLAR_ICON[ins.pillar]}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '12.5px', fontWeight: 600, color: 'white' }}>{ins.title}</div>
                <div style={{ fontSize: '11px', color: MUTED, marginTop: '2px', lineHeight: 1.5 }}>{ins.description}</div>
              </div>
              {ins.impact && <span style={{ flexShrink: 0, fontSize: '9.5px', fontWeight: 700, color: IMPACT_COLOR[ins.impact], whiteSpace: 'nowrap' }}>{tx.impact?.[ins.impact] ?? IMPACT_LABEL[ins.impact]}</span>}
              <span style={{ flexShrink: 0, fontSize: '10px', color: 'rgba(255,255,255,0.3)', whiteSpace: 'nowrap' }}>{timeAgo(ins.created_at, lang)}</span>
            </div>
          ))}
        </div>
      )}

      <div style={{ fontSize: '13px', fontWeight: 700, color: 'white', marginBottom: '10px' }}>{tx.approved}</div>
      {implemented.length === 0 ? (
        <div style={{ color: MUTED, fontSize: '12.5px' }}>{tx.noApproved}</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {implemented.map(s => (
            <div key={s.id} style={{ padding: '10px 14px', background: CARD, border: `1px solid ${BORDER}`, borderRadius: '10px' }}>
              <div style={{ fontSize: '12.5px', fontWeight: 600, color: 'white' }}>{s.recommendation}</div>
              <div style={{ fontSize: '11px', color: MUTED, marginTop: '2px', lineHeight: 1.5 }}>{s.reasoning}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
