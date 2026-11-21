---
status: current
owner: user
last_verified: 2026-11-21
verified_by: node --test（55/55 全绿）；安装冒烟待 DSH 重启后执行
---

# STATUS · dsh-transfer-export

分支/版本：无 git（初始化待办）；v0.1.0。

## 已实现（有测试证据）

- `/transfer-export` 命令：默认 JSON+MD 双层导出；`--html`/`--only`/`--id`/`--last-turns`/`--out`/`--mask` 全部解析并生效（test/command.test.mjs）。
- 事件归一化：真实用户消息/注入剔除（kind 非 user + 注入前缀兜底）/assistant 块（text/reasoning/tool-call）/工具 result 配对（callId→顺序收养→orphan）/deliverables 追加或自建容器（test/normalize.test.mjs）。
- 三渲染层：JSON 保真（不截断）、MD（工具折叠+截断注明+围栏防破）、HTML（转义优先 XSS 安全、TOC、明暗自适应）（test/render-*.test.mjs）。
- 脱敏 `--mask`：常见 key/token 形态 + kv 赋值 + DSN + PEM（test/mask.test.mjs）。
- 落盘：原子写、同名 `-2` 后缀、默认 `~/.dsh/exports/dsh-transfer-export`（test/write.test.mjs）。
- RPC 路由：POST only、同源栅栏（403）、4MB 上限（413）、sessionId 校验（400）、路由侧禁 --out（test/routes.test.mjs）。
- 浏览器半：标题栏按钮工厂已写（lib/client.js），**未经真实 Loader 验证**。

## 部分/未验证

- **安装冒烟未做**：desktop profile 接线 + 重启 DSH + 真会话命令/按钮实测未执行（本次会话被用户中断前只完成代码与单测）。
- client.js 的 slots/locale 契约是对 transcript-export 的镜像推断，按钮能否渲染要靠冒烟。
- `ctx.inject(['commands'],…)` 挂载路径未在真实宿主上验证过（fake ctx 语义可能和 cordis 有差）。

## 未实现（v2 计划）

- `--docx`（渲染层注册缝已留：`lib/core.js` FORMAT_RENDERERS + 动态 import）。
- 批量导出 `--all --since 7d`；附件搬运；消息操作栏按钮。

## 已知限制

- MD 层不解析 markdown 结构（正文原样保留），HTML 层只处理 ``` 围栏与段落（标题/表格按普通段落）。
- reasoning 只进 JSON 层；MD/HTML 层不显示。
- 注入判定依赖 rpcId 或文本前缀特征：无 rpcId 且无前缀特征的注入可能漏进导出（宁可多留不丢真实输入）。

## 下一步优先级

1. 安装冒烟（profile 接线 → 重启 → 命令/按钮实测 → 与 session-digest 抽查条数）。
2. 冒烟结果回填本文件与 ARCHITECTURE 契约小节。
3. git init + 首个 commit。

## 更新触发条件

任何 lib/ 行为变更、安装方式变更、或冒烟发现契约偏差后立即复核本文件。
