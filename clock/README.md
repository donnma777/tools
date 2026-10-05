# 時計・経過時間

OBS のブラウザソースで使う時計です。時計・もう1つの時刻（海外）・経過時間（配信・録画・決めた時刻・表示してから）を出します。

| ファイル | 内容 |
|----------|------|
| `index.html` | 設定ページ。見た目を選ぶと、見本（`view.html` を iframe で）と URL を出す。設定はこのブラウザに覚えておく（`donnma-clock-editor`） |
| `view.html` | OBS に入れるページ（noindex）。設定はすべて URL から読む |

## URL の決まり（`view.html`）

| 名前 | 中身 | ふつう |
|---|---|---|
| `t` | テーマ：simple / gaming / cyber / neon / rose / wa / pop / city（配信オーバーレイと同じ見た目） | simple |
| `a` | 色（# なしの 6 けた） | テーマの色 |
| `p` | `1` で台を付ける（simple だけ） | 0 |
| `ly` / `al` / `sz` | 並べ方 row・col／寄せ left・center・right／大きさ % | row / center / 100 |
| `c` `h` `s` `d` `l1` `wd` | 時計を出す・12/24・秒・日付（none/md/ymd/en）・上の文字・曜日の言葉（ja/en） | 1 / 24 / 1 / md / なし / ja |
| `z` / `zl` | もう1つの時刻（IANA の名前）／上の文字 | なし |
| `e` | 経過時間：none / stream / record / replay（リプレイバッファ）/ vcam（仮想カメラ）/ since / load | none |
| `el` / `et` / `eh` | 上の文字／since の時刻（HH:MM）／`1` で数えていないときは隠す | 配信時間 / 20:00 / 0 |
| `demo` | `1` なら OBS がなくても今から数える（設定ページの見本用） | 0 |

## OBS につないで反映（`index.html`）

- obs-websocket v5（`ws://127.0.0.1:ポート`、パスワード認証）につなぎ、ブラウザソースの一覧（`GetInputList` browser_source）を出す。URL に `/clock/view.html` を含むものは「⏱」で先に並べる
- 時計のソースを選ぶと、その URL から設定を読み込む（`fromUrl`）。つないだ・開いただけでは送らない。「すぐ反映」なら設定を変えると 0.6 秒待ってから、「ボタンで反映」なら「📤 OBS に反映」か Ctrl+Enter で、`SetInputSettings` で URL を書き換える（同じ URL なら送らない。まだ送っていない変更があるとボタンが光る）
- 「＋ 今のシーンに時計のソースを足す」は `CreateInput`（大きさは目安の大きさ）
- ポート・パスワード・選んだソース・自動でつなぐかは localStorage（`donnma-clock-obs`）

## 経過時間の数え方

- stream / record / replay / vcam は OBS のブラウザソースの `window.obsstudio`（`obsStreamingStarted` などのイベントと `getStatus`）で数える。OBS の WebSocket やパスワードは使わない。
- 始めた時刻は localStorage（`donnma-clock-stream` / `donnma-clock-record`）に覚えて、ソースを読み込み直しても続きから数える。止めたら消す。録画の一時停止の間は数えない。
- ページ権限が「アクセス権なし」だとイベントが来ない（説明に書いてある）。

## 開発メモ

- テーマを足すときは、`view.html` の CSS（`.t-名前`）と色、`index.html` の `THEMES` の両方に足す。
- 数字は1文字ずつ同じ幅の箱に入れて、秒が変わっても揺れないようにしている。数字の幅が広いフォント（Orbitron など）はテーマごとに幅を変える。
