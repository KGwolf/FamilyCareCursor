'use strict';

const { loadConfig } = require('./config');
const { MinappClient } = require('./minapp-client');
const { pollReminders } = require('./poller');

const FUNCTION_NAME = 'family-care-reminder-poller';

function log(level, message, details = {}) {
  console.log(JSON.stringify({
    level,
    function: FUNCTION_NAME,
    message,
    timestamp: new Date().toISOString(),
    ...details
  }));
}

exports.main_handler = async (event = {}, context = {}) => {
  const startedAt = Date.now();
  const requestId = context.request_id || context.requestId || '';

  try {
    const config = loadConfig();
    const result = await pollReminders({
      client: new MinappClient(config.minapp),
      config
    });
    const response = {
      ok: true,
      mode: config.mode,
      requestId,
      ...result,
      durationMs: Date.now() - startedAt
    };
    log('info', '提醒轮询完成', response);
    return response;
  } catch (error) {
    log('error', '提醒轮询失败', {
      requestId,
      errorName: error.name,
      errorMessage: error.message,
      durationMs: Date.now() - startedAt
    });
    throw error;
  }
};
