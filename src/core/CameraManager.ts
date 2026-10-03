import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { CameraPreset } from "../types";
import { PointCloud } from "./PointCloud";

export class CameraManager {
  public activeCamera: THREE.Camera;
  public readonly perspCamera: THREE.PerspectiveCamera;
  public readonly orthoCamera: THREE.OrthographicCamera;
  public readonly controls: OrbitControls;
  
  private isOrthoMode: boolean = false;
  private width: number;
  private height: number;

  constructor(domElement: HTMLElement, width: number, height: number) {
    this.width = width;
    this.height = height;
    
    const aspect = width / height;
    this.perspCamera = new THREE.PerspectiveCamera(60, aspect, 0.1, 50000);
    this.perspCamera.position.set(0, 500, 1000);

    this.orthoCamera = new THREE.OrthographicCamera(-500 * aspect, 500 * aspect, 500, -500, -50000, 50000);
    this.activeCamera = this.perspCamera;

    this.controls = new OrbitControls(this.activeCamera, domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.05;
  }

  public resize(width: number, height: number): void {
    this.width = width;
    this.height = height;
    const aspect = width / height;
    
    this.perspCamera.aspect = aspect;
    this.perspCamera.updateProjectionMatrix();

    if (this.activeCamera === this.orthoCamera) {
      const h = (this.orthoCamera.top - this.orthoCamera.bottom) / 2;
      this.orthoCamera.left = -h * aspect;
      this.orthoCamera.right = h * aspect;
      this.orthoCamera.updateProjectionMatrix();
    }
  }

  public getOrthoMode(): boolean {
    return this.isOrthoMode;
  }

  public setOrthoMode(useOrtho: boolean, pointCloud?: PointCloud | null): void {
    this.isOrthoMode = useOrtho;
    const aspect = this.width / this.height;
    const currentPos = this.activeCamera.position.clone();
    const currentTarget = this.controls.target.clone();
    
    const sphere = pointCloud?.getBoundingSphere();
    const radius = sphere ? Math.max(10, sphere.radius) : 500;

    if (useOrtho) {
      const dist = currentPos.distanceTo(currentTarget);
      const orthoH = Math.max(dist * 0.6, radius * 0.8);
      this.orthoCamera.left = -orthoH * aspect;
      this.orthoCamera.right = orthoH * aspect;
      this.orthoCamera.top = orthoH;
      this.orthoCamera.bottom = -orthoH;
      this.orthoCamera.near = -Math.max(50000, radius * 10);
      this.orthoCamera.far = Math.max(50000, radius * 10);
      this.orthoCamera.position.copy(currentPos);
      this.orthoCamera.lookAt(currentTarget);
      this.orthoCamera.updateProjectionMatrix();

      this.activeCamera = this.orthoCamera;
    } else {
      this.perspCamera.near = Math.max(0.1, radius / 5000);
      this.perspCamera.far = Math.max(50000, radius * 30);
      this.perspCamera.position.copy(currentPos);
      this.perspCamera.lookAt(currentTarget);
      this.perspCamera.updateProjectionMatrix();

      this.activeCamera = this.perspCamera;
    }

    this.controls.object = this.activeCamera;
    if (pointCloud) {
      pointCloud.setIsOrtho(useOrtho);
    }
  }

  public setCameraPreset(preset: CameraPreset, pointCloud: PointCloud | null): void {
    if (!pointCloud) return;
    const sphere = pointCloud.getBoundingSphere();
    if (!sphere) return;

    const radius = Math.max(10, sphere.radius);
    this.controls.target.set(0, 0, 0);

    // Dynamically adjust camera clipping planes and distances for datasets of any size
    this.perspCamera.near = Math.max(0.1, radius / 5000);
    this.perspCamera.far = Math.max(100000, radius * 30);
    this.perspCamera.updateProjectionMatrix();

    this.orthoCamera.near = -Math.max(50000, radius * 10);
    this.orthoCamera.far = Math.max(50000, radius * 10);
    this.orthoCamera.updateProjectionMatrix();

    if (preset === "top") {
      this.activeCamera.position.set(0, radius * 2.0, 0);
    } else if (preset === "front") {
      this.activeCamera.position.set(0, 0, radius * 2.0);
    } else if (preset === "side") {
      this.activeCamera.position.set(radius * 2.0, 0, 0);
    } else {
      this.activeCamera.position.set(radius * 0.9, radius * 0.9, radius * 1.4);
    }

    this.activeCamera.lookAt(0, 0, 0);
    this.controls.maxDistance = radius * 35;
    this.controls.update();

    if (this.activeCamera === this.orthoCamera) {
      const aspect = this.width / this.height;
      const orthoH = radius * 1.2;
      this.orthoCamera.left = -orthoH * aspect;
      this.orthoCamera.right = orthoH * aspect;
      this.orthoCamera.top = orthoH;
      this.orthoCamera.bottom = -orthoH;
      this.orthoCamera.updateProjectionMatrix();
    }
  }

  public update(): void {
    this.controls.update();
  }
}
