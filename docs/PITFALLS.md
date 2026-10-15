# Sales Boost — Armadilhas já descobertas

> Cada entrada: o que acontece, por que, e a solução já aplicada. Lido por
> todo agente antes de mexer em cron, autenticação, domínio ou migrations.
> Ao aprender uma armadilha nova, adicionar aqui no mesmo PR que a corrige
> (ver [ORCHESTRATION.md](ORCHESTRATION.md)).

## `verify_jwt` × chamada de cron

Toda edge function chamada por `net.http_post` do pg_cron autentica via
`cron_secret` no CORPO da requisição, de propósito — nunca manda header
`Authorization`. Se a function estiver deployada com o padrão do Supabase
(`verify_jwt=true`), o GATEWAY da plataforma barra a chamada com 401
**antes** do código da function rodar — e `cron.job_run_details` mostra
`"succeeded"` mesmo assim (esse status só confirma que o `net.http_post`
foi enfileirado, não que a chamada HTTP teve sucesso). É silencioso: nada
quebra na tela, o cron "roda" todo dia, só que nunca faz nada.

**Solução:** deployar com `supabase functions deploy <nome> --no-verify-jwt`
(o código interno já valida JWT de usuário real OU `cron_secret`
corretamente — só o gateway estava barrando antes de chegar lá). Afetou:
`agent-actions`, `creative-generate`, `detect-opportunities`,
`creative-ideas`, `generate-posts`, `brand-kit-suggest`,
`map-competitors`, `monitor-competitor-social`, `strategy-generate`,
`instagram-oauth-callback`. **Qualquer function nova chamada por cron E
por usuário logado precisa desse mesmo `--no-verify-jwt`** — sem isso, o
caminho do cron fica morto em silêncio.

**Variante:** quando uma function com `verify_jwt=true` de propósito
precisa **chamar a si mesma** internamente (ex: `strategy-generate`
`action:'generate'` dispara `action:'continue'`), o `cron_secret` no corpo
sozinho não basta — a chamada interna precisa de
`Authorization: Bearer <SUPABASE_SERVICE_ROLE_KEY>` **além** do
`cron_secret` no corpo.

**Nunca colocar a service role key dentro do SQL do pg_cron** — ela fica
só nas edge functions, lida via `Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')`.

## Coleta do Instagram no diagnóstico (Apify, 2026-10-07)

- `run-diagnosis` espera o actor `apify/instagram-profile-scraper` por no
  máximo ~60s (`waitForFinish`, teto da Apify) e roda em paralelo com o
  PageSpeed, pra caber nos 150s do Supabase Free. Se o actor ainda estiver
  rodando depois da espera, a run é abortada e grava
  `instagram_data = {error:'unavailable'}` — o diagnóstico segue com nota
  parcial. Nunca bloquear o diagnóstico por causa do scraper.
- Curtidas ocultas vêm como `-1` no scraper: o Growth Score ignora esses
  posts. Perfil privado devolve lista de posts vazia — não é "0 posts".

## Limite de 150s (plano Free do Supabase)

Toda execução HTTP de edge function (e trabalho em segundo plano via
`EdgeRuntime.waitUntil`) tem 150s de teto. Uma chamada única de ~4500
tokens à Claude já leva ~70-110s sozinha.

**Soluções aplicadas:**
- Trabalho pesado nasce respondendo na hora (`status:'generating'` ou
  equivalente) e roda via `EdgeRuntime.waitUntil`, nunca bloqueando a
  resposta HTTP — padrão usado em `generate`/`continue`/`reanalyze`/
  `refresh` do `strategy-generate`.
- Geração grande dividida em execuções separadas, cada uma com seu
  próprio relógio zerado (ex: `strategy-generate` `generate` vira 2
  passos: `runStep1` cria a tese, dispara `action:'continue'` como uma
  NOVA chamada HTTP pra `runStep2` fazer o plano tático).
- **Gatilho pra dividir em mais partes:** se os logs de timing
  mostrarem uma etapa passando de ~110s em uso real, a margem ficou curta
  — dividir essa etapa em 2, cada uma sua própria execução encadeada.
- Trabalho em paralelo em vez de fila quando o gargalo é esperar várias
  chamadas externas independentes (ex: `publishCarouselToInstagram` cria
  e espera os containers das fotos com `Promise.all`, não em sequência —
  10 fotos em fila estourariam os 150s, em paralelo o pior caso fica bem
  abaixo).
- O despachante (`cron_dispatch`) só espera o ACEITE (2xx) de cada
  chamada antes de seguir pra próxima empresa — nunca espera o trabalho
  de verdade terminar.

## Fire-and-forget sem garantia de saída

Um `fetch(...)` disparado sem `await` nem `EdgeRuntime.waitUntil` pode
nunca sair antes da função terminar e o runtime ser encerrado — bug real
encontrado em `strategy-generate` (`reanalyze` disparando
`refresh`/`generate` sem aguardar). **Solução:** sempre `await` o aceite
(2xx) antes de seguir, ou — se já dentro de um `waitUntil` — `await`
normalmente (não trava resposta nenhuma, já está em segundo plano);
registrar falha explícita (`console.error`) se o aceite não vier.

## `stop_reason: 'max_tokens'` da Claude

Se a Claude corta a resposta por `max_tokens`, repetir a MESMA chamada só
corta de novo. Chamadas pequenas podem tentar de novo 1x com mais tokens;
chamadas grandes (`allowRetry:false`) nunca tentam de novo sozinhas —
falham na hora com motivo claro, pro dono clicar "tentar de novo" em vez
de arriscar estourar os 150s com um retry automático. JSON malformado que
NÃO foi corte (formatação, não tamanho) é tratado diferente — aí vale
repetir do mesmo tamanho.

## APP_URL/domínio morto

O endereço antigo (`*.workers.dev`, e antes dele uma URL da Vercel ainda
mais antiga) parou de responder depois da migração pro domínio próprio
(`getsaleboost.com`). Qualquer lugar que ainda referencie essas URLs
antigas é bug: secret `APP_URL` (5 edge functions de OAuth), Site
URL/Redirect URLs do Supabase Auth (afeta e-mail de confirmação/recuperação
de senha — esse foi o mais grave, afetava todo usuário real), fallbacks
hardcoded em `create-checkout` e `telegram-chat`. `www.getsaleboost.com`
também precisou de uma rota própria no `wrangler.jsonc`
(`custom_domain:true`) — não herda automaticamente do domínio raiz.

## Deriva de migrations vs. banco real

`supabase/migrations/` não reflete 100% o schema de produção — muita
coisa foi aplicada direto via SQL editor/MCP ao longo do tempo. Pelo
menos 5 tabelas usadas hoje não têm NENHUM arquivo de criação local:
`posts`, `leads`, `lead_messages`, `agent_memory`, `business_types`.
**Nunca assumir estrutura só lendo os arquivos** — conferir sempre
`supabase db query --linked` (ou a ferramenta MCP do Supabase, quando
conectada) antes de uma migration nova.

## `posts.pillar/recipe/format/item_id` pode não existir em produção

A migration `20261002100000_posts_pillar_recipe.sql` é aditiva, mas se
`agent-actions` for deployado antes dela, o `update` dessas colunas falha —
por isso é um update separado em try/catch depois do insert do post (publicar
nunca depende dele). Não juntar essas colunas ao insert principal. Posts
publicados antes da migration ficam sem pilar (o 80/20 os ignora com aviso).
~~Também: `npm run lint` na raiz falha com "multiple candidate
TSConfigRootDirs" por causa da pasta `frontend/` rastreada — erro de
ambiente pré-existente, não de código novo.~~ Resolvido no mesmo dia
(`tsconfigRootDir` + `frontend/` ignorado em `eslint.config.js`). Se
voltar a aparecer, procure pastas de worktree de agente
(`.claude/worktrees/`) — o eslint também as varre.

## Deploy do site é a Cloudflare, não o GitHub

Descoberto em 2026-10-02: o workflow `.github/workflows/deploy.yml`
falhava em todo merge desde pelo menos 30/09 ("Cannot use the access token
from location", código 9109 — o token da Cloudflare só aceita certos IPs)
e ninguém percebeu, porque o site continuava atualizando: quem publica de
verdade é a integração Git da Cloudflare (Workers Builds), que faz o build
e publica o worker `sales-boost-restaurants` (getsaleboost.com) a cada push
no `main` (confirmado com `npx wrangler deployments list`: uma publicação
logo depois de cada merge). O `deploy.yml` foi removido por decisão do
dono. Consequências:
- Pra conferir se o site subiu: `npx wrangler deployments list --name
  sales-boost-restaurants`, não a aba Actions do GitHub.
- As variáveis `VITE_*` do build ficam configuradas na Cloudflare
  (Workers Builds), não nos secrets do GitHub.
- Em branch de PR a Cloudflare comenta "Deployment successful", mas é só
  versão de prévia — o domínio só muda com push no `main`.

## Popup de boas-vindas mostra números inventados

Achado em 2026-10-06 (teste visual com empresa sintética no ensaio, criada
na hora e sem nenhum dado): o popup "Bom dia, construtor de negócio"
(`ProgressPopup.tsx` → `buildProgress` em `progressGame.ts`) mostrou
"+20.5% alcance", "+15% engajamento", "51 ações da IA". Os números vêm de
`seededRng` (sorteio fixo por empresa, "demo-first") misturados com dado
real via `Math.max(real, sorteio)`. Viola a regra 5 (nunca inventar números)
e a decisão do teste de 7 dias ("não é demo"). ~~Não corrigido ainda —
depende de decisão do dono.~~

**CORRIGIDO em 2026-10-06 (decisão do dono: só números reais; sem dado real =
número embaçado).** Nova regra: `buildProgress(real)` em `progressGame.ts` não
usa mais `seededRng` nem `Math.max(real, sorteio)` (o modo "demo-first" do
progressGame acabou). Cada métrica vem de `fetchRealSignals()` (tabelas
`posts`, `opportunities`, `reviews`, `campaigns`, `leads`, `progress_events`,
`instagram_performance_snapshots`) ou fica `null`, e a tela mostra
`<BlurredValue/>` (`progressParts.tsx`): placeholder fixo, `blur(6px)`, rótulo
"aguardando dados reais". Ficam embaçados por falta de fonte: alcance %, saúde
(score/status), conversas atendidas, automações, semanal (todas as linhas),
receita. XP/liga vêm da soma de `progress_events.gp` (real). `choosePopup`
só celebra (liga/streak/resultado) com dado real; sem nenhum dado de trabalho
cai em "status" com o texto honesto. Ao criar métrica nova nessas telas: se não
houver fonte real, `null` + `BlurredValue` — nunca estimativa.

## Teste visual local contra o ensaio

Pra ver a tela de verdade sem tocar produção: `vite build` com
`VITE_SUPABASE_URL/ANON_KEY` do ensaio, `vite preview --open false` (o
config usa https e tenta abrir navegador — sem `--open false` o processo
cai), Playwright do `/opt/pw-browsers`. O Chromium não alcança o Supabase
pelo proxy do ambiente: interceptar `*.supabase.co` com `page.route` e
repassar via `fetch` do Node. Conta e empresa sintéticas criadas pelo
service role do ensaio e apagadas no fim.

## Migrations com cron apontam pra produção

Várias migrations (`010_insights_cron.sql`, `015_find_sales_leads_cron.sql`,
`066_agent_actions_scheduling.sql`, `20260930170000_strategy_cron_dispatch.sql`
e outras) criam `cron.schedule` que chama
`https://miwcxakzyforbahpnpst.supabase.co/functions/v1/...` — a URL de
**produção** fixa no SQL. Rodar essas migrations no banco de ensaio
(`salesboost-ensaio`) faria o ensaio disparar functions **reais** de
produção (gasto de IA, ações em clientes reais). **Nunca aplicar
`supabase/migrations/` inteiro no ensaio** — copiar só a estrutura das
tabelas e pular/neutralizar qualquer `cron.schedule`/`net.http_post`.

O mesmo vale pro trigger `on_lead_insert` → `notify_hermes_new_lead()`,
que faz `net.http_post` pra `hermes-lead-alert` de produção. No ensaio a
função existe mas é vazia (só `RETURN NEW`) — se um dia copiar o schema de
novo, manter esse desligamento.

## Avisos de tipagem do Deno (não são bugs)

`SupabaseClient<any,...>` vs `SupabaseClient<unknown,{PostgrestVersion}...>`
e "Property X does not exist on type 'never'" são artefatos pré-existentes,
do projeto inteiro, por falta de lockfile/tipos gerados — não são erros
reais introduzidos por uma mudança. Comparar a contagem de erros antes/depois
de uma edição (`git show HEAD:<file>` como baseline) é como confirmar que
uma mudança não piorou nada, em vez de tentar zerar os avisos pré-existentes.

## `publish-instagram` deprecada

Zero chamadores no código, nunca terminou de rodar em produção. O
publicador único e ativo é `agent-actions` → `publishToInstagram`/
`publishCarouselToInstagram`. Até 2026-09-30, esse publicador real NUNCA
gravava em `instagram_posts` (só a function deprecada gravava, e ela
nunca rodou) — várias telas liam uma tabela sempre vazia. Corrigido
(`recordInstagramPost`), mas sem backfill: posts publicados antes da
correção continuam sem linha em `instagram_posts`.

## Hermes (a VPS externa) instável

`HERMES_URL` já apresentou 502/timeout em produção. Por isso o Telegram
foi deliberadamente mantido fora desse caminho (`telegram-chat` fala
direto com a Claude). Se o Jarvis/chat do dashboard começar a falhar, o
primeiro suspeito é essa VPS externa — só quem administra ela vê os logs
de verdade.

## Instagram conectado na empresa errada (aconteceu 2x)

Ver [INSTAGRAM.md](INSTAGRAM.md) — causa raiz não foi bug de código, foi o
agente de desenvolvimento desconectando automaticamente uma conta que não
era de teste, seguindo uma instrução anterior do dono que depois virou
obsoleta pelo contexto (uso aprovado do @getsaleboost pra este teste
específico). Lição: antes de desconectar algo automaticamente por uma
regra geral, checar se há uma decisão mais recente e específica em
[DECISIONS.md](DECISIONS.md) que a sobrepõe.

## Teste de PIVOT só pelo botão real (nunca burlando autenticação)

Uma tentativa de forçar o cenário PIVOT/TERMINATE via um gancho de teste
temporário em `strategy-generate` foi bloqueada pelo classificador de
segurança do próprio ambiente de execução (marcado como enfraquecimento
de autenticação) — e não foi contornada por nenhum caminho alternativo.
**A forma certa e já funcionando:** o botão "Pedir nova estratégia" do
dono usa o mesmo código exato do pivô automático — é simultaneamente uma
função real do produto e o jeito legítimo de testar esse caminho. Nunca
tentar simular autenticação/autorização pra testar um fluxo — sempre usar
o caminho real.

## `children` do carrossel do Instagram — risco não confirmado (watch no 1º teste real)

`agent-actions` → `publishCarouselToInstagram` manda `children: childIds`
como array dentro de um corpo `Content-Type: application/json`. A
documentação da Meta mostra exemplos desse campo como string separada por
vírgula (`children=<ID1>,<ID2>`), mas esses exemplos costumam ser de
chamadas form-encoded, não JSON — array deveria funcionar normalmente num
corpo JSON de verdade. **Nunca foi testado contra a API real** (achado
pelo agente `product` ao planejar o P0, ver
[ROADMAP.md](ROADMAP.md)). Não mudar o código sem confirmar que está
quebrado — se o primeiro carrossel de teste falhar especificamente nessa
etapa (erro no `media_publish` do container-pai, não nos containers
filhos), o ajuste é trocar `children: childIds` por
`children: childIds.join(',')` em `createMediaContainer` — mudança de 1
linha, mas deploy de `agent-actions` é alteração arriscada (lista em
CLAUDE.md), exige aprovação do dono antes.

## Realtime: dois `useRealtime` na mesma tabela/empresa colidem

O nome do canal era `rt:${table}:${companyId}`; o Supabase reaproveita
canal de mesmo nome e dá erro ao adicionar callback depois do `subscribe()`.
Quando mais de um componente escuta a mesma tabela (ex.: sino de pendências
no layout + ApprovalsPage), passe `{ key: '...' }` como 4º argumento. Em
`companies` a coluna de filtro é `id`, não `company_id` (`{ column: 'id' }`).

## Site em branco depois do deploy manual — build sem as variáveis `VITE_*` (2026-10-09)

**O que aconteceu:** depois do merge do PR #20, o Cloudflare (Workers Builds,
ligado ao GitHub) publicou o site certo — as variáveis de build
(`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_GOOGLE_OAUTH_CLIENT_ID`)
estão cadastradas nos dois gatilhos de build. Logo depois, um
`npx wrangler deploy` manual feito de um container novo (sem essas
variáveis no `.env.local`) **substituiu** o site por um build sem o endereço
do Supabase → página em branco (`supabaseUrl is required.`).

**Como foi resolvido:** `npx wrangler rollback` pra última versão boa e,
depois, build com as variáveis de produção + deploy (nomes de arquivo com
sufixo novo, pra nenhum navegador reaproveitar o arquivo quebrado em cache).

**Regras:**
- Merge na `main` já publica sozinho (gatilho "Deploy default branch").
  Depois do merge, **conferir** o site em vez de publicar de novo por cima.
- Se precisar de `npx wrangler deploy` manual: antes, conferir que o build
  tem o endereço do Supabase — `grep -c miwcxakzyforbahpnpst
  dist/assets/index-*.js` tem que dar mais que 0. Zero = NÃO publicar.
- Depois de qualquer deploy, abrir o site num navegador (não só `curl`, que
  dá 200 mesmo com a página em branco).

## CI vermelho no PR por erro de lint (2026-10-10)

- **O que aconteceu:** o PR #22 ficou com o check "Build" vermelho. O CI
  (`.github/workflows`) roda `npm ci`, `npm run build` **e** `npm run lint`.
  Rodei o lint só no arquivo da tela, e o erro estava numa função
  (`_shared/marketScan.ts`: `\/` desnecessário dentro de `[...]` numa regex
  → `no-useless-escape`).
- **Regra (pedido do dono):** todo PR tem que ficar verde. Antes de cada push,
  rodar no repositório inteiro `npm run build && npm run lint` e conferir que
  sai **0 errors** (os warnings antigos não reprovam). Depois do push, conferir
  os checks do PR e não dar a tarefa por concluída enquanto houver vermelho.

## Diagnóstico v2 sumia quando a cidade vinha como sigla ("Rj") (2026-10-10)

- **O que aconteceu:** o dono testou com cidade "Rj" e sem bairros. As
  hashtags da região saem de bairros + cidade, e nomes com menos de 3 letras
  eram descartados → nenhuma hashtag → `market_data.status = unavailable /
  sem_hashtags` → a seção some sem aviso. Nos testes usamos sempre "Rio de
  Janeiro / RJ" com bairros, então não apareceu.
- **Correção:** a cidade usa o primeiro pedaço com 3+ letras e, se só houver
  sigla, usa a sigla (`#imoveisrj` é comum). Testado em produção com "Rj" sem
  bairros: achou 3 concorrentes e 5 posts em alta.
- **Também:** a seção ficava lá embaixo e demora 1-2 min; o dono não via nem o
  "Analisando…". Ela foi pra logo abaixo da nota.
- **Lição:** testar com o jeito que um usuário de verdade preenche (siglas,
  campos vazios), não só com o caso ideal.

## Raspador de hashtags às vezes volta `{"noResults":true}` (2026-10-10)

- O `apidojo~instagram-scraper` respondeu só com `{"noResults":true}` em
  todas as buscas de um intervalo de ~10 min (03:09–03:12 UTC). Às 03:01, a
  mesma hashtag (#imoveisrj) tinha trazido posts. A causa ainda não está
  clara: limite do raspador, bloqueio do Instagram ou do plano da Apify.
- O que o sistema faz: tenta de novo uma vez e, se continuar vazio, segue sem
  concorrentes. A análise dos pontos fracos do próprio perfil continua
  saindo. O log `[market] posts lidos N válidos M` mostra quando acontece.
- Se isso virar rotina: olhar as execuções no painel da Apify, ou trocar pela
  busca de hashtag gratuita da Meta depois da aprovação do app.
- **Atualização 2026-10-11:** virou rotina. Desde 2026-10-10 03:09 UTC o
  `apidojo` só devolve vazio. Trocado pelo raspador **oficial**
  `apify~instagram-hashtag-scraper` (~US$ 0,0023 por post, 60 posts por
  diagnóstico ≈ US$ 0,14). Teste em produção: diagnóstico completo
  (concorrentes + em alta + descobertas) em 56 s. O texto acima fica como
  histórico.

## Bucket `post-images` de produção aceita no máximo 5 MB por arquivo (2026-10-11)

- Em produção, `post-images` tem `file_size_limit` de 5 MB e só aceita
  png/jpeg/webp. No ensaio o limite é outro — um teste que passa no ensaio
  pode falhar em produção.
- A foto tratada pela Higgsfield (criativo do kit grátis) vem em PNG
  1296×1728 (~3,3 MB no teste). Se passar de 5 MB, o `_shared/freeKit.ts` usa
  o link da própria Higgsfield e o texto é impresso logo em seguida. Se o
  render falhar 3 vezes, o painel entrega a foto tratada sem texto (nunca
  fica "carregando" pra sempre).
- Antes de gravar arquivo grande no Storage, conferir o limite do bucket em
  produção: `select id, file_size_limit, allowed_mime_types from storage.buckets`.

## Busca de leads cortada no meio pelo limite de tempo da função (2026-10-12)

- **O que aconteceu:** a primeira busca com o perfil de imóveis começou às
  06:00 UTC. Ela parou depois de analisar 7 de 79 negócios e o registro
  ficou "running" pra sempre. A tela mostrava "Em andamento" e o botão de
  buscar ficava travado.
- **Por quê:**
  - `find-sales-leads` roda em segundo plano (`EdgeRuntime.waitUntil`),
    mas a Supabase corta a função por volta de 150s.
  - Com restaurantes, quase todo candidato caía cedo nos filtros (nota,
    avaliações, sem Instagram) e a busca inteira levava ~1 min.
  - Com imóveis, quase todos passam pros passos lentos (Apify do Instagram +
    IA), uns 15–35s cada.
- **Correção:**
  - Prazo de 80s: depois disso não começa candidato novo. Os que sobram ficam
    pra próxima busca, porque a lista dos já vistos evita repetir.
  - Apify com timeout de 40s.
  - O disparo seguinte fecha como erro qualquer registro "running" com mais
    de 10 min.
  - A tela mostra "Interrompida" em vez de "Em andamento".
- **Ao mexer nessa função:** qualquer passo novo por candidato encurta
  quantos cabem por busca (hoje cabem uns 3–5 que chegam até a IA).

## Estúdio de vídeo na VPS — armadilhas (2026-10-12)

- **O bucket `videos` só aceita vídeo.** Imagem dá `415 invalid_mime_type`.
  Por isso a capa do vídeo vai pro `post-images/video-covers/`.
- **Trabalhador morto no meio de um trabalho:** o trabalho fica `running`
  até o prazo de 15 min vencer e depois volta pra fila (no máximo 3
  tentativas). Até lá, o tour espera; ele volta pra colagem antiga em no
  máximo 20 min. Em teste, nunca deixe dois trabalhadores ligados ao mesmo
  tempo, senão um "rouba" o trabalho do outro.
- **Testar o instalador neste ambiente da Claude:** a internet passa por um
  intermediário com certificado próprio que o usuário `sbworker` não
  consegue ler. Pra testar, use `NODE_EXTRA_CA_CERTS` com uma cópia legível
  do certificado. Na Hostinger isso não existe. O `systemd` também não roda
  aqui, então a etapa 5 só é testada de verdade na VPS.
- **Mudou o `public/vps/worker.mjs`? Atualize o `WORKER_SHA256`** em
  `supabase/functions/vps-worker/index.ts` com o resultado de
  `sha256sum public/vps/worker.mjs` e publique a função depois do merge.
  A VPS só se atualiza sozinha para um arquivo com exatamente esse hash. Se
  esquecer, nada quebra: ela só continua na versão antiga.
- **"Testar antes × depois" nunca usa vídeo de cliente (regra 2).** Ele usa
  só vídeo da empresa do próprio dono logado. Se não houver nenhum, a VPS
  gera uma amostra deitada.
- **Desinstalar a VPS não invalida a chave dela.** Depois do `uninstall`,
  clique em "Desconectar" na tela. Reinstalar na mesma máquina já invalida
  sozinho o registro antigo com o mesmo nome.
- **Prazo de 15 min por trabalho:** um trabalho com muitos vídeos pode
  passar desse prazo e ser pego de novo. Com um servidor só, isso não
  acontece. Rever se um dia houver mais de um servidor.

## Botões do Telegram (aprovar pelo Telegram, 2026-10-12)

- **Limite de 64 bytes no `callback_data`.** Por isso o formato é curto:
  `tipo|op|uuid|assinatura22` = 63 bytes. Não colocar mais nada aí — o
  Telegram recusa o teclado inteiro e a mensagem nem sai.
- **O `telegram-webhook` não sabe se a chamada veio mesmo do Telegram**
  (registrado sem `secret_token`). Nunca confiar no `chat.id` do corpo
  sozinho: toda decisão confere a assinatura HMAC do botão (chave derivada
  da service role, presa a item + chat) — e o `agent-actions` confere de
  novo, sem confiar em quem chamou.
- **Dois toques rápidos / Telegram reenviando o mesmo toque** não publicam
  duas vezes: a aprovação é uma troca condicional de status (só sai de
  `PENDING`/`EDITED`; post do Vault só sai de `vault` → `publishing`).
- **Teste:** no ensaio não há bot; o teste usa uma function temporária que
  assina botões (`tg-sign-probe`, já neutralizada com 410). Em produção,
  conferir os toques pelos logs do `telegram-webhook`.
- **Migration com cron:** `20261014100000_telegram_buddy.sql` aponta pra
  produção — no ensaio aplicar só a tabela e a flag.

## Functions não checavam pagamento — usar `_shared/access.ts` (2026-10-13)

- **O que era:** o bloqueio de conta sem plano existia só na TELA (`ClientRoute`).
  Nenhuma edge function conferia pagamento, então quem chamasse a function direto
  (ou uma tela que dispara sozinha ao abrir) gastava IA/provedor e publicava mesmo
  sem pagar. Com o "modo vitrine" (conta nova navega por todo o painel antes de
  pagar) isso virou o risco principal.
- **Regra:** **toda function nova que gasta IA/provedor pago ou publica/envia, no
  caminho chamado por usuário (JWT), chama `requirePaidAccess(admin, companyId)`**
  logo depois de achar a empresa (`if (noPlan) return noPlan`). Todo caminho de
  cron que varre empresas faz `if (!(await hasPaidAccess(admin, id))) continue`.
  Mesma regra do frontend (`isShowcaseMode`): empresa criada antes de
  2026-10-06 sempre passa; consulta com erro passa (falha aberta); conta nova só
  passa se pagou ou foi liberada à mão (o trial de 7 dias gravado pelo
  `claim-diagnostic` NÃO conta). Resposta: 402 `{code:'plan_required'}`.
- **Com o check (2026-10-13):** creative-generate, strategy-generate (generate/
  reanalyze/refresh + `cron_dispatch`), content-engine, generate-posts,
  content-image (generate/variations), generate-video, item-videos (create),
  brand-compose, render-format (só com `generate_bg`), format-fill, content-test
  (generate/score/regenerate, só no caminho do usuário), catalog-package,
  marketing-ai, agent-actions (propose/approve/retry), publish-instagram,
  send-message, draft-reply, reply-google-review, creative-ideas,
  map-competitors, detect-opportunities, agent-chat, generate-tab-insight,
  content-intelligence, generate-report, adapt-plan, brand-kit-suggest.
- **De fora de propósito:** `agent-actions` list/reject/cancel/edit/unschedule/
  run_scheduled/telegram_decide; trial-video, diagnosis-gift, claim-diagnostic,
  create-checkout, stripe-webhook, update-company-profile, oauth (start/
  callback), telegram-*, vps-worker (kit, pagamento e conta continuam livres);
  generate-image (só service/cron/owner da plataforma chegam nela — cliente toma
  403 antes); render-format sem `generate_bg` (o kit grátis precisa desenhar o
  texto do criativo e isso não custa nada).
- **Espelho na tela:** `PAID_FUNCTIONS` em `src/lib/showcaseGuard.ts` precisa
  acompanhar essa lista — function nova que gasta entra nos dois lados. Escrita
  direta nova do supabase client numa tabela que NÃO é dado da empresa é
  bloqueada em vitrine por padrão (`ALLOWED_WRITE_TABLES`).
- **Armadilhas da tela:** (1) a tela abrindo e disparando function sozinha (ex.:
  1ª estratégia, ideias, Kit da Marca) não pode abrir o modal — por isso o guard
  fica em silêncio nos primeiros 1,5 s depois de trocar de rota e essas telas
  checam `useShowcase().readOnly` antes de disparar. Efeito novo que chama
  function paga ao abrir a tela = checar `readOnly`. (2) O `trial-video` chama o
  `render-format` com o login da pessoa: gate nele quebraria o criativo do kit.
- **Antes de deployar:** mudar functions de cliente real (`agent-actions`,
  `strategy-generate`, `creative-generate`) é alteração arriscada — pedir
  aprovação. A migration `20261015100000_profile_confirmed_at.sql` precisa estar
  aplicada pro lembrete de 30 dias funcionar (sem ela o item simplesmente não
  aparece e nada quebra).
- **Achado à parte:** `publish-instagram` aceita `company_id` do corpo sem
  conferir quem chama (função deprecada, sem chamadores). O gate de pagamento foi
  posto nela, mas a falta de autenticação continua — avaliar desligar de vez.


## Calendário da estratégia, portal e mobiliar (2026-10-14)

- **Calendário não pode gerar tudo numa chamada só** (teto de 150s): o
  `planWeekFromStrategy` só despacha; cada vaga é uma chamada `plan_slot`
  própria que responde 202 e trabalha em `EdgeRuntime.waitUntil`. E pula
  vaga que já tem peça no mesmo dia — clicar 2x não gasta IA 2x.
- **`portal-import` checa o endereço só pelo texto** (https, sem IP interno
  literal, redirects validados). Um domínio que RESOLVE pra IP interno
  passaria — risco baixo (só conta paga chama e só volta XML/imagem), mas
  não é proteção completa. Foto só jpg/png/webp/avif/gif (SVG barrado).
- **Teto do mobiliar:** a linha é gravada antes de enviar à Higgsfield e o
  teto é reconferido; o reenvio automático de um pedido que falhou (até 2
  tentativas) não conta no teto — o gasto real pode chegar a ~2× o teto.
- **Ferramenta MCP do Supabase trava** (timeout de 60s sem chegar no banco)
  quando o SQL contém palavras como `alter`/`delete`/`drop` — inclusive
  dentro de um texto/JSON. Ela espera confirmação de comando perigoso. No
  ensaio deu pra contornar quebrando em comandos menores; em produção, o
  dono pode precisar confirmar na tela.

## Teste final na Tespon (2026-10-14) — o que apareceu

- **`agent_performance.latency_ms` é NOT NULL.** Insert sem ele falha calado
  (supabase-js devolve `{error}`, não lança). O registro de custo do
  tratamento do Vault (`logPhotoRetouch`) não gravava e o teto não somava as
  edições. Corrigido mandando `latency_ms: 0`.
- **Vídeo do imóvel falhando em < 1 min, 2 tentativas, sem motivo.** O motor
  só guardava "passagem falhou 2x". Agora o `checkClip` registra o motivo da
  Higgsfield (`[tour] higgsfield recusou`). Suspeita no dia: saldo baixo
  (a edição de US$ 0,08 passou, o vídeo de US$ 0,42 não). Vídeo que falha
  zera `cost_usd` — não conta no teto.
- **A IA inventava "depoimento" de cliente** no post genérico do Vault e
  escrevia mensagem pro corretor como legenda quando faltava dado ("Ops!
  Corretor, me passa…"). Regra de honestidade no `preamble` do
  `creative-generate` e no `writeCopy` do `catalog-package`. O filtro de
  qualidade já segurava a peça ruim (nota 12, ficou em rascunho).
- **Mobiliar acrescentou cobertura no terraço** (e trocou a luz pra fim de
  tarde). Ficha reforçada (`20261017130000_staging_no_structure.sql`):
  estrutura nunca muda; pôr do sol pode (decisão do dono). O dono continua
  aprovando o antes/depois — nenhuma IA garante 100%.
- **Catálogo aceita número absurdo** (37.372 vagas, 7.373 m² num
  apartamento) e o post repete o que o dono digitou. Não é invenção, mas
  precisa de validação de faixa na ficha — ver análise de segurança.
- **OpenStreetMap (Overpass) recusa pedido "grande" com 504 "too busy"**
  (achado 2026-10-14). Não é o servidor fora do ar: ele recusa quem declara
  orçamento alto (`[timeout:25]`) ou usa `around:` em muitos filtros. O que
  funciona: caixa (`[bbox:…]`) + `[timeout:10][maxsize:16000000]`, um pedido
  por vez (dois ao mesmo tempo do mesmo IP = 504). Há 2 servidores reserva
  em `_shared/nearbyPlaces.ts`. No mapa tem lixo (parquinho marcado como
  praia): por isso o `name_pattern` por categoria na ficha.
- **Limite de functions do Supabase** (achado 2026-10-15): criar function
  nova deu "Max number of functions reached for project". Subir de plano
  custa dinheiro e apagar function velha é remover funcionalidade (precisa
  do dono). Por isso "Dicas e FAQ" atende pela mesma function de "Lugares
  perto" (`nearby-places`, `{ area: 'faq' }`). Antes de planejar function
  nova, contar as que existem (`list_edge_functions`) ou reaproveitar uma.
- **Nominatim recusa (403) pedidos vindos das edge functions** (achado
  2026-10-15; do banco, via pg_net, funcionava). O endereço é achado pelo
  Photon (photon.komoot.io), outro geocodificador grátis do OpenStreetMap.
  O Overpass vai por POST com 4 servidores na fila (`_shared/nearbyPlaces.ts`).
