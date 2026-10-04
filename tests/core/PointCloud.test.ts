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
      expect(typeof x).toBe("number");
      expect(isNaN(x)).toBe(false);
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

  it("supports pointShape splatting uniform configuration", () => {
    const data = createMockParseResult(10);
    const pc = new PointCloud(data, 3.0, false, 0);
    expect(pc.material.uniforms.pointShape.value).toBe(0);

    pc.setPointShape(1);
    expect(pc.material.uniforms.pointShape.value).toBe(1);
  });

  describe("classification filtering", () => {
    it("filters points by ASPRS classification", () => {
      const data = createMockParseResult(30);
      const classes = new Uint8Array(30);
      for (let i = 0; i < 30; i++) {
        classes[i] = i < 10 ? 2 : (i < 20 ? 5 : 6); // 10 Ground, 10 Veg, 10 Building
      }
      data.classifications = classes;

      const pc = new PointCloud(data);
      expect(pc.hasClassifications()).toBe(true);
      expect(pc.getAvailableClassifications()).toEqual([2, 5, 6]);

      // Filter only Ground (class 2)
      const groundCount = pc.setClassificationFilter(new Set([2]));
      expect(groundCount).toBe(10);
      expect(pc.getActivePointCount()).toBe(10);

      // Filter Ground and Building (class 2 and 6)
      const twoClassesCount = pc.setClassificationFilter(new Set([2, 6]));
      expect(twoClassesCount).toBe(20);
      expect(pc.getActivePointCount()).toBe(20);
    });
  });

  describe("axis orientation (debug flips and swaps)", () => {
    it("flips X, Y, and Z axes accurately", () => {
      const data = createMockParseResult(5);
      // original first point: (0, 0, 0), second point: (1, 0, 0.5)
      const pc = new PointCloud(data);
      const posAttr = pc.geometry.getAttribute("position");

      expect(pc.getAxisOrientation()).toEqual({
        flipX: false,
        flipY: false,
        flipZ: false,
        swapXY: false,
        swapXZ: false
      });

      // Flip X
      pc.setAxisOrientation({ flipX: true });
      expect(posAttr.getX(1)).toBe(-1.0);
      expect(posAttr.getY(1)).toBe(0.0);
      expect(posAttr.getZ(1)).toBe(0.5);

      // Flip Z
      pc.setAxisOrientation({ flipZ: true });
      expect(posAttr.getX(1)).toBe(-1.0);
      expect(posAttr.getZ(1)).toBe(-0.5);

      // Flip Y and reset others
      pc.setAxisOrientation({ flipX: false, flipY: true, flipZ: false });
      expect(posAttr.getX(1)).toBe(1.0);
      expect(posAttr.getY(1)).toBe(-0.0);
      expect(posAttr.getZ(1)).toBe(0.5);
    });

    it("swaps X ↔ Y and X ↔ Z coordinates", () => {
      const data = createMockParseResult(5);
      // point 1: x = 1, y = 0, z = 0.5
      const pc = new PointCloud(data);
      const posAttr = pc.geometry.getAttribute("position");

      // Swap XY
      pc.setAxisOrientation({ swapXY: true });
      expect(posAttr.getX(1)).toBe(0.0);
      expect(posAttr.getY(1)).toBe(1.0);
      expect(posAttr.getZ(1)).toBe(0.5);

      // Swap XZ
      pc.setAxisOrientation({ swapXY: false, swapXZ: true });
      expect(posAttr.getX(1)).toBe(0.5);
      expect(posAttr.getY(1)).toBe(0.0);
      expect(posAttr.getZ(1)).toBe(1.0);
    });

    it("resets back to original coordinates cleanly", () => {
      const data = createMockParseResult(5);
      const pc = new PointCloud(data);
      const posAttr = pc.geometry.getAttribute("position");

      pc.setAxisOrientation({ flipX: true, flipY: true, flipZ: true, swapXY: true, swapXZ: true });
      pc.setAxisOrientation({ flipX: false, flipY: false, flipZ: false, swapXY: false, swapXZ: false });

      expect(posAttr.getX(1)).toBe(1.0);
      expect(posAttr.getY(1)).toBe(0.0);
      expect(posAttr.getZ(1)).toBe(0.5);
    });

    it("reflects active axis orientation in forEachActivePoint", () => {
      const data = createMockParseResult(2);
      const pc = new PointCloud(data);
      pc.setAxisOrientation({ flipX: true });

      const points: number[][] = [];
      pc.forEachActivePoint((x, y, z) => {
        points.push([x, y, z]);
      });

      // center was [5, 5, 25], point 1 had localX = 1 => flipped localX = -1 => realX = -(-1) + 5 = 6
      expect(points[1][0]).toBe(6);
    });
  });

  it("disposes geometry and material cleanly", () => {
    const data = createMockParseResult(10);
    const pc = new PointCloud(data);

    expect(() => pc.dispose()).not.toThrow();
  });
});
