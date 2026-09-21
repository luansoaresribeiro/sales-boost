/**
 * Sales Boost — Data Agent: canonical domain schema
 * ==================================================
 *
 * This is the SEMANTIC layer, not a new data store. The existing collectors
 * and tables (Apify, GSC, reviews, competitors, marketing_ai_*, diagnostics,
 * leads, …) stay exactly as they are and remain the raw intelligence
 * infrastructure. This file maps that raw infrastructure into 9 intelligence
 * domains and, per domain, declares:
 *
 *   1. belongs         — what data conceptually belongs here
 *   2. tables          — which existing tables provide it
 *   3. apis            — which collectors / edge functions / external APIs feed it
 *   4. metrics         — what is calculated (and whether it's available yet)
 *   5. history         — what historical information is retained, and where
 *   6. gaps            — what is missing today
 *   7. signals         — the derived, machine-readable signals Hermes consumes
 *   8. hermesConsumes  — what Hermes is allowed to read (signals + summary,
 *                        never the 14 raw tables directly)
 *
 * Two hard rules this schema exists to enforce:
 *
 *   • Data Agent ≠ Data Dashboard. The dashboard renders cards and charts for
 *     the owner; the Data Agent maintains a deeper machine-readable model that
 *     may never surface in the UI. `signals` is that machine-readable model.
 *
 *   • Hermes gets SIGNALS, not raw tables. It asks the Data Agent three
 *     questions (see DataAgentQuery) and receives normalized answers with
 *     evidence and confidence — it does not go hunting through Postgres.
 *
 * The Data Agent is the persistent intelligence layer that maintains a live
 * model of the client's business, customers, market, competition, digital
 * presence, content, history, resources, and performance.
 */

export type DomainKey =
  | 'business'
  | 'customer'
  | 'market'
  | 'competition'
  | 'digital'
  | 'content'
  | 'history'
  | 'resources'
  | 'performance'

/** How much real data backs a domain today. Drives honest UI empty-states. */
export type Maturity = 'rich' | 'partial' | 'empty'
export type Confidence = 'high' | 'medium' | 'low'

/**
 * The three questions Hermes is allowed to ask the Data Agent. Everything the
 * layer exposes answers one of these — this is the whole external contract.
 */
export type DataAgentQuery =
  | { kind: 'state'; domain?: DomainKey }            // "What is the current state?"
  | { kind: 'delta'; since: string; domain?: DomainKey } // "What changed since our last decision?"
  | { kind: 'evidence'; signalKey: string }          // "What evidence supports that?"

/**
 * Canonical shape of a signal record. This is what makes a signal richer than
 * a table row: it carries evidence, confidence and business relevance, so
 * Hermes can reason instead of re-deriving. Every emitted signal conforms.
 */
export interface SignalRecord {
  key: string                 // matches DomainSignal.key
  domain: DomainKey
  subject_id: string | null   // e.g. competitor_id, lead_id, post_id — null if company-wide
  event_type: string          // e.g. 'price_decrease', 'posting_frequency_up'
  observed_at: string         // ISO timestamp
  old_value: unknown | null
  new_value: unknown | null
  evidence: string[]          // pointers to raw rows/urls that justify the signal
  confidence: Confidence
  business_relevance: 'high' | 'medium' | 'low'
}

/** A signal DEFINITION — how a signal is derived and what fields it emits. */
export interface DomainSignal {
  key: string
  label: string
  description: string
  derivedFrom: string[]       // tables / functions the derivation reads
  emits: string[]             // notable fields on the SignalRecord for this signal
}

export interface DomainMetric {
  key: string
  label: string
  source: string              // table.column or function that produces it
  available: boolean          // false ⇒ gated on data we don't collect yet
}

export interface DomainDef {
  key: DomainKey
  title: string
  /** The single question this domain answers about the company. */
  question: string
  belongs: string[]
  tables: string[]
  apis: string[]
  metrics: DomainMetric[]
  history: string
  gaps: string[]
  signals: DomainSignal[]
  hermesConsumes: string[]
  maturity: Maturity
}

export const DOMAINS: Record<DomainKey, DomainDef> = {
  // ─────────────────────────────────────────────────────────────────────────
  business: {
    key: 'business',
    title: 'Business',
    question: 'O que esta empresa é e como ela ganha dinheiro?',
    belongs: [
      'Modelo de negócio, produtos/serviços, ofertas, preços',
      'Localizações, geografia-alvo, capacidade',
      'Posicionamento, marca, proposta de valor',
      'Objetivos e restrições do negócio, processo de vendas',
    ],
    tables: ['companies (business_dna, business_type, city, goal, plan)', 'marketing_ai_config (business_objectives, marketing_goals)'],
    apis: ['Onboarding / ficha da empresa (captura manual do dono)'],
    metrics: [
      { key: 'profile_completeness', label: 'Completude do perfil (business_dna)', source: 'companies.business_dna', available: true },
      { key: 'margin_headroom', label: 'Folga de margem p/ competir em preço', source: '—', available: false },
    ],
    history: 'Versões do business_dna ao longo do tempo (hoje sobrescrito — falta versionamento).',
    gaps: ['Preços e ofertas estruturados', 'Economia unitária / margens', 'Processo de vendas e capacidade', 'Equipe'],
    signals: [
      { key: 'positioning_defined', label: 'Posicionamento definido', description: 'Marca/proposta de valor preenchidos e coerentes.', derivedFrom: ['companies.business_dna', 'marketing_ai_config'], emits: ['new_value', 'confidence'] },
      { key: 'cannot_match_price', label: 'Restrição de margem', description: 'Negócio não sustenta guerra de preço — insumo crítico p/ estratégia.', derivedFrom: ['companies.business_dna'], emits: ['business_relevance'] },
    ],
    hermesConsumes: ['positioning summary', 'guardrails (o que a empresa nunca faz)', 'objetivos e restrições'],
    maturity: 'partial',
  },

  // ─────────────────────────────────────────────────────────────────────────
  customer: {
    key: 'customer',
    title: 'Customer',
    question: 'Quem gera valor para a empresa, e por que compra?',
    belongs: [
      'Segmentos, demografia, geografia',
      'Dores, objeções, perguntas, linguagem do cliente',
      'Gatilhos de compra e motivos de escolha / de abandono',
      'Histórico de compra, AOV, LTV, frequência, churn (quando houver)',
    ],
    tables: ['reviews (text, sentiment, themes, rating)', 'leads (stage, channel, value_estimate)', 'lead_messages (direction, content)', 'companies.social_data'],
    apis: ['analyze-reviews', 'import-reviews', 'apify-sync (reviews)', 'find-sales-leads', 'detect-opportunities'],
    metrics: [
      { key: 'sentiment_mix', label: 'Distribuição de sentimento', source: 'reviews.sentiment', available: true },
      { key: 'top_themes', label: 'Temas mais citados', source: 'reviews.themes', available: true },
      { key: 'ltv', label: 'LTV / AOV / frequência', source: '—', available: false },
    ],
    history: 'Reviews com review_date; leads com last_contact_at. Sem histórico transacional.',
    gaps: ['Dados transacionais (POS/CRM): AOV, LTV, frequência, churn', 'Fontes reais de aquisição de cliente'],
    signals: [
      { key: 'recurring_objection', label: 'Objeção recorrente', description: 'Tema negativo repetido nos reviews (ex.: "caro").', derivedFrom: ['reviews.themes', 'reviews.sentiment'], emits: ['event_type', 'evidence', 'business_relevance'] },
      { key: 'praise_theme', label: 'Ponto forte percebido', description: 'O que clientes elogiam — prova social para conteúdo.', derivedFrom: ['reviews.themes'], emits: ['new_value', 'evidence'] },
      { key: 'unanswered_leads', label: 'Leads sem resposta', description: 'Leads parados além do SLA.', derivedFrom: ['leads.last_contact_at', 'lead_messages'], emits: ['subject_id', 'business_relevance'] },
    ],
    hermesConsumes: ['objeções e elogios recorrentes', 'linguagem do cliente', 'leads quentes sem resposta'],
    maturity: 'partial',
  },

  // ─────────────────────────────────────────────────────────────────────────
  market: {
    key: 'market',
    title: 'Market',
    question: 'O que está acontecendo no ambiente externo?',
    belongs: [
      'Tendências, demanda, sazonalidade, comportamento de consumo',
      'Categorias emergentes, tecnologia, regulação',
      'Oportunidades e riscos de mercado',
    ],
    tables: ['marketing_ai_trends (title, category, relevance, detected_at)'],
    apis: ['marketing-ai:run_trends', 'content-intelligence', 'monitor-web-mentions'],
    metrics: [
      { key: 'active_trends', label: 'Tendências relevantes ativas', source: 'marketing_ai_trends (relevance=high)', available: true },
      { key: 'market_size', label: 'Tamanho / crescimento de mercado', source: '—', available: false },
    ],
    history: 'marketing_ai_trends.detected_at dá uma linha do tempo de tendências.',
    gaps: ['Tamanho e crescimento de mercado', 'Search trends externos', 'Sazonalidade modelada', 'Sinais regulatórios'],
    signals: [
      { key: 'emerging_trend', label: 'Tendência emergente relevante', description: 'Tendência de alta relevância para o segmento.', derivedFrom: ['marketing_ai_trends'], emits: ['new_value', 'business_relevance', 'observed_at'] },
      { key: 'demand_shift', label: 'Mudança de demanda', description: 'Sinal de que a demanda mudou (ex.: mais sensível a preço).', derivedFrom: ['marketing_ai_trends', 'reviews.themes'], emits: ['event_type', 'evidence'] },
    ],
    hermesConsumes: ['tendências relevantes agora', 'mudanças de demanda/sazonalidade'],
    maturity: 'partial',
  },

  // ─────────────────────────────────────────────────────────────────────────
  competition: {
    key: 'competition',
    title: 'Competition',
    question: 'Quem mais disputa essa demanda, e como?',
    belongs: [
      'Concorrentes diretos/indiretos, novos entrantes, substitutos',
      'Preços, pacotes, descontos, promoções',
      'Posicionamento e mensagem dos concorrentes',
      'Presença de mercado, atividade social, reviews, sinais de anúncio',
      'Mudanças ao longo do tempo e benchmarks',
    ],
    tables: ['competitors (rating, review_count, distance_m, price_level)', 'marketing_ai_competitors (posting_frequency_days, avg_engagement, followers, hashtags_used)'],
    apis: ['map-competitors', 'monitor-competitor-social', 'find-place (Google Places)', 'marketing-ai:run_competitors'],
    metrics: [
      { key: 'rating_gap', label: 'Gap de nota vs. concorrentes', source: 'companies.google_rating − avg(competitors.rating)', available: true },
      { key: 'review_volume_gap', label: 'Gap de volume de reviews', source: 'companies.google_review_count vs competitors.review_count', available: true },
      { key: 'posting_cadence_gap', label: 'Gap de cadência de postagem', source: 'marketing_ai_competitors.posting_frequency_days', available: true },
      { key: 'ad_activity', label: 'Atividade de anúncios do concorrente', source: '—', available: false },
    ],
    history: 'competitors / marketing_ai_competitors.last_analyzed_at + brain_nodes(competitor_observation) formam a série temporal.',
    gaps: ['Substitutos e novos entrantes', 'Sinais de anúncio (Meta Ad Library)', 'Sinais de contratação/expansão', 'Análise de mensagem estruturada'],
    signals: [
      { key: 'pricing_gap', label: 'Gap de preço', description: 'Concorrente mudou preço/promoção vs. o nosso posicionamento.', derivedFrom: ['competitors.price_level', 'monitor-competitor-social'], emits: ['subject_id', 'event_type', 'old_value', 'new_value', 'evidence', 'confidence', 'business_relevance'] },
      { key: 'positioning_gap', label: 'Gap de posicionamento', description: 'Ângulo que nenhum concorrente ocupa e nós podemos.', derivedFrom: ['marketing_ai_competitors.notes'], emits: ['new_value', 'business_relevance'] },
      { key: 'content_gap', label: 'Gap de conteúdo', description: 'Formato/tema que os concorrentes exploram e nós não.', derivedFrom: ['marketing_ai_competitors.hashtags_used', 'monitor-competitor-social'], emits: ['new_value', 'evidence'] },
      { key: 'reputation_gap', label: 'Gap de reputação', description: 'Diferença de nota/volume de reviews.', derivedFrom: ['competitors.rating', 'competitors.review_count'], emits: ['old_value', 'new_value', 'business_relevance'] },
      { key: 'competitor_movement', label: 'Movimento de concorrente', description: 'Mudança notável (posts, oferta, nova unidade).', derivedFrom: ['monitor-competitor-social', 'marketing_ai_competitors.last_analyzed_at'], emits: ['subject_id', 'event_type', 'old_value', 'new_value', 'observed_at', 'evidence', 'confidence'] },
    ],
    hermesConsumes: ['os 6 gaps (preço, posicionamento, conteúdo, reputação, aquisição)', 'movimentos recentes de concorrentes', 'benchmarks do segmento'],
    maturity: 'rich',
  },

  // ─────────────────────────────────────────────────────────────────────────
  digital: {
    key: 'digital',
    title: 'Digital',
    question: 'Onde e como a empresa existe digitalmente, e como converte?',
    belongs: [
      'Site (saúde técnica, SEO, PageSpeed), redes (IG/FB/TikTok), GBP',
      'Canais: e-mail, WhatsApp, booking, tracking, pontos de conversão',
      'Funil digital: alcance → tráfego → leads → agendamentos → clientes → receita',
    ],
    tables: ['diagnostics (pagespeed_mobile/desktop, frontend_review)', 'companies (*_url, social_data)', 'marketing_ai_tracking_snapshots (followers, reach, impressions, engagement_rate)', 'instagram_posts'],
    apis: ['site-diagnosis / run-diagnosis', 'check-links-health', 'gsc-metrics (Search Console)', 'apify-sync', 'gbp/gsc/instagram OAuth callbacks', 'marketing-ai:run_tracking'],
    metrics: [
      { key: 'site_health', label: 'Saúde/SEO do site (a "aba performance" atual)', source: 'diagnostics.pagespeed_*', available: true },
      { key: 'channel_liveness', label: 'Canais no ar vs. quebrados', source: 'check-links-health', available: true },
      { key: 'reach', label: 'Alcance / impressões', source: 'marketing_ai_tracking_snapshots.avg_reach', available: true },
      { key: 'funnel_conversion', label: 'Conversão ponta-a-ponta do funil', source: '—', available: false },
    ],
    history: 'diagnostics.created_at (histórico de diagnósticos) + tracking_snapshots.collected_at (série de métricas).',
    gaps: ['Funil instrumentado ponta-a-ponta (tráfego→lead→cliente→receita)', 'Tracking de conversão real', 'Dados de e-mail/WhatsApp'],
    signals: [
      { key: 'site_regression', label: 'Regressão no site', description: 'Queda de PageSpeed ou review técnico piorou.', derivedFrom: ['diagnostics'], emits: ['old_value', 'new_value', 'observed_at', 'evidence'] },
      { key: 'broken_channel', label: 'Canal quebrado', description: 'Link/canal fora do ar (perda de aquisição).', derivedFrom: ['check-links-health'], emits: ['subject_id', 'event_type', 'business_relevance'] },
      { key: 'reach_trend', label: 'Tendência de alcance', description: 'Alcance/engajamento subindo ou caindo.', derivedFrom: ['marketing_ai_tracking_snapshots'], emits: ['old_value', 'new_value', 'confidence'] },
    ],
    hermesConsumes: ['saúde do site e canais no ar', 'tendência de alcance/engajamento', 'gargalos conhecidos do funil'],
    maturity: 'partial',
  },

  // ─────────────────────────────────────────────────────────────────────────
  content: {
    key: 'content',
    title: 'Content',
    question: 'O que a empresa comunica, e como a audiência responde?',
    belongs: [
      'Histórico, temas, formatos, hooks, CTAs, pilares de conteúdo',
      'Cadência, desempenho (reach/saves/shares/comentários), melhores e piores',
      'Gaps de conteúdo e conteúdo do concorrente',
      'Ligação conteúdo → resultado de negócio (não só views)',
    ],
    tables: ['marketing_ai_content (format, status, performance)', 'posts (content, platform, status, campaign_id)', 'marketing_ai_campaigns (goal, performance)', 'instagram_posts (likes_count, comments_count)'],
    apis: ['generate-posts', 'content-intelligence', 'marketing-ai:run_content / generate_content / run_trends'],
    metrics: [
      { key: 'pillar_coverage', label: 'Cobertura dos pilares de conteúdo', source: 'marketing_ai_content vs config.content_pillars', available: true },
      { key: 'top_content', label: 'Conteúdo de melhor desempenho', source: 'instagram_posts / marketing_ai_content.performance', available: true },
      { key: 'content_to_outcome', label: 'Conteúdo → visita/lead/venda', source: '—', available: false },
    ],
    history: 'posts / marketing_ai_content por created_at + performance(jsonb) capturado por post.',
    gaps: ['Atribuição conteúdo→resultado (visitas ao perfil, inquiries, leads)', 'Identidade visual estruturada (feed p/ RESOURCES/Riverflow)'],
    signals: [
      { key: 'no_content', label: 'Sem conteúdo recente', description: 'Sem post há 7+ dias (já existe como sinal no ciclo autônomo).', derivedFrom: ['posts.created_at'], emits: ['event_type', 'business_relevance'] },
      { key: 'stale_draft', label: 'Rascunhos parados', description: 'Pilha esperando aprovação — não gerar mais.', derivedFrom: ['posts.status', 'marketing_ai_content.status'], emits: ['old_value', 'business_relevance'] },
      { key: 'winning_format', label: 'Formato vencedor', description: 'Formato/tema que rende mais engajamento.', derivedFrom: ['instagram_posts', 'marketing_ai_content.performance'], emits: ['new_value', 'evidence', 'confidence'] },
    ],
    hermesConsumes: ['pilares descobertos', 'formato/tema vencedor', 'estado da fila (no_content / stale_draft)'],
    maturity: 'rich',
  },

  // ─────────────────────────────────────────────────────────────────────────
  history: {
    key: 'history',
    title: 'History',
    question: 'O que já aconteceu e o que já foi tentado?',
    belongs: [
      'Campanhas, conteúdos, ofertas, preços e estratégias anteriores',
      'Experimentos, resultados, sucessos e fracassos',
      'Decisões anteriores e condições de mercado da época',
      'Uma linha do tempo da empresa que evita redescobrir a mesma ideia',
    ],
    tables: ['marketing_ai_brain_nodes (successful/failed_strategy, pattern, learned_behavior)', 'marketing_ai_strategy_log (recommendation, status)', 'marketing_ai_experiments (hypothesis, winner, results)', 'marketing_ai_activity_log', 'agent_memory', 'agent_performance'],
    apis: ['marketing-ai:run_strategy / propose_experiment / run_experiment / conclude_experiment'],
    metrics: [
      { key: 'tried_before', label: 'Estratégias já tentadas', source: 'marketing_ai_brain_nodes(node_type in successful/failed_strategy)', available: true },
      { key: 'experiment_wins', label: 'Experimentos concluídos e vencedores', source: 'marketing_ai_experiments.winner', available: true },
    ],
    history: 'Este domínio É a memória: brain_nodes + strategy_log + experiments + activity_log já formam a linha do tempo. Trabalho principal = expor, não coletar.',
    gaps: ['Vincular decisões passadas ao resultado que produziram (loop de aprendizado explícito)'],
    signals: [
      { key: 'already_tried', label: 'Já tentamos isso', description: 'Estratégia proposta bate com uma passada (e como foi).', derivedFrom: ['marketing_ai_brain_nodes', 'marketing_ai_strategy_log'], emits: ['event_type', 'old_value', 'evidence', 'confidence'] },
      { key: 'failed_pattern', label: 'Padrão que falhou', description: 'Abordagem que já produziu resultado ruim (ex.: desconto → cliente ruim).', derivedFrom: ['marketing_ai_brain_nodes(failed_strategy)'], emits: ['new_value', 'business_relevance', 'evidence'] },
    ],
    hermesConsumes: ['o que já foi tentado e o resultado', 'padrões vencedores e perdedores', 'decisões anteriores + contexto'],
    maturity: 'rich',
  },

  // ─────────────────────────────────────────────────────────────────────────
  resources: {
    key: 'resources',
    title: 'Resources',
    question: 'O que a Sales Boost tem disponível para executar?',
    belongs: [
      'Marca: logo, cores, fontes, guidelines',
      'Criativos: fotos, vídeos, imagens de produto, depoimentos, UGC, ads existentes, templates',
      'Negócio: ofertas, produtos, scripts de venda, FAQs',
      'Digital: contas Meta/IG/Google, CRM, site, analytics',
      'Operacional: orçamento, equipe, capacidade',
      'IA: Riverflow, LLMs, ferramentas de vídeo, sistemas conectados',
    ],
    tables: ['marketing_ai_config (brand_assets jsonb, brand_colors)', 'marketing_ai_tool_registry (name, category, connected, status)', 'marketing_ai_tool_config (enabled, health, last_sync_at)'],
    apis: ['Integrações OAuth (gbp/gsc/instagram)', 'marketing_ai_tool_config health checks'],
    metrics: [
      { key: 'connected_tools', label: 'Ferramentas conectadas e saudáveis', source: 'marketing_ai_tool_config.health', available: true },
      { key: 'creative_inventory', label: 'Inventário de criativos disponíveis', source: 'marketing_ai_config.brand_assets', available: false },
    ],
    history: 'tool_config.last_sync_at (saúde das conexões). Sem histórico de uso de asset.',
    gaps: [
      'Biblioteca de criativos REAL: quais assets existem → o que retratam → direitos de uso → relevância de marca → qualidade → desempenho anterior → onde estão armazenados',
      'Orçamento, equipe, capacidade',
    ],
    signals: [
      { key: 'has_proof_assets', label: 'Tem prova social disponível', description: 'Depoimentos/UGC/cases prontos p/ campanha — ponte p/ Riverflow.', derivedFrom: ['marketing_ai_config.brand_assets', 'reviews'], emits: ['new_value', 'business_relevance'] },
      { key: 'tool_disconnected', label: 'Ferramenta desconectada', description: 'Recurso de execução caiu (bloqueia ação).', derivedFrom: ['marketing_ai_tool_config.health'], emits: ['subject_id', 'event_type', 'business_relevance'] },
    ],
    hermesConsumes: ['o que está disponível p/ executar uma oportunidade', 'assets de marca/criativos p/ o brief do Riverflow', 'ferramentas conectadas'],
    maturity: 'partial',
  },

  // ─────────────────────────────────────────────────────────────────────────
  performance: {
    key: 'performance',
    title: 'Performance',
    question: 'Que resultados de negócio estão de fato sendo produzidos AGORA?',
    belongs: [
      'Receita, leads, leads qualificados, conversão',
      'CAC, CPL, ROAS, AOV, LTV, retenção',
      'Desempenho de conteúdo, de campanha e de canal (agregado, estado atual)',
    ],
    tables: ['marketing_ai_tracking_snapshots (KPIs de IG)', 'marketing_ai_campaigns.performance', 'marketing_ai_reports', 'instagram_posts'],
    apis: ['marketing-ai:generate_report / run_tracking'],
    metrics: [
      { key: 'engagement_now', label: 'Engajamento atual (IG)', source: 'marketing_ai_tracking_snapshots.engagement_rate', available: true },
      { key: 'campaign_perf', label: 'Desempenho de campanha', source: 'marketing_ai_campaigns.performance', available: true },
      { key: 'revenue', label: 'Receita / CAC / ROAS / LTV', source: '—', available: false },
    ],
    history: 'PERFORMANCE = estado ATUAL; a série temporal vive em HISTORY. tracking_snapshots dá a fotografia agora.',
    gaps: [
      'KPIs comerciais reais: receita do cliente, leads qualificados, CAC, CPL, ROAS, AOV, LTV, retenção',
      'ATENÇÃO: o único dado de receita hoje (Stripe) é o cliente pagando a Sales Boost — NÃO a venda do negócio do cliente.',
    ],
    signals: [
      { key: 'engagement_drop', label: 'Queda de engajamento', description: 'KPI de audiência caindo vs. período anterior.', derivedFrom: ['marketing_ai_tracking_snapshots'], emits: ['old_value', 'new_value', 'confidence'] },
      { key: 'campaign_underperform', label: 'Campanha abaixo da meta', description: 'Campanha ativa não atinge o goal.', derivedFrom: ['marketing_ai_campaigns'], emits: ['subject_id', 'old_value', 'new_value', 'business_relevance'] },
    ],
    hermesConsumes: ['KPIs atuais e sua tendência', 'campanhas abaixo/acima da meta'],
    maturity: 'partial',
  },
}

/**
 * Domains are NOT isolated folders — they are cross-connected. A signal in one
 * domain often only becomes a decision when read alongside another. These edges
 * are the reasoning paths the Data Agent surfaces to Hermes. `when` names the
 * condition under which the edge is worth following.
 *
 * Example chain (the "don't cut price, sell value" decision):
 *   competition→market→customer→business→history→performance ⇒ Hermes ⇒ content→resources
 */
export interface DomainLink {
  from: DomainKey
  to: DomainKey
  when: string
}

export const DOMAIN_LINKS: DomainLink[] = [
  { from: 'competition', to: 'market', when: 'Concorrente mexe no preço → a demanda pode ficar mais sensível a preço' },
  { from: 'market', to: 'customer', when: 'Demanda muda → confirmar na voz do cliente (reviews)' },
  { from: 'customer', to: 'business', when: 'Objeção recorrente (ex.: preço) → checar se a margem sustenta reagir' },
  { from: 'business', to: 'history', when: 'Antes de reagir → já tentamos isso? Como foi?' },
  { from: 'history', to: 'performance', when: 'Resultado passado × valor real do cliente hoje (ex.: oferta premium rende mais)' },
  { from: 'competition', to: 'content', when: 'Content gap do concorrente → tema para produzir' },
  { from: 'customer', to: 'content', when: 'Elogio/objeção recorrente → ângulo de conteúdo' },
  { from: 'content', to: 'resources', when: 'Definido o ângulo → temos os assets (depoimentos/UGC) para executar?' },
  { from: 'resources', to: 'performance', when: 'Executado com os assets → medir o resultado, realimentar HISTORY' },
]

/** Canonical display / iteration order (mirrors the prompt's 3×3 grid). */
export const DOMAIN_ORDER: DomainKey[] = [
  'business', 'customer', 'market',
  'competition', 'digital', 'content',
  'history', 'resources', 'performance',
]
