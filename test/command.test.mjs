import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readdir, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { apply, resolveConfig } from '../lib/index.js';
import { fixtureSnapshot } from './fixtures.mjs';

function fakeCtx({ snapshot = fixtureSnapshot(), seenIds = [] } = {}) {
  const services = {
    sessionQuery: {
      readSession: async (id) => {
        seenIds.push(String(id));
        return snapshot;
      },
    },
    commands: { register: (def) => registered.commands.push(def) },
    webServer: { register: (def) => registered.routes.push(def) },
  };
  const registered = { commands: [], routes: [] };
  const base = {
    get(name) {
      return services[name];
    },
    inject(names, cb) {
      const sub = {};
      for (const n of names) sub[n] = services[n];
      sub.effect = (fn) => fn();
      cb(sub);
    },
  };
  return { ctx: base, registered, seenIds };
}

async function tmpDir(tag) {
  return mkdtemp(path.join(os.tmpdir(), `dte-cmd-${tag}-`));
}

test('apply: 注册 /transfer-export 命令与 RPC 路由', () => {
  const { ctx, registered } = fakeCtx();
  apply(ctx, {});
  assert.equal(registered.commands.length, 1);
  assert.equal(registered.commands[0].name, 'transfer-export');
  assert.equal(registered.routes.length, 1);
  assert.equal(registered.routes[0].path, '/dsh-transfer-export');
  assert.equal(registered.routes[0].kind, 'prefix');
});

test('命令: 默认双层导出并返回文件清单', async () => {
  const dir = await tmpDir('default');
  const { ctx, registered } = fakeCtx();
  apply(ctx, {});
  const handler = registered.commands[0].handler;
  const result = await handler({ rawInput: `--out ${dir}`, agent: { session: { id: 'sess-demo1234' } } });

  assert.equal(result.kind, 'success');
  assert.match(result.text, /已导出 2 个文件/);
  assert.match(result.text, /用户 3 · 助手 2 · 工具调用 2/);
  const names = await readdir(dir);
  assert.equal(names.length, 2);
  assert.ok(names.some((n) => n.endsWith('.json')));
  assert.ok(names.some((n) => n.endsWith('.md')));
  const json = JSON.parse(await readFile(path.join(dir, names.find((n) => n.endsWith('.json'))), 'utf8'));
  assert.equal(json.meta.sessionId, 'sess-demo1234');
});

test('命令: --html 出三个文件、--only md 只出一个', async () => {
  const dir3 = await tmpDir('html');
  const { ctx, registered } = fakeCtx();
  apply(ctx, {});
  const handler = registered.commands[0].handler;

  const r3 = await handler({ rawInput: `--html --out ${dir3}`, agent: { session: { id: 'sess-demo1234' } } });
  assert.match(r3.text, /已导出 3 个文件/);
  const names = await readdir(dir3);
  assert.ok(names.some((n) => n.endsWith('.html')));

  const dir1 = await tmpDir('only');
  const r1 = await handler({ rawInput: `--only md --out ${dir1}`, agent: { session: { id: 'sess-demo1234' } } });
  assert.match(r1.text, /已导出 1 个文件/);
  assert.equal((await readdir(dir1)).length, 1);
});

test('命令: --id 覆盖当前会话、--last-turns 生效', async () => {
  const dir = await tmpDir('id');
  const { ctx, registered, seenIds } = fakeCtx();
  apply(ctx, {});
  const handler = registered.commands[0].handler;

  await handler({ rawInput: `--id sess-other123 --out ${dir} --last-turns 1`, agent: { session: { id: 'sess-demo1234' } } });
  assert.deepEqual(seenIds, ['sess-other123']);
});

test('命令: --mask 时 JSON 层也脱敏', async () => {
  const dir = await tmpDir('mask');
  const snapshot = fixtureSnapshot();
  snapshot.events = [
    ...snapshot.events,
    { type: 'user/message', data: { id: 'u-key', source: { kind: 'user' }, rpcId: 'r9', content: [{ type: 'text', text: '我的 key sk-abcdefghijklmnop1234 记一下' }] } },
  ];
  const { ctx, registered } = fakeCtx({ snapshot });
  apply(ctx, {});
  const handler = registered.commands[0].handler;
  const result = await handler({ rawInput: `--mask --out ${dir}`, agent: { session: { id: 'sess-demo1234' } } });

  assert.match(result.text, /已脱敏/);
  const names = await readdir(dir);
  const json = await readFile(path.join(dir, names.find((n) => n.endsWith('.json'))), 'utf8');
  assert.match(json, /\[REDACTED:openai-like\]/);
  assert.ok(!json.includes('sk-abcdefghijklmnop1234'));
});

test('命令: 错误参数与缺会话 ID 走 kind:error', async () => {
  const { ctx, registered } = fakeCtx();
  apply(ctx, {});
  const handler = registered.commands[0].handler;

  const bad = await handler({ rawInput: '--what', agent: { session: { id: 'x' } } });
  assert.equal(bad.kind, 'error');
  assert.match(bad.text, /无法识别的参数/);
  assert.match(bad.text, /用法/);

  const noId = await handler({ rawInput: '', agent: {} });
  assert.equal(noId.kind, 'error');
  assert.match(noId.text, /拿不到会话 ID/);
});

test('命令: --help 返回用法', async () => {
  const { ctx, registered } = fakeCtx();
  apply(ctx, {});
  const r = await registered.commands[0].handler({ rawInput: '--help' });
  assert.equal(r.kind, 'success');
  assert.match(r.text, /--last-turns/);
});

test('resolveConfig: 默认值与覆盖', () => {
  assert.deepEqual(resolveConfig({}), { exportDir: '', toolTruncateChars: 500 });
  assert.deepEqual(resolveConfig({ exportDir: ' D:\\x ', toolTruncateChars: 100 }), { exportDir: 'D:\\x', toolTruncateChars: 100 });
  assert.deepEqual(resolveConfig(null), { exportDir: '', toolTruncateChars: 500 });
});
