// Custo REAL das chamadas de texto da IA (A.6, 2026-11-07). PURO (sem Deno/rede) + 1 gravador tolerante.
//
// Problema: o creative-generate não gravava custo nenhum e o strategy-generate gravava US$ 0,15 FIXO com tokens_used 0
// (estimativa, não medida). A Anthropic devolve `usage.input_tokens/output_tokens` em toda resposta: aqui isso vira
// tokens + dólares com a tabela de preço abaixo, e vai pro livro-caixa `agent_performance` (mesmo formato dos outros).
//
// Tabela: US$ por 1 milhão de tokens (preço de lista da Anthropic; ajuste AQUI se a fatura real mostrar outro valor — é o
// único lugar). Modelo desconhecido cai no preço do Sonnet (a favor da segurança: nunca subestima). Texto da IA NÃO entra
// no teto de US$ 40/cliente (spendCap só soma task_key de imagem/vídeo/mercado) — estes registros usam task_key próprios.
export const PRICE_PER_MTOK: Record<string, { in: number; out: number }> = {
  'claude-sonnet-4-6': { in: 3, out: 15 },
  'claude-haiku-4-5': { in: 1, out: 5 },
}
const DEFAULT_PRICE = PRICE_PER_MTOK['claude-sonnet-4-6']

// Reaproveitamento de prompt (prompt caching, medição 10/11): a Anthropic devolve à parte o que foi ESCRITO no cache
// (cobra 1,25× a entrada no TTL de 5 min, 2× no de 1 h) e o que foi LIDO do cache (0,1× a entrada). Sem esses campos, tudo igual.
export interface Usage {
  input_tokens?: number; output_tokens?: number
  cache_creation_input_tokens?: number; cache_read_input_tokens?: number
  cache_creation?: { ephemeral_5m_input_tokens?: number; ephemeral_1h_input_tokens?: number } | null
}
export const CACHE_WRITE_5M = 1.25, CACHE_WRITE_1H = 2, CACHE_READ = 0.1
const num = (v: unknown) => { const x = Number(v); return Number.isFinite(x) && x > 0 ? x : 0 }

/** Separação dos tokens de UMA chamada: entrada normal, saída, escrita e leitura do cache. */
export interface Breakdown { input: number; output: number; cacheWrite: number; cacheRead: number }
export function breakdownOf(usage: Usage | null | undefined): Breakdown {
  return { input: num(usage?.input_tokens), output: num(usage?.output_tokens), cacheWrite: num(usage?.cache_creation_input_tokens), cacheRead: num(usage?.cache_read_input_tokens) }
}
/** Tudo que o modelo processou (entrada normal + saída + cache escrito + cache lido). */
export const totalTokens = (b: Breakdown) => b.input + b.output + b.cacheWrite + b.cacheRead

export function priceFor(model: string): { in: number; out: number } {
  const m = String(model ?? '')
  const key = Object.keys(PRICE_PER_MTOK).find(k => m === k || m.startsWith(`${k}-`))
  return key ? PRICE_PER_MTOK[key] : DEFAULT_PRICE
}

/** Dólares de UMA chamada (arredondado em 6 casas). Token inválido/negativo conta 0. */
export function anthropicCostUsd(model: string, usage: Usage | null | undefined): number {
  const p = priceFor(model)
  const b = breakdownOf(usage)
  // Escrita no cache: usa a divisão por TTL quando vem; sem ela, conta tudo como 5 min (a de 1 h só existe se pedirmos).
  const w1h = Math.min(num(usage?.cache_creation?.ephemeral_1h_input_tokens), b.cacheWrite)
  const w5m = b.cacheWrite - w1h
  const usd = b.input * p.in + b.output * p.out + (w5m * CACHE_WRITE_5M + w1h * CACHE_WRITE_1H + b.cacheRead * CACHE_READ) * p.in
  return Math.round((usd / 1_000_000) * 1e6) / 1e6
}

/** Soma de várias chamadas de uma mesma peça/estratégia. */
export interface CostTracker { add: (model: string, usage: Usage | null | undefined) => void; tokens: () => number; costUsd: () => number; calls: () => number; breakdown: () => Breakdown }
export function newCostTracker(): CostTracker {
  let tokens = 0, cost = 0, calls = 0
  const sum: Breakdown = { input: 0, output: 0, cacheWrite: 0, cacheRead: 0 }
  return {
    add(model, usage) {
      const b = breakdownOf(usage), t = totalTokens(b)
      if (t <= 0) return
      tokens += t; cost += anthropicCostUsd(model, usage); calls++
      sum.input += b.input; sum.output += b.output; sum.cacheWrite += b.cacheWrite; sum.cacheRead += b.cacheRead
    },
    tokens: () => tokens, costUsd: () => Math.round(cost * 1e6) / 1e6, calls: () => calls, breakdown: () => ({ ...sum }),
  }
}

/** Origem da chamada: agendamento automático ou clique de uma pessoa (separa operação de teste/uso manual). */
export type Trigger = 'cron' | 'manual'

/**
 * Colunas extras de agent_performance (migration 20261110120000). Se a migration ainda não estiver aplicada, o banco
 * recusa a linha: aí grava de novo SEM as colunas novas — a medição antiga nunca se perde por causa da nova.
 */
// deno-lint-ignore no-explicit-any
export async function insertPerf(admin: { from: (t: string) => any }, row: Record<string, unknown>, extra: { breakdown?: Breakdown | null; trigger?: Trigger | null }): Promise<void> {
  const cols: Record<string, unknown> = {}
  if (extra.breakdown) Object.assign(cols, { input_tokens: Math.round(extra.breakdown.input), output_tokens: Math.round(extra.breakdown.output), cache_write_tokens: Math.round(extra.breakdown.cacheWrite), cache_read_tokens: Math.round(extra.breakdown.cacheRead) })
  if (extra.trigger) cols.call_origin = extra.trigger
  const { error } = await admin.from('agent_performance').insert({ ...row, ...cols })
  if (error && Object.keys(cols).length) {
    console.warn('aiCost: colunas novas recusadas (migration pendente?) — gravando sem elas', String(error.message ?? error).slice(0, 200))
    const { error: e2 } = await admin.from('agent_performance').insert(row)
    if (e2) throw new Error(String(e2.message ?? e2))
  } else if (error) throw new Error(String(error.message ?? error))
}

// deno-lint-ignore no-explicit-any
type Admin = { from: (t: string) => any }
/** Grava 1 linha em agent_performance. NUNCA derruba o fluxo se a gravação falhar (nem se o banco recusar). latency_ms é coluna obrigatória. */
export async function logAiCost(admin: Admin, row: { companyId: string; role: string; taskKey: string; description: string; tokens: number; costUsd: number; latencyMs?: number; success?: boolean; error?: string | null; breakdown?: Breakdown | null; trigger?: Trigger | null }): Promise<void> {
  try {
    if (!(row.tokens > 0)) return   // nada medido = nada a gravar (não inventa custo)
    await insertPerf(admin, {
      company_id: row.companyId, agent_role: row.role, task_key: row.taskKey, task_description: row.description.slice(0, 200),
      tokens_used: Math.round(row.tokens), cost_usd: row.costUsd, latency_ms: Math.round(row.latencyMs ?? 0),
      success: row.success !== false, error_message: row.error ? row.error.slice(0, 500) : null,
    }, { breakdown: row.breakdown ?? null, trigger: row.trigger ?? null })
  } catch (e) { console.error('aiCost: custo não gravado (segue)', e) }
}
