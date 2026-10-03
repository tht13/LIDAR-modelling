import { describe, it, expect, vi } from "vitest";
import * as THREE from "three";
import { MeasurementTool } from "../../src/tools/MeasurementTool";
import { MeasureResult } from "../../src/types";

describe("MeasurementTool", () => {
  const createMockViewer = () => {
    const scene = new THREE.Scene();
    return {
      scene,
      pointCloud: null
    } as any;
  };

  it("handles two-click measurement flow and calculates 3D, horizontal, and vertical distances accurately", () => {
    const viewer = createMockViewer();
    const tool = new MeasurementTool(viewer);

    const results: MeasureResult[] = [];
    tool.onMeasurement((res) => {
      results.push(res);
    });

    // 1st click at (0, 10, 0)
    const p1 = new THREE.Vector3(0, 10, 0);
    tool.handleClick(p1);

    expect(results.length).toBe(1);
    expect(results[0].state).toBe("placed_first");

    // 2nd click at (3, 14, 4)
    // dx = 3, dy = 4, dz = 4
    // horizontal = sqrt(3^2 + 4^2) = 5
    // vertical = |14 - 10| = 4
    // 3D = sqrt(3^2 + 4^2 + 4^2) = sqrt(9 + 16 + 16) = sqrt(41) ~ 6.4031
    const p2 = new THREE.Vector3(3, 14, 4);
    tool.handleClick(p2);

    expect(results.length).toBe(2);
    expect(results[1].state).toBe("completed");
    expect(results[1].horizontalDistance).toBeCloseTo(5.0);
    expect(results[1].verticalDistance).toBeCloseTo(4.0);
    expect(results[1].distance3D).toBeCloseTo(Math.sqrt(41));
  });

  it("handles pointer move to draw live preview line", () => {
    const viewer = createMockViewer();
    const tool = new MeasurementTool(viewer);

    // No preview before 1st point
    expect(() => tool.handlePointerMove(new THREE.Vector3(1, 1, 1))).not.toThrow();

    tool.handleClick(new THREE.Vector3(0, 0, 0));
    tool.handlePointerMove(new THREE.Vector3(5, 5, 5));
    tool.handlePointerMove(new THREE.Vector3(10, 10, 10));
    // Verify no exceptions
  });

  it("resets to idle and clears visuals", () => {
    const viewer = createMockViewer();
    const tool = new MeasurementTool(viewer);

    let lastResult: MeasureResult | null = null;
    tool.onMeasurement((res) => {
      lastResult = res;
    });

    tool.handleClick(new THREE.Vector3(1, 2, 3));
    expect(lastResult?.state).toBe("placed_first");

    tool.resetToIdle();
    expect(lastResult?.state).toBe("idle");

    tool.clear();
    expect(lastResult?.state).toBe("idle");
  });
});
