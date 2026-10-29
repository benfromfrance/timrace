import Phaser from 'phaser';
import { GAME_HEIGHT, GAME_WIDTH, PLAYER_COLORS, PLAYER_NAMES } from '../config';
import { Sound } from '../audio/Sound';
import { CHALLENGES, Progress } from '../challenges';
import { Input, MAX_PLAYERS } from '../input/InputManager';
import { Match } from '../match';

/** Écran « appuyez sur A pour rejoindre ». */
export class LobbyScene extends Phaser.Scene {
  private slotTexts: Phaser.GameObjects.Text[] = [];
  private hint!: Phaser.GameObjects.Text;
  private soundHint!: Phaser.GameObjects.Text;

  constructor() {
    super('Lobby');
  }

  create() {
    const cx = GAME_WIDTH / 2;
    this.add
      .text(cx, 120, 'TIMCAR', { fontFamily: 'system-ui, sans-serif', fontSize: '96px', fontStyle: 'bold', color: '#ffffff' })
      .setOrigin(0.5);

    this.slotTexts = Array.from({ length: MAX_PLAYERS }, (_, i) =>
      this.add
        .text(cx + (i === 0 ? -260 : 260), 360, '', {
          fontFamily: 'system-ui, sans-serif',
          fontSize: '28px',
          align: 'center',
          color: '#' + PLAYER_COLORS[i].toString(16).padStart(6, '0'),
        })
        .setOrigin(0.5),
    );

    this.hint = this.add
      .text(cx, GAME_HEIGHT - 110, '', { fontFamily: 'system-ui, sans-serif', fontSize: '22px', color: '#9aa0b4', align: 'center' })
      .setOrigin(0.5);

    this.add
      .text(cx, 200, `Ⓨ Défis  ·  🏆 ${Progress.doneCount} / ${CHALLENGES.length}`, { fontFamily: 'system-ui, sans-serif', fontSize: '24px', color: '#ffd54f' })
      .setOrigin(0.5);
    this.soundHint = this.add
      .text(cx, GAME_HEIGHT - 30, '', { fontFamily: 'system-ui, sans-serif', fontSize: '20px', color: '#ffffff' })
      .setOrigin(0.5);
    Sound.playMusic('menu');

    const off = Input.onChange(() => this.refresh());
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, off);
    this.refresh();
  }

  update() {
    Input.update(this.game.loop.frame);
    // Seuls les joueurs déjà présents avant cette frame peuvent lancer : le Ⓐ qui fait rejoindre ne lance pas
    const starters = Input.slots.filter((s) => s !== null);

    this.soundHint.setText(
      !Sound.unlocked ? '🔇 Cliquez dans la page ou appuyez sur une touche du clavier pour activer le son' : Sound.isMuted ? '🔇 Son coupé (M pour le remettre)' : '🔊 M : couper le son',
    );

    if (Input.any((s) => s.state.powerPressed)) {
      Sound.sfx('uiConfirm');
      this.scene.start('Challenges');
      return;
    }

    for (const source of Input.pollJoinRequests()) {
      Input.join(source);
      Sound.sfx('uiConfirm');
    }

    // B : quitter son emplacement
    Input.slots.forEach((s, i) => {
      if (s?.state.backPressed) {
        Input.leave(i);
        Sound.sfx('uiBack');
      }
    });

    // À deux : Ⓐ ou ☰ lance. Seul : ☰ seulement, pour laisser le temps au 2e joueur de rejoindre avec Ⓐ
    const count = Input.joinedCount;
    const launch = starters.some((s) => s.state.startPressed || (count === 2 && s.state.actionPressed));
    if (count > 0 && launch) {
      Sound.sfx('uiConfirm');
      Input.compact();
      Match.playerCount = Input.joinedCount;
      this.scene.start('CharacterSelect');
    }
  }

  private refresh() {
    Input.slots.forEach((source, i) => {
      this.slotTexts[i].setText(
        source ? `${PLAYER_NAMES[i]}\n✔ ${source.label}\n\n(B pour quitter)` : `${PLAYER_NAMES[i]}\n\nAppuyez sur Ⓐ\npour rejoindre`,
      );
    });
    const pads = Input.connectedPadCount;
    this.hint.setText(
      (pads === 0
        ? 'Aucune manette détectée — branchez une manette Xbox et appuyez sur un bouton.\n'
        : `${pads} manette(s) détectée(s).\n`) +
        (Input.joinedCount === 2
          ? 'Appuyez sur Ⓐ ou ☰ pour commencer !'
          : Input.joinedCount === 1
            ? '☰ pour jouer seul  ·  ou attendez le 2e joueur (Ⓐ pour rejoindre)'
            : 'Clavier : Espace (ZQSD) ou Entrée (flèches) pour rejoindre') +
        '\nAu clavier, ☰ = R (gauche) ou Retour arrière (droite)',
    );
  }
}
