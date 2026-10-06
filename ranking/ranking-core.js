/*
 * スコアアタック集計：順位の計算と、canvas への描画（index.html の見本・画像と、OBS 用の view.html で使う）
 *
 *   RankingCore.defaults() / normalize(data)
 *   RankingCore.compute(data)              → { rows（順位の順）, songTop（曲ごとのいちばん良い値）, played, total }
 *   RankingCore.draw(canvas, data, opts)   → { pages }。opts = { page: 0〜, flash: 参加者 id（光らせる） }
 *   RankingCore.load() / save(data)        localStorage（STORE_KEY）
 *
 * kind:   'score'（点数。高いほど上）/ 'time'（タイム。短いほど上）
 * method: 'sum'（合計）/ 'rank'（曲ごとの順位の合計。小さいほど上）/ 'ratio'（理論値に対する割合の平均。点数だけ）
 */
(function (global) {
  'use strict';

  const STORE_KEY = 'donnma-ranking-v1';
  const SIZES = {
    wide: { w: 1920, h: 1080, name: '横長 16:9' },
    tall: { w: 1080, h: 1350, name: '縦長 4:5' },
  };
  const THEMES = {
    pop: { name: 'ポップ', accent: '#ff7aa2', font: 'Zen Maru Gothic', title: 'Zen Maru Gothic', tw: 900, bw: 700 },
    simple: { name: 'シンプル', accent: '#2f6fed', font: 'Zen Kaku Gothic New', title: 'Zen Kaku Gothic New', tw: 900, bw: 700 },
    neon: { name: 'ネオン', accent: '#39e1ff', font: 'Zen Kaku Gothic New', title: 'Dela Gothic One', tw: 400, bw: 700 },
    wa: { name: '和風', accent: '#c8473a', font: 'Shippori Mincho B1', title: 'Shippori Mincho B1', tw: 800, bw: 800 },
  };
  const METHODS = { sum: '合計', rank: '順位の合計', ratio: '理論値比' };

  let idSeq = Date.now() % 100000;
  const newId = () => 'p' + (idSeq++).toString(36);

  function defaults() {
    return {
      v: 1,
      title: 'SCORE ATTACK',
      sub: '',
      note: '',
      kind: 'score',
      method: 'sum',
      pass: 8,
      songs: [{ name: '課題曲1', max: '' }, { name: '課題曲2', max: '' }, { name: '課題曲3', max: '' }],
      players: [],
      theme: 'pop',
      accent: '',
      size: 'wide',
      bg: 'theme',
      songRank: true,
      last: { id: '', at: 0 },
    };
  }

  const str = (v, max) => (typeof v === 'string' ? v : v == null ? '' : String(v)).slice(0, max);
  function normalize(src) {
    const d = defaults();
    if (!src || typeof src !== 'object') return d;
    const out = { ...d };
    for (const k of ['title', 'sub', 'note']) if (typeof src[k] === 'string') out[k] = str(src[k], 80);
    out.kind = src.kind === 'time' ? 'time' : 'score';
    out.method = METHODS[src.method] ? src.method : 'sum';
    if (out.kind === 'time' && out.method === 'ratio') out.method = 'sum';
    const pass = Number(src.pass);
    out.pass = pass >= 0 && pass <= 999 ? Math.floor(pass) : d.pass;
    if (Array.isArray(src.songs)) {
      out.songs = src.songs.slice(0, 20).map(s => ({ name: str(s && s.name, 40), max: str(s && s.max, 20) }));
      if (!out.songs.length) out.songs = [{ name: '課題曲1', max: '' }];
    }
    if (Array.isArray(src.players)) {
      out.players = src.players.slice(0, 300).map(p => ({
        id: typeof (p && p.id) === 'string' && p.id ? p.id.slice(0, 20) : newId(),
        name: str(p && p.name, 40),
        scores: out.songs.map((_, i) => str(p && Array.isArray(p.scores) ? p.scores[i] : '', 20)),
      }));
    }
    out.theme = THEMES[src.theme] ? src.theme : 'pop';
    out.accent = /^#[0-9a-f]{6}$/i.test(src.accent || '') ? src.accent : '';
    out.size = SIZES[src.size] ? src.size : 'wide';
    out.bg = src.bg === 'transparent' ? 'transparent' : 'theme';
    out.songRank = src.songRank !== false;
    out.last = src.last && typeof src.last === 'object' ? { id: str(src.last.id, 20), at: Number(src.last.at) || 0 } : { id: '', at: 0 };
    return out;
  }

  const load = () => { try { return normalize(JSON.parse(localStorage.getItem(STORE_KEY) || 'null')); } catch (e) { return defaults(); } };
  const save = data => { try { localStorage.setItem(STORE_KEY, JSON.stringify(data)); return true; } catch (e) { return false; } };

  // ── 値 ──
  const toHalf = s => String(s).replace(/[０-９．：，]/g, c => String.fromCharCode(c.charCodeAt(0) - 0xFEE0));
  // 点数：「1,000,000」「998 500」→ 数。タイム：「1:23.45」「83.45」「1'23"45」→ 秒
  function parseVal(s, kind) {
    const t = toHalf(s).trim();
    if (!t) return null;
    if (kind === 'time') {
      let m = /^(\d+):(\d{1,2}):(\d{1,2}(?:\.\d+)?)$/.exec(t);
      if (m) return +m[1] * 3600 + +m[2] * 60 + +m[3];
      m = /^(\d+)[:'′](\d{1,2})(?:["″.](\d+))?$/.exec(t);
      if (m) return +m[1] * 60 + +m[2] + (m[3] ? +('0.' + m[3]) : 0);
      m = /^\d+(?:\.\d+)?$/.exec(t);
      return m ? +t : null;
    }
    const n = t.replace(/[,\s]/g, '');
    return /^-?\d+(?:\.\d+)?$/.test(n) ? +n : null;
  }
  const fmtNum = n => (Number.isInteger(n) ? n.toLocaleString('en-US') : n.toLocaleString('en-US', { maximumFractionDigits: 2 }));
  function fmtTime(sec) {
    const neg = sec < 0; sec = Math.abs(sec);
    const h = Math.floor(sec / 3600), m = Math.floor(sec % 3600 / 60), s = sec % 60;
    const ss = (Math.round(s * 100) / 100).toFixed(2).padStart(5, '0');
    return (neg ? '-' : '') + (h ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`);
  }
  const fmtVal = (v, kind) => (v == null ? '—' : kind === 'time' ? fmtTime(v) : fmtNum(v));

  // ── 順位の計算 ──
  // 同じ値は同じ順位（1, 2, 2, 4）
  const rankOf = (vals, better) => {
    const sorted = vals.filter(v => v != null).sort((a, b) => (better(a, b) ? -1 : better(b, a) ? 1 : 0));
    return vals.map(v => (v == null ? null : 1 + sorted.findIndex(x => x === v)));
  };

  function compute(data) {
    const kind = data.kind;
    const higher = kind === 'score';
    const better = (a, b) => (higher ? a > b : a < b);
    const nP = data.players.length;
    const vals = data.players.map(p => data.songs.map((_, i) => parseVal(p.scores[i], kind)));
    const songRanks = data.songs.map((_, i) => rankOf(vals.map(v => v[i]), better));
    const songTop = data.songs.map((_, i) => {
      const xs = vals.map(v => v[i]).filter(v => v != null);
      return xs.length ? (higher ? Math.max(...xs) : Math.min(...xs)) : null;
    });
    const rows = data.players.map((p, pi) => {
      const v = vals[pi];
      const played = v.filter(x => x != null).length;
      const ranks = data.songs.map((_, i) => songRanks[i][pi]);
      const firsts = ranks.filter(r => r === 1).length;
      let total, key, show;
      if (data.method === 'rank') {
        // やっていない曲は最下位（参加者の数）
        total = ranks.reduce((n, r) => n + (r == null ? nP : r), 0);
        key = total; show = `${total}`;
      } else if (data.method === 'ratio') {
        const rs = data.songs.map((s, i) => {
          if (v[i] == null) return 0;
          const max = parseVal(s.max, 'score') || songTop[i] || 0;
          return max > 0 ? v[i] / max * 100 : 0;
        });
        total = rs.reduce((n, x) => n + x, 0) / Math.max(1, data.songs.length);
        key = -total; show = total.toFixed(2) + '%';
      } else if (kind === 'time') {
        total = v.reduce((n, x) => n + (x == null ? 0 : x), 0);
        // 全部やった人を先に（途中の人は、やった曲の数が多い順）
        key = (data.songs.length - played) * 1e9 + total; show = played ? fmtTime(total) : '—';
      } else {
        total = v.reduce((n, x) => n + (x == null ? 0 : x), 0);
        key = -total; show = played ? fmtNum(total) : '—';
      }
      return { p, pi, vals: v, ranks, played, firsts, total, key, show };
    });
    // 並べる：決め方の値 → 1位の数 → まだの人は後ろ → 入れた順
    rows.sort((a, b) => (a.played ? 0 : 1) - (b.played ? 0 : 1) || a.key - b.key || b.firsts - a.firsts || a.pi - b.pi);
    rows.forEach((r, i) => {
      const prev = rows[i - 1];
      r.rank = !r.played ? null : prev && prev.played && Math.abs(prev.key - r.key) < 1e-9 ? prev.rank : i + 1;
    });
    return { rows, songTop, played: rows.filter(r => r.played).length, total: nP };
  }

  // ── 描く道具（配信スケジュールメーカーと同じ） ──
  const hexToRgb = hex => { const n = parseInt(hex.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
  const rgba = (hex, a) => { const [r, g, b] = hexToRgb(hex); return `rgba(${r}, ${g}, ${b}, ${a})`; };
  const mix = (hex, to, t) => { const a = hexToRgb(hex), b = hexToRgb(to); return '#' + a.map((v, i) => Math.round(v + (b[i] - v) * t).toString(16).padStart(2, '0')).join(''); };
  const rr = (ctx, x, y, w, h, r) => {
    r = Math.max(0, Math.min(r, w / 2, h / 2));
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  };
  const fit = (ctx, text, maxW, size, font, min = 0.6) => {
    let s = size;
    ctx.font = font(s);
    while (ctx.measureText(text).width > maxW && s > size * min) { s -= Math.max(0.5, size * 0.04); ctx.font = font(s); }
    if (ctx.measureText(text).width <= maxW) return { text, size: s };
    let t = text;
    while (t.length > 1 && ctx.measureText(t + '…').width > maxW) t = t.slice(0, -1);
    return { text: t + '…', size: s };
  };
  function palette(theme, a) {
    switch (theme) {
      case 'simple': return { bg: '#f4f5f7', text: '#1f2328', muted: '#8a9099', card: '#ffffff', line: '#e3e5e8', title: '#1f2328', head: '#eef0f3' };
      case 'neon': return { bg: '#0b0f24', text: '#eef2ff', muted: '#8b93b8', card: 'rgba(255,255,255,0.06)', line: rgba(a, 0.3), title: '#ffffff', head: rgba(a, 0.14) };
      case 'wa': return { bg: '#f3ead8', text: '#3b2a1e', muted: '#9a876c', card: 'rgba(255,255,255,0.55)', line: '#d8c7a6', title: '#3b2a1e', head: rgba(a, 0.12) };
      default: return { bg: '#fff6ee', text: '#4b3742', muted: '#a8939d', card: '#ffffff', line: mix(a, '#ffffff', 0.78), title: a, head: mix(a, '#ffffff', 0.85) };
    }
  }
  function drawBg(ctx, data, W, H, u, P, A) {
    if (data.bg === 'transparent') return;
    ctx.fillStyle = P.bg; ctx.fillRect(0, 0, W, H);
    if (data.theme === 'pop') {
      ctx.fillStyle = rgba(A, 0.1);
      const step = 64 * u;
      for (let y = 0, row = 0; y < H + step; y += step * 0.87, row++) {
        for (let x = (row % 2) * step / 2; x < W + step; x += step) { ctx.beginPath(); ctx.arc(x, y, 7 * u, 0, Math.PI * 2); ctx.fill(); }
      }
    } else if (data.theme === 'neon') {
      const g = ctx.createLinearGradient(0, 0, W, H);
      g.addColorStop(0, '#0b0f24'); g.addColorStop(1, '#1d0b33');
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      ctx.strokeStyle = rgba(A, 0.08); ctx.lineWidth = 1.5 * u;
      const step = 60 * u;
      ctx.beginPath();
      for (let x = 0; x < W; x += step) { ctx.moveTo(x, 0); ctx.lineTo(x, H); }
      for (let y = 0; y < H; y += step) { ctx.moveTo(0, y); ctx.lineTo(W, y); }
      ctx.stroke();
    } else if (data.theme === 'wa') {
      ctx.strokeStyle = 'rgba(160, 130, 90, 0.07)'; ctx.lineWidth = 2 * u;
      ctx.beginPath();
      for (let y = 0; y < H; y += 14 * u) { ctx.moveTo(0, y); ctx.lineTo(W, y + 6 * u); }
      ctx.stroke();
      ctx.fillStyle = rgba(A, 0.9);
      ctx.fillRect(0, 0, W, 10 * u); ctx.fillRect(0, H - 10 * u, W, 10 * u);
    } else {
      ctx.fillStyle = A; ctx.fillRect(0, 0, W, 12 * u);
    }
  }

  async function ensureFonts(data) {
    if (!document.fonts || !document.fonts.load) return;
    const th = THEMES[data.theme];
    const text = [data.title, data.sub, data.note, '0123456789,.:%—位曲合計順理論値比本戦へ進出人中プレイ済みNEW', ...data.songs.map(s => s.name), ...data.players.map(p => p.name)].join('');
    try {
      await Promise.race([
        Promise.all([`${th.tw} 40px "${th.title}"`, `${th.bw} 40px "${th.font}"`].map(f => document.fonts.load(f, text))),
        new Promise(r => setTimeout(r, 4000)),
      ]);
    } catch (e) { }
  }

  const MEDAL = ['#f2b705', '#a9b4c2', '#c98a4b'];

  // ── 描く ──
  function draw(canvas, raw, opts = {}) {
    const data = normalize(raw);
    const size = SIZES[data.size];
    const W = size.w, H = size.h;
    if (canvas.width !== W) canvas.width = W;
    if (canvas.height !== H) canvas.height = H;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, W, H);
    const th = THEMES[data.theme];
    const A = data.accent || th.accent;
    const P = palette(data.theme, A);
    const u = Math.min(W, H) / 1080;
    const F = (w, fam) => s => `${w} ${s}px "${fam}", "Zen Maru Gothic", "Hiragino Sans", "Meiryo", sans-serif`;
    const fTitle = F(th.tw, th.title), fBold = F(th.bw, th.font);
    ctx.textBaseline = 'middle';
    drawBg(ctx, data, W, H, u, P, A);

    const C = compute(data);
    const wide = data.size === 'wide';
    const pad = (wide ? 64 : 52) * u;
    const x0 = pad, listW = W - pad * 2;

    // 見出し
    const titleSize = (wide ? 80 : 70) * u;
    const top0 = pad + (data.theme === 'wa' || data.theme === 'simple' ? 8 * u : 0);
    const tf = fit(ctx, data.title || ' ', listW * 0.7, titleSize, fTitle, 0.5);
    ctx.font = fTitle(tf.size);
    ctx.textAlign = 'left';
    const ty = top0 + titleSize * 0.5;
    if (data.theme === 'pop') {
      ctx.lineJoin = 'round'; ctx.lineWidth = 12 * u; ctx.strokeStyle = '#ffffff';
      ctx.strokeText(tf.text, x0, ty);
      ctx.fillStyle = P.title; ctx.fillText(tf.text, x0, ty);
    } else if (data.theme === 'neon') {
      ctx.save(); ctx.shadowColor = A; ctx.shadowBlur = 24 * u; ctx.fillStyle = P.title; ctx.fillText(tf.text, x0, ty); ctx.restore();
    } else { ctx.fillStyle = P.title; ctx.fillText(tf.text, x0, ty); }
    const sy = top0 + titleSize + 30 * u;
    // 右上：プレイ済みの人数・決め方
    ctx.textAlign = 'right';
    ctx.font = fBold(28 * u);
    ctx.fillStyle = data.theme === 'neon' ? A : P.muted;
    const info = `${C.played} / ${C.total} 人プレイ済み　${METHODS[data.method]}で順位`;
    const iw = Math.min(ctx.measureText(info).width, listW * 0.55);
    ctx.fillText(fit(ctx, info, listW * 0.55, 28 * u, fBold).text, x0 + listW, sy);
    if (data.sub) {
      ctx.textAlign = 'left';
      const sf = fit(ctx, data.sub, listW - iw - 30 * u, 32 * u, fBold);
      ctx.font = fBold(sf.size); ctx.fillStyle = P.text;
      ctx.fillText(sf.text, x0, sy);
    }

    // お知らせ
    const nh = data.note ? 60 * u : 0;
    if (data.note) {
      const ny = H - pad - nh / 2 + 8 * u;
      ctx.textAlign = 'left';
      ctx.font = fBold(28 * u);
      const mw = ctx.measureText('★ ').width;
      ctx.fillStyle = A; ctx.fillText('★ ', x0, ny);
      const nf = fit(ctx, data.note, listW - mw, 28 * u, fBold);
      ctx.font = fBold(nf.size); ctx.fillStyle = P.text; ctx.fillText(nf.text, x0 + mw, ny);
    }

    // 表
    const top = sy + 40 * u;
    const bottom = H - pad - nh;
    const headH = 52 * u;
    const gap = 6 * u;
    const nS = data.songs.length;
    const rankW = 96 * u;
    const totalW = (data.method === 'ratio' ? 190 : data.kind === 'time' ? 200 : 220) * u;
    const nameW = Math.max(220 * u, Math.min(420 * u, listW * (wide ? 0.24 : 0.3)));
    const songW = nS ? (listW - rankW - nameW - totalW) / nS : 0;
    const minRow = 40 * u, maxRow = 72 * u;
    // 本戦ラインのところは、文字を入れるすき間をあける
    const passGap = data.pass > 0 && data.pass < C.rows.filter(r => r.rank != null).length ? 34 * u : 0;
    const avail = bottom - top - headH - gap - passGap;
    let rowH = Math.min(maxRow, Math.max(minRow, avail / Math.max(1, C.rows.length) - gap));
    const perPage = Math.max(1, Math.floor((avail + gap) / (rowH + gap)));
    const pages = Math.max(1, Math.ceil(C.rows.length / perPage));
    const page = Math.min(Math.max(0, opts.page || 0), pages - 1);
    const rows = C.rows.slice(page * perPage, page * perPage + perPage);
    if (C.rows.length <= perPage) rowH = Math.min(maxRow, avail / Math.max(1, C.rows.length) - gap);
    const radius = { pop: 14 * u, simple: 8 * u, neon: 6 * u, wa: 3 * u }[data.theme];
    const showSong = songW >= 70 * u;

    // 見出しの行
    rr(ctx, x0, top, listW, headH, radius);
    ctx.fillStyle = data.theme === 'pop' ? A : P.head; ctx.fill();
    const hc = data.theme === 'pop' ? '#ffffff' : (data.theme === 'neon' ? A : P.text);
    ctx.fillStyle = hc;
    const hs = 22 * u;
    ctx.textAlign = 'center';
    ctx.font = fBold(hs);
    ctx.fillText('順位', x0 + rankW / 2, top + headH / 2);
    ctx.textAlign = 'left';
    ctx.fillText('名前', x0 + rankW + 12 * u, top + headH / 2);
    if (showSong) {
      data.songs.forEach((s, i) => {
        const cx = x0 + rankW + nameW + songW * i + songW / 2;
        ctx.textAlign = 'center';
        const f = fit(ctx, s.name || `${i + 1}曲目`, songW - 14 * u, hs, fBold, 0.55);
        ctx.font = fBold(f.size); ctx.fillStyle = hc;
        ctx.fillText(f.text, cx, top + headH / 2);
      });
    } else if (nS) {
      ctx.textAlign = 'center'; ctx.font = fBold(hs * 0.8);
      ctx.fillText(`${nS}曲`, x0 + rankW + nameW + songW * nS / 2, top + headH / 2);
    }
    ctx.textAlign = 'center'; ctx.font = fBold(hs); ctx.fillStyle = hc;
    ctx.fillText(METHODS[data.method], x0 + listW - totalW / 2, top + headH / 2);

    if (!C.rows.length) {
      ctx.textAlign = 'left'; ctx.font = fBold(30 * u); ctx.fillStyle = P.muted;
      ctx.fillText('まだ参加者がいません', x0 + 16 * u, top + headH + 50 * u);
      return { pages: 1, page: 0, perPage };
    }

    const isPass = r => data.pass > 0 && r && r.rank != null && r.rank <= data.pass;
    let yCur = top + headH + gap;
    let lineY = null;
    rows.forEach((r, k) => {
      const y = yCur;
      yCur += rowH + gap;
      if (passGap && isPass(r) && !isPass(rows[k + 1]) && rows[k + 1]) { lineY = yCur - gap / 2 + passGap / 2; yCur += passGap; }
      const cy = y + rowH / 2;
      const passed = data.pass > 0 && r.rank != null && r.rank <= data.pass;
      const flash = opts.flash && opts.flash === r.p.id;
      ctx.save();
      if (!r.played) ctx.globalAlpha = 0.55;
      rr(ctx, x0, y, listW, rowH, radius);
      if (data.theme === 'pop') {
        ctx.save(); ctx.shadowColor = 'rgba(120, 60, 90, 0.1)'; ctx.shadowBlur = 8 * u; ctx.shadowOffsetY = 2 * u;
        ctx.fillStyle = P.card; ctx.fill(); ctx.restore();
      } else { ctx.fillStyle = P.card; ctx.fill(); ctx.strokeStyle = P.line; ctx.lineWidth = 1.5 * u; ctx.stroke(); }
      if (passed) {
        ctx.save(); rr(ctx, x0, y, listW, rowH, radius); ctx.clip();
        ctx.fillStyle = rgba(A, data.theme === 'neon' ? 0.16 : 0.1); ctx.fillRect(x0, y, listW, rowH);
        ctx.fillStyle = A; ctx.fillRect(x0, y, 6 * u, rowH);
        ctx.restore();
      }
      if (flash) {
        ctx.save(); rr(ctx, x0, y, listW, rowH, radius);
        ctx.strokeStyle = A; ctx.lineWidth = 5 * u; ctx.shadowColor = A; ctx.shadowBlur = 18 * u; ctx.stroke(); ctx.restore();
      }
      // 順位
      const rs = Math.min(rowH * 0.5, 34 * u);
      if (r.rank != null && r.rank <= 3) {
        ctx.beginPath(); ctx.arc(x0 + rankW / 2, cy, rowH * 0.34, 0, Math.PI * 2);
        ctx.fillStyle = MEDAL[r.rank - 1]; ctx.fill();
        ctx.fillStyle = '#ffffff';
      } else ctx.fillStyle = P.text;
      ctx.textAlign = 'center'; ctx.font = fBold(rs);
      ctx.fillText(r.rank == null ? '—' : String(r.rank), x0 + rankW / 2, cy + 1 * u);
      // 名前
      ctx.textAlign = 'left';
      const nf = fit(ctx, r.p.name || '（名前なし）', nameW - 24 * u - (flash ? 70 * u : 0), Math.min(rowH * 0.44, 34 * u), fBold, 0.55);
      ctx.font = fBold(nf.size); ctx.fillStyle = P.text;
      ctx.fillText(nf.text, x0 + rankW + 12 * u, cy);
      if (flash) {
        const bs = Math.min(rowH * 0.28, 18 * u);
        ctx.font = fBold(bs);
        const bw = ctx.measureText('NEW').width + bs;
        const bx = x0 + rankW + nameW - bw - 10 * u;
        rr(ctx, bx, cy - bs * 0.8, bw, bs * 1.6, bs * 0.8); ctx.fillStyle = A; ctx.fill();
        ctx.fillStyle = data.theme === 'neon' ? '#0b0f24' : '#ffffff'; ctx.textAlign = 'center';
        ctx.fillText('NEW', bx + bw / 2, cy + 1 * u);
      }
      // 曲ごと
      if (showSong) {
        r.vals.forEach((v, i) => {
          const cx = x0 + rankW + nameW + songW * i + songW / 2;
          const top1 = r.ranks[i] === 1;
          const small = data.songRank && v != null && rowH >= 46 * u;
          const vs = Math.min(rowH * (small ? 0.36 : 0.42), 30 * u);
          ctx.textAlign = 'center';
          const f = fit(ctx, fmtVal(v, data.kind), songW - 16 * u, vs, fBold, 0.55);
          ctx.font = fBold(f.size);
          ctx.fillStyle = v == null ? P.muted : top1 ? A : P.text;
          ctx.fillText(f.text, cx, small ? cy - rowH * 0.13 : cy);
          if (small) {
            ctx.font = fBold(Math.min(rowH * 0.24, 17 * u));
            ctx.fillStyle = top1 ? A : P.muted;
            ctx.fillText(top1 ? '★ 1位' : `${r.ranks[i]}位`, cx, cy + rowH * 0.24);
          }
        });
      }
      // 合計
      ctx.textAlign = 'right';
      const tsz = Math.min(rowH * 0.46, 36 * u);
      const tf2 = fit(ctx, r.show, totalW - 24 * u, tsz, fBold, 0.55);
      ctx.font = fBold(tf2.size);
      ctx.fillStyle = r.played ? (data.theme === 'pop' || data.theme === 'wa' ? A : P.text) : P.muted;
      if (data.theme === 'neon' && r.played) { ctx.shadowColor = A; ctx.shadowBlur = 10 * u; ctx.fillStyle = A; }
      ctx.fillText(tf2.text, x0 + listW - 18 * u, cy);
      ctx.restore();
    });
    // 本戦ライン（すき間の真ん中に線と文字）
    if (lineY != null) {
      ctx.fillStyle = A;
      ctx.fillRect(x0, lineY - 1.5 * u, listW, 3 * u);
      const label = `▲ ここまで本戦へ（上位 ${data.pass} 人）`;
      ctx.font = fBold(19 * u);
      const lw = ctx.measureText(label).width + 26 * u;
      rr(ctx, x0 + listW / 2 - lw / 2, lineY - 15 * u, lw, 30 * u, 15 * u); ctx.fill();
      ctx.fillStyle = data.theme === 'neon' ? '#0b0f24' : '#ffffff'; ctx.textAlign = 'center';
      ctx.fillText(label, x0 + listW / 2, lineY + 1 * u);
    }
    // ページ
    if (pages > 1) {
      ctx.textAlign = 'right'; ctx.font = fBold(22 * u); ctx.fillStyle = P.muted;
      ctx.fillText(`${page + 1} / ${pages}`, x0 + listW, bottom + (nh ? 0 : 22 * u) - (nh ? 0 : 0) + 4 * u);
    }
    return { pages, page, perPage };
  }

  global.RankingCore = { STORE_KEY, SIZES, THEMES, METHODS, defaults, normalize, load, save, compute, draw, ensureFonts, parseVal, fmtVal, newId };
})(window);
