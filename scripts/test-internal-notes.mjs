import assert from 'node:assert/strict'
// Roda: node --experimental-strip-types scripts/test-internal-notes.mjs
// Frase nova de recado da IA que escapou? Acrescente o caso aqui ANTES de mexer nas regras de _shared/internalNotes.ts.
import { stripInternalNotes, internalNotesNotice, INTERNAL_NOTE_PREFIX } from '../supabase/functions/_shared/internalNotes.ts'
const REAL = '⚠️ Sobre a metragem: os dados que recebi precisam de confirmação antes de publicar — prefiro não divulgar um número incorreto do que te passar informação errada. Me chama no direct e te passo a metragem confirmada junto com mais detalhes do imóvel.'
const GOOD = 'Apartamento de 3 quartos na Barra, pertinho da praia. Luz natural o dia todo e varanda com vista aberta.'
let n = 0; const ok = (m) => { n++; console.log('ok -', m) }
// a frase real sai (sozinha)
{ const r = stripInternalNotes(REAL); assert.equal(r.text, ''); assert.equal(r.notes.length, 1); ok('frase real sai inteira') }
// no fim da legenda: a legenda boa fica
{ const r = stripInternalNotes(`${GOOD}\n\n${REAL}`); assert.equal(r.text, GOOD); assert.equal(r.notes.length, 1); ok('legenda boa + recado: só o recado sai') }
// no começo
{ const r = stripInternalNotes(`${REAL}\n\n${GOOD}`); assert.equal(r.text, GOOD); ok('recado no começo') }
// "Ops! Corretor, me passa…"
{ const r = stripInternalNotes('Ops! Corretor, me passa a metragem certa desse imóvel antes de eu seguir?'); assert.equal(r.text, ''); assert.equal(r.notes.length >= 1, true); ok('"Ops! Corretor, me passa…" sai') }
{ const r = stripInternalNotes(`${GOOD} Ops! Corretor, me passa a metragem certa por favor.`); assert.equal(r.text, GOOD); ok('Ops! Corretor no fim da mesma frase-bloco: só o recado sai') }
{ const r = stripInternalNotes('Corretor, confirme o preço antes de eu escrever.'); assert.equal(r.text, ''); ok('bloco começando com "Corretor,"') }
{ const r = stripInternalNotes('Corretora, o valor do condomínio não bate com o resto.'); assert.equal(r.text, ''); ok('bloco "Corretora,"') }
// variações fortes
for (const t of ['Os dados informados precisam de revisão.', 'Precisam de confirmação os números.', 'O valor deve ser confirmado.', 'Isso deve ser revisado antes.', 'Revise antes de publicar.', 'Nota interna: conferir m².', 'Aviso interna? obs interna: conferir', 'Isso é para o corretor conferir.']) {
  const r = stripInternalNotes(t); assert.equal(r.text, '', t); }
ok('variações fortes saem')
{ const r = stripInternalNotes('Pode me passar a metragem exata?'); assert.equal(r.text, ''); ok('"pode me passar a metragem" sai') }
// fracas só com ⚠/🚨/❗ no começo
for (const t of ['⚠️ Inconsistência no valor informado.', '🚨 Parece erro no preço.', '❗ Valor estranho para a região.', '⚠️ Verifique a área antes.', '⚠️ Sobre o preço: não bate com o m².']) { const r = stripInternalNotes(t); assert.equal(r.text, '', t) }
ok('fracas com ⚠/🚨/❗ saem')
for (const t of ['Verifique as fotos do imóvel no nosso perfil.', 'Não bate o preço com outro igual por aí — aqui é diferente.', 'Parece erro, mas é isso mesmo: o preço caiu.', 'Sobre a metragem: 85 m² úteis.']) { const r = stripInternalNotes(t); assert.equal(r.text, t, t); assert.equal(r.notes.length, 0) }
ok('fracas SEM ⚠ passam')
// frases boas passam idênticas
for (const t of [GOOD, 'Fale com o corretor João pelo direct e agende sua visita.', '⚠️ Últimas unidades! Garanta a sua.', '🚨 Novidade na Barra: cobertura com vista pro mar.', 'Me chama no direct e te passo todos os detalhes do imóvel.', 'Me passa seu contato que eu te mando as fotos.', 'Me manda uma DM pra agendar.', 'Nosso corretor atende de segunda a sábado.', 'Confirme sua visita pelo direct.', 'O condomínio está com a documentação em dia.', 'Pode me chamar no WhatsApp.', 'Corretor de imóveis na Barra há 10 anos.', 'Comente QUERO e receba as fotos.']) {
  const r = stripInternalNotes(t); assert.equal(r.text, t, t); assert.equal(r.notes.length, 0, t) }
ok('frases boas passam idênticas')
// legenda multi-parágrafo preserva a formatação quando nada sai
{ const t = 'Linha 1\n\n\nLinha 2\n- item'; assert.equal(stripInternalNotes(t).text, t); ok('sem recado: texto idêntico (inclusive espaços)') }
// o aviso
{ const a = internalNotesNotice(['x  y']); assert.ok(a.startsWith(INTERNAL_NOTE_PREFIX)); assert.equal(internalNotesNotice([]), null); ok('aviso com prefixo constante') }
console.log(`\n${n} grupos OK`)
