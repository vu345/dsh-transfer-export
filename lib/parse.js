// /transfer-export 参数解析：纯函数，--out 吞掉行内剩余全部字符（支持带空格路径）。

export function parseArgs(raw = '') {
  const tokens = String(raw ?? '').trim().split(/\s+/).filter(Boolean);
  const out = {
    only: null,
    html: false,
    id: null,
    lastTurns: null,
    out: null,
    mask: false,
    help: false,
  };

  const takeValue = (i, flag) => {
    const v = tokens[i];
    if (v === undefined || v.startsWith('--')) {
      throw new Error(`${flag} 缺少值`);
    }
    return v;
  };

  for (let i = 0; i < tokens.length; i += 1) {
    const t = tokens[i];
    switch (t) {
      case '--html':
        out.html = true;
        break;
      case '--mask':
        out.mask = true;
        break;
      case '--only':
        out.only = takeValue(++i, '--only');
        break;
      case '--id':
        out.id = takeValue(++i, '--id');
        break;
      case '--last-turns': {
        const v = takeValue(++i, '--last-turns');
        const n = Number(v);
        if (!Number.isInteger(n) || n <= 0) throw new Error(`--last-turns 需要正整数，得到 "${v}"`);
        out.lastTurns = n;
        break;
      }
      case '--out':
        // 吞掉剩余全部 token 还原成带空格路径
        out.out = tokens.slice(i + 1).join(' ') || null;
        i = tokens.length;
        if (!out.out) throw new Error('--out 缺少值');
        break;
      case '--help':
      case '-h':
        out.help = true;
        break;
      default:
        throw new Error(`无法识别的参数 "${t}"（--help 查看用法）`);
    }
  }
  return out;
}

export const HELP_TEXT = `用法：/transfer-export [选项]

默认把当前会话导出为 JSON（保真）+ Markdown（阅读）两个文件到
~/.dsh/exports/dsh-transfer-export/。

选项：
  --html            额外生成单文件 HTML
  --only json|md|html   只导出一种格式
  --id <sessionId>  导出指定会话（含装插件前的历史会话）
  --last-turns N    只导出最近 N 轮
  --out <目录>      写入指定目录（支持带空格路径，吞掉行内剩余内容）
  --mask            脱敏（遮蔽 API key / token 等；默认不脱敏以保真）

示例：
  /transfer-export
  /transfer-export --html
  /transfer-export --last-turns 5
  /transfer-export --id sess-ab12cd34 --only md --out D:\\backup`;
