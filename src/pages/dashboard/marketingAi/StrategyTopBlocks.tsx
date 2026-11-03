import { useEffect, useState } from 'react'
import { supabase } from '../../../lib/supabase'
import { useCompany } from '../../../contexts/CompanyContext'
import { useLang } from '../../../contexts/LanguageContext'
import { CARD, MUTED, BORDER } from './shared'
import type { Strategy } from './strategyTypes'
import { buildFormatMeta, slotsByDay, openSlotsForDay, type FormatMeta } from './calendarSlots'

// Topo da Estratégia (Pacote A, 2026-11-03): 4 blocos que separam direcionamento, plano da semana, próxima ação e o "por quê".
// Tudo vem da estratégia e do calendário já existentes (sem tabela nova, sem duplicar content_plan). Estados: valor / ausência /
// carregando / "Não foi possível verificar" (regra 5).
const TX = {
  pt: {
    loading: 'Verificando…', error: 'Não foi possível verificar', none: 'Não definido',
    dir: 'Direcionamento ativo', bizObj: 'Objetivo de negócio', mktObj: 'Objetivo de marketing', focus: 'Foco estratégico', central: 'Tema central', noCentral: 'Sem tema central definido',
    audience: 'Público', themes: 'Temas (pilares)', plan: 'Plano da semana', noMix: 'Sem plano semanal definido', perWeek: (n: number) => `${n}x por semana`,
    next: 'Próxima ação', noNext: 'Nenhuma peça planejada nesta janela', slot: 'Vaga aberta', piece: 'Peça planejada', why: 'Por que essa direção', noWhy: 'Sem justificativa registrada nesta estratégia', opp: 'Oportunidade ligada',
  },
  en: {
    loading: 'Checking…', error: 'Could not verify', none: 'Not defined',
    dir: 'Active direction', bizObj: 'Business objective', mktObj: 'Marketing objective', focus: 'Strategic focus', central: 'Central theme', noCentral: 'No central theme defined',
    audience: 'Audience', themes: 'Themes (pillars)', plan: 'Weekly plan', noMix: 'No weekly plan defined', perWeek: (n: number) => `${n}x per week`,
    next: 'Next action', noNext: 'No piece planned in this window', slot: 'Open slot', piece: 'Planned piece', why: 'Why this direction', noWhy: 'No rationale recorded in this strategy', opp: 'Linked opportunity',
  },
} as const

type Next = { state: 'loading' | 'error' | 'empty' } | { state: 'value'; date: string; label: string; kind: 'slot' | 'piece' }
type Opps = { state: 'loading' | 'error' | 'empty' } | { state: 'value'; titles: string[] }

const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

export default function StrategyTopBlocks({ active, main }: { active: Strategy; main: Strategy | null }) {
  const { lang } = useLang(); const t = TX[lang]
  const { company } = useCompany()
  const [next, setNext] = useState<Next>({ state: 'loading' })
  const [opps, setOpps] = useState<Opps>({ state: 'loading' })
  const mix = main?.content_plan?.weekly_mix
  const mainId = main?.id, activeId = active.id, vertical = company?.vertical_key

  useEffect(() => {
    if (!company) return
    let off = false
    setNext({ state: 'loading' }); setOpps({ state: 'loading' })
    const todayIso = iso(new Date())
    Promise.all([
      supabase.from('marketing_ai_test_content').select('planned_for, idea, recipe, item_id').eq('company_id', company.id).is('source_id', null).gte('planned_for', todayIso).order('planned_for', { ascending: true }).limit(100),
      supabase.from('vertical_playbooks').select('config').eq('key', vertical ?? 'generico').maybeSingle(),
      supabase.from('growth_opportunities').select('title').eq('company_id', company.id).eq('strategy_id', activeId).limit(3),
    ]).then(([pcs, pb, op]) => {
      if (off) return
      if (op.error) setOpps({ state: 'error' }); else setOpps((op.data ?? []).length ? { state: 'value', titles: (op.data as { title: string }[]).map(o => o.title) } : { state: 'empty' })
      if (pcs.error || pb.error) { setNext({ state: 'error' }); return }
      const pieces = (pcs.data ?? []) as { planned_for: string; idea: string | null; recipe: string | null; item_id: string | null }[]
      const fm: Record<string, FormatMeta> = buildFormatMeta(pb.data?.config)
      // Mesma regra de "vaga aberta" do Calendário (calendarSlots.ts): vaga do plano que ainda não tem peça.
      const byDay = slotsByDay(Array.isArray(mix) ? mix : [], todayIso)
      const cands: { date: string; label: string; kind: 'slot' | 'piece' }[] = pieces.map(p => ({ date: p.planned_for, label: p.idea ?? '', kind: 'piece' as const }))
      for (const day of Object.keys(byDay)) for (const sl of openSlotsForDay(byDay[day], pieces.filter(p => p.planned_for === day), fm)) cands.push({ date: day, label: sl.name, kind: 'slot' })
      cands.sort((a, b) => a.date.localeCompare(b.date))
      setNext(cands.length ? { state: 'value', ...cands[0] } : { state: 'empty' })
    }).catch(() => { if (!off) { setNext({ state: 'error' }); setOpps({ state: 'error' }) } })
    return () => { off = true }
  }, [company, activeId, mainId, vertical, mix])

  const box: React.CSSProperties = { background: CARD, border: `1px solid ${BORDER}`, borderRadius: '12px', padding: '14px 16px' }
  const lbl: React.CSSProperties = { fontSize: '9.5px', fontWeight: 800, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' }
  const txt: React.CSSProperties = { fontSize: '12.5px', color: 'white', lineHeight: 1.55 }
  const line = (k: string, v: string | null | undefined) => <div style={txt}><span style={{ color: MUTED }}>{k}: </span>{v?.trim() || <span style={{ color: MUTED }}>{t.none}</span>}</div>

  const audiences = [...new Set((active.funnel_plan ?? []).map(f => f.audience?.trim()).filter(Boolean))].join(' · ')
  const pillars = (active.content_plan?.pillars ?? []).map(p => p.name).filter(Boolean).join(' · ')
  const central = active.content_plan?.central_line?.trim()
  const why = active.reasoning?.trim() || active.content_plan?.why?.trim()
  const nv = next.state === 'value' ? next : null
  const d = nv ? nv.date.split('-').reverse().slice(0, 2).join('/') : ''

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '10px', maxWidth: '1000px', marginBottom: '4px' }}>
      <div style={box}>
        <div style={lbl}>{t.dir}</div>
        {line(t.bizObj, active.primary_business_objective)}
        {line(t.mktObj, active.primary_marketing_objective)}
        {line(t.focus, active.strategic_focus)}
        {line(t.audience, audiences)}
        {central ? line(t.central, central) : <div style={{ ...txt, color: MUTED }}>{t.noCentral}</div>}
        {line(t.themes, pillars)}
      </div>
      <div style={box}>
        <div style={lbl}>{t.plan}</div>
        {Array.isArray(mix) && mix.length ? mix.map(m => <div key={m.format} style={txt}>{m.name} <span style={{ color: MUTED }}>· {t.perWeek(m.per_week)}</span></div>) : <div style={{ ...txt, color: MUTED }}>{t.noMix}</div>}
      </div>
      <div style={box}>
        <div style={lbl}>{t.next}</div>
        {next.state === 'loading' ? <div style={{ ...txt, color: MUTED }}>{t.loading}</div>
          : next.state === 'error' ? <div style={{ ...txt, color: MUTED }}>{t.error}</div>
          : !nv ? <div style={{ ...txt, color: MUTED }}>{t.noNext}</div>
          : <div style={txt}><strong>{d}</strong> · {nv.label || (nv.kind === 'slot' ? t.slot : t.piece)} <span style={{ color: MUTED }}>({nv.kind === 'slot' ? t.slot : t.piece})</span></div>}
      </div>
      <div style={box}>
        <div style={lbl}>{t.why}</div>
        <div style={{ ...txt, ...(why ? {} : { color: MUTED }) }}>{why || t.noWhy}</div>
        {opps.state === 'value' && <div style={{ ...txt, marginTop: '6px' }}><span style={{ color: MUTED }}>{t.opp}: </span>{opps.titles.join(' · ')}</div>}
        {opps.state === 'error' && <div style={{ ...txt, marginTop: '6px', color: MUTED }}>{t.opp}: {t.error}</div>}
      </div>
    </div>
  )
}
