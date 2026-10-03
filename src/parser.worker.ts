import { ParseResult } from "./types";
import { LASParser } from "./services/LASParser";
import { GeoTIFFParser } from "./services/GeoTIFFParser";
import { TextParser } from "./services/TextParser";

const ctx: DedicatedWorkerGlobalScope = self as any;

ctx.onmessage = async (event: MessageEvent<any>) => {
  const payload = event.data;
  let result: ParseResult | null = null;
  const maxPoints: number = (typeof payload === "object" && payload && typeof payload.maxPoints === "number")
    ? payload.maxPoints
    : 5_000_000;

  const postProgress = (percent: number, statusText: string) => {
    ctx.postMessage({ type: "progress", percent, statusText });
  };

  try {
    // 1. File or Blob payload (Streaming chunk-by-chunk with zero whole-file memory allocation)
    if (payload instanceof Blob || (payload && payload.file instanceof Blob)) {
      const file: Blob = payload instanceof Blob ? payload : payload.file;
      postProgress(10, "Inspecting file format...");

      // Probe first 1KB to identify signature
      const probeBuf = await file.slice(0, Math.min(file.size, 1024)).arrayBuffer();
      if (LASParser.isLAS(probeBuf)) {
        result = await LASParser.streamParse(file, maxPoints, postProgress);
      } else if (GeoTIFFParser.isTIFF(probeBuf)) {
        result = await GeoTIFFParser.parse(file, maxPoints, postProgress);
      } else {
        result = await TextParser.streamParse(file, maxPoints, postProgress);
      }
    }
    // 2. ArrayBuffer payload
    else if (payload instanceof ArrayBuffer || (payload && payload.buffer instanceof ArrayBuffer)) {
      const buffer: ArrayBuffer = payload instanceof ArrayBuffer ? payload : payload.buffer;
      if (LASParser.isLAS(buffer)) {
        postProgress(30, "Parsing binary LAS...");
        result = LASParser.parse(buffer, maxPoints);
      } else if (GeoTIFFParser.isTIFF(buffer)) {
        result = await GeoTIFFParser.parse(buffer, maxPoints, postProgress);
      } else {
        postProgress(30, "Decoding point text...");
        const text = new TextDecoder().decode(buffer);
        result = TextParser.parse(text, maxPoints);
      }
    }
    // 3. String payload
    else if (typeof payload === "string" || (payload && typeof payload.text === "string")) {
      const text: string = typeof payload === "string" ? payload : payload.text;
      postProgress(30, "Parsing points...");
      result = TextParser.parse(text, maxPoints);
    }
    // 4. Procedural Generation
    else if (payload && payload.type === "generate-procedural") {
      postProgress(10, "Generating procedural point cloud...");
      // Dynamic import to avoid loading generator code unless needed
      const { ProceduralGenerator } = await import("./services/ProceduralGenerator");
      result = ProceduralGenerator.generate(payload.id, postProgress);
    }
  } catch (err: any) {
    ctx.postMessage({ error: err?.message || "Failed to parse point cloud" });
    return;
  }

  if (!result || result.count === 0) {
    ctx.postMessage({ error: "No valid point coordinates found in file" });
    return;
  }

  postProgress(100, "Rendering point cloud...");

  // Transfer ArrayBuffers with zero-copy transfer
  ctx.postMessage(
    {
      type: "done",
      success: true,
      data: result
    },
    [result.positions.buffer, result.colors.buffer, result.elevations.buffer]
  );
};
