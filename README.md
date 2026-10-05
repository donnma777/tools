# どんまうんど-Tools

配信者向けのツールやアセットを無料公開しているリポジトリです。

- サイト: https://donnma.com/tool/
- 公式サイト: https://donnma.com/
- BOOTH: https://donnma.booth.pm/item_lists/nevT9GeV

---

## 利用規約

使うこと・自分で使うための編集はできますが、プログラムやオーバーレイのファイルそのものの二次配布・公開（編集したものも含む）はできません。特に配信オーバーレイ。ツールで作った画像（サムネイルなど）は、自由に配ったり公開したりできます。配布・公開したいときは、先に許可を取ってください。

詳しくは [利用規約](https://donnma.com/tool/terms/)（[LICENSE](LICENSE)）を見てください。

---

## ツール一覧

使い方・しくみ・開発メモは、各フォルダの README にあります。

| ツール | フォルダ | 内容 |
|--------|----------|------|
| 配信オーバーレイ | [overlay/](overlay/README.md) | OBSのブラウザソースで使うオーバーレイのテーマ集（1920×1080） |
| チャットCSSジェネレーター | [chat-css-generator/](chat-css-generator/README.md) | YouTube / Twitch のチャット欄の見た目をOBSのカスタムCSSで作る |
| 登録者数カウンター・目標ゲージ | [youtube-subscribers/](youtube-subscribers/README.md) | YouTubeの登録者数と目標ゲージをOBSに表示する |
| 配信用の時計・経過時間 | [clock/](clock/README.md) | OBS のブラウザソースで使う時計・もう1つの時刻・配信／録画の経過時間（設定は URL に入れる） |
| トーナメント表メーカー | [tournament/](tournament/README.md) | 大会のトーナメント表・試合テロップ・選曲をOBSや画像で使う |
| ルーレット | [roulette/](roulette/README.md) | OBSのドックやChromeから回せるルーレット |
| あみだくじ | [amida/](amida/README.md) | 横線を足したり1人ずつ開けたりできるあみだくじ。OBSにも出せる |
| サムネイルメーカー | [thumbnail/](thumbnail/README.md) | アイキャッチ・サムネイル・SNS共有画像を作る |
| 背景透過ツール | [bg-remove/](bg-remove/README.md) | 画像の背景を色で抜いて透明にする |
| QRコードメーカー | [qr/](qr/README.md) | URL・Wi-Fi・連絡先などのQRコードを、形・色・ロゴを変えて作る（期限なし）。画像からの読み取りも |
| 名刺メーカー | [meishi/](meishi/README.md) | 名前・SNS・QRコードの名刺を作り、A4・10面 PDF や印刷所向けの PDF・PNG で保存（`qr/qr-core.js` を使う） |
| PSD レイヤー書き出し | [psd/](psd/README.md) | PSD を開いて、レイヤーの表示を切り替えたり、レイヤー・フォルダを PNG／ZIP で書き出したりする（ag-psd を使う） |
| 画像の圧縮・変換 | [image-compress/](image-compress/README.md) | 画像を軽く・JPEG/PNG/WebP に変換する（まとめて・○KB 以下・見比べ・ZIP。送信しない） |
| OGPチェッカー | [ogp-checker/](ogp-checker/README.md) | URL を入れて、SNS に貼ったときの見え方と OGP の問題を調べる（調べ役は `api/ogp.php`） |
| robots.txt チェッカー | [robots-checker/](robots-checker/README.md) | Google・AI・X・AdSense などがページを読めるかを robots.txt から判定（調べ役は `api/robots.php`） |
| 共通の部品 | [common/](common/README.md) | ページ内の確認・お知らせ（`ask.js`） |

---

## 開発の共通ルール

- **`?v=` を上げる**：本番サーバーは画像・JS を長期間キャッシュします。JS を変更したら、読み込んでいる HTML の `?v=` を必ず上げてください（上げないと古い JS が配信されて動かなくなります）。どの HTML を直すかは各 README の「開発メモ」にあります。
- **`chat-css-generator/chat-core.js` は共有部品**：フォント一覧・文字効果をチャットCSS・登録者数・トーナメント表・ルーレット・あみだくじ・サムネイルが使っています。
- **`confirm()` / `alert()` を使わない**：OBSのドックでは出ないことがあるので、`common/ask.js` を使います。
- **オーバーレイの共通部分は直接編集しない**：live-tool-local の `overlay/_shared/` から `build.py` で流し込んでいます。
- **ヘッダー・フッターは `_shared/` で直す**：各ページの `<!-- shared:header -->`・`<!-- shared:footer -->` の間は `_shared/header.html`・`_shared/footer.html` から、`<style>` の中の `/* shared:header-footer */` の間は `_shared/header-footer.css` から流し込んでいます（全ページ同じ見た目）。直したら `python _shared/build.py` を実行してください（`--check` で書き換えが要るページだけを確認できます）。新しいページにも、ほかのページと同じ目印を置いてから実行します。目印に書ける設定は `_shared/build.py` の先頭にあります。

---

## 公開・デプロイ

`main` ブランチに push すると、GitHub Actions（`.github/workflows/deploy.yml`）が次の2か所へ自動で公開します。

| 公開先 | URL | 検索エンジン | 中身 |
|--------|-----|--------------|------|
| 本番（Xserver） | https://donnma.com/tool/ | インデックスさせる | `main` をそのまま rsync |
| GitHub Pages | https://tools.donnma.com/ | `noindex` | `gh-pages` ブランチ |

- `gh-pages` ブランチは自動生成です。直接編集せず、`main` を更新してください（push のたびに上書きされます）。
- GitHub Pages 用のコピーは、すべての HTML の `<head>` に `<meta name="robots" content="noindex">` を自動で追加しています。検索結果には本番（donnma.com）だけが出るようにするためです。
- 本番・GitHub Pages とも、`.git/`・`.github/`・`_shared/`・`CNAME`（本番のみ。GitHub Pages 専用）と、すべての階層の `README.md` を除外しています。
- 本番への rsync は `--delete` 付きです。リポジトリから削除・移動したファイルは、サーバーからも自動で消えます。
- サーバーに手動で置いたファイル（`overlay/donnma/`）は、`deploy.yml` の `--filter='P ...'` で削除対象から外しています。サーバーに直接ファイルを置くときは、ここに追記してください。追記しないと、次のデプロイで消えます。
- 新しいページを追加したら `sitemap.xml` にも追記してください（`robots.txt` から参照しています）。

---

## 関連リポジトリ

### Smart Access Control

WordPressプラグイン。クローラー・User-Agent・IPアドレスを組み合わせてアクセスを精密に制御します。AIクローラーやスクレイピングツールの許可/拒否、AIへの画像非表示などに対応。

- 解説: https://donnma.com/public-app-smart-access-control-v4-0-0/
- GitHub: https://github.com/donnma777/smart-access-control

### 便利ツール拡張機能まとめ

Chrome拡張機能をまとめたリポジトリ。広告ブロック・強制ダークモード・スクリーンショットを単体または統合版で提供。

- GitHub: https://github.com/donnma777/feature-browser-benri-tools

---

© 2026 [donnma.com](https://donnma.com/)
