// Polyfills and test environment setup

if (typeof URL.createObjectURL === "undefined") {
  URL.createObjectURL = () => "blob:mock-url-" + Math.random().toString(36).substring(2);
}

if (typeof URL.revokeObjectURL === "undefined") {
  URL.revokeObjectURL = () => {};
}

// Stub Canvas 2D and WebGL Contexts for jsdom
const originalGetContext = HTMLCanvasElement.prototype.getContext;
HTMLCanvasElement.prototype.getContext = function (contextType: string, ...args: any[]): any {
  if (contextType === "2d") {
    return {
      canvas: this,
      fillStyle: "#000",
      strokeStyle: "#000",
      lineWidth: 1,
      fillRect: () => {},
      clearRect: () => {},
      beginPath: () => {},
      moveTo: () => {},
      lineTo: () => {},
      stroke: () => {},
      fill: () => {},
      arc: () => {},
      fillText: () => {},
      strokeText: () => {},
      measureText: (text: string) => ({ width: text.length * 6 }),
      drawImage: () => {},
      setLineDash: () => {},
      save: () => {},
      restore: () => {},
      scale: () => {},
      translate: () => {},
      rotate: () => {}
    };
  }

  if (contextType === "webgl" || contextType === "webgl2") {
    return {
      canvas: this,
      getExtension: () => null,
      getParameter: () => 0,
      createTexture: () => ({}),
      bindTexture: () => {},
      texParameteri: () => {},
      texImage2D: () => {},
      createShader: () => ({}),
      shaderSource: () => {},
      compileShader: () => {},
      getShaderParameter: () => true,
      createProgram: () => ({}),
      attachShader: () => {},
      linkProgram: () => {},
      getProgramParameter: () => true,
      useProgram: () => {},
      createBuffer: () => ({}),
      bindBuffer: () => {},
      bufferData: () => {},
      enable: () => {},
      disable: () => {},
      blendFunc: () => {},
      viewport: () => {},
      clearColor: () => {},
      clear: () => {}
    };
  }

  return originalGetContext ? originalGetContext.apply(this, [contextType, ...args] as any) : null;
};

// Mock toDataURL for snapshot tests
if (!HTMLCanvasElement.prototype.toDataURL) {
  HTMLCanvasElement.prototype.toDataURL = () => "data:image/png;base64,mock";
}
