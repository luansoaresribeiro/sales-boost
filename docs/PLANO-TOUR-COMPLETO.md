# Plano — Tour Virtual completo, motor próprio de vídeo e independência de VPS/Telegram

> **Status: APROVADO pelo dono em 2026-11-13 (D1)**: as 4 frentes, uma por vez. Gasto externo e os itens marcados 🔴 continuam
> dependendo da aprovação dele (D2–D7, ver [PENDENCIAS.md](PENDENCIAS.md)). Status original desta linha: "PROPOSTA (2026-11-13),
> aguardando aprovação do dono".
> Pedido do dono de 13/11: primeiro investigar, depois recomendar, e só implementar com autorização.
>
> Pendências e status de cada item: [PENDENCIAS.md](PENDENCIAS.md), a lista central. Este arquivo é o "porquê" e o
> "como"; PENDENCIAS é o "o que falta".
>
> **Como esta auditoria foi feita:** sem gastar crédito.
> - Código lido no `main` de 13/11.
> - Banco consultado só em leitura (Tespon, Teste Zero e A3; a Liga dos Sonhos não foi consultada).
> - As 50 fotos da Tespon foram analisadas visualmente por mim, sem chamar IA paga.
> - Nenhum vídeo foi gerado.

## 0. Regra de produto (dono, 13/11)

Quando uma imobiliária pede o tour de um imóvel, o resultado precisa representar o imóvel **inteiro**:
- todos os ambientes identificados aparecem;
- nenhuma passagem é inventada;
- nenhum cômodo some sem aviso.

O resultado pode ser **mais de um vídeo**, organizado por área, desde que, juntos, cubram tudo e apareçam como
partes do mesmo tour. Dividir em partes nunca pode servir para esconder ambiente que ficou de fora.

## 1. Diagnóstico da arquitetura atual (o que EXISTE hoje)

| # | Pergunta | Como funciona hoje | Onde |
|---|---|---|---|
| 1 | Como identifica os cômodos? | IA de visão dá a cada foto um **tipo** (`quarto`, `sala`, `varanda`…), uma confiança e uma nota de qualidade. Isso é gravado uma vez em `meta.photos[i]`. | `_shared/photoScore.ts` |
| 2 | Como sugere a ordem? | 1 foto "de fora" (fachada/vista), depois a melhor foto de cada **tipo**, na ordem da ficha (`walk_order`). No máximo 2 por tipo e 15 no total. | `_shared/tourOrder.ts` → `orderTour` |
| 3 | Como sabe se 2 ambientes se ligam? | Conferência v4 (Sonnet 5.5) por par de fotos **consecutivas**. Ela extrai fatos (fora/dentro, escada em cada foto, mesmo andar, porta visível) e uma regra fixa decide. | `_shared/passageCheck.ts` |
| 4 | Como valida porta, corredor, escada? | Pelos fatos acima: de fora para dentro exige porta visível; andar diferente exige escada na foto de origem; escada só na foto de destino bloqueia. | `decidePassage` |
| 5 | Quando uma passagem é segura? | Quando a conferência diz "sim". "Não" bloqueia a geração até o dono incluir a foto que falta ou marcar "gerar mesmo assim". | `creative-generate` `tour_piece` |
| 6 | Passagem desconhecida? | "Incerto" de fora para dentro bloqueia. Nos outros casos, a tela marca a passagem em amarelo ("confira no vídeo"). | `TourBuilder.tsx` |
| 7 | Como evita chegar ao ambiente errado? | **Não evita por completo.** A IA vê a porta, mas não sabe para onde ela dá (reteste de 11/11: terraço → salão chegou na sala de baixo). Hoje quem garante isso é o dono assistindo antes de aprovar. | — |
| 8 | Continuidade visual? | Cada trecho é um vídeo Kling com foto de começo e foto de fim. O próximo trecho começa na mesma foto, e o estúdio junta tudo com fusão de 0,5 s. | `_shared/tourEngine.ts` + VPS |
| 9 | Limites atuais | 15 fotos por tour (máximo do código: 16); 6 s por passagem; US$ 0,504 por passagem (medido); teto de gasto do mês por cliente (`spendCap`). | ficha `config.tour`, `item-videos` |
| 10 | Problemas na geração e finalização | Ver a lista abaixo. | — |

**Problemas encontrados (o que impede o "imóvel inteiro"):**

1. **🔴 O sistema pensa em TIPO de cômodo, não em AMBIENTE físico.**
   - Tudo o que a IA chamou de "varanda" vira uma coisa só: terraço, piscina, churrasqueira, quadra, pátio. O mesmo vale para "sala": sala de estar, salão de festas, sala de jogos. E 4 quartos diferentes viram "quarto".
   - O `orderTour` pega no máximo 2 fotos por tipo, então **ambientes inteiros somem sem aviso**.
   - O aviso "cômodos fora do tour" (`missing_rooms`) também conta por tipo, então nunca avisa que faltou o quarto 3.
   - Esta é a causa principal.
2. **🔴 Não existe mapa de ligações do imóvel.**
   - A conferência só olha pares na ordem que já foi montada. Ninguém pergunta "por onde se chega na churrasqueira?".
   - Por isso o sistema não sabe dizer quais fotos de ligação faltam para o imóvel inteiro. Só sabe dizer isso para a passagem que o dono montou.
3. **🟠 Mesmo tipo nunca liga.**
   - `linked()` recusa quarto → quarto, o que é certo para dois quartos diferentes.
   - Mas também recusa duas fotos do **mesmo** quarto, que seria uma passagem segura.
4. **🟠 Um vídeo só, com no máximo 15 fotos.** Não existe "tour em partes" (área social, área íntima, lazer) ligado ao mesmo imóvel.
5. **🟠 A conferência não verifica o destino.**
   - Ela confirma que existe uma porta, mas não que a porta leva ao ambiente da próxima foto.
   - Fica pendente uma checagem do tipo "o que aparece pela porta na foto A combina com a foto B?".
6. **🟡 Legenda.** Inventava fachada e varanda no texto. **Corrigido no #166:** agora a legenda recebe a lista dos ambientes reais.
7. **🟡 Finalização depende da VPS da Hostinger.** Ver a seção 4.
   - Sem a VPS, o tour completo **não sai**: a tela avisa "estúdio fora do ar".
   - O vídeo grátis do teste (`freeKit`) cai na colagem antiga, que é 4:5 e sem encerramento.

## 2. Viabilidade do tour completo — caso Tespon (50 fotos, análise visual sem custo)

> Os dados do cadastro da Tespon (180 m², 8º andar) são **valores de teste** (`test_data_note`, 02/11).
> As fotos mostram uma casa ou cobertura grande, com área de lazer no alto. O mapa abaixo vem **só das fotos**.

### 2.1 Ambientes físicos identificados (22; os marcados com ❓ são incertos)

| Área | Ambiente | Fotos (#índice) | O tipo que o sistema deu |
|---|---|---|---|
| Social | Terraço com pérgola | 2, 40 | varanda |
| Social | Sala de estar (com escada) | 1, 49 | sala / sem nota |
| Social | Sala de jantar | 0, 48 | sala_jantar / sem nota |
| Social | Copa (mesa redonda de mármore) | 3, 6 | sala_jantar / hall |
| Social | Despensa / área de serviço | 43 | area_servico |
| Social | Escritório (quadro colorido, piso de pedra) ❓ | 47 | hall |
| Social | Lavabo ❓ | 44, 46 | banheiro |
| Íntima | Corredor dos quartos | 41 | corredor |
| Íntima | Suíte principal (parede de armários brancos) | 9, 30, 32; 10 e 11 ❓ (podem ser a mesma suíte, de outro ângulo) | quarto |
| Íntima | Banheiro da suíte principal | 28, 29 | banheiro |
| Íntima | Quarto 2 (cabeceira cinza, manta azul) | 4, 34, 39 | quarto |
| Íntima | Closet do quarto 2 | 7, 33 | quarto |
| Íntima | Quarto 3 (luminária de skate) | 42, 45 | quarto |
| Íntima | Quarto 4 / home office (armários, sem cama) ❓ | 35, 36 | quarto |
| Íntima | Banheiro A (granito azul) | 5, 38 | banheiro |
| Íntima | Banheiro B (branco, box) | 8, 31; 37 ❓ (pode ser um 3º banheiro) | banheiro |
| Lazer | Salão de festas (teto de madeira, sofá de couro) | 13, 14, 27 | sala |
| Lazer | Sala de jogos (pebolim, aero hockey) | 22, 23 | sala |
| Lazer | Área gourmet / churrasqueira | 24, 25, 26 | varanda |
| Lazer | Piscina e deck (vista da Pedra da Gávea) | 12, 15, 18, 19 | varanda |
| Lazer | Quadra coberta (grama sintética) | 16, 17, 20 | outro / varanda |
| Lazer | Pátio com cadeiras ❓ | 21 | varanda |

**O tour de 13/11 cobriu 8 de 22 ambientes** (36%): terraço, sala, jantar, despensa, copa, corredor, suíte e banheiro da suíte.

### 2.2 Mapa de ligações

```
Legenda:  ══ comprovada (foto mostra + conferência v4 "sim" + vídeo de 13/11 conferido)
          ── visível na foto (análise minha; falta conferência)
          ?? desconhecida (nenhuma foto mostra)

ÁREA SOCIAL (comprovada)
 Terraço ══ Sala de estar ══ Jantar ══ Despensa ══ Copa ══ Corredor ══ Suíte ══ Banho suíte
                │
                └── ESCADA (vista só de baixo, #1/#49) ── ?? (onde ela chega: desconhecido)

 Copa ?? Escritório (#47)          Copa/Sala ?? Lavabo (#44/#46)

ÁREA ÍNTIMA
 Corredor (#41: 1 foto, olhando numa só direção)
   ?? Quarto 2 ── Closet 2      (o #34 mostra a porta aberta do closet)
   ?? Quarto 3 ── ?? (o #45 mostra uma porta aberta; o destino não aparece)
   ?? Quarto 4 / home office
   ?? Banheiro A  ?? Banheiro B

ÁREA DE LAZER (andar desconhecido)
 Salão de festas ── (vidraças para fora, #13) ?? Piscina/deck
 Piscina ── (estrutura coberta ao fundo, #18) ?? Área gourmet
 Sala de jogos ?? Salão     Quadra coberta ??     Pátio (#21) ??
```

**Conclusão: com as 50 fotos de hoje, NÃO é possível montar o imóvel inteiro sem inventar passagens.**
- Comprovado: 1 percurso de 8 ambientes, que é o vídeo de 13/11.
- Mais 1 par seguro: Quarto 2 → Closet.
- O resto (11 a 13 ambientes) não tem foto que prove por onde se chega.

### 2.3 Fotos adicionais necessárias (para quem for fotografar)

| # | Onde ficar | Para onde apontar | O que a foto precisa mostrar | Libera |
|---|---|---|---|---|
| 1 | No meio da escada da sala | Para cima | Os degraus e o patamar onde a escada chega | sala → andar de cima |
| 2 | No topo da escada | Para o ambiente onde ela chega | O primeiro ambiente do andar de cima | andar de cima |
| 3 | No corredor dos quartos (#41), na outra ponta | Para o lado oposto ao do #41 | As portas dos quartos e banheiros, abertas | todos os quartos |
| 4 | Em cada porta de quarto, de fora (4 fotos) | Para dentro do quarto | Porta aberta + interior | quartos 2, 3, 4 e suíte |
| 5 | Em cada porta de banheiro do corredor, de fora (2 fotos) | Para dentro | Porta aberta + interior | banheiros A e B |
| 6 | Na copa (#6) ou na sala | Para a porta do lavabo e para a do escritório | As duas portas e o que se vê por elas | lavabo, escritório |
| 7 | Dentro do salão de festas | Para a vidraça ou porta que dá na piscina | A porta e a piscina do outro lado | salão → piscina |
| 8 | No salão ou no corredor do lazer | Para a sala de jogos | A abertura entre os dois ambientes | salão → jogos |
| 9 | No deck da piscina | Para a área gourmet | O caminho até a churrasqueira | piscina → gourmet |
| 10 | No deck ou na gourmet | Para a quadra coberta | O acesso à quadra | → quadra |
| 11 | Do lugar de onde se chega ao pátio do #21 | Para o pátio | A porta ou passagem para o pátio | pátio |
| 12 (opcional) | Na rua ou no portão | Para a fachada e a porta de entrada | A entrada principal | abertura "de fora" verdadeira |

São cerca de 15 a 17 fotos novas. Com elas, a estimativa é cobrir os 22 ambientes **em 3 vídeos**:
- **Social:** cerca de 9 fotos.
- **Íntima:** cerca de 11 fotos.
- **Lazer:** cerca de 8 fotos.

A Tespon é conta de teste. **Quem tira essas fotos é decisão do dono** (ver D2).

## 3. O que conta como "tour completo" (proposta de critério de aprovação)

Um tour só é **completo** quando todas as condições abaixo valem ao mesmo tempo:

1. **Cobertura 100%.** Todo ambiente físico identificado aparece em algum vídeo do tour, **ou** está marcado pelo dono como "fora do tour", com o motivo registrado.
2. **Passagens verificadas.** Toda passagem está comprovada por foto e pela conferência, **ou** foi aprovada uma a uma pelo dono ("gerar mesmo assim"), com registro de quem aprovou e quando.
3. **Zero passagem inventada.** Na revisão quadro a quadro não aparece parede, porta, corredor ou escada que não exista nas fotos.
4. **Ordem espacial coerente.** Cada vídeo é um caminho do mapa de ligações, sem "teletransporte" entre ambientes.
5. **Destino correto.** O último quadro de cada passagem corresponde à foto de destino. Proposta: uma checagem automática de semelhança entre o último quadro e a foto, mais a revisão humana.
6. **Legenda fiel.** Cita só os ambientes que aparecem, na ordem em que aparecem.
7. **Revisão humana.** Nada é publicado sem o dono aprovar.

**Tour em partes.** Um imóvel grande vira um "tour do imóvel" com N partes. Cada parte é um vídeo de até ~8 passagens (~50 s), adequado para Reels.
- Partes sugeridas: Social, Íntima, Lazer e Externa.
- Cada parte mostra "Parte 2 de 3 · Área íntima".
- Uma parte pode reabrir o último ambiente da anterior, para dar continuidade lógica.

**Indicador de cobertura** (tela do Tour virtual):

```
Ambientes: 22 identificados · 8 no tour · 1 pronto para entrar · 13 pendentes
Pendentes: Quarto 3 — falta foto da porta vista do corredor  [ver exemplo de ângulo]
           Piscina  — falta foto da passagem salão → piscina
```

## 4. Motor próprio de vídeo

### 4.1 O que a VPS faz hoje (inventário completo)

A VPS faz **um único tipo de trabalho**: `reel_finish`. O código é **nosso**: o `public/vps/worker.mjs` (261 linhas, Node 20 + ffmpeg) roda lá. Os passos:

| Função | Quem faz hoje |
|---|---|
| Gerar o movimento (o "drone" entre duas fotos) | **Higgsfield/Kling** (API externa), nunca a VPS |
| Baixar os trechos prontos | VPS |
| Passar para vertical 1080×1920 com fundo desfocado | VPS (ffmpeg `scale` + `boxblur`) |
| Fusão de 0,5 s entre trechos | VPS (ffmpeg `xfade`) |
| Fade de entrada e saída, 30 fps, áudio mudo AAC | VPS |
| Encerramento com logo + "Me chama no direct" | A **imagem** é feita pelo `render-format` (Supabase). A VPS só a anexa ao final. |
| Capa (jpg) | VPS |
| Envio para o Storage | VPS, por URL assinada gerada pela `vps-worker` (a VPS nunca recebe a chave de administração) |
| Fila de trabalhos e "estou vivo" | `media_jobs`, `worker_nodes`, `vps-worker` (Supabase) |
| Publicação no Instagram | **Não é a VPS.** É o `agent-actions`, sempre com aprovação do dono. |
| Texto e legenda | Não é a VPS: `creative-generate` |

**Uso real:**
- 18 trabalhos feitos, de 03/11 a 13/11, em média 70 s cada, nenhum falhou.
- Servidor: 2 CPUs, 8 GB, ffmpeg 6.1.

**Quem depende da VPS:**
- tour completo e vídeos de imóvel (`item-videos`);
- tour do calendário (`creative-generate`);
- vídeo grátis do teste (`freeKit`);
- monitor da plataforma (`platform-monitor`).

### 4.2 Alternativas comparadas

O ffmpeg em si não é o problema: ele é o padrão da indústria, grátis e controlado por nós. A questão é **onde ele roda**.

| Opção | Custo por vídeo (estimado) | Qualidade | Manutenção | Independência | Observação |
|---|---|---|---|---|---|
| A. VPS Hostinger (hoje) | Mensalidade fixa (fatura do dono) | ffmpeg | Alta: servidor nosso, atualização manual | Presa a 1 servidor | Funciona. Ponto único de falha. |
| B. **Contêiner sob demanda** (Google Cloud Run Jobs ou Cloudflare Containers) com o **mesmo** `worker.mjs` | ~US$ 0,005–0,02 (70 s de CPU; **a medir**) | Idêntica (mesmo ffmpeg) | Baixa: imagem Docker versionada no repositório | Alta: o contêiner roda em qualquer nuvem | **Recomendada.** Reaproveita o código testado. |
| C. API de montagem pronta (Shotstack, Creatomate) | ~US$ 0,10–0,40 por minuto renderizado (**a confirmar**) | Boa, com menos controle | Baixíssima | Troca uma dependência por outra | Bom plano B. Caro em volume. |
| D. ffmpeg dentro da Edge Function (WASM) | — | — | — | — | **Inviável:** limite de CPU e memória da função. |
| E. GitHub Actions como servidor de vídeo | Grátis até a cota | ffmpeg | Média | Média | Não é feito para produção: fila e tempo de espera imprevisíveis. |

**Recomendação: opção B, em 3 passos, sem desligar a VPS.**
1. Empacotar o `worker.mjs` num contêiner (Dockerfile no repositório) que fala com a mesma fila `media_jobs`.
2. **Rodar em paralelo**, em modo sombra: o mesmo trabalho é montado nos dois lugares e o resultado do contêiner vai para uma pasta de teste. Comparar duração, resolução, quadros e semelhança.
3. Com N trabalhos idênticos, passar o contêiner a ser o principal e deixar a VPS como reserva. Ela só é desligada na Frente 3, com autorização.

**Limitações:**
- Um provedor de nuvem novo é gasto novo e precisa de aprovação (D4).
- O primeiro trabalho de um contêiner frio pode levar ~10 a 30 s a mais.
- **O movimento continua vindo do Kling.** "Motor próprio" significa que a orquestração, as regras, a montagem e a finalização são nossas, não que temos um modelo de IA próprio.

## 5. Telegram — inventário (só leitura)

**Quem tem Telegram conectado hoje** (sem contar a Liga dos Sonhos, que não foi consultada além de "conectada: não"):
- **A3 Imóveis**, cliente real.

**Uso nos últimos 30 dias:**
- 12 respostas de chat, 5 avisos de ação, 3 mudanças de estratégia, 2 relatórios semanais, 2 avisos de oportunidade, 1 relatório mensal;
- 0 conversas novas registradas.

| Função | Onde | Em uso? | Já existe no SalesBoost? | Precisa substituto? | Pode desligar? |
|---|---|---|---|---|---|
| Conectar o Telegram do cliente | `telegram-connect`, `telegram-link` | Sim (A3) | — | — | Só depois de avisar a A3 |
| Conversa com o "agente" pelo chat | `telegram-webhook` → `telegram-chat` | Pouco (12 em 30 dias) | Parcial (`agent-chat` no painel) | Talvez | Sim, após a decisão D5 |
| Pedido de aprovação com botões (✅/❌) | `telegram-buddy` (a cada 10 min) + `agent-actions telegram_decide` | Sim | **Sim:** página Aprovações + sino | Não | Sim, depois de conferir que o sino cobre tudo |
| Relatórios semanal, mensal e anual | `periodic-report` (crons) | Sim | Parcial (página Relatórios) | Talvez e-mail | Após D5 |
| Aviso de oportunidade e de estratégia | `marketing-ai`, `strategy-generate`, `detect-opportunities` | Sim | Sim (sino, Atividade) | Não | Sim |
| Alerta de lead novo | `hermes-lead-alert` | A confirmar | Parcial (Funil) | **Sim:** e-mail ou push. Lead não pode passar despercebido. | Só com substituto |
| Varredura diária (Hermes) | `hermes-daily-scan` (cron 11:00) | Sim | Não | A avaliar | A avaliar |
| **Alertas da plataforma para o dono do SalesBoost** | `platform-monitor` → `monitor_config.admin_telegram_chat_id` | **Sim** | Página Saúde da plataforma (sem aviso ativo) | **Sim** (e-mail) | **Não**, até haver substituto |
| Bots antigos `marketing-bot`, `vendas-bot`, `group-manager` | `src/workers/*` (Cloudflare) | A confirmar (código antigo) | — | — | Conferir se estão publicados |
| Relatório diário (`enzo-daily-report`, `daily-briefing`) | Sem cron em produção | Não (achado de 04/11) | — | — | Sim |

## 6. Plano seguro de migração e desativação (VPS e Telegram)

Ordem para cada um:

1. **Inventário** (este documento).
2. **Construir o substituto.**
3. **Rodar em paralelo**, com teste de equivalência.
4. **Trocar.**
5. **Período de reserva:** a estrutura antiga fica ligada, sem uso, por ≥ 14 dias.
6. **Conferência final:** nenhuma função perdida, com checklist.
7. **Autorização do dono.**
8. **Desligar** (feature flag ou cron), sem apagar.
9. **Apagar** (servidor, crons, código) só numa 2ª autorização.

**VPS:**
- **Teste de equivalência:** 10 trabalhos reais montados nos dois lugares. Mesma duração (±0,1 s), 1080×1920, mesma quantidade de fusões, capa gerada e encerramento presente.
- **Contingência:** a flag `vps_reel_finish` volta tudo para a VPS em 1 minuto.
- **Desligar:** só a flag e o serviço. O servidor da Hostinger e as credenciais ficam até a autorização.

**Telegram:**
- **Antes de desligar:**
  - substituto por e-mail para os alertas da plataforma e de lead;
  - conferir que o sino e a página Aprovações cobrem tudo o que o `telegram-buddy` avisa;
  - avisar a A3.
- **Desligar:** `feature_flags.telegram_buddy` e os crons de Telegram, um por um. O código e as tabelas ficam.

**Nunca, em nenhuma etapa:** apagar conta, dado, configuração ou credencial sem a autorização explícita do dono.

## 7. Experiência do usuário — pré-auditoria (a auditoria completa é a Frente 4)

O que já se sabe pelo código e pelos testes desta semana (nada alterado):

- **Menu:** 4 grupos.
  - **Marketing AI:** painel, Agentes, Tour virtual, Imóveis.
  - **Progresso.**
  - **Central do dono:** Aprovações, Relatórios.
  - **Configurações.**
  - O site tem 45 rotas.
- **🔴 O aviso "Seu status de negócio" aparece por cima do painel** e bloqueia cliques (visto nos testes de 12/11).
- **🟠 Tour virtual:**
  - o dono precisa entender "passagem", "ligação" e "gerar mesmo assim";
  - não existe indicador de cobertura, então ele não sabe o que ficou de fora.
- **🟠 Conceitos repetidos:** Atividade (sino), Aprovações, Relatórios e Progresso mostram partes do mesmo fluxo em lugares diferentes.
- **🟡 Termos técnicos na tela** a revisar: "pilar", "família", "estratégia ativa".

**Método da auditoria completa (Frente 4):**
- Jornada nova no navegador de teste, com uma conta de teste nova: cadastro → 1º post → aprovação → publicação simulada → tour → resultado.
- Prints no celular e no desktop.
- Lista por impacto × esforço × dependência.
- Nenhuma tela é alterada antes da aprovação do dono.

## 8. Roadmap recomendado (uma frente por vez)

Mantenho a ordem do dono, com um ajuste: a Frente 2 começa só **depois** do teste de ponta a ponta da Frente 1. Assim a mudança de servidor não se mistura com a mudança do tour.

| Frente | Etapa | Entrega | Pronto quando (validação) |
|---|---|---|---|
| **1 Tour completo** | 1.1 | **Ambientes físicos:** agrupar as fotos do mesmo ambiente ("Quarto 2" ≠ "Quarto 3") | Na Tespon, os grupos batem com a tabela 2.1 (o dono confere os ❓) |
| | 1.2 | **Mapa de ligações:** cada ligação com a foto que a prova; o resto marcado como desconhecido | Na Tespon, o mapa bate com o 2.2, sem nenhuma ligação inventada |
| | 1.3 | **Cobertura + lista de fotos que faltam,** com ângulo, na tela | A tela lista os ambientes pendentes e as fotos da tabela 2.3 |
| | 1.4 | **Tour em partes** (vários vídeos de um mesmo tour) e conferência de destino (seção 3, item 5) | Testes automáticos + revisão |
| | 1.5 | **Teste de ponta a ponta** com um imóvel de fotos completas | Critérios da seção 3, todos ✅, conferidos quadro a quadro |
| **2 Motor próprio** | 2.1 | Contêiner com o `worker.mjs` | Monta o trabalho de teste igual à VPS |
| | 2.2 | Modo sombra com 10 trabalhos reais | Equivalência da seção 6 |
| | 2.3 | Contêiner principal, VPS de reserva | 14 dias sem falha |
| **3 Infraestrutura** | 3.1 | Substitutos por e-mail (alertas da plataforma e de lead) | Alerta de teste chega |
| | 3.2 | Desligar Telegram e VPS (flags), **com autorização** | Checklist da seção 6 |
| **4 Experiência** | 4.1 | Auditoria completa da jornada | Relatório com prints aprovado pelo dono |
| | 4.2 | Simplificações aprovadas | Uma por PR, com print |

## 9. Custos (estimativas; nada aqui é custo confirmado)

| Item | Valor | Fonte |
|---|---|---|
| Passagem (6 s de Kling) | US$ 0,504 | **Medido** (7 de 7 em 13/11) |
| Nota da foto (ambiente + qualidade) | ~US$ 0,003 por foto | Estimado |
| Conferência de ligação | ~US$ 0,01 por par | Estimado (Sonnet 5.5) |
| Mapa de ligações (1.2) para 50 fotos | ~US$ 0,30–0,80 por imóvel, uma vez | **Estimado; a medir na 1.2** |
| Montagem na VPS | Mensalidade fixa | Fatura do dono (não tenho o valor) |
| Montagem em contêiner (opção B) | ~US$ 0,005–0,02 por vídeo | **Estimado; a medir na 2.2** |
| Armazenamento | Vídeo de 41 s ≈ 20 MB | Medido (tamanho). O preço por GB depende do plano Supabase. |
| Tentativa adicional | US$ 0,504 por passagem refeita | Medido. Refazer só 1 passagem sem pagar as outras **ainda não existe**. |
| **Imóvel completo tipo Tespon** | ~23 passagens ≈ US$ 11,60, + 20% de reserva para falhas ≈ **US$ 14** | Estimado, a partir do medido |
| Imóvel médio (apartamento de 2 quartos, ~8 ambientes) | ~7 passagens ≈ US$ 3,50–4,20 | Estimado |

**Comparação da arquitetura atual com a proposta:** o custo grande é o Kling, igual nas duas.
- **A troca da VPS** muda pouco o custo por vídeo. Ela muda o risco (ponto único de falha) e a manutenção.
- **A cobertura completa** aumenta o custo por imóvel (de ~US$ 3,50 para ~US$ 14 num imóvel grande). Isso precisa entrar na conta dos Boosts (`PRODUCT.md`).

## 10. Decisões que dependem do dono

| # | Decisão | Por que importa |
|---|---|---|
| D1 | Aprovar este roadmap e a ordem das frentes | ✅ **Aprovado em 13/11** |
| D2 | Quem tira as fotos que faltam na Tespon, ou se o teste de ponta a ponta usa outro imóvel em que dá para fotografar | Sem as fotos, a 1.5 não fecha |
| D3 | Tamanho máximo de cada parte do tour (proposta: ~8 passagens, ~50 s) | Define as partes e o custo |
| D4 | Verba de teste da Frente 1: IA de visão da 1.1/1.2 (~US$ 0,30–0,80 por imóvel) + vídeo do teste (proposta: até US$ 15 no total). Também a Frente 2 (provedor de nuvem novo) | Gasto novo (🔴: o agente gasta US$ 0 sem aprovação) |
| D7 | Reescrever o pitch com o modelo novo, "Technology Partner" e sem anúncios pagos | O pitch atual está desatualizado |
| D5 | Telegram: quais avisos viram e-mail, e o aviso para a A3 | Cliente real usa |
| D6 | O que fazer com a VPS depois da troca (manter de reserva, por quanto tempo) | Custo fixo × segurança |
