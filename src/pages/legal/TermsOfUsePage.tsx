import LegalPage from './LegalPage'
import { TERMS_OF_USE } from './legalContent'
import { TERMS_OF_USE_EN } from './legalContent.en'
import { useLang } from '../../contexts/LanguageContext'

export default function TermsOfUsePage() {
  const en = useLang().lang === 'en'
  return <LegalPage doc={en ? TERMS_OF_USE_EN : TERMS_OF_USE} other={{ label: en ? 'View the Privacy Policy' : 'Ver a Política de Privacidade', to: '/privacidade' }} />
}
