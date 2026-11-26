// seed.js — deterministic randomness for Sky Courier SORTIE 01.
// Every number the world and the game use comes from one fixed seed, so the
// same build always grows the same valley, the same trees and the same gates.
// Nothing here reads the clock or Math.random.

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// A tiny integer hash: turns one grid corner into a stable pseudo-random
// value in [0, 1). The seed salts it, so a new seed reshapes the valley.
function cornerHash(ix, iz, seed) {
  let h = (ix * 374761393 + iz * 668265263 + seed * 974634211) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

function smooth(t) {
  return t * t * (3 - 2 * t);
}

// Smooth value noise on the xz plane: bilinear blend of the four corners.
export function valueNoise2(x, z, seed) {
  const ix = Math.floor(x);
  const iz = Math.floor(z);
  const fx = x - ix;
  const fz = z - iz;
  const a = cornerHash(ix, iz, seed);
  const b = cornerHash(ix + 1, iz, seed);
  const c = cornerHash(ix, iz + 1, seed);
  const d = cornerHash(ix + 1, iz + 1, seed);
  const u = smooth(fx);
  const v = smooth(fz);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

// Fractal noise: a few octaves of value noise stacked for rolling hills.
export function fbm2(x, z, seed, octaves) {
  let sum = 0;
  let amp = 1;
  let freq = 1;
  let norm = 0;
  for (let o = 0; o < octaves; o++) {
    sum += valueNoise2(x * freq, z * freq, seed + o * 101) * amp;
    norm += amp;
    amp *= 0.5;
    freq *= 2.03;
  }
  return sum / norm;
}

export function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

export function lerp(a, b, t) {
  return a + (b - a) * t;
}
