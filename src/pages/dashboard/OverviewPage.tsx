import { useEffect, useState } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import { useNavigate } from 'react-router-dom'
import { useLang } from '../../contexts/LanguageContext'
import { d } from '../../i18n-dash'

const ORANGE = '#FF6D29'
const CARD = '#150E08'
const MUTED = '#BABABA'
const D = "'Bricolage Grotesque', system-ui, sans-serif"
const BORDER = 'rgba(255,255,255,0.06)'

interface Company {
  id: string
  business_name: string
  business_type: string | null
  website_url: string | null
  plan: string | null
  google_rating: number | null
  google_review_count: number | null
  google_place_id: string | null
}

interface Diagnostic {
  id: string
  status: string | null
  created_at: string | null
  pagespeed_mobile: Record<string, number> | null
  pagespeed_desktop: Record<string, number> | null
}

interface ReviewStats {
  total: number
  positive: number
  negative: number
  unanalyzed: number
}

interface Opportunity {
  id: string
  type: string
  title: string
  estimated_impact: string | null
  estimated_value: number | null
  created_at: string
}

const TYPE_ICON: Record<string, string> = {
  negative_review: '⭐',
  unanswered_review: '💬',
  stale_draft: '📝',
  no_content: '📅',
  low_engagement: '📉',
}

function scoreColor(s: number) {
  return s >= 75 ? '#4ade80' : s >= 50 ? '#FBBF24' : '#f87171'
}

function ScoreBar({ value, max = 100, color }: { value: number; max?: number; color: string }) {
  return (
    <div style={{ height: '4px', borderRadius: '99px', background: 'rgba(255,255,255,0.06)', overflow: 'hidden', marginTop: '8px' }}>
      <div style={{ width: `${Math.min(100, (value / max) * 100)}%`, height: '100%', background: color, borderRadius: '99px', transition: 'width 0.6s ease' }} />
    </div>
  )
}

function HealthRow({ label, value, color, sub }: { label: string; value: string | number; color: string; sub?: string }) {
  const num = typeof value === 'number' ? value : parseFloat(String(value))
  return (
    <div style={{ display: 'flex', alignItems: 'center', padding: '14px 0', borderBottom: `1px solid ${BORDER}`, gap: '16px' }}>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: '13px', color: 'white', fontWeight: 500 }}>{label}</div>
        {sub && <div style={{ fontSize: '11px', color: MUTED, marginTop: '2px' }}>{sub}</div>}
      </div>
      <div style={{ fontFamily: D, fontSize: '1.6rem', fontWeight: 900, color, lineHeight: 1, minWidth: '60px', textAlign: 'right' }}>
        {value}
      </div>
      {!isNaN(num) && num <= 100 && (
        <div style={{ width: '80px' }}>
          <ScoreBar value={num} color={color} />
        </div>
      )}
    </div>
  )
}

export default function OverviewPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const { lang } = useLang()
  const T = d[lang].overview
  const [company, setCompany] = useState<Company | null>(null)
  const [diag, setDiag] = useState<Diagnostic | null>(null)
  const [reviewStats, setReviewStats] = useState<ReviewStats | null>(null)
  const [opportunities, setOpportunities] = useState<Opportunity[]>([])
  const [loading, setLoading] = useState(true)
  const [noCompany, setNoCompany] = useState(false)

  const userName = user?.email?.split('@')[0] ?? T.user

  useEffect(() => {
    if (!user) return
    loadAll()
  }, [user])

  const loadAll = async () => {
    setLoading(true)
    const { data: co } = await supabase
      .from('companies')
      .select('id, business_name, business_type, website_url, plan, google_rating, google_review_count, google_place_id')
      .eq('user_id', user!.id)
      .maybeSingle()

    if (!co) { setNoCompany(true); setLoading(false); return }
    setCompany(co as Company)

    const [diagRes, reviewsRes, oppsRes] = await Promise.all([
      supabase.from('diagnostics')
        .select('id, status, created_at, pagespeed_mobile, pagespeed_desktop')
        .eq('company_id', co.id)
        .eq('status', 'complete')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase.from('reviews')
        .select('id, sentiment')
        .eq('company_id', co.id),
      supabase.from('opportunities')
        .select('id, type, title, estimated_impact, estimated_value, created_at')
        .eq('company_id', co.id)
        .eq('status', 'open')
        .order('created_at', { ascending: false }),
    ])

    setDiag(diagRes.data ?? null)

    const revs = reviewsRes.data ?? []
    setReviewStats({
      total: revs.length,
      positive: revs.filter(r => r.sentiment === 'positive').length,
      negative: revs.filter(r => r.sentiment === 'negative').length,
      unanalyzed: revs.filter(r => !r.sentiment).length,
    })

    setOpportunities((oppsRes.data ?? []) as Opportunity[])

    setLoading(false)
  }

  if (loading) return <div style={{ padding: '28px 32px', color: MUTED, fontSize: '14px' }}>{d[lang].common.loading}</div>

  if (noCompany) return (
    <div>
      <div style={{ padding: '28px 32px 24px', borderBottom: `1px solid ${BORDER}` }}>
        <h1 style={{ fontFamily: D, fontSize: '1.5rem', fontWeight: 800, color: 'white', letterSpacing: '-0.02em', marginBottom: '4px' }}>{T.title}</h1>
        <p style={{ color: MUTED, fontSize: '13px' }}>{T.welcome}, {userName}</p>
      </div>
      <div style={{ padding: '28px 32px' }}>
        <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: '14px', padding: '48px 32px', textAlign: 'center' }}>
          <div style={{ fontSize: '2.5rem', marginBottom: '12px' }}>🚀</div>
          <div style={{ fontFamily: D, fontSize: '1.2rem', fontWeight: 800, color: 'white', marginBottom: '8px' }}>{T.startDiag}</div>
          <div style={{ fontSize: '14px', color: MUTED, maxWidth: '380px', margin: '0 auto 24px', lineHeight: 1.6 }}>
            {T.startDiagDesc}
          </div>
          <button onClick={() => navigate('/onboarding')}
            style={{ padding: '11px 24px', background: ORANGE, color: '#000', fontWeight: 700, fontSize: '14px', borderRadius: '10px', border: 'none', cursor: 'pointer' }}>
            {T.startDiagBtn}
          </button>
        </div>
      </div>
    </div>
  )

  if (!company) return null

  const mob = diag?.pagespeed_mobile
  const desk = diag?.pagespeed_desktop
  const locale = lang === 'en' ? 'en-US' : 'pt-BR'
  const diagDate = diag?.created_at ? new Date(diag.created_at).toLocaleDateString(locale) : null

  // Compute health score 0–100
  const scores: number[] = []
  if (mob?.performance != null) scores.push(mob.performance as number)
  if (mob?.seo != null) scores.push(mob.seo as number)
  if (company?.google_rating) scores.push((company.google_rating / 5) * 100)
  if (reviewStats && reviewStats.total > 0) {
    const sentScore = Math.round(((reviewStats.positive / reviewStats.total) * 100))
    scores.push(sentScore)
  }
  const healthScore = scores.length ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null
  const healthColor = healthScore != null ? scoreColor(healthScore) : MUTED

  const totalOppValue = opportunities.reduce((sum, o) => sum + (o.estimated_value ?? 0), 0)
  const hasAnyValue = opportunities.some(o => o.estimated_value != null)

  return (
    <div>
      <div style={{ padding: '28px 32px 24px', borderBottom: `1px solid ${BORDER}` }}>
        <h1 style={{ fontFamily: D, fontSize: '1.5rem', fontWeight: 800, color: 'white', letterSpacing: '-0.02em', marginBottom: '4px' }}>{T.title}</h1>
        <p style={{ color: MUTED, fontSize: '13px' }}>{company.business_name} · {userName}</p>
      </div>

      <div style={{ padding: '28px 32px' }}>

        {/* Revenue Opportunities */}
        <div style={{ background: CARD, border: `1px solid rgba(255,109,41,0.25)`, borderRadius: '16px', overflow: 'hidden', marginBottom: '20px' }}>
          <div style={{ padding: '20px 24px', borderBottom: `1px solid ${BORDER}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '14px', fontWeight: 600, color: 'white' }}>{T.revenueOpp}</span>
            <span style={{ fontSize: '11px', color: MUTED }}>{opportunities.length} {T.open}</span>
          </div>

          {opportunities.length === 0 ? (
            <div style={{ padding: '32px 24px', textAlign: 'center', color: MUTED, fontSize: '13px', lineHeight: 1.7 }}>
              {T.noOpps}
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', gap: 0 }}>
              <div style={{ padding: '24px', borderRight: `1px solid ${BORDER}`, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', textAlign: 'center' }}>
                <div style={{ fontSize: '11px', color: MUTED, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '8px' }}>
                  {T.recoverable}
                </div>
                {hasAnyValue ? (
                  <>
                    <div style={{ fontFamily: D, fontSize: '2rem', fontWeight: 900, color: ORANGE, lineHeight: 1, letterSpacing: '-0.02em' }}>
                      {totalOppValue.toLocaleString(locale, { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })}
                    </div>
                    <div style={{ fontSize: '11px', color: MUTED, marginTop: '6px' }}>{T.ifResolveAll}</div>
                  </>
                ) : (
                  <button onClick={() => navigate('/dashboard/settings?section=negocio')}
                    style={{ fontSize: '11px', color: ORANGE, background: 'rgba(255,109,41,0.1)', border: '1px solid rgba(255,109,41,0.25)', borderRadius: '8px', padding: '8px 12px', cursor: 'pointer', lineHeight: 1.5 }}>
                    {lang === 'en' ? 'Set your average ticket to see the estimated value →' : 'Configure seu ticket médio para ver o valor estimado →'}
                  </button>
                )}
              </div>
              <div style={{ padding: '12px 24px' }}>
                <div style={{ maxHeight: '320px', overflowY: 'auto' }}>
                  {opportunities.map(o => (
                    <div key={o.id} onClick={() => navigate('/dashboard/oportunidades')}
                      style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 0', borderBottom: `1px solid ${BORDER}`, cursor: 'pointer' }}>
                      <span style={{ fontSize: '16px' }}>{TYPE_ICON[o.type] ?? '💡'}</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: '13px', color: 'white', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{o.title}</div>
                        {o.estimated_impact && <div style={{ fontSize: '11px', color: MUTED, marginTop: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{o.estimated_impact}</div>}
                      </div>
                      {o.estimated_value != null && (
                        <div style={{ fontSize: '13px', fontWeight: 700, color: ORANGE, flexShrink: 0 }}>
                          + {o.estimated_value.toLocaleString(locale, { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })}
                        </div>
                      )}
                      <span style={{ fontSize: '13px', color: MUTED, flexShrink: 0 }}>›</span>
                    </div>
                  ))}
                </div>
                <button onClick={() => navigate('/dashboard/oportunidades')}
                  style={{ marginTop: '14px', padding: '10px 18px', background: ORANGE, color: '#000', fontWeight: 700, fontSize: '13px', borderRadius: '9px', border: 'none', cursor: 'pointer' }}>
                  {T.resolveNow}
                </button>
              </div>
            </div>
          )}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
          <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: '16px', overflow: 'hidden' }}>
            <div style={{ padding: '20px 24px', borderBottom: `1px solid ${BORDER}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '14px', fontWeight: 600, color: 'white' }}>{T.healthScore}</span>
              <span style={{ fontSize: '11px', color: MUTED }}>{T.updatedToday}</span>
            </div>
            <div style={{ padding: '28px 24px', textAlign: 'center' }}>
              {healthScore != null ? (
                <>
                  <div style={{ fontFamily: D, fontSize: '5rem', fontWeight: 900, color: healthColor, lineHeight: 1, letterSpacing: '-0.04em' }}>{healthScore}</div>
                  <div style={{ fontSize: '13px', color: MUTED, marginTop: '8px', marginBottom: '24px' }}>{T.outOf100}</div>
                  <div style={{ height: '8px', borderRadius: '99px', background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
                    <div style={{ width: `${healthScore}%`, height: '100%', background: `linear-gradient(90deg, ${healthColor}, ${healthColor}99)`, transition: 'width 0.8s ease' }} />
                  </div>
                  <div style={{ fontSize: '11px', color: MUTED, marginTop: '10px' }}>
                    {healthScore >= 75 ? T.healthy : healthScore >= 50 ? T.improve : T.attention}
                  </div>
                </>
              ) : (
                <div>
                  <div style={{ fontSize: '2.5rem', marginBottom: '12px' }}>📊</div>
                  <div style={{ fontSize: '14px', color: MUTED, lineHeight: 1.6, marginBottom: '20px' }}>{T.noDiagData}</div>
                  <button onClick={() => navigate('/onboarding')}
                    style={{ padding: '9px 20px', background: ORANGE, color: '#000', fontWeight: 700, fontSize: '13px', borderRadius: '9px', border: 'none', cursor: 'pointer' }}>
                    {T.doDiag}
                  </button>
                </div>
              )}
            </div>
          </div>

          <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: '16px', overflow: 'hidden' }}>
            <div style={{ padding: '20px 24px', borderBottom: `1px solid ${BORDER}` }}>
              <span style={{ fontSize: '14px', fontWeight: 600, color: 'white' }}>{T.indicators}</span>
            </div>
            <div style={{ padding: '8px 24px 20px' }}>
              {mob?.performance != null && <HealthRow label={T.mobPerf} value={mob.performance as number} color={scoreColor(mob.performance as number)} sub={`${T.diagDate} ${diagDate}`} />}
              {desk?.performance != null && <HealthRow label={T.deskPerf} value={desk.performance as number} color={scoreColor(desk.performance as number)} />}
              {mob?.seo != null && <HealthRow label={T.seo} value={mob.seo as number} color={scoreColor(mob.seo as number)} />}
              {mob?.accessibility != null && <HealthRow label={T.accessibility} value={mob.accessibility as number} color={scoreColor(mob.accessibility as number)} />}
              {company.google_rating != null && (
                <HealthRow
                  label={T.googleRating}
                  value={`${company.google_rating}★`}
                  color={company.google_rating >= 4 ? '#4ade80' : company.google_rating >= 3 ? '#FBBF24' : '#f87171'}
                  sub={company.google_review_count ? `${company.google_review_count} ${T.reviews}` : undefined}
                />
              )}
              {reviewStats && reviewStats.total > 0 && (
                <HealthRow
                  label={T.reviewSentiment}
                  value={`${Math.round((reviewStats.positive / reviewStats.total) * 100)}%`}
                  color={scoreColor(Math.round((reviewStats.positive / reviewStats.total) * 100))}
                  sub={`${reviewStats.total} ${T.analyzed} · ${reviewStats.positive} ${T.positive} · ${reviewStats.negative} ${T.negative}`}
                />
              )}
              {(!mob && !company.google_rating && (!reviewStats || reviewStats.total === 0)) && (
                <div style={{ padding: '30px 0', textAlign: 'center', color: MUTED, fontSize: '13px', lineHeight: 1.7 }}>
                  {T.noData.split('\n').map((line, i) => <span key={i}>{line}{i === 0 ? <br /> : ''}</span>)}
                </div>
              )}
            </div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginTop: '20px' }}>
          {T.quickActions.map((label, i) => (
            <button key={i} onClick={() => navigate(T.quickLinks[i])}
              style={{ padding: '14px 16px', background: 'rgba(255,255,255,0.03)', border: `1px solid ${BORDER}`, borderRadius: '12px', color: MUTED, fontSize: '13px', fontWeight: 500, cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s' }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(255,109,41,0.25)'; e.currentTarget.style.color = 'white' }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = BORDER; e.currentTarget.style.color = MUTED }}>
              {label}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
