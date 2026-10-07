import { useState } from 'react'
import { CARD, MUTED, BORDER, ORANGE, IMPACT_COLOR, timeAgo, BRAIN_NODE_LABEL, BRAIN_NODE_ICON, type BrainNode, type StrategyLogRow } from './shared'
import StrategyTab from './StrategyTab'
import { useLang } from '../../../contexts/LanguageContext'

const PILLAR_KEYS = ['all', 'tracking', 'content', 'competitor', 'strategy', 'experiment'] as const

const TX = {
  pt: {
    pillars: { all: 'Tudo', tracking: '📈 Tracking', content: '✍️ Conteúdo', competitor: '🔍 Concorrentes', strategy: '🧭 Estratégia', experiment: '🧪 Experimentos' } as Record<string, string>,
    intro: 'A memória permanente deste negócio — cada padrão, aprendizado e recomendação que qualquer uma das inteligências já descobriu, tudo num lugar só. Nada aqui é descartado. As decisões abaixo são sempre do Hermes, nunca do Marketing AI sozinho.',
    empty: 'O Marketing Brain ainda está vazio — conforme as inteligências rodarem, o conhecimento vai se acumulando aqui.',
    emptyFilter: 'Nada nesse filtro ainda.',
    high: 'alta confiança', medium: 'confiança média', low: 'baixa confiança',
    nodes: null as Record<string, string> | null,
  },
  en: {
    pillars: { all: 'All', tracking: '📈 Tracking', content: '✍️ Content', competitor: '🔍 Competitors', strategy: '🧭 Strategy', experiment: '🧪 Experiments' } as Record<string, string>,
    intro: 'This business\'s permanent memory — every pattern, learning and recommendation any of the intelligences has discovered, all in one place. Nothing here is discarded. The decisions below always belong to Hermes, never to Marketing AI alone.',
    empty: 'The Marketing Brain is still empty — as the intelligences run, knowledge will build up here.',
    emptyFilter: 'Nothing in this filter yet.',
    high: 'high confidence', medium: 'medium confidence', low: 'low confidence',
    nodes: {
      pattern: 'Pattern', learned_behavior: 'Learned behavior', recommendation: 'Recommendation',
      successful_strategy: 'Successful strategy', failed_strategy: 'Failed strategy',
      experiment_result: 'Experiment result', competitor_observation: 'Competitor observation', brand_fact: 'Brand fact',
    } as Record<string, string> | null,
  },
}

export default function BrainTab({
  nodes, accessToken, strategyLog, onRefresh,
}: {
  nodes: BrainNode[]; accessToken: string; strategyLog: StrategyLogRow[]; onRefresh: () => Promise<void>
}) {
  const { lang } = useLang()
  const t = TX[lang]
  const [filter, setFilter] = useState<string>('all')
  const filtered = filter === 'all' ? nodes : nodes.filter(n => n.source_pillar === filter)

  return (
    <div>
      <div style={{ fontSize: '12.5px', color: MUTED, marginBottom: '16px', lineHeight: 1.6 }}>
        {t.intro}
      </div>

      <div style={{ marginBottom: '24px', paddingBottom: '20px', borderBottom: `1px solid ${BORDER}` }}>
        <StrategyTab accessToken={accessToken} log={strategyLog} onRefresh={onRefresh} />
      </div>

      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '18px' }}>
        {PILLAR_KEYS.map(k => ({ key: k, label: t.pillars[k] })).map(f => (
          <button key={f.key} onClick={() => setFilter(f.key)}
            style={{ padding: '6px 12px', borderRadius: '8px', border: `1px solid ${filter === f.key ? 'rgba(255,109,41,0.4)' : BORDER}`, background: filter === f.key ? 'rgba(255,109,41,0.1)' : 'transparent', color: filter === f.key ? ORANGE : MUTED, fontSize: '11.5px', cursor: 'pointer' }}>
            {f.label}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div style={{ padding: '32px', textAlign: 'center', color: MUTED, fontSize: '13px', background: CARD, border: `1px solid ${BORDER}`, borderRadius: '12px' }}>
          {nodes.length === 0 ? t.empty : t.emptyFilter}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {filtered.map(n => (
            <div key={n.id} style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', padding: '12px 14px', background: CARD, border: `1px solid ${BORDER}`, borderRadius: '10px' }}>
              <span style={{ fontSize: '16px', flexShrink: 0 }}>{BRAIN_NODE_ICON[n.node_type]}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '3px' }}>
                  <span style={{ fontSize: '9.5px', fontWeight: 700, color: 'rgba(255,109,41,0.7)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{t.nodes?.[n.node_type] ?? BRAIN_NODE_LABEL[n.node_type]}</span>
                  {n.confidence && <span style={{ fontSize: '9px', fontWeight: 700, color: IMPACT_COLOR[n.confidence] }}>{n.confidence === 'high' ? t.high : n.confidence === 'medium' ? t.medium : t.low}</span>}
                </div>
                <div style={{ fontSize: '12.5px', fontWeight: 600, color: 'white', marginBottom: '2px' }}>{n.title}</div>
                <div style={{ fontSize: '11.5px', color: MUTED, lineHeight: 1.5 }}>{n.body}</div>
              </div>
              <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.3)', flexShrink: 0, whiteSpace: 'nowrap' }}>{timeAgo(n.created_at, lang)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
