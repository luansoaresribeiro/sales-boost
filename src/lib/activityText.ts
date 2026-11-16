// Mensagens fixas da Atividade (bot_notifications) em inglês (I1, 16/11). Elas são gravadas em português pelo servidor;
// na tela em inglês, cada frase conhecida é trocada pela versão em inglês, mantendo os números. Texto que não está na lista
// (ex.: relatório escrito pela IA) aparece como foi gravado. "Use /relatorio" sai nos dois idiomas: o Telegram está desligado.
type Rule = [RegExp, string | ((...m: string[]) => string)]

const EN: Rule[] = [
  [/^📝 O agente criou (\d+) post\(s\) novo\(s\)$/m, (_, n) => `📝 The agent created ${n} new post(s)`],
  [/^Motivo: Calendário da semana planejado$/m, 'Reason: weekly calendar planned'],
  [/^Aprove em Posts\.$/m, 'Approve them in Approvals.'],
  [/^🗓️ Sua semana está pronta: (\d+) post\(s\) planejado\(s\)\.$/m, (_, n) => `🗓️ Your week is ready: ${n} post(s) planned.`],
  [/^Veja e aprove a semana inteira de uma vez em Central do dono → Aprovações\..*$/m, 'Review and approve the whole week at once in Owner hub → Approvals. Each post goes out on its own day, and you can remove or cancel any of them.'],
  [/^🤖 O agente executou uma ação: Geração semanal automática de ideias \(Creative Agent, com base em tendências reais do segmento\)\.$/m, '🤖 The agent took an action: weekly automatic idea generation (Creative Agent, based on real industry trends).'],
  [/^🤖 O agente executou uma ação: (.*)$/m, (_, a) => `🤖 The agent took an action: ${a}`],
  [/^💰 Oportunidade detectada!$/m, '💰 Opportunity detected!'],
  [/^(\d+) nova\(s\) oportunidade\(s\) detectada\(s\)$/m, (_, n) => `${n} new opportunity(ies) detected`],
  [/^🧭 Há uma proposta de mudança na sua estratégia esperando você\. Abra a tela Estratégia para aprovar ou descartar\.$/m, '🧭 A proposed change to your strategy is waiting for you. Open the Strategy screen to approve or dismiss it.'],
  [/^Nova atualização do Sales Boost\.$/m, 'New Sales Boost update.'],
  [/^📋 Relatório Semanal • /m, '📋 Weekly report • '],
  [/^📋 Relatório Mensal • /m, '📋 Monthly report • '],
]

export function activityText(message: string, lang: 'pt' | 'en'): string {
  let out = message.replace(/\n?Use \/relatorio para mais detalhes\.?/g, '')
  if (lang !== 'en') return out
  for (const [re, to] of EN) out = out.replace(new RegExp(re.source, 'gm'), to as string)
  return out
}
