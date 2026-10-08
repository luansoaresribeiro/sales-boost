import { useState, useEffect, useMemo } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import {
  computeGrowthScore, CRITERIA_WEIGHTS, CRITERIA_INFO, CRITERIA_INFO_EN, VERDICT_BANDS, VERDICT_BANDS_EN,
  type InstagramData, type Verdict, type CriterionKey,
} from '../../lib/growthScore'
import { useLang } from '../../contexts/LanguageContext'

const ORANGE = '#FF6D29'
const BG = '#0E0B0A'
const CARD = '#1A1008'
const MUTED = '#BABABA'
const BORDER = 'rgba(255,255,255,0.07)'
const D = "'Bricolage Grotesque', system-ui, sans-serif"

const VERDICT_COLOR: Record<Verdict | 'partial', string> = {
  ready: '#4ade80', potential: '#FB923C', blocked: '#f87171', partial: '#9CA3AF',
}
const POLL_EVERY_MS = 5000
const POLL_MAX_MS = 90000

interface Diagnostic {
  id: string
  business_name: string
  business_type: string
  city: string
  website_url: string | null
  instagram_url: string | null
  google_maps_url: string | null
  pagespeed_mobile: { scores: { performance: number; seo: number; accessibility: number; best_practices: number } } | null
  pagespeed_desktop: { scores: { performance: number; seo: number; accessibility: number; best_practices: number } } | null
  instagram_data: InstagramData | null
  status: string
  created_at: string
}

function Ring({ score, color, label, partialLabel }: { score: number | null; color: string; label: string; partialLabel: string }) {
  const r = 52, c = 2 * Math.PI * r
  return (
    <div style={{ position: 'relative', width: 132, height: 132, flexShrink: 0 }}>
      <svg width="132" height="132" viewBox="0 0 132 132" style={{ transform: 'rotate(-90deg)' }} aria-hidden="true">
        <circle cx="66" cy="66" r={r} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="10" />
        {score !== null && (
          <circle cx="66" cy="66" r={r} fill="none" stroke={color} strokeWidth="10" strokeLinecap="round"
            strokeDasharray={c} strokeDashoffset={c * (1 - score / 100)} style={{ transition: 'stroke-dashoffset 1s ease' }} />
        )}
      </svg>
      <div role="img" aria-label={label} style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center', fontFamily: D, fontWeight: 900, color, fontSize: score !== null ? 40 : 15, lineHeight: 1.15, padding: score !== null ? 0 : 18 }}>
        {score !== null ? score : partialLabel}
      </div>
    </div>
  )
}

const FLOW = { pt: ['Diagnóstico', 'Oportunidades', 'Plano', 'Ativar'], en: ['Diagnosis', 'Opportunities', 'Plan', 'Activate'] }

const TX = {
  pt: {
    notFoundErr: 'Diagnóstico não encontrado.', notFound: 'Diagnóstico não encontrado', createNew: '← Criar novo diagnóstico',
    partial: 'Análise parcial', score: (n: number | null) => `Nota ${n} de 100`, discover: 'Descubra seu Growth Potential',
    analyzingIg: 'Analisando seu Instagram…', analyzingSub: 'Isso leva alguns segundos. A tela atualiza sozinha.',
    coverage: 'Cobertura:', coverageTail: 'dos critérios avaliados',
    partialMsg: 'Não conseguimos avaliar critérios suficientes pra dar uma nota. Não inventamos números: o que falta fica de fora.',
    howFormed: 'Como sua nota foi formada', igErr: 'Não conseguimos ler seu Instagram agora (perfil privado ou fora do ar). Os itens dele ficaram sem avaliação.',
    noIg: 'Este diagnóstico não tem a leitura do Instagram.', of: 'de', notEval: 'Não avaliado',
    howCalc: '▸ Como calculamos',
    calc1: 'A nota vem do seu Instagram. Site e Google só somam se existirem. O que não conseguimos ver fica "não avaliado" e sai da conta — nada é inventado nem penaliza você.',
    pts: 'pts', calc2: 'Nota = pontos dos critérios avaliados ÷ pontos possíveis deles × 100. Com menos de 40% dos critérios avaliados, mostramos "Análise parcial", sem veredito.',
    cta: 'Criar conta e receber meu vídeo grátis →',
    ctaSub: 'Seu vídeo grátis está em liberação — avisamos quando estiver pronto. Sem cartão.',
    ctaPlan: 'A estratégia completa faz parte do plano pago.',
  },
  en: {
    notFoundErr: 'Diagnosis not found.', notFound: 'Diagnosis not found', createNew: '← Create new diagnosis',
    partial: 'Partial analysis', score: (n: number | null) => `Score ${n} out of 100`, discover: 'Discover your Growth Potential',
    analyzingIg: 'Analyzing your Instagram…', analyzingSub: 'This takes a few seconds. The screen updates by itself.',
    coverage: 'Coverage:', coverageTail: 'of the criteria evaluated',
    partialMsg: 'We could not evaluate enough criteria to give a score. We do not make up numbers: what is missing is left out.',
    howFormed: 'How your score was formed', igErr: 'We could not read your Instagram right now (private profile or offline). Its items were left unevaluated.',
    noIg: 'This diagnosis has no Instagram reading.', of: 'of', notEval: 'Not evaluated',
    howCalc: '▸ How we calculate',
    calc1: 'The score comes from your Instagram. Website and Google only add if they exist. What we cannot see stays "not evaluated" and is left out of the calculation — nothing is made up and nothing penalizes you.',
    pts: 'pts', calc2: 'Score = points of the evaluated criteria ÷ their possible points × 100. With fewer than 40% of the criteria evaluated, we show "Partial analysis", with no verdict.',
    cta: 'Create account and get my free video →',
    ctaSub: 'Your free video is being released — we will let you know when it is ready. No card.',
    ctaPlan: 'The full strategy is part of the paid plan.',
  },
}

export default function DiagnosticoPage() {
  const { id } = useParams<{ id: string }>()
  return (
    <div style={{ minHeight: '100vh', background: BG, overflowX: 'hidden' }}>
      <div style={{ padding: '16px', borderBottom: `1px solid ${BORDER}` }}>
        <a href="/" style={{ fontFamily: D, fontSize: '1.3rem', fontWeight: 900, color: 'white', textDecoration: 'none', letterSpacing: '-0.02em' }}>
          <span style={{ color: ORANGE }}>Sales</span>Boost
        </a>
      </div>
      {id ? <DiagnosticResult id={id} /> : null}
    </div>
  )
}

// Resultado do diagnóstico (nota, critérios, "como calculamos", CTA). Usado na
// rota /diagnostico/:id e INLINE na landing (embedded: sem altura de página).
export function DiagnosticResult({ id, embedded = false }: { id: string; embedded?: boolean }) {
  const navigate = useNavigate()
  const { lang } = useLang()
  const t = TX[lang]
  const [diag, setDiag] = useState<Diagnostic | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [waited, setWaited] = useState(0)

  useEffect(() => {
    let alive = true
    supabase.from('diagnostics').select('*').eq('id', id).single().then(({ data, error: err }) => {
      if (!alive) return
      if (err || !data) setError(t.notFoundErr)
      else setDiag(data as Diagnostic)
      setLoading(false)
    })
    return () => { alive = false }
  }, [id])

  // Coleta do Instagram em andamento: recarrega a cada ~5s por até ~90s.
  const collecting = !!diag && !diag.instagram_data && diag.status === 'processing' && waited < POLL_MAX_MS
  useEffect(() => {
    if (!collecting) return
    const t = setTimeout(async () => {
      const { data } = await supabase.from('diagnostics').select('*').eq('id', id).single()
      if (data) setDiag(data as Diagnostic)
      setWaited(w => w + POLL_EVERY_MS)
    }, POLL_EVERY_MS)
    return () => clearTimeout(t)
  }, [collecting, id, waited])

  const result = useMemo(() => diag ? computeGrowthScore({
    instagram_data: diag.instagram_data,
    pagespeed_mobile: diag.pagespeed_mobile,
    pagespeed_desktop: diag.pagespeed_desktop,
  }, lang) : null, [diag, lang])

  if (loading) return (
    <div style={{ minHeight: embedded ? 200 : '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: 40, height: 40, border: '3px solid rgba(255,109,41,0.15)', borderTopColor: ORANGE, borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )

  if (error || !diag || !result) return (
    <div style={{ minHeight: embedded ? 200 : '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, padding: 24, textAlign: 'center' }}>
      <div style={{ color: 'white', fontSize: 18, fontWeight: 700 }}>{t.notFound}</div>
      <Link to="/onboarding" style={{ color: ORANGE, textDecoration: 'none', fontSize: 14 }}>{t.createNew}</Link>
    </div>
  )

  const color = VERDICT_COLOR[result.verdict ?? 'partial']
  const partial = result.state === 'partial'
  const igRow = ['frequency', 'engagement', 'format', 'profile'].map(k => result.criteria.find(c => c.key === k)!)
  const noIgYet = collecting // ainda coletando
  const ringLabel = partial ? t.partial : t.score(result.score)
  const info = lang === 'en' ? CRITERIA_INFO_EN : CRITERIA_INFO
  const bands = lang === 'en' ? VERDICT_BANDS_EN : VERDICT_BANDS

  return (
    <div style={{ overflowX: 'hidden' }}>
      <div style={{ maxWidth: 640, margin: '0 auto', padding: embedded ? '8px 0 0' : '28px 16px 64px' }}>
        {/* Fluxo */}
        <ol style={{ listStyle: 'none', display: 'flex', flexWrap: 'wrap', gap: 6, padding: 0, margin: '0 0 24px', fontSize: 11, fontWeight: 700 }}>
          {FLOW[lang].map((f, i) => (
            <li key={f} style={{ padding: '4px 10px', borderRadius: 99, background: i === 0 ? 'rgba(255,109,41,0.15)' : 'rgba(255,255,255,0.04)', color: i === 0 ? ORANGE : MUTED, border: `1px solid ${i === 0 ? 'rgba(255,109,41,0.35)' : BORDER}` }}>
              {i + 1}. {f}
            </li>
          ))}
        </ol>

        <div style={{ fontSize: 12, fontWeight: 700, color: ORANGE, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>
          {t.discover}
        </div>
        <h1 style={{ fontFamily: D, fontSize: 'clamp(1.6rem, 6vw, 2.4rem)', fontWeight: 900, color: 'white', letterSpacing: '-0.03em', margin: '0 0 6px', lineHeight: 1.1, overflowWrap: 'anywhere' }}>
          {diag.business_name}
        </h1>
        <p style={{ fontSize: 14, color: MUTED, lineHeight: 1.6, margin: '0 0 24px' }}>
          {diag.business_type} · {diag.city}
        </p>

        {/* Nota */}
        <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 20, padding: 20, marginBottom: 20 }}>
          {noIgYet ? (
            <div style={{ textAlign: 'center', padding: '24px 0' }} role="status">
              <div style={{ width: 36, height: 36, margin: '0 auto 14px', border: '3px solid rgba(255,109,41,0.15)', borderTopColor: ORANGE, borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
              <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
              <div style={{ color: 'white', fontWeight: 700, marginBottom: 6 }}>{t.analyzingIg}</div>
              <div style={{ color: MUTED, fontSize: 13 }}>{t.analyzingSub}</div>
            </div>
          ) : (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 18, flexWrap: 'wrap' }}>
                <Ring score={result.score} color={color} label={ringLabel} partialLabel={t.partial} />
                <div style={{ flex: '1 1 160px', minWidth: 0 }}>
                  <span style={{ display: 'inline-block', padding: '5px 14px', borderRadius: 99, fontSize: 13, fontWeight: 800, color, background: `${color}1f`, border: `1px solid ${color}55`, marginBottom: 10 }}>
                    {result.verdictLabel ?? t.partial}
                  </span>
                  <div style={{ fontSize: 13, color: MUTED, lineHeight: 1.6 }}>
                    {t.coverage} <strong style={{ color: 'white' }}>{result.coverage}%</strong> {t.coverageTail}
                  </div>
                  {partial && (
                    <div style={{ fontSize: 12, color: MUTED, lineHeight: 1.6, marginTop: 6 }}>
                      {t.partialMsg}
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Como a nota foi formada */}
        {!noIgYet && (
          <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 20, padding: 20, marginBottom: 20 }}>
            <h2 style={{ fontFamily: D, fontSize: '1.05rem', fontWeight: 800, color: 'white', margin: '0 0 6px' }}>{t.howFormed}</h2>
            {diag.instagram_data?.error && (
              <p style={{ fontSize: 12, color: MUTED, margin: '0 0 6px', lineHeight: 1.5 }}>
                {t.igErr}
              </p>
            )}
            {!diag.instagram_data && (
              <p style={{ fontSize: 12, color: MUTED, margin: '0 0 6px', lineHeight: 1.5 }}>
                {t.noIg}
              </p>
            )}
            {[...igRow, ...result.criteria.filter(c => c.key === 'addon')].map(c => (
              <div key={c.key} style={{ padding: '12px 0', borderTop: `1px solid ${BORDER}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'baseline' }}>
                  <span style={{ fontSize: 14, fontWeight: 700, color: 'white' }}>{c.label}</span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: c.evaluated ? ORANGE : MUTED, whiteSpace: 'nowrap' }}>
                    {c.evaluated ? `${lang === 'en' ? String(c.points) : String(c.points).replace('.', ',')} ${t.of} ${c.weight}` : t.notEval}
                  </span>
                </div>
                <div style={{ fontSize: 13, color: c.evaluated ? '#E5E5E5' : MUTED, marginTop: 3, overflowWrap: 'anywhere' }}>
                  {c.evaluated ? c.value : c.reason}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Como calculamos */}
        <details style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 16, padding: '4px 16px', marginBottom: 24 }}>
          <summary style={{ cursor: 'pointer', minHeight: 44, display: 'flex', alignItems: 'center', fontSize: 14, fontWeight: 700, color: 'white' }}>{t.howCalc}</summary>
          <div style={{ paddingBottom: 14 }}>
            <p style={{ fontSize: 12.5, color: MUTED, lineHeight: 1.6, margin: '0 0 10px' }}>
              {t.calc1}
            </p>
            {(Object.keys(CRITERIA_WEIGHTS) as CriterionKey[]).map(k => (
              <div key={k} style={{ padding: '8px 0', borderTop: `1px solid ${BORDER}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, fontSize: 13, color: 'white', fontWeight: 700 }}>
                  <span>{info[k].label}</span><span>{CRITERIA_WEIGHTS[k]} {t.pts}</span>
                </div>
                <div style={{ fontSize: 12, color: MUTED, lineHeight: 1.5, marginTop: 2 }}>{info[k].rule}</div>
              </div>
            ))}
            <p style={{ fontSize: 12.5, color: MUTED, lineHeight: 1.6, margin: '10px 0 6px' }}>
              {t.calc2}
            </p>
            {bands.map(b => (
              <div key={b.verdict} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, padding: '4px 0', color: VERDICT_COLOR[b.verdict] }}>
                <span style={{ fontWeight: 700 }}>{b.label}</span><span>{b.range}</span>
              </div>
            ))}
          </div>
        </details>

        {/* CTA */}
        <button
          onClick={() => navigate(`/signup?claim=${diag.id}`)}
          style={{ display: 'block', width: '100%', minHeight: 52, padding: '14px 20px', background: ORANGE, color: '#000', fontFamily: D, fontWeight: 900, fontSize: 16, borderRadius: 14, border: 'none', cursor: 'pointer', boxShadow: '0 12px 32px rgba(255,109,41,0.35)' }}
        >
          {t.cta}
        </button>
        <p style={{ textAlign: 'center', fontSize: 13, color: MUTED, margin: '12px 0 0' }}>
          {t.ctaSub}
        </p>
        <p style={{ textAlign: 'center', fontSize: 12.5, color: MUTED, margin: '6px 0 0' }}>
          {t.ctaPlan}
        </p>
      </div>
    </div>
  )
}
