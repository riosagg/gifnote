/*
 * Copyright (C) 2026 riosagg
 * SPDX-License-Identifier: GPL-2.0-or-later
 * This file is part of GIFnote and is licensed under GNU GPL version 2
 * or (at your option) any later version, WITHOUT ANY WARRANTY.
 * See the root LICENSE and COPYRIGHT files for details.
 */
import { readFile, readdir, lstat, mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { gzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import { readTarGz } from './tar-reader.mjs';

// Explicit roots: never package caches, credentials, test media or generated output.
export async function appSourceFiles(root) {
  const files = new Map();
  async function add(path, destination = path) {
    const info = await lstat(resolve(root, path));
    if (info.isSymbolicLink()) throw Error(`Source symlink not allowed: ${path}`);
    if (info.isDirectory()) {
      for (const name of (await readdir(resolve(root, path))).sort()) await add(`${path}/${name}`, `${destination}/${name}`);
    } else {
      files.set(destination, await readFile(resolve(root, path)));
    }
  }
  for (const path of ['LICENSE', 'COPYRIGHT', 'README.md', 'THIRD_PARTY_NOTICES.md', 'package.json', 'package-lock.json', 'tsconfig.json', 'vite.config.ts', 'index.html', '.gitignore', '.gitattributes', '.npmrc', 'src', 'scripts', 'public/favicon.svg', 'public/info.css', 'public/disclaimer', 'public/privacy', 'licenses']) await add(path);
  for (const name of ['README.md', 'pins.json', 'archive-manifest.json', 'core-evidence.txt', 'release-evidence.json', 'download-sources.mjs', 'prepare_rebuild.py']) await add(`third_party_source/${name}`);
  for (const name of ['gifuct-js', 'js-binary-schema-parser']) {
    for (const entry of ['src', 'lib', 'LICENSE', 'package.json', 'README.md', '.babelrc', '.prettierrc']) await add(`node_modules/${name}/${entry}`, `dependency_source/${name}/${entry}`);
  }
  return new Map([...files].sort(([a], [b]) => a.localeCompare(b, 'en')));
}

// Portable, deterministic USTAR; no host usernames, paths or timestamps are stored.
function tar(files) {
  const chunks = [];
  for (const [path, bytes] of files) {
    const name = `gifnote/${path}`;
    if (Buffer.byteLength(name) > 100) throw Error(`USTAR path too long: ${name}`);
    const header = Buffer.alloc(512);
    header.write(name, 0, 100);
    const octal = (offset, length, value) => header.write(value.toString(8).padStart(length - 1, '0') + '\0', offset, length);
    octal(100, 8, 0o644); octal(108, 8, 0); octal(116, 8, 0);
    octal(124, 12, bytes.length); octal(136, 12, 0);
    header.fill(32, 148, 156); header.write('0', 156); header.write('ustar\0', 257); header.write('00', 263);
    const checksum = header.reduce((sum, value) => sum + value, 0);
    header.write(checksum.toString(8).padStart(6, '0') + '\0 ', 148, 8);
    chunks.push(header, bytes, Buffer.alloc((512 - bytes.length % 512) % 512));
  }
  return Buffer.concat([...chunks, Buffer.alloc(1024)]);
}

const hash = bytes => createHash('sha256').update(bytes).digest('hex');
export async function prepareAppSource(root) {
  const files = await appSourceFiles(root);
  const archive = gzipSync(tar(files), { level: 9 });
  const manifest = { archive: 'gifnote-source.tgz', sha256: hash(archive), files: [...files].map(([path, bytes]) => ({ path, sha256: hash(bytes) })) };
  await mkdir(resolve(root, 'public/source'), { recursive: true });
  await writeFile(resolve(root, 'public/source/gifnote-source.tgz'), archive);
  await writeFile(resolve(root, 'public/source/manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
}

export async function verifyAppSource(root) {
  const archive = await readFile(resolve(root, 'dist/source/gifnote-source.tgz'));
  const manifest = JSON.parse(await readFile(resolve(root, 'dist/source/manifest.json')));
  if (manifest.archive !== 'gifnote-source.tgz' || manifest.sha256 !== hash(archive)) throw Error('App source archive hash mismatch');
  const actual = readTarGz(archive);
  const expected = await appSourceFiles(root);
  if (actual.size !== expected.size || manifest.files.length !== expected.size) throw Error('App source file inventory mismatch');
  for (const [path, bytes] of expected) {
    if (!actual.get(path)?.equals(bytes) || manifest.files.find(item => item.path === path)?.sha256 !== hash(bytes)) throw Error(`App source differs: ${path}`);
  }
  console.log(`Verified application source: ${expected.size} files, ${archive.length} bytes.`);
}
