alter table marketing_ai_strategies
  add column if not exists thesis text,
  add column if not exists primary_constraint text,
  add column if not exists strategic_opportunity text,
  add column if not exists exclusions jsonb not null default '[]',
  add column if not exists active_components jsonb not null default '[]',
  add column if not exists success_conditions text,
  add column if not exists failure_conditions text,
  add column if not exists review_cadence text;

alter table marketing_ai_strategy_log
  add column if not exists decision_type text check (decision_type in ('refine','pivot','terminate'));
