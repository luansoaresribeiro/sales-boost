/**
 * mcp — SalesBoost MCP Server (Streamable HTTP, JSON-RPC 2.0)
 * O Hermes autônomo (Railway) conecta aqui como MCP host.
 *
 * Auth: Authorization: Bearer <MCP_GATEWAY_TOKEN>
 * Tier 1 → executa direto (leituras + rascunhos)
 * Tier 2 → cria pending_action + avisa Luan no Telegram → ele aprova no painel
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { TIER1_TOOLS, TIER2_TOOLS, executeTier1, executeTier2 } from './tools.ts'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type, mcp-session-id, x-client-info, apikey',
}

const PROTOCOL_VERSION = '2024-11-05'
const SERVER_INFO = { name: 'salesboost', version: '1.0' }

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  // Token auth
  const raw = req.headers.get('Authorization') ?? ''
  const token = raw.startsWith('Bearer ') ? raw.slice(7) : raw
  const expected = Deno.env.get('MCP_GATEWAY_TOKEN')
  if (!expected || token !== expected) {
    return respond({ jsonrpc: '2.0', id: null, error: { code: -32001, message: 'Unauthorized' } }, 401)
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const admin = createClient(supabaseUrl, serviceKey)

  let body: unknown
  try { body = await req.json() }
  catch { return respond({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error' } }) }

  if (Array.isArray(body)) {
    const results = (await Promise.all(body.map(m => dispatch(m as Msg, admin)))).filter(r => r !== null)
    return respond(results)
  }

  const result = await dispatch(body as Msg, admin)
  if (result === null) return new Response(null, { status: 204, headers: cors })
  return respond(result)
})

type Msg = { method?: string; id?: unknown; params?: unknown }

async function dispatch(msg: Msg, admin: ReturnType<typeof createClient>): Promise<unknown> {
  const { method, id } = msg
  const p = (msg.params ?? {}) as Record<string, unknown>

  switch (method) {
    case 'initialize':
      return ok(id, { protocolVersion: PROTOCOL_VERSION, capabilities: { tools: {} }, serverInfo: SERVER_INFO })

    case 'notifications/initialized':
    case 'ping':
      return null

    case 'tools/list':
      return ok(id, { tools: [...TIER1_TOOLS, ...TIER2_TOOLS] })

    case 'tools/call': {
      const name = p.name as string
      const args = (p.arguments ?? {}) as Record<string, unknown>
      try {
        if (TIER1_TOOLS.some(t => t.name === name)) {
          const text = await executeTier1(name, args, admin)
          return ok(id, { content: [{ type: 'text', text }] })
        }
        if (TIER2_TOOLS.some(t => t.name === name)) {
          const text = await executeTier2(name, args, admin)
          return ok(id, { content: [{ type: 'text', text }] })
        }
        return err(id, -32601, `Unknown tool: ${name}`)
      } catch (e) {
        return err(id, -32000, String(e))
      }
    }

    default:
      return err(id, -32601, `Method not found: ${method}`)
  }
}

const ok  = (id: unknown, result: unknown) => ({ jsonrpc: '2.0', id, result })
const err = (id: unknown, code: number, message: string) => ({ jsonrpc: '2.0', id, error: { code, message } })

function respond(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { ...cors, 'Content-Type': 'application/json' } })
}
