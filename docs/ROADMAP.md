# Sales Boost — Roadmap

> Prioridades com critério de "pronto". Cada item: objetivo, critério de
> pronto, arquivos envolvidos, riscos, e se envolve ALTERAÇÃO ARRISCADA
> (ver CLAUDE.md).

## P0 — Instagram certo conectado

- **Objetivo:** o @ certo conectado, sem duplicidade entre empresas, e um
  carrossel real publicado como prova de que o caminho inteiro funciona.
- **Critério de pronto:** `instagram_username` visível e correto na tela
  de Conexões + 1 carrossel publicado de verdade e gravado em
  `instagram_posts`.
- **Arquivos:** `instagram-oauth-callback`, `agent-actions`,
  `IntegrationsTab.tsx`.
- **Riscos:** publicar em conta errada (mitigado pela proteção contra
  conta duplicada, ver [INSTAGRAM.md](INSTAGRAM.md)).
- **Alteração arriscada?** Não (publicação já passa por aprovação humana).
- **Status:** código pronto (carrossel + proteção contra duplicidade);
  **depende do dono reconectar** o Instagram de teste — ver
  [INSTAGRAM.md](INSTAGRAM.md) pro pitfall que já aconteceu 2x. Plano de
  "o que fazer antes da reconexão" rodado pelo agente `product` em
  2026-10-01 (teste do time de agentes) — achou um risco não confirmado
  no formato do carrossel, registrado em
  [PITFALLS.md](PITFALLS.md#children-do-carrossel-do-instagram--risco-não-confirmado-watch-no-1º-teste-real).

## P1 — Conversão

- **Objetivo:** comentário/DM vira rascunho de resposta pela IA lendo a
  ficha, aprovado pelo dono, vira lead com origem rastreada.
- **Critério de pronto:** um comentário "VISITA" de teste vira rascunho
  (lendo `dm_qualification` da ficha) → aprovado → enviado → lead criado
  com `source_post_id`/`source_item_id`/`source_pillar` preenchidos.
- **Arquivos:** `instagram-webhook`, `leads`, `lead_messages`,
  `engagement_automations`.
- **Riscos:** responder fora da janela de tempo da Meta (mitigado — ver
  [CONVERSION.md](CONVERSION.md)); IA inventar dado do imóvel (mitigado —
  regra explícita de nunca inventar, cair pra "vou confirmar e te
  retorno").
- **Alteração arriscada?** Não diretamente (sempre `PENDING`), mas toca
  `instagram-webhook`, que está na lista de functions sensíveis — testar
  só em empresa de teste antes de qualquer deploy.
- **Status:** ver [CONVERSION.md](CONVERSION.md) pro estado real,
  atualizado com mais frequência que este roadmap.

## P2 — Medição + aprendizado

- **Objetivo:** 80/20 de verdade alimentando o calendário e os briefs, +
  relatório semanal simples pro corretor.
- **Critério de pronto:** ver [LEARNING.md](LEARNING.md).
- **Status:** 🟡 parcial — o loop de engajamento/alcance já realimenta a
  estratégia; 80/20 determinístico e relatório semanal não existem ainda.
- **P2 parte 1 (em código, aguardando migration + deploy):** cálculo 80/20
  determinístico (`_shared/learning.ts`) + `posts.pillar/recipe/format/item_id`.
  Falta: ligar ao calendário/briefs (parte 2) e relatório semanal.

## P3 — Higgsfield (Motor de Mídia)

- **Objetivo:** fotos do catálogo + brief da estratégia → tour virtual
  (carrossel de vídeos) + criativos de anúncio → rascunho → aprovação →
  Instagram.
- **Critério de pronto:** ver [MEDIA-ENGINE.md](MEDIA-ENGINE.md).
- **Alteração arriscada?** Sim — gasto novo com provedor pago
  (`HIGGSFIELD_API_KEY`), precisa de aprovação prévia do dono antes de
  qualquer chamada real que gaste crédito.
- **Status:** ❌ não começado.

## P4 — Infra de autonomia

- **Objetivo:** ambiente de ensaio (banco de teste + prévia do site), PR +
  checagens automáticas (GitHub Actions), deploy automático depois da
  aprovação do dono.
- **Critério de pronto:** um agente consegue propor uma mudança, ela roda
  num ambiente isolado, o dono aprova o PR, e o deploy acontece sozinho.
- ~~**Até este item existir, agentes NÃO rodam sozinhos sem o dono
  acompanhar**~~ — substituído em 2026-10-02 pelo modo autônomo (só PR,
  nunca merge), ver [ORCHESTRATION.md](ORCHESTRATION.md#modo-autônomo-rotina-agendada)
  e [DECISIONS.md](DECISIONS.md).
- **Status:** 🟡 em andamento.
  - [x] Deploy automático depois do merge — já existia
        (`.github/workflows/deploy.yml`). **Mudou em 2026-10-02:** o
        `deploy.yml` falhava em todo merge desde pelo menos 30/09 (token
        da Cloudflare restrito por IP) e foi removido por decisão do dono;
        quem publica o site é a integração Git da própria Cloudflare
        (Workers Builds, worker `sales-boost-restaurants`) — ver
        [PITFALLS.md](PITFALLS.md#deploy-do-site-é-a-cloudflare-não-o-github).
  - [x] Checagem automática em todo PR (`.github/workflows/pr-checks.yml`,
        roda `npm run build` e, desde 2026-10-02, `npm run lint`).
  - [x] **Dono:** proteger o `main` no GitHub (exigir PR + checagem verde
        + aprovação do dono antes do merge).
  - [x] Projeto Supabase de ensaio criado (`salesboost-ensaio`, ref
        `ybmevrsijsayllgcxxeb`, plano grátis, 2026-10-02).
  - [x] **Schema** de produção copiado pro ensaio (só estrutura, zero
        dados) — 2026-10-02, sessão supervisionada. Lido direto do banco
        real (não de `supabase/migrations/`, ver
        [PITFALLS.md](PITFALLS.md#deriva-de-migrations-vs-banco-real)):
        120 tabelas, 326 constraints, 221 índices, 171 policies de RLS (RLS
        ligado nas 120), 5 funções, 3 triggers, bucket `post-images` + 6
        policies de storage. Conferido por "impressão digital" (md5 da
        estrutura) — idêntico à produção. **Diferenças de propósito:** sem
        `pg_cron` e sem nenhum cron (produção tem 21), e
        `notify_hermes_new_lead()` virou função vazia — ver
        [PITFALLS.md](PITFALLS.md#migrations-com-cron-apontam-pra-produção).
        Tabelas de catálogo/configuração copiadas em seguida (mesmo dia,
        conferidas por md5 linha a linha — idênticas): `vertical_playbooks`,
        `business_types`, `capability_registry`, `marketing_ai_tool_registry`,
        `agent_roles`, `hermes_config`, `feature_flags`, `api_providers`,
        `insight_sources`, `integration_catalog`, `plan_ai_defaults`,
        `platform_services`, `progress_gp_rules/levels/pins/rewards`,
        `report_config`, `telegram_agent_config`, `telegram_bots`,
        `prospect_search_keywords` e a base global de
        `marketing_ai_knowledge` (`company_id IS NULL`, 100 itens).
        `monitor_config` copiada **sem** o chat do Telegram do admin
        (alertas desligados). **Não copiadas de propósito:** `app_config` e
        `_app_config` (guardam segredos: `cron_secret`, chaves de API) e
        qualquer tabela com dado de cliente.
  - [ ] Quando o schema de produção mudar, repetir a cópia/ajuste no
        ensaio (hoje é manual). Conferência de sincronia em 2026-10-02:
        **idêntico** (120 tabelas, 171 policies; md5 de colunas,
        constraints, índices e policies iguais nos dois). Regra: todo PR
        que muda a estrutura do banco aplica a mesma mudança no ensaio no
        mesmo PR; depois do merge, o agente aplica o mesmo SQL em
        produção (ver [ORCHESTRATION.md](ORCHESTRATION.md#banco-de-produção-depois-do-pr-aprovado));
        a conferência por md5 (consulta abaixo) roda antes e depois de
        aplicar cada mudança de schema (fora disso, a rotina autônoma não
        lê produção). Custo: só leitura de estrutura, de graça
        no Supabase e poucos tokens.
        ```sql
        select
         (select count(*) from information_schema.tables where table_schema='public' and table_type='BASE TABLE') as tabelas,
         (select md5(string_agg(table_name||'.'||column_name||':'||data_type||':'||is_nullable||':'||coalesce(column_default,''), '|' order by table_name,column_name)) from information_schema.columns where table_schema='public') as colunas,
         (select md5(string_agg(conrelid::regclass||':'||conname||':'||pg_get_constraintdef(oid), '|' order by conrelid::regclass::text,conname)) from pg_constraint where connamespace='public'::regnamespace) as constraints,
         (select md5(string_agg(indexdef, '|' order by indexname)) from pg_indexes where schemaname='public') as indices,
         (select md5(string_agg(tablename||':'||policyname||':'||cmd||':'||coalesce(qual,'')||':'||coalesce(with_check,''), '|' order by tablename,policyname)) from pg_policies where schemaname='public') as policies;
        ```
  - [x] Chaves do **ensaio** no ambiente do Claude Code (2026-10-02):
        `SUPABASE_ENSAIO_URL`, `SUPABASE_ENSAIO_ANON_KEY` (role `anon`),
        `SUPABASE_ENSAIO_SERVICE_ROLE_KEY` (role `service_role`) — todas
        com ref `ybmevrsijsayllgcxxeb`, nenhuma de produção. Testadas: as
        duas leem `vertical_playbooks` (2 fichas).
  - [x] Rotinas agendadas (seg/qua/sex de manhã + relatório sexta 18h).
  - [x] Consertar o `npm run lint` e incluir no `pr-checks.yml`
        (2026-10-02): `tsconfigRootDir` definido, `frontend/` (projeto
        antigo separado) ignorado. Sobraram 172 achados antigos, rebaixados
        pra aviso em `eslint.config.js` (só erro trava o PR).
  - [ ] Pagar a dívida de lint aos poucos e voltar as regras pra erro —
        principalmente `react-hooks/*` e as edge functions
        (`supabase/functions`, mexer = deploy arriscado).

## Próximas etapas pedidas pelo dono (2026-10-06, nesta ordem)

1. **Pendências com bolinha vermelha** — ícone com contador de pendências
   reais (aprovações, Instagram desconectado, item sem foto, dado da ficha
   faltando); cada item leva direto à tela/campo certo e some quando
   resolvido. Só tela + leitura.
   **FEITO (2026-10-06, só no branch local, sem deploy):** sino no layout
   (`src/lib/usePendencias.ts` + `PendenciasBell.tsx`). Fontes: aprovações
   (agent_actions PENDING + marketing_ai_content idea/draft, mesma fila da
   ApprovalsPage), Instagram (não conectado / vencido / vence em ≤7 dias),
   fotos abaixo do mínimo por item do catálogo, perguntas da ficha sem
   resposta, Telegram não conectado (baixa prioridade, não conta na
   bolinha). Vault ficou de fora por decisão do dono. Tela e código andam
   juntos: ainda falta publicar o site e conferir no celular/desktop.
2. **Fim do onboarding com dados e conectores** — frase "Esse é o momento
   importante de alimentar os dados reais — depois é só relaxar!".
   Obrigatório: dados do negócio, perguntas da ficha e 1 item com fotos.
   Instagram em destaque, mas com "conectar depois" (vira pendência do
   item 1) até o App Review da Meta sair; depois passa a obrigatório.
   **FEITO (2026-10-06, em PR, só frontend, sem migration/deploy de
   function):** tela `/setup` (`src/pages/setup/`), hook
   `src/lib/useSetupStatus.ts`, regras compartilhadas com o sino em
   `src/lib/setupRules.ts`, gate em `ClientRoute` (`src/lib/setupGate.ts`).
   Ainda falta: publicar o site e conferir no celular. Ver
   [DECISIONS.md](DECISIONS.md).
2b. **Growth Qualification** (próxima, antes do Plano da semana) —
   diagnóstico com score (Growth Score), acesso grátis (1 vídeo + 1
   estratégia, sem prazo em dias), popup "seu acesso grátis começou",
   popup do cupom depois do 1º vídeo (cupom com prazo real de 7 dias a
   partir da entrega da estratégia — ajustado em 10-07: conta de quando o cliente VÊ o popup), preço novo (R$2.449 mensal; R$1.449
   anual/cupom de 1º mês — Stripe precisa de 3 itens novos, aprovação do
   dono) e Business Game pra retenção. Decisão registrada em
   [DECISIONS.md](DECISIONS.md) (2026-10-06 e 2026-10-07). Fatias:
   - **Fatia 1 — Growth Score (código pronto, falta aplicar migration
     `20261007120000_diagnostics_instagram_data.sql` e deployar
     `run-diagnosis`):** nota centrada no Instagram via scraper, site/Google
     como adendo, "Análise parcial", tela do diagnóstico nova, onboarding
     exigindo Instagram e site opcional.
   - **Fatia 2 — Acesso grátis na tela:** textos/popup "seu acesso grátis
     começou", remover o `TrialStartModal` (mostra R$14,49, preço errado) e
     travar os botões de IA só pra contas novas grátis que já usaram a
     estratégia.
   - **Fatia 3 — Corte de IA no servidor (ARRISCADA):** functions de IA
     recusam conta grátis que já gastou a cota. Mexe em functions de
     cliente real; exige aprovação antes do deploy.
   - **Fatia 4 — Stripe:** preço mensal R$2.449, anual R$1.449 (fidelidade
     12 meses, cláusula no checkout, validar com advogado), cupom de 1º mês.
     Exige aprovação do dono. **Status 2026-10-08: código pronto em PR
     (branch `stripe-4`), NADA deployado nem aplicado.** Falta: aprovar/mesclar,
     aplicar a migration `20261008100000_billing_plans.sql` ANTES de publicar o
     site e as functions `create-checkout`, `stripe-webhook`,
     `owner-company-activity`, e criar os itens no Stripe de PRODUÇÃO (hoje só
     existem no sandbox). Popup que grava `coupon_offer_shown_at` = fatia 5.
   - **Fatia 5 — Vídeo/Higgsfield + popup do cupom:** 1 vídeo real no
     acesso grátis; popup do cupom, com prazo de 7 dias contado de quando o
     cliente vê o popup. Só então a promessa pública inclui "+1 vídeo".
3. **Plano da semana** — no Calendário da Semana existente: quantos posts,
   de que tipo (vídeo/carrossel/bastidor), sobre qual item e por quê,
   calculado por fotos disponíveis, ritmo de aprovação do dono, 80/20,
   regras da ficha e teto de vídeos. Corrige a divergência tela × código
   registrada em [CONTENT-INTELLIGENCE.md](CONTENT-INTELLIGENCE.md).
   Mexe em `creative-generate` (deploy precisa de aprovação). Decisão do
   dono pendente: teto de vídeos por semana no plano de R$1.449.

## Fora do código (depende do dono, nenhum agente resolve sozinho)

- App Review / verificação da Meta (desbloqueia contas não-testadoras no
  Instagram).
- 2-3 corretores piloto reais.
- Conta Higgsfield (credenciais + orçamento aprovado).
- Decisão final do modelo de cobrança (ver [PRODUCT.md](PRODUCT.md)).

## Itens do roadmap anterior (pré-reorganização dos docs, 2026-10-01)

Preservados aqui pra não perder nada — reconciliar com P0-P4 acima
conforme forem retomados:

- [x] Agente-chat MVP, Fase 2 (rate limiting), Fase 3 (Revenue
      Opportunities), Jarvis MVP, Stripe checkout+webhook — todos
      concluídos antes desta reorganização.
- [ ] **Fase 4 (antiga):** Integrações de canal reais — GBP e Instagram já
      funcionam; falta WhatsApp e E-mail. Mapeia pra fora do escopo atual
      (ficha `imoveis_rio` é só Instagram, ver
      [DECISIONS.md](DECISIONS.md)) — retomar quando um setor/cliente
      precisar de WhatsApp/E-mail de verdade.
- [ ] **Fase 5 (antiga):** Botão "Resolver tudo" (fila de ações em lote
      com aprovação) — ainda não construído, relacionado mas não
      idêntico ao P1 (Conversão) acima.
- [x] ~~Jarvis Fase 2 (multi-agente, 7 papéis)~~ — revertido, hoje 1
      agente só (ver [ARCHITECTURE.md](ARCHITECTURE.md), seção Jarvis).
- [ ] Jarvis Fase 3 (modo "reunião", CEO orquestra vários agentes) —
      avaliar se ainda faz sentido dado que o produto caiu pra 1 agente.
- [ ] Jarvis 24/7 (crons/webhooks pros agentes rodarem sozinhos) —
      parcialmente coberto pelo "Ciclo autônomo" já existente (ver
      [ARCHITECTURE.md](ARCHITECTURE.md)).
- [ ] Onboarding self-service com relatório demo em 24h.
- [ ] Definir e instrumentar modelo de cobrança final — ver
      [PRODUCT.md](PRODUCT.md).
- [ ] Automação de deploy (GitHub Actions) — isso É o P4 acima, mantido
      também aqui pra cross-reference.

## Divergências registradas (etapa 1, pendências)

- **HermesGapsPanel × `usePendencias`:** `HermesGapsPanel.tsx` calcula
  "lacunas" com condições mais fracas (ex.: só checa se há alguma resposta/
  foto). O sino usa condições exatas e independentes: foto abaixo do
  mínimo da ficha por item, cada pergunta da ficha sem resposta, validade
  do token do Instagram. Os dois podem discordar; o sino é a fonte de
  verdade pro dono. Unificar é trabalho futuro.
- **`CatalogItems` agora adiciona fotos a item já existente** (botão
  "＋ Adicionar fotos" no card; antes só dava pra subir fotos na criação).
  Atualiza `meta.photos` e `image_url` (se vazio). O card mostra "N/min
  fotos". Aceita `focusItemId` (vindo do sino via evento global
  `sb:open-add`, ouvido por `BusinessContextButton`).
- `useRealtime` ganhou opções `key` (evita colisão de canal com a
  ApprovalsPage na mesma tabela) e `column` (em `companies` a chave é `id`).
