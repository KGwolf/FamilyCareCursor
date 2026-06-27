'use strict';

function requireValue(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing environment variable: ${name}`);
  return value;
}

function loadConfig() {
  const mode = process.env.APP_MODE || 'dry-run';
  if (!['dry-run', 'live'].includes(mode)) {
    throw new Error('APP_MODE must be dry-run or live');
  }

  const config = {
    mode,
    allowLiveDelivery: process.env.ALLOW_LIVE_DELIVERY === 'true',
    minapp: {
      clientId: process.env.MINAPP_CLIENT_ID || '',
      clientSecret: process.env.MINAPP_CLIENT_SECRET || '',
      accessToken: process.env.MINAPP_ACCESS_TOKEN || '',
      environmentId: process.env.MINAPP_ENVIRONMENT_ID || '',
      tables: {
        reminders: requireValue('MINAPP_REMINDERS_TABLE_ID'),
        notificationBindings: requireValue('MINAPP_BINDINGS_TABLE_ID'),
        userSettings: requireValue('MINAPP_SETTINGS_TABLE_ID'),
        deliveryLogs: requireValue('MINAPP_DELIVERY_LOGS_TABLE_ID')
      }
    },
    wechat: {
      appId: process.env.WECHAT_APP_ID || '',
      appSecret: process.env.WECHAT_APP_SECRET || '',
      templateId: process.env.WECHAT_SUBSCRIBE_TEMPLATE_ID || '',
      templateDataJson: process.env.WECHAT_TEMPLATE_DATA_JSON || '',
      page: process.env.WECHAT_MESSAGE_PAGE || 'pages/home/home'
    },
    wecom: {
      corpId: process.env.WECOM_CORP_ID || '',
      corpSecret: process.env.WECOM_CORP_SECRET || '',
      agentId: process.env.WECOM_AGENT_ID || '',
      senderUserId: process.env.WECOM_SENDER_USERID || '',
      messageText: process.env.WECOM_MESSAGE_TEXT || '照护提醒：{{scheduled_at}}，请及时查看小程序。'
    },
    batchSize: Math.min(Math.max(Number(process.env.POLL_BATCH_SIZE) || 50, 1), 200),
    staleMinutes: Math.min(Math.max(Number(process.env.STALE_AFTER_MINUTES) || 10, 1), 1440)
  };

  if (!config.minapp.accessToken && (!config.minapp.clientId || !config.minapp.clientSecret)) {
    throw new Error('Configure MINAPP_ACCESS_TOKEN, or both MINAPP_CLIENT_ID and MINAPP_CLIENT_SECRET');
  }

  if (mode === 'live') {
    if (!config.allowLiveDelivery) throw new Error('live mode also requires ALLOW_LIVE_DELIVERY=true');
    ['appId', 'appSecret', 'templateId', 'templateDataJson'].forEach(key => {
      if (!config.wechat[key]) throw new Error(`live mode missing WeChat config: ${key}`);
    });
  }

  return config;
}

module.exports = { loadConfig };
