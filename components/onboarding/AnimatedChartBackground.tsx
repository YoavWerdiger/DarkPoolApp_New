import React, { useEffect, useRef } from 'react';
import { View, Animated, Dimensions } from 'react-native';

const { width, height } = Dimensions.get('window');

// ─── Candle data (duplicated for seamless loop) ────────────────────────────
const BASE_CANDLES = [
  { body: 36, wt: 8,  wb: 6,  up: true  },
  { body: 22, wt: 12, wb: 5,  up: false },
  { body: 48, wt: 6,  wb: 10, up: true  },
  { body: 14, wt: 18, wb: 8,  up: false },
  { body: 32, wt: 7,  wb: 14, up: true  },
  { body: 52, wt: 5,  wb: 7,  up: true  },
  { body: 24, wt: 14, wb: 9,  up: false },
  { body: 40, wt: 10, wb: 12, up: true  },
  { body: 18, wt: 8,  wb: 20, up: false },
  { body: 38, wt: 12, wb: 6,  up: true  },
  { body: 28, wt: 7,  wb: 9,  up: false },
  { body: 44, wt: 5,  wb: 8,  up: true  },
  { body: 20, wt: 16, wb: 6,  up: false },
  { body: 36, wt: 9,  wb: 11, up: true  },
  { body: 16, wt: 14, wb: 7,  up: false },
  { body: 46, wt: 6,  wb: 9,  up: true  },
  { body: 30, wt: 11, wb: 13, up: false },
  { body: 42, wt: 8,  wb: 5,  up: true  },
  { body: 26, wt: 10, wb: 8,  up: false },
  { body: 50, wt: 4,  wb: 6,  up: true  },
];

// Duplicate for seamless loop
const CANDLES = [...BASE_CANDLES, ...BASE_CANDLES];

const CW = 10; // candle width
const CG = 8;  // gap
const CS = CW + CG; // candle spacing
const TOTAL_W = BASE_CANDLES.length * CS; // width of one set

interface CandleProps {
  body: number;
  wt: number;
  wb: number;
  up: boolean;
}

const Candle: React.FC<CandleProps> = ({ body, wt, wb, up }) => {
  const bodyColor = up ? 'rgba(0,230,84,0.28)' : 'rgba(248,81,73,0.20)';
  const wickColor = up ? 'rgba(0,230,84,0.15)' : 'rgba(248,81,73,0.12)';
  return (
    <View style={{ width: CS, alignItems: 'center', justifyContent: 'flex-end', height: 120 }}>
      <View style={{ alignItems: 'center' }}>
        <View style={{ width: 1.5, height: wt, backgroundColor: wickColor }} />
        <View style={{ width: CW, height: body, backgroundColor: bodyColor, borderRadius: 2 }} />
        <View style={{ width: 1.5, height: wb, backgroundColor: wickColor }} />
      </View>
    </View>
  );
};

const AnimatedChartBackground: React.FC = () => {
  const scrollX = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const anim = Animated.loop(
      Animated.timing(scrollX, {
        toValue: -TOTAL_W,
        duration: 22000,
        useNativeDriver: true,
      })
    );
    anim.start();
    return () => anim.stop();
  }, []);

  return (
    <View
      style={{
        position: 'absolute',
        bottom: height * 0.08,
        left: 0,
        right: 0,
        height: 130,
        overflow: 'hidden',
        opacity: 0.55,
      }}
      pointerEvents="none"
    >
      {/* Fade left edge */}
      <View
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          bottom: 0,
          width: 60,
          zIndex: 2,
          backgroundColor: 'transparent',
        }}
      >
        <View style={{ flex: 1, backgroundColor: 'rgba(13,26,15,0.8)' }} />
      </View>
      {/* Fade right edge */}
      <View
        style={{
          position: 'absolute',
          right: 0,
          top: 0,
          bottom: 0,
          width: 60,
          zIndex: 2,
          backgroundColor: 'rgba(13,26,15,0.8)',
        }}
      />

      <Animated.View
        style={{
          flexDirection: 'row',
          alignItems: 'flex-end',
          transform: [{ translateX: scrollX }],
        }}
      >
        {CANDLES.map((c, i) => (
          <Candle key={i} {...c} />
        ))}
      </Animated.View>
    </View>
  );
};

export default AnimatedChartBackground;
