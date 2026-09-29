-- Fase 2: converte onboarding_questions da ficha 'imoveis_rio' pro formato
-- bilingue (label/options viram {pt, en} em vez de string solta), pra a
-- estrutura ja nascer pronta pra pt/en mesmo que hoje so exista pt usado de
-- verdade em produto. Confirmado antes desta migration: nenhum dos 6
-- helpers de fetchPlaybookBlock (strategy-generate, creative-generate,
-- content-engine, content-intelligence, generate-posts, hermes-proxy) le
-- onboarding_questions - so playbook_answers (valores, nao mudam de forma
-- aqui) - entao essa mudanca nao afeta nenhum deles.

begin;

update vertical_playbooks
set config = jsonb_set(
  config,
  '{onboarding_questions}',
  '[
    {
      "key": "transacao",
      "label": {"pt": "Você trabalha com venda, aluguel ou os dois?", "en": "Do you work with sales, rentals, or both?"},
      "type": "select",
      "options": [
        {"pt": "Venda", "en": "Sale"},
        {"pt": "Aluguel", "en": "Rental"},
        {"pt": "Os dois", "en": "Both"}
      ]
    },
    {
      "key": "faixa_preco",
      "label": {"pt": "Qual a faixa de preço que você mais trabalha?", "en": "What price range do you work with most?"},
      "type": "select",
      "options": [
        {"pt": "Até R$500 mil", "en": "Up to R$500k"},
        {"pt": "R$500 mil–R$1,5 mi", "en": "R$500k–R$1.5M"},
        {"pt": "Acima de R$1,5 mi", "en": "Above R$1.5M"}
      ]
    },
    {
      "key": "bairros",
      "label": {"pt": "Quais bairros você atende (até 5)?", "en": "Which neighborhoods do you serve (up to 5)?"},
      "type": "multi_text",
      "max": 5
    },
    {
      "key": "cliente_tipico",
      "label": {"pt": "Qual seu cliente típico?", "en": "Who is your typical client?"},
      "type": "select",
      "options": [
        {"pt": "Família", "en": "Family"},
        {"pt": "Primeiro imóvel", "en": "First-time buyer"},
        {"pt": "Investidor", "en": "Investor"},
        {"pt": "De fora do Rio", "en": "From outside Rio"},
        {"pt": "Aposentado", "en": "Retiree"}
      ]
    },
    {
      "key": "creci",
      "label": {"pt": "Qual seu CRECI?", "en": "What is your CRECI license number?"},
      "type": "text"
    },
    {
      "key": "carteira",
      "label": {"pt": "Quantos imóveis você tem na carteira hoje?", "en": "How many properties do you currently manage?"},
      "type": "select",
      "options": [
        {"pt": "1–5", "en": "1–5"},
        {"pt": "6–20", "en": "6–20"},
        {"pt": "20+", "en": "20+"}
      ]
    }
  ]'::jsonb
),
updated_at = now()
where key = 'imoveis_rio';

commit;
