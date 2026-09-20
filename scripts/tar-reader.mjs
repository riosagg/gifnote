/*
 * Copyright (C) 2026 riosagg
 * SPDX-License-Identifier: GPL-2.0-or-later
 * This file is part of GIFnote and is licensed under GNU GPL version 2
 * or (at your option) any later version, WITHOUT ANY WARRANTY.
 * See the root LICENSE and COPYRIGHT files for details.
 */
import { gunzipSync } from 'node:zlib';

// Read regular files only, in memory. Never extract archive paths or symlinks to disk.
export function readTarGz(bytes) {
  const tar = gunzipSync(bytes);
  const files = new Map();
  let pending = {}, longName;
  const text = value => value.toString('utf8').replace(/\0.*$/s, '');
  for (let offset = 0; offset + 512 <= tar.length;) {
    const header = tar.subarray(offset, offset + 512);
    if (header.every(byte => byte === 0)) break;
    const size = Number.parseInt(text(header.subarray(124, 136)).trim() || '0', 8);
    if (!Number.isSafeInteger(size) || size < 0 || offset + 512 + size > tar.length) throw new Error('Invalid tar member size');
    const body = tar.subarray(offset + 512, offset + 512 + size);
    const type = String.fromCharCode(header[156]);
    let name = text(header.subarray(0, 100));
    const prefix = text(header.subarray(345, 500));
    if (prefix) name = `${prefix}/${name}`;
    if (type === 'x' || type === 'g') {
      const attributes = {};
      for (let cursor = 0; cursor < body.length;) {
        const space = body.indexOf(32, cursor);
        const length = Number(body.subarray(cursor, space).toString());
        if (space < 0 || !length || cursor + length > body.length) throw new Error('Invalid PAX header');
        const record = body.subarray(space + 1, cursor + length - 1).toString('utf8');
        const equals = record.indexOf('=');
        attributes[record.slice(0, equals)] = record.slice(equals + 1);
        cursor += length;
      }
      if (type === 'x') pending = attributes;
    } else if (type === 'L') {
      longName = text(body);
    } else {
      name = pending.path || longName || name;
      if (type === '0' || type === '\0') {
        const relative = name.split('/').slice(1).join('/');
        if (!relative || relative.split('/').some(part => part === '..') || relative.includes('\\')) throw new Error('Unsafe tar path');
        files.set(relative, body);
      }
      pending = {}; longName = undefined;
    }
    offset += 512 + Math.ceil(size / 512) * 512;
  }
  return files;
}
