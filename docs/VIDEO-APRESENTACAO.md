# Vídeo de apresentação do Sales Boost

> Passagem de bastão entre sessões (2026-10-16). Material de marketing do
> próprio Sales Boost (perfil @getsaleboost), não é funcionalidade do
> produto. Código e arquivos em `marketing/video-apresentacao/`.

## Objetivo

Vídeo vertical (Reels/Stories, 1080×1920) de ~33s apresentando o Sales
Boost **para corretores e imobiliárias**, deixando claro que **gera
demanda**. Precisa gerar curiosidade, autoridade e ter copy forte.

## O que já existe

- `out/sales-boost-apresentacao.mp4` — v1 (28s), só tipografia animada,
  baseada no carrossel. Já entregue ao dono.
- `out/storyboard.png` — storyboard v1 (6 cenas). **Superado** pelo
  roteiro v2 abaixo, depois que o dono mandou referências e pediu algo mais
  cinematográfico, "com muito mais objetos e transições".
- `src/index.tsx` (vídeo v1) e `src/board.tsx` (storyboard v1) — Remotion.
- `referencias/ref1..3-quadros.jpg` — quadros extraídos dos 3 vídeos de
  referência que o dono enviou (TikToks gravados de tela).

## Decisões do dono

- Abertura: **"Seu próximo cliente está no Instagram agora. Só não está te
  vendo."**
- Estilos: escuro com brilho + telas reais do painel; depois refinado
  pelas 3 referências (abaixo).
- Cenas de fundo: **cenas do Rio** (Copacabana, Botafogo, drone noturno).
- Higgsfield Katana: **sem economizar créditos** — mas mostrar ao dono a
  lista de cenas e pedir **um "ok" único** antes de gerar.
- Bio escolhida pra Instagram (sugestão): "🚀 Transforme seus imóveis em
  clientes / 🤖 IA feita para corretores e imobiliárias / ✅ Você aprova
  tudo antes de publicar / 👇 Diagnóstico grátis".

## As 3 referências (análise)

Os três foram feitos pelo Claude com código (Hyperframes / "no After
Effects") — **não** com Higgsfield. Dá pra fazer em Remotion.

1. **Agência (Opus 5.5 x Hyperframes)** — anel de texto 3D girando, linha
   de luz neon como transição, uma cena por serviço com cor chapada, título
   grosso em caixa alta + palavra em itálico serifado, celulares/telas e
   figurinhas pulando, formas que se transformam, fluxo de automação se
   desenhando. Cortes de ~1,5s.
2. **Lançamento de produto (New Claude Opus 5.5)** — fundo escuro, celular
   surge com anel de brilho, ícone do app aparece, tela do produto se monta
   saindo do desfoque. Estilo Apple.
3. **"Claude cooked"** — fundo **laranja**, card de painel flutuando em 3D,
   esferas, palavra gigante "LYING." quebrando em estilhaços + "to you" em
   itálico, esfera laranja com valor que **derrete**. Copy com reviravolta.

Paleta resolvida: alternar **cenas escuras com brilho laranja** (ref 2) e
**cenas laranja chapadas** (ref 3), no ritmo da ref 1. Fica 100% na marca
(`#FF6D29`, `#0E0B0A`, `#150E08`, `#BABABA`, Bricolage Grotesque).

## Roteiro v2 (proposto — aguardando aprovação do dono)

| # | Tempo | Estilo | Cena | Texto |
|---|---|---|---|---|
| 1 | 0–3s | Katana + ref 2 | Copacabana ao entardecer escurece → celular surge girando com anel laranja | "Seu próximo cliente está no Instagram agora." |
| 2 | 3–5s | ref 1 | Anel 3D de texto: "IMÓVEIS + POSTS + VISITAS + DEMANDA +" | "Só não está *te vendo.*" |
| 3 | 5–9s | ref 3 | Fundo laranja, post de imóvel com corações e contador (número desfocado) → glitch → "CURTIDAS" estilhaçando | "Curtidas… não agendam *visita.*" |
| 4 | 9–12s | ref 2 | Escuro, logo surge com anel de luz laranja | "SALES BOOST · *a IA que transforma imóveis em demanda*" |
| 5 | 12–22s | ref 1 | 4 cenas rápidas alternando escuro/laranja | "ESTUDA *seu bairro*" (mapa do Rio + pinos) → "CRIA *posts que vendem*" (celular + carrossel) → "RESPONDE *quem pergunta*" (balões + fluxo) → "APRENDE *toda semana*" (gráfico sem números) |
| 6 | 22–27s | ref 3 | Fundo claro, botão 3D laranja "APROVAR" apertado e "amassando" | "Você aprova *tudo.* Seu nome. Seu CRECI. Sua marca." |
| 7 | 27–33s | Katana + ref 2 | Drone no Rio à noite → luzes → preto → logo + site | "Feito para corretores e imobiliárias. *Diagnóstico grátis* · getsaleboost.com" |

Perguntas em aberto ao dono:
1. Aprova o roteiro v2?
2. Cena 3 sem número nenhum (regra 5) — ok?
3. Tem **foto real** de imóvel (com autorização) pras cenas 3 e 5? Senão,
   post estilizado sem foto.

## Decisões de 2026-10-16 (ideia central + Higgsfield)

- **Ideia central do dono** (entra no roteiro): "não conseguir transformar
  presença digital em oportunidades comerciais previsíveis, sem depender de
  trabalho manual o tempo inteiro". Sem prometer resultado: o que é
  previsível é o **método**, não o número de clientes.
- **Roteiro v2 aprovado pelo dono, com estes ajustes** (mantém ~33s):
  - Cena 3 vira duas: 3a (5–7s) "Curtidas… não agendam *visita.*" e
    3b (7–9s) **"E fazer tudo na mão… não *escala.*"** (tarefas
    empilhando — "postar", "responder", "legendar" — até desabar).
  - Cena 4 (9–12s): logo SALES BOOST + **"Menos sorte. Mais *método*."**
    (escolha do dono; substitui "a IA que transforma imóveis em demanda").
  - Cenas 1, 2, 5, 6 e 7 iguais.
- **Higgsfield:** o conector do claude.ai está ligado, mas a conta dele tem
  0 créditos (plano free). Os créditos do dono estão na **API** do
  Higgsfield. Caminho: o dono põe a chave da API como variável de ambiente
  `HF_CREDENTIALS` (formato `key_id:key_secret`, igual ao secret do
  Supabase) e libera `platform.higgsfield.ai` em Network access; depois
  abre sessão nova. Continua valendo: lista de cenas + custo → um "ok"
  único do dono antes de gerar.

## Bloqueios desta sessão (2026-10-15/16)

- **Conector Higgsfield não aparecia** na sessão. Dono vai conectar em
  claude.ai/customize/connectors e abrir sessão nova.
- **Rede do ambiente bloqueava** `getsaleboost.com` e
  `miwcxakzyforbahpnpst.supabase.co` (sem prints do painel). Dono vai
  liberar em Network access (ou Full) — incluir também `higgsfield.ai`.
- Prints do painel: usar **conta de teste** (e-mail
  `Luan26ribeiro+teste2@gmail.com`; senha com o dono — **nunca** salvar
  aqui). Nunca conta de cliente real (Liga dos Sonhos). Dono deve trocar a
  senha depois.

## Regras que valem pra esse vídeo

- IA de vídeo (Katana) **nunca escreve texto** e **nunca gera imóvel** —
  só cenas de cidade/bairro/celular. Texto e logo entram na montagem
  (Remotion).
- Nada de número inventado (curtidas, vendas, prazos), nada de "valorização
  garantida".
- Telas do painel: versões estilizadas só do que o produto faz de verdade.
- Nada é publicado pelo Claude — o dono posta.

## Como gerar os arquivos

```bash
cd marketing/video-apresentacao
npm install
# no container da nuvem, apontar pro Chromium já instalado:
npx remotion render src/index.tsx Apresentacao out/sales-boost-apresentacao.mp4 \
  --browser-executable=/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell
npx remotion still src/board.tsx Board out/storyboard.png \
  --browser-executable=/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell
```

O ffmpeg embutido do Remotion não tem filtros (`fps`, `scale`, `tile`):
pra extrair quadros de vídeo use `npx remotion ffmpeg -ss <t> -i <vídeo>
-frames:v 1 saida.jpg` e monte a folha de contato com Python/PIL.

## Sessão de 2026-10-16 (tarde)

- **Storyboard v2** feito: `out/storyboard-v2.png` (`src/board.tsx` agora é
  o v2, 11 quadros: 1, 2, 3a, 3b, 4, 5a–5d, 6, 7). O v1 continua em
  `out/storyboard.png`.
- **Katana:** é a ferramenta de edição dentro do app do Higgsfield e gasta
  os créditos do app (conector com 0 créditos). Com os créditos da API, as
  3 cenas de cidade saem pelos modelos de vídeo (Kling/Seedance), e a
  edição é feita no Remotion. Mesma ideia do plano original (IA só no
  fundo).
- **Rede:** `getsaleboost.com` e `platform.higgsfield.ai` liberados. Bancos
  de foto (Unsplash, Pexels, Wikimedia) **bloqueados** — a foto real do
  imóvel (cenas 3a e 5b) precisa vir do dono ou de liberar
  `images.unsplash.com` em Network access.
- **Prints do painel** (cenas 5d e 6): ainda não tirados; precisam de login
  na conta de teste.
- Dono deu ok pra gerar as cenas de IA depois de ver o storyboard.

## Sessão de 2026-10-16 (noite) — geração das 3 cenas bloqueada

Pedido do dono: gerar as 3 cenas de cidade, 2 versões de cada (já
aprovadas): Copacabana ao entardecer (cena 1), Botafogo com o Pão de Açúcar
de dia (cena 5a) e drone sobre o Rio à noite (cena 7). **Nada foi gerado e
nenhum crédito foi gasto.**

- **API (`platform.higgsfield.ai`):** a rede passa e a chave é colocada
  automaticamente nas chamadas, mas a Higgsfield responde
  `{"detail":"Invalid credentials"}` em qualquer rota (status e
  text-to-video). Provável: chave errada/revogada, ou fora do formato
  `key_id:key_secret`. Conferir/gerar a chave no painel da API da
  Higgsfield e salvar de novo em `HF_CREDENTIALS` (nas configurações do
  ambiente), depois abrir sessão nova.
- **Conector do claude.ai:** continua com 0 créditos (plano free).
- **Divergência registrada:** o código do produto chama
  `api.higgsfield.ai`; este ambiente só libera `platform.higgsfield.ai`.
  Se a chave estiver certa e o erro continuar, liberar também
  `api.higgsfield.ai` em Network access.
- Próxima sessão: testar a chave com uma chamada de status; se passar,
  gerar as 6 versões (texto → vídeo, 9:16, sem texto, sem imóvel, sem
  pessoas) e salvar em `marketing/video-apresentacao/public/cenas/`.

## Sessão de 2026-10-16 (madrugada) — cenas geradas, download bloqueado

- **Chave da API Higgsfield funcionando** (o "Invalid credentials" sumiu).
  Rotas que respondem em `platform.higgsfield.ai`:
  `/kling-video/v3.0/{std,pro}/text-to-video` (aspect_ratio 9:16|16:9|1:1,
  duration até 15, sound on/off) e `/higgsfield-ai/soul/standard` (imagem;
  aspect_ratio 9:16…3:2, resolution 720p|1080p). Seedance/Seedream/Nano
  Banana: `model_not_found`; Kling 2.1 master: `model_blocked`.
- **Geradas (Kling 3.0 pro, 9:16, sem som)** — 2 versões de cada:
  Copacabana entardecer (5s), Botafogo/Pão de Açúcar de dia (5s), drone Rio
  à noite (7s). E 2 imagens da casa (Soul, 3:4, 1080p) — ver decisão do dono
  em [DECISIONS.md](DECISIONS.md) (exceção da regra 4 só pra este anúncio).
- **Download bloqueado:** a Higgsfield entrega os arquivos em
  `d3u0tzju9qaucj.cloudfront.net`, que a rede do ambiente recusa (403).
  Liberar esse domínio em Network access. Os links (públicos) e os IDs dos
  pedidos estão abaixo; o status de cada um se consulta de graça em
  `/requests/<id>/status`.

| Arquivo | ID do pedido |
|---|---|
| cena1-copacabana-v1 | b0bba788-a96e-49f0-845e-556dadc9d781 |
| cena1-copacabana-v2 | e6bbb56d-3cf3-4539-9408-c406f24926b9 |
| cena5a-botafogo-v1 | 4bf3db52-715d-49df-a476-e00aa4a32e97 |
| cena5a-botafogo-v2 | 5dc76c13-3ccf-4f18-a0f2-5daab1881ab7 |
| cena7-rio-noite-v1 | e36d1be3-1f87-48c9-b316-c23d814879ed |
| cena7-rio-noite-v2 | ea01f816-25f5-4e9b-bc2d-0b17b8101533 |
| casa-v1 (imagem) | 5bdfb548-d755-47a4-a6ef-4aacd582e9aa |
| casa-v2 (imagem) | 34ec5ae0-7e54-4316-b6c6-aa0d9ccbb0be |

- **Prints do painel** (conta de teste; senha não salva) em
  `public/painel/`, recortados sem o e-mail da conta:
  - `aprovacoes-celular.png` → cena 6 ("Você aprova tudo").
  - `calendario-celular.png` → cena 5b ("CRIA posts que vendem").
  - `agentes-computador.png` → cenas 4/5 (os 4 agentes). A linha do
    objetivo do Agente de Estratégia foi desfocada (tinha valor em R$ da
    conta de teste — regra 5).
  - Sem print bom pra 5c (respostas/DM) e 5d (aprendizado): a conta de
    teste não tem dado real nessas telas → fazer versão estilizada.
- Pra tirar os prints de novo: fechar o aviso de cookies ("Só essenciais")
  e o pop-up "Seu status de negócio" (botão "Fechar"), senão eles cobrem a
  tela.

- **Atualização (mesma sessão):** a rede passou a liberar o cloudfront e os
  8 arquivos foram baixados pra `public/cenas/` (6 vídeos + `casa-v1.png` e
  `casa-v2.png`). Folhas de comparação: `out/comparar-cenas.jpg` e
  `out/comparar-casa.jpg`.
- **Erro geográfico da IA:** nas duas versões da cena 7 (Rio à noite) o
  Cristo Redentor aparece **em cima do Pão de Açúcar** (no início da v1 e
  na v2 toda). Carioca percebe. Usar só o final da v1 (de ~4s em diante),
  onde o Cristo está no próprio morro — ou gerar de novo sem o Cristo.
