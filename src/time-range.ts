/*
 * Copyright (C) 2026 riosagg
 * SPDX-License-Identifier: GPL-2.0-or-later
 * This file is part of GIFnote and is licensed under GNU GPL version 2
 * or (at your option) any later version, WITHOUT ANY WARRANTY.
 * See the root LICENSE and COPYRIGHT files for details.
 */
import { NOTE_GIF_CONFIG as CONFIG } from './config';
import { clamp, friendlyError } from './utils';

export function conversionDuration(start: number, end: number) {
  if (!Number.isFinite(start) || !Number.isFinite(end) || start < 0 || end <= start) throw friendlyError('時間範囲を確認してください。');
  // Floor to milliseconds before passing -t, independently of UI constraints.
  const seconds = Math.min(CONFIG.maxDuration, end - start);
  const duration = Math.floor(seconds * 1000 + 1e-8) / 1000;
  if (duration < 0.02) throw friendlyError('GIFの選択時間が短すぎます。');
  return duration;
}

/** Move the selection as one interval; clamp the start, never its two edges separately. */
export function moveSelection(start: number, end: number, delta: number, duration: number) {
  const length = end - start;
  if (![start, end, delta, duration].every(Number.isFinite) || length < 0 || length > duration) throw new Error('Invalid timeline interval');
  const next = clamp(start + delta, 0, duration - length);
  return { start: next, end: next + length };
}
