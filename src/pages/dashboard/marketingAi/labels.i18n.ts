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

// Saúde da Meta / Insights (metaHealthDemo, growthIntelDemo)
export const PRIORITY_EN: Record<string, string> = { critical: 'Critical', high: 'High', medium: 'Medium', low: 'Low' }
export const DIFFICULTY_EN: Record<string, string> = { easy: 'Easy', medium: 'Medium', hard: 'Hard' }
export const INSIGHT_CAT_EN: Record<string, string> = {
  evento: 'Events', feriado: 'Dates', sazonal: 'Seasonal', tendencia: 'Trends', opiniao: 'Opinions', parceria: 'Partnerships',
  influenciador: 'Influencers', concorrente: 'Competitors', setor: 'Industry',
}

// Funil de vendas / Engagement (salesDemo, engagementDemo)
export const STAGE_EN: Record<string, string> = { novo: 'New Lead', contato: 'Contacted', qualificado: 'Qualified', proposta: 'Proposal', venda: 'Sale closed' }
export const TEMP_EN: Record<string, string> = { quente: 'Hot', morno: 'Warm', frio: 'Cold' }
export const TRIGGER_EN: Record<string, string> = { ig_comment: 'Instagram comment', ig_dm: 'Instagram DM', mention: 'Mention' }
export const INTENT_EN: Record<string, { label: string; desc: string }> = {
  keyword: { label: 'Keyword', desc: 'Triggers when the comment contains one of the words.' },
  ai_intent: { label: 'AI understands the intent', desc: 'The AI interprets the meaning (e.g.: "send it to me", "I want the material", "where can I get it?").' },
  any: { label: 'Any comment', desc: 'Any comment on the post triggers it.' },
  question: { label: 'Question', desc: 'When the comment is a question.' },
  purchase_intent: { label: 'Purchase intent', desc: 'When it shows interest in buying/price.' },
  positive: { label: 'Positive sentiment', desc: 'When the comment is complimentary/positive.' },
}
export const ACTION_EN: Record<string, { label: string; desc: string }> = {
  send_dm: { label: 'Send DM', desc: 'Sends a direct message with the promised resource.' },
  create_lead: { label: 'Create lead', desc: 'Registers the person as a lead in the pipeline.' },
  start_qualification: { label: 'Start qualification', desc: 'Starts a qualification conversation.' },
  answer_question: { label: 'Answer question', desc: 'The AI answers a simple question.' },
}
export const EVENT_STATUS_EN: Record<string, string> = { detected: 'Detected', awaiting_approval: 'Awaiting approval', sent: 'Sent', failed: 'Failed', lead_created: 'Lead created' }
export const AUTO_ACTION_EN: Record<string, string> = {
  send_dm: 'Send resource by DM', answer_question: 'Answer simple questions', create_lead: 'Create lead',
  purchase_inquiry: 'Handle purchase interest', offer_discount: 'Offer discount', escalate_complaint: 'Escalate complaint',
}
