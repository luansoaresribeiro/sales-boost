// Robôs da fábrica (C.2.1): o que cada robô MOSTRA a partir do estado real da estação. Lógica pura (sem three, sem React) pra ser
// testada em scripts/test-robot-state.mjs. Regra do dono: "tudo o que se vê corresponde ao que o sistema realmente está fazendo".
//   Trabalhando  = só execução real (agent_actions.execution_status = EXECUTING). Fila/agendada NÃO é trabalho.
//   Esperando você = tem algo pra o dono aprovar.   Descansando = nada pra fazer agora.   Com problema = falha real.
//   Desligado = não dá pra saber ("Não foi possível verificar") ou falta pré-requisito ("Indisponível") — nunca parece Descansando.
import type { Lang } from '../../../../contexts/LanguageContext'
import type { StateKind, StationInfo, StationKey } from './factoryState'

export type RobotPose = 'working' | 'waiting' | 'resting' | 'problem' | 'off'

// Mapa único estado → pose. Qualquer estado novo precisa entrar aqui (o tipo Record obriga).
export const ROBOT_POSE: Record<StateKind, RobotPose> = {
  processing: 'working',
  approval: 'waiting',
  standby: 'resting', recent: 'resting', scheduled: 'resting', queued: 'resting', late: 'resting', // "Atrasada" tem aviso próprio, mas NÃO é trabalho
  failed: 'problem',
  unknown: 'off', unavailable: 'off',
}

// Estações que têm sinal de execução AO VIVO. Hoje só a 4 (Ativação): as outras gravam só DEPOIS de terminar (varredura, plano,
// estratégia, medição), então nunca há como saber que estão rodando agora — ficam fora (nunca "Trabalhando") até existir esse sinal.
export const LIVE_SIGNAL_STATIONS: readonly StationKey[] = ['content']

export function robotPose(key: StationKey, kind: StateKind): RobotPose {
  const pose = ROBOT_POSE[kind]
  if (pose === 'working' && !LIVE_SIGNAL_STATIONS.includes(key)) return 'resting' // defesa: sem sinal ao vivo, jamais trabalha
  return pose
}

const LABEL = {
  pt: { working: 'Trabalhando', waiting: 'Esperando você', resting: 'Descansando', problem: 'Com problema', unknown: 'Não foi possível verificar', unavailable: 'Indisponível' },
  en: { working: 'Working', waiting: 'Waiting for you', resting: 'Resting', problem: 'Has a problem', unknown: 'Could not verify', unavailable: 'Unavailable' },
} as const

export interface RobotView { pose: RobotPose; label: string; delayed: boolean }

// Rótulo do robô. Desligado usa o texto do próprio estado ("Verificando…" enquanto carrega, "Não foi possível verificar" depois,
// "Indisponível" quando falta pré-requisito) — nunca "Descansando".
export function robotView(info: Pick<StationInfo, 'key' | 'kind' | 'stateLabel'>, lang: Lang): RobotView {
  const pose = robotPose(info.key, info.kind)
  const label = pose === 'off' ? (info.kind === 'unavailable' ? LABEL[lang].unavailable : info.stateLabel || LABEL[lang].unknown) : LABEL[lang][pose]
  return { pose, label, delayed: info.kind === 'late' }
}

// Cor da luz/bolinha por pose (2D: bolinha da cortina, painel e versão leve). Formas diferentes ajudam quem não distingue cor.
export const POSE_COLOR: Record<RobotPose, string> = { working: '#FF6D29', waiting: '#FF6D29', resting: '#cfc6ba', problem: '#e5483a', off: '#5b5753' }

// Frase-resumo da cortina fechada: só dados reais. null = ainda não sabe (nunca vira 0 nem "nada pendente").
export interface SummaryInput { loading: boolean; opps: number | null; pieces: number | null; problems: number }
export function curtainSummary(i: SummaryInput, lang: Lang): string {
  const pt = lang !== 'en'
  if (i.loading) return pt ? 'Verificando o que precisa de você…' : 'Checking what needs you…'
  const parts: string[] = []
  if (i.opps != null && i.opps > 0) parts.push(pt ? `${i.opps} ${i.opps === 1 ? 'oportunidade aguardando você' : 'oportunidades aguardando você'}` : `${i.opps} ${i.opps === 1 ? 'opportunity' : 'opportunities'} waiting for you`)
  if (i.pieces != null && i.pieces > 0) parts.push(pt ? `${i.pieces} ${i.pieces === 1 ? 'peça para aprovar' : 'peças para aprovar'}` : `${i.pieces} ${i.pieces === 1 ? 'piece' : 'pieces'} to approve`)
  if (i.problems > 0) parts.push(pt ? `${i.problems} ${i.problems === 1 ? 'estação com problema' : 'estações com problema'}` : `${i.problems} ${i.problems === 1 ? 'station with a problem' : 'stations with a problem'}`)
  const unknown = [i.opps == null ? (pt ? 'oportunidades' : 'opportunities') : null, i.pieces == null ? (pt ? 'peças' : 'pieces') : null].filter(Boolean)
  if (unknown.length) parts.push(pt ? `não foi possível verificar ${unknown.join(' e ')}` : `could not verify ${unknown.join(' and ')}`)
  if (!parts.length) return pt ? 'Nada aguardando você agora.' : 'Nothing waiting for you right now.'
  const s = parts.join(' · ')
  return s.charAt(0).toUpperCase() + s.slice(1)
}
