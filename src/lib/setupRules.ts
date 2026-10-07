import type { CatalogSchema, PlaybookQuestion } from './verticalPlaybook'

// Regras compartilhadas entre o sino de pendências (usePendencias) e a tela
// /setup (useSetupStatus). Tela e código andam juntos: o sino e o /setup
// NUNCA podem discordar sobre "pergunta respondida" ou "item com fotos
// suficientes" — por isso as duas telas usam estas mesmas funções.

export const DEFAULT_MIN_PHOTOS = 5 // mesmo default do catalog-package / CatalogItems

export function hasAnswer(v: unknown): boolean {
  if (v === null || v === undefined) return false
  if (Array.isArray(v)) return v.some(x => String(x ?? '').trim() !== '')
  return String(v).trim() !== ''
}

/** Perguntas da ficha sem resposta (chaves que não existem mais na ficha são ignoradas). */
export function unansweredQuestions(questions: PlaybookQuestion[], answers: Record<string, unknown> | null | undefined): PlaybookQuestion[] {
  return questions.filter(q => !hasAnswer(answers?.[q.key]))
}

/** Mínimo de fotos por item, vindo da ficha (campo do tipo 'photos'). */
export function catalogMinPhotos(schema: CatalogSchema | null | undefined): number {
  const photosField = schema ? [...schema.required, ...schema.optional].find(f => f.type === 'photos') : undefined
  return photosField?.min ?? DEFAULT_MIN_PHOTOS
}

export interface ItemMetaLike { photos?: unknown[]; fields?: unknown }

/** Item do catálogo estruturado (itens antigos de "Produtos", sem estrutura, não contam). */
export function isCatalogItem(meta: ItemMetaLike | null | undefined): boolean {
  return !!meta && (Array.isArray(meta.photos) || !!meta.fields)
}

export function itemPhotoCount(meta: ItemMetaLike | null | undefined): number {
  return meta && Array.isArray(meta.photos) ? meta.photos.length : 0
}

/** Item com fotos suficientes (>= mínimo da ficha). */
export function itemHasEnoughPhotos(meta: ItemMetaLike | null | undefined, min: number): boolean {
  return isCatalogItem(meta) && itemPhotoCount(meta) >= min
}
