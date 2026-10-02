import { handleTelegramUpdate } from './commands/handler';

function buildNotificationText(payload: {
  event: string;
  data?: Record<string, unknown>;
  message?: string;
}): string {
  const { event, data } = payload;

  switch (event) {
    case 'NEW_COMPETITOR':
      return `🧭 Novo concorrente!\n${(data?.count as number) ?? 1} concorrente(s) detectado(s)\nUse /concorrentes para ver detalhes.`;
    case 'NEW_LEAD':
      return `📥 Novo lead!\n${(data?.lead as string) ?? 'Novo lead entrou no funil'}`;
    case 'POST_APPROVED':
      return `✅ Post aprovado!\n${(data?.title as string) ?? 'Novo conteúdo disponível'}\nAcompanhe em Posts.`;
    case 'NEGATIVE_REVIEW':
      return `⚠️ Nova avaliação negativa!\n⭐ ${(data?.rating as string) ?? ''} | ${(data?.source as string) ?? ''}\n${(data?.excerpt as string) ?? ''}`;
    case 'OPPORTUNITY_DETECTED':
      return `💰 Oportunidade detectada!\n${(data?.description as string) ?? 'Nova oportunidade encontrada'}\nUse /relatorio para mais detalhes.`;
    case 'REPORT_READY':
      return `📊 Relatório disponível!\nPeríodo: ${(data?.period as string) ?? ''}\nScore: ${(data?.health_score as number) ?? ''}\nUse /relatorio para acessar.`;
    default:
      return (payload.message as string) ?? 'Nova atualização do Sales Boost.';
  }
}

async function sendTelegramMessage(
  token: string,
  chatId: number,
  text: string,
): Promise<boolean> {
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export default {
  async fetch(request: Request, env: Record<string, string>) {
    const url = new URL(request.url);

    // Webhook do Telegram
    if (request.method === 'POST' && url.pathname.startsWith('/webhook')) {
      try {
        const update = (await request.json()) as Parameters<typeof handleTelegramUpdate>[0];
        const response = await handleTelegramUpdate(update, env);
        return new Response(JSON.stringify(response), {
          headers: { 'content-type': 'application/json' },
        });
      } catch {
        return new Response(JSON.stringify({ ok: false }), {
          status: 400,
          headers: { 'content-type': 'application/json' },
        });
      }
    }

    // Notificações internas da plataforma -> Telegram
    if (request.method === 'POST' && url.pathname === '/notify') {
      try {
        const secret = request.headers.get('x-webhook-secret') ?? '';
        if (!env.TELEGRAM_WEBHOOK_SECRET || secret !== env.TELEGRAM_WEBHOOK_SECRET) {
          return new Response(JSON.stringify({ ok: false, error: 'unauthorized' }), {
            status: 401,
            headers: { 'content-type': 'application/json' },
          });
        }

        const payload = (await request.json()) as {
          event: string;
          chat_id: number;
          company_id?: string;
          data?: Record<string, unknown>;
          message?: string;
        };

        const token = env.TELEGRAM_BOT_TOKEN;
        if (!token) {
          return new Response(JSON.stringify({ ok: false, error: 'missing_bot_token' }), {
            status: 500,
            headers: { 'content-type': 'application/json' },
          });
        }

        const chatId = Number(payload.chat_id);
        if (!Number.isFinite(chatId)) {
          return new Response(JSON.stringify({ ok: false, error: 'invalid_chat_id' }), {
            status: 400,
            headers: { 'content-type': 'application/json' },
          });
        }

        const text = buildNotificationText(payload);
        const sent = await sendTelegramMessage(token, chatId, text);

        return new Response(JSON.stringify({ ok: sent }), {
          headers: { 'content-type': 'application/json' },
        });
      } catch (error) {
        return new Response(JSON.stringify({ ok: false, error: String(error) }), {
          status: 400,
          headers: { 'content-type': 'application/json' },
        });
      }
    }

    return new Response('ok');
  },
};
