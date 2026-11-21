import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeTranscript } from '../lib/normalize.js';
import { renderMarkdown } from '../lib/render-md.js';
import { fixtureDoc } from './fixtures.mjs';

test('md: 头部元信息与规模行', () => {
  const md = renderMarkdown(fixtureDoc());
  assert.match(md, /^# 演示会话\n/);
  assert.match(md, /- 会话 ID：`sess-demo1234`/);
  assert.match(md, /- 工作区：`C:\\demo`/);
  assert.match(md, /剔除注入 2/);
  assert.match(md, /工具调用 2/);
});

test('md: 轮次标题带时间、无 HTML 注释残留', () => {
  const md = renderMarkdown(fixtureDoc());
  // 时间用本地时区渲染，断言只看格式（CI 在 UTC 也能过）
  assert.match(md, /## 第 1 轮 · \d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/);
  assert.match(md, /## 第 2 轮 · \d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/);
  assert.ok(!md.includes('<!--'), '不应再输出 HTML 注释');
  const first = md.indexOf('## 第 1 轮');
  const second = md.indexOf('## 第 2 轮');
  assert.ok(first > 0 && second > first);
});

test('md: 用户与助手正文、工具调用折叠', () => {
  const md = renderMarkdown(fixtureDoc());
  assert.match(md, /\*\*用户\*\*/);
  assert.match(md, /\*\*助手\*\*/);
  assert.match(md, /你好，帮我看看这个文件/);
  assert.match(md, /\*\*🔧 `read_file`\*\* · ok/);
  assert.match(md, /- 调用：/);
  assert.match(md, /file content here/);
});

test('md: 超长工具输出截断并注明（JSON 层完整）', () => {
  const doc = normalizeTranscript({
    sessionId: 's',
    events: [
      { type: 'assistant/message', data: { message: { id: 'a', content: [
        { type: 'tool-call', callId: 'c', name: 'big' },
      ] } } },
      { type: 'tool/result', data: { toolCallId: 'c', content: 'x'.repeat(900) } },
    ],
  });
  const md = renderMarkdown(doc, { toolTruncateChars: 100 });
  assert.match(md, /（MD 层截断前 100 字符，共 900 字符；JSON 保真层完整保留）/);
  assert.ok(!md.includes('x'.repeat(900)), '完整长文不应出现在 MD 里');
});

test('md: 正文里的 ``` 围栏原样保留（阅读层不做二次包裹）', () => {
  const doc = normalizeTranscript({
    sessionId: 's',
    events: [
      { type: 'assistant/message', data: { message: { id: 'a', content: [
        { type: 'text', text: '看这段：\n```\ncode with ``` inside\n```\n完事' },
      ] } } },
    ],
  });
  const md = renderMarkdown(doc);
  assert.ok(md.includes('```\ncode with ``` inside\n```'), '正文 markdown 源码原样保留');
});

test('md: masked 与 sliced 标注', () => {
  const doc = fixtureDoc();
  doc.meta.masked = true;
  doc.meta.sliced = true;
  doc.meta.turnsKept = [1];
  const md = renderMarkdown(doc);
  assert.match(md, /- 脱敏：已启用/);
  assert.match(md, /仅最近 1 轮/);
});
