import { describe, it, expect } from "vitest";
import { TextParser } from "../../src/services/TextParser";

describe("TextParser", () => {
  describe("parse", () => {
    it("parses standard space-delimited XYZ point cloud", () => {
      const text = [
        "// Sample comment header",
        "100.0 200.0 50.0",
        "110.0 210.0 60.0",
        "120.0 220.0 70.0"
      ].join("\n");

      const result = TextParser.parse(text);
      expect(result).not.toBeNull();
      if (!result) return;

      expect(result.count).toBe(3);
      expect(result.totalPoints).toBe(3);
      expect(result.hasRGB).toBe(false);
      expect(result.positions.length).toBe(9);
      expect(result.elevations.length).toBe(3);

      // Verify coordinate transformation (X, Y=Elev, Z=Northing) centered at origin
      // Center: X=110, Y(northing)=210, Z(elev)=60
      expect(result.center).toEqual([110, 60, 210]);
      // First point: pos = [100 - 110, 50 - 60, 200 - 210] = [-10, -10, -10]
      expect(result.positions[0]).toBeCloseTo(-10);
      expect(result.positions[1]).toBeCloseTo(-10);
      expect(result.positions[2]).toBeCloseTo(-10);

      // Elevations normalized in [0, 1]
      expect(result.elevations[0]).toBeCloseTo(0.0);
      expect(result.elevations[1]).toBeCloseTo(0.5);
      expect(result.elevations[2]).toBeCloseTo(1.0);
    });

    it("parses comma-delimited XYZRGB point cloud with 0-255 integer colors", () => {
      const text = [
        "# CSV format with 6 columns",
        "0, 0, 10, 255, 0, 0",
        "10, 10, 20, 0, 255, 0",
        "20, 20, 30, 0, 0, 255"
      ].join("\n");

      const result = TextParser.parse(text);
      expect(result).not.toBeNull();
      if (!result) return;

      expect(result.count).toBe(3);
      expect(result.hasRGB).toBe(true);

      // RGB colors normalized to [0, 1]
      expect(result.colors[0]).toBeCloseTo(1.0); // R
      expect(result.colors[1]).toBeCloseTo(0.0); // G
      expect(result.colors[2]).toBeCloseTo(0.0); // B

      expect(result.colors[3]).toBeCloseTo(0.0); // R
      expect(result.colors[4]).toBeCloseTo(1.0); // G
      expect(result.colors[5]).toBeCloseTo(0.0); // B

      expect(result.colors[6]).toBeCloseTo(0.0); // R
      expect(result.colors[7]).toBeCloseTo(0.0); // G
      expect(result.colors[8]).toBeCloseTo(1.0); // B
    });

    it("parses normalized float RGB colors (0.0 - 1.0)", () => {
      const text = [
        "// Normalized floats",
        "0.0 0.0 10.0 0.25 0.50 0.75",
        "1.0 1.0 20.0 0.80 0.20 0.40"
      ].join("\n");

      const result = TextParser.parse(text);
      expect(result).not.toBeNull();
      if (!result) return;

      expect(result.hasRGB).toBe(true);
      expect(result.colors[0]).toBeCloseTo(0.25);
      expect(result.colors[1]).toBeCloseTo(0.50);
      expect(result.colors[2]).toBeCloseTo(0.75);
    });

    it("skips headers like PLY descriptors and empty lines", () => {
      const text = [
        "ply",
        "format ascii 1.0",
        "element vertex 2",
        "property float x",
        "property float y",
        "property float z",
        "end_header",
        "",
        "1.0 2.0 3.0",
        "",
        "4.0 5.0 6.0"
      ].join("\n");

      const result = TextParser.parse(text);
      expect(result).not.toBeNull();
      if (!result) return;

      expect(result.count).toBe(2);
    });

    it("subsamples points when maxPoints is smaller than line count", () => {
      const lines = ["// 100 points"];
      for (let i = 0; i < 100; i++) {
        lines.push(`${i} ${i * 2} ${i * 3}`);
      }

      const result = TextParser.parse(lines.join("\n"), 20);
      expect(result).not.toBeNull();
      if (!result) return;

      expect(result.subsampled).toBe(true);
      expect(result.stride).toBeGreaterThan(1);
      expect(result.count).toBeLessThanOrEqual(50);
      expect(result.totalPoints).toBe(100);
    });

    it("returns null for empty strings or files with only comments", () => {
      expect(TextParser.parse("")).toBeNull();
      expect(TextParser.parse("// Only comments\n# Another comment")).toBeNull();
    });

    it("tolerates malformed lines gracefully", () => {
      const text = [
        "10 20 30",
        "corrupted line with not enough numbers",
        "NaN invalid coordinates",
        "40 50 60"
      ].join("\n");

      const result = TextParser.parse(text);
      expect(result).not.toBeNull();
      if (!result) return;

      expect(result.count).toBe(2);
    });
  });

  describe("streamParse", () => {
    it("parses a Blob file correctly", async () => {
      const content = "10 20 30\n40 50 60\n70 80 90";
      const blob = new Blob([content], { type: "text/plain" });

      const result = await TextParser.streamParse(blob);
      expect(result.count).toBe(3);
      expect(result.center[0]).toBeCloseTo(40);
    });

    it("parses multi-chunk streams and preserves leftover lines across chunk boundaries", async () => {
      const line1 = "10.0 20.0 30.0\n";
      const line2 = "40.0 50.0 60.0\n";
      const line3 = "70.0 80.0 90.0\n";
      const blob = new Blob([line1 + line2 + line3], { type: "text/plain" });

      // Force tiny chunks (15 bytes) to test chunk boundary splitting
      const result = await TextParser.streamParse(blob, 1000, undefined, 15);
      expect(result.count).toBe(3);
      expect(result.center[0]).toBeCloseTo(40);
    });

    it("throws an error when blob contains no valid points", async () => {
      const blob = new Blob(["// Empty comment only\n"], { type: "text/plain" });
      await expect(TextParser.streamParse(blob)).rejects.toThrowError(/No points/);
    });
  });

  describe("parseLine", () => {
    it("returns null for comments or empty lines", () => {
      expect(TextParser.parseLine("")).toBeNull();
      expect(TextParser.parseLine("// comment")).toBeNull();
      expect(TextParser.parseLine("# comment")).toBeNull();
      expect(TextParser.parseLine("ply")).toBeNull();
      expect(TextParser.parseLine("end_header")).toBeNull();
    });

    it("parses 3-value xyz and 6-value xyzrgb", () => {
      expect(TextParser.parseLine("1 2 3")).toEqual({ x: 1, y: 2, z: 3 });
      expect(TextParser.parseLine("1,2,3,255,128,0")).toEqual({ x: 1, y: 2, z: 3, r: 255, g: 128, b: 0 });
    });
  });
});
