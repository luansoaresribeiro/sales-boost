# Pontos fortes do imóvel — como o sistema vai usar o que o imóvel tem de melhor

> **Status: APROVADO pelo dono em 22/11** ([DECISIONS](DECISIONS.md#2026-11-22--pontos-fortes-do-imóvel-c6-aprovados)):
> lista de marcas como está, IA por cômodo **não agora**, correção rápida (seção 5) primeiro. Item C6 da
> [PENDENCIAS.md](PENDENCIAS.md).

## Resumo (6 linhas)
1. Hoje o sistema **perde informação real**: vista, lazer, andar e vagas, que a A3 preenche, nunca chegam à legenda.
2. Proposta: uma lista de **pontos fortes para marcar** no cadastro do imóvel (e por cômodo), definida na ficha.
3. As marcas **decidem**: qual imóvel entra na semana, qual formato, qual foto abre, quais lugares perto aparecem.
4. Sem marca, tudo continua como hoje. Nada é afirmado que o corretor não marcou ou escreveu.
5. Custo: só a parte opcional "IA sugere pontos fortes de cada cômodo" tem custo (~US$ 0,02–0,05 por imóvel).
6. Você decide: a lista de marcas, se a IA por cômodo entra e se a correção rápida (item 5) pode ir na frente.

## 1. Para que serve (decisão, não só legenda)
O objetivo é a **visita**. Um imóvel vende pelo que tem de diferente; o sistema precisa saber o que é isso para:
- **escolher o imóvel da semana:** o imóvel com um diferencial que ainda não foi mostrado ganha a vez;
- **escolher o formato:** "perto do metrô" puxa "A pé daqui"; "vista" puxa "Por dentro" abrindo na vista;
- **escolher a foto de abertura:** o cômodo marcado como ponto forte abre o post (e o tour);
- **escolher os lugares perto:** um imóvel marcado "vida noturna" mostra restaurantes antes da escola;
- **escrever o gancho:** a primeira frase da legenda nasce do ponto forte, não de uma frase genérica.

Regra de sempre: **só dado real** (regra 5). Marca é o corretor dizendo "isto é verdade"; a IA pode sugerir, mas uma
sugestão só vira fato depois que o corretor confirma.

## 2. O que existe hoje (levantado em 22/11)
| Dado | Onde está | Custo | Usado hoje? |
|---|---|---|---|
| Tipo, bairro, venda/aluguel, preço, quartos, m² | cadastro do imóvel (obrigatórios, ficha `catalog_fields`) | 0 | sim, na legenda |
| Descrição do corretor | cadastro (opcional) | 0 | sim |
| **Vista, lazer, andar, vagas** | cadastro (opcionais, texto livre) | 0 | **não**: ficam fora da legenda (`catalog-package/index.ts:332`) |
| "Detalhe que ninguém percebe" | cadastro (opcional) | 0 | só no formato "O detalhe que você não viu" |
| Lugares perto (12 tipos) | mapa aberto (OpenStreetMap), `_shared/nearbyPlaces.ts` | 0 | sim, mas **sempre na mesma ordem** da ficha, para qualquer imóvel (`topPlaces`) |
| Cômodo e qualidade de cada foto | nota de foto (`photoScore`, já paga) | já pago | sim, para escolher foto e ordem do tour |
| Ambientes do imóvel | Frente 1, item 1.1 (`meta.spaces`) | já pago | só no tour |

**Quanto se preenche (SQL, 22/11):** A3: 7 imóveis, com vista em 5, lazer em 4, andar em 5, detalhe e descrição em 7.
Ou seja: o cliente real já informa os diferenciais, e o sistema hoje não usa a maior parte.

## 3. Lista proposta de pontos fortes (para você aprovar ou cortar)
Ficam na **ficha** (regra 6), com textos em português e inglês. No cadastro aparecem como caixinhas de marcar.

**Localização**
| Marca | Puxa estes lugares perto (já existem no mapa) | Formato que favorece |
|---|---|---|
| Perto da praia | praia | A pé daqui · 3 coisas perto |
| Perto do metrô | metrô | A pé daqui |
| Rua tranquila / perto da natureza | parque, praia | Por dentro (foto de varanda/janela) |
| Vida noturna e restaurantes | restaurante, cultura | Guia do bairro em 5 paradas |
| Escolas perto | escola | 3 coisas perto |
| Tudo a pé (mercado, padaria, farmácia) | mercado, padaria, farmácia | A pé daqui |

**Imóvel**
| Marca | Usa | Formato que favorece |
|---|---|---|
| Vista (mar / verde / cidade) | foto com vista abre o post | Por dentro · O detalhe que você não viu |
| Varanda | foto da varanda abre | Por dentro |
| Lazer completo | campo "lazer" entra na legenda | Por dentro |
| Andar alto | campo "andar" entra na legenda | O detalhe que você não viu |
| Reformado | gancho "pronto para morar" | Por dentro |
| Vaga(s) de garagem | campo "vagas" entra na legenda | Isso ou aquilo |
| Aceita pet | gancho | Pergunta de verdade |
| Sol da manhã | gancho + foto do cômodo | O detalhe que você não viu |

**Para quem é** (só tom e assunto; nunca escrever "ideal para famílias" ou rotular quem pode comprar: a trava de
texto público continua valendo)
| Marca | Muda |
|---|---|
| Morar | tom de rotina e bairro |
| Primeiro imóvel | Passo a passo sobre financiamento/documentos na mesma semana |
| Investir / alugar | tom de liquidez e procura, **sem número de retorno** |
| Temporada | lugares de lazer primeiro |
| Quem vem de fora | Guia do bairro e Passo a passo de compra à distância |

## 4. Pontos fortes de cada cômodo
- Para cada ambiente já identificado (sala, suíte, cozinha, varanda…), o corretor marca até 3 pontos fortes de uma
  lista curta da ficha (ex.: suíte com closet, cozinha integrada, varanda com vista, banheiro reformado, pé-direito alto,
  muita luz natural).
- **Opcional (com custo):** a IA de visão olha as fotos e **sugere** os pontos fortes de cada cômodo; o corretor
  confirma com um clique. Usa a mesma chamada de visão que já existe para as fotos, com perguntas a mais:
  ~US$ 0,02–0,05 por imóvel, uma vez só (estimativa; meço no primeiro teste). Sugestão não confirmada **não** é usada.
- **Uso:** a foto do cômodo marcado abre o post; a legenda cita o ponto forte com as palavras da marca; no tour, a
  parte que passa por esse cômodo ganha a frase.

## 5. Correção rápida (pode ir antes do resto?)
Levar **vista, lazer, andar, vagas e o detalhe** para a legenda do pacote do imóvel, como dado do corretor (sem
inventar nada). É pequena, sem custo novo de IA e não depende da lista de marcas. Recomendo fazer primeiro.

## 6. Como fica na tela
- **Cadastro do imóvel:** bloco novo "Pontos fortes", com as caixinhas dos 3 grupos e, abaixo, "Por cômodo" (os
  ambientes já identificados, cada um com suas opções). Tudo opcional.
- **Card do imóvel:** os pontos fortes marcados aparecem como selos.
- **EUA:** mesma estrutura na ficha `imoveis_us`, em inglês (ex.: "walk to the beach", "ocean view", "pet friendly").

## 7. Regras de segurança
- Sem marca = comportamento de hoje (nada muda para quem não preencher).
- Nunca afirmar um ponto forte que não foi marcado ou escrito pelo corretor; distância sempre "em linha reta".
- Marcas de "para quem é" nunca viram rótulo de público na legenda (Fair Housing nos EUA, trava de texto público no BR).
- Toda escolha feita por causa de uma marca fica anotada na peça ("escolhi abrir na varanda: ponto forte marcado").

## 8. Ordem de implementação (1 PR por item, cada um com teste)
| # | Item | Custo de IA | Pronto quando |
|---|---|---|---|
| 1 ✅ | Correção rápida (item 5) | 0 | legenda de imóvel da Teste Zero cita vista/lazer/andar/vagas do cadastro (feito 22/11) |
| 2 🧪 | Marcas na ficha + caixinhas no cadastro | 0 | marcar e salvar no imóvel (print celular e desktop). As marcas de localização e de imóvel também entram na legenda; "para quem é" não |
| 3 | Lugares perto na ordem das marcas | 0 | imóvel "vida noturna" mostra restaurante/cultura primeiro (teste + Teste Zero) |
| 4 | Marcas escolhem formato, foto de abertura e gancho | o mesmo de hoje | peça da Teste Zero com o motivo anotado |
| 5 | Pontos fortes por cômodo (manual) | 0 | marcar por cômodo e a foto certa abrir o post |
| 6 | IA sugere por cômodo (opcional) | ~US$ 0,02–0,05/imóvel | sugestão aparece e só vale depois de confirmada |

## 9. O que depende de você
1. **A lista de marcas** (seção 3): aprovar, cortar ou acrescentar.
2. **IA por cômodo** (seção 4): sim ou não. Recomendo **não agora**: começar manual (custo zero) e ligar a IA depois.
3. **Correção rápida** (seção 5): pode ir antes? Recomendo **sim**.
