// Rótulos de interface (PT/EN) do Performance. Só rótulos fixos da tela —
// textos que vêm do dado (notas, análise da IA, recomendações, nomes de
// pilares) NÃO são traduzidos aqui.
export type Lang = 'pt' | 'en'

export const localeOf = (lang: Lang) => (lang === 'en' ? 'en-US' : 'pt-BR')

export const PERF_TX = {
  pt: {
    // PerformanceTab
    syncErr: 'Erro ao sincronizar',
    toastApprovals: 'Recomendação enviada pra Central de Approvals — abra "Aprovações" pra revisar (ou já executa, se o Modo automático estiver ligado).',
    toastCopied: 'Ideia copiada. Abra a aba Conteúdo → Orgânico pra gerar o rascunho.',
    loadingIg: 'Buscando seus dados do Instagram…',
    realData: 'Dados reais', realDataTail: ' da conta @', realDataTail2: ' — atualizados direto do Instagram. Métricas sem permissão da API aparecem como "Não disponível" (nunca inventamos número).',
    demoBanner: 'Modo demonstração.', demoBannerTail: ' Estes números são exemplos pra você ver o produto. Conecte seu Instagram em ', demoBannerPath: 'Configurações → Conexões', demoBannerEnd: ' — aí tudo aqui vira dado real da sua conta, sem mudar o design.',
    syncFail: 'Não consegui sincronizar agora:', syncFailTail: 'Os dados podem estar desatualizados. Tente "Sincronizar agora".',
    scoreTitle: 'Score de performance', execTitle: 'Visão executiva',
    syncing: 'Sincronizando…', syncErrStatus: 'Erro na sincronização', connected: 'Conectado', demoStatus: 'Modo demonstração',
    isolated: 'Camada de dados isolada por empresa (Supabase) · snapshots históricos pra comparar períodos.', lastSync: 'última sincronização',
    emptyTitle: 'Conecte o Instagram pra desbloquear o Performance',
    emptyDesc: 'O Performance transforma os dados reais do seu Instagram em um centro de inteligência: score, crescimento, alcance, melhores conteúdos, melhor horário e as próximas ações — tudo com dado de verdade, nada inventado.',
    connectIg: 'Conectar Instagram', emptyHint: 'Prefere só ver como fica? Ligue o ', demoMode: 'Modo demonstração', emptyHintEnd: ' no topo do Growth OS.',
    // parts
    tipMeaning: 'O que é', tipCalc: 'Como calculamos', tipMatters: 'Por que importa', tipIfDown: 'Se estiver caindo',
    r7: '7 dias', r30: '30 dias', r90: '90 dias', r6m: '6 meses',
    syncedNow: 'agora mesmo', ago: (n: string) => `há ${n}`, synced: 'Sincronizado', health: 'Saúde:', syncNow: '↻ Sincronizar agora',
    vsPrev: 'vs período anterior',
    followers: 'Seguidores', reach: 'Alcance', impressions: 'Impressões', engagement: 'Engajamento', engRateShort: 'Taxa de eng.', profileVisits: 'Visitas ao perfil', linkClicks: 'Cliques no link', published: 'Publicações',
    trendTitle: 'Tendência de performance', curPeriod: 'Período atual', prevPeriod: 'Período anterior', metricNA: 'Esta métrica não está disponível para a conta conectada.', naDefault: 'Não disponível para esta conta.',
    momentum: { accelerating: 'Acelerando', stable: 'Estável', slowing: 'Desacelerando', declining: 'Em queda' },
    audTitle: 'Crescimento de audiência', perWeek: '/semana', startF: 'Seguidores no início', nowF: 'Seguidores agora', netNew: 'Novos (líquido)', gainedLost: 'Ganhos / perdidos', growthRate: 'Taxa de crescimento',
    reachTitle: 'Alcance & Descoberta', totalReach: 'Alcance total', nonFollowers: 'Não-seguidores', avgPerContent: 'Alcance médio / conteúdo', reachGrowth: 'Crescimento do alcance',
    fvn: 'Seguidores vs não-seguidores', nonFollowersDisc: 'Não-seguidores (descoberta)', splitNA: 'Divisão de alcance não disponível para esta conta.',
    engTitle: 'Inteligência de engajamento', rate: 'Taxa:', likes: 'Curtidas', comments: 'Comentários', sharesShort: 'Compart.', saves: 'Salvamentos', highIntent: 'Sinal de alta intenção',
    engNoteTail: 'Priorizamos salvamentos, compartilhamentos e comentários (★) por serem sinais de intenção mais alta que curtidas.',
    // insights
    sRate: 'Taxa eng.', sFollowersGen: 'Seguidores gerados', savesShort: 'Salvam.',
    contentPerf: 'Performance de conteúdo', noContent: 'Sem conteúdo disponível pela API ainda.', sortBy: 'Ordenar:', top5: 'Top 5 conteúdos', below: 'Abaixo do esperado',
    byFormat: 'Análise por formato', avgReachLbl: 'Alcance médio', avgEng: 'Eng. médio',
    consistency: 'Consistência de publicação', recommended: 'recomendado', pubd: 'Publicados', daysActive: 'Dias ativos', curStreak: 'Sequência atual', longStreak: 'Maior sequência', wk: 'sem.', weekPrefix: 'S',
    bestTime: 'Melhor horário pra postar', bestWindow: 'Melhor janela de engajamento:', bestWindowTail: 'Agende seus conteúdos mais importantes nesse horário.', notEnough: 'Ainda não há dados suficientes. Continue publicando pra desbloquear recomendações personalizadas de horário.',
    byFunnel: 'Performance por etapa do funil', byPillar: 'Performance por pilar de conteúdo', best: 'Melhor:',
    alerts: 'Alertas & Oportunidades',
    aiTitle: '✨ Análise SalesBoost', aiWorking: 'O que está funcionando', aiNot: 'O que não está', aiWhy: 'Por que está acontecendo', aiOpp: 'Maior oportunidade', aiRisk: 'Maior risco', aiNext: 'Próxima ação',
    vsComp: 'Comparativo com concorrentes', noComp: 'Sem dados de concorrentes ainda. Adicione concorrentes na Inteligência de Mercado.', realEst: '★ Dado real · ~ Estimado', you: 'Você', yourAccount: 'Sua conta',
    compNote1: 'Os números dos concorrentes são ', compNoteEst: 'estimados (~)', compNote2: ' a partir de dados públicos — nunca são apresentados como exatos. Só os seus dados vêm direto do Instagram (★).', perWk: '/sem',
    prioHigh: 'Alta prioridade', prioMed: 'Média', prioLow: 'Baixa', recsTitle: 'Ações recomendadas', reason: 'Motivo:', action: 'Ação:', objective: 'Objetivo:', impact: 'Impacto', createThis: '✨ Criar isto',
    gameTitle: 'Conexão com o Business Game', gameDesc: 'Sua performance real no Instagram vira XP e conquistas no jogo do negócio — nada é manipulado, só o que aconteceu de verdade conta pontos.',
    achievement: 'Conquista', reward: 'Recompensa', won: ' · conquistado', open: ' · em aberto',
  },
  en: {
    syncErr: 'Sync error',
    toastApprovals: 'Recommendation sent to the Approvals Center — open "Approvals" to review it (or it runs right away if Auto mode is on).',
    toastCopied: 'Idea copied. Open the Content → Organic tab to generate the draft.',
    loadingIg: 'Fetching your Instagram data…',
    realData: 'Real data', realDataTail: ' from account @', realDataTail2: ' — updated straight from Instagram. Metrics the API does not allow show as "Not available" (we never make up numbers).',
    demoBanner: 'Demo mode.', demoBannerTail: ' These numbers are examples so you can see the product. Connect your Instagram in ', demoBannerPath: 'Settings → Connections', demoBannerEnd: ' — then everything here becomes real data from your account, with no design change.',
    syncFail: 'Could not sync right now:', syncFailTail: 'The data may be out of date. Try "Sync now".',
    scoreTitle: 'Performance score', execTitle: 'Executive overview',
    syncing: 'Syncing…', syncErrStatus: 'Sync error', connected: 'Connected', demoStatus: 'Demo mode',
    isolated: 'Data layer isolated per company (Supabase) · historical snapshots to compare periods.', lastSync: 'last sync',
    emptyTitle: 'Connect Instagram to unlock Performance',
    emptyDesc: 'Performance turns your real Instagram data into an intelligence center: score, growth, reach, best content, best time and next actions — all with real data, nothing made up.',
    connectIg: 'Connect Instagram', emptyHint: 'Just want to see how it looks? Turn on ', demoMode: 'Demo mode', emptyHintEnd: ' at the top of Growth OS.',
    tipMeaning: 'What it is', tipCalc: 'How we calculate it', tipMatters: 'Why it matters', tipIfDown: 'If it is dropping',
    r7: '7 days', r30: '30 days', r90: '90 days', r6m: '6 months',
    syncedNow: 'just now', ago: (n: string) => `${n} ago`, synced: 'Synced', health: 'Health:', syncNow: '↻ Sync now',
    vsPrev: 'vs previous period',
    followers: 'Followers', reach: 'Reach', impressions: 'Impressions', engagement: 'Engagement', engRateShort: 'Eng. rate', profileVisits: 'Profile visits', linkClicks: 'Link clicks', published: 'Posts published',
    trendTitle: 'Performance trend', curPeriod: 'Current period', prevPeriod: 'Previous period', metricNA: 'This metric is not available for the connected account.', naDefault: 'Not available for this account.',
    momentum: { accelerating: 'Accelerating', stable: 'Stable', slowing: 'Slowing down', declining: 'Declining' },
    audTitle: 'Audience growth', perWeek: '/week', startF: 'Followers at start', nowF: 'Followers now', netNew: 'New (net)', gainedLost: 'Gained / lost', growthRate: 'Growth rate',
    reachTitle: 'Reach & Discovery', totalReach: 'Total reach', nonFollowers: 'Non-followers', avgPerContent: 'Average reach / post', reachGrowth: 'Reach growth',
    fvn: 'Followers vs non-followers', nonFollowersDisc: 'Non-followers (discovery)', splitNA: 'Reach split not available for this account.',
    engTitle: 'Engagement intelligence', rate: 'Rate:', likes: 'Likes', comments: 'Comments', sharesShort: 'Shares', saves: 'Saves', highIntent: 'High-intent signal',
    engNoteTail: 'We prioritize saves, shares and comments (★) because they are higher-intent signals than likes.',
    sRate: 'Eng. rate', sFollowersGen: 'Followers gained', savesShort: 'Saves',
    contentPerf: 'Content performance', noContent: 'No content available from the API yet.', sortBy: 'Sort by:', top5: 'Top 5 posts', below: 'Below expectations',
    byFormat: 'Format analysis', avgReachLbl: 'Avg. reach', avgEng: 'Avg. eng.',
    consistency: 'Posting consistency', recommended: 'recommended', pubd: 'Published', daysActive: 'Active days', curStreak: 'Current streak', longStreak: 'Longest streak', wk: 'wk', weekPrefix: 'W',
    bestTime: 'Best time to post', bestWindow: 'Best engagement window:', bestWindowTail: 'Schedule your most important content at this time.', notEnough: 'Not enough data yet. Keep posting to unlock personalized timing recommendations.',
    byFunnel: 'Performance by funnel stage', byPillar: 'Performance by content pillar', best: 'Best:',
    alerts: 'Alerts & Opportunities',
    aiTitle: '✨ SalesBoost Analysis', aiWorking: 'What is working', aiNot: 'What is not', aiWhy: 'Why it is happening', aiOpp: 'Biggest opportunity', aiRisk: 'Biggest risk', aiNext: 'Next action',
    vsComp: 'Competitor comparison', noComp: 'No competitor data yet. Add competitors in Market Intelligence.', realEst: '★ Real data · ~ Estimated', you: 'You', yourAccount: 'Your account',
    compNote1: 'Competitor numbers are ', compNoteEst: 'estimated (~)', compNote2: ' from public data — they are never presented as exact. Only your data comes straight from Instagram (★).', perWk: '/wk',
    prioHigh: 'High priority', prioMed: 'Medium', prioLow: 'Low', recsTitle: 'Recommended actions', reason: 'Reason:', action: 'Action:', objective: 'Goal:', impact: 'Impact', createThis: '✨ Create this',
    gameTitle: 'Business Game connection', gameDesc: 'Your real Instagram performance becomes XP and achievements in the business game — nothing is manipulated, only what really happened scores points.',
    achievement: 'Achievement', reward: 'Reward', won: ' · earned', open: ' · open',
  },
} as const

// Rótulos por chave (o dado traz o rótulo em PT; aqui mapeamos pela chave).
export const KPI_LABEL_EN: Record<string, string> = {
  followers: 'Followers', followersGrowth: 'New followers', reach: 'Reach', impressions: 'Impressions', engagement: 'Engagement',
  engagementRate: 'Engagement rate', profileVisits: 'Profile visits', websiteClicks: 'Link clicks', published: 'Posts published',
  avgReach: 'Avg. reach / post', avgEng: 'Avg. engagement / post',
}
export const SCORE_LABEL_EN: Record<string, string> = { growth: 'Growth', reach: 'Reach', engagement: 'Engagement', content: 'Content', consistency: 'Consistency' }
export const HEALTH_EN: Record<string, string> = { excellent: 'Excellent', good: 'Good', attention: 'Needs attention', critical: 'Critical' }
export const FORMAT_EN: Record<string, string> = { reel: 'Reels', post: 'Posts', carousel: 'Carousels', story: 'Stories' }
export const FUNNEL_EN: Record<string, string> = { tof: 'Top — Discovery', mof: 'Middle — Consideration', bof: 'Bottom — Conversion' }
export const DAY_NAMES_EN = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
