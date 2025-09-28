import React, { useState } from 'react';
import { View, Text, TouchableOpacity, FlatList } from 'react-native';
import { useRegistration } from '../../context/RegistrationContext';
import { Ionicons } from '@expo/vector-icons';
import * as Animatable from 'react-native-animatable';

const tracks = [
  { id: '1', name: 'מסלול משקיעים מתחילים', icon: 'trending-up' },
  { id: '2', name: 'מסלול מסחר יומי', icon: 'flash' },
  { id: '3', name: 'מסלול ניתוח טכני', icon: 'bar-chart' },
];

const RegistrationTrackScreen = ({ navigation }: { navigation: any }) => {
  const { data, setData } = useRegistration();
  const [selectedTrack, setSelectedTrack] = useState(data.trackId || null);

  const handleNext = () => {
    if (!selectedTrack) return;
    setData({ ...data, trackId: selectedTrack });
    navigation.navigate('RegistrationPayment');
  };

  return (
    <View style={{ flex: 1, padding: 24, backgroundColor: '#111', direction: 'rtl' }}>
      <Animatable.Text animation="fadeInDown" duration={700} style={{ fontSize: 28, fontWeight: 'bold', color: '#fff', marginBottom: 16, textAlign: 'right' }}>
        בחר מסלול
      </Animatable.Text>
      <Animatable.Text animation="fadeInDown" delay={100} style={{ color: '#00E654', fontSize: 16, marginBottom: 32, textAlign: 'right' }}>
        בחר את המסלול המתאים ביותר עבורך
      </Animatable.Text>
      <Animatable.View animation="fadeInUp" delay={200} style={{ flex: 1 }}>
        <FlatList
          data={tracks}
          keyExtractor={item => item.id}
          renderItem={({ item }) => (
            <TouchableOpacity
              onPress={() => setSelectedTrack(item.id)}
              activeOpacity={0.8}
              style={{
                flexDirection: 'row-reverse',
                alignItems: 'center',
                padding: 18,
                borderRadius: 14,
                backgroundColor: selectedTrack === item.id ? '#00E654' : '#181818',
                marginBottom: 16,
                borderWidth: selectedTrack === item.id ? 2 : 1,
                borderColor: selectedTrack === item.id ? '#00E654' : '#222',
                shadowColor: selectedTrack === item.id ? '#00E654' : '#000',
                shadowOpacity: selectedTrack === item.id ? 0.2 : 0.1,
                shadowRadius: 8,
                shadowOffset: { width: 0, height: 4 },
              }}
            >
              <Ionicons name={item.icon as any} size={28} color={selectedTrack === item.id ? '#111' : '#00E654'} style={{ marginLeft: 12 }} />
              <Text style={{ color: selectedTrack === item.id ? '#111' : '#fff', fontWeight: 'bold', fontSize: 18, textAlign: 'right', flex: 1 }}>{item.name}</Text>
              {selectedTrack === item.id && <Ionicons name="checkmark-circle-outline" size={24} color="#111" />}
            </TouchableOpacity>
          )}
        />
      </Animatable.View>
      <Animatable.View animation="fadeInUp" delay={300}>
        <TouchableOpacity
          onPress={handleNext}
          activeOpacity={0.8}
          style={{ backgroundColor: selectedTrack ? '#00E654' : '#333', paddingVertical: 16, borderRadius: 12, marginTop: 12, shadowColor: '#00E654', shadowOpacity: selectedTrack ? 0.3 : 0, shadowRadius: 8, shadowOffset: { width: 0, height: 4 } }}
          disabled={!selectedTrack}
        >
          <Animatable.Text animation="pulse" iterationCount="infinite" style={{ color: selectedTrack ? '#111' : '#888', fontWeight: 'bold', fontSize: 18, textAlign: 'center' }}>
            המשך
          </Animatable.Text>
        </TouchableOpacity>
      </Animatable.View>
    </View>
  );
};

export default RegistrationTrackScreen; 