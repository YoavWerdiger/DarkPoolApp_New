#!/usr/bin/env node
/**
 * i18n-missing — prints the dotted keys that exist in he.ts (source of truth) but are
 * missing in each other locale (en, ar), plus a count.
 *
 * Usage:
 *   node scripts/i18n-missing.js            # all target languages
 *   node scripts/i18n-missing.js ar         # one language
 *   node scripts/i18n-missing.js --json     # machine-readable: { en: [...], ar: [...] }
 *
 * Plurals: he.ts uses `x_one` / `x_other`. For Arabic, every `x_other` key additionally
 * requires `x_zero`, `x_two`, `x_few`, `x_many` (i18next's Arabic plural categories); those
 * are reported as missing too. English needs only the he keys.
 *
 * No extra deps: the .ts locale files are transpiled in-memory with the repo's `typescript`.
 */
const fs = require('fs');
const path = require('path');
const ts = require('typescript');

const LOCALES_DIR = path.join(__dirname, '..', 'lib', 'i18n', 'locales');
const SOURCE = 'he';
const TARGETS = ['en', 'ar'];
const EXTRA_PLURAL_SUFFIXES = { ar: ['zero', 'two', 'few', 'many'] };

function loadLocale(lang) {
  const file = path.join(LOCALES_DIR, `${lang}.ts`);
  const source = fs.readFileSync(file, 'utf8');
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
    fileName: file,
  });
  const mod = { exports: {} };
  // Locale files only `import type` — nothing to resolve at runtime.
  new Function('module', 'exports', 'require', outputText)(mod, mod.exports, (id) => {
    throw new Error(`${lang}.ts: unexpected runtime import "${id}"`);
  });
  return mod.exports.default ?? mod.exports;
}

function flatten(obj, prefix = '', out = new Map()) {
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === 'object') flatten(v, key, out);
    else out.set(key, v);
  }
  return out;
}

function requiredKeys(sourceKeys, lang) {
  const extra = EXTRA_PLURAL_SUFFIXES[lang] || [];
  const keys = [];
  for (const key of sourceKeys) {
    keys.push(key);
    if (extra.length && key.endsWith('_other')) {
      const base = key.slice(0, -'_other'.length);
      for (const s of extra) keys.push(`${base}_${s}`);
    }
  }
  return keys;
}

function main() {
  const args = process.argv.slice(2);
  const asJson = args.includes('--json');
  const langs = args.filter((a) => !a.startsWith('--'));
  const targets = langs.length ? langs : TARGETS;

  const sourceKeys = [...flatten(loadLocale(SOURCE)).keys()];
  const result = {};

  for (const lang of targets) {
    const have = flatten(loadLocale(lang));
    result[lang] = requiredKeys(sourceKeys, lang).filter((k) => {
      const v = have.get(k);
      return typeof v !== 'string' || v.trim() === '';
    });
  }

  if (asJson) {
    process.stdout.write(JSON.stringify(result, null, 2) + '\n');
    return;
  }

  console.log(`Source: ${SOURCE}.ts — ${sourceKeys.length} keys`);
  for (const lang of targets) {
    const missing = result[lang];
    console.log(`\n[${lang}] missing ${missing.length} key(s)`);
    for (const k of missing) console.log(`  ${k}`);
  }
}

main();
