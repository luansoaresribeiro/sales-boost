// Guard central do "modo vitrine" (decisão do dono 2026-10-13, docs/DECISIONS.md).
//
// Conta nova que ainda não pagou navega por TODO o painel, mas em "somente
// visualização": nada que gasta IA/provedor pago, publica ou envia pode rodar. A
// regra de verdade fica no SERVIDOR (supabase/functions/_shared/access.ts → 402
// `plan_required`); este arquivo é só a camada de tela — em vez de deixar o
// servidor responder erro, a gente nem chama e abre o modal "Disponível no plano".
//
// Como funciona: enquanto o ShowcaseProvider está montado em modo somente
// leitura, `installShowcaseGuard` embrulha o `window.fetch`. É UM ponto só pra
// todas as telas (as chamadas `fetch(.../functions/v1/...)`, o
// `supabase.functions.invoke` e as escritas diretas do supabase client passam
// por ele). NÃO intercepta cliques e NUNCA bloqueia navegação, abas ou links.
//
// Mantenha PAID_FUNCTIONS espelhado com as functions que chamam `requirePaidAccess`.
// Fica de FORA de propósito (liberado em vitrine): editar dados/ficha da empresa
// (tabela `companies`, business_context…), conectar Instagram (oauth), o kit grátis
// e o pagamento (trial-video, diagnosis-gift, claim-diagnostic, create-checkout),
// notificações/Telegram e configurações de conta.

// null = bloqueia a function inteira; lista = só essas `action` (ou o teste do corpo).
type Rule = null | { actions?: string[]; bodyFlag?: string }

const PAID_FUNCTIONS: Record<string, Rule> = {
  'creative-generate': null,
  'strategy-generate': { actions: ['generate', 'reanalyze', 'refresh'] },
  'content-engine': null,
  'generate-posts': null,
  'content-image': { actions: ['generate', 'variations'] },
  'generate-video': null,
  'item-videos': { actions: ['create'] },
  'brand-compose': null,
  // desenhar o card não custa nada (o kit grátis usa); só o fundo gerado por IA
  'render-format': { bodyFlag: 'generate_bg' },
  'format-fill': null,
  'content-test': { actions: ['generate', 'score', 'regenerate'] },
  'catalog-package': null,
  'marketing-ai': null,
  'agent-actions': { actions: ['propose', 'approve', 'retry'] },
  'publish-instagram': null,
  'send-message': null,
  'draft-reply': null,
  'reply-google-review': null,
  'creative-ideas': null,
  'map-competitors': null,
  'detect-opportunities': null,
  'agent-chat': null,
  'generate-tab-insight': null,
  'content-intelligence': null,
  'generate-report': null,
  'adapt-plan': null,
  'brand-kit-suggest': null,
}

// Escritas diretas (supabase client → /rest/v1/<tabela>) que continuam livres:
// dados/ficha da empresa, conexões, contexto do negócio, métricas de uso e
// também catálogo (imóveis/fotos) e Kit da Marca — preencher isso não gasta
// nada e é o que a pendência "fotos" do sino pede (QA 2026-10-13).
const ALLOWED_WRITE_TABLES = new Set([
  'companies', 'company_integrations', 'company_meta_pages', 'business_context',
  'client_activity', 'progress_events', 'marketing_ai_tool_interest',
  'marketing_ai_knowledge', 'brand_dna', 'marketing_ai_config',
])

export const PLAN_REQUIRED = { error: 'Disponível no plano', code: 'plan_required' } as const

function readBody(body: BodyInit | null | undefined): Record<string, unknown> {
  if (typeof body !== 'string') return {}
  try { const j = JSON.parse(body); return j && typeof j === 'object' ? j as Record<string, unknown> : {} } catch { return {} }
}

// true = em vitrine essa chamada NÃO deve rodar. Só olha chamadas ao nosso Supabase.
export function shouldBlock(url: string, method: string, body: BodyInit | null | undefined, supabaseUrl: string): boolean {
  if (!supabaseUrl || !url.startsWith(supabaseUrl)) return false
  const path = url.slice(supabaseUrl.length)
  const fn = path.match(/^\/functions\/v1\/([a-z0-9-]+)/)
  if (fn) {
    if (!(fn[1] in PAID_FUNCTIONS)) return false
    const rule = PAID_FUNCTIONS[fn[1]]
    if (rule === null) return true
    const b = readBody(body)
    if (rule.actions) return rule.actions.includes(String(b.action ?? ''))
    if (rule.bodyFlag) return !!b[rule.bodyFlag]
    return false
  }
  const rest = path.match(/^\/rest\/v1\/([a-z0-9_]+)/)
  if (rest && rest[1] !== 'rpc') {
    if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') return false
    return !ALLOWED_WRITE_TABLES.has(rest[1])
  }
  return false
}

// Embrulha o fetch. Devolve a função que desfaz (volta o fetch original).
// `onBlocked` abre o modal. Também reage a um 402/plan_required que vier do servidor.
export function installShowcaseGuard(onBlocked: () => void): () => void {
  const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL as string | undefined) ?? ''
  const original = window.fetch
  const guarded: typeof window.fetch = async (input, init) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
    const method = (init?.method ?? (input instanceof Request ? input.method : 'GET')).toUpperCase()
    if (shouldBlock(url, method, init?.body, supabaseUrl)) {
      onBlocked()
      return new Response(JSON.stringify(PLAN_REQUIRED), { status: 402, headers: { 'Content-Type': 'application/json' } })
    }
    const res = await original.call(window, input, init)
    if (res.status === 402 && supabaseUrl && url.startsWith(`${supabaseUrl}/functions/v1/`)) {
      try { if ((await res.clone().json())?.code === 'plan_required') onBlocked() } catch { /* corpo que não é JSON: ignora */ }
    }
    return res
  }
  window.fetch = guarded
  return () => { if (window.fetch === guarded) window.fetch = original }
}
