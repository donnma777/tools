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

    animIn: 'slide-left', animDur: 0.4,
    fadeOut: false, fadeOutDelay: 20, fadeOutDur: 0.6,

    // Twitch 専用
    twUserColor: true, twHideUsers: '',
  };

  const COLOR_KEYS = Object.keys(DEFAULTS).filter(k => /^#[0-9a-f]{6}$/i.test(String(DEFAULTS[k])));

  // 既知のキー・型だけ取り込む
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

  function writeAnimation(s, w, selector) {
    const anims = [];
    const from = {
      fade: 'none', 'slide-left': 'translateX(-40px)', 'slide-right': 'translateX(40px)',
      'slide-up': 'translateY(24px)', zoom: 'scale(0.8)',
    }[s.animIn];
    if (from || s.fadeOut) w.head('アニメーション');
    if (from) {
      w.out.push(`@keyframes cc-in {\n  from { opacity: 0; transform: ${from}; }\n  to { opacity: 1; transform: none; }\n}`);
      anims.push(`cc-in ${s.animDur}s cubic-bezier(0.2, 0.8, 0.2, 1) both`);
    }
    if (s.fadeOut) {
      w.out.push('@keyframes cc-out {\n  from { opacity: 1; }\n  to { opacity: 0; }\n}');
      const delay = +(s.fadeOutDelay + (from ? s.animDur : 0)).toFixed(2);
      anims.push(`cc-out ${s.fadeOutDur}s ease-in ${delay}s forwards`);
    }
    if (anims.length) w.rule(selector, { animation: anims.join(', ') });
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
    hide([
      'yt-live-chat-header-renderer', 'yt-live-chat-message-input-renderer', 'yt-live-chat-ticker-renderer',
      'yt-live-chat-banner-manager', 'yt-live-chat-viewer-engagement-message-renderer',
      'yt-live-chat-mode-change-message-renderer', 'yt-live-chat-restricted-participation-renderer',
      'yt-live-chat-docked-message', 'yt-reaction-control-panel-overlay-view-model',
      '#panel-pages', '#show-more', `${T} #menu`, `${T} #inline-action-button-container`,
    ].join(',\n'));

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
    return w.done();
  }

  // =====================================================
  //  Twitch のポップアウトチャット用 CSS
  //  Twitch の自動生成クラス（Layout-sc-xxx など）は使わず、
  //  固定のクラス名・data属性・要素の並びだけで指定しています。
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
    yt-live-chat-app, yt-live-chat-renderer, yt-live-chat-item-list-renderer { display: block; height: 100%; }
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
  `;

  const FRAME_HTML = `<yt-live-chat-app><yt-live-chat-renderer><yt-live-chat-item-list-renderer>
    <div id="item-scroller"><div id="item-offset"><div id="items"></div></div></div>
    </yt-live-chat-item-list-renderer></yt-live-chat-renderer></yt-live-chat-app>`;

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
    return `<yt-live-chat-paid-message-renderer style="--hdr:${hdr};--bdy:${bdy};--txt:${txt}"><div id="card">
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
    FONTS, WEIGHTS, DEFAULTS, COLOR_KEYS,
    sanitize, generate, generateTwitch,
    BASE_CSS, FRAME_HTML, esc, svgUri, avatar,
    textItem, paidItem, memberItem, stickerItem,
    TW_BASE_CSS, TW_FRAME_HTML, twTextItem, twNoticeItem,
  };
})(window);
