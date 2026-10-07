// Acesso bloqueado manualmente pelo Owner (diferente de trial/assinatura
// vencidos — ver TrialSummaryPage para esse caso). Não oferece checkout: um
// bloqueio administrativo não se resolve pagando, precisa falar com o time.
import { useCompany } from '../../contexts/CompanyContext'
import { useLang } from '../../contexts/LanguageContext'
import { CARD, MUTED, BORDER, ORANGE, D } from './marketingAi/shared'

const TX = {
  pt: {
    tag: 'Acesso inativo',
    title: 'Seu acesso ao Sales Boost está temporariamente suspenso.',
    body: 'Nada foi apagado — seus dados e todo o progresso continuam guardados. O acesso foi pausado pela equipe Sales Boost',
    withReason: ', com o seguinte motivo:',
    noReason: '.',
    help: 'Se você acredita que isso é um engano ou quer entender o motivo, fale com a equipe Sales Boost pelo canal que você já usa pra falar com a gente.',
    cta: 'Falar com a equipe →',
  },
  en: {
    tag: 'Access inactive',
    title: 'Your Sales Boost access is temporarily suspended.',
    body: 'Nothing was deleted — your data and all your progress are safe. Access was paused by the Sales Boost team',
    withReason: ', for the following reason:',
    noReason: '.',
    help: 'If you think this is a mistake or want to understand why, contact the Sales Boost team through the channel you already use to reach us.',
    cta: 'Contact the team →',
  },
} as const

export default function AccessBlockedPage() {
  const { company } = useCompany()
  const tx = TX[useLang().lang]

  return (
    <div style={{ maxWidth: '640px', margin: '0 auto', padding: '48px 24px', fontFamily: D, display: 'flex', flexDirection: 'column', gap: '18px' }}>
      <div>
        <div style={{ fontSize: '11px', fontWeight: 700, color: '#f87171', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '8px' }}>{tx.tag}</div>
        <h1 style={{ fontSize: 'clamp(1.4rem, 3vw, 1.8rem)', fontWeight: 900, color: 'white', letterSpacing: '-0.02em', lineHeight: 1.2 }}>
          {tx.title}
        </h1>
        <p style={{ fontSize: '13.5px', color: MUTED, lineHeight: 1.6, marginTop: '10px' }}>
          {tx.body}{company?.access_blocked_reason ? tx.withReason : tx.noReason}
        </p>
      </div>

      {company?.access_blocked_reason && (
        <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: '12px', padding: '16px 18px', fontSize: '13px', color: 'white', lineHeight: 1.6 }}>
          "{company.access_blocked_reason}"
        </div>
      )}

      <div style={{ background: 'rgba(255,109,41,0.06)', border: '1px solid rgba(255,109,41,0.2)', borderRadius: '12px', padding: '18px 20px', fontSize: '12.5px', color: MUTED, lineHeight: 1.6 }}>
        {tx.help}
      </div>

      <a href="mailto:contato@salesboost.app" style={{ display: 'inline-flex', alignSelf: 'flex-start', padding: '12px 22px', background: ORANGE, color: '#000', fontWeight: 800, fontSize: '13px', borderRadius: '10px', textDecoration: 'none' }}>
        {tx.cta}
      </a>
    </div>
  )
}
