import React from 'react';
import { View, Text, TouchableOpacity, Image } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { ArrowLeft } from 'lucide-react-native';

interface GradientHeaderProps {
  title?: string;
  subtitle?: string;
  onBack?: () => void;
  right?: React.ReactNode;
  showAvatar?: boolean;
  avatarUrl?: string | null;
  showOnlineBadge?: boolean;
}

export const GradientHeader: React.FC<GradientHeaderProps> = ({
  title,
  subtitle,
  onBack,
  right,
  showAvatar = false,
  avatarUrl = null,
  showOnlineBadge = false,
}) => {
  return (
    <LinearGradient
      colors={["#00E65420", "#00E65410", "transparent"]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={{
        paddingTop: 60,
        paddingBottom: 20,
        paddingHorizontal: 20,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(0, 230, 84, 0.2)'
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <TouchableOpacity onPress={onBack} style={{ padding: 8, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.1)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' }}>
          <ArrowLeft size={22} color="#FFFFFF" />
        </TouchableOpacity>

        <View style={{ flex: 1, alignItems: 'center' }}>
          {showAvatar && (
            <View style={{ width: 46, height: 46, marginBottom: 8 }}>
              <View style={{ width: 46, height: 46, borderRadius: 23, overflow: 'hidden', backgroundColor: '#2A2A2A', alignItems: 'center', justifyContent: 'center' }}>
                {avatarUrl ? (
                  <Image source={{ uri: avatarUrl }} style={{ width: '100%', height: '100%' }} />
                ) : (
                  <View style={{ width: '100%', height: '100%' }} />
                )}
              </View>
              {showOnlineBadge && (
                <View style={{ position: 'absolute', bottom: -2, right: -2, width: 14, height: 14, borderRadius: 7, backgroundColor: '#25D366', borderWidth: 2, borderColor: '#1A1A1A' }} />
              )}
            </View>
          )}
          {!!title && (
            <Text style={{ color: '#FFFFFF', fontSize: 22, fontWeight: '700', textAlign: 'center', writingDirection: 'rtl' }}>{title}</Text>
          )}
          {!!subtitle && (
            <Text style={{ color: '#B0B0B0', fontSize: 14, textAlign: 'center', marginTop: 4, writingDirection: 'rtl' }}>{subtitle}</Text>
          )}
        </View>

        <View style={{ width: 40, alignItems: 'flex-end' }}>
          {right}
        </View>
      </View>
    </LinearGradient>
  );
};

export default GradientHeader;


