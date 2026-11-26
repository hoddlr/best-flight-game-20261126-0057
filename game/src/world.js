
// world.js — the valley of SORTIE 01: one seeded heightfield, four named
// airstrips along a winding river valley, six numbered neon gates, pine
// forest, and a golden-hour sky dome with a low sun. The physics and the
// renderer both ask heightAt(x, z); the mesh is built once from the same
// function, so the ground you see is the ground you can hit.

import { fbm2, valueNoise2, clamp, lerp, mulberry32 } from './seed.js';
import { builder } from './mesh.js';

export const SEED = 20261126;
export const WORLD_HALF = 1300;

// The valley snakes gently along the x axis; the river and the airstrips
// follow its centre line.
export function valleyCentre(x) {
  return 130 * Math.sin(x * 0.0016) + 40 * Math.sin(x * 0.004 + 1.7);
}

// The four airstrips, west to east, climbing toward the High Pass.
export const FIELDS = [
  { name: 'HOME FIELD', short: 'HOME', x: -920, elev: 6, heading: 90, len: 190, wid: 26 },
  { name: 'RIVERBEND', short: 'RVRB', x: -320, elev: 10, heading: 78, len: 170, wid: 24 },
  { name: 'MILL TOWN', short: 'MILL', x: 300, elev: 16, heading: 102, len: 170, wid: 24 },
  { name: 'HIGH PASS', short: 'PASS', x: 920, elev: 42, heading: 90, len: 200, wid: 26 },
];
for (const f of FIELDS) f.z = valleyCentre(f.x);

// Raw hills, before the valley is carved and the strips are flattened.
function hillHeight(x, z) {
  const d = Math.hypot(x, z) / WORLD_HALF;
  const rim = Math.pow(Math.max(0, d - 0.55) / 0.45, 2) * 260;
  const hills = fbm2(x * 0.0016 + 7.3, z * 0.0016 + 2.9, SEED, 4);
  const rough = valueNoise2(x * 0.012, z * 0.012, SEED + 55);
  return (hills - 0.42) * 150 + (rough - 0.5) * 14 + rim;
}

export function heightAt(x, z) {
  const vc = valleyCentre(x);
  const across = Math.abs(z - vc);
  // Carve the flat valley floor, then let the walls rise beyond it.
  const carve = clamp((across - 150) / 260, 0, 1);
  const floor = 4 + valueNoise2(x * 0.004, 3.1, SEED + 9) * 3;
  let h = lerp(floor, hillHeight(x, z), carve * carve * (3 - 2 * carve));
  // Flatten a disc around every airstrip so runways sit on level ground.
  for (const f of FIELDS) {
    const d = Math.hypot(x - f.x, z - f.z);
    const w = clamp(1 - (d - 130) / 130, 0, 1);
    if (w > 0) h = lerp(h, f.elev, w * w * (3 - 2 * w));
  }
  return h;
}

// The six gates: two per parcel leg, hung over the valley between fields.
export function buildGates() {
  const legs = [
    [FIELDS[0], FIELDS[1]],
    [FIELDS[1], FIELDS[2]],
    [FIELDS[2], FIELDS[3]],
  ];
  const gates = [];
  let n = 1;
  for (const [a, b] of legs) {
    for (const t of [0.36, 0.72]) {
      const x = lerp(a.x, b.x, t);
      const z = lerp(a.z, b.z, t) + (n % 2 === 0 ? 38 : -38);
      const y = heightAt(x, z) + 46 + (n % 3) * 12;
      const dx = b.x - a.x, dz = b.z - a.z;
      const len = Math.hypot(dx, dz);
      gates.push({
        n, x, y, z,
        nx: dx / len, nz: dz / len, // ring faces along the leg
        radius: 20, passed: false,
        dest: b.name,
      });
      n++;
    }
  }
  return gates;
}

function groundColor(h, x, z) {
  const n = fbm2(x * 0.01, z * 0.01, SEED + 31, 2);
  if (h < 9) return [0.42 + n * 0.1, 0.55 + n * 0.08, 0.24]; // valley grass
  if (h < 55) return [0.5 + n * 0.12, 0.44 + n * 0.08, 0.28]; // dry slopes
  if (h < 130) return [0.42 + n * 0.1, 0.36 + n * 0.08, 0.3]; // rock
  return [0.82, 0.78, 0.72]; // high snow
}

// ---- meshes ---------------------------------------------------------------

function buildTerrainMesh() {
  const b = builder();
  const N = 96;
  const step = (WORLD_HALF * 2) / N;
  const H = [];
  for (let j = 0; j <= N; j++) {
    H.push([]);
    for (let i = 0; i <= N; i++) {
      H[j].push(heightAt(-WORLD_HALF + i * step, -WORLD_HALF + j * step));
    }
  }
  for (let j = 0; j < N; j++) {
    for (let i = 0; i < N; i++) {
      const x0 = -WORLD_HALF + i * step, z0 = -WORLD_HALF + j * step;
      const x1 = x0 + step, z1 = z0 + step;
      const h00 = H[j][i], h10 = H[j][i + 1], h01 = H[j + 1][i], h11 = H[j + 1][i + 1];
      const river = Math.abs((z0 + z1) / 2 - valleyCentre((x0 + x1) / 2)) < 26
        && ((h00 + h10 + h01 + h11) / 4) < 12;
      const col = river ? [0.24, 0.45, 0.62] : groundColor((h00 + h10 + h01 + h11) / 4, (x0 + x1) / 2, (z0 + z1) / 2);
      b.quad([x0, h00, z0], [x0, h01, z1], [x1, h11, z1], [x1, h10, z0], col);
    }
  }
  return b.data;
}

function buildStripMesh() {
  const b = builder();
  const asphalt = [0.16, 0.16, 0.18];
  const paint = [0.92, 0.9, 0.82];
  for (const f of FIELDS) {
    const rad = ((90 - f.heading) * Math.PI) / 180;
    const dx = Math.cos(rad), dz = -Math.sin(rad);
    const px = -dz, pz = dx; // across the runway
    const hl = f.len / 2, hw = f.wid / 2;
    const y = f.elev + 0.35;
    const corner = (a, c) => [f.x + dx * a + px * c, y, f.z + dz * a + pz * c];
    b.quad(corner(-hl, -hw), corner(-hl, hw), corner(hl, hw), corner(hl, -hw), asphalt);
    // Centre dashes and threshold bars.
    for (let d = -hl + 18; d < hl - 10; d += 26) {
      b.quad(corner(d, -1.1), corner(d, 1.1), corner(d + 13, 1.1), corner(d + 13, -1.1), paint);
    }
    for (const e of [-hl + 6, hl - 6]) {
      b.quad(corner(e - 4, -hw + 2), corner(e - 4, hw - 2), corner(e + 4, hw - 2), corner(e + 4, -hw + 2), paint);
    }
    // A small hangar and a beacon pole beside each strip.
    const hx = f.x + px * (hw + 26), hz = f.z + pz * (hw + 26);
    const hy = heightAt(hx, hz);
    b.box(hx, hy + 7, hz, 13, 7, 10, [0.62, 0.5, 0.38], { top: [0.72, 0.32, 0.24] });
    b.box(f.x - dx * (hl + 14), f.elev + 5, f.z - dz * (hl + 14), 0.5, 5, 0.5, [0.7, 0.7, 0.72]);
    b.pyramid(f.x - dx * (hl + 14), f.elev + 12, f.z - dz * (hl + 14), f.elev + 10, 1.6, [1, 0.45, 0.2]);
  }
  return b.data;
}

function buildForestMesh() {
  const b = builder();
  const rnd = mulberry32(SEED + 777);
  let placed = 0;
  let guard = 0;
  while (placed < 420 && guard++ < 6000) {
    const x = (rnd() * 2 - 1) * WORLD_HALF * 0.94;
    const z = (rnd() * 2 - 1) * WORLD_HALF * 0.94;
    const h = heightAt(x, z);
    if (h < 9 || h > 120) continue;
    if (Math.abs(z - valleyCentre(x)) < 60) continue;
    let nearStrip = false;
    for (const f of FIELDS) if (Math.hypot(x - f.x, z - f.z) < 150) nearStrip = true;
    if (nearStrip) continue;
    const s = 5 + rnd() * 7;
    const trunk = [0.32, 0.22, 0.14];
    const pine = [0.16 + rnd() * 0.08, 0.34 + rnd() * 0.1, 0.16];
    b.box(x, h + s * 0.25, z, 0.9, s * 0.25, 0.9, trunk);
    b.pyramid(x, h + s * 1.5, z, h + s * 0.45, s * 0.42, pine);
    b.pyramid(x, h + s * 1.15, z, h + s * 0.3, s * 0.5, pine);
    placed++;
  }
  return b.data;
}

function buildSkyMesh() {
  const b = builder();
  // A big inverted dome of warm bands: amber horizon, rose middle, dusk top.
  const R = 4200, segs = 24, rings = 6;
  const band = [
    [0.98, 0.62, 0.28],
    [0.96, 0.5, 0.32],
    [0.78, 0.42, 0.44],
    [0.5, 0.36, 0.52],
    [0.32, 0.3, 0.52],
    [0.22, 0.24, 0.48],
  ];
  for (let r = 0; r < rings; r++) {
    const a0 = (r / rings) * Math.PI * 0.5;
    const a1 = ((r + 1) / rings) * Math.PI * 0.5;
    for (let s = 0; s < segs; s++) {
      const t0 = (s / segs) * Math.PI * 2;
      const t1 = ((s + 1) / segs) * Math.PI * 2;
      const pt = (a, t) => [
        R * Math.cos(a) * Math.cos(t),
        R * Math.sin(a) - 40,
        R * Math.cos(a) * Math.sin(t),
      ];
      b.quad(pt(a0, t0), pt(a0, t1), pt(a1, t1), pt(a1, t0), band[r]);
    }
  }
  return b.data;
}

function buildSunMesh() {
  const b = builder();
  // Low sun disc due west, the light the whole valley is graded against.
  const cx = -3800, cy = 260, cz = -600;
  const glow = [1, 0.72, 0.32];
  const core = [1, 0.92, 0.62];
  b.quad([cx - 260, cy - 260, cz], [cx + 260, cy - 260, cz], [cx + 260, cy + 260, cz], [cx - 260, cy + 260, cz], glow);
  b.quad([cx - 110, cy - 110, cz + 4], [cx + 110, cy - 110, cz + 4], [cx + 110, cy + 110, cz + 4], [cx - 110, cy + 110, cz + 4], core);
  return b.data;
}

export function buildWorld(gl, upload) {
  return {
    terrain: upload(buildTerrainMesh()),
    strips: upload(buildStripMesh()),
    forest: upload(buildForestMesh()),
    sky: upload(buildSkyMesh()),
    sun: upload(buildSunMesh()),
    gates: buildGates(),
  };
}

export function gateMeshArrays(gate, color) {
  const b = builder();
  const n = [gate.nx, 0, gate.nz];
  b.ring(gate.x, gate.y, gate.z, gate.radius, 1.1, color, n, 28);
  return b.data;
}
