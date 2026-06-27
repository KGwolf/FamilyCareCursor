'use strict';

const API_ROOT = 'https://cloud.minapp.com';
let cachedToken = null;

function cookieValues(headers) {
  const values = typeof headers.getSetCookie === 'function'
    ? headers.getSetCookie()
    : [headers.get('set-cookie')].filter(Boolean);
  return values.map(value => value.split(';')[0]);
}

async function requestAuthorizationCode(clientId, clientSecret) {
  let url = `${API_ROOT}/api/oauth2/hydrogen/openapi/authorize/`;
  let method = 'POST';
  let body = JSON.stringify({ client_id: clientId, client_secret: clientSecret });
  const cookies = [];

  for (let redirectCount = 0; redirectCount < 5; redirectCount += 1) {
    const response = await fetch(url, {
      method,
      redirect: 'manual',
      headers: {
        'Content-Type': 'application/json',
        ...(cookies.length ? { Cookie: cookies.join('; ') } : {})
      },
      body,
      signal: AbortSignal.timeout(15000)
    });

    cookieValues(response.headers).forEach(cookie => {
      const name = cookie.split('=')[0];
      const index = cookies.findIndex(item => item.startsWith(`${name}=`));
      if (index >= 0) cookies[index] = cookie;
      else cookies.push(cookie);
    });

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('location');
      if (!location) throw new Error('知晓云授权跳转缺少 Location');
      url = new URL(location, url).toString();
      method = 'GET';
      body = undefined;
      continue;
    }

    if (!response.ok) throw new Error(`知晓云授权失败：HTTP ${response.status}`);
    const result = await response.json();
    if (!result.code) throw new Error('知晓云授权响应缺少 code');
    return result.code;
  }

  throw new Error('知晓云授权跳转次数过多');
}

async function exchangeAccessToken(clientId, clientSecret, code) {
  const response = await fetch(`${API_ROOT}/api/oauth2/access_token/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: 'authorization_code',
      code
    }),
    signal: AbortSignal.timeout(15000)
  });
  if (!response.ok) throw new Error(`知晓云 token 获取失败：HTTP ${response.status}`);
  const result = await response.json();
  if (!result.access_token) throw new Error('知晓云 token 响应缺少 access_token');
  cachedToken = {
    value: result.access_token,
    expiresAt: Date.now() + Math.max((Number(result.expires_in) || 3600) - 60, 60) * 1000
  };
  return cachedToken.value;
}

async function getAccessToken(config) {
  if (config.accessToken) return config.accessToken;
  if (cachedToken && cachedToken.expiresAt > Date.now()) return cachedToken.value;
  const code = await requestAuthorizationCode(config.clientId, config.clientSecret);
  return exchangeAccessToken(config.clientId, config.clientSecret, code);
}

class MinappClient {
  constructor(config) {
    this.config = config;
  }

  async request(url, options = {}) {
    const token = await getAccessToken(this.config);
    const response = await fetch(url, {
      method: options.method || 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        ...(this.config.environmentId ? { 'X-Hydrogen-Env-ID': this.config.environmentId } : {})
      },
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      signal: AbortSignal.timeout(15000)
    });
    if (!response.ok) throw new Error(`知晓云数据请求失败：HTTP ${response.status}`);
    if (response.status === 204) return null;
    return response.json();
  }

  async findRecords(tableId, where, options = {}) {
    const query = new URLSearchParams({
      where: JSON.stringify(where || {}),
      limit: String(options.limit || 20),
      offset: String(options.offset || 0)
    });
    if (options.orderBy) query.set('order_by', options.orderBy);
    const url = `${API_ROOT}/oserve/v2.4/table/${tableId}/record/?${query}`;
    const result = await this.request(url);
    return result.objects || [];
  }

  createRecord(tableId, data) {
    return this.request(`${API_ROOT}/oserve/v2.4/table/${tableId}/record/`, {
      method: 'POST',
      body: data
    });
  }

  updateRecord(tableId, recordId, data) {
    return this.request(`${API_ROOT}/oserve/v2.6/table/${tableId}/record/${recordId}/`, {
      method: 'PUT',
      body: data
    });
  }
}

module.exports = { MinappClient };
