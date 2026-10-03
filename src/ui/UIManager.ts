import { Viewer } from "../core/Viewer";
import { ToolManager } from "../tools/ToolManager";
import { ColorMode, ToolMode, MeasureResult, InspectedPoint } from "../types";
import { FileService } from "../services/FileService";

export class UIManager {
  private viewer: Viewer;
  private toolManager: ToolManager;
  private onFileOpenCallback: ((text: string, fileName: string) => void) | null = null;
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
  private selectColormap = document.getElementById("select-colormap") as HTMLSelectElement;
  private toggleGrid = document.getElementById("toggle-grid") as HTMLInputElement;
  private toggleOrtho = document.getElementById("toggle-ortho") as HTMLInputElement;
  private btnOpen = document.getElementById("btn-open") as HTMLButtonElement;
  private btnSnapshot = document.getElementById("btn-snapshot") as HTMLButtonElement;
  private dropOverlay = document.getElementById("drop-overlay")!;

  private measureBox = document.getElementById("measure-box")!;
  private measure3d = document.getElementById("measure-3d")!;
  private measureH = document.getElementById("measure-h")!;
  private measureZ = document.getElementById("measure-z")!;
  private btnClearMeasure = document.getElementById("btn-clear-measure") as HTMLButtonElement;
  private inspectorTooltip = document.getElementById("inspector-tooltip")!;

  private toolButtons: Record<ToolMode, HTMLButtonElement> = {
    orbit: document.getElementById("tool-orbit") as HTMLButtonElement,
    measure: document.getElementById("tool-measure") as HTMLButtonElement,
    inspect: document.getElementById("tool-inspect") as HTMLButtonElement
  };

  constructor(viewer: Viewer, toolManager: ToolManager) {
    this.viewer = viewer;
    this.toolManager = toolManager;

    this.bindEvents();
    this.bindToolCallbacks();
  }

  public onFileOpen(cb: (text: string, fileName: string) => void): void {
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
    (["orbit", "measure", "inspect"] as ToolMode[]).forEach((tool) => {
      this.toolButtons[tool].addEventListener("click", () => {
        this.toolManager.setMode(tool);
        Object.keys(this.toolButtons).forEach((k) => {
          this.toolButtons[k as ToolMode].classList.toggle("active", k === tool);
        });

        if (tool === "measure") {
          this.measureBox.style.display = "flex";
          this.measure3d.textContent = "Click first point on point cloud...";
          this.measureH.textContent = "-";
          this.measureZ.textContent = "-";
        } else {
          this.measureBox.style.display = "none";
        }
      });
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

    // Clear measurement button
    this.btnClearMeasure.addEventListener("click", () => this.toolManager.measurementTool.resetToIdle());

    // File Open dialog (uses FileService for Electron & Browser WebApp)
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
        const text = await file.text();
        this.onFileOpenCallback(text, file.name);
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

    // Inspector Tool Output
    this.toolManager.inspectorTool.onInspect((point: InspectedPoint | null) => {
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
}
