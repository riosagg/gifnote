# FFmpeg core source distribution

対象は GIFnote がそのまま配信する @ffmpeg/core 0.12.10 の ESM
ffmpeg-core.js / ffmpeg-core.wasm です。GIFnote独自コードはGPL-2.0-or-laterで
提供し、本体のLicenseページから適用宣言・本文・本体ソースを取得できます。
この文書が対象とする第三者ソースの権利・条件は各ソース内の
LICENSE / COPYING / 個別ファイルの表示に従います。

## ソースの取得

サイトの「Third-party licenses」→「FFmpeg coreのソース」から、19個の
ソースアーカイブ、pins.json、archive-manifest.json、core-evidence.txt、
release-evidence.json、prepare_rebuild.py、このREADMEを取得できます。
FFmpeg本体だけでなく、外部ライブラリ・Emscripten runtime・SDL2 port・
ffmpeg.wasmのビルド定義と変更済みfrontendを同じサイトで提供します。
第三者のトップページへのリンクや、後日請求型の提供約束で代用しません。

一括取得する場合は download-sources.mjs を空のローカルフォルダへ保存し、
Node.js 22.12以上で次を実行します（URLは実際のサイトに置き換えます）。

    node download-sources.mjs https://YOUR-SITE/PATH/third_party_source/

全ソースのサイズとSHA-256を検証して、スクリプトと同じフォルダへ保存します。
公開前のローカル確認では http://127.0.0.1:4173/third_party_source/ を使えます。
アーカイブには上流の個別著作権・ライセンス表示も残っています。

## バイナリとの関係と確定範囲

- npm package: @ffmpeg/core 0.12.10（2025-01-07公開）。
- ffmpeg.wasm: v12.15、commit 71aa99d37c02a7b4c435275ca9ef50e612f6efa1。
  これはcore 0.12.10を公開したリリースコミットです。2023年の別タグ
  v0.12.10とは異なります。wrapperは @ffmpeg/ffmpeg 0.12.15です。
- 配信WASMを実行した -version / -L は core-evidence.txt に保存しています。
  FFmpeg 5.1.4、Emscripten 3.1.40、--enable-gpl、単一スレッド、SIMD/O3を確認。
  このcoreのライセンスは GPL-2.0-or-laterです。
- 配信するJS/WASMのSHA-256、各ソースの参照名・40桁コミットは pins.json、
  アーカイブのサイズとSHA-256は archive-manifest.json に記録しています。
  通常のGIFnoteビルドはこれらの不一致を検出すると失敗します。
- x264の4-cores、LAMEのmasterを含むビルド参照を固定コミットへ解決しました。
  ただしnpmメタデータにgitHeadやビルド入力の署名付き証明はありません。
  現在の参照解決と公開レシピだけから過去のビルド入力が完全に同一だったと
  証明することはできません。これは公開レシピから復元したソース一式です。
- SDL2 2.24.2は -sUSE_SDL=2 が指定するportです。タグのZIPを取得し、
  Emscripten 3.1.40 tools/ports/sdl2.py が要求するSHA-512と一致することを確認。
  SDL2自体のソースも同梱しました。WASMに残るSDL2の範囲は未確定です。
- 元ビルドのリンクマップがないため、Emscripten system libraryの個別ファイルや
  条件付きコードが最終WASMに残る範囲は未確定です。ライセンス本文とソースは
  対象runtimeの範囲を広めに保持しています。テスト用ライブラリをruntimeと
  認定してはいません。

## 変更・パッチ・ビルド設定

GIFnoteは配信coreと第三者ソースを変更していません。npm ESMファイルを
コピーしています。ソースアーカイブはコミット指定の上流アーカイブです。

ffmpeg-wasmアーカイブの以下を保持しています。

- Dockerfile、Makefile、build/*.sh: コンパイル・リンクフラグと全外部ライブラリ。
- src/fftools/: 上流ffmpeg.wasmが変更したFFmpeg frontendの完全なソース。
  元FFmpegのfftools/に置き換えないでください。Dockerfileが別途コピーします。
- src/bind/: JS/Cバインディング、公開関数、pre-jsとruntime設定。
- build/harfbuzz.sh: configure.acへのsed変更を含む上流のビルド時変更。
- x264などのffmpegwasm fork: フォーク側の変更を含む完全なソース。

FFmpeg内のIJG由来ファイルはFFmpeg n5.1.4時点のものを保持しています。
GIFnoteから追加・削除・変更はしていません。上流での改変説明は
libavcodec/jfdctfst.c、jfdctint_template.c、jrevdct.c内にあります。
This software is based in part on the work of the Independent JPEG Group.

## 再ビルドの準備（Linux / Docker）

Python 3.12以上で次を実行すると、ハッシュ検証済みソースから新しい
rebuild-context/ を作ります。既存フォルダを上書きしません。

    python prepare_rebuild.py
    cd rebuild-context
    docker buildx build --build-arg FFMPEG_ST=yes --build-arg "EXTRA_CFLAGS=-O3 -msimd128" --output type=local,dest=./output .

prepare_rebuild.pyは配布用の補助スクリプトです。元のDockerfileは
Dockerfile.upstreamとして保持し、16箇所の外部ソース取得だけを同梱アーカイブの
展開へ置き換えます。出力候補は output/dist/esm/ffmpeg-core.js と .wasmです。
元のビルド手順は上流Makefileのmake prd（FFMPEG_ST=yes）です。

Docker、buildx、emscripten/emsdk:3.1.40、aptビルドツールの取得にはネット接続と
十分なディスク・メモリが必要です。EmscriptenのSDL2 port取得も上流レシピどおり
行われ、Emscripten内のSHA-512で照合されます。emsdkイメージのdigestとaptの
当時のバージョンは上流で固定されていません。ホスト用コンパイラ等の一般的な
開発ツール全部を再配布するものではありません。Emscripten runtimeのソースは
別アーカイブに含めています。

ソースアーカイブには.git履歴がありません。git describe等で埋め込むバージョンが
元のビルドと異なる可能性があります。ソース中のテスト専用git submodule
（zimgのgoogletest等）はcoreビルドの入力ではなく、アーカイブに含まれません。

この環境ではDockerによるFFmpeg再コンパイル・再ビルド後の動作確認・元バイナリとの
バイト一致確認を実施していません。上記手順の成功や再現ビルドを保証していません。
保存ソースと公開レシピ・固定コミット・配信ハッシュ・実行時設定の整合は確認済みです。
当時の全ビルド入力の完全証明と再ビルド成功は未確認ですが、具体的なソース欠落は
検出していません。バイト完全一致やcore差し替えを唯一の公開条件とはしていません。
GIFnote独自コードもGPL-2.0-or-laterで提供し、第三者の元のライセンスを維持します。
ここにあるdownload-sources.mjsとprepare_rebuild.pyはGIFnote独自の補助スクリプトで、
GPL-2.0-or-laterです。第三者アーカイブ自体のライセンスとは区別してください。

## 公開時・更新時

dist/全体を配信し、licenses/とthird_party_source/を省略しないでください。
アーカイブは通常のGIF変換時にはダウンロードされず、取得リンクを選んだときだけ
転送されます。対応バイナリを配る期間は同じソースへの取得経路を維持してください。
coreや依存を更新する場合は、古い通知のまま公開せずソースとハッシュも再調査します。
