const TOKEN = process.env.TG_BOT_TOKEN || '';
const CHAT_ID = process.env.TG_CHAT_ID || '';

let offset = 0;
let webhookCleared = false;
let inFlight = null;

export function telegramEnabled() {
  return Boolean(TOKEN && CHAT_ID);
}

async function api(method, payload, timeoutMs = 20000) {
  const res = await fetch('https://api.telegram.org/bot' + TOKEN + '/' + method, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(timeoutMs)
  });
  const data = await res.json().catch(() => ({}));
  if (!data.ok) {
    throw new Error('telegram_' + method + ': ' + (data.description || res.status));
  }
  return data.result;
}

export async function sendMessage(text) {
  if (!telegramEnabled()) return false;
  await api('sendMessage', {
    chat_id: CHAT_ID,
    text,
    disable_web_page_preview: true
  });
  return true;
}

async function clearWebhook() {
  if (webhookCleared) return;
  try {
    await api('deleteWebhook', { drop_pending_updates: false });
  } catch {}
  webhookCleared = true;
}

async function drainUpdates() {
  const updates = await api('getUpdates', { offset, timeout: 0, allowed_updates: ['message'] });
  for (const update of updates) offset = update.update_id + 1;
}

async function doRequestCode(prompt, timeoutMs) {
  if (!telegramEnabled()) throw new Error('telegram_disabled');
  await clearWebhook();
  await drainUpdates();

  const startedAt = Math.floor(Date.now() / 1000);
  await sendMessage(prompt);

  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const updates = await api(
      'getUpdates',
      { offset, timeout: 25, allowed_updates: ['message'] },
      35000
    );
    for (const update of updates) {
      offset = update.update_id + 1;
      const message = update.message;
      if (!message || !message.text) continue;
      if (String(message.chat.id) !== String(CHAT_ID)) continue;
      if (message.date && message.date < startedAt - 10) continue;
      const match = message.text.match(/\b(\d{6})\b/);
      if (match) return match[1];
    }
  }
  return null;
}

export function requestCode(prompt, timeoutMs = 10 * 60 * 1000) {
  if (inFlight) return inFlight;
  inFlight = doRequestCode(prompt, timeoutMs).finally(() => {
    inFlight = null;
  });
  return inFlight;
}
