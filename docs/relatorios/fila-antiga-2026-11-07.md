# Relatório da fila antiga de oportunidades — 07/11/2026 (etapa 1.2, só leitura)

> Lido no banco em 07/11/2026, por SQL só de leitura, em `growth_opportunities` com `status = 'suggested'`. As contas são a Teste Zero (`277305ff…`) e a Tespon (`f8f602ee…`).
> **Esta é uma foto do estado em 07/11, não é definitiva.** A fila ainda cresce até a Correção 3 ser publicada, então antes de qualquer limpeza o estado é lido de novo.
> **Nada foi marcado, descartado nem apagado.** A limpeza só acontece com a 2ª autorização do dono.
> Liga dos Sonhos: não foi lida.

## Resumo
| Conta | Em aberto | Inválidas (regras antigas) | Só repetidas | Ficam |
|---|---|---|---|---|
| Teste Zero | 9 | 8 | 0 | 1 |
| Tespon | 22 | 17 | 1 | 4 |

- **A fila continua crescendo.** Em 07/11, às 00:17 UTC (06/11, às 21:17 em Brasília), a rodada automática ainda usou a `marketing-ai` antiga, que é anterior à Correção 3. Ela criou mais 2 linhas na Tespon, e isso se repete até a etapa 1.3 publicar a função nova.
- **Critério:**
  - "inválida" quer dizer que fere uma regra criada depois que a oportunidade nasceu (período inventado, ausência sem prova, só sinal fraco, ação vazia, centrada na fila de peças);
  - "só repetida" é válida, mas existe outra igual e mais nova;
  - "fica" é a mais nova e válida de cada grupo.

## Teste Zero — 9 (todas sobre os mesmos 2 imóveis do Leblon)
| id | tipo | criada | Proposta | Motivo |
|---|---|---|---|---|
| `374d5820` | mercado | 05/11 | **fica** | Sinal forte (compra do terreno pela Amplitude no Leblon) e ação concreta. A frase "peças aguardando publicação" da descrição sai na próxima rodada (Correção 2). |
| `a4028740` | sem post | 02/11 | arquivar | "Últimos 60 dias" inventado: os imóveis tinham 3 dias. Também diz "invisíveis" e "parados". |
| `c8d39183` | sem post | 03/11 | arquivar | "60 dias" inventado e "invisíveis". |
| `fc9932e6` | sem post | 04/11 | arquivar | "Há mais de 60 dias" inventado e "invisíveis". |
| `404c41ee` | mercado | 02/11 | arquivar | Afirma "nenhum post" e "fora do campo de visão" sem prova. |
| `a2893bfc` | mercado | 03/11 | arquivar | Os "sinais" são páginas de anúncio, de termos de uso e de exposição, hoje bloqueadas. |
| `923f412b` | mercado | 04/11 | arquivar | Ação vazia ("Registre no Sales Boost após aprovação.") e sinal patrocinado. |
| `feede5fe` | mercado | 05/11 | arquivar | Centrada em "aprovar as peças prontas", que é a fila de Aprovações. |
| `191a5163` | mercado | 06/11 | arquivar | "Parados", "sem presença nas redes" e "invisíveis" com o Instagram desconectado (Correção 3). |

## Tespon — 22
**Ficam (4):**
| id | tipo | Grupo | Observação |
|---|---|---|---|
| `a3e24c6a` | sem post | Ipanema (2 imóveis) | Ação: adicionar fotos. |
| `bf3aa33b` | sem post | Barra (2 imóveis) | Ação: adicionar fotos. A frase "ficam invisíveis" seria barrada pela Correção 3. |
| `88e91493` | sem post | Botafogo (1 imóvel) | Ação: adicionar fotos. |
| `39ce9c38` | mercado | Barra (2 imóveis) | Tem um sinal forte, o lançamento Claris da Tegra, junto de sinais fracos. Ação: adicionar fotos. |

**Só repetida (1):** `d1cc0084`, Ipanema. É uma versão mais antiga da `a3e24c6a`.

**Inválidas (17):**
| id | Grupo | Motivo |
|---|---|---|
| `c3300476`, `036707a7`, `8ce53747` | Ipanema, sem post | "60 dias" inventado |
| `6d87315b`, `205b59b3`, `d4633dec`, `dba5dac0` | Barra, sem post | "60 dias" inventado e, em algumas, "parados" ou "invisíveis" |
| `131fb348` | Barra, sem post | "Parados" no título |
| `c396cbdb`, `d18dcdf4` | Leblon, sem post | "60 dias" inventado |
| `1968e92f` | Ipanema, mercado | Só sinais fracos: patrocinado e horário de metrô no fim de semana |
| `847891b2`, `13d7538a` | Barra, mercado | Só sinais fracos ou páginas de anúncio |
| `5d108c57` | Barra, mercado | Só sinais fracos: horário de metrô, quiosque em 2 sites e guia de bairro |
| `118743de` | Copacabana, mercado | Evento de turismo e página de anúncio |
| `063f8ab7`, `e91e1502` | Botafogo, mercado | Páginas de anúncio e post de rede social |

## Decisão pendente do dono (antes de qualquer limpeza)
Com a Correção 3 publicada, as 3 tarefas de "adicionar fotos" que ficam (Ipanema, Barra e Botafogo) viram **1 tarefa com os 5 imóveis**. Como o grupo de imóveis muda, essa tarefa única **não** se junta às 3 antigas, e elas continuariam abertas ao lado dela. As opções:
- **(a)** manter as 3 antigas;
- **(b)** arquivá-las também e deixar a próxima rodada criar a tarefa única.

O agente recomenda a **(b)**.

**Como a limpeza seria feita, se autorizada (só DEPOIS de publicar a Correção 3 e validar uma rodada nova):**
- `status = 'dismissed'`, só pelos ids desta lista e com `company_id` conferido;
- nada é apagado;
- conferência por SQL antes e depois.
