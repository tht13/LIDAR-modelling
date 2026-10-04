import { ProfileData } from "../../tools/ProfileTool";
import { createElement } from "../utils/dom";

export class ProfileChart {
  public readonly element: HTMLElement;
  private canvas: HTMLCanvasElement | null;
  private stats: HTMLElement | null;
  private btnClose: HTMLButtonElement | null;
  private onCloseCallback: (() => void) | null = null;

  private lastData: ProfileData | null = null;

  constructor() {
    let el = document.getElementById("profile-panel");
    if (!el) {
      el = createElement<HTMLElement>(ProfileChart.template());
    }
    this.element = el;

    this.canvas = this.element.querySelector("#profile-canvas") || (document.getElementById("profile-canvas") as HTMLCanvasElement | null);
    this.stats = this.element.querySelector("#profile-stats") || document.getElementById("profile-stats");
    this.btnClose = this.element.querySelector("#btn-close-profile") || (document.getElementById("btn-close-profile") as HTMLButtonElement | null);

    this.btnClose?.addEventListener("click", () => {
      this.hide();
      if (this.onCloseCallback) {
        this.onCloseCallback();
      }
    });

    if (typeof window !== "undefined") {
      window.addEventListener("resize", () => {
        if (this.lastData && this.element.style.display !== "none") {
          this.render(this.lastData);
        }
      });
    }
  }

  public onClose(cb: () => void): void {
    this.onCloseCallback = cb;
  }

  public show(): void {
    this.element.style.display = "flex";
  }

  public hide(): void {
    this.lastData = null;
    this.element.style.display = "none";
  }

  public render(data: ProfileData): void {
    if (!this.canvas) return;
    this.lastData = data;
    this.show();

    const canvas = this.canvas;
    const rect = canvas.getBoundingClientRect();
    const dpr = typeof window !== "undefined" && window.devicePixelRatio ? window.devicePixelRatio : 1;
    const w = rect.width > 0 ? rect.width : (canvas.clientWidth > 0 ? canvas.clientWidth : 500);
    const h = rect.height > 0 ? rect.height : (canvas.clientHeight > 0 ? canvas.clientHeight : 130);

    canvas.width = w * dpr;
    canvas.height = h * dpr;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.scale(dpr, dpr);

    const padding = { top: 18, right: 24, bottom: 26, left: 55 };
    const chartW = Math.max(10, w - padding.left - padding.right);
    const chartH = Math.max(10, h - padding.top - padding.bottom);

    ctx.clearRect(0, 0, w, h);

    const minZ = data.minElevation;
    const maxZ = data.maxElevation;
    const zRange = Math.max(1.0, maxZ - minZ);
    const totalDist = Math.max(1.0, data.totalDistance);

    // Update stats label
    if (this.stats) {
      this.stats.textContent = `Len: ${data.totalDistance.toFixed(1)}m | Elev: ${minZ.toFixed(1)}m – ${maxZ.toFixed(1)}m (ΔZ: ${(maxZ - minZ).toFixed(1)}m) | ${data.points.length} pts`;
    }

    // Draw Grid & Axes
    ctx.strokeStyle = "rgba(255, 255, 255, 0.08)";
    ctx.lineWidth = 1;
    ctx.fillStyle = "#64748b";
    ctx.font = "10px sans-serif";
    ctx.textAlign = "right";

    // 3 Horizontal elevation grid lines
    for (let i = 0; i <= 3; i++) {
      const y = padding.top + chartH * (i / 3);
      const elev = maxZ - zRange * (i / 3);
      ctx.beginPath();
      ctx.moveTo(padding.left, y);
      ctx.lineTo(padding.left + chartW, y);
      ctx.stroke();
      ctx.fillText(`${elev.toFixed(1)}m`, padding.left - 6, y + 3);
    }

    // Distance X labels
    ctx.textAlign = "center";
    for (let i = 0; i <= 4; i++) {
      const x = padding.left + chartW * (i / 4);
      const dist = totalDist * (i / 4);
      ctx.fillText(`${dist.toFixed(0)}m`, x, h - 8);
    }

    // Draw Profile Area Fill & Curve
    if (data.points.length > 1) {
      const gradient = ctx.createLinearGradient(0, padding.top, 0, padding.top + chartH);
      gradient.addColorStop(0, "rgba(168, 85, 247, 0.45)");
      gradient.addColorStop(1, "rgba(59, 130, 246, 0.05)");

      ctx.beginPath();
      const firstX = padding.left + (data.points[0].distance / totalDist) * chartW;
      const firstY = padding.top + (1 - (data.points[0].originalElevation - minZ) / zRange) * chartH;
      ctx.moveTo(firstX, padding.top + chartH);
      ctx.lineTo(firstX, firstY);

      for (let i = 1; i < data.points.length; i++) {
        const pt = data.points[i];
        const px = padding.left + (pt.distance / totalDist) * chartW;
        const py = padding.top + (1 - (pt.originalElevation - minZ) / zRange) * chartH;
        ctx.lineTo(px, py);
      }

      const lastX = padding.left + (data.points[data.points.length - 1].distance / totalDist) * chartW;
      ctx.lineTo(lastX, padding.top + chartH);
      ctx.closePath();
      ctx.fillStyle = gradient;
      ctx.fill();

      // Draw Top Silhouette Line
      ctx.beginPath();
      ctx.moveTo(firstX, firstY);
      for (let i = 1; i < data.points.length; i++) {
        const pt = data.points[i];
        const px = padding.left + (pt.distance / totalDist) * chartW;
        const py = padding.top + (1 - (pt.originalElevation - minZ) / zRange) * chartH;
        ctx.lineTo(px, py);
      }
      ctx.strokeStyle = "#c084fc";
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  }

  public static template(): string {
    return `
      <div id="profile-panel">
        <div class="profile-header">
          <div style="display: flex; align-items: center; gap: 8px;">
            <span style="font-weight: 700; color: #c084fc;">📊 2D Elevation Profile</span>
            <span id="profile-stats" style="font-size: 11px; color: #94a3b8;"></span>
          </div>
          <button id="btn-close-profile" class="btn btn-secondary btn-icon" title="Close Profile">✕</button>
        </div>
        <canvas id="profile-canvas"></canvas>
      </div>
    `;
  }
}
