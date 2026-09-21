import { useEffect, useState } from 'react'
import { useAuth } from '../../../contexts/AuthContext'
import { CARD, MUTED, BORDER, SUPABASE_URL } from './shared'
import { DOMAINS, DOMAIN_ORDER, type DomainKey, type Maturity } from '../../../../shared/data-agent/domains'

// Painel do Data Agent — os 9 domínios que alimentam o Hermes (ver
// shared/data-agent/domains.ts pro esquema completo). Título/pergunta/
// maturidade vêm daquele arquivo estático (mesmo runtime, import direto,
// sem risco); resumo/métricas/sinais vêm da chamada ao vivo pra edge
// function `data-agent`. Isso nunca aparece em outra tela — é o que a IA
// usa pra decidir, não um painel pro dono mexer.
interface SignalRecord {
  key: string; event_type: string; observed_at: string
  old_value: unknown; new_value: unknown; evidence: string[]
  confidence: 'high' | 'medium' | 'low'; business_relevance: 'high' | 'medium' | 'low'
}
interface DomainState {
  domain: DomainKey; summary: string; metrics: Record<string, unknown>; signals: SignalRecord[]; sources: string[]
}

const ICON: Record<DomainKey, string> = {
  business: '🏢', customer: '🧑‍🤝‍🧑', market: '🌍', competition: '🥊', digital: '💻',
  content: '✍️', history: '🕰️', resources: '🧰', performance: '📈',
}
const MATURITY_LABEL: Record<Maturity, string> = { rich: 'Dado rico', partial: 'Dado parcial', empty: 'Sem dado ainda' }
const MATURITY_COLOR: Record<Maturity, string> = { rich: '#4ade80', partial: '#FBBF24', empty: MUTED }
const RELEVANCE_COLOR: Record<string, string> = { high: '#f87171', medium: '#FBBF24', low: MUTED }

export default function IntelligenceDomainsPanel({ companyId }: { companyId: string }) {
  const { session } = useAuth()
  const [states, setStates] = useState<DomainState[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [open, setOpen] = useState<DomainKey | null>(null)

  useEffect(() => {
    const token = session?.access_token
    if (!token) return
    let alive = true
    setLoading(true)
    fetch(`${SUPABASE_URL}/functions/v1/data-agent`, {
      method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ kind: 'state' }),
    })
      .then(r => r.json())
      .then(data => { if (!alive) return
        if (data.error) { setError(String(data.error)); setStates(null) }
        else { setStates(data.domains ?? []); setError('') }
      })
      .catch(e => { if (alive) setError(e instanceof Error ? e.message : 'Erro ao consultar o Data Agent') })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [companyId, session?.access_token])

  if (loading) return <div style={{ fontSize: '12px', color: MUTED }}>Carregando inteligência...</div>
  if (error) return <div style={{ fontSize: '12px', color: '#f87171' }}>{error}</div>

  return (
    <div>
      <div style={{ fontSize: '11.5px', color: MUTED, lineHeight: 1.55, marginBottom: '14px', maxWidth: '680px' }}>
        Isso é o que a IA (Hermes) usa pra decidir — não é um painel pro dono mexer, é o modelo interno do negócio. Nunca inventa número: quando não há dado real, o domínio aparece honestamente vazio.
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '10px' }}>
        {DOMAIN_ORDER.map(key => {
          const def = DOMAINS[key]
          const state = states?.find(s => s.domain === key)
          const isOpen = open === key
          return (
            <div key={key} style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: '12px', padding: '14px 16px', cursor: 'pointer' }}
              onClick={() => setOpen(isOpen ? null : key)}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', marginBottom: '4px' }}>
                <span style={{ fontSize: '13px', fontWeight: 800, color: 'white' }}>{ICON[key]} {def.title}</span>
                <span style={{ fontSize: '9px', fontWeight: 800, color: MATURITY_COLOR[def.maturity], border: `1px solid ${MATURITY_COLOR[def.maturity]}44`, borderRadius: '99px', padding: '2px 8px', flexShrink: 0 }}>
                  {MATURITY_LABEL[def.maturity]}
                </span>
              </div>
              <div style={{ fontSize: '10.5px', color: 'rgba(255,255,255,0.4)', fontStyle: 'italic', marginBottom: '8px' }}>{def.question}</div>
              <div style={{ fontSize: '12px', color: MUTED, lineHeight: 1.5 }}>{state?.summary ?? '—'}</div>

              {isOpen && (
                <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: `1px solid ${BORDER}` }} onClick={e => e.stopPropagation()}>
                  {state && Object.keys(state.metrics).length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '10px' }}>
                      {Object.entries(state.metrics).map(([k, v]) => (
                        <span key={k} style={{ fontSize: '10px', color: MUTED, background: 'rgba(255,255,255,0.03)', border: `1px solid ${BORDER}`, borderRadius: '7px', padding: '3px 8px' }}>
                          {k}: <strong style={{ color: v == null ? 'rgba(255,255,255,0.3)' : 'white' }}>{v == null ? 'desconhecido' : String(v)}</strong>
                        </span>
                      ))}
                    </div>
                  )}
                  {!state?.signals.length ? (
                    <div style={{ fontSize: '11.5px', color: MUTED }}>Nenhum sinal real ainda nesse domínio.</div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '7px' }}>
                      {state.signals.map((s, i) => (
                        <div key={i} style={{ background: 'rgba(255,255,255,0.03)', border: `1px solid ${BORDER}`, borderRadius: '9px', padding: '9px 11px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', marginBottom: '4px' }}>
                            <span style={{ fontSize: '11.5px', fontWeight: 700, color: 'white' }}>{s.key}</span>
                            <span style={{ fontSize: '9px', fontWeight: 800, color: RELEVANCE_COLOR[s.business_relevance] }}>{s.business_relevance.toUpperCase()}</span>
                          </div>
                          {s.evidence.map((ev, j) => <div key={j} style={{ fontSize: '11px', color: MUTED, lineHeight: 1.5 }}>• {ev}</div>)}
                          <div style={{ fontSize: '9.5px', color: 'rgba(255,255,255,0.3)', marginTop: '4px' }}>confiança: {s.confidence}</div>
                        </div>
                      ))}
                    </div>
                  )}
                  {def.gaps.length > 0 && (
                    <div style={{ fontSize: '10.5px', color: 'rgba(255,255,255,0.35)', marginTop: '10px', lineHeight: 1.5 }}>
                      Falta hoje: {def.gaps.join(' · ')}
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
