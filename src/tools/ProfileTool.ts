import * as THREE from "three";
import { Viewer } from "../core/Viewer";
import { GeoCoordinates } from "../utils/GeoCoordinates";
import { BaseTwoPointTool } from "./BaseTwoPointTool";

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

export class ProfileTool extends BaseTwoPointTool {
  public readonly id = "profile" as const;
  private onProfileCallback: ((data: ProfileData | null, statusText?: string) => void) | null = null;
  public sliceWidth: number = 4.0; // Corridor width in meters

  constructor(viewer: Viewer) {
    super(viewer, {
      startColor: 0xa855f7, // Purple
      endColor: 0xec4899,   // Pink
      lineColor: 0xa855f7,  // Purple
      previewColor: 0xc084fc, // Lilac
      lineWidth: 6
    });
  }

  public onProfile(cb: (data: ProfileData | null, statusText?: string) => void): void {
    this.onProfileCallback = cb;
  }

  protected onFirstPointPlaced(_p1: THREE.Vector3): void {
    if (this.onProfileCallback) {
      this.onProfileCallback(null, "Point 1 placed. Click second point to cut section...");
    }
  }

  protected onSegmentFinalized(p1: THREE.Vector3, p2: THREE.Vector3): void {
    const profileData = this.computeProfile(p1, p2);
    if (this.onProfileCallback) {
      this.onProfileCallback(profileData, profileData ? "Cross-section calculated" : "No points in slice corridor");
    }
  }

  protected onResetToIdle(): void {
    if (this.onProfileCallback) {
      this.onProfileCallback(null, "Click first point on point cloud to begin slice...");
    }
  }

  protected onClear(): void {
    if (this.onProfileCallback) {
      this.onProfileCallback(null);
    }
  }

  private computeProfile(p1: THREE.Vector3, p2: THREE.Vector3): ProfileData | null {
    if (!this.viewer.pointCloud) return null;

    const data = this.viewer.pointCloud.data;
    const posAttr = this.viewer.pointCloud.geometry.getAttribute("position") as THREE.BufferAttribute;
    const positions = posAttr ? (posAttr.array as Float32Array) : data.positions;
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
        const [realX, realNorthing, realElev] = GeoCoordinates.toWorld(px, py, pz, center);
        if (realElev < minElev) minElev = realElev;
        if (realElev > maxElev) maxElev = realElev;

        profilePoints.push({
          distance: proj,
          elevation: py,
          originalElevation: realElev,
          realX,
          realNorthing
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
}
