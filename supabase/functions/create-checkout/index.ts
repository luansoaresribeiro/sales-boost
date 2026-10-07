import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Stripe from 'https://esm.sh/stripe@14?target=deno'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Planos (decisão do dono, 2026-10-07). O price é buscado no Stripe pelo
// lookup_key — não há mais env de price id. Secret necessária: STRIPE_SECRET_KEY.
const PLAN_LOOKUP_KEYS: Record<string, string> = {
  monthly: 'sb_monthly',
  annual_commit: 'sb_annual_commit',
}
const COUPON_ID = 'SB_PRIMEIRO_MES'
const COUPON_WINDOW_MS = 7 * 24 * 60 * 60 * 1000

const COMMITMENT_MESSAGE =
  'Plano anual com fidelidade de 12 meses, cobrado mensalmente (R$ 1.449/mês). ' +
  'Se você cancelar antes de completar os 12 meses, será devida uma multa de 30% do valor das mensalidades restantes ' +
  '(30% × meses restantes × R$ 1.449). Ao confirmar, você declara que leu e concorda com esta condição.'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return json({ error: 'Unauthorized' }, 401)

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? supabaseAnonKey
    const stripeKey = Deno.env.get('STRIPE_SECRET_KEY')

    if (!stripeKey) return json({ error: 'Stripe não configurado.' }, 503)

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    })
    const { data: { user }, error: userErr } = await userClient.auth.getUser()
    if (userErr || !user) return json({ error: 'Unauthorized' }, 401)

    const { plan, success_url, cancel_url } = await req.json()
    if (typeof plan !== 'string' || !PLAN_LOOKUP_KEYS[plan]) return json({ error: 'Plano inválido.' }, 400)

    const admin = createClient(supabaseUrl, serviceKey)
    const stripe = new Stripe(stripeKey, { apiVersion: '2024-06-20' })

    const prices = await stripe.prices.list({ lookup_keys: [PLAN_LOOKUP_KEYS[plan]], active: true, limit: 1 })
    const priceId = prices.data[0]?.id
    if (!priceId) return json({ error: 'Preço do plano não encontrado no Stripe.' }, 503)

    const { data: company } = await admin
      .from('companies')
      .select('id, business_name, stripe_customer_id, billing_plan, coupon_offer_shown_at')
      .eq('user_id', user.id)
      .maybeSingle()

    if (!company) return json({ error: 'Empresa não encontrada.' }, 404)

    // Get or create Stripe customer
    let customerId = company.stripe_customer_id
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        name: company.business_name,
        metadata: { company_id: company.id, user_id: user.id },
      })
      customerId = customer.id
      await admin.from('companies').update({ stripe_customer_id: customerId }).eq('id', company.id)
    }

    // Cupom do 1º mês: só no mensal, só se a oferta foi vista há no máximo 7 dias
    // (conferido aqui, no servidor) e só pra quem nunca assinou antes.
    const shownAt = company.coupon_offer_shown_at ? new Date(company.coupon_offer_shown_at).getTime() : NaN
    const couponValid = plan === 'monthly' && !company.billing_plan
      && Number.isFinite(shownAt) && shownAt <= Date.now() && Date.now() - shownAt <= COUPON_WINDOW_MS

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      client_reference_id: company.id,
      success_url: success_url ?? `${Deno.env.get('SITE_URL') ?? 'https://getsaleboost.com'}/planos?upgrade=success`,
      cancel_url: cancel_url ?? `${Deno.env.get('SITE_URL') ?? 'https://getsaleboost.com'}/planos`,
      ...(couponValid ? { discounts: [{ coupon: COUPON_ID }] } : {}),
      ...(plan === 'annual_commit' ? { custom_text: { submit: { message: COMMITMENT_MESSAGE } } } : {}),
      metadata: { company_id: company.id, plan },
      subscription_data: {
        metadata: { company_id: company.id, plan },
      },
    })

    return json({ url: session.url })
  } catch (err) {
    return json({ error: String(err) }, 500)
  }
})

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}
