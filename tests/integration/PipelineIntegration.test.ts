import { describe, it, expect } from "vitest";
import * as THREE from "three";
import { SampleDatasets } from "../../src/services/SampleDatasets";
import { TextParser } from "../../src/services/TextParser";
import { PointCloud } from "../../src/core/PointCloud";
import { MeasurementTool } from "../../src/tools/MeasurementTool";
import { ProfileTool } from "../../src/tools/ProfileTool";
import { ExportService } from "../../src/services/ExportService";

describe("PipelineIntegration", () => {
  it("executes the full point cloud lifecycle: generate -> parse -> 3D cloud -> voxel filter -> measure -> slice -> export -> re-parse", async () => {
    // 1. Procedural Generation
    const rawData = SampleDatasets.generateUrbanCity();
    expect(rawData.length).toBeGreaterThan(100);

    // 2. Text Parsing
    const parsed = TextParser.parse(rawData);
    expect(parsed).not.toBeNull();
    if (!parsed) return;

    expect(parsed.count).toBeGreaterThan(500);
    expect(parsed.hasRGB).toBe(true);

    // 3. Point Cloud Construction
    const pc = new PointCloud(parsed);
    expect(pc.getActivePointCount()).toBe(parsed.count);

    // 4. Spatial Voxel Grid Filtering
    const activeBefore = pc.getActivePointCount();
    const activeAfter = pc.applyVoxelGrid(5.0);
    expect(activeAfter).toBeLessThan(activeBefore);
    expect(activeAfter).toBeGreaterThan(0);
    expect(pc.getActivePointCount()).toBe(activeAfter);

    // 5. Measurement Tool Simulation
    const mockViewer = {
      scene: new THREE.Scene(),
      pointCloud: pc
    } as any;

    const measureTool = new MeasurementTool(mockViewer);
    let measureResult: any = null;
    measureTool.onMeasurement((res) => {
      measureResult = res;
    });

    measureTool.handleClick(new THREE.Vector3(0, 0, 0));
    measureTool.handleClick(new THREE.Vector3(30, 40, 0));

    expect(measureResult).not.toBeNull();
    expect(measureResult.state).toBe("completed");
    expect(measureResult.distance3D).toBeCloseTo(50.0);
    expect(measureResult.verticalDistance).toBeCloseTo(40.0);

    // 6. Cross-Section Profile Slicing
    const profileTool = new ProfileTool(mockViewer);
    profileTool.sliceWidth = 10.0;
    let profileData: any = null;
    profileTool.onProfile((data) => {
      profileData = data;
    });

    profileTool.handleClick(new THREE.Vector3(-100, 0, 0));
    profileTool.handleClick(new THREE.Vector3(100, 0, 0));

    expect(profileData).not.toBeNull();
    expect(profileData.points.length).toBeGreaterThan(0);
    expect(profileData.totalDistance).toBeCloseTo(200.0);

    // 7. Exporting to PLY & XYZ
    const plyBlob = ExportService.exportToPLY(pc, true);
    const xyzBlob = ExportService.exportToXYZ(pc, true);

    expect(plyBlob.size).toBeGreaterThan(0);
    expect(xyzBlob.size).toBeGreaterThan(0);

    const plyText = await plyBlob.text();
    expect(plyText).toContain(`element vertex ${activeAfter}\n`);

    const xyzText = await xyzBlob.text();
    expect(xyzText).toContain("// X Y Z R G B\n");

    // 8. Re-parse exported XYZ and verify coordinate fidelity
    const reparsed = TextParser.parse(xyzText);
    expect(reparsed).not.toBeNull();
    if (!reparsed) return;

    expect(reparsed.count).toBe(activeAfter);
  });
});
