import { describe, it, expect } from "vitest";
import { SampleDatasets } from "../../src/services/SampleDatasets";
import { TextParser } from "../../src/services/TextParser";
import { LASParser } from "../../src/services/LASParser";

describe("SampleDatasets", () => {
  it("defines a list with unique IDs and valid dataset configs", () => {
    expect(SampleDatasets.list.length).toBeGreaterThan(0);
    const ids = new Set<string>();

    for (const dataset of SampleDatasets.list) {
      expect(dataset.id).toBeTruthy();
      expect(dataset.name).toBeTruthy();
      expect(["file", "generator", "binary"]).toContain(dataset.type);
      expect(ids.has(dataset.id)).toBe(false);
      ids.add(dataset.id);

      if (dataset.type === "file") {
        expect(dataset.url).toBeTruthy();
      } else if (dataset.type === "generator") {
        expect(typeof dataset.generate).toBe("function");
      } else if (dataset.type === "binary") {
        expect(typeof dataset.generateBinary).toBe("function");
      }
    }
  });

  describe("procedural generators output valid parseable point clouds", () => {
    it("generateUrbanCity generates valid point cloud", () => {
      const text = SampleDatasets.generateUrbanCity();
      expect(text.length).toBeGreaterThan(100);

      const parsed = TextParser.parse(text);
      expect(parsed).not.toBeNull();
      if (!parsed) return;

      expect(parsed.count).toBeGreaterThan(100);
      expect(parsed.hasRGB).toBe(true);
      expect(parsed.size[0]).toBeGreaterThan(0);
      expect(parsed.size[1]).toBeGreaterThan(0); // Height
    });

    it("generateForestCanyon generates valid terrain and trees", () => {
      const text = SampleDatasets.generateForestCanyon();
      expect(text.length).toBeGreaterThan(100);

      const parsed = TextParser.parse(text);
      expect(parsed).not.toBeNull();
      if (!parsed) return;

      expect(parsed.count).toBeGreaterThan(100);
      expect(parsed.hasRGB).toBe(true);
    });

    it("generateDome generates valid dome and colonnade geometry", () => {
      const text = SampleDatasets.generateDome();
      expect(text.length).toBeGreaterThan(100);

      const parsed = TextParser.parse(text);
      expect(parsed).not.toBeNull();
      if (!parsed) return;

      expect(parsed.count).toBeGreaterThan(100);
      expect(parsed.hasRGB).toBe(true);
    });

    it("generateNorwayFjord generates valid fjord and cliff coordinates", () => {
      const text = SampleDatasets.generateNorwayFjord();
      expect(text.length).toBeGreaterThan(100);

      const parsed = TextParser.parse(text);
      expect(parsed).not.toBeNull();
      if (!parsed) return;

      expect(parsed.count).toBeGreaterThan(100);
      expect(parsed.hasRGB).toBe(true);
    });
  });

  describe("binary generator", () => {
    it("las-survey dataset generates valid binary LAS buffer", () => {
      const dataset = SampleDatasets.list.find((d) => d.id === "las-survey");
      expect(dataset).toBeDefined();
      expect(dataset?.generateBinary).toBeDefined();

      const buffer = dataset!.generateBinary!();
      expect(buffer.byteLength).toBeGreaterThan(1000);
      expect(LASParser.isLAS(buffer)).toBe(true);

      const parsed = LASParser.parse(buffer);
      expect(parsed.count).toBe(30000);
    });
  });
});
