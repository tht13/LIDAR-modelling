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

  private isMouseDown = false;
  private prevMouseX = 0;
  private prevMouseY = 0;

  private euler = new THREE.Euler(0, 0, 0, "YXZ");
  private speed = 120.0; // units per second
  private lastTime = performance.now();

  constructor(viewer: Viewer) {
    this.viewer = viewer;
    this.domElement = viewer.renderer.domElement;

    this.bindEvents();
  }

  public setEnabled(val: boolean): void {
    this.enabled = val;
    this.viewer.controls.enabled = !val;

    if (val) {
      // Sync euler angles with current camera orientation
      this.euler.setFromQuaternion(this.viewer.perspCamera.quaternion);
      this.lastTime = performance.now();
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
    const moveDist = this.speed * delta;

    const forward = new THREE.Vector3();
    camera.getWorldDirection(forward);

    const right = new THREE.Vector3();
    right.crossVectors(forward, camera.up).normalize();

    // Horizontal look direction for walking forward/backward
    const horizontalForward = new THREE.Vector3(forward.x, 0, forward.z).normalize();

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

    // Update orbit controls target to maintain camera look direction when switching back
    this.viewer.controls.target.copy(camera.position).addScaledVector(forward, 100);
  }

  private bindEvents(): void {
    window.addEventListener("keydown", (e: KeyboardEvent) => {
      if (!this.enabled) return;

      switch (e.code) {
        case "KeyW":
        case "ArrowUp":
          this.moveForward = true;
          break;
        case "KeyS":
        case "ArrowDown":
          this.moveBackward = true;
          break;
        case "KeyA":
        case "ArrowLeft":
          this.moveLeft = true;
          break;
        case "KeyD":
        case "ArrowRight":
          this.moveRight = true;
          break;
        case "Space":
          this.moveUp = true;
          e.preventDefault();
          break;
        case "KeyC":
        case "ControlLeft":
        case "ControlRight":
          this.moveDown = true;
          break;
        case "ShiftLeft":
        case "ShiftRight":
          this.speed = 300.0; // Sprint speed
          break;
      }
    });

    window.addEventListener("keyup", (e: KeyboardEvent) => {
      if (!this.enabled) return;

      switch (e.code) {
        case "KeyW":
        case "ArrowUp":
          this.moveForward = false;
          break;
        case "KeyS":
        case "ArrowDown":
          this.moveBackward = false;
          break;
        case "KeyA":
        case "ArrowLeft":
          this.moveLeft = false;
          break;
        case "KeyD":
        case "ArrowRight":
          this.moveRight = false;
          break;
        case "Space":
          this.moveUp = false;
          break;
        case "KeyC":
        case "ControlLeft":
        case "ControlRight":
          this.moveDown = false;
          break;
        case "ShiftLeft":
        case "ShiftRight":
          this.speed = 120.0;
          break;
      }
    });

    this.domElement.addEventListener("mousedown", (e: MouseEvent) => {
      if (!this.enabled) return;
      this.isMouseDown = true;
      this.prevMouseX = e.clientX;
      this.prevMouseY = e.clientY;
    });

    window.addEventListener("mouseup", () => {
      this.isMouseDown = false;
    });

    window.addEventListener("mousemove", (e: MouseEvent) => {
      if (!this.enabled || !this.isMouseDown) return;

      const deltaX = e.clientX - this.prevMouseX;
      const deltaY = e.clientY - this.prevMouseY;
      this.prevMouseX = e.clientX;
      this.prevMouseY = e.clientY;

      const sensitivity = 0.0028;
      this.euler.y -= deltaX * sensitivity;
      this.euler.x -= deltaY * sensitivity;

      // Clamp pitch to avoid flipping over (+/- 89 degrees)
      const maxPitch = Math.PI / 2 - 0.01;
      this.euler.x = Math.max(-maxPitch, Math.min(maxPitch, this.euler.x));

      this.viewer.perspCamera.quaternion.setFromEuler(this.euler);
    });

    this.domElement.addEventListener("wheel", (e: WheelEvent) => {
      if (!this.enabled) return;
      // Adjust fly speed with wheel
      this.speed = Math.max(20, Math.min(800, this.speed - e.deltaY * 0.2));
    }, { passive: true });
  }
}
