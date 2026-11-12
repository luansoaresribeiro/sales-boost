# Sales Boost — Produto

> Lido por todo agente antes de trabalhar em qualquer coisa que toque decisão
> de produto, conteúdo ou posicionamento. Decisões com data ficam em
> [DECISIONS.md](DECISIONS.md); aqui fica o estado atual, não o histórico.

## Estado atual em uma tela (atualizado 2026-11-02)

> Resumo do que vale HOJE. As seções abaixo guardam o histórico com as divergências marcadas.

- **Pitch em trabalho:** [pitch/PITCH.md](../pitch/PITCH.md) — "conteúdo com intenção no ritmo do mercado,
  ativação nos melhores conteúdos e um painel que ensina como a empresa se relaciona com o mercado".
- **O produto são 5 componentes em sequência** (decisão de 2026-10-31/11-01, ver DECISIONS):
  Inteligência de Mercado (notícias diárias, teto US$ 5/mês) → Motor de Oportunidades → Estratégia →
  Ativação (Conteúdo, Campanha, Conversas) → Resultados e Aprendizado. Catálogo saiu da Inteligência de Mercado
  e virou página própria (botão "+").
- **Foco agora (2026-11-01):** qualidade do tour virtual e dos carrosséis **antes do 1º cliente criar conta**,
  validada numa conta nova criada do zero. Critério pra liberar o 1º cliente: toda peça da 1ª semana com nota 4+/5.
- **Idioma:** inglês é o padrão geral (2026-10-27), mas o **setor define o idioma** (2026-11-02): `imoveis_rio`
  nasce em português.
- **Preço:** em revisão. Ideia do dono (2026-11-02, **não decidida**): 3 planos em dólar — US$ 19 / 29 / 59 com
  5 / 15 / 30 posts; o mais caro com avatar, Meta Ads e leitura comercial avançada. O que está no código hoje
  continua sendo o da seção "Modelo de cobrança" abaixo até o dono decidir.
- **Ainda não existe (não prometer como pronto):** impulsionar/criar anúncio pelo Sales Boost (hoje só leitura do
  Meta Ads), avatar, coleta de métricas do Instagram fechando o ciclo de aprendizado.

## Quem somos (texto do dono, 2026-10-12)

> **Sales Boost is an AI growth partner that continuously understands a
> business, builds its digital acquisition strategy, executes it, learns
> from the results, and adapts to bring the business more customers.**

**Diferencial:** empresas precisam de alguém que pense, execute e aprenda
continuamente sobre como adquirir clientes digitalmente — sem que o dono
precise virar especialista em marketing, IA, anúncios e conteúdo.

Frases da marca (usar no site, nos vídeos e na conversa com o cliente):
- "Não somos uma ferramenta solta, somos um parceiro de crescimento." (EN:
  "We are not a standalone tool, we are a growth partner.")
- "Não queremos só likes, queremos que o seu negócio cresça."
- "Não somos agência, somos seus parceiros."
- "Não tira férias, não pede aumento e trabalha de madrugada também."
- "Nós transformamos atenção em negócio."

Onde aparece no site: hero (subtítulo), seção "Quem somos" (logo abaixo da
hero), seção "Não somos agência" e rodapé — textos em `src/i18n.ts`.

## Posicionamento

Sales Boost é uma **growth engine** / "AI growth partner": entende o
negócio, constrói a estratégia de aquisição digital, executa, aprende com os
resultados e se adapta.

> "Não somos ferramenta solta; somos parceiro de crescimento. Não queremos
> likes, queremos que o negócio cresça."
> "Não tira férias, não pede aumento, trabalha de madrugada."

> **Divergência (2026-10-28):** o posicionamento passou a ser **"Inteligência comercial para imobiliárias.
> Identificamos oportunidades no seu mercado, conectamos essas oportunidades aos imóveis da sua imobiliária e
> ajudamos seus corretores a transformar isso em ações para gerar demanda."** O texto acima fica como
> histórico (a base — dados reais, aprovação do dono — continua valendo). Ver
> [DECISIONS.md](DECISIONS.md#2026-10-28--inteligência-comercial-para-imobiliárias-opportunity-engine).

> **Divergência (2026-11-10, dono):** o slogan passa a ser **"Sales Boost — gerando mais visitas para o seu imóvel"**.
> Ele acompanha o novo modelo: plataforma grátis, tour pago e lead qualificado. A métrica principal deixa de ser "conteúdo produzido" e passa a ser
> **visitas aos imóveis**. Na tela, o topo do site diz "Você cuida dos imóveis. Nós geramos mais visitas." Os textos acima ficam como
> histórico. **Cuidado:** prometer visita garantida continua proibido; o que o Sales Boost entrega é a estrutura que gera, rastreia e
> converte interesse em visitas. Ver [DECISIONS.md](DECISIONS.md).

A estratégia vem de **dados reais** (Data Agent — ver [ARCHITECTURE.md](ARCHITECTURE.md)),
não só da URL que o cliente colou no diagnóstico gratuito.

**Hermes** (o motor de estratégia do produto — não confundir com os agentes
de desenvolvimento, ver seção "Hermes do produto ≠ agentes de dev" em
[ARCHITECTURE.md](ARCHITECTURE.md)) é o **alocador de atenção**: decide onde
investir esforço com base no que funciona de verdade. Ele analisa a cadeia
completa: onde descobrem o negócio → como contatam → como convertem → como
compram.

## O diagnóstico grátis: Social Selling no centro (2026-10-19)

**Objetivo central:** fazer o corretor perceber que o Instagram dele pode
estar desperdiçando oportunidades de gerar confiança e iniciar conversas
comerciais, e mostrar como o Social Selling muda isso. Não é dar nota, listar
erros nem comparar seguidores.

**Pergunta-guia de cada seção:** "quando um potencial comprador visita este
perfil, o que encontra que o ajude a confiar, aprender e dar o próximo
passo?"

**Duas camadas:**
1. **Inteligência de mercado** (o que já existia): concorrentes, o que está
   em alta e as descobertas. Prova que o Sales Boost entende o contexto.
2. **Social Selling** (a assinatura do Sales Boost): 5 pilares — Autoridade,
   Educação, Confiança, Relacionamento e Conversão. Avalia **do que falam**
   os posts, não só quantos são.

**A página é organizada em 3 camadas** (ajuste do dono no mesmo dia):
1. **O que você está fazendo hoje:** nota, do que falam os posts, o que já
   funciona como vitrine e o mercado.
2. **O que você precisa entender sobre geração de demanda:** princípios com
   exemplos imobiliários. Por exemplo: visualização não é intenção, educar
   atrai quem pesquisa, uma chamada abre a conversa. O corretor aprende algo
   que pode aplicar antes mesmo de contratar.
3. **Como aplicar isso ao seu perfil:** os 5 pilares com evidência real, a
   oportunidade ignorada e um post de exemplo com objetivo.

Depois das camadas vem o botão de criar conta.

Para cada lacuna, o diagnóstico ensina o porquê, além de apontar a tarefa.

**Mensagem para a imobiliária:** a mensagem deixa de ser "uma ferramenta que
cria posts". Passa a ser: "ajude seus corretores a construir autoridade,
educar compradores e transformar a presença digital em oportunidades, com
uma estratégia que a imobiliária organiza e acompanha". O conteúdo é o meio;
o resultado comercial é o produto.

Como funciona (código e ficha): docs/DECISIONS.md, 2026-10-19.

## Verticalização (regra central)

Mesma infraestrutura pra todo setor; setor = **ficha**
(`vertical_playbooks`, dado/config em jsonb — nunca código específico de
setor). Teste de sanidade pra qualquer mudança: *"se eu trocar imóvel por
procedimento estético, preciso mudar código? Se sim, está errado — vira
ficha."*

> **Divergência (2026-10-27):** o dono decidiu vender para os **EUA inteiros**, com o **inglês como idioma
> principal** (os brasileiros atuais seguem em PT). Os trechos abaixo sobre Rio de Janeiro, PT-BR e R$ ficam como
> estado do piloto atual — ver [DECISIONS.md](DECISIONS.md#2026-10-27--inglês-como-idioma-principal-mercado-eua-inteiro).
> Ficha `real_estate_us`, dólar, fuso e termos do mercado americano ainda não existem (fases 2-4).

- **Ficha ativa:** `imoveis_rio`.
- **ICP:** corretor autônomo ou imobiliária pequena (até ~10 corretores) no
  Rio de Janeiro. **Ajuste 2026-10-02 (dono):** público-alvo por agora =
  corretores e imobiliárias (sem o limite de tamanho), alinhado ao preço
  de R$1.449/mês — ver [DECISIONS.md](DECISIONS.md).
- **Canal:** só Instagram por enquanto.
- **Onboarding por cliente** (`companies.playbook_answers`): transação
  (comprar/alugar), faixa de preço, bairros, cliente típico, CRECI, tamanho
  da carteira. Pular pergunta = usa padrão médio da ficha, nunca trava o
  fluxo.
- **Próximas fichas possíveis** (não construir sem decisão explícita):
  e-commerce, SaaS, serviços locais, saúde/beleza, hospitalidade — cada uma
  é ficha nova, nunca sistema novo.

## Escada de ofertas

Conteúdo gratuito/workshop/comunidade → SaaS + setup fee → SaaS + créditos
por uso (vídeo) → SaaS + % de performance (só quando houver medição
confiável de receita — ver gap em [LEARNING.md](LEARNING.md)) → marketplace
→ plataforma + dados.

**Hoje:** setup (arrumar perfil, conectar, 3 primeiros imóveis) +
mensalidade R$397–697 (~R$13–23/dia). Tática: desconto pra cliente que posta
sobre o Sales Boost no próprio feed. **Superado em 2026-10-02:** teste
grátis de 7 dias ("7-Day Growth Preview") → plano único **R$1.449/mês**
("Full Growth Access") — ver Modelo de cobrança abaixo.

## Princípios (nunca violar)

- Human-in-the-loop sempre — ver REGRAS INVIOLÁVEIS no [CLAUDE.md](../CLAUDE.md).
- Foto do imóvel sempre real — nunca gerada por IA.
- Nunca prometer valorização do imóvel.
- CRECI sempre visível.
- 80% do que já funciona + 20% de experimentos controlados (não é regra
  fixa de código hoje — ver gap registrado em
  [CONTENT-INTELLIGENCE.md](CONTENT-INTELLIGENCE.md)).
- A tese da estratégia é estável e se fortalece com o tempo — não recomeça
  do zero a cada rodada (ver "Estratégia automática" em
  [ARCHITECTURE.md](ARCHITECTURE.md)).

## Público-alvo (visão de mercado, além do ICP da ficha ativa)

Qualquer dono de pequeno/médio estabelecimento no Brasil — varejo, serviços,
beleza, saúde, food, clínicas, academias, franquias — que quer crescer sem
precisar virar especialista em marketing.

- Fase 1: Brasil (foco Rio de Janeiro) + brasileiros nos EUA.
  > **Divergência (2026-10-27):** passou a ser EUA inteiro, em inglês, mantendo os brasileiros atuais em PT —
  > ver [DECISIONS.md](DECISIONS.md#2026-10-27--inglês-como-idioma-principal-mercado-eua-inteiro).
- Decisor: o próprio dono, decisão rápida.
  > **Divergência (2026-10-28):** o cliente-alvo passou a ser a **imobiliária com equipe de corretores** (o
  > corretor autônomo continua podendo usar). Decisor e preço para equipe seguem **pendentes** — ver
  > [DECISIONS.md](DECISIONS.md#2026-10-28--inteligência-comercial-para-imobiliárias-opportunity-engine).

## Diferenciais competitivos

1. **Jarvis fala com você** — assistente de voz IA que executa tarefas de
   marketing por comando de voz, em português (ver seção Jarvis em
   [ARCHITECTURE.md](ARCHITECTURE.md) — fora do escopo dos docs 1-11 desta
   reorganização, mas é parte real e ativa do produto).
2. Conhece o cliente com dados reais da internet (Apify) — varre reviews,
   redes e Maps.
3. Diagnóstico de site grátis — porta de entrada / isca de lead qualificado.
4. Um agente que EXECUTA, não só mostra relatório — em PT-BR, preço em R$.
   > **Divergência (2026-10-27):** inglês como idioma principal e mercado EUA; preço em USD ainda é decisão
   > pendente do dono — ver [DECISIONS.md](DECISIONS.md#2026-10-27--inglês-como-idioma-principal-mercado-eua-inteiro).
5. Ninguém faz: comparação de preços + cruzamento com reviews + plano de
   ação concreto + voz.

## Concorrentes (referência)

- **Birdeye / ReviewTrackers / Podium** (US): caros, genéricos, só
  dashboard.
- **Falaê** (BR): pesquisa de satisfação + CRM — não faz inteligência de
  preços.
- **Zenchef / Gastroranking** (EU): gestão de reviews atrelada a reservas.
- **Diferencial:** ninguém cruza preços + reviews + plano de ação + agente
  que executa + voz em PT-BR.

## Conta dos Boosts — só documento, nada decidido (2026-11-12)

> Pedido do dono (11/11): fazer a conta depois de ter o custo real do tour. **Nenhum código de Boosts ou cobrança**
> antes dos dois gates (técnico do tour + validação comercial com imobiliárias) e da decisão do dono.

**Custo real medido** (fonte: `video_tours.cost_usd` e o preço do Higgsfield, 11/11):

| Item | Custo | Fonte |
|---|---|---|
| 1 caminhada de 6 s (Kling via Higgsfield) | US$ 0,504 (US$ 0,084/s) | medido |
| Conferência de ligação, por par de fotos | ~US$ 0,01 (uma vez por par) | estimado pelo preço do Sonnet 5.5 |
| Nota/cômodo de cada foto | ~US$ 0,003 (uma vez por foto) | estimado |
| Tentativa que falha no fornecedor | US$ 0 (não é cobrada) | medido (3 falhas em 11/11) |
| Trecho que sai ruim e precisa refazer | o preço de 1 caminhada | ainda sem média; uso **+20% de reserva** (hipótese) |
| Estúdio (VPS), taxas do Stripe, câmbio e IOF | **a medir** (fatura do dono) | — |

Tour de N fotos = (N − 1) caminhadas. Tours já feitos: 8 fotos = US$ 3,53 de vídeo (medido); 5 fotos = US$ 1,76 e
2,02 (modelo antigo, com trecho de 5 s).

**Custo por tour (com a reserva de 20%) e preço por regra:**

| Fotos | Custo direto | Com reserva | +50% markup | +75% markup | 50% de margem | 75% de margem |
|---|---|---|---|---|---|---|
| 5 | US$ 2,07 | US$ 2,49 | US$ 3,73 | US$ 4,35 | US$ 4,97 | US$ 9,94 |
| 8 | US$ 3,62 | US$ 4,35 | US$ 6,52 | US$ 7,61 | US$ 8,69 | US$ 17,39 |
| 12 | US$ 5,69 | US$ 6,83 | US$ 10,24 | US$ 11,95 | US$ 13,66 | US$ 27,31 |

**Markup ≠ margem:**
- **"50 a 75% a mais"** (a ideia do dono) é **markup**: preço = custo × 1,5 a 1,75. Isso dá uma margem de 33% a 43% do preço.
- **"50% de margem"** é preço = custo ÷ 0,5, ou seja, o dobro do custo.

**Boost = 1 caminhada (proposta a validar):** fica simples para o cliente (tour de N fotos = N − 1 Boosts), e se a
caminhada falhar no fornecedor o Boost volta. Custo por Boost com reserva: US$ 0,62. Preço por Boost:

| Regra | Preço por Boost |
|---|---|
| +50% markup | US$ 0,93 |
| +75% markup | US$ 1,08 |
| 50% de margem | US$ 1,23 |

O exemplo do dono ("tour de US$ 5 = 10 Boosts") só fecha com um valor por Boost definido. Com 1 Boost = 1 caminhada,
um tour de 8 fotos = 7 Boosts.

**O que falta antes de decidir:**
1. Fechar o gate técnico do tour.
2. Medir a média real de trechos refeitos, para trocar a reserva de 20% por número.
3. Somar estúdio, Stripe e câmbio (faturas do dono).
4. As conversas com imobiliárias: quantos tours por mês e quanto pagariam.

## Modelo de cobrança — DECIDIDO (2026-10-02)

> **Divergência (2026-11-02):** o dono está repensando o preço — 3 planos em dólar (US$ 19 / 29 / 59; 5 / 15 / 30
> posts por mês; o Pro com avatar, Meta Ads e leitura comercial avançada). **Ainda não decidido** — ver
> [pitch/PITCH.md](../pitch/PITCH.md). O código continua com o modelo abaixo até a decisão.

> **Divergência (2026-10-13):** conta nova não tem mais teste de 7 dias com o
> painel inteiro nem fica presa no "modo grátis": entra em **modo vitrine** (vê
> o painel todo em somente visualização, com faixa "modo demonstração" e
> "Disponível no plano" nas ações que gastam/publicam). O kit grátis é só pra
> quem veio do diagnóstico grátis. Ver [DECISIONS.md](DECISIONS.md) (2026-10-13).

> **Divergência (2026-10-08):** o preço de R$1.449 único abaixo foi substituído por mensal R$2.449 (sem fidelidade) e anual R$1.449/mês (fidelidade 12 meses) — ver [DECISIONS.md](DECISIONS.md#2026-10-08--pagamento-fatia-4-como-foi-implementado). Mantido como histórico.

**Decisão do dono:** plano único **Sales Boost — R$1.449/mês, Full Growth
Access**, depois de um teste grátis de **7 dias** ("7-Day Growth Preview").
Posicionamento: não é "pagar por mais gerações de IA", é "seu departamento
de crescimento com IA está pronto pra executar".

- **No teste (7 dias):** inteligência real, não demo — Telegram só com
  sinais relevantes; painel do Hermes (estratégia, análise do negócio e do
  mercado, concorrentes, oportunidades, ações recomendadas); oportunidades
  de conteúdo; resultados esperados **sempre rotulados como estimativa**
  (regra 5); plano de ação.
- **1 vídeo real por teste**, muito personalizado, a partir das fotos
  reais do cliente (regra 4), que ele pode ver e publicar (publicar no
  Instagram depende do App Review da Meta; até lá, download).
- **Depois do 1º vídeo:** outras oportunidades de vídeo aparecem como
  prévias borradas/travadas (foto real do cliente borrada + título,
  objetivo e formato recomendados pelo Hermes). Não abrem, não baixam, não
  publicam, e **nunca chamam a API de vídeo**. Não podem parecer vídeos já
  prontos — são "recomendados, prontos pra gerar".
- **Fim do teste:** relatório de 7 dias com contagens reais (sinais de
  mercado, movimentos de concorrentes, oportunidades de conteúdo, ações
  recomendadas, conteúdo preparado, oportunidades estratégicas) → oferta
  de R$1.449/mês.
- **Progressão:** Insight → Estratégia → Oportunidade → Prova → Desejo →
  Upgrade → Execução.

Hipóteses anteriores (mantidas como histórico):

- **(a)** Assinatura mensal fixa (ex. R$197–R$397/mês). Previsível, fácil
  de comunicar.
- **(b)** Mensal menor + % da receita recuperada. Alinha incentivos — mas
  esbarra no mesmo gap de medição de receita que
  [LEARNING.md](LEARNING.md) documenta (`revenue`/`cac`/`roas` ainda
  nulos).
- **(c)** Por uso / créditos de ação do agente. Flexível, porém
  imprevisível.

Custo de API por cliente: ~$0,20–$0,80/mês (Claude Sonnet) +
~$0,10–$0,30/mês (ElevenLabs). Absorver no preço é viável.

## Marca

- **Primary:** `#FF6D29` (laranja) · **Card BG:** `#150E08` · **Page BG:**
  `#0E0B0A` · **Muted:** `#BABABA` · **Font:** `'Bricolage Grotesque',
  system-ui, sans-serif`.
- Design dark, técnico, premium. Sem gradientes genéricos. Animações
  sutis.

**Nota (passo 3, parte A — 2026-10-02):** o gatilho do vídeo grátis ainda é
provisório; a tela mostra "em breve" + prévias travadas (foto real
borrada), e a prévia **não cita preço** até o passo 4 do 7-Day Growth
Preview. A trava de 1 vídeo por teste fica em `trial_video_claims`
(ver [MEDIA-ENGINE.md](MEDIA-ENGINE.md)).
