// 导出核心：读会话 → 归一化 → 切轮 → 脱敏 → 渲染 → 落盘。
// 命令（lib/index.js）与 HTTP 路由（lib/routes.js）共用这一个入口。

import path from 'node:path';
import { normalizeTranscript, sliceTurns } from './normalize.js';
import { renderJson } from './render-json.js';
import { renderMarkdown } from './render-md.js';
import { renderHtml } from './render-html.js';
import { maskDoc } from './mask.js';
import { atomicWriteFile, defaultExportDir, freeName, stampFor } from './write.js';

// 渲染格式注册缝：v2 加 docx 时在这里 register 即可，调用面不变。
const FORMAT_RENDERERS = {
  json: renderJson,
  md: renderMarkdown,
  html: renderHtml,
};

export const FORMAT_NAMES = Object.keys(FORMAT_RENDERERS);

export function resolveFormats({ only, html } = {}) {
  if (only) {
    const f = String(only).toLowerCase();
    if (!FORMAT_RENDERERS[f]) {
      throw new Error(`未知导出格式 "${only}"（可选：${FORMAT_NAMES.join(' | ')}）`);
    }
    return [f];
  }
  return html ? ['json', 'md', 'html'] : ['json', 'md'];
}

// sessionQuery 优先，sessions（活动会话）兜底；两个服务都没有才报错。
export async function readSessionAny(ctx, sessionId) {
  const query = typeof ctx?.get === 'function' ? ctx.get('sessionQuery') : undefined;
  if (query && typeof query.readSession === 'function') {
    const snap = await query.readSession(sessionId);
    const header = snap?.session ?? snap?.header ?? {};
    const events = Array.isArray(snap?.events) ? snap.events : [];
    return { header, events, source: 'sessionQuery' };
  }
  const sessions = typeof ctx?.get === 'function' ? ctx.get('sessions') : undefined;
  const live = sessions?.get?.(sessionId);
  if (!live) {
    throw new Error(`找不到会话 "${sessionId}"（sessionQuery / sessions 服务都不可用）`);
  }
  const events = typeof live.snapshotEvents === 'function'
    ? live.snapshotEvents(0)
    : Array.isArray(live.log)
      ? live.log
      : [];
  return { header: live.header ?? {}, events, source: 'sessions' };
}

export async function runExport({ ctx, sessionId, options = {} }) {
  const id = String(sessionId ?? '').trim();
  if (!id) throw new Error('缺少会话 ID');

  const { header, events, source } = await readSessionAny(ctx, id);
  const now = Number.isFinite(options.now) ? options.now : Date.now();

  let doc = normalizeTranscript({
    sessionId: id,
    events,
    now,
    title: typeof header?.title === 'string' ? header.title : '',
  });
  if (header?.cwd && !doc.meta.cwd) doc.meta.cwd = header.cwd;
  if (Number.isFinite(header?.createdAt) && !doc.meta.createdAt) doc.meta.createdAt = header.createdAt;
  doc.meta.source = source;

  if (options.lastTurns) doc = sliceTurns(doc, options.lastTurns);
  if (options.mask) doc = maskDoc(doc);

  const formats = resolveFormats(options);
  const outDir = options.out ? String(options.out) : defaultExportDir();
  const stamp = stampFor(now);
  // 会话 ID 常以 "session-" 开头，剥掉再取 8 位，避免文件名出现双横线
  const id8 = id.replace(/^session-/i, '').slice(0, 8) || 'session';
  const files = [];

  for (const fmt of formats) {
    const render = FORMAT_RENDERERS[fmt];
    const content = render(doc, options);
    const base = `transfer-${id8}-${stamp}.${fmt}`;
    const name = await freeName(outDir, base);
    const target = path.join(outDir, name);
    await atomicWriteFile(target, content);
    files.push({ format: fmt, path: target, bytes: Buffer.byteLength(content, 'utf8') });
  }

  return { doc, files, formats, outDir };
}

export function fmtBytes(n) {
  if (!Number.isFinite(n)) return '?';
  if (n < 1024) return `${n}B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)}KB`;
  return `${(n / 1024 / 1024).toFixed(2)}MB`;
}

export function statsLine(doc) {
  const c = doc.meta.counts;
  const bits = [`用户 ${c.user}`, `助手 ${c.assistant}`, `工具调用 ${c.toolCalls}`];
  if (c.deliverables) bits.push(`产出 ${c.deliverables}`);
  if (c.droppedInjections) bits.push(`剔除注入 ${c.droppedInjections}`);
  return bits.join(' · ');
}
