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
3. 空いている場所をダブルクリックしてパーツを追加・編集する（HTMLファイル冒頭の `CONFIG` でも初期のテキスト・カラーを変えられます）
4. 説明書で詳細な使い方を確認する

- **自動保存・プリセット**：今の画面は自動でブラウザに保存されます。メニューの「⚙️ 設定」から、名前を付けたプリセットの保存・読み込みや、画像込みのファイル書き出し／読み込みができます。
- **OBS接続**：OBS の WebSocket サーバー（OBS 28 以降）に接続すると、Chrome で編集した内容を OBS のブラウザソースにそのまま反映できます（リアルタイム／確定したときだけ）。
- **表示更新**：同じURLを別タブで開いている画面へ編集内容を反映できます（`file://` 直接ではなく `http://` 経由で開く必要があります。`サーバー起動.bat` で手元確認用のローカルサーバーを立ち上げられます）。
- **表示専用・締め付け**：`CONFIG.features` で設定画面の各機能を隠したり、`editLock: true` で画面の編集を一切できなくしたりできます（ゲームセンターなど向け）。OBS接続の初期値は `CONFIG.obs` に書けます。

共通機能（保存・プリセット・OBS接続・設定画面）のコードは、開発用リポジトリ（live-tool-local）の `overlay/_shared/` で管理し、`build.py` で各テーマの HTML に流し込んでいます。各 HTML の `shared-css` / `shared-html` / `shared-js` の目印の間は直接編集しないでください。

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

## 登録者数カウンター・目標ゲージ (YouTube × OBS)

`youtube-subscribers/` — YouTube Data API v3 で登録者数を取得し、OBSのブラウザソースに表示するカウンターです。
数字のフォント・色（単色／グラデーション／レインボー）・縁取り、見出しと単位、背景の箱と枠、置く場所、動きを設定できます。
「目標まであと○人」の目標ゲージも表示できます（目標を超えたら次のキリのいい数へ自動で切り替え、または「達成」を表示したまま）。

- `index.html` は見た目の設定ページ、`view.html` はOBSに入れる表示ページです。APIキー・チャンネル・見た目の設定は `view.html` のURLの `#` 以降に入ります（サーバーに送られないように）。
- 利用者が自分のAPIキーを用意します。APIの登録者数は1,000人を超えると上から3桁に丸められます。
- YouTube Studio の画面をOBSのカスタムCSSで加工する方式は、Studio のページでOBSのCSS差し込みが動かないため使えません。
- フォント一覧・文字効果は `chat-css-generator/chat-core.js`、設定の読み書きとCSS生成は `youtube-subscribers/counter-core.js` にあります。どちらかを変更したら、`youtube-subscribers/index.html` と `youtube-subscribers/view.html` の `?v=` を上げてください。

---

## トーナメント表メーカー

`tournament/` — 大会で使うトーナメント表を作って、配信（OBS）・会場のモニター・画像で使うツールです。
参加者（プレイヤーまたはチーム）を1行ずつ入れると、シード・不戦勝つきの組み合わせを自動で作ります。試合をクリックしてスコアや勝者を入れると、OBSの画面もその場で更新されます。

- 選曲リスト（課題曲・ピック＆BAN・ルーレット）も同じ編集ページで操作する。データは `songs-core.js`（`window.TournamentSongs`）で、保存場所はトーナメントとは別（`donnma-tournament-songs-v1`）。表示は `view.html#show=songs`。ピックした曲は今の試合の「○曲目の曲名」に入る。obs-websocket では `donnmaTournamentUpdate` に選曲データ `D` も一緒に送る。選曲は試合ごと（`D.per[matchId]`。`D.cur` は編集ページの「試合の結果」で選んでいる試合で、`switchMatch()` で切り替える）で、`view.html#show=bracket-songs`（トーナメント表＋課題曲）で試合の箱の下に出す（`S.songLines` を渡すと箱に曲名の行が付く）。`D.noReuse` なら、ほかの試合でピックされた曲を使用済み（`stateOf()`）にする。
- `index.html` は編集ページ、`view.html` はOBSに入れる表示ページ（幅1920・高さ1080）です。`view.html#show=bracket`（トーナメント表）／`#show=match`（今の試合のテロップ）／`#show=champion`（優勝者の発表）で表示を選びます。
- 大会データと見た目はブラウザの localStorage（`donnma-tournament-v1`）に保存します。編集ページをOBSの「カスタムブラウザドック」、表示ページを「ブラウザソース」に入れると、同じOBSの中なので `storage` イベントで表示が自動更新されます。
- Chromeから操作するときは、OBSのWebSocketサーバー（obs-websocket v5）に接続し、obs-browser の `emit_event`（`donnmaTournamentUpdate`）で表示ページへ送ります。
- 形式はシングルエリミネーション（シード順／上から順、3位決定戦、何本勝負、先取での自動決着、配信中の試合）（敗者復活 `T.repechage`：戻る回戦の1枠ぶんの山を空けておき、1回戦が全部終わったら `buildRepechage()` で敗者復活トーナメント `p{r}m{i}` かラッキールーザーから復活する人を決めて差し込む。1回戦の空き枠に入るときは1回戦を作ったあとで差し込む）・ダブルエリミネーション（`buildDouble`。勝者側 `w{r}m{i}`・敗者側 `l{j}m{i}`・グランドファイナル `gf`／リセット `gf2`。レイアウトは `layoutDouble`）・総当たり（`buildRoundRobin`。サークル方式で回戦を作り、試合 id は `rr_{a}_{b}`。表示は星取表 `renderLeague`）・スイスドロー（`buildSwiss`。結果から毎回ラウンドを組み直し、前のラウンドが全部終わったら次を組む。再戦を避ける組み方は `swissPair` の後戻り探索。表示は `renderSwiss`）。スコアは「本数」と「点数」（音ゲーのスコアなど。直接入力して高いほうが勝ち）を選べます。点数では1試合の曲数（1〜7曲）を決めると、曲ごとの曲名・点数を入れて、合計点か曲ごとの勝ち数（同数なら合計点）で勝敗を決められます（結果の `songs` に曲ごとの記録を持ち、表示する点数は `pointsOf()` で毎回計算する）。画像の保存は、画面の外に 1920×1080 の表示を作って html2canvas（押したときだけ cdnjs から読み込む）で PNG にする（影のアニメーションと transform の中央寄せは画像用に置き換えている）。背景は透明・色・グラデーション・画像（`S.bgImage` に 1920×1080 以内の JPEG の data URL で持ち、localStorage に入る大きさにする）。ハンデキャップは `T.handicaps`（点数は合計点に加算、本数は最初から持つ本数）。失格・棄権は試合単位（結果の `dq`）と参加者単位（`T.withdrawn`。まだ結果のない試合を相手の不戦勝＝状態 `forfeit` にする）の2通り。団体戦（`T.teamMode`、先鋒・中堅・大将など）は、曲ごとの記録 `songs` を「1試合の中の小さな試合」として使い回す（本数は対戦ごとに [1, 0] を入れて過半数で自動決着、`p` に出場した選手名）。勝ち抜き戦（`T.teamRule = 'kachinuki'`）は同じ `songs` を対戦順の記録として使い、`kachiState()` で出ている人・残り人数を毎回計算する。代理出場は結果の `sub`（その試合だけ、左右それぞれ）。`T.teamSize = 0` はチームごとのメンバー数で人数を決める（`teamSizes()`・`subCountOf()`。点取り戦で相手がいない順番は不戦勝）。参加者の欄を書き換えたときは、編集ページの `remapEntrants()` が結果・ハンデ・棄権を名前で付け直す（参加者 id は行の順番のため）。抽選の演出は `T.drawAt`（抽選ボタンを押した時刻）が変わったときに `view.html` のトーナメント表だけで流す（開き直したときは流さない。行の `data-e` で1人ずつ表示する）。スイスドローなどを追加するときも、`tournament-core.js` の `BUILDERS` に形式ごとの組み合わせの作り方を足す作りです。
- フォント一覧・文字効果は `chat-css-generator/chat-core.js`、組み合わせの計算とHTML・CSS生成は `tournament/tournament-core.js` にあります。どちらかを変更したら、`tournament/index.html` と `tournament/view.html` の `?v=` を上げてください。

---

## ルーレット

`roulette/` — ブラウザでそのまま使えて、OBSの配信画面にも出せる汎用のルーレットです（OBS向けの機能に特化）。項目・当たりやすさ（重み）・色・見た目を決めて、OBSのドックやChromeから回します。

| ファイル | 内容 |
|----------|------|
| `roulette/index.html` | 編集・操作ページ（`?dock=1` でOBSのカスタムブラウザドック向けの表示） |
| `roulette/view.html` | OBSのブラウザソースに入れる表示ページ（canvas で円盤を描く。ウィンドウの大きさに合わせて拡大・縮小） |
| `roulette/roulette-core.js` | 項目 `R`・見た目 `S` の初期値と読み込み、抽選、保存、CSS生成（`window.RouletteCore`） |

- 当たる項目と止まる角度は、回したページが `spin()` で決めて `R.spin`（`at`・`id`・`angle`・そのときの円盤の項目 `items`）に書きます。表示ページは `R.spin.at` が変わったら、その角度に止まる演出を流します（開き直したときは流さない）。だから、プレビューとOBSで同じ結果に止まります。止め方は2通り：自動（`spin.mode = 'auto'`。回し始めに当たりを決めて `dur` 秒で止まる）と、ストップボタン式（`'free'`。押すまで同じ速さで回り、`stopSpin()` を呼んだ時刻 `stopAt` に当たりを決めて、表示ページが今の速さから減速して止める。`maxSec` 秒で自動で止める処理は、回し始めたページだけが持つ。0 なら無限）。
- 項目と見た目はブラウザの localStorage（`donnma-roulette-v1`）に保存します。ドックとブラウザソースは同じOBSの中なので、`storage` イベントで同期します。Chrome から操作するときは obs-websocket の `emit_event`（`donnmaRouletteUpdate`）で送ります。OBSでソースを「対話」で開いて円盤をクリックしても回せます。
- 効果音は WebAudio で鳴らしています（音声ファイルなし）。
- 履歴の表示（`S.histPos`：右・左・下）は `view.html` の `#stage` のグリッドに `.rl-hist` を足して、ステージの大きさ（`fit()`）もその分広げます。回っている最中（当たりが決まってから止まるまで）は `R.history[0]` を出さず、止まってから足します。
- 編集ページの「⛶ 大きく表示」は、プレビュー（`view.html#preview=1`）を画面いっぱいに広げるだけです。「↗ 別タブで開く」は `view.html#tab=1` を新しいタブで開きます（localStorage を共有するので、編集ページで回すと一緒に回る）。確認はOBSのドックで `confirm()` が出ないことがあるので、ページの中の確認（`ask()`）を使っています。
- `view.html#show=history` は結果の記録だけを出します（全件・時刻つき・効果音なし。`&tab=1` で背景を暗くする。編集ページの「↗ 別タブで開く」はこれを開く）。見た目は「履歴の表示」の設定を使います。
- `roulette-core.js` を変更したら、`roulette/index.html`（script と iframe の `view.html?v=`）と `roulette/view.html` の `?v=` を上げてください。

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

## サムネイルメーカー

`eyecatch/index.html` — ブログのアイキャッチ・YouTubeのサムネイル・SNSの共有画像を、ブラウザの canvas で作って JPG / PNG / WebP で保存するツールです（1ページで完結）。

- 大きさ（1280×720・1200×630・1600×900・1080×1080・1080×1920・自由）、背景（水玉・ストライプ・チェック・グラデーション・無地・自分の画像・透明）、横に置く画像（自分の画像。選ばなければコードで描いたサンプル：ハート・星・うさぎ）を選べます。サンプルのうさぎは どんまうんど のデザインなので、初期値にはせず選択肢のいちばん下に置き、再配布しないよう注意書きしています（うさぎ柄の背景は置かない）。横長では画像と文字を横に、縦長・正方形では上下に並べます。
- 文字は枠に収まるまで自動で小さくします。フォント一覧は `chat-css-generator/chat-core.js` と共通です。
- ロゴ（自分の画像）を「タイトルの代わり」「タイトルの上」「隅に小さく」に置けます。横に置く画像は 左・右・上・下・真ん中 と、左右・上下のずらし（プレビューでドラッグしても動く。`S.imgX`・`S.imgY` は幅・高さの %）。背景画像は「画面いっぱい／全体が入る」と暗さを選べます。
- テンプレート（見た目を名前付きで保存。画像ごと IndexedDB `donnma-eyecatch` に入れる。読み込んでもタイトル・サブタイトルは今のまま）、タイトルの `*〜*` の強調、文字のそろえ方・ずらし（ドラッグ可）、文字の後ろの座布団、追加の文字・画像（`S.extras`。`type` が `text` / `image`。画像は localStorage `donnma-eyecatch-extra-<id>`。重なりの順は `S.order`（下→上。`@pic` メインの画像、`@text` タイトル（とロゴ）、`@sub` サブタイトル。サブタイトルは `S.subX`・`S.subY` でタイトルと別にずらせる）で、一覧は上ほど前）、元に戻す（設定の履歴。Ctrl+Z / Ctrl+Y）、まとめて作る（1行1枚。押したときだけ cdnjs の JSZip を読み込んで ZIP にする）。
- 選んだ画像はサーバーに送らず、縮めてこのブラウザの localStorage に残します（入らない大きさなら、開いている間だけ使う）。

---

## 共通の部品

- `common/ask.js` — ページの中に出す確認・お知らせ（`DonnmaAsk.ask(msg, { yes, no })` → はい true／いいえ false／Esc・外側クリック null、`DonnmaAsk.notice(msg)`）。OBSのカスタムブラウザドックやソースの「対話」では `confirm()` / `alert()` が出ないことがあるので、ツールのページではこちらを使います（トーナメント表・ルーレット・チャットCSS・登録者数）。
- 配信オーバーレイは HTML 1ファイルで完結させるため、同じ仕組みを `overlay/_shared/overlay-shared.js` の `overlayAsk()` / `overlayNotice()` として持っています。

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
