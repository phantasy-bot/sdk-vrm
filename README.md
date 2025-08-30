# @phantasy/vrm-sdk

A powerful Three.js SDK for VRM avatar rendering with built-in lip sync, animations, and expression controls.

## Features

- **VRM Model Loading** - Easy loading and rendering of VRM 3D avatars
- **Audio-Driven Lip Sync** - Real-time mouth animations synchronized with audio
- **Expression Control** - Preset and custom facial expressions
- **Mixamo Animation Support** - Load and play FBX animations with automatic retargeting
- **Scene Management** - Built-in camera controls, lighting, and grid
- **React Support** - Optional React component wrapper
- **TypeScript** - Full TypeScript support with type definitions

## Installation

```bash
npm install @phantasy/vrm-sdk three
```

## Quick Start

### Basic Usage

```javascript
import { VRMManager } from '@phantasy/vrm-sdk';

// Initialize VRM Manager
const vrm = new VRMManager({
  container: document.getElementById('canvas'),
  vrmUrl: '/models/avatar.vrm',
  enableControls: true,
  enableGrid: true
});

// Listen for events
vrm.on('loaded', ({ vrm }) => {
  console.log('VRM model loaded!', vrm);
});

// Start lip sync with audio
const audio = new Audio('/audio/speech.mp3');
await vrm.lipSync.start(audio);

// Set expressions
vrm.expression.set('happy', 0.8);

// Play animations
await vrm.animation.loadMixamo('/animations/dance.fbx');
vrm.animation.play('dance', { loop: true });
```

### React Usage

```jsx
import { VRMViewer } from '@phantasy/vrm-sdk';

function App() {
  return (
    <VRMViewer
      vrmUrl="/models/avatar.vrm"
      enableControls
      enableGrid
      onLoad={(vrm) => console.log('Loaded!', vrm)}
      style={{ width: '100%', height: '600px' }}
    />
  );
}
```

## API Reference

### VRMManager

The main class for managing VRM models.

#### Constructor

```typescript
new VRMManager(config: VRMManagerConfig)
```

**Config Options:**
- `container` (HTMLElement): DOM element to render into
- `vrmUrl` (string): Optional VRM model URL to auto-load
- `enableGrid` (boolean): Show grid helper (default: true)
- `enableControls` (boolean): Enable orbit controls (default: true)
- `enableAutoRotate` (boolean): Auto-rotate camera (default: false)
- `backgroundColor` (number): Scene background color (default: 0x1a1a1a)
- `cameraPosition` ([number, number, number]): Initial camera position
- `lipSyncConfig` (LipSyncConfig): Lip sync configuration

#### Methods

##### Loading
- `loadVRM(url: string): Promise<VRM>` - Load a VRM model
- `isLoaded(): boolean` - Check if VRM is loaded
- `getVRM(): VRM | null` - Get current VRM instance

##### Lip Sync
- `lipSync.start(audioElement: HTMLAudioElement): Promise<boolean>` - Start lip sync
- `lipSync.stop(): void` - Stop lip sync
- `lipSync.testVowel(vowel: string, weight: number): void` - Test specific vowel
- `lipSync.runTestSequence(): Promise<void>` - Run automated test
- `lipSync.updateConfig(config: Partial<LipSyncConfig>): void` - Update settings
- `lipSync.getStatus(): LipSyncStatus` - Get current status

##### Animations
- `animation.loadMixamo(url: string): Promise<void>` - Load Mixamo FBX
- `animation.play(name: string, options?: AnimationOptions): void` - Play animation
- `animation.stop(): void` - Stop animation
- `animation.pause(): void` - Pause animation
- `animation.resume(): void` - Resume animation
- `animation.setWeight(weight: number): void` - Set animation blend weight

##### Expressions
- `expression.set(name: string, weight: number): void` - Set expression
- `expression.morph(category: string, name: string, weight: number): void` - Set morph target
- `expression.reset(): void` - Reset to neutral
- `expression.getAvailable(): string[]` - Get available expressions

##### Scene Control
- `scene.setBackground(color: number | string): void` - Set background color
- `scene.showGrid(visible: boolean): void` - Toggle grid visibility
- `scene.setCameraPosition(x: number, y: number, z: number): void` - Set camera position
- `scene.lookAt(x: number, y: number, z: number): void` - Set camera target

#### Events

```javascript
vrm.on('loaded', ({ vrm }) => {});
vrm.on('loading', ({ progress }) => {});
vrm.on('error', ({ error }) => {});
vrm.on('lipSyncStart', () => {});
vrm.on('lipSyncStop', () => {});
vrm.on('lipSyncFrame', ({ volume, vowel }) => {});
vrm.on('animationStart', ({ name }) => {});
vrm.on('animationEnd', ({ name }) => {});
```

### Lip Sync Configuration

```typescript
interface LipSyncConfig {
  sensitivity?: number;      // Audio sensitivity (0-1, default: 0.7)
  smoothing?: number;        // Smoothing factor (0-1, default: 0.8)
  minVolume?: number;        // Minimum volume threshold (default: 10)
  updateInterval?: number;   // Update interval in ms (default: 16)
}
```

### Animation Options

```typescript
interface AnimationOptions {
  loop?: boolean;           // Loop animation
  weight?: number;          // Blend weight (0-1)
  timeScale?: number;       // Playback speed
  fadeInDuration?: number;  // Fade in time (ms)
  fadeOutDuration?: number; // Fade out time (ms)
}
```

## VRM Compatibility

### Supported VRM Versions
- VRM 0.0
- VRM 1.0

### Morph Target Support
The SDK automatically detects and uses available morph targets:
- **VRC Vowel Morphs**: `vrc.v_aa`, `vrc.v_e`, `vrc.v_ih`, `vrc.v_oh`, `vrc.v_ou`
- **Expression Manager**: VRM 1.0 expression presets
- **Custom Morphs**: Any mouth-related morph targets

## Examples

### Basic HTML Example

```html
<!DOCTYPE html>
<html>
<head>
  <title>VRM SDK Example</title>
  <style>
    #canvas { width: 100vw; height: 100vh; }
  </style>
</head>
<body>
  <div id="canvas"></div>
  <script type="module">
    import { VRMManager } from '@phantasy/vrm-sdk';
    
    const vrm = new VRMManager({
      container: document.getElementById('canvas'),
      vrmUrl: './avatar.vrm'
    });
    
    vrm.on('loaded', () => {
      console.log('Ready!');
    });
  </script>
</body>
</html>
```

### Advanced Lip Sync

```javascript
// Create custom lip sync configuration
const vrm = new VRMManager({
  container: document.getElementById('canvas'),
  lipSyncConfig: {
    sensitivity: 0.8,
    smoothing: 0.7,
    minVolume: 5
  }
});

// Load VRM
await vrm.loadVRM('/models/avatar.vrm');

// Setup audio with lip sync
const audio = new Audio('/speech.mp3');
audio.addEventListener('play', () => {
  vrm.lipSync.start(audio);
});
audio.addEventListener('pause', () => {
  vrm.lipSync.stop();
});
audio.addEventListener('ended', () => {
  vrm.lipSync.stop();
});

// Play audio
audio.play();
```

### Custom Animation Workflow

```javascript
// Load multiple animations
await vrm.animation.loadMixamo('/animations/idle.fbx');
await vrm.animation.loadMixamo('/animations/walk.fbx');
await vrm.animation.loadMixamo('/animations/dance.fbx');

// Play with blending
vrm.animation.play('idle', { 
  loop: true, 
  weight: 0.5 
});

// Transition between animations
vrm.animation.play('walk', {
  fadeInDuration: 500,
  fadeOutDuration: 500
});
```

### Expression Control

```javascript
// Set preset expressions
vrm.expression.set('happy', 1.0);
vrm.expression.set('blink', 0.5);

// Animate expressions
async function animateBlink() {
  vrm.expression.set('blink', 1.0);
  await new Promise(r => setTimeout(r, 150));
  vrm.expression.set('blink', 0);
}

// Blend multiple expressions
vrm.expression.blendExpressions({
  happy: 0.6,
  surprised: 0.4
});
```

## Development

### Building the SDK

```bash
# Install dependencies
npm install

# Build the SDK
npm run build

# Watch mode for development
npm run dev

# Run examples
npm run example:basic
```

### Testing

```bash
npm test
```

## Browser Support

- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

WebGL 2.0 support is required.

## License

MIT

## Contributing

Contributions are welcome! Please read our contributing guidelines before submitting PRs.

## Support

For issues and questions, please use the [GitHub issues page](https://github.com/phantasy-bot/sdk-vrm/issues).