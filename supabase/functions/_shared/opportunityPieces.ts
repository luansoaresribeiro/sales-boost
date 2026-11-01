// Opportunity Engine — Etapa 4, Parte B: do PLANO aprovado às PEÇAS em rascunho (lógica PURA, sem Deno/rede;
// roda no Deno e no teste em Node: scripts/test-opportunity-pieces.mjs). O banco e o despacho ficam em
// opportunityPiecesRun.ts; a montagem da vaga (ficha + banco) em opportunityPieceJob.ts.
//
// Princípio "Tudo automático": ninguém aperta "gerar" — o dono aprova o plano e as peças nascem sozinhas, como
// RASCUNHO na Central de Aprovações (regra 1: nada publica). Aqui só se DECIDE o que gerar:
//  - só formatos SEM custo extra de vídeo (carrossel, post, story de imagem/texto). 'reel' vira carrossel e o plano
//    registra que "vídeo fica para quando o dono liberar custo de vídeo" (decisão de custo pendente);
//  - foto de imóvel é sempre real (regra 4): item com menos de 5 fotos reais não vira peça de foto — vira peça de
//    TEXTO (carrossel de slides da marca) ou é pulado, com o motivo registrado;
//  - no máximo 3 peças por plano e 6 peças de oportunidade por empresa por dia;
//  - idempotente: plano que já tem peça (ou já foi despachado) não gera de novo.
import { MAX_PIECES_PER_PLAN, clampPieces } from './opportunityPlan.ts'
import type { Lang } from './opportunityEngine.ts'

export const MAX_PIECES_PER_DAY = 6
export const MIN_ITEM_PHOTOS = 5 // o catalog-package exige 5 fotos reais por item
export const PIECES_TASK_KEY = 'opportunity_pieces'
export const STALE_DISPATCH_MS = 30 * 60_000 // despachado e, 30 min depois, nenhuma peça no banco → rede de segurança tenta de novo
const tr = (lang: Lang, pt: string, en: string) => (lang === 'en' ? en : pt)

export type PieceFormat = 'carousel' | 'post' | 'story'
export type PieceMode = 'item' | 'text'
export interface PieceSpec { format: PieceFormat; mode: PieceMode; item_id?: string }

/** Formato do plano → formato que sai SEM custo de vídeo. 'reel' (ou qualquer coisa fora da lista) vira carrossel. */
export function videoFree(f: unknown): { format: PieceFormat; videoDeferred: boolean } {
  if (f === 'carousel' || f === 'post' || f === 'story') return { format: f, videoDeferred: false }
  return { format: 'carousel', videoDeferred: f === 'reel' }
}

export type Skip = 'already' | 'daily_limit' | 'nothing'
export interface PiecesDecision { specs: PieceSpec[]; format: PieceFormat; videoDeferred: boolean; notes: string[]; skip?: Skip }

export const RETRY_TASK_KEY = 'opportunity_pieces_retry' // linha gravada ao retentar: a retentativa é ÚNICA por oportunidade
export const CREATED_TASK_KEY = 'opportunity_piece_created' // linha gravada quando uma peça realmente nasce (sobrevive à exclusão do rascunho)

/**
 * Idempotência. `go` = pode despachar; `retry` = despachado há > 30 min e NENHUMA peça jamais existiu (a geração em segundo
 * plano falhou) e ainda não houve retentativa; `already` = não faz nada.
 *  - `everCreated` = linhas 'opportunity_piece_created' (sem janela de tempo): se o dono EXCLUIU o rascunho, a peça já existiu
 *    e NUNCA é regerada sozinha;
 *  - `retried` = existe linha 'opportunity_pieces_retry' desta oportunidade (retentativa única, vale com 1, 2 ou 3 peças pedidas).
 */
export function idempotency(opts: { generatedAt: string | null; existingPieces: number; everCreated: number; retried: boolean; nowMs: number }): 'go' | 'retry' | 'already' {
  if (opts.existingPieces > 0 || opts.everCreated > 0) return 'already'
  if (!opts.generatedAt) return 'go'
  const at = Date.parse(opts.generatedAt)
  if (Number.isFinite(at) && opts.nowMs - at > STALE_DISPATCH_MS && !opts.retried) return 'retry'
  return 'already'
}

/** Itens do plano com fotos reais suficientes para uma peça de foto, na ordem do plano, sem repetir. */
export function itemsWithPhotos(itemIds: unknown, photoCounts: Record<string, number>): string[] {
  const ids = Array.isArray(itemIds) ? itemIds.filter((x): x is string => typeof x === 'string') : []
  return [...new Set(ids)].filter(id => (photoCounts[id] ?? 0) >= MIN_ITEM_PHOTOS)
}

/**
 * Decide as peças do plano. `usedToday` = peças de oportunidade já despachadas pela empresa nas últimas 24 h.
 * Peça de foto: 1 por item (itens diferentes, na ordem do plano). Peça de texto: no máx. 1 por plano — completa
 * quando faltam itens com foto (ou nenhum tem), porque duas peças de texto com a mesma mensagem seriam repetição.
 */
export function decidePieces(opts: {
  plan: { format_suggestion?: unknown; item_ids?: unknown; pieces_count?: unknown }
  photoCounts: Record<string, number>; usedToday: number; existingPieces: number; lang: Lang
}): PiecesDecision {
  const { lang } = opts
  const { format, videoDeferred } = videoFree(opts.plan.format_suggestion)
  const notes: string[] = []
  if (videoDeferred) notes.push(tr(lang, 'Vídeo fica para quando o dono liberar custo de vídeo: as peças saíram como carrossel.', 'Video waits until the owner approves video costs: the pieces were made as a carousel.'))
  if (opts.existingPieces > 0) return { specs: [], format, videoDeferred, notes, skip: 'already' }

  const left = Math.max(0, MAX_PIECES_PER_DAY - Math.max(0, opts.usedToday))
  if (left === 0) return { specs: [], format, videoDeferred, notes: [...notes, tr(lang, `Limite de ${MAX_PIECES_PER_DAY} peças de oportunidade por dia atingido; as peças saem quando houver vaga.`, `Daily limit of ${MAX_PIECES_PER_DAY} opportunity pieces reached; the pieces will be made when there is room.`)], skip: 'daily_limit' }

  const wanted = Math.min(clampPieces(opts.plan.pieces_count), MAX_PIECES_PER_PLAN, left)
  if (wanted < clampPieces(opts.plan.pieces_count)) notes.push(tr(lang, `Só ${wanted} peça(s) por causa do limite diário.`, `Only ${wanted} piece(s) because of the daily limit.`))
  const items = itemsWithPhotos(opts.plan.item_ids, opts.photoCounts)
  const specs: PieceSpec[] = items.slice(0, wanted).map(item_id => ({ format, mode: 'item', item_id }))
  if (specs.length < wanted) {
    specs.push({ format, mode: 'text' })
    notes.push(items.length === 0
      ? tr(lang, `Nenhum item ligado tem ${MIN_ITEM_PHOTOS} fotos reais: a peça saiu só de texto (carrossel educativo), sem imagem de imóvel.`, `No linked item has ${MIN_ITEM_PHOTOS} real photos: the piece is text only (educational carousel), with no property image.`)
      : tr(lang, 'Peça de texto para completar: só os itens com fotos reais suficientes viram peça de foto.', 'Text piece to fill the plan: only items with enough real photos become photo pieces.'))
    if (specs.length < wanted) notes.push(tr(lang, 'Não gerei mais peças de texto: repetiriam a mesma mensagem.', 'No more text pieces were made: they would repeat the same message.'))
  }
  return { specs, format, videoDeferred, notes }
}

// ── Formato do plano → formato do catálogo da ficha (regra 6: o mapa vive em config.opportunity_pieces) ──────────
export interface CatalogFormatLite { key: string; producer: string; status: string; recipe?: string }
/**
 * `cfg` = vertical_playbooks.config.opportunity_pieces: { carousel: { item: "<formato>", text: "<formato>" }, post: …, story: … }.
 * Devolve a chave do formato do catálogo a usar, ou:
 *  - { key: null } no modo texto sem mapa → o carrossel de slides genérico do creative-generate;
 *  - null no modo foto sem mapa válido → quem chamou cai para o modo texto.
 * Só vale formato `live`; foto = item_package com receita; texto = post. Vídeo/DM NUNCA (custo extra / envio).
 */
export function resolveFormatKey(cfg: unknown, format: PieceFormat, mode: PieceMode, formats: CatalogFormatLite[]): { key: string | null } | null {
  const entry = (cfg && typeof cfg === 'object' ? (cfg as Record<string, unknown>)[format] : null) as Record<string, unknown> | null
  const want = entry && typeof entry === 'object' && typeof entry[mode] === 'string' ? String(entry[mode]) : ''
  const f = want ? formats.find(x => x.key === want) : undefined
  const ok = !!f && f.status === 'live' && (mode === 'item' ? f.producer === 'item_package' && !!f.recipe : f.producer === 'post')
  if (ok) return { key: f!.key }
  return mode === 'text' ? { key: null } : null
}

/** Item escolhido pelo plano vale para foto? (pertence ao plano e tem fotos reais suficientes.) */
export const itemUsable = (itemId: unknown, planItemIds: unknown, photoCount: number): itemId is string =>
  typeof itemId === 'string' && Array.isArray(planItemIds) && planItemIds.includes(itemId) && photoCount >= MIN_ITEM_PHOTOS
