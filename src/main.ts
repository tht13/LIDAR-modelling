import { Viewer } from "./core/Viewer";
import { PointCloud } from "./core/PointCloud";
import { ToolManager } from "./tools/ToolManager";
import { UIManager } from "./ui/UIManager";
import { FileService } from "./services/FileService";
import { ParseResult, ColorMode } from "./types";

class App {
  private viewer: Viewer;
  private toolManager: ToolManager;
  private uiManager: UIManager;
  private parserWorker: Worker;

  constructor() {
    this.viewer = new Viewer();
    this.toolManager = new ToolManager(this.viewer);
    this.uiManager = new UIManager(this.viewer, this.toolManager);

    this.parserWorker = new Worker(new URL("./parser.worker.ts", import.meta.url));
    this.parserWorker.onmessage = (e: MessageEvent<{ success?: boolean; data?: ParseResult; error?: string }>) => {
      this.handleWorkerMessage(e.data);
    };

    this.uiManager.onFileOpen((text, fileName) => {
      this.processFileText(text, fileName);
    });
  }

  public async start(): Promise<void> {
    await this.loadDefaultDataset("points.txt");
  }

  private async loadDefaultDataset(fileName: string): Promise<void> {
    this.uiManager.updateStatus(fileName, "Loading file...");
    const res = await FileService.loadFile(fileName);
    if (res.success && res.data) {
      this.processFileText(res.data, res.fileName || fileName);
    } else {
      this.uiManager.updateStatus(fileName, "Ready (Drag or Open a file)");
    }
  }

  private processFileText(text: string, fileName: string): void {
    this.uiManager.updateStatus(fileName, "Parsing points in background...");
    this.toolManager.measurementTool.clear();
    this.parserWorker.postMessage(text);
  }

  private handleWorkerMessage(msg: { success?: boolean; data?: ParseResult; error?: string }): void {
    if (msg.error || !msg.data) {
      this.uiManager.updateStatus("Error", "Failed to parse points data");
      console.error("Worker error:", msg.error);
      return;
    }

    const data = msg.data;
    const pointSize = this.uiManager.getPointSize();
    const isOrtho = this.uiManager.isOrthoChecked();
    const pointCloud = new PointCloud(data, pointSize, isOrtho);

    this.viewer.setPointCloud(pointCloud);

    // Update UI status & colormap selector
    const defaultColorMode = data.hasRGB ? ColorMode.RGB : ColorMode.Turbo;
    this.uiManager.setColormapValue(defaultColorMode);

    const boundsText = `Extents: ${data.size[0].toFixed(1)}m × ${data.size[2].toFixed(1)}m | Elev: ${data.size[1].toFixed(1)}m`;
    this.uiManager.updateStatus(
      document.getElementById("lbl-file")?.textContent || "points.txt",
      `${data.count.toLocaleString()} points`,
      boundsText
    );
  }
}

window.addEventListener("DOMContentLoaded", () => {
  const app = new App();
  app.start();
});
