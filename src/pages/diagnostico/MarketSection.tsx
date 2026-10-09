import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import type { InstagramData } from '../../lib/growthScore'

// Diagnóstico grátis v2 — "você vs. a concorrência da sua região" + o que
// está em alta. Os dados vêm da função diagnosis-market (Instagram real, lido
// na hora); esta tela só mostra. Some sozinha se a busca não estiver
// disponível (sem chave, teto do mês, sem hashtags) — a nota de sempre
// continua igual.

const ORANGE = '#FF6D29'
const CARD = '#1A1008'
const MUTED = '#BABABA'
const BORDER = 'rgba(255,255,255,0.07)'
const D = "'Bricolage Grotesque', system-ui, sans-serif"
const POLL_MS = 5000
const POLL_MAX_MS = 5 * 60 * 1000

interface Competitor { username: string; followers: number | null; posts_30d: number | null; avg_engagement_pct: number | null; video_share_pct: number | null }
interface TrendPost { url: string | null; owner: string | null; likes: number | null; comments: number | null; is_video: boolean | null; caption: string }
interface Market {
  status: 'none' | 'queued' | 'scanning' | 'profiling' | 'thinking' | 'done' | 'unavailable'
  competitors: Competitor[]
  trends: { top: TrendPost[]; video_share_pct: number | null; top_hashtags: string[] } | null
  insights: { descobertas: { titulo: string; texto: string }[]; ideias: { titulo: string; gancho: string; formato: string; base: string }[] } | null
}

const TX = {
  pt: {
    title: 'Você vs. a concorrência da sua região', sub: 'Lemos agora no Instagram os perfis e posts mais fortes da sua região.', legend: '“Posts 30d” = posts nos últimos 30 dias; “Engaj.” = curtidas + comentários por post, em % dos seguidores.',
    loading: 'Analisando seus concorrentes e o que está em alta na sua região… leva 1 a 2 minutos. Pode continuar lendo.',
    you: 'Você', followers: 'Seguidores', posts: 'Posts 30d', eng: 'Engaj.', video: '% vídeo', unknown: '—',
    trends: 'O que está em alta no seu nicho (últimos 30 dias)', likes: 'curtidas', comments: 'comentários', reels: 'Reels', photo: 'Foto', open: 'ver post',
    nicheVideo: (n: number) => `${n}% dos posts recentes nas hashtags da sua região são vídeo.`, tags: 'Hashtags mais usadas',
    finds: '3 descobertas sobre o seu perfil', ideas: 'Ideias de post pra você', base: 'Por quê:',
  },
  en: {
    title: 'You vs. competitors in your area', sub: 'We just read the strongest profiles and posts in your area on Instagram.', legend: '“Posts 30d” = posts in the last 30 days; “Engag.” = likes + comments per post, as % of followers.',
    loading: 'Analyzing your competitors and what is trending in your area… takes 1 to 2 minutes. Keep reading.',
    you: 'You', followers: 'Followers', posts: 'Posts 30d', eng: 'Engag.', video: '% video', unknown: '—',
    trends: 'What is trending in your niche (last 30 days)', likes: 'likes', comments: 'comments', reels: 'Reels', photo: 'Photo', open: 'see post',
    nicheVideo: (n: number) => `${n}% of recent posts on your area's hashtags are video.`, tags: 'Most used hashtags',
    finds: '3 findings about your profile', ideas: 'Post ideas for you', base: 'Why:',
  },
} as const

const fmt = (n: number | null, lang: 'pt' | 'en') => n === null ? null : n.toLocaleString(lang === 'en' ? 'en-US' : 'pt-BR')

function ownRow(ig: InstagramData | null): Competitor | null {
  if (!ig || ig.error || typeof ig.followers !== 'number') return null
  const posts = ig.posts ?? []
  const since = Date.now() - 30 * 864e5
  const avg = posts.length ? posts.reduce((a, p) => a + (p.likes ?? 0) + (p.comments ?? 0), 0) / posts.length : null
  return {
    username: ig.username ?? '', followers: ig.followers,
    posts_30d: posts.filter(p => p.ts && Date.parse(p.ts) >= since).length,
    avg_engagement_pct: avg !== null && ig.followers ? Math.round(1000 * avg / ig.followers) / 10 : null,
    video_share_pct: posts.length ? Math.round(100 * posts.filter(p => p.is_video).length / posts.length) : null,
  }
}

export default function MarketSection({ diagnosticId, own, lang }: { diagnosticId: string; own: InstagramData | null; lang: 'pt' | 'en' }) {
  const t = TX[lang]
  const [m, setM] = useState<Market | null>(null)
  const [waited, setWaited] = useState(0)

  const finished = m && ['none', 'done', 'unavailable'].includes(m.status)
  useEffect(() => {
    if (finished || waited > POLL_MAX_MS) return
    const h = setTimeout(async () => {
      const { data } = await supabase.functions.invoke('diagnosis-market', { body: { diagnostic_id: diagnosticId } })
      if (data && !data.error) setM(data as Market)
      setWaited(w => w + POLL_MS)
    }, m ? POLL_MS : 0)
    return () => clearTimeout(h)
  }, [diagnosticId, finished, waited, m])

  if (!m || m.status === 'none' || m.status === 'unavailable') return null
  const box: React.CSSProperties = { background: CARD, border: `1px solid ${BORDER}`, borderRadius: 20, padding: 20, marginBottom: 20 }
  const h2: React.CSSProperties = { fontFamily: D, fontSize: '1.05rem', fontWeight: 800, color: 'white', margin: '0 0 6px' }

  if (m.status !== 'done') return (
    <div style={box}>
      <h2 style={h2}>{t.title}</h2>
      <p style={{ fontSize: 13, color: MUTED, margin: 0, lineHeight: 1.6 }}>
        <span style={{ display: 'inline-block', width: 12, height: 12, border: '2px solid rgba(255,109,41,0.2)', borderTopColor: ORANGE, borderRadius: '50%', animation: 'spin 1s linear infinite', marginRight: 8, verticalAlign: 'middle' }} />
        {t.loading}
      </p>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )

  const me = ownRow(own)
  const rows = [...(me ? [{ ...me, username: t.you }] : []), ...m.competitors.map(c => ({ ...c, username: `@${c.username}` }))]
  const cell = (v: string | null) => <td style={{ padding: '8px 4px', textAlign: 'right', color: v ? 'white' : MUTED, whiteSpace: 'nowrap' }}>{v ?? t.unknown}</td>

  return (
    <>
      {rows.length > 1 && (
        <div style={box}>
          <h2 style={h2}>{t.title}</h2>
          <p style={{ fontSize: 12, color: MUTED, margin: '0 0 10px' }}>{t.sub} {t.legend}</p>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead><tr style={{ color: MUTED, fontSize: 11 }}>
                <th style={{ textAlign: 'left', padding: '6px', fontWeight: 600 }} />
                {[t.followers, t.posts, t.eng, t.video].map(h => <th key={h} style={{ textAlign: 'right', padding: '6px 4px', fontWeight: 600, lineHeight: 1.3, verticalAlign: 'bottom' }}>{h}</th>)}
              </tr></thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={r.username} style={{ borderTop: `1px solid ${BORDER}`, background: i === 0 && me ? 'rgba(255,109,41,0.06)' : 'transparent' }}>
                    <td style={{ padding: '8px 4px', color: i === 0 && me ? ORANGE : 'white', fontWeight: 700, maxWidth: 104, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.username}</td>
                    {cell(fmt(r.followers, lang))}
                    {cell(r.posts_30d === null ? null : String(r.posts_30d))}
                    {cell(r.avg_engagement_pct === null ? null : `${r.avg_engagement_pct}%`)}
                    {cell(r.video_share_pct === null ? null : `${r.video_share_pct}%`)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {m.insights && m.insights.descobertas.length > 0 && (
        <div style={box}>
          <h2 style={h2}>{t.finds}</h2>
          {m.insights.descobertas.map((d, i) => (
            <div key={i} style={{ padding: '10px 0', borderTop: i ? `1px solid ${BORDER}` : 'none' }}>
              <div style={{ fontSize: 13.5, fontWeight: 700, color: 'white', marginBottom: 3 }}>{d.titulo}</div>
              <div style={{ fontSize: 12.5, color: MUTED, lineHeight: 1.6 }}>{d.texto}</div>
            </div>
          ))}
        </div>
      )}

      {m.trends && m.trends.top.length > 0 && (
        <div style={box}>
          <h2 style={h2}>{t.trends}</h2>
          {m.trends.video_share_pct !== null && <p style={{ fontSize: 12.5, color: ORANGE, margin: '0 0 8px', fontWeight: 700 }}>{t.nicheVideo(m.trends.video_share_pct)}</p>}
          {m.trends.top.map((p, i) => (
            <div key={i} style={{ padding: '9px 0', borderTop: `1px solid ${BORDER}`, fontSize: 12.5 }}>
              <div style={{ color: 'white', lineHeight: 1.5, overflowWrap: 'anywhere' }}>{(p.caption.split('\n')[0] || '—').slice(0, 120)}</div>
              <div style={{ color: MUTED, marginTop: 3, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                {p.likes !== null && <span>{fmt(p.likes, lang)} {t.likes}</span>}
                {p.comments !== null && <span>{fmt(p.comments, lang)} {t.comments}</span>}
                {p.is_video !== null && <span>{p.is_video ? t.reels : t.photo}</span>}
                {p.owner && <span>@{p.owner}</span>}
                {p.url && <a href={p.url} target="_blank" rel="noreferrer" style={{ color: ORANGE, textDecoration: 'none' }}>{t.open} ↗</a>}
              </div>
            </div>
          ))}
          {m.trends.top_hashtags.length > 0 && (
            <div style={{ marginTop: 8, fontSize: 12, color: MUTED }}>{t.tags}: <span style={{ color: 'white' }}>{m.trends.top_hashtags.map(h => `#${h}`).join(' ')}</span></div>
          )}
        </div>
      )}

      {m.insights && m.insights.ideias.length > 0 && (
        <div style={box}>
          <h2 style={h2}>{t.ideas}</h2>
          {m.insights.ideias.map((d, i) => (
            <div key={i} style={{ padding: '10px 0', borderTop: i ? `1px solid ${BORDER}` : 'none' }}>
              <div style={{ fontSize: 13.5, fontWeight: 700, color: 'white' }}>{d.titulo} <span style={{ fontSize: 11, color: ORANGE, fontWeight: 700, marginLeft: 4 }}>{d.formato}</span></div>
              {d.gancho && <div style={{ fontSize: 12.5, color: 'white', marginTop: 3, fontStyle: 'italic' }}>“{d.gancho}”</div>}
              {d.base && <div style={{ fontSize: 12, color: MUTED, marginTop: 3, lineHeight: 1.5 }}>{t.base} {d.base}</div>}
            </div>
          ))}
        </div>
      )}
    </>
  )
}
