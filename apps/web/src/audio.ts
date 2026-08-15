import { Haptics, ImpactStyle, NotificationType } from "@capacitor/haptics";

class AudioSynth {
  #context?: AudioContext;
  #master?: GainNode;
  #spins = new Map<
    string,
    { oscillator: OscillatorNode; filter: BiquadFilterNode; gain: GainNode }
  >();

  #lastCollisionTime = 0;
  #isMuted = false;
  #bgm?: HTMLAudioElement;
  #bgmMuted = true;
  #irBuffer?: AudioBuffer;
  #noisePool?: { crack?: AudioBuffer; click?: AudioBuffer; sizzle?: AudioBuffer };
  #collisionBus?: GainNode;
  #convolver?: ConvolverNode;
  #compressor?: DynamicsCompressorNode;
  #shaper?: WaveShaperNode;

  constructor() {
    try {
      this.#isMuted = localStorage.getItem("cyberblade.mute") === "true";
    } catch {
      this.#isMuted = false;
    }
    try {
      const stored = localStorage.getItem("cyberblade.bgm.mute");
      this.#bgmMuted = stored !== "false";
    } catch {
      this.#bgmMuted = true;
    }
  }

  get isMuted(): boolean {
    return this.#isMuted;
  }

  setMuted(muted: boolean): void {
    this.#isMuted = muted;
    try {
      localStorage.setItem("cyberblade.mute", String(muted));
    } catch {
      // Storage unavailable
    }
    if (this.#master) {
      this.#master.gain.value = muted ? 0 : 0.6;
    }
  }

  get isBGMMuted(): boolean {
    return this.#bgmMuted;
  }

  setBGMMuted(muted: boolean): void {
    this.#bgmMuted = muted;
    try {
      localStorage.setItem("cyberblade.bgm.mute", String(muted));
    } catch {
      // Storage unavailable
    }
    if (this.#bgm) {
      this.#bgm.muted = muted;
      if (!muted) {
        this.startBGM();
      } else {
        this.#bgm.pause();
      }
    }
  }

  #ensureBGM(): HTMLAudioElement {
    if (!this.#bgm) {
      this.#bgm = new Audio("/bgm.mp3");
      this.#bgm.loop = true;
      this.#bgm.muted = this.#bgmMuted;
      this.#bgm.volume = 0.3;
    }
    return this.#bgm;
  }

  startBGM(): void {
    if (this.#bgmMuted) return;
    const bgm = this.#ensureBGM();
    if (bgm.paused) {
      bgm.play().catch((err) => {
        console.warn("BGM autoplay failed, waiting for user interaction:", err);
      });
    }
  }

  click(): void {
    void Haptics.selectionChanged().catch(() => {});
    const context = this.#ensure();
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.frequency.setValueAtTime(600, context.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(
      1200,
      context.currentTime + 0.08,
    );
    gain.gain.setValueAtTime(0.12, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.09);
    oscillator.connect(gain).connect(this.#master!);
    oscillator.start();
    oscillator.stop(context.currentTime + 0.1);
  }

  collision(intensity: number): void {
    void Haptics.impact({
      style: intensity > 5 ? ImpactStyle.Heavy : ImpactStyle.Medium,
    }).catch(() => {});
    const context = this.#ensure();
    const time = context.currentTime;
    if (time - this.#lastCollisionTime < 0.05) return;
    this.#lastCollisionTime = time;

    const collisionBus = this.#ensureCollisionBus();
    const shaper = this.#ensureShaper();

    const volume = Math.min(Math.max(intensity * 0.22, 0.2), 0.95);

    // === Layer 0: BOOM — deep sub thump with pitch dive ===
    const boom = context.createOscillator();
    boom.type = "sine";
    boom.frequency.setValueAtTime(90, time);
    boom.frequency.exponentialRampToValueAtTime(30, time + 0.35);
    const boomGain = context.createGain();
    boomGain.gain.setValueAtTime(0, time);
    boomGain.gain.linearRampToValueAtTime(volume * 0.85, time + 0.005);
    boomGain.gain.exponentialRampToValueAtTime(0.001, time + 0.35);
    boom.connect(boomGain).connect(this.#master!);
    boom.start(time);
    boom.stop(time + 0.36);

    // === Layer 1: TRANSIENT — high punchy snap ===
    const snap = context.createOscillator();
    snap.type = "triangle";
    snap.frequency.setValueAtTime(800, time);
    snap.frequency.exponentialRampToValueAtTime(120, time + 0.04);
    const snapGain = context.createGain();
    snapGain.gain.setValueAtTime(volume * 0.7, time);
    snapGain.gain.exponentialRampToValueAtTime(0.001, time + 0.04);
    snap.connect(snapGain).connect(this.#master!);
    snap.start(time);
    snap.stop(time + 0.045);

    // === Layer 2: METALLIC CLANG — dissonant high sine ring ===
    const freqs = [1840, 2760, 4120];
    const ringDuration = Math.min(0.08 + intensity * 0.04, 0.35);
    for (const [i, baseFreq] of freqs.entries()) {
      const f = baseFreq * (0.95 + Math.random() * 0.1);
      const ring = context.createOscillator();
      ring.type = "sine";
      ring.frequency.setValueAtTime(f, time);
      const ringGain = context.createGain();
      const ringVol = (volume * 0.3) / (i + 1);
      ringGain.gain.setValueAtTime(ringVol, time);
      ringGain.gain.exponentialRampToValueAtTime(
        0.001,
        time + ringDuration / (i + 1),
      );
      ring.connect(ringGain);
      ringGain.connect(collisionBus);
      ring.start(time);
      ring.stop(time + ringDuration + 0.02);
    }

    // === Layer 3: CRACK — sharp burst of shaped noise ===
    const crack = context.createBufferSource();
    crack.buffer = this.#getNoiseBuffer("crack");
    const crackFilter = context.createBiquadFilter();
    crackFilter.type = "highpass";
    crackFilter.frequency.setValueAtTime(2000, time);
    const crackGain = context.createGain();
    crackGain.gain.setValueAtTime(volume * 0.5, time);
    crackGain.gain.exponentialRampToValueAtTime(0.001, time + 0.05);
    crack.connect(crackFilter).connect(crackGain).connect(collisionBus);
    crack.start(time);
    crack.stop(time + 0.055);

    // === Layer 4: CRACKLE / DEBRIS — 2-3 tiny micro-clicks ===
    const crackleCount = Math.min(Math.floor(intensity * 0.6), 4);
    for (let i = 0; i < crackleCount; i += 1) {
      const delay = 0.015 + Math.random() * 0.06;
      const crackle = context.createBufferSource();
      crackle.buffer = this.#getNoiseBuffer("click");
      const crackleFilter = context.createBiquadFilter();
      crackleFilter.type = "bandpass";
      crackleFilter.frequency.setValueAtTime(3000 + Math.random() * 3000, time);
      crackleFilter.Q.setValueAtTime(3, time);
      const crackleGain = context.createGain();
      const crackleVol = volume * (0.1 + Math.random() * 0.15);
      crackleGain.gain.setValueAtTime(crackleVol, time + delay);
      crackleGain.gain.exponentialRampToValueAtTime(
        0.001,
        time + delay + 0.015,
      );
      crackle.connect(crackleFilter).connect(crackleGain);
      crackleGain.connect(shaper);
      crackle.start(time + delay);
      crackle.stop(time + delay + 0.02);
    }

    // === Layer 5: RUMBLE — long low sine, floor shake after the blast ===
    const rumble = context.createOscillator();
    rumble.type = "sine";
    rumble.frequency.setValueAtTime(40, time);
    rumble.frequency.exponentialRampToValueAtTime(25, time + 0.5);
    const rumbleGain = context.createGain();
    rumbleGain.gain.setValueAtTime(0, time);
    rumbleGain.gain.linearRampToValueAtTime(volume * 0.4, time + 0.02);
    rumbleGain.gain.exponentialRampToValueAtTime(0.001, time + 0.7);
    rumble.connect(rumbleGain).connect(this.#master!);
    rumble.start(time);
    rumble.stop(time + 0.72);
  }

  // Toppled top scraping across the arena floor.
  scrape(): void {
    this.collision(1.5);
  }

  // Burst: low boom sweep plus a band-passed shatter noise tail.
  burst(): void {
    void Haptics.notification({
      type: NotificationType.Error,
    }).catch(() => {});
    const context = this.#ensure();
    const time = context.currentTime;

    const boom = context.createOscillator();
    const boomGain = context.createGain();
    boom.type = "triangle";
    boom.frequency.setValueAtTime(100, time);
    boom.frequency.linearRampToValueAtTime(10, time + 0.6);
    boomGain.gain.setValueAtTime(0.8, time);
    boomGain.gain.exponentialRampToValueAtTime(0.001, time + 0.6);
    boom.connect(boomGain).connect(this.#master!);
    boom.start(time);
    boom.stop(time + 0.7);

    const duration = 0.8;
    const noise = context.createBufferSource();
    noise.buffer = this.#noiseBuffer(duration);
    const filter = context.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.setValueAtTime(1500, time);
    filter.frequency.exponentialRampToValueAtTime(300, time + duration);
    filter.Q.setValueAtTime(5, time);
    const noiseGain = context.createGain();
    noiseGain.gain.setValueAtTime(0.6, time);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, time + duration);
    noise.connect(filter).connect(noiseGain).connect(this.#master!);
    noise.start(time);
    noise.stop(time + duration + 0.05);
  }

  startSpin(id: string, rpm: number): void {
    if (this.#spins.has(id)) return;
    const context = this.#ensure();
    const time = context.currentTime;
    const oscillator = context.createOscillator();
    oscillator.type = "sawtooth";
    // Low-pass keeps the sawtooth whir smooth instead of harsh.
    const filter = context.createBiquadFilter();
    filter.type = "lowpass";
    const gain = context.createGain();
    const frequency = rpmToFrequency(rpm);
    oscillator.frequency.setValueAtTime(frequency, time);
    filter.frequency.setValueAtTime(frequency * 1.5, time);
    gain.gain.setValueAtTime(0.001, time);
    gain.gain.linearRampToValueAtTime(0.08, time + 0.3);
    oscillator.connect(filter).connect(gain).connect(this.#master!);
    oscillator.start(time);
    this.#spins.set(id, { oscillator, filter, gain });
  }

  updateSpin(id: string, rpm: number): void {
    const spin = this.#spins.get(id);
    if (!spin || !this.#context) return;
    const time = this.#context.currentTime;
    const frequency = rpmToFrequency(rpm);
    spin.oscillator.frequency.setTargetAtTime(frequency, time, 0.1);
    spin.filter.frequency.setTargetAtTime(frequency * 1.5, time, 0.1);
    spin.gain.gain.setTargetAtTime(
      Math.min(Math.max((rpm / 6000) * 0.08, 0), 0.12),
      time,
      0.1,
    );
  }

  stopSpin(id: string): void {
    const spin = this.#spins.get(id);
    if (!spin || !this.#context) return;
    const time = this.#context.currentTime;
    spin.gain.gain.cancelScheduledValues(time);
    spin.gain.gain.setValueAtTime(Math.max(spin.gain.gain.value, 0.001), time);
    spin.gain.gain.exponentialRampToValueAtTime(0.001, time + 0.15);
    const nodes = spin;
    setTimeout(() => {
      try {
        nodes.oscillator.stop();
        nodes.oscillator.disconnect();
        nodes.filter.disconnect();
        nodes.gain.disconnect();
      } catch {
        // context may already be closed
      }
    }, 200);
    this.#spins.delete(id);
  }

  stop(): void {
    for (const id of [...this.#spins.keys()]) this.stopSpin(id);
  }

  #ensureCollisionBus(): GainNode {
    if (this.#collisionBus) return this.#collisionBus;
    const context = this.#ensure();
    const convolver = context.createConvolver();
    convolver.buffer = this.#getIRBuffer(context);
    const compressor = context.createDynamicsCompressor();
    compressor.threshold.value = -10;
    compressor.knee.value = 15;
    compressor.ratio.value = 4;
    compressor.attack.value = 0.002;
    compressor.release.value = 0.2;
    const send = context.createGain();
    send.gain.value = 0.55;
    send.connect(convolver);
    convolver.connect(compressor);
    compressor.connect(this.#master!);
    this.#collisionBus = send;
    this.#convolver = convolver;
    this.#compressor = compressor;
    return send;
  }

  #ensureShaper(): WaveShaperNode {
    if (this.#shaper) return this.#shaper;
    const context = this.#ensure();
    const shaper = context.createWaveShaper();
    shaper.curve = this.#makeDistortionCurve(6) as WaveShaperNode["curve"];
    shaper.oversample = "2x";
    shaper.connect(this.#master!);
    this.#shaper = shaper;
    return shaper;
  }

  #makeDistortionCurve(amount: number): Float32Array {
    const samples = 1024;
    const curve = new Float32Array(samples);
    const k = amount;
    for (let i = 0; i < samples; i += 1) {
      const x = (i / (samples - 1)) * 2 - 1;
      curve[i] = ((3 + k) * x * 20 * (Math.PI / 180)) / (Math.PI + k * Math.abs(x));
    }
    return curve;
  }

  #getIRBuffer(context: AudioContext): AudioBuffer {
    if (this.#irBuffer) return this.#irBuffer;
    const sampleRate = context.sampleRate;
    const duration = 1.4;
    const length = Math.floor(sampleRate * duration);
    const buffer = context.createBuffer(2, length, sampleRate);
    for (let channel = 0; channel < 2; channel += 1) {
      const data = buffer.getChannelData(channel);
      for (let index = 0; index < length; index += 1) {
        const t = index / length;
        data[index] = (Math.random() * 2 - 1) * Math.pow(1 - t, 2);
      }
    }
    this.#irBuffer = buffer;
    return buffer;
  }

  #getNoiseBuffer(kind: "crack" | "click" | "sizzle"): AudioBuffer {
    const existing = this.#noisePool?.[kind];
    if (existing) return existing;
    const context = this.#ensure();
    const duration = kind === "crack" ? 0.05 : kind === "click" ? 0.005 : 0.4;
    const size = Math.floor(context.sampleRate * duration);
    const buffer = context.createBuffer(1, size, context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let index = 0; index < size; index += 1) {
      data[index] = Math.random() * 2 - 1;
    }
    if (!this.#noisePool) this.#noisePool = {};
    this.#noisePool[kind] = buffer;
    return buffer;
  }

  #noiseBuffer(duration: number): AudioBuffer {
    const context = this.#ensure();
    const size = Math.floor(context.sampleRate * duration);
    const buffer = context.createBuffer(1, size, context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let index = 0; index < size; index += 1) {
      data[index] = Math.random() * 2 - 1;
    }
    return buffer;
  }

  #ensure(): AudioContext {
    this.#context ??= new AudioContext();
    if (this.#context.state === "suspended") void this.#context.resume();
    if (!this.#master) {
      this.#master = this.#context.createGain();
      this.#master.gain.value = this.#isMuted ? 0 : 0.6;
      this.#master.connect(this.#context.destination);
    }
    this.startBGM();
    return this.#context;
  }
}

function rpmToFrequency(rpm: number): number {
  // 0–6000 RPM maps to a 50–250 Hz whir.
  return 50 + (rpm / 6000) * 200;
}

export const synth = new AudioSynth();
