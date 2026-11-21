import test from 'node:test';
import assert from 'node:assert/strict';
import { renderJson } from '../lib/render-json.js';
import { fixtureDoc } from './fixtures.mjs';

test('json: 可解析且结构完整', () => {
  const doc = fixtureDoc();
  const text = renderJson(doc);
  const parsed = JSON.parse(text);

  assert.equal(parsed.meta.schemaVersion, 1);
  assert.equal(parsed.meta.sessionId, 'sess-demo1234');
  assert.equal(parsed.messages.length, doc.messages.length);
  assert.equal(parsed.meta.counts.toolCalls, 2);
});

test('json: 工具结果完整保留（保真层不截断）', () => {
  const doc = fixtureDoc();
  const a1 = doc.messages.find((m) => m.id === 'a1');
  a1.blocks.find((b) => b.kind === 'tool-call').result = 'y'.repeat(100000);
  const parsed = JSON.parse(renderJson(doc));
  const call = parsed.messages.find((m) => m.id === 'a1').blocks.find((b) => b.kind === 'tool-call');
  assert.equal(call.result.length, 100000);
});
