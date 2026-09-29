# 配信オーバーレイ (OBS Studio)

OBS Studio のブラウザソースで使える配信オーバーレイのテーマ集です。
解像度は 1920×1080 を想定しています。

| テーマ | フォルダ |
|--------|----------|
| GAMING | `gaming/` |
| CYBERPUNK VAPORWAVE | `cyberpunk-gaming/` |
| GAMING GIRLY NEON | `gaming_girly_neon/` |
| SWEET LOLITA ROSE | `sweet_lolita_rose/` |
| 和 WA | `wa/` |
| POP | `pop/` |
| CITY POP | `citypop/` |

各フォルダにオーバーレイ本体（`.html`）と説明書（`index.html` または `説明書.html`）、ローカルプレビュー用の `サーバー起動.bat` が入っています。

## 使い方

1. お好みのテーマフォルダを選ぶ
2. OBS Studio の「ブラウザソース」でHTMLファイルを読み込む
3. 空いている場所をダブルクリックしてパーツを追加・編集する（HTMLファイル冒頭の `CONFIG` でも初期のテキスト・カラーを変えられます）
4. 説明書で詳細な使い方を確認する

## 機能

- **自動保存・プリセット**：今の画面は自動でブラウザに保存されます。メニューの「⚙️ 設定」から、名前を付けたプリセットの保存・読み込みや、画像込みのファイル書き出し／読み込みができます。
- **OBS接続**：OBS の WebSocket サーバー（OBS 28 以降）に接続すると、Chrome で編集した内容を OBS のブラウザソースにそのまま反映できます（リアルタイム／確定したときだけ）。
- **表示更新**：同じURLを別タブで開いている画面へ編集内容を反映できます（`file://` 直接ではなく `http://` 経由で開く必要があります。`サーバー起動.bat` で手元確認用のローカルサーバーを立ち上げられます）。
- **表示専用・締め付け**：`CONFIG.features` で設定画面の各機能を隠したり、`editLock: true` で画面の編集を一切できなくしたりできます（ゲームセンターなど向け）。OBS接続の初期値は `CONFIG.obs` に書けます。

## 開発メモ

- 共通機能（保存・プリセット・OBS接続・設定画面）のコードは、開発用リポジトリ（live-tool-local）の `overlay/_shared/` で管理し、`build.py` で各テーマの HTML に流し込んでいます。各 HTML の `shared-css` / `shared-html` / `shared-js` の目印の間は直接編集しないでください。
- HTML 1ファイルで完結させるため、ページ内の確認・お知らせは `common/ask.js` を読み込まず、同じ仕組みを `overlay/_shared/overlay-shared.js` の `overlayAsk()` / `overlayNotice()` として持っています。
- サーバーに手動で置いている `overlay/donnma/` はこのリポジトリにはありません（デプロイで消えないよう `deploy.yml` で保護しています）。
