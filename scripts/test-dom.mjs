/*
 * Copyright (C) 2026 riosagg
 * SPDX-License-Identifier: GPL-2.0-or-later
 * This file is part of GIFnote and is licensed under GNU GPL version 2
 * or (at your option) any later version, WITHOUT ANY WARRANTY.
 * See the root LICENSE and COPYRIGHT files for details.
 */
// Small event/DOM doubles for application controller tests; no rendering claims.
import { readFileSync } from 'node:fs';
export class NodeDouble extends EventTarget {
  value = ''; checked = false; disabled = false; hidden = false; textContent = ''; dataset = {}; children = []; files = [];
  width = 1; height = 1; currentTime = 0; readyState = 0; duration = 120; videoWidth = 640; videoHeight = 360;
  attributes = new Map(); capture = new Set(); clicks = 0;
  classes = new Set();
  classList = { add: (...xs) => xs.forEach(x => this.classes.add(x)), remove: (...xs) => xs.forEach(x => this.classes.delete(x)), contains: x => this.classes.has(x) };
  style = { removeProperty: key => { delete this.style[key.replace(/-([a-z])/g, (_, c) => c.toUpperCase())]; } };
  get valueAsNumber() { return Number(this.value); }
  setAttribute(k, v) { this.attributes.set(k, String(v)); }
  getAttribute(k) { return this.attributes.get(k) ?? null; }
  removeAttribute(k) { this.attributes.delete(k); if (k === 'src') this.src = ''; if (k === 'href') this.href = ''; if (k === 'download') this.download = ''; }
  replaceChildren(...nodes) { this.children = nodes; }
  append(...nodes) { this.children.push(...nodes); }
  querySelectorAll(selector) { return selector === 'button' ? this.children : []; }
  closest(selector) { if (selector === '[data-handle]') return this.dataset.handle ? this : null; return this.dataset.ratio ? this : null; }
  getBoundingClientRect() { return { left: 0, top: 0, width: 1200, height: 100 }; }
  focus() { globalThis.document.activeElement = this; }
  scrollIntoView() {}
  click() { this.clicks++; this.dispatchEvent(new Event('click')); }
  pause() {}
  async play() {}
  load() { this.currentTime = 0; this.readyState = this.src ? 2 : 0; if (this.src) queueMicrotask(() => this.dispatchEvent(new Event('loadeddata'))); }
  setPointerCapture(id) { this.capture.add(id); }
  hasPointerCapture(id) { return this.capture.has(id); }
  releasePointerCapture(id) { this.capture.delete(id); }
  getContext() { return { clearRect() {}, fillRect() {}, drawImage() {}, putImageData() {}, createImageData: (w,h) => ({ data: new Uint8ClampedArray(w*h*4) }) }; }
}
export function dom() {
  const nodes = new Map();
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  for (const match of html.matchAll(/<[^>]+\bid="([^"]+)"[^>]*>/g)) {
    const n = new NodeDouble(); n.id = match[1]; n.type = /\btype="([^"]+)"/.exec(match[0])?.[1]; n.hidden = /\bhidden\b/.test(match[0]);
    nodes.set(n.id, n);
  }
  const presets = nodes.get('crop-presets');
  presets.children = ['none', 'free', '16:9', '4:3', '1:1'].map(ratio => { const n = new NodeDouble(); n.dataset.ratio = ratio; return n; });
  const document = new EventTarget();
  Object.assign(document, { getElementById: id => nodes.get(id), createElement: () => new NodeDouble(), hidden: false });
  globalThis.document = document;
  globalThis.window = Object.assign(new EventTarget(), { matchMedia: () => ({ matches: true }) });
  globalThis.Option = class { constructor(text, value) { this.text = text; this.value = value; } };
  globalThis.requestAnimationFrame = () => 1;
  globalThis.cancelAnimationFrame = () => {};
  return id => nodes.get(id);
}
export function emit(target, type, props = {}) {
  const event = new Event(type, { cancelable: true });
  for (const [k,v] of Object.entries(props)) Object.defineProperty(event, k, { value: v });
  target.dispatchEvent(event);
}
export async function settle() { for (let i = 0; i < 8; i++) await new Promise(resolve => setImmediate(resolve)); }
