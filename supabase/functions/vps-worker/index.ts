import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Ponte entre o "estúdio de vídeo" na VPS da Hostinger e o Sales Boost
// (decisão do dono 2026-10-12, docs/DECISIONS.md). verify_jwt=false: cada
// lado se autentica aqui dentro.
//  - Dono (login com papel owner): status, enroll_start, revoke, set_enabled, test.
//  - Instalador (código de 15 min, uso único): enroll → devolve o token do trabalhador.
//  - Trabalhador (header x-worker-token): heartbeat, claim, complete, fail.
// O trabalhador nunca recebe a service role: só baixa trechos públicos e sobe
// o resultado por URL assinada que esta função gera pra cada trabalho.

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-worker-token',
}
const VIDEO_BUCKET = 'videos'
const COVER_BUCKET = 'post-images' // o bucket 'videos' só aceita vídeo
const FLAG = 'vps_reel_finish'
const ONLINE_MS = 2 * 60_000
const CODE_TTL_MS = 15 * 60_000
const INSTALL_URL = 'https://getsaleboost.com/vps/install.sh'
// sha256 do public/vps/worker.mjs publicado. O trabalhador só se atualiza
// sozinho pra um arquivo com exatamente este hash — invadir só o site não
// basta pra rodar código na VPS. AO MUDAR worker.mjs, ATUALIZAR AQUI
// (`sha256sum public/vps/worker.mjs`) e publicar esta função depois do merge.
const WORKER_SHA256 = '35afe7353632b42643267a3aa076f55ebe895c9c456d12fe18b5a788b1bd4ee4'
const UUID = /^[0-9a-f-]{36}$/i
// deno-lint-ignore no-explicit-any
type Any = any

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

async function sha256(text: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('')
}
function randomToken(bytes = 32): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(bytes))).map(b => b.toString(16).padStart(2, '0')).join('')
}
// Só guarda o que a tela mostra — nada vindo da VPS vira comando.
function cleanInfo(v: unknown): Record<string, unknown> {
  const i = (v && typeof v === 'object' ? v : {}) as Record<string, unknown>
  const num = (x: unknown) => (typeof x === 'number' && Number.isFinite(x) ? x : null)
  const str = (x: unknown) => (typeof x === 'string' ? x.slice(0, 120) : null)
  return {
    os: str(i.os), arch: str(i.arch), cpus: num(i.cpus), mem_total_mb: num(i.mem_total_mb), mem_free_mb: num(i.mem_free_mb),
    disk_free_gb: num(i.disk_free_gb), load1: num(i.load1), ffmpeg: str(i.ffmpeg), node: str(i.node), version: str(i.version),
    jobs_done: num(i.jobs_done),
  }
}

// Saídas do trabalho com URL de envio assinada (vídeo + capa).
async function signedUploads(admin: Any, outputs: { path: string }[]) {
  const out = []
  for (const o of outputs) {
    const cover = 'video-covers/' + o.path.replace(/\.mp4$/, '') + '.jpg'
    const [v, c] = await Promise.all([
      admin.storage.from(VIDEO_BUCKET).createSignedUploadUrl(o.path, { upsert: true }),
      admin.storage.from(COVER_BUCKET).createSignedUploadUrl(cover, { upsert: true }),
    ])
    if (v.error || c.error) throw new Error(`URL de envio: ${(v.error ?? c.error).message}`)
    out.push({ path: o.path, upload_url: v.data.signedUrl, cover_path: cover, cover_upload_url: c.data.signedUrl })
  }
  return out
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'Método não permitido' }, 405)

  try {
    const url = Deno.env.get('SUPABASE_URL')!
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? anonKey
    const admin = createClient(url, serviceKey)
    const body = await req.json().catch(() => ({})) as Record<string, unknown>
    const action = String(body.action ?? '')

    // ── Instalador: troca o código de 15 min pelo token do trabalhador ──
    if (action === 'enroll') {
      const code = String(body.code ?? '')
      if (code.length < 20 || code.length > 100) return json({ error: 'Código inválido.' }, 400)
      const { data: used } = await admin.from('worker_enrollments').update({ used_at: new Date().toISOString() })
        .eq('code_hash', await sha256(code)).is('used_at', null).gt('expires_at', new Date().toISOString())
        .select('id').maybeSingle()
      if (!used) return json({ error: 'Código vencido ou já usado. Gere outro em Configurações → Servidor.' }, 403)
      const token = randomToken()
      const name = String(body.name ?? 'vps').replace(/[^\w.-]/g, '').slice(0, 60) || 'vps'
      // Reinstalação na mesma máquina: o registro antigo deixa de valer.
      await admin.from('worker_nodes').update({ status: 'revoked' }).eq('name', name).eq('status', 'active')
      const { error } = await admin.from('worker_nodes').insert({ name, token_hash: await sha256(token), info: cleanInfo(body.info), last_seen_at: new Date().toISOString() })
      if (error) return json({ error: error.message }, 500)
      console.log('[vps-worker] servidor conectado:', name)
      return json({ ok: true, token })
    }

    // ── Trabalhador ──
    const workerToken = req.headers.get('x-worker-token')
    if (workerToken) {
      const { data: node } = await admin.from('worker_nodes').select('id, status').eq('token_hash', await sha256(workerToken)).maybeSingle()
      if (!node || node.status !== 'active') return json({ error: 'Servidor desconectado. Conecte de novo em Configurações → Servidor.' }, 401)
      const nowIso = new Date().toISOString()

      if (action === 'heartbeat') {
        await admin.from('worker_nodes').update({ last_seen_at: nowIso, info: cleanInfo(body.info) }).eq('id', node.id)
        return json({ ok: true, worker_sha256: WORKER_SHA256 })
      }
      if (action === 'claim') {
        await admin.from('worker_nodes').update({ last_seen_at: nowIso }).eq('id', node.id)
        const { data: rows, error } = await admin.rpc('claim_media_job', { p_worker: node.id })
        if (error) return json({ error: error.message }, 500)
        const job = (rows ?? [])[0]
        if (!job) return json({ job: null })
        try {
          const uploads = await signedUploads(admin, job.input?.outputs ?? [])
          return json({ job: { id: job.id, kind: job.kind, input: job.input, uploads } })
        } catch (e) {
          await admin.from('media_jobs').update({ status: 'queued', attempts: Math.max(0, job.attempts - 1), error: String(e).slice(0, 300), updated_at: nowIso }).eq('id', job.id)
          return json({ job: null })
        }
      }
      if (action === 'complete' || action === 'fail') {
        const jobId = String(body.job_id ?? '')
        if (!UUID.test(jobId)) return json({ error: 'job_id inválido' }, 400)
        const { data: job } = await admin.from('media_jobs').select('id, status, attempts, worker_id, video_tour_id, input')
          .eq('id', jobId).maybeSingle()
        if (!job || job.worker_id !== node.id || job.status !== 'running') return json({ error: 'Trabalho não é deste servidor.' }, 409)

        if (action === 'fail') {
          const error = String(body.error ?? 'erro').slice(0, 500)
          const status = job.attempts >= 3 ? 'failed' : 'queued'
          await admin.from('media_jobs').update({ status, error, locked_until: null, updated_at: nowIso }).eq('id', job.id)
          console.log('[vps-worker] trabalho falhou', job.id, job.attempts, error)
          return json({ ok: true, status })
        }

        // Confere que o arquivo existe mesmo antes de marcar pronto.
        const outputs = (Array.isArray(body.outputs) ? body.outputs : []) as { path?: string; duration?: number; bytes?: number }[]
        const expected = (job.input?.outputs ?? []) as { path: string }[]
        for (const o of expected) {
          const dir = o.path.split('/').slice(0, -1).join('/')
          const file = o.path.split('/').pop()
          const { data: list } = await admin.storage.from(VIDEO_BUCKET).list(dir, { search: file })
          if (!(list ?? []).some((f: { name: string }) => f.name === file)) {
            await admin.from('media_jobs').update({ status: job.attempts >= 3 ? 'failed' : 'queued', error: `arquivo não chegou: ${o.path}`, updated_at: nowIso }).eq('id', job.id)
            return json({ error: 'Arquivo não encontrado no Storage.' }, 409)
          }
        }
        const output = { outputs: outputs.map(o => ({ path: String(o.path ?? ''), duration: Number(o.duration) || null, bytes: Number(o.bytes) || null })) }
        await admin.from('media_jobs').update({ status: 'done', output, error: null, locked_until: null, updated_at: nowIso }).eq('id', job.id)

        // Teste do dono: não mexe em tour nenhum.
        if (!job.input?.test && job.video_tour_id) {
          const { data: tour } = await admin.from('video_tours').select('id, status, assembly').eq('id', job.video_tour_id).maybeSingle()
          if (tour && tour.status === 'assembling' && tour.assembly?.mode === 'vps' && tour.assembly?.job_id === job.id) {
            const assembly = { ...tour.assembly, outputs: (tour.assembly.outputs ?? []).map((o: Any) => ({ ...o, done: true })) }
            await admin.from('video_tours').update({ status: 'completed', assembly, video_path: expected[0]?.path, error: null, updated_at: nowIso }).eq('id', tour.id)
          }
        }
        console.log('[vps-worker] trabalho pronto', job.id)
        return json({ ok: true })
      }
      return json({ error: 'Ação desconhecida' }, 400)
    }

    // ── Dono ──
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return json({ error: 'Unauthorized' }, 401)
    const userClient = createClient(url, anonKey, { global: { headers: { Authorization: authHeader } } })
    const { data: { user } } = await userClient.auth.getUser()
    if (!user) return json({ error: 'Unauthorized' }, 401)
    const { data: role } = await admin.from('user_roles').select('role').eq('email', user.email!).maybeSingle()
    if (role?.role !== 'owner') return json({ error: 'Forbidden' }, 403)

    if (action === 'status') {
      const [{ data: flag }, { data: nodes }, { data: jobs }] = await Promise.all([
        admin.from('feature_flags').select('enabled').eq('key', FLAG).maybeSingle(),
        admin.from('worker_nodes').select('id, name, status, info, enrolled_at, last_seen_at').order('enrolled_at', { ascending: false }),
        admin.from('media_jobs').select('id, kind, status, attempts, error, input, output, created_at, updated_at').order('created_at', { ascending: false }).limit(10),
      ])
      const publicUrl = (p: string) => admin.storage.from(VIDEO_BUCKET).getPublicUrl(p).data.publicUrl
      return json({
        enabled: !!flag?.enabled,
        nodes: (nodes ?? []).map((n: Any) => ({ ...n, online: n.status === 'active' && !!n.last_seen_at && Date.now() - new Date(n.last_seen_at).getTime() < ONLINE_MS })),
        jobs: (jobs ?? []).map((j: Any) => ({
          id: j.id, kind: j.kind, status: j.status, attempts: j.attempts, error: j.error, test: !!j.input?.test, sample: !!j.input?.sample,
          created_at: j.created_at, updated_at: j.updated_at,
          before_url: j.input?.outputs?.[0]?.clips?.[0] ?? null,
          after_url: j.status === 'done' && j.input?.outputs?.[0]?.path ? publicUrl(j.input.outputs[0].path) : null,
        })),
      })
    }
    if (action === 'enroll_start') {
      const code = randomToken(24)
      const { error } = await admin.from('worker_enrollments').insert({ code_hash: await sha256(code), created_by: user.email, expires_at: new Date(Date.now() + CODE_TTL_MS).toISOString() })
      if (error) return json({ error: error.message }, 500)
      return json({ command: `curl -fsSL ${INSTALL_URL} | sudo bash -s -- ${url} ${code}`, expires_in_min: CODE_TTL_MS / 60_000 })
    }
    if (action === 'revoke') {
      const id = String(body.node_id ?? '')
      if (!UUID.test(id)) return json({ error: 'node_id inválido' }, 400)
      await admin.from('worker_nodes').update({ status: 'revoked' }).eq('id', id)
      return json({ ok: true })
    }
    if (action === 'set_enabled') {
      const enabled = body.enabled === true
      await admin.from('feature_flags').upsert({ key: FLAG, label: 'Acabamento de vídeo no servidor (VPS)', enabled, updated_at: new Date().toISOString() })
      return json({ ok: true, enabled })
    }
    // Teste do dono: refaz o acabamento numa pasta à parte (o original não muda).
    // Nunca usa vídeo de cliente (regra 2): só da empresa do próprio dono; sem
    // nenhum, o servidor gera uma amostra deitada (sample) pra mostrar o antes × depois.
    if (action === 'test') {
      const { data: own } = await admin.from('companies').select('id').eq('user_id', user.id)
      const ownIds = (own ?? []).map((c: { id: string }) => c.id)
      const { data: tour } = ownIds.length
        ? await admin.from('video_tours').select('id, video_path').eq('status', 'completed').in('company_id', ownIds)
          .not('video_path', 'is', null).order('updated_at', { ascending: false }).limit(1).maybeSingle()
        : { data: null }
      const before = tour ? admin.storage.from(VIDEO_BUCKET).getPublicUrl(tour.video_path).data.publicUrl : null
      const { data: job, error } = await admin.from('media_jobs').insert({
        kind: 'reel_finish', video_tour_id: tour?.id ?? null,
        input: { test: true, sample: !before, outputs: [{ path: `vps-test/${crypto.randomUUID()}.mp4`, clips: before ? [before] : [] }] },
      }).select('id').single()
      if (error) return json({ error: error.message }, 500)
      return json({ ok: true, job_id: job.id, sample: !before })
    }
    return json({ error: 'Ação desconhecida' }, 400)
  } catch (err) {
    console.error('[vps-worker]', err)
    return json({ error: String(err) }, 500)
  }
})
