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
  back  「← トップに戻る」を出す
  home  ロゴをリンクにしない（トップページ用）
  note  フッターの GitHub の横に足す一言

テンプレートの書き方:
  {{名前}}         設定の値に置き換える
  {{#名前}}行      設定があるときだけ、その行を出す
  {{^名前}}行      設定がないときだけ、その行を出す
"""
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


def build(text):
    for ext, start, end, mark in MARKS:
        def repl(m):
            # 値のない設定（back など）は '1' にする
            opts = {o.group(1): '1' if o.group(2) is None else o.group(2) for o in OPT.finditer(m.group('opts'))}
            ind, name = m.group('indent'), m.group('name')
            head = f"{ind}{start} shared:{name}{m.group('opts')}{end}{m.group('nl')}"
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
