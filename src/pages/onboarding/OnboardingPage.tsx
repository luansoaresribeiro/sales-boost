import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { fetchBusinessTypes, OTHER_BUSINESS_TYPE } from '../../lib/businessTypes'
import { fetchVerticalKey, fetchOnboardingQuestions, bi, type PlaybookQuestion } from '../../lib/verticalPlaybook'
import { useLang } from '../../contexts/LanguageContext'
import { useAuth } from '../../contexts/AuthContext'
import { DiagnosisLoader } from '../diagnostico/MarketSection'
import { loadDiagnosis, saveDiagnosis } from '../../lib/savedDiagnosis'
import { fetchOnboardingV2, sanitizeV2, PROFILE_KEY, fieldState, type AnswerState, type AnswerStatus, type OnboardingV2 } from '../../lib/onboardingV2'
import QuestionField from '../../components/QuestionField'
import { buildContextV2, diagnosticQuestions, isCompanyProfile, profileQuestion, stepResolved, V2QuestionList } from './DiagnosticV2'

const ORANGE = '#FF6D29'
const BG = '#0E0B0A'
const CARD = '#1A1008'
const MUTED = '#BABABA'
const BORDER = 'rgba(255,255,255,0.07)'
const D = "'Bricolage Grotesque', system-ui, sans-serif"

interface OnboardingData {
  business_name: string
  business_type: string
  city: string
  website_url: string
  instagram_url: string
  facebook_url: string
  tiktok_url: string
  google_maps_url: string
  phone: string
  contact_email: string
  goal: string
  // Entendimento do negócio (conversa estratégica)
  business_description: string
  ideal_customer: string
  business_stage: string
  main_challenges: string
  current_channels: string[]
  playbook_answers: Record<string, unknown>
}

const GOALS = [
  'Atrair mais clientes novos',
  'Aumentar frequência dos clientes atuais',
  'Recuperar clientes inativos',
  'Aumentar ticket médio',
  'Melhorar reputação online',
  'Construir minha marca',
  'Entender melhor meu negócio',
  'Outro',
]
const STAGES = ['Começando agora', 'Crescendo', 'Estabelecido', 'Escalando', 'Preciso dar a volta por cima']
const CHALLENGES = [
  'Poucos clientes novos', 'Vendas baixas', 'Redes sociais fracas', 'Não sei o que postar',
  'Trabalho manual demais', 'Não entendo meus dados', 'Retenção de clientes', 'Concorrência', 'Falta de estratégia', 'Outro',
]
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/
const CHANNELS = ['Instagram', 'Facebook', 'WhatsApp', 'Google', 'Site', 'Indicações', 'Anúncios pagos', 'E-mail', 'Equipe de vendas', 'Ainda não sei']

// Rótulos EN (só exibição) — os valores salvos continuam sendo os em PT acima.
const EN_LABELS: Record<string, string> = {
  'Atrair mais clientes novos': 'Attract more new customers', 'Aumentar frequência dos clientes atuais': 'Increase frequency of current customers',
  'Recuperar clientes inativos': 'Win back inactive customers', 'Aumentar ticket médio': 'Increase average ticket',
  'Melhorar reputação online': 'Improve online reputation', 'Construir minha marca': 'Build my brand',
  'Entender melhor meu negócio': 'Understand my business better', 'Outro': 'Other',
  'Começando agora': 'Just starting', 'Crescendo': 'Growing', 'Estabelecido': 'Established', 'Escalando': 'Scaling', 'Preciso dar a volta por cima': 'Need a turnaround',
  'Poucos clientes novos': 'Few new customers', 'Vendas baixas': 'Low sales', 'Redes sociais fracas': 'Weak social media',
  'Não sei o que postar': 'Do not know what to post', 'Trabalho manual demais': 'Too much manual work', 'Não entendo meus dados': 'Do not understand my data',
  'Retenção de clientes': 'Customer retention', 'Concorrência': 'Competition', 'Falta de estratégia': 'Lack of strategy',
  'Indicações': 'Referrals', 'Anúncios pagos': 'Paid ads', 'E-mail': 'Email', 'Equipe de vendas': 'Sales team', 'Ainda não sei': 'Not sure yet', 'Site': 'Website',
}

const TX = {
  pt: {
    select: 'Selecione...', add: '+ Adicionar', typeEnter: 'Digite e aperte Enter',
    specific: 'Perguntas específicas do seu setor', helps: (f: string) => `Ajuda o Sales Boost a falar a língua de quem trabalha com ${f.toLowerCase()}. Tudo aqui é opcional.`, optional: 'Tudo aqui é opcional.',
    bizType: 'Tipo de negócio', which: 'Qual?', typeBiz: 'Digite o tipo do seu negócio',
    steps: ['Seu negócio', 'Seu cliente', 'Objetivo', 'Canais', 'Finalizar'], stepOf: (a: number, b: number) => `Passo ${a} de ${b}`,
    procErr: 'Erro ao processar diagnóstico',
    s0t: 'Vamos começar pelo seu negócio', s0s: 'Descubra o potencial do seu negócio em 2 minutos. Conte com suas palavras — assim o SalesBoost entende quem você é antes de qualquer coisa.',
    s0l: 'O que seu negócio faz?', s0p: 'Ex: Sou um estúdio de beleza que faz cabelo, unha e maquiagem para eventos...', s0h: 'Pode escrever livre. Quanto mais claro, melhores as recomendações.',
    s1t: 'Quem é seu cliente ideal?', s1s: 'Pra quem você mais quer vender? Não precisa de termos técnicos.', s1l: 'Descreva seu cliente ideal', s1p: 'Ex: Mulheres de 25 a 45 anos, no Rio, que valorizam autocuidado...', s1stage: 'Em que fase está seu negócio hoje?',
    s2t: 'O que você mais quer alcançar agora?', s2s: 'Isso guia tudo que os agentes vão priorizar pra você.', s2goal: 'Maior objetivo agora', s2ch: 'O que mais te trava hoje?',
    s3t: 'Como você traz clientes hoje?', s3s: 'Marque os canais que usa. O Instagram é a base do seu diagnóstico gratuito.', s3chan: 'Canais atuais', s3ig: 'Instagram do negócio', s3igp: '@seuperfil ou instagram.com/seuperfil',
    s3igBad: '⚠️ Não entendi esse Instagram. Digite assim: @seuperfil', s3igHint: 'Olhamos seus posts, engajamento e perfil pra montar sua nota (só dados públicos).',
    s3site: 'Site (opcional)', s3siteBad: '⚠️ Esse endereço parece errado. Use: https://seunegocio.com.br — ou deixe em branco se não tem site.', s3siteHint: 'Se tiver site, analisamos a velocidade dele também. Não tem? Tudo bem, é só deixar em branco.', s3fb: 'Facebook (opcional)',
    s4t: 'É isso que entendemos?', s4s: 'Confira o resumo. Depois é só um último passo pra criar seu painel.', s4name: 'Nome da empresa (opcional)', s4namep: 'Ex: Studio Beleza Carioca', s4nameh: 'Sem empresa? Pode deixar em branco — seu perfil fica como pessoal. Não muda nada no que o Sales Boost faz.', s4city: 'Cidade / UF', s4cityp: 'Ex: Rio de Janeiro, RJ',
    s4mail: 'Seu e-mail', s4mailp: 'voce@seunegocio.com.br', s4mailh: 'Usado pra acessar seu painel e receber alertas.', s4mailBad: '⚠️ Esse e-mail parece incompleto. Confira: voce@exemplo.com', s4phone: 'Telefone / WhatsApp (opcional)', s4phoneH: 'Pra falarmos com você e o Sales Boost te avisar de novos contatos.',
    back: '← Voltar', cont: 'Continuar →', create: 'Criar meu painel →', priv1: 'Ao continuar, você concorda com nossa', priv2: 'política de privacidade', priv3: '. Seus dados são usados só pra entender seu negócio e gerar o diagnóstico.',
    sum: { biz: 'Negócio', type: 'Tipo', ideal: 'Cliente ideal', goal: 'Objetivo principal', ch: 'Maior desafio', chan: 'Canais atuais', stage: 'Estágio', undef: 'ainda não definidos' },
    v2steps: ['Você', 'Sua operação', 'Mercado e prioridade', 'Instagram e contato'],
    pickT: 'Vamos começar: o que descreve você?', pickS: 'Diagnóstico grátis do seu Instagram em uns 2 minutos. Escolha uma opção pra gente fazer as perguntas certas.', pickOther: 'Outro tipo de negócio', loadingFicha: 'Preparando as perguntas certas pra você…',
    savedT: 'Seu diagnóstico está salvo neste aparelho', savedS: (d: string) => `Você fez um diagnóstico aqui em ${d}. Mesmo se fechou a tela no meio, ele terminou de ser feito — é só abrir.`,
    savedSee: 'Ver meu diagnóstico →', savedNew: 'Começar outro diagnóstico',
    v2s0t: 'Vamos começar por você', v2s0s: 'Diagnóstico grátis do seu Instagram em uns 2 minutos — feito pra quem vende e aluga imóvel.',
    v2nameOrg: 'Nome da imobiliária', v2nameOrgP: 'Ex: Imobiliária Silva', v2namePerson: 'Seu nome profissional (opcional)', v2namePersonP: 'Ex: Ana Souza Imóveis',
    v2nameH: 'Aparece no seu painel. Pode mudar depois.',
    v2s1t: 'Sua operação', v2s1s: 'Três respostas rápidas pra o diagnóstico já falar do seu mercado. Não sabe alguma? Marque e siga.',
    v2s2t: 'Seu mercado e sua prioridade', v2s2s: 'Com isso o Sales Boost já monta sua estratégia certa desde o primeiro dia. Não sabe alguma? Marque e siga.',
    v2s3t: 'Seu Instagram', v2s3s: 'É ele que a gente analisa (só dados públicos). O e-mail é pra você acessar o resultado e o painel.',
    v2later: 'O resto (equipe, carteira, canais) você completa depois do cadastro, no seu ritmo.',
  },
  en: {
    select: 'Select...', add: '+ Add', typeEnter: 'Type and press Enter',
    specific: 'Questions specific to your industry', helps: (f: string) => `Helps Sales Boost speak the language of people who work with ${f.toLowerCase()}. Everything here is optional.`, optional: 'Everything here is optional.',
    bizType: 'Business type', which: 'Which one?', typeBiz: 'Type your business type',
    steps: ['Your business', 'Your customer', 'Goal', 'Channels', 'Finish'], stepOf: (a: number, b: number) => `Step ${a} of ${b}`,
    procErr: 'Error processing diagnosis',
    s0t: 'Let us start with your business', s0s: 'Discover your business potential in 2 minutes. Tell us in your own words — so SalesBoost understands who you are before anything else.',
    s0l: 'What does your business do?', s0p: 'E.g.: I run a beauty studio that does hair, nails and makeup for events...', s0h: 'Feel free to write. The clearer, the better the recommendations.',
    s1t: 'Who is your ideal customer?', s1s: 'Who do you most want to sell to? No technical terms needed.', s1l: 'Describe your ideal customer', s1p: 'E.g.: Women aged 25 to 45, in Rio, who value self-care...', s1stage: 'What stage is your business at today?',
    s2t: 'What do you most want to achieve now?', s2s: 'This guides everything the agents will prioritize for you.', s2goal: 'Main goal right now', s2ch: 'What holds you back the most today?',
    s3t: 'How do you bring in customers today?', s3s: 'Select the channels you use. Instagram is the basis of your free diagnosis.', s3chan: 'Current channels', s3ig: 'Business Instagram', s3igp: '@yourprofile or instagram.com/yourprofile',
    s3igBad: '⚠️ I did not understand this Instagram. Type it like this: @yourprofile', s3igHint: 'We look at your posts, engagement and profile to build your score (public data only).',
    s3site: 'Website (optional)', s3siteBad: '⚠️ This address looks wrong. Use: https://yourbusiness.com — or leave it blank if you have no website.', s3siteHint: 'If you have a website, we also analyze its speed. Do not have one? That is fine, just leave it blank.', s3fb: 'Facebook (optional)',
    s4t: 'Is this what we understood?', s4s: 'Check the summary. Then there is just one last step to create your dashboard.', s4name: 'Company name (optional)', s4namep: 'E.g.: Carioca Beauty Studio', s4nameh: 'No company? Leave it blank — your profile is marked as personal. It changes nothing in what Sales Boost does.', s4city: 'City / State', s4cityp: 'E.g.: Rio de Janeiro, RJ',
    s4mail: 'Your email', s4mailp: 'you@yourbusiness.com', s4mailh: 'Used to access your dashboard and receive alerts.', s4mailBad: '⚠️ This email looks incomplete. Check it: you@example.com', s4phone: 'Phone / WhatsApp (optional)', s4phoneH: 'So we can reach you and Sales Boost can alert you about new leads.',
    back: '← Back', cont: 'Continue →', create: 'Create my dashboard →', priv1: 'By continuing, you agree to our', priv2: 'privacy policy', priv3: '. Your data is used only to understand your business and generate the diagnosis.',
    sum: { biz: 'Business', type: 'Type', ideal: 'Ideal customer', goal: 'Main goal', ch: 'Biggest challenge', chan: 'Current channels', stage: 'Stage', undef: 'not defined yet' },
    v2steps: ['You', 'Your operation', 'Market and priority', 'Instagram and contact'],
    pickT: "Let's start: what describes you?", pickS: 'Free diagnosis of your Instagram in about 2 minutes. Pick one so we ask the right questions.', pickOther: 'Another type of business', loadingFicha: 'Getting the right questions ready for you…',
    savedT: 'Your diagnosis is saved on this device', savedS: (d: string) => `You ran a diagnosis here on ${d}. Even if you closed the screen halfway, it finished — just open it.`,
    savedSee: 'See my diagnosis →', savedNew: 'Start another diagnosis',
    v2s0t: "Let's start with you", v2s0s: 'Free diagnosis of your Instagram in about 2 minutes — built for people who sell and rent property.',
    v2nameOrg: 'Agency name', v2nameOrgP: 'E.g.: Silva Realty', v2namePerson: 'Your professional name (optional)', v2namePersonP: 'E.g.: Ana Souza Realty',
    v2nameH: 'Shown in your dashboard. You can change it later.',
    v2s1t: 'Your operation', v2s1s: 'Three quick answers so the diagnosis speaks about your market. Not sure about one? Mark it and move on.',
    v2s2t: 'Your market and your priority', v2s2s: 'With this, Sales Boost builds the right strategy from day one. Not sure about one? Mark it and move on.',
    v2s3t: 'Your Instagram', v2s3s: 'This is what we analyze (public data only). The email lets you access the result and the dashboard.',
    v2later: 'The rest (team, listings, channels) you complete after signing up, at your own pace.',
  },
}

function Field({ label, value, onChange, placeholder, type = 'text', required = false, hint }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string; required?: boolean; hint?: string
}) {
  const [focused, setFocused] = useState(false)
  return (
    <div style={{ marginBottom: '16px' }}>
      <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '7px' }}>
        {label}{required && <span style={{ color: ORANGE }}>*</span>}
      </label>
      <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
        onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
        style={{ width: '100%', padding: '12px 16px', boxSizing: 'border-box', background: 'rgba(255,255,255,0.04)', border: `1px solid ${focused ? 'rgba(255,109,41,0.55)' : BORDER}`, borderRadius: '12px', color: 'white', fontSize: '15px', outline: 'none', transition: 'border-color 0.2s', fontFamily: 'inherit' }} />
      {hint && <div style={{ fontSize: '11px', color: MUTED, marginTop: '5px', lineHeight: 1.5 }}>{hint}</div>}
    </div>
  )
}

function TextArea({ label, value, onChange, placeholder, hint }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; hint?: string
}) {
  const [focused, setFocused] = useState(false)
  return (
    <div style={{ marginBottom: '16px' }}>
      <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '7px' }}>{label}</label>
      <textarea value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} rows={3}
        onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
        style={{ width: '100%', padding: '12px 16px', boxSizing: 'border-box', background: 'rgba(255,255,255,0.04)', border: `1px solid ${focused ? 'rgba(255,109,41,0.55)' : BORDER}`, borderRadius: '12px', color: 'white', fontSize: '15px', outline: 'none', transition: 'border-color 0.2s', fontFamily: 'inherit', resize: 'vertical', lineHeight: 1.5 }} />
      {hint && <div style={{ fontSize: '11px', color: MUTED, marginTop: '5px', lineHeight: 1.5 }}>{hint}</div>}
    </div>
  )
}

function SelectField({ label, value, onChange, options, required = false, optLabel }: {
  label: string; value: string; onChange: (v: string) => void; options: string[]; required?: boolean; optLabel?: (o: string) => string
}) {
  const { lang } = useLang()
  const [focused, setFocused] = useState(false)
  return (
    <div style={{ marginBottom: '16px' }}>
      <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '7px' }}>
        {label}{required && <span style={{ color: ORANGE }}>*</span>}
      </label>
      <select value={value} onChange={e => onChange(e.target.value)} onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
        style={{ width: '100%', padding: '12px 16px', boxSizing: 'border-box', background: '#1a1008', border: `1px solid ${focused ? 'rgba(255,109,41,0.55)' : BORDER}`, borderRadius: '12px', color: value ? 'white' : MUTED, fontSize: '15px', outline: 'none', transition: 'border-color 0.2s', fontFamily: 'inherit', cursor: 'pointer', appearance: 'none', backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23BABABA' stroke-width='2'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 16px center' }}>
        <option value="" disabled style={{ color: MUTED }}>{TX[lang].select}</option>
        {options.map(o => <option key={o} value={o} style={{ background: '#1a1008', color: 'white' }}>{optLabel ? optLabel(o) : o}</option>)}
      </select>
    </div>
  )
}

function MultiSelect({ label, values, options, onToggle, hint, optLabel }: {
  label: string; values: string[]; options: string[]; onToggle: (v: string) => void; hint?: string; optLabel?: (o: string) => string
}) {
  return (
    <div style={{ marginBottom: '16px' }}>
      <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '9px' }}>{label}</label>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
        {options.map(o => {
          const on = values.includes(o)
          return (
            <button key={o} type="button" onClick={() => onToggle(o)}
              style={{ padding: '8px 13px', borderRadius: '99px', fontSize: '13px', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', background: on ? 'rgba(255,109,41,0.14)' : 'rgba(255,255,255,0.04)', border: `1px solid ${on ? 'rgba(255,109,41,0.5)' : BORDER}`, color: on ? ORANGE : 'white' }}>
              {on ? '✓ ' : ''}{optLabel ? optLabel(o) : o}
            </button>
          )
        })}
      </div>
      {hint && <div style={{ fontSize: '11px', color: MUTED, marginTop: '7px', lineHeight: 1.5 }}>{hint}</div>}
    </div>
  )
}

// Campo "digite e vira pílula" — usado pelas perguntas tipo 'multi_text' da
// ficha de setor (ex: bairros que o corretor atende). Sem opções fixas,
// limitado a `max` itens.
function TagInput({ label, values, onChange, max, placeholder, hint }: {
  label: string; values: string[]; onChange: (v: string[]) => void; max: number; placeholder?: string; hint?: string
}) {
  const { lang } = useLang()
  const [draft, setDraft] = useState('')
  const add = () => {
    const v = draft.trim()
    if (!v || values.includes(v) || values.length >= max) return
    onChange([...values, v]); setDraft('')
  }
  return (
    <div style={{ marginBottom: '16px' }}>
      <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '7px' }}>{label}</label>
      {values.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '7px', marginBottom: '9px' }}>
          {values.map(v => (
            <span key={v} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 10px', borderRadius: '99px', fontSize: '12.5px', fontWeight: 600, background: 'rgba(255,109,41,0.14)', border: '1px solid rgba(255,109,41,0.5)', color: ORANGE }}>
              {v}
              <button type="button" onClick={() => onChange(values.filter(x => x !== v))} style={{ background: 'none', border: 'none', color: ORANGE, cursor: 'pointer', padding: 0, fontSize: '13px', lineHeight: 1 }}>×</button>
            </span>
          ))}
        </div>
      )}
      {values.length < max && (
        <div style={{ display: 'flex', gap: '8px' }}>
          <input value={draft} onChange={e => setDraft(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); add() } }}
            placeholder={placeholder} style={{ flex: 1, padding: '12px 16px', boxSizing: 'border-box', background: 'rgba(255,255,255,0.04)', border: `1px solid ${BORDER}`, borderRadius: '12px', color: 'white', fontSize: '15px', outline: 'none', fontFamily: 'inherit' }} />
          <button type="button" onClick={add} style={{ padding: '0 18px', background: 'rgba(255,109,41,0.14)', border: '1px solid rgba(255,109,41,0.5)', borderRadius: '12px', color: ORANGE, fontWeight: 700, fontSize: '13px', cursor: 'pointer', fontFamily: 'inherit' }}>{TX[lang].add}</button>
        </div>
      )}
      {hint && <div style={{ fontSize: '11px', color: MUTED, marginTop: '7px', lineHeight: 1.5 }}>{hint}</div>}
    </div>
  )
}

// Perguntas extras da ficha de setor (config.onboarding_questions) — só
// aparece quando o tipo de negócio escolhido tem uma ficha de verdade
// (vertical_key ≠ 'generico'). Todas opcionais, sem afetar o "próximo"
// deste passo. Renderiza pelo tipo de cada pergunta, nunca hardcoded pra
// um setor específico.
function PlaybookQuestionsSection({ fichaName, questions, answers, onChange }: {
  fichaName: string; questions: PlaybookQuestion[]; answers: Record<string, unknown>; onChange: (k: string, v: unknown) => void
}) {
  const { lang } = useLang()
  const t = TX[lang]
  if (!questions.length) return null
  return (
    <div style={{ marginTop: '22px', paddingTop: '20px', borderTop: `1px solid ${BORDER}` }}>
      <div style={{ fontSize: '11px', fontWeight: 700, color: ORANGE, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '4px' }}>{t.specific}</div>
      <p style={{ fontSize: '12px', color: MUTED, marginBottom: '16px', lineHeight: 1.5 }}>{fichaName ? t.helps(fichaName) : t.optional}</p>
      {questions.map(q => {
        const label = bi(q.label)
        if (q.type === 'select') {
          return <SelectField key={q.key} label={label} value={String(answers[q.key] ?? '')} onChange={v => onChange(q.key, v)} options={(q.options ?? []).map(o => bi(o))} />
        }
        if (q.type === 'multi_text') {
          return <TagInput key={q.key} label={label} values={(answers[q.key] as string[] | undefined) ?? []} onChange={v => onChange(q.key, v)} max={q.max ?? 5} placeholder={t.typeEnter} />
        }
        return <Field key={q.key} label={label} value={String(answers[q.key] ?? '')} onChange={v => onChange(q.key, v)} />
      })}
    </div>
  )
}

function BusinessTypeSelect({ value, onChange, options, startOther = false }: { value: string; onChange: (v: string) => void; options: string[]; startOther?: boolean }) {
  const { lang } = useLang()
  const t = TX[lang]
  const [otherMode, setOtherMode] = useState(startOther)
  const known = options.includes(value)
  const showOther = otherMode || (value !== '' && !known && options.length > 0)
  return (
    <>
      <SelectField label={t.bizType} required
        value={showOther ? OTHER_BUSINESS_TYPE : (known ? value : '')}
        onChange={v => { if (v === OTHER_BUSINESS_TYPE) { setOtherMode(true); onChange('') } else { setOtherMode(false); onChange(v) } }}
        options={[...options, OTHER_BUSINESS_TYPE]} />
      {showOther && <div style={{ marginTop: '-8px' }}><Field label={t.which} value={value} onChange={onChange} placeholder={t.typeBiz} required /></div>}
    </>
  )
}

// Resumo estruturado + interpretação (composto localmente — sempre funciona,
// sem depender de API). Vira o Business Context que os agentes leem.
function buildContext(d: OnboardingData) {
  const chan = d.current_channels.join(', ') || 'ainda não definidos'
  const summary = [
    `Negócio: ${d.business_description || d.business_type || '—'}`,
    `Tipo: ${d.business_type || '—'}${d.city ? ` · ${d.city}` : ''}`,
    `Cliente ideal: ${d.ideal_customer || '—'}`,
    `Objetivo principal: ${d.goal || '—'}`,
    `Maior desafio: ${d.main_challenges || '—'}`,
    `Canais atuais: ${chan}`,
    `Estágio: ${d.business_stage || '—'}`,
  ].join('\n')
  const interpretation = `Este é um negócio do tipo "${d.business_type || 'não especificado'}"${d.city ? ` em ${d.city}` : ''}. ${d.business_description ? d.business_description.trim() + '. ' : ''}O cliente ideal é ${d.ideal_customer || 'não especificado'}. O objetivo principal agora é ${(d.goal || 'não especificado').toLowerCase()}, e o maior desafio é ${(d.main_challenges || 'não especificado').toLowerCase()}. Hoje traz clientes por ${chan.toLowerCase()}. Está na fase "${d.business_stage || 'não especificada'}".`
  return {
    business_description: d.business_description,
    ideal_customer: d.ideal_customer,
    business_stage: d.business_stage,
    primary_goals: d.goal,
    main_challenges: d.main_challenges,
    current_channels: chan,
    onboarding_summary: summary,
    agent_business_interpretation: interpretation,
    playbook_answers: d.playbook_answers,
    // Sem nome de empresa = perfil pessoal (só um rótulo pra organizar,
    // decisão do dono 2026-10-09 — não muda nada no que o produto faz).
    profile_type: d.business_name.trim() ? 'profissional' : 'pessoal',
  }
}

// Versão só de EXIBIÇÃO do resumo (o que é salvo continua em PT em buildContext).
function displaySummary(d: OnboardingData, lang: 'pt' | 'en'): string {
  if (lang !== 'en') return buildContext(d).onboarding_summary
  const t = TX.en.sum
  const tr = (v: string) => EN_LABELS[v] ?? v
  const chan = d.current_channels.map(tr).join(', ') || t.undef
  return [
    `${t.biz}: ${d.business_description || d.business_type || '—'}`,
    `${t.type}: ${d.business_type || '—'}${d.city ? ` · ${d.city}` : ''}`,
    `${t.ideal}: ${d.ideal_customer || '—'}`,
    `${t.goal}: ${d.goal ? tr(d.goal) : '—'}`,
    `${t.ch}: ${d.main_challenges ? tr(d.main_challenges) : '—'}`,
    `${t.chan}: ${chan}`,
    `${t.stage}: ${d.business_stage ? tr(d.business_stage) : '—'}`,
  ].join('\n')
}

// "@usuario", "usuario" ou link -> https://instagram.com/usuario (null se inválido)
function normalizeInstagram(raw: string): string | null {
  let v = raw.trim()
  if (!v) return null
  const m = v.match(/instagram\.com\/([^/?#\s]+)/i)
  v = (m ? m[1] : v).replace(/^@/, '').replace(/\/$/, '')
  if (!/^[A-Za-z0-9._]{1,30}$/.test(v) || ['p', 'reel', 'reels', 'explore', 'accounts', 'stories'].includes(v.toLowerCase())) return null
  return `https://instagram.com/${v.toLowerCase()}`
}

// Miolo do diagnóstico (perguntas + envio ao run-diagnosis). Usado em dois
// lugares: na rota /onboarding (página inteira) e INLINE na landing
// (embedded: sem cabeçalho nem fundo de página inteira; ao terminar chama
// onDone(id) e quem hospeda mostra o resultado ali mesmo).
export function DiagnosticFlow({ embedded = false, onDone }: { embedded?: boolean; onDone?: (diagnosticId: string) => void }) {
  const navigate = useNavigate()
  const { lang } = useLang()
  const t = TX[lang]
  const optLabel = (o: string) => (lang === 'en' ? (EN_LABELS[o] ?? o) : o)
  const [step, setStep] = useState(0)
  const [data, setData] = useState<OnboardingData>({
    business_name: '', business_type: '', city: '', website_url: '', instagram_url: '', facebook_url: '',
    tiktok_url: '', google_maps_url: '', phone: '', contact_email: '', goal: '',
    business_description: '', ideal_customer: '', business_stage: '', main_challenges: '', current_channels: [],
    playbook_answers: {},
  })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  // Diagnóstico já feito neste aparelho: primeiro oferece abrir ele (o novo só
  // começa se a pessoa pedir — o anterior continua salvo).
  const [saved, setSaved] = useState(() => (embedded ? null : loadDiagnosis()))
  const [businessTypes, setBusinessTypes] = useState<string[]>([])
  const [fichaName, setFichaName] = useState('')
  const [fichaQuestions, setFichaQuestions] = useState<PlaybookQuestion[]>([])
  // Onboarding v2 (ficha com config.onboarding_v2): diagnóstico curto com perfil e estados de resposta.
  const [v2, setV2] = useState<OnboardingV2 | null>(null)
  // Primeira tela: escolher o tipo em botões grandes (sem a barra de passos).
  // Só depois de escolher — e de a ficha carregar — aparece o formulário certo
  // (o novo de imobiliária/corretor, ou o antigo pros outros tipos).
  const [typePicked, setTypePicked] = useState<'' | 'known' | 'other'>('')
  const [fichaLoading, setFichaLoading] = useState(false)
  const [v2Answers, setV2Answers] = useState<Record<string, unknown>>({})
  const [v2Status, setV2Status] = useState<AnswerStatus>({})
  const setV2Answer = (k: string, v: unknown) => setV2Answers(a => {
    const next = { ...a, [k]: v }
    // Trocou o perfil: respostas que só valiam pro perfil antigo saem.
    if (k === PROFILE_KEY && v2) for (const q of v2.questions) if (q.profiles?.length && q.key in next) delete next[q.key]
    return next
  })
  const setV2State = (k: string, st: AnswerState | null) => setV2Status(m => { const n = { ...m }; if (st) n[k] = st; else delete n[k]; return n })
  const STEPS = v2 ? t.v2steps : t.steps

  useEffect(() => { fetchBusinessTypes().then(setBusinessTypes) }, [])

  // Quando o tipo de negócio muda, busca a ficha do setor (se tiver) e
  // limpa as respostas anteriores — elas eram de outro setor, não fazem
  // mais sentido (ex: "bairros que atende" some se trocar de corretor pra
  // loja de roupas).
  useEffect(() => {
    let alive = true
    setData(d => ({ ...d, playbook_answers: {} }))
    setV2Answers({}); setV2Status({})
    if (!data.business_type.trim()) { setFichaName(''); setFichaQuestions([]); setV2(null); setFichaLoading(false); return }
    fetchVerticalKey(data.business_type).then(async vk => {
      // Sem kit grátis no diagnóstico (decisão do dono 2026-10-17).
      const [{ name, questions }, v2cfg] = await Promise.all([fetchOnboardingQuestions(vk), fetchOnboardingV2(vk)])
      if (alive) { setV2(v2cfg); setFichaLoading(false); setFichaName(name); setFichaQuestions(questions) }
    })
    return () => { alive = false }
  }, [data.business_type])

  const setPlaybookAnswer = (k: string, v: unknown) => setData(d => ({ ...d, playbook_answers: { ...d.playbook_answers, [k]: v } }))

  const set = (k: keyof OnboardingData) => (v: string) => setData(d => ({ ...d, [k]: v }))
  const toggleChannel = (v: string) => setData(d => ({ ...d, current_channels: d.current_channels.includes(v) ? d.current_channels.filter(x => x !== v) : [...d.current_channels, v] }))

  const isValidUrl = (url: string) => {
    const s = url.trim()
    if (!s) return false
    try { return new URL(s.startsWith('http') ? s : `https://${s}`).hostname.includes('.') } catch { return false }
  }

  const igInvalid = !!data.instagram_url.trim() && !normalizeInstagram(data.instagram_url)
  const siteInvalid = !!data.website_url.trim() && !isValidUrl(data.website_url)
  const emailInvalid = !!data.contact_email.trim() && !EMAIL_RE.test(data.contact_email.trim())

  const canNext = () => {
    if (v2) {
      if (step === 0) return !!(data.business_type && v2Answers[PROFILE_KEY] && data.city.trim() && (!isCompanyProfile(v2, v2Answers) || data.business_name.trim().length >= 2))
      if (step === 1 || step === 2) return stepResolved(v2, v2Answers, v2Status, step)
      if (step === 3) return !!normalizeInstagram(data.instagram_url) && !siteInvalid && EMAIL_RE.test(data.contact_email.trim())
      return false
    }
    if (step === 0) return !!(data.business_description.trim() && data.business_type)
    if (step === 1) return !!(data.ideal_customer.trim() && data.business_stage)
    if (step === 2) return !!data.goal
    if (step === 3) return !!normalizeInstagram(data.instagram_url) && !siteInvalid
    if (step === 4) return !!(data.city.trim() && EMAIL_RE.test(data.contact_email.trim()))
    return false
  }

  const handleSubmit = async () => {
    setSubmitting(true); setError('')
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
      const clean = v2 ? sanitizeV2(v2, v2Answers, v2Status) : null
      const onboarding_context = v2 && clean
        ? { ...buildContextV2(v2, clean.answers, clean.status, data.business_type, data.city.trim()), profile_type: data.business_name.trim() ? 'profissional' : 'pessoal' }
        : buildContext(data)
      const goal = v2 && clean ? String(clean.answers.prioridade_principal ?? '') : data.goal
      const payload = {
        business_name: data.business_name, business_type: data.business_type, city: data.city,
        website_url: data.website_url.trim(), instagram_url: normalizeInstagram(data.instagram_url) ?? '', facebook_url: data.facebook_url,
        tiktok_url: data.tiktok_url, google_maps_url: data.google_maps_url, phone: data.phone,
        contact_email: data.contact_email.trim(), goal, onboarding_context,
      }
      const res = await fetch(`${supabaseUrl}/functions/v1/run-diagnosis`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(session ? { Authorization: `Bearer ${session.access_token}` } : {}) },
        body: JSON.stringify(payload),
      })
      const result = await res.json()
      if (!res.ok) throw new Error(result.error ?? t.procErr)
      saveDiagnosis(result.id)
      // Quem já está logado (conta criada antes de ter empresa) não passa pelo
      // cadastro com ?claim= — liga o diagnóstico à conta aqui mesmo, senão o
      // botão final mandava criar uma conta nova e a pessoa ficava travada.
      if (session && !embedded) {
        await fetch(`${supabaseUrl}/functions/v1/claim-diagnostic`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
          body: JSON.stringify({ diagnostic_id: result.id }),
        })
      }
      setSubmitting(false)
      if (embedded && onDone) onDone(result.id)
      // Direto pro diagnóstico (a tela intermediária "Seu negócio foi entendido"
      // saiu — decisão do dono 2026-10-10: menos cliques até o vídeo grátis).
      else navigate(`/diagnostico/${result.id}`)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
      setSubmitting(false)
    }
  }

  const shell: React.CSSProperties = embedded
    ? { background: 'transparent' }
    : { minHeight: '100vh', background: BG }

  // Desde o clique: a mesma tela do resultado (S enchendo + barra), na etapa
  // "lendo o seu Instagram" — é a parte mais demorada (até ~1 min).
  if (submitting) return <DiagnosisLoader stage="instagram" lang={lang} embedded={embedded} />


  const errorBlock = error && <div style={{ padding: '12px 16px', background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.2)', borderRadius: '10px', fontSize: '13px', color: '#f87171', marginBottom: '16px', lineHeight: 1.5 }}>{error}</div>

  const choosing = step === 0 && !typePicked
  const preparing = step === 0 && !!typePicked && fichaLoading
  const hideSteps = choosing || preparing

  return (
    <div style={{ ...shell, display: 'flex', flexDirection: 'column', ...(embedded ? { overflowX: 'hidden' } : {}) }}>
      {!embedded && (
        <div style={{ padding: '20px 32px', borderBottom: `1px solid ${BORDER}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <a href="/" style={{ fontFamily: D, fontSize: '1.3rem', fontWeight: 900, color: 'white', textDecoration: 'none', letterSpacing: '-0.02em' }}>
            <span style={{ color: ORANGE }}>Sales</span>Boost
          </a>
          {!hideSteps && <div style={{ fontSize: '13px', color: MUTED }}>{t.stepOf(step + 1, STEPS.length)}</div>}
        </div>
      )}

      {!hideSteps && (
        <div style={{ height: '3px', background: 'rgba(255,255,255,0.06)', borderRadius: embedded ? 2 : 0 }}>
          <div style={{ height: '100%', background: ORANGE, width: `${((step + 1) / STEPS.length) * 100}%`, transition: 'width 0.4s ease', borderRadius: '0 2px 2px 0' }} />
        </div>
      )}

      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: embedded ? '24px 0 0' : '48px 24px' }}>
        <div style={{ width: '100%', maxWidth: '540px' }}>
          {!hideSteps && <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '24px' }}>
            {STEPS.map((s, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                <div style={{ width: '22px', height: '22px', borderRadius: '50%', background: i < step ? ORANGE : i === step ? 'rgba(255,109,41,0.15)' : 'rgba(255,255,255,0.05)', border: i === step ? `1px solid ${ORANGE}` : i < step ? 'none' : `1px solid ${BORDER}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '9.5px', fontWeight: 900, color: i < step ? '#000' : i === step ? ORANGE : MUTED, flexShrink: 0 }}>
                  {i < step ? '✓' : i + 1}
                </div>
                <span style={{ fontSize: '11.5px', color: i === step ? 'white' : MUTED, fontWeight: i === step ? 600 : 400, whiteSpace: 'nowrap' }}>{s}</span>
              </div>
            ))}
          </div>}

          <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: '20px', padding: embedded ? '20px' : '32px' }}>
            {choosing && saved && (
              <>
                <H t={t.savedT} s={t.savedS(new Date(saved.at).toLocaleDateString(lang === 'en' ? 'en-US' : 'pt-BR'))} />
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <button type="button" onClick={() => navigate(`/diagnostico/${saved.id}`)}
                    style={{ minHeight: 56, width: '100%', padding: '14px 18px', borderRadius: '14px', background: ORANGE, border: 'none', color: '#000', fontSize: '16px', fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit' }}>
                    {t.savedSee}
                  </button>
                  <button type="button" onClick={() => setSaved(null)}
                    style={{ minHeight: 52, width: '100%', padding: '12px 18px', borderRadius: '14px', background: 'transparent', border: `1px solid ${BORDER}`, color: 'white', fontSize: '14.5px', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                    {t.savedNew}
                  </button>
                </div>
              </>
            )}
            {choosing && !saved && (
              <>
                <H t={t.pickT} s={t.pickS} />
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {[...businessTypes.map(b => ({ label: b, other: false })), { label: t.pickOther, other: true }].map(o => (
                    <button key={o.label} type="button"
                      onClick={() => { if (o.other) { setTypePicked('other'); set('business_type')('') } else { setTypePicked('known'); setFichaLoading(true); set('business_type')(o.label) } }}
                      style={{ minHeight: 56, width: '100%', textAlign: 'left', padding: '14px 18px', borderRadius: '14px', background: o.other ? 'transparent' : 'rgba(255,109,41,0.07)', border: `1px solid ${o.other ? BORDER : 'rgba(255,109,41,0.3)'}`, color: o.other ? MUTED : 'white', fontSize: o.other ? '14px' : '16px', fontWeight: o.other ? 500 : 700, cursor: 'pointer', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
                      <span>{o.label}</span><span aria-hidden style={{ color: ORANGE }}>→</span>
                    </button>
                  ))}
                </div>
              </>
            )}
            {preparing && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '24px 4px', color: MUTED, fontSize: '14px' }}>
                <div style={{ width: '20px', height: '20px', borderRadius: '50%', border: '2px solid rgba(255,109,41,0.2)', borderTopColor: ORANGE, animation: 'spin 1s linear infinite', flexShrink: 0 }} />
                <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
                {t.loadingFicha}
              </div>
            )}
            {step === 0 && !choosing && !preparing && (
              <>
                <H t={v2 ? t.v2s0t : t.s0t} s={v2 ? t.v2s0s : t.s0s} />
                <BusinessTypeSelect value={data.business_type} onChange={set('business_type')} options={businessTypes} startOther={typePicked === 'other'} />
                {v2 ? (
                  <>
                    {(() => { const pq = profileQuestion(v2); return pq ? <QuestionField q={pq} value={v2Answers[pq.key]} state={fieldState(pq, v2Answers, v2Status)} onChange={v => setV2Answer(pq.key, v)} onState={st => setV2State(pq.key, st)} lang={lang} businessType={data.business_type} /> : null })()}
                    {isCompanyProfile(v2, v2Answers)
                      ? <Field label={t.v2nameOrg} value={data.business_name} onChange={set('business_name')} placeholder={t.v2nameOrgP} hint={t.v2nameH} required />
                      : <Field label={t.v2namePerson} value={data.business_name} onChange={set('business_name')} placeholder={t.v2namePersonP} hint={t.v2nameH} />}
                    <Field label={t.s4city} value={data.city} onChange={set('city')} placeholder={t.s4cityp} required />
                  </>
                ) : (
                  <>
                    <TextArea label={t.s0l} value={data.business_description} onChange={set('business_description')} placeholder={t.s0p} hint={t.s0h} />
                    <PlaybookQuestionsSection fichaName={fichaName} questions={fichaQuestions} answers={data.playbook_answers} onChange={setPlaybookAnswer} />
                  </>
                )}
              </>
            )}
            {v2 && (step === 1 || step === 2) && (
              <>
                <H t={step === 1 ? t.v2s1t : t.v2s2t} s={step === 1 ? t.v2s1s : t.v2s2s} />
                <V2QuestionList questions={diagnosticQuestions(v2, v2Answers, step)} answers={v2Answers} status={v2Status}
                  onAnswer={setV2Answer} onState={setV2State} lang={lang} businessType={data.business_type} />
              </>
            )}
            {v2 && step === 3 && (
              <>
                <H t={t.v2s3t} s={t.v2s3s} />
                <Field label={t.s3ig} value={data.instagram_url} onChange={set('instagram_url')} placeholder={t.s3igp} required hint={igInvalid ? t.s3igBad : t.s3igHint} />
                <Field label={t.s4mail} value={data.contact_email} onChange={set('contact_email')} type="email" placeholder={t.s4mailp} required hint={emailInvalid ? t.s4mailBad : t.s4mailh} />
                <Field label={t.s4phone} value={data.phone} onChange={set('phone')} type="tel" placeholder="(21) 99999-9999" hint={t.s4phoneH} />
                <Field label={t.s3site} value={data.website_url} onChange={set('website_url')} type="url" placeholder="https://seunegocio.com.br" hint={siteInvalid ? t.s3siteBad : t.s3siteHint} />
                <p style={{ fontSize: '12px', color: MUTED, lineHeight: 1.5, margin: '4px 0 0' }}>{t.v2later}</p>
                {errorBlock}
              </>
            )}
            {!v2 && step === 1 && (
              <>
                <H t={t.s1t} s={t.s1s} />
                <TextArea label={t.s1l} value={data.ideal_customer} onChange={set('ideal_customer')} placeholder={t.s1p} />
                <SelectField label={t.s1stage} value={data.business_stage} onChange={set('business_stage')} options={STAGES} optLabel={optLabel} required />
              </>
            )}
            {!v2 && step === 2 && (
              <>
                <H t={t.s2t} s={t.s2s} />
                <SelectField label={t.s2goal} value={data.goal} onChange={set('goal')} options={GOALS} optLabel={optLabel} required />
                <SelectField label={t.s2ch} value={data.main_challenges} onChange={set('main_challenges')} options={CHALLENGES} optLabel={optLabel} />
              </>
            )}
            {!v2 && step === 3 && (
              <>
                <H t={t.s3t} s={t.s3s} />
                <MultiSelect label={t.s3chan} values={data.current_channels} options={CHANNELS} onToggle={toggleChannel} optLabel={optLabel} />
                <Field label={t.s3ig} value={data.instagram_url} onChange={set('instagram_url')} placeholder={t.s3igp} required hint={igInvalid ? t.s3igBad : t.s3igHint} />
                <Field label={t.s3site} value={data.website_url} onChange={set('website_url')} type="url" placeholder="https://seunegocio.com.br" hint={siteInvalid ? t.s3siteBad : t.s3siteHint} />
                <Field label={t.s3fb} value={data.facebook_url} onChange={set('facebook_url')} placeholder="https://facebook.com/suapagina" />
              </>
            )}
            {!v2 && step === 4 && (
              <>
                <H t={t.s4t} s={t.s4s} />
                <div style={{ background: 'rgba(255,109,41,0.05)', border: '1px solid rgba(255,109,41,0.18)', borderRadius: '12px', padding: '14px 16px', marginBottom: '20px', fontSize: '12.5px', color: 'white', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>
                  {displaySummary(data, lang)}
                </div>
                <Field label={t.s4name} value={data.business_name} onChange={set('business_name')} placeholder={t.s4namep} hint={t.s4nameh} />
                <Field label={t.s4city} value={data.city} onChange={set('city')} placeholder={t.s4cityp} required />
                <Field label={t.s4mail} value={data.contact_email} onChange={set('contact_email')} type="email" placeholder={t.s4mailp} required hint={emailInvalid ? t.s4mailBad : t.s4mailh} />
                <Field label={t.s4phone} value={data.phone} onChange={set('phone')} placeholder="(21) 99999-9999" />
                {errorBlock}
              </>
            )}

            {!hideSteps && <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
              {step > 0 && (
                <button onClick={() => setStep(s => s - 1)}
                  style={{ flex: '0 0 auto', minHeight: 48, padding: '12px 20px', background: 'transparent', color: MUTED, fontWeight: 600, fontSize: '14px', borderRadius: '12px', border: `1px solid ${BORDER}`, cursor: 'pointer', fontFamily: 'inherit' }}>{t.back}</button>
              )}
              <button onClick={step < STEPS.length - 1 ? () => setStep(s => s + 1) : handleSubmit} disabled={!canNext()}
                style={{ flex: 1, minHeight: 48, padding: '13px 24px', background: canNext() ? ORANGE : 'rgba(255,109,41,0.2)', color: canNext() ? '#000' : 'rgba(255,255,255,0.3)', fontWeight: 800, fontSize: '15px', borderRadius: '12px', border: 'none', cursor: canNext() ? 'pointer' : 'not-allowed', fontFamily: D, letterSpacing: '-0.01em', transition: 'all 0.2s', boxShadow: canNext() ? '0 8px 20px rgba(255,109,41,0.3)' : 'none' }}>
                {step < STEPS.length - 1 ? t.cont : t.create}
              </button>
            </div>}
          </div>

          <p style={{ textAlign: 'center', fontSize: '12px', color: MUTED, marginTop: '20px', lineHeight: 1.6 }}>
            {t.priv1} <span style={{ color: ORANGE, cursor: 'pointer' }}>{t.priv2}</span>{t.priv3}
          </p>
        </div>
      </div>
    </div>
  )
}

// Conta logada SEM empresa (ex.: empresa excluída pelo Owner, cadastro
// abandonado) cai aqui pelo ClientRoute. Sem esta faixa a pessoa ficava presa:
// "Entrar" → já logado → /dashboard → sem empresa → /onboarding, sem botão de sair.
export default function OnboardingPage() {
  const { user, signOut } = useAuth()
  const { lang } = useLang()
  const navigate = useNavigate()
  return (
    <>
      {user?.email && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', flexWrap: 'wrap', padding: '10px 16px', background: 'rgba(255,255,255,0.04)', borderBottom: '1px solid rgba(255,255,255,0.08)', fontSize: '13px', color: MUTED, textAlign: 'center' }}>
          <span style={{ overflowWrap: 'anywhere' }}>{lang === 'en' ? 'Signed in as ' : 'Você está conectado como '}<strong style={{ color: 'white' }}>{user.email}</strong></span>
          <button onClick={async () => { await signOut(); navigate('/login', { replace: true }) }}
            style={{ minHeight: 36, padding: '6px 14px', borderRadius: '9px', border: '1px solid rgba(255,255,255,0.18)', background: 'transparent', color: 'white', fontSize: '12.5px', fontWeight: 700, cursor: 'pointer' }}>
            {lang === 'en' ? 'Sign out and use another account' : 'Sair e entrar com outra conta'}
          </button>
        </div>
      )}
      <DiagnosticFlow />
    </>
  )
}

function H({ t, s }: { t: string; s: string }) {
  return (
    <>
      <h1 style={{ fontFamily: D, fontSize: '1.5rem', fontWeight: 900, color: 'white', letterSpacing: '-0.02em', marginBottom: '8px' }}>{t}</h1>
      <p style={{ color: MUTED, fontSize: '14px', marginBottom: '26px', lineHeight: 1.6 }}>{s}</p>
    </>
  )
}
