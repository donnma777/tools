# OGPチェッカー

URL を入れると、そのページの OGP・X のカードのタグを読んで、X・Discord・Facebook・LINE・Slack に貼ったときの見え方の目安と、問題・直し方を出すツールです。

ブラウザからはほかのサイトのページを読めない（CORS）ので、ページと画像は donnma.com に置いた `../api/ogp.php` が代わりに取りに行きます。

| ファイル | 内容 |
|----------|------|
| `index.html` | 画面（入力・チェック・見え方・画像・ページの情報・タグの一覧） |
| `../api/ogp.php` | 調べ役。ページと og:image / twitter:image を取りに行き、JSON で返す。調べた URL・結果は保存しない |

## 公開のしかた

- 本番（donnma.com/tool/）は `api/ogp.php` をそのまま使う（`../api/ogp.php`）。
- GitHub Pages（tools.donnma.com）では PHP が動かないので、`deploy.yml` の publish-pages で `api/` を消している。ページは `https://donnma.com/tool/api/ogp.php` を呼ぶ。
- `ogp.php` は `Origin` が `https://donnma.com`・`https://tools.donnma.com` のときだけ CORS を許す。ほかのサイトの `Origin` からは 403。

## `api/ogp.php`

`?url=…&ua=default|discord|x|facebook|line|slack`

- **よそのサーバーへの踏み台にしない**ための決まり：
  - http / https、ポート 80・443 だけ。ユーザー名入りの URL は不可
  - 名前を引いて（A・AAAA）、プライベート・予約済みの IP が1つでもあれば断る。引いた IP を `CURLOPT_RESOLVE` で固定して、そのまま使う（引き直しのすり替え対策）
  - 転送は自分でたどり、1回ごとに同じ確認をする（5回まで）
  - ページ 3MB・画像 10MB・1回 10 秒まで。同じ IP から 10 分に 30 回まで（`sys_get_temp_dir()/donnma-ogp-rate`）
- 返すもの：`status`・`chain`（転送）・`time`・`ttfb`・`bytes`・`encoding`・`headEnd`（`</head>` の位置）・`title`・`canonical`・`icon`・`metas`（`{key, value, pos}`。`pos` はほどいたあとの HTML の何バイト目か）・`images`（大きさ・重さ・形式・どのタグで使われているか）

## 開発メモ

- 手元で試すときは、tools のフォルダで PHP を動かす：
  `php -d extension=curl -d extension=openssl -d extension=mbstring -d curl.cainfo=…/cacert.pem -S localhost:8766`
  （Windows の PHP は `-d extension_dir=…/ext` も要る）
- チェックの文言・しきい値は `index.html` の `diagnose()` にまとまっている。OGP の位置は 200KB で ⚠、512KB で ❌（Discord が頭の一部しか読まないため。Cocoon の CSS インライン化で 700KB 先になって埋め込みが出なかったことがある）。
