import assert from 'node:assert/strict'
// Roda: node --experimental-strip-types scripts/test-opportunity-pieces.mjs
// Etapa 4B (plano aprovado → peças em rascunho): escolha de formato SEM vídeo, limite 3 por plano / 6 por dia,
// idempotência, item sem foto, mapa da ficha, intenção da oportunidade e filtro de afirmações de mercado.
import { videoFree, decidePieces, idempotency, itemsWithPhotos, resolveFormatKey, itemUsable, MAX_PIECES_PER_DAY, STALE_DISPATCH_MS } from '../supabase/functions/_shared/opportunityPieces.ts'
import { clampPieces, finalizePlan, buildPlanPrompt } from '../supabase/functions/_shared/opportunityPlan.ts'
import { claimGuard, hasUnsupportedClaim, cleanText, allowedNumbers, actionForPhotos, buildPrompt, finalize } from '../supabase/functions/_shared/opportunityOutput.ts'
import { buildCandidates } from '../supabase/functions/_shared/opportunityEngine.ts'
import { buildOpportunityIntent, intentBlock, cleanIntent } from '../supabase/functions/_shared/slotIntent.ts'
import { generateOpportunityPieces } from '../supabase/functions/_shared/opportunityPiecesRun.ts'
let n = 0; const ok = (m) => { n++; console.log('ok -', m) }
const U = (k) => `${k}`.repeat(36).slice(0, 36).replace(/./g, (c, i) => (i === 8 || i === 13 || i === 18 || i === 23 ? '-' : c))
const I1 = U('1'), I2 = U('2'), I3 = U('3'), I4 = U('4'), OPP = U('a'), CO = U('c')

// ── formato sem vídeo
{
  assert.deepEqual(videoFree('reel'), { format: 'carousel', videoDeferred: true })
  for (const f of ['carousel', 'post', 'story']) assert.deepEqual(videoFree(f), { format: f, videoDeferred: false })
  assert.deepEqual(videoFree('video'), { format: 'carousel', videoDeferred: false }); assert.deepEqual(videoFree(undefined), { format: 'carousel', videoDeferred: false })
  ok('reel/vídeo vira carrossel e marca "vídeo adiado"; carrossel/post/story ficam; lixo cai em carrossel')
}
// ── quantidade
{
  assert.equal(clampPieces(undefined), 2); assert.equal(clampPieces(1), 1); assert.equal(clampPieces('3'), 3); assert.equal(clampPieces(9), 3); assert.equal(clampPieces(0), 2); assert.equal(clampPieces(-1), 2); assert.equal(clampPieces(1.5), 2)
  ok('plano: padrão 2, a IA pode sugerir 1 a 3, nunca mais de 3')
}
const photos = { [I1]: 8, [I2]: 6, [I3]: 2, [I4]: 0 }
const dec = (plan, over = {}) => decidePieces({ plan: { format_suggestion: 'carousel', item_ids: [I1, I2], ...plan }, photoCounts: photos, usedToday: 0, existingPieces: 0, lang: 'pt', ...over })
// ── escolha das peças
{
  let d = dec({}); assert.deepEqual(d.specs, [{ format: 'carousel', mode: 'item', item_id: I1 }, { format: 'carousel', mode: 'item', item_id: I2 }]); assert.equal(d.videoDeferred, false)
  d = dec({ pieces_count: 3 }); assert.equal(d.specs.length, 3); assert.deepEqual(d.specs[2], { format: 'carousel', mode: 'text' }) // 2 itens com foto + 1 de texto
  d = dec({ pieces_count: 1 }); assert.equal(d.specs.length, 1)
  d = dec({ pieces_count: 99, item_ids: [I1, I2, I1, I3] }); assert.equal(d.specs.length, 3); assert.equal(new Set(d.specs.filter(s => s.item_id).map(s => s.item_id)).size, 2, 'não repete item')
  d = dec({ format_suggestion: 'reel' }); assert.equal(d.format, 'carousel'); assert.equal(d.videoDeferred, true); assert.ok(d.notes.some(x => /Vídeo fica para quando o dono liberar custo de vídeo/.test(x)))
  assert.ok(d.specs.every(s => s.format === 'carousel'), 'nenhuma peça de vídeo')
  d = dec({ format_suggestion: 'story' }); assert.ok(d.specs.every(s => s.format === 'story'))
  ok('peças: padrão 2; 1 por item com foto; teto 3; "reel" vira carrossel com nota de vídeo adiado')
}
// ── item sem foto: nunca inventa imagem de imóvel (regra 4)
{
  let d = dec({ item_ids: [I3, I4] }); assert.deepEqual(d.specs, [{ format: 'carousel', mode: 'text' }]); assert.ok(d.notes.some(x => /sem imagem de imóvel/.test(x)))
  d = dec({ item_ids: [] }); assert.deepEqual(d.specs, [{ format: 'carousel', mode: 'text' }])
  d = dec({ item_ids: [I1, I3] }); assert.deepEqual(d.specs.map(s => s.mode), ['item', 'text'])
  assert.deepEqual(itemsWithPhotos([I1, I3, I4, I2, 'x', 7], photos), [I1, I2]) // 5+ fotos reais
  assert.ok(!dec({ item_ids: [I3, I4] }).specs.some(s => s.mode === 'item'), 'sem foto suficiente nunca vira peça de foto')
  d = decidePieces({ plan: { format_suggestion: 'post', item_ids: [I3], pieces_count: 3 }, photoCounts: photos, usedToday: 0, existingPieces: 0, lang: 'en' }); assert.equal(d.specs.length, 1); assert.ok(d.notes.some(x => /text only/.test(x)))
  ok('item sem foto suficiente → 1 peça de texto/educativa (nunca 2 iguais) com o motivo registrado')
  assert.ok(itemUsable(I1, [I1], 5)); assert.ok(!itemUsable(I1, [I1], 4)); assert.ok(!itemUsable(I1, [I2], 9)); assert.ok(!itemUsable(123, [I1], 9))
  ok('itemUsable: item precisa ser do plano e ter ≥ 5 fotos reais')
}
// ── limites: 3 por plano / 6 por empresa por dia
{
  assert.equal(MAX_PIECES_PER_DAY, 6)
  let d = dec({ pieces_count: 3 }, { usedToday: 6 }); assert.equal(d.skip, 'daily_limit'); assert.equal(d.specs.length, 0)
  d = dec({ pieces_count: 3 }, { usedToday: 7 }); assert.equal(d.skip, 'daily_limit')
  d = dec({ pieces_count: 3 }, { usedToday: 5 }); assert.equal(d.specs.length, 1); assert.ok(d.notes.some(x => /limite diário/.test(x)))
  d = dec({ pieces_count: 3 }, { usedToday: 3 }); assert.equal(d.specs.length, 3)
  d = dec({}, { existingPieces: 1 }); assert.equal(d.skip, 'already'); assert.equal(d.specs.length, 0)
  ok('limites: no máx. 3 por plano e 6 por empresa por dia; já tem peça → não gera')
}
// ── idempotência
{
  const now = Date.parse('2026-10-29T12:00:00Z'), iso = (ms) => new Date(ms).toISOString()
  const base = { generatedAt: null, existingPieces: 0, everCreated: 0, retried: false, nowMs: now }
  const stale = iso(now - STALE_DISPATCH_MS - 1000)
  assert.equal(idempotency(base), 'go')
  assert.equal(idempotency({ ...base, existingPieces: 2 }), 'already')
  assert.equal(idempotency({ ...base, generatedAt: iso(now - 60_000) }), 'already', 'despachado há 1 min: espera')
  // falhou em segundo plano (nenhuma peça jamais existiu): 1 retentativa, igual para 1, 2 ou 3 peças pedidas
  assert.equal(idempotency({ ...base, generatedAt: stale }), 'retry', 'despachado há > 30 min e nenhuma peça jamais existiu → retenta')
  assert.equal(idempotency({ ...base, generatedAt: stale, retried: true }), 'already', 'retentativa é única (qualquer quantidade de peças pedidas)')
  // o dono EXCLUIU o rascunho: a peça já existiu → nunca regera sozinho
  assert.equal(idempotency({ ...base, generatedAt: stale, everCreated: 1 }), 'already', 'rascunho excluído não volta')
  assert.equal(idempotency({ ...base, generatedAt: stale, everCreated: 2 }), 'already')
  assert.equal(idempotency({ ...base, generatedAt: iso(now - 9e9), existingPieces: 1 }), 'already')
  ok('idempotência: peça existente/excluída ou despacho recente → não gera; falha em segundo plano → 1 retentativa única')
}
// ── mapa da ficha (regra 6)
{
  const cfg = { carousel: { item: 'carrossel_imovel', text: 'carrossel_educativo' }, post: { item: 'detalhe_imovel' }, story: { item: 'video_comodo', text: 'dm_x' } }
  const fm = [
    { key: 'carrossel_imovel', producer: 'item_package', status: 'live', recipe: 'carrossel_tour' }, { key: 'carrossel_educativo', producer: 'post', status: 'live' },
    { key: 'detalhe_imovel', producer: 'item_package', status: 'planned', recipe: 'x' }, { key: 'video_comodo', producer: 'item_video', status: 'live', recipe: 'v' }, { key: 'dm_x', producer: 'dm', status: 'live' },
  ]
  assert.deepEqual(resolveFormatKey(cfg, 'carousel', 'item', fm), { key: 'carrossel_imovel' })
  assert.deepEqual(resolveFormatKey(cfg, 'carousel', 'text', fm), { key: 'carrossel_educativo' })
  assert.equal(resolveFormatKey(cfg, 'post', 'item', fm), null, 'formato planned não vale')
  assert.deepEqual(resolveFormatKey(cfg, 'post', 'text', fm), { key: null }, 'sem mapa de texto → carrossel de slides genérico')
  assert.equal(resolveFormatKey(cfg, 'story', 'item', fm), null, 'vídeo (item_video) nunca')
  assert.deepEqual(resolveFormatKey(cfg, 'story', 'text', fm), { key: null }, 'DM nunca')
  assert.equal(resolveFormatKey(undefined, 'carousel', 'item', fm), null); assert.deepEqual(resolveFormatKey(null, 'carousel', 'text', fm), { key: null })
  ok('mapa da ficha: só formato live; foto = item_package com receita; texto = post; vídeo e DM nunca')
}
// ── intenção da oportunidade
{
  const plan = { audience: 'Quem busca perto do trabalho', objective: 'Gerar pedidos de visita.', buyer_problem: 'Achar imóvel bem localizado.', value_proposition: 'Apartamento de 3 quartos.', key_message: 'Conheça o apartamento.', cta: 'Me chama no direct' }
  const it = buildOpportunityIntent('Leblon sem conteúdo', plan)
  assert.equal(it.pilar_ss, ''); assert.equal(it.opportunity.title, 'Leblon sem conteúdo')
  const b = intentBlock(it); assert.match(b, /oportunidade comercial APROVADA/); assert.match(b, /Mensagem principal: Conheça o apartamento/); assert.match(b, /CTA sugerido: Me chama no direct/); assert.ok(b.length <= 900)
  assert.match(b, /adjetivo de mercado/)
  assert.equal(buildOpportunityIntent('x', {}), null); assert.equal(buildOpportunityIntent('x', null), null)
  const big = buildOpportunityIntent('T', { ...plan, objective: 'o'.repeat(300), buyer_problem: 'b'.repeat(300), value_proposition: 'v'.repeat(300), key_message: 'k'.repeat(300) })
  const bb = intentBlock(big); assert.ok(bb.length <= 900); assert.match(bb, /Use como direção/) // as regras nunca se perdem
  assert.equal(cleanIntent({ pilar_ss: '', opportunity: it.opportunity }).opportunity.objective, 'Gerar pedidos de visita.')
  assert.equal(cleanIntent({ nada: 1 }), null)
  ok('intenção da oportunidade: sem pilar_ss, ≤ 900 caracteres, regras sempre no fim, cleanIntent aceita')
}
// ── afirmações de mercado sem dado
{
  const g = claimGuard('pt', ['Apto Leblon · Quartos: 3', 'Nenhum post em 60 dias.'])
  assert.ok(hasUnsupportedClaim('Leblon é um bairro disputado.', g)); assert.ok(hasUnsupportedClaim('Imóvel de alto padrão', g)); assert.ok(hasUnsupportedClaim('Ticket elevado na região.', g)); assert.ok(hasUnsupportedClaim('Bairro NOBRE da zona sul', g))
  assert.ok(!hasUnsupportedClaim('Leblon tem um apartamento sem post.', g))
  const g2 = claimGuard('pt', ['Concorrentes citam bairro valorizado.'])
  assert.ok(!hasUnsupportedClaim('O bairro valorizado merece destaque.', g2), 'o mesmo termo está nos fatos → vale')
  assert.ok(hasUnsupportedClaim('O bairro é disputado.', g2))
  const allowed = allowedNumbers([])
  assert.equal(cleanText('Leblon é disputado. Há um item sem post.', allowed, 200, g), 'Há um item sem post.')
  assert.equal(cleanText('Leblon é disputado.', allowed, 200), 'Leblon é disputado.', 'sem guarda = comportamento antigo')
  const gf = claimGuard('pt', ['x'], ['premium'])
  assert.ok(!hasUnsupportedClaim('bairro disputado', gf), 'lista da ficha substitui a genérica'); assert.ok(hasUnsupportedClaim('serviço premium', gf))
  const ge = claimGuard('en', ['x']); assert.ok(hasUnsupportedClaim('A competitive, upscale area.', ge)); assert.ok(!hasUnsupportedClaim('Three bedrooms.', ge))
  const gw = claimGuard('en', ['x']); assert.ok(!hasUnsupportedClaim('We appreciate your visit; primer coat; a primed wall.', gw), 'borda de palavra: appreciate/primer não pegam'); assert.ok(hasUnsupportedClaim('A prime location.', gw)); assert.ok(hasUnsupportedClaim('Appreciating values.', gw))
  const gp = claimGuard('pt', ['x']); assert.ok(!hasUnsupportedClaim('Nobreza de materiais; luxuoso acabamento; concorrencia.', gp), 'sem radical amplo'); assert.ok(hasUnsupportedClaim('Imóveis valorizados.', gp)); assert.ok(hasUnsupportedClaim('Mercado EM ALTA.', gp))
  ok('afirmação de mercado ("disputado", "alto padrão", "ticket elevado"…) sai se não está nos fatos; ficha pode trocar a lista; EN também')
}
const fieldMap = { location: 'bairro', price: 'preco', type: 'tipo', bedrooms: 'quartos', deal: 'venda_ou_aluguel' }
const labels = { bairro: 'Bairro', preco: 'Preço', tipo: 'Tipo', quartos: 'Quartos' }
const opp = {
  title: 'Leblon sem conteúdo', commercial_problem: 'O bairro tem imóvel e nenhum post.', audience: 'quem busca perto do trabalho', suggested_action: 'Mostrar o imóvel.', how_to_measure: 'Mensagens.',
  evidence: [{ type: 'fact', text: 'Apto Leblon · Bairro: Leblon · Quartos: 3', source: 'Catálogo', date: null }], item_ids: [I1],
}
const goodPlan = () => ({ audience: 'Quem busca perto do trabalho', objective: 'Gerar pedidos de visita.', buyer_problem: 'Achar imóvel.', value_proposition: 'Apartamento de 3 quartos.', key_message: 'Conheça o apartamento.', channel: 'instagram', format_suggestion: 'reel', format_reason: 'Mostra os ambientes.', cta: 'Me chama no direct', success_metrics: 'Mensagens.', item_ids: [I1], cited_evidence: ['E1'], hypotheses: [], pieces_count: 3 })
{
  // plano: frase com adjetivo de mercado sem dado sai; quantidade vai pro plano
  const r = finalizePlan({ lang: 'pt', opp, items: [{ id: I1, title: 'Apto Leblon', fields: { bairro: 'Leblon', quartos: 3 } }], fieldMap, labels, llm: { ...goodPlan(), key_message: 'Conheça o apartamento. O Leblon é um bairro disputado e de alto padrão.', buyer_problem: 'Bairro disputado e ticket elevado.' }, ctas: { sem_automacao: 'Me chama no direct' } })
  assert.ok(r.ok); assert.equal(r.plan.key_message, 'Conheça o apartamento.'); assert.equal(r.plan.buyer_problem, opp.commercial_problem, 'texto todo barrado → cai no da oportunidade')
  assert.equal(r.plan.pieces_count, 3); assert.equal(r.plan.format_suggestion, 'reel') // o plano guarda a sugestão; quem vira carrossel é o gerador de peças
  const r2 = finalizePlan({ lang: 'pt', opp, items: [{ id: I1, title: 'Apto Leblon', fields: { bairro: 'Leblon', quartos: 3 } }], fieldMap, labels, llm: { ...goodPlan(), pieces_count: undefined }, marketClaims: null }); assert.equal(r2.plan.pieces_count, 2)
  ok('plano: afirmação de mercado sem dado sai; pieces_count vai pro plano (padrão 2)')
  const p = buildPlanPrompt({ lang: 'pt', businessName: 'X', itemLabel: 'Imóvel', opp, items: [{ id: I1, text: 'Apto', photos: 0 }], ctaAlt: 'Me chama no direct' })
  assert.match(p, /fotos reais: 0/); assert.match(p, /"disputado", "valorizado"/); assert.match(p, /pieces_count/)
  ok('prompt do plano: adjetivos de mercado só com dado, fotos por item, pieces_count')
}
// ── oportunidades: foto no prompt e na ação
{
  assert.match(actionForPhotos('Publicar um carrossel com as fotos do imóvel.', [I4], { [I4]: 0 }, 'pt'), /^Adicionar fotos reais/)
  assert.ok(!/Publicar um carrossel/.test(actionForPhotos('Publicar um carrossel com as fotos do imóvel.', [I4], { [I4]: 0 }, 'pt')))
  assert.equal(actionForPhotos('Publicar com fotos.', [I1], { [I1]: 8 }, 'pt'), 'Publicar com fotos.')
  assert.equal(actionForPhotos('Publicar com fotos.', [I1, I4], { [I1]: 8, [I4]: 0 }, 'pt'), 'Publicar com fotos.', 'basta um item com foto')
  assert.match(actionForPhotos('Conversar com o dono.', [I4], { [I4]: 0 }, 'pt'), /^Adicionar fotos reais.*Conversar com o dono\.$/)
  assert.match(actionForPhotos('Post it.', [I4], { [I4]: 0 }, 'en'), /^Add real photos/)
  assert.equal(actionForPhotos('Publicar.', [], { }, 'pt'), 'Publicar.', 'sem item ligado nada muda')
  const now = new Date('2026-10-29T12:00:00Z')
  const input = { lang: 'pt', now, windowDays: 60, fieldMap, labels, itemLabel: 'Imóvel', catalog: [{ id: I1, title: 'Apto Leblon', fields: { bairro: 'Leblon', quartos: 3 }, photoCount: 0 }], posts: [], events: [], competitors: [], trends: [], signals: [], instagramConnected: true }
  const { facts, candidates } = buildCandidates(input)
  assert.ok(candidates.length > 0)
  const c = candidates.find(x => x.item_ids.includes(I1))
  assert.ok(c, 'candidato do item sem foto')
  {
    const prompt = buildPrompt({ lang: 'pt', businessName: 'X', itemLabel: 'Imóvel', facts, candidates: [c], windowDays: 60, photoCounts: { [I1]: 0 } })
    assert.match(prompt, /fotos reais dos itens ligados: 0 \(NENHUMA/); assert.match(prompt, /"disputado", "valorizado"/)
    const out = finalize({ lang: 'pt', candidates: [c], facts, llm: [{ candidate_id: c.id, title: 'Leblon disputado sem posts', suggested_action: 'Publicar um carrossel com fotos do imóvel.', description: 'Bairro disputado. Há um item sem post.' }], photoCounts: { [I1]: 0 } })
    assert.match(out[0].suggested_action, /^Adicionar fotos reais/); assert.ok(!/disputado/i.test(out[0].title + out[0].description), 'opinião sem dado sai: ' + out[0].title + ' | ' + out[0].description)
    const out2 = finalize({ lang: 'pt', candidates: [c], facts, llm: [{ candidate_id: c.id, suggested_action: 'Publicar um carrossel com fotos do imóvel.' }], photoCounts: { [I1]: 7 } })
    assert.match(out2[0].suggested_action, /Publicar um carrossel/)
  }
  ok('oportunidade: sem foto, a ação sugere adicionar fotos reais antes; prompt leva fotos por candidato e a regra de adjetivos')
}
// ── geração das peças (banco falso): reserva atômica, idempotência, limite do dia, vídeo adiado
function fakeDb(h) {
  const log = []
  const chain = (table) => { const f = { table, filters: [], op: 'select', payload: null }
    const c = {}
    for (const m of ['select', 'eq', 'like', 'gte', 'is', 'in', 'limit', 'order', 'not']) c[m] = (...a) => { if (m === 'select' && f.op !== 'update') f.op = 'select'; if (m !== 'select' && m !== 'limit' && m !== 'order') f.filters.push([m, ...a]); return c }
    c.update = (p) => { f.op = 'update'; f.payload = p; return c }
    c.insert = async (p) => { log.push({ table, op: 'insert', payload: p }); return { data: null, error: null } }
    const run = async () => { log.push({ table, op: f.op, filters: f.filters, payload: f.payload }); return (h[table] ?? (() => ({ data: null })))(f) }
    c.maybeSingle = run; c.then = (res, rej) => run().then(res, rej)
    return c }
  return { from: chain, log }
}
const handlers = ({ plan, generatedAt = null, drafts = 0, posts = 0, used = 0, created = 0, retried = 0, claim = [{ id: OPP }], status = 'approved', approved = '2026-10-29T10:00:00Z' }) => ({
  companies: () => ({ data: { language: 'pt' } }),
  growth_opportunities: (f) => f.op === 'update' ? (f.payload.plan ? { data: null, error: null } : { data: claim, error: null }) : { data: { id: OPP, status, plan, plan_approved_at: approved, pieces_generated_at: generatedAt, item_ids: [I1] }, error: null },
  marketing_ai_test_content: () => ({ count: drafts, error: null }),
  posts: () => ({ count: posts, error: null }),
  marketing_ai_knowledge: () => ({ data: [{ id: I1, meta: { photos: new Array(8).fill({}) } }, { id: I3, meta: { photos: [{}] } }] }),
  agent_performance: (f) => { const k = f.filters.find(x => x[1] === 'task_key')?.[2]; return { count: k === 'opportunity_piece_created' ? created : k === 'opportunity_pieces_retry' ? retried : used } },
})
{
  const plan = { ...goodPlan(), item_ids: [I1, I3], pieces_count: 2 }
  const calls = []; const dispatch = async (b) => { calls.push(b); return true }
  let db = fakeDb(handlers({ plan })); let r = await generateOpportunityPieces(db, CO, OPP, dispatch)
  assert.equal(r.ok, true); assert.equal(r.dispatched, 2); assert.equal(calls.length, 2)
  assert.deepEqual(calls.map(c => c.piece), [{ format: 'carousel', mode: 'item', item_id: I1 }, { format: 'carousel', mode: 'text' }]) // I3 tem 1 foto → texto
  assert.ok(calls.every(c => c.opportunity_id === OPP && c.company_id === CO))
  const claimUp = db.log.find(x => x.op === 'update' && x.payload.pieces_generated_at); assert.ok(claimUp.filters.some(f => f[0] === 'is' && f[1] === 'pieces_generated_at'), 'reserva atômica: só se ainda null')
  assert.ok(claimUp.filters.some(f => f[1] === 'company_id' && f[2] === CO), 'filtra por empresa')
  const logs = db.log.filter(x => x.op === 'insert').map(x => x.payload); assert.equal(logs.length, 2); assert.ok(logs.every(l => l.task_key === 'opportunity_pieces' && l.success === true))
  const info = db.log.find(x => x.op === 'update' && x.payload.plan).payload.plan.pieces_info; assert.equal(info.video_deferred, true); assert.equal(info.used_format, 'carousel'); assert.ok(info.notes.some(t => /custo de vídeo/.test(t)))
  ok('geração: despacha as peças certas (foto real / texto), reserva atômica, loga opportunity_pieces, registra vídeo adiado no plano')

  // idempotência: já tem peça (rascunho ou post) → não despacha
  calls.length = 0
  r = await generateOpportunityPieces(fakeDb(handlers({ plan, drafts: 1 })), CO, OPP, dispatch); assert.equal(r.reused, true); assert.equal(calls.length, 0)
  r = await generateOpportunityPieces(fakeDb(handlers({ plan, posts: 1 })), CO, OPP, dispatch); assert.equal(r.reused, true); assert.equal(calls.length, 0)
  r = await generateOpportunityPieces(fakeDb(handlers({ plan, generatedAt: new Date().toISOString() })), CO, OPP, dispatch); assert.equal(r.reused, true); assert.equal(calls.length, 0)
  // outra chamada ganhou a reserva (update não achou linha) → não despacha
  r = await generateOpportunityPieces(fakeDb(handlers({ plan, claim: [] })), CO, OPP, dispatch); assert.equal(r.reused, true); assert.equal(calls.length, 0)
  // rede de segurança: despachado há 1 h, nenhuma peça → tenta de novo, reservando só se o valor antigo continua igual
  const old = new Date(Date.now() - 3600_000).toISOString(); db = fakeDb(handlers({ plan, generatedAt: old }))
  r = await generateOpportunityPieces(db, CO, OPP, dispatch); assert.equal(r.dispatched, 2)
  assert.ok(db.log.find(x => x.op === 'update' && x.payload.pieces_generated_at).filters.some(f => f[0] === 'eq' && f[1] === 'pieces_generated_at' && f[2] === old))
  assert.ok(db.log.some(x => x.op === 'insert' && x.payload.task_key === 'opportunity_pieces_retry'), 'grava a linha da retentativa')
  // retentativa já feita → não repete; rascunho excluído pelo dono (peça já existiu) → não regera
  calls.length = 0
  r = await generateOpportunityPieces(fakeDb(handlers({ plan, generatedAt: old, retried: 1 })), CO, OPP, dispatch); assert.equal(r.reused, true); assert.equal(calls.length, 0)
  r = await generateOpportunityPieces(fakeDb(handlers({ plan, generatedAt: old, created: 2, drafts: 0, posts: 0 })), CO, OPP, dispatch); assert.equal(r.reused, true); assert.equal(calls.length, 0)
  ok('idempotência na geração: peça/post existente, despacho recente e reserva perdida não geram; retentativa só com o valor antigo')

  // limite diário: 6 usadas → nada despachado, nada reservado
  calls.length = 0; db = fakeDb(handlers({ plan, used: 6 })); r = await generateOpportunityPieces(db, CO, OPP, dispatch)
  assert.equal(r.code, 'daily_limit'); assert.equal(calls.length, 0); assert.ok(!db.log.some(x => x.op === 'update'))
  r = await generateOpportunityPieces(fakeDb(handlers({ plan, used: 5 })), CO, OPP, dispatch); assert.equal(r.dispatched, 1)
  ok('limite de 6 peças de oportunidade por empresa por dia')

  // plano não aprovado / oportunidade descartada → nada
  calls.length = 0
  r = await generateOpportunityPieces(fakeDb(handlers({ plan, approved: null })), CO, OPP, dispatch); assert.equal(r.code, 'not_ready')
  r = await generateOpportunityPieces(fakeDb(handlers({ plan, status: 'dismissed' })), CO, OPP, dispatch); assert.equal(r.code, 'not_ready'); assert.equal(calls.length, 0)
  r = await generateOpportunityPieces(fakeDb(handlers({ plan })), CO, 'nao-e-uuid', dispatch); assert.equal(r.status, 400)
  ok('plano não aprovado ou oportunidade descartada: não gera nada')

  // creative-generate recusou tudo: devolve a reserva (a rede de segurança tenta depois) e loga a falha
  db = fakeDb(handlers({ plan })); r = await generateOpportunityPieces(db, CO, OPP, async () => false)
  assert.equal(r.ok, false); assert.equal(r.code, 'dispatch_failed')
  const ups = db.log.filter(x => x.op === 'update' && 'pieces_generated_at' in (x.payload ?? {})); assert.equal(ups.length, 2); assert.equal(ups[1].payload.pieces_generated_at, null)
  assert.ok(db.log.filter(x => x.op === 'insert').every(x => x.payload.success === false))
  r = await generateOpportunityPieces(fakeDb(handlers({ plan })), CO, OPP, async () => { throw new Error('boom') }); assert.equal(r.code, 'dispatch_failed')
  ok('despacho recusado/falho: devolve a reserva e registra a falha (nada fica "gerado" sem peça)')

  // migration pendente (coluna ausente): não gera
  const h = handlers({ plan }); h.marketing_ai_test_content = () => ({ count: null, error: { message: 'column opportunity_id does not exist' } })
  calls.length = 0; r = await generateOpportunityPieces(fakeDb(h), CO, OPP, dispatch); assert.equal(r.code, 'migration_pending'); assert.equal(calls.length, 0)
  ok('migration das peças pendente: não gera (sem idempotência não há segurança)')
}
console.log(`\n${n} grupos ok`)
