import { ToolManager } from "../../tools/ToolManager";
import { Viewer } from "../../core/Viewer";
import { ToolMode } from "../../types";
import { createElement } from "../utils/dom";
import { AppEvents } from "../../core/AppEvents";

export class ToolBar {
  public readonly element: HTMLElement;
  public readonly flyHintElement: HTMLElement;

  private toolManager: ToolManager;
  private viewer: Viewer;
  private flyHint: HTMLElement | null;
  private toggleOrtho: HTMLInputElement | null = null;
  private onModeChangeCallback: ((mode: ToolMode) => void) | null = null;

  // Full view buttons in sidebar panel
  private toolButtons: Partial<Record<ToolMode, HTMLButtonElement | null>> = {};

  constructor(viewer: Viewer, toolManager: ToolManager) {
    this.viewer = viewer;
    this.toolManager = toolManager;

    let el = document.getElementById("tool-orbit")?.closest(".toolbar-control-group") as HTMLElement | null;
    if (!el) {
      const existingTab = document.getElementById("tool-orbit");
      if (existingTab) {
        el = existingTab.parentElement?.parentElement as HTMLElement;
      } else {
        el = createElement<HTMLElement>(ToolBar.template());
      }
    }
    this.element = el;

    let hintEl = document.getElementById("fly-hint");
    if (!hintEl) {
      hintEl = createElement<HTMLElement>(ToolBar.flyHintTemplate());
    }
    this.flyHintElement = hintEl;
    this.flyHint = hintEl;

    this.toggleOrtho = document.getElementById("toggle-ortho") as HTMLInputElement | null;

    this.initButtons();
    this.bindEvents();
  }

  public onModeChange(cb: (mode: ToolMode) => void): void {
    this.onModeChangeCallback = cb;
  }

  public setMode(tool: ToolMode): void {
    this.toolManager.setMode(tool);
    AppEvents.emit("ui:tool-mode-changed", tool);

    (["orbit", "measure", "profile", "inspect", "fly"] as ToolMode[]).forEach((mode) => {
      const fullBtn = this.toolButtons[mode];
      if (fullBtn) fullBtn.classList.toggle("active", mode === tool);
    });

    if (this.flyHint) {
      this.flyHint.style.display = tool === "fly" ? "flex" : "none";
    }

    if (!this.toggleOrtho) {
      this.toggleOrtho = document.getElementById("toggle-ortho") as HTMLInputElement | null;
    }

    if (tool === "fly") {
      if (this.viewer.getOrthoMode()) {
        AppEvents.emit("action:toggle-ortho", false);
      }
      if (this.toggleOrtho) {
        this.toggleOrtho.checked = false;
        this.toggleOrtho.disabled = true;
        const row = this.toggleOrtho.closest(".control-row") as HTMLElement | null;
        row?.style.setProperty("opacity", "0.35");
        row?.style.setProperty("pointer-events", "none");
      }

      const speedEl = this.flyHintElement.querySelector("#fly-speed-val") || document.getElementById("fly-speed-val");
      if (speedEl && this.viewer.firstPersonControls) {
        speedEl.textContent = this.viewer.firstPersonControls.getSpeed().toString();
      }
    } else {
      if (this.toggleOrtho) {
        this.toggleOrtho.disabled = false;
        const row = this.toggleOrtho.closest(".control-row") as HTMLElement | null;
        row?.style.removeProperty("opacity");
        row?.style.removeProperty("pointer-events");
      }
    }

    if (this.onModeChangeCallback) {
      this.onModeChangeCallback(tool);
    }
  }

  private initButtons(): void {
    (["orbit", "measure", "profile", "inspect", "fly"] as ToolMode[]).forEach((mode) => {
      this.toolButtons[mode] = this.element.querySelector(`#tool-${mode}`) || (document.getElementById(`tool-${mode}`) as HTMLButtonElement | null);
    });
  }

  private bindEvents(): void {
    (["orbit", "measure", "profile", "inspect", "fly"] as ToolMode[]).forEach((tool) => {
      this.toolButtons[tool]?.addEventListener("click", () => AppEvents.emit("action:set-tool-mode", tool));
    });

    AppEvents.on("action:set-tool-mode", (tool: ToolMode) => {
      this.setMode(tool);
    });

    if (this.viewer.firstPersonControls?.onSpeedChange) {
      this.viewer.firstPersonControls.onSpeedChange((speed) => {
        const speedEl = this.flyHintElement.querySelector("#fly-speed-val") || document.getElementById("fly-speed-val");
        if (speedEl) speedEl.textContent = speed.toString();
      });
    }
  }

  public static template(): string {
    return `
      <div class="toolbar-control-group">
        <div class="section-title">Tool Mode</div>
        <div class="tool-tabs">
          <button id="tool-orbit" class="tool-btn active">🖐️ Orbit</button>
          <button id="tool-measure" class="tool-btn">📏 Dist</button>
          <button id="tool-profile" class="tool-btn">📊 Slice</button>
          <button id="tool-inspect" class="tool-btn">🔍 Info</button>
          <button id="tool-fly" class="tool-btn">🚶 Fly</button>
        </div>
      </div>
    `;
  }

  public static flyHintTemplate(): string {
    return `
      <div id="fly-hint">
        <span><span class="key-badge">W</span><span class="key-badge">A</span><span class="key-badge">S</span><span class="key-badge">D</span> Move</span>
        <span><span class="key-badge">Space</span> Up</span>
        <span><span class="key-badge">C</span> Down</span>
        <span><span class="key-badge">Shift</span> Turbo</span>
        <span style="color: #94a3b8;">| Click/Drag to Look</span>
        <span style="color: #38bdf8;">| Speed: <span id="fly-speed-val" class="key-badge">220</span> m/s (Wheel ±)</span>
      </div>
    `;
  }
}
