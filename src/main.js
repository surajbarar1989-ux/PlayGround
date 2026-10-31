import * as THREE from '../vendor/three.module.js';

/* ============================================================
   SPIDER-MAN — WEB RUSH
   A fan-made, self-contained 3D web-swinging playground.
   Everything is procedural: no external textures or models.
   ============================================================ */

const $ = (id) => document.getElementById(id);
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;
const damp = (a, b, lambda, dt) => lerp(a, b, 1 - Math.exp(-lambda * dt));
const TAU = Math.PI * 2;
const isTouch = matchMedia('(pointer: coarse)').matches;
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

function angleLerp(a, b, t) {
  let d = ((b - a + Math.PI) % TAU + TAU) % TAU - Math.PI;
  return a + d * t;
}

function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rng = mulberry32(0x5E1D3A);
const rr = (a, b) => a + rng() * (b - a);

/* ------------------------------------------------------------
   Renderer / scene
   ------------------------------------------------------------ */
const canvas = $('game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance', alpha: false });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, isTouch ? 1.35 : 1.75));
renderer.setSize(window.innerWidth, window.innerHeight, false);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.02;
renderer.shadowMap.enabled = !isTouch;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0xd2c3b0, 175, 590);

const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, 2200);

const maxAniso = renderer.capabilities.getMaxAnisotropy();

/* ------------------------------------------------------------
   Sky, sun, clouds
   ------------------------------------------------------------ */
const sunDir = new THREE.Vector3(0.52, 0.58, 0.62).normalize();

const skyMat = new THREE.ShaderMaterial({
  side: THREE.BackSide,
  depthWrite: false,
  fog: false,
  uniforms: {
    topColor: { value: new THREE.Color(0x2c5a96) },
    midColor: { value: new THREE.Color(0x8fb4d8) },
    horizonColor: { value: new THREE.Color(0xffd7a4) },
    sunColor: { value: new THREE.Color(0xfff0cc) },
    sunDir: { value: sunDir.clone() }
  },
  vertexShader: /* glsl */`
    varying vec3 vDir;
    void main() {
      vDir = normalize(position);
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }`,
  fragmentShader: /* glsl */`
    varying vec3 vDir;
    uniform vec3 topColor;
    uniform vec3 midColor;
    uniform vec3 horizonColor;
    uniform vec3 sunColor;
    uniform vec3 sunDir;
    void main() {
      float h = clamp(vDir.y, -0.1, 1.0);
      vec3 col = mix(horizonColor, midColor, smoothstep(0.0, 0.22, h));
      col = mix(col, topColor, smoothstep(0.18, 0.72, h));
      float sun = max(dot(normalize(vDir), normalize(sunDir)), 0.0);
      col += sunColor * pow(sun, 420.0) * 2.2;
      col += sunColor * pow(sun, 14.0) * 0.20;
      col += horizonColor * pow(1.0 - abs(h), 8.0) * 0.10;
      gl_FragColor = vec4(col, 1.0);
    }`
});
const sky = new THREE.Mesh(new THREE.SphereGeometry(1500, 40, 22), skyMat);
sky.frustumCulled = false;
scene.add(sky);

const hemi = new THREE.HemisphereLight(0xcfe2ff, 0x5b5147, 1.3);
scene.add(hemi);

const sun = new THREE.DirectionalLight(0xffe0b8, 2.2);
sun.position.set(110, 145, 120);
sun.castShadow = !isTouch;
sun.shadow.mapSize.set(isTouch ? 1024 : 2048, isTouch ? 1024 : 2048);
sun.shadow.camera.left = -95;
sun.shadow.camera.right = 95;
sun.shadow.camera.top = 95;
sun.shadow.camera.bottom = -95;
sun.shadow.camera.near = 1;
sun.shadow.camera.far = 420;
sun.shadow.bias = -0.0006;
sun.shadow.normalBias = 0.55;
scene.add(sun);
scene.add(sun.target);

const fill = new THREE.DirectionalLight(0x8fb4ff, 0.42);
fill.position.set(-80, 60, -90);
scene.add(fill);

/* soft procedural clouds */
function cloudTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');
  g.clearRect(0, 0, 256, 256);
  for (let i = 0; i < 26; i++) {
    const x = 128 + (Math.random() - 0.5) * 150;
    const y = 140 + (Math.random() - 0.5) * 70;
    const r = 22 + Math.random() * 46;
    const grd = g.createRadialGradient(x, y, 0, x, y, r);
    grd.addColorStop(0, 'rgba(255,255,255,0.5)');
    grd.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grd;
    g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
const clouds = [];
for (let i = 0; i < 11; i++) {
  const mat = new THREE.SpriteMaterial({
    map: cloudTexture(), transparent: true, opacity: 0.36 + Math.random() * 0.24,
    depthWrite: false, fog: false, color: 0xfff2e0
  });
  const s = new THREE.Sprite(mat);
  const ang = Math.random() * TAU;
  const rad = 320 + Math.random() * 520;
  s.position.set(Math.cos(ang) * rad, 145 + Math.random() * 130, Math.sin(ang) * rad);
  const sc = 180 + Math.random() * 260;
  s.scale.set(sc, sc * 0.42, 1);
  s.userData.speed = 0.55 + Math.random() * 0.7;
  clouds.push(s);
  scene.add(s);
}

/* ------------------------------------------------------------
   Procedural textures
   ------------------------------------------------------------ */
function makeCanvas(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  return c;
}
function texture(canvas, { repeat = null, srgb = true } = {}) {
  const t = new THREE.CanvasTexture(canvas);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = maxAniso;
  if (repeat) {
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(repeat[0], repeat[1]);
  }
  return t;
}

/* asphalt */
const asphaltTex = texture(makeCanvas(256, 256, (g) => {
  g.fillStyle = '#3a3f47'; g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 5200; i++) {
    const v = 30 + Math.random() * 45;
    g.fillStyle = `rgba(${v},${v + 2},${v + 6},${0.25 + Math.random() * 0.4})`;
    g.fillRect(Math.random() * 256, Math.random() * 256, 1.4, 1.4);
  }
  g.strokeStyle = 'rgba(20,22,26,0.35)'; g.lineWidth = 1;
  for (let i = 0; i < 10; i++) {
    g.beginPath();
    let x = Math.random() * 256, y = Math.random() * 256;
    g.moveTo(x, y);
    for (let k = 0; k < 5; k++) { x += (Math.random() - 0.5) * 40; y += (Math.random() - 0.5) * 40; g.lineTo(x, y); }
    g.stroke();
  }
}), { repeat: [110, 110] });

/* sidewalk pavers */
const sidewalkTex = texture(makeCanvas(256, 256, (g) => {
  g.fillStyle = '#a9a49a'; g.fillRect(0, 0, 256, 256);
  for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) {
    const v = 158 + Math.floor(Math.random() * 26);
    g.fillStyle = `rgb(${v},${v - 3},${v - 10})`;
    g.fillRect(x * 64 + 2, y * 64 + 2, 60, 60);
  }
  g.strokeStyle = 'rgba(80,76,70,0.35)'; g.lineWidth = 2;
  for (let i = 0; i <= 4; i++) {
    g.beginPath(); g.moveTo(i * 64, 0); g.lineTo(i * 64, 256); g.stroke();
    g.beginPath(); g.moveTo(0, i * 64); g.lineTo(256, i * 64); g.stroke();
  }
}), { repeat: [4, 4] });

/* rooftop gravel */
const roofTex = texture(makeCanvas(128, 128, (g) => {
  g.fillStyle = '#7d828b'; g.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 2600; i++) {
    const v = 95 + Math.random() * 55;
    g.fillStyle = `rgba(${v},${v + 2},${v + 7},${0.3 + Math.random() * 0.5})`;
    g.fillRect(Math.random() * 128, Math.random() * 128, 1.6, 1.6);
  }
  g.strokeStyle = 'rgba(60,64,70,0.35)'; g.lineWidth = 1;
  for (let i = 0; i < 4; i++) {
    g.beginPath(); g.moveTo(0, i * 32 + 4); g.lineTo(128, i * 32 + 4); g.stroke();
  }
}), { repeat: [6, 6] });

/* lit windows: several facade styles for variety */
function windowTexture(kind = 0) {
  const c = makeCanvas(128, 256, (g) => {
    if (kind === 2) {
      /* glass curtain wall: horizontal ribbon windows */
      g.fillStyle = '#4f647c'; g.fillRect(0, 0, 128, 256);
      for (let row = 0; row < 16; row++) {
        const y = row * 16;
        const grad = g.createLinearGradient(0, y, 128, y + 12);
        grad.addColorStop(0, '#7fa9cc');
        grad.addColorStop(0.45, '#b9dcf4');
        grad.addColorStop(0.55, '#6f96b8');
        grad.addColorStop(1, '#4b6a88');
        g.fillStyle = grad;
        g.fillRect(0, y + 3, 128, 11);
        if (Math.random() < 0.14) {
          g.fillStyle = 'rgba(255,240,205,0.92)';
          g.fillRect(Math.floor(Math.random() * 8) * 16, y + 3, 16, 11);
        }
        g.fillStyle = 'rgba(20,28,38,0.7)';
        g.fillRect(0, y, 128, 2.5);
      }
      g.fillStyle = 'rgba(20,28,38,0.42)';
      for (let col = 0; col <= 8; col++) g.fillRect(col * 16, 0, 1.6, 256);
      return;
    }
    if (kind === 3) {
      /* brick walk-up with tall sash windows */
      g.fillStyle = '#8a6a58'; g.fillRect(0, 0, 128, 256);
      for (let row = 0; row < 32; row++) {
        const off = row % 2 ? 8 : 0;
        g.strokeStyle = 'rgba(60,42,34,0.32)'; g.lineWidth = 1;
        g.beginPath(); g.moveTo(0, row * 8); g.lineTo(128, row * 8); g.stroke();
        for (let col = 0; col < 16; col++) {
          g.beginPath(); g.moveTo(off + col * 16, row * 8); g.lineTo(off + col * 16, row * 8 + 8); g.stroke();
        }
      }
      for (let row = 0; row < 8; row++) {
        for (let col = 0; col < 4; col++) {
          const x = col * 32 + 8, y = row * 32 + 7;
          g.fillStyle = '#2d3039'; g.fillRect(x - 2, y - 2, 20, 22);
          const lit = Math.random() < 0.3;
          g.fillStyle = lit ? (Math.random() < 0.6 ? '#ffd79b' : '#ffedc9') : '#313a48';
          g.fillRect(x, y, 16, 18);
          g.fillStyle = 'rgba(255,255,255,0.16)'; g.fillRect(x, y, 16, 2);
        }
      }
      return;
    }
    /* punched-window facade */
    g.fillStyle = kind === 1 ? '#78838f' : '#8d97a4'; g.fillRect(0, 0, 128, 256);
    for (let row = 0; row < 16; row++) {
      for (let col = 0; col < 8; col++) {
        const x = col * 16 + 3.5, y = row * 16 + 4;
        const lit = Math.random() < (kind === 1 ? 0.2 : 0.3);
        if (lit) {
          const warm = Math.random();
          g.fillStyle = warm < 0.62 ? '#ffd08b' : (warm < 0.86 ? '#ffe9c2' : '#cfe8ff');
        } else {
          g.fillStyle = Math.random() < 0.5 ? '#2e3742' : '#232b35';
        }
        g.fillRect(x, y, 9, 9);
        g.fillStyle = 'rgba(255,255,255,0.12)';
        g.fillRect(x, y, 9, 1.4);
      }
    }
    g.strokeStyle = 'rgba(18,20,26,0.4)'; g.lineWidth = 1.2;
    for (let row = 0; row <= 16; row++) { g.beginPath(); g.moveTo(0, row * 16); g.lineTo(128, row * 16); g.stroke(); }
    for (let col = 0; col <= 8; col++) { g.beginPath(); g.moveTo(col * 16, 0); g.lineTo(col * 16, 256); g.stroke(); }
  });
  return c;
}
const windowCanvases = [windowTexture(0), windowTexture(1), windowTexture(2), windowTexture(3)];

/* suit webbing */
function suitTexture(base = '#c21622', dark = '#7d0a13') {
  const c = makeCanvas(256, 256, (g) => {
    g.fillStyle = base; g.fillRect(0, 0, 256, 256);
    const grad = g.createLinearGradient(0, 0, 0, 256);
    grad.addColorStop(0, 'rgba(255,120,120,0.22)');
    grad.addColorStop(0.5, 'rgba(0,0,0,0.02)');
    grad.addColorStop(1, 'rgba(0,0,0,0.42)');
    g.fillStyle = grad; g.fillRect(0, 0, 256, 256);
    g.strokeStyle = dark; g.globalAlpha = 0.75;
    g.lineWidth = 3.4;
    for (let x = -32; x < 288; x += 32) {
      g.beginPath(); g.moveTo(x, 0); g.lineTo(x, 256); g.stroke();
    }
    for (let y = -32; y < 288; y += 32) {
      g.beginPath();
      for (let x = 0; x <= 256; x += 16) {
        const yy = y + Math.sin((x / 256) * Math.PI * 3) * 5;
        if (x === 0) g.moveTo(x, yy); else g.lineTo(x, yy);
      }
      g.stroke();
    }
    g.globalAlpha = 1;
  });
  return texture(c);
}
const redSuitTex = suitTexture('#c81724', '#6d0710');

/* spider emblem (chest) */
const emblemTex = texture(makeCanvas(256, 256, (g) => {
  g.clearRect(0, 0, 256, 256);
  g.strokeStyle = '#10131a';
  g.fillStyle = '#10131a';
  g.lineWidth = 11;
  g.lineCap = 'round';
  // body
  g.beginPath(); g.ellipse(128, 116, 15, 34, 0, 0, TAU); g.fill();
  g.beginPath(); g.ellipse(128, 162, 21, 25, 0, 0, TAU); g.fill();
  // legs (4 per side)
  const legs = [
    [[116, 100], [78, 66], [44, 48]],
    [[116, 120], [66, 108], [30, 96]],
    [[116, 144], [70, 164], [36, 190]],
    [[116, 160], [84, 198], [60, 232]],
    [[140, 100], [178, 66], [212, 48]],
    [[140, 120], [190, 108], [226, 96]],
    [[140, 144], [186, 164], [220, 190]],
    [[140, 160], [172, 198], [196, 232]]
  ];
  for (const [a, b, c] of legs) {
    g.beginPath(); g.moveTo(a[0], a[1]); g.quadraticCurveTo(b[0], b[1], c[0], c[1]); g.stroke();
  }
}));

/* generic glow sprite */
const glowTex = texture(makeCanvas(128, 128, (g) => {
  const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grd.addColorStop(0, 'rgba(255,255,255,1)');
  grd.addColorStop(0.25, 'rgba(255,255,255,0.75)');
  grd.addColorStop(0.6, 'rgba(255,255,255,0.16)');
  grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd; g.fillRect(0, 0, 128, 128);
}));
const smokeTex = texture(makeCanvas(128, 128, (g) => {
  const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grd.addColorStop(0, 'rgba(255,255,255,0.9)');
  grd.addColorStop(0.5, 'rgba(255,255,255,0.35)');
  grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd; g.fillRect(0, 0, 128, 128);
}));

/* ------------------------------------------------------------
   City generation
   ------------------------------------------------------------ */
const STEP = 48;
const BLOCK = 34;
const HALF = 3;
const CITY_RADIUS = HALF * STEP + BLOCK / 2 + 4;
const world = {
  buildings: [],
  buildingMeshes: [],
  blocks: [],
  cars: [],
  tokens: [],
  props: []
};

const roadCoordsAll = [];
for (let k = -HALF - 1; k <= HALF; k++) roadCoordsAll.push((k + 0.5) * STEP);

const roofMat = new THREE.MeshStandardMaterial({ map: roofTex, color: 0xa4a9b2, roughness: 0.98, metalness: 0.02 });
const roofMatDark = new THREE.MeshStandardMaterial({ color: 0x3f454f, roughness: 1 });
const concreteMat = new THREE.MeshStandardMaterial({ map: sidewalkTex, color: 0xd6d1c6, roughness: 0.94 });
const parkMat = new THREE.MeshStandardMaterial({ color: 0x5c7a4e, roughness: 1 });
const metalMat = new THREE.MeshStandardMaterial({ color: 0x9aa4b4, roughness: 0.5, metalness: 0.65 });
const darkMetal = new THREE.MeshStandardMaterial({ color: 0x3c4350, roughness: 0.6, metalness: 0.5 });
const trunkMat = new THREE.MeshStandardMaterial({ color: 0x5c4632, roughness: 1 });
const leafMat = new THREE.MeshStandardMaterial({ color: 0x2f5d3a, roughness: 0.9 });
const leafMat2 = new THREE.MeshStandardMaterial({ color: 0x3f7446, roughness: 0.9 });

const palette = [
  [0xa8b2c2, 0x6f7c90],
  [0x8e9fb6, 0x62748c],
  [0xa8927b, 0x77604f],
  [0x94796a, 0x6d564a],
  [0x8f9d96, 0x64736c],
  [0xa38f92, 0x736266],
  [0x93a3b8, 0x687a92]
];

const ground = new THREE.Mesh(
  new THREE.PlaneGeometry(1700, 1700),
  new THREE.MeshStandardMaterial({ map: asphaltTex, color: 0xb9c0cc, roughness: 0.98, metalness: 0.02 })
);
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);

/* sidewalk blocks */
for (let bx = -HALF; bx <= HALF; bx++) {
  for (let bz = -HALF; bz <= HALF; bz++) {
    const isPark = rng() < 0.09 && !(bx === 0 && bz === 0);
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(BLOCK, 0.36, BLOCK), isPark ? parkMat : concreteMat);
    mesh.position.set(bx * STEP, 0.18, bz * STEP);
    mesh.receiveShadow = true;
    scene.add(mesh);
    world.blocks.push({ x: bx * STEP, z: bz * STEP, park: isPark });

    if (isPark) {
      for (let t = 0; t < 7; t++) {
        const tx = bx * STEP + rr(-12, 12);
        const tz = bz * STEP + rr(-12, 12);
        if (Math.abs(tx - bx * STEP) < 3 && Math.abs(tz - bz * STEP) < 3) continue;
        const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.3, 2.6, 6), trunkMat);
        trunk.position.set(tx, 1.65, tz);
        trunk.castShadow = !isTouch;
        scene.add(trunk);
        const crown = new THREE.Mesh(new THREE.IcosahedronGeometry(rr(1.6, 2.5), 0), Math.random() < 0.5 ? leafMat : leafMat2);
        crown.position.set(tx, rr(3.3, 4.2), tz);
        crown.rotation.set(Math.random(), Math.random(), Math.random());
        crown.castShadow = !isTouch;
        scene.add(crown);
      }
    }
  }
}

function addRoofProp(cx, cz, top, w, d) {
  const roll = rng();
  const m = new THREE.Group();
  if (roll < 0.36) {
    const box = new THREE.Mesh(new THREE.BoxGeometry(rr(1.8, 3.4), rr(1, 1.8), rr(1.8, 3.2)), darkMetal);
    box.position.y = 0.8;
    box.castShadow = !isTouch;
    m.add(box);
  } else if (roll < 0.62) {
    const tank = new THREE.Mesh(new THREE.CylinderGeometry(1.25, 1.25, 2.4, 12), new THREE.MeshStandardMaterial({ color: 0x7c6650, roughness: 0.85 }));
    tank.position.y = 2.0;
    tank.castShadow = !isTouch;
    m.add(tank);
    for (let i = 0; i < 3; i++) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.16, 1.2, 0.16), darkMetal);
      leg.position.set(Math.cos(i / 3 * TAU) * 0.9, 0.6, Math.sin(i / 3 * TAU) * 0.9);
      m.add(leg);
    }
  } else if (roll < 0.82) {
    const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.13, rr(5, 11), 6), metalMat);
    mast.position.y = 4;
    m.add(mast);
    const light = new THREE.Mesh(new THREE.SphereGeometry(0.24, 8, 6), new THREE.MeshBasicMaterial({ color: 0xff3b30 }));
    light.position.y = 9;
    m.add(light);
  } else {
    for (let i = 0; i < 3; i++) {
      const box = new THREE.Mesh(new THREE.BoxGeometry(rr(1, 2.2), rr(0.5, 1.1), rr(1, 2.2)), roofMatDark);
      box.position.set(rr(-w * 0.28, w * 0.28), 0.5, rr(-d * 0.28, d * 0.28));
      box.castShadow = !isTouch;
      m.add(box);
    }
  }
  m.position.set(cx + rr(-w * 0.24, w * 0.24), top, cz + rr(-d * 0.24, d * 0.24));
  m.rotation.y = Math.random() * TAU;
  scene.add(m);
  world.props.push(m);
}

function addBuilding(cx, cz, w, d, h, tintIndex, opts = {}) {
  const base = 0.36;
  const [light, dark] = palette[tintIndex % palette.length];
  const styleRoll = rng();
  let canvas;
  if (tintIndex === 1 || tintIndex === 6) canvas = windowCanvases[styleRoll < 0.72 ? 2 : 0];
  else if (tintIndex === 2 || tintIndex === 3) canvas = windowCanvases[styleRoll < 0.68 ? 3 : 1];
  else canvas = windowCanvases[styleRoll < 0.5 ? 0 : (styleRoll < 0.82 ? 1 : 2)];
  const map = texture(canvas, { repeat: [Math.max(1, Math.round(w / 12)), Math.max(1, Math.round(h / 22))] });
  const mapEm = map.clone();
  mapEm.needsUpdate = true;

  const wall = new THREE.MeshStandardMaterial({
    map,
    color: light,
    roughness: 0.86,
    metalness: 0.08,
    emissive: 0xffb766,
    emissiveMap: mapEm,
    emissiveIntensity: 0.26
  });

  const geo = new THREE.BoxGeometry(w, h, d);
  // one material for the whole box: far cheaper than a 6-material array.
  // the textured top face is hidden by a dedicated roof plate.
  const mesh = new THREE.Mesh(geo, wall);
  mesh.position.set(cx, base + h / 2, cz);
  mesh.castShadow = !isTouch;
  mesh.receiveShadow = true;
  scene.add(mesh);

  const roofPlate = new THREE.Mesh(new THREE.BoxGeometry(w + 0.02, 0.16, d + 0.02), roofMat);
  roofPlate.position.set(cx, base + h + 0.08, cz);
  roofPlate.receiveShadow = true;
  scene.add(roofPlate);

  const b = {
    minX: cx - w / 2, maxX: cx + w / 2,
    minZ: cz - d / 2, maxZ: cz + d / 2,
    maxY: base + h + 0.16, cx, cz, w, d, h
  };
  world.buildings.push(b);
  world.buildingMeshes.push(mesh);
  mesh.userData.building = b;

  if (opts.prop !== false && rng() < 0.66) addRoofProp(cx, cz, base + h + 0.28, w, d);
  return b;
}

/* city: 7 x 7 blocks of towers */
for (let bx = -HALF; bx <= HALF; bx++) {
  for (let bz = -HALF; bz <= HALF; bz++) {
    const block = world.blocks[(bx + HALF) * (HALF * 2 + 1) + (bz + HALF)];
    if (block && block.park) continue;
    const cx = bx * STEP;
    const cz = bz * STEP;
    const centerBoost = Math.max(0, 1 - Math.hypot(bx, bz) / 4.6) * 46;

    if (bx === 0 && bz === 0) {
      // landmark tower
      addBuilding(cx, cz, 23, 23, 128, 1, { prop: false });
      const crown = new THREE.Mesh(new THREE.BoxGeometry(14, 8, 14), new THREE.MeshStandardMaterial({ color: 0x77839a, roughness: 0.6, metalness: 0.3 }));
      crown.position.set(cx, 0.36 + 128 + 4, cz);
      crown.castShadow = !isTouch;
      scene.add(crown);
      const spire = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.5, 26, 8), metalMat);
      spire.position.set(cx, 0.36 + 128 + 8 + 13, cz);
      scene.add(spire);
      const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.55, 10, 8), new THREE.MeshBasicMaterial({ color: 0xff2a2a }));
      beacon.position.set(cx, 0.36 + 128 + 8 + 26, cz);
      scene.add(beacon);
      world.beacon = beacon;
      continue;
    }

    const single = rng() < 0.24;
    const cells = single ? [[0, 0, 24, 24]] : null;

    const makePlot = (ox, oz, maxW, maxD, boost = 1) => {
      const w = rr(maxW * 0.62, maxW);
      const d = rr(maxD * 0.62, maxD);
      const h = rr(16, 30) + centerBoost * boost + rng() * rng() * 38;
      const px = cx + ox + rr(-(maxW - w) / 2, (maxW - w) / 2);
      const pz = cz + oz + rr(-(maxD - d) / 2, (maxD - d) / 2);
      addBuilding(px, pz, w, d, h, Math.floor(rng() * palette.length));
    };

    if (cells) {
      makePlot(0, 0, 26, 26, 1.1);
    } else {
      const off = BLOCK / 4;
      const quadrants = [[-off, -off], [off, -off], [-off, off], [off, off]];
      for (const [ox, oz] of quadrants) {
        if (rng() < 0.12) continue;
        makePlot(ox, oz, BLOCK / 2 - 2, BLOCK / 2 - 2);
      }
    }
  }
}

/* distant skyline (non-interactive, instanced) */
{
  const bgTex = texture(windowTexture(0), { repeat: [5, 16] });
  const bgMat = new THREE.MeshStandardMaterial({
    map: bgTex, color: 0x8a94a6, roughness: 0.95,
    emissive: 0xffc27a, emissiveMap: bgTex, emissiveIntensity: 0.16
  });
  const bgGeo = new THREE.BoxGeometry(1, 1, 1);
  const count = 46;
  const inst = new THREE.InstancedMesh(bgGeo, bgMat, count);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const one = new THREE.Vector3(1, 1, 1);
  const col = new THREE.Color();
  for (let i = 0; i < count; i++) {
    const ang = (i / count) * TAU + rr(-0.05, 0.05);
    const rad = rr(235, 420);
    const w = rr(15, 36), d = rr(15, 36), h = rr(30, 130);
    m.compose(new THREE.Vector3(Math.cos(ang) * rad, h / 2, Math.sin(ang) * rad), q, one.clone().set(w, h, d));
    inst.setMatrixAt(i, m);
    const shade = 0.42 + rng() * 0.24;
    col.setRGB(shade * 0.9, shade * 0.96, shade * 1.08);
    inst.setColorAt(i, col);
  }
  inst.instanceMatrix.needsUpdate = true;
  if (inst.instanceColor) inst.instanceColor.needsUpdate = true;
  scene.add(inst);
}

/* road markings */
{
  const dashMat = new THREE.MeshBasicMaterial({ color: 0xf0e6c8, transparent: true, opacity: 0.55 });
  const dashGeo = new THREE.PlaneGeometry(0.3, 3.4);
  const marks = [];
  const roadCoords = [];
  for (let k = -HALF - 1; k <= HALF; k++) roadCoords.push((k + 0.5) * STEP);
  for (const rc of roadCoords) {
    for (let z = -CITY_RADIUS; z < CITY_RADIUS; z += 9) {
      marks.push({ x: rc, z, rot: 0 });
      marks.push({ x: z, z: rc, rot: Math.PI / 2 });
    }
  }
  const inst = new THREE.InstancedMesh(dashGeo, dashMat, marks.length);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  const one = new THREE.Vector3(1, 1, 1);
  marks.forEach((mk, i) => {
    e.set(-Math.PI / 2, 0, mk.rot, 'YXZ');
    q.setFromEuler(e);
    m.compose(new THREE.Vector3(mk.x, 0.015, mk.z), q, one);
    inst.setMatrixAt(i, m);
  });
  inst.instanceMatrix.needsUpdate = true;
  scene.add(inst);

  // solid curb lines around blocks
  const curbMat = new THREE.MeshBasicMaterial({ color: 0xd8d2c3, transparent: true, opacity: 0.28 });
  const curbGeo = new THREE.PlaneGeometry(0.22, BLOCK);
  const curbs = [];
  for (let bx = -HALF; bx <= HALF; bx++) {
    for (let bz = -HALF; bz <= HALF; bz++) {
      const x = bx * STEP, z = bz * STEP;
      curbs.push({ x: x - BLOCK / 2 + 0.3, z, rot: 0 });
      curbs.push({ x: x + BLOCK / 2 - 0.3, z, rot: 0 });
      curbs.push({ x, z: z - BLOCK / 2 + 0.3, rot: Math.PI / 2 });
      curbs.push({ x, z: z + BLOCK / 2 - 0.3, rot: Math.PI / 2 });
    }
  }
  const curbInst = new THREE.InstancedMesh(curbGeo, curbMat, curbs.length);
  curbs.forEach((c, i) => {
    e.set(-Math.PI / 2, 0, c.rot, 'YXZ');
    q.setFromEuler(e);
    m.compose(new THREE.Vector3(c.x, 0.02, c.z), q, one);
    curbInst.setMatrixAt(i, m);
  });
  curbInst.instanceMatrix.needsUpdate = true;
  scene.add(curbInst);
}

/* crosswalks */
{
  const stripeGeo = new THREE.PlaneGeometry(0.55, 7.2);
  const stripeMat = new THREE.MeshBasicMaterial({ color: 0xf2eee2, transparent: true, opacity: 0.38 });
  const spots = [];
  const intersections = [];
  for (const rx of roadCoordsAll) for (const rz of roadCoordsAll) intersections.push([rx, rz]);
  for (const [rx, rz] of intersections) {
    if (Math.abs(rx) > CITY_RADIUS || Math.abs(rz) > CITY_RADIUS) continue;
    for (const s of [-1, 1]) {
      for (let i = 0; i < 6; i++) {
        spots.push({ x: rx + s * 9.3, z: rz - 6 + i * 2.35, rot: 0 });
        spots.push({ x: rx - 6 + i * 2.35, z: rz + s * 9.3, rot: Math.PI / 2 });
      }
    }
  }
  const inst = new THREE.InstancedMesh(stripeGeo, stripeMat, spots.length);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  const one = new THREE.Vector3(1, 1, 1);
  spots.forEach((s, i) => {
    e.set(-Math.PI / 2, 0, s.rot, 'YXZ');
    q.setFromEuler(e);
    m.compose(new THREE.Vector3(s.x, 0.018, s.z), q, one);
    inst.setMatrixAt(i, m);
  });
  inst.instanceMatrix.needsUpdate = true;
  scene.add(inst);
}

/* street lamps (instanced, two draw calls total) */
{
  const lamps = [];
  for (const rc of roadCoordsAll) {
    for (let t = -CITY_RADIUS + 12; t <= CITY_RADIUS - 12; t += 34) {
      lamps.push([rc - 6.1, t]);
      lamps.push([rc + 6.1, t + 17]);
      lamps.push([t, rc - 6.1]);
      lamps.push([t + 17, rc + 6.1]);
    }
  }
  const poleGeo = new THREE.CylinderGeometry(0.06, 0.1, 5.4, 5);
  const poleMat = new THREE.MeshStandardMaterial({ color: 0x2c3340, roughness: 0.6, metalness: 0.4 });
  const headGeo = new THREE.BoxGeometry(0.55, 0.22, 0.3);
  const headMat = new THREE.MeshBasicMaterial({ color: 0xffe2a8 });
  const poleInst = new THREE.InstancedMesh(poleGeo, poleMat, lamps.length);
  const headInst = new THREE.InstancedMesh(headGeo, headMat, lamps.length);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const one = new THREE.Vector3(1, 1, 1);
  lamps.forEach(([x, z], i) => {
    m.compose(new THREE.Vector3(x, 2.7, z), q, one);
    poleInst.setMatrixAt(i, m);
    m.compose(new THREE.Vector3(x, 5.35, z), q, one);
    headInst.setMatrixAt(i, m);
  });
  poleInst.instanceMatrix.needsUpdate = true;
  headInst.instanceMatrix.needsUpdate = true;
  scene.add(poleInst, headInst);
}

/* neon signs on tall facades */
{
  const names = [
    ['DAILY BUGLE', '#ff2b3a', '#ffd9de'],
    ['OSCORP', '#43e0ff', '#d9fbff'],
    ['ALCHEMAX', '#ffcc4d', '#fff3cf'],
    ['WEB LAB', '#ff4d6d', '#ffe0e6'],
    ['MIDTOWN', '#7ea8ff', '#e9f1ff'],
    ['EMPIRE', '#ff9f43', '#fff0d6'],
    ['QUEENS', '#58e08b', '#e2ffee'],
    ['24 HOUR NEWS', '#ff3b52', '#ffe3e7']
  ];
  const tall = world.buildings.filter((b) => b.h > 38).sort(() => rng() - 0.5).slice(0, names.length);
  tall.forEach((b, i) => {
    const [label, glow, ink] = names[i];
    const c = makeCanvas(512, 256, (g) => {
      g.fillStyle = '#0a0e18'; g.fillRect(0, 0, 512, 256);
      g.strokeStyle = glow; g.lineWidth = 10;
      g.strokeRect(14, 14, 484, 228);
      g.shadowColor = glow; g.shadowBlur = 30;
      g.fillStyle = glow;
      g.font = `900 ${label.length > 10 ? 58 : 76}px Arial Black, Arial, sans-serif`;
      g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText(label, 256, 128);
      g.shadowBlur = 0;
      g.fillStyle = ink;
      g.font = '700 22px Arial, sans-serif';
      g.fillText('— NEW YORK CITY —', 256, 202);
    });
    const billTex = texture(c);
    const billMat = new THREE.MeshBasicMaterial({ map: billTex, toneMapped: false });
    const side = Math.floor(rng() * 4);
    const bw = Math.min(b.w * 0.8, 13);
    const bh = bw * 0.5;
    const plane = new THREE.Mesh(new THREE.PlaneGeometry(bw, bh), billMat);
    const y = 0.36 + b.h * rr(0.45, 0.72);
    if (side === 0) { plane.position.set(b.cx, y, b.maxZ + 0.08); }
    else if (side === 1) { plane.position.set(b.cx, y, b.minZ - 0.08); plane.rotation.y = Math.PI; }
    else if (side === 2) { plane.position.set(b.maxX + 0.08, y, b.cz); plane.rotation.y = Math.PI / 2; }
    else { plane.position.set(b.minX - 0.08, y, b.cz); plane.rotation.y = -Math.PI / 2; }
    scene.add(plane);
  });
}

/* traffic — every car part is instanced, so the whole fleet is 5 draw calls */
const CAR_COUNT = 56;
const carColors = [0xd9dde4, 0x242a33, 0xc22b32, 0x2f5c9e, 0xcdb46b, 0x3e7c66, 0x8b919c];
const carUp = new THREE.Vector3(0, 1, 0);
const carWheelQ = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), Math.PI / 2);

const carBodyInst = new THREE.InstancedMesh(
  new THREE.BoxGeometry(1.7, 0.52, 3.6),
  new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.35, metalness: 0.55 }),
  CAR_COUNT
);
const carCabinInst = new THREE.InstancedMesh(
  new THREE.BoxGeometry(1.4, 0.44, 1.7),
  new THREE.MeshStandardMaterial({ color: 0x1a2230, roughness: 0.2, metalness: 0.6 }),
  CAR_COUNT
);
const carWheelInst = new THREE.InstancedMesh(
  new THREE.CylinderGeometry(0.3, 0.3, 0.24, 10),
  darkMetal,
  CAR_COUNT * 4
);
const carHeadInst = new THREE.InstancedMesh(
  new THREE.BoxGeometry(0.32, 0.16, 0.08),
  new THREE.MeshBasicMaterial({ color: 0xfff3cf }),
  CAR_COUNT * 2
);
const carTailInst = new THREE.InstancedMesh(
  new THREE.BoxGeometry(0.3, 0.14, 0.06),
  new THREE.MeshBasicMaterial({ color: 0xff2d2d }),
  CAR_COUNT * 2
);
for (const inst of [carBodyInst, carCabinInst, carWheelInst, carHeadInst, carTailInst]) {
  inst.frustumCulled = false;
  scene.add(inst);
}
carBodyInst.castShadow = !isTouch;
carCabinInst.castShadow = !isTouch;
carWheelInst.castShadow = !isTouch;

for (let i = 0; i < CAR_COUNT; i++) {
  const alongX = rng() < 0.5;
  const lane = roadCoordsAll[Math.floor(rng() * roadCoordsAll.length)] + (rng() < 0.5 ? -2.1 : 2.1);
  const dir = rng() < 0.5 ? 1 : -1;
  const along = rr(-CITY_RADIUS, CITY_RADIUS);
  const speed = rr(7, 15);
  const c = { alongX, lane, along, dir, speed, yaw: 0 };
  world.cars.push(c);
  carBodyInst.setColorAt(i, new THREE.Color(carColors[Math.floor(rng() * carColors.length)]));
}
if (carBodyInst.instanceColor) carBodyInst.instanceColor.needsUpdate = true;

const carMat = new THREE.Matrix4();
const carQ = new THREE.Quaternion();
const carWheelQtmp = new THREE.Quaternion();
const carPos = new THREE.Vector3();
const carLocal = new THREE.Vector3();
const carOne = new THREE.Vector3(1, 1, 1);
function updateCarInstances() {
  world.cars.forEach((c, i) => {
    const x = c.alongX ? c.along : c.lane;
    const z = c.alongX ? c.lane : c.along;
    c.yaw = c.alongX ? (c.dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (c.dir > 0 ? 0 : Math.PI);
    carQ.setFromAxisAngle(carUp, c.yaw);
    carPos.set(x, 0, z);

    carLocal.set(0, 0.42, 0).applyQuaternion(carQ).add(carPos);
    carMat.compose(carLocal, carQ, carOne);
    carBodyInst.setMatrixAt(i, carMat);

    carLocal.set(0, 0.86, -0.1).applyQuaternion(carQ).add(carPos);
    carMat.compose(carLocal, carQ, carOne);
    carCabinInst.setMatrixAt(i, carMat);

    for (let w = 0; w < 4; w++) {
      const lx = w % 2 ? 0.8 : -0.8;
      const lz = w < 2 ? 1.15 : -1.15;
      carLocal.set(lx, 0.28, lz).applyQuaternion(carQ).add(carPos);
      carWheelQtmp.copy(carQ).multiply(carWheelQ);
      carMat.compose(carLocal, carWheelQtmp, carOne);
      carWheelInst.setMatrixAt(i * 4 + w, carMat);
    }
    for (let s = 0; s < 2; s++) {
      const lx = s === 0 ? -0.55 : 0.55;
      carLocal.set(lx, 0.45, 1.82).applyQuaternion(carQ).add(carPos);
      carMat.compose(carLocal, carQ, carOne);
      carHeadInst.setMatrixAt(i * 2 + s, carMat);
      carLocal.set(lx, 0.45, -1.84).applyQuaternion(carQ).add(carPos);
      carMat.compose(carLocal, carQ, carOne);
      carTailInst.setMatrixAt(i * 2 + s, carMat);
    }
  });
  carBodyInst.instanceMatrix.needsUpdate = true;
  carCabinInst.instanceMatrix.needsUpdate = true;
  carWheelInst.instanceMatrix.needsUpdate = true;
  carHeadInst.instanceMatrix.needsUpdate = true;
  carTailInst.instanceMatrix.needsUpdate = true;
}
updateCarInstances();

/* ------------------------------------------------------------
   Spider-tokens
   ------------------------------------------------------------ */
const tokenRoot = new THREE.Group();
scene.add(tokenRoot);
const tokenCoreMat = new THREE.MeshStandardMaterial({
  color: 0xff3a3a, emissive: 0xff6a2a, emissiveIntensity: 0.65, roughness: 0.25, metalness: 0.55
});
const tokenRingMat = new THREE.MeshStandardMaterial({
  color: 0xffcf5c, emissive: 0xffb62e, emissiveIntensity: 1.4, roughness: 0.25, metalness: 0.8
});

const tokenPositions = [
  [24, 5.5, 112], [24, 9, 66], [24, 15, 22], [-24, 12, -18], [24, 20, -60], [72, 22, 24],
  [-72, 26, 24], [24, 30, -110], [-24, 10, 96]
];

const towerRoofs = world.buildings
  .filter((b) => b.h > 26)
  .sort(() => rng() - 0.5)
  .slice(0, 9)
  .map((b) => [b.cx, b.maxY + 3.2, b.cz]);

const airSpots = [];
while (airSpots.length < 6) {
  const i = Math.floor(rng() * (HALF * 2 + 1)) - HALF;
  const j = Math.floor(rng() * (HALF * 2 + 1)) - HALF;
  const pos = [(i + 0.5) * STEP, rr(14, 38), (j + 0.5) * STEP];
  if (airSpots.some((p) => Math.hypot(p[0] - pos[0], p[2] - pos[2]) < 22)) continue;
  airSpots.push(pos);
}

const allTokenPositions = [...tokenPositions, ...towerRoofs, ...airSpots].slice(0, 24);
const tokenGeo = new THREE.IcosahedronGeometry(0.55, 0);
const tokenRingGeo = new THREE.TorusGeometry(0.85, 0.1, 8, 22);
allTokenPositions.forEach((pos, i) => {
  const g = new THREE.Group();
  const core = new THREE.Mesh(tokenGeo, tokenCoreMat);
  core.castShadow = false;
  g.add(core);
  const ring = new THREE.Mesh(tokenRingGeo, tokenRingMat);
  ring.rotation.x = Math.PI / 2;
  g.add(ring);
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({
    map: glowTex, color: 0xffb648, transparent: true, opacity: 0.48,
    blending: THREE.AdditiveBlending, depthWrite: false
  }));
  halo.scale.set(2.1, 2.1, 1);
  g.add(halo);
  g.position.set(pos[0], pos[1], pos[2]);
  g.userData = { baseY: pos[1], phase: rng() * TAU, collected: false, index: i, core, ring, halo };
  tokenRoot.add(g);
  world.tokens.push(g);
});

/* ------------------------------------------------------------
   Spider-Man character (stylized, procedural)
   ------------------------------------------------------------ */
const blueMat = new THREE.MeshStandardMaterial({ color: 0x1d3f8c, roughness: 0.52, metalness: 0.14 });
const blueDarkMat = new THREE.MeshStandardMaterial({ color: 0x142e68, roughness: 0.6, metalness: 0.1 });
const redMat = new THREE.MeshStandardMaterial({ map: redSuitTex, color: 0xffffff, roughness: 0.48, metalness: 0.08 });
const redPlain = new THREE.MeshStandardMaterial({ color: 0xb51522, roughness: 0.46, metalness: 0.1 });
const eyeMat = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xdff0ff, emissiveIntensity: 0.35, roughness: 0.15 });
const eyeRimMat = new THREE.MeshStandardMaterial({ color: 0x0b0d12, roughness: 0.4 });

const player = new THREE.Group();
player.position.set(24, 0, 120);
scene.add(player);

const rig = new THREE.Group();
player.add(rig);

const hips = new THREE.Mesh(new THREE.CapsuleGeometry(0.27, 0.18, 5, 12), blueDarkMat);
hips.position.y = 1.0;
hips.scale.z = 0.85;
rig.add(hips);

const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.35, 0.44, 6, 16), redMat);
torso.position.y = 1.45;
torso.scale.set(1.05, 1, 0.72);
rig.add(torso);

const belt = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.34, 0.12, 14), blueDarkMat);
belt.position.y = 1.12;
belt.scale.z = 0.79;
rig.add(belt);

const emblem = new THREE.Mesh(
  new THREE.PlaneGeometry(0.5, 0.56),
  new THREE.MeshBasicMaterial({ map: emblemTex, transparent: true, depthWrite: false })
);
emblem.position.set(0, 1.5, 0.255);
rig.add(emblem);

const head = new THREE.Mesh(new THREE.SphereGeometry(0.29, 20, 16), redMat);
head.scale.set(1, 1.13, 1.02);
head.position.y = 2.06;
rig.add(head);

const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.17, 0.16, 10), redPlain);
neck.position.y = 1.88;
rig.add(neck);

for (const side of [-1, 1]) {
  const eyeRim = new THREE.Mesh(new THREE.SphereGeometry(0.145, 12, 10), eyeRimMat);
  eyeRim.scale.set(0.92, 1.22, 0.26);
  eyeRim.position.set(side * 0.105, 2.09, 0.245);
  eyeRim.rotation.z = side * -0.38;
  eyeRim.rotation.y = side * 0.16;
  rig.add(eyeRim);
  const eye = new THREE.Mesh(new THREE.SphereGeometry(0.12, 12, 10), eyeMat);
  eye.scale.set(0.9, 1.2, 0.24);
  eye.position.set(side * 0.103, 2.095, 0.262);
  eye.rotation.z = side * -0.38;
  eye.rotation.y = side * 0.16;
  rig.add(eye);
}

function makeLimbMesh(radius, length, material) {
  const pivot = new THREE.Group();
  const geo = new THREE.CapsuleGeometry(radius, length, 5, 10);
  const mesh = new THREE.Mesh(geo, material);
  mesh.position.y = -(length / 2 + radius * 0.35);
  mesh.castShadow = !isTouch;
  pivot.add(mesh);
  return pivot;
}

function makeArm(side) {
  const shoulder = new THREE.Group();
  shoulder.position.set(side * 0.43, 1.72, 0);
  const upper = makeLimbMesh(0.11, 0.42, blueMat);
  shoulder.add(upper);
  const elbow = new THREE.Group();
  elbow.position.y = -0.6;
  const fore = makeLimbMesh(0.1, 0.4, redMat);
  elbow.add(fore);
  const hand = new THREE.Mesh(new THREE.SphereGeometry(0.13, 10, 8), redPlain);
  hand.position.y = -0.56;
  hand.scale.set(0.9, 1.05, 0.8);
  hand.castShadow = !isTouch;
  elbow.add(hand);
  shoulder.add(elbow);
  rig.add(shoulder);
  return { shoulder, elbow, hand };
}

function makeLeg(side) {
  const hip = new THREE.Group();
  hip.position.set(side * 0.18, 1.0, 0);
  const thigh = makeLimbMesh(0.14, 0.4, blueMat);
  hip.add(thigh);
  const knee = new THREE.Group();
  knee.position.y = -0.58;
  const shin = makeLimbMesh(0.12, 0.38, blueMat);
  knee.add(shin);
  const boot = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.2, 0.42), redPlain);
  boot.position.set(0, -0.52, 0.06);
  boot.castShadow = !isTouch;
  knee.add(boot);
  hip.add(knee);
  rig.add(hip);
  return { hip, knee, boot };
}

const armL = makeArm(-1);
const armR = makeArm(1);
const legL = makeLeg(-1);
const legR = makeLeg(1);

/* chest emblem needs to sit above the torso surface */
emblem.renderOrder = 2;

/* soft blob shadow under the player */
const blobShadow = new THREE.Sprite(new THREE.SpriteMaterial({
  map: smokeTex, color: 0x05070b, transparent: true, opacity: 0.34, depthWrite: false
}));
blobShadow.scale.set(2.3, 1.2, 1);
scene.add(blobShadow);

/* ------------------------------------------------------------
   Web line + effects
   ------------------------------------------------------------ */
const webMat = new THREE.MeshBasicMaterial({ color: 0xf4f8ff, transparent: true, opacity: 0.92 });
const webLine = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 1, 6), webMat);
webLine.visible = false;
webLine.frustumCulled = false;
scene.add(webLine);

const webRing = new THREE.Mesh(
  new THREE.RingGeometry(0.5, 0.72, 26),
  new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false })
);
webRing.visible = false;
webRing.frustumCulled = false;
scene.add(webRing);
let webRingLife = 0;
let webRingPos = new THREE.Vector3();

const particles = [];
const particleGeo = new THREE.PlaneGeometry(1, 1);
for (let i = 0; i < 90; i++) {
  const mat = new THREE.SpriteMaterial({
    map: smokeTex, transparent: true, opacity: 0, depthWrite: false,
    blending: THREE.AdditiveBlending, color: 0xffffff
  });
  const s = new THREE.Sprite(mat);
  s.visible = false;
  s.scale.set(1, 1, 1);
  scene.add(s);
  particles.push({ sprite: s, life: 0, maxLife: 1, vel: new THREE.Vector3(), size: 1, gravity: 0, fade: 1 });
}
let particleCursor = 0;
function spawnParticle(pos, vel, { color = 0xffffff, size = 0.7, life = 0.7, gravity = 4, fade = 1, additive = true } = {}) {
  const p = particles[particleCursor];
  particleCursor = (particleCursor + 1) % particles.length;
  p.sprite.visible = true;
  p.sprite.position.copy(pos);
  p.sprite.material.color.set(color);
  p.sprite.material.blending = additive ? THREE.AdditiveBlending : THREE.NormalBlending;
  p.sprite.material.opacity = 0.9;
  p.sprite.scale.set(size, size, 1);
  p.vel.copy(vel);
  p.life = life;
  p.maxLife = life;
  p.size = size;
  p.gravity = gravity;
  p.fade = fade;
}
function updateParticles(dt) {
  for (const p of particles) {
    if (p.life <= 0) continue;
    p.life -= dt;
    if (p.life <= 0) { p.sprite.visible = false; continue; }
    p.vel.y -= p.gravity * dt;
    p.vel.multiplyScalar(1 - 1.4 * dt);
    p.sprite.position.addScaledVector(p.vel, dt);
    const k = p.life / p.maxLife;
    p.sprite.material.opacity = Math.min(1, k * 1.4) * p.fade;
    const s = p.size * (1 + (1 - k) * 0.9);
    p.sprite.scale.set(s, s, 1);
  }
}

function burst(pos, count, color, speed = 5, size = 0.5, life = 0.6) {
  for (let i = 0; i < count; i++) {
    const v = new THREE.Vector3(
      (Math.random() - 0.5) * 2,
      (Math.random() - 0.5) * 2,
      (Math.random() - 0.5) * 2
    ).normalize().multiplyScalar(speed * (0.4 + Math.random() * 0.8));
    v.y += speed * 0.3;
    spawnParticle(pos, v, { color, size: size * (0.6 + Math.random() * 0.8), life: life * (0.7 + Math.random() * 0.6), gravity: 3 });
  }
}

/* ------------------------------------------------------------
   Audio (synthesized)
   ------------------------------------------------------------ */
const audio = {
  ctx: null, master: null, windGain: null, windFilter: null, muted: false,
  init() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    try {
      const ctx = new AC();
      this.ctx = ctx;
      this.master = ctx.createGain();
      this.master.gain.value = 0.55;
      this.master.connect(ctx.destination);

      const len = ctx.sampleRate * 2;
      const buf = ctx.createBuffer(1, len, ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
      const src = ctx.createBufferSource();
      src.buffer = buf; src.loop = true;
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass'; filter.frequency.value = 320; filter.Q.value = 0.7;
      const gain = ctx.createGain(); gain.gain.value = 0;
      src.connect(filter); filter.connect(gain); gain.connect(this.master);
      src.start();
      this.windGain = gain; this.windFilter = filter;
    } catch (e) { /* audio optional */ }
  },
  noise(dur, freq, q, vol, type = 'bandpass') {
    if (!this.ctx) return;
    const ctx = this.ctx, now = ctx.currentTime;
    const len = Math.floor(ctx.sampleRate * dur);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource(); src.buffer = buf;
    const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + dur);
    src.connect(f); f.connect(g); g.connect(this.master);
    src.start(now);
  },
  tone(freq, end, dur, vol = 0.15, type = 'sine', delay = 0) {
    if (!this.ctx) return;
    const ctx = this.ctx, t = ctx.currentTime + delay;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    o.frequency.exponentialRampToValueAtTime(Math.max(20, end), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(this.master);
    o.start(t); o.stop(t + dur + 0.02);
  },
  thwip() {
    this.noise(0.09, 2600, 1.4, 0.35);
    this.tone(1100, 180, 0.13, 0.1, 'triangle');
  },
  jump() {
    this.noise(0.16, 900, 0.8, 0.14);
    this.tone(240, 520, 0.16, 0.06, 'sine');
  },
  land(strength = 1) {
    this.tone(120, 38, 0.2, 0.16 * clamp(strength, 0.4, 1.4), 'sine');
    this.noise(0.12, 260, 0.7, 0.1 * strength, 'lowpass');
  },
  collect(i) {
    const scale = [0, 2, 4, 7, 9];
    const semi = scale[i % scale.length] + Math.floor(i / scale.length) * 12;
    const f = 440 * Math.pow(2, semi / 12);
    this.tone(f, f, 0.24, 0.1, 'sine');
    this.tone(f * 1.5, f * 1.5, 0.34, 0.06, 'triangle', 0.06);
    this.tone(f * 2, f * 2, 0.42, 0.035, 'sine', 0.12);
  },
  win() {
    const notes = [523, 659, 784, 1046, 1318];
    notes.forEach((n, i) => this.tone(n, n, 0.6, 0.09, 'triangle', i * 0.11));
  },
  setWind(speed) {
    if (!this.ctx || !this.windGain) return;
    const t = this.ctx.currentTime;
    const target = clamp((speed - 9) / 58, 0, 1) * 0.22;
    this.windGain.gain.setTargetAtTime(target, t, 0.14);
    this.windFilter.frequency.setTargetAtTime(300 + speed * 13, t, 0.16);
  },
  toggleMute() {
    this.muted = !this.muted;
    if (this.master) this.master.gain.setTargetAtTime(this.muted ? 0 : 0.55, this.ctx.currentTime, 0.05);
    return this.muted;
  }
};

/* ------------------------------------------------------------
   Input
   ------------------------------------------------------------ */
const keys = Object.create(null);
const input = {
  web: false,
  jumpQueued: false,
  stickX: 0,
  stickY: 0,
  sprint: false
};
let camYaw = 0;
let camPitch = 0.22;
let camDistUser = 8.4;
let dragging = false;
let lastPointer = { x: 0, y: 0 };

window.addEventListener('keydown', (e) => {
  if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ShiftLeft', 'ShiftRight'].includes(e.code)) e.preventDefault();
  if (e.repeat) return;
  keys[e.code] = true;
  if (e.code === 'Space') {
    input.web = true;
    input.jumpQueued = true;
  }
  if (e.code === 'KeyM') {
    const muted = audio.toggleMute();
    $('muteBtn').classList.toggle('off', muted);
    $('muteBtn').textContent = muted ? '×' : '♪';
  }
  if (e.code === 'KeyR' && state.phase === 'playing') respawn();
  if (e.code === 'Escape') closeHelp();
});
window.addEventListener('keyup', (e) => {
  keys[e.code] = false;
  if (e.code === 'Space') input.web = false;
});

window.addEventListener('blur', () => {
  for (const k in keys) keys[k] = false;
  input.web = false;
});

canvas.addEventListener('mousedown', (e) => {
  if (e.button !== 0) return;
  if (document.pointerLockElement !== canvas) {
    canvas.requestPointerLock?.();
  }
  dragging = true;
  lastPointer = { x: e.clientX, y: e.clientY };
  audio.init();
});
window.addEventListener('mouseup', () => { dragging = false; });
window.addEventListener('mousemove', (e) => {
  if (document.pointerLockElement === canvas) {
    camYaw -= e.movementX * 0.0022;
    camPitch = clamp(camPitch + e.movementY * 0.0018, -0.18, 1.16);
  } else if (dragging) {
    camYaw -= (e.clientX - lastPointer.x) * 0.005;
    camPitch = clamp(camPitch + (e.clientY - lastPointer.y) * 0.003, -0.18, 1.16);
    lastPointer = { x: e.clientX, y: e.clientY };
  }
});
canvas.addEventListener('wheel', (e) => {
  e.preventDefault();
  camDistUser = clamp(camDistUser + Math.sign(e.deltaY) * 0.8, 4.5, 14);
}, { passive: false });

/* touch look (drag anywhere on the canvas) */
let touchLookId = null;
canvas.addEventListener('pointerdown', (e) => {
  if (e.pointerType === 'mouse') return;
  touchLookId = e.pointerId;
  lastPointer = { x: e.clientX, y: e.clientY };
  audio.init();
});
canvas.addEventListener('pointermove', (e) => {
  if (e.pointerId !== touchLookId) return;
  camYaw -= (e.clientX - lastPointer.x) * 0.0055;
  camPitch = clamp(camPitch + (e.clientY - lastPointer.y) * 0.0035, -0.18, 1.16);
  lastPointer = { x: e.clientX, y: e.clientY };
});
function endTouchLook(e) { if (e.pointerId === touchLookId) touchLookId = null; }
canvas.addEventListener('pointerup', endTouchLook);
canvas.addEventListener('pointercancel', endTouchLook);

/* virtual joystick */
const stick = $('stick');
const knob = $('stickKnob');
let stickId = null;
function setStickFromEvent(e) {
  const r = stick.getBoundingClientRect();
  const cx = r.left + r.width / 2;
  const cy = r.top + r.height / 2;
  let dx = (e.clientX - cx) / (r.width * 0.42);
  let dy = (e.clientY - cy) / (r.height * 0.42);
  const len = Math.hypot(dx, dy);
  if (len > 1) { dx /= len; dy /= len; }
  input.stickX = dx;
  input.stickY = dy;
  knob.style.transform = `translate(${dx * 34}px, ${dy * 34}px)`;
  input.sprint = len > 0.78;
}
stick.addEventListener('pointerdown', (e) => {
  e.preventDefault();
  stickId = e.pointerId;
  try { stick.setPointerCapture?.(e.pointerId); } catch (err) { /* synthetic pointers */ }
  setStickFromEvent(e);
  audio.init();
});
stick.addEventListener('pointermove', (e) => {
  if (e.pointerId !== stickId) return;
  e.preventDefault();
  setStickFromEvent(e);
});
function releaseStick(e) {
  if (e.pointerId !== stickId) return;
  stickId = null;
  input.stickX = 0; input.stickY = 0; input.sprint = false;
  knob.style.transform = 'translate(0px, 0px)';
}
stick.addEventListener('pointerup', releaseStick);
stick.addEventListener('pointercancel', releaseStick);

/* touch action buttons */
const webBtn = $('webBtn');
const jumpBtn = $('jumpBtn');
function bindHold(el, onDown, onUp) {
  el.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    el.classList.add('active');
    try { el.setPointerCapture?.(e.pointerId); } catch (err) { /* synthetic pointers */ }
    onDown();
    audio.init();
  });
  const up = () => { el.classList.remove('active'); onUp(); };
  el.addEventListener('pointerup', up);
  el.addEventListener('pointercancel', up);
  el.addEventListener('pointerleave', (e) => { if (e.buttons === 0) up(); });
}
bindHold(webBtn, () => {
  input.web = true;
  if (state.phase === 'playing' && grounded) input.jumpQueued = true;
}, () => { input.web = false; });
bindHold(jumpBtn, () => { input.jumpQueued = true; }, () => {});

/* ------------------------------------------------------------
   Game state
   ------------------------------------------------------------ */
const state = {
  phase: 'menu', // menu | playing | win
  tokens: 0,
  total: world.tokens.length,
  swings: 0,
  topSpeed: 0,
  runStart: 0,
  elapsed: 0,
  grounded: true,
  maxHeight: 0
};

const web = {
  active: false,
  anchor: new THREE.Vector3(),
  length: 0,
  cooldown: 0,
  handAlternate: 0,
  age: 0
};

const velocity = new THREE.Vector3();
let grounded = false;
let supportY = 0;
let runPhase = 0;
let shake = 0;
let attachFlash = 0;
let windAccum = 0;
let toastUntil = 0;
let camDistSmooth = 8.4;
const camTarget = new THREE.Vector3(24, 1.5, 120);
const raycaster = new THREE.Raycaster();
raycaster.far = 70;

function setTokenTotalUI() {
  $('tokenTotal').textContent = state.total;
  $('tokenFill').style.width = '0%';
}

function toast(text, ms = 1800) {
  const el = $('toast');
  el.textContent = text;
  el.classList.add('show');
  toastUntil = performance.now() + ms;
}

function updateHUD() {
  $('tokenCount').textContent = state.tokens;
  $('tokenFill').style.width = `${(state.tokens / state.total) * 100}%`;
}

function formatTime(sec) {
  const s = Math.max(0, Math.floor(sec));
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

/* ------------------------------------------------------------
   Physics helpers
   ------------------------------------------------------------ */
function baseGroundAt(x, z) {
  const bx = Math.round(x / STEP);
  const bz = Math.round(z / STEP);
  if (Math.abs(bx) > HALF || Math.abs(bz) > HALF) return 0;
  if (Math.abs(x - bx * STEP) <= BLOCK / 2 && Math.abs(z - bz * STEP) <= BLOCK / 2) return 0.36;
  return 0;
}

function resetPlayer(position = null) {
  if (position) player.position.copy(position);
  velocity.set(0, 0, 0);
  web.active = false;
  webLine.visible = false;
  grounded = false;
  player.rotation.y = Math.PI;
  camYaw = 0;
  camPitch = 0.2;
  snapCamera();
}

function snapCamera() {
  const offset = new THREE.Vector3(
    Math.sin(camYaw) * Math.cos(camPitch),
    Math.sin(camPitch),
    Math.cos(camYaw) * Math.cos(camPitch)
  ).normalize().multiplyScalar(camDistUser);
  camTarget.set(player.position.x, player.position.y + 1.55, player.position.z);
  camera.position.copy(camTarget).add(offset);
  camDistSmooth = camDistUser;
  camera.fov = 62;
  camera.lookAt(camTarget);
  camera.updateProjectionMatrix();
}

function respawn() {
  let best = null, bestD = Infinity;
  for (const b of world.buildings) {
    const d = Math.hypot(b.cx - player.position.x, b.cz - player.position.z);
    if (d < bestD) { bestD = d; best = b; }
  }
  if (best) {
    resetPlayer(new THREE.Vector3(best.cx, best.maxY + 1.2, best.cz));
  } else {
    resetPlayer(new THREE.Vector3(24, 0, 120));
  }
  toast('RESPAWNED · FIND THE TOKENS');
}

/* ------------------------------------------------------------
   Web-swing mechanics
   ------------------------------------------------------------ */
function cameraForward(out = new THREE.Vector3()) {
  return out.set(-Math.sin(camYaw), 0, -Math.cos(camYaw)).normalize();
}

function tryAttachWeb() {
  if (web.active || web.cooldown > 0 || grounded) return;
  const origin = player.position.clone().add(new THREE.Vector3(0, 1.7, 0));
  const fwd = cameraForward();
  const up = new THREE.Vector3(0, 1, 0);
  const side = new THREE.Vector3(fwd.z, 0, -fwd.x);

  const dirs = [
    fwd.clone().multiplyScalar(0.42).add(up.clone().multiplyScalar(1.0)),
    fwd.clone().multiplyScalar(0.95).add(up.clone().multiplyScalar(0.72)),
    fwd.clone().multiplyScalar(0.2).add(up.clone().multiplyScalar(1.35)),
    fwd.clone().multiplyScalar(0.7).add(side.clone().multiplyScalar(0.62)).add(up.clone().multiplyScalar(0.9)),
    fwd.clone().multiplyScalar(0.7).add(side.clone().multiplyScalar(-0.62)).add(up.clone().multiplyScalar(0.9))
  ].map((d) => d.normalize());

  let best = null;
  for (const dir of dirs) {
    raycaster.set(origin, dir);
    raycaster.far = 90;
    const hits = raycaster.intersectObjects(world.buildingMeshes, false);
    if (!hits.length) continue;
    const hit = hits[0];
    const anchor = hit.point.clone();
    if (anchor.y < player.position.y + 4) continue;
    // climb the anchor up the same facade for a bigger, higher arc
    const b = hit.object.userData.building;
    if (b) anchor.y = b.maxY - 1.5;
    if (anchor.y < player.position.y + 7) continue;
    const dist = anchor.distanceTo(origin);
    if (dist < 11 || dist > 88) continue;
    // prefer the highest available anchor so swings reach the skyline
    if (!best || anchor.y > best.anchor.y) best = { anchor, dist };
  }

  if (best) {
    web.active = true;
    web.anchor.copy(best.anchor);
    web.length = clamp(best.dist * 0.84, 8, 100);
    web.age = 0;
    web.handAlternate ^= 1;
    web.cooldown = 0.12;
    state.swings++;
    attachFlash = 1;
    // give the swing an upward yank so you leave the street
    const pull = best.anchor.clone().sub(origin).normalize();
    velocity.addScaledVector(pull, 8.5);
    velocity.y += 2.2;
    webRing.visible = true;
    webRingPos.copy(best.anchor);
    webRingLife = 0.55;
    audio.thwip();
    burst(best.anchor, 8, 0xffffff, 3.4, 0.5, 0.5);
    return;
  }
  web.cooldown = 0.09;
}

function detachWeb(boost = true) {
  if (!web.active) return;
  web.active = false;
  webLine.visible = false;
  web.cooldown = 0.2;
  if (boost) {
    const fwd = cameraForward();
    velocity.addScaledVector(fwd, 3.2);
    velocity.y += 2.4;
  }
}

function applySwing(dt, moveDir) {
  web.age += dt;
  const pivot = player.position.clone().add(new THREE.Vector3(0, 1.35, 0));
  const n = pivot.clone().sub(web.anchor);
  const dist = n.length();
  if (dist < 0.001) return;
  n.divideScalar(dist);

  // winch in hard right after attaching (the classic web-zip lift), then settle
  if (n.y < -0.1) {
    const reel = web.age < 1.25 ? 8.5 : 2.4;
    web.length = Math.max(7.5, web.length - reel * dt);
  }

  const over = dist - web.length;
  if (over > 0) {
    // soft winch correction: never teleport the player, pull at a capped speed
    const step = Math.min(over, 18 * dt + 0.02);
    pivot.addScaledVector(n, -step);
    player.position.copy(pivot).sub(new THREE.Vector3(0, 1.35, 0));
    const radial = velocity.dot(n);
    if (radial > 0) velocity.addScaledVector(n, -radial * 1.02);
  }

  // swing pumping: accelerate along the tangent in the input direction
  const len = moveDir.length();
  if (len > 0.08) {
    const tangent = moveDir.clone().addScaledVector(n, -moveDir.dot(n));
    if (tangent.lengthSq() > 0.0001) {
      tangent.normalize();
      velocity.addScaledVector(tangent, 17 * dt * Math.min(1, len));
    }
  }
  // steering force sideways while swinging
  const side = new THREE.Vector3(-n.z, 0, n.x).normalize();
  const steer = (keys.KeyD || keys.ArrowRight ? 1 : 0) - (keys.KeyA || keys.ArrowLeft ? 1 : 0);
  velocity.addScaledVector(side, steer * 7 * dt);
}

/* ------------------------------------------------------------
   Player update
   ------------------------------------------------------------ */
function moveInput() {
  const kbF = (keys.KeyW || keys.ArrowUp ? 1 : 0) - (keys.KeyS || keys.ArrowDown ? 1 : 0);
  const kbR = (keys.KeyD || keys.ArrowRight ? 1 : 0) - (keys.KeyA || keys.ArrowLeft ? 1 : 0);
  let f = kbF - input.stickY;
  let r = kbR + input.stickX;
  const l = Math.hypot(f, r);
  if (l > 1) { f /= l; r /= l; }
  const fwd = cameraForward();
  const right = new THREE.Vector3(Math.cos(camYaw), 0, -Math.sin(camYaw));
  const dir = new THREE.Vector3().addScaledVector(fwd, f).addScaledVector(right, r);
  return { dir, amount: Math.min(1, Math.hypot(f, r)) };
}

function updatePlayer(dt) {
  const prevY = player.position.y;
  const { dir: moveDir, amount } = moveInput();
  const sprinting = input.sprint || keys.ShiftLeft || keys.ShiftRight;

  if (grounded) {
    const speed = sprinting ? 17 : 10.5;
    const target = moveDir.clone().multiplyScalar(speed * (amount > 0.02 ? 1 : 0));
    velocity.x = damp(velocity.x, target.x, amount > 0.02 ? 12 : 9, dt);
    velocity.z = damp(velocity.z, target.z, amount > 0.02 ? 12 : 9, dt);
    runPhase += dt * (3.4 + Math.hypot(velocity.x, velocity.z) * 0.72);
  } else {
    velocity.x += moveDir.x * 10 * dt * amount;
    velocity.z += moveDir.z * 10 * dt * amount;
    runPhase += dt * 5.5;
  }

  if (input.jumpQueued) {
    input.jumpQueued = false;
    if (grounded) {
      velocity.y = 14.2;
      grounded = false;
      audio.jump();
      for (let i = 0; i < 5; i++) {
        spawnParticle(player.position.clone().add(new THREE.Vector3(rr(-0.4, 0.4), 0.1, rr(-0.4, 0.4))),
          new THREE.Vector3(rr(-1.5, 1.5), rr(0.4, 1.6), rr(-1.5, 1.5)),
          { color: 0xcfd6e2, size: 0.7, life: 0.45, gravity: 2 });
      }
    }
  }

  web.cooldown = Math.max(0, web.cooldown - dt);

  if (input.web) {
    if (!web.active) tryAttachWeb();
  } else if (web.active) {
    detachWeb(true);
  }

  if (!web.active) velocity.y -= 31 * dt;
  else velocity.y -= 29 * dt;

  if (web.active) applySwing(dt, moveDir);

  // air drag
  const drag = web.active ? 0.012 : 0.022;
  velocity.multiplyScalar(Math.max(0, 1 - drag * dt));

  // clamp absurd speed
  if (velocity.length() > 78) velocity.setLength(78);

  player.position.addScaledVector(velocity, dt);

  /* ---- collision / floors ---- */
  let floor = baseGroundAt(player.position.x, player.position.z);
  for (const b of world.buildings) {
    if (player.position.x > b.minX - 0.4 && player.position.x < b.maxX + 0.4 &&
        player.position.z > b.minZ - 0.4 && player.position.z < b.maxZ + 0.4) {
      if (prevY >= b.maxY - 0.5) floor = Math.max(floor, b.maxY);
    }
  }

  // land first (so roofs don't trigger a sideways wall push)
  supportY = floor;
  const wasGrounded = grounded;
  grounded = false;
  if (player.position.y <= floor + 0.001 && prevY >= floor - 0.9) {
    const impact = -velocity.y;
    player.position.y = floor;
    if (!wasGrounded && impact > 6) {
      audio.land(clamp(impact / 22, 0.3, 1.3));
      if (impact > 18) {
        shake = Math.min(0.6, impact * 0.018);
        for (let i = 0; i < 12; i++) {
          spawnParticle(player.position.clone().add(new THREE.Vector3(rr(-0.7, 0.7), 0.08, rr(-0.7, 0.7))),
            new THREE.Vector3(rr(-2.4, 2.4), rr(0.2, 1.2), rr(-2.4, 2.4)),
            { color: 0xc9d0db, size: 1.1, life: 0.55, gravity: 1.2, fade: 0.7 });
        }
      }
    }
    velocity.y = 0;
    grounded = true;
  }

  // horizontal push-out
  const r = 0.6;
  for (const b of world.buildings) {
    const bodyMin = player.position.y;
    const bodyMax = player.position.y + 2.0;
    if (bodyMin > b.maxY - 0.08) continue;
    if (bodyMax < 0.02) continue;
    if (player.position.x > b.minX - r && player.position.x < b.maxX + r &&
        player.position.z > b.minZ - r && player.position.z < b.maxZ + r) {
      const dxl = player.position.x - (b.minX - r);
      const dxr = (b.maxX + r) - player.position.x;
      const dzl = player.position.z - (b.minZ - r);
      const dzr = (b.maxZ + r) - player.position.z;
      const m = Math.min(dxl, dxr, dzl, dzr);
      if (m === dxl) { player.position.x -= dxl; if (velocity.x > 0) velocity.x *= -0.08; }
      else if (m === dxr) { player.position.x += dxr; if (velocity.x < 0) velocity.x *= -0.08; }
      else if (m === dzl) { player.position.z -= dzl; if (velocity.z > 0) velocity.z *= -0.08; }
      else { player.position.z += dzr; if (velocity.z < 0) velocity.z *= -0.08; }
    }
  }

  if (grounded && web.active) detachWeb(false);
  if (player.position.y < -8) respawn();
  if (Math.abs(player.position.x) > 230 || Math.abs(player.position.z) > 230) respawn();

  /* ---- facing ---- */
  let heading = null;
  if (Math.hypot(velocity.x, velocity.z) > 1.2) heading = Math.atan2(velocity.x, velocity.z);
  else if (moveDir.lengthSq() > 0.01) heading = Math.atan2(moveDir.x, moveDir.z);
  if (heading !== null) {
    player.rotation.y = angleLerp(player.rotation.y, heading, 1 - Math.exp(-12 * dt));
  }

  state.topSpeed = Math.max(state.topSpeed, velocity.length() * 3.6);
  state.maxHeight = Math.max(state.maxHeight, player.position.y);
}

/* ------------------------------------------------------------
   Character animation
   ------------------------------------------------------------ */
const tmpVec = new THREE.Vector3();
const tmpQuat = new THREE.Quaternion();
const downAxis = new THREE.Vector3(0, -1, 0);

function animateCharacter(dt, time) {
  const hSpeed = Math.hypot(velocity.x, velocity.z);
  const vSpeed = velocity.length();
  const runAmp = clamp(hSpeed / 12, 0, 1);

  if (grounded) {
    const swing = Math.sin(runPhase) * 0.95 * runAmp;
    const swing2 = Math.sin(runPhase + Math.PI) * 0.95 * runAmp;
    legL.hip.rotation.x = damp(legL.hip.rotation.x, swing, 18, dt);
    legR.hip.rotation.x = damp(legR.hip.rotation.x, swing2, 18, dt);
    legL.knee.rotation.x = damp(legL.knee.rotation.x, Math.max(0, -Math.sin(runPhase)) * 0.9 * runAmp, 18, dt);
    legR.knee.rotation.x = damp(legR.knee.rotation.x, Math.max(0, -Math.sin(runPhase + Math.PI)) * 0.9 * runAmp, 18, dt);
    armL.shoulder.rotation.x = damp(armL.shoulder.rotation.x, -swing * 0.8, 16, dt);
    armR.shoulder.rotation.x = damp(armR.shoulder.rotation.x, -swing2 * 0.8, 16, dt);
    armL.shoulder.rotation.z = damp(armL.shoulder.rotation.z, 0.08, 10, dt);
    armR.shoulder.rotation.z = damp(armR.shoulder.rotation.z, -0.08, 10, dt);
    armL.elbow.rotation.x = damp(armL.elbow.rotation.x, -0.25 - runAmp * 0.35, 12, dt);
    armR.elbow.rotation.x = damp(armR.elbow.rotation.x, -0.25 - runAmp * 0.35, 12, dt);
    armL.shoulder.rotation.y = damp(armL.shoulder.rotation.y, 0, 10, dt);
    armR.shoulder.rotation.y = damp(armR.shoulder.rotation.y, 0, 10, dt);
    rig.position.y = damp(rig.position.y, Math.abs(Math.sin(runPhase)) * 0.045 * runAmp, 14, dt);
    rig.rotation.x = damp(rig.rotation.x, runAmp * 0.1 + (hSpeed > 15 ? 0.08 : 0), 8, dt);
    rig.rotation.z = damp(rig.rotation.z, 0, 8, dt);
  } else if (web.active) {
    // right arm aims at the anchor, body leans into the swing
    const shoulderWorld = tmpVec.setFromMatrixPosition(armR.shoulder.matrixWorld);
    rig.getWorldQuaternion(tmpQuat).invert();
    const local = web.anchor.clone().sub(shoulderWorld).applyQuaternion(tmpQuat).normalize();
    const targetQ = new THREE.Quaternion().setFromUnitVectors(downAxis, local);
    armR.shoulder.quaternion.slerp(targetQ, 1 - Math.exp(-16 * dt));
    armR.elbow.rotation.x = damp(armR.elbow.rotation.x, -0.05, 14, dt);

    armL.shoulder.quaternion.slerp(new THREE.Quaternion().setFromEuler(new THREE.Euler(-0.5, 0, 0.6)), 1 - Math.exp(-8 * dt));
    armL.elbow.rotation.x = damp(armL.elbow.rotation.x, -0.5, 10, dt);

    const t = time * 6;
    legL.hip.rotation.x = damp(legL.hip.rotation.x, 0.55 + Math.sin(t) * 0.12, 8, dt);
    legR.hip.rotation.x = damp(legR.hip.rotation.x, 0.3 - Math.sin(t) * 0.12, 8, dt);
    legL.knee.rotation.x = damp(legL.knee.rotation.x, 1.15, 8, dt);
    legR.knee.rotation.x = damp(legR.knee.rotation.x, 0.85, 8, dt);
    rig.rotation.x = damp(rig.rotation.x, 0.5, 6, dt);
    rig.rotation.z = damp(rig.rotation.z, clamp(-velocity.x * 0.01, -0.25, 0.25), 6, dt);
    rig.position.y = damp(rig.position.y, 0, 8, dt);
  } else {
    // airborne pose
    const t = time * 4;
    legL.hip.rotation.x = damp(legL.hip.rotation.x, -0.65, 7, dt);
    legR.hip.rotation.x = damp(legR.hip.rotation.x, -0.2, 7, dt);
    legL.knee.rotation.x = damp(legL.knee.rotation.x, 1.25, 8, dt);
    legR.knee.rotation.x = damp(legR.knee.rotation.x, 0.55, 8, dt);
    armL.shoulder.quaternion.slerp(new THREE.Quaternion().setFromEuler(new THREE.Euler(-0.3, 0, 1.0 + Math.sin(t) * 0.08)), 1 - Math.exp(-7 * dt));
    armR.shoulder.quaternion.slerp(new THREE.Quaternion().setFromEuler(new THREE.Euler(-0.5, 0, -0.9 - Math.sin(t) * 0.08)), 1 - Math.exp(-7 * dt));
    armL.elbow.rotation.x = damp(armL.elbow.rotation.x, -0.5, 8, dt);
    armR.elbow.rotation.x = damp(armR.elbow.rotation.x, -0.6, 8, dt);
    rig.rotation.x = damp(rig.rotation.x, 0.14 + clamp(vSpeed * 0.006, 0, 0.28), 6, dt);
    rig.rotation.z = damp(rig.rotation.z, -velocity.x * 0.006, 6, dt);
    rig.position.y = damp(rig.position.y, 0, 8, dt);
  }

  // head subtly tracks the camera
  const headYaw = clamp(((camYaw + Math.PI) - player.rotation.y + Math.PI * 3) % TAU - Math.PI, -0.5, 0.5);
  head.rotation.y = damp(head.rotation.y, headYaw * 0.35, 5, dt);
  head.rotation.x = damp(head.rotation.x, clamp(camPitch - 0.2, -0.2, 0.25), 4, dt);

  // idle breathing
  if (grounded && hSpeed < 0.5) {
    const b = Math.sin(time * 2.2) * 0.012;
    torso.scale.y = 1 + b;
    rig.rotation.x = damp(rig.rotation.x, 0, 5, dt);
  } else {
    torso.scale.y = damp(torso.scale.y, 1, 8, dt);
  }

  // web line from the active hand
  if (web.active) {
    const hand = (web.handAlternate ? armR.hand : armL.hand);
    hand.getWorldPosition(tmpVec);
    const dir = web.anchor.clone().sub(tmpVec);
    const len = dir.length();
    webLine.visible = true;
    webLine.position.copy(tmpVec).addScaledVector(dir, 0.5);
    webLine.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
    webLine.scale.set(1, len, 1);
  } else {
    webLine.visible = false;
  }
}

/* ------------------------------------------------------------
   Camera
   ------------------------------------------------------------ */
function updateCamera(dt) {
  // title-screen establishing shot: slow orbit over the skyline
  if (state.phase === 'menu') {
    const a = time * 0.045;
    const radius = 205;
    camera.position.set(Math.cos(a) * radius, 82 + Math.sin(time * 0.11) * 9, Math.sin(a) * radius);
    camera.lookAt(0, 38, 0);
    const targetFov = 58;
    if (Math.abs(camera.fov - targetFov) > 0.02) {
      camera.fov = damp(camera.fov, targetFov, 3, dt);
      camera.updateProjectionMatrix();
    }
    sky.position.copy(camera.position);
    sun.position.copy(camera.position).add(new THREE.Vector3(110, 145, 120));
    sun.target.position.set(0, 40, 0);
    $('speedlines').style.opacity = '0';
    return;
  }

  const target = player.position.clone().add(new THREE.Vector3(0, 1.55, 0));
  const look = velocity.clone().multiplyScalar(0.055);
  look.y *= 0.4;
  target.add(look.clampLength(0, 3.2));

  camTarget.lerp(target, 1 - Math.exp(-13 * dt));

  const speed = velocity.length();
  const wanted = camDistUser + clamp(speed * 0.045, 0, 2.2);
  const offsetDir = new THREE.Vector3(
    Math.sin(camYaw) * Math.cos(camPitch),
    Math.sin(camPitch),
    Math.cos(camYaw) * Math.cos(camPitch)
  ).normalize();

  raycaster.set(camTarget, offsetDir);
  raycaster.far = wanted;
  const hits = raycaster.intersectObjects(world.buildingMeshes, false);
  let allowed = wanted;
  if (hits.length) allowed = Math.max(1.4, hits[0].distance - 0.45);

  if (allowed < camDistSmooth) camDistSmooth = damp(camDistSmooth, allowed, 30, dt);
  else camDistSmooth = damp(camDistSmooth, allowed, 4.5, dt);

  const desired = camTarget.clone().addScaledVector(offsetDir, camDistSmooth);

  // camera shake
  if (shake > 0.001) {
    desired.x += (Math.random() - 0.5) * shake;
    desired.y += (Math.random() - 0.5) * shake;
    desired.z += (Math.random() - 0.5) * shake;
    shake = damp(shake, 0, 5, dt);
  }

  camera.position.lerp(desired, 1 - Math.exp(-14 * dt));
  camera.lookAt(camTarget);

  const targetFov = 62 + clamp((speed - 8) * 0.42, 0, 20);
  if (Math.abs(camera.fov - targetFov) > 0.02) {
    camera.fov = damp(camera.fov, targetFov, 3.4, dt);
    camera.updateProjectionMatrix();
  }

  // sun shadow volume follows the player
  sun.position.copy(player.position).add(new THREE.Vector3(110, 145, 120));
  sun.target.position.copy(player.position);

  // sky follows the camera
  sky.position.copy(camera.position);

  $('speedlines').style.opacity = reduceMotion ? '0' : String(clamp((speed - 17) / 40, 0, 0.46));
}

/* ------------------------------------------------------------
   World updates (tokens, cars, clouds, effects)
   ------------------------------------------------------------ */
const clock = new THREE.Clock();
let time = 0;

function updateTokens(dt) {
  for (const t of world.tokens) {
    if (t.userData.collected) continue;
    t.rotation.y += dt * 2.2;
    t.userData.ring.rotation.z += dt * 1.7;
    const y = t.userData.baseY + Math.sin(time * 2 + t.userData.phase) * 0.35;
    t.position.y = y;
    const dx = player.position.x - t.position.x;
    const dy = (player.position.y + 1.2) - y;
    const dz = player.position.z - t.position.z;
    if (dx * dx + dy * dy + dz * dz < 3.45 * 3.45) collectToken(t);
  }
}

function collectToken(t) {
  t.userData.collected = true;
  t.visible = false;
  state.tokens++;
  updateHUD();
  audio.collect(state.tokens);
  burst(t.position.clone(), 16, 0xffd15c, 6, 0.55, 0.8);
  burst(t.position.clone(), 8, 0xff4a3d, 4, 0.5, 0.6);
  if (state.tokens === state.total) {
    winGame();
  } else if (state.tokens % 6 === 0) {
    toast(`${state.tokens} / ${state.total} TOKENS · KEEP SWINGING`);
  } else {
    toast(`TOKEN ${state.tokens} / ${state.total}`, 900);
  }
}

function updateCars(dt) {
  for (const c of world.cars) {
    c.along += c.speed * c.dir * dt;
    if (c.along > CITY_RADIUS) c.along = -CITY_RADIUS;
    if (c.along < -CITY_RADIUS) c.along = CITY_RADIUS;
  }
  updateCarInstances();
}

function updateClouds(dt) {
  for (const c of clouds) {
    c.position.x += c.userData.speed * dt;
    if (c.position.x > 900) c.position.x = -900;
  }
}

function updateEffects(dt) {
  if (webRingLife > 0) {
    webRingLife -= dt;
    const k = 1 - Math.max(0, webRingLife) / 0.55;
    webRing.position.copy(webRingPos);
    webRing.lookAt(camera.position);
    const s = 0.35 + k * 2.4;
    webRing.scale.set(s, s, 1);
    webRing.material.opacity = (1 - k) * 0.9;
    if (webRingLife <= 0) webRing.visible = false;
  }
  updateParticles(dt);

  // wind streaks
  const spd = velocity.length();
  if (spd > 24 && state.phase === 'playing') {
    windAccum += dt * (spd - 20) * 0.1;
    while (windAccum > 1) {
      windAccum -= 1;
      const p = player.position.clone().add(new THREE.Vector3(rr(-1.4, 1.4), rr(0.4, 2.4), rr(-1.4, 1.4)));
      spawnParticle(p, velocity.clone().multiplyScalar(-0.12).add(new THREE.Vector3(rr(-1, 1), rr(-1, 1), rr(-1, 1))), {
        color: 0xcfe2ff, size: 0.55, life: 0.32, gravity: 0, fade: 0.55, additive: true
      });
    }
  }

  if (world.beacon) {
    world.beacon.material.color.setHSL(0, 1, 0.45 + Math.sin(time * 4) * 0.25);
  }
}

/* ------------------------------------------------------------
   HUD / radar
   ------------------------------------------------------------ */
function updateHudText() {
  const kmh = Math.round(velocity.length() * 3.6);
  $('speedVal').textContent = kmh;
  $('altVal').textContent = Math.max(0, Math.round(player.position.y));
  $('runTime').textContent = formatTime(state.elapsed);
}

const radar = $('radar');
const rctx = radar.getContext('2d');
let radarTimer = 0;
function drawRadar() {
  const w = radar.width, h = radar.height;
  const cx = w / 2, cy = h / 2;
  const R = w / 2 - 4;
  const scale = R / 150;
  rctx.clearRect(0, 0, w, h);
  rctx.save();
  rctx.beginPath(); rctx.arc(cx, cy, R, 0, TAU); rctx.clip();

  // subtle grid
  rctx.strokeStyle = 'rgba(255,255,255,0.04)';
  rctx.lineWidth = 1;
  for (let i = -2; i <= 2; i++) {
    const p = cy + i * R * 0.36;
    rctx.beginPath(); rctx.moveTo(0, p); rctx.lineTo(w, p); rctx.stroke();
    rctx.beginPath(); rctx.moveTo(cx + i * R * 0.36, 0); rctx.lineTo(cx + i * R * 0.36, h); rctx.stroke();
  }

  rctx.translate(cx, cy);
  rctx.rotate(camYaw);

  // buildings
  rctx.fillStyle = 'rgba(150,168,196,0.22)';
  for (const b of world.buildings) {
    const dx = b.cx - player.position.x;
    const dz = b.cz - player.position.z;
    if (Math.abs(dx) > 165 || Math.abs(dz) > 165) continue;
    rctx.fillRect(dx * scale, dz * scale, Math.max(1.2, b.w * scale), Math.max(1.2, b.d * scale));
  }

  // tokens
  for (const t of world.tokens) {
    if (t.userData.collected) continue;
    let dx = t.position.x - player.position.x;
    let dz = t.position.z - player.position.z;
    const d = Math.hypot(dx, dz);
    if (d > 158) continue;
    rctx.beginPath();
    rctx.arc(dx * scale, dz * scale, d < 40 ? 3.6 : 2.8, 0, TAU);
    rctx.fillStyle = d < 40 ? '#ffd66b' : '#ffb23d';
    rctx.shadowColor = '#ffb23d';
    rctx.shadowBlur = 10;
    rctx.fill();
    rctx.shadowBlur = 0;
  }
  rctx.restore();

  // player arrow
  const pfx = Math.sin(player.rotation.y);
  const pfz = Math.cos(player.rotation.y);
  const sx = pfx * Math.cos(camYaw) - pfz * Math.sin(camYaw);
  const sy = pfx * Math.sin(camYaw) + pfz * Math.cos(camYaw);
  const angle = Math.atan2(sx, -sy);
  rctx.save();
  rctx.translate(cx, cy);
  rctx.rotate(angle);
  rctx.beginPath();
  rctx.moveTo(0, -9);
  rctx.lineTo(6.5, 7);
  rctx.lineTo(0, 3.5);
  rctx.lineTo(-6.5, 7);
  rctx.closePath();
  rctx.fillStyle = '#f52233';
  rctx.shadowColor = '#f52233';
  rctx.shadowBlur = 12;
  rctx.fill();
  rctx.restore();

  // scan ring
  rctx.strokeStyle = 'rgba(255,255,255,0.10)';
  rctx.beginPath(); rctx.arc(cx, cy, R * 0.55, 0, TAU); rctx.stroke();
  rctx.strokeStyle = 'rgba(255,255,255,0.16)';
  rctx.beginPath(); rctx.arc(cx, cy, R, 0, TAU); rctx.stroke();
}

/* ------------------------------------------------------------
   Game flow
   ------------------------------------------------------------ */
function startGame() {
  audio.init();
  state.phase = 'playing';
  state.runStart = performance.now();
  state.elapsed = 0;
  player.rotation.y = Math.PI;
  snapCamera();
  $('startScreen').classList.add('hidden');
  $('hud').classList.remove('hidden');
  if (isTouch) $('touch').classList.remove('hidden');
  document.body.classList.add('playing');
  toast('SWING TIP · HOLD SPACE OR WEB TO ATTACH', 3200);
  updateHUD();
}

function winGame() {
  state.phase = 'win';
  audio.win();
  velocity.set(0, 0, 0);
  web.active = false;
  webLine.visible = false;
  $('speedlines').style.opacity = '0';
  $('toast').classList.remove('show');
  toastUntil = 0;
  state.elapsed = (performance.now() - state.runStart) / 1000;
  $('winTime').textContent = formatTime(state.elapsed);
  $('winSpeed').textContent = Math.round(state.topSpeed);
  $('winSwings').textContent = state.swings;
  $('hud').classList.add('hidden');
  $('touch').classList.add('hidden');
  setTimeout(() => {
    $('winScreen').classList.remove('hidden');
    if (document.pointerLockElement) document.exitPointerLock?.();
  }, 900);
}

function resetGame() {
  for (const t of world.tokens) {
    t.userData.collected = false;
    t.visible = true;
  }
  state.tokens = 0;
  state.swings = 0;
  state.topSpeed = 0;
  state.maxHeight = 0;
  state.elapsed = 0;
  resetPlayer(new THREE.Vector3(24, 0, 120));
  state.phase = 'playing';
  state.runStart = performance.now();
  $('winScreen').classList.add('hidden');
  $('hud').classList.remove('hidden');
  if (isTouch) $('touch').classList.remove('hidden');
  camera.fov = 62;
  camera.updateProjectionMatrix();
  camDistSmooth = camDistUser;
  updateHUD();
  setTokenTotalUI();
  toast('ROUND 2 · GO GET EVERY TOKEN', 2200);
}

/* ------------------------------------------------------------
   UI wiring
   ------------------------------------------------------------ */
setTokenTotalUI();

$('startBtn').addEventListener('click', startGame);
$('replayBtn').addEventListener('click', resetGame);
$('muteBtn').addEventListener('click', () => {
  audio.init();
  const muted = audio.toggleMute();
  $('muteBtn').classList.toggle('off', muted);
  $('muteBtn').textContent = muted ? '×' : '♪';
});

const helpSheet = $('helpSheet');
function openHelp() { helpSheet.classList.remove('hidden'); if (document.pointerLockElement) document.exitPointerLock?.(); }
function closeHelp() { helpSheet.classList.add('hidden'); }
$('helpBtn').addEventListener('click', openHelp);
$('closeHelp').addEventListener('click', closeHelp);
helpSheet.addEventListener('click', (e) => { if (e.target === helpSheet) closeHelp(); });

document.addEventListener('pointerlockchange', () => {
  if (document.pointerLockElement !== canvas) dragging = false;
});

window.addEventListener('resize', () => {
  renderer.setSize(window.innerWidth, window.innerHeight, false);
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
});
window.addEventListener('orientationchange', () => setTimeout(() => {
  renderer.setSize(window.innerWidth, window.innerHeight, false);
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
}, 250));

/* ------------------------------------------------------------
   Main loop
   ------------------------------------------------------------ */
function blobShadowUpdate() {
  const groundY = supportY;
  const dist = player.position.y - groundY;
  blobShadow.position.set(player.position.x, groundY + 0.06, player.position.z);
  const k = clamp(1 - dist / 14, 0, 1);
  blobShadow.material.opacity = 0.3 * k;
  const s = 1.8 + dist * 0.08;
  blobShadow.scale.set(s, s * 0.55, 1);
  blobShadow.visible = k > 0.02;
}

function loop() {
  const dt = Math.min(clock.getDelta(), 0.033);
  time += dt;

  // clouds drift even on menu
  updateClouds(dt);
  updateCars(dt);
  updateEffects(dt);

  if (state.phase === 'playing') {
    state.elapsed = (performance.now() - state.runStart) / 1000;
    updatePlayer(dt);
    updateTokens(dt);
  }

  animateCharacter(dt, time);
  updateCamera(dt);
  blobShadowUpdate();
  updateHudText();

  radarTimer -= dt;
  if (radarTimer <= 0 && state.phase === 'playing' && !isTouch) {
    drawRadar();
    radarTimer = 0.1;
  }

  if (toastUntil > 0 && performance.now() > toastUntil) {
    toastUntil = 0;
    $('toast').classList.remove('show');
  }

  audio.setWind(velocity.length());
  renderer.render(scene, camera);
}

/* menu camera: pull around the spawn point */
camTarget.set(24, 1.6, 120);
camera.position.set(30, 5.5, 131);
camera.lookAt(24, 3.5, 100);
grounded = true;

/* first render, then reveal */
renderer.render(scene, camera);
renderer.setAnimationLoop(loop);

setTimeout(() => {
  $('loading').classList.add('done');
  setTimeout(() => $('loading').remove(), 600);
}, 220);

/* expose a tiny debug surface for automated checks */
window.__game = {
  state, player, camera, world, velocity, web, renderer, scene,
  teleport(x, y, z) {
    resetPlayer(new THREE.Vector3(x, y, z));
  },
  setPhase(p) { state.phase = p; },
  look(yaw, pitch) { camYaw = yaw; camPitch = pitch; },
  attach: tryAttachWeb,
  detach: detachWeb,
  start: startGame,
  reset: resetGame,
  collectAll() { for (const t of world.tokens) if (!t.userData.collected) collectToken(t); },
  get info() {
    return {
      phase: state.phase,
      tokens: state.tokens,
      total: state.total,
      pos: player.position.toArray().map((n) => +n.toFixed(2)),
      speed: +velocity.length().toFixed(2),
      grounded,
      webActive: web.active,
      maxHeight: +state.maxHeight.toFixed(2),
      fps: renderer.info.render.frame,
      calls: renderer.info.render.calls,
      tris: renderer.info.render.triangles
    };
  }
};
