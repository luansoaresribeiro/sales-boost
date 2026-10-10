import { useEffect, useRef, useState } from 'react'
import { supabase } from '../../lib/supabase'
import type { InstagramData } from '../../lib/growthScore'

// Diagnóstico grátis v2 — "você vs. a concorrência da sua região" + o que
// está em alta. Os dados vêm da função diagnosis-market (Instagram real, lido
// na hora); esta tela só mostra. Enquanto a análise roda, a página inteira
// mostra o DiagnosisLoader (pedido do dono 2026-10-10: nada de resultado pela
// metade). Se a busca não estiver disponível (sem chave, teto do mês, sem
// hashtags), a seção some e a nota de sempre aparece igual.

const ORANGE = '#FF6D29'
const CARD = '#1A1008'
const MUTED = '#BABABA'
const BORDER = 'rgba(255,255,255,0.07)'
const D = "'Bricolage Grotesque', system-ui, sans-serif"
const POLL_MS = 2500
const POLL_MAX_MS = 3 * 60 * 1000

interface Competitor { username: string; followers: number | null; posts_30d: number | null; avg_engagement_pct: number | null; video_share_pct: number | null }
interface TrendPost { url: string | null; owner: string | null; likes: number | null; comments: number | null; is_video: boolean | null; caption: string }
export interface Market {
  status: 'none' | 'queued' | 'scanning' | 'profiling' | 'thinking' | 'done' | 'unavailable'
  competitors: Competitor[]
  trends: { top: TrendPost[]; video_share_pct: number | null; top_hashtags: string[] } | null
  insights: { descobertas: { titulo: string; texto: string }[]; ideias: { titulo: string; gancho: string; formato: string; base: string }[] } | null
}

const TX = {
  pt: {
    title: 'Você vs. a concorrência da sua região', sub: 'Lemos agora no Instagram os perfis e posts mais fortes da sua região.', legend: '“Posts 30d” = posts nos últimos 30 dias; “Engaj.” = curtidas + comentários por post, em % dos seguidores.',
    you: 'Você', followers: 'Seguidores', posts: 'Posts 30d', eng: 'Engaj.', video: '% vídeo', unknown: '—',
    trends: 'O que está em alta no seu nicho (últimos 30 dias)', likes: 'curtidas', comments: 'comentários', reels: 'Reels', photo: 'Foto', open: 'ver post',
    nicheVideo: (n: number) => `${n}% dos posts recentes nas hashtags da sua região são vídeo.`, tags: 'Hashtags mais usadas',
    finds: 'O que está te fazendo perder clientes no Instagram', findsRegion: 'Descobertas sobre a concorrência da sua região', ideas: 'Ideias de post pra você', base: 'Por quê:',
  },
  en: {
    title: 'You vs. competitors in your area', sub: 'We just read the strongest profiles and posts in your area on Instagram.', legend: '“Posts 30d” = posts in the last 30 days; “Engag.” = likes + comments per post, as % of followers.',
    you: 'You', followers: 'Followers', posts: 'Posts 30d', eng: 'Engag.', video: '% video', unknown: '—',
    trends: 'What is trending in your niche (last 30 days)', likes: 'likes', comments: 'comments', reels: 'Reels', photo: 'Photo', open: 'see post',
    nicheVideo: (n: number) => `${n}% of recent posts on your area's hashtags are video.`, tags: 'Most used hashtags',
    finds: 'What is costing you clients on Instagram', findsRegion: 'Findings about competitors in your area', ideas: 'Post ideas for you', base: 'Why:',
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

// Acompanha a análise da concorrência (diagnosis-market). O servidor já
// começa sozinho quando o diagnóstico é criado; aqui só perguntamos o estado
// (e, se o servidor não estiver tocando, cada chamada avança uma etapa).
// `settled` = terminou, não vai rodar, ou passou do tempo máximo de espera.
export function useMarket(diagnosticId: string, enabled: boolean) {
  const [m, setM] = useState<Market | null>(null)
  const [waited, setWaited] = useState(0)
  const finished = !!m && ['none', 'done', 'unavailable'].includes(m.status)
  const timedOut = waited > POLL_MAX_MS
  useEffect(() => {
    if (!enabled || finished || timedOut) return
    const h = setTimeout(async () => {
      const { data, error } = await supabase.functions.invoke('diagnosis-market', { body: { diagnostic_id: diagnosticId } })
      if (data && !data.error) setM(data as Market)
      else if (error && waited > 20000 && !m) setM({ status: 'unavailable', competitors: [], trends: null, insights: null })
      setWaited(w => w + POLL_MS)
    }, m ? POLL_MS : 0)
    return () => clearTimeout(h)
  }, [diagnosticId, enabled, finished, timedOut, waited, m])
  return { m, settled: finished || timedOut, waited }
}

const LTX = {
  pt: { title: 'Preparando seu diagnóstico', steps: ['Lendo o seu Instagram', 'Buscando concorrentes da sua região', 'Comparando você com eles', 'Escrevendo sua análise'], note: 'Leva cerca de 1 minuto. Não feche esta página.' },
  en: { title: 'Preparing your diagnosis', steps: ['Reading your Instagram', 'Finding competitors in your area', 'Comparing you with them', 'Writing your analysis'], note: 'Takes about 1 minute. Keep this page open.' },
} as const

// Tela de espera: logo + barra de progresso. A barra anda pela etapa real
// (status do servidor) e, dentro da etapa, suaviza com o tempo — nunca chega
// a 100% antes de terminar.
export function DiagnosisLoader({ stage, lang, embedded = false }: { stage: Market['status'] | 'instagram'; lang: 'pt' | 'en'; embedded?: boolean }) {
  const t = LTX[lang]
  const idx = stage === 'instagram' ? 0 : stage === 'profiling' ? 2 : stage === 'thinking' || stage === 'done' ? 3 : 1
  const band: [number, number, number][] = [[4, 25, 15], [25, 62, 30], [62, 80, 10], [80, 97, 12]] // início, fim, segundos típicos
  const [a, b, sec] = band[idx]
  const start = useRef<{ stage: string; at: number }>({ stage: '', at: 0 })
  const [pct, setPct] = useState(4)
  useEffect(() => {
    const step = () => {
      if (start.current.stage !== stage) start.current = { stage, at: Date.now() }
      const el = (Date.now() - start.current.at) / 1000
      const next = stage === 'done' ? 100 : Math.round(a + (b - a) * (1 - Math.exp(-el / sec)))
      setPct(p => Math.max(p, next))
    }
    const h = setInterval(step, 400)
    return () => clearInterval(h)
  }, [stage, a, b, sec])
  return (
    <div role="status" aria-live="polite" style={{ minHeight: embedded ? 320 : '80vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ width: '100%', maxWidth: 360, textAlign: 'center' }}>
        <div style={{ fontFamily: D, fontSize: '2.2rem', fontWeight: 900, color: 'white', letterSpacing: '-0.03em', marginBottom: 22, animation: 'sbpulse 1.6s ease-in-out infinite' }}>
          <span style={{ color: ORANGE }}>Sales</span>Boost
        </div>
        <div style={{ fontFamily: D, fontSize: '1.05rem', fontWeight: 800, color: 'white', marginBottom: 14 }}>{t.title}</div>
        <div aria-label={`${pct}%`} style={{ height: 8, background: 'rgba(255,255,255,0.08)', borderRadius: 99, overflow: 'hidden', marginBottom: 10 }}>
          <div style={{ height: '100%', width: `${pct}%`, background: ORANGE, borderRadius: 99, transition: 'width 0.4s ease' }} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, color: MUTED, marginBottom: 18 }}>
          <span>{t.steps[idx]}…</span><span style={{ color: 'white', fontWeight: 700 }}>{pct}%</span>
        </div>
        <div style={{ textAlign: 'left', display: 'inline-block' }}>
          {t.steps.map((st, i) => (
            <div key={st} style={{ fontSize: 13, color: i < idx ? '#4ade80' : i === idx ? 'white' : MUTED, padding: '3px 0', fontWeight: i === idx ? 700 : 400 }}>
              {i < idx ? '✓' : i === idx ? '•' : '○'} {st}
            </div>
          ))}
        </div>
        <p style={{ fontSize: 12, color: MUTED, marginTop: 16 }}>{t.note}</p>
      </div>
      <style>{`@keyframes sbpulse{0%,100%{opacity:1}50%{opacity:.55}}`}</style>
    </div>
  )
}

export default function MarketSection({ m, own, lang }: { m: Market | null; own: InstagramData | null; lang: 'pt' | 'en' }) {
  const t = TX[lang]
  if (!m || m.status !== 'done') return null
  const box: React.CSSProperties = { background: CARD, border: `1px solid ${BORDER}`, borderRadius: 20, padding: 20, marginBottom: 20 }
  const h2: React.CSSProperties = { fontFamily: D, fontSize: '1.05rem', fontWeight: 800, color: 'white', margin: '0 0 6px' }

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
          <h2 style={h2}>{me ? t.finds : t.findsRegion}</h2>
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
