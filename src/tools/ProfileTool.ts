import * as THREE from "three";
import { Line2 } from "three/examples/jsm/lines/Line2.js";
import { LineGeometry } from "three/examples/jsm/lines/LineGeometry.js";
import { LineMaterial } from "three/examples/jsm/lines/LineMaterial.js";
import { Viewer } from "../core/Viewer";

export interface ProfilePoint {
  distance: number;
  elevation: number;
  originalElevation: number;
  realX: number;
  realNorthing: number;
}

export interface ProfileData {
  points: ProfilePoint[];
  totalDistance: number;
  minElevation: number;
  maxElevation: number;
  startPoint: THREE.Vector3;
  endPoint: THREE.Vector3;
}

export class ProfileTool {
  private viewer: Viewer;
  private group: THREE.Group;
  private startPoint: THREE.Vector3 | null = null;
  private previewLine: Line2 | null = null;
  private onProfileCallback: ((data: ProfileData | null, statusText?: string) => void) | null = null;
  public sliceWidth: number = 4.0; // Corridor width in meters

  constructor(viewer: Viewer) {
    this.viewer = viewer;
    this.group = new THREE.Group();
    this.viewer.scene.add(this.group);

    window.addEventListener("resize", () => {
      this.updateResolutions();
    });
  }

  public onProfile(cb: (data: ProfileData | null, statusText?: string) => void): void {
    this.onProfileCallback = cb;
  }

  public handleClick(intersectedPoint: THREE.Vector3 | null): void {
    if (!intersectedPoint) return;

    if (!this.startPoint) {
      this.startPoint = intersectedPoint.clone();
      this.clearVisuals();

      const r = this.getMarkerRadius();
      const markerGeo = new THREE.SphereGeometry(r, 16, 16);
      const markerMat = new THREE.MeshBasicMaterial({ color: 0xa855f7, depthTest: false }); // Purple marker
      const marker = new THREE.Mesh(markerGeo, markerMat);
      marker.renderOrder = 2000;
      marker.position.copy(this.startPoint);
      this.group.add(marker);

      if (this.onProfileCallback) {
        this.onProfileCallback(null, "Point 1 placed. Click second point to cut section...");
      }
    } else {
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
        color: 0xc084fc, // Bright lilac/purple
        linewidth: 5,
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

    // Start & End markers
    const markerGeo = new THREE.SphereGeometry(r, 16, 16);
    const m1 = new THREE.Mesh(markerGeo, new THREE.MeshBasicMaterial({ color: 0xa855f7, depthTest: false }));
    m1.position.copy(p1);
    m1.renderOrder = 2000;
    const m2 = new THREE.Mesh(markerGeo, new THREE.MeshBasicMaterial({ color: 0xec4899, depthTest: false }));
    m2.position.copy(p2);
    m2.renderOrder = 2000;
    this.group.add(m1);
    this.group.add(m2);

    // Section line
    const lineGeo = new LineGeometry();
    lineGeo.setPositions([p1.x, p1.y, p1.z, p2.x, p2.y, p2.z]);
    const lineMat = new LineMaterial({
      color: 0xa855f7,
      linewidth: 6,
      resolution: new THREE.Vector2(window.innerWidth, window.innerHeight),
      depthTest: false,
      transparent: true,
      opacity: 0.95
    });
    const line = new Line2(lineGeo, lineMat);
    line.renderOrder = 2000;
    this.group.add(line);

    // Compute cross-section slice from point cloud data
    const profileData = this.computeProfile(p1, p2);
    if (this.onProfileCallback) {
      this.onProfileCallback(profileData, profileData ? "Cross-section calculated" : "No points in slice corridor");
    }
  }

  private computeProfile(p1: THREE.Vector3, p2: THREE.Vector3): ProfileData | null {
    if (!this.viewer.pointCloud) return null;

    const data = this.viewer.pointCloud.data;
    const positions = data.positions;
    const center = data.center;
    const count = data.count;

    // Vector in XZ horizontal ground plane
    const vX = p2.x - p1.x;
    const vZ = p2.z - p1.z;
    const segLen = Math.sqrt(vX * vX + vZ * vZ);
    if (segLen === 0) return null;

    const dirX = vX / segLen;
    const dirZ = vZ / segLen;

    const profilePoints: ProfilePoint[] = [];
    let minElev = Infinity;
    let maxElev = -Infinity;

    for (let i = 0; i < count; i++) {
      const px = positions[i * 3];
      const py = positions[i * 3 + 1]; // Local elevation
      const pz = positions[i * 3 + 2]; // Local northing

      // Vector from p1 to point
      const dx = px - p1.x;
      const dz = pz - p1.z;

      // Projection along slice segment (t in [0, segLen])
      const proj = dx * dirX + dz * dirZ;
      if (proj < 0 || proj > segLen) continue;

      // Perpendicular distance to slice line
      const perpDist = Math.abs(dx * (-dirZ) + dz * dirX);
      if (perpDist <= this.sliceWidth) {
        const realElev = py + center[1];
        if (realElev < minElev) minElev = realElev;
        if (realElev > maxElev) maxElev = realElev;

        profilePoints.push({
          distance: proj,
          elevation: py,
          originalElevation: realElev,
          realX: px + center[0],
          realNorthing: pz + center[2]
        });
      }
    }

    if (profilePoints.length === 0) return null;

    // Sort points by distance along slice
    profilePoints.sort((a, b) => a.distance - b.distance);

    return {
      points: profilePoints,
      totalDistance: segLen,
      minElevation: minElev,
      maxElevation: maxElev,
      startPoint: p1,
      endPoint: p2
    };
  }

  private getMarkerRadius(): number {
    const sphere = this.viewer.pointCloud?.getBoundingSphere();
    const boundRadius = sphere ? sphere.radius : 500;
    return Math.max(1.8, boundRadius * 0.016);
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
    if (this.onProfileCallback) {
      this.onProfileCallback(null, "Click first point on point cloud to begin slice...");
    }
  }

  public clear(): void {
    this.startPoint = null;
    this.clearVisuals();
    if (this.onProfileCallback) {
      this.onProfileCallback(null);
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
