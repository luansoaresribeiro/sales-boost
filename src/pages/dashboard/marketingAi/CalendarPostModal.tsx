import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../../../lib/supabase'
import { useAuth } from '../../../contexts/AuthContext'
import { CARD, MUTED, BORDER, D, SUPABASE_URL, useSSNames } from './shared'
import { ScoreBreakdown, BriefBlock, PostMedia, VideoScript, templateLabel, type TestPost } from './TestingArea'
import { useLang, type Lang } from '../../../contexts/LanguageContext'
import AdaptModal, { type VaultPost } from './AdaptModal'
import { PieceChips } from './PieceLabels'
import { proposeAgentAction, unscheduleAgentAction } from '../../../lib/agentActions'
import { PUBLISH_HOUR_BRT, plannedPublishAt, publishWhenLabel } from '../../../lib/publishSlot'

const GREEN = '#4ade80'
const ORANGE = '#FF6D29'
const AMBER = '#FBBF24'
const TX = {
  pt: {
    kind: { organico: 'Feed', stories: 'Stories', campanhas: 'Campanha' } as Record<string, string>,
    published: 'Publicado de verdade no Instagram ✓', pubFail: 'Post aprovado, mas não foi possível publicar no Instagram agora.', approvedPosts: 'Aprovado — publique na aba Posts ✓',
    pubErr: 'Erro ao publicar', scheduledFor: 'Agendado pra', schedErr: 'Erro ao agendar', cancelErr: 'Erro ao cancelar',
    ready: (n: number | null) => `✅ Passou na análise${n != null ? ` (nota ${n})` : ''} — pronta pra você aprovar.`,
    low: (n: number | null) => `⚠️ Não passou na análise${n != null ? ` (nota ${n} de 100 — algo ficou claramente ruim)` : ''}. Veja abaixo o que pesou. Não vai ao ar sozinha.`,
    evaluating: '⏳ Sendo avaliada pela IA — a nota aparece em instantes.',
    planned: 'Planejada pra', approveHint: 'Nada vai ao ar sem o seu OK: 🚀 publica agora, 📅 marca o horário.',
    scheduledAt: '🕐 Agendado pra', cancelSched: 'Cancelar agendamento', confirm: 'Confirmar', publish: '🚀 Publicar agora', schedLater: '📅 Agendar',
    approvePlanned: (when: string) => `✅ Aprovar — sai ${when}`, planHint: (when: string) => `Planejada pro futuro: aprovar agenda a publicação ${when} (horário padrão de Brasília). Nada sai antes disso. 🚀 publica já, 📅 escolhe outro horário.`,
    releaseAnyway: 'Liberar mesmo assim', toReview: 'Voltar pra revisão', del: 'Excluir', close: 'Fechar',
    adaptContent: '✨ Adaptar Conteúdo', adaptations: 'Adaptações', approvePub: 'Aprovar/Publicar',
    why: 'Por que excluir? O agente aprende com isso pra não repetir.', notePh: 'Quer explicar? (opcional)', delNoReason: 'Excluir sem motivo', cancel: 'Cancelar',
    reasons: { repetido: 'Repetido', texto: 'Texto ruim', foto: 'Foto ruim', errado: 'Informação errada', tom: 'Não tem a cara da marca', outro: 'Outro' } as Record<string, string>,
    editCap: '✏️ Editar legenda', saveCap: 'Salvar legenda', capSaved: 'Legenda salva — o agente vai aprender com a sua mudança ✓',
  },
  en: {
    kind: { organico: 'Feed', stories: 'Stories', campanhas: 'Campaign' } as Record<string, string>,
    published: 'Actually published on Instagram ✓', pubFail: 'Post approved, but it could not be published on Instagram right now.', approvedPosts: 'Approved — publish from the Posts tab ✓',
    pubErr: 'Error publishing', scheduledFor: 'Scheduled for', schedErr: 'Error scheduling', cancelErr: 'Error cancelling',
    ready: (n: number | null) => `✅ Passed the review${n != null ? ` (score ${n})` : ''} — ready for your approval.`,
    low: (n: number | null) => `⚠️ Did not pass the review${n != null ? ` (score ${n} of 100 — something is clearly off)` : ''}. See below what weighed in. It never goes live on its own.`,
    evaluating: '⏳ Being reviewed by the AI — the score shows up shortly.',
    planned: 'Planned for', approveHint: 'Nothing goes live without your OK: 🚀 publishes now, 📅 picks a time.',
    scheduledAt: '🕐 Scheduled for', cancelSched: 'Cancel schedule', confirm: 'Confirm', publish: '🚀 Publish now', schedLater: '📅 Schedule',
    approvePlanned: (when: string) => `✅ Approve — goes out ${when}`, planHint: (when: string) => `Planned for a future day: approving schedules the post for ${when} (default time, Brasília). Nothing goes out before then. 🚀 publishes now, 📅 picks another time.`,
    releaseAnyway: 'Release anyway', toReview: 'Back to review', del: 'Delete', close: 'Close',
    adaptContent: '✨ Adapt Content', adaptations: 'Adaptations', approvePub: 'Approve/Publish',
    why: 'Why delete it? The agent learns from this so it does not repeat it.', notePh: 'Want to explain? (optional)', delNoReason: 'Delete without a reason', cancel: 'Cancel',
    reasons: { repetido: 'Repetitive', texto: 'Bad text', foto: 'Bad photo', errado: 'Wrong information', tom: 'Not our brand style', outro: 'Other' } as Record<string, string>,
    editCap: '✏️ Edit caption', saveCap: 'Save caption', capSaved: 'Caption saved — the agent will learn from your change ✓',
  },
} as const
const fmtScheduled = (iso: string, lang: Lang) => new Date(iso).toLocaleString(lang === 'en' ? 'en-US' : 'pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })

// Sugestão do agendamento manual: o horário padrão de Brasília (mesma fonte do publishSlot) mostrado no relógio do navegador (datetime-local).
const brtLocalInput = (day: string): string => {
  const d = new Date(`${day}T${String(PUBLISH_HOUR_BRT).padStart(2, '0')}:00:00-03:00`)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`
}

type Post = TestPost & { kind?: string; planned_for?: string | null; recipe?: string | null }

// Peça do calendário aberta (substitui a antiga aba Vault — decisão do dono
// 2026-10-14: "pra ver o post clico em cima na grade do calendário"). Mostra a
// análise e a nota da peça e, quando passou (status 'vault' — hoje: os dois analistas de texto e
// imagem com nota ≥50, regra do content-test), os
// botões de aprovar: publicar agora ou agendar. Peça que não passou fica em
// revisão (status 'draft'): mostra o porquê e o dono decide (liberar mesmo
// assim ou excluir). Nada vai ao público sem o clique do dono (regra 1).
export default function CalendarPostModal({ post, companyId, onClose, onChanged }: { post: Post; companyId: string; onClose: () => void; onChanged: () => void }) {
  const { session } = useAuth()
  const { lang } = useLang(); const tx = TX[lang]
  const token = session?.access_token ?? ''
  const ssNames = useSSNames(companyId)
  const [item, setItem] = useState<Post>(post)
  const [adapts, setAdapts] = useState<TestPost[]>([])
  const [adaptOpen, setAdaptOpen] = useState(false)
  const [showAdapts, setShowAdapts] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [okMsg, setOkMsg] = useState('')
  const [scheduled, setScheduled] = useState<{ actionId: string; at: string } | null>(null)
  const [scheduling, setScheduling] = useState(false)
  // Sugere o dia planejado pelo calendário, às 18h.
  const [scheduleValue, setScheduleValue] = useState(post.planned_for && /^\d{4}-\d{2}-\d{2}$/.test(post.planned_for) ? brtLocalInput(post.planned_for) : '')

  const load = useCallback(async () => {
    const [{ data: row }, { data: a }, { data: sch }] = await Promise.all([
      supabase.from('marketing_ai_test_content').select('*').eq('id', post.id).maybeSingle(),
      supabase.from('marketing_ai_test_content').select('*').eq('company_id', companyId).eq('status', 'adapt').eq('source_id', post.id).order('created_at', { ascending: false }),
      supabase.from('agent_actions').select('id, scheduled_at').eq('company_id', companyId).eq('ref_type', 'marketing_ai_test_content').eq('ref_id', post.id).eq('execution_status', 'QUEUED').not('scheduled_at', 'is', null).limit(1).maybeSingle(),
    ])
    if (row) setItem(row as Post)
    setAdapts((a ?? []) as TestPost[])
    setScheduled(sch ? { actionId: sch.id as string, at: sch.scheduled_at as string } : null)
  }, [post.id, companyId])
  useEffect(() => { load() }, [load])

  const done = async () => { await load(); onChanged() }

  // Propõe já aprovado (approve_now) — o clique em "Publicar" É a decisão do
  // dono. Passa pela Central de Approvals (agent_actions), que executa na hora.
  const publish = async (p: TestPost) => {
    setBusy(p.id); setError(''); setOkMsg('')
    try {
      const action = await proposeAgentAction(token, {
        company_id: companyId, agent_key: 'content', agent_name: lang === 'en' ? 'Calendar' : 'Calendário',
        action_type: 'create_content', channel: 'instagram', source: 'vault',
        ref_type: 'marketing_ai_test_content', ref_id: p.id, title: p.idea ?? (lang === 'en' ? 'Calendar post' : 'Post do calendário'),
        agent_interpretation: lang === 'en' ? `Approved by the owner in the calendar (score ${p.quality_score ?? '—'}).` : `Aprovado pelo dono no calendário (nota ${p.quality_score ?? '—'}).`,
        payload: { idea: p.idea, caption: p.caption, hashtags: p.hashtags, cta: p.cta, image_url: p.image_url, media: p.media },
        approve_now: true,
      })
      if (action.execution_status === 'EXECUTED' && (action.execution_result as { published_to_instagram?: boolean } | null)?.published_to_instagram) setOkMsg(tx.published)
      else if (action.execution_status === 'FAILED') setError(action.execution_error ?? tx.pubFail)
      else setOkMsg(tx.approvedPosts)
      await done()
    } catch (e) { setError(e instanceof Error ? e.message : tx.pubErr) }
    setBusy(null)
  }

  // Agenda: aprovado agora, publicado pelo cron na hora marcada.
  const schedule = async (planIso?: string) => {
    if (!planIso && !scheduleValue) return
    const iso = planIso ?? new Date(scheduleValue).toISOString()
    setBusy(item.id); setError(''); setOkMsg('')
    try {
      await proposeAgentAction(token, {
        company_id: companyId, agent_key: 'content', agent_name: lang === 'en' ? 'Calendar' : 'Calendário',
        action_type: 'create_content', channel: 'instagram', source: 'vault',
        ref_type: 'marketing_ai_test_content', ref_id: item.id, title: item.idea ?? (lang === 'en' ? 'Calendar post' : 'Post do calendário'),
        agent_interpretation: lang === 'en' ? `Approved by the owner in the calendar (score ${item.quality_score ?? '—'}), scheduled.` : `Aprovado pelo dono no calendário (nota ${item.quality_score ?? '—'}), agendado.`,
        payload: { idea: item.idea, caption: item.caption, hashtags: item.hashtags, cta: item.cta, image_url: item.image_url, media: item.media },
        scheduled_at: iso,
      })
      setOkMsg(`${tx.scheduledFor} ${fmtScheduled(iso, lang)} ✓`)
      setScheduling(false)
      await done()
    } catch (e) { setError(e instanceof Error ? e.message : tx.schedErr) }
    setBusy(null)
  }

  const cancelSchedule = async () => {
    if (!scheduled) return
    setBusy(item.id); setError('')
    try { await unscheduleAgentAction(token, companyId, scheduled.actionId) } catch (e) { setError(e instanceof Error ? e.message : tx.cancelErr) }
    await done()
    setBusy(null)
  }

  const setStatus = async (status: 'vault' | 'draft') => {
    setBusy(item.id); setError('')
    await supabase.from('marketing_ai_test_content').update({ status }).eq('id', item.id)
    await done()
    setBusy(null)
  }

  const discard = async (id: string) => {
    setBusy(id); setError('')
    await supabase.from('marketing_ai_test_content').delete().eq('id', id)
    setBusy(null)
    if (id === item.id) { onChanged(); onClose() } else await done()
  }

  // Memória do Agente de Conteúdo: excluir pergunta "por quê?" e editar a
  // legenda guarda antes/depois (agent_memory, role conteudo_licoes); depois
  // o creative-generate (relearn) reescreve as lições que todo criador lê.
  const [asking, setAsking] = useState(false)
  const [reason, setReason] = useState('')
  const [note, setNote] = useState('')
  const [editing, setEditing] = useState(false)
  const [draftCap, setDraftCap] = useState('')
  const relearnSoon = () => {
    void fetch(`${SUPABASE_URL}/functions/v1/creative-generate`, {
      method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'relearn' }), keepalive: true,
    }).catch(() => { /* aprende no próximo domingo */ })
  }
  const remember = async (value: Record<string, unknown>) => {
    await supabase.from('agent_memory').upsert({
      company_id: companyId, agent_role: 'conteudo_licoes', key: `fb:${item.id}`, type: 'fact', updated_at: new Date().toISOString(),
      value: JSON.stringify({ idea: item.idea, recipe: item.recipe ?? null, ...value }),
    }, { onConflict: 'company_id,agent_role,key' })
  }
  const confirmDelete = async (withReason: boolean) => {
    if (withReason && reason) {
      await remember({ kind: 'delete', reason: tx.reasons[reason] ?? reason, note: note.trim() || undefined })
      relearnSoon()
    }
    await discard(item.id)
  }
  const saveCaption = async () => {
    const before = item.caption ?? ''
    const after = draftCap.trim()
    setBusy(item.id); setError('')
    await supabase.from('marketing_ai_test_content').update({ caption: after }).eq('id', item.id)
    if (after !== before.trim()) { await remember({ kind: 'edit', before, after }); relearnSoon() }
    setEditing(false); setOkMsg(tx.capSaved)
    await done()
    setBusy(null)
  }

  const isBusy = busy === item.id
  // Peça planejada pra um dia futuro: aprovar AGENDA pro dia no horário padrão (o servidor tem a mesma regra no Telegram).
  const plan = plannedPublishAt(item.planned_for)
  const planWhen = plan ? publishWhenLabel(plan, lang) : ''
  const ready = item.status === 'vault'
  const evaluated = item.quality_score != null
  const btn = (color: string, bg: string): React.CSSProperties => ({ padding: '9px 12px', background: bg, border: `1px solid ${color}66`, borderRadius: '9px', color, fontSize: '12px', fontWeight: 700, cursor: isBusy ? 'default' : 'pointer', fontFamily: D })
  const ghost: React.CSSProperties = { padding: '9px 12px', background: 'transparent', border: `1px solid ${BORDER}`, borderRadius: '9px', color: MUTED, fontSize: '12px', cursor: isBusy ? 'default' : 'pointer', fontFamily: D }

  return (
    <>
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
      <div onClick={e => e.stopPropagation()} role="dialog" aria-label={item.idea ?? 'Post'}
        style={{ width: '100%', maxWidth: '560px', maxHeight: '92vh', overflowY: 'auto', background: CARD, border: `1px solid ${BORDER}`, borderRadius: '14px' }}>
        <PostMedia post={item} height={260} />
        <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '7px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '9.5px', fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{tx.kind[item.kind ?? 'organico'] ?? item.kind}</span>
            {item.format && <span style={{ fontSize: '10px', color: MUTED }}>· {item.format}</span>}
            {item.format === 'foto' && item.brief?.template && <span style={{ fontSize: '10px', color: '#A78BFA' }}>· {templateLabel(item.brief.template, lang)}</span>}
            {item.planned_for && <span style={{ fontSize: '10px', color: MUTED }}>· {tx.planned} {item.planned_for.split('-').reverse().slice(0, 2).join('/')}</span>}
            <button onClick={onClose} aria-label={tx.close} style={{ marginLeft: 'auto', background: 'transparent', border: 'none', color: MUTED, fontSize: '18px', cursor: 'pointer', lineHeight: 1 }}>✕</button>
          </div>

          <div style={{ fontSize: '12px', lineHeight: 1.5, padding: '9px 12px', borderRadius: '9px', color: ready ? GREEN : evaluated ? AMBER : MUTED, background: ready ? 'rgba(74,222,128,0.08)' : evaluated ? 'rgba(251,191,36,0.08)' : 'rgba(255,255,255,0.03)', border: `1px solid ${ready ? 'rgba(74,222,128,0.3)' : evaluated ? 'rgba(251,191,36,0.3)' : BORDER}` }}>
            {ready ? tx.ready(item.quality_score) : evaluated ? tx.low(item.quality_score) : tx.evaluating}
          </div>

          {/* Vídeo do calendário ainda sendo feito (ou que não saiu): o motivo vem em reasoning. */}
          {item.recipe === 'video_imovel' && !item.video_url && item.reasoning && (
            <div style={{ fontSize: '11.5px', color: '#60a5fa', background: 'rgba(96,165,250,0.08)', border: '1px solid rgba(96,165,250,0.3)', borderRadius: '9px', padding: '9px 12px', lineHeight: 1.5 }}>🎬 {item.reasoning}</div>
          )}
          <PieceChips familia={item.familia} pilarSs={item.pilar_ss} tema={item.pillar} ssNames={ssNames} />
          {item.idea && <div style={{ fontSize: '13.5px', fontWeight: 700, color: 'white' }}>{item.idea}</div>}
          {editing ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <textarea value={draftCap} onChange={e => setDraftCap(e.target.value)} rows={6}
                style={{ width: '100%', boxSizing: 'border-box', padding: '9px', background: 'rgba(255,255,255,0.04)', border: `1px solid ${BORDER}`, borderRadius: '9px', color: 'white', fontSize: '12px', lineHeight: 1.5, fontFamily: D, resize: 'vertical' }} />
              <div style={{ display: 'flex', gap: '7px' }}>
                <button onClick={saveCaption} disabled={isBusy || !draftCap.trim()} style={btn(GREEN, 'rgba(74,222,128,0.12)')}>{isBusy ? '...' : tx.saveCap}</button>
                <button onClick={() => setEditing(false)} style={ghost}>{tx.cancel}</button>
              </div>
            </div>
          ) : (
            <>
              {item.caption && <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.8)', lineHeight: 1.55, whiteSpace: 'pre-wrap' }}>{item.caption}</div>}
              {!scheduled && <button onClick={() => { setDraftCap(item.caption ?? ''); setEditing(true) }} style={{ alignSelf: 'flex-start', background: 'transparent', border: 'none', color: ORANGE, fontSize: '11px', fontWeight: 700, cursor: 'pointer', fontFamily: D, padding: 0 }}>{tx.editCap}</button>}
            </>
          )}
          {item.hashtags && <div style={{ fontSize: '11px', color: '#60a5fa', lineHeight: 1.4 }}>{item.hashtags}</div>}

          <BriefBlock post={item} />
          <VideoScript post={item} />
          <ScoreBreakdown post={item} />

          {error && <div style={{ color: '#f87171', fontSize: '11.5px' }}>{error}</div>}
          {okMsg && <div style={{ color: GREEN, fontSize: '11.5px' }}>{okMsg}</div>}

          {scheduled ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '7px', flexWrap: 'wrap' }}>
              <div style={{ flex: 1, padding: '9px', background: 'rgba(96,165,250,0.12)', border: '1px solid rgba(96,165,250,0.35)', borderRadius: '9px', color: '#60a5fa', fontSize: '11.5px', fontWeight: 700, textAlign: 'center' }}>
                {tx.scheduledAt} {fmtScheduled(scheduled.at, lang)}
              </div>
              <button onClick={cancelSchedule} disabled={isBusy} title={tx.cancelSched} style={ghost}>✕ {tx.cancelSched}</button>
            </div>
          ) : ready ? (
            <>
              <div style={{ fontSize: '10.5px', color: MUTED }}>{plan ? tx.planHint(planWhen) : tx.approveHint}</div>
              {scheduling ? (
                <div style={{ display: 'flex', gap: '7px', flexWrap: 'wrap' }}>
                  <input type="datetime-local" value={scheduleValue} onChange={e => setScheduleValue(e.target.value)}
                    min={new Date(Date.now() + 5 * 60000).toISOString().slice(0, 16)}
                    style={{ flex: 1, minWidth: '170px', padding: '8px', background: 'rgba(255,255,255,0.04)', border: `1px solid ${BORDER}`, borderRadius: '9px', color: 'white', fontSize: '12px', fontFamily: D, colorScheme: 'dark' }} />
                  <button onClick={() => schedule()} disabled={isBusy || !scheduleValue} style={btn('#60a5fa', 'rgba(96,165,250,0.14)')}>{isBusy ? '...' : tx.confirm}</button>
                  <button onClick={() => setScheduling(false)} style={ghost}>✕</button>
                </div>
              ) : (
                <div style={{ display: 'flex', gap: '7px', flexWrap: 'wrap' }}>
                  {plan ? (
                    <>
                      <button onClick={() => schedule(plan.iso)} disabled={isBusy} style={{ ...btn(GREEN, 'rgba(74,222,128,0.14)'), flex: 1 }}>{isBusy ? '...' : tx.approvePlanned(planWhen)}</button>
                      <button onClick={() => publish(item)} disabled={isBusy} style={btn(GREEN, 'transparent')}>{tx.publish}</button>
                    </>
                  ) : (
                    <button onClick={() => publish(item)} disabled={isBusy} style={{ ...btn(GREEN, 'rgba(74,222,128,0.14)'), flex: 1 }}>{isBusy ? '...' : tx.publish}</button>
                  )}
                  <button onClick={() => setScheduling(true)} disabled={isBusy} style={btn('#60a5fa', 'transparent')}>{tx.schedLater}</button>
                  <button onClick={() => setStatus('draft')} disabled={isBusy} title={tx.toReview} style={ghost}>↩︎</button>
                  <button onClick={() => setAsking(true)} disabled={isBusy} title={tx.del} style={ghost}>🗑</button>
                </div>
              )}
              <button onClick={() => setAdaptOpen(true)} style={btn(ORANGE, 'rgba(255,109,41,0.1)')}>{tx.adaptContent}</button>
            </>
          ) : evaluated ? (
            <div style={{ display: 'flex', gap: '7px', flexWrap: 'wrap' }}>
              <button onClick={() => setStatus('vault')} disabled={isBusy} style={{ ...btn(AMBER, 'rgba(251,191,36,0.1)'), flex: 1 }}>{isBusy ? '...' : tx.releaseAnyway}</button>
              <button onClick={() => setAsking(true)} disabled={isBusy} style={ghost}>🗑 {tx.del}</button>
            </div>
          ) : null}

          {asking && (
            <div style={{ padding: '11px 12px', border: `1px solid ${BORDER}`, borderRadius: '10px', background: 'rgba(255,255,255,0.02)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ fontSize: '11.5px', fontWeight: 700, color: 'white' }}>{tx.why}</div>
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                {Object.entries(tx.reasons).map(([k, label]) => (
                  <button key={k} onClick={() => setReason(k)} style={{ padding: '5px 10px', borderRadius: '99px', border: `1px solid ${reason === k ? 'rgba(255,109,41,0.6)' : BORDER}`, background: reason === k ? 'rgba(255,109,41,0.14)' : 'transparent', color: reason === k ? ORANGE : 'white', fontSize: '11px', fontWeight: 700, cursor: 'pointer', fontFamily: D }}>{label}</button>
                ))}
              </div>
              <input value={note} onChange={e => setNote(e.target.value)} placeholder={tx.notePh} maxLength={200}
                style={{ padding: '8px', background: 'rgba(255,255,255,0.04)', border: `1px solid ${BORDER}`, borderRadius: '8px', color: 'white', fontSize: '12px', fontFamily: D }} />
              <div style={{ display: 'flex', gap: '7px', flexWrap: 'wrap' }}>
                <button onClick={() => confirmDelete(true)} disabled={isBusy || !reason} style={btn('#f87171', 'rgba(248,113,113,0.1)')}>{isBusy ? '...' : `🗑 ${tx.del}`}</button>
                <button onClick={() => confirmDelete(false)} disabled={isBusy} style={ghost}>{tx.delNoReason}</button>
                <button onClick={() => { setAsking(false); setReason(''); setNote('') }} style={ghost}>{tx.cancel}</button>
              </div>
            </div>
          )}

          {adapts.length > 0 && (
            <div>
              <button onClick={() => setShowAdapts(v => !v)} style={{ width: '100%', textAlign: 'left', background: 'transparent', border: 'none', color: MUTED, fontSize: '11px', fontWeight: 700, cursor: 'pointer', fontFamily: D, padding: '4px 0' }}>
                {tx.adaptations} ({adapts.length}) {showAdapts ? '▴' : '▾'}
              </button>
              {showAdapts && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(90px, 1fr))', gap: '7px', marginTop: '4px' }}>
                  {adapts.map(a => (
                    <div key={a.id} style={{ border: `1px solid ${BORDER}`, borderRadius: '8px', overflow: 'hidden', background: 'rgba(255,255,255,0.02)' }}>
                      {a.image_url && <img src={a.image_url} alt="" style={{ width: '100%', height: '70px', objectFit: 'cover' }} />}
                      <div style={{ padding: '5px 6px' }}>
                        <div style={{ fontSize: '8.5px', color: MUTED, marginBottom: '4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.format}</div>
                        <div style={{ display: 'flex', gap: '4px' }}>
                          <button onClick={() => publish(a)} disabled={busy === a.id} title={tx.approvePub} style={{ flex: 1, padding: '3px', background: 'rgba(74,222,128,0.14)', border: '1px solid rgba(74,222,128,0.35)', borderRadius: '5px', color: GREEN, fontSize: '9px', fontWeight: 700, cursor: 'pointer', fontFamily: D }}>✓</button>
                          <button onClick={() => discard(a.id)} disabled={busy === a.id} title={tx.del} style={{ padding: '3px 6px', background: 'transparent', border: `1px solid ${BORDER}`, borderRadius: '5px', color: MUTED, fontSize: '9px', cursor: 'pointer', fontFamily: D }}>🗑</button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
    {adaptOpen && <AdaptModal post={item as unknown as VaultPost} companyId={companyId} onClose={() => setAdaptOpen(false)} onDone={() => { void load() }} />}
    </>
  )
}
