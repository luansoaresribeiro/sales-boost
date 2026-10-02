# Sales Boost — Produto

> Lido por todo agente antes de trabalhar em qualquer coisa que toque decisão
> de produto, conteúdo ou posicionamento. Decisões com data ficam em
> [DECISIONS.md](DECISIONS.md); aqui fica o estado atual, não o histórico.

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
