-- Fase 3+4 (Etapa A): ensina a ficha imoveis_rio COMO produzir cada peça do
-- item_package já existente — qual pilar cada peça alimenta (reaproveitando
-- os mesmos pilares/pesos que já existem em config.pillars, sem duplicar
-- número), de onde vem a mídia (foto real do catálogo / material do
-- corretor / gráfico-texto), e o que é responsabilidade de material humano
-- (prova social) em vez de geração automática. `creation_tools` lista os
-- ids de marketing_ai_tool_registry que essa ficha desbloqueia (linhas
-- criadas numa migration futura da Etapa A — combinar os ids exatos).
-- config->'rules' recebe 2 regras novas sobre edição de foto (mantém as que
-- já existem, só concatena).

begin;

update vertical_playbooks
set config = jsonb_set(
  jsonb_set(
    config,
    '{production_recipes}',
    '{
      "imoveis": {
        "etapa_a": {
          "recipes": ["carrossel_tour", "post_detalhe_que_voce_nao_viu"],
          "fonte_midia": "fotos_reais_catalogo",
          "descricao": "Carrossel com as fotos reais do imóvel (capa + detalhes) + texto aplicado via render-format. Nunca gerar imagem do imóvel por IA."
        },
        "etapa_b": {
          "recipes": ["reels_tour_fotos_reais"],
          "fonte_midia": "higgsfield_image_to_video",
          "descricao": "Clipe a partir das fotos reais do imóvel — só movimento de câmera; proibido adicionar, remover ou alterar qualquer objeto da cena."
        }
      },
      "bairro_estilo_vida": {
        "etapa_a": {
          "recipes": ["reels_o_que_compra_no_bairro", "post_3_coisas_perto"],
          "fonte_midia": "material_proprio_ou_imagem_generica_clima",
          "descricao": "Material real do próprio corretor sobre o bairro, ou imagem genérica de clima/ambiente gerada por IA — nunca uma imagem de IA fingindo ser um lugar real específico, e nunca foto do Google Maps/Street View sem licença."
        }
      },
      "mercado": {
        "etapa_a": {
          "recipes": ["stories_enquete_pagaria"],
          "fonte_midia": "grafico_texto",
          "descricao": "Card de texto/gráfico via render-format. Só usar número com fonte real — hoje não existe fonte de dado de mercado do Rio integrada (gap registrado no CLAUDE.md); enquanto isso, falar de tendência em termos gerais, sem inventar número."
        }
      },
      "educacao": {
        "etapa_a": {
          "recipes": [],
          "fonte_midia": "texto_foto_video_real_corretor",
          "descricao": "Conteúdo educativo (financiamento, documentação, processo de compra) como texto + foto/vídeo real do corretor. Não depende de um imóvel específico do catálogo — fica fora do pacote por item, gerado pelo planejador semanal normal."
        }
      },
      "marca_pessoal_prova_social": {
        "etapa_a": {
          "recipes": ["stories_caixa_perguntas", "post_pov_pegou_a_chave"],
          "fonte_midia": "material_e_autorizacao_cliente",
          "descricao": "Só com material real e autorização do cliente/corretor (depoimento, entrega de chaves). O botão \"Gerar pacote\" não preenche isso sozinho — fica pendente de material até o dono anexar."
        }
      }
    }'::jsonb
  ),
  '{creation_tools}',
  '["tour_virtual_tool", "criativos_anuncio_tool", "avatar_corretor_tool", "voz_corretor_tool"]'::jsonb
) || jsonb_build_object(
  'rules',
  (config->'rules') || '[
    "Pode ajustar luz, cor e alinhamento da foto real — nunca staging virtual sem aviso: se usar mobília virtual, avisar \"Imagem ilustrativa – mobiliado virtualmente\" e mostrar a foto original junto (staging em si não está implementado ainda).",
    "Nunca esconder defeito do imóvel, mudar a vista da janela, aumentar o tamanho de um cômodo ou trocar o céu/clima da foto."
  ]'::jsonb
),
updated_at = now()
where key = 'imoveis_rio';

commit;
