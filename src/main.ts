import { Viewer } from "./core/Viewer";
import { PointCloud } from "./core/PointCloud";
import { ToolManager } from "./tools/ToolManager";
import { UIManager } from "./ui/UIManager";
import { FileService } from "./services/FileService";
import { SampleDatasets } from "./services/SampleDatasets";
import { ParseResult, ColorMode } from "./types";
import { ParserWorkerClient } from "./services/ParserWorkerClient";
import { AppEvents } from "./core/AppEvents";
import { DatasetCacheService } from "./services/DatasetCacheService";

class App {
  private viewer: Viewer;
  private toolManager: ToolManager;
  private uiManager: UIManager;
  private workerClient: ParserWorkerClient;
  private currentFileName: string = "points.txt";
  private currentDatasetId: string = "mountain-lidar";
  private maxImportPoints: number = 5_000_000;
  private importedDatasets: Map<string, { id: string; name: string; displayName: string; data?: string | ArrayBuffer | File; url?: string }> = new Map();

  constructor() {
    this.viewer = new Viewer();
    this.toolManager = new ToolManager(this.viewer);
    this.uiManager = new UIManager(this.viewer, this.toolManager);
    this.maxImportPoints = this.uiManager.getImportBudget();

    this.workerClient = new ParserWorkerClient(
      (percent, statusText) => {
        AppEvents.emit("ui:progress", percent);
        if (statusText) {
          AppEvents.emit("ui:status-update", this.currentFileName, statusText);
        }
      },
      (err) => {
        AppEvents.emit("ui:progress", null);
        AppEvents.emit("ui:status-update", "Error", err);
      },
      (result) => {
        this.handleParseSuccess(result);
      }
    );

    AppEvents.on("action:open-file", (data: string | ArrayBuffer | File, fileName: string) => {
      this.registerAndLoadImportedFile(data, fileName);
    });

    AppEvents.on("action:load-dataset", (datasetId: string) => {
      this.loadDatasetById(datasetId);
    });

    AppEvents.on("ui:import-budget-changed", (budget: number) => {
      this.maxImportPoints = budget;
    });
  }

  public async start(): Promise<void> {
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
    this.currentDatasetId = datasetId;
    if (datasetId.startsWith("url:")) {
      const url = datasetId.substring(4);
      await this.loadFromUrl(url);
      return;
    }

    // Check IndexedDB cache first
    const cached = await DatasetCacheService.getDataset(datasetId);
    if (cached) {
      AppEvents.emit("ui:dataset-changed", datasetId);
      window.location.hash = `dataset=${encodeURIComponent(datasetId)}`;
      this.currentFileName = datasetId;
      this.handleParseSuccess(cached);
      return;
    }

    if (this.importedDatasets.has(datasetId)) {
      const entry = this.importedDatasets.get(datasetId)!;
      AppEvents.emit("ui:dataset-changed", entry.id);
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

    AppEvents.emit("ui:dataset-changed", found.id);
    window.location.hash = `dataset=${found.id}`;

    if (found.type === "binary" && found.generateBinary) {
      AppEvents.emit("ui:status-update", found.name, "Generating binary LAS dataset...");
      AppEvents.emit("ui:progress", 40);
      const buffer = found.generateBinary();
      AppEvents.emit("ui:progress", 75);
      this.processFileData(buffer, found.name);
    } else if (found.type === "generator") {
      this.currentFileName = found.name;
      this.toolManager.measurementTool.clear();
      this.workerClient.generateProcedural(found.id, this.maxImportPoints);
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

    AppEvents.emit("ui:dataset-imported", importId, displayName);
    window.location.hash = `dataset=${encodeURIComponent(importId)}`;
    this.processFileData(data, fileName);
  }

  private async loadFromUrl(url: string, selectId?: string): Promise<void> {
    const cleanUrl = url.split("?")[0];
    const fileName = cleanUrl.split("/").pop() || "dataset.txt";
    AppEvents.emit("ui:status-update", fileName, "Downloading point cloud...");
    AppEvents.emit("ui:progress", 30);

    const res = await FileService.loadFile(url);
    AppEvents.emit("ui:progress", 70);

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
        AppEvents.emit("ui:dataset-imported", importId, displayName);
        window.location.hash = `dataset=${encodeURIComponent(importId)}`;
      }
      this.processFileData(res.data, res.fileName || fileName);
    } else {
      AppEvents.emit("ui:progress", null);
      AppEvents.emit("ui:status-update", fileName, "Failed to load dataset");
      console.error("Dataset download error:", res.error);
    }
  }

  private processFileData(data: string | ArrayBuffer | File, fileName: string): void {
    this.currentFileName = fileName;
    AppEvents.emit("ui:status-update", fileName, "Preparing point cloud...");
    AppEvents.emit("ui:progress", 10);
    this.toolManager.measurementTool.clear();

    if (data instanceof File || (typeof Blob !== "undefined" && data instanceof Blob)) {
      this.workerClient.parseFile(data, this.maxImportPoints);
    } else if (data instanceof ArrayBuffer) {
      this.workerClient.parseBuffer(data, this.maxImportPoints);
    } else {
      this.workerClient.parseText(data, this.maxImportPoints);
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

  private handleParseSuccess(data: ParseResult): void {
    AppEvents.emit("ui:progress", null);

    const pointSize = this.uiManager.getPointSize();
    const isOrtho = this.uiManager.isOrthoChecked();
    const pointShape = this.uiManager.getPointShape();
    const pointCloud = new PointCloud(data, pointSize, isOrtho, pointShape);

    this.viewer.setPointCloud(pointCloud);

    // Auto-select colormap
    const defaultColorMode = data.hasRGB ? ColorMode.RGB : ColorMode.Turbo;
    AppEvents.emit("ui:colormap-changed", defaultColorMode);
    AppEvents.emit("ui:cloud-loaded");

    const boundsText = `Extents: ${data.size[0].toFixed(1)}m × ${data.size[2].toFixed(1)}m | Elev: ${data.size[1].toFixed(1)}m`;
    let countSummary = `${data.count.toLocaleString()} points`;
    if (data.subsampled && data.totalPoints && data.totalPoints > data.count) {
      const pct = ((data.count / data.totalPoints) * 100).toFixed(1);
      countSummary = `${data.count.toLocaleString()} pts (${pct}% of ${(data.totalPoints).toLocaleString()} pts)`;
    }

    AppEvents.emit(
      "ui:status-update",
      this.currentFileName,
      countSummary,
      boundsText
    );

    // Save to IndexedDB cache in background if within size limit (e.g. <= 50MB)
    if (this.currentDatasetId) {
      DatasetCacheService.saveDataset(this.currentDatasetId, this.currentFileName, data).catch(() => {});
    }
  }
}

window.addEventListener("DOMContentLoaded", () => {
  const app = new App();
  app.start();
});
