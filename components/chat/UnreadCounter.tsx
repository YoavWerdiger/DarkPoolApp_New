import React from 'react';
import { View, Text } from 'react-native';
import { useDesignTokens } from '../ui/DesignTokens';

interface UnreadCounterProps {
  count: number;
  size?: 'small' | 'medium' | 'large';
}

const UnreadCounter: React.FC<UnreadCounterProps> = ({
  count,
  size = 'medium'
}) => {
  const DesignTokens = useDesignTokens();

  if (count <= 0) {
    return null;
  }

  const sizeConfig = {
    small: { width: 18, height: 18, fontSize: 10 },
    medium: { width: 22, height: 22, fontSize: 12 },
    large: { width: 28, height: 28, fontSize: 14 }
  };

  const config = sizeConfig[size];

  return (
    <View
      style={{
        width: config.width,
        height: config.height,
        minWidth: config.width,
        minHeight: config.height,
        borderRadius: config.width / 2,
        backgroundColor: DesignTokens.colors.primary.main,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text
        style={{ fontSize: config.fontSize, color: '#fff', fontWeight: 'bold', textAlign: 'center' }}
        numberOfLines={1}
      >
        {count > 99 ? '99+' : count.toString()}
      </Text>
    </View>
  );
};

export default UnreadCounter;
