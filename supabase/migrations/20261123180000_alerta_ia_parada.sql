-- Item 1 da estratégia (dono, 23/11): avisar quando a IA para. Só acrescenta.
-- 1) Serviço novo no monitor: checagem real do crédito da Anthropic (o "ai_anthropic" antigo só testa se a API responde).
insert into public.platform_services (key, name, category, critical, check_type, target, enabled)
values ('ai_credit', 'IA (crédito da Anthropic)', 'ai', true, 'ai_credit', null, true)
on conflict (key) do nothing;
-- 2) Interruptor lido pela tela do cliente (faixa "geração pausada"); o monitor liga/desliga.
insert into public.feature_flags (key, label, enabled)
values ('ai_paused', 'IA pausada (faixa na tela do cliente, controlada pelo platform-monitor)', false)
on conflict (key) do nothing;
-- Desfazer: delete from public.platform_services where key = 'ai_credit'; delete from public.feature_flags where key = 'ai_paused';
