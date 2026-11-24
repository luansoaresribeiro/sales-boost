// P2 (dono, 24/11): bloco "Passou da data" em Aprovações. Posts esperando aprovação cuja data já passou não vão ao ar;
// o botão remarca cada um para o próximo dia livre (1 post por dia). Só muda a data — não aprova nem publica.
import { useState } from 'react'
import { supabase } from '../../lib/supabase'
import { planReschedule } from '../../lib/rescheduleOverdue'

const ORANGE = '#FF6D29'
const GREEN = '#4ade80'
const RED = '#f87171'
const CARD = '#150E08'
const MUTED = '#BABABA'

const TX = {
  pt: {
    title: 'Passou da data',
    sub: (n: number) => `${n} ${n === 1 ? 'post esperava' : 'posts esperavam'} aprovação para um dia que já passou. Eles não vão ao ar assim.`,
    btn: 'Remarcar para os próximos dias livres',
    busy: 'Remarcando…',
    note: 'Só muda a data. Depois você aprova normalmente.',
    done: (n: number) => `✓ ${n} ${n === 1 ? 'post remarcado' : 'posts remarcados'}.`,
    none: 'Não há dia livre nas próximas 3 semanas.',
    fail: 'Não deu para remarcar agora. Tente de novo.',
    was: 'era',
    open: 'Abrir',
  },
  en: {
    title: 'Past due',
    sub: (n: number) => `${n} ${n === 1 ? 'post was' : 'posts were'} waiting for approval on a day that already passed. They won't go live like this.`,
    btn: 'Move to the next free days',
    busy: 'Moving…',
    note: 'Only the date changes. You still approve as usual.',
    done: (n: number) => `✓ ${n} ${n === 1 ? 'post moved' : 'posts moved'}.`,
    none: 'No free day in the next 3 weeks.',
    fail: "Couldn't move them now. Try again.",
    was: 'was',
    open: 'Open',
  },
}

export interface OverduePiece { id: string; planned_for: string; idea?: string | null; image_url?: string | null }

export default function OverdueBlock({ companyId, pieces, lang, onOpen, onChanged }: {
  companyId: string; pieces: OverduePiece[]; lang: 'pt' | 'en'; onOpen: (id: string) => void; onChanged: () => void
}) {
  const t = TX[lang]
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  if (!pieces.length) return null

  const reschedule = async () => {
    setBusy(true); setMsg(null)
    try {
      // Dias ocupados: qualquer peça ativa da empresa com data de hoje em diante (mesma regra do plano semanal).
      const today = new Date(Date.now() - 3 * 3600_000).toISOString().slice(0, 10)
      const { data, error } = await supabase.from('marketing_ai_test_content').select('planned_for')
        .eq('company_id', companyId).gte('planned_for', today).not('status', 'in', '(archived,rejected)')
      if (error) throw error
      const plan = planReschedule(pieces, ((data ?? []) as { planned_for: string | null }[]).map(r => r.planned_for))
      if (!plan.length) { setMsg(t.none); setBusy(false); return }
      for (const p of plan) {
        const { error: e } = await supabase.from('marketing_ai_test_content').update({ planned_for: p.to }).eq('id', p.id).eq('status', 'vault')
        if (e) throw e
      }
      setMsg(t.done(plan.length))
      onChanged()
    } catch { setMsg(t.fail) }
    setBusy(false)
  }

  const fmt = (day: string) => day.split('-').reverse().slice(0, 2).join('/')
  return (
    <section style={{ marginBottom: '28px', background: CARD, border: `1px solid rgba(248,113,113,0.35)`, borderRadius: '14px', padding: '16px 18px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
        <span style={{ fontSize: '13px', fontWeight: 700, color: 'white' }}>{t.title}</span>
        <span style={{ fontSize: '11px', fontWeight: 700, padding: '2px 9px', borderRadius: '99px', background: 'rgba(248,113,113,0.12)', color: RED }}>{pieces.length}</span>
      </div>
      <p style={{ color: MUTED, fontSize: '12.5px', marginBottom: '12px', lineHeight: 1.5 }}>{t.sub(pieces.length)}</p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '12px' }}>
        {[...pieces].sort((a, b) => a.planned_for.localeCompare(b.planned_for)).map(p => (
          <button key={p.id} onClick={() => onOpen(p.id)} style={{ display: 'flex', alignItems: 'center', gap: '10px', background: 'transparent', border: 'none', padding: 0, cursor: 'pointer', textAlign: 'left', minWidth: 0 }}>
            {p.image_url ? <img src={p.image_url} alt="" style={{ width: 32, height: 40, objectFit: 'cover', borderRadius: 4, flexShrink: 0 }} /> : <span style={{ width: 32, height: 40, borderRadius: 4, background: '#2a1f17', flexShrink: 0 }} />}
            <span style={{ fontSize: '12px', color: 'white', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, minWidth: 0 }}>{p.idea || t.open}</span>
            <span style={{ fontSize: '11px', color: RED, flexShrink: 0 }}>{t.was} {fmt(p.planned_for)}</span>
          </button>
        ))}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '10px' }}>
        <button onClick={() => { void reschedule() }} disabled={busy}
          style={{ background: ORANGE, color: 'white', border: 'none', borderRadius: '10px', padding: '9px 14px', fontSize: '12.5px', fontWeight: 700, cursor: busy ? 'default' : 'pointer', opacity: busy ? 0.6 : 1 }}>
          {busy ? t.busy : t.btn}
        </button>
        <span style={{ fontSize: '11.5px', color: MUTED }}>{t.note}</span>
      </div>
      {msg && <div style={{ fontSize: '12px', marginTop: '10px', color: msg.startsWith('✓') ? GREEN : RED }}>{msg}</div>}
    </section>
  )
}
