import * as THREE from 'three';
import { createCity } from './city.js';
import { createHero } from './hero.js';
import { GameAudio } from './audio.js';

/* ------------------------------------------------------------------ */
/*  Setup                                                              */
/* ------------------------------------------------------------------ */

const canvas = document.getElementById('scene');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
renderer.setSize(window.innerWidth, window.innerHeight, false);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.34;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x4a2c50, 0.0016);

const camera = new THREE.PerspectiveCamera(64, window.innerWidth / window.innerHeight, 0.1, 1800);
camera.position.set(0, 12, 100);

const audio = new GameAudio();
const city = createCity(scene, { seed: 9031 });
const hero = createHero(scene);
scene.add(hero.root);

const SUN_DIR = new THREE.Vector3(0.62, 0.3, -0.72).normalize();

/* ------------------------------------------------------------------ */
/*  Sky, sun, stars                                                    */
/* ------------------------------------------------------------------ */

(function createSky() {
  const uniforms = {
    topColor: { value: new THREE.Color(0x120a2e) },
    midColor: { value: new THREE.Color(0x5b2c64) },
    horizonColor: { value: new THREE.Color(0xff9a63) },
    sunColor: { value: new THREE.Color(0xffd9a0) },
    sunDir: { value: SUN_DIR.clone() },
  };
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms,
    vertexShader: `
      varying vec3 vDir;
      void main() {
        vDir = normalize(position);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform vec3 topColor;
      uniform vec3 midColor;
      uniform vec3 horizonColor;
      uniform vec3 sunColor;
      uniform vec3 sunDir;
      varying vec3 vDir;
      void main() {
        vec3 d = normalize(vDir);
        float h = clamp(d.y, -0.08, 1.0);
        vec3 col = mix(horizonColor, midColor, smoothstep(0.0, 0.28, h));
        col = mix(col, topColor, smoothstep(0.16, 0.75, h));
        float sd = max(dot(d, normalize(sunDir)), 0.0);
        col += sunColor * pow(sd, 220.0) * 2.6;
        col += sunColor * pow(sd, 14.0) * 0.42;
        col += vec3(0.9, 0.35, 0.2) * pow(max(0.0, 1.0 - abs(d.y) * 5.0), 3.0) * 0.24;
        float below = smoothstep(0.0, -0.08, d.y);
        col = mix(col, vec3(0.045, 0.03, 0.07), below);
        gl_FragColor = vec4(col, 1.0);
      }
    `,
  });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(1300, 40, 24), skyMat);
  sky.frustumCulled = false;
  scene.add(sky);

  // big soft glow
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(128, 128, 0, 128, 128, 128);
  grad.addColorStop(0, 'rgba(255, 246, 215, 1)');
  grad.addColorStop(0.16, 'rgba(255, 214, 150, 0.9)');
  grad.addColorStop(0.42, 'rgba(255, 140, 90, 0.34)');
  grad.addColorStop(1, 'rgba(255, 90, 70, 0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 256, 256);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
    map: tex, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: true,
    transparent: true, toneMapped: false,
  }));
  sprite.position.copy(SUN_DIR).multiplyScalar(1080);
  sprite.scale.set(360, 360, 1);
  scene.add(sprite);

  // stars
  const N = 850;
  const pos = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) {
    const u = Math.random() * Math.PI * 2;
    const v = 0.08 + Math.random() * 0.92;
    const r = 1000;
    const y = v;
    const rr = Math.sqrt(1 - y * y);
    pos[i * 3] = Math.cos(u) * rr * r;
    pos[i * 3 + 1] = y * r;
    pos[i * 3 + 2] = Math.sin(u) * rr * r;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const stars = new THREE.Points(geo, new THREE.PointsMaterial({
    color: 0xfff2dd, size: 1.5, sizeAttenuation: false,
    transparent: true, opacity: 0.55, depthWrite: false, fog: false,
  }));
  scene.add(stars);
})();

/* ------------------------------------------------------------------ */
/*  Lights                                                             */
/* ------------------------------------------------------------------ */

const hemi = new THREE.HemisphereLight(0xffb084, 0x3a3058, 2.05);
scene.add(hemi);

const ambient = new THREE.AmbientLight(0x8f7aa8, 0.55);
scene.add(ambient);

const sunLight = new THREE.DirectionalLight(0xffc096, 3.4);
sunLight.castShadow = true;
sunLight.shadow.mapSize.set(2048, 2048);
sunLight.shadow.camera.left = -85;
sunLight.shadow.camera.right = 85;
sunLight.shadow.camera.top = 85;
sunLight.shadow.camera.bottom = -85;
sunLight.shadow.camera.near = 1;
sunLight.shadow.camera.far = 420;
sunLight.shadow.bias = -0.00035;
sunLight.shadow.normalBias = 0.035;
scene.add(sunLight);
scene.add(sunLight.target);

const fill = new THREE.DirectionalLight(0x7d92ff, 1.55);
fill.position.set(-120, 90, 140);
scene.add(fill);

const heroLight = new THREE.PointLight(0xffe3c8, 1.6, 14, 2);
scene.add(heroLight);

/* ------------------------------------------------------------------ */
/*  Tokens                                                             */
/* ------------------------------------------------------------------ */

const tokenRoot = new THREE.Group();
scene.add(tokenRoot);
const tokens = [];
const tokenGeo = new THREE.OctahedronGeometry(1.15, 0);
const tokenMat = new THREE.MeshStandardMaterial({
  color: 0xfff0e0, emissive: 0xff2148, emissiveIntensity: 2.4,
  metalness: 0.5, roughness: 0.18,
});
const ringGeo = new THREE.TorusGeometry(1.95, 0.055, 6, 36);
const ringMat = new THREE.MeshBasicMaterial({ color: 0xffcf5c, toneMapped: false });
const beamGeo = new THREE.CylinderGeometry(0.6, 2.6, 1, 12, 1, true);
const beamMat = new THREE.MeshBasicMaterial({
  color: 0xff5570, transparent: true, opacity: 0.07,
  blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false,
});

city.tokenSpots.forEach((pos, i) => {
  const group = new THREE.Group();
  group.position.copy(pos);
  const core = new THREE.Mesh(tokenGeo, tokenMat);
  core.scale.set(0.85, 1.25, 0.85);
  group.add(core);
  const ring = new THREE.Mesh(ringGeo, ringMat);
  ring.rotation.x = Math.PI / 2.6;
  group.add(ring);
  const ring2 = new THREE.Mesh(ringGeo, ringMat);
  ring2.rotation.y = Math.PI / 2.4;
  ring2.scale.setScalar(0.82);
  group.add(ring2);
  const beam = new THREE.Mesh(beamGeo, beamMat);
  const height = Math.max(12, pos.y);
  beam.scale.set(1, height, 1);
  beam.position.y = -height / 2;
  group.add(beam);
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({
    map: makeGlowTexture(), color: 0xff5c74, blending: THREE.AdditiveBlending,
    depthWrite: false, transparent: true, opacity: 0.55, toneMapped: false,
  }));
  halo.scale.set(7, 7, 1);
  group.add(halo);
  tokenRoot.add(group);
  tokens.push({ group, core, ring, ring2, halo, baseY: pos.y, phase: i * 0.7, collected: false, collectT: 0 });
});

function makeGlowTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.25, 'rgba(255,120,140,0.7)');
  grad.addColorStop(1, 'rgba(255,60,90,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/* ------------------------------------------------------------------ */
/*  Particles                                                          */
/* ------------------------------------------------------------------ */

const bursts = [];
function spawnBurst(pos, color = 0xffcf5c, count = 26) {
  const positions = new Float32Array(count * 3);
  const vel = [];
  for (let i = 0; i < count; i++) {
    positions[i * 3] = pos.x;
    positions[i * 3 + 1] = pos.y;
    positions[i * 3 + 2] = pos.z;
    vel.push(new THREE.Vector3(
      (Math.random() - 0.5) * 16,
      Math.random() * 13 + 2,
      (Math.random() - 0.5) * 16
    ));
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const mat = new THREE.PointsMaterial({
    color, size: 0.55, transparent: true, opacity: 1,
    blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true,
  });
  const pts = new THREE.Points(geo, mat);
  pts.frustumCulled = false;
  scene.add(pts);
  bursts.push({ pts, vel, life: 1.1, max: 1.1 });
}

function updateBursts(dt) {
  for (let i = bursts.length - 1; i >= 0; i--) {
    const b = bursts[i];
    b.life -= dt;
    const arr = b.pts.geometry.attributes.position.array;
    for (let j = 0; j < b.vel.length; j++) {
      b.vel[j].y -= 18 * dt;
      arr[j * 3] += b.vel[j].x * dt;
      arr[j * 3 + 1] += b.vel[j].y * dt;
      arr[j * 3 + 2] += b.vel[j].z * dt;
    }
    b.pts.geometry.attributes.position.needsUpdate = true;
    b.pts.material.opacity = Math.max(0, b.life / b.max);
    if (b.life <= 0) {
      scene.remove(b.pts);
      b.pts.geometry.dispose();
      b.pts.material.dispose();
      bursts.splice(i, 1);
    }
  }
}

/* ------------------------------------------------------------------ */
/*  Player state                                                       */
/* ------------------------------------------------------------------ */

const PLAYER_RADIUS = 0.45;
const GRAVITY = 34;
const DIVE_GRAVITY = 64;
const RUN_SPEED = 13.5;
const SPRINT_SPEED = 21;
const MAX_SPEED = 62;

const player = {
  pos: city.spawn.position.clone(),
  vel: new THREE.Vector3(),
  yaw: city.spawn.yaw,
  mode: 'ground',
  anchor: null,
  rope: 0,
  swingSide: 1,
  cooldown: 0,
  zipCooldown: 0,
  zipTime: 0,
  zipTarget: null,
  airTime: 0,
  lastSupport: 0,
  prevSwing: false,
};

const game = {
  state: 'menu',
  time: 0,
  tokens: 0,
  total: tokens.length,
  best: 0,
  shake: 0,
  flash: 0,
  hintTimer: 0,
  anchorReady: false,
  anchorTimer: 0,
  started: false,
  lastImpact: 0,
};

try {
  game.best = parseFloat(localStorage.getItem('webrush.best') || '0') || 0;
} catch (e) { /* private mode */ }

const input = {
  x: 0, y: 0,
  swing: false,
  dive: false,
  jumpQueued: false,
  lookX: 0, lookY: 0,
  touchLook: false,
};

const cam = {
  yaw: city.spawn.yaw,
  pitch: 0.16,
  targetYaw: city.spawn.yaw,
  targetPitch: 0.16,
  dist: 7.4,
  basePos: new THREE.Vector3(),
  lookTarget: new THREE.Vector3(),
  fov: 64,
  lastLook: -10,
  shake: new THREE.Vector3(),
  snap: true,
};

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

const _forward = new THREE.Vector3();
const _right = new THREE.Vector3();
const _wish = new THREE.Vector3();
const _tmp = new THREE.Vector3();
const _tmp2 = new THREE.Vector3();
const _offset = new THREE.Vector3();
const _closest = new THREE.Vector3();
const _boxCenter = new THREE.Vector3();
const _origin = new THREE.Vector3();
const _horiz = new THREE.Vector3();
const _camHit = new THREE.Vector3();
const raycaster = new THREE.Raycaster();
const ray = new THREE.Ray();

function dampAngle(a, b, lambda, dt) {
  let d = ((b - a + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI;
  return a + d * (1 - Math.exp(-lambda * dt));
}

function wishDirection() {
  _forward.set(Math.sin(cam.yaw), 0, Math.cos(cam.yaw));
  _right.set(-Math.cos(cam.yaw), 0, Math.sin(cam.yaw));
  _wish.set(0, 0, 0).addScaledVector(_forward, input.y).addScaledVector(_right, input.x);
  if (_wish.lengthSq() > 1) _wish.normalize();
  return _wish;
}

function supportHeightAt(x, z, maxY) {
  let support = city.groundHeightAt(x, z);
  for (const box of city.colliders) {
    if (box.max.y > maxY + 0.05) continue;
    if (x >= box.min.x - 0.18 && x <= box.max.x + 0.18 && z >= box.min.z - 0.18 && z <= box.max.z + 0.18) {
      if (box.max.y > support) support = box.max.y;
    }
  }
  return support;
}

function findAnchor(origin, maxDist = 62) {
  const horiz = _horiz.set(Math.sin(cam.yaw), 0, Math.cos(cam.yaw)).normalize();
  const aims = [
    new THREE.Vector3(horiz.x, 0.62, horiz.z).normalize(),
    new THREE.Vector3(horiz.x, 0.3, horiz.z).normalize(),
    new THREE.Vector3(horiz.x, 1.0, horiz.z).normalize(),
    new THREE.Vector3(horiz.x, 0.08, horiz.z).normalize(),
  ];
  for (const aim of aims) {
    raycaster.set(origin, aim);
    raycaster.far = maxDist;
    const hits = raycaster.intersectObjects(city.buildingMeshes, false);
    if (hits.length) {
      const p = hits[0].point;
      if (p.y > player.pos.y + 3.5 && p.distanceTo(origin) > 7) {
        return p.clone();
      }
    }
  }

  // Fallback: nearest rooftop corner in the direction we are looking.
  let best = null;
  let bestScore = Infinity;
  for (const box of city.colliders) {
    const top = box.max.y;
    if (top < player.pos.y + 5 || top > player.pos.y + 56) continue;
    const cx = Math.max(box.min.x, Math.min(origin.x, box.max.x));
    const cz = Math.max(box.min.z, Math.min(origin.z, box.max.z));
    const dx = cx - origin.x;
    const dz = cz - origin.z;
    const dist = Math.hypot(dx, dz);
    if (dist < 2.5 || dist > maxDist) continue;
    const dot = (dx * horiz.x + dz * horiz.z) / dist;
    if (dot < 0.1) continue;
    const score = dist - (top - origin.y) * 0.55 - dot * 6;
    if (score < bestScore) {
      bestScore = score;
      best = new THREE.Vector3(cx, top + 0.4, cz);
    }
  }
  return best;
}

function detach(boost = 0) {
  if (player.mode === 'swing') {
    const speed = player.vel.length();
    player.vel.y += Math.min(8, 2.4 + speed * 0.09) + boost;
    audio.release();
  }
  player.anchor = null;
  player.mode = 'air';
  player.cooldown = 0.16;
}

function tryAttach() {
  if (player.cooldown > 0 || player.mode === 'swing') return false;
  const origin = _origin.copy(player.pos).add(new THREE.Vector3(0, 1.35, 0));
  const anchor = findAnchor(origin);
  if (!anchor) return false;
  const dist = anchor.distanceTo(origin);
  player.anchor = anchor;
  player.rope = Math.min(56, Math.max(7, dist * 0.94));
  player.mode = 'swing';
  player.cooldown = 0.1;
  player.vel.y = Math.max(player.vel.y, 0.5);
  const horiz = new THREE.Vector3(player.vel.x, 0, player.vel.z);
  if (horiz.length() < 5) {
    horiz.set(Math.sin(cam.yaw), 0, Math.cos(cam.yaw)).multiplyScalar(7);
  } else {
    horiz.setLength(Math.min(horiz.length() + 3, 20));
  }
  player.vel.x = horiz.x;
  player.vel.z = horiz.z;
  player.swingSide = anchor.x > player.pos.x ? 1 : -1;
  audio.thwip();
  game.shake = Math.max(game.shake, 0.08);
  return true;
}

function zip() {
  if (player.zipCooldown > 0) return;
  const anchor = findAnchor(_origin.copy(player.pos).add(new THREE.Vector3(0, 1.2, 0)), 70);
  if (!anchor) {
    audio.burst({ duration: 0.12, filterType: 'highpass', from: 600, to: 200, gain: 0.06 });
    return;
  }
  player.zipCooldown = 0.75;
  player.zipTime = 0.32;
  player.zipTarget = anchor;
  player.anchor = null;
  const dir = anchor.clone().sub(player.pos).normalize();
  player.vel.copy(dir).multiplyScalar(44);
  player.vel.y += 5;
  player.mode = 'air';
  player.swingSide = anchor.x > player.pos.x ? 1 : -1;
  audio.zip();
}

function land(intensity) {
  if (player.mode === 'ground') return;
  const wasFast = player.vel.y < -14;
  player.mode = 'ground';
  player.anchor = null;
  player.vel.y = 0;
  player.airTime = 0;
  if (wasFast || intensity > 0.4) {
    hero.land(intensity);
    audio.land(Math.min(1, intensity));
    game.shake = Math.max(game.shake, Math.min(0.6, intensity * 0.55));
  }
}

function resolveCollisions() {
  const center = _boxCenter.copy(player.pos).add(_tmp.set(0, 0.58, 0));
  let impact = 0;
  let hitNormal = null;
  for (const box of city.colliders) {
    if (box.distanceToPoint(center) > PLAYER_RADIUS + 0.05) continue;
    _closest.set(
      Math.max(box.min.x, Math.min(center.x, box.max.x)),
      Math.max(box.min.y, Math.min(center.y, box.max.y)),
      Math.max(box.min.z, Math.min(center.z, box.max.z))
    );
    _offset.copy(center).sub(_closest);
    let dist = _offset.length();
    let normal;
    if (dist > 1e-5) {
      normal = _offset.multiplyScalar(1 / dist);
    } else {
      // center inside the box: push out the shortest axis
      const dxp = box.max.x - center.x, dxn = center.x - box.min.x;
      const dyp = box.max.y - center.y, dyn = center.y - box.min.y;
      const dzp = box.max.z - center.z, dzn = center.z - box.min.z;
      const m = Math.min(dxp, dxn, dyp, dyn, dzp, dzn);
      normal = new THREE.Vector3();
      if (m === dxp) normal.set(1, 0, 0);
      else if (m === dxn) normal.set(-1, 0, 0);
      else if (m === dyp) normal.set(0, 1, 0);
      else if (m === dyn) normal.set(0, -1, 0);
      else if (m === dzp) normal.set(0, 0, 1);
      else normal.set(0, 0, -1);
      dist = 0;
    }
    const penetration = PLAYER_RADIUS - dist;
    if (penetration > 0) {
      player.pos.addScaledVector(normal, penetration + 0.005);
      center.addScaledVector(normal, penetration + 0.005);
      const vn = player.vel.dot(normal);
      if (vn < 0) {
        impact = Math.max(impact, -vn);
        const bounce = player.mode === 'swing' ? 1.04 : 1.16;
        player.vel.addScaledVector(normal, -vn * bounce);
      }
      if (!hitNormal || penetration > 0.05) hitNormal = normal.clone();
    }
  }

  if (hitNormal) {
    if (player.mode === 'swing' && impact > 32) {
      // only a truly brutal hit snaps the line; grazing hits just spark off the wall
      detach(0);
      player.vel.multiplyScalar(0.72);
      audio.impact(1);
      game.shake = Math.max(game.shake, 0.7);
    } else if (impact > 7) {
      audio.impact(Math.min(0.7, impact / 34));
      game.shake = Math.max(game.shake, Math.min(0.35, impact / 70));
    }
    if (hitNormal.y > 0.65 && player.vel.y <= 0.01) {
      const top = supportHeightAt(player.pos.x, player.pos.z, player.pos.y + 0.8);
      if (player.pos.y <= top + 0.08) {
        player.pos.y = top;
        land(impact / 24);
      }
    }
  }
}

function collectToken(token) {
  token.collected = true;
  token.collectT = 0.32;
  game.tokens++;
  audio.pickup(game.tokens);
  spawnBurst(token.group.position.clone(), 0xffd166, 30);
  spawnBurst(token.group.position.clone(), 0xff3355, 16);
  game.flash = 0.5;
  game.shake = Math.max(game.shake, 0.15);
  showToast(`SPIDER TOKEN ${game.tokens} / ${game.total}`);
  updateTokenUI();
  if (game.tokens >= game.total) winGame();
}

function winGame() {
  game.state = 'won';
  game.finalTime = game.time;
  if (!game.best || game.time < game.best) {
    game.best = game.time;
    try { localStorage.setItem('webrush.best', String(game.best)); } catch (e) { /* ignore */ }
    finalBest.textContent = 'NEW CITY RECORD';
  } else {
    finalBest.textContent = `BEST ${formatTime(game.best)}`;
  }
  finalTime.textContent = formatTime(game.time);
  missionComplete.classList.add('show');
  document.body.classList.remove('playing');
  els.toast.classList.remove('show');
  toastTimer = 0;
  audio.finish();
  updateBestUI();
  if (document.pointerLockElement) document.exitPointerLock();
  setHint('');
  setTimeout(() => { game.state = 'won'; }, 0);
}

/* ------------------------------------------------------------------ */
/*  Simulation                                                         */
/* ------------------------------------------------------------------ */

function updatePlayer(dt) {
  player.cooldown = Math.max(0, player.cooldown - dt);
  player.zipCooldown = Math.max(0, player.zipCooldown - dt);
  player.zipTime = Math.max(0, player.zipTime - dt);

  const wish = wishDirection();
  const wishLen = Math.min(1, Math.hypot(input.x, input.y));
  const wasSwinging = player.mode === 'swing';

  if (input.jumpQueued) {
    input.jumpQueued = false;
    if (player.mode === 'ground') {
      player.mode = 'air';
      player.vel.y = 11.5;
      player.vel.x += Math.sin(cam.yaw) * 4;
      player.vel.z += Math.cos(cam.yaw) * 4;
      player.airTime = 0;
      audio.burst({ duration: 0.15, filterType: 'highpass', from: 400, to: 1200, gain: 0.04 });
    }
  }

  // Holding web on the ground triggers a leap straight into a swing.
  const swingEdge = input.swing && !player.prevSwing;
  player.prevSwing = input.swing;
  if (swingEdge && player.mode === 'ground') {
    player.mode = 'air';
    player.vel.y = 9.8;
    player.vel.x += Math.sin(cam.yaw) * 9;
    player.vel.z += Math.cos(cam.yaw) * 9;
    player.airTime = 0;
    tryAttach();
  } else if (input.swing && player.mode === 'air' && player.cooldown <= 0 && player.vel.y < 8) {
    tryAttach();
  }

  if (player.mode === 'ground') {
    const speedTarget = input.dive ? SPRINT_SPEED : RUN_SPEED;
    const targetVx = wish.x * speedTarget * wishLen;
    const targetVz = wish.z * speedTarget * wishLen;
    const rate = wishLen > 0.05 ? 13 : 9;
    player.vel.x = THREE.MathUtils.damp(player.vel.x, targetVx, rate, dt);
    player.vel.z = THREE.MathUtils.damp(player.vel.z, targetVz, rate, dt);
    player.vel.y = 0;

    if (wishLen > 0.15) player.yaw = dampAngle(player.yaw, Math.atan2(wish.x, wish.z), 12, dt);

    // stick to the block, or drop off the edge
    const support = supportHeightAt(player.pos.x, player.pos.z, player.pos.y + 0.6);
    if (support > player.pos.y + 0.62) {
      player.pos.y = support;
    } else if (support < player.pos.y - 0.62) {
      player.mode = 'air';
      player.vel.y = 0;
      player.airTime = 0;
    } else {
      player.pos.y = support;
    }
    player.lastSupport = support;
  } else {
    player.airTime += dt;
    const diving = input.dive && !wasSwinging;
    player.vel.y -= (diving ? DIVE_GRAVITY : GRAVITY) * dt;

    if (player.mode === 'swing') {
      // web tension: steering + pumping
      player.vel.addScaledVector(wish, 11 * dt);
      const pump = input.y;
      if (Math.abs(pump) > 0.08) {
        player.rope -= pump * 7.5 * dt;
      }
      player.rope = THREE.MathUtils.clamp(player.rope, 9.5, 58);

      // small self-pump along the direction of travel keeps the arc alive
      const hSpeed = Math.hypot(player.vel.x, player.vel.z);
      if (hSpeed < 30) {
        _tmp.set(player.vel.x, 0, player.vel.z);
        if (_tmp.lengthSq() < 0.01) _tmp.set(Math.sin(cam.yaw), 0, Math.cos(cam.yaw));
        _tmp.normalize();
        player.vel.addScaledVector(_tmp, 3.5 * dt);
      }

      player.vel.x *= 1 - 0.08 * dt;
      player.vel.z *= 1 - 0.08 * dt;

      player.pos.addScaledVector(player.vel, dt);

      _offset.copy(player.pos).sub(player.anchor);
      const dist = _offset.length();
      if (dist > player.rope) {
        _offset.multiplyScalar(1 / dist);
        player.pos.copy(player.anchor).addScaledVector(_offset, player.rope);
        const radial = player.vel.dot(_offset);
        if (radial > 0) player.vel.addScaledVector(_offset, -radial);
      }
      if (dist < 7.5 || (player.pos.y > player.anchor.y - 1.5 && player.vel.y > -1)) detach(0.5);
    } else {
      // freefall
      if (diving) {
        player.vel.addScaledVector(wish, 22 * dt);
        if (input.y > 0) {
          const hs = Math.hypot(player.vel.x, player.vel.z);
          if (hs < 38) {
            _tmp.set(player.vel.x, 0, player.vel.z);
            if (_tmp.lengthSq() < 0.01) _tmp.copy(_forward);
            _tmp.normalize();
            player.vel.addScaledVector(_tmp, 12 * dt);
          }
        }
      } else {
        player.vel.addScaledVector(wish, 15 * dt);
      }
      player.pos.addScaledVector(player.vel, dt);
    }

    const speed = player.vel.length();
    if (speed > MAX_SPEED) player.vel.multiplyScalar(MAX_SPEED / speed);

    if (player.vel.lengthSq() > 9 && player.mode !== 'swing') {
      player.yaw = dampAngle(player.yaw, Math.atan2(player.vel.x, player.vel.z), 5.5, dt);
    } else if (player.mode === 'swing' && Math.hypot(player.vel.x, player.vel.z) > 4) {
      player.yaw = dampAngle(player.yaw, Math.atan2(player.vel.x, player.vel.z), 7, dt);
    }
  }

  // horizontal bounds
  const bound = 232;
  if (Math.abs(player.pos.x) > bound) {
    player.pos.x = Math.sign(player.pos.x) * bound;
    player.vel.x *= -0.3;
  }
  if (Math.abs(player.pos.z) > bound) {
    player.pos.z = Math.sign(player.pos.z) * bound;
    player.vel.z *= -0.3;
  }

  resolveCollisions();

  // ground / roof support
  if (player.mode !== 'ground') {
    const support = supportHeightAt(player.pos.x, player.pos.z, player.pos.y + 0.2);
    if (player.pos.y <= support + 0.02 && player.vel.y <= 0.5) {
      player.pos.y = support;
      const intensity = Math.min(1, Math.abs(player.vel.y) / 26);
      player.vel.y = 0;
      land(intensity);
    }
  } else {
    const support = supportHeightAt(player.pos.x, player.pos.z, player.pos.y + 0.6);
    if (player.pos.y < support - 0.05 && support - player.pos.y < 0.6) player.pos.y = support;
  }

  // release the web when the player lets go
  if (!input.swing && player.mode === 'swing') detach(0);

  // never fall through the world
  if (player.pos.y < -20) {
    player.pos.copy(city.spawn.position);
    player.vel.set(0, 0, 0);
    player.mode = 'ground';
  }

  // hero transform + animation
  hero.root.position.copy(player.pos);
  hero.root.rotation.y = player.yaw;

  const speed = player.vel.length();
  let mode = 'air';
  if (player.mode === 'ground') mode = 'ground';
  else if (player.mode === 'swing') mode = 'swing';
  else if (input.dive && player.vel.y < -5) mode = 'dive';
  else if (player.vel.y < -18) mode = 'air';

  const swingSide = player.anchor ? (player.anchor.x > player.pos.x ? 1 : -1) : player.swingSide;
  const anchor = player.mode === 'swing' ? player.anchor : (player.zipTime > 0 ? player.zipTarget : null);
  hero.update(dt, {
    mode,
    speed,
    vertical: player.vel.y,
    move: input.y,
    turn: input.x,
    time: elapsed,
    swingSide,
    anchor,
    camera,
  });
}

/* ------------------------------------------------------------------ */
/*  Camera                                                             */
/* ------------------------------------------------------------------ */

function updateCamera(dt, force = false) {
  const now = elapsed;
  const speed = player.vel.length();

  // auto-align the camera behind the direction of travel while swinging
  if (game.state === 'playing' && player.mode === 'swing' && speed > 8 && now - cam.lastLook > 1.1) {
    const targetYaw = Math.atan2(player.vel.x, player.vel.z);
    cam.yaw = dampAngle(cam.yaw, targetYaw, 1.5, dt);
    cam.targetYaw = cam.yaw;
  }

  cam.pitch += (cam.targetPitch - cam.pitch) * Math.min(1, dt * 12);
  if (cam.snap) {
    cam.yaw = cam.targetYaw;
    cam.pitch = cam.targetPitch;
    cam.snap = false;
  }

  const distTarget = player.mode === 'swing' ? 9.2 : 7.4;
  cam.dist += (distTarget - cam.dist) * Math.min(1, dt * 3);

  const lookAhead = _tmp.set(player.vel.x, 0, player.vel.z).multiplyScalar(0.055);
  if (lookAhead.length() > 4) lookAhead.setLength(4);
  const target = _tmp2.copy(player.pos).add(new THREE.Vector3(0, 1.55, 0)).add(lookAhead);

  if (game.state === 'menu') {
    cam.yaw = city.spawn.yaw + Math.sin(elapsed * 0.12) * 0.34;
    cam.pitch = 0.12 + Math.sin(elapsed * 0.09) * 0.04;
    cam.dist = 6.4;
    target.copy(player.pos).add(new THREE.Vector3(0, 1.4, 0));
    // On tall portrait screens, drop the hero lower so the menu copy stays clear.
    if (window.innerHeight > window.innerWidth) target.y += 0.85;
  }

  const cp = Math.cos(cam.pitch);
  const dir = _offset.set(Math.sin(cam.yaw) * cp, -Math.sin(cam.pitch), Math.cos(cam.yaw) * cp).normalize();
  let dist = cam.dist;
  const desired = new THREE.Vector3().copy(target).addScaledVector(dir, -dist);

  // shorten the boom if a building is in the way
  const back = desired.clone().sub(target);
  const backLen = back.length();
  if (backLen > 0.001) {
    back.multiplyScalar(1 / backLen);
    ray.set(target, back);
    let closest = backLen;
    for (const box of city.colliders) {
      if (ray.intersectBox(box, _camHit)) {
        const d = _camHit.distanceTo(target);
        if (d < closest) closest = d;
      }
    }
    if (closest < backLen) dist = Math.max(2.4, closest - 0.5);
  }
  desired.copy(target).addScaledVector(dir, -dist);
  desired.y = Math.max(desired.y, supportHeightAt(desired.x, desired.z, desired.y + 4) + 0.9);

  if (cam.snap || force) {
    cam.basePos.copy(desired);
    cam.lookTarget.copy(target);
  } else {
    const smoothing = 1 - Math.exp(-(game.state === 'playing' ? 9 : 3) * dt);
    cam.basePos.lerp(desired, smoothing);
    cam.lookTarget.lerp(target, 1 - Math.exp(-14 * dt));
  }

  game.shake = Math.max(0, game.shake - dt * 1.8);
  const s = game.shake * game.shake * 0.9;
  cam.shake.set((Math.random() - 0.5) * s, (Math.random() - 0.5) * s, (Math.random() - 0.5) * s);

  camera.position.copy(cam.basePos).add(cam.shake);
  camera.lookAt(cam.lookTarget);

  const fovTarget = 64 + Math.min(24, Math.max(0, speed - 12) * 0.55);
  cam.fov += (fovTarget - cam.fov) * Math.min(1, dt * 4);
  camera.fov = cam.fov;
  camera.updateProjectionMatrix();

  // sun shadow box follows the player
  sunLight.position.copy(player.pos).addScaledVector(SUN_DIR, 170);
  heroLight.position.set(player.pos.x, player.pos.y + 5.2, player.pos.z);
  sunLight.target.position.copy(player.pos);
  sunLight.target.updateMatrixWorld();
}

/* ------------------------------------------------------------------ */
/*  HUD                                                                */
/* ------------------------------------------------------------------ */

const els = {
  hud: document.getElementById('hud'),
  tokenCount: document.getElementById('tokenCount'),
  tokenTotal: document.getElementById('tokenTotal'),
  timer: document.getElementById('timer'),
  bestTime: document.getElementById('bestTime'),
  speedNum: document.getElementById('speedNum'),
  speedFill: document.getElementById('speedFill'),
  stateLabel: document.getElementById('stateLabel'),
  reticle: document.getElementById('reticle'),
  hint: document.getElementById('hint'),
  toast: document.getElementById('toast'),
  startScreen: document.getElementById('startScreen'),
  loadingScreen: document.getElementById('loadingScreen'),
  pauseScreen: document.getElementById('pauseScreen'),
  playBtn: document.getElementById('playBtn'),
  resumeBtn: document.getElementById('resumeBtn'),
  restartBtn: document.getElementById('restartBtn'),
  againBtn: document.getElementById('againBtn'),
  pauseToggle: document.getElementById('pauseToggle'),
  soundToggle: document.getElementById('soundToggle'),
  missionComplete: document.getElementById('missionComplete'),
  finalTime: document.getElementById('finalTime'),
  finalBest: document.getElementById('finalBest'),
  pauseTokens: document.getElementById('pauseTokens'),
  pauseTime: document.getElementById('pauseTime'),
  flash: document.getElementById('flash'),
  speedlines: document.getElementById('speedlines'),
  minimap: document.getElementById('minimap'),
  loadFill: document.getElementById('loadFill'),
};
const missionComplete = els.missionComplete;
const finalTime = els.finalTime;
const finalBest = els.finalBest;

function formatTime(t) {
  const m = Math.floor(t / 60);
  const s = Math.floor(t % 60);
  const c = Math.floor((t % 1) * 100);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(c).padStart(2, '0')}`;
}

function updateTokenUI() {
  els.tokenCount.textContent = String(game.tokens);
  els.tokenTotal.textContent = String(game.total);
  els.pauseTokens.textContent = `${game.tokens} / ${game.total}`;
}

function updateBestUI() {
  els.bestTime.textContent = game.best ? `BEST ${formatTime(game.best)}` : 'BEST ——';
}

let toastTimer = 0;
function showToast(text, bad = false, duration = 1.7) {
  els.toast.textContent = text;
  els.toast.classList.toggle('bad', bad);
  els.toast.classList.add('show');
  toastTimer = duration;
}

let hintSet = '';
function setHint(text) {
  if (text === hintSet) return;
  hintSet = text;
  els.hint.innerHTML = text;
  els.hint.style.opacity = text ? '1' : '0';
}

function updateHUD(dt) {
  const speed = player.vel.length();
  const mph = Math.round(speed * 2.237);
  els.speedNum.textContent = String(mph);
  els.speedFill.style.width = `${Math.min(100, (speed / MAX_SPEED) * 100)}%`;
  els.timer.textContent = formatTime(game.time);
  els.pauseTime.textContent = formatTime(game.time);

  let label = 'READY';
  if (player.mode === 'swing') label = 'WEB-SWINGING';
  else if (input.dive && player.mode !== 'ground') label = 'DIVING';
  else if (player.mode === 'air') label = player.vel.y < -12 ? 'FREEFALL' : 'AIRBORNE';
  else if (game.tokens >= game.total) label = 'CITY SAVED';
  els.stateLabel.textContent = label;

  els.reticle.classList.toggle('ready', game.anchorReady && player.mode !== 'swing');
  els.reticle.classList.toggle('hidden', player.mode === 'swing' || player.mode === 'ground' || game.state !== 'playing');
  els.speedlines.style.opacity = String(game.state === 'playing' ? Math.min(0.55, Math.max(0, (speed - 26) / 60)) : 0);

  if (toastTimer > 0) {
    toastTimer -= dt;
    if (toastTimer <= 0) els.toast.classList.remove('show');
  }

  game.flash = Math.max(0, game.flash - dt * 2.4);
  els.flash.style.opacity = String(game.flash);

  drawMinimap();
}

/* ------------------------------------------------------------------ */
/*  Minimap                                                            */
/* ------------------------------------------------------------------ */

const mini = els.minimap;
const mctx = mini.getContext('2d');
const miniStatic = document.createElement('canvas');
miniStatic.width = miniStatic.height = 220;
let miniReady = false;

function buildMiniStatic() {
  const g = miniStatic.getContext('2d');
  const S = 220;
  const scale = S / 512;
  const toPx = (v) => (v + 256) * scale;
  g.clearRect(0, 0, S, S);
  g.fillStyle = '#0c0a18';
  g.fillRect(0, 0, S, S);

  // roads
  g.strokeStyle = 'rgba(255,255,255,0.09)';
  g.lineWidth = 3;
  for (let i = -4; i < 4; i++) {
    const p = toPx((i + 0.5) * 64);
    g.beginPath(); g.moveTo(p, 0); g.lineTo(p, S); g.stroke();
    g.beginPath(); g.moveTo(0, p); g.lineTo(S, p); g.stroke();
  }
  // park
  g.fillStyle = '#173a2a';
  g.fillRect(toPx(-24), toPx(-24), 48 * scale, 48 * scale);
  // buildings
  g.fillStyle = 'rgba(150,140,210,0.2)';
  for (const b of city.buildings) {
    const x = toPx(b.x - b.w / 2);
    const z = toPx(b.z - b.d / 2);
    g.fillRect(x, z, b.w * scale, b.d * scale);
  }
  g.strokeStyle = 'rgba(255,255,255,0.2)';
  g.lineWidth = 2;
  g.beginPath(); g.arc(S / 2, S / 2, S / 2 - 4, 0, Math.PI * 2); g.stroke();
  miniReady = true;
}

function drawMinimap() {
  if (!miniReady) buildMiniStatic();
  const S = 220;
  const scale = S / 512;
  const toPx = (v) => (v + 256) * scale;
  mctx.clearRect(0, 0, S, S);
  mctx.save();
  mctx.beginPath();
  mctx.arc(S / 2, S / 2, S / 2 - 2, 0, Math.PI * 2);
  mctx.clip();
  mctx.drawImage(miniStatic, 0, 0);

  // tokens
  for (const t of tokens) {
    if (t.collected) continue;
    mctx.beginPath();
    mctx.arc(toPx(t.group.position.x), toPx(t.group.position.z), 3.4, 0, Math.PI * 2);
    mctx.fillStyle = '#ffcf5c';
    mctx.shadowColor = '#ffcf5c';
    mctx.shadowBlur = 8;
    mctx.fill();
  }
  mctx.shadowBlur = 0;

  // player arrow
  const px = toPx(player.pos.x);
  const pz = toPx(player.pos.z);
  mctx.translate(px, pz);
  mctx.rotate(Math.PI - player.yaw);
  mctx.beginPath();
  mctx.moveTo(0, -8);
  mctx.lineTo(5.5, 6);
  mctx.lineTo(0, 3);
  mctx.lineTo(-5.5, 6);
  mctx.closePath();
  mctx.fillStyle = '#ff3355';
  mctx.shadowColor = '#ff3355';
  mctx.shadowBlur = 10;
  mctx.fill();
  mctx.shadowBlur = 0;
  mctx.strokeStyle = 'rgba(255,255,255,0.8)';
  mctx.lineWidth = 1;
  mctx.stroke();
  mctx.restore();
}

/* ------------------------------------------------------------------ */
/*  Input                                                              */
/* ------------------------------------------------------------------ */

const isTouch = (navigator.maxTouchPoints > 0 && window.matchMedia('(pointer: coarse)').matches) ||
  /android|iphone|ipad|ipod|mobile/i.test(navigator.userAgent);

if (isTouch) document.body.classList.add('touch');

const keys = new Set();
const PREVENT = new Set(['Space', 'ShiftLeft', 'ShiftRight', 'KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']);

function syncKeys() {
  const x = (keys.has('KeyD') || keys.has('ArrowRight') ? 1 : 0) - (keys.has('KeyA') || keys.has('ArrowLeft') ? 1 : 0);
  const y = (keys.has('KeyW') || keys.has('ArrowUp') ? 1 : 0) - (keys.has('KeyS') || keys.has('ArrowDown') ? 1 : 0);
  if (!input.touchLook) { input.x = x; input.y = y; }
  input.dive = keys.has('ShiftLeft') || keys.has('ShiftRight');
}

window.addEventListener('keydown', (e) => {
  if (PREVENT.has(e.code)) e.preventDefault();
  if (e.repeat) {
    if (e.code === 'KeyE') return;
    return;
  }
  keys.add(e.code);
  if (e.code === 'Space') {
    input.swing = true;
    if (game.state === 'menu') startGame();
  }
  if (e.code === 'KeyE' && game.state === 'playing') zip();
  if (e.code === 'KeyR' && (game.state === 'playing' || game.state === 'won' || game.state === 'paused')) restartRun();
  if (e.code === 'KeyM') toggleSound();
  if (e.code === 'Escape') {
    if (game.state === 'playing') setPaused(true);
    else if (game.state === 'paused') setPaused(false);
  }
  syncKeys();
});

window.addEventListener('keyup', (e) => {
  keys.delete(e.code);
  if (e.code === 'Space') input.swing = false;
  syncKeys();
});

window.addEventListener('blur', () => {
  keys.clear();
  input.swing = false;
  input.dive = false;
  syncKeys();
});

// mouse look + hold-to-swing with pointer lock
document.addEventListener('mousemove', (e) => {
  if (game.state !== 'playing') return;
  if (document.pointerLockElement === canvas) {
    cam.targetYaw -= e.movementX * 0.0022;
    cam.targetPitch = THREE.MathUtils.clamp(cam.targetPitch + e.movementY * 0.0019, -0.38, 1.05);
    cam.yaw = cam.targetYaw;
    cam.pitch = THREE.MathUtils.clamp(cam.pitch + e.movementY * 0.0019, -0.38, 1.05);
    cam.lastLook = elapsed;
  }
});

document.addEventListener('mousedown', (e) => {
  if (e.button !== 0) return;
  if (game.state !== 'playing') return;
  if (document.pointerLockElement === canvas) {
    input.swing = true;
  } else if (isTouch) {
    return;
  }
});

document.addEventListener('mouseup', (e) => {
  if (e.button !== 0) return;
  if (document.pointerLockElement === canvas) input.swing = false;
});

document.addEventListener('pointerlockchange', () => {
  if (document.pointerLockElement !== canvas && game.state === 'playing' && !isTouch) {
    // Escape releases the lock; treat that as a pause.
    setPaused(true);
  }
});

canvas.addEventListener('click', () => {
  if (game.state === 'playing' && !isTouch && document.pointerLockElement !== canvas) {
    canvas.requestPointerLock?.();
  }
});

// drag-look fallback (also used on touch)
const drag = { active: false, id: null, x: 0, y: 0, moved: false };
canvas.addEventListener('pointerdown', (e) => {
  if (game.state !== 'playing') return;
  if (e.pointerType === 'mouse' && document.pointerLockElement === canvas) return;
  drag.active = true;
  drag.id = e.pointerId;
  drag.x = e.clientX;
  drag.y = e.clientY;
  drag.moved = false;
  if (e.pointerType !== 'mouse') {
    try { canvas.setPointerCapture?.(e.pointerId); } catch (err) { /* synthetic pointers */ }
    input.touchLook = true;
  }
});
canvas.addEventListener('pointermove', (e) => {
  if (!drag.active || e.pointerId !== drag.id || game.state !== 'playing') return;
  const dx = e.clientX - drag.x;
  const dy = e.clientY - drag.y;
  drag.x = e.clientX;
  drag.y = e.clientY;
  if (Math.abs(dx) + Math.abs(dy) > 2) drag.moved = true;
  const sens = e.pointerType === 'mouse' ? 0.004 : 0.006;
  cam.targetYaw -= dx * sens;
  cam.targetPitch = THREE.MathUtils.clamp(cam.targetPitch + dy * sens, -0.38, 1.05);
  cam.yaw = cam.targetYaw;
  cam.pitch = THREE.MathUtils.clamp(cam.pitch + dy * sens, -0.38, 1.05);
  cam.lastLook = elapsed;
});
function endDrag(e) {
  if (e.pointerId !== drag.id) return;
  drag.active = false;
  drag.id = null;
  if (e.pointerType !== 'mouse') input.touchLook = false;
}
canvas.addEventListener('pointerup', endDrag);
canvas.addEventListener('pointercancel', endDrag);

// touch controls
const joy = document.getElementById('joystick');
const stick = document.getElementById('stick');
let joyId = null;
function joyMove(e) {
  const rect = joy.getBoundingClientRect();
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;
  let dx = e.clientX - cx;
  let dy = e.clientY - cy;
  const max = rect.width * 0.36;
  const len = Math.hypot(dx, dy);
  if (len > max) { dx = (dx / len) * max; dy = (dy / len) * max; }
  stick.style.transform = `translate(${dx}px, ${dy}px)`;
  input.x = dx / max;
  input.y = -dy / max;
}
joy.addEventListener('pointerdown', (e) => {
  e.preventDefault();
  joyId = e.pointerId;
  try { joy.setPointerCapture?.(joyId); } catch (err) { /* synthetic pointers */ }
  joyMove(e);
});
joy.addEventListener('pointermove', (e) => {
  if (e.pointerId === joyId) joyMove(e);
});
function joyEnd(e) {
  if (e.pointerId !== joyId) return;
  joyId = null;
  input.x = 0; input.y = 0;
  stick.style.transform = 'translate(0px, 0px)';
}
joy.addEventListener('pointerup', joyEnd);
joy.addEventListener('pointercancel', joyEnd);

const btnWeb = document.getElementById('btnWeb');
const btnJump = document.getElementById('btnJump');
const btnZip = document.getElementById('btnZip');
function bindHold(btn, onDown, onUp) {
  btn.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    try { btn.setPointerCapture?.(e.pointerId); } catch (err) { /* synthetic pointers */ }
    btn.classList.add('down');
    onDown?.(e);
  });
  const up = (e) => {
    e.preventDefault();
    btn.classList.remove('down');
    onUp?.(e);
  };
  btn.addEventListener('pointerup', up);
  btn.addEventListener('pointercancel', up);
}
bindHold(btnWeb, () => { input.swing = true; }, () => { input.swing = false; });
bindHold(btnJump, () => {
  if (player.mode === 'ground') input.jumpQueued = true;
  else input.dive = true;
}, () => { input.dive = false; });
bindHold(btnZip, () => { zip(); }, () => {});

// UI buttons
els.playBtn.addEventListener('click', startGame);
els.resumeBtn.addEventListener('click', () => setPaused(false));
els.restartBtn.addEventListener('click', restartRun);
els.againBtn.addEventListener('click', () => { restartRun(); });
els.pauseToggle.addEventListener('click', () => {
  if (game.state === 'playing') setPaused(true);
  else if (game.state === 'paused') setPaused(false);
});
els.soundToggle.addEventListener('click', toggleSound);
window.addEventListener('contextmenu', (e) => e.preventDefault());

function toggleSound() {
  audio.init();
  const muted = audio.toggleMute();
  els.soundToggle.classList.toggle('muted', muted);
}

/* ------------------------------------------------------------------ */
/*  Game flow                                                          */
/* ------------------------------------------------------------------ */

function resetRunWorld() {
  player.pos.copy(city.spawn.position);
  player.vel.set(0, 0, 0);
  player.yaw = city.spawn.yaw;
  player.mode = 'ground';
  player.anchor = null;
  player.cooldown = 0;
  player.zipCooldown = 0;
  player.zipTime = 0;
  player.zipTarget = null;
  player.airTime = 0;
  hero.root.position.copy(player.pos);
  hero.root.rotation.y = player.yaw;

  game.time = 0;
  game.tokens = 0;
  game.shake = 0;
  game.flash = 0;
  game.anchorReady = false;

  for (const t of tokens) {
    t.collected = false;
    t.collectT = 0;
    t.group.visible = true;
    t.group.scale.setScalar(1);
    t.group.position.set(t.group.position.x, t.baseY, t.group.position.z);
    t.core.rotation.set(0, 0, 0);
  }

  cam.targetYaw = city.spawn.yaw;
  cam.targetPitch = 0.19;
  cam.snap = true;
  cam.fov = 64;
  updateTokenUI();
  missionComplete.classList.remove('show');
  setHint('HOLD <kbd>SPACE</kbd> TO WEB-SWING &nbsp;&middot;&nbsp; <kbd>SHIFT</kbd> TO DIVE');
  game.hintTimer = 9;
}

function startGame() {
  if (game.state === 'playing') return;
  audio.init();
  if (game.state === 'menu') resetRunWorld();
  else if (game.state === 'won' || game.state === 'paused') {
    if (game.state === 'won') resetRunWorld();
  }
  els.startScreen.classList.remove('open');
  els.startScreen.classList.add('hidden');
  els.pauseScreen.classList.remove('open');
  els.loadingScreen.classList.add('hidden');
  document.body.classList.add('playing');
  els.hud.classList.add('visible');
  game.state = 'playing';
  game.started = true;
  if (!isTouch) canvas.requestPointerLock?.();
  audio.init();
}

function restartRun() {
  resetRunWorld();
  els.pauseScreen.classList.remove('open');
  els.startScreen.classList.add('hidden');
  document.body.classList.add('playing');
  els.hud.classList.add('visible');
  game.state = 'playing';
  if (!isTouch) canvas.requestPointerLock?.();
}

function setPaused(paused) {
  if (paused && game.state === 'playing') {
    game.state = 'paused';
    input.swing = false;
    input.dive = false;
    input.x = 0;
    input.y = 0;
    keys.clear();
    els.pauseScreen.classList.add('open');
    updateTokenUI();
    els.pauseTime.textContent = formatTime(game.time);
    if (document.pointerLockElement) document.exitPointerLock();
    document.body.classList.remove('playing');
    audio.update(0, 0, false);
  } else if (!paused && game.state === 'paused') {
    game.state = 'playing';
    els.pauseScreen.classList.remove('open');
    document.body.classList.add('playing');
    if (!isTouch) canvas.requestPointerLock?.();
  }
}

document.addEventListener('visibilitychange', () => {
  if (document.hidden && game.state === 'playing') setPaused(true);
});

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
  renderer.setSize(window.innerWidth, window.innerHeight, false);
});

/* ------------------------------------------------------------------ */
/*  Main loop                                                          */
/* ------------------------------------------------------------------ */

const clock = new THREE.Clock();
let elapsed = 0;
let last = performance.now();
let anchorCheck = 0;

function animate(now) {
  requestAnimationFrame(animate);
  const dt = Math.min(0.05, Math.max(0.0001, (now - last) / 1000));
  last = now;
  elapsed += dt;

  city.update(dt, elapsed);
  updateBursts(dt);

  if (game.state === 'playing') {
    game.time += dt;
    updatePlayer(dt);
    game.anchorTimer -= dt;
    if (game.anchorTimer <= 0) {
      game.anchorTimer = 0.14;
      game.anchorReady = player.mode !== 'swing' && !!findAnchor(_tmp.copy(player.pos).add(_tmp2.set(0, 1.35, 0)));
    }
    if (game.hintTimer > 0) {
      game.hintTimer -= dt;
      if (game.hintTimer <= 0) els.hint.classList.add('fade');
    }
    if (player.mode === 'swing') game.anchorReady = false;
  } else {
    // idle showcase in the menu, idle pose elsewhere
    hero.root.position.copy(player.pos);
    hero.root.rotation.y = player.yaw;
    hero.update(dt, {
      mode: 'ground', speed: 0, vertical: 0, move: 0, turn: 0,
      time: elapsed, swingSide: 1, anchor: null, camera,
    });
  }

  // token idle + pickup animation
  for (const t of tokens) {
    if (t.collected) {
      if (t.collectT > 0) {
        t.collectT -= dt;
        const k = Math.max(0, t.collectT / 0.32);
        t.group.scale.setScalar(k);
        t.group.position.y += dt * 12;
        t.group.rotation.y += dt * 12;
        if (t.collectT <= 0) t.group.visible = false;
      }
      continue;
    }
    const bob = Math.sin(elapsed * 1.8 + t.phase) * 0.55;
    t.group.position.y = t.baseY + bob;
    t.core.rotation.y += dt * 1.4;
    t.core.rotation.x += dt * 0.55;
    t.ring.rotation.z += dt * 0.9;
    t.ring2.rotation.x -= dt * 0.7;
    t.halo.scale.setScalar(6.6 + Math.sin(elapsed * 2.2 + t.phase) * 0.8);

    if (game.state === 'playing') {
      const dx = player.pos.x - t.group.position.x;
      const dy = player.pos.y + 1 - t.group.position.y;
      const dz = player.pos.z - t.group.position.z;
      if (dx * dx + dy * dy + dz * dz < 16) collectToken(t);
    }
  }

  updateCamera(dt);
  audio.update(dt, player.vel.length(), game.state === 'playing');
  updateHUD(dt);

  renderer.render(scene, camera);
}

/* ------------------------------------------------------------------ */
/*  Boot                                                               */
/* ------------------------------------------------------------------ */

function boot() {
  resetRunWorld();
  updateTokenUI();
  updateBestUI();
  buildMiniStatic();
  els.loadingScreen.classList.remove('hidden');
  els.loadFill.style.width = '60%';
  if (isTouch) {
    document.getElementById('touchUI').setAttribute('aria-hidden', 'false');
    els.hint.textContent = '';
  }
  hero.root.position.copy(player.pos);
  hero.root.rotation.y = player.yaw;
  updateCamera(0, true);
  renderer.render(scene, camera);

  setTimeout(() => {
    els.loadFill.style.width = '100%';
    setTimeout(() => {
      els.loadingScreen.classList.add('hidden');
      els.startScreen.classList.add('open');
      camera.position.copy(cam.basePos);
    }, 260);
  }, 220);

  requestAnimationFrame(animate);
}

// Debug hook used by automated checks / curious tinkerers.
window.__webrush = {
  game, player, city, camera, scene, renderer, hero, tokens, cam, input,
  press(code) {
    keys.add(code);
    if (code === 'Space') input.swing = true;
    syncKeys();
  },
  release(code) {
    keys.delete(code);
    if (code === 'Space') input.swing = false;
    syncKeys();
  },
  start: startGame,
  restart: restartRun,
  pause: setPaused,
  attach: tryAttach,
  zip,
  teleport(x, y, z) {
    player.pos.set(x, y, z);
    player.vel.set(0, 0, 0);
    player.mode = 'air';
  },
  collectAll() {
    for (const t of tokens) if (!t.collected) collectToken(t);
  },
  step(seconds, h = 1 / 60) {
    const prev = game.state;
    game.state = 'debug';
    const steps = Math.min(6000, Math.round(seconds / h));
    for (let i = 0; i < steps; i++) {
      if (game.state !== 'debug') break;
      updatePlayer(h);
    }
    game.state = prev === 'debug' ? 'playing' : prev;
    return { steps };
  },
};

boot();
