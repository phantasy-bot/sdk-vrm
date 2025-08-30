// Import VRM SDK (in production, this would be from npm)
// For demo purposes, we'll use a relative import
import { VRMManager } from '../../dist/index.js';

// Global variables
let vrmManager;
let audioElement;

// Initialize VRM Manager
function initializeVRM() {
  const container = document.getElementById('container');
  
  vrmManager = new VRMManager({
    container: container,
    enableGrid: true,
    enableControls: true,
    enableAutoRotate: false,
    backgroundColor: 0x1a1a1a,
    cameraPosition: [0, 1.5, 3],
  });

  // Setup event listeners
  vrmManager.on('loaded', ({ vrm }) => {
    updateStatus('VRM loaded successfully');
    console.log('VRM loaded:', vrm);
    
    // List available expressions
    const expressions = vrmManager.expression.getAvailable();
    console.log('Available expressions:', expressions);
    
    // List available morphs for debugging
    const morphs = vrmManager.lipSync.getStatus();
    console.log('Lip sync status:', morphs);
  });

  vrmManager.on('loading', ({ progress }) => {
    updateStatus(`Loading: ${progress}%`);
  });

  vrmManager.on('error', ({ error }) => {
    updateStatus(`Error: ${error.message}`);
    console.error('VRM error:', error);
  });

  vrmManager.on('lipSyncStart', () => {
    updateStatus('Lip sync started');
  });

  vrmManager.on('lipSyncStop', () => {
    updateStatus('Lip sync stopped');
  });

  vrmManager.on('lipSyncFrame', ({ volume, vowel }) => {
    // Update status with current lip sync info
    document.getElementById('status').innerHTML = `
      Status: Lip Sync Active<br>
      Volume: ${(volume * 100).toFixed(0)}%<br>
      Vowel: ${vowel}
    `;
  });

  // Make functions available globally
  window.vrmManager = vrmManager;
}

// Load VRM model
window.loadVRM = async function() {
  const url = document.getElementById('vrmUrl').value;
  if (!url) {
    alert('Please enter a VRM URL');
    return;
  }

  try {
    updateStatus('Loading VRM...');
    await vrmManager.loadVRM(url);
  } catch (error) {
    updateStatus(`Failed to load VRM: ${error.message}`);
  }
};

// Start lip sync
window.startLipSync = async function() {
  const audioUrl = document.getElementById('audioUrl').value;
  if (!audioUrl) {
    alert('Please enter an audio URL');
    return;
  }

  if (!vrmManager.isLoaded()) {
    alert('Please load a VRM model first');
    return;
  }

  try {
    // Create or reuse audio element
    if (!audioElement) {
      audioElement = new Audio();
      audioElement.crossOrigin = 'anonymous';
    }
    
    audioElement.src = audioUrl;
    audioElement.play();
    
    const success = await vrmManager.lipSync.start(audioElement);
    if (!success) {
      updateStatus('Failed to start lip sync');
    }
  } catch (error) {
    updateStatus(`Lip sync error: ${error.message}`);
  }
};

// Stop lip sync
window.stopLipSync = function() {
  if (audioElement) {
    audioElement.pause();
    audioElement.currentTime = 0;
  }
  vrmManager.lipSync.stop();
  updateStatus('Lip sync stopped');
};

// Set expression
window.setExpression = function() {
  const expression = document.getElementById('expression').value;
  if (!expression) return;
  
  if (!vrmManager.isLoaded()) {
    alert('Please load a VRM model first');
    return;
  }

  vrmManager.expression.set(expression, 1.0);
  updateStatus(`Expression set: ${expression}`);
};

// Test vowel
window.testVowel = function() {
  const vowel = document.getElementById('vowelTest').value;
  const weight = document.getElementById('vowelWeight').value / 100;
  
  if (!vrmManager.isLoaded()) {
    alert('Please load a VRM model first');
    return;
  }

  vrmManager.lipSync.testVowel(vowel, weight);
};

// Run test sequence
window.runTestSequence = async function() {
  if (!vrmManager.isLoaded()) {
    alert('Please load a VRM model first');
    return;
  }

  updateStatus('Running test sequence...');
  await vrmManager.lipSync.runTestSequence();
  updateStatus('Test sequence complete');
};

// Toggle grid
window.toggleGrid = function() {
  const showGrid = document.getElementById('showGrid').checked;
  vrmManager.scene.showGrid(showGrid);
};

// Toggle auto rotate
window.toggleAutoRotate = function() {
  const autoRotate = document.getElementById('autoRotate').checked;
  const components = vrmManager.scene.getComponents();
  if (components) {
    components.controls.autoRotate = autoRotate;
  }
};

// Update status
function updateStatus(message) {
  document.getElementById('status').textContent = `Status: ${message}`;
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
  initializeVRM();
  
  // Set default VRM URL for testing
  document.getElementById('vrmUrl').value = 'https://pixiv.github.io/three-vrm/packages/three-vrm/examples/models/VRM1_Constraint_Twist_Sample.vrm';
  
  // Set default audio URL for testing
  document.getElementById('audioUrl').value = 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3';
});

// Export for debugging
window.VRMManager = VRMManager;