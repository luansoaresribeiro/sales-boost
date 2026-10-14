// Teto ÚNICO de gasto por cliente por mês (regra 7; decisão do dono
// 2026-10-14: "juntar tudo num único teto de 40 dólares"). Antes só os vídeos
// dos imóveis tinham teto em dólar; agora tudo que é pago por peça soma aqui:
//  - vídeos (Higgsfield/Kling): video_tours kind 'plan', cost_usd gravado na criação;
//  - edições de foto (Higgsfield Qwen Edit): "mobiliar" (tabela virtual_staging)
//    + tratamento de foto do Vault (agent_performance task_key 'photo_retouch');
//  - imagens da OpenAI: agent_performance task_key 'image_generation' (estimativa
//    do generate-image).
// Texto da IA (Claude) NÃO entra: já tem limite diário próprio (hermes-proxy).
// O kit grátis também não (é de quem ainda não paga; tem teto global próprio).
//
// Preço da edição de foto: US$ 0,08 por edição, medido no extrato da
// Higgsfield (2026-10-14: o teste de "mobiliar" do dia saiu US$ 0,08; os
// tratamentos dos kits de 11/10, também). Medido na resolução 2k; o Vault usa
// 1k (no máximo o mesmo preço — conta pelo valor maior, a favor do teto). O
// secret HF_EDIT_COST_USD troca o valor se a Higgsfield mudar o preço.
// deno-lint-ignore no-explicit-any
type Any = any

export const CLIENT_MONTHLY_CAP_USD = Number(Deno.env.get('CLIENT_MONTHLY_CAP_USD') ?? Deno.env.get('VIDEO_MONTHLY_CAP_USD') ?? '40') || 40
const editEnv = Number(Deno.env.get('HF_EDIT_COST_USD') ?? '0.08')
export const HF_EDIT_COST_USD: number = Number.isFinite(editEnv) && editEnv > 0 ? editEnv : 0.08

export interface MonthSpend {
  total_usd: number; cap_usd: number
  videos_usd: number; images_usd: number
  edits: number; edits_usd: number
}

const monthStart = () => new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1)).toISOString()

export async function monthSpend(admin: Any, companyId: string): Promise<MonthSpend> {
  const since = monthStart()
  const [{ data: vids }, { data: staging }, { data: perf }] = await Promise.all([
    admin.from('video_tours').select('cost_usd').eq('company_id', companyId).eq('kind', 'plan').gte('created_at', since),
    // Pedido de mobiliar que chegou na Higgsfield (job_ref) — com ou sem sucesso,
    // cada envio (attempts, inclui a nova tentativa automática) foi cobrado.
    admin.from('virtual_staging').select('attempts').eq('company_id', companyId).not('job_ref', 'is', null).gte('created_at', since),
    admin.from('agent_performance').select('task_key, cost_usd').eq('company_id', companyId).in('task_key', ['image_generation', 'photo_retouch']).gte('created_at', since),
  ])
  const sum = (rows: { cost_usd: number | string | null }[]) => rows.reduce((s, r) => s + Number(r.cost_usd || 0), 0)
  const rows = (perf ?? []) as { task_key: string; cost_usd: number | string | null }[]
  const videos = sum(vids ?? [])
  const images = sum(rows.filter(r => r.task_key === 'image_generation'))
  const staged = ((staging ?? []) as { attempts: number | null }[]).reduce((s, r) => s + Math.max(1, Number(r.attempts || 1)), 0)
  const edits = staged + rows.filter(r => r.task_key === 'photo_retouch').length
  const editsUsd = edits * HF_EDIT_COST_USD
  const total = videos + images + editsUsd
  return { total_usd: total, cap_usd: CLIENT_MONTHLY_CAP_USD, videos_usd: videos, images_usd: images, edits, edits_usd: editsUsd }
}

// Cabe mais um gasto de `estimate` dólares neste mês?
export async function fitsCap(admin: Any, companyId: string, estimate: number): Promise<{ ok: boolean; spend: MonthSpend }> {
  const spend = await monthSpend(admin, companyId)
  return { ok: spend.total_usd + estimate <= CLIENT_MONTHLY_CAP_USD, spend }
}

// Registra 1 edição de foto do Vault (pro teto e pro relatório de custo).
export async function logPhotoRetouch(admin: Any, companyId: string): Promise<void> {
  try {
    await admin.from('agent_performance').insert({
      company_id: companyId, agent_role: 'imagem', task_key: 'photo_retouch',
      task_description: 'Tratamento de foto real (Higgsfield)', success: true, cost_usd: HF_EDIT_COST_USD,
      latency_ms: 0, // coluna obrigatória no banco (sem ela o registro falhava calado — achado no teste de 2026-10-14)
    })
  } catch { /* nunca derruba a geração por causa do registro de custo */ }
}

export const capMessage = (cap = CLIENT_MONTHLY_CAP_USD) =>
  `O limite de gasto do mês (US$ ${cap.toFixed(0)}) foi atingido. Volta no próximo mês.`
