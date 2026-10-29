import { useCallback, useEffect, useMemo, useState } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { useCompany } from '../../contexts/CompanyContext'
import { useLang } from '../../contexts/LanguageContext'
import { useShowcase } from '../../contexts/ShowcaseContext'
import { supabase } from '../../lib/supabase'
import { callMarketingAi, CARD, MUTED, BORDER, D, ORANGE } from './marketingAi/shared'
import MarketSignals from './marketSignals'
import OpportunityCard, { type Opportunity } from './opportunityCard'
import { PIECES_WAIT_MS, PLAN_WAIT_MS, type PieceStats } from './opportunityPlan'

// "Oportunidades" (Inteligência comercial para imobiliárias — decisão do dono 2026-10-28). Tudo AUTOMÁTICO
// (princípio "Tudo automático"): a busca roda sozinha (marketing-ai → cron_opportunities: semanal e quando entra
// sinal novo) e não há botão de gerar. A única ação humana é aprovar/descartar (marketing-ai → decide_opportunity;
// aprovar cria o plano sozinho). Mostra a rodada mais recente + as já aprovadas. Nada é publicado ou enviado
// daqui (regra 1). Não confundir com a tela antiga
// /dashboard/oportunidades (tabela `opportunities`, outra coisa — ver docs/PITFALLS.md).

const TX = {
  pt: {
    title: 'Oportunidades',
    sub: 'Onde o seu mercado e o seu catálogo se encontram — com a evidência de cada uma e o que falta pra ter certeza.',
    notice: 'Preço anunciado não é preço de venda; interesse de busca não é comprador. Nada é publicado daqui.',
    next: 'Próxima análise automática: semanal (e quando você cadastra um sinal novo).', lastRun: (d: string) => `Última análise: ${d}.`, noRun: 'A primeira análise acontece sozinha na próxima rodada.',
    loading: 'Carregando…', none: 'Ainda não há oportunidades. A análise roda sozinha — veja abaixo o que ajuda a achar mais.',
    latest: 'Última busca', earlier: 'Aprovadas em buscas anteriores', dismissed: (n: number) => `${n} descartada${n === 1 ? '' : 's'}`, showDismissed: 'mostrar', hideDismissed: 'esconder',
    missingTitle: 'O que falta pra achar mais',
    mCatalog: 'Cadastre imóveis no catálogo (com bairro, preço e fotos).',
    mIg: 'Conecte o Instagram para medir posts e conversas.',
    mSignals: 'Cole notícias e sinais de mercado, com fonte e data, na seção “Sinais de mercado” abaixo.',
    mComp: 'Monitore pelo menos 2 concorrentes com hashtags coletadas.',
    errDecide: 'Não consegui salvar a decisão. Tente de novo.',
  },
  en: {
    title: 'Opportunities',
    sub: 'Where your market and your catalog meet — with the evidence for each one and what is missing to be sure.',
    notice: 'Listed price is not sale price; search interest is not a buyer. Nothing is published from here.',
    next: 'Next automatic analysis: weekly (and when you add a new signal).', lastRun: (d: string) => `Last analysis: ${d}.`, noRun: 'The first analysis runs by itself in the next automatic round.',
    loading: 'Loading…', none: 'No opportunities yet. The analysis runs by itself — see below what helps find more.',
    latest: 'Latest search', earlier: 'Approved in earlier searches', dismissed: (n: number) => `${n} dismissed`, showDismissed: 'show', hideDismissed: 'hide',
    missingTitle: 'What is missing to find more',
    mCatalog: 'Add properties to the catalog (with neighborhood, price and photos).',
    mIg: 'Connect Instagram so posts and conversations can be measured.',
    mSignals: 'Paste market news and signals, with source and date, in the “Market signals” section below.',
    mComp: 'Monitor at least 2 competitors with collected hashtags.',
    errDecide: 'Could not save the decision. Try again.',
  },
} as const

export default function GrowthOpportunitiesPage() {
  const { lang } = useLang()
  const t = TX[lang]
  const { company } = useCompany()
  const { session } = useAuth()
  const { readOnly, openPlanModal } = useShowcase()
  const companyId = company?.id ?? null
  const [rows, setRows] = useState<Opportunity[]>([])
  const [itemNames, setItemNames] = useState<Record<string, string>>({})
  const [counts, setCounts] = useState<{ catalog: number; signals: number; competitors: number } | null>(null)
  const [loading, setLoading] = useState(true)
  const [pieceStats, setPieceStats] = useState<Record<string, PieceStats>>({})
  const [lastRunAt, setLastRunAt] = useState<string | null>(null)
  const [showDismissed, setShowDismissed] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)

  const load = useCallback(async () => {
    if (!companyId) return
    const [opps, cat, sig, comp, perf] = await Promise.all([
      supabase.from('growth_opportunities').select('*').eq('company_id', companyId).order('created_at', { ascending: false }).limit(60),
      supabase.from('marketing_ai_knowledge').select('id', { count: 'exact', head: true }).eq('company_id', companyId).eq('kind', 'product'),
      supabase.from('market_signals').select('id', { count: 'exact', head: true }).eq('company_id', companyId),
      supabase.from('marketing_ai_competitors').select('id, hashtags_used').eq('company_id', companyId).limit(50),
      // Última rodada (mesmo sem resultado). Se a tabela não for legível pelo cliente, cai na data da última oportunidade.
      supabase.from('agent_performance').select('created_at').eq('company_id', companyId).eq('task_key', 'run_opportunities').eq('success', true).order('created_at', { ascending: false }).limit(1),
    ])
    const list = ((opps.data ?? []) as Opportunity[])
    setRows(list)
    setLastRunAt((perf.data as { created_at: string }[] | null)?.[0]?.created_at ?? list[0]?.created_at ?? null)
    // Tabela ausente (migration pendente) = sem sinais, sem quebrar a tela.
    setCounts({
      catalog: cat.count ?? 0, signals: sig.error ? 0 : (sig.count ?? 0),
      competitors: ((comp.data ?? []) as { hashtags_used: string[] | null }[]).filter(c => (c.hashtags_used ?? []).length > 0).length,
    })
    // Etapa 4B: peças de cada oportunidade com plano aprovado. Coluna ausente (migration pendente) = erro → sem contagem, sem quebrar a tela.
    const withPlan = list.filter(o => o.status === 'approved' && o.plan_approved_at).map(o => o.id)
    if (withPlan.length) {
      const [drafts, posts] = await Promise.all([
        supabase.from('marketing_ai_test_content').select('opportunity_id, status').eq('company_id', companyId).in('opportunity_id', withPlan),
        supabase.from('posts').select('opportunity_id').eq('company_id', companyId).in('opportunity_id', withPlan),
      ])
      const st: Record<string, PieceStats> = {}
      const bump = (id: string | null, k: keyof PieceStats) => { if (id) (st[id] ??= { ready: 0, review: 0 })[k]++ }
      if (!drafts.error) for (const r of (drafts.data ?? []) as { opportunity_id: string | null; status: string | null }[]) bump(r.opportunity_id, r.status === 'vault' ? 'ready' : 'review')
      if (!posts.error) for (const r of (posts.data ?? []) as { opportunity_id: string | null }[]) bump(r.opportunity_id, 'ready')
      setPieceStats(st)
    } else setPieceStats({})
    const ids = [...new Set(list.flatMap(o => o.item_ids ?? []))]
    if (ids.length) {
      const { data } = await supabase.from('marketing_ai_knowledge').select('id, title').in('id', ids)
      setItemNames(Object.fromEntries(((data ?? []) as { id: string; title: string }[]).map(i => [i.id, i.title])))
    }
    setLoading(false)
  }, [companyId])

  useEffect(() => { void load() }, [load])

  const latestRun = rows[0]?.run_id ?? null
  const { latest, earlier, dismissedList } = useMemo(() => {
    const inRun = rows.filter(o => latestRun && o.run_id === latestRun)
    return {
      latest: inRun.filter(o => o.status !== 'dismissed').sort((a, b) => (a.priority_rank ?? 99) - (b.priority_rank ?? 99)),
      earlier: rows.filter(o => o.status === 'approved' && o.run_id !== latestRun),
      dismissedList: inRun.filter(o => o.status === 'dismissed').sort((a, b) => (a.priority_rank ?? 99) - (b.priority_rank ?? 99)),
    }
  }, [rows, latestRun])

  // Plano em construção (aprovada há < 2 min e ainda sem plano): recarrega a cada 10 s até aparecer ou passar o prazo.
  const waitingPlan = rows.some(o => o.status === 'approved' && !o.plan && o.decided_at && Date.now() - Date.parse(o.decided_at) < PLAN_WAIT_MS)
  // Peças em construção (plano aprovado há < 15 min e ainda sem nenhuma peça): mesmo recarregamento a cada 10 s.
  const waitingPieces = rows.some(o => o.status === 'approved' && o.plan_approved_at && !(pieceStats[o.id]?.ready || pieceStats[o.id]?.review) && Date.now() - Date.parse(o.plan_approved_at) < PIECES_WAIT_MS)
  useEffect(() => {
    if (!waitingPlan && !waitingPieces) return
    const id = setInterval(() => { void load() }, 10_000)
    return () => clearInterval(id)
  }, [waitingPlan, waitingPieces, load])

  const decide = async (o: Opportunity, status: Opportunity['status']) => {
    if (readOnly) { openPlanModal(); return }
    if (!session?.access_token) return
    setBusyId(o.id); setMsg(null)
    try {
      const r = await callMarketingAi(session.access_token, 'decide_opportunity', { opportunity_id: o.id, status }) as { opportunity?: Partial<Opportunity> }
      if (r.opportunity) setRows(prev => prev.map(x => (x.id === o.id ? { ...x, ...r.opportunity } as Opportunity : x)))
    } catch (e) { setMsg({ ok: false, text: e instanceof Error ? e.message : t.errDecide }) }
    setBusyId(null)
  }
  const patchRow = (id: string, p: Partial<Opportunity>) => setRows(prev => prev.map(x => (x.id === id ? { ...x, ...p } : x)))

  const missing: string[] = []
  if (counts) {
    if (counts.catalog === 0) missing.push(t.mCatalog)
    if (!company?.instagram_user_id) missing.push(t.mIg)
    if (counts.signals === 0) missing.push(t.mSignals)
    if (counts.competitors < 2) missing.push(t.mComp)
  }
  const showMissing = !loading && missing.length > 0 && latest.length < 3

  return (
    <div>
      <div style={{ padding: '28px 20px 20px', borderBottom: `1px solid ${BORDER}` }}>
        <h1 style={{ fontFamily: D, fontSize: '1.5rem', fontWeight: 800, color: 'white', letterSpacing: '-0.02em', marginBottom: '4px' }}>{t.title}</h1>
        <p style={{ color: MUTED, fontSize: '13px', lineHeight: 1.5 }}>{t.sub}</p>
      </div>
      <div style={{ padding: '20px', maxWidth: '820px' }}>
        <div role="note" style={{ fontSize: '12px', color: 'rgba(255,255,255,0.86)', background: 'rgba(255,109,41,0.06)', border: '1px solid rgba(255,109,41,0.25)', borderRadius: '10px', padding: '9px 12px', marginBottom: '14px', lineHeight: 1.5 }}>{t.notice}</div>

        <div style={{ fontSize: '12.5px', color: MUTED, lineHeight: 1.6 }}>
          {t.next} {lastRunAt ? t.lastRun(new Date(lastRunAt).toLocaleDateString(lang === 'en' ? 'en-US' : 'pt-BR')) : t.noRun}
        </div>
        {msg && <div role="status" style={{ fontSize: '12.5px', marginTop: '10px', color: msg.ok ? '#4ade80' : '#FBBF24' }}>{msg.text}</div>}

        <div style={{ marginTop: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {loading ? <div style={{ color: MUTED, fontSize: '13px' }}>{t.loading}</div> : (
            <>
              {rows.length === 0 && <div style={{ padding: '24px', textAlign: 'center', color: MUTED, fontSize: '13px', border: `1px dashed ${BORDER}`, borderRadius: '12px' }}>{t.none}</div>}
              {latest.length > 0 && <div style={{ fontSize: '13px', fontWeight: 700, color: 'white' }}>{t.latest}</div>}
              {latest.map(o => <OpportunityCard key={o.id} o={o} itemNames={itemNames} pieces={pieceStats[o.id]} busy={busyId === o.id} onDecide={s => decide(o, s)} onPlan={p => patchRow(o.id, p)} />)}
              {dismissedList.length > 0 && (
                <div>
                  <button onClick={() => setShowDismissed(v => !v)} aria-expanded={showDismissed}
                    style={{ background: 'transparent', border: 'none', padding: 0, color: MUTED, fontSize: '12px', cursor: 'pointer', fontFamily: D }}>
                    {t.dismissed(dismissedList.length)} — <span style={{ color: ORANGE, textDecoration: 'underline' }}>{showDismissed ? t.hideDismissed : t.showDismissed}</span>
                  </button>
                  {showDismissed && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginTop: '10px', opacity: 0.75 }}>
                      {dismissedList.map(o => <OpportunityCard key={o.id} o={o} itemNames={itemNames} pieces={pieceStats[o.id]} busy={busyId === o.id} onDecide={s => decide(o, s)} onPlan={p => patchRow(o.id, p)} />)}
                    </div>
                  )}
                </div>
              )}
              {earlier.length > 0 && <div style={{ fontSize: '13px', fontWeight: 700, color: 'white', marginTop: '6px' }}>{t.earlier}</div>}
              {earlier.map(o => <OpportunityCard key={o.id} o={o} itemNames={itemNames} pieces={pieceStats[o.id]} busy={busyId === o.id} onDecide={s => decide(o, s)} onPlan={p => patchRow(o.id, p)} />)}
            </>
          )}

          {showMissing && (
            <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: '12px', padding: '14px 16px' }}>
              <div style={{ fontSize: '13px', fontWeight: 800, color: 'white', marginBottom: '8px' }}>{t.missingTitle}</div>
              <ul style={{ margin: 0, paddingLeft: '18px', color: MUTED, fontSize: '12.5px', lineHeight: 1.7 }}>
                {missing.map(m => <li key={m}>{m}</li>)}
              </ul>
            </div>
          )}
        </div>

        {companyId && <MarketSignals lang={lang} companyId={companyId} verticalKey={company?.vertical_key ?? null} readOnly={readOnly} openPlanModal={openPlanModal} onChanged={() => { void load() }} />}
      </div>
    </div>
  )
}
