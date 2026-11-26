// The valley: one deterministic strip of land the plane flies over.
// Terrain height is a smooth sum of sines plus hand-placed features, so the
// same seed always builds the same hills, river, towns and runways.
// The ground is flat wherever a runway sits, so landings are fair.

import { FIELD, RING, STRIPS, WORLD_LENGTH } from './config.js';
import { randomInt } from './random.js';

const RUNWAY_HALF = 190;
const RUNWAY_FLAT = 260;

/** Smooth interpolation between two values. */
function smooth(t) {
  return t * t * (3 - 2 * t);
}

export function createWorld(random) {
  // Gentle rolling hills: three slow sine waves with seeded phases.
  const waves = [];
  for (let i = 0; i < 3; i += 1) {
    waves.push({
      amp: 26 + random() * 34,
      len: 1400 + random() * 1800,
      phase: random() * Math.PI * 2,
    });
  }
  // Tall mountain ridges in the far distance, drawn as a separate layer.
  const ridges = [];
  for (let i = 0; i < 26; i += 1) {
    ridges.push({ x: i * 400 + randomInt(random, -60, 60), h: 150 + random() * 190 });
  }
  // Field patches: rectangles of alternating crop colour along the valley.
  const fields = [];
  for (let x = 700; x < WORLD_LENGTH - 400; x += 260 + randomInt(random, 0, 160)) {
    fields.push({ x, w: 200 + randomInt(random, 0, 120), alt: random() < 0.5 });
  }
  // The river winds across the valley floor in a few visible bends.
  const riverBends = [];
  for (let x = 1400; x < WORLD_LENGTH - 800; x += 900 + randomInt(random, 0, 300)) {
    riverBends.push({ x, w: 46 + randomInt(random, 0, 30) });
  }
  // A small town of houses beside every strip except Home Field.
  const towns = [];
  for (let s = 1; s < STRIPS.length; s += 1) {
    const houses = [];
    const base = STRIPS[s].x + 260;
    for (let i = 0; i < 7; i += 1) {
      houses.push({
        x: base + i * 74 + randomInt(random, -12, 12),
        w: 44 + randomInt(random, 0, 18),
        h: 30 + randomInt(random, 0, 22),
      });
    }
    towns.push({ houses });
  }
  return { waves, ridges, fields, riverBends, towns, rings: buildRings(random) };
}

/** Ground height at world x, in screen pixels from the top (larger = lower). */
export function groundHeightAt(world, x) {
  const clamped = Math.max(0, Math.min(WORLD_LENGTH, x));
  let h = FIELD.height - 92;
  for (const w of world.waves) h -= w.amp * Math.sin((clamped / w.len) * Math.PI * 2 + w.phase) * 0.4;
  // Flatten the ground around every runway so the strip is level.
  for (const strip of STRIPS) {
    const d = Math.abs(clamped - strip.x);
    if (d < RUNWAY_FLAT) {
      const flat = FIELD.height - 92;
      h = flat + (h - flat) * smooth(d / RUNWAY_FLAT);
    }
  }
  return h;
}

/** Is world x over a runway strip (flat, safe to land on)? */
export function stripAt(x) {
  for (const strip of STRIPS) {
    if (Math.abs(x - strip.x) <= RUNWAY_HALF) return strip;
  }
  return null;
}

/** Rings hang in the air between neighbouring strips, guiding the route. */
function buildRings(random) {
  const rings = [];
  for (let leg = 0; leg < STRIPS.length - 1; leg += 1) {
    const from = STRIPS[leg].x + 420;
    const to = STRIPS[leg + 1].x - 420;
    for (let i = 0; i < RING.perLeg; i += 1) {
      const t = (i + 1) / (RING.perLeg + 1);
      const x = from + (to - from) * t;
      const ground = FIELD.height - 92;
      const y = ground - 190 - random() * 150 - Math.sin(t * Math.PI) * 60;
      rings.push({ x, y, taken: false, leg });
    }
  }
  return rings;
}

/** Reset every ring to unflown, for a fresh sortie. */
export function resetRings(world) {
  for (const ring of world.rings) ring.taken = false;
}
