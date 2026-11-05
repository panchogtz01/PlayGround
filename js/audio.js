// Tiny WebAudio synth — no assets, no network.
class SfxEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.muted = false;
    this.last = new Map();
  }

  ensure() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
      return this.ctx;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    try {
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.34;
      const comp = this.ctx.createDynamicsCompressor();
      comp.threshold.value = -18;
      comp.knee.value = 12;
      comp.ratio.value = 8;
      this.master.connect(comp);
      comp.connect(this.ctx.destination);
      this.noise = this.makeNoise();
    } catch { this.ctx = null; }
    return this.ctx;
  }

  makeNoise() {
    const len = Math.floor(this.ctx.sampleRate * 1.2);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    return buf;
  }

  gate(name, ms) {
    const now = performance.now();
    if (now - (this.last.get(name) || 0) < ms) return false;
    this.last.set(name, now);
    return true;
  }

  tone(freq, dur, type = 'sine', vol = 0.2, slide = 0, delay = 0) {
    const ctx = this.ensure();
    if (!ctx || this.muted) return;
    const t = ctx.currentTime + delay;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(24, freq + slide), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(this.master);
    o.start(t); o.stop(t + dur + 0.02);
  }

  noiseBurst(dur, vol, freq, q = 1, type = 'bandpass', delay = 0) {
    const ctx = this.ensure();
    if (!ctx || this.muted) return;
    const t = ctx.currentTime + delay;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    src.playbackRate.value = 0.8 + Math.random() * 0.4;
    const f = ctx.createBiquadFilter();
    f.type = type; f.frequency.value = freq; f.Q.value = q;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f); f.connect(g); g.connect(this.master);
    src.start(t, Math.random() * 0.4); src.stop(t + dur + 0.02);
  }

  egg() {
    if (!this.gate('egg', 45)) return;
    this.tone(150, 0.16, 'triangle', 0.14, -60);
    this.noiseBurst(0.1, 0.09, 900, 1.6);
  }
  splat() {
    if (!this.gate('splat', 40)) return;
    this.noiseBurst(0.32, 0.16, 420, 0.8, 'lowpass');
    this.tone(70, 0.22, 'sine', 0.12, -30);
  }
  plume() {
    if (!this.gate('plume', 40)) return;
    this.tone(880, 0.18, 'sawtooth', 0.06, 900);
    this.noiseBurst(0.12, 0.08, 2600, 2.4);
  }
  hit() {
    if (!this.gate('hit', 35)) return;
    this.tone(220, 0.07, 'square', 0.07, -90);
    this.noiseBurst(0.06, 0.08, 1500, 1.2);
  }
  dash() {
    if (!this.gate('dash', 80)) return;
    this.noiseBurst(0.28, 0.13, 700, 0.7, 'bandpass');
    this.tone(320, 0.18, 'sine', 0.05, 360);
  }
  beam() {
    this.tone(120, 0.5, 'sawtooth', 0.18, 900);
    this.tone(1400, 0.35, 'square', 0.05, -1100);
    this.noiseBurst(0.5, 0.16, 2200, 0.7);
  }
  kill() {
    this.tone(90, 0.4, 'triangle', 0.2, -50);
    this.tone(880, 0.18, 'square', 0.05, 400, 0.03);
    this.noiseBurst(0.25, 0.1, 500, 0.7, 'lowpass');
  }
  respawn() {
    this.tone(320, 0.14, 'sine', 0.08, 320);
    this.tone(640, 0.18, 'sine', 0.06, 320, 0.1);
  }
  ui() {
    this.tone(520, 0.06, 'square', 0.05, 120);
  }
  win() {
    [392, 523, 659, 784].forEach((f, i) => this.tone(f, 0.35, 'triangle', 0.12, 0, i * 0.11));
  }
  lose() {
    [392, 330, 262, 196].forEach((f, i) => this.tone(f, 0.4, 'triangle', 0.1, 0, i * 0.14));
  }
  toggle() {
    this.muted = !this.muted;
    if (this.master) this.master.gain.value = this.muted ? 0 : 0.34;
    if (!this.muted) this.ui();
    return this.muted;
  }
}

export const Sfx = new SfxEngine();
