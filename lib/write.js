// 落盘：默认导出目录、时间戳文件名、防覆盖命名、原子写（tmp + rename）。

import { mkdir, rename, stat, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

export function defaultExportDir() {
  const home = process.env.DSH_HOME || path.join(os.homedir(), '.dsh');
  return path.join(home, 'exports', 'dsh-transfer-export');
}

// 本地时间戳：20261121T143005
export function stampFor(now = Date.now()) {
  const d = new Date(now);
  const p = (x) => String(x).padStart(2, '0');
  return (
    `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}` +
    `T${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`
  );
}

function withSuffix(base, n) {
  const dot = base.lastIndexOf('.');
  if (dot <= 0) return `${base}-${n}`;
  return `${base.slice(0, dot)}-${n}${base.slice(dot)}`;
}

// dir 下找第一个不存在的名字；50 次撞车后退化为时间戳后缀（防极端同秒并发）。
export async function freeName(dir, base) {
  for (let i = 1; i <= 50; i += 1) {
    const name = i === 1 ? base : withSuffix(base, i);
    try {
      await stat(path.join(dir, name));
    } catch (e) {
      if (e.code === 'ENOENT') return name;
      throw e;
    }
  }
  return withSuffix(base, `t${Date.now()}`);
}

export async function atomicWriteFile(filePath, data) {
  const dir = path.dirname(filePath);
  await mkdir(dir, { recursive: true });
  const tmp = path.join(
    dir,
    `.${path.basename(filePath)}.tmp-${process.pid}-${Math.random().toString(36).slice(2, 8)}`,
  );
  await writeFile(tmp, data);
  await rename(tmp, filePath);
  return filePath;
}
