#!/usr/bin/env python3
"""Lista as Edge Functions afetadas pelos arquivos alterados (um por linha no stdin).

Uma função é afetada se o próprio index.ts ou qualquer arquivo que ele importa (ex.: _shared/passageCheck.ts) mudou.
Usado pelo workflow .github/workflows/deploy-functions.yml. Só lê arquivos; não publica nada.
"""
import os
import re
import sys

ROOT = 'supabase/functions'
IMPORT = re.compile(r"""(?:from|import)\s*\(?\s*['"](\.{1,2}/[^'"]+)['"]""")


def deps(fn: str) -> set[str]:
    seen: set[str] = set()
    stack = [os.path.join(ROOT, fn, 'index.ts')]
    while stack:
        f = os.path.normpath(stack.pop())
        if f in seen or not os.path.isfile(f):
            continue
        seen.add(f)
        with open(f, encoding='utf-8') as fh:
            src = fh.read()
        for m in IMPORT.finditer(src):
            stack.append(os.path.join(os.path.dirname(f), m.group(1)))
    return seen


def main() -> None:
    changed = {os.path.normpath(l.strip()) for l in sys.stdin if l.strip()}
    out = []
    for fn in sorted(os.listdir(ROOT)):
        if fn.startswith('_') or not os.path.isfile(os.path.join(ROOT, fn, 'index.ts')):
            continue
        if deps(fn) & changed:
            out.append(fn)
    print('\n'.join(out))


if __name__ == '__main__':
    main()
