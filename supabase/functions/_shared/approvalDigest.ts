// Lembrete diário das aprovações paradas (dono, 24/11: "pode preparar o lembrete por e-mail da A3").
// Vai SÓ para o dono (e-mail de alerta do monitor), nunca para o cliente. Só entram as contas listadas em
// monitor_config.approval_digest_companies (opt-in explícito — a Liga dos Sonhos nunca é lida).
// Funções PURAS; teste em scripts/test-approval-digest.mjs.

export interface DigestRow { name: string; overdue: number; nextDays: number; oldestOverdue: string | null }

/** Dia de hoje no horário de Brasília (YYYY-MM-DD). */
export function todayBRT(now: Date = new Date()): string {
  return new Date(now.getTime() - 3 * 3600_000).toISOString().slice(0, 10)
}

/** Hora atual em Brasília (0–23). */
export function hourBRT(now: Date = new Date()): number {
  return new Date(now.getTime() - 3 * 3600_000).getUTCHours()
}

/** Manda hoje? Uma vez por dia, a partir das 9h de Brasília, só com contas configuradas. */
export function digestDue(a: { companies: unknown; sentOn: string | null; now?: Date }): boolean {
  const list = Array.isArray(a.companies) ? a.companies : []
  const now = a.now ?? new Date()
  return list.length > 0 && hourBRT(now) >= 9 && a.sentOn !== todayBRT(now)
}

const fmt = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}`

/** Texto do e-mail. Nada parado em nenhuma conta = null (não manda e-mail vazio). */
export function buildApprovalDigest(rows: DigestRow[]): string | null {
  const bad = rows.filter(r => r.overdue > 0 || r.nextDays > 0)
  if (!bad.length) return null
  const lines = bad.map(r => {
    const parts: string[] = []
    if (r.overdue > 0) parts.push(`${r.overdue} ${r.overdue === 1 ? 'post passou' : 'posts passaram'} da data sem aprovação${r.oldestOverdue ? ` (o mais antigo era para ${fmt(r.oldestOverdue)})` : ''}`)
    if (r.nextDays > 0) parts.push(`${r.nextDays} ${r.nextDays === 1 ? 'post espera' : 'posts esperam'} aprovação para os próximos 7 dias`)
    return `• ${r.name}: ${parts.join('; ')}.`
  })
  const anyOverdue = bad.some(r => r.overdue > 0)
  return [
    `📋 Aprovações paradas${anyOverdue ? ' (há posts vencidos)' : ''}`,
    '',
    ...lines,
    '',
    'Post vencido não vai ao ar: o cliente precisa aprovar em Aprovações (ou recusar) para o calendário andar.',
    'Este lembrete é só para você. O cliente não recebe nada.',
  ].join('\n')
}
