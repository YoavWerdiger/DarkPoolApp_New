import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { SafeAreaView as RNSafeAreaView } from 'react-native-safe-area-context';
import { AcademySubScreenBar } from '../../components/learning';
import {
  ACADEMY_TYPE,
  academyGroupLabelStyle,
} from '../../components/learning/academyLayout';
import {
  ORACLE_COURSE_SUBTITLE,
  getAcademyCourseAudience,
  isOracleCourse,
} from '../../components/learning/academyCourses';
import { APP_LAYOUT } from '../../components/ui/appLayout';
import { ScreenChrome } from '../../components/ui';
import UIButton from '../../components/ui/UIButton';
import UICard from '../../components/ui/UICard';
import { useDesignTokens } from '../../components/ui/DesignTokens';
import { useMainTabsHeight } from '../../hooks/useMainTabsHeight';
import { HapticFeedback } from '../../utils/hapticFeedback';

export type CourseComingSoonParams = {
  courseId: string;
  title?: string;
  subtitle?: string;
  coverUrl?: string;
};

type Fact = { label: string; value: string };

export const CourseComingSoonScreen: React.FC = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const params = (route.params || {}) as CourseComingSoonParams;
  const tokens = useDesignTokens();
  const styles = useMemo(() => createStyles(tokens), [tokens]);
  const bottomPad = useMainTabsHeight();

  const title = (params.title || 'האורקל').trim();
  const courseRef = {
    id: params.courseId,
    title,
    description: '',
  };
  const subtitle = (
    params.subtitle || (isOracleCourse(courseRef) ? ORACLE_COURSE_SUBTITLE : '')
  ).trim();
  const audience = getAcademyCourseAudience(courseRef);

  const facts: Fact[] = isOracleCourse(courseRef)
    ? [
        { label: 'סטטוס', value: 'בקרוב' },
        { label: 'רמה', value: 'מתקדם' },
      ]
    : [{ label: 'סטטוס', value: 'בקרוב' }];

  const handleBack = () => {
    void HapticFeedback.impactLight();
    navigation.goBack();
  };

  return (
    <ScreenChrome>
      <RNSafeAreaView style={styles.flex} edges={['top']}>
        <AcademySubScreenBar onBackPress={handleBack} title={title} subtitle={subtitle} />

        <View style={[styles.body, { paddingBottom: bottomPad }]}>
          <Text style={styles.groupLabel}>על הקורס</Text>
          <UICard variant="soft" padding="none" style={styles.card}>
            {facts.map((fact, index) => (
              <View key={fact.label}>
                <View style={styles.factRow}>
                  <Text style={styles.factValue}>{fact.value}</Text>
                  <Text style={styles.factLabel}>{fact.label}</Text>
                </View>
                {index < facts.length - 1 ? <View style={styles.divider} /> : null}
              </View>
            ))}
            {audience ? (
              <>
                <View style={styles.divider} />
                <Text style={styles.note}>{audience}</Text>
              </>
            ) : null}
          </UICard>

          <View style={styles.ctaWrap}>
            <UIButton
              title="חזרה לאקדמיה"
              variant="primary"
              fullWidth
              onPress={handleBack}
            />
          </View>
        </View>
      </RNSafeAreaView>
    </ScreenChrome>
  );
};

const createStyles = (tokens: ReturnType<typeof useDesignTokens>) =>
  StyleSheet.create({
    flex: {
      flex: 1,
    },
    body: {
      paddingHorizontal: APP_LAYOUT.screenPaddingHorizontal,
      paddingTop: APP_LAYOUT.sectionHeaderToContent,
    },
    groupLabel: {
      ...academyGroupLabelStyle,
      color: tokens.colors.text.secondary,
    },
    card: {
      borderWidth: 0,
    },
    factRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 15,
      paddingHorizontal: APP_LAYOUT.cardPadding,
      gap: APP_LAYOUT.cardStackGap,
    },
    factLabel: {
      ...ACADEMY_TYPE.cardSubtitle,
      color: tokens.colors.text.secondary,
      textAlign: 'right',
      writingDirection: 'rtl',
    },
    factValue: {
      ...ACADEMY_TYPE.body,
      color: tokens.colors.text.primary,
      textAlign: 'left',
      writingDirection: 'rtl',
      flexShrink: 1,
    },
    divider: {
      height: 1,
      backgroundColor: tokens.colors.border.divider,
      marginHorizontal: APP_LAYOUT.cardPadding,
    },
    note: {
      ...ACADEMY_TYPE.body,
      color: tokens.colors.text.secondary,
      textAlign: 'right',
      writingDirection: 'rtl',
      paddingHorizontal: APP_LAYOUT.cardPadding,
      paddingTop: APP_LAYOUT.cardTitleToBodyGap,
      paddingBottom: APP_LAYOUT.cardPadding,
    },
    ctaWrap: {
      marginTop: APP_LAYOUT.cardStackGap,
    },
  });
