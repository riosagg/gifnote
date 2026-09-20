/*
 * Copyright (C) 2026 riosagg
 * SPDX-License-Identifier: GPL-2.0-or-later
 * This file is part of GIFnote and is licensed under GNU GPL version 2
 * or (at your option) any later version, WITHOUT ANY WARRANTY.
 * See the root LICENSE and COPYRIGHT files for details.
 */
import { readFile, readdir, stat } from 'node:fs/promises';
import { resolve, relative, sep } from 'node:path';
import { createHash } from 'node:crypto';
import { markdownLinks, htmlLinks, resolvePublicLink } from './public-links.mjs';

const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const linkError = (file, url, message) => new Error(`${file}: ${url}: ${message}`);

export async function verifyPublicLinks(dist, { httpBase, checkExternal = false } = {}) {
  const root = resolve(dist);
  const files = [];
  async function walk(directory) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const path = resolve(directory, entry.name);
      if (entry.isSymbolicLink()) throw Error(`Symlink in public output: ${path}`);
      if (entry.isDirectory()) await walk(path);
      else files.push(relative(root, path).split(sep).join('/'));
    }
  }
  await walk(root);
  const summary = { documents: [], localLinks: 0, externalLinks: 0, brokenLinks: 0, httpFiles: 0, externalChecked: 0, localHtmlInjections: 0 };
  const external = new Set();
  for (const file of files.filter(name => /\.(html|md)$/i.test(name))) {
    const source = await readFile(resolve(root, file), 'utf8');
    if (/D:[\\/]GIFnote|file:\/\/|\b[A-Z]:[\\/](?:Users|Documents and Settings)[\\/]/i.test(source)) throw Error(`Local filesystem information in public document: ${file}`);
    const links = file.endsWith('.md') ? markdownLinks(source) : htmlLinks(source);
    const counts = { file, total: links.length, local: 0, external: 0 };
    for (const link of links) {
      let target;
      try { target = resolvePublicLink(link.url, file); }
      catch (error) { throw linkError(file, link.url, error.message); }
      if (target.external) { counts.external++; external.add(target.external); continue; }
      counts.local++;
      const absolute = resolve(root, target.path);
      if (!absolute.startsWith(root + sep)) throw linkError(file, link.url, 'Path outside dist');
      let info;
      try { info = await stat(absolute); }
      catch { throw linkError(file, link.url, 'Target does not exist in dist'); }
      if (!info.isFile()) throw linkError(file, link.url, 'Target is not a file');
      if (target.fragment && /\.html$/i.test(target.path)) {
        const html = await readFile(absolute, 'utf8');
        const anchors = [...html.matchAll(/\b(?:id|name)=["']([^"']+)["']/g)].map(match => match[1]);
        if (!anchors.includes(target.fragment)) throw linkError(file, link.url, `Missing HTML anchor #${target.fragment}`);
      }
      // Both the root site and the actual future repository path must resolve identically.
      const atRoot = resolvePublicLink(link.url, file, 'https://public.invalid/');
      if (atRoot.path !== target.path || atRoot.fragment !== target.fragment) throw linkError(file, link.url, 'Base-dependent target');
    }
    summary.documents.push(counts);
    summary.localLinks += counts.local;
    summary.externalLinks += counts.external;
  }
  if (httpBase) {
    const base = new URL(httpBase);
    if (!['http:', 'https:'].includes(base.protocol) || !['localhost', '127.0.0.1', '[::1]'].includes(base.hostname) || !base.pathname.endsWith('/')) throw Error('--http-base must be a localhost site URL ending with /');
    // Fetch every distributed file. Exact bytes reject SPA fallback pages masquerading as 200 OK.
    // This also covers linked licenses, notifications, archives, JS, Workers and WASM.
    for (const file of files) {
      const response = await fetch(new URL(file.split('/').map(encodeURIComponent).join('/'), base), { redirect: 'error', signal: AbortSignal.timeout(60_000) });
      if (!response.ok) throw Error(`HTTP ${response.status}: ${file}`);
      const expected = await readFile(resolve(root, file));
      let actual = Buffer.from(await response.arrayBuffer());
      if (/\.html$/i.test(file)) {
        // This Windows host's AdGuard injects these scripts into localhost responses.
        // Ignore only its exact script-tag form, only on localhost, and report the count.
        const text = actual.toString('utf8').replace(/<script\b[^>]*\bsrc="\/\/local\.adguard\.org[^>]*><\/script>/g, () => { summary.localHtmlInjections++; return ''; });
        actual = Buffer.from(text);
      }
      if (hash(actual) !== hash(expected)) throw Error(`HTTP body differs from dist (possible SPA fallback or stale preview): ${file}`);
      summary.httpFiles++;
    }
  }
  if (checkExternal) {
    // Explicit network check, never part of normal/offline builds. Check each distinct URL.
    const check = async url => {
      let response;
      for (let attempt = 0; attempt < 2; attempt++) {
        response = await fetch(url, { signal: AbortSignal.timeout(30_000) });
        await response.body?.cancel();
        if (response.ok || response.status < 500) break;
      }
      if (!response.ok) throw Error(`External link HTTP ${response.status}: ${url}`);
      summary.externalChecked++;
    };
    const urls = [...external];
    for (let index = 0; index < urls.length; index += 2) {
      const results = await Promise.allSettled(urls.slice(index, index + 2).map(check));
      const failures = results.filter(result => result.status === 'rejected');
      if (failures.length) throw new AggregateError(failures.map(result => result.reason), 'External link verification failed');
    }
  }
  return summary;
}
