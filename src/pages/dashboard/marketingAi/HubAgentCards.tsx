import { useState } from 'react'
import type { Lang } from '../../../contexts/LanguageContext'
import { MUTED, D } from './shared'
import type { DecisionKpis } from './useDecisionKpis'
import type { FlowSummary } from './useFlowSummary'
import type { DemoAgentStatus } from './growthDemo'

const ORANGE = '#FF6D29'
export interface CardModule { title: string; desc: string; icon: string }
export type AgentKey = 'data' | 'opportunities' | 'strategy' | 'content' | 'conversion'
export interface CardModel { status: string; tone: 'ok' | 'alert' | 'muted'; info?: string | null; next?: string | null }

// Cards dos 5 agentes (Pacote A): só estado + UMA informação útil + próxima ação. A descrição longa saiu da tela e foi pro
// tooltip (title) — nenhum texto some. Todo valor vem de dado real; sem dado = "Verificando…" / "Não foi possível verificar" (regra 5).
const TX = {
  pt: { open: 'Abrir', loading: 'Verificando…', error: 'Não foi possível verificar', active: 'Ativo', idle: 'Em espera', soon: 'Em breve', nextLbl: 'Próxima ação',
    oppWait: (n: number) => `${n} aguardando avaliação`, oppNone: 'Nenhuma aguardando avaliação', oppNext: 'Avaliar as oportunidades',
    appr: (n: number) => `${n} peça${n === 1 ? '' : 's'} para aprovar`, apprNone: 'Nenhuma peça para aprovar', apprNext: 'Aprovar as peças',
    noStrat: 'Sem estratégia ativa', stratNext: 'Criar a estratégia', stratActive: 'Estratégia ativa',
    approved: (n: number) => `${n} aprovada${n === 1 ? '' : 's'}`, pages: (n: number) => `${n} página${n === 1 ? '' : 's'} de imóvel no ar`,
    leads: (n: number) => `${n} lead${n === 1 ? '' : 's'} em 30 dias`, tracked: (n: number) => `${n} com origem rastreada` },
  en: { open: 'Open', loading: 'Checking…', error: 'Could not verify', active: 'Active', idle: 'Standby', soon: 'Soon', nextLbl: 'Next action',
    oppWait: (n: number) => `${n} waiting for review`, oppNone: 'None waiting for review', oppNext: 'Review the opportunities',
    appr: (n: number) => `${n} piece${n === 1 ? '' : 's'} to approve`, apprNone: 'No pieces to approve', apprNext: 'Approve the pieces',
    noStrat: 'No active strategy', stratNext: 'Create the strategy', stratActive: 'Active strategy',
    approved: (n: number) => `${n} approved`, pages: (n: number) => `${n} listing page${n === 1 ? '' : 's'} live`,
    leads: (n: number) => `${n} lead${n === 1 ? '' : 's'} in 30 days`, tracked: (n: number) => `${n} with tracked source` },
} as const

export interface CardInputs {
  lang: Lang; agents: DemoAgentStatus[] | null; loading: boolean; kpis: DecisionKpis; kpisLoading: boolean; flow: FlowSummary
  strategy: { status: string; label: string; objective: string } | null; strategyLoading: boolean; strategyError: boolean
}

export function cardModels(i: CardInputs): Record<AgentKey, CardModel> {
  const t = TX[i.lang]
  const unk = (loading: boolean): CardModel => ({ status: loading ? t.loading : t.error, tone: 'muted' })
  const { kpis, flow } = i
  const market = i.agents?.find(a => a.key === 'market')
  const o = kpis.oppsSuggested, a = kpis.actionsReady
  return {
    data: market ? { status: t[market.state], tone: market.state === 'active' ? 'ok' : 'muted', info: market.lastAction } : unk(i.loading),
    opportunities: i.kpisLoading || o == null ? unk(i.kpisLoading)
      : { status: o > 0 ? t.oppWait(o) : t.oppNone, tone: o > 0 ? 'alert' : 'ok', info: flow.oppsApproved != null ? t.approved(flow.oppsApproved) : null, next: o > 0 ? t.oppNext : null },
    strategy: i.strategyLoading || i.strategyError ? unk(i.strategyLoading)
      : i.strategy ? { status: i.strategy.label, tone: i.strategy.status === 'active' ? 'ok' : 'alert', info: i.strategy.objective }
      : { status: t.noStrat, tone: 'alert', next: t.stratNext },
    content: i.kpisLoading || a == null ? unk(i.kpisLoading)
      : { status: a > 0 ? t.appr(a) : t.apprNone, tone: a > 0 ? 'alert' : 'ok', info: flow.pagesLive != null ? t.pages(flow.pagesLive) : null, next: a > 0 ? t.apprNext : null },
    conversion: flow.leads30 == null ? unk(flow.loading)
      : { status: t.leads(flow.leads30), tone: 'ok', info: flow.leads30 && flow.tracked30 != null ? t.tracked(flow.tracked30) : null },
  }
}

// Seta central entre dois cards do fluxo — indica a sequência (observa → prioriza → direciona → ativa → mede), não é só decoração.
export function FlowArrow() {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: '4px 0' }}>
      <span style={{ fontSize: '20px', color: 'rgba(255,109,41,0.55)', lineHeight: 1 }}>↓</span>
    </div>
  )
}

// Card hero — mesmo tamanho e estilo nos 5, formando o fluxo vertical do Growth OS (pedido do dono, 2026-10-07).
// Na aba Agentes (C.2) o cartão também fala com a fábrica: `selected` destaca, `onSelect` dispara ao focar (teclado/clique), `id` serve de âncora.
export function HeroAgentCard({ m, badge, onClick, model, lang, id, selected, onSelect, onShow }: { m: CardModule; badge: string; onClick: () => void; model: CardModel; lang: Lang; id?: string; selected?: boolean; onSelect?: () => void; onShow?: () => void }) {
  const [hover, setHover] = useState(false)
  const t = TX[lang]
  const color = model.tone === 'alert' ? ORANGE : model.tone === 'ok' ? '#4ade80' : MUTED
  const lit = hover || selected
  const body = (
    <>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '58px', height: '58px', flexShrink: 0, borderRadius: '16px', background: 'rgba(255,109,41,0.14)', border: '1px solid rgba(255,109,41,0.25)', fontSize: '30px' }}>{m.icon}</div>
      <div style={{ flex: 1, minWidth: '220px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '20px', fontWeight: 800, color: 'white', letterSpacing: '-0.02em' }}>{m.title}</span>
          <span style={{ fontSize: '9.5px', fontWeight: 800, padding: '3px 9px', borderRadius: '99px', background: 'rgba(255,109,41,0.16)', border: '1px solid rgba(255,109,41,0.35)', color: ORANGE, letterSpacing: '0.06em', textTransform: 'uppercase' }}>{badge}</span>
        </div>
        <div style={{ fontSize: '12.5px', fontWeight: 700, color }}>● {model.status}</div>
        {model.info && <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.7)', marginTop: '3px', lineHeight: 1.45 }}>{model.info}</div>}
        {model.next && <div style={{ fontSize: '12px', color: ORANGE, fontWeight: 700, marginTop: '3px' }}>{t.nextLbl}: {model.next}</div>}
      </div>
    </>
  )
  const openBtn = (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', flexShrink: 0, padding: '11px 20px', borderRadius: '11px', background: hover ? ORANGE : 'rgba(255,109,41,0.14)', border: `1px solid ${hover ? ORANGE : 'rgba(255,109,41,0.35)'}`, color: hover ? '#0E0B0A' : ORANGE, fontSize: '13px', fontWeight: 800, transition: 'background 0.18s, color 0.18s' }}>
      {t.open} <span style={{ transition: 'transform 0.18s', transform: hover ? 'translateX(3px)' : 'none' }}>→</span>
    </span>
  )
  const frame = {
    width: '100%', boxSizing: 'border-box', textAlign: 'left', cursor: 'pointer', fontFamily: D,
    display: 'flex', alignItems: 'center', gap: '20px', flexWrap: 'wrap',
    background: 'linear-gradient(135deg, rgba(255,109,41,0.12), rgba(255,109,41,0.04))',
    border: `1px solid ${lit ? 'rgba(255,109,41,0.6)' : 'rgba(255,109,41,0.3)'}`, outline: selected ? '2px solid rgba(255,109,41,0.55)' : 'none', outlineOffset: '2px',
    borderRadius: '18px', padding: '20px 26px', transition: 'border-color 0.18s, box-shadow 0.18s, transform 0.18s',
    transform: hover ? 'translateY(-2px)' : 'none',
    boxShadow: lit ? '0 12px 34px rgba(255,109,41,0.18)' : '0 4px 18px rgba(255,109,41,0.08)',
  } as const
  // Aba Agentes (C.2.1): tocar no cartão mostra a estação na fábrica (abre a cortina, voa até ela); só o botão "Abrir" vai pra tela do agente.
  if (onShow) {
    const main = { display: 'flex', alignItems: 'center', gap: '20px', flexWrap: 'wrap', flex: 1, minWidth: '260px', background: 'none', border: 'none', padding: 0, margin: 0, textAlign: 'left', color: 'inherit', font: 'inherit', cursor: 'pointer' } as const
    return (
      <div id={id} aria-current={selected || undefined} onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)} style={{ ...frame, cursor: 'default' }}>
        <button type="button" title={m.desc} onFocus={onSelect} onClick={onShow} style={main}>{body}</button>
        <button type="button" aria-label={`${t.open}: ${m.title}`} onClick={onClick} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontFamily: D }}>{openBtn}</button>
      </div>
    )
  }
  return (
    <button id={id} aria-current={selected || undefined} onFocus={onSelect} onClick={onClick} onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)} title={m.desc} style={frame}>
      {body}{openBtn}
    </button>
  )
}
