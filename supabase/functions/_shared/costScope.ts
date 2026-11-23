// Etapa A (dono, 22/11): custo REAL por operação, com IDENTIFICADOR ÚNICO, mesmo quando a operação faz várias chamadas à
// Anthropic. Cada operação (ex.: gerar 1 post do imóvel, dar a nota de 1 peça) roda dentro de um "escopo"; toda chamada
// à IA soma no escopo (tokens + dólares medidos pela resposta) e, no fim, grava UMA linha em agent_performance com
// operation_id (único no banco: gravar duas vezes a mesma operação é recusado) e ref_id (a peça/estratégia a que o custo
// pertence). Escopo por requisição (AsyncLocalStorage): requisições simultâneas na mesma função não se misturam.
// Falha ao gravar nunca derruba o fluxo. Sem escopo ativo, trackUsage não faz nada (comportamento de antes).
import { AsyncLocalStorage } from 'node:async_hooks'
import { logAiCost, newCostTracker, type CostTracker, type Trigger, type Usage } from './aiCost.ts'

interface Scope { track: CostTracker }
const als = new AsyncLocalStorage<Scope>()

/** Chame em TODA resposta da Anthropic (texto ou visão) com o modelo pedido e `data.usage`. */
export function trackUsage(model: string, usage: Usage | null | undefined): void {
  als.getStore()?.track.add(model, usage)
}

// deno-lint-ignore no-explicit-any
type Admin = { from: (t: string) => any }
export interface OperationMeta { companyId: string; role: string; taskKey: string; description: string; refId?: string | null; trigger?: Trigger | null }

async function logOperation(admin: Admin, track: CostTracker, m: OperationMeta, t0: number, err: string | null): Promise<void> {
  try {
    await logAiCost(admin, {
      companyId: m.companyId, role: m.role, taskKey: m.taskKey, description: m.description,
      tokens: track.tokens(), costUsd: track.costUsd(), latencyMs: Date.now() - t0,
      success: !err, error: err, breakdown: track.breakdown(), trigger: m.trigger ?? null,
      operationId: crypto.randomUUID(), refId: m.refId ?? null, costKind: 'medido', provider: 'anthropic', calls: track.calls(),
    })
  } catch (e) { console.error('costScope: custo não gravado (segue)', e) }
}

/**
 * Roda `fn` como UMA operação: todas as chamadas à IA dentro dela somam juntas e, no fim (com sucesso ou erro), vira 1
 * linha com operation_id novo. `meta` pode ser uma função (ex.: o ref_id só existe depois de gravar a peça).
 */
export async function withCostOperation<T>(admin: Admin, meta: OperationMeta | ((r: T | null) => OperationMeta), fn: () => Promise<T>): Promise<T> {
  const scope: Scope = { track: newCostTracker() }
  const t0 = Date.now()
  let result: T | null = null, err: string | null = null
  try {
    result = await als.run(scope, fn)
    return result
  } catch (e) { err = e instanceof Error ? e.message : String(e); throw e }
  finally {
    if (scope.track.calls() > 0) await logOperation(admin, scope.track, typeof meta === 'function' ? meta(result) : meta, t0, err)
  }
}

/** Abre o escopo da requisição inteira (envolve o handler do Deno.serve). Sozinho não grava nada. */
export function withCostScope<T>(fn: () => Promise<T>): Promise<T> {
  return als.run({ track: newCostTracker() }, fn)
}

/**
 * Começa uma operação DENTRO do escopo da requisição, para laços com `continue`/`return` no meio (ex.: 1 peça por
 * volta do laço): zera o acumulador e devolve `finish`, que grava 1 linha com operation_id novo — só se houve chamada
 * à IA. Chamar `finish` num `finally`. Operações em sequência, nunca em paralelo no mesmo escopo.
 */
export function beginCostOperation(): { finish: (admin: Admin, meta: OperationMeta, err?: string | null) => Promise<void> } {
  const scope = als.getStore()
  if (scope) scope.track = newCostTracker()
  const t0 = Date.now()
  let done = false
  return {
    async finish(admin, meta, err = null) {
      if (done || !scope || scope.track.calls() === 0) return
      done = true
      await logOperation(admin, scope.track, meta, t0, err)
    },
  }
}
