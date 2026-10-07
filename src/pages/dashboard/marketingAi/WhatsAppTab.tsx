import { useCallback, useEffect, useMemo, useState } from 'react'
import type { CompanyData } from '../../../contexts/CompanyContext'
import { supabase } from '../../../lib/supabase'
import { useRealtime } from '../../../lib/useRealtime'
import { useLang } from '../../../contexts/LanguageContext'
import { CARD, MUTED, BORDER, D } from './shared'
import { buildWhatsAppDemo, WA_STATUS_META, AUTONOMY_META, AUTONOMY_META_EN, TEMP_META, TEMP_LABEL_EN, WA_STATUS_LABEL_EN, CHANNEL_META, type DemoWaConversation, type AutonomyLevel, type FollowUpItem } from './salesDemo'
import { mapConversations, mapLeadConversations, type ConvRow, type ConvMsgRow, type LeadRow, type LeadMsgRow } from './salesReal'
import { useDemoMode } from './growthDemo'
import DataVeil, { veilMode } from './DataVeil'
import ChannelFilter, { ChannelBadge, type ChannelFilterValue } from './ChannelFilter'

const ORANGE = '#FF6D29'
const GREEN = '#4ade80'

const TX = {
  pt: {
    me: 'Cliente',
    autonomyLevel: 'Nível de autonomia', hours: 'Horário de atendimento', until: 'até', outside: 'Fora do horário, a IA avisa que responde em breve.',
    pause: 'Pausar IA', humanInCharge: '(humano no comando)', pauseSub: 'Para tudo e assume as conversas manualmente.',
    draftTag: '🤖 RASCUNHO DO AGENTE', approvedMsg: '✓ Aprovado — envia no próximo horário de atendimento', approveSend: 'Aprovar e enviar', edit: 'Editar',
    realBanner1: 'Conversas reais.', realBanner2: ' Estas são as conversas de verdade do seu WhatsApp e/ou DM do Instagram, ao vivo. O agente responde, qualifica e ', realBanner3: 'passa pro humano quando precisa', realBanner4: '. ', realBanner5: '(A fila de follow-up e o painel de conhecimento abaixo ainda são exemplos — entram em seguida.)',
    demoBanner1: 'Modo demonstração.', demoBanner2: ' Estas conversas são fictícias. Assim que o WhatsApp ou o Instagram (DM) estiverem conectados, as conversas reais aparecem aqui ao vivo (sempre esperando sua aprovação).',
    veilErrTitle: 'Erro ao carregar as conversas', veilTitle: 'Sem conversas reais ainda',
    veilErrMsg: 'A consulta ao banco falhou — veja o erro abaixo pra saber o que corrigir.', veilMsg: 'Conecte o WhatsApp pra ver as conversas de verdade aqui, ao vivo. Ligue o Modo demonstração pra explorar o layout com exemplos.',
    ctaDemo: 'Ver exemplo (modo demonstração)', channelNote: 'Conversas do Instagram e do WhatsApp juntas — filtre pela origem.',
    pausedBold: 'IA pausada.', pausedRest: ' Você assumiu o atendimento — o agente não responde nem envia follow-up até você religar.',
    conversations: 'Conversas', noneChannel: 'Nenhuma conversa neste canal.', withHuman: '🙋 com humano', aiAgent: '🤖 Agente IA',
    tookOver: '🙋 Você assumiu esta conversa.', giveBack: '↩ Devolver pra IA', pausedPh: 'IA pausada — digite pra responder…', autoPh: 'O agente responde automaticamente…', takeOver: 'Assumir (humano)',
    followQueue: '🔁 Fila de follow-up', waitingYou: 'esperando você', followSub: 'Clientes que esfriaram. O agente já rascunhou a mensagem pra reaquecer cada um — você aprova e ele envia (nunca sozinho).',
    noFollow: 'Nenhum follow-up neste canal.', learns: '🧠 O que o agente aprende', learnsSub: 'Ele responde com base no histórico de conversas, nos produtos e no FAQ da sua empresa — quanto mais você alimenta, mais preciso ele fica.',
    products: 'Produtos / Serviços',
  },
  en: {
    me: 'Customer',
    autonomyLevel: 'Autonomy level', hours: 'Service hours', until: 'to', outside: 'Outside hours, the AI says it will reply soon.',
    pause: 'Pause AI', humanInCharge: '(human in charge)', pauseSub: 'Stops everything and takes over conversations manually.',
    draftTag: '🤖 AGENT DRAFT', approvedMsg: '✓ Approved — sends at the next service hour', approveSend: 'Approve and send', edit: 'Edit',
    realBanner1: 'Real conversations.', realBanner2: ' These are the real conversations from your WhatsApp and/or Instagram DMs, live. The agent replies, qualifies and ', realBanner3: 'hands over to a human when needed', realBanner4: '. ', realBanner5: '(The follow-up queue and knowledge panel below are still examples — coming next.)',
    demoBanner1: 'Demo mode.', demoBanner2: ' These conversations are fictional. Once WhatsApp or Instagram (DM) is connected, real conversations will appear here live (always waiting for your approval).',
    veilErrTitle: 'Error loading conversations', veilTitle: 'No real conversations yet',
    veilErrMsg: 'The database query failed — see the error below to know what to fix.', veilMsg: 'Connect WhatsApp to see real conversations here, live. Turn on Demo mode to explore the layout with examples.',
    ctaDemo: 'See example (demo mode)', channelNote: 'Instagram and WhatsApp conversations together — filter by source.',
    pausedBold: 'AI paused.', pausedRest: ' You took over the service — the agent does not reply or send follow-ups until you turn it back on.',
    conversations: 'Conversations', noneChannel: 'No conversation on this channel.', withHuman: '🙋 with human', aiAgent: '🤖 AI Agent',
    tookOver: '🙋 You took over this conversation.', giveBack: '↩ Hand back to AI', pausedPh: 'AI paused — type to reply…', autoPh: 'The agent replies automatically…', takeOver: 'Take over (human)',
    followQueue: '🔁 Follow-up queue', waitingYou: 'waiting for you', followSub: 'Customers who went cold. The agent has already drafted the message to warm each one up — you approve and it sends (never on its own).',
    noFollow: 'No follow-up on this channel.', learns: '🧠 What the agent learns', learnsSub: 'It replies based on your company\'s conversation history, products and FAQ — the more you feed it, the more accurate it gets.',
    products: 'Products / Services',
  },
}

function StatusBadge({ status }: { status: DemoWaConversation['status'] }) {
  const { lang } = useLang()
  const m = WA_STATUS_META[status]
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '9.5px', fontWeight: 700, color: m.color, flexShrink: 0 }}>
      <span style={{ width: '6px', height: '6px', borderRadius: '99px', background: m.color }} />{lang === 'en' ? WA_STATUS_LABEL_EN[status] : m.label}
    </span>
  )
}

function Chip({ text }: { text: string }) {
  return <span style={{ fontSize: '11px', color: 'white', background: CARD, border: `1px solid ${BORDER}`, borderRadius: '99px', padding: '5px 11px' }}>{text}</span>
}

// Painel de controle do agente de atendimento — nível de autonomia + horário
// de atendimento + pausa geral (humano assume). Mesmo espírito do handoff do
// Telegram, agora no WhatsApp. Estado local (demo).
function ControlBar({ autonomy, setAutonomy, from, to, setFrom, setTo, paused, setPaused }: {
  autonomy: AutonomyLevel; setAutonomy: (a: AutonomyLevel) => void
  from: string; to: string; setFrom: (v: string) => void; setTo: (v: string) => void
  paused: boolean; setPaused: (v: boolean) => void
}) {
  const { lang } = useLang()
  const t = TX[lang]
  const AM = lang === 'en' ? AUTONOMY_META_EN : AUTONOMY_META
  const timeStyle = { padding: '6px 8px', background: 'rgba(255,255,255,0.04)', border: `1px solid ${BORDER}`, borderRadius: '8px', color: 'white', fontSize: '12px', outline: 'none', fontFamily: D } as const
  return (
    <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: '13px', padding: '15px 17px', display: 'flex', flexWrap: 'wrap', gap: '18px', alignItems: 'center' }}>
      <div>
        <div style={{ fontSize: '10px', fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '7px' }}>{t.autonomyLevel}</div>
        <div style={{ display: 'inline-flex', gap: '4px', padding: '3px', background: 'rgba(255,255,255,0.03)', border: `1px solid ${BORDER}`, borderRadius: '9px' }}>
          {(Object.keys(AUTONOMY_META) as AutonomyLevel[]).map(a => {
            const on = autonomy === a
            return (
              <button key={a} onClick={() => setAutonomy(a)} title={AM[a].hint}
                style={{ padding: '6px 12px', background: on ? 'rgba(255,109,41,0.12)' : 'transparent', border: `1px solid ${on ? 'rgba(255,109,41,0.35)' : 'transparent'}`, borderRadius: '7px', cursor: 'pointer', fontFamily: D, fontSize: '11.5px', fontWeight: 700, color: on ? ORANGE : MUTED }}>
                {AM[a].label}
              </button>
            )
          })}
        </div>
        <div style={{ fontSize: '10.5px', color: MUTED, marginTop: '6px' }}>{AM[autonomy].hint}</div>
      </div>

      <div>
        <div style={{ fontSize: '10px', fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '7px' }}>{t.hours}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
          <input type="time" value={from} onChange={e => setFrom(e.target.value)} style={timeStyle} />
          <span style={{ color: MUTED, fontSize: '12px' }}>{t.until}</span>
          <input type="time" value={to} onChange={e => setTo(e.target.value)} style={timeStyle} />
        </div>
        <div style={{ fontSize: '10.5px', color: MUTED, marginTop: '6px' }}>{t.outside}</div>
      </div>

      <label style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: '9px', padding: '9px 14px', background: paused ? 'rgba(248,113,113,0.08)' : 'rgba(255,255,255,0.03)', border: `1px solid ${paused ? 'rgba(248,113,113,0.3)' : BORDER}`, borderRadius: '10px', cursor: 'pointer' }}>
        <input type="checkbox" checked={paused} onChange={e => setPaused(e.target.checked)} style={{ width: '16px', height: '16px', accentColor: '#f87171' }} />
        <div>
          <div style={{ fontSize: '12.5px', fontWeight: 700, color: paused ? '#f87171' : 'white' }}>{t.pause} {paused ? t.humanInCharge : ''}</div>
          <div style={{ fontSize: '10.5px', color: MUTED }}>{t.pauseSub}</div>
        </div>
      </label>
    </div>
  )
}

function FollowUpCard({ item, done, onApprove }: { item: FollowUpItem; done: boolean; onApprove: () => void }) {
  const { lang } = useLang()
  const tx = TX[lang]
  const t = TEMP_META[item.temperature]
  return (
    <div style={{ background: CARD, border: `1px solid ${done ? 'rgba(74,222,128,0.25)' : BORDER}`, borderRadius: '12px', padding: '14px 15px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '7px', flexWrap: 'wrap' }}>
        <span style={{ fontSize: '12.5px', fontWeight: 700, color: 'white' }}>{item.name}</span>
        <span style={{ fontSize: '9.5px', fontWeight: 700, color: t.color, border: `1px solid ${t.color}44`, borderRadius: '99px', padding: '2px 8px' }}>{lang === 'en' ? TEMP_LABEL_EN[item.temperature] : t.label}</span>
        <span style={{ fontSize: '10px', color: MUTED }}>{item.channel} · {item.lastContact}</span>
      </div>
      <div style={{ fontSize: '11px', color: MUTED, lineHeight: 1.5, marginBottom: '9px' }}>💤 {item.reason}</div>
      <div style={{ padding: '10px 12px', background: 'rgba(255,109,41,0.05)', border: '1px solid rgba(255,109,41,0.15)', borderRadius: '9px', fontSize: '12px', color: 'white', lineHeight: 1.55, marginBottom: '10px' }}>
        <span style={{ fontSize: '9px', fontWeight: 700, color: ORANGE, display: 'block', marginBottom: '3px' }}>{tx.draftTag}</span>
        {item.draft}
      </div>
      {done ? (
        <div style={{ fontSize: '11.5px', fontWeight: 700, color: GREEN }}>{tx.approvedMsg}</div>
      ) : (
        <div style={{ display: 'flex', gap: '8px' }}>
          <button onClick={onApprove} style={{ padding: '8px 15px', background: ORANGE, color: '#000', fontWeight: 700, fontSize: '12px', border: 'none', borderRadius: '8px', cursor: 'pointer', fontFamily: D }}>{tx.approveSend}</button>
          <button disabled style={{ padding: '8px 15px', background: 'transparent', color: MUTED, fontWeight: 700, fontSize: '12px', border: `1px solid ${BORDER}`, borderRadius: '8px', cursor: 'not-allowed', fontFamily: D, opacity: 0.7 }}>{tx.edit}</button>
        </div>
      )}
    </div>
  )
}

export default function WhatsAppTab({ company }: { company: Pick<CompanyData, 'id' | 'business_name' | 'business_type'> }) {
  const { lang } = useLang()
  const t = TX[lang]
  const demo = useMemo(() => buildWhatsAppDemo(company, lang), [company, lang])
  const [activeId, setActiveId] = useState('')
  const [transferred, setTransferred] = useState<Set<string>>(new Set())
  const [channel, setChannel] = useState<ChannelFilterValue>('all')

  // Conversas REAIS — WhatsApp (whatsapp_conversations + _messages) e
  // Instagram (leads + lead_messages, channel='instagram', gravado pelo
  // instagram-webhook a partir de DMs reais) na MESMA caixa. null =
  // carregando; [] = sem conversa real → cai no demo (design preservado).
  const [realConvs, setRealConvs] = useState<DemoWaConversation[] | null>(null)
  // Erro de verdade da consulta — não "ainda não tem conversa" (normal).
  const [loadError, setLoadError] = useState<string | null>(null)
  const load = useCallback(async () => {
    const [{ data: convs, error: convsErr }, { data: igLeads, error: leadsErr }] = await Promise.all([
      supabase.from('whatsapp_conversations').select('id, wa_contact_id, contact_name, created_at').eq('company_id', company.id),
      supabase.from('leads').select('id, name, contact, channel, stage, value_estimate, last_contact_at, notes, created_at').eq('company_id', company.id).eq('channel', 'instagram'),
    ])
    if (convsErr || leadsErr) { setLoadError((convsErr ?? leadsErr)!.message); return }
    let waMapped: DemoWaConversation[] = []
    if (convs && convs.length > 0) {
      const ids = convs.map((c: ConvRow) => c.id)
      const { data: msgs, error: msgsErr } = await supabase.from('whatsapp_conversation_messages')
        .select('id, conversation_id, role, content, created_at').in('conversation_id', ids).order('created_at', { ascending: true })
      if (msgsErr) { setLoadError(msgsErr.message); return }
      waMapped = mapConversations(convs as ConvRow[], (msgs ?? []) as ConvMsgRow[])
    }
    let igMapped: DemoWaConversation[] = []
    if (igLeads && igLeads.length > 0) {
      const leadIds = igLeads.map((l: LeadRow) => l.id)
      const { data: lmsgs, error: lmsgsErr } = await supabase.from('lead_messages')
        .select('id, lead_id, direction, content, created_at').in('lead_id', leadIds).order('created_at', { ascending: true })
      if (lmsgsErr) { setLoadError(lmsgsErr.message); return }
      igMapped = mapLeadConversations(igLeads as LeadRow[], (lmsgs ?? []) as LeadMsgRow[])
    }
    setLoadError(null)
    setRealConvs([...waMapped, ...igMapped])
  }, [company.id])
  useEffect(() => { void load() }, [load])
  useRealtime('whatsapp_conversations', company.id, load)
  useRealtime('lead_messages', company.id, load)

  const isReal = !!realConvs && realConvs.length > 0
  const baseConversations = isReal ? realConvs! : demo.conversations
  const [demoMode, setDemoMode] = useDemoMode(company.id)
  const mode = veilMode({ hasReal: isReal, demoMode, error: !!loadError })

  // Mesma lógica do Funil: uma só caixa de atendimento, filtrada pela origem.
  const conversations = channel === 'all' ? baseConversations : baseConversations.filter(c => c.channelKey === channel)
  const followUps = channel === 'all' ? demo.followUps : demo.followUps.filter(f => f.channelKey === channel)
  // Conversa aberta precisa estar na lista visível; se não estiver, abre a 1ª.
  const active = conversations.find(c => c.id === activeId) ?? conversations[0]

  const [autonomy, setAutonomy] = useState<AutonomyLevel>(demo.handoff.autonomy)
  const [from, setFrom] = useState(demo.handoff.activeFrom)
  const [to, setTo] = useState(demo.handoff.activeTo)
  const [paused, setPaused] = useState(false)
  const [approved, setApproved] = useState<Set<string>>(new Set())

  const toggleTransfer = (id: string, v: boolean) => setTransferred(prev => { const n = new Set(prev); v ? n.add(id) : n.delete(id); return n })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
      {mode === 'real' && (
        <div style={{ padding: '12px 16px', background: 'rgba(74,222,128,0.06)', border: '1px solid rgba(74,222,128,0.22)', borderRadius: '11px', fontSize: '11.5px', color: 'white', lineHeight: 1.6 }}>
          🟢 <strong>{t.realBanner1}</strong>{t.realBanner2}<strong>{t.realBanner3}</strong>{t.realBanner4}<span style={{ color: MUTED }}>{t.realBanner5}</span>
        </div>
      )}
      {mode === 'demo' && (
        <div style={{ padding: '12px 16px', background: 'rgba(251,191,36,0.06)', border: '1px solid rgba(251,191,36,0.22)', borderRadius: '11px', fontSize: '11.5px', color: 'white', lineHeight: 1.6 }}>
          🔵 <strong>{t.demoBanner1}</strong>{t.demoBanner2}
        </div>
      )}

      <DataVeil mode={mode}
        title={loadError ? t.veilErrTitle : t.veilTitle}
        message={loadError ? t.veilErrMsg : t.veilMsg}
        errorDetail={loadError}
        cta={{ label: t.ctaDemo, onClick: () => setDemoMode(true) }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
      <ControlBar autonomy={autonomy} setAutonomy={setAutonomy} from={from} to={to} setFrom={setFrom} setTo={setTo} paused={paused} setPaused={setPaused} />

      {/* Filtro de canal — Instagram e WhatsApp na mesma caixa de atendimento */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
        <ChannelFilter value={channel} onChange={setChannel} />
        <span style={{ fontSize: '11px', color: MUTED }}>{t.channelNote}</span>
      </div>

      {paused && (
        <div style={{ padding: '11px 15px', background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.25)', borderRadius: '11px', fontSize: '12px', color: 'white' }}>
          🙋 <strong style={{ color: '#f87171' }}>{t.pausedBold}</strong>{t.pausedRest}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(220px, 0.9fr) minmax(0, 1.6fr)', gap: '14px', alignItems: 'start' }}>
        {/* Lista de conversas */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '7px' }}>
          <div style={{ fontSize: '11px', fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '2px' }}>{t.conversations}</div>
          {conversations.length === 0 && (
            <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.3)', padding: '14px', textAlign: 'center', border: `1px dashed ${BORDER}`, borderRadius: '10px' }}>{t.noneChannel}</div>
          )}
          {conversations.map(c => {
            const isActive = c.id === active?.id
            const isHuman = transferred.has(c.id)
            return (
              <button key={c.id} onClick={() => setActiveId(c.id)}
                style={{ textAlign: 'left', background: CARD, border: `1px solid ${isActive ? 'rgba(255,109,41,0.4)' : BORDER}`, borderRadius: '10px', padding: '11px 13px', cursor: 'pointer', fontFamily: D }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', marginBottom: '4px' }}>
                  <span style={{ fontSize: '12.5px', fontWeight: 700, color: 'white' }}>{c.name}</span>
                  {c.unread > 0 && <span style={{ fontSize: '9px', fontWeight: 700, background: ORANGE, color: '#000', borderRadius: '99px', padding: '1px 6px' }}>{c.unread}</span>}
                </div>
                <div style={{ marginBottom: '6px' }}><ChannelBadge channel={c.channelKey} /></div>
                <div style={{ fontSize: '11px', color: MUTED, lineHeight: 1.4, marginBottom: '6px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.lastPreview}</div>
                {isHuman ? <span style={{ fontSize: '9.5px', fontWeight: 700, color: '#FBBF24' }}>{t.withHuman}</span> : <StatusBadge status={c.status} />}
              </button>
            )
          })}
        </div>

        {/* Conversa aberta */}
        {active && (
          <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: '13px', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div style={{ padding: '13px 16px', borderBottom: `1px solid ${BORDER}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
              <span style={{ fontSize: '13px', fontWeight: 700, color: 'white' }}>{CHANNEL_META[active.channelKey].icon} {active.name}</span>
              {transferred.has(active.id) ? <span style={{ fontSize: '9.5px', fontWeight: 700, color: '#FBBF24' }}>{t.withHuman}</span> : <StatusBadge status={active.status} />}
            </div>

            <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '9px', maxHeight: '340px', overflowY: 'auto' }}>
              {active.messages.map((m, i) => {
                const isAgent = m.from === 'agente'
                return (
                  <div key={i} style={{ display: 'flex', justifyContent: isAgent ? 'flex-end' : 'flex-start' }}>
                    <div style={{ maxWidth: '78%', padding: '8px 12px', borderRadius: '12px', background: isAgent ? 'rgba(255,109,41,0.14)' : 'rgba(255,255,255,0.05)', border: `1px solid ${isAgent ? 'rgba(255,109,41,0.25)' : BORDER}` }}>
                      {isAgent && <div style={{ fontSize: '9px', fontWeight: 700, color: ORANGE, marginBottom: '2px' }}>{t.aiAgent}</div>}
                      <div style={{ fontSize: '12px', color: 'white', lineHeight: 1.5 }}>{m.text}</div>
                      <div style={{ fontSize: '9px', color: 'rgba(255,255,255,0.3)', marginTop: '3px', textAlign: 'right' }}>{m.time}</div>
                    </div>
                  </div>
                )
              })}
            </div>

            <div style={{ padding: '12px 16px', borderTop: `1px solid ${BORDER}` }}>
              {transferred.has(active.id) ? (
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '11.5px', color: '#FBBF24' }}>{t.tookOver}</span>
                  <button onClick={() => toggleTransfer(active.id, false)}
                    style={{ padding: '8px 14px', background: 'rgba(74,222,128,0.1)', border: '1px solid rgba(74,222,128,0.3)', color: GREEN, fontWeight: 700, fontSize: '11px', borderRadius: '9px', cursor: 'pointer', fontFamily: D }}>
                    {t.giveBack}
                  </button>
                </div>
              ) : (
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <div style={{ flex: 1, padding: '9px 12px', background: 'rgba(255,255,255,0.03)', border: `1px solid ${BORDER}`, borderRadius: '9px', fontSize: '11.5px', color: 'rgba(255,255,255,0.3)' }}>
                    {paused ? t.pausedPh : t.autoPh}
                  </div>
                  <button onClick={() => toggleTransfer(active.id, true)}
                    style={{ padding: '9px 14px', background: 'transparent', border: `1px solid ${BORDER}`, color: MUTED, fontWeight: 700, fontSize: '11px', borderRadius: '9px', cursor: 'pointer', fontFamily: D, flexShrink: 0 }}>
                    {t.takeOver}
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Follow-up */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px', flexWrap: 'wrap' }}>
          <div style={{ fontSize: '13.5px', fontWeight: 800, color: 'white', fontFamily: D }}>{t.followQueue}</div>
          <span style={{ fontSize: '10px', fontWeight: 700, color: ORANGE, background: 'rgba(255,109,41,0.1)', borderRadius: '99px', padding: '2px 9px' }}>{followUps.filter(f => !approved.has(f.id)).length} {t.waitingYou}</span>
        </div>
        <div style={{ fontSize: '11.5px', color: MUTED, marginBottom: '13px', lineHeight: 1.5 }}>
          {t.followSub}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '11px' }}>
          {followUps.map(f => (
            <FollowUpCard key={f.id} item={f} done={approved.has(f.id)} onApprove={() => setApproved(prev => new Set(prev).add(f.id))} />
          ))}
          {followUps.length === 0 && (
            <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.3)', padding: '14px', textAlign: 'center', border: `1px dashed ${BORDER}`, borderRadius: '10px' }}>{t.noFollow}</div>
          )}
        </div>
      </div>

      {/* O que o agente aprende */}
      <div style={{ background: 'rgba(255,255,255,0.02)', border: `1px solid ${BORDER}`, borderRadius: '13px', padding: '16px 18px' }}>
        <div style={{ fontSize: '12.5px', fontWeight: 800, color: 'white', marginBottom: '4px' }}>{t.learns}</div>
        <div style={{ fontSize: '11px', color: MUTED, marginBottom: '13px', lineHeight: 1.5 }}>{t.learnsSub}</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          <div>
            <div style={{ fontSize: '10px', fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '8px' }}>FAQ</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              {demo.knowledge.faq.map((f, i) => <Chip key={i} text={f} />)}
            </div>
          </div>
          <div>
            <div style={{ fontSize: '10px', fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '8px' }}>{t.products}</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              {demo.knowledge.products.map((p, i) => <Chip key={i} text={p} />)}
            </div>
          </div>
        </div>
      </div>
      </div>
    </DataVeil>
    </div>
  )
}
