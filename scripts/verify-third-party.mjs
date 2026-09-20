/*
 * Copyright (C) 2026 riosagg
 * SPDX-License-Identifier: GPL-2.0-or-later
 * This file is part of GIFnote and is licensed under GNU GPL version 2
 * or (at your option) any later version, WITHOUT ANY WARRANTY.
 * See the root LICENSE and COPYRIGHT files for details.
 */
import { readFile, stat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { publicNotices } from './public-links.mjs';
import { verifyPublicLinks } from './verify-public-links.mjs';
import { verifyAppSource } from './app-source.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const read = path => readFile(resolve(root, path));
const json = async path => JSON.parse(await read(path));
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const manifest = await json('licenses/manifest.json');
const archives = (await json('third_party_source/archive-manifest.json')).archives;
const pins = await json('third_party_source/pins.json');
for (const component of manifest.components) for (const doc of component.documents) {
  if (hash(await read(`dist/licenses/${doc.path}`)) !== doc.sha256) throw Error(`Missing/changed license: ${doc.path}`);
}
for (const entry of archives) {
  if (hash(await read(`dist/third_party_source/${entry.archive}`)) !== entry.sha256) throw Error(`Missing/changed source: ${entry.id}`);
}
for (const [file, expected] of Object.entries(pins.binaries)) {
  if (hash(await read(`dist/ffmpeg/${file}`)) !== expected) throw Error(`Changed distributed core: ${file}`);
}
for (const file of ['pins.json', 'archive-manifest.json', 'README.md', 'core-evidence.txt', 'release-evidence.json', 'prepare_rebuild.py', 'download-sources.mjs']) {
  if (!(await read(`third_party_source/${file}`)).equals(await read(`dist/third_party_source/${file}`))) throw Error(`Missing/changed source instructions: ${file}`);
}
const expectedNotices = publicNotices((await read('THIRD_PARTY_NOTICES.md')).toString(), manifest.components);
if (expectedNotices !== (await read('dist/licenses/THIRD_PARTY_NOTICES.md')).toString()) throw Error('Published notices differ from the generated version');
if (!/href="\.\/licenses\/"/.test((await read('dist/index.html')).toString())) throw Error('Footer link missing');
for (const [source, destination] of [['LICENSE', 'LICENSE.txt'], ['COPYRIGHT', 'COPYRIGHT.txt']]) {
  for (const path of [`dist/license/${destination}`]) {
    if (!(await read(source)).equals(await read(path))) throw Error(`Application license copy mismatch: ${path}`);
  }
}
if (!(await read('LICENSE')).equals(await read('licenses/ffmpeg/COPYING.GPLv2.txt'))) throw Error('GPL text must be verbatim');
if ((await json('package.json')).license !== 'GPL-2.0-or-later' || (await json('package-lock.json')).packages[''].license !== 'GPL-2.0-or-later') throw Error('Application package license mismatch');
if (!(await read('COPYRIGHT')).toString().includes('version 2 of the License, or (at your option) any later version')) throw Error('Missing or-later grant');
if (!/href="\.\/license\/"/.test((await read('dist/index.html')).toString())) throw Error('Application license footer link missing');
await verifyAppSource(root);
let httpBase;
let checkExternal = false;
const args = process.argv.slice(2);
for (let index = 0; index < args.length; index++) {
  if (args[index] === '--http-base') { httpBase = args[++index]; if (!httpBase) throw Error('--http-base requires a URL'); }
  else if (args[index] === '--check-external') checkExternal = true;
  else throw Error(`Unknown option: ${args[index]}`);
}
const links = await verifyPublicLinks(resolve(root, 'dist'), { httpBase, checkExternal });
const modules = [];
for (const target of ['main', 'worker']) {
  const inventory = await json(`dist/licenses/bundle-${target}.json`);
  for (const chunk of inventory.chunks) {
    await stat(resolve(root, 'dist', chunk.file));
    modules.push(...chunk.modules);
  }
}
for (const name of ['@ffmpeg/ffmpeg', 'gifuct-js', 'js-binary-schema-parser']) {
  if (!modules.some(id => id.includes(`node_modules/${name}/`))) throw Error(`Expected runtime dependency missing from inventory: ${name}`);
}
if (!modules.some(id => id.includes('?commonjs-exports'))) throw Error('Review CommonJS wrapper notice: generated module format changed');
if (!modules.some(id => id.includes('vite/modulepreload-polyfill'))) throw Error('Review Vite runtime notice: emitted helper changed');
const bytes = archives.reduce((sum, entry) => sum + entry.size, 0);
console.log(`Verified ${manifest.components.length} notice groups, ${archives.length} archives (${(bytes / 1_000_000).toFixed(2)} MB), 2 core hashes and main/worker inventories.`);
console.log(JSON.stringify(links, null, 2));
