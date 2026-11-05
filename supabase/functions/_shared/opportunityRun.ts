// Opportunity Engine — orquestração (banco + IA). A lógica de verdade está em
// opportunityEngine.ts (fatos/candidatos, sem IA) e opportunityOutput.ts (prompt, validação,
// prioridade). Chamado por marketing-ai → action 'run_opportunities'.
//
// Síncrono de propósito: é UMA chamada à IA (≈1-2 mil tokens de saída, bem abaixo do gatilho de
// ~110s do PITFALLS "Limite de 150s") e as consultas ao banco levam poucos segundos. Sem candidato
// com base, nem chama a IA (custo zero). Só LÊ dados da empresa e só ESCREVE em growth_opportunities
// e agent_performance — nada é publicado ou enviado (regra 1).
import { availabilityOf, itemCfgFrom } from './itemService.ts'
import {
  buildCandidates, signalIdsOf, type CatalogItem, type CompetitorRow, type EngineInput, type EventRow, type FieldMap, type Lang,
  type OppTexts, type PieceRow, type PostRow, type SignalRow, type TrendRow,
} from './opportunityEngine.ts'
import { MAX_CANDIDATES_TO_LLM, OPP_PROMPT_VERSION, buildPrompt, compareScored, finalizeChecked, parseLlm, score, type NotValidated } from './opportunityOutput.ts'
import { interpretFingerprint, recordRun, type RunInput } from './marketIntelRuns.ts'

type Admin = { from: (t: string) => any; rpc?: any } // eslint-disable-line @typescript-eslint/no-explicit-any
export type Llm = (prompt: string, maxTokens: number) => Promise<{ text: string; tokens: number }>

export const WINDOW_DAYS = 60
const REUSE_WINDOW_MS = 90_000 // duplo clique: devolve a rodada que acabou de sair em vez de gastar IA de novo

export interface RunResult { ok: boolean; status: number; error?: string; run_id?: string | null; generated: number; considered: number; reused?: boolean; unchanged?: boolean; not_validated?: NotValidated[] }

type Bilingual = { pt?: string; en?: string } | string | undefined
const pick = (b: Bilingual, lang: Lang): string => (typeof b === 'string' ? b : b?.[lang] ?? b?.pt ?? '')

async function rows<T>(q: PromiseLike<{ data: unknown; error: { message: string } | null }>, what: string): Promise<T[]> {
  const { data, error } = await q
  if (error) { console.error(`[opportunities] ${what}:`, error.message); return [] }
  return (data ?? []) as T[]
}

export async function runOpportunities(admin: Admin, companyId: string, llm: Llm): Promise<RunResult> {
  const started = Date.now()
  const { data: co } = await admin.from('companies').select('id, business_name, language, vertical_key, instagram_user_id').eq('id', companyId).maybeSingle()
  if (!co) return { ok: false, status: 404, error: 'Empresa não encontrada.', generated: 0, considered: 0 }
  const lang: Lang = co.language === 'en' ? 'en' : 'pt'

  // Duplo clique / chamada repetida: reaproveita a rodada recém-criada.
  // O marcador é a última execução desta action em agent_performance (gravada MESMO quando saem 0 oportunidades,
  // que não deixam linha em growth_opportunities); só conta execução que deu certo (falha não trava a nova tentativa).
  const sinceReuse = new Date(Date.now() - REUSE_WINDOW_MS).toISOString()
  const [{ data: recentRun }, { data: lastOpp }] = await Promise.all([
    admin.from('agent_performance').select('created_at').eq('company_id', companyId).eq('task_key', 'run_opportunities').eq('success', true).gte('created_at', sinceReuse).limit(1).maybeSingle(),
    admin.from('growth_opportunities').select('run_id, created_at').eq('company_id', companyId).gte('created_at', sinceReuse).order('created_at', { ascending: false }).limit(1).maybeSingle(),
  ])
  if (recentRun || lastOpp) return { ok: true, status: 200, run_id: lastOpp?.run_id ?? null, generated: 0, considered: 0, reused: true }

  // Ficha do setor (regra 6): quais campos são região/preço/tipo/quartos e como se chamam.
  const { data: pb } = await admin.from('vertical_playbooks').select('config').eq('key', co.vertical_key ?? '').eq('enabled', true).maybeSingle()
  const cfg = (pb?.config ?? {}) as { opportunity_fields?: FieldMap; catalog_fields?: { required?: { key: string; label?: Bilingual }[]; optional?: { key: string; label?: Bilingual; private?: boolean }[] }; vocabulary?: { item?: string }; opportunity_texts?: { low_traction_hypotheses?: Record<string, string[]>; caveat?: Bilingual; audience_hint?: Bilingual; market_claims?: { pt?: string[]; en?: string[] } } }
  const fieldMap = cfg.opportunity_fields
  if (!fieldMap?.location) {
    return { ok: false, status: 400, generated: 0, considered: 0, error: lang === 'en' ? 'This business type does not have opportunity fields set up yet.' : 'Este setor ainda não tem os campos de oportunidades configurados na ficha.' }
  }
  // Textos de setor (regra 6) vêm da ficha; faltando, valem os genéricos do motor.
  const ot = cfg.opportunity_texts
  const texts: OppTexts = {
    hypotheses: ot?.low_traction_hypotheses?.[lang]?.filter(x => typeof x === 'string' && x.trim()) ?? undefined,
    caveat: pick(ot?.caveat, lang) || undefined,
    audienceHint: pick(ot?.audience_hint, lang) || undefined,
    marketClaims: ot?.market_claims?.[lang]?.filter(x => typeof x === 'string' && x.trim()) ?? undefined,
  }
  const labels: Record<string, string> = {}
  for (const f of [...(cfg.catalog_fields?.required ?? []), ...(cfg.catalog_fields?.optional ?? [])]) labels[f.key] = pick(f.label, lang).replace(/\s*\(.*\)\s*$/, '')

  const since = new Date(Date.now() - WINDOW_DAYS * 86400000).toISOString()
  const [items, posts, pieces, events, competitors, trends, signals] = await Promise.all([
    rows<{ id: string; title: string; created_at?: string | null; meta: { fields?: Record<string, unknown>; photos?: unknown[] } | null }>(admin.from('marketing_ai_knowledge').select('id, title, meta, created_at').eq('company_id', companyId).eq('kind', 'product').limit(200), 'catálogo'),
    (async (): Promise<PostRow[]> => {
      const full = await admin.from('posts').select('id, item_id, status, published_at, created_at, content, instagram_media_id').eq('company_id', companyId).or(`created_at.gte.${since},published_at.gte.${since}`).limit(1000)
      if (!full.error) return (full.data ?? []) as PostRow[]
      // posts.item_id pode não existir (PITFALLS): segue sem vínculo por item em vez de derrubar.
      const base = await admin.from('posts').select('id, status, published_at, created_at, content, instagram_media_id').eq('company_id', companyId).or(`created_at.gte.${since},published_at.gte.${since}`).limit(1000)
      return ((base.data ?? []) as PostRow[]).map(p => ({ ...p, item_id: null }))
    })(),
    // Peças preparadas (qualquer status) por item: não são post publicado, mas o item já tem conteúdo a caminho.
    rows<PieceRow>(admin.from('marketing_ai_test_content').select('item_id').eq('company_id', companyId).not('item_id', 'is', null).limit(1000), 'peças preparadas'),
    rows<EventRow>(admin.from('engagement_events').select('media_ref, intent_detected, created_at').eq('company_id', companyId).gte('created_at', since).limit(3000), 'comentários'),
    rows<CompetitorRow>(admin.from('marketing_ai_competitors').select('name, instagram_url, posting_frequency_days, avg_engagement, followers, hashtags_used, notes, last_analyzed_at').eq('company_id', companyId).limit(50), 'concorrentes'),
    rows<TrendRow>(admin.from('marketing_ai_trends').select('title, description, category, relevance, detected_at, source').eq('company_id', companyId).neq('status', 'ignored').order('detected_at', { ascending: false }).limit(30), 'tendências'),
    rows<SignalRow>(admin.from('market_signals').select('id, kind, region, title, summary, source_name, source_url, observed_at').eq('company_id', companyId).or('meta->>ignored.is.null,meta->>ignored.neq.true').order('created_at', { ascending: false }).limit(50), 'sinais de mercado'),
  ])

  // Fase 4: imóvel vendido/alugado/removido não vira oportunidade nova (ficha sem availability = nada filtrado).
  const icfg = itemCfgFrom(pb?.config)
  const catalog: CatalogItem[] = items.filter(i => !availabilityOf(i, icfg.availability).blocking).map(i => ({ id: i.id, title: i.title, fields: i.meta?.fields ?? {}, photoCount: i.meta?.photos?.length ?? 0, createdAt: i.created_at ?? null }))
  const input: EngineInput = {
    lang, now: new Date(), windowDays: WINDOW_DAYS, fieldMap, labels, itemLabel: cfg.vocabulary?.item ?? 'Item',
    catalog, posts, pieces, events, competitors, trends, signals, instagramConnected: !!co.instagram_user_id, texts,
  }
  const photoCounts = Object.fromEntries(catalog.map(i => [i.id, i.photoCount]))
  const { facts, candidates } = buildCandidates(input)
  if (candidates.length === 0) { await logCost(admin, companyId, started, 0, true, 'sem candidatos'); return { ok: true, status: 200, run_id: null, generated: 0, considered: 0 } } // marca a rodada (o cron semanal e a tela usam)

  // Os melhores candidatos (mesma ordem da prioridade final) vão pra IA redigir; ela nunca vê os demais.
  const top = candidates.map(c => score(c, facts)).sort(compareScored).slice(0, MAX_CANDIDATES_TO_LLM).map(s => s.c)
  const usedFactIds = new Set(top.flatMap(c => c.fact_ids))
  const sentFacts = facts.filter(f => usedFactIds.has(f.id))
  const prompt = buildPrompt({ lang, businessName: String(co.business_name ?? ''), itemLabel: input.itemLabel, facts: sentFacts, candidates: top, windowDays: WINDOW_DAYS, texts, photoCounts })

  // Fase 2 (2026-11-04): mesmo conteúdo da última interpretação bem-sucedida = não chama a IA (nada mudou). O relógio de 7 dias zera pela linha de sucesso.
  // Falha nunca grava impressão digital (o registro da falha vai com fingerprint nulo). Tabela ausente/erro de leitura = interpreta normalmente.
  const sentSignalIds = signalIdsOf(sentFacts).slice(0, 50)
  const fingerprint = await interpretFingerprint({ lang, promptVersion: OPP_PROMPT_VERSION, businessName: String(co.business_name ?? ''), itemLabel: input.itemLabel, facts: sentFacts, candidates: top, photoCounts, texts })
  const runBase = { interpreted: top.length, details: { used_signal_ids: sentSignalIds, facts: sentFacts.length, prompt_version: OPP_PROMPT_VERSION } }
  const prev = await lastInterpretation(admin, companyId)
  if (prev?.fingerprint === fingerprint) {
    await logCost(admin, companyId, started, 0, true, `sem mudança desde ${prev.at.slice(0, 10)} (${top.length} candidato(s) iguais aos da última análise)`)
    await recordRun(admin, companyId, 'interpret', { ...runBase, accepted: 0, discarded: 0, unchanged: true, fingerprint, tokens: 0 })
    return { ok: true, status: 200, run_id: null, generated: 0, considered: top.length, unchanged: true }
  }

  let answer: { text: string; tokens: number }
  try {
    answer = await llm(prompt, 2500)
  } catch (e) {
    await logCost(admin, companyId, started, 0, false, String(e))
    await recordRun(admin, companyId, 'interpret', fail(runBase, 'ai_no_answer', 0))
    return { ok: false, status: 502, generated: 0, considered: top.length, error: lang === 'en' ? 'The AI did not answer. Try again in a minute.' : 'A IA não respondeu. Tente de novo em um minuto.' }
  }
  const { text, tokens } = answer
  const parsed = parseLlm(text)
  if (!parsed) {
    await logCost(admin, companyId, started, tokens, false, 'resposta da IA ilegível')
    await recordRun(admin, companyId, 'interpret', fail(runBase, 'ai_unreadable', tokens))
    return { ok: false, status: 502, generated: 0, considered: top.length, error: lang === 'en' ? 'The AI answer could not be read. Try again.' : 'Não consegui ler a resposta da IA. Tente de novo.' }
  }

  const { drafts, notValidated } = finalizeChecked({ lang, candidates: top, facts: sentFacts, llm: parsed, marketClaims: texts.marketClaims, photoCounts })
  const validIds = new Set(catalog.map(i => i.id))
  const runId = crypto.randomUUID()
  if (drafts.length > 0) {
    const { error } = await admin.from('growth_opportunities').insert(drafts.map(d => ({
      company_id: companyId, kind: d.kind, title: d.title, description: d.description || null, commercial_problem: d.commercial_problem,
      evidence: d.evidence, item_ids: d.item_ids.filter(id => validIds.has(id)), audience: d.audience, suggested_action: d.suggested_action,
      how_to_measure: d.how_to_measure, confidence: d.confidence, needs_validation: d.needs_validation, status: 'suggested',
      priority_rank: d.priority_rank, priority_reasons: d.priority_reasons, run_id: runId,
    })))
    if (error) {
      await logCost(admin, companyId, started, tokens, false, error.message)
      await recordRun(admin, companyId, 'interpret', fail(runBase, 'save_failed', tokens))
      return { ok: false, status: 500, generated: 0, considered: top.length, error: `growth_opportunities: ${error.message}` }
    }
  }
  // NOT_VALIDATED: não entra na fila (growth_opportunities.status só aceita suggested/approved/dismissed e não há coluna meta — sem migration).
  // O motivo fica no registro da rodada (market_intel_runs.details), no log e no retorno.
  if (notValidated.length) console.warn(`[opportunities] ${companyId} não validadas:`, JSON.stringify(notValidated))
  await logCost(admin, companyId, started, tokens, true, `${drafts.length} oportunidade(s) de ${top.length} candidato(s)${notValidated.length ? `; ${notValidated.length} não validada(s)` : ''}`)
  await recordRun(admin, companyId, 'interpret', { ...runBase, details: { ...runBase.details, ...(notValidated.length ? { not_validated: notValidated } : {}) }, accepted: drafts.length, discarded: Math.max(0, top.length - drafts.length), unchanged: false, fingerprint, tokens })
  return { ok: true, status: 200, run_id: drafts.length > 0 ? runId : null, generated: drafts.length, considered: top.length, ...(notValidated.length ? { not_validated: notValidated } : {}) }
}

// Custo da IA registrado como as outras actions (agent_performance); nunca derruba o fluxo.
async function logCost(admin: Admin, companyId: string, started: number, tokens: number, success: boolean, note: string) {
  try {
    await admin.from('agent_performance').insert({
      company_id: companyId, agent_role: 'cmo', task_key: 'run_opportunities', task_description: note.slice(0, 200),
      latency_ms: Date.now() - started, tokens_used: tokens, success, ...(success ? {} : { error_message: note.slice(0, 500) }),
    })
  } catch { /* não-fatal */ }
}

// Última interpretação bem-sucedida (a que tem impressão digital). Erro/tabela ausente = null (interpreta normalmente).
async function lastInterpretation(admin: Admin, companyId: string): Promise<{ fingerprint: string; at: string } | null> {
  try {
    const { data, error } = await admin.from('market_intel_runs').select('fingerprint, created_at').eq('company_id', companyId).eq('phase', 'interpret').not('fingerprint', 'is', null).order('created_at', { ascending: false }).limit(1).maybeSingle()
    if (error || !data?.fingerprint) return null
    return { fingerprint: String(data.fingerprint), at: String(data.created_at ?? '') }
  } catch { return null }
}
const fail = (base: RunInput, why: string, tokens: number): RunInput => ({ ...base, accepted: 0, discarded: 0, unchanged: false, fingerprint: null, tokens, details: { ...base.details, error: why } })
