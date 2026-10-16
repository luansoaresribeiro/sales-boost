// A 1ª estratégia só nasce com os requisitos principais preenchidos (decisão
// do dono 2026-10-14: "a estratégia, mesmo após o pagamento, é criada somente
// após os requisitos principais serem preenchidos, de acordo com as
// notificações"). Mesmas regras do /setup e do sino (src/lib/useSetupStatus.ts
// + src/lib/setupRules.ts) — tela e servidor nunca podem discordar:
//  - dados do negócio: nome e cidade (2+ letras) e telefone (10+ dígitos);
//  - perguntas da ficha (config.onboarding_questions) todas respondidas (ou
//    marcadas "Não sei"/"Não se aplica"/"Depois" em companies.answer_status);
//  - catálogo (se a ficha tiver): config.setup.min_items itens (padrão 1) com
//    o mínimo de fotos do campo 'photos' (padrão 5);
//  - Instagram conectado, só se a ficha pedir (config.setup.instagram_required).
// Tudo que é de setor vem da ficha (regra 6). Falha ABERTA no erro de banco
// (igual ao access.ts): erro de rede nunca tranca quem já preencheu tudo.
//
// deno-lint-ignore-file no-explicit-any

const DEFAULT_MIN_PHOTOS = 5

const hasAnswer = (v: unknown) => Array.isArray(v) ? v.some(x => String(x ?? '').trim() !== '') : v !== null && v !== undefined && String(v).trim() !== ''

export async function setupMissing(admin: any, companyId: string): Promise<string[]> {
  try {
    const { data: c, error } = await admin.from('companies')
      .select('business_name, city, phone, instagram_user_id, vertical_key, playbook_answers, answer_status').eq('id', companyId).maybeSingle()
    if (error || !c) return []
    const missing: string[] = []
    const name = String(c.business_name ?? '').trim(), city = String(c.city ?? '').trim()
    if (name.length < 2 || city.length < 2 || String(c.phone ?? '').replace(/\D/g, '').length < 10) missing.push('dados do negócio (nome, cidade e telefone)')

    const key = (c.vertical_key as string | null) ?? 'generico'
    let config: any = {}
    if (key !== 'generico') {
      const { data: pb } = await admin.from('vertical_playbooks').select('config').eq('key', key).eq('enabled', true).maybeSingle()
      config = pb?.config ?? {}
    }
    const answers = (c.playbook_answers ?? {}) as Record<string, unknown>
    const questions = Array.isArray(config.onboarding_questions) ? config.onboarding_questions as { key: string }[] : []
    // Onboarding v2 (2026-10-16): "Não sei" / "Não se aplica" / "Preencher depois"
    // (companies.answer_status) contam como respondido — o dono passou pela
    // pergunta e disse que não tem o dado. Mesma regra do /setup.
    const status = (c.answer_status ?? {}) as Record<string, string>
    const said = (k: string) => ['unknown', 'na', 'later'].includes(status[k])
    const unanswered = questions.filter(q => !hasAnswer(answers[q.key]) && !said(q.key)).length
    if (unanswered > 0) missing.push(`${unanswered} ${unanswered === 1 ? 'pergunta' : 'perguntas'} do negócio`)

    const fields = [...(config.catalog_fields?.required ?? []), ...(config.catalog_fields?.optional ?? [])] as { type?: string; min?: number }[]
    if (fields.length > 0) {
      const minPhotos = fields.find(f => f.type === 'photos')?.min ?? DEFAULT_MIN_PHOTOS
      const n = Number(config.setup?.min_items)
      const minItems = Number.isInteger(n) && n >= 1 && n <= 10 ? n : 1
      const { data: items, error: iErr } = await admin.from('marketing_ai_knowledge').select('meta')
        .eq('company_id', companyId).eq('module', 'visual').eq('kind', 'product')
      if (iErr) return []
      const ok = ((items ?? []) as { meta: { photos?: unknown[] } | null }[])
        .filter(i => Array.isArray(i.meta?.photos) && i.meta!.photos!.length >= minPhotos).length
      if (ok < minItems) missing.push(`${minItems - ok} ${String(config.vocabulary?.item ?? 'item').toLowerCase()} com ${minPhotos}+ fotos no catálogo`)
    }

    if (config.setup?.instagram_required === true && !c.instagram_user_id) missing.push('conectar o Instagram')
    return missing
  } catch (e) {
    console.error('[setupReady] consulta falhou — liberando (falha aberta)', String(e))
    return []
  }
}
