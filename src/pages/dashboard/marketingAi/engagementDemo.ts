// Engagement — automações de comentário/DM do Instagram.
// O cérebro fica no SalesBoost; o Instagram é só o canal. Cada automação liga
// Post/Campanha → gatilho → intenção → ação, e a execução passa por Approvals.
import { seededRng } from './growthDemo'
import type { CompanyData } from '../../../contexts/CompanyContext'

export type TriggerType = 'ig_comment' | 'ig_dm' | 'mention'
export type IntentType = 'keyword' | 'ai_intent' | 'any' | 'question' | 'purchase_intent' | 'positive'
export type ActionType = 'send_dm' | 'create_lead' | 'start_qualification' | 'answer_question'
export type ExecutionMode = 'manual' | 'automatic'
export type EventStatus = 'detected' | 'awaiting_approval' | 'sent' | 'failed' | 'lead_created'

export interface EngagementAutomation {
  id: string
  company_id?: string
  name: string
  active: boolean
  trigger_type: TriggerType
  intent_type: IntentType
  keywords: string[]
  media_ref: string | null
  post_id: string | null
  campaign_id: string | null
  action_type: ActionType
  message: string | null
  create_lead: boolean
  execution_mode: ExecutionMode
  allowed_auto_actions: string[]
  created_at?: string
}

export interface EngagementEvent {
  id: string
  automation_id: string | null
  ig_user: string | null
  comment_text: string | null
  media_ref: string | null
  intent_detected: string | null
  ai_interpretation: string | null
  action_type: string | null
  action_message: string | null
  status: EventStatus
  agent_action_id: string | null
  error: string | null
  created_at: string
}

export const TRIGGER_META: Record<TriggerType, { label: string; icon: string }> = {
  ig_comment: { label: 'Comentário no Instagram', icon: '💬' },
  ig_dm: { label: 'DM no Instagram', icon: '✉️' },
  mention: { label: 'Menção', icon: '📣' },
}
export const INTENT_META: Record<IntentType, { label: string; desc: string }> = {
  keyword: { label: 'Palavra-chave', desc: 'Dispara quando o comentário contém uma das palavras.' },
  ai_intent: { label: 'IA entende a intenção', desc: 'A IA interpreta o sentido (ex.: "me manda", "quero o material", "onde consigo?").' },
  any: { label: 'Qualquer comentário', desc: 'Qualquer comentário no post dispara.' },
  question: { label: 'Pergunta', desc: 'Quando o comentário é uma pergunta.' },
  purchase_intent: { label: 'Intenção de compra', desc: 'Quando demonstra interesse em comprar/preço.' },
  positive: { label: 'Sentimento positivo', desc: 'Quando o comentário é elogioso/positivo.' },
}
export const ACTION_META: Record<ActionType, { label: string; icon: string; desc: string }> = {
  send_dm: { label: 'Enviar DM', icon: '✉️', desc: 'Manda uma mensagem direta com o recurso prometido.' },
  create_lead: { label: 'Criar lead', icon: '🧲', desc: 'Registra a pessoa como lead no funil.' },
  start_qualification: { label: 'Iniciar qualificação', icon: '🎯', desc: 'Começa uma conversa de qualificação.' },
  answer_question: { label: 'Responder dúvida', icon: '💡', desc: 'A IA responde uma pergunta simples.' },
}
export const EVENT_STATUS_META: Record<EventStatus, { label: string; color: string }> = {
  detected: { label: 'Detectado', color: '#60a5fa' },
  awaiting_approval: { label: 'Aguardando aprovação', color: '#FBBF24' },
  sent: { label: 'Enviado', color: '#4ade80' },
  failed: { label: 'Falhou', color: '#f87171' },
  lead_created: { label: 'Lead criado', color: '#4ade80' },
}

// Ações que PODEM ser auto-executadas (proteção granular do modo automático).
export const AUTO_ACTION_OPTIONS: { key: string; label: string }[] = [
  { key: 'send_dm', label: 'Enviar recurso por DM' },
  { key: 'answer_question', label: 'Responder dúvidas simples' },
  { key: 'create_lead', label: 'Criar lead' },
  { key: 'purchase_inquiry', label: 'Tratar interesse de compra' },
  { key: 'offer_discount', label: 'Oferecer desconto' },
  { key: 'escalate_complaint', label: 'Escalar reclamação' },
]

export function emptyAutomation(): EngagementAutomation {
  return {
    id: 'new', name: '', active: true, trigger_type: 'ig_comment', intent_type: 'ai_intent',
    keywords: [], media_ref: null, post_id: null, campaign_id: null,
    action_type: 'send_dm', message: '', create_lead: true,
    execution_mode: 'manual', allowed_auto_actions: ['send_dm'],
  }
}

export function buildEngagementDemo(company: Pick<CompanyData, 'id' | 'business_name'>): {
  automations: EngagementAutomation[]; events: EngagementEvent[]
} {
  const rng = seededRng((company.id || company.business_name || 'demo') + ':engage')
  const iso = (h: number) => new Date(Date.now() - h * 3600000).toISOString()

  const automations: EngagementAutomation[] = [
    {
      id: 'demo_a1', name: 'Checklist grátis', active: true, trigger_type: 'ig_comment', intent_type: 'ai_intent',
      keywords: ['eu quero', 'quero', 'me manda', 'quero o material', 'onde consigo'], media_ref: null, post_id: null, campaign_id: null,
      action_type: 'send_dm', message: 'Oi! 👋 Aqui está o checklist que você pediu: [link]. Qualquer dúvida, é só responder por aqui!',
      create_lead: true, execution_mode: 'automatic', allowed_auto_actions: ['send_dm'],
    },
    {
      id: 'demo_a2', name: 'Cupom de desconto', active: true, trigger_type: 'ig_comment', intent_type: 'keyword',
      keywords: ['cupom', 'desconto', 'eu quero'], media_ref: null, post_id: null, campaign_id: null,
      action_type: 'send_dm', message: 'Toma seu cupom de 15%: BEMVINDO15 🎉 Válido essa semana!',
      create_lead: true, execution_mode: 'manual', allowed_auto_actions: [],
    },
    {
      id: 'demo_a3', name: 'Análise gratuita (qualifica)', active: false, trigger_type: 'ig_comment', intent_type: 'purchase_intent',
      keywords: [], media_ref: null, post_id: null, campaign_id: null,
      action_type: 'start_qualification', message: 'Que ótimo! Pra montar sua análise, me conta rapidinho: qual o seu maior desafio hoje?',
      create_lead: true, execution_mode: 'manual', allowed_auto_actions: [],
    },
  ]

  const users = ['@joao.silva', '@maria_costa', '@carlos.eventos', '@ana.beleza', '@pedro_fit', '@lucia.doces']
  const comments = ['EU QUERO', 'quero o material', 'me manda por favor', 'onde consigo?', 'quero saber o preço', 'EU QUERO o cupom']
  const intents = ['Pedido de recurso', 'Pedido de recurso', 'Pedido de recurso', 'Pedido de recurso', 'Intenção de compra', 'Pedido de recurso']
  const statuses: EventStatus[] = ['sent', 'sent', 'awaiting_approval', 'sent', 'awaiting_approval', 'lead_created']

  const events: EngagementEvent[] = users.map((u, i) => ({
    id: `demo_e${i}`, automation_id: i % 2 === 0 ? 'demo_a1' : 'demo_a2',
    ig_user: u, comment_text: comments[i], media_ref: null,
    intent_detected: intents[i],
    ai_interpretation: intents[i] === 'Intenção de compra'
      ? 'Esta pessoa demonstrou interesse em comprar — vale qualificar antes de enviar oferta.'
      : 'Esta pessoa está pedindo o recurso prometido na campanha.',
    action_type: intents[i] === 'Intenção de compra' ? 'create_lead' : 'send_dm',
    action_message: automations[i % 2].message,
    status: statuses[i], agent_action_id: null, error: null,
    created_at: iso(Math.round(rng() * 48)),
  }))

  return { automations, events }
}

export function activityCounts(events: EngagementEvent[]) {
  return {
    detected: events.length,
    understood: events.filter(e => e.intent_detected).length,
    sent: events.filter(e => e.status === 'sent').length,
    awaiting: events.filter(e => e.status === 'awaiting_approval').length,
    failed: events.filter(e => e.status === 'failed').length,
    leads: events.filter(e => e.status === 'lead_created' || e.action_type === 'create_lead').length,
  }
}
