import React, { memo, useCallback, useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  AppState,
  PixelRatio,
  StyleSheet,
  View,
  type AppStateStatus,
  type LayoutChangeEvent,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { GLView, isExpoGlAvailable } from '../../lib/expoGlSafe';
import {
  AURORA_BASE,
  AURORA_LAYER_OPACITY,
  AuroraHostContext,
  DarkGreenAuroraBackground,
} from './DarkGreenAuroraBackground';
import { SoftUI } from './DesignTokens';
import { useTheme } from '../../context/ThemeContext';
import { FRAG, VERT } from './auroraShader';
import {
  AURORA_FRAME_MS,
  isAuroraPaused,
  subscribeAuroraRuntime,
} from './auroraRuntime';

type Props = {
  style?: StyleProp<ViewStyle>;
  /** false / reduce-motion = פריים אחד עם u_time קבוע, בלי RAF */
  animated?: boolean;
};

type GL = {
  VERTEX_SHADER: number;
  FRAGMENT_SHADER: number;
  ARRAY_BUFFER: number;
  STATIC_DRAW: number;
  FLOAT: number;
  TRIANGLE_STRIP: number;
  COMPILE_STATUS: number;
  LINK_STATUS: number;
  drawingBufferWidth: number;
  drawingBufferHeight: number;
  viewport: (x: number, y: number, w: number, h: number) => void;
  createShader: (type: number) => unknown;
  shaderSource: (shader: unknown, src: string) => void;
  compileShader: (shader: unknown) => void;
  getShaderParameter: (shader: unknown, pname: number) => unknown;
  getShaderInfoLog: (shader: unknown) => string | null;
  deleteShader: (shader: unknown) => void;
  createProgram: () => unknown;
  attachShader: (program: unknown, shader: unknown) => void;
  linkProgram: (program: unknown) => void;
  getProgramParameter: (program: unknown, pname: number) => unknown;
  getProgramInfoLog: (program: unknown) => string | null;
  useProgram: (program: unknown) => void;
  createBuffer: () => unknown;
  bindBuffer: (target: number, buffer: unknown) => void;
  bufferData: (target: number, data: ArrayBufferView, usage: number) => void;
  getAttribLocation: (program: unknown, name: string) => number;
  enableVertexAttribArray: (index: number) => void;
  vertexAttribPointer: (
    index: number,
    size: number,
    type: number,
    normalized: boolean,
    stride: number,
    offset: number,
  ) => void;
  getUniformLocation: (program: unknown, name: string) => unknown;
  uniform1f: (location: unknown, x: number) => void;
  uniform2f: (location: unknown, x: number, y: number) => void;
  drawArrays: (mode: number, first: number, count: number) => void;
  flush: () => void;
  endFrameEXP: () => void;
};

type GlSession = {
  gl: GL;
  uTime: unknown;
  uRes: unknown;
  startedAt: number;
};

/** GLES vertex shaders need an explicit precision; does not change the fragment math. */
const VERT_SRC = `precision highp float;${VERT}`;

const STATIC_U_TIME = 0;
const QUAD = new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]);

/**
 * סקייל הקנבס בפיקסלי מכשיר מלאים — לא חצי רזולוציה לביצועים.
 * על מסכים חדים (≥2x) תמיד DPR מלא; לעולם לא 0.5×.
 */
export function auroraCanvasPixelRatio(dpr: number = PixelRatio.get()): number {
  if (!Number.isFinite(dpr) || dpr <= 0) return 2;
  return dpr >= 2 ? dpr : Math.max(1, dpr);
}

function compileShader(gl: GL, type: number, src: string): unknown {
  const shader = gl.createShader(type);
  if (!shader) throw new Error('createShader failed');
  gl.shaderSource(shader, src);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(shader) ?? 'shader compile failed';
    gl.deleteShader(shader);
    throw new Error(log);
  }
  return shader;
}

function initGL(gl: GL): Pick<GlSession, 'uTime' | 'uRes'> {
  const vs = compileShader(gl, gl.VERTEX_SHADER, VERT_SRC);
  const fs = compileShader(gl, gl.FRAGMENT_SHADER, FRAG);
  const program = gl.createProgram();
  if (!program) throw new Error('createProgram failed');
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    throw new Error(gl.getProgramInfoLog(program) ?? 'program link failed');
  }
  gl.useProgram(program);

  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, QUAD, gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(program, 'a_pos');
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

  return {
    uTime: gl.getUniformLocation(program, 'u_time'),
    uRes: gl.getUniformLocation(program, 'u_res'),
  };
}

function paint(session: GlSession, timeSec: number, layoutPx: { w: number; h: number }) {
  const { gl, uTime, uRes } = session;
  const w = gl.drawingBufferWidth || layoutPx.w;
  const h = gl.drawingBufferHeight || layoutPx.h;
  if (!(w > 0 && h > 0)) return;
  gl.viewport(0, 0, w, h);
  gl.uniform1f(uTime, timeSec);
  gl.uniform2f(uRes, w, h);
  gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  gl.flush();
  gl.endFrameEXP();
}

/**
 * רקע האורורה מ-Figma Make — WebGL shader אמיתי (expo-gl).
 * מופע אחד בשורש דרך AuroraHost; בלי מסגרת אייפון / סטטוס בר / home indicator.
 */
export const GradientBackground = memo(function GradientBackground({
  style,
  animated = true,
}: Props) {
  const { isDarkMode, theme } = useTheme();
  const [reduceMotion, setReduceMotion] = useState(false);
  const [glFailed, setGlFailed] = useState(!isExpoGlAvailable || !GLView);
  const layoutPxRef = useRef({ w: 0, h: 0 });
  const sessionRef = useRef<GlSession | null>(null);
  const rafRef = useRef<number | null>(null);
  const lastFrameAtRef = useRef(0);
  const aliveRef = useRef(true);
  const appActiveRef = useRef(AppState.currentState === 'active');
  const pausedRef = useRef(isAuroraPaused());
  const animatedRef = useRef(animated);
  const reduceMotionRef = useRef(reduceMotion);
  animatedRef.current = animated;
  reduceMotionRef.current = reduceMotion;

  const stopLoop = useCallback(() => {
    if (rafRef.current != null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  }, []);

  const motionFrozen = useCallback(
    () => reduceMotionRef.current || !animatedRef.current,
    [],
  );

  const drawNow = useCallback((timeSec: number) => {
    const session = sessionRef.current;
    if (!session) return;
    try {
      paint(session, timeSec, layoutPxRef.current);
    } catch {
      setGlFailed(true);
    }
  }, []);

  const startLoop = useCallback(() => {
    if (
      !aliveRef.current ||
      motionFrozen() ||
      !appActiveRef.current ||
      pausedRef.current ||
      !sessionRef.current
    ) {
      return;
    }
    if (rafRef.current != null) return;
    const tick = (now: number) => {
      rafRef.current = null;
      if (!aliveRef.current || motionFrozen() || !appActiveRef.current || pausedRef.current) {
        return;
      }
      const session = sessionRef.current;
      if (!session) return;
      if (now - lastFrameAtRef.current < AURORA_FRAME_MS) {
        rafRef.current = requestAnimationFrame(tick);
        return;
      }
      lastFrameAtRef.current = now;
      drawNow((Date.now() - session.startedAt) / 1000);
      if (!motionFrozen() && appActiveRef.current && !pausedRef.current) {
        rafRef.current = requestAnimationFrame(tick);
      }
    };
    rafRef.current = requestAnimationFrame(tick);
  }, [drawNow, motionFrozen]);

  useEffect(() => {
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
      stopLoop();
      sessionRef.current = null;
    };
  }, [stopLoop]);

  useEffect(() => {
    let alive = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((value) => {
        if (alive) setReduceMotion(value);
      })
      .catch(() => {});
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => {
      alive = false;
      sub.remove();
    };
  }, []);

  useEffect(() => {
    const onChange = (next: AppStateStatus) => {
      const active = next === 'active';
      appActiveRef.current = active;
      if (!active) {
        stopLoop();
        return;
      }
      if (motionFrozen()) {
        drawNow(STATIC_U_TIME);
      } else {
        startLoop();
      }
    };
    const sub = AppState.addEventListener('change', onChange);
    return () => sub.remove();
  }, [drawNow, motionFrozen, startLoop, stopLoop]);

  useEffect(() => {
    const syncPause = () => {
      const paused = isAuroraPaused();
      pausedRef.current = paused;
      if (paused) {
        stopLoop();
        return;
      }
      if (motionFrozen()) {
        drawNow(STATIC_U_TIME);
        return;
      }
      startLoop();
    };
    syncPause();
    return subscribeAuroraRuntime(syncPause);
  }, [drawNow, motionFrozen, startLoop, stopLoop]);

  useEffect(() => {
    if (motionFrozen() || pausedRef.current) {
      stopLoop();
      drawNow(STATIC_U_TIME);
      return;
    }
    startLoop();
  }, [animated, reduceMotion, drawNow, motionFrozen, startLoop, stopLoop]);

  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    if (!(width > 0 && height > 0)) return;
    const ratio = auroraCanvasPixelRatio();
    layoutPxRef.current = { w: Math.round(width * ratio), h: Math.round(height * ratio) };
  };

  const onContextCreate = useCallback(
    (gl: GL) => {
      try {
        stopLoop();
        const { uTime, uRes } = initGL(gl);
        const session: GlSession = { gl, uTime, uRes, startedAt: Date.now() };
        sessionRef.current = session;
        const frozen = motionFrozen();
        paint(session, frozen ? STATIC_U_TIME : 0, layoutPxRef.current);
        if (!frozen && appActiveRef.current) startLoop();
      } catch {
        setGlFailed(true);
      }
    },
    [motionFrozen, startLoop, stopLoop],
  );

  // מצב בהיר: קנבס בהיר בלבד — אורורה כהה שוברת ניגודיות עם טוקני דיו כהה.
  if (!isDarkMode) {
    return (
      <View
        pointerEvents="none"
        style={[StyleSheet.absoluteFill, { backgroundColor: theme.background }, style]}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      />
    );
  }

  if (glFailed || !GLView) {
    return <DarkGreenAuroraBackground style={style} animated={animated} />;
  }

  const ExpoGLView = GLView;

  return (
    <View
      pointerEvents="none"
      onLayout={onLayout}
      style={[styles.root, style]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <View
        pointerEvents="none"
        shouldRasterizeIOS={false}
        renderToHardwareTextureAndroid={false}
        style={styles.glDim}
      >
        <ExpoGLView
          collapsable={false}
          pointerEvents="none"
          shouldRasterizeIOS={false}
          renderToHardwareTextureAndroid={false}
          msaaSamples={4}
          style={styles.gl}
          onContextCreate={onContextCreate}
        />
      </View>
    </View>
  );
});

/** שכבת קנבס אחת לשורש — כהה SoftUI.canvas, בהיר theme.background. */
export function AuroraHost({ children }: { children: React.ReactNode }) {
  const { isDarkMode, theme } = useTheme();
  const canvas = isDarkMode ? SoftUI.canvas : theme.background;
  return (
    <View style={[styles.host, { backgroundColor: canvas }]} pointerEvents="box-none">
      <View
        pointerEvents="none"
        style={[StyleSheet.absoluteFill, styles.canvasHost, { backgroundColor: canvas }]}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      />
      <AuroraHostContext.Provider value={true}>
        <View style={styles.hostChildren} pointerEvents="box-none">
          {children}
        </View>
      </AuroraHostContext.Provider>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    ...StyleSheet.absoluteFill,
    width: '100%',
    height: '100%',
    overflow: 'hidden',
    backgroundColor: AURORA_BASE,
  },
  /** Dim around the canvas — not on GLView itself (that rasterizes at 1×). */
  glDim: {
    ...StyleSheet.absoluteFill,
    width: '100%',
    height: '100%',
    opacity: AURORA_LAYER_OPACITY,
  },
  gl: {
    ...StyleSheet.absoluteFill,
    width: '100%',
    height: '100%',
  },
  host: {
    flex: 1,
    backgroundColor: SoftUI.canvas,
  },
  canvasHost: {
    backgroundColor: SoftUI.canvas,
  },
  hostChildren: {
    flex: 1,
  },
});
