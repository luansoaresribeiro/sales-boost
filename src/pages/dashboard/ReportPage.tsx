import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import { useLang } from '../../contexts/LanguageContext'

const ORANGE = '#FF6D29'
const CARD = '#150E08'
const MUTED = '#BABABA'
const D = "'Bricolage Grotesque', system-ui, sans-serif"
const BORDER = 'rgba(255,255,255,0.06)'
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string

interface ReportData {
  health_score: number
  executive_summary: string
  strengths: Array<{ title: string; action: string }>
  complaints: Array<{ title: string; action: string; urgency: string }>
  pricing_recommendation: string
  actions: Array<{ priority: number; title: string; description: string; impact: string }>
}

interface Report {
  id: string
  period: string
  health_score: number | null
  summary_json: ReportData | null
  created_at: string
}

const TX = {
  pt: {
    unknownErr: 'Erro desconhecido', cached: 'Relatório deste mês já gerado. Veja abaixo.', generated: (n: number) => `Relatório gerado! Score de saúde: ${n}/100`,
    loading: 'Carregando...', title: 'Relatório Mensal', period: 'Período:', none: 'Nenhum relatório gerado ainda',
    generatingAi: '✦ Gerando com IA...', generateMonth: '✦ Gerar relatório deste mês',
    emptyTitle: 'Nenhum relatório ainda', emptyDesc: 'O relatório mensal cruza suas avaliações do Google com os concorrentes e gera um plano de ação concreto com IA.',
    emptyHint: 'Recomendado: importe avaliações e mapeie concorrentes antes de gerar.', generating: '✦ Gerando...', generateFirst: '✦ Gerar primeiro relatório →',
    health: 'Score de saúde', healthy: '✓ Saudável', warn: '⚠ Atenção', critical: '↑ Crítico', summary: 'Resumo executivo',
    strengths: '✦ O que amam em você — use no marketing', complaints: '⚠ O que afasta clientes — ação corretiva',
    urgent: 'Urgente', medium: 'Médio', low: 'Baixo', pricing: '💰 Posicionamento de preço vs. concorrentes',
    actions: '🎯 3 Ações do Mês — implemente agora', impact: 'Impacto',
    generatedOn: 'Gerado em', byAi: 'por IA (Claude) · Dados do Google Maps e avaliações importadas',
  },
  en: {
    unknownErr: 'Unknown error', cached: 'This month\'s report was already generated. See below.', generated: (n: number) => `Report generated! Health score: ${n}/100`,
    loading: 'Loading...', title: 'Monthly Report', period: 'Period:', none: 'No report generated yet',
    generatingAi: '✦ Generating with AI...', generateMonth: '✦ Generate this month\'s report',
    emptyTitle: 'No report yet', emptyDesc: 'The monthly report cross-references your Google reviews with competitors and generates a concrete action plan with AI.',
    emptyHint: 'Recommended: import reviews and map competitors before generating.', generating: '✦ Generating...', generateFirst: '✦ Generate first report →',
    health: 'Health score', healthy: '✓ Healthy', warn: '⚠ Attention', critical: '↑ Critical', summary: 'Executive summary',
    strengths: '✦ What they love about you — use it in marketing', complaints: '⚠ What drives customers away — corrective action',
    urgent: 'Urgent', medium: 'Medium', low: 'Low', pricing: '💰 Price positioning vs. competitors',
    actions: '🎯 3 Actions of the Month — implement now', impact: 'Impact',
    generatedOn: 'Generated on', byAi: 'by AI (Claude) · Data from Google Maps and imported reviews',
  },
}

function SectionCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: '14px', overflow: 'hidden', marginBottom: '16px' }}>
      <div style={{ padding: '16px 22px', borderBottom: `1px solid ${BORDER}` }}>
        <span style={{ fontWeight: 700, fontSize: '14px', color: 'white' }}>{title}</span>
      </div>
      <div style={{ padding: '20px 22px' }}>{children}</div>
    </div>
  )
}

function scoreColor(s: number) {
  return s >= 75 ? '#4ade80' : s >= 50 ? '#FBBF24' : '#f87171'
}

export default function ReportPage() {
  const { user, session } = useAuth()
  const { lang } = useLang()
  const t = TX[lang]
  const [report, setReport] = useState<Report | null>(null)
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [msg, setMsg] = useState('')
  const [err, setErr] = useState('')

  const loadReport = async () => {
    if (!user) return
    setLoading(true)
    const { data: company } = await supabase
      .from('companies')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle()

    if (company) {
      const { data } = await supabase
        .from('reports')
        .select('id, period, health_score, summary_json, created_at')
        .eq('company_id', company.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      setReport(data as Report | null)
    }
    setLoading(false)
  }

  useEffect(() => { loadReport() }, [user])

  const generate = async () => {
    if (!session) return
    setGenerating(true)
    setMsg('')
    setErr('')
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/generate-report`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? t.unknownErr)
      setMsg(data.cached ? t.cached : t.generated(data.health_score))
      await loadReport()
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : String(e))
    }
    setGenerating(false)
  }

  const periodLabel = (period: string) => {
    const [y, m] = period.split('-')
    return new Date(Number(y), Number(m) - 1).toLocaleString(lang === 'en' ? 'en-US' : 'pt-BR', { month: 'long', year: 'numeric' })
  }

  if (loading) return <div style={{ padding: '28px 32px', color: MUTED, fontSize: '14px' }}>{t.loading}</div>

  const d = report?.summary_json
  const hs = report?.health_score
  const hsColor = hs != null ? scoreColor(hs) : MUTED

  return (
    <div>
      <div style={{ padding: '28px 32px 24px', borderBottom: `1px solid ${BORDER}`, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontFamily: D, fontSize: '1.5rem', fontWeight: 800, color: 'white', letterSpacing: '-0.02em', marginBottom: '4px' }}>{t.title}</h1>
          <p style={{ color: MUTED, fontSize: '13px' }}>
            {report ? `${t.period} ${periodLabel(report.period)}` : t.none}
          </p>
        </div>
        <button
          onClick={generate}
          disabled={generating}
          style={{ padding: '9px 18px', background: generating ? 'rgba(255,109,41,0.3)' : ORANGE, color: '#000', fontWeight: 700, fontSize: '13px', borderRadius: '9px', border: 'none', cursor: generating ? 'not-allowed' : 'pointer' }}>
          {generating ? t.generatingAi : t.generateMonth}
        </button>
      </div>

      <div style={{ padding: '24px 32px' }}>
        {(msg || err) && (
          <div style={{ marginBottom: '16px', padding: '12px 16px', background: err ? 'rgba(248,113,113,0.08)' : 'rgba(74,222,128,0.08)', border: `1px solid ${err ? 'rgba(248,113,113,0.2)' : 'rgba(74,222,128,0.2)'}`, borderRadius: '10px', fontSize: '13px', color: err ? '#f87171' : '#4ade80', lineHeight: 1.5 }}>
            {err || msg}
          </div>
        )}

        {!report ? (
          <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: '14px', padding: '60px 32px', textAlign: 'center' }}>
            <div style={{ fontSize: '2.5rem', marginBottom: '12px' }}>📋</div>
            <div style={{ fontFamily: D, fontSize: '1.2rem', fontWeight: 800, color: 'white', marginBottom: '8px' }}>{t.emptyTitle}</div>
            <div style={{ fontSize: '14px', color: MUTED, maxWidth: '440px', margin: '0 auto 8px', lineHeight: 1.7 }}>
              {t.emptyDesc}
            </div>
            <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.25)', marginBottom: '28px' }}>
              {t.emptyHint}
            </div>
            <button onClick={generate} disabled={generating}
              style={{ padding: '11px 24px', background: ORANGE, color: '#000', fontWeight: 700, fontSize: '14px', borderRadius: '10px', border: 'none', cursor: generating ? 'not-allowed' : 'pointer' }}>
              {generating ? t.generating : t.generateFirst}
            </button>
          </div>
        ) : (
          <>
            {/* Section 1 — Score + Resumo */}
            <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: '16px', padding: '28px', marginBottom: '16px', display: 'flex', gap: '32px', alignItems: 'flex-start', flexWrap: 'wrap' }}>
              <div style={{ textAlign: 'center', flexShrink: 0 }}>
                <div style={{ fontFamily: D, fontSize: '5rem', fontWeight: 900, color: hsColor, lineHeight: 1, letterSpacing: '-0.04em' }}>{hs ?? '—'}</div>
                <div style={{ fontSize: '11px', color: MUTED, marginTop: '4px' }}>{t.health}</div>
                <div style={{ marginTop: '10px', width: '100px', height: '6px', borderRadius: '99px', background: 'rgba(255,255,255,0.06)', overflow: 'hidden', margin: '10px auto 0' }}>
                  <div style={{ width: `${hs ?? 0}%`, height: '100%', background: hsColor, borderRadius: '99px' }} />
                </div>
                <div style={{ fontSize: '11px', color: hsColor, marginTop: '6px' }}>
                  {hs != null ? (hs >= 75 ? t.healthy : hs >= 50 ? t.warn : t.critical) : ''}
                </div>
              </div>
              <div style={{ flex: 1, minWidth: '240px' }}>
                <div style={{ fontSize: '11px', color: MUTED, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '10px' }}>{t.summary}</div>
                <p style={{ fontSize: '14px', color: 'white', lineHeight: 1.7, margin: 0 }}>{d?.executive_summary ?? '—'}</p>
              </div>
            </div>

            {/* Section 2 — Pontos fortes */}
            {d?.strengths && d.strengths.length > 0 && (
              <SectionCard title={t.strengths}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  {d.strengths.map((s, i) => (
                    <div key={i} style={{ display: 'flex', gap: '14px', alignItems: 'flex-start' }}>
                      <div style={{ width: '28px', height: '28px', borderRadius: '8px', background: 'rgba(74,222,128,0.1)', border: '1px solid rgba(74,222,128,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', fontWeight: 800, color: '#4ade80', flexShrink: 0 }}>
                        {i + 1}
                      </div>
                      <div>
                        <div style={{ fontSize: '13px', fontWeight: 700, color: 'white', marginBottom: '4px' }}>✓ {s.title}</div>
                        <div style={{ fontSize: '12px', color: MUTED, lineHeight: 1.6 }}>↳ {s.action}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </SectionCard>
            )}

            {/* Section 3 — Reclamações */}
            {d?.complaints && d.complaints.length > 0 && (
              <SectionCard title={t.complaints}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  {d.complaints.map((c, i) => (
                    <div key={i} style={{ display: 'flex', gap: '14px', alignItems: 'flex-start' }}>
                      <span style={{ padding: '3px 8px', borderRadius: '6px', background: c.urgency === 'high' ? 'rgba(248,113,113,0.12)' : 'rgba(251,191,36,0.1)', border: `1px solid ${c.urgency === 'high' ? 'rgba(248,113,113,0.25)' : 'rgba(251,191,36,0.2)'}`, fontSize: '10px', fontWeight: 700, color: c.urgency === 'high' ? '#f87171' : '#FBBF24', whiteSpace: 'nowrap', marginTop: '2px' }}>
                        {c.urgency === 'high' ? t.urgent : c.urgency === 'medium' ? t.medium : t.low}
                      </span>
                      <div>
                        <div style={{ fontSize: '13px', fontWeight: 700, color: 'white', marginBottom: '4px' }}>{c.title}</div>
                        <div style={{ fontSize: '12px', color: MUTED, lineHeight: 1.6 }}>↳ {c.action}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </SectionCard>
            )}

            {/* Section 4 — Preços */}
            {d?.pricing_recommendation && (
              <SectionCard title={t.pricing}>
                <p style={{ fontSize: '13px', color: MUTED, lineHeight: 1.7, margin: 0 }}>{d.pricing_recommendation}</p>
              </SectionCard>
            )}

            {/* Section 5 — 3 Ações do Mês */}
            {d?.actions && d.actions.length > 0 && (
              <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: '14px', overflow: 'hidden', marginBottom: '16px' }}>
                <div style={{ padding: '16px 22px', borderBottom: `1px solid ${BORDER}` }}>
                  <span style={{ fontWeight: 700, fontSize: '14px', color: 'white' }}>{t.actions}</span>
                </div>
                {d.actions.map((a, i) => (
                  <div key={i} style={{ padding: '20px 22px', borderBottom: i < d.actions.length - 1 ? `1px solid ${BORDER}` : 'none', display: 'flex', gap: '18px', alignItems: 'flex-start' }}>
                    <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'rgba(255,109,41,0.1)', border: '1px solid rgba(255,109,41,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: D, fontSize: '1.1rem', fontWeight: 900, color: ORANGE, flexShrink: 0 }}>
                      {String(a.priority).padStart(2, '0')}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px', flexWrap: 'wrap' }}>
                        <span style={{ fontSize: '14px', fontWeight: 700, color: 'white' }}>{a.title}</span>
                        <span style={{ fontSize: '10px', padding: '2px 8px', borderRadius: '99px', background: 'rgba(255,109,41,0.1)', color: ORANGE, fontWeight: 700, border: '1px solid rgba(255,109,41,0.2)' }}>{t.impact} {a.impact}</span>
                      </div>
                      <p style={{ fontSize: '13px', color: MUTED, lineHeight: 1.65, margin: 0 }}>{a.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.2)', textAlign: 'right' }}>
              {t.generatedOn} {new Date(report.created_at).toLocaleDateString(lang === 'en' ? 'en-US' : 'pt-BR')} {t.byAi}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
