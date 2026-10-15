/**
 * nearby-places — Agente de Dados → "Lugares perto" (etapa 1, 2026-10-14).
 * O dono abre um imóvel e vê o que tem em volta (praia, metrô, escola,
 * mercado…), buscado de graça no OpenStreetMap e guardado no item
 * (meta.nearby). Distância calculada em linha reta, nunca inventada.
 *
 * Body: { item_id, refresh?: boolean }. Só o dono da empresa (JWT).
 * A lógica mora em _shared/nearbyPlaces.ts (o catalog-package usa a mesma
 * pra escrever o post "3 coisas perto" com lugares de verdade).
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { ensureNearby, fetchNearbyConfig } from '../_shared/nearbyPlaces.ts'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const admin = createClient(supabaseUrl, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
    const bearer = req.headers.get('Authorization') ?? ''
    if (!bearer) return json({ error: 'Unauthorized' }, 401)
    const userClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: bearer } } })
    const { data: { user } } = await userClient.auth.getUser()
    if (!user) return json({ error: 'Unauthorized' }, 401)

    const body = await req.json().catch(() => ({})) as Record<string, unknown>
    const itemId = typeof body.item_id === 'string' && UUID.test(body.item_id) ? body.item_id : ''
    if (!itemId) return json({ error: 'item_id obrigatório' }, 400)

    const { data: company } = await admin.from('companies').select('id, vertical_key, city').eq('user_id', user.id).maybeSingle()
    if (!company) return json({ error: 'Empresa não encontrada' }, 404)
    const cfg = await fetchNearbyConfig(admin, company.vertical_key as string | null)
    if (!cfg) return json({ error: 'Este setor não usa "Lugares perto".' }, 400)

    const { data: item } = await admin.from('marketing_ai_knowledge').select('meta').eq('id', itemId).eq('company_id', company.id).eq('kind', 'product').maybeSingle()
    if (!item) return json({ error: 'Item não encontrado' }, 404)

    // Buscar de novo no máximo 1x por minuto por imóvel (o OpenStreetMap é
    // grátis, mas pede uso moderado).
    const last = (item.meta as { nearby?: { fetched_at?: string } } | null)?.nearby?.fetched_at
    const refresh = body.refresh === true && !(last && Date.now() - Date.parse(last) < 60_000)

    const nearby = await ensureNearby(admin, { itemId, companyId: company.id as string, verticalKey: company.vertical_key as string | null, city: String(company.city ?? ''), refresh })
    if (!nearby) return json({ error: 'Preencha o bairro (ou o endereço) do imóvel pra buscar o que tem perto.' }, 400)
    return json({ ok: true, nearby, categories: cfg.categories.map(c => ({ key: c.key, label: c.label, emoji: c.emoji })), radius_m: cfg.radius_m })
  } catch (err) {
    console.error('nearby-places', err)
    return json({ error: 'Não consegui buscar os lugares agora. Tente de novo.' }, 500)
  }
})

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { ...cors, 'Content-Type': 'application/json' } })
}
