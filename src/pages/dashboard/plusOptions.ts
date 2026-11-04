// Botão "+" (Pacote B2, item 7): regra "só aparece se funciona de ponta a ponta". Função PURA (sem rede, sem React)
// pra poder ser testada por scripts/test-plus-options.mjs. O hook que busca os dados está em usePlusOptions.ts.
// Nada de setor aqui: o nome do item ("imóvel") e a existência do campo de sinal vêm da ficha (vertical_playbooks).

export interface MakeNowFormat { key: string; name: string; producer: string; surface: string }
export interface MakeNowItem { id: string; title: string }

/** Resultado da checagem de "Gerar peça agora" (creative-generate · make_now_options). */
export type MakeNowCheck =
  | { status: 'idle' }
  | { status: 'checking' }
  | { status: 'failed' } // rede caiu, status ≠ 200 (menos 402) ou resposta sem lista
  | { status: 'plan' } // 402: conta sem plano ativo
  | { status: 'ok'; formats: MakeNowFormat[]; items: MakeNowItem[] }

/** Pedaço da ficha que o menu precisa (CatalogSchema serve). undefined = carregando; null = ficha sem catálogo. */
export interface PlusSchema { itemLabel: string; signals: boolean }

export type PlusKey = 'item' | 'piece' | 'signal'
export interface PlusOption {
  key: PlusKey
  label: string
  /** enabled = clicável; checking = "Verificando…" desabilitada; unverifiable = "Não foi possível verificar" desabilitada. */
  state: 'enabled' | 'checking' | 'unverifiable'
  href?: string
}

export const CATALOG_PATH = '/dashboard/catalogo'
export const SIGNAL_PATH = '/dashboard/opportunities?add=signal'
/** Onde ficam as "Peças avulsas" (Agente de Conteúdo → Calendário, bloco abaixo das semanas). */
export const LOOSE_PIECES_PATH = '/dashboard/marketing-ai/content'

/**
 * Formato usável agora: post (não precisa de imóvel) OU qualquer outro tipo desde que exista imóvel com fotos
 * suficientes. `items` já vem filtrado do servidor (≥ 5 fotos); sem imóvel elegível, o servidor devolveria 400.
 */
export function usableFormats(formats: MakeNowFormat[], items: MakeNowItem[]): MakeNowFormat[] {
  return formats.filter(f => f.producer === 'post' || items.length > 0)
}

const TX = {
  pt: {
    item: 'Adicionar item', itemOf: (n: string) => `Adicionar ${n.toLowerCase()}`,
    piece: 'Gerar peça agora', signal: 'Adicionar sinal',
    checking: 'Verificando…', unverifiable: 'Não foi possível verificar',
  },
  en: {
    item: 'Add item', itemOf: (n: string) => `Add ${n.toLowerCase()}`,
    piece: 'Make a piece now', signal: 'Add signal',
    checking: 'Checking…', unverifiable: 'Could not verify',
  },
} as const

export function plusOptionStates(i: { readOnly: boolean; schema: PlusSchema | null | undefined; check: MakeNowCheck; lang?: 'pt' | 'en' }): PlusOption[] {
  const t = TX[i.lang ?? 'pt']
  const out: PlusOption[] = []

  // 1. Adicionar item — sempre existe (o catálogo abre). Só vira "?add=1" quando a ficha confirma que há formulário de criação.
  const hasForm = !!i.schema
  out.push({ key: 'item', label: hasForm ? t.itemOf(i.schema!.itemLabel) : t.item, state: 'enabled', href: hasForm ? `${CATALOG_PATH}?add=1` : CATALOG_PATH })

  // 2. Gerar peça agora — conta só-leitura nem chama (o guard abriria o modal de plano); 402 e zero formatos somem.
  if (!i.readOnly) {
    const c = i.check
    if (c.status === 'idle' || c.status === 'checking') out.push({ key: 'piece', label: t.piece, state: 'checking' })
    else if (c.status === 'failed') out.push({ key: 'piece', label: t.piece, state: 'unverifiable' })
    else if (c.status === 'ok' && usableFormats(c.formats, c.items).length > 0) out.push({ key: 'piece', label: t.piece, state: 'enabled' })
    // status 'plan' ou zero usáveis: não aparece
  }

  // 3. Adicionar sinal — precisa de conta com acesso e da ficha com o campo de local do motor de oportunidades.
  if (!i.readOnly && i.schema?.signals) out.push({ key: 'signal', label: t.signal, state: 'enabled', href: SIGNAL_PATH })

  return out
}

/** Texto das linhas desabilitadas, no idioma certo (a função acima já devolve o rótulo da ação; este é o complemento). */
export function plusStateNote(state: PlusOption['state'], lang: 'pt' | 'en' = 'pt'): string {
  const t = TX[lang]
  return state === 'checking' ? t.checking : state === 'unverifiable' ? t.unverifiable : ''
}
