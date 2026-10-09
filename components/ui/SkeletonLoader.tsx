/**
 * SkeletonLoader - ספריית skeleton placeholders לכל סוגי התוכן
 * משמש להצגת מבנה התוכן במהלך טעינה במקום spinners
 */

import React, { useEffect } from 'react';
import { View, Animated, StyleSheet, ViewStyle } from 'react-native';
import { useDesignTokens } from './DesignTokens';
import UICard from './UICard';

/**
 * Yoga בשורש LTR (App.tsx) גם כש-forceRTL פעיל.
 * הסקלטונים האלה חייבים `row` כמו הכרטיס האמיתי — לא row-reverse
 * (ListItemSkeleton של רשימת מניות נשאר נפרד).
 */
export const EARNINGS_REPORT_SKELETON_LAYOUT = {
  rowDirection: 'row' as const,
  accentBar: 'left' as const,
  logoOnStart: true,
  revenueBeforeEps: true,
};

export const ECONOMIC_EVENT_SKELETON_LAYOUT = {
  rowDirection: 'row' as const,
  accentBar: 'right' as const,
  titleBeforeTimeBadge: true,
  metricsRowDirection: 'row' as const,
};

/** לולאה אחת לכל המסך — לא N שימרים עם delay מדורג. */
const SHARED_PULSE = new Animated.Value(0.3);
let sharedPulseLoop: Animated.CompositeAnimation | null = null;
let sharedPulseRetain = 0;

function retainSharedSkeletonPulse(): Animated.Value {
  if (sharedPulseRetain === 0) {
    sharedPulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(SHARED_PULSE, {
          toValue: 0.65,
          duration: 900,
          useNativeDriver: true,
        }),
        Animated.timing(SHARED_PULSE, {
          toValue: 0.3,
          duration: 900,
          useNativeDriver: true,
        }),
      ]),
    );
    sharedPulseLoop.start();
  }
  sharedPulseRetain += 1;
  return SHARED_PULSE;
}

function releaseSharedSkeletonPulse(): void {
  sharedPulseRetain = Math.max(0, sharedPulseRetain - 1);
  if (sharedPulseRetain === 0) {
    sharedPulseLoop?.stop();
    sharedPulseLoop = null;
    SHARED_PULSE.setValue(0.3);
  }
}

interface SkeletonBoxProps {
  width?: number | string;
  height?: number;
  borderRadius?: number;
  style?: ViewStyle;
  /** נשמר לתאימות API — לא מדורג יותר (גורם לעשרות לולאות מקבילות). */
  delay?: number;
}

/**
 * קופסת Skeleton בסיסית עם אנימציה
 */
export const SkeletonBox: React.FC<SkeletonBoxProps> = ({
  width = '100%',
  height = 20,
  borderRadius = 8,
  style,
}) => {
  useEffect(() => {
    retainSharedSkeletonPulse();
    return () => {
      releaseSharedSkeletonPulse();
    };
  }, []);

  return (
    <Animated.View
      style={[
        {
          width,
          height,
          borderRadius,
          backgroundColor: 'rgba(255, 255, 255, 0.12)',
          opacity: SHARED_PULSE,
        },
        style,
      ]}
    />
  );
};

/**
 * Skeleton לכרטיס פיד (DarkPool, Community)
 */
interface CardSkeletonProps {
  delay?: number;
}

export const CardSkeleton: React.FC<CardSkeletonProps> = ({ delay = 0 }) => {
  const tokens = useDesignTokens();

  return (
    <UICard
      variant="glass"
      glassIntensity="light"
      padding="none"
      disableBlur
      style={{
        borderRadius: tokens.borderRadius['2xl'],
        backgroundColor: 'transparent',
        marginBottom: 8,
        ...tokens.shadows.none,
      }}
    >
    <View
      style={{
        padding: tokens.spacing.base,
        gap: tokens.spacing.md,
        // direction:'rtl' כבר מתחיל מימין — row / flex-start (row-reverse + flex-end היפכו בחזרה לשמאל)
        direction: 'rtl',
      }}
    >
      {/* Header row */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <SkeletonBox width={44} height={44} borderRadius={22} delay={delay} />
        <View style={{ flex: 1, gap: 6, alignItems: 'flex-start' }}>
          <SkeletonBox width="60%" height={16} delay={delay + 50} />
          <SkeletonBox width="40%" height={12} delay={delay + 100} />
        </View>
      </View>

      {/* Content */}
      <View style={{ gap: 8, alignItems: 'flex-start' }}>
        <SkeletonBox width="100%" height={14} delay={delay + 150} />
        <SkeletonBox width="85%" height={14} delay={delay + 200} />
        <SkeletonBox width="70%" height={14} delay={delay + 250} />
      </View>

      {/* Footer */}
      <View style={{ flexDirection: 'row', gap: 12 }}>
        <SkeletonBox width={60} height={12} delay={delay + 300} />
        <SkeletonBox width={80} height={12} delay={delay + 350} />
      </View>
    </View>
    </UICard>
  );
};

/**
 * שורת רשימה בעברית: אווטאר מימין, קווי טקסט לידו (יישור ימין), מספר משמאל.
 *
 * עץ Dark Pool הוא RTL (`direction: 'rtl'` + `row`, לא `row-reverse`).
 * `rtl` + `row-reverse` = היפוך כפול (אווטאר משמאל). `flex-end` בעץ RTL
 * דוחף את קווי הטקסט לשמאל — לכן `flex-start` (= ימין פיזי ב-RTL).
 */
export const listItemSkeletonRowStyle: ViewStyle = {
  flexDirection: 'row',
  alignItems: 'center',
  paddingHorizontal: 16,
  paddingVertical: 10,
  gap: 12,
  direction: 'rtl',
};

export const listItemSkeletonTextStyle: ViewStyle = {
  flex: 1,
  gap: 8,
  alignItems: 'flex-start',
};

/**
 * Skeleton לפריט ברשימה
 */
interface ListItemSkeletonProps {
  delay?: number;
  showAvatar?: boolean;
}

export const ListItemSkeleton: React.FC<ListItemSkeletonProps> = ({
  delay = 0,
  showAvatar = true,
}) => {
  return (
    <View style={listItemSkeletonRowStyle}>
      {showAvatar && <SkeletonBox width={50} height={50} borderRadius={25} delay={delay} />}
      <View style={listItemSkeletonTextStyle}>
        <SkeletonBox width="60%" height={13} delay={delay + 50} />
        <SkeletonBox width="80%" height={11} delay={delay + 100} />
      </View>
      <SkeletonBox width={36} height={11} delay={delay + 150} />
    </View>
  );
};

/**
 * Skeleton לפרופיל משתמש
 */
interface ProfileSkeletonProps {
  delay?: number;
}

export const ProfileSkeleton: React.FC<ProfileSkeletonProps> = ({ delay = 0 }) => {
  const tokens = useDesignTokens();

  return (
    <View style={{ padding: tokens.spacing.lg, gap: tokens.spacing.lg, direction: 'rtl' }}>
      {/* Avatar + Name */}
      <View style={{ alignItems: 'center', gap: 12 }}>
        <SkeletonBox width={88} height={88} borderRadius={44} delay={delay} />
        <SkeletonBox width={150} height={20} delay={delay + 50} />
        <SkeletonBox width={120} height={14} delay={delay + 100} />
      </View>

      {/* Stats */}
      <View
        style={{
          flexDirection: 'row-reverse',
          justifyContent: 'space-around',
          gap: tokens.spacing.md,
        }}
      >
        {[0, 1, 2].map((i) => (
          <View key={i} style={{ alignItems: 'center', gap: 6 }}>
            <SkeletonBox width={60} height={16} delay={delay + 150 + i * 50} />
            <SkeletonBox width={40} height={12} delay={delay + 200 + i * 50} />
          </View>
        ))}
      </View>

      {/* Bio */}
      <View style={{ gap: 8, alignItems: 'flex-end' }}>
        <SkeletonBox width="100%" height={14} delay={delay + 350} />
        <SkeletonBox width="90%" height={14} delay={delay + 400} />
        <SkeletonBox width="60%" height={14} delay={delay + 450} />
      </View>
    </View>
  );
};

/**
 * Skeleton לגרף
 */
interface ChartSkeletonProps {
  delay?: number;
  height?: number;
}

export const ChartSkeleton: React.FC<ChartSkeletonProps> = ({ delay = 0, height = 200 }) => {
  const tokens = useDesignTokens();

  return (
    <View
      style={{
        height,
        padding: tokens.spacing.base,
        gap: tokens.spacing.sm,
        direction: 'rtl',
      }}
    >
      {/* Title */}
      <View style={{ alignItems: 'flex-end' }}>
        <SkeletonBox width="40%" height={16} delay={delay} />
      </View>

      {/* Chart area */}
      <View style={{ flex: 1, justifyContent: 'flex-end', gap: 8 }}>
        {[0.8, 0.6, 0.9, 0.4, 0.7, 0.5].map((heightRatio, i) => (
          <View key={i} style={{ flexDirection: 'row-reverse', alignItems: 'flex-end', gap: 4 }}>
            <SkeletonBox
              width="100%"
              height={Math.round((height - 60) * heightRatio)}
              borderRadius={4}
              delay={delay + i * 50}
            />
          </View>
        ))}
      </View>

      {/* X-axis labels */}
      <View style={{ flexDirection: 'row-reverse', justifyContent: 'space-between' }}>
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <SkeletonBox key={i} width={30} height={10} delay={delay + 300 + i * 30} />
        ))}
      </View>
    </View>
  );
};

/**
 * Skeleton להודעת צ'אט
 */
interface MessageSkeletonProps {
  delay?: number;
  isMe?: boolean;
}

export const MessageSkeleton: React.FC<MessageSkeletonProps> = ({ delay = 0, isMe = false }) => {
  const tokens = useDesignTokens();

  return (
    <View
      style={{
        flexDirection: isMe ? 'row' : 'row-reverse',
        alignItems: 'flex-end',
        paddingHorizontal: 16,
        paddingVertical: 6,
        gap: 8,
      }}
    >
      {!isMe && <SkeletonBox width={32} height={32} borderRadius={16} delay={delay} />}
      <View
        style={{
          maxWidth: '70%',
          backgroundColor: isMe
            ? 'rgba(0, 200, 5, 0.15)'
            : tokens.colors.background.secondary,
          borderRadius: 16,
          padding: 12,
          gap: 6,
        }}
      >
        {!isMe && <SkeletonBox width={80} height={11} delay={delay + 50} />}
        <SkeletonBox width="100%" height={13} delay={delay + 100} />
        <SkeletonBox width="80%" height={13} delay={delay + 150} />
      </View>
    </View>
  );
};

/**
 * Skeleton לכרטיס עסקה (Trade card)
 */
export const TradeCardSkeleton: React.FC<CardSkeletonProps> = ({ delay = 0 }) => {
  const tokens = useDesignTokens();

  return (
    <UICard
      variant="glass"
      glassIntensity="light"
      padding="none"
      disableBlur
      style={{
        borderRadius: tokens.borderRadius['2xl'],
        backgroundColor: 'transparent',
        marginBottom: 8,
        ...tokens.shadows.none,
      }}
    >
    <View
      style={{
        padding: tokens.spacing.base,
        gap: tokens.spacing.sm,
        direction: 'rtl',
      }}
    >
      {/* Header */}
      <View style={{ flexDirection: 'row-reverse', justifyContent: 'space-between' }}>
        <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 10 }}>
          <SkeletonBox width={36} height={36} borderRadius={18} delay={delay} />
          <View style={{ gap: 4, alignItems: 'flex-end' }}>
            <SkeletonBox width={100} height={14} delay={delay + 50} />
            <SkeletonBox width={70} height={11} delay={delay + 100} />
          </View>
        </View>
        <SkeletonBox width={60} height={12} delay={delay + 150} />
      </View>

      {/* Ticker + Amount */}
      <View style={{ flexDirection: 'row-reverse', justifyContent: 'space-between' }}>
        <SkeletonBox width={80} height={20} delay={delay + 200} />
        <SkeletonBox width={100} height={18} delay={delay + 250} />
      </View>

      {/* Details */}
      <View style={{ gap: 6, alignItems: 'flex-end' }}>
        <SkeletonBox width="100%" height={12} delay={delay + 300} />
        <SkeletonBox width="75%" height={12} delay={delay + 350} />
      </View>
    </View>
    </UICard>
  );
};

/**
 * Skeleton לטבלה
 */
interface TableSkeletonProps {
  rows?: number;
  delay?: number;
}

export const TableSkeleton: React.FC<TableSkeletonProps> = ({ rows = 5, delay = 0 }) => {
  const tokens = useDesignTokens();

  return (
    <View style={{ gap: 0 }}>
      {/* Header */}
      <View
        style={{
          flexDirection: 'row-reverse',
          paddingHorizontal: 16,
          paddingVertical: 12,
          gap: 12,
          borderBottomWidth: 1,
          borderBottomColor: tokens.colors.border.divider,
        }}
      >
        <SkeletonBox width="30%" height={12} delay={delay} />
        <SkeletonBox width="25%" height={12} delay={delay + 30} />
        <SkeletonBox width="20%" height={12} delay={delay + 60} />
        <SkeletonBox width="25%" height={12} delay={delay + 90} />
      </View>

      {/* Rows */}
      {Array.from({ length: rows }).map((_, i) => (
        <View
          key={i}
          style={{
            flexDirection: 'row-reverse',
            paddingHorizontal: 16,
            paddingVertical: 10,
            gap: 12,
            borderBottomWidth: i < rows - 1 ? 1 : 0,
            borderBottomColor: tokens.colors.border.divider,
          }}
        >
          <SkeletonBox width="30%" height={13} delay={delay + 120 + i * 50} />
          <SkeletonBox width="25%" height={13} delay={delay + 150 + i * 50} />
          <SkeletonBox width="20%" height={13} delay={delay + 180 + i * 50} />
          <SkeletonBox width="25%" height={13} delay={delay + 210 + i * 50} />
        </View>
      ))}
    </View>
  );
};

/**
 * Skeleton לגריד של פרופילים (DarkPool Explore)
 */
interface ProfileGridSkeletonProps {
  columns?: number;
  rows?: number;
  delay?: number;
}

export const ProfileGridSkeleton: React.FC<ProfileGridSkeletonProps> = ({
  columns = 2,
  rows = 3,
  delay = 0,
}) => {
  const tokens = useDesignTokens();

  return (
    <View style={{ gap: tokens.spacing.md }}>
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <View
          key={rowIndex}
          style={{
            flexDirection: 'row-reverse',
            gap: tokens.spacing.md,
          }}
        >
          {Array.from({ length: columns }).map((_, colIndex) => (
            <View
              key={colIndex}
              style={{
                flex: 1,
                backgroundColor: tokens.colors.background.card,
                borderRadius: tokens.borderRadius.lg,
                padding: tokens.spacing.base,
                gap: tokens.spacing.sm,
                alignItems: 'center',
              }}
            >
              <SkeletonBox
                width={60}
                height={60}
                borderRadius={30}
                delay={delay + (rowIndex * columns + colIndex) * 50}
              />
              <SkeletonBox
                width="80%"
                height={14}
                delay={delay + (rowIndex * columns + colIndex) * 50 + 50}
              />
              <SkeletonBox
                width="60%"
                height={11}
                delay={delay + (rowIndex * columns + colIndex) * 50 + 100}
              />
            </View>
          ))}
        </View>
      ))}
    </View>
  );
};

/**
 * Skeleton פשוט לטקסט
 */
interface TextSkeletonProps {
  lines?: number;
  delay?: number;
}

export const TextSkeleton: React.FC<TextSkeletonProps> = ({ lines = 3, delay = 0 }) => {
  return (
    <View style={{ gap: 8, alignItems: 'flex-end', direction: 'rtl' }}>
      {Array.from({ length: lines }).map((_, i) => (
        <SkeletonBox
          key={i}
          width={i === lines - 1 ? '70%' : '100%'}
          height={14}
          delay={delay + i * 50}
        />
      ))}
    </View>
  );
};

/**
 * Skeleton לכרטיס דיווח רווח — לוגו/טיקר בתחילת ה-row (שמאל פיזי),
 * badge בצד השני, Revenue ואז EPS. פס צבע משמאל. לא row-reverse.
 */
export const EarningsReportSkeleton: React.FC<CardSkeletonProps> = ({ delay = 0 }) => {
  const tokens = useDesignTokens();
  const screenPad = tokens.layout?.screenPadding ?? 20;
  const cardRadius = tokens.borderRadius['2xl'];
  const cardPad = tokens.layout?.cardPadding ?? tokens.spacing.xl;

  return (
    <View style={{ marginHorizontal: screenPad, marginBottom: 12 }}>
      <View
        style={{
          flexDirection: EARNINGS_REPORT_SKELETON_LAYOUT.rowDirection,
          alignItems: 'flex-start',
          overflow: 'hidden',
          borderRadius: cardRadius,
          padding: cardPad,
          backgroundColor: 'rgba(255, 255, 255, 0.06)',
        }}
      >
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            left: 0,
            top: 10,
            bottom: 10,
            width: 3,
            borderRadius: 3,
            backgroundColor: 'rgba(255, 255, 255, 0.16)',
          }}
        />

        <View style={{ flex: 1, alignItems: 'flex-start', paddingLeft: 15 }}>
          <View
            style={{
              flexDirection: EARNINGS_REPORT_SKELETON_LAYOUT.rowDirection,
              alignItems: 'flex-start',
              justifyContent: 'space-between',
              width: '100%',
              marginBottom: 8,
            }}
          >
            <View
              style={{
                flexDirection: EARNINGS_REPORT_SKELETON_LAYOUT.rowDirection,
                alignItems: 'flex-start',
                flex: 1,
                marginRight: 8,
              }}
            >
              <View style={{ marginRight: 12 }}>
                <SkeletonBox width={40} height={40} borderRadius={20} delay={delay} />
              </View>
              <View style={{ flex: 1, justifyContent: 'flex-start', gap: 6 }}>
                <SkeletonBox width={64} height={15} delay={delay + 50} />
                <SkeletonBox width={120} height={11} delay={delay + 100} />
              </View>
            </View>
            <SkeletonBox width={88} height={22} borderRadius={999} delay={delay + 80} />
          </View>

          <View style={{ marginTop: 12, width: '100%' }}>
            <View
              style={{
                height: 1,
                backgroundColor: 'rgba(255, 255, 255, 0.12)',
                marginBottom: 12,
              }}
            />
            <View
              style={{
                flexDirection: EARNINGS_REPORT_SKELETON_LAYOUT.rowDirection,
                alignItems: 'center',
                width: '100%',
                justifyContent: 'space-between',
              }}
            >
              <View style={{ flex: 1, alignItems: 'center', paddingRight: 8, gap: 8 }}>
                <SkeletonBox width={72} height={12} delay={delay + 150} />
                <SkeletonBox width={56} height={16} delay={delay + 180} />
              </View>
              <View
                style={{
                  width: 1,
                  height: 35,
                  backgroundColor: 'rgba(255, 255, 255, 0.12)',
                  marginHorizontal: 8,
                }}
              />
              <View style={{ flex: 1, alignItems: 'center', paddingLeft: 8, gap: 8 }}>
                <SkeletonBox width={64} height={12} delay={delay + 150} />
                <SkeletonBox width={48} height={16} delay={delay + 180} />
              </View>
            </View>
          </View>
        </View>
      </View>
    </View>
  );
};

/**
 * Skeleton לאירוע ביומן כלכלי — כותרת ואז שעת דיווח, פס חשיבות מימין (flex sibling),
 * שלוש מטריקות (תוצאה / תחזית / קודם). לא row-reverse.
 */
export const EconomicEventSkeleton: React.FC<CardSkeletonProps> = ({ delay = 0 }) => {
  const tokens = useDesignTokens();
  const screenPad = tokens.layout?.screenPadding ?? 20;
  const cardRadius = tokens.borderRadius['2xl'];
  const cardPad = tokens.layout?.cardPadding ?? tokens.spacing.xl;

  return (
    <View style={{ marginHorizontal: screenPad, marginBottom: 12 }}>
      <View
        style={{
          overflow: 'hidden',
          borderRadius: cardRadius,
          backgroundColor: 'rgba(255, 255, 255, 0.06)',
        }}
      >
        <View style={{ flexDirection: ECONOMIC_EVENT_SKELETON_LAYOUT.rowDirection, alignItems: 'stretch' }}>
          <View
            style={{
              flex: 1,
              alignItems: 'flex-end',
              paddingVertical: cardPad,
              paddingLeft: cardPad,
              paddingRight: cardPad,
            }}
          >
            <View
              style={{
                flexDirection: ECONOMIC_EVENT_SKELETON_LAYOUT.rowDirection,
                alignItems: 'center',
                justifyContent: 'space-between',
                width: '100%',
              }}
            >
              <View style={{ flex: 1, marginRight: 10, alignItems: 'flex-end' }}>
                <SkeletonBox width="78%" height={15} delay={delay} />
              </View>
              <SkeletonBox width={52} height={24} borderRadius={999} delay={delay + 40} />
            </View>

            <View style={{ marginTop: 10, width: '100%' }}>
              <View
                style={{
                  height: StyleSheet.hairlineWidth,
                  backgroundColor: 'rgba(255, 255, 255, 0.12)',
                  marginBottom: 10,
                }}
              />
              <View
                style={{
                  flexDirection: ECONOMIC_EVENT_SKELETON_LAYOUT.metricsRowDirection,
                  alignItems: 'flex-start',
                  width: '100%',
                }}
              >
                {[0, 1, 2].map((i) => (
                  <React.Fragment key={i}>
                    {i > 0 ? (
                      <View
                        style={{
                          width: StyleSheet.hairlineWidth,
                          height: 34,
                          backgroundColor: 'rgba(255, 255, 255, 0.12)',
                          marginHorizontal: 8,
                        }}
                      />
                    ) : null}
                    <View style={{ flex: 1, alignItems: 'center', gap: 6 }}>
                      <SkeletonBox width={36} height={11} delay={delay + 80 + i * 30} />
                      <SkeletonBox width={48} height={15} delay={delay + 110 + i * 30} />
                    </View>
                  </React.Fragment>
                ))}
              </View>
            </View>
          </View>

          <View
            style={{
              width: 3,
              alignSelf: 'stretch',
              backgroundColor: 'rgba(255, 255, 255, 0.16)',
            }}
          />
        </View>
      </View>
    </View>
  );
};

export const EarningsReportsListSkeleton: React.FC<{ count?: number }> = ({ count = 5 }) => (
  <View>
    {Array.from({ length: count }).map((_, i) => (
      <EarningsReportSkeleton key={i} delay={i * 70} />
    ))}
  </View>
);

export const EconomicCalendarListSkeleton: React.FC<{ count?: number }> = ({ count = 6 }) => (
  <View>
    {Array.from({ length: count }).map((_, i) => (
      <EconomicEventSkeleton key={i} delay={i * 70} />
    ))}
  </View>
);
