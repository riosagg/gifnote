/*
 * Copyright (C) 2026 riosagg
 * SPDX-License-Identifier: GPL-2.0-or-later
 * This file is part of GIFnote and is licensed under GNU GPL version 2
 * or (at your option) any later version, WITHOUT ANY WARRANTY.
 * See the root LICENSE and COPYRIGHT files for details.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'node:http';
import { markdownLinks, htmlLinks, resolvePublicLink, publicNotices } from './public-links.mjs';
import { verifyPublicLinks } from './verify-public-links.mjs';

test('extract Markdown links, balanced filenames, references and autolinks; ignore code', () => {
  const source = '[inline](licenses/a(1).txt "title")\n[angle](<licenses/a b.txt>)\n[x][ref]\n[ref]: ../third_party_source/pins.json\n<https://example.org/>\n`[ignore](missing)`\n```md\n[ignore](missing-too)\n```\n<a href="index.html#ffmpeg">section</a>';
  assert.deepEqual(markdownLinks(source).map(link => link.url), ['licenses/a(1).txt', 'licenses/a b.txt', '../third_party_source/pins.json', 'https://example.org/', 'index.html#ffmpeg']);
});

test('publish from root without directory listings or double licenses paths', () => {
  const source = '[license](licenses/ffmpeg/COPYING.txt) [all](licenses/ffmpeg/) [source](third_party_source/README.md) [external](https://example.org/a) [GPL](LICENSE) [grant](COPYRIGHT)';
  const generated = publicNotices(source, [{ id: 'ffmpeg' }]);
  assert.deepEqual(markdownLinks(generated).map(link => link.url), ['ffmpeg/COPYING.txt', 'index.html#ffmpeg', '../third_party_source/README.md', 'https://example.org/a', '../license/LICENSE.txt', '../license/COPYRIGHT.txt']);
  assert.equal(publicNotices(source, [{ id: 'ffmpeg' }]), generated, 'regeneration must be deterministic');
  for (const base of ['https://example.org/', 'https://example.org/gifnote/']) {
    assert.equal(resolvePublicLink('../third_party_source/README.md', 'licenses/THIRD_PARTY_NOTICES.md', base).path, 'third_party_source/README.md');
  }
});

test('reject local, private and base-dependent URLs', () => {
  for (const url of ['D:\\GIFnote\\file', 'file:///private/file', 'http://localhost/a', 'http://127.0.0.1/a', '../node_modules/pkg/a', '/licenses/a', '../../outside']) {
    assert.throws(() => resolvePublicLink(url, 'licenses/index.html'), undefined, url);
  }
  assert.deepEqual(htmlLinks('<a href="a?x=1&amp;y=2">a</a><!-- <a href="bad"> -->').map(link => link.url), ['a?x=1&y=2']);
});

test('missing files, missing anchors and HTTP 200 fallback all fail verification', async () => {
  const workspace = fileURLToPath(new URL('../', import.meta.url));
  const root = await mkdtemp(resolve(workspace, '.link-check-'));
  let server;
  try {
    await mkdir(resolve(root, 'licenses'));
    await writeFile(resolve(root, 'licenses/notice.md'), '[missing](missing.txt)');
    await assert.rejects(verifyPublicLinks(root), /does not exist/);
    await writeFile(resolve(root, 'licenses/notice.md'), '[section](index.html#missing)');
    await writeFile(resolve(root, 'licenses/index.html'), '<h1 id="ffmpeg">license</h1>');
    await assert.rejects(verifyPublicLinks(root), /Missing HTML anchor/);
    await writeFile(resolve(root, 'licenses/notice.md'), '[section](index.html#ffmpeg)');
    assert.equal((await verifyPublicLinks(root)).localLinks, 1);
    server = createServer((_req, res) => res.writeHead(200, { 'Content-Type': 'text/html' }).end('<html>Wrong SPA fallback</html>'));
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    await assert.rejects(verifyPublicLinks(root, { httpBase: `http://127.0.0.1:${server.address().port}/` }), /HTTP body differs/);
  } finally {
    if (server) await new Promise(resolve => server.close(resolve));
    const target = resolve(root);
    if (!target.startsWith(resolve(workspace) + sep + '.link-check-')) throw Error('Unsafe test cleanup path');
    await rm(target, { recursive: true, force: true });
  }
});
