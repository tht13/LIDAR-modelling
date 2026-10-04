import { describe, it, expect } from "vitest";
import * as THREE from "three";
import { InspectorTool } from "../../src/tools/InspectorTool";
import { InspectedPoint } from "../../src/types";

describe("InspectorTool", () => {
  it("restores real-world coordinates and triggers callback with screen coordinates", () => {
    const mockViewer = {
      pointCloud: {
        data: {
          center: [500000.0, 150.0, 6000000.0]
        }
      }
    } as any;

    const tool = new InspectorTool(mockViewer);
    let inspected: InspectedPoint | null = null;

    tool.onInspect((pt) => {
      inspected = pt;
    });

    const localPoint = new THREE.Vector3(-12.5, 30.2, -45.0);
    tool.handlePointerMove(localPoint, 350, 420);

    expect(inspected).not.toBeNull();
    if (!inspected) return;

    expect(inspected.realX).toBeCloseTo(500012.5);
    expect(inspected.realElevation).toBeCloseTo(180.2);
    expect(inspected.realNorthing).toBeCloseTo(5999955.0);
    expect(inspected.screenX).toBe(350);
    expect(inspected.screenY).toBe(420);
  });

  it("handles null pointer moves and clears inspected point", () => {
    const mockViewer = { pointCloud: null } as any;
    const tool = new InspectorTool(mockViewer);

    let calledWithNull = false;
    tool.onInspect((pt) => {
      if (pt === null) calledWithNull = true;
    });

    tool.handlePointerMove(null, 100, 100);
    expect(calledWithNull).toBe(true);

    calledWithNull = false;
    tool.clear();
    expect(calledWithNull).toBe(true);
  });
});
