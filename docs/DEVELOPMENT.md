# 開発ガイド

基本の起動方法は [README](../README.md)、確認項目は [テストガイド](TESTING.md) を参照してください。

## 主な構成

| 場所 | 役割 |
| --- | --- |
| `index.html` / `src/styles.css` | トップページとレスポンシブUI |
| `src/main.ts` | 入出力・状態・中止・ファイル切り替え |
| `src/config.ts` | 標準値・制限・容量調整の段階 |
| `src/media.ts` / `src/gif-player.ts` | 動画・GIFの読み込みとプレビュー |
| `src/time-range.ts` / `src/timeline.ts` | 時間範囲の計算と操作UI |
| `src/crop.ts` | 比率・クロップ枠 |
| `src/ffmpeg.ts` / `src/gif-info.ts` | 変換・容量調整・出力GIFの解析 |
| `src/progress-view.ts` | 生成開始時の進捗エリアへのスクロール |
| `public/privacy/` / `public/disclaimer/` | 静的な情報ページ |
| `scripts/` | ビルド準備・ソース梱包・検証 |
| `licenses/` / `third_party_source/` | 第三者ライセンス原本・対応ソース |

## 時間範囲とクロップ

タイムライン全体は素材の0秒から末尾まで。最大15秒は選択区間の長さの制限です。
原則最短1秒ですが、1秒未満の素材は全長を選択できます。

rangeは `step="any"` とし、端数のある素材末尾を正確に保持します。
途中の操作は原則0.1秒刻み。開始・終了の数値入力とスライダーを同期します。
選択枠の移動は長さを保ち、素材の左右端で止めます。枠を移動するとプレビューも開始位置へ移ります。

クロップは自由・16:9・4:3・1:1。内部ドラッグで移動し、四隅・四辺でサイズ変更できます。
矢印キーで移動、Shift＋矢印キーでサイズ変更できます。

## 出力時間と容量

FFmpegへの変換要求を最大15.000秒に制限し、出力GIFのフレーム時間を1/100秒の整数単位で再解析します。
必要な場合だけ末尾の表示時間を短縮するか末尾フレームを除き、選択時間の1/100秒未満を切り捨てた上限内へ補正します。
ブラウザで長く解釈される0/1 tickの遅延は補正で作らず、短い選択を15秒に引き伸ばしません。

標準値は [src/config.ts](../src/config.ts) に集約しています。1 MBは1,000,000 bytesです。
15 MB以下を目標に、20 MB未満を出力条件とし、実容量に応じてFPS・色数・横幅を段階的に下げます。
全段階で上限を満たせない場合は、区間短縮やトリミングを案内します。
標準では素材を拡大せず、切り抜き領域の拡大は任意設定です。

## リソースとデータ処理

取り消し・ファイル切り替え時には、メディア、時間、画角、結果、エラー、進捗を初期化します。
Object URLを解放し、file inputを空にして同一ファイルを再選択可能にします。
FFmpegの一時ファイルを後始末し、Workerの終了で仮想FS・WASMメモリを解放します。
取り消した読み込みの遅延完了は、新しい操作の状態へ反映しません。

素材はFile APIで読み、ブラウザ内のWorkerで変換します。素材をサーバーへ送る処理はありません。
静的アセット・WASMの取得や外部リンクへのアクセスは通信を伴います。
登録・解析・Cookie追跡などを導入する場合は、プライバシー説明も見直してください。

## 静的配信とソース提供

Viteの `base: './'` により、ルート配信と `/gifnote/` 配下の配信を想定しています。
単一スレッドcoreを自己配信し、SharedArrayBufferやCOOP/COEPヘッダーには依存しません。
`dist/` 全体を配信し、`assets/`、`ffmpeg/`、`license/`、`licenses/`、`source/`、`third_party_source/` を欠かさないでください。

Git管理するのはソース・設定・lockfile・文書・第三者ライセンス・固定ソースです。
`node_modules/`、`dist/`、生成用の `public/ffmpeg/` 等は [.gitignore](../.gitignore) で除外しています。
ライセンスの生成物は直接編集せず、原本から再生成します。
ハッシュ対象文書は [.gitattributes](../.gitattributes) によりGitの改行変換を無効にしています。

本体ソースはビルド時に `dist/source/gifnote-source.tgz` へ梱包されます。
FFmpeg対応ソースの由来・取得・再ビルド手順と確認の限界は [専用文書](../third_party_source/README.md) を参照してください。
第三者の条件は [THIRD_PARTY_NOTICES.md](../THIRD_PARTY_NOTICES.md) にまとめています。

## 保守用コマンド

```sh
npm run typecheck
npm test
npm run build
npm run licenses:verify
npm run preview
```

previewを起動したまま、別ターミナルで `npm run licenses:verify:http` を実行すると配布ファイルのHTTP内容を照合します。
別ポートを使う場合は `node scripts/verify-third-party.mjs --http-base http://127.0.0.1:4177/` のように指定します。
外部リンクも調べる場合は `--check-external` を付けます。通常のbuildは外部ネットワークに依存しません。

依存更新時は配布範囲とライセンスを再確認してください。
固定ソース取得は `node scripts/vendor-third-party.mjs`、ローカル原文からの通知生成は `node scripts/collect-third-party.mjs` です。
通常ビルドでこれらの再収集処理は実行しません。
