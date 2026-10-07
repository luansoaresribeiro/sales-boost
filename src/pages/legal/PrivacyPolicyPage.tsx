import LegalPage from './LegalPage'
import { PRIVACY_POLICY } from './legalContent'
import { PRIVACY_POLICY_EN } from './legalContent.en'
import { useLang } from '../../contexts/LanguageContext'

export default function PrivacyPolicyPage() {
  const en = useLang().lang === 'en'
  return <LegalPage doc={en ? PRIVACY_POLICY_EN : PRIVACY_POLICY} other={{ label: en ? 'View the Terms of Use' : 'Ver os Termos de Uso', to: '/termos' }} />
}
