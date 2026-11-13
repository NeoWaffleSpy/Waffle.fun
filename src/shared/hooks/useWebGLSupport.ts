/**
 * Detects WebGL2 (what three.js r163+ requires) WITHOUT importing three.js,
 * so the check can run before the 3D vendor chunk is downloaded.
 */
let cached: boolean | undefined;

export function hasWebGL2(): boolean {
  if (cached !== undefined) return cached;
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2');
    cached = gl !== null;
    // Free the probe context immediately.
    gl?.getExtension('WEBGL_lose_context')?.loseContext();
  } catch {
    cached = false;
  }
  return cached;
}

export function useWebGLSupport(): boolean {
  return hasWebGL2();
}
