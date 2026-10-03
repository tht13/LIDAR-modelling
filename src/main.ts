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
  private currentFileName: string = "points.txt";
  private maxImportPoints: number = 5_000_000;
  private importedDatasets: Map<string, { id: string; name: string; displayName: string; data?: string | ArrayBuffer | File; url?: string }> = new Map();

  constructor() {
    this.viewer = new Viewer();
    this.toolManager = new ToolManager(this.viewer);
    this.uiManager = new UIManager(this.viewer, this.toolManager);
    this.maxImportPoints = this.uiManager.getImportBudget();

    this.parserWorker = new Worker(new URL("./parser.worker.ts", import.meta.url));
    this.parserWorker.onmessage = (e: MessageEvent<any>) => {
      if (e.data.type === "progress") {
        this.uiManager.setProgress(e.data.percent);
        if (e.data.statusText) {
          this.uiManager.updateStatus(this.currentFileName, e.data.statusText);
        }
        return;
      }
      this.handleWorkerMessage(e.data);
    };

    this.parserWorker.onerror = (err: ErrorEvent) => {
      this.uiManager.setProgress(null);
      this.uiManager.updateStatus("Error", err.message || "Failed to process file in background worker");
      console.error("Worker error:", err);
    };

    this.uiManager.onFileOpen((data, fileName) => {
      this.registerAndLoadImportedFile(data, fileName);
    });

    this.uiManager.onDatasetSelect((datasetId) => {
      this.loadDatasetById(datasetId);
    });

    this.uiManager.onImportBudgetChange((budget) => {
      this.maxImportPoints = budget;
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

    if (this.importedDatasets.has(datasetId)) {
      const entry = this.importedDatasets.get(datasetId)!;
      this.uiManager.setDatasetValue(entry.id);
      window.location.hash = `dataset=${encodeURIComponent(entry.id)}`;
      if (entry.data) {
        this.processFileData(entry.data, entry.name);
      } else if (entry.url) {
        await this.loadFromUrl(entry.url, entry.id);
      }
      return;
    }

    const found = SampleDatasets.list.find((d) => d.id === datasetId);
    if (!found) {
      await this.loadFromUrl("points.txt");
      return;
    }

    this.uiManager.setDatasetValue(found.id);
    window.location.hash = `dataset=${found.id}`;

    if (found.type === "binary" && found.generateBinary) {
      this.uiManager.updateStatus(found.name, "Generating binary LAS dataset...");
      this.uiManager.setProgress(40);
      const buffer = found.generateBinary();
      this.uiManager.setProgress(75);
      this.processFileData(buffer, found.name);
    } else if (found.type === "generator" && found.generate) {
      this.uiManager.updateStatus(found.name, "Generating procedural point cloud...");
      this.uiManager.setProgress(40);
      const text = found.generate();
      this.uiManager.setProgress(75);
      this.processFileData(text, found.name);
    } else if (found.url) {
      await this.loadFromUrl(found.url);
    }
  }

  private registerAndLoadImportedFile(data: string | ArrayBuffer | File, fileName: string): void {
    const slug = fileName.toLowerCase().replace(/[^a-z0-9_-]/g, "_");
    const importId = `imported-${slug}`;
    const icon = this.getFileIcon(fileName);
    const displayName = `${icon} ${fileName}`;

    this.importedDatasets.set(importId, {
      id: importId,
      name: fileName,
      displayName: displayName,
      data: data
    });

    this.uiManager.addImportedDataset(importId, displayName);
    window.location.hash = `dataset=${encodeURIComponent(importId)}`;
    this.processFileData(data, fileName);
  }

  private async loadFromUrl(url: string, selectId?: string): Promise<void> {
    const cleanUrl = url.split("?")[0];
    const fileName = cleanUrl.split("/").pop() || "dataset.txt";
    this.uiManager.updateStatus(fileName, "Downloading point cloud...");
    this.uiManager.setProgress(30);

    const res = await FileService.loadFile(url);
    this.uiManager.setProgress(70);

    if (res.success && res.data) {
      const isSampleUrl = SampleDatasets.list.some((s) => s.url === url);
      if (!isSampleUrl) {
        const importId = selectId || `url-${Math.abs(this.hashString(url)).toString(36)}`;
        const icon = this.getFileIcon(fileName);
        const displayName = `${icon} ${fileName} (URL)`;
        this.importedDatasets.set(importId, {
          id: importId,
          name: fileName,
          displayName: displayName,
          data: res.data,
          url: url
        });
        this.uiManager.addImportedDataset(importId, displayName);
        window.location.hash = `dataset=${encodeURIComponent(importId)}`;
      }
      this.processFileData(res.data, res.fileName || fileName);
    } else {
      this.uiManager.setProgress(null);
      this.uiManager.updateStatus(fileName, "Failed to load dataset");
      console.error("Dataset download error:", res.error);
    }
  }

  private processFileData(data: string | ArrayBuffer | File, fileName: string): void {
    this.currentFileName = fileName;
    this.uiManager.updateStatus(fileName, "Preparing point cloud...");
    this.uiManager.setProgress(10);
    this.toolManager.measurementTool.clear();

    if (data instanceof File || (typeof Blob !== "undefined" && data instanceof Blob)) {
      this.parserWorker.postMessage({
        type: "parse-file",
        file: data,
        maxPoints: this.maxImportPoints
      });
    } else if (data instanceof ArrayBuffer) {
      // Transfer a slice of the ArrayBuffer so the original stored in importedDatasets remains intact
      const bufferCopy = data.slice(0);
      this.parserWorker.postMessage({
        type: "parse-buffer",
        buffer: bufferCopy,
        maxPoints: this.maxImportPoints
      }, [bufferCopy]);
    } else {
      this.parserWorker.postMessage({
        type: "parse-text",
        text: data,
        maxPoints: this.maxImportPoints
      });
    }
  }

  private getFileIcon(fileName: string): string {
    const ext = fileName.toLowerCase().split(".").pop() || "";
    if (["tif", "tiff", "geotiff"].includes(ext)) return "🗺️";
    if (["las", "laz"].includes(ext)) return "🛰️";
    if (["ply"].includes(ext)) return "🐬";
    if (["xyz", "txt", "csv", "pts"].includes(ext)) return "📄";
    return "📁";
  }

  private hashString(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = (hash << 5) - hash + str.charCodeAt(i);
      hash |= 0;
    }
    return hash;
  }

  private handleWorkerMessage(msg: { success?: boolean; data?: ParseResult; error?: string }): void {
    this.uiManager.setProgress(null);

    if (msg.error || !msg.data) {
      this.uiManager.updateStatus("Error", msg.error || "Failed to parse points data");
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
    let countSummary = `${data.count.toLocaleString()} points`;
    if (data.subsampled && data.totalPoints && data.totalPoints > data.count) {
      const pct = ((data.count / data.totalPoints) * 100).toFixed(1);
      countSummary = `${data.count.toLocaleString()} pts (${pct}% of ${(data.totalPoints).toLocaleString()} pts)`;
    }

    this.uiManager.updateStatus(
      this.currentFileName,
      countSummary,
      boundsText
    );
  }
}

window.addEventListener("DOMContentLoaded", () => {
  const app = new App();
  app.start();
});
