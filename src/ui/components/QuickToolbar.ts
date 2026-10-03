import { createElement } from "../utils/dom";
import { AppEvents } from "../../core/AppEvents";

export class QuickToolbar {
  public readonly element: HTMLElement;
  private btnMenu: HTMLButtonElement | null;
  private onExpandCallback: (() => void) | null = null;

  constructor() {
    let el = document.getElementById("quick-toolbar");
    if (!el) {
      el = createElement<HTMLElement>(QuickToolbar.template());
    }
    this.element = el;
    this.btnMenu = this.element.querySelector("#btn-floating-menu");

    this.btnMenu?.addEventListener("click", () => {
      if (this.onExpandCallback) {
        this.onExpandCallback();
      }
    });

    this.element.querySelector("#quick-cam-iso")?.addEventListener("click", () => AppEvents.emit("action:camera-preset", "iso"));
    this.element.querySelector("#quick-cam-top")?.addEventListener("click", () => AppEvents.emit("action:camera-preset", "top"));
    this.element.querySelector("#quick-toggle-edl")?.addEventListener("click", () => AppEvents.emit("action:toggle-edl"));
    this.element.querySelector("#quick-toggle-ortho")?.addEventListener("click", () => AppEvents.emit("action:toggle-ortho"));
    this.element.querySelector("#quick-action-snapshot")?.addEventListener("click", () => AppEvents.emit("action:snapshot"));
    this.element.querySelector("#quick-action-open")?.addEventListener("click", () => AppEvents.emit("action:trigger-file-picker"));

    (["orbit", "measure", "profile", "inspect", "fly"] as const).forEach(tool => {
      this.element.querySelector(`#quick-tool-${tool}`)?.addEventListener("click", () => AppEvents.emit("action:set-tool-mode", tool));
    });

    AppEvents.on("ui:edl-toggled", (enabled: boolean) => {
      this.element.querySelector("#quick-toggle-edl")?.classList.toggle("active", enabled);
    });

    AppEvents.on("ui:ortho-toggled", (enabled: boolean) => {
      this.element.querySelector("#quick-toggle-ortho")?.classList.toggle("active", enabled);
    });

    AppEvents.on("ui:tool-mode-changed", (mode: string) => {
      (["orbit", "measure", "profile", "inspect", "fly"] as const).forEach(tool => {
        this.element.querySelector(`#quick-tool-${tool}`)?.classList.toggle("active", tool === mode);
      });
    });
  }

  public onExpand(cb: () => void): void {
    this.onExpandCallback = cb;
  }

  public show(): void {
    this.element.style.display = "flex";
  }

  public hide(): void {
    this.element.style.display = "none";
  }

  public static template(): string {
    return `
      <div id="quick-toolbar">
        <button id="btn-floating-menu" class="quick-btn quick-btn-menu" title="Open Full Menu (M)">
          <span>☰</span>
          <span>Menu</span>
        </button>

        <div class="quick-divider"></div>

        <!-- Quick Tool Switcher -->
        <button id="quick-tool-orbit" class="quick-btn active" title="Orbit Mode (Rotate/Pan/Zoom)">🖐️</button>
        <button id="quick-tool-measure" class="quick-btn" title="Measure Distance">📏</button>
        <button id="quick-tool-profile" class="quick-btn" title="2D Cross-Section Elevation Slice">📊</button>
        <button id="quick-tool-inspect" class="quick-btn" title="Point Info Inspector">🔍</button>
        <button id="quick-tool-fly" class="quick-btn" title="First-Person Fly Navigation">🚶</button>

        <div class="quick-divider"></div>

        <!-- Quick Camera Presets -->
        <button id="quick-cam-iso" class="quick-btn" title="Reset Camera (Isometric)">🏠</button>
        <button id="quick-cam-top" class="quick-btn" title="Top-down / Nadir View">⬆️</button>

        <div class="quick-divider"></div>

        <!-- Quick Display Toggles -->
        <button id="quick-toggle-edl" class="quick-btn active" title="Toggle Eye-Dome Lighting (EDL)">💡</button>
        <button id="quick-toggle-ortho" class="quick-btn" title="Toggle Orthographic / Perspective Projection">📐</button>

        <div class="quick-divider"></div>

        <!-- Quick Actions -->
        <button id="quick-action-snapshot" class="quick-btn" title="Save Snapshot PNG">📸</button>
        <button id="quick-action-open" class="quick-btn" title="Open Point Cloud File">📂</button>

        <div class="quick-divider"></div>

        <!-- Point Cloud Info Pill -->
        <div id="quick-info-pill" class="quick-info-pill" title="Current Dataset & Point Count">
          <span id="quick-info-file">points.txt</span>
          <span class="quick-info-sep">·</span>
          <span id="quick-info-pts">Loading...</span>
        </div>
      </div>
    `;
  }
}
