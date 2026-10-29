import { useCallback, useEffect, useMemo, useState } from 'react'
import type { CompanyData } from '../../../contexts/CompanyContext'
import { useLang } from '../../../contexts/LanguageContext'
import { supabase } from '../../../lib/supabase'
import { useRealtime } from '../../../lib/useRealtime'
import { CARD, MUTED, BORDER, D } from './shared'
import { fmtBRL, fmtNum, useDemoMode } from './growthDemo'
import { buildFunnelDemo, STAGE_ORDER, TEMP_META, type DemoLead, type LeadStageKey } from './salesDemo'
import { mapLeadRow, STAGE_TO_DB, type LeadRow } from './salesReal'
import DataVeil, { veilMode } from './DataVeil'
import { STAGE_EN, TEMP_EN } from './labels.i18n'
import { forwardUrl, parseMoney, stampsForStage, valueColumnFor, type StageKey } from '../resultsBrokers'
import ChannelFilter, { ChannelBadge, type ChannelFilterValue } from './ChannelFilter'

const ORANGE = '#FF6D29'
const GREEN = '#4ade80'

const TX = {
  pt: {
    noReply: '⚠️ Sem resposta — risco de esfriar', drafted: '✓ Follow-up rascunhado, aguardando sua aprovação', draftBtn: 'Rascunhar follow-up', advance: 'Avançar etapa',
    realB: 'Dados reais.', realBA: ' Estes são os leads capturados de verdade (Instagram, WhatsApp e outros canais). Avançar de etapa salva no CRM na hora. A IA classifica cada lead e rascunha o follow-up — mas ', realBB: 'nada é enviado sem sua aprovação',
    demoB: 'Modo demonstração.', demoBA: ' Estes leads são fictícios. Assim que chegar o primeiro lead real (Instagram, WhatsApp ou anúncios), o funil mostra os de verdade automaticamente.',
    errTitle: 'Erro ao carregar os leads', emptyTitle: 'Sem leads reais ainda', errMsg: 'A consulta ao banco falhou — veja o erro abaixo pra saber o que corrigir.',
    emptyMsg: 'Assim que o primeiro lead chegar (Instagram, WhatsApp ou anúncios), o funil mostra os leads de verdade aqui, sozinho. Ligue o Modo demonstração pra ver o layout com exemplos.',
    seeExample: 'Ver exemplo (modo demonstração)', sameFunnel: 'Instagram e WhatsApp no mesmo funil — filtre pela origem.',
    leadsInFunnel: 'Leads no funil', conversion: 'Conversão', pipelineValue: 'Valor no pipeline', noReplyLbl: 'Sem resposta', empty: 'vazio',
    broker: 'Corretor', forward: 'Encaminhar por WhatsApp', forwardHint: 'Abre o seu WhatsApp com o resumo — nada é enviado por nós.', valProposal: 'Valor da proposta', valSale: 'Valor da venda', valNone: 'valor não informado', valInform: 'informar valor', valPh: 'Opcional, ex.: 850000', valConfirm: 'Confirmar', valSkip: 'Pular (sem valor)', valSave: 'Salvar valor', valCancel: 'Cancelar', valBad: 'Valor inválido — use só números.', valVisit: 'Marca visita agendada',
  },
  en: {
    noReply: '⚠️ No reply — risk of going cold', drafted: '✓ Follow-up drafted, awaiting your approval', draftBtn: 'Draft follow-up', advance: 'Advance stage',
    realB: 'Real data.', realBA: ' These are the leads actually captured (Instagram, WhatsApp and other channels). Advancing a stage saves to the CRM right away. The AI classifies each lead and drafts the follow-up — but ', realBB: 'nothing is sent without your approval',
    demoB: 'Demo mode.', demoBA: ' These leads are fictional. As soon as the first real lead arrives (Instagram, WhatsApp or ads), the pipeline shows the real ones automatically.',
    errTitle: 'Error loading leads', emptyTitle: 'No real leads yet', errMsg: 'The database query failed — see the error below to know what to fix.',
    emptyMsg: 'As soon as the first lead arrives (Instagram, WhatsApp or ads), the pipeline shows the real leads here on its own. Turn on Demo mode to see the layout with examples.',
    seeExample: 'See an example (demo mode)', sameFunnel: 'Instagram and WhatsApp in the same pipeline — filter by source.',
    leadsInFunnel: 'Leads in pipeline', conversion: 'Conversion', pipelineValue: 'Pipeline value', noReplyLbl: 'No reply', empty: 'empty',
    broker: 'Broker', forward: 'Forward by WhatsApp', forwardHint: 'Opens your WhatsApp with the summary — nothing is sent by us.', valProposal: 'Proposal value', valSale: 'Sale value', valNone: 'value not informed', valInform: 'add value', valPh: 'Optional, e.g. 850000', valConfirm: 'Confirm', valSkip: 'Skip (no value)', valSave: 'Save value', valCancel: 'Cancel', valBad: 'Invalid value — numbers only.', valVisit: 'Marks scheduled visit',
  },
} as const

function nextStage(key: LeadStageKey): LeadStageKey | null {
  const i = STAGE_ORDER.findIndex(s => s.key === key)
  return i >= 0 && i < STAGE_ORDER.length - 1 ? STAGE_ORDER[i + 1].key : null
}

// Dados extras do lead real (Etapas 6 e 7): datas/valores carimbados, corretor da vez e resumo para encaminhar.
interface Extra {
  contact: string | null; notes: string | null; item_id: string | null; assigned_broker_id: string | null
  proposal_value: number | null; closed_value: number | null; visit_at: string | null; proposal_at: string | null; closed_at: string | null
}
interface Broker { id: string; name: string; phone: string }
interface Prompt { id: string; col: 'proposal_value' | 'closed_value'; nx: StageKey | null }

function LeadCard({ lead, drafted, onDraft, onAdvance, extra, broker, itemTitle, prompt, onPrompt, onValue, onCancel }: {
  lead: DemoLead; drafted: boolean; onDraft: () => void; onAdvance: () => void
  extra?: Extra; broker?: Broker; itemTitle?: string | null; prompt: Prompt | null; onPrompt: (col: Prompt['col']) => void; onValue: (raw: string) => boolean; onCancel: () => void // onValue devolve true se o valor é inválido
}) {
  const [val, setVal] = useState('')
  const [bad, setBad] = useState(false)
  const { lang } = useLang()
  const tx = TX[lang]
  const t = TEMP_META[lead.temperature]
  const tempLabel = lang === 'en' ? TEMP_EN[lead.temperature] ?? t.label : t.label
  const canAdvance = !!nextStage(lead.stageKey)
  const valCol = extra ? valueColumnFor(lead.stageKey) : null
  const curVal = valCol && extra ? extra[valCol] : null
  const href = extra && broker ? forwardUrl(broker.phone, { name: lead.name, contact: extra.contact, item: itemTitle ?? null, message: extra.notes }, lang) : null
  const submit = (skip: boolean) => { if (onValue(skip ? '' : val)) setBad(true); else { setBad(false); setVal('') } }
  const mine = prompt?.id === lead.id ? prompt : null
  return (
    <div style={{ background: CARD, border: `1px solid ${lead.noReply ? 'rgba(251,191,36,0.35)' : BORDER}`, borderRadius: '10px', padding: '11px 12px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', marginBottom: '5px' }}>
        <span style={{ fontSize: '12px', fontWeight: 700, color: 'white', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{lead.name}</span>
        <span title={tempLabel} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
          <span style={{ width: '7px', height: '7px', borderRadius: '99px', background: t.color }} />
        </span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px', flexWrap: 'wrap' }}>
        <ChannelBadge channel={lead.channelKey} />
        <span style={{ fontSize: '11px', fontWeight: 700, color: ORANGE }}>{fmtBRL(lead.value, false, lang)}</span>
        <span style={{ fontSize: '9.5px', color: 'rgba(255,255,255,0.3)' }}>{lead.lastContact}</span>
      </div>
      <div style={{ fontSize: '10.5px', color: MUTED, lineHeight: 1.45, marginBottom: '8px', overflowWrap: 'anywhere' }}>{lead.note}</div>
      {extra && broker && <div style={{ fontSize: '10.5px', color: 'white', marginBottom: '6px' }}>{tx.broker}: <strong>{broker.name}</strong></div>}
      {valCol && !mine && (
        <div style={{ fontSize: '10.5px', color: MUTED, marginBottom: '6px' }}>
          {valCol === 'proposal_value' ? tx.valProposal : tx.valSale}: {curVal != null ? <strong style={{ color: 'white' }}>{fmtBRL(Number(curVal), false, lang)}</strong> : tx.valNone}{' '}
          <button onClick={() => onPrompt(valCol)} style={{ background: 'transparent', border: 'none', padding: 0, color: ORANGE, fontSize: '10.5px', cursor: 'pointer', textDecoration: 'underline', fontFamily: D }}>{tx.valInform}</button>
        </div>
      )}
      {mine && (
        <div style={{ marginBottom: '8px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <div style={{ fontSize: '10.5px', color: 'white' }}>{mine.col === 'proposal_value' ? tx.valProposal : tx.valSale}</div>
          <input value={val} onChange={e => setVal(e.target.value)} inputMode="decimal" placeholder={tx.valPh} aria-label={tx.valProposal}
            style={{ width: '100%', boxSizing: 'border-box', padding: '6px 8px', background: 'rgba(255,255,255,0.05)', border: `1px solid ${BORDER}`, borderRadius: '7px', color: 'white', fontSize: '12px', outline: 'none' }} />
          {bad && <div role="alert" style={{ fontSize: '10px', color: '#f87171' }}>{tx.valBad}</div>}
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            <button onClick={() => submit(false)} style={{ padding: '5px 9px', background: ORANGE, color: '#000', fontWeight: 700, fontSize: '10px', border: 'none', borderRadius: '7px', cursor: 'pointer', fontFamily: D }}>{mine.nx ? tx.valConfirm : tx.valSave}</button>
            {mine.nx && <button onClick={() => submit(true)} style={{ padding: '5px 9px', background: 'transparent', color: MUTED, fontSize: '10px', border: `1px solid ${BORDER}`, borderRadius: '7px', cursor: 'pointer', fontFamily: D }}>{tx.valSkip}</button>}
            <button onClick={() => { setBad(false); setVal(''); onCancel() }} style={{ padding: '5px 9px', background: 'transparent', color: MUTED, fontSize: '10px', border: `1px solid ${BORDER}`, borderRadius: '7px', cursor: 'pointer', fontFamily: D }}>{tx.valCancel}</button>
          </div>
        </div>
      )}
      {href && (
        <a href={href} target="_blank" rel="noreferrer" title={tx.forwardHint}
          style={{ display: 'block', textAlign: 'center', padding: '5px 8px', marginBottom: '6px', background: 'rgba(74,222,128,0.1)', border: '1px solid rgba(74,222,128,0.3)', color: GREEN, fontWeight: 700, fontSize: '10px', borderRadius: '7px', textDecoration: 'none', fontFamily: D }}>
          {tx.forward}
        </a>
      )}
      {lead.noReply && !drafted && (
        <div style={{ fontSize: '9.5px', color: '#FBBF24', marginBottom: '8px' }}>{tx.noReply}</div>
      )}
      {drafted ? (
        <div style={{ fontSize: '10.5px', color: GREEN, lineHeight: 1.4, background: 'rgba(74,222,128,0.08)', border: '1px solid rgba(74,222,128,0.2)', borderRadius: '7px', padding: '6px 9px' }}>
          {tx.drafted}
        </div>
      ) : (
        <div style={{ display: 'flex', gap: '6px' }}>
          <button onClick={onDraft}
            style={{ flex: 1, padding: '5px 8px', background: 'rgba(255,109,41,0.12)', border: '1px solid rgba(255,109,41,0.35)', color: ORANGE, fontWeight: 700, fontSize: '10px', borderRadius: '7px', cursor: 'pointer', fontFamily: D }}>
            {tx.draftBtn}
          </button>
          {canAdvance && (
            <button onClick={onAdvance} title={nextStage(lead.stageKey) === 'qualificado' ? `${tx.advance} — ${tx.valVisit}` : tx.advance}
              style={{ padding: '5px 9px', background: 'transparent', border: `1px solid ${BORDER}`, color: MUTED, fontSize: '10px', borderRadius: '7px', cursor: 'pointer', fontFamily: D }}>
              →
            </button>
          )}
        </div>
      )}
    </div>
  )
}

export default function FunnelTab({ company }: { company: Pick<CompanyData, 'id' | 'business_name'> }) {
  const { lang } = useLang()
  const t = TX[lang]
  const demo = useMemo(() => buildFunnelDemo(company, lang), [company, lang])
  // Dado real da tabela `leads`. null = ainda carregando; [] = carregou e não
  // há lead real (então cai no demo, preservando o design).
  const [realLeads, setRealLeads] = useState<DemoLead[] | null>(null)
  const [demoLeads, setDemoLeads] = useState<DemoLead[]>(demo.leads)
  const [drafted, setDrafted] = useState<Set<string>>(new Set())
  const [channel, setChannel] = useState<ChannelFilterValue>('all')
  // Erro de verdade da consulta (não "ainda não tem lead" — isso é normal).
  // Pedido do dono: quando o painel fica borrado por causa de um erro, ele
  // precisa VER a mensagem real pra saber o que corrigir.
  const [loadError, setLoadError] = useState<string | null>(null)

  const [extras, setExtras] = useState<Record<string, Extra>>({})
  const [brokers, setBrokers] = useState<Broker[]>([])
  const [itemTitles, setItemTitles] = useState<Record<string, string>>({})
  const [prompt, setPrompt] = useState<Prompt | null>(null)

  const load = useCallback(async () => {
    const base = 'id, name, contact, channel, stage, value_estimate, last_contact_at, notes, created_at'
    const ext = 'item_id, visit_at, proposal_at, proposal_value, closed_at, closed_value, assigned_broker_id'
    // Etapas 6 e 7: colunas novas. Se a migration ainda não foi aplicada, a consulta com elas falha — cai na antiga (o funil não quebra).
    let res: { data: unknown; error: { message: string } | null } = await supabase.from('leads').select(`${base}, ${ext}`).eq('company_id', company.id).order('created_at', { ascending: false })
    if (res.error) res = await supabase.from('leads').select(base).eq('company_id', company.id).order('created_at', { ascending: false })
    const { data, error } = res
    if (error) { setLoadError(error.message); return }
    setLoadError(null)
    const rows = (data ?? []) as unknown as (LeadRow & Partial<Extra>)[]
    setRealLeads(rows.map(mapLeadRow))
    setExtras(Object.fromEntries(rows.map(r => [r.id, {
      contact: r.contact, notes: r.notes, item_id: r.item_id ?? null, assigned_broker_id: r.assigned_broker_id ?? null,
      proposal_value: r.proposal_value ?? null, closed_value: r.closed_value ?? null, visit_at: r.visit_at ?? null, proposal_at: r.proposal_at ?? null, closed_at: r.closed_at ?? null,
    }])))
    const itemIds = [...new Set(rows.map(r => r.item_id).filter((x): x is string => !!x))]
    const [b, it] = await Promise.all([
      supabase.from('brokers').select('id, name, phone').eq('company_id', company.id),
      itemIds.length ? supabase.from('marketing_ai_knowledge').select('id, title').in('id', itemIds) : Promise.resolve({ data: [], error: null }),
    ])
    setBrokers(b.error ? [] : (b.data ?? []) as Broker[])
    setItemTitles(it.error ? {} : Object.fromEntries(((it.data ?? []) as { id: string; title: string }[]).map(i => [i.id, i.title])))
  }, [company.id])
  useEffect(() => { void load() }, [load])
  useRealtime('leads', company.id, load)

  const isReal = !!realLeads && realLeads.length > 0
  const allLeads = isReal ? realLeads! : demoLeads
  const [demoMode, setDemoMode] = useDemoMode(company.id)
  const mode = veilMode({ hasReal: isReal, demoMode, error: !!loadError })

  const draft = (id: string) => setDrafted(prev => new Set(prev).add(id))
  // Move o lead real para a etapa nova, carimba visita/proposta/fechado (só se vazio) e grava o valor se o dono informou (opcional).
  const move = async (id: string, nx: StageKey, value: number | null) => {
    const now = new Date().toISOString()
    const vc = valueColumnFor(nx)
    const patch: Record<string, unknown> = { stage: STAGE_TO_DB[nx], last_contact_at: now, ...stampsForStage(nx, extras[id] ?? {}, now), ...(vc && value !== null ? { [vc]: value } : {}) }
    setRealLeads(prev => prev?.map(l => l.id === id ? { ...l, stageKey: nx, noReply: false } : l) ?? prev)
    const r = await supabase.from('leads').update(patch).eq('id', id).eq('company_id', company.id)
    // Colunas novas ausentes (migration pendente): ao menos a etapa continua avançando como antes.
    if (r.error) await supabase.from('leads').update({ stage: STAGE_TO_DB[nx], last_contact_at: now }).eq('id', id).eq('company_id', company.id)
    void load()
  }
  const advance = async (id: string) => {
    const lead = allLeads.find(l => l.id === id)
    const nx = lead ? nextStage(lead.stageKey) : null
    if (!nx) return
    if (!isReal) { setDemoLeads(prev => prev.map(l => l.id === id ? { ...l, stageKey: nx, noReply: false } : l)); return }
    const vc = valueColumnFor(nx)
    if (vc) setPrompt({ id, col: vc, nx }) // pergunta o valor (opcional) antes de mover
    else await move(id, nx, null)
  }
  // Retorna true se o valor digitado é inválido (o card mostra o aviso e nada é gravado).
  const submitValue = (raw: string): boolean => {
    if (!prompt) return false
    const value = raw.trim() ? parseMoney(raw) : null
    if (raw.trim() && value === null) return true
    const p = prompt
    setPrompt(null)
    if (p.nx) void move(p.id, p.nx, value)
    else if (value !== null) void supabase.from('leads').update({ [p.col]: value }).eq('id', p.id).eq('company_id', company.id).then(() => load())
    return false
  }

  // Um único funil — o filtro apenas mostra os leads do canal escolhido.
  const leads = channel === 'all' ? allLeads : allLeads.filter(l => l.channelKey === channel)

  const total = leads.length
  const sales = leads.filter(l => l.stageKey === 'venda').length
  const conversion = total ? ((sales / total) * 100).toFixed(1) : '0'
  const noReply = leads.filter(l => l.noReply).length
  const pipelineValue = leads.filter(l => l.stageKey !== 'venda').reduce((s, l) => s + l.value, 0)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {mode === 'real' && (
        <div style={{ padding: '12px 16px', background: 'rgba(74,222,128,0.06)', border: '1px solid rgba(74,222,128,0.22)', borderRadius: '11px', fontSize: '11.5px', color: 'white', lineHeight: 1.6 }}>
          🟢 <strong>{t.realB}</strong>{t.realBA}<strong>{t.realBB}</strong>.
        </div>
      )}
      {mode === 'demo' && (
        <div style={{ padding: '12px 16px', background: 'rgba(251,191,36,0.06)', border: '1px solid rgba(251,191,36,0.22)', borderRadius: '11px', fontSize: '11.5px', color: 'white', lineHeight: 1.6 }}>
          🔵 <strong>{t.demoB}</strong>{t.demoBA}
        </div>
      )}

      <DataVeil mode={mode}
        title={loadError ? t.errTitle : t.emptyTitle}
        message={loadError ? t.errMsg : t.emptyMsg}
        errorDetail={loadError}
        cta={{ label: t.seeExample, onClick: () => setDemoMode(true) }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Filtro de canal — um único funil, filtra por origem */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
        <ChannelFilter value={channel} onChange={setChannel} />
        <span style={{ fontSize: '11px', color: MUTED }}>{t.sameFunnel}</span>
      </div>

      {/* Resumo */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '10px' }}>
        <Summary label={t.leadsInFunnel} value={fmtNum(total, lang)} />
        <Summary label={t.conversion} value={`${conversion}%`} />
        <Summary label={t.pipelineValue} value={fmtBRL(pipelineValue, true, lang)} color={ORANGE} />
        <Summary label={t.noReplyLbl} value={fmtNum(noReply, lang)} color={noReply > 0 ? '#FBBF24' : undefined} />
      </div>

      {/* Kanban */}
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${STAGE_ORDER.length}, minmax(180px, 1fr))`, gap: '10px', overflowX: 'auto', paddingBottom: '6px' }}>
        {STAGE_ORDER.map(stage => {
          const colLeads = leads.filter(l => l.stageKey === stage.key)
          return (
            <div key={stage.key} style={{ display: 'flex', flexDirection: 'column', gap: '8px', minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 4px' }}>
                <span style={{ fontSize: '11px', fontWeight: 700, color: 'white' }}>{lang === 'en' ? STAGE_EN[stage.key] ?? stage.label : stage.label}</span>
                <span style={{ fontSize: '10px', fontWeight: 700, color: MUTED, background: 'rgba(255,255,255,0.05)', borderRadius: '99px', padding: '1px 7px' }}>{colLeads.length}</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '7px' }}>
                {colLeads.map(l => (
                  <LeadCard key={l.id} lead={l} drafted={drafted.has(l.id)} onDraft={() => draft(l.id)} onAdvance={() => advance(l.id)}
                    extra={isReal ? extras[l.id] : undefined} broker={isReal ? brokers.find(b => b.id === extras[l.id]?.assigned_broker_id) : undefined}
                    itemTitle={isReal && extras[l.id]?.item_id ? itemTitles[extras[l.id].item_id as string] : null}
                    prompt={prompt} onPrompt={col => setPrompt({ id: l.id, col, nx: null })} onValue={submitValue} onCancel={() => setPrompt(null)} />
                ))}
                {colLeads.length === 0 && (
                  <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.25)', padding: '10px', textAlign: 'center', border: `1px dashed ${BORDER}`, borderRadius: '9px' }}>{t.empty}</div>
                )}
              </div>
            </div>
          )
        })}
      </div>
      </div>
    </DataVeil>
    </div>
  )
}

function Summary({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: '12px', padding: '13px 15px' }}>
      <div style={{ fontSize: '10px', color: MUTED, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' }}>{label}</div>
      <div style={{ fontSize: '19px', fontWeight: 800, color: color ?? 'white' }}>{value}</div>
    </div>
  )
}
