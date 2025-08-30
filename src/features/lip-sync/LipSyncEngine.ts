import { VRM } from '@pixiv/three-vrm';
import { AudioAnalyzer, AudioAnalysisResult } from './AudioAnalyzer';
import { MorphMapper } from './MorphMapper';

export interface LipSyncConfig {
  sensitivity?: number;
  smoothing?: number;
  minVolume?: number;
  updateInterval?: number;
  customMorphMappings?: any[];
}

export interface LipSyncStatus {
  isActive: boolean;
  currentVolume: number;
  currentVowel: string;
  vowelWeights: Record<string, number>;
}

export class LipSyncEngine {
  private vrm: VRM | null = null;
  private audioAnalyzer: AudioAnalyzer;
  private morphMapper: MorphMapper;
  private config: Required<LipSyncConfig>;
  private animationFrame: number = 0;
  private isRunning: boolean = false;
  private smoothedWeights: Record<string, number> = {
    aa: 0,
    e: 0,
    ih: 0,
    oh: 0,
    ou: 0,
  };
  private lastUpdateTime: number = 0;

  constructor(config: LipSyncConfig = {}) {
    this.config = {
      sensitivity: config.sensitivity ?? 0.7,
      smoothing: config.smoothing ?? 0.8,
      minVolume: config.minVolume ?? 10,
      updateInterval: config.updateInterval ?? 16, // ~60fps
      customMorphMappings: config.customMorphMappings ?? [],
    };

    this.audioAnalyzer = new AudioAnalyzer({
      fftSize: 256,
      smoothingTimeConstant: this.config.smoothing,
    });

    this.morphMapper = new MorphMapper({
      customMappings: this.config.customMorphMappings,
      useVRCMorphs: true,
      useExpressions: true,
    });
  }

  /**
   * Set the VRM model for lip sync
   */
  setVRM(vrm: VRM): void {
    this.vrm = vrm;
    this.morphMapper.setVRM(vrm);
  }

  /**
   * Start lip sync with an audio element
   */
  async start(audioElement: HTMLAudioElement): Promise<boolean> {
    if (!this.vrm) {
      console.error('No VRM model set for lip sync');
      return false;
    }

    if (this.isRunning) {
      this.stop();
    }

    try {
      // Initialize audio analyzer
      await this.audioAnalyzer.initialize(audioElement);

      // Start animation loop
      this.isRunning = true;
      this.animate();

      return true;
    } catch (error) {
      console.error('Failed to start lip sync:', error);
      return false;
    }
  }

  /**
   * Stop lip sync
   */
  stop(): void {
    this.isRunning = false;

    if (this.animationFrame) {
      cancelAnimationFrame(this.animationFrame);
      this.animationFrame = 0;
    }

    // Reset morph targets
    this.morphMapper.reset();

    // Reset smoothed weights
    for (const key in this.smoothedWeights) {
      this.smoothedWeights[key] = 0;
    }

    // Dispose audio analyzer
    this.audioAnalyzer.dispose();
  }

  private animate = (): void => {
    if (!this.isRunning) return;

    this.animationFrame = requestAnimationFrame(this.animate);

    // Throttle updates based on configured interval
    const now = performance.now();
    if (now - this.lastUpdateTime < this.config.updateInterval) {
      return;
    }
    this.lastUpdateTime = now;

    // Analyze audio
    const analysis = this.audioAnalyzer.analyze();
    if (!analysis) return;

    // Process lip sync
    this.processLipSync(analysis);
  };

  private processLipSync(analysis: AudioAnalysisResult): void {
    const { volume, vowelWeights } = analysis;

    // Check minimum volume threshold
    if (volume * 100 < this.config.minVolume) {
      // Gradually close mouth when below threshold
      this.smoothToSilence();
      return;
    }

    // Apply sensitivity scaling
    const scaledVolume = Math.min(1, volume * this.config.sensitivity);

    // Smooth vowel weights
    for (const [vowel, weight] of Object.entries(vowelWeights)) {
      const targetWeight = weight * scaledVolume;
      this.smoothedWeights[vowel] = this.lerp(
        this.smoothedWeights[vowel],
        targetWeight,
        1 - this.config.smoothing
      );
    }

    // Apply to morph targets
    this.morphMapper.applyVowelWeights(this.smoothedWeights);
  }

  private smoothToSilence(): void {
    // Gradually reduce all weights to zero
    for (const vowel in this.smoothedWeights) {
      this.smoothedWeights[vowel] = this.lerp(
        this.smoothedWeights[vowel],
        0,
        1 - this.config.smoothing
      );
    }

    this.morphMapper.applyVowelWeights(this.smoothedWeights);
  }

  private lerp(start: number, end: number, factor: number): number {
    return start + (end - start) * factor;
  }

  /**
   * Get current lip sync status
   */
  getStatus(): LipSyncStatus {
    const currentVolume = Object.values(this.smoothedWeights).reduce((sum, w) => sum + w, 0);
    const dominantVowel = Object.entries(this.smoothedWeights).reduce(
      (max, [vowel, weight]) => (weight > max.weight ? { vowel, weight } : max),
      { vowel: 'sil', weight: 0 }
    ).vowel;

    return {
      isActive: this.isRunning,
      currentVolume,
      currentVowel: dominantVowel,
      vowelWeights: { ...this.smoothedWeights },
    };
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<LipSyncConfig>): void {
    Object.assign(this.config, config);

    // Update audio analyzer if smoothing changed
    if (config.smoothing !== undefined && this.audioAnalyzer) {
      this.audioAnalyzer = new AudioAnalyzer({
        fftSize: 256,
        smoothingTimeConstant: this.config.smoothing,
      });
    }
  }

  /**
   * Test lip sync with manual vowel control
   */
  testVowel(vowel: string, weight: number = 1): void {
    if (!this.vrm) return;

    const weights = {
      aa: 0,
      e: 0,
      ih: 0,
      oh: 0,
      ou: 0,
    };

    if (vowel in weights) {
      weights[vowel as keyof typeof weights] = weight;
    }

    this.morphMapper.applyVowelWeights(weights);
  }

  /**
   * Run automated test sequence
   */
  async runTestSequence(): Promise<void> {
    const vowels = ['aa', 'e', 'ih', 'oh', 'ou'];
    
    for (const vowel of vowels) {
      console.log(`Testing vowel: ${vowel}`);
      
      // Animate from 0 to 1 and back
      for (let i = 0; i <= 20; i++) {
        const weight = i <= 10 ? i / 10 : (20 - i) / 10;
        this.testVowel(vowel, weight);
        await new Promise((resolve) => setTimeout(resolve, 50));
      }
      
      // Reset
      this.morphMapper.reset();
      await new Promise((resolve) => setTimeout(resolve, 200));
    }

    console.log('Test sequence complete');
  }

  /**
   * Check if lip sync is currently active
   */
  isActive(): boolean {
    return this.isRunning;
  }

  /**
   * Get available morph targets for debugging
   */
  getAvailableMorphs(): string[] {
    return this.morphMapper.getAvailableMorphs();
  }
}