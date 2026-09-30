# 共通の部品

## ask.js

ページの中に出す確認・お知らせです。OBSのカスタムブラウザドックやソースの「対話」では `confirm()` / `alert()` が出ないことがあるので、ツールのページではこちらを使います。

```js
DonnmaAsk.ask(msg, { yes, no })  // はい → true／いいえ → false／Esc・外側クリック → null
DonnmaAsk.notice(msg)
```

使っているツール：トーナメント表・ルーレット・あみだくじ・チャットCSS・登録者数

配信オーバーレイは HTML 1ファイルで完結させるため、これを読み込まず、同じ仕組みを `overlayAsk()` / `overlayNotice()` として持っています（[overlay/README.md](../overlay/README.md)）。
