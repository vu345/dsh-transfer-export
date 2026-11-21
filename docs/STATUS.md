---
status: current
owner: user
last_verified: 2026-11-21
verified_by: node --test（55/55，Node 20/22 CI 双矩阵绿）+ 真实会话命令冒烟（用户 12 · 助手 200 · 工具调用 266 · 剔除注入 31）
---

# STATUS · dsh-transfer-export

版本 v0.1.0；git `main` @ 7f25821；GitHub `vu345/dsh-transfer-export`（公开，topics: dsh-plugin / deepseek-harness / session-export，tag v0.1.0）。

## 已实现（有验证证据）

- `/transfer-export` 命令：默认 JSON+MD 双层导出；`--html`/`--only`/`--id`/`--last-turns`/`--out`/`--mask` 全部解析并生效（test/command.test.mjs）。
- **真实会话冒烟已过**（2026-11-21，desktop profile）：命令返回路径与统计，JSON 1.78MB 可用，注入剔除 31 条。
- 事件归一化：注入剔除/工具三级配对/deliverables 追加或自建容器（test/normalize.test.mjs）。
- 三渲染层：JSON 保真、MD（轮次标题带时间）、HTML（转义优先、TOC、明暗自适应）（test/render-*.test.mjs）。
- 脱敏 `--mask`；原子写 + 防覆盖；RPC 路由安全栅栏（同源 403 / 413 / 400 / 路由侧禁 out）。
- 浏览器半 v2：消息操作栏按钮（`conversation.chat.assistant-actions`，order 90，分支按钮后），下载托盘细线图标（用户选定），t 注入优先、自带词典兜底。
- CI：GitHub Actions Node 20/22 双矩阵 `npm test` **已绿**（run 44874199051）。

## 部分/待复验

- 按钮改版（图标 + 挪到消息操作栏）**只刷新页面即可生效**（host 半未变），尚未在真实 GUI 复验按钮是否出现在分支按钮后面、点击是否导出。
- client.js 的 slots/t 契约仍是推断实现：若按钮不出现或 t 不注入，按 ARCHITECTURE 契约小节排查。

## 未实现（v2 计划）

- `--docx`（FORMAT_RENDERERS 注册缝已留）；批量导出；附件搬运；收录 PR（awesome-dsh-plugin YAML）。

## 已知限制

- MD 层不解析 markdown 结构（正文原样）；HTML 层只处理 ``` 围栏与段落。
- reasoning 只进 JSON 层。
- 注入判定依赖 rpcId/前缀兜底：无特征注入可能漏进导出（宁可多留）。

## 下一步优先级

1. F5 刷新页面 → 复验按钮位置与点击导出。
2. npm publish（--registry https://registry.npmjs.org，需 npmjs 账号）。
3. 提收录 PR（awesome-dsh-plugin，data/plugins/vu345__dsh-transfer-export.yml，category: session）。

## 更新触发条件

lib/ 行为变更、安装方式变更、按钮复验结果出来后立即复核本文件。
