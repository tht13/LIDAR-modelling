import { Viewer } from "../../core/Viewer";
import { ColorMode } from "../../types";
import { ExportService } from "../../services/ExportService";
import { createElement } from "../utils/dom";

export class RenderSettingsPanel {
  public readonly element: HTMLElement;
  private viewer: Viewer;

  // Full view DOM elements (sidebar panel)
  private toggleEDL: HTMLInputElement | null;
  private sliderEDL: HTMLInputElement | null;
  private edlStrengthVal: HTMLElement | null;
  private edlStrengthGroup: HTMLElement | null;

  private selectColormap: HTMLSelectElement | null;
  private sliderSize: HTMLInputElement | null;
  private pointSizeVal: HTMLElement | null;
  private sliderBg: HTMLInputElement | null;
  private bgBrightnessVal: HTMLElement | null;

  private selectVoxelFilter: HTMLSelectElement | null;
  private voxelFilterVal: HTMLElement | null;
  private sliderDecimation: HTMLInputElement | null;
  private decimationVal: HTMLElement | null;

  private toggleGrid: HTMLInputElement | null;
  private toggleOrtho: HTMLInputElement | null;
  private btnSnapshot: HTMLButtonElement | null;

  private selectImportBudget: HTMLSelectElement | null;
  private importBudgetVal: HTMLElement | null;

  // Minified view DOM elements (quick toolbar)
  private miniToggleEDL: HTMLButtonElement | null;
  private miniToggleOrtho: HTMLButtonElement | null;
  private miniCamIso: HTMLButtonElement | null;
  private miniCamTop: HTMLButtonElement | null;
  private miniSnapshot: HTMLButtonElement | null;

  private onImportBudgetCallback: ((budget: number) => void) | null = null;
  private onFilterChangeCallback: ((activeCount: number, totalCount: number, pct: number) => void) | null = null;
  private getFileNameCallback: (() => string) | null = null;

  constructor(viewer: Viewer) {
    this.viewer = viewer;

    let el = document.getElementById("render-settings-panel");
    if (!el) {
      const existingToggle = document.getElementById("toggle-edl");
      if (existingToggle) {
        el = existingToggle.closest(".render-settings-group") || existingToggle.parentElement as HTMLElement;
      } else {
        el = createElement<HTMLElement>(RenderSettingsPanel.template());
      }
    }
    this.element = el;

    // Full sidebar elements scoped to element with document fallback
    const find = <T extends HTMLElement>(selector: string): T | null => {
      return (this.element.querySelector(selector) || document.querySelector(selector)) as T | null;
    };

    this.toggleEDL = find<HTMLInputElement>("#toggle-edl");
    this.sliderEDL = find<HTMLInputElement>("#slider-edl");
    this.edlStrengthVal = find<HTMLElement>("#edl-strength-val");
    this.edlStrengthGroup = find<HTMLElement>("#edl-strength-group");

    this.selectColormap = find<HTMLSelectElement>("#select-colormap");
    this.sliderSize = find<HTMLInputElement>("#slider-size");
    this.pointSizeVal = find<HTMLElement>("#point-size-val");
    this.sliderBg = find<HTMLInputElement>("#slider-bg");
    this.bgBrightnessVal = find<HTMLElement>("#bg-brightness-val");

    this.selectVoxelFilter = find<HTMLSelectElement>("#select-voxel-filter");
    this.voxelFilterVal = find<HTMLElement>("#voxel-filter-val");
    this.sliderDecimation = find<HTMLInputElement>("#slider-decimation");
    this.decimationVal = find<HTMLElement>("#decimation-val");

    this.toggleGrid = find<HTMLInputElement>("#toggle-grid");
    this.toggleOrtho = find<HTMLInputElement>("#toggle-ortho");
    this.btnSnapshot = find<HTMLButtonElement>("#btn-snapshot");

    this.selectImportBudget = find<HTMLSelectElement>("#select-import-budget");
    this.importBudgetVal = find<HTMLElement>("#import-budget-val");

    // Minified quick toolbar elements
    this.miniToggleEDL = document.getElementById("quick-toggle-edl") as HTMLButtonElement | null;
    this.miniToggleOrtho = document.getElementById("quick-toggle-ortho") as HTMLButtonElement | null;
    this.miniCamIso = document.getElementById("quick-cam-iso") as HTMLButtonElement | null;
    this.miniCamTop = document.getElementById("quick-cam-top") as HTMLButtonElement | null;
    this.miniSnapshot = document.getElementById("quick-action-snapshot") as HTMLButtonElement | null;

    this.bindEvents();
  }

  public onImportBudgetChange(cb: (budget: number) => void): void {
    this.onImportBudgetCallback = cb;
  }

  public onFilterChange(cb: (activeCount: number, totalCount: number, pct: number) => void): void {
    this.onFilterChangeCallback = cb;
  }

  public setFileNameProvider(cb: () => string): void {
    this.getFileNameCallback = cb;
  }

  public getImportBudget(): number {
    return this.selectImportBudget ? parseInt(this.selectImportBudget.value, 10) : 5_000_000;
  }

  public getPointSize(): number {
    return this.sliderSize ? parseFloat(this.sliderSize.value) || 3.0 : 3.0;
  }

  public isOrthoChecked(): boolean {
    return !!this.toggleOrtho?.checked;
  }

  public setColormapValue(mode: ColorMode): void {
    if (this.selectColormap) {
      this.selectColormap.value = mode.toString();
    }
  }

  public setEDLEnabled(enabled: boolean): void {
    this.viewer.setEDLEnabled(enabled);
    if (this.toggleEDL) this.toggleEDL.checked = enabled;
    if (this.edlStrengthGroup) this.edlStrengthGroup.style.display = enabled ? "flex" : "none";
    if (this.miniToggleEDL) this.miniToggleEDL.classList.toggle("active", enabled);
  }

  public setOrthoMode(useOrtho: boolean): void {
    this.viewer.setOrthoMode(useOrtho);
    if (this.toggleOrtho) this.toggleOrtho.checked = useOrtho;
    if (this.miniToggleOrtho) this.miniToggleOrtho.classList.toggle("active", useOrtho);
  }

  private bindEvents(): void {
    // Full Eye-Dome Lighting (EDL) Toggle
    this.toggleEDL?.addEventListener("change", () => {
      this.setEDLEnabled(!!this.toggleEDL?.checked);
    });

    // Minified EDL Toggle in Quick Toolbar
    this.miniToggleEDL?.addEventListener("click", () => {
      this.setEDLEnabled(!this.viewer.edlPass.enabled);
    });

    // EDL Strength Slider
    this.sliderEDL?.addEventListener("input", () => {
      if (!this.sliderEDL) return;
      const val = parseFloat(this.sliderEDL.value);
      if (this.edlStrengthVal) {
        this.edlStrengthVal.textContent = val.toFixed(1);
      }
      this.viewer.setEDLStrength(val);
    });

    // Colormap selection
    this.selectColormap?.addEventListener("change", () => {
      if (this.viewer.pointCloud && this.selectColormap) {
        this.viewer.pointCloud.setColorMode(parseInt(this.selectColormap.value, 10));
      }
    });

    // Point size slider
    this.sliderSize?.addEventListener("input", () => {
      if (!this.sliderSize) return;
      const size = parseFloat(this.sliderSize.value);
      if (this.pointSizeVal) {
        this.pointSizeVal.textContent = size.toFixed(1);
      }
      if (this.viewer.pointCloud) {
        this.viewer.pointCloud.setPointSize(size);
      }
    });

    // Background brightness slider
    this.sliderBg?.addEventListener("input", () => {
      if (!this.sliderBg) return;
      const val = parseFloat(this.sliderBg.value);
      this.viewer.setBackgroundBrightness(val / 100);
      if (this.bgBrightnessVal) {
        this.bgBrightnessVal.textContent = val < 25 ? `Dark (${Math.round(val)}%)` : val < 70 ? `Medium (${Math.round(val)}%)` : `Light (${Math.round(val)}%)`;
      }
    });

    // Voxel Downsampling Filter
    this.selectVoxelFilter?.addEventListener("change", () => {
      if (!this.selectVoxelFilter) return;
      const voxelSize = parseFloat(this.selectVoxelFilter.value);
      if (this.viewer.pointCloud) {
        if (this.sliderDecimation) this.sliderDecimation.value = "100";
        if (this.decimationVal) this.decimationVal.textContent = "100%";

        const activeCount = this.viewer.pointCloud.applyVoxelGrid(voxelSize);
        const total = this.viewer.pointCloud.data.count;
        const pct = Math.round((activeCount / total) * 100);
        if (this.voxelFilterVal) {
          this.voxelFilterVal.textContent = voxelSize > 0 ? `${voxelSize}m (${pct}%)` : "Off (100%)";
        }
        if (this.onFilterChangeCallback) {
          this.onFilterChangeCallback(activeCount, total, pct);
        }
      }
    });

    // Decimation Density Slider
    this.sliderDecimation?.addEventListener("input", () => {
      if (!this.sliderDecimation) return;
      const pctVal = parseInt(this.sliderDecimation.value, 10);
      const ratio = pctVal / 100;
      if (this.decimationVal) {
        this.decimationVal.textContent = `${pctVal}%`;
      }
      if (this.viewer.pointCloud) {
        if (this.selectVoxelFilter) this.selectVoxelFilter.value = "0";
        if (this.voxelFilterVal) this.voxelFilterVal.textContent = "Off (100%)";

        const activeCount = this.viewer.pointCloud.applyDecimation(ratio);
        const total = this.viewer.pointCloud.data.count;
        const pct = Math.round((activeCount / total) * 100);
        if (this.onFilterChangeCallback) {
          this.onFilterChangeCallback(activeCount, total, pct);
        }
      }
    });

    // Reference grid toggle
    this.toggleGrid?.addEventListener("change", () => {
      if (this.toggleGrid) {
        this.viewer.setGridVisible(this.toggleGrid.checked);
      }
    });

    // Full Orthographic toggle
    this.toggleOrtho?.addEventListener("change", () => {
      if (this.toggleOrtho) {
        this.setOrthoMode(this.toggleOrtho.checked);
      }
    });

    // Minified Orthographic toggle in Quick Toolbar
    this.miniToggleOrtho?.addEventListener("click", () => {
      this.setOrthoMode(!this.viewer.getOrthoMode());
    });

    // Camera preset buttons (Full sidebar)
    (this.element.querySelector("#btn-view-top") || document.getElementById("btn-view-top"))?.addEventListener("click", () => this.viewer.setCameraPreset("top"));
    (this.element.querySelector("#btn-view-front") || document.getElementById("btn-view-front"))?.addEventListener("click", () => this.viewer.setCameraPreset("front"));
    (this.element.querySelector("#btn-view-side") || document.getElementById("btn-view-side"))?.addEventListener("click", () => this.viewer.setCameraPreset("side"));
    (this.element.querySelector("#btn-view-reset") || document.getElementById("btn-view-reset"))?.addEventListener("click", () => this.viewer.setCameraPreset("iso"));

    // Camera preset buttons (Minified quick toolbar)
    this.miniCamIso?.addEventListener("click", () => this.viewer.setCameraPreset("iso"));
    this.miniCamTop?.addEventListener("click", () => this.viewer.setCameraPreset("top"));

    // Snapshot button (Both Full & Minified)
    this.btnSnapshot?.addEventListener("click", () => this.viewer.exportSnapshot());
    this.miniSnapshot?.addEventListener("click", () => this.viewer.exportSnapshot());

    // Export buttons
    (this.element.querySelector("#btn-export-ply") || document.getElementById("btn-export-ply"))?.addEventListener("click", () => {
      if (!this.viewer.pointCloud) return;
      const baseName = ((this.getFileNameCallback ? this.getFileNameCallback() : "") || "pointcloud").replace(/\.[^/.]+$/, "");
      const blob = ExportService.exportToPLY(this.viewer.pointCloud, true);
      ExportService.saveBlob(blob, `${baseName}-export.ply`);
    });

    (this.element.querySelector("#btn-export-xyz") || document.getElementById("btn-export-xyz"))?.addEventListener("click", () => {
      if (!this.viewer.pointCloud) return;
      const baseName = ((this.getFileNameCallback ? this.getFileNameCallback() : "") || "pointcloud").replace(/\.[^/.]+$/, "");
      const blob = ExportService.exportToXYZ(this.viewer.pointCloud, true);
      ExportService.saveBlob(blob, `${baseName}-export.xyz`);
    });

    // Import Point Budget Selector
    this.selectImportBudget?.addEventListener("change", () => {
      if (!this.selectImportBudget) return;
      const budget = parseInt(this.selectImportBudget.value, 10);
      if (this.importBudgetVal) {
        if (budget === 0) {
          this.importBudgetVal.textContent = "Unlimited";
        } else if (budget >= 1_000_000) {
          this.importBudgetVal.textContent = `${(budget / 1_000_000).toFixed(0)}M (60 FPS)`;
        } else {
          this.importBudgetVal.textContent = `${budget.toLocaleString()}`;
        }
      }
      if (this.onImportBudgetCallback) {
        this.onImportBudgetCallback(budget);
      }
    });
  }

  public static template(): string {
    return `
      <div id="render-settings-panel" class="render-settings-group">
        <!-- Eye-Dome Lighting (EDL) -->
        <div class="section-title">Shading &amp; Effects</div>
        <div class="control-row">
          <span>Eye-Dome Lighting (EDL)</span>
          <label class="switch">
            <input type="checkbox" id="toggle-edl" checked>
            <span class="slider-toggle"></span>
          </label>
        </div>

        <div class="control-group" id="edl-strength-group">
          <div class="control-row">
            <span>EDL Strength</span>
            <span id="edl-strength-val">1.4</span>
          </div>
          <input type="range" id="slider-edl" min="0.2" max="3.0" step="0.2" value="1.4">
        </div>

        <!-- Color Mode -->
        <div class="control-group">
          <div class="control-row">
            <span>Color Mode</span>
          </div>
          <select id="select-colormap">
            <option value="0">Sensor RGB / Colors</option>
            <option value="1">Elevation: Turbo</option>
            <option value="2">Elevation: Viridis</option>
            <option value="3">Elevation: Plasma</option>
            <option value="4">Elevation: Rainbow</option>
            <option value="5">Intensity / Grayscale</option>
          </select>
        </div>

        <div class="control-group">
          <div class="control-row">
            <span>Point Size</span>
            <span id="point-size-val">3.0</span>
          </div>
          <input type="range" id="slider-size" min="0.5" max="15" step="0.5" value="3.0">
        </div>

        <div class="control-group">
          <div class="control-row">
            <span>Background</span>
            <span id="bg-brightness-val">Dark (7%)</span>
          </div>
          <input type="range" id="slider-bg" min="0" max="100" step="1" value="7">
        </div>

        <!-- Downsampling & Filter -->
        <div class="section-title">Streaming &amp; Density</div>
        <div class="control-group">
          <div class="control-row">
            <span>Import Point Budget</span>
            <span id="import-budget-val">5M (60 FPS)</span>
          </div>
          <select id="select-import-budget">
            <option value="2000000">2M Pts (Fastest / Mobile)</option>
            <option value="5000000" selected>5M Pts (Recommended 60 FPS)</option>
            <option value="10000000">10M Pts (High Density)</option>
            <option value="20000000">20M Pts (Ultra / High VRAM)</option>
            <option value="0">Unlimited (Full Resolution)</option>
          </select>
        </div>

        <div class="control-group">
          <div class="control-row">
            <span>Voxel Downsampling</span>
            <span id="voxel-filter-val">Off (100%)</span>
          </div>
          <select id="select-voxel-filter">
            <option value="0">Off (Full 100% Cloud)</option>
            <option value="0.5">0.5m Voxel Grid</option>
            <option value="1.0">1.0m Voxel Grid</option>
            <option value="2.0">2.0m Voxel Grid</option>
            <option value="5.0">5.0m Voxel Grid</option>
            <option value="10.0">10.0m Voxel Grid</option>
          </select>
        </div>

        <div class="control-group">
          <div class="control-row">
            <span>Decimation Density</span>
            <span id="decimation-val">100%</span>
          </div>
          <input type="range" id="slider-decimation" min="5" max="100" step="5" value="100">
        </div>

        <!-- Camera & Projection -->
        <div class="section-title">Camera &amp; View</div>
        <div class="button-grid">
          <button id="btn-view-top" class="btn btn-secondary">Top</button>
          <button id="btn-view-front" class="btn btn-secondary">Front</button>
          <button id="btn-view-side" class="btn btn-secondary">Side</button>
          <button id="btn-view-reset" class="btn btn-secondary">Iso</button>
        </div>

        <div class="control-row">
          <span>Orthographic Mode</span>
          <label class="switch">
            <input type="checkbox" id="toggle-ortho">
            <span class="slider-toggle"></span>
          </label>
        </div>

        <div class="control-row">
          <span>Reference Grid</span>
          <label class="switch">
            <input type="checkbox" id="toggle-grid" checked>
            <span class="slider-toggle"></span>
          </label>
        </div>

        <!-- Export Point Cloud -->
        <div class="section-title">Export Point Cloud</div>
        <div class="button-grid">
          <button id="btn-export-ply" class="btn btn-secondary" title="Export active/filtered points as PLY format">💾 PLY</button>
          <button id="btn-export-xyz" class="btn btn-secondary" title="Export active/filtered points as XYZ format">📄 XYZ</button>
        </div>
      </div>
    `;
  }
}
