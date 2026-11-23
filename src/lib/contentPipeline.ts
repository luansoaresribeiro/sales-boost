// Etapa B (dono, 23/11): "dashboard honesto". A faixa "Da produção ao resultado" mostra, em ordem, gerado → aprovado →
// publicado → alcance → leads → visitas, cada número com a FONTE e o estado. PURO (sem supabase), testado em
// scripts/test-content-pipeline.mjs. Regras: valor null = "sem dado" (consulta falhou ou estourou o limite), nunca 0 fingido;
// alcance sem Instagram conectado ou sem coleta = "não medido"; peça arquivada não conta como aprovada.

export type Lang = 'pt' | 'en'
export type StepState = 'medido' | 'nao_medido' | 'sem_dado'
export interface PipelineStep { key: string; label: string; value: number | null; source: string; state: StepState; hint?: string }

export interface PipelineInput {
  generated: number | null       // peças originais criadas no período (marketing_ai_test_content, source_id nulo)
  archived: number | null        // ...destas, arquivadas/recusadas (só para a dica)
  approved: number | null        // aprovadas por uma pessoa (agent_actions APPROVED com approved_by, ligadas a peça)
  published: number | null       // posts com instagram_media_id publicados no período
  reach: number | null           // soma do alcance das NOSSAS publicações (instagram_content_performance)
  reachRows: number | null       // quantas publicações nossas têm alcance coletado
  instagramConnected: boolean
  leads: number | null           // do funil comercial (mesma consulta do "Resultado comercial")
  visits: number | null
}

const TX = {
  pt: {
    generated: ['Gerados', 'posts criados pelo agente'], approved: ['Aprovados', 'aprovados por você em Aprovações'],
    published: ['Publicados', 'publicados no Instagram pelo Sales Boost'], reach: ['Alcance', 'contas alcançadas pelos posts publicados (Instagram)'],
    leads: ['Leads', 'contatos recebidos (formulário e Instagram)'], visits: ['Visitas', 'visitas marcadas no Funil'],
    archived: (n: number) => `${n} arquivado${n === 1 ? '' : 's'} ou recusado${n === 1 ? '' : 's'}`,
    noIg: 'Instagram não conectado', noInsights: 'o Instagram ainda não mandou o alcance destes posts',
    noPosts: 'nenhum post publicado no período', partial: (r: number, p: number) => `alcance coletado de ${r} de ${p} posts`,
    noQual: 'ainda sem regra de qualificação',
  },
  en: {
    generated: ['Generated', 'posts created by the agent'], approved: ['Approved', 'approved by you in Approvals'],
    published: ['Published', 'published to Instagram by Sales Boost'], reach: ['Reach', 'accounts reached by published posts (Instagram)'],
    leads: ['Leads', 'contacts received (form and Instagram)'], visits: ['Visits', 'visits set in the Funnel'],
    archived: (n: number) => `${n} archived or rejected`,
    noIg: 'Instagram not connected', noInsights: 'Instagram has not sent reach for these posts yet',
    noPosts: 'no posts published in this period', partial: (r: number, p: number) => `reach collected for ${r} of ${p} posts`,
    noQual: 'no qualification rule yet',
  },
}

const st = (v: number | null): StepState => (v == null ? 'sem_dado' : 'medido')

export function buildPipeline(i: PipelineInput, lang: Lang = 'pt'): PipelineStep[] {
  const t = TX[lang]
  const step = (key: keyof typeof TX['pt'] & ('generated' | 'approved' | 'published' | 'leads' | 'visits'), value: number | null, hint?: string): PipelineStep =>
    ({ key, label: t[key][0], source: t[key][1], value, state: st(value), ...(hint ? { hint } : {}) })

  // Alcance: só conta o que o Instagram mediu. Sem conexão, sem post publicado ou sem coleta = "não medido" (não 0).
  let reach: PipelineStep
  const base = { key: 'reach', label: t.reach[0], source: t.reach[1] }
  if (!i.instagramConnected) reach = { ...base, value: null, state: 'nao_medido', hint: t.noIg }
  else if (i.published == null || i.reach == null || i.reachRows == null) reach = { ...base, value: null, state: 'sem_dado' }
  else if (i.published === 0) reach = { ...base, value: null, state: 'nao_medido', hint: t.noPosts }
  else if (i.reachRows === 0) reach = { ...base, value: null, state: 'nao_medido', hint: t.noInsights }
  else reach = { ...base, value: i.reach, state: 'medido', ...(i.reachRows < i.published ? { hint: t.partial(i.reachRows, i.published) } : {}) }

  return [
    step('generated', i.generated, i.archived ? t.archived(i.archived) : undefined),
    step('approved', i.approved),
    step('published', i.published),
    reach,
    step('leads', i.leads, t.noQual),
    step('visits', i.visits),
  ]
}
