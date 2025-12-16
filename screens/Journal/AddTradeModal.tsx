import React, { useState } from 'react';
import { View, Text, TouchableOpacity, TextInput, Alert, StyleSheet, ScrollView, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useDesignTokens } from '../../components/ui/DesignTokens';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../services/supabase';
import BottomSheet from '../../components/ui/BottomSheet/BottomSheet';

interface AddTradeModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function AddTradeModal({ visible, onClose, onSuccess }: AddTradeModalProps) {
  const DesignTokens = useDesignTokens();
  const { user } = useAuth();
  const styles = React.useMemo(() => createStyles(DesignTokens), [DesignTokens]);

  const [symbol, setSymbol] = useState('');
  const [direction, setDirection] = useState<'long' | 'short'>('long');
  const [entryPrice, setEntryPrice] = useState('');
  const [exitPrice, setExitPrice] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [entryDateText, setEntryDateText] = useState('');
  const [exitDateText, setExitDateText] = useState('');
  const [entryTimeText, setEntryTimeText] = useState('');
  const [exitTimeText, setExitTimeText] = useState('');
  const [loading, setLoading] = useState(false);

  const parseDateTime = (dateText: string, timeText: string): Date | null => {
    if (!dateText || !timeText) return null;
    
    try {
      // תמיכה בפורמטים שונים: DD/MM/YYYY או DD.MM.YYYY
      const dateParts = dateText.includes('/') 
        ? dateText.split('/')
        : dateText.split('.');
      
      if (dateParts.length !== 3) return null;
      
      const [day, month, year] = dateParts.map(Number);
      const [hour, minute] = timeText.split(':').map(Number);
      
      // ולידציה
      if (isNaN(day) || isNaN(month) || isNaN(year) || 
          isNaN(hour) || isNaN(minute) ||
          day < 1 || day > 31 || month < 1 || month > 12 ||
          hour < 0 || hour > 23 || minute < 0 || minute > 59) {
        return null;
      }
      
      return new Date(year, month - 1, day, hour, minute);
    } catch {
      return null;
    }
  };

  const handleSubmit = async () => {
    if (!user) {
      Alert.alert('שגיאה', 'יש להתחבר כדי להוסיף טרייד');
      return;
    }

    // Validation
    if (!symbol.trim()) {
      Alert.alert('שגיאה', 'יש להזין סמל');
      return;
    }
    if (!entryPrice || parseFloat(entryPrice) <= 0) {
      Alert.alert('שגיאה', 'יש להזין מחיר כניסה תקין');
      return;
    }
    if (!exitPrice || parseFloat(exitPrice) <= 0) {
      Alert.alert('שגיאה', 'יש להזין מחיר יציאה תקין');
      return;
    }
    if (!quantity || parseFloat(quantity) <= 0) {
      Alert.alert('שגיאה', 'יש להזין כמות תקינה');
      return;
    }

    // Parse dates - אם לא הוזן, נשתמש בערכי ברירת מחדל
    const finalEntryDateText = entryDateText.trim() || getDefaultDateTime().date;
    const finalEntryTimeText = entryTimeText.trim() || getDefaultDateTime().time;
    const finalExitDateText = exitDateText.trim() || getDefaultDateTime().date;
    const finalExitTimeText = exitTimeText.trim() || getDefaultDateTime().time;

    const parsedEntryDate = parseDateTime(finalEntryDateText, finalEntryTimeText);
    const parsedExitDate = parseDateTime(finalExitDateText, finalExitTimeText);

    if (!parsedEntryDate || !parsedExitDate) {
      Alert.alert('שגיאה', 'יש להזין תאריכים ושעות תקינים (פורמט: DD/MM/YYYY HH:MM)');
      return;
    }

    try {
      setLoading(true);
      const { error } = await supabase
        .from('trades')
        .insert({
          user_id: user.id,
          symbol: symbol.trim().toUpperCase(),
          direction,
          entry_price: parseFloat(entryPrice),
          exit_price: parseFloat(exitPrice),
          quantity: parseFloat(quantity),
          entry_date: parsedEntryDate.toISOString(),
          exit_date: parsedExitDate.toISOString(),
          notes: null,
        });

      if (error) throw error;

      // Reset form - ה-useEffect ידאג לזה כשהמודל נסגר
      onSuccess();
    } catch (error: any) {
      console.error('Error adding trade:', error);
      Alert.alert('שגיאה', 'לא ניתן להוסיף את הטרייד');
    } finally {
      setLoading(false);
    }
  };

  const getDefaultDateTime = () => {
    const now = new Date();
    // פורמט: DD/MM/YYYY
    const day = String(now.getDate()).padStart(2, '0');
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const year = now.getFullYear();
    const date = `${day}/${month}/${year}`;
    
    // פורמט: HH:MM
    const hour = String(now.getHours()).padStart(2, '0');
    const minute = String(now.getMinutes()).padStart(2, '0');
    const time = `${hour}:${minute}`;
    
    return { date, time };
  };

  React.useEffect(() => {
    if (visible) {
      const defaultDateTime = getDefaultDateTime();
      // תמיד נגדיר ערכי ברירת מחדל כשהמודל נפתח
      setEntryDateText(defaultDateTime.date);
      setExitDateText(defaultDateTime.date);
      setEntryTimeText(defaultDateTime.time);
      setExitTimeText(defaultDateTime.time);
    } else {
      // איפוס כשסוגרים
      setSymbol('');
      setEntryPrice('');
      setExitPrice('');
      setQuantity('1');
      setEntryDateText('');
      setExitDateText('');
      setEntryTimeText('');
      setExitTimeText('');
    }
  }, [visible]);

  return (
    <BottomSheet
      isOpen={visible}
      onClose={onClose}
      snapPoints={[0.9]}
      showHandle={true}
      enablePanDownToClose={true}
      backdropOpacity={0.5}
    >
      {/* Header */}
      <View style={styles.modalHeader}>
        <Text style={styles.modalTitle}>הוסף טרייד חדש</Text>
        <TouchableOpacity onPress={onClose} style={styles.closeButton}>
          <Ionicons name="close" size={24} color={DesignTokens.colors.text.primary} />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 20 }}>
            {/* Symbol */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>סמל *</Text>
              <TextInput
                style={styles.input}
                value={symbol}
                onChangeText={setSymbol}
                placeholder="AAPL, TSLA, וכו'"
                placeholderTextColor={DesignTokens.colors.text.tertiary}
                autoCapitalize="characters"
              />
            </View>

            {/* Direction */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>כיוון *</Text>
              <View style={styles.directionButtons}>
                <TouchableOpacity
                  style={[
                    styles.directionButton,
                    direction === 'long' 
                      ? { backgroundColor: `${DesignTokens.colors.primary.main}20` }
                      : { backgroundColor: DesignTokens.colors.background.tertiary }
                  ]}
                  onPress={() => setDirection('long')}
                >
                  <Text style={[
                    styles.directionButtonText,
                    direction === 'long' 
                      ? { color: DesignTokens.colors.primary.main }
                      : { color: DesignTokens.colors.text.secondary }
                  ]}>
                    Long
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.directionButton,
                    direction === 'short' 
                      ? { backgroundColor: `${DesignTokens.colors.text.danger}20` }
                      : { backgroundColor: DesignTokens.colors.background.tertiary }
                  ]}
                  onPress={() => setDirection('short')}
                >
                  <Text style={[
                    styles.directionButtonText,
                    direction === 'short' 
                      ? { color: DesignTokens.colors.text.danger }
                      : { color: DesignTokens.colors.text.secondary }
                  ]}>
                    Short
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Entry Price */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>מחיר כניסה *</Text>
              <TextInput
                style={styles.input}
                value={entryPrice}
                onChangeText={setEntryPrice}
                placeholder="0.00"
                placeholderTextColor={DesignTokens.colors.text.tertiary}
                keyboardType="decimal-pad"
              />
            </View>

            {/* Exit Price */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>מחיר יציאה *</Text>
              <TextInput
                style={styles.input}
                value={exitPrice}
                onChangeText={setExitPrice}
                placeholder="0.00"
                placeholderTextColor={DesignTokens.colors.text.tertiary}
                keyboardType="decimal-pad"
              />
            </View>

            {/* Quantity */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>כמות *</Text>
              <TextInput
                style={styles.input}
                value={quantity}
                onChangeText={setQuantity}
                placeholder="1"
                placeholderTextColor={DesignTokens.colors.text.tertiary}
                keyboardType="decimal-pad"
              />
            </View>

            {/* Entry Date */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>תאריך כניסה * (DD/MM/YYYY)</Text>
              <TextInput
                style={styles.input}
                value={entryDateText}
                onChangeText={setEntryDateText}
                placeholder="01/01/2024"
                placeholderTextColor={DesignTokens.colors.text.tertiary}
              />
            </View>

            {/* Entry Time */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>שעת כניסה * (HH:MM)</Text>
              <TextInput
                style={styles.input}
                value={entryTimeText}
                onChangeText={setEntryTimeText}
                placeholder="09:30"
                placeholderTextColor={DesignTokens.colors.text.tertiary}
              />
            </View>

            {/* Exit Date */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>תאריך יציאה * (DD/MM/YYYY)</Text>
              <TextInput
                style={styles.input}
                value={exitDateText}
                onChangeText={setExitDateText}
                placeholder="01/01/2024"
                placeholderTextColor={DesignTokens.colors.text.tertiary}
              />
            </View>

            {/* Exit Time */}
            <View style={styles.inputGroup}>
              <Text style={styles.label}>שעת יציאה * (HH:MM)</Text>
              <TextInput
                style={styles.input}
                value={exitTimeText}
                onChangeText={setExitTimeText}
                placeholder="16:00"
                placeholderTextColor={DesignTokens.colors.text.tertiary}
              />
            </View>

      </ScrollView>

      {/* Footer */}
      <View style={styles.modalFooter}>
        <TouchableOpacity
          style={[styles.submitButton, loading && styles.submitButtonDisabled]}
          onPress={handleSubmit}
          disabled={loading}
        >
          {loading ? (
            <Text style={styles.submitButtonText}>מוסיף...</Text>
          ) : (
            <Text style={styles.submitButtonText}>הוסף טרייד</Text>
          )}
        </TouchableOpacity>
      </View>
    </BottomSheet>
  );
}

const createStyles = (tokens: ReturnType<typeof useDesignTokens>) => StyleSheet.create({
  modalHeader: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: tokens.spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: tokens.colors.border.primary,
  },
  modalTitle: {
    fontSize: tokens.typography.fontSize.xl,
    fontWeight: tokens.typography.fontWeight.bold,
    color: tokens.colors.text.primary,
    textAlign: 'right',
  },
  closeButton: {
    padding: tokens.spacing.xs,
  },
  modalBody: {
    padding: tokens.spacing.lg,
  },
  inputGroup: {
    marginBottom: tokens.spacing.md,
  },
  label: {
    fontSize: tokens.typography.fontSize.sm,
    fontWeight: tokens.typography.fontWeight.medium,
    color: tokens.colors.text.secondary,
    marginBottom: tokens.spacing.xs,
    textAlign: 'right',
  },
  input: {
    backgroundColor: tokens.colors.background.tertiary,
    borderRadius: tokens.borderRadius.md,
    padding: tokens.spacing.md,
    fontSize: tokens.typography.fontSize.base,
    color: tokens.colors.text.primary,
    textAlign: 'right',
  },
  textArea: {
    minHeight: 100,
    paddingTop: tokens.spacing.md,
  },
  directionButtons: {
    flexDirection: 'row',
    gap: tokens.spacing.sm,
  },
  directionButton: {
    flex: 1,
    padding: tokens.spacing.md,
    borderRadius: tokens.borderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  directionButtonText: {
    fontSize: tokens.typography.fontSize.base,
    fontWeight: tokens.typography.fontWeight.bold,
  },
  dateButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: tokens.colors.background.tertiary,
    borderRadius: tokens.borderRadius.md,
    padding: tokens.spacing.md,
  },
  dateButtonText: {
    fontSize: tokens.typography.fontSize.base,
    color: tokens.colors.text.primary,
    textAlign: 'right',
  },
  modalFooter: {
    padding: tokens.spacing.lg,
    borderTopWidth: 1,
    borderTopColor: tokens.colors.border.primary,
  },
  submitButton: {
    backgroundColor: tokens.colors.primary.main,
    borderRadius: tokens.borderRadius.md,
    padding: tokens.spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitButtonDisabled: {
    opacity: 0.5,
  },
  submitButtonText: {
    fontSize: tokens.typography.fontSize.base,
    fontWeight: tokens.typography.fontWeight.bold,
    color: tokens.colors.text.primary,
    textAlign: 'right',
  },
});

