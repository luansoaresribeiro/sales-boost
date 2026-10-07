// ── Dados demo: Agente de Conteúdo + Inteligência de Mercado (Fase "agentes")
// Mesma lógica demo-first: números e itens estáveis por empresa, na mesma
// forma que a IA real (Claude + Apify) vai preencher quando ativada ao vivo.
import type { CompanyData } from '../../../contexts/CompanyContext'
import { seededRng, fmtNum } from './growthDemo'
import type { Lang } from '../../../contexts/LanguageContext'

// ── Agente de Conteúdo ───────────────────────────────────────────────────
export type ContentFormat = 'Reel' | 'Carrossel' | 'Story' | 'Foto'
export type ContentStatus = 'ideia' | 'rascunho' | 'aprovado' | 'agendado'

export const CONTENT_FORMAT_ICON: Record<ContentFormat, string> = { Reel: '🎬', Carrossel: '🖼️', Story: '⚡', Foto: '📷' }
export const CONTENT_STATUS_META: Record<ContentStatus, { label: string; color: string }> = {
  ideia: { label: 'Ideia', color: '#60a5fa' },
  rascunho: { label: 'Rascunho', color: '#FBBF24' },
  aprovado: { label: 'Aprovado', color: '#4ade80' },
  agendado: { label: 'Agendado', color: '#FF6D29' },
}

// Etapa do funil aplicada ao conteúdo ORGÂNICO (versão simples de 3 níveis).
export type ContentFunnel = 'topo' | 'meio' | 'fundo'
export const CONTENT_FUNNEL_META: Record<ContentFunnel, { label: string; short: string; color: string; icon: string; goal: string }> = {
  topo: { label: 'Topo — Atrair', short: 'Topo', color: '#60a5fa', icon: '👀', goal: 'Alcançar gente nova e ser descoberto.' },
  meio: { label: 'Meio — Nutrir', short: 'Meio', color: '#a78bfa', icon: '🤝', goal: 'Gerar confiança e autoridade em quem já conhece.' },
  fundo: { label: 'Fundo — Converter', short: 'Fundo', color: '#4ade80', icon: '🎯', goal: 'Levar quem já confia a agir (chamar, comprar).' },
}

// Direção criativa (direção de arte) — puxa do DNA da marca quando existir.
export interface ArtDirection { palette: string; style: string; reference: string; doNot: string }

export interface CalendarPost { day: string; time: string; format: ContentFormat; title: string; status: ContentStatus; funnel: ContentFunnel }
export interface ContentIdea { id: string; format: ContentFormat; hook: string; reasoning: string; funnel: ContentFunnel }
export interface FeaturedContent { format: ContentFormat; title: string; funnel: ContentFunnel; script: string[]; caption: string; hashtags: string; creative: string; art: ArtDirection }
export interface FunnelBalance { counts: Record<ContentFunnel, number>; insight: string }
export interface ContentDemo { calendar: CalendarPost[]; ideas: ContentIdea[]; featured: FeaturedContent; balance: FunnelBalance }

const DAYS_PT = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom']
const DAYS_EN = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

export function buildContentDemo(company: Pick<CompanyData, 'id' | 'business_name' | 'business_type'>, lang: Lang = 'pt'): ContentDemo {
  const L = (pt: string, en: string) => (lang === 'en' ? en : pt)
  const DAYS = lang === 'en' ? DAYS_EN : DAYS_PT
  const rng = seededRng((company.id || company.business_name || 'demo') + ':content')
  const pick = <T,>(arr: T[]): T => arr[Math.floor(rng() * arr.length)]
  const biz = company.business_name || L('sua empresa', 'your company')
  const type = company.business_type || L('negócio', 'business')

  const calendar: CalendarPost[] = [
    { day: DAYS[0], time: L('12h', '12pm'), format: 'Reel', title: L('Bastidores do dia a dia', 'Day-to-day behind the scenes'), status: 'agendado', funnel: 'topo' },
    { day: DAYS[1], time: L('18h', '6pm'), format: 'Carrossel', title: L('5 motivos para escolher a gente', '5 reasons to choose us'), status: 'aprovado', funnel: 'meio' },
    { day: DAYS[3], time: L('12h', '12pm'), format: 'Reel', title: L('Depoimento de cliente real', 'Real customer testimonial'), status: 'rascunho', funnel: 'fundo' },
    { day: DAYS[4], time: L('19h', '7pm'), format: 'Foto', title: L('Antes e depois', 'Before and after'), status: 'rascunho', funnel: 'fundo' },
    { day: DAYS[5], time: L('11h', '11am'), format: 'Story', title: L('Enquete: o que você prefere?', 'Poll: what do you prefer?'), status: 'ideia', funnel: 'meio' },
  ]

  const ideas: ContentIdea[] = [
    { id: 'i1', format: 'Reel', hook: L(`"O erro que todo mundo comete ao escolher ${type}"`, `"The mistake everyone makes when choosing ${type}"`), reasoning: L('Formato de "erro comum" gera salvamento e alcance — funciona bem no seu segmento.', 'The "common mistake" format generates saves and reach — it works well in your segment.'), funnel: 'topo' },
    { id: 'i2', format: 'Carrossel', hook: L('Passo a passo: como funciona por dentro', 'Step by step: how it works inside'), reasoning: L('Conteúdo educativo aumenta autoridade e tempo de tela.', 'Educational content increases authority and watch time.'), funnel: 'meio' },
    { id: 'i3', format: 'Reel', hook: L('Transformação em 15 segundos', 'Transformation in 15 seconds'), reasoning: L('Prova visual de resultado — o que mais converte, segundo o Feedback Loop.', 'Visual proof of results — what converts the most, according to the Feedback Loop.'), funnel: 'fundo' },
    { id: 'i4', format: 'Story', hook: L('Enquete: A ou B?', 'Poll: A or B?'), reasoning: L('Interação leve mantém a audiência aquecida entre os posts maiores.', 'Light interaction keeps the audience warm between the bigger posts.'), funnel: 'meio' },
  ]

  const featured: FeaturedContent = {
    format: 'Reel',
    title: L('Depoimento de cliente real', 'Real customer testimonial'),
    funnel: 'fundo',
    script: [
      L('0-3s: Gancho — cliente falando "eu quase desisti antes de conhecer a ' + biz + '"', '0-3s: Hook — customer saying "I almost gave up before I found ' + biz + '"'),
      L('3-10s: O problema que ela tinha (relacione com a dor do seu público)', '3-10s: The problem she had (relate it to your audience\'s pain)'),
      L('10-18s: A virada — como o seu ' + type + ' resolveu', '10-18s: The turning point — how your ' + type + ' solved it'),
      L('18-22s: Resultado concreto + chamada "chama no direct pra começar"', '18-22s: Concrete result + call "DM us to get started"'),
    ],
    caption: L(`A ${biz} existe pra isso: resolver de verdade. 💬 Essa é a história da Ana — e pode ser a sua também. Chama no direct que a gente te explica tudo sem compromisso. 👇`, `${biz} exists for this: to really solve it. 💬 This is Ana's story — and it can be yours too. DM us and we will explain everything with no commitment. 👇`),
    hashtags: `#${type.replace(/\s+/g, '').toLowerCase()} #${(company.business_name || 'salesboost').replace(/\s+/g, '').toLowerCase()} ${L('#depoimento #resultado', '#testimonial #results')}`,
    creative: L('Vídeo vertical 9:16, luz natural, legenda embutida (85% assiste sem som). Priorizar o rosto do cliente nos 3 primeiros segundos.', 'Vertical 9:16 video, natural light, burned-in captions (85% watch without sound). Prioritize the customer\'s face in the first 3 seconds.'),
    art: {
      palette: L('Laranja da marca em detalhes + tons quentes e neutros de fundo (puxado do DNA da marca).', 'Brand orange in details + warm and neutral background tones (pulled from the brand DNA).'),
      style: L('Real e humano — pessoas de verdade, luz natural, nada de banco de imagem genérico.', 'Real and human — real people, natural light, no generic stock imagery.'),
      reference: L('Enquadramento próximo no rosto, câmera na mão (autêntico), texto grande na tela.', 'Close framing on the face, handheld camera (authentic), large on-screen text.'),
      doNot: L('Sem stock frio, sem excesso de texto, sem fugir da paleta da marca.', 'No cold stock, no excess text, do not stray from the brand palette.'),
    },
  }

  // Distribuição do feed por etapa do funil + insight de equilíbrio.
  const counts: Record<ContentFunnel, number> = { topo: 0, meio: 0, fundo: 0 }
  calendar.forEach(p => { counts[p.funnel]++ })
  let insight = L('Feed equilibrado entre atrair, nutrir e converter — mantém o crescimento sustentável.', 'Feed balanced between attracting, nurturing and converting — keeps growth sustainable.')
  if (counts.topo === 0) insight = L('Falta conteúdo de Topo: você não está atraindo público novo. A IA sugere 1–2 Reels de descoberta.', 'Top content is missing: you are not attracting a new audience. The AI suggests 1–2 discovery Reels.')
  else if (counts.fundo > counts.topo + counts.meio) insight = L('Muito conteúdo de venda (Fundo) e pouco de atração. Isso cansa a audiência — equilibre com Topo e Meio.', 'Too much sales content (Bottom) and little attraction. This tires the audience — balance with Top and Middle.')
  else if (counts.meio === 0) insight = L('Falta conteúdo de Meio: você atrai e tenta vender, mas não nutre a confiança no meio do caminho.', 'Middle content is missing: you attract and try to sell, but do not nurture trust along the way.')

  void pick
  void fmtNum
  return { calendar, ideas, featured, balance: { counts, insight } }
}

// ── Inteligência de Mercado (Estratégica) ────────────────────────────────
export type MoveType = 'preco' | 'conteudo' | 'promocao' | 'crescimento'
export const MOVE_META: Record<MoveType, { icon: string; color: string }> = {
  preco: { icon: '💲', color: '#FBBF24' },
  conteudo: { icon: '🎬', color: '#60a5fa' },
  promocao: { icon: '🏷️', color: '#f87171' },
  crescimento: { icon: '📈', color: '#4ade80' },
}

export interface CompetitorMove { name: string; followers: number; postingFreq: string; engagement: number | null; move: string; moveType: MoveType | null }
export interface MarketTrend { id: string; title: string; description: string; relevance: 'high' | 'medium' | 'low' }
export interface MarketOpportunity { id: string; title: string; description: string; impact: 'high' | 'medium' | 'low' }
export interface MarketDemo { competitors: CompetitorMove[]; trends: MarketTrend[]; opportunities: MarketOpportunity[] }

const COMP_NAMES = ['Casa Bella', 'Studio Prime', 'Grupo Vitalis', 'Espaço Aurora', 'Central Nova']

export function buildMarketDemo(company: Pick<CompanyData, 'id' | 'business_name' | 'business_type' | 'city'>, lang: Lang = 'pt'): MarketDemo {
  const L = (pt: string, en: string) => (lang === 'en' ? en : pt)
  const rng = seededRng((company.id || company.business_name || 'demo') + ':market')
  const iBetween = (min: number, max: number) => Math.round(min + rng() * (max - min))
  const type = company.business_type || L('negócio', 'business')
  const city = company.city || L('sua região', 'your area')

  const competitors: CompetitorMove[] = [
    { name: COMP_NAMES[0], followers: iBetween(3000, 22000), postingFreq: L('5 posts/semana', '5 posts/week'), engagement: Number((rng() * 4 + 1).toFixed(1)), move: L('Subiu o preço do serviço principal em ~10%', 'Raised the price of its main service by ~10%'), moveType: 'preco' },
    { name: COMP_NAMES[1], followers: iBetween(3000, 22000), postingFreq: L('4 Reels/semana', '4 Reels/week'), engagement: Number((rng() * 4 + 1).toFixed(1)), move: L('Apostando forte em vídeos curtos de bastidores', 'Betting heavily on short behind-the-scenes videos'), moveType: 'conteudo' },
    { name: COMP_NAMES[2], followers: iBetween(3000, 22000), postingFreq: L('3 posts/semana', '3 posts/week'), engagement: Number((rng() * 4 + 1).toFixed(1)), move: L('Lançou promoção de primeira compra', 'Launched a first-purchase promotion'), moveType: 'promocao' },
    { name: COMP_NAMES[3], followers: iBetween(3000, 22000), postingFreq: L('6 posts/semana', '6 posts/week'), engagement: Number((rng() * 4 + 1).toFixed(1)), move: (() => { const g = iBetween(8, 20); return L(`Cresceu ${g}% de seguidores no último mês`, `Grew followers ${g}% in the last month`) })(), moveType: 'crescimento' },
  ]

  const trends: MarketTrend[] = [
    { id: 't1', title: L('Vídeos de bastidores estão bombando', 'Behind-the-scenes videos are booming'), description: L(`No nicho de ${type}, conteúdo "por dentro do negócio" está com o maior alcance orgânico agora.`, `In the ${type} niche, "inside the business" content has the highest organic reach right now.`), relevance: 'high' },
    { id: 't2', title: L('Prova social em vídeo', 'Social proof in video'), description: L('Depoimentos curtos de clientes convertem mais que qualquer anúncio institucional.', 'Short customer testimonials convert more than any institutional ad.'), relevance: 'high' },
    { id: 't3', title: L('Conteúdo educativo em carrossel', 'Educational carousel content'), description: L('Posts "como fazer / o que evitar" seguem gerando salvamento e autoridade.', '"How to / what to avoid" posts keep generating saves and authority.'), relevance: 'medium' },
  ]

  const opportunities: MarketOpportunity[] = [
    { id: 'o1', title: L(`Nenhum concorrente em ${city} usa depoimento em vídeo`, `No competitor in ${city} uses video testimonials`), description: L('Espaço aberto pra você dominar esse formato antes deles — o que mais converte hoje.', 'Open space for you to own this format before they do — what converts the most today.'), impact: 'high' },
    { id: 'o2', title: L('Concorrente subiu preço', 'Competitor raised prices'), description: L(`${COMP_NAMES[0]} ficou mais caro. Momento bom pra comunicar seu custo-benefício e capturar quem está pesquisando.`, `${COMP_NAMES[0]} got more expensive. Good time to communicate your value for money and capture people who are researching.`), impact: 'medium' },
    { id: 'o3', title: L('Frequência de postagem abaixo do nicho', 'Posting frequency below the niche'), description: L('Os líderes postam 5-6x/semana. Aumentar sua frequência já melhora alcance sem gastar em anúncio.', 'The leaders post 5-6x/week. Increasing your frequency already improves reach without spending on ads.'), impact: 'medium' },
  ]

  return { competitors, trends, opportunities }
}
