/*
 * Copyright (C) 2026 riosagg
 * SPDX-License-Identifier: GPL-2.0-or-later
 * This file is part of GIFnote and is licensed under GNU GPL version 2
 * or (at your option) any later version, WITHOUT ANY WARRANTY.
 * See the root LICENSE and COPYRIGHT files for details.
 */
import { decompressFrame, parseGIF, type ParsedGif } from 'gifuct-js';
import { inspectGif } from './gif-info';
import { NOTE_GIF_CONFIG } from './config';
import { friendlyError } from './utils';

type ImageFrame = Parameters<typeof decompressFrame>[0];

/** Keep only the composited canvas and one disposal backup, never all decoded frames. */
export class GifPlayer {
  readonly width: number;
  readonly height: number;
  readonly duration: number;
  readonly static: boolean;
  private parsed: ParsedGif;
  private frames: ImageFrame[];
  private times: number[] = [];
  private context: CanvasRenderingContext2D;
  private patch = document.createElement('canvas');
  private backup = document.createElement('canvas');
  private current = -1;
  private disposed = false;
  private request = 0;
  private running = false;
  private desired = 0;
  constructor(buffer: ArrayBuffer, private canvas: HTMLCanvasElement, private onError: (error: unknown) => void) {
    const info = inspectGif(new Uint8Array(buffer));
    if (info.width * info.height > NOTE_GIF_CONFIG.maxPixels) throw friendlyError('このGIFは解像度が大きすぎます。解像度を下げたファイルでお試しください。');
    this.width = info.width; this.height = info.height;
    this.static = info.frames === 1;
    this.duration = this.static ? Math.max(NOTE_GIF_CONFIG.minDuration, info.duration) : info.duration;
    this.parsed = parseGIF(buffer);
    this.frames = this.parsed.frames.filter((frame): frame is ImageFrame => 'image' in frame);
    let time = 0;
    for (const frame of this.frames) {
      const { width, height, left, top } = frame.image.descriptor;
      if (width * height > NOTE_GIF_CONFIG.maxPixels || left + width > this.width || top + height > this.height) throw friendlyError('GIFのフレームの大きさが不正です。別のGIFでお試しください。');
      this.times.push(time);
      const ticks = frame.gce?.delay ?? 0;
      time += ticks < 2 ? 0.1 : ticks / 100;
    }
    canvas.width = this.backup.width = this.width;
    canvas.height = this.backup.height = this.height;
    const context = canvas.getContext('2d');
    if (!context) throw friendlyError('このブラウザではプレビューを表示できません。別のブラウザでお試しください。');
    this.context = context;
    this.background(0, 0, this.width, this.height, this.frames[0]);
    this.draw(0);
  }
  seek(time: number) {
    let low = 0, high = this.times.length - 1;
    while (low < high) { const mid = Math.ceil((low + high) / 2); if (this.times[mid] <= time) low = mid; else high = mid - 1; }
    if (this.desired === low && this.current === low) return;
    this.desired = low;
    this.request++;
    if (!this.running) void this.renderUntilTarget();
  }
  private async renderUntilTarget() {
    this.running = true;
    try {
      while (!this.disposed && this.current !== this.desired) {
        if (this.desired < this.current) {
          this.context.clearRect(0, 0, this.width, this.height);
          this.background(0, 0, this.width, this.height, this.frames[0]);
          this.current = -1;
        }
        const version = this.request;
        const deadline = performance.now() + 12;
        do { this.draw(this.current + 1); } while (this.current < this.desired && performance.now() < deadline && version === this.request);
        if (this.current !== this.desired) await new Promise<void>(resolve => setTimeout(resolve, 0));
      }
    } catch (error) { this.disposed = true; this.onError(error); }
    finally { this.running = false; }
  }
  private background(x: number, y: number, width: number, height: number, frame: ImageFrame) {
    this.context.clearRect(x, y, width, height);
    const color = this.parsed.gct?.[this.parsed.lsd.backgroundColorIndex];
    if (!frame.gce?.extras.transparentColorGiven && color) {
      this.context.fillStyle = `rgb(${color.join(',')})`;
      this.context.fillRect(x, y, width, height);
    }
  }
  private draw(index: number) {
    const previous = this.frames[this.current];
    if (previous?.gce?.extras.disposal === 2) {
      const d = previous.image.descriptor;
      this.background(d.left, d.top, d.width, d.height, previous);
    } else if (previous?.gce?.extras.disposal === 3) {
      this.context.clearRect(0, 0, this.width, this.height);
      this.context.drawImage(this.backup, 0, 0);
    }
    const frame = this.frames[index];
    if (frame.gce?.extras.disposal === 3) {
      const backup = this.backup.getContext('2d')!;
      backup.clearRect(0, 0, this.width, this.height);
      backup.drawImage(this.canvas, 0, 0);
    }
    const decoded = decompressFrame(frame, this.parsed.gct, true);
    this.patch.width = decoded.dims.width;
    this.patch.height = decoded.dims.height;
    const patchContext = this.patch.getContext('2d')!;
    const image = patchContext.createImageData(decoded.dims.width, decoded.dims.height);
    image.data.set(decoded.patch);
    patchContext.putImageData(image, 0, 0);
    this.context.drawImage(this.patch, decoded.dims.left, decoded.dims.top);
    this.current = index;
  }
  destroy() {
    this.disposed = true;
    this.frames = [];
    this.parsed.frames = [];
    this.canvas.width = this.canvas.height = this.patch.width = this.patch.height = this.backup.width = this.backup.height = 1;
  }
}
