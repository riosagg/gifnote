/*
 * Copyright (C) 2026 riosagg
 * SPDX-License-Identifier: GPL-2.0-or-later
 * This file is part of GIFnote and is licensed under GNU GPL version 2
 * or (at your option) any later version, WITHOUT ANY WARRANTY.
 * See the root LICENSE and COPYRIGHT files for details.
 */
import { posix } from 'node:path';

// Keep offsets stable while excluding Markdown examples from link extraction.
function markdownText(source) {
  let fence;
  return source.split(/(?<=\n)/).map(line => {
    const marker = line.match(/^ {0,3}(`{3,}|~{3,})/);
    if (fence) {
      if (marker && marker[1][0] === fence[0] && marker[1].length >= fence.length) fence = undefined;
      return line.replace(/[^\r\n]/g, ' ');
    }
    if (marker) { fence = marker[1]; return line.replace(/[^\r\n]/g, ' '); }
    if (/^(?: {4}|\t)/.test(line)) return line.replace(/[^\r\n]/g, ' ');
    return line;
  }).join('').replace(/(`+)([^`]|(?!\1)`)*?\1/g, match => ' '.repeat(match.length));
}

function destination(text, offset) {
  while (/\s/.test(text[offset] || '') && offset < text.length) offset++;
  if (text[offset] === '<') {
    const end = text.indexOf('>', offset + 1);
    if (end < 0) throw Error('Unclosed Markdown link destination');
    return { start: offset + 1, end, after: end + 1 };
  }
  const start = offset;
  let depth = 0;
  while (offset < text.length) {
    if (text[offset] === '\\') { offset += 2; continue; }
    if (text[offset] === '(') depth++;
    else if (text[offset] === ')') { if (!depth) break; depth--; }
    else if (/\s/.test(text[offset]) && !depth) break;
    offset++;
  }
  if (depth) throw Error('Unbalanced Markdown link destination');
  return { start, end: offset, after: offset };
}

const decode = text => text.replace(/\\([\\()[\]<> ])/g, '$1').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>');

// Supports inline/image links (balanced parentheses), reference definitions,
// autolinks and HTML href/src. Reference definitions are checked once per target.
// Plain prose URLs and code examples are not hyperlinks in this inventory.
export function markdownLinks(source) {
  const text = markdownText(source);
  const links = [];
  const add = span => {
    if (!links.some(link => span.start < link.end && span.end > link.start)) {
      links.push({ ...span, url: decode(source.slice(span.start, span.end)) });
    }
  };
  for (const match of text.matchAll(/\]\(/g)) {
    const span = destination(text, match.index + 2);
    if (!/^\s*(?:(?:"[^"\n]*"|'[^'\n]*'|\([^\n]*\))\s*)?\)/.test(text.slice(span.after))) throw Error('Malformed Markdown inline link');
    add(span);
  }
  for (const match of text.matchAll(/^ {0,3}\[[^\]\n]+\]:[ \t]*/gm)) add(destination(text, match.index + match[0].length));
  for (const match of text.matchAll(/<((?:https?:\/\/|mailto:)[^<>\s]+)>/g)) add({ start: match.index + 1, end: match.index + match[0].length - 1 });
  for (const link of htmlLinks(text)) add(link);
  return links.sort((a, b) => a.start - b.start);
}

export function htmlLinks(source) {
  // Do not mistake text in scripts, comments, or escaped <pre> text for markup.
  const text = source.replace(/<!--[\s\S]*?-->|<script\b[^>]*>[\s\S]*?<\/script>/gi, value => {
    if (value.startsWith('<!--')) return ' '.repeat(value.length);
    const opening = value.indexOf('>') + 1;
    return value.slice(0, opening) + ' '.repeat(value.length - opening);
  });
  const links = [];
  for (const tag of text.matchAll(/<[A-Za-z][^>]*>/g)) {
    for (const attr of tag[0].matchAll(/\b(?:href|src)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/gi)) {
      const raw = attr[1] ?? attr[2] ?? attr[3];
      const prefix = attr[0].match(/^[^=]+=\s*["']?/)?.[0].length;
      const start = tag.index + attr.index + prefix;
      links.push({ start, end: start + raw.length, url: decode(raw) });
    }
  }
  return links;
}

export function resolvePublicLink(url, from, siteBase = 'https://public.invalid/gifnote/') {
  if (/^(?:[a-z]:[\\/]|file:)/i.test(url) || url.includes('\\')) throw Error(`Local filesystem URL: ${url}`);
  if (/^(?:https?:)?\/\//i.test(url)) {
    const external = new URL(url, siteBase);
    if (external.username || external.password || /^(?:localhost|127(?:\.\d+){3}|\[::1\])$/i.test(external.hostname)) throw Error(`Local/private URL: ${url}`);
    if (external.pathname.split('/').includes('node_modules')) throw Error(`node_modules link: ${url}`);
    return { external: external.href };
  }
  if (/^[a-z][a-z\d+.-]*:/i.test(url)) throw Error(`Unsupported public link scheme: ${url}`);
  if (url.startsWith('/')) throw Error(`Root-relative URL breaks repository hosting: ${url}`);
  const base = new URL(siteBase);
  const resolved = new URL(url, new URL(from, base));
  if (resolved.origin !== base.origin || !resolved.pathname.startsWith(base.pathname)) throw Error(`Link escapes the site: ${url}`);
  let path = decodeURIComponent(resolved.pathname.slice(base.pathname.length));
  if (path.split('/').some(part => ['..', 'node_modules'].includes(part)) || path.includes('\\')) throw Error(`Unsafe public path: ${url}`);
  if (!path || path.endsWith('/')) path += 'index.html';
  return { path, fragment: decodeURIComponent(resolved.hash.slice(1)), search: resolved.search };
}

export function publicNotices(source, components) {
  const directorySections = new Map(components.map(c => [`licenses/${c.id}/`, `licenses/index.html#${c.id}`]));
  let output = source;
  for (const link of markdownLinks(source).reverse()) {
    const resolved = resolvePublicLink(link.url, 'THIRD_PARTY_NOTICES.md', 'https://public.invalid/');
    if (resolved.external) continue;
    const original = new URL(link.url, 'https://public.invalid/THIRD_PARTY_NOTICES.md');
    const relocated = { '/THIRD_PARTY_NOTICES.md': 'licenses/THIRD_PARTY_NOTICES.md', '/LICENSE': 'license/LICENSE.txt', '/COPYRIGHT': 'license/COPYRIGHT.txt' };
    const publishedPath = relocated[original.pathname] ?? original.pathname.slice(1);
    const target = directorySections.get(original.pathname.slice(1)) ?? `${publishedPath}${original.search}${original.hash}`;
    const targetURL = new URL(target, 'https://public.invalid/');
    const path = posix.relative('licenses', targetURL.pathname.slice(1)) || '.';
    const replacement = `${path}${targetURL.search}${targetURL.hash}`;
    output = output.slice(0, link.start) + replacement + output.slice(link.end);
  }
  return '> 公開用コピー：ルートの THIRD_PARTY_NOTICES.md から自動生成しています。リンクはこの文書の公開位置に合わせています。\n\n' + output;
}
