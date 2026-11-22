// Pontos fortes, item 1 (dono, 22/11 — docs/PONTOS-FORTES.md §5): campos do cadastro que o corretor já preenche
// (vista, lazer, andar, vagas, "detalhe que ninguém percebe") e que nunca chegavam à legenda do pacote do imóvel.
// Quais campos entram vem da ficha (config.caption_fields = lista de chaves de catalog_fields, regra 6); o rótulo também.
// Campo "private" (ex.: endereço) nunca entra. Vazio = nada muda. Puro, testado em scripts/test-caption-fields.mjs.

type Label = string | { pt?: string; en?: string }
interface FieldDef { key: string; label?: Label; private?: boolean }
export interface CaptionField { key: string; label: string }

const pick = (l: Label | undefined, lang: 'pt' | 'en', key: string): string =>
  (typeof l === 'string' ? l : l?.[lang] ?? l?.pt ?? l?.en ?? key).trim() || key

/** Lê config.caption_fields + rótulos de config.catalog_fields. Chave sem definição ou privada fica de fora. */
export function captionFieldsFrom(config: unknown, lang: 'pt' | 'en' = 'pt'): CaptionField[] {
  const c = (config && typeof config === 'object' ? config : {}) as { caption_fields?: unknown; catalog_fields?: { required?: FieldDef[]; optional?: FieldDef[] } }
  const keys = Array.isArray(c.caption_fields) ? c.caption_fields.filter((k): k is string => typeof k === 'string' && !!k.trim()).slice(0, 12) : []
  const defs = new Map([...(c.catalog_fields?.required ?? []), ...(c.catalog_fields?.optional ?? [])].filter(d => d && typeof d.key === 'string').map(d => [d.key, d]))
  const out: CaptionField[] = []
  for (const k of keys) { const d = defs.get(k); if (d && !d.private && !out.some(o => o.key === k)) out.push({ key: k, label: pick(d.label, lang, k) }) }
  return out
}

/** Linha extra do prompt: "Vista: mar · Lazer: piscina…" só com o que o corretor preencheu (texto do cadastro, sem acrescentar). */
export function captionExtrasLine(fields: Record<string, unknown> | null | undefined, defs: CaptionField[]): string {
  const f = fields ?? {}
  const parts: string[] = []
  for (const d of defs) {
    const v = f[d.key]
    // Lista (caixinhas de pontos fortes, 22/11) vira "a, b, c".
    const raw = Array.isArray(v) ? v.filter(x => typeof x === 'string' && x.trim()).join(', ') : v
    const s = typeof raw === 'number' ? (Number.isFinite(raw) ? String(raw) : '') : typeof raw === 'string' ? raw.replace(/\s+/g, ' ').trim().slice(0, 300) : ''
    if (s) parts.push(`${d.label}: ${s}`)
  }
  return parts.length ? `\nDiferenciais informados pelo corretor (use só o que está aqui, sem acrescentar): ${parts.join(' · ')}` : ''
}
