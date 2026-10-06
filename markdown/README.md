# マークダウンメーカー

Markdown を書きながら、すぐ見た目を確かめられるツールです。書いたものはブラウザの中だけで扱い、どこにも送りません。

| ファイル | 内容 |
|----------|------|
| `index.html` | 画面と編集の処理 |
| `marked.umd.js` | Markdown → HTML（[marked](https://github.com/markedjs/marked) 16.4.2、MIT） |
| `purify.min.js` | 見た目に出す HTML の消毒（[DOMPurify](https://github.com/cure53/DOMPurify) 3.4.16、Apache-2.0 / MPL-2.0） |
| `turndown.js` | 貼り付けた HTML → Markdown（[Turndown](https://github.com/mixmark-io/turndown) 7.2.4、MIT） |
| `turndown-plugin-gfm.js` | Turndown の取り消し線・チェックリスト・コード（[turndown-plugin-gfm](https://github.com/mixmark-io/turndown-plugin-gfm) 1.0.2、MIT） |
| `*-LICENSE.txt` | それぞれのライセンス |

## できること

- **書く・見る**：左に Markdown、右に見た目（GFM）。「書く」「両方」「見る」を切り替え。狭い画面（800px 以下）では「両方」を出さない。両方のときはスクロールを割合で合わせる
- **書式ボタン**：見出し（H1〜H3）・太字・斜体・取り消し線・コード・箇条書き・番号・チェックリスト・引用・コードのかたまり・リンク・画像・表・区切り線・目次。もう付いていれば外す
- **キー**：Ctrl+B / I / K、Ctrl+S（.md で保存）。箇条書き・引用の行で Enter を押すと記号を続け、空の項目で Enter なら終わる。Tab / Shift+Tab で行を下げる・上げる（箇条書きは上の項目の文字の位置まで）。Esc のあとの Tab はふつうにフォーカスを移す
- **表**：ます目で作る。カーソルが表の中なら、その表を読み込んで直す。列ごとに左・中・右よせ。Excel のコピーをます目に貼ると、そこから入る。全角は幅 2 で数えて縦をそろえる
- **貼り付け**（オンのとき）：
  - タブ区切り（Excel・スプレッドシート）→ 表（1行目が見出し）
  - 見出し・リンク・リストなどのある HTML（Web ページ・Word・Google ドキュメント）→ Turndown で Markdown。Google ドキュメントの `<b id="docs-internal-guid…">` と、span の style の太字・斜体・取り消し線を直してから変換する
  - VS Code のような、色を付けただけの HTML は変換しない（Markdown の記号がエスケープされるのを防ぐ）
  - 文字を選んだまま URL を貼る → `[文字](URL)`
  - Ctrl+Shift+V はそのまま貼る
- **開く**：.md / .txt を選ぶかドロップ（5MB まで。UTF-8 で読めなければ Shift_JIS）
- **保存・コピー**：.md、HTML（白い見た目の CSS を入れた1ファイル）、Markdown・HTML・見た目のまま（text/html）をコピー。ファイル名は最初の見出し
- 書いているもの・設定は localStorage（`donnma-markdown`）に覚える。はじめて開いたときは見本を入れる

## 開発メモ

- 書きかえは `document.execCommand('insertText')` で行い、Ctrl+Z で戻せるようにしている（使えないときは `setRangeText`）。
- 見た目は `marked` → `DOMPurify.sanitize`。`http(s)` のリンクには `target="_blank" rel="noopener noreferrer"` を付ける。見出しの id は GitHub と同じ作り方（目次のリンク先）。
- Turndown の表は自前のルールで変換する（gfm プラグインの表は見出し行がないと HTML のまま残すため）。箇条書きの記号の後ろも自前で空白1つにしている。
