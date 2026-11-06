// Opportunity Engine — PASSO A (determinístico, sem IA). Decisão do dono 2026-10-28
// (docs/DECISIONS.md → "Inteligência comercial para imobiliárias").
//
// Monta os FATOS contados do banco e gera CANDIDATOS a oportunidade por regra. Nada aqui
// chama IA e nada aqui inventa número: todo número/data que sai deste arquivo veio de uma linha
// do banco (ou é a data de hoje, quando o fato é "contei agora"). A IA (passo B) só redige em
// cima destes fatos — ver opportunityOutput.ts. Função PURA: roda no Deno e no teste em Node
// (scripts/test-opportunity-engine.mjs).
//
// Regra 6: nada de setor mora aqui. Quais campos do catálogo são "região", "preço" etc. vem da
// ficha (config.opportunity_fields) e os rótulos de config.catalog_fields; o nome do item vem
// de config.vocabulary.item.

import { signalStrength } from './marketNews.ts'
import { normalizeTitle, type IntelQuality } from './marketIntel.ts'

export type Lang = 'pt' | 'en'
export type EvType = 'fact' | 'data' | 'hypothesis'
export type OppKind = 'content_gap' | 'low_traction' | 'unmet_demand' | 'positioning' | 'market_change' | 'other'

export interface Evidence { type: EvType; text: string; source: string | null; date: string | null }
// fact = contado dos dados da própria empresa; data = coletado de fora (concorrente, sinal de mercado, tendência).
// numTags: números do texto que o código SABE a unidade (preço = cur, quartos = bed) — a validação de unidade usa isso.
export interface NumTag { value: string; unit: 'cur' | 'bed' }
export interface Fact { id: string; type: 'fact' | 'data'; text: string; source: string; date: string | null; origin: string; numTags?: NumTag[]; signal_id?: string; signal_ids?: string[]; weak?: boolean }
// Textos de setor vêm da FICHA (config.opportunity_texts, regra 6); sem eles valem os genéricos abaixo.
export interface OppTexts { hypotheses?: string[]; caveat?: string; audienceHint?: string; marketClaims?: string[] }

export interface FieldMap { location: string; price?: string; type?: string; bedrooms?: string; deal?: string }
export interface CatalogItem { id: string; title: string; fields: Record<string, unknown>; photoCount: number; createdAt?: string | null }
// Peça preparada no Sales Boost (marketing_ai_test_content), de qualquer status — NÃO é post publicado.
export interface PieceRow { item_id: string | null }
/** Idade mínima (dias) do item pra contar como lacuna de conteúdo: item recém-cadastrado ainda não "ficou sem post". */
export const MIN_GAP_AGE_DAYS = 7
export interface PostRow { id?: string; item_id: string | null; status: string | null; published_at: string | null; created_at: string | null; content: string | null; instagram_media_id: string | null }
export interface EventRow { media_ref: string | null; intent_detected: string | null; created_at: string | null }
export interface CompetitorRow { name: string | null; instagram_url: string | null; posting_frequency_days: number | null; avg_engagement: number | null; followers: number | null; hashtags_used: string[] | null; notes: string | null; last_analyzed_at: string | null }
export interface TrendRow { title: string | null; description: string | null; category: string | null; relevance: string | null; detected_at: string | null; source: string | null }
export interface SignalRow { id?: string; kind: string | null; region: string | null; title: string | null; summary: string | null; source_name: string | null; source_url: string | null; observed_at: string | null }

export interface EngineInput {
  lang: Lang
  now: Date
  windowDays: number
  fieldMap: FieldMap
  labels: Record<string, string> // chave do campo → rótulo no idioma (da ficha)
  itemLabel: string // vocabulary.item (singular), ex.: "Imóvel"
  catalog: CatalogItem[]
  posts: PostRow[]
  pieces?: PieceRow[] // peças preparadas (qualquer status); ausente = não informado
  events: EventRow[]
  competitors: CompetitorRow[]
  trends: TrendRow[]
  signals: SignalRow[]
  instagramConnected: boolean
  texts?: OppTexts // já no idioma de `lang`
  quality?: IntelQuality // regras de força do sinal da ficha (recalculadas aqui: vale p/ sinal já coletado); ausente = tudo forte
}

export interface Candidate {
  id: string
  kind: OppKind
  item_ids: string[]
  fact_ids: string[]
  region: string | null
  forceHypothesis: boolean // low_traction: a causa é sempre hipótese
  hypotheses: string[] // causas possíveis escritas pelo código (rotuladas como hipótese)
  validationReasons: string[] // por que precisa validar (vazio = base suficiente)
  fallback: { title: string; problem: string; action: string; measure: string }
}

export const norm = (s: string): string => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim()
export const dateOnly = (v: string | null | undefined): string | null => {
  if (!v) return null
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(v)
  return m ? `${m[1]}-${m[2]}-${m[3]}` : null
}
export function fmtDate(iso: string | null, lang: Lang): string {
  const d = dateOnly(iso)
  if (!d) return ''
  const [y, m, day] = d.split('-')
  return lang === 'en' ? `${m}/${day}/${y}` : `${day}/${m}/${y}`
}
const tr = (lang: Lang, pt: string, en: string) => (lang === 'en' ? en : pt)
const handleOf = (c: CompetitorRow): string => {
  const seg = (c.instagram_url ?? '').split('?')[0].split('/').filter(Boolean).pop()
  return `@${(seg || c.name || '?').replace(/^@/, '')}`
}
const hashtagsIn = (s: string | null): string[] => (s ?? '').toLowerCase().match(/#[\p{L}\p{N}_]+/gu)?.map(h => h.slice(1)) ?? []
const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s)
const AI_SOURCES = /^(ai|ia|llm|claude|gpt|model|modelo|sonnet|haiku|raciocinio|reasoning)$/

class FactBook {
  facts: Fact[] = []
  add(type: 'fact' | 'data', text: string, source: string, date: string | null, origin: string, numTags?: NumTag[], signalId?: string, extra?: { signal_ids?: string[]; weak?: boolean }): string {
    const dup = this.facts.find(f => f.text === text && f.source === source)
    if (dup) return dup.id
    const id = `F${this.facts.length + 1}`
    this.facts.push({ id, type, text, source, date, origin, ...(numTags?.length ? { numTags } : {}), ...(signalId ? { signal_id: signalId } : {}), ...(extra?.signal_ids?.length ? { signal_ids: extra.signal_ids } : {}), ...(extra?.weak ? { weak: true } : {}) })
    return id
  }
}

function describeItem(it: CatalogItem, inp: EngineInput): { text: string; tags: NumTag[] } {
  const f = it.fields, fm = inp.fieldMap
  const val = (k?: string) => (k && f[k] != null && String(f[k]).trim() !== '' ? String(f[k]).trim().slice(0, 60) : '')
  const part = (k?: string) => (val(k) ? `${inp.labels[k as string] ?? k}: ${val(k)}` : '')
  const tags: NumTag[] = []
  if (val(fm.price)) tags.push({ value: val(fm.price), unit: 'cur' })
  if (val(fm.bedrooms)) tags.push({ value: val(fm.bedrooms), unit: 'bed' })
  return { text: [it.title, part(fm.type), part(fm.location), part(fm.deal), part(fm.bedrooms), part(fm.price)].filter(Boolean).join(' · '), tags }
}

/** Ids dos sinais de mercado que sustentam algum dos fatos dados (sem repetir). */
export const signalIdsOf = (facts: Fact[]): string[] => [...new Set(facts.flatMap(f => [f.signal_id, ...(f.signal_ids ?? [])]).filter((x): x is string => !!x))]

export function buildCandidates(inp: EngineInput): { facts: Fact[]; candidates: Candidate[]; usedSignalIds: string[] } {
  const { lang } = inp
  const book = new FactBook()
  const candidates: Candidate[] = []
  const today = inp.now.toISOString().slice(0, 10)
  const since = inp.now.getTime() - inp.windowDays * 86400000
  const inWin = (v: string | null) => { const t = v ? Date.parse(v) : NaN; return Number.isFinite(t) && t >= since }
  const srcCatalog = tr(lang, 'Catálogo cadastrado no Sales Boost', 'Catalog registered in Sales Boost')
  const srcPosts = tr(lang, 'Posts registrados no Sales Boost', 'Posts registered in Sales Boost')
  const srcEvents = tr(lang, 'Comentários do Instagram recebidos pelo Sales Boost', 'Instagram comments received by Sales Boost')
  const regionLabel = inp.labels[inp.fieldMap.location] ?? tr(lang, 'Região', 'Region')
  const noIg = tr(lang, 'O Instagram não está conectado: o que for publicado fora do Sales Boost não aparece aqui.', 'Instagram is not connected: anything published outside Sales Boost does not show up here.')

  const posts = inp.posts.filter(p => inWin(p.created_at) || inWin(p.published_at))
  const postsOfItem = (id: string) => posts.filter(p => p.item_id === id)
  const catalogFact = (it: CatalogItem) => { const d = describeItem(it, inp); return book.add('fact', d.text, srcCatalog, null, 'catalog', d.tags) }

  const regionOf = (it: CatalogItem) => String(inp.fieldMap.location && it.fields[inp.fieldMap.location] != null ? it.fields[inp.fieldMap.location] : '').trim()
  const byRegion = new Map<string, { name: string; items: CatalogItem[] }>()
  for (const it of inp.catalog) {
    const r = regionOf(it)
    if (norm(r).length < 2) continue
    const k = norm(r)
    if (!byRegion.has(k)) byRegion.set(k, { name: r, items: [] })
    byRegion.get(k)!.items.push(it)
  }

  // ── content_gap: região do catálogo sem NENHUM post (qualquer status) na janela ──────────
  // Evidência (2026-11-05): o período citado vem dos DADOS — nunca a janela fixa quando o item é mais novo que ela —
  // e item que já tem peça preparada não é "sem conteúdo" (a peça já aparece na fila de aprovação; não duplicamos).
  const pieces = inp.pieces ?? []
  const piecesOf = (id: string) => pieces.filter(p => p.item_id === id).length
  const ageDays = (it: CatalogItem): number | null => { const t = it.createdAt ? Date.parse(it.createdAt) : NaN; return Number.isFinite(t) ? Math.floor((inp.now.getTime() - t) / 86400000) : null }
  for (const [, reg] of byRegion) {
    if (reg.items.some(it => postsOfItem(it.id).length > 0)) continue
    if (reg.items.some(it => piecesOf(it.id) > 0)) continue // peças prontas e não publicadas: a fila de aprovação já mostra
    const elig = reg.items.filter(it => { const a = ageDays(it); return a == null || a >= MIN_GAP_AGE_DAYS }) // cadastrado há poucos dias não é lacuna
    if (elig.length === 0) continue
    const n = elig.length
    const ages = elig.map(ageDays)
    const known = ages.every((a): a is number => a != null)
    const newest = known ? Math.min(...(ages as number[])) : null
    const young = newest != null && newest < inp.windowDays // item mais novo que a janela: diz a idade, não a janela
    const ids = elig.slice(0, 3).map(catalogFact)
    ids.push(book.add('fact', tr(lang, `${n === 1 ? 'Há 1 item' : `Há ${n} itens`} do catálogo em "${reg.name}" (${regionLabel}).`, `There ${n === 1 ? 'is 1 item' : `are ${n} items`} in the catalog in "${reg.name}" (${regionLabel}).`), srcCatalog, null, 'catalog'))
    ids.push(book.add('fact', young
      ? tr(lang, `Nenhum post registrado no Sales Boost para ${n === 1 ? 'esse item, cadastrado' : 'esses itens, o mais recente cadastrado'} há ${newest} dias.`, `No post registered in Sales Boost for ${n === 1 ? 'this item, registered' : 'these items, the newest registered'} ${newest} days ago.`)
      : tr(lang, `Nenhum post registrado no Sales Boost para ${n === 1 ? 'esse item' : 'esses itens'} nos últimos ${inp.windowDays} dias.`, `No post registered in Sales Boost for ${n === 1 ? 'this item' : 'these items'} in the last ${inp.windowDays} days.`), srcPosts, today, 'posts'))
    candidates.push({
      id: '', kind: 'content_gap', item_ids: elig.map(i => i.id), fact_ids: ids, region: reg.name, forceHypothesis: false, hypotheses: [],
      validationReasons: inp.instagramConnected ? [] : [noIg],
      fallback: {
        title: young
          ? tr(lang, `Nenhum post sobre ${reg.name} para ${n === 1 ? 'o item cadastrado' : 'os itens cadastrados'} há ${newest} dias`, `No posts about ${reg.name} for ${n === 1 ? 'the item registered' : 'the items registered'} ${newest} days ago`)
          : tr(lang, `Nenhum post sobre ${reg.name} nos últimos ${inp.windowDays} dias`, `No posts about ${reg.name} in the last ${inp.windowDays} days`),
        problem: tr(lang, `Há ${itemsWord(n, lang)} do catálogo nessa região, mas nada foi publicado sobre ${n === 1 ? 'ele' : 'eles'} — quem procura nessa região não encontra ${n === 1 ? 'esse item' : 'esses itens'} no seu perfil.`, `There ${n === 1 ? 'is 1 item' : `are ${n} items`} in the catalog in this region, but nothing was published about ${n === 1 ? 'it' : 'them'} — people looking in this region do not find ${n === 1 ? 'it' : 'them'} on your profile.`),
        action: tr(lang, `Criar e aprovar uma peça sobre ${reg.name} usando as fotos reais do catálogo.`, `Create and approve a piece about ${reg.name} using the real catalog photos.`),
        measure: tr(lang, 'Ver, depois que a peça for publicada, quantos comentários e mensagens ela recebe sobre esse item.', 'After the piece is published, check how many comments and messages it gets about this item.'),
      },
    })
  }

  // ── low_traction: item COM post na janela e ZERO comentários nesses posts (sempre hipótese) ──
  if (inp.instagramConnected) {
    const lows = inp.catalog
      .map(it => ({ it, ps: postsOfItem(it.id).filter(p => p.published_at || p.status === 'publicado') }))
      .filter(x => x.ps.length > 0)
      .map(x => {
        const media = new Set(x.ps.map(p => p.instagram_media_id).filter((m): m is string => !!m))
        const ev = inp.events.filter(e => e.media_ref && media.has(e.media_ref) && inWin(e.created_at)).length
        return { ...x, ev, hasMedia: media.size > 0 }
      })
      .filter(x => x.ev === 0 && x.hasMedia)
      .sort((a, b) => b.ps.length - a.ps.length)
      .slice(0, 3)
    for (const x of lows) {
      const k = x.ps.length
      const ids = [catalogFact(x.it)]
      ids.push(book.add('fact', tr(lang, `Fotos cadastradas para este item: ${x.it.photoCount}.`, `Photos registered for this item: ${x.it.photoCount}.`), srcCatalog, null, 'catalog'))
      ids.push(book.add('fact', tr(lang, `${k === 1 ? '1 post publicado' : `${k} posts publicados`} sobre "${x.it.title}" nos últimos ${inp.windowDays} dias.`, `${k === 1 ? '1 post published' : `${k} posts published`} about "${x.it.title}" in the last ${inp.windowDays} days.`), srcPosts, today, 'posts'))
      ids.push(book.add('fact', tr(lang, `Nenhum comentário registrado nesse${k === 1 ? '' : 's'} post${k === 1 ? '' : 's'} no período.`, `No comment registered on ${k === 1 ? 'that post' : 'those posts'} in the period.`), srcEvents, today, 'events'))
      candidates.push({
        id: '', kind: 'low_traction', item_ids: [x.it.id], fact_ids: ids, region: regionOf(x.it) || null, forceHypothesis: true,
        hypotheses: inp.texts?.hypotheses?.length ? inp.texts.hypotheses : [
          tr(lang, 'Possível causa: o valor anunciado pode estar acima do que o público dessa região procura — precisa ser comparado com anúncios parecidos.', 'Possible cause: the listed value may be above what the audience in this region is looking for — it needs to be compared with similar listings.'),
          tr(lang, 'Possível causa: as fotos podem não estar mostrando o melhor do item (poucas, escuras ou sem o que mais chama atenção).', 'Possible cause: the photos may not show the best of the item (few, dark, or missing what stands out most).'),
          tr(lang, 'Possível causa: a comunicação pode estar genérica, sem dizer pra quem o item serve nem por que olhar agora.', 'Possible cause: the messaging may be generic, not saying who the item is for or why to look now.'),
        ],
        validationReasons: [tr(lang, 'Sem conversa não dá pra saber a causa: é hipótese até alguém testar.', 'Without conversations the cause is unknown: it stays a hypothesis until someone tests it.')],
        fallback: {
          title: tr(lang, `"${x.it.title}" foi publicado mas não gerou conversa`, `"${x.it.title}" was published but started no conversation`),
          problem: tr(lang, 'O item teve post no período e nenhum comentário chegou. Pode ser o valor anunciado, as fotos ou a comunicação — ainda é hipótese.', 'The item had a post in the period and no comment came in. It could be the listed value, the photos or the messaging — still a hypothesis.'),
          action: tr(lang, 'Testar uma mudança por vez (ex.: outra foto de capa ou outro gancho) e comparar.', 'Test one change at a time (e.g. another cover photo or another hook) and compare.'),
          measure: tr(lang, 'Comparar os comentários e mensagens do próximo post com este.', 'Compare the comments and messages of the next post with this one.'),
        },
      })
    }
  }

  // ── positioning: hashtags que ≥2 concorrentes repetem e a empresa não usa ──────────────────
  const comps = inp.competitors.filter(c => (c.hashtags_used ?? []).length > 0)
  if (comps.length >= 2) {
    const own = new Set(posts.flatMap(p => hashtagsIn(p.content)).map(norm))
    const tally = new Map<string, CompetitorRow[]>()
    for (const c of comps) for (const t of new Set((c.hashtags_used ?? []).map(h => norm(String(h)).replace(/^#/, '').replace(/\s/g, '')).filter(Boolean))) {
      tally.set(t, [...(tally.get(t) ?? []), c])
    }
    const top = [...tally.entries()].filter(([t, cs]) => cs.length >= 2 && !own.has(t)).sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0])).slice(0, 3)
    if (top.length > 0) {
      const ids: string[] = []
      const used = new Map<string, CompetitorRow>()
      for (const [tag, cs] of top) {
        const latest = cs.map(c => dateOnly(c.last_analyzed_at)).filter((d): d is string => !!d).sort().pop() ?? null
        cs.forEach(c => used.set(handleOf(c), c))
        const names = cs.map(handleOf).join(', ')
        ids.push(book.add('data', tr(lang, `#${tag} aparece nos concorrentes monitorados: ${names}.`, `#${tag} shows up among the monitored competitors: ${names}.`), tr(lang, `Instagram dos concorrentes monitorados${latest ? ` (coletado em ${fmtDate(latest, lang)})` : ''}`, `Instagram of monitored competitors${latest ? ` (collected on ${fmtDate(latest, lang)})` : ''}`), latest, `ig:${[...cs.map(handleOf)].sort().join('+')}`))
      }
      for (const [h, c] of [...used.entries()].slice(0, 2)) {
        const d = dateOnly(c.last_analyzed_at)
        const bits = [
          c.posting_frequency_days != null ? tr(lang, `publica a cada ${Number(c.posting_frequency_days).toFixed(1)} dias`, `posts every ${Number(c.posting_frequency_days).toFixed(1)} days`) : '',
          c.avg_engagement != null ? tr(lang, `engajamento médio de ${Math.round(Number(c.avg_engagement))} por post`, `average engagement of ${Math.round(Number(c.avg_engagement))} per post`) : '',
        ].filter(Boolean)
        if (bits.length) ids.push(book.add('data', `${h}: ${bits.join(', ')}.`, tr(lang, `Instagram ${h}${d ? ` (coletado em ${fmtDate(d, lang)})` : ''}`, `Instagram ${h}${d ? ` (collected on ${fmtDate(d, lang)})` : ''}`), d, `ig:${h}`))
      }
      let notes = 0
      for (const [h, c] of used) {
        const nt = (c.notes ?? '').trim()
        if (nt && notes < 2) { notes++; ids.push(book.add('data', tr(lang, `Nota registrada sobre ${h}: "${clip(nt, 200)}"`, `Note recorded about ${h}: "${clip(nt, 200)}"`), tr(lang, 'Notas sobre concorrentes no Sales Boost', 'Competitor notes in Sales Boost'), dateOnly(c.last_analyzed_at), `note:${h}`)) }
      }
      ids.push(book.add('fact', posts.length === 0
        ? tr(lang, `Nenhum post registrado no Sales Boost nos últimos ${inp.windowDays} dias, então nenhuma dessas hashtags foi usada por você.`, `No post registered in Sales Boost in the last ${inp.windowDays} days, so none of these hashtags was used by you.`)
        : tr(lang, `${posts.length === 1 ? '1 post registrado' : `${posts.length} posts registrados`} nos últimos ${inp.windowDays} dias; nenhum usa essas hashtags.`, `${posts.length === 1 ? '1 post registered' : `${posts.length} posts registered`} in the last ${inp.windowDays} days; none uses these hashtags.`), srcPosts, today, 'posts'))
      const reasons: string[] = []
      if (posts.length < 3) reasons.push(tr(lang, 'Há poucos posts próprios no período para comparar com os concorrentes.', 'There are few posts of your own in the period to compare with competitors.'))
      if (!inp.instagramConnected) reasons.push(noIg)
      const oldest = comps.map(c => Date.parse(c.last_analyzed_at ?? '')).filter(Number.isFinite).sort((a, b) => a - b)[0]
      if (!Number.isFinite(oldest) || inp.now.getTime() - oldest > 45 * 86400000) reasons.push(tr(lang, 'A coleta dos concorrentes tem mais de 45 dias ou não tem data.', 'The competitor data is over 45 days old or has no date.'))
      candidates.push({
        id: '', kind: 'positioning', item_ids: [], fact_ids: ids, region: null, forceHypothesis: false, hypotheses: [], validationReasons: reasons,
        fallback: {
          title: tr(lang, 'Os concorrentes repetem temas que você não usa', 'Competitors repeat themes you do not use'),
          problem: tr(lang, 'Mais de um concorrente monitorado usa as mesmas hashtags e você não usou nenhuma delas no período — pode estar fora de buscas que eles disputam.', 'More than one monitored competitor uses the same hashtags and you used none of them in the period — you may be missing searches they compete for.'),
          action: tr(lang, 'Escolher com o dono quais desses temas combinam com o catálogo e testar em uma peça.', 'Pick with the owner which of these themes fit the catalog and test them in one piece.'),
          measure: tr(lang, 'Comparar comentários e mensagens da peça de teste com as peças sem essas hashtags.', 'Compare comments and messages of the test piece with pieces without these hashtags.'),
        },
      })
    }
  }

  // ── market_change: sinal/tendência COM fonte E item do catálogo na mesma região ─────────────
  const ext: Ext[] = []
  for (const s of inp.signals) {
    const src = [s.source_name?.trim(), s.source_url?.trim() ? `(${s.source_url.trim()})` : ''].filter(Boolean).join(' ')
    if (!s.title?.trim() || !src) continue
    // Força: recalculada com a ficha de hoje (fonte da verdade). Sem link (ou sem regras) = forte.
    const st = inp.quality && s.source_url?.trim() ? signalStrength({ kind: s.kind ?? '', title: s.title, summary: s.summary?.trim() || null, source_url: s.source_url.trim() }, inp.quality) : { strength: 'strong' as const }
    ext.push({ id: s.id, title: s.title.trim(), summary: s.summary?.trim() ?? '', text: clip(`${s.title.trim()}${s.summary?.trim() ? ` — ${s.summary.trim()}` : ''}`, 320), source: src, host: (s.source_name?.trim() || s.source_url || '').trim(), date: dateOnly(s.observed_at), origin: `signal:${norm(s.source_name ?? s.source_url ?? '')}`, hay: norm(`${s.title} ${s.summary ?? ''}`), region: norm(s.region ?? ''), weak: st.strength === 'weak' })
  }
  for (const t of inp.trends) {
    const src = (t.source ?? '').trim()
    if (!t.title?.trim() || !src || AI_SOURCES.test(norm(src))) continue // tendência não tem link: sempre forte (comportamento anterior)
    ext.push({ title: t.title.trim(), summary: t.description?.trim() ?? '', text: clip(`${t.title.trim()}${t.description?.trim() ? `: ${t.description.trim()}` : ''}`, 320), source: src, host: src, date: dateOnly(t.detected_at), origin: `trend:${norm(src)}`, hay: norm(`${t.title} ${t.description ?? ''}`), region: '', weak: false })
  }
  for (const [rk, reg] of byRegion) {
    if (rk.length < 3) continue
    const re = new RegExp(`(^|[^a-z0-9])${rk.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^a-z0-9]|$)`)
    const matched = ext.filter(e => (e.region && (e.region === rk || re.test(e.region))) || re.test(e.hay))
    // Mesma notícia em dois portais = UM evento (uma origem). Só evento com ao menos 1 fonte FORTE vira oportunidade; o fraco entra como contexto rotulado.
    const events = groupEvents(matched, reg.name)
    const strongEv = events.filter(g => g.strong).slice(0, 4)
    if (strongEv.length === 0) continue
    const weakEv = events.filter(g => !g.strong).slice(0, 2)
    const ids = reg.items.slice(0, 2).map(catalogFact)
    for (const g of strongEv) ids.push(book.add('data', g.rep.text, eventSource(g, lang, false), g.rep.date, g.origin, undefined, g.rep.id, { signal_ids: g.ids }))
    for (const g of weakEv) ids.push(book.add('data', g.rep.text, eventSource(g, lang, true), g.rep.date, g.origin, undefined, g.rep.id, { signal_ids: g.ids, weak: true }))
    // Peças já preparadas nessa região: fato verdadeiro (e trava contra a IA dizer "nenhum post").
    const nPieces = reg.items.reduce((a, it) => a + piecesOf(it.id), 0)
    if (nPieces > 0) {
      const published = new Set(posts.filter(p => p.item_id && (p.published_at || p.instagram_media_id)).map(p => p.item_id))
      const nPub = reg.items.filter(it => published.has(it.id)).length
      ids.push(book.add('fact', nPub === 0
        ? tr(lang, `${nPieces === 1 ? '1 peça preparada' : `${nPieces} peças preparadas`} no Sales Boost para itens em "${reg.name}", nenhuma publicada.`, `${nPieces === 1 ? '1 piece prepared' : `${nPieces} pieces prepared`} in Sales Boost for items in "${reg.name}", none published.`)
        : tr(lang, `${nPieces === 1 ? '1 peça preparada' : `${nPieces} peças preparadas`} no Sales Boost para itens em "${reg.name}"; ${nPub === 1 ? '1 item' : `${nPub} itens`} com post publicado.`, `${nPieces === 1 ? '1 piece prepared' : `${nPieces} pieces prepared`} in Sales Boost for items in "${reg.name}"; ${nPub === 1 ? '1 item' : `${nPub} items`} with a published post.`), tr(lang, 'Peças preparadas no Sales Boost', 'Pieces prepared in Sales Boost'), today, 'pieces'))
    }
    candidates.push({
      id: '', kind: 'market_change', item_ids: reg.items.map(i => i.id), fact_ids: ids, region: reg.name, forceHypothesis: false, hypotheses: [],
      validationReasons: strongEv.length < 2 ? [tr(lang, 'Só uma fonte de mercado cita essa região — confirme antes de agir.', 'Only one market source mentions this region — confirm before acting.')] : [],
      fallback: {
        title: tr(lang, `Mudança de mercado ligada a ${reg.name}`, `Market change tied to ${reg.name}`),
        problem: tr(lang, `Uma fonte de mercado cita ${reg.name} e há item do catálogo ali — pode haver uma janela para falar disso antes de outros.`, `A market source mentions ${reg.name} and there is a catalog item there — there may be a window to talk about it before others.`),
        action: tr(lang, `Conferir a fonte e, se fizer sentido, criar uma peça ligando ${reg.name} aos itens do catálogo.`, `Check the source and, if it makes sense, create a piece linking ${reg.name} to the catalog items.`),
        measure: tr(lang, 'Ver se a peça gera mais comentários e mensagens do que as anteriores sobre a região.', 'See whether the piece gets more comments and messages than earlier ones about the region.'),
      },
    })
  }

  candidates.forEach((c, i) => { c.id = `C${i + 1}` })
  const used = new Set(candidates.flatMap(c => c.fact_ids))
  return { facts: book.facts, candidates, usedSignalIds: signalIdsOf(book.facts.filter(f => used.has(f.id))) }
}

function itemsWord(n: number, lang: Lang): string {
  return n === 1 ? tr(lang, '1 item', '1 item') : tr(lang, `${n} itens`, `${n} items`)
}

// ── Eventos: a mesma notícia em portais diferentes conta UMA vez ──────────────────────────────────────────────────────
export interface Ext { id?: string; title: string; summary: string; text: string; source: string; host: string; date: string | null; origin: string; hay: string; region: string; weak: boolean }
export interface EventGroup { rep: Ext; members: Ext[]; strong: boolean; origin: string; ids: string[] }
const STOP = new Set(['para', 'como', 'mais', 'menos', 'entre', 'sobre', 'apos', 'desde', 'neste', 'nesta', 'esta', 'este', 'esse', 'essa', 'pela', 'pelo', 'pelas', 'pelos', 'muito', 'ainda', 'tambem', 'seus', 'suas', 'dele', 'dela', 'quando', 'onde', 'sera', 'serao', 'tera', 'tem', 'foi', 'sao', 'pode', 'podem', 'with', 'from', 'this', 'that', 'have', 'will', 'been', 'were', 'their', 'into', 'over', 'after', 'about'])
const sigWords = (t: string, skip: Set<string>): Set<string> => new Set(normalizeTitle(t).split(' ').filter(w => w.length >= 4 && !STOP.has(w) && !skip.has(w)))
/** Mesmo evento? Títulos com palavras significativas (≥4 letras, sem stopword, sem o nome da região) em comum: Jaccard ≥ 0,5 OU ≥ 3 palavras compartilhadas (título truncado pelo portal). */
export function sameEvent(a: string, b: string, regionName = ''): boolean {
  const skip = new Set(normalizeTitle(regionName).split(' ').filter(Boolean))
  const wa = sigWords(a, skip), wb = sigWords(b, skip)
  if (!wa.size || !wb.size) return false
  const inter = [...wa].filter(w => wb.has(w)).length
  return inter >= 3 || inter / (wa.size + wb.size - inter) >= 0.5
}
/** Agrupa fontes da mesma região em eventos (ordem de entrada preservada). Representante = primeira fonte forte do grupo (senão a primeira). */
export function groupEvents(items: Ext[], regionName = ''): EventGroup[] {
  const groups: Ext[][] = []
  for (const it of items) {
    const g = groups.find(m => m.some(x => sameEvent(x.title, it.title, regionName)))
    if (g) g.push(it); else groups.push([it])
  }
  return groups.map(members => {
    const strong = members.some(m => !m.weak)
    const rep = members.find(m => !m.weak) ?? members[0]
    return { rep, members, strong, origin: `event:${normalizeTitle(rep.title).slice(0, 80)}`, ids: [...new Set(members.map(m => m.id).filter((x): x is string => !!x))] }
  })
}
function eventSource(g: EventGroup, lang: Lang, weak: boolean): string {
  const others = [...new Set(g.members.filter(m => m !== g.rep && m.host && m.host !== g.rep.host).map(m => m.host))]
  return g.rep.source
    + (others.length ? tr(lang, ` (+ também publicado em ${others.join(', ')})`, ` (+ also published by ${others.join(', ')})`) : '')
    + (weak ? tr(lang, ' · evidência fraca (serviço/patrocinado/sem impacto)', ' · weak evidence (service/sponsored/no impact)') : '')
}
