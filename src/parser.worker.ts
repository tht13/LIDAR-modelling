import { ParseResult } from "./types";
import { LASParser } from "./services/LASParser";

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
      } else {
        result = await streamParseText(file, maxPoints, postProgress);
      }
    }
    // 2. ArrayBuffer payload
    else if (payload instanceof ArrayBuffer || (payload && payload.buffer instanceof ArrayBuffer)) {
      const buffer: ArrayBuffer = payload instanceof ArrayBuffer ? payload : payload.buffer;
      if (LASParser.isLAS(buffer)) {
        postProgress(30, "Parsing binary LAS...");
        result = LASParser.parse(buffer, maxPoints);
      } else {
        postProgress(30, "Decoding point text...");
        const text = new TextDecoder().decode(buffer);
        result = parsePointCloudFast(text, maxPoints);
      }
    }
    // 3. String payload
    else if (typeof payload === "string" || (payload && typeof payload.text === "string")) {
      const text: string = typeof payload === "string" ? payload : payload.text;
      postProgress(30, "Parsing points...");
      result = parsePointCloudFast(text, maxPoints);
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

/**
 * Stream large text/XYZ/CSV point cloud files chunk-by-chunk
 */
async function streamParseText(
  file: Blob,
  maxPoints: number = 5_000_000,
  onProgress?: (percent: number, statusText: string) => void
): Promise<ParseResult> {
  // If small (< 25 MB), use fast in-memory string parser
  if (file.size < 25 * 1024 * 1024) {
    const text = await file.text();
    const parsed = parsePointCloudFast(text, maxPoints);
    if (!parsed) throw new Error("No points parsed from text file");
    return parsed;
  }

  // Large text file streaming in 8MB chunks
  const CHUNK_SIZE = 8 * 1024 * 1024;
  const estimatedLines = Math.max(1000, Math.floor(file.size / 30));
  const stride = (maxPoints > 0 && estimatedLines > maxPoints) ? Math.ceil(estimatedLines / maxPoints) : 1;
  const targetAlloc = Math.min(maxPoints > 0 ? maxPoints + 50000 : 10_000_000, Math.ceil(estimatedLines / stride) + 10000);

  let rawX = new Float64Array(targetAlloc);
  let rawY = new Float64Array(targetAlloc);
  let rawZ = new Float64Array(targetAlloc);
  let rawR = new Float32Array(targetAlloc);
  let rawG = new Float32Array(targetAlloc);
  let rawB = new Float32Array(targetAlloc);

  let pointCount = 0;
  let lineCounter = 0;
  let leftover = "";
  let hasRGB = false;
  let maxColorVal = 0;

  let minX = Infinity, maxX = -Infinity;
  let minY = Infinity, maxY = -Infinity;
  let minZ = Infinity, maxZ = -Infinity;

  const decoder = new TextDecoder();

  for (let offset = 0; offset < file.size; offset += CHUNK_SIZE) {
    const chunk = await file.slice(offset, Math.min(file.size, offset + CHUNK_SIZE)).arrayBuffer();
    const chunkText = leftover + decoder.decode(chunk, { stream: offset + CHUNK_SIZE < file.size });
    const lastNewline = chunkText.lastIndexOf("\n");

    let processText: string;
    if (lastNewline !== -1) {
      processText = chunkText.slice(0, lastNewline);
      leftover = chunkText.slice(lastNewline + 1);
    } else {
      processText = chunkText;
      leftover = "";
    }

    const lines = processText.split("\n");
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line || line.startsWith("#") || line.startsWith("//") || line.startsWith("ply") || line.startsWith("format") || line.startsWith("element") || line.startsWith("property") || line.startsWith("end_header")) {
        continue;
      }

      lineCounter++;
      if (lineCounter % stride !== 0) continue;

      const parts = line.split(/[\s,]+/);
      if (parts.length >= 3) {
        const x = parseFloat(parts[0]);
        const y = parseFloat(parts[1]);
        const z = parseFloat(parts[2]);

        if (isNaN(x) || isNaN(y) || isNaN(z)) continue;

        if (pointCount >= rawX.length) {
          const newSize = rawX.length * 2;
          const nx = new Float64Array(newSize); nx.set(rawX); rawX = nx;
          const ny = new Float64Array(newSize); ny.set(rawY); rawY = ny;
          const nz = new Float64Array(newSize); nz.set(rawZ); rawZ = nz;
          const nr = new Float32Array(newSize); nr.set(rawR); rawR = nr;
          const ng = new Float32Array(newSize); ng.set(rawG); rawG = ng;
          const nb = new Float32Array(newSize); nb.set(rawB); rawB = nb;
        }

        rawX[pointCount] = x;
        rawY[pointCount] = y;
        rawZ[pointCount] = z;

        if (parts.length >= 6) {
          const r = parseFloat(parts[3]);
          const g = parseFloat(parts[4]);
          const b = parseFloat(parts[5]);
          if (!isNaN(r) && !isNaN(g) && !isNaN(b)) {
            hasRGB = true;
            rawR[pointCount] = r; rawG[pointCount] = g; rawB[pointCount] = b;
            if (r > maxColorVal) maxColorVal = r;
            if (g > maxColorVal) maxColorVal = g;
            if (b > maxColorVal) maxColorVal = b;
          } else {
            rawR[pointCount] = 1; rawG[pointCount] = 1; rawB[pointCount] = 1;
          }
        } else {
          rawR[pointCount] = 1; rawG[pointCount] = 1; rawB[pointCount] = 1;
        }

        if (x < minX) minX = x; if (x > maxX) maxX = x;
        if (y < minY) minY = y; if (y > maxY) maxY = y;
        if (z < minZ) minZ = z; if (z > maxZ) maxZ = z;

        pointCount++;
      }
    }

    if (onProgress) {
      const pct = Math.min(99, Math.round(((offset + CHUNK_SIZE) / file.size) * 100));
      onProgress(pct, `Streaming: ${pointCount.toLocaleString()} points parsed (${pct}%)...`);
    }
  }

  if (pointCount === 0) {
    throw new Error("No points found in text file");
  }

  const positions = new Float32Array(pointCount * 3);
  const colors = new Float32Array(pointCount * 3);
  const elevations = new Float32Array(pointCount);

  const centerX = (minX + maxX) / 2;
  const centerY = (minY + maxY) / 2;
  const centerZ = (minZ + maxZ) / 2;
  const zSpan = maxZ - minZ || 1.0;
  const colorScale = (hasRGB && maxColorVal > 1.0) ? 255.0 : 1.0;

  for (let i = 0; i < pointCount; i++) {
    positions[i * 3] = rawX[i] - centerX;
    positions[i * 3 + 1] = rawZ[i] - centerZ;
    positions[i * 3 + 2] = rawY[i] - centerY;

    colors[i * 3] = rawR[i] / colorScale;
    colors[i * 3 + 1] = rawG[i] / colorScale;
    colors[i * 3 + 2] = rawB[i] / colorScale;

    elevations[i] = (rawZ[i] - minZ) / zSpan;
  }

  return {
    positions,
    colors,
    elevations,
    count: pointCount,
    totalPoints: lineCounter,
    subsampled: stride > 1,
    stride,
    min: [minX, minZ, minY],
    max: [maxX, maxZ, maxY],
    center: [centerX, centerZ, centerY],
    size: [maxX - minX, maxZ - minZ, maxY - minY],
    hasRGB
  };
}

/**
 * Fast in-memory text parsing with stride decimation support
 */
function parsePointCloudFast(rawText: string, maxPoints: number = 5_000_000): ParseResult | null {
  let minX = Infinity, maxX = -Infinity;
  let minY = Infinity, maxY = -Infinity;
  let minZ = Infinity, maxZ = -Infinity;

  let estimatedLines = 0;
  for (let i = 0; i < rawText.length; i++) {
    if (rawText.charCodeAt(i) === 10) estimatedLines++;
  }
  estimatedLines += 1;

  const stride = (maxPoints > 0 && estimatedLines > maxPoints) ? Math.ceil(estimatedLines / maxPoints) : 1;
  const targetAlloc = Math.ceil(estimatedLines / stride) + 1000;

  let rawXArr = new Float64Array(targetAlloc);
  let rawYArr = new Float64Array(targetAlloc);
  let rawZArr = new Float64Array(targetAlloc);
  let rawRArr = new Float32Array(targetAlloc);
  let rawGArr = new Float32Array(targetAlloc);
  let rawBArr = new Float32Array(targetAlloc);

  let pointCount = 0;
  let lineCount = 0;
  let lineStart = 0;
  const textLength = rawText.length;
  let hasRGB = false;
  let maxColorVal = 0;

  while (lineStart < textLength) {
    let lineEnd = rawText.indexOf('\n', lineStart);
    if (lineEnd === -1) lineEnd = textLength;

    let actualEnd = lineEnd;
    if (actualEnd > lineStart && rawText.charCodeAt(actualEnd - 1) === 13) {
      actualEnd--;
    }

    const line = rawText.slice(lineStart, actualEnd).trim();
    lineStart = lineEnd + 1;

    if (!line || line.startsWith('//') || line.startsWith('#') || line.startsWith('ply') || line.startsWith('format') || line.startsWith('element') || line.startsWith('property') || line.startsWith('end_header')) {
      continue;
    }

    lineCount++;
    if (lineCount % stride !== 0) continue;

    const parts = line.split(/[\s,]+/);
    if (parts.length >= 3) {
      const x = parseFloat(parts[0]);
      const y = parseFloat(parts[1]);
      const z = parseFloat(parts[2]);

      if (isNaN(x) || isNaN(y) || isNaN(z)) continue;

      if (pointCount >= rawXArr.length) {
        const newSize = rawXArr.length * 2;
        const newX = new Float64Array(newSize); newX.set(rawXArr); rawXArr = newX;
        const newY = new Float64Array(newSize); newY.set(rawYArr); rawYArr = newY;
        const newZ = new Float64Array(newSize); newZ.set(rawZArr); rawZArr = newZ;
        const newR = new Float32Array(newSize); newR.set(rawRArr); rawRArr = newR;
        const newG = new Float32Array(newSize); newG.set(rawGArr); rawGArr = newG;
        const newB = new Float32Array(newSize); newB.set(rawBArr); rawBArr = newB;
      }

      rawXArr[pointCount] = x;
      rawYArr[pointCount] = y;
      rawZArr[pointCount] = z;

      if (parts.length >= 6) {
        const r = parseFloat(parts[3]);
        const g = parseFloat(parts[4]);
        const b = parseFloat(parts[5]);

        if (!isNaN(r) && !isNaN(g) && !isNaN(b)) {
          hasRGB = true;
          rawRArr[pointCount] = r;
          rawGArr[pointCount] = g;
          rawBArr[pointCount] = b;

          if (r > maxColorVal) maxColorVal = r;
          if (g > maxColorVal) maxColorVal = g;
          if (b > maxColorVal) maxColorVal = b;
        } else {
          rawRArr[pointCount] = 1.0;
          rawGArr[pointCount] = 1.0;
          rawBArr[pointCount] = 1.0;
        }
      } else {
        rawRArr[pointCount] = 1.0;
        rawGArr[pointCount] = 1.0;
        rawBArr[pointCount] = 1.0;
      }

      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
      if (z < minZ) minZ = z;
      if (z > maxZ) maxZ = z;

      pointCount++;
    }
  }

  if (pointCount === 0) return null;

  const positions = new Float32Array(pointCount * 3);
  const colors = new Float32Array(pointCount * 3);
  const elevations = new Float32Array(pointCount);

  const centerX = (minX + maxX) / 2;
  const centerY = (minY + maxY) / 2;
  const centerZ = (minZ + maxZ) / 2;
  const zSpan = maxZ - minZ || 1.0;
  const colorScale = (hasRGB && maxColorVal > 1.0) ? 255.0 : 1.0;

  for (let i = 0; i < pointCount; i++) {
    positions[i * 3] = rawXArr[i] - centerX;
    positions[i * 3 + 1] = rawZArr[i] - centerZ;
    positions[i * 3 + 2] = rawYArr[i] - centerY;

    colors[i * 3] = rawRArr[i] / colorScale;
    colors[i * 3 + 1] = rawGArr[i] / colorScale;
    colors[i * 3 + 2] = rawBArr[i] / colorScale;

    elevations[i] = (rawZArr[i] - minZ) / zSpan;
  }

  return {
    positions,
    colors,
    elevations,
    count: pointCount,
    totalPoints: lineCount,
    subsampled: stride > 1,
    stride,
    min: [minX, minZ, minY],
    max: [maxX, maxZ, maxY],
    center: [centerX, centerZ, centerY],
    size: [maxX - minX, maxZ - minZ, maxY - minY],
    hasRGB
  };
}
