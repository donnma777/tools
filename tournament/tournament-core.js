/*
 * トーナメント表メーカー — 編集ページ（index.html）と表示ページ（view.html）で共通の部品
 *  - 大会データ（T）と見た目の設定（S）の初期値・読み込み
 *  - 組み合わせ・勝ち上がりの計算（形式ごと。今はシングルエリミネーション）
 *  - 表示用の HTML と CSS の生成
 * フォント一覧・文字効果は ../chat-css-generator/chat-core.js（window.ChatCore）を使う。
 * このファイルを変えたら、読み込んでいる2ページの ?v= を上げる。
 */
(function (global) {
  'use strict';
  const C = global.ChatCore;

  // ---------------------------------------------------------------
  //  大会データ（T）
  //  results は試合ごとの結果。対戦した2者の id も一緒に持ち、
  //  組み合わせが変わって相手が違う試合になったら、その結果は使わない。
  // ---------------------------------------------------------------
  const DEFAULT_T = {
    version: 1,
    title: 'トーナメント',
    subtitle: '',
    format: 'single',
    seeding: 'standard',      // 'standard' = シード順（1位 vs 最下位…） / 'order' = 上から順に2人ずつ
    thirdPlace: false,        // 3位決定戦（シングルエリミネーション）
    gfReset: true,            // ダブルエリミネーション：グランドファイナルで敗者側が勝ったら、もう1試合（リセット）
    swissRounds: 0,           // スイスドローのラウンド数（0 = 人数に合わせて自動）
    repechage: 'none',        // シングルの敗者復活 'none' | 'bracket'（1回戦の敗者でトーナメント） | 'lucky'（ラッキールーザー）
    repReturn: 1,             // 敗者復活した人が本戦に入る回戦（1 = 1回戦の空き枠。ほかの1回戦が終わってから対戦）
    repCount: 1,              // 敗者復活できる人数（1〜2）
    luckyPicks: [],           // ラッキールーザーを手で選んだとき（参加者 id）
    bestOf: 3,                // 何本勝負（1 / 3 / 5 / 7…）
    finalBestOf: 3,           // 決勝だけ別にする
    scoreMode: 'wins',        // 'wins' = 本数（2-1 など） / 'points' = 点数（音ゲーのスコアなど）
    songCount: 1,             // 点数のとき、1試合の曲数（曲ごとの点数の合計で勝敗を決める）
    songList: '',             // 課題曲の候補（1行に1曲。曲名の入力欄の候補になる）
    pointsRule: 'total',      // 複数曲のとき 'total' = 合計点で勝敗 / 'songs' = 曲ごとの勝ち数（同数なら合計点）
    songPlayers: false,       // 点数で複数曲のとき、曲ごとに出た選手を入れる（メンバーを書いたチームがあれば自動で出る）
    teamMode: false,          // 団体戦：1試合の中で、チームのメンバーどうしが順番に対戦する（先鋒・中堅・大将など）
    teamSize: 3,              // 団体戦の1チームの人数（2〜7。0 = チームごとのメンバー数で自動）
    teamRule: 'point',        // 団体戦の方式 'point' = 点取り戦（先鋒・中堅・大将が1回ずつ） / 'kachinuki' = 勝ち抜き戦
    positions: '',            // 団体戦の順番の呼び名（1行に1つ。空なら人数に合わせて自動）
    autoWin: true,            // 本数のとき、先取数に届いたら自動で勝者にする
    entrantsText: 'プレイヤー1\nプレイヤー2\nプレイヤー3\nプレイヤー4\nプレイヤー5\nプレイヤー6\nプレイヤー7\nプレイヤー8',
    results: {},              // matchId -> { ids: [a, b], s: [x, y], w: 0 | 1 | null, songs?: [{ t: 曲名, s: [x, y] }], dq?: { side: 0 | 1, kind: 'dq' | 'ret' } }
    handicaps: {},            // ハンデキャップ：entrantId -> 数値（点数なら合計点に加算、本数なら最初から持っている本数）
    withdrawn: {},            // 途中で抜けた参加者：entrantId -> 'ret'（棄権） | 'dq'（失格）。まだ結果のない試合は相手の不戦勝
    live: null,               // 配信中の試合の matchId
    drawAt: 0,                // 抽選ボタンを押した時刻（表示ページはこれが変わったら抽選の演出を流す）
  };

  const BYE = '__bye__';
  const FORMATS = { single: 'シングルエリミネーション', double: 'ダブルエリミネーション', roundrobin: '総当たり（リーグ戦）', swiss: 'スイスドロー' };

  function sanitizeT(obj) {
    const out = JSON.parse(JSON.stringify(DEFAULT_T));
    if (!obj || typeof obj !== 'object') return out;
    for (const k of Object.keys(DEFAULT_T)) {
      if (!(k in obj)) continue;
      const d = DEFAULT_T[k], v = obj[k];
      if (k === 'results') { if (v && typeof v === 'object') out.results = v; continue; }
      if (k === 'live') { out.live = typeof v === 'string' ? v : null; continue; }
      if (k === 'handicaps') { if (v && typeof v === 'object') for (const [id, n] of Object.entries(v)) if (typeof n === 'number' && isFinite(n) && n) out.handicaps[id] = n; continue; }
      if (k === 'withdrawn') { if (v && typeof v === 'object') for (const [id, kind] of Object.entries(v)) if (kind === 'ret' || kind === 'dq') out.withdrawn[id] = kind; continue; }
      if (typeof d === typeof v) out[k] = v;
    }
    if (!FORMATS[out.format]) out.format = 'single';
    if (!['wins', 'points'].includes(out.scoreMode)) out.scoreMode = 'wins';
    out.songCount = Math.min(7, Math.max(1, Math.round(out.songCount)));
    out.teamSize = out.teamSize === 0 ? 0 : Math.min(7, Math.max(2, Math.round(out.teamSize)));
    out.swissRounds = Math.min(15, Math.max(0, Math.round(out.swissRounds)));
    if (!['point', 'kachinuki'].includes(out.teamRule)) out.teamRule = 'point';
    if (!['none', 'bracket', 'lucky'].includes(out.repechage)) out.repechage = 'none';
    out.repReturn = Math.min(7, Math.max(1, Math.round(out.repReturn)));
    out.repCount = Math.min(2, Math.max(1, Math.round(out.repCount)));
    out.luckyPicks = Array.isArray(obj.luckyPicks) ? obj.luckyPicks.filter(x => typeof x === 'string').slice(0, 2) : [];
    if (!['total', 'songs'].includes(out.pointsRule)) out.pointsRule = 'total';
    out.bestOf = Math.max(1, Math.round(out.bestOf));
    out.finalBestOf = Math.max(1, Math.round(out.finalBestOf));
    return out;
  }

  // 「名前」または「チーム名: メンバー1, メンバー2」を1行ずつ
  function parseEntrants(text) {
    return String(text || '').split(/\r?\n/).map(l => l.trim()).filter(Boolean).map((line, i) => {
      const parts = line.split(/[:：]/);
      return { id: 'e' + i, seed: i + 1, name: parts[0].trim() || `（${i + 1}）`, members: parts.slice(1).join(':').trim() };
    });
  }

  // 1位 vs 最下位、2位 vs 最下位-1 … が、勝ち上がると上位どうしが最後に当たる並び
  function seedOrder(size) {
    let order = [1, 2];
    while (order.length < size) {
      const n = order.length * 2;
      order = order.flatMap(s => [s, n + 1 - s]);
    }
    return order;
  }

  function roundName(r, rounds) {
    const fromEnd = rounds - r;
    if (fromEnd === 0) return '決勝';
    if (fromEnd === 1) return '準決勝';
    if (fromEnd === 2) return '準々決勝';
    return `${r}回戦`;
  }

  // 1試合の中の小さな試合の数（団体戦なら対戦数、点数なら曲数。本数の個人戦は 0）
  const isKachi = T => T.teamMode && T.teamRule === 'kachinuki';
  // 曲ごとに出た選手を入れるか（団体戦ではない点数・複数曲のとき）
  const songPlayersOn = (T, B) => !T.teamMode && T.scoreMode === 'points' && T.songCount > 1 && (T.songPlayers || B.entrants.some(e => e.members));
  // 勝ち抜き戦は、多くて「人数×2−1」回戦う
  const MAX_MEMBERS = 10;
  const subCount = T => {
    const n = T.teamSize || MAX_MEMBERS;
    return T.teamMode ? (isKachi(T) ? n * 2 - 1 : n) : T.scoreMode === 'points' ? T.songCount : 0;
  };
  // 参加者 id → 参加者（入力が変わったときだけ作り直す）
  let entCache = { text: null, map: {} };
  function entrantOf(T, id) {
    if (entCache.text !== T.entrantsText) entCache = { text: T.entrantsText, map: Object.fromEntries(parseEntrants(T.entrantsText).map(e => [e.id, e])) };
    return entCache.map[id];
  }
  // 団体戦の2チームの人数。「自動」ならチームごとに書いたメンバーの人数（書いていなければ3人）
  function teamSizes(T, m) {
    if (T.teamSize || !m) return [T.teamSize || 3, T.teamSize || 3];
    return [m.a, m.b].map((id, i) => Math.min(MAX_MEMBERS, Math.max(1, membersOf(rosterOf(entrantOf(T, id), m, i)).length || 3)));
  }
  // その試合の中の対戦の数（勝ち抜きは多くて「人数の合計−1」、点取りは多いほうの人数）
  function subCountOf(T, m) {
    if (!T.teamMode || !m) return subCount(T);
    const [x, y] = teamSizes(T, m);
    return isKachi(T) ? x + y - 1 : Math.max(x, y);
  }
  const AUTO_POS = { 2: ['先鋒', '大将'], 3: ['先鋒', '中堅', '大将'], 4: ['先鋒', '次鋒', '副将', '大将'], 5: ['先鋒', '次鋒', '中堅', '副将', '大将'] };
  // 団体戦の順番の呼び名（入れたものを優先。足りない分は自動）
  function positionNames(T, n = T.teamSize || 3) {
    const custom = String(T.positions || '').split(/\r?\n/).map(x => x.trim()).filter(Boolean);
    const auto = AUTO_POS[n] || Array.from({ length: n }, (_, i) => `${i + 1}人目`);
    return auto.map((a, i) => custom[i] || a);
  }
  const subLabel = (T, i, n) => (isKachi(T) ? `${i + 1}戦目` : T.teamMode ? positionNames(T, n)[i] : `${i + 1}曲目`);
  // 勝ち抜き戦の進み具合：勝った人が残り、負けた側は次の人が出る（引き分けは両方とも交代）。
  //  bouts = 行った対戦（と次の対戦）。ia / ib = それぞれ何人目が出ているか。left = 残り人数
  function kachiState(T, list, sizes = [T.teamSize || 3, T.teamSize || 3]) {
    const [sa, sb] = sizes;
    let ia = 0, ib = 0, done = 0;
    const bouts = [];
    for (let k = 0; k < list.length; k++) {
      if (ia >= sa || ib >= sb) break;
      const x = list[k];
      const [a, b] = x.s;
      const fin = a !== null && b !== null;
      bouts.push({ k, x, ia, ib, fin });
      if (!fin) break;
      done++;
      if (a > b) ib++; else if (b > a) ia++; else { ia++; ib++; }
    }
    const over = ia >= sa || ib >= sb;
    // 両チームとも残りがいない（最後が引き分け）なら、勝敗は手で決める
    const w = !over || (ia >= sa && ib >= sb) ? null : ia >= sa ? 1 : 0;
    return { bouts, ia, ib, done, over, w, sizes, left: [sa - Math.min(ia, sa), sb - Math.min(ib, sb)] };
  }
  // 「チーム名: メンバー1, メンバー2」のメンバーを順番どおりに
  const membersOf = e => String(e?.members || '').split(/[,、，/／]/).map(x => x.trim()).filter(Boolean);
  // 団体戦の本数：過半数を先に取ったら勝ち
  const teamNeed = n => Math.floor(n / 2) + 1;

  // ハンデキャップ（その試合の2者ぶん）
  const hcOf = (T, id) => (id && T.handicaps?.[id]) || 0;
  const hcPair = (T, m) => [hcOf(T, m.a), hcOf(T, m.b)];

  // 勝敗が決まっている（不戦勝・失格／棄権を含む）
  const isDecided = m => m.status === 'done' || m.status === 'bye' || m.status === 'forfeit';

  // 1試合の状態を決める
  function resolveMatch(T, m) {
    const { a, b } = m;
    m.s = [null, null];
    m.w = null;
    if (a === null || b === null) { m.status = 'waiting'; m.winner = null; m.loser = null; return m; }
    if (a === BYE || b === BYE) {
      m.status = 'bye';
      m.winner = a === BYE ? b : a;
      m.loser = BYE;
      return m;
    }
    const r = T.results[m.id];
    if (r && Array.isArray(r.ids) && r.ids[0] === a && r.ids[1] === b) {
      m.s = [r.s?.[0] ?? null, r.s?.[1] ?? null];
      m.songs = Array.isArray(r.songs) ? r.songs : null;
      // この試合だけの代理出場（左右それぞれ）
      if (Array.isArray(r.sub) && (r.sub[0] || r.sub[1])) m.sub = [String(r.sub[0] || ''), String(r.sub[1] || '')];
      // 代理・交代の印をこの試合だけ消す（左右それぞれ）
      if (Array.isArray(r.subHide)) m.subHide = [!!r.subHide[0], !!r.subHide[1]];
      if ((T.scoreMode === 'points' || T.teamMode) && m.songs) {
        const p = pointsOf(T, m.songs, hcPair(T, m), m);
        m.s = p.s;
        m.tot = p.tot;
        m.songWins = p.wins;
      }
      if (r.w === 0 || r.w === 1) {
        m.w = r.w;
        m.status = 'done';
        m.winner = r.w === 0 ? a : b;
        m.loser = r.w === 0 ? b : a;
        // 失格・棄権で決まった試合（負けた側に印を付ける）
        if (r.dq && (r.dq.side === 0 || r.dq.side === 1) && r.dq.side !== r.w) m.dq = { side: r.dq.side, kind: r.dq.kind === 'dq' ? 'dq' : 'ret' };
        return m;
      }
    }
    // 途中で抜けた参加者：まだ結果のない試合は、相手の不戦勝（両方抜けたら誰も勝ち上がらない）
    const wa = T.withdrawn?.[a], wb = T.withdrawn?.[b];
    if (wa || wb) {
      m.status = 'forfeit';
      if (wa && wb) { m.winner = BYE; m.loser = BYE; m.dq = { side: 0, kind: wa, both: wb }; return m; }
      const side = wa ? 0 : 1;
      m.w = 1 - side;
      m.winner = side === 0 ? b : a;
      m.loser = side === 0 ? a : b;
      m.dq = { side, kind: wa || wb };
      return m;
    }
    m.status = 'ready';
    m.winner = null;
    m.loser = null;
    // 本数でハンデがあり、まだ何も入れていない試合は、ハンデの本数から見せる
    if (m.s[0] === null && m.s[1] === null && T.scoreMode !== 'points') {
      const hc = hcPair(T, m);
      if (hc[0] || hc[1]) m.s = hc.map(v => Math.max(0, Math.round(v)));
    }
    return m;
  }

  // ---------------------------------------------------------------
  //  シングルエリミネーション
  // ---------------------------------------------------------------
  function buildSingle(T) {
    const entrants = parseEntrants(T.entrantsText);
    const n = entrants.length;
    const out = { format: 'single', entrants, byId: Object.fromEntries(entrants.map(e => [e.id, e])), rounds: [], third: null, error: '', rep: null };
    if (n < 2) { out.error = '参加者を2人（2チーム）以上入れてください'; return out; }
    if (n > 128) { out.error = '参加者は128人（チーム）までです'; return out; }
    // 敗者復活：戻る回戦の1枠ぶんの山（2^(戻る回戦−1) 枠）を空けておき、その回戦で復活した人を入れる
    const rep = T.repechage === 'bracket' || T.repechage === 'lucky' ? T.repechage : null;
    if (rep && n < 3) { out.error = '敗者復活は3人（3チーム）以上で使えます'; return out; }
    const k = rep ? T.repCount : 0;
    const retR = rep ? T.repReturn : 0;
    const block = rep ? 2 ** (retR - 1) : 1;
    const size = 2 ** Math.ceil(Math.log2(n + k * block));
    const rounds = Math.log2(size);
    const slots = T.seeding === 'order' ? Array.from({ length: size }, (_, i) => i + 1) : seedOrder(size);
    // 敗者復活の山：いちばん良いシードでも下のほうの山（＝上位シードと当たる側）を選ぶ
    const repBlocks = [];
    if (rep) {
      const blocks = Array.from({ length: size / block }, (_, b) => ({ b, best: Math.min(...slots.slice(b * block, b * block + block)) }));
      if (T.seeding === 'order') blocks.reverse(); else blocks.sort((x, y) => y.best - x.best);
      for (let j = 0; j < k; j++) repBlocks.push(blocks[j].b);
    }
    const inRep = i => rep && repBlocks.includes(Math.floor(i / block));
    // 残りの枠に、シード順に参加者を入れる（余った枠は不戦勝）
    const pos = slots.map(() => BYE);
    slots.map((s, i) => ({ s, i })).filter(x => !inRep(x.i)).sort((x, y) => x.s - y.s).forEach((x, j) => { if (j < n) pos[x.i] = entrants[j].id; });
    // 敗者復活の元になる1回戦の試合（両方に参加者がいる試合）がなければ使えない
    if (rep && !pos.some((id, i) => i % 2 === 0 && id !== BYE && pos[i + 1] !== BYE)) {
      out.error = 'この人数と「戻る回戦」では1回戦の試合がないため、敗者復活が使えません。「1回戦の空き枠に入る」にしてください';
      return out;
    }
    // 戻る回戦で、敗者復活の山から出てくる側（試合の番号と左右）
    const repEntry = {};
    repBlocks.forEach((b, j) => { repEntry[`${Math.floor(b / 2)}:${b % 2}`] = j; });
    let revived = null;
    for (let r = 1; r <= rounds; r++) {
      const count = size / 2 ** r;
      const prev = out.rounds[r - 2];
      // 2回戦以降に戻るときは、ここで決める（1回戦に入るときは、1回戦を作ったあとで決める）
      if (rep && r === retR && retR > 1) revived = buildRepechage(T, out, rep, k);
      const matches = [];
      for (let i = 0; i < count; i++) {
        const m = {
          id: `r${r}m${i + 1}`, round: r, index: i,
          bo: r === rounds ? T.finalBestOf : T.bestOf,
          a: r === 1 ? pos[i * 2] : prev.matches[i * 2].winner,
          b: r === 1 ? pos[i * 2 + 1] : prev.matches[i * 2 + 1].winner,
          roundName: roundName(r, rounds),
        };
        if (rep && r === retR) {
          for (const side of [0, 1]) {
            const j = repEntry[`${i}:${side}`];
            if (j === undefined) continue;
            const id = revived?.[j] || null;
            if (side === 0) m.a = id; else m.b = id;
            m.revived = m.revived || [false, false];
            m.revived[side] = !!id;
            m.from = m.from || [null, null];
            m.from[side] = rep === 'lucky' ? '敗者復活（ラッキールーザー）' : '敗者復活戦の勝者';
          }
        }
        matches.push(resolveMatch(T, m));
      }
      out.rounds.push({ round: r, name: roundName(r, rounds), matches });
      // 1回戦の空き枠に入るとき：ほかの1回戦の敗者から決めて、空き枠の試合を作り直す
      if (rep && r === 1 && retR === 1) {
        revived = buildRepechage(T, out, rep, k);
        for (const m of matches) {
          if (!m.revived) continue;
          for (const side of [0, 1]) {
            const j = repEntry[`${m.index}:${side}`];
            if (j === undefined) continue;
            const id = revived[j] || null;
            if (side === 0) m.a = id; else m.b = id;
            m.revived[side] = !!id;
          }
          resolveMatch(T, m);
        }
      }
    }
    out.size = size;
    out.repSlots = k;
    if (T.thirdPlace && rounds >= 2) {
      const semis = out.rounds[rounds - 2].matches;
      out.third = resolveMatch(T, { id: 'third', round: rounds, index: 1, bo: T.bestOf, a: semis[0].loser, b: semis[1].loser, isThird: true, roundName: '3位決定戦' });
    }
    out.hideable = [...out.rounds[0].matches, ...(out.rep?.rounds?.[0]?.matches || [])];
    const final = out.rounds[rounds - 1].matches[0];
    out.final = final;
    out.champion = isDecided(final) ? final.winner : null;
    if (out.champion === BYE) out.champion = null;
    out.runnerUp = (final.status === 'done' || final.status === 'forfeit') && final.loser !== BYE ? final.loser : null;
    out.thirdWinner = out.third && isDecided(out.third) && out.third.winner !== BYE ? out.third.winner : null;
    return out;
  }

  // 敗者復活：1回戦の敗者から k 人を決める。1回戦が全部終わるまでは決めない（組み合わせが変わらないように）
  //  'bracket' = 敗者どうしのトーナメント（k 人残るまで） / 'lucky' = スコアが高い順（手で選ぶこともできる）
  function buildRepechage(T, out, mode, k) {
    const src = out.rounds[0].matches.filter(m => m.a && m.b && m.a !== BYE && m.b !== BYE);
    const pending = !src.every(isDecided);
    const losers = pending ? [] : src.map(m => m.loser).filter(id => id && id !== BYE).sort((x, y) => out.byId[x].seed - out.byId[y].seed);
    const rep = out.rep = { mode, pending, rounds: [], winners: Array(k).fill(null), candidates: [] };
    if (pending) return rep.winners;
    if (mode === 'lucky') {
      // 1回戦のスコア（点数なら合計点）が高い順。同じならシードが上の人
      const scoreOf = id => {
        const m = src.find(x => x.loser === id);
        const side = m.a === id ? 0 : 1;
        return m.status === 'done' ? (m.s[side] ?? 0) : 0;
      };
      rep.candidates = losers.map(id => ({ id, score: scoreOf(id) })).sort((x, y) => y.score - x.score || out.byId[x.id].seed - out.byId[y.id].seed);
      const picks = (T.luckyPicks || []).filter(id => losers.includes(id));
      for (const c of rep.candidates) if (picks.length < k && !picks.includes(c.id)) picks.push(c.id);
      rep.picks = picks.slice(0, k);
      rep.manual = (T.luckyPicks || []).some(id => losers.includes(id));
      rep.winners = Array.from({ length: k }, (_, j) => rep.picks[j] || null);
      return rep.winners;
    }
    // 敗者復活トーナメント
    if (losers.length <= k) { rep.winners = Array.from({ length: k }, (_, j) => losers[j] || null); return rep.winners; }
    const size = 2 ** Math.ceil(Math.log2(losers.length));
    const R = Math.log2(size / k);
    const slots = seedOrder(size);
    const bySeed = s => (s <= losers.length ? losers[s - 1] : BYE);
    for (let r = 1; r <= R; r++) {
      const prev = rep.rounds[r - 2];
      const name = r === R ? (k === 1 ? '敗者復活 決勝' : '敗者復活 代表決定戦') : `敗者復活 ${r}回戦`;
      const matches = [];
      for (let i = 0; i < size / 2 ** r; i++) {
        matches.push(resolveMatch(T, {
          id: `p${r}m${i + 1}`, round: r, index: i, bo: T.bestOf, roundName: name, isRep: true,
          a: r === 1 ? bySeed(slots[i * 2]) : prev.matches[i * 2].winner,
          b: r === 1 ? bySeed(slots[i * 2 + 1]) : prev.matches[i * 2 + 1].winner,
        }));
      }
      rep.rounds.push({ round: r, name, matches });
    }
    const last = rep.rounds[R - 1].matches;
    rep.winners = last.map(m => (isDecided(m) && m.winner !== BYE ? m.winner : null));
    return rep.winners;
  }

  // ---------------------------------------------------------------
  //  ダブルエリミネーション
  //  勝者側（W）で負けると敗者側（L）へ。敗者側で負けたら敗退。
  //  敗者側は「敗者側どうし」の回と「勝者側から落ちてきた人と当たる」回が交互に来る。
  //  最後は勝者側の優勝者 vs 敗者側の優勝者のグランドファイナル（敗者側が勝ったらリセットでもう1試合）
  // ---------------------------------------------------------------
  function buildDouble(T) {
    const entrants = parseEntrants(T.entrantsText);
    const n = entrants.length;
    const out = { format: 'double', entrants, byId: Object.fromEntries(entrants.map(e => [e.id, e])), rounds: [], wRounds: [], lRounds: [], gf: [], third: null, error: '' };
    if (n < 3) { out.error = 'ダブルエリミネーションは3人（3チーム）以上で使えます'; return out; }
    if (n > 64) { out.error = 'ダブルエリミネーションは64人（チーム）までです'; return out; }
    const size = 2 ** Math.ceil(Math.log2(n));
    const R = Math.log2(size);
    out.size = size;
    const bySeed = s => (s <= n ? entrants[s - 1].id : BYE);
    const slots = T.seeding === 'order' ? Array.from({ length: size }, (_, i) => i + 1) : seedOrder(size);
    const wName = r => (r === R ? '勝者側 決勝' : `勝者側 ${roundName(r, R)}`);
    for (let r = 1; r <= R; r++) {
      const prev = out.wRounds[r - 2];
      const matches = [];
      for (let i = 0; i < size / 2 ** r; i++) {
        matches.push(resolveMatch(T, {
          id: `w${r}m${i + 1}`, bracket: 'w', round: r, index: i, bo: T.bestOf, roundName: wName(r),
          a: r === 1 ? bySeed(slots[i * 2]) : prev.matches[i * 2].winner,
          b: r === 1 ? bySeed(slots[i * 2 + 1]) : prev.matches[i * 2 + 1].winner,
        }));
      }
      out.wRounds.push({ round: r, name: wName(r), matches });
    }
    const L = 2 * (R - 1);
    for (let j = 1; j <= L; j++) {
      const prev = out.lRounds[j - 2];
      const name = j === L ? '敗者側 決勝' : `敗者側 ${j}回戦`;
      const matches = [];
      const add = (i, a, b, from) => matches.push(resolveMatch(T, { id: `l${j}m${i + 1}`, bracket: 'l', round: j, index: i, bo: T.bestOf, roundName: name, a, b, from }));
      if (j === 1) {
        // 勝者側1回戦の負けどうし
        const w1 = out.wRounds[0].matches;
        const fromName = `${out.wRounds[0].name}の敗者`;
        for (let i = 0; i < w1.length / 2; i++) add(i, w1[i * 2].loser, w1[i * 2 + 1].loser, [fromName, fromName]);
      } else if (j % 2 === 0) {
        // 敗者側の勝者 vs 勝者側から落ちてきた人（同じ相手とすぐ当たらないように、回ごとに並びを逆にする）
        const k = j / 2;
        const wl = out.wRounds[k].matches;
        const fromName = `${out.wRounds[k].name}の敗者`;
        for (let i = 0; i < prev.matches.length; i++) {
          const src = k % 2 === 1 ? wl[wl.length - 1 - i] : wl[i];
          add(i, prev.matches[i].winner, src.loser, [null, fromName]);
        }
      } else {
        for (let i = 0; i < prev.matches.length / 2; i++) add(i, prev.matches[i * 2].winner, prev.matches[i * 2 + 1].winner, null);
      }
      out.lRounds.push({ round: j, name, matches });
    }
    const wFinal = out.wRounds[R - 1].matches[0];
    const lFinal = out.lRounds[L - 1].matches[0];
    const gf = resolveMatch(T, { id: 'gf', bracket: 'f', round: 1, index: 0, bo: T.finalBestOf, roundName: 'グランドファイナル', a: wFinal.winner, b: lFinal.winner, from: ['勝者側の優勝', '敗者側の優勝'] });
    out.gf.push(gf);
    // 敗者側から来た人が勝ったら、お互い1敗ずつなのでもう1試合
    const needReset = T.gfReset && gf.status === 'done' && gf.winner === gf.b && gf.b !== BYE;
    if (needReset) out.gf.push(resolveMatch(T, { id: 'gf2', bracket: 'f', round: 2, index: 0, bo: T.finalBestOf, roundName: 'グランドファイナル（リセット）', a: gf.a, b: gf.b }));
    const final = out.gf[out.gf.length - 1];
    out.final = final;
    // 試合の順番（「次の試合」で選ぶ順）：W1, L1, W2, L2, L3, W3, L4, L5, …
    out.rounds.push(out.wRounds[0]);
    if (out.lRounds[0]) out.rounds.push(out.lRounds[0]);
    for (let r = 2; r <= R; r++) {
      out.rounds.push(out.wRounds[r - 1]);
      for (const j of [2 * r - 2, 2 * r - 1]) if (j <= L && j > 1) out.rounds.push(out.lRounds[j - 1]);
    }
    out.rounds.push({ round: 0, name: 'グランドファイナル', matches: out.gf });
    out.hideable = [...out.wRounds[0].matches, ...out.lRounds.flatMap(r => r.matches)];
    out.champion = isDecided(final) && final.winner !== BYE ? final.winner : null;
    out.runnerUp = out.champion && final.loser !== BYE ? final.loser : null;
    out.thirdWinner = isDecided(lFinal) && lFinal.loser && lFinal.loser !== BYE ? lFinal.loser : null;
    return out;
  }

  // ---------------------------------------------------------------
  //  総当たり（リーグ戦）：全員と1回ずつ。順位は勝ち数 → 得失点差（点数なら合計点） → 総得点 → シード順
  // ---------------------------------------------------------------
  function buildRoundRobin(T) {
    const entrants = parseEntrants(T.entrantsText);
    const n = entrants.length;
    const out = { format: 'roundrobin', entrants, byId: Object.fromEntries(entrants.map(e => [e.id, e])), rounds: [], third: null, final: null, error: '', standings: [] };
    if (n < 2) { out.error = '参加者を2人（2チーム）以上入れてください'; return out; }
    if (n > 20) { out.error = '総当たりは20人（チーム）までです'; return out; }
    // サークル方式：1人を固定して、残りを1つずつ回す（奇数なら空き＝その回は休み）
    let list = entrants.map(e => e.id);
    if (n % 2) list.push(null);
    const m = list.length;
    for (let r = 0; r < m - 1; r++) {
      const matches = [];
      for (let i = 0; i < m / 2; i++) {
        const x = list[i], y = list[m - 1 - i];
        if (!x || !y) continue;
        const [a, b] = out.byId[x].seed < out.byId[y].seed ? [x, y] : [y, x];
        matches.push(resolveMatch(T, { id: `rr_${a}_${b}`, round: r + 1, index: matches.length, bo: T.bestOf, roundName: `${r + 1}回戦`, a, b }));
      }
      out.rounds.push({ round: r + 1, name: `${r + 1}回戦`, matches });
      list = [list[0], list[m - 1], ...list.slice(1, m - 1)];
    }
    out.matchCount = n * (n - 1) / 2;
    out.pairs = {};
    const st = Object.fromEntries(entrants.map(e => [e.id, { id: e.id, seed: e.seed, played: 0, win: 0, lose: 0, pf: 0, pa: 0 }]));
    let decided = 0;
    for (const R of out.rounds) for (const x of R.matches) {
      out.pairs[`${x.a}|${x.b}`] = x;
      out.pairs[`${x.b}|${x.a}`] = x;
      if (!isDecided(x)) continue;
      decided++;
      if (!x.winner || x.winner === BYE) continue;
      const w = st[x.winner], l = st[x.loser];
      w.win++; w.played++;
      if (l) { l.lose++; l.played++; }
      if (x.status === 'done') {
        st[x.a].pf += x.s[0] || 0; st[x.a].pa += x.s[1] || 0;
        st[x.b].pf += x.s[1] || 0; st[x.b].pa += x.s[0] || 0;
      }
    }
    const points = T.scoreMode === 'points' && !T.teamMode;
    const key = s => [s.win, points ? s.pf : s.pf - s.pa, s.pf];
    const list2 = Object.values(st).sort((p, q) => {
      const a = key(p), b = key(q);
      for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return b[i] - a[i];
      return p.seed - q.seed;
    });
    // 同じ成績なら同じ順位
    list2.forEach((s, i) => { s.rank = i && key(s).join() === key(list2[i - 1]).join() ? list2[i - 1].rank : i + 1; });
    out.standings = list2;
    out.rankOf = Object.fromEntries(list2.map(s => [s.id, s]));
    out.started = decided > 0;
    if (decided === out.matchCount) {
      out.champion = list2[0].id;
      out.runnerUp = list2[1]?.id || null;
      out.thirdWinner = list2[2]?.id || null;
    } else out.champion = null;
    return out;
  }

  // ---------------------------------------------------------------
  //  スイスドロー：毎ラウンド、同じくらいの成績どうしで当たる（同じ相手とは当たらない）。
  //  次のラウンドの組み合わせは、前のラウンドが全部終わったときに決まる。
  //  順位は勝ち数 → ブッフホルツ（当たった相手の勝ち数の合計） → 得失点差（点数なら合計点） → シード順。
  //  人数が奇数のときは、まだ不戦勝をもらっていない一番下の人が不戦勝（1勝）。
  // ---------------------------------------------------------------
  function swissRoundsFor(T, n) {
    return T.swissRounds > 0 ? Math.min(T.swissRounds, n % 2 ? n : n - 1) : Math.ceil(Math.log2(n));
  }
  // 同じ相手と当たらないように2人ずつ組む（上から順に試して、だめなら戻ってやり直す）
  function swissPair(list, met) {
    const used = list.map(() => false), res = [];
    let steps = 0;
    const key = (x, y) => (x < y ? `${x}|${y}` : `${y}|${x}`);
    const rec = () => {
      const i = used.indexOf(false);
      if (i < 0) return true;
      used[i] = true;
      for (let j = i + 1; j < list.length; j++) {
        if (used[j] || met.has(key(list[i], list[j]))) continue;
        if (++steps > 20000) break;
        used[j] = true; res.push([list[i], list[j]]);
        if (rec()) return true;
        used[j] = false; res.pop();
      }
      used[i] = false;
      return false;
    };
    if (rec()) return res;
    // どうしても組めないときは、上から順に2人ずつ
    const out = [];
    for (let i = 0; i + 1 < list.length; i += 2) out.push([list[i], list[i + 1]]);
    return out;
  }
  function buildSwiss(T) {
    const entrants = parseEntrants(T.entrantsText);
    const n = entrants.length;
    const out = { format: 'swiss', entrants, byId: Object.fromEntries(entrants.map(e => [e.id, e])), rounds: [], third: null, final: null, error: '', standings: [] };
    if (n < 3) { out.error = 'スイスドローは3人（3チーム）以上で使えます'; return out; }
    if (n > 64) { out.error = 'スイスドローは64人（チーム）までです'; return out; }
    const total = swissRoundsFor(T, n);
    out.totalRounds = total;
    const st = Object.fromEntries(entrants.map(e => [e.id, { id: e.id, seed: e.seed, win: 0, lose: 0, pf: 0, pa: 0, opp: [], byes: 0 }]));
    const met = new Set();
    const points = T.scoreMode === 'points' && !T.teamMode;
    const bh = s => s.opp.reduce((a, id) => a + st[id].win, 0);
    const key = s => [s.win, bh(s), points ? s.pf : s.pf - s.pa, s.pf];
    const rank = list => list.slice().sort((p, q) => {
      const a = key(p), b = key(q);
      for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return b[i] - a[i];
      return p.seed - q.seed;
    });
    for (let r = 1; r <= total; r++) {
      const active = entrants.filter(e => !T.withdrawn?.[e.id]).map(e => st[e.id]);
      let order = r === 1 ? active.slice() : rank(active);
      // 奇数なら不戦勝（まだもらっていない一番下の人）
      let bye = null;
      if (order.length % 2) {
        const cand = [...order].reverse().find(s => !s.byes) || order[order.length - 1];
        bye = cand.id;
        order = order.filter(s => s !== cand);
      }
      let pairs;
      if (r === 1) {
        const ids = order.map(s => s.id);
        const half = ids.length / 2;
        // 1回戦：シード順なら上半分 vs 下半分（1位 vs 真ん中）、上から順なら隣どうし
        pairs = T.seeding === 'order' ? ids.flatMap((id, i) => (i % 2 ? [] : [[id, ids[i + 1]]])) : ids.slice(0, half).map((id, i) => [id, ids[half + i]]);
      } else pairs = swissPair(order.map(s => s.id), met);
      const name = `${r}回戦`;
      const matches = pairs.map(([a, b], i) => resolveMatch(T, { id: `s${r}m${i + 1}`, round: r, index: i, bo: T.bestOf, roundName: name, a, b }));
      if (bye) matches.push(resolveMatch(T, { id: `s${r}bye`, round: r, index: matches.length, bo: T.bestOf, roundName: name, a: bye, b: BYE }));
      out.rounds.push({ round: r, name, matches });
      // このラウンドの結果を成績に入れる
      for (const m of matches) {
        if (m.b !== BYE) met.add(m.a < m.b ? `${m.a}|${m.b}` : `${m.b}|${m.a}`);
        if (!isDecided(m)) continue;
        if (m.status === 'bye') { st[m.winner].win++; st[m.winner].byes++; continue; }
        if (!m.winner || m.winner === BYE) continue;
        st[m.winner].win++;
        st[m.loser].lose++;
        st[m.a].opp.push(m.b); st[m.b].opp.push(m.a);
        if (m.status === 'done') {
          st[m.a].pf += m.s[0] || 0; st[m.a].pa += m.s[1] || 0;
          st[m.b].pf += m.s[1] || 0; st[m.b].pa += m.s[0] || 0;
        }
      }
      // まだ終わっていない試合があれば、次のラウンドはまだ決めない
      if (!matches.every(isDecided)) break;
    }
    out.started = out.rounds.some(R => R.matches.some(m => m.status === 'done' || m.status === 'forfeit'));
    const list = rank(Object.values(st));
    list.forEach((s, i) => { s.bh = bh(s); s.rank = i && key(s).join() === key(list[i - 1]).join() ? list[i - 1].rank : i + 1; });
    out.standings = list;
    out.rankOf = Object.fromEntries(list.map(s => [s.id, s]));
    const finished = out.rounds.length === total && out.rounds[total - 1].matches.every(isDecided);
    out.champion = finished ? list[0].id : null;
    out.runnerUp = finished ? list[1]?.id || null : null;
    out.thirdWinner = finished ? list[2]?.id || null : null;
    return out;
  }

  const BUILDERS = { single: buildSingle, double: buildDouble, roundrobin: buildRoundRobin, swiss: buildSwiss };
  function build(T) { return (BUILDERS[T.format] || buildSingle)(T); }

  // すべての試合（表示順）
  function allMatches(B) {
    const list = B.rounds.flatMap(r => r.matches);
    if (B.rep?.rounds) list.push(...B.rep.rounds.flatMap(r => r.matches));
    if (B.third) list.push(B.third);
    return list;
  }
  function findMatch(B, id) { return allMatches(B).find(m => m.id === id) || null; }

  // 配信中の試合（指定がなければ、まだ終わっていない最初の試合）
  function currentMatch(T, B) {
    const live = T.live && findMatch(B, T.live);
    if (live && (live.status === 'ready' || live.status === 'done')) return live;
    return allMatches(B).find(m => m.status === 'ready') || null;
  }

  function matchRoundName(B, m) {
    if (!m) return '';
    if (m.roundName) return m.roundName;
    if (m.isThird) return '3位決定戦';
    return B.rounds[m.round - 1].name;
  }

  // 結果を入れる（編集ページ用）。side = 0 | 1。value が null なら空欄（点数のとき）
  function resultFor(T, m) {
    const r = T.results[m.id];
    if (r && r.ids?.[0] === m.a && r.ids?.[1] === m.b) return r;
    // 本数のときは、ハンデの本数を持った状態から始める
    return { ids: [m.a, m.b], s: T.scoreMode === 'points' ? [null, null] : hcPair(T, m).map(v => Math.max(0, Math.round(v))), w: null };
  }
  function setScore(T, B, id, side, value) {
    const m = findMatch(B, id);
    if (!m || m.status === 'waiting' || m.status === 'bye') return;
    const r = resultFor(T, m);
    const blank = T.scoreMode === 'points' ? null : 0;
    r.s = [r.s?.[0] ?? blank, r.s?.[1] ?? blank];
    r.s[side] = value === null || value === '' || !isFinite(value) ? blank : Math.max(0, Math.round(value));
    if (T.scoreMode !== 'points' && T.autoWin && m.bo > 1) {
      const need = Math.floor(m.bo / 2) + 1;
      r.w = r.s[0] >= need ? 0 : r.s[1] >= need ? 1 : null;
    }
    T.results[id] = r;
  }
  function setWinner(T, B, id, side) {
    const m = findMatch(B, id);
    if (!m || m.status === 'waiting' || m.status === 'bye') return;
    const r = resultFor(T, m);
    r.w = side;
    // 本数の1本勝負で点数が入っていなければ 1-0 にしておく
    if (T.scoreMode !== 'points' && m.bo === 1 && !(r.s?.[0] || r.s?.[1])) r.s = side === 0 ? [1, 0] : [0, 1];
    T.results[id] = r;
  }
  // 点数のとき：曲ごとの記録（曲数に合わせて足りない分は空で埋める）。
  // 曲ごとに分かれていない以前の記録は、1曲目の点数として扱う
  // 団体戦のときは、1人ずつの対戦の記録（p = 出場した選手名。空ならメンバーの順番どおり）
  function songsOf(T, r, m) {
    const n = subCountOf(T, m);
    const list = Array.isArray(r?.songs) ? r.songs.map(x => {
      const o = { t: String(x?.t || ''), s: [x?.s?.[0] ?? null, x?.s?.[1] ?? null] };
      if (Array.isArray(x?.abs) && (x.abs[0] || x.abs[1])) o.abs = [!!x.abs[0], !!x.abs[1]];
      if (Array.isArray(x?.p)) o.p = [String(x.p[0] || ''), String(x.p[1] || '')];
      return o;
    })
      : r && !T.teamMode && (r.s?.[0] != null || r.s?.[1] != null) ? [{ t: '', s: [r.s[0] ?? null, r.s[1] ?? null] }] : [];
    while (list.length < n) list.push({ t: '', s: [null, null] });
    return list.slice(0, n);
  }
  // 団体戦で、その対戦に出る選手名
  // この試合の出場メンバー（書き換えていれば、その試合だけのメンバー）
  const rosterOf = (e, m, i) => ({ members: m?.sub?.[i] || e?.members || '' });
  function playerOf(B, m, x, i, k) {
    return x?.p?.[i] || membersOf(rosterOf(B.byId[i === 0 ? m.a : m.b], m, i))[k] || '';
  }
  const sumOf = (list, side) => {
    const v = list.map(x => x.s[side]).filter(x => x !== null && x !== undefined);
    return v.length ? v.reduce((a, b) => a + b, 0) : null;
  };
  // 曲ごとの記録から、合計点・曲ごとの勝ち数・表示する点数を出す
  //  s: 表示する点数（合計点のルールなら合計、曲ごとの勝ち数のルールなら勝ち曲数）
  function pointsOf(T, songs, hc = [0, 0], m) {
    const list = songsOf(T, { songs }, m);
    // 合計点にハンデを足す（まだ1曲も入っていない側は空のまま）
    const raw = [sumOf(list, 0), sumOf(list, 1)];
    const tot = raw.map((v, i) => (v === null ? null : v + (hc[i] || 0)));
    const wins = [0, 0];
    let decided = 0;
    // 点取り戦で人数が違うとき、相手がいない枠はいる側の不戦勝
    const sz = T.teamMode && !isKachi(T) ? teamSizes(T, m) : null;
    list.forEach((x, k) => {
      // 「いない（不戦敗）」にした順番も同じ
      const absA = sz && (k >= sz[0] || !!x.abs?.[0]), absB = sz && (k >= sz[1] || !!x.abs?.[1]);
      if (absA || absB) {
        if (!absA) wins[0]++; else if (!absB) wins[1]++;
        decided++;
        return;
      }
      const [a, b] = x.s;
      if (a === null || b === null) return;
      decided++;
      if (a > b) wins[0]++;
      else if (b > a) wins[1]++;
    });
    // 勝ち抜き戦：表示する数字は残り人数
    if (isKachi(T)) {
      const k = kachiState(T, list, teamSizes(T, m));
      return { tot: T.scoreMode === 'points' ? tot : [null, null], wins: [k.ib, k.ia], decided: k.done, bySongs: true, s: k.left, kachi: k };
    }
    // 団体戦（本数）：勝った人数。ハンデは最初から持っている勝ち数
    if (T.teamMode && T.scoreMode !== 'points') {
      const s = wins.map((w, i) => w + Math.max(0, Math.round(hc[i] || 0)));
      return { tot: [null, null], wins, decided, bySongs: true, s };
    }
    const bySongs = T.pointsRule === 'songs' && subCountOf(T, m) > 1;
    return { tot, wins, decided, bySongs, s: bySongs ? (decided ? wins : [null, null]) : tot };
  }
  function setSongScore(T, B, id, song, side, value) {
    const m = findMatch(B, id);
    if (!m || m.status === 'waiting' || m.status === 'bye') return;
    const r = resultFor(T, m);
    r.songs = songsOf(T, r, m);
    r.songs[song].s[side] = value === null || value === '' || !isFinite(value) ? null : Math.max(0, Math.round(value));
    const p = pointsOf(T, r.songs, hcPair(T, m), m);
    r.s = p.s;
    // 勝ち抜き戦は、どちらかの残りが0になったら自動で勝者
    if (p.kachi && !r.dq) r.w = p.kachi.w;
    T.results[id] = r;
  }
  // 団体戦（本数）：その対戦の勝ちを付ける（もう一度押したら外す。side = -1 は引き分け）。
  // 点取り戦は過半数、勝ち抜き戦は相手の残りが0になったら自動で勝者
  function setSlotWinner(T, B, id, slot, side) {
    const m = findMatch(B, id);
    if (!m || m.status === 'waiting' || m.status === 'bye') return;
    const r = resultFor(T, m);
    r.songs = songsOf(T, r, m);
    const x = r.songs[slot];
    if (!x) return;
    if (side === -1) x.s = x.s[0] === 0 && x.s[1] === 0 ? [null, null] : [0, 0];
    else x.s = x.s[side] === 1 && x.s[1 - side] === 0 ? [null, null] : side === 0 ? [1, 0] : [0, 1];
    // 勝ち抜き戦：途中の対戦を変えたら、出る人が変わるので、その後の対戦は消す
    if (isKachi(T)) for (let j = slot + 1; j < r.songs.length; j++) r.songs[j] = { t: r.songs[j].t, s: [null, null] };
    const p = pointsOf(T, r.songs, hcPair(T, m), m);
    r.s = p.s;
    const n = subCountOf(T, m);
    if (p.kachi) { if (T.autoWin && !r.dq) r.w = p.kachi.w; }
    else if (T.autoWin && !r.dq) {
      const need = teamNeed(n);
      // 過半数に届いた／全部終わって勝ち数に差がある → 勝者。同数なら「チームの勝ち」ボタンで決める（代表戦など）
      r.w = p.s[0] >= need ? 0 : p.s[1] >= need ? 1
        : p.decided === n && p.s[0] !== p.s[1] ? (p.s[0] > p.s[1] ? 0 : 1) : null;
    }
    T.results[id] = r;
  }
  // 団体戦（点取り戦）：その順番に出る人がいない（不戦敗）。もう一度で取り消し
  function setSlotAbsent(T, B, id, slot, side, on) {
    const m = findMatch(B, id);
    if (!m || m.status === 'waiting' || m.status === 'bye') return;
    const r = resultFor(T, m);
    r.songs = songsOf(T, r, m);
    const x = r.songs[slot];
    if (!x) return;
    x.abs = x.abs || [false, false];
    x.abs[side] = !!on;
    if (!x.abs[0] && !x.abs[1]) delete x.abs;
    x.s = [null, null];
    const p = pointsOf(T, r.songs, hcPair(T, m), m);
    r.s = p.s;
    const n = subCountOf(T, m);
    if (T.autoWin && !r.dq && T.scoreMode !== 'points') {
      const need = teamNeed(n);
      r.w = p.s[0] >= need ? 0 : p.s[1] >= need ? 1 : p.decided === n && p.s[0] !== p.s[1] ? (p.s[0] > p.s[1] ? 0 : 1) : null;
    }
    T.results[id] = r;
  }
  // 団体戦：その対戦に出た選手名（空ならメンバーの順番どおり）
  function setSlotPlayer(T, B, id, slot, side, name) {
    const m = findMatch(B, id);
    if (!m || m.status === 'waiting' || m.status === 'bye') return;
    const r = resultFor(T, m);
    r.songs = songsOf(T, r, m);
    const x = r.songs[slot];
    if (!x) return;
    x.p = x.p || ['', ''];
    x.p[side] = String(name || '').slice(0, 40);
    if (!x.p[0] && !x.p[1]) delete x.p;
    T.results[id] = r;
  }
  function setSongTitle(T, B, id, song, title) {
    const m = findMatch(B, id);
    if (!m || m.status === 'waiting' || m.status === 'bye') return;
    const r = resultFor(T, m);
    r.songs = songsOf(T, r, m);
    r.songs[song].t = String(title || '').slice(0, 80);
    T.results[id] = r;
  }

  // 点数のとき：合計が高いほうを勝者にする。'ok' / 'missing'（どちらか空欄） / 'tie'（同点）
  function decideByPoints(T, B, id) {
    const m = findMatch(B, id);
    if (!m || m.status === 'waiting' || m.status === 'bye') return 'missing';
    const r = resultFor(T, m);
    if (Array.isArray(r.songs)) {
      const p = pointsOf(T, r.songs, hcPair(T, m), m);
      if (p.kachi) {
        if (p.kachi.w === null) return p.kachi.over ? 'tie' : 'missing';
        r.w = p.kachi.w;
        T.results[id] = r;
        return 'ok';
      }
      if (p.bySongs) {
        // 曲ごとの勝ち数 → 同数なら合計点
        if (!p.decided) return 'missing';
        if (p.wins[0] !== p.wins[1]) { r.w = p.wins[0] > p.wins[1] ? 0 : 1; T.results[id] = r; return 'ok'; }
        const [x, y] = p.tot;
        if (x === null || y === null || x === y) return 'tie';
        r.w = x > y ? 0 : 1;
        T.results[id] = r;
        return 'ok';
      }
      r.s = p.tot;
    }
    const [x, y] = r.s || [];
    if (x === null || x === undefined || y === null || y === undefined) return 'missing';
    if (x === y) return 'tie';
    r.w = x > y ? 0 : 1;
    T.results[id] = r;
    return 'ok';
  }
  // 試合単位の失格・棄権。同じものをもう一度入れたら取り消す
  function setDisqualified(T, B, id, side, kind) {
    const m = findMatch(B, id);
    if (!m || m.status === 'waiting' || m.status === 'bye' || m.status === 'forfeit') return;
    const r = resultFor(T, m);
    if (r.dq && r.dq.side === side && r.dq.kind === kind) {
      delete r.dq;
      r.w = null;
      // 取り消して何も入っていなければ、結果ごと消す（0 - 0 が残らないように）
      if (!Array.isArray(r.songs) && !(r.s?.[0] || r.s?.[1])) { delete T.results[id]; return; }
    } else { r.dq = { side, kind }; r.w = 1 - side; }
    T.results[id] = r;
  }
  function clearResult(T, id) { delete T.results[id]; }
  // 代理・交代の印をこの試合だけ消す
  function setSubHide(T, B, id, side, hide) {
    const m = findMatch(B, id);
    if (!m || m.status === 'waiting' || m.status === 'bye') return;
    const r = resultFor(T, m);
    r.subHide = Array.isArray(r.subHide) ? r.subHide : [false, false];
    r.subHide[side] = !!hide;
    if (!r.subHide[0] && !r.subHide[1]) delete r.subHide;
    T.results[id] = r;
  }
  // 代理出場（この試合だけ、左右それぞれ）。空にしたら消す
  function setSub(T, B, id, side, name) {
    const m = findMatch(B, id);
    if (!m || m.status === 'waiting' || m.status === 'bye') return;
    const r = resultFor(T, m);
    r.sub = Array.isArray(r.sub) ? r.sub : ['', ''];
    r.sub[side] = String(name || '').slice(0, T.teamMode ? 200 : 40);
    if (!r.sub[0] && !r.sub[1]) delete r.sub;
    T.results[id] = r;
  }

  // スコアの表示（大きな数は 987,654 のように区切る）
  const fmtScore = v => (typeof v === 'number' ? v.toLocaleString('en-US') : esc(v));

  // ---------------------------------------------------------------
  //  見た目の設定（S）
  // ---------------------------------------------------------------
  const DEFAULT_S = {
    font: 'M PLUS Rounded 1c', fontCustom: '', weight: '700',
    textEffect: 'none', effectWidth: 2, effectColor: '#000000',
    bgMode: 'transparent',    // 'transparent' | 'color' | 'gradient' | 'image'
    bgColor: '#12101c', bgAlpha: 0.85,
    bgColor2: '#3a1f4a', bgAngle: 135,          // グラデーションの2色目と向き
    bgImage: '', bgFit: 'cover', bgDim: 0.35,   // 背景画像（data URL）、敷き方、暗くする量
    accent: '#ff85a1', text: '#ffffff', subText: '#c9b8c2',
    boxBg: '#221a2a', boxAlpha: 0.92, boxBorder: '#4a3548', radius: 8,
    winBg: '#ff85a1', winText: '#2a1020', loseOpacity: 0.45,
    lineColor: '#5a4a60', lineWidth: 3, liveColor: '#ff3c5a',
    titleShow: true, titleSize: 56, titleColor: '#ffffff', subtitleSize: 26,
    layout: 'mirror', rowHeight: 42, boxMaxWidth: 320, gapX: 56, pad: 48,
    showSeed: true, showScore: true, showRoundNames: true, hideByes: true, showChampion: true, showHandicap: true, showMembers: true, showSubTag: true,
    matchPos: 'bottom', matchWidth: 1280,
    drawSpeed: 1.2,           // 抽選の演出：1人あたりの秒数（人数が多いときは自動で速くする）
  };
  const COLOR_KEYS = Object.keys(DEFAULT_S).filter(k => /^#[0-9a-f]{6}$/i.test(String(DEFAULT_S[k])));

  function sanitizeS(obj) {
    const out = { ...DEFAULT_S };
    if (!obj || typeof obj !== 'object') return out;
    for (const k of Object.keys(DEFAULT_S)) {
      if (!(k in obj)) continue;
      const d = DEFAULT_S[k], v = obj[k];
      if (typeof d === 'number' && typeof v === 'number' && isFinite(v)) out[k] = v;
      else if (typeof d === 'boolean' && typeof v === 'boolean') out[k] = v;
      else if (typeof d === 'string' && typeof v === 'string') {
        if (COLOR_KEYS.includes(k) && !/^#[0-9a-f]{6}$/i.test(v)) continue;
        out[k] = v;
      }
    }
    if (!['transparent', 'color', 'gradient', 'image'].includes(out.bgMode)) out.bgMode = 'transparent';
    if (!['cover', 'contain'].includes(out.bgFit)) out.bgFit = 'cover';
    if (out.bgImage && !/^data:image\/(png|jpeg|webp|gif);base64,[A-Za-z0-9+/=]+$/.test(out.bgImage)) out.bgImage = '';
    return out;
  }

  // ---------------------------------------------------------------
  //  HTML の生成（1920×1080 の画面に、位置は数値で直接置く）
  // ---------------------------------------------------------------
  const W = 1920, H = 1080;
  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const px = n => `${Math.round(n * 100) / 100}px`;

  function nameOf(B, id) {
    if (id === BYE) return 'BYE';
    if (!id) return '';
    return B.byId[id]?.name || '';
  }

  // 失格・棄権のラベル（その側が負けになった理由）
  function dqTag(m, side) {
    const d = m.dq;
    if (!d) return '';
    const kinds = d.both !== undefined ? [d.kind, d.both] : [side === d.side ? d.kind : null, null];
    const kind = d.both !== undefined ? kinds[side] : kinds[0];
    if (!kind) return '';
    return `<span class="tn-tag tn-tag-${kind}">${kind === 'dq' ? '失格' : '棄権'}</span>`;
  }

  // ハンデのラベル（例：HC +50,000）
  function hcTag(T, S, id) {
    const v = hcOf(T, id);
    if (!v || !S.showHandicap) return '';
    return `<span class="tn-tag tn-tag-hc">HC ${v > 0 ? '+' : ''}${v.toLocaleString('en-US')}</span>`;
  }

  // チームのメンバーを表示するとき（誰かにメンバーが書いてあれば）、行を2段の高さにする
  const memberFactor = (B, S) => (S.showMembers && B.entrants.some(e => e.members) ? 1.5 : 1);
  // 名前（とメンバー）
  function nameHtml(S, e, name, inline) {
    if (!S.showMembers || !e?.members) return `<span class="tn-name">${esc(name)}</span>`;
    return inline
      ? `<span class="tn-name">${esc(name)}</span><span class="tn-mem">${esc(e.members)}</span>`
      : `<span class="tn-nm"><span class="tn-name">${esc(name)}</span><span class="tn-mem">${esc(e.members)}</span></span>`;
  }

  function rowHtml(B, S, m, side, T) {
    const id = side === 0 ? m.a : m.b;
    const e = id && id !== BYE ? B.byId[id] : null;
    const cls = ['tn-row'];
    if (!id) cls.push('tbd');
    else if (id === BYE) cls.push('bye');
    else if (isDecided(m)) cls.push(m.winner === id ? 'win' : 'lose');
    const score = m.s[side];
    // 代理出場・敗者復活の印
    const sub = m.sub?.[side];
    const tag = dqTag(m, side)
      + (sub && S.showSubTag && !m.subHide?.[side] ? `<span class="tn-tag tn-tag-sub" title="${esc(T?.teamMode ? sub : `${e?.name}の代理`)}">${T?.teamMode ? '交代' : '代理'}</span>` : '')
      + (m.revived?.[side] ? '<span class="tn-tag tn-tag-rev">復活</span>' : '');
    return `<div class="${cls.join(' ')}"${e ? ` data-e="${e.id}"` : ''}>`
      + (S.showSeed && e ? `<span class="tn-seed">${e.seed}</span>` : '')
      + (!id && m.from?.[side] ? `<span class="tn-name tn-from">${esc(m.from[side])}</span>` : e ? (T?.teamMode ? nameHtml(S, { ...e, members: sub || e.members }, e.name) : nameHtml(S, e, sub || e.name)) : `<span class="tn-name">${esc(id ? nameOf(B, id) : '—')}</span>`)
      + (T && id && id !== BYE ? hcTag(T, S, id) : '')
      + tag
      + (S.showScore && m.status !== 'bye' && score !== null && score !== undefined ? `<span class="tn-score">${fmtScore(score)}</span>` : '')
      + '</div>';
  }

  // S.songLines = { matchId: [{ t: 曲名 }] }：トーナメント表＋課題曲の表示で、試合の箱の下にその試合の曲を出す
  const songFactor = S => (S.songLines ? 0.8 : 0);
  function songLineHtml(S, m, box) {
    if (!S.songLines) return '';
    const list = (S.songLines[m.id] || []).filter(x => x && x.t);
    return `<div class="tn-songline" style="height:${px(box.ex || 0)}">${list.length ? '♪ ' + list.map(x => esc(x.t)).join('<span class="tn-songsep">/</span>') : ''}</div>`;
  }
  function matchHtml(B, S, T, m, box) {
    const cls = ['tn-match', 'st-' + m.status];
    if (T.live === m.id && (m.status === 'ready' || m.status === 'done')) cls.push('live');
    return `<div class="${cls.join(' ')}" data-id="${m.id}" style="left:${px(box.x)};top:${px(box.y)};width:${px(box.w)};height:${px(box.h)}${box.fr ? `;--row:${px(box.fr)}` : ''}">`
      + rowHtml(B, S, m, 0, T) + rowHtml(B, S, m, 1, T)
      + songLineHtml(S, m, box)
      + '</div>';
  }

  // レイアウト：各試合の箱の位置と、線の始点・終点を決める
  function layoutSingle(B, S, area) {
    const rounds = B.rounds.length;
    const mirror = S.layout === 'mirror' && rounds >= 2;
    const labelH = S.showRoundNames ? S.rowHeight * 0.9 : 0;
    const top = area.y + labelH, height = area.h - labelH;
    const cols = mirror ? 2 * (rounds - 1) + 1 : rounds + (S.showChampion ? 1 : 0);
    // 列が多いとき（64人など）は、名前が読める幅を残すように列の間隔を詰める
    const gapX = Math.min(S.gapX, (area.w / cols) * 0.22);
    const boxW = Math.min(S.boxMaxWidth, (area.w - gapX * (cols - 1)) / cols);
    const totalW = boxW * cols + gapX * (cols - 1);
    const left = area.x + (area.w - totalW) / 2;
    const colX = c => left + c * (boxW + gapX);
    const r1 = B.rounds[0].matches.length;
    const perSide = mirror ? r1 / 2 : r1;
    const unit = height / perSide;
    const mf = memberFactor(B, S), sf = songFactor(S);
    const rowH = Math.max(14, Math.min(S.rowHeight, unit * 0.92 / (2 * mf + sf)));
    const pitch = rowH * mf;   // 1行の高さ（メンバーを出すときは2段になるので高くする）
    const ex = rowH * sf;      // 曲名の行の高さ
    const boxH = pitch * 2 + 2 + ex;
    const boxes = {}, labels = [], lines = [];
    B.rounds.forEach((R, ri) => {
      const r = ri + 1;
      R.matches.forEach((m, i) => {
        let col, idx, side = 'l';
        if (mirror && r < rounds) {
          const half = R.matches.length / 2;
          if (i < half) { col = r - 1; idx = i; } else { col = cols - r; idx = i - half; side = 'r'; }
        } else if (mirror) { col = rounds - 1; idx = 0; side = 'c'; }
        else { col = r - 1; idx = i; }
        const span = mirror && r === rounds ? perSide : 2 ** (r - 1);
        const yc = top + (idx + 0.5) * unit * span;
        boxes[m.id] = { x: colX(col), y: yc - boxH / 2, w: boxW, h: boxH, side, rowH: pitch };
      });
      if (S.showRoundNames) {
        if (mirror && r < rounds) {
          labels.push({ text: R.name, x: colX(r - 1), w: boxW, y: area.y });
          labels.push({ text: R.name, x: colX(cols - r), w: boxW, y: area.y });
        } else {
          labels.push({ text: R.name, x: colX(mirror ? rounds - 1 : r - 1), w: boxW, y: area.y });
        }
      }
    });
    // 3位決定戦・優勝は決勝の近くに置く
    const fb = boxes[B.final.id];
    if (B.third) boxes[B.third.id] = { x: fb.x, y: Math.min(top + height - boxH, fb.y + boxH + rowH * 3.2), w: boxW, h: boxH, side: 'c', rowH: pitch };
    let champ = null;
    if (S.showChampion) {
      champ = mirror
        ? { x: fb.x, y: Math.max(top, fb.y - boxH - rowH * 2.6), w: boxW, h: rowH * 1.9 }
        : { x: colX(rounds), y: fb.y + boxH / 2 - rowH * 0.95, w: boxW, h: rowH * 1.9 };
    }
    for (const b of Object.values(boxes)) b.ex = ex;
    // 線：試合の出口 → 次の試合の入口（上の試合は a の行へ、下の試合は b の行へ）
    B.rounds.slice(0, -1).forEach((R, ri) => {
      const next = B.rounds[ri + 1];
      R.matches.forEach((m, i) => {
        const from = boxes[m.id], nm = next.matches[Math.floor(i / 2)], to = boxes[nm.id];
        const toRight = from.side === 'r';
        const x1 = toRight ? from.x : from.x + from.w;
        const y1 = from.y + (from.h - from.ex) / 2;
        const x2 = toRight ? to.x + to.w : to.x;
        const y2 = to.y + (i % 2 === 0 ? to.rowH / 2 : to.rowH * 1.5 + 2);
        const advanced = isDecided(m) && m.winner && m.winner !== BYE;
        lines.push({ x1, y1, x2, y2, on: advanced, from: m });
      });
    });
    if (champ) {
      const toRight = S.layout !== 'mirror';
      lines.push(toRight
        ? { x1: fb.x + fb.w, y1: fb.y + (fb.h - ex) / 2, x2: champ.x, y2: champ.y + champ.h / 2, on: !!B.champion, from: B.final }
        : { x1: fb.x + fb.w / 2, y1: fb.y, x2: champ.x + champ.w / 2, y2: champ.y + champ.h, on: !!B.champion, from: B.final, vertical: true });
    }
    return { boxes, labels, lines, champ, rowH };
  }

  // ダブルエリミネーション：上に勝者側、下に敗者側、右にグランドファイナル（いつも左から右）
  function layoutDouble(B, S, area) {
    const R = B.wRounds.length, L = B.lRounds.length;
    const gfCols = B.gf.length;
    const cols = L + gfCols + (S.showChampion ? 1 : 0);
    const gapX = Math.min(S.gapX, (area.w / cols) * 0.22);
    const boxW = Math.min(S.boxMaxWidth, (area.w - gapX * (cols - 1)) / cols);
    const totalW = boxW * cols + gapX * (cols - 1);
    const left = area.x + (area.w - totalW) / 2;
    const colX = c => left + c * (boxW + gapX);
    const labelH = S.showRoundNames ? S.rowHeight * 0.9 : 0;
    const sectionGap = S.rowHeight * 0.6;
    const usable = area.h - labelH * 2 - sectionGap;
    const wTop = area.y + labelH;
    const unit = usable / (B.size / 2 + B.size / 4);
    const lTop = wTop + unit * (B.size / 2) + sectionGap + labelH;
    const mf = memberFactor(B, S), sf = songFactor(S);
    const rowH = Math.max(14, Math.min(S.rowHeight, unit * 0.92 / (2 * mf + sf)));
    const pitch = rowH * mf;   // 1行の高さ（メンバーを出すときは2段になるので高くする）
    const ex = rowH * sf;      // 曲名の行の高さ
    const boxH = pitch * 2 + 2 + ex;
    const boxes = {}, labels = [], lines = [];
    const wCol = r => (r === 1 ? 0 : 2 * r - 3);
    B.wRounds.forEach((Rd, ri) => {
      const r = ri + 1;
      Rd.matches.forEach((m, i) => {
        const yc = wTop + (i + 0.5) * unit * 2 ** (r - 1);
        boxes[m.id] = { x: colX(wCol(r)), y: yc - boxH / 2, w: boxW, h: boxH, side: 'l', rowH: pitch };
      });
      if (S.showRoundNames) labels.push({ text: Rd.name, x: colX(wCol(r)), w: boxW, y: area.y, ms: Rd.matches });
    });
    B.lRounds.forEach((Rd, ji) => {
      const span = (B.size / 4) / Rd.matches.length;
      Rd.matches.forEach((m, i) => {
        const yc = lTop + (i + 0.5) * unit * span;
        boxes[m.id] = { x: colX(ji), y: yc - boxH / 2, w: boxW, h: boxH, side: 'l', rowH: pitch };
      });
      if (S.showRoundNames) labels.push({ text: Rd.name, x: colX(ji), w: boxW, y: lTop - labelH, ms: Rd.matches });
    });
    const wf = boxes[B.wRounds[R - 1].matches[0].id], lf = boxes[B.lRounds[L - 1].matches[0].id];
    const gy = (wf.y + lf.y) / 2;
    B.gf.forEach((m, k) => {
      boxes[m.id] = { x: colX(L + k), y: gy, w: boxW, h: boxH, side: 'l', rowH: pitch };
      if (S.showRoundNames) labels.push({ text: k ? 'リセット' : 'グランドファイナル', x: colX(L + k), w: boxW, y: gy - rowH * 0.9 });
    });
    const fb = boxes[B.final.id];
    const champ = S.showChampion ? { x: colX(L + gfCols), y: fb.y + boxH / 2 - rowH * 0.95, w: boxW, h: rowH * 1.9 } : null;
    for (const b of Object.values(boxes)) b.ex = ex;
    const on = m => isDecided(m) && m.winner && m.winner !== BYE;
    const link = (m, to, i) => {
      const from = boxes[m.id], t = boxes[to.id];
      lines.push({ x1: from.x + from.w, y1: from.y + (from.h - ex) / 2, x2: t.x, y2: t.y + (i === 0 ? t.rowH / 2 : t.rowH * 1.5 + 2), on: on(m), from: m });
    };
    B.wRounds.slice(0, -1).forEach((Rd, ri) => Rd.matches.forEach((m, i) => link(m, B.wRounds[ri + 1].matches[Math.floor(i / 2)], i % 2)));
    B.lRounds.slice(0, -1).forEach((Rd, ji) => {
      const j = ji + 1, next = B.lRounds[ji + 1];
      Rd.matches.forEach((m, i) => (j % 2 === 1 ? link(m, next.matches[i], 0) : link(m, next.matches[Math.floor(i / 2)], i % 2)));
    });
    link(B.wRounds[R - 1].matches[0], B.gf[0], 0);
    link(B.lRounds[L - 1].matches[0], B.gf[0], 1);
    if (B.gf[1]) lines.push({ x1: boxes.gf.x + boxW, y1: gy + (boxH - ex) / 2, x2: boxes.gf2.x, y2: gy + (boxH - ex) / 2, on: true, from: B.gf[0] });
    if (champ) lines.push({ x1: fb.x + fb.w, y1: fb.y + (fb.h - ex) / 2, x2: champ.x, y2: champ.y + champ.h / 2, on: !!B.champion, from: B.final });
    return { boxes, labels, lines, champ, rowH };
  }

  // 総当たり：星取表（行と列は参加者の順。右に勝ち・負け・得失点・順位）
  function renderLeague(T, S, B, area) {
    const E = B.entrants, n = E.length;
    const points = T.scoreMode === 'points' && !T.teamMode;
    const rowH = Math.max(18, Math.min(S.rowHeight * 1.15, (area.h - 4) / (n + 1) - 3));
    const nameW = Math.min(360, Math.max(rowH * 5, area.w * 0.2));
    const statW = [rowH * 1.4, rowH * 1.4, points ? rowH * 3.8 : rowH * 1.8, rowH * 1.5];
    const cellW = Math.max(rowH * 1.3, Math.min(rowH * (points ? 3.8 : 2.6), (area.w - nameW - statW.reduce((a, b) => a + b, 0) - (n + 5) * 3) / n));
    const cols = [nameW, ...E.map(() => cellW), ...statW];
    const width = cols.reduce((a, b) => a + b, 0) + (cols.length - 1) * 3;
    const height = (n + 1) * (rowH + 3);
    const left = area.x + Math.max(0, (area.w - width) / 2);
    const top = area.y + Math.max(0, (area.h - height) / 2);
    const seedSpan = e => (S.showSeed ? `<span class="tn-seed">${e.seed}</span>` : '');
    // セルの文字：「○ 2-1」や「○ 987,654」が入る大きさにする
    const cellFs = Math.min(rowH * 0.45, (cellW - 8) / (points ? 5.4 : 3.2));
    const narrow = cellW < rowH * 2.4;
    let html = `<div class="tn-league" style="left:${px(left)};top:${px(top)};--row:${px(rowH)};--cfs:${px(cellFs)};grid-template-columns:${cols.map(px).join(' ')}">`;
    html += '<div class="tn-lg-h"></div>'
      + E.map(e => `<div class="tn-lg-h" data-e="${e.id}" title="${esc(e.name)}">${narrow ? `<span class="tn-name">${e.seed}</span>` : `${seedSpan(e)}<span class="tn-name">${esc(e.name)}</span>`}</div>`).join('')
      + `<div class="tn-lg-h">勝</div><div class="tn-lg-h">負</div><div class="tn-lg-h">${points ? '合計点' : '得失点'}</div><div class="tn-lg-h">順位</div>`;
    for (const e of E) {
      const s = B.rankOf[e.id];
      html += `<div class="tn-lg-name" data-e="${e.id}">${seedSpan(e)}${nameHtml(S, e, e.name, true)}${T.withdrawn?.[e.id] ? `<span class="tn-tag tn-tag-${T.withdrawn[e.id]}">${T.withdrawn[e.id] === 'dq' ? '失格' : '棄権'}</span>` : ''}</div>`;
      for (const o of E) {
        if (o.id === e.id) { html += '<div class="tn-cell self"></div>'; continue; }
        const m = B.pairs[`${e.id}|${o.id}`];
        const me = m.a === e.id ? 0 : 1;
        const cls = ['tn-cell'];
        let body = '';
        if (T.live === m.id && (m.status === 'ready' || m.status === 'done')) cls.push('live');
        if (isDecided(m)) {
          const won = m.winner === e.id;
          cls.push(won ? 'win' : 'lose');
          const sc = S.showScore && m.status === 'done' && m.s[0] != null && m.s[1] != null
            ? `<span class="tn-cs">${points ? fmtScore(m.s[me]) : `${fmtScore(m.s[me])}-${fmtScore(m.s[1 - me])}`}</span>` : m.status === 'forfeit' ? '<span class="tn-cs">不戦</span>' : '';
          body = `<span class="tn-mark">${won ? '○' : '●'}</span>${sc}`;
        } else if (S.showScore && m.s[0] != null && m.s[1] != null && m.status === 'ready') {
          body = `<span class="tn-cs">${fmtScore(m.s[me])}-${fmtScore(m.s[1 - me])}</span>`;
        }
        html += `<div class="${cls.join(' ')}" data-id="${m.id}">${body}</div>`;
      }
      const top3 = B.started && s.rank <= 3 ? ` top r${s.rank}` : '';
      const diff = points ? fmtScore(s.pf) : (s.pf - s.pa > 0 ? '+' : '') + (s.pf - s.pa);
      html += `<div class="tn-lg-stat">${s.win}</div><div class="tn-lg-stat">${s.lose}</div><div class="tn-lg-stat">${B.started ? diff : '-'}</div>`
        + `<div class="tn-lg-stat tn-lg-rank${top3}">${B.started ? s.rank : '-'}</div>`;
    }
    return html + '</div>';
  }

  // スイスドロー：左にラウンドごとの組み合わせ（列）、右に順位表
  function renderSwiss(T, S, B, area) {
    const n = B.entrants.length, total = B.totalRounds;
    const points = T.scoreMode === 'points' && !T.teamMode;
    const standW = Math.min(560, area.w * 0.3);
    const gap = 40;
    const rw = area.w - standW - gap;
    const cols = total;
    const gapX = Math.min(S.gapX * 0.6, (rw / cols) * 0.12);
    const boxW = Math.min(S.boxMaxWidth, (rw - gapX * (cols - 1)) / cols);
    const left = area.x + (rw - (boxW * cols + gapX * (cols - 1))) / 2;
    const labelH = S.showRoundNames ? S.rowHeight * 0.9 : 0;
    const top = area.y + labelH;
    const M = Math.ceil(n / 2);
    const unit = (area.h - labelH) / M;
    const mf = memberFactor(B, S), sf = songFactor(S);
    const rowH = Math.max(14, Math.min(S.rowHeight, unit * 0.88 / (2 * mf + sf)));
    const ex = rowH * sf;
    const boxH = rowH * mf * 2 + 2 + ex;
    const step = Math.min(unit, boxH + rowH * 0.7);
    let html = `<div class="tn-bracket" style="--row:${px(rowH)}">`;
    for (let r = 1; r <= total; r++) {
      const x = left + (r - 1) * (boxW + gapX);
      if (S.showRoundNames) html += `<div class="tn-round" style="left:${px(x)};top:${px(area.y)};width:${px(boxW)};height:${px(rowH * 0.8)}">${r}回戦</div>`;
      const R = B.rounds[r - 1];
      if (!R) {
        html += `<div class="tn-swiss-wait" style="left:${px(x)};top:${px(top)};width:${px(boxW)};height:${px(boxH)}">前のラウンドが終わると決まります</div>`;
        continue;
      }
      const shown = R.matches.filter(m => !(S.hideByes && m.status === 'bye'));
      shown.forEach((m, i) => { html += matchHtml(B, S, T, m, { x, y: top + i * step, w: boxW, h: boxH, ex }); });
    }
    html += '</div>';
    // 順位表
    const sRow = Math.max(16, Math.min(rowH * 1.05, (area.h - 4) / (n + 1) - 3));
    const cw = [sRow * 1.5, 0, sRow * 1.3, sRow * 1.3, sRow * 1.6];
    cw[1] = standW - cw.reduce((a, b) => a + b, 0) - 4 * 3;
    html += `<div class="tn-league tn-standings" style="left:${px(area.x + area.w - standW)};top:${px(area.y)};--row:${px(sRow)};--cfs:${px(sRow * 0.45)};grid-template-columns:${cw.map(px).join(' ')}">`
      + '<div class="tn-lg-h">順位</div><div class="tn-lg-h">名前</div><div class="tn-lg-h">勝</div><div class="tn-lg-h">負</div><div class="tn-lg-h" title="ブッフホルツ（当たった相手の勝ち数の合計）">Bh</div>';
    for (const s of B.standings) {
      const e = B.byId[s.id];
      const top3 = B.started && s.rank <= 3 ? ` top r${s.rank}` : '';
      html += `<div class="tn-lg-stat tn-lg-rank${top3}">${B.started ? s.rank : '-'}</div>`
        + `<div class="tn-lg-name" data-e="${e.id}">${S.showSeed ? `<span class="tn-seed">${e.seed}</span>` : ''}${nameHtml(S, e, e.name, true)}${T.withdrawn?.[e.id] ? `<span class="tn-tag tn-tag-${T.withdrawn[e.id]}">${T.withdrawn[e.id] === 'dq' ? '失格' : '棄権'}</span>` : ''}</div>`
        + `<div class="tn-lg-stat">${s.win}</div><div class="tn-lg-stat">${s.lose}</div><div class="tn-lg-stat">${s.bh}</div>`;
    }
    return html + '</div>';
  }

  function linePath(l) {
    if (l.vertical) return `M${l.x1} ${l.y1} L${l.x2} ${l.y2}`;
    const mx = (l.x1 + l.x2) / 2;
    return `M${l.x1} ${l.y1} H${mx} V${l.y2} H${l.x2}`;
  }

  function headerHtml(T, S) {
    if (!S.titleShow || !(T.title || T.subtitle)) return { html: '', h: 0 };
    const h = S.titleSize * 1.3 + (T.subtitle ? S.subtitleSize * 1.5 : 0) + 16;
    return {
      html: `<div class="tn-header" style="top:${px(S.pad)};height:${px(h)}">`
        + (T.title ? `<div class="tn-title">${esc(T.title)}</div>` : '')
        + (T.subtitle ? `<div class="tn-subtitle">${esc(T.subtitle)}</div>` : '') + '</div>',
      h,
    };
  }

  // size = 表示する画面の大きさ（OBS なら 1920×1080。別ウィンドウではウィンドウの縦横比に合わせて広がる）
  function renderBracket(T, S, B, size = { w: W, h: H }) {
    const SW = size.w, SH = size.h;
    if (B.error) return `<div class="tn-empty">${esc(B.error)}</div>`;
    const head = headerHtml(T, S);
    const area = { x: S.pad, y: S.pad + head.h + (head.h ? 12 : 0), w: SW - S.pad * 2, h: 0 };
    area.h = SH - S.pad - area.y;
    if (B.format === 'roundrobin') return head.html + renderLeague(T, S, B, area);
    if (B.format === 'swiss') return head.html + renderSwiss(T, S, B, area);
    // 敗者復活があるときは、下に敗者復活戦（またはラッキールーザー）の欄を取る
    const rep = B.format === 'single' && B.rep ? B.rep : null;
    let repArea = null;
    if (rep) {
      const mainArea = { ...area };
      if (rep.mode === 'bracket' && rep.rounds.length) {
        const m1 = B.rounds[0].matches.filter(m => !(m.a === BYE && m.b === BYE)).length * (S.layout === 'mirror' ? 0.5 : 1);
        const p1 = rep.rounds[0].matches.length;
        const hRep = Math.max(area.h * 0.22, Math.min(area.h * 0.45, (area.h * p1) / (m1 + p1)));
        mainArea.h = area.h - hRep - S.rowHeight * 0.6;
        repArea = { x: area.x, y: area.y + mainArea.h + S.rowHeight * 0.6, w: area.w, h: hRep };
      } else {
        mainArea.h = area.h - S.rowHeight * 2.4;
        repArea = { x: area.x, y: area.y + mainArea.h + S.rowHeight * 0.6, w: area.w, h: S.rowHeight * 1.8 };
      }
      area.h = mainArea.h;
    }
    const L = B.format === 'double' ? layoutDouble(B, S, area) : layoutSingle(B, S, area);
    let repHtml = '';
    if (rep && rep.mode === 'bracket' && rep.rounds.length) {
      const rb = { rounds: rep.rounds, final: rep.rounds[rep.rounds.length - 1].matches[0], third: null, entrants: B.entrants };
      const L2 = layoutSingle(rb, { ...S, layout: 'left', showChampion: false }, repArea);
      for (const [id, box] of Object.entries(L2.boxes)) L.boxes[id] = { ...box, fr: L2.rowH };
      L.labels.push(...L2.labels.map(l => ({ ...l, ms: rb.rounds.find(R => R.name === l.text)?.matches })));
      L.lines.push(...L2.lines);
    } else if (rep) {
      // まだ決まっていない／ラッキールーザー：説明の欄
      const names = rep.winners.filter(Boolean).map(id => nameOf(B, id));
      const text = rep.pending ? (rep.mode === 'lucky' ? 'ラッキールーザー：1回戦が終わると決まります' : '敗者復活戦：1回戦が終わると組み合わせが決まります')
        : rep.mode === 'lucky' ? `ラッキールーザー：${names.join('、') || '—'}${rep.manual ? '' : '（1回戦のスコア上位）'}` : `敗者復活：${names.join('、') || '—'}`;
      repHtml = `<div class="tn-swiss-wait tn-rep-note" style="left:${px(repArea.x)};top:${px(repArea.y)};width:${px(repArea.w)};height:${px(repArea.h)}">${esc(text)}</div>`;
    }
    const hidden = new Set(allMatches(B).filter(m => (m.a === BYE && m.b === BYE) || (S.hideByes && m.status === 'bye' && (B.hideable || B.rounds[0].matches).includes(m))).map(m => m.id));
    const lines = L.lines.filter(l => !hidden.has(l.from.id));
    let html = head.html + `<div class="tn-bracket" style="--row:${px(L.rowH)}">`;
    html += `<svg class="tn-lines" width="${SW}" height="${SH}" viewBox="0 0 ${SW} ${SH}">`
      + lines.filter(l => !l.on).map(l => `<path d="${linePath(l)}" />`).join('')
      + lines.filter(l => l.on).map(l => `<path class="on" d="${linePath(l)}" />`).join('')
      + '</svg>';
    // 不戦勝だけの回（ダブルの敗者側1回戦など）は、回の名前も出さない
    for (const lb of L.labels.filter(l => !l.ms || l.ms.some(m => !hidden.has(m.id)))) {
      html += `<div class="tn-round" style="left:${px(lb.x)};top:${px(lb.y)};width:${px(lb.w)};height:${px(L.rowH * 0.8)}">${esc(lb.text)}</div>`;
    }
    for (const m of allMatches(B)) {
      if (hidden.has(m.id)) continue;
      html += matchHtml(B, S, T, m, L.boxes[m.id]);
      if (m.isThird) {
        const b = L.boxes[m.id];
        html += `<div class="tn-round tn-third-label" style="left:${px(b.x)};top:${px(b.y - L.rowH * 0.85)};width:${px(b.w)};height:${px(L.rowH * 0.8)}">3位決定戦</div>`;
      }
    }
    html += repHtml;
    if (L.champ) {
      const c = L.champ;
      html += `<div class="tn-champ${B.champion ? ' decided' : ''}" style="left:${px(c.x)};top:${px(c.y)};width:${px(c.w)};height:${px(c.h)}">`
        + `<span class="tn-champ-icon">🏆</span><span class="tn-name">${esc(B.champion ? nameOf(B, B.champion) : '優勝')}</span></div>`;
    }
    return html + '</div>';
  }

  // 今の試合のテロップ
  function renderMatch(T, S, B) {
    if (B.error) return `<div class="tn-empty">${esc(B.error)}</div>`;
    const m = currentMatch(T, B);
    const pos = S.matchPos === 'top' ? `top:${px(S.pad)}` : S.matchPos === 'center' ? 'top:50%;transform:translate(-50%,-50%)' : `bottom:${px(S.pad)}`;
    const base = `left:50%;width:${px(S.matchWidth)};${pos}${S.matchPos === 'center' ? '' : ';transform:translateX(-50%)'}`;
    if (!m) {
      const text = B.champion ? `🏆 優勝 ${nameOf(B, B.champion)}` : '次の試合を準備中';
      return `<div class="tn-bar" style="${base}"><div class="tn-bar-info">${esc(T.title)}</div><div class="tn-bar-main"><span class="tn-bar-center">${esc(text)}</span></div></div>`;
    }
    const isLive = T.live === m.id;
    const side = (i) => {
      const id = i === 0 ? m.a : m.b;
      const e = B.byId[id];
      const cls = ['tn-bar-side', i === 0 ? 'l' : 'r'];
      if (isDecided(m)) cls.push(m.winner === id ? 'win' : 'lose');
      const sub = m.sub?.[i];
      // 団体戦はチーム名のまま、メンバーをこの試合の出場メンバーにする。個人戦は代理の名前
      if (T.teamMode) {
        const roster = sub || e?.members;
        return `<div class="${cls.join(' ')}"><span class="tn-name">${esc(nameOf(B, id))}${dqTag(m, i)}${hcTag(T, S, id)}</span>`
          + (roster ? `<span class="tn-members">${esc(roster)}${sub && S.showSubTag && !m.subHide?.[i] ? '<span class="tn-tag tn-tag-sub">交代</span>' : ''}</span>` : '') + '</div>';
      }
      return `<div class="${cls.join(' ')}"><span class="tn-name">${esc(sub || nameOf(B, id))}${dqTag(m, i)}${hcTag(T, S, id)}</span>`
        + (sub ? (S.showSubTag && !m.subHide?.[i] ? `<span class="tn-members">${esc(nameOf(B, id))}の代理</span>` : '') : e && e.members ? `<span class="tn-members">${esc(e.members)}</span>` : '') + '</div>';
    };
    const sc = (i) => (m.s[i] === null || m.s[i] === undefined ? (T.scoreMode === 'points' ? '-' : 0) : fmtScore(m.s[i]));
    // 点数で複数曲（または曲名あり）のときは、曲ごとの点数を下に並べる
    let songsHtml = '';
    const nSub = subCountOf(T, m);
    const tsz = teamSizes(T, m);
    const bySongs = T.teamMode ? T.scoreMode !== 'points' || T.pointsRule === 'songs' || isKachi(T) : T.pointsRule === 'songs' && T.songCount > 1;
    if (nSub) {
      const list = songsOf(T, { s: m.s, songs: m.songs }, m);
      const pts = T.scoreMode === 'points';
      const sp = songPlayersOn(T, B);
      // どれかの曲に選手名が入っていれば、全部の行を選手名つきの並びにする（列をそろえる）
      const anyP = sp && list.some(x => x.p?.[0] || x.p?.[1]);
      if (T.teamMode || T.songCount > 1 || list.some(x => x.t)) {
        const cell = (x, i, k) => {
          const v = x.s[i], o = x.s[1 - i];
          // 点取り戦で相手がいない枠：いない側は「不戦」、いる側の勝ち
          const isAbs = j => k >= tsz[j] || !!x.abs?.[j];
          const absent = T.teamMode && !isKachi(T) && (isAbs(0) || isAbs(1));
          const done = absent || (v !== null && o !== null);
          const win = absent ? !isAbs(i) : done && v > o;
          const text = absent ? (win ? '○' : '不戦') : pts ? (v === null ? '-' : fmtScore(v)) : done ? (win ? '○' : v === o ? '△' : '●') : '-';
          if (absent && !win) return `<span class="tn-sub${i ? ' r' : ''} lose"><span class="tn-sub-p">—</span><span class="tn-song-s">${text}</span></span>`;
          const score = `<span class="tn-song-s${win ? ' win' : ''}">${text}</span>`;
          if (!T.teamMode) {
            // 曲ごとの選手名が入っていれば、点数の横に出す
            if (!anyP) return score;
            return `<span class="tn-sub${i ? ' r' : ''}${win ? ' win' : ''}"><span class="tn-sub-p">${esc(x.p?.[i] || '')}</span>${score}</span>`;
          }
          // 団体戦：選手名と点数（○●）を並べる
          return `<span class="tn-sub${i ? ' r' : ''}${win ? ' win' : ''}${done && !win ? ' lose' : ''}"><span class="tn-sub-p">${esc(playerOf(B, m, x, i, k))}</span>${score}</span>`;
        };
        const totalRow = pts && bySongs && nSub > 1 && m.tot
          ? `<div class="tn-song tn-song-total"><span class="tn-song-s">${m.tot[0] == null ? '-' : fmtScore(m.tot[0])}</span>`
            + `<span class="tn-song-t"><span class="tn-song-no">合計</span></span><span class="tn-song-s">${m.tot[1] == null ? '-' : fmtScore(m.tot[1])}</span></div>`
          : '';
        // 勝ち抜き戦は、行った対戦（と次の対戦）だけ。出る人は勝ち抜きの順番で決まる
        const rows = isKachi(T)
          ? kachiState(T, list, tsz).bouts.map(b => ({ x: b.x, n: b.k, pi: [b.ia, b.ib] }))
          : list.map((x, n) => ({ x, n, pi: [n, n] }));
        songsHtml = '<div class="tn-songs">' + rows.map(({ x, n, pi }) => `<div class="tn-song${T.teamMode || anyP ? ' team' : ''}">${cell(x, 0, pi[0])}`
          + `<span class="tn-song-t"><span class="tn-song-no">${esc(subLabel(T, n, nSub))}</span>${esc(x.t || '')}</span>${cell(x, 1, pi[1])}</div>`).join('') + totalRow + '</div>';
      }
    }
    const bigDigits = T.scoreMode === 'points' && !bySongs;
    return `<div class="tn-bar${isLive ? ' live' : ''}${bigDigits ? ' points' : ''}" style="${base}">`
      + `<div class="tn-bar-info">${isLive ? '<span class="tn-live-badge">LIVE</span>' : '<span class="tn-next-badge">NEXT</span>'}`
      + `${esc(matchRoundName(B, m))}${isKachi(T) ? ` ・ 勝ち抜き戦 ${tsz[0]}対${tsz[1]}（数字は残り人数）` : T.teamMode ? ` ・ 団体戦 ${tsz[0]}対${tsz[1]}` : T.scoreMode !== 'points' && m.bo > 1 ? ` ・ BO${m.bo}` : ''}</div>`
      + `<div class="tn-bar-main">${side(0)}<div class="tn-bar-score">${S.showScore ? `${sc(0)}<span>-</span>${sc(1)}` : 'VS'}</div>${side(1)}</div>`
      + (S.showScore ? songsHtml : '')
      + '</div>';
  }

  // 優勝者の発表
  function renderChampion(T, S, B) {
    if (B.error) return `<div class="tn-empty">${esc(B.error)}</div>`;
    const e = B.champion ? B.byId[B.champion] : null;
    return `<div class="tn-winner${e ? ' decided' : ''}">`
      + (T.title ? `<div class="tn-winner-title">${esc(T.title)}</div>` : '')
      + '<div class="tn-winner-label">🏆 優勝</div>'
      + `<div class="tn-winner-name">${esc(e ? e.name : '決定前')}</div>`
      + (e && e.members ? `<div class="tn-winner-members">${esc(e.members)}</div>` : '')
      + (B.runnerUp ? `<div class="tn-winner-sub">準優勝　${esc(nameOf(B, B.runnerUp))}${B.thirdWinner ? `　／　3位　${esc(nameOf(B, B.thirdWinner))}` : ''}</div>` : '')
      + '</div>';
  }

  function render(T, S, show, size) {
    const B = build(T);
    if (show === 'match') return renderMatch(T, S, B);
    if (show === 'champion') return renderChampion(T, S, B);
    return renderBracket(T, S, B, size);
  }

  // ---------------------------------------------------------------
  //  CSS の生成
  // ---------------------------------------------------------------
  function generateCSS(S) {
    const out = [];
    const font = C.fontInfo(S);
    if (font && font.url) out.push(`@import url("${font.url}");`);
    const ff = font ? font.family : "'M PLUS Rounded 1c', sans-serif";
    const shadow = C.textShadow(S) || 'none';
    const rgba = C.hexToRgba;
    let bg = 'transparent';
    if (S.bgMode === 'color') bg = rgba(S.bgColor, S.bgAlpha);
    else if (S.bgMode === 'gradient') bg = `linear-gradient(${S.bgAngle}deg, ${rgba(S.bgColor, S.bgAlpha)}, ${rgba(S.bgColor2, S.bgAlpha)})`;
    // 画像：上に黒を重ねて暗くする（文字を読みやすく）。余白は背景の色
    else if (S.bgMode === 'image' && S.bgImage) bg = `linear-gradient(rgba(0, 0, 0, ${S.bgDim}), rgba(0, 0, 0, ${S.bgDim})), url("${S.bgImage}") center / ${S.bgFit} no-repeat, ${S.bgColor}`;
    out.push(`#stage { font-family: ${ff}; font-weight: ${S.weight}; color: ${S.text}; background: ${bg}; }`);
    out.push(`#stage .tn-name, #stage .tn-title, #stage .tn-subtitle, #stage .tn-round, #stage .tn-bar, #stage .tn-winner { text-shadow: ${shadow}; }`);
    // 見出し
    out.push(`.tn-header { position: absolute; left: 0; right: 0; text-align: center; }`);
    out.push(`.tn-title { font-size: ${px(S.titleSize)}; color: ${S.titleColor}; line-height: 1.3; font-weight: 900; }`);
    out.push(`.tn-subtitle { font-size: ${px(S.subtitleSize)}; color: ${S.subText}; line-height: 1.5; }`);
    // ラウンド名
    out.push(`.tn-round { position: absolute; display: flex; align-items: center; justify-content: center; color: ${S.accent}; font-size: max(13px, calc(var(--row, ${px(S.rowHeight)}) * 0.45)); letter-spacing: 0.08em; white-space: nowrap; }`);
    // 試合の箱
    out.push(`.tn-match { position: absolute; display: flex; flex-direction: column; gap: 2px; background: ${rgba(S.boxBg, S.boxAlpha)}; border: 1px solid ${S.boxBorder}; border-radius: ${px(S.radius)}; overflow: hidden; box-sizing: border-box; transition: box-shadow 0.3s; }`);
    out.push(`.tn-row { flex: 1; display: flex; align-items: center; gap: 0.5em; padding: 0 0.6em; min-width: 0; font-size: calc(var(--row, ${px(S.rowHeight)}) * 0.5); transition: background 0.4s, opacity 0.4s; }`);
    out.push(`.tn-row + .tn-row { border-top: 1px solid ${rgba(S.boxBorder, 0.7)}; }`);
    out.push(`.tn-seed { font-size: 0.7em; min-width: 1.6em; text-align: center; color: ${S.subText}; opacity: 0.85; }`);
    out.push(`.tn-name { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }`);
    out.push(`.tn-nm { flex: 1; min-width: 0; display: flex; flex-direction: column; justify-content: center; line-height: 1.2; }`);
    out.push(`.tn-nm .tn-name { flex: none; }`);
    out.push(`.tn-mem { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 0.66em; font-weight: 700; color: ${S.subText}; }`);
    out.push(`.tn-row.win .tn-mem { color: inherit; opacity: 0.8; }`);
    out.push(`.tn-league .tn-name { flex: 0 1 auto; }`);
    out.push(`.tn-league .tn-mem { flex: 1 1 0; font-size: 0.7em; }`);
    out.push(`.tn-score { min-width: 1.4em; text-align: center; font-weight: 900; font-variant-numeric: tabular-nums; }`);
    out.push(`.tn-row.win { background: ${S.winBg}; color: ${S.winText}; text-shadow: none; }`);
    out.push(`.tn-row.win .tn-seed { color: inherit; }`);
    // 負けた側は名前・点数だけ薄くする（失格・棄権のラベルははっきり見せる）
    out.push(`.tn-row.lose .tn-seed, .tn-row.lose .tn-name, .tn-row.lose .tn-mem, .tn-row.lose .tn-score { opacity: ${S.loseOpacity}; }`);
    out.push(`.tn-row.tbd .tn-name, .tn-row.bye .tn-name { color: ${S.subText}; opacity: 0.6; }`);
    out.push(`.tn-tag { flex: none; font-size: 0.62em; font-weight: 700; line-height: 1; padding: 0.25em 0.5em; border-radius: 999px; color: #fff; text-shadow: none; background: #8a8a96; letter-spacing: 0.04em; }`);
    out.push(`.tn-tag-dq { background: #d33b3b; }`);
    out.push(`.tn-tag-sub { background: #5b6bd6; }`);
    out.push(`.tn-songline { flex: none; box-sizing: border-box; display: flex; align-items: center; padding: 0 0.7em; font-size: calc(var(--row, ${px(S.rowHeight)}) * 0.4); font-weight: 700; color: ${S.subText}; border-top: 1px dashed ${rgba(S.boxBorder, 0.9)}; background: ${rgba(S.boxBg, Math.min(1, S.boxAlpha + 0.05))}; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }`);
    out.push(`.tn-songsep { margin: 0 0.4em; opacity: 0.6; }`);
    out.push(`.tn-members .tn-tag { font-size: 0.85em; margin-left: 0.5em; vertical-align: middle; }`);
    out.push(`.tn-tag-rev { background: #2f9e6e; }`);
    out.push(`.tn-rep-note { font-size: calc(var(--row, ${px(S.rowHeight)}) * 0.5); color: ${S.text}; }`);
    out.push(`.tn-tag-hc { background: ${rgba(S.accent, 0.25)}; color: ${S.text}; border: 1px solid ${rgba(S.accent, 0.6)}; }`);
    out.push(`.tn-row.win .tn-tag-hc { color: inherit; border-color: currentColor; background: transparent; }`);
    out.push(`.tn-bar-side .tn-tag { font-size: 0.45em; margin-left: 0.4em; vertical-align: middle; }`);
    out.push(`.tn-match.live { box-shadow: 0 0 0 3px ${S.liveColor}, 0 0 24px ${rgba(S.liveColor, 0.6)}; animation: tn-live 1.6s ease-in-out infinite; }`);
    out.push('@keyframes tn-live { 50% { box-shadow: 0 0 0 3px ' + S.liveColor + ', 0 0 6px ' + rgba(S.liveColor, 0.3) + '; } }');
    out.push(`.tn-row.just { animation: tn-just 1.2s ease-out; }`);
    out.push('@keyframes tn-just { 0% { filter: brightness(2.2); } 100% { filter: brightness(1); } }');
    // 線
    out.push(`.tn-lines { position: absolute; left: 0; top: 0; pointer-events: none; }`);
    out.push(`.tn-lines path { fill: none; stroke: ${S.lineColor}; stroke-width: ${S.lineWidth}; stroke-linejoin: round; }`);
    out.push(`.tn-lines path.on { stroke: ${S.accent}; }`);
    // 優勝の箱
    out.push(`.tn-champ { position: absolute; display: flex; align-items: center; justify-content: center; gap: 0.4em; box-sizing: border-box; border: 2px dashed ${S.boxBorder}; border-radius: ${px(S.radius)}; font-size: calc(var(--row, ${px(S.rowHeight)}) * 0.56); color: ${S.subText}; padding: 0 0.6em; }`);
    out.push(`.tn-champ .tn-name { flex: none; max-width: 80%; }`);
    out.push(`.tn-champ.decided { border: 2px solid ${S.accent}; background: ${rgba(S.accent, 0.18)}; color: ${S.text}; font-weight: 900; box-shadow: 0 0 24px ${rgba(S.accent, 0.5)}; }`);
    // テロップ
    out.push(`.tn-bar { position: absolute; background: ${rgba(S.boxBg, S.boxAlpha)}; border: 2px solid ${S.boxBorder}; border-radius: ${px(S.radius * 1.5)}; overflow: hidden; box-sizing: border-box; }`);
    out.push(`.tn-bar.live { border-color: ${S.liveColor}; }`);
    out.push(`.tn-bar-info { display: flex; align-items: center; justify-content: center; gap: 12px; padding: 8px; font-size: 26px; color: ${S.accent}; letter-spacing: 0.06em; background: ${rgba(S.boxBorder, 0.35)}; }`);
    out.push(`.tn-live-badge, .tn-next-badge { font-size: 20px; padding: 2px 12px; border-radius: 999px; color: #fff; text-shadow: none; letter-spacing: 0.1em; }`);
    out.push(`.tn-live-badge { background: ${S.liveColor}; animation: tn-blink 1.2s ease-in-out infinite; }`);
    out.push(`.tn-next-badge { background: ${rgba(S.subText, 0.5)}; }`);
    out.push('@keyframes tn-blink { 50% { opacity: 0.45; } }');
    out.push(`.tn-bar-main { display: flex; align-items: center; min-height: 110px; padding: 10px 28px; gap: 24px; }`);
    out.push(`.tn-bar-side { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 4px; transition: opacity 0.4s; }`);
    out.push(`.tn-bar-side.l { align-items: flex-end; text-align: right; }`);
    out.push(`.tn-bar-side.r { align-items: flex-start; text-align: left; }`);
    out.push(`.tn-bar-side .tn-name { font-size: 52px; font-weight: 900; max-width: 100%; }`);
    out.push(`.tn-bar-side.win .tn-name { color: ${S.accent}; }`);
    out.push(`.tn-bar-side.lose { opacity: ${S.loseOpacity}; }`);
    out.push(`.tn-members { font-size: 22px; color: ${S.subText}; }`);
    out.push(`.tn-bar-score { font-size: 64px; font-weight: 900; font-variant-numeric: tabular-nums; display: flex; gap: 16px; }`);
    out.push(`.tn-bar-score span { color: ${S.subText}; }`);
    // 点数（音ゲーなど）は桁が多いので、合計を小さめにして名前の幅を残す
    out.push(`.tn-bar.points .tn-bar-score { font-size: 44px; gap: 12px; }`);
    out.push(`.tn-bar.points .tn-bar-side .tn-name { font-size: 44px; }`);
    out.push(`.tn-bar-center { flex: 1; text-align: center; font-size: 48px; font-weight: 900; }`);
    out.push(`.tn-songs { display: flex; flex-direction: column; gap: 2px; padding: 0 28px 14px; }`);
    out.push(`.tn-song { display: grid; grid-template-columns: 1fr minmax(0, 1.4fr) 1fr; align-items: center; gap: 16px; padding: 6px 0; border-top: 1px solid ${rgba(S.boxBorder, 0.7)}; font-size: 26px; }`);
    out.push(`.tn-song-s { text-align: center; font-weight: 900; font-variant-numeric: tabular-nums; color: ${S.subText}; }`);
    out.push(`.tn-song-s.win { color: ${S.accent}; }`);
    out.push(`.tn-song-t { text-align: center; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }`);
    out.push(`.tn-song-no { font-size: 0.7em; color: ${S.subText}; margin-right: 0.6em; }`);
    out.push(`.tn-song-total { font-size: 22px; opacity: 0.85; }`);
    out.push(`.tn-song.team { grid-template-columns: minmax(0, 1fr) minmax(0, 0.7fr) minmax(0, 1fr); }`);
    out.push(`.tn-song.team .tn-song-no { font-size: 0.9em; color: ${S.accent}; }`);
    out.push(`.tn-sub { display: flex; align-items: center; justify-content: space-between; gap: 12px; min-width: 0; }`);
    out.push(`.tn-sub.r { flex-direction: row-reverse; }`);
    out.push(`.tn-sub-p { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }`);
    out.push(`.tn-sub.win .tn-sub-p { color: ${S.accent}; }`);
    out.push(`.tn-sub.lose .tn-sub-p { opacity: ${S.loseOpacity}; }`);
    out.push(`.tn-sub .tn-song-s { flex: none; min-width: 2em; }`);
    // 優勝者の発表
    out.push(`.tn-winner { position: absolute; left: 0; right: 0; top: 50%; transform: translateY(-50%); text-align: center; }`);
    out.push(`.tn-winner-title { font-size: ${px(S.titleSize * 0.8)}; color: ${S.titleColor}; margin-bottom: 12px; }`);
    out.push(`.tn-winner-label { font-size: 56px; color: ${S.accent}; letter-spacing: 0.2em; }`);
    out.push(`.tn-winner-name { font-size: 140px; font-weight: 900; line-height: 1.2; }`);
    out.push(`.tn-winner.decided .tn-winner-name { animation: tn-pop 0.9s cubic-bezier(0.2, 1.4, 0.4, 1) both; }`);
    out.push('@keyframes tn-pop { 0% { transform: scale(0.4); opacity: 0; } 100% { transform: scale(1); opacity: 1; } }');
    out.push(`.tn-winner-members { font-size: 36px; color: ${S.subText}; margin-top: 8px; }`);
    out.push(`.tn-winner-sub { font-size: 34px; color: ${S.subText}; margin-top: 28px; }`);
    // 抽選の演出
    out.push(`.tn-hide .tn-name, .tn-hide .tn-mem, .tn-hide .tn-seed, .tn-hide .tn-tag { visibility: hidden; }`);
    out.push(`.tn-reveal { animation: tn-reveal 0.7s ease-out; }`);
    // 敗者側の「○○の敗者」
    out.push(`.tn-row .tn-from { font-size: 0.78em; }`);
    // 総当たりの星取表
    out.push(`.tn-league { position: absolute; display: grid; gap: 3px; font-size: calc(var(--row) * 0.45); }`);
    out.push(`.tn-league > div { display: flex; align-items: center; justify-content: center; gap: 0.4em; height: var(--row); min-width: 0; overflow: hidden; white-space: nowrap; border-radius: ${px(Math.min(S.radius, 6))}; box-sizing: border-box; }`);
    out.push(`.tn-lg-h { color: ${S.accent}; font-size: 0.85em; padding: 0 0.3em; }`);
    out.push(`.tn-league .tn-name { min-width: 0; overflow: hidden; text-overflow: ellipsis; }`);
    out.push(`.tn-lg-name { justify-content: flex-start !important; padding: 0 0.6em; background: ${rgba(S.boxBg, S.boxAlpha)}; border: 1px solid ${S.boxBorder}; }`);
    out.push(`.tn-cell, .tn-lg-stat { background: ${rgba(S.boxBg, S.boxAlpha)}; border: 1px solid ${S.boxBorder}; font-variant-numeric: tabular-nums; }`);
    out.push(`.tn-cell.self { background: ${rgba(S.boxBorder, 0.45)}; }`);
    out.push(`.tn-cell.win { background: ${S.winBg}; color: ${S.winText}; text-shadow: none; }`);
    out.push(`.tn-cell.lose { color: ${S.subText}; }`);
    out.push(`.tn-cell { font-size: var(--cfs); gap: 0.25em !important; }`);
    out.push(`.tn-cell .tn-mark { font-weight: 900; }`);
    out.push(`.tn-cell .tn-cs { font-size: 0.9em; }`);
    out.push(`.tn-cell.live { box-shadow: inset 0 0 0 3px ${S.liveColor}; }`);
    out.push(`.tn-lg-rank { font-weight: 900; }`);
    out.push(`.tn-standings .tn-lg-h:nth-child(2) { justify-content: flex-start; padding-left: 0.8em; }`);
    out.push(`.tn-swiss-wait { position: absolute; display: flex; align-items: center; justify-content: center; text-align: center; box-sizing: border-box; padding: 0 0.6em; border: 2px dashed ${rgba(S.boxBorder, 0.9)}; border-radius: ${px(S.radius)}; color: ${S.subText}; font-size: calc(var(--row) * 0.36); }`);
    out.push(`.tn-lg-rank.top { background: ${S.winBg}; color: ${S.winText}; text-shadow: none; }`);
    out.push(`@keyframes tn-reveal { 0% { background: ${S.accent}; color: ${S.winText}; transform: scale(1.08); } 100% { transform: scale(1); } }`);
    out.push(`.tn-draw { position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%); min-width: 760px; padding: 28px 48px; text-align: center; background: ${rgba(S.boxBg, 0.96)}; border: 3px solid ${S.accent}; border-radius: ${px(S.radius * 2)}; box-shadow: 0 0 60px ${rgba(S.accent, 0.45)}; z-index: 10; transition: opacity 0.5s; }`);
    out.push(`.tn-draw-label { font-size: 30px; color: ${S.accent}; letter-spacing: 0.3em; }`);
    out.push(`.tn-draw-name { font-size: 96px; font-weight: 900; line-height: 1.3; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 1400px; }`);
    out.push(`.tn-draw-seed { font-size: 34px; color: ${S.subText}; min-height: 1.4em; }`);
    out.push(`.tn-draw.hit .tn-draw-name { color: ${S.accent}; animation: tn-hit 0.4s ease-out; }`);
    out.push('@keyframes tn-hit { 0% { transform: scale(1.25); } 100% { transform: scale(1); } }');
    out.push(`.tn-draw.done { opacity: 0; }`);
    out.push(`.tn-empty { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; font-size: 40px; color: ${S.subText}; }`);
    return out.join('\n') + '\n';
  }

  // ---------------------------------------------------------------
  //  保存（localStorage）と、ページ間の受け渡し
  //  編集ページと表示ページが同じ場所（例：OBS のカスタムブラウザドックとブラウザソース）で開かれていれば、
  //  storage イベントで自動的に表示が更新される。
  // ---------------------------------------------------------------
  const STORE_KEY = 'donnma-tournament-v1';
  function loadStored() {
    try {
      const raw = JSON.parse(localStorage.getItem(STORE_KEY) || 'null');
      return { T: sanitizeT(raw && raw.T), S: sanitizeS(raw && raw.S) };
    } catch (e) {
      return { T: sanitizeT(null), S: sanitizeS(null) };
    }
  }
  function saveStored(T, S) {
    try { localStorage.setItem(STORE_KEY, JSON.stringify({ T, S, at: Date.now() })); return true; } catch (e) { return false; }
  }

  global.TournamentCore = {
    DEFAULT_T, DEFAULT_S, FORMATS, BYE, W, H, STORE_KEY,
    sanitizeT, sanitizeS, parseEntrants, BUILDERS, isDecided, setDisqualified, build, allMatches, findMatch, currentMatch, matchRoundName,
    setScore, setWinner, setSub, setSubHide, decideByPoints, clearResult, nameOf, fmtScore, songsOf, pointsOf, setSongScore, setSongTitle, hcPair,
    songPlayersOn, subCount, subCountOf, teamSizes, positionNames, subLabel, isKachi, kachiState, membersOf, playerOf, setSlotWinner, setSlotPlayer, setSlotAbsent, render, generateCSS, loadStored, saveStored, esc,
  };
})(window);
