import { supabase } from './supabase'

// Tipos de estabelecimento — geridos pelo dono no painel owner (tabela
// `business_types`). A lista abaixo é só um fallback pra nada quebrar se a
// consulta falhar ou a tabela estiver vazia. "Outro" nunca é armazenado: é uma
// opção de escape sempre adicionada na tela, com campo de texto livre.
export const FALLBACK_BUSINESS_TYPES = [
  'Restaurante / Food',
  'Varejo / E-commerce',
  'Serviços',
  'Beleza & Estética',
  'Barbearia',
  'Saúde & Bem-estar',
]

export const OTHER_BUSINESS_TYPE = 'Outro'

// `business_types.label` é a CHAVE em português: liga o negócio à ficha do setor
// (trigger sync_company_vertical_key) e ao plano (usePlanTier). Nunca traduzir o
// valor gravado — só o texto mostrado na tela. Rótulo fora do mapa aparece como veio.
const BUSINESS_TYPE_LABEL_EN: Record<string, string> = {
  'Imobiliárias': 'Real estate agencies',
  'Corretores de imóveis': 'Real estate agents',
  'Aluguel por temporada (Airbnb)': 'Short-term rentals (Airbnb)',
  'Restaurante / Food': 'Restaurant / Food',
  'Varejo / E-commerce': 'Retail / E-commerce',
  'Serviços': 'Services',
  'Beleza & Estética': 'Beauty & Aesthetics',
  'Barbearia': 'Barbershop',
  'Saúde & Bem-estar': 'Health & Wellness',
}

/** Texto exibido pro tipo de negócio no idioma da tela (o valor gravado não muda). */
export function businessTypeLabel(label: string, lang: 'pt' | 'en'): string {
  return lang === 'en' ? (BUSINESS_TYPE_LABEL_EN[label] ?? label) : label
}

export async function fetchBusinessTypes(): Promise<string[]> {
  try {
    const { data } = await supabase.from('business_types').select('label').eq('enabled', true).order('sort')
    const labels = ((data as { label: string }[] | null) ?? []).map(r => r.label)
    return labels.length ? labels : FALLBACK_BUSINESS_TYPES
  } catch {
    return FALLBACK_BUSINESS_TYPES
  }
}
