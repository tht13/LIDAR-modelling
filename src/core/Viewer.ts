import * as THREE from "three";
import { PointCloud } from "./PointCloud";
import { EDLPass } from "../shaders/EDLPass";
import { CameraPreset, AxisOrientation } from "../types";
import { FirstPersonControls } from "../tools/FirstPersonControls";
import { CameraManager } from "./CameraManager";

export class Viewer {
  public readonly scene: THREE.Scene;
  public readonly renderer: THREE.WebGLRenderer;
  public readonly cameraManager: CameraManager;
  public readonly firstPersonControls: FirstPersonControls;
  public readonly gridHelper: THREE.GridHelper;
  public readonly edlPass: EDLPass;
  public pointCloud: PointCloud | null = null;
  private axisOrientation: AxisOrientation = {
    flipX: false,
    flipY: false,
    flipZ: false,
    swapXY: false,
    swapXZ: false
  };

  constructor(container?: HTMLElement) {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x121214);

    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      preserveDrawingBuffer: true,
      powerPreference: "high-performance"
    });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    this.renderer.domElement.classList.add("webgl-canvas");
    this.renderer.domElement.style.position = "absolute";
    this.renderer.domElement.style.top = "0";
    this.renderer.domElement.style.left = "0";
    this.renderer.domElement.style.width = "100%";
    this.renderer.domElement.style.height = "100%";
    this.renderer.domElement.style.zIndex = "0";

    const targetMount = container || document.getElementById("canvas-container") || document.body;
    targetMount.appendChild(this.renderer.domElement);

    this.cameraManager = new CameraManager(this.renderer.domElement, window.innerWidth, window.innerHeight);
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

  // Getters for legacy tools
  public get activeCamera(): THREE.Camera { return this.cameraManager.activeCamera; }
  public get controls() { return this.cameraManager.controls; }

  public setPointCloud(pc: PointCloud): void {
    if (this.pointCloud) {
      this.scene.remove(this.pointCloud.mesh);
      this.pointCloud.dispose();
    }

    this.pointCloud = pc;

    if (this.axisOrientation.flipX || this.axisOrientation.flipY || this.axisOrientation.flipZ || this.axisOrientation.swapXY || this.axisOrientation.swapXZ) {
      this.pointCloud.setAxisOrientation(this.axisOrientation);
    }

    this.scene.add(pc.mesh);
    this.gridHelper.position.y = -pc.data.size[1] / 2 - 2;

    const maxDim = Math.max(pc.data.size[0], pc.data.size[2]);
    this.gridHelper.scale.setScalar(Math.max(1, maxDim / 2000));

    this.setCameraPreset("iso");
  }

  public setAxisOrientation(orientation: Partial<AxisOrientation>): void {
    this.axisOrientation = { ...this.axisOrientation, ...orientation };
    if (this.pointCloud) {
      this.pointCloud.setAxisOrientation(this.axisOrientation);
      const bbox = this.pointCloud.geometry.boundingBox;
      if (bbox) {
        this.gridHelper.position.y = bbox.min.y - 2;
      }
    }
  }

  public getAxisOrientation(): AxisOrientation {
    return { ...this.axisOrientation };
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

  public setPointShape(shape: number): void {
    if (this.pointCloud) {
      this.pointCloud.setPointShape(shape);
    }
  }

  public setOrthoMode(useOrtho: boolean): void {
    this.cameraManager.setOrthoMode(useOrtho, this.pointCloud);
  }

  public getOrthoMode(): boolean {
    return this.cameraManager.getOrthoMode();
  }

  public setCameraPreset(preset: CameraPreset): void {
    this.cameraManager.setCameraPreset(preset, this.pointCloud);
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
    this.cameraManager.resize(window.innerWidth, window.innerHeight);
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.edlPass.setSize(window.innerWidth, window.innerHeight);
  }

  private animate = (): void => {
    requestAnimationFrame(this.animate);
    if (this.firstPersonControls && this.firstPersonControls.isEnabled()) {
      this.firstPersonControls.update();
    } else {
      this.cameraManager.update();
    }
    this.edlPass.render(this.renderer, this.scene, this.activeCamera);
  };
}
