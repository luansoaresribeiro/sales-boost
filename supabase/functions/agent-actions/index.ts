/**
 * agent-actions — CENTRAL DE APPROVALS (motor + executor).
 *
 * Toda ação de qualquer agente passa por aqui. Separa APROVAÇÃO de EXECUÇÃO,
 * honra o modo automático, registra interpretação/payload/resultado e mantém
 * auditoria. Nenhum agente executa direto: sempre propõe → engine decide →
 * (auto ou manual) → executor roda.
 *
 * Body: { action, company_id, ... }
 *   action = 'list' | 'propose' | 'approve' | 'reject' | 'edit' | 'cancel'
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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? anonKey
    const bearer = req.headers.get('Authorization') ?? ''
    if (!bearer) return json({ error: 'Unauthorized' }, 401)

    const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: bearer } } })
    const { data: { user } } = await userClient.auth.getUser()
    if (!user) return json({ error: 'Unauthorized' }, 401)

    const body = await req.json().catch(() => ({}))
    const { action, company_id } = body as { action?: string; company_id?: string }
    if (!company_id) return json({ error: 'company_id obrigatório' }, 400)

    const admin = createClient(supabaseUrl, serviceKey)
    const { data: company } = await admin.from('companies').select('id, user_id, agent_automatic_mode').eq('id', company_id).maybeSingle()
    if (!company || company.user_id !== user.id) return json({ error: 'Forbidden' }, 403)

    switch (action) {
      case 'list': return await listActions(admin, company_id, body.status)
      case 'propose': return await proposeAction(admin, company_id, body, !!company.agent_automatic_mode)
      case 'approve': return await decide(admin, company_id, body.id, 'APPROVED', user.id)
      case 'reject': return await decide(admin, company_id, body.id, 'REJECTED', user.id)
      case 'cancel': return await decide(admin, company_id, body.id, 'CANCELLED', user.id)
      case 'edit': return await editAction(admin, company_id, body)
      default: return json({ error: `ação inválida: ${action}` }, 400)
    }
  } catch (err) {
    console.error('agent-actions error:', err)
    return json({ error: err instanceof Error ? err.message : String(err) }, 500)
  }
})

async function listActions(admin: Supa, companyId: string, status?: string) {
  let q = admin.from('agent_actions').select('*').eq('company_id', companyId).order('created_at', { ascending: false }).limit(100)
  if (status === 'pending') q = q.eq('approval_status', 'PENDING')
  else if (status === 'history') q = q.in('approval_status', ['APPROVED', 'AUTO_APPROVED', 'REJECTED', 'CANCELLED'])
  const { data, error } = await q
  if (error) return json({ error: error.message }, 500)
  return json({ actions: data ?? [] })
}

// deno-lint-ignore no-explicit-any
async function proposeAction(admin: Supa, companyId: string, b: any, autoMode: boolean) {
  // Quem manda é a configuração da empresa (autoMode). O cliente NÃO decide
  // sozinho ligar auto — só pode pedir manual (automation_enabled=false).
  const auto = autoMode && b.automation_enabled !== false
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
    // Engine: modo automático NÃO pula o motor — só marca AUTO_APPROVED + fila.
    approval_status: auto ? 'AUTO_APPROVED' : 'PENDING',
    execution_status: auto ? 'QUEUED' : 'NOT_READY',
    approved_at: auto ? new Date().toISOString() : null,
  }
  const { data, error } = await admin.from('agent_actions').insert(row).select('*').single()
  if (error) return json({ error: error.message }, 500)
  // Auto-aprovada → executa já.
  if (auto) return json({ action: await execute(admin, data) })
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
    // 1) Aprovação de conteúdo já existente (fluxo real de hoje).
    if (act.ref_type === 'marketing_ai_content' && act.ref_id) {
      const { error } = await admin.from('marketing_ai_content').update({ status: 'approved', updated_at: new Date().toISOString() }).eq('id', act.ref_id).eq('company_id', act.company_id)
      return error ? await fail(error.message) : await done({ approved: 'marketing_ai_content', id: act.ref_id })
    }
    if (act.ref_type === 'post' && act.ref_id) {
      const { error } = await admin.from('posts').update({ status: 'aprovado', updated_at: new Date().toISOString() }).eq('id', act.ref_id).eq('company_id', act.company_id)
      return error ? await fail(error.message) : await done({ approved: 'post', id: act.ref_id })
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

async function finish(admin: Supa, id: string, status: 'EXECUTED' | 'FAILED', extra: Record<string, unknown>) {
  const { data } = await admin.from('agent_actions').update({
    execution_status: status, executed_at: new Date().toISOString(), updated_at: new Date().toISOString(), ...extra,
  }).eq('id', id).select('*').single()
  return data
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { ...cors, 'Content-Type': 'application/json' } })
}
