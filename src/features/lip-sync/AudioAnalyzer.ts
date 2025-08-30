export interface AudioAnalyzerConfig {
  fftSize?: number;
  smoothingTimeConstant?: number;
  minDecibels?: number;
  maxDecibels?: number;
}

export interface AudioAnalysisResult {
  volume: number;
  frequencies: Float32Array;
  dominantFrequency: number;
  vowelWeights: {
    aa: number;
    e: number;
    ih: number;
    oh: number;
    ou: number;
  };
}

export class AudioAnalyzer {
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private source: MediaElementAudioSourceNode | null = null;
  private dataArray: Float32Array | null = null;
  private config: Required<AudioAnalyzerConfig>;

  constructor(config: AudioAnalyzerConfig = {}) {
    this.config = {
      fftSize: config.fftSize ?? 256,
      smoothingTimeConstant: config.smoothingTimeConstant ?? 0.8,
      minDecibels: config.minDecibels ?? -90,
      maxDecibels: config.maxDecibels ?? -10,
    };
  }

  async initialize(audioElement: HTMLAudioElement): Promise<void> {
    // Create or reuse audio context
    if (!this.audioContext) {
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    }

    // Resume context if suspended
    if (this.audioContext.state === 'suspended') {
      await this.audioContext.resume();
    }

    // Create analyser node
    this.analyser = this.audioContext.createAnalyser();
    this.analyser.fftSize = this.config.fftSize;
    this.analyser.smoothingTimeConstant = this.config.smoothingTimeConstant;
    this.analyser.minDecibels = this.config.minDecibels;
    this.analyser.maxDecibels = this.config.maxDecibels;

    // Create source from audio element (reuse if same element)
    if (!this.source || (this.source.mediaElement !== audioElement)) {
      if (this.source) {
        this.source.disconnect();
      }
      this.source = this.audioContext.createMediaElementSource(audioElement);
    }

    // Connect nodes
    this.source.connect(this.analyser);
    this.source.connect(this.audioContext.destination);

    // Initialize data array
    const bufferLength = this.analyser.frequencyBinCount;
    this.dataArray = new Float32Array(bufferLength);
  }

  analyze(): AudioAnalysisResult | null {
    if (!this.analyser || !this.dataArray) {
      return null;
    }

    // Get frequency data
    this.analyser.getFloatFrequencyData(this.dataArray);

    // Calculate volume (RMS of frequency data)
    let sum = 0;
    let count = 0;
    for (let i = 0; i < this.dataArray.length; i++) {
      if (this.dataArray[i] > this.config.minDecibels) {
        const normalized = (this.dataArray[i] - this.config.minDecibels) / 
                          (this.config.maxDecibels - this.config.minDecibels);
        sum += normalized * normalized;
        count++;
      }
    }
    const volume = count > 0 ? Math.sqrt(sum / count) : 0;

    // Find dominant frequency
    let maxValue = -Infinity;
    let maxIndex = 0;
    for (let i = 0; i < this.dataArray.length; i++) {
      if (this.dataArray[i] > maxValue) {
        maxValue = this.dataArray[i];
        maxIndex = i;
      }
    }

    const nyquist = this.audioContext!.sampleRate / 2;
    const dominantFrequency = (maxIndex / this.dataArray.length) * nyquist;

    // Calculate vowel weights based on formant frequencies
    const vowelWeights = this.calculateVowelWeights(dominantFrequency, this.dataArray);

    return {
      volume,
      frequencies: this.dataArray,
      dominantFrequency,
      vowelWeights,
    };
  }

  private calculateVowelWeights(
    dominantFreq: number, 
    frequencies: Float32Array
  ): AudioAnalysisResult['vowelWeights'] {
    // Simplified vowel formant mapping
    // These are approximate formant frequencies for vowels
    const vowelFormants = {
      aa: { f1: 700, f2: 1220 },  // "ah"
      e: { f1: 530, f2: 1840 },   // "eh"
      ih: { f1: 390, f2: 1990 },  // "ee"
      oh: { f1: 570, f2: 840 },   // "oh"
      ou: { f1: 370, f2: 950 },   // "oo"
    };

    const weights = {
      aa: 0,
      e: 0,
      ih: 0,
      oh: 0,
      ou: 0,
    };

    // Calculate proximity to each vowel's formants
    for (const [vowel, formants] of Object.entries(vowelFormants)) {
      const f1Diff = Math.abs(dominantFreq - formants.f1);
      const f2Diff = Math.abs(dominantFreq - formants.f2);
      
      // Weight based on proximity (closer = higher weight)
      const proximity = 1 / (1 + (f1Diff + f2Diff) / 1000);
      weights[vowel as keyof typeof weights] = proximity;
    }

    // Normalize weights
    const total = Object.values(weights).reduce((sum, w) => sum + w, 0);
    if (total > 0) {
      for (const vowel in weights) {
        weights[vowel as keyof typeof weights] /= total;
      }
    }

    return weights;
  }

  getAudioContext(): AudioContext | null {
    return this.audioContext;
  }

  getAnalyser(): AnalyserNode | null {
    return this.analyser;
  }

  dispose(): void {
    if (this.source) {
      this.source.disconnect();
      this.source = null;
    }

    if (this.analyser) {
      this.analyser.disconnect();
      this.analyser = null;
    }

    if (this.audioContext && this.audioContext.state !== 'closed') {
      this.audioContext.close();
      this.audioContext = null;
    }

    this.dataArray = null;
  }

  isInitialized(): boolean {
    return !!(this.audioContext && this.analyser && this.source);
  }
}