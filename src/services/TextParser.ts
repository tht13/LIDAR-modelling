import { ParseResult } from "../types";

export class TextParser {
  /**
   * Fast in-memory text parsing with stride decimation support for XYZ, CSV, PTS, ASC formats.
   */
  public static parse(rawText: string, maxPoints: number = 5_000_000): ParseResult | null {
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
      let lineEnd = rawText.indexOf("\n", lineStart);
      if (lineEnd === -1) lineEnd = textLength;

      let actualEnd = lineEnd;
      if (actualEnd > lineStart && rawText.charCodeAt(actualEnd - 1) === 13) {
        actualEnd--;
      }

      const line = rawText.slice(lineStart, actualEnd).trim();
      lineStart = lineEnd + 1;

      if (!line || line.startsWith("//") || line.startsWith("#") || line.startsWith("ply") || line.startsWith("format") || line.startsWith("element") || line.startsWith("property") || line.startsWith("end_header")) {
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

  /**
   * Stream large text/XYZ/CSV point cloud files chunk-by-chunk using Blob.slice()
   */
  public static async streamParse(
    file: Blob,
    maxPoints: number = 5_000_000,
    onProgress?: (percent: number, statusText: string) => void
  ): Promise<ParseResult> {
    // If small (< 25 MB), use fast in-memory string parser
    if (file.size < 25 * 1024 * 1024) {
      const text = await file.text();
      const parsed = this.parse(text, maxPoints);
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
}
