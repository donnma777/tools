# どんまうんど-Tools

配信者向けのツールやアセットを無料公開しているリポジトリです。

- サイト: https://donnma.com/live-tool/
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

## Plugin & Extension

### Smart Access Control

WordPressプラグイン。クローラー・User-Agent・IPアドレスを組み合わせてアクセスを精密に制御します。AIクローラーやスクレイピングツールの許可/拒否、AIへの画像非表示などに対応。

- 解説: https://donnma.com/public-app-smart-access-control-v4-0-0/
- GitHub: https://github.com/donnma777/smart-access-control

### 便利ツール拡張機能まとめ

Chrome拡張機能をまとめたリポジトリ。広告ブロック・強制ダークモード・スクリーンショットを単体または統合版で提供。

- GitHub: https://github.com/donnma777/feature-browser-benri-tools

---

© 2026 [donnma.com](https://donnma.com/)
