import * as THREE from 'three';

const PITCH = 64;
const BLOCK = 48;
const GRID = 7;
const HALF = (GRID * PITCH) / 2;
const ROAD = 16;
const ROAD_LINES = [];
// Roads run between blocks, so their centers sit at half-pitch offsets.
for (let i = -4; i < 4; i++) ROAD_LINES.push((i + 0.5) * PITCH);

function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function windowTextures() {
  const variants = [];
  const palette = [
    ['#2a3048', '#1b2034', ['#ffd59a', '#ffbc72', '#ffe9c4', '#9fdcff', '#ff9a7a']],
    ['#3b2a32', '#251b22', ['#ffc47c', '#ff9d5c', '#c4e8ff', '#ffe4a3', '#ff8f7a']],
    ['#1d3540', '#132631', ['#ffd89b', '#86dcff', '#ffb26b', '#eaffff', '#ff9a76']],
    ['#343044', '#211e2c', ['#ffbb66', '#ffd9a0', '#9adcff', '#ff8e70', '#fff2cc']],
  ];

  for (let v = 0; v < palette.length; v++) {
    const [base, side, lit] = palette[v];
    const rnd = mulberry32(101 + v * 37);
    const W = 256, H = 256;
    const c = document.createElement('canvas');
    c.width = W; c.height = H;
    const g = c.getContext('2d');
    const e = document.createElement('canvas');
    e.width = W; e.height = H;
    const ge = e.getContext('2d');

    const grad = g.createLinearGradient(0, 0, W, 0);
    grad.addColorStop(0, side);
    grad.addColorStop(0.5, base);
    grad.addColorStop(1, side);
    g.fillStyle = grad;
    g.fillRect(0, 0, W, H);
    ge.fillStyle = '#000';
    ge.fillRect(0, 0, W, H);

    // 3 windows across, 5 floors per texture tile
    const cols = 3, rows = 5;
    const cw = W / cols, ch = H / rows;
    for (let x = 0; x < cols; x++) {
      for (let y = 0; y < rows; y++) {
        const px = x * cw + cw * 0.2;
        const py = y * ch + ch * 0.22;
        const w = cw * 0.6;
        const h = ch * 0.5;
        const r = rnd();
        const on = r > 0.62;
        const color = lit[Math.floor(rnd() * lit.length)];
        if (on) {
          g.fillStyle = color;
          g.globalAlpha = 0.55 + rnd() * 0.3;
          g.fillRect(px, py, w, h);
          g.globalAlpha = 0.2;
          g.fillStyle = '#fff';
          g.fillRect(px, py, w, h * 0.18);
          ge.fillStyle = color;
          ge.globalAlpha = 0.38 + rnd() * 0.5;
          ge.fillRect(px, py, w, h);
        } else {
          g.fillStyle = 'rgba(7, 11, 24, 0.9)';
          g.fillRect(px, py, w, h);
          g.fillStyle = 'rgba(120, 150, 210, 0.08)';
          g.fillRect(px, py, w, h * 0.3);
        }
        g.globalAlpha = 1;
        // sill
        g.fillStyle = 'rgba(0,0,0,0.4)';
        g.fillRect(px - 2, py + h, w + 4, 2);
      }
    }
    // vertical mullions
    g.fillStyle = 'rgba(0,0,0,0.3)';
    for (let x = 1; x < cols; x++) g.fillRect(x * cw - 1, 0, 2, H);

    const map = new THREE.CanvasTexture(c);
    map.colorSpace = THREE.SRGBColorSpace;
    map.wrapS = map.wrapT = THREE.RepeatWrapping;
    map.anisotropy = 4;
    const emissiveMap = new THREE.CanvasTexture(e);
    emissiveMap.colorSpace = THREE.SRGBColorSpace;
    emissiveMap.wrapS = emissiveMap.wrapT = THREE.RepeatWrapping;
    emissiveMap.anisotropy = 4;
    variants.push({ map, emissiveMap });
  }
  return variants;
}
function makeBuildingGeometry(w, h, d) {
  const geo = new THREE.BoxGeometry(w, h, d);
  const uv = geo.attributes.uv;
  // Box face order: +x, -x, +y, -y, +z, -z (4 verts each)
  const uScale = [d, d, w, w, w, w];
  const vScale = [h, h, d, d, h, h];
  const unitU = 10;
  const unitV = 15;
  for (let i = 0; i < uv.count; i++) {
    const face = Math.floor(i / 4);
    uv.setXY(i, uv.getX(i) * uScale[face] / unitU, uv.getY(i) * vScale[face] / unitV);
  }
  uv.needsUpdate = true;
  return geo;
}

function signTexture(text, accent, bg = '#0c0a16') {
  const W = 512, H = 192;
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const g = c.getContext('2d');
  g.fillStyle = bg;
  g.fillRect(0, 0, W, H);
  g.strokeStyle = accent;
  g.lineWidth = 8;
  g.strokeRect(10, 10, W - 20, H - 20);
  g.fillStyle = accent;
  g.shadowColor = accent;
  g.shadowBlur = 26;
  g.font = '900 84px "Arial Black", Arial, sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  let size = 84;
  while (g.measureText(text).width > W - 70 && size > 30) {
    size -= 4;
    g.font = `900 ${size}px "Arial Black", Arial, sans-serif`;
  }
  g.fillText(text, W / 2, H / 2 + 4);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

export function createCity(scene, options = {}) {
  const rng = mulberry32(options.seed || 7331);
  const group = new THREE.Group();
  group.name = 'city';
  scene.add(group);

  const colliders = [];
  const buildings = [];
  const buildingMeshes = [];
  const tokenSpots = [];
  const animated = [];

  const textures = windowTextures();
  const facadeMats = textures.map((t, i) => new THREE.MeshStandardMaterial({
    map: t.map,
    emissiveMap: t.emissiveMap,
    emissive: new THREE.Color(i % 2 ? 0xffc07a : 0xffd6a0),
    emissiveIntensity: 1.15,
    color: new THREE.Color([0xffffff, 0xd8dcff, 0xffe2c8, 0xc8d4ff][i]),
    roughness: 0.72,
    metalness: 0.28,
  }));
  const roofMat = new THREE.MeshStandardMaterial({ color: 0x3a3650, roughness: 0.9, metalness: 0.14 });
  const trimMat = new THREE.MeshStandardMaterial({ color: 0x252436, roughness: 0.8, metalness: 0.3 });
  const concreteMat = new THREE.MeshStandardMaterial({ color: 0x4c465c, roughness: 0.92, metalness: 0.05 });
  const asphaltMat = new THREE.MeshStandardMaterial({ color: 0x181822, roughness: 0.96, metalness: 0.02 });
  const curbMat = new THREE.MeshStandardMaterial({ color: 0x565064, roughness: 0.85 });
  const grassMat = new THREE.MeshStandardMaterial({ color: 0x1e4a34, roughness: 1 });
  const waterMat = new THREE.MeshStandardMaterial({
    color: 0x16334d, roughness: 0.15, metalness: 0.65,
    emissive: 0x0e2030, emissiveIntensity: 0.5,
  });
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x2c1d18, roughness: 1 });
  const leafMat = new THREE.MeshStandardMaterial({ color: 0x23523a, roughness: 1 });

  /* ---------- ground ---------- */
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(1500, 1500), asphaltMat);
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.02;
  ground.receiveShadow = true;
  group.add(ground);

  // road lane dashes
  const dashGeo = new THREE.PlaneGeometry(0.34, 2.8);
  dashGeo.rotateX(-Math.PI / 2);
  const dashMat = new THREE.MeshBasicMaterial({ color: 0xd8cfa8, transparent: true, opacity: 0.55 });
  const dashPositions = [];
  for (const r of ROAD_LINES) {
    for (let t = -HALF - 8; t <= HALF + 8; t += 9) {
      dashPositions.push([r, t, 0]);
      dashPositions.push([t, r, Math.PI / 2]);
    }
  }
  const dashes = new THREE.InstancedMesh(dashGeo, dashMat, dashPositions.length);
  const dummy = new THREE.Object3D();
  dashPositions.forEach(([x, z, rot], i) => {
    dummy.position.set(x, 0.022, z);
    dummy.rotation.set(0, rot, 0);
    dummy.updateMatrix();
    dashes.setMatrixAt(i, dummy.matrix);
  });
  dashes.instanceMatrix.needsUpdate = true;
  group.add(dashes);

  // crosswalk blocks at intersections
  const crossGeo = new THREE.PlaneGeometry(ROAD - 2, 2.2);
  crossGeo.rotateX(-Math.PI / 2);
  const crossMat = new THREE.MeshBasicMaterial({ color: 0xcfc7ad, transparent: true, opacity: 0.35 });
  const crossings = new THREE.InstancedMesh(crossGeo, crossMat, ROAD_LINES.length * ROAD_LINES.length * 2);
  let ci = 0;
  for (const rx of ROAD_LINES) {
    for (const rz of ROAD_LINES) {
      dummy.position.set(rx, 0.024, rz + ROAD / 2 + 1.2);
      dummy.rotation.set(0, 0, 0);
      dummy.updateMatrix();
      crossings.setMatrixAt(ci++, dummy.matrix);
      dummy.rotation.set(0, Math.PI / 2, 0);
      dummy.position.set(rx + ROAD / 2 + 1.2, 0.024, rz);
      dummy.updateMatrix();
      crossings.setMatrixAt(ci++, dummy.matrix);
    }
  }
  crossings.instanceMatrix.needsUpdate = true;
  group.add(crossings);

  /* ---------- street props ---------- */
  const lampPoleGeo = new THREE.CylinderGeometry(0.09, 0.13, 7.2, 6);
  const lampPoleMat = new THREE.MeshStandardMaterial({ color: 0x2b2b38, roughness: 0.55, metalness: 0.7 });
  const lampBulbGeo = new THREE.SphereGeometry(0.26, 8, 6);
  const lampBulbMat = new THREE.MeshBasicMaterial({ color: 0xffd18a });
  const lampSpots = [];
  for (const r of ROAD_LINES) {
    for (let t = -HALF + 12; t <= HALF - 12; t += 32) {
      lampSpots.push([r + (r >= 0 ? -1 : 1) * (ROAD / 2 + 1.1), t]);
      lampSpots.push([t, r + (r >= 0 ? 1 : -1) * (ROAD / 2 + 1.1)]);
    }
  }
  const lampPoles = new THREE.InstancedMesh(lampPoleGeo, lampPoleMat, lampSpots.length);
  const lampBulbs = new THREE.InstancedMesh(lampBulbGeo, lampBulbMat, lampSpots.length);
  lampSpots.forEach(([x, z], i) => {
    dummy.position.set(x, 3.6, z);
    dummy.rotation.set(0, 0, 0);
    dummy.scale.set(1, 1, 1);
    dummy.updateMatrix();
    lampPoles.setMatrixAt(i, dummy.matrix);
    dummy.position.set(x, 7.3, z);
    dummy.updateMatrix();
    lampBulbs.setMatrixAt(i, dummy.matrix);
  });
  lampPoles.castShadow = true;
  group.add(lampPoles, lampBulbs);

  /* ---------- blocks ---------- */
  const blockRnd = mulberry32((options.seed || 7331) + 99);
  const landmarkSpots = [];
  const roofProps = [];

  for (let gx = -3; gx <= 3; gx++) {
    for (let gz = -3; gz <= 3; gz++) {
      const cx = gx * PITCH;
      const cz = gz * PITCH;
      const isPark = gx === 0 && gz === 0;

      // sidewalk plinth
      const plinth = new THREE.Mesh(new THREE.BoxGeometry(BLOCK + 1.5, 0.45, BLOCK + 1.5), concreteMat);
      plinth.position.set(cx, 0.2, cz);
      plinth.receiveShadow = true;
      group.add(plinth);
      const curb = new THREE.Mesh(new THREE.BoxGeometry(BLOCK + 2.4, 0.16, BLOCK + 2.4), curbMat);
      curb.position.set(cx, 0.1, cz);
      group.add(curb);

      if (isPark) {
        const lawn = new THREE.Mesh(new THREE.PlaneGeometry(BLOCK - 2, BLOCK - 2), grassMat);
        lawn.rotation.x = -Math.PI / 2;
        lawn.position.set(cx, 0.44, cz);
        lawn.receiveShadow = true;
        group.add(lawn);

        const pond = new THREE.Mesh(new THREE.CircleGeometry(9.5, 32), waterMat);
        pond.rotation.x = -Math.PI / 2;
        pond.position.set(cx + 7, 0.46, cz - 6);
        group.add(pond);
        const pondRim = new THREE.Mesh(new THREE.TorusGeometry(9.7, 0.35, 6, 40), curbMat);
        pondRim.rotation.x = Math.PI / 2;
        pondRim.position.set(cx + 7, 0.47, cz - 6);
        group.add(pondRim);

        // paths
        const pathMat = new THREE.MeshStandardMaterial({ color: 0x6b6256, roughness: 0.95 });
        const path1 = new THREE.Mesh(new THREE.PlaneGeometry(BLOCK - 2, 3.4), pathMat);
        path1.rotation.x = -Math.PI / 2;
        path1.position.set(cx, 0.455, cz);
        group.add(path1);
        const path2 = new THREE.Mesh(new THREE.PlaneGeometry(3.4, BLOCK - 2), pathMat);
        path2.rotation.x = -Math.PI / 2;
        path2.position.set(cx, 0.456, cz);
        group.add(path2);

        // trees in the park
        for (let t = 0; t < 16; t++) {
          const tx = cx + (blockRnd() - 0.5) * (BLOCK - 9);
          const tz = cz + (blockRnd() - 0.5) * (BLOCK - 9);
          if (Math.hypot(tx - (cx + 7), tz - (cz - 6)) < 12) continue;
          addTree(tx, tz, 0.75 + blockRnd() * 0.7);
        }
        addTree(cx - 15, cz + 14, 1.1);
        addTree(cx + 16, cz + 13, 1.0);
      } else {
        const layouts = blockRnd();
        let lots;
        if (layouts < 0.42) {
          lots = [[0, 0, BLOCK - 6, BLOCK - 6]];
        } else if (layouts < 0.78) {
          if (blockRnd() > 0.5) {
            lots = [[-BLOCK / 4, 0, BLOCK / 2 - 4, BLOCK - 6], [BLOCK / 4, 0, BLOCK / 2 - 4, BLOCK - 6]];
          } else {
            lots = [[0, -BLOCK / 4, BLOCK - 6, BLOCK / 2 - 4], [0, BLOCK / 4, BLOCK - 6, BLOCK / 2 - 4]];
          }
        } else {
          lots = [
            [-BLOCK / 4, -BLOCK / 4, BLOCK / 2 - 4, BLOCK / 2 - 4],
            [BLOCK / 4, -BLOCK / 4, BLOCK / 2 - 4, BLOCK / 2 - 4],
            [-BLOCK / 4, BLOCK / 4, BLOCK / 2 - 4, BLOCK / 2 - 4],
            [BLOCK / 4, BLOCK / 4, BLOCK / 2 - 4, BLOCK / 2 - 4],
          ];
        }

        for (const [ox, oz, lw, ld] of lots) {
          const w = lw * (0.72 + blockRnd() * 0.24);
          const d = ld * (0.72 + blockRnd() * 0.24);
          const bx = cx + ox;
          const bz = cz + oz;
          const dist = Math.hypot(bx, bz);
          const downtown = Math.max(0.24, 1 - dist / 440);
          let h = 16 + Math.pow(blockRnd(), 2.2) * 96 * downtown + blockRnd() * 22;
          if (blockRnd() < 0.035) h = 115 + blockRnd() * 30;
          h = Math.round(h);
          addBuilding(bx, bz, w, d, h, blockRnd);
        }

        // sidewalk trees
        if (blockRnd() > 0.35) {
          const side = Math.floor(blockRnd() * 4);
          const tx = cx + (side < 2 ? (blockRnd() - 0.5) * (BLOCK - 6) : (side === 2 ? -BLOCK / 2 + 1.5 : BLOCK / 2 - 1.5));
          const tz = cz + (side >= 2 ? (blockRnd() - 0.5) * (BLOCK - 6) : (side === 0 ? -BLOCK / 2 + 1.5 : BLOCK / 2 - 1.5));
          addTree(tx, tz, 0.55 + blockRnd() * 0.4);
        }
      }
    }
  }

  function addTree(x, z, s) {
    const g = new THREE.Group();
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.16 * s, 0.24 * s, 2.4 * s, 5), trunkMat);
    trunk.position.y = 1.2 * s;
    trunk.castShadow = true;
    const crown = new THREE.Mesh(new THREE.IcosahedronGeometry(1.55 * s, 0), leafMat);
    crown.position.y = 3.1 * s;
    crown.scale.y = 1.15;
    crown.castShadow = true;
    g.add(trunk, crown);
    g.position.set(x, 0.42, z);
    g.rotation.y = blockRnd() * Math.PI;
    group.add(g);
  }

  function addBuilding(x, z, w, d, h, rand) {
    const mat = facadeMats[Math.floor(rand() * facadeMats.length)];
    const geo = makeBuildingGeometry(w, h, d);
    const mesh = new THREE.Mesh(geo, [mat, mat, roofMat, roofMat, mat, mat]);
    mesh.position.set(x, h / 2 + 0.42, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
    buildingMeshes.push(mesh);
    const entry = { x, z, w, d, h: h + 0.42, top: h + 0.42 };
    buildings.push(entry);
    colliders.push(new THREE.Box3(
      new THREE.Vector3(x - w / 2, 0.42, z - d / 2),
      new THREE.Vector3(x + w / 2, h + 0.42, z + d / 2)
    ));

    // roof parapet (a hollow ring, so the roof deck stays visible)
    const outerW = w / 2 + 0.22, outerD = d / 2 + 0.22;
    const innerW = Math.max(0.5, w / 2 - 0.35), innerD = Math.max(0.5, d / 2 - 0.35);
    const rimShape = new THREE.Shape();
    rimShape.moveTo(-outerW, -outerD);
    rimShape.lineTo(outerW, -outerD);
    rimShape.lineTo(outerW, outerD);
    rimShape.lineTo(-outerW, outerD);
    rimShape.closePath();
    const rimHole = new THREE.Path();
    rimHole.moveTo(-innerW, -innerD);
    rimHole.lineTo(-innerW, innerD);
    rimHole.lineTo(innerW, innerD);
    rimHole.lineTo(innerW, -innerD);
    rimHole.closePath();
    rimShape.holes.push(rimHole);
    const rimGeo = new THREE.ExtrudeGeometry(rimShape, { depth: 0.62, bevelEnabled: false, curveSegments: 1 });
    rimGeo.rotateX(-Math.PI / 2);
    const parapet = new THREE.Mesh(rimGeo, trimMat);
    parapet.position.set(x, h + 0.42, z);
    group.add(parapet);

    // setback tower
    if (h > 48 && rand() < 0.62) {
      const w2 = w * (0.5 + rand() * 0.22);
      const d2 = d * (0.5 + rand() * 0.22);
      const h2 = 10 + rand() * 30;
      const tx = x + (rand() - 0.5) * (w - w2) * 0.6;
      const tz = z + (rand() - 0.5) * (d - d2) * 0.6;
      const base = h + 0.85;
      const top = base + h2;
      const geo2 = makeBuildingGeometry(w2, h2, d2);
      const m2 = new THREE.Mesh(geo2, [mat, mat, roofMat, roofMat, mat, mat]);
      m2.position.set(tx, base + h2 / 2, tz);
      m2.castShadow = true;
      m2.receiveShadow = true;
      group.add(m2);
      buildingMeshes.push(m2);
      colliders.push(new THREE.Box3(
        new THREE.Vector3(tx - w2 / 2, base, tz - d2 / 2),
        new THREE.Vector3(tx + w2 / 2, top, tz + d2 / 2)
      ));
      entry.hasTower = true;
      buildings.push({ x: tx, z: tz, w: w2, d: d2, h: top, top });
    }

    // rooftop gear
    const rr = rand();
    if (h > 65 && rr < 0.55) {
      const mastH = 6 + rand() * 9;
      const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.2, mastH, 5), trimMat);
      mast.position.set(x + (rand() - 0.5) * w * 0.4, h + 0.9 + mastH / 2, z + (rand() - 0.5) * d * 0.4);
      group.add(mast);
      const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.32, 8, 6), new THREE.MeshBasicMaterial({ color: 0xff2b3d }));
      beacon.position.set(mast.position.x, h + 1 + mastH, mast.position.z);
      group.add(beacon);
      animated.push({ type: 'blink', mesh: beacon, phase: rand() * Math.PI * 2 });
    } else if (rr < 0.8) {
      const tank = new THREE.Group();
      const body = new THREE.Mesh(new THREE.CylinderGeometry(1.7, 1.7, 3.2, 8), new THREE.MeshStandardMaterial({ color: 0x3a2e2a, roughness: 0.9 }));
      body.position.y = 2.8;
      const cap = new THREE.Mesh(new THREE.ConeGeometry(1.9, 1.1, 8), trimMat);
      cap.position.y = 4.9;
      tank.add(body, cap);
      for (let i = 0; i < 4; i++) {
        const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 2.2, 4), trimMat);
        leg.position.set(Math.cos(i * Math.PI / 2 + 0.6) * 1.2, 1.1, Math.sin(i * Math.PI / 2 + 0.6) * 1.2);
        tank.add(leg);
      }
      tank.position.set(x + (rand() - 0.5) * w * 0.4, h + 0.7, z + (rand() - 0.5) * d * 0.4);
      tank.castShadow = true;
      group.add(tank);
    }

    // rooftop clutter (batched into instanced boxes at the end)
    const propCount = 1 + Math.floor(rand() * 3);
    for (let i = 0; i < propCount; i++) {
      const pw = 1.2 + rand() * 2.6;
      const ph = 0.7 + rand() * 1.5;
      const pd = 1.2 + rand() * 2.6;
      roofProps.push({
        x: x + (rand() - 0.5) * Math.max(1, w - pw - 2),
        y: h + 0.44 + ph / 2,
        z: z + (rand() - 0.5) * Math.max(1, d - pd - 2),
        w: pw, h: ph, d: pd,
        rot: (rand() - 0.5) * 0.5,
      });
    }

    if (h > 92) landmarkSpots.push({ x, z, h, w, d });
  }

  // one instanced mesh for all the rooftop machinery
  {
    const propGeo = new THREE.BoxGeometry(1, 1, 1);
    const propMat = new THREE.MeshStandardMaterial({ color: 0x4a4558, roughness: 0.82, metalness: 0.35 });
    const props = new THREE.InstancedMesh(propGeo, propMat, roofProps.length);
    roofProps.forEach((p, i) => {
      dummy.position.set(p.x, p.y, p.z);
      dummy.rotation.set(0, p.rot, 0);
      dummy.scale.set(p.w, p.h, p.d);
      dummy.updateMatrix();
      props.setMatrixAt(i, dummy.matrix);
    });
    props.instanceMatrix.needsUpdate = true;
    props.castShadow = true;
    props.receiveShadow = true;
    group.add(props);
  }

  // a helipad crowns the tallest walkable roof
  {
    let pad = null;
    for (const b of buildings) {
      if (b.hasTower || b.w < 20 || b.d < 20) continue;
      if (!pad || b.top > pad.top) pad = b;
    }
    if (pad) {
      const r = Math.min(9, Math.min(pad.w, pad.d) * 0.34);
      const disk = new THREE.Mesh(
        new THREE.CylinderGeometry(r, r, 0.16, 36),
        new THREE.MeshStandardMaterial({ color: 0x252333, roughness: 0.9, metalness: 0.3 })
      );
      disk.position.set(pad.x, pad.top + 0.1, pad.z);
      disk.receiveShadow = true;
      group.add(disk);
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(r * 0.7, 0.075, 5, 44),
        new THREE.MeshBasicMaterial({ color: 0xbfe6ff, toneMapped: false })
      );
      ring.rotation.x = Math.PI / 2;
      ring.position.set(pad.x, pad.top + 0.2, pad.z);
      group.add(ring);
      const hMat = new THREE.MeshBasicMaterial({ color: 0xf5f1e4, toneMapped: false });
      for (const s of [-1, 1]) {
        const bar = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.03, r * 0.7), hMat);
        bar.position.set(pad.x + s * r * 0.22, pad.top + 0.21, pad.z);
        group.add(bar);
      }
      const cross = new THREE.Mesh(new THREE.BoxGeometry(r * 0.5, 0.03, 0.34), hMat);
      cross.position.set(pad.x, pad.top + 0.21, pad.z);
      group.add(cross);
      const padLightMat = new THREE.MeshBasicMaterial({ color: 0x8fffcf, toneMapped: false });
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        const pl = new THREE.Mesh(new THREE.SphereGeometry(0.24, 6, 5), padLightMat);
        pl.position.set(pad.x + Math.cos(a) * r * 0.9, pad.top + 0.24, pad.z + Math.sin(a) * r * 0.9);
        group.add(pl);
      }
    }
  }

  // soft glow points on every street lamp
  {
    const gc = document.createElement('canvas');
    gc.width = gc.height = 64;
    const gg = gc.getContext('2d');
    const grd = gg.createRadialGradient(32, 32, 0, 32, 32, 32);
    grd.addColorStop(0, 'rgba(255,244,205,1)');
    grd.addColorStop(0.3, 'rgba(255,196,120,0.75)');
    grd.addColorStop(1, 'rgba(255,150,80,0)');
    gg.fillStyle = grd;
    gg.fillRect(0, 0, 64, 64);
    const gtex = new THREE.CanvasTexture(gc);
    gtex.colorSpace = THREE.SRGBColorSpace;
    const pos = new Float32Array(lampSpots.length * 3);
    lampSpots.forEach(([x, z], i) => {
      pos[i * 3] = x;
      pos[i * 3 + 1] = 7.3;
      pos[i * 3 + 2] = z;
    });
    const pgeo = new THREE.BufferGeometry();
    pgeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const glow = new THREE.Points(pgeo, new THREE.PointsMaterial({
      map: gtex, color: 0xffcf8f, size: 3.4, transparent: true, opacity: 0.85,
      blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true, toneMapped: false,
    }));
    group.add(glow);
  }

  /* ---------- billboards ---------- */
  const signs = [
    ['DAILY BUGLE', '#ff4b5c', '#100914'],
    ['OSCORP', '#6df0ff', '#081418'],
    ['WEB RUSH', '#ffd166', '#150d09'],
    ['NEW YORK', '#ff8ad8', '#120a18'],
    ['ALCHEMAX', '#9d8bff', '#0a0918'],
    ['PARKER IND.', '#6ff0a8', '#08140f'],
  ];
  const topBuildings = [...buildings].sort((a, b) => b.h - a.h).slice(0, 14);
  for (let i = 0; i < Math.min(signs.length, topBuildings.length); i++) {
    const b = topBuildings[i + 1] || topBuildings[i];
    const [text, accent, bg] = signs[i];
    const tex = signTexture(text, accent, bg);
    const sw = Math.min(b.w * 0.72, 18);
    const sh = sw * 0.375;
    const mat = new THREE.MeshBasicMaterial({ map: tex, toneMapped: false });
    const plane = new THREE.Mesh(new THREE.PlaneGeometry(sw, sh), mat);
    const angle = (i * 1.7) % (Math.PI * 2);
    const fx = Math.cos(angle), fz = Math.sin(angle);
    plane.position.set(
      b.x + fx * (b.w / 2 + 0.28),
      b.top * 0.7,
      b.z + fz * (b.d / 2 + 0.28)
    );
    plane.rotation.y = Math.atan2(fx, fz);
    group.add(plane);
  }

  /* ---------- cars ---------- */
  const carColors = [0xd8352f, 0x2f6fd8, 0xe0b13c, 0xdedae6, 0x2c2c38, 0x6a3fb0, 0x2f9e7a];
  const carBodyGeo = new THREE.BoxGeometry(1.65, 0.5, 3.5);
  const carCabGeo = new THREE.BoxGeometry(1.42, 0.46, 1.75);
  const lightGeo = new THREE.BoxGeometry(0.32, 0.16, 0.08);
  const headMat = new THREE.MeshBasicMaterial({ color: 0xfff2c4, toneMapped: false });
  const tailMat = new THREE.MeshBasicMaterial({ color: 0xff3b2f, toneMapped: false });
  const wheelMat = new THREE.MeshStandardMaterial({ color: 0x0b0b10, roughness: 0.85 });
  const wheelGeo = new THREE.BoxGeometry(1.72, 0.26, 0.62);
  const cars = [];
  const carRnd = mulberry32((options.seed || 7331) + 555);
  for (let i = 0; i < 30; i++) {
    const car = new THREE.Group();
    const bodyMat = new THREE.MeshStandardMaterial({ color: carColors[Math.floor(carRnd() * carColors.length)], roughness: 0.35, metalness: 0.55 });
    const body = new THREE.Mesh(carBodyGeo, bodyMat);
    body.position.y = 0.55;
    body.castShadow = true;
    const cab = new THREE.Mesh(carCabGeo, new THREE.MeshStandardMaterial({ color: 0x111522, roughness: 0.25, metalness: 0.7 }));
    cab.position.y = 0.98;
    car.add(body, cab);
    for (const zz of [-1.25, 1.25]) {
      const w = new THREE.Mesh(wheelGeo, wheelMat);
      w.position.set(0, 0.18, zz);
      car.add(w);
    }
    for (const xx of [-0.52, 0.52]) {
      const hl = new THREE.Mesh(lightGeo, headMat);
      hl.position.set(xx, 0.62, -1.77);
      const tl = new THREE.Mesh(lightGeo, tailMat);
      tl.position.set(xx, 0.62, 1.77);
      car.add(hl, tl);
    }
    car.position.y = 0.02;
    const axis = carRnd() > 0.5 ? 'x' : 'z';
    const road = ROAD_LINES[Math.floor(carRnd() * ROAD_LINES.length)];
    const dir = carRnd() > 0.5 ? 1 : -1;
    const lane = dir > 0 ? 3.4 : -3.4;
    car.userData = {
      axis, road, dir, lane,
      speed: 9 + carRnd() * 11,
      pos: -HALF - carRnd() * 40,
    };
    if (axis === 'z') {
      car.position.set(road + lane, 0.02, car.userData.pos);
      car.rotation.y = dir > 0 ? Math.PI : 0;
    } else {
      car.position.set(car.userData.pos, 0.02, road + lane);
      car.rotation.y = dir > 0 ? -Math.PI / 2 : Math.PI / 2;
    }
    group.add(car);
    cars.push(car);
  }

  /* ---------- distant skyline ---------- */
  const skyMat = new THREE.MeshBasicMaterial({ color: 0x241b3c, fog: true });
  const skyMat2 = new THREE.MeshBasicMaterial({ color: 0x2f2248, fog: true });
  const rnd2 = mulberry32(4242);
  for (let i = 0; i < 90; i++) {
    const a = (i / 90) * Math.PI * 2 + rnd2() * 0.05;
    const r = 320 + rnd2() * 210;
    const w = 14 + rnd2() * 34;
    const d = 14 + rnd2() * 34;
    const h = 24 + Math.pow(rnd2(), 1.5) * 150;
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), rnd2() > 0.5 ? skyMat : skyMat2);
    m.position.set(Math.cos(a) * r, h / 2 - 2, Math.sin(a) * r);
    m.rotation.y = rnd2() * Math.PI;
    group.add(m);
  }

  // spawn on a mid-height rooftop near the park, looking at downtown
  let spawn = { position: new THREE.Vector3(0, 0.5, 90), yaw: Math.PI };
  let spawnBuilding = null;
  for (const b of buildings) {
    if (b.hasTower) continue;
    if (b.x > 20 && b.x < 140 && b.z > 20 && b.z < 140 && b.top > 34 && (!spawnBuilding || b.top > spawnBuilding.top)) spawnBuilding = b;
  }
  if (spawnBuilding) {
    // stand near the roof edge that faces downtown, so the first swing clears the roof
    const toCenter = new THREE.Vector2(-spawnBuilding.x, -spawnBuilding.z).normalize();
    const sx = spawnBuilding.x + toCenter.x * Math.max(0, spawnBuilding.w / 2 - 2.4);
    const sz = spawnBuilding.z + toCenter.y * Math.max(0, spawnBuilding.d / 2 - 2.4);
    spawn = {
      position: new THREE.Vector3(sx, spawnBuilding.top + 0.03, sz),
      yaw: Math.atan2(-sx, -sz),
      building: spawnBuilding,
    };
  }


  /* ---------- token spots ---------- */
  const spotRnd = mulberry32((options.seed || 7331) + 777);
  const roofCandidates = buildings.filter(b => !b.hasTower && b.top > 26 && Math.hypot(b.x, b.z) < HALF - 10 && !(Math.abs(b.x) < 32 && Math.abs(b.z) < 32) && Math.hypot(b.x - spawn.position.x, b.z - spawn.position.z) > 46);
  const picked = [];
  const targetAngles = [0, 1.05, 2.1, 3.14, 4.19, 5.24, 0.52, 1.57, 2.62, 3.67, 4.71, 5.76];
  for (let i = 0; i < 12; i++) {
    const angle = targetAngles[i] + (spotRnd() - 0.5) * 0.3;
    const radius = 55 + (i % 4) * 45 + spotRnd() * 24;
    const wantX = Math.cos(angle) * radius;
    const wantZ = Math.sin(angle) * radius;
    let best = null, bestD = Infinity;
    for (const b of roofCandidates) {
      if (picked.includes(b)) continue;
      const d = (b.x - wantX) ** 2 + (b.z - wantZ) ** 2;
      if (d < bestD) { bestD = d; best = b; }
    }
    if (best && (i % 4 !== 2 || !picked.includes(best))) {
      picked.push(best);
      tokenSpots.push(new THREE.Vector3(best.x + (spotRnd() - 0.5) * best.w * 0.3, best.top + 4.6, best.z + (spotRnd() - 0.5) * best.d * 0.3));
    } else {
      const away = new THREE.Vector2(wantX - spawn.position.x, wantZ - spawn.position.z);
      if (away.length() < 46) away.setLength(46);
      tokenSpots.push(new THREE.Vector3(spawn.position.x + away.x, 30 + spotRnd() * 24, spawn.position.z + away.y));
    }
  }
  // Guarantee 12 unique positions, and never leave a token buried inside a tower.
  while (tokenSpots.length < 12) {
    const a = spotRnd() * Math.PI * 2;
    tokenSpots.push(new THREE.Vector3(spawn.position.x + Math.cos(a) * 90, 30 + spotRnd() * 30, spawn.position.z + Math.sin(a) * 90));
  }
  for (const spot of tokenSpots) {
    for (const box of colliders) {
      if (spot.x > box.min.x - 1.5 && spot.x < box.max.x + 1.5 && spot.z > box.min.z - 1.5 && spot.z < box.max.z + 1.5 && spot.y < box.max.y + 3) {
        spot.y = box.max.y + 4.6;
      }
    }
  }

  function update(dt, elapsed) {
    for (const car of cars) {
      const u = car.userData;
      u.pos += u.speed * u.dir * dt;
      if (u.pos > HALF + 30) u.pos = -HALF - 30;
      if (u.pos < -HALF - 30) u.pos = HALF + 30;
      if (u.axis === 'z') car.position.z = u.pos;
      else car.position.x = u.pos;
    }
    for (const a of animated) {
      if (a.type === 'blink') {
        const v = (Math.sin(elapsed * 2.4 + a.phase) + 1) * 0.5;
        a.mesh.material.opacity = 0.25 + v * 0.75;
        a.mesh.material.transparent = true;
      }
    }
  }

  function groundHeightAt(x, z) {
    const gx = Math.round(x / PITCH) * PITCH;
    const gz = Math.round(z / PITCH) * PITCH;
    const half = (BLOCK + 2.4) / 2;
    if (Math.abs(x - gx) <= half && Math.abs(z - gz) <= half) return 0.42;
    return 0;
  }

  return {
    group, colliders, buildingMeshes, buildings, tokenSpots, spawn, update, groundHeightAt,
    bounds: { min: -HALF, max: HALF, size: HALF * 2 },
    groundY: 0.42,
    center: new THREE.Vector3(0, 0, 0),
  };
}
