/**
 * creative-generate — Fase 2: Diretor Criativo + Personalidades + Biblioteca.
 *
 * Gera um post de teste como uma agência de verdade, em dois passos:
 *   1) Diretor Criativo decide o BRIEF (objetivo, formato, sistema visual,
 *      ângulo de hook, CTA, oferta) e escolhe a PERSONALIDADE certa, olhando a
 *      Inteligência (insights) e os recursos disponíveis na Biblioteca.
 *   2) A personalidade EXECUTA o brief, consultando a Biblioteca (o framework/
 *      hook/sistema visual escolhidos) e escreve o post.
 *
 * Grava isolado em marketing_ai_test_content (com o brief) — cai no mesmo QC
 * (content-test: score/regenerate/vault). Nada publica sozinho.
 *
 * Dois modos de chamada:
 *   - Interativo: JWT do dono, gera 1 post pra empresa dele (botão "Gerar
 *     post de teste" ou "Testar essa ideia").
 *   - Cron em lote (`cron_secret`, sem `company_id`): roda 1x/dia (10h BRT,
 *     job "auto-daily-test-10am-brt") pra toda empresa com
 *     marketing_ai_config.auto_daily_test = true — o botão da Área de
 *     Testes liga isso, e auto_daily_test_image decide se gera imagem junto.
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { weeklyMixPlan, weekSlots, fetchFormatCatalog, fetchContentRules, ensureMinVideos, type ContentPlan } from '../_shared/formatCatalog.ts'
import { hasPaidAccess, requirePaidAccess } from '../_shared/access.ts'
import { fitsCap, HF_EDIT_COST_USD, logPhotoRetouch } from '../_shared/spendCap.ts'
import { privateFieldKeys } from '../_shared/nearbyPlaces.ts'
import { loadLessons, lessonsBlock, relearn } from '../_shared/contentLessons.ts'
import { decideVideoCta, queroNotice, sanitizeCaptionCta } from '../_shared/videoCta.ts'
import { checkAndSave, fetchFaqConfig, getTavilyKey, isDue, isPublishable, numbersIn, type FaqRow } from '../_shared/faqCheck.ts'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}
type SupaClient = ReturnType<typeof createClient>

interface Company { id: string; business_name: string; business_type: string | null; city: string | null; goal: string | null; business_description: string | null; ideal_customer: string | null; language: string | null; telegram_chat_id: string | null; vertical_key: string | null; playbook_answers: Record<string, unknown> | null }

// Ficha de setor (vertical_playbooks) + respostas do onboarding, mescladas
// num bloco de texto pra injetar no prompt. Ficha vazia (caso 'generico', ou
// qualquer setor sem ficha configurada) + sem respostas = devolve '' = o
// prompt fica idêntico ao de antes desta função existir. Nunca derruba a
// geração por causa de erro no banco de fichas (try/catch).
async function fetchPlaybookBlock(admin: SupaClient, verticalKey: string, playbookAnswers: Record<string, unknown> | null): Promise<string> {
  try {
    const { data } = await admin.from('vertical_playbooks').select('name, config').eq('key', verticalKey).eq('enabled', true).maybeSingle()
    const c = (data?.config ?? {}) as Record<string, unknown>
    const parts: string[] = []
    if (typeof c.tone === 'string' && c.tone) parts.push(`Tom de voz do setor: ${c.tone}`)
    if (Array.isArray(c.rules) && c.rules.length) parts.push(`Regras obrigatórias do setor:\n${(c.rules as string[]).map(r => `- ${r}`).join('\n')}`)
    if (c.pillars && typeof c.pillars === 'object' && Object.keys(c.pillars).length) {
      parts.push(`Pilares de conteúdo e peso sugerido: ${Object.entries(c.pillars as Record<string, number>).map(([k, v]) => `${k} ${v}%`).join(', ')}`)
    }
    if (c.hooks_by_pillar && typeof c.hooks_by_pillar === 'object' && Object.keys(c.hooks_by_pillar).length) {
      parts.push(`Ganchos de referência por pilar:\n${Object.entries(c.hooks_by_pillar as Record<string, string[]>).map(([k, arr]) => `${k}: ${arr.join('; ')}`).join('\n')}`)
    }
    if (c.ctas && typeof c.ctas === 'object' && Object.keys(c.ctas).length) {
      parts.push(`CTAs recomendados: ${Object.entries(c.ctas as Record<string, string>).map(([k, v]) => `${k} → "${v}"`).join(', ')}`)
    }
    if (c.vocabulary && typeof c.vocabulary === 'object' && Object.keys(c.vocabulary).length) {
      parts.push(`Vocabulário do setor: ${Object.entries(c.vocabulary as Record<string, string>).map(([k, v]) => `${k}=${v}`).join(', ')}`)
    }
    const answers = playbookAnswers && typeof playbookAnswers === 'object'
      ? Object.entries(playbookAnswers).filter(([, v]) => v != null && v !== '' && !(Array.isArray(v) && v.length === 0))
      : []
    if (answers.length) {
      parts.push(`Respostas do cadastro desta empresa (preferência real, sobrepõe qualquer padrão genérico do setor):\n${answers.map(([k, v]) => `- ${k}: ${Array.isArray(v) ? v.join(', ') : v}`).join('\n')}`)
    }
    if (!parts.length) return ''
    return `\n\nFICHA DE SETOR — "${String(data?.name ?? verticalKey)}":\n${parts.join('\n\n')}`
  } catch { return '' }
}

// Só os pesos dos pilares da ficha (config.pillars) — usado pra saber em
// quais chaves de pilar vale a pena checar ocupação na semana (ver
// fetchWeekPillarOccupancy). 'generico' ou ficha sem pilares → {} (nunca
// muda o comportamento de quem não tem ficha).
async function fetchPillarWeights(admin: SupaClient, verticalKey: string): Promise<Record<string, number>> {
  if (verticalKey === 'generico') return {}
  try {
    const { data } = await admin.from('vertical_playbooks').select('config').eq('key', verticalKey).eq('enabled', true).maybeSingle()
    const c = (data?.config ?? {}) as Record<string, unknown>
    return (c.pillars && typeof c.pillars === 'object') ? c.pillars as Record<string, number> : {}
  } catch { return {} }
}

// Mesmo padrão de generate-posts/index.ts — avisa em tempo real quando o
// cron cria post(s) novo(s) esperando aprovação. Antes, quem cobria isso
// pro Calendário da Semana e pro teste diário era só o resumo geral do
// daily-briefing (removido — o dono pediu só aviso de post pra aprovar ou
// acontecimento importante, sem relatório diário).
async function notifyMarketing(chatId: string | null | undefined, companyId: string, event: string, data?: Record<string, unknown>) {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const secret = Deno.env.get('BOT_WEBHOOK_SECRET')
  if (!supabaseUrl) return
  fetch(`${supabaseUrl}/functions/v1/log-bot-event`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ secret: secret ?? '', bot_name: 'marketing', event_type: event, company_id: companyId, telegram_chat_id: chatId ? Number(chatId) : null, data }),
  }).catch(() => {})
}
interface Config { agent_name: string; brand_voice: string | null; tone: string | null; target_audience: string | null; content_pillars: string[]; marketing_goals: string | null; business_objectives: string | null }
interface Know { kind: string; title: string; content: string; module?: string }

// O que o negócio REALMENTE faz vem do onboarding (business_description),
// sempre real e específico — nunca depende do Marketing AI ter sido
// configurado (marketing_ai_config fica vazio até o dono/equipe preencher).
// Sem isso, o agente cai no nome+tipo genérico e inventa um posicionamento
// que não bate com o negócio de verdade.
// Regra 5 (nunca inventar) vale pra história também: o teste de 2026-10-14
// gerou um "depoimento" de cliente que nunca existiu ("Ele me mandou uma
// mensagem…", "o negócio foi fechado"). Vale pra qualquer setor.
const HONESTY_RULE = 'REGRA INEGOCIÁVEL: nunca invente cliente, depoimento, conversa, caso, venda/negócio fechado, número, distância ("a 10 minutos de…") ou fato do bairro que não esteja nos dados acima. Pode falar de forma geral ("quem vem de fora costuma…"), nunca como se tivesse acontecido.'

function preamble(config: Config, company: Company, playbookBlock = ''): string {
  const name = config.agent_name?.trim() || 'Agente de Marketing'
  return `Você é ${name}, o agente de marketing de "${company.business_name}" (${company.business_type ?? 'negócio'} em ${company.city ?? 'Brasil'}).
${company.business_description ? `O que o negócio faz de verdade: ${company.business_description}.` : ''}
Voz da marca: ${config.brand_voice ?? 'não definida'}. Tom: ${config.tone ?? 'não definido'}.
Público-alvo: ${config.target_audience ?? company.ideal_customer ?? 'não definido'}.
Pilares: ${config.content_pillars.join(', ') || 'não definidos'}.
Objetivos: ${config.marketing_goals ?? config.business_objectives ?? 'crescer e engajar'}.
${company.language === 'en' ? 'IMPORTANTE: escreva TODO o conteúdo (legenda, hook, CTA, hashtags) em inglês — este negócio atende clientes que falam inglês.' : ''}
${HONESTY_RULE}${playbookBlock}`
}

function defaultConfig(company: Company): Config {
  return { agent_name: 'Agente de Conteúdo', brand_voice: null, tone: null, target_audience: null, content_pillars: ['bastidores', 'novidades', 'depoimentos'], marketing_goals: company.goal ?? null, business_objectives: company.goal ?? null }
}

async function callClaude(anthropicKey: string, prompt: string, maxTokens = 1400): Promise<string> {
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

// Extrai um post do texto da IA de forma tolerante: aceita array, objeto único,
// ou JSON cercado de texto. Devolve null só se realmente não houver post.
function extractOne(raw: string): Record<string, unknown> | null {
  const tryParse = (s: string): unknown => { try { return JSON.parse(s) } catch { return null } }
  let v: unknown = tryParse(raw)
  if (!v) { const a = raw.match(/\[[\s\S]*\]/); if (a) v = tryParse(a[0]) }
  if (!v) { const o = raw.match(/\{[\s\S]*\}/); if (o) v = tryParse(o[0]) }
  if (Array.isArray(v)) v = v[0]
  if (v && typeof v === 'object' && ((v as Record<string, unknown>).caption || (v as Record<string, unknown>).idea)) return v as Record<string, unknown>
  return null
}

// businessDescription conecta a foto ao negócio de verdade (não só ao tipo
// genérico). `conceptHint` é uma tradução FOTOGRÁFICA curada do sistema
// visual escolhido (ver PHOTO_HINT) — nunca o texto cru da Biblioteca: os
// sistemas visuais que são card gráfico/texto (Tweet Print, Antes/Depois,
// Infográfico) não são composição de foto, e mandar essa descrição pro
// gerador de foto fazia a IA tentar desenhar um card cheio de texto
// (garantido "no text" logo depois no mesmo prompt) — saía borrado/
// ilegível e às vezes virava colagem de vários "quadros" numa imagem só.
// Tweet Print/Antes-Depois agora viram o card gráfico de verdade via
// render-format (ver renderGraphicCard); Infográfico fica só na legenda
// (não dá pra "traduzir" um dado real sem inventar número).
// Chama o mesmo controle de qualidade do botão "Avaliar" (content-test),
// server-a-server via service role — funciona tanto no clique interativo
// quanto no lote automático diário (nenhum usuário logado nesse caso).
async function scoreTestContent(companyId: string, testId: string): Promise<boolean> {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!supabaseUrl || !serviceKey) return false
  const res = await fetch(`${supabaseUrl}/functions/v1/content-test`, {
    method: 'POST', headers: { Authorization: `Bearer ${serviceKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'score', test_id: testId, company_id: companyId }),
  })
  if (!res.ok) throw new Error(`content-test score falhou: ${await res.text()}`)
  const data = await res.json().catch(() => ({})) as { auto_vault?: boolean }
  return !!data.auto_vault
}

// REGRA CRÍTICA (arquitetural, não é sugestão): o gerador de imagem só
// desenha a CENA VISUAL — nunca escreve, soletra ou desenha texto nenhum.
// Copy de verdade (hook/CTA/legenda) NUNCA entra neste prompt — só o
// conceito visual curto (`evoke`, feito só a partir de `idea`, nunca de
// caption/hook_angle/offer). Isso existe porque já vimos o bug de verdade:
// uma faixa de festa saiu com "LIGA OF SCRADS" (a IA "alucinando" texto
// sem sentido) — pedir a foto SEM nenhuma pista de texto reduz isso na
// raiz, em vez de só torcer pro analista visual (content-test) pegar depois.
const NO_TEXT_RULE = 'CRITICAL: this image must contain ONLY the visual scene — environment, people, products, objects, lighting, composition. Absolutely NO text of any kind anywhere in the image: no headlines, captions, CTAs, logos with text, signs, banners, posters, screens, labels, packaging text, watermarks, or simulated/gibberish lettering. If the scene naturally includes an object that would normally carry text (a sign, menu, screen, clipboard, label), render it completely blank — a clean empty surface. Never attempt to write, spell, or render any character.'

async function generateImage(companyId: string, businessType: string | null, evoke: string, conceptHint?: string, brandStyle?: string, businessDescription?: string): Promise<string | null> {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? Deno.env.get('SUPABASE_ANON_KEY')
  if (!supabaseUrl || !serviceKey) return null
  try {
    const prompt = `Professional social media photo for a Brazilian small business${businessDescription ? ` (${businessDescription})` : businessType ? ` (${businessType})` : ''}.${conceptHint ? ` Composition: ${conceptHint}.` : ''}${brandStyle ? ` ${brandStyle}` : ''} Commercial photography, warm natural lighting, polished and inviting. ${NO_TEXT_RULE} The photo must clearly and specifically depict this exact visual concept, not a generic stock photo: ${evoke}`
    const res = await fetch(`${supabaseUrl}/functions/v1/generate-image`, {
      method: 'POST', headers: { Authorization: `Bearer ${serviceKey}`, 'Content-Type': 'application/json' },
      // force_new: cada post de teste tem que ser uma imagem NOVA de verdade —
      // sem isso, o generate-image cacheia por prompt+empresa e, quando o
      // Diretor/Copywriter convergem numa ideia parecida com a de um post
      // recente (ou já agendado pro Vault), devolvia a MESMA imagem já usada
      // — o dono viu isso acontecer com um post agendado pro dia seguinte.
      body: JSON.stringify({ prompt, size: '1024x1024', company_id: companyId, force_new: true }),
    })
    const data = await res.json().catch(() => ({})) as { url?: string }
    return res.ok && data.url ? data.url : null
  } catch (e) { console.error('generateImage error:', e); return null }
}

// ── Vault com foto REAL + Higgsfield (pedido do dono, 2026-10-14) ──────────
// Setor cuja ficha pede `real_photo_first` (ex.: imóveis): o post genérico
// usa uma foto REAL do catálogo, tratada pela Higgsfield (Qwen Image 3 Edit:
// só luz, cor e nitidez — mesmo tratamento do criativo do kit grátis), em
// vez de imagem inventada pela OpenAI. Texto continua só via render-format
// ou legenda (regra 4). Sem foto real cadastrada → cai no fluxo antigo.
const RETOUCH_ENDPOINT = '/alibaba/qwen-image-3/edit'
const RETOUCH_PROMPT = 'Professional real-estate photo retouch of this exact place. Improve exposure and white balance, brighten the shadows, ' +
  'make the natural light warm and inviting, increase clarity and sharpness, straighten vertical lines. Keep everything else identical: ' +
  'do not add, remove, move or change any furniture, object, wall, floor, window, door, view or architecture. No text, no letters, no logos, no watermark.'
const RETOUCH_NEGATIVE = 'added furniture, removed objects, changed layout, extra windows, text, letters, logo, watermark, people, distortion'

async function fetchRealPhotoPool(admin: SupaClient, company: Company): Promise<string[]> {
  try {
    const { data: pb } = await admin.from('vertical_playbooks').select('config').eq('key', company.vertical_key ?? 'generico').eq('enabled', true).maybeSingle()
    if ((pb?.config as { real_photo_first?: boolean } | null)?.real_photo_first !== true) return []
    const { data } = await admin.from('marketing_ai_knowledge').select('meta').eq('company_id', company.id).eq('kind', 'product')
    const urls: string[] = []
    for (const r of (data ?? []) as { meta: { photos?: { url?: string }[] } | null }[]) for (const ph of r.meta?.photos ?? []) if (ph?.url) urls.push(ph.url)
    for (let k = urls.length - 1; k > 0; k--) { const m = Math.floor(Math.random() * (k + 1)); [urls[k], urls[m]] = [urls[m], urls[k]] }
    return urls
  } catch { return [] }
}

// Trata a foto real na Higgsfield e guarda no nosso Storage (o link deles
// expira). Espera até ~75s; se não der, devolve null e quem chamou usa a foto
// real sem tratamento (nunca trava o post).
async function retouchRealPhoto(admin: SupaClient, companyId: string, photo: string): Promise<string | null> {
  const cred = (Deno.env.get('HF_CREDENTIALS') ?? '').trim()
  if (!cred) return null
  const headers = { Authorization: `Key ${cred}`, 'Content-Type': 'application/json' }
  try {
    const res = await fetch(`https://api.higgsfield.ai${RETOUCH_ENDPOINT}`, {
      method: 'POST', headers, signal: AbortSignal.timeout(30_000),
      body: JSON.stringify({ prompt: RETOUCH_PROMPT, negative_prompt: RETOUCH_NEGATIVE, image_urls: [photo], resolution: '1k', aspect_ratio: '3:4', enable_thinking: false, prompt_extend: false }),
    })
    const out = await res.json().catch(() => ({})) as { request_id?: string }
    if (!res.ok || !out.request_id) { console.log('[vault-real] higgsfield recusou', res.status); return null }
    await logPhotoRetouch(admin, companyId) // aceito = cobrado (teto único, _shared/spendCap.ts)
    const deadline = Date.now() + 75_000
    while (Date.now() < deadline) {
      await new Promise(r => setTimeout(r, 5000))
      const st = await fetch(`https://api.higgsfield.ai/requests/${encodeURIComponent(out.request_id)}/status`, { headers, signal: AbortSignal.timeout(20_000) })
      if (!st.ok) continue
      const d = await st.json() as { status?: string; images?: { url?: string }[] }
      const url = d.images?.[0]?.url
      if (d.status === 'completed' && url) {
        const img = await fetch(url, { signal: AbortSignal.timeout(60_000) })
        if (!img.ok) return null
        const path = `renders/${companyId}/vault-real-${crypto.randomUUID()}.png`
        const { error } = await admin.storage.from('post-images').upload(path, new Uint8Array(await img.arrayBuffer()), { contentType: img.headers.get('content-type') ?? 'image/png', upsert: false })
        if (error) { console.log('[vault-real] upload falhou', error.message); return null }
        return admin.storage.from('post-images').getPublicUrl(path).data.publicUrl as string
      }
      if (['failed', 'nsfw', 'canceled'].includes(String(d.status))) return null
    }
  } catch (e) { console.log('[vault-real] falhou', String(e)) }
  return null
}

// Modelos de imagem disponíveis pro Diretor escolher — os MESMOS templates
// reais de "Gerar imagem de formato" (formatTemplates/render-format), não
// uma lista solta desconectada ("livre" é o equivalente conceitual de
// "photo" lá — ver FORMAT_CLASS em shared.ts). TODOS, incluindo "livre",
// são escolhas deliberadas com um USO específico — nenhum é "o padrão pra
// quando não souber o que escolher". O Diretor decide isso ANTES de
// qualquer geração de imagem/texto acontecer, nunca depois. 'product' só
// entra na lista se a empresa já tem foto real de produto cadastrada —
// nunca oferece uma opção que não tem como cumprir de verdade.
// REGRA: essa lista e a de formatTemplates.tsx/TEMPLATES precisam ficar
// sempre em sincronia — tirando/adicionando um formato aqui, espelhar lá
// (e vice-versa). Foi assim que "Anúncio" e "Antes/Depois" saíram dos
// dois lugares juntos, e "Estatística" nunca chegou a entrar aqui.
// "product" (foto real), "review" (avaliação real) e "market_watch" (número
// real) só entram quando a empresa TEM esse dado de verdade — sem isso a IA
// inventaria avaliação/número falso pra preencher o card (pedido do dono,
// 2026-09: formato que depende de info que não existe ainda fica de fora da
// rotação automática E da escolha manual até a info existir).
const TEMPLATE_DESC = (hasProduct: boolean, hasReview: boolean, hasStat: boolean): Record<string, string> => ({
  livre: 'Foto realista e ESPECÍFICA do negócio, sem texto embutido na imagem — a legenda faz o trabalho de texto. Use quando o valor do post está na FOTO em si: um momento real, um clima, um resultado visual que fala por si só (não é o "padrão" — é a escolha certa quando nenhum card de texto serviria melhor que uma foto de verdade).',
  tweet: 'Card estilo "tweet"/nota com uma frase de efeito em texto nítido, sem foto. Bom pra opinião, gancho ou dado curioso forte.',
  ...(hasProduct ? { product: 'Produto centralizado tipo pôster (usa uma foto de produto real já cadastrada), com nome/chamada. Só quando o post é sobre esse produto específico.' } : {}),
  problem: 'Card gráfico "dor → virada": expõe uma dor comum do público (citação entre aspas), muda a perspectiva e fecha com um insight. Bom pra atrair quem se identifica com o problema.',
  faq: 'Card gráfico "pergunta do cliente → resposta da marca": quebra uma dúvida/objeção real e comum do segmento. Bom pra educar e reduzir hesitação.',
  trend: 'Card gráfico de tendências do setor: 3 mudanças/movimentos curtos. Bom pra se posicionar como quem entende do assunto.',
  ...(hasStat ? { market_watch: 'Card gráfico com UM número REAL em destaque (vem pronto, ver "Dado real disponível" abaixo) — NUNCA invente o número.' } : {}),
  ...(hasReview ? { review: 'Card gráfico de prova social com uma avaliação REAL de cliente (vem pronta, ver "Avaliação real disponível" abaixo) — NUNCA invente citação/nome/nota.' } : {}),
})

// Os cards gráficos (tweet/product) têm espaço FIXO e pequeno —
// diferente da legenda do Instagram, que é livre e longa. Cortar a legenda
// pra caber no card (substring bruto) sempre saia cortado no meio da frase,
// ilegível — o bug real que gerou a imagem quebrada mostrada pelo dono.
// A correção certa é pedir pro Copywriter escrever um texto CURTO e
// COMPLETO específico pro card, nunca derivar truncando o texto longo.
// SEM EMOJI em nenhum card_*: a fonte carregada no servidor pra renderizar
// o card (Poppins) não tem glifo de emoji — sai um quadrado/tofu visível no
// lugar (bug real visto pelo dono num Tweet Print). render-format também
// tira qualquer emoji que passar como rede de segurança, mas o certo é
// nunca escrever um pra começo de conversa.
const NO_EMOJI_CARD = 'NUNCA use emoji em nenhum campo "card_*" — a fonte do card não tem esse glifo, vira um quadrado visível.'
const CARD_FIELD_INSTRUCTIONS: Record<string, string> = {
  tweet: `- Preencha TAMBÉM "card_text": a frase de efeito que vai DENTRO do card gráfico (máx. 180 caracteres) — uma frase CURTA e COMPLETA, nunca cortada no meio. ${NO_EMOJI_CARD}`,
  product: `- Preencha TAMBÉM "card_cta" (máx. 4 palavras, tipo "Compre agora" — NUNCA uma frase longa) — vai IMPRESSO no botão da imagem do produto. ${NO_EMOJI_CARD}`,
  problem: `- Preencha TAMBÉM "card_problem" (a dor do público, citação curta entre aspas, máx. 140 caracteres), "card_reframe" (a virada de perspectiva, máx. 100 caracteres) e "card_insight" (o insight final, opcional, máx. 100 caracteres). Frases CURTAS e COMPLETAS, nunca cortadas no meio. ${NO_EMOJI_CARD}`,
  faq: `- Preencha TAMBÉM "card_question" (a pergunta/objeção do cliente entre aspas, máx. 90 caracteres) e "card_answer" (a resposta direta, máx. 140 caracteres). ${NO_EMOJI_CARD}`,
  trend: `- Preencha TAMBÉM "card_title" (o tema da tendência, máx. 60 caracteres) e "card_items" (3 mudanças/itens curtos, cada um máx. 40 caracteres, separados por " | "). ${NO_EMOJI_CARD}`,
  market_watch: `- Preencha TAMBÉM "card_headline" (pergunta/contexto sobre o mercado, máx. 60 caracteres) e "card_insight" (o que o número REAL abaixo significa pro dono, máx. 100 caracteres — NÃO invente o número). ${NO_EMOJI_CARD}`,
}
const CARD_FIELD_JSON: Record<string, string> = {
  tweet: ',"card_text":""',
  product: ',"card_cta":""',
  problem: ',"card_problem":"","card_reframe":"","card_insight":""',
  faq: ',"card_question":"","card_answer":""',
  trend: ',"card_title":"","card_items":""',
  market_watch: ',"card_headline":"","card_insight":""',
}
function round1(n: number): string { return (Math.round(n * 10) / 10).toLocaleString('pt-BR') }
function fmtNum(n: number): string { return Math.round(n).toLocaleString('pt-BR') }
function sourceLabel(s: string): string { const l = s.toLowerCase(); if (l.includes('google')) return 'Google'; if (l.includes('insta')) return 'Instagram'; if (l.includes('face')) return 'Facebook'; return s }

// Prova social e Market Watch precisam de DADO REAL pra existir — nunca
// deixamos a IA inventar avaliação/número (mesma regra de content-engine:
// "nunca inventa número"). Sem dado real, o template nem entra em
// TEMPLATE_DESC — some da rotação automática E da escolha manual (pedido
// do dono, 2026-09: formato que precisa de info que não temos ainda fica
// de fora até a info existir de verdade).
async function fetchRealReview(admin: SupaClient, companyId: string): Promise<{ text: string; author: string; stars: string; source: string } | null> {
  const { data } = await admin.from('reviews').select('author, rating, text, source').eq('company_id', companyId).gte('rating', 4).not('text', 'is', null).order('review_date', { ascending: false }).limit(1).maybeSingle()
  const d = data as { author: string | null; rating: number | null; text: string | null; source: string | null } | null
  if (!d?.text) return null
  return { text: d.text.slice(0, 240), author: d.author || 'Cliente', stars: String(d.rating ?? 5), source: d.source ? sourceLabel(d.source) : '' }
}
async function fetchRealStat(admin: SupaClient, companyId: string): Promise<{ value: string; label: string } | null> {
  const { data: eng } = await admin.from('marketing_ai_tracking_snapshots').select('engagement_rate, avg_reach').eq('company_id', companyId).order('collected_at', { ascending: false }).limit(1).maybeSingle()
  const e = eng as { engagement_rate: number | null; avg_reach: number | null } | null
  if (e?.engagement_rate != null && e.engagement_rate > 0) return { value: `${round1(e.engagement_rate)}%`, label: 'sua taxa de engajamento' }
  if (e?.avg_reach != null && e.avg_reach > 0) return { value: fmtNum(e.avg_reach), label: 'seu alcance médio' }
  const { data: comp } = await admin.from('marketing_ai_competitors').select('avg_engagement').eq('company_id', companyId).order('last_analyzed_at', { ascending: false }).limit(10)
  const rows = (comp ?? []) as { avg_engagement: number | null }[]
  const engs = rows.map(r => r.avg_engagement).filter((v): v is number => v != null && v > 0)
  if (!engs.length) return null
  let avg = engs.reduce((a, b) => a + b, 0) / engs.length
  if (avg <= 1) avg *= 100
  return { value: `${round1(avg)}%`, label: 'o engajamento médio dos concorrentes do seu setor' }
}

// Corta no limite de PALAVRA (nunca no meio de uma) e nunca finge que o
// texto continua — evita repetir o bug de truncar substring bruto.
function capWords(s: string, maxChars: number): string {
  const t = (s ?? '').trim()
  if (t.length <= maxChars) return t
  const cut = t.slice(0, maxChars)
  const lastSpace = cut.lastIndexOf(' ')
  return (lastSpace > maxChars * 0.6 ? cut.slice(0, lastSpace) : cut).trim() + '…'
}

// Pro template "livre", traduz o sistema visual escolhido (quando SÃO
// fotografáveis) numa composição fotográfica de verdade — 'Infográfico'
// fica de fora (dado real ou nada, não dá pra fabricar estatística visual).
const PHOTO_HINT: Record<string, string> = {
  'Comparação': 'side-by-side composition clearly comparing two distinct options or states',
  'Checklist': 'flat-lay composition with the physical items/elements neatly arranged, as if laid out to check off one by one',
  'Timeline': 'a single clear moment representing one step of an ongoing process or journey, implying progression',
}

interface CardBrand { primary: string; name: string; accent?: string; text?: string; bg?: string; logoUrl?: string }

// Renderiza o card gráfico de verdade via render-format (SVG → PNG, texto
// nítido, sem custo de IA além das fotos que o card em si precisar). `save:
// false` porque quem grava a linha em marketing_ai_test_content é sempre
// esta função (creative-generate), não o render-format. Encaminha a
// autenticação de quem chamou: bearer do dono (modo interativo) ou
// cron_secret+company_id (modo lote, sem usuário logado).
async function renderGraphicCard(
  auth: { bearer: string; isCron: boolean; cronSecret?: string },
  companyId: string, template: 'tweet' | 'slide' | 'product' | 'problem' | 'faq' | 'trend' | 'market_watch' | 'review' | 'photo', fields: Record<string, string>, brand: CardBrand,
): Promise<string | null> {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  if (!supabaseUrl) return null
  try {
    const body: Record<string, unknown> = { template, fields, brand, save: false }
    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    if (auth.isCron && auth.cronSecret) { body.cron_secret = auth.cronSecret; body.company_id = companyId }
    else headers.Authorization = auth.bearer
    const res = await fetch(`${supabaseUrl}/functions/v1/render-format`, { method: 'POST', headers, body: JSON.stringify(body) })
    const data = await res.json().catch(() => ({})) as { url?: string }
    return res.ok && data.url ? data.url : null
  } catch (e) { console.error('renderGraphicCard error:', e); return null }
}

const slugHandle = (name: string): string => {
  const s = name.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '')
  return s.slice(0, 15) || 'negocio'
}

function listByKind(lib: Know[], kind: string): string {
  return lib.filter(k => k.kind === kind).map(k => `- ${k.title}: ${k.content}`).join('\n') || '(nenhum)'
}
function findContent(lib: Know[], kind: string, title: string | undefined): string {
  if (!title) return ''
  const e = lib.find(k => k.kind === kind && k.title.toLowerCase() === String(title).toLowerCase())
  return e ? `${e.title}: ${e.content}` : ''
}

// Formatos permitidos por módulo: Orgânico faz foto ou carrossel; Stories só
// faz foto (reel/story hoje só geram 1 imagem estática, não vídeo de
// verdade — melhor não prometer um formato que a plataforma não entrega).
// Campanhas (mídia paga) segue livre.
const ALLOWED_FORMATS: Record<string, string[]> = { organico: ['foto', 'carrossel'], stories: ['foto'], campanhas: ['reel', 'carrossel', 'story', 'foto'] }
const MOD_LABEL: Record<string, string> = { organico: 'Post Orgânico', stories: 'Stories', campanhas: 'Campanha (mídia paga)' }

interface GenOpts {
  bearer: string; isCron: boolean; cronSecret?: string
  seed?: { title?: string; hook?: string; angle?: string; format?: string } | null
  ideaId?: string | null
  skipImage?: boolean
  // Escolha manual do dono no botão "Gerar post de teste": undefined/null =
  // automático (rotação estrita), 'random' = sorteia um dos templates
  // existentes, ou a chave exata de um template (força esse e força "foto").
  templateChoice?: string | null
  // Calendário da Semana: pra qual dia (YYYY-MM-DD) este post foi planejado —
  // ver planWeekForCompany(). Sem isso (geração avulsa normal) fica null.
  plannedFor?: string | null
  // Carrossel de slides (tipo apresentação) a partir de uma ideia/trend —
  // pedido do dono 2026-10-14: "post do zero, tipo PowerPoint, só pela ideia
  // que a trend traz". Cada slide é um card do render-format (texto nítido da
  // marca, custo zero); a IA de imagem nunca escreve texto (regra 4).
  deck?: boolean
}

// O núcleo da geração — usado tanto pelo modo interativo (1 empresa, o
// dono clicou) quanto pelo lote diário (várias empresas, cron).
async function generateForCompany(admin: SupaClient, anthropicKey: string, company: Company, kind: string, opts: GenOpts) {
  // Fluxo antigo fechado (dono, 2026-10-15): se a ficha do setor desligou o
  // card genérico (post_card — imagem de IA/tweet), QUALQUER pedido de post
  // solto (botão de ideia, cron diário antigo, estratégia antiga) sai como
  // carrossel de slides da marca.
  if (!opts.deck && !(await fetchFormatCatalog(admin, company.vertical_key ?? 'generico', company.id)).some(f => f.key === 'post_card')) opts = { ...opts, deck: true }
  const [{ data: cfgRow }, { data: insRows }, { data: libRows }, { data: visRows }, { data: fmtRows }, { data: bdRow }, { data: recentRows }, { data: productRows }, realReview, realStat, playbookBlock] = await Promise.all([
    admin.from('marketing_ai_config').select('agent_name, brand_voice, tone, target_audience, content_pillars, marketing_goals, business_objectives, allow_carrossel').eq('company_id', company.id).maybeSingle(),
    admin.from('marketing_ai_insights').select('pillar, title, description').eq('company_id', company.id).eq('status', 'open').order('created_at', { ascending: false }).limit(6),
    admin.from('marketing_ai_knowledge').select('kind, title, content, module').or(`company_id.is.null,company_id.eq.${company.id}`).in('module', ['core', kind]),
    admin.from('marketing_ai_knowledge').select('title, meta').or(`company_id.is.null,company_id.eq.${company.id}`).eq('module', 'visual').eq('kind', 'layout').order('created_at', { ascending: false }).limit(8),
    admin.from('marketing_ai_knowledge').select('title, content, meta').eq('company_id', company.id).eq('module', 'formato').order('created_at', { ascending: false }).limit(10),
    admin.from('brand_dna').select('colors, design_notes, kit, logo_url').eq('company_id', company.id).maybeSingle(),
    admin.from('marketing_ai_test_content').select('format, brief').eq('company_id', company.id).order('created_at', { ascending: false }).limit(5),
    // Fotos reais de produto (aba Produtos, Estilos e Visuais) — só existe o
    // template "Foco no Produto" pro Diretor se houver pelo menos uma.
    admin.from('marketing_ai_knowledge').select('title, image_url').eq('company_id', company.id).eq('module', 'visual').eq('kind', 'product').order('created_at', { ascending: false }).limit(1),
    // Mesma regra: "review"/"market_watch" só existem pro Diretor se houver
    // avaliação/número real — ver fetchRealReview/fetchRealStat.
    fetchRealReview(admin, company.id),
    fetchRealStat(admin, company.id),
    fetchPlaybookBlock(admin, company.vertical_key ?? 'generico', company.playbook_answers),
  ])
  const config = (cfgRow as Config | null) ?? defaultConfig(company)
  // Botão "considerar carrossel" (Área de Testes) — desligado por padrão:
  // sem carrossel, todo post vira "foto" e sempre passa pelos templates
  // reais (nenhum deles hoje é pensado pra vários slides).
  const allowCarrossel = !!(cfgRow as { allow_carrossel?: boolean } | null)?.allow_carrossel
  const insights = (insRows ?? []) as { pillar: string; title: string; description: string }[]
  const lib = (libRows ?? []) as Know[]
  // Referências visuais da marca (Layouts & Estilos) — só metadados, limitado (custo).
  const visualRefs = ((visRows ?? []) as { title: string; meta: Record<string, string> | null }[])
    .map(v => { const m = v.meta ?? {}; return `- ${v.title}${m.category ? ` [${m.category}]` : ''}${m.visual_style ? `, estilo ${m.visual_style}` : ''}${m.colors ? `, cores ${m.colors}` : ''}${m.composition ? `, composição ${m.composition}` : ''}` }).join('\n')
  // Conhecimento especializado do módulo que está sendo gerado (Orgânico/Stories/Campanhas).
  const moduleKnow = lib.filter(k => k.module === kind).map(k => `- ${k.title}: ${k.content}`).join('\n') || '(sem específicos ainda)'
  const modLabel = MOD_LABEL[kind] ?? kind

  // Formatos disponíveis (aba Formatos): anatomia de cada tipo de post — quais
  // campos/componentes a IA precisa preencher pra montar aquela imagem.
  const formatsRef = ((fmtRows ?? []) as { title: string; content: string | null; meta: { fields?: string[]; example?: string } | null }[])
    .map(f => { const fields = f.meta?.fields?.length ? ` — campos: ${f.meta.fields.join(', ')}` : ''; return `- ${f.title}${f.content ? `: ${f.content}` : ''}${fields}` }).join('\n')

  // Estilo da marca (Kit): cores + direção de arte entram na foto gerada pela
  // IA — é o "sem asset, a IA gera do zero seguindo o kit".
  type Kit = { colors?: { primary?: string[]; accent?: string[]; text?: string; bg?: string } } | null
  const bd = (bdRow as { colors: string[] | null; design_notes: string | null; kit: Kit; logo_url: string | null } | null) ?? null
  const brandColors = (bd?.colors ?? []).slice(0, 4).join(', ')
  const brandStyle = [brandColors ? `Brand color palette: ${brandColors}.` : '', bd?.design_notes ? `Art direction: ${bd.design_notes}.` : ''].filter(Boolean).join(' ') || undefined
  // Mesmo Kit que a Biblioteca (Estilos e Visuais) e "Gerar imagem de
  // formato" usam — os cards gráficos (Tweet Print/Antes-Depois) saem com
  // a cor/logo reais da empresa, não um laranja genérico.
  const kitColors = bd?.kit?.colors
  const cardBrand: CardBrand = {
    primary: kitColors?.primary?.[0] || bd?.colors?.[0] || '#FF6D29', name: company.business_name,
    accent: kitColors?.accent?.[0], text: kitColors?.text, bg: kitColors?.bg, logoUrl: bd?.logo_url ?? undefined,
  }
  const product = ((productRows ?? [])[0] as { title: string; image_url: string | null } | undefined) ?? null
  const templateDesc = TEMPLATE_DESC(!!product?.image_url, !!realReview, !!realStat)
  const templateKeys = Object.keys(templateDesc)
  const templateList = templateKeys.map(k => `"${k}"`).join('|')

  // Últimos formatos/sistemas visuais/frameworks já usados — sem isso o
  // Diretor converge sempre na MESMA escolha "mais lógica" pro negócio
  // (ex: sempre "Antes/Depois" + "BAB" pra um negócio sobre transformação),
  // porque o contexto da empresa não muda entre gerações. Pedir variedade
  // explícita evita repetir o mesmo formato/visual toda vez.
  const recent = (recentRows ?? []) as { format: string | null; brief: { visual_system?: string; framework?: string; template?: string } | null }[]
  const recentUsed = recent.filter(r => r.format || r.brief?.visual_system || r.brief?.framework)
    .map(r => `- formato "${r.format ?? '—'}", template "${r.brief?.template ?? '—'}", sistema visual "${r.brief?.visual_system ?? '—'}", framework "${r.brief?.framework ?? '—'}"`).join('\n')

  // Ideia-semente vinda do Creative Agent (opcional): o dono escolheu uma
  // ideia; o Diretor constrói o brief em cima dela em vez de inventar do zero.
  const seed = opts.seed ?? null
  const seedBlock = seed ? `\nIDEIA ESCOLHIDA PELO DONO (construa o brief em cima dela, não invente outra):
- Título: ${seed.title ?? '—'}
- Gancho: ${seed.hook ?? '—'}
- Ângulo: ${seed.angle ?? '—'}
- Formato sugerido: ${seed.format ?? '—'}${seed.format ? ` — RESPEITE esse formato no seu "format" a menos que haja um motivo forte pra mudar (aí explique o motivo em "reasoning"). Nem toda ideia precisa virar carrossel: se o formato sugerido for "foto", gere UMA foto só.` : ''}\n` : ''

  // ── Passo 1: Diretor Criativo → BRIEF ────────────────────────────
  const baseFormats = ALLOWED_FORMATS[kind] ?? ['foto', 'carrossel']
  const allowedFormats = allowCarrossel ? baseFormats : baseFormats.filter(f => f !== 'carrossel')
  const fmtList = allowedFormats.map(f => `"${f}"`).join('|')

  // Template: nunca fica só na mão da IA. Ela convergia sempre no "mais
  // lógico" pro negócio (repetindo o mesmo template, às vezes até gerando
  // conceito quase idêntico a um post recente) — pedido explícito do dono
  // depois de ver uma imagem duplicada de um post já agendado. Resolvido
  // ANTES do Diretor, em ordem de força:
  //  1) o dono escolheu um template específico no botão (ou pediu "random",
  //     já sorteado aqui) → esse manda, sempre, e força "foto".
  //  2) sem escolha manual → rotação estrita pelo PRÓXIMO template da lista
  //     (nunca repete o do post anterior enquanto houver outro disponível),
  //     aplicada depois que o Diretor decidir "format" (só vale se for foto).
  const templateChoiceInput = opts.templateChoice ?? null
  const forcedTemplate = templateChoiceInput === 'random'
    ? templateKeys[Math.floor(Math.random() * templateKeys.length)]
    : (templateChoiceInput && templateKeys.includes(templateChoiceInput) ? templateChoiceInput : null)

  const directorPrompt = `${preamble(config, company, playbookBlock)}

Você é o DIRETOR CRIATIVO de uma agência. Vai criar um conteúdo do tipo "${modLabel}". Decida o brief usando os insights reais e as boas práticas ESPECÍFICAS desse formato (não use regra genérica).
${seedBlock}${insights.length ? `\nInsights abertos:\n${insights.map(i => `- [${i.pillar}] ${i.title}: ${i.description}`).join('\n')}` : ''}
${recentUsed ? `\nÚltimos posts desse negócio (formato/sistema visual/framework já usados — VARIE, não repita o mesmo combo à toa só porque "faz sentido pro negócio"; só repita se você tiver um motivo estratégico real e disser isso em "reasoning"):\n${recentUsed}` : ''}

Boas práticas do formato ${modLabel}:\n${moduleKnow}
${formatsRef ? `\nFormatos disponíveis (escolha a anatomia certa e cite em "format" quando usar um):\n${formatsRef}` : ''}
Personalidades disponíveis:\n${listByKind(lib, 'personality')}
Frameworks de copy:\n${listByKind(lib, 'framework')}
Sistemas visuais (guiam como a LEGENDA é estruturada):\n${listByKind(lib, 'visual_system')}
Hooks de referência:\n${listByKind(lib, 'hook')}

Modelos de imagem disponíveis pra "template" (o motor real que monta a imagem — decida ANTES de qualquer legenda/foto existir, a imagem final tem que encaixar NELE, não o contrário):
${templateKeys.map(k => `- ${k}: ${templateDesc[k]}`).join('\n')}
${product ? `Produto real cadastrado disponível: "${product.title}" (só use "template":"product" se o post for de fato sobre ele).` : ''}
${realReview ? `Avaliação real disponível pra usar no template "review" (NÃO invente outra citação/nome/nota — a que vem aqui é a que vai no card): "${realReview.text}" — ${realReview.author}, ${realReview.stars}★${realReview.source ? ` (${realReview.source})` : ''}.` : ''}
${realStat ? `Dado real disponível pra usar no template "market_watch" (NÃO invente outro número — o que vem aqui é o que vai no card): ${realStat.value}, sobre ${realStat.label}.` : ''}

${forcedTemplate ? `\nTEMPLATE JÁ DECIDIDO (não escolha outro — use exatamente "${forcedTemplate}" no seu "template" e monte hook/CTA/oferta pra ele funcionar bem, isso força "format":"foto"): "${forcedTemplate}".\n` : ''}
IMPORTANTE: "format" só pode ser um destes (${modLabel} não suporta os outros): ${fmtList}. "template" só pode ser um destes: ${templateList} — só é usado de verdade quando "format" for "foto" (ignore pra carrossel/reel/story). Passe pelas opções de verdade, uma por uma, e escolha a que MELHOR serve essa ideia específica — nenhuma delas (nem "livre") é o padrão pra quando você não souber o que escolher; TODAS exigem motivo real, que você explica em "reasoning" (cite ali por que escolheu esse template e não outro). VARIE de verdade (veja "Últimos posts" acima — não deixe o mesmo template se repetir sem um motivo estratégico real).
Decida o brief. Retorne APENAS um JSON:
{"objective":"awareness|engagement|conversion","format":${fmtList},"template":${templateList},"visual_system":"<título exato da biblioteca>","personality":"<título exato da biblioteca>","framework":"<título exato da biblioteca>","hook_angle":"ângulo do gancho em 1 frase","cta":"chamada pra ação","offer":"oferta/valor em 1 frase (ou vazio)","reasoning":"por que essas escolhas (incluindo o template), citando o insight"}`

  const brief = parseObj(await callClaude(anthropicKey, directorPrompt, 900))
  // Rede de segurança: se a IA ignorar a restrição, força pro formato/
  // template permitido mais próximo em vez de deixar vazar algo não suportado.
  if (!allowedFormats.includes(String(brief.format))) brief.format = allowedFormats[0]
  if (!templateKeys.includes(String(brief.template))) brief.template = 'livre'
  if (opts.deck) {
    brief.format = 'carrossel'
    brief.template = 'livre'
  } else if (forcedTemplate) {
    // Escolha manual do dono (ou "aleatório" já sorteado) — sempre vence.
    brief.template = forcedTemplate
    brief.format = 'foto'
  } else if (String(brief.format) === 'foto') {
    // Automático: ignora o palpite da IA e gira pro PRÓXIMO template da
    // lista (round-robin real, não só "pedir educadamente pra variar" —
    // isso não bastava, a IA repetia/quase-duplicava mesmo assim).
    const lastTemplate = recent[0]?.brief?.template
    const lastIdx = lastTemplate && templateKeys.includes(lastTemplate) ? templateKeys.indexOf(lastTemplate) : -1
    const rotated = templateKeys[(lastIdx + 1) % templateKeys.length]
    if (rotated !== brief.template) brief.reasoning = `${brief.reasoning ?? ''} (Template ajustado para "${rotated}" pela rotação automática entre todos os formatos.)`.trim()
    brief.template = rotated
  }
  const personality = String(brief.personality ?? 'Copywriter')

  // ── Passo 2: a personalidade EXECUTA, consultando a biblioteca ─────────
  const personaContent = findContent(lib, 'personality', personality) || 'Copywriter: texto claro e persuasivo.'
  const frameworkContent = findContent(lib, 'framework', brief.framework as string | undefined)
  const visualContent = findContent(lib, 'visual_system', brief.visual_system as string | undefined)
  const visualSystemTitle = String(brief.visual_system ?? '')

  const execPrompt = `${preamble(config, company, playbookBlock)}

Você agora EXECUTA como esta personalidade: ${personaContent}

Siga fielmente o brief do Diretor Criativo:
- Objetivo: ${brief.objective ?? '—'}
- Formato: ${brief.format ?? 'foto'}
- Modelo de imagem: ${brief.template ?? 'livre'} — ${templateDesc[String(brief.template ?? 'livre')] ?? ''}
- Ângulo do hook: ${brief.hook_angle ?? '—'}
- CTA desejado: ${brief.cta ?? '—'}
- Oferta: ${brief.offer ?? '—'}
${brief.template === 'product' && product ? `- Produto real desse post: "${product.title}" — a legenda precisa ser sobre ESTE produto especificamente.` : ''}
${frameworkContent ? `\nUse este framework de copy:\n${frameworkContent}` : ''}
${visualContent ? `\nConceito visual a evocar:\n${visualContent}` : ''}

Boas práticas do formato ${modLabel} (siga-as):\n${moduleKnow}
${visualRefs ? `\nReferências visuais da marca (Layouts & Estilos — inspire-se no estilo quando fizer sentido):\n${visualRefs}\n` : ''}${lessonsBlock(await loadLessons(admin, company.id))}
Escreva o post pronto pra publicar. Regras importantes:
- "caption" é APENAS a legenda que vai no Instagram (texto pro público). NUNCA coloque nela instruções de imagem, descrição de foto nem "Slide 1/2/3".
- Se o formato for CARROSSEL, preencha "slides": um array de 3 a 6 slides QUE CONTAM UMA HISTÓRIA JUNTOS, nunca fotos soltas e desconectadas — o mesmo cenário/produto/personagem evoluindo de slide a slide, com progressão clara (ex: preparação → durante → resultado; problema → solução → chamada). Cada slide: {"text": texto curto que aparece no slide, "image": descrição visual EM INGLÊS da imagem daquele slide, continuando visualmente do slide anterior (sem pessoas, sem texto na imagem)}.
${opts.deck ? `- ESTE é um CARROSSEL DE SLIDES (tipo apresentação, só texto na arte — sem foto): "slides" com 4 a 7 itens. Slide 1 = o gancho; do meio = um ponto por slide; último = a chamada pra ação. Cada "text" é UMA frase curta e completa (máx. 160 caracteres, sem emoji, nunca cortada no meio). Deixe "image" vazio.
` : ''}- Se for vídeo/reel/story, preencha "video_script" (roteiro de como gravar). Caso contrário, deixe vazio.
- Depois de escrever, avalie o PRÓPRIO post: ele é forte/direto o suficiente pra também valer a pena repostar nos Stories tal como está (sem regerar nada)? Se sim, "story_worthy":true e "story_note": 1 frase curta dizendo por quê. Seja seletivo — nem todo post é bom pra Stories (ex: um card com muito texto lido rápido não funciona lá); só marque true quando fizer sentido de verdade.
${CARD_FIELD_INSTRUCTIONS[String(brief.template ?? '')] ?? ''}
Retorne APENAS um JSON array:
[{"idea":"resumo curto do post","caption":"só a legenda do Instagram, texto pro público","hashtags":"#tag1 #tag2 #tag3","cta":"chamada pra ação final","format":"${brief.format ?? 'foto'}","video_script":"","slides":[{"text":"","image":""}],"story_worthy":true|false,"story_note":""${CARD_FIELD_JSON[String(brief.template ?? '')] ?? ''}}]`

  const execRaw = await callClaude(anthropicKey, execPrompt, 2000)
  let post = extractOne(execRaw)
  if (!post) {
    // Fallback: uma tentativa direta e simples, garante que o dono sempre recebe um post.
    const fbRaw = await callClaude(anthropicKey, `${preamble(config, company, playbookBlock)}

Escreva 1 post de Instagram pronto pra publicar sobre o negócio (formato ${brief.format ?? 'foto'}). Responda SOMENTE com um JSON array, sem nenhum texto antes ou depois:
[{"idea":"resumo curto","caption":"legenda completa","hashtags":"#a #b #c","cta":"chamada pra ação","format":"${brief.format ?? 'foto'}"}]`, 1500)
    post = extractOne(fbRaw)
    if (!post) {
      console.error('creative-generate: parse falhou. exec:', execRaw.slice(0, 300), '| fb:', fbRaw.slice(0, 300))
      throw new Error('A IA não retornou um post válido. Tente de novo.')
    }
  }

  const fmt = String(post.format ?? brief.format ?? 'foto')
  const idea = post.idea ? String(post.idea) : null
  const caption = post.caption ? String(post.caption) : null

  const { data: inserted, error: insErr } = await admin.from('marketing_ai_test_content').insert({
    company_id: company.id, kind, idea, caption,
    hashtags: post.hashtags ? String(post.hashtags) : null,
    cta: post.cta ? String(post.cta) : (brief.cta as string ?? null),
    format: fmt, reasoning: brief.reasoning as string ?? null,
    video_script: post.video_script ? String(post.video_script) : null, brief, personality,
    planned_for: opts.plannedFor ?? null,
    story_worthy: !!post.story_worthy, story_note: post.story_note ? String(post.story_note) : null,
  }).select('id').single()
  if (insErr) throw new Error(insErr.message)

  let mainImage: string | null = null
  let slides: { text: string; image_prompt: string; image_url: string | null }[] | null = null
  // Só `idea` (o CONCEITO visual curto) — nunca hook_angle/offer/caption:
  // são copy de verdade, e mandar isso pro prompt de imagem é exatamente o
  // que ensina a IA a tentar "escrever" a frase na foto (ver NO_TEXT_RULE).
  const evoke = () => (idea ?? '').slice(0, 400) || 'foto do negócio'
  const conceptHint = PHOTO_HINT[visualSystemTitle]
  // Foto real primeiro (setor com real_photo_first + catálogo com fotos).
  const realPool = opts.skipImage ? [] : await fetchRealPhotoPool(admin, company)
  let realIdx = 0
  const nextReal = () => (realPool.length ? realPool[realIdx++ % realPool.length] : null)
  // Teto único do mês estourado: foto real SEM tratamento (grátis), nunca trava o post.
  const retouchOk = realPool.length ? (await fitsCap(admin, company.id, HF_EDIT_COST_USD)).ok : false
  const pic = async (ev: string, hint?: string): Promise<string | null> => {
    const real = nextReal()
    if (real) return (retouchOk ? await retouchRealPhoto(admin, company.id, real) : null) ?? real
    return generateImage(company.id, company.business_type, ev, hint, brandStyle, company.business_description ?? undefined)
  }
  // Slide de carrossel: foto real sem tratamento (1 chamada paga por slide
  // seria caro demais); sem foto real, o fluxo antigo.
  const slidePic = async (ev: string, hint?: string): Promise<string | null> =>
    nextReal() ?? generateImage(company.id, company.business_type, ev, hint, brandStyle, company.business_description ?? undefined)

  if (!opts.skipImage) {
    if (fmt === 'carrossel' && opts.deck) {
      const rawSlides = Array.isArray(post.slides) ? (post.slides as { text?: string }[]).filter(x => String(x.text ?? '').trim()).slice(0, 7) : []
      const urls = await Promise.all(rawSlides.map((x, i) => renderGraphicCard(opts, company.id, 'slide', { text: capWords(String(x.text ?? ''), 180), name: company.business_name, page: String(i + 1), total: String(rawSlides.length) }, cardBrand)))
      slides = rawSlides.map((x, i) => ({ text: String(x.text ?? ''), image_prompt: '', image_url: urls[i] }))
      mainImage = slides.find(x => x.image_url)?.image_url ?? null
    } else if (fmt === 'carrossel') {
      const rawSlides = Array.isArray(post.slides) ? (post.slides as { text?: string; image?: string }[]).slice(0, 6) : []
      if (rawSlides.length > 0) {
        // Imagens: carrossel gera 1 imagem por slide (paralelo, até 6), cada
        // uma do conteúdo ESPECÍFICO daquele slide — a coerência entre elas
        // vem da história pedida no execPrompt, não de repetir a mesma cena.
        // Só `s.image` (a descrição visual do slide, escrita pro Copywriter
        // EM INGLÊS especificamente pra isso) ou `idea` — NUNCA `s.text` (é
        // o texto que aparece NO slide, copy de verdade, ver NO_TEXT_RULE).
        const urls = await Promise.all(rawSlides.map(s => slidePic(String(s.image ?? idea ?? ''), conceptHint)))
        slides = rawSlides.map((s, i) => ({ text: String(s.text ?? ''), image_prompt: String(s.image ?? ''), image_url: urls[i] }))
        mainImage = slides.find(s => s.image_url)?.image_url ?? null
      }
    } else if (fmt === 'foto') {
      // O template já foi decidido pelo Diretor ANTES da legenda existir — a
      // imagem/card agora só precisa encaixar nele, nunca o contrário.
      const template = String(brief.template ?? 'livre')
      if (template === 'tweet') {
        // Tweet Print de verdade — card gráfico via render-format, texto nítido, ZERO geração de imagem.
        // "card_text" é escrito CURTO de propósito pelo Copywriter (ver
        // CARD_FIELD_INSTRUCTIONS) — nunca mais corta a legenda/ideia no
        // meio da frase pra caber (era o bug real da imagem quebrada).
        const text = capWords(String(post.card_text ?? caption ?? idea ?? ''), 180)
        mainImage = await renderGraphicCard(opts, company.id, 'tweet', { text, name: company.business_name, handle: slugHandle(company.business_name) }, cardBrand)
        if (!mainImage) mainImage = await pic(evoke(), undefined)
      } else if (template === 'product' && product?.image_url) {
        // Produto real já cadastrado — zero geração de imagem, reusa a foto de verdade.
        const ctaText = capWords(String(post.card_cta ?? ''), 28)
        mainImage = await renderGraphicCard(opts, company.id, 'product', {
          productImage: product.image_url, name: product.title, price: '', cta: ctaText,
        }, cardBrand)
        if (!mainImage) mainImage = await pic(evoke(), undefined)
      } else if (template === 'problem') {
        mainImage = await renderGraphicCard(opts, company.id, 'problem', {
          problem: capWords(String(post.card_problem ?? ''), 140),
          reframe: capWords(String(post.card_reframe ?? ''), 100),
          insight: capWords(String(post.card_insight ?? ''), 100),
        }, cardBrand)
        if (!mainImage) mainImage = await pic(evoke(), conceptHint)
      } else if (template === 'faq') {
        mainImage = await renderGraphicCard(opts, company.id, 'faq', {
          question: capWords(String(post.card_question ?? ''), 90),
          answer: capWords(String(post.card_answer ?? ''), 140),
        }, cardBrand)
        if (!mainImage) mainImage = await pic(evoke(), conceptHint)
      } else if (template === 'trend') {
        const items = String(post.card_items ?? '').split('|').map(s => s.trim()).filter(Boolean).slice(0, 5).join('\n')
        mainImage = await renderGraphicCard(opts, company.id, 'trend', {
          title: capWords(String(post.card_title ?? ''), 60), items,
        }, cardBrand)
        if (!mainImage) mainImage = await pic(evoke(), conceptHint)
      } else if (template === 'market_watch' && realStat) {
        // Número SEMPRE o real (fetchRealStat) — a IA só escreve headline/insight ao redor dele.
        mainImage = await renderGraphicCard(opts, company.id, 'market_watch', {
          headline: capWords(String(post.card_headline ?? ''), 60),
          insight: capWords(String(post.card_insight ?? ''), 100),
          value: realStat.value, source: realStat.label,
        }, cardBrand)
        if (!mainImage) mainImage = await pic(evoke(), conceptHint)
      } else if (template === 'review' && realReview) {
        // Nenhum campo aqui vem da IA — avaliação real (fetchRealReview) direto pro card.
        mainImage = await renderGraphicCard(opts, company.id, 'review', {
          text: realReview.text, author: realReview.author, stars: realReview.stars, source: realReview.source,
        }, cardBrand)
        if (!mainImage) mainImage = await pic(evoke(), conceptHint)
      } else {
        // "livre" — foto realista e específica, escolhida com intenção (não é fallback). Legenda conta a história.
        mainImage = await pic(evoke(), conceptHint)
      }
    } else {
      // reel/story (só existe em Campanhas) — ainda 1 imagem estática (não
      // geramos vídeo de verdade), mesmo caminho do "livre".
      mainImage = await pic(evoke(), conceptHint)
    }
  }
  // Rede de segurança final: nunca deixa o post sem imagem NENHUMA. O
  // template "livre" só tenta a foto de IA (generateImage) — sem fallback
  // próprio — e se essa chamada falhar (rede, moderação, timeout), o post
  // ficava salvo com image_url null pra sempre (bug real visto pelo dono).
  // Cai pro card de texto (mesmo motor do "photo", fundo sólido da marca
  // em vez de foto) sempre que TODAS as tentativas de imagem falharam.
  if (!mainImage && fmt !== 'carrossel') {
    mainImage = await renderGraphicCard(opts, company.id, 'photo', {
      headline: capWords(String(idea ?? caption ?? company.business_name), 90),
      cta: capWords(String(post.cta ?? brief.cta ?? ''), 28),
    }, cardBrand)
  }
  await admin.from('marketing_ai_test_content').update({ image_url: mainImage, slides }).eq('id', inserted.id)

  // Se veio de uma ideia do Creative Agent, marca ela como usada.
  if (opts.ideaId) await admin.from('marketing_ai_ideas').update({ status: 'used' }).eq('id', opts.ideaId).eq('company_id', company.id)

  // Avalia AUTOMATICAMENTE (mesmo passo do botão "Avaliar") — sem isso o
  // post fica sem quality_score e a Área de Testes não sabe mostrar "Enviar
  // pro Vault" nem "Corrigir", trava em "Avaliar" pra sempre. Cobre tanto o
  // clique interativo quanto o lote automático diário (nenhum dos dois
  // chamava isso antes). Nunca derruba a geração se a avaliação falhar.
  let autoVault = false
  try { autoVault = await scoreTestContent(company.id, inserted.id) } catch (e) { console.error('creative-generate: score falhou', e) }

  return { id: inserted.id, image_generated: !!mainImage, slides: slides?.length ?? 0, personality, brief, auto_vault: autoVault }
}

function parseArr(raw: string): unknown[] {
  try { const v = JSON.parse(raw); if (Array.isArray(v)) return v } catch { /* */ }
  const m = raw.match(/\[[\s\S]*\]/)
  if (m) { try { const v = JSON.parse(m[0]); if (Array.isArray(v)) return v } catch { /* */ } }
  return []
}

// As 7 datas da PRÓXIMA semana (segunda a domingo) — o cron só roda domingo
// à noite, então "amanhã" já é sempre a segunda-feira seguinte.
function nextWeekDates(): { iso: string; weekday: string }[] {
  const WD = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado']
  const now = new Date()
  const startOffset = now.getDay() === 0 ? 1 : (8 - now.getDay())
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + startOffset + i)
    return { iso: d.toISOString().slice(0, 10), weekday: WD[d.getDay()] }
  })
}

// Calendário da Semana: PLANEJA a semana inteira (1 ou 2 posts orgânicos por
// dia, sempre — nunca dia vazio, nunca mais que 2) e, pra CADA peça
// planejada, dispara o MESMO fluxo de sempre (generateForCompany → Diretor +
// Copywriter + imagem + controle de qualidade → Vault automático se a nota
// for boa). Não é um motor de conteúdo separado — é só o Calendário
// decidindo QUANDO usar o motor que já existe, um fluxo só conectado.
// REGRA (pedido do dono, 2026-09): só POST orgânico aparece no calendário —
// nada de gerar uma peça separada pra Stories. Em vez disso, o próprio
// Copywriter marca em cada post (story_worthy/story_note, ver
// generateForCompany) se aquele post específico também vale a pena repostar
// nos Stories tal como está — uma anotação, não uma peça duplicada.
// Mix da estratégia (2026-10-09): quando a estratégia ativa escolheu o mix
// semanal de formatos (content_plan.weekly_mix), cada peça recebe um seed com
// o formato/objetivo da vez; sem estratégia, vale o comportamento abaixo.
// A aba Ideias também fica de fora dessa decisão por enquanto — sem
// seed/ideaId, cada peça chama generateForCompany "solta", e o Diretor
// decide o formato sozinho pela rotação automática de sempre (round-robin
// entre os templates reais disponíveis — já filtrados por dado real, ver
// TEMPLATE_DESC: um formato "vermelho" nunca entra em templateKeys, então
// nunca é escolhido aqui) — é assim que a semana varia entre os formatos
// possíveis, não entre ideias de um backlog. Se um dia voltarmos a usar a
// aba Ideias aqui, reviver o idea_id/seed que já existiam antes (ver
// histórico do arquivo).
// Ocupação por pilar/dia que o catalog-package já reservou pra essa semana
// (ex: pacote de conteúdo de um imóvel novo) — lido aqui só como AVISO pro
// planejador orgânico (ele não tem como escrever um pilar específico nas
// próprias peças, então não dá pra travar automaticamente; o prompt recebe
// o aviso e evita empilhar tema em cima do que já está cheio). Mesma lógica
// de agendamento que catalog-package usa pra ESCREVER (duplicada de
// propósito — convenção do projeto, sem lib compartilhada entre functions).
async function fetchWeekPillarOccupancy(admin: SupaClient, companyId: string, dates: string[], pillars: Record<string, number>): Promise<string> {
  if (!Object.keys(pillars).length) return ''
  const { data } = await admin.from('marketing_ai_test_content').select('planned_for, pillar').eq('company_id', companyId).in('planned_for', dates).not('pillar', 'is', null)
  const perPillar: Record<string, number> = {}
  for (const row of (data ?? []) as { pillar: string | null }[]) { if (row.pillar) perPillar[row.pillar] = (perPillar[row.pillar] ?? 0) + 1 }
  const busy = Object.entries(perPillar).filter(([, n]) => n > 0)
  if (!busy.length) return ''
  return `\nJá existe conteúdo de pacote (ex: imóvel específico) agendado essa semana nestes pilares: ${busy.map(([p, n]) => `${p} (${n})`).join(', ')} — evite empilhar mais conteúdo no mesmo tema, dê espaço pros outros pilares.`
}

async function planWeekForCompany(admin: SupaClient, anthropicKey: string, company: Company, auth: { bearer: string; isCron: boolean; cronSecret?: string }): Promise<{ planned: number; days: { date: string; posts: number; note: string }[]; todo: { format: string; name: string; per_week: number; purpose: string }[] }> {
  const dates = nextWeekDates()
  // Memória do conteúdo: antes de criar a semana, atualiza as lições se
  // chegou sinal novo (peça excluída/editada, nota baixa). Sem sinal, sem IA.
  try { await relearn(admin, anthropicKey, company.id, { onlyIfStale: true }) } catch (e) { console.error('relearn (semana) falhou', e) }
  const [{ data: insRows }, { data: pendingRows }, playbookBlock, pillarOccupancyNote, { data: stratRow }] = await Promise.all([
    admin.from('marketing_ai_insights').select('pillar, title, description').eq('company_id', company.id).eq('status', 'open').order('created_at', { ascending: false }).limit(8),
    admin.from('marketing_ai_test_content').select('id').eq('company_id', company.id).eq('status', 'draft').is('quality_score', null),
    fetchPlaybookBlock(admin, company.vertical_key ?? 'generico', company.playbook_answers),
    fetchWeekPillarOccupancy(admin, company.id, dates.map(d => d.iso), await fetchPillarWeights(admin, company.vertical_key ?? 'generico')),
    admin.from('marketing_ai_strategies').select('content_plan').eq('company_id', company.id).eq('kind', 'main').eq('status', 'active').order('updated_at', { ascending: false }).limit(1).maybeSingle(),
  ])
  // Mix da semana escolhido pela estratégia (Hermes): o calendário segue as
  // quantidades e os formatos; o que não dá pra gerar sozinho (vídeo, pacote
  // do item, DM) volta como lista "pra fazer" pro dono.
  const storedPlan = (stratRow?.content_plan ?? null) as ContentPlan | null
  // Mínimo de vídeos da ficha vale também pra estratégia antiga (criada antes
  // da regra) — sem precisar refazer a estratégia.
  const contentPlan = storedPlan && Array.isArray(storedPlan.weekly_mix) && storedPlan.weekly_mix.length
    ? { ...storedPlan, weekly_mix: ensureMinVideos(storedPlan.weekly_mix, await fetchFormatCatalog(admin, company.vertical_key ?? 'generico', company.id), (await fetchContentRules(admin, company.vertical_key ?? 'generico')).minVideosPerWeek) }
    : storedPlan
  const mix = weeklyMixPlan(contentPlan)
  // Estratégia com mix semanal → o calendário é o plano dela, dia a dia
  // (weekSlots), sem a IA decidir cadência. Sem estratégia, vale o
  // planejamento antigo abaixo.
  const slots = weekSlots(contentPlan, dates.map(d => d.iso))
  if (slots.length) return await planWeekFromStrategy(admin, company, slots, contentPlan!)
  const insights = (insRows ?? []) as { pillar: string; title: string; description: string }[]
  const pendingCount = (pendingRows ?? []).length

  const prompt = `Você é o planejador de conteúdo semanal de "${company.business_name}" (${company.business_type ?? 'negócio'} em ${company.city ?? 'Brasil'}).
${company.business_description ? `O que o negócio faz: ${company.business_description}.` : ''}${playbookBlock}${pillarOccupancyNote}

Monte a CADÊNCIA da PRÓXIMA semana inteira: pra CADA um dos 7 dias, decida entre 1 ou 2 posts orgânicos (nunca 0 — todo dia tem pelo menos 1; nunca mais que 2).${mix.auto.length ? ` A estratégia ativa pede ${mix.autoTotal} peça(s) geradas nesta semana — faça a soma dos 7 dias chegar o mais perto possível disso.` : ''} Não escolha o tema/ideia aqui — só a cadência (isso é decidido depois, peça por peça, pelo Diretor Criativo). Considere que ${pendingCount} peça(s) recente(s) ainda nem foram avaliadas — se já tem bastante coisa parada, prefira 1 post nos dias mais fracos em vez de 2.
${insights.length ? `\nInsights abertos (ajudam a priorizar QUAIS dias merecem 2 posts):\n${insights.map(i => `- [${i.pillar}] ${i.title}: ${i.description}`).join('\n')}` : ''}

Dias (use EXATAMENTE estas datas, uma linha por dia, na mesma ordem):
${dates.map(d => `- ${d.iso} (${d.weekday})`).join('\n')}

Retorne APENAS um JSON array, um item por dia, nesta ordem (sempre os 7 dias):
[{"date":"YYYY-MM-DD","posts":1|2,"note":"por que essa cadência pra esse dia, 1 frase"}]`

  const raw = await callClaude(anthropicKey, prompt, 900)
  const parsedPlan = (parseArr(raw) as { date?: string; posts?: number; note?: string }[]).slice(0, 7)

  let planned = 0, slot = 0
  const days: { date: string; posts: number; note: string }[] = []
  for (const p of parsedPlan) {
    const postsCount = p.posts === 2 ? 2 : 1
    const date = p.date && /^\d{4}-\d{2}-\d{2}$/.test(p.date) ? p.date : dates[0].iso
    let ok = 0
    for (let i = 0; i < postsCount; i++) {
      // Com mix da estratégia: cada peça leva o formato/objetivo da vez (fila
      // intercalada). Sem estratégia: sem seed de propósito — ver comentário acima.
      const pick = mix.auto.length ? mix.auto[slot++ % mix.auto.length] : null
      const seed = pick ? { title: pick.name, angle: `Pilar ${pick.pillar}: ${pick.purpose || 'serve a estratégia ativa'}`, format: 'foto' } : null
      try {
        await generateForCompany(admin, anthropicKey, company, 'organico', { ...auth, plannedFor: date, seed })
        planned++; ok++
      } catch (e) { console.error('planWeekForCompany: falhou pra', company.id, date, e) }
    }
    days.push({ date, posts: ok, note: String(p.note ?? '') })
  }
  return { planned, days, todo: mix.todo }
}

// Calendário vindo da estratégia (2026-10-14). Cada vaga do plano vira peça
// pelo MESMO motor de sempre:
// - post → generateForCompany (Diretor + Copywriter + imagem + nota);
// - item_package com receita na ficha → catalog-package do item do catálogo
//   menos usado nas últimas 3 semanas (só item com ≥5 fotos reais), no dia
//   da vaga;
// - vídeo (item_video, decisão do dono 2026-10-14: mínimo de 3/semana) →
//   1 foto real do item menos usado vira vídeo de 5 s na Higgsfield
//   (item-videos, caminho do cron; confere o teto de US$ 40). A peça nasce na
//   hora com legenda e a foto de capa; o vídeo entra nela quando fica pronto
//   (action video_tick, a cada 5 min).
// - o que não tem item/receita → volta como "pra fazer".
// Nada é publicado: tudo cai como rascunho → nota → Vault, e o dono aprova.
//
// Teto de 150s (docs/PITFALLS.md): aqui só DESPACHA — cada vaga é uma
// chamada nova (`plan_slot`) com relógio próprio, que responde na hora e
// trabalha em EdgeRuntime.waitUntil. Esperamos só o aceite (2xx).
// Sem duplicar (QA 2026-10-14): vaga que já tem peça no mesmo dia (mesma
// receita, ou post solto pra vaga de post) é pulada — clicar 2x ou o cron
// depois do botão não gera de novo nem gasta IA de novo.
const VIDEO_RECIPE = 'video_imovel'
const DECK_FORMAT = 'carrossel_slides' // genérico (formatCatalog.ts)
interface SlotJob { date: string; producer: 'post' | 'item_package' | 'item_video'; name: string; pillar: string; purpose: string; recipe?: string; item_id?: string; format?: string }

async function planWeekFromStrategy(admin: SupaClient, company: Company, slots: ReturnType<typeof weekSlots>, plan: ContentPlan): Promise<{ planned: number; days: { date: string; posts: number; note: string }[]; todo: { format: string; name: string; per_week: number; purpose: string }[] }> {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const cronSecret = Deno.env.get('CRON_SECRET') ?? ''
  const since = new Date(Date.now() - 21 * 86400000).toISOString()
  const dates = [...new Set(slots.map(s => s.date))]
  const [formats, { data: itemRows }, { data: usedRows }, { data: existingRows }] = await Promise.all([
    fetchFormatCatalog(admin, company.vertical_key ?? 'generico', company.id),
    admin.from('marketing_ai_knowledge').select('id, meta').eq('company_id', company.id).eq('kind', 'product'),
    admin.from('marketing_ai_test_content').select('item_id').eq('company_id', company.id).not('item_id', 'is', null).gte('created_at', since),
    admin.from('marketing_ai_test_content').select('planned_for, item_id, recipe').eq('company_id', company.id).in('planned_for', dates),
  ])
  const recipeOf = new Map(formats.map(f => [f.key, f.recipe]))
  const usage = new Map<string, number>()
  for (const r of (usedRows ?? []) as { item_id: string }[]) usage.set(r.item_id, (usage.get(r.item_id) ?? 0) + 1)
  const items = ((itemRows ?? []) as { id: string; meta: { photos?: unknown[] } | null }[])
    .filter(it => (it.meta?.photos?.length ?? 0) >= 5).map(it => it.id)
  const pickItem = (): string | null => {
    if (!items.length) return null
    const id = [...items].sort((a, b) => (usage.get(a) ?? 0) - (usage.get(b) ?? 0))[0]
    usage.set(id, (usage.get(id) ?? 0) + 1)
    return id
  }
  const existing = ((existingRows ?? []) as { planned_for: string; item_id: string | null; recipe: string | null }[]).map(r => ({ ...r }))
  const alreadyFilled = (date: string, recipe: string | undefined, producer: string): boolean => {
    const i = existing.findIndex(r => r.planned_for === date && ((recipe && r.recipe === recipe) || (producer === 'post' && !r.item_id)))
    if (i >= 0) { existing.splice(i, 1); return true }
    return false
  }

  const todo = new Map<string, { format: string; name: string; per_week: number; purpose: string }>()
  const addTodo = (s: { format: string; name: string; purpose: string }) => {
    const cur = todo.get(s.format)
    todo.set(s.format, { format: s.format, name: s.name, per_week: (cur?.per_week ?? 0) + 1, purpose: s.purpose })
  }
  for (const m of plan.weekly_mix ?? []) if (m.producer === 'dm') todo.set(m.format, { format: m.format, name: m.name, per_week: m.per_week, purpose: m.purpose })

  const jobs: SlotJob[] = []
  for (const slot of slots) {
    const recipe = slot.producer === 'item_package' ? recipeOf.get(slot.format) : slot.producer === 'item_video' ? VIDEO_RECIPE : undefined
    if (alreadyFilled(slot.date, recipe, slot.producer)) continue
    if (slot.producer === 'post') {
      // Formato que a ficha desligou (ex.: card "tipo tweet" em imóveis) e
      // ainda está numa estratégia antiga → sai como carrossel de slides.
      const format = formats.some(f => f.key === slot.format) ? slot.format : DECK_FORMAT
      jobs.push({ date: slot.date, producer: 'post', name: slot.name, pillar: slot.pillar, purpose: slot.purpose, format }); continue
    }
    if (slot.producer === 'item_video') {
      const itemId = pickItem()
      if (!itemId) { addTodo(slot); continue }
      jobs.push({ date: slot.date, producer: 'item_video', name: slot.name, pillar: slot.pillar, purpose: slot.purpose, recipe: VIDEO_RECIPE, item_id: itemId })
      continue
    }
    const itemId = recipe ? pickItem() : null
    if (!recipe || !itemId) { addTodo(slot); continue }
    jobs.push({ date: slot.date, producer: 'item_package', name: slot.name, pillar: slot.pillar, purpose: slot.purpose, recipe, item_id: itemId })
  }

  // Despacho: cada vaga é uma chamada própria; esperamos só o aceite.
  const perDay = new Map<string, number>()
  let planned = 0
  if (cronSecret) {
    const accepted = await Promise.all(jobs.map(async job => {
      try {
        const res = await fetch(`${supabaseUrl}/functions/v1/creative-generate`, {
          method: 'POST', headers: { Authorization: `Bearer ${serviceKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'plan_slot', cron_secret: cronSecret, company_id: company.id, slot: job }),
          signal: AbortSignal.timeout(20_000),
        })
        await res.body?.cancel()
        if (!res.ok) console.error('planWeekFromStrategy: vaga recusada', company.id, job.date, res.status)
        return res.ok
      } catch (e) { console.error('planWeekFromStrategy: despacho falhou', company.id, job.date, e); return false }
    }))
    accepted.forEach((ok, i) => { if (ok) { planned++; perDay.set(jobs[i].date, (perDay.get(jobs[i].date) ?? 0) + 1) } })
  } else console.error('planWeekFromStrategy: CRON_SECRET ausente — nada despachado')
  const days = dates.map(date => ({ date, posts: perDay.get(date) ?? 0, note: 'plano da estratégia' }))
  return { planned, days, todo: [...todo.values()] }
}

// Botão "Gerar agora" (Peças avulsas): o dono escolhe o tipo de criativo e
// sai UMA peça fora do calendário (sem dia — date vazio), pelo mesmo motor
// das vagas. Só tipos que funcionam hoje (status live) e não-DM. Item: o
// escolhido pelo dono ou o menos usado com 5+ fotos reais.
async function makeNowJob(admin: SupaClient, company: Company, formatKey: string, itemId: string | null): Promise<SlotJob | string> {
  const formats = await fetchFormatCatalog(admin, company.vertical_key ?? 'generico', company.id)
  const f = formats.find(x => x.key === formatKey && x.status === 'live' && x.producer !== 'dm')
  if (!f) return 'Esse tipo de criativo não está disponível agora.'
  const job: SlotJob = { date: '', producer: f.producer as SlotJob['producer'], name: f.name, pillar: f.pillar, purpose: 'Peça avulsa pedida pelo dono', format: f.key }
  if (f.producer === 'post') return job
  const recipe = f.producer === 'item_video' ? VIDEO_RECIPE : f.recipe
  if (!recipe) return 'Esse tipo de criativo ainda não tem receita pronta.'
  const { data: rows } = await admin.from('marketing_ai_knowledge').select('id, meta').eq('company_id', company.id).eq('kind', 'product')
  const ok = ((rows ?? []) as { id: string; meta: { photos?: unknown[] } | null }[]).filter(r => (r.meta?.photos?.length ?? 0) >= 5).map(r => r.id)
  if (!ok.length) return 'Precisa de um imóvel com pelo menos 5 fotos reais no catálogo.'
  let pick = itemId && ok.includes(itemId) ? itemId : null
  if (itemId && !pick) return 'Esse imóvel não foi encontrado ou tem menos de 5 fotos.'
  if (!pick) {
    const since = new Date(Date.now() - 21 * 86400000).toISOString()
    const { data: used } = await admin.from('marketing_ai_test_content').select('item_id').eq('company_id', company.id).in('item_id', ok).gte('created_at', since)
    const n = new Map<string, number>()
    for (const r of (used ?? []) as { item_id: string }[]) n.set(r.item_id, (n.get(r.item_id) ?? 0) + 1)
    pick = [...ok].sort((a, b) => (n.get(a) ?? 0) - (n.get(b) ?? 0))[0]
  }
  return { ...job, recipe, item_id: pick }
}

// Uma vaga do calendário (chamada interna, relógio próprio de 150s).
// date vazio = peça avulsa (botão "Gerar agora"), sem dia no calendário.
async function runPlanSlot(admin: SupaClient, anthropicKey: string, company: Company, job: SlotJob, cronSecret: string): Promise<void> {
  try {
    if (job.producer === 'post') {
      // Vaga de dica: usa uma dica JÁ conferida (aba Dicas e FAQ). Sem dica
      // liberada, sai um carrossel de slides com o mesmo propósito.
      if (job.format === FAQ_FORMAT && await runFaqSlot(admin, anthropicKey, company, job)) return
      const seed = { title: job.name, angle: `Pilar ${job.pillar}: ${job.purpose || 'serve a estratégia ativa'}${job.format === FAQ_FORMAT ? ' — dica GERAL: sem número, prazo, taxa, valor nem nome de lei (nada foi conferido em fonte oficial).' : ''}`, format: 'foto' }
      // Só o card genérico (post_card, em setor que não desligou) usa o
      // caminho de imagem+template; qualquer outro formato de post — inclusive
      // um antigo que ficou numa estratégia — sai como carrossel de slides.
      await generateForCompany(admin, anthropicKey, company, 'organico', { bearer: '', isCron: true, cronSecret, plannedFor: job.date || null, seed, deck: job.format !== 'post_card' })
      return
    }
    if (job.producer === 'item_video') { await runVideoSlot(admin, anthropicKey, company, job, cronSecret); return }
    const res = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/catalog-package`, {
      method: 'POST', headers: { Authorization: `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ item_id: job.item_id, only_recipe: job.recipe, planned_for: job.date || undefined, loose: !job.date, cron_secret: cronSecret, company_id: company.id }),
    })
    const r = await res.json().catch(() => ({})) as { error?: string; generated?: unknown[] }
    if (!res.ok || !r.generated?.length) console.error('runPlanSlot: catalog-package sem peça', company.id, job.date, job.recipe, res.status, r.error)
  } catch (e) { console.error('runPlanSlot falhou', company.id, job.date, e) }
}

// Vaga "Dica/FAQ conferida": pega a dica liberada menos usada (geral,
// aprovada pelo dono, ou conferida em fonte oficial dentro do prazo —
// vencida é reconferida antes), faz o card de pergunta e resposta
// (render-format "faq") e a legenda só com o que a dica diz. O card nunca
// pode trazer número que a dica não tem. Devolve false se não tiver dica.
const FAQ_FORMAT = 'dica_faq'
async function runFaqSlot(admin: SupaClient, anthropicKey: string, company: Company, job: SlotJob): Promise<boolean> {
  const cfg = await fetchFaqConfig(admin, company.vertical_key ?? null)
  if (!cfg) return false
  const { data } = await admin.from('marketing_ai_knowledge').select('id, title, content, meta').eq('company_id', company.id).eq('module', 'dados').eq('kind', 'faq')
  const rows = (data ?? []) as FaqRow[]
  const ctx = { anthropicKey, tavilyKey: await getTavilyKey(admin), cfg, city: company.city ?? '', companyId: company.id }
  // Vencidas: reconfere (no máximo 2 por vaga) antes de escolher.
  for (const r of rows.filter(r => isDue(r.meta)).slice(0, 2)) Object.assign(r, await checkAndSave(admin, r, ctx))
  const tip = rows.filter(r => isPublishable(r.meta)).sort((a, b) => (a.meta?.used_count ?? 0) - (b.meta?.used_count ?? 0))[0]
  if (!tip) return false
  const chk = tip.meta!.check!
  const label = cfg.categories.find(c => c.key === tip.meta?.category)?.label ?? 'Dica'
  let out: { card_question?: string; card_answer?: string; caption?: string; hashtags?: string; cta?: string } = {}
  try {
    out = parseObj(await callClaude(anthropicKey, `Transforme esta dica de imóveis num post de Instagram de "${company.business_name}".
Pergunta: ${tip.title}
Resposta (já conferida — é a ÚNICA fonte de fatos): ${tip.content}
${chk.source_url ? `Fonte oficial: ${chk.source_title ?? ''} (${new URL(chk.source_url).hostname})` : ''}

- "card_question": a pergunta, curta (até 90 caracteres).
- "card_answer": a resposta resumida pro card (até 130 caracteres). Copie números exatamente como estão; não acrescente nenhum número.
- "caption": legenda que explica a resposta com calma, sem acrescentar fato, número ou lei que não esteja na resposta.${chk.source_url ? ' Termine com "Fonte: <nome do site oficial>".' : ''}
${HONESTY_RULE} Sem emoji no card.${lessonsBlock(await loadLessons(admin, company.id))}
Responda SÓ em JSON: {"card_question":"...","card_answer":"...","caption":"...","hashtags":"#a #b","cta":"..."}`, 900)) as typeof out
  } catch (e) { console.error('runFaqSlot: texto falhou', company.id, e); return false }
  const allowed = new Set(numbersIn(`${tip.title} ${tip.content}`))
  const cardQ = String(out.card_question ?? tip.title).slice(0, 120)
  let cardA = String(out.card_answer ?? '').slice(0, 160)
  // Rede de segurança: número no card que a dica não tem → usa a resposta conferida.
  if (!cardA || numbersIn(`${cardQ} ${cardA}`).some(n => !allowed.has(n))) cardA = tip.content.slice(0, 160)
  const caption = String(out.caption ?? '').trim()
  if (!caption || numbersIn(caption).some(n => !allowed.has(n))) { console.error('runFaqSlot: legenda com número fora da dica', company.id, tip.id); return false }

  const { data: bd } = await admin.from('brand_dna').select('colors, kit').eq('company_id', company.id).maybeSingle()
  const kit = (bd as { colors: string[] | null; kit: { colors?: { primary?: string[]; text?: string; bg?: string } } | null } | null)
  const brand: CardBrand = { primary: kit?.kit?.colors?.primary?.[0] || kit?.colors?.[0] || '#FF6D29', name: company.business_name, text: kit?.kit?.colors?.text, bg: kit?.kit?.colors?.bg }
  const url = await renderGraphicCard({ bearer: '', isCron: true, cronSecret: Deno.env.get('CRON_SECRET') ?? '' }, company.id, 'faq', { eyebrow: label, question: cardQ, answer: cardA }, brand)
  if (!url) { console.error('runFaqSlot: card falhou', company.id); return false }
  const badge = chk.status === 'geral' ? 'Dica geral (sem número nem regra).' : chk.status === 'aprovada_dono' ? 'Dica aprovada por você.' : `Conferida pela IA em ${new Date(chk.checked_at).toLocaleDateString('pt-BR')} — fonte: ${chk.source_url}`
  const { data: piece, error } = await admin.from('marketing_ai_test_content').insert({
    company_id: company.id, kind: 'organico', format: 'foto', idea: tip.title.slice(0, 200),
    caption, hashtags: out.hashtags ? String(out.hashtags) : null, cta: out.cta ? String(out.cta) : null,
    image_url: url, media: [{ url, type: 'photo' }], pillar: job.pillar, recipe: FAQ_FORMAT, provider: 'faq_conferida',
    planned_for: job.date || null, reasoning: badge,
  }).select('id').single()
  if (error || !piece) { console.error('runFaqSlot: peça não gravada', company.id, error?.message); return false }
  await admin.from('marketing_ai_knowledge').update({ meta: { ...tip.meta, used_count: (tip.meta?.used_count ?? 0) + 1 } }).eq('id', tip.id)
  try { await scoreTestContent(company.id, piece.id) } catch (e) { console.error('runFaqSlot: nota falhou', e) }
  return true
}

// CTA alternativo (sem resposta do QUERO aprovada) vem da ficha: config.ctas.sem_automacao.
async function fetchFichaCtas(admin: SupaClient, verticalKey: string | null): Promise<{ sem_automacao?: unknown } | null> {
  try {
    const { data } = await admin.from('vertical_playbooks').select('config').eq('key', verticalKey ?? 'generico').eq('enabled', true).maybeSingle()
    const c = (data?.config ?? {}) as { ctas?: { sem_automacao?: unknown } }
    return c.ctas && typeof c.ctas === 'object' ? c.ctas : null
  } catch { return null }
}

// Vaga de vídeo: legenda (texto da IA, sem inventar) + peça no calendário com
// a foto de capa; o item-videos manda a foto pra Higgsfield (confere o teto) e
// liga o vídeo à peça (plan.piece_id). Se não der pra fazer o vídeo, a peça
// diz o motivo — nada é cobrado.
async function runVideoSlot(admin: SupaClient, anthropicKey: string, company: Company, job: SlotJob, cronSecret: string): Promise<void> {
  const { data: item } = await admin.from('marketing_ai_knowledge').select('id, title, meta').eq('id', job.item_id).eq('company_id', company.id).eq('kind', 'product').maybeSingle()
  const photos = ((item?.meta?.photos ?? []) as { url: string }[]).map(p => p.url).filter(Boolean)
  if (!item || !photos.length) { console.error('runVideoSlot: item sem fotos', company.id, job.item_id); return }
  // Foto ainda não usada em vídeo deste item, se houver (senão qualquer uma).
  const { data: used } = await admin.from('video_tours').select('photos').eq('company_id', company.id).eq('item_id', item.id).eq('kind', 'plan')
  const usedSet = new Set(((used ?? []) as { photos: string[] | null }[]).flatMap(v => v.photos ?? []))
  const fresh = photos.filter(u => !usedSet.has(u))
  const pool = fresh.length ? fresh : photos
  const photo = pool[Math.floor(Math.random() * pool.length)]
  const f = (item.meta?.fields ?? {}) as Record<string, unknown>
  const hidden = await privateFieldKeys(admin, company.vertical_key ?? null)
  const facts = Object.entries(f).filter(([k, v]) => !hidden.has(k) && v !== null && v !== undefined && String(v).trim() !== '').map(([k, v]) => `${k}: ${String(v).slice(0, 600)}`).join('\n')
  // "Comente QUERO" só com a resposta do QUERO deste imóvel aprovada (decisão em código, não da IA).
  const { data: auto } = await admin.from('engagement_automations').select('active, message, keywords').eq('company_id', company.id).eq('item_id', item.id).maybeSingle()
  const decision = decideVideoCta(auto as { active?: boolean; message?: string; keywords?: string[] } | null, await fetchFichaCtas(admin, company.vertical_key))
  let cap: Record<string, unknown> = {}
  try {
    cap = parseObj(await callClaude(anthropicKey, `Você escreve a legenda de um Reels curto (5 s) de "${company.business_name}" mostrando 1 ambiente deste imóvel real, em movimento de câmera suave.
Dados reais do imóvel (use só isto):
${facts || '(sem dados além do título)'}
Título: ${item.title}
Objetivo da peça na estratégia: ${job.purpose || job.name}
${HONESTY_RULE} A legenda é pro público do Instagram — nunca um recado pro corretor.
${decision.promptRule}${lessonsBlock(await loadLessons(admin, company.id))}
Responda SÓ em JSON: {"caption":"...","hashtags":"#a #b","cta":"..."}`, 700))
  } catch (e) { console.error('runVideoSlot: legenda falhou', company.id, e) }
  const safe = sanitizeCaptionCta(cap.caption ? String(cap.caption) : null, cap.cta ? String(cap.cta) : null, decision)
  if (safe.changed) console.log('runVideoSlot: CTA ajustado pela trava', company.id, decision.approved ? 'com QUERO' : 'sem QUERO')
  // Sem a resposta aprovada, o dono é avisado na peça (e o item-videos preserva o aviso).
  const notice = decision.approved ? '' : queroNotice(decision.cta)
  const withNotice = (msg: string) => notice ? `${msg} ${notice}` : msg
  const { data: piece, error } = await admin.from('marketing_ai_test_content').insert({
    company_id: company.id, kind: 'organico', format: 'reel', idea: `${item.title} — vídeo`,
    caption: safe.caption, hashtags: cap.hashtags ? String(cap.hashtags) : null, cta: safe.cta,
    image_url: photo, media: [{ url: photo, type: 'photo' }], item_id: item.id, pillar: job.pillar, recipe: VIDEO_RECIPE, provider: 'higgsfield',
    planned_for: job.date || null, reasoning: withNotice('Vídeo sendo feito na Higgsfield a partir de uma foto real — aparece aqui em alguns minutos.'),
  }).select('id').single()
  if (error || !piece) { console.error('runVideoSlot: peça não gravada', company.id, error?.message); return }
  try {
    const res = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/item-videos`, {
      method: 'POST', headers: { Authorization: `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'create', cron_secret: cronSecret, company_id: company.id, item_id: item.id, kind: 'room', photos: [photo], label: 'Calendário', piece_id: piece.id }),
    })
    const r = await res.json().catch(() => ({})) as { error?: string }
    if (!res.ok) await admin.from('marketing_ai_test_content').update({ reasoning: withNotice(`O vídeo não foi feito: ${r.error ?? `erro ${res.status}`}. Nada foi cobrado.`) }).eq('id', piece.id)
  } catch (e) {
    await admin.from('marketing_ai_test_content').update({ reasoning: withNotice('O vídeo não foi feito (falha de conexão). Nada foi cobrado.') }).eq('id', piece.id)
    console.error('runVideoSlot: item-videos falhou', company.id, e)
  }
  try { await scoreTestContent(company.id, piece.id) } catch (e) { console.error('runVideoSlot: nota falhou', e) }
}

const COMPANY_SELECT = 'id, business_name, business_type, city, goal, business_description, ideal_customer, language, telegram_chat_id, vertical_key, playbook_answers'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? anonKey
    const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY')
    if (!anthropicKey) return json({ error: 'ANTHROPIC_API_KEY não configurada.' }, 503)

    const admin = createClient(supabaseUrl, serviceKey)
    const body = await req.json().catch(() => ({})) as Record<string, unknown>
    const cronSecretEnv = Deno.env.get('CRON_SECRET')

    // ── Vídeos do calendário (cron a cada 5 min): o item-videos tem
    // verify_jwt, então o cron passa por aqui e encaminha com a chave de serviço.
    if (cronSecretEnv && body.cron_secret === cronSecretEnv && body.action === 'video_tick') {
      const res = await fetch(`${supabaseUrl}/functions/v1/item-videos`, {
        method: 'POST', headers: { Authorization: `Bearer ${serviceKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'tick', cron_secret: cronSecretEnv }),
      })
      return json(await res.json().catch(() => ({ error: `item-videos ${res.status}` })), res.ok ? 200 : 502)
    }

    // ── Uma vaga do calendário (despachada por planWeekFromStrategy) ──
    if (cronSecretEnv && body.cron_secret === cronSecretEnv && body.action === 'plan_slot' && typeof body.company_id === 'string') {
      const job = body.slot as SlotJob | undefined
      if (!job || !/^\d{4}-\d{2}-\d{2}$/.test(String(job.date)) || !['post', 'item_package', 'item_video'].includes(String(job.producer))) return json({ error: 'vaga inválida' }, 400)
      const { data: companyRow } = await admin.from('companies').select(COMPANY_SELECT).eq('id', body.company_id).maybeSingle()
      const company = companyRow as Company | null
      if (!company) return json({ error: 'empresa não encontrada' }, 404)
      if (!(await hasPaidAccess(admin, company.id))) return json({ error: 'sem plano' }, 402)
      // @ts-ignore — EdgeRuntime é o global do Supabase Edge Functions pra background tasks
      EdgeRuntime.waitUntil(runPlanSlot(admin, anthropicKey, company, job, cronSecretEnv))
      return json({ ok: true, accepted: true }, 202)
    }

    // ── Calendário da Semana (cron, domingo 18h BRT): planeja + gera a
    // semana inteira pra toda empresa com auto_weekly_calendar ligado.
    if (cronSecretEnv && body.cron_secret === cronSecretEnv && body.action === 'run_weekly_plan' && !body.company_id) {
      // Quem planeja no domingo: quem ligou o interruptor (true) + quem tem
      // estratégia ativa com mix semanal e nunca desligou (null/sem linha —
      // "o calendário já vem da estratégia", 2026-10-14). false = desligado.
      const [{ data: onRows }, { data: offRows }, { data: stratRows }] = await Promise.all([
        admin.from('marketing_ai_config').select('company_id').eq('auto_weekly_calendar', true),
        admin.from('marketing_ai_config').select('company_id').eq('auto_weekly_calendar', false),
        admin.from('marketing_ai_strategies').select('company_id, content_plan').eq('kind', 'main').eq('status', 'active').not('content_plan', 'is', null),
      ])
      const off = new Set(((offRows ?? []) as { company_id: string }[]).map(r => r.company_id))
      const ids = new Set(((onRows ?? []) as { company_id: string }[]).map(r => r.company_id))
      // Liga sozinho só pra quem PAGOU (assinatura) ou teve acesso liberado à
      // mão — conta antiga sem assinatura não entra sem o dono ligar o
      // interruptor (regra do dono, 2026-10-14: "liga quando pagar").
      const candidates = ((stratRows ?? []) as { company_id: string; content_plan: ContentPlan | null }[])
        .filter(r => !off.has(r.company_id) && (r.content_plan?.weekly_mix?.length ?? 0) > 0).map(r => r.company_id)
      if (candidates.length) {
        const { data: paidRows } = await admin.from('companies').select('id').in('id', candidates).or('stripe_subscription_id.not.is.null,manual_access.eq.true')
        for (const r of (paidRows ?? []) as { id: string }[]) ids.add(r.id)
      }
      const configs = [...ids].map(company_id => ({ company_id }))
      let companies = 0, planned = 0, failed = 0
      for (const cfg of configs) {
        try {
          const { data: companyRow } = await admin.from('companies').select(COMPANY_SELECT).eq('id', cfg.company_id).maybeSingle()
          const company = companyRow as Company | null
          if (!company) continue
          if (!(await hasPaidAccess(admin, company.id))) continue // conta vitrine: cron não gasta IA
          const r = await planWeekForCompany(admin, anthropicKey, company, { bearer: '', isCron: true, cronSecret: cronSecretEnv })
          companies++; planned += r.planned
          if (r.planned > 0) {
            notifyMarketing(company.telegram_chat_id, company.id, 'AGENT_ACTION', {
              action: 'posts_created', count: r.planned, reason: 'Calendário da semana planejado',
            })
          }
        } catch (e) { failed++; console.error('creative-generate weekly plan falhou pra', cfg.company_id, e) }
      }
      return json({ ok: true, companies, planned, failed })
    }

    // ── Modo lote (cron, 10h BRT): 1 post pra toda empresa que ligou o botão
    // "gerar automaticamente" na Área de Testes. Uma empresa falhando não
    // derruba as outras — cada uma tem seu próprio try/catch.
    if (cronSecretEnv && body.cron_secret === cronSecretEnv && !body.company_id) {
      const { data: configs } = await admin.from('marketing_ai_config').select('company_id, auto_daily_test_image').eq('auto_daily_test', true)
      let generated = 0, failed = 0
      for (const cfg of (configs ?? []) as { company_id: string; auto_daily_test_image: boolean | null }[]) {
        try {
          const { data: companyRow } = await admin.from('companies').select(COMPANY_SELECT).eq('id', cfg.company_id).maybeSingle()
          const company = companyRow as Company | null
          if (!company) continue
          if (!(await hasPaidAccess(admin, company.id))) continue // conta vitrine: cron não gasta IA
          await generateForCompany(admin, anthropicKey, company, 'organico', { bearer: '', isCron: true, cronSecret: cronSecretEnv, skipImage: cfg.auto_daily_test_image === false })
          generated++
          notifyMarketing(company.telegram_chat_id, company.id, 'AGENT_ACTION', {
            action: 'posts_created', count: 1, reason: 'Post de teste diário gerado',
          })
        } catch (e) { failed++; console.error('creative-generate cron falhou pra', cfg.company_id, e) }
      }
      return json({ ok: true, generated, failed })
    }

    const bearer = req.headers.get('Authorization') ?? ''
    if (!bearer) return json({ error: 'Unauthorized' }, 401)
    const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: bearer } } })
    const { data: { user } } = await userClient.auth.getUser()
    if (!user) return json({ error: 'Unauthorized' }, 401)

    const { data: companyRow } = await admin.from('companies').select(COMPANY_SELECT).eq('user_id', user.id).maybeSingle()
    const company = companyRow as Company | null
    if (!company) return json({ error: 'Empresa não encontrada.' }, 404)
    const noPlan = await requirePaidAccess(admin, company.id)
    if (noPlan) return noPlan

    // Botão manual "Planejar semana agora" (Calendário da Semana) — mesma
    // lógica do cron de domingo, só que na hora, pro dono testar/adiantar.
    // Memória do Agente de Conteúdo: a tela chama depois que o dono exclui
    // uma peça com motivo ou edita a legenda. Devolve as lições atuais.
    if (body.action === 'relearn') {
      const r = await relearn(admin, anthropicKey, company.id)
      return json({ ok: true, ...r })
    }

    // Opções do "Gerar agora": só tipos que funcionam hoje (mesmo filtro do make_now).
    if (body.action === 'make_now_options') {
      const [formats, { data: rows }] = await Promise.all([
        fetchFormatCatalog(admin, company.vertical_key ?? 'generico', company.id),
        admin.from('marketing_ai_knowledge').select('id, title, meta').eq('company_id', company.id).eq('kind', 'product').order('created_at', { ascending: false }),
      ])
      const items = ((rows ?? []) as { id: string; title: string | null; meta: { photos?: unknown[] } | null }[])
        .filter(r => (r.meta?.photos?.length ?? 0) >= 5).map(r => ({ id: r.id, title: r.title ?? 'Imóvel' }))
      const canMake = (f: typeof formats[number]) => f.status === 'live' && f.producer !== 'dm' && (f.producer === 'post' || f.producer === 'item_video' || !!f.recipe)
      const view = (f: typeof formats[number]) => ({ key: f.key, name: f.name, producer: f.producer, status: f.status, can_make: canMake(f), media: f.media ?? null, surface: f.surface ?? (f.producer === 'item_video' ? 'reels' : f.producer === 'dm' ? 'dm' : 'feed') })
      // formats = o que dá pra gerar agora; all = a lista inteira da ficha
      // (aba Formatos do Padrão visual mostra tudo, com o status de cada um).
      return json({ ok: true, formats: formats.filter(canMake).map(view), all: formats.map(view), items })
    }

    if (body.action === 'make_now') {
      const job = await makeNowJob(admin, company, String(body.format ?? ''), typeof body.item_id === 'string' ? body.item_id : null)
      if (typeof job === 'string') return json({ error: job }, 400)
      // @ts-ignore — EdgeRuntime é o global do Supabase Edge Functions pra background tasks
      EdgeRuntime.waitUntil(runPlanSlot(admin, anthropicKey, company, job, Deno.env.get('CRON_SECRET') ?? ''))
      return json({ ok: true, accepted: true, format: job.format, item_id: job.item_id ?? null }, 202)
    }

    if (body.action === 'plan_week') {
      const result = await planWeekForCompany(admin, anthropicKey, company, { bearer, isCron: false })
      return json({ ok: true, ...result })
    }

    const kind = ['organico', 'stories', 'campanhas'].includes(String(body.kind)) ? String(body.kind) : 'organico'
    const seed = body.idea && typeof body.idea === 'object' ? body.idea as { title?: string; hook?: string; angle?: string; format?: string } : null
    // Botão "Gerar post de teste": o dono pode escolher um template específico
    // ou "random", sem isso (undefined), cai na rotação automática.
    const templateChoice = body.template ? String(body.template) : null

    const result = await generateForCompany(admin, anthropicKey, company, kind, {
      bearer, isCron: false, seed, ideaId: body.idea_id ? String(body.idea_id) : null, templateChoice, deck: body.deck === true,
    })
    return json({ ok: true, ...result })
  } catch (err) {
    console.error('creative-generate error:', err)
    return json({ error: err instanceof Error ? err.message : String(err) }, 500)
  }
})

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { ...cors, 'Content-Type': 'application/json' } })
}
