// Ruisui fire station — procedural analysis model (metres).
// X1..X6 run along x (0 → 40.30), Y1..Y4 along z (0 → -18.50), y is up.
// Floor levels: GL 0, 1F +1.50, 2F +5.30, 3F +8.80, roof +12.30.
// Author's analysis model: dimensions approximate, not an as-built survey.
import * as THREE from 'three';

export const LEVELS = { GL: 0, F1: 1.5, F2: 5.3, F3: 8.8, R: 12.3 };
export const GRID_X = [0, 8, 16, 24.8, 32.8, 40.3];
export const GRID_Z = [0, -5, -11.5, -18.5];

export const ZONE_TYPES = {
  garage:  { name: '消防車庫', color: '#c8553d' },
  office:  { name: '辦公．會議', color: '#4f7cac' },
  duty:    { name: '值勤．生活', color: '#d9a441' },
  sleep:   { name: '寢室', color: '#6a9a62' },
  service: { name: '設備．服務', color: '#9a958a' },
  terrace: { name: '屋頂平台', color: '#c9c4b4' }
};

// [x0, x1, z0, z1, type, label]
export const ZONES = {
  1: [
    [0, 8, -18.5, -11.5, 'duty', '廚房．餐廳'],
    [0, 8, -11.5, -5, 'office', '分隊辦公室'],
    [8, 16, -18.5, -11.5, 'service', '廁所．盥洗'],
    [8, 16, -11.5, -5, 'service', '樓梯．安全梯'],
    [8, 16, -5, 0, 'duty', '值班室．值班備勤'],
    [16, 32.8, -18.5, -11.5, 'service', '裝備．器材保養'],
    [32.8, 40.3, -18.5, -11.5, 'service', '樓梯．發電機'],
    [16, 40.3, -11.5, 0, 'garage', '消防車庫']
  ],
  2: [
    [0, 32.8, -18.5, -13.2, 'sleep', '備勤寢室 ×8'],
    [0, 32.8, -13.2, -11.5, 'service', '走道'],
    [0, 8, -11.5, -5, 'sleep', '備勤寢室 ×2'],
    [8, 16, -11.5, -5, 'service', '樓梯．廁所'],
    [8, 16, -5, 0, 'sleep', '分隊長．小隊長寢室'],
    [32.8, 40.3, -18.5, -11.5, 'service', '樓梯．儲藏']
  ],
  3: [
    [8, 16, -11.5, -5, 'office', '活動室'],
    [8, 16, -5, 1.8, 'office', '會議室'],
    [32.8, 40.3, -18.5, -11.5, 'service', '樓梯塔'],
    [0, 8, -18.5, -5, 'terrace', '屋頂平台'],
    [16, 32.8, -18.5, -11.5, 'terrace', '屋頂平台']
  ]
};
const FLOOR_Y = { 1: LEVELS.F1, 2: LEVELS.F2, 3: LEVELS.F3 };

export function zoneAt(x, y, z) {
  const f = y < LEVELS.F2 ? 1 : y < LEVELS.F3 ? 2 : 3;
  for (const r of ZONES[f]) if (x >= r[0] - .3 && x <= r[1] + .3 && z >= r[2] - .4 && z <= r[3] + .4) return r[4];
  return 'service';
}

export function textSprite(text, { size = 64, color = '#2b2a27', bg = null, height = .8, weight = 500, font = '"Noto Sans TC", sans-serif', pad = 18 } = {}) {
  const c = document.createElement('canvas'); const ctx = c.getContext('2d');
  ctx.font = `${weight} ${size}px ${font}`;
  const w = Math.ceil(ctx.measureText(text).width) + pad * 2, h = Math.ceil(size * 1.45);
  c.width = w; c.height = h;
  ctx.font = `${weight} ${size}px ${font}`;
  if (bg) { ctx.fillStyle = bg; ctx.fillRect(0, 0, w, h); }
  ctx.fillStyle = color; ctx.textBaseline = 'middle'; ctx.textAlign = 'center'; ctx.fillText(text, w / 2, h / 2 + size * .04);
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false, depthWrite: false }));
  s.scale.set(height * w / h, height, 1); s.renderOrder = 20; s.userData.label = true;
  return s;
}

export function buildModel() {
  const root = new THREE.Group();
  const building = new THREE.Group(); building.name = 'building'; root.add(building);
  const landscape = new THREE.Group(); landscape.name = 'landscape'; root.add(landscape);
  const mats = [], edgeLines = [], glass = [];
  const edgeMat = new THREE.LineBasicMaterial({ color: 0x2b2a27, transparent: true, opacity: .55 });

  const mat = (color, o = {}) => {
    const m = new THREE.MeshStandardMaterial({ color, roughness: o.rough ?? .85, metalness: o.metal ?? 0, transparent: !!o.opacity, opacity: o.opacity ?? 1 });
    m.userData = { color: new THREE.Color(color), plain: new THREE.Color(o.plain ?? '#ecebe6'), rough: o.rough ?? .85, metal: o.metal ?? 0, keep: !!o.keep };
    mats.push(m); return m;
  };
  const M = {
    wall: mat('#c6c1b3'), white: mat('#e8e7e0'), dark: mat('#2f3538', { plain: '#e2e1da' }), gold: mat('#d2ad55'),
    brown: mat('#8b6a50'), roof: mat('#b2b4aa'), metal: mat('#5d6867', { rough: .42, metal: .5, plain: '#d8d7d0' }),
    black: mat('#20292d', { plain: '#cfcec7' }), paving: mat('#c4c4ba', { plain: '#e4e3dc' }), grass: mat('#8fa079', { plain: '#e0dfd8' }),
    trunk: mat('#7e7661', { plain: '#d6d5ce' }), leaf: mat('#6f8a62', { plain: '#dddcd5' }), red: mat('#9c3f36'),
    inner: mat('#f1efe9', { plain: '#f4f3ee' }), paleGlass: mat('#b6ccd0', { rough: .3, metal: .1, plain: '#e7eeee', opacity: .55 })
  };
  const G = {
    day: new THREE.MeshStandardMaterial({ color: '#56747c', roughness: .2, metalness: .35 }),
    lowe: new THREE.MeshStandardMaterial({ color: '#7fa3a6', roughness: .15, metalness: .45 }),
    plain: new THREE.MeshStandardMaterial({ color: '#d5dcdc', roughness: .3 }),
    dark: new THREE.MeshStandardMaterial({ color: '#141c22', roughness: .3 }),
    lit: new THREE.MeshStandardMaterial({ color: '#2a2418', emissive: '#ffcf86', emissiveIntensity: 1.25 }),
    dim: new THREE.MeshStandardMaterial({ color: '#1d1a14', emissive: '#ffb45e', emissiveIntensity: .16 })
  };

  function mesh(geo, m, x = 0, y = 0, z = 0, parent = building, edge = true) {
    const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.castShadow = true; o.receiveShadow = true; parent.add(o);
    if (edge) { const e = new THREE.LineSegments(new THREE.EdgesGeometry(geo, 28), edgeMat); e.visible = false; e.raycast = () => {}; o.add(e); edgeLines.push(e); }
    return o;
  }
  const box = (x, y, z, w, h, d, m, parent = building, edge = true) => mesh(new THREE.BoxGeometry(w, h, d), m, x, y, z, parent, edge);
  function bar(a, b, width, m, parent = building, depth = width) {
    const av = new THREE.Vector3(...a), bv = new THREE.Vector3(...b);
    const o = box(...av.clone().add(bv).multiplyScalar(.5).toArray(), width, av.distanceTo(bv), depth, m, parent);
    o.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), bv.sub(av).normalize()); return o;
  }
  function tube(a, b, r, m, parent = building) {
    const av = new THREE.Vector3(...a), bv = new THREE.Vector3(...b);
    const o = mesh(new THREE.CylinderGeometry(r, r, av.distanceTo(bv), 20), m, ...av.clone().add(bv).multiplyScalar(.5).toArray(), parent);
    o.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), bv.sub(av).normalize()); return o;
  }
  function face(points, z, depth, m, parent = building) {
    const s = new THREE.Shape(); points.forEach(([x, y], i) => i ? s.lineTo(x, y) : s.moveTo(x, y)); s.closePath();
    return mesh(new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: false }), m, 0, 0, z, parent);
  }
  function rail(x1, z1, x2, z2, y, parent = building) {
    bar([x1, y + 1, z1], [x2, y + 1, z2], .05, M.metal, parent); bar([x1, y + .15, z1], [x2, y + .15, z2], .04, M.metal, parent);
    const n = Math.ceil(Math.hypot(x2 - x1, z2 - z1) / .25);
    for (let i = 0; i <= n; i++) { const t = i / n; box(x1 + (x2 - x1) * t, y + .55, z1 + (z2 - z1) * t, .025, .9, .025, M.metal, parent, false); }
  }
  // Window on a wall facing ±z. Glass panes are registered for night lighting and glazing studies.
  function win(x, y, z, w, h, out = 1) {
    const g = box(x, y, z, w - .06, h - .06, .06, G.day, building, false); glass.push(g);
    for (const dx of [-w / 2, w / 2]) box(x + dx, y, z + out * .12, .06, h + .08, .09, M.dark, building, false);
    for (const dy of [-h / 2, h / 2]) box(x, y + dy, z + out * .12, w, .055, .09, M.dark, building, false);
    if (w > 1.6) box(x, y, z + out * .13, .045, h, .06, M.dark, building, false);
  }
  // Window on a wall facing ±x.
  function sideWin(x, y, z, w, h, out = -1) {
    const g = box(x, y, z, .06, h - .06, w - .06, G.day, building, false); glass.push(g);
    for (const dz of [-w / 2, w / 2]) box(x + out * .1, y, z + dz, .1, h + .06, .06, M.dark, building, false);
    for (const dy of [-h / 2, h / 2]) box(x + out * .1, y + dy, z, .1, .06, w, M.dark, building, false);
  }
  // Wall along x at depth z with rectangular openings [x, y, w, h].
  function wall(x1, x2, y1, y2, z, depth, openings, m = M.wall) {
    const cuts = [x1, x2, ...openings.flatMap(o => [o[0], o[0] + o[2]])].filter(x => x >= x1 && x <= x2).sort((a, b) => a - b);
    for (let i = 0; i < cuts.length - 1; i++) {
      const a = cuts[i], b = cuts[i + 1]; if (b - a < .01) continue;
      const o = openings.find(o => (a + b) / 2 > o[0] && (a + b) / 2 < o[0] + o[2]);
      if (!o) box((a + b) / 2, (y1 + y2) / 2, z, b - a, y2 - y1, depth, m);
      else {
        if (o[1] > y1) box((a + b) / 2, (y1 + o[1]) / 2, z, b - a, o[1] - y1, depth, m);
        if (o[1] + o[3] < y2) box((a + b) / 2, (o[1] + o[3] + y2) / 2, z, b - a, y2 - o[1] - o[3], depth, m);
      }
    }
    for (const o of openings) win(o[0] + o[2] / 2, o[1] + o[3] / 2, z, o[2], o[3], z > -12 ? 1 : -1);
  }

  // ---------- Plinth and ground floor slab ----------
  box(20.15, .69, -9.25, 41, 1.38, 19.3, M.wall);
  box(20.15, 1.44, -9.25, 41, .12, 19.3, M.paving);

  // ---------- Two storeys of the L-shaped wing ----------
  const backWins = [];
  for (const [y, h] of [[1.5, 3.8], [5.3, 3.5]]) {
    const low = y < 3;
    const backOpen = []; for (let i = 0; i < 8; i++) backOpen.push([1 + i * 4, y + (low ? 1.9 : 1.8), 2.2, low ? .7 : .65]);
    backOpen.forEach(o => backWins.push({ x: o[0] + o[2] / 2, y: o[1] + o[3] / 2, w: o[2], h: o[3] }));
    wall(0, 32.8, y, y + h, -18.5, .25, backOpen, low ? M.wall : M.white);
    const frontOpen = low ? [[.7, 2.5, 2.1, 1.2], [4, 2.5, 2.1, 1.2], [9.2, 1.5, 1.2, 2.4], [11.5, 1.5, 3.1, 2.5]] : [[.7, 6.5, 1.1, 2], [2.1, 7.2, 2, .6], [5.7, 6.5, 1, 2]];
    wall(0, 8, y, y + h, -5, .25, frontOpen.filter(o => o[0] < 8), low ? M.wall : M.gold);
    wall(8, 16, y, y + h, 0, .25, frontOpen.filter(o => o[0] >= 8).concat(low ? [] : [[8.5, 6.4, 1.3, 2], [10, 7.2, 2, .6], [13.4, 7.2, 1.2, .6]]), low ? M.white : M.gold);
    box(.12, y + h / 2, -11.75, .25, h, 13.5, low ? M.wall : M.dark);      // south end wall (X1)
    box(8.1, y + h / 2, -2.5, .25, h, 5, M.wall);                          // south face of entrance block
    box(15.9, y + h / 2, -6, .25, h, 12, M.wall);                           // garage side wall
    const inner = []; for (let i = 0; i < 8; i++) inner.push([.65 + i * 4, y + (low ? 2 : 1.8), 2.1, .65]);
    wall(0, 32.8, y, y + h, -11.5, .22, inner, low ? M.wall : M.white);
    wall(32.8, 40.3, y, y + h, -11.5, .22, low ? [[34.5, 1.5, 1.2, 2.3]] : [[34.6, 6.6, 1.6, .6]], M.wall);
    box(32.7, y + h / 2, -15, .2, h, 7, M.inner);
  }
  // Floor slabs
  for (const y of [5.3, 8.8]) {
    box(20.15, y - .12, -15, 40.8, .24, 8.3, M.roof); box(8, y - .12, -8.1, 16.5, .24, 6.5, M.roof); box(12, y - .12, -1.6, 8.8, .24, 6.6, M.roof);
  }
  // Interior partitions (read in the plan cuts)
  const part = (x, z, w, d, y0, y1) => box(x, (y0 + y1) / 2, z, w, y1 - y0, d, M.inner);
  part(8, -15, .15, 7, 1.5, 5.2); part(16, -15, .15, 7, 1.5, 5.2); part(4, -14.2, 8, .12, 1.5, 5.2);
  part(8, -8.25, .15, 6.5, 1.5, 5.2); part(12, -5, 8, .12, 1.5, 5.2); part(24.4, -15, .12, 7, 1.5, 5.2);
  part(16.4, -13.2, 32.8, .12, 5.3, 8.7); for (let i = 1; i < 8; i++) part(i * 4.1, -15.85, .12, 5.3, 5.3, 8.7);
  part(8, -8.25, .15, 6.5, 5.3, 8.7); part(12, -2.5, .12, 5, 5.3, 8.7); part(12, -5, 8, .12, 5.3, 8.7);

  // ---------- Third floor block X2–X3 ----------
  box(12, 12.18, -5.1, 8.8, .24, 14.6, M.roof);
  box(8.1, 10.5, -5.1, .22, 3.4, 13.6, M.dark); box(15.9, 10.5, -5.1, .22, 3.4, 13.6, M.gold);
  wall(8, 16, 8.8, 12.3, 1.9, .25, [[8.8, 9.2, 3, 2], [12, 9.2, 2.7, 2]], M.gold);
  wall(8, 16, 8.8, 12.3, -11.5, .25, [[9.2, 9.4, 2, 1.5], [12.5, 8.8, 1, 2.2]], M.white);
  part(12, -5, 8, .12, 8.8, 12.1);

  // Dark frame and zig-zag balcony motif of the east elevation
  box(8, 8.15, 2.02, .46, 8.3, .5, M.dark); box(12, 12.18, 2.02, 8.5, .54, .5, M.dark); box(16.1, 10.8, 2.02, .42, 2.9, .5, M.dark);
  face([[8.2, 8.55], [11.4, 8.55], [15.9, 11.55], [15.9, 11.12], [11.55, 8.12], [8.2, 8.12]], 2.03, .42, M.dark);
  face([[8.3, 8.55], [11.35, 8.55], [13.85, 6.8], [16, 6.8], [16, 6.28], [13.7, 6.28], [11.2, 8.03], [8.3, 8.03]], 2.03, .4, M.dark);
  box(12, 5.34, 1.68, 8.4, .28, 1.1, M.dark); box(12, 6, 2.05, 8, .95, .14, M.white); box(12, 4.85, 2.25, 8.3, .58, .45, M.dark);
  // Entrance steps and ramp
  box(12.6, 1.42, 2.15, 5.4, .16, 3.4, M.paving); for (let i = 0; i < 8; i++) box(12.6, .1 + i * .18, 4.35 - i * .29, 4.5, .2, .34, M.white, building, false);
  const ramp = box(5.8, .86, .1, 11.2, .18, 1.75, M.paving); ramp.rotation.z = .105; rail(.4, 1, 10.9, 1, 1.25);
  box(10.4, 3.7, 2.03, 3.9, .55, .12, M.black);

  // ---------- Garage: open double-height shelter ----------
  box(28.15, 1.45, -5.75, 24.5, .14, 11.5, M.paving);
  for (const x of [16, 24.8, 32.8, 40.3]) { box(x, 4.35, -3.8, .46, 5.75, .55, M.brown); box(x, 4.35, -4.12, .13, 5.75, .08, M.white, building, false); }
  box(40.25, 5.2, -10.8, .28, 7.4, 14.5, M.wall);
  const canopy = box(28.15, 8.85, -7.6, 24.7, .3, 8.2, M.roof); canopy.rotation.z = -.039;
  face([[16, 9.6], [40.6, 8.64], [40.6, 7.65], [16, 8.61]], -3.52, .45, M.brown);
  face([[16.1, 8.6], [32.4, 7.96], [34.3, 6.75], [16.1, 6.75]], -3.45, .18, M.gold);
  face([[16, 7.2], [32.1, 7.2], [33.4, 6.52], [16, 6.52]], -3.22, .28, M.dark);
  face([[32.1, 8], [40.55, 7.68], [40.55, 6.52], [33.4, 6.52]], -3.2, .3, M.white);

  // Roof terrace railings and rear balconies
  rail(-.3, -4.9, 7.8, -4.9, 8.8); rail(16.4, -11.5, 32.5, -11.5, 8.8); rail(-.3, -18.9, 32.6, -18.9, 8.8);
  for (let i = 0; i < 4; i++) { const x = 1 + i * 8; box(x + 1.1, 5.18, -19.15, 2.9, .22, 1.2, M.roof); rail(x - .35, -19.7, x + 2.55, -19.7, 5.3); }

  // Stair / training tower X5–X6
  box(36.55, 12.2, -15, 8, .3, 8.1, M.dark); box(40.2, 8.65, -15, .3, 7.2, 7.3, M.dark); box(32.9, 10.55, -15, .25, 3.5, 7.3, M.wall);
  wall(32.8, 40.3, 8.8, 12.3, -11.4, .25, [[34.6, 9.3, .36, 1.4], [35.3, 9.3, .36, 1.4]], M.wall);
  wall(32.8, 40.3, 1.5, 12.2, -18.6, .25, [[33.7, 1.5, 1.1, 2.4], [34, 5.7, 2.7, 2.3], [34, 9.3, 3, 2.1]], M.brown);
  box(38.25, 10.35, -11.15, 3.6, 2.6, .12, M.black);
  for (let i = 0; i < 15; i++) box(36.5 + i * .25, 10.35, -11.03, .06, 2.6, .15, M.white, building, false);
  for (let j = 0; j < 11; j++) box(38.25, 9.1 + j * .25, -11.03, 3.6, .05, .15, M.white, building, false);
  rail(32.9, -18.4, 40.1, -18.4, 12.35);

  // ---------- South facade (X1): leaning dark frame, roof slab and V strut ----------
  {
    const s = new THREE.Shape();
    s.moveTo(-19.35, .75); s.lineTo(-4.9, .75); s.lineTo(-4.9, 8.75); s.lineTo(-20.55, 8.75); s.closePath();
    const hole = new THREE.Path(); hole.moveTo(-18.3, 1.6); hole.lineTo(-5.5, 1.6); hole.lineTo(-5.5, 8.15); hole.lineTo(-18.6, 8.15); hole.closePath();
    s.holes.push(hole);
    const fr = mesh(new THREE.ExtrudeGeometry(s, { depth: .45, bevelEnabled: false }), M.dark, -.02, 0, 0);
    fr.rotation.y = -Math.PI / 2;
  }
  box(-1.6, 8.74, -12.75, 3.8, .28, 16.3, M.roof);
  box(-3.42, 8.98, -12.75, .35, .7, 16.4, M.brown);
  tube([-3.35, 8.5, -20.35], [-3.35, .8, -9.35], .24, M.white);
  tube([-3.35, .8, -9.35], [-3.35, 8.5, -5.0], .24, M.white);
  box(-3.35, .55, -9.35, 1, .3, 1, M.wall);
  for (let z = -20.2; z < -5; z += 2) { box(-3.4, 9.48, z + 1, .06, .86, 1.86, M.paleGlass, building, false); box(-3.42, 9.48, z, .07, 1, .07, M.metal, building, false); }
  bar([-3.42, 9.98, -20.3], [-3.42, 9.98, -4.7], .065, M.metal);
  for (const z of [-15, -11.9, -8.8]) sideWin(-.05, 3.2, z, 2, 1.05);
  sideWin(-.05, 6.6, -11.6, 3.2, 2.1);
  box(-.8, 5.24, -11.6, 1.6, .2, 3.6, M.roof); box(-1.55, 5.85, -11.6, .08, 1, 3.6, M.paleGlass, building, false);
  for (const z of [-3.7, -1.7]) sideWin(8.0, 3.4, z, 1.3, .65);
  box(7.94, 6.6, -2.8, .16, 4.2, 4.4, M.dark);

  // ---------- Roof equipment ----------
  for (const x of [9, 11.4]) { mesh(new THREE.CylinderGeometry(.85, .85, 1.8, 20), M.metal, x, 9.8, -15.4); box(x, 10.75, -15.4, 1.6, .08, 1.6, M.white, building, false); }
  box(13.9, 9.4, -13.6, 1.8, 1.0, 1.1, M.metal);

  // ---------- Signs ----------
  const sign = (text, x, y, z, h, color, ry = 0, bg = null) => { const s = textSprite(text, { size: 90, color, height: h, bg }); s.material.depthTest = true; s.material.sizeAttenuation = true; s.position.set(x, y, z); s.userData.sign = true; building.add(s); return s; };
  // Planar text (faces the façade, unlike sprites)
  function plate(text, x, y, z, w, h, color, ry = 0, size = 90) {
    const c = document.createElement('canvas'); c.width = 2048; c.height = 256; const ctx = c.getContext('2d');
    ctx.fillStyle = color; ctx.font = `500 ${size}px "Noto Sans TC", sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(text, 1024, 130);
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: t, transparent: true, depthWrite: false }));
    m.position.set(x, y, z); m.rotation.y = ry; m.userData.sign = true; building.add(m); return m;
  }
  plate('花蓮縣消防局第三大隊　瑞穗分隊', 36.7, 7.16, -2.83, 7.2, .9, '#a88f58', 0, 78);
  plate('瑞穗消防分隊', 10.4, 3.7, 2.12, 3.7, .46, '#e5d7c1', 0, 120);
  plate('119', 7.82, 10.3, -1.4, 4.2, 1.9, '#d9493f', -Math.PI / 2, 220);

  // ---------- Fire appliances (scale cues) ----------
  for (const [x, color] of [[19.6, '#eeede7'], [22.6, '#eeede7'], [27.6, '#b62f29'], [34.2, '#c32e27'], [37.6, '#bc3028']]) {
    const paint = mat(color, { plain: '#dfded7' });
    box(x, 2.6, -7.3, 2.25, 2.05, 5.2, paint); box(x, 3.25, -4.75, 2.15, .85, .1, M.black, building, false); box(x, 1.83, -4.62, 2.25, .26, .2, M.white, building, false);
    for (const dx of [-1.06, 1.06]) for (const z of [-5.7, -8.9]) { const w = mesh(new THREE.CylinderGeometry(.43, .43, .22, 16), M.black, x + dx, 1.9, z, building, false); w.rotation.z = Math.PI / 2; }
  }

  // ---------- Context ----------
  box(20, -.13, -6, 150, .25, 120, M.paving, landscape, false);
  const lawn = [[-9, -9, 7, 30], [47.5, -8, 5, 32], [21, -24.5, 60, 6]];
  for (const [x, z, w, d] of lawn) box(x, .04, z, w, .08, d, M.grass, landscape, false);
  const trees = [];
  for (const [x, z, s] of [[-9, -21, 1], [-9, -13, 1.1], [-9, 2, .9], [47.5, -20, 1], [47.5, -9, 1.1], [47.5, 3, .9], [6, -24.5, .9], [26, -24.5, 1], [42, -24.5, .9], [-13, 9, 1.2]]) {
    box(x, 1.2 * s, z, .2, 2.4 * s, .2, M.trunk, landscape, false); const c = mesh(new THREE.IcosahedronGeometry(1.8 * s, 1), M.leaf, x, 3.4 * s, z, landscape, false); trees.push(c);
  }
  for (let x = -2; x < 44; x += 2.5) box(x, .02, 16, 1.2, .03, .12, M.white, landscape, false);

  // ---------- North arrow (true north: bearing of +x is 344.4°) ----------
  const north = new THREE.Group(); north.name = 'north'; root.add(north);
  {
    const s = new THREE.Shape(); s.moveTo(0, 2.6); s.lineTo(.9, -1.2); s.lineTo(0, -.5); s.lineTo(-.9, -1.2); s.closePath();
    const a = new THREE.Mesh(new THREE.ShapeGeometry(s), new THREE.MeshBasicMaterial({ color: '#2b2a27' }));
    a.rotation.x = -Math.PI / 2; const ring = new THREE.Mesh(new THREE.RingGeometry(2.75, 2.85, 64), new THREE.MeshBasicMaterial({ color: '#2b2a27' })); ring.rotation.x = -Math.PI / 2;
    const holder = new THREE.Group(); holder.add(a); holder.add(ring);
    // arrow points along local -z after rotation.x; rotate so it points to true north in scene coords
    const nx = Math.cos(15.6 * Math.PI / 180), nz = Math.sin(15.6 * Math.PI / 180);
    holder.rotation.y = Math.atan2(-nx, -nz);
    holder.position.set(-14, .08, 8); north.add(holder);
    const n = textSprite('N', { size: 80, height: 1.4, weight: 500 }); n.position.set(-14 + nx * 4.2, .9, 8 + nz * 4.2); north.add(n);
  }

  // ---------- Function zones (floor overlays + labels) ----------
  const zoneGroups = {}, labelGroups = {};
  for (const f of [1, 2, 3]) {
    const g = new THREE.Group(); g.visible = false; root.add(g); zoneGroups[f] = g;
    const lg = new THREE.Group(); lg.visible = false; root.add(lg); labelGroups[f] = lg;
    const y = FLOOR_Y[f] + .04;
    for (const [x0, x1, z0, z1, t, label] of ZONES[f]) {
      const m = new THREE.MeshBasicMaterial({ color: ZONE_TYPES[t].color, transparent: true, opacity: t === 'terrace' ? .35 : .62, depthWrite: false });
      const p = new THREE.Mesh(new THREE.PlaneGeometry(x1 - x0 - .3, Math.abs(z1 - z0) - .3), m);
      p.rotation.x = -Math.PI / 2; p.position.set((x0 + x1) / 2, y, (z0 + z1) / 2); p.renderOrder = 5; g.add(p);
      const l = textSprite(label, { size: 64, height: 1.8, bg: 'rgba(250,249,245,.9)' }); l.position.set((x0 + x1) / 2, y + .3, (z0 + z1) / 2); lg.add(l);
    }
  }
  // Exploded function diagram
  const diagram = new THREE.Group(); diagram.visible = false; root.add(diagram);
  for (const f of [1, 2, 3]) {
    const fy = (f - 1) * 6.5;
    const slab = new THREE.Mesh(new THREE.BoxGeometry(41, .12, 19.3), new THREE.MeshBasicMaterial({ color: '#e4e1d8', transparent: true, opacity: .55 }));
    slab.position.set(20.15, fy, -9.25); diagram.add(slab);
    for (const [x0, x1, z0, z1, t] of ZONES[f]) {
      const hgt = t === 'terrace' ? .15 : f === 1 && t === 'garage' ? 3.4 : 1.6;
      const geo = new THREE.BoxGeometry(x1 - x0 - .25, hgt, Math.abs(z1 - z0) - .25);
      const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: ZONE_TYPES[t].color, roughness: .9, transparent: t === 'terrace', opacity: t === 'terrace' ? .5 : 1 }));
      m.position.set((x0 + x1) / 2, fy + hgt / 2 + .06, (z0 + z1) / 2); m.castShadow = true; diagram.add(m);
      const e = new THREE.LineSegments(new THREE.EdgesGeometry(geo), edgeMat); m.add(e);
    }
    const tag = textSprite(`${f}F`, { size: 80, height: 1.5, weight: 500 }); tag.position.set(-5, fy + 1, -9); diagram.add(tag);
  }

  // ---------- Dimension annotations for orthographic elevations ----------
  const dims = { front: new THREE.Group(), side: new THREE.Group() };
  const inkLine = new THREE.LineBasicMaterial({ color: 0x5f5b54 });
  const line = (pts, g) => { const l = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts.map(p => new THREE.Vector3(...p))), inkLine); g.add(l); };
  for (const g of Object.values(dims)) { g.visible = false; root.add(g); }
  const levels = [['GL ±0', 0], ['1FL +1.50', 1.5], ['2FL +5.30', 5.3], ['3FL +8.80', 8.8], ['RFL +12.30', 12.3]];
  for (const [t, y] of levels) {
    line([[-7, y, 4], [44, y, 4]], dims.front); const s = textSprite(t, { size: 54, height: .95, color: '#5f5b54', font: '"IBM Plex Mono", monospace', weight: 400 }); s.position.set(-9.6, y + .35, 4); dims.front.add(s);
    line([[-24, y, -9], [6, y, -9]], dims.side); const s2 = textSprite(t, { size: 54, height: .95, color: '#5f5b54', font: '"IBM Plex Mono", monospace', weight: 400 }); s2.position.set(-6, y + .35, 8.5); dims.side.add(s2);
  }
  GRID_X.forEach((x, i) => { line([[x, 13.2, 4], [x, 15, 4]], dims.front); const s = textSprite(`X${i + 1}`, { size: 54, height: 1.0, font: '"IBM Plex Mono", monospace', weight: 400 }); s.position.set(x, 15.6, 4); dims.front.add(s); });
  GRID_Z.forEach((z, i) => { line([[-5, 13.2, z], [-5, 15, z]], dims.side); const s = textSprite(`Y${i + 1}`, { size: 54, height: 1.0, font: '"IBM Plex Mono", monospace', weight: 400 }); s.position.set(-5, 15.6, z); dims.side.add(s); });
  const spanF = textSprite('40.30 m', { size: 54, height: .95, color: '#5f5b54', font: '"IBM Plex Mono", monospace', weight: 400 }); spanF.position.set(20.15, 16.8, 4); dims.front.add(spanF);
  const spanS = textSprite('18.50 m', { size: 54, height: .95, color: '#5f5b54', font: '"IBM Plex Mono", monospace', weight: 400 }); spanS.position.set(-5, 16.8, -9.25); dims.side.add(spanS);

  return { root, building, landscape, north, mats, M, G, glass, edgeLines, edgeMat, zoneGroups, labelGroups, diagram, dims, trees, backWins, helpers: { box, bar, tube, mesh, mat, face, rail } };
}
