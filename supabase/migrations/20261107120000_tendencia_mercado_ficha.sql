-- A.6 (2026-11-07): frases de TENDÊNCIA de mercado que exigem sinal real com fonte (Tespon, carrossel e186633d:
-- "Locatários com renda mais alta estão escolhendo contratos mais longos", "Isso reduz a rotatividade… custo de vacância").
-- Vive na FICHA (regra 6): o código só lê opportunity_texts.market_trends[lang] = {terms, opinion}. Sem a lista, a trava fica desligada.
--   terms   = trechos (sem acento, início de palavra) que afirmam tendência/comportamento/efeito de mercado como fato.
--   opinion = trechos que marcam frase em tom de opinião/orientação do corretor (essas passam).
-- Peça que afirma tendência SEM sinal de mercado com fonte ligado à vaga recebe "Precisa de fonte:" no reasoning, nota -25 e não vai sozinha pro Vault.
-- Aditivo e idempotente (só preenche se ainda não existir). NÃO apagar dados, NÃO mexer em RLS.
--
-- ROLLBACK:
--   update public.vertical_playbooks set config = config #- '{opportunity_texts,market_trends}' where key = 'imoveis_rio';
begin;

update public.vertical_playbooks
set config = jsonb_set(config, '{opportunity_texts,market_trends}', $json${
  "pt": {
    "terms": ["estao escolhendo", "estao buscando", "estao optando", "estao migrando", "estao preferindo", "estao procurando", "estao comprando", "estao alugando", "cada vez mais", "tendencia", "em crescimento", "tem crescido", "vem crescendo", "esta crescendo", "rotatividade", "vacancia", "o mercado esta", "o mercado imobiliario esta", "compradores estao", "locatarios estao", "investidores estao", "quem aluga esta", "quem compra esta"],
    "opinion": ["na minha experiencia", "no meu atendimento", "o que eu recomendo", "eu recomendo", "recomendo", "eu costumo", "costumo orientar", "minha orientacao", "na minha visao", "acredito que", "vale conferir", "vale a pena conferir"]
  },
  "en": {
    "terms": ["are choosing", "are looking for", "are moving", "are preferring", "are buying", "are renting", "more and more", "trend", "is growing", "has grown", "have grown", "increasingly", "turnover", "vacancy", "the market is", "buyers are", "tenants are", "investors are"],
    "opinion": ["in my experience", "i recommend", "my advice", "i believe", "worth checking", "worth a look"]
  }
}$json$::jsonb, true)
where key = 'imoveis_rio'
  and jsonb_typeof(config->'opportunity_texts') = 'object'
  and (config->'opportunity_texts'->'market_trends') is null;

commit;
