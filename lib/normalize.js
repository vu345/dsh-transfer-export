// 事件流 → 归一化转录（纯函数）。
//
// 事件形状按实测契约（dsh-transcript-export 0.2.0 与 dsh-session-export 1.11.0 一致）：
//   { type, time?, seq?, data? }
// 字段取值全部走多路径回退，避免宿主版本差异导致丢内容。
// 只保留"用户可见表面事件"；注入类（runtime context / recitation 等）剔除并计数。

const GENERATOR = 'dsh-transfer-export/0.1.0';

// kind==='user' 但没有 rpcId、且正文以这些前缀开头 → 判为注入（插件 push 的 recitation 等）。
// 没有 rpcId 字段时只靠文本特征兜底：宁可多留，不能丢用户真实输入。
const INJECTION_TEXT_PREFIXES = [
  '<system-reminder>',
  '[STATE v',
  'Current runtime context',
  '<runtime-context>',
];

function emptyCounts() {
  return {
    user: 0,
    assistant: 0,
    toolCalls: 0,
    toolResults: 0,
    deliverables: 0,
    droppedInjections: 0,
    droppedEvents: 0,
  };
}

function stringifyArgs(v) {
  if (v === undefined || v === null) return '';
  if (typeof v === 'string') return v;
  try {
    return JSON.stringify(v, null, 2);
  } catch {
    return String(v);
  }
}

// 工具结果正文：兼容 string / 块数组 / { text } 对象。
function resultText(v) {
  if (typeof v === 'string') return v;
  if (Array.isArray(v)) {
    const parts = [];
    for (const item of v) {
      if (typeof item === 'string') parts.push(item);
      else if (typeof item?.text === 'string') parts.push(item.text);
    }
    return parts.join('\n');
  }
  if (typeof v?.text === 'string') return v.text;
  return '';
}

function userBlocks(content) {
  const out = [];
  if (!Array.isArray(content)) return out;
  for (const item of content) {
    if (item?.type === 'image') {
      const p = item.source?.path ?? item.path;
      if (typeof p === 'string' && p) out.push({ kind: 'file', path: p, description: '图片' });
    } else if (typeof item?.text === 'string' && item.text.trim()) {
      out.push({ kind: 'text', text: item.text });
    }
  }
  return out;
}

export function normalizeTranscript(input = {}) {
  const sessionId = String(input.sessionId ?? 'session');
  const doc = {
    meta: {
      schemaVersion: 1,
      generator: GENERATOR,
      sessionId,
      title: typeof input.title === 'string' ? input.title : '',
      cwd: '',
      createdAt: null,
      exportedAt: Number.isFinite(input.now) ? input.now : 0,
      masked: false,
      sliced: false,
      counts: emptyCounts(),
    },
    messages: [],
  };
  const counts = doc.meta.counts;
  const events = Array.isArray(input.events) ? input.events : [];
  let turn = 0;
  let seq = 0;
  // callId → tool-call block（等待 result 配对）
  const pending = new Map();

  const push = (role, id, blocks, time) => {
    const message = {
      id: String(id),
      role,
      turn,
      time,
      blocks,
    };
    doc.messages.push(message);
    return message;
  };

  for (const ev of events) {
    seq += 1;
    const type = ev?.type;
    const data = ev?.data ?? {};
    const time = Number.isFinite(ev?.time) ? ev.time : 0;
    const evSeq = Number.isFinite(ev?.seq) ? ev.seq : seq;

    switch (type) {
      case 'session': {
        if (typeof data.cwd === 'string' && data.cwd) doc.meta.cwd = data.cwd;
        if (Number.isFinite(data.createdAt)) doc.meta.createdAt = data.createdAt;
        break;
      }
      case 'session/title': {
        const t = typeof data.title === 'string' ? data.title.trim() : '';
        if (t) doc.meta.title = t;
        break;
      }
      case 'turn/start': {
        if (Number.isFinite(data.turn) && data.turn > turn) turn = data.turn;
        break;
      }
      case 'user/message': {
        const src = data.source?.kind ?? data.message?.source?.kind;
        if (src !== undefined && src !== 'user') {
          counts.droppedInjections += 1;
          break;
        }
        const blocks = userBlocks(data.content);
        if (!blocks.length) {
          counts.droppedEvents += 1;
          break;
        }
        const rpcId = data.rpcId ?? data.source?.rpcId ?? data.message?.rpcId;
        if (!rpcId) {
          const firstText = blocks.find((b) => b.kind === 'text')?.text ?? '';
          if (INJECTION_TEXT_PREFIXES.some((p) => firstText.startsWith(p))) {
            counts.droppedInjections += 1;
            break;
          }
        }
        if (Number.isFinite(data.turn) && data.turn > turn) turn = data.turn;
        push('user', data.id ?? `user-${evSeq}`, blocks, time);
        counts.user += 1;
        break;
      }
      case 'assistant/message': {
        const msg = data.message ?? {};
        const content = Array.isArray(msg.content) ? msg.content : [];
        const blocks = [];
        for (const item of content) {
          if (item?.type === 'text' && typeof item.text === 'string' && item.text.trim()) {
            blocks.push({ kind: 'text', text: item.text });
          } else if (item?.type === 'reasoning') {
            const t = item.reasoning ?? item.text ?? item.summary;
            if (typeof t === 'string' && t.trim()) blocks.push({ kind: 'reasoning', text: t });
          } else if (item?.type === 'tool-call') {
            const callId = String(item.callId ?? item.id ?? `call-${evSeq}-${blocks.length}`);
            const block = {
              kind: 'tool-call',
              callId,
              name: item.name ?? item.toolName ?? 'tool',
              args: stringifyArgs(item.arguments ?? item.argsRaw ?? item.args),
              result: undefined,
              status: 'unknown',
            };
            blocks.push(block);
            counts.toolCalls += 1;
            if (!pending.has(callId)) pending.set(callId, block);
          }
        }
        if (Number.isFinite(data.turn) && data.turn > turn) turn = data.turn;
        if (!blocks.length) {
          counts.droppedEvents += 1;
          break;
        }
        push('assistant', msg.id ?? `assistant-${evSeq}`, blocks, time);
        counts.assistant += 1;
        break;
      }
      case 'tool/call': {
        const callId = String(data.callId ?? data.id ?? `call-${evSeq}`);
        if (pending.has(callId)) break;
        const block = {
          kind: 'tool-call',
          callId,
          name: data.name ?? data.toolName ?? 'tool',
          args: stringifyArgs(data.arguments ?? data.argsRaw ?? data.args),
          result: undefined,
          status: 'unknown',
        };
        counts.toolCalls += 1;
        pending.set(callId, block);
        // 没有宿主消息可挂的独立 tool/call：自建 tool 容器消息，等 result 回填
        push('tool', `tool-call-${evSeq}`, [block], time);
        break;
      }
      case 'tool/result': {
        const callId = String(data.toolCallId ?? data.callId ?? data.id ?? '');
        const isError = data.isError === true || data.status === 'error' || data.outcome === 'error';
        const text = resultText(data.content ?? data.message?.content ?? data.result);
        counts.toolResults += 1;
        let block = pending.get(callId);
        if (!block) {
          // callId 对不上：按到达顺序收养第一个还没有 result 的挂起调用
          for (const [key, b] of pending) {
            if (b.result === undefined) {
              block = b;
              pending.delete(key);
              break;
            }
          }
        } else {
          pending.delete(callId);
        }
        if (block) {
          block.result = text;
          block.status = isError ? 'error' : 'ok';
        } else if (text) {
          counts.toolCalls += 1;
          push(
            'tool',
            `tool-orphan-${evSeq}`,
            [
              {
                kind: 'tool-call',
                callId: callId || `call-${evSeq}`,
                name: data.name ?? data.toolName ?? 'tool',
                args: '',
                result: text,
                status: isError ? 'error' : 'ok',
              },
            ],
            time,
          );
        }
        break;
      }
      case 'deliverables/presented': {
        const files = Array.isArray(data.files) ? data.files : [];
        const blocks = [];
        for (const f of files) {
          const p = typeof f?.path === 'string' ? f.path : typeof f === 'string' ? f : '';
          if (!p) continue;
          blocks.push({
            kind: 'file',
            path: p,
            description: typeof f?.description === 'string' ? f.description : '',
          });
          counts.deliverables += 1;
        }
        if (!blocks.length) break;
        const last = doc.messages[doc.messages.length - 1];
        if (last && last.role === 'assistant') last.blocks.push(...blocks);
        else {
          counts.assistant += 1;
          push('assistant', `deliverables-${evSeq}`, blocks, time);
        }
        break;
      }
      default:
        counts.droppedEvents += 1;
        break;
    }
  }

  return doc;
}

// 只保留最近 n 个不同轮次的消息（用于 --last-turns）。counts 保持全量口径。
export function sliceTurns(doc, n) {
  const turns = [...new Set(doc.messages.map((m) => m.turn))];
  const keep = new Set(turns.slice(Math.max(0, turns.length - n)));
  return {
    ...doc,
    meta: {
      ...doc.meta,
      sliced: true,
      turnsKept: [...keep],
    },
    messages: doc.messages.filter((m) => keep.has(m.turn)),
  };
}
