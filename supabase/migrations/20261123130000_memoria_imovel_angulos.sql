-- Etapa C (dono, 23/11): memória por imóvel. Ângulos com que um imóvel pode ser mostrado, o que habilita cada um (marca do
-- corretor ou campo do cadastro) e as receitas que já têm ângulo fixo. Só ACRESCENTA chaves em content_rules (regra 6).
-- Lido por _shared/itemMemory.ts. Desfazer: remover item_angles, item_angle_recipes, item_angle_lookback e item_audience_field
-- de config.content_rules da ficha imoveis_rio.
update public.vertical_playbooks v
set config = jsonb_set(v.config, '{content_rules}', coalesce(v.config->'content_rules', '{}'::jsonb) || jsonb_build_object(
  'item_angle_lookback', 4,
  'item_audience_field', 'pontos_para_quem',
  'item_angles', $json$[
    {"key": "vista", "label": "Vista", "prompt": "mostre o imóvel pela vista que ele tem.", "marks": ["Vista para o mar", "Vista verde", "Vista da cidade"], "fields": ["vista"]},
    {"key": "localizacao", "label": "Localização", "prompt": "mostre o que o endereço permite no dia a dia (o que fica perto, como é a região).", "marks": ["Perto da praia", "Perto do metrô", "Rua tranquila / perto da natureza", "Vida noturna e restaurantes", "Escolas perto", "Tudo a pé (mercado, padaria, farmácia)"], "fields": ["perto_de"]},
    {"key": "rotina", "label": "Rotina no imóvel", "prompt": "mostre como é viver ali: varanda, lazer, luz e rotina da casa.", "marks": ["Varanda", "Lazer completo", "Sol da manhã", "Aceita pet"], "fields": ["lazer"]},
    {"key": "espaco", "label": "Espaço e planta", "prompt": "mostre o espaço: metragem, quartos, como os ambientes se organizam.", "marks": ["Reformado", "Vaga de garagem", "Andar alto"], "fields": ["m2", "quartos", "andar", "vagas"]},
    {"key": "detalhe", "label": "O detalhe", "prompt": "mostre o detalhe que só quem visita percebe, informado pelo corretor.", "marks": [], "fields": ["detalhe_que_ninguem_percebe"]},
    {"key": "investimento", "label": "Investimento", "prompt": "fale de liquidez e procura pela região, sem nenhum número de retorno e sem prometer valorização.", "marks": ["Investir / alugar"], "fields": []}
  ]$json$::jsonb,
  'item_angle_recipes', $json${"post_3_coisas_perto": "localizacao", "reels_o_que_compra_no_bairro": "localizacao", "post_detalhe_que_voce_nao_viu": "detalhe"}$json$::jsonb
), true)
where v.key = 'imoveis_rio' and (v.config->'content_rules'->'item_angles') is null;
