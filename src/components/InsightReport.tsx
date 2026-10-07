import { useEffect, useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import { useLang } from '../contexts/LanguageContext'

const ORANGE = '#FF6D29'
const CARD = '#150E08'
const MUTED = '#BABABA'
const D = "'Bricolage Grotesque', system-ui, sans-serif"
const BORDER = 'rgba(255,255,255,0.06)'
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string

export type InsightTabKey = 'avaliacoes' | 'opinioes' | 'concorrentes' | 'crescimento' | 'performance' | 'audiencia' | 'diagnostico'

interface Report {
  summary: string
  suggestions: string[]
  created_at: string
}

const TX = {
  pt: { err: 'Erro ao gerar relatório', title: 'Análise do agente', generating: 'Gerando...', refresh: '↻ Atualizar', generate: '▶ Gerar análise', empty: 'Clique em "Gerar análise" para ver uma interpretação dos dados desta aba e sugestões do que fazer a respeito.' },
  en: { err: 'Error generating report', title: 'Agent analysis', generating: 'Generating...', refresh: '↻ Refresh', generate: '▶ Generate analysis', empty: 'Click "Generate analysis" to see an interpretation of this tab\'s data and suggestions on what to do about it.' },
}

export function InsightReport({ tabKey }: { tabKey: InsightTabKey }) {
  const { session } = useAuth()
  const { lang } = useLang()
  const t = TX[lang]
  const [report, setReport] = useState<Report | null>(null)
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState('')

  const load = async () => {
    if (!session) return
    const { data: company } = await supabase.from('companies').select('id').eq('user_id', session.user.id).maybeSingle()
    if (!company) { setLoading(false); return }
    const { data } = await supabase.from('insights_reports').select('summary, suggestions, created_at').eq('company_id', company.id).eq('tab_key', tabKey).maybeSingle()
    setReport((data as Report | null) ?? null)
    setLoading(false)
  }

  useEffect(() => { load() }, [session, tabKey])

  const generate = async () => {
    if (!session) return
    setGenerating(true)
    setError('')
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/generate-tab-insight`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ tab_key: tabKey }),
      })
      const data = await res.json()
      if (!res.ok || data.error) throw new Error(data.error ?? t.err)
      setReport(data.report as Report)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e))
    }
    setGenerating(false)
  }

  if (loading) return null

  return (
    <div style={{ background: CARD, border: '1px solid rgba(255,109,41,0.2)', borderRadius: '14px', marginBottom: '20px', overflow: 'hidden' }}>
      <div style={{ padding: '14px 20px', borderBottom: `1px solid ${BORDER}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ fontSize: '15px' }}>🧠</span>
          <span style={{ fontFamily: D, fontSize: '13px', fontWeight: 700, color: 'white' }}>{t.title}</span>
          {report?.created_at && (
            <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.3)' }}>· {new Date(report.created_at).toLocaleDateString(lang === 'en' ? 'en-US' : 'pt-BR')}</span>
          )}
        </div>
        <button onClick={generate} disabled={generating}
          style={{ padding: '6px 14px', background: generating ? 'rgba(255,109,41,0.15)' : 'rgba(255,109,41,0.1)', color: ORANGE, fontWeight: 700, fontSize: '11px', borderRadius: '7px', border: '1px solid rgba(255,109,41,0.25)', cursor: generating ? 'not-allowed' : 'pointer', flexShrink: 0 }}>
          {generating ? t.generating : report ? t.refresh : t.generate}
        </button>
      </div>
      <div style={{ padding: '16px 20px' }}>
        {error && <div style={{ fontSize: '12px', color: '#f87171', marginBottom: report ? '10px' : 0 }}>{error}</div>}
        {!report && !error && (
          <div style={{ fontSize: '12.5px', color: MUTED, lineHeight: 1.6 }}>
            {t.empty}
          </div>
        )}
        {report && (
          <>
            <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.85)', lineHeight: 1.7, margin: '0 0 10px' }}>{report.summary}</p>
            {report.suggestions.length > 0 && (
              <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {report.suggestions.map((s, i) => (
                  <li key={i} style={{ fontSize: '12.5px', color: MUTED, lineHeight: 1.6, display: 'flex', gap: '8px' }}>
                    <span style={{ color: ORANGE, flexShrink: 0 }}>→</span>{s}
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </div>
    </div>
  )
}
