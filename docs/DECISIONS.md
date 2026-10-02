# Sales Boost — Decisões

> Cada decisão com data e motivo. Quando o código real divergir de uma
> decisão aqui, registrar a divergência no doc técnico correspondente
> ([ARCHITECTURE.md](ARCHITECTURE.md),
> [CONTENT-INTELLIGENCE.md](CONTENT-INTELLIGENCE.md) etc.) em vez de
> apagar a decisão daqui.

- **Setor piloto: imóveis, Rio de Janeiro** — ICP corretor autônomo/
  imobiliária pequena. Motivo: mercado concentrado, decisor único, ticket
  que justifica o setup, e já existia relação (Liga dos Sonhos como
  cliente real adjacente).
- **Só Instagram por enquanto** — WhatsApp/E-mail ficam pra depois (ver
  Fase 4 em [ROADMAP.md](ROADMAP.md)). Motivo: foco — um canal bem feito
  antes de espalhar.
- **Fichas de setor como dado (`vertical_playbooks`), nunca código
  específico de setor** — 2026-09-29. Motivo: qualquer setor novo (de
  imóveis pra procedimento estético, por exemplo) precisa ser só uma ficha
  nova, nunca um sistema novo. Teste de sanidade registrado em
  [PRODUCT.md](PRODUCT.md).
- **O corretor responde o onboarding** (faixa de preço, bairros, cliente
  típico, CRECI) — pular pergunta usa padrão médio, nunca trava o fluxo.
- **Único provedor de criativos: Higgsfield** — 2026-10-01. Motivo:
  cobre image-to-video, text-to-video e speech-to-video numa API só; fica
  atrás de um roteador pra trocar/somar provedor sem refazer o resto do
  pipeline.
- **Criativos sempre a partir de fotos reais do cliente + brief da
  estratégia** — nunca o Higgsfield decide sozinho o que criar; o Content
  Agent sempre escreve o brief antes.
- **Tour virtual como carrossel de vídeos** (não um vídeo montado único,
  salvo se a API permitir como opção) — mais simples de publicar com o
  publicador de carrossel que já existe.
- **Avatar e voz do corretor ficam pra depois** — não fazer agora (ver
  Futuro em [MEDIA-ENGINE.md](MEDIA-ENGINE.md)).
- **Foto do imóvel é sempre real** — regra inviolável (ver CLAUDE.md).
  Nunca a IA desenha o item de verdade; imagem gerada por IA só pra
  cena de bairro/marca.
- **Estratégia automática com tese estável** — 2026-09-30. Reavaliação
  semanal pode AJUSTAR o plano tático (`refresh`), mas a tese só muda
  (`generate`, estratégia nova) em PIVOT/TERMINATE real ou pedido
  explícito do dono. Motivo: evitar que o produto fique "mudando de
  ideia" toda semana — a tese precisa de tempo pra provar se funciona.
- **Liga dos Sonhos fora do automático** — `companies.auto_strategy =
  false` pra essa empresa até o dono decidir ligar. Motivo: é cliente real
  em produção, qualquer automação nova entra com cautela extra ali.
- **@getsaleboost usado em testes, só com conteúdo real sobre o próprio
  Sales Boost** — 2026-10-01. Contexto: a conta oficial pública do Sales
  Boost foi conectada por acidente numa empresa de teste durante a
  investigação de um bug de domínio; o agente de desenvolvimento
  desconectou automaticamente (seguindo a regra geral "desconecte se não
  for conta de teste"), o que gerou confusão quando o dono reconectou de
  propósito pra testar o carrossel. **Decisão:** usar @getsaleboost é
  aprovado para teste, mas só com conteúdo verdadeiro sobre o próprio
  Sales Boost (nunca um imóvel fictício) — e o agente não deve desconectar
  essa conta sozinho enquanto esse uso estiver em andamento.
- **Calendário semanal** como unidade de planejamento (dono aprova 1x/
  semana), não diário nem mensal.
- **Deploy sempre confirmado** — depois de mudar telas, publicar o site
  (`npm run build && npx wrangler deploy`) e confirmar "Site publicado em
  getsaleboost.com ✅" no relatório. Regra inviolável (ver CLAUDE.md).
- **Alterações arriscadas exigem aprovação prévia do dono** — lista
  completa em CLAUDE.md. Nenhum agente pula essa parada pra "economizar
  tempo".
- **Agentes de desenvolvimento trabalham sozinhos, mas nunca publicam** —
  2026-10-02. O dono pediu que `product` → `engineer` → `qa` evoluam o
  projeto sem precisar de prompt. Princípio: **autonomia pra trabalhar ≠
  autonomia pra publicar.** Rotina automática seg/qua/sex de manhã (1
  tarefa por rodada) + relatório semanal sexta 18h. O agente só abre PR;
  merge (e o deploy que vem com ele) é sempre do dono. Se não houver
  tarefa claramente segura e bem definida, o agente não inventa trabalho
  — não faz nada e diz isso no relatório. Regras operacionais completas
  em [ORCHESTRATION.md](ORCHESTRATION.md#modo-autônomo-rotina-agendada).
  **Isto substitui** a regra anterior "agentes não rodam sozinhos até o
  P4 existir" — o P4 passa a ser construído junto (ver
  [ROADMAP.md](ROADMAP.md#p4--infra-de-autonomia)). Banco de ensaio:
  segundo projeto grátis do Supabase (`salesboost-ensaio`), não o recurso
  pago de cópia — reavaliar depois que o fluxo provar que funciona.
- **Teste grátis de 7 dias + plano único de R$1.449/mês** — 2026-10-02,
  decisão do dono. Substitui o teste de 3 dias (`TRIAL_DAYS = 3` em
  `src/lib/trialState.ts`) e as faixas R$197–697 de
  [PRODUCT.md](PRODUCT.md). Público-alvo por agora: corretores e
  imobiliárias. No teste, 1 vídeo real (o único que chama a API de vídeo);
  os demais aparecem como prévias travadas, sem custo de API. Detalhes em
  [PRODUCT.md](PRODUCT.md#modelo-de-cobrança--decidido-2026-10-02). Motivo:
  o cliente precisa ver a inteligência real e uma prova de execução, não
  uma demo limitada; o preço posiciona como departamento de crescimento,
  não como créditos de IA. Ordem de construção: (1) testar Higgsfield com
  fotos reais, (2) teste de 7 dias, (3) fluxo do vídeo + prévias, (4)
  relatório e tela de assinatura.
- **PR aprovado libera o agente a alterar o banco real** — 2026-10-02,
  pedido do dono. A aprovação do PR (merge feito pelo dono) **é** a
  aprovação da mudança no banco de produção (`miwcxakzyforbahpnpst`) que
  está nele. Depois do merge, o agente aplica em produção exatamente o
  SQL do PR — nada além. Antes disso, nunca. Condições e passo a passo em
  [ORCHESTRATION.md](ORCHESTRATION.md#banco-de-produção-depois-do-pr-aprovado).
  Motivo: o dono não é desenvolvedor e não deveria ter que rodar SQL à
  mão; a revisão dele acontece no PR. **Isto ajusta** a regra anterior
  "mudança de estrutura fica marcada 'precisa de você' pro dono aplicar
  em produção".
