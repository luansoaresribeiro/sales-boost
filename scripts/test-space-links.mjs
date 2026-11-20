// Roda: node --experimental-strip-types scripts/test-space-links.mjs
// Frente 1, item 1.2 (19/11): mapa de ligações — classificação rigorosa, leitura da proposta, custo e tabela 2.2.
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
const { classifyLink, decidePassage, parseFacts, LINK_PROMPT, CHECK_VERSION, pairKey } = await import('../supabase/functions/_shared/passageCheck.ts')
const { parseProposal, proposePrompt, estimateUsd, compareLinks, pairSig, spacesSigOf, tourEvidencePairs } = await import('../supabase/functions/_shared/spaceLinks.ts')
const { TESPON_21 } = await import('./test-photo-spaces.mjs')

const F = (o) => ({ outside1: 'no', outside2: 'no', sameFloor: 'yes', stairsInPhoto1: 'no', doorBetweenVisible: 'unsure', stairsInPhoto2: 'no', ...o })
// Porta visível SEM o outro ambiente aparecer: nunca "confirmada" (no máximo provável).
assert.equal(classifyLink(F({ throughView: 'no' })).cls, 'probable')
assert.equal(classifyLink(F({ throughView: 'unsure' })).cls, 'probable')
assert.equal(classifyLink(F({})).cls, 'probable')                                  // sem o fato novo = não confirma
assert.equal(classifyLink(F({ throughView: 'yes' })).cls, 'confirmed')
// Os erros já vistos: escada só no destino (jogos → sala de baixo) e fora → dentro sem porta (piscina → salão).
assert.equal(classifyLink(F({ stairsInPhoto2: 'yes', throughView: 'yes' })).cls, 'unknown')
assert.equal(classifyLink(F({ outside1: 'yes', doorBetweenVisible: 'no', throughView: 'yes' })).cls, 'unknown')
assert.equal(classifyLink(F({ outside1: 'yes', doorBetweenVisible: 'unsure', throughView: 'yes' })).cls, 'unknown')
assert.equal(classifyLink(F({ sameFloor: 'unsure', throughView: 'yes' })).cls, 'unknown')
assert.equal(classifyLink(F({ outside1: 'yes', outside2: 'yes', throughView: 'yes' })).cls, 'unknown') // dois de fora
// O tour não muda: mesma versão e decidePassage ignora o fato novo.
assert.equal(CHECK_VERSION, 4)
assert.deepEqual(decidePassage(F({ throughView: 'yes' })), decidePassage(F({})))
// O fato novo é lido; sem ele, fica ausente.
assert.equal(parseFacts('x {"photo1_outside":"no","photo2_outside":"no","same_floor":"yes","stairs_in_photo1":"no","stairs_in_photo2":"no","door_between_visible":"unsure","other_visible_through":"yes"}').throughView, 'yes')
assert.equal(parseFacts('{"photo1_outside":"no","photo2_outside":"no","same_floor":"yes","stairs_in_photo1":"no","door_between_visible":"unsure"}').throughView, undefined)
assert.ok(LINK_PROMPT.includes('other_visible_through') && LINK_PROMPT.trim().endsWith('"other_visible_through":"yes|no|unsure"}'))

// Ambientes = tabela 2.1 (s1..s22 na ordem da tabela)
const spaces = TESPON_21.map((photos, k) => ({ key: `s${k + 1}`, label: `A${k}`, room: 'outro', area: 'social', photos, uncertain: false }))
const p = parseProposal('pensando...\n{"links":[{"a":"s1","b":"s2","photo":40,"other_photo":49,"why":"pela porta de vidro"},{"a":"s2","b":"s1","photo":1},{"a":"s2","b":"s99","photo":1},{"a":"s3","b":"s4","photo":7},{"a":"s3","b":"s4","photo":48,"other_photo":12}]}', spaces)
assert.equal(p.length, 2)                                   // repetido, ambiente inexistente e foto de fora do par descartados
assert.deepEqual(p[0], { a: 's1', b: 's2', photo: 40, other_photo: 49, why: 'pela porta de vidro' })
assert.equal(p[1].other_photo, 3)                           // other_photo fora do ambiente → 1ª foto do outro ambiente
assert.equal(parseProposal('sem json', spaces), null)
assert.ok(proposePrompt(50, spaces).includes('NÃO liste par só porque os ambientes costumam ser vizinhos'))
// Refazer só o que mudou: a assinatura do par não depende da ordem nem das chaves; muda quando as fotos mudam.
assert.equal(pairSig(spaces[0], spaces[1]), pairSig(spaces[1], spaces[0]))
assert.notEqual(pairSig(spaces[0], spaces[1]), pairSig({ ...spaces[0], photos: [2] }, spaces[1]))
assert.equal(spacesSigOf(spaces), spacesSigOf([...spaces].reverse()))

// Custo: 50 fotos + 20 pares fica abaixo de US$ 1 (estimativa); estimativa cresce com os pares.
const e = estimateUsd(50, 20)
assert.ok(e.total < 1 && e.total > 0.2, JSON.stringify(e))
assert.ok(estimateUsd(50, 30).total > e.total)

// Tabela 2.2 (grupos da 2.1): 7 ligações ══ comprovadas + Quarto 2 ── Closet. Erros conhecidos: piscina–salão, jogos–sala
// de baixo e terraço–salão (no reteste de 11/11, pelo vidro do terraço aparece a sala de baixo, não o salão).
export const TESPON_22_YES = [[0, 1], [1, 2], [2, 4], [4, 3], [3, 7], [7, 8], [8, 9], [10, 11]]
export const TESPON_22_WRONG = [[19, 16], [17, 1], [0, 16]]
const L = (a, b, cls) => ({ a: `s${a + 1}`, b: `s${b + 1}`, cls, photo: null, other_photo: null, missing: null, why: '', checked: true, sig: '' })
const perfect = compareLinks(TESPON_22_YES.map(([a, b]) => L(a, b, 'confirmed')), spaces, TESPON_21, TESPON_22_YES, TESPON_22_WRONG)
assert.equal(perfect.correct, 8); assert.equal(perfect.invented, 0); assert.equal(perfect.missed, 0); assert.equal(perfect.precisionVsTable, 1)
const bad = compareLinks([L(0, 1, 'confirmed'), L(19, 16, 'confirmed'), L(17, 1, 'probable'), L(5, 6, 'confirmed')], spaces, TESPON_21, TESPON_22_YES, TESPON_22_WRONG)
assert.equal(bad.invented, 1)                              // piscina–salão confirmada = inventada
assert.equal(bad.outside.length, 1)                        // escritório–lavabo: fora da tabela, a conferir no olho
assert.equal(bad.missed, 7)
assert.equal(bad.probable, 1)

// Candidatos com prova do tour: só pares v4 "yes", entre ambientes diferentes, sem repetir a proposta.
const urls = Array.from({ length: 50 }, (_, i) => `https://x/p${i}.jpg`)
const chk = {
  [pairKey(urls[40], urls[1])]: { linked: 'yes', missing: null, v: 4, facts: { outside1: 'yes', outside2: 'no', sameFloor: 'yes', stairsInPhoto1: 'no', doorBetweenVisible: 'yes' } }, // terraço → sala (porta vista)
  [pairKey(urls[3], urls[41])]: { linked: 'yes', missing: null, v: 4, facts: { outside1: 'no', outside2: 'no', sameFloor: 'yes', stairsInPhoto1: 'no', doorBetweenVisible: 'unsure' } }, // "sim" padrão: não entra
  [pairKey(urls[1], urls[0])]: { linked: 'yes', missing: null, v: 4, facts: { outside1: 'no', outside2: 'no', sameFloor: 'yes', stairsInPhoto1: 'no', doorBetweenVisible: 'yes' } }, // sala → jantar (já proposto)
  [pairKey(urls[13], urls[23])]: { linked: 'no', missing: 'escada', v: 4 }, // "não" não entra
  [pairKey(urls[4], urls[34])]: { linked: 'yes', missing: null, v: 4 },     // mesmo ambiente não entra
  [pairKey(urls[6], urls[41])]: { linked: 'yes', missing: null, v: 3 },     // versão antiga não entra
}
const ev = tourEvidencePairs(chk, urls, spaces, [{ a: 's2', b: 's3', photo: 1, other_photo: 0, why: '' }])
assert.deepEqual(ev.map(e => [e.a, e.b, e.photo, e.other_photo]), [['s1', 's2', 40, 1]])
assert.deepEqual(tourEvidencePairs(undefined, urls, spaces, []), [])
assert.ok(LINK_PROMPT.includes('reflexo em espelho'))

// item-videos expõe a ação, com acesso pago, teto e estimativa; o custo é gravado por chamada.
const iv = readFileSync('supabase/functions/item-videos/index.ts', 'utf8')
assert.ok(iv.includes("body.action === 'map_links'") && iv.includes('dryRun: body.dry_run === true'))
const sl = readFileSync('supabase/functions/_shared/spaceLinks.ts', 'utf8')
assert.ok(sl.includes("taskKey: 'ai_vision_links_propose'") && sl.includes("taskKey: 'ai_vision_links_pair'"))
assert.ok(sl.includes('Math.floor((maxUsd - priorCost - spent) / estimate.perPair)') && sl.includes('TIME_BUDGET_MS'))
console.log('ok — mapa de ligações: classificação rigorosa, proposta, teto de custo e tabela 2.2')
