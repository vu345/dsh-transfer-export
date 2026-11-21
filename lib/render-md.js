// 阅读层：Markdown。轮次做标题，工具调用折叠成"一行摘要 + 可选截断输出"。
// 用户/助手的 markdown 正文原样保留（这是备份文档，不是渲染沙箱）；
// 围栏代码用"比正文里最长的 ``` 序列多一根"的围栏包裹，防破结构。
// reasoning 块不进 MD（JSON 保真层里有）。

export function renderMarkdown(doc, options = {}) {
  const meta = doc.meta;
  const c = meta.counts;
  const lines = [];

  lines.push(`# ${meta.title || '会话转录'}`);
  lines.push('');
  lines.push(`- 会话 ID：\`${meta.sessionId}\``);
  if (meta.cwd) lines.push(`- 工作区：\`${meta.cwd}\``);
  if (Number.isFinite(meta.createdAt) && meta.createdAt) lines.push(`- 开始时间：${fmtTime(meta.createdAt)}`);
  lines.push(`- 导出时间：${fmtTime(meta.exportedAt || Date.now())} · ${meta.generator}`);
  const parts = [`用户 ${c.user} / 助手 ${c.assistant}`, `工具调用 ${c.toolCalls}`];
  if (c.deliverables) parts.push(`产出 ${c.deliverables}`);
  if (c.droppedInjections) parts.push(`剔除注入 ${c.droppedInjections}`);
  if (meta.sliced) parts.push(`仅最近 ${meta.turnsKept?.length ?? '?'} 轮`);
  lines.push(`- 规模：${parts.join(' · ')}`);
  if (meta.masked) lines.push('- 脱敏：已启用');
  lines.push('');

  let lastTurn = null;
  let turnIndex = 0;
  for (const m of doc.messages) {
    if (m.turn !== lastTurn) {
      lastTurn = m.turn;
      turnIndex = (Number.isFinite(m.turn) ? m.turn : 0) + 1;
      const t = m.time ? ` · ${fmtTime(m.time)}` : '';
      lines.push(`## 第 ${turnIndex} 轮${t}`, '');
    }
    pushMessage(lines, m, options);
  }

  return lines.join('\n') + '\n';
}

function pushMessage(lines, m, options) {
  if (m.role === 'user') {
    lines.push('**用户**', '');
    pushTextBlocks(lines, m.blocks, (b) => b.kind === 'text');
  } else if (m.role === 'assistant') {
    lines.push('**助手**', '');
    for (const b of m.blocks) {
      if (b.kind === 'text') {
        lines.push(b.text, '');
      } else if (b.kind === 'file') {
        lines.push(`**产出**：\`${b.path}\`${b.description ? ` — ${b.description}` : ''}`, '');
      } else if (b.kind === 'tool-call') {
        pushTool(lines, b, options);
      }
      // reasoning 不进 MD
    }
  } else if (m.role === 'tool') {
    for (const b of m.blocks) {
      if (b.kind === 'tool-call') pushTool(lines, b, options);
    }
  }
}

function pushTool(lines, b, options) {
  const limit = Number.isFinite(options.toolTruncateChars) ? options.toolTruncateChars : 500;
  const status = b.status === 'ok' ? 'ok' : b.status === 'error' ? 'error' : '未知';
  lines.push(`**🔧 \`${b.name}\`** · ${status}`, '');
  if (b.args) {
    lines.push('- 调用：', '', fenceFor(b.args), b.args, fenceFor(b.args), '');
  }
  if (b.result !== undefined && b.result !== '') {
    const truncated = limit > 0 && b.result.length > limit;
    const body = truncated ? b.result.slice(0, limit) : b.result;
    const fence = fenceFor(body);
    lines.push('- 输出：', '', fence, body, fence, '');
    if (truncated) lines.push(`  （MD 层截断前 ${limit} 字符，共 ${b.result.length} 字符；JSON 保真层完整保留）`, '');
  } else if (b.status === 'unknown') {
    lines.push('- 输出：（无配对结果）', '');
  }
}

function pushTextBlocks(lines, blocks, pred) {
  for (const b of blocks) {
    if (pred(b)) lines.push(b.text, '');
  }
}

function fenceFor(text) {
  let n = 3;
  for (const m of String(text).matchAll(/`{3,}/g)) n = Math.max(n, m[0].length + 1);
  return '`'.repeat(n);
}

export function fmtTime(ms) {
  if (!Number.isFinite(ms) || !ms) return '';
  const d = new Date(ms);
  const p = (x) => String(x).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}
