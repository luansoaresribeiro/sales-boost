import { useEffect } from 'react'
import type { CompanyData } from '../../../contexts/CompanyContext'
import { supabase } from '../../../lib/supabase'
import { MUTED, BORDER } from './shared'
import { useAgentConfig, AUTONOMY_OPTIONS, OBJECTIVE_OPTIONS, type Autonomy } from './agentConfig'

const ORANGE = '#FF6D29'
const CARD = '#150E08'

interface OptionCard { key: string; label: string; desc: string; icon: string }

function OptionGrid<T extends string>({ options, value, onSelect, columns }: { options: (OptionCard & { key: T })[]; value: T; onSelect: (k: T) => void; columns: number }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: `repeat(${columns}, 1fr)`, gap: '10px' }}>
      {options.map(o => {
        const active = o.key === value
        return (
          <button key={o.key} onClick={() => onSelect(o.key)}
            style={{ textAlign: 'left', background: active ? 'rgba(255,109,41,0.08)' : CARD, border: `1px solid ${active ? 'rgba(255,109,41,0.45)' : BORDER}`, borderRadius: '13px', padding: '15px 16px', cursor: 'pointer' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '9px', marginBottom: '6px' }}>
              <span style={{ fontSize: '18px' }}>{o.icon}</span>
              <span style={{ fontSize: '13px', fontWeight: 700, color: active ? ORANGE : 'white' }}>{o.label}</span>
              {active && <span style={{ marginLeft: 'auto', fontSize: '11px', color: ORANGE }}>✓</span>}
            </div>
            <div style={{ fontSize: '11px', color: MUTED, lineHeight: 1.5 }}>{o.desc}</div>
          </button>
        )
      })}
    </div>
  )
}

export default function AgentConfigTab({ company }: { company: Pick<CompanyData, 'id'> }) {
  const [config, update] = useAgentConfig(company.id)

  // O nível "Executar automaticamente" agora é o MODO AUTOMÁTICO real da
  // Central de Approvals: escreve companies.agent_automatic_mode, que o motor
  // (edge function agent-actions) lê pra decidir auto-aprovar+executar.
  // O banco é a fonte da verdade; ao montar, reconcilia com a config local.
  useEffect(() => {
    supabase.from('companies').select('agent_automatic_mode').eq('id', company.id).maybeSingle().then(({ data }) => {
      const dbAuto = !!data?.agent_automatic_mode
      if (dbAuto && config.autonomy !== 'executar') update({ autonomy: 'executar' })
      else if (!dbAuto && config.autonomy === 'executar') void supabase.from('companies').update({ agent_automatic_mode: true }).eq('id', company.id)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [company.id])

  const setAutonomy = (k: Autonomy) => {
    update({ autonomy: k })
    void supabase.from('companies').update({ agent_automatic_mode: k === 'executar' }).eq('id', company.id)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '28px', maxWidth: '760px' }}>
      <div style={{ padding: '12px 16px', background: 'rgba(255,109,41,0.06)', border: '1px solid rgba(255,109,41,0.2)', borderRadius: '11px', fontSize: '11.5px', color: 'white', lineHeight: 1.6 }}>
        ⚙️ Aqui você decide <strong>o quanto os agentes agem sozinhos</strong> e <strong>qual objetivo eles perseguem</strong>. Toda ação de agente passa pela <strong>Central de Approvals</strong>: em <strong>"Executar automaticamente"</strong> ela é auto-aprovada e executada; nos outros níveis, espera seu OK em <strong>Aprovações</strong>. Salva automático.
      </div>

      <section>
        <div style={{ fontSize: '14px', fontWeight: 800, color: 'white', marginBottom: '3px' }}>Autonomia da IA</div>
        <div style={{ fontSize: '11.5px', color: MUTED, marginBottom: '14px' }}>O quanto a IA pode fazer sem te perguntar. Você pode mudar isso a qualquer momento.</div>
        <OptionGrid options={AUTONOMY_OPTIONS} value={config.autonomy} onSelect={setAutonomy} columns={3} />
      </section>

      <section>
        <div style={{ fontSize: '14px', fontWeight: 800, color: 'white', marginBottom: '3px' }}>Objetivo do negócio</div>
        <div style={{ fontSize: '11.5px', color: MUTED, marginBottom: '14px' }}>Pra onde os agentes devem puxar. Tudo que eles priorizam sai daqui.</div>
        <OptionGrid options={OBJECTIVE_OPTIONS} value={config.objective} onSelect={k => update({ objective: k })} columns={4} />
      </section>

      <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', lineHeight: 1.6, borderTop: `1px solid ${BORDER}`, paddingTop: '16px' }}>
        Regra que nenhuma configuração desliga: nada é publicado no seu público nem enviado a um cliente sem a sua aprovação — nem no modo "Executar automaticamente". A autonomia acelera o trabalho interno; a decisão do que vai ao ar continua sua.
      </div>
    </div>
  )
}
