# Sales Boost — Arquitetura

> O ciclo oficial de 10 etapas (fonte de verdade sobre QUALQUER descrição
> antiga que conflitar) + stack + modelo de dados + variáveis de ambiente.
> Auditado contra o **código real**, não contra comentário/documentação
> antiga — "parcial"/"não existe" aqui significa que o código de verdade
> cobre só um pedaço da ideia completa, ou nada.

## O ciclo de crescimento (10 etapas)

Fluxo de ponta a ponta que todo trabalho de crescimento passa (ou devia
passar) — da coleta de dado até resultado realimentando a próxima decisão.

Legenda: ✅ existe e funciona como descrito · 🟡 existe parcialmente ·
❌ não existe ainda.

1. **Data Agent** (catálogo com fotos reais + negócio/onboarding +
   concorrentes/mercado + resultados, tudo num lugar) — 🟡 parcial.
   `supabase/functions/data-agent/index.ts` (a function de verdade, chamada
   por `strategy-generate`/pelo frontend) + `shared/data-agent/domains.ts`
   (schema estático — títulos, perguntas, `gaps` por domínio).
   `data-agent/index.ts` **não** importa `domains.ts` — o campo `gaps`
   nunca sai na resposta real da function. Quem lê `domains.ts` (incluindo
   `gaps`) é só o FRONTEND, direto (`IntelligenceDomainsPanel.tsx` e
   `HermesGapsPanel.tsx`) — funciona porque o Vite bundla `shared/`
   normalmente, mas são duas fontes diferentes (uma ao vivo via HTTP, outra
   estática via import direto), não uma só. Cobre 9 domínios reais
   (`business, customer, market, competition, digital, content, history,
   resources, performance`), lendo tabelas de verdade (`competitors`,
   `reviews`, `leads`, `posts`, `diagnostics` etc.). **Não existe** domínio
   de "catálogo com fotos reais" como pensado aqui — existe
   `marketing_ai_knowledge` (kind='product') como catálogo de itens, lido
   direto por `catalog-package`/`CatalogItems.tsx`, não pelo Data Agent.

2. **Hermes/Estratégia** — ✅ existe.
   `supabase/functions/strategy-generate/index.ts`. Lê a ficha do setor
   (`fetchPlaybookBlock`) e uma memória estratégica real (via `data-agent`
   → domínio `history`, que lê `marketing_ai_brain_nodes`,
   `marketing_ai_strategy_log`, `marketing_ai_experiments`). **Automático**:
   `claim-diagnostic` dispara a 1ª estratégia sozinha logo após o cadastro;
   um despachante (`action:'cron_dispatch'`, pg_cron diário) reavalia
   semanalmente (`reanalyze`) e atualiza o plano tático mensalmente OU
   quando o check-up pede ajuste (`action:'refresh'` — mantém a tese, só
   refaz funil/metas/orçamento, silencioso). Estratégia NOVA (`generate`)
   só quando o check-up decide PIVOT/TERMINATE, **ou pelo botão do dono
   "Pedir nova estratégia"** (`StrategySection.tsx` — pede confirmação + o
   "por quê", usa o mesmo caminho de código do pivô automático) — só nesses
   casos avisa o dono (Telegram + Atividades).
   Interruptor em 2 níveis: geral (`hermes_config.auto_strategy_enabled`,
   painel Owner → Configurações → Tipos de negócio) e por empresa
   (`companies.auto_strategy`) — Liga dos Sonhos fica **desligada** até o
   dono decidir (ver [DECISIONS.md](DECISIONS.md)).
   Teto de custo: até 5 empresas por rodada do despachante, até 10
   chamadas automáticas/mês por empresa; custo de cada chamada
   (`agent_role:'estrategia'`) registrado em `agent_performance` e visível
   no painel "Uso de IA" na página de detalhe da empresa (Owner).
   Autenticação: function deployada com `--no-verify-jwt` (ver
   [PITFALLS.md](PITFALLS.md)) — código valida `cron_secret` OU JWT real
   do dono; caminho cron usa `company_id` do corpo, caminho JWT nunca
   aceita `company_id` do corpo (sempre resolve pela própria empresa do
   usuário logado). `reanalyze`/`refresh` respondem na hora e fazem o
   raciocínio em segundo plano via `EdgeRuntime.waitUntil`
   (`runReanalyze`/`runRefresh`) — ver [PITFALLS.md](PITFALLS.md) pro
   histórico do bug de timeout que isso corrigiu.

3. **Calendário semanal 80/20** — 🟡 parcial.
   `supabase/functions/creative-generate/index.ts` (`planWeekForCompany`),
   `supabase/migrations/067_weekly_calendar.sql`. O cron semanal existe de
   verdade (`weekly-calendar-plan-sun-18h-brt`, domingo 18h BRT) e decide
   1-2 posts por dia. **Não existe regra 80/20** nem proporção fixa
   pilar-comprovado vs. experimental como regra de código — a IA decide
   quantidade, não a mistura de tipo de conteúdo. O `catalog-package`
   (pacote por item, ver [CONTENT-INTELLIGENCE.md](CONTENT-INTELLIGENCE.md))
   tem um cap por-pilar-por-semana (`pillarCap`, baseado no peso da ficha)
   que é o único lugar com algo parecido com proporção real hoje.
   **P2 parte 1:** o cálculo 80/20 por pilar/receita/formato existe em
   `supabase/functions/_shared/learning.ts` (puro, 56 dias, ≥3 posts por
   grupo) e é injetado no `refresh` da estratégia; `posts` ganhou
   `pillar/recipe/format/item_id` (migration `20261002100000`), gravados por
   `agent-actions`. Ainda não alimenta o calendário. Ver [LEARNING.md](LEARNING.md).

4. **Content Agent** (roteiro/brief de cada peça) — 🟡 parcial.
   `creative-generate` (campo `video_script`), `content-engine`,
   `content-intelligence`, `generate-posts`, `catalog-package`. Só o
   `creative-generate` produz algo parecido com roteiro — texto livre
   único ("como gravar"), não uma quebra estruturada cena-a-cena. Nenhuma
   function produz hoje um BRIEF estruturado pro motor de mídia (ordem de
   fotos, movimento de câmera por foto) — é o que
   [MEDIA-ENGINE.md](MEDIA-ENGINE.md) ainda precisa construir.

5. **Motor de mídia com roteador** (foto real + render-format; Higgsfield
   atrás de um roteador; imagem IA só pra bairro/marca, nunca o item) —
   🟡 parcial. Ver [MEDIA-ENGINE.md](MEDIA-ENGINE.md) pro plano completo.
   `supabase/functions/render-format/index.ts` (cards SVG→PNG, custo de
   crédito = 0, confirmado), `supabase/functions/generate-video/index.ts`
   (fal.ai real — `fal-ai/ltx-video/image-to-video` — **sem nenhum
   chamador em todo o repo**, function órfã, deployada mas não plugada em
   botão nenhum). **Higgsfield não existe em lugar nenhum do código ainda**
   — é o provedor decidido (ver [DECISIONS.md](DECISIONS.md)), mas a
   integração é trabalho futuro ([ROADMAP.md](ROADMAP.md) P3). A regra
   "imagem IA nunca desenha o item de verdade, só cena de bairro/marca" não
   está codificada como checagem — só a regra geral de "nunca escrever
   texto" (`NO_TEXT_RULE`, ver [PITFALLS.md](PITFALLS.md)) existe de
   verdade, duplicada em cada function que gera imagem.

6. **Montagem** (juntar imagem/vídeo/avatar + texto no formato final) —
   ❌ não existe como etapa própria, salvo pra cards estáticos.
   `render-format` já faz montagem real (fundo + texto em SVG) mas só pra
   card estático. Não existe montagem equivalente pra vídeo (juntar
   `video_url` com legenda/texto) nem pra avatar (que nem existe ainda).

7. **Aprovação do dono** (obrigatória) — ✅ existe.
   `supabase/functions/agent-actions/index.ts`. `agent_actions.approval_status`
   (`PENDING/APPROVED/AUTO_APPROVED/REJECTED/EDITED/CANCELLED`) trava
   `execution_status` (`NOT_READY/QUEUED/EXECUTING/EXECUTED/FAILED`) até
   decisão humana explícita (`decide()`, grava `approved_by`); o fluxo de
   `posts` (`rascunho→aprovado→publicado`) segue a mesma trava. Sólido em
   toda a base.

8. **Distribuição Instagram** — ✅ existe (imagem única e carrossel).
   `agent-actions` → `publishToInstagram` (foto única) e
   `publishCarouselToInstagram` (2-10 fotos): fluxo oficial (containers
   filhos `is_carousel_item` + container `media_type:'CAROUSEL'` +
   `media_publish`). Containers filhos criados/esperados em PARALELO
   (`Promise.all`) — ver [PITFALLS.md](PITFALLS.md) pro motivo (150s).
   Disparado quando a peça de `marketing_ai_test_content` tem `media` com
   2+ itens (ex: recipe `carrossel_tour` do `catalog-package`) — 1 item
   continua publicando como foto única. Depois de publicar grava em
   `posts` (com `instagram_media_id`) E em `instagram_posts`
   (`recordInstagramPost`). **Caminho de conteúdo que PUBLICA de
   verdade:** `creative-generate` → `marketing_ai_test_content`
   (`planned_for`) → `agent_actions` (aprovação) →
   `publishToInstagram`/`publishCarouselToInstagram` → `posts`
   (`instagram_media_id`) + `instagram_posts`. Aprovar `posts` com
   `ref_type:'post'` **não** publica (só marca `status:'aprovado'`) — é um
   caminho de aprovação separado, sem publicador automático ligado.

9. **Conversão** (comentário-palavra-chave/DM → lead, resposta rascunhada
   pela IA lendo a ficha) — ver status atualizado em
   [CONVERSION.md](CONVERSION.md) (este arquivo pode ficar defasado; o doc
   de Conversão é a fonte de verdade pra essa etapa).

10. **Resultados → memória estratégica → volta pro 1 e 2** — 🟡 parcial.
    `supabase/functions/instagram-performance/index.ts` (grava
    `instagram_performance_snapshots`), `data-agent` (domínios
    `performance`/`history` leem de volta), `strategy-generate` (lê via
    `fetchDataAgentState` a cada rodada). O loop é real pra
    engajamento/alcance/leads. **Não fecha pra receita** — ver gap em
    [LEARNING.md](LEARNING.md).

### Hermes do produto ≠ agentes de desenvolvimento

O "Hermes" desta seção (etapa 2) é o motor que decide o MARKETING do
cliente final (dono de imobiliária, etc.). Os agentes de desenvolvimento
(`.claude/agents/*.md` — ver [ORCHESTRATION.md](ORCHESTRATION.md)) são quem
CONSTRÓI o Sales Boost. Não confundir os dois — um é produto, o outro é
processo de engenharia.

## Jarvis — voz, chat de texto, oportunidades e dashboard

Esta seção fica fora do ciclo de 10 etapas acima (que é especificamente
sobre o motor de conteúdo/Instagram) mas é parte real e ativa do produto —
preservada aqui pra não se perder na reorganização dos docs.

**As 4 peças do produto** (como o produto se apresenta pro dono):

1. **Jarvis (voz + HUD 3D)** — `/jarvis`, tela full-screen fora do
   dashboard. Motor: `hermes-proxy` edge function (tool use via Hermes, uma
   VPS externa separada do Supabase/Cloudflare). Voz entrada: Web Speech
   API (browser-native). Voz saída: ElevenLabs via `voice-tts`. Toggle
   "Sempre ouvindo": reinicia STT 700ms após ficar idle. Sem
   `ELEVENLABS_API_KEY` → modo texto, nada quebra. 3D Orb: Three.js, 900
   partículas Fibonacci + wireframe + inner glow, 4 estados (idle/
   listening/thinking/speaking).
2. **Agente chat (texto)** — `/dashboard/agente`, fallback/alternativa ao
   Jarvis por voz, mesmo motor (`hermes-proxy`). Ferramentas com aprovação
   humana: `create_post`, `create_multiple_posts`,
   `content-intelligence` (tendências/campanhas semanais automáticas, só
   rascunho). Regra de ouro: o agente nunca publica sozinho.
3. **Revenue Opportunities** — varre canais, lista oportunidades com valor
   estimado ("3 leads sem resposta", "7 avaliações negativas sem
   resposta"). Botão "Resolver tudo" (fila de ações em lote — Fase 5, não
   construído ainda).
4. **Dashboard** — métricas + timeline do que o agente fez/está pendente.
   Cada aba de dados tem "Análise do agente" (`generate-tab-insight`,
   `insights_reports`), 1x/dia via pg_cron (só reprocessa se 7+ dias).

### Loop de voz do Jarvis (detalhado)

```
🎤 Fala → Web Speech API (pt-BR/en-US) → texto
  → hermes-proxy (Supabase: tools + dados da empresa)
  → fetch pro HERMES_URL (VPS externa — quem raciocina de verdade)
  → hermes-proxy executa as ferramentas que o Hermes pediu (grava no banco)
  → resposta em texto → voice-tts (ElevenLabs) → 🔊 áudio
  → JarvisOrb reage (idle → listening → thinking → speaking)
```

O Hermes (a VPS externa) não tem identidade própria — só "veste" o
prompt/ferramentas que o `hermes-proxy` manda a cada mensagem. Quem executa
de verdade (criar post, salvar lead) é sempre o `hermes-proxy` (Supabase),
nunca o Hermes. **Hermes (`HERMES_URL`) hoje é instável** (502/timeout
observados) — por isso o Telegram foi deliberadamente mantido fora desse
caminho (`telegram-chat` fala direto com a Claude, sem passar pelo Hermes).

### Agentes do Jarvis (papéis ativos)

| Agente | Especialidade | Status |
|--------|--------------|-------|
| Geral | Posts, conteúdo, reputação, concorrência, diagnóstico do site, atendimento (leads/follow-up) | **Ativo** — único papel hoje. Chave interna continua `marketing` em `hermes-proxy` (histórico de `agent_messages`/`agent_performance`); nome exibido é "Agente Geral". Liga/desliga em `/owner/company/:id` (checkbox "Marketing AI"). |
| Dev (Claude) | Executa código | Ativo |

Agente de Vendas foi excluído (decisão do dono) — ferramentas de
lead/follow-up (`list_leads`, `create_lead`, `update_lead_stage`,
`draft_followup`) continuam existindo em `hermes-proxy`, o Agente Geral já
tem acesso a elas.

### Ciclo autônomo do Jarvis (quando cada function tática roda sozinha)

Camada diferente do ciclo de 10 etapas acima — essa aqui descreve QUANDO
cada function roda (cron, "vale a pena agir agora"), não AS ETAPAS.

`hermes-proxy` em modo cron (`cron_secret`) pergunta primeiro ao Hermes
(papel "orquestrador", só leitura) se vale a pena agir (`decideRolesToRun`)
— só então roda (`runAutonomousCycle`). Disparado por `run-agents` (atalho
fino que repassa pro `hermes-proxy`).

Dois agendamentos coexistem: (1) VPS `srv1824556`, systemd timer
`sales-boost-marketing.timer` → `/opt/sales-boost-cron/marketing_cycle.sh`,
a cada 30 min; (2) pg_cron nativo do Supabase chamando edge functions
direto (`instagram-auto-post-daily` → `run-agents`,
`generate-posts-weekly`, `detect-opportunities-daily`,
`generate-tab-insight-daily`).

| Função | Decide agir quando... | Fica quieto quando... |
|-------|------------------------|------------------------|
| `detect-opportunities` | sempre varre (barato) | nada mudou — não reavisa |
| `draft-reply` | há review sem `ai_draft` | já rascunhou tudo |
| `generate-posts` | sinal `no_content` aberto (7+ dias sem post) | já existe `stale_draft` |
| `map-competitors` | 7+ dias sem escanear | escaneou recentemente |
| `monitor-competitor-social` | 7+ dias sem checar | idem |
| `site-diagnosis` | URL mudou, ou 30+ dias | site igual e recente |
| `content-intelligence` (campanha) | 7+ dias sem campanha e sem `stale_draft` | já existe `stale_draft` |
| `generate-tab-insight` | 7+ dias desde o último relatório | relatório fresco |

Toda ação real do agente é reportada em 2 lugares, sempre com o motivo:
Telegram (`notifyMarketing()` → Cloudflare Worker `marketing-bot` →
`/notify`) e aba Atividades (`bot_notifications`, logado via
`log-bot-event`).

### Telegram — infraestrutura

- **Recebimento:** `telegram-webhook` (Supabase) → chama `telegram-chat`.
- **Resposta:** `telegram-chat` (Supabase) fala direto com a Claude
  (Anthropic), ferramentas próprias de leitura de dados reais, regra
  estrita de nunca inventar números (`count:'exact'` do Postgres). Modelo:
  `claude-sonnet-4-6`.
- **Avisos automáticos** (`AGENT_ACTION`, `OPPORTUNITY_DETECTED`,
  `STRATEGY_PIVOT` etc.) ainda é o Cloudflare Worker `marketing-bot`, rota
  `/notify` — não migrou pro Supabase.
- **`vendas-bot`** (Cloudflare Worker) ainda não migrado — mesmo ponto
  cego de logs que `marketing-bot` tinha antes.
- **`group-manager`** (Cloudflare Worker) cria grupos/convida bots — usa
  biblioteca de cliente Telegram (login como usuário), tecnologia diferente
  dos outros dois.

## Stack

- **Frontend:** React + Vite, TypeScript, Tailwind CSS, deploy via
  Cloudflare Workers.
- **Auth/DB:** Supabase (Auth + Postgres + RLS).
- **Agente:** Supabase Edge Functions definem as ferramentas e guardam os
  dados — quem raciocina de verdade (Jarvis, chat, ciclo autônomo) é o
  Hermes, servidor externo (VPS separada) chamado via `hermes-proxy`.
  (`agent-chat`, versão antiga que chamava a Claude direto, está
  deprecada.)
- **Telegram tem cérebro próprio e independente:** `telegram-chat` fala
  direto com a Claude, sem passar pelo Hermes — decisão deliberada pra
  manter o canal estável mesmo quando o Hermes falha.
- **IA:** Claude API (`claude-sonnet-4-6`).
- **PDF:** apitemplate.io. **Email:** Resend. **Pagamentos:** Stripe.
- **Coleta de dados:** Apify (reviews, redes sociais, Maps) + Google
  PageSpeed Insights.

### Regras de arquitetura

- Multi-tenant: `companies` é a raiz; toda tabela tem `company_id` com RLS.
- Roles: `owner` (operador/admin), `client` (dono do negócio).
- Nunca expor chave de API no frontend — sempre via Edge Functions.
- i18n desde o início — nunca string hardcoded na UI (seguido de forma
  inconsistente em componentes mais novos — débito técnico conhecido).
- Deploy: `npm run build` → `npx wrangler deploy` (manual, sem CI/CD —
  ver P4 em [ROADMAP.md](ROADMAP.md)).

## Modelo de dados (principal)

```
companies (id, user_id, business_name, business_type, city, website_url,
  instagram_url, instagram_user_id, instagram_username,
  instagram_access_token, instagram_token_expires_at, instagram_auto_post,
  goal, plan, created_at, active, telegram_chat_id, notification_prefs,
  social_data, google_rating, google_review_count, vertical_key,
  playbook_answers, auto_strategy, agent_automatic_mode, ...)
user_roles (user_id, role)  -- 'owner' | 'client'
posts (id, company_id, content, platform, status, image_url,
  instagram_media_id, image_suggestion, best_time, campaign_id, created_at)
  -- status: 'rascunho' | 'aprovado' | 'publicado'
instagram_posts (id, company_id, instagram_media_id, caption, image_url,
  status, posted_at, likes_count, comments_count, created_at)
agent_messages (id, company_id, role, content, agent_role, created_at)
agent_memory (id, company_id, agent_role, key, value, type, updated_at)
agent_performance (id, company_id, agent_role, task_key, task_description,
  success, error_message, cost_usd, latency_ms, created_at)
agent_actions (id, company_id, agent_key, action_type, channel, target,
  title, description, payload, approval_status, execution_status,
  ref_type, ref_id, scheduled_at, approved_by, approved_at, ...)
diagnostics (id, company_id, website_url, status, pagespeed_mobile,
  pagespeed_desktop, frontend_review, created_at)
reviews (id, company_id, source, author, rating, text, review_date,
  sentiment, themes, owner_reply, google_review_id, created_at)
opportunities (id, company_id, type, title, description, value_estimate,
  status, created_at)
campaigns (id, company_id, name, goal, brief, source, created_at)
leads (id, company_id, name, contact, channel, source, stage, status,
  value_estimate, notes, last_contact_at, next_action_at, created_at)
lead_messages (id, lead_id, company_id, direction, channel, content,
  status, scheduled_for, sent_at, external_id, created_at)
insights_reports (id, company_id, tab_key, summary, suggestions[],
  created_at)
vertical_playbooks (key, name, version, config jsonb, enabled)
marketing_ai_knowledge (id, company_id, kind, module, image_url, meta
  jsonb, content, ...)  -- catálogo de itens (kind='product')
marketing_ai_test_content (id, company_id, kind, idea, caption, hashtags,
  cta, format, image_url, media jsonb, item_id, pillar, recipe, provider,
  planned_for, quality_score, status, ...)  -- 'draft'|'vault'|'adapt'
marketing_ai_strategies (id, company_id, kind, parent_strategy_id, name,
  status, thesis, primary_constraint, strategic_opportunity,
  active_components, funnel_plan, budget, estimates, last_reanalyzed_at,
  last_refreshed_at, ...)
marketing_ai_strategy_log (id, company_id, strategy_id, decision_type,
  recommendation, reasoning, status, created_at)
engagement_automations (id, company_id, name, active, trigger_type,
  intent_type, keywords[], media_ref, post_id, campaign_id, action_type,
  message, create_lead, execution_mode, allowed_auto_actions[], ...)
engagement_events (id, company_id, automation_id, channel, ig_user,
  ig_user_id, comment_text, media_ref, intent_detected, ai_interpretation,
  action_type, action_message, status, agent_action_id, error, created_at)
```

## Estado atual do código

- **Site publicado:** https://getsaleboost.com/ (+ www). O endereço antigo
  `*.workers.dev` não responde mais (ver [PITFALLS.md](PITFALLS.md)).
- **`agent-chat` está deprecada** — nenhuma tela chama mais, substituída
  pelo `hermes-proxy`. Ainda não foi apagada.
- **`publish-instagram` está deprecada** — zero chamadores no código,
  nunca terminou de rodar em produção. Ainda não foi apagada. O publicador
  real é `agent-actions` (ver etapa 8 acima).
- Supabase migrations em `supabase/migrations/` têm deriva real vs. o
  schema de produção — algumas tabelas usadas hoje não têm NENHUM arquivo
  de criação local (`posts`, `leads`, `lead_messages`, `agent_memory`,
  `business_types` — criadas direto em produção). **Nunca confiar
  cegamente nos arquivos aqui** — conferir o schema real via
  `supabase db query --linked` antes de assumir estrutura.
- i18n via `src/i18n.ts` (dashboard usa `src/i18n-dash.ts`) — inconsistente
  em componentes mais novos.

## Variáveis de ambiente

```
# Frontend (.env.local)
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
VITE_GOOGLE_OAUTH_CLIENT_ID=

# Supabase Edge Functions (secrets)
SUPABASE_SERVICE_ROLE_KEY=
ANTHROPIC_API_KEY=
PAGESPEED_API_KEY=
APIFY_TOKEN=
RESEND_API_KEY=
STRIPE_SECRET_KEY=
ELEVENLABS_API_KEY=          # voz do Jarvis — sem isso cai pra modo texto
ELEVENLABS_VOICE_ID=         # opcional
APITEMPLATE_API_KEY=         # PDF de relatórios mensais
INSTAGRAM_APP_ID=
INSTAGRAM_APP_SECRET=
INSTAGRAM_VERIFY_TOKEN=
APP_URL=                     # https://getsaleboost.com — usado nos redirects OAuth
CRON_SECRET=                 # autentica chamadas de cron/internas (ver PITFALLS.md)
BOT_WEBHOOK_SECRET=          # autentica log-bot-event
HIGGSFIELD_API_KEY=          # ainda não usado em código — ver MEDIA-ENGINE.md
```

## Rota `/setup` — fim do cadastro (2026-10-06)

Tela `src/pages/setup/SetupPage.tsx`, atrás do login e **fora** do
`DashboardLayout`. "Alimentar os dados reais": Instagram em destaque
(mesma chamada `instagram-oauth-start` das Configurações), cartões
obrigatórios (dados do negócio, perguntas da ficha, itens do catálogo com
fotos mínimas — cada um só aparece se existir na ficha) e rodapé "Ir para
o painel". Status em `src/lib/useSetupStatus.ts`; as regras de "pergunta
respondida" / "item com fotos suficientes" ficam em `src/lib/setupRules.ts`,
**compartilhadas com o sino** (`usePendencias`) pra nunca discordarem.
Config da ficha: `vertical_playbooks.config.setup` (`instagram_required`,
`min_items`; padrão false/1). Gate em `ClientRoute` (`src/main.tsx`), depois
de todos os checks de login/empresa/acesso: aplica só se
`company.created_at >= SETUP_GATE_FROM` e sem assinatura; carregando =
spinner, incompleto = `/setup`, erro = deixa passar. `/trial` e
`/access-blocked` ficam fora do gate. Abrir `/setup` já completa mostra a
tela normal com o botão liberado (não redireciona). Divergência anotada:
o catálogo no /setup reusa `CatalogItems` em `setupMode` (sem "Gerar
pacote", pra não gastar IA no cadastro).

## Estado do trial (atualizado 2026-10-02)

Antes: 3 dias fixos, estados `trial_day_1/2/3`. Agora: o total vem do par
`trial_started_at`/`trial_expires_at` (`TrialInfo.totalDays`; padrão novo
`TRIAL_DAYS = 7`), estado único `trial_active` (+ `trial_expiring` nas
últimas 6h). `claim-diagnostic` ainda grava 3 dias até ser deployada.
O painel do trial (`TrialSummaryPage`) mostra só contagens reais das
tabelas existentes; sem dado, "Hermes ainda está analisando".
