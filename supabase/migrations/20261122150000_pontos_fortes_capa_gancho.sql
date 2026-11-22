-- Pontos fortes, item 4 (dono, 22/11 — docs/PONTOS-FORTES.md): quais campos são marcas (imóvel antes de localização; "para
-- quem é" fica de fora: só tom) e que cômodo cada marca puxa para a foto de abertura. Só acrescenta. Lido por _shared/strengths.ts.
-- Desfazer: update public.vertical_playbooks set config = config - 'strengths' where key in ('imoveis_rio','imoveis_us');
update public.vertical_playbooks
set config = config || jsonb_build_object('strengths', $json${
  "fields": ["pontos_imovel", "pontos_localizacao"],
  "rooms": {
    "Vista para o mar": ["vista"], "Vista verde": ["vista"], "Vista da cidade": ["vista"],
    "Varanda": ["varanda", "vista"],
    "Sol da manhã": ["sala", "quarto"]
  }
}$json$::jsonb)
where key in ('imoveis_rio', 'imoveis_us') and not (config ? 'strengths');
