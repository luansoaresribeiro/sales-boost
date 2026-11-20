-- Frente 1, item 1.3c (20/11): resultado da conferência de arquitetura do mobiliado (só acrescenta uma coluna).
-- Desfazer: alter table virtual_staging drop column if exists arch_check;
alter table virtual_staging add column if not exists arch_check jsonb;
