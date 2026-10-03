import { PointCloud } from "../core/PointCloud";

export class ExportService {
  /**
   * Export the point cloud (full or filtered) to standard PLY (ASCII format)
   */
  public static exportToPLY(pointCloud: PointCloud, onlyActive = true): Blob {
    const indexAttr = pointCloud.geometry.getIndex();
    const useIndices = onlyActive && indexAttr !== null;
    const count = useIndices ? indexAttr.count : pointCloud.data.count;

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

    pointCloud.forEachActivePoint((realX, realY, realZ, r, g, b) => {
      const red = Math.round(r * 255);
      const green = Math.round(g * 255);
      const blue = Math.round(b * 255);
      lines.push(`${realX.toFixed(3)} ${realY.toFixed(3)} ${realZ.toFixed(3)} ${red} ${green} ${blue}\n`);
    }, onlyActive);

    return new Blob(lines, { type: "model/ply" });
  }

  /**
   * Export the point cloud (full or filtered) to XYZ / CSV text format
   */
  public static exportToXYZ(pointCloud: PointCloud, onlyActive = true): Blob {
    const lines: string[] = ["// X Y Z R G B\n"];

    pointCloud.forEachActivePoint((realX, realY, realZ, r, g, b) => {
      lines.push(`${realX.toFixed(3)} ${realY.toFixed(3)} ${realZ.toFixed(3)} ${r.toFixed(3)} ${g.toFixed(3)} ${b.toFixed(3)}\n`);
    }, onlyActive);

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
