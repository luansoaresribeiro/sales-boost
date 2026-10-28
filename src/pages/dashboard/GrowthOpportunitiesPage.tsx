import { useCallback, useEffect, useMemo, useState } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { useCompany } from '../../contexts/CompanyContext'
import { useLang } from '../../contexts/LanguageContext'
import { useShowcase } from '../../contexts/ShowcaseContext'
import { supabase } from '../../lib/supabase'
import { callMarketingAi, CARD, MUTED, BORDER, D, ORANGE } from './marketingAi/shared'
import OpportunityCard, { type Opportunity } from './opportunityCard'

// "Oportunidades" (Inteligência comercial para imobiliárias — Etapa 1, decisão do dono
// 2026-10-28). O botão chama marketing-ai → run_opportunities (fatos contados do banco + IA só
// pra redigir). Mostra a rodada mais recente + as já aprovadas. Aprovar/descartar só guarda a
// decisão: nada é publicado ou enviado daqui (regra 1). Não confundir com a tela antiga
// /dashboard/oportunidades (tabela `opportunities`, outra coisa — ver docs/PITFALLS.md).

const TX = {
  pt: {
    title: 'Oportunidades',
    sub: 'Onde o seu mercado e o seu catálogo se encontram — com a evidência de cada uma e o que falta pra ter certeza.',
    notice: 'Preço anunciado não é preço de venda; interesse de busca não é comprador. Nada é publicado daqui.',
    run: 'Encontrar oportunidades', running: 'Procurando… pode levar até 1 minuto', plan: 'Disponível no plano — ver planos',
    loading: 'Carregando…', none: 'Ainda não há oportunidades. Clique em “Encontrar oportunidades”.',
    ranNone: 'Nenhuma oportunidade tem evidência suficiente ainda. Veja o que falta abaixo.',
    ranReused: 'Uma busca acabou de rodar — mostrando o resultado dela.', ranOk: (n: number) => `${n} ${n === 1 ? 'oportunidade encontrada' : 'oportunidades encontradas'}.`,
    latest: 'Última busca', earlier: 'Aprovadas em buscas anteriores', dismissed: (n: number) => `${n} descartada${n === 1 ? '' : 's'} nesta busca (escondida${n === 1 ? '' : 's'}).`,
    missingTitle: 'O que falta pra achar mais',
    mCatalog: 'Cadastre imóveis no catálogo (com bairro, preço e fotos).',
    mIg: 'Conecte o Instagram para medir posts e conversas.',
    mSignals: 'Cole notícias e sinais de mercado (a tela para colar chega na próxima etapa).',
    mComp: 'Monitore pelo menos 2 concorrentes com hashtags coletadas.',
    errDecide: 'Não consegui salvar a decisão. Tente de novo.', errRun: 'Erro ao buscar oportunidades',
  },
  en: {
    title: 'Opportunities',
    sub: 'Where your market and your catalog meet — with the evidence for each one and what is missing to be sure.',
    notice: 'Listed price is not sale price; search interest is not a buyer. Nothing is published from here.',
    run: 'Find opportunities', running: 'Looking… this can take up to 1 minute', plan: 'Available on a paid plan — see plans',
    loading: 'Loading…', none: 'No opportunities yet. Click “Find opportunities”.',
    ranNone: 'No opportunity has enough evidence yet. See what is missing below.',
    ranReused: 'A search just ran — showing its result.', ranOk: (n: number) => `${n} ${n === 1 ? 'opportunity found' : 'opportunities found'}.`,
    latest: 'Latest search', earlier: 'Approved in earlier searches', dismissed: (n: number) => `${n} dismissed in this search (hidden).`,
    missingTitle: 'What is missing to find more',
    mCatalog: 'Add properties to the catalog (with neighborhood, price and photos).',
    mIg: 'Connect Instagram so posts and conversations can be measured.',
    mSignals: 'Paste market news and signals (the paste screen arrives in the next step).',
    mComp: 'Monitor at least 2 competitors with collected hashtags.',
    errDecide: 'Could not save the decision. Try again.', errRun: 'Error finding opportunities',
  },
} as const

export default function GrowthOpportunitiesPage() {
  const { lang } = useLang()
  const t = TX[lang]
  const { company } = useCompany()
  const { user, session } = useAuth()
  const { readOnly, openPlanModal } = useShowcase()
  const companyId = company?.id ?? null
  const [rows, setRows] = useState<Opportunity[]>([])
  const [itemNames, setItemNames] = useState<Record<string, string>>({})
  const [counts, setCounts] = useState<{ catalog: number; signals: number; competitors: number } | null>(null)
  const [loading, setLoading] = useState(true)
  const [running, setRunning] = useState(false)
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
    setRows(list)
    // Tabela ausente (migration pendente) = sem sinais, sem quebrar a tela.
    setCounts({
      catalog: cat.count ?? 0, signals: sig.error ? 0 : (sig.count ?? 0),
      competitors: ((comp.data ?? []) as { hashtags_used: string[] | null }[]).filter(c => (c.hashtags_used ?? []).length > 0).length,
    })
    const ids = [...new Set(list.flatMap(o => o.item_ids ?? []))]
    if (ids.length) {
      const { data } = await supabase.from('marketing_ai_knowledge').select('id, title').in('id', ids)
      setItemNames(Object.fromEntries(((data ?? []) as { id: string; title: string }[]).map(i => [i.id, i.title])))
    }
    setLoading(false)
  }, [companyId])

  useEffect(() => { void load() }, [load])

  const latestRun = rows[0]?.run_id ?? null
  const { latest, earlier, hiddenCount } = useMemo(() => {
    const inRun = rows.filter(o => latestRun && o.run_id === latestRun)
    return {
      latest: inRun.filter(o => o.status !== 'dismissed').sort((a, b) => (a.priority_rank ?? 99) - (b.priority_rank ?? 99)),
      earlier: rows.filter(o => o.status === 'approved' && o.run_id !== latestRun),
      hiddenCount: inRun.filter(o => o.status === 'dismissed').length,
    }
  }, [rows, latestRun])

  const run = async () => {
    if (readOnly) { openPlanModal(); return }
    if (running || !session?.access_token) return
    setRunning(true); setMsg(null)
    try {
      const r = await callMarketingAi(session.access_token, 'run_opportunities') as { generated?: number; reused?: boolean }
      await load()
      setMsg(r.reused ? { ok: true, text: t.ranReused } : (r.generated ?? 0) > 0 ? { ok: true, text: t.ranOk(r.generated ?? 0) } : { ok: false, text: t.ranNone })
    } catch (e) { setMsg({ ok: false, text: e instanceof Error ? e.message : t.errRun }) }
    setRunning(false)
  }

  const decide = async (o: Opportunity, status: Opportunity['status']) => {
    setBusyId(o.id); setMsg(null)
    const patch = status === 'suggested' ? { status, decided_at: null, decided_by: null } : { status, decided_at: new Date().toISOString(), decided_by: user?.id ?? null }
    const { error } = await supabase.from('growth_opportunities').update(patch).eq('id', o.id)
    if (error) setMsg({ ok: false, text: t.errDecide }); else setRows(prev => prev.map(x => (x.id === o.id ? { ...x, ...patch } as Opportunity : x)))
    setBusyId(null)
  }

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

        <button onClick={run} disabled={running} aria-disabled={readOnly || running} title={readOnly ? t.plan : undefined}
          style={{ padding: '12px 22px', background: readOnly ? 'rgba(255,255,255,0.08)' : ORANGE, color: readOnly ? MUTED : '#000', fontWeight: 800, fontSize: '13.5px', border: 'none', borderRadius: '10px', cursor: running ? 'default' : 'pointer', opacity: running ? 0.7 : 1, fontFamily: D }}>
          {running ? t.running : readOnly ? `🔒 ${t.run}` : t.run}
        </button>
        {msg && <div role="status" style={{ fontSize: '12.5px', marginTop: '10px', color: msg.ok ? '#4ade80' : '#FBBF24' }}>{msg.text}</div>}

        <div style={{ marginTop: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {loading ? <div style={{ color: MUTED, fontSize: '13px' }}>{t.loading}</div> : (
            <>
              {rows.length === 0 && <div style={{ padding: '24px', textAlign: 'center', color: MUTED, fontSize: '13px', border: `1px dashed ${BORDER}`, borderRadius: '12px' }}>{t.none}</div>}
              {latest.length > 0 && <div style={{ fontSize: '13px', fontWeight: 700, color: 'white' }}>{t.latest}</div>}
              {latest.map(o => <OpportunityCard key={o.id} o={o} itemNames={itemNames} busy={busyId === o.id} onDecide={s => decide(o, s)} />)}
              {hiddenCount > 0 && <div style={{ fontSize: '11.5px', color: MUTED }}>{t.dismissed(hiddenCount)}</div>}
              {earlier.length > 0 && <div style={{ fontSize: '13px', fontWeight: 700, color: 'white', marginTop: '6px' }}>{t.earlier}</div>}
              {earlier.map(o => <OpportunityCard key={o.id} o={o} itemNames={itemNames} busy={busyId === o.id} onDecide={s => decide(o, s)} />)}
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
      </div>
    </div>
  )
}
