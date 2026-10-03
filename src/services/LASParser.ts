import { ParseResult } from "../types";

export class LASParser {
  /**
   * Check if ArrayBuffer is a valid LAS/LAZ file (starts with 'LASF')
   */
  public static isLAS(buffer: ArrayBuffer): boolean {
    if (buffer.byteLength < 4) return false;
    const bytes = new Uint8Array(buffer, 0, 4);
    return bytes[0] === 0x4c && bytes[1] === 0x41 && bytes[2] === 0x53 && bytes[3] === 0x46; // "LASF"
  }

  /**
   * Parse a binary LAS file (LAS 1.0 - 1.4, Point Formats 0, 1, 2, 3, 6, 7, 8)
   */
  public static parse(buffer: ArrayBuffer): ParseResult {
    const view = new DataView(buffer);

    // Verify signature
    const sig = String.fromCharCode(view.getUint8(0), view.getUint8(1), view.getUint8(2), view.getUint8(3));
    if (sig !== "LASF") {
      throw new Error("Invalid LAS file signature: " + sig);
    }

    const versionMajor = view.getUint8(24);
    const versionMinor = view.getUint8(25);
    const headerSize = view.getUint16(94, true);
    const offsetToPoints = view.getUint32(96, true);
    const pointFormat = view.getUint8(104);
    const pointRecordLength = view.getUint16(105, true);
    let pointCount = view.getUint32(107, true);

    const scaleX = view.getFloat64(131, true);
    const scaleY = view.getFloat64(139, true);
    const scaleZ = view.getFloat64(147, true);
    const offsetX = view.getFloat64(155, true);
    const offsetY = view.getFloat64(163, true);
    const offsetZ = view.getFloat64(171, true);

    let maxX = view.getFloat64(179, true);
    let minX = view.getFloat64(187, true);
    let maxY = view.getFloat64(195, true);
    let minY = view.getFloat64(203, true);
    let maxZ = view.getFloat64(211, true);
    let minZ = view.getFloat64(219, true);

    // LAS 1.4 64-bit point count support
    if (versionMajor === 1 && versionMinor >= 4 && pointCount === 0 && buffer.byteLength >= 255) {
      const bigCount = view.getBigUint64(247, true);
      pointCount = Number(bigCount);
    }

    // Safety check: calculate max points available from file length
    const availablePoints = Math.max(0, Math.floor((buffer.byteLength - offsetToPoints) / pointRecordLength));
    if (pointCount === 0 || pointCount > availablePoints) {
      pointCount = availablePoints;
    }

    if (pointCount === 0) {
      throw new Error("LAS file contains 0 point records");
    }

    // Determine color offsets based on format
    const hasRGB = (pointFormat === 2 || pointFormat === 3 || pointFormat === 7 || pointFormat === 8);
    let rgbOffset = -1;
    if (pointFormat === 2) rgbOffset = 20;
    else if (pointFormat === 3) rgbOffset = 28;
    else if (pointFormat === 7 || pointFormat === 8) rgbOffset = 30;

    // First pass or using header bounds
    let computedMinX = Infinity, computedMaxX = -Infinity;
    let computedMinY = Infinity, computedMaxY = -Infinity;
    let computedMinZ = Infinity, computedMaxZ = -Infinity;

    // Temporary storage for raw coords
    const rawX = new Float64Array(pointCount);
    const rawY = new Float64Array(pointCount);
    const rawZ = new Float64Array(pointCount);
    const rawR = hasRGB ? new Float32Array(pointCount) : null;
    const rawG = hasRGB ? new Float32Array(pointCount) : null;
    const rawB = hasRGB ? new Float32Array(pointCount) : null;

    let maxColorVal = 0;

    for (let i = 0; i < pointCount; i++) {
      const pOffset = offsetToPoints + i * pointRecordLength;
      if (pOffset + 12 > buffer.byteLength) break;

      const px = view.getInt32(pOffset, true) * scaleX + offsetX;
      const py = view.getInt32(pOffset + 4, true) * scaleY + offsetY;
      const pz = view.getInt32(pOffset + 8, true) * scaleZ + offsetZ;

      rawX[i] = px;
      rawY[i] = py;
      rawZ[i] = pz;

      if (px < computedMinX) computedMinX = px;
      if (px > computedMaxX) computedMaxX = px;
      if (py < computedMinY) computedMinY = py;
      if (py > computedMaxY) computedMaxY = py;
      if (pz < computedMinZ) computedMinZ = pz;
      if (pz > computedMaxZ) computedMaxZ = pz;

      if (hasRGB && rawR && rawG && rawB && rgbOffset > 0 && pOffset + rgbOffset + 6 <= buffer.byteLength) {
        const r = view.getUint16(pOffset + rgbOffset, true);
        const g = view.getUint16(pOffset + rgbOffset + 2, true);
        const b = view.getUint16(pOffset + rgbOffset + 4, true);
        rawR[i] = r;
        rawG[i] = g;
        rawB[i] = b;
        if (r > maxColorVal) maxColorVal = r;
        if (g > maxColorVal) maxColorVal = g;
        if (b > maxColorVal) maxColorVal = b;
      }
    }

    if (computedMinX !== Infinity) {
      minX = computedMinX; maxX = computedMaxX;
      minY = computedMinY; maxY = computedMaxY;
      minZ = computedMinZ; maxZ = computedMaxZ;
    }

    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;
    const centerZ = (minZ + maxZ) / 2;
    const zSpan = maxZ - minZ || 1.0;

    const positions = new Float32Array(pointCount * 3);
    const colors = new Float32Array(pointCount * 3);
    const elevations = new Float32Array(pointCount);

    const colorDivisor = maxColorVal > 255 ? 65535.0 : (maxColorVal > 1.0 ? 255.0 : 1.0);

    for (let i = 0; i < pointCount; i++) {
      const rx = rawX[i];
      const ry = rawY[i];
      const rz = rawZ[i];

      // Coordinate mapping: Three.js (X, Y=Elev, Z=Northing)
      positions[i * 3] = rx - centerX;
      positions[i * 3 + 1] = rz - centerZ;
      positions[i * 3 + 2] = ry - centerY;

      if (hasRGB && rawR && rawG && rawB) {
        colors[i * 3] = rawR[i] / colorDivisor;
        colors[i * 3 + 1] = rawG[i] / colorDivisor;
        colors[i * 3 + 2] = rawB[i] / colorDivisor;
      } else {
        colors[i * 3] = 1.0;
        colors[i * 3 + 1] = 1.0;
        colors[i * 3 + 2] = 1.0;
      }

      elevations[i] = (rz - minZ) / zSpan;
    }

    return {
      positions,
      colors,
      elevations,
      count: pointCount,
      min: [minX, minZ, minY],
      max: [maxX, maxZ, maxY],
      center: [centerX, centerZ, centerY],
      size: [maxX - minX, maxZ - minZ, maxY - minY],
      hasRGB: hasRGB && maxColorVal > 0
    };
  }

  /**
   * Helper to create a binary LAS 1.2 Point Format 2 buffer procedurally for testing and demo datasets
   */
  public static createSampleLAS(numPoints = 25000): ArrayBuffer {
    const headerSize = 227;
    const pointRecordLength = 26; // Format 2 (XYZ + Intensity + Flags + Class + Angle + User + Source + RGB)
    const totalSize = headerSize + numPoints * pointRecordLength;
    const buffer = new ArrayBuffer(totalSize);
    const view = new DataView(buffer);
    const bytes = new Uint8Array(buffer);

    // Signature "LASF"
    bytes[0] = 0x4c; bytes[1] = 0x41; bytes[2] = 0x53; bytes[3] = 0x46;
    // Version 1.2
    bytes[24] = 1;
    bytes[25] = 2;
    // Header size
    view.setUint16(94, headerSize, true);
    // Offset to points
    view.setUint32(96, headerSize, true);
    // Point record format: 2
    view.setUint8(104, 2);
    // Point record length: 26
    view.setUint16(105, pointRecordLength, true);
    // Point count
    view.setUint32(107, numPoints, true);

    const scale = 0.01;
    view.setFloat64(131, scale, true); // scaleX
    view.setFloat64(139, scale, true); // scaleY
    view.setFloat64(147, scale, true); // scaleZ
    view.setFloat64(155, 500000.0, true); // offsetX
    view.setFloat64(163, 6000000.0, true); // offsetY
    view.setFloat64(171, 100.0, true); // offsetZ

    // Fill simulated LiDAR terrain points
    const side = Math.floor(Math.sqrt(numPoints));
    let idx = 0;
    for (let xi = 0; xi < side; xi++) {
      for (let yi = 0; yi < side && idx < numPoints; yi++) {
        const offset = headerSize + idx * pointRecordLength;
        const worldX = (xi - side / 2) * 2.5;
        const worldY = (yi - side / 2) * 2.5;
        const dist = Math.sqrt(worldX * worldX + worldY * worldY);
        const worldZ = Math.cos(dist * 0.05) * 20 + Math.sin(worldX * 0.1) * 10;

        view.setInt32(offset, Math.round(worldX / scale), true);
        view.setInt32(offset + 4, Math.round(worldY / scale), true);
        view.setInt32(offset + 8, Math.round(worldZ / scale), true);
        view.setUint16(offset + 12, 1000, true); // intensity

        // 16-bit RGB (Format 2)
        const rNorm = 0.2 + 0.6 * ((worldZ + 30) / 60);
        const gNorm = 0.6 + 0.3 * Math.sin(dist * 0.08);
        const bNorm = 0.3;
        view.setUint16(offset + 20, Math.floor(rNorm * 65535), true); // Red
        view.setUint16(offset + 22, Math.floor(gNorm * 65535), true); // Green
        view.setUint16(offset + 24, Math.floor(bNorm * 65535), true); // Blue
        idx++;
      }
    }

    return buffer;
  }
}
