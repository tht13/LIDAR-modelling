import { FileService } from "../../services/FileService";
import { createElement } from "../utils/dom";

export class FileDropZone {
  public readonly element: HTMLElement;
  private btnOpen: HTMLButtonElement | null;
  private miniBtnOpen: HTMLButtonElement | null;
  private onFileOpenCallback: ((data: string | ArrayBuffer | File, fileName: string) => void) | null = null;

  constructor() {
    let el = document.getElementById("drop-overlay");
    if (!el) {
      el = createElement<HTMLElement>(FileDropZone.template());
    }
    this.element = el;

    this.btnOpen = document.getElementById("btn-open") as HTMLButtonElement | null;
    this.miniBtnOpen = document.getElementById("quick-action-open") as HTMLButtonElement | null;

    this.bindEvents();
  }

  public onFileOpen(cb: (data: string | ArrayBuffer | File, fileName: string) => void): void {
    this.onFileOpenCallback = cb;
  }

  private bindEvents(): void {
    const triggerPicker = async () => {
      try {
        const res = await FileService.openFilePicker();
        if (!res.canceled && res.success && res.data && this.onFileOpenCallback) {
          this.onFileOpenCallback(res.data, res.fileName || "custom.txt");
        }
      } catch (err) {
        console.error("Failed to open file dialog:", err);
      }
    };

    if (!this.btnOpen) this.btnOpen = document.getElementById("btn-open") as HTMLButtonElement | null;
    if (!this.miniBtnOpen) this.miniBtnOpen = document.getElementById("quick-action-open") as HTMLButtonElement | null;

    this.btnOpen?.addEventListener("click", triggerPicker);
    this.miniBtnOpen?.addEventListener("click", triggerPicker);

    if (typeof window !== "undefined") {
      window.addEventListener("dragover", (e) => {
        e.preventDefault();
        this.element.style.display = "flex";
      });

      window.addEventListener("dragleave", (e) => {
        if (e.relatedTarget === null) {
          this.element.style.display = "none";
        }
      });

      window.addEventListener("drop", (e) => {
        e.preventDefault();
        this.element.style.display = "none";
        if (e.dataTransfer && e.dataTransfer.files.length > 0 && this.onFileOpenCallback) {
          const file = e.dataTransfer.files[0];
          this.onFileOpenCallback(file, file.name);
        }
      });
    }
  }

  public static template(): string {
    return `<div id="drop-overlay">Drop Point Cloud File Here</div>`;
  }
}
