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

export interface Usage { input_tokens?: number; output_tokens?: number }

export function priceFor(model: string): { in: number; out: number } {
  const m = String(model ?? '')
  const key = Object.keys(PRICE_PER_MTOK).find(k => m === k || m.startsWith(`${k}-`))
  return key ? PRICE_PER_MTOK[key] : DEFAULT_PRICE
}

/** Dólares de UMA chamada (arredondado em 6 casas). Token inválido/negativo conta 0. */
export function anthropicCostUsd(model: string, usage: Usage | null | undefined): number {
  const n = (v: unknown) => { const x = Number(v); return Number.isFinite(x) && x > 0 ? x : 0 }
  const p = priceFor(model)
  return Math.round(((n(usage?.input_tokens) * p.in + n(usage?.output_tokens) * p.out) / 1_000_000) * 1e6) / 1e6
}

/** Soma de várias chamadas de uma mesma peça/estratégia. */
export interface CostTracker { add: (model: string, usage: Usage | null | undefined) => void; tokens: () => number; costUsd: () => number; calls: () => number }
export function newCostTracker(): CostTracker {
  let tokens = 0, cost = 0, calls = 0
  return {
    add(model, usage) {
      const t = (Number(usage?.input_tokens) || 0) + (Number(usage?.output_tokens) || 0)
      if (t <= 0) return
      tokens += t; cost += anthropicCostUsd(model, usage); calls++
    },
    tokens: () => tokens, costUsd: () => Math.round(cost * 1e6) / 1e6, calls: () => calls,
  }
}

// deno-lint-ignore no-explicit-any
type Admin = { from: (t: string) => any }
/** Grava 1 linha em agent_performance. NUNCA derruba o fluxo se a gravação falhar (nem se o banco recusar). latency_ms é coluna obrigatória. */
export async function logAiCost(admin: Admin, row: { companyId: string; role: string; taskKey: string; description: string; tokens: number; costUsd: number; latencyMs?: number; success?: boolean; error?: string | null }): Promise<void> {
  try {
    if (!(row.tokens > 0)) return   // nada medido = nada a gravar (não inventa custo)
    await admin.from('agent_performance').insert({
      company_id: row.companyId, agent_role: row.role, task_key: row.taskKey, task_description: row.description.slice(0, 200),
      tokens_used: Math.round(row.tokens), cost_usd: row.costUsd, latency_ms: Math.round(row.latencyMs ?? 0),
      success: row.success !== false, error_message: row.error ? row.error.slice(0, 500) : null,
    })
  } catch (e) { console.error('aiCost: custo não gravado (segue)', e) }
}
