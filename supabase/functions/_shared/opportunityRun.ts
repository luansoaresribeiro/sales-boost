// Opportunity Engine — orquestração (banco + IA). A lógica de verdade está em
// opportunityEngine.ts (fatos/candidatos, sem IA) e opportunityOutput.ts (prompt, validação,
// prioridade). Chamado por marketing-ai → action 'run_opportunities'.
//
// Síncrono de propósito: é UMA chamada à IA (≈1-2 mil tokens de saída, bem abaixo do gatilho de
// ~110s do PITFALLS "Limite de 150s") e as consultas ao banco levam poucos segundos. Sem candidato
// com base, nem chama a IA (custo zero). Só LÊ dados da empresa e só ESCREVE em growth_opportunities
// e agent_performance — nada é publicado ou enviado (regra 1).
import {
  buildCandidates, type CatalogItem, type CompetitorRow, type EngineInput, type EventRow, type FieldMap, type Lang,
  type OppTexts, type PostRow, type SignalRow, type TrendRow,
} from './opportunityEngine.ts'
import { MAX_CANDIDATES_TO_LLM, buildPrompt, compareScored, finalize, parseLlm, score } from './opportunityOutput.ts'

type Admin = { from: (t: string) => any; rpc?: any } // eslint-disable-line @typescript-eslint/no-explicit-any
export type Llm = (prompt: string, maxTokens: number) => Promise<{ text: string; tokens: number }>

export const WINDOW_DAYS = 60
const REUSE_WINDOW_MS = 90_000 // duplo clique: devolve a rodada que acabou de sair em vez de gastar IA de novo

export interface RunResult { ok: boolean; status: number; error?: string; run_id?: string | null; generated: number; considered: number; reused?: boolean }

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
  const [items, posts, events, competitors, trends, signals] = await Promise.all([
    rows<{ id: string; title: string; meta: { fields?: Record<string, unknown>; photos?: unknown[] } | null }>(admin.from('marketing_ai_knowledge').select('id, title, meta').eq('company_id', companyId).eq('kind', 'product').limit(200), 'catálogo'),
    (async (): Promise<PostRow[]> => {
      const full = await admin.from('posts').select('id, item_id, status, published_at, created_at, content, instagram_media_id').eq('company_id', companyId).or(`created_at.gte.${since},published_at.gte.${since}`).limit(1000)
      if (!full.error) return (full.data ?? []) as PostRow[]
      // posts.item_id pode não existir (PITFALLS): segue sem vínculo por item em vez de derrubar.
      const base = await admin.from('posts').select('id, status, published_at, created_at, content, instagram_media_id').eq('company_id', companyId).or(`created_at.gte.${since},published_at.gte.${since}`).limit(1000)
      return ((base.data ?? []) as PostRow[]).map(p => ({ ...p, item_id: null }))
    })(),
    rows<EventRow>(admin.from('engagement_events').select('media_ref, intent_detected, created_at').eq('company_id', companyId).gte('created_at', since).limit(3000), 'comentários'),
    rows<CompetitorRow>(admin.from('marketing_ai_competitors').select('name, instagram_url, posting_frequency_days, avg_engagement, followers, hashtags_used, notes, last_analyzed_at').eq('company_id', companyId).limit(50), 'concorrentes'),
    rows<TrendRow>(admin.from('marketing_ai_trends').select('title, description, category, relevance, detected_at, source').eq('company_id', companyId).order('detected_at', { ascending: false }).limit(30), 'tendências'),
    rows<SignalRow>(admin.from('market_signals').select('id, kind, region, title, summary, source_name, source_url, observed_at').eq('company_id', companyId).order('created_at', { ascending: false }).limit(50), 'sinais de mercado'),
  ])

  const catalog: CatalogItem[] = items.map(i => ({ id: i.id, title: i.title, fields: i.meta?.fields ?? {}, photoCount: i.meta?.photos?.length ?? 0 }))
  const input: EngineInput = {
    lang, now: new Date(), windowDays: WINDOW_DAYS, fieldMap, labels, itemLabel: cfg.vocabulary?.item ?? 'Item',
    catalog, posts, events, competitors, trends, signals, instagramConnected: !!co.instagram_user_id, texts,
  }
  const photoCounts = Object.fromEntries(catalog.map(i => [i.id, i.photoCount]))
  const { facts, candidates } = buildCandidates(input)
  if (candidates.length === 0) { await logCost(admin, companyId, started, 0, true, 'sem candidatos'); return { ok: true, status: 200, run_id: null, generated: 0, considered: 0 } } // marca a rodada (o cron semanal e a tela usam)

  // Os melhores candidatos (mesma ordem da prioridade final) vão pra IA redigir; ela nunca vê os demais.
  const top = candidates.map(c => score(c, facts)).sort(compareScored).slice(0, MAX_CANDIDATES_TO_LLM).map(s => s.c)
  const usedFactIds = new Set(top.flatMap(c => c.fact_ids))
  const sentFacts = facts.filter(f => usedFactIds.has(f.id))
  const prompt = buildPrompt({ lang, businessName: String(co.business_name ?? ''), itemLabel: input.itemLabel, facts: sentFacts, candidates: top, windowDays: WINDOW_DAYS, texts, photoCounts })

  let answer: { text: string; tokens: number }
  try {
    answer = await llm(prompt, 2500)
  } catch (e) {
    await logCost(admin, companyId, started, 0, false, String(e))
    return { ok: false, status: 502, generated: 0, considered: top.length, error: lang === 'en' ? 'The AI did not answer. Try again in a minute.' : 'A IA não respondeu. Tente de novo em um minuto.' }
  }
  const { text, tokens } = answer
  const parsed = parseLlm(text)
  if (!parsed) {
    await logCost(admin, companyId, started, tokens, false, 'resposta da IA ilegível')
    return { ok: false, status: 502, generated: 0, considered: top.length, error: lang === 'en' ? 'The AI answer could not be read. Try again.' : 'Não consegui ler a resposta da IA. Tente de novo.' }
  }

  const drafts = finalize({ lang, candidates: top, facts: sentFacts, llm: parsed, marketClaims: texts.marketClaims, photoCounts })
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
      return { ok: false, status: 500, generated: 0, considered: top.length, error: `growth_opportunities: ${error.message}` }
    }
  }
  await logCost(admin, companyId, started, tokens, true, `${drafts.length} oportunidade(s) de ${top.length} candidato(s)`)
  return { ok: true, status: 200, run_id: drafts.length > 0 ? runId : null, generated: drafts.length, considered: top.length }
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
