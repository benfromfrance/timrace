export type PowerId = 'teleport' | 'frost' | 'shield' | 'magnet' | 'nova' | 'shadow';

export interface CharacterDef {
  id: string;
  name: string;
  emoji: string;
  color: number;
  /** Trait affiché à la sélection. */
  trait: string;
  /** Multiplicateur de vitesse de déplacement. */
  speed: number;
  /** Multiplicateur du recul subi (< 1 = plus lourd). */
  knockbackTaken: number;
  power: {
    id: PowerId;
    name: string;
    description: string;
    cooldownMs: number;
    /** Durée de l'effet, pour les pouvoirs qui durent. */
    durationMs?: number;
  };
}

export const CHARACTERS: CharacterDef[] = [
  {
    id: 'zip',
    name: 'Zip',
    emoji: '⚡',
    color: 0xffeb3b,
    trait: 'Très rapide',
    speed: 1.15,
    knockbackTaken: 1,
    power: { id: 'teleport', name: 'Éclair', description: "Se téléporte d'un bond dans la direction visée.", cooldownMs: 3500 },
  },
  {
    id: 'glacia',
    name: 'Glacia',
    emoji: '❄️',
    color: 0x80deea,
    trait: 'Contrôle de zone',
    speed: 1,
    knockbackTaken: 1,
    power: {
      id: 'frost',
      name: 'Onde de givre',
      description: "Gèle les monstres proches et ralentit fortement l'adversaire.",
      cooldownMs: 8000,
      durationMs: 2500,
    },
  },
  {
    id: 'bastion',
    name: 'Bastion',
    emoji: '🛡️',
    color: 0x81c784,
    trait: 'Lourd et lent, encaisse les coups',
    speed: 0.85,
    knockbackTaken: 0.4,
    power: {
      id: 'shield',
      name: 'Rempart',
      description: 'Bouclier de 3 s : invincible, bloque les tirs et repousse les monstres.',
      cooldownMs: 9000,
      durationMs: 3000,
    },
  },
  {
    id: 'magna',
    name: 'Magna',
    emoji: '🧲',
    color: 0xf06292,
    trait: 'Chasseuse d’étoiles',
    speed: 1,
    knockbackTaken: 1,
    power: {
      id: 'magnet',
      name: 'Aimant',
      description: 'Attire toutes les étoiles vers elle pendant 3 s.',
      cooldownMs: 10000,
      durationMs: 3000,
    },
  },
  {
    id: 'pyro',
    name: 'Pyro',
    emoji: '🔥',
    color: 0xff8a65,
    trait: 'Puissance de feu',
    speed: 1,
    knockbackTaken: 1,
    power: { id: 'nova', name: 'Nova', description: 'Projette 12 boules de feu tout autour de lui.', cooldownMs: 7000 },
  },
  {
    id: 'ombre',
    name: 'Ombre',
    emoji: '👻',
    color: 0x9575cd,
    trait: 'Insaisissable',
    speed: 1.05,
    knockbackTaken: 1,
    power: {
      id: 'shadow',
      name: 'Fondu',
      description: 'Invisible 3 s : les monstres l’ignorent, tirs et coups le traversent.',
      cooldownMs: 9000,
      durationMs: 3000,
    },
  },
];
