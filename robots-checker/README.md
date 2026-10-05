# robots.txt チェッカー

URL を入れると、そのサイトの robots.txt を読んで、Google・AI・X・AdSense などのクローラーがそのページを読めるかを判定するツールです。noindex（meta・X-Robots-Tag）やサイトマップに届くか、書き方の間違いも見ます。

| ファイル | 内容 |
|----------|------|
| `index.html` | 画面と判定（robots.txt を読む・どの行で決まるか） |
| `../api/robots.php` | 調べ役。robots.txt・ページ・サイトマップを取りに行って JSON で返す。判定はしない |
| `../api/_net.php` | 安全に取りに行く共通の部品（OGPチェッカーと同じ） |

## 判定のしかた（`index.html` の `parse` / `judge`）

- RFC 9309 どおり：自分の名前の組（同じ名前の組はまとめる）→ なければ `*` の組。いちばん長く当てはまる行が勝ち、同じ長さなら Allow。`*` と行末の `$` が使える。`Disallow:` だけの行は「止めない」
- `User-agent: Googlebot/2.1` のような書き方は `/` より前だけを名前として見る
- `fallback`：Googlebot-Image と Applebot は、自分の組がなければ Googlebot の組を使う
- `ignoreStar`：AdSense（Mediapartners-Google）と AdsBot は `*` の組を見ない
- `ignores`：Discord は robots.txt を見ない
- パスは `encodeURI(decodeURI(…))` でそろえてから比べる（日本語と `%XX` を同じにする）
- robots.txt の返事が 4xx → 全部読める、5xx・つながらない → 全部読めない（Google の扱い）
- 「書き換えて試す」は、画面の中だけで判定し直す（サーバーの robots.txt は変えない）

クローラーを足すときは `BOTS` に1行足す。

## 開発メモ

- 判定を変えたら、`rb_test` と同じような例（長い行が勝つ・Allow が勝つ・`$`・名前の組・AdSense など）で確かめる。
- `robots.php` は `_net.php` の `ogp_start()`（CORS・回数の制限）を使うので、回数は OGPチェッカーと合わせて数える。
