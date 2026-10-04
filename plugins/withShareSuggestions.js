/**
 * קבוצות צ'אט כהצעות בשורת האנשים של גיליון השיתוף.
 *
 * iOS — רץ אחרי expo-share-intent (ios.finalized):
 *   - Share Extension מצהיר IntentsSupported=INSendMessageIntent
 *   - ShareViewController מצרף &target=<conversationIdentifier> ל-URL שפותח את האפליקציה
 *   - האפליקציה מצהירה NSUserActivityTypes=INSendMessageIntent (לתרומות)
 * Android — sharing shortcuts (share_targets.xml + meta-data על MainActivity).
 */
const fs = require('node:fs');
const path = require('node:path');
const plist = require('@expo/plist').default;
const {
  AndroidConfig,
  withAndroidManifest,
  withDangerousMod,
  withFinalizedMod,
  withInfoPlist,
} = require('@expo/config-plugins');

const INTENT = 'INSendMessageIntent';
const TARGET_MARKER = 'shareTargetQuery()';

function shareExtensionName(config) {
  const entry = (config.plugins || []).find(
    (p) => (Array.isArray(p) ? p[0] : p) === 'expo-share-intent',
  );
  const params = Array.isArray(entry) ? entry[1] || {} : {};
  const raw = params.iosShareExtensionName;
  return raw ? raw.replace(/[^a-zA-Z0-9]/g, '') : 'ShareExtension';
}

function patchViewController(source) {
  if (source.includes(TARGET_MARKER)) return source;
  const redirect = '?nonce=\\(nonce)#\\(type)';
  if (!source.includes(redirect)) {
    throw new Error('[withShareSuggestions] ShareViewController redirect URL not found — expo-share-intent template changed');
  }
  return (
    source
      .replace('import UIKit', 'import Intents\nimport UIKit')
      .replace(redirect, `?nonce=\\(nonce)\\(${TARGET_MARKER})#\\(type)`) +
    `

extension ShareViewController {
  /** קבוצה שנבחרה משורת ההצעות של גיליון השיתוף */
  func ${TARGET_MARKER} -> String {
    guard let intent = extensionContext?.intent as? INSendMessageIntent,
      let id = intent.conversationIdentifier,
      let encoded = id.addingPercentEncoding(withAllowedCharacters: .alphanumerics)
    else { return "" }
    return "&target=\\(encoded)"
  }
}
`
  );
}

function withIosShareSuggestions(config) {
  config = withInfoPlist(config, (cfg) => {
    const types = new Set(cfg.modResults.NSUserActivityTypes || []);
    types.add(INTENT);
    cfg.modResults.NSUserActivityTypes = [...types];
    return cfg;
  });

  return withFinalizedMod(config, [
    'ios',
    async (cfg) => {
      const dir = path.join(cfg.modRequest.platformProjectRoot, shareExtensionName(cfg));
      const infoPath = path.join(dir, 'ShareExtension-Info.plist');
      const controllerPath = path.join(dir, 'ShareViewController.swift');
      if (!fs.existsSync(infoPath) || !fs.existsSync(controllerPath)) {
        throw new Error(`[withShareSuggestions] share extension files missing in ${dir}`);
      }

      const info = plist.parse(fs.readFileSync(infoPath, 'utf8'));
      // השם שמופיע מתחת לאייקון בגיליון השיתוף
      info.CFBundleDisplayName = cfg.name;
      const attrs = (info.NSExtension.NSExtensionAttributes ||= {});
      const supported = new Set(attrs.IntentsSupported || []);
      supported.add(INTENT);
      attrs.IntentsSupported = [...supported];
      fs.writeFileSync(infoPath, plist.build(info));

      fs.writeFileSync(controllerPath, patchViewController(fs.readFileSync(controllerPath, 'utf8')));
      return cfg;
    },
  ]);
}

function shareTargetsXml(packageName) {
  return `<?xml version="1.0" encoding="utf-8"?>
<shortcuts xmlns:android="http://schemas.android.com/apk/res/android">
  <share-target android:targetClass="${packageName}.MainActivity">
    <data android:mimeType="text/*"/>
    <data android:mimeType="image/*"/>
    <data android:mimeType="video/*"/>
    <category android:name="${packageName}.SHARE_TARGET"/>
  </share-target>
</shortcuts>
`;
}

function withAndroidShareSuggestions(config) {
  config = withAndroidManifest(config, (cfg) => {
    const activity = AndroidConfig.Manifest.getMainActivityOrThrow(cfg.modResults);
    const metas = (activity['meta-data'] ||= []);
    if (!metas.some((m) => m.$['android:name'] === 'android.app.shortcuts')) {
      metas.push({ $: { 'android:name': 'android.app.shortcuts', 'android:resource': '@xml/share_targets' } });
    }
    return cfg;
  });

  return withDangerousMod(config, [
    'android',
    async (cfg) => {
      const pkg = cfg.android?.package;
      if (!pkg) throw new Error('[withShareSuggestions] android.package is required');
      const xmlDir = path.join(cfg.modRequest.platformProjectRoot, 'app/src/main/res/xml');
      await fs.promises.mkdir(xmlDir, { recursive: true });
      await fs.promises.writeFile(path.join(xmlDir, 'share_targets.xml'), shareTargetsXml(pkg));
      return cfg;
    },
  ]);
}

module.exports = function withShareSuggestions(config) {
  return withAndroidShareSuggestions(withIosShareSuggestions(config));
};
module.exports.patchViewController = patchViewController;
