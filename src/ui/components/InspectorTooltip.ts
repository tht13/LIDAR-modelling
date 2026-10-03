import { InspectedPoint } from "../../types";
import { createElement } from "../utils/dom";

export class InspectorTooltip {
  public readonly element: HTMLElement;

  constructor() {
    let el = document.getElementById("inspector-tooltip");
    if (!el) {
      el = createElement<HTMLElement>(InspectorTooltip.template());
    }
    this.element = el;
  }

  public show(point: InspectedPoint): void {
    this.element.style.display = "block";
    this.element.style.left = `${point.screenX + 14}px`;
    this.element.style.top = `${point.screenY + 14}px`;
    this.element.innerHTML = `
      <div style="color: #60a5fa; font-weight: bold; margin-bottom: 2px;">Point Info</div>
      <div>Easting (X): ${point.realX.toFixed(3)}</div>
      <div>Northing (Y): ${point.realNorthing.toFixed(3)}</div>
      <div>Elevation (Z): ${point.realElevation.toFixed(3)} m</div>
    `;
  }

  public hide(): void {
    this.element.style.display = "none";
  }

  public static template(): string {
    return `<div id="inspector-tooltip"></div>`;
  }
}
