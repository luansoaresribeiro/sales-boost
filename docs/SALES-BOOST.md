# Sales Boost — Real Estate Opportunity & Growth Platform

> **"Identificamos oportunidades comerciais para imobiliárias e ajudamos a transformá-las em ações."**
>
> **Princípio orientador:** *"We don't just help real estate agencies create content. We help them identify opportunities
> and turn them into action."*
>
> **Fonte oficial de verdade da empresa** (dono, 23/11/2026). Para funcionários, parceiros, investidores, desenvolvedores e
> potenciais clientes. Consolida o posicionamento do Sales Boost; não descreve uma empresa nova. Decisões de origem:
> [posicionamento](DECISIONS.md#2026-11-23--posicionamento-real-estate-opportunity--growth-platform) ·
> [fonte de verdade](DECISIONS.md#2026-11-23-2--sales-boostmd-é-a-fonte-oficial-de-verdade-princípio-orientador). Quando outro material contradiz este documento, **este documento vale** e o outro
> é corrigido (ou a mudança é decidida pelo dono e entra aqui primeiro).
>
> **Três materiais derivam daqui** (o site não vende uma coisa, o produto entrega outra e a documentação descreve uma
> terceira):
>
> | Material | Responde | Onde está hoje | Estado |
> |---|---|---|---|
> | **Website** | Como apresentamos e vendemos o Sales Boost | site getsaleboost.com (`src/i18n.ts`, páginas públicas) | ✅ alinhado em 23/11 (D7b), salvo o painel de exemplo da seção "Plataforma completa", ainda genérico |
> | **Product Documentation** | Como o produto realmente funciona | [PRODUCT](PRODUCT.md), [ARCHITECTURE](ARCHITECTURE.md) e os docs de área | ✅ interno, para os agentes; versão para cliente ainda não existe |
> | **Sales Strategy** | Como adquirimos imobiliárias e monetizamos | [PILOTO](PILOTO.md), [PITCH](../pitch/PITCH.md) | ⚠️ pitch desatualizado (D7); estratégia comercial a escrever a partir daqui |
>
> **Legenda usada neste documento:** ✅ existe e está em uso · 🔨 em desenvolvimento · 🔭 visão (ainda não existe).

## 1. O que é o Sales Boost
O Sales Boost é uma **plataforma de inteligência e execução comercial para imobiliárias**. A pergunta central que orienta
o produto é:

> **"Quais oportunidades comerciais existem e o que devemos fazer para aproveitá-las?"**

A plataforma ajuda a imobiliária a identificar oportunidades relevantes no seu mercado, entender o que merece atenção,
transformar isso em decisões e executar as ações para aproveitá-las. A medida de sucesso é comercial: **mais visitas aos
imóveis**, nunca a quantidade de posts. Visita garantida nunca é prometida.

Em uma frase, o princípio que orienta a empresa: *"We don't just help real estate agencies create content. We help them
identify opportunities and turn them into action."*

O Sales Boost **não é** uma agência de marketing, nem um gerador de posts com IA, nem uma plataforma de tours virtuais.
Conteúdo, vídeo e tour são **instrumentos de execução** dentro de um sistema que começa na leitura do mercado e termina
no aprendizado com os resultados.

## 2. O problema que resolvemos
Imobiliárias recebem informação o tempo todo: movimentos do mercado, novos empreendimentos e lançamentos, tendências
regionais, mudanças no comportamento de quem compra ou aluga, ações da concorrência, oportunidades em certas regiões,
imóveis e públicos.

Ter acesso à informação não é o mesmo que saber o que fazer com ela. Muitas imobiliárias não têm estrutura, tempo ou
processo para transformar informação em decisão comercial e decisão em ação. O resultado é oportunidade perdida e esforço
de divulgação sem direção.

O Sales Boost resolve essa desconexão entre **informação → oportunidade → estratégia → execução → resultado**.

## 3. Para quem é
Foco principal: **imobiliárias com equipes de corretores e operação comercial** que precisam identificar oportunidades e
transformá-las em ações. Em especial:
- imobiliárias pequenas e médias;
- equipes de corretores independentes;
- imobiliárias especializadas em determinados mercados ou regiões;
- operações que precisam melhorar a presença digital e a captação de clientes.

A identidade da empresa **não é limitada a uma região**. Hoje a operação acontece no **Brasil** (principalmente o Rio de
Janeiro, em português) e nos **EUA** (aberto em 17/11/2026, em inglês, com ficha própria). O corretor autônomo também pode
usar a plataforma.

## 4. Como funciona: as cinco etapas
O produto é organizado em cinco etapas encadeadas. Cada uma alimenta a seguinte.

| Etapa | O que faz | Estado hoje |
|---|---|---|
| **1. Market Intelligence** | Monitora notícias e sinais do mercado da região da imobiliária, com fonte e data, e filtra o que é fraco (patrocinado, guia, ocorrência isolada). | ✅ coleta diária com fonte; sinais por empresa |
| **2. Opportunity Engine** | Avalia se um sinal é uma oportunidade comercial **real para aquela imobiliária**, cruzando com os imóveis dela. | ✅ oportunidades com evidência e trava contra afirmação sem fonte; 🔨 qualidade em validação |
| **3. Strategy Agent** | Transforma oportunidades e o contexto da imobiliária em estratégia: o que fazer, por que, para quem e com qual objetivo. | ✅ estratégia ativa por empresa, com mix semanal |
| **4. Activation** | Converte a decisão em ação: plano semanal de posts com foto real, pacotes do imóvel, tour virtual, mobiliado, campanhas. | ✅ 1 post por dia com aprovação humana; ✅ tour contínuo (cobertura parcial); 🔨 tour do imóvel inteiro |
| **5. Results & Learning** | Acompanha o que aconteceu (visualizações da página do imóvel, interessados, leads, visitas, publicações, alcance) e usa os aprendizados nas próximas decisões. | ✅ funil comercial e "da produção ao resultado" com fonte; ✅ lições aplicadas aos próximos posts; 🔨 lead qualificado |

**Sinal ≠ tendência ≠ oportunidade.** Um **sinal** é um fato com fonte (ex.: uma notícia de lançamento num bairro). Uma
**tendência** é um padrão que se repete em vários sinais. Uma **oportunidade comercial** só existe quando há contexto,
justificativa, relevância para o negócio, um público ou imóvel envolvido, uma ação possível e evidência que sustente a
recomendação. O Opportunity Engine não cria oportunidade sem essas partes.

**Regras que valem em todas as etapas:** nada vai ao público sem aprovação humana; foto de imóvel é sempre real; nunca se
inventa número (preço, metragem, mercado, resultado); o que é de cada setor vive na ficha (`vertical_playbooks`), não no
código; registro do corretor (CRECI no Brasil) obrigatório para publicar.

## 5. Produtos: um ecossistema integrado

### Sales Boost Platform (o produto principal)
Inteligência de mercado, identificação de oportunidades, estratégia e execução comercial, com aprovação humana em cada
publicação. Inclui o cadastro de imóveis com pontos fortes marcados pelo corretor, que orientam o que cada peça mostra,
e uma visão honesta do resultado: cada número mostra a fonte e o que ainda não é medido aparece como "não medido".

### Property Studio / Virtual Tours
Produção e apresentação digital do imóvel: **tour virtual** feito só a partir das fotos reais (sem inventar passagem entre
cômodos), **mobiliado virtual** de cômodo vazio (sempre com o aviso de imagem ilustrativa) e materiais de apresentação.
- ✅ tour contínuo; ✅ indicador de cobertura do imóvel e lista das fotos que faltam; ✅ mobiliado com trava que recusa
  foto que mudaria a arquitetura.
- 🔨 tour do **imóvel inteiro**, em partes, com conferência de destino de cada passagem.
- É também uma **fonte de receita transacional** em estudo: serviço por imóvel ou por pacote de produção (seção 7).

### AI-Powered Activation
Ferramentas de IA que transformam a estratégia em material: legendas, carrosséis com foto real, peças por imóvel com
ângulos diferentes a cada vez, cards de dúvida frequente conferidos em fonte oficial, nota de qualidade antes de chegar
ao dono. São **instrumentos de execução**, não o propósito da empresa. Hoje o plano automático publica no máximo **1 post
por dia**, sempre com aprovação.

## 6. Diferencial
O diferencial não é "usar IA". É **conectar cinco elementos** que normalmente ficam separados:
1. inteligência de mercado;
2. contextualização da oportunidade para cada imobiliária e seus imóveis;
3. decisão estratégica;
4. execução da ação recomendada;
5. aprendizado com o resultado.

Ferramentas tradicionais ajudam a criar conteúdo, gerenciar contatos ou apresentar imóveis. O Sales Boost responde a uma
pergunta anterior: **qual oportunidade comercial merece nossa atenção e como podemos aproveitá-la?**

O Sales Boost **não pretende substituir** CRMs nem ferramentas especializadas. Pode atuar como uma camada complementar de
inteligência e execução comercial ao lado delas (🔭 integrações com CRM ainda não existem).

## 7. Modelo de negócio (hipóteses em validação)
**Nenhum preço está decidido.** O modelo é tratado como uma arquitetura que pode combinar:

| Componente | Situação |
|---|---|
| Plataforma de uso livre, com custo controlado por conta | **Hipótese em validação hoje** (com o tour pago) |
| Serviço transacional por imóvel (tour virtual, mobiliado) | **Hipótese em validação hoje** — US$ 15 por tour é hipótese, não preço |
| Lead qualificado | Hipótese; sem preço até existir definição e medição |
| Assinatura recorrente da plataforma | Hipótese nova (23/11), não decidida |
| Planos com limites e capacidades diferentes | Hipótese nova (23/11), não decidida |
| Pacotes premium de produção e apresentação do imóvel | Hipótese nova (23/11), não decidida |
| Boosts (unidade de uso das funções pagas) | Em aberto |

As decisões de preço dependem da validação comercial com imobiliárias e do custo real medido de servir cada cliente (a
plataforma já mede o custo por cliente, funcionalidade e operação).

## 8. Visão de longo prazo
O Sales Boost pretende ser a **infraestrutura de inteligência e execução comercial** das imobiliárias: permitir que a
imobiliária entenda melhor o seu mercado, perceba oportunidades que passariam despercebidas, decida melhor e transforme
essas decisões em ações comerciais mensuráveis.

O objetivo não é produzir mais conteúdo por produzir. É ajudar a imobiliária a aproveitar melhor as oportunidades que já
existem no mercado dela.

🔭 Faz parte da visão, e **ainda não existe**: agendamento de visita pela plataforma, qualificação de lead com regra
definida, criação e impulsionamento de anúncios (hoje só leitura do Meta Ads), integração com CRMs, Boosts, avatar e
mobiliado em vídeo.

## 9. O que mudou neste documento (23/11/2026)
- **Posicionamento:** "Sales Boost — Real Estate Opportunity & Growth Platform" e a frase "Identificamos oportunidades
  comerciais para imobiliárias e ajudamos a transformá-las em ações" **substituem** o posicionamento "Technology Partner
  for Real Estate" (13/11) **e** o slogan "gerando mais visitas para o seu imóvel" (10/11). A visita continua sendo a
  medida de sucesso.
- **Centro do produto:** a pergunta "quais oportunidades existem e o que fazer" passa a ser o eixo; conteúdo, tour e vídeo
  são instrumentos de execução, não o produto em si.
- **Cinco etapas** (Market Intelligence → Opportunity Engine → Strategy Agent → Activation → Results & Learning) explícitas,
  com o estado de cada uma, e a distinção entre sinal, tendência e oportunidade.
- **Produtos como ecossistema:** Platform, Property Studio / Virtual Tours e AI-Powered Activation.
- **Modelo de negócio:** assinatura, planos com limites e pacotes premium entram como **hipóteses novas**, ao lado das
  que já estavam em validação; nada decidido.
- **Público:** imobiliárias com equipe como foco, sem limitar a identidade a uma região.
- **Governança (23/11, 2):** este documento é a **fonte oficial de verdade**; Website, Product Documentation e Sales Strategy
  derivam dele. Princípio orientador: *"We don't just help real estate agencies create content. We help them identify
  opportunities and turn them into action."*
