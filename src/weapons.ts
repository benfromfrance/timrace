import type { SfxName } from './audio/Sound';

export interface WeaponDef {
  id: string;
  label: string;
  /** Emoji affiché sur la caisse. */
  icon: string;
  sound: SfxName;
  /** Délai minimum entre deux tirs. */
  cooldownMs: number;
  /** true : tir en continu tant que le bouton est maintenu. */
  auto: boolean;
  texture: string;
  projectileSpeed: number;
  projectileLifetimeMs: number;
  /** Dispersion aléatoire (radians) de chaque tir. */
  spread: number;
  /** Durée du ralentissement infligé à l'impact. */
  slowMs: number;
  /** Dégâts infligés aux monstres (ils ont 3 PV). */
  damage: number;
  /** Plusieurs projectiles par tir, répartis en éventail sur `fan` radians. */
  pellets?: number;
  fan?: number;
  /** Comportement spécial du projectile. */
  behavior?: 'homing' | 'boomerang' | 'mine';
  /** Traverse les cibles au lieu de disparaître (chaque cible n'est touchée qu'une fois). */
  pierce?: boolean;
  /** Garde les couleurs de la texture au lieu de prendre celle du tireur. */
  keepColors?: boolean;
  /** Durée du bonus une fois ramassé ; absent = arme de base, permanente. */
  bonusDurationMs?: number;
}

export const WEAPONS = {
  missile: {
    id: 'missile',
    label: 'Missile',
    icon: '🚀',
    sound: 'shoot',
    cooldownMs: 600,
    auto: false,
    texture: 'missile',
    projectileSpeed: 750,
    projectileLifetimeMs: 1500,
    spread: 0,
    slowMs: 2000,
    damage: 3,
  },
  mitraille: {
    id: 'mitraille',
    label: 'Mitraille',
    icon: '🔫',
    sound: 'bullet',
    cooldownMs: 90,
    auto: true,
    texture: 'bullet',
    projectileSpeed: 1000,
    projectileLifetimeMs: 900,
    spread: 0.12,
    slowMs: 600, // moins fort par balle, mais les impacts s'enchaînent
    damage: 1,
    bonusDurationMs: 6000,
  },
  /** Boules de feu de la Nova de Pyro (pas un bonus). */
  fireball: {
    id: 'fireball',
    label: 'Boule de feu',
    icon: '🔥',
    sound: 'fireball',
    cooldownMs: 0,
    auto: false,
    texture: 'fireball',
    projectileSpeed: 620,
    projectileLifetimeMs: 1000,
    spread: 0,
    slowMs: 1500,
    damage: 3,
    keepColors: true,
  },
  pompe: {
    id: 'pompe',
    label: 'Fusil à pompe',
    icon: '💥',
    sound: 'shotgun',
    cooldownMs: 650,
    auto: false,
    texture: 'bullet',
    projectileSpeed: 950,
    projectileLifetimeMs: 320, // courte portée
    spread: 0.05,
    pellets: 6,
    fan: 0.55,
    slowMs: 500,
    damage: 1,
    bonusDurationMs: 7000,
  },
  chercheuse: {
    id: 'chercheuse',
    label: 'Tête chercheuse',
    icon: '🎯',
    sound: 'homing',
    cooldownMs: 700,
    auto: false,
    texture: 'missile',
    projectileSpeed: 480,
    projectileLifetimeMs: 2600,
    spread: 0,
    behavior: 'homing',
    slowMs: 2000,
    damage: 3,
    bonusDurationMs: 7000,
  },
  boomerang: {
    id: 'boomerang',
    label: 'Boomerang',
    icon: '🪃',
    sound: 'boomerang',
    cooldownMs: 500,
    auto: false,
    texture: 'boomerang',
    projectileSpeed: 700,
    projectileLifetimeMs: 2500,
    spread: 0,
    behavior: 'boomerang',
    pierce: true,
    slowMs: 1200,
    damage: 2,
    bonusDurationMs: 8000,
  },
  mine: {
    id: 'mine',
    label: 'Mines',
    icon: '🧨',
    sound: 'mine',
    cooldownMs: 900,
    auto: false,
    texture: 'mine',
    projectileSpeed: 0,
    projectileLifetimeMs: 12000,
    spread: 0,
    behavior: 'mine',
    slowMs: 0,
    damage: 99,
    keepColors: true,
    bonusDurationMs: 8000,
  },
} satisfies Record<string, WeaponDef>;

/** Armes qui peuvent apparaître en bonus dans l'arène. */
export const BONUS_WEAPONS: WeaponDef[] = [WEAPONS.mitraille, WEAPONS.pompe, WEAPONS.chercheuse, WEAPONS.boomerang, WEAPONS.mine];
