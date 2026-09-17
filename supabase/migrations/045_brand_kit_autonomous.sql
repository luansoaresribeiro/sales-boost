-- Kit da Marca autônomo: o agente decide sozinho a partir dos arquivos reais
-- (Instagram + Produtos), sem exigir clique manual. auto_generated=true
-- enquanto for só a IA decidindo; vira false assim que o dono editar e
-- salvar manualmente — dali em diante o cron para de sobrescrever.
alter table brand_dna add column if not exists auto_generated boolean not null default true;
