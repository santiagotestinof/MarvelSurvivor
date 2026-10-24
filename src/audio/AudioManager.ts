/**
 * Música y efectos de sonido, generados con Web Audio (no hay archivos de audio ni material de terceros).
 * - Música: un secuenciador chico con bajo, arpegio, melodía y batería. Hay dos temas: `menu` (tranquilo) y `game` (acción).
 * - Efecto de golpe recibido: `playHit`.
 * - Volúmenes: `masterVolume` (todo el sonido) y `musicVolume` (solo la música), de 0 a 1; se guardan en el navegador y se cambian desde `SoundPanel`.
 * Los navegadores no dejan sonar nada hasta que el jugador toca o aprieta algo, así que el audio arranca en la primera interacción.
 */
export type Track = 'menu' | 'game';

const VOLUME_KEY = 'marvel-survivors-volume';
const MUSIC_VOLUME = 0.22;
const SFX_VOLUME = 0.5;

const midi = (n: number): number => 440 * Math.pow(2, (n - 69) / 12);

/** Acordes de 4 compases en La menor: Am – F – C – G (raíz grave, tres notas para el arpegio). */
const PROGRESSION = [
  { root: 33, notes: [57, 60, 64] },
  { root: 29, notes: [57, 60, 65] },
  { root: 36, notes: [55, 60, 64] },
  { root: 31, notes: [55, 59, 62] },
];

/** Melodía del tema de acción: 16 pasos por compás (0 = silencio), grados en la escala de La menor pentatónica. */
const LEAD: number[][] = [
  [69, 0, 0, 72, 0, 0, 76, 0, 74, 0, 0, 72, 0, 0, 0, 0],
  [72, 0, 0, 69, 0, 0, 72, 0, 77, 0, 0, 76, 0, 0, 72, 0],
  [76, 0, 0, 79, 0, 0, 76, 0, 72, 0, 0, 76, 0, 0, 0, 0],
  [74, 0, 0, 71, 0, 0, 74, 0, 79, 0, 76, 74, 0, 0, 71, 0],
];

interface Settings {
  bpm: number;
  drums: boolean;
  lead: boolean;
  gain: number;
}
const TRACKS: Record<Track, Settings> = {
  game: { bpm: 138, drums: true, lead: true, gain: 1 },
  menu: { bpm: 84, drums: false, lead: false, gain: 0.8 },
};

class AudioManager {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private musicBus: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  private track: Track | null = null;
  private wanted: Track | null = null;
  private timer: number | null = null;
  private step = 0;
  private nextTime = 0;
  private master01 = 1;
  private music01 = 1;
  private lastHitAt = 0;

  constructor() {
    try {
      const saved = JSON.parse(window.localStorage.getItem(VOLUME_KEY) ?? 'null') as { master?: number; music?: number } | null;
      if (saved && typeof saved.master === 'number') this.master01 = Math.min(1, Math.max(0, saved.master));
      if (saved && typeof saved.music === 'number') this.music01 = Math.min(1, Math.max(0, saved.music));
    } catch {
      /* sin guardado: volúmenes por defecto */
    }
    const unlock = (): void => this.unlock();
    window.addEventListener('pointerdown', unlock);
    window.addEventListener('keydown', unlock);
  }

  get masterVolume(): number {
    return this.master01;
  }

  get musicVolume(): number {
    return this.music01;
  }

  setMasterVolume(value: number): void {
    this.master01 = Math.min(1, Math.max(0, value));
    this.applyVolumes();
    this.save();
  }

  setMusicVolume(value: number): void {
    this.music01 = Math.min(1, Math.max(0, value));
    this.applyVolumes();
    this.save();
  }

  /** Elige el tema que tiene que sonar (si ya suena, no hace nada). */
  play(track: Track): void {
    this.wanted = track;
    if (this.ctx && this.ctx.state === 'running') this.start(track);
  }

  private save(): void {
    try {
      window.localStorage.setItem(VOLUME_KEY, JSON.stringify({ master: this.master01, music: this.music01 }));
    } catch {
      /* sin guardado, no pasa nada */
    }
  }

  private applyVolumes(): void {
    if (!this.ctx || !this.master || !this.musicBus) return;
    this.master.gain.setTargetAtTime(this.master01, this.ctx.currentTime, 0.02);
    this.musicBus.gain.setTargetAtTime(MUSIC_VOLUME * this.music01, this.ctx.currentTime, 0.02);
  }

  /** "Te pegaron": un golpe seco (grave) con un chasquido. `strength` va de 0 a 1. */
  playHit(strength = 0.6): void {
    const ctx = this.ctx;
    if (!ctx || !this.master || ctx.state !== 'running' || this.master01 <= 0) return;
    const t = ctx.currentTime;
    if (t - this.lastHitAt < 0.07) return; // varios golpes juntos no se vuelven un ruido continuo
    this.lastHitAt = t;
    const vol = SFX_VOLUME * (0.55 + 0.45 * Math.min(1, strength));
    const detune = 0.92 + Math.random() * 0.16;

    const thump = ctx.createOscillator();
    const thumpGain = ctx.createGain();
    thump.type = 'sine';
    thump.frequency.setValueAtTime(190 * detune, t);
    thump.frequency.exponentialRampToValueAtTime(48, t + 0.14);
    thumpGain.gain.setValueAtTime(vol, t);
    thumpGain.gain.exponentialRampToValueAtTime(0.001, t + 0.16);
    thump.connect(thumpGain).connect(this.master);
    thump.start(t);
    thump.stop(t + 0.18);

    if (this.noise) {
      const hit = ctx.createBufferSource();
      const filter = ctx.createBiquadFilter();
      const hitGain = ctx.createGain();
      hit.buffer = this.noise;
      filter.type = 'bandpass';
      filter.frequency.value = 1400 * detune;
      filter.Q.value = 0.9;
      hitGain.gain.setValueAtTime(vol * 0.9, t);
      hitGain.gain.exponentialRampToValueAtTime(0.001, t + 0.09);
      hit.connect(filter).connect(hitGain).connect(this.master);
      hit.start(t);
      hit.stop(t + 0.1);
    }
  }

  private unlock(): void {
    if (!this.ctx) {
      const Ctor: typeof AudioContext | undefined =
        window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return;
      this.ctx = new Ctor();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.master01;
      this.master.connect(this.ctx.destination);
      this.musicBus = this.ctx.createGain();
      this.musicBus.gain.value = MUSIC_VOLUME * this.music01;
      this.musicBus.connect(this.master);
      const length = Math.floor(this.ctx.sampleRate * 0.25);
      this.noise = this.ctx.createBuffer(1, length, this.ctx.sampleRate);
      const data = this.noise.getChannelData(0);
      for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
    }
    void this.ctx.resume().then(() => {
      if (this.wanted) this.start(this.wanted);
    });
  }

  private start(track: Track): void {
    if (this.track === track && this.timer !== null) return;
    this.track = track;
    this.step = 0;
    this.nextTime = (this.ctx?.currentTime ?? 0) + 0.08;
    if (this.timer === null) this.timer = window.setInterval(() => this.schedule(), 30);
  }

  /** Programa las notas de los próximos ~150 ms. */
  private schedule(): void {
    const ctx = this.ctx;
    if (!ctx || !this.track || ctx.state !== 'running') return;
    const settings = TRACKS[this.track];
    const stepLen = 60 / settings.bpm / 4;
    while (this.nextTime < ctx.currentTime + 0.15) {
      this.playStep(this.step, this.nextTime, stepLen, settings);
      this.nextTime += stepLen;
      this.step = (this.step + 1) % 64;
    }
  }

  private playStep(step: number, t: number, len: number, s: Settings): void {
    const bar = Math.floor(step / 16) % 4;
    const pos = step % 16;
    const chord = PROGRESSION[bar];

    // Bajo: corcheas sobre la raíz (en el menú, una nota larga por compás).
    if (s.drums ? pos % 2 === 0 : pos === 0) {
      this.tone('triangle', midi(chord.root + (pos % 8 === 6 ? 12 : 0)), t, len * (s.drums ? 1.8 : 14), 0.5 * s.gain);
    }
    // Arpegio: sube y baja por las tres notas del acorde.
    const arp = chord.notes[[0, 1, 2, 1][pos % 4]] + (s.drums ? 12 : 0);
    this.tone('square', midi(arp), t, len * 0.9, (s.drums ? 0.12 : 0.1) * s.gain, 0.003);
    // Melodía (solo en el tema de acción).
    if (s.lead) {
      const note = LEAD[bar][pos];
      if (note) this.tone('square', midi(note), t, len * 2.6, 0.17 * s.gain, 0.004, 0.4);
    }
    // Batería.
    if (s.drums) {
      if (pos % 4 === 0) this.kick(t, 0.9);
      if (pos === 4 || pos === 12) this.snare(t, 0.35);
      if (pos % 2 === 0) this.hat(t, pos % 4 === 2 ? 0.16 : 0.09);
    }
  }

  private tone(type: OscillatorType, freq: number, t: number, dur: number, vol: number, attack = 0.005, vibrato = 0): void {
    const ctx = this.ctx;
    if (!ctx || !this.musicBus) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    if (vibrato) {
      osc.detune.setValueAtTime(0, t);
      osc.detune.linearRampToValueAtTime(vibrato * 25, t + dur);
    }
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.linearRampToValueAtTime(vol, t + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(gain).connect(this.musicBus);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  private kick(t: number, vol: number): void {
    const ctx = this.ctx;
    if (!ctx || !this.musicBus) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.setValueAtTime(140, t);
    osc.frequency.exponentialRampToValueAtTime(40, t + 0.12);
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.16);
    osc.connect(gain).connect(this.musicBus);
    osc.start(t);
    osc.stop(t + 0.18);
  }

  private noiseBurst(t: number, dur: number, vol: number, filterType: BiquadFilterType, freq: number): void {
    const ctx = this.ctx;
    if (!ctx || !this.musicBus || !this.noise) return;
    const src = ctx.createBufferSource();
    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();
    src.buffer = this.noise;
    filter.type = filterType;
    filter.frequency.value = freq;
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(filter).connect(gain).connect(this.musicBus);
    src.start(t);
    src.stop(t + dur + 0.02);
  }

  private snare(t: number, vol: number): void {
    this.noiseBurst(t, 0.13, vol, 'highpass', 1800);
  }

  private hat(t: number, vol: number): void {
    this.noiseBurst(t, 0.04, vol, 'highpass', 7000);
  }
}

export const audio = new AudioManager();
