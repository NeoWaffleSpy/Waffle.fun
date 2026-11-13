import { fbm3, simplex3 } from '../noise.glsl';

/**
 * Terrain height on the unit sphere. Shared by vertex (silhouette) and
 * fragment (per-pixel colour + bump) stages so both agree exactly.
 * OCTAVES is injected as a #define so phones can use fewer.
 */
const terrain = /* glsl */ `
uniform vec3 uOffset;
uniform float uScale;
uniform float uSeaLevel;
uniform float uMountains;

float terrain(vec3 p, int octaves) {
  vec3 q = p * uScale + uOffset;
  float continents = fbm(q, octaves, 2.0, 0.5);
  float ridges = ridged(q * 2.3 + 11.0, octaves - 1);
  float land = smoothstep(uSeaLevel - 0.02, uSeaLevel + 0.22, continents);
  return continents + land * ridges * uMountains * 0.6;
}
`;

const common = simplex3 + fbm3 + terrain;

export const planetVertex = /* glsl */ `
${common}
varying vec3 vObj;
varying vec3 vWorld;
varying vec3 vNormalW;

void main() {
  vec3 p = normalize(position);
  // Coarser noise is enough for the silhouette; detail comes per-pixel.
  float h = terrain(p, VERTEX_OCTAVES) - uSeaLevel;
  vec3 displaced = p * (1.0 + max(h, 0.0) * 0.08);
  vec4 world = modelMatrix * vec4(displaced, 1.0);
  vObj = p;
  vWorld = world.xyz;
  vNormalW = normalize(mat3(modelMatrix) * p);
  gl_Position = projectionMatrix * viewMatrix * world;
}
`;

export const planetFragment = /* glsl */ `
${common}
uniform vec3 uSunDir;
uniform vec3 uDeep, uShallow, uSand, uLow, uHigh, uRock, uSnow, uAtmo;
uniform float uOceanGloss;
uniform float uHasAtmo;
varying vec3 vObj;
varying vec3 vWorld;
varying vec3 vNormalW;

// Bump mapping from screen-space derivatives (Mikkelsen 2010): no normal map,
// no tangents, just the height we already computed for colouring.
vec3 perturbNormal(vec3 pos, vec3 n, float height) {
  vec3 dpdx = dFdx(pos);
  vec3 dpdy = dFdy(pos);
  float dhdx = dFdx(height);
  float dhdy = dFdy(height);
  vec3 r1 = cross(dpdy, n);
  vec3 r2 = cross(n, dpdx);
  float det = dot(dpdx, r1);
  vec3 grad = sign(det) * (dhdx * r1 + dhdy * r2);
  return normalize(abs(det) * n - grad);
}

void main() {
  float h = terrain(vObj, FRAGMENT_OCTAVES) - uSeaLevel;
  float lat = abs(vObj.y);
  vec3 n = normalize(vNormalW);
  vec3 col;
  float spec = 0.0;

  if (h < 0.0) {
    float depth = clamp(-h * 3.5, 0.0, 1.0);
    col = mix(uShallow, uDeep, pow(depth, 0.6));
    spec = uOceanGloss;
  } else {
    float t = clamp(h * 2.2, 0.0, 1.0);
    col = mix(uSand, uLow, smoothstep(0.0, 0.05, t));
    col = mix(col, uHigh, smoothstep(0.15, 0.45, t));
    col = mix(col, uRock, smoothstep(0.5, 0.75, t));
    n = perturbNormal(vWorld, n, h * 0.09);
    float slope = 1.0 - dot(n, normalize(vNormalW));
    col = mix(col, uRock, smoothstep(0.02, 0.08, slope) * 0.6);
    float snowLine = 0.8 - lat * 0.9;
    col = mix(col, uSnow, smoothstep(snowLine, snowLine + 0.08, t));
  }
  // Polar ice caps over sea and land alike.
  col = mix(col, uSnow, smoothstep(0.82, 0.9, lat + snoise(vObj * 6.0 + uOffset) * 0.04));

  vec3 L = normalize(uSunDir);
  vec3 V = normalize(cameraPosition - vWorld);
  float ndl = dot(n, L);
  float diffuse = smoothstep(-0.1, 1.0, ndl);
  vec3 H = normalize(L + V);
  float specular = spec * pow(max(dot(normalize(vNormalW), H), 0.0), 60.0) * 0.6 * step(0.0, ndl);
  float fresnel = pow(1.0 - max(dot(normalize(vNormalW), V), 0.0), 3.0);

  vec3 lit = col * (0.04 + diffuse * 1.05) + specular;
  lit += uAtmo * fresnel * 0.55 * uHasAtmo * smoothstep(-0.3, 0.6, ndl);

  gl_FragColor = vec4(lit, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;

export const cloudVertex = /* glsl */ `
varying vec3 vObj;
varying vec3 vNormalW;
varying vec3 vWorld;
void main() {
  vObj = normalize(position);
  vNormalW = normalize(mat3(modelMatrix) * vObj);
  vec4 world = modelMatrix * vec4(position, 1.0);
  vWorld = world.xyz;
  gl_Position = projectionMatrix * viewMatrix * world;
}
`;

export const cloudFragment = /* glsl */ `
${simplex3}
${fbm3}
uniform vec3 uOffset;
uniform vec3 uSunDir;
uniform float uCover;
uniform float uTime;
varying vec3 vObj;
varying vec3 vNormalW;
varying vec3 vWorld;
void main() {
  vec3 q = vObj * 2.2 + uOffset.zxy * 0.5;
  // Domain warp gives swirly, weather-like shapes.
  vec3 warp = vec3(fbm(q + uTime * 0.02, 3, 2.0, 0.5), fbm(q + 5.2, 3, 2.0, 0.5), 0.0);
  float c = fbm(q + warp * 0.8, 5, 2.1, 0.5) * 0.5 + 0.5;
  float a = smoothstep(1.0 - uCover, 1.0 - uCover + 0.25, c);
  float light = smoothstep(-0.2, 0.8, dot(normalize(vNormalW), normalize(uSunDir)));
  vec3 V = normalize(cameraPosition - vWorld);
  float edge = smoothstep(0.0, 0.35, dot(normalize(vNormalW), V));
  gl_FragColor = vec4(vec3(0.03 + light), a * 0.85 * edge);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;

export const atmosphereVertex = /* glsl */ `
varying vec3 vNormalV;
varying vec3 vNormalW;
void main() {
  vNormalV = normalize(normalMatrix * normal);
  vNormalW = normalize(mat3(modelMatrix) * normal);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

export const atmosphereFragment = /* glsl */ `
uniform vec3 uAtmo;
uniform vec3 uSunDir;
varying vec3 vNormalV;
varying vec3 vNormalW;
void main() {
  // Back faces of a slightly larger sphere, additively blended: the ring
  // between the planet's edge and this sphere's edge becomes a soft halo,
  // brightest near the surface (z → -0.45) and fading to 0 at the rim (z → 0).
  float rim = pow(clamp(-vNormalV.z * 2.2, 0.0, 1.0), 2.0);
  float sun = smoothstep(-0.4, 0.6, dot(vNormalW, normalize(uSunDir)));
  gl_FragColor = vec4(uAtmo * rim * (0.15 + sun), 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;
