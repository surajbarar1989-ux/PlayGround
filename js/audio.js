// Tiny synthesized sound engine — no audio files needed.
export class GameAudio {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this.windGain = null;
    this.windFilter = null;
    this.master = null;
    this.musicGain = null;
    this.chordIndex = 0;
    this.nextChord = 0;
    this.ready = false;
  }

  init() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    this.ctx = ctx;
    this.master = ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 0.75;
    this.master.connect(ctx.destination);

    // noise buffer for wind / thwips
    const len = ctx.sampleRate * 2;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    this.noise = buf;

    // continuous wind
    const wind = ctx.createBufferSource();
    wind.buffer = buf;
    wind.loop = true;
    const wf = ctx.createBiquadFilter();
    wf.type = 'bandpass';
    wf.frequency.value = 420;
    wf.Q.value = 0.7;
    const wg = ctx.createGain();
    wg.gain.value = 0.0;
    wind.connect(wf).connect(wg).connect(this.master);
    wind.start();
    this.windFilter = wf;
    this.windGain = wg;

    // ambient pad
    this.musicGain = ctx.createGain();
    this.musicGain.gain.value = 0.055;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 700;
    lp.Q.value = 0.4;
    this.musicGain.connect(lp).connect(this.master);
    this.pad = [];
    for (let i = 0; i < 4; i++) {
      const osc = ctx.createOscillator();
      osc.type = i === 0 ? 'sine' : 'triangle';
      osc.frequency.value = 110;
      const g = ctx.createGain();
      g.gain.value = i === 0 ? 0.5 : 0.16;
      osc.connect(g).connect(this.musicGain);
      osc.start();
      this.pad.push({ osc, gain: g });
    }
    this.chords = [
      [110.0, 130.81, 164.81, 196.0], // Am
      [87.31, 130.81, 174.61, 220.0], // F
      [130.81, 164.81, 196.0, 261.63], // C
      [98.0, 146.83, 196.0, 246.94], // G
    ];
    this.setChord(0);
    this.ready = true;
  }

  setChord(i) {
    if (!this.ctx) return;
    const chord = this.chords[i % this.chords.length];
    const t = this.ctx.currentTime;
    this.pad.forEach((p, idx) => {
      p.osc.frequency.setTargetAtTime(chord[idx], t, 1.4);
    });
  }

  update(dt, speed, active) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    if (this.nextChord === 0) this.nextChord = t + 7;
    if (t > this.nextChord) {
      this.nextChord = t + 7;
      this.chordIndex++;
      this.setChord(this.chordIndex);
    }
    const target = active ? Math.min(0.11, Math.max(0, (speed - 5) / 55) * 0.11) : 0;
    this.windGain.gain.setTargetAtTime(target, t, 0.12);
    this.windFilter.frequency.setTargetAtTime(280 + Math.min(speed, 65) * 26, t, 0.15);
  }

  burst({ duration = 0.2, filterType = 'bandpass', from = 2400, to = 400, q = 1.2, gain = 0.3, when = 0 }) {
    if (!this.ctx || this.muted) return;
    const ctx = this.ctx;
    const t = ctx.currentTime + when;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    src.playbackRate.value = 1;
    const f = ctx.createBiquadFilter();
    f.type = filterType;
    f.Q.value = q;
    f.frequency.setValueAtTime(from, t);
    f.frequency.exponentialRampToValueAtTime(Math.max(40, to), t + duration);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    src.connect(f).connect(g).connect(this.master);
    src.start(t, Math.random() * 1.2, duration + 0.05);
    src.stop(t + duration + 0.06);
  }

  tone(freq, duration, { type = 'sine', gain = 0.15, when = 0, slide = 0 } = {}) {
    if (!this.ctx || this.muted) return;
    const ctx = this.ctx;
    const t = ctx.currentTime + when;
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (slide) osc.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t + duration);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    osc.connect(g).connect(this.master);
    osc.start(t);
    osc.stop(t + duration + 0.03);
  }

  thwip() {
    this.burst({ duration: 0.22, from: 3800, to: 500, q: 2.5, gain: 0.32 });
    this.tone(900, 0.14, { type: 'sawtooth', gain: 0.05, slide: -500 });
  }

  release() {
    this.burst({ duration: 0.5, filterType: 'lowpass', from: 1600, to: 220, q: 0.7, gain: 0.18 });
  }

  pickup(index = 0) {
    const base = 660 * Math.pow(2, (index % 5) / 12);
    this.tone(base, 0.18, { type: 'triangle', gain: 0.13 });
    this.tone(base * 1.5, 0.26, { type: 'sine', gain: 0.1, when: 0.07 });
    this.tone(base * 2, 0.34, { type: 'sine', gain: 0.07, when: 0.14 });
  }

  land(strength = 1) {
    this.burst({ duration: 0.16, filterType: 'lowpass', from: 900, to: 160, q: 0.8, gain: 0.1 + strength * 0.12 });
    this.tone(65, 0.16, { type: 'sine', gain: 0.16 + strength * 0.1, slide: -30 });
  }

  impact(strength = 1) {
    this.burst({ duration: 0.3, filterType: 'lowpass', from: 1200, to: 90, q: 0.9, gain: 0.22 * strength });
    this.tone(52, 0.3, { type: 'sawtooth', gain: 0.1 * strength, slide: -18 });
  }

  zip() {
    this.burst({ duration: 0.32, from: 300, to: 2600, q: 1.5, gain: 0.16 });
    this.tone(220, 0.22, { type: 'triangle', gain: 0.06, slide: 420 });
  }

  finish() {
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((n, i) => this.tone(n, 0.5, { type: 'triangle', gain: 0.12, when: i * 0.13 }));
  }

  setMuted(muted) {
    this.muted = muted;
    if (this.master) this.master.gain.setTargetAtTime(muted ? 0 : 0.75, this.ctx.currentTime, 0.05);
  }

  toggleMute() {
    this.setMuted(!this.muted);
    return this.muted;
  }
}
