// Sinais do Instagram pro ICP (dono, 2026-10-15): imobiliária com Instagram
// SEM VÍDEO há tempo, OU FLOPADO (pouco engajamento pro tamanho), OU MAL
// PRODUZIDO — e com potencial de crescer. Tudo medido do perfil real
// (Apify instagram-scraper, a mesma coleta que já usávamos), nada estimado.

export interface IgSignals {
  followers: number
  posts: number
  avgEngagement: number          // curtidas + comentários por post (amostra)
  engagementRate: number | null  // % = avgEngagement / seguidores
  lastPostDate: string | null
  lastVideoDays: number | null   // null = nenhum vídeo na amostra
  videosInSample: number
  sample: number
  thumbs: string[]               // capas dos últimos posts (pra IA avaliar a produção)
}

// Limites do ICP — "sem vídeo", "flopado", "mal produzido", "já forte".
export const CONTENT_RULES = {
  noVideoDays: 90,          // último Reels há 90+ dias (ou nenhum na amostra)
  lowEngagementPct: 1,      // abaixo de 1% de engajamento por post = flopado
  poorQuality: 6,           // nota de produção 0-10 dada pela IA: ≤6 = mal produzido (teste 2026-10-15: a IA dá 6 até pra "arte amadora")
  strongVideoDays: 30, strongEngagementPct: 2, strongQuality: 7, // as 3 juntas = já forte, menos dor
  audienceFollowers: 300,   // tem público pra crescer
}

interface ApifyPost { type?: string; productType?: string; timestamp?: string; likesCount?: number; commentsCount?: number; displayUrl?: string }
interface ApifyProfile { followersCount?: number; postsCount?: number; latestPosts?: ApifyPost[] }

const daysSince = (iso: string) => Math.floor((Date.now() - new Date(iso).getTime()) / 86400000)

export async function scanInstagram(apifyToken: string, instagramUrl: string): Promise<IgSignals | null> {
  try {
    const url = `https://api.apify.com/v2/acts/apify~instagram-scraper/run-sync-get-dataset-items?token=${apifyToken}&timeout=40&memory=256`
    const res = await fetch(url, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ directUrls: [instagramUrl.replace(/\/$/, '')], resultsType: 'details', resultsLimit: 12 }),
      signal: AbortSignal.timeout(55_000),
    })
    if (!res.ok) return null
    const profile = ((await res.json()) as ApifyProfile[])[0]
    if (!profile) return null
    const posts = (profile.latestPosts ?? []).filter(p => p.timestamp).sort((a, b) => String(b.timestamp).localeCompare(String(a.timestamp)))
    const followers = profile.followersCount ?? 0
    const avgEngagement = posts.length ? Math.round(posts.reduce((s, p) => s + (p.likesCount ?? 0) + (p.commentsCount ?? 0), 0) / posts.length) : 0
    const videos = posts.filter(p => p.type === 'Video' || p.productType === 'clips')
    return {
      followers, posts: profile.postsCount ?? 0, avgEngagement,
      engagementRate: followers > 0 && posts.length ? Math.round((avgEngagement / followers) * 1000) / 10 : null,
      lastPostDate: posts[0]?.timestamp ?? null,
      lastVideoDays: videos[0]?.timestamp ? daysSince(videos[0].timestamp) : null,
      videosInSample: videos.length, sample: posts.length,
      thumbs: posts.map(p => p.displayUrl).filter((u): u is string => !!u).slice(0, 6),
    }
  } catch (e) {
    console.error('scanInstagram falhou', e)
    return null
  }
}

// Baixa as capas (o link da Meta expira e a IA não consegue abrir sozinha) e
// devolve em base64 pro Claude olhar. Pula o que falhar ou for grande demais.
export async function fetchThumbs(urls: string[]): Promise<{ type: 'image'; source: { type: 'base64'; media_type: string; data: string } }[]> {
  const out = await Promise.all(urls.slice(0, 6).map(async u => {
    try {
      const r = await fetch(u, { signal: AbortSignal.timeout(8000) })
      if (!r.ok) return null
      const mt = (r.headers.get('content-type') ?? 'image/jpeg').split(';')[0]
      if (!/^image\/(jpeg|png|webp)$/.test(mt)) return null
      const buf = new Uint8Array(await r.arrayBuffer())
      if (buf.length > 1_500_000) return null
      let bin = ''
      for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode(...buf.subarray(i, i + 0x8000))
      return { type: 'image' as const, source: { type: 'base64' as const, media_type: mt, data: btoa(bin) } }
    } catch { return null }
  }))
  return out.filter((x): x is NonNullable<typeof x> => !!x)
}

// Texto curto do diagnóstico de conteúdo, pra IA e pra tela.
export function contentFacts(ig: IgSignals): string {
  const v = ig.lastVideoDays == null ? `nenhum vídeo nos últimos ${ig.sample} posts` : `último vídeo há ${ig.lastVideoDays} dias`
  const e = ig.engagementRate == null ? 'engajamento desconhecido' : `engajamento médio ${String(ig.engagementRate).replace('.', ',')}% por post`
  return `${ig.followers} seguidores · ${v} · ${ig.videosInSample} vídeo(s) em ${ig.sample} posts · ${e}`
}
