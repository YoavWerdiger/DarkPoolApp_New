import React from 'react';
import { View, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import UIButton from '../../../components/ui/UIButton';
import { useDesignTokens } from '../../../components/ui/DesignTokens';
import {
  journalCaption2Style,
  journalPhysicalRightText,
} from '../../Journal/journalLayout';
import { Text } from 'react-native';
import { PORTFOLIO_FORM } from '../portfolioFormLayout';

type Props = {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  icon?: React.ComponentProps<typeof UIButton>['icon'];
  note?: string | null;
  style?: StyleProp<ViewStyle>;
};

export function PortfolioFormFooter({
  title,
  onPress,
  disabled,
  loading,
  icon,
  note,
  style,
}: Props) {
  const tokens = useDesignTokens();
  const insets = useSafeAreaInsets();

  return (
    <View
      style={[
        styles.footer,
        {
          paddingBottom: Math.max(insets.bottom, 12),
          // בצבע הקנבס, בלי פס/מפריד — הכפתור «צף» על המסך כמו בשאר ה-flows
          backgroundColor: tokens.colors.background.primary,
        },
        style,
      ]}
    >
      <UIButton
        title={title}
        variant="primary"
        size="lg"
        fullWidth
        icon={icon}
        disabled={disabled}
        loading={loading}
        onPress={onPress}
      />
      {note ? (
        <Text
          style={[
            journalCaption2Style,
            journalPhysicalRightText,
            styles.note,
            { color: tokens.colors.text.danger },
          ]}
        >
          {note}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  footer: {
    paddingHorizontal: PORTFOLIO_FORM.screenPadH,
    paddingTop: 12,
    gap: 8,
  },
  note: {
    textAlign: 'center',
    alignSelf: 'stretch',
  },
});
