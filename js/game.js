import { FIGHTERS, ROLE, WORLD, TEAM, SPAWNS, TAU } from './roster.js';
import { Sfx } from './audio.js';
import {
  drawArena, drawChampion, drawProjectile, drawPool, drawParticle,
  drawFloatText, drawBeam, drawShockwave, clamp
} from './render.js';

const rand = (a = 0, b = 1) => a + Math.random() * (b - a);
const dist2 = (ax, ay, bx, by) => { const dx = ax - bx, dy = ay - by; return dx * dx + dy * dy; };

function angLerp(from, to, t) {
  let d = ((to - from + Math.PI) % TAU + TAU) % TAU - Math.PI;
  return from + d * t;
}

export class Game {
  constructor() {
    this.state = 'attract';
    this.selected = 0;
    this.onEnd = null;
    this.t = 0;
    this.shake = 0;
    this.units = [];
    this.projectiles = [];
    this.pools = [];
    this.particles = [];
    this.floats = [];
    this.beams = [];
    this.shocks = [];
    this.feed = [];
    this.announce = null;
    this.scores = [0, 0];
    this.timer = 150;
    this.roundTime = 0;
    this.player = null;
    this.firstBlood = false;
    this.result = null;
    this.reset(true);
  }

  reset(attract) {
    this.units = [];
    this.projectiles = [];
    this.pools = [];
    this.particles = [];
    this.floats = [];
    this.beams = [];
    this.shocks = [];
    this.feed = [];
    this.announce = null;
    this.scores = [0, 0];
    this.timer = 150;
    this.roundTime = 0;
    this.firstBlood = false;
    this.result = null;
    this.shake = 0;
    this.player = null;

    const defs = FIGHTERS;
    for (let i = 0; i < defs.length; i++) {
      const def = defs[i];
      const spawn = SPAWNS[i];
      const role = ROLE[def.role];
      const u = {
        def, team: def.team, role: def.role,
        x: spawn[0], y: spawn[1], spawnX: spawn[0], spawnY: spawn[1],
        vx: 0, vy: 0, kx: 0, ky: 0,
        r: role.radius, speed: role.speed,
        hp: role.hp, maxHp: role.hp,
        aim: def.team === 0 ? 0 : Math.PI,
        cooldown: rand(0.2, 0.9), dashCd: 0, dashT: 0, dashDirX: 0, dashDirY: 0,
        specialCd: rand(3, 6),
        alive: true, respawn: 0, invuln: 1.2,
        hitFlash: 0, burnT: 0, burnDps: 0, burnFrom: null,
        walkPhase: rand(0, TAU), seed: rand(0, 100),
        flash: 0,
        isPlayer: false,
        target: null, retarget: 0, strafeDir: Math.random() < 0.5 ? -1 : 1,
        streak: 0, slowT: 0, poolAcc: 0,
        lastX: spawn[0], lastY: spawn[1]
      };
      this.units.push(u);
    }
    if (!attract) {
      this.player = this.units.find(u => u.team === 0 && u.def.id === FIGHTERS[this.selected].id) || this.units[0];
      this.player.isPlayer = true;
      this.player.cooldown = 0;
      this.player.specialCd = 0;
    }
    // spawn shimmer
    for (const u of this.units) {
      this.spawnShock(u.x, u.y, 70, TEAM[u.team].color, 0.5);
    }
  }

  start(index = this.selected) {
    this.selected = index;
    this.reset(false);
    this.state = 'playing';
    this.announce = { text: '¡A LA CARGA!', sub: 'PRIMERO A 10 BAJAS · 2:30', life: 2.1, maxLife: 2.1, color: '#ffd166' };
    Sfx.ensure();
    Sfx.ui();
    Sfx.respawn();
  }

  startAttract() {
    this.state = 'attract';
    this.reset(true);
  }

  shakeBy(v) { this.shake = Math.min(22, this.shake + v); }

  spawnParticle(o) {
    if (this.particles.length > 760) this.particles.splice(0, 60);
    this.particles.push(o);
  }

  burst(x, y, n, opts = {}) {
    const {
      colors = ['#7dff3c', '#b6ff7a', '#2f6b32'],
      speed = [40, 190], size = [1.5, 4], life = [0.3, 0.7],
      kind = 'goo', gravity = 160, spread = TAU, dir = 0, rot = true
    } = opts;
    for (let i = 0; i < n; i++) {
      const a = dir + rand(-spread / 2, spread / 2);
      const sp = rand(speed[0], speed[1]);
      this.spawnParticle({
        x, y: y - rand(34, 60), vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - rand(10, 60),
        life: rand(life[0], life[1]), maxLife: 0.8,
        size: rand(size[0], size[1]), color: colors[Math.floor(Math.random() * colors.length)],
        kind, gravity, rot: rot ? rand(0, TAU) : 0, vr: rand(-7, 7), drag: 0.9
      });
    }
  }

  spawnFloat(x, y, text, color = '#fff', size = 15) {
    this.floats.push({ x: x + rand(-8, 8), y, text, color, size, life: 0.85, maxLife: 0.85 });
  }

  spawnShock(x, y, maxR, color, life = 0.5) {
    this.shocks.push({ x, y, r: maxR * 0.15, maxR, life, maxLife: life, color });
  }

  /* ------------------------------------------------------------------ */
  update(dt, input) {
    dt = Math.min(dt, 0.04);
    this.t += dt;
    this.shake *= Math.pow(0.0025, dt);
    this.updateEffects(dt);
    if (this.state === 'over') return;
    if (this.state === 'paused') return;
    if (this.state === 'attract') {
      this.timer -= dt;
      if (this.timer <= 0 || this.scores[0] >= 10 || this.scores[1] >= 10) { this.reset(true); return; }
    } else {
      this.roundTime += dt;
      this.timer -= dt;
      if (this.timer <= 0) { this.timer = 0; this.endRound(); return; }
    }

    for (const u of this.units) {
      if (!u.alive) {
        u.respawn -= dt;
        if (u.respawn <= 0) this.respawn(u);
        continue;
      }
      u.cooldown = Math.max(0, u.cooldown - dt);
      u.dashCd = Math.max(0, u.dashCd - dt);
      u.specialCd = Math.max(0, u.specialCd - dt);
      u.invuln = Math.max(0, u.invuln - dt);
      u.hitFlash = Math.max(0, u.hitFlash - dt);
      u.flash = Math.max(0, u.flash - dt);
      u.slowT = Math.max(0, u.slowT - dt);

      if (u.burnT > 0) {
        u.burnT -= dt;
        this.damage(u, u.burnDps * dt, u.burnFrom, { silent: true, burn: true });
        if (Math.random() < dt * 14) {
          this.spawnParticle({
            x: u.x + rand(-16, 16), y: u.y - rand(30, 100), vx: rand(-15, 15), vy: -rand(20, 60),
            life: rand(0.2, 0.5), maxLife: 0.5, size: rand(1.5, 3), color: Math.random() < 0.5 ? '#ffb347' : '#7dff3c',
            kind: 'ember', gravity: -30, rot: 0, vr: 0, drag: 0.95
          });
        }
        if (!u.alive) continue;
      }

      if (this.state === 'playing' && u.isPlayer) this.updatePlayer(u, dt, input);
      else this.updateAI(u, dt);

      // integrate
      if (u.dashT > 0) {
        u.dashT -= dt;
        const sp = 720;
        u.vx = u.dashDirX * sp;
        u.vy = u.dashDirY * sp;
        if (Math.random() < 0.6) this.spawnParticle({
          x: u.x, y: u.y - 30, vx: rand(-20, 20), vy: rand(-10, 30), life: 0.34, maxLife: 0.34,
          size: rand(6, 12), color: TEAM[u.team].color, kind: 'smoke', gravity: 0, rot: 0, vr: 0, drag: 0.9
        });
      }
      u.x += (u.vx + u.kx) * dt;
      u.y += (u.vy + u.ky) * dt;
      u.kx *= Math.pow(0.0009, dt);
      u.ky *= Math.pow(0.0009, dt);

      const minX = WORLD.left + u.r * 0.4, maxX = WORLD.right - u.r * 0.4;
      const minY = WORLD.top + u.r * 0.4, maxY = WORLD.bottom - u.r * 0.4;
      if (u.x < minX) { u.x = minX; u.vx = Math.abs(u.vx) * 0.2; u.kx = Math.abs(u.kx) * 0.2; }
      if (u.x > maxX) { u.x = maxX; u.vx = -Math.abs(u.vx) * 0.2; u.kx = -Math.abs(u.kx) * 0.2; }
      if (u.y < minY) { u.y = minY; u.vy = Math.abs(u.vy) * 0.2; u.ky = Math.abs(u.ky) * 0.2; }
      if (u.y > maxY) { u.y = maxY; u.vy = -Math.abs(u.vy) * 0.2; u.ky = -Math.abs(u.ky) * 0.2; }

      const spd = Math.hypot(u.vx, u.vy);
      if (spd > 25) u.walkPhase += dt * (4 + spd * 0.035);
      else u.walkPhase += dt * 1.2;
      u.lastX = u.x; u.lastY = u.y;
    }

    this.updateProjectiles(dt);
    this.updatePools(dt);
  }

  updateEffects(dt) {
    this.feed = this.feed.filter(f => (f.life -= dt) > 0);
    if (this.announce) {
      this.announce.life -= dt;
      if (this.announce.life <= 0) this.announce = null;
    }
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= dt;
      if (p.life <= 0) { this.particles.splice(i, 1); continue; }
      p.vy += (p.gravity || 0) * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= Math.pow(p.drag ?? 0.95, dt * 60);
      p.rot += (p.vr || 0) * dt;
      if (p.kind === 'feather' || p.kind === 'smoke') p.vy *= Math.pow(0.55, dt * 8);
    }
    for (let i = this.floats.length - 1; i >= 0; i--) {
      const f = this.floats[i];
      f.life -= dt;
      f.y -= dt * 34;
      if (f.life <= 0) this.floats.splice(i, 1);
    }
    for (let i = this.beams.length - 1; i >= 0; i--) {
      this.beams[i].life -= dt;
      if (this.beams[i].life <= 0) this.beams.splice(i, 1);
    }
    for (let i = this.shocks.length - 1; i >= 0; i--) {
      const s = this.shocks[i];
      s.life -= dt;
      s.r += (s.maxR - s.r) * Math.min(1, dt * 10);
      if (s.life <= 0) this.shocks.splice(i, 1);
    }
  }

  /* ------------------------------------------------------------------ */
  updatePlayer(u, dt, input) {
    if (!u.alive) return;
    let mx = input.moveX || 0, my = input.moveY || 0;
    const ml = Math.hypot(mx, my);
    if (ml > 1) { mx /= ml; my /= ml; }

    if (input.dash && u.dashCd <= 0) this.doDash(u, mx, my);
    if (input.special && u.specialCd <= 0) this.doSpecial(u);

    // Aim
    let aimAngle = null;
    if (input.hasAim) {
      aimAngle = Math.atan2(input.aimY - u.y, input.aimX - u.x);
    } else {
      const target = this.nearestEnemy(u, 1200);
      if (target) {
        const role = ROLE[u.role];
        const tt = Math.hypot(target.x - u.x, target.y - u.y) / role.projSpeed;
        aimAngle = Math.atan2(target.y + target.vy * tt * 0.7 - u.y, target.x + target.vx * tt * 0.7 - u.x);
      }
    }
    if (aimAngle !== null) u.aim = aimAngle;

    if (u.dashT <= 0) {
      const slow = u.slowT > 0 ? 0.72 : 1;
      const k = Math.min(1, dt * 13);
      u.vx += (mx * u.speed * slow - u.vx) * k;
      u.vy += (my * u.speed * slow - u.vy) * k;
      if (ml < 0.05) {
        u.vx *= Math.pow(0.001, dt);
        u.vy *= Math.pow(0.001, dt);
      }
    }

    if (input.firing && u.cooldown <= 0) {
      this.firePrimary(u, u.aim);
    }
  }

  updateAI(u, dt) {
    u.retarget -= dt;
    let target = u.target;
    if (!target || !target.alive || u.retarget <= 0) {
      target = this.nearestEnemy(u, 2400);
      u.target = target;
      u.retarget = rand(1.1, 2.2);
      if (Math.random() < 0.45) u.strafeDir *= -1;
    }
    if (!target) return;

    const role = ROLE[u.role];
    const dx = target.x - u.x, dy = target.y - u.y;
    const dist = Math.hypot(dx, dy) || 1;
    const nx = dx / dist, ny = dy / dist;
    const pref = role.preferred;
    let mx = 0, my = 0;

    if (dist > pref + 65) { mx += nx; my += ny; }
    else if (dist < pref - 90) { mx -= nx; my -= ny; }
    else {
      mx += -ny * u.strafeDir;
      my += nx * u.strafeDir;
      if (Math.random() < dt * 0.5) u.strafeDir *= -1;
    }

    // keep distance if sniper and enemy too close
    if (u.role === 'sniper' && dist < 240) { mx -= nx * 1.3; my -= ny * 1.3; }

    // avoid friendly stacking
    for (const a of this.units) {
      if (a === u || !a.alive || a.team !== u.team) continue;
      const d = Math.hypot(a.x - u.x, a.y - u.y);
      if (d < 92 && d > 0.01) {
        mx += (u.x - a.x) / d * (1 - d / 92) * 1.5;
        my += (u.y - a.y) / d * (1 - d / 92) * 1.5;
      }
    }

    // avoid enemy lava
    for (const p of this.pools) {
      if (p.team === u.team || p.life < 0.4) continue;
      const d = Math.hypot(u.x - p.x, (u.y - p.y) / 0.6);
      if (d < p.r + 50) {
        const push = (1 - d / (p.r + 50)) * 2.6;
        mx += (u.x - p.x) / (d || 1) * push;
        my += ((u.y - p.y) / 0.6) / (d || 1) * push;
      }
    }

    // stay off the walls
    const m = 215;
    if (u.x < WORLD.left + m) mx += (1 - (u.x - WORLD.left) / m) * 1.8;
    if (u.x > WORLD.right - m) mx -= (1 - (WORLD.right - u.x) / m) * 1.8;
    if (u.y < WORLD.top + m) my += (1 - (u.y - WORLD.top) / m) * 1.8;
    if (u.y > WORLD.bottom - m) my -= (1 - (WORLD.bottom - u.y) / m) * 1.8;

    const ml = Math.hypot(mx, my);
    if (ml > 1) { mx /= ml; my /= ml; }

    // aim prediction with personality wobble
    const tt = dist / role.projSpeed;
    const lead = u.role === 'sniper' ? 0.93 : 0.78;
    const px = target.x + target.vx * tt * lead + target.kx * tt * 0.6;
    const py = target.y + target.vy * tt * lead + target.ky * tt * 0.6;
    const wobble = Math.sin(this.t * 1.7 + u.seed * 2) * (u.role === 'sniper' ? 0.022 : 0.035)
      + Math.sin(this.t * 0.7 + u.seed) * 0.02;
    const aim = Math.atan2(py - u.y, px - u.x) + wobble;
    u.aim = angLerp(u.aim, aim, Math.min(1, dt * 9));

    // dodge incoming
    if (u.dashCd <= 0 && Math.random() < dt * 1.4) {
      for (const p of this.projectiles) {
        if (p.team === u.team) continue;
        const pd = Math.hypot(p.x - u.x, p.y - u.y);
        if (pd < 175 && pd > 20) {
          const approach = (p.vx * (u.x - p.x) + p.vy * (u.y - p.y)) / pd;
          if (approach > 140) {
            const side = Math.random() < 0.5 ? 1 : -1;
            this.doDash(u, -p.vy / Math.hypot(p.vx, p.vy) * side, p.vx / Math.hypot(p.vx, p.vy) * side);
            break;
          }
        }
      }
    }

    if (u.dashT <= 0) {
      const slow = u.slowT > 0 ? 0.72 : 1;
      const k = Math.min(1, dt * 11);
      u.vx += (mx * u.speed * slow - u.vx) * k;
      u.vy += (my * u.speed * slow - u.vy) * k;
    }

    // fire
    const inRange = dist < role.range * 0.92;
    if (inRange && u.cooldown <= 0) {
      const facing = Math.abs(((u.aim - Math.atan2(target.y - u.y, target.x - u.x) + Math.PI * 3) % TAU) - Math.PI);
      if (facing < 0.35) this.firePrimary(u, u.aim);
    }

    // special
    if (u.specialCd <= 0) {
      if (u.role === 'brawler' && dist < 390) this.doSpecial(u);
      else if (u.role === 'sniper' && dist < 690 && dist > 260) this.doSpecial(u);
    }
  }

  nearestEnemy(u, maxDist = 9999) {
    let best = null, bd = maxDist * maxDist;
    for (const e of this.units) {
      if (!e.alive || e.team === u.team) continue;
      const d = dist2(u.x, u.y, e.x, e.y);
      if (d < bd) { bd = d; best = e; }
    }
    return best;
  }

  doDash(u, mx, my) {
    let dx = mx, dy = my;
    if (Math.hypot(dx, dy) < 0.1) { dx = Math.cos(u.aim); dy = Math.sin(u.aim); }
    const l = Math.hypot(dx, dy) || 1;
    u.dashDirX = dx / l; u.dashDirY = dy / l;
    u.dashT = 0.17;
    u.dashCd = ROLE[u.role].dashCd;
    this.burst(u.x, u.y, 8, { colors: [TEAM[u.team].color, '#e9ffce'], speed: [40, 160], size: [2, 5], life: [0.2, 0.45], kind: 'ember', gravity: -20, spread: Math.PI * 2 });
    if (u.isPlayer) { Sfx.dash(); this.shakeBy(2.2); }
  }

  doSpecial(u) {
    const role = ROLE[u.role];
    if (u.specialCd > 0) return;
    u.specialCd = role.specialCd;
    if (u.role === 'brawler') {
      // lava egg fan
      for (let i = -2; i <= 2; i++) {
        this.spawnEgg(u, u.aim + i * 0.17, { damage: role.damage * 0.65, speed: 630, poolR: role.poolRadius * 0.85 });
      }
      this.burst(u.x + Math.cos(u.aim) * 40, u.y + Math.sin(u.aim) * 40, 18, {
        colors: ['#7dff3c', '#b6ff7a', '#ffb347'], speed: [50, 230], size: [2, 5], life: [0.3, 0.7], kind: 'goo', gravity: 130, spread: 1.4, dir: u.aim
      });
      if (u.isPlayer) { Sfx.egg(); this.shakeBy(4); }
    } else {
      // piercing lava beam
      const range = 900;
      const ex = u.x + Math.cos(u.aim) * range;
      const ey = u.y + Math.sin(u.aim) * range;
      const mx = u.x + Math.cos(u.aim) * 44;
      const my = u.y + Math.sin(u.aim) * 44;
      this.beams.push({ x1: mx, y1: my, x2: ex, y2: ey, life: 0.38, maxLife: 0.38, width: 26, team: u.team });
      this.spawnShock(mx, my, 100, TEAM[u.team].color, 0.4);
      let hitAny = false;
      for (const e of this.units) {
        if (!e.alive || e.team === u.team) continue;
        const t = clamp(((e.x - u.x) * Math.cos(u.aim) + (e.y - u.y) * Math.sin(u.aim)) / range, 0, 1);
        const cx = u.x + Math.cos(u.aim) * range * t;
        const cy = u.y + Math.sin(u.aim) * range * t;
        if (Math.hypot(e.x - cx, e.y - cy) < e.r + 30) {
          this.damage(e, 35, u, { knock: 260, dirX: Math.cos(u.aim), dirY: Math.sin(u.aim) });
          e.burnT = Math.max(e.burnT, 2.2);
          e.burnDps = 9;
          e.burnFrom = u;
          hitAny = true;
          this.burst(e.x, e.y, 16, { colors: ['#7dff3c', '#e9ffce', '#ffd166'], speed: [50, 240], size: [2, 5], life: [0.25, 0.6], kind: 'goo', gravity: 120, spread: 1.5 });
        }
      }
      if (hitAny) this.shakeBy(6);
      Sfx.beam();
      if (u.isPlayer) this.shakeBy(9);
    }
    if (Math.random() < 0.5) this.spawnFloat(u.x, u.y - 160, u.role === 'brawler' ? '¡LLUVIA DE LAVA!' : '¡PLUMA PENETRANTE!', u.role === 'brawler' ? '#7dff3c' : '#ffd166', 12);
  }

  spawnEgg(u, angle, opts = {}) {
    const role = ROLE[u.role];
    const speed = opts.speed || role.projSpeed;
    const range = opts.range || role.range;
    const mx = u.x + Math.cos(angle) * 38;
    const my = u.y + Math.sin(angle) * 38;
    this.projectiles.push({
      kind: 'egg', team: u.team, owner: u,
      x: mx, y: my, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
      angle, life: range / speed, maxLife: range / speed, age: 0,
      z: 0, spin: rand(0, TAU), seed: rand(0, 10), radius: 12,
      damage: opts.damage || role.damage, poolR: opts.poolR || role.poolRadius,
      trail: 0
    });
  }

  spawnPlume(u, angle) {
    const role = ROLE[u.role];
    const mx = u.x + Math.cos(angle) * 42;
    const my = u.y + Math.sin(angle) * 42;
    this.projectiles.push({
      kind: 'plume', team: u.team, owner: u,
      x: mx, y: my, vx: Math.cos(angle) * role.projSpeed, vy: Math.sin(angle) * role.projSpeed,
      angle, life: role.range / role.projSpeed, maxLife: role.range / role.projSpeed, age: 0,
      z: 0, radius: 11, damage: role.damage, pierce: role.pierce,
      hit: new Set(), trail: 0
    });
  }

  firePrimary(u, angle) {
    if (!u.alive || u.cooldown > 0) return;
    const role = ROLE[u.role];
    u.cooldown = role.fireDelay;
    u.flash = 0.07;
    if (u.role === 'brawler') {
      this.spawnEgg(u, angle);
      Sfx.egg();
      this.burst(u.x + Math.cos(angle) * 42, u.y + Math.sin(angle) * 42, 5, {
        colors: ['#7dff3c', '#b6ff7a'], speed: [20, 100], size: [1.2, 2.6], life: [0.15, 0.35], kind: 'goo', gravity: 80, spread: 0.8, dir: angle
      });
    } else {
      this.spawnPlume(u, angle);
      Sfx.plume();
      this.burst(u.x + Math.cos(angle) * 44, u.y + Math.sin(angle) * 44, 4, {
        colors: ['#e9ffce', '#7dff3c', '#ffd166'], speed: [40, 150], size: [1, 2.6], life: [0.12, 0.3], kind: 'ember', gravity: 0, spread: 0.5, dir: angle
      });
    }
  }

  updateProjectiles(dt) {
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      p.life -= dt;
      p.age += dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.kind === 'egg') {
        const prog = 1 - Math.max(0, p.life) / p.maxLife;
        p.z = Math.sin(prog * Math.PI) * 34;
        p.spin += dt * 7;
        p.trail -= dt;
        if (p.trail <= 0) {
          p.trail = 0.03;
          this.spawnParticle({
            x: p.x + rand(-4, 4), y: p.y - 46 - p.z, vx: rand(-12, 12), vy: rand(-4, 18),
            life: rand(0.16, 0.35), maxLife: 0.35, size: rand(1, 2.4), color: Math.random() < 0.7 ? '#7dff3c' : '#d8ffb0',
            kind: 'goo', gravity: 20, rot: 0, vr: 0, drag: 0.9
          });
        }
      } else {
        p.trail -= dt;
        if (p.trail <= 0) {
          p.trail = 0.028;
          this.spawnParticle({
            x: p.x - (p.vx * 0.012), y: p.y - 46, vx: rand(-10, 10), vy: rand(-10, 10),
            life: rand(0.14, 0.3), maxLife: 0.3, size: rand(1, 2.2), color: Math.random() < 0.6 ? '#7dff3c' : '#e9ffce',
            kind: 'ember', gravity: 0, rot: 0, vr: 0, drag: 0.88
          });
        }
      }

      if (p.life <= 0) {
        if (p.kind === 'egg') this.splatEgg(p);
        this.projectiles.splice(i, 1);
        continue;
      }
      if (p.x < WORLD.left - 80 || p.x > WORLD.right + 80 || p.y < WORLD.top - 80 || p.y > WORLD.bottom + 80) {
        if (p.kind === 'egg') this.splatEgg(p);
        this.projectiles.splice(i, 1);
        continue;
      }

      let remove = false;
      for (const u of this.units) {
        if (!u.alive || u.team === p.team) continue;
        if (p.hit && p.hit.has(u)) continue;
        if (dist2(p.x, p.y, u.x, u.y) > (p.radius + u.r) * (p.radius + u.r)) continue;

        if (p.kind === 'egg') {
          this.damage(u, p.damage, p.owner, { knock: 110, dirX: p.vx / Math.hypot(p.vx, p.vy), dirY: p.vy / Math.hypot(p.vx, p.vy) });
          // splash on nearby enemies
          for (const o of this.units) {
            if (o === u || !o.alive || o.team === p.team) continue;
            if (dist2(p.x, p.y, o.x, o.y) < 74 * 74) {
              this.damage(o, 12, p.owner, { knock: 60, dirX: (o.x - p.x) / 70, dirY: (o.y - p.y) / 70 });
            }
          }
          this.splatEgg(p);
          remove = true;
          break;
        } else {
          this.damage(u, p.damage, p.owner, { knock: 120, dirX: p.vx / Math.hypot(p.vx, p.vy), dirY: p.vy / Math.hypot(p.vx, p.vy) });
          if (u.alive) {
            u.burnT = Math.max(u.burnT, ROLE.sniper.burnTime);
            u.burnDps = ROLE.sniper.burnDps;
            u.burnFrom = p.owner;
          }
          p.hit.add(u);
          p.pierce -= 1;
          this.burst(p.x, p.y, 6, { colors: ['#7dff3c', '#e9ffce'], speed: [30, 120], size: [1, 2.6], life: [0.15, 0.35], kind: 'ember', gravity: 0 });
          if (p.pierce < 0) { remove = true; break; }
        }
      }
      if (remove) this.projectiles.splice(i, 1);
    }
  }

  splatEgg(p) {
    const owner = p.owner;
    const r = p.poolR || 52;
    if (this.pools.length >= 10) this.pools.shift();
    this.pools.push({
      x: p.x, y: p.y, r, life: ROLE.brawler.poolLife, maxLife: ROLE.brawler.poolLife,
      team: p.team, dps: ROLE.brawler.poolDps, owner, seed: rand(0, 100)
    });
    this.spawnShock(p.x, p.y, r * 1.4, '#7dff3c', 0.42);
    this.burst(p.x, p.y, 20, { colors: ['#7dff3c', '#b6ff7a', '#2f6b32', '#0b0f0b'], speed: [40, 210], size: [2, 5], life: [0.3, 0.7], kind: 'goo', gravity: 150, spread: Math.PI * 2 });
    this.burst(p.x, p.y, 6, { colors: ['#1a1e18', '#3c4540'], speed: [10, 60], size: [5, 10], life: [0.35, 0.7], kind: 'smoke', gravity: -20, spread: Math.PI * 2 });
    Sfx.splat();
    if (this.player) {
      const d = Math.hypot(this.player.x - p.x, this.player.y - p.y);
      if (d < 260) this.shakeBy(2 + (1 - d / 260) * 3);
    }
  }

  updatePools(dt) {
    for (let i = this.pools.length - 1; i >= 0; i--) {
      const pool = this.pools[i];
      pool.life -= dt;
      if (pool.life <= 0) this.pools.splice(i, 1);
    }
    // Overlapping pools do not stack: a fighter only takes the strongest burn.
    for (const u of this.units) {
      if (!u.alive) continue;
      let lava = null;
      for (const pool of this.pools) {
        if (pool.team === u.team) continue;
        const nx = (u.x - pool.x) / pool.r;
        const ny = (u.y - pool.y) / (pool.r * 0.62);
        if (nx * nx + ny * ny < 1 && (!lava || pool.dps > lava.dps)) lava = pool;
      }
      if (!lava) continue;
      u.slowT = 0.1;
      this.damage(u, lava.dps * dt, lava.owner, { silent: true, burn: true });
      u.poolAcc = (u.poolAcc || 0) + lava.dps * dt;
      if (u.poolAcc > 14) {
        u.poolAcc = 0;
        this.spawnFloat(u.x, u.y - 120, `-${Math.round(14)}`, '#8dff5c', 11);
      }
      if (u.alive && Math.random() < dt * 8) {
        this.spawnParticle({
          x: u.x + rand(-14, 14), y: u.y - rand(20, 90), vx: rand(-10, 10), vy: -rand(15, 50),
          life: rand(0.2, 0.5), maxLife: 0.5, size: rand(1.5, 3), color: '#7dff3c',
          kind: 'ember', gravity: -20, rot: 0, vr: 0, drag: 0.9
        });
      }
    }
  }

  damage(u, amount, source, opts = {}) {
    if (!u.alive || u.invuln > 0 || amount <= 0) return;
    u.hp -= amount;
    u.hitFlash = Math.max(u.hitFlash, opts.silent ? 0.04 : 0.16);
    if (!opts.silent) {
      if (opts.knock && source) {
        u.kx += (opts.dirX || 0) * opts.knock;
        u.ky += (opts.dirY || 0) * opts.knock;
      }
      this.burst(u.x, u.y, 3, { colors: ['#ffd166', '#7dff3c', '#ffe9b8'], speed: [30, 130], size: [1, 2.6], life: [0.15, 0.35], kind: 'ember', gravity: 120 });
      if (amount >= 8) this.spawnFloat(u.x, u.y - 132, String(Math.round(amount)), source && source.team === 0 ? '#fff1c9' : '#ffb3a0', 14);
      Sfx.hit();
      if (u.isPlayer) this.shakeBy(4);
    }
    if (u.hp <= 0) this.kill(u, source);
  }

  kill(u, killer) {
    if (!u.alive) return;
    u.alive = false;
    u.hp = 0;
    u.respawn = 5.2;
    u.burnT = 0;
    u.deathX = u.x; u.deathY = u.y;
    this.burst(u.x, u.y, 26, { colors: [u.def.palette.feather, u.def.palette.featherDark, '#7dff3c', '#ffd166'], speed: [60, 260], size: [2, 5], life: [0.5, 1.2], kind: 'feather', gravity: 260, spread: Math.PI * 2 });
    this.burst(u.x, u.y, 14, { colors: ['#7dff3c', '#2f6b32', '#0b0f0b'], speed: [40, 190], size: [2, 5], life: [0.3, 0.8], kind: 'goo', gravity: 200, spread: Math.PI * 2 });
    this.spawnShock(u.x, u.y, 90, TEAM[u.team].color, 0.55);
    Sfx.kill();
    this.shakeBy(u.isPlayer ? 13 : 5);

    if (killer && killer.team !== u.team) {
      if (this.state !== 'attract') this.scores[killer.team] += 1;
      killer.streak = (killer.streak || 0) + 1;
    }
    const atkName = killer ? killer.def.name : 'LAVA';
    this.feed.unshift({ a: atkName, b: u.def.name, team: killer ? killer.team : u.team, life: 5 });
    if (this.feed.length > 4) this.feed.length = 4;

    if (this.state === 'attract') return;

    if (!this.firstBlood) {
      this.firstBlood = true;
      this.announce = { text: '¡PRIMERA SANGRE!', sub: `${atkName} abrió la veta`, life: 1.7, maxLife: 1.7, color: '#ffd166' };
    } else if (killer && killer.isPlayer) {
      this.announce = { text: '¡BAJA!', sub: killer.streak > 1 ? `Racha de ${killer.streak}` : 'Bien cocinado', life: 1.3, maxLife: 1.3, color: '#b6ff7a' };
    } else if (u.isPlayer) {
      this.announce = { text: '¡TE DERRIBARON!', sub: `Vuelves en 5 segundos`, life: 1.9, maxLife: 1.9, color: '#ff7a6a' };
    } else if (killer && killer.team === 0 && killer.streak === 3) {
      this.announce = { text: `¡RACHA DE ${killer.def.name}!`, sub: 'Tres plumas al aire', life: 1.6, maxLife: 1.6, color: '#7dff3c' };
    }

    if (this.scores[0] >= 10 || this.scores[1] >= 10) {
      this.endRound();
    }
  }

  respawn(u) {
    u.alive = true;
    u.hp = u.maxHp;
    u.x = u.spawnX; u.y = u.spawnY;
    u.vx = 0; u.vy = 0; u.kx = 0; u.ky = 0;
    u.invuln = 2.2;
    u.respawn = 0;
    u.burnT = 0;
    u.cooldown = 0.35;
    u.dashCd = 0;
    u.specialCd = Math.min(u.specialCd, 2);
    u.aim = u.team === 0 ? 0 : Math.PI;
    u.target = null;
    u.streak = 0;
    this.spawnShock(u.x, u.y, 90, TEAM[u.team].color, 0.6);
    this.burst(u.x, u.y, 12, { colors: [TEAM[u.team].color, '#e9ffce'], speed: [20, 120], size: [1.5, 4], life: [0.3, 0.6], kind: 'ember', gravity: -40, spread: Math.PI * 2 });
    if (u.isPlayer) { Sfx.respawn(); this.announce = { text: '¡DE VUELTA AL RUEDO!', sub: 'A romper huevos', life: 1.2, maxLife: 1.2, color: TEAM[0].color }; }
  }

  endRound() {
    if (this.state !== 'playing') return;
    const blue = this.scores[0], red = this.scores[1];
    const winner = blue > red ? 0 : red > blue ? 1 : -1;
    this.result = { winner, blue, red };
    this.state = 'over';
    this.shakeBy(14);
    if (winner === 0) Sfx.win(); else if (winner === 1) Sfx.lose(); else Sfx.ui();
    if (this.onEnd) this.onEnd(this.result);
  }

  /* ------------------------------------------------------------------ */
  drawWorld(ctx, t) {
    drawArena(ctx, t);
    for (const pool of this.pools) drawPool(ctx, pool, t);

    const sorted = this.units.filter(u => u.alive).sort((a, b) => a.y - b.y);
    for (const u of sorted) drawChampion(ctx, u, t, {});

    for (const p of this.projectiles) drawProjectile(ctx, p, t);
    for (const p of this.particles) drawParticle(ctx, p);
    for (const b of this.beams) drawBeam(ctx, b);
    for (const s of this.shocks) drawShockwave(ctx, s);
    for (const f of this.floats) drawFloatText(ctx, f);
  }
}
