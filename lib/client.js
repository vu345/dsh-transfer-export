// dsh-transfer-export 浏览器半：一键导出按钮。
// 由 DSH Loader 按 dsh.client.platform: "web" 约定挂载：
//   window.__ModuleLoader__.load({ id, factory })，factory 收到受控 require（平台模块表）。
// 挂载契约按本机实测可用的 @liuguangzhe/dsh-token-usage 对齐：
//   - client inject 只声明 ['slots']（未知服务名会让插件永久 pending）
//   - 渲染用 React.createElement（不依赖 jsx-runtime）
//   - slot 描述符不带 locale 字段
// 一键 = 当前会话按默认选项导出（JSON+MD 落盘），结果用浮动提示展示；不做对话框。

(function () {
  'use strict';

  var NS = 'dsh-transfer-export';

  function factory(require) {
    var React = require('react');
    var h = React.createElement;

    var STR = {
      hint: '备份导出：JSON + Markdown 写入 ~/.dsh/exports/dsh-transfer-export',
      busy: '导出中…',
      done: '已导出 {n} 个文件',
      failed: '导出失败',
      noSession: '拿不到当前会话 ID',
    };

    function t(key, params) {
      return String(STR[key] || key).replace(/\{(\w+)\}/g, function (_, k) {
        return params && params[k] !== undefined ? String(params[k]) : '{' + k + '}';
      });
    }

    function showToast(text, ok) {
      try {
        var el = document.createElement('div');
        el.textContent = text;
        el.style.cssText =
          'position:fixed;right:20px;bottom:24px;z-index:99999;max-width:460px;' +
          'padding:10px 14px;border-radius:10px;font-size:13px;line-height:1.5;' +
          'white-space:pre-wrap;word-break:break-all;box-shadow:0 8px 24px #0004;' +
          'color:#fff;background:' + (ok ? '#16a34a' : '#dc2626') + ';';
        document.body.appendChild(el);
        setTimeout(function () {
          el.remove();
        }, ok ? 7000 : 10000);
      } catch (_e) {
        /* 无 DOM 时静默（不应发生在 Web GUI） */
      }
    }

    function callHost(action, body) {
      return fetch('/dsh-transfer-export/' + action, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body || {}),
      }).then(function (res) {
        if (!res.ok) throw new Error('route ' + res.status);
        return res.json();
      }).then(function (data) {
        if (data && data.ok === false) throw new Error(String(data.error || 'export failed'));
        return data;
      }, function () {
        throw new Error('unreachable');
      });
    }

    // 下载托盘图标（细线，currentColor 随主题）
    function TrayIcon() {
      return h(
        'svg',
        {
          width: 16,
          height: 16,
          viewBox: '0 0 24 24',
          fill: 'none',
          stroke: 'currentColor',
          strokeWidth: 1.8,
          strokeLinecap: 'round',
          strokeLinejoin: 'round',
          'aria-hidden': 'true',
        },
        h('path', { d: 'M12 4v10' }),
        h('path', { d: 'M8 10l4 4 4-4' }),
        h('path', { d: 'M4 15v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3' }),
      );
    }

    function ExportButton(props) {
      var busyState = React.useState(false);
      var busy = busyState[0];
      var setBusy = busyState[1];
      var hoverState = React.useState(false);
      var hover = hoverState[0];
      var setHover = hoverState[1];

      function onClick(ev) {
        ev.preventDefault();
        ev.stopPropagation();
        if (busy) return;
        var sessionId = props && props.sessionId;
        if (!sessionId) {
          showToast(t('noSession'), false);
          return;
        }
        setBusy(true);
        callHost('export', { sessionId: sessionId })
          .then(function (r) {
            var files = (r && r.files) || [];
            var lines = [t('done', { n: files.length })];
            for (var i = 0; i < files.length; i += 1) lines.push(files[i].path);
            if (r && r.stats) lines.push(r.stats);
            showToast(lines.join('\n'), true);
          })
          .catch(function (e) {
            showToast(t('failed') + '：' + String(e.message || e), false);
          })
          .then(function () {
            setBusy(false);
          });
      }

      return h(
        'button',
        {
          onClick: onClick,
          onMouseEnter: function () {
            setHover(true);
          },
          onMouseLeave: function () {
            setHover(false);
          },
          title: busy ? t('busy') : t('hint'),
          'aria-label': t('hint'),
          disabled: busy,
          style: {
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 26,
            height: 26,
            padding: 0,
            border: 'none',
            background: 'transparent',
            color: 'inherit',
            borderRadius: 6,
            cursor: busy ? 'wait' : 'pointer',
            opacity: busy ? 0.4 : hover ? 1 : 0.65,
          },
        },
        h(TrayIcon, null),
      );
    }

    // renderFn：slot 装配器调 (owner) => 元素；owner 携带会话/消息上下文
    function renderExportButton(owner) {
      return h(ExportButton, owner || {});
    }

    function apply(ctx) {
      // 消息操作栏（用户指定位置：分支按钮后面，order 拉高排末尾）
      try {
        ctx.slots &&
          ctx.slots.inject &&
          ctx.slots.inject('conversation.chat.assistant-actions', function () {
            if (ctx.slots.register) {
              return ctx.slots.register(
                { name: 'conversation.chat.assistant-actions', id: 'transfer-export-message', order: 90 },
                renderExportButton,
              );
            }
            return undefined;
          });
      } catch (_e) {
        /* slots 不可用时按钮缺席，命令仍可用 */
      }

      // 标题栏（备用入口；确认主位置可用后可移除）
      try {
        ctx.slots &&
          ctx.slots.inject &&
          ctx.slots.inject('conversation.session.header.actions', function () {
            if (ctx.slots.register) {
              return ctx.slots.register(
                { name: 'conversation.session.header.actions', id: 'transfer-export-header', order: 90 },
                renderExportButton,
              );
            }
            return undefined;
          });
      } catch (_e) {
        /* 同上 */
      }
    }

    return { name: 'transfer-export', inject: ['slots'], apply: apply };
  }

  if (typeof window !== 'undefined' && window.__ModuleLoader__ && window.__ModuleLoader__.load) {
    window.__ModuleLoader__.load({ id: NS, factory: factory });
  }
})();
