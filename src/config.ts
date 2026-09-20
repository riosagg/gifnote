/*
 * Copyright (C) 2026 riosagg
 * SPDX-License-Identifier: GPL-2.0-or-later
 * This file is part of GIFnote and is licensed under GNU GPL version 2
 * or (at your option) any later version, WITHOUT ANY WARRANTY.
 * See the root LICENSE and COPYRIGHT files for details.
 */
export const NOTE_GIF_CONFIG = {
  maxDuration: 15,
  minDuration: 1,
  maxWidth: 620,
  defaultFps: 10,
  defaultColors: 128,
  maxFileSizeMB: 20,
  preferredFileSizeMB: 15,
  warnInputSizeMB: 150,
  maxInputSizeMB: 750,
  warnPixels: 3840 * 2160,
  maxPixels: 40_000_000,
  warnDuration: 600,
  engineTimeoutMs: 15 * 60 * 1000,
} as const;

export const MB = 1_000_000;
export type CropRect = { x: number; y: number; width: number; height: number };
export type OutputSettings = { width: number; fps: number; colors: number };
export const DEFAULT_SETTINGS: OutputSettings = {
  width: NOTE_GIF_CONFIG.maxWidth,
  fps: NOTE_GIF_CONFIG.defaultFps,
  colors: NOTE_GIF_CONFIG.defaultColors,
};
export function compressionLevels(settings: OutputSettings): OutputSettings[] {
  const levels = [
    settings,
    { width: settings.width, fps: Math.min(settings.fps, 8), colors: Math.min(settings.colors, 96) },
    { width: settings.width, fps: Math.min(settings.fps, 8), colors: Math.min(settings.colors, 64) },
    { width: Math.min(settings.width, 560), fps: Math.min(settings.fps, 8), colors: Math.min(settings.colors, 64) },
    { width: Math.min(settings.width, 520), fps: Math.min(settings.fps, 7), colors: Math.min(settings.colors, 64) },
    { width: Math.min(settings.width, 420), fps: Math.min(settings.fps, 6), colors: Math.min(settings.colors, 48) },
    { width: Math.min(settings.width, 320), fps: Math.min(settings.fps, 5), colors: Math.min(settings.colors, 32) },
  ];
  return levels.filter((level, index) => levels.findIndex(other => JSON.stringify(other) === JSON.stringify(level)) === index);
}
