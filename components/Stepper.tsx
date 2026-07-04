import React from 'react';
import { View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { CheckCircle2 } from 'lucide-react-native';

interface StepperProps {
  steps: { label: string; icon?: string }[];
  currentStep: number; // 0-based
}

const Stepper: React.FC<StepperProps> = ({ steps, currentStep }) => {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginVertical: 24 }}>
      {steps.map((step, idx) => {
        const isActive = idx === currentStep;
        const isCompleted = idx < currentStep;
        return (
          <React.Fragment key={idx}>
            <View style={{ alignItems: 'center', width: 60 }}>
              <View
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 16,
                  backgroundColor: isActive ? '#00C805' : isCompleted ? '#142014' : '#0F1A0F',
                  borderWidth: isActive ? 2 : 1,
                  borderColor: isActive ? '#00C805' : isCompleted ? '#00C805' : 'rgba(255,255,255,0.15)',
                  justifyContent: 'center',
                  alignItems: 'center',
                  marginBottom: 4,
                }}
              >
                {step.icon ? (
                  <CheckCircle2 size={18} color={isActive ? '#0A0E0A' : isCompleted ? '#00C805' : '#fff'} strokeWidth={2} />
                ) : (
                  <Text style={{ color: isActive ? '#0A0E0A' : isCompleted ? '#00C805' : '#fff', fontWeight: 'bold', fontSize: 16 }}>{idx + 1}</Text>
                )}
              </View>
              <Text style={{ color: isActive ? '#00C805' : '#fff', fontSize: 12, textAlign: 'center', maxWidth: 60 }} numberOfLines={2}>
                {step.label}
              </Text>
            </View>
            {idx < steps.length - 1 && (
              <View
                style={{
                  flex: 1,
                  height: 3,
                  backgroundColor: idx < currentStep ? '#00C805' : '#1A2B1A',
                  marginHorizontal: 2,
                  marginTop: -18,
                  borderRadius: 2,
                }}
              />
            )}
          </React.Fragment>
        );
      })}
    </View>
  );
};

export default Stepper; 