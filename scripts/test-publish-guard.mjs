import assert from 'node:assert/strict'
// Roda: node --experimental-strip-types scripts/test-publish-guard.mjs
// Etapa 0 (2026-11-07): nenhuma publicação no Instagram sem aprovação humana.
import { publishBlockReason, publishes, humanApproved, HUMAN_APPROVAL_REQUIRED } from '../supabase/functions/_shared/publishGuard.ts'
let n = 0; const ok = (m) => { n++; console.log('ok -', m) }
const piece = { ref_type: 'marketing_ai_test_content', ref_id: 'p1' }
assert.equal(publishBlockReason({ ...piece, approval_status: 'AUTO_APPROVED', approved_by: null }), HUMAN_APPROVAL_REQUIRED); ok('modo automático (AUTO_APPROVED) nunca publica')
assert.equal(publishBlockReason({ ...piece, approval_status: 'APPROVED', approved_by: null }), HUMAN_APPROVAL_REQUIRED); ok('APPROVED sem quem aprovou não publica')
assert.equal(publishBlockReason({ ...piece, approval_status: 'PENDING', approved_by: null }), HUMAN_APPROVAL_REQUIRED); ok('pendente não publica')
assert.equal(publishBlockReason({ ...piece, approval_status: 'APPROVED', approved_by: 'u1' }), null); ok('aprovada por uma pessoa publica')
assert.equal(publishBlockReason({ ref_type: 'marketing_ai_content', ref_id: 'c1', approval_status: 'APPROVED', approved_by: 'u1' }), null); ok('conteúdo antigo aprovado por pessoa publica')
assert.equal(publishBlockReason({ ref_type: null, ref_id: null, approval_status: 'AUTO_APPROVED', approved_by: null }), null); ok('ação interna sem peça (ex.: rascunho) continua podendo rodar no automático')
assert.equal(publishes({ ref_type: 'marketing_ai_test_content', ref_id: null }), false); assert.equal(humanApproved({ approval_status: 'APPROVED', approved_by: '' }), false); ok('casos de borda')
console.log(`\n${n} verificações ok`)
