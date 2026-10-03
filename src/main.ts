import { Viewer } from "./core/Viewer";
import { PointCloud } from "./core/PointCloud";
import { ToolManager } from "./tools/ToolManager";
import { UIManager } from "./ui/UIManager";
import { FileService } from "./services/FileService";
import { SampleDatasets } from "./services/SampleDatasets";
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

    this.uiManager.onDatasetSelect((datasetId) => {
      this.loadDatasetById(datasetId);
    });
  }

  public async start(): Promise<void> {
    // Check URL hash for deep-linking (e.g. #dataset=urban-city)
    const hash = window.location.hash.replace(/^#/, "");
    const params = new URLSearchParams(hash);
    const datasetParam = params.get("dataset");

    if (datasetParam) {
      await this.loadDatasetById(datasetParam);
    } else {
      await this.loadDatasetById("mountain-lidar");
    }
  }

  public async loadDatasetById(datasetId: string): Promise<void> {
    if (datasetId.startsWith("url:")) {
      const url = datasetId.substring(4);
      await this.loadFromUrl(url);
      return;
    }

    const found = SampleDatasets.list.find((d) => d.id === datasetId);
    if (!found) {
      await this.loadFromUrl("points.txt");
      return;
    }

    this.uiManager.setDatasetValue(found.id);
    window.location.hash = `dataset=${found.id}`;

    if (found.type === "generator" && found.generate) {
      this.uiManager.updateStatus(found.name, "Generating procedural point cloud...");
      this.uiManager.setProgress(40);
      const text = found.generate();
      this.uiManager.setProgress(75);
      this.processFileText(text, found.name);
    } else if (found.url) {
      await this.loadFromUrl(found.url);
    }
  }

  private async loadFromUrl(url: string): Promise<void> {
    const fileName = url.split("/").pop() || "points.txt";
    this.uiManager.updateStatus(fileName, "Downloading point cloud...");
    this.uiManager.setProgress(30);

    const res = await FileService.loadFile(url);
    this.uiManager.setProgress(70);

    if (res.success && res.data) {
      this.processFileText(res.data, res.fileName || fileName);
    } else {
      this.uiManager.setProgress(null);
      this.uiManager.updateStatus(fileName, "Failed to load dataset");
      console.error("Dataset download error:", res.error);
    }
  }

  private processFileText(text: string, fileName: string): void {
    this.uiManager.updateStatus(fileName, "Parsing points in background...");
    this.uiManager.setProgress(85);
    this.toolManager.measurementTool.clear();
    this.parserWorker.postMessage(text);
  }

  private handleWorkerMessage(msg: { success?: boolean; data?: ParseResult; error?: string }): void {
    this.uiManager.setProgress(null);

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

    // Auto-select colormap
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
