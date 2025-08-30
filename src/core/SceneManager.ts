import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';

export interface SceneConfig {
  container: HTMLElement;
  enableGrid?: boolean;
  enableControls?: boolean;
  enableAutoRotate?: boolean;
  backgroundColor?: number;
  cameraPosition?: [number, number, number];
  lightIntensity?: number;
}

export interface SceneComponents {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
  controls: OrbitControls;
  grid: THREE.GridHelper;
  lights: {
    ambient: THREE.AmbientLight;
    directional: THREE.DirectionalLight;
  };
}

export class SceneManager {
  private components: SceneComponents | null = null;
  private animationId: number = 0;
  private clock = new THREE.Clock();

  setup(config: SceneConfig): SceneComponents {
    const {
      container,
      enableGrid = true,
      enableControls = true,
      enableAutoRotate = false,
      backgroundColor = 0x1a1a1a,
      cameraPosition = [0, 1.5, 3],
      lightIntensity = 1,
    } = config;

    // Create scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(backgroundColor);

    // Create camera
    const camera = new THREE.PerspectiveCamera(
      75,
      container.clientWidth / container.clientHeight,
      0.1,
      100
    );
    camera.position.set(...cameraPosition);

    // Create renderer
    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
    });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(renderer.domElement);

    // Create controls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enabled = enableControls;
    controls.autoRotate = enableAutoRotate;
    controls.autoRotateSpeed = 2.0;
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.screenSpacePanning = false;
    controls.minDistance = 1;
    controls.maxDistance = 10;
    controls.target.set(0, 1.0, 0);
    controls.update();

    // Create grid
    const grid = new THREE.GridHelper(10, 10, 0x444444, 0x222222);
    grid.visible = enableGrid;
    scene.add(grid);

    // Create lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6 * lightIntensity);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8 * lightIntensity);
    directionalLight.position.set(1, 2, 1);
    directionalLight.castShadow = true;
    directionalLight.shadow.mapSize.width = 2048;
    directionalLight.shadow.mapSize.height = 2048;
    directionalLight.shadow.camera.near = 0.5;
    directionalLight.shadow.camera.far = 10;
    directionalLight.shadow.camera.left = -2;
    directionalLight.shadow.camera.right = 2;
    directionalLight.shadow.camera.top = 2;
    directionalLight.shadow.camera.bottom = -2;
    scene.add(directionalLight);

    this.components = {
      scene,
      camera,
      renderer,
      controls,
      grid,
      lights: {
        ambient: ambientLight,
        directional: directionalLight,
      },
    };

    // Handle resize
    this.setupResizeHandler(container);

    return this.components;
  }

  private setupResizeHandler(container: HTMLElement): void {
    const handleResize = () => {
      if (!this.components) return;

      const { camera, renderer } = this.components;
      const width = container.clientWidth;
      const height = container.clientHeight;

      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
    };

    window.addEventListener('resize', handleResize);
  }

  startRenderLoop(onFrame?: (delta: number) => void): void {
    if (!this.components) return;

    const animate = () => {
      this.animationId = requestAnimationFrame(animate);

      const delta = this.clock.getDelta();

      // Update controls
      this.components!.controls.update();

      // Call custom frame handler
      onFrame?.(delta);

      // Render
      this.components!.renderer.render(this.components!.scene, this.components!.camera);
    };

    animate();
  }

  stopRenderLoop(): void {
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
      this.animationId = 0;
    }
  }

  dispose(): void {
    this.stopRenderLoop();

    if (!this.components) return;

    const { scene, renderer, controls, grid } = this.components;

    // Dispose controls
    controls.dispose();

    // Dispose grid
    if (grid.geometry) grid.geometry.dispose();
    if ((grid.material as THREE.Material).dispose) {
      (grid.material as THREE.Material).dispose();
    }

    // Dispose renderer
    renderer.dispose();
    if (renderer.domElement.parentElement) {
      renderer.domElement.parentElement.removeChild(renderer.domElement);
    }

    // Clear scene
    scene.clear();

    this.components = null;
  }

  getComponents(): SceneComponents | null {
    return this.components;
  }

  updateControlsTarget(target: THREE.Vector3): void {
    if (this.components?.controls) {
      this.components.controls.target.copy(target);
      this.components.controls.update();
    }
  }

  setCameraPosition(position: THREE.Vector3): void {
    if (this.components?.camera) {
      this.components.camera.position.copy(position);
    }
  }
}
