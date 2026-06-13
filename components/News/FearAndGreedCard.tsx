import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  ActivityIndicator,
  TouchableOpacity,
  Animated,
  useWindowDimensions,
  type ViewStyle,
  type TextStyle,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Path, Circle, Line, Text as SvgText } from 'react-native-svg';
import { useDesignTokens } from '../ui/DesignTokens';
import {
  fearAndGreedService,
  FearAndGreedData,
  FEAR_GREED_GAUGE_SEGMENTS,
} from '../../services/fearAndGreedService';
import UICard from '../ui/UICard';

interface FearAndGreedCardProps {
  onPress?: () => void;
  initialExpanded?: boolean;
  /**
   * כשהוא true – הכרטיס נפתח תמיד, בלי כפתור סגירה/פתיחה
   * (משמש בטאב "עיקרי מדדים")
   */
  disableToggle?: boolean;
  /**
   * כשהוא true – ללא מרווחים מהצדדים, ברוחב מלא של הקונטיינר
   */
  fullWidth?: boolean;
  /** כשהוא true – בלי שורת כותרת בכרטיס (הכותרת מוצגת בכותרת המסך) */
  hideHeader?: boolean;
  /** ריפוד פנימי של UICard; `none` + מסך שכבר מרווח אופקית — מצמצם «מסגרת» סביב הגייג' */
  cardPadding?: 'none' | 'sm' | 'md' | 'lg';
}

export default function FearAndGreedCard({
  onPress,
  initialExpanded,
  disableToggle,
  fullWidth,
  hideHeader = false,
  cardPadding = 'sm',
}: FearAndGreedCardProps) {
  const DesignTokens = useDesignTokens();
  const { width: windowWidth } = useWindowDimensions();
  const [data, setData] = useState<FearAndGreedData | null>(null);
  const [historicalData, setHistoricalData] = useState<{
    previousClose?: FearAndGreedData;
    oneWeekAgo?: FearAndGreedData;
    oneMonthAgo?: FearAndGreedData;
    oneYearAgo?: FearAndGreedData;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(initialExpanded ?? false);

  // בדיקת בטיחות - אם DesignTokens לא מוגדר, נשתמש בערכים ברירת מחדל
  if (!DesignTokens || !DesignTokens.colors || !DesignTokens.colors.primary) {
    // נחזיר null במקום לזרוק שגיאה כדי לא לקרוס את המסך
    return null;
  }

  /** קואורדינטות לוגיות של הגייג' (viewBox) — הרינדור מוקטן לרוחב המסך כדי שלא ייחתך עם overflow:hidden */
  const LOGICAL_GAUGE = 380;
  const hp = DesignTokens.layout?.screenPadding ?? DesignTokens.spacing.lg;
  // The card is now split horizontally: gauge column (~58%) on the right,
  // history column (~42%) on the left. We size the gauge to fit its column,
  // not the whole card width.
  const cardInnerWidth = Math.max(
    220,
    windowWidth - (fullWidth ? hp * 2 + 12 : hp * 2 + DesignTokens.spacing.lg * 2 + 12)
  );
  const gaugeViewportW = Math.min(LOGICAL_GAUGE, Math.round(cardInnerWidth * 0.58) - 12);

  const styles = useMemo(() => {
    const headerJustifyContent: ViewStyle['justifyContent'] = disableToggle ? 'center' : 'space-between';
    const titleTextAlign: TextStyle['textAlign'] = disableToggle ? 'center' : 'right';

    return {
      container: {
        marginHorizontal: fullWidth ? 0 : DesignTokens.spacing.lg,
        marginTop: 0,
        marginBottom:
          fullWidth && cardPadding === 'none'
            ? DesignTokens.spacing.sm
            : DesignTokens.spacing.md,
        borderRadius: DesignTokens.borderRadius.lg,
        overflow: 'hidden' as const,
      },
      header: {
        flexDirection: 'row' as const,
        alignItems: 'center' as const,
        justifyContent: headerJustifyContent,
        marginBottom: DesignTokens.spacing.sm,
        zIndex: 10,
        paddingHorizontal: DesignTokens.spacing.sm,
      },
      title: {
        fontSize: DesignTokens.typography.fontSize.lg,
        fontWeight: DesignTokens.typography.fontWeight.bold as any,
        color: DesignTokens.colors.text.primary,
        textAlign: titleTextAlign,
        writingDirection: 'rtl' as const,
        ...(disableToggle ? { width: '100%' as const } : {}),
      },
      valueContainer: {
        flexDirection: 'row' as const,
        alignItems: 'center' as const,
        justifyContent: 'space-between' as const,
        marginTop: DesignTokens.spacing.sm,
      },
      valueText: {
        fontSize: DesignTokens.typography.fontSize['3xl'],
        fontWeight: DesignTokens.typography.fontWeight.bold as any,
        color: DesignTokens.colors.text.primary,
      },
      description: {
        fontSize: DesignTokens.typography.fontSize.base,
        fontWeight: DesignTokens.typography.fontWeight.medium as any,
        color: DesignTokens.colors.text.secondary,
        textAlign: 'right' as const,
        marginTop: DesignTokens.spacing.xs,
      },
      progressBar: {
        height: 8,
        borderRadius: 4,
        marginTop: DesignTokens.spacing.md,
        backgroundColor: DesignTokens.colors.background.tertiary,
        overflow: 'hidden' as const,
      },
      progressFill: {
        height: '100%' as const,
        borderRadius: 4,
      },
      loadingContainer: {
        paddingVertical: DesignTokens.spacing.lg,
        alignItems: 'center' as const,
      },
      errorText: {
        fontSize: DesignTokens.typography.fontSize.sm,
        color: DesignTokens.colors.danger.main,
        textAlign: 'right' as const,
        marginTop: DesignTokens.spacing.xs,
      },
      splitContainer: {
        flexDirection: 'row' as const,
        width: '100%' as const,
        minHeight: 200,
      },
      leftSection: {
        flex: 0.4,
        alignItems: 'flex-end' as const,
        justifyContent: 'flex-start' as const,
        paddingRight: DesignTokens.spacing.sm,
        paddingTop: DesignTokens.spacing.md,
      },
      rightSection: {
        flex: 0.6,
        justifyContent: 'center' as const,
        alignItems: 'center' as const,
        paddingLeft: DesignTokens.spacing.sm,
      },
      divider: {
        width: 1,
        backgroundColor: DesignTokens.colors.background.tertiary,
        marginHorizontal: DesignTokens.spacing.sm,
      },
      gaugeContainer: {
        alignItems: 'center' as const,
        justifyContent: 'center' as const,
        marginTop: 0,
        marginBottom: 0,
        position: 'relative' as const,
        width: '100%' as const,
        height: gaugeViewportW * 0.55,
        minHeight: gaugeViewportW * 0.55,
        alignSelf: 'center' as const,
      },
      segmentsLabels: {
        flexDirection: 'column' as const,
        justifyContent: 'flex-start' as const,
        width: '100%' as const,
        paddingHorizontal: DesignTokens.spacing.sm,
        marginTop: DesignTokens.spacing.sm,
        alignItems: 'center' as const,
      },
      segmentLabelContainer: {
        flexDirection: 'row' as const,
        alignItems: 'center' as const,
        marginBottom: DesignTokens.spacing.xs,
        justifyContent: 'center' as const,
      },
      segmentColorDot: {
        width: 10,
        height: 10,
        borderRadius: 5,
        marginRight: DesignTokens.spacing.lg,
      },
      segmentLabel: {
        fontSize: DesignTokens.typography.fontSize.xs,
        fontWeight: DesignTokens.typography.fontWeight.medium as any,
        color: DesignTokens.colors.text.secondary,
        textAlign: 'right' as const,
        writingDirection: 'rtl' as const,
      },
      currentValueContainer: {
        alignItems: 'center' as const,
        justifyContent: 'center' as const,
        marginTop: DesignTokens.spacing.xs,
        marginBottom: DesignTokens.spacing.sm,
        paddingVertical: DesignTokens.spacing.xs,
      },
      currentValueText: {
        fontSize: DesignTokens.typography.fontSize['3xl'],
        fontWeight: DesignTokens.typography.fontWeight.bold as any,
        fontFamily: DesignTokens.typography.fontFamily.assistant?.[0] || 'System',
        textAlign: 'center' as const,
        lineHeight: DesignTokens.typography.fontSize['3xl'] * 1.05,
      },
      currentValueDescription: {
        fontSize: DesignTokens.typography.fontSize.sm,
        fontWeight: DesignTokens.typography.fontWeight.medium as any,
        textAlign: 'center' as const,
        marginTop: 2,
        lineHeight: DesignTokens.typography.fontSize.sm * 1.2,
      },
      historicalDataContainer: {
        marginTop: 0,
        paddingTop: 0,
        width: '100%' as const,
        flex: 1,
        justifyContent: 'flex-start' as const,
      },
      historicalSectionTitle: {
        fontSize: DesignTokens.typography.fontSize.base,
        fontWeight: DesignTokens.typography.fontWeight.bold as any,
        color: DesignTokens.colors.text.primary,
        textAlign: 'right' as const,
        writingDirection: 'rtl' as const,
        marginBottom: DesignTokens.spacing.md,
      },
      historicalItem: {
        flexDirection: 'row' as const,
        justifyContent: 'flex-start' as const,
        alignItems: 'center' as const,
        marginBottom: DesignTokens.spacing.sm,
        paddingHorizontal: DesignTokens.spacing.sm,
        paddingVertical: DesignTokens.spacing.xs / 2,
      },
      historicalLabel: {
        fontSize: DesignTokens.typography.fontSize.sm,
        color: DesignTokens.colors.text.secondary,
        fontWeight: DesignTokens.typography.fontWeight.medium as any,
        textAlign: 'right' as const,
        writingDirection: 'rtl' as const,
        marginLeft: DesignTokens.spacing.sm,
      },
      historicalValue: {
        fontSize: DesignTokens.typography.fontSize.sm,
        fontWeight: DesignTokens.typography.fontWeight.bold as any,
        textAlign: 'right' as const,
        writingDirection: 'rtl' as const,
      },
    };
  }, [DesignTokens, fullWidth, cardPadding, disableToggle, gaugeViewportW]);

  const cardContentContainerStyle =
    cardPadding === 'none'
      ? {
          /** כמו `titlePad` ב־MarketsIndicesCard — כותרות באותו מרחק מקצה הכרטיס העליון */
          paddingTop: hideHeader ? DesignTokens.spacing.xs : DesignTokens.spacing.md,
          paddingBottom: DesignTokens.spacing.sm,
        }
      : undefined;

  useEffect(() => {
    loadFearAndGreedIndex();

    // עדכון אוטומטי כל 30 דקות (המדד מתעדכן פעם ביום, אבל נבדוק לעתים קרובות יותר)
    const interval = setInterval(() => {
      loadFearAndGreedIndex();
    }, 30 * 60 * 1000); // 30 דקות

    return () => {
      clearInterval(interval);
    };
  }, []);

  const loadFearAndGreedIndex = async () => {
    // אם כבר יש לנו נתון, לא נראה את ספינר ה"טעינה" — נטען ברקע ונחליף
    // את הערכים רק אם הצלחנו. זה מונע "הבזק" של מצב טעינה ושל ערך 50 דיפולטי.
    const hadDataBefore = data != null;
    try {
      if (!hadDataBefore) setLoading(true);
      setError(null);
      // שליפת כל הנתונים כולל היסטוריים
      const fullData = await fearAndGreedService.getFearAndGreedIndex();
      setData(fullData.fgi.now);
      setHistoricalData({
        previousClose: fullData.fgi.previousClose,
        oneWeekAgo: fullData.fgi.oneWeekAgo,
        oneMonthAgo: fullData.fgi.oneMonthAgo,
        oneYearAgo: fullData.fgi.oneYearAgo,
      });
    } catch (err: any) {
      // אם הייתה לנו תצוגה קודמת תקינה — נשאיר אותה ולא נראה הודעת שגיאה,
      // אבל גם **לא** נציג ערך 50 מזויף.
      if (!hadDataBefore) {
        setError(err?.message || 'שגיאה בטעינת המדד');
        setData(null);
        setHistoricalData(null);
      }
    } finally {
      setLoading(false);
    }
  };

  const effectiveExpanded = disableToggle ? true : expanded;

  const renderHeader = (_subtitle?: string) => (
    <View style={styles.header}>
      <View
        style={
          disableToggle
            ? {
                width: '100%' as const,
                flexDirection: 'row' as const,
                alignItems: 'center' as const,
                justifyContent: 'center' as const,
              }
            : { flexDirection: 'row' as const, alignItems: 'center' as const, flex: 1 }
        }
      >
        <Text style={styles.title}>מדד הפחד והתאווה</Text>
      </View>
      {!disableToggle && (
        <TouchableOpacity
          onPress={() => setExpanded(!expanded)}
          activeOpacity={0.7}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            paddingHorizontal: DesignTokens.spacing.sm,
            paddingVertical: DesignTokens.spacing.xs / 2,
            borderRadius: 999,
            backgroundColor: 'rgba(0,0,0,0.35)',
          }}
        >
          <Text
            style={{
              fontSize: DesignTokens.typography.fontSize.xs,
              color: DesignTokens.colors.text.secondary,
              marginRight: DesignTokens.spacing.xs / 2,
            }}
          >
            {expanded ? 'סגור' : 'פתח'}
          </Text>
          <Ionicons
            name={expanded ? 'chevron-up' : 'chevron-down'}
            size={16}
            color={DesignTokens.colors.text.secondary}
          />
        </TouchableOpacity>
      )}
    </View>
  );

  if (loading) {
    return (
      <View style={styles.container}>
        <UICard
          variant="blur"
          padding={cardPadding}
          contentContainerStyle={cardContentContainerStyle}
        >
          {!hideHeader ? renderHeader() : null}
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="small" color={DesignTokens.colors.primary.main} />
            <Text style={[styles.description, { marginTop: DesignTokens.spacing.sm }]}>
              טוען מדד הפחד והתאווה...
            </Text>
          </View>
        </UICard>
      </View>
    );
  }

  if (error || !data) {
    return (
      <View style={styles.container}>
        <UICard
          variant="blur"
          padding={cardPadding}
          contentContainerStyle={cardContentContainerStyle}
        >
          {!hideHeader ? renderHeader() : null}
          <Text style={styles.errorText}>
            {error || 'לא ניתן לטעון את המדד'}
          </Text>
          <TouchableOpacity
            onPress={loadFearAndGreedIndex}
            style={{
              marginTop: DesignTokens.spacing.sm,
              paddingVertical: DesignTokens.spacing.xs,
              paddingHorizontal: DesignTokens.spacing.sm,
              borderRadius: DesignTokens.borderRadius.md,
              backgroundColor: 'rgba(0,0,0,0.35)',
              alignSelf: 'flex-start',
            }}
          >
            <Text style={{
              fontSize: DesignTokens.typography.fontSize.sm,
              color: DesignTokens.colors.primary.main,
              fontWeight: DesignTokens.typography.fontWeight.medium as any,
            }}>
              נסה שוב
            </Text>
          </TouchableOpacity>
        </UICard>
      </View>
    );
  }

  const value = data.value;
  const description = fearAndGreedService.getValueDescription(value);
  const color = fearAndGreedService.getValueColor(value);
  const icon = fearAndGreedService.getValueIcon(value);
  // פרמטרים לגייג' חצי עגול - מותאם לגודל (הוגדל)
  const centerX = LOGICAL_GAUGE / 2;
  const centerY = LOGICAL_GAUGE * 0.88; // מיקום נמוך יותר ליצירת חצי עיגול
  const radius = 100; // הוגדל
  const strokeWidth = 32;
  const startAngle = -180; // מתחיל משמאל
  const endAngle = 0; // מסתיים בימין
  const totalAngle = 180; // 180 מעלות

  // חישוב זווית המחט לפי הערך (0-100 -> -180 עד 0)
  const needleAngle = startAngle + (value / 100) * totalAngle;
  const needleAngleRad = (needleAngle * Math.PI) / 180;

  // נקודות למחט - מחט ארוכה יותר ומדויקת יותר
  const needleLength = radius - 3; // ארוכה יותר
  const needleEndX = centerX + needleLength * Math.cos(needleAngleRad);
  const needleEndY = centerY + needleLength * Math.sin(needleAngleRad);

  // נקודות לקצה המחט (משולש אלגנטי)
  const needleTipWidth = 10;
  const perpendicularAngle = needleAngleRad + Math.PI / 2;
  const tipLeftX = needleEndX + (needleTipWidth / 2) * Math.cos(perpendicularAngle);
  const tipLeftY = needleEndY + (needleTipWidth / 2) * Math.sin(perpendicularAngle);
  const tipRightX = needleEndX - (needleTipWidth / 2) * Math.cos(perpendicularAngle);
  const tipRightY = needleEndY - (needleTipWidth / 2) * Math.sin(perpendicularAngle);

  // נקודות לגוף המחט (משולש צר)
  const needleBodyWidth = 2;
  const bodyStartX = centerX + 8 * Math.cos(needleAngleRad);
  const bodyStartY = centerY + 8 * Math.sin(needleAngleRad);
  const bodyLeftX = bodyStartX + (needleBodyWidth / 2) * Math.cos(perpendicularAngle);
  const bodyLeftY = bodyStartY + (needleBodyWidth / 2) * Math.sin(perpendicularAngle);
  const bodyRightX = bodyStartX - (needleBodyWidth / 2) * Math.cos(perpendicularAngle);
  const bodyRightY = bodyStartY - (needleBodyWidth / 2) * Math.sin(perpendicularAngle);

  // יצירת קשת (path לקשת) - עם הפרדה מדויקת
  const createArcPath = (start: number, end: number, r: number) => {
    const startRad = (start * Math.PI) / 180;
    const endRad = (end * Math.PI) / 180;
    const x1 = centerX + r * Math.cos(startRad);
    const y1 = centerY + r * Math.sin(startRad);
    const x2 = centerX + r * Math.cos(endRad);
    const y2 = centerY + r * Math.sin(endRad);
    const largeArc = end - start > 90 ? 1 : 0;
    return `M ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2}`;
  };

  // קטעים של הגייג' - עם הפרדה מדויקת (בלי חופפים)
  // כל קטע מקבל 45 מעלות בדיוק
  const segments = FEAR_GREED_GAUGE_SEGMENTS;

  const CardContent = (
    <View style={styles.container}>
      <UICard
        variant="blur"
        padding={cardPadding}
        contentContainerStyle={cardContentContainerStyle}
      >
        {!hideHeader ? renderHeader(description) : null}

        {!effectiveExpanded ? (
          <View style={{ marginTop: DesignTokens.spacing.sm }}>
            <Text style={[styles.description, { textAlign: 'right', marginBottom: DesignTokens.spacing.xs }]}>
              ערך נוכחי: <Text style={{ fontWeight: DesignTokens.typography.fontWeight.bold as any, color }}>{value}</Text>
            </Text>
            <Text style={[styles.description, { textAlign: 'right', color: DesignTokens.colors.text.secondary }]}>
              לחץ כדי לראות את הגרף וההיסטוריה
            </Text>
          </View>
        ) : (
          <View
            style={{
              flexDirection: 'row-reverse',
              alignItems: 'stretch',
              gap: DesignTokens.spacing.sm,
              paddingHorizontal: DesignTokens.spacing.sm,
            }}
          >
            {/* — Right column: gauge + value — */}
            <View style={{ flex: 0.58, alignItems: 'center', justifyContent: 'flex-start' }}>
              <View style={styles.gaugeContainer}>
                <Svg
                  width={gaugeViewportW}
                  height={gaugeViewportW * 0.55}
                  viewBox={`0 0 ${LOGICAL_GAUGE} ${LOGICAL_GAUGE}`}
                  preserveAspectRatio="xMidYMid meet"
                >
                  {/* רקע קשת אפור - מתחת לכל הקשתות */}
                  <Path
                    d={createArcPath(startAngle, endAngle, radius)}
                    stroke={DesignTokens.colors.background.tertiary}
                    strokeWidth={strokeWidth}
                    fill="transparent"
                    strokeLinecap="round"
                    opacity={0.12}
                  />

                  {/* קשתות צבעוניות - עם הפרדות קטנות למניעת גלישה */}
                  {segments.map((segment, index) => {
                    const gap = 0.4;
                    const adjustedStart = segment.start + gap;
                    const adjustedEnd = segment.end - gap;

                    return (
                      <Path
                        key={index}
                        d={createArcPath(adjustedStart, adjustedEnd, radius)}
                        stroke={segment.color}
                        strokeWidth={strokeWidth}
                        fill="transparent"
                        strokeLinecap="butt"
                      />
                    );
                  })}

                  {/* קווי חלוקה - בעובי הגייג' */}
                  {[0, 25, 50, 75, 100].map((val, index) => {
                    const angle = startAngle + (val / 100) * totalAngle;
                    const angleRad = (angle * Math.PI) / 180;
                    // קווים בעובי הגייג' - מהקצה הפנימי לקצה החיצוני
                    const x1 = centerX + (radius - strokeWidth / 2) * Math.cos(angleRad);
                    const y1 = centerY + (radius - strokeWidth / 2) * Math.sin(angleRad);
                    const x2 = centerX + (radius + strokeWidth / 2) * Math.cos(angleRad);
                    const y2 = centerY + (radius + strokeWidth / 2) * Math.sin(angleRad);
                    return (
                      <Line
                        key={index}
                        x1={x1}
                        y1={y1}
                        x2={x2}
                        y2={y2}
                        stroke={DesignTokens.colors.text.tertiary}
                        strokeWidth={1}
                        opacity={0.4}
                      />
                    );
                  })}

                  {/* מספרים על הגייג' */}
                  {[0, 25, 50, 75, 100].map((val, index) => {
                    const angle = startAngle + (val / 100) * totalAngle;
                    const angleRad = (angle * Math.PI) / 180;
                    const textRadius = radius + strokeWidth / 2 + 15;
                    const x = centerX + textRadius * Math.cos(angleRad);
                    const y = centerY + textRadius * Math.sin(angleRad);
                    return (
                      <SvgText
                        key={`text-${index}`}
                        x={x}
                        y={y}
                        fontSize={12}
                        fill={DesignTokens.colors.text.secondary}
                        textAnchor="middle"
                        alignmentBaseline="middle"
                        fontWeight="500"
                      >
                        {val}
                      </SvgText>
                    );
                  })}

                  {/* מחט — בצבע האזור הנוכחי */}
                  <Line
                    x1={centerX}
                    y1={centerY}
                    x2={needleEndX}
                    y2={needleEndY}
                    stroke={color}
                    strokeWidth={5}
                    strokeLinecap="round"
                  />

                  {/* נקודת מרכז */}
                  <Circle
                    cx={centerX}
                    cy={centerY}
                    r={10}
                    fill={DesignTokens.colors.background.secondary}
                    stroke={color}
                    strokeWidth={2}
                  />
                  <Circle
                    cx={centerX}
                    cy={centerY}
                    r={5}
                    fill={color}
                  />
                </Svg>
              </View>

              {/* ערך נוכחי — מתחת לגייג' */}
              <View style={styles.currentValueContainer}>
                <Text style={[styles.currentValueText, { color }]}>
                  {value}
                </Text>
                <Text style={[styles.currentValueDescription, { color }]}>
                  {description}
                </Text>
              </View>

              {/* Timestamp under the gauge column */}
              {data.timestamp && (
                <Text
                  style={[
                    styles.description,
                    {
                      fontSize: DesignTokens.typography.fontSize.xs,
                      marginTop: DesignTokens.spacing.xs,
                      textAlign: 'center',
                      color: DesignTokens.colors.text.tertiary,
                    },
                  ]}
                >
                  עודכן:{' '}
                  {new Date(data.timestamp * 1000).toLocaleString('he-IL', {
                    day: 'numeric',
                    month: 'short',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </Text>
              )}
            </View>

            {/* — Left column: history list — */}
            <View
              style={{
                flex: 0.42,
                justifyContent: 'flex-start',
                paddingTop: DesignTokens.spacing.sm,
                paddingRight: DesignTokens.spacing.xs,
                borderRightWidth: 1,
                borderRightColor: DesignTokens.colors.border.primary,
                paddingLeft: DesignTokens.spacing.sm,
              }}
            >
              <Text
                style={{
                  fontSize: DesignTokens.typography.fontSize.sm,
                  fontWeight: DesignTokens.typography.fontWeight.bold as any,
                  color: DesignTokens.colors.text.primary,
                  textAlign: 'right',
                  writingDirection: 'rtl',
                  marginBottom: DesignTokens.spacing.sm,
                }}
              >
                היסטוריה
              </Text>

              {[
                { key: 'previousClose' as const, label: 'סגירה קודמת' },
                { key: 'oneWeekAgo' as const, label: 'לפני שבוע' },
                { key: 'oneMonthAgo' as const, label: 'לפני חודש' },
                { key: 'oneYearAgo' as const, label: 'לפני שנה' },
              ].map(({ key, label }) => {
                const item = historicalData?.[key];
                return (
                  <View
                    key={key}
                    style={{
                      flexDirection: 'row-reverse',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      paddingVertical: DesignTokens.spacing.xs,
                      borderBottomWidth: 1,
                      borderBottomColor: 'rgba(255,255,255,0.06)',
                    }}
                  >
                    <Text
                      style={{
                        fontSize: DesignTokens.typography.fontSize.xs,
                        color: DesignTokens.colors.text.secondary,
                        textAlign: 'right',
                        writingDirection: 'rtl',
                      }}
                    >
                      {label}
                    </Text>
                    <Text
                      style={{
                        fontSize: DesignTokens.typography.fontSize.base,
                        fontWeight: DesignTokens.typography.fontWeight.bold as any,
                        color: item
                          ? fearAndGreedService.getValueColor(item.value)
                          : DesignTokens.colors.text.tertiary,
                      }}
                    >
                      {item ? item.value : '–'}
                    </Text>
                  </View>
                );
              })}

              {/* Segment legend — vertical, fits under the history list */}
              <View style={{ marginTop: DesignTokens.spacing.sm, gap: 6 }}>
                {FEAR_GREED_GAUGE_SEGMENTS.map((seg) => (
                  <View
                    key={seg.label}
                    style={{
                      flexDirection: 'row-reverse',
                      alignItems: 'center',
                      gap: 6,
                    }}
                  >
                    <View
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: 4,
                        backgroundColor: seg.color,
                      }}
                    />
                    <Text
                      style={{
                        fontSize: 11,
                        color: DesignTokens.colors.text.secondary,
                      }}
                    >
                      {seg.label}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          </View>
        )}
      </UICard>
    </View>
  );

  if (onPress) {
    return (
      <TouchableOpacity onPress={onPress} activeOpacity={0.7}>
        {CardContent}
      </TouchableOpacity>
    );
  }

  return CardContent;
}

