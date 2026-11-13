import { Canvas, type CanvasProps } from '@react-three/fiber';

/**
 * Opinionated R3F <Canvas> defaults shared by every 3D project:
 * - DPR capped at 2 (phones with 3x screens would otherwise render 2.25x pixels)
 * - `frameloop="demand"` by default: renders only when something changes.
 *   Projects that animate continuously opt in with `frameloop="always"`.
 * - No antialias on high-DPR screens where it's mostly wasted fill-rate.
 *
 * R3F disposes the renderer, geometries and materials it created when the
 * Canvas unmounts, so leaving a project frees its GPU memory.
 */
export function SceneCanvas({ children, frameloop = 'demand', ...rest }: CanvasProps) {
  const highDpr = typeof window !== 'undefined' && window.devicePixelRatio >= 2;
  return (
    <Canvas
      frameloop={frameloop}
      dpr={[1, 2]}
      gl={{ antialias: !highDpr, powerPreference: 'high-performance', alpha: false }}
      {...rest}
    >
      {children}
    </Canvas>
  );
}
