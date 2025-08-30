import { VRM } from '@pixiv/three-vrm';
import * as THREE from 'three';
import { SceneManager, SceneConfig, SceneComponents } from './SceneManager';
import { ResourceLoader } from './ResourceLoader';
import { LipSyncEngine, LipSyncConfig } from '../features/lip-sync/LipSyncEngine';
import { AnimationPlayer } from '../features/animation/AnimationPlayer';
import { ExpressionController } from '../features/expressions/ExpressionController';

export interface VRMManagerConfig extends SceneConfig {
  vrmUrl?: string;
  lipSyncConfig?: LipSyncConfig;
  autoLoad?: boolean;
}

export type VRMEventType = 
  | 'loaded'
  | 'loading'
  | 'error'
  | 'lipSyncStart'
  | 'lipSyncStop'
  | 'lipSyncFrame'
  | 'animationStart'
  | 'animationEnd';

export interface VRMEventData {
  loaded: { vrm: VRM };
  loading: { progress: number };
  error: { error: Error };
  lipSyncStart: void;
  lipSyncStop: void;
  lipSyncFrame: { volume: number; vowel: string };
  animationStart: { name: string };
  animationEnd: { name: string };
}

type EventListener<T extends VRMEventType> = (data: VRMEventData[T]) => void;

export class VRMManager {
  private sceneManager: SceneManager;
  private resourceLoader: ResourceLoader;
  private lipSyncEngine: LipSyncEngine;
  private animationPlayer: AnimationPlayer | null = null;
  private expressionController: ExpressionController | null = null;
  private vrm: VRM | null = null;
  private config: VRMManagerConfig;
  private eventListeners: Map<VRMEventType, Set<EventListener<any>>> = new Map();
  private isDisposed: boolean = false;

  constructor(config: VRMManagerConfig) {
    this.config = config;

    // Initialize scene manager
    this.sceneManager = new SceneManager();
    const sceneComponents = this.sceneManager.setup(config);

    // Initialize resource loader
    this.resourceLoader = new ResourceLoader();

    // Initialize lip sync engine
    this.lipSyncEngine = new LipSyncEngine(config.lipSyncConfig);

    // Start render loop
    this.sceneManager.startRenderLoop((delta) => {
      this.onFrame(delta);
    });

    // Auto-load VRM if URL provided
    if (config.vrmUrl && config.autoLoad !== false) {
      this.loadVRM(config.vrmUrl);
    }
  }

  /**
   * Load a VRM model
   */
  async loadVRM(url: string): Promise<VRM> {
    try {
      this.emit('loading', { progress: 0 });

      // Dispose existing VRM if any
      if (this.vrm) {
        this.disposeVRM();
      }

      // Load new VRM
      const vrm = await this.resourceLoader.loadVRM(url, {
        onProgress: (progress) => {
          this.emit('loading', { progress });
        },
        onError: (error) => {
          this.emit('error', { error });
        },
      });

      // Add to scene
      const sceneComponents = this.sceneManager.getComponents();
      if (sceneComponents) {
        sceneComponents.scene.add(vrm.scene);
      }

      // Store reference
      this.vrm = vrm;

      // Initialize features
      this.initializeFeatures(vrm);

      // Emit loaded event
      this.emit('loaded', { vrm });

      return vrm;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.emit('error', { error: err });
      throw err;
    }
  }

  private initializeFeatures(vrm: VRM): void {
    // Initialize lip sync
    this.lipSyncEngine.setVRM(vrm);

    // Initialize animation player
    this.animationPlayer = new AnimationPlayer(vrm);

    // Initialize expression controller
    this.expressionController = new ExpressionController(vrm);
  }

  private disposeVRM(): void {
    if (!this.vrm) return;

    // Stop any active features
    this.lipSync.stop();
    this.animation?.stop();

    // Remove from scene
    const sceneComponents = this.sceneManager.getComponents();
    if (sceneComponents && this.vrm.scene.parent) {
      sceneComponents.scene.remove(this.vrm.scene);
    }

    // Dispose resources
    this.resourceLoader.disposeVRM(this.vrm);

    this.vrm = null;
    this.animationPlayer = null;
    this.expressionController = null;
  }

  private onFrame(delta: number): void {
    if (!this.vrm) return;

    // Update VRM
    this.vrm.update(delta);

    // Update animation
    this.animationPlayer?.update(delta);

    // Emit lip sync frame events if active
    if (this.lipSyncEngine.isActive()) {
      const status = this.lipSyncEngine.getStatus();
      this.emit('lipSyncFrame', {
        volume: status.currentVolume,
        vowel: status.currentVowel,
      });
    }
  }

  /**
   * Lip sync API
   */
  get lipSync() {
    const self = this;
    return {
      async start(audioElement: HTMLAudioElement): Promise<boolean> {
        if (!self.vrm) {
          console.error('No VRM loaded');
          return false;
        }
        const success = await self.lipSyncEngine.start(audioElement);
        if (success) {
          self.emit('lipSyncStart', undefined);
        }
        return success;
      },

      stop(): void {
        self.lipSyncEngine.stop();
        self.emit('lipSyncStop', undefined);
      },

      updateConfig(config: Partial<LipSyncConfig>): void {
        self.lipSyncEngine.updateConfig(config);
      },

      getStatus() {
        return self.lipSyncEngine.getStatus();
      },

      testVowel(vowel: string, weight?: number): void {
        self.lipSyncEngine.testVowel(vowel, weight);
      },

      async runTestSequence(): Promise<void> {
        return self.lipSyncEngine.runTestSequence();
      },
    };
  }

  /**
   * Animation API
   */
  get animation() {
    const self = this;
    return {
      async loadMixamo(url: string): Promise<void> {
        if (!self.animationPlayer) {
          throw new Error('No VRM loaded');
        }
        await self.animationPlayer.loadMixamoAnimation(url);
      },

      play(name: string, options?: { loop?: boolean; weight?: number }): void {
        if (!self.animationPlayer) {
          console.error('No VRM loaded');
          return;
        }
        self.animationPlayer.play(name, options);
        self.emit('animationStart', { name });
      },

      stop(): void {
        self.animationPlayer?.stop();
        self.emit('animationEnd', { name: '' });
      },

      pause(): void {
        self.animationPlayer?.pause();
      },

      resume(): void {
        self.animationPlayer?.resume();
      },

      setWeight(weight: number): void {
        self.animationPlayer?.setWeight(weight);
      },

      getAvailableAnimations(): string[] {
        return self.animationPlayer?.getAvailableAnimations() ?? [];
      },
    };
  }

  /**
   * Expression API
   */
  get expression() {
    const self = this;
    return {
      set(name: string, weight: number): void {
        self.expressionController?.setExpression(name, weight);
      },

      morph(category: string, name: string, weight: number): void {
        self.expressionController?.setMorphTarget(category, name, weight);
      },

      reset(): void {
        self.expressionController?.reset();
      },

      getAvailable(): string[] {
        return self.expressionController?.getAvailableExpressions() ?? [];
      },
    };
  }

  /**
   * Scene control API
   */
  get scene() {
    const self = this;
    return {
      setBackground(color: number | string): void {
        const components = self.sceneManager.getComponents();
        if (components) {
          components.scene.background = new THREE.Color(color);
        }
      },

      showGrid(visible: boolean): void {
        const components = self.sceneManager.getComponents();
        if (components) {
          components.grid.visible = visible;
        }
      },

      setCameraPosition(x: number, y: number, z: number): void {
        self.sceneManager.setCameraPosition(new THREE.Vector3(x, y, z));
      },

      lookAt(x: number, y: number, z: number): void {
        self.sceneManager.updateControlsTarget(new THREE.Vector3(x, y, z));
      },

      getComponents(): SceneComponents | null {
        return self.sceneManager.getComponents();
      },
    };
  }

  /**
   * Event handling
   */
  on<T extends VRMEventType>(event: T, listener: EventListener<T>): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, new Set());
    }
    this.eventListeners.get(event)!.add(listener);
  }

  off<T extends VRMEventType>(event: T, listener: EventListener<T>): void {
    this.eventListeners.get(event)?.delete(listener);
  }

  private emit<T extends VRMEventType>(event: T, data: VRMEventData[T]): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      listeners.forEach((listener) => listener(data));
    }
  }

  /**
   * Get current VRM instance
   */
  getVRM(): VRM | null {
    return this.vrm;
  }

  /**
   * Check if VRM is loaded
   */
  isLoaded(): boolean {
    return this.vrm !== null;
  }

  /**
   * Dispose of all resources
   */
  dispose(): void {
    if (this.isDisposed) return;

    // Stop all features
    this.lipSync.stop();
    this.animation?.stop();

    // Dispose VRM
    this.disposeVRM();

    // Dispose scene
    this.sceneManager.dispose();

    // Clear event listeners
    this.eventListeners.clear();

    this.isDisposed = true;
  }
}