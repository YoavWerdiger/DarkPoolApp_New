import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Menu, MenuProvider, MenuOptions, MenuOption, MenuTrigger } from 'react-native-popup-menu';
import { DesignTokens } from '../ui/DesignTokens';
import { Ionicons } from '@expo/vector-icons';

interface MessageContextMenuProps {
  visible: boolean;
  onClose: () => void;
  onReply?: () => void;
  onForward?: () => void;
  onCopy?: () => void;
  onEdit?: () => void;
  onReact?: () => void;
  onStar?: () => void;
  onUnstar?: () => void;
  onDelete?: () => void;
  canEdit?: boolean;
  isStarred?: boolean;
  messagePosition?: { x: number; y: number; width: number; height: number };
}

export default function MessageContextMenu({
  visible,
  onClose,
  onReply,
  onForward,
  onCopy,
  onEdit,
  onReact,
  onStar,
  onUnstar,
  onDelete,
  canEdit = false,
  isStarred = false,
  messagePosition
}: MessageContextMenuProps) {
  if (!visible) return null;

  const menuItems = [
    {
      id: 'reply',
      title: 'השב',
      icon: 'arrow-undo' as const,
      onPress: onReply,
      color: '#ffffff'
    },
    {
      id: 'forward',
      title: 'העבר',
      icon: 'arrow-forward' as const,
      onPress: onForward,
      color: '#ffffff'
    },
    {
      id: 'copy',
      title: 'העתק',
      icon: 'copy' as const,
      onPress: onCopy,
      color: '#ffffff'
    },
    ...(canEdit ? [{
      id: 'edit',
      title: 'ערוך',
      icon: 'create' as const,
      onPress: onEdit,
      color: '#4ade80'
    }] : []),
    {
      id: 'react',
      title: 'ריאקציה',
      icon: 'happy' as const,
      onPress: onReact,
      color: '#ffffff'
    },
    {
      id: 'star',
      title: isStarred ? 'הסר כוכב' : 'סמן בכוכב',
      icon: isStarred ? 'star' : 'star-outline' as const,
      onPress: isStarred ? onUnstar : onStar,
      color: isStarred ? '#fbbf24' : '#ffffff'
    },
    {
      id: 'delete',
      title: 'מחק',
      icon: 'trash' as const,
      onPress: onDelete,
      color: '#ef4444'
    }
  ].filter(item => item.onPress);

  const renderMenuItems = () => {
    return menuItems.map((item, index) => (
      <MenuOption
        key={item.id}
        onSelect={() => {
          item.onPress?.();
          onClose();
        }}
        customStyles={{
          optionWrapper: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingHorizontal: 16,
            paddingVertical: 14,
            borderBottomWidth: index < menuItems.length - 1 ? 0.5 : 0,
            borderBottomColor: '#333333',
            minHeight: 48,
            backgroundColor: 'transparent',
          },
        }}
      >
        <Text style={[styles.menuItemText, { color: item.color }]}>
          {item.title}
        </Text>
        <Ionicons name={item.icon} size={20} color={item.color} />
      </MenuOption>
    ));
  };

  return (
    <MenuProvider style={styles.container} skipInstanceCheck>
      <Menu>
        <MenuTrigger
          customStyles={{
            triggerWrapper: {
              position: 'absolute',
              top: (messagePosition?.y || 0) - 100, // מעל הבועה
              left: (messagePosition?.x || 0) + (messagePosition?.width || 0) - 200, // ימין
              width: 200,
              height: 100,
              backgroundColor: 'transparent',
            },
          }}
        >
          <View style={styles.invisibleTrigger} />
        </MenuTrigger>
        <MenuOptions
          customStyles={{
            optionsContainer: {
              backgroundColor: '#1a1a1a', // רקע כהה
              borderRadius: 12,
              paddingVertical: 8,
              shadowColor: '#000',
              shadowOffset: {
                width: 0,
                height: 4,
              },
              shadowOpacity: 0.3,
              shadowRadius: 8,
              elevation: 8,
              minWidth: 200,
              maxWidth: 250,
              borderWidth: 1,
              borderColor: '#333333',
            },
          }}
        >
          {renderMenuItems()}
        </MenuOptions>
      </Menu>
    </MenuProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 1000,
  },
  invisibleTrigger: {
    width: '100%',
    height: '100%',
    backgroundColor: 'transparent',
  },
  menuItemText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#ffffff',
    flex: 1,
    textAlign: 'right',
  },
});