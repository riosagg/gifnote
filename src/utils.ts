/*
 * Copyright (C) 2026 riosagg
 * SPDX-License-Identifier: GPL-2.0-or-later
 * This file is part of GIFnote and is licensed under GNU GPL version 2
 * or (at your option) any later version, WITHOUT ANY WARRANTY.
 * See the root LICENSE and COPYRIGHT files for details.
 */
export function element<T extends HTMLElement = HTMLElement>(id: string): T {
  const node = document.getElementById(id);
  if (!node) throw new Error(`Missing element: ${id}`);
  return node as T;
}
export const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
export function timeLabel(seconds: number): string {
  return `${Math.floor(seconds / 60).toString().padStart(2, '0')}:${(seconds % 60).toFixed(1).padStart(4, '0')}`;
}
export const sizeLabel = (bytes: number) => `${(bytes / 1_000_000).toFixed(2)} MB`;
export function userError(error: unknown): string {
  console.error('[GIFnote]', error);
  if (error instanceof Error && error.name === 'UserError') return error.message;
  const detail = String(error);
  if (/memory|allocation|out of bounds|unreachable/i.test(detail)) {
    return 'ブラウザのメモリが足りない可能性があります。ほかのタブを閉じるか、短い動画・低い解像度のファイルでお試しください。';
  }
  return 'このファイルを処理できませんでした。ファイルが壊れていないか確認し、別の動画やGIFでお試しください。';
}
export function friendlyError(message: string): Error {
  const error = new Error(message);
  error.name = 'UserError';
  return error;
}
