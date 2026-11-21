import test from 'node:test';
import assert from 'node:assert/strict';
import { maskDoc, maskString } from '../lib/mask.js';

test('mask: 常见 key/token 形态全部命中', () => {
  const samples = {
    'openai-like': 'sk-proj-abc123def456ghi789',
    'openai-like2': 'sk-ant-api03-xxxx-xxxx-xxxx',
    'github-app-token': 'ghp_0123456789abcdefghijklmnopqrst',
    'gitlab': 'glpat-0123456789abcdef',
    'slack': 'xoxb-123456789012-abcdef',
    'aws': 'AKIAIOSFODNN7EXAMPLE',
    'google': 'AIzaSyA1234567890abcdefghijklmnopqrstuv',
    'stripe': 'sk_live_0123456789abcdef',
    'bearer': 'Bearer abc123def456ghi',
    'dsn': 'postgres://admin:s3cret@db.example.com:5432/app',
  };
  for (const [k, v] of Object.entries(samples)) {
    const out = maskString(v);
    assert.match(out, /\[REDACTED:/, `${k} 应被遮蔽`);
    assert.ok(!out.includes(v), `${k} 原文不应残留`);
  }
});

test('mask: JWT 与 PEM 私钥整块替换', () => {
  const jwt = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjMifQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';
  assert.equal(maskString(`token ${jwt} end`), 'token [REDACTED:jwt] end');

  const pem = '-----BEGIN RSA PRIVATE KEY-----\nabc\ndef\n-----END RSA PRIVATE KEY-----';
  assert.equal(maskString(pem), '[REDACTED:pem]');
});

test('mask: password=/api_key= 赋值形态', () => {
  assert.equal(maskString('password=hunter2secret'), '[REDACTED:kv-assign]');
  assert.equal(maskString('API_KEY: "abcd1234efgh"'), '[REDACTED:kv-assign]');
});

test('mask: 普通文本原样保留', () => {
  const plain = '这个会话讨论了 dsh-transfer-export 的 JSON 保真层设计，token 消耗为零。';
  assert.equal(maskString(plain), plain);
  assert.equal(maskString(''), '');
  assert.equal(maskString(undefined), undefined);
});

test('maskDoc: 深拷贝脱敏，原 doc 不被修改', () => {
  const doc = {
    meta: { title: '标题', counts: {} },
    messages: [
      { id: 'u1', role: 'user', turn: 0, time: 0, blocks: [{ kind: 'text', text: 'key 是 sk-abcdefghijklmnop1234' }] },
    ],
  };
  const masked = maskDoc(doc);
  assert.match(masked.messages[0].blocks[0].text, /\[REDACTED:openai-like\]/);
  assert.match(masked.meta.title, /标题/);
  assert.ok(masked.meta.masked === true);
  assert.equal(doc.messages[0].blocks[0].text, 'key 是 sk-abcdefghijklmnop1234', '原对象不变');
});
