import assert from 'node:assert/strict'
// Roda: node --experimental-strip-types scripts/test-robot-state.mjs
// C.2.1 — o que cada robô da fábrica mostra. Prova: só EXECUTING vira "Trabalhando"; fila/agendada/atrasada NUNCA; estado
// desconhecido NUNCA vira "Descansando"; estações 1/2/3/5 nunca trabalham com os dados atuais; frase da cortina sem número inventado.
import { ROBOT_POSE, robotPose, robotView, curtainSummary, LIVE_SIGNAL_STATIONS } from '../src/pages/dashboard/marketingAi/factory/robotState.ts'
import { buildStations, STATION_KEYS } from '../src/pages/dashboard/marketingAi/factory/factoryState.ts'

const KINDS = ['unknown', 'unavailable', 'standby', 'approval', 'processing', 'scheduled', 'queued', 'late', 'recent', 'failed']
assert.deepEqual(Object.keys(ROBOT_POSE).sort(), [...KINDS].sort(), 'o mapa cobre todos os estados')

// 1) só processing (EXECUTING) vira working, e só na estação 4
for (const k of KINDS) for (const s of STATION_KEYS) {
  const p = robotPose(s, k)
  if (p === 'working') assert.ok(k === 'processing' && s === 'content', `trabalhando indevido: ${s}/${k}`)
}
assert.equal(robotPose('content', 'processing'), 'working')
for (const s of ['data', 'opportunities', 'strategy', 'conversion']) assert.equal(robotPose(s, 'processing'), 'resting', 'sem sinal ao vivo nunca trabalha')
assert.deepEqual([...LIVE_SIGNAL_STATIONS], ['content'])
// 2) fila/agendada/atrasada = descansando (nunca trabalho)
for (const k of ['queued', 'scheduled', 'late']) assert.equal(ROBOT_POSE[k], 'resting', k)
// 3) desconhecido/indisponível = desligado, jamais descansando
assert.equal(ROBOT_POSE.unknown, 'off'); assert.equal(ROBOT_POSE.unavailable, 'off')
for (const s of STATION_KEYS) for (const lang of ['pt', 'en']) {
  assert.notEqual(robotView({ key: s, kind: 'unknown', stateLabel: 'Não foi possível verificar' }, lang).pose, 'resting')
  assert.notEqual(robotView({ key: s, kind: 'unknown', stateLabel: 'Não foi possível verificar' }, lang).label, 'Descansando')
}
assert.equal(robotView({ key: 'conversion', kind: 'unavailable', stateLabel: 'Indisponível' }, 'pt').label, 'Indisponível')
assert.equal(robotView({ key: 'data', kind: 'unknown', stateLabel: 'Não foi possível verificar' }, 'pt').label, 'Não foi possível verificar')
assert.equal(robotView({ key: 'content', kind: 'processing', stateLabel: 'Processando' }, 'pt').label, 'Trabalhando')
assert.equal(robotView({ key: 'opportunities', kind: 'approval', stateLabel: 'Requer aprovação' }, 'pt').label, 'Esperando você')
assert.equal(robotView({ key: 'content', kind: 'failed', stateLabel: 'Falhou' }, 'pt').label, 'Com problema')
assert.equal(robotView({ key: 'content', kind: 'standby', stateLabel: 'Em espera' }, 'pt').label, 'Descansando')
assert.equal(robotView({ key: 'content', kind: 'late', stateLabel: 'Atrasada' }, 'pt').delayed, true)

// 4) com os dados ATUAIS (buildStations de verdade, combinando as entradas possíveis) as estações 1/2/3/5 nunca trabalham
const card = (tone, info = '') => ({ tone, status: 'x', info })
const now = Date.parse('2026-11-07T12:00:00Z')
const iso = (min) => new Date(now + min * 60000).toISOString()
let combos = 0
for (const exec of [null, 0, 2]) for (const queued of [null, [], [{ scheduled_at: iso(30) }], [{ scheduled_at: iso(-5) }], [{ scheduled_at: iso(-60) }]])
  for (const failed of [null, { at: iso(-30), error: 'x' }]) for (const err of [false, true]) for (const opps of [null, 0, 3])
    for (const ig of [true, false]) for (const loading of [true, false]) for (const tone of ['muted', 'ok', 'alert']) for (const ready of [null, 0, 4]) {
      combos++
      const st = buildStations({
        lang: 'pt', cards: Object.fromEntries(STATION_KEYS.map(k => [k, card(tone)])),
        kpis: { signals7: 5, oppsSuggested: opps, oppsNew7: 0, strategiesActive: 1, actionsReady: ready, actionsVault: 0 },
        flow: { autoSignals: 1, oppsApproved: 1, lastOppAt: null, pagesLive: 0, leads30: 0, tracked30: 0 },
        actions: { executing: exec, queued, failed, lastDoneAt: null, error: err }, marketLastAt: null, strategyUpdatedAt: null, hasStrategy: true,
        instagramConnected: ig, loading, updatedAt: new Date(now), now,
      })
      for (const k of STATION_KEYS) {
        const v = robotView(st[k], 'pt')
        if (k !== 'content') assert.notEqual(v.pose, 'working', `estação ${k} trabalhando`)
        if (v.pose === 'working') assert.ok(k === 'content' && exec != null && exec > 0 && !err, 'trabalhando sem EXECUTING real')
        if (st[k].kind === 'unknown') assert.equal(v.pose, 'off', `${k} desconhecida deve ficar desligada`)
      }
      // só fila (sem EXECUTING) na estação 4: ninguém trabalha
      if (!exec && !err) assert.notEqual(robotView(st.content, 'pt').pose, 'working', 'fila não é trabalho')
      // erro na consulta de ações: estação 4 desligada, nunca descansando
      if (err) assert.equal(robotView(st.content, 'pt').pose, 'off')
      // sem Instagram: estação 5 desligada "Indisponível"
      if (!ig) { const r = robotView(st.conversion, 'pt'); assert.equal(r.pose, 'off'); assert.equal(r.label, 'Indisponível') }
    }
console.log(`  ${combos} combinações de dados conferidas`)

// 5) frase da cortina: só dado real; desconhecido não vira "nada pendente"
assert.equal(curtainSummary({ loading: false, opps: 1, pieces: 4, problems: 0 }, 'pt'), '1 oportunidade aguardando você · 4 peças para aprovar')
assert.equal(curtainSummary({ loading: false, opps: 0, pieces: 0, problems: 0 }, 'pt'), 'Nada aguardando você agora.')
assert.equal(curtainSummary({ loading: false, opps: null, pieces: null, problems: 0 }, 'pt'), 'Não foi possível verificar oportunidades e peças')
assert.match(curtainSummary({ loading: false, opps: 2, pieces: null, problems: 0 }, 'pt'), /2 oportunidades aguardando você · não foi possível verificar peças/)
assert.doesNotMatch(curtainSummary({ loading: false, opps: 0, pieces: null, problems: 0 }, 'pt'), /Nada aguardando/)
assert.match(curtainSummary({ loading: true, opps: null, pieces: null, problems: 0 }, 'pt'), /Verificando/)
assert.match(curtainSummary({ loading: false, opps: 0, pieces: 0, problems: 1 }, 'pt'), /1 estação com problema/)
console.log('test-robot-state: ok')
