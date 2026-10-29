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
   `marketing_ai_strategy_log`, `marketing_ai_experiments`). Desde
   2026-10-19 também recebe o **escopo do produto** (`SCOPE_BLOCK`: o que o
   Sales Boost executa e o que não executa) e os **pilares de Social
   Selling** (ficha `onboarding_v2.social_selling` + nível de cada pilar no
   diagnóstico ligado à empresa). Grava `content_plan.pillars` e
   `funnel_plan[].pillar`. Ver [DECISIONS.md](DECISIONS.md) 2026-10-19.
   **Automático**:
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

**Divergência (2026-10-12):** a mesma VPS `srv1824556` (Hostinger KVM 2)
passa a rodar também o "estúdio de vídeo" (serviço `salesboost-worker`, ver
[MEDIA-ENGINE.md](MEDIA-ENGINE.md#estúdio-de-vídeo-na-vps-2026-10-12)). O
Hermes e o timer abaixo continuam como estão.

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
  - *Divergência (2026-10-12):* no código atual os avisos passam por
    `log-bot-event` (Supabase), que grava em `bot_notifications` e manda
    direto pra API do Telegram — o Worker não aparece mais nesse caminho.
- **Telegram amigo** (2026-10-12, opt-in por empresa em Configurações →
  Notificações, `notification_prefs.telegram_buddy`): `telegram-buddy`
  (pg_cron a cada 10 min, silêncio 22h–8h de Brasília, máx. 3 mensagens
  por rodada, cada item uma vez só via `telegram_buddy_sent`) avisa
  pedido de aprovação pendente (`agent_actions`), post novo no Vault e
  lead novo. Aprovação com botão: 1º toque troca por "Tem certeza?", 2º
  toque → `telegram-webhook` (`callback_query`) → `agent-actions`
  `telegram_decide`, que confere de novo a assinatura HMAC do botão (presa
  a item + chat), o chat do dono, o opt-in e o status ainda pendente
  (troca condicional: dois toques nunca publicam duas vezes). Interruptor
  geral: `feature_flags.telegram_buddy`. Só pedido `PENDING` é aprovável
  pelo Telegram (editado no painel depois do aviso → volta pro painel). O
  `hermes-lead-alert` só deixa o aviso de lead pro buddy quando ele vai
  avisar agora (`buddyDeliversNow`); senão avisa ele mesmo e marca o lead
  como avisado em `telegram_buddy_sent` (nem some, nem duplica).
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
- **Idioma (2026-10-27):** dois idiomas, dois donos. **Tela = por usuário**
  (`LanguageContext`): escolha explícita em `localStorage['sb_lang']` vence; sem
  escolha, `companies.language` da empresa logada (`'pt'` → pt, senão en); sem
  empresa → `'en'`. A regra só lê, nunca grava o `sb_lang` sozinha. **Conteúdo
  gerado = por empresa** (`companies.language`, padrão `'en'` desde a migration
  `20261027120000_ingles_padrao.sql`; editado em Configurações). Código fora do
  React lê a tela com `getCurrentLang()`. `business_types.label` é chave em PT
  (ficha/plano): traduzir só na exibição (`businessTypeLabel`). Ver
  [DECISIONS.md](DECISIONS.md#2026-10-27--inglês-como-idioma-principal-mercado-eua-inteiro).
- Deploy: `npm run build` → `npx wrangler deploy` (manual, sem CI/CD —
  ver P4 em [ROADMAP.md](ROADMAP.md)).

## Modelo de dados (principal)

```
companies (id, user_id, business_name, business_type, city, website_url,
  instagram_url, instagram_user_id, instagram_username,
  instagram_access_token, instagram_token_expires_at, instagram_auto_post,
  goal, plan, created_at, active, telegram_chat_id, notification_prefs,
  social_data, google_rating, google_review_count, vertical_key,
  playbook_answers, answer_status, auto_strategy, agent_automatic_mode, ...)
  `answer_status` (2026-10-16): estado de cada resposta da ficha quando não há
  valor — `unknown` ("Não sei"), `na` ("Não se aplica"), `later`
  ("Preencher depois"), `auto` (lido do Instagram, a confirmar). Ver
  `src/lib/onboardingV2.ts` e DECISIONS.md (onboarding imobiliário v2).
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
  planned_for, quality_score, status, familia, pilar_ss, intent, ...)
  -- 'draft'|'vault'|'adapt'. Rótulo único da peça (fase 3, 2026-10-22):
  -- pillar = TEMA (pilar de conteúdo da ficha), familia = o que é
  -- (tour|oferta|educativo|bairro|eventual), pilar_ss = pra que serve (chave
  -- do pilar de Social Selling da ficha), intent = a intenção da estratégia
  -- que guiou a peça (jsonb). `posts` também ganhou familia e pilar_ss, mas o
  -- agent-actions ainda não os copia na publicação.
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
market_signals (id, company_id, kind, region, title, summary, source_name,
  source_url, observed_at, collected_by, meta, created_at)
  -- 2026-10-28 (migration 20261028120000): sinal de mercado com fonte e data.
  -- Etapa 1: vazia; a Etapa 2 deixa o cliente colar à mão (RLS de escrita já existe).
growth_opportunities (id, company_id, kind, title, description,
  commercial_problem, evidence jsonb [{type: fact|data|hypothesis, text,
  source, date}], item_ids uuid[], audience, suggested_action,
  how_to_measure, confidence, needs_validation, status, priority_rank,
  priority_reasons jsonb, run_id, decided_at, decided_by, strategy_id,
  created_at, plan jsonb, plan_generated_at, plan_approved_at)  -- plan*: 2026-10-29 (Etapa 4A)
  -- 2026-10-28: saída do Opportunity Engine. Cliente lê e só altera
  -- status/decided_at/decided_by (grant por coluna); criar é só pela function.
  -- ATENÇÃO nomes: `opportunities` (acima) e `campaigns` têm OUTRO significado
  -- e NÃO são estas tabelas — ver PITFALLS.md.
```

## Opportunity Engine (Inteligência comercial, 2026-10-28) — 🟡 até teste em produção

Decisão: [DECISIONS.md](DECISIONS.md#2026-10-28--inteligência-comercial-para-imobiliárias-opportunity-engine).
Código: `supabase/functions/_shared/opportunityEngine.ts` (fatos + candidatos), `opportunityOutput.ts` (prompt,
validação, prioridade), `opportunityRun.ts` (banco + IA) e o despacho `action: 'run_opportunities'` em
`marketing-ai/index.ts`. Tela: `/dashboard/opportunities` (`GrowthOpportunitiesPage.tsx`). Teste de lógica pura:
`node --experimental-strip-types scripts/test-opportunity-engine.mjs`.

- **Entradas (só leitura):** catálogo (`marketing_ai_knowledge` kind='product', campos de `meta.fields` lidos pelos
  papéis da ficha `config.opportunity_fields`), `posts` e `engagement_events` dos últimos 60 dias (vínculo
  comentário → item: `media_ref` = `posts.instagram_media_id` → `posts.item_id`), `marketing_ai_competitors`,
  `marketing_ai_trends`, `market_signals`. `leads` não entra: não há vínculo lead → imóvel no banco.
- **Passo A (código, sem IA) — candidatos por regra:** `content_gap` (bairro do catálogo sem NENHUM post — qualquer
  status — em 60 dias); `low_traction` (item COM post publicado e zero comentários nesses posts; **sempre
  hipótese**, causas possíveis preço/fotos/comunicação; exige Instagram conectado); `positioning` (hashtag que ≥2
  concorrentes repetem e a empresa não usa; notas do concorrente entram como "dado"); `market_change` (sinal ou
  tendência **com fonte** citando um bairro onde há item do catálogo; tendência cuja fonte é a própria IA é
  ignorada). `unmet_demand` existe no schema mas ainda não tem regra. Cada fato tem `type` (fact/data), `source`
  e `date` real (`null` quando o dado não tem data; "contei agora" usa a data de hoje).
- **Passo B (IA):** Claude (`claude-sonnet-4-6`, mesmo cliente do marketing-ai) recebe SÓ fatos + candidatos
  (no máx. 5, os de melhor prioridade) e devolve JSON com até 3 oportunidades redigidas. Idioma =
  `companies.language`. Síncrono (1 chamada, `AbortSignal` de 100 s, abaixo do teto de 150 s); sem candidato
  nem chama a IA. Custo vai pra `agent_performance` (`task_key='run_opportunities'`). Auth: JWT da empresa +
  `requirePaidAccess` (vitrine bloqueada; a tela abre o modal de plano). Chamadas repetidas em < 90 s reaproveitam
  a rodada anterior (não gasta IA de novo). Roda **antes** do `getConfig`: não exige o Marketing AI configurado.
- **Texto de setor na ficha (regra 6):** `config.opportunity_fields` (papéis dos campos) e `config.opportunity_texts`
  (pt/en: causas possíveis de pouca reação, ressalva do prompt, exemplos de público), ambos na migration. Sem
  `opportunity_texts` valem textos genéricos do código ("valor anunciado", "localização", "categoria do item").
- **Prompt:** fatos e candidatos vão dentro de um bloco `<dados>…</dados>` com instrução de que é dado, nunca
  instrução; todo texto vindo do banco (títulos, notas de concorrente, sinais, tendências) é saneado — uma linha,
  sem `<` `>`, ~200 caracteres (`promptSafe`).
- **Rodada repetida:** o marcador é a última execução bem-sucedida de `run_opportunities` em `agent_performance`
  nos últimos 90 s (gravada mesmo com 0 oportunidades), não a última linha de `growth_opportunities`.
- **Validação em código:** evidência `fact`/`data` sempre vem do fato guardado (texto, fonte e data do banco) —
  id inexistente é descartado; número no texto que não esteja nos fatos → a **frase** sai (campo vazio cai no
  texto padrão do código); termo de classe protegida (lista ampla PT/EN: situação familiar — filhos, crianças, famílias —, raça/cor, religião, origem, deficiência, sexo/gênero/orientação/estado civil, idade; falso positivo é preferível) → a frase sai (no público, vira vazio); número vale por **valor + unidade** ("60 dias" não libera "60%"; moeda só se o fato for o preço; quartos só se o fato for quartos); a IA só acrescenta
  `hypothesis`. Confiança é do código: `needs_validation` se for hipótese (low_traction), tiver < 2 evidências ou
  houver ressalva (Instagram desconectado, 1 fonte só, poucos posts, coleta velha); senão `high` (≥4
  evidências e ≥3 fontes independentes), `medium` (≥2 e ≥2) ou `low`.
- **Prioridade explicável (código):** (1) nº de evidências com fonte, (2) nº de imóveis ligados, (3) fontes
  independentes; "precisa validar" sempre depois das com base. `priority_reasons` são frases geradas pelo código.
  Nenhuma pontuação inventada.
- **Tabelas:** `market_signals`, `growth_opportunities` (ver "Modelo de dados"). Sem cron. A tela mostra a rodada
  mais recente (sem as descartadas) + as aprovadas de rodadas anteriores; o que falta pra achar mais é calculado
  na tela a partir de contagens (nada é persistido).
- **Etapa 2 — entrada manual de sinais (2026-10-28):** a seção "Sinais de mercado" da tela de Oportunidades
  (`src/pages/dashboard/marketSignals.tsx`) grava direto em `market_signals` com o supabase-js (RLS da empresa;
  `collected_by='manual'`), sem function nem migration. Exige título, nome da fonte e data (não futura) porque o
  motor descarta sinal sem título ou sem fonte; link opcional (http/https). A região sugere (datalist) os valores
  do campo de localização (`config.opportunity_fields.location`) dos itens do catálogo; o rótulo vem da ficha.
  Lista os 50 mais recentes, com apagar (confirmação). Vitrine: botões com cadeado abrem o modal de plano —
  `market_signals` **não** está em `ALLOWED_WRITE_TABLES` do `showcaseGuard`, então o guard também bloqueia a
  escrita. Salvar não roda o motor: o aviso manda clicar em "Encontrar oportunidades" (intervalo de 90 s).
  Divergência: o motor casa região por texto normalizado (igual/contida), então grafia diferente do catálogo não liga.

- **Etapa 4A — plano da oportunidade + rodadas automáticas (2026-10-29) — 🟡 código pronto, falta migration/deploy/teste.**
  Decisão: [DECISIONS.md](DECISIONS.md#2026-10-29--inteligência-comercial-etapa-4-plano-a-e-peças-b-tudo-automático).
  Código: `_shared/opportunityPlan.ts` (lógica pura: prompt, conferência, formato, CTA), `opportunityPlanRun.ts`
  (banco + IA: `decideOpportunity`, `createOpportunityPlan`, `approveOpportunityPlan`), `opportunityCron.ts`
  (rodadas automáticas). Tela: `opportunityPlan.tsx`. Testes: `scripts/test-opportunity-plan.mjs`.
  - **Actions do `marketing-ai`:** `decide_opportunity` {opportunity_id, status: approved|dismissed|suggested} (JWT +
    empresa do login + `requirePaidAccess`; grava status/decided_at/decided_by com a service role filtrando
    `company_id`; ao aprovar sem plano, cria o plano em `EdgeRuntime.waitUntil` e responde na hora);
    `approve_opportunity_plan` {opportunity_id, undo?} (grava `plan_approved_at`); `cron_opportunities` (cron_secret
    no corpo, antes do ramo de cron genérico do arquivo). **Não existe action de criar/refazer plano manualmente.**
  - **Plano (1 chamada à IA, `claude-sonnet-4-6`, 2000 tokens):** entrada = oportunidade (título, problema, público,
    ação, medir, evidências com tipo/fonte/data) + imóveis ligados lidos pelos papéis da ficha, tudo em `<dados>`
    saneado. Saída gravada em `growth_opportunities.plan`; `plan_generated_at=now()`, `plan_approved_at=null`.
    Validação em código (reaproveita `opportunityOutput.ts`): número só se estiver nas evidências/imóveis com a
    unidade certa; Fair Housing em todo texto (público vazio cai no da oportunidade, se limpo); promessa de resultado
    ("garantido", "vai vender", "+X%") tira a frase; métrica sem número; `format_suggestion` só
    carousel/reel/post/story (inválido ou sem motivo → `post` marcado como "formato padrão"); `item_ids` só da
    oportunidade; evidências citadas viram snapshot do que está guardado. **CTA:** pedido de comentário com
    palavra-chave vira o alternativo da ficha (`ctas.sem_automacao`; inglês: "Send us a DM") e o plano marca
    `cta_replaced`. Custo (inclusive falha) em `agent_performance`, `task_key='create_opportunity_plan'`, com
    `task_description` começando por `opp:<id>`.
  - **Limite:** 5 planos/empresa/24 h (429 com mensagem pt/en), contando também tentativas em andamento (linha
    `create_opportunity_plan_start` gravada antes da IA; falha devolve a vaga); no máx. 2 falhas por oportunidade em 24 h
    (vale para aprovar e para o cron). Com 429 a oportunidade fica sem plano e o cron gera depois. Plano já existente nunca
    é regerado. Desfazer/descartar a oportunidade zera `plan_approved_at`; o plano gerado em segundo plano só é gravado
    se a oportunidade ainda está aprovada. Busca que falhou há < 6 h não é repetida pelo cron.
  - **Rodadas automáticas (`cron_opportunities`):** por empresa elegível (`auto_strategy=true`, interruptor geral
    `hermes_config.auto_strategy_enabled`, `hasPaidAccess`, ativa, ficha com `opportunity_fields`): roda a busca se a
    última rodada (`agent_performance` `run_opportunities` com sucesso — agora gravada também com 0 candidatos) tem > 7
    dias OU há `market_signals` criado depois dela; e cria o plano das aprovadas sem plano. Até 3 empresas por chamada
    e nenhuma IA nova depois de 40 s (cabe nos 150 s); responde na hora e trabalha em segundo plano.
  - **Agendamento — EXISTE desde 2026-10-29** (cron `opportunities-auto`, a cada 6 h, minuto 17; a nota original dizia
    "não criado", mantida abaixo como histórico). SQL de referência (o segredo vem do mesmo lugar dos outros crons — não
    escrever o valor aqui):
    ```sql
    select cron.schedule('opportunities-auto', '0 */6 * * *', $$
      select net.http_post(
        url := 'https://<PROJECT_REF>.supabase.co/functions/v1/marketing-ai',
        headers := '{"Content-Type":"application/json"}'::jsonb,
        body := jsonb_build_object('action','cron_opportunities','cron_secret','<CRON_SECRET igual aos outros crons>')
      );
    $$);
    -- desfazer: select cron.unschedule('opportunities-auto');
    ```
    `marketing-ai` precisa estar deployada com `--no-verify-jwt` (PITFALLS "verify_jwt × chamada de cron").
  - **Notícias de mercado automáticas (Etapa 3, 2026-10-30 — 🟡 código pronto, falta migration + deploy):** dentro do
    `cron_opportunities`, por empresa elegível e ANTES de `shouldRunOpportunities`, `marketNewsRun.ts` busca na Tavily
    (`topic:'news'`, `search_depth:'basic'`, `exclude_domains` da ficha) as notícias das até 3 regiões do catálogo com mais
    itens e grava em `market_signals` (`collected_by='system'`, `meta.provider='tavily'`); sinal novo já dispara nova rodada
    e a `market_change` aparece. Lógica pura em `marketNews.ts` (filtros: data válida/não futura/≤ days, região no
    título ou trecho, sem portal, só https, link único por empresa pelo índice `market_signals_system_url_uq`). Texto de
    setor na ficha: `config.market_news` (migration `20261030100000_noticias_automaticas.sql`). Limites: 3 buscas e 5
    sinais novos por empresa/7 dias; `MARKET_NEWS_MONTHLY_CAP` (padrão 120) conta `agent_performance`
    `task_key='market_news_search'`. Chave: `getTavilyKey` (env `TAVILY_API_KEY` ou `_app_config`); respeita o interruptor
    `insight_sources` tavily. Teste: `scripts/test-market-news.mjs`. Decisão: [DECISIONS.md](DECISIONS.md#2026-10-30--inteligência-comercial-etapa-3-notícias-de-mercado-automáticas).
  - **Tela:** sem botões de gerar; mostra "Próxima análise automática: semanal (e quando você cadastra um sinal novo)"
    e a data da última análise; oportunidade aprovada sem plano mostra "Montando o plano…" (recarrega a cada 10 s por 2
    min, depois "o plano sai na próxima rodada automática"); botões "Aprovar plano"/"Desfazer aprovação".
    Aprovar/descartar a oportunidade passou de update direto no banco para `decide_opportunity` (o grant de update do
    cliente continua existindo, sem uso pela tela).
- **Estado:** 🟡 código e teste de lógica prontos; falta aplicar a migration em produção (depois do merge), fazer
  o deploy do `marketing-ai` e rodar na Tespon. A Etapa 1 **não** publica nem envia nada.

- **Etapa 4B — plano aprovado → peças em rascunho (2026-10-29) — 🟡 código pronto; migration/deploy/teste em produção por fazer.**
  Decisão: [DECISIONS.md](DECISIONS.md#2026-10-29--inteligência-comercial-etapa-4b-plano-aprovado--peças-em-rascunho-automático).
  Código: `_shared/opportunityPieces.ts` (lógica pura: formato sem vídeo, quantidade, limites, idempotência, mapa da
  ficha), `opportunityPiecesRun.ts` (banco + despacho), `opportunityPieceJob.ts` (monta a vaga no `creative-generate`).
  Testes: `scripts/test-opportunity-pieces.mjs`. Migration: `20261029130000_oportunidade_pecas.sql` (aditiva).
  - **Fluxo completo:** `run_opportunities` (cron/sinal novo) → oportunidade **sugerida** → dono **aprova** (`decide_opportunity`)
    → plano criado sozinho (`createOpportunityPlan`) → dono **aprova o plano** (`approve_opportunity_plan`) →
    `marketing-ai` chama `generateOpportunityPieces` em segundo plano → por peça, `POST creative-generate {action:'plan_slot',
    cron_secret, company_id, opportunity_id, piece:{format, mode:'item'|'text', item_id?}}` (responde 202) →
    `buildOpportunityJob` **recarrega o plano do banco** (empresa + status aprovado + `plan_approved_at`; o corpo não é
    confiado) e monta a vaga → `runPlanSlot` (o mesmo do calendário): modo texto = `generateForCompany` (carrossel de
    slides com `intent` do plano), modo foto = `catalog-package` (`only_recipe`, `loose`) → peça em `marketing_ai_test_content`
    (rascunho) com `opportunity_id` e `intent` (`SlotIntent.opportunity`, sem `pilar_ss`) → nota de qualidade → vault =
    **Central de Aprovações** → dono aprova → `agent-actions` cria o `posts` **copiando `opportunity_id`** (bloco separado e
    tolerante, como os rótulos). `make_now` (login do dono) ignora `opportunity_id`.
  - **Formato:** plano `carousel|post|story` → mapa da ficha `config.opportunity_pieces` (`{carousel:{item,text},…}`); só
    formato `live`; foto = `item_package` com receita, texto = `post`; **`item_video`/`dm` nunca**. `reel` → carrossel +
    nota em `plan.pieces_info.notes`. `plan.pieces_count` (1–3, padrão 2) e `plan.pieces_info` (o que foi feito).
  - **Limites/custo:** 3 por plano (também conferido no `creative-generate`), 6 por empresa por dia (`opportunity_pieces`).
  - **Cron:** `cron_opportunities` passa a também pedir as peças dos planos aprovados sem peças (só despacha; sem IA, não
    ocupa vaga das 3 empresas). Resumo agora traz `pieces`.
  - **Tela:** oportunidade com plano aprovado mostra "Gerando as peças…" (recarrega a cada 10 s por 15 min), depois
    "N peças na Central de Aprovações" com link para `/dashboard/aprovacoes` (só rascunhos pendentes; "M em revisão de qualidade" se alguma não
    chegou ao vault e "K aprovadas" para os posts já aprovados/publicados). Na Central, a peça mostra o selo "Da oportunidade: <título>".
  - **Qualidade:** `claimGuard`/`hasUnsupportedClaim` (opportunityOutput.ts) tiram frases com adjetivo de mercado sem
    dado nos fatos (lista: ficha `opportunity_texts.market_claims`, senão `DEFAULT_MARKET_CLAIMS`); `photoCounts` entra no
    prompt do `run_opportunities` e do plano, e `actionForPhotos` troca a ação por "adicionar fotos reais" quando o item
    não tem foto.
  - **Divergências/atenção:** (a) o vínculo `opportunity_id` é gravado num UPDATE à parte (migration pendente não derruba
    a peça), mas `generateOpportunityPieces` **não gera** se a coluna não existe (sem idempotência não há segurança);
    (b) o cliente pode ter UPDATE direto em `marketing_ai_test_content`: a Etapa 6 deve juntar `opportunity_id` **sempre
    filtrando por `company_id`** dos dois lados; (c) desfazer a aprovação do plano **não apaga** peças já geradas.
  - **Reverter:** bloco "Como reverter" no próprio arquivo da migration; as functions voltam pelo commit anterior.

- **Etapa 5 — página pública do imóvel + link rastreável (2026-10-30) — 🟡 código pronto; migration/deploy/aprovação do dono por fazer.**
  Decisão: [DECISIONS.md](DECISIONS.md#2026-10-30--inteligência-comercial-etapa-5-página-pública-do-imóvel--link-rastreável--lead-com-origem).
  Código: `_shared/publicPage.ts` (puro: código sem ambíguos, lista branca de campos, fotos reais, validação do lead, limites,
  `wa.me`/`ig.me`, hash do visitante, frase com link uma vez só), `_shared/publicPageRun.ts` (banco). Tela pública
  `src/pages/public/PublicPropertyPage.tsx` (rota `/p/:code`, fora do `ClientRoute`); tela do dono `PublicPageButton.tsx` (no card do
  imóvel em `CatalogItems.tsx`). Teste: `scripts/test-public-page.mjs`. Migration: `20261030110000_pagina_publica_imovel.sql`.
  - **Modelo:** `public_pages` (item_id PK, `enabled`, `approved_at/by`, `contact_phone/contact_ig` copiados na aprovação),
    `tracked_links` (`code` 8 caracteres, único por imóvel + oportunidade + canal), `link_events` (`view`/`click_whatsapp`/
    `click_dm`/`lead`, `visitor_hash`, nunca IP), e `leads` ganha `item_id`, `opportunity_id`, `link_id`, `consent_at`, `consent_text`.
    RLS: dono/owner só leem; escrita só service role. Variável opcional `PUBLIC_PAGE_SALT` (sal do hash do visitante; sem ela usa `CRON_SECRET`). Ficha `imoveis_rio.config.public_page` = `fields` (lista branca), `min_photos`,
    `country_code`, `caption_line`.
  - **Ações do `marketing-ai`:** públicas (sem login, antes de auth/cron): `public_page_get`, `public_page_event`,
    `public_page_lead`. Com login + plano pago: `get_public_page` (prévia/estado) e `set_public_page {item_id, enabled}` (aprovação).
  - **Onde o link entra:** `opportunityCron.ts` → `attachTrackedLinks` (rascunhos de oportunidade, canal `caption`, uma vez só,
    nunca peça aprovada); `item-videos` `list` → mensagem NOVA do QUERO ganha o link (canal `dm`). `creative-generate` e
    `instagram-webhook` NÃO foram tocados.
  - **Divergência:** a Etapa 5 do ROADMAP falava em "encaminhar ao corretor" e em tocar o `instagram-webhook` — nenhum dos dois
    foi feito (corretor = Etapa 7; DM/comentário seguem sem atribuição).
  - **Reverter:** bloco "Como reverter" na migration; as functions voltam pelo commit anterior; o site pelo `wrangler rollback`.

- **Etapas 6 e 7 (mínimas) — resultados por oportunidade + corretor sem login (2026-10-30) — 🟡 código pronto; migration/deploy por fazer.**
  Decisão: [DECISIONS.md](DECISIONS.md). Migration `20261030120000_resultados_e_equipe.sql`: `brokers` (RLS só da dona; owner da
  plataforma lê), `leads` + `visit_at/proposal_at/proposal_value/closed_at/closed_value/assigned_broker_id`, `link_events.broker_id`,
  funções `assign_next_broker` (security definer, só service_role) e `opportunity_results` (security invoker). Código:
  `_shared/publicPageRun.ts` (rodízio no lead; corretor no clique), `src/pages/dashboard/resultsBrokers.ts` (lógica pura),
  `opportunityResults.tsx` (card da oportunidade), `settings/BrokersCard.tsx`, `marketingAi/FunnelTab.tsx`. Teste:
  `scripts/test-results-brokers.mjs` (+ casos de corretor em `test-public-page.mjs`). As telas caem no comportamento antigo se a migration
  ainda não foi aplicada (consulta de leads sem as colunas novas; sem bloco de resultados).
  - **Reverter:** bloco "Como reverter" na migration; functions e site voltam pelo commit anterior.

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
- **Importar do portal (2026-10-14):** `portal-import` lê o XML VRSync
  (padrão ZAP/VivaReal) que o CRM do corretor já gera pros portais — grátis,
  sem API paga. Ações `preview` (lista os anúncios e guarda o link em
  `company_integrations`, type `portal_feed`) e `photo` (proxy da foto,
  porque o CDN do CRM não libera CORS). Proteção de proxy: só https, sem IP
  interno, redirect validado, teto de tamanho. O dono escolhe quais anúncios
  importar em Agente de Dados → Catálogo (`CatalogImport.tsx`); as fotos
  passam pelo mesmo corte 4:5 do upload manual e o item guarda
  `meta.source.listing_id` (evita importar 2x). O mapa anúncio → campos fica
  na ficha (`config.catalog_import`). Conta vitrine recebe 402. Ainda **não
  sincroniza sozinho** — reimportar é manual.

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

> **Removida em 2026-10-19 (decisão do dono).** A página e o gate saíram. Quem paga
> ou é liberado à mão entra direto no painel.
> - As respostas do diagnóstico são importadas pra empresa no 1º acesso
>   (`importDiagnosisAnswers` em `src/lib/onboardingV2.ts`, chamado no `DashboardLayout`).
> - O sino (`src/lib/usePendencias.ts`) cobra o que falta: dados do negócio, perguntas,
>   fotos e Instagram.
> - `/setup` redireciona pra `/dashboard/settings?section=entendimento`.
> - `useSetupStatus` e `setupRules` continuam: a tela da estratégia usa pra dizer o que falta.
>
> O texto abaixo é histórico.

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

> **Divergência (2026-10-13):** o `ClientRoute` não prende mais conta nova sem
> pagamento em `/gratis` ("modo grátis" de 2026-10-10). Ela vira **modo vitrine**:
> `isShowcaseMode` (`src/lib/setupGate.ts`) navega por todo o `/dashboard/*` em
> somente visualização (`ShowcaseProvider` + `src/lib/showcaseGuard.ts`) e o
> servidor barra o que gasta/publica (`supabase/functions/_shared/access.ts`,
> ver [PITFALLS.md](PITFALLS.md)). O `/setup` segue só depois de pagar e a
> ordem dos checks do `ClientRoute` não mudou. Detalhes em
> [DECISIONS.md](DECISIONS.md) (2026-10-13).

## Estado do trial (atualizado 2026-10-02)

Antes: 3 dias fixos, estados `trial_day_1/2/3`. Agora: o total vem do par
`trial_started_at`/`trial_expires_at` (`TrialInfo.totalDays`; padrão novo
`TRIAL_DAYS = 7`), estado único `trial_active` (+ `trial_expiring` nas
últimas 6h). `claim-diagnostic` ainda grava 3 dias até ser deployada.
O painel do trial (`TrialSummaryPage`) mostra só contagens reais das
tabelas existentes; sem dado, "Hermes ainda está analisando".
