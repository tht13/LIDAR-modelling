import { describe, it, expect } from "vitest";
import { pointVertexShader, pointFragmentShader } from "../../src/shaders/pointShaders";

describe("pointShaders", () => {
  it("defines vertex shader with attributes and uniforms", () => {
    expect(pointVertexShader).toContain("attribute vec3 customColor;");
    expect(pointVertexShader).toContain("attribute float elevation;");
    expect(pointVertexShader).toContain("uniform float pointSize;");
    expect(pointVertexShader).toContain("uniform bool isOrtho;");
    expect(pointVertexShader).toContain("gl_PointSize =");
    expect(pointVertexShader).toContain("gl_Position = projectionMatrix * mvPosition;");
  });

  it("defines fragment shader with colormap functions and colorMode branching", () => {
    expect(pointFragmentShader).toContain("uniform int colorMode;");
    expect(pointFragmentShader).toContain("vec3 colormapTurbo");
    expect(pointFragmentShader).toContain("vec3 colormapViridis");
    expect(pointFragmentShader).toContain("vec3 colormapPlasma");
    expect(pointFragmentShader).toContain("vec3 colormapRainbow");
    expect(pointFragmentShader).toContain("gl_FragColor = vec4(outColor, alpha);");
  });
});
