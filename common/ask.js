/*
 * ページの中に出す確認・お知らせ（confirm() / alert() の代わり）
 * OBSのカスタムブラウザドックやブラウザソースの「対話」では、confirm() / alert() が出ないことがあるので、こちらを使う。
 *
 *   await DonnmaAsk.ask('消しますか？', { yes: '消す' })   → true（yes）/ false（no）/ null（Esc・外側クリック）
 *   await DonnmaAsk.ask('…', { yes: '外す', no: '別の画像を選ぶ' })   2択にも使える（false と null を分けて扱う）
 *   await DonnmaAsk.notice('読み込めませんでした')          → OK を押すまで待つ
 *
 * 色は各ページの CSS 変数（--surface など）を使い、なければ donnma.com と同じ配色にする。
 */
(function (global) {
  'use strict';
  const CSS = `
.dn-ask { position: fixed; inset: 0; z-index: 10000; display: grid; place-items: center; padding: 16px; background: rgba(0, 0, 0, 0.6); }
.dn-ask[hidden] { display: none; }
.dn-ask-box {
  width: min(440px, 100%); box-sizing: border-box; padding: 20px 20px 16px; border-radius: 14px;
  background: var(--surface, #2e1224); color: var(--text, #f6e9ef); border: 1px solid var(--border-strong, #5e2340);
  box-shadow: 0 18px 50px rgba(0, 0, 0, 0.5); font-family: 'Zen Maru Gothic', 'Hiragino Maru Gothic ProN', 'Meiryo', sans-serif;
}
.dn-ask-msg { margin: 0 0 16px; font-size: 14px; font-weight: 700; line-height: 1.7; white-space: pre-line; }
.dn-ask-actions { display: flex; flex-wrap: wrap; justify-content: flex-end; gap: 8px; }
.dn-ask-actions button {
  font: inherit; font-size: 13px; font-weight: 700; padding: 8px 16px; border-radius: 8px; cursor: pointer;
  border: 1px solid var(--border-strong, #5e2340); background: var(--surface-2, #38172c); color: var(--text, #f6e9ef);
}
.dn-ask-actions button:hover { border-color: var(--accent, #ff85a1); }
.dn-ask-actions button:focus-visible { outline: 2px solid var(--accent-2, #ffb3c6); outline-offset: 2px; }
.dn-ask-actions .yes { background: var(--accent, #ff85a1); border-color: var(--accent, #ff85a1); color: var(--on-accent, #2a1020); }
.dn-ask-actions .yes.danger { background: #e0435e; border-color: #e0435e; color: #fff; }
.dn-ask-actions [hidden] { display: none; }
`;
  let root, msgEl, yesEl, noEl, done = null;

  function build() {
    if (root) return;
    const style = document.createElement('style');
    style.textContent = CSS;
    document.head.appendChild(style);
    root = document.createElement('div');
    root.className = 'dn-ask';
    root.hidden = true;
    root.innerHTML = '<div class="dn-ask-box" role="alertdialog" aria-modal="true"><p class="dn-ask-msg"></p>'
      + '<div class="dn-ask-actions"><button type="button" class="no"></button><button type="button" class="yes"></button></div></div>';
    document.body.appendChild(root);
    msgEl = root.querySelector('.dn-ask-msg');
    yesEl = root.querySelector('.yes');
    noEl = root.querySelector('.no');
    root.querySelector('.dn-ask-box').setAttribute('aria-label', '確認');
    yesEl.addEventListener('click', () => finish(true));
    noEl.addEventListener('click', () => finish(false));
    root.addEventListener('click', e => { if (e.target === root) finish(null); });
    // 出している間は、Esc はこれだけを閉じ、スペース・Enter でほかの操作が動かないようにする
    addEventListener('keydown', e => {
      if (!done) return;
      if (e.key === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); finish(null); }
      else if ((e.code === 'Space' || e.key === 'Enter') && !(e.target instanceof Element && e.target.closest('.dn-ask button'))) {
        e.preventDefault(); e.stopImmediatePropagation();
      }
    }, true);
  }

  function finish(v) {
    if (!done) return;
    const d = done;
    done = null;
    root.hidden = true;
    d(v);
  }

  function open(msg, yes, no, danger) {
    build();
    finish(null);   // 前のが開いていたら閉じる
    msgEl.textContent = msg;
    yesEl.textContent = yes;
    yesEl.classList.toggle('danger', !!danger);
    noEl.textContent = no || '';
    noEl.hidden = !no;
    root.hidden = false;
    (no ? noEl : yesEl).focus();
    return new Promise(resolve => { done = resolve; });
  }

  global.DonnmaAsk = {
    // danger は「消す・リセット」など元に戻せない操作。省略すると、yes の文字から決める
    ask(msg, opts = {}) {
      const yes = opts.yes || 'OK';
      const danger = opts.danger ?? /消|削除|リセット|上書き|戻す|外す|入れ替/.test(yes);
      return open(msg, yes, opts.no || 'やめる', danger);
    },
    notice(msg, ok = 'OK') {
      return open(msg, ok, '', false).then(() => undefined);
    },
  };
})(window);
