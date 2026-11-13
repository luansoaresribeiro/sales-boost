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
- **Próximo item do agente:**
  - **Frente de conteúdo:** **C1 — exatamente 1 post por dia** e **C0 — esconder a aba "Campanha"**.
  - **Frente 1:** **1.1 — Ambientes físicos**, com a Tespon e dentro da verba D4.
- **Esperando o dono:**
  - **D8:** tour pronto pode virar o post do dia?
  - **D3:** tamanho das partes do tour.
  - **D5:** avisos do Telegram.
  - **D6:** reserva da VPS.
  - **D7:** pitch.
  - **D2 (parte 1.5):** o dono indica o apartamento menor.
- **Gasto acumulado:**

  | Verba | Gasto até agora |
  |---|---|
  | Frente 1 (US$ 15) | US$ 0,00 |
  | Frente de conteúdo (US$ 2) | US$ 0,00 |

## Decisões do dono

> **Regra (13/11):** ao pedir uma decisão, dizer o que falta, por que precisamos, as alternativas (com custo e prazo) e a
> recomendação.

| ID | Item | Resp. | Prior. | Depende de | Status |
|---|---|---|---|---|---|
| D1 | Aprovar o roadmap de [PLANO-TOUR-COMPLETO.md](PLANO-TOUR-COMPLETO.md) | Dono | P0 | — | ✅ 13/11 ([DECISIONS](DECISIONS.md#2026-11-13--decisões-do-dono-identidade-mercado-modelo-d1-autonomia-e-documentação)). "Uma frente por vez" substituído à tarde: Frente 1 + conteúdo em paralelo |
| D2 | Imóvel e fotos do teste | Dono | P0 | — | ✅ parcial 13/11: 1.1 a 1.4 com a Tespon. ⏳ Para a 1.5, o dono indica um apartamento menor; a lista de fotos está em [PLANO-TOUR-COMPLETO 2.4](PLANO-TOUR-COMPLETO.md#24-lista-de-fotos-para-um-apartamento-de-2-quartos-para-quem-vai-fotografar) |
| D3 | Tamanho máximo de cada parte do tour (proposta: ~8 passagens, ~50 s) | Dono | P1 | — | ⏳ |
| D4 | Verba de teste da Frente 1 | Dono | P0 | — | ✅ 13/11: até **US$ 15** ([DECISIONS](DECISIONS.md#2026-11-13-tarde--decisões-do-dono-frequência-catálogo-editorial-revisão-de-prs-verbas-e-frente-de-conteúdo)). O provedor de nuvem da Frente 2 continua a decidir quando ela começar |
| D5 | Telegram: quais avisos viram e-mail; aviso para a A3 (inclui o canal do aviso de visita, ver [CONVERSION](CONVERSION.md)) | Dono | P1 | — | ⏳ |
| D6 | VPS: quanto tempo fica de reserva depois da troca | Dono | P2 | 2.3 | ⏳ |
| D7 | Reescrever o pitch ([pitch/PITCH.md](../pitch/PITCH.md)). Entram "Technology Partner for Real Estate" e "sem anúncios pagos"; o preço do tour fica como hipótese | Dono + Agente | P2 | — | ⏳ |
| D8 | Um tour pronto pode virar post e ocupar o post do dia, sempre com a aprovação do dono? SIM / NÃO. O dono deixou as duas opções na mensagem de 13/11 | Dono | P2 | — | ⏳ |
| DC | Verba de teste da Frente de conteúdo | Dono | — | — | ✅ 13/11: até **US$ 2** |

## Frente de conteúdo (aberta em 13/11, em paralelo com a Frente 1)

| ID | Item | Resp. | Prior. | Depende de | Pronto quando | Status |
|---|---|---|---|---|---|---|
| C0 | Esconder a aba "Campanha" (anúncios) do menu do conteúdo, **sem apagar o código** | Agente | P0 | — | A aba não aparece (print desktop e celular); links antigos `?tab=campanha` caem no Conteúdo; o código continua no repositório; site publicado e conferido | ⏳ |
| C1 | **Exatamente 1 post por dia, 7 por semana**, no plano automático. DM, "Comente QUERO", stories e mensagens não contam. Sem material de imóvel → formato que não depende de imóvel. Nunca dia vazio nem peça repetida. "Gerar agora" é extra | Agente | P0 | — | Teste automático: qualquer mix → 7 dias com 1 post cada, sem repetição. Na Teste Zero e na Tespon, a próxima semana planejada tem 7 posts (SQL) | ⏳ |
| C2 | **Catálogo editorial** em `docs/`: 8 a 10 formatos realmente diferentes, cada um com objetivo, momento até a visita, gancho, slide a slide, dados reais, diferença visual, quando não usar e rodízio | Agente | P0 | C1 | Documento entregue e **aprovado pelo dono** | ⏳ |
| C3 | Construir os formatos aprovados no C2 | Agente | P1 | C2 aprovado | Cada formato gera peça real na Teste Zero/Tespon, com print e travas de número passando | ⏳ |
| C4 | Tela do agente de conteúdo simplificada | Agente | P1 | C3, Frente 4 (4.1) | Print aprovado pelo dono | ⏳ |

## Validação comercial — sem prazo; não bloqueia trabalho técnico (dono, 13/11 tarde)

> Bloqueia só: preço do tour, Boosts, preço de lead e Fase 4. **Não citar nos relatórios até o dono retomar.**

| ID | Item | Resp. | Status |
|---|---|---|---|
| V1 | Conversas com imobiliárias pelo roteiro do [PILOTO.md](PILOTO.md) (meta: 3 conversas ou 1 piloto) | Dono | ⏸ pausado pelo dono |
| V2 | Ficha preenchida por conversa | Dono | ⏸ |
| V3 | Consolidar as fichas em [relatorios/](relatorios/) (sem inventar número) | Agente | ⏸ |
| V4 | Revisão dos 3 portões da Fase 4 | Dono + Agente | ⏸ |

## Frente 1 — Tour Virtual completo

| ID | Item | Resp. | Prior. | Depende de | Pronto quando | Status |
|---|---|---|---|---|---|---|
| 1.0 | Auditoria do tour + viabilidade da Tespon | Agente | P0 | — | Documento entregue + roadmap aprovado | ✅ 13/11 (#167; D1 aprovado) |
| 1.1 | Ambientes físicos (agrupar as fotos do mesmo ambiente) | Agente | P0 | D1 ✅, D4 ✅ (US$ 15) | Testes automáticos ✅ + grupos da Tespon = tabela 2.1 (o dono confere os ❓) | ⏳ |
| 1.2 | Mapa de ligações com evidência (foto que prova cada ligação) | Agente | P0 | 1.1, D4 ✅ | Mapa da Tespon = 2.2, nenhuma ligação inventada; custo medido | ⏳ |
| 1.3 | Indicador de cobertura + lista de fotos que faltam (com ângulo) na tela | Agente | P0 | 1.2 | A tela mostra os pendentes da Tespon e a lista 2.3; print aprovado | ⏳ |
| 1.4 | Tour em partes + conferência de destino | Agente | P1 | 1.3, D3 | Testes automáticos + revisão do dono | ⏳ |
| 1.5 | Teste de ponta a ponta, imóvel inteiro (apartamento menor indicado pelo dono) | Agente + Dono | P0 | 1.4, D2 (imóvel), D4 ✅ | Os 7 critérios da seção 3, todos ✅, quadro a quadro; custo registrado | ⏳ |

## Frente 2 — Motor próprio de vídeo (só começa com a Frente 1 validada)

| ID | Item | Resp. | Prior. | Depende de | Pronto quando | Status |
|---|---|---|---|---|---|---|
| 2.1 | Contêiner com o `worker.mjs` (mesma fila `media_jobs`) | Agente | P1 | 1.5, D4 | Monta o trabalho de teste igual à VPS | ⏳ |
| 2.2 | Modo sombra: 10 trabalhos reais nos dois lugares | Agente | P1 | 2.1 | Equivalência (duração ±0,1 s, 1080×1920, fusões, capa, encerramento) | ⏳ |
| 2.3 | Contêiner principal, VPS de reserva | Agente | P1 | 2.2 | 14 dias sem falha | ⏳ |

## Frente 3 — Infraestrutura (VPS e Telegram) — NADA é apagado sem autorização do dono

| ID | Item | Resp. | Prior. | Depende de | Pronto quando | Status |
|---|---|---|---|---|---|---|
| D5 | Telegram: quais avisos viram e-mail; aviso para a A3 | Dono | P1 | D1 | Decisão registrada | ⏳ |
| D6 | VPS: quanto tempo fica de reserva depois da troca | Dono | P2 | 2.3 | Decisão registrada | ⏳ |
| 3.1 | Substitutos por e-mail (alertas da plataforma e de lead) | Agente | P1 | D5 | Alerta de teste chega | ⏳ |
| 3.2 | Conferir se os bots antigos (`marketing-bot`, `vendas-bot`, `group-manager`) estão publicados | Agente | P2 | — | Lista do que está no ar | ⏳ |
| 3.3 | Desligar Telegram e VPS por flag (sem apagar) | Agente | P2 | 2.3, 3.1, **autorização** | Checklist da seção 6 do plano | ⏳ |
| 3.4 | Apagar estrutura antiga | Agente | P3 | 3.3 + 14 dias + **2ª autorização** | Nada perdido (checklist) | ⏳ |

## Frente 4 — Experiência do usuário (depois do fluxo do tour definido)

| ID | Item | Resp. | Prior. | Depende de | Pronto quando | Status |
|---|---|---|---|---|---|---|
| 4.1 | Auditoria completa da jornada (prints no celular e no desktop), incluindo a tela do agente de conteúdo (C4) | Agente | P1 | 1.5 | Relatório aprovado pelo dono | ⏳ |
| 4.2 | Simplificações aprovadas, uma por PR | Agente | P1 | 4.1 | Print de cada uma + site publicado | ⏳ |

## Já validado (histórico)

| Item | Validação |
|---|---|
| Tour contínuo, área social da Tespon, 8 ambientes | Vídeo de 13/11: 0 cortes, conferido quadro a quadro, US$ 3,528 ([MEDIA-ENGINE.md](MEDIA-ENGINE.md)) |
| Legenda do tour cita só os ambientes reais | #166 + teste automático; publicado pelo workflow em 13/11 |
