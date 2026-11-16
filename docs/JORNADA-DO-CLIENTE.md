# Jornada do cliente — custo do grátis, onboarding guiado, upsell contextual e telas

> **Status:** **aprovado pelo dono em 16/11** (J0), com as respostas da seção 5. O código entra em 1 PR por item. Depois da
> aprovação, o código entra em **1 PR por item**, na ordem da seção 6.
> **Decisões de origem:** [DECISIONS — 13/11 (noite, 3)](DECISIONS.md#2026-11-13-noite-3--jornada-do-cliente-custo-do-grátis-onboarding-guiado-upsell-contextual-e-menu-pro).
> **Levantamento:** feito em 16/11, só leitura e sem gasto. Liga dos Sonhos fora. Os números vêm do banco, e cada um diz
> a fonte. O que é conta minha está marcado **estimado**.

**A ideia em uma frase:** a plataforma é grátis, mas cada conta custa. O cliente é guiado desde a 1ª entrada. O
conteúdo descobre o imóvel que interessa, e a oferta do Pro (o tour) aparece **só nessa hora**, com dado real.

**Já combinado com o dono antes de escrever:**
- **Campanha:** fica no menu Pro, com anúncio pago (13/11 noite). A frase do pedido "a aba Campanha sai do menu" não vale.
- **Tour como post:** vale o D8. Tour pronto vira **post extra**, nunca o post do dia.
- **"Business Game"** é a página **Business Progress**.
- **A lista do Pro é do dono.** Este documento não propõe tirar nem pôr nada no Pro.

---

## 1. Custo do grátis

### 1.1 O que cada conta custou (medido, últimos 30 dias, até 16/11)

Fonte: `agent_performance.cost_usd` agrupado por `task_key` (SQL de 16/11). A Teste Zero e a Tespon são contas de teste,
com uso irregular. A **A3** é a única conta real em uso; os números dela foram só lidos, nada foi alterado.

| O que gasta | Teste Zero | Tespon | A3 (só ~6 dias, desde 10/11) |
|---|---|---|---|
| Estratégia (gerar, reavaliar, atualizar) | US$ 0,82 | US$ 0,81 | US$ 0,41 |
| Inteligência de mercado (busca de notícias) | US$ 0,48 | US$ 0,62 | US$ 0,19 |
| Oportunidades (rodadas) | US$ 0,08 | US$ 0,04 | US$ 0,14 |
| Posts (texto das peças) | US$ 0,39 | US$ 0,43 | US$ 0,57 |
| Imagens e montagem dos slides | **sem custo gravado** | **sem custo gravado** | **sem custo gravado** |
| **Total medido** | **US$ 1,76** | **US$ 1,90** | **US$ 1,31** |

**Cuidado ao ler:**
- **Posts:** o custo do texto só é gravado desde 10/11 (#127). Nas contas de teste ele aparece a partir de 13–15/11.
  O mês real é maior que a tabela.
- **Estratégia:** cada geração tem 3 partes, e cada parte vira uma linha `ai_text_strategy`. Antes de 10/11, o custo
  estava como valor fixo em `strategy_generate`.
- **Imagens:** a montagem dos slides (`render-format`, linhas `content_no_image`) não grava custo. Precisa ser medida
  antes de fixar o teto (item J1).
- **Busca de notícias:** o mesmo dinheiro aparece também em `market_intel_runs` (fase `collect`: Teste Zero US$ 0,38,
  Tespon US$ 0,37, A3 US$ 0,19). **Não somar os dois**, é o mesmo gasto.

**A A3 em um mês (estimado):** US$ 1,31 em ~6 dias dá **~US$ 6,50 por mês**, por conta simples (× 30 ÷ 6). Fica abaixo do
teto de US$ 8, mas perto. Bate com a auditoria de 10/11 ([AUDITORIA-CUSTOS](AUDITORIA-CUSTOS.md)).

### 1.2 O que gasta mesmo com a conta parada (agendamentos)

Fonte: `cron.job` (16/11) e o código de cada função.

| Agendamento (horário UTC) | O que faz | Gasta IA com a conta parada? |
|---|---|---|
| Estratégia, todo dia 9:00 (`strategy-generate`) | **Só confere.** Gera se a conta não tem estratégia; reavalia se faz **7 dias ou mais** da última; atualiza se faz 30 dias. Teto de 10 chamadas por mês. Pula conta em modo vitrine (`strategy-generate/index.ts:1043-1100`, `:159`) | Sim, **1 reavaliação por semana**, mesmo sem ninguém entrar |
| Notícias do mercado, todo dia 9:43 (`marketing-ai`) | Busca notícias da região | Sim, **todo dia**: é o maior gasto parado (~US$ 0,02–0,03 por dia, medido) |
| Oportunidades, a cada 6 h | Confere; a rodada de verdade é a cada 7 dias ou com sinal novo | Pouco (US$ 0,04–0,14 no mês, medido) |
| Plano da semana, domingo 21:00 (`creative-generate`) | Cria os 7 posts da semana | Sim, **a semana inteira**, mesmo se o cliente não abriu a anterior |
| Teste diário, 13:00 (`creative-generate`) | Peça de teste do dia | A conferir no J1 |
| Semanais (ideias, concorrentes, relatórios, kit de marca) | Vários | A conferir no J1; a maioria não grava custo por conta |

**Achado sobre a estratégia:** o pedido dizia "hoje o strategy-generate roda todo dia às 6h". O agendamento roda todo
dia, mas **a revisão completa já acontece só 1 vez por semana**. Todo dia ele só confere a data. A regra "estratégia
completa 1×/semana" **já está quase em vigor**. Falta:
- a atualização no meio da semana só com **sinal forte novo de mercado** (hoje, o meio da semana não olha o sinal);
- não reavaliar conta parada.

### 1.3 Regras propostas (implementar só depois da aprovação; item J1)

| Regra | O que muda | Por quê | Custo para fazer | Risco | Como desfazer |
|---|---|---|---|---|---|
| **Post do dia nunca é cortado** | Nada: vira trava escrita e testada em todas as regras abaixo | É o que o cliente vê | US$ 0 | — | — |
| **Conta parada não gera a semana inteira** | No domingo, se a conta **não abriu o painel nem aprovou nada** na semana anterior, o plano gera **só os posts do dia** até ela voltar, e avisa "sua semana está esperando você". Na volta, completa o resto da semana | Hoje gera 7 peças que ninguém olha | US$ 0 (código) | Cliente volta na quarta e acha a semana vazia. **Mitigação:** completar na hora em que ele abre | Desligar por um interruptor na ficha |
| **Pausar o mercado na conta parada** | Notícias passam de todo dia para 1×/semana se a conta está parada há mais de 7 dias | É o maior gasto parado | US$ 0 | Sinal velho na volta. **Mitigação:** buscar na hora da volta | Interruptor na ficha |
| **Estratégia completa 1×/semana** | Fica como já está. Atualização no meio da semana **só com sinal forte novo**. Conta parada não reavalia | Já é quase assim (1.2) | US$ 0 | Baixo | Voltar o código anterior |
| **Teto de US$ 8/mês por conta grátis** | Soma `agent_performance.cost_usd` do mês. Ao chegar a 80% (US$ 6,40), corta o **opcional**: notícias extras, ideias semanais, reavaliação no meio da semana. **Nunca o post do dia** | Protege o caixa | US$ 0 | Medição incompleta (as imagens não gravam custo). **Mitigação:** medir as imagens antes de ligar o teto | Teto na ficha; valor alto = desligado |

**Como saber se a conta "abriu ou aprovou":** não existe hoje um registro de "última entrada" por conta. Proposta:
gravar a data da última visita ao painel numa coluna nova, `companies.last_seen_at`. É uma migration que **só
acrescenta** (🟢). Aprovar já fica registrado em `agent_actions` (`approved_by`).

### 1.4 Meta de equilíbrio (estimativa, para acompanhar)

- **Custo de uma conta grátis ativa:** ~US$ 6,50/mês (A3, estimado acima). Com o teto, no máximo US$ 8.
- **Tour:** custa ~US$ 4 de vídeo num imóvel médio (8 fotos, 7 caminhadas × US$ 0,504, medido em 11/11), e ~US$ 14 num
  imóvel grande. O preço de US$ 15 é **hipótese**.
- **Margem por tour** (hipótese): ~US$ 11 no médio; **~US$ 1 no grande**. Com a hipótese, 1 tour médio por conta ativa
  por mês paga uma conta grátis. Um tour grande não paga. **O preço precisa variar com o tamanho do imóvel.**
- Tudo isso continua estimativa até haver tour vendido. Medir: tours vendidos por conta ativa, por mês.

---

## 2. Onboarding guiado (sem encher de pop-up)

### 2.1 O que existe hoje (auditoria de 16/11)

| O que aparece | Onde | Problema |
|---|---|---|
| Pop-up **"Seu status de negócio"** (Bronze, XP, "Ver o Business Game") | `marketingAi/ProgressPopup.tsx`, montado em `DashboardLayout.tsx:319` | Abre **1× por dia em qualquer tela**, com fundo escuro por cima de tudo (`position: fixed`, `zIndex 1000`). Bloqueia o clique até fechar. No teste, cobriu a tela do Tour virtual (print `desk-tour`). Fica guardado **no navegador**, então repete em outro aparelho |
| "**Plano Free**" embaixo do e-mail no menu | `DashboardLayout.tsx:214` | Fala de "plano", e o Pro **não é plano** |
| Faixa "**modo demonstração — escolha um plano**" | `ShowcaseUi.tsx:22` | Contradiz "plataforma grátis" |
| Janela do **cupom** com preço em R$ | `ShowcaseUi.tsx` (`CouponModal`), preços de `pricing.ts` | Mostra preço que **não foi decidido** (regra 5). Volta a cada sessão do navegador |
| Boas-vindas e contador de teste de 7 dias | `TrialStartModal`, `TrialStatusWidget` | Resto do modelo antigo de assinatura |
| Aviso de cookies | rodapé | No celular, cobre os botões da tela até aceitar |

### 2.2 Correções (item J2, primeiro de tela)

| Correção | O que muda | Custo | Risco | Como desfazer |
|---|---|---|---|---|
| Pop-up "status de negócio" | **Sai como pop-up diário.** O status vira um cartão pequeno no painel e na página Business Progress. Pop-up só para evento real (2.5) | US$ 0 | Baixo | Reverter o PR |
| Avisos de plano | Sai "Plano Free", sai a faixa "escolha um plano" e sai o cupom com preço. No lugar, uma linha neutra: "Sales Boost é grátis. Funções Pro usam Boosts (em breve)". Código guardado, sem apagar | US$ 0 | Baixo. Os preços em R$ ficam no código, sem aparecer | Reverter o PR |
| Teste de 7 dias | Some da tela (o modelo é grátis) | US$ 0 | Baixo | Reverter |

### 2.3 Checklist "Primeiros passos" (item J3)

Fica fixa no topo do painel e some quando termina. Cada passo é marcado **sozinho, com dado real**. Não há passo que o
sistema não consiga conferir.

| # | Passo | Leva para | Como o sistema confere sozinho |
|---|---|---|---|
| 1 | "Cadastre seu 1º imóvel com fotos reais" | Meus imóveis | Existe imóvel com 5 ou mais fotos (`marketing_ai_knowledge`) |
| 2 | "Seus primeiros posts estão prontos" | Aprovações, bloco "Sua semana" | Existe peça pronta (`marketing_ai_test_content`, status `vault`) |
| 3 | "Aprove a sua semana" | Aprovações | Existe ação aprovada pelo dono (`agent_actions.approved_by`) |
| 4 | "Informe seu CRECI" | Configurações | `playbook_answers.creci` válido (já conferido hoje para publicar) |
| 5 | "Conecte o Instagram" (pode pular) | Configurações → Conexões | `companies.instagram_user_id` preenchido, ou "pular" marcado |
| 6 | "Conheça o Tour virtual" | Pro → Tour, com o imóvel do passo 1 escolhido | A página do Tour foi aberta (registro do 2.4) |

Mudei a lista do pedido assim:
- **Entrou o passo 1:** sem imóvel não há post nem tour.
- **Entrou o passo 4:** sem CRECI nada publica (regra de 09/11), e hoje o aviso só aparece em Aprovações.

### 2.4 Dica na 1ª visita de cada tela

- Uma frase apontando onde clicar, uma vez **por conta** (não por navegador).
- **Onde guardar:** coluna nova `companies.ui_seen` (jsonb: tela → data). Migration que só acrescenta. Já existe um
  precedente, `companies.trial_intro_seen_at`.
- **Custo:** US$ 0. **Risco:** baixo. **Desfazer:** a dica some se o código sair; a coluna fica sem uso.

### 2.5 No máximo 1 pop-up por sessão, só para evento real

- **Eventos que podem abrir pop-up:** "Sua 1ª semana ficou pronta"; "Seu tour ficou pronto"; "Chegou um lead".
- **Regra:** 1 por sessão. Se houver mais de um, o resto vai para o sino.
- **Nunca:** status, XP, cupom ou propaganda.

---

## 3. Upsell contextual (sempre levando ao Pro)

### 3.1 Gatilhos

Cada gatilho aparece **uma vez**, no lugar onde o cliente acabou de ver valor, e leva ao Pro com a função já aberta.

| # | Momento | Mensagem (exemplo) | Dado real que precisa existir | Leva para |
|---|---|---|---|---|
| G1 | O dono aprova um carrossel de um imóvel | "Esse imóvel tem 12 fotos. Ele pode virar um tour completo." | Número de fotos do imóvel (`marketing_ai_knowledge.meta.photos`) | Pro → Tour, com o imóvel escolhido |
| G2 | O imóvel tem as fotos de ligação | "Este imóvel já tem tudo para um tour sem passagem inventada." | Conferência de ligação (`check_passages`) sem ⚠️ | Pro → Tour |
| G3 | Post do imóvel com salvamentos ou cliques **medidos** | "12 pessoas salvaram o post deste imóvel. O tour é o próximo passo antes da visita." | `instagram_content_performance.saves` ou `link_events` (cliques) desse imóvel, **maior que zero** | Pro → Tour |
| G4 | Imóvel novo cadastrado | "Já preparamos os posts. Quer o tour para o lançamento?" | Imóvel criado + peças geradas | Pro → Tour |
| G5 | Fim da 1ª semana | Resumo com os números reais + 1 próximo passo | Contagens da semana (posts publicados, cliques, leads) | Business Progress ou Pro → Tour |
| G6 | Tour pronto | "Seu tour pode virar um post extra, além do post do dia." (D8) | Tour com status pronto | Aprovações (peça sem dia) |

**Hoje o G3 quase nunca vai aparecer:** sem Instagram conectado não há salvamento medido, e as contas de teste não têm
Instagram. Ele vale para a A3 e para as próximas contas reais.

### 3.2 Regras

- **Números:** só se foi medido. Nunca urgência falsa nem "últimas vagas".
- **No máximo 1 oferta** visível por vez. Se houver mais de uma, vale a ordem da tabela.
- **"Agora não"** silencia aquela oferta, para aquele imóvel, por **7 dias** (guardado por conta).
- **Medir cada gatilho:** mostrado, clicado e convertido (tour gerado). É também validação comercial.
  - **Onde guardar:** tabela nova `upsell_events` (conta, gatilho, imóvel, evento, data). Migration que só acrescenta.

### 3.3 Funções do Pro que ainda não existem

- Aparecem como "**em breve**", com o botão "**Quero saber quando chegar**", que grava o interesse na mesma
  `upsell_events`.
- **Nunca** prometer data.
- Hoje os candidatos são "Criativos de anúncio" e "Avatar do corretor": já aparecem como "em breve" no card do imóvel.
  **Quais entram no Pro é decisão do dono.**

### 3.4 Boost

**Continua em aberto.** O Pro mostra e explica as funções, **sem cobrar**. Nenhum código de cobrança de Boosts.

### 3.5 Conteúdo ↔ tour

- **Post de imóvel → tour:** a página pública do imóvel (o link do post) ganha "Ver o tour" **quando o tour existe**.
- **Tour → post:** tour pronto vira **post extra**, com aprovação (D8, item C5 da frente de conteúdo).

---

## 4. Front-end (dashboard e dentro de cada opção)

### 4.1 Auditoria (16/11, conta Teste Zero, site no ar, celular 390 px e desktop 1280 px)

- **Prints:** 30 telas (15 no desktop e 15 no celular), enviadas ao dono na conversa de 16/11. Não entram no repositório, para não pesar.
- **Conta de teste nova:** não criada. O cadastro pode disparar IA paga (diagnóstico e estratégia), e a verba de teste
  não cobre isso. A 1ª entrada foi vista na Teste Zero, e a conta nova fica para o J3, com a verba combinada.

| Tela | O que promete | O que faz de verdade | O que confunde quem não é técnico |
|---|---|---|---|
| **Painel** (Marketing AI) | "Seu departamento de crescimento com IA" | Resultado comercial, próxima ação, aprovações, sinais | "GROWTH OS", "Modo demonstração" (caixa de marcar), "Funil". Vários "Carregando…" e "Verificando…" juntos |
| **Agentes** (robôs 3D) | A equipe | Abre cada agente (#173) | "Versão leve · qualidade reduzida" no celular |
| **Meus imóveis** | Cadastro com fotos reais | Bom: mostra peças, tour e página pública por imóvel | Muitos botões por imóvel (7); "Gerar pacote" |
| **Conteúdo** ("Ativação") | Calendário da semana | Calendário + padrão visual + Conversas | O título "Ativação"; "Carregando…" |
| **Inteligência de Mercado** | Notícias da região | Fluxo de 6 passos com horários | Linguagem de sistema ("Coleta", "Sinais", "Reclassificar"); "Coleta do Instagram 🚧 em construção" |
| **Oportunidades** | Onde o mercado encontra o catálogo | Fluxo com "Verificação automática", "Rodada de busca" | Texto técnico sobre rodadas e horários |
| **Estratégia** | Direcionamento ativo | Objetivo, foco e botões "Reavaliar" e "Pedir nova estratégia" | "Direcionamento", "Estratégia ativa"; texto longo |
| **Resultados** | Funil, desempenho, aprendizado | Funil com **contatos de exemplo** (Ana Costa, "Clicou no anúncio"…) | Exemplo parece dado real; 5 abas; "Experimentos" |
| **Tour virtual** (Pro) | Tour completo | Bom: escolher imóvel → montar → gerar | O pop-up do status cobriu a tela |
| **Campanha** (Pro) | Anúncios | "Modo demonstração" com campanhas de exemplo | Termos "pixel", "funil", "Meta Ads" |
| **Business Progress** (Pro) | Progresso real | Liga Bronze, XP, "Health Score · aguardando dados" | Jogo em inglês ("Starting Business", "League", "XP") |
| **Aprovações** | Tudo passa aqui | Aviso de CRECI, modo de aprovação, semana | Bom. A escolha "pedir aprovação × automático" ocupa o topo |
| **Relatórios** | Relatórios + histórico | Histórico "Igual ao Telegram · ao vivo" | **O Telegram foi desligado**: o texto ficou errado |
| **Configurações** | Perfil | Formulário longo | "Tipo de estabelecimento" com Airbnb (outro setor); "Ticket médio" |

**Repetido em vários lugares:**
- **Próxima ação:** painel, sino e Aprovações.
- **Histórico:** Relatórios, sino e a página Atividades fora do menu.
- **Progresso:** Business Progress, pop-up e painel.

### 4.2 Modelo único da página de cada agente (item J4)

```
┌────────────────────────────────────────────────────────────┐
│ [ícone] Agente de Conteúdo                                 │
│ "Prepara 1 post por dia dos seus imóveis, com foto real."  │  ← 1. o que faz por você
├────────────────────────────────────────────────────────────┤
│ PRECISA DE VOCÊ AGORA (3)                                  │  ← 2. pendências, ação AQUI
│  ▢ Ter 18/11 · Carrossel Cobertura Leblon  [Aprovar] [Ver] │
│  ▢ Qua 19/11 · Dica do bairro              [Aprovar] [Ver] │
│  [ Aprovar a semana (5) ]   ← botão principal único        │
├────────────────────────────────────────────────────────────┤
│ O QUE ELE FEZ (últimos 7 dias)                             │  ← 3. só dado real
│  7 posts prontos · 2 publicados · cliques: ainda sem dados │
├────────────────────────────────────────────────────────────┤
│ PRÓXIMO PASSO                                              │  ← 4. uma sugestão
│  "A Cobertura Leblon tem 12 fotos: pode virar um tour" →   │     (pode ser o upsell)
├────────────────────────────────────────────────────────────┤
│ ▸ Configurações (padrão visual, horários)                  │  ← 5. recolhido
└────────────────────────────────────────────────────────────┘
```

| Agente | 1. Frase | 2. Precisa de você | 3. O que ele fez | 4. Próximo passo |
|---|---|---|---|---|
| **Conteúdo** (1º) | "Prepara 1 post por dia dos seus imóveis, com foto real." | Posts para aprovar, no calendário | Prontos, publicados, cliques | Upsell G1/G4 ou "cadastre mais fotos" |
| **Mercado** | "Lê as notícias da sua região e guarda só o que importa." | Notícias para descartar (as automáticas) | Notícias guardadas na semana, com fonte | "Veja a oportunidade que saiu disto" |
| **Oportunidades** | "Cruza o mercado com seus imóveis e sugere o que fazer." | Oportunidades para aprovar ou descartar | Aprovadas e o que virou post | Abrir a oportunidade do topo |
| **Estratégia** | "Define o foco do mês: que imóveis e que público." | Proposta nova esperando você | O foco atual, em 3 linhas | "Reavaliar" (só se tiver sinal novo) |
| **Resultados** | "Mostra quem viu, quem se interessou e quem pediu visita." | Contatos sem resposta | Funil real; exemplo só com o selo "exemplo" | Upsell G3/G5 |

### 4.3 Regras de tela

- **Um botão principal** por tela.
- **Linguagem do corretor**, em português. Glossário abaixo.
- **Os mesmos selos em todo o site:**
  - 🟢 **Pronto**
  - 🟠 **Aguardando você**
  - 🔵 **Agendado**
  - 🔴 **Com problema**
  - (no lugar de "vault", "QUEUED", "EXECUTED"…)
- **Estado vazio que ensina:** "Ainda não há notícias. A 1ª busca sai amanhã às 6h43." em vez de "sem dado ainda".
- **Carregamento com o logo** (`BrandLoader`) no lugar de "Carregando…" e "Verificando…".
- **Celular primeiro.** O aviso de cookies não pode cobrir o botão principal.
- **Exemplo sempre com selo "exemplo"** (Resultados, Campanha), nunca misturado com dado real.
- **Campanha:** **fica** no menu Pro (decisão de 13/11 noite).

### 4.4 Glossário de troca

| Hoje na tela | Passa a ser |
|---|---|
| Growth OS / Marketing AI | (sai) ou "Seu painel" |
| Ativação | Conteúdo |
| Pilar, família (de conteúdo) | Tipo de post |
| Hermes | o agente de estratégia (nunca o nome interno) |
| Growth, SDR | (sai) |
| Estratégia ativa / Direcionamento ativo | Foco do mês |
| Sinais de mercado | Notícias da sua região |
| Coleta, rodada, reclassificar | (sai da tela; fica só "atualizado às HH:MM") |
| Funil | Do interesse à visita |
| Lead | Contato interessado |
| Health Score, XP, League, Starting Business | Seu progresso (em português, só com dado real) |
| Pacote (de conteúdo) | Posts deste imóvel |
| Modo demonstração | Exemplo |
| Pixel, Meta Ads | Anúncios no Instagram e Facebook |

### 4.5 Mapa do menu proposto

O grupo **Pro fica exatamente como o dono definiu**: Tour virtual, Campanha e Business Progress.

```
PAINEL
  Início                ← painel + checklist "Primeiros passos"
  Meus imóveis
  Agentes               ← robôs 3D; cada um abre a página no modelo 4.2
PRO                     (lista do dono, sem mudança)
  Tour virtual
  Campanha
  Business Progress
CENTRAL DO DONO
  Aprovações            ← tudo que espera você (único lugar de "aprovar")
  Relatórios            ← relatórios + histórico (a Atividade mora aqui e no sino)
Configurações
```

**Onde fica cada coisa:**
- **Aprovar:** só em Aprovações e na página do agente (a mesma ação, sem duplicar a lista).
- **Histórico:** Relatórios e o sino. A página "Atividades" continua só por link.
- **Progresso:** Business Progress (cartão pequeno no painel, sem pop-up).

---

## 5. O que depende do dono

| # | Decisão | Por que precisa | Alternativas (custo e prazo) | Minha recomendação |
|---|---|---|---|---|
| J-a | Aprovar este documento | O código só começa com a aprovação | — | ✅ aprovado (16/11) |
| J-b | O que é "conta parada"? | Define quando a semana pausa | (1) não abriu nem aprovou em 7 dias; (2) em 14 dias. Ambos US$ 0, 1 PR | ✅ **7 dias** sem abrir nem aprovar nada (16/11) |
| J-c | Pausar também as notícias do mercado na conta parada? | É o maior gasto parado | Sim (economiza ~US$ 0,5–0,8/mês por conta parada, estimado) · Não | ✅ **sim**, pausar as notícias enquanto a conta estiver parada (16/11) |
| J-d | Avisos de plano antigos (preço em R$, cupom, teste de 7 dias): esconder? | Contradizem "plataforma grátis" e mostram preço não decidido | Esconder sem apagar (US$ 0, 1 PR) · Manter | ✅ **esconder**, sem apagar (16/11) |
| J-e | Quais funções "em breve" entram no Pro | A lista do Pro é do dono | Criativos de anúncio, Avatar do corretor, outra | ✅ **Criativos de anúncio e Avatar do corretor** (16/11) |
| J-f | Conta de teste nova para a auditoria da 1ª entrada | O cadastro pode gastar IA | Usar US$ 0,30–0,60 (estimado) da verba de conteúdo · Não criar | ✅ **sim**, criar a conta nova, até US$ 0,60 (16/11) |
| J-g | Avisar a A3 que o Telegram foi desligado (D5) | Ela recebia avisos lá | O dono envia o texto | ✅ feito: o dono avisou a A3 (16/11) |

---

## 6. Ordem de implementação (depois da aprovação; 1 PR por item)

| Ordem | Item | Entrega | Gasto previsto |
|---|---|---|---|
| 1 | **J1 · Custo do grátis** | `last_seen_at`; semana pausada para conta parada (post do dia garantido); estratégia no meio da semana só com sinal forte; medir a montagem dos slides; teto de US$ 8 desligado até a medição fechar | US$ 0 (teste com código, sem IA) |
| 2 | **J2 · Correções de hoje** | Pop-up do status sai; avisos de plano escondidos; texto do Telegram em Relatórios; aviso de cookies no celular | US$ 0 |
| 3 | **J3 · Onboarding** | Checklist com 6 passos que marcam sozinhos; dica de 1ª visita (`ui_seen`); pop-up só de evento real | Até US$ 0,60 da verba de conteúdo (conta nova, se J-f aprovado) |
| 4 | **J4 · Página do agente** | Modelo 4.2, começando pelo Conteúdo; depois 1 agente por PR; selos e glossário | US$ 0 |
| 5 | **J5 · Upsell** | Gatilhos G1–G6, um por PR, com `upsell_events` (mostrado/clicado/convertido) e "agora não" por 7 dias | US$ 0 |

Cada PR traz prints do celular e do desktop, só dado real, e o site conferido no ar. Gasto fora da verba é 🔴.

---

**Resumo para o dono (6 linhas)**
1. Medi o custo: cada conta de teste gastou ~US$ 1,80 em 30 dias; a A3, ~US$ 6,50/mês (estimado). O teto de US$ 8 cabe.
2. A estratégia completa **já** roda só 1×/semana. O gasto que mais pesa parado são as notícias diárias e o plano da semana.
3. Proposta: conta parada recebe só o post do dia até voltar; o post do dia nunca é cortado.
4. Hoje atrapalha: o pop-up diário "status de negócio" cobre a tela, e há avisos de "plano" e cupom com preço não decidido.
5. Onboarding: checklist de 6 passos que marca sozinha, dica 1× por conta, pop-up só de evento real; oferta do Pro só com dado medido.
6. Decida a seção 5 (J-a a J-g). O código começa pelo J1, um PR por item.
