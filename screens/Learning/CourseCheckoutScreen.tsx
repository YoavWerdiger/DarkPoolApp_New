import i18n from '../../lib/i18n';
import { TEXT_DIR } from '../../lib/i18n/language';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, Platform, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import type { ShouldStartLoadRequest } from 'react-native-webview/lib/WebViewTypes';
import { useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator } from '../../components/ui/AppSpinner';
import { ChatSubScreenHeader } from '../../components/chat/ChatScreenShell';
import { useDesignTokens } from '../../components/ui/DesignTokens';
import UIButton from '../../components/ui/UIButton';
import UICard from '../../components/ui/UICard';
import { APP_LAYOUT } from '../../components/ui/appLayout';
import { APP_TYPE, appPhysicalRightText } from '../../components/ui/appType';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../services/supabase';
import { BUYER_PAYMENT_ERROR_HE, paymentService } from '../../services/paymentService';
import {
  fetchCourseAccess,
  purchaseCourseDbId,
  waitForCourseAccess,
} from '../../services/coursePurchaseService';
import { appQueryKeys } from '../../lib/appQueryKeys';
import { HapticFeedback } from '../../utils/hapticFeedback';

/**
 * דף תשלום לקורס בודד (קורס הלוויתנים) דרך CardCom LowProfile.
 *
 * הגישה לא נפתחת לפי ה-redirect של דף התשלום: אחרי החזרה מחכים לשרת —
 * rapid-responder מאמת את העסקה מול CardCom (GetLpResult + סכום) ורק אז כותב course_purchases.
 * המסך שואל has_course_access עד שהגישה נפתחת (או מציג «התשלום בבדיקה»).
 */

/** reCAPTCHA של CardCom נשבר עם UA של WebView — כמו ב-CreditCardCheckoutScreen */
const CARDCOM_WEBVIEW_USER_AGENT = Platform.select({
  ios: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
  android:
    'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
  default:
    'Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
});

/** redirect של smart-action (dp=ok/fail) — רק כדי לסגור את ה-WebView; ההחלטה בשרת */
function parseRedirectOutcome(url: string): 'ok' | 'fail' | null {
  if (url.startsWith('darkpoolapp://payment/success')) return 'ok';
  if (url.startsWith('darkpoolapp://payment/error')) return 'fail';
  if (!/smart-action/i.test(url)) return null;
  try {
    const u = new URL(url);
    const dp = u.searchParams.get('dp');
    if (dp === 'ok') return 'ok';
    if (dp === 'fail') return 'fail';
    const code = u.searchParams.get('ResponseCode') ?? u.searchParams.get('responsecode');
    return code === '0' ? 'ok' : code ? 'fail' : null;
  } catch {
    return null;
  }
}

const t = (k: string, o?: Record<string, unknown>) =>
  i18n.t(`auto.screens__Learning__CourseCheckoutScreen.${k}`, o);

type Phase = 'summary' | 'preparing' | 'webview' | 'verifying' | 'success' | 'pending' | 'error';

type CourseRow = { id: string; title: string; price: number; cover_url: string | null };

export function CourseCheckoutScreen({ navigation, route }: any) {
  const tokens = useDesignTokens();
  const { colors } = tokens;
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const courseId: string = purchaseCourseDbId(String(route?.params?.courseId ?? 'whales-course-1'));

  // בלי מסך סיכום — ישר לדף התשלום (מכינים אותו מיד בכניסה)
  const [phase, setPhase] = useState<Phase>('preparing');
  const autoStartedRef = useRef(false);
  const [course, setCourse] = useState<CourseRow | null>(null);
  const [courseLoaded, setCourseLoaded] = useState(false);
  const [paymentUrl, setPaymentUrl] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState('');
  const outcomeHandledRef = useRef(false);
  const pollSignal = useRef({ cancelled: false });

  useEffect(() => {
    const signal = pollSignal.current;
    return () => {
      signal.cancelled = true;
    };
  }, []);

  // פרטי הקורס + אם כבר נרכש — ישר להצלחה
  useEffect(() => {
    let alive = true;
    void (async () => {
      const { data } = await supabase
        .from('courses')
        .select('id, title, price, cover_url')
        .eq('id', courseId)
        .maybeSingle();
      if (!alive) return;
      if (data) {
        const row = data as { id: string; title: string; price: number | string; cover_url: string | null };
        setCourse({ id: row.id, title: row.title, price: Number(row.price) || 0, cover_url: row.cover_url });
      }
      try {
        if (await fetchCourseAccess(courseId)) {
          if (alive) setPhase('success');
          return;
        }
      } catch {
        /* נבדק שוב אחרי התשלום */
      }
      if (alive) setCourseLoaded(true);
    })();
    return () => {
      alive = false;
    };
  }, [courseId]);

  const grantAndFinish = useCallback(() => {
    if (user?.id) {
      void queryClient.invalidateQueries({ queryKey: appQueryKeys.courseAccess(user.id, courseId) });
      void queryClient.invalidateQueries({ queryKey: appQueryKeys.courseAccess(user.id, 'whales-course') });
    }
    void HapticFeedback.success();
    setPhase('success');
  }, [courseId, queryClient, user?.id]);

  const verifyWithServer = useCallback(async () => {
    setPhase('verifying');
    const ok = await waitForCourseAccess(courseId, { signal: pollSignal.current });
    if (pollSignal.current.cancelled) return;
    if (ok) grantAndFinish();
    else setPhase('pending');
  }, [courseId, grantAndFinish]);

  const startPayment = useCallback(async () => {
    if (!user?.id) {
      setErrorMessage(t('s1'));
      setPhase('error');
      return;
    }
    setPhase('preparing');
    try {
      const res = await paymentService.createPaymentRequest({
        amount: course?.price ?? 0,
        currency: 'ILS',
        description: course?.title ?? '',
        userId: user.id,
        planId: `course:${courseId}`,
        userEmail: (user.email || '').trim(),
        userName: (user.display_name || user.full_name || '').trim(),
        userPhone: (user.phone || '').trim() || undefined,
        isRecurring: false,
      });
      if (res.success && res.paymentUrl) {
        outcomeHandledRef.current = false;
        setPaymentUrl(res.paymentUrl);
        setPhase('webview');
        return;
      }
      // כבר נרכש (409 מהשרת) — לבדוק גישה במקום להציג שגיאה
      if (await fetchCourseAccess(courseId).catch(() => false)) {
        grantAndFinish();
        return;
      }
      throw new Error(res.error || BUYER_PAYMENT_ERROR_HE);
    } catch (e) {
      void HapticFeedback.error();
      const raw = e instanceof Error ? e.message : BUYER_PAYMENT_ERROR_HE;
      setErrorMessage(/חסומ|cardcom|terminal|api|blocked|ResponseCode/i.test(raw) ? BUYER_PAYMENT_ERROR_HE : raw);
      setPhase('error');
    }
  }, [course, courseId, grantAndFinish, user]);

  // כניסה למסך = פתיחת דף התשלום (אחרי שהקורס נטען ואין גישה קיימת)
  useEffect(() => {
    if (!courseLoaded || autoStartedRef.current) return;
    autoStartedRef.current = true;
    void startPayment();
  }, [courseLoaded, startPayment]);

  const handleRedirect = useCallback(
    (url: string): boolean => {
      const outcome = parseRedirectOutcome(url || '');
      if (!outcome) return false;
      if (outcomeHandledRef.current) return true;
      outcomeHandledRef.current = true;
      setPaymentUrl(null);
      if (outcome === 'ok') {
        void verifyWithServer();
      } else {
        void HapticFeedback.error();
        setErrorMessage(t('s2'));
        setPhase('error');
      }
      return true;
    },
    [verifyWithServer],
  );

  const goToCourse = () => {
    navigation.navigate('LearningScreen', { courseId });
  };

  const body = APP_TYPE.cardBody;
  const textStyle = { ...appPhysicalRightText, writingDirection: TEXT_DIR } as const;

  // ===== CardCom =====
  if (phase === 'webview' && paymentUrl) {
    return (
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <ChatSubScreenHeader title={t('s3')} onBack={() => navigation.goBack()} />
        <WebView
          source={{ uri: paymentUrl }}
          style={{ flex: 1, backgroundColor: 'transparent' }}
          onNavigationStateChange={(s) => {
            handleRedirect(s.url || '');
          }}
          onShouldStartLoadWithRequest={(req: ShouldStartLoadRequest) => {
            const url = req.url || '';
            if (handleRedirect(url)) return false;
            if (url.startsWith('about:') || url.startsWith('data:') || url.startsWith('blob:')) return true;
            return /^https?:\/\//i.test(url);
          }}
          javaScriptEnabled
          domStorageEnabled
          sharedCookiesEnabled
          thirdPartyCookiesEnabled
          originWhitelist={['*']}
          setSupportMultipleWindows={false}
          userAgent={CARDCOM_WEBVIEW_USER_AGENT}
          startInLoadingState
          renderLoading={() => (
            <View style={[StyleSheet.absoluteFill, styles.center, { backgroundColor: colors.background.primary }]}>
              <ActivityIndicator size="large" />
            </View>
          )}
        />
      </SafeAreaView>
    );
  }

  // ===== מצבי סטטוס (הכנה / אימות מול השרת / הצלחה / בבדיקה / שגיאה) =====
  if (phase !== 'summary') {
    const status: Record<Exclude<Phase, 'summary' | 'webview'>, { icon?: keyof typeof Ionicons.glyphMap; title: string; text: string }> = {
      preparing: { title: t('s4'), text: '' },
      verifying: { title: t('s5'), text: t('s6') },
      success: { icon: 'checkmark-circle', title: t('s7'), text: t('s8') },
      pending: { icon: 'time-outline', title: t('s9'), text: t('s10') },
      error: { icon: 'alert-circle', title: t('s11'), text: errorMessage || BUYER_PAYMENT_ERROR_HE },
    };
    const s = status[phase as Exclude<Phase, 'summary' | 'webview'>];
    const busy = phase === 'preparing' || phase === 'verifying';
    return (
      <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
        <ChatSubScreenHeader title={t('s3')} onBack={() => navigation.goBack()} />
        <View style={[styles.center, { flex: 1, paddingHorizontal: APP_LAYOUT.screenPaddingHorizontal, gap: 12 }]}>
          {busy ? (
            <ActivityIndicator size="large" />
          ) : s.icon ? (
            <Ionicons
              name={s.icon}
              size={56}
              color={phase === 'error' ? colors.danger.main : phase === 'success' ? colors.primary.main : colors.text.secondary}
            />
          ) : null}
          <Text style={[APP_TYPE.cardTitle, { color: colors.text.primary, textAlign: 'center', writingDirection: TEXT_DIR }]}>{s.title}</Text>
          {s.text ? (
            <Text style={[body, { color: colors.text.secondary, textAlign: 'center', writingDirection: TEXT_DIR }]}>{s.text}</Text>
          ) : null}
          <View style={{ width: '100%', gap: 10, marginTop: 12 }}>
            {phase === 'success' ? <UIButton title={t('s12')} variant="primary" fullWidth onPress={goToCourse} /> : null}
            {phase === 'pending' ? (
              <UIButton title={t('s13')} variant="primary" fullWidth onPress={() => void verifyWithServer()} />
            ) : null}
            {phase === 'error' ? <UIButton title={t('s14')} variant="primary" fullWidth onPress={() => void startPayment()} /> : null}
          </View>
        </View>
      </SafeAreaView>
    );
  }

  // ===== סיכום לפני תשלום =====
  return (
    <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>
      <ChatSubScreenHeader title={t('s3')} onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={{ padding: APP_LAYOUT.screenPaddingHorizontal, gap: APP_LAYOUT.cardStackGap }}>
        <UICard variant="soft" padding="lg">
          <Text style={[APP_TYPE.cardTitle, textStyle, { color: colors.text.primary }]}>{course?.title ?? ''}</Text>
          <Text style={[body, textStyle, { color: colors.text.secondary, marginTop: 6 }]}>{t('s15')}</Text>
          <View style={[styles.row, { borderTopColor: colors.border.divider }]}>
            <Text style={[body, { color: colors.text.secondary }]}>{t('s16')}</Text>
            <Text style={[APP_TYPE.cardTitle, { color: colors.text.primary, fontVariant: ['tabular-nums'] }]}>
              {course ? `₪${course.price.toLocaleString('he-IL')}` : ''}
            </Text>
          </View>
        </UICard>
        <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 8, paddingHorizontal: 4 }}>
          <Ionicons name="lock-closed-outline" size={16} color={colors.text.secondary} />
          <Text style={[APP_TYPE.caption, textStyle, { color: colors.text.secondary, flex: 1 }]}>{t('s17')}</Text>
        </View>
        <UIButton
          title={course ? t('s18', { v0: course.price.toLocaleString('he-IL') }) : t('s4')}
          variant="primary"
          fullWidth
          disabled={!course || !(course.price > 0)}
          onPress={() => void startPayment()}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center' },
  row: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginTop: 16,
    paddingTop: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
});

export default CourseCheckoutScreen;
