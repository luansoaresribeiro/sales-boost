// DESATIVADA (2026-11-07, decisão do dono — Etapa 0): esta função antiga publicava no Instagram
// sem conferir quem chamava e sem aprovação humana. Nenhuma tela a usa; o publicador único é
// agent-actions (com aprovação do dono, trava em _shared/publishGuard.ts).
// Rollback: `git show 8b347eb:supabase/functions/publish-instagram/index.ts` (versão antiga) — NÃO recomendado.
const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' }
Deno.serve((req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  return new Response(JSON.stringify({ error: 'Função desativada. Publicação só com aprovação do dono, pela fila de Aprovações.', code: 'gone' }), { status: 410, headers: { ...cors, 'Content-Type': 'application/json' } })
})
