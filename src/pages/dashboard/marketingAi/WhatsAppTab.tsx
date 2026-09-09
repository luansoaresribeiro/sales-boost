import { useCallback, useEffect, useMemo, useState } from 'react'
import type { CompanyData } from '../../../contexts/CompanyContext'
import { supabase } from '../../../lib/supabase'
import { useRealtime } from '../../../lib/useRealtime'
import { CARD, MUTED, BORDER, D } from './shared'
import { buildWhatsAppDemo, WA_STATUS_META, AUTONOMY_META, TEMP_META, CHANNEL_META, type DemoWaConversation, type AutonomyLevel, type FollowUpItem } from './salesDemo'
import { mapConversations, type ConvRow, type ConvMsgRow } from './salesReal'
import { useDemoMode } from './growthDemo'
import DataVeil, { veilMode } from './DataVeil'
import ChannelFilter, { ChannelBadge, type ChannelFilterValue } from './ChannelFilter'

const ORANGE = '#FF6D29'
const GREEN = '#4ade80'

function StatusBadge({ status }: { status: DemoWaConversation['status'] }) {
  const m = WA_STATUS_META[status]
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '9.5px', fontWeight: 700, color: m.color, flexShrink: 0 }}>
      <span style={{ width: '6px', height: '6px', borderRadius: '99px', background: m.color }} />{m.label}
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
  const timeStyle = { padding: '6px 8px', background: 'rgba(255,255,255,0.04)', border: `1px solid ${BORDER}`, borderRadius: '8px', color: 'white', fontSize: '12px', outline: 'none', fontFamily: D } as const
  return (
    <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: '13px', padding: '15px 17px', display: 'flex', flexWrap: 'wrap', gap: '18px', alignItems: 'center' }}>
      <div>
        <div style={{ fontSize: '10px', fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '7px' }}>Nível de autonomia</div>
        <div style={{ display: 'inline-flex', gap: '4px', padding: '3px', background: 'rgba(255,255,255,0.03)', border: `1px solid ${BORDER}`, borderRadius: '9px' }}>
          {(Object.keys(AUTONOMY_META) as AutonomyLevel[]).map(a => {
            const on = autonomy === a
            return (
              <button key={a} onClick={() => setAutonomy(a)} title={AUTONOMY_META[a].hint}
                style={{ padding: '6px 12px', background: on ? 'rgba(255,109,41,0.12)' : 'transparent', border: `1px solid ${on ? 'rgba(255,109,41,0.35)' : 'transparent'}`, borderRadius: '7px', cursor: 'pointer', fontFamily: D, fontSize: '11.5px', fontWeight: 700, color: on ? ORANGE : MUTED }}>
                {AUTONOMY_META[a].label}
              </button>
            )
          })}
        </div>
        <div style={{ fontSize: '10.5px', color: MUTED, marginTop: '6px' }}>{AUTONOMY_META[autonomy].hint}</div>
      </div>

      <div>
        <div style={{ fontSize: '10px', fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '7px' }}>Horário de atendimento</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
          <input type="time" value={from} onChange={e => setFrom(e.target.value)} style={timeStyle} />
          <span style={{ color: MUTED, fontSize: '12px' }}>até</span>
          <input type="time" value={to} onChange={e => setTo(e.target.value)} style={timeStyle} />
        </div>
        <div style={{ fontSize: '10.5px', color: MUTED, marginTop: '6px' }}>Fora do horário, a IA avisa que responde em breve.</div>
      </div>

      <label style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: '9px', padding: '9px 14px', background: paused ? 'rgba(248,113,113,0.08)' : 'rgba(255,255,255,0.03)', border: `1px solid ${paused ? 'rgba(248,113,113,0.3)' : BORDER}`, borderRadius: '10px', cursor: 'pointer' }}>
        <input type="checkbox" checked={paused} onChange={e => setPaused(e.target.checked)} style={{ width: '16px', height: '16px', accentColor: '#f87171' }} />
        <div>
          <div style={{ fontSize: '12.5px', fontWeight: 700, color: paused ? '#f87171' : 'white' }}>Pausar IA {paused ? '(humano no comando)' : ''}</div>
          <div style={{ fontSize: '10.5px', color: MUTED }}>Para tudo e assume as conversas manualmente.</div>
        </div>
      </label>
    </div>
  )
}

function FollowUpCard({ item, done, onApprove }: { item: FollowUpItem; done: boolean; onApprove: () => void }) {
  const t = TEMP_META[item.temperature]
  return (
    <div style={{ background: CARD, border: `1px solid ${done ? 'rgba(74,222,128,0.25)' : BORDER}`, borderRadius: '12px', padding: '14px 15px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '7px', flexWrap: 'wrap' }}>
        <span style={{ fontSize: '12.5px', fontWeight: 700, color: 'white' }}>{item.name}</span>
        <span style={{ fontSize: '9.5px', fontWeight: 700, color: t.color, border: `1px solid ${t.color}44`, borderRadius: '99px', padding: '2px 8px' }}>{t.label}</span>
        <span style={{ fontSize: '10px', color: MUTED }}>{item.channel} · {item.lastContact}</span>
      </div>
      <div style={{ fontSize: '11px', color: MUTED, lineHeight: 1.5, marginBottom: '9px' }}>💤 {item.reason}</div>
      <div style={{ padding: '10px 12px', background: 'rgba(255,109,41,0.05)', border: '1px solid rgba(255,109,41,0.15)', borderRadius: '9px', fontSize: '12px', color: 'white', lineHeight: 1.55, marginBottom: '10px' }}>
        <span style={{ fontSize: '9px', fontWeight: 700, color: ORANGE, display: 'block', marginBottom: '3px' }}>🤖 RASCUNHO DO AGENTE</span>
        {item.draft}
      </div>
      {done ? (
        <div style={{ fontSize: '11.5px', fontWeight: 700, color: GREEN }}>✓ Aprovado — envia no próximo horário de atendimento</div>
      ) : (
        <div style={{ display: 'flex', gap: '8px' }}>
          <button onClick={onApprove} style={{ padding: '8px 15px', background: ORANGE, color: '#000', fontWeight: 700, fontSize: '12px', border: 'none', borderRadius: '8px', cursor: 'pointer', fontFamily: D }}>Aprovar e enviar</button>
          <button disabled style={{ padding: '8px 15px', background: 'transparent', color: MUTED, fontWeight: 700, fontSize: '12px', border: `1px solid ${BORDER}`, borderRadius: '8px', cursor: 'not-allowed', fontFamily: D, opacity: 0.7 }}>Editar</button>
        </div>
      )}
    </div>
  )
}

export default function WhatsAppTab({ company }: { company: Pick<CompanyData, 'id' | 'business_name' | 'business_type'> }) {
  const demo = useMemo(() => buildWhatsAppDemo(company), [company])
  const [activeId, setActiveId] = useState('')
  const [transferred, setTransferred] = useState<Set<string>>(new Set())
  const [channel, setChannel] = useState<ChannelFilterValue>('all')

  // Conversas REAIS do WhatsApp (whatsapp_conversations + _messages). null =
  // carregando; [] = sem conversa real → cai no demo (design preservado).
  const [realConvs, setRealConvs] = useState<DemoWaConversation[] | null>(null)
  const load = useCallback(async () => {
    const { data: convs } = await supabase.from('whatsapp_conversations')
      .select('id, wa_contact_id, contact_name, created_at').eq('company_id', company.id)
    if (!convs || convs.length === 0) { setRealConvs([]); return }
    const ids = convs.map((c: ConvRow) => c.id)
    const { data: msgs } = await supabase.from('whatsapp_conversation_messages')
      .select('id, conversation_id, role, content, created_at').in('conversation_id', ids).order('created_at', { ascending: true })
    setRealConvs(mapConversations(convs as ConvRow[], (msgs ?? []) as ConvMsgRow[]))
  }, [company.id])
  useEffect(() => { void load() }, [load])
  useRealtime('whatsapp_conversations', company.id, load)

  const isReal = !!realConvs && realConvs.length > 0
  const baseConversations = isReal ? realConvs! : demo.conversations
  const [demoMode, setDemoMode] = useDemoMode(company.id)
  const mode = veilMode({ hasReal: isReal, demoMode })

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
          🟢 <strong>Conversas reais.</strong> Estas são as conversas de verdade do seu WhatsApp, ao vivo. O agente responde, qualifica e <strong>passa pro humano quando precisa</strong>. <span style={{ color: MUTED }}>(A fila de follow-up e o painel de conhecimento abaixo ainda são exemplos — entram em seguida.)</span>
        </div>
      )}
      {mode === 'demo' && (
        <div style={{ padding: '12px 16px', background: 'rgba(251,191,36,0.06)', border: '1px solid rgba(251,191,36,0.22)', borderRadius: '11px', fontSize: '11.5px', color: 'white', lineHeight: 1.6 }}>
          🔵 <strong>Modo demonstração.</strong> Estas conversas são fictícias. Assim que o WhatsApp estiver conectado, as conversas reais aparecem aqui ao vivo (sempre esperando sua aprovação).
        </div>
      )}

      <DataVeil mode={mode}
        title="Sem conversas reais ainda"
        message="Conecte o WhatsApp pra ver as conversas de verdade aqui, ao vivo. Ligue o Modo demonstração pra explorar o layout com exemplos."
        cta={{ label: 'Ver exemplo (modo demonstração)', onClick: () => setDemoMode(true) }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
      <ControlBar autonomy={autonomy} setAutonomy={setAutonomy} from={from} to={to} setFrom={setFrom} setTo={setTo} paused={paused} setPaused={setPaused} />

      {/* Filtro de canal — Instagram e WhatsApp na mesma caixa de atendimento */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
        <ChannelFilter value={channel} onChange={setChannel} />
        <span style={{ fontSize: '11px', color: MUTED }}>Conversas do Instagram e do WhatsApp juntas — filtre pela origem.</span>
      </div>

      {paused && (
        <div style={{ padding: '11px 15px', background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.25)', borderRadius: '11px', fontSize: '12px', color: 'white' }}>
          🙋 <strong style={{ color: '#f87171' }}>IA pausada.</strong> Você assumiu o atendimento — o agente não responde nem envia follow-up até você religar.
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(220px, 0.9fr) minmax(0, 1.6fr)', gap: '14px', alignItems: 'start' }}>
        {/* Lista de conversas */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '7px' }}>
          <div style={{ fontSize: '11px', fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '2px' }}>Conversas</div>
          {conversations.length === 0 && (
            <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.3)', padding: '14px', textAlign: 'center', border: `1px dashed ${BORDER}`, borderRadius: '10px' }}>Nenhuma conversa neste canal.</div>
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
                {isHuman ? <span style={{ fontSize: '9.5px', fontWeight: 700, color: '#FBBF24' }}>🙋 com humano</span> : <StatusBadge status={c.status} />}
              </button>
            )
          })}
        </div>

        {/* Conversa aberta */}
        {active && (
          <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: '13px', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div style={{ padding: '13px 16px', borderBottom: `1px solid ${BORDER}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
              <span style={{ fontSize: '13px', fontWeight: 700, color: 'white' }}>{CHANNEL_META[active.channelKey].icon} {active.name}</span>
              {transferred.has(active.id) ? <span style={{ fontSize: '9.5px', fontWeight: 700, color: '#FBBF24' }}>🙋 com humano</span> : <StatusBadge status={active.status} />}
            </div>

            <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '9px', maxHeight: '340px', overflowY: 'auto' }}>
              {active.messages.map((m, i) => {
                const isAgent = m.from === 'agente'
                return (
                  <div key={i} style={{ display: 'flex', justifyContent: isAgent ? 'flex-end' : 'flex-start' }}>
                    <div style={{ maxWidth: '78%', padding: '8px 12px', borderRadius: '12px', background: isAgent ? 'rgba(255,109,41,0.14)' : 'rgba(255,255,255,0.05)', border: `1px solid ${isAgent ? 'rgba(255,109,41,0.25)' : BORDER}` }}>
                      {isAgent && <div style={{ fontSize: '9px', fontWeight: 700, color: ORANGE, marginBottom: '2px' }}>🤖 Agente IA</div>}
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
                  <span style={{ fontSize: '11.5px', color: '#FBBF24' }}>🙋 Você assumiu esta conversa.</span>
                  <button onClick={() => toggleTransfer(active.id, false)}
                    style={{ padding: '8px 14px', background: 'rgba(74,222,128,0.1)', border: '1px solid rgba(74,222,128,0.3)', color: GREEN, fontWeight: 700, fontSize: '11px', borderRadius: '9px', cursor: 'pointer', fontFamily: D }}>
                    ↩ Devolver pra IA
                  </button>
                </div>
              ) : (
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <div style={{ flex: 1, padding: '9px 12px', background: 'rgba(255,255,255,0.03)', border: `1px solid ${BORDER}`, borderRadius: '9px', fontSize: '11.5px', color: 'rgba(255,255,255,0.3)' }}>
                    {paused ? 'IA pausada — digite pra responder…' : 'O agente responde automaticamente…'}
                  </div>
                  <button onClick={() => toggleTransfer(active.id, true)}
                    style={{ padding: '9px 14px', background: 'transparent', border: `1px solid ${BORDER}`, color: MUTED, fontWeight: 700, fontSize: '11px', borderRadius: '9px', cursor: 'pointer', fontFamily: D, flexShrink: 0 }}>
                    Assumir (humano)
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
          <div style={{ fontSize: '13.5px', fontWeight: 800, color: 'white', fontFamily: D }}>🔁 Fila de follow-up</div>
          <span style={{ fontSize: '10px', fontWeight: 700, color: ORANGE, background: 'rgba(255,109,41,0.1)', borderRadius: '99px', padding: '2px 9px' }}>{followUps.filter(f => !approved.has(f.id)).length} esperando você</span>
        </div>
        <div style={{ fontSize: '11.5px', color: MUTED, marginBottom: '13px', lineHeight: 1.5 }}>
          Clientes que esfriaram. O agente já rascunhou a mensagem pra reaquecer cada um — você aprova e ele envia (nunca sozinho).
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '11px' }}>
          {followUps.map(f => (
            <FollowUpCard key={f.id} item={f} done={approved.has(f.id)} onApprove={() => setApproved(prev => new Set(prev).add(f.id))} />
          ))}
          {followUps.length === 0 && (
            <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.3)', padding: '14px', textAlign: 'center', border: `1px dashed ${BORDER}`, borderRadius: '10px' }}>Nenhum follow-up neste canal.</div>
          )}
        </div>
      </div>

      {/* O que o agente aprende */}
      <div style={{ background: 'rgba(255,255,255,0.02)', border: `1px solid ${BORDER}`, borderRadius: '13px', padding: '16px 18px' }}>
        <div style={{ fontSize: '12.5px', fontWeight: 800, color: 'white', marginBottom: '4px' }}>🧠 O que o agente aprende</div>
        <div style={{ fontSize: '11px', color: MUTED, marginBottom: '13px', lineHeight: 1.5 }}>Ele responde com base no histórico de conversas, nos produtos e no FAQ da sua empresa — quanto mais você alimenta, mais preciso ele fica.</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          <div>
            <div style={{ fontSize: '10px', fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '8px' }}>FAQ</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              {demo.knowledge.faq.map((f, i) => <Chip key={i} text={f} />)}
            </div>
          </div>
          <div>
            <div style={{ fontSize: '10px', fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '8px' }}>Produtos / Serviços</div>
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
