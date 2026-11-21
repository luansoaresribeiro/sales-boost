import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
// Roda: node --experimental-strip-types scripts/test-week-themes.mjs
// Trava de TEMA REPETIDO em código: janela de N semanas (ficha), nunca 2x na semana, vagas paralelas, oferta (imóvel + receita).
import { findRepeatedTheme, parseThemeCfg, DEFAULT_THEME_CFG, blockingThemes, weekStartOf, pickAlternative } from '../supabase/functions/_shared/themeDedupe.ts'
import { planWeekThemes, recipeBlocked } from '../supabase/functions/_shared/weekThemes.ts'
let n = 0; const ok = (m) => { n++; console.log('ok -', m) }

// ── o caso exato do relatório ─────────────────────────────────────────────────────────────────────────────────────
const A = 'Comparativo de mercado: o que R$ 1,5 mi compra na Barra da Tijuca vs. no Leblon'
const B = 'Comparação de o que R$1,5 mi compra na Barra da Tijuca vs. no Leblon p...'
assert.ok(findRepeatedTheme(A, [B])); assert.ok(findRepeatedTheme(B, [A])); ok('"Comparativo… R$ 1,5 mi… Barra vs. Leblon" × "Comparação… R$1,5 mi…" = repetido (nos 2 sentidos)')
for (const d of ['Como funciona o financiamento imobiliário, passo a passo', 'O que conferir na visita ao imóvel antes de decidir', 'O que R$ 3 mi compra na Barra da Tijuca vs. no Leblon e na Gávea']) assert.equal(findRepeatedTheme(d, [A, B]), null, d)
ok('temas diferentes NÃO são repetidos (inclusive outro valor / outros bairros)')
assert.equal(DEFAULT_THEME_CFG.similarity, 0.8); ok('padrão do código também é 0.8')

assert.equal(findRepeatedTheme(A, [B], 1), null); ok('limiar vem da ficha (1.0 não acusa o par parecido)')

// ── ficha ─────────────────────────────────────────────────────────────────────────────────────────────────────────
const mig = readFileSync(new URL('../supabase/migrations/20261102130000_travas_tema_numero.sql', import.meta.url), 'utf8')
const alts = JSON.parse(mig.match(/\$json\$(\[\s*"Como funciona.*?\])\$json\$/s)[1])
const places = JSON.parse(mig.match(/\$json\$(\["leblon".*?\])\$json\$/s)[1])
assert.ok(/"theme_similarity": 0.8\}/.test(mig))
const cfg = parseThemeCfg({ theme_cooldown_weeks: 4, theme_similarity: 0.8, theme_alternatives: alts, theme_places: places })
assert.equal(cfg.cooldownWeeks, 4); assert.ok(cfg.alternatives.length >= 5); ok('migration traz janela 4, limiar 0.8, bairros e temas alternativos')
assert.ok(alts.every(a => !/\d/.test(a))); ok('alternativas da ficha não têm número (regra 5)')
// bairro diferente sozinho NÃO é repetido (com os bairros da ficha); mesmos bairros + mesmo valor continua repetido
const P = cfg.places, S = cfg.similarity
assert.equal(findRepeatedTheme('Dicas para comprar apartamento no Leblon', ['Dicas para comprar apartamento na Barra'], S, P), null)
assert.equal(findRepeatedTheme('Quanto custa morar em Ipanema', ['Quanto custa morar em Copacabana'], S, P), null)
ok('"Dicas para comprar apartamento no Leblon" × "…na Barra" e Ipanema × Copacabana NÃO são repetidos')
assert.ok(findRepeatedTheme(A, [B], S, P) && findRepeatedTheme(B, [A], S, P)); ok('o caso Barra vs. Leblon R$ 1,5 mi continua repetido com bairros e 0.8')
assert.ok(findRepeatedTheme('Dicas para comprar apartamento no Leblon', ['Dicas para comprar apartamento no Leblon hoje'], S, P)); ok('mesmo bairro + mesmo molde continua repetido')
assert.deepEqual(parseThemeCfg(undefined), DEFAULT_THEME_CFG); assert.equal(parseThemeCfg({ theme_cooldown_weeks: 0 }).cooldownWeeks, 4); assert.equal(parseThemeCfg({ theme_cooldown_weeks: 99 }).cooldownWeeks, 12); ok('sem ficha = padrão genérico (4 semanas); 0 não desliga; teto 12')

// ── janela: 4ª semana seguida bloqueia; 5ª semanas atrás já pode voltar ───────────────────────────────────────────
assert.equal(weekStartOf('2026-11-07'), '2026-11-02'); assert.equal(weekStartOf('2026-11-08'), '2026-11-02'); ok('semana começa na segunda')
const rows = [{ idea: 'A', date: '2026-10-26' }, { idea: 'B', date: '2026-10-12' }, { idea: 'C', date: '2026-10-05' }, { idea: 'D', date: '2026-11-05' }, { idea: 'E' }]
assert.deepEqual(blockingThemes(rows, '2026-11-03', cfg), ['A', 'B', 'D', 'E'])
ok('janela de 4 semanas (A=1 sem. atrás, B=3 sem. bloqueiam; C=4 sem. libera), mesma semana (D) e sem data (E) bloqueiam')
assert.deepEqual(blockingThemes([{ idea: 'Z', date: '2026-11-04' }], '2026-11-03', { ...cfg, cooldownWeeks: 1 }), ['Z']); ok('mesma semana bloqueia mesmo com janela mínima')

// ── semana inteira: vagas paralelas enxergam umas às outras ───────────────────────────────────────────────────────
const slots = [{ key: 'v1', date: '2026-11-03', hint: 'educativo' }, { key: 'v2', date: '2026-11-07', hint: 'educativo' }, { key: 'v3', date: '2026-11-09', hint: 'educativo' }]
let prompts = []
// o Diretor "teimoso": propõe o tema do relatório pras duas primeiras vagas e um tema bom pra terceira
const stubbornAsk = async (p) => {
  prompts.push(p)
  if (prompts.length === 1) return JSON.stringify({ temas: [{ vaga: 'v1', tema: A }, { vaga: 'v2', tema: B }, { vaga: 'v3', tema: 'O que conferir na visita ao imóvel antes de decidir' }] })
  return JSON.stringify({ temas: [{ vaga: 'v2', tema: A }] })   // 2ª rodada: ainda repete
}
let out = await planWeekThemes({ slots, history: ['Comparativo de mercado: R$ 1,5 mi na Barra da Tijuca ou no Leblon'], cfg, brand: 'Tespon', ask: stubbornAsk })
const ideas = [...out.values()].map(a => a.idea)
for (let i = 0; i < ideas.length; i++) for (let j = i + 1; j < ideas.length; j++) assert.equal(findRepeatedTheme(ideas[i], [ideas[j]]), null, `${ideas[i]} × ${ideas[j]}`)
for (const a of ideas) assert.equal(findRepeatedTheme(a, ['Comparativo de mercado: R$ 1,5 mi na Barra da Tijuca ou no Leblon']), null)
assert.equal(prompts.length, 2); assert.ok(prompts[1].includes(A) || prompts[1].includes('Comparativo de mercado')); ok('pede outro tema 1x (com a lista proibida) e nenhum par da semana nem o histórico se repete')
assert.ok(out.get('v1').source === 'alternativa' && out.get('v1').note.startsWith('Tema trocado')); assert.ok(alts.includes(out.get('v1').idea)); ok('ainda repetiu → tema alternativo da ficha, registrado no reasoning ("Tema trocado…")')
assert.equal(out.get('v3').source, 'diretor'); assert.equal(out.get('v3').note, undefined); ok('tema bom do Diretor fica como veio')

// sem ask e sem alternativas: fica sem reserva (a vaga escolhe; a conferência da geração segue valendo)
out = await planWeekThemes({ slots: slots.slice(0, 1), history: [A], cfg: { ...cfg, alternatives: [] }, brand: 'X' })
assert.equal(out.get('v1').idea, null); assert.equal(out.get('v1').source, 'livre'); ok('sem IA e sem alternativa = sem reserva, sem quebrar')
assert.equal(pickAlternative(alts, alts.slice(0, 8), cfg), alts[8]); assert.equal(pickAlternative(alts, alts, cfg), null); ok('alternativa pula as que já foram usadas')
// IA lenta (timeout) não trava: segue sem reservar
out = await planWeekThemes({ slots: slots.slice(0, 1), history: [], cfg: { ...cfg, alternatives: [] }, brand: 'X', timeoutMs: 30, ask: () => new Promise(() => {}) })
assert.equal(out.get('v1').idea, null); ok('chamada que não responde estoura o timeout e o planejamento segue sem reserva')
// falha da IA não derruba o planejamento
out = await planWeekThemes({ slots, history: [], cfg, brand: 'X', ask: async () => { throw new Error('boom') } })
assert.equal(out.size, 3); assert.ok([...out.values()].every(a => a.source === 'alternativa' && a.idea)); ok('IA fora do ar → alternativas da ficha, sem repetir entre as vagas')

// ── oferta: mesmo imóvel + mesma receita ─────────────────────────────────────────────────────────────────────────
const used = [{ item_id: 'i1', recipe: 'r_agua', date: '2026-10-20' }, { item_id: 'i2', recipe: 'r_agua', date: '2026-09-28' }]
assert.equal(recipeBlocked(used, 'i1', 'r_agua', '2026-11-03', 4), true)
assert.equal(recipeBlocked(used, 'i1', 'r_outra', '2026-11-03', 4), false)
assert.equal(recipeBlocked(used, 'i2', 'r_agua', '2026-11-03', 4), false)
assert.equal(recipeBlocked([...used, { item_id: 'i3', recipe: 'r_agua', date: '2026-11-04' }], 'i3', 'r_agua', '2026-11-06', 4), true)
ok('oferta: mesmo imóvel + mesma receita bloqueia na janela e na mesma semana; outra receita ou fora da janela libera')
console.log(`\n${n} ok`)

// ── C1b (dono, 21/11): ASSUNTO repetido na MESMA semana, com sinônimos — casos reais de 16–22/11 ─────────────────────
{
  const { findWeekRepeat, findRepeat, weekThemesOf, topicsIn, parseThemeCfg: P2, DEFAULT_THEME_CFG: D2 } = await import('../supabase/functions/_shared/themeDedupe.ts')
  const { planWeekThemes: plan2 } = await import('../supabase/functions/_shared/weekThemes.ts')
  const mig2 = readFileSync(new URL('../supabase/migrations/20261121120000_tema_semana_assuntos.sql', import.meta.url), 'utf8')
  const topicsRio = JSON.parse(mig2.match(/\$json\$(\[.*?\])\$json\$/s)[1])
  const c = P2({ theme_similarity: 0.8, theme_week_similarity: 0.6, theme_topics: topicsRio })
  assert.ok(c.topics.length >= 6 && c.weekSimilarity === 0.6); ok('ficha traz os assuntos-chave e o limiar da semana (0.6)')
  assert.equal(D2.weekSimilarity, 0.6); assert.deepEqual(D2.topics, []); ok('sem ficha: limiar da semana 0.6 e nenhum assunto-chave')
  assert.equal(P2({ theme_similarity: 0.7, theme_week_similarity: 0.9 }).weekSimilarity, 0.7); ok('a semana nunca fica mais frouxa que a janela')
  // Tespon 18 × 20/11: títulos diferentes, mesmo imposto
  const t18 = 'Carrossel educativo revelando o ITBI e as taxas que encarecem a compra de imóvel no Rio além do preço anunciado'
  const t20 = 'Quanto é o ITBI no Rio de Janeiro e quem paga?'
  assert.match(findWeekRepeat(t20, [t18], c)?.reason ?? '', /ITBI/); ok('"ITBI e as taxas…" × "Quanto é o ITBI… quem paga?" = mesmo assunto (ITBI)')
  assert.ok(findWeekRepeat('O imposto de transmissão no Rio, explicado', [t20], c)); ok('sinônimo conta ("imposto de transmissão" = ITBI)')
  // Teste Zero 18 × 20/11: 75% de sobreposição passava no 0.8
  const z18 = 'Carrossel educativo revelando os custos invisíveis além do preço do imóvel acima de R$1,5mi — ITBI, escritura'
  const z20 = 'Carrossel educativo sobre custos além do preço do imóvel acima de R$ 1,5 mi — checklist para compradores qualificados'
  assert.ok(findWeekRepeat(z20, [z18], c)); ok('"custos invisíveis além do preço" × "custos além do preço" = repetido na semana')
  // A3 17/20/22: o mesmo checklist de perguntas 3x
  const a17 = 'Carrossel educativo: as perguntas que todo comprador de cobertura deveria fazer antes de assinar — dica geral'
  const a22 = '5 perguntas que todo comprador de alto padrão deveria fazer antes de assinar qualquer proposta'
  assert.ok(findWeekRepeat(a22, [a17], c)); ok('A3: "perguntas que todo comprador… antes de assinar" 2x na semana = repetido (outras palavras)')
  // Relacionados, mas outro assunto: passam
  const week = [t18, 'Quais são as formas aceitas de garantia no aluguel?']
  for (const d of ['Carrossel educativo sobre liquidez do imóvel no Rio para quem compra de fora: a dúvida invisível sobre revenda',
    'Carrossel educativo: dúvidas sobre financiamento de imóvel no Rio para quem mora fora',
    'Carrossel educativo sobre a etapa de verificação de certidões e registros que quem compra de fora do Rio costuma esquecer',
    'Carrossel educativo sobre o custo de desistir do financiamento após assinar']) assert.equal(findWeekRepeat(d, week, c), null, d)
  ok('assuntos relacionados mas diferentes (liquidez, financiamento, certidões, desistência) NÃO são bloqueados')
  assert.equal(findWeekRepeat('Dicas de financiamento para quem compra no Leblon', ['Dicas de financiamento para quem compra na Barra'], { ...c, places: ['leblon', 'barra'] }), null); ok('lugares diferentes da ficha continuam separando')
  // Fora da semana vale só a janela antiga (0.8, sem assunto-chave): ITBI de novo na semana seguinte pode
  assert.equal(findRepeat(t20, [t18], [], c), null); ok('ITBI em outra semana (fora da regra da semana) não é bloqueado pelo assunto')
  assert.deepEqual(weekThemesOf([{ idea: 'A', date: '2026-11-16' }, { idea: 'B', date: '2026-11-22' }, { idea: 'C', date: '2026-11-23' }, { idea: 'D' }], '2026-11-18'), ['A', 'B'])
  ok('weekThemesOf: só o que tem data dentro da semana (seg–dom)')
  assert.deepEqual([...topicsIn(z18, c.topics)].sort(), ['ITBI', 'custos da compra']); ok('topicsIn acha os assuntos da ficha')
  // Reserva da semana: o Diretor propõe 2 vagas sobre ITBI → a 2ª é trocada e o motivo fica registrado
  let asks = 0
  const ask = async () => (++asks === 1
    ? JSON.stringify({ temas: [{ vaga: 'v1', tema: 'Quanto é o ITBI e quem paga' }, { vaga: 'v2', tema: 'O ITBI e as taxas que encarecem a compra' }] })
    : JSON.stringify({ temas: [{ vaga: 'v2', tema: 'Como funciona a vistoria antes da entrega das chaves' }] }))
  const r = await plan2({ slots: [{ key: 'v1', date: '2026-11-23', hint: '' }, { key: 'v2', date: '2026-11-24', hint: '' }], history: [], weekHistory: [], cfg: c, brand: 'X', ask })
  assert.equal(r.get('v1').idea, 'Quanto é o ITBI e quem paga'); assert.match(r.get('v2').idea, /vistoria/); assert.match(r.get('v2').note ?? '', /mesmo assunto na semana: ITBI/)
  ok('reserva da semana: 2ª vaga sobre ITBI é trocada, com o motivo "mesmo assunto na semana: ITBI"')
  const r2 = await plan2({ slots: [{ key: 'v1', date: '2026-11-23', hint: '' }], history: [t18], weekHistory: [t18], cfg: c, brand: 'X', ask: async () => JSON.stringify({ temas: [{ vaga: 'v1', tema: 'Quanto é o ITBI e quem paga' }] }) })
  assert.notEqual(r2.get('v1').idea, 'Quanto é o ITBI e quem paga'); ok('peça já planejada/aprovada na semana também bloqueia o mesmo assunto')
}
console.log(`\n${n} ok (C1b incluído)`)
