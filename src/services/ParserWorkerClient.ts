import { ParseResult } from "../types";

export class ParserWorkerClient {
  private worker: Worker;

  constructor(
    onProgress: (percent: number, statusText: string) => void,
    onError: (err: string) => void,
    onSuccess: (result: ParseResult) => void
  ) {
    this.worker = new Worker(new URL("../parser.worker.ts", import.meta.url));

    this.worker.onmessage = (e: MessageEvent<any>) => {
      const msg = e.data;
      if (msg.type === "progress") {
        onProgress(msg.percent, msg.statusText);
      } else if (msg.error || !msg.data) {
        onError(msg.error || "Failed to parse points data");
      } else {
        onSuccess(msg.data);
      }
    };

    this.worker.onerror = (err: ErrorEvent) => {
      onError(err.message || "Failed to process file in background worker");
      console.error("Worker error:", err);
    };
  }

  public parseFile(file: File | Blob, maxPoints: number): void {
    this.worker.postMessage({ type: "parse-file", file, maxPoints });
  }

  public parseBuffer(buffer: ArrayBuffer, maxPoints: number): void {
    // Transfer a slice of the ArrayBuffer so the original remains intact
    const bufferCopy = buffer.slice(0);
    this.worker.postMessage(
      { type: "parse-buffer", buffer: bufferCopy, maxPoints },
      [bufferCopy]
    );
  }

  public parseText(text: string, maxPoints: number): void {
    this.worker.postMessage({ type: "parse-text", text, maxPoints });
  }

  public generateProcedural(id: string, maxPoints: number): void {
    this.worker.postMessage({ type: "generate-procedural", id, maxPoints });
  }
}
