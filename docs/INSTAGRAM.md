# Sales Boost — Instagram: conexão e publicação

## Autenticação

**API with Instagram Login** (sem Página do Facebook necessária).
`supabase/functions/instagram-oauth-callback/index.ts`.

Permissões: `instagram_business_basic`, `instagram_business_content_publish`,
`instagram_business_manage_comments`, `instagram_business_manage_insights`,
`instagram_business_manage_messages`.

**Enquanto o app não passar no App Review da Meta**, só contas
TESTADORAS conseguem conectar (Meta → Funções do app → Testadores do
Instagram → aceitar o convite na conta real que vai testar). Isso é uma
limitação de fora do código — nenhuma correção no Sales Boost resolve
isso, só o processo de review da Meta (ver P0/fora-do-código em
[ROADMAP.md](ROADMAP.md)).

## O que o callback salva

`instagram_user_id`, `instagram_username` (sempre busca `/me` pra ter o @
real, não só o id numérico), `instagram_access_token`,
`instagram_token_expires_at` — os 4 campos de verdade da conexão.

**Desconectar** (`IntegrationsTab.tsx` → `handleDisconnectIgOauth`) zera
os 4 — corrigido em 2026-09-30 (antes só zerava `instagram_user_id` +
`instagram_auto_post`, deixando o token válido escondido no banco mesmo
com a tela mostrando "desconectado").

## Proteção contra conta em 2 empresas (2026-10-01)

`instagram-oauth-callback` agora confere, antes de salvar, se o
`instagram_user_id` já está conectado em OUTRA empresa — se estiver,
recusa e redireciona com um erro explicando qual empresa já tem essa
conta, em vez de sobrescrever silenciosamente. Sem essa checagem, duas
empresas podiam achar que "são donas" da mesma conta real ao mesmo tempo.

## Como conectar do jeito certo

1. Fazer login no dashboard **com a conta/empresa certa** (confirmar na
   tela qual empresa está ativa antes de clicar em conectar — se tiver
   mais de uma aba/sessão aberta, uma janela anônima evita conectar na
   empresa errada por engano).
2. Configurações → Conexões → "Conectar Instagram".
3. Fazer login no Instagram com a conta que vai ser testada (precisa ser
   testadora do app, ver acima) e aceitar as permissões.
4. Confirmar na tela de Conexões que o **@ certo** apareceu — se aparecer
   vazio/errado, não tentar de novo sem antes checar
   [PITFALLS.md](PITFALLS.md) ("Instagram conectado na empresa errada").

## Pitfall conhecido: "reconectei mas continua aparecendo desconectado"

Já aconteceu 2 vezes nesta sessão de trabalho (2026-09-30): o dono
reconectou o Instagram, e pouco depois a tela voltava a mostrar
desconectado. **Investigado e não é bug do callback** — os logs confirmam
que as duas trocas de código OAuth foram bem-sucedidas (sem erro, redirect
de sucesso). A causa real: o agente de desenvolvimento, seguindo uma
instrução anterior do dono ("se a conta conectada não for uma conta de
teste, desconecte"), desconectou a conta automaticamente logo depois de
cada reconexão, porque a conta usada era a oficial pública do Sales Boost
(@getsaleboost), não uma conta de teste dedicada. Ver
[DECISIONS.md](DECISIONS.md) — isso foi resolvido criando uma decisão
explícita permitindo o uso do @getsaleboost para este teste específico, em
vez de continuar desconectando automaticamente.

**Se isso acontecer de novo:** antes de reconectar, confirmar no
[DECISIONS.md](DECISIONS.md) se a conta em uso está com uso aprovado — se
não estiver, é esperado que o agente desconecte, e a solução é pedir
aprovação explícita, não insistir reconectando.

## Conexão pelo /setup (2026-10-06)

O cartão "Conecte seu Instagram" do `/setup` usa o mesmo link das
Configurações (`instagram-oauth-start?company_id=...`). A volta do OAuth
(`instagram-oauth-callback`) continua caindo em **Configurações** — a
function não foi alterada. Se o `/setup` ainda estiver incompleto, o gate
em `ClientRoute` leva a pessoa de volta pro `/setup`, onde o cartão já
aparece como conectado. "Conectar depois" não grava nada: o sino de
pendências continua mostrando "Conectar o Instagram". Pode virar
obrigatório por ficha com `config.setup.instagram_required = true`.

## Página do Facebook e API com login do Facebook (2026-10-07)

O @getsaleboost está ligado à Página **"Sales Boost Company"** (IG id
`17841442836358659`, Portfólio empresarial "SalesBoost"). Existe também
uma Página "Sales Boost" criada no mesmo dia por engano, sem Instagram.
Pode ser apagada. A conta do Facebook usada para administrar é um
**perfil** chamado "Sales Boost" (não uma Página). Isso confunde, e foi o
motivo de `me/accounts` voltar vazio até a Página ser criada e ligada.
O app lê a própria conta pela API com login do Facebook, mas
`business_discovery` de terceiros retorna erro #10 até o App Review. Não
é usado (o diagnóstico usa Apify, ver DECISIONS 2026-10-07). Material do
pedido de aprovação: [META-APP-REVIEW.md](META-APP-REVIEW.md).
