import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
// Roda: node --experimental-strip-types scripts/test-client-report.mjs
// Relatório do cliente chega ao e-mail do dono, pronto para encaminhar (dono 24/11). Só números reais.
import { buildReportEmail, emailsReport, factLines } from '../supabase/functions/_shared/clientReport.ts'
let n = 0; const ok = (m) => { n++; console.log('ok -', m) }

const facts = { published: 2, generated: 7, waitingApproval: 12, overdue: 7, opportunitiesNew: 3, leads: 0, visits: 0 }
const lines = factLines(facts)
assert.ok(lines.includes('Posts publicados no Instagram: 2')); assert.ok(lines.includes('Peças que passaram da data sem aprovação: 7')); ok('linhas com os números reais')
assert.ok(!factLines({ ...facts, overdue: 0 }).some(l => l.includes('passaram da data'))); ok('sem vencidos, a linha não aparece')
assert.ok(lines.includes('Leads recebidos: 0') && lines.includes('Visitas marcadas: 0')); ok('zero medido aparece como zero (é dado real)')

const mail = buildReportEmail({ company: 'A3 Imóveis', periodLabel: 'Semanal', dateStr: '24 de novembro de 2026', report: 'Texto do relatório.\n— Equipe Sales Boost', facts })
assert.equal(mail.subject, 'Relatório semanal — A3 Imóveis (pronto para encaminhar)'); ok('assunto diz que é para encaminhar')
assert.ok(mail.text.startsWith('Para você:')); assert.ok(mail.text.includes('apague este aviso antes')); ok('aviso ao dono no topo')
assert.ok(mail.text.includes('Texto do relatório.') && mail.text.includes('• Visitas marcadas: 0')); ok('relatório + números no corpo')

const A3 = 'd1987797-2ec0-49ed-ab40-09abaf586301'
assert.equal(emailsReport([A3], A3), true); assert.equal(emailsReport([], A3), false); assert.equal(emailsReport(null, A3), false); ok('só conta da lista recebe e-mail (opt-in)')

const src = readFileSync(new URL('../supabase/functions/periodic-report/index.ts', import.meta.url), 'utf8')
assert.ok(!/from\('opportunities'\)|from\('reviews'\)|status === 'publicado'/.test(src)); ok('relatório não usa mais as tabelas antigas')
assert.ok(/sendOwnerEmail\(/.test(src) && !/to: \[?company/.test(src)); ok('e-mail vai ao dono, nunca ao cliente')
const helper = readFileSync(new URL('../supabase/functions/_shared/ownerEmail.ts', import.meta.url), 'utf8')
assert.ok(/eq\('role', 'owner'\)/.test(helper)); ok('destinatário = dono (user_roles owner)')
console.log(`\n${n} testes ok`)
