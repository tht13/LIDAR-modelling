import * as THREE from "three";
import { Viewer } from "../core/Viewer";
import { ToolMode } from "../types";
import { ITool } from "./ITool";
import { MeasurementTool } from "./MeasurementTool";
import { InspectorTool } from "./InspectorTool";
import { ProfileTool } from "./ProfileTool";
import { AppEvents } from "../core/AppEvents";

export class ToolManager {
  public readonly measurementTool: MeasurementTool;
  public readonly inspectorTool: InspectorTool;
  public readonly profileTool: ProfileTool;
  private viewer: Viewer;
  private activeMode: ToolMode = "orbit";
  private raycaster: THREE.Raycaster;
  private mousePos = new THREE.Vector2();
  private toolRegistry = new Map<ToolMode, ITool>();

  constructor(viewer: Viewer) {
    this.viewer = viewer;
    this.raycaster = new THREE.Raycaster();
    this.raycaster.params.Points.threshold = 5.0;

    this.measurementTool = new MeasurementTool(viewer);
    this.inspectorTool = new InspectorTool(viewer);
    this.profileTool = new ProfileTool(viewer);

    this.toolRegistry.set("measure", this.measurementTool);
    this.toolRegistry.set("profile", this.profileTool);
    this.toolRegistry.set("inspect", this.inspectorTool);

    this.setupListeners();

    AppEvents.on("action:set-tool-mode", (mode: ToolMode) => {
      this.setMode(mode);
    });
  }

  public setMode(mode: ToolMode): void {
    this.activeMode = mode;
    const dom = this.viewer.renderer.domElement;

    // Toggle FirstPersonControls
    this.viewer.firstPersonControls.setEnabled(mode === "fly");

    // Clear all tools
    for (const tool of this.toolRegistry.values()) {
      tool.clear();
    }

    const currentTool = this.toolRegistry.get(mode);
    if (currentTool) {
      currentTool.activate();
      dom.style.cursor = currentTool.cursor;
      this.viewer.controls.enabled = currentTool.allowsOrbit;
    } else if (mode === "fly") {
      dom.style.cursor = "grab";
      this.viewer.controls.enabled = false;
    } else {
      dom.style.cursor = "default";
      this.viewer.controls.enabled = true;
    }
  }

  public getMode(): ToolMode {
    return this.activeMode;
  }

  private setupListeners(): void {
    const dom = this.viewer.renderer.domElement;

    dom.addEventListener("pointermove", (e: PointerEvent) => {
      const rect = dom.getBoundingClientRect();
      const width = rect.width || window.innerWidth || 1;
      const height = rect.height || window.innerHeight || 1;
      this.mousePos.x = ((e.clientX - rect.left) / width) * 2 - 1;
      this.mousePos.y = -((e.clientY - rect.top) / height) * 2 + 1;

      const intersected = this.getIntersectedPoint();

      if (this.activeMode === "inspect") {
        this.inspectorTool.handlePointerMove(intersected, e.clientX, e.clientY);
      } else {
        const activeTool = this.toolRegistry.get(this.activeMode);
        activeTool?.handlePointerMove?.(intersected, e.clientX, e.clientY);
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
        const activeTool = this.toolRegistry.get(this.activeMode);
        activeTool?.handleClick?.(intersected);
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
