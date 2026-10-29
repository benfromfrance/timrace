import { Sound } from './audio/Sound';

export type ChallengeId =
  | 'first-win'
  | 'hunter'
  | 'regicide'
  | 'untouchable'
  | 'chain-reaction'
  | 'thief'
  | 'collector'
  | 'lone-hero';

export interface ChallengeDef {
  id: ChallengeId;
  name: string;
  description: string;
  /** Contenu débloqué par ce défi (sinon : simple trophée). */
  reward?: { type: 'character' | 'arena'; id: string; label: string };
  /** Défi cumulé sur plusieurs parties. */
  goal?: { stat: StatId; target: number };
}

export type StatId = 'monstersKilled';

export const CHALLENGES: ChallengeDef[] = [
  { id: 'first-win', name: 'Première victoire', description: 'Gagner un duel.', reward: { type: 'character', id: 'pyro', label: 'Pyro 🔥' } },
  {
    id: 'hunter',
    name: 'Chasseur de monstres',
    description: 'Tuer 50 monstres (toutes parties confondues).',
    reward: { type: 'character', id: 'ombre', label: 'Ombre 👻' },
    goal: { stat: 'monstersKilled', target: 50 },
  },
  { id: 'regicide', name: 'Régicide', description: 'Vaincre un boss final (coopération ou solo).', reward: { type: 'arena', id: 'volcan', label: 'Arène Volcan 🌋' } },
  { id: 'untouchable', name: 'Intouchable', description: 'Vaincre le boss sans perdre de cœur pendant le combat.' },
  { id: 'chain-reaction', name: 'Réaction en chaîne', description: 'Tuer 3 monstres avec une seule explosion.' },
  { id: 'thief', name: 'Pie voleuse', description: 'Ramasser 5 étoiles tombées au sol en une partie.' },
  { id: 'collector', name: 'Collectionneur', description: "Ramasser 5 caisses d'armes en une partie." },
  { id: 'lone-hero', name: 'Héros solitaire', description: 'Accomplir la mission en solo.' },
];

const SAVE_KEY = 'timcar.progress';

interface SaveData {
  done: ChallengeId[];
  stats: Record<StatId, number>;
}

/** Progression des défis, sauvegardée dans le navigateur (localStorage). */
class ProgressStore {
  private data: SaveData = { done: [], stats: { monstersKilled: 0 } };

  constructor() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (raw) this.data = { ...this.data, ...JSON.parse(raw) };
    } catch {
      /* stockage indisponible ou corrompu : progression vierge */
    }
  }

  isDone(id: ChallengeId): boolean {
    return this.data.done.includes(id);
  }

  get doneCount(): number {
    return this.data.done.length;
  }

  stat(id: StatId): number {
    return this.data.stats[id] ?? 0;
  }

  /** Marque un défi réussi ; renvoie sa définition s'il vient d'être accompli (null sinon). */
  complete(id: ChallengeId): ChallengeDef | null {
    if (this.isDone(id)) return null;
    this.data.done.push(id);
    this.save();
    Sound.sfx('achievement');
    return CHALLENGES.find((c) => c.id === id) ?? null;
  }

  /** Ajoute à une statistique cumulée ; renvoie les défis accomplis grâce à elle. */
  addStat(id: StatId, amount = 1): ChallengeDef[] {
    this.data.stats[id] = this.stat(id) + amount;
    this.save();
    return CHALLENGES.filter((c) => c.goal?.stat === id && this.stat(id) >= c.goal.target)
      .map((c) => this.complete(c.id))
      .filter((c) => c !== null);
  }

  isUnlocked(type: 'character' | 'arena', id: string): boolean {
    const challenge = this.lockFor(type, id);
    return !challenge || this.isDone(challenge.id);
  }

  /** Le défi qui débloque ce contenu, s'il y en a un. */
  lockFor(type: 'character' | 'arena', id: string): ChallengeDef | undefined {
    return CHALLENGES.find((c) => c.reward?.type === type && c.reward.id === id);
  }

  private save() {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(this.data));
    } catch {
      /* ignoré */
    }
  }
}

export const Progress = new ProgressStore();
