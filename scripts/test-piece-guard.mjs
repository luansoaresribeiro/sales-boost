import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
// Roda: node --experimental-strip-types scripts/test-piece-guard.mjs
// A.6 (2026-11-07): peça sem imagem, modelo do Diretor, afirmação de tendência sem fonte (pieceGuard.ts + claimLock.qualityFlags).
import { fallbackCardPlan, hasMarketSource, hasUsableImage, needsImage, parseTrendCfg, pieceTrendIssues, resolveTemplate, trendNotice, trendPromptRule } from '../supabase/functions/_shared/pieceGuard.ts'
import { qualityFlags } from '../supabase/functions/_shared/claimLock.ts'
let n = 0; const ok = (m) => { n++; console.log('ok -', m) }

// ── 1) peça sem imagem ───────────────────────────────────────────────────────
// O caso real (Teste Zero 3840d8d7): carrossel, image_url null, slides sem imagem.
assert.equal(hasUsableImage({ image_url: null, slides: [] }), false)
assert.equal(hasUsableImage({ image_url: null, slides: null }), false)
assert.equal(hasUsableImage({ image_url: null, slides: [{ text: 'a', image_prompt: 'x', image_url: null }, { text: 'b', image_url: '' }] }), false)
assert.equal(hasUsableImage({ image_url: '', slides: [], media: [] }), false)
assert.equal(hasUsableImage({ image_url: 'https://x.supabase.co/a.png' }), true)
assert.equal(hasUsableImage({ image_url: null, slides: [{ image_url: null }, { image_url: 'https://x/s2.png' }] }), true)
assert.equal(hasUsableImage({ image_url: null, media: [{ url: 'https://x/m.png', type: 'photo' }] }), true)
assert.equal(hasUsableImage({ video_url: 'https://x/v.mp4' }), true)
assert.equal(hasUsableImage({ image_url: 'javascript:alert(1)' }), false)
ok('peça sem nenhuma imagem utilizável é detectada (sem image_url, slides sem imagem, mídia vazia); com capa/slide/mídia/vídeo passa')
assert.ok(needsImage('foto') && needsImage('carrossel') && !needsImage('reel') && !needsImage('story') && !needsImage(null))
ok('só foto/carrossel exigem imagem (vídeo tem fluxo próprio)')

const cap = (s, k) => s.slice(0, k)
const noFaq = fallbackCardPlan({ directorTemplate: 'faq', post: { cta: 'Chama no direct' }, idea: 'O que ninguém te conta antes de comprar na Zona Sul', caption: 'x', brand: 'Teste Zero', cap })
assert.equal(noFaq.template, 'photo'); assert.equal(noFaq.fields.headline, 'O que ninguém te conta antes de comprar na Zona Sul'); assert.equal(noFaq.fields.cta, 'Chama no direct')
const withFaq = fallbackCardPlan({ directorTemplate: 'faq', post: { card_question: 'Pergunta?', card_answer: 'Resposta.' }, idea: 'i', brand: 'B', cap })
assert.equal(withFaq.template, 'faq'); assert.deepEqual(withFaq.fields, { question: 'Pergunta?', answer: 'Resposta.' })
const dirOther = fallbackCardPlan({ directorTemplate: 'tweet', post: { card_question: 'P?', card_answer: 'R.' }, idea: 'i', brand: 'B', cap })
assert.equal(dirOther.template, 'photo')
const onlyBrand = fallbackCardPlan({ post: {}, brand: 'Marca X', cap })
assert.equal(onlyBrand.fields.headline, 'Marca X')
ok('fallback = card renderizado (faq quando o Diretor escolheu faq e há pergunta/resposta; senão card "photo" com a manchete — texto só via render)')

// A trava no creative-generate (sem Deno: confere o código-fonte): sem imagem → apaga + registra + lança; nunca chega no score/Vault.
const src = readFileSync(new URL('../supabase/functions/creative-generate/index.ts', import.meta.url), 'utf8')
const iGuard = src.indexOf("!hasUsableImage({ image_url: mainImage, slides })"), iScore = src.indexOf('autoVault = await scoreTestContent')
assert.ok(iGuard > 0 && iScore > iGuard, 'a trava vem ANTES da avaliação que manda pro Vault')
const guardBlock = src.slice(iGuard, iScore)
assert.match(guardBlock, /\.delete\(\)\.eq\('id', inserted\.id\)/); assert.match(guardBlock, /content_no_image/); assert.match(guardBlock, /throw new Error/)
assert.match(src.slice(0, iGuard), /if \(!mainImage && \(fmt !== 'carrossel' \|\| !opts\.skipImage\)\)/, 'fallback de card vale pro carrossel sem slide')
ok('creative-generate: fallback de card → se ainda sem imagem, apaga a peça, registra content_no_image e falha ANTES do score/Vault')

// ── 1a) modelo escolhido pelo Diretor ────────────────────────────────────────
const keys = ['tweet', 'product', 'problem', 'faq', 'trend', 'livre']
let r = resolveTemplate({ directorTemplate: 'faq', forced: null, deck: true, format: 'carrossel', templateKeys: keys })
assert.equal(r.template, 'livre'); assert.equal(r.format, 'carrossel'); assert.equal(r.directorTemplate, 'faq'); assert.match(r.note, /"faq" não se aplica/)
ok('educativo (deck): modelo vira "livre" por desenho, MAS a escolha do Diretor fica gravada (director_template) e a troca é explicada')
r = resolveTemplate({ directorTemplate: 'faq', forced: null, deck: false, format: 'carrossel', templateKeys: keys })
assert.equal(r.template, 'faq'); assert.equal(r.note, null)
ok('carrossel fora do deck: o modelo do Diretor é mantido')
r = resolveTemplate({ directorTemplate: 'inventado', forced: null, deck: false, format: 'carrossel', templateKeys: keys })
assert.equal(r.template, 'livre'); assert.equal(r.directorTemplate, null)
ok('modelo inválido cai em "livre" sem virar director_template')
r = resolveTemplate({ directorTemplate: 'faq', forced: 'trend', deck: false, format: 'carrossel', templateKeys: keys })
assert.equal(r.template, 'trend'); assert.equal(r.format, 'foto'); assert.match(r.note, /botão/)
ok('escolha manual do dono vence e força foto')
r = resolveTemplate({ directorTemplate: 'faq', forced: null, deck: false, format: 'foto', templateKeys: keys, lastTemplate: 'faq' })
assert.equal(r.template, 'trend'); assert.match(r.note, /rotação automática/); assert.equal(r.directorTemplate, 'faq')
r = resolveTemplate({ directorTemplate: 'trend', forced: null, deck: false, format: 'foto', templateKeys: keys, lastTemplate: 'faq' })
assert.equal(r.template, 'trend'); assert.equal(r.note, null)
ok('foto automática: rotação (decisão do dono) troca com aviso; se já coincide com o Diretor, sem aviso')

// ── 2) afirmação de tendência de mercado sem fonte ───────────────────────────
// Lista da FICHA de verdade: lida da migration (como a ficha de produção ficará).
const mig = readFileSync(new URL('../supabase/migrations/20261107120000_tendencia_mercado_ficha.sql', import.meta.url), 'utf8')
const fichaJson = JSON.parse(mig.split('$json$')[1])
const cfg = parseTrendCfg(fichaJson.pt)
assert.ok(cfg && cfg.terms.length > 10 && cfg.opinion.length > 3)
assert.equal(parseTrendCfg(undefined), null); assert.equal(parseTrendCfg({ terms: [] }), null)
ok('ficha lida da migration; sem lista = trava desligada')

// Texto REAL da peça e186633d (Tespon).
const real = [
  'Locatários com renda mais alta estão escolhendo contratos mais longos.',
  'Isso reduz a rotatividade e o custo de vacância para o proprietário.',
]
const issues = pieceTrendIssues(real, cfg, false)
assert.equal(issues.length, 2, JSON.stringify(issues))
ok('o texto real da Tespon é marcado (as 2 frases) quando não há sinal de mercado ligado')
const note = trendNotice(issues)
assert.match(note, /^Precisa de fonte: “Locatários com renda mais alta/)
assert.deepEqual(qualityFlags({ reasoning: `Ok. ${note}`, slides: [] }).map(f => f.key), ['tendencia_sem_fonte'])
ok('o aviso "Precisa de fonte:" vira motivo de nota baixa (qualityFlags → -25 e não vai sozinha pro Vault)')

const signal = { market_context: { evidence: [{ id: 's1', title: 'Procura por contratos longos sobe em bairros da Zona Sul', source_name: 'Portal X', source_url: 'https://portal.example/n' }] } }
assert.equal(hasMarketSource(signal), true)
assert.deepEqual(pieceTrendIssues(real, cfg, hasMarketSource(signal)), [])
ok('o mesmo texto COM sinal de mercado com fonte ligado passa')
assert.equal(hasMarketSource({ market_context: { evidence: [{ id: 's1', title: 't', source_name: null, source_url: null }] } }), false)
assert.equal(hasMarketSource(null), false); assert.equal(hasMarketSource({}), false)
ok('sinal sem nome nem link de fonte não conta como fonte')

assert.deepEqual(pieceTrendIssues(['Na minha experiência, quem aluga costuma pedir contrato mais longo; vale conferir as condições.'], cfg, false), [])
assert.deepEqual(pieceTrendIssues(['Antes de fechar, confira a documentação do imóvel e peça a matrícula atualizada.'], cfg, false), [])
assert.deepEqual(pieceTrendIssues(['Locatários estão escolhendo contratos mais longos.'], null, false), [])
ok('texto em tom de opinião/orientação passa; texto neutro passa; ficha sem lista não barra nada')

// Prompt
assert.equal(trendPromptRule(null, []), '')
const rNo = trendPromptRule(cfg, [])
assert.match(rNo, /NENHUM sinal de mercado/); assert.match(rNo, /opinião do corretor/)
const rYes = trendPromptRule(cfg, signal.market_context.evidence, '• ')
assert.match(rYes, /^• AFIRMAÇÃO SOBRE O MERCADO/); assert.match(rYes, /fonte: Portal X/); assert.doesNotMatch(rYes, /NENHUM sinal/)
ok('prompt: sem sinal = orientação do corretor; com sinal = só ele sustenta fato; sem ficha = prompt idêntico')

// Integração no creative-generate (sem Deno): o aviso entra antes do insert, e o regulado conta como fonte.
assert.match(src, /trendPromptRule\(claimCfg\.trends/); assert.match(src, /pieceTrendIssues\(texts, claimCfg\.trends, trendSourced\)/); assert.match(src, /topic\?\.mode === 'regulado'/)
ok('creative-generate liga prompt + checagem (regulado conta como fonte oficial)')

// qualityFlags: carrossel que virou card único também baixa a nota; peça normal não.
assert.deepEqual(qualityFlags({ reasoning: 'Atenção: os slides não saíram. Troquei o carrossel por um card único com o tema.', slides: null }).map(f => f.key), ['card_no_lugar'])
assert.deepEqual(qualityFlags({ reasoning: 'Tudo certo.', slides: [] }), [])
ok('card único no lugar do carrossel baixa a nota; peça normal não')

console.log(`\n${n} verificações ok`)
