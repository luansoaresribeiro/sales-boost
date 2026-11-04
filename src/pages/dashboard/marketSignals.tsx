import { useCallback, useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { bi, type Bilingual } from '../../lib/verticalPlaybook'
import { CARD, MUTED, BORDER, D, ORANGE } from './marketingAi/shared'
import { isIgnored, setSignalIgnored, type SignalMeta } from './marketingAi/signalIgnore'

// "Sinais de mercado" (Inteligência comercial, Etapa 2): o cliente cola à mão notícia/lançamento/obra/
// preço anunciado. Grava direto em `market_signals` (RLS da empresa). O motor
// (_shared/opportunityEngine.ts) só usa sinal com título E (nome da fonte OU link), e só gera
// `market_change` se houver item do catálogo na mesma região — por isso fonte é obrigatória aqui e a
// região sugere os bairros do catálogo. Em vitrine (readOnly) vira somente visualização.

const KINDS = ['news', 'launch', 'infrastructure', 'economy', 'tourism', 'rental', 'listing_price', 'supply', 'other'] as const
type Kind = typeof KINDS[number]
const LIM = { title: 200, summary: 500, region: 120, source: 120, url: 500 }

const TX = {
  pt: {
    title: 'Sinais de mercado',
    intro: 'Cole aqui notícias, lançamentos, obras ou preços anunciados que você viu. Com fonte e data, o sistema liga aos seus imóveis da mesma região e usa como prova nas oportunidades. Preço anunciado não é preço de venda.',
    auto: 'Automático', autoNote: 'O sistema também busca notícias da região dos seus imóveis todo dia, com fonte e data. Apague o que não fizer sentido.',
    needSource: 'A fonte é obrigatória: sinal sem fonte é ignorado pelo sistema. Use o mesmo nome de região do seu catálogo para a ligação funcionar.',
    kind: 'Tipo', t: 'Título', summary: 'Resumo (opcional)', region: 'Região', source: 'Nome da fonte', url: 'Link da fonte (recomendado)', date: 'Data em que foi publicado/visto',
    save: 'Salvar sinal', saving: 'Salvando…', plan: 'Disponível no plano — ver planos',
    saved: 'Sinal salvo. Se a análise automática estiver ligada na sua conta (estratégia automática, com plano ativo), o sistema considera o sinal na próxima análise: ela roda quando entra sinal novo (no mínimo 24 horas depois da última) e, de qualquer forma, uma vez por semana.',
    addManual: 'Adicionar sinal manual',
    ignore: 'Ignorar', restore: 'Restaurar', ignoredTitle: (n: number) => `Ignorados (${n})`, ignoredNote: 'Fora das análises. A evidência continua guardada.', ignoredAt: 'Ignorado em', eIgnore: 'Não consegui ignorar. Tente de novo.', eRestore: 'Não consegui restaurar. Tente de novo.',
    listTitle: 'Sinais cadastrados', empty: 'Nenhum sinal cadastrado ainda.', allIgnored: 'Todos os sinais estão ignorados.', del: 'Apagar', confirmDel: 'Apagar este sinal?',
    eTitle: 'Informe o título.', eSource: 'Informe o nome da fonte.', eUrl: 'O link precisa começar com http:// ou https:// e ser válido.', eDate: 'Informe a data (não pode ser futura).',
    eSave: 'Não consegui salvar. Tente de novo.', eDel: 'Não consegui apagar. Tente de novo.', loading: 'Carregando…', eLoad: 'Não consegui carregar os sinais.', retry: 'Tentar de novo',
    kinds: { news: 'Notícia', launch: 'Lançamento', infrastructure: 'Obra/infraestrutura', economy: 'Economia/juros', tourism: 'Turismo', rental: 'Aluguel', listing_price: 'Preço anunciado', supply: 'Oferta de imóveis', other: 'Outro' } as Record<Kind, string>,
  },
  en: {
    title: 'Market signals',
    intro: 'Paste here news, launches, works or listed prices you have seen. With a source and date, the system links them to your properties in the same region and uses them as proof in opportunities. Listed price is not sale price.',
    auto: 'Automatic', autoNote: 'The system also searches for news about the region of your properties every day, with source and date. Delete whatever does not make sense.',
    needSource: 'The source is required: a signal without a source is ignored by the system. Use the same region name as your catalog so the link works.',
    kind: 'Type', t: 'Title', summary: 'Summary (optional)', region: 'Region', source: 'Source name', url: 'Source link (recommended)', date: 'Date it was published/seen',
    save: 'Save signal', saving: 'Saving…', plan: 'Available on a paid plan — see plans',
    saved: 'Signal saved. If automatic analysis is on for your account (automatic strategy, with an active plan), the system takes the signal into account in the next analysis: it runs when a new signal arrives (at least 24 hours after the last one) and, regardless, once a week.',
    addManual: 'Add manual signal',
    ignore: 'Ignore', restore: 'Restore', ignoredTitle: (n: number) => `Ignored (${n})`, ignoredNote: 'Left out of the analyses. The evidence is kept.', ignoredAt: 'Ignored on', eIgnore: 'Could not ignore. Try again.', eRestore: 'Could not restore. Try again.',
    listTitle: 'Saved signals', empty: 'No signals yet.', allIgnored: 'All signals are ignored.', del: 'Delete', confirmDel: 'Delete this signal?',
    eTitle: 'Enter the title.', eSource: 'Enter the source name.', eUrl: 'The link must start with http:// or https:// and be valid.', eDate: 'Enter the date (cannot be in the future).',
    eSave: 'Could not save. Try again.', eDel: 'Could not delete. Try again.', loading: 'Loading…', eLoad: 'Could not load the signals.', retry: 'Try again',
    kinds: { news: 'News', launch: 'Launch', infrastructure: 'Works/infrastructure', economy: 'Economy/interest rates', tourism: 'Tourism', rental: 'Rental', listing_price: 'Listed price', supply: 'Property supply', other: 'Other' } as Record<Kind, string>,
  },
} as const

interface Signal { id: string; kind: string; region: string | null; title: string; source_name: string | null; source_url: string | null; observed_at: string | null; collected_by: string | null; meta: SignalMeta | null; summary: string | null }

const localToday = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` }
const fmtDate = (s: string | null) => (s ? s.split('-').reverse().join('/') : '')
const validUrl = (u: string) => { try { const p = new URL(u); return p.protocol === 'http:' || p.protocol === 'https:' } catch { return false } }

const input: React.CSSProperties = { width: '100%', boxSizing: 'border-box', padding: '9px 11px', background: 'rgba(255,255,255,0.05)', border: `1px solid ${BORDER}`, borderRadius: '8px', color: 'white', fontSize: '13px', fontFamily: 'inherit' }
const label: React.CSSProperties = { display: 'block', fontSize: '11.5px', color: MUTED, marginBottom: '4px' }

const smallBtn: React.CSSProperties = { background: 'transparent', border: `1px solid ${BORDER}`, color: MUTED, borderRadius: '8px', padding: '5px 10px', fontSize: '12px', cursor: 'pointer', fontFamily: D }

interface Props { lang: 'pt' | 'en'; companyId: string; verticalKey: string | null; readOnly: boolean; openPlanModal: () => void; onChanged: () => void }

export default function MarketSignals({ lang, companyId, verticalKey, readOnly, openPlanModal, onChanged }: Props) {
  const t = TX[lang]
  const [list, setList] = useState<Signal[] | null>(null)
  const [regions, setRegions] = useState<string[]>([])
  const [regionLabel, setRegionLabel] = useState('')
  const [f, setF] = useState({ kind: 'news' as Kind, title: '', summary: '', region: '', source: '', url: '', date: '' })
  const [saving, setSaving] = useState(false)
  const [loadErr, setLoadErr] = useState(false)
  const busy = useRef(false)
  // "+" → Adicionar sinal (?add=signal): abre o formulário recolhido, rola até ele e foca o primeiro campo.
  const [params, setParams] = useSearchParams()
  const [addOpen, setAddOpen] = useState(false)
  const [focusForm, setFocusForm] = useState(false)
  const addRef = useRef<HTMLDetailsElement>(null)
  useEffect(() => {
    if (params.get('add') !== 'signal') return
    setAddOpen(true); setFocusForm(true)
    setParams(p => { const n = new URLSearchParams(p); n.delete('add'); return n }, { replace: true })
  }, [params, setParams])
  useEffect(() => {
    if (!focusForm || !addOpen) return
    addRef.current?.scrollIntoView?.({ block: 'center', behavior: 'smooth' })
    document.getElementById('ms-kind')?.focus({ preventScroll: true })
    setFocusForm(false)
  }, [focusForm, addOpen])
  const [listErr, setListErr] = useState('')
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)

  const loadList = useCallback(async () => {
    const { data, error } = await supabase.from('market_signals').select('id, kind, region, title, summary, source_name, source_url, observed_at, collected_by, meta')
      .eq('company_id', companyId).order('observed_at', { ascending: false, nullsFirst: false }).order('created_at', { ascending: false }).limit(50)
    setLoadErr(!!error)
    setList(error ? [] : (data ?? []) as Signal[])
  }, [companyId])

  useEffect(() => { void loadList() }, [loadList])

  // Bairros/regiões que já existem no catálogo (campo de localização vem da ficha do setor).
  useEffect(() => {
    let alive = true
    void (async () => {
      const pb = verticalKey ? await supabase.from('vertical_playbooks').select('config').eq('key', verticalKey).eq('enabled', true).maybeSingle() : null
      const cfg = (pb?.data?.config ?? {}) as { opportunity_fields?: { location?: string }; catalog_fields?: { required?: { key: string; label?: Bilingual }[]; optional?: { key: string; label?: Bilingual }[] } }
      const key = cfg.opportunity_fields?.location
      if (!key || !alive) return
      const fl = [...(cfg.catalog_fields?.required ?? []), ...(cfg.catalog_fields?.optional ?? [])].find(x => x.key === key)
      if (fl) setRegionLabel(bi(fl.label, lang).replace(/\s*\(.*\)\s*$/, ''))
      const { data } = await supabase.from('marketing_ai_knowledge').select('meta').eq('company_id', companyId).eq('kind', 'product').limit(200)
      const set = new Map<string, string>()
      for (const r of (data ?? []) as { meta: { fields?: Record<string, unknown> } | null }[]) {
        const v = r.meta?.fields?.[key]
        const s = typeof v === 'string' ? v.trim() : ''
        if (s && !set.has(s.toLowerCase())) set.set(s.toLowerCase(), s)
      }
      if (alive) setRegions([...set.values()].sort((a, b) => a.localeCompare(b)))
    })()
    return () => { alive = false }
  }, [companyId, verticalKey, lang])

  const save = async () => {
    if (readOnly) { openPlanModal(); return }
    if (busy.current) return
    const title = f.title.trim(), source = f.source.trim(), url = f.url.trim(), region = f.region.trim(), summary = f.summary.trim()
    const err = !title ? t.eTitle : !source ? t.eSource : url && (url.length > LIM.url || !validUrl(url)) ? t.eUrl : !f.date || f.date > localToday() ? t.eDate : ''
    if (err) { setMsg({ ok: false, text: err }); return }
    busy.current = true; setSaving(true); setMsg(null)
    const { error } = await supabase.from('market_signals').insert({
      company_id: companyId, kind: f.kind, title: title.slice(0, LIM.title), summary: summary ? summary.slice(0, LIM.summary) : null,
      region: region ? region.slice(0, LIM.region) : null, source_name: source.slice(0, LIM.source), source_url: url || null, observed_at: f.date, collected_by: 'manual',
    })
    if (error) setMsg({ ok: false, text: t.eSave })
    else { setMsg({ ok: true, text: t.saved }); setF(p => ({ ...p, title: '', summary: '', source: '', url: '' })); await loadList(); onChanged() }
    busy.current = false; setSaving(false)
  }

  const remove = async (s: Signal) => {
    if (readOnly) { openPlanModal(); return }
    if (busy.current || !window.confirm(t.confirmDel)) return
    busy.current = true
    const { error } = await supabase.from('market_signals').delete().eq('id', s.id).eq('company_id', companyId)
    if (error) setMsg({ ok: false, text: t.eDel }); else { setMsg(null); await loadList(); onChanged() }
    busy.current = false
  }

  const toggleIgnore = async (s: Signal, ignored: boolean) => {
    if (readOnly) { openPlanModal(); return }
    if (busy.current) return
    busy.current = true
    const ok = await setSignalIgnored(s.id, companyId, ignored)
    if (!ok) setListErr(ignored ? t.eIgnore : t.eRestore) // lista não muda se falhou
    else { setListErr(''); await loadList(); onChanged() }
    busy.current = false
  }

  const active = (list ?? []).filter(s => !isIgnored(s.meta))
  const ignoredList = (list ?? []).filter(s => isIgnored(s.meta))
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF(p => ({ ...p, [k]: e.target.value }))

  return (
    <section style={{ marginTop: '28px', background: CARD, border: `1px solid ${BORDER}`, borderRadius: '12px', padding: '16px' }} aria-label={t.title}>
      <h2 style={{ fontFamily: D, fontSize: '1.05rem', fontWeight: 800, color: 'white', margin: '0 0 6px' }}>{t.title}</h2>
      <p style={{ color: MUTED, fontSize: '12.5px', lineHeight: 1.55, margin: '0 0 6px' }}>{t.intro}</p>
      <p style={{ color: '#FBBF24', fontSize: '12px', lineHeight: 1.5, margin: '0 0 14px' }}>{t.needSource}</p>
      <p style={{ color: MUTED, fontSize: '12px', lineHeight: 1.5, margin: '-6px 0 14px' }}>{t.autoNote}</p>

      <details ref={addRef} open={addOpen} onToggle={e => setAddOpen((e.currentTarget as HTMLDetailsElement).open)} style={{ marginBottom: '4px' }}>
        <summary style={{ cursor: 'pointer', color: ORANGE, fontSize: '13px', fontWeight: 700, fontFamily: D }}>{t.addManual}</summary>
        <div style={{ marginTop: '12px' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '10px' }}>
        <div><label style={label} htmlFor="ms-kind">{t.kind}</label>
          <select id="ms-kind" style={input} value={f.kind} onChange={set('kind')}>{KINDS.map(k => <option key={k} value={k}>{t.kinds[k]}</option>)}</select></div>
        <div><label style={label} htmlFor="ms-region">{regionLabel || t.region}</label>
          <input id="ms-region" style={input} list="ms-regions" maxLength={LIM.region} value={f.region} onChange={set('region')} />
          <datalist id="ms-regions">{regions.map(r => <option key={r} value={r} />)}</datalist></div>
        <div><label style={label} htmlFor="ms-date">{t.date} *</label>
          <input id="ms-date" type="date" style={input} max={localToday()} value={f.date} onChange={set('date')} /></div>
      </div>
      <div style={{ marginTop: '10px' }}><label style={label} htmlFor="ms-title">{t.t} *</label>
        <input id="ms-title" style={input} maxLength={LIM.title} value={f.title} onChange={set('title')} /></div>
      <div style={{ marginTop: '10px' }}><label style={label} htmlFor="ms-sum">{t.summary} — {f.summary.length}/{LIM.summary}</label>
        <textarea id="ms-sum" rows={3} style={{ ...input, resize: 'vertical' }} maxLength={LIM.summary} value={f.summary} onChange={set('summary')} /></div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '10px', marginTop: '10px' }}>
        <div><label style={label} htmlFor="ms-src">{t.source} *</label>
          <input id="ms-src" style={input} maxLength={LIM.source} value={f.source} onChange={set('source')} /></div>
        <div><label style={label} htmlFor="ms-url">{t.url}</label>
          <input id="ms-url" type="url" inputMode="url" placeholder="https://" style={input} maxLength={LIM.url} value={f.url} onChange={set('url')} /></div>
      </div>

      <button onClick={save} disabled={saving} aria-disabled={readOnly || saving} title={readOnly ? t.plan : undefined}
        style={{ marginTop: '14px', padding: '10px 20px', background: readOnly ? 'rgba(255,255,255,0.08)' : ORANGE, color: readOnly ? MUTED : '#000', fontWeight: 800, fontSize: '13px', border: 'none', borderRadius: '10px', cursor: saving ? 'default' : 'pointer', opacity: saving ? 0.7 : 1, fontFamily: D }}>
        {saving ? t.saving : readOnly ? `🔒 ${t.save}` : t.save}
      </button>
      {msg && <div role="status" style={{ fontSize: '12.5px', marginTop: '10px', color: msg.ok ? '#4ade80' : '#FBBF24' }}>{msg.text}</div>}
        </div>
      </details>

      <div style={{ fontSize: '13px', fontWeight: 700, color: 'white', margin: '18px 0 8px' }}>{t.listTitle}</div>
      {listErr && <div role="alert" style={{ color: '#FBBF24', fontSize: '12.5px', marginBottom: '8px' }}>{listErr}</div>}
      {list === null ? <div style={{ color: MUTED, fontSize: '12.5px' }}>{t.loading}</div>
        : loadErr ? <div style={{ color: '#F87171', fontSize: '12.5px' }}>{t.eLoad} <button type="button" onClick={() => { setList(null); void loadList() }} style={{ background: 'none', border: 'none', color: ORANGE, cursor: 'pointer', fontSize: '12.5px', padding: 0 }}>{t.retry}</button></div>
        : active.length === 0 ? <div style={{ color: MUTED, fontSize: '12.5px' }}>{ignoredList.length > 0 ? t.allIgnored : t.empty}</div>
        : (
          <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {active.map(s => (
              <li key={s.id} style={{ border: `1px solid ${BORDER}`, borderRadius: '10px', padding: '10px 12px', display: 'flex', gap: '10px', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                <div style={{ minWidth: 0, fontSize: '12.5px', lineHeight: 1.5 }}>
                  <div style={{ color: 'white', fontWeight: 700, overflowWrap: 'anywhere' }}>
                    {s.collected_by === 'system' && <span style={{ display: 'inline-block', marginRight: '6px', padding: '1px 7px', borderRadius: '999px', border: `1px solid ${ORANGE}`, color: ORANGE, fontSize: '10.5px', fontWeight: 700, verticalAlign: 'middle' }}>{t.auto}</span>}
                    {s.title}</div>
                  <div style={{ color: MUTED, overflowWrap: 'anywhere' }}>
                    {[t.kinds[s.kind as Kind] ?? s.kind, s.region, fmtDate(s.observed_at)].filter(Boolean).join(' · ')}
                    {' · '}
                    {s.source_url && validUrl(s.source_url)
                      ? <a href={s.source_url} target="_blank" rel="noopener noreferrer" style={{ color: ORANGE }}>{s.source_name || s.source_url}</a>
                      : (s.source_name || '')}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                  <button onClick={() => toggleIgnore(s, true)} aria-disabled={readOnly} title={readOnly ? t.plan : undefined} style={smallBtn}>{readOnly ? '🔒 ' : ''}{t.ignore}</button>
                  <button onClick={() => remove(s)} aria-disabled={readOnly} title={readOnly ? t.plan : undefined} style={smallBtn}>{readOnly ? '🔒 ' : ''}{t.del}</button>
                </div>
              </li>
            ))}
          </ul>
        )}

      {ignoredList.length > 0 && (
        <details style={{ marginTop: '16px' }}>
          <summary style={{ cursor: 'pointer', color: MUTED, fontSize: '12.5px', fontWeight: 700 }}>{t.ignoredTitle(ignoredList.length)}</summary>
          <p style={{ color: MUTED, fontSize: '12px', margin: '6px 0 8px' }}>{t.ignoredNote}</p>
          <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {ignoredList.map(s => (
              <li key={s.id} style={{ border: `1px dashed ${BORDER}`, borderRadius: '10px', padding: '10px 12px', display: 'flex', gap: '10px', alignItems: 'flex-start', justifyContent: 'space-between', opacity: 0.85 }}>
                <div style={{ minWidth: 0, fontSize: '12.5px', lineHeight: 1.5 }}>
                  <div style={{ color: 'white', fontWeight: 700, overflowWrap: 'anywhere' }}>{s.title}</div>
                  {s.summary && <div style={{ color: MUTED, overflowWrap: 'anywhere' }}>{s.summary}</div>}
                  <div style={{ color: MUTED, overflowWrap: 'anywhere' }}>
                    {[t.kinds[s.kind as Kind] ?? s.kind, s.region, fmtDate(s.observed_at)].filter(Boolean).join(' · ')}
                    {' · '}
                    {s.source_url && validUrl(s.source_url)
                      ? <a href={s.source_url} target="_blank" rel="noopener noreferrer" style={{ color: ORANGE }}>{s.source_name || s.source_url}</a>
                      : (s.source_name || '')}
                    {s.meta?.ignored_at ? ` · ${t.ignoredAt} ${String(s.meta.ignored_at).slice(0, 10).split('-').reverse().join('/')}` : ''}
                  </div>
                </div>
                <button onClick={() => toggleIgnore(s, false)} aria-disabled={readOnly} title={readOnly ? t.plan : undefined} style={{ ...smallBtn, flexShrink: 0 }}>{readOnly ? '🔒 ' : ''}{t.restore}</button>
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  )
}
