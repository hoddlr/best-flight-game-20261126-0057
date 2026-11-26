// Everything the pilot sees: sky, parallax mountains, the valley floor with
// its fields, river, towns and runways, the little red prop plane, the gold
// rings, the particles, and the instrument HUD. One logical 1280x720 field,
// scaled to the canvas.

import { COLOURS, FIELD, STRIPS } from './config.js';
import { groundHeightAt, stripAt } from './world.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_FLY = 'fly';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_OVER = 'over';
export const SCREEN_DONE = 'done';

const PLANE_SCALE = 1;

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  function fit() {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = FIELD.width * dpr;
    canvas.height = FIELD.height * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  fit();
  window.addEventListener('resize', fit);
  return { draw: (view) => drawScene(ctx, view) };
}

/** Camera x so the plane sits a third across the screen, clamped to the valley. */
export function cameraFor(planeX) {
  const max = 9600 - FIELD.width;
  return Math.max(0, Math.min(max, planeX - FIELD.width * 0.32));
}

function drawScene(ctx, view) {
  const { world, plane, cameraX, screen, score, mission, message, time } = view;
  drawSky(ctx, cameraX, time);
  drawMountains(ctx, world, cameraX);
  drawValley(ctx, world, cameraX);
  drawRunways(ctx, cameraX);
  drawRings(ctx, world, cameraX);
  if (view.particles) drawParticles(ctx, view.particles, cameraX);
  drawPlane(ctx, plane, cameraX);
  drawHud(ctx, plane, score, mission, cameraX);
  if (message) drawToast(ctx, message);
  if (screen === SCREEN_TITLE) drawTitle(ctx, score);
  if (screen === SCREEN_PAUSED) drawPaused(ctx);
  if (screen === SCREEN_OVER) drawEnd(ctx, 'CRASHED', 'The little red plane is down.', score, false);
  if (screen === SCREEN_DONE) drawEnd(ctx, 'ALL DELIVERIES DONE', 'Three parcels, three airstrips, one happy valley.', score, true);
}

function drawSky(ctx, cameraX, time) {
  const g = ctx.createLinearGradient(0, 0, 0, FIELD.height);
  g.addColorStop(0, COLOURS.skyTop);
  g.addColorStop(0.55, COLOURS.skyMid);
  g.addColorStop(1, COLOURS.skyLow);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, FIELD.width, FIELD.height);
  // Sun, drifting slowly with the camera so it never leaves the sky.
  const sunX = 1060 - (cameraX * 0.02) % 200;
  const sunY = 96 + Math.sin(time * 0.05) * 6;
  ctx.fillStyle = COLOURS.sun;
  ctx.beginPath();
  ctx.arc(sunX, sunY, 34, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,243,196,0.35)';
  ctx.beginPath();
  ctx.arc(sunX, sunY, 52, 0, Math.PI * 2);
  ctx.fill();
  // A few soft clouds on two parallax layers.
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  for (let i = 0; i < 7; i += 1) {
    const cx = ((i * 397 - cameraX * 0.12) % 1500 + 1500) % 1500 - 110;
    const cy = 60 + ((i * 97) % 180);
    cloud(ctx, cx, cy, 46 + (i % 3) * 14);
  }
}

function cloud(ctx, x, y, w) {
  ctx.beginPath();
  ctx.ellipse(x, y, w, w * 0.32, 0, 0, Math.PI * 2);
  ctx.ellipse(x - w * 0.5, y + 6, w * 0.55, w * 0.22, 0, 0, Math.PI * 2);
  ctx.ellipse(x + w * 0.5, y + 6, w * 0.55, w * 0.22, 0, 0, Math.PI * 2);
  ctx.fill();
}

function drawMountains(ctx, world, cameraX) {
  // Far ridge, slow parallax, blue-grey.
  ctx.fillStyle = COLOURS.farMountain;
  ctx.beginPath();
  ctx.moveTo(0, FIELD.height);
  for (const r of world.ridges) {
    const sx = r.x - cameraX * 0.35;
    ctx.lineTo(sx, FIELD.height - 210 - r.h * 0.55);
    ctx.lineTo(sx + 190, FIELD.height - 210);
  }
  ctx.lineTo(FIELD.width, FIELD.height);
  ctx.closePath();
  ctx.fill();
  // Near ridge, faster parallax, green.
  ctx.fillStyle = COLOURS.nearMountain;
  ctx.beginPath();
  ctx.moveTo(0, FIELD.height);
  for (let x = -100; x <= FIELD.width + 100; x += 80) {
    const wx = x + cameraX * 0.6;
    const h = 120 + 60 * Math.sin(wx * 0.004) + 30 * Math.sin(wx * 0.013 + 2);
    ctx.lineTo(x, FIELD.height - 150 - h * 0.4);
  }
  ctx.lineTo(FIELD.width, FIELD.height);
  ctx.closePath();
  ctx.fill();
}

function drawValley(ctx, world, cameraX) {
  // Ground: rolling green down to the bottom of the screen.
  ctx.fillStyle = COLOURS.hill;
  ctx.beginPath();
  ctx.moveTo(0, FIELD.height);
  for (let sx = 0; sx <= FIELD.width; sx += 16) {
    ctx.lineTo(sx, groundHeightAt(world, sx + cameraX));
  }
  ctx.lineTo(FIELD.width, FIELD.height);
  ctx.closePath();
  ctx.fill();
  // Crop fields as flat patches on the valley floor.
  for (const f of world.fields) {
    const sx = f.x - cameraX;
    if (sx + f.w < -20 || sx > FIELD.width + 20) continue;
    const gy = groundHeightAt(world, f.x + f.w / 2);
    ctx.fillStyle = f.alt ? COLOURS.fieldAlt : COLOURS.field;
    ctx.fillRect(sx, gy - 6, f.w, 26);
    ctx.strokeStyle = 'rgba(60,90,40,0.5)';
    ctx.lineWidth = 1;
    for (let lx = sx + 14; lx < sx + f.w - 6; lx += 18) {
      ctx.beginPath();
      ctx.moveTo(lx, gy - 4);
      ctx.lineTo(lx, gy + 16);
      ctx.stroke();
    }
  }
  // The river: blue bends across the ground.
  ctx.fillStyle = COLOURS.river;
  for (const bend of world.riverBends) {
    const sx = bend.x - cameraX;
    if (sx < -80 || sx > FIELD.width + 80) continue;
    const gy = groundHeightAt(world, bend.x);
    ctx.beginPath();
    ctx.ellipse(sx, gy + 4, bend.w, 12, 0.12, 0, Math.PI * 2);
    ctx.fill();
  }
  // The dirt road linking the strips, with little towns beside it.
  ctx.strokeStyle = COLOURS.road;
  ctx.lineWidth = 7;
  ctx.beginPath();
  for (let sx = 0; sx <= FIELD.width; sx += 32) {
    const gy = groundHeightAt(world, sx + cameraX) - 2;
    if (sx === 0) ctx.moveTo(sx, gy);
    else ctx.lineTo(sx, gy);
  }
  ctx.stroke();
  for (const town of world.towns) {
    for (const house of town.houses) {
      const sx = house.x - cameraX;
      if (sx < -60 || sx > FIELD.width + 60) continue;
      const gy = groundHeightAt(world, house.x);
      drawHouse(ctx, sx, gy, house.w, house.h);
    }
  }
}

function drawHouse(ctx, x, groundY, w, h) {
  ctx.fillStyle = COLOURS.townWall;
  ctx.fillRect(x, groundY - h, w, h);
  ctx.fillStyle = COLOURS.townRoof;
  ctx.beginPath();
  ctx.moveTo(x - 4, groundY - h);
  ctx.lineTo(x + w / 2, groundY - h - 18);
  ctx.lineTo(x + w + 4, groundY - h);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#2a4a7a';
  ctx.fillRect(x + w * 0.32, groundY - h * 0.55, w * 0.22, h * 0.4);
}

function drawRunways(ctx, cameraX) {
  for (const strip of STRIPS) {
    const sx = strip.x - cameraX;
    if (sx < -260 || sx > FIELD.width + 260) continue;
    const gy = 628; // runway ground line, matches groundHeightAt on the flat
    ctx.fillStyle = COLOURS.runway;
    ctx.fillRect(sx - 190, gy - 4, 380, 10);
    ctx.fillStyle = COLOURS.runwayMark;
    for (let dx = -170; dx <= 170; dx += 44) {
      ctx.fillRect(sx + dx, gy - 1, 24, 4);
    }
    // Windsock and a small sign with the strip's name.
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(sx + 210, gy - 4);
    ctx.lineTo(sx + 210, gy - 44);
    ctx.stroke();
    ctx.fillStyle = '#ff7a3a';
    ctx.beginPath();
    ctx.moveTo(sx + 210, gy - 44);
    ctx.lineTo(sx + 238, gy - 38);
    ctx.lineTo(sx + 210, gy - 32);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#22303f';
    ctx.font = 'bold 15px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(strip.name.toUpperCase(), sx, gy + 30);
  }
}

function drawRings(ctx, world, cameraX) {
  for (const ring of world.rings) {
    if (ring.taken) continue;
    const sx = ring.x - cameraX;
    if (sx < -80 || sx > FIELD.width + 80) continue;
    ctx.strokeStyle = COLOURS.ringGold;
    ctx.lineWidth = 7;
    ctx.beginPath();
    ctx.arc(sx, ring.y, 46, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.85)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(sx, ring.y, 38, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = COLOURS.ringGold;
    ctx.font = 'bold 13px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('RING', sx, ring.y - 56);
  }
}

function drawPlane(ctx, plane, cameraX) {
  const sx = plane.x - cameraX;
  const sy = plane.y;
  ctx.save();
  ctx.translate(sx, sy);
  ctx.rotate(plane.angle);
  ctx.scale(PLANE_SCALE, PLANE_SCALE);
  // Tail wing.
  ctx.fillStyle = COLOURS.planeWing;
  ctx.beginPath();
  ctx.moveTo(-34, -2);
  ctx.lineTo(-46, -14);
  ctx.lineTo(-38, -14);
  ctx.lineTo(-26, -3);
  ctx.closePath();
  ctx.fill();
  // Main wing, swept back over the cabin.
  ctx.fillStyle = COLOURS.planeWing;
  ctx.beginPath();
  ctx.moveTo(-6, -4);
  ctx.lineTo(8, -22);
  ctx.lineTo(18, -22);
  ctx.lineTo(12, -3);
  ctx.closePath();
  ctx.fill();
  // Fuselage: a red teardrop with a blue cheatline.
  ctx.fillStyle = COLOURS.planeBody;
  ctx.beginPath();
  ctx.moveTo(-44, 0);
  ctx.quadraticCurveTo(-30, -12, 6, -10);
  ctx.quadraticCurveTo(34, -9, 42, -2);
  ctx.quadraticCurveTo(34, 5, 6, 7);
  ctx.quadraticCurveTo(-30, 8, -44, 0);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = COLOURS.planeTrim;
  ctx.fillRect(-28, -5, 52, 3);
  // Cabin windows.
  ctx.fillStyle = '#bfe8ff';
  ctx.beginPath();
  ctx.arc(12, -7, 5, 0, Math.PI * 2);
  ctx.arc(2, -7, 5, 0, Math.PI * 2);
  ctx.fill();
  // Spinning propeller at the nose.
  ctx.save();
  ctx.translate(44, -1);
  ctx.rotate(plane.propAngle);
  ctx.strokeStyle = '#3a3a3a';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(0, -16);
  ctx.lineTo(0, 16);
  ctx.moveTo(-16, 0);
  ctx.lineTo(16, 0);
  ctx.stroke();
  ctx.restore();
  ctx.fillStyle = '#f5f0e0';
  ctx.beginPath();
  ctx.arc(44, -1, 4, 0, Math.PI * 2);
  ctx.fill();
  // Navigation lights: red left, green right, blinking white tail.
  const blink = Math.floor(performance.now() / 350) % 2 === 0;
  ctx.fillStyle = '#ff3a2a';
  ctx.beginPath();
  ctx.arc(8, -32, 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#37d67a';
  ctx.beginPath();
  ctx.arc(14, 4, 3, 0, Math.PI * 2);
  ctx.fill();
  if (blink) {
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(-44, 0, 3, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
  // Stall warning: a shivering outline when the wing gives up.
  if (plane.stalled) {
    ctx.strokeStyle = COLOURS.hudBad;
    ctx.lineWidth = 2;
    ctx.strokeRect(sx - 52, sy - 42, 104, 84);
  }
}

function drawParticles(ctx, particles, cameraX) {
  for (const p of particles) {
    ctx.fillStyle = p.colour;
    ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
    ctx.fillRect(p.x - cameraX - 2, p.y - 2, 4, 4);
  }
  ctx.globalAlpha = 1;
}

function drawHud(ctx, plane, score, mission, cameraX) {
  const speedKnots = Math.round(Math.hypot(plane.vx, plane.vy) * 1.35);
  // Altitude above the valley floor: zero with the wheels on the ground.
  const altitudeFt = Math.max(0, Math.round((628 - plane.y - 14) * 9));
  const heading = headingOf(plane);
  const fuelPct = Math.round((plane.fuel / 100) * 100);
  ctx.fillStyle = COLOURS.hudPanel;
  roundRect(ctx, 12, 12, 330, 118, 10);
  ctx.fill();
  ctx.fillStyle = COLOURS.hudText;
  ctx.font = 'bold 17px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(`ALT ${altitudeFt} ft`, 26, 40);
  ctx.fillText(`SPD ${speedKnots} kt`, 26, 66);
  ctx.fillText(`HDG ${heading}`, 26, 92);
  ctx.fillText(`SCORE ${score}`, 26, 118);
  // Fuel gauge, top right.
  ctx.fillStyle = COLOURS.hudPanel;
  roundRect(ctx, FIELD.width - 232, 12, 220, 84, 10);
  ctx.fill();
  ctx.fillStyle = COLOURS.hudText;
  ctx.font = 'bold 15px sans-serif';
  ctx.fillText('FUEL', FIELD.width - 218, 34);
  const fuelW = 150 * Math.max(0, plane.fuel / 100);
  ctx.fillStyle = fuelPct < 25 ? COLOURS.hudBad : fuelPct < 50 ? COLOURS.hudWarn : '#37d67a';
  ctx.fillRect(FIELD.width - 218, 42, fuelW, 14);
  ctx.strokeStyle = COLOURS.hudText;
  ctx.lineWidth = 1;
  ctx.strokeRect(FIELD.width - 218, 42, 150, 14);
  // Damage bar under the fuel gauge.
  ctx.fillStyle = COLOURS.hudText;
  ctx.fillText('DMG', FIELD.width - 218, 66);
  ctx.fillStyle = plane.damage > 60 ? COLOURS.hudBad : '#ffb347';
  ctx.fillRect(FIELD.width - 218, 70, 150 * (plane.damage / 100), 8);
  // Mission line, centred at the top.
  ctx.fillStyle = COLOURS.hudPanel;
  const mw = ctx.measureText(mission).width + 36;
  roundRect(ctx, (FIELD.width - mw) / 2, 12, mw, 34, 10);
  ctx.fill();
  ctx.fillStyle = '#ffe9a8';
  ctx.font = 'bold 16px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(mission, FIELD.width / 2, 35);
  // Stall warning, big and centred.
  if (plane.stalled) {
    ctx.fillStyle = COLOURS.hudBad;
    ctx.font = 'bold 30px sans-serif';
    ctx.fillText('STALL! NOSE DOWN, ADD POWER', FIELD.width / 2, 190);
  }
  // Throttle bar, bottom left.
  ctx.fillStyle = COLOURS.hudPanel;
  roundRect(ctx, 12, FIELD.height - 52, 220, 40, 10);
  ctx.fill();
  ctx.fillStyle = COLOURS.hudText;
  ctx.font = 'bold 14px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('THR', 24, FIELD.height - 27);
  ctx.fillStyle = '#5fa8d8';
  ctx.fillRect(66, FIELD.height - 38, 150 * plane.throttle, 12);
  ctx.strokeStyle = COLOURS.hudText;
  ctx.strokeRect(66, FIELD.height - 38, 150, 12);
}

function headingOf(plane) {
  // Compass heading: 0 = north (up), 90 = east (right), clockwise.
  const deg = Math.round(((90 - (Math.atan2(-plane.vy, plane.vx) * 180) / Math.PI) % 360 + 360) % 360);
  const names = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  const idx = Math.round(deg / 45) % 8;
  return `${String(deg).padStart(3, '0')}° ${names[idx]}`;
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawToast(ctx, message) {
  ctx.fillStyle = 'rgba(12,24,40,0.85)';
  const w = ctx.measureText(message).width + 40;
  roundRect(ctx, (FIELD.width - w) / 2, 210, w, 40, 10);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 18px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(message, FIELD.width / 2, 236);
}

function drawTitle(ctx, score) {
  ctx.fillStyle = 'rgba(10, 20, 36, 0.55)';
  ctx.fillRect(0, 0, FIELD.width, FIELD.height);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 64px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('SKY COURIER', FIELD.width / 2, 220);
  ctx.font = 'bold 22px sans-serif';
  ctx.fillStyle = '#ffe9a8';
  ctx.fillText('A little red prop plane, a long valley, three parcels to deliver.', FIELD.width / 2, 262);
  ctx.fillStyle = '#e8f4ff';
  ctx.font = '18px sans-serif';
  ctx.fillText('W / S or ↑ / ↓ — pitch   •   D / A or → / ← — throttle', FIELD.width / 2, 330);
  ctx.fillText('Fly through the gold rings, land soft on the runways,', FIELD.width / 2, 360);
  ctx.fillText('and deliver all three parcels. Watch your fuel — empty means a forced landing.', FIELD.width / 2, 388);
  ctx.fillText('Land hard or hit the hills and the airframe takes damage. 100% damage ends the flight.', FIELD.width / 2, 416);
  ctx.fillStyle = '#ffd94a';
  ctx.font = 'bold 24px sans-serif';
  ctx.fillText('Press SPACE or click to take off', FIELD.width / 2, 480);
  if (score > 0) {
    ctx.fillStyle = '#e8f4ff';
    ctx.font = 'bold 18px sans-serif';
    ctx.fillText(`Best score so far: ${score}`, FIELD.width / 2, 520);
  }
}

function drawPaused(ctx) {
  ctx.fillStyle = 'rgba(10, 20, 36, 0.6)';
  ctx.fillRect(0, 0, FIELD.width, FIELD.height);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 48px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('PAUSED', FIELD.width / 2, 340);
  ctx.font = '18px sans-serif';
  ctx.fillText('Press P or Escape to keep flying', FIELD.width / 2, 380);
}

function drawEnd(ctx, title, line, score, won) {
  ctx.fillStyle = won ? 'rgba(20, 60, 30, 0.62)' : 'rgba(60, 16, 10, 0.62)';
  ctx.fillRect(0, 0, FIELD.width, FIELD.height);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 52px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(title, FIELD.width / 2, 300);
  ctx.font = '20px sans-serif';
  ctx.fillText(line, FIELD.width / 2, 344);
  ctx.font = 'bold 30px sans-serif';
  ctx.fillStyle = '#ffd94a';
  ctx.fillText(`SCORE  ${score}`, FIELD.width / 2, 400);
  ctx.fillStyle = '#e8f4ff';
  ctx.font = '18px sans-serif';
  ctx.fillText('Press SPACE or click to fly again', FIELD.width / 2, 452);
}
