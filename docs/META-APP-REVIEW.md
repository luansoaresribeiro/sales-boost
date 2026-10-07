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

## Permissões a pedir (as 5 do Instagram + 2 de anúncios)

Lista final do formulário: as 7 abaixo + `public_profile`. Excluir todas
as outras (Human Agent, Marketing API Access Tier, WhatsApp, `pages_*`,
`instagram_basic`, `instagram_manage_comments`, `ads_management`,
`ads_mcp_management`, `leads_retrieval`, `catalog_management`,
`manage_fundraisers`).

Para cada uma, a Meta pede: (1) texto de uso, (2) vídeo mostrando o uso,
(3) aceitar as políticas. Os textos abaixo são para colar no campo
"How will your app use this permission?".

### 1. `instagram_business_basic`

O que faz no Sales Boost: ler o @, nome, foto e lista de posts da conta
conectada, para mostrar no painel e montar a estratégia.

> Sales Boost is a marketing assistant for real estate agents and
> agencies. After the business owner connects their Instagram
> professional account, we read the account's basic profile (username,
> name, profile picture) and its list of media so the owner can see
> their own posts inside the Sales Boost dashboard and so our system can
> plan their content strategy. We only access the account the owner
> connected, and the owner can disconnect at any time in Settings →
> Connections, which deletes the stored access token.

### 2. `instagram_business_content_publish`

O que faz: publicar post ou carrossel **só depois que o dono aprova**
(regra 1 do produto). Código: `publish-instagram`, `agent-actions`.

> Sales Boost drafts posts and carousels for the business owner (photos
> of real properties uploaded by the owner, plus captions). Nothing is
> published automatically: every post appears in the "Approvals" screen
> and is only published to the owner's Instagram account after the owner
> explicitly clicks "Approve". We use this permission solely to publish
> the content the owner approved, on the account the owner connected.

### 3. `instagram_business_manage_comments`

O que faz: receber os comentários dos posts do dono (webhook), entender
se é interesse em imóvel e sugerir uma resposta, que vai para aprovação.
Código: `instagram-webhook`.

> We receive comments on the owner's own posts through webhooks so the
> owner can see in the Sales Boost dashboard which comments show buying
> or renting interest (for example, "what is the price?"). For each such
> comment we suggest a reply. The reply is sent only after the owner
> approves it in the "Approvals" screen, or when the owner has explicitly
> turned on an automatic rule they configured themselves.

### 4. `instagram_business_manage_messages`

O que faz: receber as DMs como leads no Funil de Vendas e responder em
privado a um comentário, com aprovação do dono. Código:
`instagram-webhook` (lead_messages, envio para `/{ig-id}/messages`).

> When a person sends a direct message to the owner's business account,
> or comments with purchase interest, Sales Boost records the
> conversation as a lead in the owner's sales pipeline so they do not
> miss potential buyers. The owner can send a private reply to an
> interested commenter; replies are only sent after the owner approves
> them (or under an automatic rule the owner configured and can turn off
> at any time). We never message people who did not contact the
> business first.

### 5. `instagram_business_manage_insights`

O que faz: ler alcance, curtidas, comentários e salvamentos dos posts
para a aba Performance e para o aprendizado (o que funcionou). Código:
`instagram-performance`, `insights-collect`.

> We read insights (reach, impressions, likes, comments, saves) for the
> owner's own posts to show performance reports in the Sales Boost
> dashboard and to learn which content works best, so future content
> suggestions improve. Insights are shown only to the owner of the
> connected account.

### 6. `ads_read` e 7. `business_management` (anúncios, só leitura)

Pedidas no mesmo envio por decisão do dono (2026-10-07). Hoje o Sales
Boost só **lê** resultados de anúncios do cliente (gasto, alcance,
cliques) na aba Meta Ads. Não cria nem edita anúncios. Código:
`meta-ads-oauth-start` (scopes `ads_read`, `business_management`),
`meta-ads-insights`, `MetaAdsTab.tsx`. Pedir `ads_management`,
`pages_manage_ads` ou "Marketing API Access Tier" só quando existir a
função de criar anúncios (senão a Meta reprova). O vídeo precisa mostrar:
Configurações → Conexões → "Conectar Meta Ads" → login do Facebook →
escolher a conta de anúncios → aba Meta Ads com os números.

`ads_read`:

> Business owners connect their Meta ad account to Sales Boost so they
> can see their ad results (spend, reach, impressions, clicks, cost per
> result) next to their organic Instagram results in one dashboard. We
> only read insights of the ad accounts the owner chose to connect. We
> do not create, edit or pause ads.

`business_management`:

> Many business owners manage their ad account inside a Meta Business
> portfolio. We use business_management only to list the ad accounts the
> owner has access to, so the owner can pick which one to connect to
> Sales Boost. We do not change any business settings, users or assets.

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
