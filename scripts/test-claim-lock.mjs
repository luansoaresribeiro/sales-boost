import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
// Roda: node --experimental-strip-types scripts/test-claim-lock.mjs
// Trava de afirmação de mercado do calendário (claimLock.ts). Os termos vêm das MIGRATIONS de verdade
// (a lista antiga de 29/10 + os termos acrescentados em 02/11), como a ficha de produção ficará depois de aplicar.
import { qualityFlags, QUALITY_PENALTY, claimCtx, claimIssues, claimNotice, cutClaims, cutHashtags, cutSlide, itemFacts, lockDeckClaims, lockText, PRICE_RANGE_ISSUE, textIssues } from '../supabase/functions/_shared/claimLock.ts'

let n = 0; const ok = (m) => { n++; console.log('ok -', m) }

// ── ficha = lista antiga + termos novos, mesclados SEM duplicar (é o que o SQL faz) ───────────────────────────────
const oldSql = readFileSync(new URL('../supabase/migrations/20261029130000_oportunidade_pecas.sql', import.meta.url), 'utf8')
const newSql = readFileSync(new URL('../supabase/migrations/20261102120000_carrosseis_qualidade.sql', import.meta.url), 'utf8')
const oldPt = JSON.parse(oldSql.split('$json$')[3]).pt
const arrays = [...newSql.matchAll(/\$json\$(\[.*?\])\$json\$/g)].map(m => JSON.parse(m[1]))
assert.equal(arrays.length, 2, 'a migration traz uma lista pt e uma en')
const merge = (oldList, add) => [...new Map([...oldList, ...add].map(t => [t, t])).values()]
const TERMS = merge(oldPt, arrays[0])
assert.equal(TERMS.length, new Set(TERMS).size); ok('mesclagem de array não duplica (rodar 2x dá o mesmo)')
assert.deepEqual(merge(TERMS, arrays[0]), TERMS); ok('2ª aplicação = mesma lista (idempotente)')
assert.ok(oldPt.every(t => TERMS.includes(t)) && TERMS.indexOf('luxo') === oldPt.indexOf('luxo')); ok('termos antigos e a ordem deles ficam')

const empty = claimCtx('pt', [], [], TERMS)   // educativo sem imóvel: nenhum fato
const bad = [
  'Imóveis acima de R$ 1,5 mi são raros.',
  'Um dos m² mais valorizados do Rio.',
  'Vale cada centavo.',
  'Os endereços mais desejados da cidade.',
]
for (const f of bad) assert.ok(claimIssues(f, empty).length > 0, f)
ok('as 4 frases do relato são barradas sem imóvel cadastrado')
assert.ok(claimIssues('Imóveis acima de R$ 1,5 mi são raros.', empty).includes(PRICE_RANGE_ISSUE)); ok('faixa de preço sem fonte é apontada como tal')
assert.ok(claimIssues('Apartamento de 3 quartos na Barra.', empty).length === 0 && claimIssues('Dicas para quem vai financiar.', empty).length === 0); ok('frase factual / educativa comum passa')

// ── fatos do imóvel liberam termo e valor ────────────────────────────────────────────────────────────────────────
const f = itemFacts('Cobertura duplex de luxo', { tipo: 'Cobertura', bairro: 'Leblon', preco: '1500000', quartos: '3', descricao: 'Acabamento de luxo.' }, { price: 'preco', bedrooms: 'quartos' })
const ctx = claimCtx('pt', f.texts, f.nums, TERMS)
assert.equal(claimIssues('Acabamento de luxo no Leblon.', ctx).length, 0); ok('"luxo" liberado porque o cadastro traz a palavra')
assert.ok(claimIssues('Um endereço nobre.', ctx).length > 0); ok('"nobre" continua barrado se o cadastro não traz')
assert.equal(claimIssues('Imóvel acima de R$ 1,5 mi no Leblon.', ctx).length, 0); ok('faixa liberada quando o valor (com unidade) está no cadastro')
assert.ok(claimIssues('Imóveis acima de R$ 2 mi no Leblon.', ctx).includes(PRICE_RANGE_ISSUE)); ok('outro valor continua barrado')
const pExato = claimIssues('Por R$ 1,5 mi.', empty); assert.equal(pExato.length, 0); ok('preço sozinho (sem faixa) não é afirmação de mercado — a trava de número cuida dele')

// ── corte só da frase, parágrafos ficam ──────────────────────────────────────────────────────────────────────────
const cap = 'Cobertura linda no Leblon. Vale cada centavo!\n\nChama no direct para visitar.'
const cut = cutClaims(cap, empty)
assert.equal(cut.text, 'Cobertura linda no Leblon.\n\nChama no direct para visitar.'); assert.deepEqual(cut.removed, ['Vale cada centavo!']); ok('corta só a frase e mantém os parágrafos')

// ── notice ───────────────────────────────────────────────────────────────────────────────────────────────────────
assert.match(claimNotice(['Vale cada centavo!']), /^Tirei afirmação sem fonte: “Vale cada centavo!”\.$/); assert.equal(claimNotice([]), null); ok('aviso "Tirei afirmação sem fonte: …"')

// ── hashtags ─────────────────────────────────────────────────────────────────────────────────────────────────────
assert.equal(cutHashtags('#leblon #imoveisdeluxo #rio', empty).text, '#leblon #rio'); ok('hashtag com termo barrado sai')
assert.equal(cutHashtags('#leblon #imoveisdeluxo', ctx).text, '#leblon #imoveisdeluxo'); ok('hashtag liberada com o cadastro')

// ── legenda: reescreve 1x e, persistindo, corta ─────────────────────────────────────────────────────────────────
let asks = 0
const r1 = await lockText('Casa linda. Endereços mais desejados do Rio.', empty, async () => { asks++; return 'Casa linda. Vale cada centavo.' })
assert.equal(asks, 1); assert.equal(r1.text, 'Casa linda.'); assert.ok(r1.removed.length === 1); ok('reescreveu 1x, a IA insistiu → corta só a frase (nunca troca por outro adjetivo)')
const r2 = await lockText('Casa linda. Endereços mais desejados do Rio.', empty, async () => 'Casa linda no Rio.')
assert.equal(r2.text, 'Casa linda no Rio.'); assert.deepEqual(r2.removed, []); ok('reescrita limpa vale e nada é cortado')

// ── slides: TODO campo ───────────────────────────────────────────────────────────────────────────────────────────
const sl = (o) => ({ layout: 'destaque', title: '', text: '', items: '', highlight: '', cta: '', ...o })
const deck = [
  sl({ layout: 'capa', title: 'O erro de quem compra', text: 'Um dos m² mais valorizados' }),
  sl({ layout: 'lista', title: 'Antes de fechar', items: 'Confira a matrícula\nVale cada centavo\nPeça o habite-se' }),
  sl({ layout: 'destaque', text: 'Acima de R$ 1,5 mi só os endereços mais desejados.' }),
  sl({ layout: 'passos', title: 'Passos', items: 'Visite\nNegocie' }),
  sl({ layout: 'fecho', title: 'Fale com a gente', cta: 'Me chama no direct' }),
]
const out = await lockDeckClaims({ slides: deck, caption: 'Dica rápida.', hashtags: '#dica #luxo', cta: 'Me chama no direct', ctx: empty, brand: 'Tespon', neutral: 'Tespon' })
const all = JSON.stringify({ s: out.slides, c: out.caption, h: out.hashtags, k: out.cta })
for (const w of ['mais valorizados', 'Vale cada centavo', 'R$ 1,5', 'desejados', '#luxo']) assert.ok(!all.includes(w), `${w} ainda na arte`)
assert.equal(out.slides[0].title, 'O erro de quem compra'); assert.equal(out.slides[0].text, ''); ok('capa: frase barrada sai do subtítulo, título limpo fica')
assert.equal(out.slides[1].items, 'Confira a matrícula\nPeça o habite-se'); ok('itens: só a linha barrada sai')
assert.equal(out.slides.length, 4); assert.ok(out.slides.every(s => s.title || s.text || s.items)); ok('slide do meio que esvaziou sai (restam 4 ≥ 3); nenhum slide vazio')
assert.ok(out.removed.length >= 3); assert.match(claimNotice(out.removed), /^Tirei afirmação sem fonte:/); ok('removidos registrados pro reasoning')

// capa esvaziada → texto neutro (nome da marca), nunca texto inventado
const out2 = await lockDeckClaims({ slides: [sl({ layout: 'capa', title: 'Vale cada centavo' }), sl({ title: 'Meio', text: 'ok' }), sl({ layout: 'fecho', title: 'Imperdível' })], caption: '', hashtags: '', cta: '', ctx: empty, brand: 'Tespon', neutral: 'Tespon' })
assert.equal(out2.slides[0].title, 'Tespon'); assert.equal(out2.slides[2].title, 'Tespon'); ok('capa/fecho esvaziados ficam com o nome da marca')

// reescrita do slide pela IA: 1 chamada por slide ruim; limpa = vale
let slideAsks = 0
const out3 = await lockDeckClaims({ slides: [sl({ layout: 'capa', title: 'Vale cada centavo' }), sl({ title: 'Meio', text: 'ok' }), sl({ layout: 'fecho', title: 'Fim', cta: 'Oi' })], caption: '', hashtags: '', cta: '', ctx: empty, brand: 'Tespon', neutral: 'Tespon',
  ask: async () => { slideAsks++; return JSON.stringify({ title: 'Compre com segurança', text: '', items: '', highlight: '', cta: '' }) } })
assert.equal(slideAsks, 1); assert.equal(out3.slides[0].title, 'Compre com segurança'); assert.deepEqual(out3.removed, []); ok('slide reescrito limpo é usado (1 chamada só pro slide ruim)')

// retry de overflow: cutSlide corta também o que a IA devolver
const c = cutSlide(sl({ title: 'Ok', text: 'Endereços mais desejados.' }), empty)
assert.equal(c.slide.text, ''); ok('cutSlide (usado no retry de overflow) corta sem IA')

// frase vizinha de "ate" não dispara faixa à toa
assert.equal(textIssues('Visite até sábado e conheça.', empty).length, 0); ok('"até" sem valor em dinheiro não é faixa de preço')

// ── nota: motivos de nota baixa em código ───────────────────────────────────────────────────────────────────────
assert.deepEqual(qualityFlags({ reasoning: 'Ok. Tirei afirmação sem fonte: “x”.', slides: [] }).map(f => f.key), ['afirmacao_sem_fonte'])
assert.deepEqual(qualityFlags({ reasoning: '', slides: [{ layout: 'capa', text: 'Promessa — Um · Dois · Três' }] }).map(f => f.key), ['capa_fraca'])
assert.deepEqual(qualityFlags({ reasoning: null, slides: [{ layout: 'capa', text: 'Gancho forte' }, { layout: 'lista', text: 'a — b · c · d' }] }), []); assert.ok(QUALITY_PENALTY > 0); ok('afirmação sem fonte e capa-índice viram motivo de nota baixa; capa boa não')

console.log(`\n${n} verificações ok`)
