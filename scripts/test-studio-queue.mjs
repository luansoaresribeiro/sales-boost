import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
// Roda: node scripts/test-studio-queue.mjs
// Sair da VPS (dono, 23/11): o estúdio roda no GitHub Actions em modo fila. Confere as peças no código.
let n = 0; const ok = (m) => { n++; console.log('ok -', m) }
const read = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8')
const eng = read('supabase/functions/_shared/tourEngine.ts')
assert.ok(/export async function studioQueueMode/.test(eng) && /eq\('key', 'studio_queue'\)/.test(eng)); ok('interruptor studio_queue lido no motor do tour')
assert.ok(/if \(await studioQueueMode\(admin\)\) return true/.test(eng)); ok('modo fila: tour com encerramento entra na fila sem servidor online')
assert.ok(/!queue && job\.status === 'queued'/.test(eng) && /QUEUE_MAX_WAIT_MS = 90 \* 60_000/.test(eng)); ok('modo fila: fila parada não vira "travado" antes de 90 min')
const w = read('public/vps/worker.mjs')
assert.ok(/cmd === 'once'/.test(w) && /'claim'/.test(w)); ok('worker tem a rodada única')
const wf = read('.github/workflows/video-studio.yml')
assert.ok(/cron: '\*\/10 \* \* \* \*'/.test(wf) && /worker\.mjs once/.test(wf) && /secrets\.WORKER_TOKEN/.test(wf)); ok('workflow a cada 10 min com o token do estúdio')
assert.ok(!/SERVICE_ROLE/.test(wf)); ok('workflow sem chave mestra')
const mon = read('supabase/functions/platform-monitor/index.ts')
assert.ok(/Estúdio no GitHub/.test(mon)); ok('monitor entende o modo fila')
console.log(`\n${n} testes ok`)
