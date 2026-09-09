# SalesBoost — DATA MAP

> Read-only audit of **where the platform currently gets its data**. No behavior
> was changed to produce this document. "Confirmed" = read in the code;
> "Inferred" = deduced from import/usage patterns without reading every line.
>
> Source of truth: the existing codebase, Supabase schema, and Edge Functions as
> of this audit. Date: 2026-09-09.

---

## A. COMPLETE PLATFORM MAP (routes → what it shows)

Router: `src/main.tsx`.

### Client dashboard (`/dashboard/*`)
| Route | Page/Component | Purpose (as built) |
|-------|----------------|--------------------|
| `/dashboard` (index) | `DashboardIndex` → redirect | Sends to `/dashboard/marketing-ai` (or `/dashboard/atividades` if `marketing_ai_enabled === false`). |
| `/dashboard/marketing-ai` | `MarketingAiHubPage` | **Growth OS hub** — command center + agent cards. |
| `/dashboard/marketing-ai/:section` | `MarketingAiSectionPage` | Routes to the section tabs below. |
| `/dashboard/atividades` | `ActivityPage` | Bot activity feed. |
| `/dashboard/diagnostico` | `DiagnosticsPage` | Site diagnosis (PageSpeed + link health). |
| `/dashboard/insights` | `InsightsPage` | External opportunities. |
| `/dashboard/progresso` | `BusinessProgressPage` | "Business game" progress. |
| `/dashboard/trial` | `TrialSummaryPage` | Trial/billing. |
| `/dashboard/oportunidades` | `OpportunitiesPage` | Revenue opportunities. |
| `/dashboard/aprovacoes` | `ApprovalsPage` | Central de Approvals (`agent_actions`). |
| `/dashboard/relatorio` | `ReportPage` | Monthly report. |
| `/dashboard/settings` | `SettingsPage` | Settings, Connections, Agents, Context. |

### Marketing-AI sections (`MarketingAiSectionPage` switch)
| Section | Component | Data source (summary) |
|---------|-----------|-----------------------|
| `overview` | `OverviewSection` (in-file) | REAL via `useMarketingAiData` (marketing_ai_* tables). |
| `tracking` | `TrackingTab` | REAL (`data.snapshots`). |
| `content` | `ContentSection` → tabs | Mixed (see ContentSection block). |
| `competitors` | `MarketIntelTab` | **DEMO only** (`buildMarketDemo`). |
| `brain` | `BrainTab` | REAL (`data.brainNodes`). |
| `experiments` | `ExperimentsTab` | REAL (`data.experiments`). |
| `tools` | `ToolsTab` | REAL (`data.toolRegistry/Configs`). |
| `timeline` | `TimelineTab` | REAL (`data.activity`). |
| `reports` | `ReportsTab` | REAL (`data.reports`). |
| `meta-ads` | `MetaAdsTab` | REAL fetch **with SILENT DEMO fallback** ⚠️. |
| `funil` | `FunnelTab` | REAL (`leads`) + demo fallback (labeled). |
| `whatsapp` | `WhatsAppTab` | REAL (`whatsapp_conversations`) + demo fallback (labeled). |
| `feedback` | `FeedbackLoopTab` | **DEMO only** (`buildIcpDemo`/`buildFeedbackDemo`). |
| `avaliacoes` | `ReviewsAgentTab` | REAL (`reviews`). |
| `insights` | `InsightsTab` | REAL (`external_insights`) + demo fallback (labeled). |
| `saude-meta` | `MetaHealthTab` | **DEMO only** (`buildMetaHealthDemo`). |
| `conexoes`/`context`/`configuracao` | → redirect to Settings | — |

### ContentSection sub-tabs (`ContentSection.tsx`)
| Sub-tab | Component | Data source |
|---------|-----------|-------------|
| Conteúdo → Orgânico | `ContentAgentTab` | **DEMO only** (`buildContentDemo`) — confirmed no supabase refs. |
| Conteúdo → Campanhas | `CampaignsTab` | **DEMO only** (`buildCampaignDemo`). |
| Conteúdo → Stories | `StoriesTab` | **DEMO only** (`buildStoriesDemo`). |
| Vault | `ContentVault` | REAL (supabase reads). |
| Biblioteca | `ContentLibrary` | Static library content (frameworks/hooks) — by design. |
| Performance | `PerformanceTab` | REAL (`instagram-performance`) — **policy-compliant** ✅. |
| Engagement | `EngagementTab` | REAL (`engagement_automations`/`engagement_events`) + demo examples (labeled). |

### Owner console (`/owner/*`)
`OwnerPage`, `CompanyDetailPage`, `ProspectsPage`, `HermesControlCenterPage`,
`AgentsControlCenterPage`, `PlatformHealthPage`, etc. — not the focus of this
audit; spot-check shows these read real owner/admin tables and edge functions.
(Marked **not fully audited** here.)

---

## B. DATA SOURCE MAP (per data element)

### 🟢 Reads REAL data (no fake fallback)
| UI area | Displays | Source table / function | Notes |
|---------|----------|-------------------------|-------|
| Hub `overview` / `tracking` / `brain` / `experiments` / `tools` / `timeline` / `reports` | content, snapshots, insights, brain nodes, experiments, tools, activity, reports | `useMarketingAiData` → `marketing_ai_*` tables | Empty arrays when empty (no fake). ✅ Realtime on 7 tables. |
| Performance (IG) | score, reach, engagement, per-post insights | `instagram-performance` edge fn → IG Graph | Distinguishes connected/expired/error; empty state when not connected + demo off. ✅ |
| Avaliações | reviews, sentiment | `reviews` table (`ReviewsAgentTab`) | Real. |
| Oportunidades | opportunities | `opportunities` table + `detect-opportunities` | Real. |
| Diagnóstico | PageSpeed, link health | `diagnostics` + `check-links-health` | Real. |
| Insights (page + tab) | external opportunities | `external_insights` + `insights-collect` | Tab has labeled demo fallback when empty. |
| Concorrentes (page) | competitors | `marketing_ai_competitors` + `map-competitors` | `CompetitorsPage` real (12 refs). |
| Audiência | social profile data | `companies.social_data` + `apify-sync` | Real (Apify scrape). |
| Funil | leads pipeline | `leads` table | + labeled demo fallback when empty. |
| Atendimento | WhatsApp conversations | `whatsapp_conversations` + `whatsapp_conversation_messages` | + labeled demo fallback when empty. |
| Engagement | automations, events | `engagement_automations`, `engagement_events` | + labeled demo examples when empty. |
| Aprovações | agent actions | `agent_actions` + `agent-actions` fn | Real, realtime. |
| Configurações → Conexões | integration status | `integrations` / `companies.*` columns | Real connection flags. |

### 🟡 / 🔵 Shows DEMO (see audit doc for policy classification)
| UI area | Displays | Demo builder | Reads real? |
|---------|----------|--------------|-------------|
| Growth OS command center (hub) | revenue, ROAS, funnel KPIs | `buildGrowthDemo` | No — gated by `useDemoMode` (default **ON**). |
| Inteligência de Mercado (`competitors` section) | market/competitor cards | `buildMarketDemo` | **No real read** — pure demo. |
| Saúde da Meta | 0–100 Meta score | `buildMetaHealthDemo` | **No real read** — pure demo. |
| Feedback Loop | ICP profile, signals | `buildIcpDemo`/`buildFeedbackDemo` | **No real read** — pure demo. |
| Conteúdo → Orgânico | calendar/ideas | `buildContentDemo` | **No real read** — pure demo. |
| Conteúdo → Campanhas | paid funnel | `buildCampaignDemo` | **No real read** — pure demo. |
| Conteúdo → Stories | stories/story ads | `buildStoriesDemo` | **No real read** — pure demo. |
| Meta Ads | spend/ROAS/CTR/campaigns | `buildMetaAdsDemo` | Fetches real, **silently falls back to demo** ⚠️. |

---

## C. DEMO MODE — how it currently works

- **Definition:** `useDemoMode(companyId)` in `growthDemo.ts`.
- **Storage:** `localStorage` key `sb_growth_demo_<companyId>` (per browser, per company).
- **Default:** **ON** (`stored == null ? true`). A brand-new user starts in demo.
- **Who honors the toggle:** only **`MarketingAiHubPage`** (command center) and
  **`PerformanceTab`**. Every other demo tab ignores the toggle and shows demo
  regardless.
- **Label:** the hub has a "Modo demonstração" checkbox; PerformanceTab shows a
  labeled amber banner. Most other demo tabs show their own "Modo demonstração"
  banner text, but it is **not tied** to the actual toggle.

---

## D. INTEGRATION / PERMISSION MAP

| Integration | Connect mechanism | Stored on | Required scopes/keys | Real data function | UI consuming it | Error/empty handling |
|-------------|-------------------|-----------|----------------------|--------------------|-----------------|----------------------|
| **Instagram (Business Login)** | `instagram-oauth-start`/`-callback` | `companies.instagram_user_id`, `instagram_access_token`, `instagram_token_expires_at` | `instagram_business_basic`, `_content_publish`, `_manage_comments`, `_manage_messages`, `_manage_insights` | `instagram-performance`, `publish-instagram`, `instagram-webhook` | PerformanceTab (real), EngagementTab (webhook), AudienciaTab (via Apify, not Graph) | `instagram-performance` returns `{connected:false}` / `{expired:true}` / `{connected:true,error}` ✅ |
| **WhatsApp Cloud API** | `whatsapp-embedded-signup` (Tech Provider) **or** `whatsapp-manual-connect` (own number) | `companies.whatsapp_phone_number_id`, `whatsapp_business_account_id`, `whatsapp_access_token`, ... | `whatsapp_business_messaging`, `whatsapp_business_management` | `whatsapp-webhook` (inbound → `whatsapp_conversations`/`_messages`) | WhatsAppTab (Atendimento) | Webhook writes real; UI falls to demo when none. |
| **Meta Ads (Marketing API)** | `meta-ads-oauth-start`/`-callback` | `companies.meta_ads_account_id`, `meta_ads_access_token`, ... | Marketing API / ads_read | `meta-ads-insights` (signals `connected`/`expired`/`error`) | MetaAdsTab | Backend signals correctly, **frontend ignores and shows demo** ⚠️ |
| **Meta Business** | `meta-business-oauth-start`/`-callback` | `companies.*` | pages/business scopes | — | Settings/Connections | Real connection flags. |
| **Google Business Profile** | `buildGbpAuthUrl` → `gbp-oauth-callback` | `integrations` | `business.manage` | `reply-google-review`, reviews import | ReviewsAgentTab / ReviewsPage | Real. |
| **Google Search Console** | `buildGscAuthUrl` → `gsc-oauth-callback` | `integrations` | `webmasters.readonly` | `gsc-metrics` | Settings/metrics | Real. |
| **Apify** | server token | — | `APIFY_TOKEN` | `apify-sync`, `monitor-competitor-social`, reviews import | AudienciaTab, competitors | Real scrape. |
| **Telegram** | `telegram-connect`/`-link`/`-webhook` | `companies.telegram_chat_id` | bot token | `telegram-chat`, `telegram-webhook` | Notifications | Real. |
| **Stripe** | `create-checkout`/`stripe-webhook` | billing columns | `STRIPE_SECRET_KEY` | — | Trial/billing | Real. |

---

## E. BACKEND DATA LAYER (tables the UI depends on)

**Real, UI-backing tables (confirmed in reads):**
`marketing_ai_config`, `marketing_ai_tracking_snapshots`, `marketing_ai_insights`,
`marketing_ai_content`, `marketing_ai_competitors`, `marketing_ai_strategy_log`,
`marketing_ai_activity_log`, `marketing_ai_brain_nodes`, `marketing_ai_experiments`,
`marketing_ai_tool_registry`, `marketing_ai_tool_config`, `marketing_ai_campaigns`,
`marketing_ai_trends`, `marketing_ai_reports`, `reviews`, `opportunities`,
`diagnostics`, `external_insights`, `leads`, `lead_messages`,
`whatsapp_conversations`, `whatsapp_conversation_messages`, `whatsapp_messages`,
`engagement_automations`, `engagement_events`, `agent_actions`, `companies`,
`posts`, `campaigns`, `insights_reports`.

**Realtime (ultra-sync) enabled:** the 7 `marketing_ai_*` tables in
`useMarketingAiData`, plus `agent_actions`, `leads`, `whatsapp_conversations`,
`engagement_automations`, `engagement_events`, and dashboard tables wired via
`useRealtime` in `useMarketingAiData` and the tab components.

---

## Cross-reference

The **policy classification** (🟢/🟡/🔵/🔴), the **mock inventory**, **silent
fallbacks**, **unused real data**, **gaps**, and **priority findings** are in
`docs/DATA_AUDIT.md`.
