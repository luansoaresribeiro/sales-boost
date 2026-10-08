import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Stripe from 'https://esm.sh/stripe@14?target=deno'

const PLAN_PRICE_IDS: Record<string, string> = {}

const toIso = (unixSeconds: number | null | undefined) => (unixSeconds ? new Date(unixSeconds * 1000).toISOString() : null)

async function logAccessEvent(admin: ReturnType<typeof createClient>, companyId: string, event: string, detail: string) {
  try { await admin.from('access_audit_log').insert({ company_id: companyId, event, actor: 'stripe', detail }) } catch { /* nunca derruba o webhook por causa do log */ }
}

// Multa de cancelamento antecipado do plano anual (decisão do dono):
// 30% × meses restantes × R$1.449. Meses restantes = meses de calendário
// ARREDONDADOS PRA CIMA entre a data efetiva do fim e commitment_end_at.
// Só REGISTRA — nunca cobra (cobrança é manual, decisão do dono).
const MONTHLY_ANNUAL_CENTS = 144900
function addMonths(d: Date, n: number) { const r = new Date(d); r.setUTCMonth(r.getUTCMonth() + n); return r }
function earlyTerminationFeeCents(effectiveEnd: Date, commitmentEnd: Date): number {
  let months = 0
  while (months < 12 && addMonths(effectiveEnd, months) < commitmentEnd) months++
  return Math.round(0.3 * months * MONTHLY_ANNUAL_CENTS)
}

async function applyEarlyTerminationFee(
  admin: ReturnType<typeof createClient>,
  company: { id: string; billing_plan: string | null; commitment_end_at: string | null },
  effectiveEnd: Date,
  reason: string,
) {
  if (company.billing_plan !== 'annual_commit' || !company.commitment_end_at) return
  const fee = earlyTerminationFeeCents(effectiveEnd, new Date(company.commitment_end_at))
  await admin.from('companies').update({ early_termination_fee_cents: fee }).eq('id', company.id)
  if (fee > 0) {
    await logAccessEvent(admin, company.id, 'early_termination_fee_recorded',
      `${reason} Multa de cancelamento antecipado registrada: R$ ${(fee / 100).toFixed(2)} (30% das mensalidades restantes). NÃO foi cobrada — cobrança manual.`)
  }
}

function planFromPriceId(priceId: string): string {
  const basic = Deno.env.get('STRIPE_PRICE_BASIC')
  const pro = Deno.env.get('STRIPE_PRICE_PRO')
  if (priceId === pro) return 'pro'
  if (priceId === basic) return 'basic'
  return 'free'
}

Deno.serve(async (req) => {
  const stripeKey = Deno.env.get('STRIPE_SECRET_KEY')!
  const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET')!
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

  if (!stripeKey || !webhookSecret) {
    return new Response('Stripe não configurado', { status: 503 })
  }

  const signature = req.headers.get('stripe-signature')
  if (!signature) return new Response('Missing signature', { status: 400 })

  const body = await req.text()
  const stripe = new Stripe(stripeKey, { apiVersion: '2024-06-20' })
  const admin = createClient(supabaseUrl, serviceKey)

  let event: Stripe.Event
  try {
    event = await stripe.webhooks.constructEventAsync(body, signature, webhookSecret)
  } catch {
    return new Response('Invalid signature', { status: 400 })
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session
        const companyId = session.client_reference_id
        if (!companyId || session.mode !== 'subscription') break

        const subscription = await stripe.subscriptions.retrieve(session.subscription as string)
        const priceId = subscription.items.data[0]?.price.id ?? ''
        const lookupKey = subscription.items.data[0]?.price.lookup_key ?? ''
        const billingPlan = lookupKey === 'sb_annual_commit' ? 'annual_commit' : lookupKey === 'sb_monthly' ? 'monthly' : null
        // Planos novos: plano único com tudo ('pro' na coluna plan, que o resto do app usa).
        const plan = billingPlan ? 'pro' : planFromPriceId(priceId)
        const commitmentEndAt = billingPlan === 'annual_commit' ? addMonths(new Date(subscription.start_date * 1000), 12).toISOString() : null

        await admin.from('companies').update({
          ...(billingPlan ? { billing_plan: billingPlan, commitment_end_at: commitmentEndAt, early_termination_fee_cents: null } : {}),
          plan,
          stripe_customer_id: session.customer as string,
          stripe_subscription_id: subscription.id,
          subscription_status: subscription.status,
          current_period_start: toIso(subscription.current_period_start),
          current_period_end: toIso(subscription.current_period_end),
          subscription_cancelled_at: null,
        }).eq('id', companyId)
        await logAccessEvent(admin, companyId, 'payment_confirmed', `Assinatura ${plan} confirmada via Stripe — acesso liberado automaticamente.`)
        break
      }

      case 'customer.subscription.updated': {
        const sub = event.data.object as Stripe.Subscription
        const priceId = sub.items.data[0]?.price.id ?? ''
        const plan = planFromPriceId(priceId)
        const status = sub.status

        // Só mantém o plano pago se a assinatura estiver active/trialing;
        // caso contrário volta pra 'free' — subscription_status é a fonte
        // de verdade do estado real (past_due, unpaid, canceled etc), plan
        // só reflete o que o cliente pode usar.
        const lk = sub.items.data[0]?.price.lookup_key
        const isNewPlan = lk === 'sb_monthly' || lk === 'sb_annual_commit'
        const activePlan = ['active', 'trialing'].includes(status) ? (isNewPlan ? 'pro' : plan) : 'free'

        const { data: company } = await admin.from('companies')
          .update({
            plan: activePlan,
            subscription_status: status,
            current_period_start: toIso(sub.current_period_start),
            current_period_end: toIso(sub.current_period_end),
          })
          .eq('stripe_subscription_id', sub.id)
          .select('id, billing_plan, commitment_end_at').maybeSingle()
        if (company) {
          await logAccessEvent(admin, company.id, 'subscription_updated', `Status da assinatura no Stripe: ${status}.`)
          // Cancelamento agendado antes do fim da fidelidade -> registra a multa (sem cobrar).
          // Se o cliente desfez o cancelamento, limpa a multa registrada.
          const scheduledEnd = sub.cancel_at ?? (sub.cancel_at_period_end ? sub.current_period_end : null)
          if (company.billing_plan === 'annual_commit' && ['active', 'trialing'].includes(status)) {
            if (scheduledEnd) await applyEarlyTerminationFee(admin, company, new Date(scheduledEnd * 1000), 'Cancelamento agendado no Stripe.')
            else await admin.from('companies').update({ early_termination_fee_cents: null }).eq('id', company.id)
          }
        }
        break
      }

      case 'customer.subscription.deleted': {
        const sub = event.data.object as Stripe.Subscription
        const { data: company } = await admin.from('companies')
          .update({ plan: 'free', stripe_subscription_id: null, subscription_status: 'canceled', subscription_cancelled_at: new Date().toISOString() })
          .eq('stripe_subscription_id', sub.id)
          .select('id, billing_plan, commitment_end_at').maybeSingle()
        if (company) {
          await logAccessEvent(admin, company.id, 'subscription_cancelled', 'Assinatura cancelada no Stripe.')
          await applyEarlyTerminationFee(admin, company, new Date((sub.ended_at ?? sub.canceled_at ?? Math.floor(Date.now() / 1000)) * 1000), 'Assinatura anual encerrada antes do fim da fidelidade.')
        }
        break
      }
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (err) {
    return new Response(String(err), { status: 500 })
  }
})

// Silence unused import warning
void PLAN_PRICE_IDS
