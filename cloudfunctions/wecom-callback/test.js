'use strict';

const assert = require('assert');
const {
  parseQuery,
  sha1Signature,
  pkcs7Unpad,
  textResponse
} = require('./index');

assert.deepStrictEqual(parseQuery({
  queryStringParameters: { nonce: 'n1' }
}), { nonce: 'n1' });

assert.deepStrictEqual(parseQuery({
  rawQueryString: 'nonce=n1&timestamp=123'
}), { nonce: 'n1', timestamp: '123' });

assert.strictEqual(
  sha1Signature('token', '123', 'nonce', 'encrypted'),
  sha1Signature('token', '123', 'nonce', 'encrypted')
);

assert.strictEqual(pkcs7Unpad(Buffer.from([1, 2, 3, 1])).toString('hex'), '010203');
assert.strictEqual(textResponse('ok').body, 'ok');

console.log('wecom-callback tests passed');
