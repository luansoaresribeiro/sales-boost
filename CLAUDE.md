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

## Arquitetura do ciclo de crescimento (referência oficial)

Fluxo de ponta a ponta que todo trabalho de crescimento passa (ou devia
passar) — da coleta de dado até resultado realimentando a próxima decisão.
**Esta seção é a referência oficial** desse fluxo; qualquer descrição antiga
em outra parte deste arquivo que conflitar com o veredito abaixo, vale o
veredito abaixo. Auditado contra o **código real** em 2026-09-30 (não contra
comentário/documentação antiga) — várias etapas aqui marcadas "parcial" têm
código de verdade cobrindo só um pedaço da ideia completa.

Legenda: ✅ existe e funciona como descrito · 🟡 existe parcialmente · ❌ não existe ainda.

1. **Data Agent** (catálogo com fotos reais + negócio/onboarding +
   concorrentes/mercado + resultados, tudo num lugar) — 🟡 parcial.
   `supabase/functions/data-agent/index.ts` (a function de verdade, chamada
   por `strategy-generate`/pelo frontend) + `shared/data-agent/domains.ts`
   (schema estático — títulos, perguntas, `gaps` por domínio). **Correção
   registrada em 2026-09-30:** `data-agent/index.ts` NÃO importa
   `domains.ts` — o campo `gaps` nunca sai na resposta real da function.
   Quem lê `domains.ts` (incluindo `gaps`) é só o FRONTEND, direto
   (`IntelligenceDomainsPanel.tsx` e `HermesGapsPanel.tsx`, ver seção
   "Fichas de setor" → Frente 2 abaixo) — funciona porque o Vite bundla
   `shared/` normalmente, mas é bom saber que são duas fontes diferentes
   (uma ao vivo via HTTP, outra estática via import direto), não uma só.
   Cobre 9 domínios reais (`business, customer, market, competition,
   digital, content, history, resources, performance`), lendo tabelas de
   verdade (`competitors`, `reviews`, `leads`, `posts`, `diagnostics` etc.).
   **Não existe** domínio de "catálogo com fotos reais" — é exatamente o
   catálogo que a Fase 3 do sistema de fichas de setor (ver seção acima)
   ainda vai construir.

2. **Hermes/Estratégia** (mensal, lê ficha do setor + memória estratégica)
   — ✅ existe (atualizado em 2026-09-30 — "Hermes independente").
   `supabase/functions/strategy-generate/index.ts`.
   Já lê a ficha do setor (`fetchPlaybookBlock`) e uma memória estratégica
   real (via `data-agent` → domínio `history`, que lê
   `marketing_ai_brain_nodes`, `marketing_ai_strategy_log`,
   `marketing_ai_experiments`). **Agora é automático**: `claim-diagnostic`
   dispara a 1ª estratégia sozinha logo após o cadastro; um despachante
   novo (`action:'cron_dispatch'`, pg_cron diário) reavalia semanalmente
   (`reanalyze`) e atualiza o plano tático mensalmente OU quando o
   check-up pede ajuste (`action:'refresh'` — mantém a tese, só refaz
   funil/metas/orçamento, silencioso). Estratégia NOVA (`generate`) só
   quando o check-up decide PIVOT/TERMINATE — só nesse caso avisa o dono
   (Telegram + Atividades). Interruptor de segurança em 2 níveis: geral
   (`hermes_config.auto_strategy_enabled`, painel Owner → Configurações →
   Tipos de negócio) e por empresa (`companies.auto_strategy`, painel
   Owner → detalhe da empresa) — Liga dos Sonhos fica desligada até o
   dono decidir. Teto de custo: até 5 empresas por rodada do
   despachante, até 10 chamadas automáticas/mês por empresa; custo de
   cada chamada (`agent_role:'estrategia'`) registrado em
   `agent_performance` e visível no painel "Uso de IA" que já existia na
   página de detalhe da empresa (nenhuma tela nova precisou ser criada
   pra isso). Autenticação: function deployada com `--no-verify-jwt`
   (mesmo padrão de outras functions chamadas por cron, ver armadilha
   abaixo) — código valida `cron_secret` OU JWT real do dono; caminho
   cron usa `company_id` do corpo, caminho JWT NUNCA aceita `company_id`
   do corpo (sempre resolve pela própria empresa do usuário logado).
   Testado de ponta a ponta: os 3 casos de auth (sem nada = 401,
   cron_secret certo = 200, errado = 401), bootstrap real via cadastro,
   reanalyze semanal, refresh mensal (com regra 80/20 real no
   raciocínio da IA). **Não testado ao vivo**: o cenário PIVOT/TERMINATE
   (a IA sempre decidiu continuar/ajustar com dado real nos testes) — o
   caminho de código existe e foi revisado, mas uma tentativa de forçar
   o cenário via gancho de teste foi bloqueada pelo classificador de
   segurança do ambiente (change flagged como enfraquecimento de auth)
   e não foi contornada.

3. **Calendário semanal 80/20** — 🟡 parcial.
   `supabase/functions/creative-generate/index.ts` (`planWeekForCompany`),
   `supabase/migrations/067_weekly_calendar.sql`.
   O cron semanal existe de verdade (`weekly-calendar-plan-sun-18h-brt`,
   domingo 18h BRT) e decide 1-2 posts por dia. **Não existe regra 80/20**
   nem nenhuma proporção fixa pilar-comprovado vs. experimental — a IA
   decide quantidade, não a mistura de tipo de conteúdo.

4. **Content Agent** (roteiro de cada peça) — 🟡 parcial.
   `creative-generate` (campo `video_script`), `content-engine`,
   `content-intelligence`, `generate-posts`.
   Só o `creative-generate` produz algo parecido com roteiro — e é um
   texto livre único ("como gravar"), não uma quebra estruturada
   cena-a-cena/plano-a-plano. As outras 3 functions geram só
   legenda/copy pra template estático, sem campo de roteiro nenhum.

5. **Motor de mídia com roteador** (foto real + render-format; clipes
   fal/Runway; avatar HeyGen com fundo do imóvel; imagem IA só pra
   bairro/marca, nunca o item) — 🟡 parcial.
   `supabase/functions/render-format/index.ts` (cards SVG→PNG, custo de
   crédito = 0, confirmado), `supabase/functions/generate-video/index.ts`
   (fal.ai real — `fal-ai/ltx-video/image-to-video` — mas **sem nenhum
   chamador em todo o repo**, function órfã hoje, deployada mas não
   plugada em botão nenhum). **Runway e HeyGen não existem em lugar
   nenhum do código** (zero menção, confirmado por busca no repo
   inteiro). A regra "imagem IA nunca desenha o item de verdade, só
   cena de bairro/marca" também não está codificada em lugar nenhum
   hoje — só a regra geral de "nunca escrever texto" (ver seção Stack)
   existe de verdade.

6. **Montagem** (juntar imagem/vídeo/avatar + camada de texto no formato
   final) — ❌ não existe como etapa própria, salvo pra cards estáticos.
   `render-format` já faz montagem real (fundo + texto em SVG) mas só
   pra card estático. Não existe montagem equivalente pra vídeo (juntar
   `video_url` do `generate-video` com legenda/texto) nem pra avatar
   (que nem existe ainda).

7. **Aprovação do dono** (obrigatória) — ✅ existe.
   `supabase/functions/agent-actions/index.ts`.
   `agent_actions.approval_status`
   (`PENDING/APPROVED/AUTO_APPROVED/REJECTED/EDITED`) trava
   `execution_status` em `NOT_READY` até decisão humana explícita
   (`decide()`, grava `approved_by`); o fluxo de `posts`
   (`rascunho→aprovado→publicado`) segue a mesma trava. Sólido em toda
   a base.

8. **Distribuição Instagram** — ✅ existe (só imagem única).
   `agent-actions` → `publishToInstagram` (linha ~350).
   Publica 1 imagem por vez — sem carrossel (`children`/`media_type:
   CAROUSEL` não existem na function). Depois de publicar grava em
   `posts` ou `marketing_ai_content`, **nunca em `instagram_posts`**
   (tabela sempre vazia, já documentado acima). Carrossel é exatamente
   o item 3 do plano Fase 3+4 (ver seção Fichas de setor).

9. **Conversão** (comentário-palavra-chave/DM → lead, resposta como
   rascunho aprovado) — 🟡 parcial.
   `supabase/functions/instagram-webhook/index.ts`.
   Detecta palavra-chave/intenção (IA classifica sim/não) e cria
   `leads` + `agent_actions` pendente de aprovação — isso já funciona.
   **A resposta não é escrita pela IA** — é um texto fixo configurado
   antecipadamente pelo dono (`engagement_automations.message`); a IA só
   decide *se* responde, não *o que* responde. Rascunhar a resposta de
   verdade é trabalho futuro (já registrado acima, na seção Fichas de
   setor, como parte da Fase 5).

10. **Resultados → memória estratégica → volta pro 1 e 2** — 🟡 parcial.
    `supabase/functions/instagram-performance/index.ts` (grava
    `instagram_performance_snapshots`), `data-agent` (domínios
    `performance`/`history` leem de volta), `strategy-generate` (lê via
    `fetchDataAgentState` a cada rodada).
    O loop é real pra engajamento/alcance/leads — cada geração de
    estratégia realmente lê o que aconteceu antes, não começa do zero.
    **Não fecha pra receita**: `gatherPerformance` deixa `revenue`,
    `cac`, `roas` explicitamente nulos, com comentário no próprio
    código admitindo que não existe fonte de dado comercial ainda ("gap
    honesto"). Mesmo gap que o Modelo de cobrança (seção abaixo)
    também esbarra.

**Como isso se relaciona com "Ciclo autônomo"** (seção Jarvis, abaixo): não
conflita — são camadas diferentes. "Ciclo autônomo" descreve QUANDO cada
function tática roda sozinha (cron, decisão de "vale a pena agir agora");
esta seção descreve AS 10 ETAPAS do fluxo de ponta a ponta que essas
functions táticas implementam pedaços de. Nenhum cron encontrado nesta
auditoria contradiz o que "Ciclo autônomo" já documentava.

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
- **Gerador de imagem NUNCA escreve texto** — regra arquitetural, não
  sugestão. A IA de imagem (generate-image/OpenAI) é responsável só pela
  CENA VISUAL (ambiente, pessoas, produtos, luz, composição); texto de
  verdade (headline/CTA/legenda) é sempre uma camada separada, escrita
  pelo Copywriter e impressa depois pelo motor de cards (`render-format`,
  SVG→PNG) ou pela legenda do post — nunca desenhada pela IA de imagem.
  Concretamente: (1) todo prompt de imagem tem que incluir a proibição
  explícita de texto/placa/banner/tela/etiqueta/logo-com-texto, instruindo
  a deixar objetos que normalmente teriam texto em BRANCO; (2) nunca
  passar copy de verdade (hook/CTA/legenda) pro prompt de imagem — só o
  conceito visual curto (`idea`), nunca `caption`/`hook_angle`/`offer`/
  `s.text` de um slide. Isso existe por causa de um bug real (uma foto
  gerada saiu com uma faixa de festa escrito "LIGA OF SCRADS", texto sem
  sentido) — corrigido em 2026-09-16 em 6 edge functions que geram
  imagem, cada uma com seu próprio prompt (sem lib compartilhada entre
  functions, código duplicado de propósito igual o resto do projeto):
  `creative-generate`, `content-test`, `render-format`, `marketing-ai`,
  `generate-posts`, `content-image`. Qualquer prompt de imagem NOVO
  precisa seguir essa mesma regra.

## Brand

- **Primary:** `#FF6D29` (laranja)
- **Card BG:** `#150E08`
- **Page BG:** `#0E0B0A`
- **Muted:** `#BABABA`
- **Font:** `'Bricolage Grotesque', system-ui, sans-serif`
- Design dark, técnico, premium. Sem gradientes genéricos. Animações sutis.

## Fichas de setor (vertical playbooks)

Sistema pra especializar o produto por segmento **sem criar tabela/tela/
código específico de setor** — tudo vive como dado (jsonb) na tabela
`vertical_playbooks`, e o código só lê. Primeira ficha piloto:
**Imóveis · Rio de Janeiro** (`imoveis_rio`).

- `vertical_playbooks` (key, name, version, config jsonb, enabled) — leitura
  livre, escrita só owner (mesma regra de `business_types`).
- `business_types.vertical_key` — qual ficha aquele tipo de negócio aponta
  por padrão. Um **trigger** (`trg_sync_company_vertical_key`,
  `sync_company_vertical_key()`) preenche `companies.vertical_key`
  automaticamente sempre que `business_type` é definido/alterado, buscando
  o `vertical_key` correspondente em `business_types` (ou `'generico'` se
  não achar). Dispara em todo INSERT e em UPDATE só quando `business_type`
  muda — não em qualquer update da empresa.
- `companies.playbook_answers` (jsonb) — respostas das perguntas extras da
  ficha (`config.onboarding_questions`), preenchidas no onboarding.
  Sobrepõem os padrões genéricos da ficha quando presentes.
- **Ficha `generico`** representa o comportamento de sempre — todo campo do
  `config` vazio de propósito. Qualquer empresa sem ficha configurada (ou
  com ficha mas sem conteúdo em nenhum campo) tem que se comportar **byte a
  byte igual** a antes desse sistema existir — é a garantia central do
  design, verificada function por function (ver abaixo).

**Helper `fetchPlaybookBlock` (duplicado em cada function, convenção do
projeto — sem lib compartilhada):** busca a ficha + `playbook_answers`,
monta um bloco de texto só com o que tiver conteúdo real (tom, regras,
pilares, ganchos por pilar, CTAs, vocabulário, respostas do cadastro).
Ficha vazia + sem respostas → devolve `''` → prompt fica idêntico ao de
antes. Erro no banco de fichas → também devolve `''` (try/catch) — nunca
derruba a geração por causa disso.

**Já lê a ficha (injetada no prompt, 2026-09-29):**
`strategy-generate` (geração e reavaliação), `creative-generate` (Diretor
Criativo, execução da personalidade, e o planejador semanal de cadência),
`content-engine`, `content-intelligence` (tendências e campanhas),
`generate-posts`, `hermes-proxy` (chat interativo, Telegram, orquestrador
do ciclo autônomo e a execução do ciclo autônomo). Validado com dado real
de produção pras 2 ficha (`generico`/`imoveis_rio`) em `strategy-generate`
(prompt) e `creative-generate` (post gerado de verdade citando bairros/CTA
da ficha). **`hermes-proxy` especificamente**: só o teste de montagem do
prompt foi feito (mesma lógica, rodada fora do Hermes, confirmando bloco
vazio pra `generico` e bloco completo pra `imoveis_rio`) — o teste ponta a
ponta (mensagem de chat de verdade) ainda está pendente porque o "Agente
Geral" está desativado no Agents Control Center desde 2026-07-28 (estado
anterior a este trabalho, não mexemos nesse toggle de propósito por ser
global — afeta todas as empresas, não só a de teste). Fazer esse teste
ponta a ponta antes de religar o Agente Geral pra valer.

**Ainda não lê a ficha** (fora do escopo desta rodada — não é setor-
específico hoje, ou o dono decidiu deixar pra depois):
`adapt-plan`, `analyze-reviews`, `brand-kit-suggest`, `content-test`,
`creative-ideas` (gera só cards de ideia pro dashboard, não chega a virar
post — entra numa próxima rodada se fizer sentido), `draft-reply`,
`enzo-daily-report`, `find-sales-leads`, `generate-tab-insight`,
`hermes-strategy`, `insights-collect`, `format-fill`, `generate-report`,
`map-competitors`, `marketing-ai`, `monitor-competitor-social`,
`monthly-report`, `periodic-report`, `partnership-opportunities`,
`platform-monitor`, `website-summary`, `site-diagnosis`, `telegram-chat`,
`whatsapp-webhook`. `agent-chat` e `publish-instagram` não entram porque já
estão deprecadas (ver acima).

**`data-agent` e `instagram-webhook` ficam de fora de propósito:**
`data-agent` não chama IA nenhuma (100% coleta via SQL, sem prompt pra
injetar nada); `instagram-webhook` hoje não gera rascunho de resposta por
IA pra comentário/DM (só classifica intenção — o texto enviado já vem
pré-configurado pelo dono). **Quando esse rascunho de resposta por IA for
construído (Fase 5 do sistema de fichas de setor), ele já nasce lendo a
ficha** — decisão registrada aqui pra não esquecer.

### Fase 2 — onboarding lê a ficha (2026-09-29)

- `src/lib/verticalPlaybook.ts` — módulo compartilhado (frontend) com os
  tipos (`Bilingual { pt; en? }`, `PlaybookQuestion`), busca
  (`fetchVerticalKey`, `fetchOnboardingQuestions`) e validação
  (`sanitizePlaybookAnswers` — só aceita chave que existe na ficha, respeita
  tipo e `max`, corta texto em 200 caracteres). `claim-diagnostic/index.ts`
  tem sua própria cópia Deno da mesma validação (convenção do projeto: sem
  lib compartilhada entre edge function e frontend).
- **Onboarding** (`OnboardingPage.tsx`): quando o tipo de negócio escolhido
  tem `vertical_key ≠ 'generico'`, aparece "Perguntas específicas do seu
  setor" dentro do próprio passo 0 (não é um passo novo — states de
  step numbering ficam intocados pra `generico`). Trocar de tipo limpa as
  respostas do setor anterior. Tudo opcional.
- **Configurações → Entendimento do negócio**
  (`BusinessUnderstandingCard.tsx`): mesmas perguntas, editáveis depois.
  Recarrega a ficha certa a cada save (relendo `companies.vertical_key` na
  hora), caso o tipo tenha mudado noutra parte da tela desde que o card
  carregou.
- **Onde as respostas são validadas de verdade:** `claim-diagnostic` (é
  aqui que a empresa é criada pra valer — nunca confia no que o onboarding
  mandou sem checar contra a ficha real antes de gravar
  `companies.playbook_answers`). `vertical_key` continua vindo só do
  trigger (`business_type` no INSERT), nunca setado à mão.
- **RLS corrigida junto (bug real, não relacionado a fichas):**
  `business_types_read` estava restrita a `authenticated`, sem incluir
  `anon` — o onboarding roda ANTES de existir conta/sessão, então um
  visitante real sempre recebia `[]` do banco e caía no fallback hardcoded
  de 6 tipos em `src/lib/businessTypes.ts` (que não inclui "Imobiliária /
  Corretor" nem "Software"). Corrigida pra incluir `anon`; `enabled=true`
  agora é enforced no próprio banco (RLS), não só no filtro do app, nos
  dois casos (`business_types` e `vertical_playbooks`).

### Geração de estratégia em 2 execuções (`strategy-generate`)

O projeto está no **plano Free do Supabase**: 150s de wall-clock por
execução, e isso vale também pra trabalho em segundo plano via
`EdgeRuntime.waitUntil` (medido em 2026-09-29: uma chamada única de 4500
tokens à Claude já levava ~92s sozinha, e mesmo assim saía cortada —
2 tentativas nunca caberiam em 150s). A geração de estratégia
(`action:'generate'`) virou **2 passos, cada um sua própria execução
HTTP** (seu próprio relógio de 150s):

1. `action:'generate'` cria a linha (`status:'generating'`, nome
   provisório "Gerando estratégia..."), devolve o `strategy_id` **na
   hora**, e dispara `runStep1` em segundo plano — só a tese/diagnóstico
   (menor, cabe com folga mesmo com 1 retry; medido: ~41-46s).
2. Ao terminar, `runStep1` grava esse pedaço (ainda `'generating'`) e
   dispara o **próprio `strategy-generate`** (`action:'continue'`) — uma
   execução nova, com relógio zerado (ver a armadilha do `verify_jwt`
   acima: essa chamada precisa do header `Authorization: Bearer
   <SUPABASE_SERVICE_ROLE_KEY>`, não só do `cron_secret` no corpo).
3. `action:'continue'` roda `runStep2` — funil/metas/orçamento/
   estimativas/campanha (a parte mais pesada; medido: ~69-84s com
   `max_tokens:4500`). Só aí grava `status:'active'` e pausa a estratégia
   principal antiga.

**Tratamento de resposta cortada (`stop_reason`):** se a Claude cortar a
resposta por `max_tokens`, repetir a MESMA chamada só cortaria de novo —
`callClaudeStep` nunca faz isso. A parte 1 (menor) tenta de novo 1x com
mais tokens se cortar; a parte 2 (mais pesada, `allowRetry:false`) nunca
tenta de novo — falha na hora com motivo claro, pro dono clicar "tentar de
novo" em vez de arriscar estourar os 150s daquela execução com um retry.
JSON malformado que NÃO foi corte (formatação, não tamanho) é tratado
diferente — aí sim vale repetir do mesmo tamanho (só na parte 1).

**Nunca fica "gerando" pra sempre:** se uma linha ficar `'generating'` por
mais de 10 minutos, tanto o backend (próxima chamada de `generate` pra
aquela empresa+kind) quanto o frontend (`StrategySection.tsx`, polling de
3s) tratam como `'failed'`. Clique duplo devolve a geração já em
andamento em vez de duplicar. `action:'continue'` só processa se a linha
ainda estiver `'generating'` E a parte 1 já tiver gravado (`thesis`
presente) — repetição da chamada é ignorada sem erro.

`reanalyze` (Strategy Health Check) não precisou dessa divisão — resposta
pequena (900 tokens), nunca chegou perto do limite.

**Gatilho pra dividir em 3 execuções:** a parte 2 (`max_tokens:4500`) foi
medida em ~69-84s nos 2 testes reais feitos em 2026-09-29 — folga boa
dentro dos 150s. **Se os logs de timing (`TIMING strategy-generate
step2[...]: parte 2 concluída`) mostrarem essa etapa passando de ~110s em
uso real**, é sinal de que a margem ficou curta demais (perto do limite
de 150s da execução) — nesse caso, dividir a parte 2 em 2 (ex.: "metas +
funil" e "orçamento + estimativas + campanha"), cada uma como sua própria
execução `'continue'` encadeada, do mesmo jeito que a parte 1→2 já
funciona hoje.

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
| Geral | Posts, conteúdo, reputação, concorrência, diagnóstico do site, atendimento (leads/follow-up) | **Ativo** — único papel hoje. Chave interna continua `marketing` em `hermes-proxy` (não renomeada no banco pra não quebrar histórico de `agent_messages`/`agent_performance`); só o nome exibido virou "Agente Geral". Liga/desliga em `/owner/company/:id` (checkbox "Marketing AI" — o "Agents Control Center" em `/owner/agentes` citado antes aqui não existe como rota real; corrigido em 2026-09-30). |
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

> ⚠️ **Variante da armadilha acima, achada em 2026-09-29 no
> `strategy-generate`:** essa function é uma das poucas com
> `verify_jwt=true` de propósito (só JWT de dono real chama as ações
> interativas). Quando uma function assim precisa **chamar a si mesma**
> internamente (ver "Geração de estratégia em 2 execuções" abaixo — o passo
> 1 dispara o passo 2 via `fetch` pro próprio `strategy-generate`), o
> `cron_secret` no corpo sozinho NÃO basta: o gateway barra antes do código
> rodar, do mesmo jeito silencioso do caso do pg_cron. A chamada interna
> precisa mandar `Authorization: Bearer <SUPABASE_SERVICE_ROLE_KEY>` (a
> function já tem esse valor no próprio ambiente, via
> `Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')` — não precisa de segredo
> novo) **além** do `cron_secret` no corpo, que continua sendo quem decide
> se aceita a ação como uma chamada interna de verdade (não um usuário
> comum tentando chamar `action:'continue'` direto).

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

- **Site publicado (domínio próprio):** https://getsaleboost.com/ — o endereço
  antigo `sales-boost-restaurants.luancontasecundaria22.workers.dev` não
  responde mais (Cloudflare recusa rota `.workers.dev` depois da migração
  pro domínio próprio, ver `wrangler.jsonc`). **Todo lugar que ainda
  referenciar essa URL antiga é bug** — achado e corrigido em massa em
  2026-09-30: secret `APP_URL` (usado por 5 edge functions de OAuth —
  Instagram/GBP/GSC/Meta Ads/Meta Business — pra redirecionar de volta
  depois de conectar), o **Site URL e Redirect URLs do Supabase Auth**
  (afeta e-mail de confirmação de cadastro e "esqueci minha senha" —
  estava apontando pra uma URL da Vercel ainda mais antiga, nem era o
  workers.dev), fallback hardcoded em `create-checkout` (Stripe
  success/cancel — na prática nunca usado, o frontend sempre manda a URL
  explícita) e um link quebrado que `telegram-chat` mandava de verdade pro
  usuário quando pedia pra conectar a conta.
- **Jarvis ao vivo:** https://getsaleboost.com/jarvis
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
  - **`publish-instagram` está deprecada** (confirmado em 2026-09-29): zero
    chamadores no código (nenhuma tela, nenhuma outra function, nenhum job
    do pg_cron) e a tabela que ela grava (`instagram_posts`) tem 0 linhas —
    nunca terminou de rodar em produção. O publicador real e ativo hoje é o
    `publishToInstagram` dentro de `agent-actions` (fluxo de aprovação) —
    mas **esse não grava em `instagram_posts`**, então as telas que leem
    dessa tabela (`VisualLibrary.tsx`, `AgentTabExtras.tsx`,
    `detect-opportunities`, `generate-tab-insight`, `business-progress`,
    `enzo-daily-report`) estão lendo uma tabela sempre vazia — corrigir isso
    faz parte da Fase 4 do sistema de fichas de setor (ver seção "Fichas de
    setor" abaixo), junto com suporte a carrossel/Reels. `publish-instagram`
    ainda não foi apagada.
  - **Funções "sem arquivo local" (achadas em 2026-07-14) já foram
    resolvidas** — confirmado em 2026-09-29 que as 88 functions deployadas
    batem 100% com as 88 pastas locais em `supabase/functions/`, incluindo
    `enzo-daily-report`, `hermes-daily-scan`, `daily-briefing` e
    `monthly-report` (todas têm pasta local hoje).
- Supabase migrations em `supabase/migrations/` — **atenção:** há bastante
  deriva entre esses arquivos e o schema real de produção (muita coisa foi
  aplicada direto via SQL editor/MCP ao longo do tempo, sem migration local
  correspondente). Confirmado em 2026-09-29 que pelo menos 5 tabelas usadas
  hoje não têm NENHUM arquivo de criação local: `posts`, `leads`,
  `lead_messages`, `agent_memory`, `business_types` — foram criadas direto
  em produção. Não confiar cegamente que os arquivos aqui refletem 100% do
  banco real — sempre conferir o schema real via `supabase db query
  --linked` antes de assumir estrutura.
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
