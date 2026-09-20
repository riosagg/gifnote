/*
 * Copyright (C) 2026 riosagg
 * SPDX-License-Identifier: GPL-2.0-or-later
 * This file is part of GIFnote and is licensed under GNU GPL version 2
 * or (at your option) any later version, WITHOUT ANY WARRANTY.
 * See the root LICENSE and COPYRIGHT files for details.
 */
// Maintenance only: rebuild the reviewed notice inventory from locally pinned sources.
// No network and no dependency installation. Review the resulting changes before use.
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';
import { readTarGz } from './tar-reader.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const read = path => readFile(resolve(root, path));
const json = async path => JSON.parse(await read(path));
const pins = await json('third_party_source/pins.json');
const archives = (await json('third_party_source/archive-manifest.json')).archives;
const components = [];
const copyright = {
  'ffmpeg-wasm': 'Copyright (c) 2019 Jerome Wu; FFmpeg-derived frontend: individual FFmpeg authors (see source headers).',
  ffmpeg: 'Copyright (c) 2000-2023 the FFmpeg developers; individual files retain their authors and years. IJG-derived code: Thomas G. Lane and other authors in the accompanying files.',
  x264: 'Copyright (C) 2003-2022 x264 project; individual source notices retained.',
  x265: 'Copyright (C) 2013-2020 MulticoreWare, Inc.; individual source notices retained.',
  libvpx: 'Copyright (c) 2010, The WebM Project authors. All rights reserved.',
  lame: 'Copyright (c) 1999 Mark Taylor (lame.h); additional authors and years in individual files.',
  ogg: 'Copyright (c) 2002, Xiph.org Foundation',
  theora: 'Copyright (C) 2002-2009 Xiph.org Foundation',
  vorbis: 'Copyright (c) 2002-2008 Xiph.org Foundation',
  opus: 'Copyright 2001-2011 Xiph.Org, Skype Limited, Octasic, Jean-Marc Valin, Timothy B. Terriberry, CSIRO, Gregory Maxwell, Mark Borgerding, Erik de Castro Lopo',
  zlib: 'Copyright (C) 1995-2017 Jean-loup Gailly and Mark Adler',
  webp: 'Copyright (c) 2010, Google Inc. All rights reserved.',
  freetype: 'The FreeType Project authors; David Turner, Robert Wilhelm, Werner Lemberg and per-file contributors (years and full notices retained in source).',
  fribidi: 'Copyright (C) 2004 Sharif FarsiWeb, Inc (fribidi.h); additional authors in AUTHORS and source.',
  harfbuzz: 'Google, Ebrahim Byagowi, Facebook, Mozilla, Codethink, Nokia, Keith Stribley, Martin Hosken/SIL, Chris Wilson, Behdad Esfahbod, David Turner, Red Hat, Werner Lemberg; full years and notices in COPYING.',
  libass: 'Copyright (C) 2006-2016 libass contributors',
  zimg: 'zimg contributors; per-file notices in the source. COPYING copyright (C) 2004 Sam Hocevar applies to the license text.',
  emscripten: 'Copyright (c) 2010-2014 Emscripten authors; musl: Copyright © 2005-2020 Rich Felker, et al.; LLVM and other system library contributors (individual notices retained).',
  sdl2: 'Copyright (C) 1997-2022 Sam Lantinga <slouken@libsdl.org>',
};
async function document(id, path, bytes, upstream) {
  const destination = `${id}/${path.replaceAll('/', '__')}${path.endsWith('.txt') ? '' : '.txt'}`;
  const target = resolve(root, 'licenses', destination);
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, bytes);
  return { path: destination, upstream, sha256: createHash('sha256').update(bytes).digest('hex') };
}
for (const source of pins.sources) {
  const archive = archives.find(entry => entry.id === source.id);
  const bytes = await read(`third_party_source/${archive.archive}`);
  if (createHash('sha256').update(bytes).digest('hex') !== archive.sha256) throw Error(`Source hash mismatch: ${source.id}`);
  const files = readTarGz(bytes);
  const documents = [];
  for (const path of source.documents) {
    if (!files.has(path)) throw Error(`Missing upstream document: ${source.id}/${path}`);
    documents.push(await document(source.id, path, files.get(path), `https://github.com/${source.repo}/blob/${source.commit}/${path}`));
  }
  // Keep complete comment blocks, rather than reducing copyright owners to a guessed list.
  // This is a conservative source-level collection, NOT a claim that every file is linked.
  const headers = [];
  for (const [path, body] of files) {
    if (/(^|\/)(tests?|examples?|docs?|demos?|tools|builds?|site|third_party)\//i.test(path)) continue;
    if (!/\.(c|h|cc|cpp|hh|hpp|js|s)$/i.test(path) || body.length > 2_000_000) continue;
    const text = body.toString('utf8');
    const blocks = text.match(/\/\*[\s\S]*?\*\//g) || [];
    const lines = text.match(/(?:^[ \t]*\/\/[^\n]*(?:\n|$))+/gm) || [];
    const notices = [...blocks, ...lines].filter(block => /copyright|permission is hereby|redistribution and use|SPDX-License-Identifier/i.test(block));
    if (notices.length) headers.push(`\n===== ${path} =====\n${notices.join('\n')}\n`);
  }
  if (headers.length) documents.push(await document(source.id, 'SOURCE-NOTICES', Buffer.from('Verbatim notice/comment blocks from the pinned source tree. This conservative collection may include code discarded by the linker or inactive platform code. Complete source files, notices and build scripts remain in the source archive.\n' + headers.join('')), `https://github.com/${source.repo}/tree/${source.commit}`));
  components.push({ id: source.id, name: source.name, version: source.version, license: source.license,
    copyright: copyright[source.id], upstream: `https://github.com/${source.repo}/tree/${source.commit}`,
    changes: 'GIFnoteによる第三者ソース・配信coreの変更なし。上流fork、frontendの変更、ビルド時パッチは同梱ソースと上流build/を参照。',
    scope: source.id === 'sdl2' ? 'Emscriptenが指定するSDL2ビルド入力。最終WASMに残るSDL2コード量はリンクマップ未取得のため未確定。' : source.id === 'emscripten' ? 'coreのJS/runtimeおよびC/C++システムライブラリ。個別ファイルのリンク有無は未確定。' : source.id === 'ffmpeg-wasm' ? 'MIT wrapper、core bindings、上流で変更されたFFmpeg frontendとビルド定義。' : '配信coreのリンク対象（全codecをGIFnoteのUIから利用するとは限らない）。',
    archive: archive.archive, documents });
}
for (const [id, version] of [['gifuct-js', '2.1.2'], ['js-binary-schema-parser', '2.0.3']]) {
  const pkg = await json(`node_modules/${id}/package.json`);
  if (pkg.version !== version) throw Error(`Review dependency update: ${id}`);
  // npm registry gitHead for these exact versions; LICENSE text matches after LF/CRLF normalization.
  const sourceLicense = id === 'gifuct-js'
    ? 'https://github.com/matt-way/gifuct-js/blob/c497192922d79acc537ec9f4796dfa2d89aaa13a/LICENSE'
    : 'https://github.com/matt-way/jsBinarySchemaParser/blob/333f7eb5b4ef958a5fee71ec704f1eae5a65b78b/LICENSE';
  const documents = [await document(id, 'LICENSE', await read(`node_modules/${id}/LICENSE`), sourceLicense)];
  if (id === 'gifuct-js') {
    for (const item of await json('licenses/gifuct-js/DERIVATION.json')) {
      const bytes = await read(`licenses/gifuct-js/${item.file}`);
      documents.push({ path: `${id}/${item.file}`, upstream: item.url, sha256: createHash('sha256').update(bytes).digest('hex') });
    }
  }
  components.push({ id, name: id, version, license: 'MIT', copyright: 'Copyright (c) 2015 Matt Way' + (id === 'gifuct-js' ? '; deinterlace: Copyright (c) 2011 Shachaf Ben-Kiki; LZW original: Copyright (c) 2013 Xcellent Creations, Inc.' : ''), upstream: `https://github.com/matt-way/${id === 'gifuct-js' ? id : 'jsBinarySchemaParser'}`, changes: 'GIFnoteによるソース変更なし。Viteによるバンドル・縮小あり。派生元の移植はgifuct-js上流によるもの。', scope: 'ブラウザ用JavaScriptに同梱。', documents });
}
const vite = await json('node_modules/vite/package.json');
if (vite.version !== '7.3.6') throw Error('Review Vite runtime notices after updating Vite');
const viteLicense = (await read('node_modules/vite/LICENSE.md')).toString();
const start = viteLicense.indexOf('## @rollup/plugin-alias');
const end = viteLicense.indexOf('\n## ', start + 4);
for (const entry of [
  { id: 'vite', name: 'Vite browser preload helpers', version: vite.version, copyright: 'Copyright (c) 2019-present, VoidZero Inc. and Vite contributors', text: viteLicense.split('# Licenses of bundled dependencies')[0], upstream: 'https://github.com/vitejs/vite/tree/v7.3.6' },
  { id: 'rollup-commonjs', name: '@rollup/plugin-commonjs generated CommonJS wrappers', version: '29.0.0 (bundled in Vite 7.3.6; upstream pnpm-lock.yaml)', copyright: 'Copyright (c) 2019 RollupJS Plugin Contributors', text: viteLicense.slice(start, end), upstream: 'https://github.com/rollup/plugins/tree/commonjs-v29.0.0/packages/commonjs' },
]) {
  if (!entry.text.includes('Permission is hereby granted')) throw Error(`Missing license: ${entry.id}`);
  components.push({ ...entry, text: undefined, license: 'MIT', changes: 'GIFnoteによる変更なし。ビルド時に生成・縮小。', scope: '配信される小さなruntime helperのみ。Vite開発サーバーやRollup本体を配信するものではありません。', documents: [await document(entry.id, 'LICENSE', Buffer.from(entry.text), 'https://github.com/vitejs/vite/blob/v7.3.6/packages/vite/LICENSE.md')] });
}
await writeFile(resolve(root, 'licenses/manifest.json'), JSON.stringify({ schemaVersion: 1, packages: { '@ffmpeg/core': '0.12.10', '@ffmpeg/ffmpeg': '0.12.15', 'gifuct-js': '2.1.2', 'js-binary-schema-parser': '2.0.3', vite: '7.3.6' }, components }, null, 2) + '\n');
console.log(`Collected ${components.length} component notice groups. Review before building.`);
