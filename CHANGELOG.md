# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## Unreleased

### Added

- `/transfer-export` 命令：默认 JSON 保真 + Markdown 阅读双层导出；`--html`/`--only`/`--id`/`--last-turns`/`--out`/`--mask`。
- 事件归一化层：表面事件过滤、注入剔除计数、工具 result 三级配对（callId → 顺序收养 → orphan）、deliverables 追加/自建容器。
- 单文件 HTML 可选输出：转义优先、TOC、明暗自适应、打印样式。
- `--mask` 脱敏：key/token 形态、kv 赋值、DSN、PEM。
- 标题栏导出按钮（浏览器半）+ `POST /dsh-transfer-export/{ping,export}` 路由（同源栅栏、4MB 上限、路由侧禁 out）。
- 原子写 + 防覆盖命名；默认落盘 `~/.dsh/exports/dsh-transfer-export/`。
- 55 项 node:test 单测（fake ctx + 合成事件，零网络）。
