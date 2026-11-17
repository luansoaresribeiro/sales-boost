// Roda: node --experimental-strip-types scripts/test-us-ficha.mjs
// E1 (17/11): ficha dos EUA — notícias na cidade da empresa, slides em inglês e em dólar, ficha nova só acrescenta.
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
const { cityFor } = await import('../supabase/functions/_shared/marketNewsRun.ts')
const { formatPrice, formatUsd, dataLines, buildOfferSlides, buildNearbySlides } = await import('../supabase/functions/_shared/carouselOffer.ts')

// Cidade: a da ficha manda (Rio); ficha sem cidade usa a da empresa (EUA).
assert.equal(cityFor('Rio de Janeiro', 'Boynton Beach, Florida'), 'Rio de Janeiro')
assert.equal(cityFor('', 'Boynton Beach, Florida'), 'Boynton Beach, Florida')
assert.equal(cityFor('', null), '')

// Dólar
const US = { lang: 'en', currency: '$' }
assert.equal(formatUsd('1250000'), '$1,250,000')
assert.equal(formatUsd('$1,250,000'), '$1,250,000')
assert.equal(formatUsd('1.25 million'), '$1,250,000')
assert.equal(formatUsd('850k'), '$850,000')
assert.equal(formatUsd('1.250.000'), '')            // formato brasileiro nos EUA: ambíguo, não mostra
assert.equal(formatPrice('1500000', US), '$1,500,000')
// Reais continuam iguais (padrão)
assert.equal(formatPrice('1.500.000'), 'R$ 1.500.000')
assert.equal(formatPrice('1,5 mi'), 'R$ 1.500.000')

// Slide de dados em inglês, área em sq ft
const f = { tipo: 'Condo', bairro: 'Boynton Beach', quartos: '2', m2: '1250', vagas: '1', preco: '425000' }
const lines = dataLines(f, US)
assert.deepEqual(lines, ['Bedrooms: 2', 'Area: 1,250 sq ft', 'Parking: 1', 'Neighborhood: Boynton Beach', 'Price: $425,000'])
assert.ok(!lines.join(' ').match(/R\$|Quartos|Preço|m²/))
// Português continua igual
assert.deepEqual(dataLines({ quartos: '3', m2: '120', bairro: 'Leblon', preco: '2000000' }), ['Quartos: 3', 'Área: 120 m²', 'Bairro: Leblon', 'Preço: R$ 2.000.000'])

const photos = [1, 2, 3, 4, 5].map(i => ({ url: `https://x/${i}.jpg`, quality: 80 + i }))
const slides = buildOfferSlides({ photos, fields: f, cta: 'Send me a DM', locale: US })
assert.equal(slides[0].fields.text, '2 bedrooms · $425,000')
assert.equal(slides.find(s => s.kind === 'dados').fields.title, 'The details')
const near = buildNearbySlides({ photo: photos[0], bairro: 'Boynton Beach', places: ['Beach', 'Park', 'Mall'], cta: 'x', locale: US })
assert.equal(near[0].fields.title, '3 things nearby')
assert.equal(near[2].fields.title, 'Living in Boynton Beach')

// catalog-package e o cron de notícias usam a cidade/moeda/idioma
const cp = readFileSync('supabase/functions/catalog-package/index.ts', 'utf8')
assert.ok(cp.includes('locale: slideLocale })') && cp.includes("currency: typeof c.currency === 'string'"))
assert.ok(cp.includes('Preço: ${ficha.currency} ${fields.preco'))
const mi = readFileSync('supabase/functions/_shared/marketIntelCron.ts', 'utf8')
assert.ok(mi.includes("select('id, vertical_key, language, city')") && mi.includes('companyCity: c.city ?? null'))

// Migration só acrescenta: ficha nova + tipo de negócio novo; não toca a do Rio
const mig = readFileSync('supabase/migrations/20261117190000_ficha_eua.sql', 'utf8')
assert.ok(mig.includes("select 'imoveis_us', 'Real estate · USA'") && mig.includes('on conflict (key) do nothing'))
assert.ok(mig.includes("'Realtor (EUA)', 'imoveis_us'"))
assert.ok(mig.includes('"block_publish_without": false') && mig.includes("'currency', '$'") && mig.includes("'default_language', 'en'"))
assert.ok(!/update\s+vertical_playbooks|delete\s+from\s+vertical_playbooks\s+where\s+key\s*=\s*'imoveis_rio'/i.test(mig.replace(/^--.*$/gm, '')))
console.log('ok — ficha dos EUA: cidade da empresa nas notícias, slides em inglês e dólar, migration só acrescenta')
// A área vai para a IA na unidade do mercado (EUA = sq ft)
assert.ok(readFileSync('supabase/functions/catalog-package/index.ts', 'utf8').includes("${ficha.currency === '$' ? ' sq ft' : 'm²'}"))
console.log('ok — área na unidade do mercado')
