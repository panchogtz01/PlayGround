import { WORLD, ROLE, TEAM, TAU } from './roster.js';

/* ------------------------------------------------------------------ */
/* helpers                                                             */
/* ------------------------------------------------------------------ */
export function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
export function lerp(a, b, t) { return a + (b - a) * t; }

function rr(ctx, x, y, w, h, r) {
  const rad = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rad, y);
  ctx.arcTo(x + w, y, x + w, y + h, rad);
  ctx.arcTo(x + w, y + h, x, y + h, rad);
  ctx.arcTo(x, y + h, x, y, rad);
  ctx.arcTo(x, y, x + w, y, rad);
  ctx.closePath();
}

function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shadowEllipse(ctx, x, y, rx, ry, alpha = 0.5) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = '#000';
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, 0, TAU);
  ctx.fill();
  ctx.restore();
}

/* ------------------------------------------------------------------ */
/* static arena (pre-rendered once)                                    */
/* ------------------------------------------------------------------ */
const rand = mulberry32(20261105);
const TILES = [];
for (let row = 0; row < 11; row++) {
  for (let col = 0; col < 18; col++) {
    const x = 120 + col * 76 + (row % 2 ? 4 : 0);
    const y = 112 + row * 71;
    TILES.push({ x, y, w: 70, h: 65, shade: rand(), rot: (rand() - 0.5) * 0.02 });
  }
}
const CRACKS = [];
for (let i = 0; i < 22; i++) {
  const pts = [];
  let x = 160 + rand() * 1280;
  let y = 150 + rand() * 700;
  let a = rand() * TAU;
  const n = 3 + Math.floor(rand() * 5);
  for (let j = 0; j < n; j++) {
    pts.push([x, y]);
    a += (rand() - 0.5) * 1.5;
    x += Math.cos(a) * (24 + rand() * 46);
    y += Math.sin(a) * (20 + rand() * 30);
  }
  CRACKS.push({ pts, glow: 0.3 + rand() * 0.5 });
}
const CROWD = [];
for (let i = 0; i < 130; i++) {
  CROWD.push({
    x: 120 + rand() * 1360,
    y: rand() < 0.5 ? 84 + rand() * 22 : 900 + rand() * 22,
    s: 2 + rand() * 3,
    a: 0.12 + rand() * 0.3,
    eye: rand() < 0.12
  });
}
const EMBERS = [];
for (let i = 0; i < 34; i++) {
  EMBERS.push({
    x: 60 + rand() * 1480,
    y: rand() * 1000,
    s: 0.8 + rand() * 2.2,
    sp: 9 + rand() * 26,
    ph: rand() * TAU,
    drift: 8 + rand() * 18
  });
}
const RUNES = [];
for (let i = 0; i < 26; i++) {
  const a = (i / 26) * TAU;
  RUNES.push({ a, len: 6 + rand() * 12, w: 1 + rand() * 1.5 });
}

let arenaLayer = null;

function buildArena() {
  const c = document.createElement('canvas');
  c.width = WORLD.w; c.height = WORLD.h;
  const x = c.getContext('2d');

  // deep background
  const bg = x.createRadialGradient(800, 500, 120, 800, 500, 1000);
  bg.addColorStop(0, '#12191a');
  bg.addColorStop(0.55, '#0a0e10');
  bg.addColorStop(1, '#040606');
  x.fillStyle = bg; x.fillRect(0, 0, WORLD.w, WORLD.h);

  // outer glow under platform
  const halo = x.createRadialGradient(800, 500, 380, 800, 500, 850);
  halo.addColorStop(0, 'rgba(88,255,88,0.05)');
  halo.addColorStop(0.6, 'rgba(40,160,90,0.035)');
  halo.addColorStop(1, 'rgba(0,0,0,0)');
  x.fillStyle = halo; x.fillRect(0, 0, WORLD.w, WORLD.h);

  // platform
  x.save();
  x.shadowColor = 'rgba(0,0,0,0.85)';
  x.shadowBlur = 60;
  x.shadowOffsetY = 26;
  rr(x, 62, 62, 1476, 876, 74);
  x.fillStyle = '#14181a'; x.fill();
  x.restore();

  const plat = x.createLinearGradient(0, 62, 0, 938);
  plat.addColorStop(0, '#242a2b');
  plat.addColorStop(0.5, '#161b1c');
  plat.addColorStop(1, '#0e1213');
  rr(x, 62, 62, 1476, 876, 74);
  x.fillStyle = plat; x.fill();
  x.strokeStyle = 'rgba(150,190,180,0.16)'; x.lineWidth = 3; x.stroke();

  // outer rim runes
  x.save();
  x.translate(800, 500);
  for (const r of RUNES) {
    x.save();
    x.rotate(r.a);
    x.translate(0, -418);
    x.fillStyle = 'rgba(125,255,60,0.22)';
    x.fillRect(-r.w / 2, 0, r.w, r.len);
    x.restore();
  }
  x.restore();

  // crowd terraces
  for (const p of CROWD) {
    x.globalAlpha = p.a;
    x.fillStyle = p.eye ? (p.y < 500 ? '#7dff3c' : '#ff7a3c') : '#0a0c0c';
    x.beginPath();
    x.arc(p.x, p.y, p.s, 0, TAU);
    x.fill();
  }
  x.globalAlpha = 1;

  // arena floor
  x.save();
  x.shadowColor = 'rgba(0,0,0,0.9)';
  x.shadowBlur = 30;
  rr(x, 120, 110, 1360, 780, 44);
  x.fillStyle = '#171c1e'; x.fill();
  x.restore();

  const fl = x.createRadialGradient(800, 500, 60, 800, 500, 760);
  fl.addColorStop(0, '#222a2b');
  fl.addColorStop(0.55, '#171d1f');
  fl.addColorStop(1, '#0f1416');
  rr(x, 120, 110, 1360, 780, 44);
  x.fillStyle = fl; x.fill();

  // stone tiles
  x.save();
  rr(x, 120, 110, 1360, 780, 44);
  x.clip();
  for (const t of TILES) {
    x.save();
    x.translate(t.x + t.w / 2, t.y + t.h / 2);
    x.rotate(t.rot);
    x.globalAlpha = 0.5;
    const shade = 18 + Math.floor(t.shade * 14);
    x.fillStyle = `rgb(${shade},${shade + 4},${shade + 4})`;
    rr(x, -t.w / 2 + 1, -t.h / 2 + 1, t.w - 2, t.h - 2, 4);
    x.fill();
    x.globalAlpha = 0.22;
    x.strokeStyle = '#435052';
    x.lineWidth = 1;
    x.stroke();
    x.restore();
  }
  x.restore();

  // cracks (dark + green lava)
  x.save();
  rr(x, 120, 110, 1360, 780, 44);
  x.clip();
  for (const ck of CRACKS) {
    x.beginPath();
    x.moveTo(ck.pts[0][0], ck.pts[0][1]);
    for (let i = 1; i < ck.pts.length; i++) x.lineTo(ck.pts[i][0], ck.pts[i][1]);
    x.strokeStyle = 'rgba(0,0,0,0.75)'; x.lineWidth = 5; x.lineCap = 'round'; x.stroke();
    x.strokeStyle = `rgba(125,255,60,${0.16 + ck.glow * 0.2})`; x.lineWidth = 1.6; x.stroke();
    x.shadowColor = 'rgba(110,255,60,0.7)'; x.shadowBlur = 10;
    x.strokeStyle = `rgba(160,255,120,${0.08 + ck.glow * 0.12})`; x.lineWidth = 3; x.stroke();
    x.shadowBlur = 0;
  }
  x.restore();

  // arena floor border + hazard stripes
  rr(x, 120, 110, 1360, 780, 44);
  x.strokeStyle = 'rgba(125,255,60,0.18)'; x.lineWidth = 3; x.stroke();
  rr(x, 134, 124, 1332, 752, 36);
  x.strokeStyle = 'rgba(255,255,255,0.045)'; x.lineWidth = 1.5; x.stroke();

  // center emblem
  x.save();
  x.translate(800, 500);
  x.globalAlpha = 0.9;
  x.beginPath(); x.arc(0, 0, 196, 0, TAU);
  x.fillStyle = 'rgba(8,12,12,0.55)'; x.fill();
  x.lineWidth = 2; x.strokeStyle = 'rgba(125,255,60,0.2)'; x.stroke();
  x.beginPath(); x.arc(0, 0, 176, 0, TAU);
  x.strokeStyle = 'rgba(255,255,255,0.07)'; x.lineWidth = 1; x.stroke();

  // feather sun rays
  for (let i = 0; i < 16; i++) {
    x.save();
    x.rotate((i / 16) * TAU);
    x.globalAlpha = i % 2 ? 0.09 : 0.16;
    x.fillStyle = '#7dff3c';
    x.beginPath();
    x.moveTo(-9, -58); x.quadraticCurveTo(0, -168, 9, -58); x.closePath();
    x.fill();
    x.restore();
  }
  // inner eye / egg sigil
  x.beginPath(); x.arc(0, 0, 108, 0, TAU);
  x.strokeStyle = 'rgba(125,255,60,0.16)'; x.lineWidth = 2; x.stroke();
  x.save();
  x.rotate(-0.28);
  x.beginPath();
  x.ellipse(0, 0, 74, 52, 0, 0, TAU);
  x.fillStyle = 'rgba(6,9,8,0.9)'; x.fill();
  x.strokeStyle = 'rgba(125,255,60,0.3)'; x.lineWidth = 3; x.stroke();
  x.beginPath(); x.ellipse(0, 0, 26, 40, 0, 0, TAU);
  x.fillStyle = 'rgba(125,255,60,0.22)'; x.fill();
  x.beginPath(); x.ellipse(0, 0, 12, 32, 0, 0, TAU);
  x.fillStyle = 'rgba(5,10,6,0.95)'; x.fill();
  x.restore();
  x.restore();

  // chain posts
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * TAU;
    const px = 800 + Math.cos(a) * 742;
    const py = 500 + Math.sin(a) * 462;
    x.save();
    x.translate(px, py);
    x.fillStyle = 'rgba(0,0,0,0.5)';
    x.beginPath(); x.ellipse(0, 12, 21, 8, 0, 0, TAU); x.fill();
    const pg = x.createLinearGradient(-6, -44, 6, 12);
    pg.addColorStop(0, '#5c6a6b');
    pg.addColorStop(0.5, '#2c3536');
    pg.addColorStop(1, '#171d1e');
    x.fillStyle = pg;
    rr(x, -6, -44, 12, 56, 4); x.fill();
    x.fillStyle = '#7dff3c'; x.globalAlpha = 0.35;
    x.beginPath(); x.arc(0, -46, 5, 0, TAU); x.fill();
    x.globalAlpha = 1;
    x.restore();
  }

  return c;
}

function drawBrazier(ctx, x, y, t) {
  const glow = 0.7 + Math.sin(t * 3.1 + x) * 0.15;
  const g = ctx.createRadialGradient(x, y - 20, 4, x, y - 20, 130 * glow);
  g.addColorStop(0, 'rgba(255,150,50,0.30)');
  g.addColorStop(0.45, 'rgba(255,90,20,0.10)');
  g.addColorStop(1, 'rgba(255,60,10,0)');
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(x, y - 20, 130 * glow, 0, TAU); ctx.fill();
  ctx.restore();

  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.beginPath(); ctx.ellipse(0, 8, 26, 9, 0, 0, TAU); ctx.fill();
  // pole
  ctx.fillStyle = '#232a2b';
  rr(ctx, -7, -8, 14, 50, 5); ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.12)'; ctx.lineWidth = 1; ctx.stroke();
  // bowl
  const bg = ctx.createLinearGradient(0, -46, 0, -6);
  bg.addColorStop(0, '#5c6668');
  bg.addColorStop(1, '#1a2021');
  ctx.fillStyle = bg;
  ctx.beginPath();
  ctx.moveTo(-24, -34); ctx.quadraticCurveTo(0, -8, 24, -34);
  ctx.quadraticCurveTo(0, -46, -24, -34);
  ctx.fill();
  ctx.strokeStyle = 'rgba(125,255,60,0.25)'; ctx.lineWidth = 1.5; ctx.stroke();
  // flames
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 3; i++) {
    const ph = t * (4 + i) + i * 2 + x * 0.01;
    const h = 26 + Math.sin(ph) * 10 + i * 5;
    const sway = Math.sin(ph * 0.8) * 4;
    const fg = ctx.createLinearGradient(0, -38, 0, -38 - h);
    fg.addColorStop(0, 'rgba(255,240,180,0.95)');
    fg.addColorStop(0.4, 'rgba(255,150,40,0.8)');
    fg.addColorStop(1, 'rgba(255,60,10,0)');
    ctx.fillStyle = fg;
    ctx.beginPath();
    ctx.moveTo(-9 - i * 2, -34);
    ctx.quadraticCurveTo(-3 + sway, -34 - h * 0.55, sway, -34 - h);
    ctx.quadraticCurveTo(5 + sway, -34 - h * 0.5, 9 + i * 2, -34);
    ctx.closePath(); ctx.fill();
  }
  ctx.restore();
}

export function drawArena(ctx, t) {
  if (!arenaLayer) arenaLayer = buildArena();
  ctx.drawImage(arenaLayer, 0, 0);

  // pulsing cracks
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (const ck of CRACKS) {
    ctx.globalAlpha = 0.14 + Math.sin(t * 2 + ck.glow * 9) * 0.06;
    ctx.beginPath();
    ctx.moveTo(ck.pts[0][0], ck.pts[0][1]);
    for (let i = 1; i < ck.pts.length; i++) ctx.lineTo(ck.pts[i][0], ck.pts[i][1]);
    ctx.strokeStyle = '#7dff3c';
    ctx.lineWidth = 2;
    ctx.stroke();
  }
  ctx.restore();

  // animated runes around center
  ctx.save();
  ctx.translate(800, 500);
  ctx.rotate(t * 0.08);
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 8; i++) {
    ctx.save(); ctx.rotate((i / 8) * TAU);
    ctx.globalAlpha = 0.12 + Math.sin(t * 2 + i) * 0.05;
    ctx.fillStyle = '#7dff3c';
    ctx.fillRect(-2, -232, 4, 16);
    ctx.restore();
  }
  ctx.restore();

  drawBrazier(ctx, 208, 210, t);
  drawBrazier(ctx, 1392, 210, t);
  drawBrazier(ctx, 208, 800, t);
  drawBrazier(ctx, 1392, 800, t);

  // floating embers
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (const e of EMBERS) {
    const y = ((e.y - t * e.sp) % 1040 + 1040) % 1040;
    const x = e.x + Math.sin(t * 0.6 + e.ph) * e.drift;
    const a = 0.16 + Math.sin(t * 2.2 + e.ph) * 0.1;
    ctx.globalAlpha = Math.max(0, a);
    ctx.fillStyle = e.s > 2 ? '#a6ff6c' : '#ffb35c';
    ctx.beginPath(); ctx.arc(x, y, e.s, 0, TAU); ctx.fill();
  }
  ctx.restore();
}

/* ------------------------------------------------------------------ */
/* champions                                                           */
/* ------------------------------------------------------------------ */
function limb(ctx, x1, y1, x2, y2, width, color) {
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
}

function drawLeg(ctx, p, hipX, step, swing, facingRight) {
  const kneeX = hipX + swing * 9;
  const kneeY = -17;
  const footX = hipX + swing * 15;
  const footY = -2;
  // muscular thigh
  limb(ctx, hipX, -35, kneeX, kneeY, 13, p.skin);
  ctx.save();
  ctx.globalAlpha = 0.35;
  limb(ctx, hipX + 2, -33, kneeX + 2, kneeY + 1, 6, p.skinLight);
  ctx.restore();
  // scaly shin
  limb(ctx, kneeX, kneeY + 1, footX, footY - 1, 8, p.beak);
  limb(ctx, kneeX - 1, kneeY + 1, footX, footY - 1, 4, p.skinDark);
  // talons
  ctx.strokeStyle = p.beak;
  ctx.lineWidth = 2.4;
  ctx.lineCap = 'round';
  const dir = facingRight ? 1 : -1;
  for (let i = -1; i <= 1; i++) {
    ctx.beginPath();
    ctx.moveTo(footX, footY);
    ctx.lineTo(footX + dir * (7 + (i === 0 ? 4 : 0)), footY + i * 4 + 1);
    ctx.stroke();
  }
  // spur
  ctx.strokeStyle = '#e9e1cb';
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(kneeX - 2, -12); ctx.lineTo(kneeX - 9, -16); ctx.stroke();
}

function drawEgg(ctx, x, y, r, seed, flash) {
  ctx.save();
  ctx.translate(x, y);
  const g = ctx.createRadialGradient(-r * 0.3, -r * 0.45, r * 0.1, 0, 0, r);
  g.addColorStop(0, '#2b332b');
  g.addColorStop(0.45, '#0b0f0b');
  g.addColorStop(1, '#020302');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.ellipse(0, 0, r * 0.82, r, 0, 0, TAU);
  ctx.fill();
  // lava cracks
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.strokeStyle = flash ? '#d8ffb0' : '#7dff3c';
  ctx.shadowColor = '#5cff32';
  ctx.shadowBlur = 14;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(-r * 0.45, -r * 0.3);
  ctx.lineTo(-r * 0.1, -r * 0.05);
  ctx.lineTo(-r * 0.3, r * 0.35);
  ctx.moveTo(r * 0.1, -r * 0.55);
  ctx.lineTo(r * 0.18, -r * 0.15);
  ctx.lineTo(r * 0.5, r * 0.1);
  ctx.stroke();
  ctx.restore();
  ctx.restore();
}

function drawWeapon(ctx, u, p, la, hand, t) {
  const role = u.def.role;
  ctx.save();
  ctx.translate(hand.x, hand.y);
  ctx.rotate(la);
  if (role === 'brawler') {
    // gauntlet basket
    ctx.fillStyle = p.glove;
    rr(ctx, -9, -10, 22, 20, 7); ctx.fill();
    ctx.strokeStyle = p.metal; ctx.lineWidth = 2;
    rr(ctx, -9, -10, 22, 20, 7); ctx.stroke();
    ctx.fillStyle = 'rgba(125,255,60,0.18)';
    ctx.beginPath(); ctx.arc(2, 0, 14, 0, TAU); ctx.fill();
    // rivets
    ctx.fillStyle = '#c9d2cf';
    ctx.beginPath(); ctx.arc(-5, -6, 1.6, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.arc(-5, 6, 1.6, 0, TAU); ctx.fill();
    drawEgg(ctx, 12, 0, 9.5, u.seed, u.flash > 0);
  } else {
    // obsidian feather rifle
    const L = 48;
    ctx.fillStyle = '#101617';
    rr(ctx, -14, -5, L, 10, 4); ctx.fill();
    ctx.strokeStyle = p.metal; ctx.lineWidth = 1.4;
    rr(ctx, -14, -5, L, 10, 4); ctx.stroke();
    const core = ctx.createLinearGradient(-12, 0, L - 12, 0);
    core.addColorStop(0, 'rgba(125,255,60,0.1)');
    core.addColorStop(0.5, '#7dff3c');
    core.addColorStop(1, '#e9ffce');
    ctx.fillStyle = core;
    ctx.fillRect(-8, -1.6, L - 12, 3.2);
    // fletching
    ctx.fillStyle = p.feather;
    for (let i = 0; i < 3; i++) {
      ctx.save();
      ctx.translate(-12 - i * 1.5, 0);
      ctx.rotate(-0.5 + i * 0.45);
      ctx.beginPath();
      ctx.ellipse(-6, 0, 9, 3.2, 0, 0, TAU);
      ctx.fill();
      ctx.restore();
    }
    // muzzle feather blade
    ctx.fillStyle = '#dfffbf';
    ctx.beginPath();
    ctx.moveTo(L - 16, -4);
    ctx.quadraticCurveTo(L + 8, 0, L - 16, 4);
    ctx.quadraticCurveTo(L - 10, 0, L - 16, -4);
    ctx.fill();
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = 'rgba(125,255,60,0.8)';
    ctx.beginPath(); ctx.arc(L - 14, 0, 3 + Math.sin(t * 12) * 0.8, 0, TAU); ctx.fill();
    ctx.restore();
  }
  ctx.restore();
}

/**
 * Draw a rooster-human champion.
 * opts: { portrait, bars, scale, alpha }
 */
export function drawChampion(ctx, u, t, opts = {}) {
  const p = u.def.palette;
  const role = u.def.role;
  const moving = Math.hypot(u.vx || 0, u.vy || 0) > 24;
  const speed = Math.hypot(u.vx || 0, u.vy || 0);
  const walk = u.walkPhase || 0;
  const facing = Math.cos(u.aim) >= 0 ? 1 : -1;
  let la = u.aim;
  if (facing < 0) la = Math.PI - la;
  const sc = opts.scale || 1;
  const bob = moving ? Math.sin(walk * 2) * 1.5 : Math.sin(t * 2 + (u.seed || 0)) * 0.7;
  const step = moving ? Math.sin(walk) * Math.min(1, speed / 180) : 0;

  ctx.save();
  ctx.translate(u.x, u.y);

  if (!opts.portrait) {
    shadowEllipse(ctx, 0, 2, u.r * 1.25, u.r * 0.42, 0.45);
    // team aura + ring
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const aura = ctx.createRadialGradient(0, 0, 4, 0, 0, u.r * 2.1);
    aura.addColorStop(0, `${TEAM[u.team].color}33`);
    aura.addColorStop(1, `${TEAM[u.team].color}00`);
    ctx.fillStyle = aura;
    ctx.beginPath(); ctx.ellipse(0, 2, u.r * 2.1, u.r * 0.85, 0, 0, TAU); ctx.fill();
    ctx.restore();
    ctx.save();
    ctx.strokeStyle = TEAM[u.team].color;
    ctx.globalAlpha = 0.5;
    ctx.lineWidth = 2.2;
    ctx.beginPath(); ctx.ellipse(0, 2, u.r * 1.15, u.r * 0.4, 0, 0, TAU); ctx.stroke();
    ctx.restore();

    if (u.isPlayer) {
      ctx.save();
      ctx.strokeStyle = '#ffd166';
      ctx.globalAlpha = 0.7;
      ctx.lineWidth = 2;
      ctx.setLineDash([7, 7]);
      ctx.lineDashOffset = -t * 26;
      ctx.beginPath(); ctx.ellipse(0, 3, u.r * 1.45, u.r * 0.52, 0, 0, TAU); ctx.stroke();
      ctx.restore();
    }
    if (u.invuln > 0) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = '#9beeff';
      ctx.globalAlpha = 0.4 + Math.sin(t * 14) * 0.15;
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(0, -58, 46, 0, TAU); ctx.stroke();
      ctx.restore();
    }
  }

  ctx.save();
  ctx.scale(facing * sc, sc);
  ctx.translate(0, bob);

  // ---- tail ----
  ctx.save();
  ctx.translate(-13, -52);
  const sway = Math.sin(t * 2.4 + (u.seed || 0)) * 0.08 + (moving ? Math.sin(walk * 2) * 0.05 : 0);
  for (let i = 0; i < 5; i++) {
    const a = -0.6 - i * 0.30 + sway;
    const len = 34 + (i % 3) * 8;
    ctx.save();
    ctx.rotate(a);
    ctx.fillStyle = i % 2 ? p.featherDark : p.feather;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(-len * 0.55, -7 - i * 2, -len, 0);
    ctx.quadraticCurveTo(-len * 0.5, 4, 0, 0);
    ctx.fill();
    ctx.strokeStyle = p.accent;
    ctx.globalAlpha = 0.5;
    ctx.lineWidth = 1.2;
    ctx.stroke();
    ctx.restore();
  }
  ctx.restore();

  // ---- legs ----
  drawLeg(ctx, p, -8, step, step, facing > 0);
  drawLeg(ctx, p, 8, step, -step, facing > 0);

  // ---- scarf tail ----
  ctx.save();
  ctx.strokeStyle = p.accent;
  ctx.lineWidth = 6;
  ctx.globalAlpha = 0.85;
  ctx.lineCap = 'round';
  const flap = Math.sin(t * 5 + (u.seed || 0)) * 3;
  ctx.beginPath();
  ctx.moveTo(-10, -80);
  ctx.quadraticCurveTo(-30, -74 + flap, -34, -58 + flap);
  ctx.stroke();
  ctx.restore();

  // ---- torso ----
  ctx.save();
  const skin = ctx.createLinearGradient(-30, -90, 30, -30);
  skin.addColorStop(0, p.skinLight);
  skin.addColorStop(0.35, p.skin);
  skin.addColorStop(1, p.skinDark);
  ctx.fillStyle = skin;
  ctx.beginPath();
  ctx.moveTo(-16, -30);
  ctx.bezierCurveTo(-26, -48, -31, -68, -29, -80);
  ctx.quadraticCurveTo(-22, -92, -8, -92);
  ctx.lineTo(10, -92);
  ctx.quadraticCurveTo(24, -91, 29, -80);
  ctx.bezierCurveTo(31, -66, 26, -47, 16, -30);
  ctx.quadraticCurveTo(0, -24, -16, -30);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = 'rgba(26,13,7,0.55)';
  ctx.lineWidth = 2.2;
  ctx.stroke();

  // pec + ab shading
  ctx.strokeStyle = 'rgba(90,45,25,0.45)';
  ctx.lineWidth = 1.6;
  ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(0, -78); ctx.lineTo(0, -62); ctx.stroke();
  ctx.beginPath(); ctx.arc(-11, -72, 9, 0.15, Math.PI - 0.15); ctx.stroke();
  ctx.beginPath(); ctx.arc(11, -72, 9, 0.15, Math.PI - 0.15); ctx.stroke();
  for (let i = 0; i < 3; i++) {
    const y = -58 + i * 9;
    ctx.globalAlpha = 0.5;
    ctx.beginPath(); ctx.moveTo(-10, y); ctx.quadraticCurveTo(0, y + 2.5, 10, y); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, y - 3); ctx.lineTo(0, y + 5); ctx.stroke();
  }
  ctx.globalAlpha = 1;

  // feather mantle across the shoulders
  ctx.fillStyle = p.feather;
  for (let i = -3; i <= 3; i++) {
    ctx.save();
    ctx.translate(i * 8, -84);
    ctx.rotate(i * 0.12);
    ctx.beginPath();
    ctx.moveTo(-4, 0);
    ctx.quadraticCurveTo(0, 12 + Math.abs(i) * 1.5, 4, 0);
    ctx.quadraticCurveTo(0, 3, -4, 0);
    ctx.fill();
    ctx.restore();
  }
  ctx.fillStyle = p.featherDark;
  ctx.globalAlpha = 0.7;
  ctx.beginPath(); ctx.ellipse(-20, -80, 10, 6, -0.5, 0, TAU); ctx.fill();
  ctx.beginPath(); ctx.ellipse(21, -80, 9, 6, 0.5, 0, TAU); ctx.fill();
  ctx.globalAlpha = 1;

  // chest harness strap
  ctx.strokeStyle = 'rgba(20,24,26,0.9)';
  ctx.lineWidth = 6;
  ctx.beginPath(); ctx.moveTo(-19, -84); ctx.lineTo(14, -39); ctx.stroke();
  ctx.strokeStyle = p.metal;
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(-19, -84); ctx.lineTo(14, -39); ctx.stroke();
  ctx.fillStyle = '#ffd166';
  ctx.beginPath(); ctx.arc(2, -62, 3.6, 0, TAU); ctx.fill();
  ctx.fillStyle = '#3a2a0e';
  ctx.beginPath(); ctx.arc(2, -62, 1.6, 0, TAU); ctx.fill();

  // team war paint + belt
  ctx.globalAlpha = 0.85;
  ctx.strokeStyle = p.accent;
  ctx.lineWidth = 4;
  ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(-22, -76); ctx.lineTo(-8, -60); ctx.stroke();
  ctx.globalAlpha = 0.55;
  ctx.lineWidth = 2.5;
  ctx.beginPath(); ctx.moveTo(-22, -70); ctx.lineTo(-12, -59); ctx.stroke();
  ctx.globalAlpha = 1;
  ctx.fillStyle = 'rgba(22,24,22,0.92)';
  rr(ctx, -19, -39, 38, 9, 3); ctx.fill();
  ctx.strokeStyle = p.accent; ctx.globalAlpha = 0.55; ctx.lineWidth = 1;
  rr(ctx, -19, -39, 38, 9, 3); ctx.stroke();
  ctx.globalAlpha = 1;
  ctx.fillStyle = p.metal;
  rr(ctx, -5, -40, 10, 11, 2); ctx.fill();
  ctx.fillStyle = '#1a1d1c';
  rr(ctx, -2.5, -37, 5, 5, 1); ctx.fill();
  ctx.restore();

  // ---- rear flexed arm ----
  ctx.save();
  ctx.strokeStyle = p.skinDark;
  limb(ctx, -22, -82, -34, -62, 12, p.skinDark);
  // bicep
  ctx.fillStyle = p.skin;
  ctx.beginPath(); ctx.ellipse(-29, -71, 9.5, 7.5, -0.55, 0, TAU); ctx.fill();
  ctx.fillStyle = p.skinLight;
  ctx.globalAlpha = 0.35;
  ctx.beginPath(); ctx.ellipse(-30, -74, 5.5, 3.2, -0.55, 0, TAU); ctx.fill();
  ctx.globalAlpha = 1;
  limb(ctx, -34, -62, -18, -54, 10, p.skin);
  ctx.fillStyle = p.glove;
  ctx.beginPath(); ctx.arc(-17, -52, 7, 0, TAU); ctx.fill();
  // forearm feathers
  ctx.fillStyle = p.feather;
  ctx.beginPath(); ctx.moveTo(-28, -68); ctx.lineTo(-38, -58); ctx.lineTo(-30, -56); ctx.closePath(); ctx.fill();
  ctx.restore();

  // ---- weapon arm ----
  const sh = { x: 17, y: -81 };
  const hand = { x: sh.x + Math.cos(la) * 36, y: sh.y + Math.sin(la) * 36 };
  const elbow = { x: sh.x + Math.cos(la) * 19, y: sh.y + Math.sin(la) * 19 - 3 };
  ctx.save();
  limb(ctx, sh.x, sh.y, elbow.x, elbow.y, 13, p.skin);
  ctx.save(); ctx.globalAlpha = 0.35; limb(ctx, sh.x + 2, sh.y, elbow.x + 2, elbow.y, 6, p.skinLight); ctx.restore();
  limb(ctx, elbow.x, elbow.y, hand.x, hand.y, 9, p.skin);
  // feather tufts on forearm
  ctx.fillStyle = p.feather;
  for (let i = 0; i < 2; i++) {
    ctx.save();
    ctx.translate(elbow.x, elbow.y + i * 3);
    ctx.rotate(la + Math.PI + 0.5 + i * 0.4);
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(8, -5, 13, 0); ctx.quadraticCurveTo(7, 2, 0, 0); ctx.fill();
    ctx.restore();
  }
  // glove
  ctx.fillStyle = p.glove;
  ctx.beginPath(); ctx.arc(hand.x, hand.y, 7, 0, TAU); ctx.fill();
  ctx.strokeStyle = p.accent; ctx.globalAlpha = 0.5; ctx.lineWidth = 1.5; ctx.stroke();
  ctx.restore();

  if (role === 'sniper') {
    // support arm toward the rifle
    const s2 = { x: -6, y: -74 };
    const h2 = { x: Math.cos(la) * 22, y: -76 + Math.sin(la) * 16 };
    limb(ctx, s2.x, s2.y, h2.x, h2.y, 9, p.skin);
    ctx.fillStyle = p.glove;
    ctx.beginPath(); ctx.arc(h2.x, h2.y, 5.5, 0, TAU); ctx.fill();
  }

  drawWeapon(ctx, u, p, la, hand, t);

  // muzzle flash
  if (u.flash > 0) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = clamp(u.flash * 8, 0, 1);
    const fx = hand.x + Math.cos(la) * 34;
    const fy = hand.y + Math.sin(la) * 34;
    const fg = ctx.createRadialGradient(fx, fy, 0, fx, fy, 26);
    fg.addColorStop(0, 'rgba(255,255,230,0.9)');
    fg.addColorStop(0.4, 'rgba(150,255,90,0.6)');
    fg.addColorStop(1, 'rgba(80,255,40,0)');
    ctx.fillStyle = fg;
    ctx.beginPath(); ctx.arc(fx, fy, 26, 0, TAU); ctx.fill();
    ctx.restore();
  }

  // ---- head ----
  ctx.save();
  ctx.translate(4, -102);
  // back crest feathers
  ctx.fillStyle = p.feather;
  for (let i = 0; i < 3; i++) {
    ctx.save();
    ctx.rotate(-0.5 - i * 0.35);
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(-16, -6, -23, 0); ctx.quadraticCurveTo(-12, 4, 0, 0); ctx.fill();
    ctx.restore();
  }
  // skull
  const hg = ctx.createRadialGradient(-3, -6, 3, 0, 0, 20);
  hg.addColorStop(0, p.skinLight);
  hg.addColorStop(0.55, p.skin);
  hg.addColorStop(1, p.skinDark);
  ctx.fillStyle = hg;
  ctx.beginPath(); ctx.ellipse(0, 0, 17, 18, 0.08, 0, TAU); ctx.fill();
  ctx.strokeStyle = 'rgba(20,10,5,0.5)'; ctx.lineWidth = 1.8; ctx.stroke();
  // cheek feathers
  ctx.fillStyle = p.featherDark;
  ctx.beginPath(); ctx.moveTo(-13, 2); ctx.lineTo(-24, 8); ctx.lineTo(-12, 10); ctx.closePath(); ctx.fill();
  // cheek war paint
  ctx.save();
  ctx.strokeStyle = p.accent; ctx.globalAlpha = 0.85; ctx.lineWidth = 2.6; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(-8, -3); ctx.lineTo(-1, -5); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(-8, 2); ctx.lineTo(-3, 0); ctx.stroke();
  ctx.restore();
  // comb
  ctx.fillStyle = p.comb;
  for (let i = 0; i < 3; i++) {
    ctx.beginPath();
    ctx.arc(-6 + i * 7, -17 - (i === 1 ? 3 : 0), 6.5 - i * 0.4, Math.PI, TAU);
    ctx.fill();
  }
  ctx.strokeStyle = p.combDark; ctx.lineWidth = 1.2;
  ctx.beginPath(); ctx.moveTo(-12, -16); ctx.quadraticCurveTo(0, -24, 12, -16); ctx.stroke();
  // beak
  const bg2 = ctx.createLinearGradient(10, -6, 32, 2);
  bg2.addColorStop(0, '#ffdd76');
  bg2.addColorStop(1, p.beak);
  ctx.fillStyle = bg2;
  ctx.beginPath();
  ctx.moveTo(10, -5);
  ctx.quadraticCurveTo(26, -8, 32, -1);
  ctx.quadraticCurveTo(24, 3, 10, 3);
  ctx.closePath(); ctx.fill();
  ctx.strokeStyle = 'rgba(90,40,0,0.45)'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(11, -1); ctx.quadraticCurveTo(24, -1, 31, -1); ctx.stroke();
  // wattle
  ctx.fillStyle = p.comb;
  ctx.beginPath();
  ctx.ellipse(13, 9, 5, 7, 0.2, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = p.combDark; ctx.globalAlpha = 0.5; ctx.stroke(); ctx.globalAlpha = 1;
  // eye
  ctx.fillStyle = '#f7f3e6';
  ctx.beginPath(); ctx.ellipse(6, -7, 5.2, 5.6, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = '#101416';
  ctx.beginPath(); ctx.arc(7.6, -6.8, 2.6, 0, TAU); ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.beginPath(); ctx.arc(8.4, -7.8, 0.9, 0, TAU); ctx.fill();
  // angry brow
  ctx.strokeStyle = p.featherDark; ctx.lineWidth = 3; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(0, -13); ctx.lineTo(12, -10); ctx.stroke();
  ctx.restore();

  // hit flash
  if (u.hitFlash > 0 && !opts.portrait) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = clamp(u.hitFlash * 3.2, 0, 0.34);
    ctx.fillStyle = '#ffb3a0';
    ctx.beginPath(); ctx.ellipse(0, -62, 32, 46, 0, 0, TAU); ctx.fill();
    ctx.restore();
  }

  ctx.restore(); // scale/translate body

  // ---- above-head HUD ----
  if (!opts.portrait && opts.bars !== false) {
    const ratio = clamp(u.hp / u.maxHp, 0, 1);
    const bw = 58, bh = 7;
    const by = -150;
    ctx.save();
    // bar shadow
    ctx.fillStyle = 'rgba(0,0,0,0.65)';
    rr(ctx, -bw / 2 - 1, by - 1, bw + 2, bh + 2, 3); ctx.fill();
    ctx.fillStyle = 'rgba(25,30,31,0.9)';
    rr(ctx, -bw / 2, by, bw, bh, 2.5); ctx.fill();
    const hc = ratio > 0.55 ? '#6dff64' : ratio > 0.28 ? '#ffd166' : '#ff4d4d';
    ctx.fillStyle = hc;
    rr(ctx, -bw / 2, by, bw * ratio, bh, 2.5); ctx.fill();
    if (ratio > 0.03) {
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      rr(ctx, -bw / 2 + 1, by + 1, Math.max(0, bw * ratio - 2), 2, 1); ctx.fill();
    }
    ctx.strokeStyle = TEAM[u.team].color;
    ctx.globalAlpha = 0.65;
    ctx.lineWidth = 1;
    rr(ctx, -bw / 2, by, bw, bh, 2.5); ctx.stroke();
    // team pip
    ctx.globalAlpha = 1;
    ctx.fillStyle = TEAM[u.team].color;
    ctx.beginPath();
    ctx.moveTo(0, by - 9); ctx.lineTo(4.5, by - 14); ctx.lineTo(-4.5, by - 14);
    ctx.closePath(); ctx.fill();

    if (u.isPlayer) {
      const bounce = Math.sin(t * 4) * 2;
      ctx.save();
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = '900 9px "Arial Black", system-ui, sans-serif';
      const label = 'TÚ';
      const tw = ctx.measureText(label).width + 12;
      ctx.fillStyle = 'rgba(6,9,8,0.8)';
      rr(ctx, -tw / 2, by - 40 + bounce, tw, 13, 4); ctx.fill();
      ctx.strokeStyle = '#ffd166'; ctx.globalAlpha = 0.8; ctx.lineWidth = 1;
      rr(ctx, -tw / 2, by - 40 + bounce, tw, 13, 4); ctx.stroke();
      ctx.globalAlpha = 1;
      ctx.fillStyle = '#ffd166';
      ctx.fillText(label, 0, by - 33 + bounce);
      ctx.beginPath();
      ctx.moveTo(0, by - 25 + bounce);
      ctx.lineTo(4, by - 20 + bounce);
      ctx.lineTo(-4, by - 20 + bounce);
      ctx.closePath(); ctx.fill();
      ctx.restore();
    }
    ctx.restore();
  }
  ctx.restore();
}

/* ------------------------------------------------------------------ */
/* projectiles, pools, effects                                         */
/* ------------------------------------------------------------------ */
export function drawProjectile(ctx, p, t) {
  const h = 46 + (p.z || 0);
  if (p.kind === 'egg') {
    // ground shadow
    shadowEllipse(ctx, p.x, p.y, 7 + (p.z || 0) * 0.02, 3.2, 0.35);
    ctx.save();
    ctx.translate(p.x, p.y - h);
    ctx.rotate(p.spin || 0);
    ctx.globalCompositeOperation = 'lighter';
    const glow = ctx.createRadialGradient(0, 0, 2, 0, 0, 26);
    glow.addColorStop(0, 'rgba(125,255,60,0.32)');
    glow.addColorStop(1, 'rgba(125,255,60,0)');
    ctx.fillStyle = glow;
    ctx.beginPath(); ctx.arc(0, 0, 26, 0, TAU); ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
    drawEgg(ctx, 0, 0, 9, p.seed, false);
    ctx.restore();
  } else {
    shadowEllipse(ctx, p.x, p.y, 8, 3, 0.3);
    ctx.save();
    ctx.translate(p.x, p.y - h);
    ctx.rotate(p.angle);
    // trail
    ctx.globalCompositeOperation = 'lighter';
    const tr = ctx.createLinearGradient(-52, 0, 6, 0);
    tr.addColorStop(0, 'rgba(125,255,60,0)');
    tr.addColorStop(0.6, 'rgba(125,255,60,0.32)');
    tr.addColorStop(1, 'rgba(240,255,210,0.9)');
    ctx.strokeStyle = tr;
    ctx.lineWidth = 5;
    ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(-54, 0); ctx.lineTo(0, 0); ctx.stroke();
    // feather body
    const fb = ctx.createLinearGradient(-8, 0, 30, 0);
    fb.addColorStop(0, '#2f6b32');
    fb.addColorStop(0.5, '#9dff6e');
    fb.addColorStop(1, '#f4ffe4');
    ctx.fillStyle = fb;
    ctx.beginPath();
    ctx.moveTo(-14, 0);
    ctx.quadraticCurveTo(2, -7, 28, 0);
    ctx.quadraticCurveTo(2, 7, -14, 0);
    ctx.fill();
    ctx.strokeStyle = 'rgba(220,255,200,0.9)';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(-16, 0); ctx.lineTo(26, 0); ctx.stroke();
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = 'rgba(180,255,130,0.8)';
    ctx.beginPath(); ctx.arc(22, 0, 3.2, 0, TAU); ctx.fill();
    ctx.restore();
  }
}

export function drawPool(ctx, pool, t) {
  const lifeRatio = pool.life / pool.maxLife;
  const fade = clamp(lifeRatio * 4, 0, 1) * clamp(pool.life * 2, 0, 1);
  const grow = clamp(pool.maxLife - pool.life + 0.18, 0, 1);
  const r = pool.r * (0.5 + 0.5 * grow) * (0.96 + Math.sin(t * 3 + pool.seed) * 0.035);
  if (r < 2) return;
  const ys = 0.56;

  const blobPath = (radius, wobble) => {
    ctx.beginPath();
    for (let i = 0; i <= 26; i++) {
      const a = (i / 26) * TAU;
      const rr = radius * (1 + Math.sin(a * 3 + pool.seed) * 0.07 * wobble + Math.sin(a * 5 - pool.seed * 0.7 + t * 0.7) * 0.045 * wobble);
      const px = pool.x + Math.cos(a) * rr;
      const py = pool.y + Math.sin(a) * rr * ys;
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.closePath();
  };

  ctx.save();
  ctx.globalAlpha = fade;

  // scorched crust
  blobPath(r * 1.14, 1.2);
  ctx.fillStyle = 'rgba(4,7,4,0.78)';
  ctx.fill();

  // molten body
  blobPath(r, 1);
  const g = ctx.createRadialGradient(pool.x - r * 0.14, pool.y - r * 0.12, r * 0.08, pool.x, pool.y, r);
  g.addColorStop(0, '#e4ffb0');
  g.addColorStop(0.35, '#8dff4e');
  g.addColorStop(0.72, '#2fae35');
  g.addColorStop(0.93, '#14631c');
  g.addColorStop(1, '#08260c');
  ctx.fillStyle = g;
  ctx.fill();

  // dark shell islands
  ctx.fillStyle = 'rgba(6,10,6,0.55)';
  for (let i = 0; i < 4; i++) {
    const a = pool.seed + i * 2.1 + t * 0.15;
    const bx = pool.x + Math.cos(a) * r * 0.58;
    const by = pool.y + Math.sin(a) * r * 0.58 * ys;
    ctx.beginPath();
    ctx.ellipse(bx, by, r * 0.14, r * 0.07, a, 0, TAU);
    ctx.fill();
  }

  // bubbles
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 6; i++) {
    const a = pool.seed + i * 2.4;
    const bx = pool.x + Math.cos(a + t * 0.4 + i) * r * 0.6;
    const by = pool.y + Math.sin(a * 1.7 + t * 0.5) * r * 0.3;
    const s = 1.2 + Math.abs(Math.sin(t * 3.6 + i + pool.seed)) * 2;
    ctx.fillStyle = 'rgba(235,255,200,0.7)';
    ctx.beginPath(); ctx.arc(bx, by, s, 0, TAU); ctx.fill();
  }
  const glow = ctx.createRadialGradient(pool.x, pool.y, 0, pool.x, pool.y, r * 1.35);
  glow.addColorStop(0, 'rgba(125,255,60,0.16)');
  glow.addColorStop(1, 'rgba(125,255,60,0)');
  ctx.fillStyle = glow;
  ctx.beginPath(); ctx.ellipse(pool.x, pool.y, r * 1.35, r * 0.76, 0, 0, TAU); ctx.fill();
  ctx.restore();
}

export function drawParticle(ctx, p) {
  const a = clamp(p.life / p.maxLife, 0, 1);
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.rotate(p.rot || 0);
  ctx.globalAlpha = a;
  if (p.kind === 'feather') {
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.ellipse(0, 0, p.size * 1.8, p.size * 0.7, 0, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.3)';
    ctx.lineWidth = 0.7;
    ctx.beginPath(); ctx.moveTo(-p.size * 1.6, 0); ctx.lineTo(p.size * 1.6, 0); ctx.stroke();
  } else if (p.kind === 'goo') {
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = p.color;
    ctx.beginPath(); ctx.arc(0, 0, p.size * a + 0.5, 0, TAU); ctx.fill();
  } else if (p.kind === 'smoke') {
    ctx.fillStyle = p.color;
    ctx.globalAlpha = a * 0.4;
    ctx.beginPath(); ctx.arc(0, 0, p.size * (1.6 - a * 0.6), 0, TAU); ctx.fill();
  } else if (p.kind === 'ember') {
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = p.color;
    ctx.beginPath(); ctx.arc(0, 0, p.size, 0, TAU); ctx.fill();
  } else {
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = p.color;
    ctx.beginPath(); ctx.arc(0, 0, Math.max(0.4, p.size * a), 0, TAU); ctx.fill();
  }
  ctx.restore();
}

export function drawFloatText(ctx, f) {
  const a = clamp(f.life / f.maxLife, 0, 1);
  ctx.save();
  ctx.globalAlpha = a;
  ctx.font = `900 ${f.size}px "Arial Black", system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.lineWidth = 4;
  ctx.strokeStyle = 'rgba(0,0,0,0.8)';
  ctx.strokeText(f.text, f.x, f.y);
  ctx.fillStyle = f.color;
  ctx.fillText(f.text, f.x, f.y);
  ctx.restore();
}

export function drawBeam(ctx, b) {
  const a = clamp(b.life / b.maxLife, 0, 1);
  const w = b.width * (0.5 + a * 0.8);
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = a;
  ctx.lineCap = 'round';
  const g = ctx.createLinearGradient(b.x1, b.y1, b.x2, b.y2);
  g.addColorStop(0, 'rgba(255,255,230,0.95)');
  g.addColorStop(0.6, 'rgba(150,255,90,0.9)');
  g.addColorStop(1, 'rgba(80,255,60,0.2)');
  ctx.strokeStyle = g;
  ctx.lineWidth = w;
  ctx.shadowColor = '#7dff3c';
  ctx.shadowBlur = 30;
  ctx.beginPath(); ctx.moveTo(b.x1, b.y1); ctx.lineTo(b.x2, b.y2); ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,240,0.9)';
  ctx.lineWidth = Math.max(1, w * 0.22);
  ctx.beginPath(); ctx.moveTo(b.x1, b.y1); ctx.lineTo(b.x2, b.y2); ctx.stroke();
  ctx.restore();
  // flare
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = a;
  const fg = ctx.createRadialGradient(b.x1, b.y1, 0, b.x1, b.y1, 46);
  fg.addColorStop(0, 'rgba(255,255,220,0.9)');
  fg.addColorStop(1, 'rgba(125,255,60,0)');
  ctx.fillStyle = fg;
  ctx.beginPath(); ctx.arc(b.x1, b.y1, 46, 0, TAU); ctx.fill();
  ctx.restore();
}

export function drawShockwave(ctx, s) {
  const a = clamp(s.life / s.maxLife, 0, 1);
  const r = s.r;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = a * 0.8;
  ctx.strokeStyle = s.color;
  ctx.lineWidth = 4 * a + 1;
  ctx.beginPath(); ctx.ellipse(s.x, s.y, r, r * 0.55, 0, 0, TAU); ctx.stroke();
  ctx.restore();
}

/* ------------------------------------------------------------------ */
/* HUD                                                                 */
/* ------------------------------------------------------------------ */
function roleIcon(ctx, x, y, role, size, color) {
  ctx.save();
  ctx.translate(x, y);
  if (role === 'dash') {
    ctx.strokeStyle = color;
    ctx.lineWidth = Math.max(1.4, size * 0.13);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    for (let i = 0; i < 2; i++) {
      ctx.beginPath();
      ctx.moveTo(-size * 0.42 + i * size * 0.4, -size * 0.46);
      ctx.lineTo(size * 0.02 + i * size * 0.4, 0);
      ctx.lineTo(-size * 0.42 + i * size * 0.4, size * 0.46);
      ctx.stroke();
    }
  } else if (role === 'brawler') {
    ctx.globalCompositeOperation = 'lighter';
    const glow = ctx.createRadialGradient(0, 0, 1, 0, 0, size * 0.95);
    glow.addColorStop(0, 'rgba(125,255,60,0.28)');
    glow.addColorStop(1, 'rgba(125,255,60,0)');
    ctx.fillStyle = glow;
    ctx.beginPath(); ctx.arc(0, 0, size * 0.95, 0, TAU); ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = '#101a0d';
    ctx.strokeStyle = color;
    ctx.lineWidth = Math.max(1.2, size * 0.1);
    ctx.beginPath(); ctx.ellipse(0, 0, size * 0.5, size * 0.65, -0.2, 0, TAU); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = '#7dff3c';
    ctx.lineWidth = Math.max(1.2, size * 0.1);
    ctx.shadowColor = '#7dff3c';
    ctx.shadowBlur = 6;
    ctx.beginPath(); ctx.moveTo(-size * 0.2, -size * 0.22); ctx.lineTo(0, 0); ctx.lineTo(-size * 0.12, size * 0.3); ctx.stroke();
  } else {
    ctx.rotate(-0.6);
    ctx.fillStyle = color;
    ctx.beginPath(); ctx.ellipse(0, 0, size * 0.66, size * 0.26, 0, 0, TAU); ctx.fill();
    ctx.strokeStyle = '#eaffd2';
    ctx.lineWidth = 0.8;
    ctx.beginPath(); ctx.moveTo(-size * 0.6, 0); ctx.lineTo(size * 0.6, 0); ctx.stroke();
  }
  ctx.restore();
}

function panel(ctx, x, y, w, h, r = 10) {
  ctx.fillStyle = 'rgba(6,9,10,0.78)';
  rr(ctx, x, y, w, h, r); ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.10)';
  ctx.lineWidth = 1;
  rr(ctx, x, y, w, h, r); ctx.stroke();
}

export function drawHUD(ctx, game, view) {
  const { w, h, insets, isTouch, layout } = view;
  const top = insets.top + 10;
  const player = game.player;

  // ---- scoreboard ----
  const mobile = isTouch;
  const sw = mobile ? 196 : 300;
  const sh = mobile ? 44 : 56;
  const sx = w / 2 - sw / 2;
  panel(ctx, sx, top, sw, sh, 12);
  // team color strips
  const strip = 5;
  ctx.fillStyle = TEAM[0].color;
  rr(ctx, sx + 1, top + 1, strip, sh - 2, 4); ctx.fill();
  ctx.fillStyle = TEAM[1].color;
  rr(ctx, sx + sw - strip - 1, top + 1, strip, sh - 2, 4); ctx.fill();

  const scoreY = top + (mobile ? 21 : 25);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `900 ${mobile ? 19 : 24}px "Arial Black", system-ui, sans-serif`;
  ctx.fillStyle = TEAM[0].soft;
  ctx.fillText(String(game.scores[0]).padStart(2, '0'), sx + 46, scoreY);
  ctx.fillStyle = TEAM[1].soft;
  ctx.fillText(String(game.scores[1]).padStart(2, '0'), sx + sw - 46, scoreY);

  const tsec = Math.max(0, Math.ceil(game.timer));
  const mm = Math.floor(tsec / 60);
  const ss = String(tsec % 60).padStart(2, '0');
  ctx.font = `900 ${mobile ? 14 : 17}px "Arial Black", system-ui, sans-serif`;
  ctx.fillStyle = tsec <= 15 ? '#ff6a5c' : '#f2e8d5';
  ctx.fillText(`${mm}:${ss}`, w / 2, scoreY - (mobile ? 0 : 1));
  ctx.font = `800 ${mobile ? 6 : 7}px system-ui, sans-serif`;
  ctx.fillStyle = 'rgba(220,210,190,0.55)';
  ctx.fillText('PRIMERO A 10', w / 2, top + sh - (mobile ? 7 : 9));
  ctx.font = `800 ${mobile ? 7 : 8}px system-ui, sans-serif`;
  ctx.fillStyle = 'rgba(56,214,255,0.75)';
  ctx.fillText('AZUL', sx + 46, top + sh - (mobile ? 7 : 9));
  ctx.fillStyle = 'rgba(255,77,99,0.8)';
  ctx.fillText('ROJO', sx + sw - 46, top + sh - (mobile ? 7 : 9));

  // ---- rosters ----
  const rosterY = top + sh + (mobile ? 8 : 9);
  if (!mobile) {
    drawRoster(ctx, game, 0, 14, rosterY, 186, player);
    drawRoster(ctx, game, 1, w - 14 - 186, rosterY, 186, player);
  } else {
    drawRosterCompact(ctx, game, 0, 8 + insets.left, rosterY, player);
    drawRosterCompact(ctx, game, 1, w - 8 - insets.right, rosterY, player);
  }

  // ---- kill feed ----
  const feedX = mobile ? w - 8 - insets.right : w - 14 - 186;
  let feedY = rosterY + (mobile ? 46 : 84);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  for (let i = 0; i < Math.min(3, game.feed.length); i++) {
    const f = game.feed[i];
    const a = clamp(f.life / 1.2, 0, 1);
    ctx.globalAlpha = a;
    ctx.font = `800 ${mobile ? 8 : 9.5}px system-ui, sans-serif`;
    const ty = feedY + i * (mobile ? 12 : 14);
    const atk = f.a, vic = f.b;
    const aw = ctx.measureText(atk).width;
    const vw = ctx.measureText(vic).width;
    const total = aw + vw + 13;
    const startX = feedX - total;
    ctx.fillStyle = 'rgba(5,8,8,0.62)';
    rr(ctx, startX - 5, ty - 7, total + 10, 14, 4); ctx.fill();
    ctx.fillStyle = TEAM[f.team].soft;
    ctx.fillText(atk, startX, ty);
    ctx.fillStyle = 'rgba(235,225,205,0.45)';
    ctx.fillText('×', startX + aw + 3, ty);
    ctx.fillStyle = TEAM[1 - f.team].soft;
    ctx.fillText(vic, startX + aw + 12, ty);
  }
  ctx.globalAlpha = 1;

  // ---- announcements ----
  if (game.announce && game.announce.life > 0) {
    const an = game.announce;
    const k = 1 - an.life / an.maxLife;
    const pop = clamp(k * 7, 0, 1);
    const fade = clamp(an.life / 0.5, 0, 1);
    ctx.save();
    ctx.globalAlpha = fade;
    ctx.translate(w / 2, Math.max(h * 0.23, mobile ? 124 : 0));
    ctx.scale(0.85 + pop * 0.15, 0.85 + pop * 0.15);
    ctx.textAlign = 'center';
    ctx.font = `900 ${mobile ? 26 : 42}px "Arial Black", system-ui, sans-serif`;
    ctx.lineWidth = 6;
    ctx.strokeStyle = 'rgba(4,7,6,0.8)';
    ctx.strokeText(an.text, 0, 0);
    const g = ctx.createLinearGradient(0, -28, 0, 16);
    g.addColorStop(0, '#fff6da');
    g.addColorStop(0.55, an.color);
    g.addColorStop(1, '#8c3a12');
    ctx.fillStyle = g;
    ctx.fillText(an.text, 0, 0);
    if (an.sub) {
      ctx.font = `800 ${mobile ? 9 : 11}px system-ui, sans-serif`;
      ctx.fillStyle = 'rgba(240,232,215,0.82)';
      ctx.fillText(an.sub, 0, mobile ? 18 : 24);
    }
    ctx.restore();
  }

  // ---- player status / abilities ----
  if (player) {
    if (player.alive) {
      if (mobile) drawAbilityButton(ctx, layout.special, player.specialCd, ROLE[player.def.role].specialCd, 'ESP', player.def.role, '#ffd166');
      if (mobile) drawAbilityButton(ctx, layout.dash, player.dashCd, ROLE[player.def.role].dashCd, 'DASH', 'dash', TEAM[0].color);
      if (!mobile) drawDesktopAbilities(ctx, w, h, insets, player);
    } else {
      ctx.save();
      ctx.textAlign = 'center';
      ctx.fillStyle = 'rgba(255,80,80,0.9)';
      ctx.font = `900 ${mobile ? 16 : 22}px "Arial Black", system-ui, sans-serif`;
      ctx.fillText('ELIMINADO', w / 2, h * 0.42);
      ctx.fillStyle = 'rgba(240,230,210,0.8)';
      ctx.font = `800 ${mobile ? 10 : 12}px system-ui, sans-serif`;
      ctx.fillText(`VUELVES EN ${Math.max(0, player.respawn).toFixed(1)}s`, w / 2, h * 0.42 + (mobile ? 17 : 22));
      ctx.restore();
    }
  }

  // ---- touch sticks ----
  if (isTouch && game.state === 'playing') {
    drawStick(ctx, layout.move, view.moveStick, 'MOVER', TEAM[0].color);
    drawStick(ctx, layout.aim, view.aimStick, 'APUNTAR', '#ffd166');
  }

  // ---- hint ----
  if (!mobile && game.state === 'playing' && game.roundTime < 9) {
    const a = clamp(9 - game.roundTime, 0, 1) * clamp(game.roundTime, 0, 1);
    ctx.save();
    ctx.globalAlpha = Math.min(1, a) * 0.75;
    ctx.textAlign = 'center';
    ctx.font = '800 10px system-ui, sans-serif';
    ctx.fillStyle = '#e5dbc8';
    ctx.fillText('WASD MOVER · RATÓN APUNTAR · CLICK LANZAR · SHIFT DASH · ESPACIO ESPECIAL', w / 2, h - 18 - insets.bottom);
    ctx.restore();
  }
}

function drawRoster(ctx, game, team, x, y, width, player) {
  panel(ctx, x - 6, y - 5, width + 12, 78, 9);
  const units = game.units.filter(u => u.team === team);
  for (let i = 0; i < units.length; i++) {
    const u = units[i];
    const ry = y + 5 + i * 17;
    roleIcon(ctx, x + 6, ry + 2, u.def.role, 8, TEAM[team].color);
    ctx.textAlign = 'left';
    ctx.font = `900 8.5px system-ui, sans-serif`;
    ctx.fillStyle = u.alive ? '#ede3d0' : 'rgba(160,150,135,0.45)';
    ctx.fillText(u.def.name, x + 16, ry + 4);
    if (u.isPlayer) {
      ctx.fillStyle = '#ffd166';
      ctx.fillText('●', x + 16 + ctx.measureText(u.def.name).width + 3, ry + 4);
    }
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    rr(ctx, x + 56, ry - 1, width - 78, 4, 2); ctx.fill();
    if (u.alive) {
      const ratio = clamp(u.hp / u.maxHp, 0, 1);
      ctx.fillStyle = ratio > 0.5 ? TEAM[team].color : ratio > 0.25 ? '#ffd166' : '#ff4d4d';
      rr(ctx, x + 56, ry - 1, (width - 78) * ratio, 4, 2); ctx.fill();
    } else {
      ctx.fillStyle = 'rgba(255,90,90,0.3)';
      ctx.font = '800 7px system-ui, sans-serif';
      ctx.fillText(`${Math.max(0, u.respawn).toFixed(0)}s`, x + width - 42, ry + 4);
    }
  }
}

function drawRosterCompact(ctx, game, team, x, y, player) {
  const units = game.units.filter(u => u.team === team);
  const right = team === 1;
  for (let i = 0; i < units.length; i++) {
    const u = units[i];
    const ry = y + 3 + i * 9;
    const bx = right ? x - 58 : x + 14;
    roleIcon(ctx, right ? x - 61 : x + 5, ry + 3, u.def.role, 5.5, TEAM[team].color);
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    rr(ctx, bx, ry, 58, 5, 2); ctx.fill();
    if (u.alive) {
      const ratio = clamp(u.hp / u.maxHp, 0, 1);
      ctx.fillStyle = u.isPlayer ? '#ffd166' : ratio > 0.5 ? TEAM[team].color : ratio > 0.25 ? '#ffd166' : '#ff4d4d';
      rr(ctx, bx, ry, 58 * ratio, 5, 2); ctx.fill();
    } else {
      ctx.fillStyle = 'rgba(255,90,90,0.35)';
      rr(ctx, bx, ry, 58, 5, 2); ctx.fill();
    }
  }
}

function drawDesktopAbilities(ctx, w, h, insets, player) {
  const role = ROLE[player.def.role];
  const baseY = h - 34 - insets.bottom;
  const items = [
    { label: 'DASH', key: 'SHIFT', cd: player.dashCd, max: role.dashCd, color: TEAM[0].color, icon: 'dash' },
    { label: 'ESPECIAL', key: 'ESPACIO', cd: player.specialCd, max: role.specialCd, color: '#ffd166', icon: player.def.role }
  ];
  const totalW = 300;
  let x = w / 2 - totalW / 2;
  for (const it of items) {
    const ready = it.cd <= 0;
    panel(ctx, x, baseY - 24, 142, 30, 8);
    roleIcon(ctx, x + 17, baseY - 9, it.icon, 10, it.color);
    ctx.textAlign = 'left';
    ctx.font = '900 9px system-ui, sans-serif';
    ctx.fillStyle = ready ? it.color : 'rgba(180,170,155,0.5)';
    ctx.fillText(it.label, x + 30, baseY - 5);
    ctx.font = '800 7px system-ui, sans-serif';
    ctx.fillStyle = 'rgba(220,210,190,0.5)';
    ctx.fillText(ready ? it.key : `${it.cd.toFixed(1)}s`, x + 30, baseY + 3);
    // cooldown bar
    const ratio = ready ? 1 : 1 - it.cd / it.max;
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    rr(ctx, x + 92, baseY - 10, 42, 4, 2); ctx.fill();
    ctx.fillStyle = it.color;
    rr(ctx, x + 92, baseY - 10, 42 * ratio, 4, 2); ctx.fill();
    x += 156;
  }
}

function drawAbilityButton(ctx, b, cd, max, label, icon, color) {
  const ready = cd <= 0;
  ctx.save();
  ctx.translate(b.x, b.y);
  ctx.fillStyle = 'rgba(6,10,10,0.62)';
  ctx.beginPath(); ctx.arc(0, 0, b.r, 0, TAU); ctx.fill();
  ctx.strokeStyle = ready ? color : 'rgba(255,255,255,0.18)';
  ctx.globalAlpha = ready ? 0.9 : 0.55;
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(0, 0, b.r, 0, TAU); ctx.stroke();
  ctx.globalAlpha = 1;
  if (!ready) {
    ctx.strokeStyle = color;
    ctx.globalAlpha = 0.75;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, 0, b.r - 1.5, -Math.PI / 2, -Math.PI / 2 + TAU * (1 - cd / max));
    ctx.stroke();
    ctx.globalAlpha = 1;
  }
  roleIcon(ctx, 0, -4, icon, b.r * 0.8, ready ? color : 'rgba(180,170,155,0.6)');
  ctx.textAlign = 'center';
  ctx.font = '900 7px system-ui, sans-serif';
  ctx.fillStyle = ready ? 'rgba(240,232,215,0.9)' : 'rgba(180,170,155,0.6)';
  ctx.fillText(label, 0, b.r * 0.62);
  ctx.restore();
}

function drawStick(ctx, base, state, label, color) {
  if (!base) return;
  const active = !!state;
  const bx = state ? state.baseX : base.x;
  const by = state ? state.baseY : base.y;
  ctx.save();
  ctx.globalAlpha = active ? 0.72 : 0.34;
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(bx, by, base.r, 0, TAU); ctx.stroke();
  ctx.fillStyle = 'rgba(5,9,9,0.25)';
  ctx.beginPath(); ctx.arc(bx, by, base.r, 0, TAU); ctx.fill();
  if (active) {
    const dx = (state.nx || 0) * base.r * 0.55;
    const dy = (state.ny || 0) * base.r * 0.55;
    ctx.globalAlpha = 0.85;
    ctx.fillStyle = color;
    ctx.beginPath(); ctx.arc(bx + dx, by + dy, base.r * 0.34, 0, TAU); ctx.fill();
    ctx.globalAlpha = 0.25;
    ctx.beginPath(); ctx.arc(bx + dx, by + dy, base.r * 0.52, 0, TAU); ctx.fill();
  } else {
    ctx.globalAlpha = 0.5;
    ctx.fillStyle = color;
    ctx.beginPath(); ctx.arc(bx, by, base.r * 0.28, 0, TAU); ctx.fill();
  }
  ctx.globalAlpha = 0.6;
  ctx.textAlign = 'center';
  ctx.font = '900 7px system-ui, sans-serif';
  ctx.fillStyle = '#e9dfca';
  ctx.fillText(label, bx, by + base.r + 13);
  ctx.restore();
}

export function drawOffscreenMarkers(ctx, game, view) {
  const { w, h, camera, insets } = view;
  for (const u of game.units) {
    if (!u.alive || u.team === 0) continue;
    const s = worldToScreen(u.x, u.y - 60, camera, w, h);
    const margin = 26;
    if (s.x > margin && s.x < w - margin && s.y > margin + insets.top && s.y < h - margin) continue;
    const cx = w / 2, cy = h / 2;
    const ang = Math.atan2(s.y - cy, s.x - cx);
    const rx = Math.min(w / 2 - margin, h / 2 - margin);
    const ex = cx + Math.cos(ang) * (w / 2 - margin);
    const ey = cy + Math.sin(ang) * (h / 2 - margin);
    ctx.save();
    ctx.translate(ex, ey);
    ctx.rotate(ang);
    ctx.globalAlpha = 0.7;
    ctx.fillStyle = TEAM[1].color;
    ctx.beginPath(); ctx.moveTo(7, 0); ctx.lineTo(-5, -5); ctx.lineTo(-5, 5); ctx.closePath(); ctx.fill();
    ctx.restore();
  }
}

export function worldToScreen(x, y, camera, w, h) {
  return {
    x: (x - camera.x) * camera.zoom + w / 2 + camera.shakeX,
    y: (y - camera.y) * camera.zoom + h / 2 + camera.shakeY
  };
}

export function drawVignette(ctx, w, h) {
  const g = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.32, w / 2, h / 2, Math.max(w, h) * 0.78);
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(0.65, 'rgba(0,0,0,0.16)');
  g.addColorStop(1, 'rgba(0,0,0,0.62)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
}

export function drawPause(ctx, w, h) {
  ctx.save();
  ctx.fillStyle = 'rgba(3,5,6,0.7)';
  ctx.fillRect(0, 0, w, h);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#f2e8d5';
  ctx.font = '900 42px "Arial Black", system-ui, sans-serif';
  ctx.fillText('PAUSA', w / 2, h / 2);
  ctx.font = '800 11px system-ui, sans-serif';
  ctx.fillStyle = 'rgba(220,210,190,0.7)';
  ctx.fillText('P O ESC PARA CONTINUAR', w / 2, h / 2 + 26);
  ctx.restore();
}

export { rr };
