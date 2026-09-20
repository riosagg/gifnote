/*
 * Copyright (C) 2026 riosagg
 * SPDX-License-Identifier: GPL-2.0-or-later
 * This file is part of GIFnote and is licensed under GNU GPL version 2
 * or (at your option) any later version, WITHOUT ANY WARRANTY.
 * See the root LICENSE and COPYRIGHT files for details.
 */
// Node.js >=22.12. Save this file locally, then:
// node download-sources.mjs https://YOUR-SITE/PATH/third_party_source/
// Downloads stay alongside this script; existing different files are never overwritten.
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const base = new URL(process.argv[2] || '');
if (!['http:', 'https:'].includes(base.protocol) || !base.pathname.endsWith('/')) throw Error('Pass the full third_party_source/ URL ending with /');
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
async function get(path) {
  const response = await fetch(new URL(path, base), { signal: AbortSignal.timeout(180_000) });
  if (!response.ok) throw Error(`${path}: HTTP ${response.status}`);
  return Buffer.from(await response.arrayBuffer());
}
async function save(path, bytes) {
  const destination = new URL(path, import.meta.url);
  try {
    if (!bytes.equals(await readFile(destination))) throw Error(`Existing file differs: ${path}`);
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
    await writeFile(destination, bytes, { flag: 'wx' });
  }
}
const manifestBytes = await get('archive-manifest.json');
const manifest = JSON.parse(manifestBytes);
await mkdir(new URL('archives/', import.meta.url), { recursive: true });
for (const entry of manifest.archives) {
  if (!/^archives\/[a-z0-9-]+-[a-f0-9]{40}\.tgz$/.test(entry.archive) || !/^[a-f0-9]{64}$/.test(entry.sha256)) throw Error('Invalid archive manifest');
  const bytes = await get(entry.archive);
  if (bytes.length !== entry.size || hash(bytes) !== entry.sha256) throw Error(`Hash mismatch: ${entry.archive}`);
  await save(entry.archive, bytes);
  console.log(`Verified ${entry.id}`);
}
await save('archive-manifest.json', manifestBytes);
for (const file of ['pins.json', 'README.md', 'core-evidence.txt', 'release-evidence.json', 'prepare_rebuild.py']) await save(file, await get(file));
console.log('All source archives and build instructions downloaded and verified.');
