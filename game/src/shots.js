// Screenshot poses behind ?shot=start|fly|land|end (with &seed=N).
// Each pose plays the real flight model forward from a fresh runway start,
// steered by a small autopilot that chases the next ring and then the next
// runway, and snapshots the state at a chosen moment — so every frame is
// what a real sortie looks like and the same seed always gives the same
// frame. The 'end' pose flies the same route with a careless pilot who
// forgets the throttle, stalls, and comes down in the hills.

import { STEP } from './config.js';
import { groundHeightAt, resetRings } from './world.js';
import { cameraFor, SCREEN_DONE, SCREEN_FLY, SCREEN_OVER, SCREEN_TITLE } from './render.js';
import { createPlane, placeOnRunway, speedOf, stepPlane } from './plane.js';

const FLY_SECONDS = 16;
const LAND_SECONDS = 40;
const END_SECONDS = 30;

function snapshotPlane(plane) {
  return {
    x: plane.x, y: plane.y, vx: plane.vx, vy: plane.vy,
    angle: plane.angle, throttle: plane.throttle, fuel: plane.fuel,
    damage: plane.damage, airborne: plane.airborne, stalled: plane.stalled,
    propAngle: plane.propAngle, landedStrip: plane.landedStrip,
  };
}

/** Steer toward a point: returns { stick, throttleUp, throttleDown }. */
function steerToward(plane, tx, ty, cruise) {
  const desired = Math.max(-0.55, Math.min(0.55, Math.atan2(ty - plane.y, tx - plane.x)));
  const diff = desired - plane.angle;
  const stick = Math.max(-1, Math.min(1, diff * 2.5));
  const speed = speedOf(plane);
  return {
    stick,
    throttleUp: speed < cruise,
    throttleDown: speed > cruise + 30,
  };
}

function nextTarget(world, plane) {
  for (const ring of world.rings) {
    if (!ring.taken && ring.leg === 0) return { x: ring.x, y: ring.y };
  }
  return { x: 3200, y: groundHeightAt(world, 3200) - 120 };
}

/** Run the model forward, snapshotting at the given times (seconds). */
function simulate(world, seconds, pilot, takeAt) {
  const plane = createPlane();
  placeOnRunway(plane, world);
  resetRings(world);
  let score = 0;
  let lastLandingAt = -99;
  let crashed = false;
  const snaps = {};
  const total = Math.round(seconds / STEP);
  for (let i = 0; i < total; i += 1) {
    const t = i * STEP;
    const control = pilot(plane, t);
    const event = stepPlane(plane, world, control.stick, control.throttleUp, control.throttleDown, STEP);
    for (const ring of world.rings) {
      if (ring.taken || ring.leg !== 0) continue;
      const dx = plane.x - ring.x;
      const dy = plane.y - ring.y;
      if (dx * dx + dy * dy < 46 * 46) {
        ring.taken = true;
        score += 50;
      }
    }
    // One soft-landing bonus per real arrival, as in the live game.
    if (event === 'landed-soft' && t - lastLandingAt > 10) {
      score += 120;
      lastLandingAt = t;
    }
    if (event === 'crashed') crashed = true;
    for (const mark of takeAt) {
      if (Math.abs(t - mark.at) < STEP / 2) {
        snaps[mark.name] = { plane: snapshotPlane(plane), score, crashed, ringsTaken: world.rings.filter((r) => r.taken).length };
      }
    }
    if (crashed && !takeAt.some((m) => m.at > t)) break;
  }
  return { plane, score, crashed, snaps };
}

function carefulPilot(world) {
  return (plane) => {
    if (!plane.airborne && speedOf(plane) < 140) return { stick: 0, throttleUp: true, throttleDown: false };
    if (!plane.airborne) return { stick: -1, throttleUp: true, throttleDown: false };
    const target = nextTarget(world, plane);
    return steerToward(plane, target.x, target.y, 220);
  };
}

function carelessPilot() {
  return (plane, t) => {
    if (!plane.airborne && speedOf(plane) < 140) return { stick: 0, throttleUp: true, throttleDown: false };
    if (!plane.airborne) return { stick: -1, throttleUp: true, throttleDown: false };
    if (t > 6) return { stick: 1, throttleUp: false, throttleDown: true };
    return { stick: 0, throttleUp: true, throttleDown: false };
  };
}

export function stageShot(name, world, plane) {
  if (name === 'start') {
    placeOnRunway(plane, world);
    resetRings(world);
    return {
      plane, cameraX: cameraFor(plane.x), screen: SCREEN_TITLE,
      score: 0, mission: 'Deliver parcel 1 of 3 → Riverbend',
      message: '', time: 0, particles: [],
    };
  }
  if (name === 'fly') {
    const run = simulate(world, FLY_SECONDS, carefulPilot(world), [{ name: 'fly', at: FLY_SECONDS - 0.05 }]);
    const snap = run.snaps.fly;
    Object.assign(plane, snap.plane);
    return {
      plane, cameraX: cameraFor(plane.x), screen: SCREEN_FLY,
      score: snap.score, mission: 'Deliver parcel 1 of 3 → Riverbend',
      message: snap.ringsTaken > 0 ? 'Ring! +50' : '', time: FLY_SECONDS, particles: [],
    };
  }
  if (name === 'land') {
    // The approach: start the plane in the air west of Riverbend, on a
    // gentle descent toward the strip, and let the real flight model fly
    // it down. Snapshot the moment it settles — or the last approach
    // frame if it is still gliding in.
    const approach = createPlane();
    placeOnRunway(approach, world);
    resetRings(world);
    approach.x = 2450;
    approach.y = groundHeightAt(world, 2450) - 260;
    approach.vx = 190;
    approach.vy = 18;
    approach.angle = 0.08;
    approach.throttle = 0.45;
    approach.fuel = 78;
    approach.airborne = true;
    let score = 200; // the four rings of leg one, already flown
    let landed = false;
    let snap = snapshotPlane(approach);
    const total = Math.round(14 / STEP);
    for (let i = 0; i < total && !landed; i += 1) {
      const dist = 3200 - approach.x;
      const targetY = groundHeightAt(world, 3200) - (dist > 350 ? 150 : 22);
      const control = steerToward(approach, 3200, targetY, dist > 350 ? 185 : 150);
      const event = stepPlane(approach, world, control.stick, control.throttleUp, control.throttleDown, STEP);
      snap = snapshotPlane(approach);
      if (event === 'landed-soft') {
        score += 120;
        landed = true;
      }
      if (event === 'crashed') break;
    }
    Object.assign(plane, snap);
    return {
      plane, cameraX: cameraFor(plane.x), screen: SCREEN_FLY,
      score, mission: 'Deliver parcel 1 of 3 → Riverbend',
      message: landed ? 'Soft landing! +120' : 'Riverbend ahead — ease off and settle onto the strip',
      time: 14, particles: [],
    };
  }
  // 'end': the careless pilot stalls into the hills.
  const run = simulate(world, END_SECONDS, carelessPilot(), [{ name: 'end', at: END_SECONDS - 0.05 }]);
  const snap = run.snaps.end;
  Object.assign(plane, snap.plane);
  return {
    plane, cameraX: cameraFor(plane.x),
    screen: run.crashed ? SCREEN_OVER : SCREEN_FLY,
    score: snap.score, mission: 'Deliver parcel 1 of 3 → Riverbend',
    message: '', time: END_SECONDS, particles: [],
  };
}
