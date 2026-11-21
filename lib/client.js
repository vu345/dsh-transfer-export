// dsh-transfer-export 浏览器半：助手消息操作栏一键导出按钮。
// 由 DSH Loader 按 dsh.client.platform: "web" 约定挂载：
//   window.__ModuleLoader__.load({ id, factory })，factory 收到受控 require。
// 位置：conversation.chat.assistant-actions，排在"在新对话中创建分支"等既有按钮之后（order 90）。
// 一键 = 当前会话按默认选项导出（JSON+MD 落盘），结果用浮动提示展示；不做对话框。
// 图标：下载托盘（细线风格，currentColor，随主题）。

(function () {
  'use strict';

  var NS = 'dsh-transfer-export';
  var ROUTE = '/dsh-transfer-export';

  function factory(require) {
    var React = require('react');
    var jsx = require('react/jsx-runtime').jsx;
    var jsxs = require('react/jsx-runtime').jsxs;
    var useState = React.useState;

    var LOCALE = {
      zh: {
        hint: '备份导出：JSON + Markdown 写入 ~/.dsh/exports/dsh-transfer-export',
        busy: '导出中…',
        done: '已导出 {n} 个文件',
        failed: '导出失败',
        noSession: '拿不到当前会话 ID',
      },
      en: {
        hint: 'Backup export: JSON + Markdown into ~/.dsh/exports/dsh-transfer-export',
        busy: 'Exporting…',
        done: 'Exported {n} file(s)',
        failed: 'Export failed',
        noSession: 'No session id available',
      },
    };

    function tOf(dict, key, params) {
      var tpl = (dict && dict[key]) || key;
      return String(tpl).replace(/\{(\w+)\}/g, function (_, k) {
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
      return fetch(ROUTE + '/' + action, {
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

    // 下载托盘图标（细线，与操作栏既有图标一致；颜色走 currentColor）
    function TrayIcon() {
      return jsxs('svg', {
        width: 16,
        height: 16,
        viewBox: '0 0 24 24',
        fill: 'none',
        stroke: 'currentColor',
        strokeWidth: 1.8,
        strokeLinecap: 'round',
        strokeLinejoin: 'round',
        'aria-hidden': true,
        children: [
          jsx('path', { d: 'M12 4v10' }),
          jsx('path', { d: 'M8 10l4 4 4-4' }),
          jsx('path', { d: 'M4 15v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3' }),
        ],
      });
    }

    function ExportButton(props) {
      // 优先用宿主 slot 注入的 t（词典已按 NS 注册）；缺省回退到 apply 时决定的自带词典
      var t = props && typeof props.t === 'function'
        ? props.t
        : function (key, params) {
            return tOf((props && props.dict) || LOCALE.zh, key, params);
          };
      var busyState = useState(false);
      var busy = busyState[0];
      var setBusy = busyState[1];
      var hoverState = useState(false);
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

      return jsx('button', {
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
        children: jsx(TrayIcon, null),
      });
    }

    return {
      name: 'transfer-export',
      inject: ['slots', 'locale'],
      apply: function (ctx) {
        var lang;
        try {
          lang = ctx.locale && typeof ctx.locale.language === 'string' ? ctx.locale.language : 'zh';
        } catch (_e) {
          lang = 'zh';
        }
        var dict = LOCALE[lang] || LOCALE.zh;

        try {
          ctx.locale && ctx.locale.register && ctx.locale.register(NS, LOCALE);
        } catch (_e) {
          /* locale 注册失败不阻塞按钮 */
        }

        try {
          ctx.slots &&
            ctx.slots.inject &&
            ctx.slots.inject('conversation.chat.assistant-actions', function (api) {
              var register =
                (api && api.register) ||
                (ctx.slots && ctx.slots.register && ctx.slots.register.bind(ctx.slots));
              if (!register) return;
              register(
                { name: NS, id: 'transfer-export-message', order: 90, locale: NS },
                function (props) {
                  // assistant-actions 传 sessionId/messageId/t 等；dict 作为 t 缺省时的兜底
                  var merged = Object.assign({}, props || {}, { dict: dict });
                  return ExportButton(merged);
                },
              );
            });
        } catch (_e) {
          /* slots 不可用时按钮缺席，命令仍可用 */
        }
      },
    };
  }

  if (typeof window !== 'undefined' && window.__ModuleLoader__ && window.__ModuleLoader__.load) {
    window.__ModuleLoader__.load({ id: NS, factory: factory });
  } else if (typeof module !== 'undefined' && module.exports) {
    // Loader 不在（测试/静态检查）：导出工厂本身
    module.exports = { id: NS, factory: factory };
  }
})();
