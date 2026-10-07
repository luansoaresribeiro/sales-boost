// Verificação mínima da fórmula (NÃO entra no build). Rodar:
//   npx tsx scripts/check-growth-score.ts
import { computeGrowthScore, type InstagramData } from '../src/lib/growthScore'

const day = (n: number) => new Date(Date.parse('2026-10-07T12:00:00Z') - n * 86400000).toISOString()
const eq = (name: string, got: unknown, want: unknown) => {
  const ok = JSON.stringify(got) === JSON.stringify(want)
  console.log(ok ? 'OK  ' : 'FALHOU', name, ok ? JSON.stringify(got) : `got=${JSON.stringify(got)} want=${JSON.stringify(want)}`)
  if (!ok) process.exitCode = 1
}
const base = { collected_at: '2026-10-07T12:00:00Z', followers: 1000, biography: 'x', external_url: 'https://a.b' }

// 1) perfil forte: 8 posts, 3% eng, 50% vídeo, perfil completo, sem site/Google -> 100, cobertura 80
const strong: InstagramData = { ...base, is_business: true, highlights: 3, posts: Array.from({ length: 8 }, (_, i) => ({ ts: day(i), likes: 25, comments: 5, is_video: i % 2 === 0 })) }
const r1 = computeGrowthScore({ instagram_data: strong })
eq('forte: nota/cobertura/veredito', [r1.score, r1.coverage, r1.verdict], [100, 80, 'ready'])

// 2) perfil fraco: 2 posts em 30 dias (3 coletados), 0,5% eng, 0 vídeo, só bio
const weak: InstagramData = { ...base, external_url: null, is_business: false, highlights: 0, posts: [{ ts: day(1), likes: 5, comments: 0, is_video: false }, { ts: day(10), likes: 5, comments: 0, is_video: false }, { ts: day(60), likes: 5, comments: 0, is_video: false }] }
const r2 = computeGrowthScore({ instagram_data: weak })
eq('fraco', [r2.score, r2.verdict, r2.coverage], [Math.round(((2 / 8) * 25 + (0.5 / 3) * 25 + 0 + (1 / 4) * 15) / 80 * 100), 'blocked', 80])

// 3) Instagram indisponível + só site -> parcial, sem veredito
const r3 = computeGrowthScore({ instagram_data: { error: 'unavailable', collected_at: base.collected_at }, pagespeed_mobile: { scores: { performance: 90, seo: 90, accessibility: 90, best_practices: 90 } } })
eq('sem Instagram', [r3.state, r3.score, r3.verdict, r3.coverage], ['partial', null, null, 10])

// 4) sem instagram_data nenhum -> parcial
eq('sem dados', computeGrowthScore({}).state, 'partial')

// 5) seguidores 0 -> engajamento sai da conta (cobertura 80 - 25 = 55)
const r5 = computeGrowthScore({ instagram_data: { ...strong, followers: 0 } })
eq('seguidores 0', [r5.criteria[1].evaluated, r5.coverage], [false, 55])
