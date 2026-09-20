# GIFnote

動画・GIFの好きな区間を切り出し、noteの記事に載せやすいGIFを作る
完全クライアントサイドのWebツールです。

🔗 **[GIFnoteを使う](https://riosagg.github.io/gifnote/)**

> note非公式ツールです。
> 入力した動画・GIFはサーバーへ送信されず、ブラウザ内で処理されます。

## Features

- MP4 / WebM / MOV / GIF対応
- 好きな位置から最大15秒を切り出し
- 自由 / 16:9 / 4:3 / 1:1 クロップ
- 最大620px・10fpsを基準に自動調整
- 20MB未満を目安に自動軽量化
- PC / スマートフォン対応
- 登録不要・素材アップロード不要

対応形式でも、コーデックや端末・ブラウザによって読み込めない場合があります。

## 使い方

1. 動画またはGIFを選ぶ
2. 使用する時間と画角を決める
3. 「note用GIFを作る」を押す
4. 完成したGIFを保存

保存したGIFを、noteの記事に画像として挿入してください。

短い動画でも、容量・解像度・撮影ビットレートが高い素材では、
変換に数分かかることがあります。

## note向け標準設定

| 項目 | 標準 |
| --- | --- |
| 長さ | 最大15秒 |
| 横幅 | 最大620px |
| FPS | 10fps |
| 容量 | 20MB未満 |

素材によってはFPS・色数・横幅を自動的に調整します。
noteへのアップロード成功を保証するものではありません。

## Local development

Node.js **22.12以上**とnpmが必要です。

```sh
npm ci
npm run dev
```

ターミナルに表示されたURLをブラウザで開いてください。

Production build:

```sh
npm run build
```

生成された `dist/` をローカルで確認するには `npm run preview` を実行します。

保守・検証の詳細：

- [開発ガイド](docs/DEVELOPMENT.md)
- [テストガイド・実機確認状況](docs/TESTING.md)

## Tech

Vite / TypeScript / Vanilla TypeScript / ffmpeg.wasm / gifuct-js

## License

GIFnote独自コードは **GPL-2.0-or-later** です。
第三者コンポーネントには、それぞれ元のライセンスが適用されます。

- [LICENSE](LICENSE)
- [COPYRIGHT](COPYRIGHT)
- [Third-party notices](THIRD_PARTY_NOTICES.md)
- [FFmpeg core source](third_party_source/README.md)

Copyright (C) 2026 riosagg
