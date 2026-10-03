import { describe, it, expect, beforeEach, vi } from "vitest";
import { DatasetSelector } from "../../src/ui/components/DatasetSelector";
import { MeasurementHud } from "../../src/ui/components/MeasurementHud";
import { InspectorTooltip } from "../../src/ui/components/InspectorTooltip";
import { ProfileChart } from "../../src/ui/components/ProfileChart";
import { ToolBar } from "../../src/ui/components/ToolBar";
import { RenderSettingsPanel } from "../../src/ui/components/RenderSettingsPanel";
import { StatusView } from "../../src/ui/components/StatusView";
import { FileDropZone } from "../../src/ui/components/FileDropZone";
import { QuickToolbar } from "../../src/ui/components/QuickToolbar";
import { UIManager } from "../../src/ui/UIManager";

describe("UI Components Modular Dual-View Unit Tests", () => {
  describe("DatasetSelector", () => {
    beforeEach(() => {
      document.body.innerHTML = `
        <select id="select-dataset">
          <optgroup id="group-imported" label="Imported">
            <option id="opt-no-imported" value="" disabled>No imported files</option>
          </optgroup>
          <optgroup id="group-samples" label="Samples">
            <option value="mountain-lidar">Mountain</option>
          </optgroup>
        </select>
      `;
    });

    it("initializes and allows setting and getting dataset value", () => {
      const selector = new DatasetSelector();
      selector.setValue("mountain-lidar");
      expect(selector.getValue()).toBe("mountain-lidar");
    });

    it("adds imported dataset into imported optgroup and selects it", () => {
      const selector = new DatasetSelector();
      selector.addImportedDataset("imported-test_las", "test.las");

      expect(document.getElementById("opt-no-imported")).toBeNull();
      const option = document.querySelector('option[value="imported-test_las"]') as HTMLOptionElement;
      expect(option).not.toBeNull();
      expect(option.textContent).toBe("test.las");
      expect(selector.getValue()).toBe("imported-test_las");
    });

    it("triggers onSelect callback when selection changes", () => {
      const selector = new DatasetSelector();
      const cb = vi.fn();
      selector.onSelect(cb);

      const select = document.getElementById("select-dataset") as HTMLSelectElement;
      select.value = "mountain-lidar";
      select.dispatchEvent(new Event("change"));

      expect(cb).toHaveBeenCalledWith("mountain-lidar");
    });
  });

  describe("MeasurementHud", () => {
    beforeEach(() => {
      document.body.innerHTML = `
        <div id="measure-box" style="display: none;">
          <span id="measure-3d"></span>
          <span id="measure-h"></span>
          <span id="measure-z"></span>
          <button id="btn-clear-measure"></button>
        </div>
      `;
    });

    it("shows and displays distance readouts when measurement is completed", () => {
      const hud = new MeasurementHud();
      hud.update({
        state: "completed",
        distance3D: 12.345,
        horizontalDistance: 10.0,
        verticalDistance: 5.5
      });

      const box = document.getElementById("measure-box")!;
      expect(box.style.display).toBe("flex");
      expect(document.getElementById("measure-3d")!.textContent).toBe("12.35 m");
      expect(document.getElementById("measure-h")!.textContent).toBe("10.00 m");
      expect(document.getElementById("measure-z")!.textContent).toBe("5.50 m");
    });

    it("resets readouts and fires callback on clear button click", () => {
      const hud = new MeasurementHud();
      const onClear = vi.fn();
      hud.onClear(onClear);

      const btnClear = document.getElementById("btn-clear-measure") as HTMLButtonElement;
      btnClear.click();

      expect(document.getElementById("measure-3d")!.textContent).toContain("Click first point");
      expect(onClear).toHaveBeenCalled();
    });
  });

  describe("InspectorTooltip", () => {
    beforeEach(() => {
      document.body.innerHTML = `<div id="inspector-tooltip" style="display: none;"></div>`;
    });

    it("displays point coordinates at screen position", () => {
      const tooltip = new InspectorTooltip();
      tooltip.show({
        realX: 100.123,
        realNorthing: 200.456,
        realElevation: 50.789,
        screenX: 150,
        screenY: 250,
        index: 1
      });

      const el = document.getElementById("inspector-tooltip")!;
      expect(el.style.display).toBe("block");
      expect(el.style.left).toBe("164px");
      expect(el.style.top).toBe("264px");
      expect(el.textContent).toContain("100.123");
      expect(el.textContent).toContain("200.456");
      expect(el.textContent).toContain("50.789");
    });

    it("hides correctly", () => {
      const tooltip = new InspectorTooltip();
      tooltip.hide();
      expect(document.getElementById("inspector-tooltip")!.style.display).toBe("none");
    });
  });

  describe("ProfileChart", () => {
    beforeEach(() => {
      document.body.innerHTML = `
        <div id="profile-panel" style="display: none;">
          <canvas id="profile-canvas"></canvas>
          <div id="profile-stats"></div>
          <button id="btn-close-profile"></button>
        </div>
      `;
    });

    it("shows and updates stats when render is called", () => {
      const chart = new ProfileChart();
      const mockCanvas = document.getElementById("profile-canvas") as HTMLCanvasElement;
      mockCanvas.getContext = vi.fn().mockReturnValue({
        scale: vi.fn(),
        clearRect: vi.fn(),
        beginPath: vi.fn(),
        moveTo: vi.fn(),
        lineTo: vi.fn(),
        stroke: vi.fn(),
        fillText: vi.fn(),
        createLinearGradient: vi.fn().mockReturnValue({ addColorStop: vi.fn() }),
        closePath: vi.fn(),
        fill: vi.fn()
      } as any);

      chart.render({
        points: [
          { distance: 0, originalElevation: 10, pointIndex: 0 },
          { distance: 50, originalElevation: 25, pointIndex: 1 }
        ],
        totalDistance: 50,
        minElevation: 10,
        maxElevation: 25
      });

      const panel = document.getElementById("profile-panel")!;
      expect(panel.style.display).toBe("flex");
      const stats = document.getElementById("profile-stats")!;
      expect(stats.textContent).toContain("Len: 50.0m");
      expect(stats.textContent).toContain("Elev: 10.0m – 25.0m");
    });

    it("fires onClose callback when close button is clicked", () => {
      const chart = new ProfileChart();
      const onClose = vi.fn();
      chart.onClose(onClose);

      const btn = document.getElementById("btn-close-profile") as HTMLButtonElement;
      btn.click();

      expect(document.getElementById("profile-panel")!.style.display).toBe("none");
      expect(onClose).toHaveBeenCalled();
    });
  });

  describe("ToolBar Dual-View (Full tabs & Minified quick icons)", () => {
    let mockViewer: any;
    let mockToolManager: any;

    beforeEach(() => {
      document.body.innerHTML = `
        <!-- Full sidebar buttons -->
        <button id="tool-orbit" class="tool-btn"></button>
        <button id="tool-measure" class="tool-btn"></button>
        <button id="tool-profile" class="tool-btn"></button>
        <button id="tool-inspect" class="tool-btn"></button>
        <button id="tool-fly" class="tool-btn"></button>
        <div id="fly-hint" style="display: none;"></div>
        <div class="control-row">
          <input type="checkbox" id="toggle-ortho" />
        </div>

        <!-- Minified quick toolbar buttons -->
        <button id="quick-tool-orbit" class="quick-btn"></button>
        <button id="quick-tool-measure" class="quick-btn"></button>
        <button id="quick-tool-profile" class="quick-btn"></button>
        <button id="quick-tool-inspect" class="quick-btn"></button>
        <button id="quick-tool-fly" class="quick-btn"></button>
      `;

      mockViewer = {
        getOrthoMode: vi.fn().mockReturnValue(false),
        setOrthoMode: vi.fn(),
        firstPersonControls: {
          onSpeedChange: vi.fn(),
          getSpeed: vi.fn().mockReturnValue(50)
        }
      };

      mockToolManager = {
        setMode: vi.fn()
      };
    });

    it("syncs active class across both full and minified buttons when mode changes", () => {
      const toolbar = new ToolBar(mockViewer, mockToolManager);
      toolbar.setMode("measure");

      expect(mockToolManager.setMode).toHaveBeenCalledWith("measure");
      expect(document.getElementById("tool-measure")!.classList.contains("active")).toBe(true);
      expect(document.getElementById("quick-tool-measure")!.classList.contains("active")).toBe(true);
      expect(document.getElementById("tool-orbit")!.classList.contains("active")).toBe(false);
      expect(document.getElementById("quick-tool-orbit")!.classList.contains("active")).toBe(false);
    });

    it("switches mode when minified quick toolbar button is clicked", () => {
      const toolbar = new ToolBar(mockViewer, mockToolManager);
      const btnMiniProfile = document.getElementById("quick-tool-profile") as HTMLButtonElement;
      btnMiniProfile.click();

      expect(mockToolManager.setMode).toHaveBeenCalledWith("profile");
      expect(document.getElementById("tool-profile")!.classList.contains("active")).toBe(true);
      expect(document.getElementById("quick-tool-profile")!.classList.contains("active")).toBe(true);
    });
  });

  describe("RenderSettingsPanel Dual-View", () => {
    let mockViewer: any;

    beforeEach(() => {
      document.body.innerHTML = `
        <!-- Full sidebar controls -->
        <input type="checkbox" id="toggle-edl" checked />
        <input type="range" id="slider-edl" value="1.4" />
        <span id="edl-strength-val">1.4</span>
        <div id="edl-strength-group" style="display: flex;"></div>
        <select id="select-colormap"><option value="1">Turbo</option></select>
        <input type="range" id="slider-size" value="3.0" />
        <span id="point-size-val">3.0</span>
        <input type="range" id="slider-bg" value="7" />
        <span id="bg-brightness-val">Dark (7%)</span>
        <select id="select-voxel-filter"><option value="0">Off</option></select>
        <span id="voxel-filter-val">Off</span>
        <input type="range" id="slider-decimation" value="100" />
        <span id="decimation-val">100%</span>
        <input type="checkbox" id="toggle-grid" checked />
        <input type="checkbox" id="toggle-ortho" />
        <button id="btn-snapshot"></button>
        <button id="btn-view-top"></button>
        <button id="btn-view-reset"></button>

        <!-- Minified quick toolbar controls -->
        <button id="quick-toggle-edl" class="quick-btn active"></button>
        <button id="quick-toggle-ortho" class="quick-btn"></button>
        <button id="quick-cam-iso" class="quick-btn"></button>
        <button id="quick-cam-top" class="quick-btn"></button>
        <button id="quick-action-snapshot" class="quick-btn"></button>
      `;

      mockViewer = {
        setEDLEnabled: vi.fn(),
        setEDLStrength: vi.fn(),
        getOrthoMode: vi.fn().mockReturnValue(false),
        setOrthoMode: vi.fn(),
        setCameraPreset: vi.fn(),
        exportSnapshot: vi.fn(),
        edlPass: { enabled: true }
      };
    });

    it("syncs EDL state between minified button and full checkbox", () => {
      const panel = new RenderSettingsPanel(mockViewer);
      const miniEdl = document.getElementById("quick-toggle-edl") as HTMLButtonElement;
      const fullEdl = document.getElementById("toggle-edl") as HTMLInputElement;

      // Click minified EDL toggle to turn OFF
      miniEdl.click();

      expect(mockViewer.setEDLEnabled).toHaveBeenCalledWith(false);
      expect(fullEdl.checked).toBe(false);
      expect(miniEdl.classList.contains("active")).toBe(false);
      expect(document.getElementById("edl-strength-group")!.style.display).toBe("none");
    });

    it("triggers snapshot and camera presets from minified buttons", () => {
      new RenderSettingsPanel(mockViewer);

      const miniIso = document.getElementById("quick-cam-iso") as HTMLButtonElement;
      miniIso.click();
      expect(mockViewer.setCameraPreset).toHaveBeenCalledWith("iso");

      const miniSnapshot = document.getElementById("quick-action-snapshot") as HTMLButtonElement;
      miniSnapshot.click();
      expect(mockViewer.exportSnapshot).toHaveBeenCalled();
    });
  });

  describe("FileDropZone Dual-View", () => {
    beforeEach(() => {
      document.body.innerHTML = `
        <button id="btn-open"></button>
        <button id="quick-action-open"></button>
        <div id="drop-overlay"></div>
      `;
    });

    it("initializes without throwing", () => {
      const dropZone = new FileDropZone();
      expect(dropZone).toBeDefined();
    });
  });

  describe("StatusView Dual-View (Full status labels & Minified Info Pill)", () => {
    beforeEach(() => {
      document.body.innerHTML = `
        <span id="lbl-file"></span>
        <span id="lbl-points"></span>
        <span id="lbl-bounds"></span>
        <div id="progress-container" style="display: none;"><div id="progress-bar"></div></div>
        <span id="quick-info-file"></span>
        <span id="quick-info-pts"></span>
      `;
    });

    it("updates both full multi-line labels and minified info pill", () => {
      const statusView = new StatusView();
      statusView.updateStatus("models/norway_cliff.las", "1,500,000 points", "Extents: 100m x 200m");

      expect(document.getElementById("lbl-file")!.textContent).toBe("models/norway_cliff.las");
      expect(document.getElementById("lbl-points")!.textContent).toBe("1,500,000 points");
      expect(document.getElementById("lbl-bounds")!.textContent).toBe("Extents: 100m x 200m");

      expect(document.getElementById("quick-info-file")!.textContent).toBe("norway_cliff.las");
      expect(document.getElementById("quick-info-pts")!.textContent).toBe("1,500,000 pts");
    });
  });

  describe("QuickToolbar Pure Dock Container", () => {
    beforeEach(() => {
      document.body.innerHTML = `
        <div id="quick-toolbar" style="display: none;">
          <button id="btn-floating-menu"></button>
        </div>
      `;
    });

    it("shows, hides, and handles expand button click", () => {
      const qtb = new QuickToolbar();
      const container = document.getElementById("quick-toolbar")!;
      const onExpand = vi.fn();
      qtb.onExpand(onExpand);

      qtb.show();
      expect(container.style.display).toBe("flex");

      const btnMenu = document.getElementById("btn-floating-menu") as HTMLButtonElement;
      btnMenu.click();
      expect(onExpand).toHaveBeenCalled();

      qtb.hide();
      expect(container.style.display).toBe("none");
    });
  });

  describe("Dynamic Self-Rendering into completely empty DOM", () => {
    it("mounts all components and panel into an empty document.body without any fixture", () => {
      document.body.innerHTML = '<div id="app"></div>';

      const mockViewer: any = {
        getOrthoMode: vi.fn().mockReturnValue(false),
        setOrthoMode: vi.fn(),
        setCameraPreset: vi.fn(),
        setEDLEnabled: vi.fn(),
        exportSnapshot: vi.fn(),
        edlPass: { enabled: true },
        firstPersonControls: { onSpeedChange: vi.fn(), getSpeed: vi.fn().mockReturnValue(10) }
      };

      const mockToolManager: any = {
        getMode: vi.fn().mockReturnValue("orbit"),
        setMode: vi.fn(),
        measurementTool: { resetToIdle: vi.fn(), onMeasurement: vi.fn() },
        profileTool: { clear: vi.fn(), onProfile: vi.fn() },
        inspectorTool: { onInspect: vi.fn() }
      };

      const uim = new UIManager(mockViewer, mockToolManager);

      // Verify all elements are created and mounted into DOM
      expect(document.getElementById("ui-panel")).not.toBeNull();
      expect(document.getElementById("quick-toolbar")).not.toBeNull();
      expect(document.getElementById("select-dataset")).not.toBeNull();
      expect(document.getElementById("tool-orbit")).not.toBeNull();
      expect(document.getElementById("measure-box")).not.toBeNull();
      expect(document.getElementById("profile-panel")).not.toBeNull();
      expect(document.getElementById("inspector-tooltip")).not.toBeNull();
      expect(document.getElementById("drop-overlay")).not.toBeNull();
      expect(document.getElementById("fly-hint")).not.toBeNull();
    });
  });
});
