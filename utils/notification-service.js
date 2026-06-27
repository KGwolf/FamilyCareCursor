const { BAAS_CONFIG } = require('./baas-config');
const BaaSClient = require('./baas-client');
const CloudRepository = require('./cloud-repository');
const { DataManager } = require('./data-manager');

const RENEWAL_STATE_KEY = 'wechatSubscribeRenewalState';

function requestSubscribeMessage(templateId) {
  return new Promise((resolve, reject) => {
    wx.requestSubscribeMessage({
      tmplIds: [templateId],
      success: resolve,
      fail: reject
    });
  });
}

function persistBinding(templateId, result) {
  return BaaSClient.initialize().then(() => {
    const recipientId = BaaSClient.getCurrentOpenId();
    if (!recipientId) throw new Error('未取得当前用户 openid');

    const providerStatus = result[templateId];
    const accepted = providerStatus === 'accept';
    const consentStatus = accepted ? 'accepted' : 'rejected';
    return CloudRepository.upsertByLocalId(
      BAAS_CONFIG.tables.notificationBindings,
      `wechat_subscribe_${templateId}`,
      {
        channel: 'wechat_subscribe',
        recipient_id: recipientId,
        template_id: templateId,
        consent_status: consentStatus,
        enabled: accepted,
        bound_at: accepted ? new Date().toISOString() : undefined,
        revoked_at: undefined
      }
    ).then(() => ({ configured: true, accepted, consentStatus }));
  });
}

function requestReminderSubscription(options = {}) {
  const templateId = BAAS_CONFIG.subscribeTemplateId;
  if (!templateId) {
    return Promise.resolve({ configured: false, accepted: false, consentStatus: 'unconfigured' });
  }

  const today = todayString();
  if (options.countAsPrompt !== false) {
    incrementRenewalPromptCount(today);
  }

  setRenewalState({
    lastSubscriptionRequestAt: Date.now(),
    lastSubscriptionRequestDate: today
  });

  return requestSubscribeMessage(templateId)
    .then(result => persistBinding(templateId, result));
}

function todayString() {
  return DataManager.formatDate(new Date());
}

function normalizeTime(time) {
  if (typeof time !== 'string' || !/^\d{1,2}:\d{2}$/.test(time)) return '08:00';
  const [hour, minute] = time.split(':');
  return `${String(Number(hour)).padStart(2, '0')}:${minute}`;
}

function dateWithTime(dateStr, time) {
  const date = DataManager.parseLocalDate(dateStr);
  const [hour, minute] = normalizeTime(time).split(':').map(Number);
  date.setHours(hour, minute, 0, 0);
  return date;
}

function addDays(date, days) {
  const next = new Date(date.getTime());
  next.setDate(next.getDate() + days);
  return next;
}

function isRecurringReminder(reminder) {
  return reminder && (
    reminder.frequency === 'daily'
      || reminder.frequency === 'weekly'
      || reminder.frequency === 'custom_weekly'
  );
}

function recurrenceIntervalDays(reminder) {
  if (!reminder) return 0;
  if (reminder.frequency === 'daily') return 1;
  if (reminder.frequency === 'weekly' || reminder.frequency === 'custom_weekly') return 7;
  return 0;
}

function getTodayOccurrence(reminder, now = new Date()) {
  if (!isRecurringReminder(reminder)) return null;

  const today = DataManager.formatDate(now);
  if (reminder.frequency === 'weekly' || reminder.frequency === 'custom_weekly') {
    const anchor = DataManager.parseLocalDate(reminder.date || reminder.createTime || today);
    const current = DataManager.parseLocalDate(today);
    if (anchor.getDay() !== current.getDay()) return null;
  }

  return dateWithTime(today, reminder.time);
}

function getCurrentOrNextOccurrence(reminder, now = new Date()) {
  if (!isRecurringReminder(reminder)) return null;

  const intervalDays = recurrenceIntervalDays(reminder);
  if (!intervalDays) return null;

  const todayOccurrence = getTodayOccurrence(reminder, now);
  if (todayOccurrence && now.getTime() <= todayOccurrence.getTime()) {
    return todayOccurrence;
  }

  const start = todayOccurrence || dateWithTime(DataManager.formatDate(now), reminder.time);
  let next = addDays(start, intervalDays);
  while (next.getTime() <= now.getTime()) {
    next = addDays(next, intervalDays);
  }
  return next;
}

function renewalKeyFor(reminder, occurrenceDate) {
  if (!reminder || !occurrenceDate) return '';
  return `${reminder.id || reminder.local_id || reminder.localId}:${DataManager.formatDate(occurrenceDate)}:${normalizeTime(reminder.time)}`;
}

function getGrantedRenewalKeys(state) {
  return state.grantedRenewalKeys && typeof state.grantedRenewalKeys === 'object'
    ? state.grantedRenewalKeys
    : {};
}

function markRenewalKeyGranted(reminder, occurrenceDate) {
  const reminderId = reminder && (reminder.id || reminder.local_id || reminder.localId);
  const key = renewalKeyFor(reminder, occurrenceDate);
  if (!reminderId || !key) return getRenewalState();

  const state = getRenewalState();
  return setRenewalState({
    grantedRenewalKeys: {
      ...getGrantedRenewalKeys(state),
      [String(reminderId)]: key
    }
  });
}

function markReminderSubscriptionGranted(reminder) {
  const occurrence = getCurrentOrNextOccurrence(reminder);
  if (!occurrence) return getRenewalState();
  return markRenewalKeyGranted(reminder, occurrence);
}

function findReminderNeedingSubscriptionRenewal() {
  const reminders = DataManager.getReminders();
  const now = new Date();
  const state = getRenewalState();
  const grantedKeys = getGrantedRenewalKeys(state);

  for (const item of reminders) {
    if (!item || item.enabled === false || item.completed || !isRecurringReminder(item)) continue;

    const occurrence = getTodayOccurrence(item, now);
    if (!occurrence || now.getTime() < occurrence.getTime()) continue;

    const intervalDays = recurrenceIntervalDays(item);
    const nextOccurrence = addDays(occurrence, intervalDays);
    const reminderId = item.id || item.local_id || item.localId;
    const renewalKey = renewalKeyFor(item, nextOccurrence);
    if (reminderId && grantedKeys[String(reminderId)] === renewalKey) continue;

    return {
      reminder: item,
      occurrence,
      nextOccurrence,
      renewalKey
    };
  }

  return null;
}

function getRenewalState() {
  try {
    const value = wx.getStorageSync(RENEWAL_STATE_KEY);
    return value && typeof value === 'object' ? value : {};
  } catch (error) {
    return {};
  }
}

function setRenewalState(patch) {
  const next = {
    ...getRenewalState(),
    ...patch
  };
  wx.setStorageSync(RENEWAL_STATE_KEY, next);
  return next;
}

function renewalPromptLimit(settings) {
  const value = Number(settings.subscriptionRenewalPromptLimit);
  if (!Number.isFinite(value)) return 2;
  return Math.max(Math.floor(value), 0);
}

function renewalPromptCount(state, date) {
  const counts = state.promptCounts || {};
  return Number(counts[date]) || 0;
}

function incrementRenewalPromptCount(date) {
  const state = getRenewalState();
  const counts = state.promptCounts || {};
  const nextCount = (Number(counts[date]) || 0) + 1;
  return setRenewalState({
    lastPromptDate: date,
    lastPromptAt: Date.now(),
    promptCounts: {
      ...counts,
      [date]: nextCount
    }
  });
}

function shouldPromptSubscriptionRenewal() {
  const templateId = BAAS_CONFIG.subscribeTemplateId;
  if (!templateId) return { shouldPrompt: false, reason: 'unconfigured' };

  const settings = DataManager.getSettings();
  if (settings.remindEnabled === false) return { shouldPrompt: false, reason: 'disabled' };
  if (settings.notificationChannel && settings.notificationChannel !== 'wechat_subscribe') {
    return { shouldPrompt: false, reason: 'non_wechat_channel' };
  }

  const renewalTarget = findReminderNeedingSubscriptionRenewal();
  if (!renewalTarget) {
    return { shouldPrompt: false, reason: 'no_due_recurring_reminder' };
  }

  const today = todayString();
  const state = getRenewalState();
  const limit = renewalPromptLimit(settings);
  if (limit <= 0) return { shouldPrompt: false, reason: 'prompt_disabled' };
  if (renewalPromptCount(state, today) >= limit) {
    return { shouldPrompt: false, reason: 'prompt_limit_reached' };
  }

  return { shouldPrompt: true, reason: 'needs_renewal', renewalTarget };
}

function showRenewalExplainModal() {
  return new Promise(resolve => {
    wx.showModal({
      title: '继续接收下一次提醒？',
      content: '这条循环提醒本次时间已经过了。微信需要你再授权一次，我们才能在下一次到点时继续通知你。',
      confirmText: '继续接收',
      cancelText: '暂不授权',
      success: result => resolve(Boolean(result.confirm)),
      fail: () => resolve(false)
    });
  });
}

function maybePromptSubscriptionRenewal() {
  const decision = shouldPromptSubscriptionRenewal();
  if (!decision.shouldPrompt) return Promise.resolve({ prompted: false, reason: decision.reason });

  const today = todayString();
  incrementRenewalPromptCount(today);

  return showRenewalExplainModal().then(confirmed => {
    if (!confirmed) {
      setRenewalState({ lastDeclinedDate: today });
      return { prompted: true, accepted: false, consentStatus: 'declined' };
    }

    return requestReminderSubscription({ countAsPrompt: false }).then(result => {
      if (result.accepted) {
        markRenewalKeyGranted(decision.renewalTarget.reminder, decision.renewalTarget.nextOccurrence);
        setRenewalState({ lastAcceptedDate: today });
      } else {
        setRenewalState({ lastDeclinedDate: today });
      }
      return { prompted: true, ...result };
    }).catch(error => {
      setRenewalState({ lastErrorDate: today });
      throw error;
    });
  });
}

function getSubscriptionRenewalStats() {
  const today = todayString();
  const settings = DataManager.getSettings();
  const state = getRenewalState();
  return {
    date: today,
    promptCount: renewalPromptCount(state, today),
    promptLimit: renewalPromptLimit(settings),
    lastPromptAt: state.lastPromptAt || 0,
    lastSubscriptionRequestAt: state.lastSubscriptionRequestAt || 0
  };
}

function upsertRevokedBinding(channel, localId, extra = {}) {
  return CloudRepository.upsertByLocalId(
    BAAS_CONFIG.tables.notificationBindings,
    localId,
    {
      channel,
      ...extra,
      consent_status: 'revoked',
      enabled: false,
      revoked_at: new Date().toISOString()
    }
  );
}

function revokeCloudNotificationBindings() {
  const settings = DataManager.getSettings();
  DataManager.setSettings({
    ...settings,
    remindEnabled: false,
    notificationChannel: settings.notificationChannel || 'wechat_subscribe'
  });

  return BaaSClient.initialize().then(() => {
    const recipientId = BaaSClient.getCurrentOpenId();
    const templateId = BAAS_CONFIG.subscribeTemplateId;
    const tasks = [];

    if (templateId) {
      tasks.push(upsertRevokedBinding(
        'wechat_subscribe',
        `wechat_subscribe_${templateId}`,
        {
          recipient_id: recipientId || '',
          template_id: templateId
        }
      ));
    }

    tasks.push(upsertRevokedBinding(
      'wecom_external',
      'wecom_external_default',
      {
        external_userid: ''
      }
    ));

    return Promise.all(tasks).then(() => ({ revoked: true }));
  });
}

module.exports = {
  requestReminderSubscription,
  markReminderSubscriptionGranted,
  maybePromptSubscriptionRenewal,
  shouldPromptSubscriptionRenewal,
  getSubscriptionRenewalStats,
  revokeCloudNotificationBindings
};
