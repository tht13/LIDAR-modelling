import { Viewer } from "../core/Viewer";
import { ToolManager } from "../tools/ToolManager";
import { ColorMode, ToolMode, MeasureResult, InspectedPoint } from "../types";
import { FileService } from "../services/FileService";
import { ProfileData } from "../tools/ProfileTool";
import { ExportService } from "../services/ExportService";

export class UIManager {
  private viewer: Viewer;
  private toolManager: ToolManager;
  private onFileOpenCallback: ((data: string | ArrayBuffer, fileName: string) => void) | null = null;
  private onDatasetSelectCallback: ((datasetId: string) => void) | null = null;

  // DOM Elements
  private uiPanel = document.getElementById("ui-panel")!;
  private btnFloatingMenu = document.getElementById("btn-floating-menu") as HTMLButtonElement;
  private btnMinimizeMenu = document.getElementById("btn-minimize-menu") as HTMLButtonElement;
  private selectDataset = document.getElementById("select-dataset") as HTMLSelectElement;
  private toggleEDL = document.getElementById("toggle-edl") as HTMLInputElement;
  private sliderEDL = document.getElementById("slider-edl") as HTMLInputElement;
  private edlStrengthVal = document.getElementById("edl-strength-val")!;
  private edlStrengthGroup = document.getElementById("edl-strength-group")!;

  private lblFile = document.getElementById("lbl-file")!;
  private lblPoints = document.getElementById("lbl-points")!;
  private lblBounds = document.getElementById("lbl-bounds")!;
  private progressContainer = document.getElementById("progress-container")!;
  private progressBar = document.getElementById("progress-bar")!;

  private sliderSize = document.getElementById("slider-size") as HTMLInputElement;
  private pointSizeVal = document.getElementById("point-size-val")!;
  private sliderBg = document.getElementById("slider-bg") as HTMLInputElement;
  private bgBrightnessVal = document.getElementById("bg-brightness-val")!;
  private selectVoxelFilter = document.getElementById("select-voxel-filter") as HTMLSelectElement;
  private voxelFilterVal = document.getElementById("voxel-filter-val")!;
  private sliderDecimation = document.getElementById("slider-decimation") as HTMLInputElement;
  private decimationVal = document.getElementById("decimation-val")!;
  private selectColormap = document.getElementById("select-colormap") as HTMLSelectElement;
  private toggleGrid = document.getElementById("toggle-grid") as HTMLInputElement;
  private toggleOrtho = document.getElementById("toggle-ortho") as HTMLInputElement;
  private btnOpen = document.getElementById("btn-open") as HTMLButtonElement;
  private btnSnapshot = document.getElementById("btn-snapshot") as HTMLButtonElement;
  private dropOverlay = document.getElementById("drop-overlay")!;

  // Measure Elements
  private measureBox = document.getElementById("measure-box")!;
  private measure3d = document.getElementById("measure-3d")!;
  private measureH = document.getElementById("measure-h")!;
  private measureZ = document.getElementById("measure-z")!;
  private btnClearMeasure = document.getElementById("btn-clear-measure") as HTMLButtonElement;
  private inspectorTooltip = document.getElementById("inspector-tooltip")!;

  // 2D Profile Elements
  private profilePanel = document.getElementById("profile-panel")!;
  private profileCanvas = document.getElementById("profile-canvas") as HTMLCanvasElement;
  private profileStats = document.getElementById("profile-stats")!;
  private btnCloseProfile = document.getElementById("btn-close-profile") as HTMLButtonElement;

  // Fly Hint Element
  private flyHint = document.getElementById("fly-hint")!;

  private toolButtons: Record<ToolMode, HTMLButtonElement> = {
    orbit: document.getElementById("tool-orbit") as HTMLButtonElement,
    measure: document.getElementById("tool-measure") as HTMLButtonElement,
    profile: document.getElementById("tool-profile") as HTMLButtonElement,
    inspect: document.getElementById("tool-inspect") as HTMLButtonElement,
    fly: document.getElementById("tool-fly") as HTMLButtonElement
  };

  constructor(viewer: Viewer, toolManager: ToolManager) {
    this.viewer = viewer;
    this.toolManager = toolManager;

    this.bindEvents();
    this.bindToolCallbacks();
  }

  public onFileOpen(cb: (data: string | ArrayBuffer, fileName: string) => void): void {
    this.onFileOpenCallback = cb;
  }

  public onDatasetSelect(cb: (datasetId: string) => void): void {
    this.onDatasetSelectCallback = cb;
  }

  public updateStatus(fileName: string, statusText: string, boundsText: string = ""): void {
    this.lblFile.textContent = fileName;
    this.lblPoints.textContent = statusText;
    this.lblBounds.textContent = boundsText;
  }

  public setProgress(percent: number | null): void {
    if (percent === null) {
      this.progressContainer.style.display = "none";
      this.progressBar.style.width = "0%";
    } else {
      this.progressContainer.style.display = "block";
      this.progressBar.style.width = `${Math.min(100, Math.max(5, percent))}%`;
    }
  }

  public setColormapValue(mode: ColorMode): void {
    this.selectColormap.value = mode.toString();
  }

  public setDatasetValue(id: string): void {
    if (this.selectDataset) {
      this.selectDataset.value = id;
    }
  }

  public getPointSize(): number {
    return parseFloat(this.sliderSize.value) || 3.0;
  }

  public isOrthoChecked(): boolean {
    return this.toggleOrtho.checked;
  }

  public minimizeMenu(): void {
    this.uiPanel.classList.add("minimized");
    this.btnFloatingMenu.style.display = "flex";
  }

  public expandMenu(): void {
    this.uiPanel.classList.remove("minimized");
    this.btnFloatingMenu.style.display = "none";
  }

  public toggleMenu(): void {
    if (this.uiPanel.classList.contains("minimized")) {
      this.expandMenu();
    } else {
      this.minimizeMenu();
    }
  }

  private bindEvents(): void {
    // Minimize / Expand Menu
    this.btnMinimizeMenu?.addEventListener("click", () => this.minimizeMenu());
    this.btnFloatingMenu?.addEventListener("click", () => this.expandMenu());

    // Close Profile Panel
    this.btnCloseProfile?.addEventListener("click", () => {
      this.profilePanel.style.display = "none";
      this.toolManager.profileTool.clear();
    });

    // Keyboard shortcut 'M'
    window.addEventListener("keydown", (e: KeyboardEvent) => {
      if (e.key === "m" || e.key === "M") {
        const target = e.target as HTMLElement;
        if (target && (target.tagName === "INPUT" || target.tagName === "SELECT" || target.tagName === "TEXTAREA")) {
          return;
        }
        this.toggleMenu();
      }
    });

    // Sample Dataset Selector
    this.selectDataset?.addEventListener("change", () => {
      const selected = this.selectDataset.value;
      if (selected === "custom-url") {
        const url = prompt("Enter public URL of point cloud (.txt, .xyz, .csv, .pts):");
        if (url && this.onDatasetSelectCallback) {
          this.onDatasetSelectCallback(`url:${url}`);
        } else {
          this.selectDataset.value = "mountain-lidar";
        }
      } else if (this.onDatasetSelectCallback) {
        this.onDatasetSelectCallback(selected);
      }
    });

    // Eye-Dome Lighting (EDL) Toggle
    this.toggleEDL?.addEventListener("change", () => {
      const enabled = this.toggleEDL.checked;
      this.viewer.setEDLEnabled(enabled);
      this.edlStrengthGroup.style.display = enabled ? "flex" : "none";
    });

    // EDL Strength Slider
    this.sliderEDL?.addEventListener("input", () => {
      const val = parseFloat(this.sliderEDL.value);
      this.edlStrengthVal.textContent = val.toFixed(1);
      this.viewer.setEDLStrength(val);
    });

    // Tool Switching
    (["orbit", "measure", "profile", "inspect", "fly"] as ToolMode[]).forEach((tool) => {
      this.toolButtons[tool].addEventListener("click", () => {
        this.toolManager.setMode(tool);
        Object.keys(this.toolButtons).forEach((k) => {
          this.toolButtons[k as ToolMode].classList.toggle("active", k === tool);
        });

        this.flyHint.style.display = tool === "fly" ? "flex" : "none";

        if (tool === "fly") {
          const speedEl = document.getElementById("fly-speed-val");
          if (speedEl) speedEl.textContent = this.viewer.firstPersonControls.getSpeed().toString();
          this.measureBox.style.display = "none";
          this.profilePanel.style.display = "none";
        } else if (tool === "measure") {
          this.measureBox.style.display = "flex";
          this.measure3d.textContent = "Click first point on point cloud...";
          this.measureH.textContent = "-";
          this.measureZ.textContent = "-";
          this.profilePanel.style.display = "none";
        } else if (tool === "profile") {
          this.measureBox.style.display = "none";
          this.profilePanel.style.display = "none";
        } else {
          this.measureBox.style.display = "none";
          this.profilePanel.style.display = "none";
        }
      });
    });

    // Sync Fly Speed updates to HUD banner
    this.viewer.firstPersonControls.onSpeedChange((speed) => {
      const speedEl = document.getElementById("fly-speed-val");
      if (speedEl) speedEl.textContent = speed.toString();
    });

    // Colormap selection
    this.selectColormap.addEventListener("change", () => {
      if (this.viewer.pointCloud) {
        this.viewer.pointCloud.setColorMode(parseInt(this.selectColormap.value, 10));
      }
    });

    // Point size slider
    this.sliderSize.addEventListener("input", () => {
      const size = parseFloat(this.sliderSize.value);
      this.pointSizeVal.textContent = size.toFixed(1);
      if (this.viewer.pointCloud) {
        this.viewer.pointCloud.setPointSize(size);
      }
    });

    // Background brightness slider
    this.sliderBg.addEventListener("input", () => {
      const val = parseFloat(this.sliderBg.value);
      this.viewer.setBackgroundBrightness(val / 100);
      this.bgBrightnessVal.textContent = val < 25 ? `Dark (${Math.round(val)}%)` : val < 70 ? `Medium (${Math.round(val)}%)` : `Light (${Math.round(val)}%)`;
    });

    // Voxel Downsampling Filter
    this.selectVoxelFilter?.addEventListener("change", () => {
      const voxelSize = parseFloat(this.selectVoxelFilter.value);
      if (this.viewer.pointCloud) {
        // Reset decimation slider to 100% when choosing voxel filter
        this.sliderDecimation.value = "100";
        this.decimationVal.textContent = "100%";

        const activeCount = this.viewer.pointCloud.applyVoxelGrid(voxelSize);
        const total = this.viewer.pointCloud.data.count;
        const pct = Math.round((activeCount / total) * 100);
        this.voxelFilterVal.textContent = voxelSize > 0 ? `${voxelSize}m (${pct}%)` : "Off (100%)";
        this.lblPoints.textContent = `${activeCount.toLocaleString()} / ${total.toLocaleString()} pts (${pct}%)`;
      }
    });

    // Decimation Density Slider
    this.sliderDecimation?.addEventListener("input", () => {
      const pctVal = parseInt(this.sliderDecimation.value, 10);
      const ratio = pctVal / 100;
      this.decimationVal.textContent = `${pctVal}%`;
      if (this.viewer.pointCloud) {
        // Reset voxel select when using decimation slider
        this.selectVoxelFilter.value = "0";
        this.voxelFilterVal.textContent = "Off (100%)";

        const activeCount = this.viewer.pointCloud.applyDecimation(ratio);
        const total = this.viewer.pointCloud.data.count;
        const pct = Math.round((activeCount / total) * 100);
        this.lblPoints.textContent = `${activeCount.toLocaleString()} / ${total.toLocaleString()} pts (${pct}%)`;
      }
    });

    // Reference grid toggle
    this.toggleGrid.addEventListener("change", () => {
      this.viewer.setGridVisible(this.toggleGrid.checked);
    });

    // Orthographic toggle
    this.toggleOrtho.addEventListener("change", () => {
      this.viewer.setOrthoMode(this.toggleOrtho.checked);
    });

    // Camera preset buttons
    document.getElementById("btn-view-top")?.addEventListener("click", () => this.viewer.setCameraPreset("top"));
    document.getElementById("btn-view-front")?.addEventListener("click", () => this.viewer.setCameraPreset("front"));
    document.getElementById("btn-view-side")?.addEventListener("click", () => this.viewer.setCameraPreset("side"));
    document.getElementById("btn-view-reset")?.addEventListener("click", () => this.viewer.setCameraPreset("iso"));

    // Snapshot button
    this.btnSnapshot.addEventListener("click", () => this.viewer.exportSnapshot());

    // Export buttons
    document.getElementById("btn-export-ply")?.addEventListener("click", () => {
      if (!this.viewer.pointCloud) return;
      const baseName = (this.lblFile.textContent || "pointcloud").replace(/\.[^/.]+$/, "");
      const blob = ExportService.exportToPLY(this.viewer.pointCloud, true);
      ExportService.saveBlob(blob, `${baseName}-export.ply`);
    });

    document.getElementById("btn-export-xyz")?.addEventListener("click", () => {
      if (!this.viewer.pointCloud) return;
      const baseName = (this.lblFile.textContent || "pointcloud").replace(/\.[^/.]+$/, "");
      const blob = ExportService.exportToXYZ(this.viewer.pointCloud, true);
      ExportService.saveBlob(blob, `${baseName}-export.xyz`);
    });

    // Clear measurement button
    this.btnClearMeasure.addEventListener("click", () => this.toolManager.measurementTool.resetToIdle());

    // File Open dialog
    this.btnOpen.addEventListener("click", async () => {
      try {
        const res = await FileService.openFilePicker();
        if (!res.canceled && res.success && res.data && this.onFileOpenCallback) {
          this.onFileOpenCallback(res.data, res.fileName || "custom.txt");
        }
      } catch (err) {
        console.error("Failed to open file dialog:", err);
      }
    });

    // Drag and Drop
    window.addEventListener("dragover", (e) => { e.preventDefault(); this.dropOverlay.style.display = "flex"; });
    window.addEventListener("dragleave", (e) => { if (e.relatedTarget === null) this.dropOverlay.style.display = "none"; });
    window.addEventListener("drop", async (e) => {
      e.preventDefault();
      this.dropOverlay.style.display = "none";
      if (e.dataTransfer && e.dataTransfer.files.length > 0 && this.onFileOpenCallback) {
        const file = e.dataTransfer.files[0];
        const ext = file.name.toLowerCase();
        const isBinary = ext.endsWith(".las") || ext.endsWith(".laz");
        const data = isBinary ? await file.arrayBuffer() : await file.text();
        this.onFileOpenCallback(data, file.name);
      }
    });
  }

  private bindToolCallbacks(): void {
    // Measurement Tool Output
    this.toolManager.measurementTool.onMeasurement((result: MeasureResult) => {
      if (this.toolManager.getMode() !== "measure") {
        this.measureBox.style.display = "none";
        return;
      }

      this.measureBox.style.display = "flex";

      if (result.state === "idle") {
        this.measure3d.textContent = "Click first point on point cloud...";
        this.measureH.textContent = "-";
        this.measureZ.textContent = "-";
      } else if (result.state === "placed_first") {
        this.measure3d.textContent = "Point 1 placed. Click second point...";
        this.measureH.textContent = "-";
        this.measureZ.textContent = "-";
      } else if (result.state === "completed" && result.distance3D !== undefined) {
        this.measure3d.textContent = `${result.distance3D.toFixed(2)} m`;
        this.measureH.textContent = `${result.horizontalDistance?.toFixed(2)} m`;
        this.measureZ.textContent = `${result.verticalDistance?.toFixed(2)} m`;
      }
    });

    // Profile Tool Output
    this.toolManager.profileTool.onProfile((data: ProfileData | null, statusText?: string) => {
      if (this.toolManager.getMode() !== "profile") {
        this.profilePanel.style.display = "none";
        return;
      }

      if (data && data.points.length > 0) {
        this.profilePanel.style.display = "flex";
        this.drawProfileChart(data);
      } else {
        if (statusText) {
          this.updateStatus(document.getElementById("lbl-file")?.textContent || "", statusText);
        }
      }
    });

    // Inspector Tool Output
    this.toolManager.inspectorTool.onInspect((point: InspectedPoint | null) => {
      if (!this.inspectorTooltip) return;
      if (point) {
        this.inspectorTooltip.style.display = "block";
        this.inspectorTooltip.style.left = `${point.screenX + 14}px`;
        this.inspectorTooltip.style.top = `${point.screenY + 14}px`;
        this.inspectorTooltip.innerHTML = `
          <div style="color: #60a5fa; font-weight: bold; margin-bottom: 2px;">Point Info</div>
          <div>Easting (X): ${point.realX.toFixed(3)}</div>
          <div>Northing (Y): ${point.realNorthing.toFixed(3)}</div>
          <div>Elevation (Z): ${point.realElevation.toFixed(3)} m</div>
        `;
      } else {
        this.inspectorTooltip.style.display = "none";
      }
    });
  }

  private drawProfileChart(data: ProfileData): void {
    const canvas = this.profileCanvas;
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = rect.width * dpr;
    canvas.height = 130 * dpr;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.scale(dpr, dpr);

    const w = rect.width;
    const h = 130;
    const padding = { top: 18, right: 24, bottom: 26, left: 55 };
    const chartW = w - padding.left - padding.right;
    const chartH = h - padding.top - padding.bottom;

    ctx.clearRect(0, 0, w, h);

    const minZ = data.minElevation;
    const maxZ = data.maxElevation;
    const zRange = Math.max(1.0, maxZ - minZ);
    const totalDist = Math.max(1.0, data.totalDistance);

    // Update stats label
    this.profileStats.textContent = `Len: ${data.totalDistance.toFixed(1)}m | Elev: ${minZ.toFixed(1)}m – ${maxZ.toFixed(1)}m (ΔZ: ${(maxZ - minZ).toFixed(1)}m) | ${data.points.length} pts`;

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
}
