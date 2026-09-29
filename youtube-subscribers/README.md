# 登録者数カウンター・目標ゲージ (YouTube × OBS)

YouTube Data API v3 で登録者数を取得し、OBSのブラウザソースに表示するカウンターです。
数字のフォント・色（単色／グラデーション／レインボー）・縁取り、見出しと単位、背景の箱と枠、置く場所、動きを設定できます。
「目標まであと○人」の目標ゲージも表示できます（目標を超えたら次のキリのいい数へ自動で切り替え、または「達成」を表示したまま）。

| ファイル | 内容 |
|----------|------|
| `index.html` | 見た目の設定ページ |
| `view.html` | OBSに入れる表示ページ |
| `counter-core.js` | 設定の読み書きとCSS生成 |

## しくみ

- APIキー・チャンネル・見た目の設定は `view.html` のURLの `#` 以降に入ります（サーバーに送られないように）。
- 利用者が自分のAPIキーを用意します。APIの登録者数は1,000人を超えると上から3桁に丸められます。
- YouTube Studio の画面をOBSのカスタムCSSで加工する方式は、Studio のページでOBSのCSS差し込みが動かないため使えません。

## 開発メモ

- フォント一覧・文字効果は `chat-css-generator/chat-core.js` にあります。
- `counter-core.js` か `chat-css-generator/chat-core.js` を変更したら、`index.html` と `view.html` の `?v=` を上げてください。
- 確認ダイアログは `common/ask.js` を使います（OBSのドックでは `confirm()` が出ないことがあるため）。
