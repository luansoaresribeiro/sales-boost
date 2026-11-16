// Roda: node scripts/test-content-lang.mjs
// I2 (16/11): o conteúdo dos agentes sai no idioma da conta (companies.language), escolhido no cadastro.
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
const read = p => readFileSync(p, 'utf8')

// Cadastro: pergunta de idioma dos posts nos dois idiomas da tela e enviada no onboarding_context
const ob = read('src/pages/onboarding/OnboardingPage.tsx')
assert.ok(ob.includes("postLang: 'Em que idioma seus posts devem sair?'"))
assert.ok(ob.includes("postLang: 'What language should your posts be in?'"))
assert.ok(ob.includes('content_language: contentLang'))
assert.ok(ob.includes('const contentLang = postLang ?? lang'))           // padrão = idioma da tela
assert.equal((ob.match(/label=\{t\.postLang\}/g) ?? []).length, 2)    // diagnóstico novo e antigo

// Criar a conta: grava companies.language DEPOIS do insert (o gatilho do setor sobrescreve no INSERT)
const cd = read('supabase/functions/claim-diagnostic/index.ts')
assert.ok(cd.includes("v === 'pt' || v === 'en' ? v : null"))
const ins = cd.indexOf(".from('companies')\n        .insert(")
const upd = cd.indexOf(".from('companies').update({ language: contentLang })")
assert.ok(ins > 0 && upd > ins)

// Os 3 agentes que escreviam sempre em português agora leem o idioma da conta
const st = read('supabase/functions/strategy-generate/index.ts')
assert.ok(/language\?: string \| null/.test(st) && st.includes(', language') && st.includes('INGLÊS'))
const cp = read('supabase/functions/catalog-package/index.ts')
assert.ok(cp.includes("lang: 'pt' | 'en' = 'pt'") && cp.includes("String(company.language ?? '').toLowerCase().startsWith('en') ? 'en' : 'pt'"))
const ti = read('supabase/functions/generate-tab-insight/index.ts')
assert.ok(ti.includes('language') && ti.includes('INGLÊS'))
console.log('ok — idioma dos posts: pergunta no cadastro, gravado na conta e respeitado por estratégia, pacote do imóvel e insights')
