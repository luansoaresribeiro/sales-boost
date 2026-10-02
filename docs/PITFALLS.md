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

A migration `20261001100000_posts_pillar_recipe.sql` é aditiva, mas se
`agent-actions` for deployado antes dela, o `update` dessas colunas falha —
por isso é um update separado em try/catch depois do insert do post (publicar
nunca depende dele). Não juntar essas colunas ao insert principal. Posts
publicados antes da migration ficam sem pilar (o 80/20 os ignora com aviso).
Também: `npm run lint` na raiz falha com "multiple candidate
TSConfigRootDirs" por causa da pasta `frontend/` rastreada — erro de
ambiente pré-existente, não de código novo.

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
