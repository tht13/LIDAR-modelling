import { describe, it, expect } from "vitest";
import { LASParser } from "../../src/services/LASParser";

describe("LASParser", () => {
  describe("isLAS", () => {
    it("returns true for buffer starting with 'LASF'", () => {
      const buffer = new ArrayBuffer(4);
      const view = new Uint8Array(buffer);
      view[0] = 0x4c; // L
      view[1] = 0x41; // A
      view[2] = 0x53; // S
      view[3] = 0x46; // F
      expect(LASParser.isLAS(buffer)).toBe(true);
    });

    it("returns false for short or invalid buffers", () => {
      expect(LASParser.isLAS(new ArrayBuffer(3))).toBe(false);

      const invalid = new ArrayBuffer(4);
      new Uint8Array(invalid).set([0x4c, 0x41, 0x53, 0x00]);
      expect(LASParser.isLAS(invalid)).toBe(false);
    });
  });

  describe("createSampleLAS & parse", () => {
    it("creates a valid LAS 1.2 buffer and parses points correctly", () => {
      const numPoints = 100;
      const buffer = LASParser.createSampleLAS(numPoints);
      expect(LASParser.isLAS(buffer)).toBe(true);

      const result = LASParser.parse(buffer);
      expect(result.count).toBe(numPoints);
      expect(result.totalPoints).toBe(numPoints);
      expect(result.positions.length).toBe(numPoints * 3);
      expect(result.colors.length).toBe(numPoints * 3);
      expect(result.elevations.length).toBe(numPoints);
      expect(result.hasRGB).toBe(true);

      // Coordinates must be centered around (0, 0, 0)
      let sumX = 0, sumY = 0, sumZ = 0;
      for (let i = 0; i < result.count; i++) {
        sumX += result.positions[i * 3];
        sumY += result.positions[i * 3 + 1];
        sumZ += result.positions[i * 3 + 2];
      }
      expect(Math.abs(sumX / result.count)).toBeLessThan(10.0);
      expect(Math.abs(sumY / result.count)).toBeLessThan(10.0);
      expect(Math.abs(sumZ / result.count)).toBeLessThan(10.0);

      // Elevations normalized in [0, 1]
      for (let i = 0; i < result.count; i++) {
        expect(result.elevations[i]).toBeGreaterThanOrEqual(0.0);
        expect(result.elevations[i]).toBeLessThanOrEqual(1.0);
      }

      // Colors normalized in [0, 1]
      for (let i = 0; i < result.colors.length; i++) {
        expect(result.colors[i]).toBeGreaterThanOrEqual(0.0);
        expect(result.colors[i]).toBeLessThanOrEqual(1.0);
      }
    });

    it("applies stride subsampling when maxPoints is smaller than total points", () => {
      const numPoints = 200;
      const buffer = LASParser.createSampleLAS(numPoints);
      const maxBudget = 50;
      const result = LASParser.parse(buffer, maxBudget);

      expect(result.subsampled).toBe(true);
      expect(result.stride).toBeGreaterThan(1);
      expect(result.count).toBeLessThanOrEqual(numPoints);
      expect(result.totalPoints).toBe(numPoints);
    });

    it("auto-recovers pointCount when header states 0 points but buffer contains records", () => {
      const buffer = LASParser.createSampleLAS(20);
      const view = new DataView(buffer);
      view.setUint32(107, 0, true); // set header pointCount to 0
      const result = LASParser.parse(buffer);
      expect(result.count).toBe(20);
    });

    it("throws an error when buffer does not start with LASF", () => {
      const buffer = new ArrayBuffer(500);
      expect(() => LASParser.parse(buffer)).toThrowError(/Invalid LAS file signature/);
    });

    it("throws an error when LAS file contains 0 point records and buffer has no point payload", () => {
      // Create a buffer that only contains the header (227 bytes), without any point records
      const full = LASParser.createSampleLAS(10);
      const headerOnly = full.slice(0, 227);
      const view = new DataView(headerOnly);
      view.setUint32(107, 0, true);
      expect(() => LASParser.parse(headerOnly)).toThrowError(/contains 0 point records/);
    });
  });

  describe("streamParse", () => {
    it("streams a LAS blob chunk-by-chunk and reports progress", async () => {
      const numPoints = 150;
      const buffer = LASParser.createSampleLAS(numPoints);
      const blob = new Blob([buffer], { type: "application/octet-stream" });

      const progressLog: number[] = [];
      const result = await LASParser.streamParse(blob, 1000, (pct) => {
        progressLog.push(pct);
      });

      expect(result.count).toBe(numPoints);
      expect(result.totalPoints).toBe(numPoints);
      expect(result.positions.length).toBe(numPoints * 3);
      expect(result.hasRGB).toBe(true);
      expect(progressLog.length).toBeGreaterThan(0);
    });

    it("applies budget stride decimation when streaming large LAS blobs", async () => {
      const numPoints = 300;
      const buffer = LASParser.createSampleLAS(numPoints);
      const blob = new Blob([buffer], { type: "application/octet-stream" });

      const result = await LASParser.streamParse(blob, 50);
      expect(result.subsampled).toBe(true);
      expect(result.stride).toBeGreaterThan(1);
      expect(result.count).toBeLessThanOrEqual(numPoints);
    });

    it("throws an error when streaming a blob with invalid signature", async () => {
      const invalidBlob = new Blob([new ArrayBuffer(500)], { type: "application/octet-stream" });
      await expect(LASParser.streamParse(invalidBlob)).rejects.toThrowError(/Invalid LAS file signature/);
    });
  });
});
