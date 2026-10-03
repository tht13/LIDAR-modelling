import { Viewer } from "../core/Viewer";
import { ToolManager } from "../tools/ToolManager";
import { ColorMode, ToolMode, MeasureResult, InspectedPoint } from "../types";
import { ProfileData } from "../tools/ProfileTool";
import { ProfileChart } from "./components/ProfileChart";
import { MeasurementHud } from "./components/MeasurementHud";
import { InspectorTooltip } from "./components/InspectorTooltip";
import { DatasetSelector } from "./components/DatasetSelector";
import { ToolBar } from "./components/ToolBar";
import { RenderSettingsPanel } from "./components/RenderSettingsPanel";
import { FileDropZone } from "./components/FileDropZone";
import { StatusView } from "./components/StatusView";
import { QuickToolbar } from "./components/QuickToolbar";
import { createElement } from "./utils/dom";
import { AppEvents } from "../core/AppEvents";

export class UIManager {
  private viewer: Viewer;
  private toolManager: ToolManager;

  // Sub-components
  public readonly profileChart: ProfileChart;
  public readonly measurementHud: MeasurementHud;
  public readonly inspectorTooltip: InspectorTooltip;
  public readonly datasetSelector: DatasetSelector;
  public readonly toolBar: ToolBar;
  public readonly renderSettingsPanel: RenderSettingsPanel;
  public readonly fileDropZone: FileDropZone;
  public readonly statusView: StatusView;
  public readonly quickToolbar: QuickToolbar;

  // DOM Elements for Panel & Shell
  public readonly uiPanel: HTMLElement;
  private btnFloatingMenu: HTMLButtonElement | null;
  private btnMinimizeMenu: HTMLButtonElement | null;

  constructor(viewer: Viewer, toolManager: ToolManager, container?: HTMLElement) {
    this.viewer = viewer;
    this.toolManager = toolManager;

    const mountRoot = container || document.getElementById("app") || document.body;

    // 1. Create quickToolbar and mount its element to DOM so its minified buttons exist
    this.quickToolbar = new QuickToolbar();
    if (!document.getElementById("quick-toolbar")) {
      mountRoot.appendChild(this.quickToolbar.element);
    }

    // 2. Check if #ui-panel already exists in DOM (legacy / test fixture) or needs to be rendered
    let panelEl = document.getElementById("ui-panel");
    const isDynamic = !panelEl;

    if (!panelEl) {
      panelEl = createElement<HTMLElement>(UIManager.panelTemplate());
      mountRoot.appendChild(panelEl);
    }
    this.uiPanel = panelEl;

    // 3. Initialize Sub-components (both full and minified buttons now exist in DOM)
    this.datasetSelector = new DatasetSelector();
    this.toolBar = new ToolBar(this.viewer, this.toolManager);
    this.renderSettingsPanel = new RenderSettingsPanel(this.viewer);
    this.statusView = new StatusView();
    this.profileChart = new ProfileChart();
    this.measurementHud = new MeasurementHud();
    this.inspectorTooltip = new InspectorTooltip();
    this.fileDropZone = new FileDropZone();

    // 4. Assemble children into uiPanel and mountRoot if dynamic
    if (isDynamic) {
      this.uiPanel.appendChild(this.datasetSelector.element);
      this.uiPanel.appendChild(this.toolBar.element);
      this.uiPanel.appendChild(this.renderSettingsPanel.element);
      this.uiPanel.appendChild(this.statusView.element);

      mountRoot.appendChild(this.toolBar.flyHintElement);
      mountRoot.appendChild(this.measurementHud.element);
      mountRoot.appendChild(this.profileChart.element);
      mountRoot.appendChild(this.inspectorTooltip.element);
      mountRoot.appendChild(this.fileDropZone.element);
    }

    this.btnFloatingMenu = document.getElementById("btn-floating-menu") as HTMLButtonElement | null;
    this.btnMinimizeMenu = this.uiPanel.querySelector("#btn-minimize-menu") || (document.getElementById("btn-minimize-menu") as HTMLButtonElement | null);

    this.bindEvents();
    this.bindToolCallbacks();
  }

  public getImportBudget(): number {
    return this.renderSettingsPanel.getImportBudget();
  }

  public getPointSize(): number {
    return this.renderSettingsPanel.getPointSize();
  }

  public isOrthoChecked(): boolean {
    return this.renderSettingsPanel.isOrthoChecked();
  }

  public minimizeMenu(): void {
    if (this.uiPanel) this.uiPanel.classList.add("minimized");
    if (this.btnFloatingMenu) this.btnFloatingMenu.style.display = "flex";
    this.quickToolbar.show();
  }

  public expandMenu(): void {
    if (this.uiPanel) this.uiPanel.classList.remove("minimized");
    if (this.btnFloatingMenu) this.btnFloatingMenu.style.display = "none";
    this.quickToolbar.hide();
  }

  public toggleMenu(): void {
    if (this.uiPanel?.classList.contains("minimized")) {
      this.expandMenu();
    } else {
      this.minimizeMenu();
    }
  }

  private bindEvents(): void {
    this.btnMinimizeMenu?.addEventListener("click", () => this.minimizeMenu());
    this.btnFloatingMenu?.addEventListener("click", () => this.expandMenu());
    this.quickToolbar.onExpand(() => this.expandMenu());

    this.profileChart.onClose(() => {
      this.toolManager.profileTool.clear();
    });

    this.measurementHud.onClear(() => {
      this.toolManager.measurementTool.resetToIdle();
    });

    AppEvents.on("ui:filter-change", (activeCount: number, total: number, pct: number) => {
      let fileName = "pointcloud";
      AppEvents.emit("action:request-filename", (name: string) => { fileName = name; });
      AppEvents.emit(
        "ui:status-update",
        fileName,
        `${activeCount.toLocaleString()} / ${total.toLocaleString()} pts (${pct}%)`
      );
    });

    // Keyboard shortcut 'M'
    if (typeof window !== "undefined") {
      window.addEventListener("keydown", (e: KeyboardEvent) => {
        if (e.key === "m" || e.key === "M") {
          const target = e.target as HTMLElement;
          if (target && (target.tagName === "INPUT" || target.tagName === "SELECT" || target.tagName === "TEXTAREA")) {
            return;
          }
          this.toggleMenu();
        }
      });
    }

    // Handle tool switching UI side-effects
    this.toolBar.onModeChange((mode: ToolMode) => {
      if (mode === "measure") {
        this.measurementHud.show();
        this.measurementHud.resetReadouts();
        this.profileChart.hide();
      } else if (mode === "profile") {
        this.measurementHud.hide();
        this.profileChart.hide();
      } else {
        this.measurementHud.hide();
        this.profileChart.hide();
      }
    });
  }

  private bindToolCallbacks(): void {
    this.toolManager.measurementTool.onMeasurement((result: MeasureResult) => {
      if (this.toolManager.getMode() !== "measure") {
        this.measurementHud.hide();
        return;
      }
      this.measurementHud.update(result);
    });

    this.toolManager.profileTool.onProfile((data: ProfileData | null, statusText?: string) => {
      if (this.toolManager.getMode() !== "profile") {
        this.profileChart.hide();
        return;
      }

      if (data && data.points.length > 0) {
        this.profileChart.render(data);
      } else if (statusText) {
        let fileName = "pointcloud";
        AppEvents.emit("action:request-filename", (name: string) => { fileName = name; });
        AppEvents.emit("ui:status-update", fileName, statusText);
      }
    });

    this.toolManager.inspectorTool.onInspect((point: InspectedPoint | null) => {
      if (point) {
        this.inspectorTooltip.show(point);
      } else {
        this.inspectorTooltip.hide();
      }
    });
  }

  public static panelTemplate(): string {
    return `
      <div id="ui-panel">
        <div class="title-row">
          <span class="title">LIDAR Viewer</span>
          <div class="btn-row">
            <button id="btn-snapshot" class="btn btn-secondary" title="Save Snapshot PNG">📸</button>
            <button id="btn-open" class="btn">Open File</button>
            <button id="btn-minimize-menu" class="btn btn-secondary btn-icon" title="Minimize Menu (M)">✕</button>
          </div>
        </div>
      </div>
    `;
  }
}
