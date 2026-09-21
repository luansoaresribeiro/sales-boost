import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

type SupaClient = ReturnType<typeof createClient>
type AgentRole = 'marketing'

interface Company {
  id: string; business_name: string; business_type: string | null
  city: string | null; instagram_url: string | null; goal: string | null
  plan?: string | null; social_data?: Record<string, unknown>
  google_rating?: number | null; google_review_count?: string | null
  agent_messages_used?: number; agent_messages_reset_at?: string
  telegram_chat_id?: number | null; notification_prefs?: Record<string, boolean> | null
}

const PLAN_LIMITS: Record<string, number> = { free: 30, basic: 150, pro: Infinity }

// ── Hermes Control Center ──────────────────────────────────────
// O "cérebro" do Hermes não fica mais fixo no código — é configuração que o
// owner edita em /owner/hermes, sem precisar de deploy. Ver migration
// 023_hermes_control_center.sql pro schema completo e as notas de segurança
// (não existe toggle "publica sozinho" de propósito).
interface HermesConfig {
  mission: string
  personality: string
  priorities: Record<string, number>
  global_objectives: string[]
  kpis_monitored: Record<string, boolean>
  max_active_agents: number
  policies: string
}

const DEFAULT_HERMES_CONFIG: HermesConfig = {
  mission: 'Ser o CEO responsável pelo crescimento dos clientes.',
  personality: 'ceo',
  priorities: { marketing: 90, leads: 100, seo: 70, avaliacoes: 80, financeiro: 30, retencao: 95 },
  global_objectives: [
    'Sempre melhorar KPIs.', 'Sempre procurar novas oportunidades.', 'Nunca deixar um cliente sem acompanhamento.',
    'Priorizar ações de maior impacto.', 'Agir proativamente.', 'Pensar como um CEO.',
  ],
  kpis_monitored: {
    instagram: true, google_reviews: true, conversao: true, leads: true, faturamento: false,
    seo: true, trafego: false, tempo_resposta: false, whatsapp: false, retencao: true,
  },
  max_active_agents: 8,
  policies: '',
}

// Rotinas, Aprovações e Limites valem POR AGENTE agora (ver migration
// 031_agent_roles_scoped_config.sql) — antes eram um único config global em
// hermes_config, mas isso não fazia sentido assim que existe mais de um
// agente possível: cada um precisa do próprio teto de custo/chamadas e das
// próprias regras de aprovação.
interface AgentRoleSettings {
  routines: Record<string, boolean>
  approvals: Record<string, boolean>
  max_claude_calls_daily: number
  max_daily_cost_usd: number
  max_concurrent_tasks: number
}

const DEFAULT_AGENT_ROLE_SETTINGS: AgentRoleSettings = {
  routines: {
    daily_review: true, weekly_review: true, monthly_planning: true, monitor_competitors: true,
    detect_crises: true, find_opportunities: true, auto_create_tasks: true, review_agent_work: true, update_memory: true,
  },
  approvals: { can_create_campaigns: true, can_change_prices: false, can_delete_data: false, can_send_emails: true },
  max_claude_calls_daily: 200,
  max_daily_cost_usd: 12,
  max_concurrent_tasks: 10,
}

async function getAgentRoleSettings(admin: SupaClient, role: AgentRole): Promise<AgentRoleSettings> {
  const { data } = await admin.from('agent_roles').select('routines, approvals, max_claude_calls_daily, max_daily_cost_usd, max_concurrent_tasks').eq('role', role).maybeSingle()
  if (!data) return DEFAULT_AGENT_ROLE_SETTINGS
  return {
    routines: (data.routines as Record<string, boolean>) ?? DEFAULT_AGENT_ROLE_SETTINGS.routines,
    approvals: (data.approvals as Record<string, boolean>) ?? DEFAULT_AGENT_ROLE_SETTINGS.approvals,
    max_claude_calls_daily: (data.max_claude_calls_daily as number) ?? DEFAULT_AGENT_ROLE_SETTINGS.max_claude_calls_daily,
    max_daily_cost_usd: Number(data.max_daily_cost_usd ?? DEFAULT_AGENT_ROLE_SETTINGS.max_daily_cost_usd),
    max_concurrent_tasks: (data.max_concurrent_tasks as number) ?? DEFAULT_AGENT_ROLE_SETTINGS.max_concurrent_tasks,
  }
}

async function getHermesConfig(admin: SupaClient): Promise<HermesConfig> {
  const { data } = await admin.from('hermes_config').select('*').eq('id', true).maybeSingle()
  if (!data) return DEFAULT_HERMES_CONFIG
  return {
    mission: (data.mission as string) ?? DEFAULT_HERMES_CONFIG.mission,
    personality: (data.personality as string) ?? DEFAULT_HERMES_CONFIG.personality,
    priorities: (data.priorities as Record<string, number>) ?? DEFAULT_HERMES_CONFIG.priorities,
    global_objectives: (data.global_objectives as string[]) ?? DEFAULT_HERMES_CONFIG.global_objectives,
    kpis_monitored: (data.kpis_monitored as Record<string, boolean>) ?? DEFAULT_HERMES_CONFIG.kpis_monitored,
    max_active_agents: (data.max_active_agents as number) ?? DEFAULT_HERMES_CONFIG.max_active_agents,
    policies: (data.policies as string) ?? '',
  }
}

// Quais papéis estão ligados hoje — o dono decide isso no Agents Control
// Center (/owner/agentes), não é mais fixo no código. Se a tabela não
// existir ainda ou vier vazia, cai pro comportamento antigo (só o Agente
// Geral) em vez de travar o Hermes inteiro.
async function getActiveAgentRoles(admin: SupaClient): Promise<Set<AgentRole>> {
  const { data } = await admin.from('agent_roles').select('role, active')
  if (!data || data.length === 0) return new Set(['marketing'])
  const active = (data as { role: string; active: boolean }[]).filter(r => r.active).map(r => r.role as AgentRole)
  return new Set(active.length > 0 ? active : ['marketing'])
}

const PERSONALITY_FRAMING: Record<string, string> = {
  ceo: 'Você pensa e age como um CEO: decisivo, orientado a resultado, direto ao ponto — sem rodeio nem jargão vazio.',
  consultor: 'Você atua como um consultor: analítico e didático, explica o raciocínio e as opções antes de agir.',
  executivo: 'Você atua como um executivo operacional: rápido, pragmático, foco total em execução imediata.',
  especialista: 'Você atua como um especialista técnico: profundo em detalhes, preciso, sempre cita o dado que embasa cada recomendação.',
  analista: 'Você atua como um analista: cético com dado fraco, nunca afirma algo sem evidência real por trás.',
  criativo: 'Você tem um perfil criativo: ousado em ideias de conteúdo, gosta de propor formatos e ângulos que fogem do óbvio.',
}

const PRIORITY_LABELS: Record<string, string> = { marketing: 'Marketing', leads: 'Leads', seo: 'SEO', avaliacoes: 'Avaliações', financeiro: 'Financeiro', retencao: 'Retenção' }
const KPI_LABELS: Record<string, string> = { instagram: 'Instagram', google_reviews: 'Google Reviews', conversao: 'Conversão', leads: 'Leads', faturamento: 'Faturamento', seo: 'SEO', trafego: 'Tráfego', tempo_resposta: 'Tempo de resposta', whatsapp: 'WhatsApp', retencao: 'Retenção' }
const APPROVAL_LABELS: Record<string, string> = {
  can_create_campaigns: 'criar campanhas de conteúdo (semanas inteiras de posts agrupados)',
  can_change_prices: 'sugerir mudança de preço/plano pro dono decidir',
  can_delete_data: 'apagar dados (leads, posts, registros antigos)',
  can_send_emails: 'enviar e-mail em nome do negócio',
}

// Integrações: um catálogo global (integration_catalog) diz QUAIS integrações
// existem na plataforma; o que muda por empresa (conectou ou não) nunca vira
// uma tabela própria — é computado ao vivo a partir de dados que já existem
// (company_integrations, companies.instagram_user_id/telegram_chat_id). Assim
// o Hermes nunca planeja uma ação num canal que essa empresa específica não
// tem conectado — sem duplicar a verdade em dois lugares.
const INTEGRATION_LABELS: Record<string, string> = {
  instagram: 'Instagram', telegram: 'Telegram', google_business_profile: 'Google Business Profile',
  google_search_console: 'Google Search Console', whatsapp: 'WhatsApp', hubspot: 'HubSpot', meta_ads: 'Meta Ads (anúncios)',
  instagram_dm: 'Instagram Direct (mensagens)',
}

async function getConnectedIntegrations(admin: SupaClient, companyId: string): Promise<Record<string, boolean>> {
  const [{ data: company }, { data: rows }] = await Promise.all([
    admin.from('companies').select('instagram_user_id, telegram_chat_id').eq('id', companyId).maybeSingle(),
    admin.from('company_integrations').select('type').eq('company_id', companyId),
  ])
  const types = new Set((rows ?? []).map(r => r.type as string))
  return {
    instagram: !!company?.instagram_user_id,
    telegram: !!company?.telegram_chat_id,
    google_business_profile: types.has('google_business_profile'),
    google_search_console: types.has('google_search_console'),
    // Ainda não existe implementação nenhuma — sempre falso até isso mudar.
    whatsapp: false, hubspot: false, meta_ads: false, instagram_dm: false,
  }
}

// Camada estratégica — igual pra qualquer agente, montada 100% a partir do
// hermes_config (+ integrações reais desta empresa). A camada tática
// (identidade, ferramentas, vocabulário específico) continua em
// AGENT_ROLES[role].buildPrompt, abaixo.
function composeHermesPreamble(config: HermesConfig, approvals: Record<string, boolean>, integrations?: Record<string, boolean>): string {
  const priorityList = Object.entries(config.priorities)
    .sort(([, a], [, b]) => (b as number) - (a as number))
    .map(([k, v]) => `${PRIORITY_LABELS[k] ?? k} (${v})`)
    .join(', ')

  const kpiList = Object.entries(config.kpis_monitored).filter(([, v]) => v).map(([k]) => KPI_LABELS[k] ?? k).join(', ')
  const objectivesList = config.global_objectives.map(o => `- ${o}`).join('\n')
  const approvalLines = Object.entries(APPROVAL_LABELS).map(([key, label]) => `- ${approvals[key] ? 'Pode' : 'NÃO pode'} ${label}.`).join('\n')
  const policiesBlock = config.policies.trim()
    ? `\n\nPolíticas do Hermes (como o dono da plataforma quer que você opere — siga à risca):\n${config.policies.trim()}`
    : ''
  const integrationsBlock = integrations
    ? `\n\nINTEGRAÇÕES CONECTADAS NESTE NEGÓCIO (nunca planeje uma ação num canal marcado ❌ — ele não está disponível pra esta empresa):\n${Object.entries(integrations).map(([k, v]) => `${v ? '✅' : '❌'} ${INTEGRATION_LABELS[k] ?? k}`).join('\n')}`
    : ''

  return `MISSÃO: ${config.mission}

${PERSONALITY_FRAMING[config.personality] ?? PERSONALITY_FRAMING.ceo}

PRIORIDADES DA PLATAFORMA AGORA (0-100, mais alto = mais atenção e mais disposição a agir sem pedir confirmação): ${priorityList}.

OBJETIVOS GLOBAIS (valem pra toda empresa, além do objetivo específico dela):
${objectivesList}

KPIs QUE VOCÊ ACOMPANHA: ${kpiList || 'nenhum configurado no momento'}.

O QUE VOCÊ PODE DECIDIR SOZINHO (mesmo assim, tudo continua indo como rascunho — publicar de verdade é sempre o dono que aprova):
${approvalLines}${policiesBlock}${integrationsBlock}`
}

// Every capability the platform exposes to any agent. Whether a given role can
// actually reach one of these is decided by AGENT_ROLES[role].tools below —
// this list only defines what exists, not who's allowed to call it.
const OPENAI_TOOLS = [
  { type: 'function', function: { name: 'create_post', description: 'Cria um rascunho de post para aprovacao. NUNCA publica diretamente.', parameters: { type: 'object', properties: { content: { type: 'string' }, platform: { type: 'string', enum: ['instagram', 'whatsapp', 'email'] }, image_suggestion: { type: 'string' }, best_time: { type: 'string' } }, required: ['content', 'platform'] } } },
  { type: 'function', function: { name: 'create_multiple_posts', description: 'Cria varios rascunhos de uma vez.', parameters: { type: 'object', properties: { posts: { type: 'array', items: { type: 'object', properties: { content: { type: 'string' }, platform: { type: 'string' }, image_suggestion: { type: 'string' }, best_time: { type: 'string' } }, required: ['content', 'platform'] } } }, required: ['posts'] } } },
  { type: 'function', function: { name: 'get_business_overview', description: 'Resumo completo do negocio.', parameters: { type: 'object', properties: {} } } },
  { type: 'function', function: { name: 'list_posts', description: 'Lista posts com filtro opcional por status.', parameters: { type: 'object', properties: { status: { type: 'string', enum: ['rascunho', 'aprovado', 'publicado'] }, limit: { type: 'number' } } } } },
  { type: 'function', function: { name: 'list_opportunities', description: 'Lista oportunidades de receita detectadas.', parameters: { type: 'object', properties: { status: { type: 'string' } } } } },
  { type: 'function', function: { name: 'list_reviews', description: 'Lista avaliacoes do Google.', parameters: { type: 'object', properties: { rating_max: { type: 'number' }, unanswered_only: { type: 'boolean' }, limit: { type: 'number' } } } } },
  { type: 'function', function: { name: 'get_latest_diagnostic', description: 'Diagnostico mais recente do site.', parameters: { type: 'object', properties: {} } } },
  { type: 'function', function: { name: 'list_competitors', description: 'Concorrentes mapeados.', parameters: { type: 'object', properties: { limit: { type: 'number' } } } } },
  { type: 'function', function: { name: 'get_tab_insight', description: 'Le o relatorio de IA mais recente (resumo + sugestoes) ja gerado para uma aba do dashboard. Mais rapido e barato do que reprocessar os dados brutos daquela aba do zero — sempre prefira consultar aqui antes de decidir uma acao relacionada aquela area.', parameters: { type: 'object', properties: { tab_key: { type: 'string', enum: ['avaliacoes', 'opinioes', 'concorrentes', 'crescimento', 'performance', 'audiencia', 'diagnostico'] } }, required: ['tab_key'] } } },
  { type: 'function', function: { name: 'get_data_agent_signals', description: 'Consulta o Data Agent — a camada de inteligencia que ja cruza os dados brutos e devolve SINAIS prontos (com evidencia, confianca e relevancia) por dominio: competition (gaps vs. concorrentes), content (sem postar, rascunhos parados, formato que mais engaja) e history (o que ja foi tentado ou ja falhou, pra nao repetir). Prefira SEMPRE isto antes de ler tabela por tabela: kind "state" da o retrato atual, kind "delta" da so o que mudou. Tambem informa quais canais (Google, Instagram, LinkedIn) estao conectados.', parameters: { type: 'object', properties: { kind: { type: 'string', enum: ['state', 'delta'] }, domain: { type: 'string', enum: ['competition', 'content', 'history'] } }, required: ['kind'] } } },
  { type: 'function', function: { name: 'save_memory', description: 'Salva informacao na memoria do agente.', parameters: { type: 'object', properties: { key: { type: 'string' }, value: { type: 'string' }, type: { type: 'string', enum: ['preference', 'fact', 'rule'] } }, required: ['key', 'value', 'type'] } } },
  { type: 'function', function: { name: 'load_memory', description: 'Carrega uma memoria pelo nome da chave.', parameters: { type: 'object', properties: { key: { type: 'string' } }, required: ['key'] } } },
  { type: 'function', function: { name: 'list_memories', description: 'Lista memorias do agente.', parameters: { type: 'object', properties: { type: { type: 'string' } } } } },
  { type: 'function', function: { name: 'list_leads', description: 'Lista leads do CRM.', parameters: { type: 'object', properties: { stage: { type: 'string' }, limit: { type: 'number' } } } } },
  { type: 'function', function: { name: 'create_lead', description: 'Cria um novo lead no CRM.', parameters: { type: 'object', properties: { name: { type: 'string' }, contact: { type: 'string' }, channel: { type: 'string' }, stage: { type: 'string' }, value_estimate: { type: 'number' }, notes: { type: 'string' } }, required: ['name'] } } },
  { type: 'function', function: { name: 'update_lead_stage', description: 'Move lead para outra etapa do funil.', parameters: { type: 'object', properties: { lead_id: { type: 'string' }, stage: { type: 'string' } }, required: ['lead_id', 'stage'] } } },
  { type: 'function', function: { name: 'draft_followup', description: 'Cria rascunho de follow-up para um lead.', parameters: { type: 'object', properties: { lead_id: { type: 'string' }, content: { type: 'string' }, channel: { type: 'string' } }, required: ['lead_id', 'content'] } } },
]

const ALL_TOOL_NAMES = OPENAI_TOOLS.map(t => t.function.name)
const CREATION_TOOL_NAMES = new Set(['create_post', 'create_multiple_posts', 'create_lead', 'draft_followup'])
const MEMORY_TOOL_NAMES = new Set(['save_memory', 'load_memory', 'list_memories'])

// ── Capability Registry ─────────────────────────────────────────
// Capacidades reais que já existiam no ecossistema (em outras edge functions)
// mas eram invisíveis pro Hermes — achado da auditoria do Executor. A tabela
// capability_registry (migration 024) é só METADADO: nome, descrição, se
// está ligada. O que de fato torna algo chamável é este mapa aqui — se uma
// capacidade não tem entrada em CAPABILITY_TOOL_SCHEMAS, nenhum toggle no
// Control Center consegue fazer o Hermes chamá-la (evita a tabela prometer
// algo que o código não tem por trás).
//
// Disponível só no chat interativo por enquanto (precisa do authHeader do
// dono pra repassar pra função irmã) — o ciclo automático ainda não usa.
const CAPABILITY_EDGE_FUNCTIONS: Record<string, string> = {
  generate_content: 'generate-posts',
  create_campaign: 'content-intelligence',
  find_viral_trends: 'content-intelligence',
  draft_review_reply: 'draft-reply',
  analyze_reviews_now: 'analyze-reviews',
  diagnose_site_now: 'site-diagnosis',
  find_competitors_now: 'map-competitors',
  monitor_competitors_social_now: 'monitor-competitor-social',
  refresh_tab_insight: 'generate-tab-insight',
}

const CAPABILITY_TOOL_SCHEMAS: Record<string, { type: string; function: { name: string; description: string; parameters: Record<string, unknown> } }> = {
  generate_content: { type: 'function', function: { name: 'generate_content', description: 'Gera post(s) novo(s) com IA, incluindo imagem gerada automaticamente. Mais completo que create_post — use quando quiser que a IA escreva E ilustre.', parameters: { type: 'object', properties: {} } } },
  create_campaign: { type: 'function', function: { name: 'create_campaign', description: 'Cria uma campanha: um calendário de vários posts organizados em torno de um objetivo.', parameters: { type: 'object', properties: { name: { type: 'string' }, goal: { type: 'string' }, duration_days: { type: 'number' }, channels: { type: 'array', items: { type: 'string' } } }, required: ['name', 'goal'] } } },
  find_viral_trends: { type: 'function', function: { name: 'find_viral_trends', description: 'Identifica tendências atuais do segmento pra inspirar conteúdo.', parameters: { type: 'object', properties: {} } } },
  draft_review_reply: { type: 'function', function: { name: 'draft_review_reply', description: 'Gera com IA um rascunho de resposta pra uma oportunidade do tipo avaliação — precisa aprovação do dono antes de ser enviado de verdade (o envio real não é uma ferramenta sua).', parameters: { type: 'object', properties: { opportunity_id: { type: 'string' } }, required: ['opportunity_id'] } } },
  analyze_reviews_now: { type: 'function', function: { name: 'analyze_reviews_now', description: 'Classifica sentimento/tema das avaliações pendentes agora, sem esperar o ciclo automático.', parameters: { type: 'object', properties: {} } } },
  diagnose_site_now: { type: 'function', function: { name: 'diagnose_site_now', description: 'Roda um novo diagnóstico técnico do site (PageSpeed + revisão de IA) agora.', parameters: { type: 'object', properties: {} } } },
  find_competitors_now: { type: 'function', function: { name: 'find_competitors_now', description: 'Escaneia o Google Maps por concorrentes próximos agora.', parameters: { type: 'object', properties: { radius_km: { type: 'number' } } } } },
  monitor_competitors_social_now: { type: 'function', function: { name: 'monitor_competitors_social_now', description: 'Verifica agora o Instagram dos concorrentes já mapeados.', parameters: { type: 'object', properties: {} } } },
  refresh_tab_insight: { type: 'function', function: { name: 'refresh_tab_insight', description: 'Força gerar de novo o relatório de IA de uma aba específica do dashboard.', parameters: { type: 'object', properties: { tab_key: { type: 'string', enum: ['avaliacoes', 'opinioes', 'concorrentes', 'crescimento', 'performance', 'audiencia', 'diagnostico'] } }, required: ['tab_key'] } } },
}

async function callSibling(fnName: string, authHeader: string, body: Record<string, unknown>): Promise<Record<string, unknown>> {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  try {
    const res = await fetch(`${supabaseUrl}/functions/v1/${fnName}`, {
      method: 'POST',
      headers: { Authorization: authHeader, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) return { error: data.error ?? `Erro ${res.status} em ${fnName}` }
    return data
  } catch (e) {
    return { error: String(e) }
  }
}

// Só busca no registry quando existe authHeader (chat interativo) — no ciclo
// automático e no Telegram, essas capacidades simplesmente não são
// oferecidas ainda (ver nota no topo desta seção).
async function getEnabledCapabilityTools(admin: SupaClient, agentRole: AgentRole): Promise<{ tools: unknown[]; names: Set<string> }> {
  const { data } = await admin.from('capability_registry')
    .select('id')
    .eq('enabled', true)
    .eq('hermes_callable', true)
    .contains('used_by', [agentRole])
  const ids = (data ?? []).map(r => r.id as string).filter(id => CAPABILITY_TOOL_SCHEMAS[id])
  return { tools: ids.map(id => CAPABILITY_TOOL_SCHEMAS[id]), names: new Set(ids) }
}

// Add new agents here: a name, a persona prompt, and which of the tools above
// it's allowed to reach. Most new agents won't need new tools at all — they
// just get a different slice of the ones that already exist.
//
// O Agente de Vendas foi excluído (decisão do dono, sem fonte real de leads
// até então) — ver histórico em CLAUDE.md. O que sobrou virou o "Agente
// Geral": mesma chave interna 'marketing' (não renomeada no banco pra não
// quebrar histórico de agent_messages/agent_performance), só o nome exibido
// mudou, já que agora é o único agente e cobre o negócio inteiro.
const AGENT_ROLES: Record<AgentRole, { name: string; emoji: string; tools: string[]; buildPrompt: (c: Company) => string }> = {
  marketing: {
    name: 'Agente Geral', emoji: '📣', tools: ALL_TOOL_NAMES,
    buildPrompt: (c) => {
      const ig = (c.social_data as Record<string, unknown> | undefined)?.instagram as Record<string, unknown> | undefined
      const igCtx = ig ? `\nInstagram: ${ig.followers} seguidores, ${ig.avg_likes} curtidas/post, ${ig.engagement_rate}% engajamento.` : ''
      return `Você é o Agente Geral de "${c.business_name}" (${c.business_type ?? 'negócio'} em ${c.city ?? 'Brasil'}).${igCtx}
Objetivo específico deste negócio: ${c.goal ?? 'crescer e gerar mais receita'}.

O QUE VOCÊ ENXERGA — o painel inteiro do negócio, não só posts:
- Conteúdo: Posts (rascunho/aprovado/publicado), Campanhas e Tendências virais do segmento.
- Avaliações: notas e comentários do Google.
- Opiniões da Internet: avaliações de todas as fontes — Google, Facebook, TripAdvisor, Reclame Aqui, iFood, comentários do Instagram.
- Crescimento: desempenho de cada post publicado no Instagram (o que engaja, o que não engaja, e por quê).
- Diagnóstico de canais: se site, Instagram, Facebook, Maps etc. estão no ar e respondendo.
- Concorrentes: quem são, nota, faixa de preço, distância, atividade nas redes deles.
- Performance: velocidade e SEO técnico do site.
- Audiência: seguidores, engajamento e alcance em cada rede.
Cada uma dessas áreas já tem um resumo pronto, gerado por IA (ferramenta get_tab_insight) — consulte ele antes de agir sempre que a decisão depender daquela área; é mais rápido e mais barato do que reprocessar dado bruto do zero toda vez.
Para o quadro estratégico cruzado, use get_data_agent_signals: ele devolve SINAIS prontos (com evidência, confiança e relevância) sobre concorrência, conteúdo e histórico — inclusive o que já foi tentado ou já falhou, pra você não repetir — e diz quais canais (Google, Instagram, LinkedIn) estão conectados. Prefira esses sinais a ficar lendo tabela por tabela.

MENTE REATIVA E PROATIVA — as duas ao mesmo tempo:
- Reativa: quando o dono pedir algo específico, execute com precisão, sem burocracia e sem pedir confirmação de algo óbvio.
- Proativa: no ciclo automático (ninguém pediu nada), é sua obrigação notar sozinho o que está errado ou parado — reputação caindo, concorrente mexendo no preço, muitos dias sem postar, review negativa sem resposta, canal fora do ar — e agir ou avisar. Silêncio só é aceitável quando você de fato checou e está tudo bem.

VOCABULÁRIO TÉCNICO que você domina (raciocíne com precisão nesses termos, mas explique em português simples quando for falar com o dono):
- SEO/Performance: Core Web Vitals — LCP (velocidade até o maior elemento carregar), FCP (primeira coisa a aparecer na tela), CLS (o quanto o layout "pula" enquanto carrega); score de Performance/SEO do PageSpeed vai de 0 a 100.
- Redes sociais: taxa de engajamento (curtidas+comentários ÷ seguidores), alcance, frequência de postagem, o que "viralizar" significa de verdade pro segmento dele.
- Reputação: sentimento (positivo/neutro/negativo) de cada avaliação, tema recorrente, taxa de resposta a reviews.
- Concorrência: posicionamento de preço ($ a $$$$), quem domina a conversa no bairro (share of voice).

Se surgir um lead ou oportunidade de atendimento (follow-up, funil de vendas), você também cuida disso — não existe mais um agente separado pra isso.

Use as ferramentas para agir de verdade — buscar dados reais e criar conteúdo no banco, nunca apenas descrever o que faria.`
    },
  },
}

const SHARED_RULES = `

Regra permanente, que nenhuma configuração pode desligar: nunca publique, envie mensagem ou responda review sozinho — tudo vira rascunho até o dono aprovar explicitamente.
Responda em texto corrido, sem markdown. Sem **, ##, tabelas ou listas com marcadores. Frases naturais e diretas.`

function buildSystemPrompt(role: AgentRole, company: Company, config: HermesConfig, roleSettings: AgentRoleSettings, integrations?: Record<string, boolean>): string {
  return `${composeHermesPreamble(config, roleSettings.approvals, integrations)}\n\n---\n\n${AGENT_ROLES[role].buildPrompt(company)}${SHARED_RULES}`
}

async function notifyMarketing(chatId: number | null | undefined, companyId: string, event: string, data?: Record<string, unknown>) {
  // Sempre grava na aba Atividades, mesmo sem Telegram conectado — o envio
  // ao Telegram (dentro de log-bot-event) é só um bônus quando existe chatId.
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const secret = Deno.env.get('BOT_WEBHOOK_SECRET')
  if (!supabaseUrl) return
  fetch(`${supabaseUrl}/functions/v1/log-bot-event`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ secret: secret ?? '', bot_name: 'marketing', event_type: event, company_id: companyId, telegram_chat_id: chatId ?? null, data }),
  }).catch(() => {})
}

async function runTool(tu: { name: string; id: string; input: unknown }, companyId: string, agentRole: AgentRole, admin: SupaClient, allowAutoCreate = true, authHeader?: string, extraAllowedNames: Set<string> = new Set()): Promise<{ result: string; posts: number; actions: number }> {
  const inp = tu.input as Record<string, unknown>

  // Defense in depth: never trust that the model only asked for tools we
  // offered it. A prompt is a suggestion, not an access boundary — this is
  // the actual boundary. extraAllowedNames cobre as capacidades vindas do
  // Capability Registry, que não fazem parte de AGENT_ROLES[role].tools.
  if (!AGENT_ROLES[agentRole].tools.includes(tu.name) && !extraAllowedNames.has(tu.name)) {
    return { result: `Ferramenta "${tu.name}" não permitida para o Agente Geral.`, posts: 0, actions: 0 }
  }

  // Rotina "Criar tarefas automaticamente" desligada — só vale pro ciclo
  // autônomo (ninguém pediu nada). No chat interativo o dono pediu na hora,
  // então isso nunca se aplica lá.
  if (!allowAutoCreate && CREATION_TOOL_NAMES.has(tu.name)) {
    return { result: 'A rotina "Criar tarefas automaticamente" está desligada no Hermes Control Center — nenhuma ação tomada no ciclo automático.', posts: 0, actions: 0 }
  }

  // Capacidades do Capability Registry — cada uma chama a edge function
  // irmã que já implementa isso de verdade, repassando a sessão do dono.
  if (CAPABILITY_EDGE_FUNCTIONS[tu.name]) {
    if (!authHeader) return { result: 'Essa capacidade só está disponível na conversa direta com o dono (chat/Jarvis) por enquanto, não no ciclo automático.', posts: 0, actions: 0 }
    const fnName = CAPABILITY_EDGE_FUNCTIONS[tu.name]
    const bodyBuilders: Record<string, () => Record<string, unknown>> = {
      generate_content: () => ({}),
      create_campaign: () => ({ type: 'campaign', name: inp.name, goal: inp.goal, duration_days: inp.duration_days ?? 7, channels: inp.channels ?? ['Instagram', 'WhatsApp'] }),
      find_viral_trends: () => ({ type: 'trends' }),
      draft_review_reply: () => ({ opportunity_id: inp.opportunity_id }),
      analyze_reviews_now: () => ({}),
      diagnose_site_now: () => ({}),
      find_competitors_now: () => ({ radius_km: inp.radius_km }),
      monitor_competitors_social_now: () => ({}),
      refresh_tab_insight: () => ({ tab_key: inp.tab_key }),
    }
    const data = await callSibling(fnName, authHeader, bodyBuilders[tu.name]?.() ?? {})
    if (data.error) return { result: `Não consegui: ${data.error}`, posts: 0, actions: 0 }
    const posts = Number(data.generated ?? (Array.isArray(data.posts) ? (data.posts as unknown[]).length : 0)) || 0
    const actions = posts > 0 ? posts : (tu.name === 'draft_review_reply' && data.draft ? 1 : 0)
    return { result: JSON.stringify(data), posts, actions }
  }

  if (tu.name === 'create_post') {
    await admin.from('posts').insert({ company_id: companyId, content: inp.content, platform: inp.platform ?? 'instagram', image_suggestion: inp.image_suggestion ?? null, best_time: inp.best_time ?? null, status: 'rascunho' })
    return { result: 'Post criado como rascunho.', posts: 1, actions: 1 }
  }

  if (tu.name === 'create_multiple_posts') {
    let count = 0
    for (const p of (inp.posts as Record<string, unknown>[]) ?? []) {
      await admin.from('posts').insert({ company_id: companyId, content: p.content, platform: p.platform ?? 'instagram', image_suggestion: p.image_suggestion ?? null, best_time: p.best_time ?? null, status: 'rascunho' })
      count++
    }
    return { result: `${count} posts criados como rascunho.`, posts: count, actions: count }
  }

  if (tu.name === 'get_business_overview') {
    const [coRes, postsRes, oppsRes, revRes] = await Promise.all([
      admin.from('companies').select('business_name,business_type,city,goal,plan,google_rating,google_review_count').eq('id', companyId).single(),
      admin.from('posts').select('status').eq('company_id', companyId),
      admin.from('opportunities').select('id').eq('company_id', companyId).eq('status', 'open'),
      admin.from('reviews').select('rating,owner_reply').eq('company_id', companyId),
    ])
    const byStatus = (postsRes.data ?? []).reduce((acc: Record<string, number>, p: { status: string }) => { acc[p.status] = (acc[p.status] ?? 0) + 1; return acc }, {})
    const revs = revRes.data ?? []
    const avgRating = revs.length ? (revs.reduce((s: number, r: { rating: number }) => s + (r.rating ?? 0), 0) / revs.length).toFixed(1) : null
    const unanswered = revs.filter((r: { owner_reply: unknown }) => !r.owner_reply).length
    return { result: JSON.stringify({ profile: coRes.data, posts: { total: (postsRes.data ?? []).length, byStatus }, openOpportunities: (oppsRes.data ?? []).length, reviews: { total: revs.length, avgRating, unanswered } }), posts: 0, actions: 0 }
  }

  if (tu.name === 'list_posts') {
    let q = admin.from('posts').select('id,content,platform,status,best_time,created_at').eq('company_id', companyId)
    if (inp.status) q = q.eq('status', inp.status as string)
    const { data } = await q.order('created_at', { ascending: false }).limit(Number(inp.limit ?? 10))
    return { result: JSON.stringify(data ?? []), posts: 0, actions: 0 }
  }

  if (tu.name === 'list_opportunities') {
    let q = admin.from('opportunities').select('type,title,description,value_estimate,status').eq('company_id', companyId)
    if (inp.status) q = q.eq('status', inp.status as string)
    const { data } = await q.order('created_at', { ascending: false }).limit(20)
    return { result: JSON.stringify(data ?? []), posts: 0, actions: 0 }
  }

  if (tu.name === 'list_reviews') {
    let q = admin.from('reviews').select('author,rating,text,sentiment,review_date,owner_reply').eq('company_id', companyId)
    if (inp.rating_max) q = q.lte('rating', Number(inp.rating_max))
    if (inp.unanswered_only) q = q.is('owner_reply', null)
    const { data } = await q.order('review_date', { ascending: false }).limit(Number(inp.limit ?? 10))
    return { result: JSON.stringify(data ?? []), posts: 0, actions: 0 }
  }

  if (tu.name === 'get_latest_diagnostic') {
    const { data } = await admin.from('diagnostics').select('website_url,status,created_at,pagespeed_mobile,pagespeed_desktop,frontend_review').eq('company_id', companyId).order('created_at', { ascending: false }).limit(1).maybeSingle()
    if (!data) return { result: JSON.stringify({ message: 'Nenhum diagnostico encontrado.' }), posts: 0, actions: 0 }
    const ps_m = data.pagespeed_mobile as Record<string, unknown> | null
    const ps_d = data.pagespeed_desktop as Record<string, unknown> | null
    const fr = data.frontend_review as Record<string, unknown> | null
    return { result: JSON.stringify({ website_url: data.website_url, mobile: { performance: ps_m?.performance, seo: ps_m?.seo }, desktop: { performance: ps_d?.performance, seo: ps_d?.seo }, ai_summary: fr?.summary }), posts: 0, actions: 0 }
  }

  if (tu.name === 'list_competitors') {
    const { data } = await admin.from('competitors').select('name,rating,review_count,distance_m,price_level').eq('company_id', companyId).order('distance_m', { ascending: true }).limit(Number(inp.limit ?? 10))
    return { result: JSON.stringify(data ?? []), posts: 0, actions: 0 }
  }

  if (tu.name === 'get_tab_insight') {
    const { data } = await admin.from('insights_reports').select('summary,suggestions,created_at').eq('company_id', companyId).eq('tab_key', inp.tab_key as string).maybeSingle()
    return { result: data ? JSON.stringify(data) : 'Nenhum relatorio gerado ainda para essa aba.', posts: 0, actions: 0 }
  }

  if (tu.name === 'get_data_agent_signals') {
    // Le SINAIS ja normalizados atraves do Data Agent (funcao data-agent) em vez
    // de reprocessar as tabelas brutas aqui. Chamada interna via CRON_SECRET,
    // sempre escopada ao company_id que o runTool ja recebeu — vale tanto no
    // chat interativo quanto no ciclo automatico (nenhum dos dois depende de
    // um JWT de usuario neste ponto).
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const cronSecret = Deno.env.get('CRON_SECRET') ?? ''
    const kind = inp.kind === 'delta' ? 'delta' : 'state'
    const reqBody: Record<string, unknown> = { cron_secret: cronSecret, company_id: companyId, kind }
    if (inp.domain) reqBody.domain = inp.domain
    try {
      const res = await fetch(`${supabaseUrl}/functions/v1/data-agent`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(reqBody),
      })
      const data = await res.json().catch(() => ({}))
      return { result: JSON.stringify(data), posts: 0, actions: 0 }
    } catch (e) {
      return { result: `Erro ao consultar o Data Agent: ${String(e)}`, posts: 0, actions: 0 }
    }
  }

  if (tu.name === 'save_memory') {
    await admin.from('agent_memory').upsert({ company_id: companyId, agent_role: agentRole, key: inp.key as string, value: inp.value as string, type: inp.type as string, updated_at: new Date().toISOString() }, { onConflict: 'company_id,agent_role,key' })
    return { result: `Memoria salva: ${inp.key}`, posts: 0, actions: 0 }
  }

  if (tu.name === 'load_memory') {
    const { data } = await admin.from('agent_memory').select('value,type,updated_at').eq('company_id', companyId).eq('agent_role', agentRole).eq('key', inp.key as string).maybeSingle()
    return { result: data ? JSON.stringify(data) : `Memoria nao encontrada: ${inp.key}`, posts: 0, actions: 0 }
  }

  if (tu.name === 'list_memories') {
    let q = admin.from('agent_memory').select('key,value,type,updated_at').eq('company_id', companyId).eq('agent_role', agentRole)
    if (inp.type) q = q.eq('type', inp.type as string)
    const { data } = await q.order('updated_at', { ascending: false })
    return { result: JSON.stringify(data ?? []), posts: 0, actions: 0 }
  }

  if (tu.name === 'list_leads') {
    let q = admin.from('leads').select('id,name,contact,channel,stage,value_estimate,last_contact_at,notes,created_at').eq('company_id', companyId)
    if (inp.stage) q = q.eq('stage', inp.stage as string)
    const { data } = await q.order('created_at', { ascending: false }).limit(Number(inp.limit ?? 50))
    return { result: JSON.stringify(data ?? []), posts: 0, actions: 0 }
  }

  if (tu.name === 'create_lead') {
    const { data: lead, error } = await admin.from('leads').insert({ company_id: companyId, name: inp.name as string, contact: (inp.contact as string) ?? null, channel: (inp.channel as string) ?? 'manual', stage: (inp.stage as string) ?? 'novo', value_estimate: inp.value_estimate ? Number(inp.value_estimate) : null, notes: (inp.notes as string) ?? null }).select('id').single()
    if (error) return { result: `Erro ao criar lead: ${error.message}`, posts: 0, actions: 0 }
    return { result: `Lead "${inp.name}" criado (ID: ${lead?.id}).`, posts: 0, actions: 1 }
  }

  if (tu.name === 'update_lead_stage') {
    const { error } = await admin.from('leads').update({ stage: inp.stage as string, last_contact_at: new Date().toISOString() }).eq('id', inp.lead_id as string).eq('company_id', companyId)
    if (error) return { result: `Erro: ${error.message}`, posts: 0, actions: 0 }
    return { result: `Lead movido para "${inp.stage}".`, posts: 0, actions: 0 }
  }

  if (tu.name === 'draft_followup') {
    const { data: msg, error } = await admin.from('lead_messages').insert({ lead_id: inp.lead_id as string, company_id: companyId, direction: 'out', channel: (inp.channel as string) ?? 'whatsapp', content: inp.content as string, status: 'rascunho' }).select('id').single()
    if (error) return { result: `Erro: ${error.message}`, posts: 0, actions: 0 }
    await admin.from('leads').update({ last_contact_at: new Date().toISOString() }).eq('id', inp.lead_id as string)
    return { result: `Follow-up criado como rascunho (ID: ${msg?.id}).`, posts: 0, actions: 1 }
  }

  return { result: `Ferramenta desconhecida: ${tu.name}`, posts: 0, actions: 0 }
}

async function runConversation(
  hermesUrl: string, hermesApiKey: string, agentRole: AgentRole, company: Company, admin: SupaClient,
  messages: unknown[], autonomousRoleSettings?: AgentRoleSettings, authHeader?: string,
): Promise<{ reply: string; postsCreated: number; actionsCount: number; tokensUsed: number }> {
  let allowedTools: unknown[] = OPENAI_TOOLS.filter(t => AGENT_ROLES[agentRole].tools.includes(t.function.name))
  // Rotina "Atualizar memória" desligada — tira as ferramentas de memória do
  // ciclo autônomo (o chat interativo nunca é restringido por essa config).
  if (autonomousRoleSettings && autonomousRoleSettings.routines.update_memory === false) {
    allowedTools = (allowedTools as typeof OPENAI_TOOLS).filter(t => !MEMORY_TOOL_NAMES.has(t.function.name))
  }
  const allowAutoCreate = !autonomousRoleSettings || autonomousRoleSettings.routines.auto_create_tasks !== false

  // Capacidades do Capability Registry — só entram na conversa quando há
  // authHeader (chat interativo). Ciclo automático e Telegram ainda não usam.
  let extraCapabilityNames = new Set<string>()
  if (authHeader) {
    const { tools: capTools, names } = await getEnabledCapabilityTools(admin, agentRole)
    allowedTools = [...allowedTools, ...capTools]
    extraCapabilityNames = names
  }

  let reply = ''
  let postsCreated = 0
  let actionsCount = 0
  let tokensUsed = 0

  for (let i = 0; i < 8; i++) {
    const hermesRes = await fetch(`${hermesUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${hermesApiKey}` },
      body: JSON.stringify({ model: 'hermes', messages, tools: allowedTools, tool_choice: 'auto' }),
    })

    if (!hermesRes.ok) {
      const errText = await hermesRes.text().catch(() => '')
      console.error('Hermes error:', hermesRes.status, errText)
      throw new Error(`Hermes retornou erro ${hermesRes.status}`)
    }

    const data = await hermesRes.json() as { choices?: { message?: { content?: string; tool_calls?: { id: string; function: { name: string; arguments: string } }[] } }[]; usage?: { total_tokens?: number } }
    // Nem todo servidor OpenAI-compatible devolve "usage" — quando não vem,
    // fica em 0 (mesmo comportamento de antes) até o Hermes passar a mandar.
    tokensUsed += data.usage?.total_tokens ?? 0
    const choice = data.choices?.[0]
    const msg = choice?.message

    if (!msg?.tool_calls?.length) {
      reply = msg?.content ?? ''
      break
    }

    messages.push({ role: 'assistant', content: null, tool_calls: msg.tool_calls })

    for (const tc of msg.tool_calls) {
      let input: unknown = {}
      try { input = JSON.parse(tc.function.arguments ?? '{}') } catch { /* ignore */ }
      const { result, posts, actions } = await runTool({ name: tc.function.name, id: tc.id, input }, company.id, agentRole, admin, allowAutoCreate, authHeader, extraCapabilityNames)
      postsCreated += posts
      actionsCount += actions
      messages.push({ role: 'tool', tool_call_id: tc.id, content: result })
    }
  }

  if (!reply) reply = postsCreated > 0 ? `Criei ${postsCreated} rascunho(s). Disponiveis na aba Posts para aprovacao.` : 'Feito!'
  return { reply, postsCreated, actionsCount, tokensUsed }
}

// ── Autonomous mode ───────────────────────────────────────────
// Replaces run-agents' fixed "always create 5 posts" schedule with an actual
// decision: Hermes looks at what's really going on for this company (pending
// drafts, open opportunities, recent activity) and decides whether there's
// anything worth doing right now, using the same tools as the interactive
// chat. Same safety valve as generate-posts — never act on top of a backlog
// the owner hasn't reviewed, and never fire more than once per hour per
// company regardless of how often the scheduler calls this endpoint.
const PENDING_DRAFT_LIMIT = 12
const RECENT_ACTIVITY_WINDOW_MS = 60 * 60 * 1000

async function runAutonomousCycle(admin: SupaClient, hermesUrl: string, hermesApiKey: string, company: Company, agentRole: AgentRole, config: HermesConfig, roleSettings: AgentRoleSettings): Promise<{ skipped: boolean; posts_created: number; error?: string; tokensUsed: number }> {
  const oneHourAgo = new Date(Date.now() - RECENT_ACTIVITY_WINDOW_MS).toISOString()
  // Marketing piles up in `posts`, Sales piles up in `lead_messages` —
  // each role gets guarded against its own kind of backlog.
  const table = agentRole === 'marketing' ? 'posts' : 'lead_messages'
  const [{ count: recentActivity }, { count: pendingDrafts }] = await Promise.all([
    admin.from(table).select('id', { count: 'exact', head: true }).eq('company_id', company.id).gte('created_at', oneHourAgo),
    admin.from(table).select('id', { count: 'exact', head: true }).eq('company_id', company.id).eq('status', 'rascunho'),
  ])
  if ((recentActivity ?? 0) > 0 || (pendingDrafts ?? 0) >= PENDING_DRAFT_LIMIT) {
    return { skipped: true, posts_created: 0, tokensUsed: 0 }
  }

  const task = agentRole === 'marketing'
    ? 'Analise o estado atual do negócio (rascunhos pendentes, oportunidades abertas, dias sem postar, avaliações sem resposta) usando get_business_overview e list_opportunities. Decida se vale a pena criar conteúdo novo agora. Se sim, use create_post ou create_multiple_posts (no máximo 5). Se não houver necessidade real, não crie nada e explique o motivo em uma frase.'
    : 'Use list_opportunities e list_leads para ver o que está parado. Para cada oportunidade ou lead que realmente precisa de ação (valor estimado > 0, ou parado há dias), use draft_followup ou create_lead. Se não houver nada que precise de ação agora, não faça nada e explique o motivo em uma frase.'

  try {
    const integrations = await getConnectedIntegrations(admin, company.id)
    const messages = [
      { role: 'system', content: buildSystemPrompt(agentRole, company, config, roleSettings, integrations) },
      { role: 'user', content: task },
    ]
    const { reply, postsCreated, actionsCount, tokensUsed } = await runConversation(hermesUrl, hermesApiKey, agentRole, company, admin, messages, roleSettings)

    await admin.from('agent_performance').insert({
      company_id: company.id, agent_role: agentRole, task_key: 'autonomous_cycle',
      task_description: reply.slice(0, 200), latency_ms: 0, tokens_used: tokensUsed, success: true,
    }).catch(() => { /* non-fatal */ })

    // Quiet when there was nothing worth doing — a message every cycle saying
    // "checked, nothing to do" is exactly the noise CLAUDE.md warns against.
    // actionsCount (not postsCreated) covers Sales' lead/follow-up actions too.
    if (actionsCount > 0) {
      const prefs = company.notification_prefs ?? {}
      if (prefs.agent_actions !== false) {
        notifyMarketing(company.telegram_chat_id, company.id, 'AGENT_ACTION', {
          action: postsCreated > 0 ? 'posts_created' : 'leads_actioned',
          count: actionsCount,
          reason: reply.slice(0, 200),
        })
      }
    }

    return { skipped: false, posts_created: postsCreated, tokensUsed }
  } catch (err) {
    const errorMsg = String(err)
    await admin.from('agent_performance').insert({
      company_id: company.id, agent_role: agentRole, task_key: 'autonomous_cycle',
      task_description: `erro: ${errorMsg.slice(0, 150)}`, latency_ms: 0, tokens_used: 0, success: false, error_message: errorMsg,
    }).catch(() => { /* non-fatal */ })
    return { skipped: false, posts_created: 0, error: errorMsg, tokensUsed: 0 }
  }
}

// ── Orchestrator ─────────────────────────────────────────────
// The layer above the Agente Geral: before it runs at all, Hermes looks at
// the company's real state and decides whether it actually needs to act
// right now. It only reads (never create_post, draft_followup, etc.) and
// its only way to finish is calling report_decision, so the output is
// always a structured decision, never a wall of prose we'd have to
// guess-parse. (Antes decidia Marketing e Vendas separadamente — o Agente
// de Vendas foi excluído, então hoje é uma decisão única.)
interface OrchestratorDecision { run_marketing: boolean; reasoning: string; tokensUsed: number }

const ORCHESTRATOR_TOOLS = [
  { type: 'function', function: { name: 'get_business_overview', description: 'Resumo completo do negocio.', parameters: { type: 'object', properties: {} } } },
  { type: 'function', function: { name: 'list_opportunities', description: 'Lista oportunidades de receita detectadas.', parameters: { type: 'object', properties: { status: { type: 'string' } } } } },
  { type: 'function', function: { name: 'list_posts', description: 'Lista posts com filtro opcional por status.', parameters: { type: 'object', properties: { status: { type: 'string' }, limit: { type: 'number' } } } } },
  { type: 'function', function: { name: 'list_reviews', description: 'Lista avaliacoes do Google.', parameters: { type: 'object', properties: { rating_max: { type: 'number' }, unanswered_only: { type: 'boolean' }, limit: { type: 'number' } } } } },
  { type: 'function', function: { name: 'list_leads', description: 'Lista leads do CRM.', parameters: { type: 'object', properties: { stage: { type: 'string' }, limit: { type: 'number' } } } } },
  { type: 'function', function: { name: 'get_latest_diagnostic', description: 'Diagnostico mais recente do site: performance, SEO, acessibilidade.', parameters: { type: 'object', properties: {} } } },
  { type: 'function', function: { name: 'list_competitors', description: 'Concorrentes mapeados: nota, numero de reviews, distancia, preco.', parameters: { type: 'object', properties: { limit: { type: 'number' } } } } },
  { type: 'function', function: { name: 'get_tab_insight', description: 'Le o relatorio de IA mais recente (resumo + sugestoes) de uma aba do dashboard — mais rapido do que reprocessar dado bruto.', parameters: { type: 'object', properties: { tab_key: { type: 'string', enum: ['avaliacoes', 'opinioes', 'concorrentes', 'crescimento', 'performance', 'audiencia', 'diagnostico'] } }, required: ['tab_key'] } } },
  { type: 'function', function: { name: 'get_data_agent_signals', description: 'Consulta o Data Agent: SINAIS prontos (com evidencia, confianca e relevancia) por dominio — competition, content, history — mais quais canais (Google, Instagram, LinkedIn) estao conectados. Comece por aqui (kind "delta" pra ver so o que mudou desde a ultima decisao) antes de ler tabela por tabela.', parameters: { type: 'object', properties: { kind: { type: 'string', enum: ['state', 'delta'] }, domain: { type: 'string', enum: ['competition', 'content', 'history'] } }, required: ['kind'] } } },
  {
    type: 'function', function: {
      name: 'report_decision',
      description: 'ÚNICA forma de terminar. Registra se o Agente Geral deve agir agora.',
      parameters: {
        type: 'object',
        properties: {
          run_marketing: { type: 'boolean', description: 'true se há necessidade real de agir agora — conteúdo, reputação, concorrência, diagnóstico ou atendimento' },
          reasoning: { type: 'string', description: 'motivo da decisão em 1 frase' },
        },
        required: ['run_marketing', 'reasoning'],
      },
    },
  },
]

async function decideRolesToRun(hermesUrl: string, hermesApiKey: string, company: Company, admin: SupaClient, config: HermesConfig, roleSettings: AgentRoleSettings): Promise<OrchestratorDecision> {
  const routineNotes: string[] = []
  if (roleSettings.routines.detect_crises !== false) routineNotes.push('Preste atenção especial a sinais de crise: reputação caindo rápido, avaliação muito negativa recente, canal fora do ar.')
  if (roleSettings.routines.find_opportunities !== false) routineNotes.push('Procure ativamente oportunidades novas de receita, não só problemas existentes.')
  if (roleSettings.routines.review_agent_work !== false) routineNotes.push('Revise o que os agentes já fizeram recentemente (get_business_overview, list_posts) antes de decidir — evite mandar fazer de novo o que já foi feito.')

  const integrations = await getConnectedIntegrations(admin, company.id)
  const systemPrompt = `${composeHermesPreamble(config, roleSettings.approvals, integrations)}

Você é o Hermes, orquestrador central de "${company.business_name}" (${company.business_type ?? 'negócio'} em ${company.city ?? 'Brasil'}).
Sua única função aqui é decidir se o Agente Geral precisa agir agora — você NUNCA cria posts, leads ou mensagens você mesmo nesta etapa, só decide.

Comece SEMPRE por get_data_agent_signals com kind "delta" — ele já cruza os dados e te entrega os sinais que mudaram desde a última vez (rascunhos parados, dias sem postar, gap de reputação vs. concorrentes, o que já foi tentado), com evidência e confiança. Só depois, se precisar de mais detalhe de uma área específica, use as outras ferramentas de leitura. Olhe o negócio inteiro antes de decidir, não só uma parte: conteúdo, reputação, concorrência, diagnóstico do site e atendimento.
${routineNotes.length ? '\n' + routineNotes.map(n => `- ${n}`).join('\n') + '\n' : ''}
Ao terminar de investigar, você DEVE chamar report_decision — é a única forma de encerrar.`

  const messages: unknown[] = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: 'Analise o negócio inteiro — conteúdo, reputação, concorrência, diagnóstico do site e atendimento — e decida se o Agente Geral deve agir agora.' },
  ]

  let tokensUsed = 0

  for (let i = 0; i < 5; i++) {
    const res = await fetch(`${hermesUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${hermesApiKey}` },
      body: JSON.stringify({ model: 'hermes', messages, tools: ORCHESTRATOR_TOOLS, tool_choice: 'auto' }),
    })
    if (!res.ok) throw new Error(`Hermes orquestrador retornou erro ${res.status}`)

    const data = await res.json() as { choices?: { message?: { content?: string; tool_calls?: { id: string; function: { name: string; arguments: string } }[] } }[]; usage?: { total_tokens?: number } }
    tokensUsed += data.usage?.total_tokens ?? 0
    const msg = data.choices?.[0]?.message

    if (!msg?.tool_calls?.length) {
      // Answered in free text instead of calling report_decision — fail safe,
      // never fall back to "run everything" just because parsing failed.
      return { run_marketing: false, reasoning: 'Orquestrador não retornou uma decisão estruturada.', tokensUsed }
    }

    const decisionCall = msg.tool_calls.find(tc => tc.function.name === 'report_decision')
    if (decisionCall) {
      try {
        const args = JSON.parse(decisionCall.function.arguments ?? '{}')
        return { run_marketing: !!args.run_marketing, reasoning: String(args.reasoning ?? ''), tokensUsed }
      } catch {
        return { run_marketing: false, reasoning: 'Falha ao interpretar a decisão do orquestrador.', tokensUsed }
      }
    }

    // It called a read-only tool to gather context — execute and keep going.
    // Reuses the same tool implementations as the Agente Geral (passing
    // 'marketing', which has the full read-only set) rather than duplicating
    // the same read queries a second time.
    messages.push({ role: 'assistant', content: null, tool_calls: msg.tool_calls })
    for (const tc of msg.tool_calls) {
      let input: unknown = {}
      try { input = JSON.parse(tc.function.arguments ?? '{}') } catch { /* ignore */ }
      const { result } = await runTool({ name: tc.function.name, id: tc.id, input }, company.id, 'marketing', admin)
      messages.push({ role: 'tool', tool_call_id: tc.id, content: result })
    }
  }

  return { run_marketing: false, reasoning: 'Orquestrador não decidiu a tempo.', tokensUsed }
}

// Estimativa aproximada de custo — NÃO é a fatura real da Anthropic. O
// modelo que o Hermes usa de verdade roda numa VPS externa (HERMES_URL),
// fora do nosso controle de billing direto; isso só existe pra dar ao owner
// uma referência de "quanto isso está custando", comparável ao limite que
// ele mesmo configurou no Hermes Control Center.
const ESTIMATED_COST_PER_1K_TOKENS = 0.006

// Limite diário passou a ser POR AGENTE (ver AgentRoleSettings) — cada papel
// tem o próprio teto, então a query também filtra por agent_role. Sem role
// (usado só pelo teto de "hermes", o orquestrador em si), conta tudo.
async function getTodayUsage(admin: SupaClient, role?: AgentRole): Promise<{ calls: number; estimatedCostUsd: number }> {
  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)
  let q = admin.from('agent_performance')
    .select('tokens_used', { count: 'exact' })
    .gte('created_at', todayStart.toISOString())
  if (role) q = q.eq('agent_role', role)
  const { data, count } = await q
  const totalTokens = (data ?? []).reduce((s, r) => s + (Number(r.tokens_used) || 0), 0)
  return { calls: count ?? 0, estimatedCostUsd: (totalTokens / 1000) * ESTIMATED_COST_PER_1K_TOKENS }
}

// ── Shared chat turn (used by both the interactive/JWT path and Telegram) ──
// Quota check + reset, run the conversation, persist everything. The two
// callers only differ in how they found `company` and what they do with the
// reply afterwards (return JSON vs. also push it to Telegram).
interface ChatTurnResult {
  reply: string; postsCreated: number
  rateLimited: boolean; plan: string; limit: number; usedThisMonth: number
}

async function runChatTurn(
  admin: SupaClient, hermesUrl: string, hermesApiKey: string,
  company: Company, agentRole: AgentRole, message: string, history: { role: string; content: string }[], config: HermesConfig, lang?: string, authHeader?: string,
): Promise<ChatTurnResult> {
  const resetAt = new Date(company.agent_messages_reset_at ?? 0)
  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
  let usedThisMonth = company.agent_messages_used ?? 0
  if (resetAt < monthStart) {
    await admin.from('companies').update({ agent_messages_used: 0, agent_messages_reset_at: monthStart.toISOString() }).eq('id', company.id)
    usedThisMonth = 0
  }
  const plan = company.plan ?? 'free'
  const limit = PLAN_LIMITS[plan] ?? PLAN_LIMITS.free
  if (limit - usedThisMonth <= 0) {
    return { reply: '', postsCreated: 0, rateLimited: true, plan, limit, usedThisMonth }
  }

  const integrations = await getConnectedIntegrations(admin, company.id)
  const roleSettings = await getAgentRoleSettings(admin, agentRole)
  const systemPrompt = buildSystemPrompt(agentRole, company, config, roleSettings, integrations) + (lang === 'en' ? '\n\nLANGUAGE: The user communicates in English. Respond in English only.' : '')
  const historyMessages = history.map(m => ({ role: m.role, content: m.content }))
  const messages: unknown[] = [
    { role: 'system', content: systemPrompt },
    ...historyMessages,
    { role: 'user', content: message },
  ]

  await admin.from('agent_messages').insert({ company_id: company.id, role: 'user', content: message, agent_role: agentRole })

  let reply: string, postsCreated: number, tokensUsed: number
  try {
    // Chat interativo/Telegram nunca passa autonomousConfig — o dono pediu
    // na hora, então as restrições de rotina (criação automática, memória)
    // não se aplicam aqui, só no ciclo sem ninguém pedir nada. authHeader só
    // existe no chat interativo de verdade — é o que libera as capacidades
    // do Capability Registry (Telegram não tem sessão de usuário).
    const result = await runConversation(hermesUrl, hermesApiKey, agentRole, company, admin, messages, undefined, authHeader)
    reply = result.reply
    postsCreated = result.postsCreated
    tokensUsed = result.tokensUsed
  } catch (err) {
    await admin.from('agent_messages').insert({ company_id: company.id, role: 'assistant', content: 'Nao consegui processar sua mensagem agora. Tente novamente em instantes.', agent_role: agentRole })
    throw err
  }

  await admin.from('agent_messages').insert({ company_id: company.id, role: 'assistant', content: reply, agent_role: agentRole })
  await Promise.all([
    admin.from('companies').update({ agent_messages_used: usedThisMonth + 1 }).eq('id', company.id),
    admin.from('agent_performance').insert({ company_id: company.id, agent_role: agentRole, latency_ms: 0, tokens_used: tokensUsed, success: true, task_description: message.length > 120 ? message.slice(0, 120) + '...' : message }),
  ])

  return { reply, postsCreated, rateLimited: false, plan, limit, usedThisMonth: usedThisMonth + 1 }
}

async function sendTelegramMessage(token: string, chatId: number, text: string): Promise<void> {
  const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text }),
  })
  if (!res.ok) console.error('Telegram sendMessage failed:', res.status, await res.text().catch(() => ''))
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? anonKey
    const hermesUrl = Deno.env.get('HERMES_URL')
    const hermesApiKey = Deno.env.get('HERMES_API_KEY') ?? ''
    const cronSecretEnv = Deno.env.get('CRON_SECRET')
    const telegramWebhookSecretEnv = Deno.env.get('TELEGRAM_WEBHOOK_SECRET')
    const telegramBotToken = Deno.env.get('TELEGRAM_BOT_TOKEN') ?? ''

    if (!hermesUrl) return json({ error: 'HERMES_URL nao configurado nos secrets do Supabase.' }, 500)

    const admin = createClient(supabaseUrl, serviceKey)
    const body = await req.json().catch(() => ({})) as Record<string, unknown>
    const isCron = cronSecretEnv && body.cron_secret === cronSecretEnv

    // ── Modo autônomo (substitui run-agents) ──────────────────────
    if (isCron) {
      const config = await getHermesConfig(admin)
      // Rotinas/limites são por agente agora — hoje só existe o Agente Geral
      // ('marketing'), então é a única config que decide o ciclo inteiro. Se
      // um 2º papel for ativado no futuro, este é o ponto certo pra buscar
      // as settings dele também e decidir por papel, não globalmente.
      const marketingSettings = await getAgentRoleSettings(admin, 'marketing')

      // Rotina "Revisão diária" desligada no Agente Geral — não roda o ciclo hoje.
      if (marketingSettings.routines.daily_review === false) {
        return json({ ok: true, cron: true, processed: 0, skipped: true, reason: 'Rotina "Revisão diária" está desligada pro Agente Geral no Agents Control Center.' })
      }

      let usage = await getTodayUsage(admin, 'marketing')
      if (usage.calls >= marketingSettings.max_claude_calls_daily || usage.estimatedCostUsd >= marketingSettings.max_daily_cost_usd) {
        return json({
          ok: true, cron: true, processed: 0, skipped: true,
          reason: `Limite diário do Agente Geral já atingido (chamadas: ${usage.calls}/${marketingSettings.max_claude_calls_daily}, custo estimado: $${usage.estimatedCostUsd.toFixed(2)}/${marketingSettings.max_daily_cost_usd}).`,
        })
      }

      const { data: companies } = await admin
        .from('companies')
        .select('id, business_name, business_type, city, goal, social_data, telegram_chat_id, notification_prefs')
        .eq('active', true)

      const activeRoles = await getActiveAgentRoles(admin)

      const results: { company_id: string; role: AgentRole | null; skipped: boolean; posts_created: number; error?: string; reasoning?: string }[] = []
      for (const company of (companies ?? []) as Company[]) {
        // Reconfere o limite a cada empresa — mais simples e confiável do que
        // ir somando token a mão, e o custo de mais uma query é desprizível
        // perto do tanto de chamadas de IA que cada ciclo já faz.
        usage = await getTodayUsage(admin, 'marketing')
        if (usage.calls >= marketingSettings.max_claude_calls_daily || usage.estimatedCostUsd >= marketingSettings.max_daily_cost_usd) {
          results.push({ company_id: company.id, role: null, skipped: true, posts_created: 0, reasoning: 'Limite diário do Agente Geral atingido durante o ciclo.' })
          continue
        }

        let decision: OrchestratorDecision
        try {
          decision = await decideRolesToRun(hermesUrl, hermesApiKey, company, admin, config, marketingSettings)
        } catch (err) {
          // Fail safe: if the orchestrator itself couldn't be reached, skip
          // this company entirely rather than falling back to running both
          // agents blindly — that fallback is exactly the old bug.
          console.error(`orchestrator decision error for ${company.id}:`, err)
          results.push({ company_id: company.id, role: null, skipped: true, posts_created: 0, error: String(err) })
          continue
        }

        await admin.from('agent_performance').insert({
          company_id: company.id, agent_role: 'hermes', task_key: 'orchestrator_decision',
          task_description: decision.reasoning.slice(0, 200), latency_ms: 0, tokens_used: decision.tokensUsed, success: true,
        }).catch(() => { /* non-fatal */ })

        // max_active_agents limita quantos agentes rodam por ciclo — hoje só
        // existe o Agente Geral, mas isso já deixa pronto pro dia que existir
        // um 2º papel de novo.
        const rolesToRun = (decision.run_marketing ? ['marketing' as const] : [])
          .filter(role => activeRoles.has(role))
          .slice(0, Math.max(1, config.max_active_agents))

        if (rolesToRun.length === 0) {
          results.push({ company_id: company.id, role: null, skipped: true, posts_created: 0, reasoning: decision.reasoning })
          continue
        }
        for (const role of rolesToRun) {
          const r = await runAutonomousCycle(admin, hermesUrl, hermesApiKey, company, role, config, marketingSettings)
          results.push({ company_id: company.id, role, reasoning: decision.reasoning, skipped: r.skipped, posts_created: r.posts_created, error: r.error })
        }
      }
      const totalPosts = results.reduce((s, r) => s + r.posts_created, 0)
      const skipped = results.filter(r => r.skipped).length
      return json({ ok: true, cron: true, processed: companies?.length ?? 0, total_posts_created: totalPosts, skipped, results })
    }

    // ── Modo Telegram ───────────────────────────────────────
    // Same brain as the dashboard chat, just authenticated with the shared
    // webhook secret (like telegram-chat/telegram-connect) instead of a user
    // JWT, since Telegram has no Supabase session — the company is found by
    // telegram_chat_id instead of user_id.
    const webhookSecretHeader = req.headers.get('x-webhook-secret')
    const isTelegram = !!body.chat_id && telegramWebhookSecretEnv && webhookSecretHeader === telegramWebhookSecretEnv
    if (isTelegram) {
      const chatId = Number(body.chat_id)
      const message = String(body.message ?? '')
      const agentRole: AgentRole = (body.agent_role as AgentRole) ?? 'marketing'
      const telegramActiveRoles = await getActiveAgentRoles(admin)
      if (!message || !AGENT_ROLES[agentRole] || !telegramActiveRoles.has(agentRole) || !telegramBotToken) return json({ ok: true })

      const { data: company } = await admin
        .from('companies')
        .select('id, business_name, business_type, city, instagram_url, goal, plan, social_data, google_rating, google_review_count, agent_messages_used, agent_messages_reset_at')
        .eq('telegram_chat_id', chatId)
        .maybeSingle()

      if (!company) {
        await sendTelegramMessage(telegramBotToken, chatId, 'Para usar o chat, primeiro conecte sua conta com /conectar CÓDIGO.')
        return json({ ok: true })
      }

      try {
        const config = await getHermesConfig(admin)
        const result = await runChatTurn(admin, hermesUrl, hermesApiKey, company as Company, agentRole, message, [], config)
        if (result.rateLimited) {
          await sendTelegramMessage(telegramBotToken, chatId, `⚠️ Você atingiu o limite de ${result.limit} mensagens do plano este mês. Faça upgrade para o plano Pro para continuar sem limites.`)
        } else {
          await sendTelegramMessage(telegramBotToken, chatId, result.reply)
        }
      } catch (err) {
        console.error('hermes-proxy telegram error:', err)
        await sendTelegramMessage(telegramBotToken, chatId, 'Não consegui processar sua mensagem agora. Tente novamente em instantes.')
      }
      return json({ ok: true })
    }

    // ── Modo interativo (chat/voz) ────────────────────────────
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return json({ error: 'Unauthorized' }, 401)

    const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } })
    const { data: { user }, error: userErr } = await userClient.auth.getUser()
    if (userErr || !user) return json({ error: 'Unauthorized' }, 401)

    const { message, history, lang } = body as { message?: string; history?: { role: string; content: string }[]; lang?: string }
    if (!message) return json({ error: 'message e obrigatorio' }, 400)
    const agentRole: AgentRole = (body.agent_role as AgentRole) ?? 'marketing'
    if (!AGENT_ROLES[agentRole]) return json({ error: 'agent_role invalido' }, 400)
    const chatActiveRoles = await getActiveAgentRoles(admin)
    if (!chatActiveRoles.has(agentRole)) return json({ error: 'O Agente Geral está desativado no Agents Control Center.' }, 403)

    const { data: company } = await admin
      .from('companies')
      .select('id, business_name, business_type, city, instagram_url, goal, plan, social_data, google_rating, google_review_count, agent_messages_used, agent_messages_reset_at')
      .eq('user_id', user.id)
      .maybeSingle()

    if (!company) return json({ error: 'Empresa nao encontrada. Complete o onboarding primeiro.' }, 404)

    const config = await getHermesConfig(admin)
    let result: ChatTurnResult
    try {
      result = await runChatTurn(admin, hermesUrl, hermesApiKey, company as Company, agentRole, message, history ?? [], config, lang, authHeader)
    } catch (err) {
      return json({ error: String(err) }, 502)
    }

    if (result.rateLimited) return json({ error: 'rate_limit', plan: result.plan, limit: result.limit, used: result.usedThisMonth, remaining: 0 }, 429)

    return json({
      ok: true, reply: result.reply, postsCreated: result.postsCreated,
      agent: { role: agentRole, name: AGENT_ROLES[agentRole].name, emoji: AGENT_ROLES[agentRole].emoji },
      usage: { used: result.usedThisMonth, limit: result.limit, remaining: result.limit - result.usedThisMonth },
    })
  } catch (err) {
    console.error('hermes-proxy error:', err)
    return json({ error: String(err) }, 500)
  }
})

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { ...cors, 'Content-Type': 'application/json' } })
}
