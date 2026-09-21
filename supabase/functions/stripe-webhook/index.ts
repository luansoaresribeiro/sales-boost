import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Stripe from 'https://esm.sh/stripe@14?target=deno'

const PLAN_PRICE_IDS: Record<string, string> = {}

const toIso = (unixSeconds: number | null | undefined) => (unixSeconds ? new Date(unixSeconds * 1000).toISOString() : null)

async function logAccessEvent(admin: ReturnType<typeof createClient>, companyId: string, event: string, detail: string) {
  try { await admin.from('access_audit_log').insert({ company_id: companyId, event, actor: 'stripe', detail }) } catch { /* nunca derruba o webhook por causa do log */ }
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
        const plan = planFromPriceId(priceId)

        await admin.from('companies').update({
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
        const activePlan = ['active', 'trialing'].includes(status) ? plan : 'free'

        const { data: company } = await admin.from('companies')
          .update({
            plan: activePlan,
            subscription_status: status,
            current_period_start: toIso(sub.current_period_start),
            current_period_end: toIso(sub.current_period_end),
          })
          .eq('stripe_subscription_id', sub.id)
          .select('id').maybeSingle()
        if (company) await logAccessEvent(admin, company.id, 'subscription_updated', `Status da assinatura no Stripe: ${status}.`)
        break
      }

      case 'customer.subscription.deleted': {
        const sub = event.data.object as Stripe.Subscription
        const { data: company } = await admin.from('companies')
          .update({ plan: 'free', stripe_subscription_id: null, subscription_status: 'canceled', subscription_cancelled_at: new Date().toISOString() })
          .eq('stripe_subscription_id', sub.id)
          .select('id').maybeSingle()
        if (company) await logAccessEvent(admin, company.id, 'subscription_cancelled', 'Assinatura cancelada no Stripe.')
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
