import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  ScrollView, 
  TouchableOpacity, 
  ActivityIndicator, 
  Alert,
  Dimensions,
  TextInput,
  KeyboardAvoidingView,
  Platform
} from 'react-native';
import { WebView } from 'react-native-webview';
import { LinearGradient } from 'expo-linear-gradient';
import { 
  CreditCard, 
  Shield, 
  Check, 
  ArrowLeft, 
  Crown,
  Star,
  Users,
  Lock,
  Calendar,
  User
} from 'lucide-react-native';
import { useAuth } from '../../context/AuthContext';
import { useRegistration } from '../../context/RegistrationContext';
import { paymentService, SUBSCRIPTION_PLANS } from '../../services/paymentService';

const { width } = Dimensions.get('window');

interface CreditCardCheckoutScreenProps {
  navigation: any;
  route: {
    params: {
      planId: string;
      fromRegistration?: boolean;
    };
  };
}

export default function CreditCardCheckoutScreen({ navigation, route }: CreditCardCheckoutScreenProps) {
  const { user } = useAuth();
  const { data: registrationData } = useRegistration();
  const { planId, fromRegistration = false } = route.params;
  const [loading, setLoading] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState(planId || 'monthly');
  const [showIframe, setShowIframe] = useState(false);
  const [paymentUrl, setPaymentUrl] = useState('');

  // Credit Card Form State
  const [cardNumber, setCardNumber] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [cvv, setCvv] = useState('');
  const [cardholderName, setCardholderName] = useState('');
  const [idNumber, setIdNumber] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');

  const plan = SUBSCRIPTION_PLANS[selectedPlan as keyof typeof SUBSCRIPTION_PLANS];

  useEffect(() => {
    if (planId) {
      setSelectedPlan(planId);
    }
    if (user) {
      setEmail(user.email || '');
      setCardholderName(user.display_name || '');
    } else if (fromRegistration && registrationData) {
      // במהלך הרישום, נטען פרטים מהרישום
      setEmail(registrationData.email || '');
      setCardholderName(registrationData.fullName || '');
      setPhone(registrationData.phone || '');
    }
  }, [planId, user, fromRegistration, registrationData]);

  const formatCardNumber = (text: string) => {
    // Remove all non-digits
    const cleaned = text.replace(/\D/g, '');
    // Add spaces every 4 digits
    const formatted = cleaned.replace(/(\d{4})(?=\d)/g, '$1 ');
    return formatted;
  };

  const formatExpiryDate = (text: string) => {
    // Remove all non-digits
    const cleaned = text.replace(/\D/g, '');
    // Add slash after 2 digits
    if (cleaned.length >= 2) {
      return cleaned.substring(0, 2) + '/' + cleaned.substring(2, 4);
    }
    return cleaned;
  };

  const validateForm = () => {
    if (!cardNumber || cardNumber.replace(/\s/g, '').length < 16) {
      Alert.alert('שגיאה', 'אנא הכנס מספר כרטיס אשראי תקין');
      return false;
    }
    if (!expiryDate || expiryDate.length < 5) {
      Alert.alert('שגיאה', 'אנא הכנס תאריך תפוגה תקין');
      return false;
    }
    
    // בדיקת תקינות התאריך
    const expiryWithoutSlash = expiryDate.replace('/', '');
    if (expiryWithoutSlash.length !== 4) {
      Alert.alert('שגיאה', 'תאריך התפוגה חייב להיות בפורמט MM/YY');
      return false;
    }
    
    const month = parseInt(expiryWithoutSlash.substring(0, 2));
    const year = parseInt(expiryWithoutSlash.substring(2, 4));
    
    if (month < 1 || month > 12) {
      Alert.alert('שגיאה', 'חודש לא תקין');
      return false;
    }
    
    const currentYear = new Date().getFullYear() % 100;
    if (year < currentYear) {
      Alert.alert('שגיאה', 'כרטיס האשראי פג תוקף');
      return false;
    }
    if (!cvv || cvv.length < 3) {
      Alert.alert('שגיאה', 'אנא הכנס קוד אבטחה תקין');
      return false;
    }
    if (!cardholderName.trim()) {
      Alert.alert('שגיאה', 'אנא הכנס שם בעל הכרטיס');
      return false;
    }
    if (!idNumber || idNumber.length < 9) {
      Alert.alert('שגיאה', 'אנא הכנס תעודת זהות תקינה');
      return false;
    }
    if (!email.trim()) {
      Alert.alert('שגיאה', 'אנא הכנס כתובת אימייל');
      return false;
    }
    if (!phone.trim()) {
      Alert.alert('שגיאה', 'אנא הכנס מספר טלפון');
      return false;
    }
    return true;
  };

  // טיפול בהודעות מ-iframe
  const handleWebViewMessage = (event: any) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      console.log('🔄 הודעה מ-iframe:', data);
      
      if (data.type === 'payment_success') {
        Alert.alert(
          'תשלום הושלם בהצלחה!',
          'המנוי שלך הופעל בהצלחה. תוכל להתחיל להשתמש בכל התכונות.',
          [
            {
              text: 'אישור',
              onPress: () => {
                setShowIframe(false);
                if (fromRegistration) {
                  navigation.navigate('RegistrationSummary');
                } else {
                  navigation.goBack();
                }
              }
            }
          ]
        );
      } else if (data.type === 'payment_failed') {
        Alert.alert(
          'תשלום נכשל',
          data.message || 'התשלום נכשל. אנא נסה שוב.',
          [
            {
              text: 'אישור',
              onPress: () => setShowIframe(false)
            }
          ]
        );
      } else if (data.type === 'payment_cancelled') {
        setShowIframe(false);
      }
    } catch (error) {
      console.error('❌ שגיאה בעיבוד הודעה מ-iframe:', error);
    }
  };

  const handlePayment = async () => {
    // אם זה במהלך הרישום, המשתמש עדיין לא מחובר
    if (!fromRegistration && !user) {
      Alert.alert('שגיאה', 'נדרש להתחבר למערכת');
      return;
    }

    if (!plan) {
      Alert.alert('שגיאה', 'תוכנית מנוי לא נמצאה');
      return;
    }

    if (!validateForm()) {
      return;
    }

    setLoading(true);
    
    try {
      // כל התוכניות הן בתשלום - אין תוכנית חינמית

      // הכנת נתוני התשלום
      const userId = fromRegistration ? null : (user?.id || null);

      console.log('🔄 יצירת בקשת תשלום עם LowProfile API');

      // יצירת בקשת תשלום ל-CardCom LowProfile
      const paymentResponse = await paymentService.createPaymentRequest({
        amount: plan.price,
        currency: 'ILS',
        description: `מנוי ${plan.name} - ${cardholderName}`,
        userId: userId,
        planId: selectedPlan,
        userEmail: email,
        userName: cardholderName,
        // LowProfile API לא צריך פרטי כרטיס כאן
      });

      if (paymentResponse.success && paymentResponse.paymentUrl) {
        // הצגת iframe תשלום בתוך האפליקציה
        setPaymentUrl(paymentResponse.paymentUrl);
        setShowIframe(true);
      } else {
        throw new Error(paymentResponse.error || 'שגיאה ביצירת בקשת התשלום');
      }
      
    } catch (error) {
      console.error('❌ שגיאה בתשלום:', error);
      Alert.alert(
        'שגיאה בתשלום', 
        error instanceof Error ? error.message : 'אירעה שגיאה בעיבוד התשלום. אנא נסה שוב.'
      );
    } finally {
      setLoading(false);
    }
  };

  const renderPlanIcon = (planId: string) => {
    switch (planId) {
      case 'free':
        return <Users size={24} color="#B0B0B0" />;
      case 'premium':
        return <Crown size={24} color="#00E654" />;
      case 'pro':
        return <Star size={24} color="#FFD700" />;
      default:
        return <CreditCard size={24} color="#00E654" />;
    }
  };

  const renderPlanCard = () => {
    if (!plan) return null;

    return (
      <View style={{
        backgroundColor: '#1A1A1A',
        borderRadius: 20,
        padding: 20,
        borderWidth: 2,
        borderColor: selectedPlan === 'premium' ? '#00E654' : '#333333',
        marginBottom: 20,
        shadowColor: selectedPlan === 'premium' ? '#00E654' : '#000000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 4
      }}>
        <View style={{ 
          flexDirection: 'row-reverse', 
          alignItems: 'center',
          marginBottom: 16
        }}>
          <View style={{
            width: 50,
            height: 50,
            borderRadius: 15,
            backgroundColor: selectedPlan === 'premium' ? '#00E654' : '#333333',
            alignItems: 'center',
            justifyContent: 'center',
            marginLeft: 16
          }}>
            {renderPlanIcon(selectedPlan)}
          </View>
          
          <View style={{ flex: 1 }}>
            <Text style={{ 
              color: '#FFFFFF', 
              fontSize: 20, 
              fontWeight: '700',
              writingDirection: 'rtl'
            }}>
              {plan.name}
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'baseline' }}>
              <Text style={{ 
                color: '#00E654', 
                fontSize: 24, 
                fontWeight: '800',
                writingDirection: 'rtl'
              }}>
                {plan.price === 0 ? 'חינם' : `₪${plan.price}`}
              </Text>
              <Text style={{ 
                color: '#B0B0B0', 
                fontSize: 14, 
                marginLeft: 8,
                writingDirection: 'rtl'
              }}>
                לחודש
              </Text>
            </View>
          </View>
        </View>
      </View>
    );
  };

  const renderInputField = (
    label: string,
    value: string,
    onChangeText: (text: string) => void,
    placeholder: string,
    keyboardType: any = 'default',
    maxLength?: number,
    icon?: any,
    secureTextEntry: boolean = false
  ) => (
    <View style={{ marginBottom: 16 }}>
      <Text style={{ 
        color: '#FFFFFF', 
        fontSize: 14, 
        fontWeight: '600', 
        marginBottom: 8,
        writingDirection: 'rtl'
      }}>
        {label}
      </Text>
      <View style={{
        backgroundColor: '#1A1A1A',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#333333',
        flexDirection: 'row-reverse',
        alignItems: 'center',
        paddingHorizontal: 16
      }}>
        {icon && (
          <View style={{ marginLeft: 12 }}>
            {icon}
          </View>
        )}
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor="#888888"
          style={{
            flex: 1,
            color: '#FFFFFF',
            fontSize: 16,
            paddingVertical: 16,
            fontWeight: '500',
            textAlign: 'right'
          }}
          keyboardType={keyboardType}
          maxLength={maxLength}
          autoCorrect={false}
          autoCapitalize="none"
          secureTextEntry={secureTextEntry}
        />
      </View>
    </View>
  );


  // אם מציגים iframe תשלום
  if (showIframe) {
    return (
      <View style={{ flex: 1, backgroundColor: '#000000' }}>
        {/* Header */}
        <View style={{
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: 20,
          paddingTop: 60,
          paddingBottom: 20,
          backgroundColor: '#000000'
        }}>
          <TouchableOpacity
            onPress={() => setShowIframe(false)}
            style={{
              width: 40,
              height: 40,
              borderRadius: 20,
              backgroundColor: '#1A1A1A',
              alignItems: 'center',
              justifyContent: 'center',
              marginRight: 16
            }}
          >
            <ArrowLeft size={20} color="#FFFFFF" />
          </TouchableOpacity>
          <Text style={{
            color: '#FFFFFF',
            fontSize: 20,
            fontWeight: '700',
            flex: 1,
            textAlign: 'center',
            writingDirection: 'rtl'
          }}>
            השלמת תשלום
          </Text>
        </View>

        {/* WebView */}
        <WebView
          source={{ uri: paymentUrl }}
          style={{ flex: 1 }}
          onMessage={handleWebViewMessage}
          javaScriptEnabled={true}
          domStorageEnabled={true}
          startInLoadingState={true}
          renderLoading={() => (
            <View style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: '#000000',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <ActivityIndicator color="#00E654" size="large" />
              <Text style={{
                color: '#FFFFFF',
                fontSize: 16,
                marginTop: 16,
                writingDirection: 'rtl'
              }}>
                טוען דף תשלום...
              </Text>
            </View>
          )}
        />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={{ flex: 1, backgroundColor: '#121212' }}
    >
      {/* Header */}
      <LinearGradient
        colors={['#00E65420', '#00E65410', 'transparent']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={{
          paddingTop: 60,
          paddingBottom: 20,
          paddingHorizontal: 24,
          borderBottomWidth: 1,
          borderBottomColor: 'rgba(0, 230, 84, 0.2)'
        }}
      >
        <View style={{ 
          flexDirection: 'row-reverse', 
          alignItems: 'center',
          marginBottom: 16
        }}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={{
              width: 40,
              height: 40,
              borderRadius: 20,
              backgroundColor: 'rgba(255, 255, 255, 0.1)',
              alignItems: 'center',
              justifyContent: 'center',
              marginLeft: 16
            }}
          >
            <ArrowLeft size={20} color="#FFFFFF" />
          </TouchableOpacity>
          
          <Text style={{ 
            color: '#FFFFFF', 
            fontSize: 24, 
            fontWeight: '700',
            writingDirection: 'rtl',
            flex: 1
          }}>
            פרטי תשלום
          </Text>
        </View>
      </LinearGradient>

      <ScrollView 
        style={{ flex: 1 }}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 40 }}
      >
        <View style={{ paddingHorizontal: 24, paddingTop: 24 }}>
          {/* Plan Card */}
          {renderPlanCard()}

          {/* Credit Card Section */}
          <View style={{
            backgroundColor: '#1A1A1A',
            borderRadius: 20,
            padding: 20,
            marginBottom: 20,
            borderWidth: 1,
            borderColor: '#333333'
          }}>
            <View style={{ 
              flexDirection: 'row-reverse', 
              alignItems: 'center',
              marginBottom: 20
            }}>
              <CreditCard size={20} color="#00E654" style={{ marginLeft: 8 }} />
              <Text style={{ 
                color: '#FFFFFF', 
                fontSize: 18, 
                fontWeight: '600',
                writingDirection: 'rtl'
              }}>
                פרטי כרטיס אשראי
              </Text>
            </View>

            {/* Card Number */}
            {renderInputField(
              'מספר כרטיס אשראי',
              cardNumber,
              (text) => setCardNumber(formatCardNumber(text)),
              '1234 5678 9012 3456',
              'numeric',
              19,
              <CreditCard size={16} color="#666666" />
            )}

            {/* Expiry and CVV */}
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <View style={{ flex: 1 }}>
                {renderInputField(
                  'תאריך תפוגה',
                  expiryDate,
                  (text) => setExpiryDate(formatExpiryDate(text)),
                  'MM/YY',
                  'numeric',
                  5,
                  <Calendar size={16} color="#666666" />
                )}
              </View>
              <View style={{ flex: 1 }}>
                {renderInputField(
                  'קוד אבטחה',
                  cvv,
                  setCvv,
                  '123',
                  'numeric',
                  3,
                  <Lock size={16} color="#666666" />,
                  true
                )}
              </View>
            </View>

            {/* Cardholder Name */}
            {renderInputField(
              'שם בעל הכרטיס',
              cardholderName,
              setCardholderName,
              'שם מלא כפי שמופיע על הכרטיס',
              'default',
              undefined,
              <User size={16} color="#666666" />
            )}
          </View>

          {/* Personal Details Section */}
          <View style={{
            backgroundColor: '#1A1A1A',
            borderRadius: 20,
            padding: 20,
            marginBottom: 20,
            borderWidth: 1,
            borderColor: '#333333'
          }}>
            <View style={{ 
              flexDirection: 'row-reverse', 
              alignItems: 'center',
              marginBottom: 20
            }}>
              <User size={20} color="#00E654" style={{ marginLeft: 8 }} />
              <Text style={{ 
                color: '#FFFFFF', 
                fontSize: 18, 
                fontWeight: '600',
                writingDirection: 'rtl'
              }}>
                פרטים אישיים
              </Text>
            </View>

            {/* ID Number */}
            {renderInputField(
              'תעודת זהות',
              idNumber,
              setIdNumber,
              '123456789',
              'numeric',
              9
            )}

            {/* Email */}
            {renderInputField(
              'כתובת אימייל',
              email,
              setEmail,
              'example@email.com',
              'email-address'
            )}

            {/* Phone */}
            {renderInputField(
              'מספר טלפון',
              phone,
              setPhone,
              '050-1234567',
              'phone-pad'
            )}
          </View>

          {/* Security Notice */}
          <View style={{
            backgroundColor: 'rgba(0, 230, 84, 0.1)',
            borderRadius: 16,
            padding: 16,
            marginBottom: 20,
            borderWidth: 1,
            borderColor: 'rgba(0, 230, 84, 0.3)'
          }}>
            <View style={{ 
              flexDirection: 'row-reverse', 
              alignItems: 'center',
              marginBottom: 8
            }}>
              <Shield size={16} color="#00E654" style={{ marginLeft: 8 }} />
              <Text style={{ 
                color: '#00E654', 
                fontSize: 14, 
                fontWeight: '600',
                writingDirection: 'rtl'
              }}>
                אבטחה מלאה
              </Text>
            </View>
            <Text style={{ 
              color: '#B0B0B0', 
              fontSize: 12,
              lineHeight: 18,
              writingDirection: 'rtl'
            }}>
              כל הפרטים מוצפנים ומאובטחים עם SSL 256-bit. אנחנו לא שומרים את פרטי הכרטיס שלך.
            </Text>
          </View>

          {/* Payment Summary */}
          <View style={{
            backgroundColor: '#1A1A1A',
            borderRadius: 16,
            padding: 20,
            marginBottom: 20,
            borderWidth: 1,
            borderColor: '#333333'
          }}>
            <Text style={{ 
              color: '#FFFFFF', 
              fontSize: 18, 
              fontWeight: '600', 
              marginBottom: 16,
              writingDirection: 'rtl'
            }}>
              סיכום התשלום
            </Text>
            
            <View style={{ 
              flexDirection: 'row-reverse', 
              justifyContent: 'space-between',
              marginBottom: 8
            }}>
              <Text style={{ 
                color: '#B0B0B0', 
                fontSize: 14,
                writingDirection: 'rtl'
              }}>
                {plan?.name}
              </Text>
              <Text style={{ 
                color: '#FFFFFF', 
                fontSize: 14,
                fontWeight: '600'
              }}>
                {plan?.price === 0 ? 'חינם' : `₪${plan?.price}`}
              </Text>
            </View>
            
            <View style={{ 
              flexDirection: 'row-reverse', 
              justifyContent: 'space-between',
              marginBottom: 8
            }}>
              <Text style={{ 
                color: '#B0B0B0', 
                fontSize: 14,
                writingDirection: 'rtl'
              }}>
                מע"מ
              </Text>
              <Text style={{ 
                color: '#FFFFFF', 
                fontSize: 14,
                fontWeight: '600'
              }}>
                {plan?.price === 0 ? '₪0' : `₪${Math.round((plan?.price || 0) * 0.17)}`}
              </Text>
            </View>
            
            <View style={{ 
              height: 1, 
              backgroundColor: '#333333', 
              marginVertical: 12 
            }} />
            
            <View style={{ 
              flexDirection: 'row-reverse', 
              justifyContent: 'space-between'
            }}>
              <Text style={{ 
                color: '#FFFFFF', 
                fontSize: 18,
                fontWeight: '700',
                writingDirection: 'rtl'
              }}>
                סה"כ
              </Text>
              <Text style={{ 
                color: '#00E654', 
                fontSize: 18,
                fontWeight: '700'
              }}>
                {plan?.price === 0 ? 'חינם' : `₪${Math.round((plan?.price || 0) * 1.17)}`}
              </Text>
            </View>
          </View>

          {/* Payment Button */}
          <TouchableOpacity
            onPress={handlePayment}
            disabled={loading}
            style={{
              opacity: loading ? 0.7 : 1
            }}
          >
            <LinearGradient
              colors={['#00E654', '#00B84A', '#008F3A']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={{
                borderRadius: 16,
                padding: 18,
                alignItems: 'center',
                shadowColor: '#00E654',
                shadowOffset: { width: 0, height: 6 },
                shadowOpacity: 0.4,
                shadowRadius: 12,
                elevation: 8
              }}
            >
              {loading ? (
                <ActivityIndicator color="#000000" size="small" />
              ) : (
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <CreditCard size={20} color="#000000" style={{ marginLeft: 8 }} />
                  <Text style={{ 
                    color: '#000000', 
                    fontSize: 18, 
                    fontWeight: '700',
                    writingDirection: 'rtl'
                  }}>
                    {plan?.price === 0 ? 'המשך בחינם' : 'שלם עכשיו'}
                  </Text>
                </View>
              )}
            </LinearGradient>
          </TouchableOpacity>

          {/* Terms */}
          <Text style={{ 
            color: '#666666', 
            fontSize: 12, 
            textAlign: 'center',
            marginTop: 16,
            lineHeight: 18,
            writingDirection: 'rtl'
          }}>
            בלחיצה על "שלם עכשיו" אתה מסכים לתנאי השימוש ומדיניות הפרטיות שלנו
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
