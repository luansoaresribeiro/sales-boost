// Etapa C (dono, 23/11): MEMÓRIA POR IMÓVEL. Cada peça de imóvel grava o ÂNGULO (vista, localização, rotina, espaço,
// detalhe, investimento), o OBJETIVO (etapa do funil da vaga) e o PÚBLICO (marcas "para quem é", só tom). Antes de escrever
// a próxima peça do MESMO imóvel, o sistema escolhe um ângulo que tenha dado real e que não seja o da peça anterior — o
// imóvel é mostrado por lados diferentes, sem repetir a mesma abordagem. Tudo de setor vem da ficha (regra 6):
// config.content_rules.item_angles (ângulos, o que habilita cada um) e item_angle_recipes (receita que já tem ângulo fixo).
// Sem ficha = nada muda. Puro, testado em scripts/test-item-memory.mjs.

export interface AngleDef { key: string; label: string; prompt: string; marks: string[]; fields: string[] }
export interface ItemAnglesCfg { angles: AngleDef[]; recipes: Record<string, string>; lookback: number; audienceField: string | null }
export interface ItemMemory { angle: string | null; objective: string | null; audience: string[]; source: 'rodizio' | 'receita' | 'sem_angulo' }

const str = (v: unknown, max = 200) => (typeof v === 'string' ? v.trim().slice(0, max) : '')
const strs = (v: unknown, max = 20) => (Array.isArray(v) ? v.map(x => str(x, 120)).filter(Boolean).slice(0, max) : [])

export function itemAnglesCfgFrom(config: unknown): ItemAnglesCfg | null {
  const r = ((config && typeof config === 'object' ? config : {}) as { content_rules?: Record<string, unknown> }).content_rules ?? {}
  const angles = (Array.isArray(r.item_angles) ? r.item_angles : []).flatMap((a): AngleDef[] => {
    const o = (a && typeof a === 'object' ? a : {}) as Record<string, unknown>
    const key = str(o.key, 40)
    if (!/^[a-z_]{2,40}$/.test(key) || !str(o.prompt)) return []
    return [{ key, label: str(o.label, 60) || key, prompt: str(o.prompt, 300), marks: strs(o.marks), fields: strs(o.fields).filter(f => /^[a-z_0-9]{1,40}$/.test(f)) }]
  }).slice(0, 12)
  if (!angles.length) return null
  const recipes: Record<string, string> = {}
  for (const [k, v] of Object.entries(r.item_angle_recipes && typeof r.item_angle_recipes === 'object' ? r.item_angle_recipes as Record<string, unknown> : {}))
    if (/^[a-z_0-9]{2,60}$/.test(k) && angles.some(a => a.key === v)) recipes[k] = v as string
  const lb = Number(r.item_angle_lookback)
  const audienceField = str(r.item_audience_field, 40)
  return { angles, recipes, lookback: Number.isFinite(lb) && lb >= 1 && lb <= 10 ? Math.floor(lb) : 4, audienceField: /^[a-z_]{1,40}$/.test(audienceField) ? audienceField : null }
}

const filled = (v: unknown) => (Array.isArray(v) ? v.some(x => typeof x === 'string' && x.trim()) : v != null && String(v).trim() !== '')
/** Ângulos que o imóvel sustenta com dado real: uma marca do corretor OU um campo preenchido do cadastro. */
export function enabledAngles(cfg: ItemAnglesCfg, fields: Record<string, unknown>, marks: string[]): AngleDef[] {
  return cfg.angles.filter(a => a.marks.some(m => marks.includes(m)) || a.fields.some(f => filled(fields[f])))
}

/**
 * Escolhe o ângulo desta peça. `history` = ângulos das peças anteriores do MESMO imóvel, da mais nova para a mais antiga.
 * Receita com ângulo fixo na ficha (ex.: "3 coisas perto" = localização) usa o dela. Senão: entre os habilitados, o menos
 * usado nas últimas `lookback` peças, nunca o da peça anterior (se houver outro), empate pela ordem da ficha.
 */
export function pickAngle(cfg: ItemAnglesCfg | null, recipe: string, fields: Record<string, unknown>, marks: string[], history: (string | null)[]): { angle: AngleDef | null; source: ItemMemory['source']; why: string | null } {
  if (!cfg) return { angle: null, source: 'sem_angulo', why: null }
  const fixed = cfg.recipes[recipe]
  if (fixed) return { angle: cfg.angles.find(a => a.key === fixed) ?? null, source: 'receita', why: null }
  const ok = enabledAngles(cfg, fields, marks)
  if (!ok.length) return { angle: null, source: 'sem_angulo', why: null }
  const recent = history.slice(0, cfg.lookback)
  const last = recent.find(h => !!h) ?? null
  const pool = ok.length > 1 ? ok.filter(a => a.key !== last) : ok
  const uses = (k: string) => recent.filter(h => h === k).length
  const angle = [...pool].sort((a, b) => uses(a.key) - uses(b.key) || ok.indexOf(a) - ok.indexOf(b))[0]
  const lastLabel = last ? cfg.angles.find(a => a.key === last)?.label ?? last : null
  return { angle, source: 'rodizio', why: lastLabel && lastLabel !== angle.label ? `a peça anterior deste imóvel foi "${lastLabel}"` : null }
}

/** Linha do pedido à IA (o mesmo pedido de sempre, sem chamada nova). O público só ajusta o tom — nunca vira rótulo. */
export function angleLine(angle: AngleDef | null, audience: string[]): string {
  const parts: string[] = []
  if (angle) parts.push(`\nÂNGULO DESTA PEÇA: ${angle.label} — ${angle.prompt} Use só fatos do cadastro.`)
  if (audience.length) parts.push(`\nTOM PENSADO PARA (não escreva para quem é o imóvel, não rotule o público): ${audience.join(' · ')}.`)
  return parts.join('')
}

export function audienceOf(cfg: ItemAnglesCfg | null, fields: Record<string, unknown>): string[] {
  if (!cfg?.audienceField) return []
  const v = fields[cfg.audienceField]
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string' && !!x.trim()).slice(0, 5) : []
}

/** Ângulo gravado numa peça antiga (brief.memory.angle); peça de antes da etapa C = null. */
export function angleOfBrief(brief: unknown): string | null {
  const m = (brief && typeof brief === 'object' ? (brief as { memory?: { angle?: unknown } }).memory : null)
  return m && typeof m.angle === 'string' ? m.angle : null
}
