import { useEffect, useState } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import {
  STATUS_LABELS, STATUS_COLORS, scoreColor, recommendationTier,
  type Prospect, type Activity, type ScanLog, type QueryLogRow, type CandidateLogRow,
} from './prospectShared'

const ORANGE = '#FF6D29'
const BG = '#0E0B0A'
const CARD = '#150E08'
const MUTED = '#BABABA'
const BORDER = 'rgba(255,255,255,0.06)'
const D = "'Bricolage Grotesque', system-ui, sans-serif"
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string

export default function ProspectsPage() {
  const { session, signOut } = useAuth()
  const navigate = useNavigate()
  const [prospects, setProspects] = useState<Prospect[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [activities, setActivities] = useState<Activity[]>([])
  const [newNote, setNewNote] = useState('')

  const [lastScan, setLastScan] = useState<ScanLog | null>(null)
  const [scanning, setScanning] = useState(false)
  const [scanError, setScanError] = useState('')

  const [historyOpen, setHistoryOpen] = useState(false)
  const [queryLog, setQueryLog] = useState<QueryLogRow[]>([])
  const [candidateLog, setCandidateLog] = useState<CandidateLogRow[]>([])
  const [candidateFilter, setCandidateFilter] = useState<'all' | 'accepted' | 'rejected'>('all')
  const [historyLoading, setHistoryLoading] = useState(false)

  useEffect(() => {
    if (!session) return
    void loadAll()
  }, [session])

  // Busca "em andamento" há mais de 10 min foi cortada pelo limite de tempo da
  // função (o próximo disparo fecha o registro como erro) — mostra "Interrompida".
  const withStale = (s: ScanLog): ScanLog =>
    s.status === 'running' && Date.now() - new Date(s.started_at).getTime() > 10 * 60_000 ? { ...s, status: 'interrupted' } : s

  const loadAll = async () => {
    setLoading(true)
    const [{ data: prospectsData }, { data: scanData }] = await Promise.all([
      supabase.from('sales_prospects').select('*').order('lead_score', { ascending: false, nullsFirst: false }),
      supabase.from('prospect_scan_log').select('*').order('started_at', { ascending: false }).limit(1).maybeSingle(),
    ])
    setProspects((prospectsData ?? []) as Prospect[])
    if (scanData) {
      const scan = withStale(scanData as ScanLog)
      setLastScan(scan)
      if (scan.status === 'running') pollScan()
    }
    setLoading(false)
  }

  const pollScan = () => {
    setScanning(true)
    const interval = setInterval(async () => {
      const { data } = await supabase.from('prospect_scan_log').select('*').order('started_at', { ascending: false }).limit(1).maybeSingle()
      if (data) {
        const scan = withStale(data as ScanLog)
        setLastScan(scan)
        if (scan.status !== 'running') {
          clearInterval(interval)
          setScanning(false)
          void loadAll()
        }
      }
    }, 4000)
  }

  const runScanNow = async () => {
    if (!session) return
    setScanning(true)
    setScanError('')
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/find-sales-leads`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      const data = await res.json()
      if (!res.ok || data.error) throw new Error(data.error ?? 'Erro ao iniciar a busca')
      pollScan()
    } catch (e) {
      setScanError(e instanceof Error ? e.message : String(e))
      setScanning(false)
    }
  }

  const toggleExpand = async (id: string) => {
    if (expandedId === id) { setExpandedId(null); return }
    setExpandedId(id)
    const { data } = await supabase.from('prospect_activities').select('*').eq('prospect_id', id).order('created_at', { ascending: false })
    setActivities((data ?? []) as Activity[])
  }

  const changeStatus = async (id: string, status: string) => {
    await supabase.from('sales_prospects').update({ status, updated_at: new Date().toISOString() }).eq('id', id)
    setProspects(prev => prev.map(p => p.id === id ? { ...p, status } : p))
    await supabase.from('prospect_activities').insert({ prospect_id: id, activity_type: 'status_change', notes: `Status alterado para "${STATUS_LABELS[status] ?? status}"` })
    if (expandedId === id) {
      const { data } = await supabase.from('prospect_activities').select('*').eq('prospect_id', id).order('created_at', { ascending: false })
      setActivities((data ?? []) as Activity[])
    }
  }

  const addNote = async (id: string) => {
    if (!newNote.trim()) return
    await supabase.from('prospect_activities').insert({ prospect_id: id, activity_type: 'note', notes: newNote.trim() })
    setNewNote('')
    const { data } = await supabase.from('prospect_activities').select('*').eq('prospect_id', id).order('created_at', { ascending: false })
    setActivities((data ?? []) as Activity[])
  }

  const loadHistory = async (scanLogId: string) => {
    setHistoryLoading(true)
    const [{ data: qData }, { data: cData }] = await Promise.all([
      supabase.from('prospect_search_query_log').select('*').eq('scan_log_id', scanLogId).order('companies_found', { ascending: false }),
      supabase.from('prospect_candidate_log').select('*').eq('scan_log_id', scanLogId).order('checked_at', { ascending: false }).limit(300),
    ])
    setQueryLog((qData ?? []) as QueryLogRow[])
    setCandidateLog((cData ?? []) as CandidateLogRow[])
    setHistoryLoading(false)
  }

  const toggleHistory = () => {
    const next = !historyOpen
    setHistoryOpen(next)
    if (next && lastScan) void loadHistory(lastScan.id)
  }

  const filtered = statusFilter === 'all' ? prospects : prospects.filter(p => p.status === statusFilter)
  const totalQualified = prospects.filter(p => p.status === 'qualified' || p.status === 'converted').length

  return (
    <div style={{ minHeight: '100vh', background: BG }}>
      <div style={{ borderBottom: `1px solid ${BORDER}`, padding: '16px 32px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button onClick={() => navigate('/owner')} style={{ background: 'transparent', border: 'none', color: MUTED, fontSize: '18px', cursor: 'pointer', padding: '4px' }}>←</button>
          <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: ORANGE, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ color: '#000', fontWeight: 900, fontSize: '11px' }}>SB</span>
          </div>
          <div>
            <span style={{ fontFamily: D, fontSize: '1rem', fontWeight: 800, color: 'white' }}>SalesBoost</span>
            <span style={{ fontSize: '11px', marginLeft: '10px', padding: '2px 8px', background: 'rgba(255,109,41,0.1)', borderRadius: '99px', border: '1px solid rgba(255,109,41,0.2)', color: ORANGE }}>Prospecção</span>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <button onClick={() => navigate('/owner/prospects/settings')} title="Configurações da busca de leads"
            style={{ padding: '7px 16px', background: 'transparent', border: `1px solid ${BORDER}`, borderRadius: '8px', color: MUTED, fontSize: '12px', cursor: 'pointer' }}>
            ⚙ Configurações
          </button>
          <button onClick={async () => { await signOut(); navigate('/') }}
            style={{ padding: '7px 16px', background: 'transparent', border: `1px solid ${BORDER}`, borderRadius: '8px', color: MUTED, fontSize: '12px', cursor: 'pointer' }}>
            Sair
          </button>
        </div>
      </div>

      <div style={{ padding: '32px' }}>
        <div style={{ marginBottom: '24px', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '20px', flexWrap: 'wrap' }}>
          <div>
            <h1 style={{ fontFamily: D, fontSize: '1.8rem', fontWeight: 900, color: 'white', letterSpacing: '-0.03em', marginBottom: '4px' }}>Leads para o Sales Boost</h1>
            <p style={{ color: MUTED, fontSize: '14px' }}>Negócios achados e pontuados por IA — ainda não são clientes.</p>
          </div>
          <button onClick={runScanNow} disabled={scanning}
            style={{ padding: '11px 22px', background: scanning ? 'rgba(255,109,41,0.15)' : ORANGE, color: scanning ? ORANGE : '#000', fontWeight: 700, fontSize: '13.5px', borderRadius: '10px', border: scanning ? '1px solid rgba(255,109,41,0.3)' : 'none', cursor: scanning ? 'not-allowed' : 'pointer', flexShrink: 0 }}>
            {scanning ? '🔎 Buscando...' : '🔎 Buscar leads agora'}
          </button>
        </div>

        {/* Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '20px' }}>
          <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: '12px', padding: '16px 18px' }}>
            <div style={{ fontSize: '10.5px', fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '6px' }}>Total de leads</div>
            <div style={{ fontFamily: D, fontSize: '1.6rem', fontWeight: 900, color: 'white' }}>{prospects.length}</div>
          </div>
          <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: '12px', padding: '16px 18px' }}>
            <div style={{ fontSize: '10.5px', fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '6px' }}>Qualificados</div>
            <div style={{ fontFamily: D, fontSize: '1.6rem', fontWeight: 900, color: '#4ade80' }}>{totalQualified}</div>
          </div>
          <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: '12px', padding: '16px 18px' }}>
            <div style={{ fontSize: '10.5px', fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '6px' }}>Novos</div>
            <div style={{ fontFamily: D, fontSize: '1.6rem', fontWeight: 900, color: ORANGE }}>{prospects.filter(p => p.status === 'new').length}</div>
          </div>
          <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: '12px', padding: '16px 18px' }}>
            <div style={{ fontSize: '10.5px', fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '6px' }}>Última varredura</div>
            {lastScan ? (
              <div style={{ fontSize: '12.5px', color: 'rgba(255,255,255,0.85)', lineHeight: 1.5 }}>
                {new Date(lastScan.started_at).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                <div style={{ color: lastScan.status === 'error' || lastScan.status === 'interrupted' ? '#f87171' : lastScan.status === 'running' ? '#FBBF24' : '#4ade80', fontWeight: 700, marginTop: '2px' }}>
                  {lastScan.status === 'running' ? 'Em andamento' : lastScan.status === 'interrupted' ? 'Interrompida' : lastScan.status === 'error' ? 'Erro' : `${lastScan.found_count} encontrados`}
                </div>
              </div>
            ) : <div style={{ fontSize: '12.5px', color: MUTED }}>Nenhuma ainda</div>}
          </div>
        </div>

        {scanError && (
          <div style={{ marginBottom: '16px', padding: '10px 14px', background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.25)', borderRadius: '9px', fontSize: '12.5px', color: '#f87171' }}>{scanError}</div>
        )}

        {lastScan && lastScan.status === 'running' && (
          <div style={{ marginBottom: '20px', background: CARD, border: `1px solid ${BORDER}`, borderRadius: '12px', padding: '16px 20px' }}>
            <div style={{ fontSize: '12px', color: MUTED, marginBottom: '8px' }}>
              {lastScan.candidates_total > 0
                ? `Analisando ${Math.min(lastScan.candidates_processed, lastScan.candidates_total)} de ${lastScan.candidates_total} negócios encontrados — ${lastScan.found_count} leads confirmados até agora`
                : 'Buscando negócios na região...'}
            </div>
            <div style={{ width: '100%', height: '8px', borderRadius: '99px', background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
              <div style={{
                height: '100%', borderRadius: '99px', background: ORANGE, transition: 'width 0.6s ease',
                width: lastScan.candidates_total > 0
                  ? `${Math.min(100, Math.round((lastScan.candidates_processed / lastScan.candidates_total) * 100))}%`
                  : '15%',
                ...(lastScan.candidates_total === 0 ? { animation: 'pulseBar 1.4s ease-in-out infinite' } : {}),
              }} />
            </div>
            <style>{`@keyframes pulseBar { 0%, 100% { opacity: 0.4 } 50% { opacity: 1 } }`}</style>
          </div>
        )}

        {/* Search history / debug */}
        <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: '14px', padding: '18px 24px', marginBottom: '20px' }}>
          <div onClick={toggleHistory} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}>
            <div>
              <div style={{ fontSize: '13px', fontWeight: 700, color: 'white' }}>🔍 Histórico da última varredura</div>
              <div style={{ fontSize: '11.5px', color: MUTED, marginTop: '2px' }}>Busca por busca: quantos negócios foram achados, aceitos e rejeitados — e o motivo de cada rejeição.</div>
            </div>
            <span style={{ color: MUTED, fontSize: '13px' }}>{historyOpen ? '▲' : '▼'}</span>
          </div>

          {historyOpen && (
            <div style={{ marginTop: '18px', paddingTop: '18px', borderTop: `1px solid ${BORDER}` }}>
              {!lastScan ? (
                <div style={{ color: MUTED, fontSize: '12.5px' }}>Nenhuma varredura rodou ainda.</div>
              ) : historyLoading ? (
                <div style={{ color: MUTED, fontSize: '12.5px' }}>Carregando...</div>
              ) : (
                <>
                  <div style={{ fontSize: '11px', fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '10px' }}>Estatística por busca</div>
                  {queryLog.length === 0 ? (
                    <div style={{ color: MUTED, fontSize: '12.5px', marginBottom: '20px' }}>Sem dados de busca pra essa varredura.</div>
                  ) : (
                    <div style={{ overflowX: 'auto', marginBottom: '24px' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                        <thead>
                          <tr style={{ color: MUTED, textAlign: 'left' }}>
                            <th style={{ padding: '6px 10px', fontWeight: 600 }}>Cidade</th>
                            <th style={{ padding: '6px 10px', fontWeight: 600 }}>Categoria</th>
                            <th style={{ padding: '6px 10px', fontWeight: 600 }}>Palavra-chave</th>
                            <th style={{ padding: '6px 10px', fontWeight: 600 }}>Achados</th>
                            <th style={{ padding: '6px 10px', fontWeight: 600 }}>Rejeitados</th>
                            <th style={{ padding: '6px 10px', fontWeight: 600 }}>Aceitos</th>
                            <th style={{ padding: '6px 10px', fontWeight: 600 }}>Score médio</th>
                            <th style={{ padding: '6px 10px', fontWeight: 600 }}>Tempo</th>
                          </tr>
                        </thead>
                        <tbody>
                          {queryLog.map(q => (
                            <tr key={q.id} style={{ borderTop: `1px solid ${BORDER}` }}>
                              <td style={{ padding: '6px 10px', color: 'white' }}>{q.city}</td>
                              <td style={{ padding: '6px 10px', color: 'rgba(255,255,255,0.8)' }}>{q.business_type}</td>
                              <td style={{ padding: '6px 10px', color: 'rgba(255,255,255,0.8)' }}>{q.keyword}</td>
                              <td style={{ padding: '6px 10px', color: MUTED }}>{q.companies_found}</td>
                              <td style={{ padding: '6px 10px', color: '#f87171' }}>{q.companies_rejected}</td>
                              <td style={{ padding: '6px 10px', color: '#4ade80' }}>{q.companies_accepted}</td>
                              <td style={{ padding: '6px 10px', color: MUTED }}>{q.avg_lead_score ?? '—'}</td>
                              <td style={{ padding: '6px 10px', color: 'rgba(255,255,255,0.35)' }}>{q.search_time_ms != null ? `${(q.search_time_ms / 1000).toFixed(1)}s` : '—'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                    <div style={{ fontSize: '11px', fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Candidatos examinados</div>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      {(['all', 'accepted', 'rejected'] as const).map(f => (
                        <button key={f} onClick={() => setCandidateFilter(f)}
                          style={{ padding: '4px 12px', borderRadius: '99px', border: 'none', cursor: 'pointer', fontSize: '11px', fontWeight: 600, background: candidateFilter === f ? 'rgba(255,109,41,0.2)' : 'rgba(255,255,255,0.05)', color: candidateFilter === f ? ORANGE : MUTED }}>
                          {f === 'all' ? 'Todos' : f === 'accepted' ? 'Aceitos' : 'Rejeitados'}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', maxHeight: '360px', overflowY: 'auto' }}>
                    {candidateLog.filter(c => candidateFilter === 'all' || c.status === candidateFilter).map(c => (
                      <div key={c.id} style={{ display: 'flex', gap: '10px', alignItems: 'center', padding: '7px 10px', background: 'rgba(255,255,255,0.03)', borderRadius: '7px', fontSize: '12px' }}>
                        <span style={{ color: c.status === 'accepted' ? '#4ade80' : '#f87171', fontWeight: 700, width: '16px', flexShrink: 0 }}>{c.status === 'accepted' ? '✓' : '✗'}</span>
                        <span style={{ color: 'white', flexShrink: 0, minWidth: '160px' }}>{c.business_name ?? '(sem nome)'}</span>
                        <span style={{ color: MUTED, flex: 1 }}>{c.status === 'accepted' ? `Score ${c.lead_score ?? '—'}, confiança ${c.icp_confidence ?? '—'}%` : c.rejection_reason}</span>
                        <span style={{ color: 'rgba(255,255,255,0.3)', flexShrink: 0, fontSize: '11px' }}>{c.search_keyword}</span>
                      </div>
                    ))}
                    {candidateLog.filter(c => candidateFilter === 'all' || c.status === candidateFilter).length === 0 && (
                      <div style={{ color: MUTED, fontSize: '12.5px' }}>Nenhum candidato nessa categoria.</div>
                    )}
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        {/* Status filter */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
          {['all', 'new', 'contacted', 'qualified', 'converted', 'discarded'].map(s => (
            <button key={s} onClick={() => setStatusFilter(s)}
              style={{ padding: '6px 14px', borderRadius: '99px', border: 'none', cursor: 'pointer', fontSize: '12px', fontWeight: 600, background: statusFilter === s ? 'rgba(255,109,41,0.2)' : 'rgba(255,255,255,0.05)', color: statusFilter === s ? ORANGE : MUTED }}>
              {s === 'all' ? 'Todos' : STATUS_LABELS[s]} {s !== 'all' ? `(${prospects.filter(p => p.status === s).length})` : `(${prospects.length})`}
            </button>
          ))}
        </div>

        {/* List */}
        {loading ? (
          <div style={{ color: MUTED, fontSize: '14px', padding: '32px' }}>Carregando...</div>
        ) : filtered.length === 0 ? (
          <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: '14px', padding: '48px 32px', textAlign: 'center', color: MUTED, fontSize: '13px' }}>
            Nenhum lead ainda. Configure cidade e categorias em <button onClick={() => navigate('/owner/prospects/settings')} style={{ background: 'none', border: 'none', color: ORANGE, cursor: 'pointer', fontSize: '13px', textDecoration: 'underline', padding: 0 }}>Configurações</button> e clique em "Buscar leads agora".
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {filtered.map(p => (
              <div key={p.id} style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: '12px', overflow: 'hidden' }}>
                <div onClick={() => toggleExpand(p.id)} style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: '16px', cursor: 'pointer' }}>
                  <div style={{ fontFamily: D, fontSize: '1.4rem', fontWeight: 900, color: p.lead_score != null ? scoreColor(p.lead_score) : MUTED, width: '52px', textAlign: 'center', flexShrink: 0 }}>
                    {p.lead_score ?? '—'}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '14px', fontWeight: 700, color: 'white' }}>{p.business_name}</div>
                    <div style={{ fontSize: '12px', color: MUTED, marginTop: '2px' }}>
                      {p.google_rating ? `${p.google_rating}★ (${p.google_review_count ?? 0} avaliações)` : 'sem nota'} · {p.address ?? 'endereço desconhecido'}
                      {p.price_level != null && <> · {'$'.repeat(p.price_level + 1)}</>}
                    </div>
                    {p.lead_score != null && (
                      <div style={{ marginTop: '4px', display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <span style={{ fontSize: '10.5px', fontWeight: 700, color: recommendationTier(p.lead_score).color }}>{recommendationTier(p.lead_score).label}</span>
                        {p.icp_confidence != null && <span style={{ fontSize: '10.5px', color: 'rgba(255,255,255,0.35)' }}>confiança ICP: {p.icp_confidence}%</span>}
                      </div>
                    )}
                  </div>
                  <span style={{ fontSize: '11px', fontWeight: 700, padding: '4px 12px', borderRadius: '99px', background: `${STATUS_COLORS[p.status]}22`, color: STATUS_COLORS[p.status], flexShrink: 0 }}>
                    {STATUS_LABELS[p.status] ?? p.status}
                  </span>
                </div>

                {expandedId === p.id && (
                  <div style={{ padding: '0 20px 20px', borderTop: `1px solid ${BORDER}` }}>
                    <div style={{ paddingTop: '16px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                      <div>
                        <div style={{ fontSize: '11px', fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '6px' }}>Diagnóstico da IA</div>
                        <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.85)', lineHeight: 1.7, margin: '0 0 12px' }}>{p.ai_summary ?? 'Sem diagnóstico ainda.'}</p>
                        <div style={{ fontSize: '11px', fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '6px' }}>Roteiro de abordagem</div>
                        <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.85)', lineHeight: 1.7, margin: '0 0 12px' }}>{p.ai_cold_call_notes ?? 'Sem roteiro ainda.'}</p>

                        {p.score_breakdown && p.score_breakdown.length > 0 && (
                          <>
                            <div style={{ fontSize: '11px', fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '6px' }}>
                              Por que esse score ({p.lead_score}/100{p.icp_confidence != null ? ` · confiança ICP ${p.icp_confidence}%` : ''})
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                              {p.score_breakdown.map((item, i) => (
                                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px' }}>
                                  <span style={{ color: item.passed ? (item.points < 0 ? '#f87171' : '#4ade80') : 'rgba(255,255,255,0.25)', width: '14px', flexShrink: 0 }}>
                                    {item.passed ? (item.points < 0 ? '⚠' : '✓') : '✗'}
                                  </span>
                                  <span style={{ color: item.passed ? 'rgba(255,255,255,0.8)' : 'rgba(255,255,255,0.4)', flex: 1 }}>{item.label}</span>
                                  <span style={{ color: item.passed ? (item.points < 0 ? '#f87171' : '#4ade80') : 'rgba(255,255,255,0.3)', fontWeight: 700, flexShrink: 0 }}>
                                    {item.passed ? (item.points > 0 ? '+' : '') + item.points : '0'}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </>
                        )}
                      </div>
                      <div>
                        <div style={{ fontSize: '11px', fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '8px' }}>Contato</div>
                        <div style={{ fontSize: '12.5px', color: MUTED, lineHeight: 1.9, marginBottom: '14px' }}>
                          {p.phone && <div>📞 {p.phone}</div>}
                          {p.website_url && <div>🌐 <a href={p.website_url.startsWith('http') ? p.website_url : `https://${p.website_url}`} target="_blank" rel="noreferrer" style={{ color: ORANGE }}>{p.website_url}</a></div>}
                          {p.instagram_url && <div>📸 <a href={p.instagram_url} target="_blank" rel="noreferrer" style={{ color: ORANGE }}>Instagram</a></div>}
                          {p.facebook_url && <div>👍 <a href={p.facebook_url} target="_blank" rel="noreferrer" style={{ color: ORANGE }}>Facebook</a></div>}
                          {p.has_whatsapp && <div>💬 WhatsApp no site</div>}
                          {p.has_online_ordering && <div>🛵 Pedido online no site</div>}
                          {p.days_since_last_review != null && <div>🗓️ Última avaliação há {p.days_since_last_review} dias</div>}
                          {p.is_likely_chain && <div style={{ color: '#FBBF24' }}>⚠️ IA sugere que pode ser rede/franquia (estimativa)</div>}
                          {!p.website_url && !p.phone && <div>Nenhum contato direto encontrado.</div>}
                        </div>
                        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '14px' }}>
                          {Object.keys(STATUS_LABELS).map(s => (
                            <button key={s} onClick={() => changeStatus(p.id, s)}
                              style={{ padding: '5px 11px', borderRadius: '7px', border: `1px solid ${p.status === s ? 'rgba(255,109,41,0.4)' : BORDER}`, background: p.status === s ? 'rgba(255,109,41,0.12)' : 'transparent', color: p.status === s ? ORANGE : MUTED, fontSize: '11px', cursor: 'pointer' }}>
                              {STATUS_LABELS[s]}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: `1px solid ${BORDER}` }}>
                      <div style={{ fontSize: '11px', fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '8px' }}>Anotações</div>
                      <div style={{ display: 'flex', gap: '8px', marginBottom: '10px' }}>
                        <input value={newNote} onChange={e => setNewNote(e.target.value)} placeholder="Anotar ligação, e-mail, follow-up..."
                          style={{ flex: 1, padding: '8px 12px', background: 'rgba(255,255,255,0.04)', border: `1px solid ${BORDER}`, borderRadius: '8px', color: 'white', fontSize: '12.5px', outline: 'none' }} />
                        <button onClick={() => addNote(p.id)} style={{ padding: '8px 16px', background: ORANGE, color: '#000', fontWeight: 700, fontSize: '12px', borderRadius: '8px', border: 'none', cursor: 'pointer' }}>Salvar</button>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        {activities.map(a => (
                          <div key={a.id} style={{ fontSize: '12px', color: MUTED, padding: '8px 10px', background: 'rgba(255,255,255,0.03)', borderRadius: '7px' }}>
                            <span style={{ color: 'rgba(255,255,255,0.3)' }}>{new Date(a.created_at).toLocaleString('pt-BR')} — </span>{a.notes}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
