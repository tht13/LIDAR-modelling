export interface ParseResult {
  positions: Float32Array;
  colors: Float32Array;
  elevations: Float32Array;
  count: number;
  min: [number, number, number];
  max: [number, number, number];
  center: [number, number, number];
  size: [number, number, number];
  hasRGB: boolean;
}

export type ToolMode = "orbit" | "measure" | "profile" | "inspect" | "fly";

export enum ColorMode {
  RGB = 0,
  Turbo = 1,
  Viridis = 2,
  Plasma = 3,
  Rainbow = 4,
  Grayscale = 5
}

export type CameraPreset = "top" | "front" | "side" | "iso";

export type MeasureState = "idle" | "placed_first" | "completed";

export interface MeasureResult {
  state: MeasureState;
  distance3D?: number;
  horizontalDistance?: number;
  verticalDistance?: number;
}

export interface InspectedPoint {
  realX: number;
  realNorthing: number;
  realElevation: number;
  screenX: number;
  screenY: number;
}

declare global {
  interface Window {
    electronAPI: {
      getPoints: (fileName: string) => Promise<{ success: boolean; fileName?: string; data?: string; error?: string }>;
      openFileDialog: () => Promise<{ canceled: boolean; success?: boolean; fileName?: string; filePath?: string; data?: string; error?: string }>;
    };
  }
}
