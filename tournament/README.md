# トーナメント表メーカー

大会で使うトーナメント表を作って、配信（OBS）・会場のモニター・画像で使うツールです。
参加者（プレイヤーまたはチーム）を1行ずつ入れると、シード・不戦勝つきの組み合わせを自動で作ります。試合をクリックしてスコアや勝者を入れると、OBSの画面もその場で更新されます。

| ファイル | 内容 |
|----------|------|
| `index.html` | 編集ページ |
| `view.html` | OBSに入れる表示ページ（幅1920・高さ1080） |
| `tournament-core.js` | 組み合わせの計算とHTML・CSS生成 |
| `songs-core.js` | 選曲リストのデータ（`window.TournamentSongs`） |

## 表示ページ

| URL | 表示 |
|-----|------|
| `view.html#show=bracket` | トーナメント表 |
| `view.html#show=match` | 今の試合のテロップ |
| `view.html#show=champion` | 優勝者の発表 |
| `view.html#show=songs` | 選曲リスト |
| `view.html#show=bracket-songs` | トーナメント表＋課題曲（試合の箱の下に曲名） |

## 保存と同期

- 大会データと見た目はブラウザの localStorage（`donnma-tournament-v1`）に保存します。
- 編集ページをOBSの「カスタムブラウザドック」、表示ページを「ブラウザソース」に入れると、同じOBSの中なので `storage` イベントで表示が自動更新されます。
- Chromeから操作するときは、OBSのWebSocketサーバー（obs-websocket v5）に接続し、obs-browser の `emit_event`（`donnmaTournamentUpdate`）で表示ページへ送ります。

## 形式

形式を追加するときは、`tournament-core.js` の `BUILDERS` に形式ごとの組み合わせの作り方を足します。

### シングルエリミネーション

- シード順／上から順、3位決定戦、何本勝負、先取での自動決着、配信中の試合。
- **敗者復活**（`T.repechage`）：戻る回戦の1枠ぶんの山を空けておき、1回戦が全部終わったら `buildRepechage()` で敗者復活トーナメント `p{r}m{i}` かラッキールーザーから復活する人を決めて差し込む。1回戦の空き枠に入るときは1回戦を作ったあとで差し込む。

### ダブルエリミネーション

- `buildDouble`。勝者側 `w{r}m{i}`・敗者側 `l{j}m{i}`・グランドファイナル `gf`／リセット `gf2`。
- レイアウトは `layoutDouble`。

### 総当たり

- `buildRoundRobin`。サークル方式で回戦を作り、試合 id は `rr_{a}_{b}`。
- 表示は星取表 `renderLeague`。

### スイスドロー

- `buildSwiss`。結果から毎回ラウンドを組み直し、前のラウンドが全部終わったら次を組む。
- 再戦を避ける組み方は `swissPair` の後戻り探索。表示は `renderSwiss`。

## スコア

- 「本数」と「点数」（音ゲーのスコアなど。直接入力して高いほうが勝ち）を選べます。
- 点数では1試合の曲数（1〜7曲）を決めると、曲ごとの曲名・点数を入れて、合計点か曲ごとの勝ち数（同数なら合計点）で勝敗を決められます。結果の `songs` に曲ごとの記録を持ち、表示する点数は `pointsOf()` で毎回計算します。
- **ハンデキャップ**（`T.handicaps`）：点数は合計点に加算、本数は最初から持つ本数。
- **失格・棄権**：試合単位（結果の `dq`）と参加者単位（`T.withdrawn`。まだ結果のない試合を相手の不戦勝＝状態 `forfeit` にする）の2通り。

## 団体戦

- `T.teamMode`（先鋒・中堅・大将など）。曲ごとの記録 `songs` を「1試合の中の小さな試合」として使い回す（本数は対戦ごとに [1, 0] を入れて過半数で自動決着、`p` に出場した選手名）。
- **勝ち抜き戦**（`T.teamRule = 'kachinuki'`）：同じ `songs` を対戦順の記録として使い、`kachiState()` で出ている人・残り人数を毎回計算する。
- **代理出場**：結果の `sub`（その試合だけ、左右それぞれ）。
- `T.teamSize = 0` はチームごとのメンバー数で人数を決める（`teamSizes()`・`subCountOf()`。点取り戦で相手がいない順番は不戦勝）。

## 選曲リスト

課題曲・ピック＆BAN・ルーレットを同じ編集ページで操作します。

- データは `songs-core.js`（`window.TournamentSongs`）で、保存場所はトーナメントとは別（`donnma-tournament-songs-v1`）。
- ピックした曲は今の試合の「○曲目の曲名」に入る。
- obs-websocket では `donnmaTournamentUpdate` に選曲データ `D` も一緒に送る。
- 選曲は試合ごと（`D.per[matchId]`）。`D.cur` は編集ページの「試合の結果」で選んでいる試合で、`switchMatch()` で切り替える。
- `view.html#show=bracket-songs` では試合の箱の下に出す（`S.songLines` を渡すと箱に曲名の行が付く）。
- `D.noReuse` なら、ほかの試合でピックされた曲を使用済み（`stateOf()`）にする。

## 見た目・画像

- 背景は透明・色・グラデーション・画像（`S.bgImage` に 1920×1080 以内の JPEG の data URL で持ち、localStorage に入る大きさにする）。
- 画像の保存は、画面の外に 1920×1080 の表示を作って html2canvas（押したときだけ cdnjs から読み込む）で PNG にする（影のアニメーションと transform の中央寄せは画像用に置き換えている）。
- 抽選の演出は `T.drawAt`（抽選ボタンを押した時刻）が変わったときに `view.html` のトーナメント表だけで流す（開き直したときは流さない。行の `data-e` で1人ずつ表示する）。

## 開発メモ

- 参加者 id は行の順番のため、参加者の欄を書き換えたときは、編集ページの `remapEntrants()` が結果・ハンデ・棄権を名前で付け直します。
- フォント一覧・文字効果は `chat-css-generator/chat-core.js` にあります。
- `tournament-core.js` か `chat-css-generator/chat-core.js` を変更したら、`index.html` と `view.html` の `?v=` を上げてください。
- 確認ダイアログは `common/ask.js` を使います。
