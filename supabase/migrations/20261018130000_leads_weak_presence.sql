-- Agente de leads: presença digital fraca vira OPORTUNIDADE (dono, 2026-10-15).
-- "Muitos leads que ficaram de fora eram bons — empresa sem muita presença
-- digital é ideal pra gente também." Antes: sem Instagram no site ou
-- Instagram parado há 120+ dias = rejeitado. Agora entra marcado.

-- 1. Marca no lead: 'ativa' | 'sem_instagram' | 'instagram_parado'.
alter table sales_prospects add column if not exists digital_presence text;

-- 2. "Só aceitar quem já tem Instagram ativo" desligado + peso da
--    oportunidade (30 = o mesmo do "Instagram ativo": um não vale menos que o outro).
update prospect_settings
   set require_active_instagram = false,
       scoring_weights = scoring_weights || '{"weak_presence_opportunity": 30}'::jsonb
 where scoring_weights is not null;
update prospect_settings set require_active_instagram = false where scoring_weights is null;

-- 3. Os que já foram rejeitados SÓ por isso (imóveis) voltam pra fila: a
--    próxima busca os reavalia com a regra nova (sem gastar IA à toa nos outros).
delete from prospect_checked_places
 where google_place_id in (
   select google_place_id from prospect_candidate_log
    where status = 'rejected'
      and business_type in ('Imobiliárias', 'Corretores de imóveis', 'Aluguel por temporada (Airbnb)')
      and (rejection_reason like 'Sem Instagram vinculado%' or rejection_reason like 'Instagram parece abandonado%')
 );
