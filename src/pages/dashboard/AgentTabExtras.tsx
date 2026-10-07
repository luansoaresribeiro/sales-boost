import { useEffect, useState } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import { topWords } from '../../lib/wordFrequency'
import { useLang } from '../../contexts/LanguageContext'
import { d } from '../../i18n-dash'
import { InsightReport } from '../../components/InsightReport'

const ORANGE = '#FF6D29'
const CARD = '#150E08'
const MUTED = '#BABABA'
const D = "'Bricolage Grotesque', system-ui, sans-serif"
const BORDER = 'rgba(255,255,255,0.06)'
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string

// ── Generic "coming soon" placeholder, shared by Crescimento/Atendimento/Opiniões ──

const TX = {
  pt: {
    loc: 'pt-BR', loading: 'Carregando...',
    srcLabels: { instagram_comment: 'Comentários do Instagram', x: 'Menções no X', reddit: 'Menções no Reddit' } as Record<string, string>,
    opTitle: 'Opiniões da Internet',
    opSub: (n: number, k: number) => `${n} opiniões coletadas em ${k} fonte${k === 1 ? '' : 's'}`,
    opNone: 'Nenhuma opinião coletada ainda — os canais abaixo já estão sendo monitorados',
    noneYet: 'Nenhuma opinião ainda',
    opCount: (n: number, neg: number) => `${n} opiniões${neg > 0 ? ` · ${neg} negativas` : ''}`,
    whatSay: 'O que mais falam sobre o seu negócio', pctDesc: '% de opiniões (todas as fontes) que mencionam a palavra',
    noCaption: '(sem legenda)',
    noPostsTitle: 'Ainda sem posts publicados',
    noPostsDesc: 'Assim que o Instagram Auto-post publicar seus primeiros posts (Configurações → Integrações), o ranking de desempenho aparece aqui.',
    growth: 'Crescimento', growthSub: (n: number) => `Desempenho dos posts publicados no Instagram — ${n} posts analisados`,
    best: '🔥 Melhores posts', worst: '📉 Posts com menos engajamento', themes: 'Temas que mais aparecem nesses posts',
    perfNote: 'Desempenho medido por curtidas + comentários dos posts publicados via Instagram Auto-post.',
    unknownErr: 'Erro desconhecido',
    clickA: 'Clique em "', clickB: '" para checar se todos os links do seu negócio (site, Instagram, Google Maps, etc.) estão no ar.',
    brokenN: (n: number) => `${n} ${n === 1 ? 'link com problema' : 'links com problema'}`,
    linkLabels: {} as Record<string, string>,
  },
  en: {
    loc: 'en-US', loading: 'Loading...',
    srcLabels: { instagram_comment: 'Instagram comments', x: 'Mentions on X', reddit: 'Mentions on Reddit' } as Record<string, string>,
    opTitle: 'Web Opinions',
    opSub: (n: number, k: number) => `${n} opinions collected from ${k} source${k === 1 ? '' : 's'}`,
    opNone: 'No opinions collected yet — the channels below are already being monitored',
    noneYet: 'No opinions yet',
    opCount: (n: number, neg: number) => `${n} opinions${neg > 0 ? ` · ${neg} negative` : ''}`,
    whatSay: 'What people say most about your business', pctDesc: '% of opinions (all sources) that mention the word',
    noCaption: '(no caption)',
    noPostsTitle: 'No published posts yet',
    noPostsDesc: 'Once Instagram Auto-post publishes your first posts (Settings → Integrations), the performance ranking will appear here.',
    growth: 'Growth', growthSub: (n: number) => `Performance of posts published on Instagram — ${n} posts analyzed`,
    best: '🔥 Best posts', worst: '📉 Lowest-engagement posts', themes: 'Themes that appear most in these posts',
    perfNote: 'Performance measured by likes + comments on posts published via Instagram Auto-post.',
    unknownErr: 'Unknown error',
    clickA: 'Click "', clickB: '" to check that all your business links (website, Instagram, Google Maps, etc.) are up.',
    brokenN: (n: number) => `${n} ${n === 1 ? 'link with a problem' : 'links with problems'}`,
    linkLabels: { website_url: 'Website', instagram_url: 'Instagram', facebook_url: 'Facebook', tiktok_url: 'TikTok', google_maps_url: 'Google Maps', tripadvisor_url: 'TripAdvisor', reclame_aqui_url: 'Reclame Aqui', ifood_url: 'iFood' } as Record<string, string>,
  },
} as const

export function ComingSoonTab({ icon, title, desc }: { icon: string; title: string; desc: string }) {
  const { lang } = useLang()
  return (
    <div style={{ padding: '24px 32px' }}>
      <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: '16px', padding: '60px', textAlign: 'center' }}>
        <div style={{ fontSize: '2.5rem', marginBottom: '16px' }}>{icon}</div>
        <div style={{ fontFamily: D, fontSize: '1.2rem', fontWeight: 700, color: 'white', marginBottom: '8px' }}>{title}</div>
        <p style={{ color: MUTED, fontSize: '13px', maxWidth: '420px', margin: '0 auto 20px', lineHeight: 1.7 }}>{desc}</p>
        <span style={{ display: 'inline-block', padding: '5px 14px', borderRadius: '99px', background: 'rgba(255,109,41,0.1)', border: '1px solid rgba(255,109,41,0.25)', color: ORANGE, fontSize: '11px', fontWeight: 700, letterSpacing: '0.05em' }}>{d[lang].common.soon}</span>
      </div>
    </div>
  )
}

// ── Opiniões da Internet — resumo por fonte + palavras mais citadas ──

interface OpinionReview {
  source: string
  rating: number | null
  text: string | null
  sentiment: string | null
}

const SOURCE_META: Record<string, { label: string; icon: string }> = {
  google: { label: 'Google', icon: '⭐' },
  facebook: { label: 'Facebook', icon: '👍' },
  tripadvisor: { label: 'TripAdvisor', icon: '🦉' },
  reclame_aqui: { label: 'Reclame Aqui', icon: '📣' },
  ifood: { label: 'iFood', icon: '🍔' },
  instagram_comment: { label: 'Comentários do Instagram', icon: '📸' },
  x: { label: 'Menções no X', icon: '✖️' },
  reddit: { label: 'Menções no Reddit', icon: '👽' },
}

// Fontes sempre exibidas nesta aba, mesmo com zero opiniões ainda — pra
// deixar claro que o canal já está sendo monitorado. O Google fica de fora
// de propósito: ele já tem a própria aba "Avaliações", mostrar aqui também
// duplicaria o mesmo dado nas duas telas.
const ALWAYS_SHOWN_SOURCES = ['facebook', 'instagram_comment', 'x', 'reddit']

export function WebOpinionsTab() {
  const { user } = useAuth()
  const X = TX[useLang().lang]
  const [reviews, setReviews] = useState<OpinionReview[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) return
    supabase.from('companies').select('id').eq('user_id', user.id).maybeSingle().then(({ data: company }) => {
      if (!company) { setLoading(false); return }
      supabase.from('reviews').select('source, rating, text, sentiment').eq('company_id', company.id).neq('source', 'google').limit(500)
        .then(({ data }) => { setReviews((data ?? []) as OpinionReview[]); setLoading(false) })
    })
  }, [user])

  if (loading) return <div style={{ padding: '28px 32px', color: MUTED, fontSize: '14px' }}>{X.loading}</div>

  const bySource: Record<string, OpinionReview[]> = {}
  for (const r of reviews) (bySource[r.source] ??= []).push(r)
  for (const s of ALWAYS_SHOWN_SOURCES) bySource[s] ??= []
  const activeSourceCount = Object.values(bySource).filter(revs => revs.length > 0).length

  const words = topWords(reviews.map(r => r.text), 12)

  return (
    <div>
      <div style={{ padding: '28px 32px 24px', borderBottom: `1px solid ${BORDER}` }}>
        <h1 style={{ fontFamily: D, fontSize: '1.5rem', fontWeight: 800, color: 'white', letterSpacing: '-0.02em', marginBottom: '4px' }}>{X.opTitle}</h1>
        <p style={{ color: MUTED, fontSize: '13px' }}>
          {reviews.length > 0 ? X.opSub(reviews.length, activeSourceCount) : X.opNone}
        </p>
      </div>

      <div style={{ padding: '24px 32px' }}>
        <InsightReport tabKey="opinioes" />

        {/* Per-source breakdown */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '12px', marginBottom: '24px' }}>
          {Object.entries(bySource).map(([source, revs]) => {
            const base = SOURCE_META[source] ?? { label: source, icon: '💬' }
            const meta = { ...base, label: X.srcLabels[source] ?? base.label }
            const withRating = revs.filter(r => r.rating != null)
            const avg = withRating.length ? (withRating.reduce((s, r) => s + (r.rating ?? 0), 0) / withRating.length).toFixed(1) : null
            const neg = revs.filter(r => r.sentiment === 'negative').length
            const empty = revs.length === 0
            return (
              <div key={source} style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: '12px', padding: '16px 18px', opacity: empty ? 0.55 : 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                  <span style={{ fontSize: '15px' }}>{meta.icon}</span>
                  <span style={{ fontSize: '12.5px', fontWeight: 600, color: 'white' }}>{meta.label}</span>
                </div>
                <div style={{ fontFamily: D, fontSize: '1.6rem', fontWeight: 900, color: avg ? '#FBBF24' : MUTED, lineHeight: 1 }}>{avg ? `${avg}★` : `${revs.length}`}</div>
                <div style={{ fontSize: '11px', color: MUTED, marginTop: '6px' }}>
                  {empty ? X.noneYet : X.opCount(revs.length, neg)}
                </div>
              </div>
            )
          })}
        </div>

        {/* Word frequency across everything */}
        {words.length > 0 && (
          <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: '14px', padding: '20px 24px' }}>
            <div style={{ fontSize: '12px', fontWeight: 600, color: 'white', marginBottom: '4px' }}>{X.whatSay}</div>
            <div style={{ fontSize: '11px', color: MUTED, marginBottom: '14px' }}>{X.pctDesc}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '9px' }}>
              {words.map(w => (
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
      </div>
    </div>
  )
}

// ── Crescimento — quais posts (e temas) performam melhor/pior ──

interface IgPost {
  id: string
  caption: string | null
  likes_count: number | null
  comments_count: number | null
  posted_at: string | null
}

function PostRow({ post, rank }: { post: IgPost; rank: number }) {
  const X = TX[useLang().lang]
  const engagement = (post.likes_count ?? 0) + (post.comments_count ?? 0)
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '12px 16px', background: CARD, border: `1px solid ${BORDER}`, borderRadius: '10px' }}>
      <div style={{ fontFamily: D, fontWeight: 900, color: MUTED, fontSize: '13px', width: '18px', flexShrink: 0 }}>{rank}</div>
      <div style={{ flex: 1, minWidth: 0, fontSize: '12.5px', color: 'white', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {post.caption ? post.caption.slice(0, 90) : X.noCaption}
      </div>
      <div style={{ display: 'flex', gap: '12px', flexShrink: 0, fontSize: '11.5px', color: MUTED }}>
        <span>❤️ {post.likes_count ?? 0}</span>
        <span>💬 {post.comments_count ?? 0}</span>
      </div>
      <div style={{ fontFamily: D, fontWeight: 800, color: ORANGE, fontSize: '13px', width: '46px', textAlign: 'right', flexShrink: 0 }}>{engagement}</div>
    </div>
  )
}

export function GrowthTab() {
  const { user } = useAuth()
  const X = TX[useLang().lang]
  const [posts, setPosts] = useState<IgPost[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) return
    supabase.from('companies').select('id').eq('user_id', user.id).maybeSingle().then(({ data: company }) => {
      if (!company) { setLoading(false); return }
      supabase.from('instagram_posts').select('id, caption, likes_count, comments_count, posted_at')
        .eq('company_id', company.id).not('posted_at', 'is', null).order('posted_at', { ascending: false }).limit(200)
        .then(({ data }) => { setPosts((data ?? []) as IgPost[]); setLoading(false) })
    })
  }, [user])

  if (loading) return <div style={{ padding: '28px 32px', color: MUTED, fontSize: '14px' }}>{X.loading}</div>

  if (posts.length === 0) {
    return (
      <div style={{ padding: '24px 32px' }}>
        <InsightReport tabKey="crescimento" />
        <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: '16px', padding: '60px', textAlign: 'center' }}>
          <div style={{ fontSize: '2.5rem', marginBottom: '16px' }}>📈</div>
          <div style={{ fontFamily: D, fontSize: '1.2rem', fontWeight: 700, color: 'white', marginBottom: '8px' }}>{X.noPostsTitle}</div>
          <p style={{ color: MUTED, fontSize: '13px', maxWidth: '400px', margin: '0 auto', lineHeight: 1.7 }}>
            {X.noPostsDesc}
          </p>
        </div>
      </div>
    )
  }

  const ranked = [...posts].sort((a, b) => ((b.likes_count ?? 0) + (b.comments_count ?? 0)) - ((a.likes_count ?? 0) + (a.comments_count ?? 0)))
  const top = ranked.slice(0, 5)
  const bottom = ranked.slice(-5).reverse()
  const topWordsFromBest = topWords(top.map(p => p.caption), 6)
  const topWordsFromWorst = topWords(bottom.map(p => p.caption), 6)

  return (
    <div>
      <div style={{ padding: '28px 32px 24px', borderBottom: `1px solid ${BORDER}` }}>
        <h1 style={{ fontFamily: D, fontSize: '1.5rem', fontWeight: 800, color: 'white', letterSpacing: '-0.02em', marginBottom: '4px' }}>{X.growth}</h1>
        <p style={{ color: MUTED, fontSize: '13px' }}>{X.growthSub(posts.length)}</p>
      </div>

      <div style={{ padding: '24px 32px' }}>
        <InsightReport tabKey="crescimento" />

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
          <div>
            <div style={{ fontSize: '12px', fontWeight: 700, color: '#4ade80', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '12px' }}>{X.best}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '18px' }}>
              {top.map((p, i) => <PostRow key={p.id} post={p} rank={i + 1} />)}
            </div>
            {topWordsFromBest.length > 0 && (
              <div style={{ background: CARD, border: '1px solid rgba(74,222,128,0.15)', borderRadius: '12px', padding: '14px 16px' }}>
                <div style={{ fontSize: '11px', color: MUTED, marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{X.themes}</div>
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                  {topWordsFromBest.map(w => (
                    <span key={w.word} style={{ fontSize: '11px', padding: '3px 10px', borderRadius: '99px', background: 'rgba(74,222,128,0.1)', color: '#4ade80', textTransform: 'capitalize' }}>{w.word}</span>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div>
            <div style={{ fontSize: '12px', fontWeight: 700, color: '#f87171', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '12px' }}>{X.worst}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '18px' }}>
              {bottom.map((p, i) => <PostRow key={p.id} post={p} rank={i + 1} />)}
            </div>
            {topWordsFromWorst.length > 0 && (
              <div style={{ background: CARD, border: '1px solid rgba(248,113,113,0.15)', borderRadius: '12px', padding: '14px 16px' }}>
                <div style={{ fontSize: '11px', color: MUTED, marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{X.themes}</div>
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                  {topWordsFromWorst.map(w => (
                    <span key={w.word} style={{ fontSize: '11px', padding: '3px 10px', borderRadius: '99px', background: 'rgba(248,113,113,0.1)', color: '#f87171', textTransform: 'capitalize' }}>{w.word}</span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
        <div style={{ marginTop: '16px', fontSize: '11px', color: 'rgba(255,255,255,0.25)' }}>
          {X.perfNote}
        </div>
      </div>
    </div>
  )
}

// ── Diagnóstico — saúde dos links e redes sociais ──

interface LinkCheck {
  key: string
  label: string
  configured: boolean
  url: string | null
  status: 'ok' | 'broken' | 'not_configured'
  http_status: number | null
  error_reason: string | null
}

const CHANNEL_ICON: Record<string, string> = {
  website_url: '🌐', instagram_url: '📸', facebook_url: '👍', tiktok_url: '🎵',
  google_maps_url: '⭐', tripadvisor_url: '🦉', reclame_aqui_url: '📣', ifood_url: '🍔',
}

export function LinkHealthTab() {
  const { session } = useAuth()
  const { lang } = useLang()
  const T = d[lang].posts.linkHealth
  const X = TX[lang]
  const [links, setLinks] = useState<LinkCheck[] | null>(null)
  const [checkedAt, setCheckedAt] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const check = async () => {
    if (!session) return
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/check-links-health`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? X.unknownErr)
      setLinks(data.links)
      setCheckedAt(data.checked_at)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e))
    }
    setLoading(false)
  }

  const configuredCount = links?.filter(l => l.configured).length ?? 0
  const brokenCount = links?.filter(l => l.status === 'broken').length ?? 0

  return (
    <div>
      <div style={{ padding: '28px 32px 24px', borderBottom: `1px solid ${BORDER}`, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontFamily: D, fontSize: '1.5rem', fontWeight: 800, color: 'white', letterSpacing: '-0.02em', marginBottom: '4px' }}>{T.title}</h1>
          <p style={{ color: MUTED, fontSize: '13px' }}>{T.subtitle}</p>
        </div>
        <button onClick={check} disabled={loading}
          style={{ padding: '9px 18px', background: loading ? 'rgba(255,109,41,0.3)' : ORANGE, color: '#000', fontWeight: 700, fontSize: '13px', borderRadius: '10px', border: 'none', cursor: loading ? 'not-allowed' : 'pointer' }}>
          {loading ? T.checking : `🔎 ${T.checkNow}`}
        </button>
      </div>

      <div style={{ padding: '24px 32px' }}>
        <InsightReport tabKey="diagnostico" />

        {error && (
          <div style={{ marginBottom: '16px', padding: '12px 16px', background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.2)', borderRadius: '10px', fontSize: '13px', color: '#f87171' }}>{error}</div>
        )}

        {!links ? (
          <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: '16px', padding: '60px', textAlign: 'center' }}>
            <div style={{ fontSize: '2.5rem', marginBottom: '16px' }}>🩺</div>
            <div style={{ color: MUTED, fontSize: '13px', maxWidth: '380px', margin: '0 auto' }}>
              {X.clickA}{T.checkNow}{X.clickB}
            </div>
          </div>
        ) : configuredCount === 0 ? (
          <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: '16px', padding: '60px', textAlign: 'center' }}>
            <div style={{ color: MUTED, fontSize: '13px' }}>{T.empty}</div>
          </div>
        ) : (
          <>
            {brokenCount > 0 && (
              <div style={{ marginBottom: '16px', padding: '5px 12px', display: 'inline-block', borderRadius: '99px', background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.2)', fontSize: '12px', color: '#f87171', fontWeight: 600 }}>
                {lang === 'en' ? X.brokenN(brokenCount) : `${brokenCount} ${brokenCount === 1 ? 'link com problema' : 'links com problema'}`}
              </div>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {links.map(l => (
                <div key={l.key} style={{
                  background: CARD, borderRadius: '12px', padding: '14px 18px', display: 'flex', alignItems: 'center', gap: '14px',
                  border: `1px solid ${l.status === 'broken' ? 'rgba(248,113,113,0.25)' : l.status === 'ok' ? 'rgba(74,222,128,0.15)' : BORDER}`,
                }}>
                  <span style={{ fontSize: '18px' }}>{CHANNEL_ICON[l.key] ?? '🔗'}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '13px', fontWeight: 600, color: 'white' }}>{X.linkLabels[l.key] ?? l.label}</div>
                    {l.url && <div style={{ fontSize: '11px', color: MUTED, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.url}</div>}
                    {l.status === 'broken' && l.error_reason && (
                      <div style={{ fontSize: '11.5px', color: '#f87171', marginTop: '4px', lineHeight: 1.5 }}>{l.error_reason}</div>
                    )}
                  </div>
                  <span style={{
                    fontSize: '11px', fontWeight: 700, padding: '4px 11px', borderRadius: '99px', flexShrink: 0, alignSelf: 'flex-start',
                    background: l.status === 'ok' ? 'rgba(74,222,128,0.1)' : l.status === 'broken' ? 'rgba(248,113,113,0.1)' : 'rgba(255,255,255,0.05)',
                    color: l.status === 'ok' ? '#4ade80' : l.status === 'broken' ? '#f87171' : MUTED,
                  }}>
                    {l.status === 'ok' ? `✓ ${T.ok}` : l.status === 'broken' ? `✗ ${T.broken}` : T.notConfigured}
                  </span>
                </div>
              ))}
            </div>
            {checkedAt && (
              <div style={{ marginTop: '14px', fontSize: '11px', color: 'rgba(255,255,255,0.25)', textAlign: 'right' }}>
                {T.lastChecked}: {new Date(checkedAt).toLocaleString(X.loc)}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
