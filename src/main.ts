/*
 * Copyright (C) 2026 riosagg
 * SPDX-License-Identifier: GPL-2.0-or-later
 * This file is part of GIFnote and is licensed under GNU GPL version 2
 * or (at your option) any later version, WITHOUT ANY WARRANTY.
 * See the root LICENSE and COPYRIGHT files for details.
 */
import './styles.css';
import { DEFAULT_SETTINGS, MB, NOTE_GIF_CONFIG as CONFIG } from './config';
import { CropController } from './crop';
import { ConversionEngine, type StatusUpdate } from './ffmpeg';
import { MediaController } from './media';
import { Timeline } from './timeline';
import { element, sizeLabel, timeLabel, userError } from './utils';

const engine = new ConversionEngine();
const media = new MediaController();
const crop = new CropController();
const timeline = new Timeline(time => { media.pause(); media.seek(time); });
const input = element<HTMLInputElement>('file-input');
const editor = element<HTMLFieldSetElement>('editor');
const dropZone = element<HTMLButtonElement>('drop-zone');
let busy = false;
let operation: AbortController | undefined;
let resultURL: string | undefined;

element('default-duration').textContent = `最大 ${CONFIG.maxDuration} 秒`;
element('default-width').textContent = `最大 ${CONFIG.maxWidth} px`;
element('default-fps').textContent = `${CONFIG.defaultFps} fps`;
element('default-size').textContent = `${CONFIG.maxFileSizeMB} MB未満`;
element('feature-duration').textContent = `動画の途中からでも、最大${CONFIG.maxDuration}秒。記事に必要な動きだけを切り出せます。`;
for (const [id, values, unit] of [
  ['output-width', [DEFAULT_SETTINGS.width, 560, 520, 420, 320].filter(value => value <= CONFIG.maxWidth), 'px'],
  ['output-fps', [DEFAULT_SETTINGS.fps, 8, 7, 5], 'fps'],
  ['output-colors', [DEFAULT_SETTINGS.colors, 256, 96, 64], '色'],
] as const) {
  const select = element<HTMLSelectElement>(id);
  select.replaceChildren(...[...new Set(values)].map(value => new Option(`${value} ${unit}`, String(value))));
}
element<HTMLInputElement>('output-width').value = String(DEFAULT_SETTINGS.width);
element<HTMLInputElement>('output-fps').value = String(DEFAULT_SETTINGS.fps);
element<HTMLInputElement>('output-colors').value = String(DEFAULT_SETTINGS.colors);

const status: StatusUpdate = (title, detail, progress) => {
  if (operation?.signal.aborted) return;
  element('status-panel').hidden = false;
  element('status-text').textContent = title;
  element('status-detail').textContent = detail;
  const bar = element<HTMLProgressElement>('progress');
  if (progress === undefined) bar.removeAttribute('value');
  else bar.value = progress;
};
function setBusy(value: boolean) {
  busy = value;
  editor.disabled = value;
  dropZone.disabled = value;
  element('crop-box').tabIndex = value ? -1 : 0;
  element('selected-track').tabIndex = value ? -1 : 0;
  element<HTMLButtonElement>('cancel').disabled = false;
  element('status-panel').hidden = !value;
  editor.setAttribute('aria-busy', String(value));
}
function showError(error: unknown) { element('error').textContent = userError(error); element('error').hidden = false; }
function clearResult() {
  element('result').hidden = true;
  element<HTMLImageElement>('result-image').removeAttribute('src');
  element<HTMLAnchorElement>('download').removeAttribute('href');
  element<HTMLAnchorElement>('download').removeAttribute('download');
  element('result-stats').replaceChildren();
  element('result-note').textContent = ''; 
  if (resultURL) URL.revokeObjectURL(resultURL);
  resultURL = undefined;
  element('step-3').classList.remove('active');
}
function checkWarning(file: File) {
  const warnings: string[] = [];
  if (file.size >= CONFIG.warnInputSizeMB * MB || media.width * media.height >= CONFIG.warnPixels || media.duration >= CONFIG.warnDuration) warnings.push('大きなファイルです。処理に時間がかかったり、端末のメモリが足りなくなることがあります。短い範囲からお試しください。');
  if (media.proxy) warnings.push('この動画は表示用の軽いプレビューを作成しています。GIFは元の動画から変換します。');
  if (media.isStatic) warnings.push('静止GIFです。同じ画像を表示するGIFとして書き出します。');
  element('warning').textContent = warnings.join(' ');
  element('warning').hidden = !warnings.length;
}
async function openFile(file: File) {
  if (busy) return;
  operation = new AbortController();
  const current = operation;
  media.pause(); clearResult(); setBusy(true);
  editor.hidden = true;
  element('error').hidden = element('warning').hidden = true;
  status('ファイルを読み込んでいます…', '動画の長さや大きさを確認しています。');
  if (file.size >= CONFIG.warnInputSizeMB * MB) {
    element('warning').textContent = '大きなファイルです。読み込みやプレビューの準備に時間がかかることがあります。';
    element('warning').hidden = false;
  }
  try {
    await media.open(file, engine, (...args) => { if (operation === current) status(...args); }, current.signal);
    current.signal.throwIfAborted();
    timeline.reset(media.duration);
    crop.reset(media.width, media.height);
    element('file-name').textContent = file.name;
    element('file-info').textContent = `${media.isGif ? 'GIF' : '動画'} · ${media.width} × ${media.height} · ${timeLabel(media.duration)} · ${sizeLabel(file.size)}`;
    checkWarning(file);
    editor.hidden = false;
    element('upload-section').hidden = element('features').hidden = true;
    element('step-2').classList.add('active');
  } catch (error) {
    if (operation !== current) return;
    media.destroy();
    element('upload-section').hidden = element('features').hidden = false;
    element('warning').hidden = true;
    element('step-2').classList.remove('active');
    if (operation === current && !current.signal.aborted) showError(error);
  } finally {
    if (operation === current) { setBusy(false); operation = undefined; input.value = ''; }
  }
}
dropZone.addEventListener('click', () => input.click());
element('replace-file').addEventListener('click', () => input.click());
input.addEventListener('change', () => { const file = input.files?.[0]; if (file) void openFile(file); });
let dragDepth = 0;
function resetCurrentFile() {
  // Invalidate callbacks before releasing resources; old promises must not reset a new file.
  const previous = operation;
  operation = undefined;
  previous?.abort();
  engine.cancel(); // Terminates the Worker and its entire virtual FS/heap.
  media.destroy(); clearResult(); timeline.reset(0); crop.reset(1, 1);
  element('crop-size').textContent = '';
  input.value = '';
  dragDepth = 0; dropZone.classList.remove('dragging');
  for (const id of ['file-name', 'file-info', 'error', 'warning', 'status-text', 'status-detail']) element(id).textContent = '';
  element('error').hidden = element('warning').hidden = true;
  element<HTMLProgressElement>('progress').value = 0;
  for (const [id, value] of [['output-width', DEFAULT_SETTINGS.width], ['output-fps', DEFAULT_SETTINGS.fps], ['output-colors', DEFAULT_SETTINGS.colors]] as const) element<HTMLSelectElement>(id).value = String(value);
  element<HTMLInputElement>('upscale-crop').checked = false;
  setBusy(false);
  editor.hidden = true;
  element('upload-section').hidden = element('features').hidden = false;
  element('step-2').classList.remove('active');
  dropZone.focus();
}
element('clear-file').addEventListener('click', resetCurrentFile);

document.addEventListener('dragover', event => { event.preventDefault(); if (event.dataTransfer) event.dataTransfer.dropEffect = busy ? 'none' : 'copy'; });
document.addEventListener('dragenter', event => { event.preventDefault(); if (!busy && ++dragDepth > 0) dropZone.classList.add('dragging'); });
document.addEventListener('dragleave', () => { dragDepth = Math.max(0, dragDepth - 1); if (!dragDepth) dropZone.classList.remove('dragging'); });
document.addEventListener('drop', event => {
  event.preventDefault(); dragDepth = 0; dropZone.classList.remove('dragging');
  if (busy) return;
  const files = event.dataTransfer?.files;
  if (files && files.length > 1) { element('error').textContent = '一度に1つのファイルを選択してください。'; element('error').hidden = false; return; }
  if (files?.[0]) void openFile(files[0]);
});
media.onTime = time => timeline.setHead(time);
media.onPause = () => { element('play').textContent = '▶ 選択範囲を再生'; };
media.onError = showError;
element('play').addEventListener('click', async () => {
  if (media.playing) { media.pause(); return; }
  try {
    await media.play(timeline.start, timeline.end);
    if (media.playing) element('play').textContent = 'Ⅱ 一時停止';
  } catch (error) { showError(error); }
});
element('cancel').addEventListener('click', () => {
  operation?.abort(); engine.cancel();
  element('status-text').textContent = '処理を中止しています…';
  element<HTMLButtonElement>('cancel').disabled = true;
});
element('convert').addEventListener('click', async () => {
  if (busy || !media.file) return;
  media.pause(); clearResult(); element('error').hidden = true;
  operation = new AbortController();
  const current = operation;
  const file = media.file;
  setBusy(true);
  try {
    const result = await engine.convert({
      file, isGif: media.isGif, isStatic: media.isStatic,
      start: timeline.start, end: timeline.end, crop: crop.pixels,
      upscale: crop.enabled && element<HTMLInputElement>('upscale-crop').checked,
      settings: {
        width: Math.min(CONFIG.maxWidth, Number(element<HTMLSelectElement>('output-width').value)),
        fps: Number(element<HTMLSelectElement>('output-fps').value),
        colors: Number(element<HTMLSelectElement>('output-colors').value),
      },
    }, (...args) => { if (operation === current) status(...args); });
    current.signal.throwIfAborted();
    resultURL = URL.createObjectURL(result.blob);
    element<HTMLImageElement>('result-image').src = resultURL;
    const download = element<HTMLAnchorElement>('download');
    download.href = resultURL;
    download.download = `${file.name.replace(/\.[^.]+$/, '') || 'animation'}-note.gif`;
    const stats = element('result-stats');
    stats.replaceChildren();
    for (const [name, value] of [
      ['長さ', `${result.info.duration.toFixed(2)} 秒`],
      ['サイズ', `${result.info.width} × ${result.info.height}`],
      ['フレームレート', `約 ${(result.info.frames / result.info.duration).toFixed(1)} fps`],
      ['フレーム数', String(result.info.frames)],
      ['容量', sizeLabel(result.blob.size)],
    ]) {
      const row = document.createElement('div'), dt = document.createElement('dt'), dd = document.createElement('dd');
      dt.textContent = name; dd.textContent = value; row.append(dt, dd); stats.append(row);
    }
    element('result-note').textContent = result.adjusted ? `容量に合わせて自動調整しました（設定: ${result.settings.fps}fps・${result.settings.colors}色）。` : '記事に載せやすいサイズに仕上がりました。';
    element('result').hidden = false;
    element('step-3').classList.add('active');
    element('result').scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth', block: 'start' });
    element('result-heading').tabIndex = -1;
    element('result-heading').focus({ preventScroll: true });
  } catch (error) {
    if (operation === current && !current.signal.aborted) showError(error);
  } finally { if (operation === current) { setBusy(false); operation = undefined; } }
});
document.addEventListener('visibilitychange', () => { if (document.hidden) media.pause(); });
window.addEventListener('pagehide', event => {
  operation?.abort(); engine.cancel(); media.pause();
  if (!event.persisted) { media.destroy(); clearResult(); }
});
