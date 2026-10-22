// Intenção da estratégia que chega até a peça (PLANO-CRIATIVOS, fase 3,
// decisão B): pra que serve (pilar de Social Selling), o plano do pilar, a
// etapa do funil ligada (público · mensagem · CTA) e a linha central. Funções
// PURAS (testáveis fora do Deno). Sem pilar de Social Selling na ficha, não há
// intenção: o prompt fica idêntico ao de antes.
import { decideVideoCta, queroNotice, sanitizeCaptionCta, type VideoAutomation } from './videoCta.ts'

export interface SlotIntent {
  pilar_ss: string
  pilar_ss_name: string
  /** O que o pilar significa pro setor (ficha: "por que importa"). */
  pilar_ss_why?: string
  /** O que ESTA estratégia faz por este pilar (content_plan.pillars[].plan). */
  pillar_plan: string
  funnel: { stage: string; objective: string; audience: string; message: string; cta: string } | null
  central_line: string
}

interface SlotLike { format?: string; pilar_ss?: string | null }
interface PlanLike { central_line?: string; pillars?: { key: string; name?: string; plan?: string }[] }
export interface SSPillarLite { key: string; name: string; why?: string }

const s = (v: unknown, n: number) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, n)

/**
 * Monta a intenção da vaga. Etapa do funil, em ordem: (1) mesmo pilar_ss E mesmo
 * formato; (2) só o pilar_ss; (3) só o formato; (4) nenhuma (funnel = null).
 * Sem pilar_ss (ou fora da ficha) devolve null.
 */
export function buildSlotIntent(slot: SlotLike, plan: PlanLike | null | undefined, funnelPlan: unknown, ssPillars: SSPillarLite[] | null | undefined): SlotIntent | null {
  const key = s(slot.pilar_ss, 60)
  const pil = (ssPillars ?? []).find(p => p.key === key)
  if (!key || !pil) return null
  const stages = (Array.isArray(funnelPlan) ? funnelPlan : []).filter((x): x is Record<string, unknown> => !!x && typeof x === 'object')
  const fmt = s(slot.format, 60)
  const samePil = (x: Record<string, unknown>) => String(x.pillar ?? '') === key
  const sameFmt = (x: Record<string, unknown>) => !!fmt && String(x.format ?? '') === fmt
  const st = stages.find(x => samePil(x) && sameFmt(x)) ?? stages.find(samePil) ?? stages.find(sameFmt) ?? null
  return {
    pilar_ss: key,
    pilar_ss_name: s(pil.name, 60) || key,
    ...(pil.why ? { pilar_ss_why: s(pil.why, 200) } : {}),
    pillar_plan: s(plan?.pillars?.find(p => p.key === key)?.plan, 300),
    funnel: st ? { stage: s(st.stage, 30), objective: s(st.objective, 160), audience: s(st.audience, 160), message: s(st.message, 200), cta: s(st.cta, 100) } : null,
    central_line: s(plan?.central_line, 300),
  }
}

const MAX_BLOCK = 900
/**
 * Texto em português pro prompt (≤ 900 caracteres). Vazio se não há intenção.
 * O CTA da etapa é SÓ sugestão — a trava do QUERO manda.
 */
export function intentBlock(intent: SlotIntent | null | undefined): string {
  if (!intent || !intent.pilar_ss) return ''
  const lines = [
    `Pra que serve (Social Selling): pilar ${intent.pilar_ss_name}${intent.pilar_ss_why ? ` — ${intent.pilar_ss_why}` : ''}.`,
    intent.pillar_plan && `O que a estratégia faz por este pilar: ${intent.pillar_plan}`,
    intent.funnel && [
      intent.funnel.stage && `Etapa do funil: ${intent.funnel.stage}`,
      intent.funnel.audience && `público: ${intent.funnel.audience}`,
      intent.funnel.message && `mensagem: ${intent.funnel.message}`,
      intent.funnel.cta && `CTA sugerido: ${intent.funnel.cta}`,
    ].filter(Boolean).join(' · ') + '.',
    intent.central_line && `Linha central de conteúdo: ${intent.central_line}`,
    'Use como direção, não copie o texto. Não repita número que não esteja nos dados do imóvel/empresa. O CTA sugerido não vale se contrariar a regra de chamada final.',
  ].filter(Boolean) as string[]
  const out = lines.join('\n')
  if (out.length <= MAX_BLOCK) return out
  // Estourou: encurta o corpo, mas a última linha (as regras) nunca se perde.
  const rules = lines[lines.length - 1]
  const body = lines.slice(0, -1).join('\n').slice(0, MAX_BLOCK - rules.length - 2).replace(/\s+\S*$/, '…')
  return `${body}\n${rules}`
}

/**
 * Trava do QUERO pra qualquer peça de texto (post, carrossel, vídeo, pacote do
 * item): sem resposta aprovada (ou sem imóvel ligado), "Comente QUERO" vira o
 * CTA alternativo da ficha. `automation` = null quando a peça não tem imóvel.
 */
export function applyQueroLock(caption: string | null, cta: string | null, automation: VideoAutomation | null | undefined, ctas?: { sem_automacao?: unknown } | null): { caption: string | null; cta: string | null; changed: boolean; approved: boolean; notice: string | null } {
  const d = decideVideoCta(automation, ctas)
  const r = sanitizeCaptionCta(caption, cta, d)
  return { ...r, approved: d.approved, notice: !d.approved && ((caption ?? null) !== r.caption || (!!cta && cta !== r.cta)) ? queroNotice(d.cta) : null }
}

/** Valida rótulos vindos de fora (plan_slot / cron): lista fixa + slice. */
export function cleanLabels(x: { familia?: unknown; pilar_ss?: unknown; tema?: unknown } | null | undefined): { familia?: string; pilar_ss?: string; tema?: string } {
  const FAM = ['tour', 'oferta', 'educativo', 'bairro', 'eventual']
  const out: { familia?: string; pilar_ss?: string; tema?: string } = {}
  if (typeof x?.familia === 'string' && FAM.includes(x.familia)) out.familia = x.familia
  if (typeof x?.pilar_ss === 'string' && /^[a-z0-9_]{2,60}$/.test(x.pilar_ss)) out.pilar_ss = x.pilar_ss
  if (typeof x?.tema === 'string' && x.tema.trim()) out.tema = x.tema.trim().slice(0, 60)
  return out
}

/** Revalida uma intenção que viajou por JSON (plan_slot / cron): forma fixa + slice. */
export function cleanIntent(x: unknown): SlotIntent | null {
  const r = (x && typeof x === 'object' ? x : null) as Record<string, unknown> | null
  const key = typeof r?.pilar_ss === 'string' && /^[a-z0-9_]{2,60}$/.test(r.pilar_ss) ? r.pilar_ss : ''
  if (!r || !key) return null
  const f = (r.funnel && typeof r.funnel === 'object' ? r.funnel : null) as Record<string, unknown> | null
  return {
    pilar_ss: key, pilar_ss_name: s(r.pilar_ss_name, 60) || key,
    ...(r.pilar_ss_why ? { pilar_ss_why: s(r.pilar_ss_why, 200) } : {}),
    pillar_plan: s(r.pillar_plan, 300),
    funnel: f ? { stage: s(f.stage, 30), objective: s(f.objective, 160), audience: s(f.audience, 160), message: s(f.message, 200), cta: s(f.cta, 100) } : null,
    central_line: s(r.central_line, 300),
  }
}

/** Pilares de Social Selling da ficha (onboarding_v2.social_selling.pillars). Vazio = setor sem social selling. */
// deno-lint-ignore no-explicit-any
export async function fetchSSPillars(admin: any, verticalKey: string | null): Promise<SSPillarLite[]> {
  try {
    const { data } = await admin.from('vertical_playbooks').select('config').eq('key', verticalKey ?? 'generico').eq('enabled', true).maybeSingle()
    const raw = (data?.config as { onboarding_v2?: { social_selling?: { pillars?: unknown } } } | null)?.onboarding_v2?.social_selling?.pillars
    return (Array.isArray(raw) ? raw : [])
      .filter((p): p is { key: string; name: string; why?: unknown } => !!p && typeof p.key === 'string' && typeof p.name === 'string')
      .map(p => ({ key: p.key, name: p.name, ...(typeof p.why === 'string' && p.why ? { why: p.why } : {}) }))
  } catch { return [] }
}
