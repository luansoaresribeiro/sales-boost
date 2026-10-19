# Sales Boost — Produto

> Lido por todo agente antes de trabalhar em qualquer coisa que toque decisão
> de produto, conteúdo ou posicionamento. Decisões com data ficam em
> [DECISIONS.md](DECISIONS.md); aqui fica o estado atual, não o histórico.

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
- Decisor: o próprio dono, decisão rápida.

## Diferenciais competitivos

1. **Jarvis fala com você** — assistente de voz IA que executa tarefas de
   marketing por comando de voz, em português (ver seção Jarvis em
   [ARCHITECTURE.md](ARCHITECTURE.md) — fora do escopo dos docs 1-11 desta
   reorganização, mas é parte real e ativa do produto).
2. Conhece o cliente com dados reais da internet (Apify) — varre reviews,
   redes e Maps.
3. Diagnóstico de site grátis — porta de entrada / isca de lead qualificado.
4. Um agente que EXECUTA, não só mostra relatório — em PT-BR, preço em R$.
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

## Modelo de cobrança — DECIDIDO (2026-10-02)

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
