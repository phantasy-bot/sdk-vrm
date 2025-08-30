import React, { useEffect, useRef, useState } from 'react';
import { VRMManager, VRMManagerConfig } from '../core/VRMManager';
import { VRM } from '@pixiv/three-vrm';

export interface VRMViewerProps extends Omit<VRMManagerConfig, 'container'> {
  className?: string;
  style?: React.CSSProperties;
  onLoad?: (vrm: VRM) => void;
  onError?: (error: Error) => void;
  onProgress?: (progress: number) => void;
  children?: React.ReactNode;
}

export function VRMViewer({
  className,
  style,
  onLoad,
  onError,
  onProgress,
  children,
  ...managerConfig
}: VRMViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const managerRef = useRef<VRMManager | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    // Create VRM manager
    const manager = new VRMManager({
      ...managerConfig,
      container: containerRef.current,
    });

    managerRef.current = manager;

    // Setup event listeners
    manager.on('loaded', ({ vrm }) => {
      setLoading(false);
      setError(null);
      onLoad?.(vrm);
    });

    manager.on('loading', ({ progress }) => {
      setLoadingProgress(progress);
      onProgress?.(progress);
    });

    manager.on('error', ({ error }) => {
      setLoading(false);
      setError(error);
      onError?.(error);
    });

    // Cleanup
    return () => {
      manager.dispose();
      managerRef.current = null;
    };
  }, []); // Only run once on mount

  // Update configuration when props change
  useEffect(() => {
    if (!managerRef.current) return;

    // Update scene settings
    if (managerConfig.enableGrid !== undefined) {
      managerRef.current.scene.showGrid(managerConfig.enableGrid);
    }

    // Load new VRM if URL changes
    if (managerConfig.vrmUrl && managerConfig.vrmUrl !== managerRef.current.getVRM()?.scene.userData.vrmUrl) {
      setLoading(true);
      setError(null);
      managerRef.current.loadVRM(managerConfig.vrmUrl);
    }
  }, [managerConfig.vrmUrl, managerConfig.enableGrid]);

  // Expose manager methods via imperative handle
  React.useImperativeHandle(
    undefined,
    () => ({
      getManager: () => managerRef.current,
      getVRM: () => managerRef.current?.getVRM(),
      lipSync: managerRef.current?.lipSync,
      animation: managerRef.current?.animation,
      expression: managerRef.current?.expression,
      scene: managerRef.current?.scene,
    }),
    []
  );

  return (
    <div
      ref={containerRef}
      className={className}
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        ...style,
      }}
    >
      {/* Loading overlay */}
      {loading && (
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(0, 0, 0, 0.8)',
            color: 'white',
            zIndex: 10,
          }}
        >
          <div>Loading VRM...</div>
          <div>{loadingProgress}%</div>
        </div>
      )}

      {/* Error overlay */}
      {error && (
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(255, 0, 0, 0.1)',
            color: 'red',
            padding: '20px',
            zIndex: 10,
          }}
        >
          <div>Error loading VRM</div>
          <div style={{ fontSize: '14px', marginTop: '10px' }}>{error.message}</div>
        </div>
      )}

      {/* Custom children (controls, UI, etc.) */}
      {children}
    </div>
  );
}

// Hook to access VRM manager from child components
export function useVRMManager() {
  const [manager, setManager] = useState<VRMManager | null>(null);

  useEffect(() => {
    // This would need to be connected to a context provider
    // For now, it's a placeholder for the pattern
  }, []);

  return manager;
}