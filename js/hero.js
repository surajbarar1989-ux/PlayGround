import * as THREE from 'three';

function webTexture() {
  const S = 256;
  const c = document.createElement('canvas');
  c.width = S; c.height = S;
  const g = c.getContext('2d');
  const grad = g.createLinearGradient(0, 0, 0, S);
  grad.addColorStop(0, '#d21b36');
  grad.addColorStop(1, '#a90c24');
  g.fillStyle = grad;
  g.fillRect(0, 0, S, S);

  g.strokeStyle = 'rgba(35, 4, 12, 0.82)';
  g.lineWidth = 2.2;
  // radial web lines
  for (let i = 0; i < 14; i++) {
    const x = (i / 14) * S;
    g.beginPath();
    g.moveTo(x, 0);
    g.bezierCurveTo(x + 10, S * 0.3, x - 10, S * 0.7, x, S);
    g.stroke();
  }
  // concentric scalloped strands
  for (let r = 1; r <= 7; r++) {
    const y = (r / 8) * S;
    g.beginPath();
    for (let x = 0; x <= S; x += 8) {
      const ry = y + Math.sin((x / S) * Math.PI * 14 + r) * 4;
      if (x === 0) g.moveTo(x, ry);
      else g.lineTo(x, ry);
    }
    g.stroke();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 4;
  return tex;
}

function spiderEmblem(color = '#0b0b12', size = 512) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  const u = size / 512;
  g.fillStyle = color;
  g.save();
  g.translate(256 * u, 270 * u);
  g.scale(u, u);

  // legs (4 per side)
  g.strokeStyle = color;
  g.lineWidth = 13;
  g.lineCap = 'round';
  const legs = [
    [-20, -55, -110, -105, -150, -66],
    [-26, -18, -132, -34, -172, 10],
    [-26, 15, -128, 42, -158, 108],
    [-20, 52, -96, 106, -108, 164],
  ];
  for (const [x1, y1, cx, cy, x2, y2] of legs) {
    for (const s of [-1, 1]) {
      g.beginPath();
      g.moveTo(x1 * s, y1);
      g.quadraticCurveTo(cx * s, cy, x2 * s, y2);
      g.stroke();
    }
  }
  // body
  g.beginPath();
  g.ellipse(0, 0, 42, 108, 0, 0, Math.PI * 2);
  g.fill();
  // head
  g.beginPath();
  g.arc(0, -104, 32, 0, Math.PI * 2);
  g.fill();
  // abdomen tip
  g.beginPath();
  g.moveTo(0, 108);
  g.lineTo(28, 60);
  g.lineTo(-28, 60);
  g.closePath();
  g.fill();
  g.restore();

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

export function createHero(scene) {
  const root = new THREE.Group();
  root.name = 'hero';
  const body = new THREE.Group();
  root.add(body);

  const web = webTexture();
  const redMat = new THREE.MeshStandardMaterial({
    color: 0xffffff, map: web, roughness: 0.52, metalness: 0.18,
    emissive: 0x6e0512, emissiveIntensity: 0.42,
  });
  const redPlain = new THREE.MeshStandardMaterial({
    color: 0xc41430, roughness: 0.48, metalness: 0.22,
    emissive: 0x650510, emissiveIntensity: 0.45,
  });
  const blueMat = new THREE.MeshStandardMaterial({
    color: 0x1743a8, roughness: 0.42, metalness: 0.32,
    emissive: 0x071a4a, emissiveIntensity: 0.6,
  });
  const blackMat = new THREE.MeshStandardMaterial({ color: 0x08080d, roughness: 0.35, metalness: 0.2 });
  const lensMat = new THREE.MeshStandardMaterial({
    color: 0xf4f8ff, roughness: 0.2, metalness: 0.1,
    emissive: 0xaecbff, emissiveIntensity: 0.55, side: THREE.DoubleSide,
  });

  const parts = {};

  // pelvis / belt
  const pelvis = new THREE.Mesh(new THREE.SphereGeometry(0.2, 16, 12), blueMat);
  pelvis.position.y = 1.0;
  pelvis.scale.set(1.2, 0.72, 0.85);
  pelvis.castShadow = true;
  body.add(pelvis);
  const belt = new THREE.Mesh(new THREE.TorusGeometry(0.195, 0.022, 5, 20), redMat);
  belt.rotation.x = Math.PI / 2;
  belt.position.y = 1.07;
  belt.scale.set(1.2, 0.9, 1);
  body.add(belt);

  // torso
  const torso = new THREE.Group();
  torso.position.y = 1.07;
  body.add(torso);
  parts.torso = torso;
  const chest = new THREE.Mesh(new THREE.CapsuleGeometry(0.215, 0.34, 6, 16), redMat);
  chest.position.y = 0.26;
  chest.scale.set(1.18, 1, 0.78);
  chest.castShadow = true;
  torso.add(chest);
  // blue side panels
  for (const s of [-1, 1]) {
    const panel = new THREE.Mesh(new THREE.CapsuleGeometry(0.085, 0.3, 4, 10), blueMat);
    panel.position.set(0.185 * s, 0.2, 0);
    panel.scale.set(0.7, 1, 0.95);
    torso.add(panel);
  }
  // chest emblem
  const emblemMat = new THREE.MeshBasicMaterial({
    map: spiderEmblem('#0b0b12'), transparent: true, depthWrite: false,
    toneMapped: false, polygonOffset: true, polygonOffsetFactor: -2,
  });
  const emblem = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.3), emblemMat);
  emblem.position.set(0, 0.27, 0.168);
  emblem.rotation.x = -0.08;
  torso.add(emblem);
  const emblemBack = new THREE.Mesh(new THREE.PlaneGeometry(0.34, 0.34), emblemMat);
  emblemBack.position.set(0, 0.3, -0.168);
  emblemBack.rotation.y = Math.PI;
  emblemBack.rotation.x = 0.08;
  torso.add(emblemBack);

  // neck + head
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.068, 0.085, 0.11, 8), redPlain);
  neck.position.y = 0.54;
  torso.add(neck);

  const headPivot = new THREE.Group();
  headPivot.position.y = 0.62;
  torso.add(headPivot);
  parts.head = headPivot;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.145, 20, 16), redMat);
  head.scale.set(0.92, 1.12, 0.98);
  head.position.y = 0.08;
  head.castShadow = true;
  headPivot.add(head);
  // jaw/chin
  const chin = new THREE.Mesh(new THREE.SphereGeometry(0.11, 12, 10), redPlain);
  chin.position.set(0, -0.015, 0.02);
  chin.scale.set(0.9, 0.78, 0.92);
  headPivot.add(chin);

  // lenses
  for (const s of [-1, 1]) {
    const rim = new THREE.Mesh(new THREE.SphereGeometry(0.044, 12, 10), blackMat);
    rim.position.set(0.052 * s, 0.098, 0.12);
    rim.scale.set(1.02, 1.4, 0.32);
    rim.rotation.z = -0.34 * s;
    rim.rotation.x = -0.08;
    headPivot.add(rim);
    const lens = new THREE.Mesh(new THREE.SphereGeometry(0.034, 12, 10), lensMat);
    lens.position.set(0.052 * s, 0.099, 0.127);
    lens.scale.set(1.0, 1.33, 0.3);
    lens.rotation.z = -0.34 * s;
    lens.rotation.x = -0.08;
    headPivot.add(lens);
  }

  // arms
  function makeArm(side) {
    const shoulder = new THREE.Group();
    shoulder.position.set(0.255 * side, 0.46, 0);
    torso.add(shoulder);
    const deltoid = new THREE.Mesh(new THREE.SphereGeometry(0.098, 12, 10), redPlain);
    deltoid.scale.set(1.05, 0.95, 1);
    shoulder.add(deltoid);
    const upper = new THREE.Mesh(new THREE.CapsuleGeometry(0.067, 0.22, 4, 10), redMat);
    upper.position.y = -0.17;
    upper.castShadow = true;
    shoulder.add(upper);
    const elbow = new THREE.Group();
    elbow.position.y = -0.33;
    shoulder.add(elbow);
    const fore = new THREE.Mesh(new THREE.CapsuleGeometry(0.056, 0.2, 4, 10), redPlain);
    fore.position.y = -0.14;
    fore.castShadow = true;
    elbow.add(fore);
    const cuff = new THREE.Mesh(new THREE.CylinderGeometry(0.062, 0.058, 0.035, 10), blackMat);
    cuff.position.y = -0.255;
    elbow.add(cuff);
    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.068, 10, 8), redPlain);
    hand.position.y = -0.29;
    hand.scale.set(0.9, 1.1, 0.8);
    hand.castShadow = true;
    elbow.add(hand);
    return { shoulder, elbow, hand };
  }
  const armL = makeArm(-1);
  const armR = makeArm(1);
  parts.shoulderL = armL.shoulder; parts.elbowL = armL.elbow; parts.handL = armL.hand;
  parts.shoulderR = armR.shoulder; parts.elbowR = armR.elbow; parts.handR = armR.hand;

  // legs
  function makeLeg(side) {
    const hip = new THREE.Group();
    hip.position.set(0.115 * side, 1.0, 0);
    body.add(hip);
    const thigh = new THREE.Mesh(new THREE.CapsuleGeometry(0.093, 0.26, 4, 12), blueMat);
    thigh.position.y = -0.2;
    thigh.castShadow = true;
    hip.add(thigh);
    const knee = new THREE.Group();
    knee.position.y = -0.43;
    hip.add(knee);
    const shin = new THREE.Mesh(new THREE.CapsuleGeometry(0.073, 0.22, 4, 12), blueMat);
    shin.position.y = -0.17;
    shin.castShadow = true;
    knee.add(shin);
    const boot = new THREE.Mesh(new THREE.CylinderGeometry(0.077, 0.07, 0.18, 12), redPlain);
    boot.position.y = -0.31;
    knee.add(boot);
    const foot = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.1, 0.28), redPlain);
    foot.position.set(0, -0.405, 0.055);
    foot.castShadow = true;
    knee.add(foot);
    return { hip, knee };
  }
  const legL = makeLeg(-1);
  const legR = makeLeg(1);
  parts.hipL = legL.hip; parts.kneeL = legL.knee;
  parts.hipR = legR.hip; parts.kneeR = legR.knee;

  // web strand (hidden unless swinging)
  const strandMat = new THREE.MeshBasicMaterial({ color: 0xf2f4ff, transparent: true, opacity: 0.9, toneMapped: false });
  const strand = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 1, 5), strandMat);
  strand.visible = false;
  strand.frustumCulled = false;
  const strandGroup = new THREE.Group();
  strandGroup.name = 'webStrand';
  scene.add(strandGroup);
  strandGroup.add(strand);

  let baseY = 0;
  let landSquash = 0;
  let stride = 0;
  const phaseOffsets = { L: 0, R: Math.PI };

  const _v1 = new THREE.Vector3();
  const _v2 = new THREE.Vector3();

  function setStrand(anchor, side, camera) {
    if (!anchor) {
      strand.visible = false;
      strandGroup.visible = false;
      return;
    }
    const hand = side > 0 ? armR.hand : armL.hand;
    hand.updateWorldMatrix(true, false);
    hand.getWorldPosition(_v1);
    _v1.y += 0.03;
    _v2.copy(anchor);
    const dist = _v1.distanceTo(_v2);
    strandGroup.visible = true;
    strand.visible = true;
    strandGroup.position.copy(_v1);
    strandGroup.lookAt(_v2);
    strandGroup.rotateX(Math.PI / 2);
    strand.scale.set(1, dist, 1);
    strand.position.y = dist / 2;
  }

  function damp(current, target, lambda, dt) {
    return THREE.MathUtils.damp(current, target, lambda, dt);
  }

  function update(dt, state) {
    const { mode, speed = 0, vertical = 0, move = 0, turn = 0, time = 0, swingSide = 1, anchor = null } = state;
    stride += dt * (mode === 'ground' ? Math.max(2, speed * 0.9) : 2);
    landSquash = Math.max(0, landSquash - dt * 4.5);

    const L = 13;
    const joints = {
      torsoX: 0, torsoZ: 0,
      headX: 0, headY: 0,
      sxL: 0, szL: 0, exL: 0,
      sxR: 0, szR: 0, exR: 0,
      hxL: 0, hzL: 0, kxL: 0,
      hxR: 0, hzR: 0, kxR: 0,
    };
    let bob = 0;
    let bodyY = 0;

    if (mode === 'ground') {
      const run = Math.min(1, speed / 8);
      const s = Math.sin(stride);
      const c = Math.cos(stride);
      joints.hxL = s * 0.8 * run;
      joints.hxR = -s * 0.8 * run;
      joints.kxL = Math.max(0, -s) * 1.15 * run + 0.06;
      joints.kxR = Math.max(0, s) * 1.15 * run + 0.06;
      joints.sxL = -s * 0.7 * run - 0.12;
      joints.sxR = s * 0.7 * run - 0.12;
      joints.szL = -0.16;
      joints.szR = 0.16;
      joints.exL = -0.25 - Math.max(0, s) * 0.5;
      joints.exR = -0.25 - Math.max(0, -s) * 0.5;
      joints.torsoX = 0.09 + run * 0.12;
      joints.headX = -0.05;
      joints.hxL += 0.03; joints.hxR += 0.03;
      bob = Math.abs(Math.sin(stride)) * 0.045 * run;
      bodyY = -Math.abs(Math.sin(stride)) * 0.03 * run;
      if (speed < 0.3) {
        const breathe = Math.sin(time * 1.7) * 0.03;
        joints.szL = -0.19 + breathe;
        joints.szR = 0.19 - breathe;
        joints.sxL = -0.05; joints.sxR = -0.05;
        joints.exL = -0.18; joints.exR = -0.18;
        joints.headY = Math.sin(time * 0.6) * 0.1;
        joints.torsoX = 0.02;
      }
    } else if (mode === 'swing') {
      const fast = Math.min(1, speed / 34);
      joints.hxL = -1.15 - fast * 0.2;
      joints.hxR = -0.75;
      joints.kxL = 1.8;
      joints.kxR = 1.25;
      joints.hzL = -0.16;
      joints.hzR = 0.18;
      joints.sxL = 0.35;
      joints.sxR = 0.35;
      joints.exL = -0.35;
      joints.exR = -0.4;
      joints.szL = -0.35;
      joints.szR = 0.35;
      if (swingSide > 0) {
        joints.sxR = -2.65;
        joints.szR = 0.62;
        joints.exR = -0.12;
        joints.sxL = 0.85;
        joints.szL = -0.28;
      } else {
        joints.sxL = -2.65;
        joints.szL = -0.62;
        joints.exL = -0.12;
        joints.sxR = 0.85;
        joints.szR = 0.28;
      }
      joints.torsoX = 0.22 + fast * 0.36;
      joints.torsoZ = -turn * 0.2;
      joints.headX = -0.35;
      bodyY = 0.02;
    } else if (mode === 'dive') {
      joints.hxL = 0.3; joints.hxR = 0.3;
      joints.hzL = -0.13; joints.hzR = 0.13;
      joints.kxL = 0.12; joints.kxR = 0.12;
      joints.sxL = 1.15; joints.sxR = 1.15;
      joints.szL = -0.75; joints.szR = 0.75;
      joints.exL = -0.1; joints.exR = -0.1;
      joints.torsoX = 1.12;
      joints.headX = -0.62;
      bodyY = 0.15;
    } else {
      // airborne / falling
      const fall = Math.min(1, Math.max(0, -vertical) / 22);
      joints.hxL = -0.25 - fall * 0.25;
      joints.hxR = -0.1;
      joints.hzL = -0.2;
      joints.hzR = 0.16;
      joints.kxL = 0.5 + fall * 0.4;
      joints.kxR = 0.3 + fall * 0.3;
      joints.sxL = -0.1;
      joints.sxR = -0.1;
      joints.szL = -0.75 - fall * 0.25;
      joints.szR = 0.75 + fall * 0.25;
      joints.exL = -0.35;
      joints.exR = -0.35;
      joints.torsoX = 0.12 + fall * 0.2;
      joints.headX = -0.15;
      joints.torsoZ = -turn * 0.12;
      bodyY = 0.03;
    }

    const j = parts;
    j.torso.rotation.x = damp(j.torso.rotation.x, joints.torsoX, L, dt);
    j.torso.rotation.z = damp(j.torso.rotation.z, joints.torsoZ, L, dt);
    j.head.rotation.x = damp(j.head.rotation.x, joints.headX, L, dt);
    j.head.rotation.y = damp(j.head.rotation.y, joints.headY, L, dt);
    j.shoulderL.rotation.x = damp(j.shoulderL.rotation.x, joints.sxL, L, dt);
    j.shoulderL.rotation.z = damp(j.shoulderL.rotation.z, joints.szL, L, dt);
    j.shoulderR.rotation.x = damp(j.shoulderR.rotation.x, joints.sxR, L, dt);
    j.shoulderR.rotation.z = damp(j.shoulderR.rotation.z, joints.szR, L, dt);
    j.elbowL.rotation.x = damp(j.elbowL.rotation.x, joints.exL, L, dt);
    j.elbowR.rotation.x = damp(j.elbowR.rotation.x, joints.exR, L, dt);
    j.hipL.rotation.x = damp(j.hipL.rotation.x, joints.hxL, L, dt);
    j.hipL.rotation.z = damp(j.hipL.rotation.z, joints.hzL, L, dt);
    j.hipR.rotation.x = damp(j.hipR.rotation.x, joints.hxR, L, dt);
    j.hipR.rotation.z = damp(j.hipR.rotation.z, joints.hzR, L, dt);
    j.kneeL.rotation.x = damp(j.kneeL.rotation.x, joints.kxL, L, dt);
    j.kneeR.rotation.x = damp(j.kneeR.rotation.x, joints.kxR, L, dt);

    body.position.y = damp(body.position.y, bodyY + bob, 16, dt);
    body.rotation.x = damp(body.rotation.x, mode === 'dive' ? 0.92 : 0, 7, dt);
    // landing squash
    const squash = 1 - landSquash * 0.13;
    body.scale.set(1 + landSquash * 0.08, squash, 1 + landSquash * 0.08);
    body.rotation.z = damp(body.rotation.z, -turn * 0.08, 8, dt);

    if (anchor) setStrand(anchor, swingSide, state.camera);
    else {
      strand.visible = false;
      strandGroup.visible = false;
    }
  }

  const api = {
    root, parts, update,
    land(intensity = 1) { landSquash = Math.min(1, 0.4 + intensity * 0.5); },
    setStrand,
    dispose() {},
  };
  return api;
}
