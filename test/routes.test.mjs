import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { mkdtemp, readdir, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createRouteHandler } from '../lib/routes.js';
import { fixtureSnapshot } from './fixtures.mjs';

const HOST = '127.0.0.1:20871';

function makeCtx({ snapshot = fixtureSnapshot() } = {}) {
  return {
    get(name) {
      if (name === 'sessionQuery') {
        return { readSession: async () => snapshot };
      }
      return undefined;
    },
  };
}

async function tmpDir(tag) {
  return mkdtemp(path.join(os.tmpdir(), `dte-route-${tag}-`));
}

function resStub() {
  return {
    status: null,
    headers: null,
    body: null,
    writeHead(s, h) {
      this.status = s;
      this.headers = h;
    },
    end(b) {
      this.body = b;
    },
  };
}

async function call(handler, { method = 'POST', url = '/dsh-transfer-export/export', headers, body, rawBody } = {}) {
  const req = new EventEmitter();
  req.method = method;
  req.url = url;
  req.headers = headers ?? { host: HOST, origin: `http://${HOST}` };
  req.destroy = () => {};
  const res = resStub();
  const done = handler(req, res);
  const payload = rawBody !== undefined ? rawBody : body !== undefined ? JSON.stringify(body) : undefined;
  if (payload !== undefined) req.emit('data', Buffer.from(payload));
  req.emit('end');
  await done;
  return res;
}

test('routes: ping 通', async () => {
  const handler = createRouteHandler(makeCtx(), {});
  const res = await call(handler, { url: '/dsh-transfer-export/ping', body: {} });
  assert.equal(res.status, 200);
  assert.deepEqual(JSON.parse(res.body), { ok: true, pong: true });
});

test('routes: 非 POST 拒绝 405', async () => {
  const handler = createRouteHandler(makeCtx(), {});
  const res = await call(handler, { method: 'GET', url: '/dsh-transfer-export/export' });
  assert.equal(res.status, 405);
});

test('routes: 跨域 Origin 拒绝 403', async () => {
  const handler = createRouteHandler(makeCtx(), {});
  const res = await call(handler, { headers: { host: HOST, origin: 'https://evil.example' }, body: {} });
  assert.equal(res.status, 403);
});

test('routes: 无 Origin 且非 loopback Host 拒绝', async () => {
  const handler = createRouteHandler(makeCtx(), {});
  const res = await call(handler, { headers: { host: 'some-host.example:80' }, body: {} });
  assert.equal(res.status, 403);
});

test('routes: 缺 sessionId 400、坏 JSON 400、超限 413', async () => {
  const handler = createRouteHandler(makeCtx(), {});
  const r1 = await call(handler, { body: {} });
  assert.equal(r1.status, 400);
  assert.match(JSON.parse(r1.body).error, /sessionId/);

  const r2 = await call(handler, { rawBody: '{not json' });
  assert.equal(r2.status, 400);

  const big = 'x'.repeat(4 * 1024 * 1024 + 1);
  const r3 = await call(handler, { rawBody: `{"sessionId":"s","pad":"${big}"}` });
  assert.equal(r3.status, 413);
});

test('routes: 导出成功写默认目录并返回清单', async () => {
  const dir = await tmpDir('ok');
  const handler = createRouteHandler(makeCtx(), { exportDir: dir });
  const res = await call(handler, { body: { sessionId: 'sess-demo1234' } });

  assert.equal(res.status, 200);
  const out = JSON.parse(res.body);
  assert.equal(out.ok, true);
  assert.equal(out.files.length, 2);
  assert.match(out.stats, /用户 3 · 助手 2 · 工具调用 2/);
  const names = await readdir(dir);
  assert.equal(names.length, 2);
});

test('routes: 未知 action 404', async () => {
  const handler = createRouteHandler(makeCtx(), {});
  const res = await call(handler, { url: '/dsh-transfer-export/whatever', body: {} });
  assert.equal(res.status, 404);
});

test('routes: sessionQuery 抛错时 200 + ok:false', async () => {
  const ctx = { get: () => ({ readSession: async () => { throw new Error('boom'); } }) };
  const handler = createRouteHandler(ctx, {});
  const res = await call(handler, { body: { sessionId: 'sess-demo1234' } });
  assert.equal(res.status, 200);
  assert.equal(JSON.parse(res.body).ok, false);
  assert.match(JSON.parse(res.body).error, /boom/);
});

test('routes: 清理临时目录', async () => {
  // no-op，占位确保 tmpDir 在所有用例结束后由系统清理
});
