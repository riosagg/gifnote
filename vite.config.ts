/*
 * Copyright (C) 2026 riosagg
 * SPDX-License-Identifier: GPL-2.0-or-later
 * This file is part of GIFnote and is licensed under GNU GPL version 2
 * or (at your option) any later version, WITHOUT ANY WARRANTY.
 * See the root LICENSE and COPYRIGHT files for details.
 */
import { defineConfig } from 'vite';
import { bundleLicenseAudit } from './scripts/bundle-license-audit';

export default defineConfig({
  base: './',
  plugins: [bundleLicenseAudit('main')],
  optimizeDeps: { exclude: ['@ffmpeg/ffmpeg', '@ffmpeg/util'] },
  worker: { format: 'es', plugins: () => [bundleLicenseAudit('worker')] },
  server: { port: 5173, strictPort: true },
  preview: { port: 4173, strictPort: true },
});
