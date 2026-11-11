// Os 5 componentes do fluxo do Growth OS (textos dos cartões). Saiu do hub (MarketingAiHubPage) na aba Agentes (C.2, 2026-11-07)
// pra que a tela Agentes e o hub leiam do mesmo lugar. 1 Inteligência de Mercado (observa) → 2 Motor de Oportunidades (prioriza)
// → 3 Estratégia (direciona) → 4 Ativação (produz) → 5 Resultados e Aprendizado (mede e volta pra estratégia).
// As seções (dados / estrategia / content / conversao) são as mesmas de antes; a 2 abre a tela Oportunidades.
import type { AgentKey } from './HubAgentCards'

export interface ModuleDef { section: string; title: string; desc: string; icon: string; path?: string }

export const AGENT_ORDER: AgentKey[] = ['data', 'opportunities', 'strategy', 'content', 'conversion']

export const MODULES: Record<'pt' | 'en', Record<AgentKey, ModuleDef>> = {
  pt: {
    data: { section: 'dados', title: 'Inteligência de Mercado', desc: 'Coleta os sinais do mercado sozinho, todo dia: notícias, lançamentos, obras e turismo dos bairros dos seus imóveis e da cidade, sempre com a fonte e a data (aba Insights e evidências). Também: concorrentes e tendências do Instagram, lugares perto e dicas conferidas. Para cadastrar um imóvel: botão + laranja → Adicionar imóvel.', icon: '📊' },
    opportunities: { section: '', path: '/dashboard/opportunities', title: 'Motor de Oportunidades', desc: 'Cruza o mercado com os seus dados e aponta onde há negócio: imóvel sem divulgação, procura sem resposta, mudança no bairro. Roda sozinho; você aprova ou descarta.', icon: '💡' },
    strategy: { section: 'estrategia', title: 'Agente de Estratégia', desc: 'Define público, oferta, mensagem e ação comercial: a estratégia da conta e o plano de cada oportunidade aprovada — e direciona a Ativação.', icon: '🧭' },
    content: { section: 'content', title: 'Ativação', desc: 'Produz o que vai para a rua: calendário da semana (feed e stories) vindo da estratégia, peças das oportunidades, a página do imóvel com link rastreável e as conversas (atendimento e respostas a comentários/DMs). Nada sai sem a sua aprovação.', icon: '✍️' },
    conversion: { section: 'conversao', title: 'Resultados e Aprendizado', desc: 'Mede e aprende: funil de vendas (leads, visitas e vendas, com a origem e o corretor de cada lead), desempenho dos posts, a memória do que funcionou, experimentos e relatórios. O que funcionou volta para a próxima estratégia.', icon: '🔀' },
  },
  en: {
    data: { section: 'dados', title: 'Market Intelligence', desc: 'Collects market signals on its own, every day: news, launches, works and tourism in your listings\' neighborhoods and the city, always with source and date (Insights and evidence tab). Also: competitors and Instagram trends, nearby places and verified tips. To add a listing: orange + button → Add listing.', icon: '📊' },
    opportunities: { section: '', path: '/dashboard/opportunities', title: 'Opportunity Engine', desc: 'Crosses the market with your data and points to where the business is: unpromoted listings, unanswered demand, neighborhood changes. Runs on its own; you approve or dismiss.', icon: '💡' },
    strategy: { section: 'estrategia', title: 'Strategy Agent', desc: 'Sets audience, offer, message and sales action: the account strategy and the plan for each approved opportunity — and guides Activation.', icon: '🧭' },
    content: { section: 'content', title: 'Activation', desc: 'Produces what goes out: the weekly calendar (feed and stories) from the strategy, opportunity pieces, the listing page with a tracked link and conversations (customer service and comment/DM replies). Nothing goes out without your approval.', icon: '✍️' },
    conversion: { section: 'conversao', title: 'Results & Learning', desc: 'Measures and learns: sales pipeline (leads, visits and sales, with each lead\'s source and assigned agent), post performance, the memory of what worked, experiments and reports. What worked feeds the next strategy.', icon: '🔀' },
  },
}

export const BADGES = {
  pt: { data: '1 · Observa', opportunities: '2 · Prioriza', strategy: '3 · Direciona', content: '4 · Ativa', conversion: '5 · Mede e aprende' },
  en: { data: '1 · Observes', opportunities: '2 · Prioritizes', strategy: '3 · Directs', content: '4 · Activates', conversion: '5 · Measures & learns' },
} as const

export const modulePath = (m: ModuleDef) => m.path ?? `/dashboard/marketing-ai/${m.section}`
