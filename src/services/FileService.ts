export class FileService {
  /**
   * Checks if the app is currently running inside an Electron desktop window
   */
  public static isElectron(): boolean {
    return typeof window !== "undefined" && typeof window.electronAPI !== "undefined";
  }

  /**
   * Loads a default or named point cloud file
   */
  public static async loadFile(pathOrUrl: string): Promise<{ success: boolean; fileName: string; data?: string | ArrayBuffer; error?: string }> {
    if (this.isElectron()) {
      try {
        const res = await window.electronAPI.getPoints(pathOrUrl);
        return {
          success: res.success,
          fileName: res.fileName || pathOrUrl,
          data: res.data,
          error: res.error
        };
      } catch (err: any) {
        return { success: false, fileName: pathOrUrl, error: err?.message || String(err) };
      }
    } else {
      // Running in standard Web Browser (fetch)
      try {
        const response = await fetch(pathOrUrl);
        if (!response.ok) {
          throw new Error(`HTTP error ${response.status}: ${response.statusText}`);
        }
        const isBinary = pathOrUrl.toLowerCase().endsWith(".las") || pathOrUrl.toLowerCase().endsWith(".laz");
        const data = isBinary ? await response.arrayBuffer() : await response.text();
        return { success: true, fileName: pathOrUrl, data };
      } catch (err: any) {
        return { success: false, fileName: pathOrUrl, error: err?.message || String(err) };
      }
    }
  }

  /**
   * Prompts the user to select a point cloud file:
   * Uses Native OS Dialog in Electron, or HTML5 <input type="file"> in Web Browser.
   */
  public static async openFilePicker(): Promise<{ success: boolean; canceled?: boolean; fileName?: string; data?: string | ArrayBuffer | File; error?: string }> {
    if (this.isElectron()) {
      try {
        const res = await window.electronAPI.openFileDialog();
        return {
          success: !res.canceled && !!res.success,
          canceled: res.canceled,
          fileName: res.fileName,
          data: res.data,
          error: res.error
        };
      } catch (err: any) {
        return { success: false, error: err?.message || String(err) };
      }
    } else {
      // Browser: standard HTML5 file picker - return File directly for streaming
      return new Promise((resolve) => {
        const fileInput = document.createElement("input");
        fileInput.type = "file";
        fileInput.accept = ".txt,.xyz,.pts,.csv,.asc,.las,.laz,.ply";
        fileInput.style.display = "none";

        fileInput.onchange = () => {
          if (fileInput.files && fileInput.files.length > 0) {
            const file = fileInput.files[0];
            resolve({
              success: true,
              canceled: false,
              fileName: file.name,
              data: file
            });
          } else {
            resolve({ success: false, canceled: true });
          }
          document.body.removeChild(fileInput);
        };

        fileInput.oncancel = () => {
          resolve({ success: false, canceled: true });
          document.body.removeChild(fileInput);
        };

        document.body.appendChild(fileInput);
        fileInput.click();
      });
    }
  }
}
