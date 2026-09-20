/*
 * Copyright (C) 2026 riosagg
 * SPDX-License-Identifier: GPL-2.0-or-later
 * This file is part of GIFnote and is licensed under GNU GPL version 2
 * or (at your option) any later version, WITHOUT ANY WARRANTY.
 * See the root LICENSE and COPYRIGHT files for details.
 */
import type { CropRect } from './config';
import { clamp, element } from './utils';

export class CropController {
  private rect: CropRect = { x: 0, y: 0, width: 1, height: 1 };
  private width = 1;
  private height = 1;
  private ratio: number | null = null;
  private mode = 'none';
  private overlay = element('crop-overlay');
  private box = element('crop-box');
  private drag?: { pointer: number; handle: string; x: number; y: number; rect: CropRect; bounds: DOMRect };
  constructor() {
    element('crop-presets').addEventListener('click', event => {
      const button = (event.target as HTMLElement).closest<HTMLButtonElement>('button[data-ratio]');
      if (button) this.select(button.dataset.ratio!);
    });
    element('crop-reset').addEventListener('click', () => this.select('none'));
    this.box.addEventListener('pointerdown', event => {
      if (event.button !== 0 || element<HTMLFieldSetElement>('editor').disabled) return;
      event.preventDefault();
      this.box.focus();
      this.drag = { pointer: event.pointerId, handle: (event.target as HTMLElement).dataset.handle || 'move', x: event.clientX, y: event.clientY, rect: { ...this.rect }, bounds: this.overlay.getBoundingClientRect() };
      this.box.setPointerCapture(event.pointerId);
    });
    this.box.addEventListener('pointermove', event => {
      if (!this.drag || this.drag.pointer !== event.pointerId) return;
      const d = this.drag;
      const dx = (event.clientX - d.x) / d.bounds.width;
      const dy = (event.clientY - d.y) / d.bounds.height;
      if (d.handle === 'move') this.rect = { ...d.rect, x: clamp(d.rect.x + dx, 0, 1 - d.rect.width), y: clamp(d.rect.y + dy, 0, 1 - d.rect.height) };
      else this.resize(d.rect, d.handle, dx, dy);
      this.render();
    });
    for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) this.box.addEventListener(type, () => { this.drag = undefined; });
    this.box.addEventListener('keydown', event => {
      if (!event.key.startsWith('Arrow') || element<HTMLFieldSetElement>('editor').disabled) return;
      event.preventDefault();
      const dx = event.key === 'ArrowLeft' ? -0.01 : event.key === 'ArrowRight' ? 0.01 : 0;
      const dy = event.key === 'ArrowUp' ? -0.01 : event.key === 'ArrowDown' ? 0.01 : 0;
      if (event.shiftKey) this.resize(this.rect, dx ? 'e' : 's', dx, dy);
      else { this.rect.x = clamp(this.rect.x + dx, 0, 1 - this.rect.width); this.rect.y = clamp(this.rect.y + dy, 0, 1 - this.rect.height); }
      this.render();
    });
  }
  reset(width: number, height: number) {
    const pointer = this.drag?.pointer;
    this.drag = undefined;
    if (pointer !== undefined && this.box.hasPointerCapture(pointer)) this.box.releasePointerCapture(pointer);
    this.width = width; this.height = height; this.select('none');
  }
  get enabled() { return this.mode !== 'none'; }
  get pixels(): CropRect {
    const x = Math.min(this.width - 1, Math.round(this.rect.x * this.width));
    const y = Math.min(this.height - 1, Math.round(this.rect.y * this.height));
    return { x, y, width: clamp(Math.round(this.rect.width * this.width), 1, this.width - x), height: clamp(Math.round(this.rect.height * this.height), 1, this.height - y) };
  }
  private select(mode: string) {
    this.mode = mode;
    this.ratio = mode.includes(':') ? Number(mode.split(':')[0]) / Number(mode.split(':')[1]) : null;
    let width = mode === 'free' ? 0.8 : 1, height = mode === 'free' ? 0.8 : 1;
    if (this.ratio) {
      const normalized = this.ratio * this.height / this.width;
      width = Math.min(1, normalized); height = Math.min(1, 1 / normalized);
    }
    this.rect = { x: (1 - width) / 2, y: (1 - height) / 2, width, height };
    this.overlay.hidden = mode === 'none';
    element('crop-presets').querySelectorAll('button').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.ratio === mode)));
    this.render();
  }
  private resize(rect: CropRect, handle: string, dx: number, dy: number) {
    const minW = Math.min(1, 8 / this.width), minH = Math.min(1, 8 / this.height);
    const left = handle.includes('w'), right = handle.includes('e'), top = handle.includes('n'), bottom = handle.includes('s');
    if (!this.ratio) {
      const x1 = left ? clamp(rect.x + dx, 0, rect.x + rect.width - minW) : rect.x;
      const x2 = right ? clamp(rect.x + rect.width + dx, rect.x + minW, 1) : rect.x + rect.width;
      const y1 = top ? clamp(rect.y + dy, 0, rect.y + rect.height - minH) : rect.y;
      const y2 = bottom ? clamp(rect.y + rect.height + dy, rect.y + minH, 1) : rect.y + rect.height;
      this.rect = { x: x1, y: y1, width: x2 - x1, height: y2 - y1 };
      return;
    }
    const ratio = this.ratio * this.height / this.width;
    const anchorX = left ? rect.x + rect.width : right ? rect.x : rect.x + rect.width / 2;
    const anchorY = top ? rect.y + rect.height : bottom ? rect.y : rect.y + rect.height / 2;
    const maxW = left ? anchorX : right ? 1 - anchorX : 2 * Math.min(anchorX, 1 - anchorX);
    const maxH = top ? anchorY : bottom ? 1 - anchorY : 2 * Math.min(anchorY, 1 - anchorY);
    let width = rect.width + (left ? -dx : right ? dx : (top ? -dy : dy) * ratio);
    if ((left || right) && (top || bottom) && Math.abs(dy * ratio) > Math.abs(dx)) width = (rect.height + (top ? -dy : dy)) * ratio;
    const upper = Math.min(maxW, maxH * ratio);
    width = clamp(width, Math.min(upper, Math.max(minW, minH * ratio)), upper);
    const height = width / ratio;
    this.rect = { x: left ? anchorX - width : right ? anchorX : anchorX - width / 2, y: top ? anchorY - height : bottom ? anchorY : anchorY - height / 2, width, height };
  }
  private render() {
    Object.assign(this.box.style, { left: `${this.rect.x * 100}%`, top: `${this.rect.y * 100}%`, width: `${this.rect.width * 100}%`, height: `${this.rect.height * 100}%` });
    const pixels = this.pixels;
    element('crop-size').textContent = `${pixels.width} × ${pixels.height}`;
  }
}
