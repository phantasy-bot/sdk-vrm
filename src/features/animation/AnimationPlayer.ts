import * as THREE from 'three';
import { VRM } from '@pixiv/three-vrm';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader';
import { resolveHumanoidFromMixamo } from './mixamoRigMap';

export interface AnimationOptions {
  loop?: boolean;
  weight?: number;
  timeScale?: number;
  fadeInDuration?: number;
  fadeOutDuration?: number;
}

export class AnimationPlayer {
  private vrm: VRM;
  private mixer: THREE.AnimationMixer;
  private animations: Map<string, THREE.AnimationClip> = new Map();
  private currentAction: THREE.AnimationAction | null = null;
  private fbxLoader: FBXLoader;
  private isPaused: boolean = false;

  constructor(vrm: VRM) {
    this.vrm = vrm;
    this.mixer = new THREE.AnimationMixer(vrm.scene);
    this.fbxLoader = new FBXLoader();
  }

  /**
   * Load a Mixamo FBX animation
   */
  async loadMixamoAnimation(url: string, name?: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.fbxLoader.load(
        url,
        (fbx) => {
          // Extract animation clips
          const clips = fbx.animations;
          if (clips.length === 0) {
            reject(new Error('No animations found in FBX file'));
            return;
          }

          // Process and store animations
          clips.forEach((clip, index) => {
            const clipName = name || clip.name || `animation_${index}`;

            // Retarget animation to VRM bones
            const retargetedClip = this.retargetAnimation(clip);
            this.animations.set(clipName, retargetedClip);
          });

          resolve();
        },
        undefined,
        (error) => {
          reject(new Error(`Failed to load FBX: ${error}`));
        }
      );
    });
  }

  /**
   * Retarget Mixamo animation to VRM bones
   */
  private retargetAnimation(clip: THREE.AnimationClip): THREE.AnimationClip {
    // Clone the clip and update track names to target the actual VRM nodes
    const tracks: THREE.KeyframeTrack[] = [];

    clip.tracks.forEach((track) => {
      // Extract bone name from track name
      const parts = track.name.split('.');
      const boneName = parts[0];
      const property = parts.slice(1).join('.');

      // Resolve humanoid bone name from Mixamo naming
      const humanoidName = resolveHumanoidFromMixamo(boneName);
      let targetNodeName: string | null = null;

      if (humanoidName) {
        const anyHumanoid = (this.vrm as any).humanoid;
        try {
          // Prefer normalized node names if available (three-vrm v3)
          if (anyHumanoid?.getNormalizedBoneNode) {
            const node = anyHumanoid.getNormalizedBoneNode(humanoidName);
            targetNodeName = node?.name || null;
          }
          if (!targetNodeName && anyHumanoid?.getBoneNode) {
            const node = anyHumanoid.getBoneNode(humanoidName);
            targetNodeName = node?.name || null;
          }
        } catch {}

        // As a fallback, scan scene graph heuristically
        if (!targetNodeName) {
          const regex = new RegExp(humanoidName, 'i');
          (this.vrm.scene as any).traverse?.((obj: any) => {
            if (!targetNodeName && obj?.name && regex.test(obj.name)) {
              targetNodeName = obj.name;
            }
          });
        }
      }

      // If we couldn't resolve a target node, skip this track to avoid spam
      if (!targetNodeName) {
        return;
      }

      // Create new track with the resolved VRM node name
      const newTrackName = `${targetNodeName}.${property}`;

      if (track instanceof THREE.QuaternionKeyframeTrack) {
        tracks.push(new THREE.QuaternionKeyframeTrack(newTrackName, track.times, track.values));
      } else if (track instanceof THREE.VectorKeyframeTrack) {
        tracks.push(new THREE.VectorKeyframeTrack(newTrackName, track.times, track.values));
      } else if (track instanceof THREE.NumberKeyframeTrack) {
        tracks.push(new THREE.NumberKeyframeTrack(newTrackName, track.times, track.values));
      }
    });

    return new THREE.AnimationClip(clip.name, clip.duration, tracks);
  }

  /**
   * Load a preset animation
   */
  loadPresetAnimation(name: string, clip: THREE.AnimationClip): void {
    this.animations.set(name, clip);
  }

  /**
   * Play an animation
   */
  play(name: string, options: AnimationOptions = {}): void {
    const clip = this.animations.get(name);
    if (!clip) {
      console.error(`Animation "${name}" not found`);
      return;
    }

    // Stop current animation with fade out
    if (this.currentAction) {
      if (options.fadeOutDuration) {
        this.currentAction.fadeOut(options.fadeOutDuration);
      } else {
        this.currentAction.stop();
      }
    }

    // Create new action
    this.currentAction = this.mixer.clipAction(clip);

    // Configure action
    if (options.loop !== undefined) {
      this.currentAction.loop = options.loop ? THREE.LoopRepeat : THREE.LoopOnce;
    }

    if (options.weight !== undefined) {
      this.currentAction.weight = options.weight;
    }

    if (options.timeScale !== undefined) {
      this.currentAction.timeScale = options.timeScale;
    }

    // Start with fade in
    if (options.fadeInDuration) {
      this.currentAction.fadeIn(options.fadeInDuration);
    }

    this.currentAction.play();
    this.isPaused = false;
  }

  /**
   * Stop current animation
   */
  stop(): void {
    if (this.currentAction) {
      this.currentAction.stop();
      this.currentAction = null;
    }
    this.isPaused = false;
  }

  /**
   * Pause current animation
   */
  pause(): void {
    if (this.currentAction && !this.isPaused) {
      this.currentAction.paused = true;
      this.isPaused = true;
    }
  }

  /**
   * Resume current animation
   */
  resume(): void {
    if (this.currentAction && this.isPaused) {
      this.currentAction.paused = false;
      this.isPaused = false;
    }
  }

  /**
   * Set animation weight (for blending)
   */
  setWeight(weight: number): void {
    if (this.currentAction) {
      this.currentAction.weight = Math.max(0, Math.min(1, weight));
    }
  }

  /**
   * Update animation mixer
   */
  update(delta: number): void {
    this.mixer.update(delta);
  }

  /**
   * Get available animation names
   */
  getAvailableAnimations(): string[] {
    return Array.from(this.animations.keys());
  }

  /**
   * Check if animation is playing
   */
  isPlaying(): boolean {
    return this.currentAction !== null && !this.isPaused;
  }

  /**
   * Create preset idle animation
   */
  createIdleAnimation(): THREE.AnimationClip {
    const times = [0, 1, 2];
    const values = [
      0,
      0,
      0, // Start position
      0,
      0.02,
      0, // Slight up
      0,
      0,
      0, // Back to start
    ];

    const positionTrack = new THREE.VectorKeyframeTrack('hips.position', times, values);

    return new THREE.AnimationClip('idle', 2, [positionTrack]);
  }

  /**
   * Create preset wave animation
   */
  createWaveAnimation(): THREE.AnimationClip {
    const times = [0, 0.5, 1, 1.5];
    const values = new Float32Array([
      // Quaternion values for waving motion
      0,
      0,
      0,
      1, // Start
      0,
      0,
      -0.3,
      0.95, // Wave left
      0,
      0,
      0.3,
      0.95, // Wave right
      0,
      0,
      0,
      1, // End
    ]);

    const rotationTrack = new THREE.QuaternionKeyframeTrack(
      'rightUpperArm.quaternion',
      times,
      values
    );

    return new THREE.AnimationClip('wave', 1.5, [rotationTrack]);
  }
}
