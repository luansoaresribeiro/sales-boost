// Memória do Agente de Conteúdo (pedido do dono, 2026-10-15: "ir aprendendo
// e usando a memória com o que não está bom, pra ir melhorando").
//
// Mora em agent_memory (sem tabela nova), agent_role = LESSONS_ROLE:
// - type 'fact',  key 'fb:<peça>'      → um sinal: peça excluída com motivo,
//   legenda editada pelo dono (antes/depois). Gravado pela tela (RLS do dono).
// - type 'rule',  key 'licao:<n>'      → as regras curtas que valem agora
//   (no máximo MAX_LESSONS). Todo criador de peça lê isso antes de escrever.
// - type 'preference', key 'apagada:<n>' → regra que o dono apagou; não volta.
//
// relearn() junta os sinais + o motivo das notas baixas do avaliador
// (content-test) e reescreve as regras. Regra é sobre COMO escrever/montar
// (estilo, repetição, foto, tom) — nunca um "fato" (o avaliador erra fato:
// já disse que a estação Antero de Quental não existe, e existe).
type SupaClient = any // eslint-disable-line @typescript-eslint/no-explicit-any

export const LESSONS_ROLE = 'conteudo_licoes'
const MAX_LESSONS = 8
const LOW_SCORE = 60

export async function loadLessons(admin: SupaClient, companyId: string): Promise<string[]> {
  try {
    const { data } = await admin.from('agent_memory').select('value').eq('company_id', companyId).eq('agent_role', LESSONS_ROLE).eq('type', 'rule').order('key')
    return ((data ?? []) as { value: string }[]).map(r => r.value).filter(Boolean).slice(0, MAX_LESSONS)
  } catch { return [] }
}

// Bloco pro prompt. Vazio quando não há lição (não muda nada no pedido).
export function lessonsBlock(lessons: string[]): string {
  if (!lessons.length) return ''
  return `\nO dono já mostrou o que NÃO gosta — siga estas lições (memória do agente):\n${lessons.map(l => `- ${l}`).join('\n')}\n`
}

interface Signal { at: string; text: string }

async function gatherSignals(admin: SupaClient, companyId: string): Promise<{ signals: Signal[]; dismissed: string[]; lastRule: string | null }> {
  const since = new Date(Date.now() - 60 * 86400000).toISOString()
  const [{ data: mem }, { data: low }] = await Promise.all([
    admin.from('agent_memory').select('key, value, type, updated_at').eq('company_id', companyId).eq('agent_role', LESSONS_ROLE),
    admin.from('marketing_ai_test_content').select('idea, recipe, quality_score, scores, created_at').eq('company_id', companyId).lt('quality_score', LOW_SCORE).gte('created_at', since).order('created_at', { ascending: false }).limit(15),
  ])
  const rows = (mem ?? []) as { key: string; value: string; type: string; updated_at: string }[]
  const signals: Signal[] = []
  for (const r of rows.filter(r => r.type === 'fact' && r.key.startsWith('fb:') && r.updated_at >= since)) {
    try {
      const v = JSON.parse(r.value) as { kind?: string; reason?: string; note?: string; idea?: string; recipe?: string; before?: string; after?: string }
      if (v.kind === 'edit') signals.push({ at: r.updated_at, text: `O dono EDITOU a legenda de "${v.idea ?? 'peça'}" (${v.recipe ?? '—'}).\nAntes: ${String(v.before ?? '').slice(0, 500)}\nDepois: ${String(v.after ?? '').slice(0, 500)}` })
      else signals.push({ at: r.updated_at, text: `O dono EXCLUIU "${v.idea ?? 'peça'}" (${v.recipe ?? '—'}). Motivo: ${v.reason ?? '—'}${v.note ? ` — "${String(v.note).slice(0, 200)}"` : ''}` })
    } catch { /* sinal corrompido: ignora */ }
  }
  for (const p of (low ?? []) as { idea: string | null; recipe: string | null; quality_score: number; scores: Record<string, { score?: number; comment?: string }> | null; created_at: string }[]) {
    const bad = Object.values(p.scores ?? {}).filter(x => (x?.score ?? 100) < LOW_SCORE && x?.comment).map(x => x.comment!.slice(0, 300))
    if (bad.length) signals.push({ at: p.created_at, text: `Avaliador deu nota ${p.quality_score} a "${p.idea ?? 'peça'}" (${p.recipe ?? '—'}): ${bad.join(' | ')}` })
  }
  const dismissed = rows.filter(r => r.type === 'preference' && r.key.startsWith('apagada:')).map(r => r.value)
  const rules = rows.filter(r => r.type === 'rule')
  const lastRule = rules.length ? rules.map(r => r.updated_at).sort().at(-1)! : null
  return { signals: signals.sort((a, b) => b.at.localeCompare(a.at)).slice(0, 30), dismissed, lastRule }
}

// Reescreve as lições. `onlyIfStale`: só roda se chegou sinal novo depois
// da última lição (o cron de domingo chama assim — sem sinal novo, sem IA).
export async function relearn(admin: SupaClient, anthropicKey: string, companyId: string, opts: { onlyIfStale?: boolean } = {}): Promise<{ lessons: string[]; changed: boolean }> {
  const { signals, dismissed, lastRule } = await gatherSignals(admin, companyId)
  const current = await loadLessons(admin, companyId)
  if (!signals.length) return { lessons: current, changed: false }
  if (opts.onlyIfStale && lastRule && !signals.some(s => s.at > lastRule)) return { lessons: current, changed: false }

  const prompt = `Você cuida da memória do Agente de Conteúdo de uma empresa (posts de Instagram). Abaixo estão os sinais do que NÃO agradou: peças que o dono excluiu (com motivo), legendas que ele editou (antes/depois) e notas baixas do avaliador automático.

SINAIS (mais recentes primeiro):
${signals.map(s => `- ${s.text}`).join('\n')}

LIÇÕES ATUAIS:
${current.length ? current.map(l => `- ${l}`).join('\n') : '(nenhuma)'}
${dismissed.length ? `\nO DONO APAGOU estas lições — NÃO as recrie, nem parecidas:\n${dismissed.map(l => `- ${l}`).join('\n')}\n` : ''}
Escreva no máximo ${MAX_LESSONS} lições curtas (até 140 caracteres cada), em português simples, no imperativo, sobre COMO criar: estilo, tom, repetição, abertura, escolha de foto, tamanho do texto, CTA.
- Só lição com base em sinal real acima (de preferência repetido); mantenha as atuais que continuam valendo.
- NUNCA escreva lição com fato, nome de lugar, número, preço ou "X não existe" — o avaliador pode errar fatos; a regra de não inventar dados já existe.
- Edição do dono vale mais que nota do avaliador.
Responda SÓ em JSON: {"lessons":["...","..."]}`

  let lessons: string[] = []
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': anthropicKey, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({ model: 'claude-sonnet-4-6', max_tokens: 800, messages: [{ role: 'user', content: prompt }] }),
      signal: AbortSignal.timeout(60_000),
    })
    if (!res.ok) { console.error('relearn: IA recusou', res.status); return { lessons: current, changed: false } }
    const data = await res.json()
    const raw = String(data.content?.[0]?.text ?? '')
    const obj = JSON.parse(raw.slice(raw.indexOf('{'), raw.lastIndexOf('}') + 1)) as { lessons?: unknown }
    lessons = (Array.isArray(obj.lessons) ? obj.lessons : []).map(x => String(x).trim().slice(0, 160)).filter(Boolean).slice(0, MAX_LESSONS)
  } catch (e) { console.error('relearn falhou', e); return { lessons: current, changed: false } }
  if (!lessons.length) return { lessons: current, changed: false }

  await admin.from('agent_memory').delete().eq('company_id', companyId).eq('agent_role', LESSONS_ROLE).eq('type', 'rule')
  const now = new Date().toISOString()
  await admin.from('agent_memory').insert(lessons.map((value, i) => ({ company_id: companyId, agent_role: LESSONS_ROLE, key: `licao:${i + 1}`, value, type: 'rule', updated_at: now })))
  return { lessons, changed: true }
}
