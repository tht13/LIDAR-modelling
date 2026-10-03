import * as THREE from "three";
import { Viewer } from "../core/Viewer";
import { InspectedPoint } from "../types";

export class InspectorTool {
  private viewer: Viewer;
  private onInspectCallback: ((point: InspectedPoint | null) => void) | null = null;

  constructor(viewer: Viewer) {
    this.viewer = viewer;
  }

  public onInspect(cb: (point: InspectedPoint | null) => void): void {
    this.onInspectCallback = cb;
  }

  public handlePointerMove(intersectedPoint: THREE.Vector3 | null, screenX: number, screenY: number): void {
    if (!this.onInspectCallback) return;

    if (intersectedPoint && this.viewer.pointCloud) {
      const center = this.viewer.pointCloud.data.center;
      const realX = intersectedPoint.x + center[0];
      const realElevation = intersectedPoint.y + center[1];
      const realNorthing = intersectedPoint.z + center[2];

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
