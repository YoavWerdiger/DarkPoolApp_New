/**
 * מחליף Alert.alert ב-legacyAlert ומעדכן imports (screens + components בלבד).
 * הרצה: node scripts/migrate-legacy-alert.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');

function walk(dir, acc) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    if (ent.name === 'node_modules' || ent.name.startsWith('.')) continue;
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      if (ent.name === 'DarkPoolApp_New') continue;
      walk(p, acc);
    } else if (p.endsWith('.tsx') || p.endsWith('.ts')) acc.push(p);
  }
}

const files = [];
for (const sub of ['screens', 'components', path.join('DarkPoolApp_New', 'screens'), path.join('DarkPoolApp_New', 'components')]) {
  const d = path.join(root, sub);
  if (fs.existsSync(d)) walk(d, files);
}

for (const file of files) {
  let s = fs.readFileSync(file, 'utf8');
  if (!s.includes('Alert.alert')) continue;

  s = s.replace(/\bAlert\.alert\b/g, 'legacyAlert');

  const fromDir = path.dirname(file);
  let relImport = path.relative(fromDir, path.join(root, 'utils', 'appDialog'));
  relImport = relImport.replace(/\\/g, '/');
  if (!relImport.startsWith('.')) relImport = './' + relImport;

  const importLine = `import { legacyAlert } from '${relImport}';`;

  if (!s.includes(`'${relImport}'`) && !s.includes(`"${relImport}"`)) {
    const existingAppDialog = s.match(/import\s*\{([^}]+)\}\s*from\s*['"][^'"]*utils\/appDialog['"]/);
    if (existingAppDialog) {
      const inner = existingAppDialog[1];
      if (!inner.includes('legacyAlert')) {
        s = s.replace(existingAppDialog[0], (m) =>
          m.replace(/\{([^}]+)\}/, (_, x) => `{ ${x.trim()}, legacyAlert }`)
        );
      }
    } else {
      const firstImport = s.indexOf('import ');
      if (firstImport >= 0) {
        s = s.slice(0, firstImport) + importLine + '\n' + s.slice(firstImport);
      }
    }
  }

  s = s.replace(
    /import\s*\{([^}]*)\}\s*from\s*['"]react-native['"]/g,
    (full, inner) => {
      let parts = inner.split(',').map((x) => x.trim()).filter(Boolean);
      const hadAlert = parts.some((p) => p === 'Alert' || /^Alert(\s|$)/.test(p));
      if (!hadAlert) return full;
      parts = parts.filter((p) => p !== 'Alert' && !/^Alert\s+as\s/.test(p));
      if (parts.length === 0) return '';
      return `import { ${parts.join(', ')} } from 'react-native'`;
    }
  );

  s = s.replace(/\n\n\n+/g, '\n\n');
  fs.writeFileSync(file, s);
  console.log('ok', path.relative(root, file));
}
