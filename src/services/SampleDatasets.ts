import { LASParser } from "./LASParser";

export interface SampleDataset {
  id: string;
  name: string;
  type: "file" | "generator" | "binary";
  url?: string;
  generate?: () => string;
  generateBinary?: () => ArrayBuffer;
}

export class SampleDatasets {
  public static list: SampleDataset[] = [
    {
      id: "mountain-lidar",
      name: "⛰️ Mountain Valley (LIDAR Scan)",
      type: "file",
      url: "points.txt"
    },
    {
      id: "certainty3d-las",
      name: "🛰️ Certainty3D Color Survey (.LAS)",
      type: "file",
      url: "https://raw.githubusercontent.com/libLAS/libLAS/master/test/data/certainty3d-color-utm-feet-navd88.las"
    },
    {
      id: "dolphins-ply",
      name: "🐬 Stanford Dolphins (.PLY)",
      type: "file",
      url: "https://raw.githubusercontent.com/mrdoob/three.js/dev/examples/models/ply/ascii/dolphins.ply"
    },
    {
      id: "las-survey",
      name: "🛰️ Aerial LiDAR Topography (.LAS Binary)",
      type: "binary",
      generateBinary: () => LASParser.createSampleLAS(30000)
    },
    {
      id: "norway-fjord",
      name: "🇳🇴 Geiranger Fjord & Cliffs (Norway LiDAR)",
      type: "generator",
      generate: () => SampleDatasets.generateNorwayFjord()
    },
    {
      id: "urban-city",
      name: "🏙️ Urban City Grid & Skyscrapers",
      type: "generator",
      generate: () => SampleDatasets.generateUrbanCity()
    },
    {
      id: "forest-canyon",
      name: "🌲 River Canyon & Forest Canopy",
      type: "generator",
      generate: () => SampleDatasets.generateForestCanyon()
    },
    {
      id: "monument-dome",
      name: "🏛️ Architectural Pavilion & Dome",
      type: "generator",
      generate: () => SampleDatasets.generateDome()
    }
  ];

  public static generateUrbanCity(): string {
    const lines: string[] = ["//X Y Z Rf Gf Bf"];
    const gridSize = 7;
    const blockSize = 60;
    const roadWidth = 25;
    const spacing = blockSize + roadWidth;
    const totalSpan = gridSize * spacing;
    const offset = totalSpan / 2;

    // Ground & Roads
    for (let x = 0; x < totalSpan; x += 3.5) {
      for (let y = 0; y < totalSpan; y += 3.5) {
        const isRoadX = (x % spacing) >= blockSize;
        const isRoadY = (y % spacing) >= blockSize;
        const isRoad = isRoadX || isRoadY;

        let r = 0.18, g = 0.18, b = 0.2; // Asphalt
        if (!isRoad) {
          r = 0.45; g = 0.45; b = 0.45; // Sidewalk / plaza
        } else if ((x % spacing > blockSize + 11 && x % spacing < blockSize + 14) || (y % spacing > blockSize + 11 && y % spacing < blockSize + 14)) {
          r = 0.9; g = 0.85; b = 0.2; // Yellow road markings
        }
        lines.push(`${(x - offset).toFixed(2)} ${(y - offset).toFixed(2)} 0.00 ${r.toFixed(2)} ${g.toFixed(2)} ${b.toFixed(2)}`);
      }
    }

    // Buildings
    for (let gx = 0; gx < gridSize; gx++) {
      for (let gy = 0; gy < gridSize; gy++) {
        const bx = gx * spacing + blockSize / 2 - offset;
        const by = gy * spacing + blockSize / 2 - offset;
        const height = 40 + Math.sin(gx * 3.1 + gy * 1.7) * 30 + (gx === 3 && gy === 3 ? 120 : Math.random() * 50);

        // Building Walls & Windows
        const half = blockSize * 0.42;
        for (let z = 0; z < height; z += 2.5) {
          const isFloor = Math.floor(z / 4) % 2 === 0;
          for (let step = -half; step <= half; step += 2.5) {
            const addWallPoint = (px: number, py: number) => {
              const isWindow = isFloor && (Math.abs(step) % 8 > 2);
              const r = isWindow ? 0.35 : 0.75;
              const g = isWindow ? 0.65 : 0.72;
              const b = isWindow ? 0.95 : 0.70;
              lines.push(`${px.toFixed(2)} ${py.toFixed(2)} ${z.toFixed(2)} ${r.toFixed(2)} ${g.toFixed(2)} ${b.toFixed(2)}`);
            };
            addWallPoint(bx + step, by - half);
            addWallPoint(bx + step, by + half);
            addWallPoint(bx - half, by + step);
            addWallPoint(bx + half, by + step);
          }
        }

        // Building Roof
        for (let rx = -half; rx <= half; rx += 2.8) {
          for (let ry = -half; ry <= half; ry += 2.8) {
            lines.push(`${(bx + rx).toFixed(2)} ${(by + ry).toFixed(2)} ${height.toFixed(2)} 0.3 0.32 0.35`);
          }
        }
      }
    }

    return lines.join("\n");
  }

  public static generateForestCanyon(): string {
    const lines: string[] = ["//X Y Z Rf Gf Bf"];
    const width = 450;
    const length = 450;
    const step = 3.0;

    for (let x = -width / 2; x <= width / 2; x += step) {
      for (let y = -length / 2; y <= length / 2; y += step) {
        // Sinuous canyon meander
        const riverX = Math.sin(y * 0.015) * 80 + Math.cos(y * 0.005) * 30;
        const distToRiver = Math.abs(x - riverX);

        let z = Math.pow(distToRiver / 80, 1.8) * 45 + Math.sin(x * 0.04) * 8 + Math.cos(y * 0.04) * 8;
        let r = 0.45, g = 0.38, b = 0.28; // Rock/Terrain

        if (distToRiver < 18) {
          // River Water
          z = -2 + Math.sin(x * 0.2 + y * 0.1) * 0.5;
          r = 0.15; g = 0.45; b = 0.75;
        } else if (distToRiver > 35 && Math.random() > 0.6) {
          // Trees & Canopy
          const treeH = 12 + Math.random() * 10;
          for (let th = 0; th <= treeH; th += 3) {
            const spread = (1 - th / treeH) * 5;
            lines.push(`${(x + (Math.random() - 0.5) * spread).toFixed(2)} ${(y + (Math.random() - 0.5) * spread).toFixed(2)} ${(z + th).toFixed(2)} 0.12 0.58 0.22`);
          }
        }

        lines.push(`${x.toFixed(2)} ${y.toFixed(2)} ${z.toFixed(2)} ${r.toFixed(2)} ${g.toFixed(2)} ${b.toFixed(2)}`);
      }
    }

    return lines.join("\n");
  }

  public static generateDome(): string {
    const lines: string[] = ["//X Y Z Rf Gf Bf"];

    // Base Plinth & Steps
    for (let stepIdx = 0; stepIdx < 6; stepIdx++) {
      const radius = 180 - stepIdx * 6;
      const height = stepIdx * 2.5;
      for (let angle = 0; angle < Math.PI * 2; angle += 0.04) {
        for (let r = 0; r <= radius; r += 4) {
          const x = Math.cos(angle) * r;
          const y = Math.sin(angle) * r;
          lines.push(`${x.toFixed(2)} ${y.toFixed(2)} ${height.toFixed(2)} 0.85 0.82 0.78`);
        }
      }
    }

    // Circular Colonnade (32 Columns)
    const colCount = 28;
    const colRadius = 110;
    const colHeight = 65;
    for (let c = 0; c < colCount; c++) {
      const angle = (c / colCount) * Math.PI * 2;
      const cx = Math.cos(angle) * colRadius;
      const cy = Math.sin(angle) * colRadius;

      for (let h = 15; h <= colHeight; h += 2) {
        for (let ca = 0; ca < Math.PI * 2; ca += 0.6) {
          const px = cx + Math.cos(ca) * 4.5;
          const py = cy + Math.sin(ca) * 4.5;
          lines.push(`${px.toFixed(2)} ${py.toFixed(2)} ${h.toFixed(2)} 0.92 0.90 0.86`);
        }
      }
    }

    // Dome Hemispherical Shell
    const domeRadius = 90;
    const domeBaseZ = 65;
    for (let phi = 0; phi <= Math.PI / 2; phi += 0.035) {
      const ringRadius = Math.sin(phi) * domeRadius;
      const z = domeBaseZ + Math.cos(phi) * domeRadius * 0.75;
      const rColor = 0.8 + Math.cos(phi * 4) * 0.15;
      const gColor = 0.65 + Math.sin(phi * 4) * 0.1;
      const bColor = 0.35;

      for (let theta = 0; theta < Math.PI * 2; theta += 0.035) {
        const x = Math.cos(theta) * ringRadius;
        const y = Math.sin(theta) * ringRadius;
        lines.push(`${x.toFixed(2)} ${y.toFixed(2)} ${z.toFixed(2)} ${rColor.toFixed(2)} ${gColor.toFixed(2)} ${bColor.toFixed(2)}`);
      }
    }

    return lines.join("\n");
  }

  public static generateNorwayFjord(): string {
    const lines: string[] = ["//X Y Z Rf Gf Bf"];
    const width = 650;
    const length = 650;
    const step = 3.2;

    const baseEasting = 412500.0;
    const baseNorthing = 6886200.0;

    for (let x = -width / 2; x <= width / 2; x += step) {
      for (let y = -length / 2; y <= length / 2; y += step) {
        // Glacial Fjord Channel (curving through the mountains)
        const fjordCenter = Math.sin(y * 0.008) * 90 + Math.cos(y * 0.003) * 40;
        const distFromCenter = Math.abs(x - fjordCenter);
        const fjordHalfWidth = 65;

        let z = 0;
        let r = 0.45, g = 0.42, b = 0.38; // Granite rock

        if (distFromCenter < fjordHalfWidth) {
          // Fjord Water Surface
          z = 0.0 + Math.sin(x * 0.15 + y * 0.08) * 0.3;
          r = 0.08; g = 0.35; b = 0.58; // Deep Fjord Blue
        } else {
          // Steep Glacial Valley Walls rising abruptly up to 600-800m
          const wallDist = distFromCenter - fjordHalfWidth;
          const uProfile = Math.pow(wallDist / 140, 1.4) * 380;
          const mountainRoughness = Math.sin(x * 0.035) * 25 + Math.cos(y * 0.025) * 35;
          z = Math.max(5, uProfile + mountainRoughness);

          // Waterfalls cascading down the cliffs
          const isWaterfall = Math.abs(x - (fjordCenter + 75)) < 12 && z < 320;
          if (isWaterfall) {
            r = 0.85; g = 0.95; b = 1.0; // Frothing white water
          } else if (z < 180) {
            // Lower slopes: Nordic Pine & Birch forest
            r = 0.14; g = 0.45; b = 0.20;
            if (Math.random() > 0.55) {
              // Add tree canopy point
              const treeH = 8 + Math.random() * 8;
              lines.push(`${(baseEasting + x).toFixed(2)} ${(baseNorthing + y).toFixed(2)} ${(z + treeH).toFixed(2)} 0.10 0.52 0.18`);
            }
          } else if (z > 450) {
            // High Alpine Summits: Craggy scree & snow patches
            const isSnow = Math.sin(x * 0.08) + Math.cos(y * 0.08) > 0.6;
            if (isSnow) {
              r = 0.94; g = 0.96; b = 0.98; // Snow
            } else {
              r = 0.55; g = 0.52; b = 0.50; // Bare rock
            }
          }
        }

        lines.push(`${(baseEasting + x).toFixed(2)} ${(baseNorthing + y).toFixed(2)} ${z.toFixed(2)} ${r.toFixed(2)} ${g.toFixed(2)} ${b.toFixed(2)}`);
      }
    }

    return lines.join("\n");
  }
}
