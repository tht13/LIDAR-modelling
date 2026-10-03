import * as THREE from "three";
import { pointVertexShader, pointFragmentShader } from "../shaders/pointShaders";
import { ParseResult, ColorMode } from "../types";

export class PointCloud {
  public readonly mesh: THREE.Points<THREE.BufferGeometry, THREE.ShaderMaterial>;
  public readonly geometry: THREE.BufferGeometry;
  public readonly material: THREE.ShaderMaterial;
  public readonly data: ParseResult;
  private currentVoxelSize: number = 0;
  private currentDecimation: number = 1.0;

  constructor(data: ParseResult, initialPointSize: number = 3.0, isOrtho: boolean = false) {
    this.data = data;

    this.geometry = new THREE.BufferGeometry();
    this.geometry.setAttribute("position", new THREE.BufferAttribute(data.positions, 3));
    this.geometry.setAttribute("customColor", new THREE.BufferAttribute(data.colors, 3));
    this.geometry.setAttribute("elevation", new THREE.BufferAttribute(data.elevations, 1));
    this.geometry.computeBoundingSphere();

    const initialColorMode = data.hasRGB ? ColorMode.RGB : ColorMode.Turbo;

    this.material = new THREE.ShaderMaterial({
      vertexShader: pointVertexShader,
      fragmentShader: pointFragmentShader,
      uniforms: {
        pointSize: { value: initialPointSize },
        colorMode: { value: initialColorMode },
        isOrtho: { value: isOrtho }
      },
      transparent: true,
      depthWrite: true
    });

    this.mesh = new THREE.Points(this.geometry, this.material);
  }

  public setPointSize(size: number): void {
    this.material.uniforms.pointSize.value = size;
  }

  public setColorMode(mode: ColorMode): void {
    this.material.uniforms.colorMode.value = mode;
  }

  public setIsOrtho(isOrtho: boolean): void {
    this.material.uniforms.isOrtho.value = isOrtho;
  }

  /**
   * Subsamples point cloud using a 3D uniform spatial voxel grid filter.
   * If voxelSize <= 0, resets to full point cloud.
   * Returns the count of active points.
   */
  public applyVoxelGrid(voxelSize: number): number {
    this.currentVoxelSize = voxelSize;
    if (voxelSize <= 0) {
      this.geometry.setIndex(null);
      return this.data.count;
    }

    const pos = this.data.positions;
    const count = this.data.count;
    const invSize = 1.0 / voxelSize;
    const gridMap = new Set<string>();
    const indices: number[] = [];

    for (let i = 0; i < count; i++) {
      const idx = i * 3;
      const gx = Math.floor(pos[idx] * invSize);
      const gy = Math.floor(pos[idx + 1] * invSize);
      const gz = Math.floor(pos[idx + 2] * invSize);
      const key = `${gx}_${gy}_${gz}`;

      if (!gridMap.has(key)) {
        gridMap.add(key);
        indices.push(i);
      }
    }

    const indexAttr = new THREE.BufferAttribute(new Uint32Array(indices), 1);
    this.geometry.setIndex(indexAttr);
    return indices.length;
  }

  /**
   * Decimates point cloud by taking a fraction of total points (0.01 to 1.0)
   */
  public applyDecimation(ratio: number): number {
    this.currentDecimation = ratio;
    const clamped = Math.max(0.01, Math.min(1.0, ratio));
    if (clamped >= 0.999) {
      this.geometry.setIndex(null);
      return this.data.count;
    }

    const step = 1.0 / clamped;
    const count = this.data.count;
    const indices: number[] = [];
    for (let i = 0; i < count; i += step) {
      indices.push(Math.floor(i));
    }

    const indexAttr = new THREE.BufferAttribute(new Uint32Array(indices), 1);
    this.geometry.setIndex(indexAttr);
    return indices.length;
  }

  public getActivePointCount(): number {
    const index = this.geometry.getIndex();
    return index ? index.count : this.data.count;
  }

  public getBoundingSphere(): THREE.Sphere | null {
    return this.geometry.boundingSphere;
  }

  public dispose(): void {
    this.geometry.dispose();
    this.material.dispose();
  }
}
