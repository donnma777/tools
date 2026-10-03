/*
 * QRコードを作る（window.QrCore）
 *   QrCore.encode('https://…', 'M')          → { version, size, modules, fn, ecl, mask, bytes }（長すぎるときは err.code === 'too-long'）
 *   QrCore.draw(ctx, qr, style, px)           canvas に px×px で描く
 *   QrCore.svg(qr, style, px)                 SVG の文字列
 *   QrCore.coverage(qr, style)                ロゴの下で空けるマスの割合（0〜1）
 *
 * style（どれも省略できる）:
 *   margin   まわりの余白（マス。ふつうは 4）
 *   dot      'square' 四角 / 'rounded' 角丸 / 'dot' 丸 / 'smooth' つながる丸
 *   eye      'square' / 'rounded' / 'circle' / 'leaf'（角の目の外枠）
 *   eyeIn    同じ（角の目の中）
 *   fg, bg   色（bg が空なら透明）。fg2 があればグラデーション（gradDir 'h' 横 / 'v' 縦 / 'd' 斜め）
 *   eyeColor, eyeInColor   目の色（空ならドットと同じ）
 *   logo     { img, src（SVG に埋めこむ data URL）, ratio（QRの幅に対する大きさ 0〜1）, plate（ロゴの下のマスを空ける） }
 *
 * 符号化は JIS X 0510 どおり（数字・英数字・8bit のどれか1つで全体を入れる。8bit は UTF-8）。
 */
(function (global) {
  'use strict';

  const ECLS = ['L', 'M', 'Q', 'H'];
  const FORMAT_BITS = [1, 0, 3, 2];
  // [誤り訂正のレベル][バージョン] ブロックごとの誤り訂正の語数・ブロックの数
  const ECC_PER_BLOCK = [
    [-1, 7, 10, 15, 20, 26, 18, 20, 24, 30, 18, 20, 24, 26, 30, 22, 24, 28, 30, 28, 28, 28, 28, 30, 30, 26, 28, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
    [-1, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26, 30, 22, 22, 24, 24, 28, 28, 26, 26, 26, 26, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28],
    [-1, 13, 22, 18, 26, 18, 24, 18, 22, 20, 24, 28, 26, 24, 20, 30, 24, 28, 28, 26, 30, 28, 30, 30, 30, 30, 28, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
    [-1, 17, 28, 22, 16, 22, 28, 26, 26, 24, 28, 24, 28, 22, 24, 24, 30, 28, 28, 26, 28, 30, 24, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
  ];
  const NUM_BLOCKS = [
    [-1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 4, 4, 4, 4, 4, 6, 6, 6, 6, 7, 8, 8, 9, 9, 10, 12, 12, 12, 13, 14, 15, 16, 17, 18, 19, 19, 20, 21, 22, 24, 25],
    [-1, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5, 5, 8, 9, 9, 10, 10, 11, 13, 14, 16, 17, 17, 18, 20, 21, 23, 25, 26, 28, 29, 31, 33, 35, 37, 38, 40, 43, 45, 47, 49],
    [-1, 1, 1, 2, 2, 4, 4, 6, 6, 8, 8, 8, 10, 12, 16, 12, 17, 16, 18, 21, 20, 23, 23, 25, 27, 29, 34, 34, 35, 38, 40, 43, 45, 48, 51, 53, 56, 59, 62, 65, 68],
    [-1, 1, 1, 2, 4, 4, 4, 5, 6, 8, 8, 11, 11, 16, 16, 18, 16, 19, 21, 25, 25, 25, 34, 30, 32, 35, 37, 40, 42, 45, 48, 51, 54, 57, 60, 63, 66, 70, 74, 77, 81],
  ];
  const ALNUM = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ $%*+-./:';

  // ---- Reed-Solomon（GF(256)、x^8+x^4+x^3+x^2+1）
  function gfMul(x, y) {
    let z = 0;
    for (let i = 7; i >= 0; i--) {
      z = (z << 1) ^ ((z >>> 7) * 0x11d);
      z ^= ((y >>> i) & 1) * x;
    }
    return z;
  }
  function rsDivisor(degree) {
    const r = new Array(degree).fill(0);
    r[degree - 1] = 1;
    let root = 1;
    for (let i = 0; i < degree; i++) {
      for (let j = 0; j < r.length; j++) {
        r[j] = gfMul(r[j], root);
        if (j + 1 < r.length) r[j] ^= r[j + 1];
      }
      root = gfMul(root, 0x02);
    }
    return r;
  }
  function rsRemainder(data, div) {
    const r = div.map(() => 0);
    for (const b of data) {
      const f = b ^ r.shift();
      r.push(0);
      div.forEach((c, i) => { r[i] ^= gfMul(c, f); });
    }
    return r;
  }

  // データを入れられるマスの数
  function rawModules(ver) {
    let n = (16 * ver + 128) * ver + 64;
    if (ver >= 2) {
      const a = Math.floor(ver / 7) + 2;
      n -= (25 * a - 10) * a - 55;
      if (ver >= 7) n -= 36;
    }
    return n;
  }
  const dataCodewords = (ver, e) => Math.floor(rawModules(ver) / 8) - ECC_PER_BLOCK[e][ver] * NUM_BLOCKS[e][ver];

  // ---- 入れ方（全体を1つのモードで）
  function segment(text) {
    if (/^[0-9]*$/.test(text)) {
      const bits = [];
      for (let i = 0; i < text.length; i += 3) {
        const g = text.substr(i, 3);
        push(bits, parseInt(g, 10), g.length * 3 + 1);
      }
      return { mode: 1, cc: [10, 12, 14], count: text.length, bits, bytes: text.length };
    }
    if ([...text].every(c => ALNUM.includes(c))) {
      const bits = [];
      for (let i = 0; i < text.length; i += 2) {
        if (i + 1 < text.length) push(bits, ALNUM.indexOf(text[i]) * 45 + ALNUM.indexOf(text[i + 1]), 11);
        else push(bits, ALNUM.indexOf(text[i]), 6);
      }
      return { mode: 2, cc: [9, 11, 13], count: text.length, bits, bytes: text.length };
    }
    const data = new TextEncoder().encode(text);
    const bits = [];
    data.forEach(b => push(bits, b, 8));
    return { mode: 4, cc: [8, 16, 16], count: data.length, bits, bytes: data.length };
  }
  function push(bits, val, len) {
    for (let i = len - 1; i >= 0; i--) bits.push((val >>> i) & 1);
  }
  const ccIndex = ver => (ver <= 9 ? 0 : ver <= 26 ? 1 : 2);

  // ---- 形
  function alignPositions(ver) {
    if (ver === 1) return [];
    const n = Math.floor(ver / 7) + 2;
    const step = ver === 32 ? 26 : Math.ceil((ver * 4 + 4) / (n * 2 - 2)) * 2;
    const r = [6];
    for (let pos = ver * 4 + 17 - 7; r.length < n; pos -= step) r.splice(1, 0, pos);
    return r;
  }
  const MASKS = [
    (x, y) => (x + y) % 2 === 0,
    (x, y) => y % 2 === 0,
    (x, y) => x % 3 === 0,
    (x, y) => (x + y) % 3 === 0,
    (x, y) => (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0,
    (x, y) => (x * y) % 2 + (x * y) % 3 === 0,
    (x, y) => ((x * y) % 2 + (x * y) % 3) % 2 === 0,
    (x, y) => ((x + y) % 2 + (x * y) % 3) % 2 === 0,
  ];

  function encode(text, eclName = 'M') {
    const e = Math.max(0, ECLS.indexOf(eclName));
    const seg = segment(String(text));
    let ver = 0;
    for (let v = 1; v <= 40; v++) {
      const need = 4 + seg.cc[ccIndex(v)] + seg.bits.length;
      if (seg.count < 2 ** seg.cc[ccIndex(v)] && need <= dataCodewords(v, e) * 8) { ver = v; break; }
    }
    if (!ver) {
      const err = new Error('too-long');
      err.code = 'too-long';
      err.bytes = seg.bytes;
      throw err;
    }

    // ビット列 → 語
    const cap = dataCodewords(ver, e) * 8;
    const bits = [];
    push(bits, seg.mode, 4);
    push(bits, seg.count, seg.cc[ccIndex(ver)]);
    bits.push(...seg.bits);
    push(bits, 0, Math.min(4, cap - bits.length));
    push(bits, 0, (8 - bits.length % 8) % 8);
    for (let pad = 0xec; bits.length < cap; pad ^= 0xec ^ 0x11) push(bits, pad, 8);
    const data = [];
    for (let i = 0; i < bits.length; i += 8) {
      let b = 0;
      for (let j = 0; j < 8; j++) b = (b << 1) | bits[i + j];
      data.push(b);
    }

    // ブロックに分けて誤り訂正をつけ、交互に並べる
    const nb = NUM_BLOCKS[e][ver], eccLen = ECC_PER_BLOCK[e][ver];
    const raw = Math.floor(rawModules(ver) / 8);
    const nShort = nb - raw % nb, shortLen = Math.floor(raw / nb);
    const div = rsDivisor(eccLen);
    const blocks = [];
    for (let i = 0, k = 0; i < nb; i++) {
      const dat = data.slice(k, k + shortLen - eccLen + (i < nShort ? 0 : 1));
      k += dat.length;
      const ecc = rsRemainder(dat, div);
      if (i < nShort) dat.push(0);
      blocks.push(dat.concat(ecc));
    }
    const words = [];
    for (let i = 0; i < blocks[0].length; i++) {
      blocks.forEach((b, j) => {
        if (i !== shortLen - eccLen || j >= nShort) words.push(b[i]);
      });
    }

    // マスに置く
    const size = ver * 4 + 17;
    const mod = new Uint8Array(size * size), fn = new Uint8Array(size * size);
    const set = (x, y, d) => { mod[y * size + x] = d ? 1 : 0; fn[y * size + x] = 1; };
    for (let i = 0; i < size; i++) { set(6, i, i % 2 === 0); set(i, 6, i % 2 === 0); }
    for (const [cx, cy] of [[3, 3], [size - 4, 3], [3, size - 4]]) {
      for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) {
        const x = cx + dx, y = cy + dy;
        if (x < 0 || y < 0 || x >= size || y >= size) continue;
        const d = Math.max(Math.abs(dx), Math.abs(dy));
        set(x, y, d !== 2 && d !== 4);
      }
    }
    const ap = alignPositions(ver), na = ap.length;
    for (let i = 0; i < na; i++) for (let j = 0; j < na; j++) {
      if ((i === 0 && j === 0) || (i === 0 && j === na - 1) || (i === na - 1 && j === 0)) continue;
      for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
        set(ap[i] + dx, ap[j] + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
      }
    }
    const drawFormat = mask => {
      const d = (FORMAT_BITS[e] << 3) | mask;
      let r = d;
      for (let i = 0; i < 10; i++) r = (r << 1) ^ ((r >>> 9) * 0x537);
      const b = ((d << 10) | r) ^ 0x5412;
      const bit = i => ((b >>> i) & 1) !== 0;
      for (let i = 0; i <= 5; i++) set(8, i, bit(i));
      set(8, 7, bit(6)); set(8, 8, bit(7)); set(7, 8, bit(8));
      for (let i = 9; i < 15; i++) set(14 - i, 8, bit(i));
      for (let i = 0; i < 8; i++) set(size - 1 - i, 8, bit(i));
      for (let i = 8; i < 15; i++) set(8, size - 15 + i, bit(i));
      set(8, size - 8, true);
    };
    drawFormat(0);
    if (ver >= 7) {
      let r = ver;
      for (let i = 0; i < 12; i++) r = (r << 1) ^ ((r >>> 11) * 0x1f25);
      const b = (ver << 12) | r;
      for (let i = 0; i < 18; i++) {
        const d = ((b >>> i) & 1) !== 0, a = size - 11 + i % 3, c = Math.floor(i / 3);
        set(a, c, d); set(c, a, d);
      }
    }
    let n = 0;
    for (let right = size - 1; right >= 1; right -= 2) {
      if (right === 6) right = 5;
      for (let v = 0; v < size; v++) for (let j = 0; j < 2; j++) {
        const x = right - j, up = ((right + 1) & 2) === 0, y = up ? size - 1 - v : v;
        if (!fn[y * size + x] && n < words.length * 8) {
          mod[y * size + x] = (words[n >>> 3] >>> (7 - (n & 7))) & 1;
          n++;
        }
      }
    }

    // マスクは、一番見づらくならないものを選ぶ
    const applyMask = m => {
      for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
        const i = y * size + x;
        if (!fn[i] && MASKS[m](x, y)) mod[i] ^= 1;
      }
    };
    let best = 0, bestP = Infinity;
    for (let m = 0; m < 8; m++) {
      applyMask(m);
      drawFormat(m);
      const p = penalty(mod, size);
      if (p < bestP) { bestP = p; best = m; }
      applyMask(m);
    }
    applyMask(best);
    drawFormat(best);
    return { version: ver, size, modules: mod, fn, ecl: ECLS[e], mask: best, bytes: seg.bytes };
  }

  function penalty(mod, size) {
    let p = 0, dark = 0;
    const line = new Uint8Array(size);
    const light = i => i < 0 || i >= size || !line[i];
    for (let pass = 0; pass < 2; pass++) {
      for (let a = 0; a < size; a++) {
        let run = 0, prev = -1;
        for (let b = 0; b < size; b++) {
          const v = pass ? mod[b * size + a] : mod[a * size + b];
          line[b] = v;
          if (v === prev) { run++; if (run === 5) p += 3; else if (run > 5) p++; }
          else { prev = v; run = 1; }
        }
        for (let b = 0; b + 7 <= size; b++) {
          if (line[b] && !line[b + 1] && line[b + 2] && line[b + 3] && line[b + 4] && !line[b + 5] && line[b + 6] &&
            ((light(b - 1) && light(b - 2) && light(b - 3) && light(b - 4)) ||
              (light(b + 7) && light(b + 8) && light(b + 9) && light(b + 10)))) p += 40;
        }
      }
    }
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
      const c = mod[y * size + x];
      dark += c;
      if (x < size - 1 && y < size - 1 && c === mod[y * size + x + 1] && c === mod[(y + 1) * size + x] && c === mod[(y + 1) * size + x + 1]) p += 3;
    }
    const total = size * size;
    p += Math.max(0, Math.ceil(Math.abs(dark * 20 - total * 10) / total) - 1) * 10;
    return p;
  }

  // =====================================================
  //  見た目（マス単位の SVG パス。canvas でも Path2D で同じものを使う）
  // =====================================================
  const f = v => +v.toFixed(3);
  function rr(x, y, w, h, c) {
    const [tl, tr, br, bl] = typeof c === 'number' ? [c, c, c, c] : c;
    let d = `M${f(x + tl)} ${f(y)}H${f(x + w - tr)}`;
    if (tr) d += `A${tr} ${tr} 0 0 1 ${f(x + w)} ${f(y + tr)}`;
    d += `V${f(y + h - br)}`;
    if (br) d += `A${br} ${br} 0 0 1 ${f(x + w - br)} ${f(y + h)}`;
    d += `H${f(x + bl)}`;
    if (bl) d += `A${bl} ${bl} 0 0 1 ${f(x)} ${f(y + h - bl)}`;
    d += `V${f(y + tl)}`;
    if (tl) d += `A${tl} ${tl} 0 0 1 ${f(x + tl)} ${f(y)}`;
    return d + 'Z';
  }
  const circle = (cx, cy, r) => `M${f(cx - r)} ${f(cy)}a${r} ${r} 0 1 0 ${f(2 * r)} 0a${r} ${r} 0 1 0 ${f(-2 * r)} 0Z`;

  const EYE_OUT = {
    square: (x, y) => rr(x, y, 7, 7, 0) + rr(x + 1, y + 1, 5, 5, 0),
    rounded: (x, y) => rr(x, y, 7, 7, 2.2) + rr(x + 1, y + 1, 5, 5, 1.4),
    circle: (x, y) => circle(x + 3.5, y + 3.5, 3.5) + circle(x + 3.5, y + 3.5, 2.5),
    leaf: (x, y) => rr(x, y, 7, 7, [3.5, 0.6, 3.5, 0.6]) + rr(x + 1, y + 1, 5, 5, [2.5, 0, 2.5, 0]),
  };
  const EYE_IN = {
    square: (x, y) => rr(x + 2, y + 2, 3, 3, 0),
    rounded: (x, y) => rr(x + 2, y + 2, 3, 3, 0.9),
    circle: (x, y) => circle(x + 3.5, y + 3.5, 1.5),
    leaf: (x, y) => rr(x + 2, y + 2, 3, 3, [1.5, 0.3, 1.5, 0.3]),
  };

  // ロゴの下を空けるところ（マスの区切りにそろえた正方形。マスの数は奇数にして真ん中に置く）
  function plateRect(qr, st) {
    const lg = st.logo;
    if (!lg || !lg.img || !lg.plate) return null;
    let k = Math.ceil(qr.size * lg.ratio + 1);
    if (k % 2 !== qr.size % 2) k++;
    const p = (qr.size - k) / 2;
    return { x: p, y: p, w: k };
  }

  function coverage(qr, st) {
    const pr = plateRect(qr, st);
    if (!pr) return 0;
    let n = 0, all = 0;
    for (let y = 0; y < qr.size; y++) for (let x = 0; x < qr.size; x++) {
      if (qr.fn[y * qr.size + x]) continue;
      all++;
      if (x >= pr.x && x < pr.x + pr.w && y >= pr.y && y < pr.y + pr.w) n++;
    }
    return n / all;
  }

  function shapes(qr, st) {
    const size = qr.size, m = st.margin ?? 4;
    const pr = plateRect(qr, st);
    const eye = (x, y) => (x < 7 && y < 7) || (x >= size - 7 && y < 7) || (x < 7 && y >= size - 7);
    const on = (x, y) => x >= 0 && y >= 0 && x < size && y < size && qr.modules[y * size + x] === 1 && !eye(x, y) &&
      !(pr && x >= pr.x && x < pr.x + pr.w && y >= pr.y && y < pr.y + pr.w);
    let dots = '';
    const dot = st.dot || 'square';
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        if (!on(x, y)) continue;
        const X = x + m, Y = y + m;
        if (dot === 'square') {
          // 横に続くところは1つの四角にまとめる
          let len = 1;
          while (on(x + len, y)) len++;
          dots += `M${X} ${Y}h${len}v1h${-len}Z`;
          x += len - 1;
        } else if (dot === 'dot') {
          dots += circle(X + 0.5, Y + 0.5, 0.45);
        } else if (dot === 'rounded') {
          dots += rr(X + 0.04, Y + 0.04, 0.92, 0.92, 0.3);
        } else {
          const l = on(x - 1, y), r = on(x + 1, y), u = on(x, y - 1), d = on(x, y + 1);
          dots += rr(X, Y, 1, 1, [!l && !u ? 0.5 : 0, !r && !u ? 0.5 : 0, !r && !d ? 0.5 : 0, !l && !d ? 0.5 : 0]);
        }
      }
    }
    const out = EYE_OUT[st.eye] || EYE_OUT.square, inn = EYE_IN[st.eyeIn] || EYE_IN.square;
    let eyeOut = '', eyeIn = '';
    for (const [x, y] of [[0, 0], [size - 7, 0], [0, size - 7]]) {
      eyeOut += out(x + m, y + m);
      eyeIn += inn(x + m, y + m);
    }
    return { n: size + m * 2, m, dots, eyeOut, eyeIn, plate: pr && { x: pr.x + m, y: pr.y + m, w: pr.w } };
  }

  // ロゴを置くところ（下を空けるときは、空けたところの内側）
  function logoRect(qr, st, sh) {
    const lg = st.logo;
    const w = lg.img.naturalWidth || lg.img.width, h = lg.img.naturalHeight || lg.img.height;
    let box;
    if (sh.plate) box = { x: sh.plate.x + 0.5, y: sh.plate.y + 0.5, w: sh.plate.w - 1 };
    else {
      const s = qr.size * lg.ratio;
      box = { x: sh.m + (qr.size - s) / 2, y: sh.m + (qr.size - s) / 2, w: s };
    }
    const k = Math.min(box.w / w, box.w / h);
    return { x: box.x + (box.w - w * k) / 2, y: box.y + (box.w - h * k) / 2, w: w * k, h: h * k };
  }

  function gradEnds(sh, dir) {
    const a = sh.m, b = sh.n - sh.m;
    if (dir === 'h') return [a, a, b, a];
    if (dir === 'v') return [a, a, a, b];
    return [a, a, b, b];
  }

  function draw(ctx, qr, st, px) {
    const sh = shapes(qr, st);
    const s = px / sh.n;
    ctx.save();
    ctx.clearRect(0, 0, px, px);
    if (st.bg) {
      ctx.fillStyle = st.bg;
      ctx.fillRect(0, 0, px, px);
    }
    ctx.scale(s, s);
    let paint = st.fg || '#000';
    if (st.fg2) {
      const g = ctx.createLinearGradient(...gradEnds(sh, st.gradDir));
      g.addColorStop(0, st.fg || '#000');
      g.addColorStop(1, st.fg2);
      paint = g;
    }
    ctx.fillStyle = paint;
    ctx.fill(new Path2D(sh.dots));
    ctx.fillStyle = st.eyeColor || paint;
    ctx.fill(new Path2D(sh.eyeOut), 'evenodd');
    ctx.fillStyle = st.eyeInColor || st.eyeColor || paint;
    ctx.fill(new Path2D(sh.eyeIn));
    if (st.logo && st.logo.img) {
      const r = logoRect(qr, st, sh);
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(st.logo.img, r.x, r.y, r.w, r.h);
    }
    ctx.restore();
  }

  const esc = s => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

  function svg(qr, st, px) {
    const sh = shapes(qr, st);
    const fg = st.fg || '#000';
    let defs = '', paint = esc(fg);
    if (st.fg2) {
      const [x1, y1, x2, y2] = gradEnds(sh, st.gradDir);
      defs = `<defs><linearGradient id="g" gradientUnits="userSpaceOnUse" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}">` +
        `<stop offset="0" stop-color="${esc(fg)}"/><stop offset="1" stop-color="${esc(st.fg2)}"/></linearGradient></defs>`;
      paint = 'url(#g)';
    }
    let body = '';
    if (st.bg) body += `<rect width="${sh.n}" height="${sh.n}" fill="${esc(st.bg)}"/>`;
    body += `<path d="${sh.dots}" fill="${paint}"/>`;
    body += `<path d="${sh.eyeOut}" fill="${st.eyeColor ? esc(st.eyeColor) : paint}" fill-rule="evenodd"/>`;
    body += `<path d="${sh.eyeIn}" fill="${st.eyeInColor ? esc(st.eyeInColor) : st.eyeColor ? esc(st.eyeColor) : paint}"/>`;
    if (st.logo && st.logo.img && st.logo.src) {
      const r = logoRect(qr, st, sh);
      body += `<image href="${esc(st.logo.src)}" x="${f(r.x)}" y="${f(r.y)}" width="${f(r.w)}" height="${f(r.h)}" preserveAspectRatio="xMidYMid meet"/>`;
    }
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${px}" height="${px}" viewBox="0 0 ${sh.n} ${sh.n}">${defs}${body}</svg>`;
  }

  global.QrCore = { encode, draw, svg, coverage, ECLS };
})(window);
