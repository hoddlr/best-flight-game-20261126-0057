// Sky Courier: boot and the one loop. Input is read every frame, the world
// advances in fixed 1/60 s steps, and the renderer paints what is there.
// Screens: title, fly, paused, over, done. Missions run in order: fly the
// rings to the next strip, land soft, pick up the next parcel, repeat until
// all three parcels are delivered at High Pass.
//
// ?seed=N fixes the valley. ?shot=start|fly|land|end stages that scene
// instead of running the loop, paints it twice and sets window.__shotReady.

import { BEST_KEY, STEP } from './config.js';
import { createRandom } from './random.js';
import { createWorld, groundHeightAt, resetRings, stripAt } from './world.js';
import { createPlane, placeOnRunway, speedOf, stepPlane } from './plane.js';
import { ACTION_CONFIRM, ACTION_MUTE, ACTION_PAUSE, createInput, takeActions, takeClick } from './input.js';
import { cameraFor, createRenderer, SCREEN_DONE, SCREEN_FLY, SCREEN_OVER, SCREEN_PAUSED, SCREEN_TITLE } from './render.js';
import { stageShot } from './shots.js';

const MAX_FRAME = 0.25;
const STRIP_NAMES = ['Home Field', 'Riverbend', 'Mill Town', 'High Pass'];

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : 7;

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const world = createWorld(createRandom(seed));
const renderer = createRenderer(canvas);
const plane = createPlane();
placeOnRunway(plane, world);

let screen = SCREEN_TITLE;
let score = 0;
let lastLandingScoreAt = -99;
let best = readBest();
let leg = 0; // which strip the next parcel goes to (1, 2, 3)
let mission = 'Take off from Home Field';
let message = '';
let messageUntil = 0;
let particles = [];
let muted = false;
let audio = null;
let time = 0;

function readBest() {
  try {
    return Number.parseInt(window.localStorage.getItem(BEST_KEY) ?? '0', 10) || 0;
  } catch {
    return 0;
  }
}

function saveBest(value) {
  try {
    window.localStorage.setItem(BEST_KEY, String(value));
  } catch {
    // Storage can be off: the best score then lasts this visit only.
  }
}

function showMessage(text, seconds) {
  message = text;
  messageUntil = time + seconds;
}

function missionText() {
  if (leg >= 3) return 'All parcels delivered!';
  return `Deliver parcel ${leg + 1} of 3 → ${STRIP_NAMES[leg + 1]}`;
}

/** A soft landing on the strip the parcel is bound for. */
function deliverIfDue() {
  if (leg >= 3) return false;
  const strip = plane.landedStrip;
  if (!strip || strip.name !== STRIP_NAMES[leg + 1]) return false;
  leg += 1;
  score += 300;
  plane.fuel = Math.min(100, plane.fuel + 34);
  plane.damage = Math.max(0, plane.damage - 15);
  showMessage(`Parcel ${leg} of 3 delivered! +300  •  fuel topped up`, 3.5);
  burst(plane.x, plane.y - 30, '#ffd94a', 26);
  if (leg >= 3) {
    screen = SCREEN_DONE;
    finishRun();
  } else {
    mission = missionText();
  }
  return true;
}

function finishRun() {
  if (score > best) {
    best = score;
    saveBest(best);
  }
}

function burst(x, y, colour, count) {
  for (let i = 0; i < count; i += 1) {
    const a = Math.random() * Math.PI * 2;
    const sp = 40 + Math.random() * 160;
    particles.push({
      x, y,
      vx: Math.cos(a) * sp,
      vy: Math.sin(a) * sp - 40,
      life: 0.7 + Math.random() * 0.5,
      maxLife: 1.2,
      colour,
    });
  }
}

/** Procedural engine hum: two detuned oscillators through a low-pass
 * filter, pitch following throttle. No audio files, no network. */
function ensureAudio() {
  if (muted || audio) return;
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.value = 70;
    const osc2 = ctx.createOscillator();
    osc2.type = 'square';
    osc2.frequency.value = 35;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 320;
    const gain = ctx.createGain();
    gain.gain.value = 0.0;
    osc.connect(filter);
    osc2.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc2.start();
    audio = { ctx, osc, osc2, gain };
  } catch {
    audio = null;
  }
}

function updateAudio() {
  if (!audio) return;
  const target = screen === SCREEN_FLY && plane.airborne ? 0.05 + plane.throttle * 0.05 : 0.0;
  audio.gain.gain.setTargetAtTime(target, audio.ctx.currentTime, 0.1);
  audio.osc.frequency.setTargetAtTime(60 + plane.throttle * 90, audio.ctx.currentTime, 0.1);
  audio.osc2.frequency.setTargetAtTime(30 + plane.throttle * 45, audio.ctx.currentTime, 0.1);
}

function resetRun() {
  placeOnRunway(plane, world);
  resetRings(world);
  score = 0;
  lastLandingScoreAt = -99;
  leg = 0;
  particles = [];
  mission = missionText();
  showMessage('Parcel 1 of 3 → Riverbend. Follow the gold rings!', 4);
}

function stepGame(input, dt) {
  time += dt;
  const actions = takeActions(input);
  if (actions & ACTION_MUTE) {
    muted = !muted;
    if (muted && audio) audio.gain.gain.value = 0;
    showMessage(muted ? 'Sound off (M to turn back on)' : 'Sound on', 2);
  }
  if (screen === SCREEN_TITLE) {
    if (actions & ACTION_CONFIRM) {
      ensureAudio();
      resetRun();
      screen = SCREEN_FLY;
    }
    return;
  }
  if (screen === SCREEN_PAUSED) {
    if (actions & ACTION_PAUSE || actions & ACTION_CONFIRM) screen = SCREEN_FLY;
    return;
  }
  if (screen === SCREEN_OVER || screen === SCREEN_DONE) {
    if (actions & ACTION_CONFIRM) {
      resetRun();
      screen = SCREEN_FLY;
    }
    return;
  }
  // Flying.
  if (actions & ACTION_PAUSE) {
    screen = SCREEN_PAUSED;
    return;
  }
  const stick = (input.pitchUp ? -1 : 0) + (input.pitchDown ? 1 : 0);
  const event = stepPlane(plane, world, stick, input.throttleUp, input.throttleDown, dt);
  // Rings: flying through one scores and puffs gold.
  for (const ring of world.rings) {
    if (ring.taken || ring.leg !== leg) continue;
    const dx = plane.x - ring.x;
    const dy = plane.y - ring.y;
    if (dx * dx + dy * dy < 46 * 46) {
      ring.taken = true;
      score += 50;
      burst(ring.x, ring.y, '#ffd94a', 14);
      showMessage('Ring! +50', 1.2);
    }
  }
  // Dust while rolling, smoke while damaged.
  if (!plane.airborne && speedOf(plane) > 40 && Math.random() < 0.4) {
    particles.push({ x: plane.x - 30, y: plane.y + 10, vx: -30, vy: -20, life: 0.5, maxLife: 0.5, colour: '#c8b898' });
  }
  if (plane.damage > 50 && Math.random() < 0.3) {
    particles.push({ x: plane.x - 20, y: plane.y - 6, vx: -20, vy: -50, life: 0.8, maxLife: 0.8, colour: '#888888' });
  }
  for (const p of particles) {
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vy += 60 * dt;
    p.life -= dt;
  }
  particles = particles.filter((p) => p.life > 0);
  if (message && time > messageUntil) message = '';
  updateAudio();
  if (!event) return;
  if (event === 'takeoff') {
    showMessage('Airborne! Mind your speed — too slow and you stall.', 3);
  } else if (event === 'landed-soft') {
    // One soft-landing bonus per real arrival: bouncing along the strip
    // must not farm points.
    if (time - lastLandingScoreAt > 10) {
      score += 120;
      lastLandingScoreAt = time;
      showMessage('Soft landing! +120', 2.5);
    }
    burst(plane.x, plane.y - 10, '#37d67a', 16);
    deliverIfDue();
  } else if (event === 'landed-hard') {
    showMessage(`Hard landing — airframe damage ${Math.round(plane.damage)}%`, 2.5);
    burst(plane.x, plane.y - 10, '#ff6a5a', 16);
    deliverIfDue();
  } else if (event === 'out-of-fuel') {
    showMessage('Fuel empty! Glide down and land to refuel.', 3);
  } else if (event === 'crashed') {
    burst(plane.x, plane.y - 10, '#ff6a5a', 40);
    burst(plane.x, plane.y - 10, '#555555', 24);
    screen = SCREEN_OVER;
    finishRun();
  }
}

function runShot(name) {
  const scene = stageShot(name, world, plane);
  let painted = 0;
  function paint() {
    renderer.draw({
      world,
      plane: scene.plane,
      cameraX: scene.cameraX,
      screen: scene.screen,
      score: scene.score,
      mission: scene.mission,
      message: scene.message,
      time: scene.time,
      particles: scene.particles,
    });
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas);
  let accumulator = 0;
  let last = performance.now();
  function frame(now) {
    const elapsed = Math.min(MAX_FRAME, (now - last) / 1000);
    last = now;
    accumulator += elapsed;
    while (accumulator >= STEP) {
      stepGame(input, STEP);
      accumulator -= STEP;
    }
    const view = {
      world,
      plane,
      cameraX: cameraFor(plane.x),
      screen,
      score: screen === SCREEN_TITLE ? best : score,
      mission,
      message,
      time,
      particles,
    };
    renderer.draw(view);
    status.textContent = `Sky Courier — ${mission}. Score ${score}.`;
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
