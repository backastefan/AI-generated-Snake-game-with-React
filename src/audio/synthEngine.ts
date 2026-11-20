import { AI_TRACKS, type TrackDefinition } from '../data/tracks';

function midiToFreq(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

class SynthAudioEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private analyser: AnalyserNode | null = null;
  private frequencyData: Uint8Array<ArrayBuffer> = new Uint8Array(new ArrayBuffer(64));
  private noiseBuffer: AudioBuffer | null = null;

  private currentTrack: TrackDefinition = AI_TRACKS[0];
  private isPlaying = false;
  private volume = 0.72;
  private isMuted = false;
  private sfxEnabled = true;

  private elapsedSec = 0;
  private currentStep = 0;
  private nextStepTime = 0;
  private schedulerTimer: number | null = null;
  private progressTimer: number | null = null;
  private lastTickPerf = 0;

  private onTimeUpdate?: (timeSec: number) => void;
  private onTrackEnded?: () => void;

  private ensureContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;

    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return null;

      this.ctx = new AudioCtx();
      this.masterGain = this.ctx.createGain();
      this.musicGain = this.ctx.createGain();
      this.sfxGain = this.ctx.createGain();
      this.analyser = this.ctx.createAnalyser();
      this.analyser.fftSize = 128;
      this.analyser.smoothingTimeConstant = 0.82;

      this.musicGain.connect(this.analyser);
      this.analyser.connect(this.masterGain);
      this.sfxGain.connect(this.masterGain);
      this.masterGain.connect(this.ctx.destination);

      this.frequencyData = new Uint8Array(new ArrayBuffer(this.analyser.frequencyBinCount));
      this.noiseBuffer = this.createNoiseBuffer(this.ctx);
      this.applyVolumes();
    }

    if (this.ctx.state === 'suspended') {
      void this.ctx.resume();
    }

    return this.ctx;
  }

  private createNoiseBuffer(ctx: AudioContext): AudioBuffer {
    const bufferSize = ctx.sampleRate * 0.5;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const output = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      output[i] = Math.random() * 2 - 1;
    }
    return buffer;
  }

  private applyVolumes(): void {
    if (!this.ctx || !this.masterGain || !this.musicGain || !this.sfxGain) return;
    const now = this.ctx.currentTime;
    const effectiveVol = this.isMuted ? 0 : this.volume;
    this.masterGain.gain.setTargetAtTime(effectiveVol, now, 0.02);
    this.musicGain.gain.setTargetAtTime(0.65, now, 0.02);
    this.sfxGain.gain.setTargetAtTime(this.sfxEnabled ? 0.45 : 0, now, 0.02);
  }

  public setCallbacks(callbacks: {
    onTimeUpdate?: (timeSec: number) => void;
    onTrackEnded?: () => void;
  }): void {
    this.onTimeUpdate = callbacks.onTimeUpdate;
    this.onTrackEnded = callbacks.onTrackEnded;
  }

  public loadTrack(track: TrackDefinition, autoPlay: boolean): void {
    this.currentTrack = track;
    this.elapsedSec = 0;
    this.currentStep = 0;
    this.onTimeUpdate?.(0);

    if (autoPlay) {
      this.play();
    } else if (this.isPlaying) {
      // Keep playing seamlessly on track switch
      if (this.ctx) {
        this.nextStepTime = this.ctx.currentTime + 0.04;
      }
    }
  }

  public play(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;

    if (this.isPlaying) return;
    this.isPlaying = true;
    this.nextStepTime = ctx.currentTime + 0.05;
    this.lastTickPerf = performance.now();

    this.schedulerTimer = window.setInterval(() => this.scheduler(), 25);
    this.progressTimer = window.setInterval(() => this.updateProgress(), 100);
  }

  public pause(): void {
    this.isPlaying = false;
    if (this.schedulerTimer !== null) {
      clearInterval(this.schedulerTimer);
      this.schedulerTimer = null;
    }
    if (this.progressTimer !== null) {
      clearInterval(this.progressTimer);
      this.progressTimer = null;
    }
  }

  public seek(timeSec: number): void {
    const clamped = Math.max(0, Math.min(this.currentTrack.durationSec, timeSec));
    this.elapsedSec = clamped;
    const stepDuration = 60 / this.currentTrack.bpm / 4;
    this.currentStep = Math.floor(clamped / stepDuration) % 64;
    this.onTimeUpdate?.(clamped);
  }

  public setVolume(vol: number): void {
    this.volume = Math.max(0, Math.min(1, vol));
    if (this.volume > 0 && this.isMuted) {
      this.isMuted = false;
    }
    this.applyVolumes();
  }

  public setMuted(muted: boolean): void {
    this.isMuted = muted;
    this.applyVolumes();
  }

  public setSfxEnabled(enabled: boolean): void {
    this.sfxEnabled = enabled;
    this.applyVolumes();
  }

  public getFrequencyData(): Uint8Array {
    if (!this.analyser || !this.isPlaying || this.isMuted) {
      this.frequencyData.fill(0);
      return this.frequencyData;
    }
    this.analyser.getByteFrequencyData(this.frequencyData);
    return this.frequencyData;
  }

  private updateProgress(): void {
    if (!this.isPlaying) return;
    const now = performance.now();
    const delta = (now - this.lastTickPerf) / 1000;
    this.lastTickPerf = now;
    this.elapsedSec += delta;

    if (this.elapsedSec >= this.currentTrack.durationSec) {
      this.elapsedSec = 0;
      this.onTimeUpdate?.(0);
      this.onTrackEnded?.();
      return;
    }
    this.onTimeUpdate?.(this.elapsedSec);
  }

  private scheduler(): void {
    if (!this.ctx || !this.isPlaying) return;
    const lookahead = 0.14;
    const stepDuration = 60 / this.currentTrack.bpm / 4;

    while (this.nextStepTime < this.ctx.currentTime + lookahead) {
      this.scheduleStep(this.currentStep, this.nextStepTime, stepDuration);
      this.nextStepTime += stepDuration;
      this.currentStep = (this.currentStep + 1) % 64;
    }
  }

  private scheduleStep(stepIndex: number, time: number, stepDur: number): void {
    if (!this.ctx || !this.musicGain) return;
    const barIndex = Math.floor(stepIndex / 16) % 4;
    const stepInBar = stepIndex % 16;
    const { pattern } = this.currentTrack;

    // Chord root offset relative to bar 0 so bass & arp follow the progression
    const baseRoot = pattern.chords[0][0];
    const currentRoot = pattern.chords[barIndex][0];
    const transpose = currentRoot - baseRoot;

    // 1. Warm Polyphonic Pad on downbeat of each bar
    if (stepInBar === 0) {
      const chord = pattern.chords[barIndex];
      chord.forEach((note) => {
        this.triggerPadNote(midiToFreq(note), time, stepDur * 15.5, pattern.padWave, pattern.filterCutoff);
      });
    }

    // 2. Bassline
    const bassMidi = pattern.bass[stepInBar];
    if (bassMidi > 0) {
      this.triggerBassNote(
        midiToFreq(bassMidi + transpose),
        time,
        stepDur * 0.88,
        pattern.bassWave,
        pattern.filterCutoff * 0.72
      );
    }

    // 3. Arpeggiator
    const arpMidi = pattern.arp[stepInBar];
    if (arpMidi > 0) {
      this.triggerPluckNote(
        midiToFreq(arpMidi + transpose),
        time,
        stepDur * 0.7,
        'triangle',
        0.09
      );
    }

    // 4. Melodic Lead (plays on bars 1 & 3, or variations across bars)
    const leadMidi = pattern.lead[stepInBar];
    if (leadMidi > 0 && (barIndex === 0 || barIndex === 2 || stepInBar % 4 === 0)) {
      const octaveLift = barIndex === 2 ? 12 : 0;
      this.triggerLeadNote(
        midiToFreq(leadMidi + octaveLift),
        time,
        stepDur * 1.8,
        pattern.leadWave,
        pattern.filterCutoff
      );
    }

    // 5. Drum Groove
    this.triggerDrums(stepInBar, time, pattern.drumStyle);
  }

  private triggerPadNote(
    freq: number,
    time: number,
    dur: number,
    wave: OscillatorType,
    cutoff: number
  ): void {
    if (!this.ctx || !this.musicGain) return;
    const osc = this.ctx.createOscillator();
    const filter = this.ctx.createBiquadFilter();
    const gain = this.ctx.createGain();

    osc.type = wave;
    osc.frequency.setValueAtTime(freq, time);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(cutoff * 0.55, time);

    gain.gain.setValueAtTime(0.0001, time);
    gain.gain.linearRampToValueAtTime(0.055, time + 0.18);
    gain.gain.setValueAtTime(0.05, time + dur * 0.75);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + dur);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.musicGain);

    osc.start(time);
    osc.stop(time + dur + 0.02);
  }

  private triggerBassNote(
    freq: number,
    time: number,
    dur: number,
    wave: OscillatorType,
    cutoff: number
  ): void {
    if (!this.ctx || !this.musicGain) return;
    const osc = this.ctx.createOscillator();
    const filter = this.ctx.createBiquadFilter();
    const gain = this.ctx.createGain();

    osc.type = wave;
    osc.frequency.setValueAtTime(freq, time);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(cutoff, time);
    filter.frequency.exponentialRampToValueAtTime(160, time + dur);

    gain.gain.setValueAtTime(0.0001, time);
    gain.gain.linearRampToValueAtTime(0.18, time + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.001, time + dur);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.musicGain);

    osc.start(time);
    osc.stop(time + dur + 0.02);
  }

  private triggerPluckNote(
    freq: number,
    time: number,
    dur: number,
    wave: OscillatorType,
    peakGain: number
  ): void {
    if (!this.ctx || !this.musicGain) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = wave;
    osc.frequency.setValueAtTime(freq, time);

    gain.gain.setValueAtTime(0.0001, time);
    gain.gain.linearRampToValueAtTime(peakGain, time + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + dur);

    osc.connect(gain);
    gain.connect(this.musicGain);

    osc.start(time);
    osc.stop(time + dur + 0.02);
  }

  private triggerLeadNote(
    freq: number,
    time: number,
    dur: number,
    wave: OscillatorType,
    cutoff: number
  ): void {
    if (!this.ctx || !this.musicGain) return;
    const osc = this.ctx.createOscillator();
    const filter = this.ctx.createBiquadFilter();
    const gain = this.ctx.createGain();

    osc.type = wave;
    osc.frequency.setValueAtTime(freq, time);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(cutoff * 1.4, time);
    filter.frequency.exponentialRampToValueAtTime(cutoff * 0.45, time + dur);

    gain.gain.setValueAtTime(0.0001, time);
    gain.gain.linearRampToValueAtTime(0.085, time + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + dur);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.musicGain);

    osc.start(time);
    osc.stop(time + dur + 0.02);
  }

  private triggerDrums(stepInBar: number, time: number, style: 'synthwave' | 'darksynth' | 'ambient'): void {
    if (!this.ctx || !this.musicGain) return;

    const kickSteps =
      style === 'ambient' ? [0, 10] : style === 'darksynth' ? [0, 4, 8, 12, 14] : [0, 4, 8, 12];
    const snareSteps = style === 'ambient' ? [8] : [4, 12];
    const hatSteps =
      style === 'darksynth'
        ? [0, 2, 4, 6, 8, 10, 12, 14, 15]
        : style === 'synthwave'
        ? [2, 6, 10, 14]
        : [2, 6, 10, 14];

    if (kickSteps.includes(stepInBar)) {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(style === 'ambient' ? 95 : 130, time);
      osc.frequency.exponentialRampToValueAtTime(40, time + 0.12);

      gain.gain.setValueAtTime(style === 'ambient' ? 0.24 : 0.36, time);
      gain.gain.exponentialRampToValueAtTime(0.001, time + 0.18);

      osc.connect(gain);
      gain.connect(this.musicGain);
      osc.start(time);
      osc.stop(time + 0.2);
    }

    if (snareSteps.includes(stepInBar) && this.noiseBuffer) {
      const noise = this.ctx.createBufferSource();
      noise.buffer = this.noiseBuffer;

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(style === 'ambient' ? 1100 : 1800, time);

      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(style === 'ambient' ? 0.06 : 0.16, time);
      gain.gain.exponentialRampToValueAtTime(0.001, time + 0.16);

      noise.connect(filter);
      filter.connect(gain);
      gain.connect(this.musicGain);
      noise.start(time);
      noise.stop(time + 0.17);
    }

    if (hatSteps.includes(stepInBar) && this.noiseBuffer) {
      const noise = this.ctx.createBufferSource();
      noise.buffer = this.noiseBuffer;

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'highpass';
      filter.frequency.setValueAtTime(7000, time);

      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(style === 'ambient' ? 0.025 : 0.055, time);
      gain.gain.exponentialRampToValueAtTime(0.001, time + 0.045);

      noise.connect(filter);
      filter.connect(gain);
      gain.connect(this.musicGain);
      noise.start(time);
      noise.stop(time + 0.05);
    }
  }

  // --- Synthesized Game Sound Effects ---

  public playEatSound(): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.sfxGain || !this.sfxEnabled || this.isMuted) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(520, now);
    osc.frequency.exponentialRampToValueAtTime(980, now + 0.09);

    gain.gain.setValueAtTime(0.22, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + 0.13);
  }

  public playBonusSound(): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.sfxGain || !this.sfxEnabled || this.isMuted) return;

    const now = ctx.currentTime;
    [660, 880, 1175].forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now + idx * 0.045);

      gain.gain.setValueAtTime(0.2, now + idx * 0.045);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.045 + 0.16);

      osc.connect(gain);
      gain.connect(this.sfxGain!);
      osc.start(now + idx * 0.045);
      osc.stop(now + idx * 0.045 + 0.17);
    });
  }

  public playStartSound(): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.sfxGain || !this.sfxEnabled || this.isMuted) return;

    const now = ctx.currentTime;
    [440, 660].forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now + idx * 0.05);

      gain.gain.setValueAtTime(0.16, now + idx * 0.05);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.05 + 0.12);

      osc.connect(gain);
      gain.connect(this.sfxGain!);
      osc.start(now + idx * 0.05);
      osc.stop(now + idx * 0.05 + 0.13);
    });
  }

  public playGameOverSound(): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.sfxGain || !this.sfxEnabled || this.isMuted) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(280, now);
    osc.frequency.exponentialRampToValueAtTime(75, now + 0.36);

    gain.gain.setValueAtTime(0.2, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.38);

    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + 0.4);
  }
}

export const synthEngine = new SynthAudioEngine();
