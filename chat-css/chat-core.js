/**
 * どんまうんど チャットCSSジェネレーター 共通コード
 * CSSの生成と、プレビュー用のチャット欄の見本DOMをまとめています。
 */
(function (global) {
  'use strict';

  // =====================================================
  //  フォント（Google Fonts）
  //  [フォント名, 表示名, 読み込むウェイト]
  // =====================================================
  const FONTS = [
    ['', 'サイト標準（Roboto）', ''],
    ['Noto Sans JP', 'Noto Sans JP（ゴシック）', '100..900'],
    ['M PLUS Rounded 1c', 'M PLUS Rounded 1c（丸ゴシック）', '100;300;400;500;700;800;900'],
    ['Zen Maru Gothic', 'Zen Maru Gothic（丸ゴシック）', '300;400;500;700;900'],
    ['Kosugi Maru', '小杉丸ゴシック', ''],
    ['Zen Kaku Gothic New', 'Zen Kaku Gothic New（ゴシック）', '300;400;500;700;900'],
    ['Mochiy Pop One', 'モッチーポップ', ''],
    ['Hachi Maru Pop', 'はちまるポップ', ''],
    ['Dela Gothic One', 'デラゴシック', ''],
    ['RocknRoll One', 'ロックンロール', ''],
    ['Reggae One', 'レゲエ', ''],
    ['DotGothic16', 'ドットゴシック16', ''],
    ['Yusei Magic', '油性マジック', ''],
    ['Klee One', 'クレー（手書き風）', '400;600'],
    ['Kaisei Decol', '解星デコール', '400;500;700'],
    ['Noto Serif JP', 'Noto Serif JP（明朝）', '200..900'],
    ['Shippori Mincho', 'しっぽり明朝', '400;500;600;700;800'],
    ['__custom', '手動で指定（PCのフォント）', ''],
  ];

  const WEIGHTS = [
    ['100', 'Thin 100'], ['300', 'Light 300'], ['400', 'Regular 400'],
    ['500', 'Medium 500'], ['700', 'Bold 700'], ['900', 'Black 900'],
  ];

  // =====================================================
  //  スパチャの金額帯
  //  YouTube は金額帯ごとの色を各スパチャ要素の style 属性に
  //  「--yt-live-chat-paid-message-primary-color: rgba(...)」として書き込むので、
  //  その色で金額帯を見分けます（通貨が違っても段階は共通）。
  //  [目安の金額, 下部の色, 上部の色, 文字色, 下部の色(hex), 上部の色(hex)]
  // =====================================================
  const SC_TIERS = [
    ['¥100', 'rgba(30,136,229,1)', 'rgba(21,101,192,1)', '#ffffff', '#1e88e5', '#1565c0'],
    ['¥200', 'rgba(0,229,255,1)', 'rgba(0,184,212,1)', '#000000', '#00e5ff', '#00b8d4'],
    ['¥500', 'rgba(29,233,182,1)', 'rgba(0,191,165,1)', '#000000', '#1de9b6', '#00bfa5'],
    ['¥1,000', 'rgba(255,202,40,1)', 'rgba(255,179,0,1)', '#000000', '#ffca28', '#ffb300'],
    ['¥2,000', 'rgba(245,124,0,1)', 'rgba(230,81,0,1)', '#ffffff', '#f57c00', '#e65100'],
    ['¥5,000', 'rgba(233,30,99,1)', 'rgba(194,24,91,1)', '#ffffff', '#e91e63', '#c2185b'],
    ['¥10,000', 'rgba(230,33,23,1)', 'rgba(208,0,0,1)', '#ffffff', '#e62117', '#d00000'],
  ];

  // 演出を個別に設定できるグループ（金額帯7つ＋ステッカー＋メンバー加入）
  // 設定のキーは sc{id}In / sc{id}Fx / sc{id}Count / sc{id}Scale / sc{id}Keep（金額帯は色も）
  const SC_GROUPS = [
    ...SC_TIERS.map((t, i) => ({ id: String(i + 1), label: t[0], tier: i })),
    { id: 'St', label: 'ステッカー' },
    { id: 'Mem', label: 'メンバー加入' },
  ];
  // [登場のしかた, 登場後の演出, 回数, 大きさ]
  const SC_GROUP_DEFAULTS = {
    1: ['same', 'none', '3', 1], 2: ['same', 'none', '3', 1], 3: ['pop', 'none', '3', 1],
    4: ['impact', 'shine', '3', 1.05], 5: ['impact', 'shine', '3', 1.1], 6: ['slam', 'glow', '3', 1.2],
    7: ['impact', 'rainbow', 'infinite', 1.3], St: ['pop', 'none', '3', 1], Mem: ['same', 'none', '3', 1],
  };

  // =====================================================
  //  初期値
  // =====================================================
  const DEFAULTS = {
    platform: 'youtube', twChannel: '',

    font: 'M PLUS Rounded 1c', fontCustom: '',
    textEffect: 'outline', effectWidth: 2, effectColor: '#000000',

    msgSize: 18, msgWeight: '700', msgColor: '#ffffff', lineHeight: 1.5, emojiSize: 24,

    showIcon: true, iconSize: 32, iconShape: 'circle',

    showName: true, nameSize: 14, nameWeight: '700',
    nameColor: '#dddddd', memberColor: '#5ee07a', modColor: '#8fb0ff', ownerColor: '#ffd600',
    showBadges: true, nameColon: false, nameBreak: true,

    showTime: false, timeSize: 12, timeColor: '#bbbbbb',

    bubble: false, bubbleTail: true, bubbleColor: '#000000', bubbleAlpha: 0.5, bubbleRadius: 12, bubblePadding: 8,
    roleBg: false, ownerBg: '#b58900', modBg: '#2b4fb8', memberBg: '#1d7a37', roleBgAlpha: 0.6,
    chatBg: '#000000', chatBgAlpha: 0,

    itemGap: 6, sidePad: 10,

    showSuperchat: true, scMode: 'youtube',
    scHeader: '#ff4fa3', scBody: '#ff78b9', scText: '#ffffff',
    scRadius: 10, scNameSize: 14, scAmountSize: 16, scMsgSize: 16,
    showStickers: true,

    showMembership: true, memHeaderText: true,

    // スパチャの演出（YouTube）。金額帯ごとの設定は下の SC_GROUPS から追加
    scAnimDur: 0.7, scGlowColor: '#ffd54f',

    // リアクション（YouTube）: hide / inline（チャット欄に重ねる）/ separate（リアクション専用のブラウザソース）
    reactMode: 'hide', reactScale: 3, reactRight: 40, reactBottom: 40,

    animIn: 'slide-left', animDur: 0.4,
    fadeOut: false, animOut: 'fade', fadeOutDelay: 20, fadeOutDur: 0.6,

    // Twitch 専用
    twUserColor: true, twHideUsers: '',
  };
  for (const g of SC_GROUPS) {
    const [inAnim, fx, count, scale] = SC_GROUP_DEFAULTS[g.id];
    Object.assign(DEFAULTS, {
      [`sc${g.id}In`]: inAnim, [`sc${g.id}Fx`]: fx, [`sc${g.id}Count`]: count, [`sc${g.id}Scale`]: scale,
      [`sc${g.id}Keep`]: g.id !== 'Mem',
    });
    if (g.tier !== undefined) {
      const t = SC_TIERS[g.tier];
      Object.assign(DEFAULTS, {
        [`sc${g.id}Color`]: 'default', [`sc${g.id}Header`]: t[5], [`sc${g.id}Body`]: t[4], [`sc${g.id}Text`]: t[3],
      });
    }
  }

  const COLOR_KEYS = Object.keys(DEFAULTS).filter(k => /^#[0-9a-f]{6}$/i.test(String(DEFAULTS[k])));

  // 以前の「スパチャの演出」（全金額帯共通の設定）を、金額帯ごとの設定に引き継ぐ
  function migrate(o) {
    if (!('scAnimIn' in o || 'scEffect' in o) || 'sc1In' in o) return o;
    const m = { ...o };
    const min = parseInt(o.scFxMinTier, 10) || 1;
    SC_TIERS.forEach((_, i) => {
      const id = i + 1, on = id >= min;
      if (typeof o.scAnimIn === 'string') m[`sc${id}In`] = on ? o.scAnimIn : 'same';
      if (typeof o.scEffect === 'string') m[`sc${id}Fx`] = on ? o.scEffect : 'none';
      if (typeof o.scEffectCount === 'string') m[`sc${id}Count`] = o.scEffectCount;
      if (typeof o.scKeep === 'boolean') m[`sc${id}Keep`] = o.scKeep;
      m[`sc${id}Scale`] = o.scScaleByTier ? +(1 + ((o.scScaleMax || 1.4) - 1) * i / (SC_TIERS.length - 1)).toFixed(2) : 1;
    });
    if (typeof o.scTopEffect === 'string' && o.scTopEffect !== 'none') {
      m[`sc${SC_TIERS.length}Fx`] = o.scTopEffect;
      m[`sc${SC_TIERS.length}Count`] = 'infinite';
    }
    // 下限が「すべて」のときはステッカーも同じ演出だった
    if (typeof o.scAnimIn === 'string') {
      m.scStIn = min <= 1 ? o.scAnimIn : 'same';
      m.scStFx = min <= 1 && typeof o.scEffect === 'string' ? o.scEffect : 'none';
      if (typeof o.scEffectCount === 'string') m.scStCount = o.scEffectCount;
      if (typeof o.scKeep === 'boolean') m.scStKeep = o.scKeep;
    }
    if (o.scFxMember === true) {
      if (typeof o.scAnimIn === 'string') m.scMemIn = o.scAnimIn;
      if (typeof o.scEffect === 'string') m.scMemFx = o.scEffect;
      if (typeof o.scEffectCount === 'string') m.scMemCount = o.scEffectCount;
      if (typeof o.scKeep === 'boolean') m.scMemKeep = o.scKeep;
    }
    return m;
  }

  // 既知のキー・型だけ取り込む
  function sanitize(obj) {
    const out = { ...DEFAULTS };
    if (!obj || typeof obj !== 'object') return out;
    obj = migrate(obj);
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

  // =====================================================
  //  CSS 生成
  // =====================================================
  const hexToRgba = (hex, a) => {
    const n = parseInt(hex.slice(1), 16);
    return `rgba(${n >> 16 & 255}, ${n >> 8 & 255}, ${n & 255}, ${+a.toFixed(2)})`;
  };
  const px = n => `${+(+n).toFixed(2)}px`;
  const cleanFont = s => s.replace(/["'<>;{}\\]/g, '').trim();

  function textShadow(s) {
    const w = s.effectWidth, c = s.effectColor;
    if (s.textEffect === 'outline') {
      const rings = w > 2 ? [w, w / 2] : [w];
      const parts = [];
      for (const r of rings) {
        for (let i = 0; i < 16; i++) {
          const a = (Math.PI * 2 * i) / 16;
          parts.push(`${px(Math.cos(a) * r)} ${px(Math.sin(a) * r)} 0 ${c}`);
        }
      }
      return parts.join(', ');
    }
    if (s.textEffect === 'shadow') return `${px(w)} ${px(w)} ${px(w)} ${c}`;
    if (s.textEffect === 'glow') return `0 0 ${px(w)} ${c}, 0 0 ${px(w * 2)} ${c}, 0 0 ${px(w * 4)} ${c}`;
    return '';
  }

  function fontInfo(s) {
    if (s.font === '__custom') {
      const name = cleanFont(s.fontCustom);
      return name ? { family: `"${name}", sans-serif`, url: '' } : null;
    }
    const f = FONTS.find(x => x[0] === s.font);
    if (!f || !f[0]) return null;
    const url = `https://fonts.googleapis.com/css2?family=${f[0].replace(/ /g, '+')}${f[2] ? ':wght@' + f[2] : ''}&display=swap`;
    return { family: `"${f[0]}", sans-serif`, url };
  }

  // CSSを組み立てる小道具（すべて !important 付きで出力）
  function writer() {
    const out = [];
    const rule = (sel, props) => {
      const body = Object.entries(props)
        .filter(([, v]) => v !== null && v !== undefined && v !== '')
        .map(([k, v]) => `  ${k}: ${v} !important;`).join('\n');
      if (body) out.push(`${sel} {\n${body}\n}`);
    };
    const hide = sel => rule(sel, { display: 'none' });
    const head = t => out.push(`\n/* ===== ${t} ===== */`);
    const done = () => out.join('\n') + '\n';
    return { out, rule, hide, head, done };
  }

  function writeHeader(s, w) {
    const font = fontInfo(s);
    w.out.push('/* どんまうんど チャットCSSジェネレーター https://donnma.com/tool/chat-css/ */');
    if (font && font.url) w.out.push(`@import url("${font.url}");`);
    return font;
  }

  // =====================================================
  //  アニメーションのテンプレート
  //  { 表示名, キーフレーム, イージング }。ここに足すとジェネレーターの選択肢にも出ます。
  // =====================================================
  const SMOOTH = 'cubic-bezier(0.2, 0.8, 0.2, 1)';
  const IN_ANIMS = {
    fade: { l: 'ふわっと表示', ease: 'ease-out', kf: ['from { opacity: 0; }', 'to { opacity: 1; }'] },
    'slide-left': { l: '左からスライド', ease: SMOOTH, kf: ['from { opacity: 0; transform: translateX(-40px); }', 'to { opacity: 1; transform: none; }'] },
    'slide-right': { l: '右からスライド', ease: SMOOTH, kf: ['from { opacity: 0; transform: translateX(40px); }', 'to { opacity: 1; transform: none; }'] },
    'slide-up': { l: '下からスライド', ease: SMOOTH, kf: ['from { opacity: 0; transform: translateY(24px); }', 'to { opacity: 1; transform: none; }'] },
    zoom: { l: 'ポンッと拡大', ease: SMOOTH, kf: ['from { opacity: 0; transform: scale(0.8); }', 'to { opacity: 1; transform: none; }'] },
    pop: {
      l: 'ぷるんと弾む', ease: 'ease-out', kf: [
        '0% { opacity: 0; transform: scale(0.3); }', '55% { opacity: 1; transform: scale(1.1); }',
        '75% { transform: scale(0.95); }', '100% { opacity: 1; transform: none; }'],
    },
    bounce: {
      l: '下からぴょんっと跳ねる', ease: 'ease-out', kf: [
        '0% { opacity: 0; transform: translateY(30px); }', '50% { opacity: 1; transform: translateY(-10px); }',
        '75% { transform: translateY(3px); }', '100% { opacity: 1; transform: none; }'],
    },
    drop: {
      l: '上から落ちてくる', ease: 'ease-out', kf: [
        '0% { opacity: 0; transform: translateY(-30px); }', '60% { opacity: 1; transform: translateY(6px); }',
        '80% { transform: translateY(-2px); }', '100% { opacity: 1; transform: none; }'],
    },
    jelly: {
      l: 'ぷにっと伸び縮み', ease: 'ease-out', kf: [
        '0% { opacity: 0; transform: scale(0.6, 0.6); }', '30% { opacity: 1; transform: scale(1.2, 0.8); }',
        '50% { transform: scale(0.9, 1.1); }', '70% { transform: scale(1.05, 0.95); }', '100% { opacity: 1; transform: none; }'],
    },
    flip: {
      l: 'くるっとめくれる', ease: SMOOTH, kf: [
        'from { opacity: 0; transform-origin: top center; transform: perspective(400px) rotateX(-90deg); }',
        'to { opacity: 1; transform-origin: top center; transform: none; }'],
    },
    swing: {
      l: 'ゆらっと揺れて登場', ease: 'ease-out', kf: [
        '0% { opacity: 0; transform-origin: left center; transform: translateX(-20px) rotate(-8deg); }',
        '60% { opacity: 1; transform-origin: left center; transform: rotate(3deg); }',
        '100% { opacity: 1; transform-origin: left center; transform: none; }'],
    },
    blur: { l: 'ぼかしからくっきり', ease: 'ease-out', kf: ['from { opacity: 0; filter: blur(8px); transform: scale(1.05); }', 'to { opacity: 1; filter: none; transform: none; }'] },
  };
  const OUT_ANIMS = {
    fade: { l: 'ふわっと消える', ease: 'ease-in', kf: ['to { opacity: 0; }'] },
    'float-up': { l: '上に浮かんで消える', ease: 'ease-in', kf: ['to { opacity: 0; transform: translateY(-20px); }'] },
    'slide-left': { l: '左へ流れて消える', ease: 'ease-in', kf: ['to { opacity: 0; transform: translateX(-60px); }'] },
    'slide-right': { l: '右へ流れて消える', ease: 'ease-in', kf: ['to { opacity: 0; transform: translateX(60px); }'] },
    shrink: { l: 'しゅっと縮んで消える', ease: 'ease-in', kf: ['to { opacity: 0; transform: scale(0.6); }'] },
    blur: { l: 'ぼやけて消える', ease: 'ease-in', kf: ['to { opacity: 0; filter: blur(8px); }'] },
  };

  // スパチャ専用の登場アニメーション（通常コメント用の IN_ANIMS も選べます）
  const SC_IN_ANIMS = {
    impact: {
      l: 'ドーンと登場', ease: 'ease-out', kf: [
        '0% { opacity: 0; transform: scale(2.2); }', '55% { opacity: 1; transform: scale(0.92); }',
        '75% { transform: scale(1.04); }', '100% { opacity: 1; transform: none; }'],
    },
    slam: {
      l: '上から叩きつける', ease: 'ease-out', kf: [
        '0% { opacity: 0; transform: translateY(-120px); }', '50% { opacity: 1; transform: translateY(0) scale(1.06, 0.88); }',
        '70% { transform: translateY(-8px) scale(0.98, 1.03); }', '100% { opacity: 1; transform: none; }'],
    },
    spin: { l: 'くるっと回って登場', ease: SMOOTH, kf: ['from { opacity: 0; transform: rotate(-200deg) scale(0.2); }', 'to { opacity: 1; transform: none; }'] },
    rise: { l: '下からせり上がる', ease: SMOOTH, kf: ['from { opacity: 0; transform: translateY(80px) scale(0.9); }', 'to { opacity: 1; transform: none; }'] },
  };

  // スパチャのカード（#card）にかける登場後の演出。dur は1回分の長さ（秒）
  const SC_EFFECTS = {
    shine: {
      l: 'キラッと光が走る', dur: 2.4, ease: 'ease-in-out', pseudo: '::after',
      card: { position: 'relative', overflow: 'hidden' },
      props: () => ({
        content: '""', position: 'absolute', top: '0', bottom: '0', left: '0', width: '45%', 'pointer-events': 'none',
        background: 'linear-gradient(100deg, transparent 0%, rgba(255, 255, 255, 0.6) 50%, transparent 100%)',
      }),
      kf: () => ['0% { transform: translateX(-150%) skewX(-20deg); }', '45%, 100% { transform: translateX(350%) skewX(-20deg); }'],
    },
    glow: {
      l: 'ふちが光る', dur: 1.6, ease: 'ease-in-out',
      kf: s => [`0%, 100% { box-shadow: 0 0 0 0 ${hexToRgba(s.scGlowColor, 0)}; }`, `50% { box-shadow: 0 0 16px 4px ${s.scGlowColor}; }`],
    },
    shake: {
      l: 'ブルブル揺れる', dur: 1.6, ease: 'linear',
      kf: () => ['0%, 40%, 100% { transform: none; }', '5%, 15%, 25%, 35% { transform: translateX(-4px) rotate(-1deg); }',
        '10%, 20%, 30% { transform: translateX(4px) rotate(1deg); }'],
    },
    pulse: {
      l: 'ドクンと脈打つ', dur: 1.4, ease: 'ease-in-out',
      kf: () => ['0%, 30%, 60%, 100% { transform: none; }', '15% { transform: scale(1.06); }', '45% { transform: scale(1.04); }'],
    },
    rainbow: {
      l: 'ゲーミング発光（虹色）', dur: 3, ease: 'linear',
      kf: () => ['from { filter: hue-rotate(0deg); }', 'to { filter: hue-rotate(360deg); }'],
    },
  };

  const keyframes = (name, kf) => `@keyframes ${name} {\n  ${kf.join('\n  ')}\n}`;

  function writeAnimation(s, w, selector) {
    const anims = [];
    const inAnim = IN_ANIMS[s.animIn];
    const outAnim = s.fadeOut ? (OUT_ANIMS[s.animOut] || OUT_ANIMS.fade) : null;
    if (inAnim || outAnim) w.head('アニメーション');
    if (inAnim) {
      w.out.push(keyframes('cc-in', inAnim.kf));
      anims.push(`cc-in ${s.animDur}s ${inAnim.ease} both`);
    }
    if (outAnim) {
      w.out.push(keyframes('cc-out', outAnim.kf));
      const delay = +(s.fadeOutDelay + (inAnim ? s.animDur : 0)).toFixed(2);
      anims.push(`cc-out ${s.fadeOutDur}s ${outAnim.ease} ${delay}s forwards`);
    }
    if (anims.length) w.rule(selector, { animation: anims.join(', ') });
  }

  const tierSel = (P, i) => `${P}[style*="${SC_TIERS[i][1]}"]`;

  // スパチャ・ステッカー・メンバー加入の演出を、グループ（金額帯など）ごとに書く
  // writeAnimation の後に書いて、通常コメントの動きを上書きします
  function writeSuperchatFx(s, w, { P, ST, M }) {
    const normalIn = IN_ANIMS[s.animIn];
    const out = OUT_ANIMS[s.animOut] || OUT_ANIMS.fade;
    const join = sels => sels.join(',\n');
    const emitted = new Set();
    const kf = (name, frames) => { if (!emitted.has(name)) { emitted.add(name); w.out.push(keyframes(name, frames)); } };
    let wroteHead = false;

    for (const g of SC_GROUPS) {
      const sel = g.tier !== undefined ? (s.showSuperchat ? tierSel(P, g.tier) : null)
        : g.id === 'St' ? (s.showStickers ? ST : null) : (s.showMembership ? M : null);
      if (!sel) continue;
      const v = k => s[`sc${g.id}${k}`];
      const inKey = v('In');
      const inAnim = inKey === 'same' ? null : (SC_IN_ANIMS[inKey] || IN_ANIMS[inKey]);
      const fx = SC_EFFECTS[v('Fx')];
      const keep = s.fadeOut && v('Keep');
      const scale = v('Scale');
      const custom = g.tier !== undefined && v('Color') === 'custom';
      if (!inAnim && !fx && !keep && scale === 1 && !custom) continue;
      if (!wroteHead) { w.head('スパチャの演出（金額帯ごと）'); wroteHead = true; }
      w.out.push(`/* ${g.label} */`);

      // 登場のしかた・消えるかどうか
      const inDur = inAnim ? s.scAnimDur : (normalIn ? s.animDur : 0);
      if (inAnim || keep) {
        const anims = [];
        if (inAnim) {
          kf(`cc-sc-in-${inKey}`, inAnim.kf);
          anims.push(`cc-sc-in-${inKey} ${s.scAnimDur}s ${inAnim.ease} both`);
        } else if (normalIn) {
          anims.push(`cc-in ${s.animDur}s ${normalIn.ease} both`);
        }
        if (s.fadeOut && !keep) anims.push(`cc-out ${s.fadeOutDur}s ${out.ease} ${+(s.fadeOutDelay + inDur).toFixed(2)}s forwards`);
        w.rule(sel, { animation: anims.length ? anims.join(', ') : 'none' });
      }

      // 登場後の演出（カードにかける）
      if (fx) {
        kf(`cc-sc-fx-${v('Fx')}`, fx.kf(s));
        if (fx.card) w.rule(`${sel} #card`, fx.card);
        w.rule(`${sel} #card${fx.pseudo || ''}`, {
          ...(fx.props ? fx.props(s) : {}),
          animation: `cc-sc-fx-${v('Fx')} ${fx.dur}s ${fx.ease} ${+inDur.toFixed(2)}s ${v('Count')} both`,
        });
      }

      if (scale !== 1) w.rule(sel, { zoom: String(scale) });

      if (custom) {
        w.rule(`${sel} #header`, { 'background-color': v('Header') });
        w.rule(`${sel} #content`, { 'background-color': v('Body') });
        w.rule(`${sel} #author-name, ${sel} #purchase-amount, ${sel} #message`, { color: v('Text') });
      }
    }
  }

  // 吹き出しのしっぽ（左向きの三角）。吹き出しの左外側に付きます
  const TAIL_W = 8;
  const tailProps = (color, top) => ({
    content: '""', position: 'absolute', top: px(top), left: px(-TAIL_W), width: '0', height: '0',
    'border-style': 'solid', 'border-width': `6px ${TAIL_W}px 6px 0`,
    'border-color': `transparent ${color} transparent transparent`,
  });

  // YouTube のチャット欄用
  function generate(s) {
    const T = 'yt-live-chat-text-message-renderer';
    const P = 'yt-live-chat-paid-message-renderer';
    const M = 'yt-live-chat-membership-item-renderer';
    const ST = 'yt-live-chat-paid-sticker-renderer';
    const w = writer();
    const { out, rule, hide, head } = w;
    const font = writeHeader(s, w);

    // 全体
    head('全体');
    const bg = s.chatBgAlpha > 0 ? hexToRgba(s.chatBg, s.chatBgAlpha) : 'transparent';
    rule('html, body', { 'background-color': bg, overflow: 'hidden' });
    rule('yt-live-chat-app, yt-live-chat-renderer, yt-live-chat-item-list-renderer,\n#item-scroller, #item-offset, #items', { 'background-color': 'transparent' });
    if (font) rule('yt-live-chat-renderer, yt-live-chat-renderer *', { 'font-family': font.family });
    rule('yt-live-chat-item-list-renderer #item-scroller', { overflow: 'hidden' });
    out.push('yt-live-chat-item-list-renderer #item-scroller::-webkit-scrollbar { display: none !important; }');

    head('不要な部分を非表示');
    // リアクションは入力欄（#panel-pages）の中にあるので、重ねて表示するときは入力欄を消さずに見えなくするだけにする
    const inlineReact = s.reactMode === 'inline';
    hide([
      'yt-live-chat-header-renderer', 'yt-live-chat-ticker-renderer',
      'yt-live-chat-banner-manager', 'yt-live-chat-viewer-engagement-message-renderer',
      'yt-live-chat-mode-change-message-renderer', 'yt-live-chat-restricted-participation-renderer',
      'yt-live-chat-docked-message', '#show-more', `${T} #menu`, `${T} #inline-action-button-container`,
      ...(inlineReact ? [] : ['yt-live-chat-message-input-renderer', 'yt-reaction-control-panel-overlay-view-model', '#panel-pages']),
    ].join(',\n'));
    if (inlineReact) {
      head('リアクション');
      rule('#panel-pages', {
        visibility: 'hidden', height: '0', 'min-height': '0', margin: '0', padding: '0', border: 'none', overflow: 'visible',
      });
      writeReactionFountain(s, w);
    }

    // 通常コメント
    head('通常コメント');
    const rowPad = `${px(s.itemGap / 2)} ${px(s.sidePad)}`;
    rule(T, { padding: rowPad, 'align-items': 'flex-start', overflow: 'visible' });

    if (!s.showIcon) hide(`${T} #author-photo`);
    else {
      const radius = { circle: '50%', rounded: '25%', square: '0' }[s.iconShape] || '50%';
      const sz = px(s.iconSize);
      rule(`${T} #author-photo`, {
        width: sz, height: sz, 'min-width': sz,
        'margin-right': px(Math.max(s.bubble && s.bubbleTail ? TAIL_W + 4 : 6, s.iconSize / 3)),
        'border-radius': radius, overflow: 'hidden',
      });
      rule(`${T} #author-photo img`, { width: sz, height: sz, 'border-radius': radius });
    }

    const shadow = textShadow(s);
    const content = { 'line-height': String(s.lineHeight), 'text-shadow': shadow || null, overflow: 'visible' };
    if (s.bubble) {
      Object.assign(content, {
        'background-color': hexToRgba(s.bubbleColor, s.bubbleAlpha),
        'border-radius': px(s.bubbleRadius),
        padding: `${px(s.bubblePadding)} ${px(s.bubblePadding * 1.5)}`,
        flex: '0 1 auto',
        position: s.bubbleTail ? 'relative' : null,
      });
    }
    rule(`${T} #content`, content);
    const ytTail = s.bubble && s.bubbleTail;
    // しっぽの高さはアイコンの中央に合わせる
    if (ytTail) rule(`${T} #content::before`, tailProps(hexToRgba(s.bubbleColor, s.bubbleAlpha), s.showIcon ? Math.max(6, s.iconSize / 2 - 6) : 8));

    if (s.roleBg) {
      const target = type => s.bubble ? `${T}[author-type="${type}"] #content` : `${T}[author-type="${type}"]`;
      const roleProps = c => ({ 'background-color': hexToRgba(c, s.roleBgAlpha), 'border-radius': px(s.bubbleRadius) });
      for (const [type, c] of [['owner', s.ownerBg], ['moderator', s.modBg], ['member', s.memberBg]]) {
        rule(target(type), roleProps(c));
        if (ytTail) rule(`${target(type)}::before`, { 'border-right-color': hexToRgba(c, s.roleBgAlpha) });
      }
    }

    if (s.showTime) rule(`${T} #timestamp`, { display: 'inline', 'font-size': px(s.timeSize), color: s.timeColor, 'margin-right': '0.5em' });
    else hide(`${T} #timestamp`);

    if (!s.showName) hide(`${T} yt-live-chat-author-chip`);
    else {
      rule(`${T} yt-live-chat-author-chip`, { 'margin-right': '0.4em' });
      rule(`${T} #author-name`, { color: s.nameColor, 'font-size': px(s.nameSize), 'font-weight': s.nameWeight });
      rule(`${T}[author-type="member"] #author-name`, { color: s.memberColor });
      rule(`${T}[author-type="moderator"] #author-name`, { color: s.modColor });
      rule(`${T}[author-type="owner"] #author-name`, { color: s.ownerColor, 'background-color': 'transparent', padding: '0' });
      if (s.nameColon) rule(`${T} yt-live-chat-author-chip::after`, { content: '":"', color: s.nameColor, 'font-size': px(s.nameSize), 'font-weight': s.nameWeight });
      if (!s.showBadges) hide(`${T} #chat-badges`);
      else rule(`${T} #chat-badges img, ${T} #chat-badges yt-icon`, { width: px(s.nameSize), height: px(s.nameSize) });
    }

    rule(`${T} #message`, {
      display: s.showName && s.nameBreak ? 'block' : null,
      color: s.msgColor, 'font-size': px(s.msgSize), 'font-weight': s.msgWeight, 'line-height': String(s.lineHeight),
    });
    rule(`${T} #message img`, { width: px(s.emojiSize), height: px(s.emojiSize), 'vertical-align': 'middle' });

    // スーパーチャット・メンバーシップ
    head('スーパーチャット・メンバーシップ');
    if (!s.showSuperchat) hide(`${P}, yt-live-chat-legacy-paid-message-renderer`);
    else {
      rule(P, { padding: rowPad });
      rule(`${P} #card`, { 'border-radius': px(s.scRadius), overflow: 'hidden' });
      if (s.scMode === 'custom') {
        rule(`${P} #header`, { 'background-color': s.scHeader });
        rule(`${P} #content`, { 'background-color': s.scBody });
        rule(`${P} #author-name, ${P} #purchase-amount, ${P} #purchase-amount-chip, ${P} #message`, { color: s.scText });
      }
      rule(`${P} #author-name`, { 'font-size': px(s.scNameSize) });
      rule(`${P} #purchase-amount, ${P} #purchase-amount-chip`, { 'font-size': px(s.scAmountSize), 'font-weight': '700' });
      rule(`${P} #message`, { 'font-size': px(s.scMsgSize), 'line-height': String(s.lineHeight) });
      rule(`${P} #message img`, { width: px(s.emojiSize), height: px(s.emojiSize), 'vertical-align': 'middle' });
    }
    if (!s.showStickers) hide(ST);
    else {
      rule(ST, { padding: rowPad });
      rule(`${ST} #card`, { 'border-radius': px(s.scRadius) });
    }
    if (!s.showMembership) {
      hide([M, 'ytd-sponsorships-live-chat-gift-purchase-announcement-renderer',
        'ytd-sponsorships-live-chat-gift-redemption-announcement-renderer'].join(',\n'));
    } else {
      rule(M, { padding: rowPad });
      rule(`${M} #card`, { 'border-radius': px(s.scRadius), overflow: 'hidden' });
      if (!s.memHeaderText) hide(`${M} #header-primary-text`);
      rule(`${M} #message`, { 'font-size': px(s.scMsgSize) });
      rule(`${M} #message img`, { width: px(s.emojiSize), height: px(s.emojiSize), 'vertical-align': 'middle' });
    }

    writeAnimation(s, w, `${T},\n${P},\n${M},\n${ST}`);
    writeSuperchatFx(s, w, { P, ST, M });
    return w.done();
  }

  // =====================================================
  //  Twitch のポップアウトチャット用 CSS
  //  Twitch の自動生成クラス（Layout-sc-xxx など）は使わず、
  //  固定のクラス名・data属性・要素の並びだけで指定しています。
  // =====================================================
  //  YouTube のリアクション（ハートなどが浮かぶ部分 #emoji-fountain）
  //  途中の要素の名前に頼らないよう、まわりは visibility: hidden で隠し、
  //  #emoji-fountain だけ visible に戻して画面の決まった位置に固定します。
  // =====================================================
  function writeReactionFountain(s, w) {
    w.rule('#emoji-fountain, #emoji-fountain *', { visibility: 'visible' });
    w.rule('#emoji-fountain', {
      position: 'fixed', top: 'auto', left: 'auto', right: px(s.reactRight), bottom: px(s.reactBottom),
      transform: `scale(${s.reactScale})`, 'transform-origin': 'bottom right', 'z-index': '100',
    });
  }

  // リアクションだけを表示する、2つ目のブラウザソース用のCSS
  function generateReactions(s) {
    const w = writer();
    w.out.push('/* どんまうんど チャットCSSジェネレーター（リアクション用） https://donnma.com/tool/chat-css/ */');
    w.head('リアクション以外をすべて見えなくする');
    w.rule('html, body', { 'background-color': 'transparent', overflow: 'hidden' });
    w.rule('body', { visibility: 'hidden' });
    w.head('リアクション');
    writeReactionFountain(s, w);
    return w.done();
  }

  // =====================================================
  // バッジ画像の alt（英語・日本語）から立場を判定
  const TW_ROLE_BADGES = {
    member: ['[alt="VIP"]', '[alt*="Subscriber"]', '[alt*="サブスクライバー"]', '[alt*="Founder"]', '[alt*="ファウンダー"]'],
    moderator: ['[alt="Moderator"]', '[alt="モデレーター"]'],
    owner: ['[alt="Broadcaster"]', '[alt="配信者"]'],
  };

  function generateTwitch(s) {
    const MSG = '.chat-line__message';
    const LINE = '.chat-line__no-background';
    const BODY = '[data-a-target="chat-line-message-body"]';
    const NAME = '.chat-author__display-name';
    const COLON = '.chat-line__username-container + span[aria-hidden="true"]';
    const BADGE_WRAP = '.chat-line__username-container > span:not(.chat-line__username)';
    const NOTICE = '.user-notice-line, [data-test-selector="user-notice-line"], .announcement-line';
    const w = writer();
    const { out, rule, hide, head } = w;
    const font = writeHeader(s, w);
    const role = (type, tail = '') => `${MSG}:has(${TW_ROLE_BADGES[type].map(a => 'img.chat-badge' + a).join(', ')})${tail}`;

    head('全体');
    const bg = s.chatBgAlpha > 0 ? hexToRgba(s.chatBg, s.chatBgAlpha) : 'transparent';
    rule('html, body', { 'background-color': bg, overflow: 'hidden' });
    rule(['#root', '.stream-chat', '.chat-room', '.chat-room__content', '.chat-list--default', '.chat-list--default > div',
      '.scrollable-area', '.chat-scrollable-area__message-container', MSG].join(',\n'),
      { 'background-color': 'transparent', 'background-image': 'none', border: 'none' });
    if (font) rule(`${MSG}, ${MSG} *, .user-notice-line, .user-notice-line *`, { 'font-family': font.family });
    rule('.scrollable-area', { overflow: 'hidden' });
    out.push('.scrollable-area::-webkit-scrollbar { display: none !important; }');

    head('不要な部分を非表示');
    hide([
      '.stream-chat-header',
      '.chat-room__content > :not(.chat-list--default)', // 入力欄・ランキング・Dropsのお知らせ・ピン留めなど
      '.chat-line__status', '[data-a-target="chat-welcome-message"]',
      '.chat-line__icons', '.chat-line__message-highlight', '.chat-author__intl-login', '.chat-line__timestamp',
      '.chat-paused-footer', '.snackbar-list__container', '.simplebar-track',
      '.community-highlight-stack__card', '.community-highlight-stack__backlog-card',
      '[data-test-selector="chat-private-callout-queue__callout-container"]',
    ].join(',\n'));

    const users = s.twHideUsers.split(/[\s,、]+/).map(u => u.toLowerCase().replace(/[^a-z0-9_]/g, '')).filter(Boolean);
    if (users.length) {
      head('表示しないユーザー');
      hide(users.map(u => `${MSG}[data-a-user="${u}" i]`).join(',\n'));
    }

    head('コメント');
    const rowPad = `${px(s.itemGap / 2)} ${px(s.sidePad)}`;
    rule(MSG, { padding: rowPad, overflow: 'visible' });
    const line = { 'line-height': String(s.lineHeight), 'text-shadow': textShadow(s) || null };
    const twTail = s.bubble && s.bubbleTail;
    if (s.bubble) {
      Object.assign(line, {
        display: 'block', width: 'fit-content', 'box-sizing': 'border-box',
        'max-width': twTail ? `calc(100% - ${TAIL_W}px)` : '100%',
        'margin-left': twTail ? px(TAIL_W) : null,
        position: twTail ? 'relative' : null,
        'background-color': hexToRgba(s.bubbleColor, s.bubbleAlpha),
        'border-radius': px(s.bubbleRadius),
        padding: `${px(s.bubblePadding)} ${px(s.bubblePadding * 1.5)}`,
      });
    }
    rule(LINE, line);
    if (twTail) rule(`${LINE}::before`, tailProps(hexToRgba(s.bubbleColor, s.bubbleAlpha), s.bubblePadding + 2));

    if (s.roleBg) {
      const target = type => role(type, s.bubble ? ` ${LINE}` : '');
      const roleProps = c => ({ 'background-color': hexToRgba(c, s.roleBgAlpha), 'border-radius': px(s.bubbleRadius) });
      for (const [type, c] of [['member', s.memberBg], ['moderator', s.modBg], ['owner', s.ownerBg]]) {
        rule(target(type), roleProps(c));
        if (twTail) rule(`${target(type)}::before`, { 'border-right-color': hexToRgba(c, s.roleBgAlpha) });
      }
    }

    if (!s.showName) hide(`.chat-line__username-container,\n${COLON}`);
    else {
      rule(NAME, { color: s.twUserColor ? null : s.nameColor, 'font-size': px(s.nameSize), 'font-weight': s.nameWeight });
      if (!s.twUserColor) {
        rule(role('member', ' ' + NAME), { color: s.memberColor });
        rule(role('moderator', ' ' + NAME), { color: s.modColor });
        rule(role('owner', ' ' + NAME), { color: s.ownerColor });
      }
      if (!s.nameColon || s.nameBreak) hide(COLON);
      else rule(COLON, { 'font-size': px(s.nameSize), color: s.msgColor });
      if (!s.showBadges) hide(BADGE_WRAP);
      else rule('.chat-line__username-container .chat-badge', { width: px(s.nameSize), height: px(s.nameSize), 'vertical-align': 'middle' });
    }

    rule(BODY, {
      display: s.showName && s.nameBreak ? 'block' : null,
      color: s.msgColor, 'font-size': px(s.msgSize), 'font-weight': s.msgWeight, 'line-height': String(s.lineHeight),
    });
    rule(`${BODY} .text-fragment, ${BODY} a`, { color: s.msgColor, 'font-size': px(s.msgSize), 'font-weight': s.msgWeight });
    rule(`${BODY} img`, { height: px(s.emojiSize), width: 'auto', 'vertical-align': 'middle', margin: '0 1px' });

    head('サブスク・ギフト・レイドの通知');
    if (!s.showMembership) hide(NOTICE);
    else {
      rule(NOTICE, {
        margin: rowPad, 'border-radius': px(s.scRadius), overflow: 'hidden',
        'font-size': px(s.scMsgSize), 'text-shadow': 'none',
      });
    }

    writeAnimation(s, w, `${MSG},\n.user-notice-line`);
    return w.done();
  }

  // =====================================================
  //  チャット欄のDOM（YouTubeのチャット欄と同じ構造）
  //  プレビューと Twitch オーバーレイはこのDOMに生成CSSを当てて表示します。
  // =====================================================
  const BASE_CSS = `
    html, body { margin: 0; height: 100%; }
    body { font-family: Roboto, Arial, "Noto Sans JP", sans-serif; font-size: 13px; color: #fff; }
    yt-live-chat-app, yt-live-chat-renderer { display: flex; flex-direction: column; height: 100%; }
    yt-live-chat-item-list-renderer { display: block; flex: 1; min-height: 0; }
    #item-scroller { height: 100%; overflow-y: auto; }
    #item-offset { min-height: 100%; display: flex; flex-direction: column; justify-content: flex-end; }
    #items { display: flex; flex-direction: column; padding: 8px 0; }
    yt-live-chat-text-message-renderer { display: flex; align-items: flex-start; padding: 4px 24px; font-size: 13px; }
    yt-img-shadow { display: block; flex: none; }
    yt-live-chat-text-message-renderer #author-photo { width: 24px; height: 24px; margin-right: 16px; border-radius: 50%; overflow: hidden; }
    #author-photo img { display: block; width: 100%; height: 100%; }
    yt-live-chat-text-message-renderer #content { flex: 1 1 auto; min-width: 0; line-height: 16px; overflow-wrap: anywhere; overflow: hidden; }
    #timestamp { color: rgba(255,255,255,.5); font-size: 11px; margin-right: 8px; }
    yt-live-chat-author-chip { display: inline-flex; align-items: baseline; margin-right: 8px; }
    yt-live-chat-text-message-renderer #author-name { color: rgba(255,255,255,.7); font-weight: 500; }
    #author-name.owner { background: #ffd600; color: #0f0f0f; padding: 2px 4px; border-radius: 2px; }
    [author-type="moderator"] #author-name { color: #5e84f1; }
    [author-type="member"] #author-name { color: #2ba640; }
    #chat-badges { display: inline-flex; gap: 2px; margin-left: 2px; align-self: center; }
    yt-live-chat-author-badge-renderer { display: block; }
    #chat-badges img { display: block; width: 16px; height: 16px; }
    #message { color: #fff; }
    #message img { width: 24px; height: 24px; vertical-align: middle; margin: -1px 1px 0; }

    yt-live-chat-paid-message-renderer, yt-live-chat-membership-item-renderer, yt-live-chat-paid-sticker-renderer { display: block; padding: 4px 24px; }
    yt-live-chat-paid-message-renderer #card, yt-live-chat-membership-item-renderer #card { border-radius: 4px; overflow: hidden; }
    yt-live-chat-paid-message-renderer #header, yt-live-chat-membership-item-renderer #header { display: flex; align-items: center; gap: 16px; padding: 8px 16px; }
    yt-live-chat-paid-message-renderer #header { background: var(--hdr); color: var(--txt); }
    yt-live-chat-paid-message-renderer #content { background: var(--bdy); color: var(--txt); padding: 8px 16px; font-size: 15px; overflow-wrap: anywhere; }
    yt-live-chat-paid-message-renderer #author-photo, yt-live-chat-membership-item-renderer #author-photo { width: 40px; height: 40px; border-radius: 50%; overflow: hidden; }
    yt-live-chat-paid-message-renderer #author-name { display: block; font-size: 14px; opacity: .85; }
    yt-live-chat-paid-message-renderer #purchase-amount { display: block; font-size: 15px; font-weight: 500; }
    yt-live-chat-paid-message-renderer #message { color: inherit; }
    yt-live-chat-membership-item-renderer #header { background: #0a8043; color: #fff; }
    yt-live-chat-membership-item-renderer #content { background: #0f9d58; padding: 8px 16px; font-size: 15px; overflow-wrap: anywhere; }
    yt-live-chat-membership-item-renderer #author-name { display: block; font-size: 14px; font-weight: 500; }
    yt-live-chat-membership-item-renderer #header-primary-text { display: block; font-size: 15px; font-weight: 700; }
    yt-live-chat-membership-item-renderer #header-subtext { display: block; font-size: 13px; opacity: .9; }
    yt-live-chat-paid-sticker-renderer #card { display: flex; align-items: center; gap: 16px; padding: 8px 16px; background: #00b8d4; color: #000; border-radius: 4px; }
    yt-live-chat-paid-sticker-renderer #author-photo { width: 40px; height: 40px; border-radius: 50%; overflow: hidden; }
    yt-live-chat-paid-sticker-renderer #sticker { font-size: 48px; line-height: 1; margin-left: auto; }

    #panel-pages { flex: none; padding: 8px 12px; background: #0f0f0f; border-top: 1px solid rgba(255,255,255,.1); }
    #top { display: flex; align-items: center; gap: 8px; }
    #input-container { flex: 1; padding: 6px 12px; border-radius: 16px; background: rgba(255,255,255,.1); color: #aaa; }
    yt-reaction-control-panel-overlay-view-model { position: relative; display: block; }
    #reaction-control-panel { font-size: 16px; }
    #emoji-fountain { position: absolute; right: 0; bottom: 100%; width: 32px; height: 120px; pointer-events: none; }
    #emoji-fountain .cc-emoji { position: absolute; bottom: 0; left: 8px; font-size: 16px; animation: cc-float 2.4s ease-out forwards; }
    @keyframes cc-float {
      0% { opacity: 0; transform: translateX(0) scale(.5); }
      15% { opacity: 1; }
      100% { opacity: 0; transform: translate(var(--dx, 0px), -110px) scale(1); }
    }
  `;

  const FRAME_HTML = `<yt-live-chat-app><yt-live-chat-renderer><yt-live-chat-item-list-renderer>
    <div id="item-scroller"><div id="item-offset"><div id="items"></div></div></div>
    </yt-live-chat-item-list-renderer>
    <div id="panel-pages"><div id="input-panel"><yt-live-chat-message-input-renderer><div id="container"><div id="top">
    <div id="input-container">チャット...</div><div id="right"><div id="picker-buttons">
    <yt-reaction-control-panel-overlay-view-model><div id="reaction-control-panel">❤️</div><div id="emoji-fountain"></div>
    </yt-reaction-control-panel-overlay-view-model></div></div></div></div></yt-live-chat-message-input-renderer></div></div>
    </yt-live-chat-renderer></yt-live-chat-app>`;

  // --- 部品 ---
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const svgUri = svg => 'data:image/svg+xml,' + encodeURIComponent(svg);
  const avatar = (name, color) => svgUri(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40"><rect width="40" height="40" fill="${color}"/>` +
    `<text x="20" y="27" font-size="19" text-anchor="middle" fill="#fff" font-family="sans-serif" font-weight="700">${esc(Array.from(name)[0] || '?')}</text></svg>`);

  const badgeSvg = inner => svgUri(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16">${inner}</svg>`);
  const BADGES = {
    'yt-moderator': badgeSvg('<path fill="#5e84f1" d="M9.64 7.64c.23-.5.36-1.05.36-1.64 0-2.21-1.79-4-4-4-.59 0-1.14.13-1.64.36L6 4 4 6 2.36 4.36C2.13 4.86 2 5.41 2 6c0 2.21 1.79 4 4 4 .59 0 1.14-.13 1.64-.36L12 14l2-2-4.36-4.36z"/>'),
    'yt-member': badgeSvg('<circle cx="8" cy="8" r="8" fill="#2ba640"/><path fill="#fff" d="M8 3.2l1.4 2.9 3.2.4-2.3 2.2.6 3.1L8 10.3l-2.9 1.5.6-3.1-2.3-2.2 3.2-.4z"/>'),
    'tw-broadcaster': badgeSvg('<rect width="16" height="16" rx="3" fill="#e91916"/><path fill="#fff" d="M3.5 5h6.5v6H3.5zM10.5 7.2l2.5-1.7v5l-2.5-1.7z"/>'),
    'tw-moderator': badgeSvg('<rect width="16" height="16" rx="3" fill="#00ad03"/><path fill="#fff" d="M12.5 2.5l1 1-5.6 5.6 1.2 1.2-1 1-1.2-1.2-2.1 2.1-1-1 2.1-2.1-1.2-1.2 1-1 1.2 1.2z"/>'),
    'tw-vip': badgeSvg('<rect width="16" height="16" rx="3" fill="#e005b9"/><path fill="#fff" d="M8 12.8L2.8 6.6 4.7 3.8h6.6l1.9 2.8z"/>'),
    'tw-subscriber': badgeSvg('<rect width="16" height="16" rx="3" fill="#8205b4"/><path fill="#fff" d="M8 2.8l1.6 3.2 3.5.5-2.5 2.5.6 3.5L8 10.8l-3.2 1.7.6-3.5-2.5-2.5 3.5-.5z"/>'),
  };

  function badgesHtml(list) {
    const imgs = (list || []).filter(b => BADGES[b]).map(b =>
      `<yt-live-chat-author-badge-renderer type="${b}"><div id="image"><img alt="" src="${BADGES[b]}"></div></yt-live-chat-author-badge-renderer>`);
    return `<span id="chat-badges">${imgs.join('')}</span>`;
  }

  const photo = (name, color) => `<yt-img-shadow id="author-photo"><img alt="" src="${avatar(name, color)}"></yt-img-shadow>`;

  const clock = d => `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;

  // 通常コメント。html はエスケープ済みのメッセージ本文
  function textItem({ name, avatarColor, type = '', badges = [], html, time = new Date() }) {
    return `<yt-live-chat-text-message-renderer author-type="${type}">${photo(name, avatarColor)}
      <div id="content"><span id="timestamp">${clock(time)}</span><yt-live-chat-author-chip>
      <span id="author-name" class="${type === 'owner' ? 'owner' : ''}">${esc(name)}</span>${badgesHtml(badges)}</yt-live-chat-author-chip>
      <span id="message">${html}</span></div></yt-live-chat-text-message-renderer>`;
  }

  // スーパーチャット。colors は [上部, 下部, 文字] の色
  function paidItem({ name, avatarColor, amount, colors, html }) {
    const [hdr, bdy, txt] = colors;
    const body = html ? `<div id="content"><div id="message">${html}</div></div>` : '';
    return `<yt-live-chat-paid-message-renderer style="--yt-live-chat-paid-message-primary-color: ${bdy}; --yt-live-chat-paid-message-secondary-color: ${hdr}; --hdr:${hdr};--bdy:${bdy};--txt:${txt}"><div id="card">
      <div id="header">${photo(name, avatarColor)}<div id="header-content"><span id="author-name">${esc(name)}</span>
      <div id="purchase-amount">${esc(amount)}</div></div></div>${body}</div></yt-live-chat-paid-message-renderer>`;
  }

  // メンバー加入・マイルストーン
  function memberItem({ name, avatarColor, primary = '', sub = '', html = '' }) {
    const head = (primary ? `<span id="header-primary-text">${esc(primary)}</span>` : '') +
      (sub ? `<span id="header-subtext">${esc(sub)}</span>` : '');
    const body = html ? `<div id="content"><div id="message">${html}</div></div>` : '';
    return `<yt-live-chat-membership-item-renderer><div id="card"><div id="header">${photo(name, avatarColor)}
      <div id="header-content"><span id="author-name">${esc(name)}</span>${head}</div></div>${body}</div>
      </yt-live-chat-membership-item-renderer>`;
  }

  // スーパーステッカー（YouTubeのみ）
  function stickerItem({ name, avatarColor, amount, sticker }) {
    return `<yt-live-chat-paid-sticker-renderer><div id="card">${photo(name, avatarColor)}
      <div><span id="author-name">${esc(name)}</span><div id="purchase-amount-chip">${esc(amount)}</div></div>
      <div id="sticker">${esc(sticker)}</div></div></yt-live-chat-paid-sticker-renderer>`;
  }

  // =====================================================
  //  Twitch ポップアウトチャットの見本DOM（プレビュー用）
  //  実際のTwitchのDOMから、生成CSSが使う部分だけを再現しています。
  // =====================================================
  const TW_BASE_CSS = `
    html, body { margin: 0; height: 100%; }
    body { background: #18181b; color: #efeff1; font-family: Inter, Roobert, "Helvetica Neue", Helvetica, Arial, sans-serif; font-size: 13px; }
    #root, .stream-chat { height: 100%; }
    .stream-chat { display: flex; flex-direction: column; }
    .stream-chat-header { flex: none; height: 40px; display: flex; align-items: center; justify-content: center; font-weight: 600; border-bottom: 1px solid #2f2f35; }
    .chat-room, .chat-room__content { flex: 1; min-height: 0; display: flex; flex-direction: column; }
    .chat-list--default { flex: 1; min-height: 0; }
    .chat-list--default > div { height: 100%; }
    .scrollable-area { height: 100%; overflow-y: auto; }
    .chat-scrollable-area__message-container { min-height: 100%; box-sizing: border-box; display: flex; flex-direction: column; justify-content: flex-end; padding-bottom: 10px; }
    .chat-line__status { padding: 5px 20px; color: #adadb8; }
    .chat-line__message { padding: 5px 20px; line-height: 20px; overflow-wrap: anywhere; }
    .chat-line__username-container { display: inline; }
    .chat-line__username-container > span:first-child > div { display: inline-block; vertical-align: middle; margin-right: 3px; }
    [data-a-target="chat-badge"] { display: inline-flex; padding: 0; border: 0; background: none; }
    .chat-badge { width: 18px; height: 18px; border-radius: 3px; vertical-align: middle; }
    .chat-author__display-name { font-weight: 700; }
    .chat-line__message--emote { height: 28px; vertical-align: middle; margin: -5px 0; }
    .user-notice-line { margin: 5px 0; padding: 5px 16px; border-left: 4px solid #9147ff; background: rgba(145, 71, 255, .15); }
    .user-notice-line .notice-title { font-weight: 700; }
    .chat-input { flex: none; padding: 10px; border-top: 1px solid #2f2f35; }
    .chat-input > div { height: 38px; display: flex; align-items: center; padding: 0 10px; border-radius: 6px; background: #2f2f35; color: #adadb8; }
  `;

  const TW_FRAME_HTML = `<div id="root"><div class="stream-chat"><div class="stream-chat-header">チャット</div>
    <section class="chat-room"><div class="chat-room__content"><div class="chat-list--default"><div>
    <div class="scrollable-area" data-a-target="chat-scroller"><div class="chat-scrollable-area__message-container" role="log">
    <div class="chat-line__status" data-a-target="chat-welcome-message">チャットルームへようこそ！</div>
    </div></div></div></div><div class="chat-input"><div>メッセージを送信</div></div></div></section></div></div>`;

  // 日本語表示のTwitchと同じ alt（立場の判定に使われます）
  const TW_BADGE_ALT = {
    'tw-broadcaster': '配信者', 'tw-moderator': 'モデレーター', 'tw-vip': 'VIP', 'tw-subscriber': '1か月のサブスクライバー',
  };

  // html はエスケープ済み（.text-fragment と img.chat-line__message--emote で組み立てたもの）
  function twTextItem({ name, login, userColor, badges = [], html }) {
    const b = badges.filter(k => BADGES[k]).map(k =>
      `<div><button data-a-target="chat-badge"><img alt="${TW_BADGE_ALT[k]}" class="chat-badge" src="${BADGES[k]}"></button></div>`).join('');
    return `<div><div class="chat-line__message" data-a-target="chat-line-message" data-a-user="${esc(login || name.toLowerCase())}">
      <div><div class="chat-line__message-highlight"></div><div class="chat-line__message-container"><div></div><div>
      <div class="chat-line__no-background"><div><div class="chat-line__username-container chat-line__username-container--hoverable">
      <span>${b}</span><span class="chat-line__username" role="button"><span><span class="chat-author__display-name"
      data-a-target="chat-message-username" style="color: ${esc(userColor)};">${esc(name)}</span></span></span></div>
      <span aria-hidden="true">: </span><span data-a-target="chat-line-message-body" dir="auto">${html}</span>
      </div></div></div></div></div></div></div>`;
  }

  function twNoticeItem({ title, html = '' }) {
    return `<div><div class="user-notice-line" data-test-selector="user-notice-line"><div class="notice-title">${esc(title)}</div>
      ${html ? `<div>${html}</div>` : ''}</div></div>`;
  }

  global.ChatCore = {
    FONTS, WEIGHTS, DEFAULTS, COLOR_KEYS, IN_ANIMS, OUT_ANIMS, SC_IN_ANIMS, SC_EFFECTS, SC_TIERS, SC_GROUPS,
    sanitize, generate, generateTwitch, generateReactions,
    BASE_CSS, FRAME_HTML, esc, svgUri, avatar,
    textItem, paidItem, memberItem, stickerItem,
    TW_BASE_CSS, TW_FRAME_HTML, twTextItem, twNoticeItem,
  };
})(window);
