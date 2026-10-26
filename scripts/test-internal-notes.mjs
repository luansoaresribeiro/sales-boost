import assert from 'node:assert/strict'
// Roda: node --experimental-strip-types scripts/test-internal-notes.mjs
// Frase nova de recado da IA que escapou? Acrescente o caso aqui ANTES de mexer nas regras de _shared/internalNotes.ts.
import { stripInternalNotes, internalNotesNotice, stripPieceTexts, INTERNAL_NOTE_PREFIX, EMPTY_CAPTION_NOTICE } from '../supabase/functions/_shared/internalNotes.ts'
import { keepQueroNotice, queroNotice } from '../supabase/functions/_shared/videoCta.ts'
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
for (const t of ['Os dados informados precisam de revisão.', 'O valor deve ser confirmado.', 'Revise antes de publicar.', 'Nota interna: conferir m².', 'Dados fornecidos precisam ser verificados.']) {
  const r = stripInternalNotes(t); assert.equal(r.text, '', t); }
ok('variações fortes saem')
// QA rodada 1 (2026-10-23): recados que escaparam — cada frase tem que SAIR (no meio de uma legenda boa)
for (const t of ['Obs.: o valor do IPTU parece alto, confirme com o proprietário', 'Atenção corretor: faltou a metragem', 'Corretor, preciso do preço para escrever.', 'Nota interna: validar o preço antes de postar.', 'Aviso: dados incompletos, favor revisar antes de postar.', 'Dados fornecidos precisam ser verificados.', '[REVISAR] metragem suspeita', 'Observação para o corretor: a metragem parece incorreta.', 'Não consegui confirmar o preço, então deixei de fora. Revise.', '⚠️ Atenção: o m² informado (7.373) parece incorreto.', 'ATENÇÃO CORRETOR: confirme o valor do condomínio antes de publicar', 'PS: confirmar com o proprietário se aceita financiamento antes do post ir ao ar.', 'Nota: Esse preço me parece um erro de digitação, favor conferir.', REAL]) {
  const r = stripInternalNotes(`Apartamento incrível na Barra, 4 quartos!\n\n${t}\n\n#imoveis`)
  assert.ok(r.notes.length, 'ESCAPOU: ' + t); assert.ok(r.text.startsWith('Apartamento incrível') && r.text.endsWith('#imoveis'), 'perdeu a legenda boa: ' + t)
  if (t.startsWith('Não consegui')) assert.ok(!/Revise/.test(r.text), 'sobrou "Revise."')
}
ok('recados do QA saem e a legenda boa fica')
// fracas só com ⚠/🚨/❗ no começo
for (const t of ['⚠️ Inconsistência no valor informado.', '🚨 Parece erro no preço.', '❗ Valor estranho para a região.', '⚠️ Verifique a área antes.', '⚠️ Sobre o preço: não bate com o m².']) { const r = stripInternalNotes(t); assert.equal(r.text, '', t) }
ok('fracas com ⚠/🚨/❗ saem')
for (const t of ['Verifique as fotos do imóvel no nosso perfil.', 'Não bate o preço com outro igual por aí — aqui é diferente.', 'Parece erro, mas é isso mesmo: o preço caiu.', 'Sobre a metragem: 85 m² úteis.']) { const r = stripInternalNotes(t); assert.equal(r.text, t, t); assert.equal(r.notes.length, 0) }
ok('fracas SEM ⚠ passam')
// frases boas passam idênticas (QA rodada 1: todas as frases do QA entram aqui)
for (const t of [GOOD, 'Fale com o corretor João pelo direct e agende sua visita.', '⚠️ Últimas unidades! Garanta a sua.', '🚨 Novidade na Barra: cobertura com vista pro mar.', 'Me chama no direct e te passo todos os detalhes do imóvel.', 'Me passa seu contato que eu te mando as fotos.', 'Me manda uma DM pra agendar.', 'Nosso corretor atende de segunda a sábado.', 'Confirme sua visita pelo direct.', 'O condomínio está com a documentação em dia.', 'Pode me chamar no WhatsApp.', 'Corretor de imóveis na Barra há 10 anos.', 'Comente QUERO e receba as fotos.',
  'Confirme sua visita pelo direct', 'Antes de publicar seu anúncio, tire fotos com luz natural.', 'Nota: aceita pet', '⚠️ Última unidade com vista', 'Corretor responsável: João CRECI 123', 'Me passa seu WhatsApp que te mando o preço', 'Me manda uma mensagem e confirme o valor do aluguel comigo.', 'Confirme com o corretor a disponibilidade da vaga de garagem.', 'Precisa de mais espaço? Esse apê tem 3 quartos.', 'Revise suas finanças antes de comprar: veja quanto cabe no bolso.', 'Confira a metragem real na visita!', 'Fale com o corretor Carlos pelo direct.', 'Os valores precisam de atualização? Chama no direct que a gente confirma o preço do dia.', 'Veja a planta e confira todos os detalhes. Você precisa conhecer.', 'Aviso importante: o condomínio inclui água e gás.', 'Observação: IPTU incluso no aluguel.', 'Esse apartamento precisa de um novo dono.', 'Antes de publicar nas redes, muita gente esquece de checar a documentação do imóvel.', 'Seu imóvel precisa de revisão elétrica antes de vender? Fale com a gente.', 'Pode me passar seu telefone? Te ligo hoje.', 'Me envia seu orçamento e eu te mostro as opções.', 'Me passa o seu bairro favorito que eu busco opções.', 'Para o dono do primeiro imóvel, dica de ouro.', 'Para a dona de casa que quer praticidade.', 'Verifique a documentação com um advogado antes de fechar.', '❗Ofertas até sexta, não perde', 'Inconsistência no mercado? Aqui o preço é claro.']) {
  const r = stripInternalNotes(t); assert.equal(r.text, t, t); assert.equal(r.notes.length, 0, t) }
ok('frases boas passam idênticas')
// QA rodada 2 (2026-10-23): listas do QA — todas as boas passam intactas, todas as ruins saem de dentro de uma legenda boa
const good2 = [
 '⚠️ Atenção: últimas 2 unidades com desconto até sexta!',
 '⚠️ Confira as condições especiais de lançamento no direct.',
 '⚠️ Confirme sua visita até quinta, as vagas são limitadas.',
 '⚠️ Revise seu orçamento e veja se cabe: parcelas a partir de uma entrada acessível.',
 'Nota: o condomínio inclui academia e piscina.',
 'Obs: aceita financiamento e FGTS.',
 'Obs: valor do condomínio inclui água.',
 'Atenção! Esse imóvel não vai durar.',
 'Atenção: o valor do condomínio inclui IPTU.',
 'Atenção para os detalhes: piso porcelanato e armários planejados.',
 'Confira o tour completo no nosso perfil.',
 'Confira todos os detalhes e agende a sua visita antes de acabar.',
 'Revise com calma e venha conhecer.',
 'Eu amo esse apartamento, a vista é de tirar o fôlego.',
 'Eu mesmo visitei e recomendo, a luz é incrível.',
 'Recebi esse imóvel essa semana e já me apaixonei!',
 'Acabei de receber as chaves desse apê, vem ver!',
 'Não encontrei nada igual na região. Esse é único.',
 'Não consegui parar de olhar essa vista!',
 'Não consegui acreditar no preço desse apê!',
 'Corretor de plantão: Marcos. Chame no direct.',
 'Dica pro comprador: confirme a documentação antes de fechar negócio.',
 'Dica: verifique sempre o IPTU antes de comprar um imóvel.',
 'Antes de publicar seu anúncio, confira se as fotos estão boas.',
 'Condomínio com valor acessível e área de lazer completa.',
 'O preço pode ser confirmado com nosso corretor no direct.',
 'A metragem confirmada é de 85 m² e o valor é de ótimo custo.',
 'Parece um sonho, mas é real: cobertura com vista pro mar.',
 'Esse valor parece alto? Compare com o que oferece e veja.',
 'Metragem generosa: parece até uma casa!',
 'Preço parece baixo demais? É oportunidade real.',
 'Obs: preço sujeito a alteração sem aviso prévio.',
 'Aviso: visitas somente com hora marcada.',
 'PS: me chama no direct pra tirar dúvidas!',
 'Confirmar presença no plantão de sábado!',
 '(confirmar horário no direct)',
 'Observação: confira a disponibilidade da unidade.',
 'Nota: valores sujeitos a confirmação de disponibilidade.',
 'Os dados completos você recebe no direct.',
 'Revise sua lista de desejos e venha ver esse apê.',
 'Verifique a disponibilidade no direct.',
 'Foto 3: a sala com luz da manhã. Foto 5: a varanda.',
]
const bad2 = [
 'Corretor, a foto 3 está escura',
 'Não encontrei o valor do condomínio, então deixei de fora',
 'Dica pro corretor: envie mais fotos da cozinha',
 '(confirmar metragem)',
 'OBS INTERNA: sem preço no cadastro',
 'Corretor: faltou o bairro.',
 'Nota para o corretor: o preço não veio no cadastro.',
 'Não recebi o preço, então deixei de fora; confirme antes de postar.',
 'Eu não tinha o valor do condomínio, favor conferir.',
 'Aviso interno: metragem ausente.',
 'Obs: metragem parece errada, conferir com o proprietário.',
 '⚠️ Confirme a metragem antes de publicar.',
 '⚠️ Corretor, a foto está escura.',
 'Revise o preço antes de publicar.',
 'Sugiro conferir o preço antes de postar.',
 'Recado: o m² informado parece errado',
 'Antes de postar, confira se a metragem está correta.',
 '[confirmar preço]',
 'Dados faltando: não tenho o preço. Pode me passar, corretor?',
 'Por favor, corretor, revise os dados.',
]
bad2.push('Corretor: a foto 2 ficou borrada.', 'Por favor, corretora, confira o preço no cadastro.', 'Por favor, corretor, confira o preço no cadastro.')
good2.push('Corretor: Rafael Souza, CRECI 98765', 'Corretor responsável: João CRECI 123', 'Fale com o corretor Carlos')
const ctx2 = t => `Apê lindo na Barra!\n\n${t}\n\n#imoveis`
for (const t of good2) for (const f of [x => x, ctx2]) { const r = stripInternalNotes(f(t)); assert.equal(r.text, f(t), 'FALSO POSITIVO: ' + t); assert.equal(r.notes.length, 0) }
for (const t of bad2) { const r = stripInternalNotes(ctx2(t)); assert.ok(r.notes.length, 'ESCAPOU: ' + t); assert.ok(r.text.startsWith('Apê lindo') && r.text.endsWith('#imoveis'), 'perdeu a legenda: ' + t); assert.equal(r.text.replace(/Apê lindo na Barra!|#imoveis|\s/g, ''), '', 'SOBROU: ' + t) }
ok('listas do QA (rodada 2): boas passam, ruins saem')
// legenda multi-parágrafo preserva a formatação quando nada sai
{ const t = 'Linha 1\n\n\nLinha 2\n- item'; assert.equal(stripInternalNotes(t).text, t); ok('sem recado: texto idêntico (inclusive espaços)') }
// o aviso
{ const a = internalNotesNotice(['x  y']); assert.ok(a.startsWith(INTERNAL_NOTE_PREFIX)); assert.equal(internalNotesNotice([]), null); ok('aviso com prefixo constante') }
// stripPieceTexts (creative-generate): legenda + CTA
{ const r = stripPieceTexts(`${GOOD}\n\n${REAL}`, 'Me chama no direct'); assert.equal(r.caption, GOOD); assert.equal(r.cta, 'Me chama no direct'); assert.equal(r.emptied, false); assert.equal(r.notes.length, 1); ok('stripPieceTexts: tira o recado, mantém legenda e CTA') }
{ const r = stripPieceTexts(REAL, 'Corretor, confirme o preço antes de eu escrever.'); assert.equal(r.caption, ''); assert.equal(r.cta, ''); assert.equal(r.emptied, true); assert.equal(r.notes.length, 2); ok('stripPieceTexts: esvazia legenda e CTA que eram só recado') }
{ const r = stripPieceTexts(null, undefined); assert.deepEqual(r, { caption: '', cta: '', notes: [], emptied: false }); ok('stripPieceTexts: vazio não é "esvaziado"') }
for (const t of ['Fale com o corretor João pelo direct.', 'Aviso importante: o condomínio inclui água e gás.', 'Antes de publicar seu anúncio, tire fotos com luz natural.']) { const r = stripPieceTexts(t, 'Comente QUERO'); assert.equal(r.caption, t); assert.equal(r.cta, 'Comente QUERO'); assert.equal(r.emptied, false) }
ok('stripPieceTexts: educativos passam intactos')
// keepQueroNotice: item-videos preserva os 3 avisos
{ const q = queroNotice('Me chama no direct'), rec = internalNotesNotice(['x']);
  assert.equal(keepQueroNotice(`Vídeo sendo feito. ${q} ${rec}`), `${q} ${rec}`)           // QUERO não aprovado + recado
  assert.equal(keepQueroNotice(`Vídeo sendo feito. ${rec} ${EMPTY_CAPTION_NOTICE}`), `${rec} ${EMPTY_CAPTION_NOTICE}`) // QUERO aprovado (sem aviso) + recado + vazio
  assert.equal(keepQueroNotice(`Vídeo. ${EMPTY_CAPTION_NOTICE}`), EMPTY_CAPTION_NOTICE)
  assert.equal(keepQueroNotice('Vídeo sendo feito.'), null); assert.equal(keepQueroNotice(null), null); ok('keepQueroNotice mantém QUERO, recado e legenda vazia') }
console.log(`\n${n} grupos OK`)
