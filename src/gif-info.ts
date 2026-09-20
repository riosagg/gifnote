/*
 * Copyright (C) 2026 riosagg
 * SPDX-License-Identifier: GPL-2.0-or-later
 * This file is part of GIFnote and is licensed under GNU GPL version 2
 * or (at your option) any later version, WITHOUT ANY WARRANTY.
 * See the root LICENSE and COPYRIGHT files for details.
 */
import { friendlyError } from './utils';

/** Scan GIF blocks without allocating decoded frames. Delays match FFmpeg's GIF defaults. */
function scanGif(bytes: Uint8Array) {
  const fail = () => { throw friendlyError('GIFの構造を読み取れませんでした。別のGIFでお試しください。'); };
  const signature = new TextDecoder().decode(bytes.subarray(0, 6));
  if (!/^GIF8[79]a$/.test(signature) || bytes.length < 13) return fail();
  const word = (p: number) => bytes[p] | (bytes[p + 1] << 8);
  const width = word(6), height = word(8);
  let pos = 13 + ((bytes[10] & 128) ? 3 * 2 ** ((bytes[10] & 7) + 1) : 0);
  let durationTicks = 0, delayTicks = 10;
  let delayOffset: number | undefined;
  const frames: { end: number; ticks: number; delayOffset?: number }[] = [];
  const skip = (size: number) => { pos += size; if (pos > bytes.length) fail(); };
  const blocks = () => {
    while (pos < bytes.length) { const size = bytes[pos++]; if (!size) return; skip(size); }
    fail();
  };
  let terminated = false;
  while (pos < bytes.length) {
    const marker = bytes[pos++];
    if (marker === 0x3b) { terminated = true; break; }
    if (marker === 0x21) {
      const label = bytes[pos++];
      if (label === 0xf9) {
        if (bytes[pos] !== 4 || pos + 6 > bytes.length || bytes[pos + 5] !== 0) fail();
        const ticks = word(pos + 2);
        delayTicks = ticks < 2 ? 10 : ticks;
        delayOffset = pos + 2;
        skip(6);
      } else { blocks(); }
    } else if (marker === 0x2c) {
      if (pos + 9 > bytes.length) fail();
      const packed = bytes[pos + 8];
      skip(9);
      if (packed & 128) skip(3 * 2 ** ((packed & 7) + 1));
      skip(1);
      blocks();
      frames.push({ end: pos, ticks: delayTicks, delayOffset });
      durationTicks += delayTicks;
      delayTicks = 10; delayOffset = undefined;
    } else { fail(); }
  }
  if (!terminated || !frames.length || !width || !height) return fail();
  return { width, height, frames, durationTicks };
}


export function inspectGif(bytes: Uint8Array) {
  const info = scanGif(bytes);
  // GIF delays are integer centiseconds; sum integers to avoid floating-point drift.
  return { width: info.width, height: info.height, frames: info.frames.length, duration: info.durationTicks / 100 };
}

/** Shorten only the tail. Never stretch a short GIF or emit 0/1-tick delays,
 * which browsers commonly substitute with 100ms. Compressed pixels stay intact. */
export function limitGifDuration(bytes: Uint8Array, seconds: number): Uint8Array {
  if (!Number.isFinite(seconds) || seconds < 0.02) throw friendlyError('GIFの選択時間が短すぎます。');
  const budget = Math.floor(seconds * 100 + 1e-8);
  const info = scanGif(bytes);
  if (info.durationTicks <= budget) return bytes;
  let used = 0, lastEnd = 0;
  let adjustment: { offset: number; ticks: number } | undefined;
  for (const frame of info.frames) {
    const remaining = budget - used;
    if (remaining < 2) break;
    if (frame.ticks > remaining) {
      // FFmpeg output has a GCE for every frame. Without one, retain the prior
      // frames instead of inventing transparency/disposal semantics.
      if (frame.delayOffset === undefined) break;
      adjustment = { offset: frame.delayOffset, ticks: remaining };
      lastEnd = frame.end;
      break;
    }
    used += frame.ticks;
    lastEnd = frame.end;
  }
  if (!lastEnd) throw friendlyError('GIFの表示時間を調整できませんでした。選択時間を長くしてください。');
  const output = new Uint8Array(lastEnd + 1);
  output.set(bytes.subarray(0, lastEnd));
  output[lastEnd] = 0x3b;
  if (adjustment) {
    output[adjustment.offset] = adjustment.ticks & 255;
    output[adjustment.offset + 1] = adjustment.ticks >> 8;
  }
  if (inspectGif(output).duration > budget / 100) throw new Error('GIF duration limit failed');
  return output;
}
