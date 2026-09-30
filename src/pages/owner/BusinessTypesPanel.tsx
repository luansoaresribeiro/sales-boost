import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'

const ORANGE = '#FF6D29'
const CARD = '#150E08'
const MUTED = '#BABABA'
const BORDER = 'rgba(255,255,255,0.06)'
const D = "'Bricolage Grotesque', system-ui, sans-serif"

interface BizType { id: string; label: string; sort: number; enabled: boolean }
interface ToolInterest { tool_id: string; tool_name: string; count: number }

export default function BusinessTypesPanel() {
  const [types, setTypes] = useState<BizType[]>([])
  const [loading, setLoading] = useState(true)
  const [newLabel, setNewLabel] = useState('')
  const [adding, setAdding] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [interest, setInterest] = useState<ToolInterest[]>([])

  const load = async () => {
    const { data } = await supabase.from('business_types').select('id, label, sort, enabled').order('sort')
    setTypes((data as BizType[] | null) ?? [])
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  // "Quero quando lançar" — quantas empresas já pediram cada ferramenta
  // ainda planejada (ver marketing_ai_tool_registry.status='planned' de um
  // setor). Ajuda a priorizar o que construir primeiro.
  useEffect(() => {
    supabase.from('marketing_ai_tool_interest').select('tool_id, marketing_ai_tool_registry(name)').then(({ data }) => {
      const counts = new Map<string, { name: string; count: number }>()
      for (const row of (data ?? []) as { tool_id: string; marketing_ai_tool_registry: { name: string }[] | null }[]) {
        const name = row.marketing_ai_tool_registry?.[0]?.name ?? row.tool_id
        const cur = counts.get(row.tool_id) ?? { name, count: 0 }
        cur.count += 1
        counts.set(row.tool_id, cur)
      }
      setInterest(Array.from(counts.entries()).map(([tool_id, v]) => ({ tool_id, tool_name: v.name, count: v.count })).sort((a, b) => b.count - a.count))
    })
  }, [])

  const add = async () => {
    const label = newLabel.trim()
    if (!label || adding) return
    setAdding(true); setErr(null)
    const nextSort = (types.reduce((m, t) => Math.max(m, t.sort), 0)) + 10
    const { error } = await supabase.from('business_types').insert({ label, sort: nextSort })
    if (error) setErr(error.message.includes('duplicate') ? 'Esse tipo já existe.' : error.message)
    else { setNewLabel(''); await load() }
    setAdding(false)
  }

  const rename = async (id: string, label: string) => {
    const clean = label.trim()
    if (!clean) return
    await supabase.from('business_types').update({ label: clean }).eq('id', id)
  }

  const toggle = async (t: BizType) => {
    setTypes(prev => prev.map(x => x.id === t.id ? { ...x, enabled: !x.enabled } : x))
    await supabase.from('business_types').update({ enabled: !t.enabled }).eq('id', t.id)
  }

  const remove = async (t: BizType) => {
    if (!confirm(`Remover "${t.label}"? Negócios que já usam esse tipo mantêm o texto — só some da lista de opções.`)) return
    setTypes(prev => prev.filter(x => x.id !== t.id))
    await supabase.from('business_types').delete().eq('id', t.id)
  }

  return (
    <div>
      <div style={{ padding: '12px 16px', background: 'rgba(255,109,41,0.05)', border: '1px solid rgba(255,109,41,0.18)', borderRadius: '11px', fontSize: '11.5px', color: 'white', lineHeight: 1.6, marginBottom: '18px' }}>
        🏷️ Os tipos de estabelecimento que aparecem no cadastro do cliente e no onboarding. O que você definir aqui vale pra todos. O cliente sempre tem um <strong>"Outro (especifique)"</strong> de escape — então adicione aqui os ramos mais comuns, sem precisar prever todos.
      </div>

      {loading ? (
        <div style={{ color: MUTED, fontSize: '13px' }}>Carregando…</div>
      ) : (
        <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: '14px', overflow: 'hidden' }}>
          {types.map((t, i) => (
            <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '12px 16px', borderBottom: i < types.length - 1 ? `1px solid ${BORDER}` : 'none', opacity: t.enabled ? 1 : 0.5 }}>
              <input
                defaultValue={t.label}
                onBlur={e => { if (e.target.value.trim() && e.target.value.trim() !== t.label) rename(t.id, e.target.value) }}
                style={{ flex: 1, padding: '7px 10px', background: 'rgba(255,255,255,0.03)', border: `1px solid ${BORDER}`, borderRadius: '8px', color: 'white', fontSize: '13px', fontFamily: D, outline: 'none' }}
              />
              <button onClick={() => toggle(t)} title={t.enabled ? 'Desligar' : 'Ligar'}
                style={{ padding: '6px 12px', background: t.enabled ? 'rgba(74,222,128,0.1)' : 'rgba(255,255,255,0.04)', border: `1px solid ${t.enabled ? 'rgba(74,222,128,0.3)' : BORDER}`, borderRadius: '8px', color: t.enabled ? '#4ade80' : MUTED, fontSize: '11px', fontWeight: 700, cursor: 'pointer', fontFamily: D, flexShrink: 0 }}>
                {t.enabled ? '✓ Ativo' : 'Inativo'}
              </button>
              <button onClick={() => remove(t)} title="Remover"
                style={{ padding: '6px 10px', background: 'transparent', border: `1px solid rgba(248,113,113,0.3)`, borderRadius: '8px', color: '#f87171', fontSize: '13px', cursor: 'pointer', flexShrink: 0 }}>
                ✕
              </button>
            </div>
          ))}
          {types.length === 0 && <div style={{ padding: '16px', color: MUTED, fontSize: '13px' }}>Nenhum tipo cadastrado ainda.</div>}
        </div>
      )}

      <div style={{ marginTop: '16px', display: 'flex', gap: '8px' }}>
        <input
          value={newLabel} onChange={e => setNewLabel(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') add() }}
          placeholder="Novo tipo (ex: Academia / Fitness)"
          style={{ flex: 1, padding: '10px 14px', background: 'rgba(255,255,255,0.04)', border: `1px solid ${BORDER}`, borderRadius: '10px', color: 'white', fontSize: '13px', fontFamily: D, outline: 'none' }}
        />
        <button onClick={add} disabled={adding || !newLabel.trim()}
          style={{ padding: '10px 18px', background: ORANGE, color: '#000', border: 'none', borderRadius: '10px', fontSize: '13px', fontWeight: 800, cursor: adding || !newLabel.trim() ? 'default' : 'pointer', fontFamily: D, opacity: adding || !newLabel.trim() ? 0.6 : 1, flexShrink: 0 }}>
          {adding ? 'Adicionando…' : '+ Adicionar'}
        </button>
      </div>
      {err && <div style={{ marginTop: '10px', fontSize: '12px', color: '#f87171' }}>{err}</div>}

      {interest.length > 0 && (
        <div style={{ marginTop: '28px' }}>
          <div style={{ fontSize: '13px', fontWeight: 700, color: 'white', marginBottom: '8px' }}>🙋 Interesse em ferramentas ainda planejadas</div>
          <div style={{ fontSize: '11.5px', color: MUTED, marginBottom: '10px' }}>Quantas empresas já clicaram "Quero quando lançar" — ajuda a priorizar o que construir primeiro.</div>
          <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: '12px', overflow: 'hidden' }}>
            {interest.map((t, i) => (
              <div key={t.tool_id} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 16px', borderBottom: i < interest.length - 1 ? `1px solid ${BORDER}` : 'none' }}>
                <span style={{ fontSize: '13px', color: 'white' }}>{t.tool_name}</span>
                <span style={{ fontSize: '13px', fontWeight: 700, color: ORANGE }}>{t.count}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
