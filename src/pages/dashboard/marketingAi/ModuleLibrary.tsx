import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../../../lib/supabase'
import { CARD, MUTED, BORDER, D } from './shared'
import { kindLabel } from './ContentLibrary'
import { useLang } from '../../../contexts/LanguageContext'

const TX = {
  pt: { title: 'Biblioteca deste formato — o que a IA usa aqui', count: (n: number) => `${n} recursos especializados + núcleo comum`, core: '+ núcleo comum (princípios, design, cores…). Adicione ou edite recursos na aba 📚 Biblioteca.' },
  en: { title: 'Library for this format — what the AI uses here', count: (n: number) => `${n} specialized resources + common core`, core: '+ common core (principles, design, colors…). Add or edit resources in the 📚 Library tab.' },
} as const

const ORANGE = '#FF6D29'

interface Entry { id: string; module: string; kind: string; title: string; content: string }

// Atalho da Biblioteca dentro de cada módulo (Orgânico/Stories/Campanhas):
// mostra, de forma compacta e recolhível, os recursos especializados que a IA
// usa pra gerar naquele formato. Gerenciar (adicionar/remover) fica na aba
// 📚 Biblioteca — aqui é referência rápida.
export default function ModuleLibrary({ module }: { module: 'organico' | 'stories' | 'campanhas' }) {
  const { lang } = useLang(); const tx = TX[lang]
  const [entries, setEntries] = useState<Entry[]>([])
  const [open, setOpen] = useState(false)

  const load = useCallback(async () => {
    const { data } = await supabase.from('marketing_ai_knowledge').select('id, module, kind, title, content')
      .in('module', ['core', module]).order('kind')
    setEntries((data ?? []) as Entry[])
  }, [module])
  useEffect(() => { load() }, [load])

  const spec = entries.filter(e => e.module === module)
  const kinds = [...new Set(spec.map(e => e.kind))]

  return (
    <section style={{ marginTop: '24px', paddingTop: '20px', borderTop: `1px solid ${BORDER}` }}>
      <button onClick={() => setOpen(o => !o)}
        style={{ display: 'flex', alignItems: 'center', gap: '9px', width: '100%', textAlign: 'left', padding: '11px 13px', background: CARD, border: `1px solid ${BORDER}`, borderRadius: '10px', cursor: 'pointer', fontFamily: D }}>
        <span style={{ fontSize: '15px' }}>📚</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: '12.5px', fontWeight: 700, color: 'white' }}>{tx.title}</div>
          <div style={{ fontSize: '10.5px', color: MUTED }}>{tx.count(spec.length)}</div>
        </div>
        <span style={{ color: ORANGE, fontSize: '12px' }}>{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {kinds.map(k => (
            <div key={k}>
              <div style={{ fontSize: '11px', fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '7px' }}>{kindLabel(k, lang)}</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))', gap: '8px' }}>
                {spec.filter(e => e.kind === k).map(e => (
                  <div key={e.id} style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: '9px', padding: '10px 12px' }}>
                    <div style={{ fontSize: '11.5px', fontWeight: 700, color: 'white', marginBottom: '3px' }}>{e.title}</div>
                    <div style={{ fontSize: '10.5px', color: MUTED, lineHeight: 1.5 }}>{e.content}</div>
                  </div>
                ))}
              </div>
            </div>
          ))}
          <div style={{ fontSize: '10.5px', color: 'rgba(255,255,255,0.35)' }}>
            {tx.core}
          </div>
        </div>
      )}
    </section>
  )
}
