import { useCallback, useEffect, useMemo, useState } from 'react'
import type { CompanyData } from '../../../contexts/CompanyContext'
import { supabase } from '../../../lib/supabase'
import { useRealtime } from '../../../lib/useRealtime'
import { CARD, MUTED, BORDER, D } from './shared'
import { fmtBRL, fmtNum } from './growthDemo'
import { buildFunnelDemo, STAGE_ORDER, TEMP_META, type DemoLead, type LeadStageKey } from './salesDemo'
import { mapLeadRow, STAGE_TO_DB, type LeadRow } from './salesReal'
import ChannelFilter, { ChannelBadge, type ChannelFilterValue } from './ChannelFilter'

const ORANGE = '#FF6D29'
const GREEN = '#4ade80'

function nextStage(key: LeadStageKey): LeadStageKey | null {
  const i = STAGE_ORDER.findIndex(s => s.key === key)
  return i >= 0 && i < STAGE_ORDER.length - 1 ? STAGE_ORDER[i + 1].key : null
}

function LeadCard({ lead, drafted, onDraft, onAdvance }: { lead: DemoLead; drafted: boolean; onDraft: () => void; onAdvance: () => void }) {
  const t = TEMP_META[lead.temperature]
  const canAdvance = !!nextStage(lead.stageKey)
  return (
    <div style={{ background: CARD, border: `1px solid ${lead.noReply ? 'rgba(251,191,36,0.35)' : BORDER}`, borderRadius: '10px', padding: '11px 12px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', marginBottom: '5px' }}>
        <span style={{ fontSize: '12px', fontWeight: 700, color: 'white', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{lead.name}</span>
        <span title={t.label} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
          <span style={{ width: '7px', height: '7px', borderRadius: '99px', background: t.color }} />
        </span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px', flexWrap: 'wrap' }}>
        <ChannelBadge channel={lead.channelKey} />
        <span style={{ fontSize: '11px', fontWeight: 700, color: ORANGE }}>{fmtBRL(lead.value)}</span>
        <span style={{ fontSize: '9.5px', color: 'rgba(255,255,255,0.3)' }}>{lead.lastContact}</span>
      </div>
      <div style={{ fontSize: '10.5px', color: MUTED, lineHeight: 1.45, marginBottom: '8px' }}>{lead.note}</div>
      {lead.noReply && !drafted && (
        <div style={{ fontSize: '9.5px', color: '#FBBF24', marginBottom: '8px' }}>⚠️ Sem resposta — risco de esfriar</div>
      )}
      {drafted ? (
        <div style={{ fontSize: '10.5px', color: GREEN, lineHeight: 1.4, background: 'rgba(74,222,128,0.08)', border: '1px solid rgba(74,222,128,0.2)', borderRadius: '7px', padding: '6px 9px' }}>
          ✓ Follow-up rascunhado, aguardando sua aprovação
        </div>
      ) : (
        <div style={{ display: 'flex', gap: '6px' }}>
          <button onClick={onDraft}
            style={{ flex: 1, padding: '5px 8px', background: 'rgba(255,109,41,0.12)', border: '1px solid rgba(255,109,41,0.35)', color: ORANGE, fontWeight: 700, fontSize: '10px', borderRadius: '7px', cursor: 'pointer', fontFamily: D }}>
            Rascunhar follow-up
          </button>
          {canAdvance && (
            <button onClick={onAdvance} title="Avançar etapa"
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
  const demo = useMemo(() => buildFunnelDemo(company), [company])
  // Dado real da tabela `leads`. null = ainda carregando; [] = carregou e não
  // há lead real (então cai no demo, preservando o design).
  const [realLeads, setRealLeads] = useState<DemoLead[] | null>(null)
  const [demoLeads, setDemoLeads] = useState<DemoLead[]>(demo.leads)
  const [drafted, setDrafted] = useState<Set<string>>(new Set())
  const [channel, setChannel] = useState<ChannelFilterValue>('all')

  const load = useCallback(async () => {
    const { data } = await supabase.from('leads')
      .select('id, name, contact, channel, stage, value_estimate, last_contact_at, notes, created_at')
      .eq('company_id', company.id).order('created_at', { ascending: false })
    setRealLeads(((data ?? []) as LeadRow[]).map(mapLeadRow))
  }, [company.id])
  useEffect(() => { void load() }, [load])
  useRealtime('leads', company.id, load)

  const isReal = !!realLeads && realLeads.length > 0
  const allLeads = isReal ? realLeads! : demoLeads

  const draft = (id: string) => setDrafted(prev => new Set(prev).add(id))
  const advance = async (id: string) => {
    const lead = allLeads.find(l => l.id === id)
    const nx = lead ? nextStage(lead.stageKey) : null
    if (!nx) return
    if (isReal) {
      // Lead real: grava a etapa nova no banco (o realtime recarrega sozinho).
      setRealLeads(prev => prev?.map(l => l.id === id ? { ...l, stageKey: nx, noReply: false } : l) ?? prev)
      await supabase.from('leads').update({ stage: STAGE_TO_DB[nx], last_contact_at: new Date().toISOString() }).eq('id', id).eq('company_id', company.id)
    } else {
      setDemoLeads(prev => prev.map(l => l.id === id ? { ...l, stageKey: nx, noReply: false } : l))
    }
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
      {isReal ? (
        <div style={{ padding: '12px 16px', background: 'rgba(74,222,128,0.06)', border: '1px solid rgba(74,222,128,0.22)', borderRadius: '11px', fontSize: '11.5px', color: 'white', lineHeight: 1.6 }}>
          🟢 <strong>Dados reais.</strong> Estes são os leads capturados de verdade (Instagram, WhatsApp e outros canais). Avançar de etapa salva no CRM na hora. A IA classifica cada lead e rascunha o follow-up — mas <strong>nada é enviado sem sua aprovação</strong>.
        </div>
      ) : (
        <div style={{ padding: '12px 16px', background: 'rgba(251,191,36,0.06)', border: '1px solid rgba(251,191,36,0.22)', borderRadius: '11px', fontSize: '11.5px', color: 'white', lineHeight: 1.6 }}>
          ⏳ <strong>Modo demonstração.</strong> Ainda não há leads reais capturados — assim que chegar o primeiro (Instagram, WhatsApp ou anúncios), este funil passa a mostrar os leads de verdade automaticamente. A IA classifica cada lead, rascunha o follow-up e avisa você — mas <strong>nada é enviado sem sua aprovação</strong>.
        </div>
      )}

      {/* Filtro de canal — um único funil, filtra por origem */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
        <ChannelFilter value={channel} onChange={setChannel} />
        <span style={{ fontSize: '11px', color: MUTED }}>Instagram e WhatsApp no mesmo funil — filtre pela origem.</span>
      </div>

      {/* Resumo */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '10px' }}>
        <Summary label="Leads no funil" value={fmtNum(total)} />
        <Summary label="Conversão" value={`${conversion}%`} />
        <Summary label="Valor no pipeline" value={fmtBRL(pipelineValue, true)} color={ORANGE} />
        <Summary label="Sem resposta" value={fmtNum(noReply)} color={noReply > 0 ? '#FBBF24' : undefined} />
      </div>

      {/* Kanban */}
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${STAGE_ORDER.length}, minmax(180px, 1fr))`, gap: '10px', overflowX: 'auto', paddingBottom: '6px' }}>
        {STAGE_ORDER.map(stage => {
          const colLeads = leads.filter(l => l.stageKey === stage.key)
          return (
            <div key={stage.key} style={{ display: 'flex', flexDirection: 'column', gap: '8px', minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 4px' }}>
                <span style={{ fontSize: '11px', fontWeight: 700, color: 'white' }}>{stage.label}</span>
                <span style={{ fontSize: '10px', fontWeight: 700, color: MUTED, background: 'rgba(255,255,255,0.05)', borderRadius: '99px', padding: '1px 7px' }}>{colLeads.length}</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '7px' }}>
                {colLeads.map(l => (
                  <LeadCard key={l.id} lead={l} drafted={drafted.has(l.id)} onDraft={() => draft(l.id)} onAdvance={() => advance(l.id)} />
                ))}
                {colLeads.length === 0 && (
                  <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.25)', padding: '10px', textAlign: 'center', border: `1px dashed ${BORDER}`, borderRadius: '9px' }}>vazio</div>
                )}
              </div>
            </div>
          )
        })}
      </div>
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
