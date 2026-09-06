/**
 * Web Audio API Ambient & SFX Engine for SAGAR
 *
 * Provides completely self-contained, zero-dependency procedural audio:
 * 1. Soothing ocean waves (modulated pink/brown noise through an LFO-driven lowpass filter)
 * 2. Gentle pentatonic chimes (spaced peaceful ringing bells)
 * 3. High-tech robotic keypad hover chirp for interactive buttons
 */

class SoundEngine {
  private ctx: AudioContext | null = null;
  private isOceanPlaying: boolean = false;
  private masterGain: GainNode | null = null;
  private chimeTimer: ReturnType<typeof setTimeout> | null = null;
  private noiseSource: AudioBufferSourceNode | null = null;
  private lfo: OscillatorNode | null = null;
  private lastHoverTime: number = 0;
  private listeners: Set<(playing: boolean) => void> = new Set();

  private getContext(): AudioContext {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AudioCtx();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    return this.ctx;
  }

  /**
   * Subscribe to ocean audio play/pause state changes
   */
  public subscribe(listener: (playing: boolean) => void): () => void {
    this.listeners.add(listener);
    listener(this.isOceanPlaying);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notifyListeners() {
    this.listeners.forEach((fn) => fn(this.isOceanPlaying));
  }

  public isPlaying(): boolean {
    return this.isOceanPlaying;
  }

  /**
   * Generates a 6-second looping pink noise buffer for realistic ocean surf
   */
  private createPinkNoiseBuffer(ctx: AudioContext): AudioBuffer {
    const bufferSize = ctx.sampleRate * 6;
    const buffer = ctx.createBuffer(2, bufferSize, ctx.sampleRate);
    
    for (let channel = 0; channel < 2; channel++) {
      const data = buffer.getChannelData(channel);
      let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        b0 = 0.99886 * b0 + white * 0.0555179;
        b1 = 0.99332 * b1 + white * 0.0750759;
        b2 = 0.96900 * b2 + white * 0.1538520;
        b3 = 0.86650 * b3 + white * 0.3104856;
        b4 = 0.55000 * b4 + white * 0.5329522;
        b5 = -0.7616 * b5 - white * 0.0168980;
        data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.08;
        b6 = white * 0.115926;
      }
    }
    return buffer;
  }

  /**
   * Starts procedural ambient ocean waves & periodic chimes
   */
  public startOcean(): void {
    if (this.isOceanPlaying) return;

    try {
      const ctx = this.getContext();
      const now = ctx.currentTime;

      // Master gain node for smooth fade in/out
      this.masterGain = ctx.createGain();
      this.masterGain.gain.setValueAtTime(0.0001, now);
      this.masterGain.gain.exponentialRampToValueAtTime(0.28, now + 2.0);
      this.masterGain.connect(ctx.destination);

      // ── Ocean Waves Synthesis ──
      const noiseBuffer = this.createPinkNoiseBuffer(ctx);
      this.noiseSource = ctx.createBufferSource();
      this.noiseSource.buffer = noiseBuffer;
      this.noiseSource.loop = true;

      // Dynamic Biquad Filter (sweeps cutoff frequency like rolling waves)
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(320, now);
      filter.Q.setValueAtTime(1.5, now);

      // Low Frequency Oscillator (LFO) ~ 0.11 Hz (~9s ocean wave swell cycle)
      this.lfo = ctx.createOscillator();
      this.lfo.type = 'sine';
      this.lfo.frequency.setValueAtTime(0.11, now);

      const lfoGain = ctx.createGain();
      lfoGain.gain.setValueAtTime(260, now); // Sweeps between 180Hz and 700Hz

      this.lfo.connect(lfoGain);
      lfoGain.connect(filter.frequency);

      // Wave volume modulation tracking the swell
      const waveGain = ctx.createGain();
      waveGain.gain.setValueAtTime(0.85, now);

      const lfoVolumeGain = ctx.createGain();
      lfoVolumeGain.gain.setValueAtTime(0.25, now);
      this.lfo.connect(lfoVolumeGain);
      lfoVolumeGain.connect(waveGain.gain);

      this.noiseSource.connect(filter);
      filter.connect(waveGain);
      waveGain.connect(this.masterGain);

      this.noiseSource.start();
      this.lfo.start();

      this.isOceanPlaying = true;
      this.notifyListeners();

      // Schedule calming pentatonic chimes
      this.scheduleNextChime();
    } catch (e) {
      console.warn('Unable to start Web Audio waves:', e);
    }
  }

  /**
   * Plays a single soothing pentatonic chime ping with long shimmering tail
   */
  private playChimePing(): void {
    if (!this.isOceanPlaying || !this.ctx || !this.masterGain) return;

    try {
      const now = this.ctx.currentTime;
      // Peaceful C major / A minor pentatonic scale notes (Hz)
      const notes = [523.25, 587.33, 659.25, 783.99, 880.0, 1046.5];
      const freq = notes[Math.floor(Math.random() * notes.length)];

      const chimeGain = this.ctx.createGain();
      chimeGain.gain.setValueAtTime(0.0001, now);
      chimeGain.gain.linearRampToValueAtTime(0.055, now + 0.035);
      chimeGain.gain.exponentialRampToValueAtTime(0.0001, now + 3.2);

      // Fundamental tone
      const osc1 = this.ctx.createOscillator();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(freq, now);
      osc1.connect(chimeGain);

      // Faint crystalline second overtone
      const osc2 = this.ctx.createOscillator();
      const overtoneGain = this.ctx.createGain();
      overtoneGain.gain.setValueAtTime(0.02, now);
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(freq * 2.02, now);
      osc2.connect(overtoneGain);
      overtoneGain.connect(chimeGain);

      // Connect chime to master
      chimeGain.connect(this.masterGain);

      osc1.start(now);
      osc2.start(now);
      osc1.stop(now + 3.4);
      osc2.stop(now + 3.4);
    } catch {
      // Audio node cleanup safeguard
    }
  }

  /**
   * Schedules randomized peaceful chimes at pleasant 4-8 second intervals
   */
  private scheduleNextChime(): void {
    if (!this.isOceanPlaying) return;
    const nextInterval = 4200 + Math.random() * 3800; // 4.2s to 8s
    this.chimeTimer = setTimeout(() => {
      this.playChimePing();
      this.scheduleNextChime();
    }, nextInterval);
  }

  /**
   * Stops the ambient audio with a smooth fade-out
   */
  public stopOcean(): void {
    if (!this.isOceanPlaying) return;

    if (this.chimeTimer) {
      clearTimeout(this.chimeTimer);
      this.chimeTimer = null;
    }

    if (this.masterGain && this.ctx) {
      const now = this.ctx.currentTime;
      this.masterGain.gain.setValueAtTime(this.masterGain.gain.value, now);
      this.masterGain.gain.linearRampToValueAtTime(0.0001, now + 0.8);

      setTimeout(() => {
        try {
          if (this.noiseSource) {
            this.noiseSource.stop();
            this.noiseSource.disconnect();
            this.noiseSource = null;
          }
          if (this.lfo) {
            this.lfo.stop();
            this.lfo.disconnect();
            this.lfo = null;
          }
        } catch {}
      }, 900);
    }

    this.isOceanPlaying = false;
    this.notifyListeners();
  }

  /**
   * Toggles ocean audio on/off
   */
  public toggleOcean(): boolean {
    if (this.isOceanPlaying) {
      this.stopOcean();
      return false;
    } else {
      this.startOcean();
      return true;
    }
  }

  /**
   * Unlocks and resumes the AudioContext on first user interaction
   */
  public ensureUnlocked(): void {
    try {
      const ctx = this.getContext();
      if (ctx.state === 'suspended') {
        ctx.resume();
      }
    } catch {
      // Ignore if autoplay restricted
    }
  }

  /**
   * Plays an organic, crisp water bubble pop / bloop sound effect on button hover
   * Modeled after acoustic bubble resonance: rapid upward pitch chirp with fast exponential decay
   */
  public playBubbleHover(): void {
    const nowMs = Date.now();
    // Throttle to max 1 bubble sound per 40ms to avoid audio distortion during sweeps
    if (nowMs - this.lastHoverTime < 40) return;
    this.lastHoverTime = nowMs;

    try {
      const ctx = this.getContext();
      if (ctx.state === 'suspended') {
        ctx.resume();
      }

      const now = ctx.currentTime;

      // Randomize pitch slightly for organic bubble diversity
      const baseFreq = 420 + Math.random() * 150; // 420Hz - 570Hz
      const peakFreq = baseFreq * (2.6 + Math.random() * 0.4); // ~1150Hz - 1600Hz

      // Primary resonant bubble body
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(baseFreq, now);
      // Rapid upward frequency sweep characteristic of water bubble cavity release
      osc.frequency.exponentialRampToValueAtTime(peakFreq, now + 0.042);

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.065);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.07);

      // Subtle high-frequency surface pop transient (1800Hz - 2200Hz)
      const popOsc = ctx.createOscillator();
      popOsc.type = 'triangle';
      popOsc.frequency.setValueAtTime(baseFreq * 3.8, now);
      popOsc.frequency.exponentialRampToValueAtTime(baseFreq * 4.4, now + 0.015);

      const popGain = ctx.createGain();
      popGain.gain.setValueAtTime(0.04, now);
      popGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.025);

      popOsc.connect(popGain);
      popGain.connect(ctx.destination);

      popOsc.start(now);
      popOsc.stop(now + 0.03);
    } catch {
      // Audio context might be restricted before user gesture
    }
  }

  /**
   * Backward compatibility alias
   */
  public playRoboticHover(): void {
    this.playBubbleHover();
  }
}

export const soundEngine = new SoundEngine();

// Auto-unlock AudioContext on first user click or touch anywhere on the page
if (typeof window !== 'undefined') {
  const unlockAudio = () => {
    soundEngine.ensureUnlocked();
    window.removeEventListener('pointerdown', unlockAudio);
    window.removeEventListener('click', unlockAudio);
    window.removeEventListener('keydown', unlockAudio);
  };
  window.addEventListener('pointerdown', unlockAudio);
  window.addEventListener('click', unlockAudio);
  window.addEventListener('keydown', unlockAudio);
}


