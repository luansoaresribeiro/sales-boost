import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  try {
    // JWT check
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return json({ error: 'Unauthorized' }, 401)

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } })
    const { data: { user }, error: authErr } = await userClient.auth.getUser()
    if (authErr || !user) return json({ error: 'Unauthorized' }, 401)

    const apiKey = Deno.env.get('GOOGLE_PLACES_API_KEY')
    if (!apiKey) {
      return json({
        error: 'GOOGLE_PLACES_API_KEY não configurada nos Secrets do Supabase.',
        hint: 'Supabase Dashboard → Settings → Edge Functions → Add new secret → GOOGLE_PLACES_API_KEY',
      }, 500)
    }

    const body = await req.json()
    const query: string = body?.query ?? ''
    if (!query.trim()) return json({ error: 'query é obrigatório' }, 400)

    // ─ Tenta nova Places API (Places API - New) ─
    const newApiRes = await fetch('https://places.googleapis.com/v1/places:searchText', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.rating,places.userRatingCount,places.location',
      },
      body: JSON.stringify({ textQuery: query, languageCode: 'pt-BR', maxResultCount: 5 }),
    })

    if (newApiRes.ok) {
      const newData = await newApiRes.json()
      const places = newData.places ?? []
      const results = places.map((p: {
        id: string
        displayName?: { text: string }
        formattedAddress?: string
        rating?: number
        userRatingCount?: number
        location?: { latitude: number; longitude: number }
      }) => ({
        place_id: p.id,
        name: p.displayName?.text ?? '',
        address: p.formattedAddress ?? '',
        rating: p.rating ?? null,
        review_count: p.userRatingCount ?? null,
        lat: p.location?.latitude ?? null,
        lng: p.location?.longitude ?? null,
      }))
      return json({ results, api: 'new' })
    }

    // ─ Fallback: antiga Places API ─
    const oldApiUrl = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(query)}&language=pt-BR&key=${apiKey}`
    const oldApiRes = await fetch(oldApiUrl)
    const oldData = await oldApiRes.json()

    if (oldData.status === 'REQUEST_DENIED') {
      return json({
        error: `Google Places API: REQUEST_DENIED — ${oldData.error_message ?? 'Verifique se a API está ativada no Google Cloud Console e se a chave tem permissão para Places API.'}`,
      }, 500)
    }

    if (oldData.status !== 'OK' && oldData.status !== 'ZERO_RESULTS') {
      return json({ error: `Google Places: ${oldData.status} — ${oldData.error_message ?? ''}` }, 500)
    }

    const results = (oldData.results ?? []).slice(0, 5).map((r: {
      place_id: string; name: string; formatted_address: string
      rating?: number; user_ratings_total?: number
      geometry?: { location: { lat: number; lng: number } }
    }) => ({
      place_id: r.place_id,
      name: r.name,
      address: r.formatted_address,
      rating: r.rating ?? null,
      review_count: r.user_ratings_total ?? null,
      lat: r.geometry?.location?.lat ?? null,
      lng: r.geometry?.location?.lng ?? null,
    }))

    return json({ results, api: 'legacy' })

  } catch (err) {
    console.error('find-place error:', err)
    return json({ error: String(err) }, 500)
  }
})

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { ...cors, 'Content-Type': 'application/json' } })
}
