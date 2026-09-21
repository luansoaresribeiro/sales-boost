// Dados DEMO dos pilares de inteligência do Growth OS (ICP, Insights, Contexto).
// Tudo fictício — nenhuma API/banco real. Estrutura pronta pra, no futuro,
// vir de Meta/Google/Maps/Events/News/social listening/IA. Enquanto isso,
// simula informação realista pra um pequeno negócio local no Brasil.

export type Priority = 'high' | 'medium' | 'low'

export const PRIORITY_META: Record<Priority, { label: string; color: string }> = {
  high: { label: 'Alta', color: '#f87171' },
  medium: { label: 'Média', color: '#FBBF24' },
  low: { label: 'Baixa', color: '#60a5fa' },
}

// ── 1. ICP Engine (Feedback Loop) ─────────────────────────────────────────
export interface IcpProfile {
  headline: string
  confidence: number // 0-100
  demographics: string[]
  interests: string[]
  behaviors: string[]
  channels: { name: string; share: number }[]
  triggers: string[]
  avgTicket: string
}

export interface IcpSignal { title: string; detail: string; kind: 'change' | 'positioning' | 'opportunity' }

export function buildIcpDemo(businessType?: string | null, city?: string | null): {
  profile: IcpProfile; signals: IcpSignal[]; learning: { source: string; note: string }[]
} {
  const local = city ?? 'sua região'
  const profile: IcpProfile = {
    headline: `Mulheres 28–44, ${local}, renda média-alta, decidem por indicação e prova social`,
    confidence: 72,
    demographics: ['28–44 anos', '68% mulheres', `raio de 6 km de ${local}`, 'classe B/B+'],
    interests: ['gastronomia', 'bem-estar', 'experiências locais', 'vida saudável', 'família'],
    behaviors: ['salva mais do que curte', 'decide à noite (19h–22h)', 'compara antes de comprar', 'valoriza atendimento humano'],
    channels: [{ name: 'Instagram', share: 58 }, { name: 'Google/Maps', share: 24 }, { name: 'WhatsApp', share: 12 }, { name: 'Indicação', share: 6 }],
    triggers: ['review 5★ recente', 'promoção com prazo', 'conteúdo de bastidor', 'resposta rápida no direct'],
    avgTicket: 'R$ 90–140',
  }
  const signals: IcpSignal[] = [
    { kind: 'change', title: 'Público está ficando mais jovem', detail: 'A faixa 25–34 cresceu 14% nos últimos 60 dias — provavelmente por causa dos Reels de bastidores.' },
    { kind: 'change', title: 'Mais gente de fora do bairro', detail: 'Aumento de alcance a 8–12 km — vale testar um raio maior nos anúncios.' },
    { kind: 'positioning', title: 'Reforce “feito na hora / artesanal”', detail: 'Os posts que citam preparo artesanal têm 2,3× mais salvamentos — é o que diferencia você dos concorrentes.' },
    { kind: 'positioning', title: 'Fale mais de “experiência”, menos de “preço”', detail: 'Seu ICP responde a prova social e experiência; desconto puro atrai um público que não volta.' },
    { kind: 'opportunity', title: 'Público de “presentes corporativos”', detail: 'Há um segmento adjacente (empresas locais comprando em quantidade) ainda não explorado — ticket 3× maior.' },
    { kind: 'opportunity', title: 'Casais planejando eventos', detail: 'Buscas por “para festa/evento” subiram na região — um combo/kit pode capturar essa demanda.' },
  ]
  const learning = [
    { source: 'Engajamento', note: 'Reels de bastidor > carrossel de produto (salvamentos +130%).' },
    { source: 'Campanhas', note: 'Criativos com pessoas reais superam foto de produto isolada (CTR +0,8pp).' },
    { source: 'Horário', note: 'Postagens às 19h–20h rendem mais alcance que às 12h.' },
    { source: 'Reputação', note: 'Semanas com review nova 5★ têm mais conversa no direct.' },
  ]
  void businessType
  return { profile, signals, learning }
}

// ── 2. Insights (inteligência externa) ────────────────────────────────────
export type InsightCategory = 'evento' | 'sazonal' | 'feriado' | 'tendencia' | 'parceria' | 'influenciador' | 'concorrente' | 'setor' | 'opiniao'

export const INSIGHT_CATEGORY_META: Record<InsightCategory, { label: string; icon: string }> = {
  evento: { label: 'Evento local', icon: '📍' },
  sazonal: { label: 'Sazonal', icon: '🗓️' },
  feriado: { label: 'Feriado', icon: '🎉' },
  tendencia: { label: 'Tendência', icon: '📈' },
  parceria: { label: 'Parceria', icon: '🤝' },
  influenciador: { label: 'Influenciador', icon: '⭐' },
  concorrente: { label: 'Concorrente', icon: '🧭' },
  setor: { label: 'Setor', icon: '🏭' },
  opiniao: { label: 'Opinião do cliente', icon: '💬' },
}

export interface InsightItem {
  id: string
  category: InsightCategory
  opportunity: string
  why: string
  impact: string
  action: string
  priority: Priority
  confidence: number
  window: string
}

export function buildInsightsDemo(city?: string | null): InsightItem[] {
  const local = city ?? 'sua cidade'
  return [
    { id: 'i1', category: 'evento', opportunity: `Festival gastronômico em ${local} daqui a 3 semanas`, why: 'Milhares de pessoas do seu público-alvo circulam na região durante o evento.', impact: 'Alto — pico de tráfego e novos seguidores locais', action: 'Criar uma campanha “edição especial do festival” + presença nos stories geolocalizados.', priority: 'high', confidence: 82, window: 'Faltam 21 dias' },
    { id: 'i2', category: 'sazonal', opportunity: 'Início do inverno aquece a busca por pratos quentes', why: 'Buscas sazonais na sua categoria sobem ~30% nas próximas semanas.', impact: 'Médio — aumento de demanda orgânica', action: 'Antecipar o cardápio/linha de inverno e destacar nos posts e no Google.', priority: 'medium', confidence: 74, window: 'Próximas 4 semanas' },
    { id: 'i3', category: 'feriado', opportunity: 'Dia dos Namorados', why: 'Data de altíssima conversão para presentes e experiências a dois.', impact: 'Alto — ticket médio maior', action: 'Lançar um combo/kit para casais com prazo e reserva antecipada.', priority: 'high', confidence: 90, window: 'Faltam 33 dias' },
    { id: 'i4', category: 'parceria', opportunity: 'Academia nova a 2 quarteirões', why: 'Público com forte sobreposição com o seu ICP (bem-estar, vida saudável).', impact: 'Médio — troca de clientes qualificada', action: 'Propor cupom cruzado: cliente de um ganha benefício no outro.', priority: 'medium', confidence: 66, window: 'Sem prazo — abordar agora' },
    { id: 'i5', category: 'influenciador', opportunity: `Microinfluenciadora de ${local} (12k, nicho local)`, why: 'Audiência hiperlocal e engajada — custo baixo, prova social alta.', impact: 'Médio-alto — alcance qualificado', action: 'Convidar para uma experiência gratuita em troca de 1 Reels + stories.', priority: 'medium', confidence: 61, window: 'Sem prazo' },
    { id: 'i6', category: 'concorrente', opportunity: 'Concorrente principal subiu preços', why: 'Abre uma janela para atrair clientes sensíveis a custo-benefício sem baixar seu preço.', impact: 'Médio — captura de clientes insatisfeitos', action: 'Reforçar comunicação de valor (o que só você entrega) — não brigar por preço.', priority: 'low', confidence: 58, window: 'Janela de ~30 dias' },
    { id: 'i7', category: 'tendencia', opportunity: 'Formato “um dia na vida do negócio” viralizando', why: 'Formato de bastidor está com alto alcance orgânico no seu segmento.', impact: 'Médio — alcance e conexão', action: 'Gravar um Reels de rotina/bastidor esta semana enquanto o formato está quente.', priority: 'medium', confidence: 70, window: 'Enquanto durar a onda' },
    { id: 'i8', category: 'setor', opportunity: 'Alta na procura por pagamento via Pix parcelado', why: 'Facilidade de pagamento reduz atrito e aumenta conversão no seu ticket.', impact: 'Baixo-médio — menos carrinho abandonado', action: 'Comunicar claramente as formas de pagamento nos anúncios e no perfil.', priority: 'low', confidence: 55, window: 'Contínuo' },
  ]
}

// ── 3. Contexto do Negócio (memória estratégica do dono) ──────────────────
export type ContextCategory = 'operacao' | 'equipe' | 'estrategia' | 'financeiro' | 'marketing' | 'clientes' | 'expansao'

export const CONTEXT_CATEGORY_META: Record<ContextCategory, { label: string; icon: string }> = {
  operacao: { label: 'Operação', icon: '⚙️' },
  equipe: { label: 'Equipe', icon: '👥' },
  estrategia: { label: 'Estratégia', icon: '🎯' },
  financeiro: { label: 'Financeiro', icon: '💰' },
  marketing: { label: 'Marketing', icon: '📣' },
  clientes: { label: 'Clientes', icon: '🧑‍🤝‍🧑' },
  expansao: { label: 'Expansão', icon: '🚀' },
}

export type Importance = 'high' | 'medium' | 'low'
export const IMPORTANCE_META: Record<Importance, { label: string; color: string }> = {
  high: { label: 'Alta', color: '#f87171' },
  medium: { label: 'Média', color: '#FBBF24' },
  low: { label: 'Baixa', color: '#60a5fa' },
}

export interface ContextNote {
  id: string
  text: string
  category: ContextCategory
  tags: string[]
  importance: Importance
  effectiveDate: string // ISO date
  expirationDate?: string | null
  aiSummary: string
  createdAt: string
  updatedAt: string
  edits: number
  archived: boolean
}

export function buildContextDemo(): ContextNote[] {
  const today = new Date()
  const iso = (d: number) => new Date(today.getTime() + d * 86400000).toISOString().slice(0, 10)
  const ts = (d: number) => new Date(today.getTime() + d * 86400000).toISOString()
  return [
    { id: 'c1', text: 'Vamos focar em casamentos e eventos nesta temporada — quero campanhas e conteúdo puxando pra esse público.', category: 'estrategia', tags: ['casamentos', 'eventos', 'temporada'], importance: 'high', effectiveDate: iso(0), expirationDate: iso(120), aiSummary: 'Prioridade da temporada: público de casamentos/eventos. Vou priorizar campanhas, criativos e ofertas voltadas a esse segmento até ~4 meses.', createdAt: ts(-2), updatedAt: ts(-2), edits: 0, archived: false },
    { id: 'c2', text: 'Contratei mais uma vendedora, então agora conseguimos responder leads muito mais rápido.', category: 'equipe', tags: ['vendas', 'atendimento'], importance: 'medium', effectiveDate: iso(-5), expirationDate: null, aiSummary: 'Capacidade de atendimento aumentou — posso ser mais agressivo em geração de leads sem estourar o time.', createdAt: ts(-5), updatedAt: ts(-5), edits: 0, archived: false },
    { id: 'c3', text: 'Fechamos toda segunda-feira. Não agendar nada nem sugerir campanhas com chamada pra segunda.', category: 'operacao', tags: ['horário', 'funcionamento'], importance: 'high', effectiveDate: iso(-30), expirationDate: null, aiSummary: 'Fechado às segundas — nunca marcar ações, promoções ou reservas para esse dia.', createdAt: ts(-30), updatedAt: ts(-12), edits: 2, archived: false },
    { id: 'c4', text: 'Vamos aumentar os preços em ~8% no mês que vem por causa dos custos.', category: 'financeiro', tags: ['preço', 'margem'], importance: 'high', effectiveDate: iso(20), expirationDate: null, aiSummary: 'Reajuste de ~8% chegando — comunicar valor antes do aumento e evitar prometer preços antigos.', createdAt: ts(-1), updatedAt: ts(-1), edits: 0, archived: false },
    { id: 'c5', text: 'Estamos patrocinando o time de futebol do bairro esse ano.', category: 'marketing', tags: ['patrocínio', 'comunidade', 'bairro'], importance: 'low', effectiveDate: iso(-14), expirationDate: iso(300), aiSummary: 'Patrocínio local ativo — usar como prova de vínculo com a comunidade em conteúdo e relações públicas.', createdAt: ts(-14), updatedAt: ts(-14), edits: 0, archived: false },
    { id: 'c6', text: 'Perdemos nosso maior cliente corporativo mês passado — precisamos repor esse faturamento.', category: 'clientes', tags: ['b2b', 'faturamento'], importance: 'high', effectiveDate: iso(-25), expirationDate: null, aiSummary: 'Buraco de receita B2B — priorizar prospecção corporativa e ofertas para empresas para repor.', createdAt: ts(-25), updatedAt: ts(-20), edits: 1, archived: true },
  ]
}
