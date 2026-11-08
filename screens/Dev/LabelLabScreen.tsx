/**
 * פיתוח בלבד — שדה עם תווית צפה (FloatingLabelField): ריק / ריק עם הינט בפוקוס / מלא.
 * לא נרשם בבילד פרודקשן (App.tsx: רק ב-__DEV__).
 */
import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useDesignTokens } from '../../components/ui/DesignTokens';
import { FloatingLabelField } from '../../components/ui/FloatingLabelField';

export default function LabelLabScreen() {
  const t = useDesignTokens();
  const [name, setName] = useState('יואב ורדיגר');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: t.colors.background.primary }} edges={['top']}>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }} keyboardShouldPersistTaps="handled">
        <Text style={[styles.tag, { color: t.colors.text.tertiary }]}>מלא · ריק · ריק בפוקוס עם הינט</Text>
        <FloatingLabelField label="שם תצוגה" value={name} onChangeText={setName} />
        <FloatingLabelField label="טלפון" value={phone} onChangeText={setPhone} keyboardType="phone-pad" ltr />
        <FloatingLabelField
          label="אימייל"
          hint="name@example.com"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          ltr
          autoFocus
        />
        <View style={{ height: 8 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  tag: { fontSize: 11, fontWeight: '600', marginBottom: 4, textAlign: 'left' },
});
