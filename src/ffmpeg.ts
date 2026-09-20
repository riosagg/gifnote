/*
 * Copyright (C) 2026 riosagg
 * SPDX-License-Identifier: GPL-2.0-or-later
 * This file is part of GIFnote and is licensed under GNU GPL version 2
 * or (at your option) any later version, WITHOUT ANY WARRANTY.
 * See the root LICENSE and COPYRIGHT files for details.
 */
import type { FFmpeg } from '@ffmpeg/ffmpeg';
import { compressionLevels, MB, NOTE_GIF_CONFIG as CONFIG, type CropRect, type OutputSettings } from './config';
import { inspectGif, limitGifDuration } from './gif-info';
import { conversionDuration } from './time-range';
import { clamp, friendlyError } from './utils';

export type StatusUpdate = (title: string, detail: string, progress?: number) => void;
export type ConvertRequest = {
  file: File; isGif: boolean; isStatic: boolean; start: number; end: number;
  crop: CropRect; settings: OutputSettings; upscale: boolean;
};

export class ConversionEngine {
  private engine?: FFmpeg;
  private logs: string[] = [];
  private generation = 0;
  cancel() { this.generation++; this.engine?.terminate(); this.engine = undefined; }
  private async load(status: StatusUpdate) {
    if (this.engine?.loaded) return this.engine;
    status('変換機能を準備しています…', '初回は約32 MBの変換機能をこのサイトから読み込みます。');
    const generation = this.generation;
    const { FFmpeg } = await import('@ffmpeg/ffmpeg');
    if (generation !== this.generation) throw new DOMException('Aborted', 'AbortError');
    const engine = new FFmpeg();
    this.engine = engine;
    engine.on('log', ({ message }) => { this.logs.push(message); if (this.logs.length > 40) this.logs.shift(); });
    const base = new URL(`${import.meta.env.BASE_URL}ffmpeg/`, document.baseURI);
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      await Promise.race([
        engine.load({ coreURL: new URL('ffmpeg-core.js', base).href, wasmURL: new URL('ffmpeg-core.wasm', base).href }),
        new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error('Initialization timed out')), 90_000); }),
      ]);
      return engine;
    } catch (error) {
      engine.terminate();
      if (this.engine === engine) this.engine = undefined;
      console.error('[GIFnote engine initialization]', error);
      throw friendlyError('変換機能を読み込めませんでした。ページを再読み込みして再度お試しください。ローカル利用時はnpm run devで起動してください。');
    } finally { clearTimeout(timer); }
  }
  private async execute(engine: FFmpeg, args: string[]) {
    this.logs = [];
    const code = await engine.exec(['-threads', '1', '-filter_threads', '1', '-filter_complex_threads', '1', ...args], CONFIG.engineTimeoutMs);
    if (code !== 0) {
      console.error('[GIFnote conversion]', this.logs.join('\n'));
      if (this.logs.some(line => /memory|alloc/i.test(line))) throw new Error('out of memory');
      throw friendlyError('変換を完了できませんでした。短い区間を選ぶか、解像度を下げたファイルでお試しください。対応形式でも動画の記録方式によって読み込めないことがあります。');
    }
  }
  private async clean(engine: FFmpeg, paths: string[]) {
    if (engine.loaded) await Promise.allSettled(paths.map(path => engine.deleteFile(path)));
  }
  async convert(request: ConvertRequest, status: StatusUpdate) {
    const { file, isGif, isStatic, crop, settings, upscale, start, end } = request;
    const duration = conversionDuration(start, end);
    const engine = await this.load(status);
    const input = `input.${isGif ? 'gif' : file.name.split('.').pop()?.toLowerCase() || 'mp4'}`;
    let updateProgress: (event: { time: number }) => void = () => {};
    const listener = (event: { time: number }) => updateProgress(event);
    engine.on('progress', listener);
    let best: { bytes: Uint8Array; settings: OutputSettings; level: number } | undefined;
    try {
      status('ファイルを読み込んでいます…', '元ファイルはこのブラウザのメモリだけに読み込みます。');
      await engine.writeFile(input, new Uint8Array(await file.arrayBuffer()));
      const levels = compressionLevels(settings);
      for (let index = 0; index < levels.length; index++) {
        const hadSafeResult = Boolean(best);
        const level = levels[index];
        const width = Math.max(1, Math.min(level.width, upscale ? level.width : crop.width));
        // An integer output height is required by GIF; preserve aspect within one pixel.
        const height = Math.max(1, Math.round(width * crop.height / crop.width));
        const filter = `crop=${crop.width}:${crop.height}:${crop.x}:${crop.y}:exact=1,scale=${width}:${height}:flags=lanczos,setsar=1,fps=${level.fps}:eof_action=pass`;
        // Limit the INPUT too: palettegen waits for EOF, especially for a looped still GIF.
        const source = [...(isStatic ? ['-stream_loop', '-1'] : []), ...(isGif ? ['-ignore_loop', '1', '-min_delay', '2'] : []), '-ss', String(start), '-t', String(duration), '-i', input];
        const output = ['-t', String(duration), '-an', '-sn'];
        const title = index === 0 ? 'GIFを作成しています…' : 'note向けサイズに調整しています…';
        const detail = `${index + 1}/${levels.length} 段階目 · ${width}px / ${level.fps}fps / ${level.colors}色`;
        updateProgress = ({ time }) => status(title, `${detail} · 色を整えています`, clamp(time / 1_000_000 / duration * 45, 0, 44));
        status(title, `${detail} · 色を整えています`, 0);
        await this.execute(engine, [...source, ...output, '-vf', `${filter},palettegen=max_colors=${level.colors}:reserve_transparent=1:stats_mode=diff`, '-frames:v', '1', '-update', '1', 'palette.png']);
        updateProgress = ({ time }) => status(title, `${detail} · GIFを書き出しています`, clamp(45 + time / 1_000_000 / duration * 55, 45, 99));
        await this.execute(engine, [...source, '-i', 'palette.png', ...output, '-filter_complex', `[0:v]${filter}[v];[v][1:v]paletteuse=dither=sierra2_4a:diff_mode=rectangle`, '-loop', '0', 'output.gif']);
        const generated = await engine.readFile('output.gif');
        if (!(generated instanceof Uint8Array) || !generated.length) throw friendlyError('GIFを生成できませんでした。別の区間でお試しください。');
        const data = limitGifDuration(generated, duration);
        await this.clean(engine, ['palette.png', 'output.gif']);
        if (data.byteLength < CONFIG.maxFileSizeMB * MB && (!best || data.byteLength < best.bytes.byteLength)) best = { bytes: data, settings: level, level: index };
        if (data.byteLength <= CONFIG.preferredFileSizeMB * MB) { best = { bytes: data, settings: level, level: index }; break; }
        // Do not sacrifice several more quality levels when already below the hard limit.
        if (hadSafeResult && best) break;
      }
      if (!best) throw friendlyError(`軽量化しても${CONFIG.maxFileSizeMB} MB未満に収まりませんでした。時間を短くするか、画角を狭くして再度お試しください。`);
      const info = inspectGif(best.bytes);
      if (info.duration > duration || info.duration > CONFIG.maxDuration) throw new Error('GIF duration exceeds selection');
      const blob = new Blob([new Uint8Array(best.bytes)], { type: 'image/gif' });
      return { blob, info, settings: best.settings, adjusted: best.level > 0 };
    } finally {
      engine.off('progress', listener);
      await this.clean(engine, [input, 'palette.png', 'output.gif']);
      // Terminate after each job so the WASM heap also returns to the browser.
      if (this.engine === engine) this.cancel();
    }
  }
  async videoProxy(file: File, status: StatusUpdate): Promise<{ blob: Blob; width: number; height: number }> {
    const engine = await this.load(status);
    const input = `preview-input.${file.name.split('.').pop()?.toLowerCase() || 'mov'}`;
    try {
      status('プレビューを準備しています…', 'この動画の記録方式に合わせて、音声なしのプレビューを作成しています。長い動画では数分かかる場合があります。');
      await engine.writeFile(input, new Uint8Array(await file.arrayBuffer()));
      const probeCode = await engine.ffprobe(['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height:stream_side_data=rotation', '-of', 'json', input, '-o', 'metadata.json']);
      // core 0.12.10 can leave ret at -1 on successful ffprobe; validate its JSON below.
      if (probeCode > 0) throw friendlyError('動画の大きさを読み取れませんでした。別の動画でお試しください。');
      const metadata = JSON.parse(String(await engine.readFile('metadata.json', 'utf8'))) as { streams?: { width: number; height: number; side_data_list?: { rotation?: number }[] }[] };
      const stream = metadata.streams?.[0];
      if (!stream?.width || !stream.height) throw friendlyError('動画の映像を見つけられませんでした。');
      if (stream.width * stream.height > CONFIG.maxPixels) throw friendlyError('この動画は解像度が大きすぎます。解像度を下げたファイルでお試しください。');
      const rotation = stream.side_data_list?.find(item => item.rotation !== undefined)?.rotation ?? 0;
      const rotated = Math.abs(rotation % 180) === 90;
      await this.execute(engine, ['-i', input, '-map', '0:v:0', '-vf', "scale=w='min(960,iw)':h=-2,setsar=1,fps=24", '-an', '-sn', '-c:v', 'libx264', '-preset', 'ultrafast', '-crf', '28', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', 'preview.mp4']);
      const data = await engine.readFile('preview.mp4');
      if (!(data instanceof Uint8Array)) throw new Error('Invalid preview');
      return { blob: new Blob([new Uint8Array(data)], { type: 'video/mp4' }), width: rotated ? stream.height : stream.width, height: rotated ? stream.width : stream.height };
    } finally {
      await this.clean(engine, [input, 'preview.mp4', 'metadata.json']);
      if (this.engine === engine) this.cancel();
    }
  }
}
