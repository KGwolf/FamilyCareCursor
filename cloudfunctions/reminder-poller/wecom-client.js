'use strict';

let cachedToken = null;

async function getWecomAccessToken(config) {
  if (cachedToken && cachedToken.expiresAt > Date.now()) return cachedToken.value;
  const query = new URLSearchParams({
    corpid: config.corpId,
    corpsecret: config.corpSecret
  });
  const response = await fetch(`https://qyapi.weixin.qq.com/cgi-bin/gettoken?${query}`, {
    signal: AbortSignal.timeout(15000)
  });
  const result = await response.json();
  if (!response.ok || result.errcode || !result.access_token) {
    throw new Error(`WeCom access_token failed: ${result.errcode || response.status}`);
  }
  cachedToken = {
    value: result.access_token,
    expiresAt: Date.now() + Math.max((Number(result.expires_in) || 7200) - 300, 60) * 1000
  };
  return cachedToken.value;
}

function assertWecomConfig(config) {
  ['corpId', 'corpSecret'].forEach(key => {
    if (!config[key]) throw new Error(`Missing WeCom config: ${key}`);
  });
}

function renderContent(config, reminder) {
  const scheduledAt = new Date(reminder.next_trigger_at).toLocaleString('zh-CN', {
    timeZone: 'Asia/Shanghai',
    hour12: false
  });
  const template = config.messageText || '照护提醒：{{scheduled_at}}，请及时查看小程序。';
  return template
    .replace(/\{\{scheduled_at\}\}/g, scheduledAt)
    .replace(/\{\{reminder_id\}\}/g, String(reminder.local_id || ''));
}

async function sendExternalContactMessage(config, binding, reminder) {
  assertWecomConfig(config);
  if (!binding.external_userid) throw new Error('WeCom binding missing external_userid');

  const token = await getWecomAccessToken(config);
  const payload = {
    chat_type: 'single',
    external_userid: [binding.external_userid],
    text: { content: renderContent(config, reminder) }
  };
  if (config.senderUserId || binding.sender_userid) {
    payload.sender = config.senderUserId || binding.sender_userid;
  }

  const response = await fetch(
    `https://qyapi.weixin.qq.com/cgi-bin/externalcontact/add_msg_template?access_token=${encodeURIComponent(token)}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(15000)
    }
  );
  const result = await response.json();
  if (!response.ok || result.errcode) {
    const error = new Error(`WeCom external contact message failed: ${result.errcode || response.status}`);
    error.providerCode = String(result.errcode || response.status);
    throw error;
  }
  return { providerCode: '0', providerMessageId: result.msgid || '' };
}

module.exports = {
  sendExternalContactMessage,
  renderContent
};
