import { PointCloud } from "../core/PointCloud";

export class ExportService {
  /**
   * Export the point cloud (full or filtered) to standard PLY (ASCII format)
   */
  public static exportToPLY(pointCloud: PointCloud, onlyActive = true): Blob {
    const data = pointCloud.data;
    const pos = data.positions;
    const colors = data.colors;
    const center = data.center;
    const hasRGB = data.hasRGB;

    const indexAttr = pointCloud.geometry.getIndex();
    const useIndices = onlyActive && indexAttr !== null;
    const count = useIndices ? indexAttr.count : data.count;

    const header = [
      "ply",
      "format ascii 1.0",
      "comment Exported from LIDAR Viewer",
      `element vertex ${count}`,
      "property float x",
      "property float y",
      "property float z",
      "property uchar red",
      "property uchar green",
      "property uchar blue",
      "end_header\n"
    ].join("\n");

    const lines: string[] = [header];

    for (let i = 0; i < count; i++) {
      const idx = useIndices ? indexAttr.getX(i) : i;
      const pIdx = idx * 3;

      // Restore real world coordinates
      const realX = pos[pIdx] + center[0];
      const realZ = pos[pIdx + 1] + center[1]; // Elev
      const realY = pos[pIdx + 2] + center[2]; // Northing

      const r = Math.round((colors[pIdx] || 1.0) * 255);
      const g = Math.round((colors[pIdx + 1] || 1.0) * 255);
      const b = Math.round((colors[pIdx + 2] || 1.0) * 255);

      lines.push(`${realX.toFixed(3)} ${realY.toFixed(3)} ${realZ.toFixed(3)} ${r} ${g} ${b}\n`);
    }

    return new Blob(lines, { type: "model/ply" });
  }

  /**
   * Export the point cloud (full or filtered) to XYZ / CSV text format
   */
  public static exportToXYZ(pointCloud: PointCloud, onlyActive = true): Blob {
    const data = pointCloud.data;
    const pos = data.positions;
    const colors = data.colors;
    const center = data.center;

    const indexAttr = pointCloud.geometry.getIndex();
    const useIndices = onlyActive && indexAttr !== null;
    const count = useIndices ? indexAttr.count : data.count;

    const lines: string[] = ["// X Y Z R G B\n"];

    for (let i = 0; i < count; i++) {
      const idx = useIndices ? indexAttr.getX(i) : i;
      const pIdx = idx * 3;

      const realX = pos[pIdx] + center[0];
      const realZ = pos[pIdx + 1] + center[1];
      const realY = pos[pIdx + 2] + center[2];

      const r = (colors[pIdx] || 1.0).toFixed(3);
      const g = (colors[pIdx + 1] || 1.0).toFixed(3);
      const b = (colors[pIdx + 2] || 1.0).toFixed(3);

      lines.push(`${realX.toFixed(3)} ${realY.toFixed(3)} ${realZ.toFixed(3)} ${r} ${g} ${b}\n`);
    }

    return new Blob(lines, { type: "text/plain" });
  }

  /**
   * Triggers a browser download of the given blob
   */
  public static saveBlob(blob: Blob, fileName: string): void {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 1000);
  }
}
