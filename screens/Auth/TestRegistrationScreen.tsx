import i18n from '../../lib/i18n';
import { legacyAlert } from '../../utils/appDialog';
import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import { AuthService } from '../../services/authService';
import { DesignTokens } from '../../components/ui/DesignTokens';
import { HapticFeedback } from '../../utils/hapticFeedback';

const TestRegistrationScreen = () => {
  const [loading, setLoading] = useState(false);

  const testEmailCheck = async () => {
    setLoading(true);
    const { exists, error } = await AuthService.checkEmailExists('test@example.com');
    setLoading(false);
    legacyAlert(i18n.t('auto.screens__Auth__TestRegistrationScreen.s1'), i18n.t('auto.screens__Auth__TestRegistrationScreen.s2', { v0: exists, v1: error || 'אין' }));
  };

  const testPhoneCheck = async () => {
    setLoading(true);
    const { exists, error } = await AuthService.checkPhoneExists('0501234567');
    setLoading(false);
    legacyAlert(i18n.t('auto.screens__Auth__TestRegistrationScreen.s3'), i18n.t('auto.screens__Auth__TestRegistrationScreen.s2', { v0: exists, v1: error || 'אין' }));
  };

  const testCompleteRegistration = async () => {
    setLoading(true);
    const { success, error } = await AuthService.completeRegistration({
      full_name: i18n.t('auto.screens__Auth__TestRegistrationScreen.s4'),
      phone: '0501234567',
      track_id: '1',
      intro_data: {
        age_range: '25_34',
        experience_level: 'beginner',
        trading_focus: 'swing',
        trading_platform: ['colmex'],
        portfolio_size: 'under_10k',
      }
    });
    setLoading(false);
    legacyAlert(i18n.t('auto.screens__Auth__TestRegistrationScreen.s5'), i18n.t('auto.screens__Auth__TestRegistrationScreen.s6', { v0: success, v1: error || 'אין' }));
  };

  return (
    <View style={{ flex: 1, backgroundColor: 'transparent', padding: 24, justifyContent: 'center' }}>
      <Text style={{ color: '#fff', fontSize: 24, fontWeight: 'bold', textAlign: 'center', marginBottom: 32 }}>{i18n.t('auto.screens__Auth__TestRegistrationScreen.s7')}</Text>

      <TouchableOpacity
        onPress={() => {
          void HapticFeedback.impactLight();
          testEmailCheck();
        }}
        style={{ backgroundColor: DesignTokens.colors.primary.main, padding: 16, borderRadius: 12, marginBottom: 16 }}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color="#111" />
        ) : (
          <Text style={{ color: '#111', fontWeight: 'bold', textAlign: 'center' }}>{i18n.t('auto.screens__Auth__TestRegistrationScreen.s8')}</Text>
        )}
      </TouchableOpacity>

      <TouchableOpacity
        onPress={() => {
          void HapticFeedback.impactLight();
          testPhoneCheck();
        }}
        style={{ backgroundColor: DesignTokens.colors.primary.main, padding: 16, borderRadius: 12, marginBottom: 16 }}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color="#111" />
        ) : (
          <Text style={{ color: '#111', fontWeight: 'bold', textAlign: 'center' }}>{i18n.t('auto.screens__Auth__TestRegistrationScreen.s9')}</Text>
        )}
      </TouchableOpacity>

      <TouchableOpacity
        onPress={() => {
          void HapticFeedback.medium();
          testCompleteRegistration();
        }}
        style={{ backgroundColor: DesignTokens.colors.primary.main, padding: 16, borderRadius: 12, marginBottom: 16 }}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color="#111" />
        ) : (
          <Text style={{ color: '#111', fontWeight: 'bold', textAlign: 'center' }}>{i18n.t('auto.screens__Auth__TestRegistrationScreen.s10')}</Text>
        )}
      </TouchableOpacity>

      <Text style={{ color: '#888', fontSize: 14, textAlign: 'center', marginTop: 32 }}>{i18n.t('auto.screens__Auth__TestRegistrationScreen.s11')}</Text>
    </View>
  );
};

export default TestRegistrationScreen; 