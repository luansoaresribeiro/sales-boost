import { useEffect, useState, useCallback } from 'react'
import { useRealtime } from '../../../lib/useRealtime'
import { supabase } from '../../../lib/supabase'
import { useAuth } from '../../../contexts/AuthContext'
import { CARD, MUTED, BORDER, D, timeAgo } from './shared'
import { callContentTest, ScoreBreakdown, BriefBlock, PostMedia, VideoScript, type TestPost } from './TestingArea'
import AdaptModal, { type VaultPost } from './AdaptModal'

const GREEN = '#4ade80'
const ORANGE = '#FF6D29'
const KIND_LABEL: Record<string, string> = { organico: 'Orgânico', stories: 'Stories', campanhas: 'Campanhas' }

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

  const load = useCallback(async () => {
    const [{ data }, { data: a }] = await Promise.all([
      supabase.from('marketing_ai_test_content').select('*').eq('company_id', companyId).eq('status', 'vault').order('quality_score', { ascending: false }),
      supabase.from('marketing_ai_test_content').select('*').eq('company_id', companyId).eq('status', 'adapt').order('created_at', { ascending: false }),
    ])
    setItems((data ?? []) as (TestPost & { kind: string })[])
    const map: Record<string, (TestPost & { kind: string; source_id: string })[]> = {}
    for (const row of (a ?? []) as (TestPost & { kind: string; source_id: string })[]) { if (row.source_id) (map[row.source_id] ||= []).push(row) }
    setAdapts(map)
    setLoading(false)
  }, [companyId])
  const toggleExpanded = (id: string) => setExpanded(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n })

  useEffect(() => { load() }, [load, reloadKey])
  useRealtime('marketing_ai_test_content', companyId, load)

  const publish = async (id: string) => {
    setBusyId(id); setError(''); setOkMsg('')
    try {
      await callContentTest(token, { action: 'approve', test_id: id })
      setOkMsg('Publicado na aba Posts (como aprovado) ✓')
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao publicar')
    }
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
        ⭐ <strong>Content Vault.</strong> Só o conteúdo que passou no controle de qualidade (nota ≥90). Daqui você publica pra aba Posts quando quiser — a criação e a publicação ficam separadas.
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
                    <span style={{ fontSize: '9.5px', color: 'rgba(255,255,255,0.3)', marginLeft: 'auto' }}>{timeAgo(t.created_at)}</span>
                  </div>
                  {t.idea && <div style={{ fontSize: '12.5px', fontWeight: 700, color: 'white' }}>{t.idea}</div>}
                  {t.caption && <div style={{ fontSize: '11.5px', color: MUTED, lineHeight: 1.5, maxHeight: '84px', overflow: 'auto' }}>{t.caption}</div>}
                  {t.hashtags && <div style={{ fontSize: '11px', color: '#60a5fa', lineHeight: 1.4 }}>{t.hashtags}</div>}

                  <BriefBlock post={t} />
                  <VideoScript post={t} />
                  <ScoreBreakdown post={t} />

                  <div style={{ display: 'flex', gap: '7px', marginTop: 'auto', paddingTop: '2px', flexWrap: 'wrap' }}>
                    <button onClick={() => publish(t.id)} disabled={busy}
                      style={{ flex: 1, padding: '8px', background: 'rgba(74,222,128,0.14)', border: '1px solid rgba(74,222,128,0.4)', borderRadius: '8px', color: GREEN, fontSize: '11.5px', fontWeight: 700, cursor: busy ? 'default' : 'pointer', fontFamily: D }}>
                      {busy ? '...' : '🚀 Publicar'}
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
                                  <button onClick={() => publish(a.id)} disabled={busyId === a.id} title="Aprovar/Publicar" style={{ flex: 1, padding: '3px', background: 'rgba(74,222,128,0.14)', border: '1px solid rgba(74,222,128,0.35)', borderRadius: '5px', color: GREEN, fontSize: '9px', fontWeight: 700, cursor: 'pointer', fontFamily: D }}>✓</button>
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
