import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { atomicWriteFile, defaultExportDir, freeName, stampFor } from '../lib/write.js';

test('write: stampFor 是本地时间戳格式', () => {
  assert.match(stampFor(0), /^\d{8}T\d{6}$/);
});

test('write: freeName 撞名自动 -2 后缀', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'dte-write-'));
  try {
    const first = await freeName(dir, 'transfer-ab12-20261121T120000.json');
    assert.equal(first, 'transfer-ab12-20261121T120000.json');
    await atomicWriteFile(path.join(dir, first), 'x');
    const second = await freeName(dir, 'transfer-ab12-20261121T120000.json');
    assert.equal(second, 'transfer-ab12-20261121T120000-2.json');
    await atomicWriteFile(path.join(dir, second), 'y');
    const third = await freeName(dir, 'transfer-ab12-20261121T120000.json');
    assert.equal(third, 'transfer-ab12-20261121T120000-3.json');
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('write: atomicWriteFile 原子落盘且无 tmp 残留', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'dte-write-'));
  try {
    const target = path.join(dir, 'nested', 'out.md');
    await atomicWriteFile(target, '# hi');
    assert.equal(await readFile(target, 'utf8'), '# hi');
    const entries = await (await import('node:fs/promises')).readdir(path.join(dir, 'nested'));
    assert.deepEqual(entries, ['out.md'], '不应残留 .tmp 文件');
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test('write: defaultExportDir 含 exports/dsh-transfer-export 段', () => {
  const dir = defaultExportDir();
  assert.ok(dir.includes('exports'), dir);
  assert.ok(dir.endsWith('dsh-transfer-export'), dir);
});
