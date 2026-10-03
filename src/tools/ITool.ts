import * as THREE from "three";
import { ToolMode } from "../types";

export interface ITool {
  readonly id: ToolMode;
  readonly cursor: string;
  readonly allowsOrbit: boolean;
  activate(): void;
  deactivate(): void;
  clear(): void;
  handleClick?(intersectedPoint: THREE.Vector3 | null): void;
  handlePointerMove?(intersectedPoint: THREE.Vector3 | null, screenX: number, screenY: number): void;
}
