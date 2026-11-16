// Roda: node --experimental-strip-types scripts/test-activity-text.mjs
// I1 (16/11): mensagens fixas da Atividade em inglês, com o número preservado; "Use /relatorio" sai (Telegram desligado).
import assert from 'node:assert/strict'
const { activityText } = await import('../src/lib/activityText.ts')
const a = '🗓️ Sua semana está pronta: 7 post(s) planejado(s).\n\nVeja e aprove a semana inteira de uma vez em Central do dono → Aprovações. Cada post sai sozinho.'
assert.ok(activityText(a, 'en').startsWith('🗓️ Your week is ready: 7 post(s) planned.'))
assert.equal(activityText(a, 'pt'), a)
const b = '💰 Oportunidade detectada!\n1 nova(s) oportunidade(s) detectada(s)\nUse /relatorio para mais detalhes.'
assert.equal(activityText(b, 'en'), '💰 Opportunity detected!\n1 new opportunity(ies) detected')
assert.ok(!activityText(b, 'pt').includes('/relatorio'))
assert.equal(activityText('Texto livre da IA', 'en'), 'Texto livre da IA')
console.log('ok — atividade em inglês')
