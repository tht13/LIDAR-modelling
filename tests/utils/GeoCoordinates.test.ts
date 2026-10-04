import { describe, it, expect } from "vitest";
import { GeoCoordinates } from "../../src/utils/GeoCoordinates";

describe("GeoCoordinates", () => {
  it("converts GIS coordinates (East, North, Elev) to Three.js local space correctly", () => {
    const center: [number, number, number] = [500000.0, 100.0, 6000000.0];
    const easting = 500010.0;
    const northing = 6000020.0;
    const elevation = 105.0;

    const [lx, ly, lz] = GeoCoordinates.toLocal(easting, northing, elevation, center);
    expect(lx).toBeCloseTo(-10.0);
    expect(ly).toBeCloseTo(5.0); // Elevation mapped to Y (Up)
    expect(lz).toBeCloseTo(20.0); // Northing mapped to Z
  });

  it("converts Three.js local space back to real-world GIS coordinates accurately", () => {
    const center: [number, number, number] = [500000.0, 100.0, 6000000.0];
    const lx = -10.0;
    const ly = 5.0;
    const lz = 20.0;

    const [east, north, elev] = GeoCoordinates.toWorld(lx, ly, lz, center);
    expect(east).toBeCloseTo(500010.0);
    expect(north).toBeCloseTo(6000020.0);
    expect(elev).toBeCloseTo(105.0);
  });

  it("roundtrips coordinates without loss of precision", () => {
    const center: [number, number, number] = [12345.67, 89.1, 98765.43];
    const orig = [12300.0, 98700.0, 120.0];

    const local = GeoCoordinates.toLocal(orig[0], orig[1], orig[2], center);
    const roundtrip = GeoCoordinates.toWorld(local[0], local[1], local[2], center);

    expect(roundtrip[0]).toBeCloseTo(orig[0]);
    expect(roundtrip[1]).toBeCloseTo(orig[1]);
    expect(roundtrip[2]).toBeCloseTo(orig[2]);
  });

  it("normalizes elevation into [0, 1] range", () => {
    expect(GeoCoordinates.normalizeElevation(10, 0, 20)).toBe(0.5);
    expect(GeoCoordinates.normalizeElevation(0, 0, 20)).toBe(0.0);
    expect(GeoCoordinates.normalizeElevation(20, 0, 20)).toBe(1.0);
    expect(GeoCoordinates.normalizeElevation(5, 5, 0)).toBe(0.0); // Handles 0 span safely
  });

  it("computes bounds structure matching expected layout", () => {
    const bounds = GeoCoordinates.computeBounds(0, 100, 200, 400, 10, 50);

    expect(bounds.center).toEqual([50, 30, 300]); // [centerX, centerZ_elev, centerY_north]
    expect(bounds.min).toEqual([0, 10, 200]);
    expect(bounds.max).toEqual([100, 50, 400]);
    expect(bounds.size).toEqual([100, 40, 200]);
  });
});
