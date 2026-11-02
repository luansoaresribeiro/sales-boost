import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
// Roda: node --experimental-strip-types scripts/test-number-guard.mjs
// Números por extenso / algarismo na legenda de vídeo e catálogo + frases de mercado (ficha = migrations de verdade) + "sem filtro, sem encenação".
import { numberReadings, allowedValues, unsourcedNumbers } from '../supabase/functions/_shared/numberGuard.ts'
import { claimCtx, claimIssues, cutClaims, lockText, cutSlide, claimNotice, textIssues } from '../supabase/functions/_shared/claimLock.ts'
import { checkCaption, stripForbidden } from '../supabase/functions/_shared/captionGuard.ts'
import { DEFAULT_FORBIDDEN } from '../supabase/functions/_shared/tourPick.ts'
let n = 0; const ok = (m) => { n++; console.log('ok -', m) }
const vals = (t) => numberReadings(t).map(r => r[0])

// ── por extenso → número ──────────────────────────────────────────────────────────────────────────────────────────
assert.deepEqual(vals('Trezentos metros quadrados'), [300])
assert.deepEqual(vals('dois mil e quinhentos reais'), [2500])
assert.deepEqual(vals('Quatro quartos e vinte e um andares'), [4, 21])
assert.deepEqual(vals('um milhão de reais'), [1000000])
assert.deepEqual(vals('cento e vinte metros'), [120])
assert.deepEqual(vals('mil reais'), [1000])
ok('número por extenso vira valor (trezentos, dois mil e quinhentos, vinte e um, um milhão, cento e vinte)')
assert.deepEqual(vals('dois e três quartos'), [2, 3]); assert.deepEqual(vals('cento e vinte e três metros'), [123]); assert.deepEqual(vals('dois mil e quinhentos e vinte'), [2520]); assert.deepEqual(vals('mil e dois'), [1002])
ok('"e" só encadeia pra ordem menor: "dois e três quartos" = 2 e 3 (não 5); "cento e vinte e três" = 123')
assert.deepEqual(vals('Vídeo em 4K e tela de 8K'), [4, 8]); ok('"4K" não vira 4000')
assert.deepEqual(vals('Uma sala ampla, um quarto e uma varanda'), []); ok('"um/uma" artigo não é número')
assert.deepEqual(vals('20 por cento de desconto'), [20]); ok('"por cento" não vira 100')
assert.deepEqual(vals('7.373 m² e 850 mil e 1,5 mi'), [7373, 850000, 1500000]); ok('algarismo: milhar, "850 mil" e "1,5 mi" (sem contar "mil" 2x)')
assert.ok(unsourcedNumbers('R$ 1,5 mi na Barra', allowedValues(['preco 1500000'])).length === 0); ok('"1,5 mi" bate com 1500000 do cadastro')
assert.deepEqual(unsourcedNumbers('Dois quartos', allowedValues(['quartos: 2'])), []); ok('extenso bate com algarismo do cadastro e vice-versa')
assert.deepEqual(unsourcedNumbers('2 quartos', allowedValues(['dois quartos'])), []); ok('algarismo bate com extenso do cadastro')

// ── ficha = migrations (lista antiga + nova), como ficará em produção ─────────────────────────────────────────────
const oldSql = readFileSync(new URL('../supabase/migrations/20261029130000_oportunidade_pecas.sql', import.meta.url), 'utf8')
const q = readFileSync(new URL('../supabase/migrations/20261102120000_carrosseis_qualidade.sql', import.meta.url), 'utf8')
const t = readFileSync(new URL('../supabase/migrations/20261102130000_travas_tema_numero.sql', import.meta.url), 'utf8')
const oldPt = JSON.parse(oldSql.split('$json$')[3]).pt
const qArr = [...q.matchAll(/\$json\$(\[.*?\])\$json\$/g)].map(m => JSON.parse(m[1]))
const tArr = JSON.parse(t.match(/\$json\$(\["mais disputado".*?\])\$json\$/s)[1])
const ctxCfg = JSON.parse(q.match(/\$json\$(\{ ?"pt": ?\{"terms"[^$]*?)\$json\$/)[1]).pt
const TERMS = [...new Set([...oldPt, ...qArr[0], ...tArr].filter(x => !qArr[1].includes(x)))]
for (const w of ['demanda alta', 'alta demanda', 'costuma ter liquidez', 'tem liquidez', 'boa liquidez', 'liquidez alta', 'mais disputado', 'mais disputada', 'mais disputados', 'mais disputadas', 'valorizacao garantida', 'bairro mais desejado', 'enderecos mais disputados', 'mais desejados', 'mais desejadas']) assert.ok(TERMS.includes(w), w)
ok('ficha (após a migration nova) tem todas as frases de mercado pedidas')
assert.equal(TERMS.length, new Set(TERMS).size); ok('mescla sem duplicar')

// ── o caso exato da Tespon ────────────────────────────────────────────────────────────────────────────────────────
const fields = { quartos: 4, m2: 7373, bairro: 'Leblon' }
const texts = ['Apartamento no Leblon', ...Object.values(fields).map(String)]
const ctx = claimCtx('pt', texts, texts, TERMS, { ctx: ctxCfg, places: ['Leblon'] })
ctx.factNums = allowedValues(texts)
const cap = 'Quatro quartos no Leblon. Trezentos metros quadrados de apartamento num dos endereços mais disputados do Rio.'
const cut = cutClaims(cap, ctx)
assert.equal(cut.text, 'Quatro quartos no Leblon.')
assert.equal(cut.removed.length, 1)
ok('"Trezentos metros quadrados…" cortado; "Quatro quartos" mantido (4 existe no cadastro)')
assert.ok(claimIssues('Trezentos metros quadrados de apartamento.', ctx).some(i => i.startsWith('número sem fonte')))
const onlyMarket = claimCtx('pt', texts, texts, TERMS, { ctx: ctxCfg, places: ['Leblon'] })   // sem factNums: só a frase de mercado
assert.ok(claimIssues('Num dos endereços mais disputados do Rio.', onlyMarket).length > 0)
ok('a frase de mercado "endereços mais disputados" é barrada por si só (mesmo sem a trava de número)')
assert.ok(claimNotice(cut.removed)?.startsWith('Tirei afirmação sem fonte')); ok('reasoning avisa o que saiu')
assert.equal(cutClaims('Quatro quartos no Leblon. Metragem de 7.373 m².', ctx).text, 'Quatro quartos no Leblon. Metragem de 7.373 m².'); ok('número do cadastro passa (7.373 = 7373)')

// reescreve 1x com aviso; persistindo, corta
let asked = null
const r1 = await lockText(cap, ctx, async iss => { asked = iss; return 'Quatro quartos no Leblon. Duzentos e oitenta metros de sala.' })
assert.ok(asked.some(i => i.startsWith('número sem fonte')) && r1.text === 'Quatro quartos no Leblon.'); ok('reescreve 1x com o aviso do número; reescrita ainda ruim → corta a frase')
const r2 = await lockText(cap, ctx, async () => 'Quatro quartos no Leblon, apartamento de 7.373 m².')
assert.equal(r2.text, 'Quatro quartos no Leblon, apartamento de 7.373 m².'); assert.deepEqual(r2.removed, []); ok('reescrita boa fica, nada cortado')

// ── as 4 frases de mercado do relato: legenda E slides ────────────────────────────────────────────────────────────
const empty = claimCtx('pt', [], [], TERMS, { ctx: ctxCfg })
const MARKET = ['Dois dos endereços mais desejados do Rio.', 'Demanda alta e imóvel que costuma ter liquidez.', 'Um dos endereços mais disputados do Rio.', 'O bairro mais desejado do Rio.', 'Com boa liquidez e valorização garantida.']
for (const m of MARKET) {
  assert.ok(claimIssues(m, empty).length > 0, m)
  assert.equal(cutClaims(`Texto limpo. ${m}`, empty).text, 'Texto limpo.', m)
  const s = cutSlide({ layout: 'conteudo', title: m, text: 'Texto limpo.', items: `${m}\nOutro item`, cta: '', highlight: '', image: '' }, empty)
  assert.equal(s.slide.title, ''); assert.equal(s.slide.items, 'Outro item'); assert.equal(s.slide.text, 'Texto limpo.')
}
ok('frases de mercado do relato cortadas na LEGENDA e em todos os campos do SLIDE')
assert.deepEqual(textIssues('Explique a liquidez de um imóvel para o cliente.', empty), []); ok('a palavra "liquidez" solta (educativo) não é barrada')
const withFacts = claimCtx('pt', ['Cobertura com alta demanda comprovada'], [], TERMS, {})
assert.deepEqual(claimIssues('Alta demanda comprovada.', withFacts), []); ok('o termo passa quando o cadastro traz a palavra')

// ── "sem filtro, sem encenação" (captionGuard do PR A, aplicado em runVideoSlot) ──────────────────────────────────
const legenda = 'Entrada com luz natural, sem filtro, sem encenação. Sala ampla.'
const chk = checkCaption(legenda, DEFAULT_FORBIDDEN, [])
assert.ok(!chk.ok && chk.forbidden.includes('sem filtro') && chk.forbidden.includes('sem encenação'))
assert.equal(stripForbidden(legenda, DEFAULT_FORBIDDEN).text, 'Sala ampla.')
ok('"sem filtro, sem encenação" já era coberto (captionGuard + DEFAULT_FORBIDDEN): reprova e a frase sai')
console.log(`\n${n} ok`)
