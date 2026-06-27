'use strict';

const http = require('http');
const {
  verifyWecomEcho,
  textResponse
} = require('./index');

function send(res, result) {
  res.writeHead(result.statusCode, result.headers);
  res.end(result.body);
}

const server = http.createServer((req, res) => {
  try {
    if (req.url === '/' || req.url === '/health') {
      send(res, textResponse('ok'));
      return;
    }

    const url = new URL(req.url, 'http://127.0.0.1');
    if (req.method !== 'GET') {
      send(res, textResponse('method not allowed', 405));
      return;
    }

    send(res, verifyWecomEcho(Object.fromEntries(url.searchParams)));
  } catch (error) {
    console.error('wecom callback failed', error.message);
    send(res, textResponse('internal error', 500));
  }
});

const port = Number(process.env.PORT || process.env.SCF_RUNTIME_PORT || 9000);
server.listen(port, '0.0.0.0', () => {
  console.log(`wecom callback server listening on ${port}`);
});
