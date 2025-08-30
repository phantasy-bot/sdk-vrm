import { VRM, VRMExpressionPresetName } from '@pixiv/three-vrm';
import * as THREE from 'three';

export interface ExpressionPreset {
  name: string;
  expressions: Record<string, number>;
  morphTargets?: Record<string, number>;
}

export class ExpressionController {
  private vrm: VRM;
  private currentExpressions: Map<string, number> = new Map();
  private morphTargets: Map<string, { mesh: THREE.SkinnedMesh; index: number }[]> = new Map();
  private presets: Map<string, ExpressionPreset> = new Map();

  constructor(vrm: VRM) {
    this.vrm = vrm;
    this.buildMorphTargetMap();
    this.initializePresets();
  }

  private buildMorphTargetMap(): void {
    this.morphTargets.clear();

    // Traverse VRM to find all morph targets
    this.vrm.scene.traverse((object) => {
      if ((object as THREE.SkinnedMesh).isSkinnedMesh) {
        const mesh = object as THREE.SkinnedMesh;
        
        if (mesh.morphTargetDictionary && mesh.morphTargetInfluences) {
          for (const [morphName, index] of Object.entries(mesh.morphTargetDictionary)) {
            if (!this.morphTargets.has(morphName)) {
              this.morphTargets.set(morphName, []);
            }
            this.morphTargets.get(morphName)!.push({ mesh, index });
          }
        }
      }
    });
  }

  private initializePresets(): void {
    // Define emotion presets
    this.presets.set('happy', {
      name: 'happy',
      expressions: {
        happy: 1.0,
        blink: 0,
      },
    });

    this.presets.set('sad', {
      name: 'sad',
      expressions: {
        sad: 1.0,
        blink: 0,
      },
    });

    this.presets.set('angry', {
      name: 'angry',
      expressions: {
        angry: 1.0,
        blink: 0,
      },
    });

    this.presets.set('surprised', {
      name: 'surprised',
      expressions: {
        surprised: 1.0,
        blink: 0,
      },
    });

    this.presets.set('neutral', {
      name: 'neutral',
      expressions: {
        neutral: 1.0,
      },
    });

    // Eye presets
    this.presets.set('blink', {
      name: 'blink',
      expressions: {
        blink: 1.0,
      },
    });

    this.presets.set('blinkLeft', {
      name: 'blinkLeft',
      expressions: {
        blinkLeft: 1.0,
      },
    });

    this.presets.set('blinkRight', {
      name: 'blinkRight',
      expressions: {
        blinkRight: 1.0,
      },
    });

    // Mouth presets
    this.presets.set('smile', {
      name: 'smile',
      morphTargets: {
        'mouth_smile': 1.0,
      },
    });

    this.presets.set('open', {
      name: 'open',
      morphTargets: {
        'mouth_open': 1.0,
      },
    });
  }

  /**
   * Set an expression by name and weight
   */
  setExpression(name: string, weight: number): void {
    // Clamp weight
    weight = Math.max(0, Math.min(1, weight));

    // Check if it's a preset
    if (this.presets.has(name)) {
      this.applyPreset(name, weight);
      return;
    }

    // Try VRM expression manager
    if (this.vrm.expressionManager) {
      try {
        this.vrm.expressionManager.setValue(name as VRMExpressionPresetName, weight);
        this.vrm.expressionManager.update();
        this.currentExpressions.set(name, weight);
      } catch (error) {
        console.warn(`Expression "${name}" not found in VRM`);
      }
    }
  }

  /**
   * Apply a preset expression
   */
  private applyPreset(presetName: string, weight: number): void {
    const preset = this.presets.get(presetName);
    if (!preset) return;

    // Apply expressions
    if (preset.expressions && this.vrm.expressionManager) {
      for (const [exprName, exprValue] of Object.entries(preset.expressions)) {
        try {
          this.vrm.expressionManager.setValue(
            exprName as VRMExpressionPresetName,
            exprValue * weight
          );
        } catch (error) {
          // Expression might not exist in this VRM
        }
      }
      this.vrm.expressionManager.update();
    }

    // Apply morph targets
    if (preset.morphTargets) {
      for (const [morphName, morphValue] of Object.entries(preset.morphTargets)) {
        this.setMorphTargetDirect(morphName, morphValue * weight);
      }
    }
  }

  /**
   * Set a morph target directly
   */
  private setMorphTargetDirect(morphName: string, weight: number): void {
    const targets = this.morphTargets.get(morphName);
    if (!targets) return;

    for (const { mesh, index } of targets) {
      if (mesh.morphTargetInfluences) {
        mesh.morphTargetInfluences[index] = weight;
      }
    }
  }

  /**
   * Set a morph target by category and name
   */
  setMorphTarget(category: string, name: string, weight: number): void {
    const morphName = `${category}_${name}`;
    this.setMorphTargetDirect(morphName, weight);
    
    // Update VRM
    this.vrm.update(0);
  }

  /**
   * Blend between multiple expressions
   */
  blendExpressions(expressions: Record<string, number>): void {
    // Reset all current expressions
    this.reset();

    // Apply new expressions
    for (const [name, weight] of Object.entries(expressions)) {
      this.setExpression(name, weight);
    }
  }

  /**
   * Reset all expressions to neutral
   */
  reset(): void {
    // Reset VRM expressions
    if (this.vrm.expressionManager) {
      // Get all registered expressions
      const expressions = this.vrm.expressionManager.expressions;
      for (const expression of expressions) {
        expression.weight = 0;
      }
      this.vrm.expressionManager.update();
    }

    // Reset tracked expressions
    this.currentExpressions.clear();

    // Reset all morph targets
    for (const [morphName, targets] of this.morphTargets.entries()) {
      for (const { mesh, index } of targets) {
        if (mesh.morphTargetInfluences) {
          mesh.morphTargetInfluences[index] = 0;
        }
      }
    }

    // Update VRM
    this.vrm.update(0);
  }

  /**
   * Get available expressions
   */
  getAvailableExpressions(): string[] {
    const expressions: string[] = [];

    // Add presets
    expressions.push(...Array.from(this.presets.keys()));

    // Add VRM expressions
    if (this.vrm.expressionManager) {
      const vrmExpressions = this.vrm.expressionManager.expressions;
      for (const expr of vrmExpressions) {
        if (expr.expressionName) {
          expressions.push(expr.expressionName);
        }
      }
    }

    return [...new Set(expressions)]; // Remove duplicates
  }

  /**
   * Get available morph targets
   */
  getAvailableMorphTargets(): string[] {
    return Array.from(this.morphTargets.keys());
  }

  /**
   * Animate blink
   */
  async animateBlink(duration: number = 150): Promise<void> {
    this.setExpression('blink', 1);
    await new Promise((resolve) => setTimeout(resolve, duration));
    this.setExpression('blink', 0);
  }

  /**
   * Animate expression transition
   */
  async transitionExpression(
    from: string,
    to: string,
    duration: number = 500
  ): Promise<void> {
    const steps = 20;
    const stepDuration = duration / steps;

    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const fromWeight = 1 - t;
      const toWeight = t;

      this.blendExpressions({
        [from]: fromWeight,
        [to]: toWeight,
      });

      await new Promise((resolve) => setTimeout(resolve, stepDuration));
    }
  }

  /**
   * Get current expression weights
   */
  getCurrentExpressions(): Map<string, number> {
    return new Map(this.currentExpressions);
  }

  /**
   * Add custom preset
   */
  addPreset(preset: ExpressionPreset): void {
    this.presets.set(preset.name, preset);
  }
}