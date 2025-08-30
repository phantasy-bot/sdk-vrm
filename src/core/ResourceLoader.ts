import * as THREE from 'three';
import { VRM, VRMLoaderPlugin } from '@pixiv/three-vrm';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader';

export interface LoadingOptions {
  onProgress?: (progress: number) => void;
  onError?: (error: Error) => void;
}

export class ResourceLoader {
  private gltfLoader: GLTFLoader;
  private fbxLoader: FBXLoader;
  private textureLoader: THREE.TextureLoader;
  private loadedResources: Map<string, any> = new Map();

  constructor() {
    this.gltfLoader = new GLTFLoader();
    this.gltfLoader.register((parser) => new VRMLoaderPlugin(parser));
    this.fbxLoader = new FBXLoader();
    this.textureLoader = new THREE.TextureLoader();
  }

  async loadVRM(url: string, options?: LoadingOptions): Promise<VRM> {
    // Check cache
    if (this.loadedResources.has(url)) {
      const cached = this.loadedResources.get(url);
      if (cached instanceof VRM) {
        return cached;
      }
    }

    return new Promise((resolve, reject) => {
      this.gltfLoader.load(
        url,
        (gltf) => {
          const vrm = gltf.userData.vrm as VRM;
          if (!vrm) {
            reject(new Error('Failed to load VRM from GLTF'));
            return;
          }

          // Setup VRM
          this.setupVRM(vrm);

          // Cache the resource
          this.loadedResources.set(url, vrm);

          resolve(vrm);
        },
        (progress) => {
          const percent = (progress.loaded / progress.total) * 100;
          options?.onProgress?.(Math.round(percent));
        },
        (error) => {
          const err = new Error(`Failed to load VRM: ${error}`);
          options?.onError?.(err);
          reject(err);
        }
      );
    });
  }

  private setupVRM(vrm: VRM): void {
    // Enable shadows
    vrm.scene.traverse((object) => {
      if ((object as THREE.Mesh).isMesh) {
        const mesh = object as THREE.Mesh;
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        mesh.frustumCulled = false;
      }
    });

    // Ensure VRM updates are enabled
    vrm.scene.updateMatrixWorld(true);
  }

  async loadFBX(url: string, options?: LoadingOptions): Promise<THREE.Group> {
    // Check cache
    if (this.loadedResources.has(url)) {
      const cached = this.loadedResources.get(url);
      if (cached instanceof THREE.Group) {
        return cached.clone();
      }
    }

    return new Promise((resolve, reject) => {
      this.fbxLoader.load(
        url,
        (fbx) => {
          // Cache the resource
          this.loadedResources.set(url, fbx);
          resolve(fbx);
        },
        (progress) => {
          const percent = (progress.loaded / progress.total) * 100;
          options?.onProgress?.(Math.round(percent));
        },
        (error) => {
          const err = new Error(`Failed to load FBX: ${error}`);
          options?.onError?.(err);
          reject(err);
        }
      );
    });
  }

  async loadTexture(url: string): Promise<THREE.Texture> {
    // Check cache
    if (this.loadedResources.has(url)) {
      const cached = this.loadedResources.get(url);
      if (cached instanceof THREE.Texture) {
        return cached;
      }
    }

    return new Promise((resolve, reject) => {
      this.textureLoader.load(
        url,
        (texture) => {
          // Cache the resource
          this.loadedResources.set(url, texture);
          resolve(texture);
        },
        undefined,
        (error) => {
          reject(new Error(`Failed to load texture: ${error}`));
        }
      );
    });
  }

  /**
   * Load VRM from URL with CORS proxy support for development
   */
  async loadVRMWithProxy(url: string, options?: LoadingOptions): Promise<VRM> {
    // Use CORS proxy in development
    const isDevelopment = typeof window !== 'undefined' && window.location.hostname === 'localhost';
    const proxyUrl = isDevelopment ? `https://corsproxy.io/?${encodeURIComponent(url)}` : url;

    return this.loadVRM(proxyUrl, options);
  }

  /**
   * Clear cached resources
   */
  clearCache(url?: string): void {
    if (url) {
      this.loadedResources.delete(url);
    } else {
      this.loadedResources.clear();
    }
  }

  /**
   * Dispose of a VRM model
   */
  disposeVRM(vrm: VRM): void {
    // Dispose of VRM resources
    vrm.scene.traverse((object) => {
      if ((object as THREE.Mesh).isMesh) {
        const mesh = object as THREE.Mesh;
        mesh.geometry?.dispose();

        if (Array.isArray(mesh.material)) {
          mesh.material.forEach((material) => material.dispose());
        } else if (mesh.material) {
          mesh.material.dispose();
        }
      }
    });

    // Remove from scene parent if exists
    if (vrm.scene.parent) {
      vrm.scene.parent.remove(vrm.scene);
    }
  }

  /**
   * Get all cached resources
   */
  getCachedResources(): Map<string, any> {
    return new Map(this.loadedResources);
  }
}
