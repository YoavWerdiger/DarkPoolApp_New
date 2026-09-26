import { FRAG, VERT } from '../../components/ui/auroraShader';

describe('Figma Make aurora shader', () => {
  it('keeps the original vertex quad', () => {
    expect(VERT).toContain('attribute vec2 a_pos');
    expect(VERT).toContain('gl_Position = vec4(a_pos, 0.0, 1.0)');
  });

  it('locks the fragment math and neon greens from the Make sketch', () => {
    expect(FRAG).toContain('uniform float u_time');
    expect(FRAG).toContain('uniform vec2  u_res');
    expect(FRAG).toContain('float t = u_time * 0.22');
    expect(FRAG).toContain('vec2 p = vec2(uv.x, uv.y * (u_res.y / u_res.x))');
    expect(FRAG).toContain('p.x * 3.8');
    expect(FRAG).toContain('band1 * 0.5 + band2 * 0.35 + band3 * 0.15');
    expect(FRAG).toContain('vec3 dark   = vec3(0.0,  0.04, 0.015)');
    expect(FRAG).toContain('vec3 mid    = vec3(0.0,  0.28, 0.09)');
    expect(FRAG).toContain('vec3 neon   = vec3(0.0,  0.9,  0.24)');
    expect(FRAG).toContain('col     *= 0.85');
    expect(FRAG).toContain('dot(vig, vig) * 0.38');
    expect(FRAG).toContain('gl_FragColor = vec4(col, 1.0)');
  });
});
