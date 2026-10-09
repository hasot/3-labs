import * as THREE from "three";

// The liquid is the glass cavity cut by a live surface plane. The cut is done here, per pixel:
// everything above the wavy plane is discarded, and the back faces that show through the
// hole are shaded as the surface itself, so pouring and sloshing never touch the geometry.
// Two meshes share these uniforms: back faces first, then front faces blended over them.

const vertexShader = /* glsl */ `
  varying vec3 vPos;
  varying vec3 vNormal;

  void main() {
    vPos = position;
    vNormal = normal;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const fragmentShader = /* glsl */ `
  uniform float uFill;
  uniform vec2 uSlope;
  uniform float uTime;
  uniform float uWaves;
  uniform vec3 uCam;
  uniform vec3 uLight;
  uniform vec3 uColor;
  uniform vec3 uDeep;
  uniform float uDensity;
  uniform float uOpacity;
  uniform float uFoam;
  uniform float uBubbles;
  uniform float uBottom;
  uniform float uSurfaceR;

  varying vec3 vPos;
  varying vec3 vNormal;

  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
  }

  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
               mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
  }

  float waves(vec2 p) {
    return sin(p.x * 13.0 + uTime * 1.9) * 0.5
         + sin(p.y * 11.0 - uTime * 1.6 + 1.3) * 0.5
         + sin((p.x + p.y) * 23.0 + uTime * 2.7) * 0.25;
  }

  float surfaceAt(vec2 p) {
    return uFill + dot(uSlope, p) + waves(p) * uWaves;
  }

  vec3 surfaceNormal(vec2 p) {
    float e = 0.004;
    float hx = surfaceAt(p + vec2(e, 0.0)) - surfaceAt(p - vec2(e, 0.0));
    float hz = surfaceAt(p + vec2(0.0, e)) - surfaceAt(p - vec2(0.0, e));
    return normalize(vec3(-hx, 2.0 * e, -hz));
  }

  // Dark room with one hard key light: a sharp highlight towards the light,
  // a faint cool sky above and nothing below the horizon
  vec3 envReflect(vec3 r) {
    float key = pow(max(dot(r, uLight), 0.0), 60.0) * 6.0;
    float strip = smoothstep(0.75, 0.98, dot(normalize(r.xz + 1e-4), normalize(uLight.xz + 1e-4))) * smoothstep(-0.1, 0.4, r.y);
    float sky = smoothstep(0.0, 1.0, r.y) * 0.08;
    return vec3(1.0, 0.97, 0.92) * (key + strip * 0.35) + vec3(0.6, 0.7, 0.85) * sky;
  }

  // Rising bubble streams on the cylinder wrapped around the axis
  float bubbleField(vec3 p) {
    float a = atan(p.z, p.x);
    float u = a * 5.0;
    float col = floor(u);
    float seed = hash(vec2(col, 3.1));
    if (seed < 0.6) return 0.0;
    float speed = 0.35 + seed * 0.5;
    float v = p.y * 34.0 - uTime * speed * 34.0 + seed * 40.0;
    vec2 cell = vec2(fract(u) - 0.5, fract(v) - 0.5);
    cell.x += (hash(vec2(col, floor(v))) - 0.5) * 0.5;
    float size = 0.05 + hash(vec2(floor(v), col)) * 0.06;
    float d = length(cell * vec2(1.0, 1.0));
    // Streams on the far side of the axis show through the drink; fade them at the silhouette
    float facing = smoothstep(0.0, 0.5, abs(cos(a - atan(uCam.z, uCam.x))));
    return smoothstep(size, size * 0.3, d) * step(0.45, hash(vec2(floor(v), col + 7.0))) * facing;
  }

  vec3 foamColor(vec2 p) {
    float n = noise(p * 60.0) * 0.6 + noise(p * 140.0 + uTime * 0.2) * 0.4;
    return mix(vec3(0.86, 0.80, 0.68), vec3(1.0, 0.98, 0.94), n);
  }

  void main() {
    float h = surfaceAt(vPos.xz);
    if (vPos.y > h) discard;

    vec3 V = normalize(vPos - uCam);
    vec3 col;
    float alpha;

    if (gl_FrontFacing) {
      // Liquid crossed by the eye ray: chord through the local cylinder, cut by the bottom
      vec2 p = vPos.xz;
      vec2 d = V.xz;
      float t = max(0.0, -2.0 * dot(p, d) / max(dot(d, d), 1e-4));
      if (V.y < 0.0) t = min(t, (uBottom - vPos.y) / V.y);
      else t = min(t, (h - vPos.y) / max(V.y, 1e-4));
      t = max(t, 0.0);

      float k = 1.0 - exp(-uDensity * t);
      vec3 N = normalize(vNormal);
      float wrap = clamp((dot(N, uLight) + 0.55) / 1.55, 0.0, 1.0);
      col = mix(uColor, uDeep, k) * (0.4 + 0.95 * wrap);
      // Light thrown through the drink towards the eye
      col += uColor * pow(max(dot(V, uLight), 0.0), 4.0) * 0.6 * (1.0 - k);
      alpha = uOpacity * mix(0.55, 1.0, k);

      float fres = pow(1.0 - abs(dot(N, -V)), 3.0);
      col += envReflect(reflect(V, N)) * fres * 0.6;
      alpha += fres * 0.18;

      // Bright meniscus line where the surface meets the wall
      float men = smoothstep(0.016, 0.0, h - vPos.y);
      col = mix(col, uColor * 1.35 + 0.08, men * 0.7);
      alpha = mix(alpha, max(alpha, 0.55), men);

      if (uBubbles > 0.0) {
        float b = bubbleField(vPos) * uBubbles * smoothstep(uBottom, uBottom + 0.08, vPos.y);
        col += vec3(1.0, 0.95, 0.8) * b * 0.55;
        alpha = max(alpha, b * 0.6);
      }

      if (uFoam > 0.0) {
        float f = smoothstep(h - uFoam - 0.01, h - uFoam + 0.02, vPos.y);
        col = mix(col, foamColor(vPos.xz + vPos.y) * (0.45 + 0.75 * wrap), f);
        alpha = mix(alpha, 0.97, f);
      }
    } else {
      // A back face only stands for the surface when the eye ray got here through the top:
      // the ray must cross the surface plane inside the rim, before reaching this point
      float tHit = (h - uCam.y) / V.y;
      vec3 hit = uCam + V * tHit;
      hit = uCam + V * ((surfaceAt(hit.xz) - uCam.y) / V.y);
      if (V.y >= 0.0 || tHit > length(vPos - uCam) || length(hit.xz) > uSurfaceR) discard;

      float t = length(vPos - hit);
      float k = 1.0 - exp(-uDensity * t);
      vec3 N = surfaceNormal(hit.xz);
      float wrap = clamp((dot(N, uLight) + 0.4) / 1.4, 0.0, 1.0);
      col = mix(uColor, uDeep, k) * (0.3 + 0.7 * wrap);
      alpha = uOpacity * mix(0.6, 1.0, k);

      float fres = 0.04 + 0.96 * pow(1.0 - max(dot(N, -V), 0.0), 5.0);
      col = mix(col, envReflect(reflect(V, N)), fres);
      alpha = mix(alpha, 1.0, fres * 0.85);

      // Glint of the key light on the ripples
      vec3 H = normalize(uLight - V);
      float spec = pow(max(dot(N, H), 0.0), 220.0) * 3.0;
      col += vec3(1.0, 0.96, 0.9) * spec;
      alpha = max(alpha, min(spec, 1.0));

      if (uFoam > 0.0) {
        col = foamColor(hit.xz) * (0.55 + 0.6 * wrap);
        alpha = 0.98;
      }
    }

    gl_FragColor = vec4(col, clamp(alpha, 0.0, 1.0));
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

export type LiquidUniforms = {
  uFill: { value: number };
  uSlope: { value: THREE.Vector2 };
  uTime: { value: number };
  uWaves: { value: number };
  uCam: { value: THREE.Vector3 };
  uLight: { value: THREE.Vector3 };
  uColor: { value: THREE.Color };
  uDeep: { value: THREE.Color };
  uDensity: { value: number };
  uOpacity: { value: number };
  uFoam: { value: number };
  uBubbles: { value: number };
  uBottom: { value: number };
  uSurfaceR: { value: number };
};

export function createLiquidUniforms(drink: {
  color: string;
  deep: string;
  density: number;
  opacity: number;
  foam: number;
  bubbles: number;
}, bottom: number): LiquidUniforms {
  return {
    uFill: { value: bottom },
    uSlope: { value: new THREE.Vector2() },
    uTime: { value: 0 },
    uWaves: { value: 0.003 },
    uCam: { value: new THREE.Vector3() },
    uLight: { value: new THREE.Vector3(0, 1, 0) },
    uColor: { value: new THREE.Color(drink.color) },
    uDeep: { value: new THREE.Color(drink.deep) },
    uDensity: { value: drink.density },
    uOpacity: { value: drink.opacity },
    uFoam: { value: drink.foam },
    uBubbles: { value: drink.bubbles },
    uBottom: { value: bottom },
    uSurfaceR: { value: 0 },
  };
}

export function createLiquidMaterial(uniforms: LiquidUniforms, side: THREE.Side) {
  return new THREE.ShaderMaterial({
    uniforms,
    vertexShader,
    fragmentShader,
    side,
    transparent: true,
    depthWrite: false,
  });
}
