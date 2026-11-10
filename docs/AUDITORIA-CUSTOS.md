# Auditoria de custos (Fase 1 do novo modelo) — v0, 10/11/2026

> **Por que existe:** o dono propôs uma plataforma grátis, com tour virtual pago (US$ 15) e cobrança por lead
> qualificado. Antes de decidir, precisamos saber **quanto custa manter uma imobiliária ativa**.
> **Escopo (decisão do dono, 10/11):** só **Claude (Anthropic)** e **Tavily** importam agora. Os outros custos
> (Supabase, Cloudflare, Vercel, Meta) ficaram de fora a pedido dele. O Higgsfield entra só no tour, que é pago
> pelo cliente antes.
> **Regra:** todo número tem fonte (medido, estimado ou painel do dono). A Liga dos Sonhos não foi consultada.
> **Versão v0:** feita no dia em que as funções novas (#127) entraram no ar. Refazer em 7 dias (17/11) com custo
> medido de verdade.

## 1. O que o dono mostrou (painéis, 09/11 à noite)

| Serviço | Dado | Fonte |
|---|---|---|
| Anthropic | Gasto em novembro (01 a 09/11): **US$ 3,92**, da organização inteira, todas as contas | painel do dono |
| Anthropic | Tokens nos últimos 7 dias: **626,2 mil** | painel do dono |
| Anthropic | Saldo: **US$ 8,29**, recarga automática **desligada** | painel do dono |
| Anthropic | Reaproveitamento de prompt (prompt caching): **desligado** | painel do dono |
| Tavily | Plano gratuito (1.000 créditos por mês): **122 usados** | painel do dono |
| Tavily | Cobrança por uso acima do limite: **desligada** | painel do dono |

## 2. O que o sistema registrou (01 a 09/11, contas de teste)

Medido no banco (`agent_performance` e `market_intel_runs`). São só as contas de teste Teste Zero e Tespon.

| O que roda | Quantas vezes | Custo registrado | Observação |
|---|---|---|---|
| Busca de notícias de mercado (Tavily) | 104 buscas | US$ 0,83 | Preço de tabela de US$ 0,008 por crédito. **Hoje sai de graça**, porque está dentro dos 1.000 créditos do plano. |
| Coleta diária de mercado | 1 por dia por conta: Teste Zero 4 buscas, Tespon 8 buscas | — | Desde 05/11 |
| Oportunidades (IA) | 21 rodadas, 71,9 mil tokens | não gravado | Cerca de 3,4 mil tokens por rodada. A rodada automática é a cada 6 h. |
| Estratégia (IA) | 12 chamadas | US$ 1,07 | **Estimativa fixa** gravada pelo sistema antigo (tokens = 0). Com o #127, passa a ser medido. |

## 3. Quem chama Claude e Tavily (lido no código, 10/11)

- **Tavily (3 lugares):**
  - coleta de notícias de mercado (`_shared/marketNewsRun.ts`): 1 crédito por busca;
  - conferência de dicas com fonte oficial (`_shared/faqCheck.ts`): 2 créditos por busca;
  - `insights-collect`: 1 crédito por busca.
- **Claude:** 32 funções chamam a IA, mais 5 módulos compartilhados.
- **Agendamentos que podem gastar IA para cada conta:**

  | Agendamento | Frequência |
  |---|---|
  | estratégia | todo dia, 09:00 UTC |
  | oportunidades | **a cada 6 h (4 vezes por dia)** |
  | `marketing-ai` | todo dia, 15:00 UTC |
  | teste diário de peças | 13:00 UTC |
  | `detect-opportunities` | todo dia |
  | `generate-tab-insight` | todo dia |
  | `hermes-daily-scan` | todo dia |
  | `monitor-web-mentions` | todo dia |
  | `find-sales-leads` | toda noite |
  | plano semanal | domingo |
  | `creative-ideas`, `brand-kit-suggest` | semanal |
  | `map-competitors`, `monitor-competitor-social` | semanal |
  | relatórios | semanal e mensal |

  Muitos desses pulam contas sem configuração. Quanto cada um gasta por conta é o que a medição de 17/11 vai mostrar.

## 4. Custo por imobiliária por mês (estimativa v0)

| Item | Valor | Como chegou |
|---|---|---|
| Claude, **teto** por conta testada intensamente | **≤ US$ 6,50 por mês** | US$ 3,92 ÷ 9 dias × 30 ÷ 2 contas. Supõe que todo o gasto da organização veio das 2 contas de teste, o que exagera para cima. Inclui testes manuais (A.6). |
| Tavily por conta | **120 a 240 créditos por mês** | 4 a 8 buscas por dia × 30 |
| Tavily, em dinheiro | **US$ 0 até cerca de 4 a 8 contas**. Acima disso, **US$ 0,96 a 1,92 por conta por mês** | Plano gratuito de 1.000 créditos. Depois, US$ 0,008 por crédito ([preços da Tavily](https://docs.tavily.com/documentation/api-credits.md); planos mensais de US$ 0,0075 a 0,005 por crédito). |
| **Total por conta (teto)** | **≤ cerca de US$ 8,50 por mês** | Claude + Tavily acima do plano gratuito |
| Custo de adicionar mais uma conta | ≈ o mesmo valor | Sem custo fixo nos 2 serviços: tudo é por uso |

**O que esse número ainda não diz:**
- quanto custa uma conta **parada**: os agendamentos rodam mesmo sem ninguém usar;
- a diferença entre uso normal e uso intenso.

Os dois saem da medição de 17/11.

## 5. Riscos encontrados

1. **A IA pode parar por falta de saldo.** São US$ 8,29 com recarga automática desligada: no ritmo atual, dura cerca de 2 a 3 semanas. Isso já aconteceu em 04/11.
   - **Ação do dono:** ligar a recarga automática com um teto mensal no painel da Anthropic.
2. **O plano gratuito da Tavily trava** quando passar de 1.000 créditos no mês, porque a cobrança por uso está desligada. As buscas param e a inteligência de mercado fica sem notícia nova.
   - Com 4 a 8 contas ativas o limite é atingido.

## 6. Onde dá para economizar, sem tirar inteligência

| Corte | Economia esperada | Esforço |
|---|---|---|
| Ligar o reaproveitamento de prompt (prompt caching) nas chamadas grandes (estratégia, oportunidades, legendas) | Parte das instruções fixas de cada chamada deixa de ser cobrada inteira | Médio: código |
| Oportunidades: de 4 vezes por dia para 1 vez por dia, ou só quando houver notícia nova (a coleta já sabe quando nada mudou: `unchanged` e `fingerprint`) | Até 3/4 das chamadas de oportunidade | Pequeno |
| Conta sem uso há X dias não roda os agendamentos diários de IA | Custo de conta parada perto de zero | Pequeno |
| Usar o modelo mais barato (Haiku) em tarefas simples (classificação, resumo curto) | Muitas vezes mais barato por chamada | Médio, com teste de qualidade |

Cada corte é uma mudança de produto e precisa de aprovação.

## 7. Próximos passos

1. **17/11:** refazer com custo medido por função e por conta (`ai_text_*` em `agent_performance`, do #127), separando conta parada e conta em uso.
2. **Fase 2:** simular 10, 50, 100 e 500 imobiliárias com os números de 17/11, mais as hipóteses de receita do dono (tour e lead).
