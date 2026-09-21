const test = require('node:test');
const assert = require('node:assert');
const http = require('http');
const { handler } = require('../src/server');

test('/health는 200 ok를 반환한다', async () => {
  const server = http.createServer(handler).listen(0);
  const { port } = server.address();
  const res = await fetch(`http://localhost:${port}/health`);
  assert.strictEqual(res.status, 200);
  assert.strictEqual(await res.text(), 'ok');
  server.close();
});
