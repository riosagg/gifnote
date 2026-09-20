# Copyright (C) 2026 riosagg
# SPDX-License-Identifier: GPL-2.0-or-later
# This file is part of GIFnote and is licensed under GNU GPL version 2
# or (at your option) any later version, WITHOUT ANY WARRANTY.
# See the root LICENSE and COPYRIGHT files for details.
"""Prepare the upstream build context from the accompanying archives.

Python 3.12+. Run alongside pins.json, archive-manifest.json and archives/.
Does not download, start Docker, change the distributed binary or use GitHub APIs.
The original upstream Dockerfile is retained as Dockerfile.upstream.
"""
import hashlib
import json
from pathlib import Path
import re
import shutil
import sys
import tarfile


def prepare():
    if sys.version_info < (3, 12):
        raise SystemExit("Python 3.12+ is required for tarfile's safe data filter")
    root = Path(__file__).resolve().parent
    pins = json.loads((root / "pins.json").read_text(encoding="utf-8"))
    manifest = json.loads((root / "archive-manifest.json").read_text(encoding="utf-8"))
    entries = {entry["id"]: entry for entry in manifest["archives"]}
    for source in pins["sources"]:
        entry = entries[source["id"]]
        expected_name = f"archives/{source['id']}-{source['commit']}.tgz"
        if entry["archive"] != expected_name or entry["commit"] != source["commit"]:
            raise ValueError("Source pin mismatch")
        data = (root / expected_name).read_bytes()
        if len(data) != entry["size"] or hashlib.sha256(data).hexdigest() != entry["sha256"]:
            raise ValueError(f"Source hash mismatch: {source['id']}")
    context = root / "rebuild-context"
    if context.exists():
        raise SystemExit("rebuild-context already exists; use a new source directory to avoid overwriting work")
    context.mkdir()
    with tarfile.open(root / entries["ffmpeg-wasm"]["archive"], "r:gz") as archive:
        for member in archive.getmembers():
            parts = Path(member.name).parts
            if len(parts) < 2:
                continue
            member.name = str(Path(*parts[1:]))
            archive.extract(member, context, filter="data")
    dockerfile = context / "Dockerfile"
    original = dockerfile.read_text(encoding="utf-8")
    (context / "Dockerfile.upstream").write_text(original, encoding="utf-8")
    updated = original
    (context / "archives").mkdir()
    replaced = []
    for source in pins["sources"]:
        if source["id"] in ("ffmpeg-wasm", "emscripten", "sdl2"):
            continue
        entry = entries[source["id"]]
        filename = Path(entry["archive"]).name
        shutil.copyfile(root / entry["archive"], context / "archives" / filename)
        if source["id"] == "zimg":
            pattern = r"^RUN git clone --recursive -b \$ZIMG_BRANCH https://github.com/sekrit-twc/zimg.git /src$"
        else:
            pattern = r"^ADD https://github.com/" + re.escape(source["repo"]) + r"\.git#\$[A-Z0-9_]+ /src$"
        replacement = f"COPY archives/{filename} /tmp/source.tar.gz\nRUN mkdir -p /src && tar -xzf /tmp/source.tar.gz --strip-components=1 -C /src"
        updated, count = re.subn(pattern, replacement, updated, flags=re.MULTILINE)
        if count != 1:
            raise ValueError(f"Upstream recipe changed: {source['id']} ({count} matches)")
        replaced.append(source["id"])
    if re.search(r"^(ADD https://github|RUN git clone)", updated, re.MULTILINE):
        raise ValueError("Unpinned source download remains in Dockerfile")
    dockerfile.write_text(updated, encoding="utf-8")
    print(f"Prepared {context}; replaced {len(replaced)} source downloads with verified local archives.")
    print("This is preparation only: no Docker build or binary equivalence verification has been performed.")
    print("Read README.md, then run inside rebuild-context:")
    print('docker buildx build --build-arg FFMPEG_ST=yes --build-arg "EXTRA_CFLAGS=-O3 -msimd128" --output type=local,dest=./output .')


if __name__ == "__main__":
    prepare()
