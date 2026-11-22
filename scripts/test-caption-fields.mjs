import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
// Roda: node --experimental-strip-types scripts/test-caption-fields.mjs
// Pontos fortes, item 1 (22/11): vista, lazer, andar, vagas e o detalhe do cadastro chegam à legenda do pacote do imóvel.
import { captionFieldsFrom, captionExtrasLine } from '../supabase/functions/_shared/captionFields.ts'
let n = 0; const ok = (m) => { n++; console.log('ok -', m) }

const mig = readFileSync(new URL('../supabase/migrations/20261122120000_legenda_campos_diferenciais.sql', import.meta.url), 'utf8')
const keys = JSON.parse(mig.match(/'(\[.*?\])'::jsonb/)[1])
const catalog_fields = { required: [{ key: 'tipo', label: { pt: 'Tipo', en: 'Type' } }], optional: [
  { key: 'vagas', label: { pt: 'Vagas de garagem', en: 'Parking spots' } }, { key: 'andar', label: { pt: 'Andar', en: 'Floor' } },
  { key: 'vista', label: { pt: 'Vista', en: 'View' } }, { key: 'lazer', label: { pt: 'Lazer / Amenidades', en: 'Amenities' } },
  { key: 'detalhe_que_ninguem_percebe', label: { pt: 'Um detalhe que ninguém percebe de cara', en: 'A detail' } },
  { key: 'endereco', label: { pt: 'Endereço' }, private: true }] }
const defs = captionFieldsFrom({ caption_fields: [...keys, 'endereco', 'nao_existe'], catalog_fields })
assert.deepEqual(defs.map(d => d.key), ['vista', 'lazer', 'andar', 'vagas', 'detalhe_que_ninguem_percebe']); ok('a migration traz os 5 campos; endereço (privado) e chave sem definição ficam de fora')
assert.equal(defs[1].label, 'Lazer / Amenidades'); ok('rótulo vem da ficha')
assert.equal(captionFieldsFrom({ caption_fields: ['vista'], catalog_fields }, 'en')[0].label, 'View'); ok('rótulo em inglês quando pedido')
const line = captionExtrasLine({ vista: 'Mar', lazer: '  piscina,\n academia ', andar: 12, vagas: 0, detalhe_que_ninguem_percebe: '', endereco: 'Rua X, 10' }, defs)
assert.match(line, /Vista: Mar · Lazer \/ Amenidades: piscina, academia · Andar: 12 · Vagas de garagem: 0/); ok('só o que o corretor preencheu, na ordem da ficha, espaços limpos (0 vagas também é dado)')
assert.ok(!/Rua X/.test(line) && !/detalhe/i.test(line)); ok('endereço nunca entra; campo vazio não aparece')
assert.match(line, /use só o que está aqui, sem acrescentar/); ok('o prompt manda não acrescentar nada')
assert.equal(captionExtrasLine({ vista: 'Mar' }, []), ''); assert.equal(captionExtrasLine({}, defs), ''); ok('sem ficha ou sem dado: nada muda')
assert.deepEqual(captionFieldsFrom(null), []); ok('ficha sem caption_fields = lista vazia')
const src = readFileSync(new URL('../supabase/functions/catalog-package/index.ts', import.meta.url), 'utf8')
assert.ok(/captionExtrasLine\(fields, ficha\.captionFields\)/.test(src)); ok('catalog-package usa a linha extra no fieldsLine')
console.log(`\n${n} ok`)
