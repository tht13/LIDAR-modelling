import { MeasureResult } from "../../types";
import { createElement } from "../utils/dom";

export class MeasurementHud {
  public readonly element: HTMLElement;
  private measure3d: HTMLElement | null;
  private measureH: HTMLElement | null;
  private measureZ: HTMLElement | null;
  private btnClear: HTMLButtonElement | null;
  private onClearCallback: (() => void) | null = null;

  constructor() {
    let el = document.getElementById("measure-box");
    if (!el) {
      el = createElement<HTMLElement>(MeasurementHud.template());
    }
    this.element = el;

    this.measure3d = this.element.querySelector("#measure-3d") || document.getElementById("measure-3d");
    this.measureH = this.element.querySelector("#measure-h") || document.getElementById("measure-h");
    this.measureZ = this.element.querySelector("#measure-z") || document.getElementById("measure-z");
    this.btnClear = this.element.querySelector("#btn-clear-measure") || (document.getElementById("btn-clear-measure") as HTMLButtonElement | null);

    this.btnClear?.addEventListener("click", () => {
      this.resetReadouts();
      if (this.onClearCallback) {
        this.onClearCallback();
      }
    });
  }

  public onClear(cb: () => void): void {
    this.onClearCallback = cb;
  }

  public show(): void {
    this.element.style.display = "flex";
  }

  public hide(): void {
    this.element.style.display = "none";
  }

  public resetReadouts(): void {
    if (this.measure3d) this.measure3d.textContent = "Click first point on point cloud...";
    if (this.measureH) this.measureH.textContent = "-";
    if (this.measureZ) this.measureZ.textContent = "-";
  }

  public update(result: MeasureResult): void {
    this.show();

    if (result.state === "idle") {
      this.resetReadouts();
    } else if (result.state === "placed_first") {
      if (this.measure3d) this.measure3d.textContent = "Point 1 placed. Click second point...";
      if (this.measureH) this.measureH.textContent = "-";
      if (this.measureZ) this.measureZ.textContent = "-";
    } else if (result.state === "completed" && result.distance3D !== undefined) {
      if (this.measure3d) this.measure3d.textContent = `${result.distance3D.toFixed(2)} m`;
      if (this.measureH) this.measureH.textContent = `${result.horizontalDistance?.toFixed(2)} m`;
      if (this.measureZ) this.measureZ.textContent = `${result.verticalDistance?.toFixed(2)} m`;
    }
  }

  public static template(): string {
    return `
      <div id="measure-box">
        <div>3D: <span id="measure-3d" class="measure-val">0.00 m</span></div>
        <div>Horiz (ΔH): <span id="measure-h" class="measure-val">0.00 m</span></div>
        <div>Vert (ΔZ): <span id="measure-z" class="measure-val">0.00 m</span></div>
        <button id="btn-clear-measure" class="btn btn-secondary" style="padding: 4px 8px; font-size: 11px;">Clear</button>
      </div>
    `;
  }
}
