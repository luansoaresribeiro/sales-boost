# Sales Boost — Motor de Mídia (Higgsfield)

> Como fotos reais do cliente + inteligência da estratégia viram criativos
> prontos. **Nada disto está implementado ainda** — este doc é o plano
> aprovado (ver [DECISIONS.md](DECISIONS.md)), não o estado atual. Estado
> real das peças adjacentes (que já existem) em
> [ARCHITECTURE.md](ARCHITECTURE.md) etapas 4-6 e
> [CONTENT-INTELLIGENCE.md](CONTENT-INTELLIGENCE.md).

## Fluxo obrigatório (fotos do cliente + inteligência da estratégia)

1. O corretor sobe as fotos reais do imóvel no catálogo ("Meus imóveis" —
   **já existe**: `marketing_ai_knowledge`, `kind:'product'`, fotos em
   `meta`, capa em `image_url`).
2. A ESTRATÉGIA decide o que criar: Hermes (tese, público, objetivo do
   mês) + calendário semanal (pilar e formato de cada espaço) + ficha +
   respostas do onboarding (faixa de preço, bairros, cliente típico).
3. O Content Agent escreve o BRIEF de cada criativo: quais fotos usar e em
   que ordem, movimento de câmera de cada uma, ângulo do anúncio,
   texto/CTA (que o `render-format` aplica depois) e qual objetivo da
   estratégia a peça serve. **O Higgsfield nunca decide sozinho — só
   executa o brief.**
4. O Higgsfield recebe as FOTOS REAIS + o brief e devolve os criativos
   (clipes, visuais de anúncio).
5. O `render-format` aplica o texto; a montagem entrega o formato final.
6. Os criativos voltam como RASCUNHO no calendário
   (`marketing_ai_test_content` com `media` + tags) → aprovação do dono →
   Instagram.

## Provedor

**Único provedor de criativos nesta fase: Higgsfield** (API:
`docs.higgsfield.ai`; capacidades conhecidas: image-to-video,
text-to-video, speech-to-video). Secret: `HIGGSFIELD_API_KEY`. Fica atrás
de uma camada de ROTEADOR (1 provedor hoje; trocar/somar sem refazer o
resto do pipeline).

**Antes de usar:** confirmar na documentação atual as capacidades,
formatos aceitos (9:16), duração, preço por uso e como avisa que terminou
(webhook ou consulta) — a doc pode ter mudado desde a última checagem.

## Escopo agora

**(1) Tour virtual em vídeo:** cada foto real → clipe curto com movimento
de câmera; entrega como **carrossel de vídeos** no Instagram, na ordem da
casa (fachada → sala → cozinha → quartos → área externa), sem montagem. Se
a API gerar 1 vídeo único a partir de várias fotos, mostrar como opção
alternativa.

**(2) Criativos de anúncio:** visual do Higgsfield a partir da foto real +
texto via `render-format`.

## Regras

- **Prompt de vídeo:** só movimento de câmera; proibido
  adicionar/remover/alterar objetos, mudar tamanho de cômodo, vista ou
  céu; sem texto.
- **Imagem:** pode ajustar luz/cor/alinhamento; staging virtual só com
  aviso "Imagem ilustrativa – mobiliado virtualmente" + foto original
  junto (**ainda não implementado**); nunca esconder defeito do imóvel.
- **Assíncrono obrigatório** (Supabase Free = 150s/execução, ver
  [PITFALLS.md](PITFALLS.md)): fila de jobs (pendente → processando →
  pronto/falhou), webhook ou consulta, trava de tempo, nunca ficar preso.
- **Custo de cada chamada registrado por empresa** (mesmo padrão de
  `logStrategyCost`/`agent_performance` já usado pra estratégia — base dos
  futuros créditos por uso).
- **Instagram:** carrossel com a mesma proporção entre os itens, formato
  aceito pela API, dentro dos limites; publicação assíncrona (o
  publicador de carrossel já existe, ver
  [ARCHITECTURE.md](ARCHITECTURE.md) etapa 8 — o motor de mídia só
  precisa alimentá-lo com `media[]` no mesmo formato que já usa hoje).

## Futuro (não fazer agora)

- Avatar do corretor (speech-to-video; exige consentimento explícito).
- Voz do corretor (ElevenLabs/`voice-tts` já existe no produto pro Jarvis
  — reusar pra isso é trabalho futuro, não imediato).
- Imóvel real no fundo do corretor (avatar + cena real combinados).
- Montagem de Reel com legenda/música (ffmpeg na VPS — risco: a VPS do
  Hermes já é instável hoje, ver [ARCHITECTURE.md](ARCHITECTURE.md)).
- Tour 360° (exige câmera 360°/parceiro).
- `video_blueprint` na ficha (ordem de cenas por setor, generalizando o
  "fachada → sala → cozinha..." pra outros setores).

As functions `generate-image` (OpenAI) e `generate-video` (fal.ai) ficam
como estão — `generate-video` está deployada mas órfã (zero chamadores).
Migração/unificação pro Higgsfield é item futuro, não parte deste escopo.
