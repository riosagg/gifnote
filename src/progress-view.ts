/*
 * Copyright (C) 2026 riosagg
 * SPDX-License-Identifier: GPL-2.0-or-later
 * See the root LICENSE and COPYRIGHT files. Distributed WITHOUT ANY WARRANTY.
 */

/** Called once after the conversion's first status update has revealed the panel. */
export function revealProgress(panel: HTMLElement) {
  if (panel.hidden) return;
  const rect = panel.getBoundingClientRect();
  const viewport = window.visualViewport;
  const top = viewport?.offsetTop ?? 0;
  const height = viewport?.height ?? window.innerHeight;
  // On a very short/zoomed viewport, a panel beginning at the visible top is enough.
  const visibleEnd = rect.top + Math.min(rect.height, height);
  if (rect.top >= top && visibleEnd <= top + height) return;
  panel.scrollIntoView({
    behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth',
    block: 'start',
  });
}
