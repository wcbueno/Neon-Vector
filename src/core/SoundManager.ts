
export class SoundManager {
  ctx: AudioContext | null = null;
  masterGain: GainNode | null = null;
  
  // BGM Nodes
  bgmGain: GainNode | null = null;
  bgmFilter: BiquadFilterNode | null = null;
  
  // Ambient Nodes
  ambientGain: GainNode | null = null;
  ambientSource: AudioBufferSourceNode | null = null;

  isPlaying: boolean = false;
  isMuted: boolean = false;

  // BGM System
  intensity: 'NORMAL' | 'ACTION' | 'BOSS' = 'NORMAL';
  nextNoteTime: number = 0;
  current16thNote: number = 0;
  measureCount: number = 0; 
  scheduleAheadTime: number = 0.1;
  lookahead: number = 25; // ms
  timerID: number | null = null;

  // Dynamic State
  playerHealthRatio: number = 1.0;

  constructor() {
    try {
      // @ts-ignore
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AudioContext();
      this.masterGain = this.ctx.createGain();
      this.masterGain.connect(this.ctx.destination);
      this.masterGain.gain.value = 0.3; 

      // Setup BGM Filter Chain
      this.bgmFilter = this.ctx.createBiquadFilter();
      this.bgmFilter.type = 'lowpass';
      this.bgmFilter.frequency.value = 22000; // Open by default
      this.bgmFilter.connect(this.masterGain);

      this.bgmGain = this.ctx.createGain();
      this.bgmGain.connect(this.bgmFilter);

      // Setup Ambient Chain
      this.ambientGain = this.ctx.createGain();
      this.ambientGain.gain.value = 0.05; // Subtle
      this.ambientGain.connect(this.masterGain);

    } catch (e) {
      console.error('Web Audio API not supported');
    }
  }

  async init() {
    if (this.ctx?.state === 'suspended') {
      await this.ctx.resume();
    }
    if (!this.isPlaying && !this.isMuted) {
      this.startBGM();
      this.startAmbient();
    }
  }

  toggleMute() {
    this.isMuted = !this.isMuted;
    if (this.masterGain) {
      this.masterGain.gain.value = this.isMuted ? 0 : 0.3;
    }
    if (!this.isMuted && !this.isPlaying) {
        this.startBGM();
        this.startAmbient();
    } else if (this.isMuted) {
        this.stopBGM();
        this.stopAmbient();
    }
  }

  setIntensity(level: 'NORMAL' | 'ACTION' | 'BOSS') {
    this.intensity = level;
  }

  setHealth(current: number, max: number) {
    this.playerHealthRatio = Math.max(0, current / max);
  }

  setPauseState(paused: boolean) {
    if (!this.ctx || !this.bgmFilter) return;
    const t = this.ctx.currentTime;
    // Underwater effect: Lowpass filter down to 400Hz when paused
    if (paused) {
        this.bgmFilter.frequency.exponentialRampToValueAtTime(400, t + 0.5);
    } else {
        this.bgmFilter.frequency.exponentialRampToValueAtTime(22000, t + 0.5);
    }
  }

  // --- AMBIENT NOISE ---
  createPinkNoise(): AudioBuffer | null {
      if (!this.ctx) return null;
      const bufferSize = this.ctx.sampleRate * 2; // 2 seconds
      const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      let b0, b1, b2, b3, b4, b5, b6;
      b0 = b1 = b2 = b3 = b4 = b5 = b6 = 0.0;
      for (let i = 0; i < bufferSize; i++) {
          const white = Math.random() * 2 - 1;
          b0 = 0.99886 * b0 + white * 0.0555179;
          b1 = 0.99332 * b1 + white * 0.075076;
          b2 = 0.96900 * b2 + white * 0.1538520;
          b3 = 0.86650 * b3 + white * 0.3104856;
          b4 = 0.55000 * b4 + white * 0.5329522;
          b5 = -0.7616 * b5 - white * 0.0168980;
          data[i] = b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362;
          data[i] *= 0.11; // (roughly) compensate for gain
          b6 = white * 0.115926;
      }
      return buffer;
  }

  startAmbient() {
      if (!this.ctx || !this.ambientGain) return;
      this.stopAmbient();
      
      const buffer = this.createPinkNoise();
      if (!buffer) return;

      this.ambientSource = this.ctx.createBufferSource();
      this.ambientSource.buffer = buffer;
      this.ambientSource.loop = true;
      this.ambientSource.connect(this.ambientGain);
      this.ambientSource.start();
  }

  stopAmbient() {
      if (this.ambientSource) {
          try { this.ambientSource.stop(); } catch(e) {}
          this.ambientSource.disconnect();
          this.ambientSource = null;
      }
  }

  // --- SFX HELPER ---
  playTone(freq: number, type: OscillatorType, duration: number, vol: number = 0.5, slideFreq: number | null = null, startTime: number = 0) {
    if (!this.ctx || !this.masterGain || this.isMuted) return;
    const t = startTime || this.ctx.currentTime;
    
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (slideFreq) {
      osc.frequency.exponentialRampToValueAtTime(slideFreq, t + duration);
    }

    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.01, t + duration);

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(t);
    osc.stop(t + duration);
  }

  playNoise(duration: number, vol: number = 0.5, startTime: number = 0, highPass: boolean = false) {
    if (!this.ctx || !this.masterGain || this.isMuted) return;
    const t = startTime || this.ctx.currentTime;
    
    const bufferSize = this.ctx.sampleRate * duration;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;
    const gain = this.ctx.createGain();
    
    const filter = this.ctx.createBiquadFilter();
    
    if (highPass) {
        filter.type = 'highpass';
        filter.frequency.value = 1000;
    } else {
        filter.type = 'lowpass';
        filter.frequency.value = 800; // Crunchier lowpass
    }

    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.01, t + duration);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);
    noise.start(t);
  }

  // --- ENHANCED GAME SFX ---
  
  playCombo(comboCount: number) {
    const scale = [261.63, 293.66, 329.63, 392.00, 440.00];
    const index = (comboCount - 1) % 5;
    const octave = Math.min(2, Math.floor((comboCount - 1) / 10)); 
    const freq = scale[index] * Math.pow(2, octave);

    this.playTone(freq, 'sine', 0.1, 0.1, freq * 1.5); 
    this.playTone(freq * 0.5, 'triangle', 0.1, 0.05); 
  }

  playShoot() {
    this.playTone(400 + Math.random() * 100, 'triangle', 0.08, 0.08, 100);
    this.playNoise(0.02, 0.02, 0, true); 
  }

  playDash() {
    this.playNoise(0.3, 0.2, 0, true);
    this.playTone(200, 'sine', 0.3, 0.2, 600);
  }

  playEnemyHit() {
    this.playTone(150, 'square', 0.05, 0.05, 50);
  }

  playExplosion() {
    this.playNoise(0.4, 0.5); 
    this.playTone(100, 'sawtooth', 0.2, 0.3, 10); 
  }

  playPowerUp() {
    const now = this.ctx?.currentTime || 0;
    this.playTone(440, 'sine', 0.3, 0.2, 440, now);
    this.playTone(554, 'sine', 0.3, 0.2, 554, now + 0.1); 
    this.playTone(659, 'sine', 0.6, 0.2, 880, now + 0.2); 
  }

  playBossSpawn() {
    const now = this.ctx?.currentTime || 0;
    this.playTone(80, 'sawtooth', 0.8, 0.5, 60, now);
    this.playTone(80, 'sawtooth', 0.8, 0.5, 60, now + 0.4);
    this.playTone(80, 'sawtooth', 1.2, 0.5, 40, now + 0.8);
  }

  playGameOver() {
    const now = this.ctx?.currentTime || 0;
    this.playTone(300, 'sawtooth', 0.5, 0.4, 100, now);
    this.playTone(250, 'sawtooth', 0.5, 0.4, 80, now + 0.4);
    this.playTone(200, 'sawtooth', 1.0, 0.4, 50, now + 0.8);
  }

  // --- DYNAMIC BGM ENGINE ---

  startBGM() {
    if (!this.ctx || this.isPlaying) return;
    this.isPlaying = true;
    this.nextNoteTime = this.ctx.currentTime;
    this.current16thNote = 0;
    this.measureCount = 0;
    this.scheduler();
  }

  stopBGM() {
    this.isPlaying = false;
    if (this.timerID) {
        window.clearTimeout(this.timerID);
        this.timerID = null;
    }
  }

  scheduler() {
    if (!this.ctx) return;
    // Schedule ahead notes
    while (this.nextNoteTime < this.ctx.currentTime + this.scheduleAheadTime) {
        this.scheduleNote(this.current16thNote, this.nextNoteTime);
        this.advanceNote();
    }
    if (this.isPlaying) {
        this.timerID = window.setTimeout(() => this.scheduler(), this.lookahead);
    }
  }

  advanceNote() {
    // Slower, "Chillwave" Tempos base
    let bpm = 90;
    
    // Aggressive BPM increase if low health
    if (this.playerHealthRatio < 0.3) {
        bpm += 15;
    }

    if (this.intensity === 'ACTION') bpm += 10;
    if (this.intensity === 'BOSS') bpm += 20;

    const secondsPerBeat = 60.0 / bpm;
    this.nextNoteTime += 0.25 * secondsPerBeat; // 16th notes
    this.current16thNote++;
    if (this.current16thNote === 16) {
      this.current16thNote = 0;
      this.measureCount++;
    }
  }

  scheduleNote(beatNumber: number, time: number) {
    if (this.isMuted) return;

    // Rhythm Variation based on measure
    const isFillMeasure = (this.measureCount + 1) % 8 === 0;
    const isDanger = this.playerHealthRatio < 0.3;

    // --- KICK ---
    if (beatNumber === 0 || beatNumber === 8) {
       this.playInstrumentKick(time, isDanger);
    }
    // Extra kicks in danger mode
    if (isDanger && (beatNumber === 2 || beatNumber === 10)) {
       this.playInstrumentKick(time, true);
    }
    // Double kick in boss mode
    if (this.intensity === 'BOSS' && beatNumber === 10) {
        this.playInstrumentKick(time, isDanger);
    }

    // --- HIHAT ---
    if (beatNumber % 2 === 0) {
        const accent = beatNumber % 4 === 2;
        this.playInstrumentHiHat(time, accent);
    }
    if (isDanger) {
       // 16th note hats in danger
       this.playInstrumentHiHat(time, false); 
    }

    // --- SNARE/CLAP ---
    if (beatNumber === 4 || beatNumber === 12) {
        this.playInstrumentSnare(time);
    }

    // --- SYNTH BASS ---
    // Progression: Cm -> Ab -> Bb -> Gm
    let rootFreq = 65.41; // C2
    const progressionIndex = Math.floor(this.measureCount / 2) % 4;
    
    if (progressionIndex === 1) rootFreq = 51.91; // Ab1
    if (progressionIndex === 2) rootFreq = 58.27; // Bb1
    if (progressionIndex === 3) rootFreq = 49.00; // G1

    // Rolling bassline (8th notes)
    if (beatNumber % 2 === 0) {
        let freq = rootFreq;
        if (beatNumber % 4 === 2) freq *= 2; 
        
        // Aggressive bass if low health
        this.playInstrumentBass(time, freq, 0.2, isDanger ? 'square' : 'sawtooth');
    }

    // --- ARPEGGIO LEAD ---
    if (beatNumber % 2 === 0) {
        if (this.intensity === 'ACTION' || this.intensity === 'BOSS' || beatNumber % 8 === 0 || isDanger) {
            const arpBase = rootFreq * 4; 
            const offset = (beatNumber / 2) % 4;
            const notes = [1, 1.2, 1.5, 1.2]; 
            
            // Sharper lead in danger
            const type = isDanger ? 'sawtooth' : 'triangle';
            this.playInstrumentLead(time, arpBase * notes[offset], type);
        }
    }
  }

  // --- PROCEDURAL INSTRUMENTS ---
  
  playInstrumentKick(time: number, aggressive: boolean = false) {
     if (!this.ctx || !this.bgmGain) return;
     const osc = this.ctx.createOscillator();
     const gain = this.ctx.createGain();
     
     // More punch if aggressive
     const startFreq = aggressive ? 180 : 120;
     const endFreq = 0.01;
     const dur = aggressive ? 0.3 : 0.4;

     osc.frequency.setValueAtTime(startFreq, time);
     osc.frequency.exponentialRampToValueAtTime(endFreq, time + dur);
     
     gain.gain.setValueAtTime(aggressive ? 0.9 : 0.7, time);
     gain.gain.exponentialRampToValueAtTime(0.01, time + dur);
     
     osc.connect(gain);
     gain.connect(this.bgmGain);
     osc.start(time);
     osc.stop(time + dur);
  }

  playInstrumentSnare(time: number) {
     if (!this.bgmGain) return;
     this.playNoise(0.25, 0.2, time);
  }
  
  playInstrumentHiHat(time: number, open: boolean) {
     if (!this.ctx || !this.bgmGain) return;
     const bufferSize = this.ctx.sampleRate * 0.05;
     const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
     const data = buffer.getChannelData(0);
     for(let i=0; i<bufferSize; i++) data[i] = Math.random()*2-1;
     
     const noise = this.ctx.createBufferSource();
     noise.buffer = buffer;
     
     const filter = this.ctx.createBiquadFilter();
     filter.type = 'highpass';
     filter.frequency.value = 8000;
     
     const gain = this.ctx.createGain();
     gain.gain.setValueAtTime(open ? 0.1 : 0.03, time);
     gain.gain.exponentialRampToValueAtTime(0.01, time + (open ? 0.05 : 0.02));
     
     noise.connect(filter);
     filter.connect(gain);
     gain.connect(this.bgmGain);
     noise.start(time);
  }

  playInstrumentBass(time: number, freq: number, dur: number, type: OscillatorType = 'sawtooth') {
     if (!this.ctx || !this.bgmGain) return;
     const osc = this.ctx.createOscillator();
     osc.type = type;
     osc.frequency.setValueAtTime(freq, time);
     
     const filter = this.ctx.createBiquadFilter();
     filter.type = 'lowpass';
     
     // Open filter more on aggressive types
     const filterMax = type === 'square' ? 1200 : 600;
     
     filter.frequency.setValueAtTime(100, time);
     filter.frequency.exponentialRampToValueAtTime(filterMax, time + 0.1); 
     filter.frequency.exponentialRampToValueAtTime(100, time + dur);
     
     const gain = this.ctx.createGain();
     gain.gain.setValueAtTime(0.25, time);
     gain.gain.exponentialRampToValueAtTime(0.01, time + dur);
     
     osc.connect(filter);
     filter.connect(gain);
     gain.connect(this.bgmGain);
     osc.start(time);
     osc.stop(time + dur);
  }

  playInstrumentLead(time: number, freq: number, type: OscillatorType = 'triangle') {
     if (!this.ctx || !this.bgmGain) return;
     const osc = this.ctx.createOscillator();
     osc.type = type; 
     osc.frequency.setValueAtTime(freq, time);
     
     const gain = this.ctx.createGain();
     gain.gain.setValueAtTime(0.05, time);
     gain.gain.linearRampToValueAtTime(0.0, time + 0.3);
     
     osc.connect(gain);
     gain.connect(this.bgmGain);
     osc.start(time);
     osc.stop(time + 0.3);
  }
}

export const soundManager = new SoundManager();
