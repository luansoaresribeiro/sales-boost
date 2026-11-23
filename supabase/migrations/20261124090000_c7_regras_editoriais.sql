-- C7 (auditoria do conteúdo, etapa 1 — dono, 23/11 "tudo sim"). Só acrescenta chaves na ficha de imóveis (Rio e EUA).
--  content_rules: modelos de card desligados (trend/problem), teto de 2 educativos por semana, trava de ASSUNTO na janela
--  de semanas da ficha, frases de experiência pessoal proibidas sem informação do corretor.
--  ctas: lista por objetivo comercial e o mesmo CTA no máximo 3x por semana.
-- Desfazer: remover as chaves abaixo de content_rules e ctas (o código volta ao comportamento de antes).
update public.vertical_playbooks v
set config = jsonb_set(jsonb_set(v.config, '{content_rules}', coalesce(v.config->'content_rules', '{}'::jsonb) || $json${
  "disabled_templates": ["trend", "problem"],
  "educational_formats": ["carrossel_educativo", "carrossel_slides", "dica_faq"],
  "educational_max_per_week": 2,
  "theme_topic_window": true,
  "experiential_phrases": ["na minha experiência", "na nossa experiência", "pela minha experiência", "já vi muitos clientes", "já vi muitos compradores", "meus clientes sempre", "nossos clientes sempre", "já atendi muitos", "em todos esses anos"]
}$json$::jsonb, true), '{ctas}', coalesce(v.config->'ctas', '{}'::jsonb) || $json${
  "max_same_per_week": 3,
  "by_objective": {
    "visita": ["Me chama no direct que eu te mando a ficha", "Salve para a visita", "Manda pra quem está procurando no bairro"],
    "desejo": ["Salve para ver de novo", "Manda pra quem está procurando no bairro"],
    "bairro": ["Siga para acompanhar o bairro", "Salve este guia", "Manda pra quem vai se mudar"],
    "decisao": ["Comente a sua dúvida", "Salve para a visita", "Me chama no direct"],
    "captar": ["Me chama para conversar sobre o seu imóvel"],
    "confianca": []
  }
}$json$::jsonb, true)
where v.key = 'imoveis_rio';

update public.vertical_playbooks v
set config = jsonb_set(jsonb_set(v.config, '{content_rules}', coalesce(v.config->'content_rules', '{}'::jsonb) || $json${
  "disabled_templates": ["trend", "problem"],
  "educational_formats": ["carrossel_educativo", "carrossel_slides", "dica_faq"],
  "educational_max_per_week": 2,
  "theme_topic_window": true,
  "experiential_phrases": ["in my experience", "in our experience", "i've seen many clients", "i have seen many buyers", "my clients always", "our clients always", "over the years i've"]
}$json$::jsonb, true), '{ctas}', coalesce(v.config->'ctas', '{}'::jsonb) || $json${
  "max_same_per_week": 3,
  "by_objective": {
    "visita": ["DM me and I'll send the full listing", "Save this for your showing", "Share with someone looking in the area"],
    "desejo": ["Save this to see again", "Share with someone looking in the area"],
    "bairro": ["Follow to keep up with the neighborhood", "Save this guide", "Send to someone who's moving"],
    "decisao": ["Comment your question", "Save this for your showing", "Send me a DM"],
    "captar": ["DM me to talk about your home"],
    "confianca": []
  }
}$json$::jsonb, true)
where v.key = 'imoveis_us';
