import * as THREE from "three";
import { Viewer } from "../core/Viewer";

export class FirstPersonControls {
  private viewer: Viewer;
  private domElement: HTMLElement;
  private enabled: boolean = false;

  private moveForward = false;
  private moveBackward = false;
  private moveLeft = false;
  private moveRight = false;
  private moveUp = false;
  private moveDown = false;
  private isTurbo = false;

  private isMouseDown = false;
  private prevMouseX = 0;
  private prevMouseY = 0;

  private euler = new THREE.Euler(0, 0, 0, "YXZ");
  private baseSpeed = 220.0;
  private lastTime = performance.now();
  private onSpeedChangeCallback?: (speed: number) => void;

  constructor(viewer: Viewer) {
    this.viewer = viewer;
    this.domElement = viewer.renderer.domElement;

    this.bindEvents();
  }

  public onSpeedChange(cb: (speed: number) => void): void {
    this.onSpeedChangeCallback = cb;
  }

  public getSpeed(): number {
    return Math.round(this.baseSpeed);
  }

  public setEnabled(val: boolean): void {
    this.enabled = val;
    this.viewer.controls.enabled = !val;

    if (val) {
      // Ensure perspective camera is active
      if (this.viewer.getOrthoMode()) {
        this.viewer.setOrthoMode(false);
      }

      const camera = this.viewer.perspCamera;
      this.viewer.activeCamera = camera;

      // Calculate yaw and pitch from current camera orientation
      const dir = new THREE.Vector3();
      camera.getWorldDirection(dir);
      dir.normalize();

      // Yaw around Y axis (atan2(-x, -z) in Three.js right-handed coordinate system)
      this.euler.y = Math.atan2(-dir.x, -dir.z);
      // Pitch around X axis
      this.euler.x = Math.asin(Math.max(-0.999, Math.min(0.999, dir.y)));
      this.euler.z = 0;

      camera.quaternion.setFromEuler(this.euler);

      // Adaptive speed based on model scale
      const sphere = this.viewer.pointCloud?.getBoundingSphere();
      if (sphere && sphere.radius > 50) {
        this.baseSpeed = Math.max(120, sphere.radius * 0.4);
      } else {
        this.baseSpeed = 220;
      }

      this.lastTime = performance.now();
      this.resetMovement();

      if (this.onSpeedChangeCallback) {
        this.onSpeedChangeCallback(Math.round(this.baseSpeed));
      }
    } else {
      if (document.pointerLockElement === this.domElement) {
        document.exitPointerLock();
      }
      this.resetMovement();
    }
  }

  public isEnabled(): boolean {
    return this.enabled;
  }

  public update(): void {
    if (!this.enabled) return;

    const time = performance.now();
    const delta = Math.min(0.1, (time - this.lastTime) / 1000);
    this.lastTime = time;

    const camera = this.viewer.perspCamera;
    const currentSpeed = this.isTurbo ? this.baseSpeed * 2.5 : this.baseSpeed;
    const moveDist = currentSpeed * delta;

    const forward = new THREE.Vector3();
    camera.getWorldDirection(forward);

    const right = new THREE.Vector3();
    right.crossVectors(forward, camera.up).normalize();

    if (this.moveForward) {
      camera.position.addScaledVector(forward, moveDist);
    }
    if (this.moveBackward) {
      camera.position.addScaledVector(forward, -moveDist);
    }
    if (this.moveRight) {
      camera.position.addScaledVector(right, moveDist);
    }
    if (this.moveLeft) {
      camera.position.addScaledVector(right, -moveDist);
    }
    if (this.moveUp) {
      camera.position.y += moveDist;
    }
    if (this.moveDown) {
      camera.position.y -= moveDist;
    }

    // Keep orbit controls target positioned forward so switching back is seamless
    this.viewer.controls.target.copy(camera.position).addScaledVector(forward, 150);
  }

  private resetMovement(): void {
    this.moveForward = false;
    this.moveBackward = false;
    this.moveLeft = false;
    this.moveRight = false;
    this.moveUp = false;
    this.moveDown = false;
    this.isTurbo = false;
    this.isMouseDown = false;
  }

  private bindEvents(): void {
    // Keyboard key down
    window.addEventListener("keydown", (e: KeyboardEvent) => {
      if (!this.enabled) return;

      const target = e.target as HTMLElement;
      if (target && (target.tagName === "INPUT" || target.tagName === "SELECT" || target.tagName === "TEXTAREA")) {
        return;
      }

      const key = e.key.toLowerCase();
      const code = e.code;

      if (key === "w" || code === "KeyW" || code === "ArrowUp") {
        this.moveForward = true;
      } else if (key === "s" || code === "KeyS" || code === "ArrowDown") {
        this.moveBackward = true;
      } else if (key === "a" || code === "KeyA" || code === "ArrowLeft") {
        this.moveLeft = true;
      } else if (key === "d" || code === "KeyD" || code === "ArrowRight") {
        this.moveRight = true;
      } else if (key === " " || code === "Space") {
        this.moveUp = true;
        e.preventDefault();
      } else if (key === "c" || code === "KeyC" || key === "control" || code === "ControlLeft" || code === "ControlRight") {
        this.moveDown = true;
      } else if (key === "shift" || code === "ShiftLeft" || code === "ShiftRight") {
        this.isTurbo = true;
      }
    });

    // Keyboard key up
    window.addEventListener("keyup", (e: KeyboardEvent) => {
      if (!this.enabled) return;

      const key = e.key.toLowerCase();
      const code = e.code;

      if (key === "w" || code === "KeyW" || code === "ArrowUp") {
        this.moveForward = false;
      } else if (key === "s" || code === "KeyS" || code === "ArrowDown") {
        this.moveBackward = false;
      } else if (key === "a" || code === "KeyA" || code === "ArrowLeft") {
        this.moveLeft = false;
      } else if (key === "d" || code === "KeyD" || code === "ArrowRight") {
        this.moveRight = false;
      } else if (key === " " || code === "Space") {
        this.moveUp = false;
      } else if (key === "c" || code === "KeyC" || key === "control" || code === "ControlLeft" || code === "ControlRight") {
        this.moveDown = false;
      } else if (key === "shift" || code === "ShiftLeft" || code === "ShiftRight") {
        this.isTurbo = false;
      }
    });

    // Canvas click: request pointer lock for effortless looking
    this.domElement.addEventListener("click", () => {
      if (this.enabled && document.pointerLockElement !== this.domElement) {
        this.domElement.requestPointerLock?.();
      }
    });

    // Pointer / Mouse Down for drag look
    this.domElement.addEventListener("pointerdown", (e: PointerEvent) => {
      if (!this.enabled) return;
      this.isMouseDown = true;
      this.prevMouseX = e.clientX;
      this.prevMouseY = e.clientY;
    });

    window.addEventListener("pointerup", () => {
      this.isMouseDown = false;
    });

    // Pointer / Mouse Move (handles both PointerLock and Click-Drag)
    window.addEventListener("pointermove", (e: PointerEvent) => {
      if (!this.enabled) return;

      const isLocked = document.pointerLockElement === this.domElement;
      if (!isLocked && !this.isMouseDown) return;

      let deltaX = 0;
      let deltaY = 0;

      if (isLocked) {
        deltaX = e.movementX || 0;
        deltaY = e.movementY || 0;
      } else {
        deltaX = e.clientX - this.prevMouseX;
        deltaY = e.clientY - this.prevMouseY;
        this.prevMouseX = e.clientX;
        this.prevMouseY = e.clientY;
      }

      const sensitivity = 0.0024;
      this.euler.y -= deltaX * sensitivity;
      this.euler.x -= deltaY * sensitivity;

      // Clamp pitch (-89 to +89 degrees)
      const maxPitch = Math.PI / 2 - 0.02;
      this.euler.x = Math.max(-maxPitch, Math.min(maxPitch, this.euler.x));

      this.viewer.perspCamera.quaternion.setFromEuler(this.euler);
    });

    // Mouse wheel adjusts fly speed
    this.domElement.addEventListener("wheel", (e: WheelEvent) => {
      if (!this.enabled) return;
      const factor = e.deltaY > 0 ? 0.85 : 1.18;
      this.baseSpeed = Math.max(25, Math.min(2500, this.baseSpeed * factor));
      if (this.onSpeedChangeCallback) {
        this.onSpeedChangeCallback(Math.round(this.baseSpeed));
      }
    }, { passive: true });
  }
}
