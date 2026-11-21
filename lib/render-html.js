// HTML 层（可选输出）：单文件自包含、转义优先、离线可开、明暗自适应、可打印。
// v1 不做完整 markdown 解析：``` 围栏 → <pre><code>，其余按保留换行的段落渲染。

export function renderHtml(doc, options = {}) {
  const meta = doc.meta;
  const c = meta.counts;
  const esc = escapeHtml;
  const title = esc(meta.title || '会话转录');

  const turns = [];
  for (const m of doc.messages) {
    const t = Number.isFinite(m.turn) ? m.turn : 0;
    if (!turns.length || turns[turns.length - 1] !== t) turns.push(t);
  }

  const parts = [];
  parts.push('<!doctype html>');
  parts.push('<html lang="zh-CN">');
  parts.push('<head>');
  parts.push('<meta charset="utf-8">');
  parts.push('<meta name="viewport" content="width=device-width, initial-scale=1">');
  parts.push(`<title>${title}</title>`);
  parts.push(`<style>${css()}</style>`);
  parts.push('</head>');
  parts.push('<body>');
  parts.push(`<header><h1>${title}</h1>`);
  parts.push('<table class="meta">');
  parts.push(`<tr><th>会话 ID</th><td><code>${esc(meta.sessionId)}</code></td></tr>`);
  if (meta.cwd) parts.push(`<tr><th>工作区</th><td><code>${esc(meta.cwd)}</code></td></tr>`);
  if (Number.isFinite(meta.createdAt) && meta.createdAt)
    parts.push(`<tr><th>开始时间</th><td>${fmtTime(meta.createdAt)}</td></tr>`);
  parts.push(
    `<tr><th>导出</th><td>${fmtTime(meta.exportedAt || Date.now())} · ${esc(meta.generator)}${
      meta.masked ? ' · 已脱敏' : ''
    }${meta.sliced ? ` · 仅最近 ${meta.turnsKept?.length ?? '?'} 轮` : ''}</td></tr>`,
  );
  const chips = [`用户 ${c.user} / 助手 ${c.assistant}`, `工具调用 ${c.toolCalls}`];
  if (c.deliverables) chips.push(`产出 ${c.deliverables}`);
  if (c.droppedInjections) chips.push(`剔除注入 ${c.droppedInjections}`);
  parts.push(`<tr><th>规模</th><td>${esc(chips.join(' · '))}</td></tr>`);
  parts.push('</table>');

  if (turns.length) {
    parts.push('<nav class="toc">');
    for (const t of turns) {
      parts.push(`<a href="#turn-${t}">第 ${t + 1} 轮</a>`);
    }
    parts.push('</nav>');
  }
  parts.push('</header>');

  let lastTurn = null;
  let open = false;
  for (const m of doc.messages) {
    if (m.turn !== lastTurn) {
      lastTurn = m.turn;
      const t = Number.isFinite(m.turn) ? m.turn : 0;
      if (open) parts.push('</section>');
      parts.push(`<section id="turn-${t}"><h2>第 ${t + 1} 轮${m.time ? ` <time>${fmtTime(m.time)}</time>` : ''}</h2>`);
      open = true;
    }
    parts.push(messageHtml(m, options));
  }
  if (open) parts.push('</section>');
  parts.push('<footer>由 dsh-transfer-export 生成 · JSON 文件为保真层，可再生成任何其它格式</footer>');
  parts.push('</body></html>');
  return parts.join('\n') + '\n';
}

function messageHtml(m, options) {
  const esc = escapeHtml;
  const out = [];
  if (m.role === 'user') out.push('<div class="msg user"><div class="role">用户</div>');
  else if (m.role === 'assistant') out.push('<div class="msg assistant"><div class="role">助手</div>');
  else out.push('<div class="msg tool"><div class="role">工具</div>');

  for (const b of m.blocks) {
    if (b.kind === 'text') {
      out.push(textToHtml(b.text));
    } else if (b.kind === 'reasoning') {
      out.push(
        `<details class="reasoning"><summary>思考过程</summary>${textToHtml(b.text)}</details>`,
      );
    } else if (b.kind === 'file') {
      out.push(
        `<div class="file">产出：<code>${esc(b.path)}</code>${
          b.description ? ` — ${esc(b.description)}` : ''
        }</div>`,
      );
    } else if (b.kind === 'tool-call') {
      out.push(toolHtml(b, options));
    }
  }
  out.push('</div>');
  return out.join('\n');
}

function toolHtml(b, options) {
  const esc = escapeHtml;
  const status = b.status === 'ok' ? 'ok' : b.status === 'error' ? 'error' : 'unknown';
  const limit = Number.isFinite(options.toolTruncateChars) ? options.toolTruncateChars : 500;
  const bits = [`<details class="tool ${status}"><summary>🔧 <code>${esc(b.name)}</code> · ${esc(status)}</summary>`];
  if (b.args) bits.push(`<div class="arg-label">调用</div><pre>${esc(b.args)}</pre>`);
  if (b.result !== undefined && b.result !== '') {
    const truncated = limit > 0 && b.result.length > limit;
    const body = truncated ? `${b.result.slice(0, limit)}\n…[MD/HTML 层截断，共 ${b.result.length} 字符]` : b.result;
    bits.push(`<div class="arg-label">输出</div><pre>${esc(body)}</pre>`);
  } else if (b.status === 'unknown') {
    bits.push('<div class="arg-label">（无配对结果）</div>');
  }
  bits.push('</details>');
  return bits.join('\n');
}

// 转义优先：先整体转义，再按 ``` 围栏切出代码块套结构。
function textToHtml(text) {
  const segments = String(text ?? '').split(/```[a-zA-Z0-9_-]*\n?/);
  // split 掉围栏行本身：奇数段是代码体
  const out = [];
  for (let i = 0; i < segments.length; i += 1) {
    const seg = segments[i];
    if (!seg) continue;
    if (i % 2 === 1) {
      out.push(`<pre><code>${escapeHtml(seg.replace(/\n$/, ''))}</code></pre>`);
    } else {
      out.push(paragraphsHtml(seg));
    }
  }
  return out.join('\n') || '<p></p>';
}

function paragraphsHtml(seg) {
  const esc = escapeHtml;
  const blocks = seg.split(/\n{2,}/);
  const out = [];
  for (const b of blocks) {
    const content = b.replace(/^\n+|\n+$/g, '');
    if (!content) continue;
    out.push(`<p>${esc(content)}</p>`);
  }
  return out.join('\n');
}

function escapeHtml(s) {
  return String(s)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

export function fmtTime(ms) {
  if (!Number.isFinite(ms) || !ms) return '';
  const d = new Date(ms);
  const p = (x) => String(x).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

function css() {
  return `
:root { color-scheme: light dark; }
body { margin: 0 auto; max-width: 860px; padding: 24px 20px 64px; font: 15px/1.65 -apple-system, "Segoe UI", "Microsoft YaHei", sans-serif; }
h1 { font-size: 22px; margin: 0 0 12px; }
h2 { font-size: 17px; margin: 28px 0 10px; border-bottom: 1px solid #8884; padding-bottom: 6px; }
h2 time { font-weight: 400; font-size: 12px; opacity: .65; margin-left: 8px; }
table.meta { border-collapse: collapse; font-size: 13px; }
table.meta th { text-align: left; padding: 2px 10px 2px 0; opacity: .6; font-weight: 500; white-space: nowrap; }
table.meta td { padding: 2px 0; }
code { font: 12.5px/1.5 ui-monospace, Consolas, monospace; background: #8881; padding: 1px 5px; border-radius: 4px; }
pre { font: 12.5px/1.5 ui-monospace, Consolas, monospace; background: #8882; padding: 10px 12px; border-radius: 8px; overflow: auto; white-space: pre-wrap; word-break: break-word; }
pre code { background: none; padding: 0; }
p { white-space: pre-wrap; word-break: break-word; margin: 8px 0; }
.msg { margin: 14px 0; padding: 12px 14px; border-radius: 10px; border: 1px solid #8884; }
.msg .role { font-weight: 600; font-size: 12px; opacity: .55; margin-bottom: 4px; }
.msg.user { background: #3b82f614; }
.msg.assistant { background: #22c55e10; }
.msg.tool { background: transparent; border-style: dashed; }
.toc { margin: 16px 0 0; display: flex; flex-wrap: wrap; gap: 6px 12px; font-size: 13px; }
.toc a { text-decoration: none; opacity: .7; }
.toc a:hover { opacity: 1; text-decoration: underline; }
details { margin: 8px 0; border: 1px solid #8884; border-radius: 8px; padding: 6px 10px; }
details summary { cursor: pointer; font-size: 13px; }
details.tool.error summary { color: #dc2626; }
details.reasoning summary { opacity: .6; }
.arg-label { font-size: 11px; opacity: .5; margin: 8px 0 2px; text-transform: uppercase; letter-spacing: .05em; }
.file { font-size: 13px; margin: 6px 0; }
footer { margin-top: 40px; font-size: 12px; opacity: .5; }
@media print {
  .toc { display: none; }
  .msg, details { break-inside: avoid; }
  body { max-width: none; }
}
`;
}
