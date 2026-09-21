import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import './lib/analytics' // inicializa o PostHog antes da app renderizar
import './lib/facebookSdk' // carrega o Facebook SDK (JS) — exigência da Meta
import './index.css'
import App from './App.tsx'
import { AuthProvider } from './contexts/AuthContext.tsx'
import { useAuth } from './contexts/AuthContext.tsx'
import { CompanyProvider, useCompany } from './contexts/CompanyContext.tsx'
import LoginPage from './pages/auth/LoginPage.tsx'
import SignupPage from './pages/auth/SignupPage.tsx'
import GscCallbackPage from './pages/auth/GscCallbackPage.tsx'
import GbpCallbackPage from './pages/auth/GbpCallbackPage.tsx'
import DashboardLayout from './pages/dashboard/DashboardLayout.tsx'
import ActivityPage from './pages/dashboard/ActivityPage.tsx'
import DiagnosticsPage from './pages/dashboard/DiagnosticsPage.tsx'
import InsightsPage from './pages/dashboard/InsightsPage.tsx'
import SettingsPage from './pages/dashboard/SettingsPage.tsx'
import OpportunitiesPage from './pages/dashboard/OpportunitiesPage.tsx'
import MarketingAiHubPage from './pages/dashboard/MarketingAiHubPage.tsx'
import BusinessProgressPage from './pages/dashboard/BusinessProgressPage.tsx'
import TrialSummaryPage from './pages/dashboard/TrialSummaryPage.tsx'
import AccessBlockedPage from './pages/dashboard/AccessBlockedPage.tsx'
import MarketingAiSectionPage from './pages/dashboard/MarketingAiSectionPage.tsx'
import ApprovalsPage from './pages/dashboard/ApprovalsPage.tsx'
import ReportPage from './pages/dashboard/ReportPage.tsx'
import OwnerPage from './pages/owner/OwnerPage.tsx'
import CompanyDetailPage from './pages/owner/CompanyDetailPage.tsx'
import ProspectsPage from './pages/owner/ProspectsPage.tsx'
import LeadDiscoverySettingsPage from './pages/owner/LeadDiscoverySettingsPage.tsx'
import OwnerSettingsPage from './pages/owner/OwnerSettingsPage.tsx'
import PlatformHealthPage from './pages/owner/PlatformHealthPage.tsx'
import OnboardingPage from './pages/onboarding/OnboardingPage.tsx'
import DiagnosticoPage from './pages/diagnostico/DiagnosticoPage.tsx'
import PrivacyPolicyPage from './pages/legal/PrivacyPolicyPage.tsx'
import TermsOfUsePage from './pages/legal/TermsOfUsePage.tsx'
import CookieConsent from './components/CookieConsent.tsx'

const Spinner = () => (
  <div style={{ minHeight: '100vh', background: '#0E0B0A', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
    <div style={{ width: '32px', height: '32px', border: '3px solid rgba(255,109,41,0.2)', borderTopColor: '#FF6D29', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
    <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
  </div>
)

// Página inicial do dashboard: cai no Marketing AI (agente principal). Se o
// owner desligou o Marketing AI dessa empresa, cai em Atividades.
function DashboardIndex() {
  const { company, loading } = useCompany()
  if (loading) return <Spinner />
  return <Navigate to={company?.marketing_ai_enabled === false ? '/dashboard/atividades' : '/dashboard/marketing-ai'} replace />
}

function ClientRoute({ children }: { children: React.ReactNode }) {
  const { user, role, loading } = useAuth()
  const { company, access, loading: companyLoading } = useCompany()
  const location = useLocation()
  if (loading) return <Spinner />
  if (!user) return <Navigate to="/login" replace />
  if (role === 'owner') return <Navigate to="/owner" replace />
  if (companyLoading) return <Spinner />
  // Every client account must have a business profile — this is the one
  // place that gate is enforced, so it can't be skipped regardless of how
  // the account was created (signup, magic link, abandoned onboarding...).
  if (!company) return <Navigate to="/onboarding" replace />
  // Acesso negado — mesma função central (company_access_status) que o
  // botão Liberar/Bloquear do Owner usa, então os dois nunca discordam.
  // access===null só acontece enquanto ainda está carregando (companyLoading
  // já cobre isso) ou se a chamada falhou — nesse caso não bloqueia (falha
  // aberta), pra um erro de rede não trancar um cliente de verdade fora.
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
        <Route path="atividades" element={<ActivityPage />} />
        <Route path="diagnostico" element={<DiagnosticsPage />} />
        <Route path="insights" element={<InsightsPage />} />
        <Route path="integrations" element={<Navigate to="/dashboard/marketing-ai/conexoes" replace />} />
        {/* Agente Geral removido — rotas antigas redirecionam pro Marketing AI. */}
        <Route path="posts/*" element={<Navigate to="/dashboard/marketing-ai" replace />} />
        <Route path="agente" element={<Navigate to="/dashboard/marketing-ai" replace />} />
        <Route path="marketing-ai" element={<MarketingAiHubPage />} />
        <Route path="marketing-ai/:section" element={<MarketingAiSectionPage />} />
        <Route path="meta-ads" element={<Navigate to="/dashboard/marketing-ai/content?tab=campanha" replace />} />
        <Route path="progresso" element={<BusinessProgressPage />} />
        <Route path="trial" element={<TrialSummaryPage />} />
        <Route path="access-blocked" element={<AccessBlockedPage />} />
        <Route path="oportunidades" element={<OpportunitiesPage />} />
        <Route path="concorrentes" element={<Navigate to="/dashboard/marketing-ai/dados" replace />} />
        <Route path="aprovacoes" element={<ApprovalsPage />} />
        <Route path="relatorio" element={<ReportPage />} />
        <Route path="settings" element={<SettingsPage />} />
      </Route>

      <Route path="/onboarding" element={<OnboardingPage />} />
      <Route path="/diagnostico/:id" element={<DiagnosticoPage />} />
      <Route path="/privacidade" element={<PrivacyPolicyPage />} />
      <Route path="/termos" element={<TermsOfUsePage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <CompanyProvider>
          <RouterRoot />
          <CookieConsent />
        </CompanyProvider>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
)
