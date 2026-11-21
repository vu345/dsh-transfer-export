// Web 路由（标题栏按钮的后端）：POST /dsh-transfer-export/{ping,export}
// 安全约束：只收 POST；同源栅栏（Origin 缺失时要求 loopback Host）；
// 请求体 4MB 上限；路由侧不允许指定导出目录（永远写默认目录，防任意路径写）。

import { fmtBytes, runExport, statsLine } from './core.js';

export const ROUTE = '/dsh-transfer-export';
export const MAX_BODY_BYTES = 4 * 1024 * 1024;

const LOOPBACK_HOSTS = new Set(['127.0.0.1', 'localhost', '[::1]', '::1', '0.0.0.0']);

export function sameOriginOk(req) {
  const host = String(req.headers?.host ?? '');
  const origin = String(req.headers?.origin ?? '');
  if (!origin) {
    // 无 Origin 的调用方（本机工具）：要求 loopback Host
    const authority = host.split(':')[0]?.toLowerCase() ?? '';
    return LOOPBACK_HOSTS.has(authority) || host.toLowerCase() === '[::1]' || host === '::1';
  }
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

export function reply(res, status, body) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  });
  res.end(JSON.stringify(body));
}

export function createRouteHandler(ctx, cfg = {}) {
  return async function handle(req, res) {
    try {
      if ((req.method ?? 'GET').toUpperCase() !== 'POST') {
        reply(res, 405, { ok: false, error: '只接受 POST' });
        return;
      }
      if (!sameOriginOk(req)) {
        reply(res, 403, { ok: false, error: '跨域请求被拒绝' });
        return;
      }

      const action = new URL(req.url ?? '/', 'http://x').pathname.slice(ROUTE.length + 1);
      if (action === 'ping') {
        reply(res, 200, { ok: true, pong: true });
        return;
      }
      if (action !== 'export') {
        reply(res, 404, { ok: false, error: `未知 action "${action}"` });
        return;
      }

      let body;
      try {
        body = await readJsonBody(req);
      } catch (e) {
        reply(res, e.code === 'PAYLOAD_TOO_LARGE' ? 413 : 400, { ok: false, error: String(e.message ?? e) });
        return;
      }

      const sessionId = typeof body?.sessionId === 'string' ? body.sessionId.trim() : '';
      if (!sessionId) {
        reply(res, 400, { ok: false, error: '缺少 sessionId' });
        return;
      }

      // 路由侧的导出永远落默认目录（cfg.exportDir 可整体覆盖），不接受请求体里的 out
      const options = {
        html: body.html === true,
        only: typeof body.only === 'string' ? body.only : null,
        lastTurns: Number.isInteger(body.lastTurns) && body.lastTurns > 0 ? body.lastTurns : null,
        mask: body.mask === true,
        out: cfg.exportDir || undefined,
        toolTruncateChars: cfg.toolTruncateChars,
      };

      const { doc, files } = await runExport({ ctx, sessionId, options });
      reply(res, 200, {
        ok: true,
        files: files.map((f) => ({ format: f.format, path: f.path, bytes: fmtBytes(f.bytes) })),
        stats: statsLine(doc),
      });
    } catch (e) {
      // 与 transcript-export 同款约定：业务错误走 200 + ok:false，方便前端统一提示
      reply(res, 200, { ok: false, error: String(e?.message ?? e) });
    }
  };
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        const e = new Error('请求体超过 4MB 上限');
        e.code = 'PAYLOAD_TOO_LARGE';
        reject(e);
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8');
      if (!raw.trim()) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(raw));
      } catch {
        reject(new Error('请求体不是合法 JSON'));
      }
    });
    req.on('error', reject);
  });
}
