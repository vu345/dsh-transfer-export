// 共享夹具：一组覆盖主要事件形态的合成会话 → 归一化 doc。
// 多个渲染/命令测试复用，保证口径一致。

import { normalizeTranscript } from '../lib/normalize.js';

const T0 = Date.UTC(2026, 10, 21, 4, 0, 0);

export function fixtureEvents() {
  return [
    { type: 'session', time: T0, seq: 1, data: { cwd: 'C:\\demo', createdAt: T0 } },
    { type: 'session/title', seq: 2, data: { title: '演示会话' } },
    { type: 'turn/start', seq: 3, data: { turn: 0 } },
    {
      type: 'user/message', time: T0 + 1000, seq: 4,
      data: { id: 'u1', source: { kind: 'user' }, rpcId: 'rpc-1', content: [{ type: 'text', text: '你好，帮我看看这个文件' }] },
    },
    { type: 'user/message', seq: 5, data: { id: 'inj1', source: { kind: 'system' }, content: [{ type: 'text', text: 'runtime context…' }] } },
    {
      type: 'user/message', seq: 6,
      data: { id: 'inj2', source: { kind: 'user' }, content: [{ type: 'text', text: '<system-reminder>state</system-reminder>' }] },
    },
    {
      type: 'assistant/message', time: T0 + 2000, seq: 7,
      data: {
        message: {
          id: 'a1',
          content: [
            { type: 'text', text: '好的，我来读取文件。' },
            { type: 'tool-call', callId: 'c1', name: 'read_file', arguments: { path: 'a.txt' } },
          ],
        },
      },
    },
    { type: 'tool/result', time: T0 + 2500, seq: 8, data: { toolCallId: 'c1', content: 'file content here' } },
    {
      type: 'tool/result', time: T0 + 3000, seq: 9,
      data: { callId: 'ghost', content: [{ type: 'text', text: 'orphan result' }], isError: true },
    },
    { type: 'deliverables/presented', seq: 10, data: { files: [{ path: 'C:\\demo\\out.md', description: '报告' }] } },
    { type: 'usage/foo', seq: 11, data: {} },
    { type: 'turn/start', seq: 12, data: { turn: 1 } },
    {
      type: 'user/message', time: T0 + 4000, seq: 13,
      data: { id: 'u2', source: { kind: 'user' }, rpcId: 'rpc-2', content: [{ type: 'text', text: '第二轮问题' }] },
    },
    {
      type: 'user/message', seq: 14,
      data: { id: 'u3', source: { kind: 'user' }, content: [{ type: 'text', text: '没有 rpcId 但不是注入' }] },
    },
  ];
}

export function fixtureDoc() {
  return normalizeTranscript({ sessionId: 'sess-demo1234', events: fixtureEvents(), now: T0 + 60000 });
}

export function fixtureSnapshot() {
  return { session: { title: '演示会话', cwd: 'C:\\demo', createdAt: T0 }, events: fixtureEvents() };
}
