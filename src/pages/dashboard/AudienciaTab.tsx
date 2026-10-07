import { useState, useEffect } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import { InsightReport } from '../../components/InsightReport'
import { useLang, type Lang } from '../../contexts/LanguageContext'

const ORANGE = '#FF6D29'
const CARD = '#150E08'
const MUTED = '#BABABA'
const D = "'Bricolage Grotesque', system-ui, sans-serif"
const BORDER = 'rgba(255,255,255,0.06)'
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string

interface SocialProfile {
  platform?: string
  username?: string
  full_name?: string
  followers?: number
  following?: number
  posts_count?: number
  videos_count?: number
  hearts?: number
  avg_likes?: number
  avg_comments?: number
  avg_views?: number
  engagement_rate?: number
  posting_freq_days?: number
  last_post?: string
  likes?: number
  category?: string
  error?: string
  scraped_at?: string
}

interface Company {
  id: string
  business_name: string | null
  business_type: string | null
  website_url: string | null
  instagram_url: string | null
  facebook_url: string | null
  tiktok_url: string | null
  google_maps_url: string | null
  google_place_id: string | null
  google_rating: number | null
  google_review_count: number | null
  tripadvisor_url: string | null
  reclame_aqui_url: string | null
  ifood_url: string | null
  social_data: Record<string, SocialProfile> | null
  social_scraped_at: string | null
}

interface PlatformConfig {
  key: 'google_place_id' | 'website_url' | 'instagram_url' | 'tiktok_url' | 'facebook_url' | 'tripadvisor_url' | 'reclame_aqui_url' | 'ifood_url'
  socialKey?: 'instagram' | 'tiktok' | 'facebook'
  name: string
  icon: string
  scrapable: boolean
  connectedNote?: string
  nameEn?: string
  connectedNoteEn?: string
  getReach: (bt: string, lang?: Lang) => string
  getTip: (bt: string, lang?: Lang) => string
}

const REV_NOTE = 'Avaliações importadas alimentam Insights e Revenue Opportunities.'
const REV_NOTE_EN = 'Imported reviews feed Insights and Revenue Opportunities.'

const PLATFORMS: PlatformConfig[] = [
  {
    key: 'google_place_id', name: 'Google Meu Negócio', nameEn: 'Google Business Profile', icon: '🔍', scrapable: true,
    connectedNote: REV_NOTE, connectedNoteEn: REV_NOTE_EN,
    getReach: () => '',
    getTip: (_bt, lang) => lang === 'en' ? 'Businesses verified on Google get 7× more clicks than unverified ones.' : 'Negócios verificados no Google recebem 7× mais cliques do que os não verificados.',
  },
  {
    key: 'website_url', name: 'Site', nameEn: 'Website', icon: '🌐', scrapable: false,
    getReach: () => '',
    getTip: (_bt, lang) => lang === 'en' ? 'A website with well-done basic SEO can triple organic traffic in 6 months.' : 'Um site com SEO básico bem feito pode triplicar o tráfego orgânico em 6 meses.',
  },
  {
    key: 'instagram_url', socialKey: 'instagram', name: 'Instagram', icon: '📸', scrapable: true,
    getReach: (bt, lang) => {
      const food = bt.includes('Restaurante') || bt.includes('Food'), beauty = bt.includes('Beleza') || bt.includes('Saúde')
      if (lang === 'en') return food ? '5,000–30,000 impressions/month' : beauty ? '3,000–20,000 impressions/month' : '2,000–15,000 impressions/month'
      return food ? '5.000–30.000 impressões/mês' : beauty ? '3.000–20.000 impressões/mês' : '2.000–15.000 impressões/mês'
    },
    getTip: (bt, lang) => {
      const food = bt.includes('Restaurante') || bt.includes('Food')
      if (lang === 'en') return food ? 'Restaurants that post 3×/week grow 40% faster.' : bt.includes('Beleza') ? '"Before and after" videos on Reels are the highest-engagement format.' : 'Educational posts + testimonials generate the highest save rates.'
      return food ? 'Restaurantes que postam 3×/semana crescem 40% mais rápido.' : bt.includes('Beleza') ? 'Vídeos de "antes e depois" no Reels são o formato de maior engajamento.' : 'Posts educativos + depoimentos geram as maiores taxas de salvamento.'
    },
  },
  {
    key: 'tiktok_url', socialKey: 'tiktok', name: 'TikTok', icon: '🎵', scrapable: true,
    getReach: (bt, lang) => {
      const food = bt.includes('Restaurante') || bt.includes('Food'), beauty = bt.includes('Beleza') || bt.includes('Saúde')
      if (lang === 'en') return food ? '20,000–200,000 organic views/month' : beauty ? '10,000–100,000 organic views/month' : '5,000–50,000 organic views/month'
      return food ? '20.000–200.000 views/mês orgânicos' : beauty ? '10.000–100.000 views/mês orgânicos' : '5.000–50.000 views/mês orgânicos'
    },
    getTip: (bt, lang) => {
      const food = bt.includes('Restaurante') || bt.includes('Food')
      if (lang === 'en') return food ? '15–30s videos showing the preparation are 3× more likely to go viral.' : bt.includes('Beleza') ? 'Time-lapse transformations are the highest organic-reach content on TikTok.' : 'TikTok has the highest free organic reach — local businesses reach 10k views in the first month.'
      return food ? 'Vídeos de 15–30s mostrando o preparo têm 3× mais chance de viralizar.' : bt.includes('Beleza') ? 'Transformações em time-lapse são o conteúdo de maior alcance orgânico no TikTok.' : 'TikTok tem maior alcance orgânico gratuito — empresas locais chegam a 10k views no primeiro mês.'
    },
  },
  {
    key: 'facebook_url', socialKey: 'facebook', name: 'Facebook', icon: '👥', scrapable: true,
    getReach: (bt, lang) => {
      const food = bt.includes('Restaurante') || bt.includes('Food')
      if (lang === 'en') return food ? '2,000–15,000 reach/month (35+ audience)' : '1,000–8,000 reach/month (35+ audience)'
      return food ? '2.000–15.000 alcance/mês (público 35+)' : '1.000–8.000 alcance/mês (público 35+)'
    },
    getTip: (_bt, lang) => lang === 'en' ? 'Facebook still dominates for audiences over 35. Local groups and events have significant organic reach.' : 'Facebook ainda domina para o público acima de 35 anos. Grupos locais e eventos têm alcance orgânico expressivo.',
  },
  {
    key: 'tripadvisor_url', name: 'TripAdvisor', icon: '🦉', scrapable: true,
    connectedNote: REV_NOTE, connectedNoteEn: REV_NOTE_EN,
    getReach: (bt, lang) => {
      const food = bt.includes('Restaurante') || bt.includes('Food')
      if (lang === 'en') return food ? 'Decisive for tourists and visitors from out of town' : 'Relevant if your business receives tourists'
      return food ? 'Decisivo para turistas e visitantes de fora da cidade' : 'Relevante se seu negócio recebe turistas'
    },
    getTip: (_bt, lang) => lang === 'en' ? 'TripAdvisor is the first stop for anyone researching before visiting a city. Replying to reviews increases trust.' : 'TripAdvisor é a primeira parada de quem pesquisa antes de visitar uma cidade. Responder avaliações aumenta a confiança.',
  },
  {
    key: 'reclame_aqui_url', name: 'Reclame Aqui', icon: '📢', scrapable: true,
    connectedNote: 'Reclamações importadas alimentam Insights e Revenue Opportunities.', connectedNoteEn: 'Imported complaints feed Insights and Revenue Opportunities.',
    getReach: () => '',
    getTip: (_bt, lang) => lang === 'en' ? 'Companies that answer complaints within 24h win back the trust of up to 70% of dissatisfied customers.' : 'Empresas que respondem reclamações em até 24h recuperam a confiança de até 70% dos clientes insatisfeitos.',
  },
  {
    key: 'ifood_url', name: 'iFood', icon: '🛵', scrapable: true,
    connectedNote: REV_NOTE, connectedNoteEn: REV_NOTE_EN,
    getReach: (_bt, lang) => lang === 'en' ? 'Decisive channel for delivery and take-away' : 'Canal decisivo para delivery e take-away',
    getTip: (_bt, lang) => lang === 'en' ? 'Low ratings on iFood reduce visibility in the app. Replying quickly to negative reviews helps keep the ranking.' : 'Notas baixas no iFood reduzem a visibilidade no app. Responder avaliações negativas rapidamente ajuda a manter o ranking.',
  },
]

const TX = {
  pt: {
    analyzeErr: 'Erro ao analisar:', analyzedOn: 'Analisado em', followers: 'Seguidores', posts: 'Posts', engagement: 'Engajamento', avgLikes: 'Média likes', postFreq: 'Freq. postagem',
    videos: 'Vídeos', avgViews: 'Média views', totalLikes: 'Total curtidas', category: 'Categoria',
    unknownErr: 'Erro desconhecido', done: 'concluído', errIn: (e: string) => ` (erro em: ${e})`, analysisDone: (ok: string, errs: string) => `✓ Análise concluída: ${ok}${errs}`,
    loading: 'Carregando...', notFound: 'Perfil não encontrado', notFoundDesc: 'Configure seu negócio nas Configurações para ativar a análise de presença digital.',
    presence: 'Presença Digital', channelsActive: 'canais ativos', analyzing: 'Analisando...', analyze: '✦ Analisar redes sociais', activeChannels: 'Canais ativos', active: '✓ Ativo',
    reviewsShort: 'aval.', seeDiag: 'Ver Diagnóstico do site ↗', clickAnalyze: 'Clique em "Analisar" para ver métricas', missingTitle: 'Canais ausentes — potencial não explorado', missing: 'Ausente',
    addLink1: 'Adicione o link nas', settings: 'Configurações', addLink2: 'para ativar',
  },
  en: {
    analyzeErr: 'Analysis error:', analyzedOn: 'Analyzed on', followers: 'Followers', posts: 'Posts', engagement: 'Engagement', avgLikes: 'Avg. likes', postFreq: 'Post frequency',
    videos: 'Videos', avgViews: 'Avg. views', totalLikes: 'Total likes', category: 'Category',
    unknownErr: 'Unknown error', done: 'done', errIn: (e: string) => ` (error in: ${e})`, analysisDone: (ok: string, errs: string) => `✓ Analysis complete: ${ok}${errs}`,
    loading: 'Loading...', notFound: 'Profile not found', notFoundDesc: 'Set up your business in Settings to enable the digital presence analysis.',
    presence: 'Digital Presence', channelsActive: 'active channels', analyzing: 'Analyzing...', analyze: '✦ Analyze social networks', activeChannels: 'Active channels', active: '✓ Active',
    reviewsShort: 'reviews', seeDiag: 'See website Diagnostic ↗', clickAnalyze: 'Click "Analyze" to see metrics', missingTitle: 'Missing channels — untapped potential', missing: 'Missing',
    addLink1: 'Add the link in', settings: 'Settings', addLink2: 'to activate',
  },
}

function fmt(n: number | undefined): string {
  if (n == null) return '—'
  return n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M` : n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n)
}

function Stat({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div>
      <div style={{ fontSize: '10px', color: MUTED, marginBottom: '2px' }}>{label}</div>
      <div style={{ fontSize: '14px', fontWeight: 700, color, fontFamily: D }}>{value}</div>
    </div>
  )
}

function SocialStats({ profile, platform }: { profile: SocialProfile; platform: PlatformConfig }) {
  const { lang } = useLang()
  const tx = TX[lang]
  if (profile.error) {
    return <div style={{ fontSize: '11px', color: '#f87171', marginTop: '4px' }}>{tx.analyzeErr} {profile.error.slice(0, 80)}</div>
  }
  const scrapedDate = profile.scraped_at ? new Date(profile.scraped_at).toLocaleDateString(lang === 'en' ? 'en-US' : 'pt-BR') : null
  return (
    <div style={{ marginTop: '8px' }}>
      <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap', marginBottom: '6px' }}>
        {platform.socialKey === 'instagram' && (
          <>
            <Stat label={tx.followers} value={fmt(profile.followers)} color="white" />
            <Stat label={tx.posts} value={fmt(profile.posts_count)} color={MUTED} />
            {profile.engagement_rate != null && <Stat label={tx.engagement} value={`${profile.engagement_rate}%`} color={profile.engagement_rate >= 3 ? '#4ade80' : profile.engagement_rate >= 1 ? '#FBBF24' : '#f87171'} />}
            {profile.avg_likes != null && <Stat label={tx.avgLikes} value={fmt(profile.avg_likes)} color={MUTED} />}
            {profile.posting_freq_days != null && <Stat label={tx.postFreq} value={`${profile.posting_freq_days}d`} color={profile.posting_freq_days <= 3 ? '#4ade80' : profile.posting_freq_days <= 7 ? '#FBBF24' : '#f87171'} />}
          </>
        )}
        {platform.socialKey === 'tiktok' && (
          <>
            <Stat label={tx.followers} value={fmt(profile.followers)} color="white" />
            <Stat label={tx.videos} value={fmt(profile.videos_count)} color={MUTED} />
            {profile.avg_views != null && <Stat label={tx.avgViews} value={fmt(profile.avg_views)} color={profile.avg_views >= 10000 ? '#4ade80' : profile.avg_views >= 1000 ? '#FBBF24' : MUTED} />}
            {profile.hearts != null && <Stat label={tx.totalLikes} value={fmt(profile.hearts)} color={MUTED} />}
          </>
        )}
        {platform.socialKey === 'facebook' && (
          <>
            <Stat label={tx.followers} value={fmt(profile.followers ?? profile.likes)} color="white" />
            {profile.category && <Stat label={tx.category} value={profile.category} color={MUTED} />}
          </>
        )}
      </div>
      {scrapedDate && <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.2)' }}>{tx.analyzedOn} {scrapedDate}</div>}
    </div>
  )
}

export default function AudienciaTab() {
  const { user, session } = useAuth()
  const { lang } = useLang()
  const tx = TX[lang]
  const [company, setCompany] = useState<Company | null>(null)
  const [loading, setLoading] = useState(true)
  const [analyzing, setAnalyzing] = useState(false)
  const [analyzeMsg, setAnalyzeMsg] = useState('')
  const [analyzeErr, setAnalyzeErr] = useState('')

  useEffect(() => { if (user) load() }, [user])

  const load = async (skipSet = false) => {
    if (!user) return
    if (!skipSet) setLoading(true)
    const { data: co } = await supabase
      .from('companies')
      .select('id, business_name, business_type, website_url, instagram_url, facebook_url, tiktok_url, google_maps_url, google_place_id, google_rating, google_review_count, tripadvisor_url, reclame_aqui_url, ifood_url, social_data, social_scraped_at')
      .eq('user_id', user.id)
      .maybeSingle()
    setCompany(co as Company | null)
    if (!skipSet) setLoading(false)
  }

  const handleAnalyze = async () => {
    if (!session) return
    setAnalyzing(true); setAnalyzeMsg(''); setAnalyzeErr('')
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/apify-sync`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? tx.unknownErr)
      const ok = (data.scraped as string[] | undefined)?.join(', ') ?? tx.done
      const errs = data.errors?.length ? tx.errIn((data.errors as string[]).join(', ')) : ''
      setAnalyzeMsg(tx.analysisDone(ok, errs))
      await load(true)
    } catch (e: unknown) {
      setAnalyzeErr(e instanceof Error ? e.message : String(e))
    }
    setAnalyzing(false)
  }

  if (loading) return <div style={{ padding: '28px 32px', color: MUTED, fontSize: '14px' }}>{tx.loading}</div>
  if (!company) return (
    <div style={{ padding: '28px 32px' }}>
      <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: '14px', padding: '48px 32px', textAlign: 'center' }}>
        <div style={{ fontSize: '2rem', marginBottom: '12px' }}>📡</div>
        <div style={{ fontFamily: D, fontSize: '1.1rem', fontWeight: 700, color: 'white', marginBottom: '8px' }}>{tx.notFound}</div>
        <div style={{ fontSize: '13px', color: MUTED }}>{tx.notFoundDesc}</div>
      </div>
    </div>
  )

  const bt = company.business_type ?? ''
  const sd = company.social_data ?? {}
  const isConnected = (p: PlatformConfig): boolean => {
    if (p.key === 'google_place_id') return !!company.google_place_id
    return !!(company[p.key as keyof Company])
  }
  const hasScrapable = PLATFORMS.some(p => p.scrapable && isConnected(p))
  const lastScrape = company.social_scraped_at ? new Date(company.social_scraped_at).toLocaleDateString(lang === 'en' ? 'en-US' : 'pt-BR') : null
  const connected = PLATFORMS.filter(p => isConnected(p))
  const missing = PLATFORMS.filter(p => !isConnected(p))

  return (
    <div style={{ padding: '24px 32px' }}>
      <InsightReport tabKey="audiencia" />

      <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: '14px', overflow: 'hidden' }}>
        <div style={{ padding: '16px 22px', borderBottom: `1px solid ${BORDER}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
          <div>
            <span style={{ color: 'white', fontWeight: 700, fontSize: '14px' }}>{tx.presence}</span>
            {lastScrape && <span style={{ fontSize: '11px', color: MUTED, marginLeft: '10px' }}>{tx.analyzedOn} {lastScrape}</span>}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '11px', color: MUTED }}>{connected.length}/{PLATFORMS.length} {tx.channelsActive}</span>
            {hasScrapable && (
              <button
                onClick={handleAnalyze} disabled={analyzing}
                style={{ padding: '6px 14px', background: analyzing ? 'rgba(255,109,41,0.2)' : 'rgba(255,109,41,0.12)', color: ORANGE, fontWeight: 700, fontSize: '12px', borderRadius: '8px', border: '1px solid rgba(255,109,41,0.25)', cursor: analyzing ? 'not-allowed' : 'pointer' }}>
                {analyzing ? tx.analyzing : tx.analyze}
              </button>
            )}
          </div>
        </div>

        {(analyzeMsg || analyzeErr) && (
          <div style={{ padding: '10px 22px', background: analyzeErr ? 'rgba(248,113,113,0.06)' : 'rgba(74,222,128,0.06)', borderBottom: `1px solid ${BORDER}`, fontSize: '12px', color: analyzeErr ? '#f87171' : '#4ade80' }}>
            {analyzeErr || analyzeMsg}
          </div>
        )}

        {connected.length > 0 && (
          <div style={{ borderBottom: missing.length > 0 ? `1px solid ${BORDER}` : 'none' }}>
            <div style={{ padding: '12px 22px 4px', fontSize: '10px', fontWeight: 700, color: '#4ade80', textTransform: 'uppercase', letterSpacing: '0.1em' }}>{tx.activeChannels}</div>
            {connected.map((p, i) => {
              const profile = p.socialKey ? sd[p.socialKey] : null
              const hasData = profile && !profile.error
              return (
                <div key={p.key} style={{ padding: '14px 22px', borderTop: i > 0 ? `1px solid ${BORDER}` : 'none', display: 'flex', gap: '14px', alignItems: 'flex-start' }}>
                  <div style={{ width: '38px', height: '38px', borderRadius: '10px', background: 'rgba(74,222,128,0.08)', border: '1px solid rgba(74,222,128,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '17px', flexShrink: 0 }}>
                    {p.icon}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '13px', fontWeight: 700, color: 'white' }}>{lang === 'en' && p.nameEn ? p.nameEn : p.name}</span>
                      <span style={{ fontSize: '10px', padding: '2px 8px', borderRadius: '99px', background: 'rgba(74,222,128,0.1)', color: '#4ade80', fontWeight: 700, border: '1px solid rgba(74,222,128,0.2)' }}>{tx.active}</span>
                      {p.key === 'google_place_id' && company.google_rating && (
                        <span style={{ fontSize: '11px', color: '#FBBF24' }}>{company.google_rating}★ · {company.google_review_count ?? '?'} {tx.reviewsShort}</span>
                      )}
                      {p.key === 'website_url' && (
                        <span style={{ fontSize: '11px', color: MUTED }}>{tx.seeDiag}</span>
                      )}
                      {p.socialKey && p.scrapable && !hasData && !profile?.error && (
                        <span style={{ fontSize: '11px', color: MUTED }}>{tx.clickAnalyze}</span>
                      )}
                      {!p.socialKey && p.key !== 'google_place_id' && p.key !== 'website_url' && p.connectedNote && (
                        <span style={{ fontSize: '11px', color: MUTED }}>{lang === 'en' && p.connectedNoteEn ? p.connectedNoteEn : p.connectedNote}</span>
                      )}
                    </div>
                    {profile && <SocialStats profile={profile} platform={p} />}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {missing.length > 0 && (
          <div>
            <div style={{ padding: '12px 22px 4px', fontSize: '10px', fontWeight: 700, color: ORANGE, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
              {tx.missingTitle}
            </div>
            {missing.map((p, i) => (
              <div key={p.key} style={{ padding: '14px 22px', borderTop: i > 0 ? `1px solid ${BORDER}` : 'none', display: 'flex', gap: '14px', alignItems: 'flex-start' }}>
                <div style={{ width: '38px', height: '38px', borderRadius: '10px', background: 'rgba(255,255,255,0.03)', border: `1px solid ${BORDER}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '17px', flexShrink: 0, opacity: 0.5 }}>
                  {p.icon}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '13px', fontWeight: 700, color: 'white' }}>{lang === 'en' && p.nameEn ? p.nameEn : p.name}</span>
                    <span style={{ fontSize: '10px', padding: '2px 8px', borderRadius: '99px', background: 'rgba(255,109,41,0.1)', color: ORANGE, fontWeight: 700, border: '1px solid rgba(255,109,41,0.2)' }}>{tx.missing}</span>
                    {p.getReach(bt, lang) && (
                      <span style={{ fontSize: '11px', color: '#f87171', fontWeight: 600 }}>−{p.getReach(bt, lang)}</span>
                    )}
                  </div>
                  <p style={{ fontSize: '12px', color: MUTED, lineHeight: 1.65, margin: '0 0 6px' }}>
                    💡 {p.getTip(bt, lang)}
                  </p>
                  <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.25)' }}>
                    <span style={{ color: ORANGE }}>→</span> {tx.addLink1} <strong style={{ color: 'rgba(255,255,255,0.4)' }}>{tx.settings}</strong> {tx.addLink2}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
