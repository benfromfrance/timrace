export const GAME_WIDTH = 1280;
export const GAME_HEIGHT = 720;

export const PLAYER_COLORS = [0x4fc3f7, 0xff7043] as const;
export const PLAYER_NAMES = ['Joueur 1', 'Joueur 2'] as const;

export const SCORE_TO_WIN = 10;

/** Coopération : étoiles à ramasser ensemble et vies partagées. */
export const COOP_TARGET = 20;
export const COOP_LIVES = 5;
/** Solo : mêmes règles que la coopération, en plus court, avec un boss affaibli. */
export const SOLO_TARGET = 15;
export const SOLO_BOSS_HP = 0.6;

export const FONT = 'system-ui, sans-serif';
export const css = (color: number) => '#' + color.toString(16).padStart(6, '0');
