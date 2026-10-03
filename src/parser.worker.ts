import { ParseResult } from "./types";
import { LASParser } from "./services/LASParser";
import { GeoTIFFParser } from "./services/GeoTIFFParser";
import { TextParser } from "./services/TextParser";

const ctx: DedicatedWorkerGlobalScope = self as any;

ctx.onmessage = async (event: MessageEvent<any>) => {
  const payload = event.data;
  let result: ParseResult | null = null;
  const maxPoints: number = (typeof payload === "object" && payload && typeof payload.maxPoints === "number")
    ? payload.maxPoints
    : 5_000_000;

  const postProgress = (percent: number, statusText: string) => {
    ctx.postMessage({ type: "progress", percent, statusText });
  };

  try {
    // 1. File or Blob payload (Streaming chunk-by-chunk with zero whole-file memory allocation)
    if (payload instanceof Blob || (payload && payload.file instanceof Blob)) {
      const file: Blob = payload instanceof Blob ? payload : payload.file;
      postProgress(10, "Inspecting file format...");

      // Probe first 1KB to identify signature
      const probeBuf = await file.slice(0, Math.min(file.size, 1024)).arrayBuffer();
      if (LASParser.isLAS(probeBuf)) {
        result = await streamParseLAS(file, maxPoints, postProgress);
      } else if (GeoTIFFParser.isTIFF(probeBuf)) {
        result = await GeoTIFFParser.parse(file, maxPoints, postProgress);
      } else {
        result = await TextParser.streamParse(file, maxPoints, postProgress);
      }
    }
    // 2. ArrayBuffer payload
    else if (payload instanceof ArrayBuffer || (payload && payload.buffer instanceof ArrayBuffer)) {
      const buffer: ArrayBuffer = payload instanceof ArrayBuffer ? payload : payload.buffer;
      if (LASParser.isLAS(buffer)) {
        postProgress(30, "Parsing binary LAS...");
        result = LASParser.parse(buffer, maxPoints);
      } else if (GeoTIFFParser.isTIFF(buffer)) {
        result = await GeoTIFFParser.parse(buffer, maxPoints, postProgress);
      } else {
        postProgress(30, "Decoding point text...");
        const text = new TextDecoder().decode(buffer);
        result = TextParser.parse(text, maxPoints);
      }
    }
    // 3. String payload
    else if (typeof payload === "string" || (payload && typeof payload.text === "string")) {
      const text: string = typeof payload === "string" ? payload : payload.text;
      postProgress(30, "Parsing points...");
      result = TextParser.parse(text, maxPoints);
    }
  } catch (err: any) {
    ctx.postMessage({ error: err?.message || "Failed to parse point cloud" });
    return;
  }

  if (!result || result.count === 0) {
    ctx.postMessage({ error: "No valid point coordinates found in file" });
    return;
  }

  postProgress(100, "Rendering point cloud...");

  // Transfer ArrayBuffers with zero-copy transfer
  ctx.postMessage(
    {
      type: "done",
      success: true,
      data: result
    },
    [result.positions.buffer, result.colors.buffer, result.elevations.buffer]
  );
};

/**
 * Stream binary LAS/LAZ file chunk-by-chunk using File.slice()
 * Does NOT load the multi-gigabyte file into memory at once!
 */
async function streamParseLAS(
  file: Blob,
  maxPoints: number = 5_000_000,
  onProgress?: (percent: number, statusText: string) => void
): Promise<ParseResult> {
  const headerBuf = await file.slice(0, Math.min(file.size, 1024)).arrayBuffer();
  const view = new DataView(headerBuf);

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

  let maxX = view.getFloat64(179, true);
  let minX = view.getFloat64(187, true);
  let maxY = view.getFloat64(195, true);
  let minY = view.getFloat64(203, true);
  let maxZ = view.getFloat64(211, true);
  let minZ = view.getFloat64(219, true);

  // LAS 1.4 64-bit point count support
  if (versionMajor === 1 && versionMinor >= 4 && pointCount === 0 && headerBuf.byteLength >= 255) {
    const bigCount = view.getBigUint64(247, true);
    pointCount = Number(bigCount);
  }

  const availablePoints = Math.max(0, Math.floor((file.size - offsetToPoints) / pointRecordLength));
  if (pointCount === 0 || pointCount > availablePoints) {
    pointCount = availablePoints;
  }
  if (pointCount === 0) {
    throw new Error("LAS file contains 0 point records");
  }

  const hasRGB = (pointFormat === 2 || pointFormat === 3 || pointFormat === 7 || pointFormat === 8);
  let rgbOffset = -1;
  if (pointFormat === 2) rgbOffset = 20;
  else if (pointFormat === 3) rgbOffset = 28;
  else if (pointFormat === 7 || pointFormat === 8) rgbOffset = 30;

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

  const centerX = (minX + maxX) / 2;
  const centerY = (minY + maxY) / 2;
  const centerZ = (minZ + maxZ) / 2;
  const zSpan = maxZ - minZ || 1.0;

  // Stride decimation to target budget
  const stride = (maxPoints > 0 && pointCount > maxPoints) ? Math.ceil(pointCount / maxPoints) : 1;
  const targetCount = Math.ceil(pointCount / stride);

  const positions = new Float32Array(targetCount * 3);
  const colors = new Float32Array(targetCount * 3);
  const elevations = new Float32Array(targetCount);

  // Probe color bit depth
  let maxColorVal = 0;
  if (hasRGB && rgbOffset > 0) {
    const probeLen = Math.min(1000 * pointRecordLength, file.size - offsetToPoints);
    const probeChunk = await file.slice(offsetToPoints, offsetToPoints + probeLen).arrayBuffer();
    const probeView = new DataView(probeChunk);
    const probeN = Math.floor(probeChunk.byteLength / pointRecordLength);
    for (let i = 0; i < probeN; i++) {
      const off = i * pointRecordLength + rgbOffset;
      if (off + 6 <= probeChunk.byteLength) {
        const r = probeView.getUint16(off, true);
        const g = probeView.getUint16(off + 2, true);
        const b = probeView.getUint16(off + 4, true);
        if (r > maxColorVal) maxColorVal = r;
        if (g > maxColorVal) maxColorVal = g;
        if (b > maxColorVal) maxColorVal = b;
      }
    }
  }
  const colorDivisor = maxColorVal > 255 ? 65535.0 : (maxColorVal > 1.0 ? 255.0 : 1.0);

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

      // Coordinate mapping: Three.js (X, Y=Elev, Z=Northing)
      positions[outIndex * 3] = px - centerX;
      positions[outIndex * 3 + 1] = pz - centerZ;
      positions[outIndex * 3 + 2] = py - centerY;

      elevations[outIndex] = (pz - minZ) / zSpan;

      if (hasRGB && rgbOffset > 0 && pOffset + rgbOffset + 6 <= chunkBuffer.byteLength) {
        const r = chunkView.getUint16(pOffset + rgbOffset, true);
        const g = chunkView.getUint16(pOffset + rgbOffset + 2, true);
        const b = chunkView.getUint16(pOffset + rgbOffset + 4, true);
        colors[outIndex * 3] = r / colorDivisor;
        colors[outIndex * 3 + 1] = g / colorDivisor;
        colors[outIndex * 3 + 2] = b / colorDivisor;
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

  const finalPositions = outIndex === targetCount ? positions : positions.subarray(0, outIndex * 3);
  const finalColors = outIndex === targetCount ? colors : colors.subarray(0, outIndex * 3);
  const finalElevations = outIndex === targetCount ? elevations : elevations.subarray(0, outIndex);

  return {
    positions: finalPositions,
    colors: finalColors,
    elevations: finalElevations,
    count: outIndex,
    totalPoints: pointCount,
    subsampled: stride > 1,
    stride,
    min: [minX, minZ, minY],
    max: [maxX, maxZ, maxY],
    center: [centerX, centerZ, centerY],
    size: [maxX - minX, maxZ - minZ, maxY - minY],
    hasRGB: hasRGB && maxColorVal > 0
  };
}

