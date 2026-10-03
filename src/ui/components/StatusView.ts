import { createElement } from "../utils/dom";

export class StatusView {
  public readonly element: HTMLElement;

  // Full view DOM elements (sidebar panel footer)
  private lblFile: HTMLElement | null;
  private lblPoints: HTMLElement | null;
  private lblBounds: HTMLElement | null;
  private progressContainer: HTMLElement | null;
  private progressBar: HTMLElement | null;

  // Minified view DOM elements (quick toolbar info pill)
  private infoFile: HTMLElement | null;
  private infoPts: HTMLElement | null;

  constructor() {
    let el = document.getElementById("status-info");
    if (!el) {
      const existingLabel = document.getElementById("lbl-file");
      if (existingLabel) {
        el = existingLabel.parentElement as HTMLElement;
      } else {
        el = createElement<HTMLElement>(StatusView.template());
      }
    }
    this.element = el;

    this.lblFile = this.element.querySelector("#lbl-file") || document.getElementById("lbl-file");
    this.lblPoints = this.element.querySelector("#lbl-points") || document.getElementById("lbl-points");
    this.lblBounds = this.element.querySelector("#lbl-bounds") || document.getElementById("lbl-bounds");
    this.progressContainer = this.element.querySelector("#progress-container") || document.getElementById("progress-container");
    this.progressBar = this.element.querySelector("#progress-bar") || document.getElementById("progress-bar");

    this.infoFile = document.getElementById("quick-info-file");
    this.infoPts = document.getElementById("quick-info-pts");
  }

  public updateStatus(fileName: string, statusText: string, boundsText: string = ""): void {
    // Update full view
    if (this.lblFile) this.lblFile.textContent = fileName;
    if (this.lblPoints) this.lblPoints.textContent = statusText;
    if (this.lblBounds) this.lblBounds.textContent = boundsText;

    // Update minified view (Point 5 Info Pill)
    if (!this.infoFile) this.infoFile = document.getElementById("quick-info-file");
    if (!this.infoPts) this.infoPts = document.getElementById("quick-info-pts");

    if (this.infoFile) {
      const cleanName = fileName.split("/").pop() || fileName;
      this.infoFile.textContent = cleanName;
    }
    if (this.infoPts) {
      let compact = statusText;
      const match = statusText.match(/([\d,]+)\s*(?:pts|points)/i);
      if (match) {
        compact = `${match[1]} pts`;
      }
      this.infoPts.textContent = compact;
    }
  }

  public setProgress(percent: number | null): void {
    if (!this.progressContainer || !this.progressBar) return;
    if (percent === null) {
      this.progressContainer.style.display = "none";
      this.progressBar.style.width = "0%";
    } else {
      this.progressContainer.style.display = "block";
      this.progressBar.style.width = `${Math.min(100, Math.max(5, percent))}%`;
    }
  }

  public getFileName(): string {
    return this.lblFile?.textContent || "pointcloud";
  }

  public static template(): string {
    return `
      <div id="status-info">
        <div id="progress-container">
          <div id="progress-bar"></div>
        </div>
        <div>File: <span id="lbl-file" style="color: #fff;">points.txt</span></div>
        <div>Points: <span id="lbl-points" style="color: #60a5fa;">Loading...</span></div>
        <div id="lbl-bounds" style="font-size: 10px; color: #64748b;"></div>
      </div>
    `;
  }
}
