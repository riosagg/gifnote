/*
 * Copyright (C) 2026 riosagg
 * SPDX-License-Identifier: GPL-2.0-or-later
 * This file is part of GIFnote and is licensed under GNU GPL version 2
 * or (at your option) any later version, WITHOUT ANY WARRANTY.
 * See the root LICENSE and COPYRIGHT files for details.
 */
import type { Plugin } from 'vite';

// Inventory emitted code, including virtual helpers; fail on a new npm runtime dependency.
export function bundleLicenseAudit(target: 'main' | 'worker'): Plugin {
  let root = '';
  return {
    name: `gifnote-license-inventory-${target}`,
    apply: 'build',
    configResolved(config) { root = config.root.replaceAll('\\', '/') + '/'; },
    generateBundle(_options, bundle) {
      const chunks = Object.values(bundle).filter(item => item.type === 'chunk').map(chunk => ({
        file: chunk.fileName,
        modules: Object.keys(chunk.modules).map(original => {
          const id = original.replaceAll('\\', '/').replaceAll('\0', '');
          const dependency = id.match(/node_modules\/((?:@[^/]+\/)?[^/]+)/)?.[1];
          if (dependency && !['@ffmpeg/ffmpeg', 'gifuct-js', 'js-binary-schema-parser'].includes(dependency)) {
            this.error(`Third-party license review required for emitted dependency: ${dependency}`);
          }
          return id.replaceAll(root, '');
        }).sort(),
      }));
      this.emitFile({ type: 'asset', fileName: `licenses/bundle-${target}.json`, source: JSON.stringify({ target, chunks }, null, 2) + '\n' });
    },
  };
}
