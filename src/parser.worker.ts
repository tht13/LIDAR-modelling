import { ParseResult } from "./types";

const ctx: DedicatedWorkerGlobalScope = self as any;

ctx.onmessage = (event: MessageEvent<string>) => {
  const rawText = event.data;
  const result = parsePointCloudFast(rawText);

  if (!result) {
    ctx.postMessage({ error: "No valid point coordinates found in file" });
    return;
  }

  // Transfer ArrayBuffers with zero-copy transfer
  ctx.postMessage(
    {
      success: true,
      data: result
    },
    [result.positions.buffer, result.colors.buffer, result.elevations.buffer]
  );
};

function parsePointCloudFast(rawText: string): ParseResult | null {
  let minX = Infinity, maxX = -Infinity;
  let minY = Infinity, maxY = -Infinity;
  let minZ = Infinity, maxZ = -Infinity;

  let estimatedPoints = 0;
  for (let i = 0; i < rawText.length; i++) {
    if (rawText.charCodeAt(i) === 10) {
      estimatedPoints++;
    }
  }
  estimatedPoints += 1;

  let rawXArr = new Float64Array(estimatedPoints);
  let rawYArr = new Float64Array(estimatedPoints);
  let rawZArr = new Float64Array(estimatedPoints);
  let rawRArr = new Float32Array(estimatedPoints);
  let rawGArr = new Float32Array(estimatedPoints);
  let rawBArr = new Float32Array(estimatedPoints);

  let pointCount = 0;
  let lineStart = 0;
  const textLength = rawText.length;
  let hasRGB = false;
  let maxColorVal = 0;

  while (lineStart < textLength) {
    let lineEnd = rawText.indexOf('\n', lineStart);
    if (lineEnd === -1) {
      lineEnd = textLength;
    }

    let actualEnd = lineEnd;
    if (actualEnd > lineStart && rawText.charCodeAt(actualEnd - 1) === 13) {
      actualEnd--;
    }

    const line = rawText.slice(lineStart, actualEnd).trim();
    lineStart = lineEnd + 1;

    if (!line || line.startsWith('//') || line.startsWith('#')) {
      continue;
    }

    const parts = line.split(/[\s,]+/);
    if (parts.length >= 3) {
      const x = parseFloat(parts[0]);
      const y = parseFloat(parts[1]); // Northing
      const z = parseFloat(parts[2]); // Elevation

      if (isNaN(x) || isNaN(y) || isNaN(z)) {
        continue;
      }

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

  if (pointCount === 0) {
    return null;
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
    const rx = rawXArr[i];
    const ry = rawYArr[i];
    const rz = rawZArr[i];

    positions[i * 3] = rx - centerX;
    positions[i * 3 + 1] = rz - centerZ;
    positions[i * 3 + 2] = ry - centerY;

    colors[i * 3] = rawRArr[i] / colorScale;
    colors[i * 3 + 1] = rawGArr[i] / colorScale;
    colors[i * 3 + 2] = rawBArr[i] / colorScale;

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
    hasRGB
  };
}
