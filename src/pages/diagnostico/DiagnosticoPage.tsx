import { useState, useEffect, useMemo } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import {
  computeGrowthScore, CRITERIA_WEIGHTS, CRITERIA_INFO, VERDICT_BANDS,
  type InstagramData, type Verdict, type CriterionKey,
} from '../../lib/growthScore'

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

function Ring({ score, color, label }: { score: number | null; color: string; label: string }) {
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
        {score !== null ? score : 'Análise parcial'}
      </div>
    </div>
  )
}

const FLOW = ['Diagnóstico', 'Oportunidades', 'Plano', 'Ativar']

export default function DiagnosticoPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [diag, setDiag] = useState<Diagnostic | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [waited, setWaited] = useState(0)

  useEffect(() => {
    if (!id) return
    let alive = true
    supabase.from('diagnostics').select('*').eq('id', id).single().then(({ data, error: err }) => {
      if (!alive) return
      if (err || !data) setError('Diagnóstico não encontrado.')
      else setDiag(data as Diagnostic)
      setLoading(false)
    })
    return () => { alive = false }
  }, [id])

  // Coleta do Instagram em andamento: recarrega a cada ~5s por até ~90s.
  const collecting = !!diag && !diag.instagram_data && diag.status === 'processing' && waited < POLL_MAX_MS
  useEffect(() => {
    if (!collecting || !id) return
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
  }) : null, [diag])

  if (loading) return (
    <div style={{ minHeight: '100vh', background: BG, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: 40, height: 40, border: '3px solid rgba(255,109,41,0.15)', borderTopColor: ORANGE, borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )

  if (error || !diag || !result) return (
    <div style={{ minHeight: '100vh', background: BG, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, padding: 24, textAlign: 'center' }}>
      <div style={{ color: 'white', fontSize: 18, fontWeight: 700 }}>Diagnóstico não encontrado</div>
      <Link to="/onboarding" style={{ color: ORANGE, textDecoration: 'none', fontSize: 14 }}>← Criar novo diagnóstico</Link>
    </div>
  )

  const color = VERDICT_COLOR[result.verdict ?? 'partial']
  const partial = result.state === 'partial'
  const igRow = ['frequency', 'engagement', 'format', 'profile'].map(k => result.criteria.find(c => c.key === k)!)
  const noIgYet = collecting // ainda coletando
  const ringLabel = partial ? 'Análise parcial' : `Nota ${result.score} de 100`

  return (
    <div style={{ minHeight: '100vh', background: BG, overflowX: 'hidden' }}>
      <div style={{ padding: '16px', borderBottom: `1px solid ${BORDER}` }}>
        <a href="/" style={{ fontFamily: D, fontSize: '1.3rem', fontWeight: 900, color: 'white', textDecoration: 'none', letterSpacing: '-0.02em' }}>
          <span style={{ color: ORANGE }}>Sales</span>Boost
        </a>
      </div>

      <div style={{ maxWidth: 640, margin: '0 auto', padding: '28px 16px 64px' }}>
        {/* Fluxo */}
        <ol style={{ listStyle: 'none', display: 'flex', flexWrap: 'wrap', gap: 6, padding: 0, margin: '0 0 24px', fontSize: 11, fontWeight: 700 }}>
          {FLOW.map((f, i) => (
            <li key={f} style={{ padding: '4px 10px', borderRadius: 99, background: i === 0 ? 'rgba(255,109,41,0.15)' : 'rgba(255,255,255,0.04)', color: i === 0 ? ORANGE : MUTED, border: `1px solid ${i === 0 ? 'rgba(255,109,41,0.35)' : BORDER}` }}>
              {i + 1}. {f}
            </li>
          ))}
        </ol>

        <div style={{ fontSize: 12, fontWeight: 700, color: ORANGE, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>
          Descubra seu Growth Potential
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
              <div style={{ color: 'white', fontWeight: 700, marginBottom: 6 }}>Analisando seu Instagram…</div>
              <div style={{ color: MUTED, fontSize: 13 }}>Isso leva alguns segundos. A tela atualiza sozinha.</div>
            </div>
          ) : (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 18, flexWrap: 'wrap' }}>
                <Ring score={result.score} color={color} label={ringLabel} />
                <div style={{ flex: '1 1 160px', minWidth: 0 }}>
                  <span style={{ display: 'inline-block', padding: '5px 14px', borderRadius: 99, fontSize: 13, fontWeight: 800, color, background: `${color}1f`, border: `1px solid ${color}55`, marginBottom: 10 }}>
                    {result.verdictLabel ?? 'Análise parcial'}
                  </span>
                  <div style={{ fontSize: 13, color: MUTED, lineHeight: 1.6 }}>
                    Cobertura: <strong style={{ color: 'white' }}>{result.coverage}%</strong> dos critérios avaliados
                  </div>
                  {partial && (
                    <div style={{ fontSize: 12, color: MUTED, lineHeight: 1.6, marginTop: 6 }}>
                      Não conseguimos avaliar critérios suficientes pra dar uma nota. Não inventamos números: o que falta fica de fora.
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
            <h2 style={{ fontFamily: D, fontSize: '1.05rem', fontWeight: 800, color: 'white', margin: '0 0 6px' }}>Como sua nota foi formada</h2>
            {diag.instagram_data?.error && (
              <p style={{ fontSize: 12, color: MUTED, margin: '0 0 6px', lineHeight: 1.5 }}>
                Não conseguimos ler seu Instagram agora (perfil privado ou fora do ar). Os itens dele ficaram sem avaliação.
              </p>
            )}
            {!diag.instagram_data && (
              <p style={{ fontSize: 12, color: MUTED, margin: '0 0 6px', lineHeight: 1.5 }}>
                Este diagnóstico não tem a leitura do Instagram.
              </p>
            )}
            {[...igRow, ...result.criteria.filter(c => c.key === 'addon')].map(c => (
              <div key={c.key} style={{ padding: '12px 0', borderTop: `1px solid ${BORDER}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'baseline' }}>
                  <span style={{ fontSize: 14, fontWeight: 700, color: 'white' }}>{c.label}</span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: c.evaluated ? ORANGE : MUTED, whiteSpace: 'nowrap' }}>
                    {c.evaluated ? `${String(c.points).replace('.', ',')} de ${c.weight}` : 'Não avaliado'}
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
          <summary style={{ cursor: 'pointer', minHeight: 44, display: 'flex', alignItems: 'center', fontSize: 14, fontWeight: 700, color: 'white' }}>▸ Como calculamos</summary>
          <div style={{ paddingBottom: 14 }}>
            <p style={{ fontSize: 12.5, color: MUTED, lineHeight: 1.6, margin: '0 0 10px' }}>
              A nota vem do seu Instagram. Site e Google só somam se existirem. O que não conseguimos ver fica
              "não avaliado" e sai da conta — nada é inventado nem penaliza você.
            </p>
            {(Object.keys(CRITERIA_WEIGHTS) as CriterionKey[]).map(k => (
              <div key={k} style={{ padding: '8px 0', borderTop: `1px solid ${BORDER}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, fontSize: 13, color: 'white', fontWeight: 700 }}>
                  <span>{CRITERIA_INFO[k].label}</span><span>{CRITERIA_WEIGHTS[k]} pts</span>
                </div>
                <div style={{ fontSize: 12, color: MUTED, lineHeight: 1.5, marginTop: 2 }}>{CRITERIA_INFO[k].rule}</div>
              </div>
            ))}
            <p style={{ fontSize: 12.5, color: MUTED, lineHeight: 1.6, margin: '10px 0 6px' }}>
              Nota = pontos dos critérios avaliados ÷ pontos possíveis deles × 100.
              Com menos de 40% dos critérios avaliados, mostramos "Análise parcial", sem veredito.
            </p>
            {VERDICT_BANDS.map(b => (
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
          Ativar meu acesso grátis →
        </button>
        <p style={{ textAlign: 'center', fontSize: 13, color: MUTED, margin: '12px 0 0' }}>
          Sem cartão. Sem prazo em dias. Inclui 1 estratégia.
        </p>
      </div>
    </div>
  )
}
