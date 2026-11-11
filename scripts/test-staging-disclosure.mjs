// Roda: node --experimental-strip-types scripts/test-staging-disclosure.mjs
// Aviso de foto mobiliada virtualmente garantido ao publicar (Etapa 2 do Tour virtual, 2026-11-11).
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { hasDisclosure, ensureDisclosure, usesStaged, STAGING_CHECK_FAILED, STAGING_NO_DISCLOSURE } from '../supabase/functions/_shared/stagingDisclosure.ts'

let n = 0
const t = (name, fn) => { fn(); n++; console.log('ok -', name) }
const D = '📌 Imagem mobiliada virtualmente — os móveis são ilustrativos e não fazem parte do imóvel.'

t('acrescenta o aviso uma vez só', () => {
  const c = ensureDisclosure('Apê com vista.', D)
  assert.equal(c, `Apê com vista.\n\n${D}`)
  assert.equal(ensureDisclosure(c, D), c)
})
t('reconhece o aviso mesmo com maiúscula, acento ou espaço diferente', () => {
  assert.ok(hasDisclosure('texto\n📌 IMAGEM  mobiliada virtualmente — os moveis sao ilustrativos e nao fazem parte do imovel.', D))
  assert.ok(!hasDisclosure('Os móveis são lindos.', D))
})
t('legenda apagada pelo dono: o aviso volta', () => {
  assert.equal(ensureDisclosure('', D), D)
})
t('texto longo: corta a legenda, nunca o aviso, e deixa espaço pro rodapé do CRECI', () => {
  const c = ensureDisclosure('x'.repeat(3000), D)
  assert.ok(c.endsWith(D)); assert.ok(c.length <= 2200 - 80)
})
t('aviso vazio na chamada: não mexe na legenda', () => { assert.equal(ensureDisclosure('Oi', '  '), 'Oi') })
t('foto mobiliada no post: detecta só pela URL das mobiliadas deste imóvel', () => {
  assert.ok(usesStaged(['https://x/real1.jpg', 'https://x/staged.jpg'], ['https://x/staged.jpg']))
  assert.ok(!usesStaged(['https://x/real1.jpg'], ['https://x/staged.jpg', '']))
  assert.ok(!usesStaged([], ['https://x/staged.jpg']))
})
t('agent-actions: confere antes de publicar, recusa em falha (fechada) e o CRECI vem depois do aviso', () => {
  const src = readFileSync(new URL('../supabase/functions/agent-actions/index.ts', import.meta.url), 'utf8')
  const vault = src.slice(src.indexOf("if (act.ref_type === 'marketing_ai_test_content' && act.ref_id) {"), src.indexOf('publishCarouselToInstagram(String(company'))
  assert.match(vault, /const stg = await stagingCheck\(admin, act\.company_id, p\.item_id/)
  assert.match(vault, /if \(stg\.block\) \{ await back\(\); return await fail\(stg\.block\) \}/)
  assert.match(vault, /withLicense\(stg\.disclosure \? ensureDisclosure\(base, stg\.disclosure\) : base\)/)
  assert.ok(vault.indexOf('stagingCheck') < vault.indexOf('createMediaContainer') || !vault.includes('createMediaContainer'))
  const mod = readFileSync(new URL('../supabase/functions/_shared/stagingDisclosure.ts', import.meta.url), 'utf8')
  assert.match(mod, /if \(error\) return \{ block: STAGING_CHECK_FAILED \}/); assert.match(mod, /catch \{ return \{ block: STAGING_CHECK_FAILED \} \}/)
  assert.ok(STAGING_NO_DISCLOSURE.includes('Nada foi publicado'))
})
t('página pública e tour nunca usam foto mobiliada', () => {
  const pp = readFileSync(new URL('../supabase/functions/_shared/publicPage.ts', import.meta.url), 'utf8')
  assert.match(pp, /staged_photos` \(mobiliado por IA\) NUNCA entra/)
  const iv = readFileSync(new URL('../supabase/functions/item-videos/index.ts', import.meta.url), 'utf8')
  assert.doesNotMatch(iv, /staged_photos/)
})
console.log(`\n${n} verificações ok`)
