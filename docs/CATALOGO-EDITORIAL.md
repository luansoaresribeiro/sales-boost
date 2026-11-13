# Catálogo editorial — formatos de post do agente de conteúdo

> **Status: PROPOSTA para o dono aprovar** (item C2 da [PENDENCIAS.md](PENDENCIAS.md); decisão de 13/11 em
> [DECISIONS.md](DECISIONS.md)). Nenhum código novo antes da aprovação. A construção é o C3.
>
> **Pedido do dono:** "não quero só mais templates": 8 a 10 formatos **realmente diferentes**, cada um com objetivo,
> momento do caminho até a visita, gancho, estrutura slide a slide, dados reais, diferença visual, quando não usar e
> rodízio. Comparação ou análise **só com dado real nosso**, nunca preço ou número de mercado inventado.

## Regras que valem para todos os formatos

- **1 post por dia, 7 por semana** (C1). Cada dia recebe um formato deste catálogo.
- **Foto de imóvel é sempre real.** A IA de imagem nunca escreve texto: o texto sai pelo sistema de slides
  (`render-format`), com o logo, as cores e as fontes do Kit da Marca.
- **Número só se estiver na fonte:** o cadastro do imóvel, o OpenStreetMap (distância), uma notícia com link e data, ou
  uma dica conferida. A trava de números (`claimLock`) continua cortando o que não tiver fonte.
- **Sem promessa** ("valoriza com certeza", "melhor bairro") e **sem rótulo de quem pode comprar** (trava de conformidade).
- **CRECI no rodapé** e aprovação do dono antes de publicar.
- **Fontes de dado real que o sistema já tem:**
  - **cadastro** (tipo, bairro, preço, quartos, m², vagas, condomínio, IPTU, andar, vista, lazer, "perto de", "detalhe
    que ninguém percebe", descrição);
  - **fotos** (com o cômodo e a nota de cada uma);
  - **lugares perto**, pelo OpenStreetMap: praia, metrô, parque, escola, mercado, padaria, farmácia, academia,
    restaurante, hospital, shopping e cultura, com o nome e a distância em metros;
  - **notícias do mercado** com fonte e data;
  - **dicas conferidas** (FAQ checada na web).

### O caminho até a visita (a coluna "Momento")

| Etapa | O que a pessoa pensa | O post precisa |
|---|---|---|
| **1. Descobrir** | "Que bairro? Que tipo de imóvel?" | Chamar atenção e ensinar algo do bairro |
| **2. Considerar** | "Esse imóvel serve para mim?" | Mostrar o imóvel e a rotina de quem mora |
| **3. Decidir visitar** | "Vale ir ver?" | Comparar, tirar dúvida e chamar para a visita |
| **4. Confiar** | "Esse corretor sabe do que fala?" | Educar com informação conferida |

## Os 10 formatos

### 1. Descoberta do imóvel — "Por dentro"
- **Objetivo:** apresentar um imóvel do catálogo como uma visita guiada.
- **Momento:** 2. Considerar.
- **Gancho:** o diferencial real do imóvel na capa ("3 quartos com varanda na Barra da Tijuca"). Sai dos campos do
  cadastro, nunca é inventado.
- **Slide a slide:**
  1. **Capa:** a melhor foto + "Tipo Bairro" + o diferencial.
  2. a 4. **Os ambientes:** uma foto real por ambiente, na ordem de uma visita, com uma legenda curta de 1 linha.
  5. **Ficha:** quartos, m², vagas, andar, só os preenchidos.
  6. **Fecho:** "Comente QUERO e receba os detalhes" (só com a automação ativa) ou "Chame no direct".
- **Dados reais:** cadastro + fotos ordenadas pelo cômodo.
- **Diferença visual:** foto ocupando o slide inteiro, com uma faixa fina de texto embaixo. É o único formato "galeria".
- **Quando não usar:**
  - imóvel com menos de 5 fotos boas;
  - imóvel indisponível;
  - o mesmo imóvel já saiu neste formato nas últimas 3 semanas.
- **Rodízio:** no máximo 2 por semana, nunca em dias seguidos e nunca 2 vezes o mesmo imóvel na semana.
- **Hoje:** existe ("Carrossel do imóvel"). Melhorar a ordem das fotos pela visita.

### 2. "O detalhe que você não viu"
- **Objetivo:** fazer a pessoa parar e reparar num ponto pouco notado do imóvel.
- **Momento:** 2. Considerar.
- **Gancho:** "Repara neste detalhe…", com a foto em zoom.
- **Slide a slide:**
  1. **Capa:** a foto recortada no detalhe + a pergunta.
  2. **O ambiente inteiro**, mostrando onde fica o detalhe.
  3. **Por que importa na rotina:** texto curto sobre o uso, sem número.
  4. **Fecho:** convite para ver de perto.
- **Dados reais:** o campo "detalhe que ninguém percebe" + a foto onde ele aparece.
- **Diferença visual:** capa em zoom, com um círculo ou seta de destaque, desenhada pelo sistema de slides e não pela IA.
- **Quando não usar:** quando o campo "detalhe" está vazio, porque o sistema não adivinha o detalhe.
- **Rodízio:** no máximo 1 por semana.
- **Hoje:** existe. Falta a capa em zoom com destaque.

### 3. "A pé daqui" (régua de distâncias) — **NOVO**
- **Objetivo:** mostrar a vida a pé a partir do imóvel, com distância real.
- **Momento:** 1. Descobrir → 2. Considerar.
- **Gancho:** "O metrô a ~180 m do apartamento". É o lugar mais perto entre os que contam, com a distância do
  OpenStreetMap.
- **Slide a slide:**
  1. **Capa:** foto da fachada ou da vista + o lugar mais perto.
  2. a 4. **Uma "régua" por categoria:** metrô, praia ou parque, mercado ou padaria, escola. Cada uma com o nome real e
     os metros.
  5. **Fecho:** "Quer ver o imóvel? Me chama".
- **Dados reais:** `nearby` (OpenStreetMap), com o nome e os metros. **Atenção:** a distância de hoje é em **linha reta**,
  não o caminho pelas ruas. O post escreve "a ~180 m (em linha reta)", e nunca mostra minutos de caminhada sem uma rota
  real calculada.
- **Diferença visual:** layout novo de **régua**: uma linha com pontos e a distância em destaque. Não tem foto no miolo.
- **Quando não usar:**
  - imóvel sem endereço, ou sem pelo menos 3 lugares encontrados;
  - distância acima de 1,5 km, porque "a pé" deixaria de ser verdade.
- **Rodízio:** no máximo 1 por semana; não no mesmo dia de "3 coisas perto".

### 4. Guia do bairro em 5 paradas — **NOVO**
- **Objetivo:** ensinar o bairro e posicionar o corretor como quem conhece a região.
- **Momento:** 1. Descobrir.
- **Gancho:** "5 lugares para conhecer o Leblon a pé".
- **Slide a slide:**
  1. **Capa:** nome do bairro em destaque.
  2. a 6. **Uma parada por slide:** categoria + nome real + uma linha do que é. A linha é genérica ("praça com
     parquinho"), nunca uma avaliação ("o melhor restaurante").
  7. **Fecho:** "Tenho imóveis aqui. Quer ver?" Só aparece se o cliente tem um imóvel disponível no bairro.
- **Dados reais:** OpenStreetMap (nome e categoria) do bairro de um imóvel do catálogo. A foto do imóvel só entra na
  capa, se houver.
- **Diferença visual:** **numeração grande** (1 a 5) em cada slide, com o ícone da categoria. É o único formato
  "roteiro".
- **Quando não usar:**
  - bairro sem imóvel do cliente;
  - menos de 5 lugares em categorias diferentes.
- **Rodízio:** no máximo 1 por semana, e o mesmo bairro só depois de 4 semanas.
- **Atenção:** os nomes são de estabelecimentos reais. Só citar, nunca avaliar.

### 5. "Isso ou aquilo" (2 imóveis do cliente lado a lado) — **NOVO** (estava só no papel)
- **Objetivo:** fazer a pessoa escolher, para gerar comentário e mostrar 2 imóveis de uma vez.
- **Momento:** 3. Decidir visitar.
- **Gancho:** "Varanda gourmet ou 2 vagas? Qual você escolheria?"
- **Slide a slide:**
  1. **Capa:** as duas fotos lado a lado + a pergunta.
  2. **Imóvel A:** foto + 3 dados do cadastro.
  3. **Imóvel B:** foto + os mesmos 3 dados.
  4. **Comparação:** tabela de 2 colunas, só com campos preenchidos nos dois.
  5. **Fecho:** "Comente A ou B".
- **Dados reais:** cadastro dos 2 imóveis do mesmo cliente.
- **Diferença visual:** **tela dividida ao meio** em todos os slides, com as cores A/B.
- **Quando não usar:**
  - cliente com menos de 2 imóveis disponíveis;
  - imóveis muito diferentes (venda × aluguel, ou faixas de preço distantes), segundo a regra da ficha;
  - nunca dizer qual é "melhor".
- **Rodízio:** no máximo 1 por semana.

### 6. "O que R$X compra aqui"
- **Objetivo:** responder "dá para mim?" usando só o catálogo do cliente.
- **Momento:** 2. Considerar → 3. Decidir visitar.
- **Gancho:** "O que R$ 900 mil compra na Tijuca", com o preço de um imóvel real do cliente.
- **Slide a slide:**
  1. **Capa:** o valor e o bairro.
  2. a 4. **Os imóveis do cliente nessa faixa:** foto + quartos e m².
  5. **Fecho:** "Me diga sua faixa e eu te mostro".
- **Dados reais:** preços do catálogo. Nunca o preço médio do bairro nem um "m² do mercado".
- **Diferença visual:** o **valor em tipografia grande** na capa, e cartões com etiqueta de preço no miolo.
- **Quando não usar:**
  - imóvel sem preço cadastrado;
  - cliente que pediu para não mostrar preço;
  - só 1 imóvel na faixa: nesse caso, vira o formato 1.
- **Rodízio:** no máximo 1 por semana.
- **Hoje:** existe.

### 7. "3 coisas perto"
- **Objetivo:** juntar o imóvel e o entorno num post rápido.
- **Momento:** 2. Considerar.
- **Gancho:** "3 coisas a menos de 500 m deste apartamento".
- **Slide a slide:**
  1. **Capa:** foto do imóvel.
  2. a 4. **Um lugar por slide:** ícone, nome e metros.
  5. **Fecho.**
- **Dados reais:** OpenStreetMap + uma foto real.
- **Diferença visual:** foto do imóvel como fundo desfocado, com o cartão do lugar por cima. É diferente da régua do
  formato 3.
- **Quando não usar:**
  - menos de 3 lugares encontrados;
  - na mesma semana de "A pé daqui" para o mesmo imóvel.
- **Rodízio:** no máximo 1 por semana.
- **Hoje:** existe.

### 8. "O que mudou no bairro" (notícia com fonte) — **NOVO**
- **Objetivo:** mostrar que o corretor acompanha o bairro: obra, estação, lançamento, regra nova.
- **Momento:** 1. Descobrir / 4. Confiar.
- **Gancho:** a manchete resumida em 1 linha + "o que isso muda para quem mora ou quer morar aqui".
- **Slide a slide:**
  1. **Capa:** a manchete curta + o selo da fonte e da data.
  2. **O que aconteceu:** 2 a 3 linhas, só o que a fonte diz.
  3. **O que pode mudar no dia a dia:** em forma de hipótese ("pode facilitar…"), nunca "vai valorizar".
  4. **Imóvel do cliente no bairro (se houver):** foto + "Tipo Bairro".
  5. **Fecho** + a fonte escrita ("Fonte: O Globo, 12/11").
- **Dados reais:** sinal de mercado **forte** (filtro de qualidade v3), com link e data. Patrocinado e guia de bairro
  já são barrados.
- **Diferença visual:** cara de **"jornal"**: selo da fonte, data em destaque e cor neutra. É o único com crédito de
  fonte visível.
- **Quando não usar:**
  - sem sinal forte do bairro nos últimos 14 dias;
  - notícia de ocorrência isolada (acidente, crime);
  - qualquer número que não esteja na matéria.
- **Rodízio:** no máximo 1 por semana. O mesmo fato nunca entra duas vezes.

### 9. Educativo para quem vai comprar ou alugar — "Passo a passo"
- **Objetivo:** ensinar uma etapa do processo (documentos, financiamento, visita) e ganhar confiança.
- **Momento:** 4. Confiar.
- **Gancho:** a capa varia entre promessa, pergunta e erro comum ("O erro que atrasa a escritura").
- **Slide a slide:**
  1. **Capa.**
  2. a 5. **Passos numerados**, cada um com 1 frase.
  3. **Resumo.**
  4. **Fecho:** "Salve para a sua visita".
- **Dados reais:** dicas **conferidas** (busca + trava de fonte para assunto jurídico ou financeiro). Sem taxa nem
  valor que não venha da fonte conferida.
- **Diferença visual:** layout **"passos"** com uma barra de progresso. Não tem foto de imóvel: é tipográfico, com o
  Kit da Marca.
- **Quando não usar:**
  - assunto sem fonte conferida;
  - tema repetido nas últimas 4 semanas (trava de tema).
- **Rodízio:** até 2 por semana (é o formato que não depende de imóvel, então completa os dias sem material), nunca em
  dias seguidos.
- **Hoje:** existe ("Carrossel educativo").

### 10. "Pergunta de verdade" (FAQ de 1 slide) + "Antes da visita: o que olhar"
- **Objetivo:** responder rápido uma dúvida real ou preparar a visita (checklist do que observar).
- **Momento:** 3. Decidir visitar / 4. Confiar.
- **Gancho:** a pergunta como título ("Posso usar o FGTS para comprar um imóvel usado?").
- **Estrutura:**
  - **FAQ:** 1 a 2 slides: a pergunta grande e a resposta curta conferida, com "fonte conferida".
  - **Checklist:** 4 a 6 itens com caixinhas ☐ (luz, barulho, água, vagas, documentos do condomínio).
- **Dados reais:** FAQ conferida. O checklist é genérico, sem número.
- **Diferença visual:** **cartão único** com a pergunta grande (FAQ) ou a **lista com caixinhas** (checklist). É o post
  mais curto do catálogo.
- **Quando não usar:** pergunta sem resposta conferida.
- **Rodízio:** no máximo 1 por semana, alternando FAQ e checklist.
- **Hoje:** a FAQ existe ("Dica ou FAQ"). O checklist é novo.

## Rodízio da semana (como o calendário escolhe)

| Regra | Valor |
|---|---|
| Posts por semana | 7, um por dia (C1) |
| Mesmo formato em dias seguidos | nunca (quando há mais de 1 formato disponível) |
| Formatos diferentes na semana | pelo menos 5 dos 10 |
| Com imóvel × sem imóvel | ao menos 2 posts sem imóvel (formatos 4, 8, 9, 10), que também completam os dias sem material |
| Mesmo imóvel | no máximo 2 posts na semana, em formatos diferentes |
| Mesmo bairro no guia (4) | 1 vez a cada 4 semanas |
| Mesma notícia (8) / mesmo tema educativo (9) | nunca repete (trava de tema já existe) |

**Exemplo de semana** (cliente com 3 imóveis, sem notícia forte):

| Dia | Post |
|---|---|
| seg | 1 Descoberta (imóvel A) |
| ter | 9 Educativo |
| qua | 3 A pé daqui (imóvel B) |
| qui | 5 Isso ou aquilo (A × C) |
| sex | 10 Checklist da visita |
| sáb | 2 Detalhe (imóvel C) |
| dom | 4 Guia do bairro |

## O que muda no código (C3, só depois da aprovação)

- **Já existem, só melhorar:**
  - 1 (ordem das fotos);
  - 2 (capa em zoom);
  - 6, 7;
  - 9;
  - 10 (FAQ).
- **Novos:**
  - 3 (layout "régua");
  - 4 (layout "roteiro");
  - 5 (tela dividida, com 2 imóveis);
  - 8 ("jornal", com selo de fonte);
  - 10-checklist (layout "caixinhas").
  - Cada um entra na ficha (`content_formats` + receita), sem código de setor.
- **Custo estimado de teste:** 1 peça de cada formato novo na Teste Zero, cerca de US$ 0,05 a 0,10 de texto de IA por
  peça. Os 5 novos somam menos de US$ 1, dentro da verba de US$ 2 da frente.

## Perguntas para o dono

1. **Quais formatos você aprova?** Marque os que entram (todos, ou uma lista). Os que você recusar não são construídos.
2. **Formato 4 (Guia do bairro):** citar estabelecimentos pelo nome (do OpenStreetMap) está ok? A alternativa é citar
   só a categoria ("uma padaria a 170 m").
3. **Formato 5 (Isso ou aquilo):** pode mostrar o preço dos dois imóveis lado a lado, ou só as características?
4. **Formato 3 (A pé daqui):** a distância hoje é em linha reta. Serve assim, com o aviso "em linha reta"? Ou prefere
   esperar o cálculo de rota a pé? Isso usa um serviço de rotas, que pode ser grátis (OpenStreetMap) ou pago: decidimos
   antes de construir.
