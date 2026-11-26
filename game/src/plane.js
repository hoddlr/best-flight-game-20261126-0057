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
  // Fuselage: a long tapered box, cream belly, red back.
  b.box(0, 0, 0, 3.4, 0.85, 0.85, RED, {
    top: RED, bottom: CREAM, front: RED_DARK, back: RED_DARK,
  });
  b.box(3.2, 0.1, 0, 0.7, 0.6, 0.6, RED_DARK); // nose cap
  // Canopy: a glass slab on top, just behind the nose.
  b.slab(0.9, 2.1, 0.75, 1.25, -0.55, 0.55, GLASS);
  // Main wing: wide slab through the middle, cream tips.
  b.slab(-0.6, 0.6, -0.12, 0.12, -5.6, 5.6, RED);
  b.slab(-0.6, 0.6, -0.12, 0.12, -5.6, -4.7, CREAM);
  b.slab(-0.6, 0.6, -0.12, 0.12, 4.7, 5.6, CREAM);
  // Tail: horizontal stabiliser and a tall red fin.
  b.slab(-3.4, -2.6, -0.05, 0.15, -2.1, 2.1, RED);
  b.slab(-3.5, -2.7, 0.6, 1.9, -0.14, 0.14, RED);
  // Propeller: a thin dark disc at the nose, spun in the render loop by
  // scaling it — the mesh itself is a flat cross that reads as a blur.
  b.slab(3.95, 4.05, -1.5, 1.5, -0.09, 0.09, GREY);
  b.slab(3.95, 4.05, -0.09, 0.09, -1.5, 1.5, GREY);
  b.box(4.0, 0, 0, 0.3, 0.3, 0.3, GREY); // spinner hub
  // Fixed gear: two little legs with wheels, so the plane sits on strips.
  for (const s of [-1, 1]) {
    b.box(0.9, -1.15, s * 1.1, 0.12, 0.35, 0.12, GREY);
    b.box(0.9, -1.5, s * 1.1, 0.32, 0.32, 0.22, [0.1, 0.1, 0.1]);
  }
  b.box(-2.6, -1.05, 0, 0.1, 0.3, 0.1, GREY);
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
