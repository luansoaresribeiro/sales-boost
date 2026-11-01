import { useLang } from '../../../contexts/LanguageContext'
import { CARD, MUTED, BORDER, D, ORANGE } from './shared'

// Faixa de fluxo reutilizável (pedido do dono 2026-11-01): os PASSOS REAIS de um agente, em ordem, ligados por setas.
// Cada passo mostra só dado real (regra 5) — o que não existe vira "sem dado ainda", nunca um número inventado.
// Os dados vêm de um hook por agente (useFlowStripData.ts); este componente só desenha.
export type StepStatus = 'ok' | 'waiting' | 'error' | 'building'

export interface FlowStep {
  key: string
  name: string
  desc: string
  status: StepStatus
  /** Texto do erro real, já encurtado (só com status 'error'). */
  error?: string | null
  /** "dd/mm hh:mm" já formatado; null = sem dado ainda. */
  last?: string | null
  /** Texto da próxima execução, quando calculável pelas regras reais do código. */
  next?: string | null
  /** 1–2 contagens reais, ex.: "8 buscas hoje". */
  counts?: string[]
  /** O que espera o dono (laranja). */
  waiting?: string | null
  /** Passo sem horário próprio (só contagens): esconde "última vez". */
  noTiming?: boolean
  /** Linha extra de contexto (ex.: gasto do mês). */
  note?: string | null
  onClick?: () => void
}

const TX = {
  pt: { ok: 'ok', waiting: 'aguardando', error: 'erro', building: 'em construção', last: 'última vez', next: 'próxima', none: 'sem dado ainda', loading: 'Carregando o fluxo…' },
  en: { ok: 'ok', waiting: 'waiting', error: 'error', building: 'under construction', last: 'last time', next: 'next', none: 'no data yet', loading: 'Loading the flow…' },
} as const
const PILL: Record<StepStatus, { icon: string; color: string; bg: string }> = {
  ok: { icon: '✅', color: '#4ade80', bg: 'rgba(74,222,128,0.10)' },
  waiting: { icon: '⏳', color: '#FBBF24', bg: 'rgba(251,191,36,0.10)' },
  error: { icon: '⚠️', color: '#F87171', bg: 'rgba(248,113,113,0.10)' },
  building: { icon: '🚧', color: MUTED, bg: 'rgba(255,255,255,0.05)' },
}

const CSS = `
.sb-flow{display:flex;align-items:stretch;gap:6px;flex-wrap:wrap}
.sb-flow-card{flex:1 1 200px;min-width:0;box-sizing:border-box}
.sb-flow-arrow{display:flex;align-items:center;color:${ORANGE};font-size:18px;font-weight:800;flex:0 0 auto}
@media (max-width:720px){.sb-flow{flex-direction:column;align-items:stretch}.sb-flow-card{flex:1 1 auto;width:100%}.sb-flow-arrow{justify-content:center;transform:rotate(90deg);height:18px}}
`

export default function FlowStrip({ steps, activeKey, loading }: { steps: FlowStep[]; activeKey?: string | null; loading?: boolean }) {
  const { lang } = useLang()
  const t = TX[lang]
  return (
    <div style={{ marginBottom: '20px' }} aria-label={lang === 'en' ? 'Agent flow' : 'Fluxo do agente'}>
      <style>{CSS}</style>
      {loading && <div style={{ color: MUTED, fontSize: '12px', marginBottom: '6px' }}>{t.loading}</div>}
      <div className="sb-flow">
        {steps.map((s, i) => {
          const p = PILL[s.status]
          const active = activeKey === s.key
          const body = (
            <>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', marginBottom: '4px' }}>
                <span style={{ fontFamily: D, fontSize: '13px', fontWeight: 800, color: 'white', overflowWrap: 'anywhere' }}>{i + 1}. {s.name}</span>
                <span style={{ flexShrink: 0, fontSize: '10.5px', fontWeight: 700, color: p.color, background: p.bg, borderRadius: '999px', padding: '2px 8px', whiteSpace: 'nowrap' }}>{p.icon} {t[s.status]}</span>
              </div>
              <div style={{ color: MUTED, fontSize: '11.5px', lineHeight: 1.45, marginBottom: '8px' }}>{s.desc}</div>
              {s.status === 'error' && s.error && <div style={{ color: '#F87171', fontSize: '11.5px', lineHeight: 1.4, marginBottom: '6px', overflowWrap: 'anywhere' }}>{s.error}</div>}
              {s.status !== 'building' && (!s.noTiming || s.next) && (
                <div style={{ fontSize: '11.5px', color: 'rgba(255,255,255,0.86)', lineHeight: 1.55 }}>
                  {!s.noTiming && <div>{t.last}: {s.last ?? <span style={{ color: MUTED }}>{t.none}</span>}</div>}
                  {s.next && <div>{t.next}: {s.next}</div>}
                </div>
              )}
              {s.counts && s.counts.length > 0 && <div style={{ fontSize: '11.5px', color: 'white', fontWeight: 600, marginTop: '4px', overflowWrap: 'anywhere' }}>{s.counts.join(' · ')}</div>}
              {s.note && <div style={{ fontSize: '11.5px', color: MUTED, marginTop: '4px', overflowWrap: 'anywhere' }}>{s.note}</div>}
              {s.waiting && <div style={{ fontSize: '11.5px', color: ORANGE, fontWeight: 700, marginTop: '6px' }}>{s.waiting}</div>}
            </>
          )
          const box: React.CSSProperties = {
            textAlign: 'left', fontFamily: 'inherit', background: CARD, borderRadius: '12px', padding: '12px',
            border: `1px solid ${active ? 'rgba(255,109,41,0.55)' : BORDER}`, color: 'inherit',
          }
          return (
            <div key={s.key} style={{ display: 'contents' }}>
              {i > 0 && <div className="sb-flow-arrow" aria-hidden="true">→</div>}
              {s.onClick
                ? <button type="button" className="sb-flow-card" onClick={s.onClick} aria-pressed={active} style={{ ...box, cursor: 'pointer' }}>{body}</button>
                : <div className="sb-flow-card" style={box}>{body}</div>}
            </div>
          )
        })}
      </div>
    </div>
  )
}
