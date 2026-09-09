import { TelegramUpdate } from '../../../../shared/types';

const TELEGRAM_API = 'https://api.telegram.org';
const BOT_NAME = 'vendas';

async function sendMessage(env: Record<string, string>, chatId: number, text: string) {
  const token = env.TELEGRAM_BOT_TOKEN;
  if (!token) throw new Error('TELEGRAM_BOT_TOKEN not configured');

  const res = await fetch(`${TELEGRAM_API}/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Telegram API error: ${res.status} ${body}`);
  }
  return res.json();
}

async function logEvent(env: Record<string, string>, chatId: number, eventType: string, message: string) {
  const logUrl = env.LOG_EVENT_URL;
  if (!logUrl) return;
  try {
    await fetch(logUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        secret: env.BOT_WEBHOOK_SECRET ?? '',
        bot_name: BOT_NAME,
        event_type: eventType,
        message,
        telegram_chat_id: chatId,
      }),
    });
  } catch { /* logging never blocks the bot */ }
}

async function handleStart(chatId: number, _text: string, env: Record<string, string>) {
  const greeting =
    'Olá! Eu sou o bot de Vendas do Sales Boost.\\n\\n' +
    'Posso te ajudar a conhecer melhor a plataforma e apresentar cases de sucesso.\\n\\n' +
    'Comandos disponíveis:\\n' +
    '/inicio — apresentação\\n' +
    '/cases — cases de sucesso\\n' +
    '/preco — planos e valores\\n' +
    '/agendar — solicitar uma demonstração';

  await sendMessage(env, chatId, greeting);
  await logEvent(env, chatId, 'start', '🎯 Novo lead iniciou o bot de vendas');
}

async function handleCases(chatId: number, _text: string, env: Record<string, string>) {
  await sendMessage(
    env,
    chatId,
    'Cases rápidos:\\n' +
      '• Restaurante X: +38% de receita em 30 dias\\n' +
      '• Restaurante Y: 2.4x mais ações de clientes\\n' +
      '• Restaurante Z: redução de reviews negativas em 60%\\n\\n' +
      'Caso queira uma demonstração personalizada, use /agendar.',
  );
  await logEvent(env, chatId, 'cases', '📈 Lead pediu cases de sucesso');
}

async function handlePreco(chatId: number, _text: string, env: Record<string, string>) {
  await sendMessage(
    env,
    chatId,
    'Plano SalesBoost:\\n' +
      '• R$ 14,49/mês — tudo incluído: conteúdo com IA, oportunidades de receita, atendimento automático e automação 24/7\\n' +
      '• 3 dias grátis pra testar, cancela quando quiser\\n\\n' +
      'Use /agendar para uma demonstração personalizada.',
  );
  await logEvent(env, chatId, 'preco', '💰 Lead consultou preços');
}

async function handleAgendar(chatId: number, _text: string, env: Record<string, string>) {
  await sendMessage(
    env,
    chatId,
    'Perfeito! Para agendar uma demonstração, informe:\\n' +
      '1) Nome do responsável\\n' +
      '2) Nome do restaurante\\n' +
      '3) Cidade/UF\\n' +
      '4) Melhor horário\\n\\n' +
      'Exemplo:\\nJoão, Burguer House, São Paulo/SP, terça às 14h.',
  );
  await logEvent(env, chatId, 'agendar', '📅 Lead solicitou demonstração — aguardando dados');
}

const COMMANDS = new Map<string, (chatId: number, text: string, env: Record<string, string>) => Promise<void>>(
  [
    ['/start', handleStart],
    ['/inicio', handleStart],
    ['/cases', handleCases],
    ['/preco', handlePreco],
    ['/agendar', handleAgendar],
    ['demo', handleAgendar],
  ]
);

async function handleFreeText(chatId: number, text: string, env: Record<string, string>) {
  const chatUrl = env.TELEGRAM_CHAT_URL;
  if (!chatUrl) {
    await sendMessage(env, chatId, 'Serviço de chat não configurado.');
    return;
  }

  try {
    const res = await fetch(chatUrl, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-webhook-secret': env.TELEGRAM_WEBHOOK_SECRET ?? '',
      },
      body: JSON.stringify({ chat_id: chatId, message: text, bot_type: 'vendas' }),
    });
    const data = (await res.json()) as { reply?: string; error?: string };

    if (data.reply) {
      await sendMessage(env, chatId, data.reply);
      await logEvent(env, chatId, 'chat_response', `💬 Resposta automática enviada: ${text.substring(0, 50)}`);
    } else if (data.error) {
      await sendMessage(env, chatId, `❌ Erro ao processar mensagem: ${data.error}`);
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'erro desconhecido';
    await sendMessage(env, chatId, `❌ Falha ao processar: ${message}`);
  }
}

export async function handleTelegramUpdate(update: TelegramUpdate, env: Record<string, string>) {
  const message = update.message ?? update.edited_message;
  if (!message || !message.text) return { ok: true };

  const chatId = message.chat.id;
  const text = message.text.trim();
  const [command, ...rest] = text.split(/\s+/);
  const args = rest.join(' ');

  const handler = COMMANDS.get(command.toLowerCase());
  if (handler) {
    // É um comando registrado
    await handler(chatId, args, env);
    return { ok: true };
  }

  // Não é comando → processar como conversa natural com Claude
  await logEvent(env, chatId, 'mensagem_livre', `💬 Lead enviou mensagem: "${text.slice(0, 80)}"`);
  await handleFreeText(chatId, text, env);
  return { ok: true };
}
