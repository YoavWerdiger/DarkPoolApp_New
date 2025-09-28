import React from 'react';
import { View, Text } from 'react-native';

interface UnreadCounterProps {
  count: number;
  size?: 'small' | 'medium' | 'large';
}

const UnreadCounter: React.FC<UnreadCounterProps> = ({ 
  count, 
  size = 'medium' 
}) => {
  console.log('🎯 UnreadCounter: Rendering with count:', count, 'size:', size);
  
  if (count <= 0) {
    console.log('🎯 UnreadCounter: Count is 0 or negative, not rendering');
    return null;
  }

  // הגדרת גדלים
  const sizeConfig = {
    small: { width: 18, height: 18, fontSize: 10 },
    medium: { width: 22, height: 22, fontSize: 12 },
    large: { width: 28, height: 28, fontSize: 14 }
  };

  const config = sizeConfig[size];

  console.log('🎯 UnreadCounter: Rendered successfully with count:', count);
  
  return (
    <View 
      className="rounded-full items-center justify-center"
      style={{
        width: config.width,
        height: config.height,
        minWidth: config.width,
        minHeight: config.height,
        backgroundColor: '#00E654'
      }}
    >
      <Text 
        className="text-white font-bold text-center"
        style={{ fontSize: config.fontSize, color: '#181818' }}
        numberOfLines={1}
      >
        {count > 99 ? '99+' : count.toString()}
      </Text>
    </View>
  );
}

export default UnreadCounter;

