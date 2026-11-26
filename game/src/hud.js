// hud.js — the sim HUD, drawn on a 2D canvas over the WebGL view: heading,
// speed and altitude tapes, the objective line, FUEL/HULL bars, the ADI and
// HSI cluster at the bottom, centre messages, and the menu / pause / crash /
// complete screens. Colours are the same amber-and-cyan of the 3D scene.

import { compassDeg } from './plane.js';
import { FIELDS } from './world.js';
import { clamp } from './seed.js';

const AMBER = '#ffb347';
const CYAN = '#39d5e8';
const INK = 'rgba(8, 14, 22, 0.72)';
const PAPER = '#f4ead8';

function panel(ctx, x, y, w, h) {
  ctx.fillStyle = INK;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 6);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255, 179, 71, 0.35)';
  ctx.lineWidth = 1;
  ctx.stroke();
}

function text(ctx, s, x, y, size, color, align, weight) {
  ctx.fillStyle = color || PAPER;
  ctx.font = `${weight || 600} ${size}px "Segoe UI", system-ui, sans-serif`;
  ctx.textAlign = align || 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(s, x, y);
}

// A vertical tape: value centred, ticks scrolling past a fixed marker.
function vTape(ctx, x, y, w, h, value, step, perPx, fmt, label) {
  panel(ctx, x, y, w, h);
  const cy = y + h / 2;
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  const top = value + (h / 2) * perPx;
  const first = Math.floor((value - (h / 2) * perPx) / step) * step;
  for (let v = first; v <= top; v += step) {
    const yy = cy - (v - value) / perPx;
    const major = Math.round(v) % (step * 5) === 0;
    ctx.strokeStyle = major ? 'rgba(244, 234, 216, 0.9)' : 'rgba(244, 234, 216, 0.35)';
    ctx.lineWidth = major ? 2 : 1;
    ctx.beginPath();
    ctx.moveTo(x + w - (major ? 16 : 9), yy);
    ctx.lineTo(x + w, yy);
    ctx.stroke();
    if (major) text(ctx, fmt(v), x + w - 20, yy, 11, PAPER, 'right');
  }
  ctx.restore();
  // Unit label on a solid chip so it never collides with a tick number.
  ctx.fillStyle = INK;
  ctx.beginPath();
  ctx.roundRect(x + w / 2 - 20, y + 3, 40, 15, 3);
  ctx.fill();
  text(ctx, label, x + w / 2, y + 11, 10, AMBER, 'center', 700);
  // The fixed marker with the current reading, on a light pill so the
  // dark digits read against the dark panel.
  ctx.fillStyle = CYAN;
  ctx.beginPath();
  ctx.moveTo(x + w, cy - 11);
  ctx.lineTo(x + w, cy + 11);
  ctx.lineTo(x + w - 8, cy);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = PAPER;
  ctx.beginPath();
  ctx.roundRect(x + 6, cy - 11, w - 18, 22, 4);
  ctx.fill();
  text(ctx, fmt(value), x + w / 2 - 2, cy, 15, '#0a121c', 'center', 800);
}

function headingTape(ctx, w, headingDeg) {
  const bw = Math.min(460, w * 0.42);
  const x = (w - bw) / 2, y = 12, h = 34;
  panel(ctx, x, y, bw, h);
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, bw, h);
  ctx.clip();
  const pxPerDeg = bw / 90;
  const cx = x + bw / 2;
  const start = Math.floor((headingDeg - 45) / 5) * 5;
  for (let d = start; d <= headingDeg + 45; d += 5) {
    const dd = ((d % 360) + 360) % 360;
    const xx = cx + (d - headingDeg) * pxPerDeg;
    const major = dd % 15 === 0;
    ctx.strokeStyle = major ? 'rgba(244,234,216,0.9)' : 'rgba(244,234,216,0.35)';
    ctx.lineWidth = major ? 2 : 1;
    ctx.beginPath();
    ctx.moveTo(xx, y + h - (major ? 14 : 8));
    ctx.lineTo(xx, y + h);
    ctx.stroke();
    if (major) {
      const names = { 0: 'N', 90: 'E', 180: 'S', 270: 'W' };
      text(ctx, names[dd] || String(dd).padStart(3, '0'), xx, y + 11, 11, PAPER, 'center');
    }
  }
  ctx.restore();
  ctx.fillStyle = CYAN;
  ctx.beginPath();
  ctx.moveTo(cx - 7, y);
  ctx.lineTo(cx + 7, y);
  ctx.lineTo(cx, y + 9);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = CYAN;
  ctx.beginPath();
  ctx.roundRect(cx - 24, y + 13, 48, 17, 4);
  ctx.fill();
  text(ctx, String(Math.round(headingDeg)).padStart(3, '0') + '°', cx, y + 22, 12, '#0a121c', 'center', 800);
}

// ---- instruments --------------------------------------------------------

function drawADI(ctx, cx, cy, r, pitch, bank) {
  panel(ctx, cx - r - 8, cy - r - 8, r * 2 + 16, r * 2 + 16);
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.clip();
  ctx.translate(cx, cy);
  ctx.rotate(-bank);
  const py = (pitch * 180) / Math.PI * (r / 45);
  ctx.fillStyle = '#2f6fb4';
  ctx.fillRect(-r * 2, -r * 2 - py, r * 4, r * 2);
  ctx.fillStyle = '#c98a3a';
  ctx.fillRect(-r * 2, -py, r * 4, r * 2);
  ctx.strokeStyle = PAPER;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(-r, -py);
  ctx.lineTo(r, -py);
  ctx.stroke();
  for (const deg of [-20, -10, 10, 20]) {
    const yy = -py - (deg * r) / 45;
    ctx.beginPath();
    ctx.moveTo(-r * 0.45, yy);
    ctx.lineTo(r * 0.45, yy);
    ctx.stroke();
    text(ctx, String(Math.abs(deg)), -r * 0.55, yy, 9, PAPER, 'right');
  }
  ctx.restore();
  // Fixed wings and bank pointer.
  ctx.strokeStyle = AMBER;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(cx - r * 0.55, cy);
  ctx.lineTo(cx - r * 0.15, cy);
  ctx.moveTo(cx + r * 0.15, cy);
  ctx.lineTo(cx + r * 0.55, cy);
  ctx.stroke();
  ctx.fillStyle = AMBER;
  ctx.beginPath();
  ctx.arc(cx, cy, 3, 0, Math.PI * 2);
  ctx.fill();
  text(ctx, 'ADI', cx, cy + r + 16, 10, AMBER, 'center', 700);
}

// HSI radar / minimap: the valley, strips, gates and the plane, north up.
function drawHSI(ctx, cx, cy, r, plane, gates, nextGate) {
  panel(ctx, cx - r - 8, cy - r - 8, r * 2 + 16, r * 2 + 16);
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.clip();
  ctx.fillStyle = '#0d2733';
  ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
  const scale = (r * 2) / 2700;
  const px = (x) => cx + x * scale;
  const pz = (z) => cy + z * scale;
  ctx.strokeStyle = 'rgba(57, 213, 232, 0.35)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(cx, cy, r * 0.5, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.stroke();
  // Strips.
  for (const f of FIELDS) {
    ctx.fillStyle = '#e8e0c8';
    ctx.fillRect(px(f.x) - 5, pz(f.z) - 1.5, 10, 3);
    text(ctx, f.short, px(f.x), pz(f.z) - 10, 8, PAPER, 'center');
  }
  // Gates: next one cyan and pulsing, later ones dim, passed ones green.
  for (const g of gates) {
    const col = g.passed ? '#58d68d' : g === nextGate ? CYAN : 'rgba(255,179,71,0.55)';
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.arc(px(g.x), pz(g.z), g === nextGate ? 5 : 3.5, 0, Math.PI * 2);
    ctx.fill();
    text(ctx, String(g.n), px(g.x), pz(g.z) - 9, 9, col, 'center', 800);
  }
  // The plane: a small amber wedge pointing along its heading.
  const hdg = compassDeg(plane.heading);
  const a = ((90 - hdg) * Math.PI) / 180;
  ctx.fillStyle = AMBER;
  ctx.beginPath();
  ctx.moveTo(px(plane.x) + Math.cos(a) * 9, pz(plane.z) - Math.sin(a) * 9);
  ctx.lineTo(px(plane.x) + Math.cos(a + 2.5) * 6, pz(plane.z) - Math.sin(a + 2.5) * 6);
  ctx.lineTo(px(plane.x) + Math.cos(a - 2.5) * 6, pz(plane.z) - Math.sin(a - 2.5) * 6);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  text(ctx, 'HSI · N↑', cx, cy + r + 16, 10, AMBER, 'center', 700);
}

function bar(ctx, x, y, w, h, frac, color, label) {
  panel(ctx, x, y, w, h + 16);
  ctx.fillStyle = 'rgba(255,255,255,0.12)';
  ctx.fillRect(x + 8, y + 5, w - 16, h - 10);
  ctx.fillStyle = frac < 0.25 ? '#e5484d' : color;
  ctx.fillRect(x + 8, y + 5, (w - 16) * clamp(frac, 0, 1), h - 10);
  text(ctx, `${label} ${Math.round(frac * 100)}%`, x + w / 2, y + h + 8, 10, PAPER, 'center', 700);
}

// ---- full frame -----------------------------------------------------------

export function drawHud(ctx, w, h, S) {
  const p = S.plane;
  const kts = p.speed * 1.944;
  const altFt = Math.max(0, (p.y - 4) * 3.281);
  const hdg = compassDeg(p.heading);
  headingTape(ctx, w, hdg);
  vTape(ctx, 14, h * 0.2, 74, h * 0.42, kts, 10, 1.6, (v) => String(Math.round(v)), 'KIAS');
  vTape(ctx, w - 88, h * 0.2, 74, h * 0.42, altFt, 100, 3.2, (v) => String(Math.round(v)), 'ALT FT');
  // Vertical speed under the alt tape.
  const vsi = p.vspeed * 196.85;
  text(ctx, (vsi >= 0 ? '+' : '') + Math.round(vsi) + ' FPM', w - 51, h * 0.2 + h * 0.42 + 16, 11, vsi < -600 ? '#e5484d' : PAPER, 'center', 700);
  // Objective line under the heading tape.
  const g = S.nextGate;
  const dest = g ? g.dest : S.finalField;
  const distNm = g
    ? Math.hypot(g.x - p.x, g.y - p.y, g.z - p.z) * 0.00054
    : Math.hypot(S.finalX - p.x, S.finalZ - p.z) * 0.00054;
  const obj = g
    ? `GATE ${g.n}/6 · ${dest} — ${distNm.toFixed(1)} NM`
    : `FINAL · LAND ${dest} — ${distNm.toFixed(1)} NM`;
  text(ctx, `SORTIE 01 · PARCEL ${Math.min(3, S.leg + 1)}/3`, w / 2, 62, 13, AMBER, 'center', 800);
  text(ctx, obj, w / 2, 82, 15, PAPER, 'center', 700);
  // Score and parcels, top right — kept clear of the alt tape below it.
  panel(ctx, w - 178, 96, 164, 46);
  text(ctx, `PTS ${S.score}`, w - 96, 112, 17, AMBER, 'center', 800);
  text(ctx, `PARCELS ${S.delivered}/3 · RINGS ${S.rings}/6`, w - 96, 132, 11, PAPER, 'center');
  // Fuel and hull, bottom left.
  bar(ctx, 14, h - 96, 150, 16, p.fuel / 100, AMBER, 'FUEL');
  bar(ctx, 14, h - 62, 150, 16, p.hull / 100, '#58d68d', 'HULL');
  // Throttle gauge beside the bars.
  panel(ctx, 176, h - 96, 34, 96);
  ctx.fillStyle = 'rgba(255,255,255,0.12)';
  ctx.fillRect(184, h - 88, 18, 72);
  ctx.fillStyle = p.throttle > 0.85 ? '#ff7a1a' : CYAN;
  ctx.fillRect(184, h - 16 - 72 * p.throttle, 18, 72 * p.throttle);
  text(ctx, 'THR', 193, h - 104 + 4, 9, AMBER, 'center', 700);
  text(ctx, Math.round(p.throttle * 100) + '%', 193, h - 8, 9, PAPER, 'center');
  // Instrument cluster, bottom centre.
  const cy = h - 74;
  drawADI(ctx, w / 2 - 108, cy, 46, p.pitch, p.bank);
  drawHSI(ctx, w / 2 + 108, cy, 46, p, S.gates, g);
  text(ctx, `G ${p.gLoad.toFixed(1)} · AOA ${Math.round(p.aoa)}° · ${p.onGround ? 'ON GROUND' : p.speed < 26 ? 'STALL!' : 'FLYING'}`, w / 2, h - 14, 11, p.speed < 26 && !p.onGround ? '#e5484d' : PAPER, 'center', 700);
  // Centre message with a slow fade.
  if (S.msg && S.msgAge < 3.2) {
    ctx.globalAlpha = S.msgAge < 2.4 ? 1 : (3.2 - S.msgAge) / 0.8;
    text(ctx, S.msg, w / 2, h * 0.3, 30, S.msgColor || AMBER, 'center', 800);
    if (S.sub) text(ctx, S.sub, w / 2, h * 0.3 + 30, 15, PAPER, 'center');
    ctx.globalAlpha = 1;
  }
  // Speed streaks at high speed: short radial lines at the frame edges.
  if (p.speed > 55 && !p.onGround) {
    const n = Math.floor((p.speed - 55) / 4);
    ctx.strokeStyle = 'rgba(244,234,216,0.35)';
    ctx.lineWidth = 2;
    for (let i = 0; i < n; i++) {
      const a = ((i * 2.39996 + S.time * 0.7) % (Math.PI * 2));
      const rr = Math.min(w, h) * 0.36 + ((i * 53 + Math.floor(S.time * 90)) % 120);
      const x1 = w / 2 + Math.cos(a) * rr;
      const y1 = h / 2 + Math.sin(a) * rr;
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x1 + Math.cos(a) * 26, y1 + Math.sin(a) * 26);
      ctx.stroke();
    }
  }
  if (S.state === 'menu') drawMenu(ctx, w, h, 'menu');
  else if (S.state === 'pause') drawMenu(ctx, w, h, 'pause');
  else if (S.state === 'crash') drawMenu(ctx, w, h, 'crash', S);
  else if (S.state === 'done') drawMenu(ctx, w, h, 'done', S);
}

function drawMenu(ctx, w, h, kind, S) {
  ctx.fillStyle = 'rgba(10, 16, 26, 0.62)';
  ctx.fillRect(0, 0, w, h);
  const cx = w / 2;
  if (kind === 'menu') {
    text(ctx, 'SKY COURIER', cx, h * 0.26, 54, AMBER, 'center', 800);
    text(ctx, 'SORTIE 01 — THE GOLDEN VALLEY', cx, h * 0.26 + 44, 18, PAPER, 'center', 700);
    text(ctx, 'Fly the little red prop plane through 6 neon gates and deliver', cx, h * 0.42, 16, PAPER, 'center');
    text(ctx, '3 parcels across the valley — Home Field → Riverbend → Mill Town → High Pass.', cx, h * 0.42 + 24, 16, PAPER, 'center');
    text(ctx, 'W / S pitch · A / D throttle · Q / E bank · mouse drag steers', cx, h * 0.54, 15, CYAN, 'center', 700);
    text(ctx, 'Space start · P pause · M mute · land soft for +120, gates +50, delivery +300', cx, h * 0.54 + 24, 15, CYAN, 'center', 700);
    text(ctx, 'PRESS SPACE TO FLY', cx, h * 0.68, 22, '#ffffff', 'center', 800);
  } else if (kind === 'pause') {
    text(ctx, 'PAUSED', cx, h * 0.4, 44, AMBER, 'center', 800);
    text(ctx, 'P / Esc to resume · Space to restart the sortie', cx, h * 0.4 + 40, 15, PAPER, 'center');
  } else if (kind === 'crash') {
    text(ctx, 'DOWN IN THE VALLEY', cx, h * 0.36, 44, '#e5484d', 'center', 800);
    text(ctx, S.crashWhy || 'The plane came down hard.', cx, h * 0.36 + 40, 16, PAPER, 'center');
    text(ctx, `Score ${S.score} · Parcels ${S.delivered}/3 · Rings ${S.rings}/6`, cx, h * 0.36 + 70, 15, PAPER, 'center');
    text(ctx, 'PRESS SPACE TO FLY AGAIN', cx, h * 0.55, 20, '#ffffff', 'center', 800);
  } else if (kind === 'done') {
    text(ctx, 'SORTIE COMPLETE', cx, h * 0.32, 48, AMBER, 'center', 800);
    text(ctx, 'All three parcels delivered to High Pass as the sun went down.', cx, h * 0.32 + 44, 16, PAPER, 'center');
    text(ctx, `FINAL SCORE ${S.score}`, cx, h * 0.46, 26, PAPER, 'center', 800);
    text(ctx, `Soft landings ${S.softLandings} · Rings ${S.rings}/6 · Hull ${Math.round(S.plane.hull)}% · Fuel ${Math.round(S.plane.fuel)}%`, cx, h * 0.46 + 36, 14, PAPER, 'center');
    text(ctx, 'PRESS SPACE TO FLY IT AGAIN', cx, h * 0.62, 20, '#ffffff', 'center', 800);
  }
}
