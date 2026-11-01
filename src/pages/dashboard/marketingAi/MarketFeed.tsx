import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '../../../lib/supabase'
import { CARD, MUTED, BORDER, D, ORANGE } from './shared'

// "Mercado" (Inteligência de Mercado, estágio 3): o feed do que o sistema coletou sozinho (e do que o dono colou à mão)
// em `market_signals`, com fonte e data da própria fonte. Sem botão de gerar: a coleta é diária e automática (cron
// `cron_market_intel`). O dono só pode apagar o que não faz sentido. A linha "Última coleta" vem do livro-caixa
// (`agent_performance`, task_key 'market_news_search'); se o banco não deixar ler, a linha some (nada é inventado).

const KIND_LABEL = {
  pt: { news: 'Notícia', launch: 'Lançamento', infrastructure: 'Obra/infraestrutura', economy: 'Economia/juros', tourism: 'Turismo', rental: 'Aluguel', listing_price: 'Preço anunciado', supply: 'Oferta de imóveis', other: 'Outro' },
  en: { news: 'News', launch: 'Launch', infrastructure: 'Works/infrastructure', economy: 'Economy/interest rates', tourism: 'Tourism', rental: 'Rental', listing_price: 'Listed price', supply: 'Property supply', other: 'Other' },
} as const

const TX = {
  pt: {
    intro: 'O sistema busca sozinho, todo dia, notícias, lançamentos, obras e turismo da região dos seus imóveis. Cada item mostra a fonte e a data em que foi publicado. Apague o que não fizer sentido — nada aqui vai ao público.',
    lastRun: 'Última coleta', next: 'próxima', tomorrow: 'amanhã', nextDaily: 'na próxima rodada diária', never: 'Ainda não houve coleta automática.',
    region: 'Bairro/região', kind: 'Tipo', all: 'Todos', auto: 'Automático', del: 'Apagar', confirmDel: 'Apagar este item?', source: 'Fonte', published: 'Publicado em',
    empty: 'Nenhum item ainda. A primeira coleta acontece sozinha, no próximo ciclo diário.', emptyFilter: 'Nenhum item com esses filtros.',
    loading: 'Carregando…', eLoad: 'Não consegui carregar o feed.', retry: 'Tentar de novo', eDel: 'Não consegui apagar. Tente de novo.',
  },
  en: {
    intro: 'The system automatically searches every day for news, launches, works and tourism around your properties. Each item shows the source and the date it was published. Delete whatever does not make sense — nothing here goes public.',
    lastRun: 'Last collection', next: 'next', tomorrow: 'tomorrow', nextDaily: 'on the next daily round', never: 'No automatic collection yet.',
    region: 'Neighborhood/region', kind: 'Type', all: 'All', auto: 'Automatic', del: 'Delete', confirmDel: 'Delete this item?', source: 'Source', published: 'Published on',
    empty: 'No items yet. The first collection happens on its own in the next daily cycle.', emptyFilter: 'No items match these filters.',
    loading: 'Loading…', eLoad: 'Could not load the feed.', retry: 'Try again', eDel: 'Could not delete. Try again.',
  },
} as const

interface Signal { id: string; kind: string; region: string | null; title: string; summary: string | null; source_name: string | null; source_url: string | null; observed_at: string | null; collected_by: string | null }

const fmtDate = (s: string | null) => (s ? s.split('-').reverse().join('/') : '')
const fmtDayMonth = (iso: string) => { const d = new Date(iso); return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}` }
const sameLocalDay = (iso: string) => new Date(iso).toDateString() === new Date().toDateString()
const httpsHost = (u: string | null) => { try { const p = new URL(u ?? ''); return p.protocol === 'https:' || p.protocol === 'http:' ? p.hostname.replace(/^www\./, '') : null } catch { return null } }
const select: React.CSSProperties = { padding: '7px 10px', background: 'rgba(255,255,255,0.05)', border: `1px solid ${BORDER}`, borderRadius: '8px', color: 'white', fontSize: '12.5px', fontFamily: 'inherit' }

export default function MarketFeed({ lang, companyId }: { lang: 'pt' | 'en'; companyId: string }) {
  const t = TX[lang], kinds: Record<string, string> = KIND_LABEL[lang]
  const [list, setList] = useState<Signal[] | null>(null)
  const [loadErr, setLoadErr] = useState(false)
  const [lastRun, setLastRun] = useState<string | null | undefined>(undefined) // undefined = não sei (RLS/erro); null = nunca
  const [region, setRegion] = useState('')
  const [kind, setKind] = useState('')
  const [delErr, setDelErr] = useState(false)
  const busy = useRef(false)

  const load = useCallback(async () => {
    const [sig, led] = await Promise.all([
      supabase.from('market_signals').select('id, kind, region, title, summary, source_name, source_url, observed_at, collected_by')
        .eq('company_id', companyId).order('observed_at', { ascending: false, nullsFirst: false }).order('created_at', { ascending: false }).limit(100),
      supabase.from('agent_performance').select('created_at').eq('company_id', companyId).eq('task_key', 'market_news_search').order('created_at', { ascending: false }).limit(1),
    ])
    setLoadErr(!!sig.error)
    setList(sig.error ? [] : (sig.data ?? []) as Signal[])
    setLastRun(led.error ? undefined : ((led.data ?? [])[0] as { created_at: string } | undefined)?.created_at ?? null)
  }, [companyId])
  useEffect(() => { void load() }, [load])

  const regions = useMemo(() => [...new Set((list ?? []).map(s => s.region).filter((r): r is string => !!r))].sort((a, b) => a.localeCompare(b)), [list])
  const kindsInList = useMemo(() => [...new Set((list ?? []).map(s => s.kind))], [list])
  const shown = (list ?? []).filter(s => (!region || s.region === region) && (!kind || s.kind === kind))

  const remove = async (s: Signal) => {
    if (busy.current || !window.confirm(t.confirmDel)) return
    busy.current = true; setDelErr(false)
    const { error } = await supabase.from('market_signals').delete().eq('id', s.id).eq('company_id', companyId)
    if (error) setDelErr(true); else await load()
    busy.current = false
  }

  return (
    <section style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: '12px', padding: '16px', maxWidth: '900px' }}>
      <p style={{ color: MUTED, fontSize: '12.5px', lineHeight: 1.55, margin: '0 0 10px' }}>{t.intro}</p>
      {lastRun !== undefined && (
        <div role="status" style={{ fontSize: '12.5px', color: 'white', fontWeight: 600, marginBottom: '12px' }}>
          {lastRun ? `${t.lastRun}: ${fmtDayMonth(lastRun)} — ${t.next}: ${sameLocalDay(lastRun) ? t.tomorrow : t.nextDaily}` : t.never}
        </div>
      )}
      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '12px' }}>
        <label style={{ fontSize: '11.5px', color: MUTED }}>{t.region}{' '}
          <select style={select} value={region} onChange={e => setRegion(e.target.value)}>
            <option value="">{t.all}</option>{regions.map(r => <option key={r} value={r}>{r}</option>)}
          </select></label>
        <label style={{ fontSize: '11.5px', color: MUTED }}>{t.kind}{' '}
          <select style={select} value={kind} onChange={e => setKind(e.target.value)}>
            <option value="">{t.all}</option>{kindsInList.map(k => <option key={k} value={k}>{kinds[k] ?? k}</option>)}
          </select></label>
      </div>
      {delErr && <div role="alert" style={{ color: '#FBBF24', fontSize: '12.5px', marginBottom: '8px' }}>{t.eDel}</div>}
      {list === null ? <div style={{ color: MUTED, fontSize: '12.5px' }}>{t.loading}</div>
        : loadErr ? <div style={{ color: '#F87171', fontSize: '12.5px' }}>{t.eLoad} <button type="button" onClick={() => { setList(null); void load() }} style={{ background: 'none', border: 'none', color: ORANGE, cursor: 'pointer', fontSize: '12.5px', padding: 0 }}>{t.retry}</button></div>
        : shown.length === 0 ? <div style={{ color: MUTED, fontSize: '12.5px' }}>{list.length === 0 ? t.empty : t.emptyFilter}</div>
        : (
          <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {shown.map(s => {
              const host = httpsHost(s.source_url)
              return (
                <li key={s.id} style={{ border: `1px solid ${BORDER}`, borderRadius: '10px', padding: '10px 12px', display: 'flex', gap: '10px', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                  <div style={{ minWidth: 0, fontSize: '12.5px', lineHeight: 1.5 }}>
                    <div style={{ color: 'white', fontWeight: 700, overflowWrap: 'anywhere' }}>
                      {s.collected_by === 'system' && <span style={{ display: 'inline-block', marginRight: '6px', padding: '1px 7px', borderRadius: '999px', border: `1px solid ${ORANGE}`, color: ORANGE, fontSize: '10.5px', fontWeight: 700, verticalAlign: 'middle' }}>{t.auto}</span>}
                      {s.title}
                    </div>
                    {s.summary && <div style={{ color: MUTED, overflowWrap: 'anywhere', margin: '2px 0' }}>{s.summary}</div>}
                    <div style={{ color: MUTED, overflowWrap: 'anywhere' }}>
                      {[kinds[s.kind] ?? s.kind, s.region, s.observed_at ? `${t.published} ${fmtDate(s.observed_at)}` : ''].filter(Boolean).join(' · ')}
                      {' · '}{t.source}:{' '}
                      {s.source_url && host
                        ? <a href={s.source_url} target="_blank" rel="noopener noreferrer" style={{ color: ORANGE }}>{host}</a>
                        : (s.source_name || '—')}
                    </div>
                  </div>
                  <button onClick={() => remove(s)} style={{ background: 'transparent', border: `1px solid ${BORDER}`, color: MUTED, borderRadius: '8px', padding: '5px 10px', fontSize: '12px', cursor: 'pointer', fontFamily: D, flexShrink: 0 }}>{t.del}</button>
                </li>
              )
            })}
          </ul>
        )}
    </section>
  )
}
