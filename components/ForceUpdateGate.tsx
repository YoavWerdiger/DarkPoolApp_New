import React, { useEffect, useState } from 'react';
import { Linking, Platform, StyleSheet, Text, View } from 'react-native';
import Constants from 'expo-constants';
import { supabase } from '../services/supabase';
import UIButton from './ui/UIButton';
import { useDesignTokens } from './ui/DesignTokens';
import { TEXT_DIR } from '../lib/i18n/language';

/** 1.2.10 מול 1.10.0 — השוואה מספרית לכל חלק */
export function compareVersions(a: string, b: string): number {
  const pa = a.split('.').map((x) => parseInt(x, 10) || 0);
  const pb = b.split('.').map((x) => parseInt(x, 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length); i += 1) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (d !== 0) return d < 0 ? -1 : 1;
  }
  return 0;
}

type Required = { storeUrl: string; message: string | null };

/**
 * עדכון כפוי: אם גרסת האפליקציה נמוכה מ-app_config.min_version_<platform> — מסך חוסם עם «עדכן עכשיו».
 * תקלה ברשת / בטבלה לא חוסמת את האפליקציה.
 */
export default function ForceUpdateGate({ children }: { children: React.ReactNode }) {
  const tokens = useDesignTokens();
  const [required, setRequired] = useState<Required | null>(null);

  useEffect(() => {
    if (Platform.OS !== 'ios' && Platform.OS !== 'android') return;
    const current = Constants.nativeAppVersion ?? Constants.expoConfig?.version ?? '0.0.0';
    void supabase
      .from('app_config')
      .select('min_version_ios, min_version_android, ios_store_url, android_store_url, update_message')
      .eq('id', 1)
      .maybeSingle()
      .then(({ data }) => {
        if (!data) return;
        const min = Platform.OS === 'ios' ? data.min_version_ios : data.min_version_android;
        if (min && compareVersions(current, min) < 0) {
          setRequired({
            storeUrl: Platform.OS === 'ios' ? data.ios_store_url : data.android_store_url,
            message: data.update_message ?? null,
          });
        }
      }, () => {});
  }, []);

  if (!required) return <>{children}</>;
  return (
    <View style={[styles.root, { backgroundColor: tokens.colors.background.primary }]}>
      <Text style={[styles.title, { color: tokens.colors.text.primary }]}>יש גרסה חדשה</Text>
      <Text style={[styles.body, { color: tokens.colors.text.secondary }]}>
        {required.message || 'כדי להמשיך להשתמש ב-DarkPool צריך לעדכן את האפליקציה לגרסה האחרונה.'}
      </Text>
      <UIButton title="עדכן עכשיו" variant="primary" size="lg" fullWidth onPress={() => void Linking.openURL(required.storeUrl)} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32, gap: 16 },
  title: { fontSize: 24, fontWeight: '700', textAlign: 'center', writingDirection: TEXT_DIR },
  body: { fontSize: 16, lineHeight: 24, textAlign: 'center', writingDirection: TEXT_DIR, marginBottom: 8 },
});
