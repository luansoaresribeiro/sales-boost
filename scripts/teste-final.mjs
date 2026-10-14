// Teste Final Sales Boost — roteiro fixo, resultado comparável a cada rodada
// (pedido do dono, 2026-10-14: "precisamos fazer este momento ter sempre
// resultados previsíveis"). Ver docs/TESTE-FINAL.md.
//
// Roda com o LOGIN DO CLIENTE de teste (nunca chave de administrador), contra
// o sistema de verdade, e confere cada passo por regras objetivas — os textos
// da IA mudam a cada rodada; o que é conferido, não.
//
//   QA_EMAIL=... QA_PASSWORD=... node scripts/teste-final.mjs [--sem-video] [--com-mobiliar] [--sem-calendario] [--sem-limpeza] [--saida=pasta]
//
// Lê VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY do ambiente ou de .env.local/.env.
// Gera SÓ o que o calendário da estratégia pede (decisão do dono 2026-10-14).
// Custo típico: ~US$ 0,50–1 (edições de foto das peças + 1 vídeo se a semana pedir).
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'

const args = new Set(process.argv.slice(2))
const OUT = (process.argv.find(a => a.startsWith('--saida=')) ?? '--saida=qa-relatorios').slice(8)
for (const f of ['.env.local', '.env']) {
  if (!existsSync(f)) continue
  for (const line of readFileSync(f, 'utf8').split('\n')) {
    const m = line.match(/^\s*(VITE_SUPABASE_URL|VITE_SUPABASE_ANON_KEY)\s*=\s*"?([^"\n]*)"?/)
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim()
  }
}
const URL_ = process.env.VITE_SUPABASE_URL, ANON = process.env.VITE_SUPABASE_ANON_KEY
const EMAIL = process.env.QA_EMAIL, PASSWORD = process.env.QA_PASSWORD, REFRESH = process.env.QA_REFRESH_TOKEN, ACCESS = process.env.QA_TOKEN
// QA_TOKEN (sessão de até 1h) ou QA_REFRESH_TOKEN: alternativas à senha (sessão já aberta da conta de teste) — a senha nunca precisa ficar guardada.
if (!URL_ || !ANON || (!ACCESS && !REFRESH && (!EMAIL || !PASSWORD))) { console.error('Faltam VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY e QA_EMAIL+QA_PASSWORD (ou QA_REFRESH_TOKEN).'); process.exit(2) }

// Preços medidos (docs/DECISIONS.md, 2026-10-14) — os mesmos do _shared/spendCap.ts.
const PRICE = { edit: 0.08, image: 0.04 }
// Imóvel fixo do teste: mesmos dados em toda rodada (realistas — o teste também
// confere que a legenda não traz número fora disso).
const QA_TITLE = 'Imóvel de teste (QA)'
const QA_FIELDS = { tipo: 'Apartamento', bairro: 'Leblon', venda_ou_aluguel: 'Venda', preco: 3000000, quartos: 3, m2: 140, vagas: 2, condominio: 3200, iptu: 850 }
const QA_PHOTOS = 10
// Sinais de texto inventado ou fora do lugar (regra 5 / achados do teste de 2026-10-14).
const BANNED = [
  [/me mandou (uma )?mensagem/i, 'conversa inventada'], [/neg[oó]cio (foi )?fechado|fechamos (o )?neg[oó]cio/i, 'venda inventada'],
  [/depoimento|disse:? ['"“]/i, 'depoimento inventado'], [/\bcorretor\b,? (me )?(passa|manda|envia)/i, 'mensagem pro corretor'],
  [/\bops!?\b/i, 'texto de erro na legenda'], [/a \d+ minutos? (a p[eé]|de carro|do|da)/i, 'distância inventada'],
]

const T0 = Date.now(), started = new Date().toISOString()
let token = '', companyId = ''
const results = []
const created = { content: [] }
const sleep = ms => new Promise(r => setTimeout(r, ms))
const money = n => `US$ ${n.toFixed(2)}`

async function call(path, { method = 'POST', body, headers = {}, raw = false, timeout = 170_000 } = {}) {
  const res = await fetch(URL_ + path, {
    method, signal: AbortSignal.timeout(timeout),
    headers: { apikey: ANON, Authorization: `Bearer ${token || ANON}`, ...(body !== undefined && !(body instanceof Uint8Array) ? { 'Content-Type': 'application/json' } : {}), ...headers },
    body: body === undefined ? undefined : body instanceof Uint8Array ? body : JSON.stringify(body),
  })
  if (raw) return res
  const text = await res.text()
  let data; try { data = JSON.parse(text) } catch { data = text }
  return { status: res.status, data }
}
const fn = (name, body, opts) => call(`/functions/v1/${name}`, { body, ...opts })
const rest = (q, opts) => call(`/rest/v1/${q}`, { method: 'GET', ...opts })

async function step(name, run) {
  const t = Date.now()
  process.stdout.write(`… ${name}\n`)
  try {
    const r = await run()
    results.push({ name, ok: r.ok, detail: r.detail, cost: r.cost ?? 0, secs: Math.round((Date.now() - t) / 1000), extra: r.extra })
  } catch (e) {
    results.push({ name, ok: false, detail: `erro: ${e instanceof Error ? e.message : String(e)}`, cost: 0, secs: Math.round((Date.now() - t) / 1000) })
  }
  const last = results.at(-1)
  console.log(`${last.ok === null ? '⏭️ ' : last.ok ? '✅' : '❌'} ${name} — ${last.detail} (${last.secs}s)`)
}

// Tamanho de um PNG pela leitura do cabeçalho (sem biblioteca).
async function pngSize(url) {
  const res = await fetch(url, { signal: AbortSignal.timeout(60_000) })
  const b = new Uint8Array(await res.arrayBuffer())
  const dv = new DataView(b.buffer)
  return b[1] === 0x50 ? { w: dv.getUint32(16), h: dv.getUint32(20) } : null
}
const bannedIn = text => BANNED.filter(([re]) => re.test(text ?? '')).map(([, why]) => why)
const imageKind = url => !url ? 'nenhuma' : url.includes('/vault-real-') ? 'edit' : url.includes('/generated/') ? 'image' : 'free'
async function spend(itemId) {
  const r = await fn('item-videos', { action: 'list', item_id: itemId })
  if (r.status !== 200) throw new Error(`não li o gasto do mês (${r.status})`)
  return { spent: Number(r.data.month_spent_usd), cap: Number(r.data.month_cap_usd), videoCost: r.data.cost_usd }
}

// ── 0. Login + conta paga ────────────────────────────────────────────────────
const login = ACCESS ? { data: { access_token: ACCESS } } : REFRESH
  ? await call('/auth/v1/token?grant_type=refresh_token', { body: { refresh_token: REFRESH } })
  : await call('/auth/v1/token?grant_type=password', { body: { email: EMAIL, password: PASSWORD } })
if (!login.data?.access_token) { console.error('Login falhou:', login.data?.error_description ?? login.status); process.exit(1) }
token = login.data.access_token

let item = null, ficha = null, before = null
await step('Acesso da conta', async () => {
  const { data } = await rest('companies?select=id,plan,manual_access,stripe_subscription_id,vertical_key,business_name')
  const c = Array.isArray(data) ? data[0] : null
  if (!c) return { ok: false, detail: 'conta sem empresa' }
  companyId = c.id
  const pb = await rest(`vertical_playbooks?key=eq.${c.vertical_key}&select=config`)
  ficha = pb.data?.[0]?.config ?? null
  const paid = (c.plan && c.plan !== 'free') || c.manual_access || c.stripe_subscription_id
  return { ok: !!paid && !!ficha, detail: `${c.business_name} · plano ${c.plan}${c.manual_access ? ' · acesso liberado' : ''}${ficha ? '' : ' · SEM ficha do setor'}` }
})
if (!companyId) { console.error('Sem empresa — parando.'); process.exit(1) }

// ── 1. Imóvel fixo do teste (cria uma vez, reaproveita nas próximas rodadas) ──
await step('Imóvel fixo do teste', async () => {
  const q = await rest(`marketing_ai_knowledge?company_id=eq.${companyId}&kind=eq.product&select=id,title,meta,image_url&order=created_at.asc`)
  const items = Array.isArray(q.data) ? q.data : []
  item = items.find(i => i.title === QA_TITLE) ?? null
  if (item) return { ok: (item.meta?.photos?.length ?? 0) >= 5, detail: `reaproveitado (${item.meta.photos.length} fotos)` }
  // Primeira vez: copia fotos reais de um imóvel que já existe na conta.
  const source = items.find(i => (i.meta?.photos?.length ?? 0) >= QA_PHOTOS)
  if (!source) return { ok: false, detail: `cadastre antes 1 imóvel com pelo menos ${QA_PHOTOS} fotos reais nesta conta` }
  const photos = []
  for (let i = 0; i < QA_PHOTOS; i++) {
    const img = new Uint8Array(await (await fetch(source.meta.photos[i].url)).arrayBuffer())
    const path = `renders/${companyId}/qa-fixo-${i + 1}.jpg`
    const up = await call(`/storage/v1/object/post-images/${path}`, { body: img, headers: { 'Content-Type': 'image/jpeg', 'x-upsert': 'true' } })
    if (up.status >= 300) throw new Error(`upload da foto ${i + 1} (${up.status})`)
    photos.push({ url: `${URL_}/storage/v1/object/public/post-images/${path}`, path })
  }
  const ins = await call('/rest/v1/marketing_ai_knowledge', {
    body: { company_id: companyId, module: 'visual', kind: 'product', title: QA_TITLE, image_url: photos[0].url, meta: { photos, fields: QA_FIELDS } },
    headers: { Prefer: 'return=representation' },
  })
  item = Array.isArray(ins.data) ? ins.data[0] : null
  return { ok: !!item, detail: item ? `criado com ${photos.length} fotos copiadas de "${source.title}"` : `não consegui criar (${ins.status})` }
})
if (!item) { console.error('Sem imóvel de teste — parando.'); process.exit(1) }
const qaPhotos = item.meta.photos.map(p => p.url)
await step('Gasto do mês (antes)', async () => {
  before = await spend(item.id)
  return { ok: before.spent < before.cap, detail: `${money(before.spent)} de ${money(before.cap)}` }
})

// ── 2. Artes do kit grátis (render, sem custo) ────────────────────────────────
await step('Artes do kit grátis (3 tamanhos)', async () => {
  const variants = ficha?.gift_creative?.variants ?? []
  if (!variants.length) return { ok: null, detail: 'setor sem variações de arte na ficha' }
  const bad = []
  for (const v of variants) {
    const r = await fn('render-format', { template: 'photo', background: qaPhotos[0], fields: { tag: v.tag ?? '', headline: v.headline ?? '', offer: v.offer ?? '', cta: v.cta ?? '', scale: String(v.scale ?? 1) }, width: v.width, height: v.height, save: false })
    const size = r.data?.url ? await pngSize(r.data.url) : null
    if (!size || size.w !== v.width || size.h !== v.height) bad.push(`${v.width}x${v.height}`)
  }
  return { ok: !bad.length, detail: bad.length ? `tamanho errado: ${bad.join(', ')}` : `${variants.length} artes nos tamanhos certos` }
})

// ── 3. Calendário da semana: SÓ o que a estratégia pede ───────────────────────
// Decisão do dono (2026-10-14): o teste gera somente o que o calendário semanal
// da estratégia disser — nada de post avulso. Pra rodada ser comparável, a
// próxima semana começa limpa: apaga as peças ainda NÃO aprovadas nem agendadas
// dessa semana (só desta conta de teste) e pede de novo.
const mixOf = async () => ((await rest('marketing_ai_strategies?kind=eq.main&status=eq.active&select=content_plan&order=updated_at.desc&limit=1')).data?.[0]?.content_plan?.weekly_mix ?? [])
const mix = await mixOf()
// Mesma janela do creative-generate (nextWeekDates): da próxima segunda ao domingo.
const nextWeek = (() => {
  const now = new Date(), off = now.getDay() === 0 ? 1 : 8 - now.getDay()
  return Array.from({ length: 7 }, (_, i) => new Date(now.getFullYear(), now.getMonth(), now.getDate() + off + i).toISOString().slice(0, 10))
})()
await step('Calendário da semana pela estratégia', async () => {
  if (args.has('--sem-calendario')) return { ok: null, detail: 'pulado (--sem-calendario)' }
  if (!mix.length) return { ok: false, detail: 'sem estratégia ativa com mix semanal (a estratégia só nasce com os requisitos do sino preenchidos)' }
  const old = (await rest(`marketing_ai_test_content?company_id=eq.${companyId}&planned_for=gte.${nextWeek[0]}&planned_for=lte.${nextWeek[6]}&status=in.(draft,vault)&select=id`)).data ?? []
  const queued = new Set(((await rest(`agent_actions?company_id=eq.${companyId}&ref_type=eq.marketing_ai_test_content&execution_status=eq.QUEUED&select=ref_id`)).data ?? []).map(x => x.ref_id))
  let cleared = 0
  for (const o of old) {
    if (queued.has(o.id)) continue
    const d = await call(`/rest/v1/marketing_ai_test_content?id=eq.${o.id}&company_id=eq.${companyId}`, { method: 'DELETE' })
    if (d.status < 300) cleared++
  }
  const r = await fn('creative-generate', { action: 'plan_week' })
  if (r.status !== 200) return { ok: false, detail: `falhou (${r.status}) ${JSON.stringify(r.data).slice(0, 160)}` }
  const days = (r.data.days ?? []).map(d => d.date)
  const producerOf = Object.fromEntries(mix.map(m => [m.format, m.producer]))
  // item_video ("você pede, custa") e DM não nascem sozinhos — ficam de fora da conta.
  const expected = mix.filter(m => m.producer !== 'dm' && m.producer !== 'item_video').reduce((s, m) => s + (m.per_week | 0), 0)
    - (r.data.todo ?? []).filter(t => !['dm', 'item_video'].includes(producerOf[t.format])).reduce((s, t) => s + (t.per_week | 0), 0)
  let rows = []
  // Espera as peças E as notas (a análise roda depois de criar).
  for (let i = 0; i < 36; i++) {
    await sleep(10_000)
    rows = ((await rest(`marketing_ai_test_content?company_id=eq.${companyId}&planned_for=gte.${days[0]}&planned_for=lte.${days.at(-1)}&select=id,image_url,caption,created_at,item_id,recipe,provider,status,quality_score`)).data ?? [])
      .filter(x => x.created_at >= started)
    if (rows.length >= expected && rows.every(x => x.quality_score != null)) break
  }
  created.content.push(...rows.map(x => x.id))
  const banned = rows.flatMap(x => bannedIn(x.caption))
  // Só as receitas que mostram o imóvel (provider catalogo_real) têm de usar foto real;
  // as de bairro usam clima genérico do bairro de propósito (nunca o imóvel).
  const notReal = rows.filter(x => x.provider === 'catalogo_real' && imageKind(x.image_url) !== 'free' && imageKind(x.image_url) !== 'edit').length
  const ready = rows.filter(x => x.status === 'vault').length
  const review = rows.filter(x => x.status === 'draft' && x.quality_score != null)
  const cost = rows.reduce((s, x) => s + ({ edit: PRICE.edit, image: PRICE.image }[imageKind(x.image_url)] ?? 0), 0)
  const ok = rows.length >= expected && !banned.length && !notReal
  return {
    ok,
    detail: `${rows.length} de ${expected} peças pedidas pela estratégia (${cleared} antigas não aprovadas limpas) · ${ready} prontas pra aprovar (passaram na análise), ${review.length} em revisão${review.length ? ` (${review.map(x => `${x.recipe ?? 'post'} ${x.quality_score}`).join(', ')})` : ''}${notReal ? ` · ${notReal} peça(s) de imóvel SEM foto real` : ''}${banned.length ? ` · TEXTO PROIBIDO: ${[...new Set(banned)].join(', ')}` : ''}`,
    cost,
    extra: rows.map(x => ({ id: x.id, recipe: x.recipe, provider: x.provider, status: x.status, score: x.quality_score })),
  }
})

// ── 4. Vídeo do imóvel — só se a estratégia pedir vídeo na semana ─────────────
await step('Vídeo do imóvel (5 s)', async () => {
  if (args.has('--sem-video')) return { ok: null, detail: 'pulado (--sem-video)' }
  if (!mix.some(m => m.producer === 'item_video')) return { ok: null, detail: 'a estratégia não pede vídeo nesta semana' }
  const c = await fn('item-videos', { action: 'create', item_id: item.id, kind: 'room', photos: [qaPhotos[2]], label: 'Teste final' })
  if (c.status !== 200) return { ok: false, detail: `não começou (${c.status}) ${c.data?.error ?? ''}` }
  let s = null
  for (let i = 0; i < 48; i++) {
    await sleep(10_000)
    s = await fn('item-videos', { action: 'status', video_id: c.data.video_id })
    if (s.data?.status === 'completed' || s.data?.status === 'failed') break
  }
  if (s?.data?.status !== 'completed') return { ok: false, detail: s?.data?.status === 'failed' ? 'falhou — ver o motivo nos registros ("[tour] higgsfield recusou"); costuma ser crédito da Higgsfield' : 'não terminou em 8 min' }
  const head = await fetch(s.data.video_url, { method: 'HEAD' })
  return { ok: head.ok, detail: head.ok ? 'pronto e baixável' : `arquivo não abriu (${head.status})`, cost: before?.videoCost?.room ?? 0.42 }
})

// ── 5. Mobiliar — ferramenta do imóvel, fora do calendário: só com --com-mobiliar
await step('Mobiliar 1 foto', async () => {
  if (!args.has('--com-mobiliar')) return { ok: null, detail: 'fora do calendário — só com --com-mobiliar' }
  const st = await fn('virtual-staging', { action: 'start', item_id: item.id, photo_url: qaPhotos[1], style: 'moderno' })
  if (st.status !== 200) return { ok: false, detail: `não começou (${st.status}) ${st.data?.error ?? ''}` }
  const id = st.data.id
  for (let i = 0; i < 24; i++) {
    await sleep(10_000)
    const x = await fn('virtual-staging', { action: 'status', id })
    if (x.data?.status === 'completed' || x.data?.status === 'failed') break
  }
  const row = (await rest(`virtual_staging?id=eq.${id}&select=status,attempts`)).data?.[0]
  const attempts = row?.attempts ?? 1
  const res = row?.status === 'completed' ? await fn('virtual-staging', { action: 'result', id }, { raw: true }) : null
  const ok = !!res && res.ok && (Number(res.headers.get('content-length') ?? 1) > 0)
  return { ok, detail: ok ? `pronta (${attempts} tentativa${attempts > 1 ? 's' : ''}) — o dono ainda precisa aprovar` : `não ficou pronta (${row?.status ?? '—'})`, cost: attempts * PRICE.edit }
})

// ── 6. Teto de gasto: o que foi gerado bate com o que foi somado? ─────────────
await step('Teto de US$ 40 soma certo', async () => {
  await sleep(5_000)
  const after = await spend(item.id)
  const expected = results.reduce((s, r) => s + (r.cost ?? 0), 0)
  const delta = after.spent - before.spent
  const ok = Math.abs(delta - expected) < 0.011
  return { ok, detail: `somou ${money(delta)} · esperado ${money(expected)} · mês: ${money(after.spent)} de ${money(after.cap)}` }
})

// ── 7. Segurança básica: a conta só enxerga o que é dela ──────────────────────
await step('Conta só vê os próprios dados', async () => {
  const leaks = []
  const comp = (await rest('companies?select=id')).data ?? []
  if (comp.length !== 1) leaks.push(`empresas visíveis: ${comp.length}`)
  for (const t of ['marketing_ai_knowledge', 'marketing_ai_test_content', 'video_tours', 'virtual_staging']) {
    const other = (await rest(`${t}?company_id=neq.${companyId}&select=id&limit=1`)).data
    if (Array.isArray(other) && other.length) leaks.push(t)
  }
  return { ok: !leaks.length, detail: leaks.length ? `VAZAMENTO: ${leaks.join(', ')}` : 'nenhum dado de outra conta visível' }
})

// ── 8. Limpeza: só o que esta rodada criou ────────────────────────────────────
await step('Limpeza', async () => {
  if (args.has('--sem-limpeza')) return { ok: null, detail: 'pulada (--sem-limpeza)' }
  let n = 0
  for (const id of created.content) {
    const d = await call(`/rest/v1/marketing_ai_test_content?id=eq.${id}&company_id=eq.${companyId}`, { method: 'DELETE' })
    if (d.status < 300) n++
  }
  return { ok: n === created.content.length, detail: `${n} peça(s) de teste apagada(s); o imóvel fixo fica pra próxima rodada` }
})

// ── Relatório ─────────────────────────────────────────────────────────────────
const total = results.reduce((s, r) => s + (r.cost ?? 0), 0)
const failed = results.filter(r => r.ok === false)
const md = [
  `# Teste Final Sales Boost — ${new Date(T0).toISOString().slice(0, 16).replace('T', ' ')} UTC`, '',
  `**Resultado: ${failed.length ? `❌ ${failed.length} passo(s) falharam` : '✅ tudo passou'}** · custo ${money(total)} · ${Math.round((Date.now() - T0) / 60000)} min`, '',
  '| Passo | Resultado | Detalhe | Custo | Tempo |', '|---|---|---|---|---|',
  ...results.map(r => `| ${r.name} | ${r.ok === null ? '⏭️' : r.ok ? '✅' : '❌'} | ${String(r.detail).replace(/\|/g, '/')} | ${r.cost ? money(r.cost) : '—'} | ${r.secs}s |`), '',
]
mkdirSync(OUT, { recursive: true })
const stamp = new Date(T0).toISOString().replace(/[:.]/g, '-').slice(0, 19)
writeFileSync(`${OUT}/teste-final-${stamp}.md`, md.join('\n'))
writeFileSync(`${OUT}/teste-final-${stamp}.json`, JSON.stringify({ started, results, total }, null, 2))
console.log('\n' + md.join('\n'))
process.exit(failed.length ? 1 : 0)
