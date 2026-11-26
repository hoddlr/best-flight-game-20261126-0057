// plane.js — the little red prop plane: its mesh, its arcade-sim physics,
// and the landing / damage rules. Forward is -z in model space... actually
// the model faces +x: nose at +x, wings span z, up is +y. The pose matrix
// (matFromPose) turns heading/pitch/roll into the world transform, and the
// same angles drive the chase camera and the ADI.

import { builder } from './mesh.js';
import { clamp } from './seed.js';
import { FIELDS, heightAt } from './world.js';

export const STALL_SPEED = 26; // m/s: below this the wing stops flying
export const MAX_SPEED = 82; // m/s at full throttle, level
export const TAKEOFF_SPEED = 30;

const RED = [0.78, 0.16, 0.12];
const RED_DARK = [0.55, 0.1, 0.08];
const CREAM = [0.93, 0.88, 0.74];
const GREY = [0.32, 0.33, 0.36];
const GLASS = [0.55, 0.75, 0.85];

export function buildPlaneMesh() {
  const b = builder();
  // Fuselage: a lofted shell, not a box — a row of cross-sections (x,
  // belly, roof, half-width) joined face by face, so the body swells
  // over the cowling, holds the cabin, then tapers to a fine tail cone.
  // Cream belly, red back and flanks, dark nose face (cooling intake).
  const fus = [
    [3.6, -0.40, 0.40, 0.40],
    [3.0, -0.47, 0.47, 0.47],
    [2.2, -0.49, 0.49, 0.48],
    [1.4, -0.48, 0.52, 0.46],
    [0.4, -0.46, 0.55, 0.43],
    [-0.6, -0.43, 0.52, 0.39],
    [-1.7, -0.36, 0.40, 0.30],
    [-2.8, -0.24, 0.26, 0.18],
    [-3.9, -0.11, 0.13, 0.08],
  ];
  for (let i = 0; i < fus.length - 1; i++) {
    const a = fus[i], c = fus[i + 1];
    b.quad([a[0], a[2], a[3]], [c[0], c[2], c[3]], [c[0], c[2], -c[3]], [a[0], a[2], -a[3]], RED);
    b.quad([a[0], a[1], -a[3]], [c[0], c[1], -c[3]], [c[0], c[1], c[3]], [a[0], a[1], a[3]], CREAM);
    b.quad([a[0], a[1], a[3]], [c[0], c[1], c[3]], [c[0], c[2], c[3]], [a[0], a[2], a[3]], RED);
    b.quad([c[0], c[1], -c[3]], [a[0], a[1], -a[3]], [a[0], a[2], -a[3]], [c[0], c[2], -c[3]], RED);
  }
  b.quad([3.6, -0.40, 0.40], [3.6, -0.40, -0.40], [3.6, 0.40, -0.40], [3.6, 0.40, 0.40], RED_DARK);
  b.quad([-3.9, -0.11, -0.08], [-3.9, -0.11, 0.08], [-3.9, 0.13, 0.08], [-3.9, 0.13, -0.08], RED);
  // Cowling cooling inlets on the nose face, and a cream cheatline
  // stripe along the cabin flank — the livery line a real light plane wears.
  b.box(3.62, -0.12, 0.18, 0.03, 0.14, 0.12, [0.08, 0.08, 0.09]);
  b.box(3.62, -0.12, -0.18, 0.03, 0.14, 0.12, [0.08, 0.08, 0.09]);
  b.slab(0.4, 2.2, 0.05, 0.16, 0.44, 0.475, CREAM);
  b.slab(0.4, 2.2, 0.05, 0.16, -0.475, -0.44, CREAM);
  // Canopy: a faceted bubble, not a slab — five stations from the sloped
  // windshield to the tapered rear, each a shallow arch (base, mid, ridge)
  // so the glass reads as a curved greenhouse over the cabin.
  const can = [
    [1.35, 0.48, 0.62, 0.68, 0.30, 0.16],
    [0.9, 0.50, 0.82, 0.92, 0.38, 0.20],
    [0.2, 0.52, 0.86, 0.96, 0.40, 0.21],
    [-0.5, 0.50, 0.80, 0.88, 0.36, 0.18],
    [-1.0, 0.44, 0.60, 0.64, 0.28, 0.12],
  ];
  for (let i = 0; i < can.length - 1; i++) {
    const a = can[i], c = can[i + 1];
    for (const s of [1, -1]) {
      const q = (y0, z0, y1, z1, y2, z2, y3, z3) => s > 0
        ? b.quad([a[0], y0, z0], [c[0], y1, z1], [c[0], y2, z2], [a[0], y3, z3], GLASS)
        : b.quad([c[0], y1, z1], [a[0], y0, z0], [a[0], y3, z3], [c[0], y2, z2], GLASS);
      q(a[1], s * a[4], c[1], s * c[4], c[2], s * c[5], a[2], s * a[5]);
      q(a[2], s * a[5], c[2], s * c[5], c[3], 0, a[3], 0);
    }
  }
  // Windshield (front) and rear glass faces.
  b.quad([1.35, 0.48, 0.30], [1.35, 0.48, -0.30], [1.35, 0.62, -0.16], [1.35, 0.62, 0.16], GLASS);
  b.tri([1.35, 0.62, 0.16], [1.35, 0.62, -0.16], [1.35, 0.68, 0], GLASS);
  b.quad([-1.0, 0.44, -0.28], [-1.0, 0.44, 0.28], [-1.0, 0.60, 0.12], [-1.0, 0.60, -0.12], GLASS);
  b.tri([-1.0, 0.60, -0.12], [-1.0, 0.60, 0.12], [-1.0, 0.64, 0], GLASS);
  // Radio mast on the cabin roof.
  b.box(-0.8, 0.72, 0, 0.03, 0.22, 0.03, GREY);
  // Wings: a tapered-wing helper — root chord wide, tip chord narrow,
  // tip raised for dihedral, thin at the tip — called for the main wing
  // (low-wing, under the cabin) and the tailplane alike.
  function taperedWing(s, rz, tz, rLE, rTE, rYt, rYb, tLE, tTE, tYt, tYb, color) {
    const rL = [rLE, rYt, s * rz], rT = [rTE, rYt, s * rz];
    const tL = [tLE, tYt, s * tz], tT = [tTE, tYt, s * tz];
    const rbL = [rLE, rYb, s * rz], rbT = [rTE, rYb, s * rz];
    const tbL = [tLE, tYb, s * tz], tbT = [tTE, tYb, s * tz];
    if (s > 0) b.quad(rL, rT, tT, tL, color); else b.quad(rL, tL, tT, rT, color);
    if (s > 0) b.quad(rbL, tbL, tbT, rbT, color); else b.quad(rbL, rbT, tbT, tbL, color);
    if (s > 0) b.quad(rbL, rL, tL, tbL, color); else b.quad(rbL, tbL, tL, rL, color);
    if (s > 0) b.quad(rbT, tbT, tT, rT, color); else b.quad(rbT, rT, tT, tbT, color);
    if (s > 0) b.quad(tL, tT, tbT, tbL, color); else b.quad(tL, tbL, tbT, tT, color);
  }
  // Main wing, low set with dihedral: red to z=±4.3, cream tips outboard
  // (span 9.8 against a 7.5 fuselage, as on a real light plane).
  for (const s of [1, -1]) {
    taperedWing(s, 0.35, 4.3, 0.75, -0.85, -0.20, -0.34, 0.45, -0.62, 0.14, 0.06, RED);
    taperedWing(s, 4.3, 4.9, 0.45, -0.62, 0.14, 0.06, 0.38, -0.58, 0.17, 0.09, CREAM);
    // Navigation lights: red port (+z), green starboard (−z).
    b.box(0.0, 0.13, s * 4.92, 0.12, 0.05, 0.05, s > 0 ? [0.9, 0.1, 0.1] : [0.1, 0.85, 0.25]);
  }
  // Pitot tube under the port wing, landing light in the port leading edge.
  b.box(0.2, -0.38, -1.6, 0.22, 0.03, 0.03, GREY);
  b.box(0.6, -0.15, -3.2, 0.04, 0.08, 0.12, [1, 0.95, 0.8]);
  // Tail: tapered horizontal stabiliser (same helper as the wing) and a
  // swept vertical fin — leading edge raked back, cream tip band, white
  // tail light at the very tip of the cone.
  for (const s of [1, -1]) {
    taperedWing(s, 0.15, 1.35, -2.70, -3.60, 0.22, 0.12, -3.00, -3.70, 0.28, 0.20, RED);
  }
  const fin = { bf: [-2.55, 0.18], bb: [-3.85, 0.18], tf: [-3.15, 1.15], tb: [-3.80, 1.15] };
  for (const s of [1, -1]) {
    const z = s * 0.07;
    if (s > 0) {
      b.quad([fin.bf[0], fin.bf[1], z], [fin.tf[0], fin.tf[1], z], [fin.tb[0], fin.tb[1], z], [fin.bb[0], fin.bb[1], z], RED);
    } else {
      b.quad([fin.bb[0], fin.bb[1], z], [fin.tb[0], fin.tb[1], z], [fin.tf[0], fin.tf[1], z], [fin.bf[0], fin.bf[1], z], RED);
    }
  }
  b.quad([-2.55, 0.18, 0.07], [-2.55, 0.18, -0.07], [-3.15, 1.15, -0.07], [-3.15, 1.15, 0.07], RED);
  b.quad([-3.80, 1.15, 0.07], [-3.80, 1.15, -0.07], [-3.85, 0.18, -0.07], [-3.85, 0.18, 0.07], RED);
  b.quad([-3.15, 1.15, 0.07], [-3.15, 1.15, -0.07], [-3.80, 1.15, -0.07], [-3.80, 1.15, 0.07], RED);
  // Cream tip band on the fin, proud of the surface so it never z-fights.
  for (const s of [1, -1]) {
    const z = s * 0.075;
    const y0 = 0.95, y1 = 1.15;
    const xf0 = -2.55 - (y0 - 0.18) * (0.60 / 0.97), xf1 = -3.15;
    const xb0 = -3.85 + (y0 - 0.18) * (0.05 / 0.97), xb1 = -3.80;
    if (s > 0) b.quad([xf0, y0, z], [xf1, y1, z], [xb1, y1, z], [xb0, y0, z], CREAM);
    else b.quad([xb0, y0, z], [xb1, y1, z], [xf1, y1, z], [xf0, y0, z], CREAM);
  }
  b.box(-3.92, 0.01, 0, 0.06, 0.08, 0.08, [1, 1, 0.95]); // tail light
  // Propeller: two tapered blades with a slight twist and cream tips,
  // plus a four-sided spinner cone — a real prop, not a blur cross.
  // Spinner: tip at x=4.45, square base at x=3.85.
  const spin = [[3.85, 0.24, 0.24], [3.85, 0.24, -0.24], [3.85, -0.24, -0.24], [3.85, -0.24, 0.24]];
  for (let i = 0; i < 4; i++) {
    b.tri([4.45, 0, 0], spin[(i + 1) % 4], spin[i], RED);
  }
  b.quad([3.85, 0.24, 0.24], [3.85, 0.24, -0.24], [3.85, -0.24, -0.24], [3.85, -0.24, 0.24], RED_DARK);
  for (const s of [1, -1]) {
    // One blade from y=0.20*s out to y=1.15*s, chord 0.22 at the root
    // narrowing to 0.14 at the tip, cream from 0.95*s out — short
    // enough that the down blade clears the ground on its gear.
    const blade = (y0, y1, color) => {
      const a = [3.95, y0, 0.11], c = [3.95, y1, 0.07];
      const d = [3.95, y1, -0.07], e = [3.95, y0, -0.11];
      const A = [4.01, y0, 0.11], C = [4.01, y1, 0.11];
      const D = [4.01, y1, -0.03], E = [4.01, y0, -0.11];
      if (s > 0) {
        b.quad(A, E, D, C, color);
        b.quad(a, c, d, e, color);
        b.quad(a, A, C, c, color);
        b.quad(e, d, D, E, color);
      } else {
        b.quad(A, C, D, E, color);
        b.quad(a, e, d, c, color);
        b.quad(a, c, C, A, color);
        b.quad(e, E, D, d, color);
      }
    };
    blade(0.20 * s, 0.95 * s, GREY);
    blade(0.95 * s, 1.15 * s, CREAM);
    // Tip cap of the blade.
    if (s > 0) b.quad([4.01, 1.15, -0.03], [3.95, 1.15, -0.03], [3.95, 1.15, 0.11], [4.01, 1.15, 0.11], CREAM);
    else b.quad([4.01, -1.15, 0.11], [3.95, -1.15, 0.11], [3.95, -1.15, -0.03], [4.01, -1.15, -0.03], CREAM);
  }
  b.box(3.9, 0, 0, 0.18, 0.18, 0.18, RED_DARK); // hub behind the spinner
  // Tricycle gear: a nose leg and two splayed main legs, each wheel in
  // a red spat fairing with the tyre showing below, plus the exhaust
  // stack under the cowling.
  b.box(2.3, -0.85, 0, 0.09, 0.45, 0.09, GREY);
  b.box(2.3, -1.32, 0, 0.26, 0.26, 0.16, [0.1, 0.1, 0.1]);
  b.box(2.3, -1.32, 0, 0.28, 0.13, 0.18, GREY);
  b.box(2.3, -1.18, 0, 0.32, 0.16, 0.13, RED);
  for (const s of [-1, 1]) {
    b.box(0.7, -0.85, s * 0.95, 0.09, 0.42, 0.09, GREY);
    b.box(0.7, -1.35, s * 1.12, 0.26, 0.26, 0.16, [0.1, 0.1, 0.1]);
    b.box(0.7, -1.35, s * 1.12, 0.28, 0.13, 0.18, GREY);
    b.box(0.7, -1.18, s * 1.12, 0.34, 0.18, 0.14, RED);
  }
  b.box(2.9, -0.42, 0.35, 0.18, 0.07, 0.07, [0.12, 0.12, 0.13]);
  return b.data;
}

// The afterburner flame: a small orange cone behind the tail, drawn only
// when the throttle is past 85% and the plane is flying.
export function buildFlameMesh() {
  const b = builder();
  const orange = [1, 0.55, 0.12];
  const yellow = [1, 0.85, 0.3];
  b.pyramid(-6.4, 0, 0, -3.6, 0.55, orange, yellow);
  return b.data;
}

export function freshPlane() {
  const home = FIELDS[0];
  const rad = ((90 - home.heading) * Math.PI) / 180;
  return {
    x: home.x, y: home.elev + 1.6, z: home.z,
    heading: rad, pitch: 0, bank: 0,
    speed: 0, throttle: 0,
    fuel: 100, hull: 100,
    onGround: true, landed: false, crashed: false,
    vspeed: 0, gLoad: 1, aoa: 0,
    propSpin: 0,
  };
}

// ---- flight ---------------------------------------------------------------

// Where the plane is relative to a runway: null when not over one.
export function runwayAt(x, z) {
  for (const f of FIELDS) {
    const rad = ((90 - f.heading) * Math.PI) / 180;
    const dx = Math.cos(rad), dz = -Math.sin(rad);
    const px = -dz, pz = dx;
    const along = dx * (x - f.x) + dz * (z - f.z);
    const across = px * (x - f.x) + pz * (z - f.z);
    // The strip plus a 60 m clearway past each threshold: the flat field
    // around it is still the airfield, and a touchdown just short of the
    // numbers is a landing, not a crash.
    if (Math.abs(along) < f.len / 2 + 60 && Math.abs(across) < f.wid / 2 + 6) {
      return { field: f, along, across };
    }
  }
  return null;
}

export function compassDeg(heading) {
  return (((90 - (heading * 180) / Math.PI) % 360) + 360) % 360;
}

// One fixed physics step. Returns a list of events for the game to score
// and announce: gate passes and landings are detected by main.js, but the
// ground, the stall and the damage live here.
export function stepPlane(p, input, dt) {
  const events = [];
  // Throttle: A/D (or arrows) spool it up and down.
  if (input.throttleUp) p.throttle = clamp(p.throttle + dt * 0.65, 0, 1);
  if (input.throttleDown) p.throttle = clamp(p.throttle - dt * 0.65, 0, 1);
  // Bank: Q/E roll the plane; it levels itself when left alone.
  if (input.bankLeft) p.bank = clamp(p.bank - dt * 1.5, -1.05, 1.05);
  else if (input.bankRight) p.bank = clamp(p.bank + dt * 1.5, -1.05, 1.05);
  else p.bank += (0 - p.bank) * Math.min(1, dt * 0.55);
  // A banked wing turns the nose: coordinated turn, rate from the bank,
  // sharpened a little past real life so the rings stay hittable.
  const flying = !p.onGround;
  if (flying && p.speed > 8) {
    p.heading -= (9.81 * Math.tan(p.bank) / Math.max(p.speed, 12)) * dt * 1.6;
  }
  // Pitch: W/S. The elevator bites in the air, and — once the roll has
  // speed — on the ground too, so the pilot can rotate for takeoff.
  const authority = flying
    ? clamp((p.speed - 12) / 22, 0.15, 1)
    : clamp((p.speed - 15) / 20, 0, 0.6);
  if (input.pitchUp) p.pitch = clamp(p.pitch + dt * 0.55 * authority, -0.6, 0.6);
  if (input.pitchDown) p.pitch = clamp(p.pitch - dt * 0.55 * authority, -0.6, 0.6);
  if (flying && p.speed < STALL_SPEED) {
    // Stall: the nose drops on its own and the plane sinks.
    p.pitch = Math.max(p.pitch - dt * 0.35, -0.45);
    events.push({ type: 'stall' });
  }
  // Speed chases the throttle, climbing bleeds it, diving feeds it.
  const target = p.throttle * MAX_SPEED;
  p.speed += (target - p.speed) * Math.min(1, dt * 0.35);
  p.speed -= 9.81 * Math.sin(p.pitch) * dt * 0.42;
  if (p.onGround) p.speed = Math.max(0, p.speed - dt * 1.2);
  p.speed = clamp(p.speed, 0, 95);
  // Move along the nose.
  const cp = Math.cos(p.pitch), sp = Math.sin(p.pitch);
  const fx = Math.cos(p.heading) * cp;
  const fy = sp;
  const fz = -Math.sin(p.heading) * cp;
  const prevY = p.y;
  p.x += fx * p.speed * dt;
  p.y += fy * p.speed * dt;
  p.z += fz * p.speed * dt;
  if (flying && p.speed < STALL_SPEED) p.y -= (STALL_SPEED - p.speed) * 0.55 * dt;
  p.vspeed = (p.y - prevY) / dt;
  p.gLoad = 1 + Math.abs(Math.tan(p.bank)) * 0.55 + Math.abs(p.pitch) * 0.3;
  p.aoa = (p.pitch * 180) / Math.PI;
  p.propSpin += dt * (4 + p.throttle * 46);
  // Fuel burns with the throttle; empty tanks mean a glider, and the
  // throttle stays shut until a delivery refuels the plane.
  if (p.fuel > 0) {
    p.fuel = Math.max(0, p.fuel - dt * (0.18 + p.throttle * 0.45) * (p.onGround ? 0.35 : 1));
    if (p.fuel <= 0) {
      p.throttle = 0;
      events.push({ type: 'fuelEmpty' });
    }
  } else {
    p.throttle = 0;
  }
  // The ground.
  const groundY = heightAt(p.x, p.z) + 1.6;
  if (p.y <= groundY) {
    p.y = groundY;
    const hitV = p.vspeed;
    const strip = runwayAt(p.x, p.z);
    if (p.onGround) {
      // Rolling: rough ground at speed rattles the airframe.
      if (!strip && p.speed > 34) {
        p.hull = Math.max(0, p.hull - dt * 6);
        events.push({ type: 'rough' });
      }
    } else if (strip && hitV > -7 && p.speed < 62) {
      // Down on the strip: a gentle, level touchdown is soft; arriving
      // banked still lands, but the gear takes a bite out of the hull.
      const banked = Math.abs(p.bank) >= 0.35;
      if (banked) p.hull = Math.max(0, p.hull - 20);
      p.onGround = true;
      p.pitch = 0;
      p.bank = 0;
      p.landed = true;
      events.push({
        type: 'landed',
        field: strip.field,
        soft: hitV > -3.5 && !banked,
        banked,
        vspeed: hitV,
      });
    } else if (hitV > -6 && p.speed < 45) {
      // A survivable belly landing in a field: it costs hull, not the plane.
      p.onGround = true;
      p.pitch = 0;
      p.bank = 0;
      p.hull = Math.max(0, p.hull - 16);
      p.speed *= 0.55;
      events.push({ type: 'roughLanding' });
    } else {
      p.hull = 0;
      p.crashed = true;
      events.push({ type: 'crash', vspeed: hitV });
    }
  }
  // Rotation: enough speed and a pulled nose lifts off the strip.
  if (p.onGround && p.speed > TAKEOFF_SPEED && p.pitch > 0.08 && p.fuel > 0) {
    p.onGround = false;
    p.landed = false;
    events.push({ type: 'takeoff' });
  }
  if (p.hull <= 0 && !p.crashed) {
    p.crashed = true;
    events.push({ type: 'crash', vspeed: p.vspeed });
  }
  return events;
}
