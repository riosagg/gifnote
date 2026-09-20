/*
 * Copyright (C) 2026 riosagg
 * SPDX-License-Identifier: GPL-2.0-or-later
 * This file is part of GIFnote and is licensed under GNU GPL version 2
 * or (at your option) any later version, WITHOUT ANY WARRANTY.
 * See the root LICENSE and COPYRIGHT files for details.
 */
// Explicit maintenance command. Normal install/dev/build must not use the network.
import { mkdir, readFile, writeFile, access } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const pins = JSON.parse(await readFile(resolve(root, 'third_party_source/pins.json'), 'utf8'));
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const previous = JSON.parse(await readFile(resolve(root, 'third_party_source/archive-manifest.json'), 'utf8').catch(error => {
  if (error.code !== 'ENOENT') throw error;
  return '{"archives":[]}';
}));
await mkdir(resolve(root, 'third_party_source/archives'), { recursive: true });
const output = [];
async function fetchSource(source) {
  const filename = `${source.id}-${source.commit}.tgz`;
  const path = resolve(root, 'third_party_source/archives', filename);
  const url = `https://codeload.github.com/${source.repo}/tar.gz/${source.commit}`;
  let bytes;
  try { await access(path); bytes = await readFile(path); }
  catch {
    const response = await fetch(url, { signal: AbortSignal.timeout(180_000) });
    if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`);
    bytes = Buffer.from(await response.arrayBuffer());
    if (bytes[0] !== 0x1f || bytes[1] !== 0x8b) throw new Error(`Not gzip: ${url}`);
    await writeFile(path, bytes);
  }
  const expected = previous.archives.find(entry => entry.id === source.id && entry.commit === source.commit);
  if (expected && sha256(bytes) !== expected.sha256) throw new Error(`Archive hash changed: ${source.id}. Investigate; do not silently replace the manifest.`);
  output.push({ id: source.id, repo: source.repo, commit: source.commit, archive: `archives/${filename}`, url, size: bytes.length, sha256: sha256(bytes) });
  console.log(`${source.id}: ${(bytes.length / 1_000_000).toFixed(2)} MB`);
}
// Bounded parallel downloads, all files remain inside this project.
for (let i = 0; i < pins.sources.length; i += 3) await Promise.all(pins.sources.slice(i, i + 3).map(fetchSource));
output.sort((a, b) => a.id.localeCompare(b.id));
await writeFile(resolve(root, 'third_party_source/archive-manifest.json'), JSON.stringify({ schemaVersion: 1, archives: output }, null, 2) + '\n');
console.log('Source archives downloaded; review and verify before changing the pinned manifest.');
