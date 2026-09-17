// Dados DEMO do módulo de Campanhas (mídia paga) do Growth OS. Tudo fictício —
// nenhuma API da Meta é chamada. A estrutura já é a que a integração real vai
// preencher: campanhas por etapa de funil, métricas simuladas, recomendações
// da IA, jornada do pixel e aprendizado. Pensado como um "media buyer" de IA.

export type FunnelStage = 'awareness' | 'consideration' | 'conversion' | 'retention' | 'remarketing'

export const FUNNEL_META: Record<FunnelStage, { label: string; short: string; color: string; icon: string }> = {
  awareness: { label: 'Topo — Descoberta', short: 'Topo', color: '#60a5fa', icon: '👀' },
  consideration: { label: 'Meio — Consideração', short: 'Meio', color: '#a78bfa', icon: '🤔' },
  conversion: { label: 'Fundo — Conversão', short: 'Fundo', color: '#4ade80', icon: '🎯' },
  retention: { label: 'Retenção', short: 'Retenção', color: '#FBBF24', icon: '💛' },
  remarketing: { label: 'Remarketing', short: 'Remkt', color: '#f472b6', icon: '🔁' },
}

export type CampaignStatus = 'active' | 'draft' | 'scheduled'
export const STATUS_META: Record<CampaignStatus, { label: string; color: string }> = {
  active: { label: 'Ativa', color: '#4ade80' },
  scheduled: { label: 'Agendada', color: '#60a5fa' },
  draft: { label: 'Rascunho', color: '#FBBF24' },
}

export interface CampaignMetrics {
  reach: number; impressions: number; ctr: number; cpc: number; cpm: number
  frequency: number; leads: number; purchases: number; roas: number; spend: number; budget: number
}

export interface CampaignVariation { angle: string; hook: string; headline: string }

export interface Campaign {
  id: string
  name: string
  status: CampaignStatus
  stage: FunnelStage
  whyStage: string          // por que a IA escolheu essa etapa
  offer: string            // oferta baseada em valor
  offerRationale: string   // por que essa oferta (e não preço)
  goal: string
  strategy: string
  audience: string
  persona: string
  angle: string
  hook: string
  headline: string
  primaryText: string
  cta: string
  imagePrompt: string
  videoConcept: string
  landingPage: string
  successMetrics: string[]
  expectedOutcome: string
  risk: string
  healthScore: number      // 0-100
  predictedRoas: number
  metrics?: CampaignMetrics  // só campanhas ativas têm
  variations: CampaignVariation[]
}

export interface CampaignRecommendation {
  id: string; kind: 'fix' | 'scale' | 'create' | 'retarget'
  title: string; detail: string; action: string; priority: 'high' | 'medium' | 'low'
}

export interface PixelStep { label: string; count: number; drop?: string }
export interface PixelRead { event: string; what: string; why: string; improve: string; nextCampaign: string }

export interface CreativeItem { id: string; format: 'imagem' | 'reel' | 'carrossel'; angle: string; caption: string; ctr?: number; tone: string }

export interface CampaignLearning { dimension: string; winner: string; note: string }

// Ideia de conteúdo (orgânico, do Agente de Conteúdo) que serve de matéria-
// prima pra uma campanha paga — o Estrategista de Mídia Paga sugere qual
// ideia já testada/planejada vale a pena promover, em vez de criar do zero.
export interface ContentIdeaForCampaign { id: string; title: string; format: string; stage: FunnelStage; why: string }
// Story Ads interativos (Meta) — engajam com um sticker de verdade (enquete,
// quiz, slider, contagem), não só um vídeo passivo; geram sinal de pixel rico.
export interface StoryAdIdea { id: string; concept: string; sticker: 'enquete' | 'quiz' | 'slider' | 'contagem'; goal: string; example: string }

export interface CampaignDemo {
  campaigns: Campaign[]
  recommendations: CampaignRecommendation[]
  pixelJourney: PixelStep[]
  pixelReads: PixelRead[]
  creatives: CreativeItem[]
  learnings: CampaignLearning[]
  contentIdeas: ContentIdeaForCampaign[]
  storyAds: StoryAdIdea[]
  overview: { active: number; drafts: number; predictedRoas: number; health: number; monthlyBudget: string }
}

export function buildCampaignDemo(company: { business_name?: string; business_type?: string | null; city?: string | null }): CampaignDemo {
  const local = company.city ?? 'sua região'
  const biz = company.business_name ?? 'seu negócio'

  const campaigns: Campaign[] = [
    {
      id: 'cmp1', name: 'Guia grátis — “Como escolher sem errar”', status: 'active', stage: 'awareness',
      whyStage: 'Público frio ainda não conhece a marca. A IA escolheu Topo de Funil pra gerar reconhecimento com conteúdo de valor antes de pedir qualquer conversão.',
      offer: 'Guia/checklist gratuito (isca de valor)', offerRationale: 'Em vez de anunciar preço, entregamos um material útil — atrai quem tem interesse real e ainda não está pronto pra comprar, alimentando o remarketing depois.',
      goal: 'Gerar reconhecimento e capturar público interessado (não comprador ainda).',
      strategy: 'Anúncio de conteúdo educativo → clique pro guia → pixel marca “ViewContent” → remarketing na sequência.',
      audience: `Interesses ligados ao segmento + raio de 8 km de ${local}, 25–45 anos`,
      persona: 'Curioso pesquisando opções, sensível a prova social, decide com calma.',
      angle: 'Educação / autoridade', hook: 'A maioria erra nisso por não saber uma coisa simples…',
      headline: `O guia que ${biz} preparou pra você não errar na escolha`,
      primaryText: 'Fizemos um checklist rápido com tudo que você precisa saber antes de decidir. É grátis e leva 2 minutos pra ler. 👇',
      cta: 'Baixar guia grátis', imagePrompt: 'Flat lay premium, tons quentes, material impresso elegante sobre mesa de madeira, sem texto',
      videoConcept: 'Reels de 15s mostrando os 3 erros mais comuns (texto na tela + bastidor).',
      landingPage: 'Página simples com o guia + formulário de e-mail (1 campo).',
      successMetrics: ['Custo por lead < R$ 4', 'CTR > 1,5%', '500+ downloads/mês'],
      expectedOutcome: 'Base de 500–800 contatos mornos/mês pra nutrir e remarketar.',
      risk: 'Se o criativo prometer demais, gera lead desqualificado. Mitigar com copy honesta.',
      healthScore: 86, predictedRoas: 0,
      metrics: { reach: 42800, impressions: 61200, ctr: 1.8, cpc: 0.62, cpm: 8.4, frequency: 1.4, leads: 612, purchases: 0, roas: 0, spend: 380, budget: 600 },
      variations: [
        { angle: 'Medo de errar', hook: 'Não decida antes de ver isto', headline: 'O erro que quase todo mundo comete' },
        { angle: 'Prova social', hook: 'Foi assim que centenas escolheram certo', headline: 'O checklist que virou padrão por aqui' },
      ],
    },
    {
      id: 'cmp2', name: 'Avaliação/diagnóstico gratuito', status: 'active', stage: 'consideration',
      whyStage: 'Público já interagiu (viu conteúdo/guia). A IA escolheu Meio de Funil pra aprofundar o interesse com uma oferta de valor sem preço.',
      offer: 'Diagnóstico / avaliação gratuita', offerRationale: 'A oferta gratuita reduz o atrito de dar o primeiro passo e cria compromisso — converte muito melhor que “X% de desconto”.',
      goal: 'Transformar interesse em intenção — agendar avaliações gratuitas.',
      strategy: 'Anúncio pra quem engajou nos últimos 30 dias → agendamento → contato do time.',
      audience: 'Remarketing de quem viu o guia + engajou no perfil (últimos 30 dias)',
      persona: 'Já considera resolver o problema, quer sentir confiança antes de pagar.',
      angle: 'Redução de risco', hook: 'Antes de gastar qualquer real, faça isto de graça',
      headline: 'Sua avaliação gratuita com a equipe de ' + biz,
      primaryText: 'Sem compromisso: a gente avalia seu caso e te mostra o caminho. Você decide depois. Agende em 1 minuto.',
      cta: 'Agendar avaliação grátis', imagePrompt: 'Pessoa real sorrindo em atendimento acolhedor, luz natural, ambiente do negócio',
      videoConcept: 'Depoimento curto de cliente que fez a avaliação e voltou.',
      landingPage: 'Agendamento com calendário + prova social (reviews reais).',
      successMetrics: ['Custo por agendamento < R$ 18', 'Taxa de comparecimento > 60%'],
      expectedOutcome: '80–120 avaliações agendadas/mês, alimentando o Fundo de Funil.',
      risk: 'No-show alto. Mitigar com lembrete no WhatsApp automático.',
      healthScore: 78, predictedRoas: 0,
      metrics: { reach: 18400, impressions: 34100, ctr: 2.3, cpc: 0.94, cpm: 11.2, frequency: 1.9, leads: 143, purchases: 0, roas: 0, spend: 420, budget: 500 },
      variations: [
        { angle: 'Curiosidade', hook: 'Será que dá pra resolver? Descubra grátis', headline: 'Avaliação sem custo, sem enrolação' },
      ],
    },
    {
      id: 'cmp3', name: 'Convite VIP — experiência exclusiva', status: 'draft', stage: 'conversion',
      whyStage: 'Público quente (agendou avaliação / pediu orçamento). A IA marcou Fundo de Funil: hora de converter com uma oferta de valor premium.',
      offer: 'Convite VIP + bônus exclusivo por tempo limitado', offerRationale: 'Escassez + exclusividade (não desconto puro). Preserva a percepção de valor e evita atrair caçador de promoção.',
      goal: 'Converter leads quentes em clientes.',
      strategy: 'Remarketing pra quem agendou mas não fechou → convite VIP com bônus e prazo.',
      audience: 'Quem iniciou agendamento/orçamento nos últimos 14 dias e não fechou',
      persona: 'Pronto pra decidir, precisa de um empurrão e de se sentir especial.',
      angle: 'Exclusividade / urgência honesta', hook: 'Guardamos algo especial só pra você',
      headline: 'Seu convite VIP com um bônus que sai esta semana',
      primaryText: 'Você deu o primeiro passo — agora liberamos um bônus exclusivo pra quem fecha até domingo. Vagas limitadas.',
      cta: 'Garantir meu lugar', imagePrompt: 'Detalhe premium do produto/serviço, dourado suave, sensação de exclusividade',
      videoConcept: 'Reels “o que você ganha ao entrar agora” (bônus na tela).',
      landingPage: 'Página de oferta com bônus, prazo (contador) e depoimentos.',
      successMetrics: ['ROAS > 3,0', 'Taxa de conversão do remarketing > 8%'],
      expectedOutcome: 'Conversão de 8–12% dos leads quentes, ticket preservado.',
      risk: 'Se a urgência for falsa, queima confiança. Usar prazo real e rotativo.',
      healthScore: 71, predictedRoas: 3.4,
      variations: [
        { angle: 'Bônus', hook: 'Um extra que só quem entra esta semana ganha', headline: 'O bônus VIP acaba domingo' },
        { angle: 'Pertencimento', hook: 'Entre pro grupo que já decidiu', headline: 'Seu lugar entre os clientes VIP' },
      ],
    },
    {
      id: 'cmp4', name: 'Clientes ativos — indique e ganhe experiência', status: 'draft', stage: 'retention',
      whyStage: 'Base de clientes atuais. A IA escolheu Retenção pra aumentar recompra e indicação — o crescimento mais barato que existe.',
      offer: 'Experiência exclusiva por indicação (valor, não cashback)', offerRationale: 'Recompensa em experiência gera mais valor percebido e vínculo do que dinheiro de volta.',
      goal: 'Aumentar recompra e trazer indicações qualificadas.',
      strategy: 'Público de clientes (lista/pixel de compradores) → programa de indicação.',
      audience: 'Compradores dos últimos 6 meses',
      persona: 'Já confia na marca, gosta de ser reconhecido.',
      angle: 'Reconhecimento / comunidade', hook: 'Você já é de casa — que tal trazer alguém?',
      headline: 'Indique um amigo e ganhe uma experiência especial',
      primaryText: 'Obrigado por ser cliente 💛 Indique alguém e vocês dois ganham algo exclusivo. Simples assim.',
      cta: 'Quero indicar', imagePrompt: 'Duas pessoas felizes compartilhando a experiência do negócio, calor humano',
      videoConcept: 'Reels de clientes reais indicando (UGC).',
      landingPage: 'Página do programa de indicação com link único.',
      successMetrics: ['Taxa de indicação > 5%', 'CAC de indicado < metade do pago'],
      expectedOutcome: '30–50 indicações qualificadas/mês a custo quase zero.',
      risk: 'Baixa adesão se o prêmio não empolgar. Testar diferentes experiências.',
      healthScore: 68, predictedRoas: 5.1,
      variations: [
        { angle: 'Gratidão', hook: 'Um obrigado que vira presente pra você e um amigo', headline: 'Sua indicação vale uma experiência' },
      ],
    },
  ]

  const recommendations: CampaignRecommendation[] = [
    { id: 'r1', kind: 'fix', title: 'Cliques no “Saiba mais”, mas some ao ver preço', detail: 'Na campanha de consideração, 38% clicam e saem na página de preços. O público ainda não percebeu valor suficiente.', action: 'Rodar um Topo de Funil educativo antes de pedir conversão — nutrir antes de vender.', priority: 'high' },
    { id: 'r2', kind: 'retarget', title: 'Viu serviços mas não pediu orçamento', detail: '1.240 pessoas visitaram a página de serviços e não avançaram nos últimos 14 dias.', action: 'Criar remarketing com a oferta de avaliação gratuita pra esse público.', priority: 'high' },
    { id: 'r3', kind: 'create', title: 'Troque desconto por valor', detail: 'A campanha rascunho “-15%” tende a atrair caçador de promoção e derruba a margem.', action: 'Substituir por “bônus exclusivo por tempo limitado” — converte melhor sem queimar preço.', priority: 'medium' },
    { id: 'r4', kind: 'scale', title: 'Campanha do guia está saudável — escale', detail: 'Custo por lead 40% abaixo da meta e CTR alto. Há espaço pra aumentar orçamento.', action: 'Subir o orçamento em 30% de forma gradual (evita reset do aprendizado).', priority: 'medium' },
    { id: 'r5', kind: 'fix', title: 'Formulário perde gente na 2ª pergunta', detail: 'Abandono de 46% após a segunda pergunta do formulário de lead.', action: 'Reduzir o formulário pra 1 campo (só WhatsApp) e pedir o resto depois.', priority: 'low' },
  ]

  const pixelJourney: PixelStep[] = [
    { label: 'Viu o anúncio', count: 61200 },
    { label: 'Clicou (Saiba mais)', count: 1102, drop: '−98%' },
    { label: 'Visitou o site', count: 964, drop: '−13%' },
    { label: 'Viu serviços', count: 512, drop: '−47%' },
    { label: 'Viu preços', count: 318, drop: '−38%' },
    { label: 'Iniciou contato', count: 143, drop: '−55%' },
    { label: 'Converteu', count: 41, drop: '−71%' },
  ]

  const pixelReads: PixelRead[] = [
    { event: 'Viu preços → saiu', what: '38% abandonam logo após ver a página de preços.', why: 'Chegam sem valor percebido suficiente — a oferta parece cara pro estágio deles.', improve: 'Adicionar prova social e ancoragem de valor antes do preço; nutrir com Topo de Funil.', nextCampaign: 'Campanha educativa (guia grátis) mirando quem viu preço e saiu.' },
    { event: 'Iniciou contato → não terminou', what: 'Metade começa o formulário e não conclui.', why: 'Formulário longo cria atrito no momento de maior interesse.', improve: 'Formulário de 1 campo + WhatsApp; qualificar depois.', nextCampaign: 'Remarketing “falta 1 passo” pra quem começou e parou.' },
    { event: 'Visitante recorrente', what: '2ª e 3ª visitas sem comprar.', why: 'Interesse alto, mas sem gatilho de decisão.', improve: 'Oferecer bônus por tempo limitado (não desconto).', nextCampaign: 'Fundo de Funil “convite VIP” pra recorrentes.' },
  ]

  const creatives: CreativeItem[] = [
    { id: 'cr1', format: 'reel', angle: 'Bastidor / autoridade', caption: 'Os 3 erros que quase todo mundo comete (e como evitar).', ctr: 2.1, tone: 'Educativo' },
    { id: 'cr2', format: 'imagem', angle: 'Isca de valor', caption: 'Baixe o guia grátis e decida sem errar. 👇', ctr: 1.8, tone: 'Direto' },
    { id: 'cr3', format: 'carrossel', angle: 'Prova social', caption: 'Foi assim que centenas escolheram certo (arrasta 👉).', ctr: 1.5, tone: 'Confiança' },
    { id: 'cr4', format: 'imagem', angle: 'Exclusividade', caption: 'Seu convite VIP com bônus que sai domingo.', tone: 'Premium' },
    { id: 'cr5', format: 'reel', angle: 'Depoimento', caption: '“Fiz a avaliação grátis e voltei” — cliente real.', ctr: 2.4, tone: 'Emocional' },
  ]

  const learnings: CampaignLearning[] = [
    { dimension: 'Melhor gancho', winner: 'Educação / “o erro que evita”', note: '2,3× mais cliques que gancho de preço.' },
    { dimension: 'Melhor criativo', winner: 'Reels de bastidor com pessoa real', note: 'CTR 0,6pp acima de foto de produto.' },
    { dimension: 'Melhor CTA', winner: '“Baixar guia grátis”', note: 'Supera “Saiba mais” no Topo de Funil.' },
    { dimension: 'Melhor oferta', winner: 'Avaliação/diagnóstico gratuito', note: 'Converte mais e preserva margem vs. desconto.' },
    { dimension: 'Etapa mais rentável', winner: 'Remarketing (Fundo)', note: 'Maior ROAS — público já aquecido.' },
    { dimension: 'Melhor horário', winner: '19h–21h', note: 'Menor CPM e maior taxa de conclusão.' },
  ]

  const contentIdeas: ContentIdeaForCampaign[] = [
    { id: 'ci1', title: '"Os 3 erros que quase todo mundo comete" (carrossel educativo)', format: 'Carrossel', stage: 'awareness', why: 'Testado no orgânico com engajamento acima da média — já validado antes de gastar mídia paga nele.' },
    { id: 'ci2', title: 'Bastidor real do atendimento/produção', format: 'Reel', stage: 'awareness', why: 'Formato de bastidor converteu melhor que produto "posado" nos últimos posts do Vault.' },
    { id: 'ci3', title: 'Depoimento de um resultado real recente', format: 'Foco no Produto', stage: 'consideration', why: 'Prova concreta pra quem já considera — mesma lógica do template Foco no Produto da Biblioteca.' },
    { id: 'ci4', title: 'Depoimento em vídeo de cliente satisfeito', format: 'Reel', stage: 'conversion', why: 'Prova social no Fundo de Funil reduz a objeção final antes da conversão.' },
  ]

  const storyAds: StoryAdIdea[] = [
    { id: 'sa1', concept: '"Qual desses te descreve mais?" — segmenta o público sozinho', sticker: 'enquete', goal: 'Descoberta + coleta de sinal pro pixel (quem respondeu quê)', example: '"Você já tentou resolver isso sozinho?" [Sim] [Ainda não]' },
    { id: 'sa2', concept: 'Quiz rápido de 2 perguntas pra indicar o serviço certo', sticker: 'quiz', goal: 'Qualifica o lead antes mesmo do clique — chega mais quente', example: '"Qual seu maior desafio hoje?" com 3 alternativas' },
    { id: 'sa3', concept: 'Slider "o quanto isso te incomoda de 0 a 10"', sticker: 'slider', goal: 'Sinal de intenção gradual — separa curioso de decidido', example: 'Slider de 0 a 10 sobre o problema que o negócio resolve' },
    { id: 'sa4', concept: 'Contagem regressiva pra oferta por tempo limitado', sticker: 'contagem', goal: 'Urgência real (não fake) pro Fundo de Funil', example: 'Contagem até o fim do bônus, com lembrete automático de 1h antes' },
  ]

  const active = campaigns.filter(c => c.status === 'active').length
  const drafts = campaigns.filter(c => c.status === 'draft').length
  const health = Math.round(campaigns.reduce((s, c) => s + c.healthScore, 0) / campaigns.length)

  return {
    campaigns, recommendations, pixelJourney, pixelReads, creatives, learnings, contentIdeas, storyAds,
    overview: { active, drafts, predictedRoas: 3.9, health, monthlyBudget: 'R$ 1.100' },
  }
}
