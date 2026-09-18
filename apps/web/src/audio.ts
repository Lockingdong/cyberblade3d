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
    const hapticStyle =
      intensity >= 6
        ? ImpactStyle.Heavy
        : intensity >= 2.5
          ? ImpactStyle.Medium
          : ImpactStyle.Light;
    void Haptics.impact({ style: hapticStyle }).catch(() => {});

    const context = this.#ensure();
    const time = context.currentTime;
    const isHeavy = intensity >= 0.8;
    const cooldown = isHeavy ? 0.06 : 0.035;
    if (time - this.#lastCollisionTime < cooldown) return;
    this.#lastCollisionTime = time;

    const collisionBus = this.#ensureCollisionBus();
    const shaper = this.#ensureShaper();

    // Boost overall volume scale for punch and impact presence
    const volume = Math.min(Math.max(intensity * 0.28, 0.28), 1.0);

    if (!isHeavy) {
      // === Light glance: crisp snap with dry metallic bite ===
      const snap = context.createOscillator();
      snap.type = "sawtooth";
      snap.frequency.setValueAtTime(900, time);
      snap.frequency.exponentialRampToValueAtTime(280, time + 0.025);
      const snapGain = context.createGain();
      snapGain.gain.setValueAtTime(volume * 0.7, time);
      snapGain.gain.exponentialRampToValueAtTime(0.001, time + 0.025);
      snap.connect(snapGain).connect(this.#master!);
      snap.start(time);
      snap.stop(time + 0.03);

      const crack = context.createBufferSource();
      crack.buffer = this.#getNoiseBuffer("crack");
      const filter = context.createBiquadFilter();
      filter.type = "highpass";
      filter.frequency.setValueAtTime(2000, time);
      const crackGain = context.createGain();
      crackGain.gain.setValueAtTime(volume * 0.5, time);
      crackGain.gain.exponentialRampToValueAtTime(0.001, time + 0.025);
      crack.connect(filter).connect(crackGain).connect(this.#master!);
      crack.start(time);
      crack.stop(time + 0.03);
      return;
    }

    // ==============================================================
    // === EXPLOSIVE HEAVY IMPACT: Tearing metal clash, dry punch ===
    // ==============================================================

    // === Layer 0: HEAVY SUB KICK — explosive low end thump ===
    const boom = context.createOscillator();
    boom.type = "triangle";
    boom.frequency.setValueAtTime(140, time);
    boom.frequency.exponentialRampToValueAtTime(38, time + 0.22);
    const boomGain = context.createGain();
    boomGain.gain.setValueAtTime(0, time);
    boomGain.gain.linearRampToValueAtTime(volume * 0.95, time + 0.003);
    boomGain.gain.exponentialRampToValueAtTime(0.001, time + 0.22);
    boom.connect(boomGain).connect(this.#master!);
    boom.start(time);
    boom.stop(time + 0.23);

    // === Layer 1: TRANSIENT TEAR (SAWTOOTH PUNCH) — sharp ripping initial crack ===
    const snap = context.createOscillator();
    snap.type = "sawtooth";
    snap.frequency.setValueAtTime(1400, time);
    snap.frequency.exponentialRampToValueAtTime(110, time + 0.04);
    const snapGain = context.createGain();
    snapGain.gain.setValueAtTime(volume * 0.95, time);
    snapGain.gain.exponentialRampToValueAtTime(0.001, time + 0.04);
    snap.connect(snapGain).connect(shaper);
    snapGain.connect(this.#master!);
    snap.start(time);
    snap.stop(time + 0.045);

    // === Layer 2: EXPLOSIVE STEEL SLAM — aggressive saturated ring (Dry + Wet) ===
    const freqs = [760, 1260, 1940];
    const ringDuration = Math.min(0.07 + intensity * 0.015, 0.15);
    for (const [i, baseFreq] of freqs.entries()) {
      const f = baseFreq * (0.97 + Math.random() * 0.06);
      const ring = context.createOscillator();
      ring.type = "sawtooth";
      ring.frequency.setValueAtTime(f, time);

      // Low-pass filter to tame harsh ultra-highs while keeping gritty steel harmonics
      const filter = context.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.setValueAtTime(3200, time);

      const ringGain = context.createGain();
      const ringVol = (volume * 0.45) / (i * 0.8 + 1);
      ringGain.gain.setValueAtTime(ringVol, time);
      ringGain.gain.exponentialRampToValueAtTime(
        0.001,
        time + ringDuration / (i * 0.5 + 1),
      );

      ring.connect(filter).connect(ringGain);
      // Dry saturated signal directly to master
      ringGain.connect(shaper);
      // Wet diffuse signal to arena reverb bus
      ringGain.connect(collisionBus);

      ring.start(time);
      ring.stop(time + ringDuration + 0.02);
    }

    // === Layer 3: EXPLOSIVE SPARK BURST — raw highpass spark blast ===
    const crack = context.createBufferSource();
    crack.buffer = this.#getNoiseBuffer("crack");
    const crackFilter = context.createBiquadFilter();
    crackFilter.type = "highpass";
    crackFilter.frequency.setValueAtTime(1500, time);
    const crackGain = context.createGain();
    crackGain.gain.setValueAtTime(volume * 0.75, time);
    crackGain.gain.exponentialRampToValueAtTime(0.001, time + 0.05);
    crack.connect(crackFilter).connect(crackGain);
    // Direct dry punch + reverb tail
    crackGain.connect(shaper);
    crackGain.connect(collisionBus);
    crack.start(time);
    crack.stop(time + 0.055);

    // === Layer 4: SHRED / DEBRIS — high-frequency metallic grinding clicks ===
    const crackleCount = Math.min(Math.floor(intensity * 0.6) + 1, 4);
    for (let i = 0; i < crackleCount; i += 1) {
      const delay = 0.008 + Math.random() * 0.04;
      const crackle = context.createBufferSource();
      crackle.buffer = this.#getNoiseBuffer("click");
      const crackleFilter = context.createBiquadFilter();
      crackleFilter.type = "bandpass";
      crackleFilter.frequency.setValueAtTime(3000 + Math.random() * 2000, time);
      crackleFilter.Q.setValueAtTime(2.0, time);
      const crackleGain = context.createGain();
      const crackleVol = volume * (0.15 + Math.random() * 0.15);
      crackleGain.gain.setValueAtTime(crackleVol, time + delay);
      crackleGain.gain.exponentialRampToValueAtTime(
        0.001,
        time + delay + 0.02,
      );
      crackle.connect(crackleFilter).connect(crackleGain);
      crackleGain.connect(this.#master!);
      crackle.start(time + delay);
      crackle.stop(time + delay + 0.025);
    }

    // === Layer 5: ARENA SHAKE — sub rumble for heavy slams ===
    if (intensity >= 4.0) {
      const rumble = context.createOscillator();
      rumble.type = "sine";
      rumble.frequency.setValueAtTime(45, time);
      rumble.frequency.exponentialRampToValueAtTime(25, time + 0.35);
      const rumbleGain = context.createGain();
      rumbleGain.gain.setValueAtTime(0, time);
      rumbleGain.gain.linearRampToValueAtTime(volume * 0.35, time + 0.02);
      rumbleGain.gain.exponentialRampToValueAtTime(0.001, time + 0.45);
      rumble.connect(rumbleGain).connect(this.#master!);
      rumble.start(time);
      rumble.stop(time + 0.47);
    }
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
    // Build the reverb IR and noise buffers now rather than on the first hit.
    this.#ensureCollisionBus();
    this.#ensureShaper();
    this.#getNoiseBuffer("crack");
    this.#getNoiseBuffer("click");
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
    shaper.curve = this.#makeDistortionCurve(16) as WaveShaperNode["curve"];
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

  /**
   * Create the (suspended) context ahead of the first gesture: constructing
   * an AudioContext blocks the main thread for ~200ms on some devices.
   */
  prepare(): AudioContext {
    this.#context ??= new AudioContext();
    if (!this.#master) {
      this.#master = this.#context.createGain();
      this.#master.gain.value = this.#isMuted ? 0 : 0.6;
      this.#master.connect(this.#context.destination);
    }
    return this.#context;
  }

  #ensure(): AudioContext {
    const context = this.prepare();
    if (context.state === "suspended") void context.resume();
    this.startBGM();
    return context;
  }
}

function rpmToFrequency(rpm: number): number {
  // 0–6000 RPM maps to a 50–250 Hz whir.
  return 50 + (rpm / 6000) * 200;
}

export const synth = new AudioSynth();
