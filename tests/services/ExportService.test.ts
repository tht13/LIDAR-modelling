import { describe, it, expect, vi } from "vitest";
import { ExportService } from "../../src/services/ExportService";
import { PointCloud } from "../../src/core/PointCloud";
import { ParseResult } from "../../src/types";

describe("ExportService", () => {
  const createMockPointCloud = (count = 5): PointCloud => {
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const elevations = new Float32Array(count);

    for (let i = 0; i < count; i++) {
      positions[i * 3] = i * 2.0;       // X
      positions[i * 3 + 1] = i * 3.0;   // Y (Elev)
      positions[i * 3 + 2] = i * 4.0;   // Z (Northing)

      colors[i * 3] = 0.2;     // R
      colors[i * 3 + 1] = 0.4; // G
      colors[i * 3 + 2] = 0.6; // B

      elevations[i] = i / count;
    }

    const data: ParseResult = {
      positions,
      colors,
      elevations,
      count,
      totalPoints: count,
      subsampled: false,
      stride: 1,
      min: [0, 0, 0],
      max: [100, 100, 100],
      center: [500000.0, 100.0, 6000000.0],
      size: [100, 100, 100],
      hasRGB: true
    };

    return new PointCloud(data);
  };

  describe("exportToPLY", () => {
    it("exports valid ASCII PLY header and restores real coordinates", async () => {
      const pc = createMockPointCloud(4);
      const blob = ExportService.exportToPLY(pc, false);

      expect(blob.type).toBe("model/ply");
      const text = await blob.text();

      expect(text).toContain("ply\n");
      expect(text).toContain("format ascii 1.0\n");
      expect(text).toContain("element vertex 4\n");
      expect(text).toContain("property float x\n");
      expect(text).toContain("property uchar red\n");
      expect(text).toContain("end_header\n");

      // Verify first point (X=0 + 500000, Y=0 + 6000000, Z=0 + 100, R=51, G=102, B=153)
      expect(text).toContain("500000.000 6000000.000 100.000 51 102 153");
    });

    it("respects active filter index when onlyActive is true", async () => {
      const pc = createMockPointCloud(10);
      pc.applyDecimation(0.5); // Filter down to 5 points
      const activeCount = pc.getActivePointCount();

      const blob = ExportService.exportToPLY(pc, true);
      const text = await blob.text();

      expect(text).toContain(`element vertex ${activeCount}\n`);
    });
  });

  describe("exportToXYZ", () => {
    it("exports valid XYZ text file with header and real coordinates", async () => {
      const pc = createMockPointCloud(3);
      const blob = ExportService.exportToXYZ(pc, false);

      expect(blob.type).toBe("text/plain");
      const text = await blob.text();

      expect(text).toContain("// X Y Z R G B\n");
      expect(text).toContain("500000.000 6000000.000 100.000 0.200 0.400 0.600");
    });
  });

  describe("saveBlob", () => {
    it("triggers file download anchor without throwing", () => {
      const blob = new Blob(["test"], { type: "text/plain" });
      expect(() => ExportService.saveBlob(blob, "test.txt")).not.toThrow();
    });
  });
});
