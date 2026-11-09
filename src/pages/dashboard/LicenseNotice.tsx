import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { biText, licenseRule, licenseStatus, type LicenseReason, type LicenseRule } from '../../lib/license'

// Aviso na página Aprovações: a ficha exige registro profissional (CRECI) para publicar e a empresa ainda
// não tem um válido. Mesma regra do servidor (supabase/functions/_shared/compliance.ts → agent-actions).
// Erro de leitura = não mostra nada (o servidor é quem trava; o aviso só ajuda).

const ORANGE = '#FF6D29'
const TX = {
  pt: {
    missing: (n: string) => `Para publicar, informe seu ${n}.`,
    no_type: (n: string) => `Para publicar, diga se o seu ${n} é de pessoa física ou jurídica.`,
    invalid: (n: string) => `O formato do seu ${n} não foi reconhecido — corrija para publicar.`,
    hint: 'As peças continuam sendo criadas; só a publicação espera. Ele também entra sozinho no fim de cada legenda.',
    cta: 'Informar agora →',
  },
  en: {
    missing: (n: string) => `To publish, add your ${n}.`,
    no_type: (n: string) => `To publish, say whether your ${n} is individual or company.`,
    invalid: (n: string) => `Your ${n} format was not recognized — fix it to publish.`,
    hint: 'Pieces are still created; only publishing waits. It is also added automatically at the end of each caption.',
    cta: 'Add it now →',
  },
} as const

export default function LicenseNotice({ companyId, lang }: { companyId: string; lang: 'pt' | 'en' }) {
  const [state, setState] = useState<{ rule: LicenseRule; reason: LicenseReason } | null>(null)
  useEffect(() => {
    let alive = true
    void (async () => {
      const { data: c, error } = await supabase.from('companies').select('vertical_key, playbook_answers').eq('id', companyId).maybeSingle()
      if (error || !c?.vertical_key || c.vertical_key === 'generico') return
      const { data: pb } = await supabase.from('vertical_playbooks').select('config').eq('key', c.vertical_key).eq('enabled', true).maybeSingle()
      const rule = licenseRule(pb?.config)
      if (!rule?.block_publish_without) return
      const st = licenseStatus(c.playbook_answers as Record<string, unknown> | null, rule)
      if (alive && !st.ok) setState({ rule, reason: st.reason })
    })()
    return () => { alive = false }
  }, [companyId])
  if (!state) return null
  const t = TX[lang]
  const name = biText(state.rule.name, lang)
  return (
    <div role="alert" style={{ background: 'rgba(255,109,41,0.08)', border: '1px solid rgba(255,109,41,0.4)', borderRadius: '14px', padding: '14px 18px', marginBottom: '20px' }}>
      <div style={{ fontSize: '14px', fontWeight: 700, color: 'white', marginBottom: '4px' }}>⚠️ {t[state.reason](name)}</div>
      <div style={{ fontSize: '12.5px', color: '#BABABA', lineHeight: 1.5, marginBottom: '8px' }}>{t.hint}</div>
      <Link to={`/dashboard/settings?section=entendimento&q=${encodeURIComponent(state.rule.answer_key)}`} style={{ fontSize: '13px', fontWeight: 700, color: ORANGE }}>{t.cta}</Link>
    </div>
  )
}
