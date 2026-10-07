import { useCallback, useEffect, useMemo, useState } from 'react'
import type { CompanyData } from '../../../contexts/CompanyContext'
import { useLang } from '../../../contexts/LanguageContext'
import { supabase } from '../../../lib/supabase'
import { useRealtime } from '../../../lib/useRealtime'
import { CARD, MUTED, BORDER, D } from './shared'
import {
  buildEngagementDemo, emptyAutomation, TRIGGER_META, INTENT_META, ACTION_META, AUTO_ACTION_OPTIONS,
  type EngagementAutomation, type EngagementEvent, type IntentType, type ActionType, type TriggerType, type ExecutionMode,
} from './engagementDemo'
import { INTENT_EN, ACTION_EN, TRIGGER_EN, AUTO_ACTION_EN } from './labels.i18n'
import { ConversationsSection, ActivitySection } from './engagementParts'

const ORANGE = '#FF6D29'
type Sub = 'automations' | 'conversations' | 'activity'

const TX = {
  pt: {
    introA: 'Engagement — automação de relacionamento.', introB: ' Alguém comenta no seu post → a IA entende a intenção pelo contexto do ', introC: 'Post/Campanha', introD: ' → propõe a ação → passa pela ', introE: 'Central de Approvals', introF: ' → envia DM / cria lead. Aqui você ', introG: 'configura, entende e monitora', introH: '; ', introI: 'autorizar', introJ: ' continua em Aprovações.',
    demoA: 'Exemplos de demonstração.', demoB: ' Crie sua primeira automação real abaixo — aí estes exemplos somem. As conversas de verdade entram quando o Instagram estiver conectado e um comentário disparar uma automação.',
    tabAuto: '⚙️ Automações', tabConv: '💬 Conversas', tabAct: '📊 Atividade', newAuto: '+ Nova automação',
    on: 'Ligada', off: 'Desligada', intent: '🎯 Intenção: ', action: ' Ação: ', andLead: ' + criar lead', mode: '⚡ Modo: ', auto: 'Automático', manualApprove: 'Manual (aprovar)', edit: 'Editar', del: 'Excluir',
    newTitle: 'Nova automação', editTitle: 'Editar automação', name: 'Nome', namePh: 'Ex: Checklist grátis', trigger: 'Gatilho', detectIntent: 'Detectar intenção', keywords: 'Palavras-chave (separadas por vírgula)', keywordsPh: 'eu quero, me manda, quero o material',
    postRef: 'Post/Campanha (ID do post — vazio = qualquer post)', postRefPh: 'Deixe vazio para valer em todos os posts', actionLbl: 'Ação', dmMsg: 'Mensagem do DM', dmMsgPh: 'Oi! 👋 Aqui está o que você pediu: [link]',
    createLead: ' Criar lead no funil', execMode: 'Modo de execução', manualAll: 'Manual (toda ação aprova)', autoOnly: 'Automático', autoActions: 'Ações que podem auto-executar (o resto continua exigindo aprovação):',
    autoEx: 'Ex.: liberar "enviar recurso por DM" automático, mas manter "reclamação" e "desconto" exigindo sua aprovação.', save: 'Salvar automação', cancel: 'Cancelar',
  },
  en: {
    introA: 'Engagement — relationship automation.', introB: ' Someone comments on your post → the AI understands the intent from the ', introC: 'Post/Campaign', introD: ' context → proposes the action → it goes through the ', introE: 'Approvals Center', introF: ' → sends a DM / creates a lead. Here you ', introG: 'configure, understand and monitor', introH: '; ', introI: 'authorizing', introJ: ' stays in Approvals.',
    demoA: 'Demo examples.', demoB: ' Create your first real automation below — then these examples go away. Real conversations show up once Instagram is connected and a comment triggers an automation.',
    tabAuto: '⚙️ Automations', tabConv: '💬 Conversations', tabAct: '📊 Activity', newAuto: '+ New automation',
    on: 'On', off: 'Off', intent: '🎯 Intent: ', action: ' Action: ', andLead: ' + create lead', mode: '⚡ Mode: ', auto: 'Automatic', manualApprove: 'Manual (approve)', edit: 'Edit', del: 'Delete',
    newTitle: 'New automation', editTitle: 'Edit automation', name: 'Name', namePh: 'E.g.: Free checklist', trigger: 'Trigger', detectIntent: 'Detect intent', keywords: 'Keywords (comma-separated)', keywordsPh: 'I want it, send me, I want the material',
    postRef: 'Post/Campaign (post ID — empty = any post)', postRefPh: 'Leave empty to apply to all posts', actionLbl: 'Action', dmMsg: 'DM message', dmMsgPh: 'Hi! 👋 Here is what you asked for: [link]',
    createLead: ' Create lead in the pipeline', execMode: 'Execution mode', manualAll: 'Manual (every action needs approval)', autoOnly: 'Automatic', autoActions: 'Actions that can auto-run (the rest still requires approval):',
    autoEx: 'E.g.: allow "send resource by DM" automatically, but keep "complaint" and "discount" requiring your approval.', save: 'Save automation', cancel: 'Cancel',
  },
} as const

// Engagement — o cérebro/config das automações de Instagram vive no SalesBoost.
// Configurar + entender + monitorar aqui; autorizar continua na Central de
// Approvals. Cada automação liga Post/Campanha → gatilho → intenção → ação.
export default function EngagementTab({ company }: { company: Pick<CompanyData, 'id' | 'business_name'> }) {
  const { lang } = useLang()
  const t = TX[lang]
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
        🤝 <strong>{t.introA}</strong>{t.introB}<strong>{t.introC}</strong>{t.introD}<strong>{t.introE}</strong>{t.introF}<strong>{t.introG}</strong>{t.introH}<strong>{t.introI}</strong>{t.introJ}
      </div>

      {isDemo && (
        <div style={{ padding: '10px 14px', background: 'rgba(251,191,36,0.06)', border: '1px solid rgba(251,191,36,0.22)', borderRadius: '10px', fontSize: '11px', color: 'white', lineHeight: 1.6, marginBottom: '14px' }}>
          ⏳ <strong>{t.demoA}</strong>{t.demoB}
        </div>
      )}

      <div style={{ display: 'inline-flex', gap: '4px', padding: '4px', background: 'rgba(255,255,255,0.03)', border: `1px solid ${BORDER}`, borderRadius: '10px', marginBottom: '18px', flexWrap: 'wrap' }}>
        {([['automations', t.tabAuto], ['conversations', t.tabConv], ['activity', t.tabAct]] as const).map(([k, label]) => (
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
              {t.newAuto}
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
  const { lang } = useLang()
  const t = TX[lang]
  const tr = TRIGGER_META[a.trigger_type], ac = ACTION_META[a.action_type]
  const trLabel = lang === 'en' ? TRIGGER_EN[a.trigger_type] ?? tr.label : tr.label
  const acLabel = lang === 'en' ? ACTION_EN[a.action_type]?.label ?? ac.label : ac.label
  const inLabel = lang === 'en' ? INTENT_EN[a.intent_type]?.label ?? INTENT_META[a.intent_type].label : INTENT_META[a.intent_type].label
  return (
    <div style={{ background: CARD, border: `1px solid ${a.active ? 'rgba(74,222,128,0.25)' : BORDER}`, borderRadius: '13px', padding: '15px 16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', marginBottom: '8px' }}>
        <span style={{ fontSize: '13.5px', fontWeight: 800, color: 'white' }}>{a.name}</span>
        <button onClick={onToggle} disabled={demo} title={a.active ? t.on : t.off}
          style={{ width: '38px', height: '20px', borderRadius: '99px', background: a.active ? ORANGE : 'rgba(255,255,255,0.1)', border: 'none', position: 'relative', cursor: demo ? 'default' : 'pointer', flexShrink: 0, opacity: demo ? 0.5 : 1 }}>
          <span style={{ position: 'absolute', top: '2px', left: a.active ? '20px' : '2px', width: '16px', height: '16px', borderRadius: '99px', background: '#000', transition: 'left 0.15s' }} />
        </button>
      </div>
      <div style={{ fontSize: '11px', color: MUTED, lineHeight: 1.6 }}>
        <div>{tr.icon} <strong style={{ color: 'white' }}>{trLabel}</strong></div>
        <div>{t.intent}{inLabel}{a.intent_type === 'keyword' && a.keywords.length ? ` (${a.keywords.slice(0, 3).join(', ')}${a.keywords.length > 3 ? '…' : ''})` : ''}</div>
        <div>{ac.icon}{t.action}{acLabel}{a.create_lead ? t.andLead : ''}</div>
        <div>{t.mode}<span style={{ color: a.execution_mode === 'automatic' ? '#4ade80' : '#FBBF24' }}>{a.execution_mode === 'automatic' ? t.auto : t.manualApprove}</span></div>
      </div>
      {a.message && <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.7)', marginTop: '8px', padding: '8px 10px', background: 'rgba(255,255,255,0.03)', borderRadius: '8px', lineHeight: 1.5 }}>"{a.message}"</div>}
      <div style={{ display: 'flex', gap: '8px', marginTop: '11px' }}>
        <button onClick={onEdit} style={btn('rgba(255,109,41,0.12)', ORANGE)}>{t.edit}</button>
        {!demo && <button onClick={onDelete} style={btn('transparent', '#f87171')}>{t.del}</button>}
      </div>
    </div>
  )
}
const btn = (bg: string, color: string) => ({ padding: '7px 14px', background: bg, color, fontWeight: 700, fontSize: '11.5px', border: `1px solid ${color}33`, borderRadius: '8px', cursor: 'pointer', fontFamily: D } as const)

function AutomationForm({ value, onChange, onSave, onCancel }: {
  value: EngagementAutomation; onChange: (a: EngagementAutomation) => void; onSave: (a: EngagementAutomation) => void; onCancel: () => void
}) {
  const { lang } = useLang()
  const t = TX[lang]
  const en = lang === 'en'
  const set = <K extends keyof EngagementAutomation>(k: K, v: EngagementAutomation[K]) => onChange({ ...value, [k]: v })
  const toggleAuto = (key: string) => set('allowed_auto_actions', value.allowed_auto_actions.includes(key) ? value.allowed_auto_actions.filter(x => x !== key) : [...value.allowed_auto_actions, key])
  return (
    <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: '14px', padding: '20px 22px', maxWidth: '620px' }}>
      <div style={{ fontSize: '14px', fontWeight: 800, color: 'white', marginBottom: '16px' }}>{value.id === 'new' ? t.newTitle : t.editTitle}</div>

      <L label={t.name}><input value={value.name} onChange={e => set('name', e.target.value)} placeholder={t.namePh} style={inp} /></L>

      <L label={t.trigger}><Select value={value.trigger_type} onChange={v => set('trigger_type', v as TriggerType)} opts={Object.entries(TRIGGER_META).map(([k, m]) => [k, `${m.icon} ${en ? TRIGGER_EN[k] ?? m.label : m.label}`])} /></L>

      <L label={t.detectIntent}><Select value={value.intent_type} onChange={v => set('intent_type', v as IntentType)} opts={Object.entries(INTENT_META).map(([k, m]) => [k, en ? INTENT_EN[k]?.label ?? m.label : m.label])} /></L>
      <div style={{ fontSize: '10.5px', color: MUTED, margin: '-8px 0 14px', lineHeight: 1.5 }}>{en ? INTENT_EN[value.intent_type]?.desc ?? INTENT_META[value.intent_type].desc : INTENT_META[value.intent_type].desc}</div>
      {value.intent_type === 'keyword' && (
        <L label={t.keywords}><input value={value.keywords.join(', ')} onChange={e => set('keywords', e.target.value.split(',').map(s => s.trim()).filter(Boolean))} placeholder={t.keywordsPh} style={inp} /></L>
      )}

      <L label={t.postRef}><input value={value.media_ref ?? ''} onChange={e => set('media_ref', e.target.value || null)} placeholder={t.postRefPh} style={inp} /></L>

      <L label={t.actionLbl}><Select value={value.action_type} onChange={v => set('action_type', v as ActionType)} opts={Object.entries(ACTION_META).map(([k, m]) => [k, `${m.icon} ${en ? ACTION_EN[k]?.label ?? m.label : m.label}`])} /></L>

      <L label={t.dmMsg}><textarea value={value.message ?? ''} onChange={e => set('message', e.target.value)} rows={3} placeholder={t.dmMsgPh} style={{ ...inp, resize: 'vertical', lineHeight: 1.5 }} /></L>

      <label style={{ display: 'flex', alignItems: 'center', gap: '9px', fontSize: '12.5px', color: 'white', marginBottom: '16px', cursor: 'pointer' }}>
        <input type="checkbox" checked={value.create_lead} onChange={e => set('create_lead', e.target.checked)} style={{ width: '16px', height: '16px', accentColor: ORANGE }} />{t.createLead}
      </label>

      <L label={t.execMode}>
        <div style={{ display: 'flex', gap: '8px' }}>
          {(['manual', 'automatic'] as ExecutionMode[]).map(m => (
            <button key={m} onClick={() => set('execution_mode', m)}
              style={{ flex: 1, padding: '10px', borderRadius: '9px', border: `1px solid ${value.execution_mode === m ? 'rgba(255,109,41,0.5)' : BORDER}`, background: value.execution_mode === m ? 'rgba(255,109,41,0.1)' : 'transparent', color: value.execution_mode === m ? ORANGE : 'white', fontSize: '12px', fontWeight: 700, cursor: 'pointer', fontFamily: D }}>
              {m === 'manual' ? t.manualAll : t.autoOnly}
            </button>
          ))}
        </div>
      </L>
      {value.execution_mode === 'automatic' && (
        <div style={{ marginBottom: '16px', padding: '12px 14px', background: 'rgba(255,255,255,0.02)', border: `1px solid ${BORDER}`, borderRadius: '10px' }}>
          <div style={{ fontSize: '11px', fontWeight: 700, color: 'white', marginBottom: '9px' }}>{t.autoActions}</div>
          {AUTO_ACTION_OPTIONS.map(o => (
            <label key={o.key} style={{ display: 'flex', alignItems: 'center', gap: '9px', fontSize: '12px', color: 'white', marginBottom: '7px', cursor: 'pointer' }}>
              <input type="checkbox" checked={value.allowed_auto_actions.includes(o.key)} onChange={() => toggleAuto(o.key)} style={{ width: '15px', height: '15px', accentColor: ORANGE }} /> {en ? AUTO_ACTION_EN[o.key] ?? o.label : o.label}
            </label>
          ))}
          <div style={{ fontSize: '10px', color: MUTED, marginTop: '6px', lineHeight: 1.5 }}>{t.autoEx}</div>
        </div>
      )}

      <div style={{ display: 'flex', gap: '10px', marginTop: '6px' }}>
        <button onClick={() => onSave(value)} style={{ padding: '10px 20px', background: ORANGE, color: '#000', fontWeight: 700, fontSize: '13px', border: 'none', borderRadius: '9px', cursor: 'pointer', fontFamily: D }}>{t.save}</button>
        <button onClick={onCancel} style={{ padding: '10px 20px', background: 'transparent', color: MUTED, fontWeight: 600, fontSize: '13px', border: `1px solid ${BORDER}`, borderRadius: '9px', cursor: 'pointer', fontFamily: D }}>{t.cancel}</button>
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
