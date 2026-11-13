# Auditoria de custos (Fase 1 do novo modelo) — v0.1, 10/11/2026

> **Por que existe.** O dono propôs uma plataforma grátis, com tour virtual pago (US$ 15 — **hipótese**, não decisão; ver [Decisões em vigor](DECISIONS.md#decisões-em-vigor)) e cobrança por lead qualificado.
> Antes de decidir, precisamos saber quanto custa manter uma imobiliária ativa e, principalmente, **quanto custa
> cada resultado comercial** (oportunidade, estratégia, post, tour, lead).
>
> **Escopo (dono, 10/11).** Só **Claude (Anthropic)** e **Tavily**. O Higgsfield entra só no tour, que o cliente paga antes.
>
> **Regras.**
> - Todo número diz de onde veio: **[painel]** do dono, **[medido]** no banco ou **[estimado]**.
> - Nenhum número aqui é **comprovado** como custo por imobiliária.
> - A Liga dos Sonhos não foi consultada.
>
> **v0.1** corrige a v0 (revisão do dono, 10/11). A **v1 sai em 17/11**, com custo **medido** por função (as funções do #127, que gravam o custo real, entraram no ar em 10/11).

## 1. Dados de partida

| Dado | Valor | Fonte |
|---|---|---|
| Anthropic: gasto em novembro (01 a 09/11), organização inteira, **desenvolvimento + operação + todas as contas** | US$ 3,92 | [painel] |
| Anthropic: tokens nos últimos 7 dias | 626,2 mil | [painel] |
| Anthropic: saldo / recarga automática | US$ 8,29 / desligada | [painel] |
| Anthropic: reaproveitamento de prompt (prompt caching) | não usado | [painel] |
| Tavily: plano gratuito, 1.000 créditos por mês | 122 usados, cobrança por uso desligada | [painel] |
| Contas ativas (fora a Liga dos Sonhos) | 5: 4 de imóveis + 1 genérica | [medido] |

## 2. Desenvolvimento × operação (o que dá para separar hoje)

**O que o painel não separa.** Os US$ 3,92 da Anthropic misturam três coisas:
- os testes manuais (por exemplo, o teste do agente de conteúdo em 07/11);
- o uso automático das contas;
- a conta da Liga.

O painel não separa isso, e a v0 errou ao dividir esse total por 2 contas. **Esse cálculo saiu do relatório.**

**O que o banco registra por tarefa** (contas de teste, 01 a 09/11):

| Tarefa | Tipo | Execuções | Consumo | Custo | Fonte |
|---|---|---|---|---|---|
| Busca de notícias (Tavily) | operação (1 vez por dia) | 104 buscas | 104 créditos | US$ 0 no plano grátis (US$ 0,83 a preço de tabela) | [medido] |
| Leitura do mercado → oportunidades (Claude) | operação | 13 leituras com IA (04 a 09/11), 1 "nada mudou" (sem IA), 2 falhas sem custo | 52,0 mil tokens | não gravado pelo sistema antigo | [medido] tokens (`market_intel_runs`) |
| Estratégia (Claude) | operação + testes | 12 chamadas | — | US$ 1,07 era um valor **fixo**, não medido | [estimado pelo sistema antigo] |
| Peças de conteúdo (Claude) | operação + testes | — | não registrado antes de 10/11 | — | — |

**A partir de 10/11:**
- cada chamada de estratégia e de peça grava tokens e dólares reais (`agent_performance`);
- a v1 vai separar tarefa automática de teste manual (pela origem da chamada: agendamento × clique).

## 3. Custo por resultado comercial (o indicador principal)

| Resultado | Custo hoje | Fonte | Quando fecha |
|---|---|---|---|
| **1 oportunidade identificada** | ≈ 2,7 mil tokens (52,0 mil ÷ 19 oportunidades aceitas nas mesmas leituras). Isso dá **US$ 0,008 a 0,041**: o menor valor supõe tudo como entrada (US$ 3 por milhão), o maior supõe tudo como saída (US$ 15 por milhão). | [medido] tokens · [estimado] dólares | 17/11, com dólares medidos |
| **1 estratégia** | não medido (o valor antigo era fixo) | — | 17/11 |
| **1 post ou carrossel** | não medido | — | 17/11 |
| **1 tour virtual** | não medido (créditos do Higgsfield por vídeo) | — | quando houver o 1º tour pago |
| **1 lead qualificado** | **não existe ainda**: não há leads nem rastreio completo | — | depois da camada de aquisição (Fase 4) |
| **Pesquisa de mercado por região** | 1 crédito Tavily por busca (US$ 0 até 1.000 por mês; depois US$ 0,005 a 0,008) | [medido] + [preços Tavily](https://docs.tavily.com/documentation/api-credits.md) | — |

## 4. Como o sistema já roda (lido no código, 10/11)

Isto corrige uma hipótese da revisão: **duas das economias pedidas já existem.**

- **Pesquisa de mercado (Tavily) já roda 1 vez por dia por conta** (09:43 UTC). Teste Zero faz 4 buscas por dia e Tespon faz 8.
- **Oportunidades:** o agendamento de 6 em 6 h **só confere**, não chama a IA. A IA só roda quando:
  - chegou notícia nova depois da última leitura; e
  - passaram 24 h desde a última leitura.

  Se os dados forem iguais aos da leitura anterior, a IA também não é chamada (o sistema marca "nada mudou").
  - Arquivos: `_shared/opportunityCron.ts` (`shouldRunOpportunities`) e `_shared/opportunityRun.ts` (`fingerprint`).
  - Na prática: no máximo 1 leitura de IA por dia por conta.
- **Estratégia:** o agendamento diário só despacha. Os gastos reais acontecem no check-up semanal, na atualização mensal e no clique do dono, com teto mensal de chamadas automáticas.

**Consequência:** passar de "4 vezes por dia" para "1 vez por dia" **não economiza crédito Tavily**, porque a pesquisa já é diária.

**A economia real de Tavily** está em **compartilhar a pesquisa entre imobiliárias da mesma região.** As buscas são montadas por tema × bairro × cidade, a partir da ficha, sem nada de uma imobiliária específica. Duas imobiliárias com imóveis no Leblon fazem hoje a mesma busca 2 vezes.

## 5. Estrutura da simulação (Fase 2; preencher com a v1)

`custo mensal = N × custo de uma conta (por perfil) + créditos Tavily acima do plano × preço por crédito`

**Créditos Tavily:**
- **sem compartilhar:** N × buscas por conta × 30;
- **compartilhando:** número de regiões distintas × temas × 30.

| Perfil (hipótese a validar) | O que mais pesa no custo |
|---|---|
| Pequena: 2 corretores, poucos imóveis, pouco uso | agendamentos diários (custo de conta "parada") |
| Média: 5 a 10 corretores, uso regular | peças e estratégia |
| Grande: 20+ corretores, uso intenso | peças, regiões de pesquisa e leads |

O número de corretores não pesa direto. O que pesa é **quantos imóveis, quantas regiões e quantas peças** a imobiliária tem.

| Imobiliárias | Claude | Tavily (sem / com compartilhamento) | Total |
|---|---|---|---|
| 10 | v1 | v1 | v1 |
| 50 | v1 | v1 | v1 |
| 100 | v1 | v1 | v1 |
| 500 | v1 | v1 | v1 |

**Referência (não usar como custo real):** a v0 chegou a um teto de US$ 8,50 por conta por mês. Esse valor foi calculado do jeito errado (seção 2) e fica só como ordem de grandeza até a v1.

## 6. Riscos

1. **A IA pode parar por falta de saldo.** São US$ 8,29, com recarga automática desligada (cerca de 19 dias no ritmo atual). Já aconteceu em 04/11.
   - **Decisão do dono (10/11):** não ligar recarga automática sem antes ter **limite de gasto e alerta**.
2. **A Tavily trava ao passar de 1.000 créditos no mês** (cobrança por uso desligada). Com o ritmo atual, isso acontece entre 4 e 8 contas. O compartilhamento por região adia esse limite.

## 7. Otimizações (aprovadas pelo dono em 10/11, com comparação de qualidade antes e depois)

1. **Reaproveitamento de prompt** nas partes fixas das instruções.
   - O Claude só reaproveita um trecho de pelo menos 1.024 tokens (Sonnet 4.6) e por até 5 minutos.
   - Por isso, vale onde o mesmo trecho se repete em sequência: as 3 etapas da estratégia, as peças da semana de uma conta, e várias contas na mesma rodada.
2. **Pesquisa de mercado compartilhada por região e dia**, só com notícia pública. Nada de uma imobiliária passa para outra.
3. **Medição:** gravar separados os tokens normais, os reaproveitados e os de criação do reaproveitamento, e o custo em dólar também das oportunidades (hoje grava só os tokens).

O que já existe (seção 4) não muda. As 5 perguntas de validação das oportunidades e as regras de aprovação ficam iguais.
