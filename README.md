# Sales Boost

**"Sales Boost — gerando mais visitas para o seu imóvel."**

Sistema de inteligência e geração de demanda comercial para imobiliárias. Ele:
1. lê o mercado;
2. conecta o que lê aos imóveis da imobiliária;
3. cria conteúdo e o tour virtual a partir de fotos reais;
4. mede o resultado: visualizações → interessados → leads → visitas.

Nada vai ao público sem a aprovação do dono da conta.

- **Comece por [CLAUDE.md](CLAUDE.md):** o resumo, as regras e o índice da documentação.
- **Direção e prioridades:** [docs/PRODUCT.md](docs/PRODUCT.md) (estado atual), [docs/ROADMAP.md](docs/ROADMAP.md) e
  [docs/PENDENCIAS.md](docs/PENDENCIAS.md) (lista central do que falta).
- **Decisões, com data e motivo:** [docs/DECISIONS.md](docs/DECISIONS.md).

## Rodar e publicar

```bash
npm install
npm run dev      # site local
npm run build    # confere se compila
```

- **Site:** depois de cada merge na `main`, a Cloudflare (Workers Builds) publica o getsaleboost.com sozinha.
- **Funções do Supabase:** o workflow `.github/workflows/deploy-functions.yml` publica só as que mudaram.
