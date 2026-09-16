import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../../../lib/supabase'
import { useAuth } from '../../../contexts/AuthContext'
import { CARD, MUTED, BORDER, D, SUPABASE_URL } from './shared'
import { TEMPLATE_LABEL, type TestPost } from './TestingArea'
import CreativeAgent from './CreativeAgent'

const ORANGE = '#FF6D29'
const GREEN = '#4ade80'
const DAY_LABEL = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado']
const KIND_ICON: Record<string, string> = { organico: '📝', stories: '📖', campanhas: '🎯' }
const STATUS_META: Record<string, { label: string; color: string }> = {
  draft: { label: 'Avaliando', color: '#FBBF24' },
  vault: { label: 'No Vault', color: '#A78BFA' },
  scheduled: { label: 'Agendado', color: GREEN },
  adapt: { label: 'Adaptando', color: MUTED },
}

type Item = TestPost & { kind?: string; planned_for: string | null }

function startOfWeek(base: Date): Date {
  return new Date(base.getFullYear(), base.getMonth(), base.getDate() - base.getDay())
}
const sameDay = (a: Date, b: Date) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
const toIso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

export default function WeeklyCalendarTab({ companyId }: { companyId: string }) {
  const { session } = useAuth()
  const token = session?.access_token ?? ''
  const [items, setItems] = useState<Item[]>([])
  const [scheduledIds, setScheduledIds] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [autoOn, setAutoOn] = useState(false)
  const [autoLoaded, setAutoLoaded] = useState(false)
  const [planning, setPlanning] = useState(false)
  const [msg, setMsg] = useState('')
  const [err, setErr] = useState('')
  const [sub, setSub] = useState<'calendario' | 'ideias'>('calendario')

  const thisWeekStart = startOfWeek(new Date())
  const nextWeekStart = new Date(thisWeekStart.getFullYear(), thisWeekStart.getMonth(), thisWeekStart.getDate() + 7)
  const thisWeek = Array.from({ length: 7 }, (_, i) => new Date(thisWeekStart.getFullYear(), thisWeekStart.getMonth(), thisWeekStart.getDate() + i))
  const nextWeek = Array.from({ length: 7 }, (_, i) => new Date(nextWeekStart.getFullYear(), nextWeekStart.getMonth(), nextWeekStart.getDate() + i))

  const load = useCallback(async () => {
    const from = toIso(thisWeek[0]), to = toIso(nextWeek[6])
    const [{ data: posts }, { data: actions }, { data: cfg }] = await Promise.all([
      supabase.from('marketing_ai_test_content').select('*').eq('company_id', companyId).gte('planned_for', from).lte('planned_for', to),
      supabase.from('agent_actions').select('ref_id').eq('company_id', companyId).eq('ref_type', 'marketing_ai_test_content').eq('execution_status', 'QUEUED').not('scheduled_at', 'is', null),
      supabase.from('marketing_ai_config').select('auto_weekly_calendar').eq('company_id', companyId).maybeSingle(),
    ])
    setItems((posts ?? []) as Item[])
    setScheduledIds(new Set(((actions ?? []) as { ref_id: string }[]).map(a => a.ref_id)))
    setAutoOn(!!cfg?.auto_weekly_calendar)
    setAutoLoaded(true)
    setLoading(false)
  }, [companyId]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { load() }, [load])

  const toggleAuto = async () => {
    const next = !autoOn
    setAutoOn(next)
    // upsert, não update: empresa pode ainda não ter linha em marketing_ai_config.
    await supabase.from('marketing_ai_config').upsert({ company_id: companyId, auto_weekly_calendar: next }, { onConflict: 'company_id' })
  }

  const planNow = async () => {
    setPlanning(true); setErr(''); setMsg('')
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/creative-generate`, {
        method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'plan_week' }),
      })
      const r = await res.json().catch(() => ({})) as { error?: string; planned?: number }
      if (!res.ok) throw new Error(r.error ?? 'Erro ao planejar a semana')
      setMsg(`✅ Planejado: ${r.planned ?? 0} peça(s) geradas e avaliadas.`)
      await load()
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Erro ao planejar a semana')
    }
    setPlanning(false)
  }

  if (loading) return <div style={{ fontSize: '12px', color: MUTED }}>Carregando...</div>

  const today = new Date()

  const Week = ({ label, days }: { label: string; days: Date[] }) => (
    <div style={{ marginBottom: '20px' }}>
      <div style={{ fontSize: '11px', fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>{label}</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(120px, 1fr))', gap: '9px', overflowX: 'auto' }}>
        {days.map((d, i) => {
          const iso = toIso(d)
          const dayItems = items.filter(it => it.planned_for === iso)
          const isToday = sameDay(d, today)
          return (
            <div key={i} style={{ background: CARD, border: `1px solid ${isToday ? 'rgba(255,109,41,0.4)' : BORDER}`, borderRadius: '11px', padding: '10px', minHeight: '120px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <div style={{ fontSize: '10px', fontWeight: 800, color: isToday ? ORANGE : MUTED, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                {DAY_LABEL[i]} <span style={{ fontWeight: 600, color: 'rgba(255,255,255,0.35)' }}>{d.getDate()}/{d.getMonth() + 1}</span>
              </div>
              {dayItems.length === 0 ? (
                <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.25)', fontStyle: 'italic' }}>vazio</div>
              ) : dayItems.map(it => {
                const status = scheduledIds.has(it.id) ? 'scheduled' : it.status
                const sm = STATUS_META[status] ?? STATUS_META.draft
                return (
                  <div key={it.id} style={{ padding: '6px 8px', background: 'rgba(255,255,255,0.03)', border: `1px solid ${BORDER}`, borderRadius: '8px' }}>
                    <div style={{ fontSize: '10.5px', fontWeight: 700, color: 'white', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {KIND_ICON[it.kind ?? 'organico'] ?? '📝'} {it.idea ?? 'Post'}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginTop: '3px' }}>
                      <span style={{ fontSize: '8.5px', fontWeight: 700, color: sm.color }}>● {sm.label}</span>
                      {it.brief?.template && <span style={{ fontSize: '8.5px', color: MUTED }}>· {TEMPLATE_LABEL[it.brief.template] ?? it.brief.template}</span>}
                    </div>
                  </div>
                )
              })}
            </div>
          )
        })}
      </div>
    </div>
  )

  return (
    <div>
      <div style={{ marginBottom: '16px' }}>
        <div style={{ fontSize: '15px', fontWeight: 800, color: 'white', marginBottom: '3px' }}>🗓️ Calendário da Semana</div>
        <div style={{ fontSize: '11.5px', color: MUTED, lineHeight: 1.55, maxWidth: '760px' }}>
          O agente escolhe as melhores <strong style={{ color: 'white' }}>Ideias</strong> do backlog abaixo pra cada dia (nunca inventa do zero) e usa o mesmo motor de sempre pra gerar e avaliar — o que sair com nota boa já cai no Vault sozinho.
        </div>
      </div>

      <div style={{ display: 'inline-flex', gap: '4px', padding: '4px', background: 'rgba(255,255,255,0.03)', border: `1px solid ${BORDER}`, borderRadius: '11px', marginBottom: '18px' }}>
        <button onClick={() => setSub('calendario')}
          style={{ display: 'flex', alignItems: 'center', gap: '7px', padding: '8px 14px', background: sub === 'calendario' ? 'rgba(255,109,41,0.12)' : 'transparent', border: `1px solid ${sub === 'calendario' ? 'rgba(255,109,41,0.35)' : 'transparent'}`, borderRadius: '8px', cursor: 'pointer', fontFamily: D }}>
          <span style={{ fontSize: '14px' }}>🗓️</span>
          <span style={{ fontSize: '12.5px', fontWeight: 700, color: sub === 'calendario' ? ORANGE : 'white' }}>Calendário</span>
        </button>
        <button onClick={() => setSub('ideias')}
          style={{ display: 'flex', alignItems: 'center', gap: '7px', padding: '8px 14px', background: sub === 'ideias' ? 'rgba(255,109,41,0.12)' : 'transparent', border: `1px solid ${sub === 'ideias' ? 'rgba(255,109,41,0.35)' : 'transparent'}`, borderRadius: '8px', cursor: 'pointer', fontFamily: D }}>
          <span style={{ fontSize: '14px' }}>💡</span>
          <span style={{ fontSize: '12.5px', fontWeight: 700, color: sub === 'ideias' ? ORANGE : 'white' }}>Ideias</span>
        </button>
      </div>

      {sub === 'ideias' ? <CreativeAgent companyId={companyId} /> : (
        <>
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '14px', padding: '10px 14px', background: 'rgba(255,255,255,0.02)', border: `1px solid ${BORDER}`, borderRadius: '10px', marginBottom: '18px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '9px' }}>
              <button onClick={toggleAuto} disabled={!autoLoaded}
                style={{ width: '36px', height: '20px', borderRadius: '99px', border: 'none', background: autoOn ? ORANGE : 'rgba(255,255,255,0.15)', position: 'relative', cursor: 'pointer', flexShrink: 0, padding: 0 }}>
                <span style={{ position: 'absolute', top: '2px', left: autoOn ? '18px' : '2px', width: '16px', height: '16px', borderRadius: '50%', background: 'white', transition: 'left 0.15s' }} />
              </button>
              <div>
                <div style={{ fontSize: '11.5px', fontWeight: 700, color: 'white' }}>Planejar sozinho todo domingo às 18h</div>
                <div style={{ fontSize: '10px', color: MUTED }}>Escolhe entre as Ideias disponíveis e já gera tudo — sem precisar clicar em nada.</div>
              </div>
            </div>
            <button onClick={planNow} disabled={planning || !token}
              style={{ marginLeft: 'auto', padding: '9px 16px', background: ORANGE, color: '#000', fontWeight: 700, fontSize: '12px', borderRadius: '9px', border: 'none', cursor: planning ? 'default' : 'pointer', fontFamily: D, opacity: planning ? 0.7 : 1 }}>
              {planning ? 'Planejando + gerando...' : '🗓️ Planejar semana agora'}
            </button>
          </div>
          {err && <div style={{ color: '#f87171', fontSize: '11.5px', marginBottom: '12px' }}>{err}</div>}
          {msg && <div style={{ color: GREEN, fontSize: '11.5px', marginBottom: '12px' }}>{msg}</div>}

          <Week label="Esta semana" days={thisWeek} />
          <Week label="Próxima semana" days={nextWeek} />
        </>
      )}
    </div>
  )
}
