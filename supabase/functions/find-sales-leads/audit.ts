// Diagnóstico do lead (IA) + pontuação (código, pesos configuráveis).
// ICP (dono, 2026-10-15): CORRETOR(A) DE IMÓVEIS com Instagram SEM VÍDEO há tempo, OU
// FLOPADO, OU MAL PRODUZIDO — COM potencial de crescimento. Score = metade
// "potencial" (até 50) + metade "oportunidade" (até 50). A IA só julga o
// qualitativo (é corretor mesmo? é rede? a produção é boa?); os números
// vêm do Google e do Instagram reais.
import { CONTENT_RULES, contentFacts, type IgSignals } from './igSignals.ts'

export type WeakPresence = 'sem_instagram' | 'instagram_parado' | null

export interface ScoringWeights {
  // Potencial (até 50)
  rating_in_range: number
  reviews_in_range: number
  recent_review: number
  has_phone: number
  independent_business: number
  has_audience?: number
  // Oportunidade (até 50)
  no_recent_video?: number
  low_engagement?: number
  poor_quality?: number
  weak_presence_opportunity?: number
  likely_chain_penalty: number
  // Legado (config antiga) — não somam mais por padrão
  instagram_active?: number
  has_website?: number
  no_online_ordering?: number
}

export interface LeadAudit {
  ai_summary: string
  ai_cold_call_notes: string
  is_likely_chain: boolean
  icp_confidence: number
  icp_reasons: string[]
  content_quality: number | null   // 0-10, só quando a IA viu as capas
  content_issues: string | null
}

type ImageBlock = { type: 'image'; source: { type: 'base64'; media_type: string; data: string } }

export async function auditLead(anthropicKey: string, input: {
  name: string; city: string; targetBusinessType: string; googleTypes: string[]
  rating: number | null; reviewCount: number | null
  hasWebsite: boolean; hasInstagram: boolean; hasFacebook: boolean; hasWhatsapp: boolean
  priceLevel: number | null; daysSinceLastReview: number | null
  ig: IgSignals | null; thumbs: ImageBlock[]
  customInstructions: string | null
  weakPresence: WeakPresence
}): Promise<LeadAudit | null> {
  const ig = input.ig
  const prompt = `Você é um analista de vendas do Sales Boost, uma plataforma de marketing com IA pra corretores de imóveis no Brasil.

Avalie este negócio com base nos sinais reais coletados (nunca invente dado que não foi passado):

Nome: ${input.name}
Cidade: ${input.city}
Categoria que a busca tinha como alvo: ${input.targetBusinessType}
Categorias do Google: ${input.googleTypes.length ? input.googleTypes.join(', ') : 'não informado'}
Nota Google: ${input.rating ?? 'sem nota'} (${input.reviewCount ?? 0} avaliações) · avaliação mais recente: ${input.daysSinceLastReview != null ? `há ${input.daysSinceLastReview} dias` : 'desconhecido'}
Tem site: ${input.hasWebsite ? 'sim' : 'não'} · Facebook: ${input.hasFacebook ? 'sim' : 'não'} · WhatsApp no site: ${input.hasWhatsapp ? 'sim' : 'não'}
Faixa de preço no Google (0-4): ${input.priceLevel ?? 'não informado'}
Instagram: ${!input.hasInstagram ? 'nenhum ligado ao site' : ig ? contentFacts(ig) : 'tem link, mas não deu pra ler o perfil'}
${input.thumbs.length ? `As ${input.thumbs.length} imagens acima são as capas dos posts mais recentes desse Instagram.` : ''}

CLIENTE IDEAL do Sales Boost (decisão do dono, 2026-10-15): CORRETOR(A) DE IMÓVEIS — autônomo(a) ou com equipe pequena, que decide sozinho(a) — que TEM imóveis e clientes mas cujo Instagram está SEM VÍDEO há tempo, OU FLOPADO (pouco engajamento pro tamanho), OU MAL PRODUZIDO (foto escura/torta/de celular sem cuidado, arte amadora, só texto, sem padrão) — e com POTENCIAL de crescer (negócio ativo, bem avaliado, com público). Pouca presença digital também é ideal: o Sales Boost faz o marketing por ele. Instagram já forte (vídeo frequente, bom engajamento, produção profissional) tem menos dor. Imobiliária com marca e equipe de marketing NÃO é o foco agora (o foco é a pessoa do corretor). NÃO serve: redes/franquias grandes, portais, construtoras/incorporadoras grandes, hotéis.${input.weakPresence ? `\nESTE negócio tem presença digital fraca (${input.weakPresence === 'sem_instagram' ? 'nenhum Instagram ligado ao site' : 'Instagram sem post há mais de 120 dias'}) — trate como a oportunidade, sem tom de crítica. Se não há Instagram no site, sugira confirmar na ligação se existe um perfil.` : ''}
${input.customInstructions ? `\nInstrução adicional do dono do Sales Boost:\n"${input.customInstructions}"\n` : ''}
Responda SÓ com um JSON válido, sem markdown:
- "icp_confidence" (0-100): certeza de que o lugar É DE VERDADE um "${input.targetBusinessType}" (use categorias do Google e nome).${/corretor/i.test(input.targetBusinessType) ? ` ATENÇÃO: o Google mistura imobiliárias nessa busca. Só dê 60+ se o negócio é a PESSOA do corretor (nome de pessoa no nome, "corretor(a)", CRECI pessoal, perfil pessoal). Imobiliária com nome de marca (ex.: "X Imóveis", "Imobiliária Y", várias unidades) = no máximo 40.` : ''}
- "icp_reasons": 2-4 frases curtas explicando essa certeza.
- "is_likely_chain": true/false — parece unidade de rede/franquia grande (estimativa pelo nome/endereço)?
- "content_quality": ${input.thumbs.length ? 'nota 0-10 da PRODUÇÃO visual das capas (0 = amador/ruim, 10 = profissional). Avalie só o que vê: luz, enquadramento, nitidez, padrão visual, se a arte parece feita às pressas.' : 'null (não há imagens pra avaliar)'}
- "content_issues": ${input.thumbs.length ? '1 frase com os problemas de produção que você VÊ nas capas (ou "produção boa" se estiver bom).' : 'null'}
- "ai_summary": 2-3 frases: diagnóstico do Instagram (vídeo, engajamento, produção) e do potencial, com os números acima.
- "ai_cold_call_notes": 2-3 frases práticas pra abordar esse(a) corretor(a), usando a dor específica dele(a) (ex.: "faz 7 meses sem Reels").

{"icp_confidence": 0, "icp_reasons": ["..."], "is_likely_chain": false, "content_quality": null, "content_issues": null, "ai_summary": "...", "ai_cold_call_notes": "..."}`

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': anthropicKey, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({ model: 'claude-haiku-4-5-20251001', max_tokens: 900, messages: [{ role: 'user', content: [...input.thumbs, { type: 'text', text: prompt }] }] }),
      signal: AbortSignal.timeout(45_000),
    })
    if (!res.ok) { console.error('auditLead: IA recusou', res.status, (await res.text()).slice(0, 200)); return null }
    const data = await res.json()
    const text = String(data.content?.[0]?.text ?? '').replace(/```(?:json)?\n?/g, '').trim()
    const match = text.match(/\{[\s\S]*\}/)
    const parsed = JSON.parse(match ? match[0] : text)
    const q = Number(parsed.content_quality)
    return {
      ai_summary: String(parsed.ai_summary ?? ''),
      ai_cold_call_notes: String(parsed.ai_cold_call_notes ?? ''),
      is_likely_chain: !!parsed.is_likely_chain,
      icp_confidence: Math.round(Math.max(0, Math.min(100, Number(parsed.icp_confidence) || 0))),
      icp_reasons: Array.isArray(parsed.icp_reasons) ? parsed.icp_reasons.map(String) : [],
      content_quality: input.thumbs.length && Number.isFinite(q) ? Math.round(Math.max(0, Math.min(10, q))) : null,
      content_issues: input.thumbs.length && parsed.content_issues ? String(parsed.content_issues).slice(0, 300) : null,
    }
  } catch (e) {
    console.error('auditLead exception:', e)
    return null
  }
}

// Sinais de conteúdo já decididos (usados no score e pra rejeitar "já forte").
export interface ContentFlags { noRecentVideo: boolean; lowEngagement: boolean; poorQuality: boolean; strong: boolean; hasAudience: boolean }
export function contentFlags(ig: IgSignals | null, quality: number | null): ContentFlags {
  if (!ig) return { noRecentVideo: false, lowEngagement: false, poorQuality: false, strong: false, hasAudience: false }
  const R = CONTENT_RULES
  const noRecentVideo = ig.lastVideoDays == null || ig.lastVideoDays >= R.noVideoDays
  const lowEngagement = ig.engagementRate != null && ig.engagementRate < R.lowEngagementPct
  const poorQuality = quality != null && quality <= R.poorQuality
  const strong = ig.lastVideoDays != null && ig.lastVideoDays <= R.strongVideoDays
    && ig.engagementRate != null && ig.engagementRate >= R.strongEngagementPct
    && quality != null && quality >= R.strongQuality
  return { noRecentVideo, lowEngagement, poorQuality, strong, hasAudience: ig.followers >= R.audienceFollowers }
}

export interface ScoreBreakdownItem { label: string; points: number; passed: boolean }

export function computeLeadScore(input: {
  ratingInRange: boolean; reviewsInRange: boolean; hasPhone: boolean; isLikelyChain: boolean
  daysSinceLastReview: number | null; weakPresence: WeakPresence; flags: ContentFlags
}, w: ScoringWeights): { score: number; breakdown: ScoreBreakdownItem[] } {
  const f = input.flags
  const breakdown: ScoreBreakdownItem[] = [
    // Potencial
    { label: 'Potencial: nota do Google dentro da faixa', points: w.rating_in_range, passed: input.ratingInRange },
    { label: 'Potencial: volume de avaliações dentro da faixa', points: w.reviews_in_range, passed: input.reviewsInRange },
    { label: 'Potencial: avaliação recente no Google (negócio ativo, 60 dias)', points: w.recent_review, passed: input.daysSinceLastReview != null && input.daysSinceLastReview <= 60 },
    { label: 'Potencial: telefone público', points: w.has_phone, passed: input.hasPhone },
    { label: 'Potencial: negócio independente', points: w.independent_business, passed: !input.isLikelyChain },
    { label: `Potencial: já tem público no Instagram (${CONTENT_RULES.audienceFollowers}+ seguidores)`, points: w.has_audience ?? 5, passed: f.hasAudience },
  ]
  if (input.weakPresence) {
    breakdown.push({ label: 'Oportunidade: presença digital fraca — ninguém fazendo o marketing', points: w.weak_presence_opportunity ?? 25, passed: true })
  } else {
    breakdown.push(
      { label: `Oportunidade: sem vídeo há ${CONTENT_RULES.noVideoDays}+ dias`, points: w.no_recent_video ?? 20, passed: f.noRecentVideo },
      { label: `Oportunidade: engajamento baixo (flopado, < ${CONTENT_RULES.lowEngagementPct}%)`, points: w.low_engagement ?? 15, passed: f.lowEngagement },
      { label: 'Oportunidade: conteúdo mal produzido', points: w.poor_quality ?? 15, passed: f.poorQuality },
    )
  }
  if (input.isLikelyChain && w.likely_chain_penalty < 0) {
    breakdown.push({ label: 'Penalidade: parece rede/franquia grande', points: w.likely_chain_penalty, passed: true })
  }
  const raw = breakdown.reduce((sum, item) => sum + (item.passed ? item.points : 0), 0)
  return { score: Math.max(0, Math.min(100, Math.round(raw))), breakdown }
}
