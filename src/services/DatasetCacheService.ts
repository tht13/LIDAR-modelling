import { ParseResult } from "../types";

export interface CacheEntryMetadata {
  id: string;
  name: string;
  count: number;
  sizeBytes: number;
  timestamp: number;
}

export class DatasetCacheService {
  private static readonly DB_NAME = "LidarViewerCache";
  private static readonly DB_VERSION = 1;
  private static readonly STORE_NAME = "datasets";

  // Maximum single dataset entry size: 50MB (prevents storing gigabytes)
  public static readonly MAX_ENTRY_BYTES = 50 * 1024 * 1024;
  // Maximum total cache quota: 150MB
  public static readonly MAX_TOTAL_BYTES = 150 * 1024 * 1024;

  private static dbPromise: Promise<IDBDatabase> | null = null;

  public static isSupported(): boolean {
    return typeof indexedDB !== "undefined";
  }

  private static getDB(): Promise<IDBDatabase> {
    if (!this.dbPromise) {
      this.dbPromise = new Promise((resolve, reject) => {
        if (!this.isSupported()) {
          reject(new Error("IndexedDB is not supported in this environment"));
          return;
        }

        const request = indexedDB.open(this.DB_NAME, this.DB_VERSION);

        request.onupgradeneeded = (event: IDBVersionChangeEvent) => {
          const db = (event.target as IDBOpenDBRequest).result;
          if (!db.objectStoreNames.contains(this.STORE_NAME)) {
            const store = db.createObjectStore(this.STORE_NAME, { keyPath: "id" });
            store.createIndex("timestamp", "timestamp", { unique: false });
          }
        };

        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
    }
    return this.dbPromise;
  }

  /**
   * Save a parsed dataset into IndexedDB if it fits within size limits.
   * Returns true if saved, false if skipped due to size limit or storage constraints.
   */
  public static async saveDataset(id: string, name: string, data: ParseResult): Promise<boolean> {
    if (!this.isSupported()) return false;

    // Calculate approximate byte size of Float32Arrays
    const posBytes = data.positions.byteLength;
    const colBytes = data.colors.byteLength;
    const elevBytes = data.elevations.byteLength;
    const classBytes = data.classifications ? data.classifications.byteLength : 0;
    const totalBytes = posBytes + colBytes + elevBytes + classBytes;

    // Reject entries larger than MAX_ENTRY_BYTES (50MB)
    if (totalBytes > this.MAX_ENTRY_BYTES) {
      return false;
    }

    try {
      const db = await this.getDB();
      await this.enforceQuota(db, totalBytes);

      const record = {
        id,
        name,
        timestamp: Date.now(),
        sizeBytes: totalBytes,
        data: {
          positions: data.positions.buffer.slice(data.positions.byteOffset, data.positions.byteOffset + data.positions.byteLength),
          colors: data.colors.buffer.slice(data.colors.byteOffset, data.colors.byteOffset + data.colors.byteLength),
          elevations: data.elevations.buffer.slice(data.elevations.byteOffset, data.elevations.byteOffset + data.elevations.byteLength),
          classifications: data.classifications
            ? data.classifications.buffer.slice(data.classifications.byteOffset, data.classifications.byteOffset + data.classifications.byteLength)
            : undefined,
          count: data.count,
          totalPoints: data.totalPoints,
          subsampled: data.subsampled,
          stride: data.stride,
          min: data.min,
          max: data.max,
          center: data.center,
          size: data.size,
          hasRGB: data.hasRGB
        }
      };

      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(this.STORE_NAME, "readwrite");
        const store = tx.objectStore(this.STORE_NAME);
        const req = store.put(record);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });

      return true;
    } catch {
      return false;
    }
  }

  /**
   * Retrieve a cached dataset by ID
   */
  public static async getDataset(id: string): Promise<ParseResult | null> {
    if (!this.isSupported()) return null;

    try {
      const db = await this.getDB();
      const record = await new Promise<any>((resolve, reject) => {
        const tx = db.transaction(this.STORE_NAME, "readonly");
        const store = tx.objectStore(this.STORE_NAME);
        const req = store.get(id);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });

      if (!record || !record.data) return null;

      const d = record.data;
      const result: ParseResult = {
        positions: new Float32Array(d.positions),
        colors: new Float32Array(d.colors),
        elevations: new Float32Array(d.elevations),
        classifications: d.classifications ? new Uint8Array(d.classifications) : undefined,
        count: d.count,
        totalPoints: d.totalPoints,
        subsampled: d.subsampled,
        stride: d.stride,
        min: d.min,
        max: d.max,
        center: d.center,
        size: d.size,
        hasRGB: d.hasRGB
      };

      return result;
    } catch {
      return null;
    }
  }

  /**
   * Remove a dataset from cache
   */
  public static async deleteDataset(id: string): Promise<void> {
    if (!this.isSupported()) return;
    try {
      const db = await this.getDB();
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(this.STORE_NAME, "readwrite");
        const store = tx.objectStore(this.STORE_NAME);
        const req = store.delete(id);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });
    } catch {
      // Ignore deletion errors
    }
  }

  /**
   * Clear all cached datasets
   */
  public static async clearCache(): Promise<void> {
    if (!this.isSupported()) return;
    try {
      const db = await this.getDB();
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(this.STORE_NAME, "readwrite");
        const store = tx.objectStore(this.STORE_NAME);
        const req = store.clear();
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      });
    } catch {
      // Ignore clear errors
    }
  }

  /**
   * List metadata of all cached datasets
   */
  public static async listCachedDatasets(): Promise<CacheEntryMetadata[]> {
    if (!this.isSupported()) return [];
    try {
      const db = await this.getDB();
      return await new Promise<CacheEntryMetadata[]>((resolve, reject) => {
        const tx = db.transaction(this.STORE_NAME, "readonly");
        const store = tx.objectStore(this.STORE_NAME);
        const req = store.getAll();
        req.onsuccess = () => {
          const list = (req.result || []).map((r: any) => ({
            id: r.id,
            name: r.name,
            count: r.data?.count || 0,
            sizeBytes: r.sizeBytes || 0,
            timestamp: r.timestamp || 0
          }));
          resolve(list);
        };
        req.onerror = () => reject(req.error);
      });
    } catch {
      return [];
    }
  }

  /**
   * Prune oldest records (LRU/FIFO) to keep total size below quota
   */
  private static async enforceQuota(db: IDBDatabase, incomingBytes: number): Promise<void> {
    const list = await new Promise<any[]>((resolve, reject) => {
      const tx = db.transaction(this.STORE_NAME, "readonly");
      const store = tx.objectStore(this.STORE_NAME);
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });

    let currentTotal = list.reduce((sum, r) => sum + (r.sizeBytes || 0), 0);
    if (currentTotal + incomingBytes <= this.MAX_TOTAL_BYTES) {
      return;
    }

    // Sort by timestamp ascending (oldest first)
    list.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));

    const keysToDelete: string[] = [];
    for (const item of list) {
      if (currentTotal + incomingBytes <= this.MAX_TOTAL_BYTES) break;
      keysToDelete.push(item.id);
      currentTotal -= (item.sizeBytes || 0);
    }

    if (keysToDelete.length > 0) {
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(this.STORE_NAME, "readwrite");
        const store = tx.objectStore(this.STORE_NAME);
        for (const k of keysToDelete) {
          store.delete(k);
        }
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    }
  }
}
