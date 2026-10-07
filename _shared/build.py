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
  back  「ツール一覧」（Tools のトップへのリンク）を出す
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


# テンプレートのファイルではなく、プログラムで中身を作る目印
GENERATORS = {'tools': tools_list}


def build(text):
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
        new = build(text)
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
