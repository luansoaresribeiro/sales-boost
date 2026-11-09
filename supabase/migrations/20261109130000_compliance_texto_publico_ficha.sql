-- Etapa 1 · PR 1B (2026-11-09, autorizada pelo dono em 07/11): proteção do texto que vai ao público
-- (legendas, publicação, DM de automação do Instagram, resposta automática do WhatsApp).
-- Vive na FICHA (regra 6): o código só lê config.compliance.public_text (supabase/functions/_shared/compliance.ts).
--   discrimination = FRASES COM CONTEXTO que rotulam quem pode ou não comprar/alugar (classes protegidas). Nunca palavra
--                    solta: "sala ampla para receber a família" e "600 m da praia" passam.
--   promises       = promessa de resultado sem prova (valorização garantida, retorno certo, vai vender rápido…).
--   allow          = afirmação comercial comprovável que parece promessa (garantia locatícia, seguro-fiança…).
--   safe_reply     = resposta neutra quando a resposta automática tem problema (nada problemático é enviado).
--   prompt_rule    = regra que entra no pedido da legenda à IA.
-- Texto comparado em minúsculas e sem acento. Aditivo e idempotente. NÃO apaga dados, NÃO mexe em RLS.
--
-- ROLLBACK:
--   update public.vertical_playbooks set config = config #- '{compliance,public_text}' where key = 'imoveis_rio';
begin;

update public.vertical_playbooks
set config = jsonb_set(
  case when jsonb_typeof(config->'compliance') = 'object' then config else jsonb_set(config, '{compliance}', '{}'::jsonb, true) end,
  '{compliance,public_text}', $json${
    "pt": {
      "discrimination": [
        "(?:ideal|perfeit[oa]|otim[oa]|feit[oa]|pensad[oa]|exclusiv[oa]|indicad[oa]|recomendad[oa]|so|somente|apenas|especial|sob medida) (?:para|pra) (?:a sua |sua |a |o |os |as |um |uma |quem tem |quem e )?(?:executiv\\w* |profissionais |estudantes |casais |pessoas )?(?:familias?|casal|casais|criancas|filhos|solteir\\w*|casad\\w*|idos\\w*|aposentad\\w*|jovens|homens?|mulher(?:es)?|estrangeir\\w*|gringos?|cristaos?|evangelic\\w*|catolic\\w*|judeus?|muculman\\w*|gays?|heteros?|terceira idade|melhor idade|pessoas? de bem|gente de bem)",
        "nao (?:aceit\\w*|alug\\w*|vend\\w*|permit\\w*|admit\\w*|quer\\w*)(?: \\w+)? (?:criancas|filhos|familias|casais|estrangeir\\w*|idos\\w*|solteir\\w*|gays?|cadeirantes?)",
        "(?:proibid\\w*|vedad\\w*) (?:para |a )?(?:criancas|filhos|casais|familias|estrangeir\\w*)",
        "sem criancas", "adultos? apenas", "(?:apenas|somente|so) (?:para )?adultos",
        "(?:perto|proximo|pertinho|ao lado|a poucos passos|colado) (?:d[aoe]s?|a|ao) (?:igreja|templo|sinagoga|mesquita|centro espirita|terreiro)\\w*",
        "(?:gente|pessoas|vizinhanca|vizinhos|bairro) (?:de bem|selecionad[oa]s?|branc[oa]s?|de familia tradicional)"
      ],
      "promises": [
        "valorizacao (?:garantida|certa|assegurada)", "(?:garantia|certeza) de (?:valorizacao|lucro|retorno|rentabilidade|venda|aprovacao)",
        "(?:retorno|lucro|rentabilidade|renda) (?:garantid[oa]|cert[oa]|assegurad[oa])",
        "(?:vai|vao|ira|irao) (?:valorizar|se valorizar|dobrar de valor|vender rapido)",
        "(?:nunca|jamais) (?:desvaloriza|perde valor)", "sempre valoriza",
        "(?:investimento|negocio) sem risco", "risco zero", "venda garantida",
        "(?:financiamento|credito) (?:garantido|aprovado garantido|aprovado na hora)",
        "melhor investimento d[oa] (?:cidade|rio|bairro|mercado|pais)"
      ],
      "allow": ["garantia locaticia", "seguro[ -]fianca", "titulo de capitalizacao", "garantia (?:da|de) (?:obra|construtora|fabrica)"]
    },
    "en": {
      "discrimination": [
        "(?:ideal|perfect|great|made|designed|exclusive|only|just) for (?:a |the |your )?(?:famil(?:y|ies)|couples?|kids|children|singles?|married couples?|seniors|retirees|young people|men|women|christians|jews|muslims|foreigners|immigrants)",
        "no (?:kids|children|families|couples|foreigners)", "adults? only", "(?:near|next to|steps from|close to) (?:a |the )?(?:church|temple|synagogue|mosque)\\w*"
      ],
      "promises": [
        "guaranteed (?:appreciation|return|profit|sale|approval)", "(?:will|is going to) (?:appreciate|double in value|sell fast)",
        "never loses value", "risk[- ]free", "can'?t lose", "best investment in (?:town|the city|the market)"
      ],
      "allow": ["security deposit", "rent guarantee insurance", "builder'?s warranty"]
    },
    "safe_reply": { "pt": "Obrigado pela mensagem! Vou te responder pessoalmente em breve com as informações certinhas.", "en": "Thanks for your message! I'll reply personally soon with the right details." },
    "prompt_rule": {
      "pt": "Descreva o imóvel, a região e o estilo de vida sem dizer para quem ele é ou não é (família, casal, idade, religião, origem, estado civil, deficiência) e sem prometer valorização, retorno, lucro ou venda.",
      "en": "Describe the property, the area and the lifestyle without saying who it is or is not for (family, couple, age, religion, origin, marital status, disability) and without promising appreciation, return, profit or a sale."
    }
  }$json$::jsonb, true)
where key = 'imoveis_rio'
  and (config->'compliance'->'public_text') is null;

commit;
