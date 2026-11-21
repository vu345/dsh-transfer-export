// 脱敏：只在 --mask 时启用。认得常见 key/token 形态，替换为 [REDACTED:<rule>]。
// 规则按顺序应用；对 JSON 保真层与渲染层同时生效（normalize 之后再渲染）。

const RULES = [
  { name: 'pem', re: /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g },
  { name: 'jwt', re: /eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/g },
  { name: 'openai-like', re: /\bsk-[A-Za-z0-9_-]{16,}\b/g },
  { name: 'github-app-token', re: /\b(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{20,}\b/g },
  { name: 'github-pat', re: /\bgithub_pat_[A-Za-z0-9_]{20,}\b/g },
  { name: 'gitlab', re: /\bglpat-[A-Za-z0-9_-]{16,}\b/g },
  { name: 'slack', re: /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/g },
  { name: 'aws', re: /\bAKIA[0-9A-Z]{16}\b/g },
  { name: 'google', re: /\bAIza[0-9A-Za-z_-]{30,}\b/g },
  { name: 'stripe', re: /\b(?:sk|rk)_(?:live|test)_[A-Za-z0-9]{16,}\b/g },
  {
    name: 'kv-assign',
    re: /\b(?:api[_-]?key|apikey|secret|token|password|passwd|pwd|authorization)\b\s*[=:]\s*["']?[^\s"',;\\]{6,}["']?/gi,
  },
  { name: 'dsn', re: /\b[a-z][a-z0-9+.-]*:\/\/[^\s:@/]+:[^\s@/]+@[^\s]+/gi },
  { name: 'bearer', re: /\bBearer\s+[A-Za-z0-9._-]{10,}/gi },
];

export function maskString(text) {
  if (typeof text !== 'string' || !text) return text;
  let out = text;
  for (const rule of RULES) {
    out = out.replace(rule.re, `[REDACTED:${rule.name}]`);
  }
  return out;
}

// 深拷贝并脱敏 doc（不改原对象）。
export function maskDoc(doc) {
  const messages = doc.messages.map((m) => ({
    ...m,
    blocks: m.blocks.map((b) => {
      const nb = { ...b };
      if (typeof nb.text === 'string') nb.text = maskString(nb.text);
      if (typeof nb.args === 'string') nb.args = maskString(nb.args);
      if (typeof nb.result === 'string') nb.result = maskString(nb.result);
      if (typeof nb.description === 'string') nb.description = maskString(nb.description);
      return nb;
    }),
  }));
  const meta = {
    ...doc.meta,
    title: maskString(doc.meta.title ?? ''),
    masked: true,
  };
  return { ...doc, meta, messages };
}
