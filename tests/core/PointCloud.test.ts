import { describe, it, expect } from "vitest";
import { PointCloud } from "../../src/core/PointCloud";
import { ColorMode, ParseResult } from "../../src/types";

describe("PointCloud", () => {
  const createMockParseResult = (count = 100): ParseResult => {
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const elevations = new Float32Array(count);

    for (let i = 0; i < count; i++) {
      positions[i * 3] = (i % 10) * 1.0;
      positions[i * 3 + 1] = Math.floor(i / 10) * 1.0;
      positions[i * 3 + 2] = (i * 0.5);

      colors[i * 3] = 0.5;
      colors[i * 3 + 1] = 0.5;
      colors[i * 3 + 2] = 0.5;

      elevations[i] = i / count;
    }

    return {
      positions,
      colors,
      elevations,
      count,
      totalPoints: count,
      subsampled: false,
      stride: 1,
      min: [0, 0, 0],
      max: [10, 10, 50],
      center: [5, 5, 25],
      size: [10, 10, 50],
      hasRGB: true
    };
  };

  it("initializes BufferGeometry and ShaderMaterial with attributes", () => {
    const data = createMockParseResult(50);
    const pc = new PointCloud(data, 4.0, false);

    expect(pc.geometry).toBeDefined();
    expect(pc.geometry.getAttribute("position")).toBeDefined();
    expect(pc.geometry.getAttribute("customColor")).toBeDefined();
    expect(pc.geometry.getAttribute("elevation")).toBeDefined();

    expect(pc.material.uniforms.pointSize.value).toBe(4.0);
    expect(pc.material.uniforms.isOrtho.value).toBe(false);
    expect(pc.material.uniforms.colorMode.value).toBe(ColorMode.RGB);

    expect(pc.getActivePointCount()).toBe(50);
    expect(pc.getBoundingSphere()).not.toBeNull();
  });

  it("updates point size, color mode, and ortho uniforms", () => {
    const data = createMockParseResult(20);
    const pc = new PointCloud(data, 2.0, false);

    pc.setPointSize(8.5);
    expect(pc.material.uniforms.pointSize.value).toBe(8.5);

    pc.setColorMode(ColorMode.Viridis);
    expect(pc.material.uniforms.colorMode.value).toBe(ColorMode.Viridis);

    pc.setIsOrtho(true);
    expect(pc.material.uniforms.isOrtho.value).toBe(true);
  });

  describe("applyVoxelGrid", () => {
    it("filters dense points and reduces active count", () => {
      const data = createMockParseResult(100);
      const pc = new PointCloud(data);

      const filteredCount = pc.applyVoxelGrid(3.0);
      expect(filteredCount).toBeLessThan(100);
      expect(filteredCount).toBeGreaterThan(0);
      expect(pc.getActivePointCount()).toBe(filteredCount);
      expect(pc.geometry.getIndex()).not.toBeNull();
    });

    it("resets to full point cloud when voxelSize <= 0", () => {
      const data = createMockParseResult(100);
      const pc = new PointCloud(data);

      pc.applyVoxelGrid(5.0);
      expect(pc.getActivePointCount()).toBeLessThan(100);

      const resetCount = pc.applyVoxelGrid(0);
      expect(resetCount).toBe(100);
      expect(pc.getActivePointCount()).toBe(100);
      expect(pc.geometry.getIndex()).toBeNull();
    });
  });

  describe("applyDecimation", () => {
    it("subsamples points according to specified fraction", () => {
      const data = createMockParseResult(100);
      const pc = new PointCloud(data);

      const countHalf = pc.applyDecimation(0.5);
      expect(countHalf).toBeCloseTo(50, -1);
      expect(pc.getActivePointCount()).toBe(countHalf);

      const countTenth = pc.applyDecimation(0.1);
      expect(countTenth).toBeCloseTo(10, -1);
    });

    it("resets to full points when decimation ratio >= 0.999", () => {
      const data = createMockParseResult(100);
      const pc = new PointCloud(data);

      pc.applyDecimation(0.2);
      expect(pc.getActivePointCount()).toBeLessThan(100);

      const fullCount = pc.applyDecimation(1.0);
      expect(fullCount).toBe(100);
      expect(pc.getActivePointCount()).toBe(100);
      expect(pc.geometry.getIndex()).toBeNull();
    });
  });

  it("iterates through active points with forEachActivePoint", () => {
    const data = createMockParseResult(10);
    const pc = new PointCloud(data);

    let iterated = 0;
    const count = pc.forEachActivePoint((x, y, z, r, g, b, idx) => {
      iterated++;
      expect(idx).toBeDefined();
      expect(x).toBeGreaterThan(0); // Translated by center
    });

    expect(count).toBe(10);
    expect(iterated).toBe(10);

    // Now test with decimation filter
    pc.applyDecimation(0.5);
    let filteredIterated = 0;
    const filteredCount = pc.forEachActivePoint(() => {
      filteredIterated++;
    }, true);

    expect(filteredCount).toBe(5);
    expect(filteredIterated).toBe(5);
  });

  it("disposes geometry and material cleanly", () => {
    const data = createMockParseResult(10);
    const pc = new PointCloud(data);

    expect(() => pc.dispose()).not.toThrow();
  });
});
