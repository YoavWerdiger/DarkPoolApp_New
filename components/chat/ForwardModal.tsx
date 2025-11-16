import { useDesignTokens } from "../ui/DesignTokens";
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  Image,
  StyleSheet,
  Alert
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '../../lib/supabase';
import UIBottomSheet from '../ui/UIBottomSheet';

interface ForwardModalProps {
  visible: boolean;
  onClose: () => void;
  onForward: (channelId: string, channelName: string) => void;
  messageId: string;
}

const ForwardModal: React.FC<ForwardModalProps> = ({
  visible,
  onClose,
  onForward,
  messageId,
}) => {
  const [channels, setChannels] = useState<Array<{
    id: string;
    name: string;
    image_url?: string;
    members_count: number;
  }>>([]);
  const [selectedChannels, setSelectedChannels] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [forwarding, setForwarding] = useState(false);

  useEffect(() => {
    console.log('📤 ForwardModal visible changed to:', visible);
    if (visible) {
      console.log('📤 ForwardModal opening...');
      loadChannels();
      setSelectedChannels([]); // נקה בחירות קודמות
    }
  }, [visible]);

  const loadChannels = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('channels')
        .select('id, name, image_url, members_count')
        .eq('is_public', true)
        .order('name');

      if (error) {
        console.error('Error loading channels:', error);
        Alert.alert('שגיאה', 'לא ניתן לטעון את רשימת הערוצים');
        return;
      }

      if (data) {
        setChannels(data);
      }
    } catch (error) {
      console.error('Error loading channels:', error);
      Alert.alert('שגיאה', 'לא ניתן לטעון את רשימת הערוצים');
    } finally {
      setLoading(false);
    }
  };

  const toggleChannelSelection = (channelId: string) => {
    setSelectedChannels(prev => {
      if (prev.includes(channelId)) {
        return prev.filter(id => id !== channelId);
      } else {
        return [...prev, channelId];
      }
    });
  };

  const handleForwardToSelected = async () => {
    if (selectedChannels.length === 0) {
      Alert.alert('שגיאה', 'אנא בחר לפחות ערוץ אחד');
      return;
    }

    setForwarding(true);
    try {
      // העברה לכל הערוצים שנבחרו
      for (const channelId of selectedChannels) {
        const channel = channels.find(c => c.id === channelId);
        if (channel) {
          console.log('🔄 Forwarding to channel:', channel.name);
          await onForward(channelId, channel.name);
        }
      }
      
      Alert.alert('הצלחה', `הודעה הועברה ל-${selectedChannels.length} ערוצים`);
      setSelectedChannels([]);
      onClose();
    } catch (error) {
      console.error('Error forwarding message:', error);
      Alert.alert('שגיאה', 'לא ניתן להעביר את הההודעה');
    } finally {
      setForwarding(false);
    }
  };

  return (
    <UIBottomSheet
      visible={visible}
      onClose={onClose}
      maxHeight="75%"
      dragToClose={true}
      contentStyle={{ padding: 0 }}
    >
      <View style={{ position: 'relative', height: '100%' }}>
        {/* Gradient overlay - green→dark theme */}
        <LinearGradient
          colors={['rgba(0, 230, 84, 0.12)', 'transparent', 'rgba(0, 230, 84, 0.10)']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: -1 }}
        />
        
        <View style={styles.header}>
          <Text style={styles.title}>העבר ל...</Text>
          {selectedChannels.length > 0 && (
            <Text style={styles.selectedCount}>{selectedChannels.length} נבחרו</Text>
          )}
        </View>
          
          {loading ? (
            <View style={styles.loadingContainer}>
              <Text style={styles.loadingText}>טוען ערוצים...</Text>
            </View>
          ) : (
            <>
              <FlatList
                data={channels}
                keyExtractor={(item) => item.id}
                style={styles.list}
                contentContainerStyle={styles.listContent}
                showsVerticalScrollIndicator={false}
                renderItem={({ item }) => {
                  const isSelected = selectedChannels.includes(item.id);
                  return (
                    <TouchableOpacity
                      style={[styles.channelItem, isSelected && styles.selectedChannelItem]}
                      onPress={() => toggleChannelSelection(item.id)}
                    >
                      <Image
                        source={
                          item.image_url
                            ? { uri: item.image_url }
                            : require('../../assets/icon.png')
                        }
                        style={styles.channelImage}
                      />
                      <View style={styles.channelInfo}>
                        <Text style={styles.channelName}>{item.name}</Text>
                      </View>
                      <View style={[styles.checkbox, isSelected && styles.checkedBox]}>
                        {isSelected && <Text style={styles.checkmark}>✓</Text>}
                      </View>
                    </TouchableOpacity>
                  );
                }}
                ListEmptyComponent={
                  <View style={styles.emptyContainer}>
                    <Text style={styles.emptyText}>לא נמצאו ערוצים</Text>
                  </View>
                }
              />
              
              {selectedChannels.length > 0 && (
                <View style={styles.bottomBar}>
                  <TouchableOpacity 
                    style={styles.forwardButton}
                    onPress={() => {
                      console.log('🔘 Forward button pressed, selected channels:', selectedChannels);
                      handleForwardToSelected();
                    }}
                    disabled={forwarding}
                  >
                    <Text style={styles.forwardButtonText}>
                      {forwarding ? 'שולח...' : `שלח ל-${selectedChannels.length}`}
                    </Text>
                  </TouchableOpacity>
                </View>
              )}
            </>
          )}
      </View>
    </UIBottomSheet>
  );
};

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  selectedCount: {
    fontSize: 14,
    color: '#00E654',
    fontWeight: '500',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  loadingText: {
    color: '#fff',
    fontSize: 16,
  },
  list: {
    flex: 1,
  },
  listContent: {
    paddingBottom: 20,
  },
  channelItem: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: 'transparent',
  },
  selectedChannelItem: {
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  channelImage: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginLeft: 15,
    borderWidth: 1,
    borderColor: '#2A2A2A',
  },
  channelInfo: {
    flex: 1,
  },
  channelName: {
    fontSize: 16,
    fontWeight: '400',
    color: '#FFFFFF',
    textAlign: 'right',
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#9AA0A6',
    backgroundColor: 'transparent',
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkedBox: {
    backgroundColor: '#00E654',
    borderColor: '#00E654',
  },
  checkmark: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  bottomBar: {
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.08)',
  },
  forwardButton: {
    backgroundColor: '#00E654',
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: 14,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 2,
  },
  forwardButtonText: {
    color: '#000000',
    fontSize: 16,
    fontWeight: '600',
  },
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    color: '#B0B0B0',
    fontSize: 16,
    textAlign: 'center',
  },
});

export default ForwardModal;
