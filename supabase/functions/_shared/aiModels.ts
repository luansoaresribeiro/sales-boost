// Modelo da IA por tipo de tarefa (economia de IA, dono 23/11: "gostei do modelo mais barato em coisas menos importantes").
// Um lugar só: trocar de modelo é mudar AQUI. Teste: scripts/test-ai-models.mjs.
//  - ESCRITA: o que o cliente lê e o que decide o negócio (legenda, estratégia, oportunidades, mercado) → Sonnet.
//  - APOIO: nota de qualidade, lições, checagens e classificações internas → Haiku (≈20x mais barato que o Sonnet).
// Os dois rodam SEM raciocínio estendido (respostas curtas e diretas, custo previsível): no Sonnet 5.5 isso é
// `thinking: {type: 'between_tools'}` (o 'disabled' dá erro 400 nele); no Haiku 5.5 é `{type: 'disabled'}`.
// Nenhum dos dois aceita `temperature` diferente do padrão nem resposta pré-preenchida — o código não usa nenhum dos dois.
export const MODEL_WRITE = 'claude-sonnet-5-5'
export const MODEL_SUPPORT = 'claude-haiku-5-5'

/** Configuração de "sem raciocínio estendido" que cada modelo aceita (undefined = modelo antigo, não manda nada). */
export function thinkingOff(model: string): { type: string } | undefined {
  if (model.startsWith('claude-sonnet-5-5')) return { type: 'between_tools' }
  if (model.startsWith('claude-haiku-5-5')) return { type: 'disabled' }
  return undefined
}

/** Corpo do pedido à API de mensagens: junta o modelo, o resto do pedido e o "sem raciocínio" certo. */
export function claudeBody(model: string, rest: Record<string, unknown>): Record<string, unknown> {
  const t = thinkingOff(model)
  return { model, ...rest, ...(t ? { thinking: t } : {}) }
}

/** Texto da resposta, lido pelo tipo do bloco (modelo novo pode devolver um bloco de raciocínio antes do texto). */
export function textOf(data: unknown): string {
  const blocks = (data && typeof data === 'object' ? (data as { content?: unknown }).content : null)
  if (!Array.isArray(blocks)) return ''
  return blocks.filter((b): b is { type: string; text: string } => !!b && (b as { type?: unknown }).type === 'text' && typeof (b as { text?: unknown }).text === 'string').map(b => b.text).join('')
}
