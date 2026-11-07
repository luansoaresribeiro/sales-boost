import assert from 'node:assert/strict'
// Roda: node --experimental-strip-types scripts/test-opportunity-merge.mjs
// Correção 3 (2026-11-06): oportunidade equivalente a uma ABERTA atualiza a linha em vez de inserir outra.
import { planUpserts, mergeEvidence, signalKeys, normAction } from '../supabase/functions/_shared/opportunityMerge.ts'
let n = 0; const ok = (m) => { n++; console.log('ok -', m) }

const sig = (url, text = 'Sinal.', host = 'jornal.com') => ({ type: 'data', text, source: `${host} (${url})`, date: '2026-11-01' })
const fact = (text) => ({ type: 'fact', text, source: 'Catálogo cadastrado no Sales Boost', date: null })
const hyp = (text) => ({ type: 'hypothesis', text, source: 'Hipótese do Sales Boost — ainda não verificada', date: null })
const draft = (over = {}) => ({ kind: 'content_gap', title: 'Novo título', description: 'Nova descrição.', commercial_problem: 'Novo problema.', evidence: [fact('F novo')], item_ids: ['a', 'b'], audience: 'quem busca', suggested_action: 'Nova ação.', how_to_measure: 'Nova medida.', confidence: 'medium', needs_validation: false, priority_rank: 1, priority_reasons: ['r novo'], ...over })
const row = (over = {}) => ({ id: 'r1', kind: 'content_gap', item_ids: ['b', 'a'], evidence: [fact('F velho')], confidence: 'medium', needs_validation: false, title: 'Título velho', description: 'Desc velha.', commercial_problem: 'Prob velho.', audience: null, suggested_action: 'Ação velha.', how_to_measure: 'Medida velha.', status: 'suggested', plan_generated_at: null, decided_at: null, ...over })
const plan = (drafts, rows) => planUpserts(drafts, rows, { runId: 'RUN2' })

// (a) mesmo sinal em rodadas seguidas → 2ª rodada atualiza, não insere; evidência antiga fica
{
  const old = row({ kind: 'market_change', item_ids: ['a'], evidence: [fact('Item A'), sig('https://www.jornal.com/x/?utm=1', 'Metrô novo')] })
  const d = draft({ kind: 'market_change', item_ids: ['a'], evidence: [fact('Item A'), sig('https://jornal.com/x', 'Metrô novo (texto relido)'), sig('https://outro.com/y', 'Outro dado')] })
  const r = plan([d], [old])
  assert.equal(r.inserts.length, 0); assert.equal(r.updates.length, 1); assert.equal(r.updates[0].id, 'r1')
  const ev = r.updates[0].patch.evidence
  assert.equal(ev[0].text, 'Item A'); assert.equal(ev[1].text, 'Metrô novo'); assert.ok(ev.some(e => e.text === 'Outro dado')); assert.ok(ev.some(e => e.text === 'Metrô novo (texto relido)'))
  assert.equal(r.updates[0].patch.run_id, 'RUN2'); assert.equal(r.updates[0].patch.title, 'Novo título')
  for (const k of ['status', 'created_at', 'id', 'item_ids', 'kind']) assert.equal(k in r.updates[0].patch, false)
  ok('(a) mesmo sinal na 2ª rodada → atualiza a linha aberta (0 inserts), evidência antiga mantida, status/itens/tipo intocados')
}

// (b) mesmos itens em oportunidades equivalentes → atualiza; tipo diferente → separado; market_change sem sinal comum → separado
{
  const r1 = plan([draft()], [row()]); assert.equal(r1.updates.length, 1); assert.equal(r1.inserts.length, 0) // título diferente não importa; itens em outra ordem
  const r2 = plan([draft({ kind: 'positioning' })], [row()]); assert.equal(r2.inserts.length, 1); assert.equal(r2.updates.length, 0)
  const r3 = plan([draft({ item_ids: ['a'] })], [row()]); assert.equal(r3.inserts.length, 1) // conjunto de itens diferente
  const mOld = row({ kind: 'market_change', evidence: [sig('https://a.com/1')] })
  const r4 = plan([draft({ kind: 'market_change', evidence: [sig('https://b.com/2')] })], [mOld]); assert.equal(r4.inserts.length, 1); assert.equal(r4.updates.length, 0)
  assert.equal(plan([draft({ kind: 'market_change', evidence: [{ type: 'data', text: 't', source: 'Folha', date: null }] })], [row({ kind: 'market_change', evidence: [{ type: 'data', text: 'u', source: ' folha ', date: null }] })]).updates.length, 1) // sem URL: fonte normalizada
  assert.equal(plan([draft({ kind: 'market_change', evidence: [fact('só fato')] })], [row({ kind: 'market_change', evidence: [fact('só fato')] })]).updates.length, 0) // fato do catálogo não é sinal externo
  ok('(b) mesmo tipo+itens atualiza (título nunca compara); tipo diferente e market_change sem fonte comum ficam separados')
}

// (f) forte × fraco
{
  const old = row({ confidence: 'high', evidence: [fact('E1'), hyp('H1')] })
  const lowNew = plan([draft({ confidence: 'low', evidence: [fact('E2')] })], [old]).updates[0].patch
  // decisão do dono (07/11): texto e confiança da leitura nova; evidência antiga sempre mantida
  assert.equal(lowNew.title, 'Novo título'); assert.equal(lowNew.confidence, 'low'); assert.equal(lowNew.suggested_action, 'Nova ação.')
  assert.match(plan([draft({ confidence: 'low', evidence: [fact('E2')] })], [old]).updates[0].reason, /confiança menor/)
  assert.deepEqual(lowNew.evidence.map(e => e.text), ['E1', 'E2', 'H1']); assert.equal(lowNew.run_id, 'RUN2'); assert.equal(lowNew.priority_rank, 1)
  const oldLow = row({ confidence: 'low', evidence: [fact('E1')] })
  const hiNew = plan([draft({ confidence: 'high', needs_validation: false })], [oldLow]).updates[0].patch
  assert.equal(hiNew.title, 'Novo título'); assert.equal(hiNew.confidence, 'high'); assert.equal(hiNew.suggested_action, 'Nova ação.'); assert.deepEqual(hiNew.priority_reasons, ['r novo'])
  assert.deepEqual(hiNew.evidence.map(e => e.text), ['E1', 'F novo'])
  const eq = plan([draft({ confidence: 'medium' })], [row({ confidence: 'medium' })]).updates[0].patch; assert.equal(eq.title, 'Novo título') // igual leva o novo
  const nv = plan([draft({ confidence: 'medium' })], [row({ confidence: 'needs_validation', needs_validation: true })]).updates[0].patch; assert.equal(nv.needs_validation, false)
  ok('(f) velha high + nova low → texto/confiança NOVOS, todas as evidências antigas mantidas; velha low + nova high → idem')
}

// (g) distintos legítimos + linhas protegidas
{
  const two = plan([draft({ kind: 'market_change', item_ids: ['a'], evidence: [sig('https://a.com/1')] }), draft({ kind: 'market_change', item_ids: ['c'], evidence: [sig('https://b.com/2')] })], [row({ kind: 'market_change', item_ids: ['z'], evidence: [sig('https://x.com/9')] })])
  assert.equal(two.inserts.length, 2); assert.equal(two.updates.length, 0)
  for (const over of [{ status: 'approved' }, { status: 'dismissed' }, { plan_generated_at: '2026-11-05T10:00:00Z' }, { decided_at: '2026-11-05T10:00:00Z' }]) {
    const r = plan([draft()], [row(over)]); assert.equal(r.updates.length, 0, JSON.stringify(over)); assert.equal(r.inserts.length, 1)
  }
  // uma linha aberta só é atualizada uma vez por rodada; o 2º rascunho igual é inserido
  const dup = plan([draft({ title: 'A' }), draft({ title: 'B' })], [row()]); assert.equal(dup.updates.length, 1); assert.equal(dup.inserts.length, 1); assert.equal(dup.updates[0].patch.title, 'A')
  // com 2 linhas abertas iguais, cada rascunho pega uma
  assert.equal(plan([draft(), draft()], [row(), row({ id: 'r2' })]).updates.map(u => u.id).join(), 'r1,r2')
  // linha aprovada não bloqueia a aberta equivalente
  assert.equal(plan([draft()], [row({ id: 'ap', status: 'approved' }), row({ id: 'op' })]).updates[0].id, 'op')
  ok('(g) market_change com itens/sinais diferentes insere os dois; aprovada/descartada/com plano/decidida nunca é atualizada; linha só é usada uma vez')
}

// utilitários: evidência
{
  const many = [...Array.from({ length: 10 }, (_, i) => hyp(`H${i}`)), ...Array.from({ length: 5 }, (_, i) => fact(`F${i}`))]
  const m = mergeEvidence(many, [fact('F0'), fact(' f1 ')])
  assert.equal(m.length, 12); assert.equal(m.filter(e => e.type === 'fact').length, 5); assert.ok(m.slice(0, 5).every(e => e.type === 'fact')); assert.equal(m.filter(e => e.text.startsWith('F')).length, 5)
  assert.deepEqual([...signalKeys([sig('https://www.A.com/x/#h'), fact('x')])], ['a.com/x'])
  assert.equal(normAction('  Adicionar fotos,  reais. '), 'adicionar fotos, reais')
  ok('evidência: sem duplicata, antigas primeiro, teto 12 com todos os fatos antes das hipóteses; chave de sinal pela URL normalizada')
}
console.log(`\n${n} grupos ok`)
