# Sales Boost — O gerenciador de crescimento do seu negócio

> **Tagline:** "A plataforma que te faz conhecer seu cliente"
> **Promessa:** gerar mais receita automaticamente para qualquer negócio local.
> **Foco atual:** Jarvis — o assistente de voz com IA que executa tarefas de marketing e vendas.

## O que é (visão de produto)

Sales Boost é o **"gerente de crescimento"** que trabalha sozinho pelo pequeno
negócio. Serve qualquer tipo de comércio ou serviço — varejo, beleza, saúde,
food, clínicas, academias, franquias. Não é um conjunto de ferramentas soltas
— é **UM produto** com 4 peças que se reforçam:

1. **Jarvis (assistente de voz + agentes)** — interface principal do produto.
   O dono fala por voz (ou texto) e um time de agentes de IA executa tarefas de
   marketing e vendas. Cada agente tem personalidade, ferramentas e especialidade
   próprias (CMO/Marketing e Sales Rep/Vendas — ver `agents/`).
   Rota `/jarvis` — tela HUD 3D estilo Tony Stark, sempre ouvindo.
2. **Agente chat (texto)** — fallback/alternativa ao Jarvis por voz. O dono fala
   em linguagem natural e o agente executa tarefas. Rota `/dashboard/agente`.
3. **Revenue Opportunities** — encontra a receita parada na mesa (leads sem
   resposta, avaliações negativas, consultas não confirmadas) e resolve com 1 clique.
4. **Dashboard** — métricas do negócio + histórico do que o agente fez e o que
   está pendente de aprovação.

**Princípio central:** o Sales Boost gera receita no piloto automático, mas
**nada vai ao público sem aprovação do dono** (human-in-the-loop).

## Stack

- **Frontend:** React + Vite, TypeScript, Tailwind CSS, deploy via Cloudflare Workers.
- **Auth/DB:** Supabase (Auth + Postgres + RLS). *(já implementado)*
- **Agente:** Supabase Edge Functions definem as *ferramentas* (postar, ler
  leads, responder review) e guardam os dados — mas quem raciocina de verdade
  (Jarvis, chat do dashboard, ciclo autônomo) é o **Hermes**, um servidor
  externo (VPS separada, fora do Supabase e do Cloudflare) chamado via
  `hermes-proxy`. *(`agent-chat`, a versão antiga que chamava a Claude
  diretamente, está deprecada — nenhuma tela chama mais essa função)*
- **Telegram tem cérebro próprio e independente:** `telegram-chat` fala direto
  com a Claude (Anthropic), sem passar pelo Hermes — decisão deliberada pra
  manter o canal principal com clientes estável mesmo quando o Hermes falha
  (ver "Ciclo autônomo" abaixo).
- **Voz (Jarvis):** Web Speech API (STT nativo do browser, pt-BR/en-US) →
  `hermes-proxy` edge function (Hermes + tools + contexto da empresa) →
  `voice-tts` edge function (ElevenLabs).
  PT voice ID: `CstacWqMhJQlnfLPxRG4` | EN voice ID: `cCYjmrGZaI86GUJ7F2Nn`
- **3D Jarvis Orb:** Three.js — 900 partículas Fibonacci + wireframe + inner glow.
  4 estados animados: idle / listening / thinking / speaking.
- **Canais de integração:** Instagram, WhatsApp (API Cloud oficial),
  Google Business Profile (Maps/Reviews), E-mail. *(novos, entram por etapas)*
- **Coleta de dados:** Apify (reviews, redes sociais, Maps) + Google PageSpeed
  Insights (diagnóstico de site).
- **IA:** Claude API (`claude-sonnet-4-6`) — análise de reviews, geração de posts,
  planos de ação, respostas a leads.
- **PDF:** apitemplate.io (`create-pdf-from-html`) — geração de relatórios mensais.
- **Email:** Resend via Supabase Edge Functions.
- **Pagamentos:** Stripe (assinatura mensal BRL/USD).

### Regras de arquitetura
- Multi-tenant: tabela `companies` é a raiz; toda tabela tem `company_id` com RLS.
- Roles: `owner` (operador/admin), `client` (dono do negócio).
- Nunca expor chaves de API no frontend — chamadas à Claude API e integrações
  sempre via Supabase Edge Functions.
- i18n desde o início — nunca strings hardcoded na UI.
- Deploy: `npm run build` → `npx wrangler deploy` (manual; sem CI/CD pipeline).
- Wrangler token salvo em `C:/Users/Lenovo/AppData/Roaming/xdg.config/.wrangler/config/default.toml`.

## Brand

- **Primary:** `#FF6D29` (laranja)
- **Card BG:** `#150E08`
- **Page BG:** `#0E0B0A`
- **Muted:** `#BABABA`
- **Font:** `'Bricolage Grotesque', system-ui, sans-serif`
- Design dark, técnico, premium. Sem gradientes genéricos. Animações sutis.

## Jarvis — Arquitetura de voz e agentes

### Loop de voz (atual)
```
🎤 Fala  →  Web Speech API (pt-BR/en-US)  →  texto
       ↓
   hermes-proxy edge function (Supabase: tools + dados da empresa)
       ↓
   fetch para HERMES_URL (VPS externa — quem realmente raciocina)
       ↓
   hermes-proxy executa as ferramentas que o Hermes pediu (grava no banco de verdade)
       ↓
   resposta em texto  →  voice-tts edge function (ElevenLabs)  →  🔊 áudio
       ↓
   JarvisOrb reage (idle → listening → thinking → speaking)
```
Importante: o Hermes (a VPS externa) não tem identidade própria — ele só
"veste" o prompt/ferramentas que o `hermes-proxy` manda a cada mensagem. Quem
executa de verdade (criar post, salvar lead) é sempre o `hermes-proxy`
(Supabase), nunca o Hermes.

### Agentes (papéis ativos)
Cada agente = system prompt + tools, definidos em `hermes-proxy`. Todos
compartilham contexto da empresa (`companies`) e memória (`agent_messages`,
`agent_memory`, marcada por agente).

| Agente | Especialidade | Status |
|--------|--------------|-------|
| Geral | Posts, conteúdo, reputação, concorrência, diagnóstico do site, atendimento (leads/follow-up) | **Ativo** — único papel hoje. Chave interna continua `marketing` em `hermes-proxy` (não renomeada no banco pra não quebrar histórico de `agent_messages`/`agent_performance`); só o nome exibido virou "Agente Geral". Liga/desliga em `/owner/agentes` (Agents Control Center → "Agentes Ativos"). |
| Dev (Claude) | Executa código — sou eu | Ativo |

**Agente de Vendas foi excluído em 2026-07-25** (decisão do dono) — antes
disso ficou pausado desde 2026-07-14 (0 execuções automáticas, 0 mensagens
reais, sem integração de captura de lead). As ferramentas de lead/follow-up
(`list_leads`, `create_lead`, `update_lead_stage`, `draft_followup`)
continuam existindo em `hermes-proxy` — o Agente Geral já tinha acesso a
elas (`tools: ALL_TOOL_NAMES`) e continua tendo. O que foi removido de fato:
o papel `sales` em `AGENT_ROLES`, a decisão `run_sales` do orquestrador
(`decideRolesToRun` hoje só decide `run_marketing`), e a linha `sales` nas
tabelas `agent_roles`/`capability_registry.used_by`.

Chat de texto (`/dashboard/agente`) sempre usou só esse agente. Jarvis por
voz (`/jarvis`) também mostra só ele agora (seletor só aparece com 2+
agentes disponíveis — hoje sempre 1, então o seletor fica oculto).

### Ciclo autônomo

O `hermes-proxy`, em modo cron (`cron_secret`), primeiro pergunta ao Hermes
(papel "orquestrador", só leitura) se vale a pena o Marketing e/ou o Vendas
agir agora (`decideRolesToRun`) — e só então roda de fato o papel indicado
(`runAutonomousCycle`), usando as mesmas ferramentas do chat interativo.
Isso é disparado por `run-agents` (hoje um atalho fino que só repassa pro
`hermes-proxy`).

**Dois agendamentos automáticos coexistem hoje** (vale confirmar com quem
administra a VPS se os dois ainda são necessários ou se um virou redundante):
1. **VPS `srv1824556`** — systemd timer `sales-boost-marketing.timer` →
   script `/opt/sales-boost-cron/marketing_cycle.sh`, a cada 30 min.
2. **pg_cron nativo do Supabase** — jobs recorrentes chamando as edge
   functions direto (`instagram-auto-post-daily` → `run-agents`,
   `generate-posts-weekly`, `detect-opportunities-daily`, e o novo
   `generate-tab-insight-daily`), sem depender de nenhuma VPS.

> ⚠️ **Armadilha real (achada em 2026-09-16, já corrigida):** toda edge
> function chamada por `net.http_post` do pg_cron autentica via
> `cron_secret` no CORPO da requisição, de propósito — nunca manda header
> `Authorization` nenhum. Se a function estiver deployada com o padrão do
> Supabase (`verify_jwt = true`), o GATEWAY da plataforma barra a chamada
> com 401 `Missing authorization header` **antes** do código da function
> rodar — e `cron.job_run_details` mostra `"succeeded"` mesmo assim (esse
> status só confirma que o `net.http_post` foi enfileirado, não que a
> chamada HTTP teve sucesso). É silencioso: nada quebra na tela, o cron
> "roda" todo dia, só que nunca faz nada. Foi o que aconteceu com
> `agent-actions` (publicação agendada do Vault), `creative-generate`
> (geração diária + Calendário da Semana), `detect-opportunities`,
> `creative-ideas`, `generate-posts`, `brand-kit-suggest`,
> `map-competitors` e `monitor-competitor-social` — todas corrigidas
> deployando com `supabase functions deploy <nome> --no-verify-jwt`
> (o código interno de cada uma já validava JWT de usuário real OU
> `cron_secret` corretamente; só o gateway estava barrando antes de
> chegar lá). **Qualquer function nova que for chamada por cron E por
> usuário logado precisa desse mesmo `--no-verify-jwt` no deploy** — sem
> isso, o caminho do cron fica morto em silêncio.

Cada função abaixo decide sozinha se vale a pena agir (não é "acordar e
sempre fazer tudo de novo"):

| Passo | Decide agir quando... | Fica quieto quando... |
|-------|------------------------|------------------------|
| `detect-opportunities` | sempre varre (é barato) | nada mudou desde a última checagem — não reavisa |
| `draft-reply` | há review sem `ai_draft` ainda | já rascunhou tudo que existia |
| `generate-posts` | sinal `no_content` está aberto (sem post há 7+ dias) | já existe `stale_draft` (pilha esperando aprovação) — gerar mais só pioraria |
| `map-competitors` | não escaneia essa empresa há 7+ dias | já escaneou recentemente — evita gastar cota do Google Places + IA à toa |
| `monitor-competitor-social` | não checa redes dos concorrentes há 7+ dias | idem — cada checagem é uma chamada real ao Apify |
| `site-diagnosis` | site mudou de URL, ou já fazem 30+ dias do último diagnóstico | site igual e diagnóstico recente |
| `content-intelligence` (campanha) | não gerou campanha há 7+ dias e não há `stale_draft` aberto | já existe `stale_draft` (rascunhos parados) — criar mais posts só pioraria |
| `generate-tab-insight` | já fazem 7+ dias desde o último relatório daquela aba | relatório daquela aba ainda está fresco |

**Hermes (a VPS externa do `HERMES_URL`) hoje é instável** — falhas
observadas (erro 502/timeout). Por isso o Telegram foi deliberadamente
mantido **fora** desse caminho (`telegram-chat` fala direto com a Claude).
Se o Jarvis/chat do dashboard começar a falhar, o primeiro suspeito é essa
VPS externa — só quem administra ela vê os logs de verdade.

**Vendas segue sem ciclo autônomo de propósito** (ver tabela acima) — não
existe fonte de dado de lead ainda. Ver `agents/sales/SKILL.md` para o que
falta construir antes disso fazer sentido.

Toda ação real do agente (post criado, resposta rascunhada, oportunidade
nova) é reportada em dois lugares, sempre com o motivo:
1. **Telegram** — via `notifyMarketing()` → Cloudflare Worker `marketing-bot`
   (`/notify`) → evento `AGENT_ACTION` para execuções, `OPPORTUNITY_DETECTED`
   para achados novos. Respeita `companies.notification_prefs` (o dono pode
   desligar cada categoria em Configurações). *(O recebimento de mensagens do
   Telegram já não passa mais pelo `marketing-bot` — ver "Telegram" abaixo.)*
2. **Aba Atividades** (card "Atividade dos Bots" na Overview, `bot_notifications`)
   — mesmo texto exato enviado ao Telegram, logado pelo worker via
   `log-bot-event` depois do envio. Clique num item abre popup com a
   descrição completa e o motivo.

### Telegram — infraestrutura (migrado do Cloudflare pro Supabase em 2026-07-13)

- **Recebimento de mensagens:** `telegram-webhook` (Supabase) — substituiu o
  Cloudflare Worker `marketing-bot` nesse papel, porque os logs do Worker
  eram um ponto cego (sem acesso pra debugar). Chama `telegram-chat` pra
  responder.
- **Resposta ao usuário:** `telegram-chat` (Supabase) — fala direto com a
  Claude (Anthropic), com ferramentas próprias de leitura de dados reais
  (posts, oportunidades, avaliações, diagnóstico, concorrentes, leads) e
  regra estrita de nunca inventar números (usa `count: 'exact'` do Postgres).
  Modelo: `claude-sonnet-4-6`.
- **Envio de avisos automáticos** (`AGENT_ACTION`, `OPPORTUNITY_DETECTED` etc.)
  ainda é o Cloudflare Worker `marketing-bot`, rota `/notify` — não migrou.
- **`vendas-bot`** (Cloudflare Worker, bot de Vendas) ainda **não foi
  migrado** — recebe e envia mensagens direto no Cloudflare, com o mesmo
  ponto cego de logs que o `marketing-bot` tinha antes de migrar.
- **`group-manager`** (Cloudflare Worker) cria os grupos privados do
  Telegram e convida os bots — usa uma biblioteca de cliente Telegram
  (login como usuário, não como bot), tecnologia bem diferente dos outros
  dois; não é candidato óbvio a migrar pro Supabase.

## As 4 peças do produto

### 1. Jarvis (voz + HUD 3D)
- **Rota:** `/jarvis` — tela full-screen fora do dashboard.
- **Motor:** `hermes-proxy` edge function (tool use via Hermes, VPS externa).
- **Voz entrada:** Web Speech API (browser-native, grátis).
- **Voz saída:** ElevenLabs via `voice-tts` edge function.
- **Toggle "Sempre ouvindo":** reinicia STT 700ms após ficar idle.
- **Fallback gracioso:** sem `ELEVENLABS_API_KEY` → modo texto, nada quebra.

### 2. Agente chat (texto)
- **Rota:** `/dashboard/agente`
- **Motor:** `hermes-proxy` edge function (tool use via Hermes). Cada empresa
  tem contexto próprio (nome, tipo, cidade, Instagram, objetivo) injetado no
  system prompt.
- **Ferramentas que o agente pode chamar — todas com aprovação humana:**
  - `create_post` — cria rascunho de post para aprovação
  - `create_multiple_posts` — cria vários rascunhos de uma vez (semana de conteúdo)
  - `content-intelligence` (edge function própria, aba Conteúdo → Viral Trends /
    Campanhas) — identifica tendências do segmento e monta campanhas (vários
    posts agrupados). Uma vez por semana o agente já faz isso sozinho com base
    na tendência do momento, deixando os posts em rascunho na aba Campanhas —
    sempre esperando aprovação, nunca publica.
  - *(futuro)* listar leads sem resposta e rascunhar follow-up (WhatsApp / E-mail)
  - *(futuro)* ler avaliações e rascunhar resposta (Google)
  - *(futuro)* consultar métricas do dashboard
- **Regra de ouro:** o agente **nunca** publica ou responde sozinho —
  gera rascunho → dono aprova na aba Posts → então executa.
- **Histórico:** conversas salvas em `agent_messages` por empresa.

### 3. Revenue Opportunities
Varre os canais e lista oportunidades com valor estimado, ex.:
- "3 leads sem resposta há +24h"
- "7 avaliações negativas sem resposta"
- "5 consultas/reservas não confirmadas"

Cada item tem uma ação sugerida. O botão **"Resolver tudo"** faz o agente montar a
fila de ações e apresentá-la para **aprovação em lote** (Fase 5).

### 4. Dashboard
Métricas (receita recuperada, leads respondidos, posts publicados, reputação) +
timeline do que o agente fez e o que está pendente de aprovação. Desde
2026-07-14, cada aba de dados (Avaliações, Opiniões, Crescimento, Diagnóstico
de links, Concorrentes, Performance, Audiência — tudo exceto Conteúdo) tem um
quadro "Análise do agente": um resumo curto + sugestões gerado por IA
(`generate-tab-insight`, tabela `insights_reports`), atualizado sozinho 1x/dia
via pg_cron (só reprocessa se já fazem 7+ dias), com botão manual de
atualizar. Serve tanto pro dono quanto de contexto pré-digerido pros agentes.

## Modelo de dados (atual)

```
companies (id, user_id, business_name, business_type, city, website_url, instagram_url, goal, plan, created_at, active, telegram_chat_id, notification_prefs, social_data, google_rating, google_review_count, ...)
user_roles (user_id, role)  -- 'owner' | 'client'
posts (id, company_id, content, platform, status, image_suggestion, best_time, campaign_id, created_at)
  -- status: 'rascunho' | 'aprovado' | 'publicado'
agent_messages (id, company_id, role, content, agent_role, created_at)
  -- role: 'user' | 'assistant'; agent_role: 'marketing' | 'sales'
agent_memory (id, company_id, agent_role, key, value, type, updated_at)
agent_performance (id, company_id, agent_role, task_key, task_description, success, error_message, created_at)
diagnostics (id, company_id, website_url, status, pagespeed_mobile, pagespeed_desktop, frontend_review, created_at)
reviews (id, company_id, source, author, rating, text, review_date, sentiment, themes, owner_reply, google_review_id, created_at)
opportunities (id, company_id, type, title, description, value_estimate, status, created_at)
campaigns (id, company_id, name, goal, brief, source, created_at)
  -- source: 'manual' | 'auto_trend' — posts.campaign_id agrupa os posts de cada campanha
leads (id, company_id, name, contact, channel, stage, value_estimate, notes, last_contact_at, created_at)
lead_messages (id, lead_id, company_id, direction, channel, content, status, created_at)
insights_reports (id, company_id, tab_key, summary, suggestions[], created_at)
  -- tab_key: 'avaliacoes' | 'opinioes' | 'concorrentes' | 'crescimento' | 'performance' | 'audiencia' | 'diagnostico'
```

## Público-alvo

Qualquer dono de pequeno/médio estabelecimento no Brasil — varejo, serviços,
beleza, saúde, food, clínicas, academias, franquias — que quer crescer **sem
precisar virar especialista em marketing**.

- Fase 1: Brasil (foco Rio de Janeiro) + brasileiros nos EUA
- Ticket: R$397–697/mês (BR) ou $197–397/mês (US)
- Decisor: o próprio dono, decisão rápida

## Diferenciais competitivos

1. **Jarvis fala com você** — único assistente de voz IA no mercado BR que executa
   tarefas de marketing por comando de voz, em português.
2. **Conhece o cliente com dados reais da internet (Apify)** — varre reviews,
   redes e Maps para montar o perfil real do cliente.
3. **Diagnóstico de site grátis** — porta de entrada / isca de lead qualificado.
4. **Um agente que EXECUTA, não só mostra relatório** — em PT-BR, preço em R$.
5. **Ninguém faz:** comparação de preços + cruzamento com reviews + plano de ação
   concreto + voz.

## Modelo de cobrança — A DECIDIR

Três hipóteses em aberto:
- **(a)** Assinatura mensal fixa (ex. R$197–R$397/mês). Previsível, fácil de comunicar.
- **(b)** Mensal menor + % da receita recuperada. Alinha incentivos.
- **(c)** Por uso / créditos de ação do agente. Flexível, porém imprevisível.

Custo de API por cliente: ~$0,20–$0,80/mês (Claude Sonnet) + ~$0,10–$0,30/mês
(ElevenLabs). Absorver no preço é viável.

## Estado atual do código

- Site publicado: https://sales-boost-restaurants.luancontasecundaria22.workers.dev/
- **Jarvis ao vivo:** https://sales-boost-restaurants.luancontasecundaria22.workers.dev/jarvis
- Landing page completa com hero, diagnóstico gratuito, pricing.
- Auth com roles `owner`/`client`: `/login`, `/owner`, `/dashboard` + proteção de rota.
- Dashboard com sidebar: Visão Geral, Diagnóstico, Insights, Integrações, Posts,
  Agente, Oportunidades, Concorrentes, Relatório, Configurações.
- **Jarvis:** `/jarvis` — HUD 3D com Three.js orb, voz sempre ativa (toggle), PT/EN.
- Edge functions deployadas: `hermes-proxy` (orquestrador — Jarvis, chat,
  Concorrentes, ciclo autônomo), `telegram-chat` (cérebro do Telegram, direto
  na Claude), `telegram-webhook`/`telegram-connect`/`telegram-link`
  (infra do Telegram), `generate-posts`, `run-diagnosis`, `site-diagnosis`,
  `analyze-reviews`, `import-reviews`, `apify-sync`, `detect-opportunities`,
  `draft-reply`, `map-competitors`, `monitor-competitor-social`, `find-place`,
  `generate-report`, `gsc-metrics`, `gsc-oauth-callback`, `gbp-oauth-callback`,
  `instagram-oauth-callback`, `reply-google-review`, `claim-diagnostic`,
  `create-checkout`, `stripe-webhook`, `check-links-health` (saúde dos links,
  aba Dados → Diagnóstico), `content-intelligence` (tendências + campanhas,
  aba Conteúdo), `generate-tab-insight` (relatório por aba, ver seção
  Dashboard acima), `log-bot-event`, `owner-company-activity`, `run-agents`
  (hoje só um atalho fino que repassa pro `hermes-proxy`),
  **`voice-tts`** (ElevenLabs TTS para o Jarvis).
  - **`agent-chat` está deprecada** — nenhuma tela chama mais, substituída
    pelo `hermes-proxy`. Ainda não foi apagada.
  - **Existem funções rodando em produção sem arquivo local neste projeto**
    (achadas direto via `list_edge_functions`/pg_cron em 2026-07-14, nunca
    puxadas pra cá): `enzo-daily-report`, `hermes-daily-scan`,
    `daily-briefing`, `monthly-report`. Investigar/puxar antes de mexer em
    qualquer coisa relacionada a relatórios ou briefings diários.
- Supabase migrations em `supabase/migrations/` — **atenção:** há bastante
  deriva entre esses arquivos e o schema real de produção (muita coisa foi
  aplicada direto via SQL editor/MCP ao longo do tempo, sem migration local
  correspondente). Não confiar cegamente que os arquivos aqui refletem 100%
  do banco real — conferir com `list_tables`/`list_migrations` antes de
  assumir estrutura.
- i18n via `src/i18n.ts` (dashboard usa `src/i18n-dash.ts`) — seguido de forma
  inconsistente em componentes mais novos (strings em pt-BR hardcoded já
  existem em várias páginas do dashboard).

## Roadmap

- [x] Agente-chat MVP (`agent-chat` edge function + `AgentePage`)
- [x] **Fase 2:** Rate limiting por plano na edge function `agent-chat`
- [x] **Fase 3:** Revenue Opportunities — detector de leads sem resposta + avaliações
      negativas (`detect-opportunities`, `draft-reply`, página Oportunidades)
- [x] **Jarvis MVP:** `/jarvis` com 3D orb (Three.js), voz sempre ativa,
      ElevenLabs TTS, toggle PT/EN, `voice-tts` edge function deployada
- [ ] **Fase 4:** Integrações de canal reais — GBP (OAuth + resposta a reviews)
      e Instagram (sync via Apify) já funcionam; falta WhatsApp e E-mail
- [ ] **Fase 5:** Botão "Resolver tudo" (fila de ações em lote com aprovação)
- [x] ~~**Jarvis Fase 2:** Multi-agente — 7 papéis com `agent_role`, seletor no HUD~~
      — decisão invertida em 2026-07-14: caiu de 6 pra 2 papéis (12/07) e
      depois de 2 pra 1 ativo (Vendas pausado, 0 uso real). Não faz sentido
      crescer o número de agentes antes de ter dado real pra eles decidirem
      sobre — ver "Ciclo autônomo" acima.
- [ ] **Jarvis Fase 3:** Modo "reunião" — CEO orquestra todos os agentes (avaliar se ainda faz sentido dado o item acima)
- [ ] **Jarvis 24/7:** Crons + webhooks para agentes rodarem autonomamente
- [x] Stripe — checkout + webhook (`create-checkout`, `stripe-webhook`)
- [ ] Onboarding self-service com relatório demo em 24h
- [ ] Definir e instrumentar modelo de cobrança final (a/b/c)
- [ ] Automação de deploy: GitHub Actions → sem precisar rodar build+deploy manual

## Concorrentes (referência)

- **Birdeye / ReviewTrackers / Podium** (US): caros, genéricos, só dashboard
- **Falaê** (BR): pesquisa de satisfação + CRM — não faz inteligência de preços
- **Zenchef / Gastroranking** (EU): gestão de reviews atrelada a reservas
- **Diferencial:** ninguém cruza preços + reviews + plano de ação + agente que
  executa + **voz em PT-BR**

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
ELEVENLABS_VOICE_ID=         # opcional; padrão configurado por idioma no JarvisPage
APITEMPLATE_API_KEY=         # PDF de relatórios mensais
```

---

## Regras de agentes (Ruflo / Claude Code)

- Do what has been asked; nothing more, nothing less
- NEVER create files unless absolutely necessary — prefer editing existing files
- NEVER create documentation files unless explicitly requested
- ALWAYS read a file before editing it
- NEVER commit secrets, credentials, or .env files
- Keep files under 500 lines
- Validate input at system boundaries
- **Nunca** expor chaves de API no frontend — sempre via Supabase Edge Functions
- **i18n sempre** — nunca strings hardcoded na UI
- **Human-in-the-loop** — o agente nunca publica ou envia mensagens sem aprovação

### Comunicação com o usuário (Luan)
- Luan NÃO é desenvolvedor. Falar em linguagem simples e direta.
- Nada de jargão técnico sem explicação.
- Quando algo precisa ser feito no terminal, dar o comando pronto.
- Foco: funciona? O que ele precisa fazer agora?

### Coordenação de agentes (SendMessage-First)

```
Lead (you) ←→ architect ←→ developer ←→ tester ←→ reviewer
```

- ALWAYS name agents — `name: "role"` makes them addressable
- Spawn ALL agents in ONE message with `run_in_background: true`
- After spawning: STOP, tell user what's running, wait for results
- NEVER poll status — agents message back or complete automatically

### Quando usar swarm
- **YES**: 3+ files, new features, cross-module refactoring, API changes
- **NO**: single file edits, 1-2 line fixes, docs updates, config changes

### Build & Test

```bash
npm run build && npx wrangler deploy
```

Sempre verificar que o build passa antes de reportar tarefa como concluída.
