import type Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH } from './config';

/** Rectangle en coordonnées d'arène (coin haut-gauche). */
export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface ArenaDef {
  id: string;
  name: string;
  description: string;
  bg: number;
  grid: number;
  wallColor: number;
  /** Murs : bloquent joueurs, monstres et tirs. */
  walls: Rect[];
  /** Plots ronds qui renvoient violemment les joueurs. */
  bumpers: { x: number; y: number; r: number }[];
  /** Lave : touche = comme un coup de monstre. */
  lava: Rect[];
  /** Adhérence (0..1) : vitesse à laquelle un joueur atteint la vitesse voulue. Faible = glisse. */
  grip: number;
  spawns: [{ x: number; y: number }, { x: number; y: number }];
}

const MID_Y = GAME_HEIGHT / 2;

export const ARENAS: ArenaDef[] = [
  {
    id: 'classique',
    name: 'Classique',
    description: 'Une arène dégagée, sans surprise.',
    bg: 0x0d0f1a,
    grid: 0x1c2033,
    wallColor: 0x3a3f55,
    walls: [],
    bumpers: [],
    lava: [],
    grip: 0.25,
    spawns: [{ x: GAME_WIDTH * 0.25, y: MID_Y }, { x: GAME_WIDTH * 0.75, y: MID_Y }],
  },
  {
    id: 'forteresse',
    name: 'Forteresse',
    description: 'Des piliers et une croix centrale pour se cacher des tirs.',
    bg: 0x11151c,
    grid: 0x1f2633,
    wallColor: 0x607d8b,
    walls: [
      { x: 260, y: 150, w: 70, h: 70 },
      { x: 950, y: 150, w: 70, h: 70 },
      { x: 260, y: 500, w: 70, h: 70 },
      { x: 950, y: 500, w: 70, h: 70 },
      { x: 520, y: 340, w: 240, h: 40 },
      { x: 620, y: 240, w: 40, h: 240 },
    ],
    bumpers: [],
    lava: [],
    grip: 0.25,
    spawns: [{ x: 140, y: MID_Y }, { x: GAME_WIDTH - 140, y: MID_Y }],
  },
  {
    id: 'patinoire',
    name: 'Patinoire',
    description: 'Sol glacé : on glisse partout ! Les plots renvoient violemment.',
    bg: 0x0e1a2b,
    grid: 0x1b3550,
    wallColor: 0x4dd0e1,
    walls: [],
    bumpers: [
      { x: 640, y: MID_Y, r: 70 },
      { x: 330, y: 190, r: 40 },
      { x: 950, y: 190, r: 40 },
      { x: 330, y: 530, r: 40 },
      { x: 950, y: 530, r: 40 },
    ],
    lava: [],
    grip: 0.035,
    spawns: [{ x: 150, y: MID_Y }, { x: GAME_WIDTH - 150, y: MID_Y }],
  },
  {
    id: 'volcan',
    name: 'Volcan',
    description: 'Des bassins de lave : y tomber fait aussi mal qu’un monstre.',
    bg: 0x1a0d0d,
    grid: 0x2e1616,
    wallColor: 0x5d4037,
    walls: [
      { x: 420, y: 330, w: 50, h: 60 },
      { x: 810, y: 330, w: 50, h: 60 },
    ],
    bumpers: [],
    lava: [
      { x: 560, y: 290, w: 160, h: 140 },
      { x: 240, y: 150, w: 120, h: 90 },
      { x: 920, y: 150, w: 120, h: 90 },
      { x: 240, y: 480, w: 120, h: 90 },
      { x: 920, y: 480, w: 120, h: 90 },
    ],
    grip: 0.25,
    spawns: [{ x: 120, y: MID_Y }, { x: GAME_WIDTH - 120, y: MID_Y }],
  },
];

/** Miniature de l'arène (écran de préparation de partie). */
export function drawArenaPreview(g: Phaser.GameObjects.Graphics, arena: ArenaDef, x: number, y: number, scale: number) {
  g.clear();
  g.fillStyle(arena.bg).fillRect(x, y, GAME_WIDTH * scale, GAME_HEIGHT * scale);
  g.lineStyle(2, arena.grid).strokeRect(x, y, GAME_WIDTH * scale, GAME_HEIGHT * scale);
  g.fillStyle(0xff5722);
  for (const r of arena.lava) g.fillRect(x + r.x * scale, y + r.y * scale, r.w * scale, r.h * scale);
  g.fillStyle(arena.wallColor);
  for (const r of arena.walls) g.fillRect(x + r.x * scale, y + r.y * scale, r.w * scale, r.h * scale);
  for (const b of arena.bumpers) g.fillCircle(x + b.x * scale, y + b.y * scale, b.r * scale);
}
