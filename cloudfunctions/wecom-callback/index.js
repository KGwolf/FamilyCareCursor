'use strict';

const crypto = require('crypto');

function requireEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing environment variable: ${name}`);
  return value;
}

function parseQuery(event = {}) {
  if (event.queryStringParameters && typeof event.queryStringParameters === 'object') {
    return event.queryStringParameters;
  }
  if (event.queryString && typeof event.queryString === 'object') {
    return event.queryString;
  }
  const raw = event.rawQueryString || event.queryString || '';
  return Object.fromEntries(new URLSearchParams(raw));
}

function sha1Signature(token, timestamp, nonce, encrypted) {
  return crypto
    .createHash('sha1')
    .update([token, timestamp, nonce, encrypted].sort().join(''))
    .digest('hex');
}

function pkcs7Unpad(buffer) {
  const pad = buffer[buffer.length - 1];
  if (pad < 1 || pad > 32) return buffer;
  return buffer.subarray(0, buffer.length - pad);
}

function decryptEcho(encodingAesKey, encryptedEcho) {
  if (!/^[A-Za-z0-9_-]{43}$/.test(encodingAesKey)) {
    throw new Error('WECOM_ENCODING_AES_KEY must be a 43-character EncodingAESKey');
  }

  const aesKey = Buffer.from(`${encodingAesKey}=`, 'base64');
  const iv = aesKey.subarray(0, 16);
  const decipher = crypto.createDecipheriv('aes-256-cbc', aesKey, iv);
  decipher.setAutoPadding(false);

  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(encryptedEcho, 'base64')),
    decipher.final()
  ]);
  const plain = pkcs7Unpad(decrypted);
  const messageLength = plain.readUInt32BE(16);
  return plain.subarray(20, 20 + messageLength).toString('utf8');
}

function textResponse(body, statusCode = 200) {
  return {
    isBase64Encoded: false,
    statusCode,
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    body
  };
}

function verifyWecomEcho(query) {
  const token = requireEnv('WECOM_CALLBACK_TOKEN');
  const encodingAesKey = requireEnv('WECOM_ENCODING_AES_KEY');
  const signature = query.msg_signature || query.signature;
  const timestamp = query.timestamp;
  const nonce = query.nonce;
  const echo = query.echostr;

  if (!signature || !timestamp || !nonce || !echo) {
    return textResponse('missing required query', 400);
  }

  const expected = sha1Signature(token, timestamp, nonce, echo);
  if (expected !== signature) {
    return textResponse('invalid signature', 403);
  }

  return textResponse(decryptEcho(encodingAesKey, echo));
}

exports.main_handler = async (event = {}) => {
  return verifyWecomEcho(parseQuery(event));
};

module.exports = {
  parseQuery,
  sha1Signature,
  decryptEcho,
  pkcs7Unpad,
  verifyWecomEcho,
  textResponse
};
