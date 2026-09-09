import { useState, useEffect, useRef } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import { useSearchParams } from 'react-router-dom'
import { useCompany } from '../../contexts/CompanyContext'
import { useLang } from '../../contexts/LanguageContext'
import { d } from '../../i18n-dash'
import NotificationsCard from './settings/NotificationsCard'
import BusinessUnderstandingCard from './settings/BusinessUnderstandingCard'
import AgentConfigTab from './marketingAi/AgentConfigTab'
import ConnectionsTab from './marketingAi/ConnectionsTab'
import BusinessContextTab from './marketingAi/BusinessContextTab'
import { buildGrowthDemo } from './marketingAi/growthDemo'
import { fetchBusinessTypes, OTHER_BUSINESS_TYPE } from '../../lib/businessTypes'
import { getTrialInfo, formatExpiresAt } from '../../lib/trialState'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string

const ORANGE = '#FF6D29'
const CARD = '#150E08'
const MUTED = '#BABABA'
const D = "'Bricolage Grotesque', system-ui, sans-serif"
const BORDER = 'rgba(255,255,255,0.06)'

const GOALS = [
  'Atrair mais clientes novos',
  'Aumentar frequência dos clientes atuais',
  'Recuperar clientes inativos',
  'Aumentar ticket médio',
  'Melhorar reputação online',
  'Melhorar performance do site',
  'Outro',
]

function Field({ label, value, onChange, placeholder, type = 'text', readOnly = false, hint }: {
  label: string; value: string; onChange?: (v: string) => void; placeholder?: string
  type?: string; readOnly?: boolean; hint?: string
}) {
  const [focused, setFocused] = useState(false)
  return (
    <div style={{ marginBottom: '16px' }}>
      <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '7px' }}>{label}</label>
      <input
        type={type} value={value} readOnly={readOnly}
        onChange={e => onChange?.(e.target.value)}
        placeholder={placeholder}
        onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
        style={{ width: '100%', padding: '11px 14px', boxSizing: 'border-box', background: readOnly ? 'rgba(255,255,255,0.02)' : 'rgba(255,255,255,0.04)', border: `1px solid ${focused && !readOnly ? 'rgba(255,109,41,0.55)' : BORDER}`, borderRadius: '10px', color: readOnly ? MUTED : 'white', fontSize: '14px', outline: 'none', transition: 'border-color 0.2s', cursor: readOnly ? 'default' : 'text' }}
      />
      {hint && <div style={{ fontSize: '11px', color: MUTED, marginTop: '5px', lineHeight: 1.5 }}>{hint}</div>}
    </div>
  )
}

function SelectField({ label, value, onChange, options, hint }: {
  label: string; value: string; onChange: (v: string) => void; options: string[]; hint?: string
}) {
  const [focused, setFocused] = useState(false)
  return (
    <div style={{ marginBottom: '16px' }}>
      <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '7px' }}>{label}</label>
      <select
        value={value} onChange={e => onChange(e.target.value)}
        onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
        style={{ width: '100%', padding: '11px 14px', boxSizing: 'border-box', background: '#150E08', border: `1px solid ${focused ? 'rgba(255,109,41,0.55)' : BORDER}`, borderRadius: '10px', color: value ? 'white' : MUTED, fontSize: '14px', outline: 'none', cursor: 'pointer', appearance: 'none' }}
      >
        <option value="">Selecione...</option>
        {options.map(o => <option key={o} value={o} style={{ background: '#150E08' }}>{o}</option>)}
      </select>
      {hint && <div style={{ fontSize: '11px', color: MUTED, marginTop: '5px', lineHeight: 1.5 }}>{hint}</div>}
    </div>
  )
}

// Dropdown de tipo de estabelecimento com opções vindas do banco (geridas
// pelo dono) + "Outro (especifique)" como escape: nenhum negócio fica travado
// se o ramo dele não estiver na lista.
function BusinessTypeField({ value, onChange, options, hint }: {
  value: string; onChange: (v: string) => void; options: string[]; hint?: string
}) {
  const [focused, setFocused] = useState(false)
  const [otherMode, setOtherMode] = useState(false)
  const known = options.includes(value)
  const showOther = otherMode || (value !== '' && !known && options.length > 0)
  const selectValue = showOther ? OTHER_BUSINESS_TYPE : (known ? value : '')
  return (
    <div style={{ marginBottom: '16px' }}>
      <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '7px' }}>Tipo de estabelecimento</label>
      <select
        value={selectValue}
        onChange={e => { const v = e.target.value; if (v === OTHER_BUSINESS_TYPE) { setOtherMode(true); onChange('') } else { setOtherMode(false); onChange(v) } }}
        onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
        style={{ width: '100%', padding: '11px 14px', boxSizing: 'border-box', background: '#150E08', border: `1px solid ${focused ? 'rgba(255,109,41,0.55)' : BORDER}`, borderRadius: '10px', color: selectValue ? 'white' : MUTED, fontSize: '14px', outline: 'none', cursor: 'pointer', appearance: 'none' }}
      >
        <option value="">Selecione...</option>
        {options.map(o => <option key={o} value={o} style={{ background: '#150E08' }}>{o}</option>)}
        <option value={OTHER_BUSINESS_TYPE} style={{ background: '#150E08' }}>Outro (especifique)</option>
      </select>
      {showOther && (
        <input
          value={value} onChange={e => onChange(e.target.value)} placeholder="Digite o tipo do seu negócio"
          style={{ width: '100%', marginTop: '10px', padding: '11px 14px', boxSizing: 'border-box', background: 'rgba(255,255,255,0.04)', border: `1px solid ${BORDER}`, borderRadius: '10px', color: 'white', fontSize: '14px', outline: 'none' }}
        />
      )}
      {hint && <div style={{ fontSize: '11px', color: MUTED, marginTop: '5px', lineHeight: 1.5 }}>{hint}</div>}
    </div>
  )
}

function SectionCard({ title, id, children }: { title: string; id?: string; children: React.ReactNode }) {
  return (
    <div id={id} style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: '14px', marginBottom: '20px', overflow: 'hidden' }}>
      <div style={{ padding: '16px 22px', borderBottom: `1px solid ${BORDER}` }}>
        <span style={{ fontSize: '14px', fontWeight: 600, color: 'white' }}>{title}</span>
      </div>
      <div style={{ padding: '22px' }}>{children}</div>
    </div>
  )
}

interface PlaceCandidate {
  place_id: string; name: string; address: string; rating: number | null; review_count: number | null
  lat?: number | null; lng?: number | null
}

interface SyncStep {
  key: string; label: string; status: 'pending' | 'running' | 'done' | 'error'; message?: string
}
interface SyncJob {
  id: string; status: 'running' | 'done' | 'error'; steps: SyncStep[]
}

const PLANS = [
  {
    key: 'pro',
    name: 'SalesBoost',
    price: 'R$14,49/mês',
    postLimit: 50,
    features: ['Posts com imagem por IA', 'Revenue Opportunities', 'Atendimento automático a leads', 'Respostas automáticas a reviews', 'Automação 24/7', 'Relatórios mensais em PDF'],
  },
]

export default function SettingsPage() {
  const { user, session } = useAuth()
  const { company, refreshCompany } = useCompany()
  const [searchParams] = useSearchParams()
  const { lang } = useLang()
  const T = d[lang].settings

  const tabFromParam = (p: string | null): 'info' | 'integrations' | 'agentes' | 'conexoes' | 'contexto' =>
    p === 'integracoes' ? 'integrations' : p === 'agentes' ? 'agentes' : p === 'conexoes' ? 'conexoes' : p === 'contexto' ? 'contexto' : 'info'
  const [tab, setTab] = useState<'info' | 'integrations' | 'agentes' | 'conexoes' | 'contexto'>(tabFromParam(searchParams.get('tab')))

  useEffect(() => {
    const p = searchParams.get('tab')
    if (p === 'integracoes') setTab('integrations')
    if (p === 'agentes') setTab('agentes')
    if (p === 'conexoes') setTab('conexoes')
    if (p === 'contexto') setTab('contexto')
    const section = searchParams.get('section')
    if (!section) return
    setTimeout(() => document.getElementById(`section-${section}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 150)
  }, [searchParams])

  // Tipos de estabelecimento (geridos pelo dono no painel owner).
  useEffect(() => { fetchBusinessTypes().then(setBusinessTypes) }, [])

  // Company fields
  const [companyId, setCompanyId] = useState<string | null>(null)
  const [currentPlan, setCurrentPlan] = useState<string>('free')
  const [agentUsed, setAgentUsed] = useState(0)
  const [upgrading, setUpgrading] = useState<string | null>(null)
  const [upgradeSuccess, setUpgradeSuccess] = useState(searchParams.get('upgrade') === 'success')
  const [businessName, setBusinessName] = useState('')
  const [businessType, setBusinessType] = useState('')
  const [businessTypes, setBusinessTypes] = useState<string[]>([])
  const [city, setCity] = useState('')
  const [phone, setPhone] = useState('')
  const [contactEmail, setContactEmail] = useState('')
  const [goal, setGoal] = useState('')
  const [websiteUrl, setWebsiteUrl] = useState('')
  const [instagramUrl, setInstagramUrl] = useState('')
  const [facebookUrl, setFacebookUrl] = useState('')
  const [tiktokUrl, setTiktokUrl] = useState('')
  const [googleMapsUrl, setGoogleMapsUrl] = useState('')
  const [tripadvisorUrl, setTripadvisorUrl] = useState('')
  const [reclameAquiUrl, setReclameAquiUrl] = useState('')
  const [ifoodUrl, setIfoodUrl] = useState('')
  const [googlePlaceId, setGooglePlaceId] = useState<string | null>(null)
  const [googleRating, setGoogleRating] = useState<number | null>(null)
  const [googleReviewCount, setGoogleReviewCount] = useState<number | null>(null)
  const [avgTicket, setAvgTicket] = useState('')

  const [saved, setSaved] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')

  // Sync job — lives in the `sync_jobs` table, not just component state, so
  // progress survives a closed tab and shows up again in any tab that reopens
  // Settings, since we always load the latest job for this company on mount.
  const [syncJob, setSyncJob] = useState<SyncJob | null>(null)
  const syncPollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Places search
  const [placeQuery, setPlaceQuery] = useState('')
  const [placeCandidates, setPlaceCandidates] = useState<PlaceCandidate[]>([])
  const [placesLoading, setPlacesLoading] = useState(false)
  const [placesError, setPlacesError] = useState('')
  const placeSearchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!user) return
    supabase
      .from('companies')
      .select('id, business_name, business_type, city, phone, contact_email, goal, website_url, instagram_url, facebook_url, tiktok_url, google_maps_url, tripadvisor_url, reclame_aqui_url, ifood_url, google_place_id, google_rating, google_review_count, avg_ticket, plan, agent_messages_used')
      .eq('user_id', user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setCompanyId(data.id)
          setBusinessName(data.business_name ?? '')
          setBusinessType(data.business_type ?? '')
          setCity(data.city ?? '')
          setPhone(data.phone ?? '')
          setContactEmail(data.contact_email ?? '')
          setGoal(data.goal ?? '')
          setWebsiteUrl(data.website_url ?? '')
          setInstagramUrl(data.instagram_url ?? '')
          setFacebookUrl(data.facebook_url ?? '')
          setTiktokUrl(data.tiktok_url ?? '')
          setGoogleMapsUrl(data.google_maps_url ?? '')
          setTripadvisorUrl(data.tripadvisor_url ?? '')
          setReclameAquiUrl(data.reclame_aqui_url ?? '')
          setIfoodUrl(data.ifood_url ?? '')
          setGooglePlaceId(data.google_place_id ?? null)
          setGoogleRating(data.google_rating ?? null)
          setGoogleReviewCount(data.google_review_count ?? null)
          setAvgTicket(data.avg_ticket != null ? String(data.avg_ticket) : '')
          setCurrentPlan(data.plan ?? 'free')
          setAgentUsed(data.agent_messages_used ?? 0)

          // Pick up a sync that's already running (started from this tab, another
          // tab, or before a tab was closed) — the job lives in the DB, so any
          // tab that opens Settings finds and resumes watching the same job.
          supabase.from('sync_jobs').select('id, status, steps')
            .eq('company_id', data.id)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle()
            .then(({ data: job }) => {
              if (!job) return
              setSyncJob(job as SyncJob)
              if (job.status === 'running') startPolling(job.id)
            })
        }
      })
  }, [user])

  const startPolling = (jobId: string) => {
    if (syncPollRef.current) clearInterval(syncPollRef.current)
    const poll = async () => {
      const { data: job } = await supabase.from('sync_jobs').select('id, status, steps').eq('id', jobId).maybeSingle()
      if (!job) return
      setSyncJob(job as SyncJob)
      if (job.status !== 'running' && syncPollRef.current) {
        clearInterval(syncPollRef.current)
        syncPollRef.current = null
        void refreshCompany()
      }
    }
    void poll()
    syncPollRef.current = setInterval(poll, 2000)
  }

  useEffect(() => () => { if (syncPollRef.current) clearInterval(syncPollRef.current) }, [])

  const searchPlaces = async (q: string) => {
    if (!q.trim() || !session) return
    setPlacesLoading(true)
    setPlacesError('')
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/find-place`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: q }),
      })
      const data = await res.json()
      if (!res.ok) {
        const hint = data.hint ? `\n${data.hint}` : ''
        throw new Error((data.error ?? 'Erro na busca') + hint)
      }
      setPlaceCandidates(data.results ?? [])
    } catch (e: unknown) {
      setPlacesError(e instanceof Error ? e.message : String(e))
    }
    setPlacesLoading(false)
  }

  const handlePlaceQueryChange = (v: string) => {
    setPlaceQuery(v)
    setPlaceCandidates([])
    if (placeSearchTimeout.current) clearTimeout(placeSearchTimeout.current)
    if (v.trim().length >= 3) {
      placeSearchTimeout.current = setTimeout(() => searchPlaces(v), 700)
    }
  }

  const selectPlace = async (p: PlaceCandidate) => {
    setGooglePlaceId(p.place_id)
    setGoogleRating(p.rating)
    setGoogleReviewCount(p.review_count)
    setPlaceCandidates([])
    setPlaceQuery('')
    if (!businessName.trim()) setBusinessName(p.name)
    if (!city.trim() && p.address) {
      const parts = p.address.split(',')
      setCity(parts[parts.length - 2]?.trim() ?? '')
    }
    // Save place_id immediately if company exists — the same fields are also
    // included in handleSave's payload so a fresh company (created via the
    // insert branch below) never ends up with a place_id but no rating/count.
    if (companyId) {
      const changingPlace = googlePlaceId && googlePlaceId !== p.place_id
      const { error } = await supabase.from('companies').update({
        google_place_id: p.place_id,
        google_rating: p.rating,
        google_review_count: p.review_count,
        ...(p.lat != null ? { lat: p.lat, lng: p.lng } : {}),
      }).eq('id', companyId)
      if (error) { setSaveError(error.message); return }
      // Switching to a different Google business — reviews already fetched
      // for the old place have no place-level column to filter by, so they'd
      // otherwise sit mixed in with the new place's reviews forever. Clear
      // them out now; apify-sync will refetch fresh ones for the new place.
      if (changingPlace) {
        await supabase.from('reviews').delete().eq('company_id', companyId).eq('source', 'google')
      }
      void refreshCompany()
    }
  }

  const unlinkGoogle = async () => {
    setGooglePlaceId(null)
    setGoogleRating(null)
    setGoogleReviewCount(null)
    // Persist right away — leaving this until the "Salvar alterações" button
    // is pressed lets background review sync keep pulling from the old
    // (now-hidden) place_id, causing reviews from the wrong business to show up.
    if (companyId) {
      const { error } = await supabase.from('companies').update({
        google_place_id: null,
        google_rating: null,
        google_review_count: null,
      }).eq('id', companyId)
      if (error) { setSaveError(error.message); return }
      // Same reasoning as selectPlace — reviews aren't tagged with the place
      // they came from, so unlinking must also clear them or they'd linger
      // and get mixed in if a different Google business is linked later.
      await supabase.from('reviews').delete().eq('company_id', companyId).eq('source', 'google')
      void refreshCompany()
    }
  }

  const cancelTrial = async () => {
    if (!companyId) return
    if (!window.confirm('Cancelar o trial? Você perde o acesso ao dashboard, mas nada do que já foi feito (progresso, descobertas, conquistas) é apagado — pode voltar quando quiser.')) return
    await supabase.from('companies').update({ trial_cancelled_at: new Date().toISOString() }).eq('id', companyId)
    void refreshCompany()
  }

  const handleUpgrade = async (plan: string) => {
    if (!session) return
    setUpgrading(plan)
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/create-checkout`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          plan,
          success_url: `${window.location.origin}/dashboard/settings?upgrade=success`,
          cancel_url: `${window.location.origin}/dashboard/settings`,
        }),
      })
      const data = await res.json()
      if (data.url) {
        window.location.href = data.url
      }
    } catch {
      // silently fail — user stays on page
    }
    setUpgrading(null)
  }

  // Fires right after a successful save — kicks off a background sync job that
  // refreshes everything platform-wide (reviews, competitors, opportunities,
  // the AI profile that Campanhas/Viral Trends/posts read from, and the site
  // diagnostic), so "Salvar" is the one action that keeps everything in sync.
  // The edge function returns immediately with a job id and keeps working
  // server-side (EdgeRuntime.waitUntil) even if this tab closes; we just poll
  // `sync_jobs` to show progress.
  const triggerAutoSync = async () => {
    if (!session) return
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/apify-sync`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      const data = await res.json()
      if (res.ok && data.job_id) {
        setSyncJob({ id: data.job_id, status: 'running', steps: data.steps ?? [] })
        startPolling(data.job_id)
      }
    } catch {
      // best-effort — dá pra rodar de novo manualmente em Marketing > Avaliações/Concorrentes
    }
  }

  const handleSave = async () => {
    if (!user || !businessName.trim()) { setSaveError('Nome do negócio é obrigatório.'); return }
    setSaving(true)
    setSaveError('')
    try {
      const payload = {
        business_name: businessName,
        business_type: businessType || null,
        city: city || null,
        phone: phone || null,
        contact_email: contactEmail || null,
        goal: goal || null,
        website_url: websiteUrl || null,
        instagram_url: instagramUrl || null,
        facebook_url: facebookUrl || null,
        tiktok_url: tiktokUrl || null,
        google_maps_url: googleMapsUrl || null,
        tripadvisor_url: tripadvisorUrl || null,
        reclame_aqui_url: reclameAquiUrl || null,
        ifood_url: ifoodUrl || null,
        google_place_id: googlePlaceId || null,
        google_rating: googlePlaceId ? googleRating : null,
        google_review_count: googlePlaceId ? googleReviewCount : null,
        avg_ticket: avgTicket ? Number(avgTicket) : null,
        updated_at: new Date().toISOString(),
      }
      if (companyId) {
        const { error } = await supabase.from('companies').update(payload).eq('id', companyId)
        if (error) throw error
      } else {
        const { data, error } = await supabase
          .from('companies')
          .insert({ user_id: user.id, plan: 'free', ...payload })
          .select('id').single()
        if (error) throw error
        if (data) setCompanyId(data.id)
      }
      setSaved(true)
      void refreshCompany()
      void triggerAutoSync()
      setTimeout(() => setSaved(false), 2500)
    } catch (e: unknown) {
      setSaveError(e instanceof Error ? e.message : String(e))
    }
    setSaving(false)
  }

  const syncTotal = syncJob?.steps.length ?? 0
  const syncDone = syncJob?.steps.filter(s => s.status === 'done' || s.status === 'error').length ?? 0
  const syncPct = syncTotal ? Math.round((syncDone / syncTotal) * 100) : 0
  const syncCurrentStep = syncJob?.steps.find(s => s.status === 'running')

  return (
    <div>
      <div style={{ padding: '28px 32px 24px', borderBottom: `1px solid ${BORDER}` }}>
        <h1 style={{ fontFamily: D, fontSize: '1.5rem', fontWeight: 800, color: 'white', letterSpacing: '-0.02em', marginBottom: '4px' }}>{T.title}</h1>
        <p style={{ color: MUTED, fontSize: '13px' }}>{T.subtitle}</p>
      </div>

      <div style={{ padding: '28px 32px', maxWidth: tab === 'conexoes' || tab === 'contexto' ? '960px' : '680px' }}>

        {/* Tab switcher */}
        <div style={{ display: 'flex', gap: '6px', background: 'rgba(255,255,255,0.03)', border: `1px solid ${BORDER}`, borderRadius: '12px', padding: '5px', marginBottom: '24px', width: 'fit-content', flexWrap: 'wrap' }}>
          {([['info', 'Informações da empresa'], ['agentes', 'Agentes'], ['conexoes', 'Conexões'], ['contexto', 'Contexto do Negócio'], ['integrations', 'Notificações']] as const).map(([key, label]) => (
            <button key={key} onClick={() => setTab(key)}
              style={{ padding: '9px 18px', borderRadius: '9px', border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: 700, background: tab === key ? ORANGE : 'transparent', color: tab === key ? '#000' : MUTED, transition: 'all 0.15s' }}>
              {label}
            </button>
          ))}
        </div>

        {!companyId && tab === 'info' && (
          <div style={{ background: 'rgba(255,109,41,0.06)', border: '1px solid rgba(255,109,41,0.2)', borderRadius: '12px', padding: '14px 18px', marginBottom: '20px', fontSize: '13px', color: MUTED, lineHeight: 1.6 }}>
            👋 <strong style={{ color: 'white' }}>Bem-vindo!</strong> Preencha as informações abaixo para configurar seu painel. Depois de salvar, o dashboard mostrará seus dados.
          </div>
        )}

        {tab === 'agentes' && (
          companyId ? (
            <AgentConfigTab company={{ id: companyId }} />
          ) : (
            <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: '14px', padding: '22px', fontSize: '13px', color: MUTED, lineHeight: 1.6 }}>
              Crie o perfil do seu negócio primeiro (aba <strong style={{ color: 'white' }}>Informações da empresa</strong>) pra configurar os agentes.
            </div>
          )
        )}

        {tab === 'integrations' && <NotificationsCard />}

        {tab === 'conexoes' && (
          company ? (
            <ConnectionsTab connections={buildGrowthDemo(company).connections} />
          ) : (
            <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: '14px', padding: '22px', fontSize: '13px', color: MUTED, lineHeight: 1.6 }}>
              Crie o perfil do seu negócio primeiro (aba <strong style={{ color: 'white' }}>Informações da empresa</strong>) pra conectar seus canais.
            </div>
          )
        )}

        {tab === 'contexto' && (
          companyId ? (
            <BusinessContextTab company={{ id: companyId }} />
          ) : (
            <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: '14px', padding: '22px', fontSize: '13px', color: MUTED, lineHeight: 1.6 }}>
              Crie o perfil do seu negócio primeiro (aba <strong style={{ color: 'white' }}>Informações da empresa</strong>) pra ensinar o contexto à IA.
            </div>
          )
        )}

        {tab === 'info' && (
        <>
        {/* Google Places search */}
        <SectionCard id="section-google" title="Vincular ao Google">
          {googlePlaceId ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', padding: '12px 14px', background: 'rgba(74,222,128,0.06)', border: '1px solid rgba(74,222,128,0.2)', borderRadius: '10px', marginBottom: '4px' }}>
              <div>
                <div style={{ fontSize: '13px', color: '#4ade80', fontWeight: 600 }}>✓ Negócio vinculado ao Google</div>
                {googleRating && <div style={{ fontSize: '12px', color: MUTED, marginTop: '2px' }}>Nota: {googleRating}★ · {googleReviewCount ?? '?'} avaliações</div>}
              </div>
              <button onClick={unlinkGoogle}
                style={{ fontSize: '11px', color: MUTED, background: 'none', border: 'none', cursor: 'pointer' }}>Desvincular</button>
            </div>
          ) : (
            <>
              <p style={{ fontSize: '12px', color: MUTED, marginBottom: '14px', lineHeight: 1.6 }}>
                Vincule ao Google para importar avaliações reais e monitorar sua nota automaticamente.
              </p>
              <div style={{ position: 'relative' }}>
                <Field
                  label="Buscar seu negócio no Google"
                  value={placeQuery}
                  onChange={handlePlaceQueryChange}
                  placeholder={`Ex: ${businessName || 'Studio Beleza Carioca'} Rio de Janeiro`}
                  hint={placesLoading ? 'Buscando...' : 'Digite o nome + cidade para encontrar seu negócio'}
                />
                {placesError && (
                  <div style={{ fontSize: '12px', color: '#f87171', marginTop: '-10px', marginBottom: '12px', lineHeight: 1.6, whiteSpace: 'pre-line' }}>
                    {placesError}
                  </div>
                )}
                {placeCandidates.length > 0 && (
                  <div style={{ background: '#1A1008', border: `1px solid ${BORDER}`, borderRadius: '10px', overflow: 'hidden', marginTop: '-8px', marginBottom: '12px' }}>
                    {placeCandidates.map(p => (
                      <button key={p.place_id} onClick={() => selectPlace(p)}
                        style={{ width: '100%', padding: '12px 14px', background: 'transparent', border: 'none', borderBottom: `1px solid ${BORDER}`, textAlign: 'left', cursor: 'pointer', display: 'block' }}
                        onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,109,41,0.08)')}
                        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                        <div style={{ fontSize: '13px', color: 'white', fontWeight: 600 }}>{p.name}</div>
                        <div style={{ fontSize: '11px', color: MUTED, marginTop: '2px' }}>{p.address}{p.rating ? ` · ${p.rating}★ (${p.review_count} aval.)` : ''}</div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </SectionCard>

        <SectionCard id="section-negocio" title="Sobre o negócio">
          <Field label="Nome do negócio" value={businessName} onChange={setBusinessName} placeholder="Ex: Studio Beleza Carioca" />
          <BusinessTypeField value={businessType} onChange={setBusinessType} options={businessTypes} />
          <Field label="Cidade / UF" value={city} onChange={setCity} placeholder="Ex: Rio de Janeiro, RJ" />
          <Field label="Telefone / WhatsApp" value={phone} onChange={setPhone} placeholder="(21) 99999-9999" />
          <Field label="E-mail de contato" value={contactEmail} onChange={setContactEmail} placeholder="voce@seunegocio.com.br" type="email" />
          <SelectField label="Principal objetivo" value={goal} onChange={setGoal} options={GOALS} hint="Guia a IA para gerar conteúdo e plano de ação relevantes" />
          <Field label="Ticket médio (R$)" value={avgTicket} onChange={setAvgTicket} placeholder="Ex: 80" type="number"
            hint="Valor médio que um cliente gasta numa compra/visita. Usamos isso para calcular a receita recuperável real de cada oportunidade — sem preencher, esse valor não aparece." />
        </SectionCard>

        {companyId && <BusinessUnderstandingCard companyId={companyId} />}

        <SectionCard id="section-presenca" title="Links do negócio (opcional)">
          <p style={{ fontSize: '12px', color: MUTED, marginBottom: '18px', lineHeight: 1.6 }}>
            Opcional. Estes links viram contexto do negócio pra IA. Conectar de verdade (Instagram, WhatsApp, Google) é feito na aba <strong style={{ color: 'white' }}>Conexões</strong>.
          </p>
          <Field label="Site" value={websiteUrl} onChange={setWebsiteUrl} placeholder="https://seunegocio.com.br" hint="Analisamos performance, SEO e experiência do usuário" />
          <Field label="Instagram" value={instagramUrl} onChange={setInstagramUrl} placeholder="https://instagram.com/seuperfil" />
          <Field label="Facebook" value={facebookUrl} onChange={setFacebookUrl} placeholder="https://facebook.com/suapagina" />
          <Field label="TikTok" value={tiktokUrl} onChange={setTiktokUrl} placeholder="https://tiktok.com/@seuperfil" />
          <Field label="Google Maps" value={googleMapsUrl} onChange={setGoogleMapsUrl} placeholder="Link do seu negócio no Google Maps" hint="Coletamos suas avaliações e nota" />
          <Field label="TripAdvisor" value={tripadvisorUrl} onChange={setTripadvisorUrl} placeholder="Link da página do seu negócio no TripAdvisor" />
          <Field label="Reclame Aqui" value={reclameAquiUrl} onChange={setReclameAquiUrl} placeholder="Link da página do seu negócio no Reclame Aqui" />
          <Field label="iFood" value={ifoodUrl} onChange={setIfoodUrl} placeholder="Link da sua loja no iFood" />

          {saveError && (
            <div style={{ fontSize: '12px', color: '#f87171', marginBottom: '12px', padding: '10px 14px', background: 'rgba(248,113,113,0.08)', borderRadius: '8px', border: '1px solid rgba(248,113,113,0.2)' }}>
              {saveError}
            </div>
          )}

          <button onClick={handleSave} disabled={saving}
            style={{ padding: '11px 24px', background: saved ? '#4ade80' : ORANGE, color: '#000', fontWeight: 700, fontSize: '14px', borderRadius: '10px', border: 'none', cursor: saving ? 'not-allowed' : 'pointer', transition: 'background 0.2s', opacity: saving ? 0.7 : 1 }}>
            {saved ? '✓ Salvo com sucesso!' : saving ? 'Salvando...' : companyId ? 'Salvar alterações' : 'Criar perfil do negócio →'}
          </button>

          {syncJob && (
            <div style={{ marginTop: '16px', maxWidth: '440px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '7px' }}>
                <span style={{ fontSize: '12px', color: syncJob.status === 'error' ? '#f87171' : syncJob.status === 'done' ? '#4ade80' : MUTED, fontWeight: 600 }}>
                  {syncJob.status === 'running'
                    ? `🔄 Sincronizando: ${syncCurrentStep?.label ?? '...'}`
                    : syncJob.status === 'error'
                    ? '⚠ Sincronização concluída com alguns erros'
                    : '✓ Avaliações e concorrentes atualizados'}
                </span>
                <span style={{ fontSize: '11px', color: MUTED }}>{syncDone}/{syncTotal}</span>
              </div>
              <div style={{ height: '6px', borderRadius: '99px', background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
                <div style={{
                  width: `${syncPct}%`, height: '100%', borderRadius: '99px', transition: 'width 0.5s ease',
                  background: syncJob.status === 'error' ? '#f87171' : syncJob.status === 'done' ? '#4ade80' : ORANGE,
                }} />
              </div>
              {syncJob.status === 'running' && (
                <div style={{ fontSize: '11px', color: MUTED, marginTop: '8px', lineHeight: 1.5 }}>
                  Pode fechar esta aba tranquilo — a sincronização continua rodando e você vê o progresso da próxima vez que abrir Configurações.
                </div>
              )}
            </div>
          )}
        </SectionCard>

        <SectionCard id="section-conta" title="Conta">
          <Field label="E-mail" value={user?.email ?? ''} readOnly />

          {upgradeSuccess && (
            <div style={{ background: 'rgba(74,222,128,0.08)', border: '1px solid rgba(74,222,128,0.25)', borderRadius: '10px', padding: '12px 16px', marginBottom: '20px', fontSize: '13px', color: '#4ade80', fontWeight: 600 }}>
              ✓ Upgrade realizado com sucesso! Seu plano foi atualizado.
              <button onClick={() => setUpgradeSuccess(false)} style={{ background: 'none', border: 'none', color: '#4ade80', cursor: 'pointer', float: 'right', fontSize: '16px', lineHeight: 1 }}>×</button>
            </div>
          )}

          {/* Trial status */}
          {(() => {
            const trial = getTrialInfo(company)
            if (!trial.isTrial && trial.state !== 'trial_expired' && trial.state !== 'cancelled') return null
            return (
              <div style={{ marginBottom: '20px', padding: '14px 16px', background: 'rgba(255,109,41,0.05)', border: '1px solid rgba(255,109,41,0.2)', borderRadius: '12px' }}>
                <div style={{ fontSize: '12.5px', fontWeight: 700, color: 'white', marginBottom: '4px' }}>
                  {trial.isTrial ? `Trial de Crescimento — Dia ${trial.dayNumber} de 3` : trial.state === 'cancelled' ? 'Trial cancelado' : 'Trial encerrado'}
                </div>
                {trial.isTrial && trial.expiresAt && (
                  <div style={{ fontSize: '11.5px', color: MUTED, marginBottom: '10px' }}>Termina em {formatExpiresAt(trial.expiresAt)} — sem cobrança automática.</div>
                )}
                {trial.isTrial && (
                  <button onClick={cancelTrial} style={{ fontSize: '11.5px', color: '#f87171', background: 'transparent', border: 'none', cursor: 'pointer', padding: 0, textDecoration: 'underline' }}>
                    Cancelar trial
                  </button>
                )}
              </div>
            )
          })()}

          {/* Current plan badge */}
          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '7px' }}>Plano atual</label>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '7px 14px', background: currentPlan === 'free' ? 'rgba(255,255,255,0.04)' : 'rgba(255,109,41,0.1)', border: `1px solid ${currentPlan === 'free' ? BORDER : 'rgba(255,109,41,0.3)'}`, borderRadius: '99px' }}>
              <div style={{ width: '7px', height: '7px', borderRadius: '50%', background: currentPlan === 'free' ? MUTED : ORANGE }} />
              <span style={{ fontSize: '13px', fontWeight: 600, color: currentPlan === 'free' ? MUTED : ORANGE, textTransform: 'capitalize' }}>
                {currentPlan === 'free' ? 'Gratuito — 5 posts/mês' : currentPlan === 'basic' ? 'Basic — 15 posts/mês' : currentPlan === 'pro' ? 'Pro — 35 posts/mês' : 'Ultra — 50 posts/mês'}
              </span>
            </div>
            {currentPlan === 'free' && (
              <div style={{ marginTop: '8px', fontSize: '12px', color: MUTED }}>
                {agentUsed} de 30 mensagens usadas este mês
              </div>
            )}
          </div>

          {/* Plan cards */}
          {currentPlan !== 'ultra' && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '12px' }}>
              {PLANS.filter(p => {
                const order = ['basic', 'pro', 'ultra']
                return order.indexOf(p.key) > order.indexOf(currentPlan === 'free' ? '' : currentPlan)
              }).map(plan => {
                const isUltra = plan.key === 'ultra'
                const isPro = plan.key === 'pro'
                const highlighted = isPro || isUltra
                const cardBorder = isUltra
                  ? `2px solid ${ORANGE}`
                  : isPro
                  ? `1px solid rgba(255,109,41,0.35)`
                  : `1px solid ${BORDER}`
                const cardBg = isUltra ? 'rgba(255,109,41,0.05)' : isPro ? 'rgba(255,109,41,0.03)' : 'rgba(255,255,255,0.02)'
                const btnBg = highlighted ? ORANGE : 'rgba(255,109,41,0.12)'
                const btnColor = highlighted ? '#000' : ORANGE
                return (
                  <div key={plan.key} style={{ background: cardBg, border: cardBorder, borderRadius: '12px', padding: '18px', display: 'flex', flexDirection: 'column', gap: '12px', boxShadow: isUltra ? '0 0 24px rgba(255,109,41,0.1)' : 'none' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                        <span style={{ fontSize: '14px', fontWeight: 700, color: isUltra ? ORANGE : 'white' }}>{plan.name}</span>
                        {isPro && !isUltra && <span style={{ fontSize: '10px', fontWeight: 700, background: ORANGE, color: '#000', padding: '2px 7px', borderRadius: '99px' }}>POPULAR</span>}
                        {isUltra && <span style={{ fontSize: '10px', fontWeight: 700, background: ORANGE, color: '#000', padding: '2px 7px', borderRadius: '99px' }}>ULTRA</span>}
                      </div>
                      <div style={{ fontSize: '18px', fontWeight: 800, color: highlighted ? ORANGE : 'white' }}>{plan.price}</div>
                    </div>
                    <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      {plan.features.map(f => (
                        <li key={f} style={{ fontSize: '12px', color: MUTED, display: 'flex', gap: '6px', alignItems: 'flex-start' }}>
                          <span style={{ color: ORANGE, flexShrink: 0, marginTop: '1px' }}>✓</span>{f}
                        </li>
                      ))}
                    </ul>
                    <button
                      onClick={() => handleUpgrade(plan.key)}
                      disabled={upgrading === plan.key}
                      style={{ padding: '10px', background: btnBg, color: btnColor, fontWeight: 700, fontSize: '13px', borderRadius: '9px', border: highlighted ? 'none' : `1px solid rgba(255,109,41,0.3)`, cursor: upgrading ? 'not-allowed' : 'pointer', opacity: upgrading ? 0.7 : 1, transition: 'opacity 0.2s', boxShadow: highlighted ? '0 4px 14px rgba(255,109,41,0.25)' : 'none' }}
                    >
                      {upgrading === plan.key ? 'Redirecionando...' : `Assinar ${plan.name} →`}
                    </button>
                  </div>
                )
              })}
            </div>
          )}

          {currentPlan === 'ultra' && (
            <div style={{ fontSize: '13px', color: MUTED, lineHeight: 1.6 }}>
              Você está no plano Ultra. Para gerenciar sua assinatura, acesse o portal do cliente no e-mail de confirmação do Stripe.
            </div>
          )}
        </SectionCard>

        <SectionCard title="Zona de perigo">
          <p style={{ fontSize: '13px', color: MUTED, marginBottom: '14px', lineHeight: 1.5 }}>
            Excluir sua conta remove permanentemente todos os dados. Esta ação não pode ser desfeita.
          </p>
          <button style={{ padding: '9px 18px', background: 'rgba(239,68,68,0.1)', color: '#f87171', fontWeight: 700, fontSize: '13px', borderRadius: '9px', border: '1px solid rgba(239,68,68,0.25)', cursor: 'pointer' }}>
            Excluir conta
          </button>
        </SectionCard>
        </>
        )}
      </div>
    </div>
  )
}
