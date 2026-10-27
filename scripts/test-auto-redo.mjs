// Roda: node --experimental-strip-types scripts/test-auto-redo.mjs
// Testa quando a peça com nota ruim pode ser refeita sozinha (_shared/autoRedo.ts) — no máximo 1 vez.
import assert from 'node:assert/strict'
import { autoRedoEligible, newNumbers } from '../supabase/functions/_shared/autoRedo.ts'

let n = 0
const t = (name, fn) => { fn(); n++; console.log('ok -', name) }
const bad = { status: 'draft', scores: { coherence: { score: 30 } }, brief: { template: 'livre' }, item_id: null, recipe: null }

t('texto incoerente, sem imóvel nem vídeo: pode refazer', () => assert.equal(autoRedoEligible(bad).ok, true))
t('já refeita uma vez: nunca de novo', () => {
  const r = autoRedoEligible({ ...bad, brief: { ...bad.brief, auto_redo: true } })
  assert.equal(r.ok, false); assert.match(r.reason, /1 vez/)
})
t('já no Vault ou nota boa ou só problema visual: não mexe', () => {
  assert.equal(autoRedoEligible({ ...bad, status: 'vault' }).ok, false)
  assert.equal(autoRedoEligible({ ...bad, scores: { coherence: { score: 80 } } }).ok, false)
  assert.equal(autoRedoEligible({ ...bad, scores: { visual_coherence: { score: 10 } } }).ok, false)
  assert.equal(autoRedoEligible({ ...bad, scores: null }).ok, false)
})
t('peça de imóvel, pacote ou vídeo (custo Higgsfield/dado real): não refaz', () => {
  assert.equal(autoRedoEligible({ ...bad, item_id: 'abc' }).ok, false)
  assert.equal(autoRedoEligible({ ...bad, recipe: 'video_imovel' }).ok, false)
})
t('carrossel de tema regulado: não refaz; geral/leve pode', () => {
  assert.equal(autoRedoEligible({ ...bad, brief: { deck_source: { mode: 'regulado' } } }).ok, false)
  assert.equal(autoRedoEligible({ ...bad, brief: { deck_source: { mode: 'geral' } } }).ok, true)
})
t('reescrita não pode inventar número', () => {
  assert.deepEqual(newNumbers('Visita 10 min, 3 fotos', 'Visita em 10 min, 3 fotos'), [])
  assert.deepEqual(newNumbers('Taxa baixa', 'Taxa de 8,5% ao ano'), ['85'])
  assert.deepEqual(newNumbers('Preço R$ 1.500', 'Por apenas 1500 reais'), [])
})
console.log(`\n${n} grupos OK`)
