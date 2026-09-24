# どんまうんど-Tools

配信者向けのツールやアセットを無料公開しているリポジトリです。

- サイト: https://donnma.com/tool/
- 公式サイト: https://donnma.com/
- BOOTH: https://donnma.booth.pm/item_lists/nevT9GeV

---

## 配信オーバーレイ (OBS Studio)

OBS Studio のブラウザソースで使える配信オーバーレイのテーマ集です。
解像度は 1920×1080 を想定しています。

| テーマ | フォルダ |
|--------|----------|
| GAMING | `overlay/gaming/` |
| CYBERPUNK VAPORWAVE | `overlay/cyberpunk-gaming/` |
| GAMING GIRLY NEON | `overlay/gaming_girly_neon/` |
| SWEET LOLITA ROSE | `overlay/sweet_lolita_rose/` |
| 和 WA | `overlay/wa/` |
| POP | `overlay/pop/` |
| CITY POP | `overlay/citypop/` |

各フォルダにオーバーレイ本体（`.html`）と説明書（`index.html` または `説明書.html`）、ローカルプレビュー用の `サーバー起動.bat` が入っています。

### 使い方

1. お好みのテーマフォルダを選ぶ
2. OBS Studio の「ブラウザソース」でHTMLファイルを読み込む
3. HTMLファイル冒頭の `CONFIG` を編集してテキスト・カラーをカスタマイズ
4. 説明書で詳細な使い方を確認する

パーツメニューの「表示更新」を使うと、同じURLを別タブで開いている画面へ編集内容をリアルタイムに反映できます（`file://` 直接ではなく `http://` 経由で開く必要があります。`サーバー起動.bat` で手元確認用のローカルサーバーを立ち上げられます）。

---

## チャットCSSジェネレーター (YouTube / Twitch × OBS)

`chat-css-generator/` — YouTubeライブ・Twitchのチャット欄をOBSのブラウザソースで表示するときの見た目を、プレビューを見ながら作成できるツールです。
フォント・縁取り・吹き出し・名前の色・スーパーチャット・表示/フェードアウトアニメーションなどを設定し、生成されたCSSをOBSのブラウザソースの「カスタムCSS」に貼り付けて使います。

| ファイル | 内容 |
|----------|------|
| `chat-css-generator/index.html` | ジェネレーター本体 |
| `chat-css-generator/chat-core.js` | CSS生成・プレビュー用の見本DOM |

- `chat-core.js` を変更したら、`index.html` の `<script src="chat-core.js?v=...">` の `v` も上げてください。本番サーバーは JS を長期間キャッシュするため、`v` を変えないと古い `chat-core.js` が配信され、ジェネレーターが動かなくなります。

- **YouTube**: ポップアウトチャット（`https://www.youtube.com/live_chat?is_popout=1&v=動画ID`）を読み込んだブラウザソースに貼り付けます。
- **Twitch**: ポップアウトチャット（`https://www.twitch.tv/popout/チャンネル名/chat?popout=`）を読み込んだブラウザソースに貼り付けます。Twitchの自動生成クラスは使わず、固定のクラス名・data属性だけで指定しています。

---

## 登録者数カウンター (YouTube × OBS)

`youtube-subscribers/` — YouTube Data API v3 で登録者数を取得し、OBSのブラウザソースに表示するカウンターです。
数字のフォント・色（単色／グラデーション／レインボー）・縁取り、見出しと単位、背景の箱と枠、置く場所、動きを設定できます。

- `index.html` は見た目の設定ページ、`view.html` はOBSに入れる表示ページです。APIキー・チャンネル・見た目の設定は `view.html` のURLの `#` 以降に入ります（サーバーに送られないように）。
- 利用者が自分のAPIキーを用意します。APIの登録者数は1,000人を超えると上から3桁に丸められます。
- YouTube Studio の画面をOBSのカスタムCSSで加工する方式は、Studio のページでOBSのCSS差し込みが動かないため使えません。
- フォント一覧・文字効果は `chat-css-generator/chat-core.js`、設定の読み書きとCSS生成は `youtube-subscribers/counter-core.js` にあります。どちらかを変更したら、`youtube-subscribers/index.html` と `youtube-subscribers/view.html` の `?v=` を上げてください。

---

## Plugin & Extension

### Smart Access Control

WordPressプラグイン。クローラー・User-Agent・IPアドレスを組み合わせてアクセスを精密に制御します。AIクローラーやスクレイピングツールの許可/拒否、AIへの画像非表示などに対応。

- 解説: https://donnma.com/public-app-smart-access-control-v4-0-0/
- GitHub: https://github.com/donnma777/smart-access-control

### 便利ツール拡張機能まとめ

Chrome拡張機能をまとめたリポジトリ。広告ブロック・強制ダークモード・スクリーンショットを単体または統合版で提供。

- GitHub: https://github.com/donnma777/feature-browser-benri-tools

---

## 公開・デプロイ

`main` ブランチに push すると、GitHub Actions（`.github/workflows/deploy.yml`）が次の2か所へ自動で公開します。

| 公開先 | URL | 検索エンジン | 中身 |
|--------|-----|--------------|------|
| 本番（Xserver） | https://donnma.com/tool/ | インデックスさせる | `main` をそのまま rsync |
| GitHub Pages | https://tools.donnma.com/ | `noindex` | `gh-pages` ブランチ |

- `gh-pages` ブランチは自動生成です。直接編集せず、`main` を更新してください（push のたびに上書きされます）。
- GitHub Pages 用のコピーは、すべての HTML の `<head>` に `<meta name="robots" content="noindex">` を自動で追加しています。検索結果には本番（donnma.com）だけが出るようにするためです。
- 本番へのアップロードでは `.git/`・`.github/`・`CNAME`・`README.md` を除外しています。`CNAME` は GitHub Pages 専用です。
- 本番への rsync は `--delete` 付きです。リポジトリから削除・移動したファイルは、サーバーからも自動で消えます。
- サーバーに手動で置いたファイル（`overlay/donnma/`）は、`deploy.yml` の `--filter='P ...'` で削除対象から外しています。サーバーに直接ファイルを置くときは、ここに追記してください。追記しないと、次のデプロイで消えます。
- 新しいページを追加したら `sitemap.xml` にも追記してください（`robots.txt` から参照しています）。

---

© 2026 [donnma.com](https://donnma.com/)
