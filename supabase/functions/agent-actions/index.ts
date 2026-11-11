/**
 * agent-actions — CENTRAL DE APPROVALS (motor + executor).
 *
 * Toda ação de qualquer agente passa por aqui. Separa APROVAÇÃO de EXECUÇÃO,
 * honra o modo automático, registra interpretação/payload/resultado e mantém
 * auditoria. Nenhum agente executa direto: sempre propõe → engine decide →
 * (auto ou manual) → executor roda.
 *
 * Body: { action, company_id, ... }
 *   action = 'list' | 'propose' | 'approve' | 'reject' | 'edit' | 'cancel' | 'retry' | 'unschedule'
 *          | 'approve_week' | 'unschedule_week' | 'run_scheduled'
 *
 * 'run_scheduled' é a única exceção ao JWT do dono — roda via cron_secret
 * (o cron de 5 em 5 min que executa agendamentos vencidos, ver migration
 * 066), sem company_id (varre todas as empresas de uma vez).
 *
 * 'telegram_decide' também não usa JWT: é o botão "Aprovar" do Telegram,
 * autenticado por assinatura HMAC do próprio servidor presa ao item e ao
 * chat do dono (ver telegramDecide e _shared/telegramButtons.ts).
 *
 * Autenticado por JWT do dono (verifica dono da company). A escrita real é
 * feita com service role — ninguém forja aprovação/execução direto no banco.
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { parseButton, verifyButton, type ButtonKind, type ButtonOp } from '../_shared/telegramButtons.ts'
import { requirePaidAccess } from '../_shared/access.ts'
import { publishBlockReason, publishes } from '../_shared/publishGuard.ts'
import { ensureFooter, loadPublicTextRules, publishLicense, publishTextBlock } from '../_shared/compliance.ts'
import { ensureDisclosure, stagingCheck } from '../_shared/stagingDisclosure.ts'
import { plannedPublishAt, publishWhenLabel } from '../_shared/publishSlot.ts'
import { parseWeekIds, planWeek, SKIP_LABEL, WEEK_MAX, type SkipReason } from '../_shared/weekApproval.ts'
import { revalidate, unverifiableOutcome, UNVERIFIABLE_FAIL_MESSAGE } from '../_shared/itemService.ts'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}
type Supa = ReturnType<typeof createClient>
const IG_API = 'https://graph.instagram.com/v21.0'
const HOLD_MESSAGE = '⏳ Não consegui conferir agora se o imóvel ainda está disponível. Não publiquei: vou tentar de novo a cada 5 minutos por até 2 horas e, se não conseguir, a publicação falha com aviso.'

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
    // Botão "Aprovar" do Telegram: sem JWT, mas com assinatura do próprio
    // servidor presa ao item + chat do dono (ver _shared/telegramButtons.ts).
    if (body.action === 'telegram_decide') return await telegramDecide(admin, body)

    const bearer = req.headers.get('Authorization') ?? ''
    if (!bearer) return json({ error: 'Unauthorized' }, 401)

    const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: bearer } } })
    const { data: { user } } = await userClient.auth.getUser()
    if (!user) return json({ error: 'Unauthorized' }, 401)

    const { action, company_id } = body as { action?: string; company_id?: string }
    if (!company_id) return json({ error: 'company_id obrigatório' }, 400)

    const { data: company } = await admin.from('companies').select('id, user_id, agent_automatic_mode').eq('id', company_id).maybeSingle()
    if (!company || company.user_id !== user.id) return json({ error: 'Forbidden' }, 403)

    // Rede de segurança de pagamento: só as ações que criam/aprovam/reexecutam
    // (publicar/enviar). list/reject/cancel/edit/unschedule seguem livres.
    if (action === 'propose' || action === 'approve' || action === 'retry' || action === 'approve_week') {
      const noPlan = await requirePaidAccess(admin, company_id)
      if (noPlan) return noPlan
    }

    switch (action) {
      case 'list': return await listActions(admin, company_id, body.status as string | undefined)
      case 'propose': return await proposeAction(admin, company_id, body, !!company.agent_automatic_mode, !!body.approve_now, user.id)
      case 'approve': return await decide(admin, company_id, body.id as string | undefined, 'APPROVED', user.id)
      case 'reject': return await decide(admin, company_id, body.id as string | undefined, 'REJECTED', user.id)
      case 'cancel': return await decide(admin, company_id, body.id as string | undefined, 'CANCELLED', user.id)
      case 'edit': return await editAction(admin, company_id, body)
      case 'retry': return await retryAction(admin, company_id, body.id as string | undefined)
      case 'unschedule': return await unscheduleAction(admin, company_id, body.id as string | undefined)
      case 'approve_week': return await approveWeek(admin, company_id, body.ids, user.id)
      case 'unschedule_week': return await unscheduleWeek(admin, company_id, body.ids)
      default: return json({ error: `ação inválida: ${action}` }, 400)
    }
  } catch (err) {
    console.error('agent-actions error:', err)
    return json({ error: err instanceof Error ? err.message : String(err) }, 500)
  }
})

// Aprovação pelo Telegram (2º toque do "Tem certeza?"). Confere TUDO aqui de
// novo, sem confiar em quem chamou: interruptor geral + opt-in da empresa,
// assinatura do botão, chat do dono e item ainda pendente. A troca de status
// é condicional (só sai de pendente uma vez), então dois toques seguidos
// nunca publicam duas vezes.
// deno-lint-ignore no-explicit-any
async function telegramDecide(admin: Supa, b: any) {
  const kind = b.kind as ButtonKind, op = b.op as ButtonOp
  const id = String(b.id ?? ''), chatId = Number(b.chat_id), sig = String(b.sig ?? '')
  if (!parseButton(`${kind}|${op}|${id}|${sig}`) || (op !== 'Y' && op !== 'R') || !Number.isFinite(chatId)) return json({ ok: false, message: 'Botão inválido.' }, 400)
  if (!(await verifyButton(kind, op, id, chatId, sig))) return json({ ok: false, message: 'Botão inválido.' }, 401)

  const { data: flag } = await admin.from('feature_flags').select('enabled').eq('key', 'telegram_buddy').maybeSingle()
  if (flag && flag.enabled === false) return json({ ok: false, message: 'A aprovação pelo Telegram está desligada no momento. Use o painel.' })

  const table = kind === 'a' ? 'agent_actions' : 'marketing_ai_test_content'
  const { data: item } = await admin.from(table).select('*').eq('id', id).maybeSingle()
  if (!item) return json({ ok: false, message: 'Não achei esse item — talvez já tenha sido resolvido no painel.' })
  const { data: company } = await admin.from('companies').select('id, user_id, telegram_chat_id, notification_prefs').eq('id', item.company_id).maybeSingle()
  if (!company || Number(company.telegram_chat_id) !== chatId) return json({ ok: false, message: 'Esse botão não pertence a esta conversa.' }, 403)
  if ((company.notification_prefs as Record<string, unknown> | null)?.telegram_buddy !== true) {
    return json({ ok: false, message: 'A aprovação pelo Telegram está desligada nas suas Configurações → Notificações.' })
  }

  if (kind === 'a') {
    const now = new Date().toISOString()
    const patch = op === 'Y'
      ? { approval_status: 'APPROVED', approved_at: now, approved_by: company.user_id, execution_status: 'QUEUED', updated_at: now }
      : { approval_status: 'REJECTED', execution_status: 'NOT_READY', updated_at: now }
    // Só PENDING: se foi editado no painel depois do aviso, o texto mudou e
    // o dono não viu a versão nova aqui — aí a decisão volta pro painel.
    if (item.approval_status === 'EDITED') return json({ ok: false, message: '✏️ Esse pedido foi editado no painel depois do aviso. Confira a versão nova por lá antes de aprovar.' })
    // Fase 4: imóvel já indisponível → avisa antes de aprovar (a trava do executor continua valendo mesmo assim).
    if (op === 'Y' && item.ref_type === 'marketing_ai_test_content') {
      const blocked = await earlyBlock(admin, company.id, item.ref_id, item.payload?.item_id)
      if (blocked) return json({ ok: false, message: `🏠 ${blocked}` })
    }
    const { data: claimed } = await admin.from('agent_actions').update(patch)
      .eq('id', id).eq('approval_status', 'PENDING').select('*').maybeSingle()
    if (!claimed) return json({ ok: false, message: 'Esse pedido já foi decidido antes (no painel ou aqui).' })
    if (op === 'R') return json({ ok: true, message: '👍 Recusado. Não vou enviar nada.' })
    const done = await execute(admin, claimed)
    if (done?.execution_status === 'QUEUED') return json({ ok: false, message: HOLD_MESSAGE })
    return json({ ok: done?.execution_status === 'EXECUTED', message: done?.execution_status === 'EXECUTED' ? '✅ Feito! Já enviei.' : `⚠️ Aprovado, mas não consegui executar: ${done?.execution_error ?? 'erro desconhecido'}. Dá pra tentar de novo no painel.` })
  }

  // Post do Vault: só "Publicar" (não existe recusar aqui — no painel dá pra
  // mandar de volta pra testes). Trava o post saindo de 'vault' antes de
  // propor, pra um segundo toque não publicar de novo.
  if (op !== 'Y') return json({ ok: false, message: 'Botão inválido.' }, 400)
  // Peça de vídeo do calendário ainda sem o vídeo (sendo feito / aguardando o estúdio): não aprova — só a foto de capa sairia.
  if (item.recipe === 'video_imovel' && !item.video_url) return json({ ok: false, message: '🎬 O vídeo ainda não está pronto. Aguarde ele aparecer no painel antes de aprovar.' })
  // Fase 4: imóvel já indisponível → avisa antes de travar a peça (nada muda).
  const blockedEarly = await earlyBlock(admin, company.id, id, item.item_id)
  if (blockedEarly) return json({ ok: false, message: `🏠 ${blockedEarly}` })
  const { data: claimed } = await admin.from('marketing_ai_test_content').update({ status: 'publishing' })
    .eq('id', id).eq('status', 'vault').select('*').maybeSingle()
  if (!claimed) return json({ ok: false, message: 'Esse post já saiu do Vault (publicado ou movido no painel).' })
  // Peça planejada pra um dia FUTURO do calendário: aprovar agenda pro dia no horário padrão (_shared/publishSlot.ts);
  // o cron run-scheduled-actions-5min publica. Sem data, de hoje ou de dia passado: publica ao aprovar, como sempre.
  const plan = plannedPublishAt(claimed.planned_for)
  if (plan) {
    const { data: dup } = await admin.from('agent_actions').select('id').eq('company_id', company.id).eq('ref_type', 'marketing_ai_test_content').eq('ref_id', id).eq('execution_status', 'QUEUED').not('scheduled_at', 'is', null).limit(1).maybeSingle()
    if (dup) {
      await admin.from('marketing_ai_test_content').update({ status: 'vault' }).eq('id', id).eq('status', 'publishing')
      return json({ ok: true, message: `✅ Esse post já está aprovado e agendado (${publishWhenLabel(plan)}).` })
    }
  }
  const res = await proposeAction(admin, company.id, {
    agent_key: 'content', agent_name: 'Vault', action_type: 'create_content', channel: 'instagram', source: 'telegram',
    ref_type: 'marketing_ai_test_content', ref_id: id, title: claimed.idea ?? 'Post do Vault',
    agent_interpretation: `Aprovado pelo dono no Telegram (nota de qualidade ${claimed.quality_score ?? '—'})${plan ? `, agendado pro dia planejado (${publishWhenLabel(plan)})` : ''}.`,
    payload: { idea: claimed.idea, caption: claimed.caption, hashtags: claimed.hashtags, cta: claimed.cta, image_url: claimed.image_url, media: claimed.media, item_id: claimed.item_id ?? null },
    ...(plan ? { scheduled_at: plan.iso } : {}),
  }, false, true, company.user_id)
  const out = await res.json().catch(() => ({})) as { action?: { execution_status?: string; execution_error?: string; execution_result?: { published_to_instagram?: boolean } }; error?: string }
  const a = out.action
  // Só devolve pro Vault se a ação nem chegou a ser criada. Se foi criada, o
  // executor já cuidou (virou post, ou falhou e dá pra tentar de novo pela
  // Central) — devolver aqui arriscaria publicar duas vezes.
  // Agendada: a peça fica no Vault até o cron publicar (igual ao botão "Agendar" do painel); o 2º toque cai no dup acima.
  if (!a || plan) await admin.from('marketing_ai_test_content').update({ status: 'vault' }).eq('id', id).eq('status', 'publishing')
  if (plan && a) return json({ ok: true, message: `✅ Aprovado! Vai sair no Instagram ${publishWhenLabel(plan)}. Até lá você ainda pode cancelar o agendamento no painel.` })
  if (a?.execution_status === 'EXECUTED' && a.execution_result?.published_to_instagram) return json({ ok: true, message: '🎉 Publicado no Instagram!' })
  if (a?.execution_status === 'FAILED') return json({ ok: false, message: `⚠️ Aprovado, mas não publicou: ${a.execution_error ?? 'erro desconhecido'}` })
  if (a?.execution_status === 'QUEUED') return json({ ok: false, message: HOLD_MESSAGE }) // peça segue "publishing" até o cron publicar ou desistir
  return json({ ok: !!a, message: a ? '✅ Aprovado e salvo na aba Posts.' : `⚠️ Não consegui aprovar: ${out.error ?? 'erro desconhecido'}` })
}

// Roda toda ação AGENDADA cujo horário já venceu — chamada pelo cron de 5 em
// 5 min (migration 066). Uma falhando não impede as outras.
async function runScheduled(admin: Supa) {
  const { data: due } = await admin.from('agent_actions').select('*')
    .eq('execution_status', 'QUEUED').not('scheduled_at', 'is', null).lte('scheduled_at', new Date().toISOString())
  let executed = 0, failed = 0
  for (const act of (due ?? []) as Record<string, unknown>[]) {
    try { await execute(admin, act, true); executed++ } catch (e) { failed++; console.error('agent-actions run_scheduled falhou pra', act.id, e) }
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

// Aprovar a semana (2026-11-10, pedido do dono): o dono VIU os posts da semana na tela e aprova todos com 1
// clique. Cada peça vira uma ação APROVADA por ele (approved_by = quem clicou), AGENDADA pro dia planejado —
// o mesmo caminho do "Agendar" de uma peça só (proposeAction com scheduled_at). O cron publica no dia, com as
// travas de sempre na hora de sair. Peça que não dá pra agendar fica de fora com o motivo; as outras seguem.
async function approveWeek(admin: Supa, companyId: string, rawIds: unknown, userId: string) {
  const ids = parseWeekIds(rawIds)
  if (!ids) return json({ error: `Envie de 1 a ${WEEK_MAX} peças.` }, 400)
  const [{ data: rows, error: e1 }, { data: queued, error: e2 }] = await Promise.all([
    admin.from('marketing_ai_test_content').select('id, status, planned_for, recipe, video_url, idea, caption, hashtags, cta, image_url, media, item_id, quality_score')
      .eq('company_id', companyId).in('id', ids),
    admin.from('agent_actions').select('ref_id').eq('company_id', companyId).eq('ref_type', 'marketing_ai_test_content')
      .in('ref_id', ids).eq('execution_status', 'QUEUED').not('scheduled_at', 'is', null),
  ])
  if (e1 || e2) return json({ error: (e1 ?? e2)!.message }, 500)
  // deno-lint-ignore no-explicit-any
  const plan = planWeek(ids, (rows ?? []) as any[], new Set(((queued ?? []) as { ref_id: string }[]).map(r => r.ref_id)))
  const scheduled: { id: string; action_id: string; when: string }[] = []
  const skipped: { id: string; reason: SkipReason; label: string }[] = plan.skipped.map(s => ({ ...s, label: SKIP_LABEL[s.reason] }))
  for (const { piece: p, slot } of plan.toSchedule) {
    try {
      // Confere de novo logo antes (2 cliques seguidos / outra aba): já agendada não agenda 2x.
      const { data: dup } = await admin.from('agent_actions').select('id').eq('company_id', companyId).eq('ref_type', 'marketing_ai_test_content')
        .eq('ref_id', p.id).eq('execution_status', 'QUEUED').not('scheduled_at', 'is', null).limit(1).maybeSingle()
      if (dup) { skipped.push({ id: p.id, reason: 'already_scheduled', label: SKIP_LABEL.already_scheduled }); continue }
      const res = await proposeAction(admin, companyId, {
        agent_key: 'content', agent_name: 'Semana', action_type: 'create_content', channel: 'instagram', source: 'week',
        ref_type: 'marketing_ai_test_content', ref_id: p.id, title: p.idea ?? 'Post da semana',
        agent_interpretation: `Aprovado pelo dono na aprovação da semana (nota ${p.quality_score ?? '—'}), agendado pro ${publishWhenLabel(slot)}.`,
        payload: { idea: p.idea, caption: p.caption, hashtags: p.hashtags, cta: p.cta, image_url: p.image_url, media: p.media, item_id: p.item_id ?? null },
        scheduled_at: slot.iso,
      }, false, false, userId)
      const out = await res.json().catch(() => ({})) as { action?: { id: string }; error?: string; code?: string }
      if (out.action) scheduled.push({ id: p.id, action_id: out.action.id, when: slot.iso })
      else {
        const reason: SkipReason = out.code === 'item_unavailable' ? 'item_unavailable' : 'error'
        skipped.push({ id: p.id, reason, label: SKIP_LABEL[reason] })
      }
    } catch (e) {
      console.error('agent-actions approve_week: peça falhou', p.id, String(e).slice(0, 200))
      skipped.push({ id: p.id, reason: 'error', label: SKIP_LABEL.error })
    }
  }
  return json({ scheduled, skipped })
}

// Cancela de uma vez os agendamentos que a tela mostrou (ids de agent_actions). Igual ao "Cancelar" de um:
// volta a "aprovada, sem execução automática". Só mexe em ação agendada (QUEUED) de peça desta empresa.
async function unscheduleWeek(admin: Supa, companyId: string, rawIds: unknown) {
  const ids = parseWeekIds(rawIds)
  if (!ids) return json({ error: `Envie de 1 a ${WEEK_MAX} agendamentos.` }, 400)
  const { data, error } = await admin.from('agent_actions').update({
    scheduled_at: null, execution_status: 'NOT_READY', updated_at: new Date().toISOString(),
  }).in('id', ids).eq('company_id', companyId).eq('ref_type', 'marketing_ai_test_content').eq('execution_status', 'QUEUED')
    .not('scheduled_at', 'is', null).select('id')
  if (error) return json({ error: error.message }, 500)
  return json({ cancelled: (data ?? []).length })
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
  // Fase 4: aprovar/agendar peça de imóvel que já está indisponível → recusa com mensagem clara, antes de criar a ação.
  if ((auto || scheduledAt) && b.ref_type === 'marketing_ai_test_content') {
    const blocked = await earlyBlock(admin, companyId, typeof b.ref_id === 'string' ? b.ref_id : null, b.payload?.item_id)
    if (blocked) return json({ error: blocked, code: 'item_unavailable' }, 409)
  }
  // Fase 4: o item_id da peça vai junto no payload, pra nova tentativa depois de a peça ser apagada ainda conferir o imóvel.
  let payload = b.payload ?? {}
  if (b.ref_type === 'marketing_ai_test_content' && typeof b.ref_id === 'string' && typeof payload.item_id !== 'string') {
    try {
      const { data: tc } = await admin.from('marketing_ai_test_content').select('item_id').eq('id', b.ref_id).eq('company_id', companyId).maybeSingle()
      if (tc?.item_id) payload = { ...payload, item_id: tc.item_id }
    } catch (e) { console.error('agent-actions: copiar item_id pro payload falhou', String(e).slice(0, 200)) }
  }
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
    payload,
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
async function execute(admin: Supa, act: any, fromCron = false): Promise<any> {
  // Etapa 0 (2026-11-07): ação que publica só roda com aprovação HUMANA (AUTO_APPROVED nunca publica).
  const blocked = publishBlockReason(act)
  if (blocked) return await finish(admin, act.id, 'FAILED', { execution_error: blocked })
  // Etapa 1 (2026-11-07): ficha que exige registro profissional (CRECI) → sem registro válido não publica; com ele, o rodapé entra na legenda.
  const lic = publishes(act) ? await publishLicense(admin, act.company_id) : null
  if (lic?.block) {
    if (act.ref_type === 'marketing_ai_test_content') await admin.from('marketing_ai_test_content').update({ status: 'vault' }).eq('id', act.ref_id).eq('company_id', act.company_id).eq('status', 'publishing')
    return await finish(admin, act.id, 'FAILED', { execution_error: lic.block })
  }
  // Etapa 1B: legenda com frase que rotula quem pode comprar/alugar ou promete resultado não é publicada (recusa com motivo).
  const pub = publishes(act) ? await loadPublicTextRules(admin, act.company_id) : null
  const textBlock = (c: string) => publishTextBlock(c, pub?.rules ?? null)
  const withLicense = (c: string) => (lic?.footer && lic.rule && lic.license ? ensureFooter(c, lic.footer, lic.rule, lic.license) : c)
  // Fase 4: imóvel indisponível (ou impossível de conferir) NUNCA chega a publicar. A conferência vem ANTES de marcar EXECUTING.
  if (act.ref_type === 'marketing_ai_test_content' && act.ref_id) {
    const held = await availabilityGate(admin, act, fromCron)
    if (held) return held
  }
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
      const caption = withLicense([content?.caption, content?.hashtags].map(x => (x ? String(x) : '').trim()).filter(Boolean).join('\n\n'))
      const tb = textBlock(caption)
      if (tb) return await fail(tb)

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
      if (mediaId) await recordInstagramPost(admin, act.company_id, mediaId, caption, String(content?.image_url ?? ''))

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
      // Mesma trava no executor (painel, agendamento): peça de vídeo sem vídeo pronto não publica só a capa.
      const { data: vp } = await admin.from('marketing_ai_test_content').select('recipe, video_url').eq('id', act.ref_id).eq('company_id', act.company_id).maybeSingle()
      if (vp?.recipe === 'video_imovel' && !vp.video_url) return await fail('O vídeo desta peça ainda não está pronto — espere ele aparecer e tente de novo.')
      const p = act.payload ?? {}
      // Carrossel real (2-10 fotos) quando a peca tem media[] com mais de 1
      // item (ex: recipe 'carrossel_tour' do catalog-package) -- 1 item
      // continua publicando como foto unica, igual sempre foi.
      const mediaItems = Array.isArray(p.media) ? (p.media as { url?: string }[]).map(m => String(m?.url ?? '')).filter(Boolean) : []
      const coverUrl = mediaItems[0] ?? (p.image_url ? String(p.image_url) : '')
      // Foto mobiliada virtualmente (Etapa 2, 2026-11-11): o aviso da ficha sai SEMPRE, mesmo se a legenda foi editada.
      const stg = await stagingCheck(admin, act.company_id, p.item_id, coverUrl && !mediaItems.length ? [coverUrl] : mediaItems)
      const back = () => admin.from('marketing_ai_test_content').update({ status: 'vault' }).eq('id', act.ref_id).eq('company_id', act.company_id).eq('status', 'publishing')
      if (stg.block) { await back(); return await fail(stg.block) }
      const base = [p.caption, p.cta, p.hashtags].map(x => (x ? String(x) : '').trim()).filter(Boolean).join('\n\n')
      const caption = withLicense(stg.disclosure ? ensureDisclosure(base, stg.disclosure) : base)
      const tb = textBlock(caption)
      if (tb) {
        await back()
        return await fail(tb)
      }
      const { data: company } = await admin.from('companies').select('instagram_user_id, instagram_access_token').eq('id', act.company_id).maybeSingle()

      let mediaId: string | null = null
      let publishError: string | null = null
      if (company?.instagram_user_id && company?.instagram_access_token && coverUrl) {
        try {
          mediaId = mediaItems.length > 1
            ? await publishCarouselToInstagram(String(company.instagram_user_id), String(company.instagram_access_token), mediaItems, caption)
            : await publishToInstagram(String(company.instagram_user_id), String(company.instagram_access_token), coverUrl, caption)
        } catch (e) {
          publishError = e instanceof Error ? e.message : String(e)
        }
      } else if (!company?.instagram_user_id || !company?.instagram_access_token) {
        publishError = 'Instagram não conectado — post salvo como aprovado, publique manualmente na aba Posts.'
      }

      const { data: postRow, error } = await admin.from('posts').insert({
        company_id: act.company_id, content: caption, image_url: coverUrl || null, image_suggestion: p.idea ?? null,
        agent_notes: act.agent_interpretation ?? act.reason ?? null, platform: 'instagram',
        status: mediaId ? 'publicado' : 'aprovado',
        instagram_media_id: mediaId, published_at: mediaId ? new Date().toISOString() : null,
      }).select('id').single()
      if (error) return await fail(error.message)
      // P2 (80/20): guarda pilar/receita/formato/item no post ANTES de apagar a
      // linha de teste. Update separado e tolerante: se as colunas novas ainda
      // não existem em produção (migration pendente), o post já foi criado e
      // publica normalmente, só sem esses campos.
      try {
        if (postRow?.id) {
          const { data: tc } = await admin.from('marketing_ai_test_content').select('pillar, recipe, format, item_id').eq('id', act.ref_id).eq('company_id', act.company_id).maybeSingle()
          const meta = {
            pillar: tc?.pillar ?? p.pillar ?? null, recipe: tc?.recipe ?? p.recipe ?? null,
            format: tc?.format ?? p.format ?? null, item_id: tc?.item_id ?? p.item_id ?? null,
          }
          if (Object.values(meta).some(v => v)) await admin.from('posts').update(meta).eq('id', postRow.id).eq('company_id', act.company_id)
        }
      } catch (e) { console.error('agent-actions: gravar pilar/receita no post falhou (ignorado):', e) }
      // Rótulos da fase 3 (familia · pilar_ss) em bloco SEPARADO: se a migration das colunas faltar, só este
      // bloco falha (e é logado) — o select acima continua sem elas. Só grava se houver valor.
      try {
        if (postRow?.id) {
          const { data: lb, error: lerr } = await admin.from('marketing_ai_test_content').select('familia, pilar_ss').eq('id', act.ref_id).eq('company_id', act.company_id).maybeSingle()
          if (lerr) console.error('agent-actions: ler familia/pilar_ss da peça falhou (ignorado):', lerr.message)
          else {
            const rotulos: Record<string, string> = {}
            if (lb?.familia) rotulos.familia = String(lb.familia)
            if (lb?.pilar_ss) rotulos.pilar_ss = String(lb.pilar_ss)
            if (Object.keys(rotulos).length) {
              const { error: uerr } = await admin.from('posts').update(rotulos).eq('id', postRow.id).eq('company_id', act.company_id)
              if (uerr) console.error('agent-actions: gravar familia/pilar_ss no post falhou (ignorado):', uerr.message)
            }
          }
        }
      } catch (e) { console.error('agent-actions: gravar familia/pilar_ss no post falhou (ignorado):', e) }
      // Etapa 4B: o vínculo com a oportunidade (opportunity_id) segue a peça até o post aprovado — é por ele que a Etapa 6
      // mede o resultado por oportunidade. Bloco SEPARADO e tolerante, como os rótulos: sem a coluna, só este bloco falha.
      try {
        if (postRow?.id) {
          const { data: ob, error: oerr } = await admin.from('marketing_ai_test_content').select('opportunity_id').eq('id', act.ref_id).eq('company_id', act.company_id).maybeSingle()
          if (oerr) console.error('agent-actions: ler opportunity_id da peça falhou (ignorado):', oerr.message)
          else if (ob?.opportunity_id) {
            const { error: uerr } = await admin.from('posts').update({ opportunity_id: ob.opportunity_id }).eq('id', postRow.id).eq('company_id', act.company_id)
            if (uerr) console.error('agent-actions: gravar opportunity_id no post falhou (ignorado):', uerr.message)
          }
        }
      } catch (e) { console.error('agent-actions: gravar opportunity_id no post falhou (ignorado):', e) }
      // Fase 4: o motivo da escolha do imóvel (item_pick) também segue até o post aprovado. Bloco SEPARADO e tolerante, como os outros.
      try {
        if (postRow?.id) {
          const { data: pk, error: perr } = await admin.from('marketing_ai_test_content').select('item_pick').eq('id', act.ref_id).eq('company_id', act.company_id).maybeSingle()
          if (perr) console.error('agent-actions: ler item_pick da peça falhou (ignorado):', perr.message)
          else if (pk?.item_pick) {
            const { error: uerr } = await admin.from('posts').update({ item_pick: pk.item_pick }).eq('id', postRow.id).eq('company_id', act.company_id)
            if (uerr) console.error('agent-actions: gravar item_pick no post falhou (ignorado):', uerr.message)
          }
        }
      } catch (e) { console.error('agent-actions: gravar item_pick no post falhou (ignorado):', e) }
      await admin.from('marketing_ai_test_content').delete().eq('id', act.ref_id).eq('company_id', act.company_id)
      if (mediaId) await recordInstagramPost(admin, act.company_id, mediaId, caption, coverUrl)

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

// Fase 4 (2026-11-04) — trava de disponibilidade na hora de publicar (itemService.revalidate: status manual + link do portal).
//  - bloqueado  → FAILED "Imóvel indisponível (<status>). Não publiquei."; a peça NÃO é apagada e, se estava "publishing"
//                 (Telegram), volta pro Vault;
//  - não deu pra conferir → NÃO publica: a ação fica QUEUED (o cron de 5 em 5 min tenta de novo); depois de 2 h vira FAILED
//                 "Não foi possível verificar a disponibilidade". Item só manual nunca cai aqui (revalidate devolve ok).
// Devolve a linha da ação quando segurou a execução; null = pode seguir. Peça sem imóvel passa direto.
// deno-lint-ignore no-explicit-any
async function availabilityGate(admin: Supa, act: any, fromCron: boolean): Promise<any | null> {
  let itemId: string | null = typeof act.payload?.item_id === 'string' ? act.payload.item_id : null
  let readFailed = false
  try {
    // item_id da peça de teste; se a linha já foi apagada (nova tentativa depois de uma falha), vale o que foi guardado no payload da ação (gravado na proposta).
    const { data: tc, error } = await admin.from('marketing_ai_test_content').select('item_id').eq('id', act.ref_id).eq('company_id', act.company_id).maybeSingle()
    if (error) readFailed = true
    else itemId = (tc?.item_id as string | null | undefined) ?? itemId
  } catch (e) { readFailed = true; console.error('agent-actions: ler item_id da peça falhou', String(e).slice(0, 200)) }
  // Falha ao LER nunca vira "sem imóvel": sem item_id conhecido, segura como não verificável (tenta de novo / falha em 2 h).
  if (!itemId && !readFailed) return null
  const v = itemId ? await revalidate(admin, act.company_id, itemId) : { state: 'unverifiable' as const, reason: 'não consegui ler a peça' }
  if (v.state === 'ok') return null
  const backToVault = () => admin.from('marketing_ai_test_content').update({ status: 'vault' }).eq('id', act.ref_id).eq('company_id', act.company_id).eq('status', 'publishing')
  if (v.state === 'blocked') {
    await backToVault()
    return await finish(admin, act.id, 'FAILED', { execution_error: `Imóvel indisponível (${v.label.toLowerCase() || 'sem status'}). Não publiquei.` })
  }
  // Não verificável. Chamada manual (aprovar agora, "tentar de novo") abre uma janela nova de 2 h; o cron respeita a que já corre.
  const now = Date.now()
  const stale = !act.scheduled_at || (!fromCron && unverifiableOutcome(act.scheduled_at, now) === 'fail')
  const since: string = stale ? new Date(now).toISOString() : act.scheduled_at
  if (unverifiableOutcome(since, now) === 'fail') {
    await backToVault()
    return await finish(admin, act.id, 'FAILED', { execution_error: UNVERIFIABLE_FAIL_MESSAGE })
  }
  console.error('agent-actions: disponibilidade não verificável — segurando (tenta de novo em 5 min)', act.id, v.reason)
  const { data } = await admin.from('agent_actions').update({
    execution_status: 'QUEUED', scheduled_at: since, updated_at: new Date().toISOString(), execution_error: null,
    execution_result: { waiting: 'availability_unverifiable', reason: v.reason, since },
  }).eq('id', act.id).select('*').single()
  return data ?? { ...act, execution_status: 'QUEUED', scheduled_at: since }
}

// Aviso antecipado (propor/agendar/Telegram): só diz "não" quando o imóvel está CLARAMENTE indisponível. Se não deu pra conferir, deixa seguir
// — a trava do executor segura e tenta de novo. Devolve a mensagem em português, ou null.
async function earlyBlock(admin: Supa, companyId: string, testContentId: string | null | undefined, payloadItemId?: unknown): Promise<string | null> {
  try {
    let itemId: string | null = typeof payloadItemId === 'string' ? payloadItemId : null
    if (testContentId) {
      const { data: tc } = await admin.from('marketing_ai_test_content').select('item_id').eq('id', testContentId).eq('company_id', companyId).maybeSingle()
      itemId = (tc?.item_id as string | null | undefined) ?? itemId
    }
    if (!itemId) return null
    const v = await revalidate(admin, companyId, itemId)
    return v.state === 'blocked' ? `Imóvel indisponível (${v.label.toLowerCase() || 'sem status'}). Não publiquei.` : null
  } catch (e) { console.error('agent-actions: aviso antecipado falhou (segue)', String(e).slice(0, 200)); return null }
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

async function createMediaContainer(igUserId: string, token: string, body: Record<string, unknown>): Promise<string> {
  const res = await fetch(`${IG_API}/${igUserId}/media`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...body, access_token: token }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(`Falha ao preparar mídia no Instagram: ${err.error?.message ?? JSON.stringify(err)}`)
  }
  const { id } = await res.json()
  return id
}

async function mediaPublish(igUserId: string, token: string, creationId: string): Promise<string> {
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

async function publishToInstagram(igUserId: string, token: string, imageUrl: string, caption: string): Promise<string> {
  const creationId = await createMediaContainer(igUserId, token, { image_url: imageUrl, caption })
  await waitContainerReady(creationId, token)
  return await mediaPublish(igUserId, token, creationId)
}

// Carrossel real (2-10 fotos, fluxo oficial: containers filhos +
// container CAROUSEL + media_publish). Os containers filhos sao criados E
// esperados em PARALELO (Promise.all), nao em fila -- o waitContainerReady
// de cada um pode levar ate 30s, e em fila 10 fotos estourariam os 150s do
// plano Free do Supabase; em paralelo o pior caso fica perto de 30s (so
// mais o container-pai depois). Todas as fotos precisam ja estar na mesma
// proporcao (o pipeline de upload do catalogo garante isso, ver
// imageProcessing.ts) -- o Instagram corta pra bater com a primeira senao.
async function publishCarouselToInstagram(igUserId: string, token: string, mediaUrls: string[], caption: string): Promise<string> {
  const urls = mediaUrls.slice(0, 10)
  if (urls.length < 2) throw new Error('Carrossel precisa de pelo menos 2 fotos.')

  const childIds = await Promise.all(urls.map(url => createMediaContainer(igUserId, token, { image_url: url, is_carousel_item: true })))
  await Promise.all(childIds.map(id => waitContainerReady(id, token)))

  const parentId = await createMediaContainer(igUserId, token, { media_type: 'CAROUSEL', children: childIds, caption })
  await waitContainerReady(parentId, token)

  return await mediaPublish(igUserId, token, parentId)
}

// Bug antigo (ate 2026-09-30): o publicador real (aqui) nunca gravava em
// instagram_posts -- so a function deprecada publish-instagram gravava, e
// ela nunca chegou a rodar em produção (0 chamadores). Isso deixava
// VisualLibrary/AgentTabExtras/detect-opportunities/generate-tab-insight/
// business-progress/enzo-daily-report lendo uma tabela sempre vazia.
async function recordInstagramPost(admin: Supa, companyId: string, mediaId: string, caption: string, imageUrl: string) {
  await admin.from('instagram_posts').insert({
    company_id: companyId, instagram_media_id: mediaId, caption, image_url: imageUrl || null,
    status: 'published', posted_at: new Date().toISOString(),
  })
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
