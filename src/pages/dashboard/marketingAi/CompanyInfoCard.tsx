import { useEffect, useState } from 'react'
import { supabase } from '../../../lib/supabase'
import { useAuth } from '../../../contexts/AuthContext'
import { fetchBusinessTypes, OTHER_BUSINESS_TYPE } from '../../../lib/businessTypes'
import { CARD, MUTED, BORDER, D, ORANGE, SUPABASE_URL, timeAgo } from './shared'
import { buildIcpDemo } from './growthIntelDemo'

// Infos da empresa — tudo que foi coletado no onboarding (identidade,
// contatos, canais, e o entendimento conversacional do negócio), agora
// dentro do Agente de Dados: é o contexto que os outros agentes (Conteúdo,
// Conversão) consomem, então faz mais sentido viver aqui do que perdido numa
// aba de Configurações. Card auto-contido: carrega e salva os próprios
// campos, sem depender de nenhum outro save da página (mesmo padrão de
// settings/BusinessUnderstandingCard.tsx, que esse card substitui).
interface Info {
  business_name: string
  business_type: string
  city: string
  phone: string
  contact_email: string
  goal: string
  avg_ticket: string
  website_url: string
  instagram_url: string
  facebook_url: string
  tiktok_url: string
  google_maps_url: string
  tripadvisor_url: string
  reclame_aqui_url: string
  ifood_url: string
  business_description: string
  ideal_customer: string
  business_stage: string
  primary_goals: string
  main_challenges: string
  current_channels: string
  agent_business_interpretation: string
  marketing_monthly_budget: string
  website_summary: string
  website_summary_updated_at: string
}
const EMPTY: Info = {
  business_name: '', business_type: '', city: '', phone: '', contact_email: '', goal: '', avg_ticket: '',
  website_url: '', instagram_url: '', facebook_url: '', tiktok_url: '', google_maps_url: '', tripadvisor_url: '', reclame_aqui_url: '', ifood_url: '',
  business_description: '', ideal_customer: '', business_stage: '', primary_goals: '', main_challenges: '', current_channels: '', agent_business_interpretation: '',
  marketing_monthly_budget: '', website_summary: '', website_summary_updated_at: '',
}
const SELECT_COLS = Object.keys(EMPTY).join(', ')

const GOALS = [
  'Atrair mais clientes novos',
  'Aumentar frequência dos clientes atuais',
  'Recuperar clientes inativos',
  'Aumentar ticket médio',
  'Melhorar reputação online',
  'Melhorar performance do site',
  'Outro',
]

const IDENTITY_FIELDS: { key: keyof Info; label: string; placeholder?: string; type?: string }[] = [
  { key: 'business_name', label: 'Nome do negócio', placeholder: 'Ex: Studio Beleza Carioca' },
  { key: 'city', label: 'Cidade / UF', placeholder: 'Ex: Rio de Janeiro, RJ' },
  { key: 'phone', label: 'Telefone / WhatsApp', placeholder: '(21) 99999-9999' },
  { key: 'contact_email', label: 'E-mail de contato', placeholder: 'voce@seunegocio.com.br', type: 'email' },
  { key: 'avg_ticket', label: 'Ticket médio (R$)', placeholder: 'Ex: 80', type: 'number' },
  { key: 'marketing_monthly_budget', label: 'Orçamento de marketing mensal (R$)', placeholder: 'Ex: 500', type: 'number' },
]
const LINK_FIELDS: { key: keyof Info; label: string; placeholder: string }[] = [
  { key: 'website_url', label: 'Site', placeholder: 'https://...' },
  { key: 'instagram_url', label: 'Instagram', placeholder: 'https://instagram.com/...' },
  { key: 'facebook_url', label: 'Facebook', placeholder: 'https://facebook.com/...' },
  { key: 'tiktok_url', label: 'TikTok', placeholder: 'https://tiktok.com/@...' },
  { key: 'google_maps_url', label: 'Google Maps', placeholder: 'https://maps.google.com/...' },
  { key: 'tripadvisor_url', label: 'Tripadvisor', placeholder: 'https://tripadvisor.com/...' },
  { key: 'reclame_aqui_url', label: 'Reclame Aqui', placeholder: 'https://reclameaqui.com.br/...' },
  { key: 'ifood_url', label: 'iFood', placeholder: 'https://ifood.com.br/...' },
]
const UNDERSTANDING_FIELDS: { key: keyof Info; label: string; area?: boolean }[] = [
  { key: 'business_description', label: 'O que o negócio faz', area: true },
  { key: 'ideal_customer', label: 'Cliente ideal', area: true },
  { key: 'business_stage', label: 'Fase do negócio' },
  { key: 'primary_goals', label: 'Objetivo principal' },
  { key: 'main_challenges', label: 'Maior desafio' },
  { key: 'current_channels', label: 'Canais atuais' },
]

function TextInput({ label, value, onChange, placeholder, type = 'text' }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string }) {
  return (
    <div style={{ marginBottom: '14px' }}>
      <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '6px' }}>{label}</label>
      <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
        style={{ width: '100%', boxSizing: 'border-box', padding: '10px 13px', background: 'rgba(255,255,255,0.04)', border: `1px solid ${BORDER}`, borderRadius: '10px', color: 'white', fontSize: '13.5px', outline: 'none', fontFamily: 'inherit' }} />
    </div>
  )
}
function TextArea({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div style={{ marginBottom: '14px' }}>
      <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '6px' }}>{label}</label>
      <textarea value={value} onChange={e => onChange(e.target.value)} rows={2}
        style={{ width: '100%', boxSizing: 'border-box', padding: '10px 13px', background: 'rgba(255,255,255,0.04)', border: `1px solid ${BORDER}`, borderRadius: '10px', color: 'white', fontSize: '13.5px', outline: 'none', fontFamily: 'inherit', resize: 'vertical', lineHeight: 1.5 }} />
    </div>
  )
}

function SubBlock({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: '22px' }}>
      <div style={{ fontSize: '11px', fontWeight: 800, color: ORANGE, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '12px' }}>{title}</div>
      {children}
    </div>
  )
}

// Cliente ideal (ICP) "aprendido pela IA" — motor de exemplo (buildIcpDemo).
// Ainda não existe fonte real de atribuição pra isso, então SEMPRE rotulado
// como exemplo — nunca misturar com o "Cliente ideal" real (ideal_customer,
// vindo do cadastro) que já aparece acima em Entendimento do negócio.
function IcpDemoPreview({ businessType, city }: { businessType: string; city: string }) {
  const { profile } = buildIcpDemo(businessType || null, city || null)
  return (
    <div style={{ marginTop: '4px', padding: '14px 16px', background: 'rgba(251,191,36,0.05)', border: '1px solid rgba(251,191,36,0.2)', borderRadius: '10px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
        <span style={{ fontSize: '12px', fontWeight: 800, color: 'white' }}>🧬 Cliente ideal aprendido pela IA</span>
        <span style={{ fontSize: '9px', fontWeight: 700, color: '#FBBF24', border: '1px solid rgba(251,191,36,0.4)', borderRadius: '99px', padding: '2px 8px' }}>EXEMPLO</span>
      </div>
      <div style={{ fontSize: '11px', color: MUTED, marginBottom: '10px', lineHeight: 1.55 }}>
        Isso é uma <strong style={{ color: 'white' }}>demonstração</strong> de como a IA vai refinar o cliente ideal sozinha, cruzando engajamento/campanhas reais — ainda não tem dado real suficiente pra isso. O campo "Cliente ideal" ali em cima (que você preenche) é o real, usado pelos agentes hoje.
      </div>
      <div style={{ fontSize: '12.5px', fontWeight: 700, color: 'white', marginBottom: '8px', lineHeight: 1.4 }}>"{profile.headline}"</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
        {profile.demographics.map(d => <span key={d} style={{ fontSize: '10px', color: 'rgba(255,255,255,0.75)', background: 'rgba(255,255,255,0.04)', border: `1px solid ${BORDER}`, borderRadius: '7px', padding: '3px 8px' }}>{d}</span>)}
      </div>
    </div>
  )
}

export default function CompanyInfoCard({ companyId }: { companyId: string }) {
  const { session } = useAuth()
  const [info, setInfo] = useState<Info>(EMPTY)
  const [businessType, setBusinessType] = useState('')
  const [businessTypeOptions, setBusinessTypeOptions] = useState<string[]>([])
  const [otherMode, setOtherMode] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [summarizing, setSummarizing] = useState(false)
  const [summaryError, setSummaryError] = useState('')

  useEffect(() => { fetchBusinessTypes().then(setBusinessTypeOptions) }, [])

  useEffect(() => {
    let alive = true
    supabase.from('companies').select(SELECT_COLS).eq('id', companyId).maybeSingle()
      .then(({ data }) => {
        if (!alive || !data) { setLoading(false); return }
        const row = data as unknown as Record<string, string | number | null>
        setInfo({ ...EMPTY, ...Object.fromEntries(Object.entries(row).map(([k, v]) => [k, v == null ? '' : String(v)])) } as Info)
        setBusinessType(String(row.business_type ?? ''))
        setLoading(false)
      })
    return () => { alive = false }
  }, [companyId])

  const set = (k: keyof Info) => (v: string) => { setInfo(p => ({ ...p, [k]: v })); setSaved(false) }
  const knownType = businessTypeOptions.includes(businessType)
  const showOtherType = otherMode || (businessType !== '' && !knownType && businessTypeOptions.length > 0)

  const save = async () => {
    setSaving(true)
    const interpretation = `Negócio "${info.business_description || '—'}". Cliente ideal: ${info.ideal_customer || '—'}. Objetivo: ${info.primary_goals || '—'}. Desafio: ${info.main_challenges || '—'}. Canais: ${info.current_channels || '—'}. Fase: ${info.business_stage || '—'}.`
    const payload = {
      ...info, business_type: businessType || null,
      avg_ticket: info.avg_ticket ? Number(info.avg_ticket) : null,
      marketing_monthly_budget: info.marketing_monthly_budget ? Number(info.marketing_monthly_budget) : null,
      website_summary_updated_at: info.website_summary_updated_at || null,
      agent_business_interpretation: interpretation, updated_at: new Date().toISOString(),
    }
    await supabase.from('companies').update(payload).eq('id', companyId)
    setInfo(p => ({ ...p, agent_business_interpretation: interpretation }))
    setSaving(false); setSaved(true); setTimeout(() => setSaved(false), 2500)
  }

  const refreshWebsiteSummary = async () => {
    if (!session || summarizing) return
    setSummarizing(true); setSummaryError('')
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/website-summary`, {
        method: 'POST', headers: { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
      })
      const data = await res.json().catch(() => ({})) as { error?: string; summary?: string }
      if (!res.ok) throw new Error(data.error ?? 'Erro ao ler o site')
      setInfo(p => ({ ...p, website_summary: data.summary ?? '', website_summary_updated_at: new Date().toISOString() }))
    } catch (e) {
      setSummaryError(e instanceof Error ? e.message : 'Erro ao ler o site')
    }
    setSummarizing(false)
  }

  if (loading) return <div style={{ fontSize: '12px', color: MUTED }}>Carregando...</div>

  return (
    <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: '14px', padding: '22px 24px', maxWidth: '680px' }}>
      <div style={{ fontSize: '15px', fontWeight: 800, color: 'white', marginBottom: '3px' }}>🏢 Infos da empresa</div>
      <p style={{ fontSize: '12px', color: MUTED, marginBottom: '20px', lineHeight: 1.6 }}>
        Tudo que foi coletado no cadastro — identidade, contatos, canais e o entendimento do negócio. É o <strong style={{ color: 'white' }}>contexto que os agentes usam</strong> pra decidir e recomendar. Pode ajustar quando quiser.
      </p>

      <SubBlock title="Identidade">
        {IDENTITY_FIELDS.map(f => <TextInput key={f.key} label={f.label} value={info[f.key]} onChange={set(f.key)} placeholder={f.placeholder} type={f.type} />)}
        <div style={{ marginBottom: '14px' }}>
          <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '6px' }}>Tipo de estabelecimento</label>
          <select
            value={showOtherType ? OTHER_BUSINESS_TYPE : (knownType ? businessType : '')}
            onChange={e => { const v = e.target.value; if (v === OTHER_BUSINESS_TYPE) { setOtherMode(true); setBusinessType('') } else { setOtherMode(false); setBusinessType(v) } }}
            style={{ width: '100%', boxSizing: 'border-box', padding: '10px 13px', background: '#150E08', border: `1px solid ${BORDER}`, borderRadius: '10px', color: businessType ? 'white' : MUTED, fontSize: '13.5px', outline: 'none', cursor: 'pointer', appearance: 'none', fontFamily: 'inherit' }}>
            <option value="">Selecione...</option>
            {businessTypeOptions.map(o => <option key={o} value={o} style={{ background: '#150E08' }}>{o}</option>)}
            <option value={OTHER_BUSINESS_TYPE} style={{ background: '#150E08' }}>Outro (especifique)</option>
          </select>
          {showOtherType && (
            <input value={businessType} onChange={e => setBusinessType(e.target.value)} placeholder="Digite o tipo do seu negócio"
              style={{ width: '100%', marginTop: '8px', boxSizing: 'border-box', padding: '10px 13px', background: 'rgba(255,255,255,0.04)', border: `1px solid ${BORDER}`, borderRadius: '10px', color: 'white', fontSize: '13.5px', outline: 'none', fontFamily: 'inherit' }} />
          )}
        </div>
        <div style={{ marginBottom: '14px' }}>
          <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '6px' }}>Principal objetivo</label>
          <select value={info.goal} onChange={e => set('goal')(e.target.value)}
            style={{ width: '100%', boxSizing: 'border-box', padding: '10px 13px', background: '#150E08', border: `1px solid ${BORDER}`, borderRadius: '10px', color: info.goal ? 'white' : MUTED, fontSize: '13.5px', outline: 'none', cursor: 'pointer', appearance: 'none', fontFamily: 'inherit' }}>
            <option value="">Selecione...</option>
            {GOALS.map(g => <option key={g} value={g} style={{ background: '#150E08' }}>{g}</option>)}
          </select>
        </div>
      </SubBlock>

      <SubBlock title="Canais e links">
        {LINK_FIELDS.map(f => <TextInput key={f.key} label={f.label} value={info[f.key]} onChange={set(f.key)} placeholder={f.placeholder} />)}
      </SubBlock>

      <SubBlock title="Repertório do site">
        <div style={{ fontSize: '11px', color: MUTED, marginBottom: '10px', lineHeight: 1.55 }}>
          A IA lê o site (campo Site acima) e escreve um resumo real do que encontrou — pra ter repertório de verdade sobre o negócio, em vez de só o que foi digitado aqui.
        </div>
        {info.website_summary && (
          <div style={{ padding: '12px 14px', background: 'rgba(255,255,255,0.03)', border: `1px solid ${BORDER}`, borderRadius: '10px', fontSize: '12.5px', color: 'white', lineHeight: 1.6, marginBottom: '10px' }}>
            {info.website_summary}
            {info.website_summary_updated_at && <div style={{ fontSize: '10px', color: MUTED, marginTop: '8px' }}>Atualizado {timeAgo(info.website_summary_updated_at)}</div>}
          </div>
        )}
        {summaryError && <div style={{ fontSize: '11.5px', color: '#f87171', marginBottom: '10px' }}>{summaryError}</div>}
        <button onClick={refreshWebsiteSummary} disabled={summarizing || !info.website_url}
          title={!info.website_url ? 'Preencha o campo Site primeiro' : undefined}
          style={{ padding: '9px 16px', background: 'transparent', border: `1px solid ${BORDER}`, color: !info.website_url ? MUTED : ORANGE, fontWeight: 700, fontSize: '12.5px', borderRadius: '9px', cursor: summarizing || !info.website_url ? 'default' : 'pointer', fontFamily: D, opacity: summarizing ? 0.7 : 1 }}>
          {summarizing ? 'Lendo o site...' : info.website_summary ? '↻ Reler o site' : '🌐 Ler o site agora'}
        </button>
      </SubBlock>

      <SubBlock title="Entendimento do negócio">
        {UNDERSTANDING_FIELDS.map(f => f.area
          ? <TextArea key={f.key} label={f.label} value={info[f.key]} onChange={set(f.key)} />
          : <TextInput key={f.key} label={f.label} value={info[f.key]} onChange={set(f.key)} />)}
        {info.agent_business_interpretation && (
          <div style={{ margin: '4px 0 4px', padding: '12px 14px', background: 'rgba(255,109,41,0.05)', border: '1px solid rgba(255,109,41,0.15)', borderRadius: '10px', fontSize: '12px', color: 'white', lineHeight: 1.6 }}>
            <div style={{ fontSize: '9.5px', fontWeight: 700, color: ORANGE, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '4px' }}>Como a IA resume o negócio</div>
            {info.agent_business_interpretation}
          </div>
        )}
        <IcpDemoPreview businessType={businessType} city={info.city} />
      </SubBlock>

      <button onClick={save} disabled={saving}
        style={{ padding: '10px 20px', background: saved ? '#4ade80' : ORANGE, color: '#000', fontWeight: 700, fontSize: '13px', border: 'none', borderRadius: '10px', cursor: saving ? 'not-allowed' : 'pointer', fontFamily: D }}>
        {saved ? '✓ Salvo' : saving ? 'Salvando...' : 'Salvar infos da empresa'}
      </button>
    </div>
  )
}
