import { describe, it, expect, vi } from "vitest";
import * as THREE from "three";
import { EDLPass } from "../../src/shaders/EDLPass";

describe("EDLPass", () => {
  it("initializes with default strength, radius, and render target", () => {
    const pass = new EDLPass(800, 600);
    expect(pass.enabled).toBe(true);
    expect(pass.strength).toBeCloseTo(1.4);
    expect(pass.radius).toBeCloseTo(1.8);
  });

  it("updates resolution, strength, and radius uniforms", () => {
    const pass = new EDLPass(800, 600);

    pass.setSize(1024, 768);
    pass.setStrength(2.5);
    expect(pass.strength).toBe(2.5);

    pass.setRadius(3.0);
    expect(pass.radius).toBe(3.0);
  });

  it("renders with disabled pass directly to screen", () => {
    const pass = new EDLPass(800, 600);
    pass.enabled = false;

    const mockRenderer = {
      setRenderTarget: vi.fn(),
      render: vi.fn()
    } as any;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera();

    pass.render(mockRenderer, scene, camera);
    expect(mockRenderer.setRenderTarget).toHaveBeenCalledWith(null);
    expect(mockRenderer.render).toHaveBeenCalledWith(scene, camera);
  });

  it("renders with enabled EDL pass using offscreen target and post quad", () => {
    const pass = new EDLPass(800, 600);
    pass.enabled = true;

    const mockRenderer = {
      setRenderTarget: vi.fn(),
      render: vi.fn()
    } as any;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(60, 1.33, 0.5, 1000);

    pass.render(mockRenderer, scene, camera);
    expect(mockRenderer.setRenderTarget).toHaveBeenCalledTimes(2);
    expect(mockRenderer.render).toHaveBeenCalledTimes(2);
  });

  it("disposes resources cleanly", () => {
    const pass = new EDLPass(800, 600);
    expect(() => pass.dispose()).not.toThrow();
  });
});
