import { useEffect, useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import { useLang } from '../../contexts/LanguageContext'
import { d } from '../../i18n-dash'
import { InsightReport } from '../../components/InsightReport'

const ORANGE = '#FF6D29'
const CARD = '#150E08'
const MUTED = '#BABABA'
const D = "'Bricolage Grotesque', system-ui, sans-serif"
const BORDER = 'rgba(255,255,255,0.06)'
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string

interface PagespeedData {
  performance?: number
  seo?: number
  accessibility?: number
  best_practices?: number
  lcp?: number
  fcp?: number
  si?: number
  tbt?: number
  cls?: number
  opportunities?: Array<{ id: string; title: string; displayValue: string }>
}

interface FrontendReview {
  score?: number
  summary?: string
  strengths?: string[]
  improvements?: string[]
  screenshot_url?: string
}

interface Diagnostic {
  id: string
  status: string | null
  created_at: string | null
  website_url: string
  pagespeed_mobile: PagespeedData | null
  pagespeed_desktop: PagespeedData | null
  frontend_review: FrontendReview | null
}

interface Company {
  id: string
  business_name: string | null
  website_url: string | null
}

type Strategy = 'mobile' | 'desktop'

const TX = {
  pt: {
    loc: 'pt-BR', loading: 'Carregando...', runErr: 'Erro ao rodar diagnóstico',
    scores: { performance: 'Performance', seo: 'SEO', accessibility: 'Acessibilidade', best_practices: 'Boas Práticas' } as Record<string, string>,
    running: 'Rodando diagnóstico do site...', last: 'Último', autoRun: 'Rodando diagnóstico automático...', setUrl: 'Configure o URL do site nas Configurações para ativar',
    runningBtn: 'Rodando...', newDiag: 'Novo diagnóstico', runDiag: 'Rodar diagnóstico',
    analyzing: (u: string) => `Analisando ${u}...`, yourSite: 'seu site',
    psRunning: 'Rodando PageSpeed Insights mobile e desktop. Leva ~30 segundos.',
    unavailable: 'Diagnóstico técnico indisponível',
    unavA: 'As métricas técnicas (PageSpeed) não puderam ser coletadas. Adicione a chave ', unavB: ' nos secrets do Supabase para ativar.',
    meanwhile: 'Enquanto isso, rode novamente para obter a análise de IA.', runAI: 'Rodar análise de IA →',
    improvements: 'Oportunidades de Melhoria', critique: 'Crítica visual/UX (IA)', shotAlt: 'Screenshot do site',
    strengths: 'Pontos fortes', suggested: 'Melhorias sugeridas',
  },
  en: {
    loc: 'en-US', loading: 'Loading...', runErr: 'Error running diagnosis',
    scores: { performance: 'Performance', seo: 'SEO', accessibility: 'Accessibility', best_practices: 'Best Practices' } as Record<string, string>,
    running: 'Running site diagnosis...', last: 'Last', autoRun: 'Running automatic diagnosis...', setUrl: 'Set your site URL in Settings to activate',
    runningBtn: 'Running...', newDiag: 'New diagnosis', runDiag: 'Run diagnosis',
    analyzing: (u: string) => `Analyzing ${u}...`, yourSite: 'your site',
    psRunning: 'Running PageSpeed Insights for mobile and desktop. Takes ~30 seconds.',
    unavailable: 'Technical diagnosis unavailable',
    unavA: "The technical metrics (PageSpeed) couldn't be collected. Add the key ", unavB: ' to the Supabase secrets to enable it.',
    meanwhile: 'Meanwhile, run it again to get the AI analysis.', runAI: 'Run AI analysis →',
    improvements: 'Improvement Opportunities', critique: 'Visual/UX review (AI)', shotAlt: 'Site screenshot',
    strengths: 'Strengths', suggested: 'Suggested improvements',
  },
} as const

const METRIC_LABELS: Record<string, string> = {
  lcp: 'LCP',
  fcp: 'FCP',
  si: 'Speed Index',
  tbt: 'TBT',
  cls: 'CLS',
}

function scoreColor(s: number) {
  return s >= 75 ? '#4ade80' : s >= 50 ? '#FBBF24' : '#f87171'
}

function ScoreCard({ label, score }: { label: string; score: number | undefined }) {
  const s = score ?? 0
  const color = scoreColor(s)
  return (
    <div style={{ background: 'rgba(255,255,255,0.03)', border: `1px solid ${BORDER}`, borderRadius: '12px', padding: '18px 20px', textAlign: 'center' }}>
      <div style={{ fontFamily: D, fontSize: '2.8rem', fontWeight: 900, color, lineHeight: 1 }}>{score != null ? s : '—'}</div>
      <div style={{ fontSize: '11px', color: MUTED, marginTop: '8px', textTransform: 'uppercase', letterSpacing: '0.07em' }}>{label}</div>
      <div style={{ marginTop: '10px', height: '3px', borderRadius: '99px', background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
        <div style={{ width: `${s}%`, height: '100%', borderRadius: '99px', background: color }} />
      </div>
    </div>
  )
}

export default function DiagnosticsPage() {
  const { user, session } = useAuth()
  const navigate = useNavigate()
  const { lang } = useLang()
  const T = d[lang].diagnostics
  const X = TX[lang]
  const [diag, setDiag] = useState<Diagnostic | null>(null)
  const [company, setCompany] = useState<Company | null>(null)
  const [loading, setLoading] = useState(true)
  const [running, setRunning] = useState(false)
  const [runError, setRunError] = useState('')
  const [strategy, setStrategy] = useState<Strategy>('mobile')
  const autoRan = useRef(false)

  useEffect(() => { if (user) loadData() }, [user])

  const loadData = async (skipAutoRun = false) => {
    if (!user) return
    setLoading(true)

    const { data: co } = await supabase
      .from('companies')
      .select('id, business_name, website_url')
      .eq('user_id', user.id)
      .maybeSingle()

    setCompany(co as Company | null)

    let diagData: Diagnostic | null = null
    if (co) {
      const { data } = await supabase
        .from('diagnostics')
        .select('id, status, created_at, website_url, pagespeed_mobile, pagespeed_desktop, frontend_review')
        .eq('company_id', co.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      diagData = data ?? null
      setDiag(diagData)
    }

    setLoading(false)

    if (!skipAutoRun && !autoRan.current && co?.website_url && !diagData) {
      autoRan.current = true
      runDiagnosis(true)
    }
  }

  const runDiagnosis = async (isAuto = false) => {
    if (!session || running) return
    setRunning(true)
    setRunError('')
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/site-diagnosis`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? X.runErr)
      const { data: newDiag } = await supabase
        .from('diagnostics')
        .select('id, status, created_at, website_url, pagespeed_mobile, pagespeed_desktop, frontend_review')
        .eq('id', data.id)
        .single()
      if (newDiag) setDiag(newDiag)
    } catch (e: unknown) {
      if (!isAuto) setRunError(e instanceof Error ? e.message : String(e))
    }
    setRunning(false)
  }

  if (loading) return <div style={{ padding: '28px 32px', color: MUTED, fontSize: '14px' }}>{X.loading}</div>

  const ps = strategy === 'mobile' ? diag?.pagespeed_mobile : diag?.pagespeed_desktop
  const hasWebsite = !!company?.website_url

  return (
    <div>
      <div style={{ padding: '28px 32px 24px', borderBottom: `1px solid ${BORDER}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontFamily: D, fontSize: '1.5rem', fontWeight: 800, color: 'white', letterSpacing: '-0.02em', marginBottom: '4px' }}>{T.title}</h1>
          <p style={{ color: MUTED, fontSize: '13px' }}>
            {running ? X.running : diag
              ? `${X.last}: ${new Date(diag.created_at!).toLocaleDateString(X.loc)} · ${diag.website_url}`
              : hasWebsite ? X.autoRun : X.setUrl}
          </p>
        </div>
        {hasWebsite && (
          <button
            onClick={() => runDiagnosis()}
            disabled={running}
            style={{ padding: '9px 18px', background: running ? 'rgba(255,109,41,0.3)' : ORANGE, color: '#000', fontWeight: 700, fontSize: '13px', borderRadius: '9px', border: 'none', cursor: running ? 'not-allowed' : 'pointer', flexShrink: 0 }}>
            {running ? X.runningBtn : diag ? X.newDiag : X.runDiag}
          </button>
        )}
      </div>

      <div style={{ padding: '28px 32px' }}>
        <InsightReport tabKey="performance" />

        {runError && (
          <div style={{ background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.2)', borderRadius: '10px', padding: '12px 16px', marginBottom: '20px', fontSize: '13px', color: '#f87171', lineHeight: 1.5 }}>
            {runError}
          </div>
        )}

        {running && (
          <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: '14px', padding: '48px 32px', textAlign: 'center', marginBottom: '24px' }}>
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', marginBottom: '20px' }}>
              {[0, 1, 2].map(i => (
                <div key={i} style={{ width: '8px', height: '8px', borderRadius: '50%', background: ORANGE, animation: `bounce 1.2s ease-in-out ${i * 0.2}s infinite` }} />
              ))}
            </div>
            <div style={{ fontFamily: D, fontSize: '1.1rem', fontWeight: 700, color: 'white', marginBottom: '8px' }}>
              {X.analyzing(company?.website_url ?? X.yourSite)}
            </div>
            <div style={{ fontSize: '13px', color: MUTED }}>
              {X.psRunning}
            </div>
          </div>
        )}

        {!running && !hasWebsite && (
          <div style={{ background: 'rgba(255,109,41,0.06)', border: '1px solid rgba(255,109,41,0.2)', borderRadius: '14px', padding: '60px 32px', textAlign: 'center' }}>
            <div style={{ fontSize: '2.5rem', marginBottom: '14px' }}>🌐</div>
            <div style={{ fontFamily: D, fontSize: '1.2rem', fontWeight: 800, color: 'white', marginBottom: '10px' }}>{T.noSite}</div>
            <div style={{ fontSize: '14px', color: MUTED, maxWidth: '400px', margin: '0 auto 24px', lineHeight: 1.7 }}>{T.noSiteDesc}</div>
            <button onClick={() => navigate('/dashboard/settings?section=presenca')}
              style={{ padding: '11px 24px', background: ORANGE, color: '#000', fontWeight: 700, fontSize: '14px', borderRadius: '10px', border: 'none', cursor: 'pointer' }}>
              {T.configureSite}
            </button>
          </div>
        )}

        {!running && hasWebsite && diag && diag.status === 'partial' && !diag.pagespeed_mobile && !diag.pagespeed_desktop && !diag.frontend_review && (
          <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: '14px', padding: '48px 32px', textAlign: 'center' }}>
            <div style={{ fontSize: '2.5rem', marginBottom: '12px' }}>⚠️</div>
            <div style={{ fontFamily: D, fontSize: '1.2rem', fontWeight: 800, color: 'white', marginBottom: '8px' }}>{X.unavailable}</div>
            <div style={{ fontSize: '14px', color: MUTED, maxWidth: '420px', margin: '0 auto 12px', lineHeight: 1.7 }}>
              {X.unavA}<strong style={{ color: 'white' }}>PAGESPEED_API_KEY</strong>{X.unavB}
            </div>
            <div style={{ fontSize: '13px', color: MUTED, marginBottom: '24px' }}>
              {X.meanwhile}
            </div>
            <button onClick={() => runDiagnosis()} disabled={running}
              style={{ padding: '11px 24px', background: ORANGE, color: '#000', fontWeight: 700, fontSize: '14px', borderRadius: '10px', border: 'none', cursor: 'pointer' }}>
              {X.runAI}
            </button>
          </div>
        )}

        {!running && hasWebsite && diag && (diag.pagespeed_mobile || diag.pagespeed_desktop) && (
          <>
            <div style={{ display: 'flex', background: 'rgba(255,255,255,0.04)', borderRadius: '10px', padding: '3px', marginBottom: '24px', width: 'fit-content' }}>
              {(['mobile', 'desktop'] as Strategy[]).map(s => (
                <button key={s} onClick={() => setStrategy(s)}
                  style={{ padding: '7px 20px', borderRadius: '8px', border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: 600, transition: 'all 0.2s', background: strategy === s ? 'rgba(255,109,41,0.15)' : 'transparent', color: strategy === s ? ORANGE : MUTED }}>
                  {s === 'mobile' ? '📱 Mobile' : '🖥️ Desktop'}
                </button>
              ))}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '28px' }}>
              {Object.entries(X.scores).map(([key, label]) => (
                <ScoreCard key={key} label={label} score={ps?.[key as keyof PagespeedData] as number | undefined} />
              ))}
            </div>

            {ps && (
              <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: '14px', marginBottom: '24px', overflow: 'hidden' }}>
                <div style={{ padding: '16px 22px', borderBottom: `1px solid ${BORDER}` }}>
                  <span style={{ color: 'white', fontWeight: 600, fontSize: '14px' }}>Core Web Vitals</span>
                </div>
                <div style={{ padding: '18px 22px', display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '16px' }}>
                  {Object.entries(METRIC_LABELS).map(([key, label]) => {
                    const val = ps[key as keyof PagespeedData] as number | undefined
                    return (
                      <div key={key} style={{ textAlign: 'center' }}>
                        <div style={{ fontFamily: D, fontSize: '1.6rem', fontWeight: 800, color: 'white', lineHeight: 1 }}>
                          {val != null ? (key === 'cls' ? val.toFixed(2) : `${(val / 1000).toFixed(1)}s`) : '—'}
                        </div>
                        <div style={{ fontSize: '11px', color: MUTED, marginTop: '6px', textTransform: 'uppercase', letterSpacing: '0.07em' }}>{label}</div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {ps?.opportunities && ps.opportunities.length > 0 && (
              <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: '14px', overflow: 'hidden' }}>
                <div style={{ padding: '16px 22px', borderBottom: `1px solid ${BORDER}` }}>
                  <span style={{ color: 'white', fontWeight: 600, fontSize: '14px' }}>{X.improvements}</span>
                </div>
                {ps.opportunities.map((op, i) => (
                  <div key={op.id} style={{ padding: '14px 22px', borderBottom: i < ps.opportunities!.length - 1 ? `1px solid ${BORDER}` : 'none', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '16px' }}>
                    <div style={{ fontSize: '13px', color: 'white' }}>{op.title}</div>
                    <div style={{ fontSize: '12px', color: '#f87171', fontWeight: 600, whiteSpace: 'nowrap' }}>{op.displayValue}</div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {!running && hasWebsite && diag?.frontend_review && (
          <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: '14px', marginTop: ps ? '24px' : 0, marginBottom: '24px', overflow: 'hidden' }}>
            <div style={{ padding: '16px 22px', borderBottom: `1px solid ${BORDER}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
              <span style={{ color: 'white', fontWeight: 600, fontSize: '14px' }}>{X.critique}</span>
              {diag.frontend_review.score != null && (
                <span style={{ fontFamily: D, fontSize: '1.4rem', fontWeight: 900, color: scoreColor(diag.frontend_review.score) }}>{diag.frontend_review.score}</span>
              )}
            </div>
            <div style={{ padding: '20px 22px', display: 'grid', gridTemplateColumns: diag.frontend_review.screenshot_url ? '220px 1fr' : '1fr', gap: '20px' }}>
              {diag.frontend_review.screenshot_url && (
                <img src={diag.frontend_review.screenshot_url} alt={X.shotAlt} style={{ width: '100%', borderRadius: '10px', border: `1px solid ${BORDER}`, display: 'block' }} />
              )}
              <div>
                {diag.frontend_review.summary && (
                  <p style={{ fontSize: '13px', color: 'white', lineHeight: 1.7, marginBottom: '14px' }}>{diag.frontend_review.summary}</p>
                )}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  {diag.frontend_review.strengths && diag.frontend_review.strengths.length > 0 && (
                    <div>
                      <div style={{ fontSize: '11px', fontWeight: 700, color: '#4ade80', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '8px' }}>{X.strengths}</div>
                      <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        {diag.frontend_review.strengths.map((s, i) => (
                          <li key={i} style={{ fontSize: '12px', color: MUTED, lineHeight: 1.6, display: 'flex', gap: '6px' }}><span style={{ color: '#4ade80', flexShrink: 0 }}>✓</span>{s}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {diag.frontend_review.improvements && diag.frontend_review.improvements.length > 0 && (
                    <div>
                      <div style={{ fontSize: '11px', fontWeight: 700, color: ORANGE, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '8px' }}>{X.suggested}</div>
                      <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        {diag.frontend_review.improvements.map((s, i) => (
                          <li key={i} style={{ fontSize: '12px', color: MUTED, lineHeight: 1.6, display: 'flex', gap: '6px' }}><span style={{ color: ORANGE, flexShrink: 0 }}>→</span>{s}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      <style>{`
        @keyframes bounce { 0%, 100% { transform: translateY(0); opacity: 0.4; } 50% { transform: translateY(-5px); opacity: 1; } }
      `}</style>
    </div>
  )
}
