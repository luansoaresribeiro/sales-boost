import assert from 'node:assert/strict'
// Roda: node --experimental-strip-types scripts/test-carousel-quality.mjs
// PR B (qualidade dos carrosséis): capa do educativo, variação de layout, carrossel de oferta/bairro, foto da capa
// (nota do PR A tolerante) e tema repetido. Funções puras: carouselOffer.ts, deckSlides.ts, slideSystem.ts, themeDedupe.ts.
import { COVER_STYLES, svgSlideSystem } from '../supabase/functions/_shared/slideSystem.ts'
import { deckPromptRules, normalizeDeck, pickCoverStyle, varyLayouts } from '../supabase/functions/_shared/deckSlides.ts'
import { buildNearbySlides, buildOfferSlides, dataLines, formatPrice, photoScore, pickCoverPhoto, pickMiddlePhotos } from '../supabase/functions/_shared/carouselOffer.ts'
import { claimPromptRule } from '../supabase/functions/_shared/claimLock.ts'
import { findRepeatedTheme, recentThemes, themeBlock } from '../supabase/functions/_shared/themeDedupe.ts'

let n = 0; const ok = (m) => { n++; console.log('ok -', m) }
const measure = (t, size, bold) => t.length * size * (bold ? 0.6 : 0.55) * 1.03

// ── capa: nunca índice ───────────────────────────────────────────────────────────────────────────────────────────
assert.ok(!COVER_STYLES.includes('lista')); assert.deepEqual([...COVER_STYLES], ['gancho', 'pergunta', 'erro'])
const seen = new Set(Array.from({ length: 30 }, (_, i) => pickCoverStyle(i))); assert.ok(!seen.has('lista') && seen.size === 3); ok('rodízio da capa: gancho, pergunta, erro — "lista" nunca é sorteada')
for (const st of COVER_STYLES) assert.ok(!/próximos slides|índice/i.test(deckPromptRules(st, 'Me chama')) || /NUNCA lista/.test(deckPromptRules(st, 'Me chama')))
assert.match(deckPromptRules('erro', ''), /ERRO COMUM/); assert.match(deckPromptRules('gancho', ''), /promessa concreta/); assert.match(deckPromptRules('pergunta', ''), /PERGUNTA/); assert.match(deckPromptRules('gancho', ''), /NUNCA lista os slides seguintes/); ok('prompt: capa é pergunta, erro comum ou promessa concreta; nunca lista os próximos slides')
assert.ok(!/MERCADO/.test(deckPromptRules('gancho', ''))); assert.equal(deckPromptRules('gancho', 'x'), deckPromptRules('gancho', 'x', undefined, ''))
const rule = claimPromptRule(['mais desejado', 'vale cada centavo'], '• '); assert.match(deckPromptRules('gancho', '', undefined, rule), /AFIRMAÇÃO DE MERCADO[^]*mais desejado, vale cada centavo/); assert.equal(claimPromptRule(null), ''); assert.equal(claimPromptRule([]), ''); ok('prompt: reforço de mercado só com termos da ficha; sem ficha o prompt é idêntico ao de antes')

// capa antiga com cover_style "lista" ainda desenha (peça antiga re-renderizada), e "erro" desenha o "!"
const brand = { primary: '#FF6D29', name: 'Tespon', bg: '#0E0B0A', text: '#ffffff' }
const svgErro = svgSlideSystem({ layout: 'capa', cover_style: 'erro', title: 'O erro que faz você pagar mais caro', page: '1', total: '5' }, brand, null, measure)
assert.ok(svgErro.svg.includes('>!</text>') && !svgErro.overflow); ok('capa "erro" desenha o "!" e cabe')
const svgOld = svgSlideSystem({ layout: 'capa', cover_style: 'lista', title: 'Antigo', items: 'a\nb', page: '1', total: '5' }, brand, null, measure); assert.ok(svgOld.svg.includes('Antigo')); ok('capa-índice antiga ainda renderiza se vier de peça velha')

// ── foto de fundo + 1 slide só ───────────────────────────────────────────────────────────────────────────────────
const px = 'data:image/png;base64,iVBORw0KGgo='
const ph = svgSlideSystem({ layout: 'capa', title: 'Apartamento em Ipanema', text: '3 quartos', page: '1', total: '7' }, brand, null, measure, { bgImage: px })
assert.ok(ph.svg.includes('<image href="data:image/png') && ph.svg.includes('linearGradient') && ph.svg.includes('fill="#ffffff"')); ok('foto de fundo: imagem + degradê escuro + texto branco')
const noPh = svgSlideSystem({ layout: 'capa', title: 'x', page: '1', total: '2' }, brand, null, measure, { bgImage: 'https://evil/x.png' }); assert.ok(!noPh.svg.includes('evil')); ok('só data URI de imagem entra como fundo')
const foto = svgSlideSystem({ layout: 'foto', page: '2', total: '7' }, brand, null, measure, { bgImage: px }); assert.ok(foto.svg.includes('<image href="data:image/png') && !foto.overflow && foto.layout === 'foto'); ok('slide "foto": só a foto com a marca')
const solo = svgSlideSystem({ layout: 'capa', title: 'Ipanema', page: '1', total: '1' }, brand, null, measure, { bgImage: px }); assert.ok(!solo.svg.includes('1/1') && !solo.svg.includes('arraste')); ok('peça de 1 slide: sem "1/1" nem "arraste"')

// ── variação de enfeite por página (cor do kit, posição) ─────────────────────────────────────────────────────────
const kit = { primary: '#FF6D29', primary2: '#2255CC', accent: '#FFD400', name: 'K', bg: '#0E0B0A', text: '#ffffff' }
const circles = [1, 2, 3, 4].map(p => svgSlideSystem({ layout: 'destaque', text: 'oi', page: String(p), total: '5' }, kit, null, measure).svg.match(/<circle cx="(\d+)" cy="(\d+)" r="(\d+)" fill="(#[0-9a-fA-F]+)"/)?.slice(1).join(','))
assert.equal(new Set(circles).size, 4); ok('posição/cor do enfeite mudam a cada página')
const same = { primary: '#0E0B0A', name: 'Tespon', bg: '#0E0B0A', text: '#ffffff' }   // primária = fundo
const s1 = svgSlideSystem({ layout: 'destaque', text: 'oi', page: '1', total: '3' }, same, null, measure); assert.ok(!s1.svg.includes('fill="#0E0B0A" fill-opacity="0.07"')); ok('kit com primária = fundo não usa a primária (cai no texto/sublinhado)')

// ── nunca 3 layouts iguais seguidos ──────────────────────────────────────────────────────────────────────────────
const raw = [{ layout: 'capa', title: 'C' }, ...Array.from({ length: 4 }, (_, i) => ({ layout: 'lista', title: `L${i}`, items: 'a\nb' })), { layout: 'fecho', title: 'F', cta: 'Oi' }]
const d = normalizeDeck(raw, 'Oi'); const mid = d.slice(1, -1).map(s => s.layout)
for (let i = 2; i < mid.length; i++) assert.ok(!(mid[i] === mid[i - 1] && mid[i] === mid[i - 2]), mid.join()); ok(`3 listas seguidas viram lista/passos alternados (${mid.join(' ')})`)
assert.deepEqual(varyLayouts([{ layout: 'destaque', title: '', text: 'a', items: '', highlight: '', cta: '' }]).map(s => s.layout), ['destaque']); ok('varyLayouts não mexe no que não tem irmão')

// ── nota da foto (PR A) tolerante ────────────────────────────────────────────────────────────────────────────────
assert.equal(photoScore({ url: 'u', quality: 7.5 }), 7.5); assert.equal(photoScore({ url: 'u', score: '8' }), 8); assert.equal(photoScore({ url: 'u', quality: { score: 6 } }), 6); assert.equal(photoScore({ url: 'u' }), null); assert.equal(photoScore({ url: 'u', quality: 'boa' }), null); assert.equal(photoScore({ url: 'u', quality: 0 }), 0); ok('nota lida de score/quality (número, texto, objeto); sem nota = null')
const P = (u, q) => ({ url: `https://x/${u}.jpg`, ...(q === undefined ? {} : { quality: q }) })
assert.equal(pickCoverPhoto([P('a'), P('b'), P('c')]).url, 'https://x/a.jpg'); ok('sem nota nenhuma: photos[0] (nunca sorteia)')
assert.equal(pickCoverPhoto([P('a', 3), P('b', 9), P('c', 9)]).url, 'https://x/b.jpg'); ok('com nota: a de maior nota (empate = a primeira)')
assert.equal(pickCoverPhoto([P('a'), P('b', 5)]).url, 'https://x/b.jpg'); ok('foto sem nota não ganha de foto com nota')
assert.equal(pickCoverPhoto([]), null)
assert.deepEqual(pickMiddlePhotos([P('a', 3), P('b', 9), P('c', 5), P('d', 7)], P('b', 9), 2).map(p => p.url), ['https://x/d.jpg', 'https://x/c.jpg']); ok('fotos do meio: as melhores depois da capa')

// ── oferta ───────────────────────────────────────────────────────────────────────────────────────────────────────
assert.equal(formatPrice('1500000'), 'R$ 1.500.000'); assert.equal(formatPrice('R$ 980.000'), 'R$ 980.000'); assert.equal(formatPrice('1.500.000'), 'R$ 1.500.000'); assert.equal(formatPrice(''), ''); assert.equal(formatPrice('—'), ''); assert.equal(formatPrice(null), ''); assert.equal(formatPrice('0'), ''); const FP = { '1,5 mi': 'R$ 1.500.000', '1.5 mi': 'R$ 1.500.000', '850 mil': 'R$ 850.000', 'R$ 2 milhões': 'R$ 2.000.000', '2 milhao': 'R$ 2.000.000', '1.5 million': 'R$ 1.500.000', '900k': 'R$ 900.000', 'R$ 1,5 mi': 'R$ 1.500.000', '1.500.000,00': 'R$ 1.500.000', '12.5': '', '1,500': '', '1.5.3': '', 'abc': '', 'null': '', 'undefined': '', '12,50': '', '1,2345 mi': '' }
for (const [i, o] of Object.entries(FP)) assert.equal(formatPrice(i), o, i)
assert.equal(formatPrice(undefined), ''); ok('preço: formata o que existe, lê mi/mil/milhão/k e nunca vira "R$ —" (formato ambíguo = não mostra)')
assert.deepEqual(dataLines({ quartos: 'null', bairro: 'undefined', vagas: '—', preco: '—' }), []); ok('"null"/"undefined"/"—" do cadastro não aparecem')
const photos = Array.from({ length: 9 }, (_, i) => P(`f${i}`))
const full = buildOfferSlides({ photos, fields: { tipo: 'Apartamento', bairro: 'Ipanema', quartos: '3', m2: '120', vagas: '1', preco: '1500000' }, cta: 'Me chama no direct' })
assert.equal(full.length, 7); assert.deepEqual(full.map(s => s.kind), ['capa', 'foto', 'foto', 'foto', 'foto', 'dados', 'fecho']); ok('oferta: no máximo 7 slides (capa + 4 fotos + dados + fecho)')
assert.equal(full[0].fields.title, 'Apartamento Ipanema')   // "Tipo Bairro", sem "em" (dono, 2026-11-11); assert.equal(full[0].fields.text, '3 quartos · R$ 1.500.000'); assert.equal(full.at(-1).fields.cta, 'Me chama no direct'); ok('capa com tipo, bairro, quartos e preço; fecho com o CTA seguro')
assert.equal(full[0].photo, 'https://x/f0.jpg'); ok('capa sem nota: photos[0]')
assert.equal(buildOfferSlides({ photos: [P('a', 2), P('b', 9), P('c', 4), P('d', 5), P('e', 1), P('f', 3)], fields: { bairro: 'Leblon' }, cta: 'x' })[0].photo, 'https://x/b.jpg'); ok('capa com nota: a melhor')
const semPreco = buildOfferSlides({ photos, fields: { tipo: 'Casa', bairro: 'Barra', quartos: '1', preco: '' }, cta: 'x' })
assert.equal(semPreco[0].fields.text, '1 quarto'); assert.ok(!JSON.stringify(semPreco).includes('R$')); assert.ok(!JSON.stringify(semPreco).includes('—')); ok('sem preço: nada de "R$ —"')
assert.equal(buildOfferSlides({ photos, fields: { tipo: 'Casa' }, cta: 'x' }).some(s => s.kind === 'dados'), false); ok('dados com menos de 2 campos: slide de dados não entra')
assert.deepEqual(dataLines({ quartos: '2', m2: '7373', bairro: 'Centro' }), ['Quartos: 2', 'Bairro: Centro']); ok('m² incoerente (7373) não aparece')
assert.equal(buildOfferSlides({ photos: [], fields: {}, cta: 'x' }).length, 0)
const comStaged = buildOfferSlides({ photos, staged: [P('s1'), P('s2'), P('s3')], fields: { tipo: 'Casa', bairro: 'Barra' }, cta: 'x' })
assert.equal(comStaged.filter(s => s.kind === 'foto').length, 4); assert.deepEqual(comStaged.filter(s => s.kind === 'foto').slice(0, 2).map(s => s.photo), ['https://x/s1.jpg', 'https://x/s2.jpg']); ok('fotos mobiliadas (se liberadas) ocupam vagas do meio, no máximo 2')

// ── bairro ───────────────────────────────────────────────────────────────────────────────────────────────────────
const near = buildNearbySlides({ photo: P('a'), bairro: 'Botafogo', places: ['Metrô · Botafogo', 'Praia de Botafogo', 'Mercado X'], cta: 'Me chama' })
assert.deepEqual(near.map(s => s.fields.layout), ['capa', 'lista', 'fecho']); assert.equal(near[1].fields.items.split('\n').length, 3); assert.equal(near[2].fields.cta, 'Me chama'); ok('3 coisas perto: capa com foto real, lista dos 3 lugares, fecho com CTA')
assert.equal(buildNearbySlides({ photo: P('a'), bairro: 'x', places: ['a', 'b'], cta: 'x' }).length, 0); assert.equal(buildNearbySlides({ photo: null, bairro: 'x', places: ['a', 'b', 'c'], cta: 'x' }).length, 0); ok('menos de 3 lugares (ou sem foto): não monta o carrossel')

// ── tema repetido ────────────────────────────────────────────────────────────────────────────────────────────────
const used = ['R$ 1,5 mi: Barra ou Leblon?', 'Como financiar o primeiro imóvel']
assert.ok(findRepeatedTheme('Barra vs Leblon: onde R$ 1,5 mi rende mais', used)); assert.ok(findRepeatedTheme('Leblon ou Barra com 1,5 mi', used)); ok('mesma comparação com outras palavras = repetido')
assert.equal(findRepeatedTheme('Documentos para vender seu imóvel', used), null); assert.equal(findRepeatedTheme('Financiamento: o que muda na taxa', used), null); ok('assunto novo não é barrado')
assert.deepEqual(recentThemes([{ idea: 'Barra ou Leblon com 1,5 mi' }, { idea: 'Leblon vs Barra: R$ 1,5 mi' }, { idea: 'Dicas de documentação' }, { idea: null }]), ['Barra ou Leblon com 1,5 mi', 'Dicas de documentação']); ok('lista de temas recentes sem duplicata, só com texto')
assert.match(themeBlock(used), /NÃO repita o mesmo tema/); assert.equal(themeBlock([]), ''); ok('bloco do prompt do Diretor')

// capa pelos cômodos da ficha (Teste Zero 2026-11-03: notas empatadas → banheiro com toalhas na capa)
{
  const R = (n, room, q = 80) => ({ url: `https://x/${n}.jpg`, room, quality: q })
  const rooms = { priority: ['fachada', 'vista', 'sala', 'varanda', 'cozinha', 'sala_jantar', 'quarto', 'hall'], avoid: ['banheiro', 'corredor', 'area_servico'] }
  const cob = [R('ban1', 'banheiro'), R('hall', 'hall'), R('q1', 'quarto', 68), R('ban2', 'banheiro'), R('q2', 'quarto')]
  assert.equal(pickCoverPhoto(cob).url, 'https://x/ban1.jpg') // sem ficha: comportamento antigo
  assert.equal(pickCoverPhoto(cob, rooms).url, 'https://x/q2.jpg') // quarto (maior nota) antes de hall; banheiro nunca
  assert.equal(pickCoverPhoto([R('ban', 'banheiro', 95), R('sala', 'sala', 60)], rooms).url, 'https://x/sala.jpg')
  assert.equal(pickCoverPhoto([R('ban', 'banheiro')], rooms).url, 'https://x/ban.jpg') // só tem o que evitar: usa (nunca vazio)
  assert.equal(buildOfferSlides({ photos: cob, fields: { tipo: 'Cobertura', bairro: 'Leblon' }, cta: 'x', rooms })[0].photo, 'https://x/q2.jpg')
}
ok('capa segue os cômodos da ficha: evita banheiro, prefere a ordem, depois a nota')

console.log(`\n${n} verificações ok`)
