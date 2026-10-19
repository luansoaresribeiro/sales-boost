-- Diagnóstico com Social Selling no centro (pedido do dono 2026-10-19). Ver
-- docs/DECISIONS.md (2026-10-19). Aditiva.
-- DESFAZER:
--   alter table public.diagnostics drop column if exists social_selling;
--   update public.vertical_playbooks set config = config #- '{onboarding_v2,social_selling}' where key = 'imoveis_rio';

-- 1) Resultado da leitura do conteúdo (run-diagnosis grava; a página lê).
alter table public.diagnostics add column if not exists social_selling jsonb;

-- 2) Ficha imoveis_rio: categorias de post, pilares e o "por que importa"
--    (tudo de setor na ficha — regra 6). Os sinais cta_posts/owner_replies
--    usam os padrões que já estão em onboarding_v2.diagnosis_readiness.
update public.vertical_playbooks
set config = jsonb_set(config, '{onboarding_v2,social_selling}', $ss${
 "categories": [
  {"key": "anuncio_imovel", "name": "Anúncio de imóvel", "hint": "mostra um imóvel à venda ou para alugar (fotos, características, valor, \"disponível\")"},
  {"key": "educativo", "name": "Conteúdo educativo", "hint": "explica algo que ajuda o comprador a decidir: financiamento, entrada, documentação, custos, riscos, como escolher, erros comuns"},
  {"key": "mercado_bairro", "name": "Mercado e bairro", "hint": "fala do bairro, da região, do que tem perto, de tendências ou do momento do mercado imobiliário"},
  {"key": "prova_social", "name": "Prova social", "hint": "venda ou locação concluída, entrega de chaves, depoimento ou foto com cliente, reconhecimento"},
  {"key": "bastidores", "name": "Bastidores e quem é você", "hint": "rotina, visitas, equipe, apresentação do corretor ou da imobiliária, valores, história"},
  {"key": "convite_conversa", "name": "Convite à conversa", "hint": "pergunta ao público, enquete, \"me conta\", convite para tirar dúvidas, caixa de perguntas"},
  {"key": "outro", "name": "Outro", "hint": "datas comemorativas, avisos, memes ou conteúdo sem relação com a decisão de comprar ou alugar"}
 ],
 "pillars": [
  {"key": "autoridade", "name": "Autoridade", "question": "O conteúdo mostra que você conhece o mercado?", "categories": ["mercado_bairro", "educativo"],
   "why": "Antes de chamar, o comprador quer saber se você entende do assunto. Falar do bairro e do momento do mercado mostra conhecimento — anúncio sozinho mostra só o imóvel."},
  {"key": "educacao", "name": "Educação", "question": "Você ajuda o comprador a entender dúvidas, riscos e decisões?", "categories": ["educativo"],
   "why": "Um comprador pode gostar de um apartamento e ainda ter dúvidas sobre financiamento, documentação, localização ou investimento. Conteúdo que responde a essas perguntas mostra que você ajuda a decidir — antes mesmo da primeira conversa."},
  {"key": "confianca", "name": "Confiança", "question": "Você mostra provas reais do seu trabalho?", "categories": ["prova_social", "bastidores"],
   "why": "Imóvel é a compra mais cara da vida de muita gente. Ver negócios fechados, clientes satisfeitos e quem está por trás do perfil diminui o medo de dar o primeiro passo."},
  {"key": "relacionamento", "name": "Relacionamento", "question": "Seu perfil cria motivos para interagir?", "categories": ["convite_conversa"], "signals": ["owner_replies"],
   "why": "Quem comenta ou responde uma enquete já começou uma conversa com você. Perguntar, responder comentários e puxar assunto transforma seguidor em contato."},
  {"key": "conversao", "name": "Conversão", "question": "Fica fácil dar o próximo passo?", "categories": [], "signals": ["cta_posts"], "strong_share": 0.5,
   "why": "Quem se interessa precisa saber exatamente o que fazer: comentar, chamar no WhatsApp ou agendar uma visita. Sem esse convite, a atenção vai embora."}
 ],
 "buyer_doubts": ["financiamento e entrada", "documentação e certidões", "custos da compra (ITBI, escritura, registro)", "segurança e rotina do bairro", "valorização e investimento", "condomínio e IPTU"]
}$ss$::jsonb, true)
where key = 'imoveis_rio' and config ? 'onboarding_v2';
