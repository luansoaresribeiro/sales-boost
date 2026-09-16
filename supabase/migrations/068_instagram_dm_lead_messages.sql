-- Atendimento (Agente de Conversão) passa a receber DM real do Instagram —
-- instagram-webhook grava cada mensagem recebida em lead_messages (o mesmo
-- canal genérico que já existe pro WhatsApp/hermes-proxy), usando o "mid" da
-- Meta como chave de idempotência real (o webhook pode reenviar o mesmo
-- evento). Sem external_id, a dedupe teria que adivinhar por texto+tempo.
alter table lead_messages add column if not exists external_id text;
create index if not exists lead_messages_external_id_idx on lead_messages(external_id) where external_id is not null;
