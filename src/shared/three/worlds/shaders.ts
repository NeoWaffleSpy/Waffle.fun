import { fbm3, simplex3 } from '../noise.glsl';

/**
 * Terrain height on the unit sphere. Shared by vertex (silhouette) and
 * fragment (per-pixel colour + bump) stages so both agree exactly.
 * OCTAVES is injected as a #define so phones can use fewer.
 *
 * uTerrain selects the large-scale SHAPE (index into TERRAIN_TYPES in
 * shared/worlds/world.ts): 0 continents, 1 archipelago, 2 pangaea,
 * 3 highlands, 4 canyons, 5 dunes, 6 cratered.
 */
const terrain = /* glsl */ `
uniform vec3 uOffset;
uniform float uScale;
uniform float uSeaLevel;
uniform float uMountains;
uniform float uTerrain;
uniform float uWarp;

vec3 hash33(vec3 p) {
  p = fract(p * vec3(0.1031, 0.1030, 0.0973));
  p += dot(p, p.yxz + 33.33);
  return fract((p.xxy + p.yxx) * p.zyx);
}

// Worley-style impact craters: bowl + raised rim, not every cell has one.
float craters(vec3 p) {
  vec3 i = floor(p);
  vec3 f = fract(p);
  float h = 0.0;
  for (int z = -1; z <= 1; z++)
  for (int y = -1; y <= 1; y++)
  for (int x = -1; x <= 1; x++) {
    vec3 g = vec3(float(x), float(y), float(z));
    vec3 o = hash33(i + g);
    if (o.z > 0.6) continue;
    float size = 0.22 + 0.32 * o.x;
    float d = length(g + o - f) / size;
    if (d > 1.5) continue;
    float bowl = min(d * d - 1.0, 0.0) * 0.55;
    float rim = exp(-((d - 1.0) * (d - 1.0)) / 0.03) * 0.3;
    h += (bowl + rim) * size;
  }
  return h;
}

float terrain(vec3 p, int octaves) {
  vec3 q = p * uScale + uOffset;
  // Domain warp: twists coastlines into fjords, bays and peninsulas.
  vec3 w = vec3(snoise(q * 0.7 + 3.1), snoise(q * 0.7 + 17.3), snoise(q * 0.7 + 41.7));
  q += w * uWarp * 0.6;
  int T = int(uTerrain + 0.5);

  float base = fbm(q, octaves, 2.0, 0.5);
  // Pangaea: bias toward one hemisphere so a single supercontinent forms.
  if (T == 2) base = base * 0.55 + dot(p, normalize(uOffset)) * 0.5;

  float land = smoothstep(uSeaLevel - 0.02, uSeaLevel + 0.22, base);
  float ridges = ridged(q * 2.3 + 11.0, octaves - 1);
  float h = base + land * ridges * uMountains * (T == 1 ? 0.8 : 0.6);

  if (T == 3) {
    // Highlands: terraced plateaus and mesas.
    float above = h - uSeaLevel;
    float k = above * 6.0;
    float stepped = (floor(k) + smoothstep(0.3, 0.7, fract(k))) / 6.0;
    h = mix(h, uSeaLevel + stepped, step(0.0, above) * 0.85);
  } else if (T == 4) {
    // Canyons: narrow valleys carved along noise iso-lines, with mesa tops.
    float c = 1.0 - abs(snoise(q * 1.4 + 7.0));
    float c2 = 1.0 - abs(snoise(q * 3.1 + 19.0));
    h -= (pow(c, 14.0) * 0.32 + pow(c2, 18.0) * 0.12) * land;
    float above = h - uSeaLevel;
    h = mix(h, uSeaLevel + floor(above * 5.0) / 5.0 + 0.02, step(0.06, above) * 0.5);
  } else if (T == 5) {
    // Dunes: flatten into plains, then add rippled dune fields.
    float above = h - uSeaLevel;
    h = mix(h, uSeaLevel + 0.06 + above * 0.3, land * 0.7);
    float d = snoise(q * 0.6);
    float ripple = abs(sin(dot(q, vec3(7.0, 1.7, 3.1)) + d * 5.0));
    h += (1.0 - ripple) * 0.035 * land;
  } else if (T == 6) {
    h += craters(q * 1.3) * 0.5 + craters(q * 3.7 + 5.0) * 0.18;
  }
  return h;
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

/**
 * Surface colour = BIOME from local climate (Whittaker-style):
 *   temperature = global offset + latitude falloff - altitude + noise
 *   humidity    = global offset + large-scale noise
 * cold → tundra/taiga, temperate → desert/grass/forest, hot → desert/savanna/jungle,
 * frozen → snow & sea ice. Lifeless worlds (uLife = 0) are coloured by altitude.
 * Cities: grey sprawl in habitable lowlands by day, warm lights on the night side.
 */
export const planetFragment = /* glsl */ `
${common}
uniform vec3 uSunDir;
uniform vec3 uDeep, uShallow, uBeach, uTundra, uTaiga, uGrass, uForest, uJungle;
uniform vec3 uSavanna, uDesert, uRock, uSnow, uCity, uLights, uAtmo;
uniform float uOceanGloss;
uniform float uHasAtmo;
uniform float uTemp;
uniform float uHumid;
uniform float uLife;
uniform float uCities;
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

  // ---- climate
  // Altitude only cools real high ground (not the whole raised supercontinent).
  float temp = uTemp + 0.6 - lat * lat * 1.5 - smoothstep(0.18, 0.75, h) * 0.95
             + snoise(vObj * 2.5 + uOffset.zxy) * 0.12;
  float moist = uHumid + fbm(vObj * 2.2 + uOffset.yzx * 0.7, 4, 2.0, 0.5) * 0.9;
  float frozen = 1.0 - smoothstep(-0.52, -0.4, temp);

  vec3 col;
  float spec = 0.0;
  float cityMask = 0.0;

  if (h < 0.0) {
    float depth = clamp(-h * 3.5, 0.0, 1.0);
    col = mix(uShallow, uDeep, pow(depth, 0.6));
    // Sea ice where it's cold enough.
    col = mix(col, uSnow * 0.92, frozen);
    spec = uOceanGloss * (1.0 - frozen);
  } else {
    n = perturbNormal(vWorld, n, h * 0.09);
    float t = clamp(h * 2.2, 0.0, 1.0);

    // ---- biomes from climate
    vec3 cold = mix(uTundra, uTaiga, smoothstep(-0.2, 0.2, moist));
    vec3 temperate = mix(uDesert, uGrass, smoothstep(-0.45, -0.15, moist));
    temperate = mix(temperate, uForest, smoothstep(0.05, 0.35, moist));
    vec3 hot = mix(uDesert, uSavanna, smoothstep(-0.4, -0.1, moist));
    hot = mix(hot, uJungle, smoothstep(0.15, 0.45, moist));
    vec3 bio = mix(cold, temperate, smoothstep(-0.25, 0.0, temp));
    bio = mix(bio, hot, smoothstep(0.32, 0.55, temp));

    // Lifeless: plain altitude bands.
    vec3 barren = mix(uBeach, uDesert, smoothstep(0.0, 0.15, t));
    barren = mix(barren, uRock, smoothstep(0.35, 0.8, t));
    col = mix(barren, bio, uLife);

    // Forest canopy: clumpy texture where trees grow (visible up close).
    float trees = uLife * smoothstep(0.05, 0.35, moist) * smoothstep(-0.3, -0.05, temp)
                * (1.0 - smoothstep(0.5, 0.7, t));
    #if FRAGMENT_OCTAVES > 5
      float canopy = snoise(vObj * 85.0 + uOffset) * 0.5 + 0.5;
      col *= 1.0 - trees * (0.12 + canopy * 0.22);
    #else
      col *= 1.0 - trees * 0.15;
    #endif

    // Beaches, bare rock on cliffs and peaks.
    col = mix(uBeach, col, smoothstep(0.0, 0.025, h));
    float slope = 1.0 - dot(n, normalize(vNormalW));
    col = mix(col, uRock, smoothstep(0.02, 0.08, slope) * 0.6);
    col = mix(col, uRock, smoothstep(0.55, 0.85, t));

    // Snow & ice: cold latitudes and high peaks.
    col = mix(col, uSnow, frozen);

    // ---- cities: habitable = mild, low, not frozen
    float habit = smoothstep(-0.3, 0.0, temp) * (1.0 - smoothstep(0.6, 0.8, temp))
                * (1.0 - smoothstep(0.25, 0.5, t)) * (1.0 - frozen)
                * smoothstep(0.004, 0.02, h); // not on the beach itself
    // Metro regions (large) × individual cities (small): distinct clusters.
    float region = fbm(vObj * 3.5 + uOffset.zxy * 1.3, 3, 2.0, 0.5) * 0.5 + 0.5;
    float town = snoise(vObj * 16.0 + uOffset.yzx) * 0.5 + 0.5;
    float threshold = 0.78 - uCities * 0.18;
    cityMask = habit * smoothstep(0.45, 0.6, region + uCities * 0.15)
             * smoothstep(threshold, threshold + 0.12, town + region * 0.25);
    #if FRAGMENT_OCTAVES > 5
      // Street-grid speckle so sprawl reads as built-up when you zoom in.
      float blocks = step(0.15, snoise(vObj * 180.0 + uOffset.yxz));
      col = mix(col, uCity * (0.75 + 0.35 * blocks), cityMask * 0.85);
    #else
      col = mix(col, uCity, cityMask * 0.8);
    #endif
  }

  vec3 L = normalize(uSunDir);
  vec3 V = normalize(cameraPosition - vWorld);
  float ndl = dot(n, L);
  float diffuse = smoothstep(-0.1, 1.0, ndl);
  vec3 H = normalize(L + V);
  float specular = spec * pow(max(dot(normalize(vNormalW), H), 0.0), 60.0) * 0.6 * step(0.0, ndl);
  float fresnel = pow(1.0 - max(dot(normalize(vNormalW), V), 0.0), 3.0);

  vec3 lit = col * (0.04 + diffuse * 1.05) + specular;
  lit += uAtmo * fresnel * 0.55 * uHasAtmo * smoothstep(-0.3, 0.6, ndl);

  // City lights on the night side.
  float night = 1.0 - smoothstep(-0.2, 0.05, dot(normalize(vNormalW), L));
  // Point-like lights: bright cores, dimmer suburbs.
  float sparkle = smoothstep(0.45, 0.9, snoise(vObj * 150.0 + uOffset) * 0.5 + 0.5);
  lit += uLights * cityMask * (0.18 + sparkle * 1.2) * night * 1.5;

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
