/*
 * 選曲リスト（課題曲・ピック＆BAN）— 編集ページ（index.html）と表示ページ（view.html#show=songs）で共通の部品
 *  - 選曲データ（D）の初期値・読み込み・保存（トーナメントとは別の保存場所）
 *  - 表示用の HTML と CSS の生成（色・文字はトーナメント表メーカーの見た目の設定 S を使う）
 * このファイルを変えたら、読み込んでいる2ページの ?v= を上げる。
 */
(function (global) {
  'use strict';
  const K = global.TournamentCore;
  const STORE_KEY = 'donnma-tournament-songs-v1';

  // ---------------------------------------------------------------
  //  選曲データ（D）
  //  list  = 課題曲（id・曲名 t・アーティスト a・難易度 lv・ジャケット画像 img）
  //  選曲は試合ごと。cur = いま選曲している試合（編集ページの「試合の結果」で選んでいる試合）、
  //  per = 試合ごとの選曲 { matchId: { state, order } }。state / order は cur の試合の分（作業用の写し）
  //  state = 曲ごとの状態 { st: 'pick' | 'ban' | 'played', by: 0 | 1 | -1（-1 = ランダム・運営） }
  //  order = 選ばれた順（その試合の「○曲目」に入れる順番）
  // ---------------------------------------------------------------
  const DEFAULT_D = {
    version: 1,
    title: '課題曲',
    list: [],
    state: {},
    order: [],
    cur: null,                // いま選曲している試合の id
    roulette: { at: 0, id: null },
    autoFill: true,           // 選んだ曲を、今の試合の「○曲目の曲名」に入れる
    showArtist: true,
    showLevel: true,
    hideBanned: false,
    showVs: true,             // 上に「今の試合（A vs B）」を出す
    colorA: '#ff85a1',        // 左側（1人目）のピックの色
    colorB: '#4fb3ff',        // 右側（2人目）のピックの色
    spinSec: 4,               // ルーレットの長さ（秒）
    noReuse: false,           // 一度使った曲は使えない（ほかの試合でピックされた曲は、使用済みとして選べない）
    per: {},                  // 試合ごとの選曲（トーナメント表＋課題曲の表示・使った回数にも使う）
  };

  function sanitize(obj) {
    const out = JSON.parse(JSON.stringify(DEFAULT_D));
    if (!obj || typeof obj !== 'object') return out;
    for (const k of Object.keys(DEFAULT_D)) {
      if (!(k in obj)) continue;
      const d = DEFAULT_D[k], v = obj[k];
      if (k === 'list') {
        if (Array.isArray(v)) out.list = v.filter(x => x && typeof x === 'object').slice(0, 200).map((x, i) => ({
          id: typeof x.id === 'string' && x.id ? x.id : 's' + Date.now().toString(36) + i,
          t: String(x.t || '').slice(0, 80),
          a: String(x.a || '').slice(0, 80),
          lv: String(x.lv || '').slice(0, 30),
          img: typeof x.img === 'string' && /^data:image\/(png|jpeg|webp|gif);base64,[A-Za-z0-9+/=]+$/.test(x.img) ? x.img : '',
        }));
        continue;
      }
      if (k === 'state') { out.state = cleanState(v); continue; }
      if (k === 'order') { if (Array.isArray(v)) out.order = v.filter(x => typeof x === 'string'); continue; }
      if (k === 'roulette') { if (v && typeof v === 'object') out.roulette = { at: Number(v.at) || 0, id: typeof v.id === 'string' ? v.id : null }; continue; }
      if (k === 'cur') { out.cur = typeof v === 'string' ? v : null; continue; }
      if (k === 'per') {
        if (v && typeof v === 'object') for (const [mid, p] of Object.entries(v)) {
          if (!p || typeof p !== 'object') continue;
          const st = cleanState(p.state);
          const order = Array.isArray(p.order) ? p.order.filter(id => typeof id === 'string' && st[id]?.st === 'pick') : [];
          if (Object.keys(st).length) out.per[mid] = { state: st, order };
        }
        continue;
      }
      if (typeof d === typeof v) out[k] = v;
    }
    // 以前の形（history・matchId）から移す
    if (obj.history && typeof obj.history === 'object' && !obj.per) {
      for (const [mid, list] of Object.entries(obj.history)) {
        if (!Array.isArray(list) || !list.length) continue;
        out.per[mid] = { state: Object.fromEntries(list.map(x => [x.id, { st: 'pick', by: [0, 1, -1].includes(x.by) ? x.by : -1 }])), order: list.map(x => x.id) };
      }
      if (typeof obj.matchId === 'string') out.cur = obj.matchId;
    }
    const ids = new Set(out.list.map(x => x.id));
    for (const id of Object.keys(out.state)) if (!ids.has(id)) delete out.state[id];
    out.order = out.order.filter(id => ids.has(id) && out.state[id]?.st === 'pick');
    out.spinSec = Math.min(10, Math.max(1, Number(out.spinSec) || 4));
    if (!/^#[0-9a-f]{6}$/i.test(out.colorA)) out.colorA = DEFAULT_D.colorA;
    if (!/^#[0-9a-f]{6}$/i.test(out.colorB)) out.colorB = DEFAULT_D.colorB;
    return out;
  }

  function cleanState(v) {
    const out = {};
    if (v && typeof v === 'object') for (const [id, s] of Object.entries(v)) {
      if (s && ['pick', 'ban', 'played'].includes(s.st)) out[id] = { st: s.st, by: [0, 1, -1].includes(s.by) ? s.by : -1 };
    }
    return out;
  }

  function load() {
    try { return sanitize(JSON.parse(localStorage.getItem(STORE_KEY) || 'null')); } catch (e) { return sanitize(null); }
  }
  function save(D) {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(D)); return true; } catch (e) { return false; }
  }

  // テキストから曲を読み込む：1行に1曲。「曲名 / アーティスト / 難易度」（/ のほか、タブ・「,」でも区切れる）
  function parseText(text) {
    return String(text || '').split(/\r?\n/).map(l => l.trim()).filter(Boolean).map((line, i) => {
      const parts = (line.includes('\t') ? line.split('\t') : line.includes(' / ') ? line.split(' / ') : line.split(/\s*[,，]\s*/)).map(x => x.trim());
      return { id: 's' + Date.now().toString(36) + i, t: parts[0] || '', a: parts[1] || '', lv: parts.slice(2).join(' ') || '', img: '' };
    });
  }

  // 表示・ルーレットに使う状態：この試合の状態＋（使い回しなしなら）ほかの試合でピックされた曲を使用済みに
  function stateOf(D) {
    if (!D.noReuse) return D.state;
    const out = {};
    for (const [mid, p] of Object.entries(D.per)) {
      if (mid === D.cur) continue;
      for (const id of p.order) out[id] = { st: 'played', by: -1, other: true };
    }
    return { ...out, ...D.state };
  }
  // まだ選べる曲（BAN・ピック・演奏済みになっていない曲）
  const available = D => { const st = stateOf(D); return D.list.filter(x => !st[x.id]); };

  // 選曲する試合を切り替える（今の試合の分は per にしまい、切り替え先の分を出す）
  function switchMatch(D, mid) {
    if (D.cur === mid) return false;
    recordHistory(D);
    D.cur = mid || null;
    const p = mid && D.per[mid];
    D.state = p ? JSON.parse(JSON.stringify(p.state)) : {};
    D.order = p ? [...p.order] : [];
    return true;
  }

  // 状態を付ける（同じものをもう一度付けたら外す）。ピックしたら order の最後に入れる
  function setState(D, id, st, by) {
    const cur = D.state[id];
    D.order = D.order.filter(x => x !== id);
    if (!st || (cur && cur.st === st && cur.by === by)) { delete D.state[id]; return false; }
    D.state[id] = { st, by };
    if (st === 'pick') D.order.push(id);
    return true;
  }
  // ルーレット：残りからランダムに1曲選んで、ピック（ランダム）にする
  function roulette(D) {
    const list = available(D);
    if (!list.length) return null;
    const x = list[Math.floor(Math.random() * list.length)];
    setState(D, x.id, 'pick', -1);
    D.roulette = { at: Date.now(), id: x.id };
    return x;
  }
  // この試合の選曲を外す（all = すべての試合の選曲も消す）
  function resetState(D, all) {
    D.state = {};
    D.order = [];
    if (all) D.per = {};
    else if (D.cur) delete D.per[D.cur];
  }
  // この試合の選曲を per にしまう
  function recordHistory(D) {
    if (!D.cur) return;
    if (!Object.keys(D.state).length) { delete D.per[D.cur]; return; }
    D.per[D.cur] = { state: JSON.parse(JSON.stringify(D.state)), order: [...D.order] };
  }
  // 曲ごとに、ほかの試合でピックされた回数（この試合は除く）
  function usage(D) {
    const n = {};
    for (const [mid, p] of Object.entries(D.per)) {
      if (mid === D.cur) continue;
      for (const id of p.order) n[id] = (n[id] || 0) + 1;
    }
    return n;
  }
  // トーナメント表＋課題曲の表示用：試合ごとの曲名（選曲がなければ、試合の結果に入っている曲名）
  function songLines(D, T) {
    const map = {};
    const per = { ...D.per };
    if (D.cur) per[D.cur] = { state: D.state, order: D.order };
    for (const [mid, p] of Object.entries(per)) if (p.order.length) map[mid] = p.order.map(id => ({ t: D.list.find(s => s.id === id)?.t || '' }));
    for (const [mid, r] of Object.entries(T?.results || {})) {
      if (map[mid] || !Array.isArray(r?.songs)) continue;
      const ts = r.songs.map(x => String(x?.t || '')).filter(Boolean);
      if (ts.length) map[mid] = ts.map(t => ({ t }));
    }
    return map;
  }

  // 選曲している試合（id がなければ、トーナメントの配信中・次の試合）
  function matchInfo(T, id) {
    if (!K || !T) return null;
    const B = K.build(T);
    if (B.error) return null;
    const m = (id && K.findMatch(B, id)) || (id ? null : K.currentMatch(T, B));
    if (!m) return null;
    return { m, B, names: [m.a, m.b].map((id, i) => m.sub?.[i] && !T.teamMode ? m.sub[i] : K.nameOf(B, id)), round: K.matchRoundName(B, m) };
  }

  // ---------------------------------------------------------------
  //  表示
  // ---------------------------------------------------------------
  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const px = n => `${Math.round(n * 100) / 100}px`;

  // カードの並べ方：横長のカード（幅 = 高さ×ratio）を、いちばん大きく入る列数で並べる
  function gridLayout(n, w, h, gap) {
    const ratio = 3.2;
    let best = { cols: 1, ch: 0 };
    for (let cols = 1; cols <= Math.max(1, n); cols++) {
      const rows = Math.ceil(n / cols);
      const ch = Math.min(170, (h - gap * (rows - 1)) / rows, ((w - gap * (cols - 1)) / cols) / ratio);
      if (ch > best.ch + 0.5) best = { cols, ch };
    }
    // 曲が少ないときは横に広げすぎない（高さの5倍まで）
    const cw = Math.min((w - gap * (best.cols - 1)) / best.cols, best.ch * 5);
    return { cols: best.cols, ch: best.ch, cw, rows: Math.ceil(n / best.cols) };
  }

  // opts.hide = この曲だけ「まだ選ばれていない」ように見せる（ルーレットの演出中）
  function render(D, T, S, size, opts = {}) {
    const W = size?.w || 1920, H = size?.h || 1080;
    const pad = S.pad;
    const info = D.showVs ? matchInfo(T, D.cur) : null;
    const states = stateOf(D);
    let head = '', headH = 0;
    if (D.title || info) {
      headH = (D.title ? S.titleSize * 1.3 : 0) + (info ? S.subtitleSize * 1.9 : 0) + 16;
      head = `<div class="sg-head" style="top:${px(pad)};height:${px(headH)}">`
        + (D.title ? `<div class="tn-title">${esc(D.title)}</div>` : '')
        + (info ? `<div class="sg-vs"><span class="sg-vs-a">${esc(info.names[0])}</span><span class="sg-vs-x">${esc(info.round)}</span><span class="sg-vs-b">${esc(info.names[1])}</span></div>` : '')
        + '</div>';
    }
    const list = D.list.filter(x => !(D.hideBanned && states[x.id]?.st === 'ban' && x.id !== opts.hide));
    if (!list.length) return head + '<div class="tn-empty">課題曲を入れてください</div>';
    const top = pad + headH + (headH ? 18 : 0);
    const gap = 14;
    const area = { w: W - pad * 2, h: H - pad - top };
    const L = gridLayout(list.length, area.w, area.h, gap);
    const gridW = L.cw * L.cols + gap * (L.cols - 1);
    const gridH = L.ch * L.rows + gap * (L.rows - 1);
    const who = by => (by === -1 ? 'ランダム' : info ? info.names[by] : by === 0 ? '左' : '右');
    let html = head + `<div class="sg-grid" style="left:${px(pad + (area.w - gridW) / 2)};top:${px(top + Math.max(0, (area.h - gridH) / 2))};width:${px(gridW)};grid-template-columns:repeat(${L.cols}, 1fr);--ch:${px(L.ch)}">`;
    list.forEach((x) => {
      const s = x.id === opts.hide ? null : states[x.id];
      const cls = ['sg-card', s ? 'st-' + s.st : 'st-none'];
      if (s && s.by >= 0) cls.push('by' + s.by);
      if (s && s.by === -1) cls.push('byr');
      const no = D.list.indexOf(x) + 1;
      const badge = !s ? '' : s.st === 'ban' ? `<span class="sg-badge">BAN${s.by >= 0 ? `<small>${esc(who(s.by))}</small>` : ''}</span>`
        : s.st === 'pick' ? `<span class="sg-badge">${esc(who(s.by))}<small>PICK${D.order.includes(x.id) ? ` ${D.order.indexOf(x.id) + 1}曲目` : ''}</small></span>`
          : `<span class="sg-badge">${s.other ? '使用済み' : '演奏済み'}</span>`;
      html += `<div class="${cls.join(' ')}" data-song="${esc(x.id)}">`
        + `<div class="sg-jk"${x.img ? ` style="background-image:url('${x.img}')"` : ''}>${x.img ? '' : `<span>${no}</span>`}</div>`
        + `<div class="sg-info"><div class="sg-t">${esc(x.t || '（曲名なし）')}</div>`
        + (D.showArtist && x.a ? `<div class="sg-a">${esc(x.a)}</div>` : '')
        + (D.showLevel && x.lv ? `<div class="sg-lv">${esc(x.lv)}</div>` : '')
        + '</div>' + badge + (s?.st === 'ban' ? '<span class="sg-x"></span>' : '') + '</div>';
    });
    return html + '</div>';
  }

  function generateCSS(S, D) {
    const rgba = global.ChatCore.hexToRgba;
    const A = D.colorA, Bc = D.colorB;
    const out = [];
    out.push(`.sg-head { position: absolute; left: 0; right: 0; text-align: center; }`);
    out.push(`.sg-vs { display: flex; justify-content: center; align-items: center; gap: 0.8em; font-size: ${px(S.subtitleSize * 1.25)}; font-weight: 900; margin-top: 4px; }`);
    out.push(`.sg-vs-a { color: ${A}; } .sg-vs-b { color: ${Bc}; }`);
    out.push(`.sg-vs-x { font-size: 0.7em; color: ${S.subText}; padding: 0.15em 0.8em; border: 1px solid ${rgba(S.boxBorder, 0.9)}; border-radius: 999px; }`);
    out.push(`.sg-grid { position: absolute; display: grid; gap: 14px; }`);
    out.push(`.sg-card { position: relative; display: flex; align-items: stretch; height: var(--ch); background: ${rgba(S.boxBg, S.boxAlpha)}; border: 2px solid ${S.boxBorder}; border-radius: ${px(S.radius + 2)}; overflow: hidden; box-sizing: border-box; transition: opacity 0.3s, box-shadow 0.3s, border-color 0.3s; }`);
    out.push(`.sg-jk { flex: none; width: calc(var(--ch) - 4px); height: 100%; background: ${rgba(S.boxBorder, 0.6)} center / cover no-repeat; display: flex; align-items: center; justify-content: center; font-size: calc(var(--ch) * 0.34); font-weight: 900; color: ${S.subText}; }`);
    out.push(`.sg-info { flex: 1; min-width: 0; display: flex; flex-direction: column; justify-content: center; gap: calc(var(--ch) * 0.03); padding: 0 calc(var(--ch) * 0.14); }`);
    out.push(`.sg-t { font-size: calc(var(--ch) * 0.24); font-weight: 900; line-height: 1.25; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }`);
    out.push(`.sg-a { font-size: calc(var(--ch) * 0.15); color: ${S.subText}; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }`);
    out.push(`.sg-lv { align-self: flex-start; font-size: calc(var(--ch) * 0.13); font-weight: 900; padding: 0.1em 0.7em; border-radius: 999px; background: ${rgba(S.accent, 0.2)}; color: ${S.text}; border: 1px solid ${rgba(S.accent, 0.6)}; }`);
    out.push(`.sg-badge { position: absolute; top: 0; right: 0; display: flex; flex-direction: column; align-items: center; line-height: 1.1; padding: 0.3em 0.9em; font-size: calc(var(--ch) * 0.17); font-weight: 900; color: #fff; border-bottom-left-radius: ${px(S.radius + 2)}; text-shadow: none; max-width: 60%; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }`);
    out.push(`.sg-badge small { font-size: 0.72em; opacity: 0.95; }`);
    out.push(`.sg-card.st-pick.by0 { border-color: ${A}; box-shadow: 0 0 0 2px ${A}, 0 0 24px ${rgba(A, 0.55)}; } .sg-card.st-pick.by0 .sg-badge { background: ${A}; }`);
    out.push(`.sg-card.st-pick.by1 { border-color: ${Bc}; box-shadow: 0 0 0 2px ${Bc}, 0 0 24px ${rgba(Bc, 0.55)}; } .sg-card.st-pick.by1 .sg-badge { background: ${Bc}; }`);
    out.push(`.sg-card.st-pick.byr { border-color: #ffd54a; box-shadow: 0 0 0 2px #ffd54a, 0 0 24px rgba(255, 213, 74, 0.55); } .sg-card.st-pick.byr .sg-badge { background: #d9a400; }`);
    out.push(`.sg-card.st-ban { opacity: 0.4; } .sg-card.st-ban .sg-jk { filter: grayscale(1); } .sg-card.st-ban .sg-badge { background: #d33b3b; }`);
    out.push(`.sg-x { position: absolute; inset: 0; pointer-events: none; background: linear-gradient(to top right, transparent calc(50% - 2px), rgba(211, 59, 59, 0.85) calc(50% - 2px), rgba(211, 59, 59, 0.85) calc(50% + 2px), transparent calc(50% + 2px)); }`);
    out.push(`.sg-card.st-played { opacity: 0.45; } .sg-card.st-played .sg-badge { background: #6b6b78; }`);
    // ルーレット
    out.push(`.sg-card.spin { border-color: #fff; box-shadow: 0 0 0 3px #fff, 0 0 30px rgba(255, 255, 255, 0.7); transform: scale(1.03); transition: none; }`);
    out.push(`.sg-card.hit { animation: sg-hit 0.9s ease-out; }`);
    out.push('@keyframes sg-hit { 0% { transform: scale(1.12); } 100% { transform: scale(1); } }');
    out.push(`.sg-pop { position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%); min-width: 900px; max-width: 1500px; padding: 30px 56px; text-align: center; background: ${rgba(S.boxBg, 0.97)}; border: 3px solid #ffd54a; border-radius: ${px(S.radius * 2)}; box-shadow: 0 0 60px rgba(255, 213, 74, 0.45); z-index: 10; transition: opacity 0.5s; }`);
    out.push(`.sg-pop-label { font-size: 30px; color: #ffd54a; letter-spacing: 0.3em; }`);
    out.push(`.sg-pop-t { font-size: 84px; font-weight: 900; line-height: 1.3; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }`);
    out.push(`.sg-pop-a { font-size: 34px; color: ${S.subText}; }`);
    out.push(`.sg-pop.done { opacity: 0; }`);
    return out.join('\n') + '\n';
  }

  global.TournamentSongs = { STORE_KEY, DEFAULT_D, sanitize, load, save, parseText, available, stateOf, switchMatch, setState, roulette, resetState, recordHistory, usage, songLines, matchInfo, render, generateCSS, esc };
})(window);
