#!/usr/bin/env node
/**
 * i18n-missing — prints the dotted keys that exist in Hebrew (source of truth) but are
 * missing in each other locale (en, ar), plus a count.
 *
 * Covers both sources, merged exactly like lib/i18n/index.ts does at runtime:
 *   - locales/<lang>.ts          (hand-written keys: common.*, drawer.*, settings.*)
 *   - locales/<lang>.auto.json   (extracted keys, under the `auto.` prefix)
 *
 * Usage:
 *   node scripts/i18n-missing.js            # all target languages
 *   node scripts/i18n-missing.js ar         # one language
 *   node scripts/i18n-missing.js --json     # machine-readable: { en: [...], ar: [...] }
 *
 * Also reports, per language, keys whose {{placeholders}} differ from Hebrew.
 *
 * Plurals: he.ts uses `x_one` / `x_other`. For Arabic, every `x_other` key additionally
 * requires `x_zero`, `x_two`, `x_few`, `x_many` (i18next's Arabic plural categories); those
 * are reported as missing too. English needs only the he keys.
 *
 * INTENTIONALLY_HEBREW: extracted strings that are matching keywords / lookup keys, not
 * display text. They must NOT be translated (they fall back to Hebrew), so they are not
 * reported as missing.
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

/** namespace → true (whole namespace) | array of key numbers (sN) */
const INTENTIONALLY_HEBREW = {
  utils__economicEventImportance: true, // event-title matching keywords
  lib__notificationAlertScope: true, // alert matching needles
  components__chat__reactionEmojiData: true, // Hebrew emoji search words (alongside English ones)
  services__portfolios__portfolioImport: range(1, 11), // CSV header aliases
  services__courseService: [1, 5, 67], // course titles looked up by name
  hooks__useSubscription: [2, 3, 4], // no longer referenced
};

function range(a, b) {
  return Array.from({ length: b - a + 1 }, (_, i) => a + i);
}

function isIntentionallyHebrew(dottedKey) {
  const m = /^auto\.([^.]+)\.s(\d+)$/.exec(dottedKey);
  if (!m) return false;
  const rule = INTENTIONALLY_HEBREW[m[1]];
  return rule === true || (Array.isArray(rule) && rule.includes(Number(m[2])));
}

function loadTs(lang) {
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

function loadLocale(lang) {
  const autoFile = path.join(LOCALES_DIR, `${lang}.auto.json`);
  const auto = fs.existsSync(autoFile) ? JSON.parse(fs.readFileSync(autoFile, 'utf8')) : {};
  return { ...loadTs(lang), auto };
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
    if (isIntentionallyHebrew(key)) continue;
    keys.push(key);
    if (extra.length && key.endsWith('_other')) {
      const base = key.slice(0, -'_other'.length);
      for (const s of extra) keys.push(`${base}_${s}`);
    }
  }
  return keys;
}

const placeholders = (s) => (String(s).match(/\{\{[^}]+\}\}/g) || []).sort().join(',');

function main() {
  const args = process.argv.slice(2);
  const asJson = args.includes('--json');
  const langs = args.filter((a) => !a.startsWith('--'));
  const targets = langs.length ? langs : TARGETS;

  const source = flatten(loadLocale(SOURCE));
  const sourceKeys = [...source.keys()];
  const excluded = sourceKeys.filter(isIntentionallyHebrew).length;
  const result = {};
  const mismatches = {};

  for (const lang of targets) {
    const have = flatten(loadLocale(lang));
    result[lang] = requiredKeys(sourceKeys, lang).filter((k) => {
      const v = have.get(k);
      return typeof v !== 'string' || v.trim() === '';
    });
    mismatches[lang] = [];
    for (const [k, v] of have) {
      // plural variants (x_zero…) are compared against x_other
      const base = source.has(k) ? k : k.replace(/_(zero|one|two|few|many)$/, '_other');
      if (source.has(base) && placeholders(v) !== placeholders(source.get(base)) && !/_(zero|one|two)$/.test(k)) {
        mismatches[lang].push(k);
      }
    }
  }

  if (asJson) {
    process.stdout.write(JSON.stringify(result, null, 2) + '\n');
    return;
  }

  console.log(`Source: he.ts + he.auto.json — ${sourceKeys.length} keys (${excluded} intentionally Hebrew-only, not counted)`);
  for (const lang of targets) {
    const missing = result[lang];
    console.log(`\n[${lang}] missing ${missing.length} key(s)`);
    for (const k of missing) console.log(`  ${k}`);
    if (mismatches[lang].length) {
      console.log(`[${lang}] placeholder mismatch in ${mismatches[lang].length} key(s)`);
      for (const k of mismatches[lang]) console.log(`  ${k}`);
    }
  }
}

main();
