import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import GUI from 'lil-gui';

// ============================================================================
//  EDITABLE PARAMETERS — tweak these values (or use the GUI panel) and the
//  rocket rebuilds live. Units: 1 unit = 100px of the reference image.
// ============================================================================
const PARAMS = {
  colors: {
    body:        '#1e4466',  // dark blue hull
    nose:        '#94c5b9',  // light blue/teal nose cone
    fin:         '#94c5b9',  // light blue fins
    windowRing:  '#1ead97',  // teal ring around the window
    window:      '#ffffff',  // white window
    flameRed:    '#e7422e',  // exhaust: red at the top (nozzle)
    flameOrange: '#f7901e',  // exhaust: orange
    flameYellow: '#fad214',  // exhaust: yellow
    flameTip:    '#f2f3f1',  // exhaust: pale tip
  },
  shape: {
    bodyRadius:   0.815,  // hull radius at its widest
    halfHeight:   2.60,   // tip of nose (y=+) to tip of flame (y=-)
    noseLength:   0.86,   // teal nose cone length measured from the tip
    finCount:     3,      // fins are evenly spaced around the body
    finSpan:      1.29,   // fin tip distance from the center axis
    finThickness: 0.09,
    windowY:      1.14,   // window center height
    windowRadius: 0.30,
    ringWidth:    0.055,
    flameLength:  1.37,   // exhaust flame length below the hull
    flameRadius:  0.44,
    flameWobble:  0.16,   // scalloped edge of the flame
  },
  showFlame: true,
  showGrid:  false,
};

// ---------------------------------------------------------------------------
// Renderer / scene / camera
// ---------------------------------------------------------------------------
const qs = new URLSearchParams(location.search);
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setClearColor(0x000000, 0);
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(26, window.innerWidth / window.innerHeight, 0.1, 100);
function frameCamera() {
  // front view, slightly above, framed like the reference image
  camera.position.set(0, 0.55, 11.6);
  camera.lookAt(0, -0.05, 0);
}
frameCamera();

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.target.set(0, -0.05, 0);

scene.add(new THREE.HemisphereLight(0xffffff, 0x8fa8c8, 0.55));
const key = new THREE.DirectionalLight(0xffffff, 0.5);
key.position.set(3, 5, 6);
scene.add(key);
const fill = new THREE.DirectionalLight(0xbfd4ff, 0.2);
fill.position.set(-4, -2, 4);
scene.add(fill);

// ---------------------------------------------------------------------------
// Rocket construction
// ---------------------------------------------------------------------------
// Hull profile as [radius / bodyRadius, y / halfHeight], measured from the
// reference image (nose tip = y+1, hull base = y-0.473).
const HULL_PROFILE = [
  [0.000, 1.000], [0.074, 0.977], [0.245, 0.938], [0.380, 0.892],
  [0.485, 0.846], [0.589, 0.800], [0.669, 0.754], [0.742, 0.708],
  [0.789, 0.669], [0.797, 0.662], [0.847, 0.615], [0.889, 0.569],
  [0.920, 0.523], [0.951, 0.477], [0.969, 0.431], [0.981, 0.385],
  [0.988, 0.338], [1.000, 0.269], [0.981, 0.154], [0.938, 0.038],
  [0.944, 0.008], [0.859, -0.069], [0.675, -0.185], [0.577, -0.300],
  [0.491, -0.415], [0.405, -0.473], [0.000, -0.473],
];

// Fin outline in (radius / finSpan, y) plane; scaled by shape.finSpan.
const FIN_PROFILE = [
  [0.598, 0.02], [0.75, -0.18], [1.00, -0.50], [0.92, -0.85],
  [0.72, -1.20], [0.46, -1.50], [0.26, -1.66],
  [0.26, -1.40], [0.32, -1.00], [0.40, -0.60], [0.50, -0.30],
];

// Flame outline in (radius, absolute y) plane; scaled by flameRadius/flameLength.
const FLAME_PROFILE = [
  [0.40, -1.23], [0.44, -1.40], [0.44, -2.40], [0.40, -2.50],
  [0.30, -2.56], [0.10, -2.59], [0.00, -2.60],
];

const flameStops = [
  [-1.23, 0xe7422e], [-1.40, 0xf4641e], [-1.60, 0xf7901e],
  [-1.83, 0xfad214], [-2.30, 0xfaf05a], [-2.60, 0xf2f3f1],
];

function colorAtY(y, stops) {
  // stops are ordered from top (largest y) to bottom (smallest y)
  if (y >= stops[0][0]) return new THREE.Color(stops[0][1]);
  for (let i = 1; i < stops.length; i++) {
    if (y >= stops[i][0]) {
      const [y0, c0] = stops[i - 1];
      const [y1, c1] = stops[i];
      const t = (y - y0) / (y1 - y0);
      return new THREE.Color(c0).lerp(new THREE.Color(c1), t);
    }
  }
  return new THREE.Color(stops[stops.length - 1][1]);
}

let rocketGroup = null;
const disposables = [];
function disposeOld() {
  if (rocketGroup) {
    scene.remove(rocketGroup);
    rocketGroup.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => m.dispose());
    });
    rocketGroup = null;
  }
}

function buildHull(p) {
  const R = p.shape.bodyRadius, H = p.shape.halfHeight;
  const pts = HULL_PROFILE.map(([r, f]) => new THREE.Vector2(Math.max(r * R, 0.0001), f * H));
  const geo = new THREE.LatheGeometry(pts, 72);
  const pos = geo.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  const noseY = H - p.shape.noseLength;
  const cNose = new THREE.Color(p.colors.nose);
  const cBody = new THREE.Color(p.colors.body);
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i);
    const c = y >= noseY ? cNose : cBody;
    colors[i * 3] = c.r; colors[i * 3 + 1] = c.g; colors[i * 3 + 2] = c.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.55, metalness: 0.05 });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.name = 'hull';
  return mesh;
}

function hullRadiusAt(p, y) {
  const H = p.shape.halfHeight;
  const f = y / H;
  for (let i = 1; i < HULL_PROFILE.length; i++) {
    if (f >= HULL_PROFILE[i][1]) {
      const [r0, f0] = HULL_PROFILE[i - 1];
      const [r1, f1] = HULL_PROFILE[i];
      const t = f1 === f0 ? 0 : (f - f0) / (f1 - f0);
      return (r0 + t * (r1 - r0)) * p.shape.bodyRadius;
    }
  }
  return 0;
}

function buildWindow(p) {
  const g = new THREE.Group();
  const y = p.shape.windowY;
  const r = hullRadiusAt(p, y);
  const z = r + 0.012;
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(p.shape.windowRadius + p.shape.ringWidth * 0.5, p.shape.ringWidth * 0.55, 20, 48),
    new THREE.MeshStandardMaterial({ color: p.colors.windowRing, roughness: 0.4 })
  );
  ring.position.set(0, y, z);
  const glass = new THREE.Mesh(
    new THREE.CylinderGeometry(p.shape.windowRadius, p.shape.windowRadius, 0.05, 48),
    new THREE.MeshStandardMaterial({ color: p.colors.window, roughness: 0.15, metalness: 0.1 })
  );
  glass.rotation.x = Math.PI / 2;
  glass.position.set(0, y, z + 0.02);
  g.add(ring, glass);
  g.name = 'window';
  return g;
}

function buildFin(p, angle) {
  const s = p.shape;
  const shape = new THREE.Shape();
  shape.moveTo(FIN_PROFILE[0][0] * s.finSpan, FIN_PROFILE[0][1]);
  for (let i = 1; i < FIN_PROFILE.length; i++) shape.lineTo(FIN_PROFILE[i][0] * s.finSpan, FIN_PROFILE[i][1]);
  shape.closePath();
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: s.finThickness, bevelEnabled: true, bevelThickness: 0.02, bevelSize: 0.02, bevelSegments: 2, steps: 1,
  });
  geo.translate(0, 0, -s.finThickness / 2);
  const mat = new THREE.MeshStandardMaterial({ color: p.colors.fin, roughness: 0.55, metalness: 0.05 });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.rotation.y = angle - Math.PI / 2;
  mesh.name = 'fin';
  return mesh;
}

function buildFlame(p) {
  const g = new THREE.Group();
  const H = p.shape.halfHeight;
  const baseY = -0.473 * H;
  const rs = p.shape.flameRadius / 0.44;
  const fl = p.shape.flameLength / 1.37;
  const pts = FLAME_PROFILE.map(([r, y0]) => new THREE.Vector2(Math.max(r * rs, 0.0001), baseY + (y0 - baseY) * fl));
  const geo = new THREE.LatheGeometry(pts, 48);
  const pos = geo.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  const wob = p.shape.flameWobble;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    const theta = Math.atan2(x, z);
    const k = 1 + wob * Math.sin(3 * theta + y * 2.2) * (0.4 + 0.6 * Math.min(1, Math.abs(y - baseY)));
    pos.setX(i, x * k);
    pos.setZ(i, z * k);
    const c = colorAtY(y, flameStops.map(([yy, cc]) => [baseY + (yy - baseY) * fl, cc]));
    colors[i * 3] = c.r; colors[i * 3 + 1] = c.g; colors[i * 3 + 2] = c.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  const mat = new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.96, side: THREE.DoubleSide });
  const flame = new THREE.Mesh(geo, mat);
  flame.name = 'flame';
  g.add(flame);

  // bright inner core
  const corePts = FLAME_PROFILE.map(([r, y0]) => new THREE.Vector2(Math.max(r * 0.55 * rs, 0.0001), baseY + (y0 - baseY) * fl));
  const coreGeo = new THREE.LatheGeometry(corePts, 32);
  const cpos = coreGeo.attributes.position;
  const ccolors = new Float32Array(cpos.count * 3);
  for (let i = 0; i < cpos.count; i++) {
    const y = cpos.getY(i);
    const c = colorAtY(y, [[baseY - 0.0 * fl, 0xfad214], [baseY - 0.5 * fl, 0xfad214], [baseY - 1.1 * fl, 0xfdf6c8], [baseY - 1.37 * fl, 0xffffff]]);
    ccolors[i * 3] = c.r; ccolors[i * 3 + 1] = c.g; ccolors[i * 3 + 2] = c.b;
  }
  coreGeo.setAttribute('color', new THREE.BufferAttribute(ccolors, 3));
  const core = new THREE.Mesh(coreGeo, new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.85, side: THREE.DoubleSide }));
  core.name = 'flameCore';
  g.add(core);
  return g;
}

function buildRocket(p) {
  disposeOld();
  rocketGroup = new THREE.Group();
  rocketGroup.name = 'rocket';
  rocketGroup.add(buildHull(p));
  rocketGroup.add(buildWindow(p));
  const n = Math.max(1, Math.round(p.shape.finCount));
  for (let i = 0; i < n; i++) rocketGroup.add(buildFin(p, (i / n) * Math.PI * 2));
  if (p.showFlame) rocketGroup.add(buildFlame(p));
  scene.add(rocketGroup);
}

let grid = null;
function buildGrid(p) {
  if (grid) { scene.remove(grid); grid.geometry.dispose(); grid.material.dispose(); grid = null; }
  if (p.showGrid) {
    grid = new THREE.GridHelper(8, 16, 0x8899bb, 0xccd6e8);
    grid.position.y = -2.62;
    scene.add(grid);
  }
}

buildRocket(PARAMS);
buildGrid(PARAMS);

// ---------------------------------------------------------------------------
// GUI (live editing) + animation loop
// ---------------------------------------------------------------------------
let gui = null;
if (!qs.has('nogui')) {
  gui = new GUI({ title: 'Rocket editor' });
  const c = gui.addFolder('Colors');
  for (const k of Object.keys(PARAMS.colors)) c.addColor(PARAMS.colors, k).onChange(() => buildRocket(PARAMS));
  const s = gui.addFolder('Shape');
  s.add(PARAMS.shape, 'bodyRadius', 0.4, 1.4).onChange(() => buildRocket(PARAMS));
  s.add(PARAMS.shape, 'halfHeight', 1.8, 3.6).onChange(() => buildRocket(PARAMS));
  s.add(PARAMS.shape, 'noseLength', 0.3, 1.8).onChange(() => buildRocket(PARAMS));
  s.add(PARAMS.shape, 'finCount', 1, 8, 1).onChange(() => buildRocket(PARAMS));
  s.add(PARAMS.shape, 'finSpan', 0.8, 2.0).onChange(() => buildRocket(PARAMS));
  s.add(PARAMS.shape, 'finThickness', 0.03, 0.25).onChange(() => buildRocket(PARAMS));
  s.add(PARAMS.shape, 'windowY', 0.2, 2.0).onChange(() => buildRocket(PARAMS));
  s.add(PARAMS.shape, 'windowRadius', 0.1, 0.6).onChange(() => buildRocket(PARAMS));
  s.add(PARAMS.shape, 'flameLength', 0.4, 2.4).onChange(() => buildRocket(PARAMS));
  s.add(PARAMS.shape, 'flameRadius', 0.15, 0.8).onChange(() => buildRocket(PARAMS));
  s.add(PARAMS.shape, 'flameWobble', 0, 0.4).onChange(() => buildRocket(PARAMS));
  gui.add(PARAMS, 'showFlame').name('flame').onChange(() => buildRocket(PARAMS));
  gui.add(PARAMS, 'showGrid').name('grid').onChange(() => buildGrid(PARAMS));
}

if (qs.has('shot')) {
  // deterministic front view for screenshots
  if (gui) gui.hide();
  camera.position.set(0, 0, 21);
  camera.fov = 14;
  camera.updateProjectionMatrix();
  camera.lookAt(0, -0.1, 0);
  controls.enabled = false;
}

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

function tick(t) {
  requestAnimationFrame(tick);
  if (rocketGroup) {
    const flame = rocketGroup.getObjectByName('flame');
    if (flame) {
      const s = 1 + 0.03 * Math.sin(t * 0.012);
      flame.scale.set(1, s, 1);
    }
  }
  controls.update();
  renderer.render(scene, camera);
}
requestAnimationFrame(tick);

window.__ready = true;
