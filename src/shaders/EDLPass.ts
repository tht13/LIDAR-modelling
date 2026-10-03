import * as THREE from "three";

export class EDLPass {
  public enabled: boolean = true;
  public strength: number = 1.4;
  public radius: number = 1.8;

  private renderTarget: THREE.WebGLRenderTarget;
  private postScene: THREE.Scene;
  private postCamera: THREE.OrthographicCamera;
  private quadMesh: THREE.Mesh;
  private material: THREE.ShaderMaterial;

  constructor(width: number, height: number) {
    // WebGL RenderTarget with DepthTexture
    const depthTexture = new THREE.DepthTexture(width, height);
    depthTexture.type = THREE.UnsignedIntType;
    depthTexture.minFilter = THREE.NearestFilter;
    depthTexture.magFilter = THREE.NearestFilter;

    this.renderTarget = new THREE.WebGLRenderTarget(width, height, {
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      format: THREE.RGBAFormat,
      depthTexture: depthTexture,
      depthBuffer: true
    });

    this.postScene = new THREE.Scene();
    this.postCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

    const vertexShader = `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = vec4(position, 1.0);
      }
    `;

    const fragmentShader = `
      uniform sampler2D tColor;
      uniform sampler2D tDepth;
      uniform vec2 uResolution;
      uniform float uEDLStrength;
      uniform float uEDLRadius;
      uniform float cameraNear;
      uniform float cameraFar;
      uniform bool isOrtho;
      varying vec2 vUv;

      float readLinearDepth(vec2 coord) {
        float depth = texture2D(tDepth, coord).r;
        if (depth >= 1.0) return cameraFar;
        if (isOrtho) {
          return cameraNear + depth * (cameraFar - cameraNear);
        } else {
          return (2.0 * cameraNear * cameraFar) / (cameraFar + cameraNear - (depth * 2.0 - 1.0) * (cameraFar - cameraNear));
        }
      }

      void main() {
        vec4 color = texture2D(tColor, vUv);
        float depth = texture2D(tDepth, vUv).r;

        // Skip background
        if (depth >= 1.0) {
          gl_FragColor = color;
          return;
        }

        float d0 = readLinearDepth(vUv);
        float logD0 = log2(max(0.1, d0));

        vec2 texel = uEDLRadius / uResolution;
        vec2 offsets[8];
        offsets[0] = vec2( 1.0,  0.0);
        offsets[1] = vec2(-1.0,  0.0);
        offsets[2] = vec2( 0.0,  1.0);
        offsets[3] = vec2( 0.0, -1.0);
        offsets[4] = vec2( 0.707,  0.707);
        offsets[5] = vec2(-0.707, -0.707);
        offsets[6] = vec2( 0.707, -0.707);
        offsets[7] = vec2(-0.707,  0.707);

        float response = 0.0;
        for (int i = 0; i < 8; i++) {
          vec2 sampleCoord = vUv + offsets[i] * texel;
          float dSample = readLinearDepth(sampleCoord);
          float logDSample = log2(max(0.1, dSample));
          response += max(0.0, logD0 - logDSample);
        }

        float edlFactor = exp(-response * uEDLStrength * 40.0);
        edlFactor = clamp(edlFactor, 0.2, 1.0);

        gl_FragColor = vec4(color.rgb * edlFactor, color.a);
      }
    `;

    this.material = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms: {
        tColor: { value: null },
        tDepth: { value: null },
        uResolution: { value: new THREE.Vector2(width, height) },
        uEDLStrength: { value: this.strength },
        uEDLRadius: { value: this.radius },
        cameraNear: { value: 0.1 },
        cameraFar: { value: 50000.0 },
        isOrtho: { value: false }
      },
      depthTest: false,
      depthWrite: false
    });

    const quadGeo = new THREE.PlaneGeometry(2, 2);
    this.quadMesh = new THREE.Mesh(quadGeo, this.material);
    this.postScene.add(this.quadMesh);
  }

  public setSize(width: number, height: number): void {
    this.renderTarget.setSize(width, height);
    this.material.uniforms.uResolution.value.set(width, height);
  }

  public setStrength(strength: number): void {
    this.strength = strength;
    this.material.uniforms.uEDLStrength.value = strength;
  }

  public setRadius(radius: number): void {
    this.radius = radius;
    this.material.uniforms.uEDLRadius.value = radius;
  }

  public render(renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.Camera): void {
    if (!this.enabled) {
      renderer.setRenderTarget(null);
      renderer.render(scene, camera);
      return;
    }

    // 1. Render scene to offscreen target with depth buffer
    renderer.setRenderTarget(this.renderTarget);
    renderer.render(scene, camera);

    // 2. Configure shader uniforms
    const isOrtho = camera instanceof THREE.OrthographicCamera;
    const near = (camera as THREE.PerspectiveCamera).near || 0.1;
    const far = (camera as THREE.PerspectiveCamera).far || 50000.0;

    this.material.uniforms.tColor.value = this.renderTarget.texture;
    this.material.uniforms.tDepth.value = this.renderTarget.depthTexture;
    this.material.uniforms.isOrtho.value = isOrtho;
    this.material.uniforms.cameraNear.value = near;
    this.material.uniforms.cameraFar.value = far;

    // 3. Render EDL post-processed quad to screen
    renderer.setRenderTarget(null);
    renderer.render(this.postScene, this.postCamera);
  }

  public dispose(): void {
    this.renderTarget.dispose();
    this.material.dispose();
    this.quadMesh.geometry.dispose();
  }
}
