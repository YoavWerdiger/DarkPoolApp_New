import i18n from '../../lib/i18n';
import { TEXT_DIR } from '../../lib/i18n/language';
import { UI_DIR } from '../../lib/i18n/direction';
import { appLocale } from '../../lib/i18n/locale';
/**
 * אירוע בצ'אט (QA 4.2) — שם + תאריך ושעה, נשלח כהודעה מעוצבת.
 * iOS: בוחר inline בתוך השיט; Android: דיאלוגי המערכת (תאריך ואז שעה).
 */
import React, { useEffect, useMemo, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import BottomSheet from '../ui/BottomSheet/BottomSheet';
import { SheetActionButton } from '../ui/BottomSheet/SheetActionButton';
import { FloatingLabelField } from '../ui/FloatingLabelField';
import { useDesignTokens } from '../ui/DesignTokens';
import { APP_LAYOUT } from '../ui/appLayout';
import { APP_TYPE } from '../ui/appType';
import { useChatFitContentSnap } from './ChatBottomSheet';

type Props = {
  visible: boolean;
  onClose: () => void;
  onSend: (text: string) => void;
};

/** שעה עגולה הבאה — ברירת מחדל סבירה לאירוע */
function nextRoundHour(): Date {
  const d = new Date();
  d.setMinutes(0, 0, 0);
  d.setHours(d.getHours() + 1);
  return d;
}

export function formatEventMessage(title: string, when: Date): string {
  const date = when.toLocaleDateString(appLocale(), { weekday: 'long', day: 'numeric', month: 'long' });
  const time = when.toLocaleTimeString(appLocale(), { hour: '2-digit', minute: '2-digit', hour12: false });
  return `📅 ${title.trim()}\n${date} · ${time}`;
}

export default function ChatEventSheet({ visible, onClose, onSend }: Props) {
  const tokens = useDesignTokens();
  const insets = useSafeAreaInsets();
  const { snapPoint, onContentLayout } = useChatFitContentSnap(0.5, 0.9, 0.12);
  const [title, setTitle] = useState('');
  const [when, setWhen] = useState<Date>(nextRoundHour);

  useEffect(() => {
    if (!visible) return;
    setTitle('');
    setWhen(nextRoundHour());
  }, [visible]);

  const styles = useMemo(() => createStyles(), []);
  const whenLabel = useMemo(() => formatEventMessage('', when).split('\n')[1], [when]);

  const openAndroidPicker = () => {
    DateTimePickerAndroid.open({
      value: when,
      mode: 'date',
      minimumDate: new Date(),
      onChange: (e, date) => {
        if (e.type !== 'set' || !date) return;
        const picked = new Date(when);
        picked.setFullYear(date.getFullYear(), date.getMonth(), date.getDate());
        DateTimePickerAndroid.open({
          value: picked,
          mode: 'time',
          is24Hour: true,
          onChange: (e2, time) => {
            if (e2.type !== 'set' || !time) {
              setWhen(picked);
              return;
            }
            const next = new Date(picked);
            next.setHours(time.getHours(), time.getMinutes(), 0, 0);
            setWhen(next);
          },
        });
      },
    });
  };

  const canSend = title.trim().length > 0;

  return (
    <BottomSheet
      isOpen={visible}
      onClose={onClose}
      snapPoints={[snapPoint]}
      fitContent
      enablePanDownToClose
      showHandle
      useModal
      showBrandBackground={false}
      showBrandWatermark={false}
      edgeToEdge
      backgroundColor={tokens.colors.background.primary}
      topCornerRadius={tokens.borderRadius.xl}
    >
      <View style={[styles.container, { paddingBottom: Math.max(insets.bottom, 16) }]} onLayout={onContentLayout}>
        <Text style={[styles.title, { color: tokens.colors.text.primary }]}>
          {i18n.t('auto.components__chat__ChatEventSheet.s1')}
        </Text>

        <FloatingLabelField
          label={i18n.t('auto.components__chat__ChatEventSheet.s2')}
          value={title}
          onChangeText={setTitle}
          maxLength={120}
          returnKeyType="done"
        />

        {Platform.OS === 'ios' ? (
          <View style={styles.iosPicker}>
            <DateTimePicker
              value={when}
              mode="datetime"
              display="inline"
              minimumDate={new Date()}
              locale={appLocale()}
              onChange={(_, date) => date && setWhen(date)}
            />
          </View>
        ) : (
          <Pressable
            onPress={openAndroidPicker}
            style={[styles.whenRow, { backgroundColor: tokens.colors.background.input }]}
            accessibilityRole="button"
          >
            <Ionicons name="calendar-outline" size={20} color={tokens.colors.text.secondary} />
            <Text style={[styles.whenText, { color: tokens.colors.text.primary }]}>{whenLabel}</Text>
          </Pressable>
        )}

        <SheetActionButton
          label={i18n.t('auto.components__chat__ChatEventSheet.s3')}
          disabled={!canSend}
          onPress={() => {
            onSend(formatEventMessage(title, when));
            onClose();
          }}
          style={styles.send}
        />
      </View>
    </BottomSheet>
  );
}

function createStyles() {
  return StyleSheet.create({
    container: {
      direction: UI_DIR,
      paddingHorizontal: APP_LAYOUT.screenPaddingHorizontal,
      paddingTop: 4,
      gap: 12,
    },
    title: {
      fontSize: APP_TYPE.sectionTitle.fontSize,
      lineHeight: APP_TYPE.sectionTitle.lineHeight,
      fontWeight: APP_TYPE.sectionTitle.fontWeight,
      textAlign: 'center',
      writingDirection: TEXT_DIR,
      marginBottom: 4,
    },
    iosPicker: {
      alignItems: 'center',
    },
    whenRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      minHeight: 56,
      borderRadius: 26,
      paddingHorizontal: 18,
    },
    whenText: {
      fontSize: 16,
      writingDirection: TEXT_DIR,
    },
    send: {
      marginTop: 4,
    },
  });
}
