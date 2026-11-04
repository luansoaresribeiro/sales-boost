// node --experimental-strip-types scripts/test-trend-ignore.mjs
import assert from 'node:assert/strict'
import { normTrendTitle, dropIgnoredTitles } from '../supabase/functions/_shared/trendIgnore.ts'

assert.equal(normTrendTitle('  Reels  de   Bastidores '), 'reels de bastidores')
assert.equal(normTrendTitle('Tendência Ação'), 'tendencia acao')
const rows = [{ title: 'Carrossel Educativo' }, { title: 'Reels de bastidores' }]
assert.deepEqual(dropIgnoredTitles(rows, ['carrossel  educativo']), [{ title: 'Reels de bastidores' }])
assert.deepEqual(dropIgnoredTitles(rows, ['REELS DE BASTIDORES']), [{ title: 'Carrossel Educativo' }])
assert.deepEqual(dropIgnoredTitles(rows, []), rows)
assert.deepEqual(dropIgnoredTitles(rows, ['']), rows)
console.log('test-trend-ignore ok')
