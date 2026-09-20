/*
 * Copyright (C) 2026 riosagg
 * SPDX-License-Identifier: GPL-2.0-or-later
 * This file is part of GIFnote and is licensed under GNU GPL version 2
 * or (at your option) any later version, WITHOUT ANY WARRANTY.
 * See the root LICENSE and COPYRIGHT files for details.
 */
// Offline build step. The reviewed originals are in licenses/ and third_party_source/.
import { readFile, writeFile, mkdir, cp, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve, relative, sep } from 'node:path';
import { createHash } from 'node:crypto';
import { publicNotices } from './public-links.mjs';
import { prepareAppSource } from './app-source.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const read = path => readFile(resolve(root, path));
const json = async path => JSON.parse(await read(path));
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const pins = await json('third_party_source/pins.json');
const manifest = await json('licenses/manifest.json');
const archives = (await json('third_party_source/archive-manifest.json')).archives;
for (const [name, version] of Object.entries(manifest.packages)) {
  if ((await json(`node_modules/${name}/package.json`)).version !== version) throw Error(`License review required: ${name} version changed`);
  if ((await json('package-lock.json')).packages[`node_modules/${name}`]?.version !== version) throw Error(`Lockfile mismatch: ${name}`);
}
for (const [filename, expected] of Object.entries(pins.binaries)) {
  for (const directory of ['public/ffmpeg', 'node_modules/@ffmpeg/core/dist/esm']) {
    if (hash(await read(`${directory}/${filename}`)) !== expected) throw Error(`Core/source review required: ${directory}/${filename}`);
  }
}
if (archives.length !== pins.sources.length) throw Error('Missing source archives');
for (const source of pins.sources) {
  const entry = archives.find(item => item.id === source.id);
  if (!entry || entry.commit !== source.commit || entry.repo !== source.repo) throw Error(`Source pin mismatch: ${source.id}`);
  if (entry.archive !== `archives/${source.id}-${source.commit}.tgz`) throw Error('Unexpected archive path');
  const bytes = await read(`third_party_source/${entry.archive}`);
  if (bytes.length !== entry.size || hash(bytes) !== entry.sha256) throw Error(`Source archive corrupt: ${source.id}`);
}
for (const component of manifest.components) {
  for (const doc of component.documents) {
    if (hash(await read(`licenses/${doc.path}`)) !== doc.sha256) throw Error(`License document changed: ${doc.path}`);
  }
}
// Only these generated directories are cleared; check their resolved boundaries first.
for (const directory of ['licenses', 'third_party_source', 'license', 'source']) {
  const target = resolve(root, 'public', directory);
  if (relative(resolve(root, 'public'), target) !== directory || !target.startsWith(resolve(root, 'public') + sep)) throw Error('Unsafe generated path');
  await rm(target, { recursive: true, force: true });
  await mkdir(target, { recursive: true });
}
await cp(resolve(root, 'licenses'), resolve(root, 'public/licenses'), { recursive: true });
// An allowlist prevents accidentally publishing rebuild scratch directories or private files.
for (const file of ['pins.json', 'archive-manifest.json', 'README.md', 'core-evidence.txt', 'release-evidence.json', 'prepare_rebuild.py', 'download-sources.mjs']) {
  await cp(resolve(root, 'third_party_source', file), resolve(root, 'public/third_party_source', file));
}
for (const entry of archives) {
  await mkdir(resolve(root, 'public/third_party_source/archives'), { recursive: true });
  await cp(resolve(root, 'third_party_source', entry.archive), resolve(root, 'public/third_party_source', entry.archive));
}
await writeFile(resolve(root, 'public/licenses/THIRD_PARTY_NOTICES.md'), publicNotices((await read('THIRD_PARTY_NOTICES.md')).toString(), manifest.components));
const escape = value => String(value).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
const link = (url, label) => `<a href="${escape(url)}">${escape(label)}</a>`;
const page = (title, body) => `<!doctype html><html lang="ja"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escape(title)} — GIFnote</title><style>body{max-width:960px;margin:40px auto;padding:0 22px;font:16px/1.8 system-ui,sans-serif;color:#243c36;background:#fafcfb}a{color:#12644f;overflow-wrap:anywhere}h1{line-height:1.3}h2{margin-top:2em}section{border-top:1px solid #cadbd3;padding-top:1em}pre{white-space:pre-wrap;overflow-wrap:anywhere;background:#eef4f1;padding:18px}small{display:block}li{margin:8px 0}</style></head><body>${body}</body></html>`;
const sections = manifest.components.map(c => `<section id="${escape(c.id)}"><h2>${escape(c.name)} — ${escape(c.version)}</h2><p>${escape(c.license)}</p><p>${escape(c.copyright)}</p><p>${escape(c.scope)}</p><p>${escape(c.changes)}</p><p>${link(c.upstream, '上流ソース')}${c.archive ? ' · ' + link('../third_party_source/' + c.archive, 'ソースをダウンロード') : ''}</p><ul>${c.documents.map(d => `<li>${link(d.path, d.path.split('/').at(-1))} · ${link(d.upstream, '出典')}</li>`).join('')}</ul></section>`).join('');
await writeFile(resolve(root, 'public/licenses/index.html'), page('Third-party licenses', `<p>${link('../', '← GIFnoteへ戻る')} · ${link('../license/', 'GIFnote License')}</p><h1>Third-party licenses</h1><p>このページは第三者コンポーネントの通知です。GIFnote独自コードはGPL-2.0-or-laterで提供します。第三者コンポーネントは、それぞれ元のライセンスと著作権表示を維持します。</p><p>配信ファイル <code>ffmpeg-core.js</code> / <code>ffmpeg-core.wasm</code> は @ffmpeg/core 0.12.10 の未変更ESM版です。このcoreは GPL-2.0-or-later のFFmpeg 5.1.4を含みます。@ffmpeg/ffmpeg 0.12.15 のJavaScript wrapperはMITです。両者を混同しないでください。</p><p>${link('../third_party_source/', 'FFmpeg coreのソース・ビルド定義・取得方法')} · ${link('THIRD_PARTY_NOTICES.md', '第三者通知全文（Markdown）')} · ${link('manifest.json', '機械可読な通知一覧')}</p><p>This software is based in part on the work of the Independent JPEG Group.</p><p>ソースは上流公開ビルド定義から固定したものです。既存npmバイナリを再ビルドして一致させる検証は未実施です。詳細と未確定事項はソース提供ページをご覧ください。</p>${sections}<section><h2>開発専用の依存</h2><p>TypeScript、@ffmpeg/types、Vite開発サーバー、Rollup/esbuild本体および開発用依存はサイトに配信しません。ViteのpreloadとRollup CommonJSの生成wrapperだけは上記に含めています。ビルド時のモジュール一覧は dist/licenses/bundle-main.json と bundle-worker.json に生成します。</p></section>`));
const readme = (await read('third_party_source/README.md')).toString();
await writeFile(resolve(root, 'public/third_party_source/index.html'), page('FFmpeg core source', `<p>${link('../licenses/', '← Third-party licenses')}</p><h1>FFmpeg core source</h1><p>配信バイナリと同じサイトから、ソースとビルド定義を追加料金なしで取得できます。下記の全アーカイブを一式として保持してください。</p><p>${link('download-sources.mjs', '一括取得スクリプト')} · ${link('prepare_rebuild.py', '再ビルド準備スクリプト')} · ${link('pins.json', 'バージョン・コミット・バイナリSHA-256')} · ${link('archive-manifest.json', 'ソースSHA-256')} · ${link('core-evidence.txt', '配信coreの -version / -L')} · ${link('release-evidence.json', 'npm公開と上流コミットの調査記録')}</p><pre>${escape(readme)}</pre><h2>ソースアーカイブ</h2><ul>${archives.map(e => `<li>${link(e.archive, `${e.id} (${(e.size / 1_000_000).toFixed(2)} MB)`)}<small>commit ${escape(e.commit)}<br>SHA-256 ${escape(e.sha256)}</small></li>`).join('')}</ul>`));
console.log(`Third-party documents and ${archives.length} source archives prepared offline.`);

// The GPL text is copied verbatim; the application grant lives in COPYRIGHT.
for (const [source, destination] of [['LICENSE', 'LICENSE.txt'], ['COPYRIGHT', 'COPYRIGHT.txt']]) {
  await cp(resolve(root, source), resolve(root, 'public/license', destination));
}
await prepareAppSource(root);
await writeFile(resolve(root, 'public/license/index.html'), page('License', `<p>${link('../', '← GIFnoteへ戻る')}</p><h1>GIFnote License</h1><p>GIFnote独自コード: <strong>GPL-2.0-or-later</strong>。再配布・改変はGPLの条件に従って行えます。本ソフトウェアは無保証です。</p><pre>${escape((await read('COPYRIGHT')).toString())}</pre><p>${link('LICENSE.txt', 'GNU GPL version 2 全文')} · ${link('COPYRIGHT.txt', '適用宣言')} · ${link('../source/', 'GIFnote本体のソースとビルド方法')} · ${link('../licenses/', 'Third-party licenses')} · ${link('../third_party_source/', 'FFmpeg対応ソース')}</p><h2>GNU GPL version 2</h2><pre>${escape((await read('LICENSE')).toString())}</pre>`));
await writeFile(resolve(root, 'public/source/index.html'), page('GIFnote source', `<p>${link('../license/', '← License')}</p><h1>GIFnote source</h1><p>この配信版に対応する編集可能な本体ソース・設定・lockfile・ビルドスクリプト・通知を取得できます。第三者由来ファイルは元のライセンスを保持します。</p><p>${link('gifnote-source.tgz', '本体ソースをダウンロード')} · ${link('manifest.json', '本体ソースSHA-256一覧')} · ${link('../third_party_source/', 'FFmpeg関連19アーカイブ・取得方法')} · ${link('../licenses/', 'Third-party licenses')}</p><h2>ビルド方法</h2><p>アーカイブを展開したgifnoteフォルダで、Node.js 22.12以上を使い次を実行してください。YOUR-SITE/PATHはこのソースを取得したサイトのURLへ置き換えてください。依存取得にはネット接続が必要です。</p><pre>node third_party_source/download-sources.mjs https://YOUR-SITE/PATH/third_party_source/
npm ci
npm run build</pre><p>大きいFFmpeg関連アーカイブは上記スクリプトで同じサイトから取得し、ハッシュを検証します。FFmpeg coreはnpm版0.12.10を使用します。core自体の再コンパイル手順はFFmpeg対応ソースのREADMEにあります。</p>`));
