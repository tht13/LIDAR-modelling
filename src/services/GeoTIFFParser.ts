import { fromBlob, fromArrayBuffer, GeoTIFF, GeoTIFFImage } from "geotiff";
import { ParseResult } from "../types";

export class GeoTIFFParser {
  /**
   * Check if ArrayBuffer or Uint8Array begins with standard TIFF or BigTIFF magic header:
   * "II*\0" (0x49492A00), "MM\0*" (0x4D4D002A), "II+\0" (0x49492B00), "MM\0+" (0x4D4D002B)
   */
  public static isTIFF(buffer: ArrayBuffer | Uint8Array): boolean {
    if (buffer.byteLength < 4) return false;
    const b = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer, 0, 4);
    const isClassic = (b[0] === 0x49 && b[1] === 0x49 && b[2] === 0x2A && b[3] === 0x00) ||
                      (b[0] === 0x4D && b[1] === 0x4D && b[2] === 0x00 && b[3] === 0x2A);
    const isBigTIFF = (b[0] === 0x49 && b[1] === 0x49 && b[2] === 0x2B && b[3] === 0x00) ||
                      (b[0] === 0x4D && b[1] === 0x4D && b[2] === 0x00 && b[3] === 0x2B);
    return isClassic || isBigTIFF;
  }

  /**
   * Parse a GeoTIFF elevation raster (.tif / .tiff) and convert it into a 3D terrain point cloud.
   * Handles:
   * - Geographic Lon/Lat degrees -> metric meters scaling for realistic 1:1 elevation.
   * - GDAL NoData and out-of-range value rejection.
   * - Automatic spatial grid subsampling to honor user import point budget.
   */
  public static async parse(
    source: Blob | ArrayBuffer,
    maxPoints: number = 5_000_000,
    onProgress?: (percent: number, statusText: string) => void
  ): Promise<ParseResult> {
    if (onProgress) onProgress(15, "Opening GeoTIFF structure...");

    let buffer: ArrayBuffer;
    if (source instanceof Blob) {
      if (onProgress) onProgress(20, "Loading TIFF into memory...");
      buffer = await source.arrayBuffer();
    } else {
      buffer = source;
    }

    if (onProgress) onProgress(28, "Parsing TIFF headers...");
    const tiff: GeoTIFF = await fromArrayBuffer(buffer);

    const image: GeoTIFFImage = await tiff.getImage();
    const width = image.getWidth();
    const height = image.getHeight();

    if (onProgress) onProgress(35, `Decoding elevation raster (${width.toLocaleString()} × ${height.toLocaleString()})...`);

    // Determine geographic / projected bounding box
    let bbox = [0, 0, width, height];
    try {
      const geoBbox = image.getBoundingBox();
      if (geoBbox && geoBbox.length === 4 && isFinite(geoBbox[0]) && isFinite(geoBbox[2])) {
        bbox = geoBbox;
      }
    } catch {
      // Fall back to pixel dimension bounds
    }

    const [minX, minY, maxX, maxY] = bbox;
    const isGeographic = Math.abs(minX) <= 180 && Math.abs(maxX) <= 180 && Math.abs(minY) <= 90 && Math.abs(maxY) <= 90;

    // Convert degrees to metric meters for natural vertical-to-horizontal scaling
    const midLat = (minY + maxY) / 2;
    const latMetersPerDeg = 111320;
    const lonMetersPerDeg = 111320 * Math.cos((midLat * Math.PI) / 180);

    const scaleX = isGeographic ? lonMetersPerDeg : 1;
    const scaleY = isGeographic ? latMetersPerDeg : 1;

    const minX_m = minX * scaleX;
    const maxX_m = maxX * scaleX;
    const minY_m = minY * scaleY;
    const maxY_m = maxY * scaleY;

    const dx_m = (maxX_m - minX_m) / width;
    const dy_m = (maxY_m - minY_m) / height;

    // Calculate grid step for decimation
    const totalPixels = width * height;
    const step = (maxPoints > 0 && totalPixels > maxPoints)
      ? Math.max(1, Math.ceil(Math.sqrt(totalPixels / maxPoints)))
      : 1;

    // Read elevation raster data
    const rasters = await image.readRasters();
    const rawElevations = rasters[0] as any;

    let noDataVal: number | null = null;
    try {
      const gdalNoData = image.getGDALNoData();
      if (gdalNoData !== null && gdalNoData !== undefined) {
        noDataVal = typeof gdalNoData === "number" ? gdalNoData : parseFloat(String(gdalNoData));
      }
    } catch {
      // Ignored
    }

    if (onProgress) onProgress(60, "Filtering & generating 3D terrain points...");

    const sampledCols = Math.ceil(width / step);
    const sampledRows = Math.ceil(height / step);
    const maxAlloc = sampledCols * sampledRows;

    const tempX = new Float32Array(maxAlloc);
    const tempY = new Float32Array(maxAlloc);
    const tempZ = new Float32Array(maxAlloc);

    let validCount = 0;
    let minZ = Infinity, maxZ = -Infinity;

    for (let r = 0; r < height; r += step) {
      const rowOffset = r * width;
      // In raster convention, row 0 is at the top (maxY_m) and increases southwards
      const py = maxY_m - (r + 0.5) * dy_m;

      for (let c = 0; c < width; c += step) {
        const val = rawElevations[rowOffset + c];

        // Filter NoData, NaN, and unreasonable elevations
        if (!isFinite(val)) continue;
        if (noDataVal !== null && Math.abs(val - noDataVal) < 1e-4) continue;
        if (val < -1000 || val > 9500) continue; // Below Dead Sea or above Everest

        const px = minX_m + (c + 0.5) * dx_m;

        tempX[validCount] = px;
        tempY[validCount] = py;
        tempZ[validCount] = val;

        if (val < minZ) minZ = val;
        if (val > maxZ) maxZ = val;

        validCount++;
      }
    }

    if (validCount === 0) {
      throw new Error("No valid elevation data found in GeoTIFF (all pixels were NoData or invalid)");
    }

    if (onProgress) onProgress(85, "Packing 3D coordinates...");

    const centerX = (minX_m + maxX_m) / 2;
    const centerY = (minY_m + maxY_m) / 2;
    const centerZ = (minZ + maxZ) / 2;
    const zSpan = maxZ - minZ || 1.0;

    const positions = new Float32Array(validCount * 3);
    const colors = new Float32Array(validCount * 3);
    const elevations = new Float32Array(validCount);

    for (let i = 0; i < validCount; i++) {
      const rx = tempX[i];
      const ry = tempY[i];
      const rz = tempZ[i];

      // Coordinate mapping: Three.js (X, Y=Elev, Z=Northing)
      positions[i * 3] = rx - centerX;
      positions[i * 3 + 1] = rz - centerZ;
      positions[i * 3 + 2] = ry - centerY;

      colors[i * 3] = 1.0;
      colors[i * 3 + 1] = 1.0;
      colors[i * 3 + 2] = 1.0;

      elevations[i] = (rz - minZ) / zSpan;
    }

    if (onProgress) onProgress(98, "Ready to render");

    return {
      positions,
      colors,
      elevations,
      count: validCount,
      totalPoints: totalPixels,
      subsampled: step > 1,
      stride: step,
      min: [minX_m, minZ, minY_m],
      max: [maxX_m, maxZ, maxY_m],
      center: [centerX, centerZ, centerY],
      size: [maxX_m - minX_m, maxZ - minZ, maxY_m - minY_m],
      hasRGB: false
    };
  }
}
