// main.js — Sky Courier: SORTIE 01. A 3D low-poly prop-plane delivery game
// in raw WebGL: no library, no CDN, no network. The plane flies a golden
// valley at sunset, threads six numbered neon gates and delivers three
// parcels, one leg at a time, to the airstrips Home Field, Riverbend,
// Mill Town and High Pass. Physics runs on a fixed 60 Hz step; the world
// is seeded, so every run grows the same valley.

import { matPerspective, matLookAt, matFromPose, matTranslate, matScale, matMultiply, matRotateY } from './mat.js';
import { makeProgram, uploadMesh, drawMesh } from './glx.js';
import { buildWorld, buildGates, heightAt, FIELDS, gateMeshArrays } from './world.js';
import { buildPlaneMesh, buildFlameMesh, freshPlane, stepPlane, runwayAt } from './plane.js';
import { makeInput } from './input.js';
import { makeAudio } from './audio.js';
import { drawHud } from './hud.js';
import { clamp } from './seed.js';

const canvas = document.getElementById('game');
const statusEl = document.getElementById('status');
const gl = canvas.getContext('webgl', { antialias: true, alpha: false });
if (!gl) {
  document.body.textContent = 'Sky Courier needs WebGL, which this browser did not offer.';
  throw new Error('no webgl');
}
const hudCanvas = document.createElement('canvas');
hudCanvas.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;pointer-events:none;';
document.body.appendChild(hudCanvas);
const hud = hudCanvas.getContext('2d');

const prog = makeProgram(gl);
gl.useProgram(prog.prog);
gl.enable(gl.DEPTH_TEST);
gl.clearColor(0.98, 0.62, 0.28, 1);
const SUN_DIR = [-0.82, 0.34, -0.2];
const FOG_COLOR = [0.94, 0.6, 0.34];

const world = buildWorld(gl, (arrays) => uploadMesh(gl, arrays));
const planeMesh = uploadMesh(gl, buildPlaneMesh());
const flameMesh = uploadMesh(gl, buildFlameMesh());
const gateMeshes = new Map(); // gate number -> {next, later, done} meshes
for (const g of world.gates) {
  gateMeshes.set(g.n, {
    next: uploadMesh(gl, gateMeshArrays(g, [0.25, 0.9, 1])),
    later: uploadMesh(gl, gateMeshArrays(g, [1, 0.62, 0.18])),
    done: uploadMesh(gl, gateMeshArrays(g, [0.35, 0.85, 0.5])),
  });
}
const identity = new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);

const input = makeInput();
const audio = makeAudio();

function freshGame() {
  return {
    state: 'menu',
    plane: freshPlane(),
    gates: buildGates(),
    leg: 0, // 0: Home->Riverbend, 1: ->Mill Town, 2: ->High Pass
    score: 0,
    delivered: 0,
    rings: 0,
    softLandings: 0,
    msg: '', sub: '', msgAge: 99, msgColor: '#ffb347',
    crashWhy: '',
    muted: false,
    time: 0,
    camPos: null,
    stallBeepAt: -9,
    finalField: 'HIGH PASS',
    finalX: FIELDS[3].x,
    finalZ: FIELDS[3].z,
  };
}
let S = freshGame();

function announce(msg, sub, color) {
  S.msg = msg;
  S.sub = sub || '';
  S.msgAge = 0;
  S.msgColor = color || '#ffb347';
  if (statusEl) statusEl.textContent = msg + (sub ? ' ' + sub : '');
}

// ---- mission --------------------------------------------------------------

function nextGate() {
  // Gates belong to legs, two each: the next unpassed gate of this leg.
  // When the leg's pair is done the answer is null — time to land.
  const first = S.leg * 2 + 1;
  for (const g of S.gates) {
    if (g.n >= first && g.n <= first + 1 && !g.passed) return g;
  }
  return null;
}

function legDestField() {
  return FIELDS[S.leg + 1];
}

function handleEvents(events) {
  const p = S.plane;
  for (const e of events) {
    if (e.type === 'stall') {
      if (S.time - S.stallBeepAt > 0.9) {
        S.stallBeepAt = S.time;
        audio.stallWarn();
        announce('STALL — NOSE DOWN, ADD POWER', '', '#e5484d');
      }
    } else if (e.type === 'fuelEmpty') {
      announce('FUEL EMPTY — GLIDE HER IN', '', '#e5484d');
    } else if (e.type === 'takeoff') {
      announce('AIRBORNE', 'Gear up — fly the gates', '#39d5e8');
      audio.land();
    } else if (e.type === 'landed') {
      const g = nextGate();
      const dest = legDestField();
      if (e.field === dest && !g) {
        // Parcel delivered: refuel, next leg, or the sortie is done.
        S.delivered++;
        S.score += 300;
        if (e.soft) {
          S.score += 120;
          S.softLandings++;
        }
        p.fuel = 100;
        audio.deliver();
        if (S.leg >= 2) {
          S.state = 'done';
          announce('SORTIE COMPLETE', '', '#ffb347');
        } else {
          S.leg++;
          const next = legDestField();
          announce(`PARCEL DELIVERED +300`, e.soft ? `Soft landing +120 · refuelled — next: ${next.name}` : `Refuelled — next: ${next.name}`, '#58d68d');
        }
      } else if (e.field === dest) {
        announce('WRONG TIME TO LAND', 'Fly the remaining gates first', '#e5484d');
        p.hull = Math.max(0, p.hull - 5);
      } else {
        // A stop at a strip that is not this leg's destination.
        if (e.soft) {
          S.score += 120;
          S.softLandings++;
          announce('SOFT LANDING +120', 'Not your delivery strip — take off again');
        } else {
          announce('LANDED', 'Not your delivery strip — take off again');
        }
        audio.land();
      }
    } else if (e.type === 'roughLanding') {
      audio.thud();
      announce('ROUGH FIELD LANDING — HULL -16', '', '#e5484d');
    } else if (e.type === 'crash') {
      p.crashed = true;
      S.state = 'crash';
      audio.thud();
      S.crashWhy = e.vspeed < -14
        ? `Came down at ${Math.round(-e.vspeed * 196.85)} FPM into the ground.`
        : p.fuel <= 0
          ? 'Out of fuel over the valley — she glided as far as she could.'
          : 'The airframe gave out.';
    }
  }
}

function checkGatePass() {
  const g = nextGate();
  if (!g || S.plane.onGround) return;
  const d = Math.hypot(g.x - S.plane.x, g.y - S.plane.y, g.z - S.plane.z);
  if (d < g.radius + 3) {
    g.passed = true;
    S.rings++;
    S.score += 50;
    audio.gate();
    const more = nextGate();
    announce(`GATE ${g.n} CLEAR +50`, more ? `Next: gate ${more.n} → ${more.dest}` : `All gates clear — land at ${legDestField().name}`, '#39d5e8');
  }
}

// ---- view -----------------------------------------------------------------

function resize() {
  const w = window.innerWidth, h = window.innerHeight;
  canvas.width = w;
  canvas.height = h;
  hudCanvas.width = w;
  hudCanvas.height = h;
  gl.viewport(0, 0, w, h);
}
window.addEventListener('resize', resize);
resize();

function cameraFor(p, dt) {
  // Chase camera: behind and above the tail, eased toward its target so it
  // never snaps, and always looking a little ahead of the nose.
  const back = 13 + p.speed * 0.08;
  const up = 4.5 + p.speed * 0.02;
  const cy = Math.cos(p.heading), sy = Math.sin(p.heading);
  const tx = p.x - cy * back;
  const ty = p.y + up + Math.sin(p.pitch) * 3;
  const tz = p.z + sy * back;
  if (!S.camPos) S.camPos = [tx, ty, tz];
  const k = Math.min(1, dt * 4.5);
  S.camPos[0] += (tx - S.camPos[0]) * k;
  S.camPos[1] += (ty - S.camPos[1]) * k;
  S.camPos[2] += (tz - S.camPos[2]) * k;
  const look = [
    p.x + Math.cos(p.heading) * 26,
    p.y + Math.sin(p.pitch) * 10,
    p.z - Math.sin(p.heading) * 26,
  ];
  return { eye: S.camPos, look };
}

// ---- render + loop ----------------------------------------------------------

function render(now) {
  const w = canvas.width, h = canvas.height;
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
  const proj = matPerspective((62 * Math.PI) / 180, w / h, 0.5, 9000);
  gl.uniformMatrix4fv(prog.uProj, false, proj);
  gl.uniform3fv(prog.uSunDir, SUN_DIR);
  gl.uniform3fv(prog.uFogColor, FOG_COLOR);
  const p = S.plane;
  let view;
  if (S.state === 'fly' || S.state === 'pause') {
    const cam = cameraFor(p, 1 / 60);
    view = matLookAt(cam.eye, cam.look, [0, 1, 0]);
  } else {
    // Menu, crash and done: a slow orbit around the plane on its strip,
    // pulled back far enough to show the valley behind it.
    const a = now * 0.00012;
    const eye = [p.x + Math.cos(a) * 46, p.y + 18, p.z + Math.sin(a) * 46];
    view = matLookAt(eye, [p.x, p.y + 1, p.z], [0, 1, 0]);
    S.camPos = null;
  }
  gl.uniformMatrix4fv(prog.uView, false, view);
  // Sky and sun sit far away: fog must not swallow them.
  gl.uniform2fv(prog.uFogRange, [6500, 8800]);
  drawMesh(gl, prog, world.sky, identity, true);
  drawMesh(gl, prog, world.sun, identity, true);
  gl.uniform2fv(prog.uFogRange, [260, 2400]);
  drawMesh(gl, prog, world.terrain, identity, false);
  drawMesh(gl, prog, world.strips, identity, false);
  drawMesh(gl, prog, world.forest, identity, false);
  // Gates: the next one burns cyan, later ones amber, passed ones green.
  const next = nextGate();
  for (const g of S.gates) {
    const set = gateMeshes.get(g.n);
    const mesh = g.passed ? set.done : g === next ? set.next : set.later;
    drawMesh(gl, prog, mesh, identity, true);
  }
  // The plane.
  const pose = matFromPose(p.x, p.y, p.z, p.heading, p.pitch, p.bank);
  drawMesh(gl, prog, planeMesh, pose, false);
  // Afterburner glow at high throttle.
  if (p.throttle > 0.85 && !p.onGround) {
    const flick = 1 + 0.22 * Math.sin(now * 0.045) + 0.1 * Math.sin(now * 0.11);
    const flameModel = matMultiply(pose, matScale(flick, 1, 1));
    drawMesh(gl, prog, flameMesh, flameModel, true);
  }
  // HUD.
  hud.clearRect(0, 0, w, h);
  S.nextGate = next;
  // The objective line's destination is this leg's strip, not always the
  // final one: after a leg's gates are done the HUD must name the strip
  // the parcel is actually going to.
  const destField = legDestField();
  S.finalField = destField.name;
  S.finalX = destField.x;
  S.finalZ = destField.z;
  drawHud(hud, w, h, S);
}

let last = performance.now();
let acc = 0;
const STEP = 1 / 60;

function frame(now) {
  requestAnimationFrame(frame);
  const dtMs = Math.min(100, now - last);
  last = now;
  S.time += dtMs / 1000;
  S.msgAge += dtMs / 1000;
  // Edge-triggered keys.
  if (input.wasPressed('Space')) {
    audio.unlock();
    if (S.state === 'menu' || S.state === 'crash' || S.state === 'done') {
      const muted = S.muted;
      S = freshGame();
      S.muted = muted;
      S.state = 'fly';
      announce('SORTIE 01 — DELIVER PARCEL 1', 'Home Field → Riverbend · gates 1–2', '#39d5e8');
    } else if (S.state === 'pause') {
      const muted = S.muted;
      S = freshGame();
      S.muted = muted;
      S.state = 'fly';
    }
  }
  if (input.wasPressed('KeyP') || input.wasPressed('Escape')) {
    if (S.state === 'fly') S.state = 'pause';
    else if (S.state === 'pause') S.state = 'fly';
  }
  if (input.wasPressed('KeyM')) {
    S.muted = audio.toggleMute();
  }
  if (S.state === 'fly') {
    acc += dtMs / 1000;
    let n = 0;
    while (acc >= STEP && n < 5) {
      const events = stepPlane(S.plane, input.state(), STEP);
      handleEvents(events);
      checkGatePass();
      acc -= STEP;
      n++;
    }
    if (n === 5) acc = 0;
    audio.update(S.plane.throttle, S.plane.speed, S.plane.speed < 26 && !S.plane.onGround);
  }
  render(now);
  input.endFrame();
}

// A small handle for automated play-tests: state, score and position.
window.__skyCourier = {
  get state() { return S.state; },
  get score() { return S.score; },
  get rings() { return S.rings; },
  get delivered() { return S.delivered; },
  get fuel() { return S.plane.fuel; },
  get hull() { return S.plane.hull; },
  get speed() { return S.plane.speed; },
  get pos() { return [S.plane.x, S.plane.y, S.plane.z]; },
  get leg() { return S.leg; },
  get heading() { return S.plane.heading; },
  get pitch() { return S.plane.pitch; },
  get bank() { return S.plane.bank; },
  get onGround() { return S.plane.onGround; },
  get throttle() { return S.plane.throttle; },
  get nextGate() {
    const g = nextGate();
    return g ? { n: g.n, x: g.x, y: g.y, z: g.z, dest: g.dest } : null;
  },
  get dest() {
    const f = legDestField();
    return { name: f.name, x: f.x, y: f.elev, z: f.z, heading: f.heading };
  },
};

announce('', '');
requestAnimationFrame(frame);
