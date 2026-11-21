import test from 'node:test';
import assert from 'node:assert/strict';
import { HELP_TEXT, parseArgs } from '../lib/parse.js';

test('parse: 空输入 = 默认双层', () => {
  assert.deepEqual(parseArgs(''), { only: null, html: false, id: null, lastTurns: null, out: null, mask: false, help: false });
  assert.deepEqual(parseArgs('   '), parseArgs(''));
});

test('parse: 组合 flag', () => {
  const a = parseArgs('--html --mask --last-turns 5 --id sess-ab12');
  assert.equal(a.html, true);
  assert.equal(a.mask, true);
  assert.equal(a.lastTurns, 5);
  assert.equal(a.id, 'sess-ab12');
});

test('parse: --only 取值并区分大小写宽容', () => {
  assert.equal(parseArgs('--only md').only, 'md');
  assert.equal(parseArgs('--only json').only, 'json');
});

test('parse: --out 吞掉行内剩余（支持空格路径）', () => {
  // 设计行为：--out 之后的全部 token 都是路径，flag 必须写在 --out 之前
  const a = parseArgs('--html --out D:\\my backup folder 2026');
  assert.equal(a.out, 'D:\\my backup folder 2026');
  assert.equal(a.html, true);
  const b = parseArgs('--out C:\\Program Files\\app --only md');
  assert.equal(b.out, 'C:\\Program Files\\app --only md');
  assert.equal(b.only, null, '--out 之后的 --only 属于路径');
});

test('parse: 非法输入抛错', () => {
  assert.throws(() => parseArgs('--what'), /无法识别的参数/);
  assert.throws(() => parseArgs('--last-turns 0'), /正整数/);
  assert.throws(() => parseArgs('--last-turns abc'), /正整数/);
  assert.throws(() => parseArgs('--id'), /缺少值/);
  assert.throws(() => parseArgs('--out'), /缺少值/);
});

test('parse: --help / -h', () => {
  assert.equal(parseArgs('--help').help, true);
  assert.equal(parseArgs('-h').help, true);
  assert.match(HELP_TEXT, /--last-turns/);
});
