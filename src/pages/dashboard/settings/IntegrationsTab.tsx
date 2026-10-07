import { useEffect, useState } from 'react'
import { useAuth } from '../../../contexts/AuthContext'
import { supabase } from '../../../lib/supabase'
import { useSearchParams } from 'react-router-dom'
import { useLang } from '../../../contexts/LanguageContext'
import { TX } from './IntegrationsTab.i18n'
import { launchWhatsAppSignup, isWhatsAppSignupConfigured } from '../../../lib/facebookSdk'

function buildGbpAuthUrl(companyId: string): string {
  const params = new URLSearchParams({
    client_id: import.meta.env.VITE_GOOGLE_OAUTH_CLIENT_ID as string,
    redirect_uri: `${window.location.origin}/auth/gbp/callback`,
    response_type: 'code',
    scope: 'https://www.googleapis.com/auth/business.manage',
    access_type: 'offline',
    prompt: 'consent',
    state: companyId,
  })
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`
}

const ORANGE = '#FF6D29'
const CARD = '#150E08'
const MUTED = '#BABABA'
const D = "'Bricolage Grotesque', system-ui, sans-serif"
const BORDER = 'rgba(255,255,255,0.06)'

interface GscMetrics {
  summary: { clicks: number; impressions: number; ctr: number; position: number }
  top_queries: Array<{ query: string; clicks: number; impressions: number; position: number }>
  top_pages: Array<{ page: string; clicks: number; impressions: number }>
  period: { start: string; end: string }
}

interface Integration {
  id: string
  type: string
  domain: string | null
  connected_at: string | null
}

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string
const GSC_CLIENT_ID = import.meta.env.VITE_GOOGLE_OAUTH_CLIENT_ID as string

function buildGscAuthUrl(companyId: string): string {
  const params = new URLSearchParams({
    client_id: GSC_CLIENT_ID,
    redirect_uri: `${window.location.origin}/auth/gsc/callback`,
    response_type: 'code',
    scope: 'https://www.googleapis.com/auth/webmasters.readonly',
    access_type: 'offline',
    prompt: 'consent',
    state: companyId,
  })
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`
}

export default function IntegrationsTab() {
  const { user, session } = useAuth()
  const { lang } = useLang()
  const X = TX[lang]
  const [searchParams] = useSearchParams()
  const [companyId, setCompanyId] = useState<string | null>(null)
  const [integration, setIntegration] = useState<Integration | null>(null)
  const [gbpIntegration, setGbpIntegration] = useState<Integration | null>(null)
  const [metrics, setMetrics] = useState<GscMetrics | null>(null)
  const [loading, setLoading] = useState(true)
  const [metricsLoading, setMetricsLoading] = useState(false)
  const [metricsError, setMetricsError] = useState('')
  // Instagram auto-post state
  const [igConnected, setIgConnected] = useState(false)
  const [igUsername, setIgUsername] = useState<string | null>(null)
  const [igAutoPost, setIgAutoPost] = useState(false)
  const [igFrequency, setIgFrequency] = useState('daily')
  const [igTogglingAuto, setIgTogglingAuto] = useState(false)
  const igOauthError = searchParams.get('error')
  const igOauthSuccess = searchParams.get('instagram') === 'connected'
  // WhatsApp — só guarda o número do cliente por enquanto (a resposta
  // automática ainda depende de como várias empresas vão dividir o mesmo
  // número do WhatsApp Business, isso ainda não foi decidido).
  const [waNumber, setWaNumber] = useState('')
  const [waConnectedAt, setWaConnectedAt] = useState<string | null>(null)
  // Conexão REAL só existe quando o número do WhatsApp (phone_number_id) foi
  // de fato salvo pelo Embedded Signup — não basta ter um número digitado.
  const [waPhoneId, setWaPhoneId] = useState<string | null>(null)
  const waConnected = !!waPhoneId
  const [waSaving, setWaSaving] = useState(false)
  const [waSaved, setWaSaved] = useState(false)
  const [waError, setWaError] = useState('')
  // Conexão manual (número próprio do dono, via WhatsApp → Configuração da API
  // na Meta). Alternativa ao Embedded Signup, que exige app Tech Provider.
  const [waManualOpen, setWaManualOpen] = useState(false)
  const [waManualWaba, setWaManualWaba] = useState('')
  const [waManualPhoneId, setWaManualPhoneId] = useState('')
  const [waManualToken, setWaManualToken] = useState('')
  // Login com o Meta Business Suite — dá acesso real (não mock) às Páginas,
  // Instagram vinculado e negócios do Business Manager.
  const [metaBusinessName, setMetaBusinessName] = useState<string | null>(null)
  const [metaBusinessConnectedAt, setMetaBusinessConnectedAt] = useState<string | null>(null)
  const [metaBusinessPagesCount, setMetaBusinessPagesCount] = useState(0)
  const metaBusinessError = searchParams.get('error')
  const metaBusinessSuccess = searchParams.get('meta_business') === 'connected'
  // Meta Ads state
  const [metaAdsAccount, setMetaAdsAccount] = useState<{ id: string; name: string } | null>(null)
  const metaAdsSuccess = searchParams.get('meta_ads') === 'connected'

  useEffect(() => {
    if (!user) return
    loadIntegration()
  }, [user])

  const loadIntegration = async () => {
    setLoading(true)
    const { data: company } = await supabase
      .from('companies')
      .select('id, instagram_user_id, instagram_username, instagram_auto_post, instagram_post_frequency, whatsapp_number, whatsapp_connected_at, whatsapp_phone_number_id, meta_business_name, meta_business_connected_at, meta_ads_account_id, meta_ads_account_name')
      .eq('user_id', user!.id)
      .single()

    if (!company) { setLoading(false); return }
    setCompanyId(company.id)
    setIgConnected(!!company.instagram_user_id)
    setIgUsername(company.instagram_username ?? null)
    setIgAutoPost(company.instagram_auto_post ?? false)
    setIgFrequency(company.instagram_post_frequency ?? 'daily')
    setWaNumber(company.whatsapp_number ?? '')
    setWaConnectedAt(company.whatsapp_connected_at ?? null)
    setWaPhoneId(company.whatsapp_phone_number_id ?? null)
    setMetaBusinessName(company.meta_business_name ?? null)
    setMetaBusinessConnectedAt(company.meta_business_connected_at ?? null)
    setMetaAdsAccount(company.meta_ads_account_id ? { id: company.meta_ads_account_id, name: company.meta_ads_account_name ?? company.meta_ads_account_id } : null)

    const { count: pagesCount } = await supabase
      .from('company_meta_pages')
      .select('id', { count: 'exact', head: true })
      .eq('company_id', company.id)
    setMetaBusinessPagesCount(pagesCount ?? 0)

    const { data: integ } = await supabase
      .from('company_integrations')
      .select('id, type, domain, connected_at')
      .eq('company_id', company.id)
      .eq('type', 'google_search_console')
      .maybeSingle()

    const { data: gbpInteg } = await supabase
      .from('company_integrations')
      .select('id, type, domain, connected_at')
      .eq('company_id', company.id)
      .eq('type', 'google_business_profile')
      .maybeSingle()

    setIntegration(integ ?? null)
    setGbpIntegration(gbpInteg ?? null)
    setLoading(false)
  }

  const loadGscMetrics = async () => {
    if (!companyId || !session) return
    setMetricsLoading(true)
    setMetricsError('')

    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/gsc-metrics`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ company_id: companyId }),
      })
      const data = await res.json() as GscMetrics & { error?: string }
      if (!res.ok || data.error) {
        setMetricsError(data.error ?? X.metricsErr)
      } else {
        setMetrics(data)
      }
    } catch {
      setMetricsError(X.metricsErrUnexpected)
    }
    setMetricsLoading(false)
  }

  const toggleAutoPost = async (enabled: boolean) => {
    if (!companyId) return
    setIgTogglingAuto(true)
    await supabase.from('companies').update({ instagram_auto_post: enabled }).eq('id', companyId)
    setIgAutoPost(enabled)
    setIgTogglingAuto(false)
  }

  const updateFrequency = async (freq: string) => {
    if (!companyId) return
    setIgFrequency(freq)
    await supabase.from('companies').update({ instagram_post_frequency: freq }).eq('id', companyId)
  }

  const handleDisconnectGsc = async () => {
    if (!integration) return
    await supabase.from('company_integrations').delete().eq('id', integration.id)
    setIntegration(null)
    setMetrics(null)
  }

  const handleDisconnectGbp = async () => {
    if (!gbpIntegration) return
    await supabase.from('company_integrations').delete().eq('id', gbpIntegration.id)
    setGbpIntegration(null)
  }

  const handleDisconnectIgOauth = async () => {
    if (!companyId) return
    // Zera os 4 campos de verdade — antes só limpava instagram_user_id e
    // deixava o token de acesso vivo no banco (bug real: a UI mostrava
    // "desconectado", mas o token continuava válido e guardado).
    await supabase.from('companies').update({
      instagram_user_id: null, instagram_username: null, instagram_access_token: null,
      instagram_token_expires_at: null, instagram_auto_post: false,
    }).eq('id', companyId)
    setIgConnected(false)
    setIgUsername(null)
    setIgAutoPost(false)
  }

  const connectWhatsapp = async () => {
    if (!session) return
    setWaSaving(true)
    setWaError('')
    try {
      const { code, wabaId, phoneNumberId } = await launchWhatsAppSignup()
      // #13: popup fechado NÃO é sucesso — só seguimos com WABA + phone reais.
      if (!wabaId || !phoneNumberId) throw new Error(X.waSignupIncomplete)
      console.log('[Meta Signup] backend validação iniciada', { temWaba: !!wabaId, temPhone: !!phoneNumberId })
      const res = await fetch(`${SUPABASE_URL}/functions/v1/whatsapp-embedded-signup`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, waba_id: wabaId, phone_number_id: phoneNumberId }),
      })
      const data = await res.json() as { ok?: boolean; error?: string; display_phone_number?: string }
      if (!res.ok || !data.ok) throw new Error(friendlyWaError(data.error))
      console.log('[Meta Signup] integração salva', { number: data.display_phone_number })
      setWaNumber(data.display_phone_number ?? '')
      setWaConnectedAt(new Date().toISOString())
      setWaPhoneId(phoneNumberId) // conexão real: guarda o número escolhido
      setWaSaved(true)
      setTimeout(() => setWaSaved(false), 2000)
    } catch (e) {
      setWaError(e instanceof Error ? e.message : String(e))
    }
    setWaSaving(false)
  }

  // Conexão manual: o dono cola Phone Number ID + WABA ID + token (da Meta) e
  // a gente valida no servidor e salva. O token vai por HTTPS direto pro backend.
  const connectWhatsappManual = async () => {
    if (!session) return
    setWaSaving(true)
    setWaError('')
    try {
      if (!waManualWaba.trim() || !waManualPhoneId.trim() || !waManualToken.trim())
        throw new Error(X.waFill3)
      const res = await fetch(`${SUPABASE_URL}/functions/v1/whatsapp-manual-connect`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ waba_id: waManualWaba.trim(), phone_number_id: waManualPhoneId.trim(), access_token: waManualToken.trim() }),
      })
      const data = await res.json() as { ok?: boolean; error?: string; display_phone_number?: string }
      if (!res.ok || !data.ok) throw new Error(friendlyWaError(data.error))
      setWaNumber(data.display_phone_number ?? '')
      setWaConnectedAt(new Date().toISOString())
      setWaPhoneId(waManualPhoneId.trim())
      setWaManualToken('') // não mantém o token em memória no browser após salvar
      setWaManualOpen(false)
      setWaSaved(true)
      setTimeout(() => setWaSaved(false), 2500)
    } catch (e) {
      setWaError(e instanceof Error ? e.message : String(e))
    }
    setWaSaving(false)
  }

  // Traduz erros técnicos da Meta em algo que o dono entende e sabe agir.
  const friendlyWaError = (err?: string): string => {
    const raw = err ?? X.waErrDefault
    const low = raw.toLowerCase()
    if (low.includes('permission') || low.includes('advanced access') || low.includes('scope'))
      return X.waPerm(raw)
    if (low.includes('redirect') || low.includes('config'))
      return X.waConfig(raw)
    return raw
  }

  const handleDisconnectWhatsapp = async () => {
    if (!companyId) return
    await supabase.from('companies').update({
      whatsapp_number: null, whatsapp_connected_at: null, whatsapp_business_account_id: null,
      whatsapp_phone_number_id: null, whatsapp_access_token: null, whatsapp_verified_name: null,
    }).eq('id', companyId)
    setWaNumber('')
    setWaConnectedAt(null)
    setWaPhoneId(null)
  }

  const handleDisconnectMetaBusiness = async () => {
    if (!companyId) return
    await supabase.from('companies').update({
      meta_business_user_id: null, meta_business_name: null, meta_business_access_token: null,
      meta_business_token_expires_at: null, meta_business_connected_at: null,
    }).eq('id', companyId)
    await supabase.from('company_meta_pages').delete().eq('company_id', companyId)
    setMetaBusinessName(null)
    setMetaBusinessConnectedAt(null)
    setMetaBusinessPagesCount(0)
  }

  const handleDisconnectMetaAds = async () => {
    if (!companyId) return
    await supabase.from('companies').update({ meta_ads_account_id: null, meta_ads_account_name: null, meta_ads_access_token: null, meta_ads_token_expires_at: null }).eq('id', companyId)
    setMetaAdsAccount(null)
  }

  if (loading) {
    return <div style={{ color: MUTED, fontSize: '14px' }}>{X.loading}</div>
  }

  return (
    <div>
      {/* Meta Business Suite — login real (Páginas, Instagram vinculado, Business Manager) */}
      <div style={{ background: CARD, border: `1px solid ${metaBusinessConnectedAt ? 'rgba(74,222,128,0.25)' : 'rgba(255,109,41,0.2)'}`, borderRadius: '14px', overflow: 'hidden', marginBottom: '20px' }}>
        <div style={{ padding: '20px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: metaBusinessConnectedAt ? 'rgba(74,222,128,0.12)' : 'rgba(255,109,41,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px' }}>∞</div>
            <div>
              <div style={{ fontSize: '14px', fontWeight: 700, color: 'white' }}>
                Meta Business Suite{' '}
                {metaBusinessConnectedAt && (
                  <span style={{ fontSize: '10px', background: 'rgba(74,222,128,0.15)', color: '#4ade80', padding: '2px 8px', borderRadius: 99, marginLeft: 6, verticalAlign: 'middle', fontWeight: 700 }}>{X.connectedBadge}</span>
                )}
              </div>
              <div style={{ fontSize: '12px', color: metaBusinessConnectedAt ? '#4ade80' : MUTED }}>
                {metaBusinessConnectedAt
                  ? X.mbConnectedAs(metaBusinessName ?? '—', metaBusinessPagesCount)
                  : X.mbLoginHint}
              </div>
            </div>
          </div>
          {companyId && (
            <div style={{ display: 'flex', gap: '8px' }}>
              <a href={`${SUPABASE_URL}/functions/v1/meta-business-oauth-start?company_id=${companyId}`}
                style={{ padding: '8px 18px', background: metaBusinessConnectedAt ? 'rgba(255,255,255,0.04)' : ORANGE, color: metaBusinessConnectedAt ? MUTED : '#000', fontWeight: 700, fontSize: '12px', borderRadius: '8px', border: metaBusinessConnectedAt ? `1px solid ${BORDER}` : 'none', textDecoration: 'none', display: 'inline-block', cursor: 'pointer' }}>
                {metaBusinessConnectedAt ? X.reconnect : X.mbConnectBtn}
              </a>
              {metaBusinessConnectedAt && (
                <button onClick={handleDisconnectMetaBusiness}
                  style={{ padding: '8px 14px', background: 'transparent', color: '#f87171', fontWeight: 600, fontSize: '12px', borderRadius: '8px', border: '1px solid rgba(248,113,113,0.3)', cursor: 'pointer' }}>
                  {X.disconnect}
                </button>
              )}
            </div>
          )}
        </div>
        {(metaBusinessSuccess || metaBusinessError) && (
          <div style={{ padding: '12px 24px', background: metaBusinessSuccess ? 'rgba(74,222,128,0.06)' : 'rgba(239,68,68,0.08)', fontSize: '12px', color: metaBusinessSuccess ? '#4ade80' : '#f87171', borderTop: `1px solid ${BORDER}` }}>
            {metaBusinessSuccess ? X.mbSuccess : `${X.errorPrefix}${metaBusinessError}`}
          </div>
        )}
        {!metaBusinessConnectedAt && (
          <div style={{ padding: '0 24px 20px' }}>
            <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.5)', lineHeight: 1.6 }}>
              {X.mbDesc}
            </div>
          </div>
        )}
      </div>

      {/* Google Search Console Card */}
      <div style={{ background: CARD, border: `1px solid ${integration ? 'rgba(74,222,128,0.25)' : BORDER}`, borderRadius: '14px', overflow: 'hidden', marginBottom: '20px' }}>
        <div style={{ padding: '20px 24px', borderBottom: `1px solid ${BORDER}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: integration ? 'rgba(74,222,128,0.12)' : 'rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px' }}>
              🔍
            </div>
            <div>
              <div style={{ fontSize: '14px', fontWeight: 700, color: 'white' }}>
                Google Search Console{' '}
                {integration && (
                  <span style={{ fontSize: '10px', background: 'rgba(74,222,128,0.15)', color: '#4ade80', padding: '2px 8px', borderRadius: 99, marginLeft: 6, verticalAlign: 'middle', fontWeight: 700 }}>{X.connectedBadge}</span>
                )}
              </div>
              <div style={{ fontSize: '12px', color: MUTED }}>
                {integration ? (
                  <span style={{ color: '#4ade80' }}>{X.connectedWord}{integration.domain ? ` · ${integration.domain}` : ''}</span>
                ) : X.notConnected}
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            {integration && (
              <button onClick={loadGscMetrics} disabled={metricsLoading}
                style={{ padding: '8px 16px', background: 'rgba(255,255,255,0.06)', color: MUTED, fontWeight: 600, fontSize: '12px', borderRadius: '8px', border: `1px solid ${BORDER}`, cursor: metricsLoading ? 'not-allowed' : 'pointer' }}>
                {metricsLoading ? X.loading : X.refreshData}
              </button>
            )}
            {companyId && GSC_CLIENT_ID && (
              <>
                <a href={buildGscAuthUrl(companyId)}
                  style={{ padding: '8px 16px', background: integration ? 'rgba(255,255,255,0.04)' : ORANGE, color: integration ? MUTED : '#000', fontWeight: 700, fontSize: '12px', borderRadius: '8px', border: integration ? `1px solid ${BORDER}` : 'none', textDecoration: 'none', cursor: 'pointer', display: 'inline-block' }}>
                  {integration ? X.reconnect : X.connect}
                </a>
                {integration && (
                  <button onClick={handleDisconnectGsc}
                    style={{ padding: '8px 14px', background: 'transparent', color: '#f87171', fontWeight: 600, fontSize: '12px', borderRadius: '8px', border: '1px solid rgba(248,113,113,0.3)', cursor: 'pointer' }}>
                    {X.disconnect}
                  </button>
                )}
              </>
            )}
            {!GSC_CLIENT_ID && (
              <div style={{ fontSize: '12px', color: MUTED, fontStyle: 'italic', padding: '8px' }}>
                Configure VITE_GOOGLE_OAUTH_CLIENT_ID
              </div>
            )}
          </div>
        </div>

        {/* GSC metrics */}
        {metricsError && (
          <div style={{ padding: '16px 24px', background: 'rgba(239,68,68,0.08)', borderTop: `1px solid rgba(239,68,68,0.2)` }}>
            <div style={{ fontSize: '13px', color: '#f87171' }}>{metricsError}</div>
          </div>
        )}

        {metrics && (
          <div style={{ padding: '24px' }}>
            <div style={{ fontSize: '11px', color: MUTED, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '16px' }}>
              {X.last28(metrics.period.start, metrics.period.end)}
            </div>

            {/* Summary */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '28px' }}>
              {[
                { label: X.clicks, value: metrics.summary.clicks.toLocaleString(lang === 'en' ? 'en-US' : 'pt-BR'), color: ORANGE },
                { label: X.impressions, value: metrics.summary.impressions.toLocaleString(lang === 'en' ? 'en-US' : 'pt-BR'), color: '#A78BFA' },
                { label: 'CTR', value: `${metrics.summary.ctr}%`, color: '#4ade80' },
                { label: X.avgPosition, value: String(metrics.summary.position), color: '#FBBF24' },
              ].map(s => (
                <div key={s.label} style={{ background: 'rgba(255,255,255,0.03)', border: `1px solid ${BORDER}`, borderRadius: '10px', padding: '16px' }}>
                  <div style={{ fontSize: '10px', color: MUTED, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '8px' }}>{s.label}</div>
                  <div style={{ fontFamily: D, fontSize: '1.8rem', fontWeight: 800, color: s.color }}>{s.value}</div>
                </div>
              ))}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
              {/* Top queries */}
              <div>
                <div style={{ fontSize: '12px', fontWeight: 600, color: 'white', marginBottom: '12px' }}>{X.topQueries}</div>
                {metrics.top_queries.map((q, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: `1px solid ${BORDER}`, gap: '12px' }}>
                    <div style={{ fontSize: '12px', color: MUTED, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{q.query}</div>
                    <div style={{ display: 'flex', gap: '12px', flexShrink: 0 }}>
                      <span style={{ fontSize: '12px', color: ORANGE }}>{X.clicksN(q.clicks)}</span>
                      <span style={{ fontSize: '12px', color: MUTED }}>P{q.position}</span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Top pages */}
              <div>
                <div style={{ fontSize: '12px', fontWeight: 600, color: 'white', marginBottom: '12px' }}>{X.topPages}</div>
                {metrics.top_pages.map((p, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: `1px solid ${BORDER}`, gap: '12px' }}>
                    <div style={{ fontSize: '12px', color: MUTED, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={p.page}>
                      {p.page.replace(/^https?:\/\/[^/]+/, '') || '/'}
                    </div>
                    <span style={{ fontSize: '12px', color: ORANGE, flexShrink: 0 }}>{X.clicksN(p.clicks)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {!integration && (
          <div style={{ padding: '20px 24px' }}>
            <div style={{ fontSize: '13px', color: MUTED, lineHeight: 1.6 }}>
              {X.gscDesc}
            </div>
          </div>
        )}
      </div>

      {/* Instagram Auto-post (agente 24/7) */}
      <div style={{ background: CARD, border: `1px solid ${igConnected ? 'rgba(74,222,128,0.25)' : BORDER}`, borderRadius: '14px', overflow: 'hidden', marginBottom: '20px' }}>
        <div style={{ padding: '20px 24px', borderBottom: `1px solid ${BORDER}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: igConnected ? 'rgba(74,222,128,0.12)' : 'rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px' }}>🤖</div>
            <div>
              <div style={{ fontSize: '14px', fontWeight: 700, color: 'white' }}>
                Instagram Auto-post{' '}
                {igConnected ? (
                  <span style={{ fontSize: '10px', background: 'rgba(74,222,128,0.15)', color: '#4ade80', padding: '2px 8px', borderRadius: 99, marginLeft: 6, verticalAlign: 'middle', fontWeight: 700 }}>{X.connectedBadge}</span>
                ) : (
                  <span style={{ fontSize: '10px', background: 'rgba(255,109,41,0.15)', color: ORANGE, padding: '2px 8px', borderRadius: 99, marginLeft: 6, verticalAlign: 'middle' }}>{X.igNew}</span>
                )}
              </div>
              <div style={{ fontSize: '12px', color: igConnected ? '#4ade80' : MUTED }}>
                {igConnected
                  ? X.igConnectedLine(igUsername, igAutoPost)
                  : X.igConnectHint}
              </div>
            </div>
          </div>
          {companyId && !igConnected && (
            <a
              href={`${SUPABASE_URL}/functions/v1/instagram-oauth-start?company_id=${companyId}`}
              style={{ padding: '8px 18px', background: ORANGE, color: '#000', fontWeight: 700, fontSize: '12px', borderRadius: '8px', border: 'none', textDecoration: 'none', display: 'inline-block', cursor: 'pointer' }}>
              {X.igConnectBtn}
            </a>
          )}
          {igConnected && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: '12px', color: igAutoPost ? ORANGE : MUTED }}>{igAutoPost ? X.igActive : X.igPaused}</span>
              <div onClick={() => !igTogglingAuto && toggleAutoPost(!igAutoPost)}
                style={{ width: 42, height: 22, borderRadius: 99, cursor: igTogglingAuto ? 'wait' : 'pointer', background: igAutoPost ? ORANGE : 'rgba(255,255,255,0.1)', position: 'relative', transition: 'all 0.2s' }}>
                <div style={{ position: 'absolute', top: 3, left: igAutoPost ? 21 : 3, width: 16, height: 16, borderRadius: '50%', background: igAutoPost ? '#000' : 'rgba(255,255,255,0.4)', transition: 'left 0.2s' }} />
              </div>
            </div>
          )}
        </div>

        {!igConnected && (
          <div style={{ padding: '14px 24px', background: 'rgba(251,191,36,0.06)', borderBottom: `1px solid ${BORDER}` }}>
            <div style={{ fontSize: '12px', fontWeight: 700, color: '#FBBF24', marginBottom: '8px' }}>{X.igBefore}</div>
            <div style={{ display: 'flex', gap: '8px', fontSize: '12.5px', color: 'white', lineHeight: 1.5 }}>
              <span style={{ color: '#FBBF24', flexShrink: 0 }}>•</span>
              <span>{X.igProA}<strong>{X.igProB}</strong>{X.igProC}<strong>{X.igBiz}</strong>{X.igOr}<strong>{X.igCreator}</strong>{X.igProD}</span>
            </div>
            <div style={{ fontSize: '11px', color: MUTED, marginTop: '9px', lineHeight: 1.5 }}>
              {X.igLoginA}<strong>{X.igLoginB}</strong>{X.igLoginC}
            </div>
          </div>
        )}

        {(igOauthSuccess || igOauthError) && (
          <div style={{ padding: '12px 24px', background: igOauthSuccess ? 'rgba(74,222,128,0.06)' : 'rgba(239,68,68,0.08)', fontSize: '12px', color: igOauthSuccess ? '#4ade80' : '#f87171' }}>
            {igOauthSuccess ? X.igSuccess : `${X.errorPrefix}${igOauthError}`}
          </div>
        )}

        {igConnected && (
          <div style={{ padding: '20px 24px' }}>
            <div style={{ fontSize: '12px', color: MUTED, marginBottom: 12 }}>{X.igFreq}</div>
            <div style={{ display: 'flex', gap: 8 }}>
              {X.freqs.map(([val, label]) => (
                <button key={val} onClick={() => updateFrequency(val)}
                  style={{ padding: '7px 14px', borderRadius: 8, border: `1px solid ${igFrequency === val ? ORANGE : BORDER}`, background: igFrequency === val ? 'rgba(255,109,41,0.1)' : 'transparent', color: igFrequency === val ? ORANGE : MUTED, fontSize: '12px', fontWeight: igFrequency === val ? 700 : 400, cursor: 'pointer' }}>
                  {label}
                </button>
              ))}
            </div>
            <div style={{ marginTop: 14, fontSize: '12px', color: MUTED, lineHeight: 1.6 }}>
              {X.igAgentDesc}
            </div>
            {companyId && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginTop: 12 }}>
                <a href={`${SUPABASE_URL}/functions/v1/instagram-oauth-start?company_id=${companyId}`}
                  style={{ fontSize: '11px', color: 'rgba(255,109,41,0.5)', textDecoration: 'none' }}>
                  {X.igReconnect}
                </a>
                <button onClick={handleDisconnectIgOauth}
                  style={{ background: 'transparent', border: 'none', padding: 0, fontSize: '11px', color: 'rgba(248,113,113,0.5)', cursor: 'pointer' }}>
                  {X.disconnect}
                </button>
              </div>
            )}
          </div>
        )}

        {!igConnected && (
          <div style={{ padding: '16px 24px' }}>
            <div style={{ fontSize: '13px', color: MUTED, lineHeight: 1.7 }}>
              {X.igDescDisconnected}
            </div>
          </div>
        )}
      </div>

      {/* WhatsApp Business card — "Conectado" só quando a conexão é REAL
          (phone_number_id salvo). Ter só um número digitado não conta. */}
      <div style={{ background: CARD, border: `1px solid ${waConnected ? 'rgba(74,222,128,0.25)' : BORDER}`, borderRadius: '14px', overflow: 'hidden', marginBottom: '20px' }}>
        <div style={{ padding: '20px 24px', borderBottom: `1px solid ${BORDER}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: waConnected ? 'rgba(74,222,128,0.12)' : 'rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px' }}>💬</div>
            <div>
              <div style={{ fontSize: '14px', fontWeight: 700, color: 'white' }}>
                WhatsApp Business{' '}
                {waConnected && (
                  <span style={{ fontSize: '10px', background: 'rgba(74,222,128,0.15)', color: '#4ade80', padding: '2px 8px', borderRadius: 99, marginLeft: 6, verticalAlign: 'middle', fontWeight: 700 }}>{X.connectedBadge}</span>
                )}
              </div>
              <div style={{ fontSize: '12px', color: waConnected ? '#4ade80' : MUTED }}>
                {waConnected ? `${X.connectedWord} · ${waNumber}` : X.waHint}
              </div>
            </div>
          </div>
          {companyId && (
            <div style={{ display: 'flex', gap: '8px' }}>
              {!isWhatsAppSignupConfigured() ? (
                <span style={{ fontSize: '11px', color: MUTED, fontStyle: 'italic', padding: '8px' }}>{X.waNotConfigured}</span>
              ) : (
                <button onClick={connectWhatsapp} disabled={waSaving}
                  style={{ padding: '8px 18px', background: waConnected ? 'rgba(255,255,255,0.04)' : ORANGE, color: waConnected ? MUTED : '#000', fontWeight: 700, fontSize: '12px', borderRadius: '8px', border: waConnected ? `1px solid ${BORDER}` : 'none', cursor: waSaving ? 'wait' : 'pointer' }}>
                  {waSaving ? X.waConnecting : waConnected ? X.reconnect : X.waConnectBtn}
                </button>
              )}
              {(waConnected || waConnectedAt) && (
                <button onClick={handleDisconnectWhatsapp}
                  style={{ padding: '8px 14px', background: 'transparent', color: '#f87171', fontWeight: 600, fontSize: '12px', borderRadius: '8px', border: '1px solid rgba(248,113,113,0.3)', cursor: 'pointer' }}>
                  {X.disconnect}
                </button>
              )}
            </div>
          )}
        </div>
        {waError && (
          <div style={{ padding: '12px 24px', background: 'rgba(239,68,68,0.08)', fontSize: '12px', color: '#f87171', borderTop: `1px solid ${BORDER}` }}>
            {waError}
          </div>
        )}
        {waSaved && !waError && (
          <div style={{ padding: '12px 24px', background: 'rgba(74,222,128,0.06)', fontSize: '12px', color: '#4ade80', borderTop: `1px solid ${BORDER}` }}>
            {X.waSaved}
          </div>
        )}
        {!waConnected && (
          <div style={{ padding: '0 24px 20px' }}>
            <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.5)', lineHeight: 1.6 }}>
              {X.waDesc}
            </div>

            {/* Conexão manual: pro dono ligar o próprio número hoje, sem depender
                do app ser Tech Provider verificado. */}
            <button onClick={() => setWaManualOpen(o => !o)}
              style={{ marginTop: '12px', background: 'transparent', border: 'none', color: ORANGE, fontSize: '12px', fontWeight: 700, cursor: 'pointer', padding: 0, fontFamily: D }}>
              {waManualOpen ? '▾ ' : '▸ '}{X.waManual}
            </button>

            {waManualOpen && (
              <div style={{ marginTop: '12px', padding: '16px', background: 'rgba(255,255,255,0.02)', border: `1px solid ${BORDER}`, borderRadius: '10px' }}>
                <div style={{ fontSize: '11.5px', color: MUTED, lineHeight: 1.6, marginBottom: '14px' }}>
                  {X.waManualIntroA}<strong style={{ color: 'white' }}>{X.waManualIntroB}</strong>{X.waManualIntroC}<strong style={{ color: 'white' }}>{X.waManualIntroD}</strong>{X.waManualIntroE}
                </div>
                <ManualField label={X.waPhoneIdLabel} placeholder={X.waPhoneIdPh} value={waManualPhoneId} onChange={setWaManualPhoneId} />
                <ManualField label={X.waWabaLabel} placeholder={X.waWabaPh} value={waManualWaba} onChange={setWaManualWaba} />
                <ManualField label={X.waTokenLabel} placeholder={X.waTokenPh} value={waManualToken} onChange={setWaManualToken} secret />
                <button onClick={connectWhatsappManual} disabled={waSaving}
                  style={{ marginTop: '6px', padding: '9px 18px', background: ORANGE, color: '#000', fontWeight: 700, fontSize: '12px', borderRadius: '8px', border: 'none', cursor: waSaving ? 'wait' : 'pointer', fontFamily: D }}>
                  {waSaving ? X.waConnecting : X.waConnectNumber}
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Google Business Profile card */}
      <div style={{ background: CARD, border: `1px solid ${gbpIntegration ? 'rgba(74,222,128,0.25)' : BORDER}`, borderRadius: '14px', overflow: 'hidden', marginBottom: '20px' }}>
        <div style={{ padding: '20px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: gbpIntegration ? 'rgba(74,222,128,0.12)' : 'rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px' }}>⭐</div>
            <div>
              <div style={{ fontSize: '14px', fontWeight: 700, color: 'white' }}>
                Google Business Profile{' '}
                {gbpIntegration && (
                  <span style={{ fontSize: '10px', background: 'rgba(74,222,128,0.15)', color: '#4ade80', padding: '2px 8px', borderRadius: 99, marginLeft: 6, verticalAlign: 'middle', fontWeight: 700 }}>{X.connectedBadge}</span>
                )}
              </div>
              <div style={{ fontSize: '12px', color: gbpIntegration ? '#4ade80' : MUTED }}>
                {gbpIntegration
                  ? `${X.connectedWord}${gbpIntegration.domain ? ` · ${gbpIntegration.domain}` : ''}`
                  : X.gbpHint}
              </div>
            </div>
          </div>
          {companyId && (import.meta.env.VITE_GOOGLE_OAUTH_CLIENT_ID as string) && (
            <div style={{ display: 'flex', gap: '8px' }}>
              <a
                href={buildGbpAuthUrl(companyId)}
                style={{ padding: '8px 16px', background: gbpIntegration ? 'rgba(255,255,255,0.04)' : ORANGE, color: gbpIntegration ? MUTED : '#000', fontWeight: 700, fontSize: '12px', borderRadius: '8px', border: gbpIntegration ? `1px solid ${BORDER}` : 'none', textDecoration: 'none', display: 'inline-block', cursor: 'pointer' }}
              >
                {gbpIntegration ? X.reconnect : X.connect}
              </a>
              {gbpIntegration && (
                <button onClick={handleDisconnectGbp}
                  style={{ padding: '8px 14px', background: 'transparent', color: '#f87171', fontWeight: 600, fontSize: '12px', borderRadius: '8px', border: '1px solid rgba(248,113,113,0.3)', cursor: 'pointer' }}>
                  {X.disconnect}
                </button>
              )}
            </div>
          )}
        </div>
        {!gbpIntegration && (
          <div style={{ padding: '0 24px 20px' }}>
            <div style={{ fontSize: '13px', color: MUTED, lineHeight: 1.6 }}>
              {X.gbpDesc}
            </div>
          </div>
        )}
        {gbpIntegration && (
          <div style={{ padding: '12px 24px', background: 'rgba(74,222,128,0.04)', borderTop: `1px solid ${BORDER}` }}>
            <div style={{ fontSize: '12px', color: MUTED }}>
              {X.gbpActiveA}<strong style={{ color: 'white' }}>{X.gbpActiveB}</strong>{X.gbpActiveC}{new Date(gbpIntegration.connected_at!).toLocaleDateString(lang === 'en' ? 'en-US' : 'pt-BR')}.
            </div>
          </div>
        )}
      </div>

      {/* Meta Ads card */}
      <div style={{ background: CARD, border: `1px solid ${metaAdsAccount ? 'rgba(255,109,41,0.25)' : BORDER}`, borderRadius: '14px', overflow: 'hidden', marginBottom: '20px' }}>
        <div style={{ padding: '20px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: metaAdsAccount ? 'rgba(255,109,41,0.12)' : 'rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px' }}>🎯</div>
            <div>
              <div style={{ fontSize: '14px', fontWeight: 700, color: 'white' }}>Meta Ads Manager</div>
              <div style={{ fontSize: '12px', color: metaAdsAccount ? '#4ade80' : MUTED }}>
                {metaAdsAccount ? X.adsConnectedLine(metaAdsAccount.name) : X.adsHint}
              </div>
            </div>
          </div>
          {companyId && (
            <div style={{ display: 'flex', gap: '8px' }}>
              <a href={`${SUPABASE_URL}/functions/v1/meta-ads-oauth-start?company_id=${companyId}`}
                style={{ padding: '8px 16px', background: metaAdsAccount ? 'rgba(255,255,255,0.04)' : ORANGE, color: metaAdsAccount ? MUTED : '#000', fontWeight: 700, fontSize: '12px', borderRadius: '8px', border: metaAdsAccount ? `1px solid ${BORDER}` : 'none', textDecoration: 'none', display: 'inline-block', cursor: 'pointer' }}>
                {metaAdsAccount ? X.reconnect : X.connect}
              </a>
              {metaAdsAccount && (
                <button onClick={handleDisconnectMetaAds}
                  style={{ padding: '8px 14px', background: 'transparent', color: '#f87171', fontWeight: 600, fontSize: '12px', borderRadius: '8px', border: '1px solid rgba(248,113,113,0.3)', cursor: 'pointer' }}>
                  {X.disconnect}
                </button>
              )}
            </div>
          )}
        </div>
        {(metaAdsSuccess || igOauthError) && !metaAdsAccount && (
          <div style={{ padding: '12px 24px', background: metaAdsSuccess ? 'rgba(74,222,128,0.06)' : 'rgba(239,68,68,0.08)', fontSize: '12px', color: metaAdsSuccess ? '#4ade80' : '#f87171', borderTop: `1px solid ${BORDER}` }}>
            {metaAdsSuccess ? X.adsSuccess : `${X.errorPrefix}${igOauthError}`}
          </div>
        )}
        {!metaAdsAccount && (
          <div style={{ padding: '0 24px 18px' }}>
            <div style={{ fontSize: '12.5px', color: MUTED, lineHeight: 1.6 }}>
              {X.adsDescA}<strong style={{ color: 'white' }}>{X.adsDescB}</strong>{X.adsDescC}<strong style={{ color: 'white' }}>{X.adsDescD}</strong>{X.adsDescE}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// Campo de texto usado no formulário de conexão manual do WhatsApp.
function ManualField({ label, placeholder, value, onChange, secret }: { label: string; placeholder: string; value: string; onChange: (v: string) => void; secret?: boolean }) {
  return (
    <div style={{ marginBottom: '12px' }}>
      <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: MUTED, marginBottom: '5px' }}>{label}</label>
      <input
        type={secret ? 'password' : 'text'}
        value={value}
        placeholder={placeholder}
        onChange={e => onChange(e.target.value)}
        autoComplete="off"
        spellCheck={false}
        style={{ width: '100%', boxSizing: 'border-box', padding: '9px 12px', background: '#0E0B0A', border: `1px solid ${BORDER}`, borderRadius: '8px', color: 'white', fontSize: '12.5px', fontFamily: D, outline: 'none' }}
      />
    </div>
  )
}
