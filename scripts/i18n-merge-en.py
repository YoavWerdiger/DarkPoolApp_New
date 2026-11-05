#!/usr/bin/env python3
"""ממזג קובצי תרגום (TSV: '## ns' ואז 'key<TAB>"json"') ל-lib/i18n/locales/en.auto.json ומאמת placeholders."""
import json, re, sys
he = json.load(open('lib/i18n/locales/he.auto.json'))
out = json.load(open('lib/i18n/locales/en.auto.json'))
ph = lambda s: sorted(re.findall(r'\{\{v\d+\}\}', s))
bad = []
for path in sys.argv[1:]:
    if path.endswith('.json'):
        for ns, t in json.load(open(path)).items():
            out.setdefault(ns, {}).update(t)
        continue
    ns = None
    for line in open(path, encoding='utf8'):
        line = line.rstrip('\n')
        if not line: continue
        if line.startswith('## '): ns = line[3:].strip(); continue
        k, v = line.split('\t', 1)
        v = json.loads(v)
        if ns not in he or k not in he[ns]: bad.append(f'unknown {ns}.{k}'); continue
        if ph(v) != ph(he[ns][k]): bad.append(f'placeholders {ns}.{k}: {he[ns][k]!r} -> {v!r}')
        out.setdefault(ns, {})[k] = v
json.dump(out, open('lib/i18n/locales/en.auto.json', 'w'), ensure_ascii=False, indent=2, sort_keys=False)
total = sum(len(t) for t in he.values()); done = sum(len(t) for t in out.values())
print(f'en.auto: {done}/{total} keys')
if bad: print('PROBLEMS:\n' + '\n'.join(bad)); sys.exit(1)
