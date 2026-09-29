import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

type SupaClient = ReturnType<typeof createClient>

interface Bilingual { pt: string; en?: string }
interface PlaybookQuestion { key: string; label: Bilingual; type: 'select' | 'multi_text' | 'text'; options?: Bilingual[]; max?: number }
const MAX_TEXT_LEN = 200

// Mesmo lookup que o trigger sync_company_vertical_key faz no banco — usado
// aqui só pra saber QUAL ficha validar as respostas contra, antes do
// insert (o trigger continua sendo a fonte de verdade de vertical_key na
// hora de gravar).
async function resolveVerticalKey(admin: SupaClient, businessType: string | null): Promise<string> {
  if (!businessType) return 'generico'
  const { data } = await admin.from('business_types').select('vertical_key').eq('label', businessType).maybeSingle()
  return (data?.vertical_key as string | undefined) ?? 'generico'
}

async function fetchOnboardingQuestions(admin: SupaClient, verticalKey: string): Promise<PlaybookQuestion[]> {
  if (verticalKey === 'generico') return []
  const { data } = await admin.from('vertical_playbooks').select('config').eq('key', verticalKey).eq('enabled', true).maybeSingle()
  const questions = (data?.config as { onboarding_questions?: unknown } | undefined)?.onboarding_questions
  return Array.isArray(questions) ? questions as PlaybookQuestion[] : []
}

// Só aceita chave que existe na ficha, respeita o tipo e o max, corta texto
// grande — isso vai pro prompt da IA (fetchPlaybookBlock nas 6 functions
// que já leem a ficha), não pode entrar lixo nem texto enorme. Cópia da
// mesma lógica de src/lib/verticalPlaybook.ts (convenção do projeto: sem
// lib compartilhada entre edge function e frontend).
function sanitizePlaybookAnswers(raw: unknown, questions: PlaybookQuestion[]): Record<string, unknown> {
  if (!raw || typeof raw !== 'object') return {}
  const byKey = new Map(questions.map(q => [q.key, q]))
  const out: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    const q = byKey.get(key)
    if (!q) continue
    if (q.type === 'text') {
      const s = String(value ?? '').trim().slice(0, MAX_TEXT_LEN)
      if (s) out[key] = s
    } else if (q.type === 'select') {
      const s = String(value ?? '').trim()
      const allowed = (q.options ?? []).map(o => o.pt)
      if (s && allowed.includes(s)) out[key] = s
    } else if (q.type === 'multi_text') {
      if (!Array.isArray(value)) continue
      const max = q.max ?? 10
      const items = value.map(v => String(v ?? '').trim().slice(0, MAX_TEXT_LEN)).filter(Boolean).slice(0, max)
      if (items.length) out[key] = items
    }
  }
  return out
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return json({ error: 'Unauthorized' }, 401)

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    })
    const { data: { user }, error: userErr } = await userClient.auth.getUser()
    if (userErr || !user) return json({ error: 'Unauthorized' }, 401)

    const { diagnostic_id } = await req.json()
    if (!diagnostic_id) return json({ error: 'diagnostic_id required' }, 400)

    const serviceClient = createClient(supabaseUrl, supabaseServiceKey)

    // Load the diagnostic
    const { data: diag, error: diagErr } = await serviceClient
      .from('diagnostics')
      .select('*')
      .eq('id', diagnostic_id)
      .is('company_id', null) // only claim unclaimed diagnostics
      .single()

    if (diagErr || !diag) return json({ error: 'Diagnóstico não encontrado ou já vinculado' }, 404)

    // Check if user already has a company
    const { data: existingCompany } = await serviceClient
      .from('companies')
      .select('id')
      .eq('user_id', user.id)
      .single()

    let companyId: string

    if (existingCompany) {
      companyId = existingCompany.id
    } else {
      // Trial de 3 dias começa aqui — o único lugar onde uma empresa nova é
      // criada de verdade. Nunca calculado depois, sempre a partir desses
      // dois timestamps (ver src/lib/trialState.ts no frontend).
      const trialStartedAt = new Date()
      const trialExpiresAt = new Date(trialStartedAt.getTime() + 3 * 24 * 60 * 60 * 1000)

      // Entendimento do negócio capturado no onboarding conversacional — vira
      // Business Context que os agentes leem.
      const oc = (diag.onboarding_context ?? {}) as Record<string, unknown>

      // Ficha de setor: valida as respostas contra a ficha de verdade antes
      // de gravar — nunca confia no que o onboarding mandou sem checar.
      const verticalKey = await resolveVerticalKey(serviceClient, diag.business_type as string | null)
      const fichaQuestions = await fetchOnboardingQuestions(serviceClient, verticalKey)
      const playbookAnswers = sanitizePlaybookAnswers(oc.playbook_answers, fichaQuestions)

      // Create companies record from diagnostic data
      const { data: company, error: companyErr } = await serviceClient
        .from('companies')
        .insert({
          user_id: user.id,
          business_name: diag.business_name,
          business_type: diag.business_type,
          city: diag.city,
          website_url: diag.website_url,
          instagram_url: diag.instagram_url,
          facebook_url: diag.facebook_url,
          tiktok_url: diag.tiktok_url,
          google_maps_url: diag.google_maps_url,
          phone: diag.phone,
          contact_email: diag.contact_email,
          goal: diag.goal,
          business_description: oc.business_description ?? null,
          ideal_customer: oc.ideal_customer ?? null,
          business_stage: oc.business_stage ?? null,
          primary_goals: oc.primary_goals ?? null,
          main_challenges: oc.main_challenges ?? null,
          current_channels: oc.current_channels ?? null,
          onboarding_summary: oc.onboarding_summary ?? null,
          agent_business_interpretation: oc.agent_business_interpretation ?? null,
          playbook_answers: playbookAnswers,
          plan: 'free',
          trial_started_at: trialStartedAt.toISOString(),
          trial_expires_at: trialExpiresAt.toISOString(),
        })
        .select('id')
        .single()

      if (companyErr || !company) return json({ error: companyErr?.message ?? 'Erro ao criar empresa' }, 500)
      companyId = company.id

      await serviceClient.from('progress_events').insert({
        company_id: companyId, event_type: 'trial_started', gp: 10, source: 'trial', dedupe_key: `trial_started:${companyId}`,
      })
    }

    // Link diagnostic to company and user
    await serviceClient
      .from('diagnostics')
      .update({ company_id: companyId, user_id: user.id })
      .eq('id', diagnostic_id)

    return json({ company_id: companyId, diagnostic_id })

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
