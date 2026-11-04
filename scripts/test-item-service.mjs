import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
// Roda: node --experimental-strip-types scripts/test-item-service.mjs
// Fase 4 (2026-11-04): disponibilidade do imóvel, conferência no portal, regra de 2 h, motivo da escolha.
import {
  parseAvailabilityCfg, itemCfgFrom, availabilityOf, filterPickable, rankItems, buildPickReason, cleanItemPick, ownerBlockMessage,
  extractListingIds, fetchFeedIds, revalidate, memoFeed, clearFeedMemo, getItemChecked, fetchItemCfgStrict, revalidateWith, unverifiableOutcome, FEED_CACHE_MS, UNVERIFIABLE_MAX_MS,
} from '../supabase/functions/_shared/itemService.ts'
import * as front from '../src/lib/itemAvailability.ts'
let n = 0; const ok = (m) => { n++; console.log('ok -', m) }

const FICHA = {
  catalog_fields: { required: [{ key: 'fotos', type: 'photos', min: 4 }], optional: [] },
  availability: {
    statuses: ['disponivel', 'reservado', 'vendido', 'alugado', 'inativo', 'removido'], blocking: ['reservado', 'vendido', 'alugado', 'inativo', 'removido'],
    default: 'disponivel', removed: 'removido', labels: { pt: { disponivel: 'Disponível', vendido: 'Vendido', alugado: 'Alugado', inativo: 'Inativo', removido: 'Removido do portal', reservado: 'Reservado' }, en: { vendido: 'Sold' } },
  },
}
const cfg = itemCfgFrom(FICHA)
const NOW = Date.parse('2026-11-04T12:00:00Z')
const ph = (k) => Array.from({ length: k }, (_, i) => ({ url: `u${i}` }))
const item = (id, meta = {}) => ({ id, title: id, meta: { photos: ph(5), ...meta } })
const av = (status, source = 'manual', checked_at = new Date(NOW - 60_000).toISOString()) => ({ availability: { status, source, checked_at } })

// ── ficha ──
assert.equal(cfg.minPhotos, 4); assert.equal(itemCfgFrom({}).minPhotos, 5); assert.equal(itemCfgFrom({}).availability, null); ok('mínimo de fotos vem da ficha (padrão 5); ficha sem availability = null')
assert.equal(parseAvailabilityCfg({ statuses: [] }), null); assert.equal(parseAvailabilityCfg('x'), null)
assert.deepEqual(parseAvailabilityCfg({ statuses: ['a', 'b'], blocking: ['b', 'zzz'], removed: 'nao' }).blocking, ['b']); assert.equal(parseAvailabilityCfg({ statuses: ['a'], removed: 'nao' }).removed, null); ok('blocking/removed fora de statuses são ignorados')

// ── availabilityOf: disponível, vendido, alugado, inativo, removido, sem status ──
const a = (m) => availabilityOf(item('x', m), cfg.availability)
assert.equal(a(av('disponivel')).blocking, false); ok('disponível = livre')
for (const s of ['vendido', 'alugado', 'inativo', 'removido', 'reservado']) assert.equal(a(av(s)).blocking, true)
ok('vendido, alugado, inativo, removido, reservado = bloqueiam')
const none = a({}); assert.deepEqual([none.status, none.blocking, none.never_checked, none.source], ['disponivel', false, true, null]); ok('sem meta.availability = disponível, nunca conferido')
assert.equal(a(av('status_antigo')).blocking, true); ok('status que a ficha não conhece = bloqueia (na dúvida, não publica)')
const off = availabilityOf(item('x', av('vendido')), null); assert.equal(off.blocking, false); assert.equal(off.status, null); ok('ficha sem availability = nada bloqueado')

// ── lista de imóveis usáveis ──
const rows = [item('ok1'), item('ok2', av('disponivel')), item('sold', av('vendido')), item('few', { photos: ph(3) }), item('rent', av('alugado')), item('rem', av('removido', 'portal_feed'))]
const fp = filterPickable(rows, cfg)
assert.deepEqual(fp.items.map(i => i.id), ['ok1', 'ok2']); assert.deepEqual(fp.excluded.map(e => `${e.id}:${e.reason}`), ['sold:availability', 'few:photos', 'rent:availability', 'rem:availability']); ok('lista: some vendido/alugado/removido e item com poucas fotos')
assert.equal(filterPickable([item('x', { photos: ph(4) })], cfg).items.length, 1); ok('mínimo 4 da ficha vale (antes era 5 fixo no servidor)')
assert.equal(filterPickable(rows, itemCfgFrom({})).items.length, 5); ok('ficha sem availability: só o filtro de fotos (compatível)')

// ── mensagem pro dono ──
assert.equal(ownerBlockMessage(item('a'), cfg), null)
assert.match(ownerBlockMessage(item('a', av('vendido')), cfg), /Vendido/i); assert.match(ownerBlockMessage(null, cfg), /não foi encontrado/); assert.match(ownerBlockMessage(item('a', { photos: [] }), cfg), /4 fotos/); ok('mensagens 400 do caminho do dono')

// ── rotação + motivo ──
const items = filterPickable([item('a'), item('b'), item('c')], cfg).items
const usage = new Map([['a', 3], ['b', 1], ['c', 2]])
let r = rankItems(items, usage); assert.deepEqual([r.id, r.candidates, r.usage_21d, r.cooldown_ok], ['b', 3, 1, true]); ok('rotação: o menos usado')
r = rankItems(items, usage, { avoid: new Set(['b']) }); assert.deepEqual([r.id, r.candidates, r.cooldown_ok], ['c', 2, true]); ok('rotação respeita o que já foi usado (avoid)')
assert.equal(rankItems(items, usage, { avoid: new Set(['a', 'b', 'c']), strict: true }), null); ok('strict e tudo usado = null (vaga vira "pra fazer")')
r = rankItems(items, usage, { avoid: new Set(['a', 'b', 'c']) }); assert.deepEqual([r.id, r.cooldown_ok], ['b', false]); ok('sem strict e tudo usado = repete o menos usado, cooldown_ok=false')
assert.equal(rankItems([], usage), null); ok('sem imóvel = null')
const reason = buildPickReason({ rule: 'least_used', item: items[1], cfg, rank: rankItems(items, usage), now: '2026-11-04T12:00:00.000Z' })
assert.deepEqual(reason.attributes, [{ key: 'photos', value: 5, path: 'meta.photos' }]); assert.equal(reason.min_photos, 4); assert.equal(reason.availability.status, null); ok('motivo: só campos reais (fotos); nunca conferido não vira atributo')
const reason2 = buildPickReason({ rule: 'owner_choice', item: filterPickable([item('z', av('disponivel'))], cfg).items[0], cfg })
assert.deepEqual(reason2.attributes.map(x => x.key), ['photos', 'availability']); assert.equal(reason2.usage_21d, null); ok('motivo: disponibilidade conferida entra com o caminho')
assert.equal(cleanItemPick({ rule: 'x' }), null); assert.equal(cleanItemPick(null), null)
const cp = cleanItemPick({ ...reason, evil: 'x', attributes: [{ key: 'k', value: 'v', path: 'p' }, { key: '', value: 1, path: 'p' }] }); assert.equal(cp.attributes.length, 1); assert.ok(!('evil' in cp)); ok('cleanItemPick só deixa passar campos conhecidos')

// ── conferência no portal ──
const feed = (ids) => async () => ({ ok: true, ids: new Set(ids) })
const feedFail = (error) => async () => ({ ok: false, error })
const saves = []
const deps = (it, over = {}) => ({ item: it, cfg, feedUrl: 'https://crm.example.com/feed.xml', fetchFeed: feed(['L1']), save: async (x) => { saves.push(x) }, now: NOW, ...over })
const withListing = (meta = {}) => item('i', { source: { listing_id: 'L1' }, ...meta })

assert.deepEqual(await revalidateWith(deps(withListing())), { state: 'ok' }); assert.equal(saves.at(-1).source, 'portal_feed'); ok('no portal e disponível = ok (grava conferência)')
saves.length = 0
let v = await revalidateWith(deps(withListing(), { fetchFeed: feed(['OUTRO']) }))
assert.equal(v.state, 'blocked'); assert.equal(saves.at(-1).status, 'removido'); assert.match(v.reason, /removido/i); ok('some do portal = removido (bloqueia e grava)')
v = await revalidateWith(deps(withListing(av('vendido')), { fetchFeed: async () => { throw new Error('não podia nem consultar') } }))
assert.equal(v.state, 'blocked'); ok('status manual vendido bloqueia sem consultar o portal')
v = await revalidateWith(deps(withListing(), { fetchFeed: feedFail('o link do portal demorou demais') })); assert.equal(v.state, 'unverifiable'); ok('portal fora do ar = não verificável (nunca "disponível")')
saves.length = 0
v = await revalidateWith(deps(item('m'), { fetchFeed: feedFail('x') })); assert.equal(v.state, 'ok'); ok('item só manual (sem listing_id) nunca fica não verificável')
v = await revalidateWith(deps(withListing(), { feedUrl: null, fetchFeed: feedFail('x') })); assert.equal(v.state, 'ok'); ok('portal não configurado = só manual')
v = await revalidateWith(deps(null)); assert.equal(v.state, 'blocked'); ok('item apagado do catálogo = bloqueia')
v = await revalidateWith({ ...deps(withListing(av('vendido'))), cfg: itemCfgFrom({}) }); assert.equal(v.state, 'ok'); ok('ficha sem availability = nada bloqueado')
// cache de 1 h
let calls = 0
const counting = async () => { calls++; return { ok: true, ids: new Set(['L1']) } }
v = await revalidateWith(deps(withListing(av('disponivel', 'portal_feed', new Date(NOW - 30 * 60_000).toISOString())), { fetchFeed: counting })); assert.equal(v.state, 'ok'); assert.equal(calls, 0); ok('conferido há 30 min = usa o cache (não consulta o portal)')
v = await revalidateWith(deps(withListing(av('disponivel', 'portal_feed', new Date(NOW - FEED_CACHE_MS - 1000).toISOString())), { fetchFeed: counting })); assert.equal(calls, 1); ok('conferido há mais de 1 h = consulta de novo')
v = await revalidateWith(deps(withListing(av('removido', 'portal_feed', new Date(NOW - 10 * 60_000).toISOString())), { fetchFeed: counting })); assert.equal(v.state, 'blocked'); assert.equal(calls, 1); ok('removido conferido há 10 min = bloqueia pelo cache')
saves.length = 0
v = await revalidateWith(deps(withListing(av('removido', 'portal_feed', new Date(NOW - 2 * 3600_000).toISOString())), { fetchFeed: counting })); assert.equal(v.state, 'ok'); assert.equal(saves.at(-1).status, 'disponivel'); ok('voltou ao portal = volta a disponível')
saves.length = 0
v = await revalidateWith(deps(withListing(av('disponivel', 'manual', new Date(NOW - 5 * 3600_000).toISOString())), { fetchFeed: feed(['L1']) })); assert.equal(v.state, 'ok'); assert.equal(saves.length, 1); ok('manual "disponível" antigo também é conferido')

// ── feed: parsing e prazo de 8 s ──
assert.deepEqual([...extractListingIds('<Listing><ListingID>A1</ListingID></Listing><listing><ListingID> <![CDATA[B2]]> </ListingID></listing>')].sort(), ['A1', 'B2']); ok('extrai os ListingID do XML (inclui CDATA)')
const mkRes = (body, status = 200, headers = {}) => new Response(body, { status, headers })
let f = await fetchFeedIds('https://crm.example.com/f.xml', 8000, async () => mkRes('<ListingID>X</ListingID>')); assert.equal(f.ok, true); assert.ok(f.ids.has('X')); ok('feed ok')
f = await fetchFeedIds('https://crm.example.com/f.xml', 8000, async () => mkRes('', 500)); assert.equal(f.ok, false); ok('feed 500 = falha')
f = await fetchFeedIds('https://crm.example.com/f.xml', 8000, async () => mkRes('<html>erro</html>')); assert.equal(f.ok, false); assert.match(f.error, /anúncios/); ok('XML sem anúncios = falha (nunca "todos removidos")')
f = await fetchFeedIds('http://crm.example.com/f.xml'); assert.equal(f.ok, false); f = await fetchFeedIds('https://localhost/f.xml'); assert.equal(f.ok, false); ok('link http/localhost recusado')
const keep = setInterval(() => {}, 50) // AbortSignal.timeout não segura o processo vivo
const t0 = Date.now()
f = await fetchFeedIds('https://crm.example.com/f.xml', 80, (_u, init) => new Promise((_, rej) => init.signal.addEventListener('abort', () => rej(new DOMException('timed out', 'TimeoutError')))))
assert.equal(f.ok, false); assert.match(f.error, /demorou/); assert.ok(Date.now() - t0 < 2000); ok('feed que não responde estoura o prazo (8 s em produção) e vira falha')
f = await fetchFeedIds('https://crm.example.com/f.xml', 8000, async () => mkRes('', 302, { location: 'http://127.0.0.1/x' })); assert.equal(f.ok, false); ok('redirecionamento para endereço interno recusado')
clearInterval(keep)
assert.equal(FEED_CACHE_MS, 3600_000)

// ── regra das 2 h ──
const since = new Date(NOW).toISOString()
assert.equal(unverifiableOutcome(since, NOW + 5 * 60_000), 'retry'); assert.equal(unverifiableOutcome(since, NOW + UNVERIFIABLE_MAX_MS - 1), 'retry')
assert.equal(unverifiableOutcome(since, NOW + UNVERIFIABLE_MAX_MS), 'fail'); assert.equal(unverifiableOutcome(since, NOW + 3 * 3600_000), 'fail'); assert.equal(unverifiableOutcome(null, NOW), 'retry'); ok('não verificável: tenta de novo por 2 h, depois falha')

// ── F1: SSRF (IP literal, cada redirecionamento) ──
for (const u of ['https://169.254.169.254/latest', 'https://10.0.0.5/f.xml', 'https://127.0.0.1/f.xml', 'https://192.168.1.1/f.xml', 'https://172.16.0.1/f.xml', 'https://100.64.0.1/f.xml', 'https://0.0.0.0/f.xml', 'https://[::1]/f.xml', 'https://[fc00::1]/f.xml', 'https://[fe80::1]/f.xml', 'https://[::ffff:10.0.0.1]/f.xml']) {
  const r = await fetchFeedIds(u, 8000, async () => { throw new Error('não podia nem chamar') }); assert.equal(r.ok, false, u)
}
for (const loc of ['https://169.254.169.254/x', 'https://10.0.0.5/f.xml', 'https://[::1]/x']) {
  let calls = 0
  const r = await fetchFeedIds('https://crm.example.com/f.xml', 8000, async () => { calls++; return mkRes('', 302, { location: loc }) })
  assert.equal(r.ok, false); assert.equal(calls, 1, 'não seguiu o redirecionamento')
}
let rv = await revalidateWith(deps(withListing(), { fetchFeed: (u) => fetchFeedIds(u, 8000, async () => mkRes('', 302, { location: 'https://169.254.169.254/x' })) })); assert.notEqual(rv.state, 'ok'); assert.equal(rv.state, 'unverifiable')
assert.ok(/isSafeUrl/.test(readFileSync(new URL('../supabase/functions/portal-import/index.ts', import.meta.url), 'utf8')) && !/function isSafeUrl/.test(readFileSync(new URL('../supabase/functions/portal-import/index.ts', import.meta.url), 'utf8'))); ok('F1: IP interno/IPv6 e redirecionamento para eles = recusado (não verificável); portal-import usa o mesmo _shared/safeUrl')

// ── F2/F4: erro de leitura NUNCA vira ok nem "sumiu" ──
const mkAdmin = (tables) => ({ from: (t) => { const q = { select: () => q, eq: () => q, maybeSingle: async () => tables[t] ?? { data: null, error: null } }; return q } })
const okFicha = { data: { config: FICHA }, error: null }
const itemRow = { data: { id: 'i', title: 'x', meta: { photos: ph(5) } }, error: null }
let r2 = await revalidate(mkAdmin({ vertical_playbooks: { data: null, error: { message: 'boom' } }, marketing_ai_knowledge: itemRow }), 'c', 'i', { verticalKey: 'imoveis_rio' }); assert.equal(r2.state, 'unverifiable')
r2 = await revalidate(mkAdmin({ vertical_playbooks: okFicha, marketing_ai_knowledge: { data: null, error: { message: 'boom' } } }), 'c', 'i', { verticalKey: 'imoveis_rio' }); assert.equal(r2.state, 'unverifiable')
r2 = await revalidate(mkAdmin({ companies: { data: null, error: { message: 'boom' } } }), 'c', 'i'); assert.equal(r2.state, 'unverifiable')
r2 = await revalidate(mkAdmin({ vertical_playbooks: okFicha, marketing_ai_knowledge: { data: null, error: null } }), 'c', 'i', { verticalKey: 'imoveis_rio' }); assert.equal(r2.state, 'blocked')
r2 = await revalidate(mkAdmin({ vertical_playbooks: { data: { config: {} }, error: null }, marketing_ai_knowledge: itemRow }), 'c', 'i', { verticalKey: 'x' }); assert.equal(r2.state, 'ok')
r2 = await revalidate(mkAdmin({ vertical_playbooks: okFicha, marketing_ai_knowledge: { data: { id: 'i', meta: { photos: ph(5), source: { listing_id: 'L1' } } }, error: null }, company_integrations: { data: null, error: { message: 'boom' } } }), 'c', 'i', { verticalKey: 'imoveis_rio' }); assert.equal(r2.state, 'unverifiable')
assert.equal(await fetchItemCfgStrict(mkAdmin({ vertical_playbooks: { data: null, error: { message: 'x' } } }), 'k'), null)
assert.equal((await getItemChecked(mkAdmin({ marketing_ai_knowledge: { data: null, error: { message: 'x' } } }), 'c', 'i')).failed, true); ok('F2/F4: erro ao ler ficha/empresa/imóvel/integração = não verificável; ficha sem a chave = ok; imóvel realmente ausente = bloqueado')

// ── F3: executor — erro de leitura segura, item_id vai no payload ──
const aa = readFileSync(new URL('../supabase/functions/agent-actions/index.ts', import.meta.url), 'utf8')
const gate = aa.slice(aa.indexOf('async function availabilityGate('), aa.indexOf('async function earlyBlock('))
assert.ok(/readFailed/.test(gate) && /if \(!itemId && !readFailed\) return null/.test(gate) && /unverifiable/.test(gate)); assert.ok(/copiar item_id pro payload/.test(aa) && /payload,\n/.test(aa)); ok('F3: leitura do item_id que falha segura a ação; proposta copia item_id pro payload')

// ── F6: o mesmo link é baixado uma vez por rodada ──
clearFeedMemo(); let dl = 0
const slow = async () => { dl++; return { ok: true, ids: new Set(['L1']) } }
await Promise.all([1, 2, 3, 4, 5].map(() => memoFeed('https://crm.example.com/f.xml', slow))); assert.equal(dl, 1)
await memoFeed('https://outro.example.com/f.xml', slow); assert.equal(dl, 2); ok('F6: N ações do mesmo link = 1 download')

// ── cópia da tela bate com o servidor ──
assert.deepEqual(front.parseAvailabilityCfg(FICHA.availability), cfg.availability)
for (const m of [av('vendido'), av('disponivel'), {}, av('xx')]) assert.deepEqual(front.availabilityOf(item('x', m), cfg.availability), availabilityOf(item('x', m), cfg.availability))
assert.equal(front.statusLabel(cfg.availability, 'vendido', 'en'), 'Sold'); assert.equal(front.statusLabel(cfg.availability, 'alugado', 'en'), 'Alugado'); ok('cópia da tela = servidor (config, status, rótulos)')
const txt = front.pickReasonText(reason, 'pt'); assert.match(txt, /menos usado/i); assert.ok(!/undefined|null/.test(txt)); assert.match(front.pickReasonText(reason2, 'pt'), /você escolheu/i); ok('texto do motivo na tela')

// ── publicar: o executor confere ANTES de qualquer publicação (verificação por estrutura) ──
const src = readFileSync(new URL('../supabase/functions/agent-actions/index.ts', import.meta.url), 'utf8')
const body = src.slice(src.indexOf('async function execute('))
const iGate = body.indexOf('availabilityGate('), iExec = body.indexOf("execution_status: 'EXECUTING'"), iPub = body.indexOf('await publishCarouselToInstagram(')
assert.ok(iGate > 0 && iExec > 0 && iPub > 0, 'marcadores presentes')
assert.ok(iGate < iExec, 'a conferência vem antes de marcar EXECUTING')
assert.ok(iExec < iPub, 'e antes de publicar')
const gateFn = src.slice(src.indexOf('async function availabilityGate('))
assert.ok(/state === 'blocked'/.test(gateFn) && /Não publiquei\./.test(src) && /unverifiableOutcome\(/.test(gateFn) && !/publishTo/.test(gateFn.slice(0, gateFn.indexOf('\n}\n'))), 'bloqueado nunca chama publishTo*')
assert.ok(/status: 'vault'/.test(gateFn), 'peça volta para o Vault quando bloqueada')
assert.ok(!/delete\(\)/.test(gateFn.slice(0, gateFn.indexOf('\n}\n'))), 'bloqueado não apaga a linha de teste')
ok('executor: conferência antes de EXECUTING e de publishTo*; bloqueado não apaga a peça')

console.log(`\n${n} grupos de teste OK`)
