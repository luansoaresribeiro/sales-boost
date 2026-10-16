// Onboarding v2 (2026-10-16): bloco de contexto pros agentes (Hermes e
// Estratégia) que separa o que o dono INFORMOU, o que foi LIDO automaticamente
// (a confirmar), o que ele disse que NÃO SABE, o que NÃO SE APLICA e o que
// está PENDENTE. Assim a IA nunca trata "não sei" como dado nem inventa o que
// falta. Rótulos vêm da ficha (config.onboarding_v2) — regra 6.
// Falha silenciosa: sem a coluna answer_status (migration pendente) ou sem v2
// na ficha, devolve '' e tudo segue como antes.
//
// deno-lint-ignore-file no-explicit-any

interface V2Q { key: string; label?: { pt?: string }; profiles?: string[]; show_if?: { key: string; any: string[] }; options?: { pt: string; key?: string }[] }

const isMeaningful = (v: unknown): boolean => Array.isArray(v) ? v.some(isMeaningful) : v != null && /[\p{L}\p{N}]/u.test(String(v))
const txt = (v: unknown) => Array.isArray(v) ? v.map(String).join(', ') : String(v ?? '')

export async function answerContextBlock(admin: any, companyId: string | null | undefined, onboardingV2: unknown, answers: Record<string, unknown> | null | undefined): Promise<string> {
  try {
    const v2 = onboardingV2 as { questions?: V2Q[] } | null
    if (!companyId || !v2 || !Array.isArray(v2.questions) || !v2.questions.length) return ''
    const { data, error } = await admin.from('companies').select('answer_status').eq('id', companyId).maybeSingle()
    const status = (!error && data?.answer_status ? data.answer_status : {}) as Record<string, string>
    const a = answers ?? {}
    const profileQ = v2.questions.find(q => q.key === 'perfil')
    const profile = profileQ?.options?.find(o => o.pt === String(a.perfil ?? ''))?.key ?? null
    const visible = v2.questions.filter(q => {
      if (q.profiles?.length && (!profile || !q.profiles.includes(profile))) return false
      if (q.show_if) {
        const v = a[q.show_if.key]
        const vals = Array.isArray(v) ? v.map(String) : v ? [String(v)] : []
        if (vals.length && !vals.some(x => q.show_if!.any.includes(x))) return false
      }
      return true
    })
    const label = (q: V2Q) => q.label?.pt ?? q.key
    const told: string[] = [], auto: string[] = [], unknown: string[] = [], na: string[] = [], pending: string[] = []
    for (const q of visible) {
      const has = isMeaningful(a[q.key])
      const st = status[q.key]
      if (has && st === 'auto') auto.push(`- ${label(q)}: ${txt(a[q.key])}`)
      else if (has) told.push(`- ${label(q)}: ${txt(a[q.key])}`)
      else if (st === 'unknown') unknown.push(`- ${label(q)}`)
      else if (st === 'na') na.push(`- ${label(q)}`)
      else pending.push(`- ${label(q)}`)
    }
    const parts = ['CONTEXTO DO CADASTRO (use como fato SÓ o que está em "Informado"; o resto não é dado — nunca invente):']
    if (told.length) parts.push(`Informado pelo dono:\n${told.join('\n')}`)
    if (auto.length) parts.push(`Lido automaticamente do Instagram (o dono ainda não confirmou):\n${auto.join('\n')}`)
    if (unknown.length) parts.push(`O dono disse que NÃO SABE (trate como desconhecido; se for importante, sugira como descobrir):\n${unknown.join('\n')}`)
    if (na.length) parts.push(`Não se aplica a este negócio:\n${na.join('\n')}`)
    if (pending.length) parts.push(`Ainda não respondido:\n${pending.join('\n')}`)
    return parts.length > 1 ? parts.join('\n\n') : ''
  } catch { return '' }
}
