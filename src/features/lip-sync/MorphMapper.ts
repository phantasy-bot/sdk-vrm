import { VRM } from '@pixiv/three-vrm';
import * as THREE from 'three';

export interface MorphMapping {
  vowel: string;
  morphNames: string[];
  weight: number;
}

export interface MorphMapperConfig {
  customMappings?: MorphMapping[];
  useVRCMorphs?: boolean;
  useExpressions?: boolean;
}

export class MorphMapper {
  private vrm: VRM | null = null;
  private config: Required<MorphMapperConfig>;
  private morphTargetMap: Map<string, { mesh: THREE.SkinnedMesh; index: number }[]> = new Map();
  
  // Standard VRC vowel morphs
  private readonly vrcVowelMorphs = ['vrc.v_aa', 'vrc.v_e', 'vrc.v_ih', 'vrc.v_oh', 'vrc.v_ou'];
  
  // Alternative mouth morph patterns
  private readonly alternativeMorphPatterns = [
    'mouth', 'lip', 'jaw', 'teeth', 'tongue',
    'aa', 'ah', 'ch', 'dd', 'e', 'ee', 'ff', 'ih', 'kk', 
    'nn', 'oh', 'ou', 'pp', 'rr', 'sil', 'ss', 'th'
  ];

  constructor(config: MorphMapperConfig = {}) {
    this.config = {
      customMappings: config.customMappings ?? [],
      useVRCMorphs: config.useVRCMorphs ?? true,
      useExpressions: config.useExpressions ?? true,
    };
  }

  setVRM(vrm: VRM): void {
    this.vrm = vrm;
    this.buildMorphTargetMap();
  }

  private buildMorphTargetMap(): void {
    if (!this.vrm) return;

    this.morphTargetMap.clear();

    // Traverse VRM scene to find all morph targets
    this.vrm.scene.traverse((object) => {
      if ((object as THREE.SkinnedMesh).isSkinnedMesh) {
        const mesh = object as THREE.SkinnedMesh;
        
        if (mesh.morphTargetDictionary && mesh.morphTargetInfluences) {
          for (const [morphName, index] of Object.entries(mesh.morphTargetDictionary)) {
            if (!this.morphTargetMap.has(morphName)) {
              this.morphTargetMap.set(morphName, []);
            }
            this.morphTargetMap.get(morphName)!.push({ mesh, index });
          }
        }
      }
    });
  }

  /**
   * Apply vowel weights to morph targets
   */
  applyVowelWeights(vowelWeights: Record<string, number>): void {
    if (!this.vrm) return;

    // Try VRC morphs first
    if (this.config.useVRCMorphs) {
      const vrcMorphsApplied = this.applyVRCMorphs(vowelWeights);
      if (vrcMorphsApplied) {
        this.vrm.update(0.016); // Update at 60fps
        return;
      }
    }

    // Try expressions if available
    if (this.config.useExpressions && this.vrm.expressionManager) {
      this.applyExpressions(vowelWeights);
      this.vrm.update(0.016);
      return;
    }

    // Fallback to custom mappings or alternative morphs
    this.applyAlternativeMorphs(vowelWeights);
    this.vrm.update(0.016);
  }

  private applyVRCMorphs(vowelWeights: Record<string, number>): boolean {
    let applied = false;

    // Map vowel weights to VRC morph names
    const vrcMapping: Record<string, string> = {
      aa: 'vrc.v_aa',
      e: 'vrc.v_e',
      ih: 'vrc.v_ih',
      oh: 'vrc.v_oh',
      ou: 'vrc.v_ou',
    };

    for (const [vowel, weight] of Object.entries(vowelWeights)) {
      const morphName = vrcMapping[vowel];
      if (morphName && this.morphTargetMap.has(morphName)) {
        const targets = this.morphTargetMap.get(morphName)!;
        
        // Only apply to meshes that have VRC vowel morphs (avoid body morphs)
        for (const { mesh, index } of targets) {
          // Check if this mesh has VRC vowel morphs
          const hasVrcMorphs = this.vrcVowelMorphs.some(
            (vrcMorph) => mesh.morphTargetDictionary?.[vrcMorph] !== undefined
          );
          
          if (hasVrcMorphs && mesh.morphTargetInfluences) {
            mesh.morphTargetInfluences[index] = weight;
            applied = true;
          }
        }
      }
    }

    return applied;
  }

  private applyExpressions(vowelWeights: Record<string, number>): void {
    if (!this.vrm?.expressionManager) return;

    // Map vowels to expression names (if they exist)
    const expressionMapping: Record<string, string> = {
      aa: 'aa',
      e: 'e',
      ih: 'i',
      oh: 'o',
      ou: 'u',
    };

    for (const [vowel, weight] of Object.entries(vowelWeights)) {
      const expressionName = expressionMapping[vowel];
      if (expressionName) {
        this.vrm.expressionManager.setValue(expressionName, weight);
      }
    }

    this.vrm.expressionManager.update();
  }

  private applyAlternativeMorphs(vowelWeights: Record<string, number>): void {
    // Apply to any mouth-related morphs as fallback
    const mouthValue = Math.max(...Object.values(vowelWeights));
    
    for (const pattern of this.alternativeMorphPatterns) {
      for (const [morphName, targets] of this.morphTargetMap.entries()) {
        if (morphName.toLowerCase().includes(pattern)) {
          for (const { mesh, index } of targets) {
            if (mesh.morphTargetInfluences) {
              mesh.morphTargetInfluences[index] = mouthValue * 0.5; // Reduced intensity for safety
            }
          }
        }
      }
    }
  }

  /**
   * Reset all morph targets to zero
   */
  reset(): void {
    if (!this.vrm) return;

    // Reset all mouth-related morphs
    for (const morphName of this.vrcVowelMorphs) {
      if (this.morphTargetMap.has(morphName)) {
        const targets = this.morphTargetMap.get(morphName)!;
        for (const { mesh, index } of targets) {
          if (mesh.morphTargetInfluences) {
            mesh.morphTargetInfluences[index] = 0;
          }
        }
      }
    }

    // Reset expressions if available
    if (this.vrm.expressionManager) {
      ['aa', 'e', 'i', 'o', 'u'].forEach((expr) => {
        this.vrm!.expressionManager?.setValue(expr, 0);
      });
      this.vrm.expressionManager.update();
    }

    this.vrm.update(0.016);
  }

  /**
   * Get available morph targets for debugging
   */
  getAvailableMorphs(): string[] {
    return Array.from(this.morphTargetMap.keys());
  }

  /**
   * Check if VRC morphs are available
   */
  hasVRCMorphs(): boolean {
    return this.vrcVowelMorphs.some((morph) => this.morphTargetMap.has(morph));
  }

  /**
   * Manually set a specific morph target value
   */
  setMorphTarget(morphName: string, value: number): boolean {
    if (!this.morphTargetMap.has(morphName)) {
      return false;
    }

    const targets = this.morphTargetMap.get(morphName)!;
    for (const { mesh, index } of targets) {
      if (mesh.morphTargetInfluences) {
        mesh.morphTargetInfluences[index] = Math.max(0, Math.min(1, value));
      }
    }

    if (this.vrm) {
      this.vrm.update(0.016);
    }

    return true;
  }
}