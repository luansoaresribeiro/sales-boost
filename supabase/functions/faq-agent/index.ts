/**
 * faq-agent — Agente de Dados → "Dicas e FAQ" (etapa 2, 2026-10-14).
 * A IA sugere dicas (ou o dono escreve) e confere cada uma: geral passa
 * sozinha; com número/regra só passa com fonte OFICIAL (selo com data e
 * link); sem fonte fica "precisa revisar" até o dono aprovar. Lógica em
 * _shared/faqCheck.ts. Guardado em marketing_ai_knowledge (module 'dados',
 * kind 'faq': title = pergunta, content = resposta, meta.check = selo).
 *
 * Ações (JWT do dono): suggest {count?}, add {question, answer, category},
 * update {id, question, answer, category?}, verify {id}, approve {id},
 * recheck_due. Apagar é direto pela tela (RLS do dono).
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { requirePaidAccess } from '../_shared/access.ts'
import { callClaude, checkAndSave, fetchFaqConfig, isDue, parseJson, type FaqMeta, type FaqRow } from '../_shared/faqCheck.ts'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const clean = (v: unknown, max: number) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, max)

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const admin = createClient(supabaseUrl, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
    const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY')!
    const tavilyKey = Deno.env.get('TAVILY_API_KEY')
    const bearer = req.headers.get('Authorization') ?? ''
    if (!bearer) return json({ error: 'Unauthorized' }, 401)
    const userClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: bearer } } })
    const { data: { user } } = await userClient.auth.getUser()
    if (!user) return json({ error: 'Unauthorized' }, 401)

    const { data: company } = await admin.from('companies').select('id, business_name, city, vertical_key').eq('user_id', user.id).maybeSingle()
    if (!company) return json({ error: 'Empresa não encontrada' }, 404)
    const cfg = await fetchFaqConfig(admin, company.vertical_key as string | null)
    if (!cfg) return json({ error: 'Este setor não usa "Dicas e FAQ".' }, 400)
    const noPlan = await requirePaidAccess(admin, company.id as string)
    if (noPlan) return noPlan

    const body = await req.json().catch(() => ({})) as Record<string, unknown>
    const action = String(body.action ?? '')
    const city = String(company.city ?? '')
    const ctx = { anthropicKey, tavilyKey, cfg, city, companyId: company.id as string }
    const catKeys = new Set(cfg.categories.map(c => c.key))
    const cat = (v: unknown) => (catKeys.has(String(v)) ? String(v) : cfg.categories[0]?.key ?? 'geral')

    const getRow = async (id: unknown): Promise<FaqRow | null> => {
      if (typeof id !== 'string' || !UUID.test(id)) return null
      const { data } = await admin.from('marketing_ai_knowledge').select('id, title, content, meta').eq('id', id).eq('company_id', company.id).eq('module', 'dados').eq('kind', 'faq').maybeSingle()
      return data as FaqRow | null
    }
    const insert = async (question: string, answer: string, meta: FaqMeta): Promise<FaqRow | null> => {
      const { data } = await admin.from('marketing_ai_knowledge').insert({ company_id: company.id, module: 'dados', kind: 'faq', title: question, content: answer, meta }).select('id, title, content, meta').single()
      return data as FaqRow | null
    }

    if (action === 'suggest') {
      const n = Math.min(6, Math.max(1, Number(body.count) || 4))
      const { data: existing } = await admin.from('marketing_ai_knowledge').select('title').eq('company_id', company.id).eq('module', 'dados').eq('kind', 'faq').limit(100)
      const raw = await callClaude(anthropicKey, `Você é o Agente de Dados do Sales Boost para "${company.business_name}", corretor/imobiliária em ${city || 'Rio de Janeiro'}.
Escreva ${n} dicas no formato pergunta e resposta que um comprador ou locatário realmente pergunta. Temas do setor: ${cfg.topics || 'compra, venda e aluguel de imóveis'}.
Categorias possíveis (use a key): ${cfg.categories.map(c => `${c.key} (${c.label})`).join(', ')}.
Já existem (não repita): ${((existing ?? []) as { title: string }[]).map(e => e.title).join(' | ') || '(nenhuma)'}

Regras: resposta curta (até 350 caracteres), clara, sem juridiquês. Se citar número, prazo, taxa ou lei, escreva o que você acredita ser o correto HOJE — vai ser conferido em fonte oficial antes de qualquer uso, e o que não for confirmado não é publicado. Nunca prometa valorização nem dê conselho que dependa do caso ("procure um advogado/contador" quando for o caso).
Responda SÓ um array JSON: [{"category": "...", "question": "...", "answer": "..."}]`, 2000)
      const list = parseJson<{ category?: string; question?: string; answer?: string }[]>(raw, []).slice(0, n)
      const rows: FaqRow[] = []
      for (const it of list) {
        const q = clean(it.question, 200), a = clean(it.answer, 600)
        if (q.length < 8 || a.length < 10) continue
        const row = await insert(q, a, { category: cat(it.category), origin: 'ia', used_count: 0 })
        if (row) rows.push(row)
      }
      const checked = await Promise.all(rows.map(r => checkAndSave(admin, r, ctx)))
      return json({ ok: true, items: checked })
    }

    if (action === 'add') {
      const q = clean(body.question, 200), a = clean(body.answer, 600)
      if (q.length < 5 || a.length < 5) return json({ error: 'Escreva a pergunta e a resposta.' }, 400)
      const row = await insert(q, a, { category: cat(body.category), origin: 'dono', used_count: 0 })
      if (!row) return json({ error: 'Não consegui salvar.' }, 500)
      return json({ ok: true, item: await checkAndSave(admin, row, ctx) })
    }

    if (action === 'update') {
      const row = await getRow(body.id)
      if (!row) return json({ error: 'Dica não encontrada' }, 404)
      const q = clean(body.question, 200), a = clean(body.answer, 600)
      if (q.length < 5 || a.length < 5) return json({ error: 'Escreva a pergunta e a resposta.' }, 400)
      const meta: FaqMeta = { ...(row.meta ?? {}), ...(body.category ? { category: cat(body.category) } : {}) }
      await admin.from('marketing_ai_knowledge').update({ title: q, content: a, meta }).eq('id', row.id)
      // Mudou o texto → confere de novo (o selo antigo não vale mais).
      return json({ ok: true, item: await checkAndSave(admin, { ...row, title: q, content: a, meta }, ctx) })
    }

    if (action === 'verify') {
      const row = await getRow(body.id)
      if (!row) return json({ error: 'Dica não encontrada' }, 404)
      return json({ ok: true, item: await checkAndSave(admin, row, ctx) })
    }

    if (action === 'approve') {
      const row = await getRow(body.id)
      if (!row) return json({ error: 'Dica não encontrada' }, 404)
      if (row.meta?.check?.status !== 'revisar') return json({ error: 'Só dá pra aprovar dica que está "precisa revisar".' }, 400)
      const now = new Date().toISOString()
      const meta: FaqMeta = { ...(row.meta ?? {}), check: { ...row.meta!.check!, status: 'aprovada_dono', checked_at: now, next_check_at: null, note: 'Aprovada por você.' } }
      await admin.from('marketing_ai_knowledge').update({ meta }).eq('id', row.id)
      return json({ ok: true, item: { ...row, meta } })
    }

    if (action === 'recheck_due') {
      const { data } = await admin.from('marketing_ai_knowledge').select('id, title, content, meta').eq('company_id', company.id).eq('module', 'dados').eq('kind', 'faq')
      const due = ((data ?? []) as FaqRow[]).filter(r => isDue(r.meta)).slice(0, 3)
      const items = await Promise.all(due.map(r => checkAndSave(admin, r, ctx)))
      return json({ ok: true, items })
    }

    return json({ error: 'Ação desconhecida.' }, 400)
  } catch (err) {
    console.error('faq-agent', err)
    return json({ error: 'Não consegui fazer isso agora. Tente de novo.' }, 500)
  }
})

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { ...cors, 'Content-Type': 'application/json' } })
}
