// dsh-transfer-export host 半。
// 约定式 cordis 插件：name / inject / apply；inject 保持空数组（未知服务名会让插件永久 pending），
// 服务挂载全部走 ctx.inject([...], cb) 运行时声明 + 可选降级。

import { fmtBytes, runExport, statsLine } from './core.js';
import { HELP_TEXT, parseArgs } from './parse.js';
import { ROUTE, createRouteHandler } from './routes.js';

export const name = 'transfer-export';
export const inject = [];

export function apply(ctx, config = {}) {
  const cfg = resolveConfig(config);

  // /transfer-export 命令（人类命令平面，零 token）
  ctx.inject?.(['commands'], (cc) => {
    cc.effect?.(
      () =>
        cc.commands?.register({
          name: 'transfer-export',
          description: '备份导出会话：默认 JSON+MD 双层到 ~/.dsh/exports/dsh-transfer-export，--html 加 HTML',
          handler: (invocation) => handleCommand(ctx, cfg, invocation),
        }),
      'transfer-export: command',
    );
  });

  // 标题栏按钮的 RPC 路由
  ctx.inject?.(['webServer'], (wc) => {
    wc.effect?.(
      () => wc.webServer?.register({ kind: 'prefix', path: ROUTE, handler: createRouteHandler(ctx, cfg) }),
      'transfer-export: route',
    );
  });
}

export function resolveConfig(config = {}) {
  const c = config && typeof config === 'object' ? config : {};
  return {
    exportDir: typeof c.exportDir === 'string' && c.exportDir.trim() ? c.exportDir.trim() : '',
    toolTruncateChars: Number.isFinite(c.toolTruncateChars) ? c.toolTruncateChars : 500,
  };
}

async function handleCommand(ctx, cfg, invocation = {}) {
  const raw = typeof invocation.rawInput === 'string' ? invocation.rawInput : '';
  let args;
  try {
    args = parseArgs(raw);
  } catch (e) {
    return { kind: 'error', text: `${e.message}\n\n${HELP_TEXT}` };
  }
  if (args.help) return { kind: 'success', text: HELP_TEXT };

  const sessionId = args.id || invocation.agent?.session?.id;
  if (!sessionId) {
    return { kind: 'error', text: '拿不到会话 ID：当前没有活动会话，且未给 --id。' };
  }

  try {
    const { doc, files } = await runExport({
      ctx,
      sessionId,
      options: {
        only: args.only,
        html: args.html,
        lastTurns: args.lastTurns,
        out: args.out || undefined,
        mask: args.mask,
        toolTruncateChars: cfg.toolTruncateChars,
      },
    });
    const lines = [
      `已导出 ${files.length} 个文件（${statsLine(doc)}）：`,
      ...files.map((f) => `- ${f.path} (${fmtBytes(f.bytes)}, ${f.format})`),
    ];
    if (doc.meta.masked) lines.push('（已脱敏：密钥/token 替换为 [REDACTED:*]，JSON 层同样脱敏）');
    return { kind: 'success', text: lines.join('\n') };
  } catch (e) {
    return { kind: 'error', text: `导出失败：${String(e?.message ?? e)}` };
  }
}
