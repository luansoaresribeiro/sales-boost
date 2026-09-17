import { useEffect, useState, useCallback } from 'react'
import { useRealtime } from '../../../lib/useRealtime'
import { supabase } from '../../../lib/supabase'
import { useAuth } from '../../../contexts/AuthContext'
import { CARD, MUTED, BORDER, D, timeAgo } from './shared'
import { ScoreBreakdown, BriefBlock, PostMedia, VideoScript, TEMPLATE_LABEL, type TestPost } from './TestingArea'
import AdaptModal, { type VaultPost } from './AdaptModal'
import { proposeAgentAction, unscheduleAgentAction } from '../../../lib/agentActions'

const GREEN = '#4ade80'
const ORANGE = '#FF6D29'
const KIND_LABEL: Record<string, string> = { organico: 'Orgânico', stories: 'Stories', campanhas: 'Campanhas' }
const fmtScheduled = (iso: string) => new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })

// Content Vault: só o conteúdo aprovado pelo controle de qualidade (nota ≥90),
// ordenado pela nota. É a "prateleira" de peças prontas — separada da criação.
// Daqui o dono publica (vira post 'aprovado' na aba Posts) ou descarta.
export default function ContentVault({ companyId, reloadKey }: { companyId: string; reloadKey?: number }) {
  const { session } = useAuth()
  const token = session?.access_token ?? ''
  const [items, setItems] = useState<(TestPost & { kind: string })[]>([])
  const [adapts, setAdapts] = useState<Record<string, (TestPost & { kind: string; source_id: string })[]>>({})
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [adaptFor, setAdaptFor] = useState<VaultPost | null>(null)
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [okMsg, setOkMsg] = useState('')
  // ref_id do post → agendamento pendente (id da ação + horário marcado).
  const [scheduled, setScheduled] = useState<Record<string, { actionId: string; at: string }>>({})
  const [schedulingFor, setSchedulingFor] = useState<string | null>(null)
  const [scheduleValue, setScheduleValue] = useState('')

  const load = useCallback(async () => {
    const [{ data }, { data: a }, { data: sch }] = await Promise.all([
      supabase.from('marketing_ai_test_content').select('*').eq('company_id', companyId).eq('status', 'vault').order('quality_score', { ascending: false }),
      supabase.from('marketing_ai_test_content').select('*').eq('company_id', companyId).eq('status', 'adapt').order('created_at', { ascending: false }),
      supabase.from('agent_actions').select('id, ref_id, scheduled_at').eq('company_id', companyId).eq('ref_type', 'marketing_ai_test_content').eq('execution_status', 'QUEUED').not('scheduled_at', 'is', null),
    ])
    setItems((data ?? []) as (TestPost & { kind: string })[])
    const map: Record<string, (TestPost & { kind: string; source_id: string })[]> = {}
    for (const row of (a ?? []) as (TestPost & { kind: string; source_id: string })[]) { if (row.source_id) (map[row.source_id] ||= []).push(row) }
    setAdapts(map)
    const schMap: Record<string, { actionId: string; at: string }> = {}
    for (const row of (sch ?? []) as { id: string; ref_id: string; scheduled_at: string }[]) schMap[row.ref_id] = { actionId: row.id, at: row.scheduled_at }
    setScheduled(schMap)
    setLoading(false)
  }, [companyId])
  const toggleExpanded = (id: string) => setExpanded(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n })

  useEffect(() => { load() }, [load, reloadKey])
  useRealtime('marketing_ai_test_content', companyId, load)

  // Propõe já aprovado (approve_now) — o clique em "Publicar" É a decisão do
  // dono. Passa pela Central de Approvals (agent_actions), que executa na
  // hora: publica de verdade no Instagram se conectado, senão salva como
  // aprovado pra publicar manualmente na aba Posts.
  const publish = async (item: TestPost & { kind: string }) => {
    setBusyId(item.id); setError(''); setOkMsg('')
    try {
      const action = await proposeAgentAction(token, {
        company_id: companyId,
        agent_key: 'content', agent_name: 'Vault',
        action_type: 'create_content', channel: 'instagram', source: 'vault',
        ref_type: 'marketing_ai_test_content', ref_id: item.id,
        title: item.idea ?? 'Post do Vault',
        agent_interpretation: `Aprovado pelo controle de qualidade (nota ${item.quality_score ?? '—'}), publicado direto do Vault.`,
        payload: { idea: item.idea, caption: item.caption, hashtags: item.hashtags, cta: item.cta, image_url: item.image_url },
        approve_now: true,
      })
      if (action.execution_status === 'EXECUTED' && (action.execution_result as { published_to_instagram?: boolean } | null)?.published_to_instagram) {
        setOkMsg('Publicado de verdade no Instagram ✓')
      } else if (action.execution_status === 'FAILED') {
        setError(action.execution_error ?? 'Post aprovado, mas não foi possível publicar no Instagram agora.')
      } else {
        setOkMsg('Aprovado — publique na aba Posts ✓')
      }
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao publicar')
    }
    setBusyId(null)
  }

  // Agenda: propõe já APROVADO (é a decisão do dono agora), mas com
  // scheduled_at no futuro — agent-actions guarda a fila e só EXECUTA
  // (publica de verdade) na hora certa, via cron. O post continua
  // aparecendo aqui até lá (com "Agendado pra..." no lugar dos botões).
  const schedule = async (item: TestPost & { kind: string }) => {
    if (!scheduleValue) return
    const iso = new Date(scheduleValue).toISOString()
    setBusyId(item.id); setError(''); setOkMsg('')
    try {
      await proposeAgentAction(token, {
        company_id: companyId,
        agent_key: 'content', agent_name: 'Vault',
        action_type: 'create_content', channel: 'instagram', source: 'vault',
        ref_type: 'marketing_ai_test_content', ref_id: item.id,
        title: item.idea ?? 'Post do Vault',
        agent_interpretation: `Aprovado pelo controle de qualidade (nota ${item.quality_score ?? '—'}), agendado pro Vault.`,
        payload: { idea: item.idea, caption: item.caption, hashtags: item.hashtags, cta: item.cta, image_url: item.image_url },
        scheduled_at: iso,
      })
      setOkMsg(`Agendado pra ${fmtScheduled(iso)} ✓`)
      setSchedulingFor(null); setScheduleValue('')
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao agendar')
    }
    setBusyId(null)
  }

  const cancelSchedule = async (postId: string) => {
    const s = scheduled[postId]
    if (!s) return
    setBusyId(postId); setError('')
    try { await unscheduleAgentAction(token, companyId, s.actionId) } catch (e) { setError(e instanceof Error ? e.message : 'Erro ao cancelar') }
    await load()
    setBusyId(null)
  }

  const backToTest = async (id: string) => {
    setBusyId(id); setError('')
    await supabase.from('marketing_ai_test_content').update({ status: 'draft' }).eq('id', id)
    await load()
    setBusyId(null)
  }

  const discard = async (id: string) => {
    setBusyId(id); setError('')
    await supabase.from('marketing_ai_test_content').delete().eq('id', id)
    await load()
    setBusyId(null)
  }

  return (
    <div>
      <div style={{ padding: '12px 16px', background: 'rgba(74,222,128,0.06)', border: '1px solid rgba(74,222,128,0.22)', borderRadius: '11px', fontSize: '11.5px', color: 'white', lineHeight: 1.6, marginBottom: '20px' }}>
        ⭐ <strong>Content Vault.</strong> Conteúdo avaliado pelo controle de qualidade. Publique na hora com <strong>🚀 Publicar</strong>, ou marque um horário futuro com <strong>📅 Agendar</strong> — publica sozinho quando chegar a hora. Sempre fica registrado na Central de Approvals.
      </div>

      {error && <div style={{ color: '#f87171', fontSize: '11.5px', marginBottom: '12px' }}>{error}</div>}
      {okMsg && <div style={{ color: GREEN, fontSize: '11.5px', marginBottom: '12px' }}>{okMsg}</div>}

      {loading ? (
        <div style={{ fontSize: '12px', color: MUTED }}>Carregando Vault...</div>
      ) : items.length === 0 ? (
        <div style={{ padding: '32px', textAlign: 'center', color: MUTED, fontSize: '12.5px', background: CARD, border: `1px dashed ${BORDER}`, borderRadius: '12px' }}>
          Vault vazio. Gere posts na Área de Testes (em Orgânico, Stories ou Campanhas) e envie os que passarem (≥90) pra cá.
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '12px' }}>
          {items.map(t => {
            const busy = busyId === t.id
            return (
              <div key={t.id} style={{ background: CARD, border: `1px solid rgba(74,222,128,0.25)`, borderRadius: '12px', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                <PostMedia post={t} height={160} />
                <div style={{ padding: '13px', display: 'flex', flexDirection: 'column', gap: '8px', flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                    <span style={{ fontSize: '9px', fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{KIND_LABEL[t.kind] ?? t.kind}</span>
                    {t.format && <span style={{ fontSize: '9.5px', color: MUTED }}>· {t.format}</span>}
                    {t.format === 'foto' && t.brief?.template && <span style={{ fontSize: '9.5px', color: '#A78BFA' }}>· {TEMPLATE_LABEL[t.brief.template] ?? t.brief.template}</span>}
                    <span style={{ fontSize: '9.5px', color: 'rgba(255,255,255,0.3)', marginLeft: 'auto' }}>{timeAgo(t.created_at)}</span>
                  </div>
                  {t.idea && <div style={{ fontSize: '12.5px', fontWeight: 700, color: 'white' }}>{t.idea}</div>}
                  {t.caption && <div style={{ fontSize: '11.5px', color: MUTED, lineHeight: 1.5, maxHeight: '84px', overflow: 'auto' }}>{t.caption}</div>}
                  {t.hashtags && <div style={{ fontSize: '11px', color: '#60a5fa', lineHeight: 1.4 }}>{t.hashtags}</div>}

                  <BriefBlock post={t} />
                  <VideoScript post={t} />
                  <ScoreBreakdown post={t} />

                  {scheduled[t.id] ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '7px', marginTop: 'auto', paddingTop: '2px', flexWrap: 'wrap' }}>
                      <div style={{ flex: 1, padding: '8px', background: 'rgba(96,165,250,0.12)', border: '1px solid rgba(96,165,250,0.35)', borderRadius: '8px', color: '#60a5fa', fontSize: '11px', fontWeight: 700, textAlign: 'center' }}>
                        🕐 Agendado pra {fmtScheduled(scheduled[t.id].at)}
                      </div>
                      <button onClick={() => cancelSchedule(t.id)} disabled={busy} title="Cancelar agendamento"
                        style={{ padding: '8px 10px', background: 'transparent', border: `1px solid ${BORDER}`, borderRadius: '8px', color: MUTED, fontSize: '11.5px', cursor: busy ? 'default' : 'pointer', fontFamily: D }}>
                        ✕
                      </button>
                    </div>
                  ) : schedulingFor === t.id ? (
                    <div style={{ display: 'flex', gap: '7px', marginTop: 'auto', paddingTop: '2px', flexWrap: 'wrap' }}>
                      <input type="datetime-local" value={scheduleValue} onChange={e => setScheduleValue(e.target.value)}
                        min={new Date(Date.now() + 5 * 60000).toISOString().slice(0, 16)}
                        style={{ flex: 1, minWidth: '150px', padding: '7px 8px', background: 'rgba(255,255,255,0.04)', border: `1px solid ${BORDER}`, borderRadius: '8px', color: 'white', fontSize: '11px', fontFamily: D, colorScheme: 'dark' }} />
                      <button onClick={() => schedule(t)} disabled={busy || !scheduleValue}
                        style={{ padding: '8px 12px', background: scheduleValue ? 'rgba(96,165,250,0.16)' : 'rgba(255,255,255,0.05)', border: `1px solid ${scheduleValue ? 'rgba(96,165,250,0.4)' : BORDER}`, borderRadius: '8px', color: scheduleValue ? '#60a5fa' : MUTED, fontSize: '11.5px', fontWeight: 700, cursor: busy || !scheduleValue ? 'default' : 'pointer', fontFamily: D }}>
                        {busy ? '...' : 'Confirmar'}
                      </button>
                      <button onClick={() => { setSchedulingFor(null); setScheduleValue('') }}
                        style={{ padding: '8px 10px', background: 'transparent', border: `1px solid ${BORDER}`, borderRadius: '8px', color: MUTED, fontSize: '11.5px', cursor: 'pointer', fontFamily: D }}>
                        ✕
                      </button>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', gap: '7px', marginTop: 'auto', paddingTop: '2px', flexWrap: 'wrap' }}>
                      <button onClick={() => publish(t)} disabled={busy}
                        style={{ flex: 1, padding: '8px', background: 'rgba(74,222,128,0.14)', border: '1px solid rgba(74,222,128,0.4)', borderRadius: '8px', color: GREEN, fontSize: '11.5px', fontWeight: 700, cursor: busy ? 'default' : 'pointer', fontFamily: D }}>
                        {busy ? '...' : '🚀 Publicar'}
                      </button>
                      <button onClick={() => { setSchedulingFor(t.id); setScheduleValue('') }} disabled={busy} title="Agendar pra depois"
                        style={{ padding: '8px 10px', background: 'transparent', border: '1px solid rgba(96,165,250,0.35)', borderRadius: '8px', color: '#60a5fa', fontSize: '11.5px', cursor: busy ? 'default' : 'pointer', fontFamily: D }}>
                        📅
                      </button>
                      <button onClick={() => backToTest(t.id)} disabled={busy} title="Voltar pra Área de Testes"
                        style={{ padding: '8px 10px', background: 'transparent', border: `1px solid ${BORDER}`, borderRadius: '8px', color: MUTED, fontSize: '11.5px', cursor: busy ? 'default' : 'pointer', fontFamily: D }}>
                        ↩︎
                      </button>
                      <button onClick={() => discard(t.id)} disabled={busy}
                        style={{ padding: '8px 10px', background: 'transparent', border: `1px solid ${BORDER}`, borderRadius: '8px', color: MUTED, fontSize: '11.5px', cursor: busy ? 'default' : 'pointer', fontFamily: D }}>
                        🗑
                      </button>
                    </div>
                  )}

                  <button onClick={() => setAdaptFor(t as unknown as VaultPost)}
                    style={{ padding: '8px', background: 'rgba(255,109,41,0.1)', border: '1px solid rgba(255,109,41,0.35)', borderRadius: '8px', color: ORANGE, fontSize: '11.5px', fontWeight: 700, cursor: 'pointer', fontFamily: D }}>
                    ✨ Adaptar Conteúdo
                  </button>

                  {adapts[t.id]?.length ? (
                    <div style={{ marginTop: '2px' }}>
                      <button onClick={() => toggleExpanded(t.id)} style={{ width: '100%', textAlign: 'left', background: 'transparent', border: 'none', color: MUTED, fontSize: '11px', fontWeight: 700, cursor: 'pointer', fontFamily: D, padding: '4px 0' }}>
                        Adaptações ({adapts[t.id].length}) {expanded.has(t.id) ? '▴' : '▾'}
                      </button>
                      {expanded.has(t.id) && (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(84px, 1fr))', gap: '7px', marginTop: '4px' }}>
                          {adapts[t.id].map(a => (
                            <div key={a.id} style={{ border: `1px solid ${BORDER}`, borderRadius: '8px', overflow: 'hidden', background: 'rgba(255,255,255,0.02)' }}>
                              {a.image_url && <img src={a.image_url} alt="" style={{ width: '100%', height: '70px', objectFit: 'cover' }} />}
                              <div style={{ padding: '5px 6px' }}>
                                <div style={{ fontSize: '8.5px', color: MUTED, marginBottom: '4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.format}</div>
                                <div style={{ display: 'flex', gap: '4px' }}>
                                  <button onClick={() => publish(a)} disabled={busyId === a.id} title="Aprovar/Publicar" style={{ flex: 1, padding: '3px', background: 'rgba(74,222,128,0.14)', border: '1px solid rgba(74,222,128,0.35)', borderRadius: '5px', color: GREEN, fontSize: '9px', fontWeight: 700, cursor: 'pointer', fontFamily: D }}>✓</button>
                                  <button onClick={() => discard(a.id)} disabled={busyId === a.id} title="Excluir" style={{ padding: '3px 6px', background: 'transparent', border: `1px solid ${BORDER}`, borderRadius: '5px', color: MUTED, fontSize: '9px', cursor: 'pointer', fontFamily: D }}>🗑</button>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ) : null}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {adaptFor && <AdaptModal post={adaptFor} companyId={companyId} onClose={() => setAdaptFor(null)} onDone={() => { load() }} />}
    </div>
  )
}
