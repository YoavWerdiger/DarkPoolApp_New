import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Alert, ActivityIndicator } from 'react-native';
import { AuthService } from '../../services/authService';

const TestRegistrationScreen = () => {
  const [loading, setLoading] = useState(false);

  const testEmailCheck = async () => {
    setLoading(true);
    const { exists, error } = await AuthService.checkEmailExists('test@example.com');
    setLoading(false);
    Alert.alert('בדיקת מייל', `קיים: ${exists}, שגיאה: ${error || 'אין'}`);
  };

  const testPhoneCheck = async () => {
    setLoading(true);
    const { exists, error } = await AuthService.checkPhoneExists('0501234567');
    setLoading(false);
    Alert.alert('בדיקת טלפון', `קיים: ${exists}, שגיאה: ${error || 'אין'}`);
  };

  const testCompleteRegistration = async () => {
    setLoading(true);
    const { success, error } = await AuthService.completeRegistration({
      full_name: 'משתמש בדיקה',
      phone: '0501234567',
      track_id: '1',
      intro_data: {
        markets: ['forex'],
        experience: 'beginner',
        styles: ['scalping'],
        brokers: ['meta4'],
        level: 'beginner',
        goal: 'income',
        communityGoals: ['learning'],
        hours: '2',
        socials: ['telegram'],
        heardFrom: 'חבר',
        wish: 'יותר חומרים'
      }
    });
    setLoading(false);
    Alert.alert('השלמת הרשמה', `הצלחה: ${success}, שגיאה: ${error || 'אין'}`);
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#111', padding: 24, justifyContent: 'center' }}>
      <Text style={{ color: '#fff', fontSize: 24, fontWeight: 'bold', textAlign: 'center', marginBottom: 32 }}>
        בדיקת פונקציות הרשמה
      </Text>

      <TouchableOpacity
        onPress={testEmailCheck}
        style={{ backgroundColor: '#00E654', padding: 16, borderRadius: 12, marginBottom: 16 }}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color="#111" />
        ) : (
          <Text style={{ color: '#111', fontWeight: 'bold', textAlign: 'center' }}>
            בדוק מייל קיים
          </Text>
        )}
      </TouchableOpacity>

      <TouchableOpacity
        onPress={testPhoneCheck}
        style={{ backgroundColor: '#00E654', padding: 16, borderRadius: 12, marginBottom: 16 }}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color="#111" />
        ) : (
          <Text style={{ color: '#111', fontWeight: 'bold', textAlign: 'center' }}>
            בדוק טלפון קיים
          </Text>
        )}
      </TouchableOpacity>

      <TouchableOpacity
        onPress={testCompleteRegistration}
        style={{ backgroundColor: '#00E654', padding: 16, borderRadius: 12, marginBottom: 16 }}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color="#111" />
        ) : (
          <Text style={{ color: '#111', fontWeight: 'bold', textAlign: 'center' }}>
            בדוק השלמת הרשמה
          </Text>
        )}
      </TouchableOpacity>

      <Text style={{ color: '#888', fontSize: 14, textAlign: 'center', marginTop: 32 }}>
        מסך זה לבדיקה בלבד - לא יופיע באפליקציה הסופית
      </Text>
    </View>
  );
};

export default TestRegistrationScreen; 