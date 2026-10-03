import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { PointCloud } from "./PointCloud";
import { EDLPass } from "../shaders/EDLPass";
import { CameraPreset } from "../types";
import { FirstPersonControls } from "../tools/FirstPersonControls";

export class Viewer {
  public readonly scene: THREE.Scene;
  public readonly renderer: THREE.WebGLRenderer;
  public readonly perspCamera: THREE.PerspectiveCamera;
  public readonly orthoCamera: THREE.OrthographicCamera;
  public activeCamera: THREE.Camera;
  public readonly controls: OrbitControls;
  public readonly firstPersonControls: FirstPersonControls;
  public readonly gridHelper: THREE.GridHelper;
  public readonly edlPass: EDLPass;
  public pointCloud: PointCloud | null = null;
  private isOrthoMode: boolean = false;

  constructor(container: HTMLElement = document.body) {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x121214);

    const aspect = window.innerWidth / window.innerHeight;
    this.perspCamera = new THREE.PerspectiveCamera(60, aspect, 0.1, 50000);
    this.perspCamera.position.set(0, 500, 1000);

    this.orthoCamera = new THREE.OrthographicCamera(-500 * aspect, 500 * aspect, 500, -500, 0.1, 50000);
    this.activeCamera = this.perspCamera;

    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      preserveDrawingBuffer: true,
      powerPreference: "high-performance"
    });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(this.renderer.domElement);

    this.controls = new OrbitControls(this.activeCamera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.05;

    this.firstPersonControls = new FirstPersonControls(this);

    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
    this.scene.add(ambientLight);

    // Reference Ground Grid
    this.gridHelper = new THREE.GridHelper(2000, 40, 0x4a5568, 0x2d3748);
    this.gridHelper.position.y = -20;
    this.scene.add(this.gridHelper);

    // Eye-Dome Lighting (EDL) Depth Pass
    this.edlPass = new EDLPass(window.innerWidth, window.innerHeight);

    window.addEventListener("resize", () => this.handleResize());
    this.animate();
  }

  public setPointCloud(pc: PointCloud): void {
    if (this.pointCloud) {
      this.scene.remove(this.pointCloud.mesh);
      this.pointCloud.dispose();
    }

    this.pointCloud = pc;
    this.scene.add(pc.mesh);
    this.gridHelper.position.y = -pc.data.size[1] / 2 - 2;

    this.setCameraPreset("iso");
  }

  public setBackgroundBrightness(normalized: number): void {
    if (this.scene.background instanceof THREE.Color) {
      this.scene.background.setScalar(normalized);
    }
  }

  public setGridVisible(visible: boolean): void {
    this.gridHelper.visible = visible;
  }

  public setEDLEnabled(enabled: boolean): void {
    this.edlPass.enabled = enabled;
  }

  public setEDLStrength(strength: number): void {
    this.edlPass.setStrength(strength);
  }

  public setOrthoMode(useOrtho: boolean): void {
    this.isOrthoMode = useOrtho;
    const aspect = window.innerWidth / window.innerHeight;
    const currentPos = this.activeCamera.position.clone();
    const currentTarget = this.controls.target.clone();

    if (useOrtho) {
      const dist = currentPos.distanceTo(currentTarget);
      const orthoH = dist * 0.6;
      this.orthoCamera.left = -orthoH * aspect;
      this.orthoCamera.right = orthoH * aspect;
      this.orthoCamera.top = orthoH;
      this.orthoCamera.bottom = -orthoH;
      this.orthoCamera.position.copy(currentPos);
      this.orthoCamera.lookAt(currentTarget);
      this.orthoCamera.updateProjectionMatrix();

      this.activeCamera = this.orthoCamera;
    } else {
      this.perspCamera.position.copy(currentPos);
      this.perspCamera.lookAt(currentTarget);
      this.perspCamera.updateProjectionMatrix();

      this.activeCamera = this.perspCamera;
    }

    this.controls.object = this.activeCamera;
    if (this.pointCloud) {
      this.pointCloud.setIsOrtho(useOrtho);
    }
  }

  public getOrthoMode(): boolean {
    return this.isOrthoMode;
  }

  public setCameraPreset(preset: CameraPreset): void {
    if (!this.pointCloud) return;
    const sphere = this.pointCloud.getBoundingSphere();
    if (!sphere) return;

    const radius = sphere.radius;
    this.controls.target.set(0, 0, 0);

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
    this.controls.update();

    if (this.activeCamera instanceof THREE.OrthographicCamera) {
      const aspect = window.innerWidth / window.innerHeight;
      const orthoH = radius * 1.2;
      this.orthoCamera.left = -orthoH * aspect;
      this.orthoCamera.right = orthoH * aspect;
      this.orthoCamera.top = orthoH;
      this.orthoCamera.bottom = -orthoH;
      this.orthoCamera.updateProjectionMatrix();
    }
  }

  public exportSnapshot(): void {
    this.edlPass.render(this.renderer, this.scene, this.activeCamera);
    const dataURL = this.renderer.domElement.toDataURL("image/png");
    const a = document.createElement("a");
    a.download = `lidar-snapshot-${Date.now()}.png`;
    a.href = dataURL;
    a.click();
  }

  private handleResize(): void {
    const aspect = window.innerWidth / window.innerHeight;
    this.perspCamera.aspect = aspect;
    this.perspCamera.updateProjectionMatrix();

    if (this.activeCamera instanceof THREE.OrthographicCamera) {
      const h = (this.orthoCamera.top - this.orthoCamera.bottom) / 2;
      this.orthoCamera.left = -h * aspect;
      this.orthoCamera.right = h * aspect;
      this.orthoCamera.updateProjectionMatrix();
    }

    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.edlPass.setSize(window.innerWidth, window.innerHeight);
  }

  private animate = (): void => {
    requestAnimationFrame(this.animate);
    if (this.firstPersonControls && this.firstPersonControls.isEnabled()) {
      this.firstPersonControls.update();
    } else {
      this.controls.update();
    }
    this.edlPass.render(this.renderer, this.scene, this.activeCamera);
  };
}
