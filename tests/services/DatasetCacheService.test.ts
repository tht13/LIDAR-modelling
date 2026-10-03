import { describe, it, expect, beforeEach } from "vitest";
import { DatasetCacheService } from "../../src/services/DatasetCacheService";
import { ParseResult } from "../../src/types";

describe("DatasetCacheService", () => {
  const createSampleResult = (count = 100): ParseResult => {
    return {
      positions: new Float32Array(count * 3),
      colors: new Float32Array(count * 3),
      elevations: new Float32Array(count),
      classifications: new Uint8Array(count),
      count,
      totalPoints: count,
      subsampled: false,
      stride: 1,
      min: [0, 0, 0],
      max: [10, 10, 10],
      center: [5, 5, 5],
      size: [10, 10, 10],
      hasRGB: true
    };
  };

  it("identifies supported environment status", () => {
    expect(typeof DatasetCacheService.isSupported()).toBe("boolean");
  });

  it("enforces maximum entry size limit to prevent saving gigabytes", async () => {
    // If a dataset has > 50MB (which is DatasetCacheService.MAX_ENTRY_BYTES),
    // saveDataset must reject it and return false without storing.
    expect(DatasetCacheService.MAX_ENTRY_BYTES).toBe(50 * 1024 * 1024);
    expect(DatasetCacheService.MAX_TOTAL_BYTES).toBe(150 * 1024 * 1024);

    // Create a mock ParseResult that exceeds MAX_ENTRY_BYTES
    // 50MB in Float32 is ~13.1 million elements, or count of 2,000,000 points
    // (positions 24MB + colors 24MB + elevations 8MB = 56MB > 50MB)
    const largeCount = 2_000_000;
    const mockPositions = { byteLength: 24 * 1024 * 1024 } as Float32Array;
    const mockColors = { byteLength: 24 * 1024 * 1024 } as Float32Array;
    const mockElevations = { byteLength: 8 * 1024 * 1024 } as Float32Array;

    const oversizedResult: ParseResult = {
      positions: mockPositions,
      colors: mockColors,
      elevations: mockElevations,
      count: largeCount,
      min: [0, 0, 0],
      max: [10, 10, 10],
      center: [5, 5, 5],
      size: [10, 10, 10],
      hasRGB: true
    };

    const saved = await DatasetCacheService.saveDataset("oversized-cloud", "test.las", oversizedResult);
    expect(saved).toBe(false);
  });
});
