/**
 * Sons et musiques synthétisés avec la Web Audio API : aucun fichier audio.
 *
 * Les navigateurs n'autorisent le son qu'après un clic ou une touche du clavier
 * (les boutons de manette ne comptent pas) : on reprend le contexte audio à ce moment-là.
 */

export type SfxName =
  | 'shoot' | 'bullet' | 'shotgun' | 'fireball' | 'boomerang' | 'mine' | 'homing'
  | 'swing' | 'hit' | 'star' | 'hurt' | 'monsterDie' | 'explosion' | 'dash' | 'power'
  | 'crate' | 'heart' | 'enemyShot' | 'bossRoar'
  | 'uiMove' | 'uiConfirm' | 'uiBack' | 'uiError'
  | 'victory' | 'defeat' | 'achievement';

export type MusicName = 'menu' | 'battle' | 'boss';

interface ToneOpts {
  freq: number;
  to?: number; // glissando vers cette fréquence
  type?: OscillatorType;
  dur: number;
  vol: number;
  at?: number; // décalage en secondes
}

interface NoiseOpts {
  dur: number;
  vol: number;
  filter?: BiquadFilterType;
  cutoff?: number;
  at?: number;
}

interface Theme {
  bpm: number;
  /** Accord par mesure : note MIDI de la fondamentale et mineur ou non. */
  chords: [root: number, minor: boolean][];
  /** Mélodie : index dans les notes de l'accord (0..5) par double-croche, -1 = silence. */
  lead: number[];
  leadWave: OscillatorType;
  /** Basse : 1 = fondamentale, 2 = octave, 0 = silence. */
  bass: number[];
  /** Batterie : k = grosse caisse, s = caisse claire, h = charleston, . = rien. */
  drums: string;
}

const THEMES: Record<MusicName, Theme> = {
  menu: {
    bpm: 100,
    chords: [[48, false], [45, true], [41, false], [43, false]],
    lead: [0, -1, 2, -1, 4, -1, 2, -1, 3, -1, 2, -1, 1, -1, 2, -1],
    leadWave: 'triangle',
    bass: [1, 0, 0, 0, 2, 0, 0, 0, 1, 0, 0, 0, 2, 0, 1, 0],
    drums: 'k.......s.......',
  },
  battle: {
    bpm: 138,
    chords: [[45, true], [41, false], [48, false], [43, false]],
    lead: [0, 2, 4, 2, 5, 4, 2, 1, 0, 2, 4, 5, 4, 2, 3, 2],
    leadWave: 'square',
    bass: [1, 0, 2, 0, 1, 0, 2, 0, 1, 0, 2, 0, 1, 1, 2, 0],
    drums: 'k.h.s.h.k.h.s.hh',
  },
  boss: {
    bpm: 160,
    chords: [[50, true], [50, true], [46, false], [45, false]],
    lead: [0, 1, 0, 2, 0, 3, 0, 2, 5, 4, 3, 2, 1, 2, 1, 0],
    leadWave: 'sawtooth',
    bass: [1, 1, 2, 1, 1, 1, 2, 1, 1, 1, 2, 1, 1, 2, 1, 2],
    drums: 'k.hsk.hsk.hsk.ss',
  },
};

const midiToFreq = (m: number) => 440 * 2 ** ((m - 69) / 12);
const MUTE_KEY = 'timcar.muted';

class SoundEngine {
  private ctx: AudioContext | null = null;
  private sfxBus!: GainNode;
  private musicBus!: GainNode;
  private master!: GainNode;
  private noiseBuffer!: AudioBuffer;
  private muted = false;
  private lastPlayed = new Map<SfxName, number>();
  private music: { name: MusicName; step: number; nextTime: number } | null = null;

  constructor() {
    try {
      this.muted = localStorage.getItem(MUTE_KEY) === '1';
    } catch {
      /* stockage indisponible : son actif par défaut */
    }
    const unlock = () => void this.ensure()?.resume().catch(() => {});
    window.addEventListener('pointerdown', unlock);
    window.addEventListener('keydown', (e) => {
      unlock();
      if (e.code === 'KeyM') this.toggleMute();
    });
    window.setInterval(() => this.scheduleMusic(), 25);
  }

  /** Le son est-il réellement audible (contexte démarré) ? */
  get unlocked(): boolean {
    return this.ctx?.state === 'running';
  }

  get isMuted(): boolean {
    return this.muted;
  }

  toggleMute() {
    this.muted = !this.muted;
    try {
      localStorage.setItem(MUTE_KEY, this.muted ? '1' : '0');
    } catch {
      /* ignoré */
    }
    if (this.ctx) this.master.gain.value = this.muted ? 0 : 0.7;
  }

  private ensure(): AudioContext | null {
    if (this.ctx) return this.ctx;
    try {
      const ctx = new AudioContext();
      this.master = ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 0.7;
      this.master.connect(ctx.destination);
      this.sfxBus = ctx.createGain();
      this.sfxBus.gain.value = 0.8;
      this.sfxBus.connect(this.master);
      this.musicBus = ctx.createGain();
      this.musicBus.gain.value = 0.3;
      this.musicBus.connect(this.master);
      this.noiseBuffer = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      const data = this.noiseBuffer.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
      this.ctx = ctx;
    } catch {
      return null; // Web Audio indisponible : jeu muet
    }
    return this.ctx;
  }

  // ─── Synthèse ────────────────────────────────────────────────────────

  private tone(o: ToneOpts, bus = this.sfxBus, base?: number) {
    const ctx = this.ctx!;
    const t = (base ?? ctx.currentTime) + (o.at ?? 0);
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = o.type ?? 'square';
    osc.frequency.setValueAtTime(o.freq, t);
    if (o.to) osc.frequency.exponentialRampToValueAtTime(Math.max(1, o.to), t + o.dur);
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(o.vol, t + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + o.dur);
    osc.connect(gain).connect(bus);
    osc.start(t);
    osc.stop(t + o.dur + 0.02);
  }

  private noise(o: NoiseOpts, bus = this.sfxBus, base?: number) {
    const ctx = this.ctx!;
    const t = (base ?? ctx.currentTime) + (o.at ?? 0);
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    const filter = ctx.createBiquadFilter();
    filter.type = o.filter ?? 'lowpass';
    filter.frequency.value = o.cutoff ?? 2000;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(o.vol, t);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + o.dur);
    src.connect(filter).connect(gain).connect(bus);
    src.start(t, Math.random() * 0.5);
    src.stop(t + o.dur + 0.02);
  }

  private notes(freqs: number[], step: number, type: OscillatorType, vol: number, dur = step * 1.5) {
    freqs.forEach((freq, i) => this.tone({ freq, type, vol, dur, at: i * step }));
  }

  // ─── Effets ──────────────────────────────────────────────────────────

  sfx(name: SfxName) {
    if (!this.ensure() || this.ctx!.state !== 'running' || this.muted) return;
    // Évite l'empilement d'un même son déclenché plusieurs fois dans la même frame (anneaux du boss…)
    const now = performance.now();
    if (now - (this.lastPlayed.get(name) ?? 0) < 35) return;
    this.lastPlayed.set(name, now);

    switch (name) {
      case 'shoot': return this.tone({ freq: 660, to: 220, dur: 0.15, vol: 0.12 });
      case 'bullet': return this.tone({ freq: 950, to: 500, dur: 0.05, vol: 0.05 });
      case 'shotgun':
        this.noise({ dur: 0.2, vol: 0.4, cutoff: 1800 });
        return this.tone({ freq: 200, to: 70, dur: 0.15, vol: 0.2 });
      case 'fireball':
        this.noise({ dur: 0.3, vol: 0.3, cutoff: 900 });
        return this.tone({ freq: 300, to: 90, type: 'sawtooth', dur: 0.3, vol: 0.12 });
      case 'boomerang': return this.tone({ freq: 500, to: 950, type: 'triangle', dur: 0.22, vol: 0.12 });
      case 'mine': return this.notes([300, 450], 0.07, 'square', 0.08, 0.05);
      case 'homing': return this.tone({ freq: 400, to: 800, type: 'sawtooth', dur: 0.2, vol: 0.08 });
      case 'swing': return this.noise({ dur: 0.12, vol: 0.25, filter: 'bandpass', cutoff: 3000 });
      case 'hit':
        this.noise({ dur: 0.08, vol: 0.3, cutoff: 3000 });
        return this.tone({ freq: 220, to: 110, dur: 0.1, vol: 0.18 });
      case 'star': return this.notes([880, 1108, 1318], 0.06, 'triangle', 0.15);
      case 'hurt': return this.tone({ freq: 420, to: 90, type: 'sawtooth', dur: 0.3, vol: 0.18 });
      case 'monsterDie':
        this.noise({ dur: 0.1, vol: 0.15, cutoff: 2500 });
        return this.tone({ freq: 600, to: 80, dur: 0.22, vol: 0.12 });
      case 'explosion':
        this.noise({ dur: 0.7, vol: 0.6, cutoff: 700 });
        return this.tone({ freq: 120, to: 35, type: 'sine', dur: 0.6, vol: 0.45 });
      case 'dash': return this.noise({ dur: 0.14, vol: 0.18, filter: 'highpass', cutoff: 1500 });
      case 'power':
        this.tone({ freq: 400, to: 1200, type: 'sine', dur: 0.3, vol: 0.15 });
        return this.tone({ freq: 600, to: 1800, type: 'triangle', dur: 0.3, vol: 0.08 });
      case 'crate': return this.notes([523, 659, 784], 0.05, 'square', 0.08);
      case 'heart': return this.notes([659, 880, 1046], 0.08, 'triangle', 0.15);
      case 'enemyShot': return this.tone({ freq: 320, to: 180, type: 'sine', dur: 0.15, vol: 0.1 });
      case 'bossRoar':
        this.noise({ dur: 1.2, vol: 0.35, cutoff: 400 });
        return this.tone({ freq: 95, to: 45, type: 'sawtooth', dur: 1.2, vol: 0.35 });
      case 'uiMove': return this.tone({ freq: 700, dur: 0.04, vol: 0.06 });
      case 'uiConfirm': return this.notes([660, 990], 0.06, 'square', 0.09);
      case 'uiBack': return this.tone({ freq: 500, to: 300, dur: 0.08, vol: 0.08 });
      case 'uiError': return this.notes([200, 160], 0.08, 'square', 0.1);
      case 'victory': return this.notes([523, 659, 784, 1046, 784, 1046], 0.13, 'square', 0.12, 0.25);
      case 'defeat': return this.notes([392, 330, 262, 196], 0.25, 'triangle', 0.15, 0.4);
      case 'achievement': return this.notes([784, 988, 1175, 1568], 0.07, 'triangle', 0.15);
    }
  }

  // ─── Musique ─────────────────────────────────────────────────────────

  /** Lance une musique en boucle (ne fait rien si c'est déjà celle-ci) ; null = silence. */
  playMusic(name: MusicName | null) {
    if (this.music?.name === name) return;
    this.music = name ? { name, step: 0, nextTime: 0 } : null;
  }

  /** Programme les notes un peu à l'avance pour un tempo stable (planificateur « lookahead »). */
  private scheduleMusic() {
    const ctx = this.ctx;
    if (!ctx || ctx.state !== 'running' || !this.music) return;
    const m = this.music;
    const theme = THEMES[m.name];
    const stepDur = 60 / theme.bpm / 4;
    if (m.nextTime < ctx.currentTime - 0.2) m.nextTime = ctx.currentTime + 0.05; // reprise après pause
    while (m.nextTime < ctx.currentTime + 0.12) {
      const i = m.step % 16;
      const [root, minor] = theme.chords[Math.floor(m.step / 16) % theme.chords.length];
      const third = minor ? 3 : 4;
      const chord = [0, third, 7, 12, 12 + third, 19].map((n) => root + 12 + n);
      const t = m.nextTime;

      const lead = theme.lead[i];
      if (lead >= 0) this.tone({ freq: midiToFreq(chord[lead] + 12), type: theme.leadWave, dur: stepDur * 0.9, vol: 0.07 }, this.musicBus, t);
      const bass = theme.bass[i];
      if (bass) this.tone({ freq: midiToFreq(root - 12 + (bass === 2 ? 12 : 0)), type: 'triangle', dur: stepDur * 1.6, vol: 0.22 }, this.musicBus, t);
      switch (theme.drums[i]) {
        case 'k':
          this.tone({ freq: 150, to: 40, type: 'sine', dur: 0.15, vol: 0.5 }, this.musicBus, t);
          break;
        case 's':
          this.noise({ dur: 0.12, vol: 0.25, filter: 'highpass', cutoff: 1500 }, this.musicBus, t);
          break;
        case 'h':
          this.noise({ dur: 0.03, vol: 0.08, filter: 'highpass', cutoff: 7000 }, this.musicBus, t);
          break;
      }
      m.step++;
      m.nextTime += stepDur;
    }
  }
}

export const Sound = new SoundEngine();
