import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import { useRealtime } from '../../lib/useRealtime'
import { useNavigate } from 'react-router-dom'
import { useCompany, type CompanyData } from '../../contexts/CompanyContext'
import { useLang } from '../../contexts/LanguageContext'
import { d } from '../../i18n-dash'

const ORANGE = '#FF6D29'
const CARD = '#150E08'
const MUTED = '#BABABA'
const D = "'Bricolage Grotesque', system-ui, sans-serif"
const BORDER = 'rgba(255,255,255,0.06)'
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string

export interface Opportunity {
  id: string
  type: string
  title: string
  description: string | null
  estimated_impact: string | null
  status: string
  ref_id: string | null
  ref_type: string | null
  ai_draft: string | null
  created_at: string
}

const CHANNELS: Array<{ key: string; icon: string; check: (c: CompanyData) => boolean; href: string }> = [
  { key: 'google',    icon: '⭐', check: c => !!c.google_place_id, href: '/dashboard/settings?section=google' },
  { key: 'instagram', icon: '📸', check: c => !!c.instagram_url,   href: '/dashboard/settings?section=presenca' },
  { key: 'whatsapp',  icon: '💬', check: c => !!c.phone,            href: '/dashboard/settings?section=negocio' },
  { key: 'facebook',  icon: '👍', check: c => !!c.facebook_url,     href: '/dashboard/settings?section=presenca' },
]

const TYPE_COLORS: Record<string, { color: string; bg: string; icon: string }> = {
  negative_review:   { color: '#f87171', bg: 'rgba(248,113,113,0.1)',  icon: '⭐' },
  unanswered_review: { color: '#FBBF24', bg: 'rgba(251,191,36,0.1)',  icon: '💬' },
  stale_draft:       { color: '#A78BFA', bg: 'rgba(167,139,250,0.1)', icon: '📝' },
  no_content:        { color: MUTED,     bg: 'rgba(255,255,255,0.05)', icon: '📅' },
  low_engagement:    { color: '#60a5fa', bg: 'rgba(96,165,250,0.1)',  icon: '📉' },
}

export function OppCard({
  opp, session, onResolve, onDismiss, T,
}: {
  opp: Opportunity; session: { access_token: string } | null
  onResolve: (id: string) => void; onDismiss: (id: string) => void
  T: typeof d['pt']['opportunities']
}) {
  const navigate = useNavigate()
  const [expanded, setExpanded] = useState(false)
  const [draft, setDraft] = useState(opp.ai_draft ?? '')
  const [loadingDraft, setLoadingDraft] = useState(false)
  const [copied, setCopied] = useState(false)
  const [resolving, setResolving] = useState(false)
  const [resolveError, setResolveError] = useState('')

  const typeMeta = TYPE_COLORS[opp.type] ?? TYPE_COLORS.no_content
  const meta = { ...typeMeta, label: T.typeLabels[opp.type as keyof typeof T.typeLabels] ?? opp.type }

  const fetchDraft = async () => {
    if (draft || !session) return
    setLoadingDraft(true)
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/draft-reply`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ opportunity_id: opp.id }),
      })
      const data = await res.json()
      if (data.draft) setDraft(data.draft)
    } catch { /* ignore */ }
    setLoadingDraft(false)
  }

  const handleExpand = () => {
    if (!expanded && opp.ref_type === 'review') fetchDraft()
    if (!expanded && opp.type === 'low_engagement') fetchDraft()
    setExpanded(e => !e)
  }

  const handleCopy = async () => {
    if (!draft) return
    await navigator.clipboard.writeText(draft)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const isReviewWithDraft = opp.ref_type === 'review' && !!opp.ref_id && !!draft.trim()

  const handleResolve = async () => {
    setResolving(true)
    setResolveError('')

    if (isReviewWithDraft) {
      try {
        const res = await fetch(`${SUPABASE_URL}/functions/v1/reply-google-review`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${session?.access_token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ review_id: opp.ref_id, reply_text: draft }),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error ?? 'Erro ao publicar no Google')
      } catch (e: unknown) {
        setResolveError(e instanceof Error ? e.message : String(e))
        setResolving(false)
        return
      }
    }

    await supabase.from('opportunities').update({
      status: 'resolved',
      resolved_at: new Date().toISOString(),
    }).eq('id', opp.id)

    onResolve(opp.id)
    setResolving(false)
  }

  const handleDismiss = async () => {
    await supabase.from('opportunities').update({ status: 'dismissed' }).eq('id', opp.id)
    onDismiss(opp.id)
  }

  const isReviewType = opp.ref_type === 'review'
  const isPostType = opp.ref_type === 'post' || opp.type === 'no_content'

  return (
    <div style={{
      background: CARD, border: `1px solid ${BORDER}`, borderRadius: '14px',
      overflow: 'hidden', transition: 'border-color 0.2s',
    }}
      onMouseEnter={e => (e.currentTarget.style.borderColor = 'rgba(255,109,41,0.15)')}
      onMouseLeave={e => (e.currentTarget.style.borderColor = BORDER)}
    >
      {/* Header */}
      <div style={{ padding: '16px 20px', display: 'flex', gap: '14px', alignItems: 'flex-start' }}>
        <div style={{
          width: '38px', height: '38px', borderRadius: '10px', flexShrink: 0,
          background: meta.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px',
        }}>
          {meta.icon}
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px', flexWrap: 'wrap' }}>
            <span style={{
              fontSize: '10px', fontWeight: 700, padding: '2px 8px', borderRadius: '99px',
              background: meta.bg, color: meta.color, textTransform: 'uppercase', letterSpacing: '0.06em',
            }}>
              {meta.label}
            </span>
          </div>
          <div style={{ fontSize: '14px', fontWeight: 600, color: 'white', marginBottom: '4px' }}>{opp.title}</div>
          {opp.description && (
            <div style={{ fontSize: '13px', color: MUTED, lineHeight: 1.5, fontStyle: 'italic' }}>{opp.description}</div>
          )}
          {opp.estimated_impact && (
            <div style={{ fontSize: '12px', color: ORANGE, marginTop: '6px' }}>
              💡 {opp.estimated_impact}
            </div>
          )}
        </div>
      </div>

      {/* Expanded draft area */}
      {expanded && (isReviewType || opp.type === 'low_engagement') && (
        <div style={{ padding: '0 20px 16px' }}>
          <div style={{ background: 'rgba(255,255,255,0.03)', border: `1px solid ${BORDER}`, borderRadius: '10px', padding: '14px' }}>
            <div style={{ fontSize: '10px', fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '8px' }}>
              {loadingDraft ? T.generatingSuggestion : T.aiSuggestion}
            </div>
            {loadingDraft ? (
              <div style={{ display: 'flex', gap: '5px', padding: '8px 0' }}>
                {[0, 1, 2].map(i => (
                  <div key={i} style={{
                    width: '6px', height: '6px', borderRadius: '50%', background: ORANGE,
                    animation: `bounce 1.2s ease-in-out ${i * 0.2}s infinite`,
                  }} />
                ))}
              </div>
            ) : (
              <textarea
                value={draft}
                onChange={e => setDraft(e.target.value)}
                rows={5}
                style={{
                  width: '100%', background: 'transparent', border: 'none', outline: 'none',
                  color: 'white', fontSize: '13px', lineHeight: 1.7, resize: 'vertical',
                  fontFamily: 'inherit', boxSizing: 'border-box',
                }}
              />
            )}
          </div>
        </div>
      )}

      {/* Actions */}
      <div style={{ padding: '12px 20px', borderTop: `1px solid ${BORDER}`, display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        {isReviewType && (
          <button onClick={handleExpand}
            style={{ padding: '7px 14px', fontSize: '12px', fontWeight: 600, borderRadius: '8px', cursor: 'pointer', background: expanded ? 'rgba(255,109,41,0.1)' : 'rgba(255,255,255,0.04)', color: expanded ? ORANGE : MUTED, border: `1px solid ${expanded ? 'rgba(255,109,41,0.25)' : BORDER}` }}>
            {expanded ? T.close : T.seeReply}
          </button>
        )}

        {opp.type === 'low_engagement' && (
          <button onClick={handleExpand}
            style={{ padding: '7px 14px', fontSize: '12px', fontWeight: 600, borderRadius: '8px', cursor: 'pointer', background: expanded ? 'rgba(255,109,41,0.1)' : 'rgba(255,255,255,0.04)', color: expanded ? ORANGE : MUTED, border: `1px solid ${expanded ? 'rgba(255,109,41,0.25)' : BORDER}` }}>
            {expanded ? T.close : T.seeSuggestions}
          </button>
        )}

        {expanded && draft && !loadingDraft && (
          <button onClick={handleCopy}
            style={{ padding: '7px 14px', fontSize: '12px', fontWeight: 600, borderRadius: '8px', cursor: 'pointer', background: copied ? 'rgba(74,222,128,0.1)' : 'rgba(255,255,255,0.04)', color: copied ? '#4ade80' : MUTED, border: `1px solid ${copied ? 'rgba(74,222,128,0.25)' : BORDER}`, transition: 'all 0.2s' }}>
            {copied ? T.copied : T.copy}
          </button>
        )}

        {isPostType && (
          <button onClick={() => navigate('/dashboard/posts')}
            style={{ padding: '7px 14px', fontSize: '12px', fontWeight: 600, borderRadius: '8px', cursor: 'pointer', background: 'rgba(255,109,41,0.1)', color: ORANGE, border: '1px solid rgba(255,109,41,0.25)' }}>
            {T.seePosts}
          </button>
        )}

        {opp.type === 'no_content' && (
          <button onClick={() => navigate('/dashboard/agente')}
            style={{ padding: '7px 14px', fontSize: '12px', fontWeight: 600, borderRadius: '8px', cursor: 'pointer', background: 'rgba(255,109,41,0.1)', color: ORANGE, border: '1px solid rgba(255,109,41,0.25)' }}>
            {T.askAgent}
          </button>
        )}

        <button onClick={handleResolve} disabled={resolving}
          style={{ padding: '7px 14px', fontSize: '12px', fontWeight: 700, borderRadius: '8px', cursor: resolving ? 'not-allowed' : 'pointer', background: 'rgba(74,222,128,0.1)', color: '#4ade80', border: '1px solid rgba(74,222,128,0.25)', opacity: resolving ? 0.6 : 1 }}>
          {resolving
            ? (isReviewWithDraft ? T.resolvePublishing : T.resolving)
            : (isReviewWithDraft ? T.resolvePublish : T.resolve)}
        </button>

        <button onClick={handleDismiss}
          style={{ padding: '7px 14px', fontSize: '12px', fontWeight: 600, borderRadius: '8px', cursor: 'pointer', background: 'transparent', color: 'rgba(255,255,255,0.2)', border: `1px solid ${BORDER}` }}>
          {T.dismiss}
        </button>

        {resolveError && (
          <div style={{ width: '100%', fontSize: '12px', color: '#f87171', marginTop: '4px' }}>{resolveError}</div>
        )}
      </div>
    </div>
  )
}

export default function OpportunitiesPage() {
  const { session } = useAuth()
  const { company } = useCompany()
  const navigate = useNavigate()
  const { lang } = useLang()
  const T = d[lang].opportunities
  const CH = d[lang].channels
  const [opportunities, setOpportunities] = useState<Opportunity[]>([])
  const [loading, setLoading] = useState(true)
  const [scanning, setScanning] = useState(false)
  const [lastScan, setLastScan] = useState<Date | null>(null)
  const [activeTab, setActiveTab] = useState('oportunidades')

  useEffect(() => { scan() }, [])

  // Ultra-sync: refetch leve (sem re-escanear) quando as oportunidades mudarem.
  const refetchOpps = useCallback(async () => {
    if (!company?.id) return
    const { data } = await supabase.from('opportunities').select('*').eq('company_id', company.id).eq('status', 'open').order('created_at', { ascending: false })
    if (data) setOpportunities(data as Opportunity[])
  }, [company?.id])
  useRealtime('opportunities', company?.id, refetchOpps)

  const scan = async () => {
    if (!session) return
    setScanning(true)
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/detect-opportunities`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      const data = await res.json()
      if (data.opportunities) {
        setOpportunities(data.opportunities)
        setLastScan(new Date())
      }
    } catch { /* ignore */ }
    setLoading(false)
    setScanning(false)
  }

  const handleResolve = (id: string) => setOpportunities(prev => prev.filter(o => o.id !== id))
  const handleDismiss = (id: string) => setOpportunities(prev => prev.filter(o => o.id !== id))

  const resolveAll = async () => {
    if (!opportunities.length) return
    setScanning(true)
    await Promise.all(
      opportunities.map(o =>
        supabase.from('opportunities').update({ status: 'resolved', resolved_at: new Date().toISOString() }).eq('id', o.id)
      )
    )
    setOpportunities([])
    setScanning(false)
  }

  const negativeCount = opportunities.filter(o => o.type === 'negative_review').length
  const unansweredCount = opportunities.filter(o => o.type === 'unanswered_review').length

  return (
    <div>
      <div style={{ padding: '28px 32px 24px', borderBottom: `1px solid ${BORDER}` }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px' }}>
          <div>
            <h1 style={{ fontFamily: D, fontSize: '1.5rem', fontWeight: 800, color: 'white', letterSpacing: '-0.02em', marginBottom: '4px' }}>{T.title}</h1>
            <p style={{ color: MUTED, fontSize: '13px' }}>
              {activeTab === 'oportunidades'
                ? (loading ? T.scanning :
                  (company && !company.google_place_id && !company.instagram_url) ? T.noChannels :
                  opportunities.length === 0
                  ? T.noOpps
                  : `${opportunities.length} ${T.detected} · ${lastScan ? `${T.updated} ${lastScan.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}` : ''}`)
                : T.pipeline}
            </p>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            {opportunities.length > 0 && (
              <button onClick={resolveAll} disabled={scanning}
                style={{ padding: '9px 18px', background: 'rgba(74,222,128,0.1)', color: '#4ade80', fontWeight: 700, fontSize: '13px', borderRadius: '10px', border: '1px solid rgba(74,222,128,0.25)', cursor: scanning ? 'not-allowed' : 'pointer' }}>
                {T.resolveAll}
              </button>
            )}
            <button onClick={scan} disabled={scanning}
              style={{ padding: '9px 18px', background: scanning ? 'rgba(255,109,41,0.3)' : ORANGE, color: '#000', fontWeight: 700, fontSize: '13px', borderRadius: '10px', border: 'none', cursor: scanning ? 'not-allowed' : 'pointer' }}>
              {scanning ? T.scanning : T.scanNow}
            </button>
          </div>
        </div>

        {!loading && opportunities.length > 0 && (
          <div style={{ display: 'flex', gap: '8px', marginTop: '16px', flexWrap: 'wrap' }}>
            {negativeCount > 0 && (
              <div style={{ padding: '5px 12px', borderRadius: '99px', background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.2)', fontSize: '12px', color: '#f87171', fontWeight: 600 }}>
                {negativeCount} {T.negReviews}
              </div>
            )}
            {unansweredCount > 0 && (
              <div style={{ padding: '5px 12px', borderRadius: '99px', background: 'rgba(251,191,36,0.1)', border: '1px solid rgba(251,191,36,0.2)', fontSize: '12px', color: '#FBBF24', fontWeight: 600 }}>
                {unansweredCount} {T.unanswered}
              </div>
            )}
          </div>
        )}
      </div>

      <div style={{ borderBottom: `1px solid ${BORDER}`, padding: '0 32px' }}>
        <div style={{ display: 'flex' }}>
          {T.tabs.map((label, i) => {
            const id = T.tabIds[i]
            return (
              <button key={id} onClick={() => setActiveTab(id)} style={{ padding: '13px 18px', background: 'transparent', border: 'none', borderBottom: activeTab === id ? `2px solid ${ORANGE}` : '2px solid transparent', color: activeTab === id ? 'white' : MUTED, fontSize: '13.5px', fontWeight: activeTab === id ? 600 : 400, cursor: 'pointer', fontFamily: D, transition: 'all 0.15s', marginBottom: '-1px' }}>{label}</button>
            )
          })}
        </div>
      </div>

      {activeTab === 'oportunidades' && <div style={{ padding: '24px 32px' }}>
        {company && !company.google_place_id && !company.instagram_url ? (
          <div style={{ background: 'rgba(255,109,41,0.06)', border: '1px solid rgba(255,109,41,0.2)', borderRadius: '14px', padding: '48px 32px', textAlign: 'center' }}>
            <div style={{ fontSize: '2.5rem', marginBottom: '14px' }}>🔗</div>
            <div style={{ fontFamily: D, fontSize: '1.2rem', fontWeight: 800, color: 'white', marginBottom: '10px' }}>{T.noChannels}</div>
            <div style={{ fontSize: '14px', color: MUTED, maxWidth: '420px', margin: '0 auto 24px', lineHeight: 1.7 }}>{T.noChannelsDesc}</div>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
              <button onClick={() => navigate('/dashboard/settings?section=google')}
                style={{ padding: '10px 22px', background: ORANGE, color: '#000', fontWeight: 700, fontSize: '13px', borderRadius: '9px', border: 'none', cursor: 'pointer' }}>
                {T.linkGoogle}
              </button>
              <button onClick={() => setActiveTab('canais')}
                style={{ padding: '10px 22px', background: 'rgba(255,255,255,0.05)', color: MUTED, fontWeight: 600, fontSize: '13px', borderRadius: '9px', border: `1px solid ${BORDER}`, cursor: 'pointer' }}>
                {T.seePending}
              </button>
            </div>
          </div>
        ) : loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {[1, 2, 3].map(i => (
              <div key={i} style={{ height: '100px', background: CARD, borderRadius: '14px', border: `1px solid ${BORDER}`, opacity: 0.5, animation: 'pulse 1.5s ease-in-out infinite' }} />
            ))}
          </div>
        ) : opportunities.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '80px 0' }}>
            <div style={{ fontSize: '3rem', marginBottom: '16px' }}>🎉</div>
            <div style={{ fontFamily: D, fontSize: '1.3rem', fontWeight: 800, color: 'white', marginBottom: '8px' }}>{T.allResolved}</div>
            <div style={{ color: MUTED, fontSize: '13px', maxWidth: '360px', margin: '0 auto', lineHeight: 1.7 }}>{T.allResolvedDesc}</div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {opportunities.map(opp => (
              <OppCard
                key={opp.id}
                opp={opp}
                session={session}
                onResolve={handleResolve}
                onDismiss={handleDismiss}
                T={T}
              />
            ))}
          </div>
        )}
      </div>}

      {activeTab === 'canais' && (
        <div style={{ padding: '24px 32px' }}>
          <p style={{ fontSize: '13px', color: MUTED, marginBottom: '20px', lineHeight: 1.6 }}>{T.channelsDesc}</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {CHANNELS.map(ch => {
              const ok = company ? ch.check(company) : false
              const chT = CH[ch.key as keyof typeof CH]
              return (
                <div key={ch.key} style={{ background: CARD, border: `1px solid ${ok ? 'rgba(74,222,128,0.2)' : 'rgba(255,109,41,0.2)'}`, borderRadius: '14px', padding: '16px 20px', display: 'flex', alignItems: 'center', gap: '16px' }}>
                  <div style={{ width: '42px', height: '42px', borderRadius: '10px', background: ok ? 'rgba(74,222,128,0.08)' : 'rgba(255,109,41,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px', flexShrink: 0 }}>
                    {ch.icon}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '14px', fontWeight: 600, color: 'white', marginBottom: '2px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      {chT.name}
                      <span style={{ fontSize: '10px', fontWeight: 700, padding: '2px 8px', borderRadius: '99px', background: ok ? 'rgba(74,222,128,0.1)' : 'rgba(255,109,41,0.1)', color: ok ? '#4ade80' : ORANGE }}>
                        {ok ? T.configured : T.pending}
                      </span>
                    </div>
                    <div style={{ fontSize: '12px', color: MUTED }}>{chT.desc}</div>
                  </div>
                  {!ok && (
                    <button onClick={() => navigate(ch.href)}
                      style={{ padding: '8px 16px', background: ORANGE, color: '#000', fontWeight: 700, fontSize: '12px', borderRadius: '8px', border: 'none', cursor: 'pointer', flexShrink: 0 }}>
                      {chT.btn} →
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {activeTab === 'leads' && (
        <div style={{ padding: '24px 32px' }}>
          <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: '16px', padding: '60px', textAlign: 'center' }}>
            <div style={{ fontFamily: D, fontSize: '1.2rem', fontWeight: 700, color: 'white', marginBottom: '8px' }}>{T.leadsTitle}</div>
            <p style={{ color: MUTED, fontSize: '13px', maxWidth: '400px', margin: '0 auto 20px', lineHeight: 1.7 }}>{T.leadsDesc}</p>
            <span style={{ display: 'inline-block', padding: '5px 14px', borderRadius: '99px', background: 'rgba(255,109,41,0.1)', border: '1px solid rgba(255,109,41,0.25)', color: ORANGE, fontSize: '11px', fontWeight: 700, letterSpacing: '0.05em' }}>{d[lang].common.soon}</span>
          </div>
        </div>
      )}
      {activeTab === 'conversao' && (
        <div style={{ padding: '24px 32px' }}>
          <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: '16px', padding: '60px', textAlign: 'center' }}>
            <div style={{ fontFamily: D, fontSize: '1.2rem', fontWeight: 700, color: 'white', marginBottom: '8px' }}>{T.convTitle}</div>
            <p style={{ color: MUTED, fontSize: '13px', maxWidth: '400px', margin: '0 auto 20px', lineHeight: 1.7 }}>{T.convDesc}</p>
            <span style={{ display: 'inline-block', padding: '5px 14px', borderRadius: '99px', background: 'rgba(255,109,41,0.1)', border: '1px solid rgba(255,109,41,0.25)', color: ORANGE, fontSize: '11px', fontWeight: 700, letterSpacing: '0.05em' }}>{d[lang].common.soon}</span>
          </div>
        </div>
      )}
      {activeTab === 'followups' && (
        <div style={{ padding: '24px 32px' }}>
          <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: '16px', padding: '60px', textAlign: 'center' }}>
            <div style={{ fontFamily: D, fontSize: '1.2rem', fontWeight: 700, color: 'white', marginBottom: '8px' }}>{T.followTitle}</div>
            <p style={{ color: MUTED, fontSize: '13px', maxWidth: '400px', margin: '0 auto 20px', lineHeight: 1.7 }}>{T.followDesc}</p>
            <span style={{ display: 'inline-block', padding: '5px 14px', borderRadius: '99px', background: 'rgba(255,109,41,0.1)', border: '1px solid rgba(255,109,41,0.25)', color: ORANGE, fontSize: '11px', fontWeight: 700, letterSpacing: '0.05em' }}>{d[lang].common.soon}</span>
          </div>
        </div>
      )}

      <style>{`
        @keyframes bounce { 0%, 100% { transform: translateY(0); opacity: 0.4; } 50% { transform: translateY(-4px); opacity: 1; } }
        @keyframes pulse { 0%, 100% { opacity: 0.5; } 50% { opacity: 0.3; } }
      `}</style>
    </div>
  )
}
