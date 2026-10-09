// Plano do tour do plano pago (decisão do dono 2026-10-09, docs/DECISIONS.md):
// a IA olha TODAS as fotos do imóvel, diz o ambiente de cada uma, junta as
// repetidas, escolhe a melhor foto de cada ambiente, anota o que aparece pelas
// portas e propõe a ordem da caminhada. O CÓDIGO (não a IA) decide se cada
// passagem é "confirmada" (um dos dois ambientes aparece na foto do outro) ou
// "não confirmada" — é isso que a tela mostra pro corretor aprovar.
// Vocabulário do setor (tipos de ambiente, zonas, sequência típica) vem da
// ficha: vertical_playbooks.config.tour (regra 6). Sem ficha, usa termos genéricos.

export interface TourFicha {
  room_types?: string[]
  zones?: string[]
  sequence_hint?: string
  max_rooms?: number
}

export interface PhotoInfo { index: number; ambiente_id: string; qualidade: number; problema: string | null }
export interface Ambiente { id: string; nome: string; tipo: string; zona: string; melhor_foto: number; ve: string[]; evidencia: string }
export interface Analysis { fotos: PhotoInfo[]; ambientes: Ambiente[]; ordem: string[]; observacoes: string }

export interface PlanStep { ambiente_id: string; nome: string; zona: string; photo: string }
export interface PlanLink { from: string; to: string; confirmado: boolean; evidencia: string }
export interface TourPlan { steps: PlanStep[]; links: PlanLink[]; excluidos: { photo: string; motivo: string }[]; observacoes: string }

export const ANALYSIS_MODEL = 'claude-opus-5-5'
// Preço por 1M tokens (entrada/saída) do modelo acima — pra registrar o custo (regra 7).
export const ANALYSIS_PRICE = { input: 4, output: 20 }

const SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['fotos', 'ambientes', 'ordem', 'observacoes'],
  properties: {
    fotos: {
      type: 'array',
      items: {
        type: 'object', additionalProperties: false,
        required: ['index', 'ambiente_id', 'qualidade', 'problema'],
        properties: {
          index: { type: 'integer' },
          ambiente_id: { type: 'string' },
          qualidade: { type: 'integer' },
          problema: { anyOf: [{ type: 'string' }, { type: 'null' }] },
        },
      },
    },
    ambientes: {
      type: 'array',
      items: {
        type: 'object', additionalProperties: false,
        required: ['id', 'nome', 'tipo', 'zona', 'melhor_foto', 've', 'evidencia'],
        properties: {
          id: { type: 'string' }, nome: { type: 'string' }, tipo: { type: 'string' }, zona: { type: 'string' },
          melhor_foto: { type: 'integer' },
          ve: { type: 'array', items: { type: 'string' } },
          evidencia: { type: 'string' },
        },
      },
    },
    ordem: { type: 'array', items: { type: 'string' } },
    observacoes: { type: 'string' },
  },
}

function instructions(ficha: TourFicha, maxRooms: number): string {
  const types = ficha.room_types?.length ? ficha.room_types.join(', ') : 'use nomes curtos e claros'
  const zones = ficha.zones?.length ? ficha.zones.join(', ') : 'agrupe em 3 a 5 zonas'
  return [
    'Você vai planejar um vídeo-tour em caminhada a partir de fotos REAIS de um único lugar. Cada passagem do vídeo vai da foto de um ambiente até a foto do próximo, então a câmera precisa poder andar de um pro outro.',
    '',
    'Para cada foto (pelo número):',
    '- ambiente_id: o mesmo id pra todas as fotos do MESMO ambiente físico (ângulos diferentes do mesmo cômodo = mesmo id). Ambientes iguais mas fisicamente diferentes (ex.: dois quartos) têm ids diferentes.',
    '- qualidade de 1 a 5 (luz, nitidez, enquadramento, mostra bem o ambiente).',
    '- problema: null, ou o motivo curto se a foto NÃO deve entrar no vídeo (pessoa visível ou refletida, muito escura, tremida, torta, foto de detalhe que não mostra o ambiente). Objetos do dia a dia não são problema.',
    '',
    `Para cada ambiente: nome curto em português, tipo (${types}), zona (${zones}), melhor_foto (o número da melhor foto sem problema), ve = ids dos OUTROS ambientes que aparecem de verdade em alguma foto deste (pela porta, abertura, escada ou vidro), e evidencia = em uma frase, o que você viu que liga os ambientes (ou "nenhuma ligação visível").`,
    'Só coloque em "ve" o que dá pra ver na foto. Não deduza pela planta típica.',
    '',
    `ordem: os ids na ordem da caminhada, no máximo ${maxRooms} ambientes. Regras: comece pela entrada (ou fachada, se houver); passe de um ambiente pra outro que esteja ligado sempre que possível; agrupe por zona; deixe o ambiente mais impressionante (vista, piscina, área de lazer) pro final. Se precisar cortar ambientes, corte os menos importantes (banheiros e áreas de serviço primeiro).`,
    ficha.sequence_hint ? `Sequência típica deste tipo de lugar: ${ficha.sequence_hint}` : '',
    '',
    'observacoes: 1 a 3 frases pro corretor, em português simples (ex.: quais ligações você não conseguiu confirmar).',
  ].filter(Boolean).join('\n')
}

// deno-lint-ignore no-explicit-any
export function buildAnalysisBody(photoUrls: string[], ficha: TourFicha): Record<string, any> {
  const maxRooms = Math.max(3, Math.min(ficha.max_rooms ?? 25, 40))
  // deno-lint-ignore no-explicit-any
  const content: any[] = []
  photoUrls.forEach((url, i) => {
    content.push({ type: 'text', text: `Foto ${i + 1}:` })
    content.push({ type: 'image', source: { type: 'url', url } })
  })
  content.push({ type: 'text', text: instructions(ficha, maxRooms) })
  return {
    model: ANALYSIS_MODEL,
    max_tokens: 16000,
    output_config: { effort: 'medium', format: { type: 'json_schema', schema: SCHEMA } },
    messages: [{ role: 'user', content }],
  }
}

export function analysisCostUsd(usage: { input_tokens?: number; output_tokens?: number } | undefined): number {
  if (!usage) return 0
  return ((usage.input_tokens ?? 0) * ANALYSIS_PRICE.input + (usage.output_tokens ?? 0) * ANALYSIS_PRICE.output) / 1e6
}

// Monta o plano a partir da análise, validando tudo o que a IA devolveu
// (índices fora do intervalo, ids repetidos ou inexistentes, foto com problema).
export function buildPlan(a: Analysis, photoUrls: string[]): TourPlan {
  const n = photoUrls.length
  const photoOk = new Map<number, PhotoInfo>()
  const excluidos: TourPlan['excluidos'] = []
  for (const f of a.fotos ?? []) {
    if (!Number.isInteger(f.index) || f.index < 1 || f.index > n) continue
    if (f.problema) excluidos.push({ photo: photoUrls[f.index - 1], motivo: f.problema })
    else photoOk.set(f.index, f)
  }
  const amb = new Map<string, Ambiente>()
  for (const x of a.ambientes ?? []) if (x?.id && !amb.has(x.id)) amb.set(x.id, x)

  // Melhor foto válida do ambiente: a indicada, se não tem problema; senão a de maior qualidade.
  const bestPhoto = (id: string): number | null => {
    const x = amb.get(id)
    if (x && photoOk.has(x.melhor_foto) && photoOk.get(x.melhor_foto)!.ambiente_id === id) return x.melhor_foto
    let best: PhotoInfo | null = null
    for (const f of photoOk.values()) if (f.ambiente_id === id && (!best || f.qualidade > best.qualidade)) best = f
    return best?.index ?? null
  }

  const seen = new Set<string>()
  const steps: PlanStep[] = []
  for (const id of a.ordem ?? []) {
    if (seen.has(id) || !amb.has(id)) continue
    const idx = bestPhoto(id)
    if (idx === null) continue
    seen.add(id)
    const x = amb.get(id)!
    steps.push({ ambiente_id: id, nome: x.nome, zona: x.zona, photo: photoUrls[idx - 1] })
  }
  return { steps, links: linksFor(steps, a), excluidos, observacoes: String(a.observacoes ?? '') }
}

// Passagem confirmada = um dos dois ambientes aparece na foto do outro.
// Recalculada sempre que o corretor muda a ordem.
export function linksFor(steps: PlanStep[], a: Pick<Analysis, 'ambientes'>): PlanLink[] {
  const amb = new Map<string, Ambiente>()
  for (const x of a.ambientes ?? []) if (x?.id && !amb.has(x.id)) amb.set(x.id, x)
  const links: PlanLink[] = []
  for (let i = 0; i < steps.length - 1; i++) {
    const A = amb.get(steps[i].ambiente_id), B = amb.get(steps[i + 1].ambiente_id)
    const ok = !!A && !!B && ((A.ve ?? []).includes(B.id) || (B.ve ?? []).includes(A.id))
    const ev = ok ? ((A!.ve ?? []).includes(B!.id) ? A!.evidencia : B!.evidencia) : ''
    links.push({ from: steps[i].ambiente_id, to: steps[i + 1].ambiente_id, confirmado: ok, evidencia: ev })
  }
  return links
}
