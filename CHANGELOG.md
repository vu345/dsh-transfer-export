# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## Unreleased

### Added

- `/transfer-export` 命令：默认 JSON 保真 + Markdown 阅读双层导出；`--html`/`--only`/`--id`/`--last-turns`/`--out`/`--mask`。
- 事件归一化层：表面事件过滤、注入剔除计数、工具 result 三级配对（callId → 顺序收养 → orphan）、deliverables 追加/自建容器。
- 单文件 HTML 可选输出：转义优先、TOC、明暗自适应、打印样式。
- `--mask` 脱敏：key/token 形态、kv 赋值、DSN、PEM。
- 消息操作栏导出按钮（下载托盘细线图标，位于"在新对话中创建分支"后）+ `POST /dsh-transfer-export/{ping,export}` 路由（同源栅栏、4MB 上限、路由侧禁 out）。
- 原子写 + 防覆盖命名；默认落盘 `~/.dsh/exports/dsh-transfer-export/`。
- 55 项 node:test 单测（fake ctx + 合成事件，零网络）；GitHub Actions Node 20/22 CI。
- 发布准备：MIT LICENSE、双语 README、publishConfig/repository 元数据。

### Fixed

- MD 层不再输出 `<!-- turn N -->` HTML 注释；轮次开始时间并入标题（`## 第 N 轮 · 时间`）。
- 文件名 id8：会话 ID 以 `session-` 开头时剥掉前缀再取 8 位，避免 `transfer-session--…` 双横线。
- 测试脚本去掉 `--test-isolation=none`（CI 的 Node 20/22 不支持该选项）。
