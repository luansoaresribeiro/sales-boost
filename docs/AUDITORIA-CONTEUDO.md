# Auditoria estratégica do agente de conteúdo (23/11/2026)

> **Status: APROVADA pelo dono em 23/11** ("tudo sim"): conteúdo para proprietários, organização por objetivo comercial
> e as etapas 1 a 3 dentro do C3. Decisão em [DECISIONS](DECISIONS.md#2026-11-23-4--auditoria-do-conteúdo-aprovada-objetivo-comercial-proprietários-e-c3-ampliado);
> itens C7 a C11 na [PENDENCIAS](PENDENCIAS.md#frente-de-conteúdo-aberta-em-1311-em-paralelo-com-a-frente-1).
> Versão em página: https://claude.ai/artifact/2tpV325PPbezVp2oNYX5x5 (privada).
>
> **Base:** código do gerador (`creative-generate`, `catalog-package`, `_shared/deckSlides.ts`, `deckTopic.ts`,
> `carouselOffer.ts`, `slideSystem.ts`), ficha `imoveis_rio`, biblioteca global (`marketing_ai_knowledge`, migration 043)
> e **116 peças reais** da Teste Zero e da Tespon (`marketing_ai_test_content`, 45 dias, só leitura). Liga dos Sonhos e A3
> não foram lidas.

## Resumo (6 linhas)
1. Hoje o sistema produz **posts seguros**, não ferramentas de aquisição. As travas de verdade são boas.
2. Quando uma trava barra um dado, o sistema **preenche com frase vazia** em vez de trocar de ângulo.
3. **57%** das peças do dia a dia são educativas (custos, documentação, financiamento); **~60%** terminam em "Me chama no direct".
4. O carrossel do imóvel mostra a ficha técnica na capa; o motivo para visitar fica na legenda.
5. **Zero** peças para proprietários e zero de confiança (bastidor, corretor, negócio fechado).
6. Quase tudo que falta já tem peça no sistema (pontos fortes, memória de ângulos, lugares perto, sinais com fonte). O
   trabalho é de direção e regra.

**Como contei:** das 116 peças, 30 são vídeos de teste do tour (Frente 1). Das 86 restantes, 49 têm família ou pilar
educativo. CTA: 69 de 116 começam com "Me chama no direct". **Ressalva:** as contas de teste têm poucos imóveis (o mesmo
apartamento do Leblon aparece 6 vezes), o que empurra o mix para o educativo; os problemas abaixo aparecem no código, não só
nos dados. **Zero peças publicadas**: a auditoria é de critério profissional, não de resultado medido.

## 1. Como funciona hoje
1. A **estratégia** (`strategy-generate`) escreve a linha central e o mix semanal a partir do catálogo da ficha. A linha da
   Teste Zero é boa ("conhece Leblon, Ipanema e Copacabana por dentro").
2. O **calendário** espalha 7 vagas e reserva um tema por vaga (`weekThemes.ts`).
3. Cada vaga vai para o **post solto** (`creative-generate`: "Diretor Criativo" escolhe objetivo, template, personalidade,
   framework e gancho da biblioteca; "Copywriter" escreve) ou para o **pacote do imóvel** (`catalog-package`, receitas fixas
   com fotos reais).
4. Travas em código: número sem fonte, tema regulado sem dica conferida, rótulo de público, QUERO sem automação, tema repetido.
5. A nota de qualidade decide se vai para aprovação.

### Formatos que existem de fato
| Formato | Papel real | Diagnóstico |
|---|---|---|
| Carrossel do imóvel ("Por dentro") | considerar → visitar | Capa "tipo + bairro + quartos + preço", 4 fotos **sem texto** (`slideSystem.ts`, layout `foto`), slide de dados, fecho que repete o título. Informa, não convence |
| "O detalhe que você não viu" | considerar | Bom. Sem o campo "detalhe", o prompt manda falar de "iluminação, silêncio, vista" genéricos |
| "3 coisas perto" | considerar | Dado real, saída crua ("Restaurante · Kurt · Cultura · Teatro do Leblon", "no bairro" sem distância). Quase igual ao "A pé daqui" do C2 |
| "O que R$X compra" | considerar → decidir | Mais intenção de compra do catálogo; pouco usado (precisa de vários imóveis na faixa) |
| Carrossel educativo | descobrir / confiar | Virou o padrão. Tema regulado sem dica → texto fixo vazio (seção 2) |
| Dica / FAQ | confiar | Compete com o educativo pelo mesmo assunto |
| Cards de template (tweet, problem, trend, faq) | indefinido | Sistema genérico multissetor. "trend" pede tendência sem fonte; "problem" pede citação de dor entre aspas (caminho para depoimento inventado) |
| "Comente QUERO" | decidir visitar | É **mecanismo de CTA**, não tipo de post; ocupa vaga do mix |
| Vídeos de 5–6 s | considerar | Custam e não entram no plano; são ativo do tour |
| Stories, POV, Vendido!, avatar | confiar | Nunca produzidos ("precisa de material"/"planejado"). Pilar de marca pessoal (10%) vazio |

### Organização: cinco classificações, nenhuma de objetivo
Pilar da ficha · família · pilar de Social Selling · momento (C2) · funil (auditoria 22/11). Nenhuma responde "o que esta
peça deve fazer alguém fazer?". Nos dados o pilar aparece como "educacao", "Educação do comprador", "Imóveis", "imoveis",
"tour" e vazio. **Pilar fantasma:** mercado tem 20% do peso sem fonte de dado; os ganchos de mercado da ficha ("os preços
no Rio estão caindo?", "comparação de preço entre bairros") pedem o número que a regra 5 proíbe.

## 2. Qualidade comercial
**2.1 Travas viram enchimento (geração).** O modo "geral" (`deckTopic.ts`, `generalFallbackDeck`/`generalFallbackCaption`)
chegou a peças reais: "Cada caso tem as suas particularidades." e "Antes de decidir, confira as regras com quem entende e em
fonte oficial." (a mesma frase duas vezes no carrossel de procuração, 22/11); uma legenda inteira só com o texto fixo;
capas "Financiamento: o que saber? — Deslize pra ver" e "Uma dica rápida: o que saber?". É anti-autoridade: o comprador
conclui que o corretor não sabe a resposta. **Regra certa: sem fato liberado, troca de assunto ou de formato.**

**2.2 Educativo demais e repetido (conteúdo).** Dos 29 educativos de 30 dias: ~8 custos/ITBI, ~8 documentação/contrato,
~6 financiamento; ~metade com o recorte "quem compra de fora do Rio". A trava pega a frase, não o assunto em semanas seguidas.

**2.3 O imóvel aparece, mas não é vendido (conteúdo).** Capa = ficha; o diferencial ("vista parcial para o mar", "duas
quadras da praia") só na legenda; preço e título repetidos. Pontos fortes (C6) e memória de ângulos (etapa C) ainda não
chegam à capa nem à ordem dos slides.

**2.4 Um só próximo passo.** "Me chama no direct" em ~60%. Faltam passos de baixo esforço (A ou B, palavra com entrega
real, enquete, salvar para a visita, pedir a ficha).

**2.5 Funções comerciais**
| Função | Situação |
|---|---|
| Interesse do comprador | parcial: imóvel sem argumento na capa |
| **Atrair proprietário** | **inexistente** |
| Gerar conversa | fraco: CTA único |
| Autoridade local | fraco: educativo nacional; "O que mudou no bairro" não construído |
| Diferenciação | fraco: falha no teste da troca de logo |
| Desejo | fraco: rotina e entorno na legenda |
| Incentivo à visita | fraco: nenhum convite concreto |
| Confiança no corretor | inexistente |

**Achado de regra:** slide "Na minha experiência — Quem vem de fora… fecha com muito mais tranquilidade" (22/11): experiência
atribuída ao corretor que ninguém informou. A `HONESTY_RULE` não pega primeira pessoa experiencial.

## 3. Ângulos
O sistema varia palavras, não perspectivas. A capa gira por contagem entre promessa/pergunta/erro (`pickCoverStyle`), não
pelo objetivo ("O erro que faz você visitar imóvel sem estar pronto"). Saturados: custos/burocracia, "comprar de fora".
Ausentes: custo real de morar (condomínio + IPTU do cadastro), comparação entre imóveis, objeção do imóvel, escassez real
(mudança de preço), notícia do bairro, proprietário, bastidores, rotina.

## 4. Carrosséis
Duas fórmulas fixas, nenhuma muda com o objetivo: educativo (`deckSlides.ts`: capa → lista/passos/comparação/destaque →
fecho; só garante não repetir 3 layouts) e imóvel (`carouselOffer.ts`: capa-ficha → 4 fotos → dados → fecho). Progressão
fraca (slides do meio trocáveis), curiosidade prometida e não entregue, fecho genérico. **Contradição no prompt:** o post
solto pede carrossel que "conta uma história, preparação → durante → resultado" e logo depois as regras de capa/lista/fecho.

## 5. Posicionamento
**Teste da troca de logo:** trocando o logo da Teste Zero pelo de uma imobiliária de Curitiba, quase todo educativo continua
verdadeiro. A estratégia promete "conhecer os bairros por dentro"; a execução não segue. Falta: **território** (bairros +
tipo + faixa, já no cadastro), **dados próprios** (catálogo, perguntas recebidas, visitas: dado real permitido), **rosto**
(o corretor nunca aparece) e **opinião com fundamento** ("para quem este imóvel faz sentido"). O agente também não usa as
oportunidades que o próprio sistema identifica (sinais, pouca tração, demanda), o que contradiz o [SALES-BOOST](SALES-BOOST.md).

## 6. Problemas por prioridade
Etiquetas: **[C]** conteúdo · **[O]** organização · **[G]** geração.

| P | # | Problema | Correção |
|---|---|---|---|
| P0 | 1 | [G] Texto fixo vazio publicado | Sem dica liberada, a vaga troca de assunto/formato; texto fixo nunca vira peça |
| P0 | 2 | [C][G] Educativo domina e repete assunto | Teto de 2/semana em código + trava de **assunto** por 3–4 semanas |
| P0 | 3 | [C] Carrossel do imóvel sem argumento | Arquitetura A (seção 10) |
| P0 | 4 | [C] Um só CTA | CTA pelo objetivo, lista na ficha, mesmo CTA no máx. 3×/semana |
| P1 | 5 | [C][O] Nada para proprietários | Objetivo 5 "captar imóvel" (aprovado 23/11) |
| P1 | 6 | [G] Biblioteca genérica ("O erro dos 90%", "O segredo que escondem", Humor/Luxury Writer, AIDA/PAS) | Biblioteca do setor na ficha, ganchos com lacuna de dado real |
| P1 | 7 | [O] Cinco classificações | Objetivo comercial como eixo; momento derivado; pilar de Social Selling só no diagnóstico |
| P1 | 8 | [G] Capa por rodízio | Capa pela arquitetura |
| P1 | 9 | [O][C] Pilar de mercado vazio, ganchos impossíveis | "Autoridade local" com sinais, catálogo próprio e perguntas recebidas; tirar ganchos de preço de mercado |
| P1 | 10 | [C] Sem confiança nem rosto | 3 perguntas semanais ao corretor |
| P2 | 11 | [G] Cliente típico vira o único ângulo | Orienta o tom; no máx. 2 peças/semana com o recorte |
| P2 | 12 | [G] Primeira pessoa experiencial | Ampliar a regra de honestidade e a nota |
| P2 | 13 | [G] Nota não mede função comercial | 3 perguntas novas na nota (seção 11) |
| P2 | 14 | [O] Sem retorno de desempenho | Medir por objetivo quando houver publicação |

## 7. Manter, modificar, combinar, eliminar
| Formato | Decisão | O que muda |
|---|---|---|
| Carrossel do imóvel | modificar | Arquitetura A |
| O detalhe | manter | Só com campo "detalhe" ou marca; sem dado, não gera |
| 3 coisas perto + A pé daqui (C2) | **combinar** | Um formato "Vida a pé", distância real "em linha reta" |
| Guia do bairro (C2) | manter, prioridade | Principal autoridade local |
| O que R$X compra | manter | Sempre que houver 2+ imóveis na faixa |
| Isso ou aquilo (C2) | manter | — |
| O que mudou no bairro (C2) | manter, prioridade | Ligado aos sinais da trilha de oportunidades |
| Educativo ("Passo a passo") | modificar | Máx. 1–2/semana, arquitetura F |
| FAQ de 1 slide | combinar com o educativo | Mesma fonte e trava de assunto |
| Checklist antes da visita (C2) | manter | Fecha com convite para imóvel real |
| Cards "trend" e "problem" | **eliminar** do setor imóveis | Tendência sem fonte; citação inventada |
| Card "tweet" | modificar | Só opinião do corretor (perguntas semanais) |
| Comente QUERO | reclassificar | Opção de CTA, não formato |
| Vídeos 5–6 s | separar | Ativo do tour / post extra (D8) |
| Stories, POV, Vendido! | manter na fila | Ligados às perguntas ao corretor |

## 8. Organização por objetivo comercial (aprovada 23/11)
| Objetivo | O que deve causar | Formatos | CTA típico | Peso inicial |
|---|---|---|---|---|
| 1. Levar à visita | pedido de visita/ficha | Por dentro (A), Isso ou aquilo (C), Custo de morar (B), Antes da visita | Comente VISITA (com automação) · Peça a ficha | 2/semana |
| 2. Criar desejo | salvar, compartilhar | O detalhe, Vida a pé, Um dia aqui | Salve · Manda pra quem procura | 1–2/semana |
| 3. Provar que conhece o bairro | seguir, lembrar | Guia do bairro (H), O que mudou (D), O que R$X compra, Raio-x do catálogo | Siga para acompanhar o bairro | 1–2/semana |
| 4. Destravar a decisão | tirar objeção | Objeção honesta (E), Educativo-decisão (F), FAQ | Comente a sua dúvida · Salve para a visita | 1/semana (máx. 2) |
| 5. Captar imóvel | proprietário chamar | Como apresentamos (G), Antes de anunciar, O que o comprador pergunta | Chame para conversar sobre o seu imóvel | 0–1/semana |
| 6. Gerar confiança | lembrar de quem está por trás | Bastidor (I), Vendido!, Quem somos | sem CTA | só com material |

Regras da semana: ≥3 peças de imóvel quando há 3+ imóveis com fotos; ≤2 do objetivo 4; ≥1 do objetivo 3; mesmo imóvel no
máx. 2×, objetivos diferentes. Tudo na ficha (regra 6).

## 9. Novos ângulos (só dado real)
| Ângulo | Exemplo de capa | Dado | Objetivo |
|---|---|---|---|
| Custo real de morar | "Quanto custa por mês morar neste 3 quartos no Leblon" | condomínio + IPTU do cadastro | 1 |
| Preço revisado | "Este apartamento em Ipanema mudou de preço" | mudança no campo preço, com OK do corretor | 1 |
| Rotina que o imóvel permite | "O quarto que vira escritório com vista" | planta, cômodos, fotos | 2 |
| Objeção honesta | "Sem vaga de garagem. Ainda vale a visita?" | campo vazio + compensações reais | 4 |
| Comparação no catálogo | "Varanda gourmet ou 2 vagas?" | 2 imóveis do cliente | 1 |
| Raio-x do catálogo | "O que temos em Copacabana agora, de 2 a 4 quartos" | catálogo próprio | 3 |
| Perguntas da semana | "A pergunta que mais ouvimos sobre a Barra" | DMs/respostas do corretor, sem identificar ninguém | 4 |
| Notícia que muda a rotina | "Obra na estação: o que muda para quem mora perto" | sinal com fonte e data | 3 |
| Antes de visitar, saiba | "3 coisas para reparar neste imóvel" | cadastro + "detalhe" | 1 |
| Como apresentamos um imóvel | "Seu apartamento apresentado assim para o comprador" | tour (Frente 1), fotos reais, autorização | 5 |
| Vender ou alugar | "4 perguntas antes de decidir" | dica conferida, sem número | 5 |
| O que o comprador olha primeiro | "O que perguntam primeiro sobre imóveis no Leblon" | perguntas reais recebidas | 5 |
| Bastidor da semana | "Três visitas, três perguntas diferentes" | respostas do corretor | 6 |
| Liquidez qualitativa | "O que faz um imóvel no Leblon ser fácil de alugar" | pontos fortes + dica geral, sem retorno prometido | 3 |

## 10. Arquiteturas de carrossel (uma por objetivo)
Todas cabem no sistema de slides atual (capa, lista, passos, comparação, destaque, foto, fecho).

- **A. Visita guiada (obj. 1, substitui o carrossel do imóvel):** capa = foto do ponto forte + o ponto forte em palavras, sem
  preço · chegada (fachada/sala, 1 linha) · 3 ambientes na ordem da visita, 1 linha cada · lá fora: 2–3 lugares reais com
  distância · números (quartos, m², vagas, condomínio, IPTU, preço) uma vez só · fecho com convite concreto.
- **B. Custo real de morar (obj. 1):** capa-pergunta + foto real · condomínio (com o que inclui) · IPTU · o que o valor compra
  no dia a dia (só cadastro) · fecho "quer a ficha completa?". Só gera com condomínio e IPTU; sem soma estimada de custos.
- **C. Isso ou aquilo (obj. 1):** como no C2; fecho "Comente A ou B, te mando a ficha".
- **D. O que mudou no bairro (obj. 3):** manchete + selo de fonte/data · o fato · o que pode mudar (hipótese) · imóveis do
  cliente na área · fecho "siga para acompanhar o bairro".
- **E. Objeção honesta (obj. 4):** objeção dita de frente · o fato · o que compensa (dado real) · para que rotina funciona
  (uso, nunca rótulo de quem pode comprar) · fecho "venha ver". Só com OK do corretor na objeção.
- **F. Educativo ligado a decisão (obj. 4):** pergunta real de comprador · resposta de dica conferida · como aparece num imóvel
  real do catálogo · o que perguntar na visita · fecho "salve para a visita". Sem dica: não gera.
- **G. Como apresentamos o seu imóvel (obj. 5):** capa para quem vai vender/alugar no bairro · foto simples × quadro do tour
  (autorizado) · o que preparamos · passos do primeiro contato ao anúncio · fecho "chame para conversar sobre o seu imóvel".
  Nunca prometer prazo nem preço.
- **H. Guia do bairro (obj. 3):** como no C2.
- **I. Bastidor da semana (obj. 6):** foto real + "Esta semana" · o que aconteceu, a pergunta que ouviu, o que aprendeu, nas
  palavras do corretor · fecho sem venda.

## 11. Regras de geração
1. **Brief obrigatório:** objetivo (1 de 6), público (comprador, inquilino, proprietário, investidor), ângulo, **prova** (dado
   real que sustenta) e próximo passo. O código recusa brief sem prova.
2. **"Sem dado, troca de ângulo"** no lugar do texto fixo do modo geral.
3. **Capa pela arquitetura;** "O erro que…" só com erro real descrito na dica.
4. **CTA por objetivo** na ficha, com teto de repetição e mecânicas de baixo esforço.
5. **Biblioteca do setor na ficha;** tirar ganchos que pedem preço de mercado.
6. **Uma classificação** (objetivo); limpar valores sujos do pilar.
7. **Teto e trava de assunto** do educativo.
8. **Cliente típico orienta, não domina** (máx. 2/semana com o recorte).
9. **Legenda complementa, não repete** (1ª linha = ponto forte; preço uma vez).
10. **Honestidade ampliada:** proibir "na minha experiência", "já vi muitos clientes" sem informação do corretor.
11. **Nota comercial:** próximo passo específico? passa no teste da troca de logo? cita dado real do cliente?
12. **3 perguntas semanais ao corretor:** o que aconteceu, que pergunta ouviu, que imóvel quer mostrar.
13. **Oportunidades no calendário:** sinal forte → "O que mudou"; imóvel com pouca tração → "Objeção honesta" ou "Custo de morar".
14. **Medir por objetivo** quando houver publicação medida.

## 12. Ordem de execução (aprovada 23/11; itens na PENDENCIAS)
| Etapa | O que entra | Item |
|---|---|---|
| 1 | Fim do texto vazio (2), teto do educativo e trava de assunto (7), CTA por objetivo (4), honestidade ampliada (10), cards trend/problem fora do setor | C7 |
| 2 | Arquitetura A no carrossel do imóvel, B (custo de morar), capa pela arquitetura (3) | C8 |
| 3 | Formatos do C2 com as combinações da seção 7 (C3), biblioteca do setor (5), nota comercial (11) | C3 + C9 |
| 4 | Organização por objetivo na ficha e no plano (1, 6), perguntas ao corretor (12), oportunidades no calendário (13) | C10 |
| 5 | Público proprietário (objetivo 5, arquitetura G) | C11 |

Custo: zero de construção; testes na verba da Frente de conteúdo (US$ 2), centavos por peça. **Bloqueio em 23/11:** créditos
da Anthropic esgotados; nenhuma peça de teste até a recarga.
