/*
 * Copyright (C) 2026 riosagg
 * SPDX-License-Identifier: GPL-2.0-or-later
 * This file is part of GIFnote and is licensed under GNU GPL version 2
 * or (at your option) any later version, WITHOUT ANY WARRANTY.
 * See the root LICENSE and COPYRIGHT files for details.
 */
import { NOTE_GIF_CONFIG as CONFIG } from './config';
import { clamp, element, timeLabel } from './utils';
import { moveSelection } from './time-range';

export class Timeline {
  start = 0;
  end = 1;
  duration = 1;
  private startRange = element<HTMLInputElement>('start-range');
  private endRange = element<HTMLInputElement>('end-range');
  private startNumber = element<HTMLInputElement>('start-number');
  private endNumber = element<HTMLInputElement>('end-number');
  private scrub = element<HTMLInputElement>('scrub');
  private track = element('selected-track');
  private drag?: { mode: 'move'; pointer: number; x: number; width: number; start: number; end: number };
  constructor(private onChange: (time: number) => void) {
    this.track.addEventListener('pointerdown', event => {
      if (event.button !== 0 || this.drag || element<HTMLFieldSetElement>('editor').disabled) return;
      // Future resize handles can have their own data-handle and independent mode.
      if ((event.target as HTMLElement).closest('[data-handle]')) return;
      const width = element('timeline-visual').getBoundingClientRect().width;
      if (!width || !this.duration) return;
      event.preventDefault(); this.track.focus();
      this.drag = { mode: 'move', pointer: event.pointerId, x: event.clientX, width, start: this.start, end: this.end };
      this.track.setPointerCapture(event.pointerId);
      this.track.classList.add('is-dragging');
    });
    const move = (event: PointerEvent) => {
      const d = this.drag;
      if (!d || d.pointer !== event.pointerId || d.mode !== 'move') return;
      if (element<HTMLFieldSetElement>('editor').disabled) { this.endDrag(); return; }
      const delta = (event.clientX - d.x) / d.width * this.duration;
      this.move(d.start, d.end, delta);
    };
    this.track.addEventListener('pointermove', move);
    this.track.addEventListener('pointerup', event => { move(event); if (this.drag?.pointer === event.pointerId) this.endDrag(); });
    for (const type of ['pointercancel', 'lostpointercapture'] as const) this.track.addEventListener(type, event => {
      if (this.drag?.pointer === event.pointerId) this.endDrag();
    });
    this.track.addEventListener('keydown', event => {
      if (element<HTMLFieldSetElement>('editor').disabled || this.drag) return;
      const next = this.keyboardValue(event, this.start, true);
      if (next !== undefined) this.move(this.start, this.end, next - this.start);
    });
    for (const [input, edge] of [[this.startRange, 'start'], [this.endRange, 'end'], [this.startNumber, 'start'], [this.endNumber, 'end']] as const) {
      input.addEventListener(input.type === 'range' ? 'input' : 'change', () => {
        // Map the displayed end time back to the exact source duration (GIF sums
        // can contain floating-point noise such as 4.840000000000003).
        const entered = input.valueAsNumber;
        const value = entered === Number(this.duration.toFixed(6)) ? this.duration : entered;
        this.update(edge, input.type === 'range' ? this.snapRange(value) : value);
      });
      input.addEventListener('keydown', event => {
        const value = this.keyboardValue(event, this[edge], input.type === 'range');
        if (value !== undefined) this.update(edge, value);
      });
    }
    this.scrub.addEventListener('input', () => this.onChange(Number(this.scrub.value)));
    this.scrub.addEventListener('keydown', event => {
      const value = this.keyboardValue(event, Number(this.scrub.value), true);
      if (value !== undefined) this.onChange(value);
    });
  }
  reset(duration: number) {
    this.endDrag();
    this.duration = duration;
    this.start = 0;
    this.end = Math.min(duration, CONFIG.maxDuration);
    // The timeline spans the entire source, independent of the selection's 15-second cap.
    for (const input of [this.startRange, this.endRange, this.startNumber, this.endNumber, this.scrub]) {
      input.min = '0';
      input.max = String(duration);
      // A decimal duration need not be a multiple of 0.1. Native stepping otherwise
      // sanitizes e.g. value=4.84 to 4.8 even when max=4.84.
      input.step = 'any';
    }
    element('total-time').textContent = timeLabel(duration);
    this.render();
    this.setHead(0);
  }
  private endDrag() {
    const pointer = this.drag?.pointer;
    this.drag = undefined;
    this.track.classList.remove('is-dragging');
    if (pointer !== undefined && this.track.hasPointerCapture(pointer)) this.track.releasePointerCapture(pointer);
  }
  private move(start: number, end: number, delta: number) {
    const moved = moveSelection(start, end, delta, this.duration);
    this.start = moved.start; this.end = moved.end;
    this.render();
    this.onChange(this.start);
  }
  private snapRange(value: number) {
    // Preserve both exact endpoints; use 0.1-second increments elsewhere.
    if (value <= 0) return 0;
    if (value >= this.duration) return this.duration;
    return clamp(Math.round(value * 10) / 10, 0, this.duration);
  }
  private keyboardValue(event: KeyboardEvent, current: number, isRange: boolean): number | undefined {
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    let value: number;
    if (event.key === 'ArrowUp' || (isRange && event.key === 'ArrowRight')) value = current + 0.1;
    else if (event.key === 'ArrowDown' || (isRange && event.key === 'ArrowLeft')) value = current - 0.1;
    else if (isRange && event.key === 'Home') value = 0;
    else if (isRange && event.key === 'End') value = this.duration;
    else return;
    event.preventDefault();
    if (value <= 0) return 0;
    if (value >= this.duration) return this.duration;
    return Number(value.toFixed(10));
  }
  private update(edge: 'start' | 'end', value: number) {
    if (!Number.isFinite(value)) { this.render(); return; }
    const minimum = Math.min(CONFIG.minDuration, this.duration);
    if (edge === 'start') {
      this.start = clamp(value, 0, this.duration - minimum);
      this.end = clamp(this.end, this.start + minimum, Math.min(this.duration, this.start + CONFIG.maxDuration));
    } else {
      this.end = clamp(value, minimum, this.duration);
      this.start = clamp(this.start, Math.max(0, this.end - CONFIG.maxDuration), this.end - minimum);
    }
    this.render();
    this.onChange(edge === 'start' ? this.start : Math.max(this.start, this.end - 0.01));
  }
  private render() {
    // Do not round the range value: it must equal max exactly at the source end.
    this.startRange.value = String(this.start);
    this.endRange.value = String(this.end);
    this.startNumber.value = String(Number(this.start.toFixed(6)));
    this.endNumber.value = String(Number(this.end.toFixed(6)));
    element('selection-duration').textContent = `${(this.end - this.start).toFixed(1)}秒 / 最大${CONFIG.maxDuration}秒`;
    const track = element('selected-track');
    track.style.left = `${this.duration ? this.start / this.duration * 100 : 0}%`;
    track.style.width = `${this.duration ? (this.end - this.start) / this.duration * 100 : 0}%`;
    track.setAttribute('aria-label', `選択範囲を移動。開始${this.start.toFixed(2)}秒、終了${this.end.toFixed(2)}秒。左右矢印キーでも移動できます`);
    this.startRange.setAttribute('aria-valuetext', timeLabel(this.start));
    this.endRange.setAttribute('aria-valuetext', timeLabel(this.end));
  }
  setHead(time: number) {
    this.scrub.value = String(time);
    element('playhead').style.left = `${this.duration ? clamp(time / this.duration * 100, 0, 100) : 0}%`;
    element('play-time').textContent = timeLabel(time);
  }
}
