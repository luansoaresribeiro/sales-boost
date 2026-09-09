import { useCallback, useEffect, useMemo, useState } from 'react'
import type { CompanyData } from '../../../contexts/CompanyContext'
import { supabase } from '../../../lib/supabase'
import { useRealtime } from '../../../lib/useRealtime'
import { CARD, MUTED, BORDER, D } from './shared'
import {
  buildEngagementDemo, emptyAutomation, TRIGGER_META, INTENT_META, ACTION_META, AUTO_ACTION_OPTIONS,
  type EngagementAutomation, type EngagementEvent, type IntentType, type ActionType, type TriggerType, type ExecutionMode,
} from './engagementDemo'
import { ConversationsSection, ActivitySection } from './engagementParts'

const ORANGE = '#FF6D29'
type Sub = 'automations' | 'conversations' | 'activity'

// Engagement — o cérebro/config das automações de Instagram vive no SalesBoost.
// Configurar + entender + monitorar aqui; autorizar continua na Central de
// Approvals. Cada automação liga Post/Campanha → gatilho → intenção → ação.
export default function EngagementTab({ company }: { company: Pick<CompanyData, 'id' | 'business_name'> }) {
  const [sub, setSub] = useState<Sub>('automations')
  const [automations, setAutomations] = useState<EngagementAutomation[]>([])
  const [events, setEvents] = useState<EngagementEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<EngagementAutomation | null>(null)

  const demo = useMemo(() => buildEngagementDemo(company), [company])

  const load = useCallback(async () => {
    const [{ data: autos }, { data: evs }] = await Promise.all([
      supabase.from('engagement_automations').select('*').eq('company_id', company.id).order('created_at', { ascending: false }),
      supabase.from('engagement_events').select('*').eq('company_id', company.id).order('created_at', { ascending: false }).limit(100),
    ])
    setAutomations((autos as EngagementAutomation[] | null) ?? [])
    setEvents((evs as EngagementEvent[] | null) ?? [])
    setLoading(false)
  }, [company.id])
  useEffect(() => { load() }, [load])
  useRealtime('engagement_automations', company.id, load)
  useRealtime('engagement_events', company.id, load)

  // Real quando o dono já criou automações; senão mostra exemplos (demo).
  const isDemo = !loading && automations.length === 0
  const shownAutos = isDemo ? demo.automations : automations
  const shownEvents = events.length > 0 ? events : (isDemo ? demo.events : [])

  const save = async (a: EngagementAutomation) => {
    const row = {
      company_id: company.id, name: a.name || 'Automação', active: a.active,
      trigger_type: a.trigger_type, intent_type: a.intent_type, keywords: a.keywords,
      media_ref: a.media_ref || null, action_type: a.action_type, message: a.message || null,
      create_lead: a.create_lead, execution_mode: a.execution_mode, allowed_auto_actions: a.allowed_auto_actions,
      updated_at: new Date().toISOString(),
    }
    if (a.id && a.id !== 'new') await supabase.from('engagement_automations').update(row).eq('id', a.id)
    else await supabase.from('engagement_automations').insert(row)
    setEditing(null); await load()
  }
  const toggle = async (a: EngagementAutomation) => {
    if (a.id === 'new' || isDemo) return
    await supabase.from('engagement_automations').update({ active: !a.active }).eq('id', a.id); await load()
  }
  const remove = async (id: string) => {
    if (isDemo) return
    await supabase.from('engagement_automations').delete().eq('id', id); await load()
  }

  return (
    <div>
      <div style={{ padding: '12px 16px', background: 'rgba(255,109,41,0.06)', border: '1px solid rgba(255,109,41,0.2)', borderRadius: '11px', fontSize: '11.5px', color: 'white', lineHeight: 1.6, marginBottom: '16px' }}>
        🤝 <strong>Engagement — automação de relacionamento.</strong> Alguém comenta no seu post → a IA entende a intenção pelo contexto do <strong>Post/Campanha</strong> → propõe a ação → passa pela <strong>Central de Approvals</strong> → envia DM / cria lead. Aqui você <strong>configura, entende e monitora</strong>; <strong>autorizar</strong> continua em Aprovações.
      </div>

      {isDemo && (
        <div style={{ padding: '10px 14px', background: 'rgba(251,191,36,0.06)', border: '1px solid rgba(251,191,36,0.22)', borderRadius: '10px', fontSize: '11px', color: 'white', lineHeight: 1.6, marginBottom: '14px' }}>
          ⏳ <strong>Exemplos de demonstração.</strong> Crie sua primeira automação real abaixo — aí estes exemplos somem. As conversas de verdade entram quando o Instagram estiver conectado e um comentário disparar uma automação.
        </div>
      )}

      <div style={{ display: 'inline-flex', gap: '4px', padding: '4px', background: 'rgba(255,255,255,0.03)', border: `1px solid ${BORDER}`, borderRadius: '10px', marginBottom: '18px', flexWrap: 'wrap' }}>
        {([['automations', '⚙️ Automações'], ['conversations', '💬 Conversas'], ['activity', '📊 Atividade']] as const).map(([k, label]) => (
          <button key={k} onClick={() => setSub(k)} style={{ padding: '7px 13px', background: sub === k ? 'rgba(255,109,41,0.14)' : 'transparent', border: `1px solid ${sub === k ? 'rgba(255,109,41,0.4)' : 'transparent'}`, borderRadius: '7px', color: sub === k ? ORANGE : 'white', fontSize: '12px', fontWeight: 700, cursor: 'pointer', fontFamily: D }}>{label}</button>
        ))}
      </div>

      {sub === 'automations' && (
        editing ? (
          <AutomationForm value={editing} onChange={setEditing} onSave={save} onCancel={() => setEditing(null)} />
        ) : (
          <div>
            <button onClick={() => setEditing(emptyAutomation())}
              style={{ padding: '9px 16px', background: ORANGE, color: '#000', fontWeight: 700, fontSize: '12.5px', border: 'none', borderRadius: '9px', cursor: 'pointer', fontFamily: D, marginBottom: '14px' }}>
              + Nova automação
            </button>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '11px' }}>
              {shownAutos.map(a => (
                <AutomationCard key={a.id} a={a} demo={isDemo} onEdit={() => setEditing(a)} onToggle={() => toggle(a)} onDelete={() => remove(a.id)} />
              ))}
            </div>
          </div>
        )
      )}
      {sub === 'conversations' && <ConversationsSection events={shownEvents} automations={shownAutos} />}
      {sub === 'activity' && <ActivitySection events={shownEvents} />}
    </div>
  )
}

function AutomationCard({ a, demo, onEdit, onToggle, onDelete }: { a: EngagementAutomation; demo: boolean; onEdit: () => void; onToggle: () => void; onDelete: () => void }) {
  const tr = TRIGGER_META[a.trigger_type], ac = ACTION_META[a.action_type]
  return (
    <div style={{ background: CARD, border: `1px solid ${a.active ? 'rgba(74,222,128,0.25)' : BORDER}`, borderRadius: '13px', padding: '15px 16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', marginBottom: '8px' }}>
        <span style={{ fontSize: '13.5px', fontWeight: 800, color: 'white' }}>{a.name}</span>
        <button onClick={onToggle} disabled={demo} title={a.active ? 'Ligada' : 'Desligada'}
          style={{ width: '38px', height: '20px', borderRadius: '99px', background: a.active ? ORANGE : 'rgba(255,255,255,0.1)', border: 'none', position: 'relative', cursor: demo ? 'default' : 'pointer', flexShrink: 0, opacity: demo ? 0.5 : 1 }}>
          <span style={{ position: 'absolute', top: '2px', left: a.active ? '20px' : '2px', width: '16px', height: '16px', borderRadius: '99px', background: '#000', transition: 'left 0.15s' }} />
        </button>
      </div>
      <div style={{ fontSize: '11px', color: MUTED, lineHeight: 1.6 }}>
        <div>{tr.icon} <strong style={{ color: 'white' }}>{tr.label}</strong></div>
        <div>🎯 Intenção: {INTENT_META[a.intent_type].label}{a.intent_type === 'keyword' && a.keywords.length ? ` (${a.keywords.slice(0, 3).join(', ')}${a.keywords.length > 3 ? '…' : ''})` : ''}</div>
        <div>{ac.icon} Ação: {ac.label}{a.create_lead ? ' + criar lead' : ''}</div>
        <div>⚡ Modo: <span style={{ color: a.execution_mode === 'automatic' ? '#4ade80' : '#FBBF24' }}>{a.execution_mode === 'automatic' ? 'Automático' : 'Manual (aprovar)'}</span></div>
      </div>
      {a.message && <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.7)', marginTop: '8px', padding: '8px 10px', background: 'rgba(255,255,255,0.03)', borderRadius: '8px', lineHeight: 1.5 }}>"{a.message}"</div>}
      <div style={{ display: 'flex', gap: '8px', marginTop: '11px' }}>
        <button onClick={onEdit} style={btn('rgba(255,109,41,0.12)', ORANGE)}>Editar</button>
        {!demo && <button onClick={onDelete} style={btn('transparent', '#f87171')}>Excluir</button>}
      </div>
    </div>
  )
}
const btn = (bg: string, color: string) => ({ padding: '7px 14px', background: bg, color, fontWeight: 700, fontSize: '11.5px', border: `1px solid ${color}33`, borderRadius: '8px', cursor: 'pointer', fontFamily: D } as const)

function AutomationForm({ value, onChange, onSave, onCancel }: {
  value: EngagementAutomation; onChange: (a: EngagementAutomation) => void; onSave: (a: EngagementAutomation) => void; onCancel: () => void
}) {
  const set = <K extends keyof EngagementAutomation>(k: K, v: EngagementAutomation[K]) => onChange({ ...value, [k]: v })
  const toggleAuto = (key: string) => set('allowed_auto_actions', value.allowed_auto_actions.includes(key) ? value.allowed_auto_actions.filter(x => x !== key) : [...value.allowed_auto_actions, key])
  return (
    <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: '14px', padding: '20px 22px', maxWidth: '620px' }}>
      <div style={{ fontSize: '14px', fontWeight: 800, color: 'white', marginBottom: '16px' }}>{value.id === 'new' ? 'Nova automação' : 'Editar automação'}</div>

      <L label="Nome"><input value={value.name} onChange={e => set('name', e.target.value)} placeholder="Ex: Checklist grátis" style={inp} /></L>

      <L label="Gatilho"><Select value={value.trigger_type} onChange={v => set('trigger_type', v as TriggerType)} opts={Object.entries(TRIGGER_META).map(([k, m]) => [k, `${m.icon} ${m.label}`])} /></L>

      <L label="Detectar intenção"><Select value={value.intent_type} onChange={v => set('intent_type', v as IntentType)} opts={Object.entries(INTENT_META).map(([k, m]) => [k, m.label])} /></L>
      <div style={{ fontSize: '10.5px', color: MUTED, margin: '-8px 0 14px', lineHeight: 1.5 }}>{INTENT_META[value.intent_type].desc}</div>
      {value.intent_type === 'keyword' && (
        <L label="Palavras-chave (separadas por vírgula)"><input value={value.keywords.join(', ')} onChange={e => set('keywords', e.target.value.split(',').map(s => s.trim()).filter(Boolean))} placeholder="eu quero, me manda, quero o material" style={inp} /></L>
      )}

      <L label="Post/Campanha (ID do post — vazio = qualquer post)"><input value={value.media_ref ?? ''} onChange={e => set('media_ref', e.target.value || null)} placeholder="Deixe vazio para valer em todos os posts" style={inp} /></L>

      <L label="Ação"><Select value={value.action_type} onChange={v => set('action_type', v as ActionType)} opts={Object.entries(ACTION_META).map(([k, m]) => [k, `${m.icon} ${m.label}`])} /></L>

      <L label="Mensagem do DM"><textarea value={value.message ?? ''} onChange={e => set('message', e.target.value)} rows={3} placeholder="Oi! 👋 Aqui está o que você pediu: [link]" style={{ ...inp, resize: 'vertical', lineHeight: 1.5 }} /></L>

      <label style={{ display: 'flex', alignItems: 'center', gap: '9px', fontSize: '12.5px', color: 'white', marginBottom: '16px', cursor: 'pointer' }}>
        <input type="checkbox" checked={value.create_lead} onChange={e => set('create_lead', e.target.checked)} style={{ width: '16px', height: '16px', accentColor: ORANGE }} /> Criar lead no funil
      </label>

      <L label="Modo de execução">
        <div style={{ display: 'flex', gap: '8px' }}>
          {(['manual', 'automatic'] as ExecutionMode[]).map(m => (
            <button key={m} onClick={() => set('execution_mode', m)}
              style={{ flex: 1, padding: '10px', borderRadius: '9px', border: `1px solid ${value.execution_mode === m ? 'rgba(255,109,41,0.5)' : BORDER}`, background: value.execution_mode === m ? 'rgba(255,109,41,0.1)' : 'transparent', color: value.execution_mode === m ? ORANGE : 'white', fontSize: '12px', fontWeight: 700, cursor: 'pointer', fontFamily: D }}>
              {m === 'manual' ? 'Manual (toda ação aprova)' : 'Automático'}
            </button>
          ))}
        </div>
      </L>
      {value.execution_mode === 'automatic' && (
        <div style={{ marginBottom: '16px', padding: '12px 14px', background: 'rgba(255,255,255,0.02)', border: `1px solid ${BORDER}`, borderRadius: '10px' }}>
          <div style={{ fontSize: '11px', fontWeight: 700, color: 'white', marginBottom: '9px' }}>Ações que podem auto-executar (o resto continua exigindo aprovação):</div>
          {AUTO_ACTION_OPTIONS.map(o => (
            <label key={o.key} style={{ display: 'flex', alignItems: 'center', gap: '9px', fontSize: '12px', color: 'white', marginBottom: '7px', cursor: 'pointer' }}>
              <input type="checkbox" checked={value.allowed_auto_actions.includes(o.key)} onChange={() => toggleAuto(o.key)} style={{ width: '15px', height: '15px', accentColor: ORANGE }} /> {o.label}
            </label>
          ))}
          <div style={{ fontSize: '10px', color: MUTED, marginTop: '6px', lineHeight: 1.5 }}>Ex.: liberar "enviar recurso por DM" automático, mas manter "reclamação" e "desconto" exigindo sua aprovação.</div>
        </div>
      )}

      <div style={{ display: 'flex', gap: '10px', marginTop: '6px' }}>
        <button onClick={() => onSave(value)} style={{ padding: '10px 20px', background: ORANGE, color: '#000', fontWeight: 700, fontSize: '13px', border: 'none', borderRadius: '9px', cursor: 'pointer', fontFamily: D }}>Salvar automação</button>
        <button onClick={onCancel} style={{ padding: '10px 20px', background: 'transparent', color: MUTED, fontWeight: 600, fontSize: '13px', border: `1px solid ${BORDER}`, borderRadius: '9px', cursor: 'pointer', fontFamily: D }}>Cancelar</button>
      </div>
    </div>
  )
}

const inp = { width: '100%', boxSizing: 'border-box' as const, padding: '10px 13px', background: 'rgba(255,255,255,0.04)', border: `1px solid ${BORDER}`, borderRadius: '9px', color: 'white', fontSize: '13px', outline: 'none', fontFamily: D }
function L({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: '14px' }}>
      <label style={{ display: 'block', fontSize: '10.5px', fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' }}>{label}</label>
      {children}
    </div>
  )
}
function Select({ value, onChange, opts }: { value: string; onChange: (v: string) => void; opts: [string, string][] }) {
  return (
    <select value={value} onChange={e => onChange(e.target.value)} style={{ ...inp, cursor: 'pointer', appearance: 'none' }}>
      {opts.map(([k, label]) => <option key={k} value={k} style={{ background: '#1a1008' }}>{label}</option>)}
    </select>
  )
}
