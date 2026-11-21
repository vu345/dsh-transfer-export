# AGENTS.md · dsh-transfer-export

> 作用域：本目录。父级 `C:\coding\AGENTS.md` 仍然适用。
> DSH 会话备份导出插件（纯 JS ESM、零 npm 依赖、零构建）。

## 先读

1. [docs/STATUS.md](docs/STATUS.md) —— 唯一"当前"：已实现/未实现/限制。
2. [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) —— 数据流与模块边界，改代码前先读。
3. [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md) —— 测试/安装/回滚命令。

## 命令

```powershell
cd C:\coding\dsh-transfer-export
npm test        # node --test --test-isolation=none，55 用例，零网络零运行时
```

## 结构

```
lib/index.js      host 入口（cordis name/inject/apply；命令+路由注册）
lib/core.js       runExport 导出核心（命令与路由共用）
lib/normalize.js  事件流→归一化转录（纯函数，注入剔除与计数）
lib/render-*.js   json 保真 / md 阅读 / html 分发 三渲染层
lib/parse.js      /transfer-export 参数解析（--out 吞行内剩余）
lib/routes.js     POST /dsh-transfer-export/{ping,export}（同源栅栏+4MB 上限）
lib/client.js     浏览器半（标题栏按钮，ModuleLoader 工厂，React jsx）
lib/mask.js       --mask 脱敏规则
lib/write.js      原子写/防覆盖命名/默认目录
test/             node:test，fake ctx + 合成事件，绝不联网
```

## 规则

- 改 `lib/` 必须补/改 `test/` 对应用例；测试全绿才算完成。
- 零 npm 运行时依赖是硬约束；v2 docx 走 `FORMAT_RENDERERS` 注册缝 + 动态 import，不进常驻依赖。
- 事件字段取值必须多路径回退宽容处理（宿主版本差异），改 normalize 前先读 ARCHITECTURE 的契约小节。
- 路由侧不允许指定导出目录（防任意路径写）；同源栅栏与 4MB 上限不可拆。
- MD/HTML 层工具输出截断注明截断字符数；JSON 保真层永不截断（--mask 除外）。
- 默认不脱敏（备份保真优先）是有意决策，别"顺手"改成默认开。

## 改什么要更新什么

| 改动 | 更新 |
|---|---|
| 命令 flag / 行为 | README 用法段 + docs/DEVELOPMENT + CHANGELOG |
| 数据流 / 模块边界 | docs/ARCHITECTURE + docs/STATUS |
| 市场可用性 / 安装方式 | docs/DEVELOPMENT + README 安装段 |

## 回滚

- profile 接线：`~/.dsh/profiles/desktop/cordis.patch.yml.bak-<时间>`、`package.json.bak-<时间>` 就地还原，重启 DSH。
- 代码：本目录 git commit 即备份（初始化 git 后）。
