import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../../contexts/AuthContext'
import { supabase } from '../../../lib/supabase'
import type { CompanyData } from '../../../contexts/CompanyContext'
import { useLang } from '../../../contexts/LanguageContext'
import { CARD, MUTED, BORDER, D } from './shared'

const ORANGE = '#FF6D29'
const GREEN = '#4ade80'
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string

interface ReviewRow {
  id: string
  author: string | null
  rating: number | null
  text: string | null
  review_date: string | null
  google_review_id: string | null
  oppId: string | null
  draft: string | null
}

const TX = {
  pt: {
    errGen: 'Erro ao gerar resposta', errPub: 'Erro ao publicar',
    intro: 'O agente principal cuida das suas avaliações do Google: rascunha a resposta de cada uma sozinho. Você aprova e publica aqui — ou liga o modo automático pra ele publicar sozinho.',
    autoTitle: '🤖 Responder automaticamente',
    autoOn: 'Ligado: o agente publica a resposta no Google assim que rascunha — sem esperar aprovação. Requer o Google conectado.',
    autoOff: 'Desligado: o agente rascunha e espera você aprovar aqui (nada vai ao Google sem seu OK).',
    gbp1: '⏳ Pra publicar respostas no Google, conecte o', gbp2: 'Google Business Profile', goConn: 'Ir para Conexões →',
    loading: 'Carregando...', none: 'Nenhuma avaliação sem resposta', noneSub: 'Quando chegar uma avaliação nova no Google, ela aparece aqui com uma resposta já rascunhada pelo agente.',
    client: 'Cliente', agentReply: 'Resposta do agente', publishing: 'Publicando...', approve: 'Aprovar e publicar no Google',
    generating: 'Gerando...', generate: 'Gerar resposta com IA', soon: 'Rascunho em breve (agente processa em ciclo)',
  },
  en: {
    errGen: 'Error generating reply', errPub: 'Error publishing',
    intro: 'The main agent looks after your Google reviews: it drafts a reply to each one on its own. You approve and publish here — or turn on automatic mode so it publishes by itself.',
    autoTitle: '🤖 Reply automatically',
    autoOn: 'On: the agent publishes the reply on Google as soon as it drafts it — without waiting for approval. Requires Google to be connected.',
    autoOff: 'Off: the agent drafts and waits for you to approve here (nothing goes to Google without your OK).',
    gbp1: '⏳ To publish replies on Google, connect', gbp2: 'Google Business Profile', goConn: 'Go to Connections →',
    loading: 'Loading...', none: 'No unanswered reviews', noneSub: 'When a new review arrives on Google, it appears here with a reply already drafted by the agent.',
    client: 'Customer', agentReply: 'Agent reply', publishing: 'Publishing...', approve: 'Approve and publish on Google',
    generating: 'Generating...', generate: 'Generate reply with AI', soon: 'Draft coming soon (agent processes in cycles)',
  },
}

const stars = (n: number | null) => '★'.repeat(n ?? 0) + '☆'.repeat(5 - (n ?? 0))

export default function ReviewsAgentTab({ company }: { company: Pick<CompanyData, 'id'> }) {
  const { session } = useAuth()
  const { lang } = useLang()
  const t = TX[lang]
  const navigate = useNavigate()
  const [rows, setRows] = useState<ReviewRow[]>([])
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [auto, setAuto] = useState(false)
  const [savingAuto, setSavingAuto] = useState(false)
  const [gbpConnected, setGbpConnected] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState('')

  useEffect(() => { load() }, [company.id])

  const load = async () => {
    setLoading(true)
    const [{ data: co }, { data: reviews }, { data: opps }, { data: gbp }] = await Promise.all([
      supabase.from('companies').select('auto_reply_reviews').eq('id', company.id).maybeSingle(),
      supabase.from('reviews').select('id, author, rating, text, review_date, google_review_id').eq('company_id', company.id).is('owner_reply', null).order('review_date', { ascending: false }).limit(50),
      supabase.from('opportunities').select('id, ref_id, ai_draft').eq('company_id', company.id).eq('ref_type', 'review').eq('status', 'open'),
      supabase.from('company_integrations').select('id').eq('company_id', company.id).eq('type', 'google_business_profile').maybeSingle(),
    ])
    setAuto(!!co?.auto_reply_reviews)
    setGbpConnected(!!gbp)
    const oppByReview: Record<string, { id: string; ai_draft: string | null }> = {}
    for (const o of (opps ?? []) as { id: string; ref_id: string; ai_draft: string | null }[]) {
      if (o.ref_id) oppByReview[o.ref_id] = { id: o.id, ai_draft: o.ai_draft }
    }
    const list: ReviewRow[] = ((reviews ?? []) as Omit<ReviewRow, 'oppId' | 'draft'>[]).map(r => ({
      ...r, oppId: oppByReview[r.id]?.id ?? null, draft: oppByReview[r.id]?.ai_draft ?? null,
    }))
    setRows(list)
    const d: Record<string, string> = {}
    for (const r of list) d[r.id] = r.draft ?? ''
    setDrafts(d)
    setLoading(false)
  }

  const toggleAuto = async (v: boolean) => {
    setSavingAuto(true)
    setAuto(v)
    await supabase.from('companies').update({ auto_reply_reviews: v }).eq('id', company.id)
    setSavingAuto(false)
  }

  const generate = async (oppId: string) => {
    if (!session) return
    setBusyId(oppId)
    setError('')
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/draft-reply`, {
        method: 'POST', headers: { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ opportunity_id: oppId }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? t.errGen)
      setRows(prev => prev.map(r => r.oppId === oppId ? { ...r, draft: data.draft } : r))
      setDrafts(prev => ({ ...prev, [rows.find(r => r.oppId === oppId)?.id ?? '']: data.draft }))
    } catch (e) { setError(e instanceof Error ? e.message : String(e)) }
    setBusyId(null)
  }

  const publish = async (review: ReviewRow) => {
    if (!session) return
    const text = (drafts[review.id] ?? '').trim()
    if (!text) return
    setBusyId(review.id)
    setError('')
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/reply-google-review`, {
        method: 'POST', headers: { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ review_id: review.id, reply_text: text }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? t.errPub)
      setRows(prev => prev.filter(r => r.id !== review.id))
    } catch (e) { setError(e instanceof Error ? e.message : String(e)) }
    setBusyId(null)
  }

  return (
    <div>
      <div style={{ fontSize: '12.5px', color: MUTED, lineHeight: 1.6, maxWidth: '640px', marginBottom: '16px' }}>
        {t.intro}
      </div>

      {/* Modo automático */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '13px 16px', borderRadius: '12px', border: `1px solid ${auto ? 'rgba(255,109,41,0.35)' : BORDER}`, background: auto ? 'rgba(255,109,41,0.05)' : 'rgba(255,255,255,0.02)', marginBottom: '14px' }}>
        <input type="checkbox" checked={auto} disabled={savingAuto} onChange={e => toggleAuto(e.target.checked)} style={{ width: '17px', height: '17px', accentColor: ORANGE, cursor: 'pointer' }} />
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: '13.5px', fontWeight: 700, color: 'white' }}>{t.autoTitle}</div>
          <div style={{ fontSize: '11.5px', color: MUTED, marginTop: '2px', lineHeight: 1.5 }}>
            {auto
              ? t.autoOn
              : t.autoOff}
          </div>
        </div>
      </div>

      {!gbpConnected && (
        <div style={{ marginBottom: '16px', padding: '12px 16px', background: 'rgba(251,191,36,0.06)', border: '1px solid rgba(251,191,36,0.22)', borderRadius: '11px', fontSize: '11.5px', color: 'white', lineHeight: 1.6 }}>
          {t.gbp1} <strong>{t.gbp2}</strong>.{' '}
          <button onClick={() => navigate('/dashboard/marketing-ai/conexoes')} style={{ background: 'transparent', border: 'none', color: ORANGE, fontWeight: 700, cursor: 'pointer', padding: 0, fontFamily: D }}>{t.goConn}</button>
        </div>
      )}

      {error && (
        <div style={{ marginBottom: '14px', padding: '10px 14px', background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.2)', borderRadius: '9px', fontSize: '12px', color: '#f87171' }}>{error}</div>
      )}

      {loading ? (
        <div style={{ color: MUTED, fontSize: '13px', padding: '24px 0' }}>{t.loading}</div>
      ) : rows.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 0' }}>
          <div style={{ fontSize: '2.5rem', marginBottom: '12px' }}>🎉</div>
          <div style={{ fontFamily: D, fontSize: '1.1rem', fontWeight: 800, color: 'white', marginBottom: '6px' }}>{t.none}</div>
          <div style={{ color: MUTED, fontSize: '12.5px', maxWidth: '380px', margin: '0 auto', lineHeight: 1.6 }}>
            {t.noneSub}
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {rows.map(r => (
            <div key={r.id} style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: '13px', padding: '15px 17px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '13px', fontWeight: 700, color: 'white' }}>{r.author ?? t.client}</span>
                <span style={{ fontSize: '12px', color: (r.rating ?? 0) <= 2 ? '#f87171' : (r.rating ?? 0) >= 4 ? GREEN : '#FBBF24' }}>{stars(r.rating)}</span>
                {r.review_date && <span style={{ fontSize: '10.5px', color: MUTED }}>{new Date(r.review_date).toLocaleDateString(lang === 'en' ? 'en-US' : 'pt-BR')}</span>}
              </div>
              {r.text && <div style={{ fontSize: '12.5px', color: 'rgba(255,255,255,0.82)', lineHeight: 1.55, marginBottom: '10px' }}>"{r.text}"</div>}

              <div style={{ fontSize: '10px', color: MUTED, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '6px' }}>{t.agentReply}</div>
              {r.draft || drafts[r.id] ? (
                <>
                  <textarea value={drafts[r.id] ?? ''} onChange={e => setDrafts(prev => ({ ...prev, [r.id]: e.target.value }))} rows={3}
                    style={{ width: '100%', boxSizing: 'border-box', padding: '10px 12px', background: 'rgba(255,255,255,0.03)', border: `1px solid ${BORDER}`, borderRadius: '9px', color: 'white', fontSize: '12.5px', lineHeight: 1.5, resize: 'vertical', fontFamily: D, marginBottom: '10px' }} />
                  <button onClick={() => publish(r)} disabled={busyId === r.id || !gbpConnected || !(drafts[r.id] ?? '').trim()}
                    style={{ padding: '8px 16px', background: gbpConnected ? ORANGE : 'rgba(255,255,255,0.08)', color: gbpConnected ? '#000' : MUTED, fontWeight: 700, fontSize: '12px', border: 'none', borderRadius: '9px', cursor: gbpConnected && (drafts[r.id] ?? '').trim() ? 'pointer' : 'not-allowed', fontFamily: D }}>
                    {busyId === r.id ? t.publishing : t.approve}
                  </button>
                </>
              ) : (
                <button onClick={() => r.oppId && generate(r.oppId)} disabled={!r.oppId || busyId === r.oppId}
                  style={{ padding: '8px 16px', background: 'rgba(255,109,41,0.12)', color: ORANGE, fontWeight: 700, fontSize: '12px', border: '1px solid rgba(255,109,41,0.35)', borderRadius: '9px', cursor: r.oppId ? 'pointer' : 'not-allowed', fontFamily: D }}>
                  {busyId === r.oppId ? t.generating : r.oppId ? t.generate : t.soon}
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
