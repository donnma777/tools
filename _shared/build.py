"""
ヘッダー・フッターを各ページに流し込む
（中身は _shared/header.html・_shared/footer.html、スタイルは _shared/header-footer.css）。

  python _shared/build.py          書き換える
  python _shared/build.py --check  書き換えが要るページを出すだけ（あれば終了コード 1）

各ページには目印を置いておき、その間を書き換える（目印の間は直接編集しない）:
  <!-- shared:header root="../" back -->
  <!-- /shared:header -->
  <!-- shared:footer root="../" note="解像度 1920×1080 推奨" -->
  <!-- /shared:footer -->
スタイルは <style> の中に置く:
  /* shared:header-footer */
  /* /shared:header-footer */

目印に書ける設定:
  root  そのページからサイトのトップへのパス（トップページは ""、404.html は "/"）
  back  「ツール一覧 ▾」を出す（押すと tools.json から作った大きなメニューが開く）
  home  ロゴをリンクにしない（トップページ用）
  note  フッターの GitHub の横に足す一言

トップページのツール一覧（見出しへ飛ぶリンク・見出し・カード）は _shared/tools.json から作る:
  <!-- shared:tools -->
  <!-- /shared:tools -->
tools.json の書き方:
  sections  見出しごとに id・title・en（英語の小見出し）・cards。前の URL の #名前 を残すときは alias・aliasNote
  cards     id（目印のコメント）・name・tag・kind（右上の札）・desc・icon（SVG の中身を1行ずつ）
            ページを開くカードは href（ボタンの文字を変えるときは open）。ボタンを並べるカードは links（label・href・external）
            obs  "専用"（OBS で使うもの）か "対応"（ブラウザでも OBS でも使えるもの）
            pc   true で「PC向け」を付ける

テンプレートの書き方:
  {{名前}}         設定の値に置き換える
  {{#名前}}行      設定があるときだけ、その行を出す
  {{^名前}}行      設定がないときだけ、その行を出す
"""
import html
import json
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
SHARED = ROOT / '_shared'
BODY = r'(?P<nl>\r?\n)(?P<body>.*?)(?P=indent)'
# HTML の目印（_shared/名前.html）と、CSS の目印（_shared/名前.css）
MARKS = [
    ('html', '<!--', '-->', re.compile(
        r'(?P<indent>[ \t]*)<!-- shared:(?P<name>[\w-]+)(?P<opts>[^>]*?)-->' + BODY + r'<!-- /shared:(?P=name) -->', re.S)),
    ('css', '/*', '*/', re.compile(
        r'(?P<indent>[ \t]*)/\* shared:(?P<name>[\w-]+)(?P<opts>[^*]*?)\*/' + BODY + r'/\* /shared:(?P=name) \*/', re.S)),
]
OPT = re.compile(r'(\w+)(?:="([^"]*)")?')
COND = re.compile(r'^\{\{([#^])(\w+)\}\}')


def render(name, ext, opts, indent, nl):
    path = SHARED / f'{name}.{ext}'
    if not path.exists():
        raise SystemExit(f'テンプレートがありません: {path}')
    out = []
    for line in path.read_text(encoding='utf-8').replace('\r\n', '\n').splitlines():
        m = COND.match(line)
        if m:
            on = bool(opts.get(m.group(2)))
            if on != (m.group(1) == '#'):
                continue
            line = line[m.end():]
        line = re.sub(r'\{\{(\w+)\}\}', lambda k: opts.get(k.group(1), ''), line)
        out.append(indent + line if line else line)
    return nl.join(out) + nl


def esc(t):
    return html.escape(str(t), quote=False)


def attr(t):
    return html.escape(str(t), quote=True)


def tools_list(opts):
    """トップページのツール一覧を _shared/tools.json から作る（行のリストで返す）"""
    data = json.loads((SHARED / 'tools.json').read_text(encoding='utf-8'))
    secs = data['sections']
    out = ['<!-- 見出しへ飛ぶ -->', '<nav class="jump-nav" aria-label="このページの見出し">']
    out += [f'  <a href="#{s["id"]}">{esc(s["title"])}</a>' for s in secs]
    out.append('</nav>')
    for s in secs:
        out.append('')
        if s.get('alias'):
            out += [f'<!-- {s.get("aliasNote", "")} -->', f'<span id="{s["alias"]}"></span>']
        out += [f'<h2 class="section-title" id="{s["id"]}">{esc(s["title"])}<small>{esc(s["en"])}</small></h2>', '', '<div class="tool-list">']
        for c in s['cards']:
            tags = ''
            if c.get('obs'):
                tags += f'<span class="pc-tag obs-tag">OBS{esc(c["obs"])}</span>'
            if c.get('pc'):
                tags += '<span class="pc-tag">PC向け</span>'
            head, tail = (f'<a class="tool-card" href="{attr(c["href"])}">', '</a>') if c.get('href') else ('<div class="tool-card">', '</div>')
            out += ['', f'  <!-- {c["id"]} -->', f'  {head}',
                    '    <div class="tool-head">',
                    '      <div class="tool-icon">',
                    '        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">']
            out += [f'          {x}' for x in c['icon']]
            out += ['        </svg>', '      </div>', '      <div>',
                    f'        <div class="tool-tag">{esc(c["tag"])}{tags}</div>',
                    f'        <div class="tool-name">{esc(c["name"])}</div>',
                    '      </div>',
                    f'      <span class="kind-badge">{esc(c["kind"])}</span>',
                    '    </div>',
                    f'    <div class="tool-desc">{esc(c["desc"])}</div>',
                    '    <div class="card-actions">']
            if c.get('href'):
                out.append(f'      <span class="btn btn-primary">{esc(c.get("open", "ツールを開く →"))}</span>')
            for i, l in enumerate(c.get('links', [])):
                ext = ' target="_blank" rel="noopener"' if l.get('external') else ''
                out.append(f'      <a class="btn {"btn-primary" if i == 0 else "btn-secondary"}" href="{attr(l["href"])}"{ext}>{esc(l["label"])}</a>')
            out += ['    </div>', f'  {tail}']
        out += ['', '</div>']
    return out


def toolmenu_lines(root, rel):
    """ヘッダーの「ツール一覧 ▾」で開く大きなメニュー（_shared/tools.json から）。
    今のページ（rel の1つ目のフォルダ）のツールを光らせる。外のサイトにしかないものは新しいタブで開く"""
    data = json.loads((SHARED / 'tools.json').read_text(encoding='utf-8'))
    here = rel.parts[0] if rel is not None and len(rel.parts) > 1 else ''
    out = ['<div class="toolmenu" id="toolmenu" role="dialog" aria-modal="true" aria-label="ツールの一覧" hidden>',
           '  <div class="toolmenu-box">',
           '    <div class="toolmenu-head">',
           '      <input type="search" class="toolmenu-q" placeholder="ツールを探す（例：qr、歌、画像、OBS）" aria-label="ツールを探す" autocomplete="off">',
           f'      <a class="toolmenu-top" href="{attr(root or "./")}">トップの一覧へ</a>',
           '      <button type="button" class="toolmenu-close" aria-label="閉じる">×</button>',
           '    </div>',
           '    <div class="toolmenu-body">']
    for s in data['sections']:
        out += ['      <section class="toolmenu-sec">', f'        <h2>{esc(s["title"])}</h2>', '        <div class="toolmenu-grid">']
        for c in s['cards']:
            link = c.get('href')
            ext = False
            if not link:
                inner = [l for l in c.get('links', []) if not l.get('external')]
                link, ext = (inner[0]['href'], False) if inner else ((c.get('links') or [{}])[0].get('href'), True)
            if not link:
                continue
            href = link if ext else root + link
            on = not ext and here and link.split('/')[0] == here
            q = ' '.join([c['name'], c.get('tag', ''), c.get('kind', ''), c.get('desc', '')])
            extra = (' aria-current="page"' if on else '') + (' target="_blank" rel="noopener"' if ext else '')
            out += [f'          <a class="toolmenu-item{" on" if on else ""}" href="{attr(href)}" data-q="{attr(q)}"{extra}>',
                    '            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + ''.join(c['icon']) + '</svg>',
                    f'            <span><b>{esc(c["name"])}{" ↗" if ext else ""}</b><small>{esc(c.get("tag", ""))}</small></span>',
                    '          </a>']
        out += ['        </div>', '      </section>']
    site = [('https://donnma.com/', 'サイトのトップ'), ('https://donnma.com/blog/', 'ブログ'), ('https://donnma.com/profile/', 'プロフィール'),
            ('https://donnma.com/link/', 'リンク'), ('https://donnma.com/form/', 'お問い合わせ'),
            ('https://donnma.booth.pm/item_lists/nevT9GeV', 'BOOTH'), ('https://twitter.com/donnma777', 'X（@donnma777）')]
    out += ['      <p class="toolmenu-none" hidden>見つかりませんでした</p>',
            '    </div>',
            '    <nav class="toolmenu-foot" aria-label="どんまうんど（donnma.com）">',
            '      <span class="toolmenu-foot-label">どんまうんど</span>']
    out += [f'      <a href="{attr(u)}" target="_blank" rel="noopener">{esc(t)} ↗</a>' for u, t in site]
    out += ['    </nav>',
            '  </div>',
            '</div>',
            '<script>',
            '  (() => {',
            "    const m = document.getElementById('toolmenu');",
            "    const btns = () => document.querySelectorAll('.topnav-menu, [data-toolmenu]');",
            "    if (!m) return;",
            "    const q = m.querySelector('.toolmenu-q'), none = m.querySelector('.toolmenu-none');",
            r"    const kana = t => t.toLowerCase().replace(/[\u30a1-\u30f6]/g, c => String.fromCharCode(c.charCodeAt(0) - 0x60));",
            "    const filter = () => {",
            r"      const w = kana(q.value.trim()).split(/\s+/).filter(Boolean);",
            "      let any = false;",
            "      for (const sec of m.querySelectorAll('.toolmenu-sec')) {",
            "        let n = 0;",
            "        for (const a of sec.querySelectorAll('.toolmenu-item')) { const hit = w.every(x => kana(a.dataset.q).includes(x)); a.hidden = !hit; if (hit) n++; }",
            "        sec.hidden = !n; any = any || n > 0;",
            "      }",
            "      none.hidden = any;",
            "    };",
            "    const open = () => { m.hidden = false; document.documentElement.classList.add('toolmenu-open'); btns().forEach(b => b.setAttribute('aria-expanded', 'true')); q.value = ''; filter(); q.focus(); };",
            "    const close = () => { m.hidden = true; document.documentElement.classList.remove('toolmenu-open'); btns().forEach(b => b.setAttribute('aria-expanded', 'false')); };",
            "    // 「ツール一覧 ▾」と左上のロゴ（どんまうんど Tools）で開く。トップへは、メニューの「トップの一覧へ」から",
            "    document.addEventListener('click', e => { const b = e.target.closest('.topnav-menu, [data-toolmenu], a.topnav-brand'); if (!b) return; e.preventDefault(); (m.hidden ? open() : close()); });",
            "    m.addEventListener('click', e => { if (e.target === m || e.target.closest('.toolmenu-close')) close(); });",
            "    q.addEventListener('input', filter);",
            "    q.addEventListener('keydown', e => { if (e.key === 'Enter') { const a = m.querySelector('.toolmenu-item:not([hidden])'); if (a) a.click(); } });",
            "    document.addEventListener('keydown', e => { if (e.key === 'Escape' && !m.hidden) { e.stopPropagation(); close(); } }, true);",
            "    window.openToolMenu = open;",
            '  })();',
            '</script>']
    return out


# テンプレートのファイルではなく、プログラムで中身を作る目印
GENERATORS = {'tools': tools_list}


def build(text, rel=None):
    for ext, start, end, mark in MARKS:
        def repl(m):
            # 値のない設定（back など）は '1' にする
            opts = {o.group(1): '1' if o.group(2) is None else o.group(2) for o in OPT.finditer(m.group('opts'))}
            ind, name = m.group('indent'), m.group('name')
            head = f"{ind}{start} shared:{name}{m.group('opts')}{end}{m.group('nl')}"
            if name in GENERATORS:
                nl = m.group('nl')
                body = nl.join(ind + x if x else x for x in GENERATORS[name](opts)) + nl
            else:
                body = render(name, ext, opts, ind, m.group('nl'))
                # 「ツール一覧」があるヘッダーには、開くメニューも足す
                if name == 'header' and ext == 'html' and opts.get('back'):
                    nl = m.group('nl')
                    body += nl.join(ind + x if x else x for x in toolmenu_lines(opts.get('root', ''), rel)) + nl
            return f"{head}{body}{ind}{start} /shared:{name} {end}"
        text = mark.sub(repl, text)
    return text


def main():
    # Windows のコンソールでも日本語が化けないように
    if hasattr(sys.stdout, 'reconfigure'):
        sys.stdout.reconfigure(encoding='utf-8')
    check = '--check' in sys.argv[1:]
    stale = []
    for path in sorted(ROOT.rglob('*.html')):
        rel = path.relative_to(ROOT)
        if rel.parts[0] in ('.git', '_shared'):
            continue
        with open(path, encoding='utf-8', newline='') as f:
            text = f.read()
        if 'shared:' not in text:
            continue
        new = build(text, rel)
        if new == text:
            continue
        stale.append(rel.as_posix())
        if not check:
            with open(path, 'w', encoding='utf-8', newline='') as f:
                f.write(new)
    if check:
        for p in stale:
            print(f'書き換えが要ります: {p}')
        sys.exit(1 if stale else 0)
    print(f'{len(stale)} ページを書き換えました' + (': ' + ', '.join(stale) if stale else ''))


if __name__ == '__main__':
    main()
