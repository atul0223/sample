import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');
const colorScheme = matchMedia('(prefers-color-scheme: light)');
const pointer = { x: 0, y: 0 };

addEventListener('pointermove', (e) => {
  pointer.x = (e.clientX / innerWidth) * 2 - 1;
  pointer.y = (e.clientY / innerHeight) * 2 - 1;
}, { passive: true });

const token = (name) =>
  new THREE.Color(getComputedStyle(document.documentElement).getPropertyValue(name).trim());

function webglAvailable() {
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch {
    return false;
  }
}

function dotTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.4, 'rgba(255,255,255,.6)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}

function createStage(container, build) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  pmrem.dispose();

  const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100);
  const api = build(scene, camera);
  const clock = new THREE.Clock(false);
  let raf = 0;
  let visible = false;

  const render = (dt) => {
    api.update(dt, clock.elapsedTime);
    renderer.render(scene, camera);
  };
  const loop = () => {
    raf = requestAnimationFrame(loop);
    const dt = Math.min(clock.getDelta(), 0.05);
    render(dt);
  };
  const start = () => {
    if (raf || reduceMotion.matches) return;
    clock.start();
    loop();
  };
  const stop = () => {
    cancelAnimationFrame(raf);
    raf = 0;
    clock.stop();
  };
  const resize = () => {
    const w = container.clientWidth;
    const h = container.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    api.resize?.(w, h, camera);
    render(0);
  };

  new ResizeObserver(resize).observe(container);
  new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    visible ? start() : stop();
  }, { rootMargin: '100px' }).observe(container);
  reduceMotion.addEventListener('change', () => {
    stop();
    if (visible) start();
    render(0);
  });
  colorScheme.addEventListener('change', () => {
    api.recolor();
    render(0);
  });

  api.recolor();
  resize();
  container.classList.add('is-ready');
}

function addLights(scene) {
  const key = new THREE.DirectionalLight(0xffffff, 1.6);
  key.position.set(4, 6, 6);
  scene.add(key);
  const rim = new THREE.DirectionalLight(0xffffff, 1.2);
  rim.position.set(-6, 2, -4);
  scene.add(rim);
  return rim;
}

/* Hero: DNA double helix with floating cells and particles. */
function buildHelix(scene, camera) {
  camera.position.set(0, 0, 16);
  const rim = addLights(scene);
  const small = innerWidth < 700;

  const root = new THREE.Group();
  root.rotation.z = 0.42;
  scene.add(root);
  const helix = new THREE.Group();
  root.add(helix);

  const pairs = small ? 30 : 44;
  const height = 13;
  const radius = 2.1;
  const turns = 2.7;

  const beadGeo = new THREE.SphereGeometry(0.27, 28, 18);
  const matA = new THREE.MeshPhysicalMaterial({ roughness: 0.22, metalness: 0.05, clearcoat: 1, clearcoatRoughness: 0.12 });
  const matB = new THREE.MeshPhysicalMaterial({ roughness: 0.3, metalness: 0.05, clearcoat: 1, clearcoatRoughness: 0.2 });
  const strandA = new THREE.InstancedMesh(beadGeo, matA, pairs);
  const strandB = new THREE.InstancedMesh(beadGeo, matB, pairs);

  const rungGeo = new THREE.CylinderGeometry(0.055, 0.055, 1, 12);
  rungGeo.rotateZ(Math.PI / 2);
  const rungMat = new THREE.MeshPhysicalMaterial({ roughness: 0.4, transparent: true, opacity: 0.7 });
  const rungs = new THREE.InstancedMesh(rungGeo, rungMat, pairs);

  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const s = new THREE.Vector3();
  const p = new THREE.Vector3();
  const up = new THREE.Vector3(0, 1, 0);
  for (let i = 0; i < pairs; i++) {
    const t = i / (pairs - 1);
    const y = (t - 0.5) * height;
    const a = t * turns * Math.PI * 2;
    const x = Math.cos(a) * radius;
    const z = Math.sin(a) * radius;
    m.makeTranslation(x, y, z);
    strandA.setMatrixAt(i, m);
    m.makeTranslation(-x, y, -z);
    strandB.setMatrixAt(i, m);
    q.setFromAxisAngle(up, -a);
    s.set(radius * 2 - 0.4, 1, 1);
    p.set(0, y, 0);
    m.compose(p, q, s);
    rungs.setMatrixAt(i, m);
  }
  helix.add(strandA, strandB, rungs);

  // Translucent "cells" drifting around the helix.
  const cellMat = new THREE.MeshPhysicalMaterial({
    roughness: 0.05, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.05,
    transparent: true, opacity: 0.28, depthWrite: false, iridescence: 0.6, iridescenceIOR: 1.3,
  });
  const cells = [
    { r: 0.9, pos: [-3.6, 2.8, -1.5], speed: 0.6 },
    { r: 0.55, pos: [3.4, -3.2, 0.8], speed: 0.8 },
    { r: 0.38, pos: [2.8, 3.9, 1.6], speed: 1.1 },
    { r: 0.7, pos: [-2.9, -4.4, 0.4], speed: 0.7 },
  ].map((c, i) => {
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(c.r, 48, 32), cellMat);
    mesh.position.set(...c.pos);
    mesh.userData = { base: mesh.position.clone(), speed: c.speed, phase: i * 1.7 };
    scene.add(mesh);
    return mesh;
  });

  const count = small ? 160 : 320;
  const positions = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const r = 4 + Math.random() * 6;
    const th = Math.random() * Math.PI * 2;
    const ph = Math.acos(2 * Math.random() - 1);
    positions[i * 3] = r * Math.sin(ph) * Math.cos(th);
    positions[i * 3 + 1] = r * Math.cos(ph) * 1.3;
    positions[i * 3 + 2] = r * Math.sin(ph) * Math.sin(th) - 2;
  }
  const dustGeo = new THREE.BufferGeometry();
  dustGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const dustMat = new THREE.PointsMaterial({
    size: 0.09, map: dotTexture(), transparent: true, depthWrite: false, opacity: 0.7,
  });
  const dust = new THREE.Points(dustGeo, dustMat);
  scene.add(dust);

  const tilt = { x: 0, y: 0 };

  return {
    recolor() {
      const accent = token('--accent');
      matA.color.copy(accent);
      matB.color.copy(token('--strand-b'));
      rungMat.color.copy(token('--rung'));
      dustMat.color.copy(accent);
      cellMat.color.copy(accent).lerp(new THREE.Color(0xffffff), 0.55);
      rim.color.copy(accent);
    },
    resize(w, h) {
      // Keep the whole helix in frame on narrow, short stages.
      camera.position.z = w / h < 0.9 ? 25 : w / h > 1.4 ? 17 : 21;
    },
    update(dt, t) {
      helix.rotation.y += dt * 0.32;
      tilt.x += (pointer.y * 0.18 - tilt.x) * 0.04;
      tilt.y += (pointer.x * 0.3 - tilt.y) * 0.04;
      root.rotation.x = tilt.x;
      root.rotation.y = tilt.y;
      root.position.y = Math.sin(t * 0.6) * 0.15;
      dust.rotation.y = t * 0.03;
      for (const c of cells) {
        const { base, speed, phase } = c.userData;
        c.position.set(
          base.x + Math.sin(t * speed * 0.5 + phase) * 0.35,
          base.y + Math.sin(t * speed + phase) * 0.45,
          base.z + Math.cos(t * speed * 0.4 + phase) * 0.3,
        );
      }
    },
  };
}

/* Home collection: a glass sample vial with a capped top. */
function buildVial(scene, camera) {
  camera.position.set(0, 0.3, 10);
  const rim = addLights(scene);

  const root = new THREE.Group();
  root.rotation.z = -0.32;
  scene.add(root);
  const vial = new THREE.Group();
  root.add(vial);

  const r = 0.62;
  const h = 3.8;
  const bottom = -h / 2;

  const glassProfile = [];
  for (let i = 0; i <= 12; i++) {
    const a = (i / 12) * (Math.PI / 2);
    glassProfile.push(new THREE.Vector2(Math.sin(a) * r, bottom + r - Math.cos(a) * r));
  }
  glassProfile.push(new THREE.Vector2(r, h / 2));
  const glassMat = new THREE.MeshPhysicalMaterial({
    color: 0xffffff, roughness: 0.04, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.05,
    transparent: true, opacity: 0.22, side: THREE.DoubleSide, depthWrite: false,
  });
  const glass = new THREE.Mesh(new THREE.LatheGeometry(glassProfile, 72), glassMat);
  glass.renderOrder = 2;

  const fill = bottom + h * 0.56;
  const lr = r * 0.88;
  const liquidProfile = [];
  for (let i = 0; i <= 12; i++) {
    const a = (i / 12) * (Math.PI / 2);
    liquidProfile.push(new THREE.Vector2(Math.sin(a) * lr, bottom + 0.06 + lr - Math.cos(a) * lr));
  }
  liquidProfile.push(new THREE.Vector2(lr, fill), new THREE.Vector2(0, fill));
  const liquidMat = new THREE.MeshPhysicalMaterial({ roughness: 0.15, clearcoat: 1, transmission: 0.2, thickness: 0.8 });
  const liquid = new THREE.Mesh(new THREE.LatheGeometry(liquidProfile, 72), liquidMat);

  const capMat = new THREE.MeshPhysicalMaterial({ roughness: 0.35, clearcoat: 0.6 });
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(r * 1.14, r * 1.14, 0.95, 64), capMat);
  cap.position.y = h / 2 + 0.38;
  const capTop = new THREE.Mesh(new THREE.CylinderGeometry(r * 1.0, r * 1.14, 0.12, 64), capMat);
  capTop.position.y = h / 2 + 0.91;
  const ridges = new THREE.Group();
  for (let i = 0; i < 4; i++) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(r * 1.15, 0.025, 8, 64), capMat);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = h / 2 + 0.12 + i * 0.2;
    ridges.add(ring);
  }

  const labelMat = new THREE.MeshPhysicalMaterial({ roughness: 0.7, side: THREE.DoubleSide });
  const label = new THREE.Mesh(
    new THREE.CylinderGeometry(r * 1.01, r * 1.01, 1.25, 72, 1, true, -Math.PI * 0.75, Math.PI * 1.5),
    labelMat,
  );
  label.position.y = 0.35;
  const stripeMat = new THREE.MeshPhysicalMaterial({ roughness: 0.5, side: THREE.DoubleSide });
  const stripe = new THREE.Mesh(
    new THREE.CylinderGeometry(r * 1.015, r * 1.015, 0.16, 72, 1, true, -Math.PI * 0.75, Math.PI * 1.5),
    stripeMat,
  );
  stripe.position.y = 0.72;

  vial.add(liquid, label, stripe, cap, capTop, ridges, glass);

  // Orbiting particle ring around the vial.
  const count = 140;
  const pos = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2;
    const rr = 2.3 + Math.random() * 0.7;
    pos[i * 3] = Math.cos(a) * rr;
    pos[i * 3 + 1] = (Math.random() - 0.5) * 0.5;
    pos[i * 3 + 2] = Math.sin(a) * rr;
  }
  const orbitGeo = new THREE.BufferGeometry();
  orbitGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const orbitMat = new THREE.PointsMaterial({ size: 0.08, map: dotTexture(), transparent: true, depthWrite: false, opacity: 0.8 });
  const orbit = new THREE.Points(orbitGeo, orbitMat);
  orbit.rotation.x = 0.35;
  root.add(orbit);

  const tilt = { x: 0, y: 0 };

  return {
    recolor() {
      const accent = token('--accent');
      liquidMat.color.copy(accent);
      capMat.color.copy(token('--strand-b'));
      labelMat.color.copy(token('--label'));
      stripeMat.color.copy(accent);
      orbitMat.color.copy(accent);
      rim.color.copy(accent);
    },
    resize(w, h) {
      camera.position.z = w / h < 0.9 ? 12.5 : 10;
    },
    update(dt, t) {
      vial.rotation.y += dt * 0.45;
      orbit.rotation.y -= dt * 0.25;
      tilt.x += (pointer.y * 0.15 - tilt.x) * 0.04;
      tilt.y += (pointer.x * 0.25 - tilt.y) * 0.04;
      root.rotation.x = tilt.x;
      root.rotation.y = tilt.y;
      root.position.y = Math.sin(t * 0.9) * 0.14;
    },
  };
}

const builders = { helix: buildHelix, vial: buildVial };
const stages = document.querySelectorAll('[data-scene]');

if (!webglAvailable()) {
  stages.forEach((el) => el.classList.add('is-fallback'));
} else {
  stages.forEach((el) => {
    try {
      createStage(el, builders[el.dataset.scene]);
    } catch (err) {
      console.error('3D scene failed', err);
      el.classList.add('is-fallback');
    }
  });
}
