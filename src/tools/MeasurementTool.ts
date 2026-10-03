import * as THREE from "three";
import { Viewer } from "../core/Viewer";
import { MeasureResult } from "../types";
import { BaseTwoPointTool } from "./BaseTwoPointTool";

export class MeasurementTool extends BaseTwoPointTool {
  public readonly id = "measure" as const;
  private onMeasurementCallback: ((result: MeasureResult) => void) | null = null;

  constructor(viewer: Viewer) {
    super(viewer, {
      startColor: 0x00ff66, // Green
      endColor: 0xff0055,   // Red
      lineColor: 0x00ffff,  // Glowing cyan
      previewColor: 0xffea00, // Glowing yellow
      lineWidth: 6
    });
  }

  public onMeasurement(cb: (result: MeasureResult) => void): void {
    this.onMeasurementCallback = cb;
  }

  protected onFirstPointPlaced(_p1: THREE.Vector3): void {
    if (this.onMeasurementCallback) {
      this.onMeasurementCallback({ state: "placed_first" });
    }
  }

  protected onSegmentFinalized(p1: THREE.Vector3, p2: THREE.Vector3): void {
    const distance3D = p1.distanceTo(p2);
    const dx = p2.x - p1.x;
    const dz = p2.z - p1.z;
    const horizontalDistance = Math.sqrt(dx * dx + dz * dz);
    const verticalDistance = Math.abs(p2.y - p1.y);

    if (this.onMeasurementCallback) {
      this.onMeasurementCallback({
        state: "completed",
        distance3D,
        horizontalDistance,
        verticalDistance
      });
    }
  }

  protected onResetToIdle(): void {
    if (this.onMeasurementCallback) {
      this.onMeasurementCallback({ state: "idle" });
    }
  }

  protected onClear(): void {
    if (this.onMeasurementCallback) {
      this.onMeasurementCallback({ state: "idle" });
    }
  }
}
