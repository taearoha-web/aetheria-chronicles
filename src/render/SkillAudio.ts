/** Original synthesized spell sounds, unlocked only by the user's sound toggle. */
export class SkillAudio {
  private context: AudioContext | null = null;
  private output: DynamicsCompressorNode | null = null;
  private noise: AudioBuffer | null = null;
  private voices = new Set<AudioScheduledSourceNode>();
  private muted = true;
  setMuted(muted: boolean): void {
    this.muted = muted;
    if (muted) { this.stop(); return; }
    try {
      this.context ??= new AudioContext();
      if (!this.output) {
        this.output = this.context.createDynamicsCompressor(); this.output.threshold.value = -18; this.output.ratio.value = 5; this.output.connect(this.context.destination);
        this.noise = this.context.createBuffer(1, this.context.sampleRate, this.context.sampleRate);
        const data = this.noise.getChannelData(0); for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
      }
      void this.context.resume().catch(() => {});
    } catch { this.muted = true; }
  }
  stop(): void { for (const voice of this.voices) { try { voice.stop(); } catch {} } }
  playUi(win = false): void {
    if (!this.ready()) return;
    const now = this.context!.currentTime;
    this.tone(win ? 660 : 760, win ? 990 : 840, now, win ? .25 : .07, .025, 'sine');
    if (win) this.tone(1320, 1320, now + .1, .4, .02, 'sine');
  }
  playSkill(hero: string, slot: number, speed: number, impactDelay=.24, phase:'all'|'cast'|'impact'='all'): void {
    if (!this.ready() || this.voices.size > 24) return;
    const now = this.context!.currentTime, hit = now + Math.max(0,impactDelay) / speed, ultimate = slot === 2;
    const support = (hero === 'lyra'&&slot<2) || hero === 'lucien' || (hero==='kael'&&slot===1);
    if(phase!=='impact'){
      this.tone(support ? 660 : 240, support ? 1320 : 520, now, Math.max(.12,impactDelay*.82) / speed, .026, 'triangle');
      this.wind(now, Math.max(.12,impactDelay*.86) / speed, hero === 'seraphina' ? 650 : hero === 'elias' ? 3200 : 1400, .025);
    }
    if(phase==='cast')return;
    if (support) {
      for (const [i, note] of [880, 1108, 1320].entries()) this.tone(note, note, hit + i * .045, ultimate ? .7 : .45, .025, 'sine');
    } else {
      this.tone(hero === 'astrid' ? 115 : 160, 38, hit, ultimate ? .45 : .23, ultimate ? .07 : .045, 'sine');
      this.wind(hit, ultimate ? .5 : .23, hero === 'elias' ? 4200 : hero === 'seraphina' ? 500 : hero === 'nova' ? 1700 : 1000, ultimate ? .09 : .05);
      if (hero === 'elias') for (let i = 0; i < 3; i++) this.wind(hit + i * .045, .05, 5000, .04);
      if (hero === 'astrid') for (let i = 0; i < 3; i++) this.tone(1500 + i * 370, 1300 + i * 270, hit + i * .025, .2, .022, 'sine');
      if (ultimate) this.tone(520, 150, hit, .42, .02, 'triangle');
    }
  }
  private ready(): boolean { return !this.muted && !!this.context && this.context.state === 'running' && !!this.output; }
  private envelope(start: number, duration: number, volume: number): GainNode {
    const gain = this.context!.createGain(); gain.gain.setValueAtTime(.0001, start); gain.gain.exponentialRampToValueAtTime(volume, start + .012); gain.gain.exponentialRampToValueAtTime(.0001, start + duration); gain.connect(this.output!); return gain;
  }
  private track(source: AudioScheduledSourceNode, nodes: AudioNode[], start: number, duration: number): void {
    this.voices.add(source); source.onended = () => { this.voices.delete(source); source.disconnect(); nodes.forEach(node => node.disconnect()); }; source.start(start); source.stop(start + duration + .01);
  }
  private tone(from: number, to: number, start: number, duration: number, volume: number, type: OscillatorType): void {
    const source = this.context!.createOscillator(), gain = this.envelope(start, duration, volume); source.type = type; source.frequency.setValueAtTime(from, start); source.frequency.exponentialRampToValueAtTime(to, start + duration); source.connect(gain); this.track(source, [gain], start, duration);
  }
  private wind(start: number, duration: number, frequency: number, volume: number): void {
    const source = this.context!.createBufferSource(), filter = this.context!.createBiquadFilter(), gain = this.envelope(start, duration, volume);
    source.buffer = this.noise; filter.type = 'bandpass'; filter.Q.value = .7; filter.frequency.setValueAtTime(frequency, start); filter.frequency.exponentialRampToValueAtTime(Math.max(150, frequency * .3), start + duration); source.connect(filter).connect(gain); this.track(source, [filter, gain], start, duration);
  }
}
