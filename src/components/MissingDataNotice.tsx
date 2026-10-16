import { Link } from 'react-router-dom'
import { useLang } from '../contexts/LanguageContext'
import { bi } from '../lib/verticalPlaybook'
import { isPendingData, settingsLinkFor, visibleQuestions, type AnswerStatus, type OnboardingV2 } from '../lib/onboardingV2'

// Aviso de contexto: quando uma funcionalidade usa um dado que ficou pra depois
// (ficha: `needed_for`), explica por quê e leva direto pro campo. Some quando
// não falta nada — ou quando o dono disse "Não sei"/"Não se aplica" (é uma
// resposta: a funcionalidade segue sem o dado, sem chutar).

const ORANGE = '#FF6D29'
const MUTED = '#BABABA'

const TX = {
  pt: { title: 'Dá pra ficar mais certeiro', lead: 'Esta parte usa informações que ficaram pra depois:', fill: 'Completar agora' },
  en: { title: 'This can be sharper', lead: 'This part uses information you left for later:', fill: 'Complete now' },
} as const

export default function MissingDataNotice({ v2, answers, status, feature }: {
  v2: OnboardingV2 | null; answers: Record<string, unknown>; status: AnswerStatus; feature: string
}) {
  const { lang } = useLang()
  const t = TX[lang]
  if (!v2) return null
  const missing = visibleQuestions(v2, answers).filter(q => q.needed_for?.includes(feature) && isPendingData(q, answers, status))
  if (!missing.length) return null
  return (
    <div role="note" style={{ background: 'rgba(255,109,41,0.06)', border: '1px solid rgba(255,109,41,0.3)', borderRadius: '12px', padding: '12px 14px', marginBottom: '16px' }}>
      <div style={{ fontSize: '13px', fontWeight: 800, color: 'white', marginBottom: '4px' }}>{t.title}</div>
      <div style={{ fontSize: '12.5px', color: MUTED, marginBottom: '8px', lineHeight: 1.5 }}>{t.lead}</div>
      {missing.map(q => (
        <div key={q.key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', flexWrap: 'wrap', padding: '6px 0' }}>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontSize: '13px', color: 'white', fontWeight: 600 }}>{bi(q.label, lang)}</div>
            {q.why && <div style={{ fontSize: '12px', color: MUTED, lineHeight: 1.45 }}>{bi(q.why, lang)}</div>}
          </div>
          <Link to={settingsLinkFor(q.key)} style={{ flexShrink: 0, minHeight: 36, display: 'inline-flex', alignItems: 'center', padding: '6px 12px', border: '1px solid rgba(255,109,41,0.5)', borderRadius: '9px', color: ORANGE, fontSize: '12.5px', fontWeight: 700, textDecoration: 'none' }}>{t.fill}</Link>
        </div>
      ))}
    </div>
  )
}
