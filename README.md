# dsh-transfer-export

中文 | [English](README.en.md)

DSH（DeepSeek Harness）会话备份导出插件：把会话导出成**JSON 保真层 + Markdown 阅读层**两个文件（默认双层），可选单文件 HTML。`/transfer-export` 命令或会话标题栏按钮触发。

## 为什么是 JSON + MD 双层

- **JSON 是保真层**：完整归一化事件 + 元数据，不截断。将来想转 docx/HTML/重新渲染，都从这一层再生成。
- **MD 是阅读层**：轮次标题、工具调用折叠、超长输出截断并注明。适合人工翻阅、进笔记、diff。
- **HTML 是分发层**（`--html` 可选）：单文件自包含、离线可开、可打印。
- docx 不做归档主格式（二进制、难 diff）；v2 计划经渲染层扩展缝（`lib/core.js` 的 `FORMAT_RENDERERS`）动态加载 docx 库支持 `--docx`。

## 用法

```text
/transfer-export                    # 当前会话 → JSON + MD 双文件
/transfer-export --html             # 额外出 HTML
/transfer-export --only md|json|html
/transfer-export --id <sessionId>   # 导任意历史会话（含装插件前的）
/transfer-export --last-turns 5     # 只导最近 5 轮
/transfer-export --out <目录>       # 覆盖默认落盘位置（吞掉行内剩余，flag 写在前面）
/transfer-export --mask             # 脱敏（默认不脱敏：备份保真优先）
```

默认落盘 `~/.dsh/exports/dsh-transfer-export/`（`$DSH_HOME` 优先），文件名 `transfer-<id8>-<时间戳>.{json,md,html}`，同名自动 `-2` 后缀，原子写。

消息操作栏按钮：每条助手回复的操作栏末尾（"在新对话中创建分支"后面）有一个下载托盘图标，悬停提示"备份导出：JSON + Markdown"，点击按默认选项导出当前会话，浮动提示带回写路径。

## 安装

```bash
# npm（发布后可用）
dsh plugin --profile web add dsh-transfer-export

# 或从 GitHub
dsh plugin --profile web add github:vu345/dsh-transfer-export
```

桌面版：设置 → 插件，搜索 `dsh-transfer-export`。

本机开发安装（desktop profile 接线方式）见 [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md)。

## 导出语义

只导"用户真实看到过的表面事件"：真实用户输入（`source.kind==='user'`，注入类剔除并计数）、助手回复（text/reasoning/tool-call）、工具调用与结果（按 callId 配对，对不上按到达顺序收养，再不行记 orphan）、产出清单。reasoning 只进 JSON 层不进 MD 层。

## 文档

- [docs/STATUS.md](docs/STATUS.md) —— 当前状态（唯一"现在能做什么"）
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) —— 数据流与模块
- [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md) —— 测试、安装、回滚
- [CHANGELOG.md](CHANGELOG.md)

## 竞品定位（为什么自己写一个）

| | 本插件 | dsh-transcript-export | dsh-session-export | dsh-session-exporter |
|---|---|---|---|---|
| 默认输出 | **JSON+MD 双层** | 单格式自选 | 单命令单格式为主 | 单格式 |
| JSON 保真层 | ✅ 完整+schemaVersion | 有（带 schema） | 有 | JSONL |
| 默认脱敏 | **否**（备份保真） | 是 | 否（flag） | 是 |
| 落盘 | 集中 `~/.dsh/exports` | `~/.dsh/exports` | 会话 cwd | 指定路径 |
| 入口 | 命令+标题栏按钮 | 消息操作栏按钮 | 5 条命令 | 命令+工具 |
