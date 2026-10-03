export const pointVertexShader = `
  attribute vec3 customColor;
  attribute float elevation;
  varying vec3 vColor;
  varying float vElevation;
  uniform float pointSize;
  uniform bool isOrtho;

  void main() {
    vColor = customColor;
    vElevation = elevation;
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    
    if (isOrtho) {
      gl_PointSize = pointSize * 2.0;
    } else {
      gl_PointSize = pointSize * (350.0 / -mvPosition.z);
    }
    gl_PointSize = clamp(gl_PointSize, 1.0, 80.0);
    gl_Position = projectionMatrix * mvPosition;
  }
`;

export const pointFragmentShader = `
  uniform int colorMode; // 0: RGB, 1: Turbo, 2: Viridis, 3: Plasma, 4: Rainbow, 5: Grayscale
  varying vec3 vColor;
  varying float vElevation;

  vec3 colormapTurbo(float t) {
    t = clamp(t, 0.0, 1.0);
    const vec4 kRedVec4 = vec4(0.13572138, 4.61539260, -42.66032258, 132.13108234);
    const vec4 kGreenVec4 = vec4(0.09140261, 2.19418839, 4.84296658, -14.18503333);
    const vec4 kBlueVec4 = vec4(0.10667330, 12.64194608, -60.58204836, 110.36275817);
    const vec2 kRedVec2 = vec2(-152.94239396, 59.28637943);
    const vec2 kGreenVec2 = vec2(4.27729857, 2.82956604);
    const vec2 kBlueVec2 = vec2(-89.90310912, 27.34824973);
    vec4 v4 = vec4(1.0, t, t * t, t * t * t);
    vec2 v2 = v4.zw * v4.z;
    return clamp(vec3(
      dot(v4, kRedVec4) + dot(v2, kRedVec2),
      dot(v4, kGreenVec4) + dot(v2, kGreenVec2),
      dot(v4, kBlueVec4) + dot(v2, kBlueVec2)
    ), 0.0, 1.0);
  }

  vec3 colormapViridis(float t) {
    t = clamp(t, 0.0, 1.0);
    vec3 c0 = vec3(0.267004, 0.004874, 0.329415);
    vec3 c1 = vec3(0.190631, 0.407061, 0.556089);
    vec3 c2 = vec3(0.208030, 0.718701, 0.472873);
    vec3 c3 = vec3(0.993248, 0.906157, 0.143936);
    if (t < 0.33) return mix(c0, c1, t / 0.33);
    if (t < 0.66) return mix(c1, c2, (t - 0.33) / 0.33);
    return mix(c2, c3, (t - 0.66) / 0.34);
  }

  vec3 colormapPlasma(float t) {
    t = clamp(t, 0.0, 1.0);
    vec3 c0 = vec3(0.050383, 0.029803, 0.527975);
    vec3 c1 = vec3(0.615432, 0.065949, 0.612056);
    vec3 c2 = vec3(0.941534, 0.457813, 0.279624);
    vec3 c3 = vec3(0.940015, 0.975158, 0.131326);
    if (t < 0.33) return mix(c0, c1, t / 0.33);
    if (t < 0.66) return mix(c1, c2, (t - 0.33) / 0.33);
    return mix(c2, c3, (t - 0.66) / 0.34);
  }

  vec3 colormapRainbow(float t) {
    t = clamp(t, 0.0, 1.0);
    return clamp(vec3(
      abs(t * 6.0 - 3.0) - 1.0,
      2.0 - abs(t * 6.0 - 2.0),
      2.0 - abs(t * 6.0 - 4.0)
    ), 0.0, 1.0);
  }

  void main() {
    vec2 coord = gl_PointCoord - vec2(0.5);
    float dist = length(coord);
    if (dist > 0.5) discard;
    float alpha = smoothstep(0.5, 0.42, dist);

    vec3 outColor = vColor;
    if (colorMode == 1) {
      outColor = colormapTurbo(vElevation);
    } else if (colorMode == 2) {
      outColor = colormapViridis(vElevation);
    } else if (colorMode == 3) {
      outColor = colormapPlasma(vElevation);
    } else if (colorMode == 4) {
      outColor = colormapRainbow(vElevation);
    } else if (colorMode == 5) {
      float gray = dot(vColor, vec3(0.299, 0.587, 0.114));
      outColor = vec3(gray);
    }

    gl_FragColor = vec4(outColor, alpha);
  }
`;
