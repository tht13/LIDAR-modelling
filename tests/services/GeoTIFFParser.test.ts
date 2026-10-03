import { describe, it, expect, vi, beforeEach } from "vitest";
import { fromArrayBuffer } from "geotiff";
import { GeoTIFFParser } from "../../src/services/GeoTIFFParser";

vi.mock("geotiff", () => {
  return {
    fromArrayBuffer: vi.fn(),
    fromBlob: vi.fn()
  };
});

describe("GeoTIFFParser", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("isTIFF", () => {
    it("recognizes classic little-endian TIFF (II*\\0)", () => {
      const buf = new Uint8Array([0x49, 0x49, 0x2a, 0x00]);
      expect(GeoTIFFParser.isTIFF(buf.buffer)).toBe(true);
      expect(GeoTIFFParser.isTIFF(buf)).toBe(true);
    });

    it("recognizes classic big-endian TIFF (MM\\0*)", () => {
      const buf = new Uint8Array([0x4d, 0x4d, 0x00, 0x2a]);
      expect(GeoTIFFParser.isTIFF(buf.buffer)).toBe(true);
    });

    it("recognizes BigTIFF little-endian (II+\\0) and big-endian (MM\\0+)", () => {
      const buf1 = new Uint8Array([0x49, 0x49, 0x2b, 0x00]);
      const buf2 = new Uint8Array([0x4d, 0x4d, 0x00, 0x2b]);
      expect(GeoTIFFParser.isTIFF(buf1.buffer)).toBe(true);
      expect(GeoTIFFParser.isTIFF(buf2.buffer)).toBe(true);
    });

    it("rejects invalid or short headers", () => {
      expect(GeoTIFFParser.isTIFF(new ArrayBuffer(2))).toBe(false);
      expect(GeoTIFFParser.isTIFF(new Uint8Array([0x00, 0x00, 0x00, 0x00]))).toBe(false);
      expect(GeoTIFFParser.isTIFF(new Uint8Array([0x4c, 0x41, 0x53, 0x46]))).toBe(false); // LASF
    });
  });

  describe("parse with mocked geotiff library", () => {
    it("converts raster elevation into 3D points with geographic coordinate scaling", async () => {
      const mockImage = {
        getWidth: () => 3,
        getHeight: () => 2,
        getBoundingBox: () => [10.0, 50.0, 10.3, 50.2], // Geographic degrees (lat/lon)
        readRasters: vi.fn().mockResolvedValue([[100, 150, 200, 250, 300, 350]]),
        getGDALNoData: () => -9999
      };

      const mockTiff = {
        getImage: vi.fn().mockResolvedValue(mockImage)
      };

      vi.mocked(fromArrayBuffer).mockResolvedValue(mockTiff as any);

      const buffer = new ArrayBuffer(16);
      const result = await GeoTIFFParser.parse(buffer, 100);

      expect(result.count).toBe(6);
      expect(result.totalPoints).toBe(6);
      expect(result.subsampled).toBe(false);
      expect(result.hasRGB).toBe(false);
      expect(result.positions.length).toBe(18);
      expect(result.elevations.length).toBe(6);

      // Verify elevations normalized between 0.0 (100m) and 1.0 (350m)
      expect(result.elevations[0]).toBeCloseTo(0.0);
      expect(result.elevations[5]).toBeCloseTo(1.0);

      // Verify geographic degrees were converted to metric meters (scale factor ~ 111320)
      expect(result.size[0]).toBeGreaterThan(1000); // Longitude span in meters
      expect(result.size[2]).toBeGreaterThan(1000); // Latitude span in meters
    });

    it("filters out GDAL NoData and extreme out-of-range elevation values", async () => {
      const mockImage = {
        getWidth: () => 2,
        getHeight: () => 2,
        getBoundingBox: () => [0, 0, 10, 10], // Projected meters
        readRasters: vi.fn().mockResolvedValue([[-9999, 500, 12000, 750]]), // -9999 is NoData, 12000 > 9500 (above Everest)
        getGDALNoData: () => -9999
      };

      const mockTiff = {
        getImage: vi.fn().mockResolvedValue(mockImage)
      };

      vi.mocked(fromArrayBuffer).mockResolvedValue(mockTiff as any);

      const buffer = new ArrayBuffer(16);
      const result = await GeoTIFFParser.parse(buffer);

      // Only points 500 and 750 are valid
      expect(result.count).toBe(2);
      expect(result.elevations[0]).toBeCloseTo(0.0); // 500m min
      expect(result.elevations[1]).toBeCloseTo(1.0); // 750m max
    });

    it("throws an error when all elevation pixels are NoData or out of range", async () => {
      const mockImage = {
        getWidth: () => 2,
        getHeight: () => 2,
        getBoundingBox: () => [0, 0, 10, 10],
        readRasters: vi.fn().mockResolvedValue([[-9999, -9999, -9999, -9999]]),
        getGDALNoData: () => -9999
      };

      const mockTiff = {
        getImage: vi.fn().mockResolvedValue(mockImage)
      };

      vi.mocked(fromArrayBuffer).mockResolvedValue(mockTiff as any);

      const buffer = new ArrayBuffer(16);
      await expect(GeoTIFFParser.parse(buffer)).rejects.toThrowError(/No valid elevation data found/);
    });
  });
});
