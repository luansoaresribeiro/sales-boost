import { useState } from 'react'
import { useLang } from '../../../contexts/LanguageContext'
import { ORANGE, CARD, MUTED, BORDER, callMarketingAi, timeAgo, type TrackingSnapshot, type Insight } from './shared'

const TX = {
  pt: {
    err: 'Erro ao coletar dados', noIg: 'Conecte o Instagram da empresa em Configurações pra ativar o Tracking Intelligence.',
    intro: 'Métricas reais coletadas do Instagram — sem estimativa, só o que o Apify retorna.', collecting: 'Coletando...', collect: '🔄 Coletar agora',
    followers: 'Seguidores', likes: 'Média de curtidas', comments: 'Média de comentários', engagement: 'Engajamento', since: 'desde a última coleta',
    empty: 'Nenhuma coleta ainda. Clique em "Coletar agora" pra puxar os dados reais do Instagram.', patterns: 'Padrões detectados',
    need2: 'Precisa de pelo menos 2 coletas pra comparar e detectar um padrão real.', noPattern: 'Nenhum padrão identificado ainda.',
    history: 'Histórico de coletas', followersLc: 'seguidores', likesPost: 'curtidas/post',
  },
  en: {
    err: 'Error collecting data', noIg: 'Connect the company\'s Instagram in Settings to enable Tracking Intelligence.',
    intro: 'Real metrics collected from Instagram — no estimates, only what Apify returns.', collecting: 'Collecting...', collect: '🔄 Collect now',
    followers: 'Followers', likes: 'Average likes', comments: 'Average comments', engagement: 'Engagement', since: 'since last collection',
    empty: 'No collection yet. Click "Collect now" to pull the real Instagram data.', patterns: 'Patterns detected',
    need2: 'Needs at least 2 collections to compare and detect a real pattern.', noPattern: 'No pattern identified yet.',
    history: 'Collection history', followersLc: 'followers', likesPost: 'likes/post',
  },
}

export default function TrackingTab({
  accessToken, snapshots, insights, hasInstagram, onRefresh,
}: {
  accessToken: string; snapshots: TrackingSnapshot[]; insights: Insight[]; hasInstagram: boolean
  onRefresh: () => Promise<void>
}) {
  const { lang } = useLang()
  const t = TX[lang]
  const [running, setRunning] = useState(false)
  const [error, setError] = useState('')

  const runTracking = async () => {
    setRunning(true)
    setError('')
    try {
      await callMarketingAi(accessToken, 'run_tracking')
      await onRefresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : t.err)
    }
    setRunning(false)
  }

  const latest = snapshots[0]
  const prior = snapshots[1]
  const delta = (a: number | null | undefined, b: number | null | undefined) => (a != null && b != null) ? a - b : null

  if (!hasInstagram) {
    return (
      <div style={{ padding: '32px', textAlign: 'center', color: MUTED, fontSize: '13px' }}>
        {t.noIg}
      </div>
    )
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
        <div style={{ fontSize: '12.5px', color: MUTED }}>{t.intro}</div>
        <button onClick={runTracking} disabled={running}
          style={{ padding: '8px 16px', background: ORANGE, color: '#000', fontWeight: 700, fontSize: '12px', borderRadius: '8px', border: 'none', cursor: 'pointer' }}>
          {running ? t.collecting : t.collect}
        </button>
      </div>
      {error && <div style={{ color: '#f87171', fontSize: '12px', marginBottom: '14px' }}>{error}</div>}

      {latest ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '20px' }}>
          {[
            { label: t.followers, value: latest.followers, d: delta(latest.followers, prior?.followers) },
            { label: t.likes, value: latest.avg_likes != null ? Math.round(latest.avg_likes) : null, d: delta(latest.avg_likes, prior?.avg_likes) },
            { label: t.comments, value: latest.avg_comments != null ? Math.round(latest.avg_comments) : null, d: delta(latest.avg_comments, prior?.avg_comments) },
            { label: t.engagement, value: latest.engagement_rate != null ? `${latest.engagement_rate}%` : null, d: null },
          ].map((m, i) => (
            <div key={i} style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: '12px', padding: '16px' }}>
              <div style={{ fontSize: '10.5px', color: MUTED, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' }}>{m.label}</div>
              <div style={{ fontSize: '20px', fontWeight: 800, color: 'white' }}>{m.value ?? '—'}</div>
              {m.d != null && <div style={{ fontSize: '11px', color: m.d >= 0 ? '#4ade80' : '#f87171', marginTop: '2px' }}>{m.d >= 0 ? '+' : ''}{Math.round(m.d)} {t.since}</div>}
            </div>
          ))}
        </div>
      ) : (
        <div style={{ padding: '24px', textAlign: 'center', color: MUTED, fontSize: '12.5px', background: CARD, border: `1px solid ${BORDER}`, borderRadius: '12px', marginBottom: '20px' }}>
          {t.empty}
        </div>
      )}

      <div style={{ fontSize: '13px', fontWeight: 700, color: 'white', marginBottom: '10px' }}>{t.patterns}</div>
      {insights.length === 0 ? (
        <div style={{ color: MUTED, fontSize: '12.5px' }}>{snapshots.length < 2 ? t.need2 : t.noPattern}</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '20px' }}>
          {insights.map(ins => (
            <div key={ins.id} style={{ padding: '12px 14px', background: CARD, border: `1px solid ${BORDER}`, borderRadius: '10px' }}>
              <div style={{ fontSize: '12.5px', fontWeight: 600, color: 'white', marginBottom: '3px' }}>{ins.title}</div>
              <div style={{ fontSize: '11.5px', color: MUTED, lineHeight: 1.5 }}>{ins.description}</div>
            </div>
          ))}
        </div>
      )}

      {snapshots.length > 0 && (
        <>
          <div style={{ fontSize: '13px', fontWeight: 700, color: 'white', marginBottom: '10px' }}>{t.history}</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {snapshots.slice(0, 10).map(s => (
              <div key={s.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', background: 'rgba(255,255,255,0.02)', borderRadius: '8px', fontSize: '11.5px' }}>
                <span style={{ color: MUTED }}>{timeAgo(s.collected_at, lang)}</span>
                <span style={{ color: 'white' }}>{s.followers ?? '—'} {t.followersLc} · {s.avg_likes != null ? Math.round(s.avg_likes) : '—'} {t.likesPost}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
