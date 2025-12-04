import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, ActivityIndicator, TouchableOpacity, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Path, Circle, Line, Text as SvgText } from 'react-native-svg';
import { useDesignTokens } from '../ui/DesignTokens';
import { fearAndGreedService, FearAndGreedData } from '../../services/fearAndGreedService';

interface FearAndGreedCardProps {
  onPress?: () => void;
}

export default function FearAndGreedCard({ onPress }: FearAndGreedCardProps) {
  const DesignTokens = useDesignTokens();
  const [data, setData] = useState<FearAndGreedData | null>(null);
  const [historicalData, setHistoricalData] = useState<{
    previousClose?: FearAndGreedData;
    oneWeekAgo?: FearAndGreedData;
    oneMonthAgo?: FearAndGreedData;
    oneYearAgo?: FearAndGreedData;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // בדיקת בטיחות - אם DesignTokens לא מוגדר, נשתמש בערכים ברירת מחדל
  if (!DesignTokens || !DesignTokens.colors || !DesignTokens.colors.primary) {
    console.error('❌ FearAndGreedCard: DesignTokens not properly initialized');
    // נחזיר null במקום לזרוק שגיאה כדי לא לקרוס את המסך
    return null;
  }

  // פרמטרים לגייג' חצי עגול - מותאם לגודל (הוגדל)
  const gaugeSize = 280;

  const styles = useMemo(() => {
    return {
      container: {
        marginHorizontal: DesignTokens.spacing.lg,
        marginTop: DesignTokens.spacing.xs,
        marginBottom: DesignTokens.spacing.md,
        borderRadius: DesignTokens.borderRadius.lg,
        backgroundColor: DesignTokens.colors.background.secondary,
        paddingTop: DesignTokens.spacing.sm,
        paddingBottom: DesignTokens.spacing.md,
        paddingHorizontal: DesignTokens.spacing.md,
        overflow: 'hidden' as const,
      },
      header: {
        flexDirection: 'row' as const,
        alignItems: 'center' as const,
        justifyContent: 'flex-end' as const,
        marginBottom: DesignTokens.spacing.xs,
      },
      title: {
        fontSize: DesignTokens.typography.fontSize.lg,
        fontWeight: DesignTokens.typography.fontWeight.bold as any,
        color: DesignTokens.colors.text.primary,
        textAlign: 'right' as const,
        writingDirection: 'rtl' as const,
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
        marginVertical: DesignTokens.spacing.xs,
        position: 'relative' as const,
        width: '100%' as const,
        height: gaugeSize * 0.5,
        minHeight: gaugeSize * 0.5,
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
        flexDirection: 'row-reverse' as const,
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
        fontSize: DesignTokens.typography.fontSize['3xl'] * 1.2,
        fontWeight: DesignTokens.typography.fontWeight.bold as any,
        fontFamily: DesignTokens.typography.fontFamily.assistant?.[0] || 'System',
        textAlign: 'center' as const,
        lineHeight: DesignTokens.typography.fontSize['3xl'] * 1.2,
      },
      currentValueDescription: {
        fontSize: DesignTokens.typography.fontSize.base,
        fontWeight: DesignTokens.typography.fontWeight.medium as any,
        textAlign: 'center' as const,
        marginTop: DesignTokens.spacing.xs,
        lineHeight: DesignTokens.typography.fontSize.base * 1.2,
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
        flexDirection: 'row-reverse' as const,
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
  }, [DesignTokens]);

  useEffect(() => {
    loadFearAndGreedIndex();
    
    // עדכון אוטומטי כל 30 דקות (המדד מתעדכן פעם ביום, אבל נבדוק לעתים קרובות יותר)
    const interval = setInterval(() => {
      console.log('🔄 FearAndGreedCard: Auto-refreshing data...');
      loadFearAndGreedIndex();
    }, 30 * 60 * 1000); // 30 דקות

    return () => {
      clearInterval(interval);
    };
  }, []);

  const loadFearAndGreedIndex = async () => {
    try {
      setLoading(true);
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
      console.error('❌ FearAndGreedCard: Error loading data:', err);
      setError(err.message || 'שגיאה בטעינת המדד');
      // נסה לטעון רק את הערך הנוכחי
      try {
        const currentValue = await fearAndGreedService.getCurrentValue();
        setData(currentValue);
      } catch (fallbackErr) {
        console.error('❌ FearAndGreedCard: Fallback also failed:', fallbackErr);
      }
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color={DesignTokens.colors.primary.main} />
          <Text style={[styles.description, { marginTop: DesignTokens.spacing.sm }]}>
            טוען מדד פחד ותאווה...
          </Text>
        </View>
      </View>
    );
  }

  if (error || !data) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.title}>מדד פחד ותאווה</Text>
          <Ionicons 
            name="trending-up-outline" 
            size={24} 
            color={DesignTokens.colors.text.secondary} 
          />
        </View>
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
            backgroundColor: DesignTokens.colors.background.tertiary,
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
      </View>
    );
  }

  const value = data.value;
  const description = fearAndGreedService.getValueDescription(value);
  const color = fearAndGreedService.getValueColor(value);
  const icon = fearAndGreedService.getValueIcon(value);

  // פרמטרים לגייג' חצי עגול - מותאם לגודל (הוגדל)
  const centerX = gaugeSize / 2;
  const centerY = gaugeSize * 0.88; // מיקום נמוך יותר ליצירת חצי עיגול
  const radius = 100; // הוגדל
  const strokeWidth = 28; // עובי הקשת (הוגדל)
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
  const segments = [
    { start: -180, end: -135, color: '#FF0000', label: 'פחד קיצוני' }, // 0-25
    { start: -135, end: -90, color: '#FF8C00', label: 'פחד' }, // 25-50
    { start: -90, end: -45, color: '#FFD700', label: 'ניטרלי' }, // 50-75
    { start: -45, end: 0, color: '#00FF00', label: 'תאווה' }, // 75-100
  ];

  const CardContent = (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>מדד פחד ותאווה</Text>
      </View>

      {/* פריסה אופקית - שני חלקים */}
      <View style={styles.splitContainer}>
        {/* צד שמאל - נתונים היסטוריים */}
        <View style={styles.leftSection}>
          {historicalData && (
            <View style={styles.historicalDataContainer}>
              <Text style={styles.historicalSectionTitle}>היסטוריה</Text>
          {historicalData.previousClose && (
            <View style={styles.historicalItem}>
              <Text style={styles.historicalLabel}>סגירה קודמת:</Text>
              <Text style={[styles.historicalValue, { color: fearAndGreedService.getValueColor(historicalData.previousClose.value) }]}>
                {historicalData.previousClose.value}
              </Text>
            </View>
          )}
          {historicalData.oneWeekAgo && (
            <View style={styles.historicalItem}>
              <Text style={styles.historicalLabel}>לפני שבוע:</Text>
              <Text style={[styles.historicalValue, { color: fearAndGreedService.getValueColor(historicalData.oneWeekAgo.value) }]}>
                {historicalData.oneWeekAgo.value}
              </Text>
            </View>
          )}
          {historicalData.oneMonthAgo && (
            <View style={styles.historicalItem}>
              <Text style={styles.historicalLabel}>לפני חודש:</Text>
              <Text style={[styles.historicalValue, { color: fearAndGreedService.getValueColor(historicalData.oneMonthAgo.value) }]}>
                {historicalData.oneMonthAgo.value}
              </Text>
            </View>
          )}
          {historicalData.oneYearAgo && (
            <View style={styles.historicalItem}>
              <Text style={styles.historicalLabel}>לפני שנה:</Text>
              <Text style={[styles.historicalValue, { color: fearAndGreedService.getValueColor(historicalData.oneYearAgo.value) }]}>
                {historicalData.oneYearAgo.value}
              </Text>
            </View>
          )}
            </View>
          )}
        </View>

        {/* קו הפרדה */}
        <View style={styles.divider} />

        {/* צד ימין - גייג' בלבד */}
        <View style={styles.rightSection}>
          {/* גייג' חצי עגול */}
          <View style={styles.gaugeContainer}>
        <Svg width={gaugeSize} height={gaugeSize * 0.6} viewBox={`0 0 ${gaugeSize} ${gaugeSize}`}>
          {/* רקע קשת אפור - מתחת לכל הקשתות */}
          <Path
            d={createArcPath(startAngle, endAngle, radius)}
            stroke={DesignTokens.colors.background.tertiary}
            strokeWidth={strokeWidth}
            fill="transparent"
            strokeLinecap="round"
            opacity={0.2}
          />
          
          {/* קשתות צבעוניות - עם הפרדות קטנות למניעת גלישה */}
          {segments.map((segment, index) => {
            // הפרדה קטנה מאוד (0.3 מעלות) למניעת גלישה אבל בלי רווח גדול
            const gap = 0.3;
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

          {/* מחט - מודרנית עם קצה מעוגל */}
          <Line
            x1={centerX}
            y1={centerY}
            x2={needleEndX}
            y2={needleEndY}
            stroke="#FFFFFF"
            strokeWidth={4}
            strokeLinecap="round"
          />
          
          {/* נקודת מרכז - מודרנית */}
          <Circle
            cx={centerX}
            cy={centerY}
            r={10}
            fill="#FFFFFF"
          />
          <Circle
            cx={centerX}
            cy={centerY}
            r={6}
            fill={DesignTokens.colors.background.secondary}
          />
        </Svg>
          </View>

          {/* ערך עדכני - מתחת לגייג' */}
          <View style={styles.currentValueContainer}>
            <Text style={[styles.currentValueText, { color }]}>
              {value}
            </Text>
            <Text style={[styles.currentValueDescription, { color }]}>
              {description}
            </Text>
          </View>

          {/* תוויות קטעים */}
          <View style={styles.segmentsLabels}>
            <View style={styles.segmentLabelContainer}>
              <View style={[styles.segmentColorDot, { backgroundColor: '#FF0000' }]} />
              <Text style={styles.segmentLabel}>0-25: פחד קיצוני</Text>
            </View>
            <View style={styles.segmentLabelContainer}>
              <View style={[styles.segmentColorDot, { backgroundColor: '#FF8C00' }]} />
              <Text style={styles.segmentLabel}>25-50: פחד</Text>
            </View>
            <View style={styles.segmentLabelContainer}>
              <View style={[styles.segmentColorDot, { backgroundColor: '#FFD700' }]} />
              <Text style={styles.segmentLabel}>50-75: ניטרלי</Text>
            </View>
            <View style={styles.segmentLabelContainer}>
              <View style={[styles.segmentColorDot, { backgroundColor: '#00FF00' }]} />
              <Text style={styles.segmentLabel}>75-100: תאווה</Text>
            </View>
          </View>
        </View>
      </View>

      {/* Timestamp */}
      {data.timestamp && (
        <Text style={[styles.description, { 
          fontSize: DesignTokens.typography.fontSize.xs, 
          marginTop: DesignTokens.spacing.sm, 
          textAlign: 'center',
          color: DesignTokens.colors.text.tertiary,
        }]}>
          עודכן: {new Date(data.timestamp * 1000).toLocaleString('he-IL', {
            day: 'numeric',
            month: 'short',
            hour: '2-digit',
            minute: '2-digit',
          })}
        </Text>
      )}
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

