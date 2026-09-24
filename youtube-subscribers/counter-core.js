/*
 * 登録者数カウンター — 設定ページ（index.html）と表示ページ（view.html）で共通の部品
 *  - 設定の初期値・読み込み
 *  - 設定 ⇔ URL（# 以降）の変換
 *  - 見た目の CSS 生成
 * フォント一覧・文字効果は ../chat-css-generator/chat-core.js（window.ChatCore）を使う。
 * このファイルを変えたら、読み込んでいる2ページの ?v= を上げる。
 */
(function (global) {
  'use strict';
  const C = global.ChatCore;

  const DEFAULTS = {
    font: 'M PLUS Rounded 1c', fontCustom: '', weight: '900', scale: 2, spacing: 0, tabular: true,
    colorMode: 'solid', color: '#ffffff', grad1: '#ffec61', grad2: '#f321d7', grad3On: false, grad3: '#2366f7', gradAngle: 135,
    textEffect: 'outline', effectWidth: 3, effectColor: '#000000',
    labelText: 'チャンネル登録者数', labelPos: 'above', labelSize: 28, labelColor: '#ffffff', labelWeight: '700',
    suffixText: '人', suffixSize: 40, suffixColor: '#ffffff',
    boxOn: false, boxBg: '#000000', boxAlpha: 0.5, boxRadius: 24, boxPadX: 36, boxPadY: 18,
    boxBorder: false, boxBorderWidth: 3, boxBorderStyle: 'solid', boxBorderColor: '#ff85a1',
    hAlign: 'center', vAlign: 'center', edge: 24,
    countUp: true, pop: true,
    idle: 'none', idleDur: 2.4,
  };
  const COLOR_KEYS = Object.keys(DEFAULTS).filter(k => /^#[0-9a-f]{6}$/i.test(String(DEFAULTS[k])));

  function sanitize(obj) {
    const out = { ...DEFAULTS };
    if (!obj || typeof obj !== 'object') return out;
    for (const k of Object.keys(DEFAULTS)) {
      if (!(k in obj)) continue;
      const d = DEFAULTS[k], v = obj[k];
      if (typeof d === 'number' && typeof v === 'number' && isFinite(v)) out[k] = v;
      else if (typeof d === 'boolean' && typeof v === 'boolean') out[k] = v;
      else if (typeof d === 'string' && typeof v === 'string') {
        if (COLOR_KEYS.includes(k) && !/^#[0-9a-f]{6}$/i.test(v)) continue;
        out[k] = v;
      }
    }
    return out;
  }

  // ---------------------------------------------------------------
  //  URL（# 以降）
  //  APIキーはサーバーに送られないよう、? ではなく # のあとに入れる。
  //  見た目の設定は初期値と違う項目だけを JSON → base64url にして s= に入れる。
  // ---------------------------------------------------------------
  const b64url = {
    enc(str) {
      let bin = '';
      for (const b of new TextEncoder().encode(str)) bin += String.fromCharCode(b);
      return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    },
    dec(str) {
      const bin = atob(str.replace(/-/g, '+').replace(/_/g, '/'));
      return new TextDecoder().decode(Uint8Array.from(bin, ch => ch.charCodeAt(0)));
    },
  };

  function encodeHash(conn, s) {
    const diff = {};
    for (const k of Object.keys(DEFAULTS)) if (s[k] !== DEFAULTS[k]) diff[k] = s[k];
    const p = new URLSearchParams();
    if (conn.key) p.set('key', conn.key);
    if (conn.channel) p.set('ch', conn.channel);
    if (conn.interval) p.set('t', String(conn.interval));
    if (Object.keys(diff).length) p.set('s', b64url.enc(JSON.stringify(diff)));
    return p.toString();
  }

  function decodeHash(hash) {
    const p = new URLSearchParams(String(hash || '').replace(/^#/, ''));
    let s = { ...DEFAULTS };
    try { if (p.get('s')) s = sanitize(JSON.parse(b64url.dec(p.get('s')))); } catch (e) { /* 壊れた設定は初期値で表示 */ }
    return {
      conn: { key: p.get('key') || '', channel: p.get('ch') || '', interval: +p.get('t') || 30 },
      demo: p.get('demo') === '1',
      s,
    };
  }

  // 「UC…」のチャンネルID、「@ハンドル」、チャンネルのURL のどれでも受け付ける
  function channelQuery(input) {
    const v = String(input || '').trim();
    const id = v.match(/(UC[A-Za-z0-9_-]{22})/);
    if (id) return { id: id[1] };
    const handle = v.match(/@([A-Za-z0-9._-]{3,30})/) || v.match(/^([A-Za-z0-9._-]{3,30})$/);
    if (handle) return { forHandle: '@' + handle[1] };
    return null;
  }

  // YouTube Data API v3 channels.list（1回 1ユニット）で登録者数を取る
  async function fetchChannel(key, channel) {
    const q = channelQuery(channel);
    if (!key) throw new Error('APIキーが入っていません');
    if (!q) throw new Error('チャンネルID（UC…）か @ハンドル を入れてください');
    const p = new URLSearchParams({ part: 'snippet,statistics', key, ...q });
    const res = await fetch('https://www.googleapis.com/youtube/v3/channels?' + p);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const reason = data.error && data.error.errors && data.error.errors[0] && data.error.errors[0].reason;
      const msg = {
        keyInvalid: 'APIキーが正しくありません',
        badRequest: 'APIキーが正しくありません',
        quotaExceeded: '今日のAPI使用量の上限に達しました（日本時間の16〜17時ごろにリセット）',
        dailyLimitExceeded: '今日のAPI使用量の上限に達しました（日本時間の16〜17時ごろにリセット）',
        accessNotConfigured: 'このAPIキーのプロジェクトで「YouTube Data API v3」が有効になっていません',
        forbidden: 'このAPIキーでは使えません（キーの制限設定を確認してください）',
        ipRefererBlocked: 'APIキーの「ウェブサイトの制限」でこのページが許可されていません',
      }[reason];
      throw new Error(msg || `取得できませんでした（${res.status}${reason ? ' ' + reason : ''}）`);
    }
    const ch = data.items && data.items[0];
    if (!ch) throw new Error('チャンネルが見つかりません');
    if (ch.statistics.hiddenSubscriberCount) throw new Error('このチャンネルは登録者数を非公開にしています');
    return { title: ch.snippet.title, count: +ch.statistics.subscriberCount };
  }

  // ---------------------------------------------------------------
  //  見た目の CSS（view.html の #box > .cc-label / .cc-num / .cc-suffix 用）
  // ---------------------------------------------------------------
  const px = n => `${+(+n).toFixed(2)}px`;
  const IDLE = {
    pulse: { l: 'ドクンと脈打つ', kf: ['0%, 100% { transform: scale(1); }', '50% { transform: scale(1.06); }'] },
    float: { l: 'ふわふわ浮かぶ', kf: ['0%, 100% { transform: translateY(0); }', '50% { transform: translateY(-8px); }'] },
    swing: { l: 'ゆらゆら揺れる', kf: ['0%, 100% { transform: rotate(-2deg); }', '50% { transform: rotate(2deg); }'] },
    glow: { l: 'キラキラ光る（明るさ）', kf: ['0%, 100% { filter: brightness(1); }', '50% { filter: brightness(1.35); }'] },
  };

  function generateCSS(s) {
    const out = [];
    const rule = (sel, props) => {
      const body = Object.entries(props).filter(([, v]) => v !== null && v !== undefined && v !== '')
        .map(([k, v]) => `  ${k}: ${v};`).join('\n');
      if (body) out.push(`${sel} {\n${body}\n}`);
    };
    const font = C.fontInfo(s);
    if (font && font.url) out.push(`@import url("${font.url}");`);
    const ff = font ? font.family : null;
    const shadow = C.textShadow(s);

    const flexPos = { left: 'flex-start', center: 'center', right: 'flex-end', top: 'flex-start', bottom: 'flex-end' };
    rule('html, body', { margin: '0', height: '100%', background: 'transparent', overflow: 'hidden' });
    rule('body', {
      display: 'flex', 'justify-content': flexPos[s.hAlign], 'align-items': flexPos[s.vAlign],
      padding: px(s.edge), 'box-sizing': 'border-box',
    });

    // 見出しが上: 1行目に見出し、2行目に数字と単位。見出しが左: 見出し・数字・単位を横に並べる
    const above = s.labelPos === 'above';
    const label = s.labelPos !== 'none' && s.labelText.trim();
    const suffix = s.suffixText.trim();
    const box = {
      display: 'grid', 'grid-auto-flow': 'column', 'align-items': 'baseline', 'justify-items': 'center',
      'column-gap': px(8), 'row-gap': px(4),
    };
    if (above && label) Object.assign(box, { 'grid-auto-flow': 'row', 'grid-template-columns': suffix ? 'auto auto' : 'auto' });
    if (s.boxOn) {
      Object.assign(box, {
        'background-color': C.hexToRgba(s.boxBg, s.boxAlpha), 'border-radius': px(s.boxRadius),
        padding: `${px(s.boxPadY)} ${px(s.boxPadX)}`,
      });
      if (s.boxBorder) box.border = `${px(s.boxBorderWidth)} ${s.boxBorderStyle} ${s.boxBorderColor}`;
    }
    if (IDLE[s.idle]) {
      out.push(`@keyframes cc-idle {\n  ${IDLE[s.idle].kf.join('\n  ')}\n}`);
      box.animation = `cc-idle ${s.idleDur}s ease-in-out infinite`;
    }
    rule('#box', box);

    const num = {
      'font-family': ff, 'font-weight': s.weight, 'font-size': px(40 * s.scale), 'line-height': '1.15',
      'letter-spacing': s.spacing ? px(s.spacing) : null, 'font-variant-numeric': s.tabular ? 'tabular-nums' : null,
      'white-space': 'nowrap',
      // 見出しの方が長いと列が広がるので、数字と単位は列の境目に寄せてくっつける
      'justify-self': above && label && suffix ? 'end' : null,
    };
    if (s.colorMode === 'solid') {
      Object.assign(num, { color: s.color, 'text-shadow': shadow || null });
    } else {
      // グラデーションは文字の形に切り抜くので、縁取りは text-stroke、影・発光は drop-shadow で付ける
      const stops = [s.grad1, s.grad2, ...(s.grad3On ? [s.grad3] : [])];
      const rainbow = s.colorMode === 'rainbow';
      Object.assign(num, {
        color: 'transparent', '-webkit-text-fill-color': 'transparent',
        'background-image': rainbow
          ? 'linear-gradient(90deg, #ff5f6d, #ffc371, #7dff9b, #47c8ff, #b06bff, #ff5f6d)'
          : `linear-gradient(${s.gradAngle}deg, ${stops.join(', ')})`,
        'background-size': rainbow ? '200% 100%' : null,
        '-webkit-background-clip': 'text', 'background-clip': 'text',
      });
      if (s.textEffect === 'outline') num['-webkit-text-stroke'] = `${px(s.effectWidth / 2)} ${s.effectColor}`;
      if (s.textEffect === 'shadow') num.filter = `drop-shadow(${px(s.effectWidth)} ${px(s.effectWidth)} ${px(s.effectWidth)} ${s.effectColor})`;
      if (s.textEffect === 'glow') num.filter = `drop-shadow(0 0 ${px(s.effectWidth * 2)} ${s.effectColor})`;
      if (rainbow) {
        out.push('@keyframes cc-rainbow {\n  from { background-position: 0% 0; }\n  to { background-position: 200% 0; }\n}');
        num.animation = 'cc-rainbow 4s linear infinite';
      }
    }
    rule('.cc-num', num);
    out.push('@keyframes cc-pop {\n  0% { transform: scale(1); }\n  30% { transform: scale(1.18); }\n  100% { transform: scale(1); }\n}');
    rule('.cc-num.pop', { animation: [num.animation, 'cc-pop 0.6s ease-out'].filter(Boolean).join(', ') });

    const textPart = (size, color) => ({
      'font-family': ff, 'font-size': px(size), color, 'font-weight': s.labelWeight,
      'text-shadow': shadow || null, 'line-height': '1.2', 'white-space': 'nowrap',
    });
    rule('.cc-label', label
      ? { ...textPart(s.labelSize, s.labelColor), 'grid-column': above ? '1 / -1' : null }
      : { display: 'none' });
    rule('.cc-suffix', suffix
      ? { ...textPart(s.suffixSize, s.suffixColor), 'justify-self': above && label ? 'start' : null }
      : { display: 'none' });
    return out.join('\n') + '\n';
  }

  global.CounterCore = { DEFAULTS, sanitize, encodeHash, decodeHash, channelQuery, fetchChannel, generateCSS, IDLE };
})(window);
