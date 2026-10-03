import { ParseResult } from "../types";
import { GeoCoordinates } from "../utils/GeoCoordinates";

export interface LASHeader {
  versionMajor: number;
  versionMinor: number;
  offsetToPoints: number;
  pointFormat: number;
  pointRecordLength: number;
  pointCount: number;
  scaleX: number;
  scaleY: number;
  scaleZ: number;
  offsetX: number;
  offsetY: number;
  offsetZ: number;
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  minZ: number;
  maxZ: number;
  hasRGB: boolean;
  rgbOffset: number;
}

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
   * Reads and validates the standard LAS 1.0 - 1.4 header from a DataView
   */
  public static readHeader(view: DataView, totalByteLength: number): LASHeader {
    const sig = String.fromCharCode(view.getUint8(0), view.getUint8(1), view.getUint8(2), view.getUint8(3));
    if (sig !== "LASF") {
      throw new Error("Invalid LAS file signature: " + sig);
    }

    const versionMajor = view.getUint8(24);
    const versionMinor = view.getUint8(25);
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

    const maxX = view.getFloat64(179, true);
    const minX = view.getFloat64(187, true);
    const maxY = view.getFloat64(195, true);
    const minY = view.getFloat64(203, true);
    const maxZ = view.getFloat64(211, true);
    const minZ = view.getFloat64(219, true);

    // LAS 1.4 64-bit point count support
    if (versionMajor === 1 && versionMinor >= 4 && pointCount === 0 && view.byteLength >= 255) {
      const bigCount = view.getBigUint64(247, true);
      pointCount = Number(bigCount);
    }

    // Safety check: calculate max points available from file length
    const availablePoints = Math.max(0, Math.floor((totalByteLength - offsetToPoints) / pointRecordLength));
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

    return {
      versionMajor,
      versionMinor,
      offsetToPoints,
      pointFormat,
      pointRecordLength,
      pointCount,
      scaleX,
      scaleY,
      scaleZ,
      offsetX,
      offsetY,
      offsetZ,
      minX,
      maxX,
      minY,
      maxY,
      minZ,
      maxZ,
      hasRGB,
      rgbOffset
    };
  }

  /**
   * Probes RGB bit depth (16-bit vs 8-bit) and returns color divisor (65535.0, 255.0, or 1.0)
   */
  public static probeColorDivisor(
    view: DataView,
    offsetToPoints: number,
    pointRecordLength: number,
    rgbOffset: number,
    pointCount: number,
    maxBytes: number
  ): number {
    if (rgbOffset <= 0) return 1.0;
    const probePoints = Math.min(pointCount, 2000);
    const step = Math.max(1, Math.floor(probePoints / 100));
    let maxColorVal = 0;

    for (let i = 0; i < probePoints; i += step) {
      const off = offsetToPoints + i * pointRecordLength + rgbOffset;
      if (off + 6 <= maxBytes) {
        const r = view.getUint16(off, true);
        const g = view.getUint16(off + 2, true);
        const b = view.getUint16(off + 4, true);
        if (r > maxColorVal) maxColorVal = r;
        if (g > maxColorVal) maxColorVal = g;
        if (b > maxColorVal) maxColorVal = b;
      }
    }

    return maxColorVal > 255 ? 65535.0 : (maxColorVal > 1.0 ? 255.0 : 1.0);
  }

  /**
   * Parse a binary LAS file (LAS 1.0 - 1.4, Point Formats 0, 1, 2, 3, 6, 7, 8)
   * Supports stride decimation to guarantee safe memory usage on large files.
   */
  public static parse(buffer: ArrayBuffer, maxPoints: number = 5_000_000): ParseResult {
    const view = new DataView(buffer);
    const header = this.readHeader(view, buffer.byteLength);

    let { minX, maxX, minY, maxY, minZ, maxZ } = header;
    const { offsetToPoints, pointRecordLength, pointCount, scaleX, scaleY, scaleZ, offsetX, offsetY, offsetZ, hasRGB, rgbOffset } = header;

    // Check if header bounding box is valid. If uninitialized, quickly sample bounds.
    const validBounds = (maxX > minX || maxY > minY || maxZ > minZ) && isFinite(minX) && isFinite(maxX);
    if (!validBounds) {
      minX = Infinity; maxX = -Infinity;
      minY = Infinity; maxY = -Infinity;
      minZ = Infinity; maxZ = -Infinity;
      const sampleStride = Math.max(1, Math.floor(pointCount / 1000));
      for (let i = 0; i < pointCount; i += sampleStride) {
        const off = offsetToPoints + i * pointRecordLength;
        if (off + 12 > buffer.byteLength) break;
        const px = view.getInt32(off, true) * scaleX + offsetX;
        const py = view.getInt32(off + 4, true) * scaleY + offsetY;
        const pz = view.getInt32(off + 8, true) * scaleZ + offsetZ;
        if (px < minX) minX = px; if (px > maxX) maxX = px;
        if (py < minY) minY = py; if (py > maxY) maxY = py;
        if (pz < minZ) minZ = pz; if (pz > maxZ) maxZ = pz;
      }
      if (!isFinite(minX)) { minX = 0; maxX = 1; minY = 0; maxY = 1; minZ = 0; maxZ = 1; }
    }

    const bounds = GeoCoordinates.computeBounds(minX, maxX, minY, maxY, minZ, maxZ);
    const zSpan = maxZ - minZ || 1.0;

    // Calculate stride for target point budget
    const stride = (maxPoints > 0 && pointCount > maxPoints) ? Math.ceil(pointCount / maxPoints) : 1;
    const targetCount = Math.ceil(pointCount / stride);

    const positions = new Float32Array(targetCount * 3);
    const colors = new Float32Array(targetCount * 3);
    const elevations = new Float32Array(targetCount);
    const classifications = new Uint8Array(targetCount);

    const colorDivisor = hasRGB ? this.probeColorDivisor(view, offsetToPoints, pointRecordLength, rgbOffset, pointCount, buffer.byteLength) : 1.0;

    let outIndex = 0;
    for (let i = 0; i < pointCount && outIndex < targetCount; i += stride) {
      const pOffset = offsetToPoints + i * pointRecordLength;
      if (pOffset + 12 > buffer.byteLength) break;

      const px = view.getInt32(pOffset, true) * scaleX + offsetX;
      const py = view.getInt32(pOffset + 4, true) * scaleY + offsetY;
      const pz = view.getInt32(pOffset + 8, true) * scaleZ + offsetZ;

      // Coordinate mapping: Three.js (X = East, Y = Elev, Z = Northing)
      const [lx, ly, lz] = GeoCoordinates.toLocal(px, py, pz, bounds.center);
      positions[outIndex * 3] = lx;
      positions[outIndex * 3 + 1] = ly;
      positions[outIndex * 3 + 2] = lz;

      elevations[outIndex] = GeoCoordinates.normalizeElevation(pz, minZ, zSpan);

      // Classification byte (LAS formats 0-5 byte 15, formats 6-10 byte 16)
      if (header.pointFormat <= 5 && pOffset + 16 <= buffer.byteLength) {
        classifications[outIndex] = view.getUint8(pOffset + 15) & 0x1f; // Bits 0-4 are ASPRS classification
      } else if (header.pointFormat >= 6 && pOffset + 17 <= buffer.byteLength) {
        classifications[outIndex] = view.getUint8(pOffset + 16);
      }

      if (hasRGB && rgbOffset > 0 && pOffset + rgbOffset + 6 <= buffer.byteLength) {
        colors[outIndex * 3] = view.getUint16(pOffset + rgbOffset, true) / colorDivisor;
        colors[outIndex * 3 + 1] = view.getUint16(pOffset + rgbOffset + 2, true) / colorDivisor;
        colors[outIndex * 3 + 2] = view.getUint16(pOffset + rgbOffset + 4, true) / colorDivisor;
      } else {
        colors[outIndex * 3] = 1.0;
        colors[outIndex * 3 + 1] = 1.0;
        colors[outIndex * 3 + 2] = 1.0;
      }

      outIndex++;
    }

    return {
      positions: outIndex === targetCount ? positions : positions.subarray(0, outIndex * 3),
      colors: outIndex === targetCount ? colors : colors.subarray(0, outIndex * 3),
      elevations: outIndex === targetCount ? elevations : elevations.subarray(0, outIndex),
      classifications: outIndex === targetCount ? classifications : classifications.subarray(0, outIndex),
      count: outIndex,
      totalPoints: pointCount,
      subsampled: stride > 1,
      stride,
      min: bounds.min,
      max: bounds.max,
      center: bounds.center,
      size: bounds.size,
      hasRGB: hasRGB && colorDivisor > 0
    };
  }

  /**
   * Stream binary LAS/LAZ file chunk-by-chunk using Blob.slice()
   * Does NOT load the entire file into memory at once!
   */
  public static async streamParse(
    file: Blob,
    maxPoints: number = 5_000_000,
    onProgress?: (percent: number, statusText: string) => void
  ): Promise<ParseResult> {
    const headerBuf = await file.slice(0, Math.min(file.size, 1024)).arrayBuffer();
    const view = new DataView(headerBuf);
    const header = this.readHeader(view, file.size);

    let { minX, maxX, minY, maxY, minZ, maxZ } = header;
    const { offsetToPoints, pointRecordLength, pointCount, scaleX, scaleY, scaleZ, offsetX, offsetY, offsetZ, hasRGB, rgbOffset } = header;

    // Validate bounding box from header
    const validBounds = (maxX > minX || maxY > minY || maxZ > minZ) && isFinite(minX) && isFinite(maxX);
    if (!validBounds) {
      minX = Infinity; maxX = -Infinity;
      minY = Infinity; maxY = -Infinity;
      minZ = Infinity; maxZ = -Infinity;
      const probeCount = Math.min(pointCount, 2000);
      const probeStep = Math.max(1, Math.floor(pointCount / probeCount));
      for (let i = 0; i < pointCount && i < probeCount * probeStep; i += probeStep) {
        const bStart = offsetToPoints + i * pointRecordLength;
        const bBuf = await file.slice(bStart, bStart + 12).arrayBuffer();
        if (bBuf.byteLength >= 12) {
          const dv = new DataView(bBuf);
          const px = dv.getInt32(0, true) * scaleX + offsetX;
          const py = dv.getInt32(4, true) * scaleY + offsetY;
          const pz = dv.getInt32(8, true) * scaleZ + offsetZ;
          if (px < minX) minX = px; if (px > maxX) maxX = px;
          if (py < minY) minY = py; if (py > maxY) maxY = py;
          if (pz < minZ) minZ = pz; if (pz > maxZ) maxZ = pz;
        }
      }
      if (!isFinite(minX)) { minX = 0; maxX = 1; minY = 0; maxY = 1; minZ = 0; maxZ = 1; }
    }

    const bounds = GeoCoordinates.computeBounds(minX, maxX, minY, maxY, minZ, maxZ);
    const zSpan = maxZ - minZ || 1.0;

    // Stride decimation to target budget
    const stride = (maxPoints > 0 && pointCount > maxPoints) ? Math.ceil(pointCount / maxPoints) : 1;
    const targetCount = Math.ceil(pointCount / stride);

    const positions = new Float32Array(targetCount * 3);
    const colors = new Float32Array(targetCount * 3);
    const elevations = new Float32Array(targetCount);
    const classifications = new Uint8Array(targetCount);

    // Probe color bit depth
    let colorDivisor = 1.0;
    if (hasRGB && rgbOffset > 0) {
      const probeLen = Math.min(1000 * pointRecordLength, file.size - offsetToPoints);
      const probeChunk = await file.slice(offsetToPoints, offsetToPoints + probeLen).arrayBuffer();
      const probeView = new DataView(probeChunk);
      const probeN = Math.floor(probeChunk.byteLength / pointRecordLength);
      colorDivisor = this.probeColorDivisor(probeView, 0, pointRecordLength, rgbOffset, probeN, probeChunk.byteLength);
    }

    // Stream in 16MB slices (approx 500,000 point records per chunk)
    const CHUNK_POINTS = 500_000;
    let outIndex = 0;
    let nextSamplePoint = 0;

    for (let chunkStart = 0; chunkStart < pointCount && outIndex < targetCount; chunkStart += CHUNK_POINTS) {
      const chunkEnd = Math.min(pointCount, chunkStart + CHUNK_POINTS);
      const byteStart = offsetToPoints + chunkStart * pointRecordLength;
      const byteEnd = offsetToPoints + chunkEnd * pointRecordLength;

      const chunkBuffer = await file.slice(byteStart, byteEnd).arrayBuffer();
      const chunkView = new DataView(chunkBuffer);

      while (nextSamplePoint < chunkEnd && outIndex < targetCount) {
        const localIndex = nextSamplePoint - chunkStart;
        const pOffset = localIndex * pointRecordLength;

        if (pOffset + 12 > chunkBuffer.byteLength) break;

        const px = chunkView.getInt32(pOffset, true) * scaleX + offsetX;
        const py = chunkView.getInt32(pOffset + 4, true) * scaleY + offsetY;
        const pz = chunkView.getInt32(pOffset + 8, true) * scaleZ + offsetZ;

        // Coordinate mapping: Three.js (X = East, Y = Elev, Z = Northing)
        const [lx, ly, lz] = GeoCoordinates.toLocal(px, py, pz, bounds.center);
        positions[outIndex * 3] = lx;
        positions[outIndex * 3 + 1] = ly;
        positions[outIndex * 3 + 2] = lz;

        elevations[outIndex] = GeoCoordinates.normalizeElevation(pz, minZ, zSpan);

        if (header.pointFormat <= 5 && pOffset + 16 <= chunkBuffer.byteLength) {
          classifications[outIndex] = chunkView.getUint8(pOffset + 15) & 0x1f;
        } else if (header.pointFormat >= 6 && pOffset + 17 <= chunkBuffer.byteLength) {
          classifications[outIndex] = chunkView.getUint8(pOffset + 16);
        }

        if (hasRGB && rgbOffset > 0 && pOffset + rgbOffset + 6 <= chunkBuffer.byteLength) {
          colors[outIndex * 3] = chunkView.getUint16(pOffset + rgbOffset, true) / colorDivisor;
          colors[outIndex * 3 + 1] = chunkView.getUint16(pOffset + rgbOffset + 2, true) / colorDivisor;
          colors[outIndex * 3 + 2] = chunkView.getUint16(pOffset + rgbOffset + 4, true) / colorDivisor;
        } else {
          colors[outIndex * 3] = 1.0;
          colors[outIndex * 3 + 1] = 1.0;
          colors[outIndex * 3 + 2] = 1.0;
        }

        outIndex++;
        nextSamplePoint += stride;
      }

      if (onProgress) {
        const pct = Math.min(99, Math.round((chunkEnd / pointCount) * 100));
        onProgress(pct, `Streaming: ${outIndex.toLocaleString()} / ${pointCount.toLocaleString()} points (${pct}%)...`);
      }
    }

    return {
      positions: outIndex === targetCount ? positions : positions.subarray(0, outIndex * 3),
      colors: outIndex === targetCount ? colors : colors.subarray(0, outIndex * 3),
      elevations: outIndex === targetCount ? elevations : elevations.subarray(0, outIndex),
      classifications: outIndex === targetCount ? classifications : classifications.subarray(0, outIndex),
      count: outIndex,
      totalPoints: pointCount,
      subsampled: stride > 1,
      stride,
      min: bounds.min,
      max: bounds.max,
      center: bounds.center,
      size: bounds.size,
      hasRGB: hasRGB && colorDivisor > 0
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

        // Classification byte (byte 15 in format 2)
        // 2: Ground, 5: High Vegetation, 6: Building
        const classVal = (dist < 15 && Math.abs(worldX) < 10) ? 6 : (worldZ > 12 ? 5 : 2);
        view.setUint8(offset + 15, classVal);

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
