/**
 * agent-actions — CENTRAL DE APPROVALS (motor + executor).
 *
 * Toda ação de qualquer agente passa por aqui. Separa APROVAÇÃO de EXECUÇÃO,
 * honra o modo automático, registra interpretação/payload/resultado e mantém
 * auditoria. Nenhum agente executa direto: sempre propõe → engine decide →
 * (auto ou manual) → executor roda.
 *
 * Body: { action, company_id, ... }
 *   action = 'list' | 'propose' | 'approve' | 'reject' | 'edit' | 'cancel' | 'retry' | 'run_scheduled'
 *
 * 'run_scheduled' é a única exceção ao JWT do dono — roda via cron_secret
 * (o cron de 5 em 5 min que executa agendamentos vencidos, ver migration
 * 066), sem company_id (varre todas as empresas de uma vez).
 *
 * Autenticado por JWT do dono (verifica dono da company). A escrita real é
 * feita com service role — ninguém forja aprovação/execução direto no banco.
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}
type Supa = ReturnType<typeof createClient>
const IG_API = 'https://graph.instagram.com/v21.0'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? anonKey
    const cronSecretEnv = Deno.env.get('CRON_SECRET')
    const admin = createClient(supabaseUrl, serviceKey)
    const body = await req.json().catch(() => ({})) as Record<string, unknown>

    // Cron (agendamentos vencidos): única exceção ao JWT do dono.
    if (body.action === 'run_scheduled') {
      if (!cronSecretEnv || body.cron_secret !== cronSecretEnv) return json({ error: 'Unauthorized' }, 401)
      return await runScheduled(admin)
    }

    const bearer = req.headers.get('Authorization') ?? ''
    if (!bearer) return json({ error: 'Unauthorized' }, 401)

    const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: bearer } } })
    const { data: { user } } = await userClient.auth.getUser()
    if (!user) return json({ error: 'Unauthorized' }, 401)

    const { action, company_id } = body as { action?: string; company_id?: string }
    if (!company_id) return json({ error: 'company_id obrigatório' }, 400)

    const { data: company } = await admin.from('companies').select('id, user_id, agent_automatic_mode').eq('id', company_id).maybeSingle()
    if (!company || company.user_id !== user.id) return json({ error: 'Forbidden' }, 403)

    switch (action) {
      case 'list': return await listActions(admin, company_id, body.status as string | undefined)
      case 'propose': return await proposeAction(admin, company_id, body, !!company.agent_automatic_mode, !!body.approve_now, user.id)
      case 'approve': return await decide(admin, company_id, body.id as string | undefined, 'APPROVED', user.id)
      case 'reject': return await decide(admin, company_id, body.id as string | undefined, 'REJECTED', user.id)
      case 'cancel': return await decide(admin, company_id, body.id as string | undefined, 'CANCELLED', user.id)
      case 'edit': return await editAction(admin, company_id, body)
      case 'retry': return await retryAction(admin, company_id, body.id as string | undefined)
      case 'unschedule': return await unscheduleAction(admin, company_id, body.id as string | undefined)
      default: return json({ error: `ação inválida: ${action}` }, 400)
    }
  } catch (err) {
    console.error('agent-actions error:', err)
    return json({ error: err instanceof Error ? err.message : String(err) }, 500)
  }
})

// Roda toda ação AGENDADA cujo horário já venceu — chamada pelo cron de 5 em
// 5 min (migration 066). Uma falhando não impede as outras.
async function runScheduled(admin: Supa) {
  const { data: due } = await admin.from('agent_actions').select('*')
    .eq('execution_status', 'QUEUED').not('scheduled_at', 'is', null).lte('scheduled_at', new Date().toISOString())
  let executed = 0, failed = 0
  for (const act of (due ?? []) as Record<string, unknown>[]) {
    try { await execute(admin, act); executed++ } catch (e) { failed++; console.error('agent-actions run_scheduled falhou pra', act.id, e) }
  }
  return json({ ok: true, executed, failed })
}

// Cancela um agendamento — volta a ficar como aprovada mas sem execução
// automática (o dono publica manualmente quando quiser).
async function unscheduleAction(admin: Supa, companyId: string, id: string | undefined) {
  if (!id) return json({ error: 'id obrigatório' }, 400)
  const { data, error } = await admin.from('agent_actions').update({
    scheduled_at: null, execution_status: 'NOT_READY', updated_at: new Date().toISOString(),
  }).eq('id', id).eq('company_id', companyId).eq('execution_status', 'QUEUED').select('*').single()
  if (error) return json({ error: error.message }, 500)
  return json({ action: data })
}

async function listActions(admin: Supa, companyId: string, status?: string) {
  let q = admin.from('agent_actions').select('*').eq('company_id', companyId).order('created_at', { ascending: false }).limit(100)
  if (status === 'pending') q = q.eq('approval_status', 'PENDING')
  else if (status === 'history') q = q.in('approval_status', ['APPROVED', 'AUTO_APPROVED', 'REJECTED', 'CANCELLED'])
  const { data, error } = await q
  if (error) return json({ error: error.message }, 500)
  return json({ actions: data ?? [] })
}

// deno-lint-ignore no-explicit-any
async function proposeAction(admin: Supa, companyId: string, b: any, autoMode: boolean, forceApprove: boolean, userId: string) {
  // Quem manda é a configuração da empresa (autoMode). O cliente NÃO decide
  // sozinho ligar auto — só pode pedir manual (automation_enabled=false).
  // forceApprove é diferente: é o dono clicando um botão que JÁ É a decisão
  // dele agora (ex.: "Publicar" no Vault, "Aprovar" na Central) — propõe e
  // aprova no mesmo passo, sem exigir um segundo clique em outro lugar.
  const auto = forceApprove || (autoMode && b.automation_enabled !== false)
  // Agendamento (ex.: "Agendar" no Vault): o dono JÁ decidiu (aprovado),
  // só a EXECUÇÃO é adiada pro horário certo — o cron de 5 em 5 min
  // (run_scheduled) publica quando chegar a hora. Nunca executa na hora.
  const scheduledAt = typeof b.scheduled_at === 'string' && b.scheduled_at ? b.scheduled_at : null
  const willExecuteNow = auto && !scheduledAt
  const row = {
    company_id: companyId,
    agent_key: b.agent_key ?? 'marketing',
    agent_name: b.agent_name ?? 'Agente',
    action_type: b.action_type ?? 'generic',
    channel: b.channel ?? 'internal',
    integration: b.integration ?? null,
    target: b.target ?? null,
    title: b.title ?? 'Ação do agente',
    description: b.description ?? null,
    agent_interpretation: b.agent_interpretation ?? null,
    reason: b.reason ?? null,
    expected_outcome: b.expected_outcome ?? null,
    payload: b.payload ?? {},
    risk_level: b.risk_level ?? 'low',
    priority: b.priority ?? 'normal',
    source: b.source ?? 'manual',
    ref_type: b.ref_type ?? null,
    ref_id: b.ref_id ?? null,
    automation_enabled: auto,
    scheduled_at: scheduledAt,
    // Engine: modo automático NÃO pula o motor — só marca AUTO_APPROVED + fila.
    approval_status: forceApprove || scheduledAt ? 'APPROVED' : auto ? 'AUTO_APPROVED' : 'PENDING',
    execution_status: auto || scheduledAt ? 'QUEUED' : 'NOT_READY',
    approved_at: auto || scheduledAt ? new Date().toISOString() : null,
    approved_by: forceApprove || scheduledAt ? userId : null,
  }
  const { data, error } = await admin.from('agent_actions').insert(row).select('*').single()
  if (error) return json({ error: error.message }, 500)
  // Auto-aprovada (e não agendada pra depois) → executa já.
  if (willExecuteNow) return json({ action: await execute(admin, data) })
  return json({ action: data })
}

async function decide(admin: Supa, companyId: string, id: string | undefined, status: string, userId: string) {
  if (!id) return json({ error: 'id obrigatório' }, 400)
  const { data: current } = await admin.from('agent_actions').select('*').eq('id', id).eq('company_id', companyId).maybeSingle()
  if (!current) return json({ error: 'ação não encontrada' }, 404)

  if (status === 'APPROVED') {
    const { data, error } = await admin.from('agent_actions').update({
      approval_status: 'APPROVED', approved_at: new Date().toISOString(), approved_by: userId,
      execution_status: 'QUEUED', updated_at: new Date().toISOString(),
    }).eq('id', id).select('*').single()
    if (error) return json({ error: error.message }, 500)
    return json({ action: await execute(admin, data) }) // aprovou → executa
  }
  // REJECTED / CANCELLED — não executa.
  const { data, error } = await admin.from('agent_actions').update({
    approval_status: status, execution_status: 'NOT_READY', updated_at: new Date().toISOString(),
  }).eq('id', id).select('*').single()
  if (error) return json({ error: error.message }, 500)
  return json({ action: data })
}

// deno-lint-ignore no-explicit-any
async function editAction(admin: Supa, companyId: string, b: any) {
  if (!b.id) return json({ error: 'id obrigatório' }, 400)
  const patch: Record<string, unknown> = { approval_status: 'EDITED', updated_at: new Date().toISOString() }
  for (const k of ['title', 'description', 'payload', 'reason', 'expected_outcome', 'agent_interpretation', 'priority', 'risk_level']) {
    if (b[k] !== undefined) patch[k] = b[k]
  }
  const { data, error } = await admin.from('agent_actions').update(patch).eq('id', b.id).eq('company_id', companyId).select('*').single()
  if (error) return json({ error: error.message }, 500)
  return json({ action: data })
}

// Tenta de novo uma ação que já falhou — reexecuta com o MESMO payload já
// salvo na hora da proposta (não depende da linha original ainda existir,
// ex: marketing_ai_test_content já foi apagada no fluxo do Vault desde a
// 1ª tentativa). Só faz sentido pra quem já foi aprovada e falhou na hora
// de executar (rejeitada/cancelada não pode "tentar de novo").
async function retryAction(admin: Supa, companyId: string, id: string | undefined) {
  if (!id) return json({ error: 'id obrigatório' }, 400)
  const { data: current } = await admin.from('agent_actions').select('*').eq('id', id).eq('company_id', companyId).maybeSingle()
  if (!current) return json({ error: 'Ação não encontrada' }, 404)
  if (current.execution_status !== 'FAILED') return json({ error: 'Só dá pra tentar de novo uma ação que falhou.' }, 400)
  return json({ action: await execute(admin, current) })
}

// ── EXECUTOR ───────────────────────────────────────────────────────────────
// Roda a ação de verdade, por canal. Fluxo de conteúdo (o que já existe) é
// executado; canais externos ainda não religados falham de forma HONESTA
// (FAILED + motivo), nunca fingem sucesso.
// deno-lint-ignore no-explicit-any
async function execute(admin: Supa, act: any): Promise<any> {
  await admin.from('agent_actions').update({ execution_status: 'EXECUTING', updated_at: new Date().toISOString() }).eq('id', act.id)
  const done = (result: unknown, externalId?: string) => finish(admin, act.id, 'EXECUTED', { execution_result: result, external_id: externalId ?? null })
  const fail = (msg: string) => finish(admin, act.id, 'FAILED', { execution_error: msg })

  try {
    // 1) Aprovação de conteúdo já existente (Central de Approvals — Ideias/
    // calendário). Mesma regra do Vault: aprovar aqui publica DE VERDADE no
    // Instagram quando há imagem e conexão; sem isso, honestamente fica só
    // "approved" (o status do enum desta tabela é em inglês, diferente de
    // posts/marketing_ai_test_content — respeita o que já existe).
    if (act.ref_type === 'marketing_ai_content' && act.ref_id) {
      const { data: content } = await admin.from('marketing_ai_content').select('caption, hashtags, image_url').eq('id', act.ref_id).eq('company_id', act.company_id).maybeSingle()
      const { data: company } = await admin.from('companies').select('instagram_user_id, instagram_access_token').eq('id', act.company_id).maybeSingle()
      const caption = [content?.caption, content?.hashtags].map(x => (x ? String(x) : '').trim()).filter(Boolean).join('\n\n')

      let mediaId: string | null = null
      let publishError: string | null = null
      if (company?.instagram_user_id && company?.instagram_access_token && content?.image_url) {
        try {
          mediaId = await publishToInstagram(String(company.instagram_user_id), String(company.instagram_access_token), String(content.image_url), caption)
        } catch (e) {
          publishError = e instanceof Error ? e.message : String(e)
        }
      } else if (!company?.instagram_user_id || !company?.instagram_access_token) {
        publishError = 'Instagram não conectado — aprovado, mas não publicado.'
      } else if (!content?.image_url) {
        publishError = 'Sem imagem gerada ainda — aprovado, mas não publicado.'
      }

      const { error } = await admin.from('marketing_ai_content').update({
        status: mediaId ? 'published' : 'approved', updated_at: new Date().toISOString(),
        published_at: mediaId ? new Date().toISOString() : null,
      }).eq('id', act.ref_id).eq('company_id', act.company_id)
      if (error) return await fail(error.message)

      if (publishError) return await fail(publishError)
      return await done({ approved: 'marketing_ai_content', id: act.ref_id, published_to_instagram: !!mediaId }, act.ref_id)
    }
    if (act.ref_type === 'post' && act.ref_id) {
      const { error } = await admin.from('posts').update({ status: 'aprovado', updated_at: new Date().toISOString() }).eq('id', act.ref_id).eq('company_id', act.company_id)
      return error ? await fail(error.message) : await done({ approved: 'post', id: act.ref_id })
    }

    // 1b) Conteúdo que passou pela Área de Testes/Vault (nota de QC ≥90):
    // aprovar aqui publica DE VERDADE no Instagram (se conectado) e vira um
    // post 'publicado' já com o media_id real — fecha o loop até a
    // instagram-performance conseguir medir esse post depois.
    if (act.ref_type === 'marketing_ai_test_content' && act.ref_id) {
      const p = act.payload ?? {}
      const caption = [p.caption, p.cta, p.hashtags].map(x => (x ? String(x) : '').trim()).filter(Boolean).join('\n\n')
      const { data: company } = await admin.from('companies').select('instagram_user_id, instagram_access_token').eq('id', act.company_id).maybeSingle()

      let mediaId: string | null = null
      let publishError: string | null = null
      if (company?.instagram_user_id && company?.instagram_access_token && p.image_url) {
        try {
          mediaId = await publishToInstagram(String(company.instagram_user_id), String(company.instagram_access_token), String(p.image_url), caption)
        } catch (e) {
          publishError = e instanceof Error ? e.message : String(e)
        }
      } else if (!company?.instagram_user_id || !company?.instagram_access_token) {
        publishError = 'Instagram não conectado — post salvo como aprovado, publique manualmente na aba Posts.'
      }

      const { data: postRow, error } = await admin.from('posts').insert({
        company_id: act.company_id, content: caption, image_url: p.image_url ?? null, image_suggestion: p.idea ?? null,
        agent_notes: act.agent_interpretation ?? act.reason ?? null, platform: 'instagram',
        status: mediaId ? 'publicado' : 'aprovado',
        instagram_media_id: mediaId, published_at: mediaId ? new Date().toISOString() : null,
      }).select('id').single()
      if (error) return await fail(error.message)
      await admin.from('marketing_ai_test_content').delete().eq('id', act.ref_id).eq('company_id', act.company_id)

      if (publishError) return await fail(publishError)
      return await done({ created: 'post', id: postRow?.id, published_to_instagram: !!mediaId }, postRow?.id ?? mediaId ?? undefined)
    }

    // 2) Engagement (Instagram): enviar DM / criar lead — aprovado pelo dono.
    if (act.source === 'engagement') {
      const { data: company } = await admin.from('companies').select('id, instagram_user_id, instagram_access_token').eq('id', act.company_id).maybeSingle()
      const p = act.payload ?? {}
      let err = ''
      if ((p.action_type === 'send_dm' || p.action_type === 'answer_question') && p.message) {
        if (!company?.instagram_access_token) err = 'Instagram não conectado — DM não enviado.'
        else {
          const r = await fetch(`https://graph.facebook.com/v21.0/${company.instagram_user_id ?? 'me'}/messages`, {
            method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${company.instagram_access_token}` },
            body: JSON.stringify({ recipient: { comment_id: p.comment_id }, message: { text: p.message } }),
          })
          if (!r.ok) err = `Falha ao enviar DM: ${await r.text()}`
        }
      }
      if (p.create_lead || p.action_type === 'create_lead') {
        await admin.from('leads').insert({ company_id: act.company_id, name: p.ig_user ?? 'Lead do Instagram', contact: p.ig_user ?? null, channel: 'instagram', stage: 'new', notes: act.agent_interpretation ?? null })
      }
      if (p.event_id) await admin.from('engagement_events').update({ status: err ? 'failed' : (p.create_lead ? 'lead_created' : 'sent'), error: err || null }).eq('id', p.event_id)
      return err ? await fail(err) : await done({ engagement: true, dm: p.action_type !== 'create_lead', lead: !!p.create_lead })
    }

    // 3) Criar rascunho de conteúdo a partir do payload (produtor → Approvals).
    if (act.action_type === 'create_content' || act.channel === 'instagram') {
      const p = act.payload ?? {}
      const { data, error } = await admin.from('marketing_ai_content').insert({
        company_id: act.company_id,
        idea: p.idea ?? act.title ?? null,
        caption: p.caption ?? null,
        hashtags: p.hashtags ?? null,
        format: p.format ?? null,
        reasoning: act.agent_interpretation ?? act.reason ?? null,
        status: 'approved', // já passou pela aprovação aqui
      }).select('id').single()
      return error ? await fail(error.message) : await done({ created: 'marketing_ai_content', id: data?.id }, data?.id)
    }

    // 3) Ação interna sem efeito externo — apenas registrada.
    if (act.channel === 'internal') return await done({ note: 'ação interna registrada' })

    // 4) Canais externos ainda não religados ao executor central.
    return await fail(`Executor ainda não implementado para o canal "${act.channel}". A ação foi aprovada e registrada; a execução real será feita quando a integração desse canal for religada ao motor central.`)
  } catch (err) {
    return await fail(err instanceof Error ? err.message : String(err))
  }
}

// Publica de verdade no Instagram (Instagram Business Login — mesmas chamadas
// de graph.instagram.com usadas em publish-instagram). Só chamada quando o
// executor já tem uma imagem real (nunca gera imagem nova aqui — a imagem
// aprovada é a que sai).
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

// O Instagram processa a mídia de forma assíncrona — o container criado
// abaixo começa "IN_PROGRESS" e só fica publicável quando vira "FINISHED".
// Chamar media_publish cedo demais dá "Media ID is not available" (o erro
// real que já vimos em produção). Espera até 30s (10×3s) antes de desistir.
async function waitContainerReady(creationId: string, token: string): Promise<void> {
  for (let i = 0; i < 10; i++) {
    const res = await fetch(`${IG_API}/${creationId}?fields=status_code&access_token=${token}`)
    const data = await res.json().catch(() => ({})) as { status_code?: string; error?: { message?: string } }
    if (data.status_code === 'FINISHED') return
    if (data.status_code === 'ERROR') throw new Error(`Instagram falhou ao processar a mídia: ${data.error?.message ?? 'erro desconhecido'}`)
    await sleep(3000)
  }
  throw new Error('Instagram demorou demais pra processar a mídia (timeout).')
}

async function publishToInstagram(igUserId: string, token: string, imageUrl: string, caption: string): Promise<string> {
  const containerRes = await fetch(`${IG_API}/${igUserId}/media`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ image_url: imageUrl, caption, access_token: token }),
  })
  if (!containerRes.ok) {
    const err = await containerRes.json().catch(() => ({}))
    throw new Error(`Falha ao preparar mídia no Instagram: ${err.error?.message ?? JSON.stringify(err)}`)
  }
  const { id: creationId } = await containerRes.json()
  await waitContainerReady(creationId, token)

  const publishRes = await fetch(`${IG_API}/${igUserId}/media_publish`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ creation_id: creationId, access_token: token }),
  })
  if (!publishRes.ok) {
    const err = await publishRes.json().catch(() => ({}))
    throw new Error(`Falha ao publicar no Instagram: ${err.error?.message ?? JSON.stringify(err)}`)
  }
  const { id: mediaId } = await publishRes.json()
  return mediaId
}

async function finish(admin: Supa, id: string, status: 'EXECUTED' | 'FAILED', extra: Record<string, unknown>) {
  const { data } = await admin.from('agent_actions').update({
    execution_status: status, executed_at: new Date().toISOString(), updated_at: new Date().toISOString(), ...extra,
  }).eq('id', id).select('*').single()
  return data
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { ...cors, 'Content-Type': 'application/json' } })
}
