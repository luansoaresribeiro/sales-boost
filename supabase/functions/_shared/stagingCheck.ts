// Frente 1, item 1.3c (20/11): TRAVA DO MOBILIADO. Regra do dono (obrigatória): o mobiliado nunca inventa arquitetura.
// Achado de 20/11 (Tespon): num terraço aberto, a IA de imagem criou teto, paredes e janela. Agora, quando a foto
// mobiliada fica pronta, uma IA de visão compara a foto REAL com a mobiliada e só relata FATOS; quem decide é a regra
// pura `keepsArchitecture` (testada em scripts/test-staging-check.mjs). Na dúvida, recusa: melhor não entregar a foto
// do que mostrar um imóvel que não existe. ~US$ 0,01 por conferência (Sonnet, 2 imagens), gravado em agent_performance.
import { anthropicCostUsd, breakdownOf, logAiCost, totalTokens, type Usage } from './aiCost.ts'

export const STAGING_CHECK_MODEL = 'claude-sonnet-5-5'
type Tri = 'yes' | 'no' | 'unsure'
export interface StagingFacts {
  outdoor: Tri              // a foto real é de área externa (terraço, varanda descoberta, quintal)?
  roofAdded: Tri            // apareceu teto/cobertura/pérgola fechada que não existia (ou sumiu um que existia)?
  wallsChanged: Tri         // parede nova, parede removida, recorte ou nicho diferente?
  openingsChanged: Tri      // janela/porta/vão novo, removido, mudado de lugar ou de tamanho?
  viewChanged: Tri          // a vista/céu/paisagem lá fora mudou (ou foi tapada)?
  floorChanged: Tri         // o piso/revestimento do chão mudou?
}
export interface StagingCheck { ok: boolean; reasons: string[]; facts?: StagingFacts; v: number }
export const STAGING_CHECK_VERSION = 1

const REASON: Record<keyof Omit<StagingFacts, 'outdoor'>, string> = {
  roofAdded: 'criou ou tirou teto/cobertura',
  wallsChanged: 'mudou paredes',
  openingsChanged: 'mudou janelas ou portas',
  viewChanged: 'mudou a vista ou o céu',
  floorChanged: 'mudou o piso',
}

/** A regra: qualquer mudança de arquitetura (ou dúvida) recusa. Só passa com "no" em tudo. */
export function keepsArchitecture(f: StagingFacts): { ok: boolean; reasons: string[] } {
  const reasons: string[] = []
  for (const k of Object.keys(REASON) as (keyof typeof REASON)[]) {
    if (f[k] === 'yes') reasons.push(REASON[k])
    else if (f[k] === 'unsure') reasons.push(`não deu para confirmar que não ${REASON[k]}`)
  }
  return { ok: reasons.length === 0, reasons }
}

const tri = (v: unknown): Tri => { const s = String(v ?? '').toLowerCase(); return s === 'yes' || s === 'sim' || s === 'true' ? 'yes' : s === 'no' || s === 'nao' || s === 'não' || s === 'false' ? 'no' : 'unsure' }

export function parseStagingFacts(text: string): StagingFacts | null {
  const all = String(text ?? '').match(/\{[^{}]*"roof_added"[^{}]*\}/g)
  const m = all?.[all.length - 1]
  if (!m) return null
  try {
    const o = JSON.parse(m) as Record<string, unknown>
    return { outdoor: tri(o.outdoor), roofAdded: tri(o.roof_added), wallsChanged: tri(o.walls_changed), openingsChanged: tri(o.openings_changed), viewChanged: tri(o.view_changed), floorChanged: tri(o.floor_changed) }
  } catch { return null }
}

export const STAGING_PROMPT = `A FOTO 1 é a foto REAL de um ambiente. A FOTO 2 é a mesma foto depois de uma IA "mobiliar" o ambiente. Móveis, tapetes, plantas, quadros e objetos novos são PERMITIDOS e não contam. Responda só sobre a ARQUITETURA, comparando as duas.
Primeiro descreva em poucas linhas: na FOTO 1, onde estão paredes, teto (ou céu aberto), janelas, portas, vãos, piso e a vista; depois o que mudou disso na FOTO 2.
Depois responda:
- outdoor: a FOTO 1 é de área externa ou descoberta (terraço, varanda sem teto, quintal, piscina)?
- roof_added: na FOTO 2 apareceu teto, laje, forro ou cobertura onde na FOTO 1 havia céu aberto (ou o contrário)?
- walls_changed: na FOTO 2 há parede nova, parede removida, ou parede em lugar diferente?
- openings_changed: na FOTO 2 há janela, porta ou vão novo, removido, mudado de lugar ou de tamanho?
- view_changed: a vista ou o céu lá fora mudou, sumiu ou foi tapada?
- floor_changed: o piso (material do chão) mudou? (tapete por cima não conta)
Se não der para ver com certeza, responda "unsure".
Termine com UMA linha só com o JSON: {"outdoor":"yes|no|unsure","roof_added":"yes|no|unsure","walls_changed":"yes|no|unsure","openings_changed":"yes|no|unsure","view_changed":"yes|no|unsure","floor_changed":"yes|no|unsure"}`

// deno-lint-ignore no-explicit-any
type Admin = any

/** Confere a foto mobiliada contra a real. Falha da IA = recusa (sem nova tentativa paga). */
export async function checkStaging(admin: Admin, anthropicKey: string, companyId: string, realUrl: string, stagedUrl: string): Promise<StagingCheck> {
  if (!anthropicKey) return { ok: false, reasons: ['conferência indisponível agora'], v: STAGING_CHECK_VERSION }
  const t0 = Date.now()
  let usage: Usage | null = null, text = '', error: string | null = null
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': anthropicKey, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({ model: STAGING_CHECK_MODEL, max_tokens: 2000, output_config: { effort: 'medium' }, messages: [{ role: 'user', content: [
        { type: 'text', text: 'FOTO 1 (real):' }, { type: 'image', source: { type: 'url', url: realUrl } },
        { type: 'text', text: 'FOTO 2 (mobiliada):' }, { type: 'image', source: { type: 'url', url: stagedUrl } },
        { type: 'text', text: STAGING_PROMPT },
      ] }] }),
      signal: AbortSignal.timeout(90_000),
    })
    if (!res.ok) error = `IA recusou (${res.status}): ${(await res.text()).slice(0, 200)}`
    else {
      const data = await res.json()
      usage = data.usage ?? null
      text = (Array.isArray(data.content) ? data.content : []).filter((b: { type?: string }) => b?.type === 'text').map((b: { text?: string }) => b.text ?? '').join('\n')
    }
  } catch (e) { error = String(e).slice(0, 200) }
  const facts = text ? parseStagingFacts(text) : null
  const costUsd = anthropicCostUsd(STAGING_CHECK_MODEL, usage)
  await logAiCost(admin, { companyId, role: 'tour', taskKey: 'ai_vision_staging_check', description: 'Conferência do mobiliado (arquitetura)', tokens: totalTokens(breakdownOf(usage)), costUsd, latencyMs: Date.now() - t0, success: !!facts, error: facts ? null : (error ?? 'resposta sem JSON válido'), breakdown: breakdownOf(usage), trigger: 'manual' }).catch(() => {})
  if (!facts) return { ok: false, reasons: ['não deu para conferir a foto agora'], v: STAGING_CHECK_VERSION }
  return { ...keepsArchitecture(facts), facts, v: STAGING_CHECK_VERSION }
}
