// Funil comercial do painel (2026-11-12): só dado real, quebra por imóvel e por publicação, sem confundir lead com qualificado.
import assert from 'node:assert/strict'
const f = await import('../src/lib/commercialFunnel.ts')
let n = 0; const ok = m => { n++; console.log('  ✓', m) }

const links = [
  { id: 'L1', item_id: 'I1', content_id: null, channel: 'dm' },
  { id: 'L2', item_id: 'I1', content_id: 'POST1', channel: 'dm' },
  { id: 'L3', item_id: 'I2', content_id: 'DRAFT9', channel: 'caption' },
]
const events = [
  { link_id: 'L1', event: 'view' }, { link_id: 'L2', event: 'view' }, { link_id: 'L2', event: 'view' }, { link_id: 'L3', event: 'view' },
  { link_id: 'L2', event: 'click_whatsapp' }, { link_id: 'L1', event: 'click_dm' }, { link_id: 'L2', event: 'lead' },
]
const lead = (o) => ({ id: 'x', item_id: null, link_id: null, channel: null, source: null, visit_at: null, created_at: '2026-11-10', ...o })
const leads = [lead({ id: 'A', link_id: 'L2', item_id: 'I1', source: 'link_page', channel: 'manual' }), lead({ id: 'B', channel: 'instagram', source: 'instagram_dm' }), lead({ id: 'C', channel: 'instagram', item_id: 'I2' }), lead({ id: 'D', channel: 'whatsapp' })]
const visitLeads = [lead({ id: 'A', link_id: 'L2', item_id: 'I1', visit_at: '2026-11-11' })]
const r = f.buildFunnel({ links, events, leads, visitLeads, comments: [{ item_id: 'I1' }, { item_id: null }], postIds: new Set(['POST1']) })

assert.deepEqual(r.totals, { views: 4, interested: 4, leads: 4, visits: 1 }); ok('totais: visualizações, interessados (cliques + comentários), leads, visitas')
assert.deepEqual(r.interestedBy, { clicks: 2, comments: 2 }); ok('interessados separados em cliques e comentários')
assert.deepEqual(r.leadsBy, { form: 1, instagram: 2, other: 1 }); ok('leads por origem: formulário · Instagram · outros')
const i1 = r.byItem.find(b => b.id === 'I1'); assert.deepEqual(i1, { id: 'I1', views: 3, interested: 3, leads: 1, visits: 1 }); ok('por imóvel: visitas, cliques, comentário e lead do mesmo imóvel')
assert.equal(r.byItem[0].id, 'I1'); ok('por imóvel: ordem por leads, depois interessados')
assert.deepEqual(r.byPost, [{ id: 'POST1', views: 2, interested: 1, leads: 1, visits: 1 }]); ok('por publicação: só post publicado (rascunho DRAFT9 fica de fora)')
assert.equal(events.filter(e => e.event === 'lead').length, 1); assert.equal(r.totals.leads, 4); ok('evento "lead" da página não conta em dobro (lead vem da tabela de leads)')

const z = f.buildFunnel({ links: [], events: [], leads: [], visitLeads: [], comments: [], postIds: new Set() })
assert.deepEqual(z.totals, { views: 0, interested: 0, leads: 0, visits: 0 }); assert.deepEqual(z.byItem, []); assert.deepEqual(f.barWidths(z.totals), { views: 0, interested: 0, leads: 0, visits: 0 }); ok('sem dados: tudo zero e barras vazias (a tela mostra "ainda sem dados")')
assert.deepEqual(f.barWidths({ views: 200, interested: 50, leads: 10, visits: 0 }), { views: 100, interested: 25, leads: 5, visits: 0 }); ok('barras relativas ao maior número')
assert.equal(f.leadChannel({ channel: 'manual', source: 'link_page', link_id: null }), 'form'); assert.equal(f.leadChannel({ channel: 'instagram', source: null, link_id: null }), 'instagram'); ok('origem do lead')

const src = (await import('node:fs')).readFileSync(new URL('../src/pages/dashboard/marketingAi/CommercialFunnel.tsx', import.meta.url), 'utf8')
assert.ok(src.includes('Leads recebidos') && !/Leads qualificados/.test(src)); ok('a tela diz "Leads recebidos", nunca "Leads qualificados"')
console.log(`${n} verificações ok`)
