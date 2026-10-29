import { ARENAS, type ArenaDef } from './arenas';
import { CHARACTERS, type CharacterDef } from './characters';
import { COOP_TARGET, SOLO_TARGET } from './config';

export type GameMode = 'versus' | 'coop' | 'solo';

/** Étoiles à ramasser avant le boss (modes en équipe). */
export const starTarget = (mode: GameMode) => (mode === 'solo' ? SOLO_TARGET : COOP_TARGET);

/** Réglages de la partie choisis dans les menus, partagés entre les scènes. */
export const Match: { playerCount: number; characters: CharacterDef[]; mode: GameMode; arena: ArenaDef } = {
  playerCount: 2,
  characters: [CHARACTERS[0], CHARACTERS[1]],
  mode: 'versus',
  arena: ARENAS[0],
};
