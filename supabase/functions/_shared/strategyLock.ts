// Trava de aprovação da estratégia (Fase 3, 2026-11-04). Regra do dono: posicionamento, público e objetivos só mudam com a
// aprovação dele. Funções PURAS (testáveis em Node, sem Deno/rede) usadas pelo strategy-generate:
// - refresh automático: só plano de conteúdo + metas; tese, foco, os 2 objetivos e o público/objetivo das etapas do funil ficam como estão;
// - pivô/encerrar automático: a estratégia nova nasce como PROPOSTA (status 'needs_review'), a ativa continua rodando;
// - proposta descartada com a MESMA tese não volta a ser proposta (só registra no log).
// A proposta guarda seus metadados em data_provenance.proposal (a tabela não tem coluna "meta"; o status 'archived' não existe
// no CHECK — descartada/arquivada = 'paused' + data_provenance.proposal.discarded_at, igual às estratégias antigas pausadas).

export interface ProposalMeta {
  from_strategy_id: string | null
  decision: 'pivot' | 'terminate'
  reason: string
  reasoning: string
  campaign_draft?: { name?: string; goal?: string } | null
  discarded_at?: string
  discarded_by?: 'owner' | 'system'
  approved_at?: string
}
type Prov = Record<string, unknown> | null | undefined

export const proposalOf = (prov: Prov): ProposalMeta | null => {
  const p = (prov && typeof prov === 'object' ? (prov as Record<string, unknown>).proposal : null) as ProposalMeta | null
  return p && typeof p === 'object' ? p : null
}

/** Proposta pendente = nasceu de pivô automático, está em 'needs_review' e ninguém a descartou. */
export const isPendingProposal = (row: { status?: string | null; data_provenance?: Prov }): boolean =>
  row.status === 'needs_review' && !!proposalOf(row.data_provenance) && !proposalOf(row.data_provenance)?.discarded_at

/** Tese comparável: sem acento, caixa, pontuação ou espaços repetidos. */
export const normThesis = (s: unknown): string =>
  String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()

export const sameThesis = (a: unknown, b: unknown): boolean => { const x = normThesis(a); return !!x && x === normThesis(b) }

/** Já descartaram uma proposta com esta tese? Compara com a ÚLTIMA descartada (lista vinda do banco, qualquer ordem). */
export function repeatsDiscarded(thesis: unknown, rows: { thesis?: string | null; data_provenance?: Prov }[]): boolean {
  const disc = rows.map(r => ({ t: r.thesis, at: proposalOf(r.data_provenance)?.discarded_at ?? '' })).filter(r => r.at).sort((a, b) => b.at.localeCompare(a.at))
  return disc.length > 0 && sameThesis(thesis, disc[0].t)
}

interface FunnelLike { stage?: string; pillar?: string; audience?: string; objective?: string; [k: string]: unknown }
/**
 * Funil do refresh com público e objetivo da etapa TRAVADOS: cada etapa nova herda audience/objective da etapa atual de mesmo
 * estágio (e mesmo pilar, se houver). Etapa que não existe na estratégia atual não entra (seria público novo sem aprovação).
 * Sem nenhuma etapa aproveitável, o funil atual fica como está.
 */
export function lockFunnel(current: unknown, proposed: unknown): FunnelLike[] {
  const cur = (Array.isArray(current) ? current : []).filter((x): x is FunnelLike => !!x && typeof x === 'object')
  const nxt = (Array.isArray(proposed) ? proposed : []).filter((x): x is FunnelLike => !!x && typeof x === 'object')
  const used = new Set<FunnelLike>()
  const out: FunnelLike[] = []
  for (const n of nxt) {
    const match = cur.find(c => !used.has(c) && c.stage === n.stage && (c.pillar ?? '') === (n.pillar ?? '')) ?? cur.find(c => !used.has(c) && c.stage === n.stage)
    if (!match) continue
    used.add(match)
    out.push({ ...n, audience: match.audience ?? '', objective: match.objective ?? '' })
  }
  return out.length ? out : cur
}

/** O que o refresh automático grava na estratégia ativa. NUNCA inclui tese, foco, objetivos, restrição, exclusões nem orçamento. */
export function refreshPatch(strategy: { funnel_plan?: unknown }, proposedFunnel: unknown, contentPlan: unknown, now: string): Record<string, unknown> {
  return { funnel_plan: lockFunnel(strategy.funnel_plan, proposedFunnel), content_plan: contentPlan, last_refreshed_at: now, updated_at: now }
}

/** Fim do passo 3: o que fazer com a estratégia que acabou de ser gerada. */
export function finishPlan(row: { kind?: string; data_provenance?: Prov }): { status: 'active' | 'needs_review'; pausePrevious: boolean; createCampaign: boolean; planRestOfWeek: boolean; supersedeProposals: boolean } {
  const isProposal = !!proposalOf(row.data_provenance)
  const main = row.kind === 'main'
  return { status: isProposal ? 'needs_review' : 'active', pausePrevious: main && !isProposal, createCampaign: !isProposal, planRestOfWeek: main && !isProposal, supersedeProposals: main && !isProposal }
}

/** Proposta aprovada: vira a ativa (o chamador arquiva a anterior). */
export const approvePatch = (prov: Prov, now: string): Record<string, unknown> => {
  const p = proposalOf(prov)
  return { status: 'active', data_provenance: { ...(prov ?? {}), proposal: { ...(p ?? {}), approved_at: now } }, updated_at: now }
}
/** Proposta descartada: sai da lista sem apagar nada; a ativa não é tocada. */
export const discardPatch = (prov: Prov, by: 'owner' | 'system', now: string): Record<string, unknown> => {
  const p = proposalOf(prov)
  return { status: 'paused', data_provenance: { ...(prov ?? {}), proposal: { ...(p ?? {}), discarded_at: now, discarded_by: by } }, updated_at: now }
}
