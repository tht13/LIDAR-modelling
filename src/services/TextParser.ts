import { ParseResult } from "../types";
import { GeoCoordinates } from "../utils/GeoCoordinates";

export interface ParsedLinePoint {
  x: number;
  y: number;
  z: number;
  r?: number;
  g?: number;
  b?: number;
}

/**
 * Internal buffer accumulator to manage growing typed arrays and normalization
 */
export class PointBufferBuilder {
  public rawX: Float64Array;
  public rawY: Float64Array;
  public rawZ: Float64Array;
  public rawR: Float32Array;
  public rawG: Float32Array;
  public rawB: Float32Array;

  public pointCount: number = 0;
  public hasRGB: boolean = false;
  public maxColorVal: number = 0;

  public minX: number = Infinity;
  public maxX: number = -Infinity;
  public minY: number = Infinity;
  public maxY: number = -Infinity;
  public minZ: number = Infinity;
  public maxZ: number = -Infinity;

  constructor(initialCapacity: number) {
    const cap = Math.max(1000, initialCapacity);
    this.rawX = new Float64Array(cap);
    this.rawY = new Float64Array(cap);
    this.rawZ = new Float64Array(cap);
    this.rawR = new Float32Array(cap);
    this.rawG = new Float32Array(cap);
    this.rawB = new Float32Array(cap);
  }

  private ensureCapacity(): void {
    if (this.pointCount >= this.rawX.length) {
      const newSize = this.rawX.length * 2;
      const nx = new Float64Array(newSize); nx.set(this.rawX); this.rawX = nx;
      const ny = new Float64Array(newSize); ny.set(this.rawY); this.rawY = ny;
      const nz = new Float64Array(newSize); nz.set(this.rawZ); this.rawZ = nz;
      const nr = new Float32Array(newSize); nr.set(this.rawR); this.rawR = nr;
      const ng = new Float32Array(newSize); ng.set(this.rawG); this.rawG = ng;
      const nb = new Float32Array(newSize); nb.set(this.rawB); this.rawB = nb;
    }
  }

  public addPoint(x: number, y: number, z: number, r?: number, g?: number, b?: number): void {
    this.ensureCapacity();
    const idx = this.pointCount;
    this.rawX[idx] = x;
    this.rawY[idx] = y;
    this.rawZ[idx] = z;

    if (r !== undefined && g !== undefined && b !== undefined && !isNaN(r) && !isNaN(g) && !isNaN(b)) {
      this.hasRGB = true;
      this.rawR[idx] = r;
      this.rawG[idx] = g;
      this.rawB[idx] = b;
      if (r > this.maxColorVal) this.maxColorVal = r;
      if (g > this.maxColorVal) this.maxColorVal = g;
      if (b > this.maxColorVal) this.maxColorVal = b;
    } else {
      this.rawR[idx] = 1.0;
      this.rawG[idx] = 1.0;
      this.rawB[idx] = 1.0;
    }

    if (x < this.minX) this.minX = x;
    if (x > this.maxX) this.maxX = x;
    if (y < this.minY) this.minY = y;
    if (y > this.maxY) this.maxY = y;
    if (z < this.minZ) this.minZ = z;
    if (z > this.maxZ) this.maxZ = z;

    this.pointCount++;
  }

  public toParseResult(totalPoints: number, stride: number): ParseResult | null {
    if (this.pointCount === 0) return null;

    const bounds = GeoCoordinates.computeBounds(this.minX, this.maxX, this.minY, this.maxY, this.minZ, this.maxZ);
    const zSpan = this.maxZ - this.minZ || 1.0;
    const colorScale = (this.hasRGB && this.maxColorVal > 1.0) ? 255.0 : 1.0;

    const positions = new Float32Array(this.pointCount * 3);
    const colors = new Float32Array(this.pointCount * 3);
    const elevations = new Float32Array(this.pointCount);

    for (let i = 0; i < this.pointCount; i++) {
      const [lx, ly, lz] = GeoCoordinates.toLocal(this.rawX[i], this.rawY[i], this.rawZ[i], bounds.center);
      positions[i * 3] = lx;
      positions[i * 3 + 1] = ly;
      positions[i * 3 + 2] = lz;

      colors[i * 3] = this.rawR[i] / colorScale;
      colors[i * 3 + 1] = this.rawG[i] / colorScale;
      colors[i * 3 + 2] = this.rawB[i] / colorScale;

      elevations[i] = GeoCoordinates.normalizeElevation(this.rawZ[i], this.minZ, zSpan);
    }

    return {
      positions,
      colors,
      elevations,
      count: this.pointCount,
      totalPoints,
      subsampled: stride > 1,
      stride,
      min: bounds.min,
      max: bounds.max,
      center: bounds.center,
      size: bounds.size,
      hasRGB: this.hasRGB
    };
  }
}

export class TextParser {
  /**
   * Fast line parser skipping comments/headers and extracting (X, Y, Z, optional RGB)
   */
  public static parseLine(line: string): ParsedLinePoint | null {
    if (!line || line.startsWith("//") || line.startsWith("#") || line.startsWith("ply") || line.startsWith("format") || line.startsWith("element") || line.startsWith("property") || line.startsWith("end_header")) {
      return null;
    }

    const parts = line.split(/[\s,]+/);
    if (parts.length < 3) return null;

    const x = parseFloat(parts[0]);
    const y = parseFloat(parts[1]);
    const z = parseFloat(parts[2]);
    if (isNaN(x) || isNaN(y) || isNaN(z)) return null;

    if (parts.length >= 6) {
      const r = parseFloat(parts[3]);
      const g = parseFloat(parts[4]);
      const b = parseFloat(parts[5]);
      return { x, y, z, r, g, b };
    }

    return { x, y, z };
  }

  /**
   * Fast in-memory text parsing with stride decimation support for XYZ, CSV, PTS, ASC formats.
   */
  public static parse(rawText: string, maxPoints: number = 5_000_000): ParseResult | null {
    let estimatedLines = 0;
    for (let i = 0; i < rawText.length; i++) {
      if (rawText.charCodeAt(i) === 10) estimatedLines++;
    }
    estimatedLines += 1;

    const stride = (maxPoints > 0 && estimatedLines > maxPoints) ? Math.ceil(estimatedLines / maxPoints) : 1;
    const targetAlloc = Math.ceil(estimatedLines / stride) + 1000;
    const builder = new PointBufferBuilder(targetAlloc);

    let lineCount = 0;
    let lineStart = 0;
    const textLength = rawText.length;

    while (lineStart < textLength) {
      let lineEnd = rawText.indexOf("\n", lineStart);
      if (lineEnd === -1) lineEnd = textLength;

      let actualEnd = lineEnd;
      if (actualEnd > lineStart && rawText.charCodeAt(actualEnd - 1) === 13) {
        actualEnd--;
      }

      const line = rawText.slice(lineStart, actualEnd).trim();
      lineStart = lineEnd + 1;

      const pt = this.parseLine(line);
      if (!pt) continue;

      lineCount++;
      if (lineCount % stride !== 0) continue;

      builder.addPoint(pt.x, pt.y, pt.z, pt.r, pt.g, pt.b);
    }

    return builder.toParseResult(lineCount, stride);
  }

  /**
   * Stream large text/XYZ/CSV point cloud files chunk-by-chunk using Blob.slice()
   */
  public static async streamParse(
    file: Blob,
    maxPoints: number = 5_000_000,
    onProgress?: (percent: number, statusText: string) => void,
    chunkSize: number = 8 * 1024 * 1024
  ): Promise<ParseResult> {
    // If small (< 25 MB), use fast in-memory string parser
    if (file.size < 25 * 1024 * 1024) {
      const text = await file.text();
      const parsed = this.parse(text, maxPoints);
      if (!parsed) throw new Error("No points parsed from text file");
      return parsed;
    }

    // Large text file streaming in chunks
    const CHUNK_SIZE = chunkSize;
    const estimatedLines = Math.max(1000, Math.floor(file.size / 30));
    const stride = (maxPoints > 0 && estimatedLines > maxPoints) ? Math.ceil(estimatedLines / maxPoints) : 1;
    const targetAlloc = Math.min(maxPoints > 0 ? maxPoints + 50000 : 10_000_000, Math.ceil(estimatedLines / stride) + 10000);
    const builder = new PointBufferBuilder(targetAlloc);

    let lineCounter = 0;
    let leftover = "";
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
        const pt = this.parseLine(line);
        if (!pt) continue;

        lineCounter++;
        if (lineCounter % stride !== 0) continue;

        builder.addPoint(pt.x, pt.y, pt.z, pt.r, pt.g, pt.b);
      }

      if (onProgress) {
        const pct = Math.min(99, Math.round(((offset + CHUNK_SIZE) / file.size) * 100));
        onProgress(pct, `Streaming: ${builder.pointCount.toLocaleString()} points parsed (${pct}%)...`);
      }
    }

    const result = builder.toParseResult(lineCounter, stride);
    if (!result) {
      throw new Error("No points found in text file");
    }
    return result;
  }
}
