import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Stripe from 'https://esm.sh/stripe@14?target=deno'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const PLAN_PRICE_IDS_BRL: Record<string, string | undefined> = {
  basic: Deno.env.get('STRIPE_PRICE_BASIC'),
  pro:   Deno.env.get('STRIPE_PRICE_PRO'),
  ultra: Deno.env.get('STRIPE_PRICE_ULTRA'),
}

const PLAN_PRICE_IDS_USD: Record<string, string | undefined> = {
  basic: Deno.env.get('STRIPE_PRICE_BASIC_USD'),
  pro:   Deno.env.get('STRIPE_PRICE_PRO_USD'),
  ultra: Deno.env.get('STRIPE_PRICE_ULTRA_USD'),
}

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

    const { plan, region, success_url, cancel_url } = await req.json()
    const priceMap = (region === 'us' && PLAN_PRICE_IDS_USD[plan]) ? PLAN_PRICE_IDS_USD : PLAN_PRICE_IDS_BRL
    if (!plan || !priceMap[plan]) return json({ error: 'Plano inválido.' }, 400)

    const priceId = priceMap[plan]!
    const admin = createClient(supabaseUrl, serviceKey)
    const stripe = new Stripe(stripeKey, { apiVersion: '2024-06-20' })

    const { data: company } = await admin
      .from('companies')
      .select('id, business_name, stripe_customer_id')
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

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      client_reference_id: company.id,
      success_url: success_url ?? `${Deno.env.get('SITE_URL') ?? 'https://sales-boost-restaurants.luancontasecundaria22.workers.dev'}/planos?upgrade=success`,
      cancel_url: cancel_url ?? `${Deno.env.get('SITE_URL') ?? 'https://sales-boost-restaurants.luancontasecundaria22.workers.dev'}/planos`,
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
