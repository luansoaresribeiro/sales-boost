// Frente 1, item 1.2 (19/11): MAPA DE LIGAÇÕES entre os ambientes do imóvel (os do item 1.1, em meta.spaces).
// Regra do dono: uma ligação só existe com a foto que a prova; proximidade ou "parece vizinho" não conta; o resto fica
// "desconhecido". Duas etapas, sem segundo sistema de decisão:
//   a) PROPOSTA — uma chamada com todas as fotos: a IA aponta só os pares em que uma foto MOSTRA a passagem, com o número.
//   b) CONFERÊNCIA — cada par apontado passa pela pergunta de fatos do passageCheck (LINK_PROMPT) e quem decide a classe
//      é a regra pura classifyLink (confirmada / provável / desconhecida). Par não apontado = desconhecido.
// Teto de custo rígido (max_usd): estima antes, para de perguntar quando chega ao teto, sem nova tentativa paga em falha.
// Guardado em meta.space_links; cada par é guardado pelo conjunto de fotos dos dois ambientes, então se um ambiente
// mudar (o dono corrige o 1.1), só as ligações que tocam nele são refeitas.
// Parte pura testada em scripts/test-space-links.mjs.
import { anthropicCostUsd, breakdownOf, logAiCost, priceFor, totalTokens, type Usage } from './aiCost.ts'
import { askPairFacts, classifyLink, isCurrent, LINK_PROMPT, pairKey, parseFacts, PASSAGE_MODEL, type LinkClass, type Missing, type PassageCheck, type PassageFacts } from './passageCheck.ts'
import { photosSig, SPACES_MODEL, type PhotoSpace, type SpacesResult } from './photoSpaces.ts'

export const LINKS_VERSION = 1
export const DEFAULT_MAX_USD = 1
export const MAX_LINK_PAIRS = 30
// Estimativa (tokens por imagem ~1.600 numa foto de anúncio; saída com o raciocínio curto). Medido de novo a cada rodada.
const IMG_TOKENS = 1600
const PROPOSE_OUT = 4000
const PAIR_BATCH = 6
const TIME_BUDGET_MS = 90_000 // a função tem ~150 s; a proposta leva ~60–90 s, então a conferência pode seguir numa 2ª chamada
const PAIR_OUT = 700 // a conferência v4 mediu ~US$ 0,01 por par; 700 de saída deixa folga

export interface SpaceLink {
  a: string; b: string            // chaves dos ambientes (s1, s2…)
  cls: LinkClass                   // confirmed | probable | unknown
  photo: number | null             // a foto que mostra a passagem (índice em meta.photos)
  other_photo: number | null       // a foto do outro ambiente usada na conferência
  missing: Missing                 // o que falta fotografar quando não deu para confirmar
  why: string                      // o que a IA disse ver (proposta)
  facts?: PassageFacts
  checked: boolean                 // false = não conferido (teto de custo ou falha) → vale como desconhecido
  sig: string                      // assinatura das fotos dos dois ambientes (para refazer só o que mudou)
}
export interface LinksResult {
  v: number; spaces_sig: string; photos_sig?: string; provisional: boolean; links: SpaceLink[]; at: string
  cost_usd: number; total_cost_usd: number; proposal_cost_usd: number; estimate_usd: number; stopped_by_cap: boolean
  pending: number; out_of_time: boolean
}
export interface Proposal { a: string; b: string; photo: number; other_photo: number | null; why: string }

/** Assinatura de um ambiente e de um par (a ordem dos ambientes do par não importa). */
export const spaceSig = (s: PhotoSpace) => s.photos.join('.')
export const pairSig = (x: PhotoSpace, y: PhotoSpace) => [spaceSig(x), spaceSig(y)].sort().join('|')
export const spacesSigOf = (spaces: PhotoSpace[]) => spaces.map(spaceSig).sort().join('/')

export function proposePrompt(n: number, spaces: PhotoSpace[]): string {
  const list = spaces.map(s => `${s.key}: ${s.label} — fotos ${s.photos.join(', ')}`).join('\n')
  return `Acima estão ${n} fotos REAIS de UM imóvel, numeradas de 0 a ${n - 1}. Elas já estão agrupadas nestes ambientes:
${list}

Liste os pares de ambientes em que uma foto MOSTRA a passagem entre eles: dá para ver, pela porta, vão, vidro ou escada, uma parte do outro ambiente (o mesmo piso, móvel, parede ou janela que aparece nas fotos dele).
Regras:
- NÃO liste par só porque os ambientes costumam ser vizinhos (cozinha e sala, quarto e banheiro) ou parecem perto. Sem foto que mostre a passagem, não liste.
- Porta fechada, ou porta aberta sem dar para ver aonde leva, NÃO prova a ligação.
- Escada: só liste se a foto mostra aonde a escada chega.
- "photo": o número da foto que mostra a passagem (de um dos dois ambientes). "other_photo": a foto do outro ambiente que mais combina com o que se vê pela passagem.
- "why": em poucas palavras, o que se vê pela passagem.
Pense primeiro, em poucas linhas. Termine com UMA linha só com o JSON: {"links":[{"a":"s1","b":"s2","photo":0,"other_photo":5,"why":"..."}]}`
}

/** Lê a proposta. Ambiente inexistente, foto fora dos dois ambientes ou par repetido é descartado. */
export function parseProposal(text: string, spaces: PhotoSpace[]): Proposal[] | null {
  const lines = String(text ?? '').split('\n').map(l => l.trim()).filter(l => l.startsWith('{') && l.includes('"links"'))
  const raw = lines.length ? lines[lines.length - 1] : (/\{[\s\S]*"links"[\s\S]*\}/.exec(String(text ?? ''))?.[0] ?? '')
  let parsed: unknown
  try { parsed = JSON.parse(raw) } catch { return null }
  const list = (parsed as { links?: unknown })?.links
  if (!Array.isArray(list)) return null
  const byKey = new Map(spaces.map(s => [s.key, s]))
  const seen = new Set<string>()
  const out: Proposal[] = []
  for (const it of list) {
    if (!it || typeof it !== 'object') continue
    const o = it as Record<string, unknown>
    const A = byKey.get(String(o.a)), B = byKey.get(String(o.b))
    if (!A || !B || A.key === B.key) continue
    const pk = [A.key, B.key].sort().join('~')
    if (seen.has(pk)) continue
    const photo = Number(o.photo)
    if (!Number.isInteger(photo) || !(A.photos.includes(photo) || B.photos.includes(photo))) continue
    const otherSpace = A.photos.includes(photo) ? B : A
    const op = Number(o.other_photo)
    const other_photo = Number.isInteger(op) && otherSpace.photos.includes(op) ? op : otherSpace.photos[0] ?? null
    seen.add(pk)
    out.push({ a: A.key, b: B.key, photo, other_photo, why: String(o.why ?? '').replace(/\s+/g, ' ').trim().slice(0, 160) })
  }
  return out
}

/**
 * Candidatos que já têm prova: pares de fotos que a conferência do tour (v4, `meta.passage_checks`) aprovou. Não é
 * proximidade — é uma passagem que a IA de visão já viu. Mesmo assim, só viram "confirmada" pela pergunta do mapa
 * (o outro ambiente aparece pela passagem). Fotos de ambientes iguais ou que não estão mais no imóvel são ignoradas.
 */
export function tourEvidencePairs(checks: Record<string, PassageCheck> | null | undefined, urls: string[], spaces: PhotoSpace[], already: Proposal[]): Proposal[] {
  const spaceOf = new Map<number, PhotoSpace>()
  spaces.forEach(s => s.photos.forEach(p => spaceOf.set(p, s)))
  const seen = new Set(already.map(p => [p.a, p.b].sort().join('~')))
  const out: Proposal[] = []
  for (let i = 0; i < urls.length; i++) for (let j = 0; j < urls.length; j++) {
    if (i === j) continue
    const c = checks?.[pairKey(urls[i], urls[j])]
    if (!isCurrent(c) || c.linked !== 'yes') continue
    const A = spaceOf.get(i), B = spaceOf.get(j)
    if (!A || !B || A.key === B.key) continue
    const pk = [A.key, B.key].sort().join('~')
    if (seen.has(pk)) continue
    seen.add(pk)
    out.push({ a: A.key, b: B.key, photo: i, other_photo: j, why: 'passagem já aprovada na conferência do tour' })
  }
  return out
}

/**
 * Prova encontrada numa rodada continua valendo enquanto as fotos forem as mesmas: quando os ambientes mudam (ex.: o
 * dono corrige o 1.1), as ligações e propostas antigas viram candidatas de novo, remapeadas pelos NÚMEROS das fotos.
 * Motivo (20/11): duas propostas da IA com as mesmas fotos acharam pares diferentes; sem isso, uma prova se perdia.
 */
export function carryOver(old: { photo: number | null; other_photo: number | null; why?: string }[], spaces: PhotoSpace[], already: Proposal[]): Proposal[] {
  const spaceOf = new Map<number, PhotoSpace>()
  spaces.forEach(s => s.photos.forEach(p => spaceOf.set(p, s)))
  const seen = new Set(already.map(p => [p.a, p.b].sort().join('~')))
  const out: Proposal[] = []
  for (const o of old) {
    if (o.photo == null || o.other_photo == null) continue
    const A = spaceOf.get(o.photo), B = spaceOf.get(o.other_photo)
    if (!A || !B || A.key === B.key) continue
    const pk = [A.key, B.key].sort().join('~')
    if (seen.has(pk)) continue
    seen.add(pk)
    out.push({ a: A.key, b: B.key, photo: o.photo, other_photo: o.other_photo, why: o.why ?? '' })
  }
  return out
}

/** Custo estimado (US$): a proposta com todas as fotos + uma conferência de 2 fotos por par proposto. */
export function estimateUsd(nPhotos: number, nPairs: number): { proposal: number; perPair: number; total: number } {
  const ps = priceFor(SPACES_MODEL), pp = priceFor(PASSAGE_MODEL)
  const proposal = ((nPhotos * IMG_TOKENS + 2500) * ps.in + PROPOSE_OUT * ps.out) / 1e6
  const perPair = ((2 * IMG_TOKENS + 900) * pp.in + PAIR_OUT * pp.out) / 1e6
  const r = (x: number) => Math.round(x * 1000) / 1000
  return { proposal: r(proposal), perPair: r(perPair), total: r(proposal + perPair * nPairs) }
}

/**
 * Comparação com uma tabela feita à mão (grupos de fotos). Uma ligação "bate" com um par esperado quando cada ponta
 * tem foto de um dos dois grupos. Devolve: certas, inventadas (confirmadas que a tabela diz NÃO existir), não achadas
 * (esperadas que não saíram confirmadas/prováveis) e as confirmadas fora da tabela (a conferir no olho).
 */
export function compareLinks(links: SpaceLink[], spaces: PhotoSpace[], groups: number[][], expected: [number, number][], knownWrong: [number, number][]) {
  const photosOf = new Map(spaces.map(s => [s.key, s.photos]))
  const groupsOf = (key: string) => new Set((photosOf.get(key) ?? []).map(p => groups.findIndex(g => g.includes(p))).filter(g => g >= 0))
  const hits = (l: SpaceLink, [x, y]: [number, number]) => { const A = groupsOf(l.a), B = groupsOf(l.b); return (A.has(x) && B.has(y)) || (A.has(y) && B.has(x)) }
  const positive = links.filter(l => l.cls === 'confirmed')
  const found = links.filter(l => l.cls === 'confirmed' || l.cls === 'probable')
  const correct = expected.filter(e => positive.some(l => hits(l, e)))
  const probableOnly = expected.filter(e => !positive.some(l => hits(l, e)) && found.some(l => hits(l, e)))
  const missed = expected.filter(e => !found.some(l => hits(l, e)))
  const invented = positive.filter(l => knownWrong.some(w => hits(l, w)))
  const outside = positive.filter(l => !expected.some(e => hits(l, e)) && !knownWrong.some(w => hits(l, w)))
  const linked = new Set(positive.flatMap(l => [l.a, l.b]))
  return {
    confirmed: positive.length, probable: links.filter(l => l.cls === 'probable').length, unknown: links.filter(l => l.cls === 'unknown').length,
    correct: correct.length, probableOnly: probableOnly.length, missed: missed.length, invented: invented.length, outside,
    precisionVsTable: positive.length ? (positive.length - invented.length - outside.length) / positive.length : 1,
    coverage: spaces.length ? linked.size / spaces.length : 0,
  }
}

// deno-lint-ignore no-explicit-any
type Admin = any

async function callAnthropic(anthropicKey: string, model: string, content: unknown[], maxTokens: number): Promise<{ text: string; usage: Usage | null; error: string | null }> {
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': anthropicKey, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({ model, max_tokens: maxTokens, output_config: { effort: 'medium' }, messages: [{ role: 'user', content }] }),
      signal: AbortSignal.timeout(140_000),
    })
    if (!res.ok) return { text: '', usage: null, error: `IA recusou (${res.status}): ${(await res.text()).slice(0, 200)}` }
    const data = await res.json()
    const text = (Array.isArray(data.content) ? data.content : []).filter((b: { type?: string }) => b?.type === 'text').map((b: { text?: string }) => b.text ?? '').join('\n')
    return { text, usage: data.usage ?? null, error: null }
  } catch (e) { return { text: '', usage: null, error: String(e).slice(0, 200) } }
}

export interface LinksOpts { maxUsd?: number; force?: boolean; dryRun?: boolean; provisional?: boolean }

/**
 * Mapa de ligações do imóvel. Precisa dos ambientes do 1.1 (meta.spaces) com as mesmas fotos. dry_run = só a estimativa.
 * Devolve { error } quando não dá para rodar (sem ambientes, estimativa acima do teto, falha da proposta).
 */
export async function ensureLinks(admin: Admin, anthropicKey: string, companyId: string, itemId: string, opts: LinksOpts = {}): Promise<{ result?: LinksResult; estimate?: ReturnType<typeof estimateUsd>; error?: string }> {
  const maxUsd = Math.min(Math.max(Number(opts.maxUsd ?? DEFAULT_MAX_USD) || DEFAULT_MAX_USD, 0.05), 3)
  const { data: item } = await admin.from('marketing_ai_knowledge').select('meta').eq('id', itemId).eq('company_id', companyId).eq('kind', 'product').maybeSingle()
  const urls = ((item?.meta?.photos ?? []) as { url?: string }[]).map(p => String(p?.url ?? ''))
  const sp = item?.meta?.spaces as SpacesResult | undefined
  if (!sp?.spaces?.length || sp.sig !== photosSig(urls)) return { error: 'Rode antes a identificação dos ambientes (group_spaces) com as fotos atuais.' }
  const spaces = sp.spaces
  const sSig = spacesSigOf(spaces)
  const prev = item?.meta?.space_links as (LinksResult & { proposal?: { spaces_sig: string; items: Proposal[] } }) | undefined
  const reuseProposal = !opts.force && prev?.v === LINKS_VERSION && prev.proposal?.spaces_sig === sSig
  const evidence = (prop: Proposal[]) => tourEvidencePairs(item?.meta?.passage_checks as Record<string, PassageCheck> | undefined, urls, spaces, prop)
  const guessPairs = reuseProposal ? prev!.proposal!.items.length + evidence(prev!.proposal!.items).length : Math.min(spaces.length, MAX_LINK_PAIRS)
  const estimate = estimateUsd(reuseProposal ? 0 : urls.length, guessPairs)
  if (reuseProposal) estimate.total = Math.round(estimate.perPair * guessPairs * 1000) / 1000
  if (opts.dryRun) return { estimate }
  if (!anthropicKey) return { error: 'IA indisponível.' }
  // O teto vale para o mapa inteiro: com a proposta reaproveitada, conta o que já foi gasto nas chamadas anteriores.
  const priorCost = reuseProposal ? Number(prev!.total_cost_usd ?? prev!.cost_usd ?? 0) : 0
  if (priorCost + (reuseProposal ? estimate.perPair : estimate.proposal + estimate.perPair) > maxUsd) return { estimate, error: `A estimativa passa do teto de US$ ${maxUsd.toFixed(2)}.` }

  let spent = 0, proposalCost = 0
  const tStart = Date.now()
  let proposals: Proposal[]
  if (reuseProposal) proposals = prev!.proposal!.items
  else {
    const t0 = Date.now()
    const content: unknown[] = []
    urls.forEach((u, i) => { content.push({ type: 'text', text: `FOTO ${i}:` }, { type: 'image', source: { type: 'url', url: u } }) })
    content.push({ type: 'text', text: proposePrompt(urls.length, spaces) })
    const r = await callAnthropic(anthropicKey, SPACES_MODEL, content, 8000)
    proposalCost = anthropicCostUsd(SPACES_MODEL, r.usage)
    spent += proposalCost
    const parsed = r.text ? parseProposal(r.text, spaces) : null
    await logAiCost(admin, { companyId, role: 'tour', taskKey: 'ai_vision_links_propose', description: `Mapa de ligações: proposta (${urls.length} fotos, ${spaces.length} ambientes)`, tokens: totalTokens(breakdownOf(r.usage)), costUsd: proposalCost, latencyMs: Date.now() - t0, success: !!parsed, error: parsed ? null : (r.error ?? 'resposta sem JSON válido'), breakdown: breakdownOf(r.usage), trigger: 'manual' }).catch(() => {})
    if (!parsed) return { error: 'A IA não devolveu a proposta de ligações (sem nova tentativa paga).' }
    proposals = parsed.slice(0, MAX_LINK_PAIRS)
    if (prev?.v === LINKS_VERSION && prev.photos_sig === photosSig(urls)) proposals = [...proposals, ...carryOver([...(prev.proposal?.items ?? []), ...prev.links], spaces, proposals)]
  }

  const candidates = [...proposals, ...evidence(proposals)].slice(0, MAX_LINK_PAIRS)
  const byKey = new Map(spaces.map(s => [s.key, s]))
  const cachedBySig = new Map((prev?.v === LINKS_VERSION ? prev.links : []).filter(l => l.checked).map(l => [`${l.sig}#${l.photo}`, l]))
  const links: SpaceLink[] = candidates.map(p => {
    const A = byKey.get(p.a)!, B = byKey.get(p.b)!
    const sig = pairSig(A, B)
    const hit = !opts.force ? cachedBySig.get(`${sig}#${p.photo}`) : undefined
    return hit ? { ...hit, a: p.a, b: p.b } : { a: p.a, b: p.b, cls: 'unknown', photo: p.photo, other_photo: p.other_photo, missing: null, why: p.why, checked: false, sig }
  })
  // Conferência em lotes paralelos. Para antes do teto de custo (somado ao que já foi gasto neste mapa) e antes do
  // limite de tempo da função; o que sobrar fica "não conferido" e uma nova chamada continua dali (cache).
  const todo = links.map((l, i) => ({ l, i })).filter(x => !x.l.checked && x.l.other_photo !== null && x.l.photo !== null)
  let stopped = false, outOfTime = false
  for (let k = 0; k < todo.length;) {
    if (Date.now() - tStart > TIME_BUDGET_MS) { outOfTime = true; break }
    const fits = Math.floor((maxUsd - priorCost - spent) / estimate.perPair)
    if (fits < 1) { stopped = true; break }
    const batch = todo.slice(k, k + Math.min(PAIR_BATCH, fits))
    k += batch.length
    await Promise.all(batch.map(async ({ l, i }) => {
      const A = byKey.get(l.a)!, B = byKey.get(l.b)!
      // A foto da evidência é a "FOTO 1" (de onde se olha); a outra é o ambiente que deve aparecer pela passagem.
      const t0 = Date.now()
      const r = await askPairFacts(anthropicKey, urls[l.photo!], urls[l.other_photo!], LINK_PROMPT)
      const cost = anthropicCostUsd(PASSAGE_MODEL, r.usage)
      spent += cost
      const facts = r.text ? parseFacts(r.text) : null
      await logAiCost(admin, { companyId, role: 'tour', taskKey: 'ai_vision_links_pair', description: `Ligação ${A.label} ↔ ${B.label} (fotos ${l.photo} e ${l.other_photo})`.slice(0, 200), tokens: totalTokens(breakdownOf(r.usage)), costUsd: cost, latencyMs: Date.now() - t0, success: !!facts, error: facts ? null : (r.error ?? 'resposta sem JSON válido'), breakdown: breakdownOf(r.usage), trigger: 'manual' }).catch(() => {})
      // Falha da IA: fica desconhecida e marcada como conferida (sem nova tentativa paga automática).
      if (!facts) { links[i] = { ...l, checked: true, missing: null }; return }
      const c = classifyLink(facts)
      links[i] = { ...l, cls: c.cls, missing: c.missing, facts, checked: true }
    }))
  }

  const round = (x: number) => Math.round(x * 10000) / 10000
  const result: LinksResult & { proposal: { spaces_sig: string; items: Proposal[] } } = {
    v: LINKS_VERSION, spaces_sig: sSig, photos_sig: photosSig(urls), provisional: opts.provisional ?? spaces.some(s => s.uncertain), links, at: new Date().toISOString(),
    cost_usd: round(spent), total_cost_usd: round(priorCost + spent), proposal_cost_usd: round(proposalCost), estimate_usd: estimate.total, stopped_by_cap: stopped,
    pending: links.filter(l => !l.checked && l.other_photo !== null).length, out_of_time: outOfTime,
    proposal: { spaces_sig: sSig, items: proposals },
  }
  try {
    const { data: cur } = await admin.from('marketing_ai_knowledge').select('meta').eq('id', itemId).eq('company_id', companyId).maybeSingle()
    const meta = (cur?.meta ?? {}) as Record<string, unknown>
    if ((meta.spaces as SpacesResult | undefined)?.sig === sp.sig) await admin.from('marketing_ai_knowledge').update({ meta: { ...meta, space_links: result } }).eq('id', itemId).eq('company_id', companyId)
  } catch (e) { console.error('spaceLinks: gravar falhou (vale só nesta rodada)', String(e).slice(0, 200)) }
  return { result, estimate }
}
