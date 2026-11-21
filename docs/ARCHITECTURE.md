# ARCHITECTURE · dsh-transfer-export

## 数据流

```text
DSH 宿主（desktop profile）
│
├─ 命令平面：/transfer-export <flags>（人类命令，零 token）
│    └─ lib/index.js handleCommand
│         ├─ lib/parse.js        flags 解析（--out 吞行内剩余）
│         └─ lib/core.js runExport
├─ Web 路由：POST /dsh-transfer-export/{ping,export}（标题栏按钮）
│    └─ lib/routes.js（同源栅栏→4MB 上限→sessionId 校验→禁 out）
│         └─ lib/core.js runExport   ← 两个入口共用同一核心
└─ 浏览器半：lib/client.js（ModuleLoader 工厂）
     └─ slots 'conversation.chat.assistant-actions' 注册图标按钮（order 90，分支按钮后）
         → fetch POST /export {sessionId} → 浮动 toast 显示写盘路径

runExport（lib/core.js）：
  sessionQuery.readSession(id) ──缺则──▶ sessions.get(id) 兜底
    → lib/normalize.js   事件流 → 归一化转录（只留表面事件，注入剔除计数）
    → sliceTurns         （--last-turns）
    → lib/mask.js        （--mask，深拷贝脱敏）
    → lib/render-{json,md,html}.js
    → lib/write.js       原子写 + freeName 防覆盖 → {files, stats}
```

## 模块职责

| 模块 | 职责 | 纯函数？ |
|---|---|---|
| `lib/normalize.js` | 事件流→归一化转录；注入判定；sliceTurns | ✅ |
| `lib/core.js` | runExport 编排 + FORMAT_RENDERERS 注册缝 | 编排（IO 集中在 write） |
| `lib/render-json.js` | 保真层：完整 doc 原样 JSON | ✅ |
| `lib/render-md.js` | 阅读层：轮次标题/工具折叠/截断注明 | ✅ |
| `lib/render-html.js` | 分发层：单文件自包含、转义优先 | ✅ |
| `lib/mask.js` | 脱敏规则表 + maskDoc 深拷贝 | ✅ |
| `lib/parse.js` | 命令 flags 解析 | ✅ |
| `lib/write.js` | defaultExportDir / stampFor / freeName / atomicWriteFile | IO |
| `lib/index.js` | cordis 入口：命令+路由注册、handleCommand | 宿主接缝 |
| `lib/routes.js` | HTTP 路由与安全栅栏 | 宿主接缝 |
| `lib/client.js` | 浏览器按钮（CJS 工厂，Loader 挂载；下载托盘图标，t 缺省回退自带词典） | 浏览器 |

## 宿主接缝契约（实测来源：dsh-transcript-export 0.2.0 / dsh-session-export 1.11.0）

- **事件形状**：`{ type, time?, seq?, data? }`。读取字段全部多路径回退（`data.source.kind` / `data.message.source.kind`、args 的 `arguments ?? argsRaw ?? args` 等）。
- **保留的 type**：`session`、`session/title`、`turn/start`、`user/message`、`assistant/message`、`tool/call`、`tool/result`、`deliverables/presented`；其余计入 droppedEvents。
- **注入判定**：`source.kind` 存在且 ≠ `'user'` → 剔除；`kind==='user'` 无 rpcId 且正文以注入前缀开头 → 剔除；否则保留（宁可多留）。
- **工具配对**：callId Map；result 对不上按到达顺序收养第一个无 result 的挂起块；仍不行且文本非空 → orphan tool 消息（status=error 由 isError/status/outcome 判定）。
- **cordis 挂载**：`export const name/inject([])/apply(ctx, config)`；服务用 `ctx.inject(['commands'|'webServer'], cb)` + `effect(fn, label)`；`inject` 数组保持空（未知服务名会让插件永久 pending）；sessionQuery 用 `ctx.get()` 调用时惰性取。
- **命令返回**：`{ kind: 'success'|'error', text }`；sessionId 取 `invocation.agent.session.id`。
- **路由**：`webServer.register({ kind:'prefix', path, handler })`，raw node:http req/res；业务错误走 200 + `{ok:false,error}`；无 Origin 时要求 loopback Host。

## 边界与不变量

- JSON 保真层**永不截断**；MD/HTML 工具输出截断必须注明截断字符数（`toolTruncateChars`，默认 500）。
- 默认**不脱敏**；`--mask` 是显式动作，对 JSON 与渲染层同时生效。
- 路由侧永远写默认目录（`cfg.exportDir` 或 `defaultExportDir()`），**不接受请求体里的 out**——防浏览器请求写任意路径。
- 落盘不覆盖：`freeName` 撞名加 `-2/-3` 后缀；写入一律 tmp+rename 原子写。
- 零 npm 运行时依赖；v2 docx 只能经 `FORMAT_RENDERERS` 注册 + 动态 import。

## 要改什么，改哪里

| 想改 | 去哪 |
|---|---|
| 新导出格式 | `lib/core.js` FORMAT_RENDERERS 注册 + 新 render 文件 + resolveFormats |
| 注入/配对规则 | `lib/normalize.js`（改完先对 ARCHITECTURE 契约小节 + 单测） |
| 脱敏规则 | `lib/mask.js` RULES 表 |
| 默认目录 / 截断长度 | `lib/write.js` defaultExportDir / cordis.patch.yml config |
| 按钮 UI / 图标 | `lib/client.js`（slots 契约见上；图标是内联 SVG 细线下载托盘） |
| 安全栅栏 | `lib/routes.js`（不可拆） |
