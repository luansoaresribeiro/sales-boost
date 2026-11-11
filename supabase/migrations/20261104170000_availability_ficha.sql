-- Fase 4 (2026-11-04) — disponibilidade do imóvel na FICHA do setor (regra 6: setor vive em vertical_playbooks).
-- Decisão do dono: status manual no Catálogo + conferência no link do portal na hora de publicar. Aqui só os valores:
--   statuses  = o que o seletor do Catálogo oferece (a ordem vale);
--   blocking  = quais deles impedem criar peça e publicar;
--   default   = status de quem nunca foi conferido ("disponível");
--   removed   = status que a conferência no portal grava quando o imóvel some do link;
--   labels    = nomes na tela (pt/en).
-- NÃO sobrescreve ajuste manual: só preenche se config.availability ainda não existe (`is null`).
-- Sem a chave, o código trata "nada bloqueado" (compatível com antes). Aditiva e idempotente (rodar 2x dá o mesmo resultado).
--
-- DESFAZER:
--   update public.vertical_playbooks set config = config - 'availability' where key = 'imoveis_rio';
update public.vertical_playbooks
set config = jsonb_set(coalesce(config, '{}'::jsonb), '{availability}', $json$
{
  "statuses": ["disponivel", "reservado", "vendido", "alugado", "inativo", "removido"],
  "blocking": ["reservado", "vendido", "alugado", "inativo", "removido"],
  "default": "disponivel",
  "removed": "removido",
  "labels": {
    "pt": {"disponivel": "Disponível", "reservado": "Reservado", "vendido": "Vendido", "alugado": "Alugado", "inativo": "Inativo", "removido": "Removido do portal"},
    "en": {"disponivel": "Available", "reservado": "Reserved", "vendido": "Sold", "alugado": "Rented", "inativo": "Inactive", "removido": "Removed from portal"}
  }
}
$json$::jsonb, true)
where key = 'imoveis_rio' and config is not null and config->'availability' is null;
