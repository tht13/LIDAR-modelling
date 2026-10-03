import { LASParser } from "./LASParser";

export interface SampleDataset {
  id: string;
  name: string;
  type: "file" | "generator" | "binary";
  url?: string;
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
      type: "generator"
    },
    {
      id: "urban-city",
      name: "🏙️ Urban City Grid & Skyscrapers",
      type: "generator"
    },
    {
      id: "forest-canyon",
      name: "🌲 River Canyon & Forest Canopy",
      type: "generator"
    },
    {
      id: "monument-dome",
      name: "🏛️ Architectural Pavilion & Dome",
      type: "generator"
    }
  ];
}
