import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  Image,
  StyleSheet,
  Dimensions,
  Alert,
  Modal,
  Animated,
  Pressable,
  PanResponder
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '../../lib/supabase';

interface ForwardModalProps {
  visible: boolean;
  onClose: () => void;
  onForward: (channelId: string, channelName: string) => void;
  messageId: string;
}

const { width, height } = Dimensions.get('window');

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
  const slideAnim = useRef(new Animated.Value(height)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const panY = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    console.log('📤 ForwardModal visible changed to:', visible);
    if (visible) {
      console.log('📤 ForwardModal opening...');
      loadChannels();
      setSelectedChannels([]); // נקה בחירות קודמות
      // אנימציה להצגה
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      // אנימציה להסתרה
      panY.setValue(0); // איפוס הגרירה
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: height,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible]);

  // PanResponder לגרירה - רק על ההנדל
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (evt, gestureState) => {
        // התחל גרירה אם מושכים למטה יותר מ-5 פיקסלים
        return Math.abs(gestureState.dy) > 5;
      },
      onPanResponderGrant: () => {
        // התחלת גרירה
        panY.setOffset(panY._value);
        panY.setValue(0);
      },
      onPanResponderMove: (evt, gestureState) => {
        // גרירה בכל כיוון אבל רק כלפי מטה באמת זז
        if (gestureState.dy >= 0) {
          panY.setValue(gestureState.dy);
        }
      },
      onPanResponderRelease: (evt, gestureState) => {
        panY.flattenOffset();
        if (gestureState.dy > 120) {
          // סגירה אם גוררים יותר מ-120px למטה
          onClose();
        } else {
          // חזרה למקום
          Animated.spring(panY, {
            toValue: 0,
            useNativeDriver: false,
            tension: 100,
            friction: 8,
          }).start();
        }
      },
    })
  ).current;

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
    <Modal
      visible={visible}
      transparent={true}
      animationType="none"
      onRequestClose={onClose}
    >
      <Animated.View style={[styles.overlay, { opacity: fadeAnim }]}>
        <Pressable style={styles.backdrop} onPress={onClose} />
        <Animated.View 
          style={[
            styles.container,
            {
              transform: [
                { translateY: slideAnim },
                { translateY: panY }
              ]
            }
          ]}
        >
          {/* Gradient overlay - green→dark theme */}
          <LinearGradient
            colors={['rgba(0, 230, 84, 0.12)', 'transparent', 'rgba(0, 230, 84, 0.10)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
          />
          {/* Drag handle removed per new design */}
          
          <View style={styles.header}>
            <Text style={styles.title}>Forward to...</Text>
            {selectedChannels.length > 0 && (
              <Text style={styles.selectedCount}>{selectedChannels.length} selected</Text>
            )}
          </View>
          
          {loading ? (
            <View style={styles.loadingContainer}>
              <Text style={styles.loadingText}>Loading...</Text>
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
                    <Text style={styles.emptyText}>No channels found</Text>
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
                      {forwarding ? 'Sending...' : `Send to ${selectedChannels.length}`}
                    </Text>
                  </TouchableOpacity>
                </View>
              )}
            </>
          )}
        </Animated.View>
      </Animated.View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    zIndex: 9999, // גבוה מאוד כדי להיות מעל MediaViewer
  },
  backdrop: {
    flex: 1,
  },
  container: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#1A1A1A',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: height * 0.75,
    minHeight: height * 0.5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -6 },
    shadowOpacity: 0.15,
    zIndex: 10000, // עוד יותר גבוה
    shadowRadius: 10,
    elevation: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.08)',
  },
  handleContainer: {
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 40,
  },
  handle: {
    width: 48,
    height: 4,
    backgroundColor: '#666',
    borderRadius: 2,
    marginBottom: 8,
  },
  dragHint: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  dragHintDot: {
    width: 4,
    height: 4,
    backgroundColor: '#8A8A8A',
    borderRadius: 2,
    marginHorizontal: 2,
  },
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
