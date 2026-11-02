import assert from 'node:assert/strict'
// Roda: node --experimental-strip-types scripts/test-caption-guard.mjs
// Trava da legenda do tour: frases proibidas, duração em segundos, abertura repetida.
import { findForbidden, openingOf, repeatsOpening, checkCaption, stripForbidden, promptRules, rewriteRequest } from '../supabase/functions/_shared/captionGuard.ts'
import { DEFAULT_FORBIDDEN } from '../supabase/functions/_shared/tourPick.ts'
let n = 0; const ok = (m) => { n++; console.log('ok -', m) }
const F = ['filmado', 'sem edição', 'sem filtro', 'sem encenação', 'gravado', 'filmagem']

// todas as palavras da lista são barradas (inclusive com maiúscula/acento diferente) e a lista padrão também
for (const w of [...F, ...DEFAULT_FORBIDDEN]) {
  assert.ok(findForbidden(`Olha só, ${w.toUpperCase()} do jeito que é.`, [...F, ...DEFAULT_FORBIDDEN]).length > 0, w)
}
ok('toda palavra da lista é barrada')
assert.deepEqual(findForbidden('Imagem sem edicao nenhuma', F), ['sem edição']); ok('sem acento também pega')
assert.deepEqual(findForbidden('Uma sala linda e iluminada.', F), []); ok('legenda limpa passa')
assert.equal(findForbidden('O filmado', ['filmad']).length, 1); ok('prefixo da lista pega variações (filmada/filmados)')

// duração
for (const t of ['Vídeo de 5 segundos', 'em 5s você vê', 'apenas 3 seg de tour', 'cinco segundos de sala', 'Em segundos você entende', 'Reels curto (5 s)', 'tour de 6 s']) {
  assert.ok(findForbidden(t, []).some(x => x.startsWith('duração')), t)
}
ok('qualquer menção a segundos é barrada')
for (const t of ['O segundo quarto é amplo', '2 suítes e 3 quartos', 'Sala de 25 m2', 'Vista de 360 graus']) assert.deepEqual(findForbidden(t, []), [], t)
ok('"segundo quarto", "2 suítes", "25 m2" não são falso positivo')

// abertura
assert.equal(openingOf('Olha, que Sala incrível! Venha ver'), 'olha que sala incrivel'); ok('abertura = 4 primeiras palavras sem acento/pontuação')
const prev = ['Imagine acordar com essa vista.', 'Sala ampla e clara em Ipanema']
assert.equal(repeatsOpening('IMAGINE acordar com essa luz', prev), true); ok('mesma abertura (4 palavras) repetida é pega')
assert.equal(repeatsOpening('Imagine só a vista daqui', prev), false); ok('abertura diferente passa')
assert.equal(repeatsOpening('Qualquer coisa', []), false); ok('sem legenda anterior nunca repete')

const r = checkCaption('Imagine acordar com essa vista, filmado hoje.', F, prev)
assert.equal(r.ok, false); assert.deepEqual(r.forbidden, ['filmado']); assert.equal(r.repeated, true); ok('checkCaption junta os problemas')
assert.equal(checkCaption('Uma manhã com vista pro mar.', F, prev).ok, true); ok('checkCaption ok')
assert.match(rewriteRequest(r, prev), /filmado/); assert.match(rewriteRequest(r, prev), /imagine acordar com essa/); ok('pedido de reescrita cita os problemas')

// reserva: tira só a frase ruim
const s = stripForbidden('Sala de luz natural. Tudo filmado sem edição! Fale comigo.', F)
assert.equal(s.changed, true); assert.equal(s.text, 'Sala de luz natural. Fale comigo.'); ok('stripForbidden tira a frase proibida')
assert.equal(stripForbidden('Sala boa.', F).changed, false); ok('stripForbidden não mexe no que está limpo')
assert.equal(stripForbidden('Vídeo de 5 segundos.', F).text, ''); ok('frase só de duração some')

const pr = promptRules(F, prev)
assert.match(pr, /ANIMAÇÃO por IA/); assert.match(pr, /filmado/); assert.match(pr, /imagine acordar com essa/); assert.doesNotMatch(pr, /\(5 s\)/); ok('regras do prompt')
console.log(`${n} grupos ok`)
