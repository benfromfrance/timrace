import Phaser from 'phaser';
import { Sound } from '../audio/Sound';
import { CHALLENGES, Progress } from '../challenges';
import { FONT, GAME_HEIGHT, GAME_WIDTH } from '../config';
import { Input } from '../input/InputManager';

/** Liste des défis, de leur progression et de leurs récompenses. Ⓑ pour revenir. */
export class ChallengesScene extends Phaser.Scene {
  constructor() {
    super('Challenges');
  }

  create() {
    const cx = GAME_WIDTH / 2;
    this.add
      .text(cx, 50, `🏆 Défis  ·  ${Progress.doneCount} / ${CHALLENGES.length}`, { fontFamily: FONT, fontSize: '44px', fontStyle: 'bold', color: '#ffd54f' })
      .setOrigin(0.5);

    const rowH = 68;
    CHALLENGES.forEach((c, i) => {
      const y = 120 + i * rowH;
      const done = Progress.isDone(c.id);
      this.add.rectangle(cx, y + rowH / 2 - 6, 1000, rowH - 10, done ? 0x1f3a24 : 0x1b1f30).setStrokeStyle(2, done ? 0x9ccc65 : 0x2a2f45);
      this.add.text(cx - 470, y + rowH / 2 - 6, done ? '✅' : '🔒', { fontSize: '30px' }).setOrigin(0.5);

      const progress = c.goal && !done ? `  (${Math.min(Progress.stat(c.goal.stat), c.goal.target)} / ${c.goal.target})` : '';
      this.add.text(cx - 430, y + 6, c.name + progress, { fontFamily: FONT, fontSize: '22px', fontStyle: 'bold', color: done ? '#c5e1a5' : '#ffffff' });
      this.add.text(cx - 430, y + 32, c.description, { fontFamily: FONT, fontSize: '17px', color: '#9aa0b4' });
      if (c.reward) {
        this.add
          .text(cx + 480, y + rowH / 2 - 6, `🎁 ${c.reward.label}`, { fontFamily: FONT, fontSize: '19px', color: done ? '#9ccc65' : '#ffd54f' })
          .setOrigin(1, 0.5);
      }
    });

    this.add
      .text(cx, GAME_HEIGHT - 24, 'Ⓑ retour  ·  progression enregistrée dans ce navigateur', { fontFamily: FONT, fontSize: '20px', color: '#ffffff' })
      .setOrigin(0.5);
  }

  update() {
    Input.update(this.game.loop.frame);
    if (Input.any((s) => s.state.backPressed || s.state.actionPressed || s.state.powerPressed)) {
      Sound.sfx('uiBack');
      this.scene.start('Lobby');
    }
  }
}
