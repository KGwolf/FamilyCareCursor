'use strict';

let cachedToken = null;

async function getWechatAccessToken(config) {
  if (cachedToken && cachedToken.expiresAt > Date.now()) return cachedToken.value;
  const query = new URLSearchParams({
    grant_type: 'client_credential',
    appid: config.appId,
    secret: config.appSecret
  });
  const response = await fetch(`https://api.weixin.qq.com/cgi-bin/token?${query}`, {
    signal: AbortSignal.timeout(15000)
  });
  const result = await response.json();
  if (!response.ok || !result.access_token) {
    throw new Error(`微信 access_token 获取失败：${result.errcode || response.status}`);
  }
  cachedToken = {
    value: result.access_token,
    expiresAt: Date.now() + Math.max((Number(result.expires_in) || 7200) - 300, 60) * 1000
  };
  return cachedToken.value;
}

function templateData(config, reminder) {
  const source = JSON.parse(config.templateDataJson);
  const scheduledAt = new Date(reminder.next_trigger_at).toLocaleString('zh-CN', {
    timeZone: 'Asia/Shanghai',
    hour12: false
  });
  return Object.keys(source).reduce((result, key) => {
    const value = typeof source[key] === 'string' ? source[key] : source[key].value;
    result[key] = { value: String(value).replace(/\{\{scheduled_at\}\}/g, scheduledAt) };
    return result;
  }, {});
}

async function sendSubscribeMessage(config, recipientId, reminder) {
  const token = await getWechatAccessToken(config);
  const response = await fetch(
    `https://api.weixin.qq.com/cgi-bin/message/subscribe/send?access_token=${encodeURIComponent(token)}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        touser: recipientId,
        template_id: config.templateId,
        page: `${config.page}?reminderId=${encodeURIComponent(reminder.local_id)}`,
        data: templateData(config, reminder)
      }),
      signal: AbortSignal.timeout(15000)
    }
  );
  const result = await response.json();
  if (!response.ok || result.errcode) {
    const error = new Error(`微信订阅消息发送失败：${result.errcode || response.status}`);
    error.providerCode = String(result.errcode || response.status);
    throw error;
  }
  return { providerCode: '0' };
}

module.exports = { sendSubscribeMessage, templateData };
