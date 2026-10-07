import { useEffect } from 'react'
import type { CompanyData } from '../../../contexts/CompanyContext'
import { supabase } from '../../../lib/supabase'
import { MUTED, BORDER } from './shared'
import { useLang } from '../../../contexts/LanguageContext'
import { useAgentConfig, AUTONOMY_OPTIONS, type Autonomy } from './agentConfig'

const ORANGE = '#FF6D29'
const CARD = '#150E08'

const TX = {
  pt: {
    banner1: 'Aqui você decide', banner2: 'o quanto os agentes agem sozinhos', banner3: '. Toda ação de agente passa pela', banner4: 'Central de Approvals', banner5: ': em', banner6: '"Executar automaticamente"', banner7: 'ela é auto-aprovada e executada; nos outros níveis, espera seu OK em', banner8: 'Aprovações', banner9: '. Salva automático.',
    title: 'Autonomia da IA', sub: 'O quanto a IA pode fazer sem te perguntar. Você pode mudar isso a qualquer momento.',
    rule: 'Regra que nenhuma configuração desliga: nada é publicado no seu público nem enviado a um cliente sem a sua aprovação — nem no modo "Executar automaticamente". A autonomia acelera o trabalho interno; a decisão do que vai ao ar continua sua.',
    opts: null as Record<string, { label: string; desc: string }> | null,
  },
  en: {
    banner1: 'Here you decide', banner2: 'how much the agents act on their own', banner3: '. Every agent action goes through the', banner4: 'Approvals Center', banner5: ': in', banner6: '"Run automatically"', banner7: 'it is auto-approved and executed; at the other levels, it waits for your OK in', banner8: 'Approvals', banner9: '. Saves automatically.',
    title: 'AI autonomy', sub: 'How much the AI can do without asking you. You can change this at any time.',
    rule: 'A rule no setting turns off: nothing is published to your audience or sent to a customer without your approval — not even in "Run automatically" mode. Autonomy speeds up internal work; the decision about what goes live is still yours.',
    opts: {
      sugerir: { label: 'Suggest only', desc: 'The AI points out what to do but creates nothing on its own. You decide and do everything.' },
      aprovar: { label: 'Ask for approval', desc: 'The AI prepares everything (posts, follow-ups, campaigns) as drafts and waits for your OK before anything goes public.' },
      executar: { label: 'Run automatically', desc: 'The AI handles internal actions on its own (organize funnel, draft, optimize). Actually publishing and sending messages still need your confirmation.' },
    } as Record<string, { label: string; desc: string }> | null,
  },
}

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
  const { lang } = useLang()
  const t = TX[lang]
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
        ⚙️ {t.banner1} <strong>{t.banner2}</strong>{t.banner3} <strong>{t.banner4}</strong>{t.banner5} <strong>{t.banner6}</strong> {t.banner7} <strong>{t.banner8}</strong>{t.banner9}
      </div>

      <section>
        <div style={{ fontSize: '14px', fontWeight: 800, color: 'white', marginBottom: '3px' }}>{t.title}</div>
        <div style={{ fontSize: '11.5px', color: MUTED, marginBottom: '14px' }}>{t.sub}</div>
        <OptionGrid options={AUTONOMY_OPTIONS.map(o => ({ ...o, ...(t.opts?.[o.key] ?? {}) }))} value={config.autonomy} onSelect={setAutonomy} columns={3} />
      </section>

      <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', lineHeight: 1.6, borderTop: `1px solid ${BORDER}`, paddingTop: '16px' }}>
        {t.rule}
      </div>
    </div>
  )
}
