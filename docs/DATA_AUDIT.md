# SalesBoost — DATA AUDIT (Policy Compliance)

> Companion to `docs/DATA_MAP.md`. Classifies each data area against the
> **Data Source Policy** and lists violations, silent fallbacks, gaps, and
> priorities. Read-only audit — no behavior changed. Date: 2026-09-09.

## Policy recap
- 🟢 **REAL** — integration + permission present → use real data, never mix fake.
- 🟡 **EMPTY STATE** — not connected → explain what's needed, no fake data.
- 🔵 **DEMO MODE** — demo data only when the user explicitly turns Demo Mode on, always labeled.
- 🔴 **ERROR** — connected but request fails → error state + log, never fake data.

---

## C. MOCK / DEMO INVENTORY (every fake-data source in the UI)

Demo builders (`src/pages/dashboard/marketingAi/*Demo.ts`), all seeded by
`seededRng(company.id)`:

| Builder | Feeds | Rendered by | Gated by Demo Mode? |
|---------|-------|-------------|---------------------|
| `growthDemo.ts` → `buildGrowthDemo` | command-center KPIs (revenue, ROAS, funnel), connections | `MarketingAiHubPage`, `ConnectionsTab` (connections) | Hub: **yes**; Connections: **no** (always demo list) |
| `intelDemo.ts` → `buildMarketDemo` | Inteligência de Mercado | `MarketIntelTab` | **No** — always demo |
| `metaHealthDemo.ts` → `buildMetaHealthDemo` | Saúde da Meta score | `MetaHealthTab` | **No** — always demo |
| `feedbackDemo.ts` → `buildIcpDemo`/`buildFeedbackDemo` | Feedback Loop ICP | `FeedbackLoopTab` | **No** — always demo |
| `growthIntelDemo.ts` | growth intel cards | (helper) | — |
| `campaignDemo.ts` → `buildCampaignDemo` | Campanhas | `CampaignsTab` | **No** — always demo |
| `storiesDemo.ts` → `buildStoriesDemo` | Stories | `StoriesTab` | **No** — always demo |
| `performanceDemo.ts` → `buildPerformanceDemo` | Performance IG | `PerformanceTab` | **Yes** ✅ (empty state otherwise) |
| `salesDemo.ts` → `buildFunnelDemo`/`buildWhatsAppDemo` | Funil, Atendimento | `FunnelTab`, `WhatsAppTab` | **No** — demo when empty (labeled banner) |
| `engagementDemo.ts` → `buildEngagementDemo` | Engagement examples | `EngagementTab` | **No** — demo when empty (labeled) |
| Content demo (`buildContentDemo`) | Conteúdo → Orgânico | `ContentAgentTab` | **No** — always demo |
| `buildInsightsDemo` | Insights tab | `InsightsTab` | **No** — demo when empty (labeled) |
| `buildContextDemo` | Business context preview | `BusinessContextTab` | preview-only |

**Static/library content (by design, not a violation):** `ContentLibrary`
(frameworks, hooks, personalities) is intentionally static reference material,
not business performance data.

---

## D. REAL DATA INVENTORY (already backed by real sources)
- **Instagram performance** — `instagram-performance` (Graph API, live).
- **Reviews** — `reviews` table (GBP/Apify import).
- **Opportunities** — `opportunities` + `detect-opportunities`.
- **Diagnostics** — `diagnostics` + PageSpeed + `check-links-health`.
- **External insights** — `external_insights` + `insights-collect`.
- **Competitors** — `marketing_ai_competitors` + `map-competitors`.
- **Audience/social** — `companies.social_data` + `apify-sync`.
- **Leads** — `leads` (written by Instagram Engagement, Telegram, Hermes).
- **WhatsApp conversations** — `whatsapp_conversations` / `_messages` (webhook).
- **Engagement** — `engagement_automations` / `engagement_events`.
- **Approvals** — `agent_actions`.
- **Marketing-AI hub tables** — all `marketing_ai_*` (real, may be empty).

---

## E. REAL DATA GAPS (frontend expects data that has no live source yet)
1. **Meta Ads** — `meta-ads-insights` works, but real spend/ROAS only exists once
   a Meta Ads account is connected; until then there is no real source and the UI
   currently masks this with demo (see Silent Fallbacks).
2. **Saúde da Meta** — no backend computes a real Meta health score; entirely demo.
3. **Feedback Loop / ICP** — no backend produces a real ICP profile; entirely demo.
4. **Conteúdo → Orgânico calendar** — `ContentAgentTab` shows a demo calendar while
   real content lives in `marketing_ai_content` / `posts` (see Unused Real Data).
5. **Campanhas / Stories** — no real paid-campaign or stories source wired; demo only.
6. **Inteligência de Mercado section** — `MarketIntelTab` is demo, though real
   competitor data exists in `marketing_ai_competitors` (see Unused Real Data).
7. **Atendimento controls** — autonomy level, business hours, human-handoff toggles
   are local state only (not persisted, no backend).
8. **Atendimento follow-up queue & knowledge base** — still demo (`salesDemo`).

---

## F. UNUSED REAL DATA (real exists, UI shows demo instead) — high-leverage
1. **Competitors:** `marketing_ai_competitors` is real and read by `CompetitorsPage`,
   but the Marketing-AI `competitors` section renders **`MarketIntelTab` (demo)**.
   Two parallel competitor experiences; the section shows the fake one.
2. **Content:** real content/drafts in `marketing_ai_content` and `posts` power
   `OverviewSection` and `ContentVault`, yet **`ContentAgentTab` (Orgânico)** shows a
   demo calendar. Real posts already exist but the primary content tab ignores them.
3. **Instagram audience/insights:** `instagram-performance` returns real per-post
   and account insights; only `PerformanceTab` uses them. Audience metrics elsewhere
   rely on Apify scrape rather than the already-available Graph insights.

---

## G. SILENT FALLBACKS (API failure / no-connection can look like real data) — HIGH PRIORITY
| Location | Code shape | Why it's a violation |
|----------|-----------|----------------------|
| `MetaAdsTab.tsx:124-125` | `live?.totals ?? demo.totals`, `liveCampaigns ?? demo.campaigns`; fetch `.catch(()=>{})` | If Meta Ads is **not connected** or the **API errors**, the UI shows fabricated spend/ROAS/CTR as if real. No empty state, no error state. **Worst offender.** |
| `WhatsAppTab.tsx:122,126` | `isReal ? realConvs : demo.conversations`; `followUps` always demo | Demo conversations shown when not connected (labeled banner, but not Demo-Mode-gated); follow-up queue is always demo. |
| `FunnelTab.tsx` | `isReal ? realLeads : demoLeads` | Demo leads shown when empty (labeled banner, not Demo-Mode-gated). |
| `InsightsTab.tsx:97` | `hasReal ? real : demo` | Demo insights shown when none real (labeled). |
| `EngagementTab.tsx:42-43` | `isDemo ? demo.automations : automations` | Demo examples when no automations (labeled). |
| Pure-demo tabs (MarketIntel, MetaHealth, Feedback, Campaigns, Stories, ContentAgent) | always render `build*Demo()` | Demo shown in production unconditionally; a real API failure is indistinguishable because no real call is made. |

> Note: `PerformanceTab` uses `live ?? demo` **but** guards with an empty state
> (`if (!connected && !demoMode) return <EmptyState/>`) and an error footer — this
> is the compliant pattern and should be the template for the others.

---

## H. (see DATA_MAP.md section D for the full Integration/Permission map)

---

## I. DATA SOURCE POLICY VIOLATIONS (ranked)
1. **🔴/🟡 MetaAdsTab silent fallback** — real "not connected"/"error" states are
   swallowed and replaced with demo spend/ROAS. Violates both EMPTY and ERROR.
2. **🔵 Demo Mode defaults to ON** — new real users see fabricated command-center
   revenue/ROAS by default; demo is not "explicitly activated".
3. **🔵 Demo shown outside Demo Mode** — MarketIntel, MetaHealth, Feedback,
   Campanhas, Stories, ContentAgent (Orgânico) render demo unconditionally,
   ignoring the Demo-Mode toggle entirely.
4. **🟡 Missing empty states** — most demo tabs have no "connect X to see real
   data" state; they show fake data instead of prompting connection.
5. **🔴 No explicit error states** (except PerformanceTab) — when a real fetch
   fails, tabs either show demo or nothing; failures are not surfaced/logged in UI.
6. **🟢 Partial-compliance (labeled) fallbacks** — Funil, Atendimento, Insights,
   Engagement label their demo but still show it in normal mode instead of an empty
   state; acceptable-ish but not strictly compliant.

---

## J. PRIORITY FINDINGS (most important first)
1. **Fix `MetaAdsTab` silent fallback** — stop showing fake ad metrics; add
   connected/empty/error states (mirror `PerformanceTab`). Highest risk: it makes
   fake ad performance look real.
2. **Change Demo Mode default to OFF** (or make it an explicit "Try with demo data"
   entry) so production never starts on fabricated KPIs.
3. **Route the demo tabs through the toggle** — MarketIntel, MetaHealth, Feedback,
   Campanhas, Stories, ContentAgent should show empty states in normal mode and
   demo only when Demo Mode is on.
4. **Wire the "unused real data"** — point the `competitors` section at
   `marketing_ai_competitors`, and `ContentAgentTab` at `marketing_ai_content`/`posts`.
5. **Adopt the PerformanceTab pattern platform-wide** — `connected ? real : (demoMode ? demo : emptyState)` + error state, as the standard for every data tab.
6. **Persist Atendimento controls** and build real follow-up/knowledge sources
   (currently local/demo).
7. **Add UI error surfacing + logging** for real fetches that fail.

---

## CONCISE SUMMARY

1. **Total major areas audited:** ~30 client-facing areas (11 dashboard routes, 17
   Marketing-AI sections/sub-tabs, plus integrations & the central data hook).
   Owner console noted but not fully audited.
2. **Already using real data:** Hub overview/tracking/brain/experiments/tools/
   timeline/reports (marketing_ai_* hook), Performance (IG), Avaliações,
   Oportunidades, Diagnóstico, Insights page, Concorrentes page, Audiência, Funil,
   Atendimento, Engagement, Aprovações, ContentVault, Connections status.
3. **Currently using demo/mock/fake:** Growth OS command center (default), Inteligência
   de Mercado, Saúde da Meta, Feedback Loop, Conteúdo (Orgânico/Campanhas/Stories),
   Meta Ads (via silent fallback), plus labeled demo fallbacks in Funil/Atendimento/
   Insights/Engagement.
4. **Biggest fake-data problems:** (a) `MetaAdsTab` silently shows fake spend/ROAS
   when disconnected or on API error; (b) Demo Mode defaults ON so new users see
   fabricated revenue KPIs; (c) six tabs render demo unconditionally.
5. **Real data available but unused:** `marketing_ai_competitors` (section shows demo),
   `marketing_ai_content`/`posts` (Orgânico shows demo), IG Graph insights (only
   Performance uses them).
6. **Missing/disconnected sources:** real Meta Ads account (until connected), a real
   Meta-health score, a real ICP/Feedback source, real paid-campaign & stories data,
   persisted Atendimento controls, real follow-up/knowledge.
7. **Silent fallbacks that can hide API failures:** `MetaAdsTab` (`?? demo` + swallowed
   `catch`) is the critical one; Funil/Atendimento/Insights/Engagement fall to demo
   when empty (labeled); pure-demo tabs never call a real source at all.
8. **Current Demo Mode behavior:** a per-company `localStorage` flag
   (`sb_growth_demo_<id>`), **default ON**, honored only by the Hub command center and
   PerformanceTab; other demo tabs ignore it.
9. **Biggest policy violations:** silent Meta Ads fallback (🔴/🟡), Demo Mode ON by
   default (🔵), and demo shown outside Demo Mode in 6 tabs (🔵); missing empty/error
   states (🟡/🔴).
10. **Most important to address before workflows/orchestration:** (1) kill the Meta
    Ads silent fallback; (2) flip Demo Mode to explicit/off; (3) gate all demo tabs
    behind the toggle with proper empty/error states, using PerformanceTab as the
    template; (4) connect the already-available real competitor & content data.
