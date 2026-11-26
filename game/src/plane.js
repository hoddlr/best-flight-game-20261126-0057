// The little prop plane: its state and its flight model.
// Throttle feeds speed, pitch steers the nose, lift holds it up only while
// the wing has airspeed. Too slow and it stalls; too fast and turns bite
// less. Fuel burns with throttle; damage comes from hard landings and from
// scraping the ground.

import { PLANE, STEP, STRIPS } from './config.js';
import { groundHeightAt, stripAt } from './world.js';

export function createPlane() {
  return {
    x: STRIPS[0].x,
    y: 0, // set by placeOnRunway
    vx: 0,
    vy: 0,
    angle: 0, // nose direction, radians; 0 = level to the right
    throttle: 0,
    fuel: PLANE.fuelMax,
    damage: 0,
    airborne: false,
    stalled: false,
    propAngle: 0,
    landedStrip: STRIPS[0],
  };
}

/** Put the plane on its home runway, ready for takeoff. */
export function placeOnRunway(plane, world) {
  plane.x = STRIPS[0].x;
  plane.y = groundHeightAt(world, plane.x) - 14;
  plane.vx = 0;
  plane.vy = 0;
  plane.angle = 0;
  plane.throttle = 0;
  plane.fuel = PLANE.fuelMax;
  plane.damage = 0;
  plane.airborne = false;
  plane.stalled = false;
  plane.landedStrip = STRIPS[0];
}

export function speedOf(plane) {
  return Math.hypot(plane.vx, plane.vy);
}

/**
 * One fixed step of flight. `stick` is -1..1 (pull up / push down),
 * `throttleUp` / `throttleDown` are held keys. Returns an event string or
 * null: 'takeoff', 'landed-soft', 'landed-hard', 'crashed', 'out-of-fuel'.
 */
export function stepPlane(plane, world, stick, throttleUp, throttleDown, dt) {
  plane.propAngle += (0.35 + plane.throttle * 1.4) * dt * 12;
  if (throttleUp) plane.throttle = Math.min(1, plane.throttle + PLANE.throttleRate * dt);
  if (throttleDown) plane.throttle = Math.max(0, plane.throttle - PLANE.throttleRate * dt);

  const speed = speedOf(plane);
  const turning = speed > PLANE.maxSpeed ? 0.45 : 1;
  plane.angle += stick * PLANE.pitchRate * turning * dt;
  plane.angle = Math.max(-1.1, Math.min(1.1, plane.angle));

  // Engine thrust along the nose, drag against the motion.
  const thrust = plane.throttle * 300 * (plane.fuel > 0 ? 1 : 0);
  plane.vx += Math.cos(plane.angle) * thrust * dt;
  plane.vy += Math.sin(plane.angle) * thrust * dt;
  const drag = PLANE.drag * speed * speed;
  if (speed > 0.01) {
    plane.vx -= (plane.vx / speed) * drag * dt;
    plane.vy -= (plane.vy / speed) * drag * dt;
  }
  // The wing aligns the velocity with the nose: pitch steers the flight
  // path, so level flight at cruise holds altitude and a nose-down pitch
  // descends. Lift only partly cancels gravity, and the share it cancels
  // grows with airspeed — below stall speed the wing gives up, the nose
  // drops on its own and gravity takes over.
  plane.stalled = plane.airborne && speed < PLANE.stallSpeed;
  if (plane.airborne) {
    const along = plane.vx * Math.cos(plane.angle) + plane.vy * Math.sin(plane.angle);
    const px = plane.vx - along * Math.cos(plane.angle);
    const py = plane.vy - along * Math.sin(plane.angle);
    const align = Math.min(1, 2.4 * dt);
    plane.vx -= px * align;
    plane.vy -= py * align;
    const liftShare = Math.min(1, speed / 200);
    plane.vy += PLANE.gravity * (1 - liftShare) * dt;
    if (plane.stalled) {
      plane.angle = Math.min(0.9, plane.angle + 0.55 * dt);
      plane.vy += PLANE.gravity * 0.5 * dt;
    }
  }
  // Gentle speed ceiling so the prop cannot run away downhill.
  const capped = Math.min(speedOf(plane), PLANE.maxSpeed + 60);
  const now = speedOf(plane);
  if (now > 0.01) {
    plane.vx = (plane.vx / now) * capped;
    plane.vy = (plane.vy / now) * capped;
  }

  plane.x += plane.vx * dt;
  plane.y += plane.vy * dt;
  plane.fuel = Math.max(0, plane.fuel - plane.throttle * PLANE.fuelBurn * dt);

  const ground = groundHeightAt(world, plane.x);
  const strip = stripAt(plane.x);
  // Takeoff: rolling fast enough with the nose up leaves the ground.
  if (!plane.airborne && speedOf(plane) > 130 && plane.angle < -0.12) {
    plane.airborne = true;
    return 'takeoff';
  }
  if (plane.airborne && plane.y + 14 >= ground) {
    const sink = plane.vy;
    plane.y = ground - 14;
    plane.vy = 0;
    plane.vx *= 0.55;
    plane.airborne = false;
    plane.angle = 0;
    if (!strip) {
      plane.damage = 100;
      return 'crashed';
    }
    plane.landedStrip = strip;
    if (sink > 150) {
      plane.damage += PLANE.hardLandingDamage;
      if (plane.damage >= 100) return 'crashed';
      return 'landed-hard';
    }
    return sink > 60 ? 'landed-hard' : 'landed-soft';
  }
  if (!plane.airborne && plane.y + 14 >= ground) {
    // Rolling on the ground: wheels stay on it. Off the runway the grass
    // drags hard, and arriving there fast wrecks the undercarriage.
    plane.y = ground - 14;
    plane.vy = 0;
    if (!strip) {
      plane.vx *= Math.max(0, 1 - 2.2 * dt);
      if (speedOf(plane) > 100) {
        plane.damage = 100;
        return 'crashed';
      }
    }
  }
  if (plane.fuel <= 0 && plane.airborne) return 'out-of-fuel';
  if (plane.x < 60) { plane.x = 60; plane.vx = Math.max(0, plane.vx); }
  return null;
}

/** Damage while the belly scrapes along the ground at speed. */
export function scrapeDamage(plane, dt) {
  plane.damage = Math.min(100, plane.damage + PLANE.scrapeDamage * dt);
  return plane.damage >= 100;
}
