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

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}
type SupaClient = ReturnType<typeof createClient>

interface Company { id: string; business_name: string; business_type: string | null; city: string | null; goal: string | null; business_description: string | null; ideal_customer: string | null; language: string | null }
interface Config { agent_name: string; brand_voice: string | null; tone: string | null; target_audience: string | null; content_pillars: string[]; marketing_goals: string | null; business_objectives: string | null }
interface Know { kind: string; title: string; content: string; module?: string }

// O que o negócio REALMENTE faz vem do onboarding (business_description),
// sempre real e específico — nunca depende do Marketing AI ter sido
// configurado (marketing_ai_config fica vazio até o dono/equipe preencher).
// Sem isso, o agente cai no nome+tipo genérico e inventa um posicionamento
// que não bate com o negócio de verdade.
function preamble(config: Config, company: Company): string {
  const name = config.agent_name?.trim() || 'Agente de Marketing'
  return `Você é ${name}, o agente de marketing de "${company.business_name}" (${company.business_type ?? 'negócio'} em ${company.city ?? 'Brasil'}).
${company.business_description ? `O que o negócio faz de verdade: ${company.business_description}.` : ''}
Voz da marca: ${config.brand_voice ?? 'não definida'}. Tom: ${config.tone ?? 'não definido'}.
Público-alvo: ${config.target_audience ?? company.ideal_customer ?? 'não definido'}.
Pilares: ${config.content_pillars.join(', ') || 'não definidos'}.
Objetivos: ${config.marketing_goals ?? config.business_objectives ?? 'crescer e engajar'}.
${company.language === 'en' ? 'IMPORTANTE: escreva TODO o conteúdo (legenda, hook, CTA, hashtags) em inglês — este negócio atende clientes que falam inglês.' : ''}`
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
const TEMPLATE_DESC = (hasProduct: boolean): Record<string, string> => ({
  livre: 'Foto realista e ESPECÍFICA do negócio, sem texto embutido na imagem — a legenda faz o trabalho de texto. Use quando o valor do post está na FOTO em si: um momento real, um clima, um resultado visual que fala por si só (não é o "padrão" — é a escolha certa quando nenhum card de texto serviria melhor que uma foto de verdade).',
  tweet: 'Card estilo "tweet"/nota com uma frase de efeito em texto nítido, sem foto. Bom pra opinião, gancho ou dado curioso forte.',
  ...(hasProduct ? { product: 'Produto centralizado tipo pôster (usa uma foto de produto real já cadastrada), com nome/chamada. Só quando o post é sobre esse produto específico.' } : {}),
})

// Os cards gráficos (tweet/product) têm espaço FIXO e pequeno —
// diferente da legenda do Instagram, que é livre e longa. Cortar a legenda
// pra caber no card (substring bruto) sempre saía cortado no meio da frase,
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
}
const CARD_FIELD_JSON: Record<string, string> = {
  tweet: ',"card_text":""',
  product: ',"card_cta":""',
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
  companyId: string, template: 'tweet' | 'product', fields: Record<string, string>, brand: CardBrand,
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
  const s = name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '')
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
}

// O núcleo da geração — usado tanto pelo modo interativo (1 empresa, o
// dono clicou) quanto pelo lote diário (várias empresas, cron).
async function generateForCompany(admin: SupaClient, anthropicKey: string, company: Company, kind: string, opts: GenOpts) {
  const [{ data: cfgRow }, { data: insRows }, { data: libRows }, { data: visRows }, { data: fmtRows }, { data: bdRow }, { data: recentRows }, { data: productRows }] = await Promise.all([
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
  const templateDesc = TEMPLATE_DESC(!!product?.image_url)
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

  // ── Passo 1: Diretor Criativo → BRIEF ────────────────────────────────
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

  const directorPrompt = `${preamble(config, company)}

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

${forcedTemplate ? `\nTEMPLATE JÁ DECIDIDO (não escolha outro — use exatamente "${forcedTemplate}" no seu "template" e monte hook/CTA/oferta pra ele funcionar bem, isso força "format":"foto"): "${forcedTemplate}".\n` : ''}
IMPORTANTE: "format" só pode ser um destes (${modLabel} não suporta os outros): ${fmtList}. "template" só pode ser um destes: ${templateList} — só é usado de verdade quando "format" for "foto" (ignore pra carrossel/reel/story). Passe pelas opções de verdade, uma por uma, e escolha a que MELHOR serve essa ideia específica — nenhuma delas (nem "livre") é o padrão pra quando você não souber o que escolher; TODAS exigem motivo real, que você explica em "reasoning" (cite ali por que escolheu esse template e não outro). VARIE de verdade (veja "Últimos posts" acima — não deixe o mesmo template se repetir sem um motivo estratégico real).
Decida o brief. Retorne APENAS um JSON:
{"objective":"awareness|engagement|conversion","format":${fmtList},"template":${templateList},"visual_system":"<título exato da biblioteca>","personality":"<título exato da biblioteca>","framework":"<título exato da biblioteca>","hook_angle":"ângulo do gancho em 1 frase","cta":"chamada pra ação","offer":"oferta/valor em 1 frase (ou vazio)","reasoning":"por que essas escolhas (incluindo o template), citando o insight"}`

  const brief = parseObj(await callClaude(anthropicKey, directorPrompt, 900))
  // Rede de segurança: se a IA ignorar a restrição, força pro formato/
  // template permitido mais próximo em vez de deixar vazar algo não suportado.
  if (!allowedFormats.includes(String(brief.format))) brief.format = allowedFormats[0]
  if (!templateKeys.includes(String(brief.template))) brief.template = 'livre'
  if (forcedTemplate) {
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

  // ── Passo 2: a personalidade EXECUTA, consultando a biblioteca ───────
  const personaContent = findContent(lib, 'personality', personality) || 'Copywriter: texto claro e persuasivo.'
  const frameworkContent = findContent(lib, 'framework', brief.framework as string | undefined)
  const visualContent = findContent(lib, 'visual_system', brief.visual_system as string | undefined)
  const visualSystemTitle = String(brief.visual_system ?? '')

  const execPrompt = `${preamble(config, company)}

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
${visualRefs ? `\nReferências visuais da marca (Layouts & Estilos — inspire-se no estilo quando fizer sentido):\n${visualRefs}\n` : ''}
Escreva o post pronto pra publicar. Regras importantes:
- "caption" é APENAS a legenda que vai no Instagram (texto pro público). NUNCA coloque nela instruções de imagem, descrição de foto nem "Slide 1/2/3".
- Se o formato for CARROSSEL, preencha "slides": um array de 3 a 6 slides QUE CONTAM UMA HISTÓRIA JUNTOS, nunca fotos soltas e desconectadas — o mesmo cenário/produto/personagem evoluindo de slide a slide, com progressão clara (ex: preparação → durante → resultado; problema → solução → chamada). Cada slide: {"text": texto curto que aparece no slide, "image": descrição visual EM INGLÊS da imagem daquele slide, continuando visualmente do slide anterior (sem pessoas, sem texto na imagem)}.
- Se for vídeo/reel/story, preencha "video_script" (roteiro de como gravar). Caso contrário, deixe vazio.
${CARD_FIELD_INSTRUCTIONS[String(brief.template ?? '')] ?? ''}
Retorne APENAS um JSON array:
[{"idea":"resumo curto do post","caption":"só a legenda do Instagram, texto pro público","hashtags":"#tag1 #tag2 #tag3","cta":"chamada pra ação final","format":"${brief.format ?? 'foto'}","video_script":"","slides":[{"text":"","image":""}]${CARD_FIELD_JSON[String(brief.template ?? '')] ?? ''}}]`

  const execRaw = await callClaude(anthropicKey, execPrompt, 2000)
  let post = extractOne(execRaw)
  if (!post) {
    // Fallback: uma tentativa direta e simples, garante que o dono sempre recebe um post.
    const fbRaw = await callClaude(anthropicKey, `${preamble(config, company)}

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
  }).select('id').single()
  if (insErr) throw new Error(insErr.message)

  let mainImage: string | null = null
  let slides: { text: string; image_prompt: string; image_url: string | null }[] | null = null
  // Só `idea` (o CONCEITO visual curto) — nunca hook_angle/offer/caption:
  // são copy de verdade, e mandar isso pro prompt de imagem é exatamente o
  // que ensina a IA a tentar "escrever" a frase na foto (ver NO_TEXT_RULE).
  const evoke = () => (idea ?? '').slice(0, 400) || 'foto do negócio'
  const conceptHint = PHOTO_HINT[visualSystemTitle]

  if (!opts.skipImage) {
    if (fmt === 'carrossel') {
      const rawSlides = Array.isArray(post.slides) ? (post.slides as { text?: string; image?: string }[]).slice(0, 6) : []
      if (rawSlides.length > 0) {
        // Imagens: carrossel gera 1 imagem por slide (paralelo, até 6), cada
        // uma do conteúdo ESPECÍFICO daquele slide — a coerência entre elas
        // vem da história pedida no execPrompt, não de repetir a mesma cena.
        // Só `s.image` (a descrição visual do slide, escrita pro Copywriter
        // EM INGLÊS especificamente pra isso) ou `idea` — NUNCA `s.text` (é
        // o texto que aparece NO slide, copy de verdade, ver NO_TEXT_RULE).
        const urls = await Promise.all(rawSlides.map(s => generateImage(company.id, company.business_type, String(s.image ?? idea ?? ''), conceptHint, brandStyle, company.business_description ?? undefined)))
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
        if (!mainImage) mainImage = await generateImage(company.id, company.business_type, evoke(), undefined, brandStyle, company.business_description ?? undefined)
      } else if (template === 'product' && product?.image_url) {
        // Produto real já cadastrado — zero geração de imagem, reusa a foto de verdade.
        const ctaText = capWords(String(post.card_cta ?? ''), 28)
        mainImage = await renderGraphicCard(opts, company.id, 'product', {
          productImage: product.image_url, name: product.title, price: '', cta: ctaText,
        }, cardBrand)
        if (!mainImage) mainImage = await generateImage(company.id, company.business_type, evoke(), undefined, brandStyle, company.business_description ?? undefined)
      } else {
        // "livre" — foto realista e específica, escolhida com intenção (não é fallback). Legenda conta a história.
        mainImage = await generateImage(company.id, company.business_type, evoke(), conceptHint, brandStyle, company.business_description ?? undefined)
      }
    } else {
      // reel/story (só existe em Campanhas) — ainda 1 imagem estática (não
      // geramos vídeo de verdade), mesmo caminho do "livre".
      mainImage = await generateImage(company.id, company.business_type, evoke(), conceptHint, brandStyle, company.business_description ?? undefined)
    }
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

// Calendário da Semana: PLANEJA a semana (quais dias merecem post orgânico,
// quais merecem story, quais ficam vazios — olhando os insights abertos do
// Agente de Dados e quanto já foi gerado recentemente) e, pra cada dia
// planejado, dispara o MESMO fluxo de sempre (generateForCompany → Diretor +
// Copywriter + imagem + controle de qualidade → Vault automático se a nota
// for boa). Não é um motor de conteúdo separado — é só o Calendário
// decidindo QUANDO usar o motor que já existe, um fluxo só conectado.
async function planWeekForCompany(admin: SupaClient, anthropicKey: string, company: Company, auth: { bearer: string; isCron: boolean; cronSecret?: string }): Promise<{ planned: number; days: { date: string; kind: string; note: string; idea_title?: string }[] }> {
  const [{ data: insRows }, { data: pendingRows }, { data: ideaRows }] = await Promise.all([
    admin.from('marketing_ai_insights').select('pillar, title, description').eq('company_id', company.id).eq('status', 'open').order('created_at', { ascending: false }).limit(8),
    admin.from('marketing_ai_test_content').select('id').eq('company_id', company.id).eq('status', 'draft').is('quality_score', null),
    // Backlog de ideias (aba Ideias, dentro de Biblioteca E de Calendário da
    // Semana) — o plano SEMPRE parte daqui, nunca inventa do zero: é o
    // jeito do dono ver a mesma lista de ideias virar, de fato, o calendário.
    admin.from('marketing_ai_ideas').select('id, title, hook, angle, format, module, rationale').eq('company_id', company.id).neq('status', 'dismissed').neq('status', 'used').in('module', ['organico', 'stories']).order('created_at', { ascending: false }).limit(20),
  ])
  const insights = (insRows ?? []) as { pillar: string; title: string; description: string }[]
  const pendingCount = (pendingRows ?? []).length
  const ideas = (ideaRows ?? []) as { id: string; title: string; hook: string | null; angle: string | null; format: string | null; module: string | null; rationale: string | null }[]
  const dates = nextWeekDates()

  if (ideas.length === 0) return { planned: 0, days: [] }

  const prompt = `Você é o planejador de conteúdo semanal de "${company.business_name}" (${company.business_type ?? 'negócio'} em ${company.city ?? 'Brasil'}).
${company.business_description ? `O que o negócio faz: ${company.business_description}.` : ''}

Monte o plano da PRÓXIMA semana ESCOLHENDO entre as ideias já disponíveis abaixo (nunca invente uma ideia nova aqui — se não houver ideia boa pra um dia, deixe esse dia sem nada). Pra cada dia que valer a pena, escolha a MELHOR ideia disponível pro tipo certo (post orgânico ou story) e não repita a mesma ideia em dois dias. Cadência realista: normalmente 3 a 5 posts orgânicos por semana + stories mais frequentes, nunca mais de 1 peça por dia. Considere que ${pendingCount} peça(s) recente(s) ainda nem foram avaliadas — se já tem bastante coisa parada, planeje menos essa semana.
${insights.length ? `\nInsights abertos (ajudam a priorizar QUAL ideia usar primeiro):\n${insights.map(i => `- [${i.pillar}] ${i.title}: ${i.description}`).join('\n')}` : ''}

Ideias disponíveis (use o "id" exato):
${ideas.map(i => `- id:"${i.id}" [${i.module}] "${i.title}"${i.hook ? ` — gancho: ${i.hook}` : ''}${i.rationale ? ` — ${i.rationale}` : ''}`).join('\n')}

Dias (use EXATAMENTE estas datas, uma linha por dia, na mesma ordem):
${dates.map(d => `- ${d.iso} (${d.weekday})`).join('\n')}

Retorne APENAS um JSON array, um item por dia, nesta ordem:
[{"date":"YYYY-MM-DD","idea_id":"<id de uma ideia acima, ou null se não usar esse dia>","note":"por que essa ideia pra esse dia (ou por que pular), 1 frase"}]`

  const raw = await callClaude(anthropicKey, prompt, 1100)
  const ideaById = new Map(ideas.map(i => [i.id, i]))
  const parsedPlan = (parseArr(raw) as { date?: string; idea_id?: string; note?: string }[])
    .filter(p => p.idea_id && ideaById.has(p.idea_id))
    .slice(0, 6) // rede de segurança: nunca mais que 6 gerações numa rodada só (tempo/custo)

  let planned = 0
  const days: { date: string; kind: string; note: string; idea_title?: string }[] = []
  const usedIdeaIds = new Set<string>()
  for (const p of parsedPlan) {
    if (!p.idea_id || usedIdeaIds.has(p.idea_id)) continue // não deixa a IA repetir a mesma ideia em 2 dias
    const idea = ideaById.get(p.idea_id)!
    const kind = idea.module === 'stories' ? 'stories' : 'organico'
    const date = p.date && /^\d{4}-\d{2}-\d{2}$/.test(p.date) ? p.date : dates[0].iso
    try {
      await generateForCompany(admin, anthropicKey, company, kind, {
        ...auth, plannedFor: date, ideaId: idea.id,
        seed: { title: idea.title, hook: idea.hook ?? undefined, angle: idea.angle ?? undefined, format: idea.format ?? undefined },
      })
      usedIdeaIds.add(p.idea_id)
      planned++
      days.push({ date, kind, note: String(p.note ?? ''), idea_title: idea.title })
    } catch (e) { console.error('planWeekForCompany: falhou pra', company.id, date, e) }
  }
  return { planned, days }
}

const COMPANY_SELECT = 'id, business_name, business_type, city, goal, business_description, ideal_customer, language'

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

    // ── Calendário da Semana (cron, domingo 18h BRT): planeja + gera a
    // semana inteira pra toda empresa com auto_weekly_calendar ligado.
    if (cronSecretEnv && body.cron_secret === cronSecretEnv && body.action === 'run_weekly_plan' && !body.company_id) {
      const { data: configs } = await admin.from('marketing_ai_config').select('company_id').eq('auto_weekly_calendar', true)
      let companies = 0, planned = 0, failed = 0
      for (const cfg of (configs ?? []) as { company_id: string }[]) {
        try {
          const { data: companyRow } = await admin.from('companies').select(COMPANY_SELECT).eq('id', cfg.company_id).maybeSingle()
          const company = companyRow as Company | null
          if (!company) continue
          const r = await planWeekForCompany(admin, anthropicKey, company, { bearer: '', isCron: true, cronSecret: cronSecretEnv })
          companies++; planned += r.planned
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
          await generateForCompany(admin, anthropicKey, company, 'organico', { bearer: '', isCron: true, cronSecret: cronSecretEnv, skipImage: cfg.auto_daily_test_image === false })
          generated++
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

    // Botão manual "Planejar semana agora" (Calendário da Semana) — mesma
    // lógica do cron de domingo, só que na hora, pro dono testar/adiantar.
    if (body.action === 'plan_week') {
      const result = await planWeekForCompany(admin, anthropicKey, company, { bearer, isCron: false })
      return json({ ok: true, ...result })
    }

    const kind = ['organico', 'stories', 'campanhas'].includes(String(body.kind)) ? String(body.kind) : 'organico'
    const seed = body.idea && typeof body.idea === 'object' ? body.idea as { title?: string; hook?: string; angle?: string; format?: string } : null
    // Botão "Gerar post de teste": o dono pode escolher um template específico
    // ou "random" — sem isso (undefined), cai na rotação automática.
    const templateChoice = body.template ? String(body.template) : null

    const result = await generateForCompany(admin, anthropicKey, company, kind, {
      bearer, isCron: false, seed, ideaId: body.idea_id ? String(body.idea_id) : null, templateChoice,
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
