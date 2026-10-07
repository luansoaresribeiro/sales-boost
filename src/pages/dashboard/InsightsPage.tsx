import { useEffect, useState } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import { topWords } from '../../lib/wordFrequency'
import { InsightReport } from '../../components/InsightReport'
import { useLang } from '../../contexts/LanguageContext'

const CARD = '#150E08'
const MUTED = '#BABABA'
const D = "'Bricolage Grotesque', system-ui, sans-serif"
const BORDER = 'rgba(255,255,255,0.06)'
const ORANGE = '#FF6D29'
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string

interface Review {
  id: string
  source: string
  author: string | null
  rating: number | null
  text: string | null
  review_date: string | null
  sentiment: string | null
  themes: string[] | null
  google_review_id: string | null
  owner_reply: string | null
}

const SENTIMENT_COLORS: Record<string, { bg: string; color: string }> = {
  positive: { bg: 'rgba(74,222,128,0.1)', color: '#4ade80' },
  neutral: { bg: 'rgba(251,191,36,0.1)', color: '#FBBF24' },
  negative: { bg: 'rgba(248,113,113,0.1)', color: '#f87171' },
}

const THEME_COLORS = [ORANGE, '#A78BFA', '#4ade80', '#FBBF24', '#60a5fa', '#f472b6', '#34d399', '#fb923c']

const TX = {
  pt: {
    unknownErr: 'Erro desconhecido', syncing: 'Sincronizando em segundo plano...', syncErrs: 'Sincronização concluída com alguns erros.', imported: 'Avaliações importadas e classificadas.',
    analyzedN: (n: number) => `${n} avaliações analisadas`, replyErr: 'Erro ao enviar resposta', published: '✓ Resposta publicada no Google!', errPrefix: 'Erro: ',
    loading: 'Carregando avaliações...', title: 'Avaliações', count: (n: number, u: number) => `${n} avaliações · ${u} aguardando análise`, none: 'Nenhuma avaliação importada ainda',
    importing: 'Importando...', importG: '⬇ Importar do Google', analyzingAi: 'Analisando com IA...', analyzeN: (n: number) => `✦ Analisar ${n} avaliações`,
    emptyTitle: 'Nenhuma avaliação ainda', emptyA: 'Clique em', emptyB: '"Importar do Google"', emptyC: 'para buscar as avaliações do seu negócio. Precisamos ter o nome do seu negócio salvo nas Configurações.',
    importFull: '⬇ Importar avaliações do Google →', avg: 'Nota média', officialG: 'oficial do Google', reviewsWord: 'avaliações', positives: 'Positivas', neutrals: 'Neutras', negatives: 'Negativas',
    themes: 'Temas mais citados', words: 'Palavras mais citadas', wordsSub: '% de avaliações que mencionam a palavra', all: 'Todas', noFilter: 'Nenhuma avaliação com este filtro',
    anon: 'Anônimo', pos: '+ Positiva', neg: '− Negativa', neu: '• Neutra', repliedByOwner: '✓ Respondido pelo proprietário', replyOnG: 'Responder no Google →',
    replyPh: 'Escreva sua resposta pública...', publishing: 'Publicando...', publishReply: 'Publicar resposta', cancel: 'Cancelar',
  },
  en: {
    unknownErr: 'Unknown error', syncing: 'Syncing in the background...', syncErrs: 'Sync finished with some errors.', imported: 'Reviews imported and classified.',
    analyzedN: (n: number) => `${n} reviews analyzed`, replyErr: 'Error sending reply', published: '✓ Reply published on Google!', errPrefix: 'Error: ',
    loading: 'Loading reviews...', title: 'Reviews', count: (n: number, u: number) => `${n} reviews · ${u} awaiting analysis`, none: 'No reviews imported yet',
    importing: 'Importing...', importG: '⬇ Import from Google', analyzingAi: 'Analyzing with AI...', analyzeN: (n: number) => `✦ Analyze ${n} reviews`,
    emptyTitle: 'No reviews yet', emptyA: 'Click', emptyB: '"Import from Google"', emptyC: 'to fetch your business\'s reviews. We need your business name saved in Settings.',
    importFull: '⬇ Import Google reviews →', avg: 'Average rating', officialG: 'official from Google', reviewsWord: 'reviews', positives: 'Positive', neutrals: 'Neutral', negatives: 'Negative',
    themes: 'Most mentioned themes', words: 'Most mentioned words', wordsSub: '% of reviews that mention the word', all: 'All', noFilter: 'No review with this filter',
    anon: 'Anonymous', pos: '+ Positive', neg: '− Negative', neu: '• Neutral', repliedByOwner: '✓ Replied by the owner', replyOnG: 'Reply on Google →',
    replyPh: 'Write your public reply...', publishing: 'Publishing...', publishReply: 'Publish reply', cancel: 'Cancel',
  },
}

function StarRow({ rating }: { rating: number | null }) {
  if (!rating) return null
  const r = Math.round(rating)
  const color = r >= 4 ? '#4ade80' : r >= 3 ? '#FBBF24' : '#f87171'
  return <span style={{ fontSize: '12px', color, fontWeight: 700 }}>{'★'.repeat(r)}{'☆'.repeat(5 - r)}</span>
}

export default function InsightsPage() {
  const { user, session } = useAuth()
  const { lang } = useLang()
  const t = TX[lang]
  const [companyId, setCompanyId] = useState<string | null>(null)
  const [googleRating, setGoogleRating] = useState<number | null>(null)
  const [googleReviewCount, setGoogleReviewCount] = useState<number | null>(null)
  const [reviews, setReviews] = useState<Review[]>([])
  const [loading, setLoading] = useState(true)
  const [importing, setImporting] = useState(false)
  const [analyzing, setAnalyzing] = useState(false)
  const [actionMsg, setActionMsg] = useState('')
  const [actionErr, setActionErr] = useState('')
  const [sentimentFilter, setSentimentFilter] = useState<string>('all')
  const [gbpConnected, setGbpConnected] = useState(false)
  const [replyingId, setReplyingId] = useState<string | null>(null)
  const [replyText, setReplyText] = useState<Record<string, string>>({})
  const [replySending, setReplySending] = useState<string | null>(null)
  const [replyMsg, setReplyMsg] = useState<Record<string, string>>({})

  const loadReviews = async () => {
    if (!user) return
    setLoading(true)
    const { data: company } = await supabase
      .from('companies')
      .select('id, google_rating, google_review_count')
      .eq('user_id', user.id)
      .maybeSingle()

    if (!company) { setLoading(false); return }
    setCompanyId(company.id)
    setGoogleRating(company.google_rating)
    setGoogleReviewCount(company.google_review_count)

    const [{ data }, { data: gbpInteg }] = await Promise.all([
      supabase
        .from('reviews')
        .select('id, source, author, rating, text, review_date, sentiment, themes, google_review_id, owner_reply')
        .eq('company_id', company.id)
        .order('review_date', { ascending: false })
        .limit(200),
      supabase
        .from('company_integrations')
        .select('id')
        .eq('company_id', company.id)
        .eq('type', 'google_business_profile')
        .maybeSingle(),
    ])

    setReviews((data ?? []) as Review[])
    setGbpConnected(!!gbpInteg)
    setLoading(false)
  }

  useEffect(() => { loadReviews() }, [user])

  const importReviews = async () => {
    if (!session) return
    setImporting(true)
    setActionMsg('')
    setActionErr('')
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/apify-sync`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? t.unknownErr)
      // apify-sync kicks off a background job and returns right away — poll
      // until it's done instead of assuming the old synchronous response shape.
      if (data.job_id) {
        setActionMsg(t.syncing)
        for (let i = 0; i < 60; i++) {
          await new Promise(r => setTimeout(r, 3000))
          const { data: job } = await supabase.from('sync_jobs').select('status').eq('id', data.job_id).maybeSingle()
          if (job && job.status !== 'running') {
            setActionMsg(job.status === 'error' ? t.syncErrs : t.imported)
            break
          }
        }
      }
      await loadReviews()
    } catch (e: unknown) {
      setActionErr(e instanceof Error ? e.message : String(e))
    }
    setImporting(false)
  }

  const callFunction = async (fn: string, setter: (v: boolean) => void) => {
    if (!session) return
    setter(true)
    setActionMsg('')
    setActionErr('')
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/${fn}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? t.unknownErr)
      setActionMsg(data.message ?? t.analyzedN(data.analyzed ?? 0))
      await loadReviews()
    } catch (e: unknown) {
      setActionErr(e instanceof Error ? e.message : String(e))
    }
    setter(false)
  }

  const sendReply = async (reviewId: string) => {
    const text = replyText[reviewId]?.trim()
    if (!text || !session) return
    setReplySending(reviewId)
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/reply-google-review`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ review_id: reviewId, reply_text: text }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? t.replyErr)
      setReplyMsg(prev => ({ ...prev, [reviewId]: t.published }))
      setReplyingId(null)
      setReviews(prev => prev.map(r => r.id === reviewId ? { ...r, owner_reply: text } : r))
    } catch (e: unknown) {
      setReplyMsg(prev => ({ ...prev, [reviewId]: `${t.errPrefix}${e instanceof Error ? e.message : String(e)}` }))
    }
    setReplySending(null)
  }

  // Derived stats
  const analyzed = reviews.filter(r => r.sentiment)
  const positive = analyzed.filter(r => r.sentiment === 'positive').length
  const negative = analyzed.filter(r => r.sentiment === 'negative').length
  const neutral = analyzed.filter(r => r.sentiment === 'neutral').length
  const withRating = reviews.filter(r => r.rating)
  const localAvgRating = withRating.length
    ? (withRating.reduce((s, r) => s + (r.rating ?? 0), 0) / withRating.length).toFixed(1)
    : null
  // Prefer the real Google Business rating over an average computed from the
  // reviews we've imported — Apify only pulls a recent batch (not the full
  // history Google uses), so a locally-computed average always drifts from
  // what shows up on Google itself.
  const avgRating = googleRating != null ? googleRating.toFixed(1) : localAvgRating
  const avgRatingIsGoogle = googleRating != null
  const unanalyzed = reviews.filter(r => !r.sentiment).length

  // Theme counts
  const themeCounts: Record<string, number> = {}
  for (const r of reviews) {
    for (const t of r.themes ?? []) themeCounts[t] = (themeCounts[t] ?? 0) + 1
  }
  const topThemes = Object.entries(themeCounts).sort((a, b) => b[1] - a[1]).slice(0, 8)
  const topWordsList = topWords(reviews.map(r => r.text), 10)

  const filtered = sentimentFilter === 'all' ? reviews : reviews.filter(r => r.sentiment === sentimentFilter)

  if (loading) return <div style={{ padding: '28px 32px', color: MUTED, fontSize: '14px' }}>{t.loading}</div>

  return (
    <div>
      <div style={{ padding: '28px 32px 24px', borderBottom: `1px solid ${BORDER}`, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontFamily: D, fontSize: '1.5rem', fontWeight: 800, color: 'white', letterSpacing: '-0.02em', marginBottom: '4px' }}>{t.title}</h1>
          <p style={{ color: MUTED, fontSize: '13px' }}>
            {reviews.length > 0 ? t.count(reviews.length, unanalyzed) : t.none}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button onClick={importReviews} disabled={importing || !companyId}
            style={{ padding: '9px 16px', background: importing ? 'rgba(255,109,41,0.3)' : 'rgba(255,109,41,0.12)', color: ORANGE, fontWeight: 700, fontSize: '12px', borderRadius: '9px', border: '1px solid rgba(255,109,41,0.25)', cursor: importing ? 'not-allowed' : 'pointer' }}>
            {importing ? t.importing : t.importG}
          </button>
          {unanalyzed > 0 && (
            <button onClick={() => callFunction('analyze-reviews', setAnalyzing)} disabled={analyzing}
              style={{ padding: '9px 16px', background: analyzing ? 'rgba(167,139,250,0.2)' : 'rgba(167,139,250,0.12)', color: '#A78BFA', fontWeight: 700, fontSize: '12px', borderRadius: '9px', border: '1px solid rgba(167,139,250,0.25)', cursor: analyzing ? 'not-allowed' : 'pointer' }}>
              {analyzing ? t.analyzingAi : t.analyzeN(unanalyzed)}
            </button>
          )}
        </div>
      </div>

      <div style={{ padding: '24px 32px' }}>
        <InsightReport tabKey="avaliacoes" />

        {(actionMsg || actionErr) && (
          <div style={{ marginBottom: '16px', padding: '12px 16px', background: actionErr ? 'rgba(248,113,113,0.08)' : 'rgba(74,222,128,0.08)', border: `1px solid ${actionErr ? 'rgba(248,113,113,0.2)' : 'rgba(74,222,128,0.2)'}`, borderRadius: '10px', fontSize: '13px', color: actionErr ? '#f87171' : '#4ade80', lineHeight: 1.5 }}>
            {actionErr || actionMsg}
          </div>
        )}

        {reviews.length === 0 ? (
          <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: '14px', padding: '60px 32px', textAlign: 'center' }}>
            <div style={{ fontSize: '2.5rem', marginBottom: '12px' }}>⭐</div>
            <div style={{ fontFamily: D, fontSize: '1.2rem', fontWeight: 800, color: 'white', marginBottom: '8px' }}>{t.emptyTitle}</div>
            <div style={{ fontSize: '14px', color: MUTED, maxWidth: '400px', margin: '0 auto 24px', lineHeight: 1.7 }}>
              {t.emptyA} <strong style={{ color: ORANGE }}>{t.emptyB}</strong> {t.emptyC}
            </div>
            <button onClick={importReviews} disabled={importing}
              style={{ padding: '11px 24px', background: ORANGE, color: '#000', fontWeight: 700, fontSize: '14px', borderRadius: '10px', border: 'none', cursor: importing ? 'not-allowed' : 'pointer' }}>
              {importing ? t.importing : t.importFull}
            </button>
          </div>
        ) : (
          <>
            {/* Stats */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '14px', marginBottom: '24px' }}>
              {[
                { label: t.avg, value: avgRating ? `${avgRating}★` : '—', color: '#FBBF24', hint: avgRatingIsGoogle ? `${t.officialG}${googleReviewCount ? ` · ${googleReviewCount} ${t.reviewsWord}` : ''}` : null },
                { label: t.positives, value: String(positive), color: '#4ade80', hint: null },
                { label: t.neutrals, value: String(neutral), color: MUTED, hint: null },
                { label: t.negatives, value: String(negative), color: '#f87171', hint: null },
              ].map(s => (
                <div key={s.label} style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: '12px', padding: '18px 20px' }}>
                  <div style={{ fontSize: '10px', color: MUTED, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '8px' }}>{s.label}</div>
                  <div style={{ fontFamily: D, fontSize: '2rem', fontWeight: 900, color: s.color }}>{s.value}</div>
                  {s.hint && <div style={{ fontSize: '10px', color: MUTED, marginTop: '4px' }}>{s.hint}</div>}
                </div>
              ))}
            </div>

            {/* Themes */}
            {topThemes.length > 0 && (
              <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: '14px', padding: '20px 24px', marginBottom: '20px' }}>
                <div style={{ fontSize: '12px', fontWeight: 600, color: 'white', marginBottom: '14px' }}>{t.themes}</div>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  {topThemes.map(([theme, count], i) => (
                    <div key={theme} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '5px 12px', background: 'rgba(255,255,255,0.04)', borderRadius: '99px', border: `1px solid rgba(255,255,255,0.08)` }}>
                      <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: THEME_COLORS[i % THEME_COLORS.length], flexShrink: 0 }} />
                      <span style={{ fontSize: '12px', color: 'white', textTransform: 'capitalize' }}>{theme}</span>
                      <span style={{ fontSize: '11px', color: MUTED }}>{count}x</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Word frequency */}
            {topWordsList.length > 0 && (
              <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: '14px', padding: '20px 24px', marginBottom: '20px' }}>
                <div style={{ fontSize: '12px', fontWeight: 600, color: 'white', marginBottom: '4px' }}>{t.words}</div>
                <div style={{ fontSize: '11px', color: MUTED, marginBottom: '14px' }}>{t.wordsSub}</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '9px' }}>
                  {topWordsList.map(w => (
                    <div key={w.word} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div style={{ width: '110px', fontSize: '12.5px', color: 'white', textTransform: 'capitalize', flexShrink: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{w.word}</div>
                      <div style={{ flex: 1, height: '6px', borderRadius: '99px', background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
                        <div style={{ width: `${w.docPercent}%`, height: '100%', borderRadius: '99px', background: ORANGE, opacity: 0.75 }} />
                      </div>
                      <div style={{ width: '40px', fontSize: '11.5px', color: MUTED, textAlign: 'right', flexShrink: 0 }}>{w.docPercent}%</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Filter */}
            <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
              {[['all', t.all], ['positive', t.positives], ['neutral', t.neutrals], ['negative', t.negatives]].map(([val, label]) => (
                <button key={val} onClick={() => setSentimentFilter(val)}
                  style={{ padding: '6px 14px', borderRadius: '99px', border: 'none', cursor: 'pointer', fontSize: '12px', fontWeight: 600,
                    background: sentimentFilter === val ? 'rgba(255,109,41,0.2)' : 'rgba(255,255,255,0.05)',
                    color: sentimentFilter === val ? ORANGE : MUTED }}>
                  {label}
                </button>
              ))}
            </div>

            {/* Reviews list */}
            <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: '14px', overflow: 'hidden' }}>
              {filtered.length === 0 ? (
                <div style={{ padding: '40px', textAlign: 'center', color: MUTED, fontSize: '13px' }}>{t.noFilter}</div>
              ) : filtered.map((r, i) => (
                <div key={r.id} style={{ padding: '16px 22px', borderBottom: i < filtered.length - 1 ? `1px solid ${BORDER}` : 'none', display: 'flex', gap: '14px', alignItems: 'flex-start' }}>
                  <div style={{ width: '34px', height: '34px', borderRadius: '50%', background: 'rgba(255,109,41,0.1)', border: '1px solid rgba(255,109,41,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', fontWeight: 700, color: ORANGE, flexShrink: 0 }}>
                    {(r.author ?? '?')[0].toUpperCase()}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '6px', gap: '8px', flexWrap: 'wrap' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '13px', fontWeight: 600, color: 'white' }}>{r.author ?? t.anon}</span>
                        <StarRow rating={r.rating} />
                        {r.sentiment && (
                          <span style={{ fontSize: '10px', padding: '2px 8px', borderRadius: '99px', fontWeight: 700, ...SENTIMENT_COLORS[r.sentiment] }}>
                            {r.sentiment === 'positive' ? t.pos : r.sentiment === 'negative' ? t.neg : t.neu}
                          </span>
                        )}
                      </div>
                      <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.25)' }}>
                        {r.review_date ? new Date(r.review_date).toLocaleDateString(lang === 'en' ? 'en-US' : 'pt-BR') : ''}
                      </span>
                    </div>
                    {r.text && <p style={{ fontSize: '13px', color: MUTED, lineHeight: 1.65, margin: '0 0 8px' }}>{r.text}</p>}
                    {r.themes && r.themes.length > 0 && (
                      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                        {r.themes.map(t => (
                          <span key={t} style={{ fontSize: '10px', padding: '2px 8px', borderRadius: '99px', background: 'rgba(255,255,255,0.05)', color: MUTED, textTransform: 'capitalize' }}>{t}</span>
                        ))}
                      </div>
                    )}
                    {/* Owner reply or reply button */}
                    {r.owner_reply ? (
                      <div style={{ marginTop: '8px', padding: '10px 14px', background: 'rgba(74,222,128,0.06)', borderRadius: '8px', border: '1px solid rgba(74,222,128,0.15)' }}>
                        <div style={{ fontSize: '11px', color: '#4ade80', fontWeight: 600, marginBottom: '4px' }}>{t.repliedByOwner}</div>
                        <p style={{ fontSize: '12px', color: MUTED, margin: 0, lineHeight: 1.6 }}>{r.owner_reply}</p>
                      </div>
                    ) : gbpConnected && r.google_review_id ? (
                      <div style={{ marginTop: '8px' }}>
                        {replyingId !== r.id ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <button
                              onClick={() => setReplyingId(r.id)}
                              style={{ padding: '5px 12px', background: 'rgba(255,109,41,0.12)', color: ORANGE, fontWeight: 600, fontSize: '11px', borderRadius: '7px', border: '1px solid rgba(255,109,41,0.25)', cursor: 'pointer' }}
                            >
                              {t.replyOnG}
                            </button>
                            {replyMsg[r.id] && (
                              <span style={{ fontSize: '11px', color: !replyMsg[r.id].startsWith('✓') ? '#f87171' : '#4ade80' }}>{replyMsg[r.id]}</span>
                            )}
                          </div>
                        ) : (
                          <div style={{ marginTop: '4px' }}>
                            <textarea
                              value={replyText[r.id] ?? ''}
                              onChange={e => setReplyText(prev => ({ ...prev, [r.id]: e.target.value }))}
                              placeholder={t.replyPh}
                              rows={3}
                              style={{ width: '100%', padding: '10px 12px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: 'white', fontSize: '12px', lineHeight: 1.6, resize: 'vertical', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit' }}
                            />
                            <div style={{ display: 'flex', gap: '8px', marginTop: '6px', alignItems: 'center' }}>
                              <button
                                onClick={() => sendReply(r.id)}
                                disabled={replySending === r.id || !replyText[r.id]?.trim()}
                                style={{ padding: '6px 14px', background: replySending === r.id ? 'rgba(255,109,41,0.3)' : ORANGE, color: '#000', fontWeight: 700, fontSize: '11px', borderRadius: '7px', border: 'none', cursor: replySending === r.id ? 'not-allowed' : 'pointer' }}
                              >
                                {replySending === r.id ? t.publishing : t.publishReply}
                              </button>
                              <button
                                onClick={() => setReplyingId(null)}
                                style={{ padding: '6px 12px', background: 'transparent', color: MUTED, fontWeight: 600, fontSize: '11px', borderRadius: '7px', border: `1px solid ${BORDER}`, cursor: 'pointer' }}
                              >
                                {t.cancel}
                              </button>
                              {replyMsg[r.id] && (
                                <span style={{ fontSize: '11px', color: !replyMsg[r.id].startsWith('✓') ? '#f87171' : '#4ade80' }}>{replyMsg[r.id]}</span>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
