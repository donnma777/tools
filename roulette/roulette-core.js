/*
 * ルーレット — 編集ページ（index.html）と表示ページ（view.html）で共通の部品
 *  - 項目（R）と見た目（S）の初期値・読み込み
 *  - 当たりやすさ（重み）を使った抽選と、止まる角度の計算
 *  - このブラウザへの保存（OBSのドックとブラウザソースは localStorage を共有するので、storage イベントで同期する）
 *  - 見出し・結果の表示の CSS 生成
 * フォント一覧は ../chat-css-generator/chat-core.js（window.ChatCore）を使う。
 * このファイルを変えたら、読み込んでいる2ページの ?v= を上げる。
 */
(function (global) {
  'use strict';
  const C = global.ChatCore;
  const TAU = Math.PI * 2;

  // ---------------------------------------------------------------
  //  項目（R）：ルーレットの中身と、回した結果
  // ---------------------------------------------------------------
  const uid = () => Math.random().toString(36).slice(2, 8);
  const sample = ['大当たり', '当たり', 'もう一回', 'ハズレ', 'ボーナス', 'おしい！'];
  const DEFAULT_R = {
    title: '',
    items: sample.map((t, i) => ({ id: 'd' + i, t, w: 1, c: '', off: false, hit: false })),
    removeHit: false,
    // 最後に回したときの記録（items はそのときの円盤）。
    //  mode 'auto'：回し始めに当たり id と止まる角度 angle を決め、dur 秒で止まる
    //  mode 'free'：ストップを押すまで回る。押した時刻 stopAt に id・angle を決め、stopSec 秒くらいで止まる
    spin: null,
    history: [],    // [{ t, at }]：新しい順
  };
  const MAX_ITEMS = 100;
  const MAX_HISTORY = 50;

  const HEX = /^#[0-9a-f]{6}$/i;
  const num = (v, d, lo, hi) => (typeof v === 'number' && isFinite(v) ? Math.min(hi, Math.max(lo, v)) : d);
  const str = (v, d, max) => (typeof v === 'string' ? v.slice(0, max) : d);

  function sanitizeItem(x, seen) {
    if (!x || typeof x !== 'object') return null;
    let id = typeof x.id === 'string' && /^[A-Za-z0-9_-]{1,16}$/.test(x.id) ? x.id : uid();
    while (seen.has(id)) id = uid();
    seen.add(id);
    return {
      id, t: str(x.t, '', 60), w: num(x.w, 1, 0.1, 1000),
      c: typeof x.c === 'string' && HEX.test(x.c) ? x.c.toLowerCase() : '',
      off: x.off === true, hit: x.hit === true,
    };
  }

  function sanitizeR(obj) {
    const o = obj && typeof obj === 'object' ? obj : {};
    const seen = new Set();
    const items = Array.isArray(o.items)
      ? o.items.slice(0, MAX_ITEMS).map(x => sanitizeItem(x, seen)).filter(Boolean)
      : DEFAULT_R.items.map(x => ({ ...x }));
    let spin = null;
    const sp = o.spin;
    if (sp && typeof sp === 'object' && typeof sp.at === 'number' && typeof sp.id === 'string' && Array.isArray(sp.items)) {
      const s2 = new Set();
      spin = {
        at: sp.at, mode: sp.mode === 'free' ? 'free' : 'auto', id: sp.id, angle: num(sp.angle, 0, 0, TAU), dur: num(sp.dur, 6, 1, 30),
        items: sp.items.slice(0, MAX_ITEMS).map(x => sanitizeItem(x, s2)).filter(Boolean),
        stopAt: num(sp.stopAt, 0, 0, Infinity), stopSec: num(sp.stopSec, 4, 1, 20), maxSec: num(sp.maxSec, 0, 0, 600),
      };
    }
    const history = Array.isArray(o.history)
      ? o.history.filter(h => h && typeof h.t === 'string' && typeof h.at === 'number').slice(0, MAX_HISTORY).map(h => ({ t: h.t.slice(0, 60), at: h.at }))
      : [];
    return { title: str(o.title, '', 60), items, removeHit: o.removeHit === true, spin, history };
  }

  // 円盤に載る項目（オフにした項目・空欄・「当たったら外す」で外れた項目を除く）
  const active = R => R.items.filter(x => !x.off && x.t.trim() && !(R.removeHit && x.hit));

  // 「項目 *3」「項目 ×3」「項目, 3」（タブ区切りも可）で当たりやすさを付けられる
  function parseText(text) {
    const out = [];
    for (const raw of String(text || '').split(/\r?\n/)) {
      const line = raw.trim();
      if (!line) continue;
      const m = line.match(/^(.+?)\s*(?:[×*＊]|\s[xX]|[,，\t])\s*(\d+(?:\.\d+)?)$/);
      out.push({ id: uid(), t: (m ? m[1] : line).trim().slice(0, 60), w: m ? num(+m[2], 1, 0.1, 1000) : 1, c: '', off: false, hit: false });
    }
    return out.slice(0, MAX_ITEMS);
  }
  const toText = items => items.map(x => x.t + (x.w !== 1 ? ` *${x.w}` : '')).join('\n');

  // ---------------------------------------------------------------
  //  見た目（S）
  // ---------------------------------------------------------------
  const PALETTES = {
    pop: { l: 'ポップ', c: ['#ff5f6d', '#ffa94d', '#ffd43b', '#69db7c', '#4dabf7', '#9775fa'] },
    pastel: { l: 'パステル', c: ['#ffb3c6', '#ffd6a5', '#fdffb6', '#caffbf', '#9bf6ff', '#bdb2ff'] },
    pink: { l: 'ピンク', c: ['#ff85a1', '#ffc2d1', '#ff5c8a', '#ffe5ec'] },
    neon: { l: 'ネオン', c: ['#ff2e88', '#2a1250', '#00e5ff', '#1b1036'] },
    vivid: { l: 'ビビッド（赤・黒）', c: ['#e03131', '#1b1b1b'] },
    wa: { l: '和風', c: ['#b7282e', '#f5f0e1', '#1b3a5c', '#d9b777'] },
    mono: { l: 'モノトーン', c: ['#2b2b2b', '#f1f1f1'] },
    ocean: { l: 'オーシャン', c: ['#0b7285', '#15aabf', '#66d9e8', '#c5f6fa'] },
  };

  const DEFAULTS = {
    palette: 'pop', sizeByWeight: true,
    font: 'M PLUS Rounded 1c', fontCustom: '', weight: '900', textScale: 1,
    textMode: 'auto', textColor: '#ffffff', textStroke: false, strokeColor: '#000000', strokeWidth: 4,
    lineOn: true, lineColor: '#ffffff', lineWidth: 3,
    rimOn: true, rimColor: '#ffffff', rimWidth: 16, pins: true, pinColor: '#ffd43b',
    hubOn: true, hubColor: '#ffffff', hubText: '', hubTextColor: '#333333',
    pointerPos: 'top', pointerColor: '#ff3b5c', pointerOutline: '#ffffff',
    shadow: true,
    titleSize: 64, titleColor: '#ffffff', titleEffect: 'outline', titleEffectColor: '#000000',
    stopMode: 'auto', spinSec: 6, freeSpeed: 1.5, maxSec: 0, stopSec: 4, idleSpin: false,
    sound: true, volume: 0.5,
    resultOn: true, resultLabel: '🎉 結果', resultSec: 4, resultSize: 88,
    resultBg: '#000000', resultAlpha: 0.78, resultColor: '#ffffff', resultAccent: '#ffd43b', dimOthers: true,
    histPos: 'none', histCount: 8, histTitle: 'これまでの結果', histNum: true, histSize: 36,
    histColor: '#ffffff', histAccent: '#ffd43b', histBg: '#000000', histAlpha: 0.55,
  };
  const HIST_POS = ['none', 'right', 'left', 'bottom'];
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
    if (!HIST_POS.includes(out.histPos)) out.histPos = 'none';
    out.histCount = Math.round(Math.min(30, Math.max(1, out.histCount)));
    out.spinSec = Math.min(30, Math.max(1, out.spinSec));
    if (out.stopMode !== 'button') out.stopMode = 'auto';
    out.freeSpeed = Math.min(5, Math.max(0.2, out.freeSpeed));
    out.maxSec = Math.min(600, Math.max(0, out.maxSec));
    out.stopSec = Math.min(20, Math.max(1, out.stopSec));
    return out;
  }

  // 項目の色：指定があればその色、なければ配色を順に使う（最後と最初が同じ色で隣り合わないようにずらす）
  function colorsFor(items, S) {
    const pal = PALETTES[S.palette].c;
    const n = items.length;
    return items.map((x, i) => {
      if (x.c) return x.c;
      let k = i % pal.length;
      if (i === n - 1 && n > 1 && k === 0) {
        const prev = (n - 2) % pal.length;
        k = [1, 2].find(c => c < pal.length && c !== prev) ?? (pal.length > 1 ? 1 : 0);
      }
      return pal[k];
    });
  }

  // 円盤の扇（a0〜a1 は針の位置から時計回りの角度）
  function layout(items, S) {
    const total = items.reduce((a, x) => a + (S.sizeByWeight ? x.w : 1), 0) || 1;
    const colors = colorsFor(items, S);
    let a = 0;
    return items.map((x, i) => {
      const span = (S.sizeByWeight ? x.w : 1) / total * TAU;
      const seg = { ...x, color: colors[i], a0: a, a1: a + span };
      a += span;
      return seg;
    });
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
  function pick(items) {
    const total = items.reduce((a, x) => a + x.w, 0);
    let r = rand() * total;
    for (const x of items) { if ((r -= x.w) < 0) return x; }
    return items[items.length - 1];
  }
  const mod = (a, m) => ((a % m) + m) % m;

  // 当たる項目と止まる角度を決めて、記録・「当たったら外す」を R に反映する
  function decide(R, S, items, at) {
    const target = pick(items);
    const seg = layout(items, S).find(x => x.id === target.id);
    // 扇の端ぎりぎりには止めない（どちらに止まったか分かりにくいので）
    const f = 0.15 + rand() * 0.7;
    const angle = mod(-(seg.a0 + (seg.a1 - seg.a0) * f), TAU);
    return {
      target, angle,
      items: R.items.map(x => (R.removeHit && x.id === target.id ? { ...x, hit: true } : x)),
      history: [{ t: target.t, at }, ...R.history].slice(0, MAX_HISTORY),
    };
  }
  const snapshot = items => items.map(({ id, t, w, c }) => ({ id, t, w, c, off: false, hit: false }));

  // 回す：R.spin に書き込む（表示ページは spin.at が変わったら演出を流す）
  //  自動で止まるときは、ここで当たりも決める。ストップ式なら当たりは stopSpin() で決める
  function spin(R, S) {
    const items = active(R);
    if (!items.length) return { error: '円盤に項目がありません' };
    const at = Date.now();
    if (S.stopMode === 'button') {
      return { R: { ...R, spin: { at, mode: 'free', id: '', angle: 0, dur: 0, items: snapshot(items), stopAt: 0, stopSec: S.stopSec, maxSec: S.maxSec } } };
    }
    const d = decide(R, S, items, at);
    return {
      R: { ...R, items: d.items, history: d.history, spin: { at, mode: 'auto', id: d.target.id, angle: d.angle, dur: S.spinSec, items: snapshot(items), stopAt: 0, stopSec: 0, maxSec: 0 } },
      item: d.target,
    };
  }

  // ストップ：押した時点で当たりを決める（表示ページは spin.stopAt が変わったら、だんだん遅くしてその角度に止める）
  function stopSpin(R, S) {
    const sp = R.spin;
    if (!isFree(R)) return { error: '回っていません' };
    const at = Date.now();
    const d = decide(R, S, sp.items, at);
    return { R: { ...R, items: d.items, history: d.history, spin: { ...sp, id: d.target.id, angle: d.angle, stopAt: at, stopSec: S.stopSec } }, item: d.target };
  }
  // ストップを待って回っている最中か
  const isFree = R => !!(R.spin && R.spin.mode === 'free' && !R.spin.stopAt && R.spin.items.length);
  // 止まって結果が出るまでの目安の時刻（ストップ式は止まるまでの長さが少し前後するので、少し足しておく）
  function doneAt(R) {
    const sp = R.spin;
    if (!sp) return 0;
    if (sp.mode === 'auto') return sp.at + sp.dur * 1000;
    return sp.stopAt ? sp.stopAt + (sp.stopSec + 0.8) * 1000 : Infinity;
  }

  // いま針が指している扇（回転 rot のとき）
  function segmentAt(segs, rot) {
    const a = mod(-rot, TAU);
    return segs.find(s => a >= s.a0 && a < s.a1) || segs[segs.length - 1];
  }

  // ---------------------------------------------------------------
  //  保存（OBSのドックとブラウザソースは、この localStorage を共有する）
  // ---------------------------------------------------------------
  const STORE_KEY = 'donnma-roulette-v1';
  function loadStored() {
    try {
      const raw = JSON.parse(localStorage.getItem(STORE_KEY) || 'null');
      if (raw) return { R: sanitizeR(raw.R), S: sanitize(raw.S) };
    } catch (e) { /* 読めなければ初期値 */ }
    return { R: sanitizeR(null), S: sanitize(null) };
  }
  function saveStored(R, S) {
    try { localStorage.setItem(STORE_KEY, JSON.stringify({ R, S, at: Date.now() })); return true; } catch (e) { return false; }
  }

  // ---------------------------------------------------------------
  //  CSS（view.html の見出し .rl-title と結果 .rl-result 用。円盤は canvas に描く）
  // ---------------------------------------------------------------
  const px = n => `${+(+n).toFixed(2)}px`;
  function fontFamily(S) {
    const f = C.fontInfo(S);
    return f ? f.family : '"Zen Maru Gothic", sans-serif';
  }
  function textShadow(effect, color, w) {
    if (effect === 'outline') {
      const r = [];
      for (let i = 0; i < 16; i++) {
        const a = i / 16 * TAU;
        r.push(`${px(Math.cos(a) * w)} ${px(Math.sin(a) * w)} 0 ${color}`);
      }
      return r.join(', ');
    }
    if (effect === 'shadow') return `${px(w)} ${px(w)} ${px(w)} ${color}`;
    if (effect === 'glow') return `0 0 ${px(w * 3)} ${color}, 0 0 ${px(w * 6)} ${color}`;
    return 'none';
  }

  function generateCSS(S) {
    const out = [];
    const font = C.fontInfo(S);
    if (font && font.url) out.push(`@import url("${font.url}");`);
    const ff = fontFamily(S);
    out.push(`.rl-title, .rl-result, .rl-hist { font-family: ${ff}; font-weight: ${S.weight}; }`);
    out.push(`.rl-title {
  font-size: ${px(S.titleSize)}; color: ${S.titleColor};
  text-shadow: ${textShadow(S.titleEffect, S.titleEffectColor, 4)};
}`);
    out.push(`.rl-result {
  background: ${C.hexToRgba(S.resultBg, S.resultAlpha)}; color: ${S.resultColor};
  border: 6px solid ${S.resultAccent};
  box-shadow: 0 0 0 6px ${C.hexToRgba(S.resultBg, S.resultAlpha * 0.5)}, 0 18px 50px rgba(0, 0, 0, 0.45);
}
.rl-result-label { color: ${S.resultAccent}; }
.rl-result-text { font-size: ${px(S.resultSize)}; }`);
    out.push(`.rl-hist {
  background: ${C.hexToRgba(S.histBg, S.histAlpha)}; color: ${S.histColor}; font-size: ${px(S.histSize)};
}
.rl-hist-title, .rl-hist .n { color: ${S.histAccent}; }
.rl-hist-title { font-size: ${px(S.histSize * 0.8)}; }`);
    return out.join('\n') + '\n';
  }

  global.RouletteCore = {
    TAU, DEFAULT_R, DEFAULTS, PALETTES, HIST_POS, MAX_ITEMS, STORE_KEY,
    uid, sanitizeR, sanitize, active, parseText, toText, colorsFor, layout, spin, stopSpin, isFree, doneAt, segmentAt, mod,
    loadStored, saveStored, generateCSS, fontFamily,
  };
})(window);
