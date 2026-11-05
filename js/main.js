import { Game } from './game.js';
import { FIGHTERS, ROLE, TEAM, WORLD } from './roster.js';
import {
  drawChampion, drawHUD, drawVignette, drawPause, drawOffscreenMarkers,
  worldToScreen, clamp
} from './render.js';
import { Sfx } from './audio.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d', { alpha: false });
const probe = document.getElementById('safe-probe');
const menu = document.getElementById('menu');
const result = document.getElementById('result');
const roster = document.getElementById('roster');
const playBtn = document.getElementById('playBtn');
const soundBtn = document.getElementById('soundBtn');
const soundLabel = document.getElementById('soundLabel');
const rematchBtn = document.getElementById('rematchBtn');
const menuBtn = document.getElementById('menuBtn');

let w = window.innerWidth;
let h = window.innerHeight;
let dpr = 1;
let isTouchUI = false;
let insets = { top: 0, right: 0, bottom: 0, left: 0 };
let layout = null;

const game = new Game();
const camera = { x: WORLD.cx, y: WORLD.cy, zoom: 1, shakeX: 0, shakeY: 0 };
let zoomInit = false;

const sticks = { move: null, aim: null };
const keys = new Set();
const queue = { dash: false, special: false };
const mouse = { x: 0, y: 0, down: false, seen: false };
let selectedIndex = 0;

/* ------------------------------------------------------------------ */
/* menu                                                                */
/* ------------------------------------------------------------------ */
function buildRoster() {
  FIGHTERS.slice(0, 4).forEach((def, i) => {
    const role = ROLE[def.role];
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `card ${def.role}${i === selectedIndex ? ' selected' : ''}`;
    btn.dataset.index = i;
    btn.setAttribute('aria-label', `Elegir a ${def.name}, ${role.label.toLowerCase()}`);
    btn.innerHTML = `
      <canvas class="portrait" width="260" height="230"></canvas>
      <span class="chip">${role.short}</span>
      <span class="cname">${def.name}</span>
      <span class="ctitle">${def.title}</span>
      <span class="rolebar"></span>`;
    btn.addEventListener('click', () => {
      selectedIndex = i;
      document.querySelectorAll('.card').forEach(c => c.classList.toggle('selected', Number(c.dataset.index) === i));
      Sfx.ensure(); Sfx.ui();
    });
    roster.appendChild(btn);

    const pc = btn.querySelector('canvas');
    const pctx = pc.getContext('2d');
    pctx.clearRect(0, 0, pc.width, pc.height);
    const g = pctx.createRadialGradient(130, 120, 10, 130, 120, 125);
    g.addColorStop(0, 'rgba(125,255,60,.16)');
    g.addColorStop(0.5, `${TEAM[0].color}12`);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    pctx.fillStyle = g;
    pctx.fillRect(0, 0, pc.width, pc.height);

    // floor halo
    pctx.save();
    pctx.strokeStyle = `${TEAM[0].color}44`;
    pctx.lineWidth = 2;
    pctx.beginPath(); pctx.ellipse(130, 220, 64, 14, 0, 0, Math.PI * 2); pctx.stroke();
    pctx.restore();

    const dummy = {
      def, team: 0, role: def.role, x: 124, y: 224,
      vx: 0, vy: 0, aim: def.role === 'sniper' ? -0.22 : -0.04,
      walkPhase: 0, seed: i * 17, hp: role.hp, maxHp: role.hp,
      hitFlash: 0, invuln: 0, isPlayer: false, r: role.radius,
      flash: 0
    };
    drawChampion(pctx, dummy, 0.6, { portrait: true, bars: false, scale: 1.32 });
  });
}

function selectCard(i) {
  selectedIndex = i;
  document.querySelectorAll('.card').forEach(c => c.classList.toggle('selected', Number(c.dataset.index) === i));
}

function startGame() {
  Sfx.ensure();
  menu.classList.add('hidden');
  result.classList.add('hidden');
  game.start(selectedIndex);
  sticks.move = null; sticks.aim = null;
  mouse.down = false; mouse.seen = false;
  queue.dash = false; queue.special = false;
}

function showMenu() {
  result.classList.add('hidden');
  menu.classList.remove('hidden');
  game.startAttract();
}

playBtn.addEventListener('click', startGame);
rematchBtn.addEventListener('click', startGame);
menuBtn.addEventListener('click', showMenu);
soundBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  toggleSound();
});

function toggleSound() {
  Sfx.ensure();
  const muted = Sfx.toggle();
  soundBtn.classList.toggle('muted', muted);
  soundBtn.setAttribute('aria-pressed', String(muted));
  soundBtn.setAttribute('aria-label', muted ? 'Activar el sonido' : 'Silenciar el sonido');
  soundLabel.textContent = muted ? 'SIN SONIDO' : 'SONIDO';
  return muted;
}

game.onEnd = (res) => {
  const title = document.getElementById('resultTitle');
  const kicker = document.getElementById('resultKicker');
  const score = document.getElementById('resultScore');
  const sub = document.getElementById('resultSub');
  const lines = [
    'La arena huele a azufre y plumas.',
    'Otra ronda y el coliseo arde.',
    'Los huevos negros no perdonan.',
    'Alguien tendrá que barrer las plumas.'
  ];
  if (res.winner === 0) {
    kicker.textContent = 'ARENA CONQUISTADA';
    title.textContent = '¡VICTORIA!';
    title.classList.remove('lose');
    sub.textContent = lines[Math.floor(Math.random() * lines.length)];
  } else if (res.winner === 1) {
    kicker.textContent = 'LA YEMA OSCURA GANA';
    title.textContent = 'DERROTA';
    title.classList.add('lose');
    sub.textContent = 'Sacude las plumas y vuelve por revancha.';
  } else {
    kicker.textContent = 'NADIE CEDE';
    title.textContent = 'EMPATE';
    title.classList.remove('lose');
    sub.textContent = 'El coliseo pide una ronda más.';
  }
  score.textContent = `${res.blue} — ${res.red}`;
  result.classList.remove('hidden');
};

/* ------------------------------------------------------------------ */
/* sizing / layout                                                     */
/* ------------------------------------------------------------------ */
function measure() {
  w = window.innerWidth;
  h = window.innerHeight;
  dpr = Math.min(2, window.devicePixelRatio || 1);
  canvas.width = Math.round(w * dpr);
  canvas.height = Math.round(h * dpr);
  canvas.style.width = `${w}px`;
  canvas.style.height = `${h}px`;
  const cs = getComputedStyle(probe);
  insets = {
    top: parseFloat(cs.paddingTop) || 0,
    right: parseFloat(cs.paddingRight) || 0,
    bottom: parseFloat(cs.paddingBottom) || 0,
    left: parseFloat(cs.paddingLeft) || 0
  };
  isTouchUI = window.matchMedia('(pointer: coarse)').matches || w < 800;
  const bottom = insets.bottom;
  const short = h < 560;
  layout = short ? {
    move: { x: 82 + insets.left, y: h - 98 - bottom, r: 54 },
    aim: { x: w - 88 - insets.right, y: h - 98 - bottom, r: 54 },
    special: { x: w - 88 - insets.right, y: h - 192 - bottom, r: 31 },
    dash: { x: w - 168 - insets.right, y: h - 220 - bottom, r: 27 }
  } : {
    move: { x: 82 + insets.left, y: h - 98 - bottom, r: 54 },
    aim: { x: w - 88 - insets.right, y: h - 98 - bottom, r: 54 },
    special: { x: w - 66 - insets.right, y: h - 244 - bottom, r: 33 },
    dash: { x: w - 158 - insets.right, y: h - 208 - bottom, r: 28 }
  };
}
window.addEventListener('resize', measure);
window.addEventListener('orientationchange', () => setTimeout(measure, 120));

/* ------------------------------------------------------------------ */
/* input                                                               */
/* ------------------------------------------------------------------ */
function screenToWorld(sx, sy) {
  return {
    x: (sx - w / 2 - camera.shakeX) / camera.zoom + camera.x,
    y: (sy - h / 2 - camera.shakeY) / camera.zoom + camera.y
  };
}

function hitButton(b, x, y) {
  return b && Math.hypot(x - b.x, y - b.y) < b.r + 6;
}

function onPointerDown(e) {
  if (menu.classList.contains('hidden') === false) return;
  if (result.classList.contains('hidden') === false) return;

  if (e.pointerType === 'mouse') {
    mouse.seen = true;
    mouse.x = e.clientX; mouse.y = e.clientY;
    if (e.button === 0) mouse.down = true;
    return;
  }

  const x = e.clientX, y = e.clientY;
  if (game.state !== 'playing') return;

  if (hitButton(layout.special, x, y)) {
    if (game.player && game.player.alive) { queue.special = true; Sfx.ui(); }
    return;
  }
  if (hitButton(layout.dash, x, y)) {
    if (game.player && game.player.alive) { queue.dash = true; Sfx.ui(); }
    return;
  }
  if (x < w * 0.46) {
    if (!sticks.move) {
      sticks.move = {
        id: e.pointerId,
        baseX: clamp(x, 60 + insets.left, w * 0.46),
        baseY: clamp(y, 120, h - 20 - insets.bottom),
        nx: 0, ny: 0
      };
    }
    return;
  }
  if (x > w * 0.54) {
    if (!sticks.aim) {
      sticks.aim = {
        id: e.pointerId,
        baseX: clamp(x, w * 0.55, w - 40 - insets.right),
        baseY: clamp(y, 120, h - 20 - insets.bottom),
        nx: 0, ny: 0
      };
    }
  }
}

function onPointerMove(e) {
  if (e.pointerType === 'mouse') {
    mouse.seen = true;
    mouse.x = e.clientX; mouse.y = e.clientY;
    return;
  }
  const s = sticks.move && sticks.move.id === e.pointerId ? sticks.move
    : sticks.aim && sticks.aim.id === e.pointerId ? sticks.aim : null;
  if (!s) return;
  const dx = e.clientX - s.baseX;
  const dy = e.clientY - s.baseY;
  const max = layout.move.r * 0.82;
  const l = Math.hypot(dx, dy);
  const m = l > max ? max / l : 1;
  s.nx = clamp((dx * m) / (layout.move.r * 0.82), -1, 1);
  s.ny = clamp((dy * m) / (layout.move.r * 0.82), -1, 1);
}

function onPointerUp(e) {
  if (e.pointerType === 'mouse') {
    if (e.button === 0) mouse.down = false;
    return;
  }
  if (sticks.move && sticks.move.id === e.pointerId) sticks.move = null;
  if (sticks.aim && sticks.aim.id === e.pointerId) sticks.aim = null;
}

window.addEventListener('pointerdown', onPointerDown, { passive: true });
window.addEventListener('pointermove', onPointerMove, { passive: true });
window.addEventListener('pointerup', onPointerUp, { passive: true });
window.addEventListener('pointercancel', onPointerUp, { passive: true });
window.addEventListener('contextmenu', e => e.preventDefault());
window.addEventListener('blur', () => {
  keys.clear(); mouse.down = false; sticks.move = null; sticks.aim = null;
  if (game.state === 'playing') game.state = 'paused';
});

window.addEventListener('keydown', (e) => {
  const code = e.code;
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(code)) e.preventDefault();
  keys.add(code);
  if (code === 'ShiftLeft' || code === 'ShiftRight') queue.dash = true;
  if (code === 'Space') queue.special = true;
  if (code === 'KeyM') toggleSound();
  if (code === 'KeyP' || code === 'Escape') {
    if (game.state === 'playing') game.state = 'paused';
    else if (game.state === 'paused') game.state = 'playing';
  }
  if (code === 'KeyR' && game.state === 'over') startGame();
});
window.addEventListener('keyup', (e) => keys.delete(e.code));

function buildInput() {
  const input = {
    moveX: 0, moveY: 0, firing: false, hasAim: false, aimX: 0, aimY: 0,
    dash: queue.dash, special: queue.special
  };

  if (sticks.move) {
    input.moveX = sticks.move.nx;
    input.moveY = sticks.move.ny;
  } else {
    if (keys.has('KeyW') || keys.has('ArrowUp')) input.moveY -= 1;
    if (keys.has('KeyS') || keys.has('ArrowDown')) input.moveY += 1;
    if (keys.has('KeyA') || keys.has('ArrowLeft')) input.moveX -= 1;
    if (keys.has('KeyD') || keys.has('ArrowRight')) input.moveX += 1;
  }

  const p = game.player;
  if (mouse.seen) {
    const mw = screenToWorld(mouse.x, mouse.y);
    input.hasAim = true;
    input.aimX = mw.x; input.aimY = mw.y;
    input.firing = mouse.down;
  }
  if (sticks.aim) {
    const l = Math.hypot(sticks.aim.nx, sticks.aim.ny);
    if (l > 0.16 && p) {
      input.hasAim = true;
      input.aimX = p.x + (sticks.aim.nx / l) * 620;
      input.aimY = p.y + (sticks.aim.ny / l) * 620;
    }
    input.firing = true;
  } else if (isTouchUI && !mouse.seen) {
    input.firing = true; // mobile auto-aim / auto-fire
  }

  return input;
}

/* ------------------------------------------------------------------ */
/* camera                                                              */
/* ------------------------------------------------------------------ */
function updateCamera(dt) {
  const desktopFit = w >= 800 && !isTouchUI;
  let targetZoom;
  let tx = WORLD.cx, ty = WORLD.cy;

  const p = game.player;
  if (game.state === 'attract') {
    targetZoom = desktopFit ? Math.min(w / 1740, h / 1080) : clamp(Math.min(w, h) / 640, 0.5, 1.05);
  } else if (desktopFit) {
    targetZoom = Math.min(w / 1740, h / 1080);
  } else {
    targetZoom = clamp(Math.min(w, h) / 560, 0.62, 1.05);
    if (p) { tx = p.x; ty = p.y; }
    const vw = w / targetZoom, vh = h / targetZoom;
    tx = vw >= WORLD.w ? WORLD.cx : clamp(tx, vw / 2, WORLD.w - vw / 2);
    ty = vh >= WORLD.h ? WORLD.cy : clamp(ty, vh / 2, WORLD.h - vh / 2);
  }

  if (!zoomInit) { camera.zoom = targetZoom; zoomInit = true; }
  const kz = Math.min(1, dt * 5.5);
  camera.zoom += (targetZoom - camera.zoom) * kz;
  const k = Math.min(1, dt * 8);
  camera.x += (tx - camera.x) * k;
  camera.y += (ty - camera.y) * k;

  const halfW = w / (2 * camera.zoom);
  const halfH = h / (2 * camera.zoom);
  camera.x = halfW * 2 >= WORLD.w ? WORLD.cx : clamp(camera.x, halfW, WORLD.w - halfW);
  camera.y = halfH * 2 >= WORLD.h ? WORLD.cy : clamp(camera.y, halfH, WORLD.h - halfH);

  camera.shakeX = (Math.random() * 2 - 1) * game.shake;
  camera.shakeY = (Math.random() * 2 - 1) * game.shake;
}

/* ------------------------------------------------------------------ */
/* loop                                                                */
/* ------------------------------------------------------------------ */
let last = performance.now();
let hudTime = 0;

function frame(now) {
  const dt = Math.min(0.045, Math.max(0, (now - last) / 1000));
  last = now;
  const time = now / 1000;

  const input = buildInput();
  game.update(dt, input);
  queue.dash = false;
  queue.special = false;
  updateCamera(dt);

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.fillStyle = '#040606';
  ctx.fillRect(0, 0, w, h);

  ctx.save();
  ctx.translate(w / 2 + camera.shakeX, h / 2 + camera.shakeY);
  ctx.scale(camera.zoom, camera.zoom);
  ctx.translate(-camera.x, -camera.y);
  game.drawWorld(ctx, time);
  ctx.restore();

  drawVignette(ctx, w, h);

  const view = {
    w, h, insets, camera, isTouch: isTouchUI, layout,
    moveStick: sticks.move, aimStick: sticks.aim
  };
  if (game.state !== 'attract') {
    drawHUD(ctx, game, view);
    if (game.state === 'playing') drawOffscreenMarkers(ctx, game, view);
  }
  if (game.state === 'paused') drawPause(ctx, w, h);

  requestAnimationFrame(frame);
}

/* ------------------------------------------------------------------ */
/* boot                                                                */
/* ------------------------------------------------------------------ */
measure();
buildRoster();
measure();
Sfx.ensure = Sfx.ensure.bind(Sfx);
requestAnimationFrame(frame);

// expose for debugging / automated checks
window.__gallos = { game, camera, start: startGame };
