# Pendências — lista central (consultar ANTES de começar qualquer etapa)

> Regras desta lista (dono, 2026-11-13):
> - **Concluído só com validação.** Código escrito ou PR juntado não basta: o teste da coluna "Pronto quando" precisa ter
>   passado, e a prova (link, print, SQL) fica na coluna Status.
> - **Ao terminar um item**, o agente relê esta lista e pega o **próximo pendente da frente atual**. Nunca presume que o
>   projeto acabou. Frente nova só começa com a anterior validada, salvo autorização do dono.
> - **Decisão técnica ≠ autorização.** Nada aqui autoriza gastar crédito, mudar regra comercial, apagar infraestrutura ou
>   publicar conteúdo. Isso vem do dono, registrado em [DECISIONS.md](DECISIONS.md).
> - O detalhe de cada frente está em [PLANO-TOUR-COMPLETO.md](PLANO-TOUR-COMPLETO.md).
>
> Status: ⏳ pendente · 🔨 em andamento · 🧪 feito, aguardando validação · ✅ validado · ⛔ bloqueado (motivo)
> Responsável: **Dono** (Luan) ou **Agente** (Claude).

## Painel (atualizar a cada item)

- **Frentes abertas** ([decisão 13/11, tarde](DECISIONS.md#2026-11-13-tarde--decisões-do-dono-frequência-catálogo-editorial-revisão-de-prs-verbas-e-frente-de-conteúdo)):
  - **Frente 1 — Tour do imóvel inteiro;**
  - **Frente de conteúdo**, em paralelo.
- **Jornada do cliente** ([decisão 13/11 noite, 3](DECISIONS.md#2026-11-13-noite-3--jornada-do-cliente-custo-do-grátis-onboarding-guiado-upsell-contextual-e-menu-pro)): **J0 ✅ aprovado em 16/11** ([decisão](DECISIONS.md#2026-11-16--aprovações-do-dono-tradução-pten-em-todas-as-telas-a3-avisada)). Respostas J-a a J-g ✅ (16/11). Próximo: **J1 (custo do grátis)**; em paralelo, **I1 (tudo em inglês no modo inglês)**.
- **EUA aberto em 17/11** ([decisão](DECISIONS.md#2026-11-17--mercado-dos-eua-aberto-agora-tim-reyes-liberado)): Tim Reyes liberado. Próximo: **E1 (ficha dos EUA)**, com o plano para aprovação antes do código.
- **Próximo item do agente:**
  - **Frente de conteúdo:** **C1 🧪:** o plano de 15/11 perdeu posts por limite de chamadas do Supabase (causa nos logs); correção no PR do C1, conferir no domingo 22/11. C2 ✅ (16/11). Depois: C3 (construir os formatos aprovados) e C5.
  - **Frente 1:** 1.1 ✅ · 1.2 🧪 · **1.3 ✅ (print aprovado em 20/11)**. 1.3b 🧪 (exemplos no ar; falta foto de cômodo vazio) · **1.4 🔨** (D3 ✅ 20/11: o tour em partes já está no código; falta a conferência de destino e a revisão do dono) · **1.5** espera as fotos de passagem da A3 (lista entregue em 21/11).
- **Evolução da plataforma (22/11):** auditoria das 7 áreas entregue ([AUDITORIA-EVOLUCAO](AUDITORIA-EVOLUCAO.md)); espera o OK do dono. Ordem proposta: A custos → B dashboard → C memória por imóvel → D funil → E formatos → F 2º post sem IA → G upsell. Verba US$ 5.
- **Esperando o dono:**
  - **D6:** reserva da VPS.
  - **D7:** pitch.
  - **Fotos de passagem da A3 (1.5):** o dono encaminha a lista ao corretor e avisa quando as fotos estiverem no cadastro.
  - **DA:** anúncio pago entra no modelo e no preço?
  - **D5 (resto):** em que canal vai o aviso de visita agendada, agora que o Telegram está desligado.
  - **C2 (4 perguntas):** o catálogo foi aprovado; faltam as respostas às 4 perguntas do fim do [CATALOGO-EDITORIAL](CATALOGO-EDITORIAL.md).
- **Gasto acumulado:**

  | Verba | Gasto até agora |
  |---|---|
  | Frente 1 (US$ 15) | US$ 2,79 (1.1: 0,64; 1.2: 1,60; mobiliado: 0,16; trava: 0,03; A3 Ipanema: 0,36 — até 21/11; mapa refeito em 21/11: US$ 0) |
  | Frente de conteúdo (US$ 2) | US$ 0,00 |

## Decisões do dono

> **Regra (13/11):** ao pedir uma decisão, dizer o que falta, por que precisamos, as alternativas (com custo e prazo) e a
> recomendação.

| ID | Item | Resp. | Prior. | Depende de | Status |
|---|---|---|---|---|---|
| D1 | Aprovar o roadmap de [PLANO-TOUR-COMPLETO.md](PLANO-TOUR-COMPLETO.md) | Dono | P0 | — | ✅ 13/11 ([DECISIONS](DECISIONS.md#2026-11-13--decisões-do-dono-identidade-mercado-modelo-d1-autonomia-e-documentação)). "Uma frente por vez" substituído à tarde: Frente 1 + conteúdo em paralelo |
| D2 | Imóvel e fotos do teste | Dono | P0 | — | ✅ 20/11: para a 1.5, **um imóvel da A3** (dono), nas condições do [DECISIONS 20/11 tarde](DECISIONS.md#2026-11-20-tarde--testes-do-tour-primeiro-na-a3-com-condições-d3-d2-trava-do-mobiliado-e-ritmo-de-trabalho). Vale quando o dono juntar o PR |
| D3 | Tamanho máximo de cada parte do tour (proposta: ~8 passagens, ~50 s) | Dono | P1 | — | ✅ 20/11: social, íntima e lazer; até ~8 passagens e ~50 s por parte; respeitando a arquitetura real |
| D4 | Verba de teste da Frente 1 | Dono | P0 | — | ✅ 13/11: até **US$ 15** ([DECISIONS](DECISIONS.md#2026-11-13-tarde--decisões-do-dono-frequência-catálogo-editorial-revisão-de-prs-verbas-e-frente-de-conteúdo)). O provedor de nuvem da Frente 2 continua a decidir quando ela começar |
| D5 | Telegram: quais avisos viram e-mail; aviso para a A3 (inclui o canal do aviso de visita, ver [CONVERSION](CONVERSION.md)) | Dono | P1 | — | ✅ 16/11: Telegram desligado (flags no banco) e **a A3 foi avisada pelo dono**. ⏳ Falta decidir o canal do aviso de visita ([CONVERSION](CONVERSION.md)) |
| D6 | VPS: quanto tempo fica de reserva depois da troca | Dono | P2 | 2.3 | ⏳ |
| D7 | Reescrever o pitch ([pitch/PITCH.md](../pitch/PITCH.md)). Entram "Technology Partner for Real Estate" e "sem anúncios pagos"; o preço do tour fica como hipótese | Dono + Agente | P2 | — | ⏳ |
| DA | Anúncio pago entra no modelo comercial e no preço? (a Campanha voltou à plataforma em 13/11 noite) | Dono | P2 | — | ⏳ |
| D8 | Tour pronto (e cômodo mobiliado) pode virar post? | Dono | P2 | — | ✅ 13/11 (noite): **sim, como post extra**, além do post do dia, só com aprovação ([DECISIONS](DECISIONS.md#2026-11-13-noite--d8-tour-pronto-e-cômodo-mobiliado-viram-post-extra)) |
| DC | Verba de teste da Frente de conteúdo | Dono | — | — | ✅ 13/11: até **US$ 2** |

## Frente de conteúdo (aberta em 13/11, em paralelo com a Frente 1)

| ID | Item | Resp. | Prior. | Depende de | Pronto quando | Status |
|---|---|---|---|---|---|---|
| C0 | Esconder a aba "Campanha" (anúncios) do menu do conteúdo, **sem apagar o código** | Agente | P0 | — | A aba não aparece (print desktop e celular); links antigos `?tab=campanha` caem no Conteúdo; o código continua no repositório; site publicado e conferido | ~~🧪 [#170](https://github.com/luansoaresribeiro/sales-boost/pull/170): print ok; falta site publicado e conferido. A "Saúde da Meta" (conexão, não anúncio) continua pelo link `?tab=campanha&sub=saude` ~~ **Substituído em 13/11 (noite):** a Campanha voltou como item do menu (grupo Pro), via #173 |
| C1 | **Exatamente 1 post por dia, 7 por semana**, no plano automático. DM, "Comente QUERO", stories e mensagens não contam. Sem material de imóvel → formato que não depende de imóvel. Nunca dia vazio nem peça repetida. "Gerar agora" é extra | Agente | P0 | — | Teste automático: qualquer mix → 7 dias com 1 post cada, sem repetição. Na Teste Zero e na Tespon, a próxima semana planejada tem 7 posts (SQL) | 🧪 16/11 (noite): a semana do plano (seg 16 a dom 22/11; o domingo 23 entra no plano de 22/11) tem **1 peça por dia** nas 3 contas (SQL). Ficou: (a) 3 peças da rodada de 15/11 sem nota (o limite de chamadas derrubou a avaliação), que não aparecem em Aprovações: a da Teste Zero foi arquivada e o dia 20 refeito; as 2 da A3 (20 e 21/11) esperam o dono; (b) temas repetidos na semana (C1b). ✅ quando o plano de 22/11 sair com 7 dias com nota e sem tema repetido. Histórico: ❌ em 16/11 cedo (4 e 2 dias), causa = limite de chamadas por trace, corrigido nos #178/#179 |
| C1b | **Tema repetido na mesma semana** passa pela trava: "ITBI e as taxas…" × "Quanto é o ITBI… quem paga?" (Tespon, 18 e 20/11) e "custos invisíveis além do preço" × "custos além do preço…" (Teste Zero). A trava compara palavras e as vagas de domingo rodam em paralelo, sem ver o tema da outra | Agente | P0 | C1 | Teste automático com esses pares reais pegando a repetição; o plano de 22/11 sem tema repetido (SQL) | 🧪 21/11: trava da **mesma semana** em `_shared/themeDedupe.ts` (`findWeekRepeat`/`findRepeat`): mesmo **assunto-chave da ficha** (sinônimos em `content_rules.theme_topics`, migration `20261121120000`) ou sobreposição ≥ 0,6 sem as palavras de formato; vale na geração de cada post e na reserva de temas da semana (`weekThemes.ts`); só contam peças ativas (arquivada/recusada fora); o motivo vai para o `reasoning`/nota ("mesmo assunto na semana: ITBI"). Teste com os pares reais (`scripts/test-week-themes.mjs`, 14 casos novos). Nos temas reais de 16–22/11 pega: ITBI 2x (Tespon), custos além do preço 2x (Teste Zero), checklist de perguntas 3x (A3); deixa passar financiamento, liquidez, certidões, garantia do aluguel. Peça de oferta de imóvel não entra na comparação (tem trava própria). **Falta:** o plano de domingo 22/11 sem assunto repetido (SQL) |
| C2 | **Catálogo editorial** em `docs/`: 8 a 10 formatos realmente diferentes, cada um com objetivo, momento até a visita, gancho, slide a slide, dados reais, diferença visual, quando não usar e rodízio | Agente | P0 | C1 | Documento entregue e **aprovado pelo dono** | ✅ 16/11: aprovado pelo dono ("pode"), #171 juntado. Faltam as respostas às 4 perguntas do fim do documento |
| C3 | Construir os formatos aprovados no C2 | Agente | P1 | C2 aprovado | Cada formato gera peça real na Teste Zero/Tespon, com print e travas de número passando | ⏳ |
| C4 | Tela do agente de conteúdo simplificada | Agente | P1 | C3, Frente 4 (4.1) | Print aprovado pelo dono | ⏳ |
| C5 | Tour pronto e cômodo mobiliado viram **post extra** (D8). Não ocupam a vaga do dia; só com aprovação. Primeiro passo: conferir o que já existe (o `tour_piece` já cria uma peça sem dia em Aprovações; falta ver o mobiliado) | Agente | P1 | D8 ✅ | Na Teste Zero: um tour e um mobiliado aparecem em Aprovações como peças sem dia do calendário; aprovar publica como extra; o mobiliado com o aviso "Imagem ilustrativa – mobiliado virtualmente" | ⏳ |
| C6 | **Pontos fortes do imóvel** (marcar na ficha) guiando a escolha dos lugares perto e a legenda. Achado: hoje não há campo de marcar; os 12 tipos de lugar saem sempre na mesma ordem; `lazer`, `vista`, `andar` e `vagas` não chegam à legenda | Agente | P2 | 1.2 validado; **lista aprovada pelo dono** | Documento com os grupos para aprovar; depois, na Teste Zero, imóvel com "vida noturna" mostra restaurantes/cultura primeiro e a legenda cita as marcas | 🔨 22/11: [PONTOS-FORTES](PONTOS-FORTES.md) **aprovado** (lista como está; IA por cômodo não agora). **Item 1 ✅ 22/11** ([#205](https://github.com/luansoaresribeiro/sales-boost/pull/205)): na Teste Zero, carrossel do Apartamento Leblon (peça `e1773ce1`, arquivada depois) com "8º andar, varanda e vista parcial para o mar… piscina, academia e salão de festas… Duas vagas", tudo do cadastro. **Item 2 ✅ 22/11** ([#206](https://github.com/luansoaresribeiro/sales-boost/pull/206)): no site publicado, Teste Zero, Cobertura Leblon marcada "Perto da praia" + "Varanda" e salva (SQL: `pontos_localizacao`/`pontos_imovel` gravados). **Item 3 ✅ 22/11** ([#207](https://github.com/luansoaresribeiro/sales-boost/pull/207)): Teste Zero, Apartamento Leblon marcado "Vida noturna e restaurantes" → "3 coisas perto" com Praia do Leblon, Kurt (restaurante) e Teatro do Leblon (sem a marca seriam praia, metrô e parque); peça `ac3e75fa` arquivada. **Item 4a 🧪** ([#208](https://github.com/luansoaresribeiro/sales-boost/pull/208)): no ar, a primeira frase já nasce da marca ("A varanda desse apartamento…"), mas o teste achou que a receita "detalhe" usava sempre a última foto (quarto) com legenda da varanda, e a nota dizia o contrário → corrigido: todas as receitas de 1 foto usam a foto do cômodo marcado, e a nota só aparece quando ela foi usada. Depois: 4b (formato e imóvel da semana) e 5 |

## Validação comercial — sem prazo; não bloqueia trabalho técnico (dono, 13/11 tarde)

> Bloqueia só: preço do tour, Boosts, preço de lead e Fase 4. **Não citar nos relatórios até o dono retomar.**

| ID | Item | Resp. | Status |
|---|---|---|---|
| V1 | Conversas com imobiliárias pelo roteiro do [PILOTO.md](PILOTO.md) (meta: 3 conversas ou 1 piloto) | Dono | ⏸ pausado pelo dono |
| V2 | Ficha preenchida por conversa | Dono | ⏸ |
| V3 | Consolidar as fichas em [relatorios/](relatorios/) (sem inventar número) | Agente | ⏸ |
| V4 | Revisão dos 3 portões da Fase 4 | Dono + Agente | ⏸ |

## Jornada do cliente (dono, 13/11; registrada em 16/11) — documento primeiro, código só depois da aprovação

> Detalhe, custo, risco e como desfazer de cada item: [JORNADA-DO-CLIENTE.md](JORNADA-DO-CLIENTE.md). 1 PR por item, nesta
> ordem. Cada PR com prints do celular e do desktop, só dado real. **Não muda o tour nem a frente de conteúdo.**

| ID | Item | Resp. | Prior. | Depende de | Pronto quando | Status |
|---|---|---|---|---|---|---|
| J0 | Documento [JORNADA-DO-CLIENTE.md](JORNADA-DO-CLIENTE.md): custo medido, onboarding, upsell, auditoria de telas, menu, modelo de página, glossário | Agente | P0 | — | **Aprovado pelo dono** (merge do PR) | ✅ 16/11: aprovado pelo dono ("pode"), #176 juntado |
| I1 | **Tudo em inglês no modo inglês** (dono, 16/11): textos de tela vindos da ficha e de tabelas ("Meus imóveis", "imóvel", ferramentas, nomes dos formatos), mensagens da Atividade gravadas em português | Agente | P0 | — | Varredura com Playwright em todas as telas, modo EN, sem texto de tela em português (o conteúdo escrito pela IA para o negócio fica no idioma da conta) | 🧪 16/11: ficha (vocabulary_en, name_en dos formatos), ferramentas (name_en/description_en), Atividade e exemplo das Conversas no PR do I1; falta a varredura depois de publicado. O conteúdo escrito pela IA para o negócio (estratégia, notícias, relatórios) fica no idioma da conta |
| I2 | **Conteúdo dos agentes no idioma da conta** (dono, 16/11: "a legenda que eles criam… quando selecionam brazil ou us no cadastro?"): pergunta de idioma dos posts no cadastro; estratégia, pacote do imóvel e insights no idioma da conta | Agente | P0 | — | Conta de teste em inglês gera estratégia e post do imóvel em inglês (SQL) | ✅ 17/11: publicado (#182) e provado no mesmo teste do E1 (conta em `en` → legenda, CTA e hashtags em inglês, post `ea685bd8`) |
| J1 | Custo do grátis: semana pausada para conta parada, teto por conta, estratégia completa semanal (já é quase assim, ver doc §1) | Agente | P0 | J0 | Teste automático das regras + SQL na Teste Zero mostrando a semana pausada e retomada; o post do dia nunca cortado | ⏳ |
| J2 | Correções que atrapalham hoje: pop-up "Seu status de negócio" por cima da tela; avisos de plano contraditórios ("Plano Free", "modo demonstração", cupom com preço) | Agente | P0 | J0 | Prints celular e desktop sem bloqueio e sem aviso contraditório; site publicado e conferido | ⏳ |
| J3 | Onboarding guiado: checklist "Primeiros passos", dica de 1ª visita guardada por conta, no máximo 1 pop-up de evento real por sessão | Agente | P1 | J2 | Conta de teste nova: a checklist marca sozinha com dado real e some no fim; dica aparece 1 vez por conta (outro navegador não repete) | ⏳ |
| J4 | Modelo único de página do agente (frase → precisa de você → o que fez → próximo passo → configurações), começando pelo conteúdo; depois 1 agente por PR | Agente | P1 | J3 | Print de cada página no modelo; ações feitas na própria tela | ⏳ |
| J5 | Upsell contextual para o Pro, gatilho por gatilho, com medição (mostrado/clicado/convertido) e "agora não" por 7 dias | Agente | P2 | J4 | Cada gatilho aparece só com dado real (SQL) e grava as 3 medidas | ⏳ |

## Mercado dos EUA (aberto pelo dono em 17/11)

| ID | Item | Resp. | Prior. | Depende de | Pronto quando | Status |
|---|---|---|---|---|---|---|
| E0 | Liberar o Tim Reyes (Boynton Beach, FL) | Agente | P0 | — | `manual_access=true`, `language='en'`, `auto_strategy=false` (SQL) | ✅ 17/11 (SQL): liberado; em 17/11 à noite, já na ficha dos EUA (`business_type` "Realtor (EUA)" → `imoveis_us`, `language=en`, `auto_strategy=true`) |
| E1 | **Ficha dos EUA** (`imoveis_us`): textos e perguntas em inglês; licença estadual do corretor no lugar do CRECI; frases proibidas de Fair Housing; fontes de notícias dos EUA; a ficha é escolhida pela cidade/país do cadastro, e não só pelo tipo de negócio | Agente | P0 | plano aprovado pelo dono | O Tim gera 1 post em inglês sobre o mercado dele, sem CRECI nem conteúdo do Rio; depois disso, religar os agendamentos dele | ✅ 17/11: ficha `imoveis_us` aplicada (#185 + #186). **Prova:** a Teste Zero foi posta nos EUA só durante o teste e gerou o post `ea685bd8`, com legenda em inglês, "$3,000,000", slides "Bedrooms / Price / The details", sem CRECI e nota 92. Depois a conta voltou para o Rio e o post foi arquivado. Fica para depois: perguntas do cadastro próprias dos EUA e escolha da ficha pelo país |
| E2 | Revisão jurídica dos EUA (Fair Housing, licença, divulgação) | Dono | P1 | — | Parecer registrado no DECISIONS | ⏳ risco aceito em 17/11, sem prazo |

## Frente 1 — Tour Virtual completo

| ID | Item | Resp. | Prior. | Depende de | Pronto quando | Status |
|---|---|---|---|---|---|---|
| 1.0 | Auditoria do tour + viabilidade da Tespon | Agente | P0 | — | Documento entregue + roadmap aprovado | ✅ 13/11 (#167; D1 aprovado) |
| 1.1 | Ambientes físicos (agrupar as fotos do mesmo ambiente) | Agente | P0 | D1 ✅, D4 ✅ (US$ 15) | Testes automáticos ✅ + grupos da Tespon = tabela 2.1 (o dono confere os ❓) | ✅ 20/11: o dono confirmou as 3 dúvidas ("concordo com as 3"): #7 e #33 são **um closet só**; a #27 faz parte do **salão**; #35/#36 são o **Quarto 4 / escritório**. Ambientes da Tespon ajustados: **22**, igual à tabela 2.1. Rótulos renovados sem nome de pessoa (US$ 0,32) |
| 1.2 | Mapa de ligações com evidência (foto que prova cada ligação) | Agente | P0 | 1.1, D4 ✅ | Mapa da Tespon = 2.2, nenhuma ligação inventada; custo medido | 🧪 20/11 ([#189](https://github.com/luansoaresribeiro/sales-boost/pull/189), [#191](https://github.com/luansoaresribeiro/sales-boost/pull/191)), Tespon, **US$ 0,72** (teto US$ 1, 2 chamadas). 18 ligações conferidas: **6 confirmadas, 11 prováveis, 1 desconhecida**. **Nenhuma inventada**: dos 3 erros conhecidos, piscina–salão e jogos–sala de baixo não aparecem, e terraço–salão saiu só **provável**. Das 8 ligações da tabela 2.2, nenhuma saiu "não": Quarto 2–Closet **confirmada**, as 7 do percurso social **prováveis** (a foto não mostra o outro cômodo pela porta). Das confirmadas fora da tabela, conferidas a olho: 3 batem com as fotos (sala–escritório, jogos–salão, quarto 3–banheiro A) e 1 é duvidosa (banheiro B–quarto 4: só pelo espelho; a regra nova "espelho não conta" vale a partir da próxima conferência). Cobertura: 10 de 24 ambientes com ligação confirmada (19 com provável). **Provisório** até o dono fechar as ❓ do 1.1. **Atenção para o 1.3/1.4:** "provável" inclui um erro conhecido, então não vale como prova; vira "confira no vídeo" ou "falta foto". **20/11, depois do 1.1 ✅ (não é mais provisório):** **8 de 22 ambientes com ligação confirmada**, 0 inventadas (o espelho agora não conta). A IA acha pares diferentes a cada rodada, por isso a prova encontrada passou a ser guardada entre rodadas (#193). Custo total do mapa até aqui: US$ 1,60 (4 rodadas) |
| 1.3 | Indicador de cobertura + lista de fotos que faltam (com ângulo) na tela | Agente | P0 | 1.2 | A tela mostra os pendentes da Tespon e a lista 2.3; print aprovado | ✅ 20/11 ([#193](https://github.com/luansoaresribeiro/sales-boost/pull/193)): a tela do Tour virtual mostra "8 de 22 ambientes com passagem comprovada por foto", os ambientes por área (✓ comprovado / ◐ confira / ○ sem foto) e **16 fotos que faltam**, cada uma com o lugar e o ângulo, mais o botão "copiar lista". Custo para mostrar: US$ 0. Comparada com a tabela 2.3, a lista cobre corredor, quartos e banheiros, lavabo, piscina, área gourmet, quadra e jogos; **não** gera as 2 fotos da escada (nenhuma foto mostra aonde ela chega, então o mapa não tem a ligação para pedir) nem a fachada (opcional na 2.3). Melhoria anotada: pedir a foto da escada quando um ambiente tem escada e nenhuma ligação de andar. Prints do computador e do celular enviados ao dono. **✅ 20/11: print aprovado pelo dono ("aprovado").** |
| 1.3b | **Exemplos no topo do Tour virtual (B):** o tour completo e o mobiliado, antes da lista de imóveis | Agente | P1 | 1.3; dono 20/11: 2º exemplo = **Mobiliar cômodo vazio**; **tour da Tespon autorizado** como exemplo público | Os 2 exemplos aparecem antes da lista (print desktop e celular), com material real já existente; site no ar conferido | 🧪 20/11: topo do Tour virtual com "O que dá para fazer": **tour completo** (vídeo real da Tespon de 13/11, autorizado pelo dono) e **mobiliar cômodo vazio** com "Exemplo em breve" (sem foto boa ainda; ver 1.3c). Material vem da ficha (`config.tour.examples`, migration que só acrescenta). O texto do mobiliado diz para conferir paredes e janelas (não promete o que o 1.3c ainda não garante). Prints do computador e do celular ok; a lista de imóveis continua logo abaixo. **Falta:** site no ar e o exemplo do mobiliado |
| 1.3c | **Mobiliar inventou arquitetura** (20/11, Tespon): num terraço aberto (foto real com a Pedra da Gávea), o resultado ganhou teto, paredes e janela. Fere a regra 4. Precisa de trava antes de virar exemplo ou post | Agente | P1 | — | Conferência automática: compara a foto mobiliada com a real (céu, paredes, janelas) e recusa quando a arquitetura muda; e a ficha só aceita cômodo interno vazio | ✅ 20/11 ([#197](https://github.com/luansoaresribeiro/sales-boost/pull/197)): prova ao vivo na Tespon — o mesmo terraço mobiliado de novo saiu **recusado** com os motivos "criou ou tirou teto/cobertura; mudou paredes; mudou janelas ou portas; mudou a vista ou o céu" (pedido `b55066ea`). A foto não chega ao imóvel. Custo medido da conferência: **US$ 0,027** por foto (a estimativa de US$ 0,01 estava baixa) |
| 1.4 | Tour em partes + conferência de destino | Agente | P1 | 1.3 ✅, D3 ✅ | Testes automáticos + revisão do dono | 🔨 20/11: **tour em partes** pronto no código (`_shared/tourParts.ts` + `plan_parts` + tela): partes social/íntima/lazer, ≤ 8 passagens cada, **só por ligação confirmada** (a provável só com "incluir prováveis", marcada); externa e serviço entram na parte da área a que estão ligadas; parte longa vira 2 e a 2ª reabre o último ambiente; **todo ambiente fica numa parte ou na lista de pendentes** (teste). Na Tespon hoje: 4 partes curtas, 8 de 22 ambientes, o resto espera as fotos que faltam. Custo: US$ 0. **Falta:** a conferência de destino (último quadro × foto de destino, seção 3 item 5) e a revisão do dono. **Atenção A3:** gerar uma parte cria peça em Aprovações; na A3 isso só depois de ela concordar (condição 6). **20/11, A3 (Apartamento Ipanema, 16 fotos; backup `backup_a3_items_20261120`, só leitura pelo servidor):** 9 ambientes (US$ 0,11), **0 passagens confirmadas**, 7 prováveis (US$ 0,25). Sem prováveis, nenhuma parte; com prováveis, 3 partes curtas. Achado: as "prováveis" vinham do "sim" padrão da conferência do tour (dois cômodos internos no mesmo andar), que não prova nada — corrigido para só aceitar quando a porta/escada apareceu; e o pedido de foto da fachada agora pede o caminho até a entrada. **21/11:** o dono aprovou os cômodos (Quarto 1: fotos 4 e 13; Quarto 2: foto 5; Quarto 3: fotos 9–11; Escritório: foto 12, talvez dependência adaptada). Mapa refeito com a regra nova, **US$ 0** (reaproveitou a análise paga): 0 confirmadas. Lista de ~10 fotos de passagem entregue ao dono para ele encaminhar ao corretor (nada enviado por mim). **Aguardando as fotos no cadastro** → nova análise (~US$ 0,40, avisada antes) e montagem das partes |
| 1.5 | Teste de ponta a ponta, imóvel inteiro (**imóvel da A3**, D2 20/11) | Agente + Dono | P0 | 1.4, D2 (imóvel), D4 ✅ | Os 7 critérios da seção 3, todos ✅, quadro a quadro; custo registrado | ⏳ espera as fotos de passagem da A3 (lista entregue ao dono em 21/11) |

## Frente 2 — Motor próprio de vídeo (só começa com a Frente 1 validada)

| ID | Item | Resp. | Prior. | Depende de | Pronto quando | Status |
|---|---|---|---|---|---|---|
| 2.1 | Contêiner com o `worker.mjs` (mesma fila `media_jobs`) | Agente | P1 | 1.5, D4 | Monta o trabalho de teste igual à VPS | ⏳ |
| 2.2 | Modo sombra: 10 trabalhos reais nos dois lugares | Agente | P1 | 2.1 | Equivalência (duração ±0,1 s, 1080×1920, fusões, capa, encerramento) | ⏳ |
| 2.3 | Contêiner principal, VPS de reserva | Agente | P1 | 2.2 | 14 dias sem falha | ⏳ |

## Frente 3 — Infraestrutura (VPS e Telegram) — NADA é apagado sem autorização do dono

| ID | Item | Resp. | Prior. | Depende de | Pronto quando | Status |
|---|---|---|---|---|---|---|
| D5 | Telegram: quais avisos viram e-mail; aviso para a A3 | Dono | P1 | D1 | Decisão registrada | ✅ 16/11 (ver a tabela de decisões acima) |
| D6 | VPS: quanto tempo fica de reserva depois da troca | Dono | P2 | 2.3 | Decisão registrada | ⏳ |
| 3.1 | Substitutos por e-mail (alertas da plataforma e de lead) | Agente | P1 | D5 | Alerta de teste chega | 🧪 alertas da plataforma por e-mail no #174; falta o alerta de teste chegar e o alerta de lead |
| 3.2 | Conferir se os bots antigos (`marketing-bot`, `vendas-bot`, `group-manager`) estão publicados | Agente | P2 | — | Lista do que está no ar | ⏳ |
| 3.3 | Desligar Telegram e VPS por flag (sem apagar) | Agente | P2 | 2.3, 3.1, **autorização** | Checklist da seção 6 do plano | **Telegram:** 🧪 #174 juntado em 16/11; `telegram_enabled` e `telegram_buddy` = desligados no banco em 16/11 (SQL). Falta a prova no log. **VPS:** ⏳ depois da Frente 2 |
| 3.4 | Apagar estrutura antiga | Agente | P3 | 3.3 + 14 dias + **2ª autorização** | Nada perdido (checklist) | ⏳ |
| 3.5 | Tirar a aba "Notificações" de Configurações (só a tela; código e preferências ficam) | Agente | P1 | pedido do dono 19/11 | Aba some (print desktop e celular), `?tab=integracoes` não quebra, site no ar conferido | ✅ 21/11: **no site publicado** (getsaleboost.com, Teste Zero, desktop e celular) Configurações mostra só Informações da empresa · Conexões · Sua conta; `?tab=integracoes` abre Informações; no bundle no ar a lista de abas é `[info, conexoes, conta]` |

## Frente 4 — Experiência do usuário (depois do fluxo do tour definido)

| ID | Item | Resp. | Prior. | Depende de | Pronto quando | Status |
|---|---|---|---|---|---|---|
| 4.1 | Auditoria completa da jornada (prints no celular e no desktop), incluindo a tela do agente de conteúdo (C4) | Agente | P1 | 1.5 | Relatório aprovado pelo dono | ⏳ A auditoria de telas foi antecipada no J0 (16/11), a pedido do dono |
| 4.2 | Simplificações aprovadas, uma por PR | Agente | P1 | 4.1 | Print de cada uma + site publicado | ⏳ |

## Já validado (histórico)

| Item | Validação |
|---|---|
| Tour contínuo, área social da Tespon, 8 ambientes | Vídeo de 13/11: 0 cortes, conferido quadro a quadro, US$ 3,528 ([MEDIA-ENGINE.md](MEDIA-ENGINE.md)) |
| Legenda do tour cita só os ambientes reais | #166 + teste automático; publicado pelo workflow em 13/11 |
