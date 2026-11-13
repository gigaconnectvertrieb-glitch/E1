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

function extractCode(text) {
  const matches = [];
  const re = /(\d{6})/g;
  let match;
  while ((match = re.exec(text)) !== null) {
    matches.push({ code: match[1], index: match.index });
  }
  if (!matches.length) return null;
  const keyword = text.toLowerCase().search(/code|best(ä|ae)tigung|verifizierung/);
  if (keyword >= 0) {
    matches.sort(function (a, b) {
      return Math.abs(a.index - keyword) - Math.abs(b.index - keyword);
    });
  }
  return matches[0].code;
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
      const code = extractCode(message.text);
      if (code) {
        console.log('telegram mfa text:', message.text.replace(/\s+/g, ' ').slice(0, 180));
        console.log('telegram mfa code:', code);
        return code;
      }
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
