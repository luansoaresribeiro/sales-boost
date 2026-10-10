# Sales Boost — Decisões

> Cada decisão com data e motivo. Quando o código real divergir de uma
> decisão aqui, registrar a divergência no doc técnico correspondente
> ([ARCHITECTURE.md](ARCHITECTURE.md),
> [CONTENT-INTELLIGENCE.md](CONTENT-INTELLIGENCE.md) etc.) em vez de
> apagar a decisão daqui.

- **Setor piloto: imóveis, Rio de Janeiro** — ICP corretor autônomo/
  imobiliária pequena. Motivo: mercado concentrado, decisor único, ticket
  que justifica o setup, e já existia relação (Liga dos Sonhos como
  cliente real adjacente).
- **Só Instagram por enquanto** — WhatsApp/E-mail ficam pra depois (ver
  Fase 4 em [ROADMAP.md](ROADMAP.md)). Motivo: foco — um canal bem feito
  antes de espalhar.
- **Fichas de setor como dado (`vertical_playbooks`), nunca código
  específico de setor** — 2026-09-29. Motivo: qualquer setor novo (de
  imóveis pra procedimento estético, por exemplo) precisa ser só uma ficha
  nova, nunca um sistema novo. Teste de sanidade registrado em
  [PRODUCT.md](PRODUCT.md).
- **O corretor responde o onboarding** (faixa de preço, bairros, cliente
  típico, CRECI) — pular pergunta usa padrão médio, nunca trava o fluxo.
- **Único provedor de criativos: Higgsfield** — 2026-10-01. Motivo:
  cobre image-to-video, text-to-video e speech-to-video numa API só; fica
  atrás de um roteador pra trocar/somar provedor sem refazer o resto do
  pipeline.
- **Criativos sempre a partir de fotos reais do cliente + brief da
  estratégia** — nunca o Higgsfield decide sozinho o que criar; o Content
  Agent sempre escreve o brief antes.
- **Tour virtual como carrossel de vídeos** (não um vídeo montado único,
  salvo se a API permitir como opção) — mais simples de publicar com o
  publicador de carrossel que já existe.
- **Avatar e voz do corretor ficam pra depois** — não fazer agora (ver
  Futuro em [MEDIA-ENGINE.md](MEDIA-ENGINE.md)).
- **Foto do imóvel é sempre real** — regra inviolável (ver CLAUDE.md).
  Nunca a IA desenha o item de verdade; imagem gerada por IA só pra
  cena de bairro/marca.
- **Estratégia automática com tese estável** — 2026-09-30. Reavaliação
  semanal pode AJUSTAR o plano tático (`refresh`), mas a tese só muda
  (`generate`, estratégia nova) em PIVOT/TERMINATE real ou pedido
  explícito do dono. Motivo: evitar que o produto fique "mudando de
  ideia" toda semana — a tese precisa de tempo pra provar se funciona.
- **Liga dos Sonhos fora do automático** — `companies.auto_strategy =
  false` pra essa empresa até o dono decidir ligar. Motivo: é cliente real
  em produção, qualquer automação nova entra com cautela extra ali.
- **@getsaleboost usado em testes, só com conteúdo real sobre o próprio
  Sales Boost** — 2026-10-01. Contexto: a conta oficial pública do Sales
  Boost foi conectada por acidente numa empresa de teste durante a
  investigação de um bug de domínio; o agente de desenvolvimento
  desconectou automaticamente (seguindo a regra geral "desconecte se não
  for conta de teste"), o que gerou confusão quando o dono reconectou de
  propósito pra testar o carrossel. **Decisão:** usar @getsaleboost é
  aprovado para teste, mas só com conteúdo verdadeiro sobre o próprio
  Sales Boost (nunca um imóvel fictício) — e o agente não deve desconectar
  essa conta sozinho enquanto esse uso estiver em andamento.
- **Calendário semanal** como unidade de planejamento (dono aprova 1x/
  semana), não diário nem mensal.
- **Deploy sempre confirmado** — depois de mudar telas, publicar o site
  (`npm run build && npx wrangler deploy`) e confirmar "Site publicado em
  getsaleboost.com ✅" no relatório. Regra inviolável (ver CLAUDE.md).
- **Alterações arriscadas exigem aprovação prévia do dono** — lista
  completa em CLAUDE.md. Nenhum agente pula essa parada pra "economizar
  tempo".
- **Modo autônomo pausado; trabalho por etapas comandadas pelo dono** —
  2026-10-06. A rodada seg/qua/sex foi desligada automaticamente em
  05/10 (`auto_disabled_org_disabled`: a organização não permitiu a rotina
  com o conector Supabase) e o relatório de sexta foi desligado a pedido do
  dono. Daqui em diante o dono escolhe qual etapa do
  [ROADMAP.md](ROADMAP.md) seguir e a sessão executa (product → engineer →
  qa), um PR por assunto. As regras de segurança do modo autônomo continuam
  valendo pra qualquer agente. **Isto suspende** o item abaixo; as rotinas
  ficam guardadas (desligadas) pra religar se o dono quiser.
- **Agentes de desenvolvimento trabalham sozinhos, mas nunca publicam** —
  2026-10-02. O dono pediu que `product` → `engineer` → `qa` evoluam o
  projeto sem precisar de prompt. Princípio: **autonomia pra trabalhar ≠
  autonomia pra publicar.** Rotina automática seg/qua/sex de manhã (1
  tarefa por rodada) + relatório semanal sexta 18h. O agente só abre PR;
  merge (e o deploy que vem com ele) é sempre do dono. Se não houver
  tarefa claramente segura e bem definida, o agente não inventa trabalho
  — não faz nada e diz isso no relatório. Regras operacionais completas
  em [ORCHESTRATION.md](ORCHESTRATION.md#modo-autônomo-rotina-agendada).
  **Isto substitui** a regra anterior "agentes não rodam sozinhos até o
  P4 existir" — o P4 passa a ser construído junto (ver
  [ROADMAP.md](ROADMAP.md#p4--infra-de-autonomia)). Banco de ensaio:
  segundo projeto grátis do Supabase (`salesboost-ensaio`), não o recurso
  pago de cópia — reavaliar depois que o fluxo provar que funciona.
- **Teste grátis de 7 dias + plano único de R$1.449/mês** — 2026-10-02
  (**SUBSTITUÍDA em 2026-10-06 pelo modelo de acesso grátis + preço novo,
  ver entrada "Preço e acesso grátis" no fim deste arquivo — mantida aqui
  como histórico; o código ainda reflete esta até a nova ser construída**),
  decisão do dono. Substitui o teste de 3 dias (`TRIAL_DAYS = 3` em
  `src/lib/trialState.ts`) e as faixas R$197–697 de
  [PRODUCT.md](PRODUCT.md). Público-alvo por agora: corretores e
  imobiliárias. No teste, 1 vídeo real (o único que chama a API de vídeo);
  os demais aparecem como prévias travadas, sem custo de API. Detalhes em
  [PRODUCT.md](PRODUCT.md#modelo-de-cobrança--decidido-2026-10-02). Motivo:
  o cliente precisa ver a inteligência real e uma prova de execução, não
  uma demo limitada; o preço posiciona como departamento de crescimento,
  não como créditos de IA. Ordem de construção: (1) testar Higgsfield com
  fotos reais, (2) teste de 7 dias, (3) fluxo do vídeo + prévias, (4)
  relatório e tela de assinatura.
  **Status do passo 2 (tela, 2026-10-02):** `src/lib/trialState.ts` agora
  deriva o total de dias de `trial_started_at`/`trial_expires_at`
  (`TRIAL_DAYS = 7` só como padrão); estados `trial_day_1/2/3` viraram
  `trial_active` e `TrialInfo` ganhou `totalDays`. Trials antigos de 3
  dias seguem mostrando "Dia X de 3". **Divergência conhecida:** a edge
  function `claim-diagnostic` ainda grava 3 dias ao criar trial novo até
  ser deployada com a mudança (precisa de aprovação do dono); o worker
  `vendas-bot` e o preço (`PLAN_PRICE` em `TrialSummaryPage`, passo 4) não
  foram tocados.
- **PR aprovado libera o agente a alterar o banco real** — 2026-10-02,
  pedido do dono. A aprovação do PR (merge feito pelo dono) **é** a
  aprovação da mudança no banco de produção (`miwcxakzyforbahpnpst`) que
  está nele. Depois do merge, o agente aplica em produção exatamente o
  SQL do PR — nada além. Antes disso, nunca. Condições e passo a passo em
  [ORCHESTRATION.md](ORCHESTRATION.md#banco-de-produção-depois-do-pr-aprovado).
  Motivo: o dono não é desenvolvedor e não deveria ter que rodar SQL à
  mão; a revisão dele acontece no PR. **Isto ajusta** a regra anterior
  "mudança de estrutura fica marcada 'precisa de você' pro dono aplicar
  em produção".
- **7-Day Growth Preview, passo 3 (vídeo grátis) — gatilho provisório e
  trava** — 2026-10-02. Parte A (só tela + tabela): "Seu vídeo grátis — em
  breve" e até 3 prévias borradas/travadas no resumo do trial, sem chamar
  nenhuma API de vídeo. A prévia **não cita preço** ("Disponível no plano
  completo") até o passo 4, pra não conflitar com o preço antigo
  (R$14,49) ainda na tela. O gatilho de quando o vídeo grátis é gerado é
  **provisório** (a definir na Parte B). A trava de 1 vídeo por teste vive
  na tabela `trial_video_claims` (unique por empresa; só service role
  escreve). Motivo: garantir 1 vídeo por teste sem gastar à toa.

- **/setup obrigatório no fim do cadastro (contas novas sem assinatura)** —
  2026-10-06, plano aprovado pelo dono. Contas criadas a partir de
  `SETUP_GATE_FROM` (2026-10-06, `src/lib/setupGate.ts`) e sem
  `stripe_subscription_id` só entram no painel depois de: (1) dados do
  negócio (nome, cidade, telefone), (2) todas as perguntas da ficha
  (`onboarding_questions`) e (3) o mínimo de itens do catálogo com o mínimo
  de fotos reais (mesma regra do sino de pendências). Instagram vem em
  destaque, mas **opcional** ("Conectar depois") até o App Review da Meta
  sair; vira obrigatório ligando `vertical_playbooks.config.setup.
  instagram_required = true` (padrão `{ instagram_required: false,
  min_items: 1 }`; a ficha no banco NÃO foi alterada, só lida com padrão).
  O onboarding anônimo (antes da conta) continua opcional/pulável: isto
  muda só o **pós-cadastro**. As 4 empresas de produção são anteriores à
  data, então nenhum cliente atual é trancado. Se der erro ao calcular o
  status, o gate deixa passar (falha aberta). Motivo: sem dado real o
  sistema não decide bem; melhor pedir tudo uma vez, no começo.
- **Preço e acesso grátis (DECIDIDA 2026-10-06, AINDA NÃO IMPLEMENTADA)** —
  substitui o "teste grátis de 7 dias" de 2026-10-02. Em vez de prazo em
  dias: **diagnóstico grátis (Growth Score)** + **acesso grátis sem prazo
  de dias, limitado a 1 vídeo + 1 estratégia**; depois disso a conta grátis
  não gasta mais IA até pagar. Preços: mensal sem fidelidade **R$2.449/mês**;
  cupom de 1º mês **R$1.449** (depois R$2.449); anual **R$1.449/mês**. O
  cupom tem **prazo REAL de 7 dias a partir da entrega da estratégia** —
  vencido, o desconto sai de fato (prazo falso é proibido). O preço de
  referência R$2.449 é real (existe o plano mensal), então "de R$2.449 por
  R$1.449" é honesto. Pendência: a Stripe ainda precisa dos 3 itens (preço
  mensal, preço anual, cupom) — criar exige aprovação do dono. Próxima
  etapa do [ROADMAP.md](ROADMAP.md) (Growth Qualification).
  **Ajuste 2026-10-08:** o acesso grátis passou a ser diagnóstico + 1
  vídeo, SEM estratégia (só após pagar) — ver entrada de 2026-10-08.

## 2026-10-07 — Growth Score centrado no Instagram, acesso grátis e preço anual

- **(a) Growth Score centrado no Instagram (fatia 1 da etapa 2b,
  implementada em código, ainda não publicada).** A nota vem do Instagram
  coletado por scraper (Apify, actor `apify/instagram-profile-scraper`).
  Site (PageSpeed) e Google são **adendo**: se existirem somam, se não
  existirem ficam "não avaliado" e **não penalizam** (muitos corretores não
  têm site nem Google). Regra 5: critério sem dado = "não avaliado" e sai
  da conta. Pesos: frequência de posts 25 (0 posts=0, 8 ou mais=cheio),
  engajamento 25 (0%=0, 3% ou mais=cheio), formato vídeo/Reels 15 (0=0, 50%
  ou mais=cheio), perfil pronto pra vender 15, adendo site+Google 10, dados
  preenchidos 10 (só depois do cadastro). Nota = pontos avaliados ÷ pesos
  avaliados × 100. Faixas: 70+ Growth Ready, 40–69 Growth Potential, abaixo
  de 40 Growth Blocked; cobertura abaixo de 40% ou Instagram não avaliado =
  "Análise parcial", sem veredito. **Nunca projetar ganho** (nada de "você
  pode vender X% mais"). Código: `src/lib/growthScore.ts` (função pura),
  coleta em `supabase/functions/run-diagnosis`, coluna nova
  `diagnostics.instagram_data` (migration escrita, não aplicada).
- **(b) Diagnóstico exige Instagram; site é opcional.** O formulário do
  onboarding e o `run-diagnosis` pedem o Instagram (@ ou link). PageSpeed só
  roda se houver site. Proteção de custo: 1 coleta por perfil a cada 24h
  (reusa a anterior) e no máximo 3 diagnósticos por e-mail por dia.
- **(c) Plano anual: R$1.449/mês com fidelidade de 12 meses.** Cancelar
  antes do fim = multa de 30% das mensalidades restantes. A cláusula precisa
  aparecer clara no checkout. **Validar com advogado (CDC) antes de
  cobrar.**
- **(d) Cupom: o prazo de 7 dias conta de quando o cliente VÊ o popup do
  cupom**, não da entrega da estratégia — assim o desconto não vence antes
  de o cliente vê-lo se o vídeo atrasar. Ajusta a entrada de 2026-10-06 (que
  dizia "a partir da entrega da estratégia"); a anterior fica como
  histórico. O prazo continua REAL: vencido, o desconto sai de verdade.
- **(e) Promessa pública por enquanto: "diagnóstico grátis + 1
  estratégia".** "+1 vídeo" só entra no texto quando a geração de vídeo
  existir (fatia 5).
  **Ajuste 2026-10-08:** a promessa passa a ser "diagnóstico grátis + 1
  vídeo"; estratégia só após pagar (ver entrada de 2026-10-08).

**Divergências registradas nesta data:** `TrialStartModal` ainda mostra
"R$14,49" (preço errado no ar; sai na fatia 2). `claim-diagnostic` no
repositório grava trial de **7 dias** (`SignupPage.tsx`, linhas ~104-108)
enquanto parte dos docs diz 3 — conferir o que está deployado. A tela do
diagnóstico já diz "Sem prazo em dias" (decisão nova), mas o cadastro ainda
dá o teste de 7 dias até a fatia 2. O cadastro não pede cartão
(confirmado: `SignupPage` não tem pagamento).

## 2026-10-07 — Coleta do Instagram: sempre Apify com teto grátis

- **Decisão do dono: o diagnóstico usa SEMPRE a Apify, com teto mensal
  dentro do crédito grátis do plano.** Ao bater o teto, os critérios do
  Instagram aparecem como "não avaliado" (sem cobrança extra). Não trocar
  pela Business Discovery da API oficial, mesmo depois do App Review.
  O valor do teto depende do crédito grátis e do uso atual da conta Apify
  (dono vai informar). Não chutar número.
- **Motivo:** custo zero garantido sem depender da Meta. Teste de
  2026-10-07 no Graph API Explorer: a Página "Sales Boost Company" está
  ligada ao @getsaleboost (IG id `17841442836358659`) e o app lê a própria
  conta, mas `business_discovery` de outros perfis volta erro #10 (exige
  App Review).
- **App Review continua necessário** para clientes conectarem o Instagram
  no painel. Material em [META-APP-REVIEW.md](META-APP-REVIEW.md). Pedir
  só as 5 permissões `instagram_business_*` que o código usa.

## 2026-10-07 — Itens do Stripe criados no SANDBOX (modo de teste)

Conta disponível para o agente: só "Luan sandbox" (`acct_1TaTYGDHopb5YvZ5`,
modo de teste, sem dinheiro real). Criados lá:

- Produto `prod_VOnjWp0Zharpbn` "Sales Boost".
- Preço mensal sem fidelidade: `price_1UO08QDHopb5YvZ5zLcqUoJh`, R$2.449/mês,
  lookup_key `sb_monthly`.
- Preço anual com fidelidade (cobrança mensal): `price_1UO08TDHopb5YvZ572CUgxmd`,
  R$1.449/mês, lookup_key `sb_annual_commit`, metadata
  `commitment_months=12`, `early_termination_pct=30`. A fidelidade e a
  multa NÃO são feitas pelo Stripe sozinho: precisam de código nosso.
- Cupom `SB_PRIMEIRO_MES`: R$1.000 de desconto, uma vez, só nesse produto,
  sem data de validade no Stripe (o prazo de 7 dias por cliente é
  conferido no servidor antes de aplicar).

**Produção (modo real):** a conta real do Stripe ainda não está conectada
ao agente. Os mesmos itens precisam ser criados lá (pelo dono ou depois que
ele der acesso), e os IDs reais vão para os secrets do Supabase.
Usar `lookup_key` no código para não depender do ID.

## 2026-10-07 — Fim do cartão "Instagram Auto-post" (aprovado pelo dono)

Configurações → Conexões mostrava "Instagram Auto-post" com botão
Ativo/Pausado e frequência (diário/3x/semanal), prometendo publicar
sozinho todo dia às 10h. A tela não batia com o código: o único leitor
de `instagram_auto_post`/`instagram_post_frequency` é a function
`publish-instagram`, deprecada e sem chamador. Também contradizia a
regra 1 (nada vai ao ar sem aprovação) e apareceria no vídeo do App
Review. O cartão virou "Instagram · Publicação com aprovação": conectar,
reconectar, desconectar e texto dizendo que os posts só vão ao ar depois
de aprovados em Aprovações. As colunas continuam no banco (sem
migration). WhatsApp: o dono pediu para não mexer agora (o texto ainda diz
que o agente responde sozinho).

## 2026-10-07 — Teto mensal da Apify no diagnóstico (opção A do dono)

`run-diagnosis` conta as leituras pagas do Instagram no mês (cada uma
grava `apify_run` em `diagnostics.instagram_data`; cópias do cache de 24h
não contam 2x). Teto padrão **50 por mês** (sugestão aceita pelo dono ao
escolher a opção A; ajustável pelo secret `APIFY_IG_MONTHLY_CAP` sem novo
deploy). Bateu o teto: `instagram_data = {error:'monthly_cap'}` e o Growth
Score mostra o Instagram como "não avaliado". A função continua aceitando
o formulário antigo (só site, sem Instagram) para não quebrar nada entre o
deploy da função e o merge da tela nova. Ensaio não tem `APIFY_TOKEN`: lá
a leitura sempre volta "unavailable" (testado); a leitura real só é
testável em produção.
## 2026-10-08 — Landing vira diagnóstico inline; grátis = diagnóstico + 1 vídeo; estratégia só após pagar

- **Landing:** todos os botões de "7 dias grátis" viram **"Diagnóstico
  grátis"** (EN: "Free diagnosis") e rolam suavemente até a nova seção final
  `#diagnostico` (antes do rodapé): "Descubra seu Real Estate Growth Score"
  + botão "Começar diagnóstico grátis". As perguntas abrem **ali mesmo**
  (sem trocar de página) e o resultado também aparece inline. O modal
  "Seus 7 dias grátis começam agora" (`TrialModal`) e todos os textos de
  "7 dias grátis" da landing (PT e EN) foram removidos. As rotas
  `/onboarding` e `/diagnostico/:id` continuam (links compartilháveis),
  usando os mesmos componentes (`DiagnosticFlow`, `DiagnosticResult`).
- **O que é grátis:** o resultado do diagnóstico + a geração de **1
  vídeo**. A **estratégia só é feita depois que a pessoa PAGA** o plano.
  Ajusta as entradas de 2026-10-06 ("1 vídeo + 1 estratégia") e 2026-10-07
  (item e: "diagnóstico grátis + 1 estratégia"), que ficam como histórico:
  onde dizem "1 estratégia grátis", vale esta entrada.
- **Resultado do diagnóstico:** CTA "Criar conta e receber meu vídeo grátis"
  (vai pra `/signup?claim=<id>`) com texto honesto: o vídeo grátis está
  "em liberação — avisamos quando estiver pronto" (a geração de vídeo ainda
  não existe; sem prazo prometido). Sem menção a "1 estratégia grátis".
- **Servidor (escrito, NÃO deployado):** `claim-diagnostic` parou de
  disparar `strategy-generate` para empresas novas. Precisa de deploy
  aprovado pelo dono (function de cliente real). O `stripe-webhook` (PR do
  pagamento) deve disparar a 1ª estratégia ao confirmar o pagamento — até
  lá, conta nova não ganha estratégia sozinha.
  **Atualização 2026-10-08 (tarde):** deploy aprovado pelo dono ("pode
  seguir com 1 e 2") e feito em produção — `claim-diagnostic` v77.

## 2026-10-08 — Resultado do diagnóstico com foco em POTENCIAL

- Pedido do dono: mostrar os principais problemas, "mas principalmente o
  potencial". Sem custo (nenhuma IA nem API nova).
- Bloco **"Seu potencial"** logo abaixo da nota: "hoje 42 → pode chegar a
  88". O número sai da MESMA fórmula da nota (`growthScore.topGaps` +
  `potentialScore`): é a nota se os gargalos listados ficarem cheios —
  nunca número de mercado/vendas (regra 5). Em "Análise parcial" não há
  número, só a frase.
- **Até 3 problemas** (antes 1 gargalo + 1 oportunidade): critérios do
  Instagram avaliados e incompletos, do mais fraco pro mais forte, cada um
  com "O problema", "Como destravar" e "+N pts". Textos genéricos fixos
  (regra 6). `biggestGap` continua existindo (= 1º de `topGaps`).

## 2026-10-08 — Volume de vídeo, teto do grátis e fotos do entorno

Decisões do dono (conversa de 2026-10-08):

- **Plano pago = 12 vídeos/mês, sempre** (Higgsfield). A estratégia
  ESPALHA esses 12 pelas semanas (com reserva no fim do mês) pra o crédito
  não acabar no meio do mês. O volume extra vem de **fotos e criativos
  estáticos** (custo de centavos), na quantidade que a estratégia pedir.
- **Passar dos 12 só com aprovação do CLIENTE**, como investimento extra
  (pacote pago — preço a definir quando o Stripe real estiver ativo). A
  oferta só aparece com **dado real do próprio cliente** (ex.: Reels dele
  com mais alcance que as fotos), depois de ~4 semanas e ~6 vídeos
  publicados. Nunca automático (regra 7) nem com número inventado
  (regra 5).
- **Vídeos grátis do diagnóstico: teto de 30/mês** (≈ US$ 10), separado
  dos 12 dos pagantes. Passou do teto: "seu vídeo entra na fila do
  próximo mês — ou ative o plano e receba agora".
- **Fotos do entorno do imóvel (posts de bairro)** — direção aprovada,
  construir DEPOIS do vídeo grátis + popup do cupom:
  1. Pelo endereço do imóvel, **OpenStreetMap** (grátis) acha o que está
     perto com **distância real** (praia, metrô, escola, shopping...). Os
     tipos de lugar ficam na ficha (`vertical_playbooks`, regra 6).
  2. Foto do lugar vem da **Wikimedia Commons**, só fotos com localização
     marcada perto do ponto e licença livre (CC0, domínio público, CC BY),
     com crédito do fotógrafo na legenda.
  3. Post de bairro é **FOTO, não vídeo** (não gasta os 12 vídeos). São
     poucos por mês — quantos, a estratégia decide.
  4. Corretor **escolhe/recusa** a foto sugerida (nada vai ao ar sem
     aprovação) e **pode subir fotos próprias do bairro** (opcional).
  5. **Proibido:** IA de imagem/vídeo gerar o lugar do zero (seria lugar
     falso em anúncio de imóvel) e usar Google Earth/Street View/fotos do
     Google Maps (termos do Google proíbem).


## 2026-10-08 — Pagamento (fatia 4): como foi implementado

- **Planos no código:** `create-checkout` recebe `{ plan: 'monthly' | 'annual_commit' }`
  (o contrato antigo `basic/pro/ultra` e a região `us` foram removidos; só a
  `TrialSummaryPage` chamava). O preço é buscado no Stripe pelo `lookup_key`
  (`sb_monthly`, `sb_annual_commit`) — não existem mais `STRIPE_PRICE_*` para
  estes planos. Na coluna `companies.plan` os dois planos gravam `'pro'`
  (plano único com tudo; o resto do app lê `plan !== 'free'`);
  o plano real fica em `companies.billing_plan`.
- **Cupom `SB_PRIMEIRO_MES`:** aplicado no servidor só se plano = mensal,
  `companies.coupon_offer_shown_at` existe e tem no máximo 7 dias, e a
  empresa nunca assinou antes (`billing_plan` nulo — trava contra
  cancelar e reassinar pra repetir o desconto). Nada grava
  `coupon_offer_shown_at` ainda (o popup é a fatia 5): sem popup, não há cupom.
  A tela só mostra a oferta (com o prazo restante real) se a coluna estiver
  dentro dos 7 dias.
- **Fidelidade e multa (anual):** `commitment_end_at` = início da
  assinatura + 12 meses. **Multa = 30% × meses restantes × R$1.449
  (144.900 centavos)**, com meses restantes = meses de calendário
  **arredondados pra cima** entre a data efetiva do fim da assinatura e
  `commitment_end_at` (máx. 12). Calculada no `stripe-webhook` em
  `customer.subscription.updated` (cancelamento agendado: `cancel_at` ou
  `cancel_at_period_end`; se o cliente desfaz, a multa é limpa) e em
  `customer.subscription.deleted`. Gravada em
  `companies.early_termination_fee_cents` e registrada em `access_audit_log`
  (`early_termination_fee_recorded`). Exemplo: fim efetivo 5,2 meses antes
  do fim da fidelidade -> 6 meses -> R$2.608,20.
- **A multa NÃO é cobrada automaticamente.** Cobrar dinheiro depende de
  decisão do dono (e da validação do advogado, CDC). Fica visível no painel
  do Owner (`CompanyDetailPage`: plano, fim da fidelidade e multa devida).
- **Cláusula antes de pagar:** na tela de planos (cartão anual) e no checkout
  do Stripe (`custom_text.submit.message`, em português).
- **Preço falso removido:** sumiu o "R$14,49" da `TrialSummaryPage`, do
  `TrialStartModal`, do modal da landing (`i18n.ts`/`App.tsx`) e do comando
  /preco do `vendas-bot` (código do worker; precisa de deploy próprio).
- **Secrets:** só `STRIPE_SECRET_KEY` (já existe), `STRIPE_WEBHOOK_SECRET`
  (já existe) e `SITE_URL` (opcional). `STRIPE_PRICE_BASIC/PRO/ULTRA` só
  seguem sendo lidos pelo caminho legado do webhook (assinaturas antigas).
- **Divergências:** PRODUCT.md (linhas ~39, 59, 109) ainda cita o plano único
  de R$1.449 de 2026-10-02 — substituído por esta decisão; mantido como
  histórico. Itens do Stripe existem só no sandbox; em produção ainda
  precisam ser criados (com os mesmos `lookup_key` e id de cupom).


## 2026-10-08 — Vídeo grátis vira TOUR VIRTUAL (Kling, Reel único)

Decisões do dono (conversa de 2026-10-08), testadas no ensaio:

- **Modelo: Kling 3.0 Standard via Higgsfield** (`/kling-video/v3.0/std/image-to-video`).
  Teste comparativo: DoP turbo (US$ 0,41/5 s) deixou uma mancha branca;
  Kling (**US$ 0,54 por trecho de 5 s**, medido no painel) saiu limpo, pronto
  em ~3 min.
- **O vídeo é um tour virtual**, não 1 foto animada: o cliente envia fotos
  reais do imóvel **na ordem da visita**; cada foto vira um trecho de 5 s e
  os trechos são **colados num Reel único** de ~30 s (`_shared/mp4concat.ts`,
  sem recodificar — só junta trechos do mesmo modelo/tamanho; se vier
  diferente, recusa em vez de entregar vídeo quebrado). Por isso a tela
  passa todas as fotos pelo mesmo recorte 4:5 antes de enviar.
- **Tour grátis = 6 fotos (~30 s, ~US$ 3,24).** Continua 1 por conta e teto
  de 30/mês. **Correção do custo** da decisão "Volume de vídeo" acima
  (que dizia "≈ US$ 10" pensando em 1 foto por vídeo): 30 tours/mês ≈
  **US$ 97**.
- **Plano pago: 12 tours/mês** (~US$ 39 por cliente), gerados a partir do
  plano de conteúdo semanal (3 por semana). Ainda não construído.
- **Seleção de fotos (pipeline do dono, futuro):** recebe ~50 fotos →
  classifica → agrupa por cômodo → tira duplicadas e ruins → escolhe 6 a 10
  conforme o tamanho do imóvel → cliente aprova ou troca antes de gerar.
  Hoje o cliente escolhe as 6 à mão; no teste a seleção foi feita
  manualmente (6 de 64 fotos).
- **Teste real (ensaio, conta QA, 2026-10-08):** 6 fotos → 6 trechos em
  ~2,5 min → Reel de 30,2 s (1108×828, 25 MB), sem erro de decodificação,
  nenhum cômodo alterado. Fotos do dono ficam só no ensaio (nunca publicar).
- **Formato vertical 9:16** para Reels: decisão adiada (o recorte atual é 4:5).
- Tabela nova `video_tours` (migration `20261008220000`) e bucket `videos`
  (migration `20261008210000`, só mp4, até 50 MB). Aplicadas só no ensaio.


## 2026-10-08 — Tour em modo CAMINHADA (foto de começo + foto de fim)

- Pedido do dono: "parecer que estou andando lá", não fotos se mexendo com
  corte entre elas. Solução: o Kling 3.0 aceita `last_image_url` (doc da
  Higgsfield). Cada trecho começa numa foto e termina na seguinte → 6 fotos
  = **5 caminhadas de 6 s ≈ 30 s**, sem pulo na emenda. Modo novo `walk`
  (padrão); o antigo continua como `per_photo` (ficha:
  `config.free_video.mode`, `walk_prompt`). Pedimos sem som (`sound: off`) —
  o áudio é descartado na colagem.
- **Ressalva honesta (regra 4):** começo e fim de cada trecho são fotos
  reais, mas **o caminho do meio é imaginado pela IA**. Entre cômodos
  vizinhos sai fiel (teste: entrada → sala passou pela porta real); entre
  cômodos que não se tocam a IA inventa passagem (teste: apareceu uma porta
  de madeira vazada entre a suíte e o espaço gourmet que não está nas
  fotos). Por isso a **ordem das fotos** é decisiva.
- **Decisão do dono:** o sistema descobre a melhor ordem sozinho, sempre
  (próxima etapa — ver ROADMAP P3).
- **Bug corrigido no teste:** a colagem de 33 MB estourou a memória da
  função (erro 546) e o tour ficou preso em "montando". `mp4concat` agora
  não copia os quadros (pico medido caiu de ~250 MB pra ~100 MB no teste
  local, com quadros idênticos) e o `status` destrava uma colagem parada há
  mais de 3 min.


## 2026-10-09 — Formatos de conteúdo do setor de imóveis (aprovado pelo dono)

Aprovado:
- **Grátis = "kit amostra":** tour de ~30 s em caminhada (6 fotos) + 2 peças
  paradas feitas com as fotos do próprio cliente (1 criativo bonito + 1 post
  educativo). O popup do cupom diz que isso é o que o plano faz toda semana.
- **Vídeo no plano = 1 tour completo por imóvel + recortes.** O tour usa
  todos os ambientes (sem fotos repetidas), ordem automática aprovada pelo
  corretor. Os recortes (15-30 s) não geram vídeo novo — custo zero — e
  viram Reels e Stories ao longo das semanas.
- **As 7 ideias novas entram todas:** (1) tour como isca na DM ("Comente
  TOUR"), (2) "isso ou aquilo", (3) Stories diários com recortes do tour,
  (4) close de 5 s de um detalhe, (5) cartões-postais do bairro, (6) avatar
  do corretor abrindo o tour, (7) "Vendido!" (prova social).
- Onde cada uma entra na estrutura (ficha, pacote por imóvel, planejador
  da semana, conversa na DM) e a ordem de construção: ver
  [CONTENT-INTELLIGENCE.md](CONTENT-INTELLIGENCE.md) "Mapa de formatos" e
  [ROADMAP.md](ROADMAP.md) P3.
- **Em aberto:** como os "12 vídeos/mês" (decisão de 2026-10-08) se
  traduzem agora que recorte não custa geração — proposta: 12+ Reels
  publicados/mês, com um **teto de custo de geração por cliente em US$**
  (regra 7) no lugar de contar vídeos.


## 2026-10-09 — Etapa 1 do tour do plano: como foi implementado

- **Teto: US$ 40 por cliente por mês** (decisão do dono), somando análise de
  fotos + geração (`video_tours.cost_usd`, `kind = 'plan'`). A geração é
  bloqueada antes de gastar se passar do teto (mensagem diz quanto custa e
  quanto sobra). Preço da passagem é estimado (US$ 0,108/s × 6 s); falta
  confirmar o valor real cobrado pela Higgsfield pelo trecho de 6 s sem som.
- **Ordem automática:** `tour-plan` (`analyze`) manda TODAS as fotos do
  imóvel numa só chamada à IA (Claude Opus 5.5, saída em JSON estruturado):
  ambiente de cada foto, repetidas juntas, foto ruim fora (pessoa, escura,
  só detalhe), melhor foto por ambiente, o que cada ambiente "vê" pelas
  portas e a ordem proposta. O CÓDIGO marca cada passagem como confirmada
  (um ambiente aparece na foto do outro) ou não confirmada. Vocabulário do
  setor na ficha (`config.tour`: tipos de ambiente, zonas, sequência
  típica, máx. 25 ambientes, recortes de 15-30 s) — regra 6.
- **Aprovação do corretor:** botão "🎬 Tour em vídeo" no card do imóvel
  (`ItemTour.tsx`): ordem com fotos, aviso amarelo nas passagens não
  confirmadas (recalcula a cada troca), subir/descer/tirar, devolver
  ambientes que ficaram fora, custo estimado e gasto do mês. Só gera depois
  de "Aprovar e gerar".
- **Recortes:** sequências de 3 a 5 passagens da mesma zona viram vídeos
  separados (custo zero — mesmas passagens).
- **Colagem nova (`_shared/mp4stream.ts` + `tusUpload.ts` + `tourEngine.ts`):**
  substitui o `mp4concat.ts` (mp4box). Lê só a tabela de quadros de cada
  passagem, monta o cabeçalho e envia em pedaços de 6 MB, retomável entre
  chamadas — memória de ~1 passagem por vez, sem limite de tamanho. Testado:
  quadros idênticos aos das passagens originais (comparação quadro a
  quadro), retomada no meio gera arquivo idêntico, colagem na nuvem igual à
  local. O tour grátis usa o mesmo motor.
- **Achados no teste:** (1) a chave de serviço das funções está no formato
  novo e o envio retomável precisa dela no cabeçalho `apikey` também;
  (2) a 1ª colagem (mp4box) "perdia" 1 quadro por emenda — a nova não.
- **Pendente:** a análise das 64 fotos não rodou no ensaio porque falta o
  secret `ANTHROPIC_API_KEY` lá. A conta QA do ensaio está com `plan = 'pro'`
  pra testar o tour do plano (voltar pra `free` pra testar o grátis).


## 2026-10-09 — Sai o tour completo: vídeo vira ISCA (partes do imóvel)

Decisão do dono (substitui "1 tour completo por imóvel + recortes" e o
grátis de 30 s, acima — mantidos como histórico):

- **Corretor não entrega o imóvel de cara.** O vídeo mostra uma PARTE e gera
  vontade, com chamada pra conversa: "Comente QUERO que eu te mando mais na
  DM".
- **Cada vídeo = 1 cômodo, ou no máximo 2 cômodos vizinhos** (caminhada de
  uma foto até a outra). Quem escolhe as fotos é o corretor — **sai a
  análise de ordem por IA** (o código da etapa 1 fica no repositório, sem
  uso, até ser removido ou reaproveitado).
- **Abertura "de fora":** vídeo que começa do lado de fora do prédio/casa já
  mostrando a vista. Só com FOTO REAL da fachada/vista enviada pelo
  corretor (regra 4 — a IA não gera o prédio nem a vista).
- **Grátis = 2 ou 3 vídeos curtos dos melhores cômodos**, cada um já com a
  chamada "Comente QUERO".
- **Resposta na DM:** mensagem pronta montada com os dados CADASTRADOS do
  imóvel no Sales Boost (nunca inventados — regra 5) + convite pra agendar
  visita. Envio pela API oficial do Instagram (resposta privada ao
  comentário): a Meta não cobra por mensagem; limites: 1 mensagem por
  comentário, até 7 dias depois do comentário, 750/hora por conta; depois
  que a pessoa responde, abre a janela de 24 h. Depende da aprovação do app
  na Meta (`instagram_business_manage_messages`, ver META-APP-REVIEW.md).
- **Em aberto:** aprovar cada DM (regra atual) ou aprovar o modelo uma vez
  por post e o envio ser automático.


## 2026-10-09 — "Comente QUERO" automático (opção B) e vídeos curtos: como foi feito

- **Decisão do dono: opção B.** O dono aprova a mensagem do QUERO UMA VEZ
  por imóvel; depois cada "QUERO" num post desse imóvel recebe a DM na hora,
  sem nova aprovação. É uma exceção consciente à regra 1 (a aprovação
  continua existindo, só passa a ser feita antes, sobre o texto fixo). A
  mensagem só tem o texto aprovado — a IA não escreve nada na hora.
- **Como funciona:** `engagement_automations.item_id` (nova coluna) +
  `instagram-webhook` acha o imóvel do post comentado (`posts.item_id` pelo
  `instagram_media_id`) e usa a automação daquele imóvel, que tem
  `execution_mode = 'automatic'` e `allowed_auto_actions = ['send_dm']`
  (mecanismo que já existia). Modelo da mensagem na ficha
  (`config.dm_reply`: palavra QUERO + modelo com {campos}); linha de dado não
  cadastrado some (`_shared/dmReply.ts`). Também cria o lead.
- **Vídeos do imóvel (`item-videos` + `ItemVideos.tsx`):** botão "🎬 Vídeos
  e resposta do QUERO" no card do imóvel: tipo (1 cômodo / 2 cômodos
  vizinhos / abertura de fora), o corretor escolhe a(s) foto(s), custo
  estimado e gasto do mês (teto US$ 40), lista dos vídeos prontos, e a caixa
  da mensagem do QUERO pra revisar/aprovar/desligar.
- **Grátis (`trial-video` + `FreeVideoCard`):** 3 fotos → 3 vídeos curtos.
- **Removido:** `tour-plan`, `_shared/tourPlan.ts`, `ItemTour.tsx` (ordem por
  IA e tour completo) — ficam no histórico do git. A função `tour-plan`
  continua publicada só no ensaio, sem uso.
- **Testado no ensaio (sem gerar vídeo novo — reaproveitando trechos já
  pagos):** grátis com 3 vídeos e vídeo "2 cômodos" do plano, quadros
  idênticos aos trechos originais; QUERO: desligado → nada; ligado +
  comentário com QUERO no post do imóvel → envio automático (falhou só
  porque a conta de teste não tem Instagram conectado, como esperado);
  QUERO em outro post → nada; comentário sem a palavra → nada.
- **Atenção (achado):** o `instagram-webhook` não confere a assinatura da
  Meta (`X-Hub-Signature-256`) — qualquer um que souber o endereço pode
  mandar um comentário falso. Com o envio automático isso pesa mais.
  Correção recomendada (mexe em autenticação → pedir aprovação do dono):
  conferir a assinatura com o segredo do app da Meta.

## 2026-10-09 — Google fica fora do produto (por enquanto)

- **Decisão do dono:** o foco é o digital (Instagram); o que depende do
  Google Cloud sai de cena. Motivo imediato: o projeto Google Cloud
  "SalesBoost" ficou com o faturamento vencido e corre risco de suspensão.
- **Feito:** em Conexões (`settings/IntegrationsTab.tsx`), os cartões
  **Google Search Console** e **Google Business Profile** ficam escondidos
  pela constante `GOOGLE_ENABLED = false` (voltar pra `true` religa). Na
  data, nenhuma empresa em produção tinha conta Google conectada.
- **Diagnóstico grátis:** a nota do site (PageSpeed) funciona **sem chave**
  — o dono disse ter apagado `PAGESPEED_API_KEY` da produção, pra não depender do
  projeto Google suspenso.
- **Continua no código, sem tela que leve até lá:** mapa de concorrentes
  (`map-competitors`), busca do negócio (`find-place`), respostas a
  avaliações Google (`reply-google-review`), métricas GSC. A busca de leads
  do painel do Owner (`find-sales-leads`) usa Google Places e para se o
  projeto for suspenso — só afeta o dono, não clientes.

## 2026-10-09 — Webhook do Instagram confere a assinatura da Meta (aprovado pelo dono)

- `instagram-webhook` confere `X-Hub-Signature-256` (HMAC-SHA256 do corpo)
  com `INSTAGRAM_APP_SECRET` (aceita também `META_APP_SECRET` /
  `FACEBOOK_APP_SECRET`). Fecha o achado acima.
- **Sem assinatura válida o evento NÃO é descartado** (não se perde lead
  real se o segredo estiver trocado): comentário e DM são registrados
  normalmente, mas **nada é enviado sozinho** — a ação vira pedido de
  aprovação (PENDING) e o log mostra "assinatura da Meta ausente ou
  inválida".
- Testado: conta da assinatura comparada com `openssl` (válida → aceita;
  maiúsculas → aceita; falsa/ausente → recusa); no ensaio, comentário QUERO
  sem assinatura e com assinatura falsa → PENDING (antes era envio
  automático).
- **Depois de publicar em produção:** olhar o log no primeiro comentário
  real. Se aparecer o aviso de assinatura inválida em comentário verdadeiro,
  o segredo cadastrado não é o do app que assina — corrigir o secret (o
  QUERO só passa a pedir aprovação; nada quebra).

## 2026-10-09 — Estratégia escolhe os formatos (linha central + mix da semana)

- Pedido do dono: a estratégia precisa ter acesso a todos os formatos de
  conteúdo pra escolher a estratégia central e a semanal.
- Feito: catálogo de formatos (ficha `content_formats` + formatos da
  empresa) entra no prompt da estratégia; ela devolve linha central,
  formatos-âncora e mix semanal (`marketing_ai_strategies.content_plan`),
  validados em código; o Calendário da semana segue o mix. Detalhes em
  [CONTENT-INTELLIGENCE.md](CONTENT-INTELLIGENCE.md).
- Vídeo e pacote do imóvel **não** são gerados sozinhos pelo calendário
  (custam/precisam do imóvel) — aparecem como lista "pra fazer".
- Migration `20261009200000_content_formats.sql` (aplicada no ensaio;
  produção só com aprovação, junto do PR).

## 2026-10-09 — Parte de trás do PR #20 publicada em produção (aprovado pelo dono)

- Banco de produção: `billing_plans`, `videos_bucket`, `video_tours`
  (aplicada sem o `drop policy if exists`, que travava a ferramenta —
  tabela nova, a policy não existia), `item_videos`, `content_formats`.
- Funções publicadas: `create-checkout`, `stripe-webhook`,
  `owner-company-activity`, `trial-video` (nova), `item-videos` (nova),
  `instagram-webhook`, `strategy-generate`, `creative-generate` — mesmo
  `verify_jwt` de antes; todas respondem (teste sem login → 401 do próprio
  código).
- Conferido antes: chave `sk_live` lê os preços reais; cupom
  `SB_PRIMEIRO_MES` existe no Stripe real; chave do Higgsfield aceita.
- Falta: o dono juntar o PR e publicar o site.

## 2026-10-09 — Perfil pessoal x profissional + conta logada não fica mais travada no cadastro

- **Decisão do dono:** o nome da empresa vira opcional. Sem nome, o perfil é
  **pessoal**; com nome, **profissional**. É só um rótulo pra organizar — não
  muda nada no que o produto faz.
- **Como ficou:** `companies.profile_type` (`profissional` padrão |
  `pessoal`, migration `20261010100000_profile_type.sql`). Sem nome, o
  `business_name` vira "Perfil pessoal" (o banco exige um nome). O cadastro
  (`OnboardingPage`) manda `onboarding_context.profile_type`;
  `claim-diagnostic` grava na empresa; `run-diagnosis` aceita nome vazio.
  No `/setup`, apagar o nome volta pra "Perfil pessoal"; escrever um nome
  vira profissional. O painel do Owner mostra o rótulo na lista.
- **Correção junto:** quem já tinha conta (logado, sem empresa) terminava o
  cadastro e o botão mandava criar uma conta NOVA — o diagnóstico não ligava
  à conta e a pessoa ficava travada. Agora o cadastro liga o diagnóstico na
  hora (`claim-diagnostic`) e o botão leva pro `/setup`.
- Testado no ensaio: conta logada, cadastro sem nome → empresa "Perfil
  pessoal", `profile_type=pessoal`, botão final → `/setup`; empresas antigas
  ficaram `profissional`.

## 2026-10-09 — Diagnóstico grátis v2: concorrentes + o que está em alta (aprovado pelo dono)

- **Pedido do dono:** o diagnóstico grátis tem que ser específico e mostrar
  valor na hora — comparar com concorrentes e mostrar o que está em alta.
  "Sempre deve buscar concorrentes e trends" (automático, sem perguntar).
  Custo: o dono pediu o menor possível e aprovou a Apify agora (centavos por
  diagnóstico); depois da aprovação do app na Meta, trocar pelas APIs grátis
  da Meta (Business Discovery + Hashtag Search).
- **Como ficou:** função nova `diagnosis-market` (+ `_shared/marketScan.ts`).
  A página `/diagnostico/:id` chama a cada 5 s e cada chamada avança uma
  etapa: lê até 60 posts recentes das hashtags da região
  (`apidojo~instagram-scraper`), escolhe os 3 perfis que mais postam ali
  (`apify~instagram-profile-scraper`) e o Claude escreve 3 descobertas + 3
  ideias de post usando SÓ os números lidos. Hashtags vêm da ficha
  (`vertical_playbooks.config.market_hashtags`, ex. `imoveis{local}`) +
  bairros do cadastro + cidade — nada de setor no código.
- **Travas de custo:** só começa pra diagnóstico novo (até 30 min);
  teto mensal `MARKET_SCAN_MONTHLY_CAP` (padrão 150); trava contra abas
  duplicadas; sem `APIFY_TOKEN` a seção some e o resto do diagnóstico fica
  igual.
- **Alimenta a conta:** quando o diagnóstico vira conta (`claim-diagnostic`)
  ou já está ligado a uma empresa, os concorrentes entram em
  `marketing_ai_competitors` e os posts em alta em `marketing_ai_trends`
  (`source='diagnostico'`).
- **Teste real em produção (conta de teste, @getsaleboost, Botafogo +
  Copacabana):** pronto em ~1,5 min; achou 3 imobiliárias da região
  (831, 1.176 e 105 seguidores), 5 posts em alta e as descobertas citaram só
  números reais (ex.: último post do perfil foi 08/09 → "0 posts em 30
  dias", conferido no banco). Custo estimado pelos preços da Apify: até
  60 posts × US$0,0005 + 3 perfis × ~US$0,0026 ≈ US$0,04 + 1 chamada do
  Claude.
- **2026-10-10 — descobertas viram "pontos fracos" (pedido do dono):** a
  seção passa a se chamar "O que está te fazendo perder clientes no
  Instagram". O Claude recebe também a bio, o link na bio, os destaques, a
  conta comercial e os dias desde o último post, e aponta os pontos fracos do
  mais grave para o menos grave, comparando com os concorrentes. Não pode
  inventar defeito nem número. Testado em produção (conta de teste): apontou
  "31 dias sem postar", "bio sem região nem contato" e "só 3 posts", todos
  conferidos no banco. Também foi corrigido um erro: a tabela
  `marketing_ai_trends` só aceita `relevance` high|medium|low, e estava indo
  "alta". Agora os posts em alta entram na conta junto com os concorrentes
  (testado: 4 concorrentes e 5 posts em alta gravados).
