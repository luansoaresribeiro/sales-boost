-- Interruptor GERAL da estrategia automatica (Hermes independente) -- se
-- desligado, nenhuma empresa dispara nada sozinha, mesmo com
-- companies.auto_strategy=true individualmente. Mora em hermes_config
-- (config global singleton) porque e exatamente esse o papel dela.
alter table hermes_config add column if not exists auto_strategy_enabled boolean not null default true;
