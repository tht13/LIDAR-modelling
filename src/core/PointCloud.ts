import * as THREE from "three";
import { pointVertexShader, pointFragmentShader } from "../shaders/pointShaders";
import { ParseResult, ColorMode, AxisOrientation } from "../types";
import { GeoCoordinates } from "../utils/GeoCoordinates";

export class PointCloud {
  public readonly mesh: THREE.Points<THREE.BufferGeometry, THREE.ShaderMaterial>;
  public readonly geometry: THREE.BufferGeometry;
  public readonly material: THREE.ShaderMaterial;
  public readonly data: ParseResult;
  private currentVoxelSize: number = 0;
  private currentDecimation: number = 1.0;
  private enabledClassifications: Set<number> = new Set();
  private hasClassificationData: boolean = false;
  private axisOrientation: AxisOrientation = {
    flipX: false,
    flipY: false,
    flipZ: false,
    swapXY: false,
    swapXZ: false
  };

  constructor(data: ParseResult, initialPointSize: number = 3.0, isOrtho: boolean = false, initialShape: number = 0) {
    this.data = data;

    this.geometry = new THREE.BufferGeometry();
    this.geometry.setAttribute("position", new THREE.BufferAttribute(new Float32Array(data.positions), 3));
    this.geometry.setAttribute("customColor", new THREE.BufferAttribute(data.colors, 3));
    this.geometry.setAttribute("elevation", new THREE.BufferAttribute(new Float32Array(data.elevations), 1));
    this.geometry.computeBoundingSphere();

    if (data.classifications && data.classifications.length === data.count) {
      this.hasClassificationData = true;
      for (let i = 0; i < data.classifications.length; i++) {
        this.enabledClassifications.add(data.classifications[i]);
      }
    }

    const initialColorMode = data.hasRGB ? ColorMode.RGB : ColorMode.Turbo;

    this.material = new THREE.ShaderMaterial({
      vertexShader: pointVertexShader,
      fragmentShader: pointFragmentShader,
      uniforms: {
        pointSize: { value: initialPointSize },
        colorMode: { value: initialColorMode },
        pointShape: { value: initialShape },
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

  public setPointShape(shape: number): void {
    this.material.uniforms.pointShape.value = shape;
  }

  public setColorMode(mode: ColorMode): void {
    this.material.uniforms.colorMode.value = mode;
  }

  public setIsOrtho(isOrtho: boolean): void {
    this.material.uniforms.isOrtho.value = isOrtho;
  }

  public hasClassifications(): boolean {
    return this.hasClassificationData;
  }

  public getAvailableClassifications(): number[] {
    if (!this.hasClassificationData || !this.data.classifications) return [];
    const set = new Set<number>();
    for (let i = 0; i < this.data.classifications.length; i++) {
      set.add(this.data.classifications[i]);
    }
    return Array.from(set).sort((a, b) => a - b);
  }

  public setClassificationFilter(enabledClasses: Set<number>): number {
    this.enabledClassifications = new Set(enabledClasses);
    return this.rebuildIndices();
  }

  public isClassificationEnabled(classVal: number): boolean {
    return this.enabledClassifications.has(classVal);
  }

  /**
   * Rebuilds geometry index buffer by combining classification filters, voxel downsampling, and decimation.
   */
  public rebuildIndices(): number {
    const count = this.data.count;
    const pos = this.data.positions;
    const classes = this.data.classifications;

    const useClassFilter = this.hasClassificationData && classes && this.enabledClassifications.size > 0;
    const useVoxel = this.currentVoxelSize > 0;
    const useDecimation = this.currentDecimation < 0.999;

    // If no filters active, restore full dataset without index
    if (!useClassFilter && !useVoxel && !useDecimation) {
      this.geometry.setIndex(null);
      return count;
    }

    const invSize = useVoxel ? 1.0 / this.currentVoxelSize : 0;
    const voxelMap = useVoxel ? new Set<string>() : null;
    const decimationStep = useDecimation ? 1.0 / Math.max(0.01, this.currentDecimation) : 1.0;
    let nextDecimationPoint = 0;

    const indices: number[] = [];

    for (let i = 0; i < count; i++) {
      // 1. Classification check
      if (useClassFilter && classes) {
        const c = classes[i];
        if (!this.enabledClassifications.has(c)) {
          continue;
        }
      }

      // 2. Decimation check
      if (useDecimation) {
        if (i < Math.floor(nextDecimationPoint)) {
          continue;
        }
        nextDecimationPoint += decimationStep;
      }

      // 3. Voxel grid check
      if (useVoxel && voxelMap) {
        const idx = i * 3;
        const gx = Math.floor(pos[idx] * invSize);
        const gy = Math.floor(pos[idx + 1] * invSize);
        const gz = Math.floor(pos[idx + 2] * invSize);
        const key = `${gx}_${gy}_${gz}`;
        if (voxelMap.has(key)) {
          continue;
        }
        voxelMap.add(key);
      }

      indices.push(i);
    }

    const indexAttr = new THREE.BufferAttribute(new Uint32Array(indices), 1);
    this.geometry.setIndex(indexAttr);
    return indices.length;
  }

  /**
   * Subsamples point cloud using a 3D uniform spatial voxel grid filter.
   * If voxelSize <= 0, resets to full point cloud (subject to other filters).
   * Returns the count of active points.
   */
  public applyVoxelGrid(voxelSize: number): number {
    this.currentVoxelSize = Math.max(0, voxelSize);
    return this.rebuildIndices();
  }

  /**
   * Decimates point cloud by taking a fraction of total points (0.01 to 1.0)
   */
  public applyDecimation(ratio: number): number {
    this.currentDecimation = Math.max(0.01, Math.min(1.0, ratio));
    return this.rebuildIndices();
  }

  public getActivePointCount(): number {
    const index = this.geometry.getIndex();
    return index ? index.count : this.data.count;
  }

  /**
   * Returns current axis orientation flips and swaps.
   */
  public getAxisOrientation(): AxisOrientation {
    return { ...this.axisOrientation };
  }

  /**
   * Applies axis orientation flips and/or swaps to the point cloud.
   */
  public setAxisOrientation(orientation: Partial<AxisOrientation>): void {
    this.axisOrientation = {
      ...this.axisOrientation,
      ...orientation
    };
    this.applyAxisOrientation();
  }

  /**
   * Re-evaluates position buffer and elevation attribute from base data
   * according to current axisOrientation settings.
   */
  public applyAxisOrientation(): void {
    const basePos = this.data.positions;
    const posAttr = this.geometry.getAttribute("position") as THREE.BufferAttribute;
    if (!posAttr) return;
    const pos = posAttr.array as Float32Array;
    const count = this.data.count;

    const { flipX, flipY, flipZ, swapXY, swapXZ } = this.axisOrientation;

    let minY = Infinity;
    let maxY = -Infinity;

    for (let i = 0; i < count; i++) {
      const i3 = i * 3;
      let x = basePos[i3];
      let y = basePos[i3 + 1];
      let z = basePos[i3 + 2];

      if (swapXY) {
        const tmp = x;
        x = y;
        y = tmp;
      }
      if (swapXZ) {
        const tmp = x;
        x = z;
        z = tmp;
      }

      const fx = flipX ? -x : x;
      const fy = flipY ? -y : y;
      const fz = flipZ ? -z : z;

      pos[i3] = fx;
      pos[i3 + 1] = fy;
      pos[i3 + 2] = fz;

      if (fy < minY) minY = fy;
      if (fy > maxY) maxY = fy;
    }

    posAttr.needsUpdate = true;

    // Re-normalize elevation attribute for colormaps
    const elevAttr = this.geometry.getAttribute("elevation") as THREE.BufferAttribute;
    if (elevAttr) {
      const elev = elevAttr.array as Float32Array;
      const ySpan = maxY - minY || 1.0;
      for (let i = 0; i < count; i++) {
        elev[i] = (pos[i * 3 + 1] - minY) / ySpan;
      }
      elevAttr.needsUpdate = true;
    }

    this.geometry.computeBoundingSphere();
    this.geometry.computeBoundingBox();
  }

  /**
   * Iterates through active points (filtered or full cloud) and invokes callback with world GIS coordinates and colors.
   */
  public forEachActivePoint(
    cb: (worldX: number, worldY: number, worldZ: number, r: number, g: number, b: number, index: number) => void,
    onlyActive: boolean = true
  ): number {
    const posAttr = this.geometry.getAttribute("position") as THREE.BufferAttribute;
    const pos = posAttr ? (posAttr.array as Float32Array) : this.data.positions;
    const colors = this.data.colors;
    const center = this.data.center;

    const indexAttr = this.geometry.getIndex();
    const useIndices = onlyActive && indexAttr !== null;
    const count = useIndices ? indexAttr.count : this.data.count;

    for (let i = 0; i < count; i++) {
      const idx = useIndices ? indexAttr.getX(i) : i;
      const pIdx = idx * 3;

      const [realX, realY, realZ] = GeoCoordinates.toWorld(pos[pIdx], pos[pIdx + 1], pos[pIdx + 2], center);
      const r = colors[pIdx] || 1.0;
      const g = colors[pIdx + 1] || 1.0;
      const b = colors[pIdx + 2] || 1.0;

      cb(realX, realY, realZ, r, g, b, idx);
    }

    return count;
  }

  public getBoundingSphere(): THREE.Sphere | null {
    return this.geometry.boundingSphere;
  }

  public dispose(): void {
    this.geometry.dispose();
    this.material.dispose();
  }
}
