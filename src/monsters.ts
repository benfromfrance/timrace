export type BossId = 'boss-gloubi' | 'boss-givre' | 'boss-golem' | 'boss-spectre';
export type MonsterTypeId = 'gloubi' | 'fusee' | 'cracheur' | 'bombe' | 'spectre' | 'mitose' | 'mini' | BossId;

export interface MonsterDef {
  id: MonsterTypeId;
  name: string;
  /** Pouvoir, affiché dans le README et à l'arrivée du boss. */
  power: string;
  texture: string;
  hp: number;
  speed: number;
  /** Rayon de la hitbox. */
  radius: number;
  /** Traverse les murs. */
  passWalls?: boolean;
  /** Temps de partie avant de pouvoir apparaître. */
  unlockAtMs: number;
  /** Poids dans le tirage aléatoire ; 0 = jamais en apparition normale (invoqué seulement). */
  weight: number;
  /** Boss final : emoji de son titre et description de ses 3 phases. */
  boss?: { emoji: string; phases: [string, string, string] };
}

export const MONSTERS: Record<MonsterTypeId, MonsterDef> = {
  gloubi: { id: 'gloubi', name: 'Gloubi', power: 'Poursuit sans relâche', texture: 'monster-gloubi', hp: 3, speed: 130, radius: 20, unlockAtMs: 0, weight: 4 },
  fusee: { id: 'fusee', name: 'Fusée', power: 'Charge : fonce en ligne droite', texture: 'monster-fusee', hp: 1, speed: 100, radius: 15, unlockAtMs: 0, weight: 3 },
  cracheur: { id: 'cracheur', name: 'Cracheur', power: 'Crachat gluant qui ralentit', texture: 'monster-cracheur', hp: 2, speed: 110, radius: 21, unlockAtMs: 20000, weight: 3 },
  bombe: { id: 'bombe', name: 'Bombe', power: 'Kaboum : explose près des joueurs', texture: 'monster-bombe', hp: 1, speed: 150, radius: 18, unlockAtMs: 20000, weight: 2 },
  spectre: { id: 'spectre', name: 'Spectre', power: 'Traverse les murs et réapparaît près de sa cible', texture: 'monster-spectre', hp: 2, speed: 115, radius: 20, passWalls: true, unlockAtMs: 40000, weight: 2 },
  mitose: { id: 'mitose', name: 'Mitose', power: 'Se divise en deux en mourant', texture: 'monster-mitose', hp: 5, speed: 75, radius: 28, unlockAtMs: 40000, weight: 2 },
  mini: { id: 'mini', name: 'Mini-Mitose', power: 'Petit et rapide', texture: 'monster-mini', hp: 1, speed: 175, radius: 13, unlockAtMs: 0, weight: 0 },
  'boss-gloubi': {
    id: 'boss-gloubi',
    name: 'Roi Gloubi',
    power: 'Anneaux de projectiles, invocations, puis charge enragée',
    texture: 'boss-gloubi',
    hp: 60,
    speed: 70,
    radius: 62,
    passWalls: true,
    unlockAtMs: Infinity,
    weight: 0,
    boss: { emoji: '👑', phases: ['Anneaux de projectiles', '+ invoque des Fusées', 'Enragé : charges furieuses'] },
  },
  'boss-givre': {
    id: 'boss-givre',
    name: 'Reine Givre',
    power: 'Blizzard en spirale, sol gelé, téléportation',
    texture: 'boss-givre',
    hp: 55,
    speed: 80,
    radius: 60,
    passWalls: true,
    unlockAtMs: Infinity,
    weight: 0,
    boss: { emoji: '❄️', phases: ['Blizzard en spirale', '+ plaques de givre qui ralentissent', 'Enragée : se téléporte, triple spirale'] },
  },
  'boss-golem': {
    id: 'boss-golem',
    name: 'Golem de Lave',
    power: 'Rochers, séismes, pluie de météores',
    texture: 'boss-golem',
    hp: 80,
    speed: 50,
    radius: 64,
    passWalls: true,
    unlockAtMs: Infinity,
    weight: 0,
    boss: { emoji: '🌋', phases: ['Lance des rochers', '+ séisme autour de lui', 'Enragé : pluie de météores'] },
  },
  'boss-spectre': {
    id: 'boss-spectre',
    name: 'Spectre Ancien',
    power: 'Tirs en croix, apparitions, invocation de spectres',
    texture: 'boss-spectre',
    hp: 50,
    speed: 90,
    radius: 58,
    passWalls: true,
    unlockAtMs: Infinity,
    weight: 0,
    boss: { emoji: '👻', phases: ['Tirs en croix tournants', '+ invoque des Spectres', 'Enragé : apparitions éclair'] },
  },
};

/** Tirage pondéré parmi les monstres débloqués après `elapsedMs` de partie. */
export function pickMonsterType(elapsedMs: number): MonsterDef {
  const pool = Object.values(MONSTERS).filter((m) => m.weight > 0 && m.unlockAtMs <= elapsedMs);
  let roll = Math.random() * pool.reduce((sum, m) => sum + m.weight, 0);
  for (const m of pool) {
    roll -= m.weight;
    if (roll <= 0) return m;
  }
  return pool[0];
}

/** Boss finaux possibles, tirés au hasard à chaque combat. */
export const BOSSES: MonsterDef[] = Object.values(MONSTERS).filter((m) => m.boss);
