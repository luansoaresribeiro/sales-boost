// Diagnóstico de Social Selling (pedido do dono 2026-10-19): "quando um
// comprador visita este Instagram, o que encontra que o ajude a confiar,
// aprender e dar o próximo passo?". Lê DO QUE FALAM as legendas — não só
// quantos posts — e monta os pilares da ficha (Autoridade, Educação,
// Confiança, Relacionamento, Conversão no setor imobiliário).
//
// Divisão de trabalho (regra 5 — nunca inventar número):
//   - a IA só CLASSIFICA cada post numa categoria da ficha e escreve texto
//     sem números (frases com algarismo são descartadas);
//   - o código CONTA (quantos posts de cada categoria / pilar) e decide o
//     nível de cada pilar com os limites da ficha.
// Tudo de setor (categorias, pilares, "por que importa", dúvidas do comprador)
// vem de vertical_playbooks.config.onboarding_v2.social_selling (regra 6).
// Sem ficha, sem chave da IA, teto do mês atingido ou erro → null (a página
// mostra a seção antiga "Pronto pra gerar conversas?").

// deno-lint-ignore no-explicit-any
type Any = any

const MODEL = 'claude-sonnet-4-6' // o mesmo das "descobertas" do mercado (marketScan.ts)
export const SOCIAL_SELLING_MONTHLY_CAP = Number(Deno.env.get('SOCIAL_SELLING_MONTHLY_CAP') ?? '300') || 300

export interface SSCategory { key: string; name: string; hint: string }
export interface SSPillar {
  key: string; name: string; question: string; why: string
  categories?: string[] // posts dessas categorias contam pro pilar
  signals?: ('cta_posts' | 'owner_replies')[] // sinais medidos no código (padrões da ficha)
  strong_share?: number // fração dos posts pra ser "forte" (padrão 0.25)
}
// Camada 2 do diagnóstico ("o que você precisa entender sobre geração de
// demanda"): princípios fixos da ficha, com exemplo do setor, ligados a um pilar.
export interface SSPrinciple { key: string; title: string; text: string; example: string; pillar?: string }
export interface SSConfig { categories: SSCategory[]; pillars: SSPillar[]; buyer_doubts?: string[]; principles?: SSPrinciple[] }

export interface SocialSelling {
  v: 1
  created_at: string
  total: number // posts lidos (classificados)
  categories: { key: string; name: string }[]
  principles: SSPrinciple[]
  posts: { i: number; c: string; excerpt: string; ts: string | null }[]
  counts: Record<string, number>
  pillars: { key: string; name: string; question: string; why: string; level: 'forte' | 'parcial' | 'ausente'; count: number; evidence: number[]; note: string }[]
  answer: string // resposta curta à pergunta-guia
  opportunity: { gap: string; consequence: string; shift: string } | null
  example: { format: string; hook: string; outline: string; goal: string } | null
}

export function parseSSConfig(raw: unknown): SSConfig | null {
  const r = raw as Any
  if (!r || !Array.isArray(r.categories) || !Array.isArray(r.pillars)) return null
  const categories = r.categories.filter((c: Any) => typeof c?.key === 'string' && typeof c?.name === 'string')
    .map((c: Any) => ({ key: c.key, name: c.name, hint: String(c.hint ?? '') }))
  const pillars = r.pillars.filter((p: Any) => typeof p?.key === 'string' && typeof p?.name === 'string')
    .map((p: Any) => ({
      key: p.key, name: p.name, question: String(p.question ?? ''), why: String(p.why ?? ''),
      categories: Array.isArray(p.categories) ? p.categories.map(String) : [],
      signals: Array.isArray(p.signals) ? p.signals.filter((s: unknown) => s === 'cta_posts' || s === 'owner_replies') : [],
      strong_share: typeof p.strong_share === 'number' && p.strong_share > 0 && p.strong_share <= 1 ? p.strong_share : 0.25,
    }))
  if (!categories.length || !pillars.length) return null
  const principles = (Array.isArray(r.principles) ? r.principles : [])
    .filter((x: Any) => typeof x?.key === 'string' && typeof x?.title === 'string')
    .map((x: Any) => ({ key: x.key, title: x.title, text: String(x.text ?? ''), example: String(x.example ?? ''), ...(typeof x.pillar === 'string' ? { pillar: x.pillar } : {}) }))
    .slice(0, 8)
  return { categories, pillars, buyer_doubts: Array.isArray(r.buyer_doubts) ? r.buyer_doubts.map(String).slice(0, 12) : [], principles }
}

function safeRe(p: unknown): RegExp | null {
  if (typeof p !== 'string' || !p) return null
  try { return new RegExp(p, 'i') } catch { return null }
}

// Tira frases com algarismo (a IA não pode trazer número) e corta no tamanho.
function clean(v: unknown, max: number): string {
  const sentences = String(v ?? '').replace(/\s+/g, ' ').trim().split(/(?<=[.!?])\s+/)
  const t = sentences.filter(s => !/\d/.test(s)).join(' ').trim()
  if (t.length <= max) return t
  const c = t.slice(0, max - 1)
  return `${c.slice(0, c.lastIndexOf(' ') > max / 2 ? c.lastIndexOf(' ') : c.length).replace(/[\s,.;:—-]+$/, '')}…`
}

export async function analyzeSocialSelling(ig: Any, cfg: SSConfig, readiness: Any, ctx: { business: string; anthropicKey: string }): Promise<SocialSelling | null> {
  const posts: Any[] = Array.isArray(ig?.posts) ? ig.posts : []
  const withCaption = posts.map((p, idx) => ({ i: idx + 1, caption: typeof p.caption === 'string' ? p.caption : '', p })).filter(x => x.caption.trim())
  if (withCaption.length < 3) return null // pouco texto pra dizer algo honesto

  const catKeys = new Set(cfg.categories.map(c => c.key))
  const data = {
    negocio: ctx.business,
    bio: String(ig.biography ?? ''),
    posts: withCaption.map(x => ({ n: x.i, legenda: x.caption.slice(0, 400), video: x.p.is_video ?? null })),
  }
  const prompt = `Você analisa o Instagram de um profissional com a lente de SOCIAL SELLING: usar presença digital, conteúdo e relacionamento pra criar confiança e facilitar conversas comerciais — não só divulgar o que vende.
A pergunta que guia tudo: "quando um potencial cliente visita este perfil, o que encontra que o ajude a confiar, aprender e dar o próximo passo?"

DADOS REAIS (bio e legendas dos posts mais recentes, numerados):
${JSON.stringify(data)}

CATEGORIAS (use só estas chaves):
${cfg.categories.map(c => `- ${c.key}: ${c.name} — ${c.hint}`).join('\n')}

PILARES:
${cfg.pillars.map(p => `- ${p.key} (${p.name}): ${p.question}`).join('\n')}
${cfg.buyer_doubts?.length ? `\nDúvidas comuns de quem compra: ${cfg.buyer_doubts.join('; ')}.` : ''}

Tarefas:
1. "posts": classifique CADA post numerado em UMA categoria (a principal). Na dúvida entre anúncio e outra, escolha a que o post mais faz.
2. "pilares": para cada pilar, uma frase curta (até 160 caracteres) dizendo o que o perfil MOSTRA ou NÃO MOSTRA nesse ponto, citando o conteúdo real ("seus posts mostram o imóvel, mas não..."). Sem elogio vazio e sem inventar defeito.
3. "resposta": até 220 caracteres respondendo à pergunta-guia para ESTE perfil, direto e honesto.
4. "oportunidade": a lacuna mais importante entre o conteúdo atual e o que construiria confiança — "lacuna" (o que falta, até 200), "consequencia" (o que isso pode custar na decisão do cliente, em tom de possibilidade, até 260), "novo_olhar" (o jeito novo de pensar o Instagram, até 220).
5. "exemplo": UM post educativo ou de relacionamento feito pra este perfil, que ataque a lacuna: "formato" (reels|carrossel|foto|stories), "gancho" (primeira frase, até 110), "roteiro" (o que o post mostra/explica, até 260), "objetivo" (o objetivo estratégico — por que esse post ajuda a gerar confiança e conversa, até 200).
Regras: português simples, falando com o dono ("você"). NUNCA escreva números (nem quantidades, preços, m², porcentagens, prazos) — o sistema mostra as contagens. Não prometa resultado.

Responda SÓ JSON: {"posts":[{"n":1,"c":""}],"pilares":{"<chave>":""},"resposta":"","oportunidade":{"lacuna":"","consequencia":"","novo_olhar":""},"exemplo":{"formato":"","gancho":"","roteiro":"","objetivo":""}}`

  let j: Any
  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST', headers: { 'x-api-key': ctx.anthropicKey, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({ model: MODEL, max_tokens: 1800, messages: [{ role: 'user', content: prompt }] }), signal: AbortSignal.timeout(60_000),
    })
    if (!r.ok) { console.log('[social-selling] claude', r.status); return null }
    const t = String((await r.json())?.content?.[0]?.text ?? '')
    j = JSON.parse(t.slice(t.indexOf('{'), t.lastIndexOf('}') + 1))
  } catch (e) { console.log('[social-selling] falhou', String(e)); return null }

  // Classificação (só chaves da ficha; post sem classificação fica de fora da contagem).
  const byN = new Map<number, string>()
  for (const x of Array.isArray(j.posts) ? j.posts : []) {
    const n = Number(x?.n), c = String(x?.c ?? '')
    if (Number.isInteger(n) && catKeys.has(c)) byN.set(n, c)
  }
  const classified = withCaption.filter(x => byN.has(x.i)).map(x => ({
    i: x.i, c: byN.get(x.i)!, excerpt: x.caption.replace(/\s+/g, ' ').trim().slice(0, 140), ts: x.p.ts ?? null,
  }))
  if (classified.length < 3) return null
  const counts: Record<string, number> = {}
  for (const p of classified) counts[p.c] = (counts[p.c] ?? 0) + 1

  // Sinais medidos no código, com os padrões que a ficha já tem (diagnosis_readiness).
  const ctaRe = safeRe(readiness?.cta_pattern)
  const ctaPosts = new Set(withCaption.filter(x => ctaRe?.test(x.caption)).map(x => x.i))
  const replyPosts = new Set(posts.map((p, idx) => ({ p, i: idx + 1 })).filter(x => (x.p.comment_samples ?? []).some((c: Any) => c?.by_owner)).map(x => x.i))

  const total = classified.length
  const notes = (j.pilares ?? {}) as Record<string, unknown>
  const pillars = cfg.pillars.map(pl => {
    const ev = new Set<number>()
    for (const p of classified) if (pl.categories?.includes(p.c)) ev.add(p.i)
    if (pl.signals?.includes('cta_posts')) for (const i of ctaPosts) ev.add(i)
    if (pl.signals?.includes('owner_replies')) for (const i of replyPosts) ev.add(i)
    const count = ev.size
    const level: 'forte' | 'parcial' | 'ausente' = count === 0 ? 'ausente' : count / Math.max(total, 1) >= (pl.strong_share ?? 0.25) ? 'forte' : 'parcial'
    return { key: pl.key, name: pl.name, question: pl.question, why: pl.why, level, count, evidence: [...ev].sort((a, b) => a - b).slice(0, 3), note: clean(notes[pl.key], 200) }
  })

  const o = j.oportunidade ?? {}, e = j.exemplo ?? {}
  const opportunity = { gap: clean(o.lacuna, 240), consequence: clean(o.consequencia, 320), shift: clean(o.novo_olhar, 260) }
  const example = { format: clean(e.formato, 20).toLowerCase(), hook: clean(e.gancho, 140), outline: clean(e.roteiro, 320), goal: clean(e.objetivo, 260) }
  return {
    v: 1, created_at: new Date().toISOString(), total, categories: cfg.categories.map(c => ({ key: c.key, name: c.name })), principles: cfg.principles ?? [], posts: classified, counts, pillars,
    answer: clean(j.resposta, 260),
    opportunity: opportunity.gap ? opportunity : null,
    example: example.hook && example.goal ? example : null,
  }
}
