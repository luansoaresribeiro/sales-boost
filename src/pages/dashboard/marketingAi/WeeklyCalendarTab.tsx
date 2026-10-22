import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../../../lib/supabase'
import { useCompany } from '../../../contexts/CompanyContext'
import { weekSlots, planWindow, type MixItem, type WeekSlot } from '../../../lib/weekSlots'
import { useAuth } from '../../../contexts/AuthContext'
import { useLang } from '../../../contexts/LanguageContext'
import { CARD, MUTED, BORDER, D, SUPABASE_URL, useSSNames } from './shared'
import { templateLabel, type TestPost } from './TestingArea'
import CalendarPostModal from './CalendarPostModal'
import MakeNowPicker from './MakeNowPicker'
import { useRealtime } from '../../../lib/useRealtime'
import { PieceChips } from './PieceLabels'

const ORANGE = '#FF6D29'
const GREEN = '#4ade80'
const DAY_LABELS = {
  pt: ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'],
  en: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
} as const
const STATUS_LABEL_EN: Record<string, string> = { draft: 'Evaluating', review: 'Low score — review', vault: 'Ready to approve', scheduled: 'Scheduled', adapt: 'Adapting' }
const TX = {
  pt: {
    errPlan: 'Erro ao planejar a semana', planned: (n: number) => `✅ ${n} peça(s) sendo criadas — aparecem no calendário em alguns minutos (atualize a página).`, todo: 'A estratégia também pede nesta semana (isso depende de você):', perWeek: (n: number) => `${n}x`, loading: 'Carregando...', empty: 'vazio',
    title: '🗓️ Calendário da Semana', introA: 'Cada dia já vem do ', introB: 'plano da sua estratégia', introC: ' (feed, stories e vídeos). No domingo o Sales Boost cria as peças de cada dia e dá uma nota pra cada uma. Clique numa peça pra ver a análise, aprovar ou agendar — nada vai ao ar sem a sua aprovação.',
    noPlanA: 'Ainda não há estratégia com plano semanal. ', noPlanB: 'Gere a estratégia', noPlanC: ' e o calendário se monta sozinho a partir dela.',
    autoTitle: 'Montar a semana sozinho todo domingo às 18h', autoDesc: 'Segue o plano da estratégia e cria as peças de cada dia — sem precisar clicar em nada.',
    slotAuto: 'Sales Boost cria', slotItem: 'no imóvel', slotVideo: 'Sales Boost cria o vídeo', alsoStory: '↻ Stories também',
    surf: { feed: 'Feed', stories: 'Stories', reels: 'Vídeo', dm: 'DM' } as Record<string, string>, also: 'Também nesta semana:',
    loose: 'Peças avulsas (fora do calendário)',
    planning: 'Criando as peças...', planNow: '🗓️ Criar as peças da próxima semana agora', thisWeek: 'Esta semana', nextWeek: 'Próxima semana',
  },
  en: {
    errPlan: 'Error planning the week', planned: (n: number) => `✅ ${n} piece(s) being created — they show up on the calendar in a few minutes (refresh the page).`, todo: 'The strategy also asks for this week (this depends on you):', perWeek: (n: number) => `${n}x`, loading: 'Loading...', empty: 'empty',
    title: '🗓️ Weekly Calendar', introA: 'Each day already comes from ', introB: 'your strategy plan', introC: ' (feed, stories and videos). On Sunday Sales Boost creates each day\'s pieces and scores each one. Click a piece to see the review, approve or schedule it — nothing goes live without your approval.',
    noPlanA: 'There is no strategy with a weekly plan yet. ', noPlanB: 'Generate the strategy', noPlanC: ' and the calendar builds itself from it.',
    autoTitle: 'Build the week automatically every Sunday at 6 PM', autoDesc: 'Follows the strategy plan and creates each day\'s pieces — no clicking needed.',
    slotAuto: 'Sales Boost creates', slotItem: 'on the listing', slotVideo: 'Sales Boost makes the video', alsoStory: '↻ Stories too',
    surf: { feed: 'Feed', stories: 'Stories', reels: 'Video', dm: 'DM' } as Record<string, string>, also: 'Also this week:',
    loose: 'Loose pieces (outside the calendar)',
    planning: 'Creating the pieces...', planNow: '🗓️ Create next week\'s pieces now', thisWeek: 'This week', nextWeek: 'Next week',
  },
} as const
const KIND_ICON: Record<string, string> = { organico: '📝', stories: '📖', campanhas: '🎯' }
const STATUS_META: Record<string, { label: string; color: string }> = {
  draft: { label: 'Avaliando', color: MUTED },
  review: { label: 'Nota baixa — revisar', color: '#FBBF24' },
  vault: { label: 'Pronta pra aprovar', color: '#A78BFA' },
  scheduled: { label: 'Agendado', color: GREEN },
  adapt: { label: 'Adaptando', color: MUTED },
}

type Item = TestPost & { kind?: string; planned_for: string | null; item_id?: string | null; recipe?: string | null; story_worthy?: boolean | null }
interface FormatMeta { surface?: string; recipe?: string; family?: string; pillar?: string }
// Formatos genéricos (não vêm da ficha) e a família que o servidor dá a eles (formatCatalog.ts).
const GENERIC_FAMILY: Record<string, string> = { post_card: 'eventual', carrossel_slides: 'educativo' }
const SURFACE_ICON: Record<string, string> = { feed: '📝', stories: '📖', reels: '🎬', dm: '💬' }

function startOfWeek(base: Date): Date {
  return new Date(base.getFullYear(), base.getMonth(), base.getDate() - base.getDay())
}
const sameDay = (a: Date, b: Date) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
const toIso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

export default function WeeklyCalendarTab({ companyId }: { companyId: string }) {
  const { lang } = useLang()
  const t = TX[lang]
  const DAY_LABEL = DAY_LABELS[lang]
  const { session } = useAuth()
  const token = session?.access_token ?? ''
  const { company } = useCompany()
  const ssNames = useSSNames(companyId)
  const [items, setItems] = useState<Item[]>([])
  const [mix, setMix] = useState<MixItem[]>([])
  const [formatMeta, setFormatMeta] = useState<Record<string, FormatMeta>>({})
  const [autoPref, setAutoPref] = useState<boolean | null>(null)
  const [scheduledIds, setScheduledIds] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [autoLoaded, setAutoLoaded] = useState(false)
  const [planning, setPlanning] = useState(false)
  const [msg, setMsg] = useState('')
  const [todo, setTodo] = useState<{ format: string; name: string; per_week: number; purpose: string }[]>([])
  const [err, setErr] = useState('')
  const [open, setOpen] = useState<Item | null>(null)
  const [loose, setLoose] = useState<Item[]>([])

  const thisWeekStart = startOfWeek(new Date())
  const nextWeekStart = new Date(thisWeekStart.getFullYear(), thisWeekStart.getMonth(), thisWeekStart.getDate() + 7)
  const thisWeek = Array.from({ length: 7 }, (_, i) => new Date(thisWeekStart.getFullYear(), thisWeekStart.getMonth(), thisWeekStart.getDate() + i))
  const nextWeek = Array.from({ length: 7 }, (_, i) => new Date(nextWeekStart.getFullYear(), nextWeekStart.getMonth(), nextWeekStart.getDate() + i))

  const load = useCallback(async () => {
    const from = toIso(thisWeek[0]), to = toIso(nextWeek[6])
    const [{ data: posts }, { data: actions }, { data: cfg }, { data: strat }, { data: pb }, { data: avulsas }] = await Promise.all([
      supabase.from('marketing_ai_test_content').select('*').eq('company_id', companyId).gte('planned_for', from).lte('planned_for', to),
      supabase.from('agent_actions').select('ref_id').eq('company_id', companyId).eq('ref_type', 'marketing_ai_test_content').eq('execution_status', 'QUEUED').not('scheduled_at', 'is', null),
      supabase.from('marketing_ai_config').select('auto_weekly_calendar').eq('company_id', companyId).maybeSingle(),
      supabase.from('marketing_ai_strategies').select('content_plan').eq('company_id', companyId).eq('kind', 'main').eq('status', 'active').order('updated_at', { ascending: false }).limit(1).maybeSingle(),
      supabase.from('vertical_playbooks').select('config').eq('key', company?.vertical_key ?? 'generico').maybeSingle(),
      // Peças sem dia (feitas à mão no Padrão visual, ou antigas): sem a aba
      // Vault, ficam aqui embaixo pra não sumirem.
      supabase.from('marketing_ai_test_content').select('*').eq('company_id', companyId).is('planned_for', null).in('status', ['vault', 'draft']).order('created_at', { ascending: false }).limit(12),
    ])
    setLoose((avulsas ?? []) as Item[])
    const plan = (strat?.content_plan ?? null) as { weekly_mix?: MixItem[] } | null
    setMix(Array.isArray(plan?.weekly_mix) ? plan!.weekly_mix : [])
    const fm: Record<string, FormatMeta> = {}
    for (const f of ((pb?.config as { content_formats?: { key: string; surface?: string; recipe?: string; family?: string; pillar?: string; producer?: string }[] } | null)?.content_formats ?? [])) fm[f.key] = { surface: f.surface, recipe: f.recipe, family: f.family ?? (f.producer === 'item_video' ? 'tour' : 'eventual'), pillar: f.pillar }
    setFormatMeta(fm)
    setItems((posts ?? []) as Item[])
    setScheduledIds(new Set(((actions ?? []) as { ref_id: string }[]).map(a => a.ref_id)))
    // null = o dono nunca mexeu → liga sozinho quando há plano da estratégia
    // (mesma regra do cron de domingo no creative-generate).
    setAutoPref(typeof cfg?.auto_weekly_calendar === 'boolean' ? cfg.auto_weekly_calendar : null)
    setAutoLoaded(true)
    setLoading(false)
  }, [companyId, company?.vertical_key]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { load() }, [load])
  // Peças nascem em segundo plano (e a nota chega depois): atualiza sozinho.
  useRealtime('marketing_ai_test_content', companyId, load, { key: 'cal' })

  // Mesma regra do cron: liga sozinho só com estratégia + pagamento de verdade.
  const paid = !!company?.stripe_subscription_id || company?.manual_access === true
  const autoOn = autoPref ?? (mix.length > 0 && paid)
  const toggleAuto = async () => {
    const next = !autoOn
    setAutoPref(next)
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
      const r = await res.json().catch(() => ({})) as { error?: string; planned?: number; todo?: { format: string; name: string; per_week: number; purpose: string }[] }
      if (!res.ok) throw new Error(r.error ?? t.errPlan)
      setMsg(t.planned(r.planned ?? 0))
      setTodo(Array.isArray(r.todo) ? r.todo : [])
      await load()
    } catch (e) {
      setErr(e instanceof Error ? e.message : t.errPlan)
    }
    setPlanning(false)
  }

  if (loading) return <div style={{ fontSize: '12px', color: MUTED }}>{t.loading}</div>

  const today = new Date()
  const todayIso = toIso(today)
  // Vagas do plano da estratégia: só a PRÓXIMA janela (seg–dom), que é a que
  // o domingo e o botão "Criar as peças" geram de fato (nextWeekDates no
  // creative-generate) — a tela não promete vaga que o servidor não preenche.
  const slotsByDay: Record<string, WeekSlot[]> = {}
  for (const sl of weekSlots(mix, planWindow(1, today))) {
    if (sl.date < todayIso) continue
    ;(slotsByDay[sl.date] ??= []).push(sl)
  }
  const dmItems = mix.filter(m => m.producer === 'dm')
  // Peça já criada ocupa a vaga do mesmo formato (receita do item) ou, se for
  // post solto (sem item), a primeira vaga de post do dia.
  const openSlots = (iso: string, dayItems: Item[]): WeekSlot[] => {
    const left = [...dayItems]
    return (slotsByDay[iso] ?? []).filter(sl => {
      // Vídeo do calendário: a peça nasce com a receita 'video_imovel' (creative-generate).
      const recipe = sl.producer === 'item_video' ? 'video_imovel' : formatMeta[sl.format]?.recipe
      const i = left.findIndex(it => (recipe && it.recipe === recipe) || (sl.producer === 'post' && !it.item_id))
      if (i >= 0) { left.splice(i, 1); return false }
      return true
    })
  }
  const slotWho = (sl: WeekSlot) => sl.producer === 'post' ? t.slotAuto
    : sl.producer === 'item_video' ? t.slotVideo
    : formatMeta[sl.format]?.recipe ? `${t.slotAuto} · ${t.slotItem}` : t.slotItem

  const Week = ({ label, days }: { label: string; days: Date[] }) => (
    <div style={{ marginBottom: '20px' }}>
      <div style={{ fontSize: '11px', fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>{label}</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(120px, 1fr))', gap: '9px', overflowX: 'auto' }}>
        {days.map((d, i) => {
          const iso = toIso(d)
          const dayItems = items.filter(it => it.planned_for === iso)
          const open = openSlots(iso, dayItems)
          const isToday = sameDay(d, today)
          return (
            <div key={i} style={{ background: CARD, border: `1px solid ${isToday ? 'rgba(255,109,41,0.4)' : BORDER}`, borderRadius: '11px', padding: '10px', minHeight: '120px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <div style={{ fontSize: '10px', fontWeight: 800, color: isToday ? ORANGE : MUTED, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                {DAY_LABEL[i]} <span style={{ fontWeight: 600, color: 'rgba(255,255,255,0.35)' }}>{d.getDate()}/{d.getMonth() + 1}</span>
              </div>
              {dayItems.length === 0 && open.length === 0 ? (
                <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.25)', fontStyle: 'italic' }}>{t.empty}</div>
              ) : dayItems.map(it => {
                const status = scheduledIds.has(it.id) ? 'scheduled' : it.status === 'draft' && it.quality_score != null ? 'review' : it.status
                const sm = STATUS_META[status] ?? STATUS_META.draft
                return (
                  <button key={it.id} onClick={() => setOpen(it)} style={{ textAlign: 'left', width: '100%', cursor: 'pointer', fontFamily: D, padding: '6px 8px', background: 'rgba(255,255,255,0.03)', border: `1px solid ${BORDER}`, borderRadius: '8px' }}>
                    <div style={{ fontSize: '10.5px', fontWeight: 700, color: 'white', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {it.recipe === 'video_imovel' ? (it.video_url ? '▶' : '⏳') : KIND_ICON[it.kind ?? 'organico'] ?? '📝'} {it.idea ?? 'Post'}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginTop: '3px' }}>
                      <span style={{ fontSize: '8.5px', fontWeight: 700, color: sm.color }}>● {lang === 'en' ? STATUS_LABEL_EN[status] ?? sm.label : sm.label}{it.quality_score != null ? ` · ${it.quality_score}` : ''}</span>
                      {it.brief?.template && <span style={{ fontSize: '8.5px', color: MUTED }}>· {templateLabel(it.brief.template, lang)}</span>}
                    </div>
                    <div style={{ marginTop: '4px' }}><PieceChips familia={it.familia} pilarSs={it.pilar_ss} tema={it.pillar} ssNames={ssNames} /></div>
                    {it.story_worthy && it.kind !== 'stories' && <div style={{ fontSize: '8.5px', color: '#A78BFA', marginTop: '2px' }}>{t.alsoStory}</div>}
                  </button>
                )
              })}
              {open.map((sl, k) => {
                const surface = formatMeta[sl.format]?.surface ?? (sl.producer === 'item_video' ? 'reels' : 'feed')
                return (
                  <div key={`slot-${k}`} title={sl.purpose} style={{ padding: '6px 8px', border: `1px dashed ${BORDER}`, borderRadius: '8px' }}>
                    <div style={{ fontSize: '10px', fontWeight: 700, color: 'rgba(255,255,255,0.75)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {SURFACE_ICON[surface] ?? '📝'} {sl.name}
                    </div>
                    <div style={{ fontSize: '8.5px', color: MUTED, marginTop: '2px' }}>{t.surf[surface] ?? surface} · {slotWho(sl)}</div>
                    <div style={{ marginTop: '4px' }}><PieceChips familia={sl.familia ?? formatMeta[sl.format]?.family ?? GENERIC_FAMILY[sl.format] ?? (sl.producer === 'item_video' ? 'tour' : 'eventual')} pilarSs={sl.pilar_ss} tema={sl.tema ?? formatMeta[sl.format]?.pillar ?? sl.pillar} ssNames={ssNames} /></div>
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
        <div style={{ fontSize: '15px', fontWeight: 800, color: 'white', marginBottom: '3px' }}>{t.title}</div>
        <div style={{ fontSize: '11.5px', color: MUTED, lineHeight: 1.55, maxWidth: '760px' }}>
          {t.introA}<strong style={{ color: 'white' }}>{t.introB}</strong>{t.introC}
        </div>
        {mix.length === 0 && (
          <div style={{ fontSize: '11.5px', color: MUTED, marginTop: '8px' }}>
            {t.noPlanA}<a href="/dashboard/marketing-ai/estrategia" style={{ color: ORANGE, fontWeight: 700 }}>{t.noPlanB}</a>{t.noPlanC}
          </div>
        )}
        {dmItems.length > 0 && (
          <div style={{ fontSize: '11px', color: MUTED, marginTop: '8px' }}>
            {t.also} {dmItems.map(m => `💬 ${m.name}`).join(' · ')}
          </div>
        )}
      </div>

      {/* A sub-aba Ideias (CreativeAgent) saiu em 2026-10-14: o calendário
          vem da estratégia, não de ideia solta (pedido do dono). */}
      {(
        <>
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '14px', padding: '10px 14px', background: 'rgba(255,255,255,0.02)', border: `1px solid ${BORDER}`, borderRadius: '10px', marginBottom: '18px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '9px' }}>
              <button onClick={toggleAuto} disabled={!autoLoaded}
                style={{ width: '36px', height: '20px', borderRadius: '99px', border: 'none', background: autoOn ? ORANGE : 'rgba(255,255,255,0.15)', position: 'relative', cursor: 'pointer', flexShrink: 0, padding: 0 }}>
                <span style={{ position: 'absolute', top: '2px', left: autoOn ? '18px' : '2px', width: '16px', height: '16px', borderRadius: '50%', background: 'white', transition: 'left 0.15s' }} />
              </button>
              <div>
                <div style={{ fontSize: '11.5px', fontWeight: 700, color: 'white' }}>{t.autoTitle}</div>
                <div style={{ fontSize: '10px', color: MUTED }}>{t.autoDesc}</div>
              </div>
            </div>
            <button onClick={planNow} disabled={planning || !token}
              style={{ marginLeft: 'auto', padding: '9px 16px', background: ORANGE, color: '#000', fontWeight: 700, fontSize: '12px', borderRadius: '9px', border: 'none', cursor: planning ? 'default' : 'pointer', fontFamily: D, opacity: planning ? 0.7 : 1 }}>
              {planning ? t.planning : t.planNow}
            </button>
          </div>
          {err && <div style={{ color: '#f87171', fontSize: '11.5px', marginBottom: '12px' }}>{err}</div>}
          {msg && <div style={{ color: GREEN, fontSize: '11.5px', marginBottom: '12px' }}>{msg}</div>}
          {todo.length > 0 && (
            <div style={{ fontSize: '11.5px', color: MUTED, marginBottom: '12px', lineHeight: 1.6 }}>
              {t.todo}
              <ul style={{ margin: '4px 0 0', paddingLeft: '18px', color: 'white' }}>
                {todo.map(x => <li key={x.format}>{t.perWeek(x.per_week)} {x.name}{x.purpose ? <span style={{ color: MUTED }}> — {x.purpose}</span> : null}</li>)}
              </ul>
            </div>
          )}

          <Week label={t.thisWeek} days={thisWeek} />
          <Week label={t.nextWeek} days={nextWeek} />
          <div style={{ marginBottom: '20px' }}>
              <div style={{ fontSize: '11px', fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>{t.loose}</div>
              <MakeNowPicker token={token} onRequested={() => { void load() }} />
              {loose.length > 0 && <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {loose.map(it => {
                  const status = scheduledIds.has(it.id) ? 'scheduled' : it.status === 'draft' && it.quality_score != null ? 'review' : it.status
                  const sm = STATUS_META[status] ?? STATUS_META.draft
                  return (
                    <button key={it.id} onClick={() => setOpen(it)} style={{ display: 'flex', alignItems: 'center', gap: '8px', maxWidth: '260px', padding: '6px 9px', background: 'rgba(255,255,255,0.03)', border: `1px solid ${BORDER}`, borderRadius: '9px', cursor: 'pointer', fontFamily: D, textAlign: 'left' }}>
                      {it.image_url && <img src={it.image_url} alt="" style={{ width: '30px', height: '30px', borderRadius: '6px', objectFit: 'cover', flexShrink: 0 }} />}
                      <span style={{ minWidth: 0 }}>
                        <span style={{ display: 'block', fontSize: '10.5px', fontWeight: 700, color: 'white', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{it.idea ?? 'Post'}</span>
                        <span style={{ display: 'block', fontSize: '8.5px', fontWeight: 700, color: sm.color }}>● {lang === 'en' ? STATUS_LABEL_EN[status] ?? sm.label : sm.label}{it.quality_score != null ? ` · ${it.quality_score}` : ''}</span>
                      </span>
                    </button>
                  )
                })}
              </div>}
          </div>
          {open && <CalendarPostModal post={open} companyId={companyId} onClose={() => setOpen(null)} onChanged={() => { void load() }} />}
        </>
      )}
    </div>
  )
}
