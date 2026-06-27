'use strict';

const assert = require('assert');
const { mapReminder, anonymousTargetRef, nextTriggerAt } = require('../utils/cloud-sync');

const localReminder = {
  id: 1710000000000,
  familyId: 1700000000000,
  targetName: '不应上传的姓名',
  type: { id: 2, name: '不应上传的提醒类型', icon: 'medication' },
  time: '08:30',
  frequency: 'daily',
  date: '2030-01-01',
  remark: '不应上传的自由文本',
  enabled: true
};

const cloudReminder = mapReminder(localReminder);
const serialized = JSON.stringify(cloudReminder);

assert(!serialized.includes(localReminder.targetName));
assert(!serialized.includes(localReminder.type.name));
assert(!serialized.includes(localReminder.remark));
assert.strictEqual(cloudReminder.type_code, 'general');
assert(cloudReminder.target_ref.startsWith('family_'));
assert.strictEqual(typeof cloudReminder.scheduled_at, 'string');
assert.strictEqual(typeof cloudReminder.next_trigger_at, 'string');
assert.strictEqual(anonymousTargetRef(localReminder.familyId), cloudReminder.target_ref);
assert(nextTriggerAt(localReminder) instanceof Date);

console.log('cloud-sync privacy tests passed');
