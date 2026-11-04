import { useEffect, useState } from 'react'
import type { CompanyData } from '../../../contexts/CompanyContext'
import { supabase } from '../../../lib/supabase'
import { MUTED, BORDER } from './shared'
import { useLang } from '../../../contexts/LanguageContext'
import { useAgentConfig, AUTONOMY_OPTIONS, type Autonomy } from './agentConfig'

const ORANGE = '#FF6D29'
const CARD = '#150E08'

// Configurações → Aprovações (2026-11-04, dono): só 2 opções, padrão "Pedir aprovação".
// A escolha vale para a Central de Aprovações: grava companies.agent_automatic_mode, que a function agent-actions lê
// para auto-aprovar ação interna. Publicar no Instagram continua exigindo o clique do dono (CalendarPostModal approve_now),
// e as respostas automáticas de comentário/DM seguem a regra de cada automação, não esta chave.
// Fonte da verdade = banco. Antes, o navegador podia LIGAR o modo automático sozinho se tivesse "executar" salvo;
// agora o navegador só copia o que o banco diz.
const TX = {
  pt: {
    title: 'Aprovações', sub: 'Como as ações dos agentes chegam até você. Você pode mudar quando quiser; salva na hora.',
    rule: 'Regra que nenhuma opção desliga: nada é publicado no seu público nem enviado a um cliente sem a sua aprovação. O modo automático só acelera o trabalho interno.',
    loading: 'Carregando sua escolha...', loadErr: 'Não foi possível verificar a sua escolha atual. Tente recarregar a página.',
    saveErr: 'Não foi possível salvar. Sua escolha anterior continua valendo.', saved: 'Salvo.',
    opts: null as Record<string, { label: string; desc: string }> | null,
  },
  en: {
    title: 'Approvals', sub: 'How agent actions reach you. You can change this any time; it saves right away.',
    rule: 'A rule no option turns off: nothing is published to your audience or sent to a customer without your approval. Automatic mode only speeds up internal work.',
    loading: 'Loading your choice...', loadErr: "Couldn't check your current choice. Try reloading the page.",
    saveErr: "Couldn't save. Your previous choice is still active.", saved: 'Saved.',
    opts: {
      aprovar: { label: 'Ask for approval', desc: 'Default. The AI prepares everything as drafts and every agent action waits for your OK in Approvals.' },
      executar: { label: 'Run automatically', desc: 'Internal agent actions (organize funnel, draft, optimize) are approved on their own. Actually publishing and sending messages still need your confirmation.' },
    } as Record<string, { label: string; desc: string }> | null,
  },
}

export default function AgentConfigTab({ company }: { company: Pick<CompanyData, 'id'> }) {
  const { lang } = useLang()
  const t = TX[lang]
  const [, update] = useAgentConfig(company.id)
  const [value, setValue] = useState<Autonomy | null>(null)
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading')
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)

  useEffect(() => {
    let alive = true
    setState('loading')
    supabase.from('companies').select('agent_automatic_mode').eq('id', company.id).maybeSingle().then(({ data, error }) => {
      if (!alive) return
      if (error || !data) { setState('error'); return }
      const v: Autonomy = data.agent_automatic_mode ? 'executar' : 'aprovar'
      setValue(v); update({ autonomy: v }); setState('ready')
    })
    return () => { alive = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [company.id])

  const choose = async (k: Autonomy) => {
    if (saving || k === value) return
    setSaving(true); setMsg(null)
    const { error } = await supabase.from('companies').update({ agent_automatic_mode: k === 'executar' }).eq('id', company.id)
    setSaving(false)
    if (error) { setMsg({ ok: false, text: t.saveErr }); return }
    setValue(k); update({ autonomy: k }); setMsg({ ok: true, text: t.saved })
  }

  const options = AUTONOMY_OPTIONS.map(o => ({ ...o, ...(t.opts?.[o.key] ?? {}) }))
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', maxWidth: '760px' }}>
      <section>
        <div style={{ fontSize: '14px', fontWeight: 800, color: 'white', marginBottom: '3px' }}>{t.title}</div>
        <div style={{ fontSize: '11.5px', color: MUTED, marginBottom: '14px' }}>{t.sub}</div>
        {state === 'loading' && <div style={{ fontSize: '12px', color: MUTED }}>{t.loading}</div>}
        {state === 'error' && <div style={{ fontSize: '12px', color: '#f87171' }}>{t.loadErr}</div>}
        {state === 'ready' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: '10px' }}>
            {options.map(o => {
              const active = o.key === value
              return (
                <button key={o.key} onClick={() => void choose(o.key)} disabled={saving} aria-pressed={active}
                  style={{ textAlign: 'left', background: active ? 'rgba(255,109,41,0.08)' : CARD, border: `1px solid ${active ? 'rgba(255,109,41,0.45)' : BORDER}`, borderRadius: '13px', padding: '15px 16px', cursor: saving ? 'wait' : 'pointer' }}>
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
        )}
        {msg && <div style={{ fontSize: '11.5px', marginTop: '10px', color: msg.ok ? '#4ade80' : '#f87171' }}>{msg.text}</div>}
      </section>
      <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', lineHeight: 1.6, borderTop: `1px solid ${BORDER}`, paddingTop: '16px' }}>{t.rule}</div>
    </div>
  )
}
