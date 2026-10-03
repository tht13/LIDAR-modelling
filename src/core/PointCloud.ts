import * as THREE from "three";
import { pointVertexShader, pointFragmentShader } from "../shaders/pointShaders";
import { ParseResult, ColorMode } from "../types";

export class PointCloud {
  public readonly mesh: THREE.Points<THREE.BufferGeometry, THREE.ShaderMaterial>;
  public readonly geometry: THREE.BufferGeometry;
  public readonly material: THREE.ShaderMaterial;
  public readonly data: ParseResult;

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

  public getBoundingSphere(): THREE.Sphere | null {
    return this.geometry.boundingSphere;
  }

  public dispose(): void {
    this.geometry.dispose();
    this.material.dispose();
  }
}
