/*
 * 配信スケジュールの絵を canvas に描く（index.html の見本・画像の保存と、OBS 用の view.html で使う）
 *
 *   ScheduleCore.defaults()                    はじめの中身
 *   ScheduleCore.normalize(data)               足りない値を埋める（URL から読んだものにも使う）
 *   await ScheduleCore.ensureFonts(data)       使う字体を読み込む（canvas は読み込みを待ってくれないので）
 *   ScheduleCore.draw(canvas, data, opts)      描く。opts = { images: { chara, bg }, now: Date（OBS で今日を目立たせるとき） }
 *   ScheduleCore.encode(data) / decode(str)    URL に入れる文字（JSON → UTF-8 → base64url）
 *   ScheduleCore.forUrl(data)                  URL に入れる分だけにする（1か月版は、その月の予定だけ）
 *
 * mode: 'week'（1週間。days[0..6] は start からの7日）/ 'month'（1か月。mdays['YYYY-MM-DD'] にその日の予定）
 */
(function (global) {
  'use strict';

  const SIZES = {
    wide: { w: 1920, h: 1080, name: '横長 16:9' },
    tall: { w: 1080, h: 1350, name: '縦長 4:5' },
    square: { w: 1080, h: 1080, name: '正方形' },
    story: { w: 1080, h: 1920, name: '縦長 9:16' },
  };

  const THEMES = {
    pop: { name: 'ポップ', accent: '#ff7aa2', font: 'Zen Maru Gothic', title: 'Zen Maru Gothic', tw: 900, bw: 700 },
    simple: { name: 'シンプル', accent: '#2f6fed', font: 'Zen Kaku Gothic New', title: 'Zen Kaku Gothic New', tw: 900, bw: 700 },
    neon: { name: 'ネオン', accent: '#39e1ff', font: 'Zen Kaku Gothic New', title: 'Dela Gothic One', tw: 400, bw: 700 },
    wa: { name: '和風', accent: '#c8473a', font: 'Shippori Mincho B1', title: 'Shippori Mincho B1', tw: 800, bw: 800 },
  };

  // よく使う種類と色（ほかの言葉は、言葉から色を決める）
  const TAGS = [
    ['ゲーム', '#4f8dfd'], ['雑談', '#f5a524'], ['歌', '#ef5da8'], ['コラボ', '#8b6cf6'],
    ['企画', '#22b07d'], ['ASMR', '#b56cf0'], ['作業', '#6b8196'], ['告知', '#ef4e4e'],
  ];
  const tagColor = tag => {
    const hit = TAGS.find(t => t[0] === tag);
    if (hit) return hit[1];
    let h = 0;
    for (const ch of tag) h = (h * 31 + ch.codePointAt(0)) % 360;
    return `hsl(${h}, 62%, 52%)`;
  };

  const MONTHS = ['JANUARY', 'FEBRUARY', 'MARCH', 'APRIL', 'MAY', 'JUNE', 'JULY', 'AUGUST', 'SEPTEMBER', 'OCTOBER', 'NOVEMBER', 'DECEMBER'];
  const WD = { ja: ['日', '月', '火', '水', '木', '金', '土'], en: ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'] };

  const pad2 = n => String(n).padStart(2, '0');
  const ymd = d => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
  const parseYmd = s => {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s || '');
    return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null;
  };
  // 今週の初め（月曜はじまり / 日曜はじまり）
  const weekStart = (date, first) => {
    const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    d.setDate(d.getDate() - ((d.getDay() - first + 7) % 7));
    return d;
  };

  function defaults() {
    return {
      v: 1,
      mode: 'week',
      start: ymd(weekStart(new Date(), 1)),
      month: ymd(new Date()).slice(0, 7),
      mdays: {},
      first: 1,
      title: 'WEEKLY SCHEDULE',
      sub: '',
      note: '',
      days: Array.from({ length: 7 }, () => ({ off: false, items: [{ t: '', s: '', tag: '' }] })),
      theme: 'pop',
      accent: '',
      size: 'wide',
      bg: 'theme',
      wd: 'ja',
      tl: true,
      chara: '',
      today: true,
      past: true,
    };
  }

  const str = (v, max) => (typeof v === 'string' ? v : '').slice(0, max);
  // 内容は4行まで
  const lines4 = v => str(v, 200).replace(/\r\n?/g, '\n').split('\n').slice(0, 4).join('\n');
  const normDay = x => {
    if (!x || typeof x !== 'object') return null;
    const items = Array.isArray(x.items) ? x.items.slice(0, 3).map(it => ({
      t: str(it && it.t, 20), s: lines4(it && it.s), tag: str(it && it.tag, 12),
    })) : [];
    return { off: !!x.off, items: items.length ? items : [{ t: '', s: '', tag: '' }] };
  };
  const hasContent = day => !!day && (day.off || day.items.some(it => it.t || it.s || it.tag));
  // URL に入れる分だけ（1週間なら月の予定は要らない。1か月ならその月の予定だけ）
  function forUrl(data) {
    const out = { ...data };
    if (data.mode === 'month') {
      out.mdays = {};
      Object.keys(data.mdays || {}).forEach(k => { if (k.startsWith(data.month + '-') && hasContent(data.mdays[k])) out.mdays[k] = data.mdays[k]; });
      delete out.days;
    } else {
      delete out.mdays;
    }
    return out;
  }
  function normalize(src) {
    const d = defaults();
    if (!src || typeof src !== 'object') return d;
    const out = { ...d };
    if (parseYmd(src.start)) out.start = src.start;
    out.first = src.first === 0 ? 0 : 1;
    for (const k of ['title', 'sub', 'note']) if (typeof src[k] === 'string') out[k] = str(src[k], 120);
    if (Array.isArray(src.days)) out.days = d.days.map((def, i) => normDay(src.days[i]) || def);
    out.mode = src.mode === 'month' ? 'month' : 'week';
    if (/^\d{4}-\d{2}$/.test(src.month || '')) out.month = src.month;
    if (src.mdays && typeof src.mdays === 'object') {
      Object.keys(src.mdays).filter(k => parseYmd(k)).sort().slice(-120).forEach(k => {
        const x = normDay(src.mdays[k]);
        if (x) out.mdays[k] = x;
      });
    }
    if (THEMES[src.theme]) out.theme = src.theme;
    out.accent = /^#[0-9a-f]{6}$/i.test(src.accent || '') ? src.accent : '';
    if (SIZES[src.size]) out.size = src.size;
    if (['theme', 'transparent', 'image'].includes(src.bg)) out.bg = src.bg;
    out.wd = src.wd === 'en' ? 'en' : 'ja';
    out.tl = src.tl !== false;
    out.chara = /^https?:\/\//i.test(src.chara || '') ? str(src.chara, 1000) : '';
    out.today = src.today !== false;
    out.past = src.past !== false;
    return out;
  }

  // ── URL に入れる ──
  function encode(data) {
    const bytes = new TextEncoder().encode(JSON.stringify(data));
    let bin = '';
    bytes.forEach(b => { bin += String.fromCharCode(b); });
    return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }
  function decode(s) {
    try {
      const b64 = s.replace(/-/g, '+').replace(/_/g, '/');
      const bin = atob(b64 + '==='.slice((b64.length + 3) % 4));
      const bytes = Uint8Array.from(bin, c => c.charCodeAt(0));
      return normalize(JSON.parse(new TextDecoder().decode(bytes)));
    } catch (e) { return null; }
  }

  // ── 字体 ──
  function allText(data) {
    const t = [data.title, data.sub, data.note, '0123456789/:-〜ー お休み未定TODAYOFF', ...WD.ja, ...WD.en];
    data.days.forEach(d => d.items.forEach(it => t.push(it.t, it.s, it.tag)));
    Object.values(data.mdays || {}).forEach(d => d.items.forEach(it => t.push(it.t, it.s, it.tag)));
    t.push('年月', ...MONTHS);
    return t.join('');
  }
  async function ensureFonts(data) {
    if (!document.fonts || !document.fonts.load) return;
    const th = THEMES[data.theme];
    const text = allText(data);
    const list = [`${th.tw} 40px "${th.title}"`, `${th.bw} 40px "${th.font}"`, `500 40px "${th.font}"`];
    try {
      await Promise.race([
        Promise.all(list.map(f => document.fonts.load(f, text))),
        new Promise(r => setTimeout(r, 4000)),
      ]);
    } catch (e) { /* 読めなくても、ほかの字体で描く */ }
  }

  // ── 描く道具 ──
  const hexToRgb = hex => {
    const n = parseInt(hex.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  };
  const rgba = (hex, a) => { const [r, g, b] = hexToRgb(hex); return `rgba(${r}, ${g}, ${b}, ${a})`; };
  const mix = (hex, to, t) => {
    const a = hexToRgb(hex), b = hexToRgb(to);
    return '#' + a.map((v, i) => Math.round(v + (b[i] - v) * t).toString(16).padStart(2, '0')).join('');
  };
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
  // 幅に入るように字を小さくし、それでも入らなければ … で切る
  const fit = (ctx, text, maxW, size, font, min = 0.62) => {
    let s = size;
    ctx.font = font(s);
    while (ctx.measureText(text).width > maxW && s > size * min) { s -= Math.max(1, size * 0.04); ctx.font = font(s); }
    if (ctx.measureText(text).width <= maxW) return { text, size: s };
    let t = text;
    while (t.length > 1 && ctx.measureText(t + '…').width > maxW) t = t.slice(0, -1);
    return { text: t + '…', size: s };
  };

  // 画像を枠いっぱいに（はみ出しは切る）
  const cover = (ctx, img, x, y, w, h) => {
    const s = Math.max(w / img.width, h / img.height);
    const iw = img.width * s, ih = img.height * s;
    ctx.drawImage(img, x + (w - iw) / 2, y + (h - ih) / 2, iw, ih);
  };

  // ── テーマごとの色 ──
  function palette(theme, accent) {
    const a = accent;
    switch (theme) {
      case 'simple': return {
        bg: '#f4f5f7', text: '#1f2328', muted: '#8a9099', card: '#ffffff', cardLine: '#e3e5e8',
        title: '#1f2328', dayFill: null, sat: '#2f6fed', sun: '#e5484d', time: a,
      };
      case 'neon': return {
        bg: '#0b0f24', text: '#eef2ff', muted: '#8b93b8', card: 'rgba(255,255,255,0.06)', cardLine: rgba(a, 0.35),
        title: '#ffffff', dayFill: null, sat: '#5fa8ff', sun: '#ff6b8b', time: a,
      };
      case 'wa': return {
        bg: '#f3ead8', text: '#3b2a1e', muted: '#9a876c', card: 'rgba(255,255,255,0.55)', cardLine: '#d8c7a6',
        title: '#3b2a1e', dayFill: a, sat: '#3a5f9e', sun: a, time: a,
      };
      default: return {
        bg: '#fff6ee', text: '#4b3742', muted: '#a8939d', card: '#ffffff', cardLine: mix(a, '#ffffff', 0.75),
        title: a, dayFill: a, sat: '#5b9bf0', sun: '#f06a6a', time: a,
      };
    }
  }

  function drawBackground(ctx, data, W, H, u, P, images) {
    const th = data.theme, a = data.accentColor;
    if (data.bg === 'transparent') return;
    if (data.bg === 'image' && images.bg) {
      cover(ctx, images.bg, 0, 0, W, H);
      ctx.fillStyle = rgba(th === 'neon' ? '#000000' : '#ffffff', th === 'neon' ? 0.35 : 0.25);
      ctx.fillRect(0, 0, W, H);
      return;
    }
    ctx.fillStyle = P.bg;
    ctx.fillRect(0, 0, W, H);
    if (th === 'pop') {
      // 水玉
      ctx.fillStyle = rgba(a, 0.1);
      const step = 64 * u;
      for (let y = 0, row = 0; y < H + step; y += step * 0.87, row++) {
        for (let x = (row % 2) * step / 2; x < W + step; x += step) {
          ctx.beginPath(); ctx.arc(x, y, 7 * u, 0, Math.PI * 2); ctx.fill();
        }
      }
    } else if (th === 'neon') {
      const g = ctx.createLinearGradient(0, 0, W, H);
      g.addColorStop(0, '#0b0f24'); g.addColorStop(1, '#1d0b33');
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      ctx.strokeStyle = rgba(a, 0.08); ctx.lineWidth = 1.5 * u;
      const step = 60 * u;
      ctx.beginPath();
      for (let x = 0; x < W; x += step) { ctx.moveTo(x, 0); ctx.lineTo(x, H); }
      for (let y = 0; y < H; y += step) { ctx.moveTo(0, y); ctx.lineTo(W, y); }
      ctx.stroke();
    } else if (th === 'wa') {
      // 和紙のすじ
      ctx.strokeStyle = 'rgba(160, 130, 90, 0.07)';
      ctx.lineWidth = 2 * u;
      ctx.beginPath();
      for (let y = 0; y < H; y += 14 * u) { ctx.moveTo(0, y); ctx.lineTo(W, y + 6 * u); }
      ctx.stroke();
      ctx.fillStyle = rgba(a, 0.9);
      ctx.fillRect(0, 0, W, 10 * u);
      ctx.fillRect(0, H - 10 * u, W, 10 * u);
    } else if (th === 'simple') {
      ctx.fillStyle = a;
      ctx.fillRect(0, 0, W, 12 * u);
    }
  }

  // 文字を幅で折り返す（日本語は1文字ずつ、英語は単語の途中でも）
  const wrap = (ctx, text, maxW) => {
    const out = [];
    let cur = '';
    for (const ch of text) {
      if (cur && ctx.measureText(cur + ch).width > maxW) { out.push(cur); cur = ch.trim() ? ch : ''; }
      else cur += ch;
    }
    if (cur) out.push(cur);
    return out;
  };

  // ── 1か月（カレンダー） ──
  function drawMonth(L) {
    const { ctx, data, P, A, u, x0, listW, top, bottom, fBold, now } = L;
    const today = now ? ymd(now) : '';
    const [yy, mm] = data.month.split('-').map(Number);
    const lead = (new Date(yy, mm - 1, 1).getDay() - data.first + 7) % 7;
    const ndays = new Date(yy, mm, 0).getDate();
    const weeks = Math.ceil((lead + ndays) / 7);
    const gap = 8 * u;
    const whH = 40 * u;
    const cellW = (listW - gap * 6) / 7;
    const gridTop = top + whH + gap;
    const cellH = (bottom - gridTop - gap * (weeks - 1)) / weeks;
    const radius = { pop: 16 * u, simple: 8 * u, neon: 6 * u, wa: 3 * u }[data.theme];
    const wdNames = WD[data.wd];

    // 曜日の行
    for (let c = 0; c < 7; c++) {
      const dow = (data.first + c) % 7;
      const x = x0 + c * (cellW + gap);
      const color = dow === 6 ? P.sat : dow === 0 ? P.sun : null;
      ctx.textAlign = 'center';
      ctx.font = fBold(Math.min(24 * u, cellW * 0.22));
      if (data.theme === 'pop') {
        rr(ctx, x, top, cellW, whH, whH / 2);
        ctx.fillStyle = color || A; ctx.fill();
        ctx.fillStyle = '#ffffff';
      } else if (data.theme === 'wa') {
        ctx.fillStyle = color || P.text;
      } else {
        ctx.fillStyle = color || (data.theme === 'neon' ? A : P.muted);
      }
      ctx.fillText(wdNames[dow], x + cellW / 2, top + whH / 2 + 1 * u);
    }

    for (let idx = 0; idx < weeks * 7; idx++) {
      const dnum = idx - lead + 1;
      if (dnum < 1 || dnum > ndays) continue;
      const c = idx % 7, r = Math.floor(idx / 7);
      const x = x0 + c * (cellW + gap), y = gridTop + r * (cellH + gap);
      const date = new Date(yy, mm - 1, dnum);
      const key = ymd(date);
      const dow = date.getDay();
      const day = data.mdays[key];
      const isToday = now && data.today && key === today;
      const isPast = now && data.past && key < today;
      ctx.save();
      if (isPast) ctx.globalAlpha = 0.42;
      rr(ctx, x, y, cellW, cellH, radius);
      if (data.theme === 'pop') {
        ctx.save();
        ctx.shadowColor = 'rgba(120, 60, 90, 0.12)'; ctx.shadowBlur = 10 * u; ctx.shadowOffsetY = 3 * u;
        ctx.fillStyle = P.card; ctx.fill();
        ctx.restore();
      } else {
        ctx.fillStyle = P.card; ctx.fill();
        ctx.strokeStyle = P.cardLine; ctx.lineWidth = 1.5 * u; ctx.stroke();
      }
      if (isToday) {
        ctx.save();
        rr(ctx, x, y, cellW, cellH, radius);
        ctx.strokeStyle = A; ctx.lineWidth = 4 * u;
        if (data.theme === 'neon') { ctx.shadowColor = A; ctx.shadowBlur = 16 * u; }
        ctx.stroke();
        ctx.restore();
      }
      // 日にち
      const pd = Math.min(10 * u, cellW * 0.07);
      const ns = Math.min(cellH * 0.2, 30 * u, cellW * 0.2);
      const holiday = dow === 6 ? P.sat : dow === 0 ? P.sun : null;
      ctx.textAlign = 'left';
      ctx.font = fBold(ns);
      ctx.fillStyle = holiday || (data.theme === 'pop' || data.theme === 'wa' ? A : P.text);
      ctx.fillText(String(dnum), x + pd, y + pd + ns * 0.55);
      if (isToday) {
        const nw = ctx.measureText(String(dnum)).width;
        const ts = ns * 0.55;
        ctx.font = fBold(ts);
        const tw = ctx.measureText('TODAY').width + ts;
        if (pd * 2 + nw + 6 * u + tw <= cellW) {
          const bx = x + pd + nw + 6 * u, by = y + pd + ns * 0.55 - ts * 0.8;
          rr(ctx, bx, by, tw, ts * 1.6, ts * 0.8);
          ctx.fillStyle = A; ctx.fill();
          ctx.fillStyle = data.theme === 'neon' ? '#0b0f24' : '#ffffff';
          ctx.fillText('TODAY', bx + ts / 2, by + ts * 0.82);
        }
      }

      // 中身
      const cx = x + pd, cy0 = y + pd + ns * 1.15 + 4 * u;
      const cw = cellW - pd * 2, ch = y + cellH - pd - cy0;
      const items = day ? day.items.filter(it => it.t || it.s || it.tag) : [];
      if (day && day.off) {
        const os = Math.min(cellH * 0.14, 22 * u, cellW * 0.16);
        ctx.font = fBold(os);
        ctx.fillStyle = P.muted;
        ctx.fillText(data.wd === 'en' ? 'OFF' : 'お休み', cx, cy0 + os * 0.6);
      } else if (items.length && ch > 8 * u) {
        // 入りきる大きさを探す（小さくしすぎたら、はみ出す行は … で切る）
        const bar = 4 * u, tx = cx + bar + 5 * u, tw = cw - bar - 5 * u;
        const start = Math.min(cellH * 0.15, 24 * u, cellW * 0.13);
        let fs = start;
        const layout = size => {
          ctx.font = fBold(size);
          return items.map(it => {
            const tt = it.t ? it.t + (data.tl && /\d$/.test(it.t) ? '〜' : '') : '';
            const ls = (it.s || it.tag).split('\n').filter(l => l.trim());
            const first = [tt, ls[0] || ''].filter(Boolean).join(' ');
            const rows = [];
            [first, ...ls.slice(1)].forEach(l => rows.push(...wrap(ctx, l, tw)));
            return { it, tt, rows };
          });
        };
        const total = (b, size) => b.reduce((n, v) => n + v.rows.length, 0) * size * 1.25 + (b.length - 1) * 4 * u;
        let blocks = layout(fs);
        while (total(blocks, fs) > ch && fs > start * 0.62) { fs -= start * 0.04; blocks = layout(fs); }
        const lh = fs * 1.25;
        const maxRows = Math.max(1, Math.floor((ch + 2 * u) / lh));
        let y2 = cy0, used = 0;
        for (const b of blocks) {
          if (used >= maxRows) break;
          const take = Math.min(b.rows.length, maxRows - used);
          const cut = take < b.rows.length;
          ctx.fillStyle = b.it.tag ? tagColor(b.it.tag) : A;
          rr(ctx, cx, y2 + 1 * u, bar, take * lh - 2 * u, bar / 2);
          ctx.fill();
          ctx.font = fBold(fs);
          for (let j = 0; j < take; j++) {
            let row = b.rows[j];
            if (cut && j === take - 1) {
              while (row.length > 1 && ctx.measureText(row + '…').width > tw) row = row.slice(0, -1);
              row += '…';
            }
            const ly = y2 + lh * j + lh / 2;
            if (j === 0 && b.tt && row.startsWith(b.tt)) {
              ctx.fillStyle = P.time;
              ctx.fillText(b.tt, tx, ly);
              const w = ctx.measureText(b.tt).width;
              ctx.fillStyle = P.text;
              ctx.fillText(row.slice(b.tt.length), tx + w, ly);
            } else {
              ctx.fillStyle = P.text;
              ctx.fillText(row, tx, ly);
            }
          }
          used += take;
          y2 += take * lh + 4 * u;
        }
      }
      ctx.restore();
    }
  }


  function draw(canvas, raw, opts = {}) {
    const data = normalize(raw);
    const images = opts.images || {};
    const size = SIZES[data.size];
    const W = size.w, H = size.h;
    if (canvas.width !== W) canvas.width = W;
    if (canvas.height !== H) canvas.height = H;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, W, H);
    const th = THEMES[data.theme];
    data.accentColor = data.accent || th.accent;
    const A = data.accentColor;
    const P = palette(data.theme, A);
    const u = Math.min(W, H) / 1080;
    const F = (w, fam) => s => `${w} ${s}px "${fam}", "Zen Maru Gothic", "Hiragino Sans", "Meiryo", sans-serif`;
    const fTitle = F(th.tw, th.title), fBold = F(th.bw, th.font), fBody = F(500, th.font);
    ctx.textBaseline = 'middle';

    drawBackground(ctx, data, W, H, u, P, images);

    const wide = data.size === 'wide';
    const pad = (wide ? 64 : 56) * u;
    // キャラ：横長は右の列に全身、縦長は見出しの右に上半身（予定の幅を狭めないように）
    const chara = images.chara;
    const x0 = pad;
    let listW = W - pad * 2, headW = listW;
    const hh = (wide ? 150 : chara ? (data.size === 'story' ? 0.2 : 0.25) * H / u : 168) * u;
    const headTop = pad + (data.theme === 'wa' || data.theme === 'simple' ? 8 * u : 0);
    if (chara && wide) {
      const cw = Math.round(W * 0.3);
      listW = headW = W - pad * 2 - (cw - pad * 0.4);
      const s = Math.min(H * 0.96 / chara.height, cw * 1.15 / chara.width);
      const iw = chara.width * s, ih = chara.height * s;
      ctx.drawImage(chara, W - cw / 2 - iw / 2 - pad * 0.3, H - ih, iw, ih);
    } else if (chara) {
      const cw = Math.round(W * 0.36);
      headW = listW - cw;
      const areaH = headTop + hh + 6 * u;
      const s = Math.min(cw * 1.1 / chara.width, areaH * 1.7 / chara.height);
      const iw = chara.width * s, ih = chara.height * s;
      ctx.save();
      ctx.beginPath(); ctx.rect(0, 0, W, areaH); ctx.clip();
      ctx.drawImage(chara, W - pad * 0.6 - cw / 2 - iw / 2, Math.max(8 * u, areaH - ih * 0.62), iw, ih);
      ctx.restore();
    }

    // ── 見出し ──
    const days = Array.from({ length: 7 }, (_, i) => { const d = parseYmd(data.start); d.setDate(d.getDate() + i); return d; });
    const [my, mm] = data.month.split('-').map(Number);
    const period = data.mode === 'month'
      ? (data.wd === 'en' ? `${MONTHS[mm - 1]} ${my}` : `${my}年${mm}月`)
      : `${days[0].getMonth() + 1}/${days[0].getDate()} - ${days[6].getMonth() + 1}/${days[6].getDate()}`;
    const titleSize = (wide ? 84 : 76) * u;
    // 縦長でキャラがあるときは、見出しが高くなるので、文字を上下の真ん中に
    let y = headTop + (hh > 200 * u ? (hh - 150 * u) / 2 : 0);
    const tf = fit(ctx, data.title || ' ', headW, titleSize, fTitle, 0.5);
    ctx.font = fTitle(tf.size);
    ctx.textAlign = 'left';
    const ty = y + titleSize * 0.5;
    if (data.theme === 'pop') {
      ctx.lineJoin = 'round';
      ctx.lineWidth = 12 * u;
      ctx.strokeStyle = '#ffffff';
      ctx.strokeText(tf.text, x0, ty);
      ctx.fillStyle = P.title;
      ctx.fillText(tf.text, x0, ty);
    } else if (data.theme === 'neon') {
      ctx.save();
      ctx.shadowColor = A; ctx.shadowBlur = 24 * u;
      ctx.fillStyle = P.title;
      ctx.fillText(tf.text, x0, ty);
      ctx.restore();
    } else {
      ctx.fillStyle = P.title;
      ctx.fillText(tf.text, x0, ty);
    }
    // 名前と期間
    const sy = y + titleSize + 34 * u;
    ctx.font = fBold(30 * u);
    const pw = ctx.measureText(period).width;
    ctx.textAlign = 'right';
    const subColor = data.bg === 'transparent' && data.theme !== 'neon' ? P.text : P.muted;
    ctx.fillStyle = data.theme === 'neon' ? A : subColor;
    ctx.fillText(period, x0 + headW, sy);
    if (data.sub) {
      ctx.textAlign = 'left';
      const sf = fit(ctx, data.sub, headW - pw - 30 * u, 32 * u, fBold);
      ctx.font = fBold(sf.size);
      ctx.fillStyle = P.text;
      ctx.fillText(sf.text, x0, sy);
    }
    if (data.theme === 'simple' || data.theme === 'wa') {
      ctx.fillStyle = data.theme === 'wa' ? P.cardLine : '#d5d8dd';
      ctx.fillRect(x0, sy + 30 * u, headW, 2 * u);
    }

    // ── お知らせ ──
    const nh = data.note ? 64 * u : 0;
    if (data.note) {
      const ny = H - pad - nh / 2 + 6 * u;
      ctx.textAlign = 'left';
      const mark = '★ ';
      ctx.font = fBold(28 * u);
      const mw = ctx.measureText(mark).width;
      const nf = fit(ctx, data.note, listW - mw, 28 * u, fBold);
      ctx.fillStyle = A;
      ctx.font = fBold(28 * u);
      ctx.fillText(mark, x0, ny);
      ctx.fillStyle = P.text;
      ctx.font = fBold(nf.size);
      ctx.fillText(nf.text, x0 + mw, ny);
    }

    const top = headTop + hh + (wide ? 4 : 14) * u;
    const bottom = H - pad - nh;
    if (data.mode === 'month') {
      drawMonth({ ctx, data, P, A, u, x0, listW, top, bottom, fBold, now: opts.now || null });
      return { w: W, h: H };
    }

    // ── 7日分 ──
    const gap = (wide ? 12 : 14) * u;
    const rowH = (bottom - top - gap * 6) / 7;
    const now = opts.now || null;
    const today = now ? ymd(now) : '';
    const radius = { pop: rowH * 0.28, simple: 10 * u, neon: 8 * u, wa: 4 * u }[data.theme];
    const wdNames = WD[data.wd];
    const dw = Math.min(rowH * (data.wd === 'en' ? 2.1 : 1.8), listW * 0.24);

    days.forEach((date, i) => {
      const day = data.days[i];
      const ry = top + i * (rowH + gap);
      const dow = date.getDay();
      const isToday = now && data.today && ymd(date) === today;
      const isPast = now && data.past && ymd(date) < today;
      const dayColor = dow === 6 ? P.sat : dow === 0 ? P.sun : null;
      ctx.save();
      if (isPast) ctx.globalAlpha = 0.42;

      // 枠
      rr(ctx, x0, ry, listW, rowH, radius);
      if (data.theme === 'pop') {
        ctx.save();
        ctx.shadowColor = 'rgba(120, 60, 90, 0.12)'; ctx.shadowBlur = 14 * u; ctx.shadowOffsetY = 4 * u;
        ctx.fillStyle = P.card; ctx.fill();
        ctx.restore();
      } else {
        ctx.fillStyle = P.card; ctx.fill();
        ctx.strokeStyle = P.cardLine; ctx.lineWidth = 2 * u; ctx.stroke();
      }
      if (isToday) {
        ctx.save();
        rr(ctx, x0, ry, listW, rowH, radius);
        ctx.strokeStyle = A; ctx.lineWidth = 5 * u;
        if (data.theme === 'neon') { ctx.shadowColor = A; ctx.shadowBlur = 20 * u; }
        ctx.stroke();
        ctx.restore();
      }

      // 曜日・日付
      const wdText = wdNames[dow];
      const dateText = `${date.getMonth() + 1}/${date.getDate()}`;
      const cx = x0 + dw / 2;
      const cy = ry + rowH / 2;
      if (data.theme === 'pop') {
        ctx.save();
        rr(ctx, x0, ry, dw, rowH, radius);
        ctx.clip();
        ctx.fillStyle = dayColor || P.dayFill;
        ctx.fillRect(x0, ry, dw, rowH);
        ctx.restore();
        ctx.fillStyle = '#ffffff';
      } else if (data.theme === 'wa') {
        ctx.fillStyle = dayColor || A;
        ctx.beginPath(); ctx.arc(x0 + rowH * 0.62, cy, rowH * 0.36, 0, Math.PI * 2); ctx.fill();
      } else if (data.theme === 'neon') {
        ctx.fillStyle = dayColor || A;
        ctx.fillRect(x0, ry + rowH * 0.15, 6 * u, rowH * 0.7);
      }
      ctx.textAlign = 'center';
      if (data.theme === 'wa') {
        // 丸の中に曜日、右に日付
        ctx.fillStyle = '#ffffff';
        ctx.font = fBold(Math.min(rowH * 0.36, 44 * u) * (data.wd === 'en' ? 0.62 : 1));
        ctx.fillText(wdText, x0 + rowH * 0.62, cy + 1 * u);
        ctx.fillStyle = P.text;
        ctx.font = fBold(Math.min(rowH * 0.3, 36 * u));
        ctx.textAlign = 'left';
        ctx.fillText(dateText, x0 + rowH * 1.08, cy + 1 * u);
      } else {
        const big = Math.min(rowH * 0.36, 46 * u) * (data.wd === 'en' ? 0.78 : 1);
        const small = Math.min(rowH * 0.24, 28 * u);
        const color = data.theme === 'pop' ? '#ffffff' : (dayColor || (data.theme === 'neon' ? A : P.text));
        ctx.fillStyle = color;
        ctx.font = fBold(big);
        ctx.fillText(wdText, cx + (data.theme === 'neon' ? 4 * u : 0), cy - small * 0.62);
        ctx.font = fBold(small);
        ctx.fillStyle = data.theme === 'pop' ? 'rgba(255,255,255,0.92)' : (data.theme === 'neon' ? P.muted : P.muted);
        ctx.fillText(dateText, cx + (data.theme === 'neon' ? 4 * u : 0), cy + big * 0.55);
      }
      if (data.theme === 'simple') {
        ctx.fillStyle = P.cardLine;
        ctx.fillRect(x0 + dw, ry + rowH * 0.18, 2 * u, rowH * 0.64);
      }

      // 中身
      // 和風は丸の右に日付があるので、日付のいちばん広い幅のあとから
      let ix = x0 + dw + 26 * u;
      if (data.theme === 'wa') {
        ctx.font = fBold(Math.min(rowH * 0.3, 36 * u));
        ix = x0 + rowH * 1.08 + ctx.measureText('10/30').width + 30 * u;
      }
      const iw = x0 + listW - ix - 24 * u;
      const items = day.items.filter(it => it.t || it.s || it.tag);
      ctx.textAlign = 'left';
      if (day.off || !items.length) {
        const label = day.off ? (data.wd === 'en' ? 'OFF' : 'お休み') : 'ー';
        ctx.font = fBold(Math.min(rowH * 0.34, 38 * u));
        ctx.fillStyle = P.muted;
        ctx.fillText(label, ix, cy);
      } else {
        // 横に広いときは、2つ目からは右に並べる。狭いときは上下に重ねる
        const cols = items.length > 1 && iw > 1000 * u;
        const lh = cols ? rowH : rowH / items.length;
        const colW = cols ? iw / items.length : iw;
        const base = cols ? Math.min(rowH * 0.32, 36 * u) : Math.min(lh * (items.length > 1 ? 0.58 : 0.38), 42 * u);
        items.forEach((it, k) => {
          const ly = cols ? cy : ry + lh * k + lh / 2;
          let x = ix + (cols ? colW * k : 0);
          const right = (cols ? ix + colW * (k + 1) - 24 * u : ix + iw);
          if (it.t) {
            const tt = it.t + (data.tl && /\d$/.test(it.t) ? '〜' : '');
            ctx.font = fBold(base);
            ctx.fillStyle = P.time;
            if (data.theme === 'neon') { ctx.save(); ctx.shadowColor = A; ctx.shadowBlur = 12 * u; }
            ctx.fillText(tt, x, ly);
            if (data.theme === 'neon') ctx.restore();
            x += (cols ? ctx.measureText(tt).width : Math.max(ctx.measureText(tt).width, base * 3.2)) + base * 0.5;
          }
          if (it.tag) {
            const ts = base * 0.62;
            ctx.font = fBold(ts);
            const tw = ctx.measureText(it.tag).width + ts * 1.3;
            const tc = tagColor(it.tag);
            rr(ctx, x, ly - ts * 0.85, tw, ts * 1.7, ts * 0.85);
            ctx.fillStyle = tc; ctx.fill();
            ctx.fillStyle = '#ffffff';
            ctx.fillText(it.tag, x + ts * 0.65, ly + 1 * u);
            x += tw + base * 0.45;
          }
          if (it.s) {
            // 複数行は、行の高さに収まる大きさで重ねる
            const ls = it.s.split('\n').filter(l => l.trim());
            const n = Math.max(1, ls.length);
            const size = n > 1 ? Math.min(base, lh * 0.86 / (n * 1.2)) : base;
            ctx.fillStyle = P.text;
            ls.forEach((l, j) => {
              const f = fit(ctx, l, right - x, size, fBold, n > 1 ? 0.8 : 0.6);
              ctx.font = fBold(f.size);
              ctx.fillText(f.text, x, ly + (j - (n - 1) / 2) * size * 1.2);
            });
          }
        });
      }
      if (isToday) {
        const label = 'TODAY';
        const ts = Math.min(rowH * 0.2, 22 * u);
        ctx.font = fBold(ts);
        const tw = ctx.measureText(label).width + ts * 1.2;
        const bx = x0 + listW - tw - 14 * u, by = ry + 10 * u;
        rr(ctx, bx, by, tw, ts * 1.6, ts * 0.8);
        ctx.fillStyle = A; ctx.fill();
        ctx.fillStyle = data.theme === 'neon' ? '#0b0f24' : '#ffffff';
        ctx.textAlign = 'center';
        ctx.fillText(label, bx + tw / 2, by + ts * 0.82);
      }
      ctx.restore();
    });
    return { w: W, h: H };
  }

  global.ScheduleCore = { SIZES, THEMES, TAGS, WD, MONTHS, defaults, normalize, encode, decode, forUrl, hasContent, ensureFonts, draw, ymd, parseYmd, weekStart, tagColor };
})(window);
