/**
 * מצב ריק אחיד לכל האפליקציה — אייקון גדול בעיגול, כותרת והסבר ממורכזים, וכפתור אופציונלי.
 * כל מסך / שיט שאין בו תוכן משתמש ברכיב הזה כדי שהפלייסהולדרים ייראו אותו דבר בכל מקום.
 */
import React from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useDesignTokens } from './DesignTokens';
import UIButton from './UIButton';
import { APP_TYPE } from './appType';
import { APP_LAYOUT } from './appLayout';

export const EMPTY_STATE_CIRCLE = 96;
export const EMPTY_STATE_ICON = 44;

export type EmptyStateProps = {
  icon?: keyof typeof Ionicons.glyphMap;
  /** אייקון מותאם (למשל lucide) — מוצג בתוך אותו עיגול */
  renderIcon?: (args: { size: number; color: string }) => React.ReactNode;
  /** צבע האייקון; ברירת מחדל: טקסט משני */
  iconColor?: string;
  title: string;
  subtitle?: string;
  actionLabel?: string;
  actionIcon?: keyof typeof Ionicons.glyphMap;
  onAction?: () => void;
  /** compact — לשיטים ורשימות קצרות (פחות ריפוד אנכי) */
  compact?: boolean;
  style?: StyleProp<ViewStyle>;
  children?: React.ReactNode;
};

export function EmptyState({
  icon,
  renderIcon,
  iconColor,
  title,
  subtitle,
  actionLabel,
  actionIcon,
  onAction,
  compact = false,
  style,
  children,
}: EmptyStateProps) {
  const t = useDesignTokens();
  const color = iconColor ?? t.colors.text.secondary;
  return (
    <View style={[styles.wrap, compact ? styles.wrapCompact : null, style]}>
      {icon || renderIcon ? (
        <View style={[styles.circle, { backgroundColor: t.colors.background.cardSolid }]}>
          {renderIcon ? renderIcon({ size: EMPTY_STATE_ICON, color }) : (
            <Ionicons name={icon!} size={EMPTY_STATE_ICON} color={color} />
          )}
        </View>
      ) : null}
      <Text style={[styles.title, { color: t.colors.text.primary }]}>{title}</Text>
      {subtitle ? <Text style={[styles.subtitle, { color: t.colors.text.secondary }]}>{subtitle}</Text> : null}
      {actionLabel && onAction ? (
        <View style={styles.action}>
          <UIButton title={actionLabel} icon={actionIcon} variant="primary" onPress={onAction} />
        </View>
      ) : null}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexGrow: 1,
    alignSelf: 'stretch',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    paddingVertical: 48,
  },
  wrapCompact: {
    paddingVertical: 28,
  },
  circle: {
    width: EMPTY_STATE_CIRCLE,
    height: EMPTY_STATE_CIRCLE,
    borderRadius: EMPTY_STATE_CIRCLE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: APP_LAYOUT.componentGap + 4,
  },
  title: {
    ...APP_TYPE.sectionTitle,
    textAlign: 'center',
    alignSelf: 'stretch',
  },
  subtitle: {
    ...APP_TYPE.body,
    marginTop: APP_LAYOUT.cardTitleToBodyGap,
    textAlign: 'center',
    alignSelf: 'stretch',
    maxWidth: 320,
    marginHorizontal: 'auto',
  },
  action: {
    marginTop: APP_LAYOUT.componentGap + 4,
  },
});

export default EmptyState;
