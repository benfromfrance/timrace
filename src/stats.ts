import type { GameMode } from './match';
import type { BossId } from './monsters';

/** Résumé d'une partie terminée (les parties abandonnées ne sont pas enregistrées). */
export interface GameRecord {
  mode: GameMode;
  outcome: 'win' | 'lose';
  /** Gagnant du duel ; null en coopération et en solo. */
  winnerIndex: number | null;
  characters: string[];
  arena: string;
  /** Boss rencontré (coopération / solo), s'il a été atteint. */
  bossId: BossId | null;
  bossDefeated: boolean;
  bossFightMs: number | null;
  durationMs: number;
  stars: number;
  monstersKilled: number;
}

interface Counter {
  played: number;
  won: number;
}

interface BossStats {
  met: number;
  defeated: number;
  /** Combat le plus rapide, de l'apparition à la victoire. */
  bestMs: number | null;
}

interface StatsData {
  games: number;
  playTimeMs: number;
  stars: number;
  monstersKilled: number;
  modes: Record<GameMode, Counter>;
  bosses: Partial<Record<BossId, BossStats>>;
  characters: Record<string, Counter>;
  arenas: Record<string, Counter>;
}

const SAVE_KEY = 'timcar.stats';

const empty = (): StatsData => ({
  games: 0,
  playTimeMs: 0,
  stars: 0,
  monstersKilled: 0,
  modes: { versus: { played: 0, won: 0 }, coop: { played: 0, won: 0 }, solo: { played: 0, won: 0 } },
  bosses: {},
  characters: {},
  arenas: {},
});

/** Statistiques de toutes les parties, sauvegardées dans le navigateur (localStorage). */
class StatsStore {
  private data = empty();

  constructor() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (raw) {
        const saved = JSON.parse(raw) as Partial<StatsData>;
        this.data = { ...empty(), ...saved, modes: { ...empty().modes, ...saved.modes } };
      }
    } catch {
      /* stockage indisponible ou corrompu : statistiques vierges */
    }
  }

  get summary(): Readonly<StatsData> {
    return this.data;
  }

  /** Victoires toutes catégories : duels terminés et missions réussies. */
  get wins(): number {
    const m = this.data.modes;
    return m.versus.played + m.coop.won + m.solo.won;
  }

  get bossesDefeated(): number {
    return Object.values(this.data.bosses).reduce((sum, b) => sum + (b?.defeated ?? 0), 0);
  }

  record(r: GameRecord) {
    const d = this.data;
    const won = r.outcome === 'win';
    d.games++;
    d.playTimeMs += r.durationMs;
    d.stars += r.stars;
    d.monstersKilled += r.monstersKilled;

    d.modes[r.mode].played++;
    if (won && r.mode !== 'versus') d.modes[r.mode].won++;

    r.characters.forEach((id, i) => {
      const c = (d.characters[id] ??= { played: 0, won: 0 });
      c.played++;
      // En duel, seul le personnage du gagnant gagne ; en équipe, tout le monde gagne ensemble
      if (won && (r.mode !== 'versus' || r.winnerIndex === i)) c.won++;
    });

    const arena = (d.arenas[r.arena] ??= { played: 0, won: 0 });
    arena.played++;
    if (won && r.mode !== 'versus') arena.won++;

    if (r.bossId) {
      const b = (d.bosses[r.bossId] ??= { met: 0, defeated: 0, bestMs: null });
      b.met++;
      if (r.bossDefeated) {
        b.defeated++;
        if (r.bossFightMs !== null && (b.bestMs === null || r.bossFightMs < b.bestMs)) b.bestMs = r.bossFightMs;
      }
    }

    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(d));
    } catch {
      /* ignoré */
    }
  }
}

export const Stats = new StatsStore();

/** 75 000 → « 1:15 » */
export function formatDuration(ms: number): string {
  const s = Math.round(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = String(s % 60).padStart(2, '0');
  return h > 0 ? `${h} h ${String(m).padStart(2, '0')}` : `${m}:${sec}`;
}
