import * as THREE from "three";
import { Viewer } from "../core/Viewer";
import { ToolMode } from "../types";
import { MeasurementTool } from "./MeasurementTool";
import { InspectorTool } from "./InspectorTool";
import { ProfileTool } from "./ProfileTool";

export class ToolManager {
  public readonly measurementTool: MeasurementTool;
  public readonly inspectorTool: InspectorTool;
  public readonly profileTool: ProfileTool;
  private viewer: Viewer;
  private activeMode: ToolMode = "orbit";
  private raycaster: THREE.Raycaster;
  private mousePos = new THREE.Vector2();

  constructor(viewer: Viewer) {
    this.viewer = viewer;
    this.raycaster = new THREE.Raycaster();
    this.raycaster.params.Points.threshold = 5.0;

    this.measurementTool = new MeasurementTool(viewer);
    this.inspectorTool = new InspectorTool(viewer);
    this.profileTool = new ProfileTool(viewer);

    this.setupListeners();
  }

  public setMode(mode: ToolMode): void {
    this.activeMode = mode;
    const dom = this.viewer.renderer.domElement;

    // Toggle FirstPersonControls
    this.viewer.firstPersonControls.setEnabled(mode === "fly");

    if (mode === "measure") {
      dom.style.cursor = "crosshair";
      this.viewer.controls.enabled = false;
      this.inspectorTool.clear();
      this.profileTool.clear();
      this.measurementTool.resetToIdle();
    } else if (mode === "profile") {
      dom.style.cursor = "crosshair";
      this.viewer.controls.enabled = false;
      this.inspectorTool.clear();
      this.measurementTool.clear();
      this.profileTool.resetToIdle();
    } else if (mode === "inspect") {
      dom.style.cursor = "crosshair";
      this.viewer.controls.enabled = true;
      this.measurementTool.clear();
      this.profileTool.clear();
    } else if (mode === "fly") {
      dom.style.cursor = "grab";
      this.inspectorTool.clear();
      this.measurementTool.clear();
      this.profileTool.clear();
    } else {
      dom.style.cursor = "default";
      this.viewer.controls.enabled = true;
      this.inspectorTool.clear();
      this.measurementTool.clear();
      this.profileTool.clear();
    }
  }

  public getMode(): ToolMode {
    return this.activeMode;
  }

  private setupListeners(): void {
    const dom = this.viewer.renderer.domElement;

    dom.addEventListener("pointermove", (e: PointerEvent) => {
      const rect = dom.getBoundingClientRect();
      this.mousePos.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      this.mousePos.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      const intersected = this.getIntersectedPoint();

      if (this.activeMode === "inspect") {
        this.inspectorTool.handlePointerMove(intersected, e.clientX, e.clientY);
      } else if (this.activeMode === "measure") {
        this.measurementTool.handlePointerMove(intersected);
      } else if (this.activeMode === "profile") {
        this.profileTool.handlePointerMove(intersected);
      }
    });

    dom.addEventListener("pointerleave", () => {
      if (this.activeMode === "inspect") {
        this.inspectorTool.clear();
      }
    });

    dom.addEventListener("pointerdown", (e: PointerEvent) => {
      if (e.button === 0) {
        const intersected = this.getIntersectedPoint();
        if (this.activeMode === "measure") {
          this.measurementTool.handleClick(intersected);
        } else if (this.activeMode === "profile") {
          this.profileTool.handleClick(intersected);
        }
      }
    });
  }

  private getIntersectedPoint(): THREE.Vector3 | null {
    if (!this.viewer.pointCloud) return null;
    this.raycaster.setFromCamera(this.mousePos, this.viewer.activeCamera);
    const intersects = this.raycaster.intersectObject(this.viewer.pointCloud.mesh);
    if (intersects.length > 0) {
      return intersects[0].point;
    }
    return null;
  }
}
