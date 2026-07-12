import type { SimEvent } from '../sim/types';

/**
 * The whole soundscape, synthesized — no assets, same rule as the art.
 *
 * MUSIC: ethereal / organic / upbeat-while-atmospheric. A slow Lydian pad
 * breathes under a kalimba-like pluck pattern that keeps gentle forward
 * momentum; high shimmer bells wash through on long intervals. Everything
 * runs through a generated-impulse reverb. Game state bends the score:
 * danger darkens the chords, the dying sun closes the filter, the round's
 * end resolves (or collapses) the harmony.
 *
 * SFX: impact-forward one-shots keyed to sim events, volume attenuated by
 * distance to the camera so battles are loud in your face and rumors far
 * away. Musical events (sprouts, blessings) are quantized to the current
 * chord so action and score stay one instrument.
 *
 * UI: small glassy ticks and chimes for buttons, drafts, and verdicts.
 *
 * Autoplay policy: everything waits for the first user gesture (unlock()).
 */

type Mood = 'calm' | 'tension' | 'won' | 'lost';

// A-Lydian-ish palette. Chords as semitone offsets from A2 (110 Hz).
const CHORDS_CALM: number[][] = [
  [0, 7, 16, 23], // Amaj7 spread
  [2, 9, 18, 25], // B/A brightness (lydian II)
  [9, 16, 24, 28], // F#m9 glow
  [7, 14, 23, 28], // Emaj7
];
const CHORDS_TENSION: number[][] = [
  [0, 7, 15, 22], // Am7 — the third falls
  [10, 17, 22, 27], // Gm-ish shadow
  [8, 15, 20, 27],
  [5, 12, 20, 24],
];
const ROOT = 110; // A2

const st = (semis: number, base = ROOT): number => base * Math.pow(2, semis / 12);

export class SoundSystem {
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private musicBus!: GainNode;
  private sfxBus!: GainNode;
  private reverb!: ConvolverNode;
  private reverbSend!: GainNode;
  private filter!: BiquadFilterNode;
  private padVoices: { osc: OscillatorNode; gain: GainNode }[] = [];
  private drone: { osc: OscillatorNode; gain: GainNode } | null = null;
  private chordIx = 0;
  private nextChordAt = 0;
  private nextPluckAt = 0;
  private nextShimmerAt = 0;
  private pluckStep = 0;
  private lastSfx = new Map<string, number>();
  private mood: Mood = 'calm';
  private brightness = 1; // sunFactor
  private intensity = 0; // 0 peace .. 1 open war — drives tempo & aggression
  private nextPulseAt = 0;
  private pulseStep = 0;
  muted = false;

  constructor() {
    try {
      this.muted = localStorage.getItem('pluntz.muted') === '1';
    } catch {
      /* ignore */
    }
  }

  /** Call from the first user gesture; safe to call repeatedly. */
  unlock(): void {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') void this.ctx.resume();
      return;
    }
    const AC = window.AudioContext ?? (window as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    const ctx = new AC();
    this.ctx = ctx;

    this.master = ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 0.9;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -18;
    comp.ratio.value = 6;
    comp.attack.value = 0.004;
    comp.release.value = 0.24;
    this.master.connect(comp);
    comp.connect(ctx.destination);

    // generated-impulse reverb: a long soft space for the void
    this.reverb = ctx.createConvolver();
    this.reverb.buffer = this.makeImpulse(3.2, 2.6);
    const reverbOut = ctx.createGain();
    reverbOut.gain.value = 0.55;
    this.reverb.connect(reverbOut);
    reverbOut.connect(this.master);
    this.reverbSend = ctx.createGain();
    this.reverbSend.gain.value = 1;
    this.reverbSend.connect(this.reverb);

    this.musicBus = ctx.createGain();
    this.musicBus.gain.value = 0.5;
    this.filter = ctx.createBiquadFilter();
    this.filter.type = 'lowpass';
    this.filter.frequency.value = 1400;
    this.filter.Q.value = 0.4;
    this.musicBus.connect(this.filter);
    this.filter.connect(this.master);
    const musVerb = ctx.createGain();
    musVerb.gain.value = 0.5;
    this.filter.connect(musVerb);
    musVerb.connect(this.reverbSend);

    this.sfxBus = ctx.createGain();
    this.sfxBus.gain.value = 0.85;
    this.sfxBus.connect(this.master);
    const sfxVerb = ctx.createGain();
    sfxVerb.gain.value = 0.3;
    this.sfxBus.connect(sfxVerb);
    sfxVerb.connect(this.reverbSend);

    this.startMusic();
  }

  setMuted(m: boolean): void {
    this.muted = m;
    try {
      localStorage.setItem('pluntz.muted', m ? '1' : '0');
    } catch {
      /* ignore */
    }
    if (this.ctx) {
      this.master.gain.setTargetAtTime(m ? 0 : 0.9, this.ctx.currentTime, 0.1);
    }
  }

  /**
   * Per-frame world mood. `intensity` (0..1) is the war meter: it speeds the
   * pluck grid and chord cycle, tightens the drum pulse in, and lets saw
   * voices bleed into the pads — peace is a garden, war is a march.
   */
  setMood(mood: Mood, sunFactor: number, intensity = 0): void {
    this.mood = mood;
    this.brightness = sunFactor;
    // ratchet up fast, cool down slow — battles flare, aftermaths linger
    this.intensity += (intensity - this.intensity) * (intensity > this.intensity ? 0.25 : 0.02);
    if (!this.ctx) return;
    const target =
      mood === 'lost'
        ? 350
        : mood === 'won'
          ? 2400
          : (500 + 1300 * sunFactor) * (1 - this.intensity * 0.35) + this.intensity * 900;
    this.filter.frequency.setTargetAtTime(target, this.ctx.currentTime, 1.2);
  }

  // ------------------------------------------------------------- music core

  private startMusic(): void {
    const ctx = this.ctx!;
    // sub drone: the void's own low hum
    const dOsc = ctx.createOscillator();
    dOsc.type = 'sine';
    dOsc.frequency.value = ROOT / 2;
    const dGain = ctx.createGain();
    dGain.gain.value = 0.05;
    dOsc.connect(dGain);
    dGain.connect(this.musicBus);
    dOsc.start();
    this.drone = { osc: dOsc, gain: dGain };

    this.nextChordAt = ctx.currentTime + 0.2;
    this.nextPluckAt = ctx.currentTime + 1.5;
    this.nextPulseAt = ctx.currentTime + 2;
    this.nextShimmerAt = ctx.currentTime + 6;
    window.setInterval(() => this.schedule(), 120); // lives as long as the app
  }

  private schedule(): void {
    const ctx = this.ctx!;
    const ahead = ctx.currentTime + 0.35;
    const war = this.intensity;
    // war accelerates everything: ~96 bpm at peace, ~150 in open battle
    const tempo = 1 + war * 0.55;

    // chord changes: a long breath in peace, urgent turns in war
    if (this.nextChordAt < ahead) {
      this.playChord(this.nextChordAt);
      this.nextChordAt += 8.5 / (1 + war * 0.55);
    }

    // the kalimba line: denser AND faster as the fighting rises
    const pluckGap = 0.3125 / tempo;
    while (this.nextPluckAt < ahead) {
      const density =
        this.mood === 'lost' ? 0 : (0.42 + this.brightness * 0.18) * (1 - war * 0.15) + war * 0.3;
      if (Math.random() < density) {
        this.pluck(this.nextPluckAt);
        // battle plucks strike in urgent pairs
        if (war > 0.5 && Math.random() < war * 0.4) {
          this.pluck(this.nextPluckAt + pluckGap * 0.5, undefined, 0.7);
        }
      }
      this.pluckStep++;
      // organic timing: the grid itself sways a few ms
      this.nextPluckAt += pluckGap + Math.sin(this.pluckStep * 0.7) * 0.012;
    }

    // the war drum: silent in peace, a driving low pulse as colonies clash
    const beat = 0.625 / tempo;
    while (this.nextPulseAt < ahead) {
      if (war > 0.12 && this.mood !== 'won' && this.mood !== 'lost') {
        const accent = this.pulseStep % 4 === 0;
        this.drum(this.nextPulseAt, war * (accent ? 1 : 0.55), accent);
      }
      this.pulseStep++;
      this.nextPulseAt += beat;
    }

    // shimmer bells: rare high washes through the reverb (peace only)
    if (this.nextShimmerAt < ahead) {
      if (this.mood !== 'lost' && war < 0.4) this.shimmer(this.nextShimmerAt);
      this.nextShimmerAt += 9 + Math.random() * 14;
    }
  }

  /** The war drum: a deep taiko thump with a skin-slap, scaled by intensity. */
  private drum(when: number, strength: number, accent: boolean): void {
    const ctx = this.ctx!;
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(accent ? 92 : 74, when);
    osc.frequency.exponentialRampToValueAtTime(38, when + 0.16);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.14 * strength, when);
    g.gain.exponentialRampToValueAtTime(0.0008, when + 0.24);
    osc.connect(g);
    g.connect(this.musicBus);
    osc.start(when);
    osc.stop(when + 0.28);
    if (accent) {
      const noise = ctx.createBufferSource();
      noise.buffer = this.noiseBuf(0.05);
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = 1600;
      bp.Q.value = 1.2;
      const ng = ctx.createGain();
      ng.gain.setValueAtTime(0.05 * strength, when);
      ng.gain.exponentialRampToValueAtTime(0.0005, when + 0.05);
      noise.connect(bp);
      bp.connect(ng);
      ng.connect(this.musicBus);
      noise.start(when);
    }
  }

  private currentChord(): number[] {
    const dark = this.mood === 'lost' || this.intensity > 0.35;
    const set = dark ? CHORDS_TENSION : CHORDS_CALM;
    return set[this.chordIx % set.length];
  }

  private playChord(when: number): void {
    const ctx = this.ctx!;
    // release the old voices
    for (const v of this.padVoices) {
      v.gain.gain.setTargetAtTime(0, when, 1.8);
      v.osc.stop(when + 7);
    }
    this.padVoices = [];
    this.chordIx++;
    const chord = this.currentChord();
    this.drone?.osc.frequency.setTargetAtTime(st(chord[0]) / 2, when, 2.5);
    for (let i = 0; i < chord.length; i++) {
      for (const detune of [-4, 3]) {
        const osc = ctx.createOscillator();
        // war lets sawteeth bleed into the pad — the same chords, but armed
        osc.type =
          i === 0 ? 'sine' : this.intensity > 0.55 && i === chord.length - 1 ? 'sawtooth' : 'triangle';
        osc.frequency.value = st(chord[i]);
        osc.detune.value = detune;
        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0, when);
        gain.gain.linearRampToValueAtTime(0.028 / (1 + i * 0.25), when + 2.8 + i * 0.4);
        osc.connect(gain);
        gain.connect(this.musicBus);
        osc.start(when);
        this.padVoices.push({ osc, gain });
      }
    }
  }

  /** Kalimba/harp hybrid: a warm organic pluck on the current harmony. */
  private pluck(when: number, forced?: number, vol = 1): void {
    const ctx = this.ctx!;
    const chord = this.currentChord();
    const deg =
      forced ??
      chord[Math.floor(Math.random() * chord.length)] +
        12 * (1 + (Math.random() < 0.3 ? 1 : 0));
    const f = st(deg);
    const osc = ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(f * 1.012, when); // organic: settles into tune
    osc.frequency.exponentialRampToValueAtTime(f, when + 0.06);
    const gain = ctx.createGain();
    const v = (0.05 + Math.random() * 0.03) * vol;
    gain.gain.setValueAtTime(0, when);
    gain.gain.linearRampToValueAtTime(v, when + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0004, when + 0.65);
    // the thumb-click that makes it kalimba, not synth
    const click = ctx.createOscillator();
    click.type = 'sine';
    click.frequency.value = f * 3.98;
    const cGain = ctx.createGain();
    cGain.gain.setValueAtTime(v * 0.5, when);
    cGain.gain.exponentialRampToValueAtTime(0.0004, when + 0.05);
    const pan = ctx.createStereoPanner();
    pan.pan.value = (Math.random() - 0.5) * 0.8;
    osc.connect(gain);
    click.connect(cGain);
    gain.connect(pan);
    cGain.connect(pan);
    pan.connect(this.musicBus);
    osc.start(when);
    click.start(when);
    osc.stop(when + 0.8);
    click.stop(when + 0.1);
  }

  private shimmer(when: number): void {
    const ctx = this.ctx!;
    const chord = this.currentChord();
    const f = st(chord[1 + Math.floor(Math.random() * (chord.length - 1))] + 24);
    for (const [mult, v] of [
      [1, 0.02],
      [2.01, 0.008],
    ] as const) {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = f * mult;
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0, when);
      gain.gain.linearRampToValueAtTime(v, when + 1.2);
      gain.gain.exponentialRampToValueAtTime(0.0003, when + 6);
      osc.connect(gain);
      gain.connect(this.reverbSend); // straight into the wash
      osc.start(when);
      osc.stop(when + 6.5);
    }
  }

  // --------------------------------------------------------------- SFX core

  /** Sim events, attenuated by distance to camera. Impact and action first. */
  ingest(events: SimEvent[], cam: { x: number; y: number }, zoom: number): void {
    if (!this.ctx || this.muted) return;
    for (const e of events) {
      const d = Math.hypot(e.x - cam.x, e.y - cam.y) * Math.min(zoom, 1.4);
      const vol = 1 / (1 + d / 520);
      if (vol < 0.12) continue; // too far to matter
      switch (e.type) {
        case 'impact':
          this.thump(vol * Math.min(0.4 + (e.power ?? 5) * 0.06, 1), 'impact');
          break;
        case 'shatter':
          this.crash(vol * Math.min(0.5 + (e.power ?? 6) * 0.05, 1.1));
          break;
        case 'partDied':
          if (e.kind === 'heart') this.toll(Math.max(vol, 0.5)); // a death is news
          else this.snap(vol * 0.5);
          break;
        case 'seedLaunch':
          this.whoosh(vol);
          break;
        case 'seedLand':
        case 'sprout':
          this.sproutChime(vol);
          break;
        case 'seedFizzle':
          this.fizzle(vol * 0.5);
          break;
        case 'bless':
          this.gliss([0, 7, 12], 0.09, vol);
          break;
        case 'ping':
          this.sonar(vol);
          break;
        case 'lure':
          this.gliss([12, 9, 4], 0.11, vol * 0.8);
          break;
        // 'grow' stays silent: it fires constantly
      }
    }
  }

  private gate(key: string, minGap: number): boolean {
    const now = this.ctx!.currentTime;
    if ((this.lastSfx.get(key) ?? -9) + minGap > now) return false;
    this.lastSfx.set(key, now);
    return true;
  }

  private noiseBuf(len: number): AudioBuffer {
    const ctx = this.ctx!;
    const buf = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * len), ctx.sampleRate);
    const ch = buf.getChannelData(0);
    for (let i = 0; i < ch.length; i++) ch[i] = Math.random() * 2 - 1;
    return buf;
  }

  private makeImpulse(len: number, decay: number): AudioBuffer {
    const ctx = this.ctx!;
    const n = Math.ceil(ctx.sampleRate * len);
    const buf = ctx.createBuffer(2, n, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const ch = buf.getChannelData(c);
      for (let i = 0; i < n; i++) {
        ch[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, decay);
      }
    }
    return buf;
  }

  /** Body-blow: pitch-dropping sine thud + a slap of filtered noise. */
  private thump(vol: number, gateKey = 'thump'): void {
    if (!this.gate(gateKey, 0.05)) return;
    const ctx = this.ctx!;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(190, t);
    osc.frequency.exponentialRampToValueAtTime(55, t + 0.11);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.5 * vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.16);
    osc.connect(g);
    g.connect(this.sfxBus);
    osc.start(t);
    osc.stop(t + 0.2);
    const noise = ctx.createBufferSource();
    noise.buffer = this.noiseBuf(0.08);
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 900;
    bp.Q.value = 0.8;
    const ng = ctx.createGain();
    ng.gain.setValueAtTime(0.25 * vol, t);
    ng.gain.exponentialRampToValueAtTime(0.001, t + 0.07);
    noise.connect(bp);
    bp.connect(ng);
    ng.connect(this.sfxBus);
    noise.start(t);
  }

  /** Rock-break: noise crash + inharmonic metallic partials. */
  private crash(vol: number): void {
    if (!this.gate('crash', 0.09)) return;
    const ctx = this.ctx!;
    const t = ctx.currentTime;
    const noise = ctx.createBufferSource();
    noise.buffer = this.noiseBuf(0.4);
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(4200, t);
    lp.frequency.exponentialRampToValueAtTime(320, t + 0.32);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.5 * vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.38);
    noise.connect(lp);
    lp.connect(g);
    g.connect(this.sfxBus);
    noise.start(t);
    for (const f of [1330, 2170, 3390]) {
      const osc = ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.value = f * (0.97 + Math.random() * 0.06);
      const og = ctx.createGain();
      og.gain.setValueAtTime(0.06 * vol, t);
      og.gain.exponentialRampToValueAtTime(0.0005, t + 0.22);
      osc.connect(og);
      og.connect(this.sfxBus);
      osc.start(t);
      osc.stop(t + 0.25);
    }
  }

  /** A heart going dark: deep two-tone toll, long and unmissable. */
  private toll(vol: number): void {
    if (!this.gate('toll', 0.4)) return;
    const ctx = this.ctx!;
    const t = ctx.currentTime;
    for (const [f, v, dur] of [
      [110, 0.4, 2.4],
      [131, 0.22, 2.0], // the minor third above — grief
      [55, 0.3, 2.8],
    ] as const) {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = f;
      const g = ctx.createGain();
      g.gain.setValueAtTime(v * vol, t);
      g.gain.exponentialRampToValueAtTime(0.0006, t + dur);
      osc.connect(g);
      g.connect(this.sfxBus);
      g.connect(this.reverbSend);
      osc.start(t);
      osc.stop(t + dur + 0.1);
    }
  }

  private snap(vol: number): void {
    if (!this.gate('snap', 0.08)) return;
    const ctx = this.ctx!;
    const t = ctx.currentTime;
    const noise = ctx.createBufferSource();
    noise.buffer = this.noiseBuf(0.05);
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 2400;
    bp.Q.value = 2;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.2 * vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
    noise.connect(bp);
    bp.connect(g);
    g.connect(this.sfxBus);
    noise.start(t);
  }

  /** Launch: rising airy sweep, the sound of intent leaving the bow. */
  private whoosh(vol: number): void {
    if (!this.gate('whoosh', 0.1)) return;
    const ctx = this.ctx!;
    const t = ctx.currentTime;
    const noise = ctx.createBufferSource();
    noise.buffer = this.noiseBuf(0.3);
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.Q.value = 1.6;
    bp.frequency.setValueAtTime(500, t);
    bp.frequency.exponentialRampToValueAtTime(2600, t + 0.22);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.001, t);
    g.gain.exponentialRampToValueAtTime(0.28 * vol, t + 0.06);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.28);
    noise.connect(bp);
    bp.connect(g);
    g.connect(this.sfxBus);
    noise.start(t);
    this.pluck(t, 12, vol * 0.8); // and a musical accent on the harmony
  }

  /** New life: a warm pop and a rising in-key chime. */
  private sproutChime(vol: number): void {
    if (!this.gate('sprout', 0.15)) return;
    const t = this.ctx!.currentTime;
    this.thump(vol * 0.4, 'sproutThump');
    const chord = this.currentChord();
    this.pluck(t + 0.02, chord[1] + 12, vol);
    this.pluck(t + 0.13, chord[2] + 12, vol * 0.8);
  }

  private fizzle(vol: number): void {
    if (!this.gate('fizzle', 0.25)) return;
    const ctx = this.ctx!;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(520, t);
    osc.frequency.exponentialRampToValueAtTime(160, t + 0.2);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.08 * vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
    osc.connect(g);
    g.connect(this.sfxBus);
    osc.start(t);
    osc.stop(t + 0.25);
  }

  private sonar(vol: number): void {
    if (!this.gate('sonar', 0.2)) return;
    const ctx = this.ctx!;
    for (const [dt, v] of [
      [0, 0.16],
      [0.28, 0.07],
    ] as const) {
      const t = ctx.currentTime + dt;
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = 880;
      const g = ctx.createGain();
      g.gain.setValueAtTime(v * vol, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
      osc.connect(g);
      g.connect(this.sfxBus);
      g.connect(this.reverbSend);
      osc.start(t);
      osc.stop(t + 0.25);
    }
  }

  /** Quick run of in-key plucks (bless, lure, fanfares). */
  private gliss(degrees: number[], gap: number, vol: number): void {
    if (!this.ctx || !this.gate('gliss', 0.2)) return;
    const chord = this.currentChord();
    degrees.forEach((deg, i) => {
      this.pluck(this.ctx!.currentTime + i * gap, chord[0] + deg + 12, vol);
    });
  }

  // ---------------------------------------------------------------- UI core

  ui(name: 'click' | 'select' | 'open' | 'close' | 'offer' | 'pick' | 'denied' | 'win' | 'lose' | 'grow'): void {
    if (!this.ctx || this.muted) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const tick = (f: number, v: number, dur = 0.07, delay = 0): void => {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = f;
      const g = ctx.createGain();
      g.gain.setValueAtTime(v, t + delay);
      g.gain.exponentialRampToValueAtTime(0.001, t + delay + dur);
      osc.connect(g);
      g.connect(this.sfxBus);
      osc.start(t + delay);
      osc.stop(t + delay + dur + 0.02);
    };
    switch (name) {
      case 'click':
        tick(660, 0.08);
        break;
      case 'select':
        tick(520, 0.07);
        tick(780, 0.06, 0.07, 0.04);
        break;
      case 'open':
        tick(440, 0.06);
        tick(660, 0.06, 0.09, 0.05);
        break;
      case 'close':
        tick(660, 0.05);
        tick(440, 0.05, 0.09, 0.05);
        break;
      case 'offer':
        // a draft arrives: glassy upward arpeggio you can't miss
        this.gliss([0, 4, 7, 12], 0.085, 1.1);
        break;
      case 'pick':
        this.gliss([7, 12], 0.09, 1);
        tick(1320, 0.05, 0.3, 0.18);
        break;
      case 'denied':
        tick(220, 0.09, 0.12);
        tick(196, 0.09, 0.16, 0.09);
        break;
      case 'grow':
        this.gliss([0, 7, 12, 16], 0.1, 1.2);
        break;
      case 'win':
        this.gliss([0, 4, 7, 12, 16, 19], 0.11, 1.4);
        break;
      case 'lose':
        this.gliss([12, 8, 3, 0], 0.22, 1);
        break;
    }
  }
}

/** The one soundscape, shared by main and the UI modules. */
export const SOUND = new SoundSystem();
