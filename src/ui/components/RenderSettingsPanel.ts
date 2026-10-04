import { Viewer } from "../../core/Viewer";
import { ColorMode, CameraPreset, AxisOrientation } from "../../types";
import { ExportService } from "../../services/ExportService";
import { createElement } from "../utils/dom";
import { AppEvents } from "../../core/AppEvents";

export class RenderSettingsPanel {
  public readonly element: HTMLElement;
  private viewer: Viewer;

  // Full view DOM elements (sidebar panel)
  private toggleEDL: HTMLInputElement | null;
  private sliderEDL: HTMLInputElement | null;
  private edlStrengthVal: HTMLElement | null;
  private edlStrengthGroup: HTMLElement | null;

  private selectColormap: HTMLSelectElement | null;
  private selectPointShape: HTMLSelectElement | null;
  private sliderSize: HTMLInputElement | null;
  private pointSizeVal: HTMLElement | null;
  private sliderBg: HTMLInputElement | null;
  private bgBrightnessVal: HTMLElement | null;

  private selectVoxelFilter: HTMLSelectElement | null;
  private voxelFilterVal: HTMLElement | null;
  private sliderDecimation: HTMLInputElement | null;
  private decimationVal: HTMLElement | null;

  private classificationSection: HTMLElement | null;
  private classificationList: HTMLElement | null;

  private toggleGrid: HTMLInputElement | null;
  private toggleOrtho: HTMLInputElement | null;
  private btnSnapshot: HTMLButtonElement | null;

  private toggleFlipX: HTMLInputElement | null;
  private toggleFlipY: HTMLInputElement | null;
  private toggleFlipZ: HTMLInputElement | null;
  private toggleSwapXY: HTMLInputElement | null;
  private toggleSwapXZ: HTMLInputElement | null;
  private btnResetAxes: HTMLButtonElement | null;

  private selectImportBudget: HTMLSelectElement | null;
  private importBudgetVal: HTMLElement | null;

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

    const find = <T extends HTMLElement>(selector: string): T | null => {
      return (this.element.querySelector(selector) || document.querySelector(selector)) as T | null;
    };

    this.toggleEDL = find<HTMLInputElement>("#toggle-edl");
    this.sliderEDL = find<HTMLInputElement>("#slider-edl");
    this.edlStrengthVal = find<HTMLElement>("#edl-strength-val");
    this.edlStrengthGroup = find<HTMLElement>("#edl-strength-group");

    this.selectColormap = find<HTMLSelectElement>("#select-colormap");
    this.selectPointShape = find<HTMLSelectElement>("#select-point-shape");
    this.sliderSize = find<HTMLInputElement>("#slider-size");
    this.pointSizeVal = find<HTMLElement>("#point-size-val");
    this.sliderBg = find<HTMLInputElement>("#slider-bg");
    this.bgBrightnessVal = find<HTMLElement>("#bg-brightness-val");

    this.selectVoxelFilter = find<HTMLSelectElement>("#select-voxel-filter");
    this.voxelFilterVal = find<HTMLElement>("#voxel-filter-val");
    this.sliderDecimation = find<HTMLInputElement>("#slider-decimation");
    this.decimationVal = find<HTMLElement>("#decimation-val");

    this.classificationSection = find<HTMLElement>("#classification-section");
    this.classificationList = find<HTMLElement>("#classification-list");

    this.toggleGrid = find<HTMLInputElement>("#toggle-grid");
    this.toggleOrtho = find<HTMLInputElement>("#toggle-ortho");
    this.btnSnapshot = find<HTMLButtonElement>("#btn-snapshot");

    this.toggleFlipX = find<HTMLInputElement>("#toggle-flip-x");
    this.toggleFlipY = find<HTMLInputElement>("#toggle-flip-y");
    this.toggleFlipZ = find<HTMLInputElement>("#toggle-flip-z");
    this.toggleSwapXY = find<HTMLInputElement>("#toggle-swap-xy");
    this.toggleSwapXZ = find<HTMLInputElement>("#toggle-swap-xz");
    this.btnResetAxes = find<HTMLButtonElement>("#btn-reset-axes");

    this.selectImportBudget = find<HTMLSelectElement>("#select-import-budget");
    this.importBudgetVal = find<HTMLElement>("#import-budget-val");

    this.bindEvents();
  }

  public getImportBudget(): number {
    return this.selectImportBudget ? parseInt(this.selectImportBudget.value, 10) : 5_000_000;
  }

  public getPointSize(): number {
    return this.sliderSize ? parseFloat(this.sliderSize.value) || 3.0 : 3.0;
  }

  public getPointShape(): number {
    return this.selectPointShape ? parseInt(this.selectPointShape.value, 10) || 0 : 0;
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
    AppEvents.emit("ui:edl-toggled", enabled);
  }

  public setOrthoMode(useOrtho: boolean): void {
    this.viewer.setOrthoMode(useOrtho);
    if (this.toggleOrtho) this.toggleOrtho.checked = useOrtho;
    AppEvents.emit("ui:ortho-toggled", useOrtho);
  }

  private bindEvents(): void {
    AppEvents.on("ui:colormap-changed", (mode: ColorMode) => {
      this.setColormapValue(mode);
    });

    AppEvents.on("action:toggle-edl", () => {
      this.setEDLEnabled(!this.viewer.edlPass.enabled);
    });
    
    AppEvents.on("action:toggle-ortho", () => {
      this.setOrthoMode(!this.viewer.getOrthoMode());
    });

    AppEvents.on("action:camera-preset", (preset: CameraPreset) => {
      this.viewer.setCameraPreset(preset);
    });

    AppEvents.on("action:snapshot", () => {
      this.viewer.exportSnapshot();
    });

    this.toggleEDL?.addEventListener("change", () => {
      this.setEDLEnabled(!!this.toggleEDL?.checked);
    });

    this.sliderEDL?.addEventListener("input", () => {
      if (!this.sliderEDL) return;
      const val = parseFloat(this.sliderEDL.value);
      if (this.edlStrengthVal) {
        this.edlStrengthVal.textContent = val.toFixed(1);
      }
      this.viewer.setEDLStrength(val);
    });

    this.selectColormap?.addEventListener("change", () => {
      if (this.viewer.pointCloud && this.selectColormap) {
        this.viewer.pointCloud.setColorMode(parseInt(this.selectColormap.value, 10));
      }
    });

    this.selectPointShape?.addEventListener("change", () => {
      if (!this.selectPointShape) return;
      const shape = parseInt(this.selectPointShape.value, 10);
      this.viewer.setPointShape(shape);
    });

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

    AppEvents.on("ui:cloud-loaded", () => {
      this.updateClassificationsUI();
    });

    this.sliderBg?.addEventListener("input", () => {
      if (!this.sliderBg) return;
      const val = parseFloat(this.sliderBg.value);
      this.viewer.setBackgroundBrightness(val / 100);
      if (this.bgBrightnessVal) {
        this.bgBrightnessVal.textContent = val < 25 ? `Dark (${Math.round(val)}%)` : val < 70 ? `Medium (${Math.round(val)}%)` : `Light (${Math.round(val)}%)`;
      }
    });

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
        AppEvents.emit("ui:filter-change", activeCount, total, pct);
      }
    });

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
        AppEvents.emit("ui:filter-change", activeCount, total, pct);
      }
    });

    this.toggleGrid?.addEventListener("change", () => {
      if (this.toggleGrid) {
        this.viewer.setGridVisible(this.toggleGrid.checked);
      }
    });

    this.toggleOrtho?.addEventListener("change", () => {
      if (this.toggleOrtho) {
        this.setOrthoMode(this.toggleOrtho.checked);
      }
    });

    (this.element.querySelector("#btn-view-top") || document.getElementById("btn-view-top"))?.addEventListener("click", () => this.viewer.setCameraPreset("top"));
    (this.element.querySelector("#btn-view-front") || document.getElementById("btn-view-front"))?.addEventListener("click", () => this.viewer.setCameraPreset("front"));
    (this.element.querySelector("#btn-view-side") || document.getElementById("btn-view-side"))?.addEventListener("click", () => this.viewer.setCameraPreset("side"));
    (this.element.querySelector("#btn-view-reset") || document.getElementById("btn-view-reset"))?.addEventListener("click", () => this.viewer.setCameraPreset("iso"));

    this.btnSnapshot?.addEventListener("click", () => this.viewer.exportSnapshot());

    // Export buttons
    (this.element.querySelector("#btn-export-ply") || document.getElementById("btn-export-ply"))?.addEventListener("click", () => {
      if (!this.viewer.pointCloud) return;
      let fileName = "pointcloud";
      AppEvents.emit("action:request-filename", (name: string) => { fileName = name; });
      const baseName = fileName.replace(/\.[^/.]+$/, "");
      const blob = ExportService.exportToPLY(this.viewer.pointCloud, true);
      ExportService.saveBlob(blob, `${baseName}-export.ply`);
    });

    (this.element.querySelector("#btn-export-xyz") || document.getElementById("btn-export-xyz"))?.addEventListener("click", () => {
      if (!this.viewer.pointCloud) return;
      let fileName = "pointcloud";
      AppEvents.emit("action:request-filename", (name: string) => { fileName = name; });
      const baseName = fileName.replace(/\.[^/.]+$/, "");
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
      AppEvents.emit("ui:import-budget-changed", budget);
    });

    // Coordinate Axes Flips and Swaps (Debug)
    const updateAxes = () => {
      this.viewer.setAxisOrientation({
        flipX: !!this.toggleFlipX?.checked,
        flipY: !!this.toggleFlipY?.checked,
        flipZ: !!this.toggleFlipZ?.checked,
        swapXY: !!this.toggleSwapXY?.checked,
        swapXZ: !!this.toggleSwapXZ?.checked
      });
    };

    this.toggleFlipX?.addEventListener("change", updateAxes);
    this.toggleFlipY?.addEventListener("change", updateAxes);
    this.toggleFlipZ?.addEventListener("change", updateAxes);
    this.toggleSwapXY?.addEventListener("change", updateAxes);
    this.toggleSwapXZ?.addEventListener("change", updateAxes);

    this.btnResetAxes?.addEventListener("click", () => {
      if (this.toggleFlipX) this.toggleFlipX.checked = false;
      if (this.toggleFlipY) this.toggleFlipY.checked = false;
      if (this.toggleFlipZ) this.toggleFlipZ.checked = false;
      if (this.toggleSwapXY) this.toggleSwapXY.checked = false;
      if (this.toggleSwapXZ) this.toggleSwapXZ.checked = false;
      this.viewer.setAxisOrientation({
        flipX: false,
        flipY: false,
        flipZ: false,
        swapXY: false,
        swapXZ: false
      });
    });

    AppEvents.on("action:set-axis-flips", (flips: Partial<AxisOrientation>) => {
      if (flips.flipX !== undefined && this.toggleFlipX) this.toggleFlipX.checked = flips.flipX;
      if (flips.flipY !== undefined && this.toggleFlipY) this.toggleFlipY.checked = flips.flipY;
      if (flips.flipZ !== undefined && this.toggleFlipZ) this.toggleFlipZ.checked = flips.flipZ;
      if (flips.swapXY !== undefined && this.toggleSwapXY) this.toggleSwapXY.checked = flips.swapXY;
      if (flips.swapXZ !== undefined && this.toggleSwapXZ) this.toggleSwapXZ.checked = flips.swapXZ;
      this.viewer.setAxisOrientation(flips);
    });
  }

  private updateClassificationsUI(): void {
    if (!this.classificationSection || !this.classificationList) return;
    const pc = this.viewer.pointCloud;
    if (!pc || !pc.hasClassifications()) {
      this.classificationSection.style.display = "none";
      return;
    }

    const available = pc.getAvailableClassifications();
    if (available.length === 0) {
      this.classificationSection.style.display = "none";
      return;
    }

    this.classificationSection.style.display = "block";
    this.classificationList.innerHTML = "";

    const classNames: Record<number, string> = {
      0: "0: Created / Never Classified",
      1: "1: Unclassified",
      2: "2: Ground Terrain",
      3: "3: Low Vegetation",
      4: "4: Medium Vegetation",
      5: "5: High Vegetation (Canopy)",
      6: "6: Buildings / Structures",
      7: "7: Low Point (Noise)",
      9: "9: Water",
      12: "12: Overlap Points"
    };

    available.forEach(c => {
      const row = document.createElement("div");
      row.className = "control-row";
      row.style.fontSize = "12px";
      row.style.margin = "4px 0";

      const label = document.createElement("span");
      label.textContent = classNames[c] || `Class ${c}`;

      const switchLabel = document.createElement("label");
      switchLabel.className = "switch";

      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.checked = pc.isClassificationEnabled(c);

      const sliderSpan = document.createElement("span");
      sliderSpan.className = "slider-toggle";

      switchLabel.appendChild(checkbox);
      switchLabel.appendChild(sliderSpan);
      row.appendChild(label);
      row.appendChild(switchLabel);
      this.classificationList!.appendChild(row);

      checkbox.addEventListener("change", () => {
        const currentClasses = new Set<number>();
        const inputs = this.classificationList!.querySelectorAll("input[type=checkbox]");
        inputs.forEach((inp, idx) => {
          if ((inp as HTMLInputElement).checked) {
            currentClasses.add(available[idx]);
          }
        });
        const activeCount = pc.setClassificationFilter(currentClasses);
        const total = pc.data.count;
        const pct = Math.round((activeCount / total) * 100);
        AppEvents.emit("ui:filter-change", activeCount, total, pct);
      });
    });
  }

  public static template(): string {
    return `
      <div id="render-settings-panel" class="render-settings-group">
        <!-- Eye-Dome Lighting (EDL) -->
        <div class="section-title">Shading &amp; Effects</div>
        <div class="control-row">
          <span>Eye-Dome Lighting (EDL + AO)</span>
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

        <!-- Point Shape / Splatting -->
        <div class="control-group">
          <div class="control-row">
            <span>Point Geometry (Splatting)</span>
          </div>
          <select id="select-point-shape">
            <option value="0" selected>Circular Disks (Surfels)</option>
            <option value="1">Square Pixels</option>
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

        <!-- LAS Point Classification Filtering -->
        <div id="classification-section" style="display: none;">
          <div class="section-title">Point Classifications (ASPRS)</div>
          <div id="classification-list" class="control-group"></div>
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

        <!-- Coordinate Axes & Orientation (Debug) -->
        <div class="section-title">Coordinate Axes (Debug)</div>
        <div class="control-row">
          <span>Flip X Axis</span>
          <label class="switch">
            <input type="checkbox" id="toggle-flip-x">
            <span class="slider-toggle"></span>
          </label>
        </div>
        <div class="control-row">
          <span>Flip Y Axis</span>
          <label class="switch">
            <input type="checkbox" id="toggle-flip-y">
            <span class="slider-toggle"></span>
          </label>
        </div>
        <div class="control-row">
          <span>Flip Z Axis</span>
          <label class="switch">
            <input type="checkbox" id="toggle-flip-z">
            <span class="slider-toggle"></span>
          </label>
        </div>
        <div class="control-row">
          <span>Swap X ↔ Y</span>
          <label class="switch">
            <input type="checkbox" id="toggle-swap-xy">
            <span class="slider-toggle"></span>
          </label>
        </div>
        <div class="control-row">
          <span>Swap X ↔ Z (Easting ↔ Northing)</span>
          <label class="switch">
            <input type="checkbox" id="toggle-swap-xz">
            <span class="slider-toggle"></span>
          </label>
        </div>
        <div class="button-grid" style="margin-top: 6px;">
          <button id="btn-reset-axes" class="btn btn-secondary" style="grid-column: span 2;">↺ Reset Axes</button>
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
