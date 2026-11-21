# DEVELOPMENT · dsh-transfer-export

## 环境要求

- Node >= 20（本机用 DSH 自带 runtime node 24 或系统 node 均可）。
- 零 npm 依赖：不装任何包，测试直接跑。

## 测试

```powershell
cd C:\coding\dsh-transfer-export
npm test          # node --test（55 用例，<1s，零网络；Node 20/22/24 通用，CI 同款）
npm run test:watch
```

> 注意：不要加 `--test-isolation=none`（本地 node 24 支持，但 CI 的 Node 20/22 报 bad option）。

测试全部用 fake ctx + 合成事件，不启动 DSH 运行时；临时目录走 `os.tmpdir()`。

## 语法/结构自检（无 lint 配置时的最低检查）

```powershell
node --check lib/index.js    # 逐文件语法检查（可对 lib/*.js 全部执行）
```

## 安装到 desktop profile（本机）

> 改 profile 前先备份；回滚见文末。

```powershell
$profile = "$env:USERPROFILE\.dsh\profiles\desktop"
Copy-Item "$profile\package.json" "$profile\package.json.bak-$(Get-Date -Format yyyyMMdd-HHmmss)"

# 1. package.json 两处接线（手工编辑）：
#    dependencies 加  "dsh-transfer-export": "file:C:/coding/dsh-transfer-export"
#    dsh.profile.bundles 数组加  "dsh-transfer-export"
# 2. 安装依赖
pnpm install --dir $profile
# 3. 重启 DSH（bundle patch 与路由在重启后生效）
# 4. 刷新页面（F5）——浏览器半（标题栏按钮）由 Loader 挂载
```

## 冒烟清单（重启后逐项验证）

1. 任意会话输入 `/transfer-export` → 返回"已导出 2 个文件 + 路径 + 统计行"。
2. 打开 JSON：可 parse，`meta.counts` 与返回统计一致。
3. 打开 MD：轮次标题、工具折叠正常；无 `<system-reminder>` 注入正文。
4. `/transfer-export --html` → HTML 双击离线可开，明暗主题跟随系统。
5. 标题栏"导出"按钮可见 → 点击 → toast 显示路径。
6. `/transfer-export --id <老会话ID>` → 能导装插件前的会话。
7. 与 session-digest 抽查一个会话：digest 用户消息条数 vs 导出 `counts.user` 一致（注入口径差异需解释）。
8. 同一秒连跑两次 → 第二批文件带 `-2` 后缀。

## 回滚

```powershell
$profile = "$env:USERPROFILE\.dsh\profiles\desktop"
Copy-Item "$profile\package.json.bak-<时间>" "$profile\package.json" -Force
pnpm install --dir $profile    # 移除依赖后重装（或手工删 dependencies 行）
# 重启 DSH
```

## 已知坑（本机环境）

- 沙箱进程做不了 TLS、`app.asar` 是文件不是目录——本插件与这两者无关，但调试 DSH 内核行为时别踩。
- 改 profile 接线后**旧会话仍用旧实例**，必须重启 DSH。
- `pnpm install --dir` 若报 lock 不一致，先看 `pnpm-lock.yaml` 是否被别的安装动过。

## 不要提交/不要入库

- `node_modules/`、`*.tgz`（npm pack 产物）、`.test-out/`。
- 导出的会话内容（含患者/密钥数据）不进任何文档或测试夹具——测试用合成事件。
