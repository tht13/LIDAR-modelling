import * as THREE from "three";
import { Viewer } from "../core/Viewer";
import { InspectedPoint } from "../types";
import { GeoCoordinates } from "../utils/GeoCoordinates";
import { ITool } from "./ITool";

export class InspectorTool implements ITool {
  public readonly id = "inspect" as const;
  public readonly cursor = "crosshair";
  public readonly allowsOrbit = true;

  private viewer: Viewer;
  private onInspectCallback: ((point: InspectedPoint | null) => void) | null = null;

  constructor(viewer: Viewer) {
    this.viewer = viewer;
  }

  public activate(): void {
    this.clear();
  }

  public deactivate(): void {
    this.clear();
  }

  public onInspect(cb: (point: InspectedPoint | null) => void): void {
    this.onInspectCallback = cb;
  }

  public handlePointerMove(intersectedPoint: THREE.Vector3 | null, screenX: number, screenY: number): void {
    if (!this.onInspectCallback) return;

    if (intersectedPoint && this.viewer.pointCloud) {
      const center = this.viewer.pointCloud.data.center;
      const [realX, realNorthing, realElevation] = GeoCoordinates.toWorld(
        intersectedPoint.x,
        intersectedPoint.y,
        intersectedPoint.z,
        center
      );

      this.onInspectCallback({
        realX,
        realNorthing,
        realElevation,
        screenX,
        screenY
      });
    } else {
      this.onInspectCallback(null);
    }
  }

  public clear(): void {
    if (this.onInspectCallback) {
      this.onInspectCallback(null);
    }
  }
}
