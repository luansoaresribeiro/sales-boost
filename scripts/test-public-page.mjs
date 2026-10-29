import assert from 'node:assert/strict'
// Roda: node --experimental-strip-types scripts/test-public-page.mjs
// Página pública do imóvel (Etapa 5): validação do lead, honeypot, limites, campos públicos (sem private, sem staged),
// código sem ambíguos, 404 uniforme, wa.me/ig.me, frase com link uma vez só, e o fluxo de banco com um banco em memória.
import {
  CODE_ALPHABET, CODE_LENGTH, NOT_FOUND_BODY, appendLinkOnce, consentText, generateCode, instagramHandle, instagramUrl, isBot, isValidCode,
  leadLimit, linkLine, parsePublicPageConfig, publicFields, publicLink, publicPhotos, validateLead, visitorHash, whatsappNumber, whatsappUrl,
} from '../supabase/functions/_shared/publicPage.ts'
import { attachTrackedLinks, ensureTrackedLink, getPublicPageState, handlePublicPage, setPublicPage, withDmLink } from '../supabase/functions/_shared/publicPageRun.ts'
let n = 0; const ok = (m) => { n++; console.log('ok -', m) }

const RAW = { fields: ['tipo', 'bairro', 'quartos', 'preco', 'venda_ou_aluguel', 'm2', 'segredo', 'fotos_min_5'], min_photos: 3, country_code: '55', caption_line: { pt: 'Mais fotos e detalhes: {link}', en: 'More photos and details: {link}' } }
const CATALOG = {
  required: [
    { key: 'fotos_min_5', type: 'photos', label: { pt: 'Fotos', en: 'Photos' } },
    { key: 'tipo', type: 'select', label: { pt: 'Tipo', en: 'Type' }, options: [{ pt: 'Apartamento', en: 'Apartment' }, { pt: 'Casa', en: 'House' }] },
    { key: 'bairro', type: 'text', label: { pt: 'Bairro', en: 'Neighborhood' } },
    { key: 'venda_ou_aluguel', type: 'select', label: { pt: 'Venda ou aluguel', en: 'Sale or rental' }, options: [{ pt: 'Venda', en: 'Sale' }, { pt: 'Aluguel', en: 'Rental' }] },
    { key: 'preco', type: 'number', label: { pt: 'Preço (R$)', en: 'Price (R$)' } },
    { key: 'quartos', type: 'number', label: { pt: 'Quartos', en: 'Bedrooms' } },
    { key: 'm2', type: 'number', label: { pt: 'Metragem (m²)', en: 'Size (m²)' } },
  ],
  optional: [
    { key: 'segredo', type: 'text', private: true, label: { pt: 'Segredo', en: 'Secret' } },
    { key: 'dono_telefone', type: 'text', label: { pt: 'Telefone do dono', en: 'Owner phone' } }, // existe na ficha mas NÃO está na lista branca da página
  ],
}
const cfg = parsePublicPageConfig(RAW)

// --- configuração
assert.deepEqual(parsePublicPageConfig(null), null); assert.deepEqual(parsePublicPageConfig('x'), null); ok('setor sem public_page: null')
assert.equal(parsePublicPageConfig({}).min_photos, 3); assert.equal(parsePublicPageConfig({ min_photos: 99 }).min_photos, 3); assert.equal(parsePublicPageConfig({ min_photos: 4 }).min_photos, 4); ok('min_photos com padrão e teto')
assert.equal(parsePublicPageConfig({ caption_line: { pt: 'sem marcador' } }).caption_line.pt, 'Mais fotos e detalhes: {link}'); ok('caption_line sem {link} cai no padrão')
assert.deepEqual(parsePublicPageConfig({ fields: ['a', 'a', 'B!', 5, 'c_1'] }).fields, ['a', 'c_1']); ok('fields: só chaves válidas, sem repetir')

// --- código sem ambíguos
{
  const seen = new Set()
  for (let i = 0; i < 2000; i++) { const c = generateCode(); assert.equal(c.length, CODE_LENGTH); assert.ok(isValidCode(c)); for (const ch of c) seen.add(ch) }
  for (const bad of ['0', '1', 'o', 'l', 'i', 'O', 'I', 'L']) assert.ok(!CODE_ALPHABET.includes(bad) && !seen.has(bad), bad)
  assert.equal(CODE_ALPHABET.length, 31); ok('2000 códigos: 8 caracteres, nenhum 0/o/1/l/i')
  assert.ok(seen.size >= 28); ok('sorteio usa quase todo o alfabeto')
  assert.equal(generateCode(() => new Uint8Array(16).fill(255).map((_, i) => (i < 15 ? 255 : 0))), 'aaaaaaaa'); ok('bytes >= 248 são descartados (sem viés)')
  for (const bad of ['', 'abcdefg', 'abcdefghi', 'ABCDEFGH', 'abcdefg0', 'abcdefgl', "abcdefg'", undefined, 12345678]) assert.ok(!isValidCode(bad), String(bad))
  ok('código inválido rejeitado (tamanho, maiúscula, ambíguo, aspas, tipo)')
  assert.equal(publicLink('abcd2345'), 'https://getsaleboost.com/p/abcd2345'); ok('link público')
}

// --- campos públicos
{
  const f = publicFields(CATALOG, cfg, { tipo: 'Apartamento', bairro: 'Ipanema', quartos: 3, preco: 1200000, venda_ou_aluguel: 'Venda', m2: 85, segredo: 'x', dono_telefone: '21999', extra: 'y' }, 'pt')
  assert.deepEqual(f.map(x => x.key), ['tipo', 'bairro', 'quartos', 'preco', 'venda_ou_aluguel', 'm2']); ok('só a lista branca, na ordem da ficha')
  assert.ok(!f.some(x => ['segredo', 'dono_telefone', 'fotos_min_5', 'extra'].includes(x.key))); ok('private, fora da lista e foto nunca saem')
  assert.equal(f.find(x => x.key === 'preco').value, 'R$ 1.200.000'); assert.equal(f.find(x => x.key === 'preco').label, 'Preço'); ok('preço com R$ e rótulo sem a unidade')
  assert.equal(f.find(x => x.key === 'm2').value, '85 m²'); assert.equal(f.find(x => x.key === 'm2').label, 'Metragem'); ok('unidade m² no valor')
  const en = publicFields(CATALOG, cfg, { tipo: 'Apartamento', venda_ou_aluguel: 'Aluguel', preco: 5000 }, 'en')
  assert.deepEqual(en.map(x => x.value), ['Apartment', 'R$ 5,000', 'Rental']); ok('inglês: opções traduzidas e número em en-US')
  assert.deepEqual(publicFields(CATALOG, cfg, { bairro: '', quartos: null, preco: 'abc' }, 'pt'), []); ok('campo vazio ou número inválido some (nada de número inventado)')
  assert.deepEqual(publicFields(CATALOG, cfg, { tipo: 'Navio' }, 'pt'), []); ok('select com valor fora das opções não aparece')
  assert.deepEqual(publicFields(null, cfg, { tipo: 'Casa' }, 'pt'), []); ok('sem catálogo: nada')
  const priv = publicFields({ required: [{ key: 'tipo', type: 'text', private: true, label: { pt: 'Tipo' } }] }, cfg, { tipo: 'x' }, 'pt'); assert.deepEqual(priv, []); ok('campo private na lista branca continua barrado')
}

// --- fotos
{
  const meta = { photos: [{ url: 'https://x/a.jpg' }, { url: 'http://x/b.jpg' }, { url: 'https://x/a.jpg' }, { url: 'javascript:alert(1)' }, {}], staged_photos: [{ url: 'https://x/staged.jpg' }] }
  assert.deepEqual(publicPhotos(meta), ['https://x/a.jpg']); ok('só https, sem repetir; staged_photos nunca entra')
  assert.equal(publicPhotos({ photos: Array.from({ length: 30 }, (_, i) => ({ url: `https://x/${i}.jpg` })) }).length, 10); ok('até 10 fotos')
  assert.deepEqual(publicPhotos(null), []); ok('sem meta: sem fotos')
}

// --- contatos e URLs
{
  assert.equal(whatsappNumber('(21) 99999-9999', '55'), '5521999999999'); assert.equal(whatsappNumber('+55 21 99999-9999', '55'), '5521999999999'); assert.equal(whatsappNumber('123', '55'), null); assert.equal(whatsappNumber(null, '55'), null); ok('número do WhatsApp com DDI')
  const u = whatsappUrl('(21) 99999-9999', 'Apto "Vista" & mar', 'pt', '55'); assert.ok(u.startsWith('https://wa.me/5521999999999?text=')); assert.ok(u.includes(encodeURIComponent('Apto "Vista" & mar'))); assert.ok(!u.includes('&mar')); ok('wa.me com título codificado')
  assert.match(decodeURIComponent(whatsappUrl('21999999999', 'Casa', 'en', '55').split('text=')[1]), /Hi!.*Casa/); ok('wa.me em inglês')
  assert.equal(whatsappUrl('abc', 'x', 'pt', '55'), null); ok('sem telefone válido: sem URL')
  assert.equal(instagramUrl('minha.imob'), 'https://ig.me/m/minha.imob'); assert.equal(instagramUrl('@minha.imob'), 'https://ig.me/m/minha.imob'); assert.equal(instagramUrl('a b'), null); assert.equal(instagramUrl('../x'), null); assert.equal(instagramUrl(null), null); ok('ig.me só com usuário válido')
  assert.equal(instagramHandle('@imob'), 'imob'); assert.equal(instagramHandle(null, 'https://www.instagram.com/imob.rio/?hl=pt'), 'imob.rio'); assert.equal(instagramHandle(null, 'https://instagram.com/p/ABC'), null); assert.equal(instagramHandle(null, 'x'), null); ok('usuário do Instagram a partir do @ ou da URL')
}

// --- lead
{
  const base = { name: 'Maria Silva', contact: '(21) 99999-9999', message: 'Tenho interesse', consent: true, website: '' }
  const v = validateLead(base); assert.ok(v.ok); assert.deepEqual([v.value.name, v.value.contact, v.value.contactKind, v.value.message], ['Maria Silva', '21999999999', 'phone', 'Tenho interesse']); ok('lead válido (telefone vira dígitos)')
  assert.deepEqual(validateLead({ ...base, contact: 'Maria@Mail.COM ' }).value.contact, 'maria@mail.com'); ok('e-mail em minúsculas')
  assert.equal(validateLead({ ...base, message: undefined }).ok, true); ok('mensagem é opcional')
  assert.equal(validateLead({ ...base, name: 'A' }).error, 'name'); assert.equal(validateLead({ ...base, name: ' ' }).error, 'name'); assert.equal(validateLead({ ...base, name: 'x'.repeat(81) }).error, 'name'); assert.equal(validateLead({ ...base, name: 'x'.repeat(80) }).ok, true); ok('nome: 2 a 80')
  for (const c of ['', '12345', '1234567890123456', 'abc', 'a@b', 'a@@b.com', 'a b@c.com', '<x>@c.com', '(21) 9999-99', '21 99999-9999 ramal 5']) assert.equal(validateLead({ ...base, contact: c }).error, 'contact', c)
  ok('contato inválido barrado (curto, longo, texto, e-mail torto)')
  assert.equal(validateLead({ ...base, contact: '1199998888' }).ok, true); ok('telefone com 10 dígitos passa')
  assert.equal(validateLead({ ...base, message: 'x'.repeat(501) }).error, 'message'); assert.equal(validateLead({ ...base, message: 'x'.repeat(500) }).ok, true); ok('mensagem até 500')
  for (const c of [false, undefined, 'true', 1, null]) assert.equal(validateLead({ ...base, consent: c }).error, 'consent', String(c))
  ok('consentimento só com true literal')
  assert.equal(validateLead({ ...base, website: 'http://spam' }).error, 'honeypot'); assert.equal(validateLead({ ...base, website: '  ' }).ok, true); ok('honeypot preenchido = robô')
  assert.equal(validateLead(null).ok, false); assert.equal(validateLead('x').ok, false); ok('corpo inválido')
  assert.equal(validateLead({ ...base, name: 'Ana\u0000 \u0007Lima' }).value.name, 'Ana Lima'); ok('caracteres de controle saem')
  assert.deepEqual([leadLimit({ visitorLastHour: 2, linkLast24h: 19, duplicate24h: false }), leadLimit({ visitorLastHour: 3, linkLast24h: 0, duplicate24h: false }), leadLimit({ visitorLastHour: 0, linkLast24h: 20, duplicate24h: false }), leadLimit({ visitorLastHour: 9, linkLast24h: 99, duplicate24h: true })], [null, 'visitor_hour', 'link_day', 'duplicate']); ok('limites: 3/visitante/hora, 20/link/dia, duplicata 24h')
  assert.match(consentText('pt', 'Imob X'), /Imob X/); assert.match(consentText('en', 'Imob X'), /agree/); ok('texto de consentimento por idioma')
}

// --- visitante / bots
{
  const a = await visitorHash('1.2.3.4', 'UA', '2026-10-30', 's'); const b = await visitorHash('1.2.3.4', 'UA', '2026-10-30', 's')
  assert.equal(a, b); assert.match(a, /^[0-9a-f]{64}$/); assert.ok(!a.includes('1.2.3.4'))
  assert.notEqual(a, await visitorHash('1.2.3.4', 'UA', '2026-10-31', 's')); assert.notEqual(a, await visitorHash('1.2.3.5', 'UA', '2026-10-30', 's')); assert.notEqual(a, await visitorHash('1.2.3.4', 'UA', '2026-10-30', 'outro')); ok('hash estável no dia, muda com dia/IP/sal e não contém o IP')
  assert.ok(isBot('Googlebot/2.1')); assert.ok(isBot('facebookexternalhit/1.1')); assert.ok(isBot('')); assert.ok(isBot('curl/8.0')); assert.ok(!isBot('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1')); ok('bots por user-agent')
}

// --- frase com link, uma vez só
{
  const line = linkLine(cfg, 'pt', 'https://getsaleboost.com/p/abcd2345'); assert.equal(line, 'Mais fotos e detalhes: https://getsaleboost.com/p/abcd2345')
  assert.equal(linkLine(cfg, 'en', 'L'), 'More photos and details: L'); ok('caption_line por idioma')
  const a = appendLinkOnce('Legenda linda.', line, 'https://getsaleboost.com/p/abcd2345'); assert.equal(a.changed, true); assert.equal(a.text, `Legenda linda.\n\n${line}`)
  const b = appendLinkOnce(a.text, line, 'https://getsaleboost.com/p/abcd2345'); assert.equal(b.changed, false); assert.equal(b.text, a.text); ok('frase entra uma vez e não repete')
  assert.equal(appendLinkOnce('Veja getsaleboost.com/p/abcd2345 agora', line, 'https://getsaleboost.com/p/abcd2345').changed, false); ok('link já na legenda (sem https): não repete')
  assert.equal(appendLinkOnce('', line, 'L').text, line); ok('legenda vazia vira só a frase')
}

// ───────── banco em memória ─────────
function memDb(seed = {}, opts = {}) {
  const t = {}; for (const [k, v] of Object.entries(seed)) t[k] = v.map(r => ({ ...r }))
  let seq = 0; const fail = opts.fail ?? {}
  const rows = name => (t[name] ??= [])
  function from(name) {
    const st = { op: 'select', filters: [], payload: null, head: false, count: false, ret: false, single: false, maybe: false, limit: null, onConflict: null }
    const q = {
      select(_c, o) { if (st.op === 'select') { st.head = !!o?.head; st.count = o?.count === 'exact' } else st.ret = true; return q },
      insert(p) { st.op = 'insert'; st.payload = p; return q }, update(p) { st.op = 'update'; st.payload = p; return q },
      upsert(p, o) { st.op = 'upsert'; st.payload = p; st.onConflict = o?.onConflict; return q },
      eq(c, v) { st.filters.push(r => r[c] === v); return q }, is(c, v) { st.filters.push(r => (r[c] ?? null) === v); return q },
      not(c, _o, v) { st.filters.push(r => (r[c] ?? null) !== v); return q }, in(c, arr) { st.filters.push(r => arr.includes(r[c])); return q },
      gte(c, v) { st.filters.push(r => String(r[c]) >= String(v)); return q }, order() { return q }, limit(x) { st.limit = x; return q },
      single() { st.single = true; return q }, maybeSingle() { st.maybe = true; return q },
      then(res, rej) { return Promise.resolve(run()).then(res, rej) },
    }
    function run() {
      const key = `${name}.${st.op}`
      if (fail[key]) return { data: null, error: { message: fail[key], code: 'XX' }, count: null }
      const match = () => rows(name).filter(r => st.filters.every(f => f(r)))
      if (st.op === 'insert' || st.op === 'upsert') {
        const p = { ...st.payload }
        if (st.op === 'upsert') { const ex = rows(name).find(r => r[st.onConflict] === p[st.onConflict]); if (ex) { Object.assign(ex, p); return { data: null, error: null } } }
        if (name === 'tracked_links') {
          const dup = rows(name).find(r => r.code === p.code || (r.item_id === p.item_id && (r.opportunity_id ?? null) === (p.opportunity_id ?? null) && r.channel === p.channel))
          if (dup) return { data: null, error: { message: 'duplicate key', code: '23505' } }
        }
        const row = { id: p.id ?? `id-${++seq}`, created_at: new Date().toISOString(), ...p }; rows(name).push(row)
        return { data: st.single ? row : st.ret ? [row] : null, error: null }
      }
      if (st.op === 'update') {
        const m = match(); for (const r of m) Object.assign(r, st.payload)
        return { data: st.ret ? m : null, error: null }
      }
      let m = match(); if (st.limit != null) m = m.slice(0, st.limit)
      if (st.count && st.head) return { data: null, count: m.length, error: null }
      if (st.single || st.maybe) return { data: m[0] ?? null, error: null }
      return { data: m, error: null }
    }
    return q
  }
  const db = { from, tables: t, rpc: () => ({ maybeSingle: async () => ({ data: opts.access ?? { source: 'paid' }, error: null }) }) }
  return db
}

const CODE = 'abcd2345'
const baseSeed = () => ({
  tracked_links: [{ id: 'L1', code: CODE, company_id: 'C1', item_id: 'I1', opportunity_id: 'O1', channel: 'caption' }],
  public_pages: [{ item_id: 'I1', company_id: 'C1', enabled: true, contact_phone: '(21) 99999-9999', contact_ig: 'imob.rio' }],
  marketing_ai_knowledge: [{ id: 'I1', company_id: 'C1', kind: 'product', title: 'Apartamento em Ipanema', meta: { photos: [{ url: 'https://x/1.jpg' }, { url: 'https://x/2.jpg' }, { url: 'https://x/3.jpg' }], staged_photos: [{ url: 'https://x/staged.jpg' }], fields: { tipo: 'Apartamento', bairro: 'Ipanema', preco: 1200000, segredo: 'nunca', detalhe_que_ninguem_percebe: 'privado' } } }],
  companies: [{ id: 'C1', business_name: 'Imob Rio', language: 'pt', vertical_key: 'imoveis_rio', created_at: '2026-01-01T00:00:00Z', phone: '(21) 98888-7777', instagram_username: 'imob.rio', instagram_url: null }],
  vertical_playbooks: [{ key: 'imoveis_rio', enabled: true, config: { public_page: RAW, catalog_fields: CATALOG } }],
  brand_dna: [{ company_id: 'C1', logo_url: 'https://x/logo.png' }],
  link_events: [], leads: [], marketing_ai_test_content: [], agent_actions: [],
})
const ctx = { salt: 's', ip: '9.9.9.9', ua: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Safari/604.1' }
const handle = (db, action, body, c = ctx) => handlePublicPage(db, action, body, c)

// --- 404 uniforme
{
  const variants = {
    'código inválido': [baseSeed(), { code: 'lixo' }],
    'código inexistente': [baseSeed(), { code: 'zzzzzzzz' }],
    'sem código': [baseSeed(), {}],
    'página desligada': [{ ...baseSeed(), public_pages: [{ item_id: 'I1', company_id: 'C1', enabled: false }] }, { code: CODE }],
    'sem linha de página': [{ ...baseSeed(), public_pages: [] }, { code: CODE }],
    'imóvel apagado': [{ ...baseSeed(), marketing_ai_knowledge: [] }, { code: CODE }],
    'imóvel de outra empresa': [{ ...baseSeed(), marketing_ai_knowledge: [{ ...baseSeed().marketing_ai_knowledge[0], company_id: 'C2' }] }, { code: CODE }],
    'empresa sem plano pago': [{ ...baseSeed(), companies: [{ ...baseSeed().companies[0], created_at: '2026-10-20T00:00:00Z' }] }, { code: CODE }, { access: { source: 'trial' } }],
    'fotos abaixo do mínimo': [{ ...baseSeed(), marketing_ai_knowledge: [{ ...baseSeed().marketing_ai_knowledge[0], meta: { photos: [{ url: 'https://x/1.jpg' }] } }] }, { code: CODE }],
    'ficha sem public_page': [{ ...baseSeed(), vertical_playbooks: [{ key: 'imoveis_rio', enabled: true, config: {} }] }, { code: CODE }],
  }
  for (const action of ['public_page_get', 'public_page_event', 'public_page_lead']) {
    for (const [name, [seed, body, o]] of Object.entries(variants)) {
      const r = await handle(memDb(seed, o), action, { ...body, event: 'click_whatsapp', name: 'Maria', contact: '21999999999', consent: true, website: '' })
      assert.equal(r.status, 404, `${action}/${name}`); assert.deepEqual(r.body, NOT_FOUND_BODY, `${action}/${name}`)
    }
  }
  ok('404 idêntico (status e corpo) para 10 motivos x 3 ações públicas')
  const dbErr = memDb(baseSeed(), { fail: { 'tracked_links.select': 'boom' } }); assert.deepEqual((await handle(dbErr, 'public_page_get', { code: CODE })).body, NOT_FOUND_BODY); ok('erro de banco na leitura também vira o mesmo 404')
}

// --- public_page_get
{
  const db = memDb(baseSeed()); const r = await handle(db, 'public_page_get', { code: CODE })
  assert.equal(r.status, 200); const b = r.body
  assert.deepEqual(b.photos, ['https://x/1.jpg', 'https://x/2.jpg', 'https://x/3.jpg']); ok('get: só fotos reais (sem staged)')
  assert.deepEqual(b.fields.map(f => f.key), ['tipo', 'bairro', 'preco']); assert.ok(!JSON.stringify(b).includes('nunca') && !JSON.stringify(b).includes('privado') && !JSON.stringify(b).includes('99999') && !JSON.stringify(b).includes('imob.rio')); ok('get: sem campo private, sem telefone/Instagram cru na resposta')
  assert.deepEqual(b.buttons, { whatsapp: true, dm: true }); assert.equal(b.lang, 'pt'); assert.equal(b.company.name, 'Imob Rio'); assert.equal(b.company.logo_url, 'https://x/logo.png'); assert.match(b.consent_text, /Imob Rio/); ok('get: botões, idioma, empresa, consentimento')
  assert.equal(db.tables.link_events.length, 1); assert.equal(db.tables.link_events[0].event, 'view'); assert.match(db.tables.link_events[0].visitor_hash, /^[0-9a-f]{64}$/); assert.ok(!JSON.stringify(db.tables.link_events).includes('9.9.9.9')); ok('get: registra view com hash e sem IP')
  await handle(db, 'public_page_get', { code: CODE }); assert.equal(db.tables.link_events.length, 1); ok('get: 2ª visita do mesmo visitante no dia não conta')
  await handle(db, 'public_page_get', { code: CODE }, { ...ctx, ip: '8.8.8.8' }); assert.equal(db.tables.link_events.length, 2); ok('get: outro visitante conta')
  await handle(db, 'public_page_get', { code: CODE }, { ...ctx, ip: '7.7.7.7', ua: 'Googlebot/2.1' }); assert.equal(db.tables.link_events.length, 2); ok('get: bot não conta (mas vê a página)')
  const semDm = memDb({ ...baseSeed(), public_pages: [{ item_id: 'I1', company_id: 'C1', enabled: true, contact_phone: null, contact_ig: null }] }); assert.deepEqual((await handle(semDm, 'public_page_get', { code: CODE })).body.buttons, { whatsapp: false, dm: false }); ok('get: sem contato aprovado, sem botão')
  const en = memDb({ ...baseSeed(), companies: [{ ...baseSeed().companies[0], language: 'en' }] }); const re = (await handle(en, 'public_page_get', { code: CODE })).body; assert.equal(re.lang, 'en'); assert.equal(re.fields[0].value, 'Apartment'); ok('get: idioma da empresa')
  const falha = memDb(baseSeed(), { fail: { 'link_events.insert': 'x' } }); assert.equal((await handle(falha, 'public_page_get', { code: CODE })).status, 200); ok('get: falha ao gravar a visita não derruba a página')
}

// --- public_page_event
{
  const db = memDb(baseSeed())
  let r = await handle(db, 'public_page_event', { code: CODE, event: 'click_whatsapp' })
  assert.equal(r.status, 200); assert.ok(r.body.url.startsWith('https://wa.me/5521999999999?text=')); assert.ok(r.body.url.includes(encodeURIComponent('Apartamento em Ipanema'))); ok('event: wa.me montada no servidor com o título')
  r = await handle(db, 'public_page_event', { code: CODE, event: 'click_dm' }); assert.equal(r.body.url, 'https://ig.me/m/imob.rio'); ok('event: ig.me')
  assert.deepEqual(db.tables.link_events.map(e => e.event), ['click_whatsapp', 'click_dm']); ok('event: cliques registrados')
  assert.equal((await handle(db, 'public_page_event', { code: CODE, event: 'view' })).status, 400); assert.equal((await handle(db, 'public_page_event', { code: CODE, event: 'lead' })).status, 400); assert.equal((await handle(db, 'public_page_event', { code: CODE })).status, 400); ok('event: só click_whatsapp / click_dm')
  const semIg = memDb({ ...baseSeed(), public_pages: [{ item_id: 'I1', company_id: 'C1', enabled: true, contact_phone: '(21) 99999-9999', contact_ig: null }] }); assert.equal((await handle(semIg, 'public_page_event', { code: CODE, event: 'click_dm' })).status, 404); ok('event: botão que a página não oferece = 404')
  const mal = memDb({ ...baseSeed(), public_pages: [{ item_id: 'I1', company_id: 'C1', enabled: true, contact_phone: 'javascript:alert(1)', contact_ig: '../../x' }] }); assert.equal((await handle(mal, 'public_page_event', { code: CODE, event: 'click_whatsapp' })).status, 404); assert.equal((await handle(mal, 'public_page_event', { code: CODE, event: 'click_dm' })).status, 404); ok('event: contato malformado nunca vira URL')
}

// --- public_page_lead
{
  const body = { code: CODE, name: 'Maria Silva', contact: '(21) 97777-6666', message: 'Quero visitar', consent: true, website: '' }
  const db = memDb(baseSeed()); let r = await handle(db, 'public_page_lead', body)
  assert.deepEqual([r.status, r.body.ok], [200, true]); assert.equal(db.tables.leads.length, 1)
  const l = db.tables.leads[0]
  assert.deepEqual([l.company_id, l.name, l.contact, l.source, l.stage, l.channel, l.item_id, l.opportunity_id, l.link_id], ['C1', 'Maria Silva', '21977776666', 'link_page', 'new', 'manual', 'I1', 'O1', 'L1']); ok('lead: origem (item, oportunidade, link), source link_page, stage new')
  assert.match(l.notes, /Apartamento em Ipanema/); assert.match(l.notes, /Quero visitar/); assert.ok(l.consent_at); assert.match(l.consent_text, /Imob Rio/); ok('lead: notas com a mensagem, consent_at e consent_text')
  const ev = db.tables.link_events.find(e => e.event === 'lead'); assert.equal(ev.lead_id, l.id); assert.equal(ev.link_id, 'L1'); ok('lead: evento "lead" ligado ao lead')
  r = await handle(db, 'public_page_lead', body, { ...ctx, ip: '1.1.1.1' }); assert.deepEqual([r.status, r.body.ok], [200, true]); assert.equal(db.tables.leads.length, 1); ok('lead: mesmo contato + imóvel em 24 h não duplica')
  r = await handle(db, 'public_page_lead', { ...body, website: 'http://spam.com', contact: '21966665555' }); assert.deepEqual([r.status, r.body.ok], [200, true]); assert.equal(db.tables.leads.length, 1); ok('lead: honeypot responde sucesso e NÃO grava')
  r = await handle(db, 'public_page_lead', { ...body, consent: false, contact: '21966665555' }); assert.deepEqual([r.status, r.body.field], [400, 'consent']); assert.equal(db.tables.leads.length, 1); ok('lead: sem consentimento não grava')
  r = await handle(db, 'public_page_lead', { ...body, contact: 'xx' }); assert.deepEqual([r.status, r.body.field], [400, 'contact']); ok('lead: contato inválido = 400 com o campo')
  // 3 por visitante por hora
  const db2 = memDb(baseSeed())
  for (let i = 0; i < 3; i++) assert.equal((await handle(db2, 'public_page_lead', { ...body, contact: `2190000000${i}` })).status, 200)
  assert.equal(db2.tables.leads.length, 3)
  r = await handle(db2, 'public_page_lead', { ...body, contact: '21900000009' }); assert.equal(r.status, 429); assert.equal(db2.tables.leads.length, 3); ok('lead: 4º do mesmo visitante na hora = 429')
  r = await handle(db2, 'public_page_lead', { ...body, contact: '21900000009' }, { ...ctx, ip: '2.2.2.2' }); assert.equal(r.status, 200); ok('lead: outro visitante ainda passa')
  // 20 por link por dia
  const seed = baseSeed(); seed.link_events = Array.from({ length: 20 }, (_, i) => ({ id: `e${i}`, link_id: 'L1', event: 'lead', visitor_hash: `h${i}`, created_at: new Date().toISOString() }))
  const db3 = memDb(seed); r = await handle(db3, 'public_page_lead', body); assert.equal(r.status, 429); assert.equal(db3.tables.leads.length, 0); ok('lead: 21º do link no dia = 429')
  const seedOld = baseSeed(); seedOld.leads = [{ id: 'old', company_id: 'C1', item_id: 'I1', contact: '21977776666', created_at: new Date(Date.now() - 25 * 3600_000).toISOString() }]
  const db4 = memDb(seedOld); r = await handle(db4, 'public_page_lead', body); assert.equal(db4.tables.leads.length, 2); ok('lead: mesmo contato depois de 24 h entra de novo')
  // falhas de banco
  const dbF = memDb(baseSeed(), { fail: { 'leads.insert': 'column "link_id" does not exist' } }); r = await handle(dbF, 'public_page_lead', body)
  assert.equal(r.status, 503); assert.deepEqual(r.body, { error: 'unavailable' }); assert.equal(dbF.tables.link_events.filter(e => e.event === 'lead').length, 0); ok('lead: insert recusado = erro ao visitante (nunca "sucesso" falso) e sem evento')
  const dbL = memDb(baseSeed(), { fail: { 'leads.select': 'x' } }); assert.equal((await handle(dbL, 'public_page_lead', body)).status, 503); ok('lead: não consegue contar limites = não grava')
  const dbE = memDb(baseSeed(), { fail: { 'link_events.insert': 'x' } }); assert.equal((await handle(dbE, 'public_page_lead', body)).status, 200); assert.equal(dbE.tables.leads.length, 1); ok('lead: falha só do evento não perde o lead')
  assert.ok(!JSON.stringify(db.tables).includes('9.9.9.9')); ok('lead: IP nunca aparece no banco')
}

// --- link rastreável
{
  const db = memDb({ tracked_links: [] })
  const a = await ensureTrackedLink(db, { companyId: 'C1', itemId: 'I1', channel: 'manual' }); const b = await ensureTrackedLink(db, { companyId: 'C1', itemId: 'I1', channel: 'manual' })
  assert.ok(isValidCode(a.code)); assert.deepEqual(a, b); assert.equal(db.tables.tracked_links.length, 1); ok('link: mesmo (imóvel, canal) reaproveita o código')
  const c = await ensureTrackedLink(db, { companyId: 'C1', itemId: 'I1', opportunityId: 'O1', contentId: 'P1', channel: 'caption' }); assert.notEqual(c.code, a.code); assert.equal(db.tables.tracked_links[1].content_id, 'P1'); ok('link: oportunidade/canal diferente = outro código')
  assert.equal((await ensureTrackedLink(memDb({ tracked_links: [] }, { fail: { 'tracked_links.insert': 'x' } }), { companyId: 'C1', itemId: 'I1', channel: 'dm' })), null); ok('link: insert recusado = null (e log), sem lançar')
}

// --- set / get (dono)
{
  const db = memDb(baseSeed()); db.tables.public_pages = []; db.tables.tracked_links = []
  let r = await getPublicPageState(db, 'C1', 'not-uuid'); assert.equal(r.status, 400); r = await getPublicPageState(db, 'C1', '11111111-1111-1111-1111-111111111111'); assert.equal(r.status, 404); ok('dono: item inválido/inexistente')
  db.tables.marketing_ai_knowledge[0].id = '11111111-1111-1111-1111-111111111111'; const ID = '11111111-1111-1111-1111-111111111111'
  r = await getPublicPageState(db, 'C1', ID); assert.equal(r.status, 200); assert.equal(r.body.enabled, false); assert.deepEqual(r.body.contact, { phone: '(21) 98888-7777', ig: 'imob.rio' }); assert.deepEqual(r.body.fields.map(f => f.key), ['tipo', 'bairro', 'preco']); assert.equal(r.body.photos_count, 3); ok('dono: prévia do que vai aparecer (mesma função da página)')
  r = await setPublicPage(db, 'C1', 'U1', ID, 'sim'); assert.equal(r.status, 400); ok('dono: enabled precisa ser booleano')
  db.tables.marketing_ai_knowledge[0].meta.photos = db.tables.marketing_ai_knowledge[0].meta.photos.slice(0, 2)
  r = await setPublicPage(db, 'C1', 'U1', ID, true); assert.equal(r.status, 400); assert.equal(r.body.code, 'min_photos'); assert.equal(db.tables.public_pages.length, 0); ok('dono: menos de 3 fotos reais não publica')
  db.tables.marketing_ai_knowledge[0].meta.photos.push({ url: 'https://x/3.jpg' })
  db.tables.marketing_ai_knowledge[0].meta.staged_photos = [{ url: 'https://x/s1.jpg' }, { url: 'https://x/s2.jpg' }]; db.tables.marketing_ai_knowledge[0].meta.photos.pop()
  assert.equal((await setPublicPage(db, 'C1', 'U1', ID, true)).status, 400); ok('dono: foto mobiliada (staged) não conta para o mínimo')
  db.tables.marketing_ai_knowledge[0].meta.photos.push({ url: 'https://x/3.jpg' })
  r = await setPublicPage(db, 'C1', 'U1', ID, true); assert.equal(r.status, 200); assert.match(r.body.link, /^https:\/\/getsaleboost\.com\/p\/[a-z0-9]{8}$/)
  const pg = db.tables.public_pages[0]; assert.deepEqual([pg.enabled, pg.approved_by, pg.contact_phone, pg.contact_ig, !!pg.approved_at], [true, 'U1', '(21) 98888-7777', 'imob.rio', true]); ok('dono: publicar grava aprovação, contatos da empresa e devolve o link')
  const code = r.body.link.split('/p/')[1]; assert.equal(db.tables.tracked_links.find(l => l.code === code).channel, 'manual')
  const again = await setPublicPage(db, 'C1', 'U1', ID, true); assert.equal(again.body.link, r.body.link); assert.equal(db.tables.tracked_links.length, 1); ok('dono: publicar de novo mantém o mesmo link')
  assert.equal((await handle(db, 'public_page_get', { code })).status, 200); ok('dono: o link devolvido abre a página')
  r = await setPublicPage(db, 'C1', 'U1', ID, false); assert.deepEqual([r.status, r.body.enabled], [200, false]); assert.equal((await handle(db, 'public_page_get', { code })).status, 404); ok('dono: despublicar tira do ar (404)')
  const semFicha = memDb({ ...baseSeed(), vertical_playbooks: [{ key: 'imoveis_rio', enabled: true, config: {} }] }); semFicha.tables.marketing_ai_knowledge[0].id = ID
  assert.equal((await setPublicPage(semFicha, 'C1', 'U1', ID, true)).status, 400); ok('dono: setor sem public_page na ficha não publica')
  const outra = await setPublicPage(db, 'C2', 'U2', ID, true); assert.equal(outra.status, 404); ok('dono: imóvel de outra empresa = 404')
  const semTel = memDb({ ...baseSeed(), companies: [{ ...baseSeed().companies[0], phone: null, instagram_username: null }] }); semTel.tables.marketing_ai_knowledge[0].id = ID; semTel.tables.public_pages = []
  const rs = await setPublicPage(semTel, 'C1', 'U1', ID, true); assert.deepEqual(rs.body.contact, { phone: null, ig: null }); ok('dono: empresa sem telefone/Instagram publica só com formulário')
}

// --- links nas peças (cron)
{
  const seed = () => ({
    ...baseSeed(), tracked_links: [],
    marketing_ai_test_content: [
      { id: 'P1', company_id: 'C1', item_id: 'I1', opportunity_id: 'O1', caption: 'Legenda 1', status: 'vault' },
      { id: 'P2', company_id: 'C1', item_id: 'I1', opportunity_id: 'O1', caption: 'Legenda 2', status: 'draft' },
      { id: 'P3', company_id: 'C1', item_id: 'I1', opportunity_id: 'O1', caption: 'Já aprovada', status: 'vault' },
      { id: 'P4', company_id: 'C1', item_id: 'I1', opportunity_id: null, caption: 'Sem oportunidade', status: 'vault' },
      { id: 'P5', company_id: 'C1', item_id: 'I9', opportunity_id: 'O1', caption: 'Imóvel sem página', status: 'vault' },
      { id: 'P6', company_id: 'C1', item_id: 'I1', opportunity_id: 'O1', caption: 'Publicada', status: 'published' },
      { id: 'P7', company_id: 'C1', item_id: 'I1', opportunity_id: 'O1', caption: null, status: 'vault' },
    ],
    agent_actions: [{ id: 'A1', company_id: 'C1', ref_type: 'marketing_ai_test_content', ref_id: 'P3', approval_status: 'APPROVED' }],
  })
  const db = memDb(seed()); const changed = await attachTrackedLinks(db, 'C1', RAW)
  const cap = id => db.tables.marketing_ai_test_content.find(r => r.id === id).caption
  assert.equal(changed, 2); assert.match(cap('P1'), /^Legenda 1\n\nMais fotos e detalhes: https:\/\/getsaleboost\.com\/p\/[a-z0-9]{8}$/); assert.match(cap('P2'), /p\/[a-z0-9]{8}$/); ok('cron: rascunhos de oportunidade ganham a frase com o link')
  assert.equal(cap('P3'), 'Já aprovada'); assert.equal(cap('P4'), 'Sem oportunidade'); assert.equal(cap('P5'), 'Imóvel sem página'); assert.equal(cap('P6'), 'Publicada'); assert.equal(cap('P7'), null); ok('cron: aprovada, sem oportunidade, sem página, publicada e sem legenda ficam como estão')
  const codes = new Set([cap('P1'), cap('P2')].map(c => c.split('/p/')[1])); assert.equal(codes.size, 1); assert.equal(db.tables.tracked_links.length, 1); assert.deepEqual([db.tables.tracked_links[0].channel, db.tables.tracked_links[0].opportunity_id, db.tables.tracked_links[0].item_id], ['caption', 'O1', 'I1']); ok('cron: link canal "caption" ligado à oportunidade e ao imóvel')
  const before = [cap('P1'), cap('P2')]; assert.equal(await attachTrackedLinks(db, 'C1', RAW), 0); assert.deepEqual([cap('P1'), cap('P2')], before); ok('cron: 2ª rodada não repete a frase (uma vez só)')
  const dbOff = memDb({ ...seed(), public_pages: [{ item_id: 'I1', company_id: 'C1', enabled: false }] }); assert.equal(await attachTrackedLinks(dbOff, 'C1', RAW), 0); assert.equal(dbOff.tables.marketing_ai_test_content[0].caption, 'Legenda 1'); ok('cron: página desligada = nada muda')
  assert.equal(await attachTrackedLinks(memDb(seed()), 'C1', undefined), 0); ok('cron: setor sem public_page = nada muda')
  const dbA = memDb(seed(), { fail: { 'agent_actions.select': 'x' } }); assert.equal(await attachTrackedLinks(dbA, 'C1', RAW), 0); assert.equal(dbA.tables.marketing_ai_test_content[0].caption, 'Legenda 1'); ok('cron: não conseguiu conferir aprovações = não mexe em nada')
  const dbU = memDb(seed(), { fail: { 'marketing_ai_test_content.update': 'x' } }); assert.equal(await attachTrackedLinks(dbU, 'C1', RAW), 0); ok('cron: update recusado é logado, sem lançar')
  const edited = memDb(seed()); const origUpdate = edited.from; edited.from = (t) => { const q = origUpdate(t); if (t === 'marketing_ai_test_content') { const eq = q.eq; q.eq = (c, v) => (c === 'caption' ? eq('caption', '__outra__') : eq(c, v)) } return q }
  assert.equal(await attachTrackedLinks(edited, 'C1', RAW), 0); ok('cron: dono editou a legenda no meio-tempo = não sobrescreve')
}

// --- mensagem do QUERO
{
  const db = memDb(baseSeed()); db.tables.tracked_links = []
  const msg = await withDmLink(db, 'C1', 'I1', 'pt', RAW, 'Oi! Que bom.')
  assert.match(msg, /^Oi! Que bom\.\n\nMais fotos e detalhes: https:\/\/getsaleboost\.com\/p\/[a-z0-9]{8}$/); assert.equal(db.tables.tracked_links[0].channel, 'dm'); ok('QUERO: mensagem nova com página ganha o link (canal dm)')
  assert.equal(await withDmLink(db, 'C1', 'I1', 'pt', RAW, msg), msg); ok('QUERO: não repete')
  assert.match(await withDmLink(db, 'C1', 'I1', 'en', RAW, 'Hi!'), /More photos and details: /); ok('QUERO: inglês')
  const off = memDb({ ...baseSeed(), public_pages: [] }); assert.equal(await withDmLink(off, 'C1', 'I1', 'pt', RAW, 'Oi'), 'Oi'); assert.equal(await withDmLink(db, 'C1', 'I1', 'pt', undefined, 'Oi'), 'Oi'); ok('QUERO: sem página aprovada ou sem ficha, a mensagem fica igual')
}

console.log(`\n${n} verificações ok`)
