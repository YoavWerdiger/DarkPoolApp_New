/** Fullscreen quad — same as the Figma Make WebGL sketch. */
export const VERT = `
  attribute vec2 a_pos;
  void main() { gl_Position = vec4(a_pos, 0.0, 1.0); }
`;

/**
 * Fragment shader copied verbatim from the Figma Make WebGL sketch.
 * Do not change the math or colors.
 */
export const FRAG = `
  precision highp float;
  uniform float u_time;
  uniform vec2  u_res;

  void main() {
    vec2 uv = gl_FragCoord.xy / u_res;
    float t = u_time * 0.22;

    vec2 p = vec2(uv.x, uv.y * (u_res.y / u_res.x));

    float band1 = sin(
      p.x * 3.8
      - p.y * 2.1
      + sin(p.y * 4.5 + t * 1.1) * 0.7
      + sin(p.x * 2.2 + t * 0.7) * 0.5
      + t * 1.4
    );

    float band2 = sin(
      p.x * 2.4
      + p.y * 1.6
      + sin(p.x * 5.0 - t * 0.8) * 0.6
      + sin(p.y * 3.2 + t * 0.5) * 0.4
      - t * 0.9
    );

    float band3 = sin(
      p.x * 6.0
      - p.y * 1.2
      + sin(p.y * 2.8 + t * 1.6) * 0.9
      + t * 2.0
    );

    float f = band1 * 0.5 + band2 * 0.35 + band3 * 0.15;
    f = f * 0.5 + 0.5;

    float g = smoothstep(0.1, 0.85, f);
    g = pow(g, 1.5);

    vec3 dark   = vec3(0.0,  0.04, 0.015);
    vec3 mid    = vec3(0.0,  0.28, 0.09);
    vec3 neon   = vec3(0.0,  0.9,  0.24);

    vec3 col = mix(dark, mid,  smoothstep(0.0, 0.45, g));
    col      = mix(col,  neon, smoothstep(0.4, 1.0,  g));
    col     *= 0.85;

    vec2 vig = uv * 2.0 - 1.0;
    float v  = 1.0 - dot(vig, vig) * 0.38;
    col *= clamp(v, 0.0, 1.0);

    gl_FragColor = vec4(col, 1.0);
  }
`;
