const { BAAS_CONFIG } = require('./baas-config');
const BaaSClient = require('./baas-client');
const CloudRepository = require('./cloud-repository');

const MIGRATION_STORAGE_KEY = 'baasMinimalSyncVersion';
const REMINDER_FINGERPRINTS_KEY = 'baasReminderFingerprints';
const SETTINGS_FINGERPRINT_KEY = 'baasSettingsFingerprint';
let syncTimer = null;

function storage(key, fallback) {
  const value = wx.getStorageSync(key);
  return value === '' || value === undefined || value === null ? fallback : value;
}

function localDateTime(date, time) {
  if (!date || !time) return null;
  const value = new Date(`${date}T${time}:00+08:00`);
  return isNaN(value.getTime()) ? null : value;
}

function isoDate(value) {
  return value instanceof Date && !isNaN(value.getTime()) ? value.toISOString() : undefined;
}

function nextTriggerAt(reminder) {
  const scheduled = localDateTime(reminder.date, reminder.time);
  if (reminder.frequency !== 'daily') return scheduled;

  const now = new Date();
  const shanghaiNow = new Date(now.getTime() + 8 * 60 * 60 * 1000);
  const date = [
    shanghaiNow.getUTCFullYear(),
    String(shanghaiNow.getUTCMonth() + 1).padStart(2, '0'),
    String(shanghaiNow.getUTCDate()).padStart(2, '0')
  ].join('-');
  let next = localDateTime(date, reminder.time || '08:30');
  if (next <= now) next = new Date(next.getTime() + 24 * 60 * 60 * 1000);
  return next;
}

function anonymousTargetRef(familyId) {
  const value = String(familyId || 'default');
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return `family_${(hash >>> 0).toString(16)}`;
}

function mapReminder(item) {
  const recurrenceType = item.frequency === 'custom'
    ? 'once'
    : (item.frequency === 'custom_weekly' ? 'weekly' : (item.frequency || 'once'));
  const scheduledAt = localDateTime(item.date, item.time);
  const enabled = item.enabled !== false && !(recurrenceType === 'once' && item.completed);
  return {
    target_ref: anonymousTargetRef(item.familyId),
    type_code: 'general',
    scheduled_at: isoDate(scheduledAt),
    recurrence_type: recurrenceType,
    recurrence_rule: recurrenceType === 'weekly' || recurrenceType === 'custom_weekly'
      ? JSON.stringify({ date: item.date || '', time: item.time || '' })
      : JSON.stringify({ time: item.time || '' }),
    next_trigger_at: isoDate(nextTriggerAt(item)),
    timezone: 'Asia/Shanghai',
    channel: 'wechat_subscribe',
    enabled,
    status: enabled ? 'active' : 'paused',
    version: 1
  };
}

function syncCollection(tableName, items, mapper) {
  return items.reduce((promise, item) => promise.then(() => {
    return CloudRepository.upsertByLocalId(tableName, item.id, mapper(item));
  }), Promise.resolve());
}

function fingerprint(value) {
  return JSON.stringify(value);
}

function syncReminders(tableName, reminders) {
  const fingerprints = storage(REMINDER_FINGERPRINTS_KEY, {});
  return reminders.reduce((promise, reminder) => promise.then(() => {
    const payload = mapReminder(reminder);
    if (!payload.next_trigger_at) {
      console.warn('跳过无有效触发时间的云端提醒', { reminderId: reminder.id });
      return null;
    }
    const nextFingerprint = fingerprint(payload);
    if (fingerprints[String(reminder.id)] === nextFingerprint) return null;
    return CloudRepository.upsertByLocalId(tableName, reminder.id, payload).then(result => {
      fingerprints[String(reminder.id)] = nextFingerprint;
      return result;
    });
  }), Promise.resolve()).then(() => {
    wx.setStorageSync(REMINDER_FINGERPRINTS_KEY, fingerprints);
  });
}

function syncSettings(tableName, settings) {
  const payload = {
    notification_enabled: settings.remindEnabled !== false,
    quiet_hours_enabled: Boolean(settings.quietHoursEnabled),
    quiet_hours_start: settings.quietHoursStart || '',
    quiet_hours_end: settings.quietHoursEnd || '',
    daily_push_limit: Number.isInteger(settings.dailyPushLimit) ? settings.dailyPushLimit : 8,
    subscription_renewal_prompt_limit: Number.isInteger(settings.subscriptionRenewalPromptLimit)
      ? settings.subscriptionRenewalPromptLimit
      : 2,
    preferred_channel: settings.notificationChannel || 'wechat_subscribe',
    timezone: 'Asia/Shanghai'
  };
  const nextFingerprint = fingerprint(payload);
  if (storage(SETTINGS_FINGERPRINT_KEY, '') === nextFingerprint) return Promise.resolve();
  return CloudRepository.upsertByLocalId(tableName, 'default', payload).then(() => {
    wx.setStorageSync(SETTINGS_FINGERPRINT_KEY, nextFingerprint);
  });
}

function syncLocalData(options = {}) {
  const completedVersion = storage(MIGRATION_STORAGE_KEY, 0);
  const isFirstMigration = completedVersion < BAAS_CONFIG.migrationVersion;
  if (!options.force && !isFirstMigration) {
    return Promise.resolve({ migrated: false, version: completedVersion });
  }

  const tables = BAAS_CONFIG.tables;
  const reminders = storage('reminders', []);
  const settings = storage('settings', { remindEnabled: true, warningEnabled: true });

  return syncReminders(tables.reminders, reminders)
    .then(() => syncSettings(tables.userSettings, settings))
    .then(() => {
      wx.setStorageSync(MIGRATION_STORAGE_KEY, BAAS_CONFIG.migrationVersion);
      return { migrated: isFirstMigration, version: BAAS_CONFIG.migrationVersion };
    });
}

function scheduleSync(delay = 400) {
  if (syncTimer) clearTimeout(syncTimer);
  syncTimer = setTimeout(() => {
    syncTimer = null;
    BaaSClient.initialize()
      .then(() => syncLocalData({ force: true }))
      .catch(error => console.error('知晓云后台同步失败', error));
  }, delay);
}

function deleteLocalRecord(tableKey, localId) {
  const tableName = BAAS_CONFIG.tables[tableKey];
  if (!tableName) return Promise.reject(new Error(`未知知晓云数据表：${tableKey}`));
  return BaaSClient.initialize()
    .then(() => CloudRepository.deleteByLocalId(tableName, localId));
}

function scheduleDelete(tableKey, localId) {
  deleteLocalRecord(tableKey, localId)
    .then(() => {
      if (tableKey !== 'reminders') return;
      const fingerprints = storage(REMINDER_FINGERPRINTS_KEY, {});
      delete fingerprints[String(localId)];
      wx.setStorageSync(REMINDER_FINGERPRINTS_KEY, fingerprints);
    })
    .catch(error => console.error('知晓云删除同步失败', { tableKey, localId, error }));
}

function initialize() {
  return BaaSClient.initialize().then(user => {
    if (!BAAS_CONFIG.autoSyncMinimalData) return { user, migrated: false };
    return syncLocalData().then(result => ({ user, ...result }));
  });
}

module.exports = {
  initialize,
  migrateLocalData: () => syncLocalData({ force: true }),
  syncLocalData,
  scheduleSync,
  scheduleDelete,
  nextTriggerAt,
  anonymousTargetRef,
  mapReminder,
  isoDate
};
