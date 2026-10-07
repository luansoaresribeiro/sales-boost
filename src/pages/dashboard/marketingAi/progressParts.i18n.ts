// Textos em inglês do Business Progress. Os rótulos de dados (progressGame.ts)
// nascem em português; aqui só traduzimos pra exibição, sem mexer na lógica.
import type { Lang } from '../../../contexts/LanguageContext'

const PT_TO_EN: Record<string, string> = {
  // whileAway
  'leads no funil': 'leads in the funnel', 'leads qualificados': 'qualified leads', 'conteúdos publicados': 'content published',
  'conversas atendidas': 'conversations handled', 'oportunidades identificadas': 'opportunities identified', 'campanhas criadas': 'campaigns created',
  // deltas
  'novos leads': 'new leads', 'oportunidades': 'opportunities', 'engajamento': 'engagement',
  // health metrics / weekly
  'Leads': 'Leads', 'Qualificados': 'Qualified', 'Conversas': 'Conversations', 'Conversão': 'Conversion', 'Engajamento': 'Engagement',
  'Conteúdo': 'Content', 'Campanhas': 'Campaigns', 'Automação': 'Automation', 'Conversões': 'Conversions', 'Receita': 'Revenue',
  // rarity
  'Comum': 'Common', 'Raro': 'Rare', 'Épico': 'Epic', 'Lendário': 'Legendary',
  // health status
  'Crescendo': 'Growing', 'Estável': 'Stable', 'Em risco': 'At risk',
  // pins
  'Primeiro lead convertido.': 'First lead converted.', 'Progresso por 7 dias seguidos.': 'Progress for 7 days in a row.',
  '100 leads encontrados.': '100 leads found.', 'Primeira venda atribuída ao SalesBoost.': 'First sale attributed to SalesBoost.',
  '100 ações automáticas.': '100 automated actions.', 'Atingiu Business Master.': 'Reached Business Master.',
  'Desbloqueou 24h de inteligência avançada.': 'Unlocked 24h of advanced intelligence.',
  // rewards
  'Capacidades avançadas do agente por 24h.': 'Advanced agent capabilities for 24h.', 'Raciocínio profundo por 24h.': 'Deep reasoning for 24h.',
  'Análise profunda por 24h.': 'Deep analysis for 24h.', 'Análise de concorrentes aprofundada.': 'In-depth competitor analysis.',
  'Inteligência premium de campanhas.': 'Premium campaign intelligence.', 'Geração de conteúdo avançada.': 'Advanced content generation.',
  'Descoberta de leads aprofundada.': 'In-depth lead discovery.', 'Enriquecimento de dados dos leads.': 'Lead data enrichment.',
  'Qualificação avançada de leads.': 'Advanced lead qualification.', 'Relatórios avançados.': 'Advanced reports.',
  'Análise profunda do negócio.': 'Deep business analysis.', 'Insights estendidos.': 'Extended insights.',
  // timeline
  'Novo lead capturado': 'New lead captured', 'Lead qualificado': 'Lead qualified',
  'Lead antigo recuperado': 'Old lead recovered', 'Conversa atendida': 'Conversation handled', 'Follow-up enviado': 'Follow-up sent',
  'Conteúdo criado': 'Content created', 'Conteúdo publicado': 'Content published', 'Campanha criada': 'Campaign created',
  'Campanha otimizada': 'Campaign optimized', 'Oportunidade identificada': 'Opportunity identified', 'Avaliação respondida': 'Review replied',
  'Concorrente monitorado': 'Competitor monitored', 'Automação concluída': 'Automation completed', 'Teste iniciado': 'Trial started',
  'Teste concluído': 'Trial completed', 'Descoberta revelada': 'Discovery revealed', 'Recompensa ativada': 'Reward activated',
  'Meta atingida': 'Goal reached', 'Primeiro cliente conquistado': 'First customer won',
  // next best action
  'Fazer follow-up com os leads do funil': 'Follow up with the leads in your funnel', 'Criar o primeiro conteúdo com o Marketing AI': 'Create your first content with Marketing AI',
  'Abrir Funil': 'Open Funnel', 'Abrir Marketing AI': 'Open Marketing AI',
}

/** Traduz um rótulo vindo de progressGame.ts (PT) pra EN; em PT devolve igual. */
export function trProgress(lang: Lang, s: string): string {
  if (lang !== 'en') return s
  if (s === 'Conversão') return 'Conversion'
  const hit = PT_TO_EN[s]
  if (hit) return hit
  let m = s.match(/^Subir para (.+)$/)
  if (m) return `Move up to ${m[1]}`
  m = s.match(/^(\d+) leads qualificados$/)
  if (m) return `${m[1]} qualified leads`
  m = s.match(/^Enviar proposta para (\d+) (lead qualificado|leads qualificados)$/)
  if (m) return `Send a proposal to ${m[1]} qualified ${m[1] === '1' ? 'lead' : 'leads'}`
  return s
}

export const PROGRESS_TX = {
  pt: {
    waiting: 'aguardando dados reais',
    leagueSuffix: ' League', maxLeague: 'Liga máxima atingida 🚀',
    journeyT: 'Sua jornada de negócio', journeyS: 'Cada etapa acende conforme seu negócio evolui.',
    ladderS: 'Seu status de longo prazo. O XP sobe com resultado real.',
    nextUnlock: '🚀 Próximo desbloqueio', remaining: (n: string) => `Faltam ${n} XP`, suggested: '🎯 Objetivo sugerido: ',
    awayT: 'Enquanto você estava fora', awayS: 'Totais reais da sua conta — clique para abrir cada resultado.',
    healthS: 'Só números reais da sua conta. O que ainda não tem fonte aparece embaçado.',
    weeklyT: 'Progresso semanal', weeklyS: 'Esta semana vs. semana passada — aparece quando houver histórico real.',
    pinsT: 'Pins & Conquistas', pinsS: 'Marcos importantes do seu negócio. Alguns viram recompensas.',
    unlockedAt: 'Desbloqueado ', activating: 'Ativando…', activate: '⚡ ATIVAR',
    rewardsS: 'Capacidades que seu agente desbloqueia com o progresso.', active: '✓ Ativo', boostOf: (h: number) => `Boost de ${h}h`,
    recentT: 'Progresso recente', recentS: 'Eventos reais registrados no seu negócio, do mais recente ao mais antigo.',
    noEvents: 'Ainda sem eventos registrados — os primeiros aparecem aqui assim que houver dados reais.',
    slowed: '⚠️ Seu crescimento desacelerou', found: (n: number) => `O SalesBoost encontrou ${n} possíveis causas:`,
    recoveryA: 'Recovery Boost disponível.', recoveryB: ' Seu agente ganha inteligência avançada por 24h para montar um plano de recuperação.',
    activateRecovery: 'Ativar Recovery Boost',
    day: 'dia', days: 'dias', ofProgress: 'de progresso',
    streakOn: (n: number) => `Seu negócio teve resultado registrado por ${n} ${n === 1 ? 'dia' : 'dias'} seguidos — não é por abrir o app.`,
    streakOff: 'Conta dias seguidos com resultado real registrado (não é por abrir o app).',
    healthLabel: 'Business Health: ',
  },
  en: {
    waiting: 'waiting for real data',
    leagueSuffix: ' League', maxLeague: 'Top league reached 🚀',
    journeyT: 'Your business journey', journeyS: 'Each stage lights up as your business grows.',
    ladderS: 'Your long-term status. XP grows with real results.',
    nextUnlock: '🚀 Next unlock', remaining: (n: string) => `${n} XP to go`, suggested: '🎯 Suggested goal: ',
    awayT: 'While you were away', awayS: 'Real totals from your account — click to open each result.',
    healthS: "Real numbers from your account only. Anything without a source shows blurred.",
    weeklyT: 'Weekly progress', weeklyS: 'This week vs. last week — shows up once there is real history.',
    pinsT: 'Pins & Achievements', pinsS: 'Key milestones for your business. Some become rewards.',
    unlockedAt: 'Unlocked ', activating: 'Activating…', activate: '⚡ ACTIVATE',
    rewardsS: 'Capabilities your agent unlocks as you progress.', active: '✓ Active', boostOf: (h: number) => `${h}h boost`,
    recentT: 'Recent progress', recentS: 'Real events recorded for your business, newest first.',
    noEvents: 'No events recorded yet — the first ones will show up here as soon as there is real data.',
    slowed: '⚠️ Your growth has slowed down', found: (n: number) => `SalesBoost found ${n} possible causes:`,
    recoveryA: 'Recovery Boost available.', recoveryB: ' Your agent gets advanced intelligence for 24h to build a recovery plan.',
    activateRecovery: 'Activate Recovery Boost',
    day: 'day', days: 'days', ofProgress: 'of progress',
    streakOn: (n: number) => `Your business had results recorded for ${n} ${n === 1 ? 'day' : 'days'} in a row — not for opening the app.`,
    streakOff: 'Counts consecutive days with real recorded results (not for opening the app).',
    healthLabel: 'Business Health: ',
  },
} as const
