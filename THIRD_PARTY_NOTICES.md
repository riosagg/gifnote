# Third-party notices — GIFnote

この文書は配布する第三者コンポーネントの通知です。**GIFnote独自コードはGPL-2.0-or-laterです。** [本体の適用宣言](COPYRIGHT)・[GPL本文](LICENSE) を参照してください。この文書に掲載する第三者コンポーネントは、それぞれ元のライセンスを維持します。 第三者ソースの権利・条件を変更しません。

## 配布するFFmpegパッケージの区別

- **@ffmpeg/ffmpeg 0.12.15**: JavaScript wrapper / Worker。MIT、Copyright (c) 2019 Jerome Wu。[本文](licenses/ffmpeg-wasm/LICENSE.txt)。
- **@ffmpeg/core 0.12.10**: 配信するESM ffmpeg-core.js / ffmpeg-core.wasm。この結合coreは **GPL-2.0-or-later** のFFmpeg 5.1.4を含みます。[GPL本文](licenses/ffmpeg/COPYING.GPLv2.txt)。MIT wrapperとは別です。
- npmのFFmpegパッケージには単独のLICENSEファイルが含まれていないため、公開コミットと各ソースから原文を取得しました。

## 配布対象・ビルド入力の一覧

完全な著作権表示、ライセンス原文、出典、コミット、変更の有無を [licenses/manifest.json](licenses/manifest.json) と各 licenses/ フォルダに保持しています。以下のSDL2とEmscripten内の個別runtimeファイルについては、ビルド入力は特定済みですがリンク後に残る範囲が未確定です。開発専用依存をruntimeに数えるものではありません。

|コンポーネント|バージョン|ライセンス|本文・著作権表示|
|---|---|---|---|
|[ffmpeg.wasm build/bindings](https://github.com/ffmpegwasm/ffmpeg.wasm/tree/71aa99d37c02a7b4c435275ca9ef50e612f6efa1)|core 0.12.10 / wrapper 0.12.15|MIT (wrapper/bindings); LGPL-2.1-or-later (FFmpeg-derived frontend); combined core GPL-2.0-or-later|[原文](licenses/ffmpeg-wasm/LICENSE.txt) / [全表示](licenses/ffmpeg-wasm/)|
|[FFmpeg](https://github.com/FFmpeg/FFmpeg/tree/4729204c17f756e186d622060088371d10b34f7e)|5.1.4|GPL-2.0-or-later for this --enable-gpl build; component notices also apply|[原文](licenses/ffmpeg/LICENSE.md.txt) / [全表示](licenses/ffmpeg/)|
|[x264](https://github.com/ffmpegwasm/x264/tree/33cac6b77d5b9259c552156013a817ab23119612)|4-cores fork|GPL-2.0-or-later|[原文](licenses/x264/COPYING.txt) / [全表示](licenses/x264/)|
|[x265](https://github.com/ffmpegwasm/x265/tree/2bb5520e9596f361bf0ed81b3b8da0d7fd999069)|3.4|GPL-2.0-or-later|[原文](licenses/x265/COPYING.txt) / [全表示](licenses/x265/)|
|[libvpx](https://github.com/ffmpegwasm/libvpx/tree/10b9492dcf05b652e2e4b370e205bd605d421972)|1.13.1|BSD-3-Clause; patent and bundled-code notices|[原文](licenses/libvpx/LICENSE.txt) / [全表示](licenses/libvpx/)|
|[LAME](https://github.com/ffmpegwasm/lame/tree/2badea1974ae36cb8312afe99cff1e6b3b5decee)|3.100 fork|LGPL-2.0-or-later|[原文](licenses/lame/COPYING.txt) / [全表示](licenses/lame/)|
|[libogg](https://github.com/ffmpegwasm/Ogg/tree/bada45718453ac27b56773ae663f7e65112f6a6e)|1.3.4|BSD-3-Clause|[原文](licenses/ogg/COPYING.txt) / [全表示](licenses/ogg/)|
|[libtheora](https://github.com/ffmpegwasm/theora/tree/7ffd8b2ecfc2d93ae5e16028e7528e609266bfbf)|1.1.1|BSD-3-Clause|[原文](licenses/theora/COPYING.txt) / [全表示](licenses/theora/)|
|[libvorbis](https://github.com/ffmpegwasm/vorbis/tree/7798164043197d7e33f02de4353ce2aa5b248225)|1.3.3|BSD-3-Clause|[原文](licenses/vorbis/COPYING.txt) / [全表示](licenses/vorbis/)|
|[Opus](https://github.com/ffmpegwasm/opus/tree/e85ed7726db5d677c9c0677298ea0cb9c65bdd23)|1.3.1|BSD-3-Clause; patent grants|[原文](licenses/opus/COPYING.txt) / [全表示](licenses/opus/)|
|[zlib](https://github.com/ffmpegwasm/zlib/tree/cacf7f1d4e3d44d871b605da3b647f07d718623f)|1.2.11|Zlib|[原文](licenses/zlib/README.txt) / [全表示](licenses/zlib/)|
|[libwebp / libsharpyuv](https://github.com/ffmpegwasm/libwebp/tree/ca332209cb5567c9b249c86788cb2dbf8847e760)|1.3.2|BSD-3-Clause; patent grant|[原文](licenses/webp/COPYING.txt) / [全表示](licenses/webp/)|
|[FreeType](https://github.com/ffmpegwasm/freetype2/tree/6a2b3e4007e794bfc6c91030d0ed987f925164a8)|2.10.4|GPL-2.0-or-later selected for this GPLv2-compatible distribution; FTL alternative and other notices retained|[原文](licenses/freetype/docs__LICENSE.TXT.txt) / [全表示](licenses/freetype/)|
|[FriBidi](https://github.com/fribidi/fribidi/tree/f9e8e71a6fbf4a4619481284c9f484d10e559995)|1.0.9|LGPL-2.1-or-later|[原文](licenses/fribidi/COPYING.txt) / [全表示](licenses/fribidi/)|
|[HarfBuzz](https://github.com/harfbuzz/harfbuzz/tree/4a1d891c6317d2c83e5f3c2607ec5f5ccedffcde)|5.2.0|Old MIT (MIT-like), with component-specific notices|[原文](licenses/harfbuzz/COPYING.txt) / [全表示](licenses/harfbuzz/)|
|[libass](https://github.com/libass/libass/tree/d149636f502f5774ae1a8fb4c554b122674393b2)|0.15.0|ISC|[原文](licenses/libass/COPYING.txt) / [全表示](licenses/libass/)|
|[zimg](https://github.com/sekrit-twc/zimg/tree/e5b0de6bebbcbc66732ed5afaafef6b2c7dfef87)|3.0.5|WTFPL-2.0; component notices|[原文](licenses/zimg/COPYING.txt) / [全表示](licenses/zimg/)|
|[Emscripten runtime / system libraries](https://github.com/emscripten-core/emscripten/tree/5c27e79dd0a9c4e27ef2326841698cdd4f6b5784)|3.1.40|MIT selected for Emscripten-owned runtime; musl, LLVM/compiler-rt/libc++ and other embedded notices apply separately|[原文](licenses/emscripten/LICENSE.txt) / [全表示](licenses/emscripten/)|
|[SDL2 (Emscripten port)](https://github.com/libsdl-org/SDL/tree/55b03c7493a7abed33cf803d1380a40fa8af903f)|2.24.2|Zlib; per-file notices retained in source|[原文](licenses/sdl2/LICENSE.txt) / [全表示](licenses/sdl2/)|
|[gifuct-js](https://github.com/matt-way/gifuct-js)|2.1.2|MIT|[原文](licenses/gifuct-js/LICENSE.txt) / [全表示](licenses/gifuct-js/)|
|[js-binary-schema-parser](https://github.com/matt-way/jsBinarySchemaParser)|2.0.3|MIT|[原文](licenses/js-binary-schema-parser/LICENSE.txt) / [全表示](licenses/js-binary-schema-parser/)|
|[Vite browser preload helpers](https://github.com/vitejs/vite/tree/v7.3.6)|7.3.6|MIT|[原文](licenses/vite/LICENSE.txt) / [全表示](licenses/vite/)|
|[@rollup/plugin-commonjs generated CommonJS wrappers](https://github.com/rollup/plugins/tree/commonjs-v29.0.0/packages/commonjs)|29.0.0 (bundled in Vite 7.3.6; upstream pnpm-lock.yaml)|MIT|[原文](licenses/rollup-commonjs/LICENSE.txt) / [全表示](licenses/rollup-commonjs/)|

各行の著作権者と変更状態は機械可読一覧に記録し、WebのThird-party licensesページにも表示しています。GIFnoteは第三者ソースと配信coreを変更していません。JS依存はViteでバンドル・縮小しています。上流fork・FFmpeg frontendの変更・ビルド時パッチはソースに保持しています。

### 個別の注意事項

- gifuct-js本体とjs-binary-schema-parser: MIT、Copyright (c) 2015 Matt Way。
- gifuct-jsのdeinterlace由来コード: MIT、Copyright (c) 2011 Shachaf Ben-Kiki。[固定コミットの本文](licenses/gifuct-js/jsgif-LICENSE.txt)。LZW由来コード: MIT、Copyright (c) 2013 Xcellent Creations, Inc.。[原ソースと本文](licenses/gifuct-js/GifDecoder.java.txt)。元コードにはパッケージ版番号がなく、取り込みはgifuct-js上流によるものです。
- FreeTypeは、このGPLv2互換coreの提供ではGPL-2.0-or-laterを選択します。FTLという別選択肢、BDF/PCFのX11系表示、内蔵zlibの表示も保持しています。
- Emscripten固有部はMITを選択し、NCSAの代替本文も保持しています。muslはMITおよび個別BSD等、LLVM compiler-rt/libc++/libc++abi/libunwindはApache-2.0 WITH LLVM-exceptionおよび原文記載の旧ライセンスです。これらを一律にMITと表記しません。
- libvpx / libwebpのPATENTS、Opus COPYING中の追加条項も同梱しています。
- Viteはブラウザ向けpreload helperのみ、@rollup/plugin-commonjsはブラウザ向けCommonJS生成wrapperのみが対象です。後者の29.0.0はVite 7.3.6の上流pnpm-lock.yamlで確認しました。両者の著作権・MIT本文を同梱しています。
- SDL2 2.24.2はEmscriptenの -sUSE_SDL=2 が指定する入力です。最終WASMに残る範囲は未確認のため、独立したブラウザ配布ライブラリとは数えていません。元リンクマップがないためEmscripten system libraryのファイル単位の残存範囲も未確定です。
- SOURCE-NOTICES.txtは固定ソース中の著作権・許諾コメントを原文で集めた補助資料です。無効なプラットフォーム実装や除去されるコードの表示も含み得ます。そこにある全コードを配信していると主張するものではありません。ソースアーカイブに元ファイルと個別表示を保持しています。

**This software is based in part on the work of the Independent JPEG Group.**

FFmpegの libavcodec/jfdctfst.c、jfdctint_template.c、jrevdct.c を表示とともに同梱しています。GIFnoteによる追加・削除・変更はありません。FFmpeg上流の改変説明はファイル内の記載を保持しています。

## GPL対象のソース提供

third_party_source/ にFFmpeg、外部ライブラリ、ffmpeg.wasmの変更済みfrontend/bindings/ビルドスクリプト、Emscripten runtime、SDL2 portの19個の固定ソースアーカイブを保持しています。[取得とビルドの説明](third_party_source/README.md)、[固定バージョン](third_party_source/pins.json)、[サイズ・SHA-256](third_party_source/archive-manifest.json) を参照してください。

ビルドでは一式を dist/third_party_source/ にコピーします。利用者はバイナリと同じサイトから追加料金なしで取得できます。一括取得スクリプトと、元Dockerfileを保持してソース取得箇所を同梱アーカイブへ置換する再ビルド準備スクリプトも提供します。無保証条項を含むライセンス原文を保持しています。トップページへのリンクや後日の提供約束だけで代用しません。

**確認範囲:** 保存済みソースは公式リリースのビルド定義・固定コミットに対応し、配信coreのハッシュと実行時設定も照合済みです。npm成果物にはgitHead・ビルド入力の証明がなく、当時の全入力の完全証明と再ビルド成功は未確認です。具体的な欠落は検出していません。bit-for-bit一致やcore差し替えを必須条件とはしていません。

GIFnote独自コードもGPL-2.0-or-laterで提供し、Workerを理由にGPL適用範囲外と扱うことを前提にしません。本体のソースは公開サイトのLicenseページから取得でき、第三者ソース・通知とは対象を区別します。

## 開発専用依存と配信境界

TypeScript、@ffmpeg/types、Vite開発サーバー、Rollup/esbuild本体とOS別バイナリ、PostCSS等の開発用依存は現在のdistにコードとして含まれません。これらを単に開発環境で使ったことを理由にruntime表示へ追加していません。ViteのhelperとCommonJSの生成wrapperは配信するため上記に含めています。

dist/licenses/bundle-main.json と bundle-worker.json に出力モジュールを記録します。通常ビルドは新しいnpm runtime依存、既知パッケージのバージョン変更、coreハッシュ変更、ライセンス/ソース欠落を検出したら失敗します。ただし、これは全生成コードや法的義務の自動証明ではなく変更時の再調査を補助する仕組みです。node_modulesや開発ツールを再配布する場合は別の配布範囲として再確認してください。

ソースアーカイブ内には上流のテスト・サンプルも含まれます。それらは元ライセンス表示を保持したソースとして提供するもので、GIFnoteの実行コードとして配信するものではありません。

ルートに置く原本はプロジェクトルート基準の相対パスを使います。ビルド時に公開用コピーを生成し、リンクを公開先の配置に合わせます。ライセンスの「全表示」は、公開版ではライセンスHTMLの該当セクションへ移動します。
