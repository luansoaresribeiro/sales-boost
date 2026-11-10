import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { approveWeek, unscheduleAgentAction, unscheduleWeek, type WeekApprovalResult } from '../../lib/agentActions'
import { dayLabel, weekSlotIso, weekWindow, WEEK_MAX } from '../../lib/weekApproval'

// "Sua semana" (2026-11-10, pedido do dono): no domingo o dono VÊ os posts da semana e aprova todos de uma vez.
// Cada um fica aprovado por ele e agendado pro seu dia (agent-actions → approve_week); o cron publica no dia, com
// as travas de sempre na hora de sair. Dá pra tirar qualquer post antes de aprovar e cancelar depois.

const ORANGE = '#FF6D29'
const GREEN = '#4ade80'
const RED = '#f87171'
const CARD = '#150E08'
const MUTED = '#BABABA'
const BORDER = 'rgba(255,255,255,0.06)'

export interface WeekPieceRow {
  id: string; idea: string | null; caption: string | null; image_url: string | null
  planned_for?: string | null; recipe?: string | null; video_url?: string | null; quality_score?: number | null
}
interface Scheduled { id: string; ref_id: string; scheduled_at: string; title: string | null; payload: { image_url?: string | null } | null }

const TX = {
  pt: {
    title: '🗓️ Sua semana',
    sub: 'Veja os posts da semana e aprove todos de uma vez. Cada um sai sozinho no seu dia, às 18h. Dá pra tirar qualquer um antes e cancelar depois.',
    empty: 'O plano da semana sai no domingo à noite. Quando chegar, você aprova a semana inteira aqui, de uma vez.',
    out: 'Tirar', back: '↩ Incluir', view: 'Ver', removed: 'fora da semana',
    videoWait: '🎬 vídeo ainda em produção', late: 'o horário já passou — aprove sozinho',
    approve: (n: number) => `✓ Aprovar a semana (${n} post${n === 1 ? '' : 's'})`,
    confirm: (n: number, a: string, b: string) => `${n} post${n === 1 ? '' : 's'} vão sair sozinhos entre ${a} e ${b}, cada um no seu dia, às 18h. Você pode cancelar qualquer um até a hora de sair.`,
    yes: 'Confirmar', no: 'Voltar',
    done: (n: number) => `✓ ${n} post${n === 1 ? '' : 's'} aprovado${n === 1 ? '' : 's'} e agendado${n === 1 ? '' : 's'}.`,
    skippedHead: 'Ficaram de fora:',
    scheduledHead: 'Agendados', cancel: 'Cancelar', cancelAll: 'Cancelar a semana',
    cancelAllConfirm: 'Cancelar todos os agendamentos da semana? Os posts voltam pra cá, esperando você.',
    cancelled: (n: number) => `${n} agendamento${n === 1 ? '' : 's'} cancelado${n === 1 ? '' : 's'}. Os posts voltaram pra aprovação.`,
    err: 'Não consegui agora. Tente de novo.',
    max: `No máximo ${WEEK_MAX} posts por vez.`,
  },
  en: {
    title: '🗓️ Your week',
    sub: 'See this week\'s posts and approve them all at once. Each one goes out on its own day, at 6 pm (Brasília). You can remove any before and cancel later.',
    empty: 'The week plan arrives Sunday night. When it does, you approve the whole week here, at once.',
    out: 'Remove', back: '↩ Add back', view: 'View', removed: 'out of the week',
    videoWait: '🎬 video still in production', late: 'time already passed — approve it alone',
    approve: (n: number) => `✓ Approve the week (${n} post${n === 1 ? '' : 's'})`,
    confirm: (n: number, a: string, b: string) => `${n} post${n === 1 ? '' : 's'} will go out on their own between ${a} and ${b}, each on its day, at 6 pm. You can cancel any of them until it goes out.`,
    yes: 'Confirm', no: 'Back',
    done: (n: number) => `✓ ${n} post${n === 1 ? '' : 's'} approved and scheduled.`,
    skippedHead: 'Left out:',
    scheduledHead: 'Scheduled', cancel: 'Cancel', cancelAll: 'Cancel the week',
    cancelAllConfirm: 'Cancel all of this week\'s schedules? The posts come back here, waiting for you.',
    cancelled: (n: number) => `${n} schedule${n === 1 ? '' : 's'} cancelled. The posts are back for approval.`,
    err: 'Couldn\'t do it right now. Try again.',
    max: `At most ${WEEK_MAX} posts at a time.`,
  },
} as const

const btn = (bg: string, color: string, border?: string) => ({
  minHeight: 36, padding: '8px 14px', borderRadius: '10px', fontSize: '12.5px', fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer',
  background: bg, color, border: border ? `1px solid ${border}` : 'none',
})

const fmtWhen = (iso: string, lang: 'pt' | 'en') => {
  const day = new Date(Date.parse(iso) - 3 * 3600_000).toISOString().slice(0, 10)
  return `${dayLabel(day, lang)} · ${lang === 'en' ? '6 pm' : '18h'}`
}

export default function WeekApproval({ companyId, token, lang, pieces, onOpen, onChanged, reloadKey }: {
  companyId: string; token: string; lang: 'pt' | 'en'; pieces: WeekPieceRow[]
  onOpen: (id: string) => void; onChanged: () => void; reloadKey: number
}) {
  const tx = TX[lang]
  const [removed, setRemoved] = useState<Set<string>>(new Set())
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string; skipped?: WeekApprovalResult['skipped'] } | null>(null)
  const [scheduled, setScheduled] = useState<Scheduled[]>([])

  const loadScheduled = useCallback(async () => {
    const { to } = weekWindow()
    const until = new Date(Date.parse(`${to}T23:59:59-03:00`)).toISOString()
    const { data } = await supabase.from('agent_actions').select('id, ref_id, scheduled_at, title, payload')
      .eq('company_id', companyId).eq('ref_type', 'marketing_ai_test_content').eq('execution_status', 'QUEUED')
      .not('scheduled_at', 'is', null).lte('scheduled_at', until).order('scheduled_at', { ascending: true }).limit(60)
    setScheduled((data ?? []) as Scheduled[])
  }, [companyId])
  useEffect(() => { void loadScheduled() }, [loadScheduled, reloadKey])

  // Peças da semana por dia, na ordem. Vídeo sem arquivo e horário já passado aparecem, mas não entram.
  const rows = useMemo(() => pieces
    .map(p => ({ p, slot: weekSlotIso(p.planned_for), videoWait: p.recipe === 'video_imovel' && !p.video_url }))
    .sort((a, b) => String(a.p.planned_for).localeCompare(String(b.p.planned_for))), [pieces])
  const chosen = rows.filter(r => r.slot && !r.videoWait && !removed.has(r.p.id))
  const days = [...new Set(rows.map(r => r.p.planned_for as string))]

  const approve = async () => {
    const ids = chosen.map(r => r.p.id)
    if (ids.length > WEEK_MAX) { setMsg({ ok: false, text: tx.max }); return }
    setBusy(true); setMsg(null)
    try {
      const r = await approveWeek(token, companyId, ids)
      setMsg({ ok: r.scheduled.length > 0, text: tx.done(r.scheduled.length), skipped: r.skipped })
      setRemoved(new Set())
    } catch (e) { setMsg({ ok: false, text: e instanceof Error ? e.message : tx.err }) }
    setConfirming(false); setBusy(false)
    onChanged(); void loadScheduled()
  }

  const cancelOne = async (id: string) => {
    setBusy(true); setMsg(null)
    try { await unscheduleAgentAction(token, companyId, id) } catch { setMsg({ ok: false, text: tx.err }) }
    setBusy(false); onChanged(); void loadScheduled()
  }
  const cancelAll = async () => {
    if (!window.confirm(tx.cancelAllConfirm)) return
    setBusy(true); setMsg(null)
    try {
      const r = await unscheduleWeek(token, companyId, scheduled.slice(0, WEEK_MAX).map(s => s.id))
      setMsg({ ok: true, text: tx.cancelled(r.cancelled) })
    } catch { setMsg({ ok: false, text: tx.err }) }
    setBusy(false); onChanged(); void loadScheduled()
  }

  const firstDay = chosen[0]?.p.planned_for, lastDay = chosen[chosen.length - 1]?.p.planned_for

  return (
    <section style={{ background: CARD, border: '1px solid rgba(255,109,41,0.28)', borderRadius: '14px', padding: '18px', marginBottom: '28px' }}>
      <div style={{ fontSize: '15px', fontWeight: 800, color: 'white', marginBottom: '4px' }}>{tx.title}</div>
      <div style={{ fontSize: '12.5px', color: MUTED, lineHeight: 1.55, marginBottom: '14px' }}>{tx.sub}</div>

      {rows.length === 0 && scheduled.length === 0 && (
        <div style={{ fontSize: '12.5px', color: MUTED, padding: '12px', border: `1px dashed ${BORDER}`, borderRadius: '10px' }}>{tx.empty}</div>
      )}

      {days.map(day => (
        <div key={day} style={{ marginBottom: '12px' }}>
          <div style={{ fontSize: '11px', fontWeight: 800, letterSpacing: '0.04em', textTransform: 'uppercase', color: ORANGE, marginBottom: '6px' }}>{dayLabel(day, lang)}</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {rows.filter(r => r.p.planned_for === day).map(({ p, slot, videoWait }) => {
              const out = removed.has(p.id)
              const note = videoWait ? tx.videoWait : !slot ? tx.late : out ? tx.removed : null
              return (
                <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px', borderRadius: '10px', border: `1px solid ${BORDER}`, opacity: out || note ? 0.55 : 1 }}>
                  {p.image_url
                    ? <img src={p.image_url} alt="" style={{ width: 48, height: 48, borderRadius: 8, objectFit: 'cover', flexShrink: 0 }} />
                    : <div style={{ width: 48, height: 48, borderRadius: 8, background: 'rgba(255,255,255,0.04)', flexShrink: 0 }} />}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '12.5px', fontWeight: 700, color: 'white', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.recipe === 'video_imovel' ? '🎬 ' : ''}{p.idea ?? 'Post'}</div>
                    <div style={{ fontSize: '11.5px', color: note ? ORANGE : MUTED, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{note ?? p.caption ?? ''}</div>
                  </div>
                  <button onClick={() => onOpen(p.id)} style={btn('transparent', 'white', 'rgba(255,255,255,0.14)')}>{tx.view}</button>
                  {slot && !videoWait && (
                    <button disabled={busy} onClick={() => setRemoved(prev => { const n = new Set(prev); if (n.has(p.id)) n.delete(p.id); else n.add(p.id); return n })}
                      style={btn('transparent', out ? GREEN : MUTED, 'rgba(255,255,255,0.10)')}>{out ? tx.back : tx.out}</button>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      ))}

      {chosen.length > 0 && !confirming && (
        <button disabled={busy} onClick={() => { setMsg(null); setConfirming(true) }} style={{ ...btn(ORANGE, '#000'), width: '100%', marginTop: '4px' }}>{tx.approve(chosen.length)}</button>
      )}
      {confirming && firstDay && lastDay && (
        <div style={{ marginTop: '6px', padding: '12px', borderRadius: '10px', background: 'rgba(255,109,41,0.08)', border: '1px solid rgba(255,109,41,0.3)' }}>
          <div style={{ fontSize: '12.5px', color: 'white', lineHeight: 1.55, marginBottom: '10px' }}>{tx.confirm(chosen.length, dayLabel(firstDay, lang), dayLabel(lastDay, lang))}</div>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <button disabled={busy} onClick={() => void approve()} style={btn(ORANGE, '#000')}>{busy ? '…' : tx.yes}</button>
            <button disabled={busy} onClick={() => setConfirming(false)} style={btn('transparent', 'white', 'rgba(255,255,255,0.14)')}>{tx.no}</button>
          </div>
        </div>
      )}

      {msg && (
        <div role="status" style={{ marginTop: '10px', fontSize: '12px', lineHeight: 1.55, color: msg.ok ? GREEN : RED }}>
          {msg.text}
          {msg.skipped && msg.skipped.length > 0 && (
            <div style={{ color: MUTED, marginTop: '4px' }}>
              {tx.skippedHead} {msg.skipped.map(s => `${pieces.find(p => p.id === s.id)?.idea ?? 'post'} (${s.label})`).join(' · ')}
            </div>
          )}
        </div>
      )}

      {scheduled.length > 0 && (
        <div style={{ marginTop: '16px', paddingTop: '14px', borderTop: `1px solid ${BORDER}` }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', marginBottom: '8px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '12.5px', fontWeight: 700, color: GREEN }}>✓ {tx.scheduledHead} ({scheduled.length})</span>
            <button disabled={busy} onClick={() => void cancelAll()} style={btn('transparent', RED, 'rgba(248,113,113,0.35)')}>{tx.cancelAll}</button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {scheduled.map(s => (
              <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '6px 8px', borderRadius: '10px', border: `1px solid ${BORDER}` }}>
                {s.payload?.image_url && <img src={s.payload.image_url} alt="" style={{ width: 36, height: 36, borderRadius: 6, objectFit: 'cover', flexShrink: 0 }} />}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '12px', fontWeight: 700, color: 'white', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.title ?? 'Post'}</div>
                  <div style={{ fontSize: '11px', color: MUTED }}>{fmtWhen(s.scheduled_at, lang)}</div>
                </div>
                <button disabled={busy} onClick={() => void cancelOne(s.id)} style={btn('transparent', MUTED, 'rgba(255,255,255,0.10)')}>{tx.cancel}</button>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  )
}
