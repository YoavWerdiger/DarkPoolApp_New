import i18n from '../../lib/i18n';
import React from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { Eye, EyeOff } from 'lucide-react-native';
import { useDesignTokens } from './DesignTokens';
import { HapticFeedback } from '../../utils/hapticFeedback';

type PasswordVisibilityToggleProps = {
  /** true כשהסיסמה גלויה */
  visible: boolean;
  onToggle: () => void;
};

/** עין בצד שמאל של מעטפת שדה סיסמה. Eye = מוסתר, EyeOff = גלוי. */
export function PasswordVisibilityToggle({ visible, onToggle }: PasswordVisibilityToggleProps) {
  const tokens = useDesignTokens();
  const Icon = visible ? EyeOff : Eye;

  return (
    <Pressable
      onPress={() => {
        void HapticFeedback.selection();
        onToggle();
      }}
      hitSlop={10}
      accessibilityRole="button"
      accessibilityLabel={visible ? i18n.t('auto.components__ui__PasswordVisibilityToggle.s1') : i18n.t('auto.components__ui__PasswordVisibilityToggle.s2')}
      style={styles.hit}
    >
      <Icon size={20} color={tokens.colors.text.secondary} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  hit: {
    marginRight: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
