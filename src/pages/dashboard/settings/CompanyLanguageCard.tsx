import { useState } from 'react'
import { supabase } from '../../../lib/supabase'
import { useCompany } from '../../../contexts/CompanyContext'
import { useLang } from '../../../contexts/LanguageContext'

const MUTED = '#BABABA'
const BORDER = 'rgba(255,255,255,0.06)'
const D = "'Bricolage Grotesque', system-ui, sans-serif"

const TX = {
  pt: {
    label: 'Língua da empresa',
    hint: 'Vale para o conteúdo que a IA gera para os seus clientes (legendas, ganchos, chamadas). Não muda o idioma desta tela — esse você escolhe no seletor PT/EN do menu.',
    error: 'Não foi possível salvar agora. Tente de novo.',
  },
  en: {
    label: 'Company language',
    hint: 'Applies to the content the AI generates for your customers (captions, hooks, calls to action). It does not change the language of this screen — you pick that with the PT/EN switch in the menu.',
    error: 'Could not save right now. Please try again.',
  },
} as const

const LANGUAGES: { key: string; label: string }[] = [{ key: 'en', label: '🇺🇸 English' }, { key: 'pt', label: '🇧🇷 Português' }]

// Língua em que a empresa fala com o cliente final — usada por todo conteúdo
// gerado (legenda, hooks, CTA). Grava `companies.language`. Vivia em Estilos e
// Visuais (VisualLibrary); moveu pra Configurações em 2026-10-27.
export default function CompanyLanguageCard() {
  const { company, refreshCompany } = useCompany()
  const tx = TX[useLang().lang]
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(false)
  if (!company) return null
  const current = company.language ?? 'en'

  const setLanguage = async (language: string) => {
    if (language === current || saving) return
    setSaving(true); setError(false)
    const { error: err } = await supabase.from('companies').update({ language }).eq('id', company.id)
    if (err) setError(true)
    else await refreshCompany()
    setSaving(false)
  }

  return (
    <div style={{ marginBottom: '16px' }}>
      <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '7px' }}>{tx.label}</label>
      <div style={{ display: 'inline-flex', gap: '4px', padding: '4px', background: 'rgba(255,255,255,0.03)', border: `1px solid ${BORDER}`, borderRadius: '9px' }}>
        {LANGUAGES.map(l => (
          <button key={l.key} onClick={() => setLanguage(l.key)} disabled={saving}
            style={{ padding: '6px 12px', background: current === l.key ? 'rgba(255,109,41,0.15)' : 'transparent', border: `1px solid ${current === l.key ? 'rgba(255,109,41,0.4)' : 'transparent'}`, borderRadius: '6px', color: current === l.key ? '#FF6D29' : 'white', fontSize: '12px', fontWeight: 700, cursor: saving ? 'default' : 'pointer', fontFamily: D }}>
            {l.label}
          </button>
        ))}
      </div>
      <div style={{ fontSize: '11px', color: MUTED, marginTop: '5px', lineHeight: 1.5 }}>{tx.hint}</div>
      {error && <div style={{ fontSize: '11px', color: '#f87171', marginTop: '5px' }}>{tx.error}</div>}
    </div>
  )
}
