// Rótulos EN de metas de status/funil que vivem em arquivos de demo/dados
// (growthDemo, campaignDemo, metaHealthDemo). Mapeados pela CHAVE — assim a
// tela traduz sem mexer nos arquivos de dado. Em 'pt' usa-se o rótulo original.
export const AD_STATUS_EN: Record<string, string> = { active: 'Active', paused: 'Paused', learning: 'Learning' }
export const AD_RECO_EN: Record<string, string> = { pausar: 'Pause ad', orcamento: 'Adjust budget', criativo: 'New creative', publico: 'Audience', campanha: 'New campaign' }
export const CAMP_FUNNEL_EN: Record<string, { label: string; short: string }> = {
  awareness: { label: 'Top — Discovery', short: 'Top' },
  consideration: { label: 'Middle — Consideration', short: 'Middle' },
  conversion: { label: 'Bottom — Conversion', short: 'Bottom' },
  retention: { label: 'Retention', short: 'Retention' },
  remarketing: { label: 'Remarketing', short: 'Remkt' },
}
export const CAMP_STATUS_EN: Record<string, string> = { active: 'Active', scheduled: 'Scheduled', draft: 'Draft' }
export const HEALTH_CLASS_EN: Record<string, string> = { excellent: 'Excellent', very_good: 'Very good', good: 'Good', attention: 'Needs attention', critical: 'Critical' }
