# Sales Boost — manual de bordo

## 1. Quem somos
- **Definição operacional (a que os agentes usam):** sistema de inteligência e geração de demanda comercial para
  imobiliárias. A medida de sucesso é a **visita ao imóvel**, não a quantidade de posts.
- **Posicionamento comercial (só no site e no pitch):** "Technology Partner for Real Estate".
- **Slogan:** "Sales Boost — gerando mais visitas para o seu imóvel". Nunca prometer visita garantida.
- **Mercado agora:** Brasil, principalmente o Rio de Janeiro, em português (ficha `imoveis_rio`, canal Instagram).
  EUA só depois, com a revisão jurídica.
- **Modelo em validação, sem preço decidido:** plataforma grátis + tour pago (US$ 15 é hipótese) + lead qualificado.
  **Boosts:** em aberto. **Anúncio pago (impulsionar):** fora do modelo.
- O que vale hoje, tema a tema: [docs/DECISIONS.md → Decisões em vigor](docs/DECISIONS.md#decisões-em-vigor).

## 2. Direção atual
- **Estratégica, acima de tudo:** construir o sistema de inteligência e geração de demanda comercial.
- **Frentes abertas (dono, 13/11):** **Frente 1 — Tour do imóvel inteiro** e, em paralelo, **Frente de conteúdo**
  (1 post por dia → catálogo editorial → formatos aprovados → tela simples, junto com a Frente 4). Depois, nesta ordem:
  motor próprio de vídeo → sair da VPS e do Telegram (só depois do substituto) → experiência do usuário.
- **Dois produtos separados:** o **agente de conteúdo** cuida dos posts e da estratégia editorial; o **tour do imóvel
  inteiro** tem fluxo e modelo comercial próprios.
- **Bloqueados até a validação comercial** (que não bloqueia trabalho técnico aprovado): preço do tour, Boosts, preço
  de lead e Fase 4. Não citar o assunto nos relatórios até o dono retomar.
- **Próximo item e quem espera o quê:** [docs/PENDENCIAS.md](docs/PENDENCIAS.md) (topo).

## 3. Regras invioláveis
1. Nada vai ao público sem aprovação do dono (post, DM, resposta, anúncio).
2. **Liga dos Sonhos:** nunca tocar, nem ler. Testes só nas contas de teste (Teste Zero, Tespon).
3. Nunca publicar em Instagram real sem aprovação explícita. Isso inclui @getsaleboost; uso em teste só nas condições do
   [DECISIONS](docs/DECISIONS.md).
4. Foto de imóvel é sempre real. A IA de imagem ou vídeo nunca escreve texto (texto só via `render-format` ou legenda).
5. Nunca inventar números (preço, m², mercado, métricas).
6. Tudo que é de setor vive na ficha (`vertical_playbooks`), nunca em código.
7. Respeitar o teto de custo de IA e de provedores.
8. O site e as funções são **publicados sozinhos depois do merge** na `main` (Cloudflare Workers Builds e
   `.github/workflows/deploy-functions.yml`). Depois de mudar telas, o agente **confere o bundle no ar** antes de escrever
   "Site publicado em getsaleboost.com ✅".
9. Falar com o dono (Luan) em português simples, porque ele não é desenvolvedor. Se ele precisar rodar algo no
   terminal, dar o comando pronto.

## 4. Autonomia (semáforo — substitui a nota de 29/10 e a antiga lista "Alterações arriscadas")
- 🟢 **Faz sozinho:**
  - ler código;
  - ler o banco (só leitura, contas de teste);
  - escrever código e testes;
  - abrir PR;
  - **juntar o próprio PR** com todas as checagens verdes, se o item está dentro da frente aprovada (**exceto** PR que
    muda `CLAUDE.md`, `.claude/agents/` ou `docs/ORCHESTRATION.md`: esse espera a revisão do dono);
  - migrations que só acrescentam;
  - atualizar documentação.
  - Mudança de código geral que vai ao ar para todos os clientes (inclusive a A3) também é 🟢, com testes verdes e
    dentro da frente.
- 🟡 **Faz e informa no relatório,** desde que não altere decisão estratégica nem gere risco operacional:
  - tela dentro do item;
  - ajuste da ficha que não muda regra comercial;
  - correção pequena achada no caminho.
  - **Na dúvida, é 🔴.**
- 🔴 **Para e pede aprovação antes:**
  - **gasto externo além da verba aprovada** (Higgsfield/Kling, IA paga em teste, API, fornecedor ou nuvem nova).
    **Verbas (13/11):** Frente 1 até US$ 15; Frente de conteúdo até US$ 2. Fora delas, US$ 0 sem aprovação;
  - mudar direção, preço ou regra comercial, ou qualquer coisa que contradiga o DECISIONS;
  - publicar ou enviar em conta real (Instagram, DM, e-mail, WhatsApp, Telegram);
  - apagar ou desligar funcionalidade, infraestrutura, dado ou credencial;
  - migration que altera ou apaga dado, ou que muda RLS;
  - autenticação, secrets, domínio, DNS, painel da Meta, crons novos ou alterados;
  - **ação direta na A3** (cliente real): dados, mensagens, conta;
  - começar frente nova.
- **Pedido 🔴:** O que vou fazer · Por quê · O que pode dar errado · Como desfazer · **"Posso seguir?"** — e esperar.
- **Decisão que peço ao dono:** sempre dizer o que falta, por que precisamos, as alternativas (com custo e prazo) e qual
  eu recomendo.

## 5. Protocolo de tarefa
Quando o dono disser "continue a frente atual", ou pedir qualquer tarefa:
0. **Se o pedido traz direção nova:** aplicar primeiro a seção 6 (registrar e conferir conflito com as decisões em
   vigor). Só depois executar.
1. Ler este arquivo e o [docs/PENDENCIAS.md](docs/PENDENCIAS.md).
2. **Achar o próximo item ⏳ de uma frente aberta** (Frente 1 ou Frente de conteúdo) que seja do Agente e tenha as
   dependências ✅.
   - Se não houver, reportar o que está bloqueado e o que depende do dono, e parar.
3. **Ler a seção do item** no [docs/PLANO-TOUR-COMPLETO.md](docs/PLANO-TOUR-COMPLETO.md) e os docs da área.
   - Antes de mexer em cron, auth, domínio ou migration, ler o [docs/PITFALLS.md](docs/PITFALLS.md).
4. **Escrever no PR um plano curto:** objetivo, escopo, riscos e "pronto quando". Item 🟢 não precisa de aprovação.
5. **Executar** classificando cada ação no semáforo. Ação 🔴: parar e pedir no formato combinado.
6. **Validar** pelo "Pronto quando" da PENDENCIAS. Sem prova, o status é 🧪, nunca ✅.
7. **Atualizar no mesmo PR:**
   - PENDENCIAS (status + prova);
   - DECISIONS (se houve decisão do dono);
   - o doc da área (se o código divergiu do doc).
8. **Seguir ou parar.** Se o item foi validado e o próximo de uma frente aberta não depende do dono, voltar ao passo 2.
   Senão, parar.
9. **Relatório final** (seção 7).

## 6. Documentação sempre atualizada (regra permanente, dono 13/11)
Todo pedido do dono que mude a direção atualiza os documentos **no mesmo trabalho, no mesmo PR, antes do relatório**.
Não deixar para depois e não esperar o dono pedir.

**Conta como pedido de direção:**
- mudar o que o produto é ou para quem ele é;
- mudar prioridade, ordem ou escopo de uma frente;
- aprovar, recusar ou adiar uma pendência (D1, D2…);
- definir modelo de negócio, preço, regra comercial ou o que se pode ou não prometer;
- mudar a autonomia dos agentes ou as regras invioláveis;
- tirar, desligar ou adiar uma funcionalidade;
- frases como "a partir de agora…", "não quero mais…", "isso fica fora…".

Pedido pontual (bug, texto de tela) não é direção: atualiza só o doc da área, se o código divergir dele.

**Onde atualizar, nesta ordem:**
1. **[DECISIONS](docs/DECISIONS.md):** entrada nova com data, as palavras do dono (citação curta) e o motivo. Atualizar a
   linha do tema em "Decisões em vigor". O que foi substituído ganha "substituído em DD/MM", nunca é apagado.
2. **[PENDENCIAS](docs/PENDENCIAS.md):** criar, mudar ou fechar itens; manter no topo a frente atual e o próximo item.
3. **Este arquivo:** só se mudou identidade, direção, autonomia, regras ou protocolo. Ficar em ~150 linhas; o detalhe vai
   para os docs.
4. **O doc da área** (PRODUCT, ROADMAP, CONVERSION, MEDIA-ENGINE, PILOTO, PITCH…): ajustar o estado atual e registrar a
   divergência.
5. **Trecho ativo superado:** mover para `docs/historico/`, com link no lugar.

**Casos especiais:**
- **Pedido que contradiz uma decisão em vigor:** antes de agir, mostrar a decisão antiga (data + texto) e perguntar se
  a nova a substitui. É 🔴.
- **Pedido ambíguo sobre direção:** registrar só o que o dono disse de fato, sem completar com suposição, e listar a
  dúvida em "o que depende de você".

## 7. Formato do relatório final (sempre)
Português simples, ~15 linhas: o que foi feito · a **prova** (link, print, SQL, teste) · os custos e o **gasto
acumulado** de cada verba · o que falta · o que depende do dono · "**Docs atualizados:** …" (ou "nada a atualizar").
**PR que espera a revisão do dono:** resumo de **no máximo 6 linhas** (o que mudou, por quê, impacto, o que ele precisa
decidir); o detalhe técnico fica no PR.

Nunca dizer "pronto" sem prova.
## 8. Índice dos docs
**Ler sempre:** este arquivo · [docs/PENDENCIAS.md](docs/PENDENCIAS.md).

**Consultar quando…**
- **as decisões do dono:** [DECISIONS](docs/DECISIONS.md) ("Decisões em vigor" no topo);
- **um item das 4 frentes:** [PLANO-TOUR-COMPLETO](docs/PLANO-TOUR-COMPLETO.md);
- **o que existe e o que não prometer** (verticalização, marca, conta dos Boosts): [PRODUCT](docs/PRODUCT.md);
- **gates do tour e comerciais, portões da Fase 4:** [ROADMAP](docs/ROADMAP.md);
- **antes de cron, auth, domínio, migration ou deploy:** [PITFALLS](docs/PITFALLS.md);
- **stack, dados e variáveis:** [ARCHITECTURE](docs/ARCHITECTURE.md);
- **vídeo** (tour, estúdio, mobiliamento): [MEDIA-ENGINE](docs/MEDIA-ENGINE.md);
- **conversa → lead:** [CONVERSION](docs/CONVERSION.md);
- **o que criar:** [CONTENT-INTELLIGENCE](docs/CONTENT-INTELLIGENCE.md) · [PLANO-CRIATIVOS](docs/PLANO-CRIATIVOS.md);
- **medição:** [LEARNING](docs/LEARNING.md) · custos: [AUDITORIA-CUSTOS](docs/AUDITORIA-CUSTOS.md);
- **Instagram e Meta:** [INSTAGRAM](docs/INSTAGRAM.md) · [META-APP-REVIEW](docs/META-APP-REVIEW.md);
- **validação comercial com imobiliária:** [PILOTO](docs/PILOTO.md) · pitch (desatualizado, D7): [PITCH](pitch/PITCH.md);
- **teste final:** [TESTE-FINAL](docs/TESTE-FINAL.md) · time de agentes (tarefa grande): [ORCHESTRATION](docs/ORCHESTRATION.md).
- **Histórico, não é guia de direção:** [docs/historico/](docs/historico/) e os levantamentos de dados de set–out
  (`docs/DATA_AUDIT.md`, `DATA_GAPS_PLAN.md`, `DATA_MAP.md`, `DATA_SYNC_ARCHITECTURE_PLAN.md`).

## 9. Engenharia e build
- **Escopo:** o que foi pedido, nem mais nem menos. Arquivo novo só se preciso; doc só em `docs/`; ler antes de editar;
  arquivos com menos de ~500 linhas.
- **Segurança:** nunca commitar segredo ou `.env`. Validar entrada nas bordas.
- **Tela e código andam juntos:** se divergirem, corrigir no mesmo trabalho ou registrar no doc da área.
- **Antes de dizer que terminou:** `npm run build` e os `scripts/test-*.mjs` da área passam. A publicação é automática
  (regra 8). Tarefa grande (3+ arquivos): seguir o [ORCHESTRATION](docs/ORCHESTRATION.md).
