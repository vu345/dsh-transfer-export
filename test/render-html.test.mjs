import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeTranscript } from '../lib/normalize.js';
import { renderHtml } from '../lib/render-html.js';
import { fixtureDoc } from './fixtures.mjs';

test('html: 单文件结构与元信息', () => {
  const html = renderHtml(fixtureDoc());
  assert.match(html, /^<!doctype html>/);
  assert.match(html, /<title>演示会话<\/title>/);
  assert.match(html, /<code>sess-demo1234<\/code>/);
  assert.match(html, /剔除注入 2/);
  assert.match(html, /href="#turn-0"/);
  assert.match(html, /id="turn-1"/);
});

test('html: 工具调用渲染成 details 并带状态', () => {
  const html = renderHtml(fixtureDoc());
  assert.match(html, /<details class="tool ok">/);
  assert.match(html, /<details class="tool error">/);
  assert.match(html, /<code>read_file<\/code>/);
  assert.match(html, /file content here/);
});

test('html: 正文先转义后套结构（XSS 安全）', () => {
  const doc = normalizeTranscript({
    sessionId: 's',
    events: [
      {
        type: 'user/message',
        data: {
          id: 'u-xss',
          source: { kind: 'user' },
          rpcId: 'r',
          content: [{ type: 'text', text: '<img src=x onerror=alert(1)> & <script>alert(2)</script>' }],
        },
      },
    ],
  });
  const html = renderHtml(doc);
  assert.ok(html.includes('&lt;img src=x onerror=alert(1)&gt;'), '用户内容应整体转义');
  assert.ok(!html.includes('<img src=x'), '不应出现未转义的用户标签');
  assert.ok(!html.includes('<script>alert(2)'), '不应出现未转义的 script');
});

test('html: 正文中的 ``` 代码块转成 pre/code', () => {
  const doc = normalizeTranscript({
    sessionId: 's',
    events: [
      {
        type: 'assistant/message',
        data: { message: { id: 'a', content: [{ type: 'text', text: '前文\n```js\nconst a = 1;\n```\n后文' }] } },
      },
    ],
  });
  const html = renderHtml(doc);
  assert.match(html, /<pre><code>const a = 1;<\/code><\/pre>/);
  assert.match(html, /<p>前文<\/p>/);
});

test('html: reasoning 折叠、file 产出列表', () => {
  const doc = normalizeTranscript({
    sessionId: 's',
    events: [
      {
        type: 'assistant/message',
        data: { message: { id: 'a', content: [
          { type: 'reasoning', reasoning: '内部推演' },
          { type: 'text', text: '结论' },
        ] } },
      },
      { type: 'deliverables/presented', data: { files: [{ path: 'C:\\demo\\out.md', description: '报告' }] } },
    ],
  });
  const html = renderHtml(doc);
  assert.match(html, /<details class="reasoning">/);
  assert.match(html, /内部推演/);
  assert.match(html, /产出：<code>C:\\demo\\out.md<\/code> — 报告/);
});

test('html: 空会话不产生 section 也不崩', () => {
  const html = renderHtml(normalizeTranscript({ sessionId: 's', events: [] }));
  assert.ok(!html.includes('<section'));
  assert.match(html, /<\/html>/);
});
