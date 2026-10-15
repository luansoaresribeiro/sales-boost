// Círculo flutuante do Feedback Loop — substitui o antigo card fixo
// (FeedbackLoopTab.tsx, 100% demo) por um resumo REAL e contextual do que a
// IA está observando no agente que está aberto no momento. Aparece em
// qualquer uma das seções de agente, nunca inventa aprendizado pra preencher
// espaço — sem sinal real, mostra que ainda não há sinal.
import { useEffect, useState } from 'react'
import { useLang } from '../../../contexts/LanguageContext'
import { supabase } from '../../../lib/supabase'
import { CARD, MUTED, BORDER, D, ORANGE, PILLAR_ICON, timeAgo, type Insight } from './shared'
import type { LogRow } from './strategyTypes'

type Section = 'dados' | 'estrategia' | 'content' | 'conversao'

const SECTION_LABEL: Record<'pt' | 'en', Record<Section, string>> = {
  pt: {
    dados: 'no Agente de Dados', estrategia: 'no Agente de Estratégia',
    content: 'no Agente de Conteúdo', conversao: 'no Agente de Conversão',
  },
  en: {
    dados: 'in the Data Agent', estrategia: 'in the Strategy Agent',
    content: 'in the Content Agent', conversao: 'in the Conversion Agent',
  },
}
const TX = {
  pt: { learning: 'O que a IA está aprendendo', noSignal: 'Ainda sem sinal real aqui — assim que houver dado suficiente, a IA começa a aprender com esse agente.', rec: 'RECOMENDAÇÃO',
    memTitle: 'MEMÓRIA — o agente segue isto ao criar', forget: 'Apagar esta lição (o agente não volta a usá-la)',
    memEmpty: 'Ainda sem lições. Quando você excluir uma peça dizendo o porquê, ou editar uma legenda, o agente aprende e passa a seguir aqui.' },
  en: { learning: 'What the AI is learning', noSignal: 'No real signal here yet — as soon as there is enough data, the AI starts learning from this agent.', rec: 'RECOMMENDATION',
    memTitle: 'MEMORY — the agent follows this when creating', forget: 'Delete this lesson (the agent will not use it again)',
    memEmpty: 'No lessons yet. When you delete a piece saying why, or edit a caption, the agent learns and starts following it here.' },
} as const
const SECTION_PILLARS: Record<Section, Insight['pillar'][]> = {
  dados: ['tracking', 'competitor'], estrategia: ['strategy'], content: ['content'], conversao: [],
}

export default function FeedbackWidget({ companyId, section, insights }: { companyId: string; section: Section; insights: Insight[] }) {
  const { lang } = useLang()
  const t = TX[lang]
  const [open, setOpen] = useState(false)
  const [log, setLog] = useState<LogRow[]>([])
  // Memória do Agente de Conteúdo (agent_memory, role conteudo_licoes —
  // ver supabase/functions/_shared/contentLessons.ts).
  const [lessons, setLessons] = useState<{ id: string; value: string }[]>([])
  useEffect(() => {
    if (section !== 'content') return
    let cancelled = false
    supabase.from('agent_memory').select('id, value').eq('company_id', companyId).eq('agent_role', 'conteudo_licoes').eq('type', 'rule').order('key')
      .then(({ data }) => { if (!cancelled) setLessons((data ?? []) as { id: string; value: string }[]) })
    return () => { cancelled = true }
  }, [companyId, section, open])
  const forget = async (l: { id: string; value: string }) => {
    setLessons(prev => prev.filter(x => x.id !== l.id))
    await supabase.from('agent_memory').delete().eq('id', l.id)
    await supabase.from('agent_memory').insert({ company_id: companyId, agent_role: 'conteudo_licoes', key: `apagada:${crypto.randomUUID()}`, type: 'preference', value: l.value })
  }

  useEffect(() => {
    let cancelled = false
    supabase.from('marketing_ai_strategy_log').select('*').eq('company_id', companyId).eq('status', 'proposed')
      .order('created_at', { ascending: false }).limit(3)
      .then(({ data }) => { if (!cancelled) setLog((data ?? []) as LogRow[]) })
    return () => { cancelled = true }
  }, [companyId, section])

  const pillars = SECTION_PILLARS[section]
  const relevantInsights = insights.filter(i => i.status === 'open' && pillars.includes(i.pillar)).slice(0, 3)
  const count = relevantInsights.length + log.length + lessons.length

  return (
    <>
      {open && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 49 }} onClick={() => setOpen(false)} />
      )}
      {open && (
        <div style={{
          position: 'fixed', right: '24px', bottom: '156px', zIndex: 50, width: '340px', maxHeight: '60vh', overflowY: 'auto',
          background: CARD, border: `1px solid ${BORDER}`, borderRadius: '14px', padding: '16px', boxShadow: '0 16px 44px rgba(0,0,0,0.45)',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '10px', marginBottom: '12px' }}>
            <div style={{ fontSize: '12.5px', fontWeight: 800, color: 'white', fontFamily: D, lineHeight: 1.4 }}>
              🔁 {t.learning} {SECTION_LABEL[lang][section]}
            </div>
            <button onClick={() => setOpen(false)} style={{ background: 'transparent', border: 'none', color: MUTED, cursor: 'pointer', fontSize: '14px', flexShrink: 0, padding: 0 }}>✕</button>
          </div>

          {section === 'content' && (
            <div style={{ marginBottom: '12px' }}>
              <div style={{ fontSize: '9px', fontWeight: 800, color: '#A78BFA', letterSpacing: '0.04em', marginBottom: '6px' }}>🧠 {t.memTitle}</div>
              {lessons.length === 0 ? <div style={{ fontSize: '11px', color: MUTED, lineHeight: 1.5 }}>{t.memEmpty}</div> : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {lessons.map(l => (
                    <div key={l.id} style={{ display: 'flex', gap: '8px', alignItems: 'flex-start', padding: '8px 10px', background: 'rgba(167,139,250,0.06)', border: '1px solid rgba(167,139,250,0.2)', borderRadius: '9px' }}>
                      <span style={{ flex: 1, fontSize: '11.5px', color: 'white', lineHeight: 1.45 }}>{l.value}</span>
                      <button onClick={() => forget(l)} title={t.forget} aria-label={t.forget} style={{ background: 'transparent', border: 'none', color: MUTED, cursor: 'pointer', fontSize: '12px', padding: 0, flexShrink: 0 }}>🗑</button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {relevantInsights.length === 0 && log.length === 0 ? (section === 'content' ? null :
            <div style={{ fontSize: '12px', color: MUTED, lineHeight: 1.55 }}>
              {t.noSignal}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {relevantInsights.map(i => (
                <div key={i.id} style={{ padding: '10px 12px', background: 'rgba(255,255,255,0.03)', border: `1px solid ${BORDER}`, borderRadius: '10px' }}>
                  <div style={{ fontSize: '11.5px', fontWeight: 700, color: 'white', marginBottom: '3px' }}>{PILLAR_ICON[i.pillar]} {i.title}</div>
                  <div style={{ fontSize: '11px', color: MUTED, lineHeight: 1.5 }}>{i.description}</div>
                </div>
              ))}
              {log.map(l => (
                <div key={l.id} style={{ padding: '10px 12px', background: 'rgba(255,109,41,0.05)', border: '1px solid rgba(255,109,41,0.15)', borderRadius: '10px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', marginBottom: '3px' }}>
                    <span style={{ fontSize: '9px', fontWeight: 800, color: '#FBBF24' }}>{t.rec}</span>
                    <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.35)' }}>{timeAgo(l.created_at, lang)}</span>
                  </div>
                  <div style={{ fontSize: '11.5px', fontWeight: 700, color: 'white', marginBottom: '3px' }}>{l.recommendation}</div>
                  <div style={{ fontSize: '11px', color: MUTED, lineHeight: 1.5 }}>{l.reasoning}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <button onClick={() => setOpen(v => !v)} title="Feedback Loop"
        style={{
          position: 'fixed', right: '24px', bottom: '92px', zIndex: 50, width: '52px', height: '52px', borderRadius: '50%',
          background: ORANGE, border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '22px', boxShadow: '0 8px 24px rgba(255,109,41,0.4)',
        }}>
        🔁
        {count > 0 && (
          <span style={{
            position: 'absolute', top: '-4px', right: '-4px', minWidth: '18px', height: '18px', padding: '0 4px', borderRadius: '99px',
            background: '#f87171', color: 'white', fontSize: '10px', fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: D,
          }}>{count > 9 ? '9+' : count}</span>
        )}
      </button>
    </>
  )
}
