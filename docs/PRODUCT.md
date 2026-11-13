# Sales Boost — Produto

> Lido por todo agente antes de trabalhar em qualquer coisa que toque decisão
> de produto, conteúdo ou posicionamento. Decisões com data ficam em
> [DECISIONS.md](DECISIONS.md); aqui fica o estado atual, não o histórico.

## Estado atual em uma tela (atualizado 2026-11-13, com as decisões do dono do mesmo dia)

> Resumo do que vale HOJE. O resumo de 02/11 e as seções antigas estão no [histórico](historico/PRODUCT-ate-2026-11-12.md).
> Decisões tema a tema: [Decisões em vigor](DECISIONS.md#decisões-em-vigor).

- **Quem somos (operacional):** **sistema de inteligência e geração de demanda comercial para imobiliárias.** A medida
  de sucesso é **visita ao imóvel**, não quantidade de posts.
- **Posicionamento comercial (só no site e no pitch):** "Technology Partner for Real Estate". Não substitui a definição
  operacional.
- **Slogan:** "Sales Boost — gerando mais visitas para o seu imóvel". Visita garantida nunca é prometida.
- **Mercado:** **Brasil agora** (principalmente o Rio de Janeiro, em português). EUA depois, só com a revisão jurídica.
  A ficha dos EUA fica sem comercialização.
- **Modelo de negócio em validação (NADA de preço decidido):**
  - plataforma grátis;
  - **tour virtual pago**: US$ 15 por tour é **hipótese**, e um imóvel grande custa ~US$ 14 (estimado);
  - **lead qualificado**: sem preço até haver definição e medição ([CONVERSION.md](CONVERSION.md));
  - **Boosts: em aberto.** Não confundir com o preço do tour; a unidade comercial é validada nas conversas;
  - **anúncios pagos (impulsionar publicação): fora do modelo atual.**
- **Prioridade:**
  - **estratégica:** construir o sistema de inteligência e geração de demanda;
  - **validação comercial:** sem prazo e sem bloquear trabalho técnico; bloqueia só preço do tour, Boosts, preço de lead e Fase 4 (13/11, tarde);
  - **do produto (D1 aprovado em 13/11):** 4 frentes; desde 13/11 (tarde), a **Frente de conteúdo** corre em paralelo com a Frente 1:
    1. **Tour Virtual do imóvel INTEIRO**: sem inventar passagem, sem omitir cômodo, e se faltar foto o sistema diz qual;
    2. **motor próprio de vídeo**: sair da dependência da VPS;
    3. **infraestrutura**: substituir e só então desligar VPS e Telegram;
    4. **experiência do usuário**.
  - O detalhe está em [PLANO-TOUR-COMPLETO.md](PLANO-TOUR-COMPLETO.md) e o que falta em [PENDENCIAS.md](PENDENCIAS.md).
- **O que existe hoje:**
  - **Tour virtual:** contínuo e sem cortes, mas cobre só parte do imóvel (8 de 22 ambientes no teste da Tespon).
  - **Painel:** mostra o resultado comercial (visualizações → interessados → leads recebidos → visitas).
  - **Agente de conteúdo:** só com foto; cuida só dos posts e da estratégia editorial. **Regra nova (13/11): exatamente 1 post por dia** no plano automático (ainda não implementada, item C1). O tour é um **produto à parte**.
  - **Aprovação humana** antes de publicar; CRECI obrigatório para publicar.
- **Ainda não existe (não prometer):** tour do imóvel inteiro, agendamento de visita, lead "qualificado", cobrança
  por tour ou por lead, Boosts, anúncio pago, avatar, mobiliamento em vídeo.

## Verticalização (regra central)

Mesma infraestrutura pra todo setor; setor = **ficha**
(`vertical_playbooks`, dado/config em jsonb — nunca código específico de
setor). Teste de sanidade pra qualquer mudança: *"se eu trocar imóvel por
procedimento estético, preciso mudar código? Se sim, está errado — vira
ficha."*

> **Substituído em 13/11:** mercado = **Brasil agora, EUA depois** (ver o "Estado atual"). Texto de 27/10 mantido como registro:
> **Divergência (2026-10-27):** o dono decidiu vender para os **EUA inteiros**, com o **inglês como idioma
> principal** (os brasileiros atuais seguem em PT). Os trechos abaixo sobre Rio de Janeiro, PT-BR e R$ ficam como
> estado do piloto atual — ver [DECISIONS.md](historico/DECISIONS-2026-09-a-10.md#2026-10-27--inglês-como-idioma-principal-mercado-eua-inteiro).
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

## Conta dos Boosts — EM ABERTO, só documento (2026-11-12; status confirmado pelo dono em 13/11)

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

> **Atualização (2026-11-13):** com a regra nova do dono (tour = imóvel **inteiro**), a conta muda.
> - Um imóvel grande como a Tespon (22 ambientes) precisa de cerca de 23 caminhadas, ou seja, **~US$ 14 de custo com
>   reserva** (estimado; [PLANO-TOUR-COMPLETO.md](PLANO-TOUR-COMPLETO.md), seção 9).
> - Os US$ 15 por tour usados como hipótese no piloto **quase não deixam margem** em imóvel grande.
> - O preço precisa variar com o tamanho do imóvel: por Boost, ou por faixa de ambientes. **Decisão do dono.**

**O que falta antes de decidir:**
1. Fechar o gate técnico do tour (agora: imóvel inteiro).
2. Medir a média real de trechos refeitos, para trocar a reserva de 20% por número.
3. Somar estúdio, Stripe e câmbio (faturas do dono).
4. As conversas com imobiliárias: quantos tours por mês e quanto pagariam.

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

## Histórico

Seções antigas movidas para [historico/PRODUCT-ate-2026-11-12.md](historico/PRODUCT-ate-2026-11-12.md):
- Estado atual em uma tela (2026-11-02) — HISTÓRICO, substituído em 13/11
- Quem somos (texto do dono, 2026-10-12)
- Posicionamento
- O diagnóstico grátis: Social Selling no centro (2026-10-19)
- Escada de ofertas
- Público-alvo (visão de mercado, além do ICP da ficha ativa)
- Diferenciais competitivos
- Concorrentes (referência)
- Modelo de cobrança — DECIDIDO (2026-10-02)
