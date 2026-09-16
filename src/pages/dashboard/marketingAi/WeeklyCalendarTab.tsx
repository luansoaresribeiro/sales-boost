import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../../../lib/supabase'
import { CARD, MUTED, BORDER } from './shared'
import { TEMPLATE_LABEL, type TestPost } from './TestingArea'

const ORANGE = '#FF6D29'
const DAY_LABEL = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado']
const KIND_ICON: Record<string, string> = { organico: '📝', stories: '📖', campanhas: '🎯' }

interface DayItem { action_id: string; scheduled_at: string; post: TestPost & { kind?: string } }

// Semana corrente (Domingo → Sábado) contendo hoje — é o que o dono vê e
// ajusta; a geração automática (toda semana, domingo 18h, olhando tudo que
// o Agente de Dados sabe) ainda não roda sozinha — ver aviso abaixo.
function weekRange(): { start: Date; days: Date[] } {
  const now = new Date()
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay())
  const days = Array.from({ length: 7 }, (_, i) => new Date(start.getFullYear(), start.getMonth(), start.getDate() + i))
  return { start, days }
}
const sameDay = (a: Date, b: Date) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()

export default function WeeklyCalendarTab({ companyId }: { companyId: string }) {
  const [items, setItems] = useState<DayItem[]>([])
  const [loading, setLoading] = useState(true)
  const { days } = weekRange()

  const load = useCallback(async () => {
    const from = days[0].toISOString()
    const to = new Date(days[6].getFullYear(), days[6].getMonth(), days[6].getDate(), 23, 59, 59).toISOString()
    const { data: actions } = await supabase.from('agent_actions').select('id, ref_id, scheduled_at')
      .eq('company_id', companyId).eq('ref_type', 'marketing_ai_test_content').eq('execution_status', 'QUEUED')
      .not('scheduled_at', 'is', null).gte('scheduled_at', from).lte('scheduled_at', to)
    const ids = ((actions ?? []) as { ref_id: string }[]).map(a => a.ref_id)
    if (ids.length === 0) { setItems([]); setLoading(false); return }
    const { data: posts } = await supabase.from('marketing_ai_test_content').select('*').in('id', ids)
    const byId = new Map(((posts ?? []) as (TestPost & { kind?: string })[]).map(p => [p.id, p]))
    const rows: DayItem[] = ((actions ?? []) as { id: string; ref_id: string; scheduled_at: string }[])
      .flatMap(a => { const post = byId.get(a.ref_id); return post ? [{ action_id: a.id, scheduled_at: a.scheduled_at, post }] : [] })
    setItems(rows)
    setLoading(false)
  }, [companyId]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { load() }, [load])

  if (loading) return <div style={{ fontSize: '12px', color: MUTED }}>Carregando...</div>

  const today = new Date()

  return (
    <div>
      <div style={{ marginBottom: '16px' }}>
        <div style={{ fontSize: '15px', fontWeight: 800, color: 'white', marginBottom: '3px' }}>🗓️ Calendário da Semana</div>
        <div style={{ fontSize: '11.5px', color: MUTED, lineHeight: 1.55, maxWidth: '760px' }}>
          O que está agendado pra cada dia desta semana (posts e stories). <strong style={{ color: '#FBBF24' }}>Em construção:</strong> a ideia é o agente montar essa grade sozinho, todo domingo às 18h, com base em tudo que o Agente de Dados souber — por enquanto ela mostra o que já foi agendado manualmente pelo Vault.
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(120px, 1fr))', gap: '9px', overflowX: 'auto' }}>
        {days.map((d, i) => {
          const dayItems = items.filter(it => sameDay(new Date(it.scheduled_at), d))
          const isToday = sameDay(d, today)
          return (
            <div key={i} style={{ background: CARD, border: `1px solid ${isToday ? 'rgba(255,109,41,0.4)' : BORDER}`, borderRadius: '11px', padding: '10px', minHeight: '140px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <div style={{ fontSize: '10px', fontWeight: 800, color: isToday ? ORANGE : MUTED, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                {DAY_LABEL[i]} <span style={{ fontWeight: 600, color: 'rgba(255,255,255,0.35)' }}>{d.getDate()}/{d.getMonth() + 1}</span>
              </div>
              {dayItems.length === 0 ? (
                <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.25)', fontStyle: 'italic' }}>vazio</div>
              ) : dayItems.map(it => (
                <div key={it.action_id} style={{ padding: '6px 8px', background: 'rgba(255,255,255,0.03)', border: `1px solid ${BORDER}`, borderRadius: '8px' }}>
                  <div style={{ fontSize: '10.5px', fontWeight: 700, color: 'white', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {KIND_ICON[it.post.kind ?? 'organico'] ?? '📝'} {it.post.idea ?? 'Post'}
                  </div>
                  <div style={{ fontSize: '9px', color: MUTED }}>
                    {new Date(it.scheduled_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                    {it.post.brief?.template ? ` · ${TEMPLATE_LABEL[it.post.brief.template] ?? it.post.brief.template}` : ''}
                  </div>
                </div>
              ))}
            </div>
          )
        })}
      </div>
    </div>
  )
}
