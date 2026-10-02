# Sales Boost

Sales Boost é uma growth engine de IA pra pequenos negócios: entende o
cliente com dados reais, monta a estratégia, cria e publica conteúdo, e
aprende com o resultado — sempre com o dono aprovando antes de qualquer
coisa ir ao público. Setor piloto hoje: imóveis, Rio de Janeiro, via
Instagram.

## Índice da documentação

Todo agente lê este arquivo primeiro — ele é curto de propósito. O
conteúdo técnico detalhado vive em `docs/`:

- [docs/PRODUCT.md](docs/PRODUCT.md) — posicionamento, verticalização,
  ofertas, público-alvo, diferenciais, concorrentes, modelo de cobrança,
  marca.
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — o ciclo de 10 etapas
  (mapa ✅/🟡/❌), Jarvis, stack, modelo de dados, variáveis de ambiente.
- [docs/CONTENT-INTELLIGENCE.md](docs/CONTENT-INTELLIGENCE.md) — como o
  sistema decide o que criar (pilares, receitas de produção, pacote por
  item, calendário).
- [docs/MEDIA-ENGINE.md](docs/MEDIA-ENGINE.md) — Higgsfield: fotos reais
  do cliente → criativos (plano, ainda não implementado).
- [docs/CONVERSION.md](docs/CONVERSION.md) — da conversa (comentário/DM)
  ao lead.
- [docs/LEARNING.md](docs/LEARNING.md) — medição e aprendizado.
- [docs/INSTAGRAM.md](docs/INSTAGRAM.md) — conexão e publicação.
- [docs/PITFALLS.md](docs/PITFALLS.md) — armadilhas já descobertas (ler
  antes de mexer em cron, auth, domínio, migrations).
- [docs/DECISIONS.md](docs/DECISIONS.md) — decisões, com data e motivo.
- [docs/ROADMAP.md](docs/ROADMAP.md) — prioridades (P0-P4) com critério de
  pronto.
- [docs/ORCHESTRATION.md](docs/ORCHESTRATION.md) — roteiro do time de
  agentes (`.claude/agents/`: `product`, `engineer`, `qa`).

Onde o código real divergir de um doc, **registre a divergência no doc em
vez de apagar o que estava escrito** — isso é o que mantém a documentação
confiável pro próximo agente.

## REGRAS INVIOLÁVEIS

1. Nada vai ao público sem aprovação do dono (post, DM, resposta,
   anúncio).
2. Nunca tocar dados de clientes reais (Liga dos Sonhos) em testes.
3. Nunca publicar em Instagram real sem aprovação explícita — inclui
   @getsaleboost (perfil oficial e público do Sales Boost; uso em teste
   só com as condições de [docs/DECISIONS.md](docs/DECISIONS.md)).
4. Foto de item (imóvel) é sempre real; IA de imagem/vídeo nunca escreve
   texto (texto só via `render-format` ou legenda).
5. Nunca inventar números (preço, m², mercado, métricas).
6. Tudo que é de setor vive na ficha (`vertical_playbooks`) — nunca
   código específico de setor.
7. Respeitar teto de custo de IA e de provedores.
8. Depois de mudar telas, publicar o site (`npm run build && npx wrangler
   deploy`) e confirmar **"Site publicado em getsaleboost.com ✅"** no
   relatório.
9. Falar com o dono (Luan) em português simples — ele não é
   desenvolvedor. Nada de jargão técnico sem explicação. Quando algo
   precisa ser feito no terminal por ele, dar o comando pronto.

## 🔴 Alterações arriscadas — parar e pedir aprovação antes de fazer

- Migration/SQL que altere o banco de produção, apague dados, mude RLS.
  (Se a mudança veio num PR que o dono aprovou e juntou, o merge já é a
  aprovação — aplicar só aquele SQL, conforme
  [docs/ORCHESTRATION.md](docs/ORCHESTRATION.md#banco-de-produção-depois-do-pr-aprovado).)
- Mudar autenticação, `verify_jwt`, secrets, crons/agendamentos.
- Deploy de functions usadas por clientes reais em funcionamento
  (`agent-actions`, `instagram-webhook`, `hermes-proxy`,
  `strategy-generate`, `creative-generate`, `claim-diagnostic`).
- Qualquer publicação/envio em conta real (Instagram, DM, e-mail,
  Telegram de cliente).
- Gastar dinheiro além do teste combinado (Higgsfield, IA em lote, nova
  API paga, novo fornecedor).
- Mudar domínio, DNS, painel da Meta, Supabase Auth.
- Remover ou desligar funcionalidade existente.
- Mudar a direção do produto (algo que contradiga
  [docs/DECISIONS.md](docs/DECISIONS.md)).

**Formato do aviso** (em português simples): O que vou fazer · Por quê ·
O que pode dar errado · Como desfazer · **"Posso seguir?"** — e esperar a
resposta antes de agir.

## Regras de engenharia (sempre, independente da área)

- Do what has been asked; nothing more, nothing less.
- NUNCA criar arquivo novo a menos que seja realmente necessário — prefira
  editar o que já existe.
- NUNCA criar arquivo de documentação fora de `docs/` sem pedido
  explícito.
- SEMPRE ler um arquivo antes de editá-lo.
- NUNCA commitar segredo, credencial ou `.env`.
- Manter arquivos abaixo de 500 linhas quando der.
- Validar entrada nas bordas do sistema.

## Build & Test

```bash
npm run build && npx wrangler deploy
```

Sempre verificar que o build passa antes de reportar tarefa como
concluída.

## Time de agentes

Pra tarefas de engenharia maiores (3+ arquivos, feature nova,
refatoração entre módulos, mudança de API), siga
[docs/ORCHESTRATION.md](docs/ORCHESTRATION.md) — o roteiro da sessão
principal coordenando `product` → `engineer` → `qa`. Pra edição pontual
(1-2 arquivos, fix pequeno, atualização de doc, mudança de config), não
precisa do time — trabalhe direto.
