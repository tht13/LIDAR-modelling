import * as THREE from "three";
import { Line2 } from "three/examples/jsm/lines/Line2.js";
import { LineGeometry } from "three/examples/jsm/lines/LineGeometry.js";
import { LineMaterial } from "three/examples/jsm/lines/LineMaterial.js";
import { Viewer } from "../core/Viewer";
import { MeasureResult } from "../types";

export class MeasurementTool {
  private viewer: Viewer;
  private group: THREE.Group;
  private startPoint: THREE.Vector3 | null = null;
  private previewLine: Line2 | null = null;
  private onMeasurementCallback: ((result: MeasureResult) => void) | null = null;

  constructor(viewer: Viewer) {
    this.viewer = viewer;
    this.group = new THREE.Group();
    this.viewer.scene.add(this.group);

    window.addEventListener("resize", () => {
      this.updateResolutions();
    });
  }

  public onMeasurement(cb: (result: MeasureResult) => void): void {
    this.onMeasurementCallback = cb;
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
      const markerMat = new THREE.MeshBasicMaterial({ color: 0x00ff66, depthTest: false });
      const marker = new THREE.Mesh(markerGeo, markerMat);
      marker.renderOrder = 2000;
      marker.position.copy(this.startPoint);
      this.group.add(marker);

      if (this.onMeasurementCallback) {
        this.onMeasurementCallback({ state: "placed_first" });
      }
    } else {
      // Second point placed
      const endPoint = intersectedPoint.clone();
      this.finalize(this.startPoint, endPoint);
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
        color: 0xffea00, // Thick glowing yellow tracing line
        linewidth: 6, // 6px thick line
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

  private finalize(p1: THREE.Vector3, p2: THREE.Vector3): void {
    this.clearVisuals();

    const r = this.getMarkerRadius();

    // Start marker (Green)
    const markerGeo1 = new THREE.SphereGeometry(r, 16, 16);
    const m1 = new THREE.Mesh(markerGeo1, new THREE.MeshBasicMaterial({ color: 0x00ff66, depthTest: false }));
    m1.renderOrder = 2000;
    m1.position.copy(p1);
    this.group.add(m1);

    // End marker (Red)
    const markerGeo2 = new THREE.SphereGeometry(r, 16, 16);
    const m2 = new THREE.Mesh(markerGeo2, new THREE.MeshBasicMaterial({ color: 0xff0055, depthTest: false }));
    m2.renderOrder = 2000;
    m2.position.copy(p2);
    this.group.add(m2);

    // Thick dimension line (Cyan, 6px wide)
    const lineGeo = new LineGeometry();
    lineGeo.setPositions([p1.x, p1.y, p1.z, p2.x, p2.y, p2.z]);

    const lineMat = new LineMaterial({
      color: 0x00ffff, // Glowing cyan
      linewidth: 6, // 6px thick line
      resolution: new THREE.Vector2(window.innerWidth, window.innerHeight),
      depthTest: false,
      transparent: true,
      opacity: 0.95
    });

    const line = new Line2(lineGeo, lineMat);
    line.renderOrder = 2000;
    this.group.add(line);

    // Metrics
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

  private updateResolutions(): void {
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
    if (this.onMeasurementCallback) {
      this.onMeasurementCallback({ state: "idle" });
    }
  }

  public clear(): void {
    this.startPoint = null;
    this.clearVisuals();
    if (this.onMeasurementCallback) {
      this.onMeasurementCallback({ state: "idle" });
    }
  }

  private clearVisuals(): void {
    while (this.group.children.length > 0) {
      const obj = this.group.children[0];
      this.group.remove(obj);
      if ((obj as any).geometry) (obj as any).geometry.dispose();
      if ((obj as any).material) (obj as any).material.dispose();
    }
    this.previewLine = null;
  }
}
