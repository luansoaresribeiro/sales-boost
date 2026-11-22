// Etapa A (dono, 22/11): o LUGAR ÚNICO que diz o que cada linha de custo é e como somar sem contar duas vezes.
// Puro (sem banco): a tela "Custos" do Owner (via api-usage) e os testes usam as mesmas regras.
//
// Quatro tipos, nunca misturados:
//  - medido: tokens reais devolvidos pela Anthropic × tabela de preço (aiCost.ts);
//  - preco_por_uso: preço de lista por chamada, sem tokens (Tavily, imagem, transcrição, vídeo do tour);
//  - estimado: valor fixo antigo, sem medição (estratégia antes de ~10/11);
//  - nao_medido: função que chama serviço pago e ainda não grava nada (lista NAO_MEDIDO, sem valor em dólar).
// Linhas sem custo (marcadores como opportunity_piece_created) ficam fora das somas.

export type CostKind = 'medido' | 'preco_por_uso' | 'estimado'

export interface CostRow {
  id: string
  company_id: string | null
  agent_role: string | null
  task_key: string | null
  cost_usd: number | string | null
  tokens_used: number | null
  created_at: string
  operation_id?: string | null
  ref_id?: string | null
  cost_kind?: string | null
  provider?: string | null
  calls?: number | null
  source?: 'agent_performance' | 'video_tours'
}

/** Estratégia antiga: valor fixo gravado sem tokens. Depois do #127 essas linhas vêm com 0 e o real vai em ai_text_strategy. */
const LEGACY_ESTIMATE = new Set(['strategy_generate', 'strategy_refresh', 'strategy_reanalyze'])

const num = (v: unknown): number => { const n = typeof v === 'string' ? Number(v) : (v as number); return Number.isFinite(n) ? n : 0 }

/** Tipo da linha; null = sem custo (não entra em soma nenhuma). */
export function costKindOf(r: CostRow): CostKind | null {
  const usd = num(r.cost_usd)
  if (!(usd > 0)) return null
  if (r.cost_kind === 'medido' || r.cost_kind === 'preco_por_uso' || r.cost_kind === 'estimado') return r.cost_kind
  if (r.task_key && LEGACY_ESTIMATE.has(r.task_key) && !(num(r.tokens_used) > 0)) return 'estimado'
  if (r.source === 'video_tours') return 'preco_por_uso'
  return num(r.tokens_used) > 0 ? 'medido' : 'preco_por_uso'
}

/** Funcionalidade (o que o cliente vê) e quem paga. Pagas pelo cliente: tour e mobiliado (menu Pro). */
export interface Feature { key: string; label: string; paidByClient: boolean }
const F = (key: string, label: string, paidByClient = false): Feature => ({ key, label, paidByClient })
const FEATURES: [RegExp, Feature][] = [
  [/^ai_text_catalog$/, F('post_imovel', 'Posts do imóvel')],
  [/^(ai_text_content|ai_text_test_content|ai_text_regenerate|content_no_image)$/, F('post_semana', 'Posts do plano semanal')],
  [/^ai_text_quality_score$/, F('nota_qualidade', 'Nota de qualidade dos posts')],
  [/^image_generation$/, F('imagem', 'Imagem gerada')],
  [/^(strategy_|ai_text_strategy)/, F('estrategia', 'Estratégia')],
  [/^market_news/, F('mercado', 'Notícias de mercado')],
  [/opportunit/, F('oportunidades', 'Oportunidades')],
  [/^ai_vision_staging|^virtual_staging/, F('mobiliado', 'Mobiliar cômodo', true)],
  [/^(ai_vision_|tour_video|video_tour)/, F('tour', 'Tour virtual', true)],
  [/^audio_transcription$/, F('telegram', 'Telegram (áudio)')],
]
export function featureOf(r: CostRow): Feature {
  if (r.source === 'video_tours') return F('tour', 'Tour virtual', true)
  const k = r.task_key ?? ''
  for (const [re, f] of FEATURES) if (re.test(k)) return f
  return F('outros', k || 'Sem nome')
}

/** Provedor que cobra. Gravado na linha (etapa A) ou deduzido do task_key nas linhas antigas. */
export function providerOf(r: CostRow): string {
  if (r.provider) return r.provider
  if (r.source === 'video_tours') return 'higgsfield'
  const k = r.task_key ?? ''
  if (/^market_news/.test(k)) return 'tavily'
  if (k === 'image_generation') return 'imagem'
  if (k === 'audio_transcription') return 'transcricao'
  if (LEGACY_ESTIMATE.has(k)) return 'anthropic (estimado)'
  return 'anthropic'
}

/**
 * Anti-duplicação: a mesma linha (id) ou a mesma operação (operation_id) entra uma vez só. O banco já recusa
 * operation_id repetido (índice único); aqui é a segunda trava, para dados juntados de mais de uma consulta.
 */
export function dedupe(rows: CostRow[]): CostRow[] {
  const ids = new Set<string>(), ops = new Set<string>(), out: CostRow[] = []
  for (const r of rows) {
    const idKey = `${r.source ?? 'agent_performance'}:${r.id}`
    if (ids.has(idKey)) continue
    if (r.operation_id) { if (ops.has(r.operation_id)) continue; ops.add(r.operation_id) }
    ids.add(idKey); out.push(r)
  }
  return out
}

export type KindTotals = Record<CostKind, number>
const zero = (): KindTotals => ({ medido: 0, preco_por_uso: 0, estimado: 0 })
const r6 = (n: number) => Math.round(n * 1e6) / 1e6
export interface Bucket { key: string; label: string; total: number; kinds: KindTotals; rows: number; paidByClient?: boolean }

export interface FixedCost { month: string; item: string; provider?: string | null; amount_usd: number | string }
export interface LedgerSummary {
  variable: { total: number; kinds: KindTotals; rows: number }
  fixed: { total: number; items: { item: string; provider: string | null; amount_usd: number }[]; informed: boolean }
  /** Fixo ÷ clientes com custo no período. É RATEIO (divisão), não custo medido do cliente. */
  fixedPerActiveClient: number | null
  byCompany: Bucket[]; byFeature: Bucket[]; byOperation: Bucket[]; byAgent: Bucket[]; byProvider: Bucket[]; byDay: Bucket[]
  freeVsPaid: { free: number; paidByClient: number }
}

function add(map: Map<string, Bucket>, key: string, label: string, kind: CostKind, usd: number, extra?: Partial<Bucket>) {
  const b = map.get(key) ?? { key, label, total: 0, kinds: zero(), rows: 0, ...extra }
  b.total += usd; b.kinds[kind] += usd; b.rows++
  map.set(key, b)
}
const out = (m: Map<string, Bucket>, byKey = false) => [...m.values()]
  .map(b => ({ ...b, total: r6(b.total), kinds: { medido: r6(b.kinds.medido), preco_por_uso: r6(b.kinds.preco_por_uso), estimado: r6(b.kinds.estimado) } }))
  .sort((a, b) => byKey ? a.key.localeCompare(b.key) : b.total - a.total)

/** Junta linhas de custo (variável) e custos fixos informados pelo dono, sem misturar os dois. */
export function summarize(rows: CostRow[], fixed: FixedCost[] = [], companyNames: Record<string, string> = {}): LedgerSummary {
  const byCompany = new Map<string, Bucket>(), byFeature = new Map<string, Bucket>(), byOp = new Map<string, Bucket>()
  const byAgent = new Map<string, Bucket>(), byProv = new Map<string, Bucket>(), byDay = new Map<string, Bucket>()
  const kinds = zero(); let total = 0, n = 0, free = 0, paid = 0
  for (const r of dedupe(rows)) {
    const kind = costKindOf(r)
    if (!kind) continue
    const usd = num(r.cost_usd), f = featureOf(r)
    total += usd; kinds[kind] += usd; n++
    if (f.paidByClient) paid += usd; else free += usd
    const cid = r.company_id ?? 'plataforma'
    add(byCompany, cid, companyNames[cid] ?? cid, kind, usd)
    add(byFeature, f.key, f.label, kind, usd, { paidByClient: f.paidByClient })
    add(byOp, r.task_key ?? '—', r.task_key ?? '—', kind, usd)
    add(byAgent, r.agent_role ?? '—', r.agent_role ?? '—', kind, usd)
    const p = providerOf(r); add(byProv, p, p, kind, usd)
    const d = r.created_at.slice(0, 10); add(byDay, d, d, kind, usd)
  }
  const items = fixed.map(x => ({ item: x.item, provider: x.provider ?? null, amount_usd: num(x.amount_usd) })).filter(x => x.amount_usd >= 0)
  const fixedTotal = r6(items.reduce((s, x) => s + x.amount_usd, 0))
  const active = [...byCompany.keys()].filter(k => k !== 'plataforma').length
  return {
    variable: { total: r6(total), kinds: { medido: r6(kinds.medido), preco_por_uso: r6(kinds.preco_por_uso), estimado: r6(kinds.estimado) }, rows: n },
    fixed: { total: fixedTotal, items, informed: items.length > 0 },
    fixedPerActiveClient: items.length && active ? r6(fixedTotal / active) : null,
    byCompany: out(byCompany), byFeature: out(byFeature), byOperation: out(byOp), byAgent: out(byAgent), byProvider: out(byProv), byDay: out(byDay, true),
    freeVsPaid: { free: r6(free), paidByClient: r6(paid) },
  }
}

/**
 * Funções que chamam serviço pago e AINDA não gravam custo (levantado no código em 22/11). A tela mostra a lista com
 * "não medido" — nunca um valor inventado. Tirar daqui quando a função passar a gravar.
 */
export const NAO_MEDIDO: { fn: string; provider: string; what: string }[] = [
  { fn: 'agent-chat', provider: 'anthropic', what: 'Chat com os agentes' },
  { fn: 'draft-reply', provider: 'anthropic', what: 'Rascunho de resposta' },
  { fn: 'creative-ideas', provider: 'anthropic', what: 'Ideias de conteúdo' },
  { fn: 'generate-tab-insight', provider: 'anthropic', what: 'Resumo das abas' },
  { fn: 'run-diagnosis', provider: 'anthropic', what: 'Diagnóstico' },
  { fn: 'telegram-chat', provider: 'anthropic', what: 'Conversa no Telegram' },
  { fn: 'analyze-reviews', provider: 'anthropic', what: 'Análise de avaliações' },
  { fn: 'generate-report / periodic-report / monthly-report', provider: 'anthropic', what: 'Relatórios' },
  { fn: 'website-summary / site-diagnosis', provider: 'anthropic', what: 'Leitura do site' },
  { fn: 'virtual-staging', provider: 'higgsfield', what: 'Mobiliar cômodo (imagem)' },
  { fn: 'apify-sync / scrape-social', provider: 'apify', what: 'Coleta de redes sociais' },
  { fn: 'whatsapp-webhook / instagram-webhook', provider: 'anthropic', what: 'Respostas automáticas' },
]
