// Roda: node --experimental-strip-types scripts/test-staging-check.mjs
// Frente 1, item 1.3c (20/11): trava do mobiliado — mudou arquitetura (ou dúvida) = recusa.
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
const { keepsArchitecture, parseStagingFacts, STAGING_PROMPT } = await import('../supabase/functions/_shared/stagingCheck.ts')

const F = (o) => ({ outdoor: 'no', roofAdded: 'no', wallsChanged: 'no', openingsChanged: 'no', viewChanged: 'no', floorChanged: 'no', ...o })
assert.equal(keepsArchitecture(F({})).ok, true)                                   // só móveis: passa
// O caso real de 20/11 (terraço da Tespon): teto, paredes e janela inventados → recusa com os motivos.
const tespon = keepsArchitecture(F({ outdoor: 'yes', roofAdded: 'yes', wallsChanged: 'yes', openingsChanged: 'yes', viewChanged: 'yes' }))
assert.equal(tespon.ok, false)
assert.deepEqual(tespon.reasons, ['criou ou tirou teto/cobertura', 'mudou paredes', 'mudou janelas ou portas', 'mudou a vista ou o céu'])
// Na dúvida, recusa.
assert.equal(keepsArchitecture(F({ wallsChanged: 'unsure' })).ok, false)
assert.match(keepsArchitecture(F({ floorChanged: 'unsure' })).reasons[0], /não deu para confirmar/)
// Área externa sozinha não recusa (só a mudança de arquitetura recusa).
assert.equal(keepsArchitecture(F({ outdoor: 'yes' })).ok, true)
// Leitura: última linha JSON; valor estranho vira "unsure" (e recusa).
const f = parseStagingFacts('descrição...\n{"outdoor":"no","roof_added":"no","walls_changed":"talvez","openings_changed":"no","view_changed":"no","floor_changed":"no"}')
assert.equal(f.wallsChanged, 'unsure')
assert.equal(keepsArchitecture(f).ok, false)
assert.equal(parseStagingFacts('sem json'), null)
assert.ok(STAGING_PROMPT.includes('Móveis, tapetes, plantas, quadros e objetos novos são PERMITIDOS'))

// A função usa a trava antes de liberar; o resultado só sai com a conferência aprovada; a tela mostra o motivo.
const vs = readFileSync('supabase/functions/virtual-staging/index.ts', 'utf8')
assert.ok(vs.includes('checkStaging(') && vs.includes("status: check.ok ? 'completed' : 'failed'"))
assert.ok(vs.includes("row.arch_check?.ok !== true") && vs.includes("code: 'architecture'"))
assert.ok(readFileSync('src/pages/dashboard/marketingAi/VirtualStaging.tsx', 'utf8').includes('tx.rejected('))
assert.ok(readFileSync('supabase/functions/_shared/stagingCheck.ts', 'utf8').includes("taskKey: 'ai_vision_staging_check'"))
const mig = readFileSync('supabase/migrations/20261120220000_staging_arch_check.sql', 'utf8')
assert.ok(/add column if not exists arch_check jsonb/.test(mig) && !/drop|delete|update/i.test(mig.replace(/^--.*$/gm, '')))
console.log('ok — trava do mobiliado: mudou arquitetura ou dúvida = recusa; caso do terraço da Tespon recusado')
