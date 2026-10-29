import Phaser from 'phaser';
import { ARENAS, drawArenaPreview } from '../arenas';
import { Sound } from '../audio/Sound';
import { Progress } from '../challenges';
import { COOP_LIVES, COOP_TARGET, FONT, GAME_WIDTH, SCORE_TO_WIN, SOLO_TARGET } from '../config';
import { Input } from '../input/InputManager';
import { Match, type GameMode } from '../match';

type ModeOption = { id: GameMode; name: string; description: string };

const DUO_MODES: ModeOption[] = [
  { id: 'versus', name: '⚔️  Duel', description: `Le premier à ${SCORE_TO_WIN} étoiles gagne. Tous les coups sont permis !` },
  {
    id: 'coop',
    name: '🤝  Coopération',
    description: `Ensemble, ramassez ${COOP_TARGET} étoiles avant de perdre vos ${COOP_LIVES} cœurs, puis battez le boss final ! Les monstres sont de plus en plus nombreux…`,
  },
];

const SOLO_MODES: ModeOption[] = [
  {
    id: 'solo',
    name: '🦸  Solo',
    description: `Seul contre tous : ramassez ${SOLO_TARGET} étoiles avant de perdre vos ${COOP_LIVES} cœurs, puis battez le boss final (affaibli).`,
  },
];

const PREVIEW_SCALE = 0.3;

/** Choix du mode et de l'arène ; n'importe quel joueur peut naviguer. */
export class MatchSetupScene extends Phaser.Scene {
  private row = 0; // 0 = mode, 1 = arène
  private modes: ModeOption[] = DUO_MODES;
  private modeIndex = 0;
  private arenaIndex = 0;
  private rowTexts: Phaser.GameObjects.Text[] = [];
  private modeDesc!: Phaser.GameObjects.Text;
  private arenaDesc!: Phaser.GameObjects.Text;
  private preview!: Phaser.GameObjects.Graphics;

  constructor() {
    super('MatchSetup');
  }

  create() {
    this.row = 0;
    Sound.playMusic('menu');
    this.modes = Match.playerCount === 1 ? SOLO_MODES : DUO_MODES;
    this.modeIndex = Math.max(0, this.modes.findIndex((m) => m.id === Match.mode));
    this.arenaIndex = ARENAS.indexOf(Match.arena);
    const cx = GAME_WIDTH / 2;

    this.add.text(cx, 50, 'Préparez la partie', { fontFamily: FONT, fontSize: '44px', fontStyle: 'bold', color: '#ffffff' }).setOrigin(0.5);

    this.rowTexts = [130, 260].map((y) =>
      this.add.text(cx, y, '', { fontFamily: FONT, fontSize: '36px', fontStyle: 'bold', color: '#ffffff' }).setOrigin(0.5),
    );
    this.modeDesc = this.add
      .text(cx, 175, '', { fontFamily: FONT, fontSize: '20px', color: '#9aa0b4', align: 'center', wordWrap: { width: 800 } })
      .setOrigin(0.5, 0);
    this.arenaDesc = this.add.text(cx, 305, '', { fontFamily: FONT, fontSize: '20px', color: '#9aa0b4' }).setOrigin(0.5, 0);
    this.preview = this.add.graphics();

    this.add
      .text(cx, 690, '▲ ▼ choisir la ligne  ·  ◀ ▶ changer  ·  Ⓐ lancer  ·  Ⓑ retour', { fontFamily: FONT, fontSize: '20px', color: '#ffffff' })
      .setOrigin(0.5);
    this.refresh();
  }

  update() {
    Input.update(this.game.loop.frame);
    if (!Input.hasPlayers(Match.playerCount)) {
      this.scene.start('Lobby');
      return;
    }

    for (const source of Input.slots.slice(0, Match.playerCount)) {
      if (!source) continue;
      const s = source.state;
      if (s.navY !== 0) {
        this.row = Phaser.Math.Clamp(this.row + s.navY, 0, 1);
        Sound.sfx('uiMove');
        this.refresh();
      }
      if (s.navX !== 0) {
        if (this.row === 0) this.modeIndex = (this.modeIndex + s.navX + this.modes.length) % this.modes.length;
        else this.arenaIndex = (this.arenaIndex + s.navX + ARENAS.length) % ARENAS.length;
        source.rumble(0.15, 30);
        Sound.sfx('uiMove');
        this.refresh();
      }
      if (s.actionPressed || s.startPressed) {
        if (!Progress.isUnlocked('arena', ARENAS[this.arenaIndex].id)) {
          Sound.sfx('uiError'); // arène verrouillée
          source.rumble(0.4, 200);
          this.cameras.main.shake(150, 0.004);
          return;
        }
        Sound.sfx('uiConfirm');
        Match.mode = this.modes[this.modeIndex].id;
        Match.arena = ARENAS[this.arenaIndex];
        this.scene.start('Game');
        return;
      }
      if (s.backPressed) {
        Sound.sfx('uiBack');
        this.scene.start('CharacterSelect');
        return;
      }
    }
  }

  private refresh() {
    const mode = this.modes[this.modeIndex];
    const arena = ARENAS[this.arenaIndex];
    const lock = Progress.isUnlocked('arena', arena.id) ? undefined : Progress.lockFor('arena', arena.id);
    const labels = [`Mode :  ◀  ${mode.name}  ▶`, `Arène :  ◀  ${lock ? '🔒 ' : ''}${arena.name}  ▶`];
    this.rowTexts.forEach((t, i) => t.setText(labels[i]).setColor(i === this.row ? '#ffd54f' : '#ffffff').setScale(i === this.row ? 1.05 : 1));
    this.modeDesc.setText(mode.description);
    this.arenaDesc.setText(lock ? `Verrouillée — défi « ${lock.name} » : ${lock.description}` : arena.description);

    const w = GAME_WIDTH * PREVIEW_SCALE;
    drawArenaPreview(this.preview, arena, GAME_WIDTH / 2 - w / 2, 360, PREVIEW_SCALE);
  }
}
