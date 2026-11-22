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

// ── Item 2 (22/11): caixinhas de pontos fortes ─────────────────────────────────────────────────────────────────────
{
  const mig2 = readFileSync(new URL('../supabase/migrations/20261122130000_pontos_fortes_marcas.sql', import.meta.url), 'utf8')
  const added = JSON.parse(mig2.match(/\$json\$(\[[\s\S]*?\])\$json\$/)[1])
  assert.deepEqual(added.map(f => f.key), ['pontos_localizacao', 'pontos_imovel', 'pontos_para_quem']); assert.ok(added.every(f => f.type === 'multi_select' && f.options.every(o => o.pt && o.en)))
  ok('3 campos de marcar na ficha, cada opção em pt e en')
  assert.equal(added.reduce((a, f) => a + f.options.length, 0), 21); ok('21 marcas = a lista aprovada (6 + 10 com a vista separada em 3 + 5)')
  assert.ok(/'\["pontos_localizacao","pontos_imovel"\]'/.test(mig2) && !/caption_fields.*pontos_para_quem/.test(mig2)); ok('"para quem é" NÃO entra na legenda (só tom)')
  const cf = { optional: [...catalog_fields.optional, ...added] }
  const d2 = captionFieldsFrom({ caption_fields: ['vista', 'pontos_localizacao', 'pontos_imovel'], catalog_fields: cf })
  const l2 = captionExtrasLine({ vista: 'Mar', pontos_imovel: ['Varanda', 'Andar alto'], pontos_localizacao: [] }, d2)
  assert.match(l2, /Vista: Mar · Pontos fortes: imóvel: Varanda, Andar alto/); assert.ok(!/localização/.test(l2)); ok('marcas entram na legenda como lista; lista vazia não aparece')
  const vp = readFileSync(new URL('../src/lib/verticalPlaybook.ts', import.meta.url), 'utf8')
  assert.match(vp, /f\.type === 'multi_select'[\s\S]{0,400}allowed\.has\(v\)[\s\S]{0,120}new Set\(arr\)\]\.slice\(0, 15\)/); ok('ao salvar: só opção da ficha, sem repetir, no máximo 15 (sanitizeCatalogValues)')
  const ed = readFileSync(new URL('../src/pages/dashboard/marketingAi/CatalogItemEditor.tsx', import.meta.url), 'utf8')
  assert.match(ed, /field\.type === 'multi_select'[\s\S]{0,800}aria-pressed=\{on\}/); ok('tela: caixinhas de marcar (aria-pressed) no editor e no cadastro')
  const { itemFacts } = await import('../supabase/functions/_shared/claimLock.ts')
  assert.ok(itemFacts('Apto', { pontos_imovel: ['Vista para o mar'] }).texts.includes('Vista para o mar')); ok('marca do cadastro conta como fato (trava de afirmação não corta)')
}
console.log(`\n${n} ok (com o item 2)`)
