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
