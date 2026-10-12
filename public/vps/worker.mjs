// Estúdio de vídeo do Sales Boost — roda na VPS do dono (Hostinger), instalado
// por https://getsaleboost.com/vps/install.sh. Sem dependências: Node 20 + ffmpeg.
// Pede trabalho pra função vps-worker, monta o vídeo com ffmpeg e sobe o
// resultado por URL assinada. Nunca tem as chaves mestras do sistema: só o
// token próprio (WORKER_TOKEN), que o dono pode desligar na tela.
// Decisão do dono 2026-10-12 (docs/DECISIONS.md); detalhes em docs/MEDIA-ENGINE.md.
import { spawn } from 'node:child_process'
import { createHash } from 'node:crypto'
import { createWriteStream } from 'node:fs'
import { mkdir, readFile, rm, stat, statfs, writeFile, rename } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import { fileURLToPath } from 'node:url'

const SELF = fileURLToPath(import.meta.url)
const HOME = path.dirname(SELF)
const TMP = path.join(HOME, 'tmp')
const SOURCE_URL = 'https://getsaleboost.com/vps/worker.mjs'
const POLL_MS = 10_000
const HEARTBEAT_MS = 60_000
const UPDATE_MS = 60 * 60_000
const JOB_TIMEOUT_MS = 10 * 60_000
// Formato do Reel (vertical) e acabamento.
const W = 1080, H = 1920, FPS = 30, FADE_IN = 0.3, FADE_OUT = 0.4, XFADE = 0.5

const log = (...a) => console.log(new Date().toISOString(), ...a)
const sleep = ms => new Promise(r => setTimeout(r, ms))

async function api(baseUrl, token, action, body = {}) {
  const res = await fetch(`${baseUrl}/functions/v1/vps-worker`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...(token ? { 'x-worker-token': token } : {}) },
    body: JSON.stringify({ action, ...body }),
    signal: AbortSignal.timeout(60_000),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw Object.assign(new Error(data.error || `HTTP ${res.status}`), { status: res.status })
  return data
}

function run(cmd, args, timeoutMs = JOB_TIMEOUT_MS) {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'] })
    let out = '', err = ''
    p.stdout.on('data', d => { out += d })
    p.stderr.on('data', d => { err = (err + d).slice(-4000) })
    const t = setTimeout(() => p.kill('SIGKILL'), timeoutMs)
    p.on('error', e => { clearTimeout(t); reject(e) })
    p.on('close', code => { clearTimeout(t); code === 0 ? resolve(out) : reject(new Error(`${cmd} saiu com ${code}: ${err.slice(-600)}`)) })
  })
}

async function ffmpegVersion() {
  try { return (await run('ffmpeg', ['-version'], 10_000)).split('\n')[0].replace('ffmpeg version ', '').split(' Copyright')[0].slice(0, 60) } catch { return null }
}

let jobsDone = 0
async function info() {
  let diskFree = null
  try { const s = await statfs(HOME); diskFree = Math.round((s.bavail * s.bsize) / 1e9 * 10) / 10 } catch { /* ok */ }
  let osName = `${os.type()} ${os.release()}`
  try { osName = (await readFile('/etc/os-release', 'utf8')).match(/PRETTY_NAME="([^"]+)"/)?.[1] ?? osName } catch { /* ok */ }
  return {
    os: osName, arch: os.arch(), cpus: os.cpus().length,
    mem_total_mb: Math.round(os.totalmem() / 1048576), mem_free_mb: Math.round(os.freemem() / 1048576),
    disk_free_gb: diskFree, load1: Math.round(os.loadavg()[0] * 100) / 100,
    ffmpeg: await ffmpegVersion(), node: process.version, version: await selfHash(), jobs_done: jobsDone,
  }
}

async function selfHash() {
  return createHash('sha256').update(await readFile(SELF)).digest('hex').slice(0, 12)
}

async function download(url, dest) {
  const res = await fetch(url, { signal: AbortSignal.timeout(120_000) })
  if (!res.ok || !res.body) throw new Error(`download ${res.status}: ${url.slice(0, 80)}`)
  await pipeline(Readable.fromWeb(res.body), createWriteStream(dest))
}

async function upload(signedUrl, file, contentType) {
  const buf = await readFile(file)
  const res = await fetch(signedUrl, { method: 'PUT', headers: { 'content-type': contentType, 'x-upsert': 'true' }, body: buf, signal: AbortSignal.timeout(180_000) })
  if (!res.ok) throw new Error(`upload ${res.status}: ${(await res.text()).slice(0, 200)}`)
  return buf.length
}

async function duration(file) {
  const out = await run('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=nw=1:nk=1', file], 30_000)
  const d = Number(out.trim())
  if (!Number.isFinite(d) || d <= 0) throw new Error('não consegui ler a duração do trecho')
  return d
}

// Monta um Reel: cada trecho vira vertical 1080×1920 (o vídeo inteiro no meio,
// fundo com o próprio vídeo desfocado — nada é cortado nem inventado), trechos
// emendados com fusão, entrada/saída suaves e trilha de áudio muda (AAC).
async function finishReel(clips, outFile) {
  const durs = []
  for (const c of clips) durs.push(await duration(c))
  const parts = clips.map((_, i) =>
    `[${i}:v]split=2[b${i}][f${i}];` +
    `[b${i}]scale=${W}:${H}:force_original_aspect_ratio=increase,crop=${W}:${H},boxblur=20:2,eq=brightness=-0.08[bg${i}];` +
    `[f${i}]scale=${W}:${H}:force_original_aspect_ratio=decrease[fg${i}];` +
    `[bg${i}][fg${i}]overlay=(W-w)/2:(H-h)/2,fps=${FPS},format=yuv420p,setsar=1,settb=AVTB[v${i}]`)
  let last = 'v0', total = durs[0]
  for (let i = 1; i < clips.length; i++) {
    const x = Math.min(XFADE, durs[i] / 2, total / 2)
    parts.push(`[${last}][v${i}]xfade=transition=fade:duration=${x.toFixed(3)}:offset=${(total - x).toFixed(3)}[x${i}]`)
    total = total + durs[i] - x
    last = `x${i}`
  }
  parts.push(`[${last}]fade=t=in:st=0:d=${FADE_IN},fade=t=out:st=${Math.max(0, total - FADE_OUT).toFixed(3)}:d=${FADE_OUT}[out]`)
  const args = ['-y', '-hide_banner', '-loglevel', 'error']
  for (const c of clips) args.push('-i', c)
  args.push('-f', 'lavfi', '-i', 'anullsrc=channel_layout=stereo:sample_rate=44100',
    '-filter_complex', parts.join(';'), '-map', '[out]', '-map', `${clips.length}:a`,
    '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '21', '-profile:v', 'high', '-level', '4.1', '-pix_fmt', 'yuv420p',
    '-r', String(FPS), '-threads', '2', '-c:a', 'aac', '-b:a', '128k', '-t', total.toFixed(3), '-movflags', '+faststart', outFile)
  await run('ffmpeg', args)
  return total
}

async function processJob(baseUrl, token, job) {
  const dir = path.join(TMP, job.id)
  await mkdir(dir, { recursive: true })
  try {
    if (job.kind !== 'reel_finish') throw new Error(`tipo de trabalho desconhecido: ${job.kind}`)
    const outputs = []
    for (const [oi, o] of (job.input.outputs ?? []).entries()) {
      const up = job.uploads.find(u => u.path === o.path)
      if (!up) throw new Error(`sem URL de envio pra ${o.path}`)
      const local = []
      for (const [ci, url] of (o.clips ?? []).entries()) {
        const f = path.join(dir, `in-${oi}-${ci}.mp4`)
        await download(url, f)
        local.push(f)
      }
      if (!local.length) throw new Error('trabalho sem trechos')
      const out = path.join(dir, `out-${oi}.mp4`)
      const total = await finishReel(local, out)
      const cover = path.join(dir, `out-${oi}.jpg`)
      await run('ffmpeg', ['-y', '-hide_banner', '-loglevel', 'error', '-ss', Math.min(1, total / 3).toFixed(2), '-i', out, '-frames:v', '1', '-q:v', '3', cover], 60_000)
      const bytes = await upload(up.upload_url, out, 'video/mp4')
      await upload(up.cover_upload_url, cover, 'image/jpeg')
      outputs.push({ path: o.path, duration: Math.round(total * 100) / 100, bytes })
    }
    await api(baseUrl, token, 'complete', { job_id: job.id, outputs })
    jobsDone++
    log('pronto', job.id, outputs.map(o => `${o.path} ${o.duration}s ${(o.bytes / 1e6).toFixed(1)}MB`).join(', '))
  } catch (e) {
    log('falhou', job.id, String(e).slice(0, 300))
    await api(baseUrl, token, 'fail', { job_id: job.id, error: String(e).slice(0, 500) }).catch(() => {})
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
}

// Atualiza a si mesmo a partir do site (mesma origem do instalador). Sai e o
// systemd reinicia já com a versão nova.
async function selfUpdate() {
  try {
    const res = await fetch(SOURCE_URL, { signal: AbortSignal.timeout(30_000) })
    if (!res.ok) return
    const code = await res.text()
    if (!code.includes('Estúdio de vídeo do Sales Boost')) return
    if (code === await readFile(SELF, 'utf8')) return
    await writeFile(SELF + '.new', code)
    await rename(SELF + '.new', SELF)
    log('versão nova instalada — reiniciando')
    process.exit(0)
  } catch (e) { log('atualização falhou', String(e).slice(0, 200)) }
}

async function main() {
  const [cmd, a1, a2] = process.argv.slice(2)
  if (cmd === 'enroll') {
    // Usado só pelo instalador: troca o código de 15 min pelo token.
    const baseUrl = a1, code = a2
    const { token } = await api(baseUrl, null, 'enroll', { code, name: os.hostname(), info: await info() })
    process.stdout.write(token)
    return
  }
  if (cmd === 'selftest') {
    // Monta um vídeo de teste local (sem rede) — usado pelo instalador.
    await mkdir(TMP, { recursive: true })
    const a = path.join(TMP, 'st-a.mp4'), b = path.join(TMP, 'st-b.mp4'), o = path.join(TMP, 'st-out.mp4')
    await run('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'lavfi', '-i', 'testsrc=size=1280x720:rate=24:duration=3', '-pix_fmt', 'yuv420p', a])
    await run('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'lavfi', '-i', 'testsrc2=size=1280x720:rate=24:duration=3', '-pix_fmt', 'yuv420p', b])
    const t = await finishReel([a, b], o)
    log('selftest ok', t.toFixed(2) + 's', ((await stat(o)).size / 1e6).toFixed(2) + 'MB')
    await rm(TMP, { recursive: true, force: true })
    return
  }

  const baseUrl = process.env.SUPABASE_URL, token = process.env.WORKER_TOKEN
  if (!baseUrl || !token) { console.error('SUPABASE_URL/WORKER_TOKEN ausentes'); process.exit(1) }
  await mkdir(TMP, { recursive: true })
  log('estúdio de vídeo ligado', await selfHash())
  let lastBeat = 0, lastUpdate = Date.now()
  for (;;) {
    try {
      if (Date.now() - lastBeat > HEARTBEAT_MS) { await api(baseUrl, token, 'heartbeat', { info: await info() }); lastBeat = Date.now() }
      const { job } = await api(baseUrl, token, 'claim')
      if (job) { await processJob(baseUrl, token, job); continue }
      if (Date.now() - lastUpdate > UPDATE_MS) { lastUpdate = Date.now(); await selfUpdate() }
    } catch (e) {
      log('erro', String(e).slice(0, 300))
      // Token desligado na tela: para de tentar (o systemd não insiste à toa).
      if (e.status === 401) { await sleep(10 * 60_000) }
    }
    await sleep(POLL_MS)
  }
}

main().catch(e => { console.error(e); process.exit(1) })
