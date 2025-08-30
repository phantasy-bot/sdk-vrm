// Core exports
export { VRMManager } from './core/VRMManager';
export type { VRMManagerConfig, VRMEventType, VRMEventData } from './core/VRMManager';

export { SceneManager } from './core/SceneManager';
export type { SceneConfig, SceneComponents } from './core/SceneManager';

export { ResourceLoader } from './core/ResourceLoader';
export type { LoadingOptions } from './core/ResourceLoader';

// Lip sync exports
export { LipSyncEngine } from './features/lip-sync/LipSyncEngine';
export type { LipSyncConfig, LipSyncStatus } from './features/lip-sync/LipSyncEngine';

export { AudioAnalyzer } from './features/lip-sync/AudioAnalyzer';
export type { AudioAnalyzerConfig, AudioAnalysisResult } from './features/lip-sync/AudioAnalyzer';

export { MorphMapper } from './features/lip-sync/MorphMapper';
export type { MorphMapping, MorphMapperConfig } from './features/lip-sync/MorphMapper';

// Animation exports
export { AnimationPlayer } from './features/animation/AnimationPlayer';
export type { AnimationOptions } from './features/animation/AnimationPlayer';

// Expression exports
export { ExpressionController } from './features/expressions/ExpressionController';
export type { ExpressionPreset } from './features/expressions/ExpressionController';

// React component (optional)
export { VRMViewer } from './components/VRMViewer';
export type { VRMViewerProps } from './components/VRMViewer';

// Re-export useful Three.js and VRM types
export type { VRM } from '@pixiv/three-vrm';
export * as THREE from 'three';