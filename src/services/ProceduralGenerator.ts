import { ParseResult } from "../types";
import { GeoCoordinates } from "../utils/GeoCoordinates";

export class ProceduralGenerator {
  public static generate(id: string, onProgress?: (pct: number, statusText: string) => void): ParseResult {
    if (id === "urban-city") return this.generateUrbanCity(onProgress);
    if (id === "forest-canyon") return this.generateForestCanyon(onProgress);
    if (id === "monument-dome") return this.generateDome(onProgress);
    if (id === "norway-fjord") return this.generateNorwayFjord(onProgress);
    throw new Error("Unknown procedural dataset: " + id);
  }

  private static createResult(positions: Float32Array, colors: Float32Array, count: number): ParseResult {
    let minX = Infinity, minY = Infinity, minZ = Infinity;
    let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;

    for (let i = 0; i < count; i++) {
      const x = positions[i * 3];
      const y = positions[i * 3 + 1];
      const z = positions[i * 3 + 2];
      if (x < minX) minX = x; if (x > maxX) maxX = x;
      if (y < minY) minY = y; if (y > maxY) maxY = y;
      if (z < minZ) minZ = z; if (z > maxZ) maxZ = z;
    }

    const bounds = GeoCoordinates.computeBounds(minX, maxX, minY, maxY, minZ, maxZ);
    const zSpan = maxZ - minZ || 1.0;
    const elevations = new Float32Array(count);

    // Swap Z and Y for Three.js (Y is up, Z is north/south)
    for (let i = 0; i < count; i++) {
      const rawX = positions[i * 3];
      const rawY = positions[i * 3 + 1];
      const rawZ = positions[i * 3 + 2];
      
      const [lx, ly, lz] = GeoCoordinates.toLocal(rawX, rawY, rawZ, bounds.center);
      positions[i * 3] = lx;
      positions[i * 3 + 1] = ly;
      positions[i * 3 + 2] = lz;
      
      elevations[i] = GeoCoordinates.normalizeElevation(rawZ, minZ, zSpan);
    }

    return {
      positions: positions.subarray(0, count * 3),
      colors: colors.subarray(0, count * 3),
      elevations,
      count,
      totalPoints: count,
      subsampled: false,
      min: bounds.min,
      max: bounds.max,
      center: bounds.center,
      size: bounds.size,
      hasRGB: true
    };
  }

  public static generateUrbanCity(onProgress?: (pct: number, statusText: string) => void): ParseResult {
    const capacity = 2_000_000;
    const positions = new Float32Array(capacity * 3);
    const colors = new Float32Array(capacity * 3);
    let count = 0;

    const push = (x: number, y: number, z: number, r: number, g: number, b: number) => {
      if (count >= capacity) return;
      positions[count * 3] = x; positions[count * 3 + 1] = y; positions[count * 3 + 2] = z;
      colors[count * 3] = r; colors[count * 3 + 1] = g; colors[count * 3 + 2] = b;
      count++;
    };

    const gridSize = 7;
    const blockSize = 60;
    const roadWidth = 25;
    const spacing = blockSize + roadWidth;
    const totalSpan = gridSize * spacing;
    const offset = totalSpan / 2;

    for (let x = 0; x < totalSpan; x += 3.5) {
      for (let y = 0; y < totalSpan; y += 3.5) {
        const isRoadX = (x % spacing) >= blockSize;
        const isRoadY = (y % spacing) >= blockSize;
        const isRoad = isRoadX || isRoadY;
        let r = 0.18, g = 0.18, b = 0.2;
        if (!isRoad) { r = 0.45; g = 0.45; b = 0.45; }
        else if ((x % spacing > blockSize + 11 && x % spacing < blockSize + 14) || (y % spacing > blockSize + 11 && y % spacing < blockSize + 14)) {
          r = 0.9; g = 0.85; b = 0.2;
        }
        push(x - offset, y - offset, 0.0, r, g, b);
      }
    }

    const half = blockSize * 0.42;
    for (let gx = 0; gx < gridSize; gx++) {
      for (let gy = 0; gy < gridSize; gy++) {
        const bx = gx * spacing + blockSize / 2 - offset;
        const by = gy * spacing + blockSize / 2 - offset;
        const height = 40 + Math.sin(gx * 3.1 + gy * 1.7) * 30 + (gx === 3 && gy === 3 ? 120 : (Math.sin(gx*7.3 + gy*4.2)*25 + 25));

        for (let z = 0; z < height; z += 2.5) {
          const isFloor = Math.floor(z / 4) % 2 === 0;
          for (let step = -half; step <= half; step += 2.5) {
            const isWindow = isFloor && (Math.abs(step) % 8 > 2);
            const r = isWindow ? 0.35 : 0.75;
            const g = isWindow ? 0.65 : 0.72;
            const b = isWindow ? 0.95 : 0.70;
            push(bx + step, by - half, z, r, g, b);
            push(bx + step, by + half, z, r, g, b);
            push(bx - half, by + step, z, r, g, b);
            push(bx + half, by + step, z, r, g, b);
          }
        }
        for (let rx = -half; rx <= half; rx += 2.8) {
          for (let ry = -half; ry <= half; ry += 2.8) {
            push(bx + rx, by + ry, height, 0.3, 0.32, 0.35);
          }
        }
      }
    }

    return this.createResult(positions, colors, count);
  }

  public static generateForestCanyon(onProgress?: (pct: number, statusText: string) => void): ParseResult {
    const capacity = 2_500_000;
    const positions = new Float32Array(capacity * 3);
    const colors = new Float32Array(capacity * 3);
    let count = 0;

    const push = (x: number, y: number, z: number, r: number, g: number, b: number) => {
      if (count >= capacity) return;
      positions[count * 3] = x; positions[count * 3 + 1] = y; positions[count * 3 + 2] = z;
      colors[count * 3] = r; colors[count * 3 + 1] = g; colors[count * 3 + 2] = b;
      count++;
    };

    const width = 450;
    const length = 450;
    const step = 3.0;

    for (let x = -width / 2; x <= width / 2; x += step) {
      for (let y = -length / 2; y <= length / 2; y += step) {
        const riverX = Math.sin(y * 0.015) * 80 + Math.cos(y * 0.005) * 30;
        const distToRiver = Math.abs(x - riverX);

        let z = Math.pow(distToRiver / 80, 1.8) * 45 + Math.sin(x * 0.04) * 8 + Math.cos(y * 0.04) * 8;
        let r = 0.45, g = 0.38, b = 0.28;

        if (distToRiver < 18) {
          z = -2 + Math.sin(x * 0.2 + y * 0.1) * 0.5;
          r = 0.15; g = 0.45; b = 0.75;
        } else if (distToRiver > 35 && Math.sin(x * 12.3 + y * 4.5) > 0.2) {
          const treeH = 12 + Math.abs(Math.sin(x * 5.5 + y * 3.3)) * 10;
          for (let th = 0; th <= treeH; th += 3) {
            const spread = (1 - th / treeH) * 5;
            const dx = Math.sin(th * 2.1 + x) * spread;
            const dy = Math.cos(th * 1.7 + y) * spread;
            push(x + dx, y + dy, z + th, 0.12, 0.58, 0.22);
          }
        }
        push(x, y, z, r, g, b);
      }
    }
    return this.createResult(positions, colors, count);
  }

  public static generateDome(onProgress?: (pct: number, statusText: string) => void): ParseResult {
    const capacity = 1_000_000;
    const positions = new Float32Array(capacity * 3);
    const colors = new Float32Array(capacity * 3);
    let count = 0;

    const push = (x: number, y: number, z: number, r: number, g: number, b: number) => {
      if (count >= capacity) return;
      positions[count * 3] = x; positions[count * 3 + 1] = y; positions[count * 3 + 2] = z;
      colors[count * 3] = r; colors[count * 3 + 1] = g; colors[count * 3 + 2] = b;
      count++;
    };

    for (let stepIdx = 0; stepIdx < 6; stepIdx++) {
      const radius = 180 - stepIdx * 6;
      const height = stepIdx * 2.5;
      for (let angle = 0; angle < Math.PI * 2; angle += 0.04) {
        for (let r = 0; r <= radius; r += 4) {
          push(Math.cos(angle) * r, Math.sin(angle) * r, height, 0.85, 0.82, 0.78);
        }
      }
    }

    const colCount = 28;
    const colRadius = 110;
    const colHeight = 65;
    for (let c = 0; c < colCount; c++) {
      const angle = (c / colCount) * Math.PI * 2;
      const cx = Math.cos(angle) * colRadius;
      const cy = Math.sin(angle) * colRadius;
      for (let h = 15; h <= colHeight; h += 2) {
        for (let ca = 0; ca < Math.PI * 2; ca += 0.6) {
          push(cx + Math.cos(ca) * 4.5, cy + Math.sin(ca) * 4.5, h, 0.92, 0.90, 0.86);
        }
      }
    }

    const domeRadius = 90;
    const domeBaseZ = 65;
    for (let phi = 0; phi <= Math.PI / 2; phi += 0.035) {
      const ringRadius = Math.sin(phi) * domeRadius;
      const z = domeBaseZ + Math.cos(phi) * domeRadius * 0.75;
      const rColor = 0.8 + Math.cos(phi * 4) * 0.15;
      const gColor = 0.65 + Math.sin(phi * 4) * 0.1;
      const bColor = 0.35;
      for (let theta = 0; theta < Math.PI * 2; theta += 0.035) {
        push(Math.cos(theta) * ringRadius, Math.sin(theta) * ringRadius, z, rColor, gColor, bColor);
      }
    }

    return this.createResult(positions, colors, count);
  }

  public static generateNorwayFjord(onProgress?: (pct: number, statusText: string) => void): ParseResult {
    const capacity = 3_000_000;
    const positions = new Float32Array(capacity * 3);
    const colors = new Float32Array(capacity * 3);
    let count = 0;

    const push = (x: number, y: number, z: number, r: number, g: number, b: number) => {
      if (count >= capacity) return;
      positions[count * 3] = x; positions[count * 3 + 1] = y; positions[count * 3 + 2] = z;
      colors[count * 3] = r; colors[count * 3 + 1] = g; colors[count * 3 + 2] = b;
      count++;
    };

    const width = 650;
    const length = 650;
    const step = 3.2;
    const baseEasting = 412500.0;
    const baseNorthing = 6886200.0;

    for (let x = -width / 2; x <= width / 2; x += step) {
      for (let y = -length / 2; y <= length / 2; y += step) {
        const fjordCenter = Math.sin(y * 0.008) * 90 + Math.cos(y * 0.003) * 40;
        const distFromCenter = Math.abs(x - fjordCenter);
        const fjordHalfWidth = 65;
        let z = 0;
        let r = 0.45, g = 0.42, b = 0.38;

        if (distFromCenter < fjordHalfWidth) {
          z = 0.0 + Math.sin(x * 0.15 + y * 0.08) * 0.3;
          r = 0.08; g = 0.35; b = 0.58;
        } else {
          const wallDist = distFromCenter - fjordHalfWidth;
          const uProfile = Math.pow(wallDist / 140, 1.4) * 380;
          const mountainRoughness = Math.sin(x * 0.035) * 25 + Math.cos(y * 0.025) * 35;
          z = Math.max(5, uProfile + mountainRoughness);

          const isWaterfall = Math.abs(x - (fjordCenter + 75)) < 12 && z < 320;
          if (isWaterfall) {
            r = 0.85; g = 0.95; b = 1.0;
          } else if (z < 180) {
            r = 0.14; g = 0.45; b = 0.20;
            if (Math.sin(x * 12.3 + y * 4.5) > -0.1) {
              const treeH = 8 + Math.abs(Math.sin(x * 7.1 + y * 2.2)) * 8;
              push(baseEasting + x, baseNorthing + y, z + treeH, 0.10, 0.52, 0.18);
            }
          } else if (z > 450) {
            if (Math.sin(x * 0.08) + Math.cos(y * 0.08) > 0.6) {
              r = 0.94; g = 0.96; b = 0.98;
            } else {
              r = 0.55; g = 0.52; b = 0.50;
            }
          }
        }
        push(baseEasting + x, baseNorthing + y, z, r, g, b);
      }
    }

    return this.createResult(positions, colors, count);
  }
}
