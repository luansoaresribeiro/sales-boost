// ── Dados demo do Funil de Vendas + Atendimento WhatsApp (Fase 3) ────────
// Mesma lógica demo-first das fases anteriores: números estáveis por empresa,
// mesma FORMA que o CRM real (tabela leads/lead_messages) e a WhatsApp
// Business API vão preencher quando as integrações entrarem ao vivo.
import type { CompanyData } from '../../../contexts/CompanyContext'
import { seededRng } from './growthDemo'
import type { Lang } from '../../../contexts/LanguageContext'

// ── Canal de origem (Instagram | WhatsApp) ────────────────────────────────
// Origem real do cliente/conversa. Vale para Funil e Atendimento: definida
// pela integração que criou o registro (não é estado do frontend). Quando as
// integrações reais entrarem, populam este mesmo campo.
export type Channel = 'instagram' | 'whatsapp'
export const CHANNEL_META: Record<Channel, { label: string; icon: string }> = {
  instagram: { label: 'Instagram', icon: '📷' },
  whatsapp: { label: 'WhatsApp', icon: '💬' },
}

// ── Funil ────────────────────────────────────────────────────────────────
export type LeadTemp = 'quente' | 'morno' | 'frio'
export type LeadStageKey = 'novo' | 'contato' | 'qualificado' | 'proposta' | 'venda'

export interface DemoLead {
  id: string; name: string; channel: string; channelKey: Channel; stageKey: LeadStageKey
  temperature: LeadTemp; value: number; lastContact: string; note: string; noReply: boolean
}

export const STAGE_LABEL_EN: Record<LeadStageKey, string> = {
  novo: 'New Lead', contato: 'Contacted', qualificado: 'Qualified', proposta: 'Proposal', venda: 'Sale closed',
}

export const STAGE_ORDER: { key: LeadStageKey; label: string }[] = [
  { key: 'novo', label: 'Novo Lead' },
  { key: 'contato', label: 'Contato realizado' },
  { key: 'qualificado', label: 'Qualificado' },
  { key: 'proposta', label: 'Proposta' },
  { key: 'venda', label: 'Venda realizada' },
]

export const TEMP_META: Record<LeadTemp, { label: string; color: string }> = {
  quente: { label: 'Quente', color: '#f87171' },
  morno: { label: 'Morno', color: '#FBBF24' },
  frio: { label: 'Frio', color: '#60a5fa' },
}

const NAMES = ['Ana Costa', 'Bruno Lima', 'Carla Souza', 'Diego Alves', 'Fernanda Rocha', 'Gustavo Dias', 'Helena Martins', 'Igor Nunes', 'Juliana Prado', 'Lucas Ferreira', 'Marina Gomes', 'Rafael Pinto', 'Sofia Ribeiro', 'Thiago Melo', 'Vanessa Cruz', 'Paulo Henrique', 'Beatriz Nogueira', 'Rodrigo Teixeira']
const CHANNELS = ['WhatsApp', 'Instagram', 'Anúncio Meta', 'Site']
const CHANNELS_EN = ['WhatsApp', 'Instagram', 'Meta Ad', 'Website']
const NOTES: Record<LeadStageKey, string[]> = {
  novo: ['Clicou no anúncio e mandou "oi"', 'Comentou "quero saber o preço"', 'Preencheu o formulário do site'],
  contato: ['Respondeu, pediu mais informações', 'Perguntou sobre horários', 'Demonstrou interesse, sem urgência'],
  qualificado: ['Pediu orçamento — alto interesse', 'Encaixa no perfil, tem budget', 'Já comprou de concorrente, aberto a trocar'],
  proposta: ['Proposta enviada, avaliando', 'Pediu desconto, negociando', 'Aguardando decisão do sócio'],
  venda: ['Fechou! Pagamento confirmado', 'Comprou o plano principal', 'Cliente novo, primeiro pedido'],
}
const NOTES_EN: Record<LeadStageKey, string[]> = {
  novo: ['Clicked the ad and sent "hi"', 'Commented "I want to know the price"', 'Filled out the website form'],
  contato: ['Replied, asked for more information', 'Asked about opening hours', 'Showed interest, no urgency'],
  qualificado: ['Asked for a quote — high interest', 'Fits the profile, has budget', 'Already bought from a competitor, open to switching'],
  proposta: ['Proposal sent, reviewing', 'Asked for a discount, negotiating', 'Waiting for the partner\'s decision'],
  venda: ['Closed! Payment confirmed', 'Bought the main plan', 'New customer, first order'],
}
const STAGE_COUNTS: Record<LeadStageKey, [number, number]> = {
  novo: [4, 6], contato: [3, 5], qualificado: [2, 4], proposta: [1, 3], venda: [1, 3],
}
const STAGE_TEMP: Record<LeadStageKey, LeadTemp[]> = {
  novo: ['frio', 'frio', 'morno'], contato: ['frio', 'morno', 'morno'],
  qualificado: ['morno', 'quente', 'quente'], proposta: ['quente', 'quente', 'morno'], venda: ['quente', 'quente', 'quente'],
}
const LAST_CONTACT = ['há 20min', 'há 2h', 'há 5h', 'há 1 dia', 'há 2 dias', 'há 3 dias']
const LAST_CONTACT_EN = ['20min ago', '2h ago', '5h ago', '1 day ago', '2 days ago', '3 days ago']

export interface FunnelDemo { leads: DemoLead[]; pipelineValue: number; noReplyCount: number }

export function buildFunnelDemo(company: Pick<CompanyData, 'id' | 'business_name'>, lang: Lang = 'pt'): FunnelDemo {
  const en = lang === 'en'
  const rng = seededRng((company.id || company.business_name || 'demo') + ':funil')
  const iBetween = (min: number, max: number) => Math.round(min + rng() * (max - min))
  const pick = <T,>(arr: T[]): T => arr[Math.floor(rng() * arr.length)]

  const leads: DemoLead[] = []
  let n = 0
  for (const { key } of STAGE_ORDER) {
    const [lo, hi] = STAGE_COUNTS[key]
    const count = iBetween(lo, hi)
    for (let i = 0; i < count; i++) {
      const early = key === 'novo' || key === 'contato'
      const noReply = early && rng() < 0.4
      const channelPt = pick(CHANNELS)
      const channel = en ? CHANNELS_EN[CHANNELS.indexOf(channelPt)] : channelPt
      // Origem principal: leads de "Site"/"Anúncio Meta" caem no WhatsApp ou
      // Instagram (é por onde a conversa acontece). WhatsApp e Instagram
      // mantêm a própria origem.
      const channelKey: Channel = channelPt === 'Instagram' ? 'instagram'
        : channelPt === 'WhatsApp' ? 'whatsapp'
        : (rng() < 0.5 ? 'whatsapp' : 'instagram')
      leads.push({
        id: `lead_${n}`,
        name: NAMES[n % NAMES.length],
        channel,
        channelKey,
        stageKey: key,
        temperature: pick(STAGE_TEMP[key]),
        value: iBetween(2, 30) * 100,
        lastContact: (() => { const v = pick(LAST_CONTACT); return en ? LAST_CONTACT_EN[LAST_CONTACT.indexOf(v)] : v })(),
        note: (() => { const v = pick(NOTES[key]); return en ? NOTES_EN[key][NOTES[key].indexOf(v)] : v })(),
        noReply,
      })
      n++
    }
  }

  const pipelineValue = leads.filter(l => l.stageKey !== 'venda').reduce((s, l) => s + l.value, 0)
  const noReplyCount = leads.filter(l => l.noReply).length
  return { leads, pipelineValue, noReplyCount }
}

// ── Atendimento WhatsApp ─────────────────────────────────────────────────
export type WaStatus = 'ia_respondendo' | 'qualificado' | 'aguardando_humano' | 'agendado'

export const WA_STATUS_META: Record<WaStatus, { label: string; color: string }> = {
  ia_respondendo: { label: 'IA respondendo', color: '#4ade80' },
  qualificado: { label: 'Qualificado', color: '#FF6D29' },
  aguardando_humano: { label: 'Aguardando humano', color: '#FBBF24' },
  agendado: { label: 'Reunião agendada', color: '#60a5fa' },
}

export interface DemoWaMessage { from: 'cliente' | 'agente'; text: string; time: string }
export interface DemoWaConversation {
  id: string; name: string; channelKey: Channel; status: WaStatus; unread: number; lastPreview: string; messages: DemoWaMessage[]
}

// Fila de follow-up: clientes que esfriaram e o agente rascunhou uma mensagem
// pra reaquecer — sempre esperando aprovação (nunca envia sozinho).
export interface FollowUpItem {
  id: string; name: string; channel: string; channelKey: Channel; lastContact: string
  reason: string; draft: string; temperature: LeadTemp
}

export const WA_STATUS_LABEL_EN: Record<WaStatus, string> = {
  ia_respondendo: 'AI replying', qualificado: 'Qualified', aguardando_humano: 'Waiting for human', agendado: 'Meeting scheduled',
}
export const TEMP_LABEL_EN: Record<LeadTemp, string> = { quente: 'Hot', morno: 'Warm', frio: 'Cold' }

export type AutonomyLevel = 'suggest' | 'approve' | 'auto'
export const AUTONOMY_META: Record<AutonomyLevel, { label: string; hint: string }> = {
  suggest: { label: 'Só sugerir', hint: 'A IA escreve, você copia e envia.' },
  approve: { label: 'Aprovar antes', hint: 'A IA rascunha e envia após seu ok.' },
  auto: { label: 'Responder sozinho', hint: 'A IA responde na hora; te chama só no que for sensível.' },
}

export const AUTONOMY_META_EN: Record<AutonomyLevel, { label: string; hint: string }> = {
  suggest: { label: 'Suggest only', hint: 'The AI writes, you copy and send.' },
  approve: { label: 'Approve first', hint: 'The AI drafts and sends after your OK.' },
  auto: { label: 'Reply on its own', hint: 'The AI replies right away; it only calls you for sensitive matters.' },
}

export interface WhatsAppDemo {
  conversations: DemoWaConversation[]
  knowledge: { faq: string[]; products: string[] }
  followUps: FollowUpItem[]
  handoff: { autonomy: AutonomyLevel; activeFrom: string; activeTo: string }
}

export function buildWhatsAppDemo(company: Pick<CompanyData, 'id' | 'business_name' | 'business_type'>, lang: Lang = 'pt'): WhatsAppDemo {
  if (lang === 'en') return buildWhatsAppDemoEn(company)
  const biz = company.business_name || 'sua empresa'
  const type = company.business_type || 'negócio'

  const conversations: DemoWaConversation[] = [
    {
      id: 'wa_1', name: 'Ana Costa', channelKey: 'whatsapp', status: 'qualificado', unread: 0,
      lastPreview: 'Perfeito, pode me mandar o orçamento?',
      messages: [
        { from: 'cliente', text: 'Oi, vi o anúncio de vocês. Como funciona?', time: '09:12' },
        { from: 'agente', text: `Oi, Ana! Que bom te ver por aqui 😊 Somos a ${biz}. Me conta rapidinho o que você está procurando pra eu já te indicar a melhor opção?`, time: '09:12' },
        { from: 'cliente', text: 'Quero algo pra esse fim de semana', time: '09:14' },
        { from: 'agente', text: 'Temos disponibilidade sim! O valor fica a partir de R$ 250. Quer que eu já reserve pra você?', time: '09:14' },
        { from: 'cliente', text: 'Perfeito, pode me mandar o orçamento?', time: '09:15' },
      ],
    },
    {
      id: 'wa_2', name: 'Bruno Lima', channelKey: 'instagram', status: 'ia_respondendo', unread: 2,
      lastPreview: 'E vocês atendem na zona sul?',
      messages: [
        { from: 'cliente', text: 'Bom dia! Vocês têm plano mensal?', time: '10:01' },
        { from: 'agente', text: 'Bom dia, Bruno! Temos sim. O plano mensal sai por R$ 197 e inclui tudo do pacote básico. Quer os detalhes?', time: '10:01' },
        { from: 'cliente', text: 'E vocês atendem na zona sul?', time: '10:03' },
      ],
    },
    {
      id: 'wa_3', name: 'Carla Souza', channelKey: 'whatsapp', status: 'aguardando_humano', unread: 1,
      lastPreview: 'Preciso de uma condição especial pra 3 unidades',
      messages: [
        { from: 'cliente', text: 'Oi, queria fechar pra minha empresa inteira', time: '11:20' },
        { from: 'agente', text: 'Que ótimo, Carla! Pra pedidos maiores eu vou chamar alguém do time pra fazer uma condição sob medida pra você. Só um instante 🙌', time: '11:20' },
        { from: 'cliente', text: 'Preciso de uma condição especial pra 3 unidades', time: '11:21' },
      ],
    },
    {
      id: 'wa_4', name: 'Diego Alves', channelKey: 'instagram', status: 'agendado', unread: 0,
      lastPreview: 'Combinado, quinta às 15h!',
      messages: [
        { from: 'cliente', text: 'Consigo uma demonstração?', time: '14:40' },
        { from: 'agente', text: 'Claro! Tenho horário quinta às 15h ou sexta às 10h. Qual fica melhor pra você?', time: '14:41' },
        { from: 'cliente', text: 'Quinta às 15h', time: '14:42' },
        { from: 'agente', text: 'Combinado, quinta às 15h! Já bloqueei na agenda e avisei o time. Até lá 👋', time: '14:42' },
      ],
    },
  ]

  const knowledge = {
    faq: ['Horário de funcionamento', 'Formas de pagamento', 'Área de atendimento / entrega', 'Política de cancelamento', 'Prazos'],
    products: [`Pacote básico da ${biz}`, 'Plano mensal (R$ 197)', 'Plano Pro', `Serviços avulsos de ${type}`],
  }

  const followUps: FollowUpItem[] = [
    { id: 'fu_1', name: 'Gustavo Dias', channel: 'WhatsApp', channelKey: 'whatsapp', lastContact: 'há 2 dias', temperature: 'quente', reason: 'Pediu orçamento e não respondeu depois do valor.', draft: `Oi, Gustavo! Passando pra saber se ficou alguma dúvida sobre o orçamento 😊 Se quiser, consigo segurar a condição até amanhã. Quer que eu reserve?` },
    { id: 'fu_2', name: 'Helena Martins', channel: 'Instagram', channelKey: 'instagram', lastContact: 'há 3 dias', temperature: 'morno', reason: 'Demonstrou interesse mas sumiu antes de agendar.', draft: `Oi, Helena! Vi que você tinha interesse em conhecer a ${biz}. Tenho um horário essa semana — quer que eu te mostre como funciona, sem compromisso?` },
    { id: 'fu_3', name: 'Rafael Pinto', channel: 'WhatsApp', channelKey: 'whatsapp', lastContact: 'há 5 dias', temperature: 'morno', reason: 'Conversou, pediu pra pensar e não voltou.', draft: `Oi, Rafael! Tudo certo? Fiquei à disposição pra qualquer dúvida sobre o que conversamos. Posso te ajudar a decidir?` },
    { id: 'fu_4', name: 'Beatriz Nogueira', channel: 'Instagram', channelKey: 'instagram', lastContact: 'há 6 dias', temperature: 'frio', reason: 'Comentou num post, mandou "oi" no direct e não seguiu.', draft: `Oi, Beatriz! Você chegou até a gente pelo Instagram 🙌 Ainda dá tempo de aproveitar. Quer que eu te explique rapidinho como funciona?` },
  ]

  return {
    conversations, knowledge, followUps,
    handoff: { autonomy: 'approve', activeFrom: '08:00', activeTo: '20:00' },
  }
}

function buildWhatsAppDemoEn(company: Pick<CompanyData, 'id' | 'business_name' | 'business_type'>): WhatsAppDemo {
  const biz = company.business_name || 'your company'
  const type = company.business_type || 'business'

  const conversations: DemoWaConversation[] = [
    {
      id: 'wa_1', name: 'Ana Costa', channelKey: 'whatsapp', status: 'qualificado', unread: 0,
      lastPreview: 'Perfect, can you send me the quote?',
      messages: [
        { from: 'cliente', text: 'Hi, I saw your ad. How does it work?', time: '09:12' },
        { from: 'agente', text: `Hi, Ana! Great to see you here 😊 We are ${biz}. Tell me quickly what you are looking for so I can point you to the best option?`, time: '09:12' },
        { from: 'cliente', text: 'I want something for this weekend', time: '09:14' },
        { from: 'agente', text: 'We do have availability! The price starts at R$ 250. Want me to book it for you?', time: '09:14' },
        { from: 'cliente', text: 'Perfect, can you send me the quote?', time: '09:15' },
      ],
    },
    {
      id: 'wa_2', name: 'Bruno Lima', channelKey: 'instagram', status: 'ia_respondendo', unread: 2,
      lastPreview: 'Do you serve the south zone?',
      messages: [
        { from: 'cliente', text: 'Good morning! Do you have a monthly plan?', time: '10:01' },
        { from: 'agente', text: 'Good morning, Bruno! We do. The monthly plan is R$ 197 and includes everything in the basic package. Want the details?', time: '10:01' },
        { from: 'cliente', text: 'Do you serve the south zone?', time: '10:03' },
      ],
    },
    {
      id: 'wa_3', name: 'Carla Souza', channelKey: 'whatsapp', status: 'aguardando_humano', unread: 1,
      lastPreview: 'I need a special deal for 3 units',
      messages: [
        { from: 'cliente', text: 'Hi, I wanted to close for my whole company', time: '11:20' },
        { from: 'agente', text: 'That\'s great, Carla! For larger orders I\'ll bring in someone from the team to tailor a deal for you. Just a moment 🙌', time: '11:20' },
        { from: 'cliente', text: 'I need a special deal for 3 units', time: '11:21' },
      ],
    },
    {
      id: 'wa_4', name: 'Diego Alves', channelKey: 'instagram', status: 'agendado', unread: 0,
      lastPreview: 'Deal, Thursday at 3pm!',
      messages: [
        { from: 'cliente', text: 'Can I get a demo?', time: '14:40' },
        { from: 'agente', text: 'Sure! I have a slot Thursday at 3pm or Friday at 10am. Which works better for you?', time: '14:41' },
        { from: 'cliente', text: 'Thursday at 3pm', time: '14:42' },
        { from: 'agente', text: 'Deal, Thursday at 3pm! I\'ve blocked it on the calendar and let the team know. See you then 👋', time: '14:42' },
      ],
    },
  ]

  const knowledge = {
    faq: ['Opening hours', 'Payment methods', 'Service / delivery area', 'Cancellation policy', 'Lead times'],
    products: [`${biz} basic package`, 'Monthly plan (R$ 197)', 'Pro plan', `One-off ${type} services`],
  }

  const followUps: FollowUpItem[] = [
    { id: 'fu_1', name: 'Gustavo Dias', channel: 'WhatsApp', channelKey: 'whatsapp', lastContact: '2 days ago', temperature: 'quente', reason: 'Asked for a quote and did not reply after the price.', draft: `Hi, Gustavo! Just checking if you had any questions about the quote 😊 If you like, I can hold the deal until tomorrow. Want me to reserve it?` },
    { id: 'fu_2', name: 'Helena Martins', channel: 'Instagram', channelKey: 'instagram', lastContact: '3 days ago', temperature: 'morno', reason: 'Showed interest but vanished before scheduling.', draft: `Hi, Helena! I saw you were interested in getting to know ${biz}. I have a slot this week — want me to show you how it works, no commitment?` },
    { id: 'fu_3', name: 'Rafael Pinto', channel: 'WhatsApp', channelKey: 'whatsapp', lastContact: '5 days ago', temperature: 'morno', reason: 'Talked, asked to think about it and did not come back.', draft: `Hi, Rafael! All good? I'm here for any questions about what we discussed. Can I help you decide?` },
    { id: 'fu_4', name: 'Beatriz Nogueira', channel: 'Instagram', channelKey: 'instagram', lastContact: '6 days ago', temperature: 'frio', reason: 'Commented on a post, sent "hi" in the DM and did not follow up.', draft: `Hi, Beatriz! You found us through Instagram 🙌 There is still time to take advantage. Want me to quickly explain how it works?` },
  ]

  return {
    conversations, knowledge, followUps,
    handoff: { autonomy: 'approve', activeFrom: '08:00', activeTo: '20:00' },
  }
}
