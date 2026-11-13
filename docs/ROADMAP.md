# Sales Boost — Roadmap

> Só o que vale agora: a direção, os gates (técnico do tour e comercial) e os portões da Fase 4.
> - **Próximo item e status:** [PENDENCIAS.md](PENDENCIAS.md).
> - **Detalhe das frentes:** [PLANO-TOUR-COMPLETO.md](PLANO-TOUR-COMPLETO.md).
> - **Ordens antigas** (11/11, 06/11, 01/11, P0–P4, pedidos de outubro): [histórico](historico/ROADMAP-ate-2026-11-12.md).
>   Nenhuma delas vale mais como prioridade.

## Direção atual (dono, 2026-11-13 — D1 aprovado)

- **Estratégica, acima de tudo:** construir o sistema de inteligência e geração de demanda comercial para imobiliárias.
- **Validação comercial (13/11, tarde):** sem prazo; não bloqueia trabalho técnico aprovado. Bloqueia preço do tour, Boosts, preço de lead e Fase 4 ([decisão](DECISIONS.md#2026-11-13-tarde--decisões-do-dono-frequência-catálogo-editorial-revisão-de-prs-verbas-e-frente-de-conteúdo)).
- **Frente de conteúdo, em paralelo com a Frente 1:** 1 post por dia → catálogo editorial → formatos aprovados → tela simples (junto com a Frente 4).
- **Do produto, uma frente por vez:**
  1. **Tour do imóvel inteiro** ← frente atual;
  2. **motor próprio de vídeo;**
  3. **infraestrutura:** substituir e só então desligar VPS e Telegram, sem apagar;
  4. **experiência do usuário.**
- **Depois das 4 frentes:** mobiliamento virtual em vídeo (especificação em [MEDIA-ENGINE.md](MEDIA-ENGINE.md)).
- **Fora do modelo** (não planejar sem decisão nova): anúncios pagos / impulsionar publicação.
- **Em aberto:** Boosts e qualquer preço.

## Gates do Tour virtual (técnico e comercial)

**Gate técnico — "tour completo"** (critérios da seção 3 do [PLANO-TOUR-COMPLETO.md](PLANO-TOUR-COMPLETO.md)):
1. cobertura de 100% dos ambientes (ou marcados pelo dono como fora, com motivo);
2. passagens verificadas ou aprovadas uma a uma;
3. nenhuma passagem inventada;
4. ordem espacial coerente;
5. chega ao ambiente certo;
6. legenda fiel;
7. revisão humana antes de publicar.
- Custo real registrado por tour e por trecho, com o limite de gasto respeitado.
- **Situação em 13/11:** **NÃO passou.** O trecho social passou (8 de 22 ambientes da Tespon, 0 cortes, US$ 3,528); o imóvel
  inteiro não. O detalhe está no MEDIA-ENGINE e no histórico.

**Gate comercial** (antes de qualquer código de Boosts ou de cobrança por tour):
- pelo menos 3 imobiliárias ouvidas, ou 1 piloto real ([PILOTO.md](PILOTO.md));
- quantos tours por mês usariam;
- quem paga: imobiliária ou corretor;
- disposição de pagar por tour avulso, e quanto (inclusive preço por tamanho do imóvel);
- objeções;
- "disse que usaria" separado de "pagou".

**Decisão depois dos dois gates:**

| Gate técnico | Gate comercial | O que fazer |
|---|---|---|
| passa | passa | proposta final de monetização ao dono |
| passa | não passa | revisar oferta e preço, sem infraestrutura nova |
| não passa | — | corrigir o tour antes de expandir |

Nenhuma implementação de Boosts nem cobrança começa sem aprovação do dono depois dos dois gates. A conta dos Boosts
(só documento) está no [PRODUCT.md](PRODUCT.md).

## Novo modelo de negócio — validar antes de construir (dono, 2026-11-10)

**O modelo (em validação):** plataforma grátis; tour virtual pago (US$ 15 é **hipótese**, não decisão); lead qualificado pago, com preço a definir depois de medir. Boosts em aberto; anúncios pagos fora do modelo (13/11).
**A pergunta que decide:** o Sales Boost gera demanda comercial consistente, e as imobiliárias pagam por esse resultado?

| Fase | Entrega | Situação |
|---|---|---|
| 1 | Auditoria de custos (Claude + Tavily) | v0.1 feita (10/11); **v1 medida em 17/11** · economias de custo no ar (#132–#134) |
| 2 | Simulador (10/50/100/500; tours 1/3/5; leads separados, sem preço) | v2 feito (10/11); atualizar com a v1 |
| 3 | Decisão do modelo | depende das fases 1 e 2 e da validação de demanda |
| 4 | Conversão: catálogo, agendamento, origem, lead qualificado e contestação | **preparada, não implementada** ([CONVERSION.md](CONVERSION.md)); só começa com os 3 portões abaixo |
| 5 | Piloto real medindo leads, visitas, custo e receita | [PILOTO.md](PILOTO.md) (seção 2.1) |

> **Substituído em 13/11 (tarde):** a validação comercial não tem mais prazo nem bloqueia trabalho técnico. Texto de 10/11:

**Até 17/11 (dono, 10/11):** só validação comercial: conversas com imobiliárias, ficha em [PILOTO.md](PILOTO.md) 2.2. Sem implementação e sem escopo novo.

**Portões da Fase 4:**
1. custos medidos;
2. demanda validada (1 piloto ou 3 conversas);
3. critérios de lead qualificado aprovados pelo dono, com os prazos de 30 e 7 dias validados com imobiliárias. A 1ª versão não guarda marca no celular do visitante (já decidido).

## Histórico

Seções antigas movidas para (incluindo, em 13/11, a "Direção atual" de antes do D1 e "Foco e gates do Tour virtual e dos Boosts (11/11)") [historico/ROADMAP-ate-2026-11-12.md](historico/ROADMAP-ate-2026-11-12.md):
- Ordem aprovada (dono, 2026-11-11 noite) — HISTÓRICO, substituída pela direção de 13/11 acima
- Plataforma internacional — segurança, depois idioma/país, depois expansão (dono, 2026-11-07)
- Ordem aprovada (dono, 2026-11-06) — o núcleo funcionando de verdade, depois telas, depois Telegram
- Foco atual (dono, 2026-11-01) — qualidade antes do 1º cliente
- P0 — Instagram certo conectado
- P1 — Conversão
- P2 — Medição + aprendizado
- P3 — Higgsfield (Motor de Mídia)
- P4 — Infra de autonomia
- Próximas etapas pedidas pelo dono (2026-10-06, nesta ordem)
- Fora do código (depende do dono, nenhum agente resolve sozinho)
- Itens do roadmap anterior (pré-reorganização dos docs, 2026-10-01)
- Divergências registradas (etapa 1, pendências)
- Pedidos do dono (2026-10-12) — próximas frentes
- Agente de Dados ampliado (pedido do dono 2026-10-14) — em etapas
- Criativos — fase 3 (rótulo + intenção da estratégia nas peças) — 2026-10-22
- Pedidos do dono (2026-10-20) — próximas frentes
- Inglês como idioma principal / mercado EUA (decisão do dono 2026-10-27)
- Inteligência comercial (visão 2026-10-28)
- Pós-validação — Marketing AI da informação à decisão (plano de 2026-11-03)
