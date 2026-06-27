'use strict';

const { sendSubscribeMessage } = require('./wechat-client');
const { sendExternalContactMessage } = require('./wecom-client');

const DAY_MS = 24 * 60 * 60 * 1000;

function parseDate(value) {
  if (typeof value === 'number') return new Date(value < 1e12 ? value * 1000 : value);
  return new Date(value);
}

function nextOccurrence(reminder, triggerDate) {
  const type = reminder.recurrence_type;
  if (type === 'daily') return new Date(triggerDate.getTime() + DAY_MS);
  if (type === 'weekly' || type === 'custom_weekly') {
    return new Date(triggerDate.getTime() + 7 * DAY_MS);
  }
  return null;
}

function occurrenceKey(reminder, mode, channel = reminder.channel) {
  const trigger = parseDate(reminder.next_trigger_at).toISOString();
  return `${mode}:${reminder.owner_id}:${reminder.local_id}:${trigger}:${channel}`;
}

function shanghaiMinuteOfDay(date) {
  const shifted = new Date(date.getTime() + 8 * 60 * 60 * 1000);
  return shifted.getUTCHours() * 60 + shifted.getUTCMinutes();
}

function isQuietTime(settings, now) {
  if (!settings || !settings.quiet_hours_enabled) return false;
  const toMinutes = value => {
    const [hours, minutes] = String(value || '').split(':').map(Number);
    return Number.isFinite(hours) && Number.isFinite(minutes) ? hours * 60 + minutes : null;
  };
  const start = toMinutes(settings.quiet_hours_start);
  const end = toMinutes(settings.quiet_hours_end);
  if (start === null || end === null || start === end) return false;
  const current = shanghaiMinuteOfDay(now);
  return start < end ? current >= start && current < end : current >= start || current < end;
}

async function first(client, tableId, where) {
  const rows = await client.findRecords(tableId, where, { limit: 1 });
  return rows[0] || null;
}

async function advanceReminder(client, tableId, reminder, triggerDate) {
  const next = nextOccurrence(reminder, triggerDate);
  if (next) {
    return client.updateRecord(tableId, reminder.id, {
      next_trigger_at: next.toISOString(),
      version: (Number(reminder.version) || 1) + 1
    });
  }
  return client.updateRecord(tableId, reminder.id, {
    enabled: false,
    status: 'paused',
    version: (Number(reminder.version) || 1) + 1
  });
}

async function recordSuppressed(client, tableId, reminder, key, triggerDate, now, category) {
  return client.createRecord(tableId, {
    owner_id: reminder.owner_id,
    local_id: key,
    reminder_local_id: reminder.local_id,
    channel: reminder.resolved_channel || reminder.channel,
    scheduled_at: triggerDate.toISOString(),
    status: 'suppressed',
    attempt_count: 0,
    failure_category: category,
    expire_at: new Date(now.getTime() + 30 * DAY_MS).toISOString()
  });
}

function resolveChannel(reminder, settings) {
  const preferred = settings && settings.preferred_channel;
  if (preferred === 'wecom_external' || preferred === 'wechat_subscribe') return preferred;
  return reminder.channel || 'wechat_subscribe';
}

async function findBinding(client, tableId, reminder, channel) {
  return first(client, tableId, {
    owner_id: reminder.owner_id,
    channel,
    enabled: true,
    consent_status: 'accepted'
  });
}

async function sendByChannel(config, channel, binding, reminder) {
  if (channel === 'wecom_external') {
    return sendExternalContactMessage(config.wecom, binding, reminder);
  }
  return sendSubscribeMessage(config.wechat, binding.recipient_id, reminder);
}

async function processReminder({ client, config, reminder, now }) {
  const tables = config.minapp.tables;
  const triggerDate = parseDate(reminder.next_trigger_at);
  if (Number.isNaN(triggerDate.getTime())) return { status: 'invalid_date' };

  let key = occurrenceKey(reminder, config.mode);
  const existing = await first(client, tables.deliveryLogs, {
    owner_id: reminder.owner_id,
    local_id: key
  });
  if (existing) return { status: 'duplicate' };

  if (config.mode === 'dry-run') {
    await recordSuppressed(client, tables.deliveryLogs, reminder, key, triggerDate, now, 'dry_run');
    return { status: 'dry_run' };
  }

  const settings = await first(client, tables.userSettings, {
    owner_id: reminder.owner_id,
    local_id: 'default'
  });
  if (!settings || !settings.notification_enabled) {
    await recordSuppressed(client, tables.deliveryLogs, reminder, key, triggerDate, now, 'notifications_disabled');
    await advanceReminder(client, tables.reminders, reminder, triggerDate);
    return { status: 'notifications_disabled' };
  }

  if (isQuietTime(settings, now)) {
    await recordSuppressed(client, tables.deliveryLogs, reminder, key, triggerDate, now, 'quiet_hours');
    await advanceReminder(client, tables.reminders, reminder, triggerDate);
    return { status: 'quiet_hours' };
  }

  const channel = resolveChannel(reminder, settings);
  reminder.resolved_channel = channel;
  key = occurrenceKey(reminder, config.mode, channel);
  const channelExisting = await first(client, tables.deliveryLogs, {
    owner_id: reminder.owner_id,
    local_id: key
  });
  if (channelExisting) return { status: 'duplicate' };

  const binding = await findBinding(client, tables.notificationBindings, reminder, channel);
  if (!binding) {
    await recordSuppressed(client, tables.deliveryLogs, reminder, key, triggerDate, now, 'no_binding');
    await advanceReminder(client, tables.reminders, reminder, triggerDate);
    return { status: 'no_binding' };
  }

  const staleMs = config.staleMinutes * 60 * 1000;
  if (now.getTime() - triggerDate.getTime() > staleMs) {
    await recordSuppressed(client, tables.deliveryLogs, reminder, key, triggerDate, now, 'stale');
    await advanceReminder(client, tables.reminders, reminder, triggerDate);
    return { status: 'stale' };
  }

  const dayStart = new Date(now.getTime() + 8 * 60 * 60 * 1000);
  dayStart.setUTCHours(0, 0, 0, 0);
  dayStart.setTime(dayStart.getTime() - 8 * 60 * 60 * 1000);
  const dailyLimit = Math.min(Math.max(Number(settings.daily_push_limit) || 8, 1), 100);
  const sentToday = await client.findRecords(tables.deliveryLogs, {
    owner_id: reminder.owner_id,
    status: 'sent',
    sent_at: { '$gte': dayStart.toISOString() }
  }, { limit: dailyLimit });
  if (sentToday.length >= dailyLimit) {
    await recordSuppressed(client, tables.deliveryLogs, reminder, key, triggerDate, now, 'daily_limit');
    await advanceReminder(client, tables.reminders, reminder, triggerDate);
    return { status: 'daily_limit' };
  }

  const claimed = await client.createRecord(tables.deliveryLogs, {
    owner_id: reminder.owner_id,
    local_id: key,
    reminder_local_id: reminder.local_id,
    channel,
    scheduled_at: triggerDate.toISOString(),
    status: 'claimed',
    attempt_count: 1,
    expire_at: new Date(now.getTime() + 30 * DAY_MS).toISOString()
  });

  try {
    const sent = await sendByChannel(config, channel, binding, reminder);
    await client.updateRecord(tables.deliveryLogs, claimed.id, {
      status: 'sent',
      provider_code: sent.providerCode,
      sent_at: now.toISOString()
    });
    await advanceReminder(client, tables.reminders, reminder, triggerDate);
    return { status: 'sent' };
  } catch (error) {
    await client.updateRecord(tables.deliveryLogs, claimed.id, {
      status: 'failed',
      provider_code: error.providerCode || '',
      failure_category: 'provider_error'
    });
    return { status: 'failed' };
  }
}

async function pollReminders({ client, config, now = new Date() }) {
  const reminders = await client.findRecords(
    config.minapp.tables.reminders,
    {
      enabled: true,
      status: 'active',
      next_trigger_at: { '$lte': now.toISOString() }
    },
    { limit: config.batchSize, orderBy: 'next_trigger_at' }
  );

  const counts = {};
  for (const reminder of reminders) {
    const result = await processReminder({ client, config, reminder, now });
    counts[result.status] = (counts[result.status] || 0) + 1;
  }
  return { scanned: reminders.length, counts };
}

module.exports = {
  pollReminders,
  processReminder,
  nextOccurrence,
  occurrenceKey,
  resolveChannel,
  isQuietTime,
  parseDate
};
