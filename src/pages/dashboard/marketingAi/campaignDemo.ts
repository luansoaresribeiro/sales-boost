// Dados DEMO do módulo de Campanhas (mídia paga) do Growth OS. Tudo fictício —
// nenhuma API da Meta é chamada. A estrutura já é a que a integração real vai
// preencher: campanhas por etapa de funil, métricas simuladas, recomendações
// da IA, jornada do pixel e aprendizado. Pensado como um "media buyer" de IA.
import type { Lang } from '../../../contexts/LanguageContext'

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

export function buildCampaignDemo(company: { business_name?: string; business_type?: string | null; city?: string | null }, lang: Lang = 'pt'): CampaignDemo {
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

  const demo: CampaignDemo = {
    campaigns, recommendations, pixelJourney, pixelReads, creatives, learnings, contentIdeas, storyAds,
    overview: { active, drafts, predictedRoas: 3.9, health, monthlyBudget: 'R$ 1.100' },
  }
  return lang === 'en' ? translateCampaignDemo(demo, company) : demo
}

// Overlay EN: mantém números/estrutura do demo e troca só os textos, por id/posição.
function translateCampaignDemo(d: CampaignDemo, company: { business_name?: string; city?: string | null }): CampaignDemo {
  const local = company.city ?? 'your area'
  const biz = company.business_name ?? 'your business'
  const C: Record<string, Partial<Campaign>> = {
    cmp1: {
      name: 'Free guide — “How to choose without mistakes”',
      whyStage: 'Cold audience does not know the brand yet. The AI chose Top of Funnel to build recognition with valuable content before asking for any conversion.',
      offer: 'Free guide/checklist (value lead magnet)', offerRationale: 'Instead of advertising a price, we deliver useful material — it attracts people with real interest who are not ready to buy yet, feeding remarketing later.',
      goal: 'Build recognition and capture an interested audience (not buyers yet).',
      strategy: 'Educational ad → click to the guide → pixel marks “ViewContent” → remarketing afterwards.',
      audience: `Interests related to the segment + 8 km radius around ${local}, ages 25–45`,
      persona: 'Curious person researching options, sensitive to social proof, decides calmly.',
      angle: 'Education / authority', hook: 'Most people get this wrong because they miss one simple thing…',
      headline: `The guide ${biz} prepared so you do not choose wrong`,
      primaryText: 'We made a quick checklist with everything you need to know before deciding. It is free and takes 2 minutes to read. 👇',
      cta: 'Download free guide', imagePrompt: 'Premium flat lay, warm tones, elegant printed material on a wooden table, no text',
      videoConcept: '15s Reels showing the 3 most common mistakes (on-screen text + behind the scenes).',
      landingPage: 'Simple page with the guide + email form (1 field).',
      successMetrics: ['Cost per lead < R$ 4', 'CTR > 1.5%', '500+ downloads/month'],
      expectedOutcome: 'Base of 500–800 warm contacts/month to nurture and remarket.',
      risk: 'If the creative over-promises, it generates unqualified leads. Mitigate with honest copy.',
      variations: [
        { angle: 'Fear of getting it wrong', hook: 'Do not decide before seeing this', headline: 'The mistake almost everyone makes' },
        { angle: 'Social proof', hook: 'This is how hundreds chose right', headline: 'The checklist that became the standard here' },
      ],
    },
    cmp2: {
      name: 'Free assessment/diagnosis',
      whyStage: 'The audience has already interacted (saw content/guide). The AI chose Middle of Funnel to deepen interest with a no-price value offer.',
      offer: 'Free diagnosis / assessment', offerRationale: 'The free offer lowers the friction of taking the first step and creates commitment — it converts far better than “X% off”.',
      goal: 'Turn interest into intent — book free assessments.',
      strategy: 'Ad for people who engaged in the last 30 days → booking → team contact.',
      audience: 'Remarketing to those who saw the guide + engaged with the profile (last 30 days)',
      persona: 'Already considers solving the problem, wants to feel confident before paying.',
      angle: 'Risk reduction', hook: 'Before spending a single real, do this for free',
      headline: 'Your free assessment with the ' + biz + ' team',
      primaryText: 'No commitment: we assess your case and show you the way. You decide later. Book in 1 minute.',
      cta: 'Book free assessment', imagePrompt: 'Real person smiling in a welcoming service moment, natural light, business environment',
      videoConcept: 'Short testimonial from a customer who did the assessment and came back.',
      landingPage: 'Booking with calendar + social proof (real reviews).',
      successMetrics: ['Cost per booking < R$ 18', 'Show-up rate > 60%'],
      expectedOutcome: '80–120 assessments booked/month, feeding the Bottom of the Funnel.',
      risk: 'High no-show. Mitigate with an automatic WhatsApp reminder.',
      variations: [{ angle: 'Curiosity', hook: 'Can it be solved? Find out for free', headline: 'Free assessment, no hassle' }],
    },
    cmp3: {
      name: 'VIP invitation — exclusive experience',
      whyStage: 'Hot audience (booked an assessment / asked for a quote). The AI marked Bottom of Funnel: time to convert with a premium value offer.',
      offer: 'VIP invitation + exclusive limited-time bonus', offerRationale: 'Scarcity + exclusivity (not pure discount). Preserves perceived value and avoids attracting bargain hunters.',
      goal: 'Convert hot leads into customers.',
      strategy: 'Remarketing to those who booked but did not close → VIP invitation with bonus and deadline.',
      audience: 'Those who started booking/quote in the last 14 days and did not close',
      persona: 'Ready to decide, needs a push and wants to feel special.',
      angle: 'Exclusivity / honest urgency', hook: 'We saved something special just for you',
      headline: 'Your VIP invitation with a bonus that ends this week',
      primaryText: 'You took the first step — now we are unlocking an exclusive bonus for those who close by Sunday. Limited spots.',
      cta: 'Secure my spot', imagePrompt: 'Premium detail of the product/service, soft gold, feeling of exclusivity',
      videoConcept: 'Reels “what you get by joining now” (bonus on screen).',
      landingPage: 'Offer page with bonus, deadline (countdown) and testimonials.',
      successMetrics: ['ROAS > 3.0', 'Remarketing conversion rate > 8%'],
      expectedOutcome: '8–12% conversion of hot leads, ticket preserved.',
      risk: 'If the urgency is fake, it burns trust. Use a real, rotating deadline.',
      variations: [
        { angle: 'Bonus', hook: 'An extra that only those who join this week get', headline: 'The VIP bonus ends Sunday' },
        { angle: 'Belonging', hook: 'Join the group that has already decided', headline: 'Your place among VIP customers' },
      ],
    },
    cmp4: {
      name: 'Active customers — refer and earn an experience',
      whyStage: 'Current customer base. The AI chose Retention to increase repurchase and referrals — the cheapest growth there is.',
      offer: 'Exclusive experience for referrals (value, not cashback)', offerRationale: 'A reward in experience creates more perceived value and bond than money back.',
      goal: 'Increase repurchase and bring qualified referrals.',
      strategy: 'Customer audience (list/buyers pixel) → referral program.',
      audience: 'Buyers from the last 6 months',
      persona: 'Already trusts the brand, likes being recognized.',
      angle: 'Recognition / community', hook: 'You are already family — how about bringing someone?',
      headline: 'Refer a friend and earn a special experience',
      primaryText: 'Thanks for being a customer 💛 Refer someone and you both get something exclusive. As simple as that.',
      cta: 'I want to refer', imagePrompt: 'Two happy people sharing the business experience, human warmth',
      videoConcept: 'Reels of real customers referring (UGC).',
      landingPage: 'Referral program page with a unique link.',
      successMetrics: ['Referral rate > 5%', 'Referred-customer CAC < half of paid'],
      expectedOutcome: '30–50 qualified referrals/month at nearly zero cost.',
      risk: 'Low adoption if the prize is not exciting. Test different experiences.',
      variations: [{ angle: 'Gratitude', hook: 'A thank-you that becomes a gift for you and a friend', headline: 'Your referral is worth an experience' }],
    },
  }
  const R: Record<string, { title: string; detail: string; action: string }> = {
    r1: { title: 'Clicks on “Learn more”, but they leave on seeing the price', detail: 'In the consideration campaign, 38% click and leave on the pricing page. The audience has not yet perceived enough value.', action: 'Run an educational Top of Funnel before asking for conversion — nurture before selling.' },
    r2: { title: 'Saw services but did not ask for a quote', detail: '1,240 people visited the services page and did not move forward in the last 14 days.', action: 'Create remarketing with the free assessment offer for this audience.' },
    r3: { title: 'Swap discount for value', detail: 'The draft “-15%” campaign tends to attract bargain hunters and cuts the margin.', action: 'Replace with “exclusive limited-time bonus” — converts better without burning price.' },
    r4: { title: 'The guide campaign is healthy — scale it', detail: 'Cost per lead 40% below target and high CTR. There is room to increase budget.', action: 'Raise the budget by 30% gradually (avoids resetting learning).' },
    r5: { title: 'Form loses people at the 2nd question', detail: '46% drop-off after the second question of the lead form.', action: 'Reduce the form to 1 field (WhatsApp only) and ask for the rest later.' },
  }
  const pixelLabels = ['Saw the ad', 'Clicked (Learn more)', 'Visited the site', 'Saw services', 'Saw prices', 'Started contact', 'Converted']
  const reads = [
    { event: 'Saw prices → left', what: '38% drop off right after seeing the pricing page.', why: 'They arrive without enough perceived value — the offer looks expensive for their stage.', improve: 'Add social proof and value anchoring before the price; nurture with Top of Funnel.', nextCampaign: 'Educational campaign (free guide) targeting those who saw the price and left.' },
    { event: 'Started contact → did not finish', what: 'Half start the form and do not complete it.', why: 'A long form creates friction at the moment of highest interest.', improve: '1-field form + WhatsApp; qualify later.', nextCampaign: 'Remarketing “1 step left” for those who started and stopped.' },
    { event: 'Returning visitor', what: '2nd and 3rd visits without buying.', why: 'High interest, but no decision trigger.', improve: 'Offer a limited-time bonus (not a discount).', nextCampaign: 'Bottom of Funnel “VIP invitation” for returning visitors.' },
  ]
  const cr: Record<string, { angle: string; caption: string; tone: string }> = {
    cr1: { angle: 'Behind the scenes / authority', caption: 'The 3 mistakes almost everyone makes (and how to avoid them).', tone: 'Educational' },
    cr2: { angle: 'Value lead magnet', caption: 'Download the free guide and decide without mistakes. 👇', tone: 'Direct' },
    cr3: { angle: 'Social proof', caption: 'This is how hundreds chose right (swipe 👉).', tone: 'Trust' },
    cr4: { angle: 'Exclusivity', caption: 'Your VIP invitation with a bonus that ends Sunday.', tone: 'Premium' },
    cr5: { angle: 'Testimonial', caption: '“I did the free assessment and came back” — real customer.', tone: 'Emotional' },
  }
  const learn = [
    { dimension: 'Best hook', winner: 'Education / “the mistake to avoid”', note: '2.3× more clicks than a price hook.' },
    { dimension: 'Best creative', winner: 'Behind-the-scenes Reels with a real person', note: 'CTR 0.6pp above product photo.' },
    { dimension: 'Best CTA', winner: '“Download free guide”', note: 'Beats “Learn more” at Top of Funnel.' },
    { dimension: 'Best offer', winner: 'Free assessment/diagnosis', note: 'Converts more and preserves margin vs. discount.' },
    { dimension: 'Most profitable stage', winner: 'Remarketing (Bottom)', note: 'Highest ROAS — audience already warmed up.' },
    { dimension: 'Best time', winner: '7pm–9pm', note: 'Lowest CPM and highest completion rate.' },
  ]
  const ci: Record<string, { title: string; format: string; why: string }> = {
    ci1: { title: '"The 3 mistakes almost everyone makes" (educational carousel)', format: 'Carousel', why: 'Tested organically with above-average engagement — already validated before spending paid media on it.' },
    ci2: { title: 'Real behind-the-scenes of service/production', format: 'Reel', why: 'The behind-the-scenes format converted better than "posed" product in the latest Vault posts.' },
    ci3: { title: 'Testimonial of a recent real result', format: 'Product Focus', why: 'Concrete proof for those already considering — same logic as the Product Focus template in the Library.' },
    ci4: { title: 'Video testimonial from a satisfied customer', format: 'Reel', why: 'Social proof at the Bottom of Funnel reduces the final objection before conversion.' },
  }
  const sa: Record<string, { concept: string; goal: string; example: string }> = {
    sa1: { concept: '"Which of these describes you best?" — segments the audience by itself', goal: 'Discovery + pixel signal collection (who answered what)', example: '"Have you tried solving this on your own?" [Yes] [Not yet]' },
    sa2: { concept: 'Quick 2-question quiz to point to the right service', goal: 'Qualifies the lead before the click — arrives warmer', example: '"What is your biggest challenge today?" with 3 options' },
    sa3: { concept: 'Slider "how much does this bother you from 0 to 10"', goal: 'Gradual intent signal — separates curious from decided', example: '0 to 10 slider about the problem the business solves' },
    sa4: { concept: 'Countdown to the limited-time offer', goal: 'Real (not fake) urgency for Bottom of Funnel', example: 'Countdown to the end of the bonus, with an automatic reminder 1h before' },
  }
  return {
    ...d,
    campaigns: d.campaigns.map(c => ({ ...c, ...(C[c.id] ?? {}) })),
    recommendations: d.recommendations.map(r => ({ ...r, ...(R[r.id] ?? {}) })),
    pixelJourney: d.pixelJourney.map((p, i) => ({ ...p, label: pixelLabels[i] ?? p.label })),
    pixelReads: d.pixelReads.map((p, i) => ({ ...p, ...(reads[i] ?? {}) })),
    creatives: d.creatives.map(c => ({ ...c, ...(cr[c.id] ?? {}) })),
    learnings: d.learnings.map((l, i) => ({ ...l, ...(learn[i] ?? {}) })),
    contentIdeas: d.contentIdeas.map(c => ({ ...c, ...(ci[c.id] ?? {}) })),
    storyAds: d.storyAds.map(c => ({ ...c, ...(sa[c.id] ?? {}) })),
  }
}
