import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeTranscript, sliceTurns } from '../lib/normalize.js';
import { fixtureDoc } from './fixtures.mjs';

function normalizeFromEvents(events) {
  return normalizeTranscript({ sessionId: 's', events });
}

test('normalize: 保留表面事件，剔除注入并计数', () => {
  const doc = fixtureDoc();

  assert.equal(doc.meta.schemaVersion, 1);
  assert.equal(doc.meta.title, '演示会话');
  assert.equal(doc.meta.cwd, 'C:\\demo');
  assert.ok(Number.isFinite(doc.meta.createdAt));

  const c = doc.meta.counts;
  assert.equal(c.user, 3, 'u1 + u2 + 无rpcId但非注入的 u3');
  assert.equal(c.assistant, 2, 'a1 + deliverables 自建容器');
  assert.equal(c.toolCalls, 2, 'c1 + ghost');
  assert.equal(c.toolResults, 2);
  assert.equal(c.deliverables, 1);
  assert.equal(c.droppedInjections, 2, 'kind=system 一条 + 注入前缀一条');
  assert.equal(c.droppedEvents, 1, 'usage/foo');
});

test('normalize: 工具 result 回填到 assistant 的 tool-call 块', () => {
  const doc = fixtureDoc();
  const a1 = doc.messages.find((m) => m.id === 'a1');
  const call = a1.blocks.find((b) => b.kind === 'tool-call');
  assert.equal(call.name, 'read_file');
  assert.equal(call.status, 'ok');
  assert.equal(call.result, 'file content here');
  assert.equal(JSON.parse(call.args).path, 'a.txt');
});

test('normalize: 对不上 callId 的 result 走 orphan tool 消息并标 error', () => {
  const doc = fixtureDoc();
  const orphan = doc.messages.find((m) => m.role === 'tool');
  assert.ok(orphan, '应存在 orphan 容器');
  const b = orphan.blocks[0];
  assert.equal(b.result, 'orphan result');
  assert.equal(b.status, 'error');
});

test('normalize: 用户消息里的图片转成 file 块', () => {
  const doc = normalizeFromEvents([
    {
      type: 'user/message',
      data: {
        id: 'u-img',
        source: { kind: 'user' },
        rpcId: 'r',
        content: [
          { type: 'text', text: '看这张图' },
          { type: 'image', source: { path: 'C:\\pics\\x.png' } },
        ],
      },
    },
  ]);
  const kinds = doc.messages[0].blocks.map((b) => b.kind);
  assert.deepEqual(kinds, ['text', 'file']);
  assert.equal(doc.messages[0].blocks[1].path, 'C:\\pics\\x.png');
});

test('normalize: deliverables 在 assistant 后追加、在 user 后自建容器', () => {
  const doc = fixtureDoc();
  // 夹具里 deliverables 前面是 orphan tool 消息 → 应自建 assistant 容器（而非追加进 user）
  const container = doc.messages.find(
    (m) => m.role === 'assistant' && m.blocks[0]?.kind === 'file',
  );
  assert.ok(container, '应存在 deliverables 容器消息');
  assert.equal(container.blocks[0].path, 'C:\\demo\\out.md');
  assert.equal(container.blocks[0].description, '报告');

  // deliverables 紧跟 assistant 消息时追加进该消息，不新建容器
  const appended = normalizeFromEvents([
    {
      type: 'assistant/message',
      data: { message: { id: 'a', content: [{ type: 'text', text: '结论' }] } },
    },
    { type: 'deliverables/presented', data: { files: [{ path: 'x.md' }] } },
  ]);
  const a = appended.messages.find((m) => m.id === 'a');
  assert.equal(a.blocks.length, 2);
  assert.equal(a.blocks[1].kind, 'file');
  assert.equal(appended.meta.counts.assistant, 1, '追加不新增 assistant 计数');
});

test('sliceTurns: 只保留最近 n 个轮次，counts 保持全量', () => {
  const full = fixtureDoc();
  const sliced = sliceTurns(full, 1);
  assert.equal(sliced.meta.sliced, true);
  assert.deepEqual(sliced.meta.turnsKept, [1]);
  assert.ok(sliced.messages.every((m) => m.turn === 1));
  assert.equal(sliced.meta.counts.user, full.meta.counts.user, 'counts 口径不变');
  assert.ok(sliced.messages.length < full.messages.length);
});

test('normalize: 事件缺 seq/time 时不崩、turn 缺省为 0', () => {
  const doc = normalizeFromEvents([
    { type: 'user/message', data: { content: [{ type: 'text', text: '最小事件' }] } },
  ]);
  assert.equal(doc.messages.length, 1);
  assert.equal(doc.messages[0].turn, 0);
  assert.equal(doc.messages[0].time, 0);
  assert.match(doc.messages[0].id, /^user-/);
});

test('normalize: 空事件列表产出空 doc 且不崩', () => {
  const doc = normalizeFromEvents([]);
  assert.equal(doc.messages.length, 0);
  assert.equal(doc.meta.counts.droppedEvents, 0);
  assert.ok('title' in doc.meta);
});
