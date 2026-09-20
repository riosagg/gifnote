/*
 * Copyright (C) 2026 riosagg
 * SPDX-License-Identifier: GPL-2.0-or-later
 * This file is part of GIFnote and is licensed under GNU GPL version 2
 * or (at your option) any later version, WITHOUT ANY WARRANTY.
 * See the root LICENSE and COPYRIGHT files for details.
 */
import { MB, NOTE_GIF_CONFIG as CONFIG } from './config';
import { GifPlayer } from './gif-player';
import { ConversionEngine, type StatusUpdate } from './ffmpeg';
import { clamp, element, friendlyError } from './utils';

export class MediaController {
  file?: File;
  width = 0;
  height = 0;
  duration = 0;
  isGif = false;
  isStatic = false;
  proxy = false;
  playing = false;
  time = 0;
  private video = element<HTMLVideoElement>('video');
  private canvas = element<HTMLCanvasElement>('gif-canvas');
  private gif?: GifPlayer;
  private url?: string;
  private animation = 0;
  private start = 0;
  private end = 1;
  private previous = 0;
  onTime: (time: number) => void = () => {};
  onPause: () => void = () => {};
  onError: (error: unknown) => void = () => {};
  constructor() {
    this.video.addEventListener('ended', () => {
      if (this.playing) { this.video.currentTime = this.start; void this.video.play().catch(error => { this.pause(); this.onError(error); }); }
    });
  }
  async open(file: File, engine: ConversionEngine, status: StatusUpdate, signal: AbortSignal) {
    this.destroy();
    if (!file.size) throw friendlyError('ファイルが空です。別のファイルを選んでください。');
    if (file.size > CONFIG.maxInputSizeMB * MB) throw friendlyError(`このファイルはブラウザで扱うには大きすぎます。${CONFIG.maxInputSizeMB} MB以下のファイルでお試しください。`);
    const head = new Uint8Array(await file.slice(0, 16).arrayBuffer());
    signal.throwIfAborted();
    const signature = new TextDecoder().decode(head.subarray(0, 6));
    this.isGif = /^GIF8[79]a$/.test(signature);
    const isMp4 = new TextDecoder().decode(head.subarray(4, 8)) === 'ftyp';
    const isWebm = head[0] === 0x1a && head[1] === 0x45 && head[2] === 0xdf && head[3] === 0xa3;
    const extension = file.name.split('.').pop()?.toLowerCase();
    if (!this.isGif && !isMp4 && !isWebm && !['mp4', 'webm', 'mov'].includes(extension || '')) throw friendlyError('MP4・WebM・MOV形式の動画、またはGIFを選択してください。');
    this.file = file;
    if (this.isGif) {
      const data = await file.arrayBuffer();
      signal.throwIfAborted();
      this.gif = new GifPlayer(data, this.canvas, error => { this.pause(); this.onError(error); });
      this.width = this.gif.width; this.height = this.gif.height; this.duration = this.gif.duration; this.isStatic = this.gif.static;
      this.canvas.hidden = false;
    } else {
      this.url = URL.createObjectURL(file);
      try { await this.loadVideo(this.url, signal); }
      catch (error) {
        signal.throwIfAborted();
        console.info('[GIFnote] Preparing compatible video preview', error);
        this.video.removeAttribute('src'); this.video.load();
        URL.revokeObjectURL(this.url);
        this.url = undefined;
        const preview = await engine.videoProxy(file, status);
        signal.throwIfAborted();
        this.url = URL.createObjectURL(preview.blob);
        await this.loadVideo(this.url, signal);
        this.width = preview.width; this.height = preview.height;
        this.proxy = true;
      }
      signal.throwIfAborted();
      if (!this.proxy) { this.width = this.video.videoWidth; this.height = this.video.videoHeight; }
      this.duration = this.video.duration;
      this.video.hidden = false;
    }
    if (!Number.isFinite(this.duration) || this.duration <= 0 || !this.width || !this.height) throw friendlyError('動画の長さや大きさを読み取れませんでした。保存し直したファイルでお試しください。');
    if (this.width * this.height > CONFIG.maxPixels) throw friendlyError('解像度が大きすぎます。解像度を下げたファイルでお試しください。');
    element('media-stage').style.aspectRatio = `${this.width} / ${this.height}`;
    element('media-stage').style.width = `min(100%, ${420 * this.width / this.height}px)`;
    this.seek(0);
  }
  private loadVideo(url: string, signal: AbortSignal) {
    return new Promise<void>((resolve, reject) => {
      const cleanup = () => { clearTimeout(timer); this.video.removeEventListener('loadeddata', ready); this.video.removeEventListener('error', failed); signal.removeEventListener('abort', aborted); };
      const ready = () => {
        if (!Number.isFinite(this.video.duration) || this.video.duration <= 0) { failed(); return; }
        cleanup(); resolve();
      };
      const failed = () => { cleanup(); reject(new Error('Browser cannot decode source video')); };
      const aborted = () => { cleanup(); reject(new DOMException('Aborted', 'AbortError')); };
      const timer = setTimeout(failed, 15_000);
      this.video.addEventListener('loadeddata', ready, { once: true });
      this.video.addEventListener('error', failed, { once: true });
      signal.addEventListener('abort', aborted, { once: true });
      if (signal.aborted) { aborted(); return; }
      this.video.preload = 'auto'; this.video.src = url; this.video.load();
    });
  }
  seek(time: number) {
    this.time = clamp(time, 0, this.duration);
    if (this.gif) this.gif.seek(this.time);
    else if (this.video.readyState >= 1) this.video.currentTime = this.time;
    this.onTime(this.time);
  }
  async play(start: number, end: number) {
    this.pause();
    this.start = start; this.end = end;
    if (this.time < start || this.time >= end - 0.01) this.seek(start);
    this.playing = true;
    if (!this.gif) {
      try { await this.video.play(); } catch (error) { this.pause(); throw error; }
      if (!this.playing) { this.video.pause(); return; }
    }
    this.previous = performance.now();
    this.animation = requestAnimationFrame(this.tick);
  }
  private tick = (now: number) => {
    if (!this.playing) return;
    if (this.gif) {
      const time = this.time + (now - this.previous) / 1000;
      this.seek(time >= this.end ? this.start + (time - this.start) % (this.end - this.start) : time);
    } else {
      if (this.video.currentTime >= this.end) this.video.currentTime = this.start;
      this.time = this.video.currentTime;
      this.onTime(this.time);
    }
    this.previous = now;
    this.animation = requestAnimationFrame(this.tick);
  };
  pause() { this.playing = false; cancelAnimationFrame(this.animation); this.video.pause(); this.onPause(); }
  destroy() {
    this.pause();
    this.gif?.destroy(); this.gif = undefined;
    this.video.removeAttribute('src'); this.video.load();
    if (this.url) URL.revokeObjectURL(this.url);
    this.url = undefined; this.file = undefined;
    this.video.hidden = this.canvas.hidden = true;
    this.isGif = this.isStatic = this.proxy = false;
    this.width = this.height = this.duration = this.time = this.start = this.end = this.previous = 0;
    this.animation = 0;
    this.canvas.width = this.canvas.height = 1;
    element('media-stage').style.removeProperty('aspect-ratio');
    element('media-stage').style.removeProperty('width');
    this.onTime(0);
  }
}
