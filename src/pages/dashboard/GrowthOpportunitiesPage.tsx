import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { useCompany } from '../../contexts/CompanyContext'
import { useLang } from '../../contexts/LanguageContext'
import { useShowcase } from '../../contexts/ShowcaseContext'
import { supabase } from '../../lib/supabase'
import FeedbackWidget from './marketingAi/FeedbackWidget'
import FlowStrip from './marketingAi/FlowStrip'
import { useOppFlow } from './marketingAi/useFlowStripData'
import { oppSteps } from './marketingAi/flowStripSteps'
import { callMarketingAi, CARD, MUTED, BORDER, D, ORANGE } from './marketingAi/shared'
import MarketSignals from './marketSignals'
import OpportunityCard, { type Opportunity } from './opportunityCard'
import type { OppResultRow } from './resultsBrokers'
import { PIECES_WAIT_MS, PLAN_WAIT_MS, type PieceStats } from './opportunityPlan'

// "Oportunidades" (Inteligência comercial para imobiliárias — decisão do dono 2026-10-28). Tudo AUTOMÁTICO
// (princípio "Tudo automático"): a busca roda sozinha (marketing-ai → cron_opportunities: semanal e quando entra
// sinal novo) e não há botão de gerar. A única ação humana é aprovar/descartar (marketing-ai → decide_opportunity;
// aprovar cria o plano sozinho). Mostra a rodada mais recente + as já aprovadas. Nada é publicado ou enviado
// daqui (regra 1). Não confundir com a tela antiga
// /dashboard/oportunidades (tabela `opportunities`, outra coisa — ver docs/PITFALLS.md).

const TX = {
  pt: {
    back: '← Voltar', title: 'Oportunidades',
    sub: 'Onde o seu mercado e o seu catálogo se encontram — com a evidência de cada uma e o que falta pra ter certeza.',
    notice: 'Preço anunciado não é preço de venda; interesse de busca não é comprador. Nada é publicado daqui.',
    next: 'Próxima análise automática: semanal (e quando você cadastra um sinal novo).', lastRun: (d: string) => `Última análise: ${d}.`, noRun: 'A primeira análise acontece sozinha na próxima rodada.',
    emptyDate: (d: string, dir: boolean) => `Última análise em ${d}: nenhuma oportunidade relevante${dir ? ' — seguimos o direcionamento ativo' : ''}.`, emptyNoDate: (dir: boolean) => `Nenhuma oportunidade relevante no momento${dir ? ' — seguimos o direcionamento ativo' : ''}.`, noneTail: 'A análise roda sozinha — veja abaixo o que ajuda a achar mais.',
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
    back: '← Back', title: 'Opportunities',
    sub: 'Where your market and your catalog meet — with the evidence for each one and what is missing to be sure.',
    notice: 'Listed price is not sale price; search interest is not a buyer. Nothing is published from here.',
    next: 'Next automatic analysis: weekly (and when you add a new signal).', lastRun: (d: string) => `Last analysis: ${d}.`, noRun: 'The first analysis runs by itself in the next automatic round.',
    emptyDate: (d: string, dir: boolean) => `Last analysis on ${d}: no relevant opportunity${dir ? ' — we keep following the active direction' : ''}.`, emptyNoDate: (dir: boolean) => `No relevant opportunity right now${dir ? ' — we keep following the active direction' : ''}.`, noneTail: 'The analysis runs by itself — see below what helps find more.',
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
  const navigate = useNavigate()
  const { session } = useAuth()
  const { readOnly, openPlanModal } = useShowcase()
  const companyId = company?.id ?? null
  const [rows, setRows] = useState<Opportunity[]>([])
  const [itemNames, setItemNames] = useState<Record<string, string>>({})
  const [counts, setCounts] = useState<{ catalog: number; signals: number; competitors: number } | null>(null)
  const [loading, setLoading] = useState(true)
  const [hasStrategy, setHasStrategy] = useState(false) // só diz "seguimos o direcionamento ativo" com estratégia main ativa
  const [pieceStats, setPieceStats] = useState<Record<string, PieceStats>>({})
  const [results, setResults] = useState<Record<string, OppResultRow>>({})
  const [linkCodes, setLinkCodes] = useState<Record<string, string[]>>({})
  const [showDismissed, setShowDismissed] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)

  const load = useCallback(async () => {
    if (!companyId) return
    const [opps, cat, sig, comp] = await Promise.all([
      supabase.from('growth_opportunities').select('*').eq('company_id', companyId).order('created_at', { ascending: false }).limit(60),
      supabase.from('marketing_ai_knowledge').select('id', { count: 'exact', head: true }).eq('company_id', companyId).eq('kind', 'product'),
      supabase.from('market_signals').select('id', { count: 'exact', head: true }).eq('company_id', companyId),
      supabase.from('marketing_ai_competitors').select('id, hashtags_used').eq('company_id', companyId).limit(50),
    ])
    const list = ((opps.data ?? []) as Opportunity[])
    const strat = await supabase.from('marketing_ai_strategies').select('id', { count: 'exact', head: true }).eq('company_id', companyId).eq('kind', 'main').eq('status', 'active')
    setHasStrategy(!strat.error && (strat.count ?? 0) > 0)
    setRows(list)
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
      const bump = (id: string | null, k: keyof PieceStats) => { if (id) (st[id] ??= { ready: 0, review: 0, approved: 0 })[k]++ }
      if (!drafts.error) for (const r of (drafts.data ?? []) as { opportunity_id: string | null; status: string | null }[]) bump(r.opportunity_id, r.status === 'vault' ? 'ready' : 'review')
      if (!posts.error) for (const r of (posts.data ?? []) as { opportunity_id: string | null }[]) bump(r.opportunity_id, 'approved')
      setPieceStats(st)
    } else setPieceStats({})
    // Etapa 6: resultados por oportunidade aprovada. Função/tabela ausente (migration pendente) = erro → sem bloco, sem quebrar a tela.
    const approvedIds = list.filter(o => o.status === 'approved').map(o => o.id)
    if (approvedIds.length) {
      const [res, links] = await Promise.all([
        supabase.rpc('opportunity_results', { p_company: companyId }),
        supabase.from('tracked_links').select('code, opportunity_id').eq('company_id', companyId).in('opportunity_id', approvedIds),
      ])
      setResults(res.error ? {} : Object.fromEntries(((res.data ?? []) as OppResultRow[]).map(r => [r.opportunity_id, r])))
      const codes: Record<string, string[]> = {}
      if (!links.error) for (const l of (links.data ?? []) as { code: string; opportunity_id: string }[]) (codes[l.opportunity_id] ??= []).push(l.code)
      setLinkCodes(codes)
    } else { setResults({}); setLinkCodes({}) }
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
  const waitingPieces = rows.some(o => o.status === 'approved' && o.plan_approved_at && !(pieceStats[o.id]?.ready || pieceStats[o.id]?.review || pieceStats[o.id]?.approved) && Date.now() - Date.parse(o.plan_approved_at) < PIECES_WAIT_MS)
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

  // Faixa do fluxo real (2026-11-01). Recarrega quando a lista muda (aprovar/descartar/plano). Sem usePendencias (PITFALLS).
  const flow = useOppFlow(companyId, rows)
  const flowSteps = oppSteps(lang, flow.data, { go: () => document.getElementById('opp-list')?.scrollIntoView({ behavior: 'smooth', block: 'start' }) })

  const missing: string[] = []
  if (counts) {
    if (counts.catalog === 0) missing.push(t.mCatalog)
    if (!company?.instagram_user_id) missing.push(t.mIg)
    if (counts.signals === 0) missing.push(t.mSignals)
    if (counts.competitors < 2) missing.push(t.mComp)
  }
  // Sem oportunidade pendente: explica o vazio com a data real da última rodada (livro-caixa `run_opportunities`, que registra a
  // rodada mesmo quando ela não gera nada). Sem registro = texto sem data (nunca inventa).
  const lastRunAt = flow.data.ledger?.last_ok_at ?? null
  const lastRunDay = lastRunAt ? new Date(lastRunAt).toLocaleDateString(lang === 'en' ? 'en-US' : 'pt-BR', { day: '2-digit', month: '2-digit', timeZone: 'America/Sao_Paulo' }) : null
  const emptyNote = loading || flow.loading || rows.some(o => o.status === 'suggested') ? null
    : !lastRunDay ? t.emptyNoDate(hasStrategy) : t.emptyDate(lastRunDay, hasStrategy)
  const showMissing = !loading && missing.length > 0 && latest.length < 3

  return (
    <div>
      {/* Mesma barra das seções dos agentes (MarketingAiSectionPage): volta ao hub. */}
      <div style={{ padding: '14px 20px', borderBottom: `1px solid ${BORDER}`, display: 'flex', alignItems: 'center', gap: '14px' }}>
        <button onClick={() => navigate('/dashboard/marketing-ai')}
          style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '7px 14px', background: 'transparent', border: `1px solid ${BORDER}`, borderRadius: '8px', color: MUTED, fontSize: '12.5px', fontWeight: 600, cursor: 'pointer', fontFamily: D, flexShrink: 0 }}
          onMouseEnter={e => { e.currentTarget.style.color = ORANGE; e.currentTarget.style.borderColor = 'rgba(255,109,41,0.3)' }}
          onMouseLeave={e => { e.currentTarget.style.color = MUTED; e.currentTarget.style.borderColor = BORDER }}>
          {t.back}
        </button>
        <span style={{ fontFamily: D, fontSize: '14px', fontWeight: 700, color: 'white' }}>💡 {t.title}</span>
      </div>
      <div style={{ padding: '28px 20px 20px', borderBottom: `1px solid ${BORDER}` }}>
        <h1 style={{ fontFamily: D, fontSize: '1.5rem', fontWeight: 800, color: 'white', letterSpacing: '-0.02em', marginBottom: '4px' }}>{t.title}</h1>
        <p style={{ color: MUTED, fontSize: '13px', lineHeight: 1.5 }}>{t.sub}</p>
      </div>
      <div style={{ padding: '20px', maxWidth: '900px' }}>
        <FlowStrip steps={flowSteps} loading={flow.loading} />
        <div role="note" style={{ fontSize: '12px', color: 'rgba(255,255,255,0.86)', background: 'rgba(255,109,41,0.06)', border: '1px solid rgba(255,109,41,0.25)', borderRadius: '10px', padding: '9px 12px', marginBottom: '14px', lineHeight: 1.5 }}>{t.notice}</div>

        {/* A linha "Próxima análise…" saiu: a faixa de fluxo acima mostra a última e a próxima rodada com a regra real. */}
        {msg && <div role="status" style={{ fontSize: '12.5px', marginTop: '10px', color: msg.ok ? '#4ade80' : '#FBBF24' }}>{msg.text}</div>}

        <div id="opp-list" style={{ marginTop: '20px', display: 'flex', flexDirection: 'column', gap: '14px', scrollMarginTop: '12px' }}>
          {loading ? <div style={{ color: MUTED, fontSize: '13px' }}>{t.loading}</div> : (
            <>
              {emptyNote && rows.length > 0 && <div role="status" style={{ fontSize: '12.5px', color: 'rgba(255,255,255,0.8)', background: CARD, border: `1px solid ${BORDER}`, borderRadius: '10px', padding: '10px 14px', lineHeight: 1.5 }}>{emptyNote}</div>}
              {rows.length === 0 && <div style={{ padding: '24px', textAlign: 'center', color: MUTED, fontSize: '13px', border: `1px dashed ${BORDER}`, borderRadius: '12px' }}>{emptyNote ? `${emptyNote} ${t.noneTail}` : t.none}</div>}
              {latest.length > 0 && <div style={{ fontSize: '13px', fontWeight: 700, color: 'white' }}>{t.latest}</div>}
              {latest.map(o => <OpportunityCard key={o.id} o={o} itemNames={itemNames} pieces={pieceStats[o.id]} results={results[o.id]} linkCodes={linkCodes[o.id]} busy={busyId === o.id} onDecide={s => decide(o, s)} onPlan={p => patchRow(o.id, p)} />)}
              {dismissedList.length > 0 && (
                <div>
                  <button onClick={() => setShowDismissed(v => !v)} aria-expanded={showDismissed}
                    style={{ background: 'transparent', border: 'none', padding: 0, color: MUTED, fontSize: '12px', cursor: 'pointer', fontFamily: D }}>
                    {t.dismissed(dismissedList.length)} — <span style={{ color: ORANGE, textDecoration: 'underline' }}>{showDismissed ? t.hideDismissed : t.showDismissed}</span>
                  </button>
                  {showDismissed && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginTop: '10px', opacity: 0.75 }}>
                      {dismissedList.map(o => <OpportunityCard key={o.id} o={o} itemNames={itemNames} pieces={pieceStats[o.id]} results={results[o.id]} linkCodes={linkCodes[o.id]} busy={busyId === o.id} onDecide={s => decide(o, s)} onPlan={p => patchRow(o.id, p)} />)}
                    </div>
                  )}
                </div>
              )}
              {earlier.length > 0 && <div style={{ fontSize: '13px', fontWeight: 700, color: 'white', marginTop: '6px' }}>{t.earlier}</div>}
              {earlier.map(o => <OpportunityCard key={o.id} o={o} itemNames={itemNames} pieces={pieceStats[o.id]} results={results[o.id]} linkCodes={linkCodes[o.id]} busy={busyId === o.id} onDecide={s => decide(o, s)} onPlan={p => patchRow(o.id, p)} />)}
            </>
          )}

          {showMissing && (
            <details style={{ padding: '2px 4px' }}>
              <summary style={{ cursor: 'pointer', fontSize: '11.5px', color: 'rgba(255,255,255,0.45)' }}>{t.missingTitle}</summary>
              <ul style={{ margin: '6px 0 0', paddingLeft: '18px', color: 'rgba(255,255,255,0.45)', fontSize: '11.5px', lineHeight: 1.6 }}>
                {missing.map(m => <li key={m}>{m}</li>)}
              </ul>
            </details>
          )}
        </div>

        {companyId && <MarketSignals lang={lang} companyId={companyId} verticalKey={company?.vertical_key ?? null} readOnly={readOnly} openPlanModal={openPlanModal} onChanged={() => { void load() }} />}
      </div>
      {companyId && <FeedbackWidget companyId={companyId} section="opportunities" />}
    </div>
  )
}
