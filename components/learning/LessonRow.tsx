import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { LessonWithProgress, Enrollment, BlockType } from '../../types/learning';
import { DesignTokens } from '../ui/DesignTokens';

interface LessonRowProps {
  lesson: LessonWithProgress;
  onPress: (lesson: LessonWithProgress) => void;
  enrollment?: Enrollment;
  isLocked?: boolean;
}

export const LessonRow: React.FC<LessonRowProps> = ({
  lesson,
  onPress,
  enrollment,
  isLocked = false
}) => {
  const isEnrolled = !!enrollment;
  const hasAccess = isEnrolled || lesson.is_preview;
  const isLockedForUser = isLocked || (!hasAccess);

  const getStatusIcon = () => {
    if (isLockedForUser) {
      return '🔒';
    }
    
    switch (lesson.progress?.status) {
      case 'completed':
        return '✅';
      case 'in_progress':
        return '▶️';
      default:
        return '⭕';
    }
  };

  const getStatusText = () => {
    if (isLockedForUser) {
      return 'נעול';
    }
    
    switch (lesson.progress?.status) {
      case 'completed':
        return 'הושלם';
      case 'in_progress':
        return 'בתהליך';
      default:
        return 'לא התחיל';
    }
  };

  const getStatusColor = () => {
    if (isLockedForUser) {
      return DesignTokens.colors.textMuted;
    }
    
    switch (lesson.progress?.status) {
      case 'completed':
        return DesignTokens.colors.success;
      case 'in_progress':
        return DesignTokens.colors.primary;
      default:
        return DesignTokens.colors.textSecondary;
    }
  };

  const formatDuration = (seconds?: number) => {
    if (!seconds) return '';
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const getBlockTypeIcon = (blocks: any[]) => {
    if (!blocks || blocks.length === 0) return '📄';
    
    const types = blocks.map(block => block.type);
    if (types.includes('video')) return '🎥';
    if (types.includes('quiz')) return '❓';
    if (types.includes('pdf')) return '📄';
    return '📝';
  };

  return (
    <TouchableOpacity
      style={[
        styles.container,
        isLockedForUser && styles.lockedContainer
      ]}
      onPress={() => !isLockedForUser && onPress(lesson)}
      activeOpacity={isLockedForUser ? 1 : 0.7}
      disabled={isLockedForUser}
    >
      <View style={styles.content}>
        <View style={styles.leftContent}>
          <Text style={styles.icon}>
            {getBlockTypeIcon(lesson.blocks || [])}
          </Text>
        </View>

        <View style={styles.centerContent}>
          <Text 
            style={[
              styles.title,
              isLockedForUser && styles.lockedText
            ]}
            numberOfLines={2}
          >
            {lesson.title}
          </Text>
          
          <View style={styles.metaContainer}>
            {lesson.duration_seconds && (
              <Text style={styles.duration}>
                {formatDuration(lesson.duration_seconds)}
              </Text>
            )}
            
            {lesson.is_preview && (
              <View style={styles.previewBadge}>
                <Text style={styles.previewText}>תצוגה מקדימה</Text>
              </View>
            )}
          </View>
        </View>

        <View style={styles.rightContent}>
          <View style={styles.statusContainer}>
            <Text style={styles.statusIcon}>{getStatusIcon()}</Text>
            <Text 
              style={[
                styles.statusText,
                { color: getStatusColor() }
              ]}
            >
              {getStatusText()}
            </Text>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: DesignTokens.spacing.lg,
    borderBottomWidth: DesignTokens.layout.borderWidth.thin,
    borderBottomColor: DesignTokens.colors.border,
  },
  lockedContainer: {
    opacity: 0.6,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  leftContent: {
    marginRight: DesignTokens.spacing.md,
  },
  icon: {
    fontSize: DesignTokens.typography.fontSize.lg,
  },
  centerContent: {
    flex: 1,
    marginRight: DesignTokens.spacing.md,
  },
  title: {
    fontSize: DesignTokens.typography.fontSize.base,
    fontWeight: DesignTokens.typography.fontWeight.medium,
    color: DesignTokens.colors.textPrimary,
    marginBottom: DesignTokens.spacing.xs,
    textAlign: 'right',
  },
  lockedText: {
    color: DesignTokens.colors.textMuted,
  },
  metaContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: DesignTokens.spacing.sm,
  },
  duration: {
    fontSize: DesignTokens.typography.fontSize.xs,
    color: DesignTokens.colors.textSecondary,
  },
  previewBadge: {
    backgroundColor: DesignTokens.colors.info,
    paddingHorizontal: DesignTokens.spacing.xs,
    paddingVertical: 2,
    borderRadius: DesignTokens.borderRadius.sm,
  },
  previewText: {
    fontSize: DesignTokens.typography.fontSize.xs,
    color: '#FFFFFF',
    fontWeight: DesignTokens.typography.fontWeight.medium,
  },
  rightContent: {
    alignItems: 'center',
    minWidth: 60,
  },
  statusContainer: {
    alignItems: 'center',
  },
  statusIcon: {
    fontSize: DesignTokens.typography.fontSize.sm,
    marginBottom: DesignTokens.spacing.xs,
  },
  statusText: {
    fontSize: DesignTokens.typography.fontSize.xs,
    fontWeight: DesignTokens.typography.fontWeight.medium,
    textAlign: 'center',
  },
});

