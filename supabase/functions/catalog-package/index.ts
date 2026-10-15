/**
 * catalog-package — Fase 3+4 Etapa A (A3): botão "Gerar pacote" de um item
 * do catálogo (ex: "Meus imóveis"). Gera as peças de `config.production_recipes`
 * da ficha do setor como RASCUNHOS em marketing_ai_test_content — o MESMO
 * caminho que já publica de verdade (aprovar em agent-actions chama
 * publishToInstagram). Nunca publica sozinho.
 *
 * Só produz hoje as receitas cuja mídia já dá pra montar sem depender de
 * material que ainda não existe: fotos reais do catálogo, lugares reais
 * do OpenStreetMap ou card de texto/gráfico (sem imagem genérica de IA
 * desde 2026-10-14). Receitas que precisam de material E autorização do
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
import { requirePaidAccess } from '../_shared/access.ts'
import { ensureNearby, fetchNearbyConfig, fmtDistance, topPlaces } from '../_shared/nearbyPlaces.ts'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}
type SupaClient = ReturnType<typeof createClient>


interface Photo { url: string; path: string }
interface CatalogMeta { photos?: Photo[]; staged_photos?: Photo[]; fields?: Record<string, unknown> }
interface RecipeGroup { recipes: string[]; fonte_midia: string; descricao: string }
interface FichaConfig { pillars: Record<string, number>; production_recipes: Record<string, { etapa_a?: RecipeGroup; etapa_b?: RecipeGroup }>; vocabulary: Record<string, string>; stagingDisclosure: string }

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
    const disclosure = String((c.virtual_staging as { disclosure?: string } | undefined)?.disclosure ?? '').slice(0, 200)
    return { pillars: (c.pillars ?? {}) as Record<string, number>, production_recipes: c.production_recipes as FichaConfig['production_recipes'], vocabulary: (c.vocabulary ?? {}) as Record<string, string>, stagingDisclosure: disclosure }
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
Regras inegociáveis: nunca invente preço, m², condomínio ou qualquer dado de mercado além do que foi passado; nunca invente cliente, depoimento, venda fechada nem distância; a legenda é SEMPRE pro público do Instagram — nunca uma mensagem pro corretor pedindo dado (se faltar informação, escreva sem ela); nunca prometa valorização; tom próximo e carioca, direto nos números reais, sem "oportunidade imperdível".
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

// auth: JWT do dono (botão) ou, no modo interno do calendário, cron_secret +
// company_id (o render-format aceita os dois).
async function renderTweetCard(supabaseUrl: string, auth: { bearer: string } | { cronSecret: string; companyId: string; serviceKey: string }, cardText: string): Promise<string | null> {
  try {
    const internal = 'cronSecret' in auth
    const res = await fetch(`${supabaseUrl}/functions/v1/render-format`, {
      method: 'POST', headers: { Authorization: internal ? `Bearer ${auth.serviceKey}` : auth.bearer, 'Content-Type': 'application/json' },
      body: JSON.stringify({ template: 'tweet', kind: 'stories', fields: { card_text: cardText }, caption: cardText, save: false, ...(internal ? { cron_secret: auth.cronSecret, company_id: auth.companyId } : {}) }),
    })
    const data = await res.json().catch(() => ({})) as { url?: string }
    return res.ok && data.url ? data.url : null
  } catch { return null }
}

// Card com lista (template "trend": chamada + itens numerados) — usado no
// "3 coisas perto" com os lugares reais do OpenStreetMap.
async function renderListCard(supabaseUrl: string, auth: { bearer: string } | { cronSecret: string; companyId: string; serviceKey: string }, fields: { eyebrow: string; title: string; items: string }): Promise<string | null> {
  try {
    const internal = 'cronSecret' in auth
    const res = await fetch(`${supabaseUrl}/functions/v1/render-format`, {
      method: 'POST', headers: { Authorization: internal ? `Bearer ${auth.serviceKey}` : auth.bearer, 'Content-Type': 'application/json' },
      body: JSON.stringify({ template: 'trend', kind: 'organico', fields, caption: fields.title, save: false, ...(internal ? { cron_secret: auth.cronSecret, company_id: auth.companyId } : {}) }),
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

    const body = await req.json().catch(() => ({})) as Record<string, unknown>
    const item_id = typeof body.item_id === 'string' ? body.item_id : ''
    const only_recipe = typeof body.only_recipe === 'string' ? body.only_recipe : null
    // Dia fixo (modo calendário): a peça cai no dia que a estratégia
    // reservou, em vez do primeiro espaço livre das próximas 3 semanas.
    const forcedDate = typeof body.planned_for === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(body.planned_for) ? body.planned_for : null
    // Peça avulsa (botão "Gerar agora"): sem dia no calendário.
    const loose = body.loose === true && !forcedDate
    if (!item_id) return json({ error: 'item_id obrigatório' }, 400)

    // Duas portas: o dono (JWT, botão "Gerar pacote") ou o Calendário da
    // semana (creative-generate, cron_secret + company_id — sem usuário
    // logado no domingo à noite). Nos dois casos o item precisa ser DA
    // empresa (checado abaixo) e a conta precisa ter plano.
    const cronSecretEnv = Deno.env.get('CRON_SECRET')
    const internal = !!cronSecretEnv && body.cron_secret === cronSecretEnv && typeof body.company_id === 'string'
    const bearer = req.headers.get('Authorization') ?? ''
    let company: { id: string; vertical_key: string | null; city: string | null } | null = null
    if (internal) {
      const { data } = await admin.from('companies').select('id, vertical_key, city').eq('id', body.company_id as string).maybeSingle()
      company = data
    } else {
      if (!bearer) return json({ error: 'Unauthorized' }, 401)
      const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: bearer } } })
      const { data: { user } } = await userClient.auth.getUser()
      if (!user) return json({ error: 'Unauthorized' }, 401)
      const { data } = await admin.from('companies').select('id, vertical_key, city').eq('user_id', user.id).maybeSingle()
      company = data
    }
    if (!company) return json({ error: 'Empresa não encontrada' }, 404)
    const noPlan = await requirePaidAccess(admin, company.id)
    if (noPlan) return noPlan

    const ficha = await fetchFichaConfig(admin, company.vertical_key as string | null)
    if (!ficha) return json({ error: 'Este setor não tem catálogo/pacote de conteúdo configurado.' }, 400)

    const { data: item } = await admin.from('marketing_ai_knowledge').select('id, title, meta').eq('id', item_id).eq('company_id', company.id).eq('kind', 'product').maybeSingle()
    if (!item) return json({ error: 'Item do catálogo não encontrado' }, 404)
    const meta = (item.meta ?? {}) as CatalogMeta
    const photos = meta.photos ?? []
    const fields = meta.fields ?? {}
    if (photos.length < 5) return json({ error: 'Item precisa de pelo menos 5 fotos reais pra gerar o pacote.' }, 400)

    const fieldsLine = `Tipo: ${fields.tipo ?? '—'} · Bairro: ${fields.bairro ?? '—'} · ${fields.venda_ou_aluguel ?? '—'} · Preço: R$ ${fields.preco ?? '—'} · Quartos: ${fields.quartos ?? '—'} · Metragem: ${fields.m2 ?? '—'}m²${fields.perto_de ? ` · Perto de: ${fields.perto_de}` : ''}${fields.descricao ? `\nDescrição real escrita pelo corretor (use só o que está aqui, sem acrescentar): ${String(fields.descricao).slice(0, 1500)}` : ''}`

    // Data-fonte de agendamento: hoje + 21 dias (3 semanas), calculada 1x e
    // consumida (reservada) peça por peça via pickSlot.
    const dates = candidateDates(21)
    const occ = await getOccupancy(admin, company.id as string, dates)

    const generated: { recipe: string; pillar: string; planned_for: string; id: string; over_capacity: boolean }[] = []
    const skipped: { recipe: string; reason: string }[] = []

    // Lugares reais em volta (cache do item; busca 1x se ainda não tem).
    // Sem ficha de lugares, sem bairro ou se o mapa falhar → as receitas de
    // bairro seguem como antes (texto genérico, sem nome inventado).
    let near: { top: ReturnType<typeof topPlaces>; precise: boolean } | null = null
    const loadNear = async () => {
      const cfg = await fetchNearbyConfig(admin, company!.vertical_key)
      const data = cfg ? await ensureNearby(admin, { itemId: item.id as string, companyId: company!.id, verticalKey: company!.vertical_key, city: String(company!.city ?? '') }) : null
      return { top: topPlaces(data, cfg, 3), precise: data?.precision === 'endereco' }
    }

    for (const [pillarKey, group] of Object.entries(ficha.production_recipes)) {
      const etapaA = group.etapa_a
      if (!etapaA || etapaA.recipes.length === 0) continue
      const weight = ficha.pillars[pillarKey] ?? 10

      for (const recipe of etapaA.recipes) {
        if (only_recipe && recipe !== only_recipe) continue
        if (etapaA.fonte_midia === 'material_e_autorizacao_cliente') {
          skipped.push({ recipe, reason: 'Precisa de material real e autorização do cliente/corretor — o "Gerar pacote" não preenche isso sozinho.' })
          continue
        }

        let media: { url: string; type: string }[] = []
        let caption = '', hashtags = '', cta = ''
        let kind = 'organico'
        let provider = ''

        if (recipe === 'carrossel_tour') {
          // Até 2 fotos mobiliadas virtualmente (escolhidas pelo dono) entram
          // logo depois da capa real — e aí a legenda SEMPRE leva o aviso da
          // ficha (nunca enganar o comprador sobre o que vem no imóvel).
          const staged = (meta.staged_photos ?? []).slice(0, 2)
          const useStaged = staged.length > 0 && !!ficha.stagingDisclosure
          // Instagram aceita até 10 mídias no carrossel — corta aqui, não na publicação.
          media = [photos[0], ...(useStaged ? staged : []), ...photos.slice(1)].slice(0, 10).map(p => ({ url: p.url, type: 'photo' }))
          const c = await writeCopy(anthropicKey, `Escreva a legenda de um CARROSSEL mostrando este imóvel real (as fotos já existem, escreva só o texto).${useStaged ? ' Algumas fotos foram mobiliadas virtualmente pra ajudar a imaginar o espaço — não descreva os móveis como parte do imóvel.' : ''}\n${fieldsLine}`)
          caption = useStaged ? `${c.caption}\n\n${ficha.stagingDisclosure}` : c.caption
          hashtags = c.hashtags; cta = c.cta
          provider = 'catalogo_real'
        } else if (recipe === 'post_detalhe_que_voce_nao_viu') {
          media = [{ url: photos[photos.length - 1].url, type: 'photo' }]
          const detalhe = fields.detalhe_que_ninguem_percebe ? String(fields.detalhe_que_ninguem_percebe) : null
          const c = await writeCopy(anthropicKey, `Escreva um post de 1 foto destacando um detalhe do imóvel que ninguém repara de cara${detalhe ? ` (o detalhe real é: "${detalhe}")` : ' (fale de algo real do imóvel que só quem visita percebe, sem inventar um detalhe específico que não foi informado — pode ser mais genérico, tipo iluminação natural, silêncio, vista)'}. \n${fieldsLine}`)
          caption = c.caption; hashtags = c.hashtags; cta = c.cta
          provider = 'catalogo_real'
        } else if ((recipe === 'reels_o_que_compra_no_bairro' || recipe === 'post_3_coisas_perto') && (near ??= await loadNear()).top.length >= (recipe === 'post_3_coisas_perto' ? 3 : 1)) {
          // Lugares de verdade (OpenStreetMap, aba "Lugares perto"): nome e
          // distância calculada — nada inventado. "3 coisas perto" vira
          // carrossel: card com os 3 lugares (texto só pelo render-format,
          // regra 4) + a capa real do imóvel.
          const lista = near!.top.map(p => `${p.emoji} ${p.name} (${p.label.toLowerCase()})${near!.precise ? ` — ${fmtDistance(p.distance_m)}` : ''}`)
          const distRule = near!.precise
            ? 'As distâncias são em linha reta a partir do imóvel: escreva "a uns X" ou "a X em linha reta", nunca minutos a pé/de carro nem outro número.'
            : 'Esses lugares ficam no bairro (o endereço exato do imóvel não foi informado): NÃO escreva distância nem minutos, só que ficam no bairro/pertinho.'
          if (recipe === 'post_3_coisas_perto') {
            // Card de lista (template "trend" do render-format): sem emoji — a
            // fonte do card não tem esse glifo.
            const card = await renderListCard(supabaseUrl, internal ? { cronSecret: cronSecretEnv!, companyId: company.id as string, serviceKey } : { bearer }, {
              eyebrow: `Perto do imóvel em ${String(fields.bairro ?? 'Rio')}`.slice(0, 40),
              title: '3 coisas perto daqui',
              // "Metrô · Antero de Quental" — a categoria entra quando o nome
              // sozinho não diz o que é (ex.: estação de metrô).
              items: near!.top.slice(0, 3).map(p => `${p.label.toLowerCase().split(/\s+/).some(w => w.length > 3 && p.name.toLowerCase().includes(w)) ? '' : `${p.label.split(' ')[0]} · `}${p.name}${near!.precise ? ` · ${fmtDistance(p.distance_m)}` : ''}`).join('\n'),
            })
            if (!card) { skipped.push({ recipe, reason: 'Falha ao gerar o card dos lugares — tente de novo depois.' }); continue }
            media = [{ url: card, type: 'photo' }, { url: photos[0].url, type: 'photo' }]
          } else {
            media = [{ url: photos[0].url, type: 'photo' }]
          }
          const c = await writeCopy(anthropicKey, `${recipe === 'post_3_coisas_perto' ? 'Escreva um post "3 coisas perto" deste imóvel' : `Escreva um post sobre como é morar perto deste imóvel em ${fields.bairro ?? 'no bairro'} — estilo de vida, não o imóvel em si`}. Use SÓ estes lugares reais, com o nome exatamente assim (dados do OpenStreetMap):\n${lista.join('\n')}\n${distRule} Nunca diga o endereço/rua do imóvel.\n${fieldsLine}`)
          caption = c.caption; hashtags = c.hashtags; cta = c.cta
          provider = 'lugares_osm'
        } else if (recipe === 'reels_o_que_compra_no_bairro' || recipe === 'post_3_coisas_perto') {
          // Sem lugares reais (mapa sem resultado ou sem bairro): foto REAL do
          // imóvel e texto sem nome de lugar. Antes saía uma imagem genérica de
          // IA (gente na calçada, padaria inventada) — o dono pediu pra
          // tirar (2026-10-14): parecia post "do fluxo antigo".
          media = [{ url: (photos[1] ?? photos[0]).url, type: 'photo' }]
          const briefing = recipe === 'reels_o_que_compra_no_bairro'
            ? `Escreva um post sobre como é morar no bairro "${fields.bairro ?? 'da região'}" — estilo de vida, sem citar nome de estabelecimento nem número que não esteja nos dados. A foto é do imóvel real.`
            : `Escreva um post "o que tem perto" do imóvel${fields.perto_de ? ` — use SÓ isto que o corretor informou: ${fields.perto_de}` : ' — fale de forma geral do bairro, sem inventar nome de lugar nem distância'}. A foto é do imóvel real.`
          const c = await writeCopy(anthropicKey, `${briefing}\n${fieldsLine}`)
          caption = c.caption; hashtags = c.hashtags; cta = c.cta
          provider = 'catalogo_real'
        } else if (recipe === 'stories_enquete_pagaria') {
          const cardText = `Quanto você pagaria por um ${String(fields.tipo ?? 'imóvel').toLowerCase()} assim em ${fields.bairro ?? 'um bairro como esse'}?`
          const url = await renderTweetCard(supabaseUrl, internal ? { cronSecret: cronSecretEnv!, companyId: company.id as string, serviceKey } : { bearer }, cardText)
          if (!url) { skipped.push({ recipe, reason: 'Falha ao gerar o card — tente de novo depois.' }); continue }
          media = [{ url, type: 'photo' }]
          caption = cardText; hashtags = ''; cta = 'Comenta aqui embaixo 👇'
          kind = 'stories'
          provider = 'render-format'
        } else {
          continue // pilar 'educacao' não tem receita ligada a um item específico
        }

        const slot = forcedDate || loose ? { date: forcedDate ?? '', overCapacity: false } : pickSlot(dates, occ, pillarKey, weight)
        const { data: row, error } = await admin.from('marketing_ai_test_content').insert({
          company_id: company.id, kind, idea: item.title, caption, hashtags, cta,
          format: media.length > 1 ? 'carrossel' : 'foto', image_url: media[0]?.url ?? null,
          item_id: item.id, media, pillar: pillarKey, recipe, provider, planned_for: loose ? null : slot.date,
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
