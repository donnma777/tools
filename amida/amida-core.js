/*
 * あみだくじ — 編集ページ（index.html）と表示ページ（view.html）で共通の部品
 *  - くじ（A）と見た目（S）の初期値・読み込み
 *  - 横線の引き方・足し方と、線のたどり方（だれがどの結果に着くか）
 *  - このブラウザへの保存（OBSのドックとブラウザソースは localStorage を共有するので、storage イベントで同期する）
 *  - 1920×1080 の canvas への描画（表示ページと、編集ページの「画像で保存」で同じものを使う）
 * フォント一覧は ../chat-css-generator/chat-core.js（window.ChatCore）を使う。
 * このファイルを変えたら、読み込んでいる2ページの ?v= を上げる。
 */
(function (global) {
  'use strict';
  const C = global.ChatCore;
  const W = 1920, H = 1080;
  const MIN_N = 2, MAX_N = 20, MAX_LEN = 30, MAX_RUNGS = 400;
  const LEVELS = 24;     // 自動で引く横線の高さの段数
  const GAP = 0.03;      // 足す横線と、となりの横線との最低限のすき間（はしごの高さを 1 として）

  // ---------------------------------------------------------------
  //  くじ（A）
  // ---------------------------------------------------------------
  const DEFAULT_A = {
    title: '',
    players: ['Aさん', 'Bさん', 'Cさん', 'Dさん', 'Eさん'],
    prizes: ['当たり', 'ハズレ', 'ハズレ', 'ハズレ', 'ハズレ'],
    // くじ：rungs が横線（c 本目と c+1 本目の間、高さ y は上から 0〜1。u は手で足した線、at は足した時刻）
    //       order[列] が、その列の下に置く結果の番号（prizes の添字）。null はまだ作っていない
    board: null,
    // 開けた記録：p 番目の人の線を、時刻 at に開けた。d はそこから線をたどり始めるまでの待ち（順番に開くとき）
    //            m は開け方（'one' 1人ずつ／'seq' まとめて順番に／'all' まとめて一斉に）
    opens: [],
  };

  const HEX = /^#[0-9a-f]{6}$/i;
  const num = (v, d, lo, hi) => (typeof v === 'number' && isFinite(v) ? Math.min(hi, Math.max(lo, v)) : d);
  const str = (v, d, max) => (typeof v === 'string' ? v.slice(0, max) : d);
  const names = v => (Array.isArray(v) ? v.filter(s => typeof s === 'string').slice(0, MAX_N).map(s => s.slice(0, MAX_LEN)) : null);
  const isPerm = (a, n) => Array.isArray(a) && a.length === n && new Set(a).size === n && a.every(v => Number.isInteger(v) && v >= 0 && v < n);
  const OPEN_MODES = ['one', 'seq', 'all'];

  function sanitizeA(obj) {
    const o = obj && typeof obj === 'object' ? obj : {};
    const players = names(o.players) || DEFAULT_A.players.slice();
    const prizes = names(o.prizes) || DEFAULT_A.prizes.slice();
    const n = players.length;
    let board = null;
    const b = o.board;
    if (b && typeof b === 'object' && typeof b.at === 'number' && b.n === n && n >= MIN_N && isPerm(b.order, n) && Array.isArray(b.rungs)) {
      const rungs = b.rungs
        .filter(r => r && Number.isInteger(r.c) && r.c >= 0 && r.c < n - 1 && typeof r.y === 'number' && r.y > 0 && r.y < 1)
        .slice(0, MAX_RUNGS)
        .map(r => ({ c: r.c, y: r.y, u: r.u === true, at: num(r.at, 0, 0, Number.MAX_SAFE_INTEGER) }));
      board = { at: b.at, n, rungs, order: b.order.slice() };
    }
    const opens = [];
    if (board && Array.isArray(o.opens)) {
      const seen = new Set();
      for (const e of o.opens) {
        if (!e || !Number.isInteger(e.p) || e.p < 0 || e.p >= n || seen.has(e.p) || typeof e.at !== 'number') continue;
        seen.add(e.p);
        opens.push({ p: e.p, at: e.at, d: num(e.d, 0, 0, 3600000), m: OPEN_MODES.includes(e.m) ? e.m : 'one' });
      }
    }
    return { title: str(o.title, '', 60), players, prizes, board, opens };
  }

  // テキスト（1行に1つ）→ 名前の並び。空の行は飛ばす
  const parseLines = text => String(text || '').split(/\r?\n/).map(s => s.trim()).filter(Boolean).slice(0, MAX_N).map(s => s.slice(0, MAX_LEN));

  // 'setup'（くじを作る前）/ 'ready'（作った。横線を足せる）/ 'open'（開けている）/ 'done'（全員開けた）
  function phase(A) {
    if (!A.board) return 'setup';
    if (!A.opens.length) return 'ready';
    return A.opens.length < A.board.n ? 'open' : 'done';
  }

  // 0 以上 1 未満の乱数（crypto が使えればそちら）
  function rand() {
    if (global.crypto && global.crypto.getRandomValues) {
      const u = new Uint32Array(1);
      global.crypto.getRandomValues(u);
      return u[0] / 4294967296;
    }
    return Math.random();
  }
  function shuffle(a) {
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  // くじを作る：縦線のすき間ごとに横線を引く（となりのすき間と同じ高さには引かない）。
  //  結果の並びも混ぜておくと、横線の引き方に関係なく、だれがどれに当たるかは公平になる
  function makeBoard(A, S) {
    const n = A.players.length;
    if (n < MIN_N) return { error: '参加者を2人以上入れてください' };
    const used = [], rungs = [];
    for (let c = 0; c < n - 1; c++) {
      used[c] = new Set();
      const want = Math.max(1, Math.round(S.rungs + (rand() - 0.5) * 2));
      for (let t = 0; t < 200 && used[c].size < want; t++) {
        const L = 1 + Math.floor(rand() * (LEVELS - 1));
        // 同じすき間では1段あける（くっついて二重線に見えないように）
        if (used[c].has(L) || used[c].has(L - 1) || used[c].has(L + 1) || (c > 0 && used[c - 1].has(L))) continue;
        used[c].add(L);
        // 少しだけ高さをずらして手書きっぽくする（段の差より小さいので、となりとの上下は入れ替わらない）
        rungs.push({ c, y: (L + (rand() - 0.5) * 0.3) / LEVELS, u: false, at: 0 });
      }
    }
    const order = [...Array(n).keys()];
    if (S.shufflePrizes) shuffle(order);
    return { A: { ...A, board: { at: Date.now(), n, rungs, order }, opens: [] } };
  }

  // 横線を足せるか（足せなければ理由を返す）
  function rungError(A, c, y) {
    const b = A.board;
    if (!b) return 'まだくじを作っていません';
    if (A.opens.length) return '開け始めたあとは横線を足せません';
    if (b.rungs.length >= MAX_RUNGS) return '横線はこれ以上足せません';
    if (!(c >= 0 && c < b.n - 1) || !(y >= 0.03 && y <= 0.97)) return 'そこには引けません';
    if (b.rungs.some(r => Math.abs(r.c - c) <= 1 && Math.abs(r.y - y) < GAP)) return '近くにほかの横線があります';
    return '';
  }
  function addRung(A, c, y) {
    const err = rungError(A, c, y);
    if (err) return { error: err };
    return { A: { ...A, board: { ...A.board, rungs: [...A.board.rungs, { c, y, u: true, at: Date.now() }] } } };
  }
  function addRandomRung(A) {
    if (!A.board) return { error: 'まだくじを作っていません' };
    for (let t = 0; t < 300; t++) {
      const c = Math.floor(rand() * (A.board.n - 1)), y = 0.05 + rand() * 0.9;
      if (!rungError(A, c, y)) return addRung(A, c, y);
    }
    return { error: rungError(A, 0, 0.5) || '空いている場所がありません' };
  }

  // 札を入れ替える（開け始める前だけ）。row 'top' は名前、'bottom' は結果。
  //  くじを作ったあとの結果は、隠したまま並び（order）だけを入れ替える
  function swapError(A, row, i, j) {
    if (A.opens.length) return '開け始めたあとは入れ替えられません';
    const n = A.players.length;
    if (i === j || !(i >= 0 && i < n && j >= 0 && j < n)) return 'そこには入れ替えられません';
    if (row === 'bottom' && !A.board && Math.max(i, j) >= A.prizes.length) return '結果が入っていない場所とは入れ替えられません';
    return '';
  }
  function swap(A, row, i, j) {
    const err = swapError(A, row, i, j);
    if (err) return { error: err };
    const sw = a => { const b = a.slice(); [b[i], b[j]] = [b[j], b[i]]; return b; };
    if (row === 'top') return { A: { ...A, players: sw(A.players) } };
    if (A.board) return { A: { ...A, board: { ...A.board, order: sw(A.board.order) } } };
    return { A: { ...A, prizes: sw(A.prizes) } };
  }

  // p 番目の人の線をたどる：上から順に、今いる縦線につながる横線があれば渡る。
  //  pts は [列, 高さ] の折れ線、end は着いた列
  function trace(A, p) {
    const rs = A.board ? A.board.rungs.slice().sort((a, b) => a.y - b.y) : [];
    let col = p;
    const pts = [[p, 0]];
    for (const r of rs) {
      if (r.c === col) { pts.push([col, r.y], [col + 1, r.y]); col++; }
      else if (r.c === col - 1) { pts.push([col, r.y], [col - 1, r.y]); col--; }
    }
    pts.push([col, 1]);
    return { pts, end: col };
  }
  const prizeText = (A, col) => (A.prizes[A.board ? A.board.order[col] : col] || '').trim();
  const resultOf = (A, p) => prizeText(A, trace(A, p).end);

  // 開ける：ps の人（まだ開けていない人だけ）を opens に足す。表示ページは新しく足された分の線をたどる
  function open(A, S, ps) {
    if (!A.board) return { error: 'まだくじを作っていません' };
    const done = new Set(A.opens.map(e => e.p));
    const list = ps.filter(p => Number.isInteger(p) && p >= 0 && p < A.board.n && !done.has(p));
    if (!list.length) return { error: 'もう開いています' };
    const at = Date.now();
    const m = list.length === 1 ? 'one' : S.openMode === 'all' ? 'all' : 'seq';
    const step = m === 'seq' ? (S.traceSec + S.seqPause) * 1000 : 0;
    return { A: { ...A, opens: [...A.opens, ...list.map((p, i) => ({ p, at, d: i * step, m }))] } };
  }
  const unopened = A => (A.board ? A.players.map((_, i) => i).filter(i => !A.opens.some(e => e.p === i)) : []);
  // 線をたどり終わる時刻（結果の欄は、これより前には結果を出さない）
  const endOf = (e, S) => e.at + e.d + S.traceSec * 1000;
  const doneAt = (A, S) => A.opens.reduce((a, e) => Math.max(a, endOf(e, S)), 0);

  // ---------------------------------------------------------------
  //  見た目（S）
  // ---------------------------------------------------------------
  // たどる線の色（参加者ごと）
  const PALETTES = {
    pop: { l: 'ポップ', c: ['#ff5f6d', '#4dabf7', '#ffd43b', '#69db7c', '#9775fa', '#ffa94d', '#f783ac', '#38d9a9'] },
    pastel: { l: 'パステル', c: ['#ff8fab', '#74c0fc', '#ffd166', '#8ce99a', '#b197fc', '#ffb070', '#63e6be', '#e599f7'] },
    neon: { l: 'ネオン', c: ['#ff2e88', '#00e5ff', '#f8ff00', '#39ff14', '#bf5fff', '#ff8a00'] },
    wa: { l: '和風', c: ['#b7282e', '#1b3a5c', '#c99a2e', '#2f6b3a', '#6b3e8e', '#d0643b'] },
    vivid: { l: 'ビビッド', c: ['#e03131', '#1971c2', '#f08c00', '#2f9e44', '#9c36b5', '#0c8599'] },
  };

  const DEFAULTS = {
    rungs: 3, shufflePrizes: true, hidePrizes: true, hideRungs: false, clickAdd: true, dragSwap: true,
    palette: 'pop', font: 'M PLUS Rounded 1c', fontCustom: '', weight: '900',
    panelOn: true, panelColor: '#1a0a14', panelAlpha: 0.72,
    lineColor: '#ffffff', lineWidth: 6, traceWidth: 14,
    hideColor: '#ff85a1',
    labelSize: 40, nameBg: '#ffffff', nameColor: '#2a1020',
    prizeBg: '#ffd43b', prizeColor: '#2a1020', coverBg: '#ff85a1', coverColor: '#ffffff', coverText: '？',
    titleSize: 64, titleColor: '#ffffff', titleEffect: 'outline', titleEffectColor: '#000000',
    traceSec: 4, openMode: 'seq', seqPause: 0.8,
    sound: true, volume: 0.5,
    resultOn: true, resultLabel: '🎉 結果', resultSec: 3, resultSize: 88,
    resultBg: '#000000', resultAlpha: 0.78, resultColor: '#ffffff', resultAccent: '#ffd43b',
  };
  const COLOR_KEYS = Object.keys(DEFAULTS).filter(k => HEX.test(String(DEFAULTS[k])));

  function sanitize(obj) {
    const out = { ...DEFAULTS };
    if (!obj || typeof obj !== 'object') return out;
    for (const k of Object.keys(DEFAULTS)) {
      if (!(k in obj)) continue;
      const d = DEFAULTS[k], v = obj[k];
      if (typeof d === 'number' && typeof v === 'number' && isFinite(v)) out[k] = v;
      else if (typeof d === 'boolean' && typeof v === 'boolean') out[k] = v;
      else if (typeof d === 'string' && typeof v === 'string') {
        if (COLOR_KEYS.includes(k) && !HEX.test(v)) continue;
        out[k] = v;
      }
    }
    if (!PALETTES[out.palette]) out.palette = DEFAULTS.palette;
    if (!['seq', 'all'].includes(out.openMode)) out.openMode = 'seq';
    out.rungs = Math.min(8, Math.max(1, out.rungs));
    out.traceSec = Math.min(20, Math.max(1, out.traceSec));
    out.seqPause = Math.min(10, Math.max(0, out.seqPause));
    out.labelSize = Math.min(80, Math.max(16, out.labelSize));
    out.titleSize = Math.min(140, Math.max(24, out.titleSize));
    out.coverText = out.coverText.slice(0, 10);
    return out;
  }
  const pathColor = (S, p) => { const c = PALETTES[S.palette].c; return c[p % c.length]; };

  // ---------------------------------------------------------------
  //  保存（OBSのドックとブラウザソースは、この localStorage を共有する）
  // ---------------------------------------------------------------
  const STORE_KEY = 'donnma-amida-v1';
  function loadStored() {
    try {
      const raw = JSON.parse(localStorage.getItem(STORE_KEY) || 'null');
      if (raw) return { A: sanitizeA(raw.A), S: sanitize(raw.S) };
    } catch (e) { /* 読めなければ初期値 */ }
    return { A: sanitizeA(null), S: sanitize(null) };
  }
  function saveStored(A, S) {
    try { localStorage.setItem(STORE_KEY, JSON.stringify({ A, S, at: Date.now() })); return true; } catch (e) { return false; }
  }

  // ---------------------------------------------------------------
  //  配置（1920×1080 の中の位置）
  // ---------------------------------------------------------------
  function geom(A, S) {
    const n = Math.max(1, A.players.length);
    const th = A.title.trim() ? Math.round(S.titleSize * 1.3) : 0;
    const top = 56 + (th ? th + 24 : 0);
    const chipH = Math.round(S.labelSize * 1.6);
    const subH = Math.round(S.labelSize * 0.8 + 12);
    const colW = Math.min(340, (W - 200) / n);
    const x0 = (W - colW * n) / 2;
    const chipW = Math.max(24, Math.min(colW - 14, 300));
    const nameY = top, yTop = top + chipH + 8;
    const prizeY = H - 56 - subH - chipH, yBot = prizeY - 8;
    return {
      n, th, chipH, subH, colW, x0, chipW, nameY, yTop, prizeY, yBot,
      x: i => x0 + colW * (i + 0.5),
      y: t => yTop + (yBot - yTop) * t,
    };
  }

  // 1920×1080 の座標で、名前（開ける・入れ替える）・結果（入れ替える）・縦線のすき間（横線を足す）のどれを指しているか
  function hitTest(A, S, px, py) {
    const g = geom(A, S), n = A.players.length;
    if (!n) return null;
    const fx = (px - g.x0) / g.colW - 0.5;
    const i = Math.round(fx);
    const onChip = i >= 0 && i < n && Math.abs(px - g.x(i)) <= g.chipW / 2 + 4;
    if (onChip && py >= g.nameY - 6 && py <= g.nameY + g.chipH + 6) return { kind: 'player', p: i };
    if (onChip && py >= g.prizeY - 6 && py <= g.prizeY + g.chipH + 6) return { kind: 'prize', p: i };
    if (A.board && py > g.yTop && py < g.yBot) {
      const c = Math.floor(fx);
      if (c >= 0 && c < n - 1 && px > g.x(c) + 6 && px < g.x(c + 1) - 6) return { kind: 'gap', c, y: (py - g.yTop) / (g.yBot - g.yTop) };
    }
    return null;
  }

  // ---------------------------------------------------------------
  //  描画
  // ---------------------------------------------------------------
  function fontFamily(S) {
    const f = C.fontInfo(S);
    return f ? f.family : '"Zen Maru Gothic", sans-serif';
  }
  // 幅に収まるように小さくし、それでも入らなければ「…」で切る
  function fitText(ctx, S, text, maxW, size) {
    const ff = fontFamily(S);
    let fs = size;
    ctx.font = `${S.weight} ${fs}px ${ff}`;
    let w = ctx.measureText(text).width;
    if (w > maxW) { fs = Math.max(12, fs * maxW / w); ctx.font = `${S.weight} ${fs}px ${ff}`; w = ctx.measureText(text).width; }
    let t = text;
    while (w > maxW && t.length > 1) { t = t.slice(0, -1); w = ctx.measureText(t + '…').width; }
    return t === text ? t : t + '…';
  }
  function roundRect(ctx, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }
  function chip(ctx, S, cx, y, w, h, bg, fg, text, border) {
    roundRect(ctx, cx - w / 2, y, w, h, 18);
    ctx.fillStyle = bg;
    ctx.fill();
    if (border) { ctx.lineWidth = 7; ctx.strokeStyle = border; ctx.stroke(); }
    const t = fitText(ctx, S, text, w - 16, S.labelSize);
    ctx.fillStyle = fg;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(t, cx, y + h / 2 + 2);
  }
  // 折れ線を、全体の長さの k（0〜1）まで引く。引き終わりの点を返す
  function partialLine(ctx, pts, k) {
    const lens = [];
    let total = 0;
    for (let i = 1; i < pts.length; i++) {
      const l = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
      lens.push(l);
      total += l;
    }
    let left = total * k;
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    let head = pts[0];
    for (let i = 1; i < pts.length; i++) {
      if (left >= lens[i - 1]) { ctx.lineTo(pts[i][0], pts[i][1]); left -= lens[i - 1]; head = pts[i]; continue; }
      const f = lens[i - 1] ? left / lens[i - 1] : 0;
      head = [pts[i - 1][0] + (pts[i][0] - pts[i - 1][0]) * f, pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * f];
      ctx.lineTo(head[0], head[1]);
      break;
    }
    return head;
  }
  // たどる線の画面上の折れ線（名前の下から結果の上まで）と、曲がり角が全体のどこにあるか（0〜1。効果音用）
  function tracePath(A, S, p) {
    const g = geom(A, S), tr = trace(A, p);
    const pts = tr.pts.map(([c, t]) => [g.x(c), g.y(t)]);
    pts[0][1] = g.nameY + g.chipH;
    pts[pts.length - 1][1] = g.prizeY;
    const lens = [0];
    for (let i = 1; i < pts.length; i++) lens.push(lens[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
    const total = lens[lens.length - 1] || 1;
    return { pts, end: tr.end, corners: lens.slice(1, -1).map(l => l / total) };
  }

  const clamp01 = v => Math.min(1, Math.max(0, v));
  /*
   * A と S を 1920×1080 の座標で描く（ctx の拡大・縮小は呼ぶ側で済ませておく）。
   *  st.time(e)：その開け方の線をたどり始めてからの秒数（null はまだ。省くと、全部たどり終わった絵になる）
   *  st.pop(r, i)：横線が伸びる演出（0〜1。省くと伸びきった線）
   *  st.hover：マウスで指しているもの（hitTest の結果）
   *  st.drag：ドラッグ中の札 { row: 'top'|'bottom', from, over, x, y }（over は落とす先。-1 はなし）
   *  st.slide(row, i)：入れ替わった札がすべる演出のずれ { dx, dy }（省くと、ずれなし）
   */
  function draw(ctx, A, S, st) {
    st = st || {};
    const g = geom(A, S), n = A.players.length;
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    if (S.panelOn && n) {
      const x1 = Math.max(24, g.x0 - 40), x2 = Math.min(W - 24, g.x0 + g.colW * n + 40);
      roundRect(ctx, x1, g.nameY - 32, x2 - x1, g.prizeY + g.chipH + g.subH + 20 - (g.nameY - 32), 36);
      ctx.fillStyle = C.hexToRgba(S.panelColor, S.panelAlpha);
      ctx.fill();
    }

    if (g.th) {
      const text = fitText(ctx, S, A.title.trim(), W - 160, S.titleSize);
      const ty = 56 + g.th / 2;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.save();
      if (S.titleEffect === 'outline') {
        ctx.lineWidth = Math.max(4, S.titleSize * 0.14);
        ctx.strokeStyle = S.titleEffectColor;
        ctx.strokeText(text, W / 2, ty);
      } else if (S.titleEffect === 'shadow') {
        ctx.shadowColor = S.titleEffectColor;
        ctx.shadowOffsetX = ctx.shadowOffsetY = Math.max(3, S.titleSize * 0.06);
      } else if (S.titleEffect === 'glow') {
        ctx.shadowColor = S.titleEffectColor;
        ctx.shadowBlur = S.titleSize * 0.4;
        ctx.fillStyle = S.titleColor;
        ctx.fillText(text, W / 2, ty);
      }
      ctx.fillStyle = S.titleColor;
      ctx.fillText(text, W / 2, ty);
      ctx.restore();
    }
    if (!n) { ctx.restore(); return; }

    const vLines = () => {
      ctx.strokeStyle = S.lineColor;
      ctx.lineWidth = S.lineWidth;
      ctx.beginPath();
      for (let i = 0; i < n; i++) { ctx.moveTo(g.x(i), g.yTop); ctx.lineTo(g.x(i), g.yBot); }
      ctx.stroke();
    };
    const rungs = (list, dashed) => {
      ctx.strokeStyle = S.lineColor;
      ctx.lineWidth = S.lineWidth;
      ctx.setLineDash(dashed ? [S.lineWidth * 2, S.lineWidth * 2] : []);
      ctx.beginPath();
      for (const [r, i] of list) {
        const k = st.pop ? clamp01(st.pop(r, i)) : 1;
        if (k <= 0) continue;
        const x1 = g.x(r.c), x2 = g.x(r.c + 1), m = (x1 + x2) / 2, h = (x2 - x1) / 2 * k, y = g.y(r.y);
        ctx.moveTo(m - h, y);
        ctx.lineTo(m + h, y);
      }
      ctx.stroke();
      ctx.setLineDash([]);
    };
    const all = A.board ? A.board.rungs.map((r, i) => [r, i]) : [];
    vLines();
    if (A.board && S.hideRungs) {
      // 横線を隠す：自動で引いた線の上に覆いをかけ、縦線と手で足した線だけを見せる
      rungs(all.filter(([r]) => !r.u));
      const x1 = g.x(0) - 28, x2 = g.x(n - 1) + 28, y1 = g.y(0.02), y2 = g.y(0.98);
      roundRect(ctx, x1, y1, x2 - x1, y2 - y1, 16);
      ctx.fillStyle = S.hideColor;
      ctx.fill();
      ctx.save();
      ctx.clip();
      ctx.strokeStyle = 'rgba(255,255,255,0.14)';
      ctx.lineWidth = 14;
      ctx.beginPath();
      for (let x = x1 - (y2 - y1); x < x2; x += 44) { ctx.moveTo(x, y2); ctx.lineTo(x + (y2 - y1), y1); }
      ctx.stroke();
      ctx.restore();
      vLines();
      rungs(all.filter(([r]) => r.u));
    } else {
      rungs(all);
    }
    const hv = st.hover;
    if (hv && hv.kind === 'gap') {
      ctx.save();
      ctx.globalAlpha = 0.55;
      rungs([[{ c: hv.c, y: hv.y }, -1]], true);
      ctx.restore();
    }

    // たどった線
    const arrived = {};   // 下の列 → { e, flip }（flip は結果をめくる演出 0〜1）
    for (const e of A.opens) {
      const t = st.time ? st.time(e) : Infinity;
      if (t == null || t <= 0) continue;
      const k = clamp01(t / S.traceSec);
      const tp = tracePath(A, S, e.p);
      const col = pathColor(S, e.p);
      ctx.save();
      ctx.strokeStyle = col;
      ctx.lineWidth = S.traceWidth;
      ctx.shadowColor = col;
      ctx.shadowBlur = 18;
      const head = partialLine(ctx, tp.pts, k);
      ctx.stroke();
      ctx.shadowBlur = 0;
      if (k < 1) {
        ctx.beginPath();
        ctx.arc(head[0], head[1], S.traceWidth * 0.9 + 8, 0, Math.PI * 2);
        ctx.fillStyle = '#ffffff';
        ctx.fill();
        ctx.lineWidth = 6;
        ctx.strokeStyle = col;
        ctx.stroke();
      } else {
        arrived[tp.end] = { e, flip: clamp01((t - S.traceSec) / 0.35) };
      }
      ctx.restore();
    }

    const dr = st.drag;
    const slide = (row, i) => (st.slide && st.slide(row, i)) || { dx: 0, dy: 0 };
    const hidden = !!A.board && S.hidePrizes;
    const nameChip = (i, x, y, border) => chip(ctx, S, x, y, g.chipW, g.chipH, S.nameBg, S.nameColor, A.players[i] || '—', border);
    const prizeChip = (c, x, y, border, show) => (show
      ? chip(ctx, S, x, y, g.chipW, g.chipH, S.prizeBg, S.prizeColor, prizeText(A, c) || '—', border)
      : chip(ctx, S, x, y, g.chipW, g.chipH, S.coverBg, S.coverColor, S.coverText || '？', border));
    // ドラッグしている札は元の場所を薄くし、落とす先の札に枠を付ける
    const dragFrom = (row, i) => dr && dr.row === row && dr.from === i;
    const dropOn = (row, i) => dr && dr.row === row && dr.over === i && dr.from !== i;

    // 名前
    for (let i = 0; i < n; i++) {
      const opened = A.opens.some(e => e.p === i);
      const hov = hv && hv.kind === 'player' && hv.p === i;
      const o = slide('top', i);
      ctx.save();
      if (dragFrom('top', i)) ctx.globalAlpha = 0.3;
      nameChip(i, g.x(i) + o.dx, g.nameY + o.dy, dropOn('top', i) ? S.lineColor : opened || hov ? pathColor(S, i) : null);
      ctx.restore();
    }
    // 結果（隠すときは、線が着いたらめくる）
    for (let c = 0; c < n; c++) {
      const a = arrived[c];
      const f = a ? (hidden ? a.flip : 1) : 0;
      const showPrize = !hidden || f >= 0.5;
      const sy = hidden && a ? Math.abs(1 - 2 * f) : 1;   // めくる間だけ縦につぶす
      const o = slide('bottom', c);
      const x = g.x(c) + o.dx, y = g.prizeY + o.dy, cy = y + g.chipH / 2;
      ctx.save();
      if (dragFrom('bottom', c)) ctx.globalAlpha = 0.3;
      ctx.translate(0, cy);
      ctx.scale(1, Math.max(0.02, sy));
      ctx.translate(0, -cy);
      prizeChip(c, x, y, dropOn('bottom', c) ? S.lineColor : a ? pathColor(S, a.e.p) : null, showPrize);
      ctx.restore();
      if (a && showPrize) {
        const t = fitText(ctx, S, A.players[a.e.p] || '', g.colW - 8, S.labelSize * 0.62);
        ctx.fillStyle = pathColor(S, a.e.p);
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(t, x, y + g.chipH + g.subH / 2 + 4);
      }
    }
    // ドラッグしている札（指の位置についてくる。結果は隠したまま）
    if (dr && dr.from >= 0 && dr.from < n) {
      ctx.save();
      ctx.shadowColor = 'rgba(0,0,0,0.5)';
      ctx.shadowBlur = 24;
      ctx.shadowOffsetY = 8;
      const y = dr.y - g.chipH / 2;
      if (dr.row === 'top') nameChip(dr.from, dr.x, y, pathColor(S, dr.from));
      else prizeChip(dr.from, dr.x, y, S.lineColor, !hidden);
      ctx.restore();
    }
    ctx.restore();
  }

  // Google フォントを読み込んでから cb を呼ぶ（canvas は読み込み前のフォントで描いてしまうので）
  const fontLinks = new Set();
  function loadFont(S, A, doc) {
    doc = doc || document;
    const info = C.fontInfo(S);
    if (info && info.url && !fontLinks.has(info.url)) {
      fontLinks.add(info.url);
      const link = doc.createElement('link');
      link.rel = 'stylesheet';
      link.href = info.url;
      doc.head.appendChild(link);
      return new Promise(res => { link.onload = link.onerror = res; }).then(() => loadFont(S, A, doc));
    }
    if (!doc.fonts) return Promise.resolve();
    const text = [...new Set((A.title + A.players.join('') + A.prizes.join('') + S.coverText + '—…'))].join('');
    return doc.fonts.load(`${S.weight} 40px ${fontFamily(S)}`, text || 'あ').catch(() => { });
  }

  // ---------------------------------------------------------------
  //  CSS（view.html の結果 .am-result 用。くじは canvas に描く）
  // ---------------------------------------------------------------
  function generateCSS(S) {
    const out = [];
    const font = C.fontInfo(S);
    if (font && font.url) out.push(`@import url("${font.url}");`);
    out.push(`.am-result { font-family: ${fontFamily(S)}; font-weight: ${S.weight}; }`);
    out.push(`.am-result {
  background: ${C.hexToRgba(S.resultBg, S.resultAlpha)}; color: ${S.resultColor};
  border: 6px solid ${S.resultAccent};
  box-shadow: 0 0 0 6px ${C.hexToRgba(S.resultBg, S.resultAlpha * 0.5)}, 0 18px 50px rgba(0, 0, 0, 0.45);
}
.am-result-label { color: ${S.resultAccent}; }
.am-result-text { font-size: ${+(+S.resultSize).toFixed(2)}px; }
.am-result-name { font-size: ${+(S.resultSize * 0.5).toFixed(2)}px; }`);
    return out.join('\n') + '\n';
  }

  global.AmidaCore = {
    W, H, MIN_N, MAX_N, DEFAULT_A, DEFAULTS, PALETTES, STORE_KEY,
    sanitizeA, sanitize, parseLines, phase, makeBoard, rungError, addRung, addRandomRung, swapError, swap,
    trace, tracePath, prizeText, resultOf, open, unopened, endOf, doneAt, pathColor,
    loadStored, saveStored, geom, hitTest, draw, loadFont, fontFamily, generateCSS,
  };
})(window);
