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
assert.ok(findRepeatedTheme('Quanto custa morar em Ipanema', ['Quanto custa morar em Copacabana'])); ok('mesmo molde, só o bairro muda = conta como repetido (conservador: título curto, 3 de 4 palavras iguais)')
assert.equal(findRepeatedTheme(A, [B], 1), null); ok('limiar vem da ficha (1.0 não acusa o par parecido)')

// ── ficha ─────────────────────────────────────────────────────────────────────────────────────────────────────────
const mig = readFileSync(new URL('../supabase/migrations/20261102130000_travas_tema_numero.sql', import.meta.url), 'utf8')
const alts = JSON.parse(mig.match(/\$json\$(\[\s*"Como funciona.*?\])\$json\$/s)[1])
const cfg = parseThemeCfg({ theme_cooldown_weeks: 4, theme_similarity: 0.75, theme_alternatives: alts })
assert.equal(cfg.cooldownWeeks, 4); assert.ok(cfg.alternatives.length >= 5); ok('migration traz janela 4, limiar 0.75 e temas alternativos')
assert.ok(alts.every(a => !/\d/.test(a))); ok('alternativas da ficha não têm número (regra 5)')
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
