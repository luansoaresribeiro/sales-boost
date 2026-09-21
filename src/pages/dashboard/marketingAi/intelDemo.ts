// ── Dados demo: Agente de Conteúdo + Inteligência de Mercado (Fase "agentes")
// Mesma lógica demo-first: números e itens estáveis por empresa, na mesma
// forma que a IA real (Claude + Apify) vai preencher quando ativada ao vivo.
import type { CompanyData } from '../../../contexts/CompanyContext'
import { seededRng, fmtNum } from './growthDemo'

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

const DAYS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom']

export function buildContentDemo(company: Pick<CompanyData, 'id' | 'business_name' | 'business_type'>): ContentDemo {
  const rng = seededRng((company.id || company.business_name || 'demo') + ':content')
  const pick = <T,>(arr: T[]): T => arr[Math.floor(rng() * arr.length)]
  const biz = company.business_name || 'sua empresa'
  const type = company.business_type || 'negócio'

  const calendar: CalendarPost[] = [
    { day: DAYS[0], time: '12h', format: 'Reel', title: 'Bastidores do dia a dia', status: 'agendado', funnel: 'topo' },
    { day: DAYS[1], time: '18h', format: 'Carrossel', title: '5 motivos para escolher a gente', status: 'aprovado', funnel: 'meio' },
    { day: DAYS[3], time: '12h', format: 'Reel', title: 'Depoimento de cliente real', status: 'rascunho', funnel: 'fundo' },
    { day: DAYS[4], time: '19h', format: 'Foto', title: 'Antes e depois', status: 'rascunho', funnel: 'fundo' },
    { day: DAYS[5], time: '11h', format: 'Story', title: 'Enquete: o que você prefere?', status: 'ideia', funnel: 'meio' },
  ]

  const ideas: ContentIdea[] = [
    { id: 'i1', format: 'Reel', hook: `"O erro que todo mundo comete ao escolher ${type}"`, reasoning: 'Formato de "erro comum" gera salvamento e alcance — funciona bem no seu segmento.', funnel: 'topo' },
    { id: 'i2', format: 'Carrossel', hook: 'Passo a passo: como funciona por dentro', reasoning: 'Conteúdo educativo aumenta autoridade e tempo de tela.', funnel: 'meio' },
    { id: 'i3', format: 'Reel', hook: 'Transformação em 15 segundos', reasoning: 'Prova visual de resultado — o que mais converte, segundo o Feedback Loop.', funnel: 'fundo' },
    { id: 'i4', format: 'Story', hook: 'Enquete: A ou B?', reasoning: 'Interação leve mantém a audiência aquecida entre os posts maiores.', funnel: 'meio' },
  ]

  const featured: FeaturedContent = {
    format: 'Reel',
    title: 'Depoimento de cliente real',
    funnel: 'fundo',
    script: [
      '0-3s: Gancho — cliente falando "eu quase desisti antes de conhecer a ' + biz + '"',
      '3-10s: O problema que ela tinha (relacione com a dor do seu público)',
      '10-18s: A virada — como o seu ' + type + ' resolveu',
      '18-22s: Resultado concreto + chamada "chama no direct pra começar"',
    ],
    caption: `A ${biz} existe pra isso: resolver de verdade. 💬 Essa é a história da Ana — e pode ser a sua também. Chama no direct que a gente te explica tudo sem compromisso. 👇`,
    hashtags: `#${type.replace(/\s+/g, '').toLowerCase()} #${(company.business_name || 'salesboost').replace(/\s+/g, '').toLowerCase()} #depoimento #resultado`,
    creative: 'Vídeo vertical 9:16, luz natural, legenda embutida (85% assiste sem som). Priorizar o rosto do cliente nos 3 primeiros segundos.',
    art: {
      palette: 'Laranja da marca em detalhes + tons quentes e neutros de fundo (puxado do DNA da marca).',
      style: 'Real e humano — pessoas de verdade, luz natural, nada de banco de imagem genérico.',
      reference: 'Enquadramento próximo no rosto, câmera na mão (autêntico), texto grande na tela.',
      doNot: 'Sem stock frio, sem excesso de texto, sem fugir da paleta da marca.',
    },
  }

  // Distribuição do feed por etapa do funil + insight de equilíbrio.
  const counts: Record<ContentFunnel, number> = { topo: 0, meio: 0, fundo: 0 }
  calendar.forEach(p => { counts[p.funnel]++ })
  let insight = 'Feed equilibrado entre atrair, nutrir e converter — mantém o crescimento sustentável.'
  if (counts.topo === 0) insight = 'Falta conteúdo de Topo: você não está atraindo público novo. A IA sugere 1–2 Reels de descoberta.'
  else if (counts.fundo > counts.topo + counts.meio) insight = 'Muito conteúdo de venda (Fundo) e pouco de atração. Isso cansa a audiência — equilibre com Topo e Meio.'
  else if (counts.meio === 0) insight = 'Falta conteúdo de Meio: você atrai e tenta vender, mas não nutre a confiança no meio do caminho.'

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

export function buildMarketDemo(company: Pick<CompanyData, 'id' | 'business_name' | 'business_type' | 'city'>): MarketDemo {
  const rng = seededRng((company.id || company.business_name || 'demo') + ':market')
  const iBetween = (min: number, max: number) => Math.round(min + rng() * (max - min))
  const type = company.business_type || 'negócio'
  const city = company.city || 'sua região'

  const competitors: CompetitorMove[] = [
    { name: COMP_NAMES[0], followers: iBetween(3000, 22000), postingFreq: '5 posts/semana', engagement: Number((rng() * 4 + 1).toFixed(1)), move: 'Subiu o preço do serviço principal em ~10%', moveType: 'preco' },
    { name: COMP_NAMES[1], followers: iBetween(3000, 22000), postingFreq: '4 Reels/semana', engagement: Number((rng() * 4 + 1).toFixed(1)), move: 'Apostando forte em vídeos curtos de bastidores', moveType: 'conteudo' },
    { name: COMP_NAMES[2], followers: iBetween(3000, 22000), postingFreq: '3 posts/semana', engagement: Number((rng() * 4 + 1).toFixed(1)), move: 'Lançou promoção de primeira compra', moveType: 'promocao' },
    { name: COMP_NAMES[3], followers: iBetween(3000, 22000), postingFreq: '6 posts/semana', engagement: Number((rng() * 4 + 1).toFixed(1)), move: `Cresceu ${iBetween(8, 20)}% de seguidores no último mês`, moveType: 'crescimento' },
  ]

  const trends: MarketTrend[] = [
    { id: 't1', title: 'Vídeos de bastidores estão bombando', description: `No nicho de ${type}, conteúdo "por dentro do negócio" está com o maior alcance orgânico agora.`, relevance: 'high' },
    { id: 't2', title: 'Prova social em vídeo', description: 'Depoimentos curtos de clientes convertem mais que qualquer anúncio institucional.', relevance: 'high' },
    { id: 't3', title: 'Conteúdo educativo em carrossel', description: 'Posts "como fazer / o que evitar" seguem gerando salvamento e autoridade.', relevance: 'medium' },
  ]

  const opportunities: MarketOpportunity[] = [
    { id: 'o1', title: `Nenhum concorrente em ${city} usa depoimento em vídeo`, description: 'Espaço aberto pra você dominar esse formato antes deles — o que mais converte hoje.', impact: 'high' },
    { id: 'o2', title: 'Concorrente subiu preço', description: `${COMP_NAMES[0]} ficou mais caro. Momento bom pra comunicar seu custo-benefício e capturar quem está pesquisando.`, impact: 'medium' },
    { id: 'o3', title: 'Frequência de postagem abaixo do nicho', description: 'Os líderes postam 5-6x/semana. Aumentar sua frequência já melhora alcance sem gastar em anúncio.', impact: 'medium' },
  ]

  return { competitors, trends, opportunities }
}
