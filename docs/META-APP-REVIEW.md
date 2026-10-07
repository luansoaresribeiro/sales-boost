# Sales Boost — Material para o App Review da Meta

> Roteiro para o dono enviar o pedido de aprovação do app **SALESBOOST**
> no painel da Meta. Os textos para colar estão em **inglês** (a Meta
> revisa em inglês); a explicação de cada passo está em português.
> Tudo aqui descreve o que o código faz **de verdade** hoje. Se o código
> mudar, atualize este doc antes de reenviar.

## Por que pedir

Enquanto o app não for aprovado, só contas **testadoras** conseguem
conectar o Instagram no painel do Sales Boost (ver
[INSTAGRAM.md](INSTAGRAM.md)). Corretor de verdade clica em "Conectar" e
recebe erro. A aprovação libera a conexão para qualquer cliente.

**Não faz parte deste pedido:** ler perfis de terceiros pelo @ (Business
Discovery). O diagnóstico usa sempre a Apify com teto grátis (decisão de
2026-10-07 em [DECISIONS.md](DECISIONS.md)), então não pedimos
`instagram_basic`, `pages_read_engagement` nem `business_management` para
isso. Pedir permissão que o app não usa é motivo comum de reprovação.

## Antes de enviar (checklist)

- [ ] **Verificação da empresa** (Business Verification) no Portfólio
  empresarial "SalesBoost" (business.facebook.com → Configurações →
  Central de segurança → Verificação). Exige CNPJ e um documento da
  empresa. Sem ela, a Meta pode negar o acesso avançado.
- [ ] **Configurações básicas do app** (developers.facebook.com → app →
  Configurações do app → Básico):
  - URL da Política de Privacidade: `https://getsaleboost.com/privacidade`
  - URL dos Termos de Uso: `https://getsaleboost.com/termos`
  - Exclusão de dados: usar "URL de instruções para exclusão de dados" →
    `https://getsaleboost.com/privacidade` (a seção "Retenção" explica que
    o pedido é feito pelo e-mail de privacidade). **Pendência:** a
    política só diz isso em uma frase. O ideal é uma seção própria
    "Como excluir seus dados", com passo a passo (ver "Pendências de
    código" no fim).
  - Ícone do app: 1024×1024 px (logo do Sales Boost).
  - Categoria: Business / Negócios.
  - E-mail de contato: o e-mail do Sales Boost.
- [ ] **Conta para o revisor:** criar uma conta no site só para a Meta,
  por exemplo `luan26ribeiro+meta@gmail.com`, com uma senha só dessa
  conta. Ela passa pelo `/setup` normalmente (preencher dados, perguntas
  e 1 imóvel com fotos antes do envio, para o revisor cair direto no
  painel). **Nunca usar a conta de um cliente real.**
- [ ] **Instagram de teste** para gravar os vídeos: o @getsaleboost
  (uso aprovado pelo dono em DECISIONS) ou outra conta comercial de
  teste. Ela precisa estar como testadora do app (Funções do app →
  Testadores do Instagram).

## Permissões a pedir (5 do Instagram + business_management + public_profile)

Lista final do formulário: as 7 abaixo. Excluir todas as outras (Human
Agent, Marketing API Access Tier, WhatsApp, `pages_*`, `ads_read`,
`instagram_basic`, `instagram_manage_comments`, `ads_management`,
`ads_mcp_management`, `leads_retrieval`, `catalog_management`,
`manage_fundraisers`).

**Como usar esta seção:** para cada permissão, a Meta mostra uma caixa
"Please provide a detailed description...". Cole **o bloco inteiro em
inglês** daquela permissão (ele já responde: por que pedimos, como o app
usa, que valor gera para o cliente, por que é necessária e como o revisor
testa). Onde aparecer `[EMAIL]` e `[SENHA]`, digite **direto no
formulário da Meta** o login da conta do revisor no Sales Boost. Nunca
escreva a senha neste doc nem no chat. A Meta pede para **não** informar
senha de conta do Instagram: o revisor usa a conta do Instagram dele.

Depois de colar: subir o vídeo daquela permissão e marcar "I agree".

### 1. `instagram_business_basic`

Em português: ler o @ e os posts da conta que o dono conectou, para
mostrar no painel e montar a estratégia de conteúdo. Também é
pré-requisito de comentários, mensagens, publicação e estatísticas.

**Colar na caixa de descrição:**

```text
WHAT SALES BOOST IS
Sales Boost (https://getsaleboost.com) is a marketing assistant for real
estate agents and small real estate agencies in Brazil. The business
owner connects their own Instagram professional account; Sales Boost
then plans content, drafts posts for the owner to approve, organizes
interested buyers who comment or send messages, and shows results. The
owner approves everything before anything is published or sent.

HOW WE USE instagram_business_basic
After the owner connects their Instagram professional account with
Instagram Business Login, we read the account's basic profile
information (Instagram user ID and username) and the list of the
account's own media (posts with caption, media type and timestamp).
- The username is shown in Settings > Connections so the owner can
  confirm which account is connected, and at the top of the Performance
  screen.
- The list of the owner's posts is used to show their content inside
  the dashboard and to plan the next posts (for example, which formats
  and topics the account already uses).
We only access the account that the owner connected. We do not access
any other Instagram account.

VALUE FOR THE USER AND WHY IT IS NECESSARY
Without this permission the app cannot identify which Instagram account
belongs to the business, cannot show the owner's own posts, and cannot
plan content based on what the account already publishes. It is the
base for every other feature, and it is also required as a dependency
for instagram_business_manage_comments, instagram_business_manage_messages,
instagram_business_content_publish and instagram_business_manage_insights,
which we are requesting in this same submission.

DATA HANDLING
The access token is stored encrypted at rest in our database and used
only server-side. The owner can disconnect at any time in Settings >
Connections ("Desconectar"), which deletes the stored token and username.
We do not sell or share this data.

HOW TO TEST
1. Go to https://getsaleboost.com/login and sign in with:
   Email: [EMAIL]   Password: [SENHA]
2. In the left menu, open "Configurações" (Settings) and then the tab
   "Conexões" (Connections).
3. Click "Conectar Instagram" and log in with your own Instagram
   professional (Business or Creator) account. Accept the permissions.
4. You return to Settings > Connections, which now shows the connected
   username (@yourusername).
5. Open "Marketing AI" in the left menu > "Agente de Dados" (Data Agent)
   > tab "Performance". The connected username and the account's posts
   are displayed there.
The interface is in Portuguese; the screen recording has English
captions showing each step.
```

**O vídeo deve mostrar:** login no Sales Boost → Configurações → Conexões
→ Conectar Instagram → tela do Instagram pedindo permissão → volta com
o @ aparecendo → Marketing AI → Agente de Dados → Performance com o @ e
os posts.

### 2. `instagram_business_content_publish`

Em português: publicar um post **só depois que o dono clica em Aprovar**
(regra 1 do produto). Código: `agent-actions` (a function antiga
`publish-instagram` está deprecada e não é usada, ver
[PITFALLS.md](PITFALLS.md)).

**Colar na caixa de descrição:**

```text
HOW WE USE instagram_business_content_publish
Sales Boost prepares post drafts for the business owner: photos of real
properties that the owner uploaded, plus a caption. Every draft goes to
the "Aprovações" (Approvals) screen. Nothing is published
automatically. A post is published to the owner's connected Instagram
account only after the owner opens the draft and clicks "Aprovar"
(Approve). We use this permission only to publish content that the
owner explicitly approved, on the account the owner connected.

VALUE FOR THE USER AND WHY IT IS NECESSARY
Real estate agents usually have little time to post. Sales Boost saves
them time by preparing the post and publishing it with one click after
approval, without downloading files and posting manually. Without this
permission the owner would have to leave the app and publish by hand,
which is the main problem our product solves.

HOW TO TEST
1. Go to https://getsaleboost.com/login and sign in with:
   Email: [EMAIL]   Password: [SENHA]
2. Connect your Instagram professional account in "Configurações" >
   "Conexões" > "Conectar Instagram" (if not connected yet).
3. Open "Aprovações" (Approvals) in the left menu. A draft post is
   waiting there.
4. Open the draft and click "Aprovar" (Approve).
5. The post is published on the connected Instagram account. Open the
   Instagram profile to see it.
This permission is requested together with instagram_business_basic,
which identifies the connected account.
```

**O vídeo deve mostrar:** Aprovações → abrir rascunho → Aprovar → abrir o
Instagram e mostrar o post publicado. **Atenção:** isso publica de
verdade. Gravar com o @getsaleboost só com aprovação do dono (regra 3), ou
com uma conta de teste.

### 3. `instagram_business_manage_comments`

Em português: receber os comentários dos posts do dono, identificar
interesse em imóvel ("qual o valor?") e sugerir resposta, que só sai com
aprovação. Código: `instagram-webhook`.

**Colar na caixa de descrição:**

```text
HOW WE USE instagram_business_manage_comments
We subscribe to comment webhooks for the owner's connected account. When
someone comments on one of the owner's own posts, Sales Boost reads the
comment and checks if it shows interest in a property (for example
"what is the price?" or "is it still available?"). For these comments,
Sales Boost suggests a reply and places it in the "Aprovações"
(Approvals) screen. The reply is sent only after the owner clicks
"Aprovar" (Approve), or under an automatic rule that the owner created
and can turn off at any time. We only read and reply to comments on the
owner's own posts.

VALUE FOR THE USER AND WHY IT IS NECESSARY
Comments asking about price or availability are potential buyers. Small
agencies often miss them or answer too late. Sales Boost makes sure
every interested comment is seen and answered quickly, with the owner
in control. Without this permission the app cannot see the comments or
reply to them.

HOW TO TEST
1. Go to https://getsaleboost.com/login and sign in with:
   Email: [EMAIL]   Password: [SENHA]
2. Connect your Instagram professional account in "Configurações" >
   "Conexões" > "Conectar Instagram".
3. From a different Instagram account, comment on a post of the
   connected account, for example: "Qual o valor?" ("What is the
   price?").
4. In Sales Boost, open "Aprovações" (Approvals). The comment appears
   with a suggested reply.
5. Click "Aprovar" (Approve). The reply is sent.
This permission is requested together with instagram_business_basic,
which is required as a dependent permission.
```

**O vídeo deve mostrar:** comentário feito por outra conta → aparece em
Aprovações com a resposta sugerida → Aprovar → resposta chegando.

### 4. `instagram_business_manage_messages`

Em português: receber as DMs como leads e mandar resposta privada para
quem comentou com interesse, com aprovação do dono. Código:
`instagram-webhook` (grava em `lead_messages`, envia por
`/{ig-id}/messages`).

**Colar na caixa de descrição:**

```text
HOW WE USE instagram_business_manage_messages
1) Receiving messages: when a person sends a Direct Message to the
owner's connected business account, Sales Boost receives it by webhook
and saves the conversation as a lead in the owner's sales pipeline
("Agente de Conversão" / Sales Pipeline), so the owner does not lose
potential buyers.
2) Private replies: when someone comments with interest in a property,
the owner can send that person a private reply in Direct Messages. The
private reply is sent only after the owner approves it in "Aprovações"
(Approvals), or under an automatic rule that the owner created and can
turn off at any time.
We only message people who contacted the business first (a comment or a
message). We never send unsolicited or bulk messages.

VALUE FOR THE USER AND WHY IT IS NECESSARY
For real estate agents, Direct Messages are where most negotiations
start. Organizing these conversations as leads and answering interested
people quickly is the core value of Sales Boost. Without this
permission the app cannot receive Direct Messages or send the private
reply that the owner approved.

HOW TO TEST
1. Go to https://getsaleboost.com/login and sign in with:
   Email: [EMAIL]   Password: [SENHA]
2. Connect your Instagram professional account in "Configurações" >
   "Conexões" > "Conectar Instagram".
3. From a different Instagram account, send a Direct Message to the
   connected account.
4. In Sales Boost, open "Marketing AI" > "Agente de Conversão"
   (Conversion Agent). The person appears as a new lead with the
   message.
5. To test a private reply: comment "Qual o valor?" on a post of the
   connected account from a different account, open "Aprovações"
   (Approvals) and click "Aprovar". The commenter receives the reply in
   Direct Messages.
This permission is requested together with instagram_business_basic,
which is required as a dependent permission.
```

**O vídeo deve mostrar:** DM enviada por outra conta → lead aparecendo em
Agente de Conversão → comentário com interesse → Aprovar → resposta
privada chegando na DM.

### 5. `instagram_business_manage_insights`

Em português: ler alcance, curtidas, comentários e salvamentos dos posts
para a aba Performance e para aprender o que funciona. Código:
`instagram-performance`, `insights-collect`.

**Colar na caixa de descrição:**

```text
HOW WE USE instagram_business_manage_insights
We read insights for the owner's own posts and account (reach,
impressions, likes, comments, saves and follower count) and show them
in the "Performance" screen. Sales Boost also uses these numbers to
learn which posts work best for that business, so the next content
suggestions are based on real results instead of guesses. Insights are
shown only to the owner of the connected account and are not shared
with anyone else.

VALUE FOR THE USER AND WHY IT IS NECESSARY
Small real estate businesses rarely measure their results. Showing
which posts reached more people and generated more interest helps them
invest time in what works. Without this permission the app cannot show
any performance data or improve its suggestions.

HOW TO TEST
1. Go to https://getsaleboost.com/login and sign in with:
   Email: [EMAIL]   Password: [SENHA]
2. Connect your Instagram professional account in "Configurações" >
   "Conexões" > "Conectar Instagram".
3. Open "Marketing AI" > "Agente de Dados" (Data Agent) > tab
   "Performance". Reach, likes, comments and saves of the account's posts
   are displayed.
This permission is requested together with instagram_business_basic,
which is required as a dependent permission.
```

**O vídeo deve mostrar:** Marketing AI → Agente de Dados → Performance
com os números dos posts da conta conectada.

### 6. `business_management`

> ⚠️ **Atenção (2026-10-07):** o dono tirou `ads_read` do pedido. Hoje o
> único uso de `business_management` no código é listar contas de anúncio
> para a tela de resultados de anúncios, que depende de `ads_read`. Sem
> `ads_read` a Meta tende a reprovar esta permissão também, porque o vídeo
> não consegue mostrar a tela de anúncios com números. Decidir com o dono
> se tira `business_management` também.

Em português: só listar as contas de anúncio que o dono acessa dentro do
portfólio empresarial dele, para ele escolher qual conectar.

**Colar na caixa de descrição:**

```text
HOW WE USE business_management
Many business owners manage their ad account inside a Meta Business
portfolio. When the owner clicks "Conectar" (Connect) in the "Meta Ads Manager"
card, we use
business_management only to list the ad accounts that the owner has
access to, so the owner can select which one to connect to Sales Boost.
We do not change any business settings, users, permissions or assets.

VALUE FOR THE USER AND WHY IT IS NECESSARY
Without this permission, owners whose ad account belongs to a Business
portfolio cannot find and select their ad account, so they cannot see
their ad results in Sales Boost.

HOW TO TEST
1. Go to https://getsaleboost.com/login and sign in with:
   Email: [EMAIL]   Password: [SENHA]
2. Open "Configurações" (Settings) > "Conexões" (Connections) and, in the
   "Meta Ads Manager" card, click "Conectar" (Connect). Log in with
   Facebook. The list of ad accounts
   from your Business portfolio is shown so you can select one.
3. Open "Marketing AI" > "Agente de Conteúdo e Campanha" > tab
   "Campanha" (Campaign) > "Performance" to see the selected ad
   account's results.
```

**O vídeo de anúncios deve mostrar:** Configurações → Conexões →
cartão "Meta Ads Manager" → Conectar → login do Facebook → lista de contas de anúncio →
escolher → Marketing AI → Agente de Conteúdo e Campanha → Campanha →
Performance com os números. A conta precisa ter pelo menos
um anúncio com resultado, senão a aba aparece vazia.

### 7. `public_profile`

Em português: é a permissão básica de todo login pelo Facebook (nome e ID
de quem entrou). No Sales Boost o login pelo Facebook só aparece quando o
dono conecta contas da Meta em Configurações → Conexões (por exemplo, o
cartão "Meta Ads Manager"). O login no site do Sales Boost é por e-mail e
senha, não pelo Facebook. Normalmente o formulário só pede para aceitar
as políticas; se aparecer uma caixa de descrição, colar:

```text
HOW WE USE public_profile
public_profile is used only when the business owner connects a Meta
business asset to Sales Boost with Facebook Login, in "Configurações"
(Settings) > "Conexões" (Connections). We read the person's name and ID
only to show which Facebook account made the connection and to keep
that connection linked to the correct Sales Boost company. We do not
post, message or show this information to anyone else. Sign-in to Sales
Boost itself uses email and password, not Facebook Login.
```

## Vídeos (screencast)

A Meta quer **um vídeo por permissão** (ou um vídeo único que mostre
todas, com legenda dizendo qual está sendo mostrada). Dicas:

- Gravar a tela do computador (ex.: Win + G no Windows, ou o gravador do
  Chrome/Loom). 1 a 3 minutos cada.
- O painel é em português: **colocar legendas em inglês** (ou narrar em
  inglês) explicando cada clique. Sem isso, o revisor pode não entender.
- Mostrar o login no Sales Boost **e** a tela de login/permissão do
  Instagram (o revisor quer ver o consentimento).

**Roteiro sugerido (um vídeo que cobre tudo, com legendas):**

1. Abrir `getsaleboost.com/login` e entrar com a conta do revisor.
   Legenda: *"Business owner logs in to Sales Boost."*
2. Configurações → Conexões → **Conectar Instagram**. Mostrar a tela do
   Instagram pedindo as permissões e clicar em permitir.
   Legenda: *"Owner connects their Instagram professional account and
   grants permissions."*
3. Voltar ao painel e mostrar o @ conectado e os posts.
   Legenda: *"instagram_business_basic: profile and posts shown in the
   dashboard."*
4. Abrir um rascunho de post em **Aprovações** → clicar **Aprovar** →
   abrir o Instagram e mostrar o post publicado.
   Legenda: *"instagram_business_content_publish: published only after
   the owner clicks Approve."*
5. Com outra conta, comentar "qual o valor?" num post. Mostrar o
   comentário aparecendo no Sales Boost com a resposta sugerida → aprovar
   → mostrar a resposta privada chegando na DM de quem comentou.
   Legenda: *"instagram_business_manage_comments and
   instagram_business_manage_messages: comment detected, reply sent only
   after approval."*
6. Mandar uma DM para a conta → mostrar o lead em Marketing AI →
   **Agente de Conversão** (Funil de Vendas).
   Legenda: *"Incoming DM saved as a lead in the sales pipeline."*
7. Abrir Marketing AI → **Agente de Dados** → aba **Performance** e
   mostrar alcance e curtidas.
   Legenda: *"instagram_business_manage_insights: post performance shown
   to the owner."*
8. Configurações → Conexões → **Desconectar**.
   Legenda: *"Owner can disconnect at any time; the token is deleted."*

**Antes de gravar, conferir que cada passo funciona** no site com a conta
de teste. Se algum passo der erro, não gravar: avisar o agente para
corrigir antes (a Meta reprova vídeo que mostra erro).

## Instruções para o revisor (campo "Instructions for reviewers")

> 1. Go to https://getsaleboost.com/login and sign in with the test
>    credentials provided in this form.
> 2. Go to Settings (Configurações) → Connections (Conexões) → "Conectar
>    Instagram" and log in with an Instagram professional account.
> 3. Posts appear in the dashboard. Drafts are in "Aprovações"
>    (Approvals); click "Aprovar" (Approve) to publish.
> 4. Comments with purchase interest appear in Approvals with a suggested
>    reply; DMs appear as leads in Marketing AI → "Agente de Conversão"
>    (Sales Pipeline).
> 5. Post insights are in Marketing AI → "Agente de Dados" → Performance.
> The interface is in Portuguese; the screencast has English captions.

Usuário e senha da conta do revisor vão **nos campos próprios do
formulário da Meta**, nunca neste doc nem no chat.

## Depois de enviar

- A Meta costuma responder em alguns dias. Se reprovar, a resposta diz
  qual permissão e por quê: trazer o texto da reprovação para o agente
  ajustar (texto, vídeo ou código).
- Aprovado: atualizar [INSTAGRAM.md](INSTAGRAM.md) (fim da limitação de
  testadores) e o [ROADMAP.md](ROADMAP.md).

## Pendências de código antes do envio

- Seção "Como excluir seus dados" na política de privacidade
  (`src/pages/legal/legalContent.ts`), com passo a passo: desconectar o
  Instagram em Configurações → Conexões e pedir a exclusão da conta pelo
  e-mail de privacidade. Mudança só de texto.
- Conferir no site, com a conta do revisor, cada passo do roteiro acima
  (principalmente o passo 5: resposta privada a comentário).
- **Texto da tela que contradiz o pedido:** depois de conectar, Configurações
  → Conexões mostra "✓ Instagram conectado! O agente já pode publicar
  automaticamente." (`IntegrationsTab.tsx`, linha ~544). Isso aparece no
  vídeo e contradiz "nada é publicado sem aprovação". Trocar por algo como
  "✓ Instagram conectado! Os posts só vão ao ar depois que você aprovar."
  antes de gravar.
- Conferir no site o caminho da tela de anúncios (Marketing AI → Agente de
  Conteúdo e Campanha → Campanha → Performance) antes de gravar.
