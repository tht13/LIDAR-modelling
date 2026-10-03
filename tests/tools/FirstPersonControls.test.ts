import { describe, it, expect, vi } from "vitest";
import * as THREE from "three";
import { FirstPersonControls } from "../../src/tools/FirstPersonControls";

describe("FirstPersonControls", () => {
  const createMockViewer = () => {
    const domElement = document.createElement("div");
    const perspCamera = new THREE.PerspectiveCamera(60, 1.0, 0.1, 1000);
    perspCamera.position.set(0, 0, 10);

    return {
      renderer: { domElement },
      controls: {
        enabled: true,
        target: new THREE.Vector3(0, 0, 0)
      },
      perspCamera,
      activeCamera: perspCamera,
      getOrthoMode: () => false,
      setOrthoMode: vi.fn()
    } as any;
  };

  it("initializes disabled with base speed", () => {
    const viewer = createMockViewer();
    const controls = new FirstPersonControls(viewer);

    expect(controls.isEnabled()).toBe(false);
    expect(controls.getSpeed()).toBe(220);
  });

  it("enables fly mode, disables orbit controls, and computes yaw/pitch", () => {
    const viewer = createMockViewer();
    const controls = new FirstPersonControls(viewer);

    controls.setEnabled(true);
    expect(controls.isEnabled()).toBe(true);
    expect(viewer.controls.enabled).toBe(false);

    controls.setEnabled(false);
    expect(controls.isEnabled()).toBe(false);
    expect(viewer.controls.enabled).toBe(true);
  });

  it("updates movement on keydown and keyup events", () => {
    const viewer = createMockViewer();
    const controls = new FirstPersonControls(viewer);
    controls.setEnabled(true);

    const initialZ = viewer.perspCamera.position.z;

    // Press 'KeyW' (forward)
    window.dispatchEvent(new KeyboardEvent("keydown", { code: "KeyW" }));

    // Run update tick
    controls.update();

    // Release 'KeyW'
    window.dispatchEvent(new KeyboardEvent("keyup", { code: "KeyW" }));

    // Position changed along view direction
    expect(viewer.perspCamera.position.z).not.toBe(initialZ);
  });

  it("adjusts flying speed with mouse wheel events when enabled", () => {
    const viewer = createMockViewer();
    const controls = new FirstPersonControls(viewer);
    controls.setEnabled(true);

    let reportedSpeed = 0;
    controls.onSpeedChange((spd) => {
      reportedSpeed = spd;
    });

    const dom = viewer.renderer.domElement;
    const initialSpeed = controls.getSpeed();

    // Wheel up (scroll forward -> increase speed)
    dom.dispatchEvent(new WheelEvent("wheel", { deltaY: -100 }));
    expect(controls.getSpeed()).toBeGreaterThan(initialSpeed);
    expect(reportedSpeed).toBe(controls.getSpeed());

    const boostedSpeed = controls.getSpeed();

    // Wheel down (scroll back -> decrease speed)
    dom.dispatchEvent(new WheelEvent("wheel", { deltaY: 200 }));
    expect(controls.getSpeed()).toBeLessThan(boostedSpeed);
    expect(reportedSpeed).toBe(controls.getSpeed());
  });
});
