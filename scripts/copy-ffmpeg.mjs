/*
 * Copyright (C) 2026 riosagg
 * SPDX-License-Identifier: GPL-2.0-or-later
 * This file is part of GIFnote and is licensed under GNU GPL version 2
 * or (at your option) any later version, WITHOUT ANY WARRANTY.
 * See the root LICENSE and COPYRIGHT files for details.
 */
import { copyFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const source = join(root, 'node_modules/@ffmpeg/core/dist/esm');
const target = join(root, 'public/ffmpeg');
await mkdir(target, { recursive: true });
for (const filename of ['ffmpeg-core.js', 'ffmpeg-core.wasm']) {
  await copyFile(join(source, filename), join(target, filename));
}
console.log('FFmpeg core assets ready (local, single thread).');
