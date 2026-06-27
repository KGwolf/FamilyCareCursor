'use strict';

const assert = require('assert');
const { loadConfig } = require('./config');
const {
  pollReminders,
  nextOccurrence,
  occurrenceKey,
  isQuietTime,
  resolveChannel
} = require('./poller');
const { templateData } = require('./wechat-client');
const { renderContent } = require('./wecom-client');

function testConfig() {
  process.env.MINAPP_ACCESS_TOKEN = 'test-token';
  process.env.MINAPP_REMINDERS_TABLE_ID = '1';
  process.env.MINAPP_BINDINGS_TABLE_ID = '2';
  process.env.MINAPP_SETTINGS_TABLE_ID = '3';
  process.env.MINAPP_DELIVERY_LOGS_TABLE_ID = '4';
  delete process.env.APP_MODE;
  const config = loadConfig();
  assert.strictEqual(config.mode, 'dry-run');
  return config;
}

function testTimeRules() {
  const trigger = new Date('2030-01-01T00:00:00.000Z');
  assert.strictEqual(
    nextOccurrence({ recurrence_type: 'daily' }, trigger).toISOString(),
    '2030-01-02T00:00:00.000Z'
  );
  assert.strictEqual(nextOccurrence({ recurrence_type: 'once' }, trigger), null);
  assert.strictEqual(
    isQuietTime({
      quiet_hours_enabled: true,
      quiet_hours_start: '22:00',
      quiet_hours_end: '07:00'
    }, new Date('2030-01-01T15:00:00.000Z')),
    true
  );
}

function testChannelRules() {
  assert.strictEqual(resolveChannel({ channel: 'wechat_subscribe' }, {
    preferred_channel: 'wecom_external'
  }), 'wecom_external');
  assert.strictEqual(resolveChannel({ channel: 'wechat_subscribe' }, {}), 'wechat_subscribe');
}

function testWechatTemplateData() {
  const data = templateData({
    templateDataJson: '{"time1":"{{scheduled_at}}","thing3":"请及时查看照护提醒","thing2":"照护事项"}'
  }, { next_trigger_at: '2030-01-01T00:00:00.000Z' });
  assert.strictEqual(data.thing2.value, '照护事项');
  assert.strictEqual(data.thing3.value, '请及时查看照护提醒');
  assert(data.time1.value.includes('2030'));
}

function testWecomMessageData() {
  assert(renderContent({
    messageText: '照护提醒：{{scheduled_at}}'
  }, {
    local_id: 'r1',
    next_trigger_at: '2030-01-01T00:00:00.000Z'
  }).includes('2030'));
}

async function testDryRun(config) {
  const reminder = {
    id: 'cloud-record-id',
    owner_id: 7,
    local_id: 'local-reminder-id',
    channel: 'wechat_subscribe',
    enabled: true,
    status: 'active',
    recurrence_type: 'once',
    next_trigger_at: '2030-01-01T00:00:00.000Z'
  };
  const created = [];
  const client = {
    findRecords: async tableId => tableId === config.minapp.tables.reminders ? [reminder] : [],
    createRecord: async (tableId, data) => {
      created.push({ tableId, data });
      return { id: 'created-id', ...data };
    },
    updateRecord: async () => { throw new Error('dry-run should not update reminders'); }
  };
  const result = await pollReminders({
    client,
    config,
    now: new Date('2030-01-01T00:01:00.000Z')
  });
  assert.strictEqual(result.scanned, 1);
  assert.strictEqual(result.counts.dry_run, 1);
  assert.strictEqual(created.length, 1);
  assert.strictEqual(created[0].data.failure_category, 'dry_run');
  assert(occurrenceKey(reminder, 'dry-run').startsWith('dry-run:'));
}

async function run() {
  const config = testConfig();
  testTimeRules();
  testChannelRules();
  testWechatTemplateData();
  testWecomMessageData();
  await testDryRun(config);
  console.log('reminder-poller tests passed');
}

run().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
