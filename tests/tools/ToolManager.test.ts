import { describe, it, expect } from "vitest";
import * as THREE from "three";
import { ToolManager } from "../../src/tools/ToolManager";

describe("ToolManager", () => {
  const createMockViewer = () => {
    const domElement = document.createElement("div");
    return {
      renderer: { domElement },
      controls: { enabled: true },
      firstPersonControls: {
        enabled: false,
        setEnabled(val: boolean) { this.enabled = val; },
        isEnabled() { return this.enabled; }
      },
      scene: new THREE.Scene(),
      activeCamera: new THREE.PerspectiveCamera(),
      pointCloud: null
    } as any;
  };

  it("initializes with default mode 'orbit'", () => {
    const viewer = createMockViewer();
    const manager = new ToolManager(viewer);
    expect(manager.getMode()).toBe("orbit");
    expect(manager.measurementTool).toBeDefined();
    expect(manager.profileTool).toBeDefined();
    expect(manager.inspectorTool).toBeDefined();
  });

  it("switches to 'measure' mode, updates cursor and disables orbit controls", () => {
    const viewer = createMockViewer();
    const manager = new ToolManager(viewer);

    manager.setMode("measure");
    expect(manager.getMode()).toBe("measure");
    expect(viewer.renderer.domElement.style.cursor).toBe("crosshair");
    expect(viewer.controls.enabled).toBe(false);
  });

  it("switches to 'profile' mode, updates cursor and disables orbit controls", () => {
    const viewer = createMockViewer();
    const manager = new ToolManager(viewer);

    manager.setMode("profile");
    expect(manager.getMode()).toBe("profile");
    expect(viewer.renderer.domElement.style.cursor).toBe("crosshair");
    expect(viewer.controls.enabled).toBe(false);
  });

  it("switches to 'inspect' mode, updates cursor and leaves orbit controls enabled", () => {
    const viewer = createMockViewer();
    const manager = new ToolManager(viewer);

    manager.setMode("inspect");
    expect(manager.getMode()).toBe("inspect");
    expect(viewer.renderer.domElement.style.cursor).toBe("crosshair");
    expect(viewer.controls.enabled).toBe(true);
  });

  it("switches to 'fly' mode, sets firstPersonControls and cursor to grab", () => {
    const viewer = createMockViewer();
    const manager = new ToolManager(viewer);

    manager.setMode("fly");
    expect(manager.getMode()).toBe("fly");
    expect(viewer.renderer.domElement.style.cursor).toBe("grab");
    expect(viewer.firstPersonControls.isEnabled()).toBe(true);
  });

  it("switches back to 'orbit' mode restoring default state", () => {
    const viewer = createMockViewer();
    const manager = new ToolManager(viewer);

    manager.setMode("measure");
    manager.setMode("orbit");
    expect(manager.getMode()).toBe("orbit");
    expect(viewer.renderer.domElement.style.cursor).toBe("default");
    expect(viewer.controls.enabled).toBe(true);
  });
});
