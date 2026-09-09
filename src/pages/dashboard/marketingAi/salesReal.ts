// ── Adaptadores: dado REAL do banco → mesma FORMA que o design demo usa ──────
// Funil lê da tabela `leads`; Atendimento lê de `whatsapp_conversations` +
// `whatsapp_conversation_messages`. Mapeamos as linhas reais para os mesmos
// tipos do salesDemo, então a tela (o design) não muda — só a fonte do dado.
import {
  CHANNEL_META, type Channel, type DemoLead, type LeadStageKey, type LeadTemp,
  type DemoWaConversation, type DemoWaMessage, type WaStatus,
} from './salesDemo'

// Tempo relativo curto em pt-BR ("agora", "há 20min", "há 2h", "há 3 dias").
export function relTime(iso: string | null): string {
  if (!iso) return ''
  const diff = Date.now() - new Date(iso).getTime()
  const min = Math.floor(diff / 60000)
  if (min < 1) return 'agora'
  if (min < 60) return `há ${min}min`
  const h = Math.floor(min / 60)
  if (h < 24) return `há ${h}h`
  const d = Math.floor(h / 24)
  return `há ${d} ${d === 1 ? 'dia' : 'dias'}`
}

function fmtTime(iso: string): string {
  try { return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) } catch { return '' }
}

// Estágio: aceita valores em inglês (o que os writers gravam hoje, ex.: 'new')
// ou em português, e cai em 'novo' quando não reconhece.
const STAGE_MAP: Record<string, LeadStageKey> = {
  new: 'novo', novo: 'novo', lead: 'novo', open: 'novo',
  contacted: 'contato', contato: 'contato', contact: 'contato',
  qualified: 'qualificado', qualificado: 'qualificado', qualify: 'qualificado',
  proposal: 'proposta', proposta: 'proposta', quote: 'proposta',
  won: 'venda', venda: 'venda', sale: 'venda', closed: 'venda', 'closed_won': 'venda',
}
export function mapStage(stage: string | null): LeadStageKey {
  return STAGE_MAP[(stage ?? '').toLowerCase().trim()] ?? 'novo'
}
// Ao avançar um lead real, gravamos o valor canônico (inglês) de volta.
export const STAGE_TO_DB: Record<LeadStageKey, string> = {
  novo: 'new', contato: 'contacted', qualificado: 'qualified', proposta: 'proposal', venda: 'won',
}

// Temperatura não existe na tabela — derivamos do estágio (quanto mais adiante,
// mais quente), pra manter as bolinhas de calor do design.
const STAGE_TEMP: Record<LeadStageKey, LeadTemp> = {
  novo: 'frio', contato: 'morno', qualificado: 'quente', proposta: 'quente', venda: 'quente',
}

function mapChannel(channel: string | null): Channel {
  return (channel ?? '').toLowerCase().includes('insta') ? 'instagram' : 'whatsapp'
}

export interface LeadRow {
  id: string; name: string | null; contact: string | null; channel: string | null
  stage: string | null; value_estimate: number | null; last_contact_at: string | null
  notes: string | null; created_at: string
}

export function mapLeadRow(r: LeadRow): DemoLead {
  const stageKey = mapStage(r.stage)
  const channelKey = mapChannel(r.channel)
  const last = r.last_contact_at ?? r.created_at
  const noReply = (stageKey === 'novo' || stageKey === 'contato') && (Date.now() - new Date(last).getTime()) > 24 * 3600000
  return {
    id: r.id,
    name: r.name || r.contact || 'Lead',
    channel: CHANNEL_META[channelKey].label,
    channelKey,
    stageKey,
    temperature: STAGE_TEMP[stageKey],
    value: Number(r.value_estimate ?? 0),
    lastContact: relTime(last),
    note: r.notes || '',
    noReply,
  }
}

export interface ConvRow { id: string; wa_contact_id: string; contact_name: string | null; created_at: string }
export interface ConvMsgRow { id: string; conversation_id: string; role: string; content: string; created_at: string }

// Conversas reais do WhatsApp → cartões de Atendimento. Status é derivado: se a
// última mensagem foi do cliente, está aguardando; senão, IA respondendo.
export function mapConversations(convs: ConvRow[], msgs: ConvMsgRow[]): DemoWaConversation[] {
  const byConv = new Map<string, ConvMsgRow[]>()
  for (const m of msgs) {
    const arr = byConv.get(m.conversation_id) ?? []
    arr.push(m); byConv.set(m.conversation_id, arr)
  }
  return convs.map(c => {
    const cm = (byConv.get(c.id) ?? []).sort((a, b) => a.created_at.localeCompare(b.created_at))
    const messages: DemoWaMessage[] = cm.map(m => ({ from: m.role === 'assistant' ? 'agente' : 'cliente', text: m.content, time: fmtTime(m.created_at) }))
    const last = cm[cm.length - 1]
    const status: WaStatus = last && last.role !== 'assistant' ? 'aguardando_humano' : 'ia_respondendo'
    return {
      id: c.id,
      name: c.contact_name || c.wa_contact_id,
      channelKey: 'whatsapp' as Channel,
      status,
      unread: 0,
      lastPreview: last?.content ?? '',
      messages,
    }
  }).sort((a, b) => (b.messages.at(-1)?.time ?? '').localeCompare(a.messages.at(-1)?.time ?? ''))
}
