import { describe, it, expect } from "vitest";
import * as THREE from "three";
import { ProfileTool, ProfileData } from "../../src/tools/ProfileTool";
import { PointCloud } from "../../src/core/PointCloud";
import { ParseResult } from "../../src/types";

describe("ProfileTool", () => {
  const createMockViewerWithPointCloud = (points: [number, number, number][]) => {
    const count = points.length;
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const elevations = new Float32Array(count);

    for (let i = 0; i < count; i++) {
      positions[i * 3] = points[i][0];
      positions[i * 3 + 1] = points[i][1]; // Elevation
      positions[i * 3 + 2] = points[i][2]; // Northing
      elevations[i] = points[i][1] / 100.0;
    }

    const data: ParseResult = {
      positions,
      colors,
      elevations,
      count,
      totalPoints: count,
      subsampled: false,
      stride: 1,
      min: [0, 0, 0],
      max: [100, 100, 100],
      center: [50, 50, 50],
      size: [100, 100, 100],
      hasRGB: false
    };

    const pointCloud = new PointCloud(data);
    const scene = new THREE.Scene();

    return {
      scene,
      pointCloud
    } as any;
  };

  it("extracts cross-section profile corridor along horizontal slice", () => {
    // Points along the line Y=Northing, Z=Elev in Three.js coordinates:
    // Remember Three.js mapping in app: X=X, Y=Elev, Z=Northing
    const testPoints: [number, number, number][] = [
      [0, 10, 0],     // Exactly on segment at origin
      [25, 20, 0],    // On segment at distance 25
      [50, 30, 0],    // On segment at distance 50
      [25, 25, 2.0],  // Offset by 2m in Northing (inside default sliceWidth of 4m)
      [25, 25, 10.0], // Offset by 10m in Northing (outside corridor -> excluded)
      [-10, 15, 0],   // Outside start boundary (proj < 0 -> excluded)
      [70, 15, 0]     // Outside end boundary (proj > 50 -> excluded)
    ];

    const viewer = createMockViewerWithPointCloud(testPoints);
    const tool = new ProfileTool(viewer);
    tool.sliceWidth = 4.0;

    let receivedData: ProfileData | null = null;
    let receivedStatus: string | undefined;

    tool.onProfile((data, status) => {
      receivedData = data;
      receivedStatus = status;
    });

    // 1st click
    tool.handleClick(new THREE.Vector3(0, 0, 0));
    expect(receivedData).toBeNull();
    expect(receivedStatus).toContain("Point 1 placed");

    // 2nd click: segment from (0,0,0) to (50,0,0) (length 50 along X axis)
    tool.handleClick(new THREE.Vector3(50, 0, 0));

    expect(receivedData).not.toBeNull();
    if (!receivedData) return;

    expect(receivedData.totalDistance).toBeCloseTo(50.0);
    // Should contain points 0, 1, 2, 3 (4 points inside corridor)
    expect(receivedData.points.length).toBe(4);

    // Points must be sorted in ascending order of distance
    for (let i = 1; i < receivedData.points.length; i++) {
      expect(receivedData.points[i].distance).toBeGreaterThanOrEqual(receivedData.points[i - 1].distance);
    }

    // Min elevation (10 local + 50 center = 60), max elevation (30 local + 50 center = 80)
    expect(receivedData.minElevation).toBeCloseTo(60.0);
    expect(receivedData.maxElevation).toBeCloseTo(80.0);
  });

  it("handles empty corridor when no points fall within sliceWidth", () => {
    const testPoints: [number, number, number][] = [
      [25, 10, 50] // 50m away from line
    ];
    const viewer = createMockViewerWithPointCloud(testPoints);
    const tool = new ProfileTool(viewer);
    tool.sliceWidth = 2.0;

    let receivedData: ProfileData | null = null;
    tool.onProfile((data) => {
      receivedData = data;
    });

    tool.handleClick(new THREE.Vector3(0, 0, 0));
    tool.handleClick(new THREE.Vector3(50, 0, 0));

    expect(receivedData).toBeNull();
  });

  it("clears profile state and visuals cleanly", () => {
    const viewer = createMockViewerWithPointCloud([[0, 0, 0]]);
    const tool = new ProfileTool(viewer);

    tool.handleClick(new THREE.Vector3(0, 0, 0));
    tool.clear();
    expect(() => tool.resetToIdle()).not.toThrow();
  });
});
