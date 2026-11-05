#!/usr/bin/env node
/**
 * חילוץ טקסט עברי מהקוד ל-i18n (אוטומטי).
 *
 * מחליף מחרוזות / טקסט JSX / template literals בעברית ב-i18n.t('auto.<קובץ>.sN', {...})
 * וכותב את הערכים ל-lib/i18n/locales/he.auto.json. בעברית ההתנהגות זהה (t מחזיר את אותה מחרוזת).
 *
 * לא נוגע במחרוזות שהלוגיקה תלויה בהן: השוואות (=== / case), ארגומנטים של includes/startsWith/
 * eq/ilike וכו', מפתחות אובייקט, Set/Map/RegExp, enum, `as const`, טיפוסים, console/logger/Error,
 * ותוך worklets (useAnimatedStyle / ג'סטות).
 *
 * שימוש: node scripts/i18n-extract.js [--dry] <files...>
 */
const fs = require('fs');
const path = require('path');
const { parse } = require('@babel/parser');
const traverse = require('@babel/traverse').default;

const ROOT = path.resolve(__dirname, '..');
const HE_AUTO = path.join(ROOT, 'lib/i18n/locales/he.auto.json');
const HEB = /[֐-׿]/;

const SKIP_METHODS = new Set([
  'includes', 'startsWith', 'endsWith', 'indexOf', 'lastIndexOf', 'replace', 'replaceAll', 'split',
  'match', 'matchAll', 'test', 'search', 'has', 'get', 'set', 'delete', 'localeCompare',
  // supabase query builder — ערכים שמושווים ל-DB
  'eq', 'neq', 'ilike', 'like', 'in', 'contains', 'containedBy', 'or', 'not', 'is', 'textSearch',
  'overlaps', 'rpc', 'from', 'select', 'order', 'channel',
  // אחסון / ניווט
  'getItem', 'setItem', 'removeItem', 'emit', 'addListener', 'on', 'off',
  'require',
]);
const SKIP_CALLEE_OBJECTS = new Set(['console', 'logger', 'Sentry', 'AsyncStorage', 'SecureStore']);
const SKIP_CONSTRUCTORS = new Set(['Set', 'Map', 'RegExp', 'Error', 'TypeError', 'WeakMap']);
const SKIP_JSX_ATTRS = new Set(['key', 'testID', 'nativeID', 'id', 'source', 'name', 'icon', 'type']);
const WORKLET_HOOKS = new Set([
  'useAnimatedStyle', 'useAnimatedProps', 'useDerivedValue', 'useAnimatedReaction',
  'useAnimatedScrollHandler', 'useFrameCallback', 'runOnUI', 'useAnimatedGestureHandler',
]);
const GESTURE_METHODS = /^on(Begin|Start|Update|Change|End|Finalize|TouchesDown|TouchesMove|TouchesUp|TouchesCancelled)$/;

function nsFor(file) {
  return path
    .relative(ROOT, file)
    .replace(/\.(tsx?|jsx?)$/, '')
    .replace(/[\/\\]/g, '__')
    .replace(/[^A-Za-z0-9_]/g, '_');
}

/** כללי JSX לרווחים בטקסט (כמו babel cleanJSXElementLiteralChild) */
function cleanJsxText(value) {
  const lines = value.split(/\r\n|\n|\r/);
  let lastNonEmpty = 0;
  lines.forEach((l, i) => {
    if (/[^ \t]/.test(l)) lastNonEmpty = i;
  });
  let out = '';
  lines.forEach((line, i) => {
    const isFirst = i === 0;
    const isLast = i === lines.length - 1;
    const isLastNonEmpty = i === lastNonEmpty;
    let t = line.replace(/\t/g, ' ');
    if (!isFirst) t = t.replace(/^[ ]+/, '');
    if (!isLast) t = t.replace(/[ ]+$/, '');
    if (t) {
      if (!isLastNonEmpty) t += ' ';
      out += t;
    }
  });
  return out;
}

function isInsideWorklet(p) {
  let cur = p;
  while (cur) {
    if (cur.isFunction && cur.isFunction()) {
      const body = cur.node.body;
      if (body && body.directives && body.directives.some((d) => d.value.value === 'worklet')) return true;
      const parent = cur.parentPath;
      if (parent && parent.isCallExpression()) {
        const callee = parent.node.callee;
        if (callee.type === 'Identifier' && WORKLET_HOOKS.has(callee.name)) return true;
        if (callee.type === 'MemberExpression' && callee.property.type === 'Identifier' && GESTURE_METHODS.test(callee.property.name)) return true;
      }
    }
    cur = cur.parentPath;
  }
  return false;
}

/** האם המחרוזת משמשת ללוגיקה (השוואה / מפתח / שאילתה) ולא לתצוגה */
function isLogicString(p) {
  let child = p;
  let cur = p.parentPath;
  for (let depth = 0; cur && depth < 8; depth++) {
    const n = cur.node;
    switch (n.type) {
      case 'BinaryExpression':
        if (['===', '!==', '==', '!=', 'in', 'instanceof'].includes(n.operator)) return true;
        break;
      case 'SwitchCase':
        if (n.test === child.node) return true;
        break;
      case 'ObjectProperty':
      case 'ObjectMethod':
      case 'ClassProperty':
        if (n.key === child.node) return true;
        break;
      case 'TSEnumMember':
      case 'TSLiteralType':
      case 'TSAsExpression':
        if (n.type !== 'TSAsExpression' || (n.typeAnnotation && n.typeAnnotation.type === 'TSTypeReference' && n.typeAnnotation.typeName.name === 'const')) return true;
        break;
      case 'ImportDeclaration':
      case 'ExportNamedDeclaration':
      case 'ExportAllDeclaration':
      case 'TaggedTemplateExpression':
        if (n.type !== 'ExportNamedDeclaration' || n.source) return true;
        break;
      case 'NewExpression':
        if (n.callee.type === 'Identifier' && SKIP_CONSTRUCTORS.has(n.callee.name)) return true;
        break;
      case 'CallExpression':
      case 'OptionalCallExpression': {
        const c = n.callee;
        if (c.type === 'Identifier' && (c.name === 'require' || SKIP_CONSTRUCTORS.has(c.name))) return true;
        if (c.type === 'MemberExpression' || c.type === 'OptionalMemberExpression') {
          const obj = c.object;
          if (obj.type === 'Identifier' && SKIP_CALLEE_OBJECTS.has(obj.name)) return true;
          const prop = c.property.type === 'Identifier' ? c.property.name : null;
          // ארגומנט של מתודה לוגית, או אובייקט שעליו היא נקראת (['א','ב'].includes(x))
          if (prop && SKIP_METHODS.has(prop)) return true;
        }
        // עד הקריאה הקרובה בלבד — מעבר לה המחרוזת היא ערך לתצוגה
        return false;
      }
      case 'MemberExpression':
      case 'OptionalMemberExpression':
        if (n.computed && n.property === child.node) return true; // MAP['מפתח']
        break;
      case 'JSXAttribute':
        if (n.name && SKIP_JSX_ATTRS.has(n.name.name)) return true;
        return false;
      case 'VariableDeclarator':
      case 'ReturnStatement':
      case 'JSXExpressionContainer':
      case 'ArrowFunctionExpression':
      case 'FunctionDeclaration':
        return false;
      default:
        break;
    }
    child = cur;
    cur = cur.parentPath;
  }
  return false;
}

function processFile(file, heAuto, dry) {
  const src = fs.readFileSync(file, 'utf8');
  if (!HEB.test(src)) return { count: 0 };
  let ast;
  try {
    ast = parse(src, { sourceType: 'module', plugins: ['typescript', 'jsx'], errorRecovery: false });
  } catch (e) {
    return { count: 0, error: e.message };
  }
  const ns = nsFor(file);
  const table = heAuto[ns] || {};
  const byValue = new Map(Object.entries(table).map(([k, v]) => [v, k]));
  let next = Object.keys(table).length;
  const keyFor = (value) => {
    if (byValue.has(value)) return byValue.get(value);
    const k = `s${++next}`;
    table[k] = value;
    byValue.set(value, k);
    return k;
  };
  const edits = [];
  const consumed = new Set();
  const tCall = (key, vars) => {
    const full = `auto.${ns}.${key}`;
    if (!vars || !vars.length) return `i18n.t('${full}')`;
    return `i18n.t('${full}', { ${vars.map((v, i) => `v${i}: ${v}`).join(', ')} })`;
  };
  const exprSrc = (node) => src.slice(node.start, node.end);

  traverse(ast, {
    JSXElement(p) { handleJsxChildren(p); },
    JSXFragment(p) { handleJsxChildren(p); },
    JSXAttribute(p) {
      const v = p.node.value;
      if (!v || v.type !== 'StringLiteral' || !HEB.test(v.value)) return;
      if (SKIP_JSX_ATTRS.has(p.node.name.name)) return;
      consumed.add(v);
      edits.push({ start: v.start, end: v.end, text: `{${tCall(keyFor(v.value))}}` });
    },
    StringLiteral(p) {
      const n = p.node;
      if (consumed.has(n) || !HEB.test(n.value)) return;
      if (p.parentPath.isJSXAttribute()) return;
      if (isLogicString(p) || isInsideWorklet(p)) return;
      edits.push({ start: n.start, end: n.end, text: tCall(keyFor(n.value)) });
    },
    BinaryExpression(p) {
      // 'א ' + 'ב' + x — שרשרת אחת → מפתח אחד (משפט שלם לתרגום)
      const n = p.node;
      if (n.operator !== '+' || (p.parentPath.isBinaryExpression() && p.parentPath.node.operator === '+')) return;
      const parts = [];
      const flat = (x) => {
        if (x.type === 'BinaryExpression' && x.operator === '+') {
          flat(x.left);
          flat(x.right);
        } else parts.push(x);
      };
      flat(n);
      const hasHeb = parts.some(
        (x) => (x.type === 'StringLiteral' && HEB.test(x.value)) || (x.type === 'TemplateLiteral' && x.quasis.some((q) => HEB.test(q.value.cooked ?? q.value.raw))),
      );
      // רק כשלפחות שני חלקים הם טקסט — אחרת זו לא שרשרת משפט
      const textParts = parts.filter((x) => x.type === 'StringLiteral' || x.type === 'TemplateLiteral').length;
      if (!hasHeb || textParts < 2) return;
      if (isLogicString(p) || isInsideWorklet(p)) return;
      let value = '';
      const vars = [];
      for (const x of parts) {
        if (x.type === 'StringLiteral') value += x.value.replace(/\{\{/g, '{ {');
        else if (x.type === 'TemplateLiteral') {
          x.quasis.forEach((q, i) => {
            value += (q.value.cooked ?? q.value.raw).replace(/\{\{/g, '{ {');
            if (i < x.expressions.length) {
              value += `{{v${vars.length}}}`;
              vars.push(exprSrc(x.expressions[i]));
            }
          });
        } else {
          value += `{{v${vars.length}}}`;
          vars.push(exprSrc(x));
        }
      }
      traverseConsume(n);
      edits.push({ start: n.start, end: n.end, text: tCall(keyFor(value), vars) });
    },
    TemplateLiteral(p) {
      const n = p.node;
      if (consumed.has(n)) return;
      if (!n.quasis.some((q) => HEB.test(q.value.cooked ?? q.value.raw))) return;
      if (p.parentPath.isTaggedTemplateExpression()) return;
      if (isLogicString(p) || isInsideWorklet(p)) return;
      let value = '';
      const vars = [];
      n.quasis.forEach((q, i) => {
        value += (q.value.cooked ?? q.value.raw).replace(/\{\{/g, '{ {');
        if (i < n.expressions.length) {
          value += `{{v${vars.length}}}`;
          vars.push(exprSrc(n.expressions[i]));
        }
      });
      edits.push({ start: n.start, end: n.end, text: tCall(keyFor(value), vars) });
      p.skip();
    },
  });

  function handleJsxChildren(p) {
    const kids = p.node.children;
    if (!kids.some((c) => c.type === 'JSXText' && HEB.test(c.value))) return;
    if (isInsideWorklet(p)) return;
    const simple = kids.every(
      (c) => c.type === 'JSXText' || (c.type === 'JSXExpressionContainer' && c.expression.type !== 'JSXElement' && c.expression.type !== 'JSXFragment' && c.expression.type !== 'ConditionalExpression' && c.expression.type !== 'LogicalExpression'),
    );
    if (simple) {
      // טקסט + {ביטויים} בשורה אחת → מפתח אחד עם משתנים (סדר מילים נכון בתרגום)
      let value = '';
      const vars = [];
      let first = null;
      let last = null;
      for (const c of kids) {
        if (c.type === 'JSXText') {
          const t = cleanJsxText(c.value);
          if (t) {
            value += t.replace(/\{\{/g, '{ {');
            first = first ?? c;
            last = c;
          }
        } else if (c.expression.type !== 'JSXEmptyExpression') {
          value += `{{v${vars.length}}}`;
          vars.push(exprSrc(c.expression));
          first = first ?? c;
          last = c;
          // מחרוזות בתוך הביטוי נכנסות למשתנה כמו שהן
          traverseConsume(c.expression);
        }
      }
      if (!first || !HEB.test(value)) return;
      // שומרים רווחים מובילים/נגררים מקוריים מחוץ לטווח
      edits.push({ start: first.start, end: last.end, text: `{${tCall(keyFor(value.trim()), vars)}}`, jsxText: true, first, last });
      return;
    }
    for (const c of kids) {
      if (c.type !== 'JSXText' || !HEB.test(c.value)) continue;
      const t = cleanJsxText(c.value).trim();
      if (!t) continue;
      const lead = c.value.match(/^\s*/)[0];
      const trail = c.value.match(/\s*$/)[0];
      edits.push({ start: c.start + lead.length, end: c.end - trail.length, text: `{${tCall(keyFor(t))}}` });
    }
  }

  function traverseConsume(node) {
    // מסמן מחרוזות בתוך ביטוי שנכנס כמשתנה — לא להחליף אותן בנפרד (הטווח כבר מוחלף)
    const stack = [node];
    while (stack.length) {
      const n = stack.pop();
      if (!n || typeof n !== 'object') continue;
      if (n.type === 'StringLiteral' || n.type === 'TemplateLiteral') consumed.add(n);
      for (const k of Object.keys(n)) {
        if (k === 'loc' || k === 'start' || k === 'end') continue;
        const v = n[k];
        if (Array.isArray(v)) v.forEach((x) => stack.push(x));
        else if (v && typeof v === 'object' && v.type) stack.push(v);
      }
    }
  }

  // הסרת עריכות חופפות (שומרים את החיצונית)
  edits.sort((a, b) => a.start - b.start || b.end - a.end);
  const kept = [];
  let lastEnd = -1;
  for (const e of edits) {
    if (e.start < lastEnd) continue;
    kept.push(e);
    lastEnd = e.end;
  }
  // StringLiteral/Template שנצרכו לתוך משתנה JSX — כבר מחוץ ל-kept בזכות החפיפה
  if (!kept.length) return { count: 0 };
  let out = src;
  for (const e of [...kept].sort((a, b) => b.start - a.start)) {
    out = out.slice(0, e.start) + e.text + out.slice(e.end);
  }
  if (!/^import i18n from ['"][^'"]*lib\/i18n['"];?$/m.test(out)) {
    let rel = path.relative(path.dirname(file), path.join(ROOT, 'lib/i18n'));
    if (!rel.startsWith('.')) rel = './' + rel;
    out = `import i18n from '${rel}';\n` + out;
  }
  // אימות: הקובץ עדיין נקרא
  try {
    parse(out, { sourceType: 'module', plugins: ['typescript', 'jsx'] });
  } catch (e) {
    return { count: 0, error: 'post-parse: ' + e.message };
  }
  heAuto[ns] = table;
  if (!dry) fs.writeFileSync(file, out);
  return { count: kept.length };
}

function main() {
  const args = process.argv.slice(2);
  const dry = args.includes('--dry');
  const files = args.filter((a) => a !== '--dry').map((f) => path.resolve(f));
  const heAuto = fs.existsSync(HE_AUTO) ? JSON.parse(fs.readFileSync(HE_AUTO, 'utf8')) : {};
  let total = 0;
  const errors = [];
  for (const f of files) {
    if (f.includes(`${path.sep}lib${path.sep}i18n${path.sep}`)) continue;
    const r = processFile(f, heAuto, dry);
    total += r.count;
    if (r.error) errors.push(`${path.relative(ROOT, f)}: ${r.error}`);
  }
  if (!dry) fs.writeFileSync(HE_AUTO, JSON.stringify(heAuto, null, 2) + '\n');
  const keys = Object.values(heAuto).reduce((a, t) => a + Object.keys(t).length, 0);
  console.log(`replaced ${total} in ${files.length} files; ${keys} keys total${dry ? ' (dry run)' : ''}`);
  if (errors.length) console.log('errors:\n' + errors.join('\n'));
}

main();
