import Phaser from 'phaser';
import { ARENAS } from '../arenas';
import { Sound } from '../audio/Sound';
import { CHARACTERS } from '../characters';
import { FONT, GAME_HEIGHT, GAME_WIDTH, css } from '../config';
import { Input } from '../input/InputManager';
import { BOSSES, type BossId } from '../monsters';
import { Stats, formatDuration } from '../stats';

const MODE_LABELS = [
  { id: 'versus', label: '⚔️ Duel' },
  { id: 'coop', label: '🤝 Coopération' },
  { id: 'solo', label: '🦸 Solo' },
] as const;

const LEFT_X = 60;
const RIGHT_X = 680;
const COL_W = 540;

/** Statistiques de toutes les parties jouées dans ce navigateur. Ⓑ pour revenir. */
export class StatsScene extends Phaser.Scene {
  constructor() {
    super('Stats');
  }

  create() {
    this.cameras.main.fadeIn(250, 5, 6, 12);
    const s = Stats.summary;
    this.add
      .text(GAME_WIDTH / 2, 42, '📊 Statistiques', { fontFamily: FONT, fontSize: '42px', fontStyle: 'bold', color: '#ffffff' })
      .setOrigin(0.5);

    if (s.games === 0) {
      this.add
        .text(GAME_WIDTH / 2, GAME_HEIGHT / 2, 'Aucune partie terminée pour l’instant.\nJoue une partie pour remplir cet écran !', {
          fontFamily: FONT,
          fontSize: '26px',
          color: '#9aa0b4',
          align: 'center',
        })
        .setOrigin(0.5);
    } else {
      this.buildTiles();
      this.buildModes(LEFT_X, 200);
      this.buildArenas(LEFT_X, 370);
      this.buildBosses(RIGHT_X, 200);
      this.buildCharacters(560);
    }

    this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT - 16, 'Ⓑ retour  ·  statistiques enregistrées dans ce navigateur', { fontFamily: FONT, fontSize: '18px', color: '#9aa0b4' })
      .setOrigin(0.5);
  }

  update() {
    Input.update(this.game.loop.frame);
    if (Input.any((src) => src.state.backPressed || src.state.actionPressed || src.state.firePressed)) {
      Sound.sfx('uiBack');
      this.scene.start('Lobby');
    }
  }

  // ─── Sections ────────────────────────────────────────────────────────

  private buildTiles() {
    const s = Stats.summary;
    const tiles: [string, string][] = [
      [String(s.games), 'parties jouées'],
      [String(Stats.wins), 'victoires'],
      [formatDuration(s.playTimeMs), 'temps de jeu'],
      [String(s.stars), 'étoiles ramassées'],
      [String(s.monstersKilled), 'monstres tués'],
      [String(Stats.bossesDefeated), 'boss vaincus'],
    ];
    const w = 190;
    const startX = GAME_WIDTH / 2 - 2.5 * (w + 12);
    tiles.forEach(([value, label], i) => {
      const x = startX + i * (w + 12);
      this.panel(x - w / 2, 80, w, 86);
      const v = this.add.text(x, 112, value, { fontFamily: FONT, fontSize: '34px', fontStyle: 'bold', color: '#ffd54f' }).setOrigin(0.5).setScale(0);
      this.add.text(x, 148, label, { fontFamily: FONT, fontSize: '16px', color: '#9aa0b4' }).setOrigin(0.5);
      this.tweens.add({ targets: v, scale: 1, duration: 400, delay: i * 70, ease: 'Back.Out' });
    });
  }

  private buildModes(x: number, y: number) {
    this.header(x, y, 'Modes de jeu');
    const modes = Stats.summary.modes;
    MODE_LABELS.forEach(({ id, label }, i) => {
      const rowY = y + 40 + i * 36;
      const m = modes[id];
      this.add.text(x, rowY, label, { fontFamily: FONT, fontSize: '19px', color: '#ffffff' }).setOrigin(0, 0.5);
      // En duel, quelqu'un gagne toujours : on n'affiche que le nombre de parties
      const detail = id === 'versus' ? `${m.played} partie${m.played > 1 ? 's' : ''}` : `${m.won} / ${m.played} réussies`;
      this.add.text(x + 200, rowY, detail, { fontFamily: FONT, fontSize: '17px', color: '#c5cae9' }).setOrigin(0, 0.5);
      if (id !== 'versus') this.bar(x + 390, rowY, 150, m.played ? m.won / m.played : 0, 0x9ccc65);
    });
  }

  private buildArenas(x: number, y: number) {
    this.header(x, y, 'Arènes');
    const arenas = Stats.summary.arenas;
    const max = Math.max(1, ...ARENAS.map((a) => arenas[a.id]?.played ?? 0));
    ARENAS.forEach((a, i) => {
      const rowY = y + 40 + i * 34;
      const played = arenas[a.id]?.played ?? 0;
      this.add.text(x, rowY, a.name, { fontFamily: FONT, fontSize: '19px', color: '#ffffff' }).setOrigin(0, 0.5);
      this.add.text(x + 200, rowY, `${played} partie${played > 1 ? 's' : ''}`, { fontFamily: FONT, fontSize: '17px', color: '#c5cae9' }).setOrigin(0, 0.5);
      this.bar(x + 390, rowY, 150, played / max, 0x4fc3f7);
    });
  }

  private buildBosses(x: number, y: number) {
    this.header(x, y, 'Boss finaux');
    const bosses = Stats.summary.bosses;
    BOSSES.forEach((def, i) => {
      const rowY = y + 44 + i * 74;
      const b = bosses[def.id as BossId];
      this.panel(x, rowY - 26, COL_W, 64);
      this.add.text(x + 14, rowY - 6, `${def.boss?.emoji} ${def.name}`, { fontFamily: FONT, fontSize: '20px', fontStyle: 'bold', color: '#ffffff' }).setOrigin(0, 0.5);
      if (!b) {
        this.add.text(x + 14, rowY + 20, 'Jamais rencontré', { fontFamily: FONT, fontSize: '16px', fontStyle: 'italic', color: '#7986cb' }).setOrigin(0, 0.5);
        return;
      }
      this.add
        .text(x + 14, rowY + 20, `Vaincu ${b.defeated} / ${b.met} fois`, { fontFamily: FONT, fontSize: '16px', color: '#c5cae9' })
        .setOrigin(0, 0.5);
      this.bar(x + 190, rowY + 20, 160, b.met ? b.defeated / b.met : 0, 0xef5350);
      if (b.bestMs !== null) {
        this.add
          .text(x + COL_W - 14, rowY - 6, `⏱ record ${formatDuration(b.bestMs)}`, { fontFamily: FONT, fontSize: '16px', color: '#ffd54f' })
          .setOrigin(1, 0.5);
      }
    });
  }

  private buildCharacters(y: number) {
    this.header(LEFT_X, y, 'Personnages');
    const chars = Stats.summary.characters;
    const w = 186;
    CHARACTERS.forEach((c, i) => {
      const x = LEFT_X + i * (w + 8);
      const stat = chars[c.id] ?? { played: 0, won: 0 };
      this.panel(x, y + 24, w, 96);
      this.add.image(x + 34, y + 72, 'player').setTint(c.color).setScale(0.9);
      this.add.text(x + 34, y + 72, c.emoji, { fontSize: '22px' }).setOrigin(0.5);
      this.add.text(x + 66, y + 46, c.name, { fontFamily: FONT, fontSize: '18px', fontStyle: 'bold', color: css(c.color) });
      this.add.text(x + 66, y + 72, `${stat.played} partie${stat.played > 1 ? 's' : ''}`, { fontFamily: FONT, fontSize: '15px', color: '#c5cae9' });
      this.add.text(x + 66, y + 92, `${stat.won} victoire${stat.won > 1 ? 's' : ''}`, { fontFamily: FONT, fontSize: '15px', color: '#9ccc65' });
    });
  }

  // ─── Éléments graphiques ─────────────────────────────────────────────

  private header(x: number, y: number, text: string) {
    this.add.text(x, y, text.toUpperCase(), { fontFamily: FONT, fontSize: '17px', fontStyle: 'bold', color: '#7986cb' });
  }

  private panel(x: number, y: number, w: number, h: number) {
    this.add.graphics().fillStyle(0x12152a, 0.9).fillRoundedRect(x, y, w, h, 12).lineStyle(2, 0x2a2f45).strokeRoundedRect(x, y, w, h, 12);
  }

  /** Barre de proportion animée (ratio 0..1). */
  private bar(x: number, y: number, w: number, ratio: number, color: number) {
    this.add.rectangle(x, y, w, 10, 0x2a2f45).setOrigin(0, 0.5);
    const fill = this.add.rectangle(x, y, Math.max(0.01, w * ratio), 10, color).setOrigin(0, 0.5).setScale(0, 1);
    this.tweens.add({ targets: fill, scaleX: 1, duration: 600, delay: 200, ease: 'Cubic.Out' });
  }
}
