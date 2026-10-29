import assert from 'node:assert/strict'
// Roda: node --experimental-strip-types scripts/test-results-brokers.mjs
// Etapas 6 e 7 (mínimas): rodízio de corretores (regra do assign_next_broker simulada), wa.me do encaminhamento, "sem dado" x 0,
// soma só de valores informados e carimbo de datas por estágio.
import {
  attributionCodes, forwardText, forwardUrl, isValidBrokerPhone, metric, parseMoney, stampsForStage, sumInformed, valueColumnFor, waNumber,
} from '../src/pages/dashboard/resultsBrokers.ts'
let n = 0; const ok = (m) => { n++; console.log('ok -', m) }

// --- rodízio: mesma regra do SQL (ativo, last_assigned_at mais antigo, nulos primeiro, desempate por created_at)
function nextBroker(brokers) {
  const act = brokers.filter(b => b.active)
  if (!act.length) return null
  act.sort((a, b) => {
    const x = a.last ? Date.parse(a.last) : -Infinity, y = b.last ? Date.parse(b.last) : -Infinity
    return x - y || a.created - b.created
  })
  return act[0]
}
{
  let clock = 1_000
  const bs = [{ id: 'A', active: true, last: null, created: 1 }, { id: 'B', active: true, last: null, created: 2 }, { id: 'C', active: true, last: null, created: 3 }]
  const got = { A: 0, B: 0, C: 0 }, order = []
  for (let i = 0; i < 7; i++) { const b = nextBroker(bs); got[b.id]++; order.push(b.id); b.last = new Date(clock += 1000).toISOString() }
  assert.deepEqual(got, { A: 3, B: 2, C: 2 }); assert.deepEqual(order, ['A', 'B', 'C', 'A', 'B', 'C', 'A']); ok('rodízio: 3 corretores / 7 leads = 3/2/2, em ordem')
  const bs2 = [{ id: 'A', active: true, last: null, created: 1 }, { id: 'B', active: false, last: null, created: 2 }, { id: 'C', active: true, last: null, created: 3 }]
  const g2 = { A: 0, B: 0, C: 0 }
  for (let i = 0; i < 6; i++) { const b = nextBroker(bs2); g2[b.id]++; b.last = new Date(clock += 1000).toISOString() }
  assert.deepEqual(g2, { A: 3, B: 0, C: 3 }); ok('rodízio: corretor inativo fica de fora')
  assert.equal(nextBroker([{ id: 'X', active: false, last: null, created: 1 }]), null); assert.equal(nextBroker([]), null); ok('rodízio: sem corretor ativo = ninguém (lead entra sem corretor)')
  const novo = [{ id: 'A', active: true, last: '2026-10-30T10:00:00Z', created: 1 }, { id: 'N', active: true, last: null, created: 9 }]
  assert.equal(nextBroker(novo).id, 'N'); ok('rodízio: corretor novo (nunca recebeu) é o próximo')
}

// --- telefone do corretor
{
  assert.ok(isValidBrokerPhone('(21) 99999-9999')); assert.ok(isValidBrokerPhone('2133334444')); assert.ok(!isValidBrokerPhone('999-9999')); assert.ok(!isValidBrokerPhone('')); assert.ok(!isValidBrokerPhone('abc')); ok('validação do WhatsApp: ≥ 10 dígitos')
  assert.equal(waNumber('(21) 99999-9999'), '5521999999999'); assert.equal(waNumber('+55 21 99999-9999'), '5521999999999'); assert.equal(waNumber('12345'), null); ok('número do wa.me: DDI só quando falta')
}

// --- encaminhamento por WhatsApp (nada é enviado por nós: só um link wa.me)
{
  const lead = { name: 'Maria Silva', contact: '21977776666', item: 'Apartamento em Ipanema', message: 'Pediu informações. Mensagem: Quero visitar & ver "fotos"' }
  const url = forwardUrl('(21) 91234-5678', lead, 'pt')
  assert.ok(url.startsWith('https://wa.me/5521912345678?text=')); const text = decodeURIComponent(url.split('?text=')[1])
  assert.equal(text, forwardText(lead, 'pt')); assert.match(text, /Nome: Maria Silva/); assert.match(text, /Contato: 21977776666/); assert.match(text, /Imóvel: Apartamento em Ipanema/); assert.match(text, /Quero visitar & ver "fotos"/)
  assert.ok(!/[ \n&"]/.test(url.split('?text=')[1])); ok('wa.me: texto codificado (espaço, quebra de linha, & e aspas não quebram a URL)')
  assert.match(forwardText(lead, 'en'), /Name: Maria Silva/); assert.match(forwardText(lead, 'en'), /Property:/); ok('encaminhamento em inglês')
  const sem = forwardText({ name: 'Ana', contact: null, item: null, message: '' }, 'pt'); assert.ok(!/Imóvel|Contato|Mensagem/.test(sem)); ok('linha sem dado some (nada inventado)')
  assert.equal(forwardUrl('123', lead, 'pt'), null); ok('telefone inválido: sem link')
}

// --- sem dado x 0
{
  assert.equal(metric(false, 0), null); assert.equal(metric(false, 5), null); assert.equal(metric(true, 0), 0); assert.equal(metric(true, 7), 7); assert.equal(metric(true, undefined), 0); ok('sem link = "sem dado" (null); com link, 0 é 0')
  assert.deepEqual(attributionCodes(['abcd2345'], { visitas: 0, cliques: 0, leads: 0 }), []); assert.deepEqual(attributionCodes([], { visitas: 4, cliques: 0, leads: 0 }), [])
  assert.deepEqual(attributionCodes(['abcd2345'], { visitas: 1, cliques: 0, leads: 0 }), ['/p/abcd2345']); ok('linha de atribuição só quando há link E evento')
}

// --- valores: só os informados
{
  assert.deepEqual(sumInformed([850000, null, '1200000.50', undefined, '', 0]), { total: 2050000.5, informed: 3, of: 6 }); ok('soma só dos valores informados (N de M)')
  assert.deepEqual(sumInformed([null, null]), { total: 0, informed: 0, of: 2 }); assert.deepEqual(sumInformed([]), { total: 0, informed: 0, of: 0 }); ok('nenhum valor informado: total 0 com 0 de M (a tela diz "valor não informado")')
  assert.equal(parseMoney('850000'), 850000); assert.equal(parseMoney('R$ 1.250.000,50'), 1250000.5); assert.equal(parseMoney('1,250,000.50'), 1250000.5); assert.equal(parseMoney('1.250.000'), 1250000); assert.equal(parseMoney('850,5'), 850.5)
  assert.equal(parseMoney(''), null); assert.equal(parseMoney('abc'), null); assert.equal(parseMoney('-5'), null); ok('valor digitado: formatos BR/EN; vazio ou lixo = não informado')
}

// --- carimbo de datas por estágio
{
  const now = '2026-10-30T12:00:00.000Z'
  assert.deepEqual(stampsForStage('novo', {}, now), {}); assert.deepEqual(stampsForStage('contato', {}, now), {})
  assert.deepEqual(stampsForStage('qualificado', {}, now), { visit_at: now }); assert.deepEqual(stampsForStage('proposta', {}, now), { proposal_at: now }); assert.deepEqual(stampsForStage('venda', {}, now), { closed_at: now }); ok('qualificado → visita, proposta → proposta, venda → fechado')
  assert.deepEqual(stampsForStage('proposta', { proposal_at: '2026-10-01T00:00:00Z' }, now), {}); assert.deepEqual(stampsForStage('venda', { closed_at: '2026-10-01T00:00:00Z' }, now), {}); ok('não sobrescreve data que já existe')
  assert.deepEqual(stampsForStage('venda', { visit_at: null, proposal_at: null }, now), { closed_at: now }); ok('pular etapa não preenche as anteriores')
  assert.equal(valueColumnFor('proposta'), 'proposal_value'); assert.equal(valueColumnFor('venda'), 'closed_value'); assert.equal(valueColumnFor('qualificado'), null); ok('campo de valor só em proposta e venda')
}

console.log(`\n${n} verificações ok`)
