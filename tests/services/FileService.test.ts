import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { FileService } from "../../src/services/FileService";

describe("FileService", () => {
  const originalElectronAPI = (window as any).electronAPI;

  afterEach(() => {
    (window as any).electronAPI = originalElectronAPI;
    vi.restoreAllMocks();
  });

  describe("isElectron", () => {
    it("returns false in standard browser environment", () => {
      delete (window as any).electronAPI;
      expect(FileService.isElectron()).toBe(false);
    });

    it("returns true when window.electronAPI is defined", () => {
      (window as any).electronAPI = {
        getPoints: vi.fn(),
        openFileDialog: vi.fn()
      };
      expect(FileService.isElectron()).toBe(true);
    });
  });

  describe("loadFile", () => {
    it("fetches text file in browser environment", async () => {
      delete (window as any).electronAPI;

      const mockText = "10 20 30\n40 50 60";
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        text: () => Promise.resolve(mockText)
      } as any);

      const res = await FileService.loadFile("points.txt");
      expect(res.success).toBe(true);
      expect(res.data).toBe(mockText);
      expect(global.fetch).toHaveBeenCalledWith("points.txt");
    });

    it("fetches binary ArrayBuffer for .las / .tif in browser environment", async () => {
      delete (window as any).electronAPI;

      const mockBuffer = new ArrayBuffer(16);
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        arrayBuffer: () => Promise.resolve(mockBuffer)
      } as any);

      const res = await FileService.loadFile("survey.las");
      expect(res.success).toBe(true);
      expect(res.data).toBe(mockBuffer);
    });

    it("handles fetch HTTP errors gracefully", async () => {
      delete (window as any).electronAPI;

      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        statusText: "Not Found"
      } as any);

      const res = await FileService.loadFile("missing.txt");
      expect(res.success).toBe(false);
      expect(res.error).toContain("404");
    });

    it("routes through window.electronAPI in Electron environment", async () => {
      const mockElectron = {
        getPoints: vi.fn().mockResolvedValue({ success: true, fileName: "test.las", data: "electron-data" }),
        openFileDialog: vi.fn()
      };
      (window as any).electronAPI = mockElectron;

      const res = await FileService.loadFile("test.las");
      expect(res.success).toBe(true);
      expect(res.data).toBe("electron-data");
      expect(mockElectron.getPoints).toHaveBeenCalledWith("test.las");
    });
  });

  describe("openFilePicker in Electron", () => {
    it("calls window.electronAPI.openFileDialog", async () => {
      const mockElectron = {
        getPoints: vi.fn(),
        openFileDialog: vi.fn().mockResolvedValue({ canceled: false, success: true, fileName: "custom.las" })
      };
      (window as any).electronAPI = mockElectron;

      const res = await FileService.openFilePicker();
      expect(res.success).toBe(true);
      expect(res.fileName).toBe("custom.las");
      expect(mockElectron.openFileDialog).toHaveBeenCalled();
    });
  });
});
