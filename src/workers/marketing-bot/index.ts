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
    case 'CYCLE_SUMMARY': {
      const openCount = (data?.openCount as number) ?? 0;
      const newCount = (data?.newCount as number) ?? 0;
      const suggestions = (data?.suggestions as string[]) ?? [];
      if (openCount === 0) return '✅ Tudo em dia! Nenhuma oportunidade pendente no momento.';
      const list = suggestions.map(s => `• ${s}`).join('\n');
      const novidade = newCount > 0 ? `${newCount} nova(s) desta vez.\n` : '';
      return `📋 Resumo do Agente de Marketing\n${openCount} oportunidade(s) aberta(s) aguardando você:\n${list}\n${novidade}Use /relatorio para mais detalhes.`;
    }
    case 'REPORT_READY':
      return `📊 Relatório disponível!\nPeríodo: ${(data?.period as string) ?? ''}\nScore: ${(data?.health_score as number) ?? ''}\nUse /relatorio para acessar.`;
    case 'AGENT_ACTION': {
      const action = (data?.action as string) ?? '';
      const count = (data?.count as number) ?? 0;
      const reason = (data?.reason as string) ?? '';
      const sample = (data?.sample as string) ?? '';
      if (action === 'posts_created') {
        const preview = sample ? `\n\nExemplo: "${sample.slice(0, 140)}${sample.length > 140 ? '…' : ''}"` : '';
        return `📝 O agente criou ${count} post(s) novo(s)\nMotivo: ${reason}${preview}\n\nAprove em Posts.`;
      }
      if (action === 'replies_drafted') {
        return `💬 O agente rascunhou ${count} resposta(s) de avaliação\nMotivo: ${reason}\n\nAprove em Oportunidades.`;
      }
      return `🤖 O agente executou uma ação${reason ? `: ${reason}` : ''}.`;
    }
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

        // Grava a mesma mensagem que foi pro Telegram na aba Atividades do
        // dashboard — texto idêntico, sem duplicar a lógica de formatação.
        if (sent && env.LOG_BOT_EVENT_URL) {
          fetch(env.LOG_BOT_EVENT_URL, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
              secret: env.BOT_WEBHOOK_SECRET ?? '',
              bot_name: env.BOT_TYPE ?? 'marketing',
              event_type: payload.event,
              message: text,
              telegram_chat_id: chatId,
              company_id: payload.company_id ?? null,
            }),
          }).catch(() => {});
        }

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
