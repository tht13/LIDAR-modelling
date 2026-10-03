import * as THREE from "three";
import { Line2 } from "three/examples/jsm/lines/Line2.js";
import { LineGeometry } from "three/examples/jsm/lines/LineGeometry.js";
import { LineMaterial } from "three/examples/jsm/lines/LineMaterial.js";
import { Viewer } from "../core/Viewer";
import { ToolMode } from "../types";
import { ITool } from "./ITool";

export interface TwoPointToolStyle {
  startColor: number;
  endColor: number;
  lineColor: number;
  previewColor: number;
  lineWidth: number;
}

export abstract class BaseTwoPointTool implements ITool {
  public abstract readonly id: ToolMode;
  public readonly cursor: string = "crosshair";
  public readonly allowsOrbit: boolean = false;

  protected viewer: Viewer;
  protected group: THREE.Group;
  protected startPoint: THREE.Vector3 | null = null;
  protected previewLine: Line2 | null = null;
  protected style: TwoPointToolStyle;

  constructor(viewer: Viewer, style: TwoPointToolStyle) {
    this.viewer = viewer;
    this.style = style;
    this.group = new THREE.Group();
    this.viewer.scene.add(this.group);

    if (typeof window !== "undefined") {
      window.addEventListener("resize", () => {
        this.updateResolutions();
      });
    }
  }

  public activate(): void {
    this.clear();
  }

  public deactivate(): void {
    this.clear();
  }

  public getMarkerRadius(): number {
    const sphere = this.viewer.pointCloud?.getBoundingSphere();
    const boundRadius = sphere ? sphere.radius : 500;
    return Math.max(1.8, boundRadius * 0.016);
  }

  public handleClick(intersectedPoint: THREE.Vector3 | null): void {
    if (!intersectedPoint) return;

    if (!this.startPoint) {
      // First point placed
      this.startPoint = intersectedPoint.clone();
      this.clearVisuals();

      const r = this.getMarkerRadius();
      const markerGeo = new THREE.SphereGeometry(r, 16, 16);
      const markerMat = new THREE.MeshBasicMaterial({ color: this.style.startColor, depthTest: false });
      const marker = new THREE.Mesh(markerGeo, markerMat);
      marker.renderOrder = 2000;
      marker.position.copy(this.startPoint);
      this.group.add(marker);

      this.onFirstPointPlaced(this.startPoint);
    } else {
      // Second point placed
      const endPoint = intersectedPoint.clone();
      this.finalizeVisuals(this.startPoint, endPoint);
      this.onSegmentFinalized(this.startPoint, endPoint);
      this.startPoint = null;
    }
  }

  public handlePointerMove(intersectedPoint: THREE.Vector3 | null): void {
    if (!this.startPoint || !intersectedPoint) return;

    const coords = [
      this.startPoint.x, this.startPoint.y, this.startPoint.z,
      intersectedPoint.x, intersectedPoint.y, intersectedPoint.z
    ];

    if (!this.previewLine) {
      const lineGeo = new LineGeometry();
      lineGeo.setPositions(coords);

      const lineMat = new LineMaterial({
        color: this.style.previewColor,
        linewidth: this.style.lineWidth,
        resolution: new THREE.Vector2(window.innerWidth, window.innerHeight),
        depthTest: false,
        transparent: true,
        opacity: 0.95
      });

      this.previewLine = new Line2(lineGeo, lineMat);
      this.previewLine.renderOrder = 2000;
      this.group.add(this.previewLine);
    } else {
      this.previewLine.geometry.setPositions(coords);
      this.previewLine.material.resolution.set(window.innerWidth, window.innerHeight);
    }
  }

  protected finalizeVisuals(p1: THREE.Vector3, p2: THREE.Vector3): void {
    this.clearVisuals();

    const r = this.getMarkerRadius();

    // Start marker
    const markerGeo1 = new THREE.SphereGeometry(r, 16, 16);
    const m1 = new THREE.Mesh(markerGeo1, new THREE.MeshBasicMaterial({ color: this.style.startColor, depthTest: false }));
    m1.renderOrder = 2000;
    m1.position.copy(p1);
    this.group.add(m1);

    // End marker
    const markerGeo2 = new THREE.SphereGeometry(r, 16, 16);
    const m2 = new THREE.Mesh(markerGeo2, new THREE.MeshBasicMaterial({ color: this.style.endColor, depthTest: false }));
    m2.renderOrder = 2000;
    m2.position.copy(p2);
    this.group.add(m2);

    // Dimension / Section line
    const lineGeo = new LineGeometry();
    lineGeo.setPositions([p1.x, p1.y, p1.z, p2.x, p2.y, p2.z]);

    const lineMat = new LineMaterial({
      color: this.style.lineColor,
      linewidth: this.style.lineWidth,
      resolution: new THREE.Vector2(window.innerWidth, window.innerHeight),
      depthTest: false,
      transparent: true,
      opacity: 0.95
    });

    const line = new Line2(lineGeo, lineMat);
    line.renderOrder = 2000;
    this.group.add(line);
  }

  protected updateResolutions(): void {
    const res = new THREE.Vector2(window.innerWidth, window.innerHeight);
    this.group.traverse((obj) => {
      if ((obj as Line2).isLine2 && (obj as Line2).material) {
        (obj as Line2).material.resolution.copy(res);
      }
    });
  }

  public resetToIdle(): void {
    this.startPoint = null;
    this.clearVisuals();
    this.onResetToIdle();
  }

  public clear(): void {
    this.startPoint = null;
    this.clearVisuals();
    this.onClear();
  }

  protected clearVisuals(): void {
    while (this.group.children.length > 0) {
      const obj = this.group.children[0];
      this.group.remove(obj);
      if ((obj as any).geometry) (obj as any).geometry.dispose();
      if ((obj as any).material) (obj as any).material.dispose();
    }
    this.previewLine = null;
  }

  // Hook methods for subclass customization
  protected abstract onFirstPointPlaced(p1: THREE.Vector3): void;
  protected abstract onSegmentFinalized(p1: THREE.Vector3, p2: THREE.Vector3): void;
  protected abstract onResetToIdle(): void;
  protected abstract onClear(): void;
}
