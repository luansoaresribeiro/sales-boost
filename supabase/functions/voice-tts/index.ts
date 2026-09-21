import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return json({ error: 'Unauthorized' }, 401)

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    })
    const { data: { user }, error } = await userClient.auth.getUser()
    if (error || !user) return json({ error: 'Unauthorized' }, 401)

    const elevenlabsKey = Deno.env.get('ELEVENLABS_API_KEY')
    if (!elevenlabsKey) {
      return json({ ok: true, audio: null, reason: 'ELEVENLABS_API_KEY not configured' })
    }

    const body = await req.json()
    const text = (body.text as string | undefined)?.trim()
    if (!text) return json({ error: 'text is required' }, 400)

    const voiceId = (body.voice_id as string | undefined)
      ?? Deno.env.get('ELEVENLABS_VOICE_ID')
      ?? 'pNInz6obpgDQGcFmaJgB'

    const ttsRes = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
      method: 'POST',
      headers: {
        'xi-api-key': elevenlabsKey,
        'Content-Type': 'application/json',
        'Accept': 'audio/mpeg',
      },
      body: JSON.stringify({
        text,
        model_id: 'eleven_multilingual_v2',
        voice_settings: { stability: 0.5, similarity_boost: 0.8 },
      }),
    })

    if (!ttsRes.ok) {
      const err = await ttsRes.text()
      console.error('ElevenLabs error:', ttsRes.status, err)
      // Graceful fallback: client switches to text-only mode
      return json({ ok: false, audio: null, reason: `ElevenLabs error (${ttsRes.status})` })
    }

    const audioBuffer = await ttsRes.arrayBuffer()
    return new Response(audioBuffer, {
      headers: {
        ...cors,
        'Content-Type': 'audio/mpeg',
        'Cache-Control': 'no-cache',
      },
    })
  } catch (err) {
    console.error('voice-tts error:', err)
    return json({ error: String(err) }, 500)
  }
})

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' },
  })
}
