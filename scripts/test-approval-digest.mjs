import assert from 'node:assert/strict'
// Roda: node --experimental-strip-types scripts/test-approval-digest.mjs
// Lembrete diário das aprovações paradas (dono 24/11): só para o dono, uma vez por dia, só nas contas listadas.
import { buildApprovalDigest, digestDue, hourBRT, todayBRT } from '../supabase/functions/_shared/approvalDigest.ts'
let n = 0; const ok = (m) => { n++; console.log('ok -', m) }

const at = (iso) => new Date(iso)
assert.equal(todayBRT(at('2026-11-25T02:00:00Z')), '2026-11-24'); ok('dia em Brasília (UTC-3)')
assert.equal(hourBRT(at('2026-11-24T12:00:00Z')), 9); ok('hora em Brasília')
const A3 = ['d1987797-2ec0-49ed-ab40-09abaf586301']
assert.equal(digestDue({ companies: A3, sentOn: null, now: at('2026-11-24T12:05:00Z') }), true); ok('manda depois das 9h quando ainda não mandou hoje')
assert.equal(digestDue({ companies: A3, sentOn: '2026-11-24', now: at('2026-11-24T15:00:00Z') }), false); ok('no máximo 1 e-mail por dia')
assert.equal(digestDue({ companies: A3, sentOn: null, now: at('2026-11-24T10:00:00Z') }), false); ok('não manda de madrugada (antes das 9h)')
assert.equal(digestDue({ companies: [], sentOn: null, now: at('2026-11-24T12:05:00Z') }), false); ok('sem conta na lista = não manda (opt-in)')
assert.equal(digestDue({ companies: null, sentOn: null }), false); ok('config ausente = não manda')

const t = buildApprovalDigest([{ name: 'A3 Imóveis', overdue: 7, nextDays: 5, oldestOverdue: '2026-11-17' }])
assert.ok(t.startsWith('📋 Aprovações paradas (há posts vencidos)'))
assert.ok(t.includes('A3 Imóveis: 7 posts passaram da data sem aprovação (o mais antigo era para 17/11); 5 posts esperam aprovação para os próximos 7 dias.'))
assert.ok(t.includes('O cliente não recebe nada')); ok('texto com vencidos, próximos e o aviso de que o cliente não recebe')
assert.ok(buildApprovalDigest([{ name: 'X', overdue: 1, nextDays: 0, oldestOverdue: null }]).includes('1 post passou da data')); ok('singular')
assert.equal(buildApprovalDigest([{ name: 'X', overdue: 0, nextDays: 0, oldestOverdue: null }]), null); ok('nada parado = sem e-mail')
console.log(`\n${n} testes ok`)
