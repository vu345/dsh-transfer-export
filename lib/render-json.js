// 保真层：完整归一化结构原样落 JSON，不截断、不脱敏（--mask 除外，那是显式选择）。
// 将来任何格式（docx/HTML/重新渲染）都可以从这一层再生成。

export function renderJson(doc) {
  return JSON.stringify(doc, null, 2) + '\n';
}
