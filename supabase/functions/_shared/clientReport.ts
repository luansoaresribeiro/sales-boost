// Relatório periódico do CLIENTE (dono, 24/11: "os relatórios devem ser enviados pelo dono por e-mail" → passo 1:
// chega ao e-mail do dono, pronto para encaminhar). Funções PURAS; teste em scripts/test-client-report.mjs.
// Regra 5: só número que veio do banco; o que não é medido fica de fora (nunca vira 0 inventado).

export interface ReportFacts {
  published: number          // posts que foram ao Instagram no período
  generated: number          // peças criadas no período
  waitingApproval: number    // peças prontas esperando aprovação agora
  overdue: number            // peças que passaram da data sem aprovação
  opportunitiesNew: number   // oportunidades novas no período
  leads: number              // leads recebidos no período
  visits: number             // visitas marcadas no período (visit_at)
}

/** Linhas de dados que vão para o texto da IA (e para o e-mail). */
export function factLines(f: ReportFacts): string[] {
  const out = [
    `Posts publicados no Instagram: ${f.published}`,
    `Peças criadas pela plataforma: ${f.generated}`,
    `Peças prontas esperando a sua aprovação: ${f.waitingApproval}`,
  ]
  if (f.overdue > 0) out.push(`Peças que passaram da data sem aprovação: ${f.overdue}`)
  out.push(`Oportunidades de mercado novas: ${f.opportunitiesNew}`)
  out.push(`Leads recebidos: ${f.leads}`)
  out.push(`Visitas marcadas: ${f.visits}`)
  return out
}

/** Assunto e corpo do e-mail ao dono. O texto do relatório vai depois de um aviso curto (apagar antes de encaminhar). */
export function buildReportEmail(a: { company: string; periodLabel: string; dateStr: string; report: string; facts: ReportFacts }): { subject: string; text: string } {
  const subject = `Relatório ${a.periodLabel.toLowerCase()} — ${a.company} (pronto para encaminhar)`
  const text = [
    `Para você: relatório ${a.periodLabel.toLowerCase()} da ${a.company}. Revise e encaminhe ao cliente (apague este aviso antes).`,
    '',
    '────────────────────────',
    '',
    `Relatório ${a.periodLabel} — ${a.company} — ${a.dateStr}`,
    '',
    a.report.trim(),
    '',
    'Os números do período:',
    ...factLines(a.facts).map(l => `• ${l}`),
  ].join('\n')
  return { subject, text }
}

/** A empresa está na lista de quem recebe o e-mail (opt-in do dono)? */
export function emailsReport(list: unknown, companyId: string): boolean {
  return Array.isArray(list) && list.includes(companyId)
}

/** Contas que geram relatório: só as da lista do dono; com company_id explícito, só se ele estiver na lista. */
export function reportCompanies(list: unknown, companyId?: string | null): string[] {
  const ids = Array.isArray(list) ? list.filter((x): x is string => typeof x === 'string') : []
  return companyId ? ids.filter(x => x === companyId) : ids
}
