# チャットCSSジェネレーター (YouTube / Twitch × OBS)

YouTubeライブ・Twitchのチャット欄をOBSのブラウザソースで表示するときの見た目を、プレビューを見ながら作成できるツールです。
フォント・縁取り・吹き出し・名前の色・スーパーチャット・表示/フェードアウトアニメーションなどを設定し、生成されたCSSをOBSのブラウザソースの「カスタムCSS」に貼り付けて使います。

| ファイル | 内容 |
|----------|------|
| `index.html` | ジェネレーター本体 |
| `chat-core.js` | CSS生成・プレビュー用の見本DOM。フォント一覧・文字効果はほかのツールからも使う |

## 使い方

- **YouTube**: ポップアウトチャット（`https://www.youtube.com/live_chat?is_popout=1&v=動画ID`）を読み込んだブラウザソースに貼り付けます。
- **Twitch**: ポップアウトチャット（`https://www.twitch.tv/popout/チャンネル名/chat?popout=`）を読み込んだブラウザソースに貼り付けます。Twitchの自動生成クラスは使わず、固定のクラス名・data属性だけで指定しています。

## 開発メモ

- `chat-core.js` を変更したら、`index.html` の `<script src="chat-core.js?v=...">` の `v` も上げてください。本番サーバーは JS を長期間キャッシュするため、`v` を変えないと古い `chat-core.js` が配信され、ジェネレーターが動かなくなります。
- `chat-core.js` のフォント一覧・文字効果は次のツールも読み込んでいます。変更したら、それぞれの `?v=` も上げてください。
  - `youtube-subscribers/`（`index.html`・`view.html`）
  - `tournament/`（`index.html`・`view.html`）
  - `thumbnail/`（フォント一覧）
