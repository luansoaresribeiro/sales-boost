import { StrictMode, Suspense } from 'react'
import { createRoot } from 'react-dom/client'
import { LanguageProvider, useLang } from './contexts/LanguageContext'
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import './lib/analytics' // inicializa o PostHog antes da app renderizar
import './lib/facebookSdk' // carrega o Facebook SDK (JS) — exigência da Meta
import './index.css'
import ErrorBoundary from './components/ErrorBoundary.tsx'
import { AuthProvider } from './contexts/AuthContext.tsx'
import { useAuth } from './contexts/AuthContext.tsx'
import { CompanyProvider, useCompany } from './contexts/CompanyContext.tsx'
import { isShowcaseMode } from './lib/setupGate.ts'
import CookieConsent from './components/CookieConsent.tsx'
import BrandLoader from './components/BrandLoader.tsx'
import { lazyPage } from './lib/lazyPage.ts'

// Cada página baixa só quando é aberta (ver src/lib/lazyPage.ts). O grupo "dashboard" é pré-baixado com o painel aberto.
const App = lazyPage(() => import('./App.tsx'))
const LoginPage = lazyPage(() => import('./pages/auth/LoginPage.tsx'))
const SignupPage = lazyPage(() => import('./pages/auth/SignupPage.tsx'))
const ForgotPasswordPage = lazyPage(() => import('./pages/auth/PasswordPages.tsx').then(m => ({ default: m.ForgotPasswordPage })))
const ResetPasswordPage = lazyPage(() => import('./pages/auth/PasswordPages.tsx').then(m => ({ default: m.ResetPasswordPage })))
const GscCallbackPage = lazyPage(() => import('./pages/auth/GscCallbackPage.tsx'))
const GbpCallbackPage = lazyPage(() => import('./pages/auth/GbpCallbackPage.tsx'))
const DashboardLayout = lazyPage(() => import('./pages/dashboard/DashboardLayout.tsx'))
const ReportsPage = lazyPage(() => import('./pages/dashboard/ReportsPage.tsx'), 'dashboard')
const DiagnosticsPage = lazyPage(() => import('./pages/dashboard/DiagnosticsPage.tsx'), 'dashboard')
const InsightsPage = lazyPage(() => import('./pages/dashboard/InsightsPage.tsx'), 'dashboard')
const SettingsPage = lazyPage(() => import('./pages/dashboard/SettingsPage.tsx'), 'dashboard')
const OpportunitiesPage = lazyPage(() => import('./pages/dashboard/OpportunitiesPage.tsx'), 'dashboard')
const GrowthOpportunitiesPage = lazyPage(() => import('./pages/dashboard/GrowthOpportunitiesPage.tsx'), 'dashboard')
const MarketingAiHubPage = lazyPage(() => import('./pages/dashboard/MarketingAiHubPage.tsx'), 'dashboard')
const AgentsPage = lazyPage(() => import('./pages/dashboard/AgentsPage.tsx'), 'dashboard')
const CatalogPage = lazyPage(() => import('./pages/dashboard/CatalogPage.tsx'), 'dashboard')
const TourVirtualPage = lazyPage(() => import('./pages/dashboard/TourVirtualPage.tsx'), 'dashboard')
const BusinessProgressPage = lazyPage(() => import('./pages/dashboard/BusinessProgressPage.tsx'), 'dashboard')
const TrialSummaryPage = lazyPage(() => import('./pages/dashboard/TrialSummaryPage.tsx'), 'dashboard')
const AccessBlockedPage = lazyPage(() => import('./pages/dashboard/AccessBlockedPage.tsx'), 'dashboard')
const MarketingAiSectionPage = lazyPage(() => import('./pages/dashboard/MarketingAiSectionPage.tsx'), 'dashboard')
const ApprovalsPage = lazyPage(() => import('./pages/dashboard/ApprovalsPage.tsx'), 'dashboard')
const ReportPage = lazyPage(() => import('./pages/dashboard/ReportPage.tsx'), 'dashboard')
const OwnerPage = lazyPage(() => import('./pages/owner/OwnerPage.tsx'))
const CompanyDetailPage = lazyPage(() => import('./pages/owner/CompanyDetailPage.tsx'))
const ProspectsPage = lazyPage(() => import('./pages/owner/ProspectsPage.tsx'))
const LeadDiscoverySettingsPage = lazyPage(() => import('./pages/owner/LeadDiscoverySettingsPage.tsx'))
const OwnerSettingsPage = lazyPage(() => import('./pages/owner/OwnerSettingsPage.tsx'))
const PlatformHealthPage = lazyPage(() => import('./pages/owner/PlatformHealthPage.tsx'))
const FreePage = lazyPage(() => import('./pages/free/FreePage.tsx'))
const OnboardingPage = lazyPage(() => import('./pages/onboarding/OnboardingPage.tsx'))
const DiagnosticoPage = lazyPage(() => import('./pages/diagnostico/DiagnosticoPage.tsx'))
const PrivacyPolicyPage = lazyPage(() => import('./pages/legal/PrivacyPolicyPage.tsx'))
const TermsOfUsePage = lazyPage(() => import('./pages/legal/TermsOfUsePage.tsx'))
const PublicPropertyPage = lazyPage(() => import('./pages/public/PublicPropertyPage.tsx'))

// Carregamento de tela cheia com o logo (antes: bolinha girando sem marca).
const Spinner = () => <BrandLoader fullScreen />

const LoadRetry = ({ onRetry }: { onRetry: () => void }) => {
  const en = useLang().lang === 'en'
  return (
  <div style={{ minHeight: '100vh', background: '#0E0B0A', display: 'flex', flexDirection: 'column', gap: '14px', alignItems: 'center', justifyContent: 'center', padding: '16px', textAlign: 'center', fontFamily: "'Bricolage Grotesque', system-ui, sans-serif" }}>
    <div style={{ color: 'white', fontSize: '15px', fontWeight: 700 }}>{en ? 'We could not load your account right now.' : 'Não foi possível carregar sua conta agora.'}</div>
    <div style={{ color: '#BABABA', fontSize: '13px' }}>{en ? 'Check your internet connection and try again.' : 'Verifique sua internet e tente de novo.'}</div>
    <button onClick={onRetry} style={{ padding: '10px 20px', background: '#FF6D29', color: '#000', fontWeight: 700, fontSize: '13px', border: 'none', borderRadius: '9px', cursor: 'pointer' }}>{en ? 'Try again' : 'Tentar de novo'}</button>
  </div>
  )
}

// Página inicial do dashboard: cai no Marketing AI (agente principal). Se o
// owner desligou o Marketing AI dessa empresa, cai em Relatórios (que inclui o histórico de atividades).
function DashboardIndex() {
  const { company, loading } = useCompany()
  if (loading) return <Spinner />
  return <Navigate to={company?.marketing_ai_enabled === false ? '/dashboard/relatorios' : '/dashboard/marketing-ai'} replace />
}

function ClientRoute({ children }: { children: React.ReactNode }) {
  const { user, role, loading } = useAuth()
  const { company, access, loading: companyLoading, loadError, refreshCompany } = useCompany()
  const location = useLocation()
  if (loading) return <Spinner />
  if (!user) return <Navigate to="/login" replace />
  if (role === 'owner') return <Navigate to="/owner" replace />
  if (companyLoading) return <Spinner />
  // Busca falhou (rede) e ainda não temos a empresa: nunca mandar pro
  // onboarding por causa disso — deixa tentar de novo.
  if (loadError && !company) return <LoadRetry onRetry={refreshCompany} />
  // Every client account must have a business profile — this is the one
  // place that gate is enforced, so it can't be skipped regardless of how
  // the account was created (signup, magic link, abandoned onboarding...).
  if (!company) return <Navigate to="/onboarding" replace />
  // Acesso negado — mesma função central (company_access_status) que o
  // botão Liberar/Bloquear do Owner usa, então os dois nunca discordam.
  // access===null só acontece enquanto ainda está carregando (companyLoading
  // já cobre isso) ou se a chamada falhou — nesse caso não bloqueia (falha
  // aberta), pra um erro de rede não trancar um cliente de verdade fora.
  // Conta nova que ainda não pagou ("modo vitrine", decisão do dono 2026-10-13):
  // NÃO é mais presa em /gratis — navega por todo o painel em "somente
  // visualização" (ShowcaseContext) e o servidor barra o que gasta/publica
  // (_shared/access.ts). /gratis segue existindo (página dos planos; o kit grátis acabou em 2026-10-17). O /setup
  // saiu em 2026-10-19 (o sino cobra o que falta). Leva o ?query junto (ex.: volta do checkout).
  if (isShowcaseMode(company, access)) {
    // Volta do checkout: a página /gratis espera o pagamento ser confirmado (a conta
    // ainda aparece como vitrine por alguns segundos) e depois leva pro painel.
    if (new URLSearchParams(location.search).get('upgrade') === 'success' && location.pathname !== '/gratis') {
      return <Navigate to={`/gratis${location.search}`} replace />
    }
    // Telas de teste/bloqueio não existem pra quem está em vitrine.
    if (location.pathname.startsWith('/dashboard/trial') || location.pathname.startsWith('/dashboard/access-blocked')) {
      return <Navigate to="/dashboard" replace />
    }
    return <>{children}</>
  }
  // Quem NÃO é vitrine (antiga, paga, liberada, bloqueada) não tem o que fazer
  // em /gratis — volta pro painel.
  if (location.pathname === '/gratis') return <Navigate to={`/dashboard${location.search}`} replace />
  const exempt = location.pathname.startsWith('/dashboard/trial') || location.pathname.startsWith('/dashboard/settings') || location.pathname.startsWith('/dashboard/access-blocked')
  if (access && !access.granted && !exempt) {
    return <Navigate to={access.source === 'blocked' ? '/dashboard/access-blocked' : '/dashboard/trial'} replace />
  }
  return <>{children}</>
}

function OwnerRoute({ children }: { children: React.ReactNode }) {
  const { user, role, loading } = useAuth()
  if (loading) return <Spinner />
  if (!user) return <Navigate to="/login" replace />
  if (role !== 'owner') return <Navigate to="/dashboard" replace />
  return <>{children}</>
}

function RouterRoot() {
  return (
    <Routes>
      <Route path="/" element={<App />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/signup" element={<SignupPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />
      <Route path="/auth/gsc/callback" element={<GscCallbackPage />} />
      <Route path="/auth/gbp/callback" element={<GbpCallbackPage />} />

      {/* Owner-only */}
      <Route path="/owner" element={<OwnerRoute><OwnerPage /></OwnerRoute>} />
      <Route path="/owner/company/:id" element={<OwnerRoute><CompanyDetailPage /></OwnerRoute>} />
      <Route path="/owner/prospects" element={<OwnerRoute><ProspectsPage /></OwnerRoute>} />
      <Route path="/owner/prospects/settings" element={<OwnerRoute><LeadDiscoverySettingsPage /></OwnerRoute>} />
      <Route path="/owner/settings" element={<OwnerRoute><OwnerSettingsPage /></OwnerRoute>} />
      <Route path="/owner/health" element={<OwnerRoute><PlatformHealthPage /></OwnerRoute>} />

      {/* Client dashboard */}
      <Route
        path="/dashboard"
        element={
          <ClientRoute>
            <DashboardLayout />
          </ClientRoute>
        }
      >
        <Route index element={<DashboardIndex />} />
        {/* Relatórios (07/11): relatórios em destaque + histórico de atividades. A rota antiga redireciona. */}
        <Route path="relatorios" element={<ReportsPage />} />
        <Route path="atividades" element={<Navigate to="/dashboard/relatorios" replace />} />
        <Route path="diagnostico" element={<DiagnosticsPage />} />
        <Route path="insights" element={<InsightsPage />} />
        <Route path="integrations" element={<Navigate to="/dashboard/marketing-ai/conexoes" replace />} />
        {/* Agente Geral removido — rotas antigas redirecionam pro Marketing AI. */}
        <Route path="posts/*" element={<Navigate to="/dashboard/marketing-ai" replace />} />
        <Route path="agente" element={<Navigate to="/dashboard/marketing-ai" replace />} />
        <Route path="marketing-ai" element={<MarketingAiHubPage />} />
        {/* Aba Agentes (C.2): fábrica 3D (carregada à parte) + cartões dos 5 agentes. */}
        <Route path="agentes" element={<AgentsPage />} />
        {/* Catálogo (imóveis/itens): página própria, aberta pelo botão "+" (2026-11-01). */}
        <Route path="catalogo" element={<CatalogPage />} />
        <Route path="tour-virtual" element={<TourVirtualPage />} />
        <Route path="marketing-ai/:section" element={<MarketingAiSectionPage />} />
        <Route path="meta-ads" element={<Navigate to="/dashboard/marketing-ai/content?tab=campanha" replace />} />
        <Route path="progresso" element={<BusinessProgressPage />} />
        <Route path="trial" element={<TrialSummaryPage />} />
        <Route path="access-blocked" element={<AccessBlockedPage />} />
        <Route path="oportunidades" element={<OpportunitiesPage />} />
        {/* Inteligência comercial (2026-10-28): tabela growth_opportunities — outra coisa que a /oportunidades acima. */}
        <Route path="opportunities" element={<GrowthOpportunitiesPage />} />
        <Route path="concorrentes" element={<Navigate to="/dashboard/marketing-ai/dados" replace />} />
        <Route path="aprovacoes" element={<ApprovalsPage />} />
        <Route path="relatorio" element={<ReportPage />} />
        <Route path="settings" element={<SettingsPage />} />
      </Route>

      {/* Fim do cadastro: atrás do login, fora do DashboardLayout */}
      {/* /setup saiu (decisão do dono 2026-10-19): o que falta fica em Configurações e o sino cobra. Link antigo cai lá. */}
      <Route path="/setup" element={<Navigate to="/dashboard/settings?section=entendimento" replace />} />
      {/* Conta nova antes de pagar: só os vídeos grátis + plano/cupom */}
      <Route path="/gratis" element={<ClientRoute><FreePage /></ClientRoute>} />
      <Route path="/onboarding" element={<OnboardingPage />} />
      <Route path="/diagnostico" element={<OnboardingPage />} />
      <Route path="/diagnostico/:id" element={<DiagnosticoPage />} />
      <Route path="/privacidade" element={<PrivacyPolicyPage />} />
      <Route path="/termos" element={<TermsOfUsePage />} />
      {/* Etapa 5: página pública do imóvel — destino de link, sem login, noindex (fora do ClientRoute de propósito). */}
      <Route path="/p/:code" element={<PublicPropertyPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

// Erro ao desenhar qualquer página mostra a mensagem (em vez de tela preta); trocar de rota limpa o erro.
function SafeRoutes() {
  const location = useLocation()
  return <ErrorBoundary resetKey={location.pathname}><Suspense fallback={<Spinner />}><RouterRoot /></Suspense></ErrorBoundary>
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      {/* Idioma (PT/EN) vale pro site inteiro: landing, login, cadastro e painel. */}
      <LanguageProvider>
      <AuthProvider>
        <CompanyProvider>
          <SafeRoutes />
          <CookieConsent />
        </CompanyProvider>
      </AuthProvider>
      </LanguageProvider>
    </BrowserRouter>
  </StrictMode>,
)
