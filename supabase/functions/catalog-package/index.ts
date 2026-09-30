/**
 * catalog-package — Fase 3+4 Etapa A (A3): botão "Gerar pacote" de um item
 * do catálogo (ex: "Meus imóveis"). Gera as peças de `config.production_recipes`
 * da ficha do setor como RASCUNHOS em marketing_ai_test_content — o MESMO
 * caminho que já publica de verdade (aprovar em agent-actions chama
 * publishToInstagram). Nunca publica sozinho.
 *
 * Só produz hoje as receitas cuja mídia já dá pra montar sem depender de
 * material que ainda não existe: fotos reais do catálogo, imagem genérica
 * de clima/ambiente (nunca fingindo ser o lugar real) ou card de
 * texto/gráfico. Receitas que precisam de material E autorização do
 * cliente (prova social/marca pessoal) ficam de fora — não tem como
 * "Gerar pacote" preencher isso sozinho (ver ficha, campo `descricao`).
 *
 * Agendamento: espalha as peças pelas próximas 3 semanas respeitando (1) o
 * teto de 1-2 peças/dia que o planejador semanal já usa e (2) o peso de
 * cada pilar (config.pillars) — nunca deixa um pilar sozinho lotar a
 * semana. A MESMA lógica de ocupação por pilar também é lida (não escrita)
 * por planWeekForCompany em creative-generate, pra o cron semanal não
 * empilhar mais conteúdo em cima do que o pacote já agendou.
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}
type SupaClient = ReturnType<typeof createClient>

const NO_TEXT_RULE = 'CRITICAL: this image must contain ONLY the visual scene — environment, people, products, objects, lighting, composition. Absolutely NO text of any kind anywhere in the image: no headlines, captions, CTAs, logos with text, signs, banners, posters, screens, labels, packaging text, watermarks, or simulated/gibberish lettering. If the scene naturally includes an object that would normally carry text (a sign, menu, screen, clipboard, label), render it completely blank — a clean empty surface. Never attempt to write, spell, or render any character.'

interface Photo { url: string; path: string }
interface CatalogMeta { photos?: Photo[]; fields?: Record<string, unknown> }
interface RecipeGroup { recipes: string[]; fonte_midia: string; descricao: string }
interface FichaConfig { pillars: Record<string, number>; production_recipes: Record<string, { etapa_a?: RecipeGroup; etapa_b?: RecipeGroup }>; vocabulary: Record<string, string> }

async function callClaude(anthropicKey: string, prompt: string, maxTokens = 700): Promise<string> {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': anthropicKey, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({ model: 'claude-sonnet-4-6', max_tokens: maxTokens, messages: [{ role: 'user', content: prompt }] }),
  })
  if (!res.ok) throw new Error(`Claude error: ${await res.text()}`)
  const data = await res.json()
  return (data.content?.[0]?.text ?? '').replace(/```(?:json)?\n?/g, '').trim()
}
function parseObj(raw: string): Record<string, unknown> {
  try { return JSON.parse(raw) } catch { /* */ }
  const m = raw.match(/\{[\s\S]*\}/)
  if (m) { try { return JSON.parse(m[0]) } catch { /* */ } }
  return {}
}

async function fetchFichaConfig(admin: SupaClient, verticalKey: string | null): Promise<FichaConfig | null> {
  if (!verticalKey || verticalKey === 'generico') return null
  try {
    const { data } = await admin.from('vertical_playbooks').select('config').eq('key', verticalKey).eq('enabled', true).maybeSingle()
    const c = (data?.config ?? {}) as Record<string, unknown>
    if (!c.production_recipes) return null
    return { pillars: (c.pillars ?? {}) as Record<string, number>, production_recipes: c.production_recipes as FichaConfig['production_recipes'], vocabulary: (c.vocabulary ?? {}) as Record<string, string> }
  } catch { return null }
}

// ── Motor de agendamento (duplicado de propósito — mesma lógica que
// planWeekForCompany em creative-generate lê, convenção do projeto: sem lib
// compartilhada entre functions) ──────────────────────────────────────────
function isoDate(d: Date): string { return d.toISOString().slice(0, 10) }
function candidateDates(daysAhead: number): string[] {
  const out: string[] = []; const now = new Date()
  for (let i = 0; i < daysAhead; i++) { const d = new Date(now); d.setUTCDate(now.getUTCDate() + i); out.push(isoDate(d)) }
  return out
}
function weekKeyOf(dateIso: string): string {
  const d = new Date(dateIso + 'T00:00:00Z')
  const day = d.getUTCDay()
  const monday = new Date(d); monday.setUTCDate(d.getUTCDate() - ((day + 6) % 7))
  return isoDate(monday)
}
// Capacidade média de referência (1-2 posts/dia × 7) — só serve pra calcular
// o teto de cada pilar a partir do peso da ficha, não é um limite real.
const WEEK_CAPACITY_BASELINE = 10
function pillarCap(weightPct: number): number { return Math.max(1, Math.round(WEEK_CAPACITY_BASELINE * (weightPct / 100))) }

interface Occupancy { perDay: Record<string, number>; perPillarWeek: Record<string, Record<string, number>> }
async function getOccupancy(admin: SupaClient, companyId: string, dates: string[]): Promise<Occupancy> {
  const { data } = await admin.from('marketing_ai_test_content').select('planned_for, pillar').eq('company_id', companyId).in('planned_for', dates)
  const occ: Occupancy = { perDay: {}, perPillarWeek: {} }
  for (const row of (data ?? []) as { planned_for: string | null; pillar: string | null }[]) {
    if (!row.planned_for) continue
    occ.perDay[row.planned_for] = (occ.perDay[row.planned_for] ?? 0) + 1
    if (row.pillar) {
      const wk = weekKeyOf(row.planned_for)
      occ.perPillarWeek[wk] = occ.perPillarWeek[wk] ?? {}
      occ.perPillarWeek[wk][row.pillar] = (occ.perPillarWeek[wk][row.pillar] ?? 0) + 1
    }
  }
  return occ
}
// Acha a data mais próxima (até 3 semanas à frente) com espaço no dia
// (<2 peças) e dentro do teto do pilar naquela semana. Reserva na conta
// local pra próxima chamada dentro do mesmo lote já enxergar a ocupação.
// Nunca deixa vazio — estourando as 3 semanas, usa o último dia mesmo assim.
function pickSlot(dates: string[], occ: Occupancy, pillar: string, pillarWeightPct: number): { date: string; overCapacity: boolean } {
  const cap = pillarCap(pillarWeightPct)
  for (const date of dates) {
    const dayCount = occ.perDay[date] ?? 0
    if (dayCount >= 2) continue
    const wk = weekKeyOf(date)
    const pillarCount = occ.perPillarWeek[wk]?.[pillar] ?? 0
    if (pillarCount >= cap) continue
    occ.perDay[date] = dayCount + 1
    occ.perPillarWeek[wk] = occ.perPillarWeek[wk] ?? {}
    occ.perPillarWeek[wk][pillar] = pillarCount + 1
    return { date, overCapacity: false }
  }
  const last = dates[dates.length - 1]
  occ.perDay[last] = (occ.perDay[last] ?? 0) + 1
  return { date: last, overCapacity: true }
}

// ── Geração de texto por peça (1 função parametrizada em vez de 5 quase
// iguais — reuso normal DENTRO do arquivo, não é a lib compartilhada ENTRE
// functions que o projeto evita) ──────────────────────────────────────────
async function writeCopy(anthropicKey: string, briefing: string): Promise<{ caption: string; hashtags: string; cta: string }> {
  const prompt = `Você é o Content Agent do Sales Boost, especializado em corretores de imóveis no Rio de Janeiro.
${briefing}
Regras inegociáveis: nunca invente preço, m², condomínio ou qualquer dado de mercado além do que foi passado; nunca prometa valorização; tom próximo e carioca, direto nos números reais, sem "oportunidade imperdível".
Responda SÓ em JSON: {"caption":"...","hashtags":"...","cta":"..."}`
  const obj = parseObj(await callClaude(anthropicKey, prompt, 700))
  return { caption: String(obj.caption ?? '').trim(), hashtags: String(obj.hashtags ?? '').trim(), cta: String(obj.cta ?? '').trim() }
}

// Mesmo controle de qualidade que generateForCompany já roda (content-test,
// score/regenerate/vault) — sem isso a peça fica em status:'draft' pra
// sempre e nunca aparece no Vault/Aprovações (que só mostra status:'vault',
// ver ContentVault.tsx). Duplicado de propósito (convenção do projeto).
async function scoreTestContent(supabaseUrl: string, serviceKey: string, companyId: string, testId: string): Promise<void> {
  try {
    await fetch(`${supabaseUrl}/functions/v1/content-test`, {
      method: 'POST', headers: { Authorization: `Bearer ${serviceKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'score', test_id: testId, company_id: companyId }),
    })
  } catch (e) { console.error('catalog-package: scoreTestContent falhou', testId, e) }
}

async function generateMoodImage(supabaseUrl: string, serviceKey: string, companyId: string, evoke: string): Promise<string | null> {
  try {
    const prompt = `Professional lifestyle photo evoking the general atmosphere of a residential neighborhood in Rio de Janeiro, Brazil — NOT a specific identifiable real location, just a generic mood/climate scene. Warm natural lighting, polished commercial photography. ${NO_TEXT_RULE} Scene to evoke: ${evoke}`
    const res = await fetch(`${supabaseUrl}/functions/v1/generate-image`, {
      method: 'POST', headers: { Authorization: `Bearer ${serviceKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt, size: '1024x1024', company_id: companyId, force_new: true }),
    })
    const data = await res.json().catch(() => ({})) as { url?: string }
    return res.ok && data.url ? data.url : null
  } catch { return null }
}

async function renderTweetCard(supabaseUrl: string, bearer: string, cardText: string): Promise<string | null> {
  try {
    const res = await fetch(`${supabaseUrl}/functions/v1/render-format`, {
      method: 'POST', headers: { Authorization: bearer, 'Content-Type': 'application/json' },
      body: JSON.stringify({ template: 'tweet', kind: 'stories', fields: { card_text: cardText }, caption: cardText, save: false }),
    })
    const data = await res.json().catch(() => ({})) as { url?: string }
    return res.ok && data.url ? data.url : null
  } catch { return null }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY')!
    const admin = createClient(supabaseUrl, serviceKey)

    const bearer = req.headers.get('Authorization') ?? ''
    if (!bearer) return json({ error: 'Unauthorized' }, 401)
    const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: bearer } } })
    const { data: { user } } = await userClient.auth.getUser()
    if (!user) return json({ error: 'Unauthorized' }, 401)

    const { item_id } = await req.json()
    if (!item_id) return json({ error: 'item_id obrigatório' }, 400)

    const { data: company } = await admin.from('companies').select('id, vertical_key').eq('user_id', user.id).maybeSingle()
    if (!company) return json({ error: 'Empresa não encontrada' }, 404)

    const ficha = await fetchFichaConfig(admin, company.vertical_key as string | null)
    if (!ficha) return json({ error: 'Este setor não tem catálogo/pacote de conteúdo configurado.' }, 400)

    const { data: item } = await admin.from('marketing_ai_knowledge').select('id, title, meta').eq('id', item_id).eq('company_id', company.id).eq('kind', 'product').maybeSingle()
    if (!item) return json({ error: 'Item do catálogo não encontrado' }, 404)
    const meta = (item.meta ?? {}) as CatalogMeta
    const photos = meta.photos ?? []
    const fields = meta.fields ?? {}
    if (photos.length < 5) return json({ error: 'Item precisa de pelo menos 5 fotos reais pra gerar o pacote.' }, 400)

    const fieldsLine = `Tipo: ${fields.tipo ?? '—'} · Bairro: ${fields.bairro ?? '—'} · ${fields.venda_ou_aluguel ?? '—'} · Preço: R$ ${fields.preco ?? '—'} · Quartos: ${fields.quartos ?? '—'} · Metragem: ${fields.m2 ?? '—'}m²${fields.perto_de ? ` · Perto de: ${fields.perto_de}` : ''}`

    // Data-fonte de agendamento: hoje + 21 dias (3 semanas), calculada 1x e
    // consumida (reservada) peça por peça via pickSlot.
    const dates = candidateDates(21)
    const occ = await getOccupancy(admin, company.id as string, dates)

    const generated: { recipe: string; pillar: string; planned_for: string; id: string; over_capacity: boolean }[] = []
    const skipped: { recipe: string; reason: string }[] = []

    for (const [pillarKey, group] of Object.entries(ficha.production_recipes)) {
      const etapaA = group.etapa_a
      if (!etapaA || etapaA.recipes.length === 0) continue
      const weight = ficha.pillars[pillarKey] ?? 10

      for (const recipe of etapaA.recipes) {
        if (etapaA.fonte_midia === 'material_e_autorizacao_cliente') {
          skipped.push({ recipe, reason: 'Precisa de material real e autorização do cliente/corretor — o "Gerar pacote" não preenche isso sozinho.' })
          continue
        }

        let media: { url: string; type: string }[] = []
        let caption = '', hashtags = '', cta = ''
        let kind = 'organico'
        let provider = ''

        if (recipe === 'carrossel_tour') {
          media = photos.map(p => ({ url: p.url, type: 'photo' }))
          const c = await writeCopy(anthropicKey, `Escreva a legenda de um CARROSSEL mostrando este imóvel real (as fotos já existem, escreva só o texto).\n${fieldsLine}`)
          caption = c.caption; hashtags = c.hashtags; cta = c.cta
          provider = 'catalogo_real'
        } else if (recipe === 'post_detalhe_que_voce_nao_viu') {
          media = [{ url: photos[photos.length - 1].url, type: 'photo' }]
          const detalhe = fields.detalhe_que_ninguem_percebe ? String(fields.detalhe_que_ninguem_percebe) : null
          const c = await writeCopy(anthropicKey, `Escreva um post de 1 foto destacando um detalhe do imóvel que ninguém repara de cara${detalhe ? ` (o detalhe real é: "${detalhe}")` : ' (fale de algo real do imóvel que só quem visita percebe, sem inventar um detalhe específico que não foi informado — pode ser mais genérico, tipo iluminação natural, silêncio, vista)'}. \n${fieldsLine}`)
          caption = c.caption; hashtags = c.hashtags; cta = c.cta
          provider = 'catalogo_real'
        } else if (recipe === 'reels_o_que_compra_no_bairro' || recipe === 'post_3_coisas_perto') {
          const evoke = recipe === 'reels_o_que_compra_no_bairro'
            ? `everyday street life and lifestyle amenities of a pleasant Rio de Janeiro neighborhood — cafes, tree-lined sidewalk, local shops`
            : `a few lifestyle amenities near a residence — a bakery, a park, a gym, generic and welcoming`
          const url = await generateMoodImage(supabaseUrl, serviceKey, company.id as string, evoke)
          if (!url) { skipped.push({ recipe, reason: 'Falha ao gerar a imagem genérica do bairro — tente de novo depois.' }); continue }
          media = [{ url, type: 'photo' }]
          const briefing = recipe === 'reels_o_que_compra_no_bairro'
            ? `Escreva um post sobre o que se compra/vive morando no bairro "${fields.bairro ?? 'da região'}" — estilo de vida, não o imóvel em si. Imagem já existe (clima genérico do bairro), escreva só o texto. Nota: idealmente isso seria um vídeo/Reels — por enquanto sai como imagem estática (etapa futura adiciona vídeo).`
            : `Escreva um post "3 coisas perto" do imóvel${fields.perto_de ? ` — use isso que o corretor informou: ${fields.perto_de}` : ' — fale de forma genérica sobre tipo de comércio/lazer que costuma ter por perto (padaria, academia, parque), sem inventar um nome específico de estabelecimento que não foi informado'}.`
          const c = await writeCopy(anthropicKey, briefing)
          caption = c.caption; hashtags = c.hashtags; cta = c.cta
          provider = 'ia_generica'
        } else if (recipe === 'stories_enquete_pagaria') {
          const cardText = `Quanto você pagaria por um ${String(fields.tipo ?? 'imóvel').toLowerCase()} assim em ${fields.bairro ?? 'um bairro como esse'}?`
          const url = await renderTweetCard(supabaseUrl, bearer, cardText)
          if (!url) { skipped.push({ recipe, reason: 'Falha ao gerar o card — tente de novo depois.' }); continue }
          media = [{ url, type: 'photo' }]
          caption = cardText; hashtags = ''; cta = 'Comenta aqui embaixo 👇'
          kind = 'stories'
          provider = 'render-format'
        } else {
          continue // pilar 'educacao' não tem receita ligada a um item específico
        }

        const slot = pickSlot(dates, occ, pillarKey, weight)
        const { data: row, error } = await admin.from('marketing_ai_test_content').insert({
          company_id: company.id, kind, idea: item.title, caption, hashtags, cta,
          format: media.length > 1 ? 'carrossel' : 'foto', image_url: media[0]?.url ?? null,
          item_id: item.id, media, pillar: pillarKey, recipe, provider, planned_for: slot.date,
        }).select('id').single()
        if (error) { skipped.push({ recipe, reason: error.message }); continue }
        await scoreTestContent(supabaseUrl, serviceKey, company.id as string, row!.id as string)
        generated.push({ recipe, pillar: pillarKey, planned_for: slot.date, id: row!.id as string, over_capacity: slot.overCapacity })
      }
    }

    return json({ ok: true, generated, skipped })
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : String(err) }, 500)
  }
})

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { ...cors, 'Content-Type': 'application/json' } })
}
