import Phaser from 'phaser';
import { FONT, GAME_HEIGHT, GAME_WIDTH, PLAYER_COLORS, PLAYER_NAMES, css } from '../config';
import { Sound } from '../audio/Sound';
import type { ChallengeDef } from '../challenges';
import { Input } from '../input/InputManager';
import { showChallengeToast } from '../ui/toast';
import { Match, starTarget, type GameMode } from '../match';
import { MONSTERS } from '../monsters';

export interface PodiumData {
  mode: GameMode;
  outcome: 'win' | 'lose';
  /** Gagnant du duel ; null en coopération et en solo. */
  winnerIndex: number | null;
  scores: number[];
  teamScore: number;
  /** Coopération : l'équipe a atteint le boss final. */
  reachedBoss: boolean;
  /** Défis réussis en fin de partie, annoncés sur le podium. */
  achievements: ChallengeDef[];
}

const BASE_Y = GAME_HEIGHT - 40;
const STEP_WIDTH = 220;
const CONFETTI_COLORS = [0xffd54f, 0x4fc3f7, 0xff7043, 0x9ccc65, 0xce93d8, 0xffffff];

/** Écran de fin affiché par-dessus la partie figée : podium en duel, bilan d'équipe en coopération. */
export class PodiumScene extends Phaser.Scene {
  private canContinue = false;

  constructor() {
    super('Podium');
  }

  create(data: PodiumData) {
    this.canContinue = false;
    const cx = GAME_WIDTH / 2;
    const won = data.outcome === 'win';
    Sound.playMusic(null);
    Sound.sfx(won ? 'victory' : 'defeat');
    data.achievements.forEach((c, i) => showChallengeToast(this, c, 3200 + i * 300));

    const overlay = this.add.rectangle(cx, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 0x05060c).setAlpha(0);
    this.tweens.add({ targets: overlay, alpha: 0.82, duration: 400 });

    // Titre et sous-titre
    let title: string;
    let subtitle: string;
    let subtitleColor = '#ffffff';
    if (data.mode !== 'versus') {
      title = won ? (data.mode === 'solo' ? 'MISSION ACCOMPLIE !' : "VICTOIRE D'ÉQUIPE !") : 'DÉFAITE…';
      subtitle = won
        ? `👑 ${MONSTERS.boss.name} est vaincu ! (${data.teamScore} étoiles ramassées${data.mode === 'coop' ? ' ensemble' : ''})`
        : data.reachedBoss
          ? `${MONSTERS.boss.name} a eu raison de vous… si près du but !`
          : `Les monstres ont eu raison de vous… ${data.teamScore} / ${starTarget(data.mode)} étoiles`;
    } else {
      const w = data.winnerIndex ?? 0;
      title = 'VICTOIRE !';
      subtitle = `${PLAYER_NAMES[w]} (${Match.characters[w].emoji} ${Match.characters[w].name}) remporte la partie`;
      subtitleColor = css(PLAYER_COLORS[w]);
    }

    const titleText = this.add
      .text(cx, 90, title, { fontFamily: FONT, fontSize: '80px', fontStyle: 'bold', color: won ? '#ffd54f' : '#ef5350', stroke: '#000', strokeThickness: 10 })
      .setOrigin(0.5)
      .setScale(0);
    this.tweens.add({ targets: titleText, scale: 1, duration: 600, delay: 200, ease: 'Back.Out' });
    if (won) this.tweens.add({ targets: titleText, angle: { from: -3, to: 3 }, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.InOut', delay: 800 });

    const sub = this.add
      .text(cx, 170, subtitle, { fontFamily: FONT, fontSize: '30px', fontStyle: 'bold', color: subtitleColor })
      .setOrigin(0.5)
      .setAlpha(0);
    this.tweens.add({ targets: sub, alpha: 1, duration: 400, delay: 700 });

    // Marches : 1re plus haute en duel (le 2e monte d'abord, pour le suspense), égales en coopération, une seule en solo
    const steps =
      data.mode === 'solo'
        ? [{ player: 0, x: cx, h: 200, label: 'J1', delay: 900 }]
        : data.mode === 'coop'
        ? [0, 1].map((i) => ({ player: i, x: cx + (i === 0 ? -150 : 150), h: 180, label: `J${i + 1}`, delay: 900 + i * 300 }))
        : [
            { player: 1 - (data.winnerIndex ?? 0), x: cx + 150, h: 150, label: '2', delay: 900 },
            { player: data.winnerIndex ?? 0, x: cx - 150, h: 250, label: '1', delay: 1500 },
          ];
    for (const s of steps) this.buildStep(s.player, data.scores[s.player], s.x, s.h, s.label, s.delay);

    this.time.delayedCall(2300, () => {
      if (!won) {
        this.cameras.main.shake(300, 0.01);
        for (const s of Input.slots) s?.rumble(0.6, 300);
        return;
      }
      const winners = data.mode === 'versus' ? steps.filter((s) => s.player === data.winnerIndex) : steps;
      this.celebrate(winners.map((s) => ({ x: s.x, top: BASE_Y - s.h, player: s.player })));
    });

    const hint = this.add
      .text(cx, GAME_HEIGHT - 12, `Ⓐ ${won ? 'rejouer' : 'réessayer'}   ·   Ⓑ changer de personnage`, { fontFamily: FONT, fontSize: '22px', color: '#ffffff' })
      .setOrigin(0.5, 1)
      .setAlpha(0)
      .setDepth(10);
    this.time.delayedCall(3000, () => {
      this.canContinue = true; // évite qu'un tir en cours ne relance aussitôt la partie
      this.tweens.add({ targets: hint, alpha: { from: 0.4, to: 1 }, duration: 700, yoyo: true, repeat: -1 });
    });
  }

  update() {
    Input.update(this.game.loop.frame);
    if (!this.canContinue) return;
    const players = Input.slots.slice(0, Match.playerCount).filter((s) => s !== null);
    if (players.some((s) => s.state.actionPressed || s.state.startPressed)) {
      Sound.sfx('uiConfirm');
      this.scene.stop('Game');
      this.scene.start('Game');
    } else if (players.some((s) => s.state.backPressed)) {
      Sound.sfx('uiBack');
      this.scene.stop('Game');
      this.scene.start('CharacterSelect');
    }
  }

  /** Marche du podium, personnage qui tombe dessus et score qui défile. */
  private buildStep(playerIndex: number, score: number, x: number, h: number, label: string, delay: number) {
    const character = Match.characters[playerIndex];
    const top = BASE_Y - h;

    const step = this.add.rectangle(x, BASE_Y, STEP_WIDTH, h, character.color).setOrigin(0.5, 1).setScale(1, 0);
    step.setStrokeStyle(4, PLAYER_COLORS[playerIndex], 0.9);
    const rank = this.add
      .text(x, BASE_Y - h / 2, label, { fontFamily: FONT, fontSize: h > 200 ? '120px' : '80px', fontStyle: 'bold', color: '#ffffff' })
      .setOrigin(0.5)
      .setAlpha(0);
    this.tweens.add({ targets: step, scaleY: 1, duration: 600, delay, ease: 'Back.Out' });
    this.tweens.add({ targets: rank, alpha: 0.4, duration: 300, delay: delay + 400 });

    const avatar = this.add.container(x, -80, [
      this.add.image(0, 0, 'player').setTint(character.color).setScale(1.6),
      this.add.image(0, 0, 'ring').setTint(PLAYER_COLORS[playerIndex]).setScale(1.4),
      this.add.text(0, 0, character.emoji, { fontSize: '40px' }).setOrigin(0.5),
    ]);
    this.tweens.add({ targets: avatar, y: top - 40, duration: 700, delay: delay + 500, ease: 'Bounce.Out' });

    const scoreText = this.add
      .text(x + 14, top - 115, '0', { fontFamily: FONT, fontSize: '48px', fontStyle: 'bold', color: '#ffffff', stroke: '#000', strokeThickness: 6 })
      .setOrigin(0.5)
      .setAlpha(0);
    const star = this.add.image(x - 44, top - 115, 'star').setAlpha(0);
    this.tweens.add({ targets: [scoreText, star], alpha: 1, duration: 200, delay: delay + 1000 });
    this.tweens.addCounter({
      from: 0,
      to: score,
      duration: 600,
      delay: delay + 1000,
      onUpdate: (tw) => scoreText.setText(String(Math.round(tw.getValue() ?? 0))),
      onComplete: () => this.tweens.add({ targets: scoreText, scale: { from: 1.4, to: 1 }, duration: 250, ease: 'Back.Out' }),
    });
  }

  private celebrate(winners: { x: number; top: number; player: number }[]) {
    for (const w of winners) {
      // Couronne qui tombe sur chaque gagnant
      const crown = this.add.image(w.x, -60, 'crown').setScale(1.4);
      this.tweens.add({ targets: crown, y: w.top - 92, duration: 500, ease: 'Bounce.Out' });
      this.tweens.add({ targets: crown, angle: { from: -8, to: 8 }, duration: 600, yoyo: true, repeat: -1, ease: 'Sine.InOut', delay: 500 });

      this.add
        .particles(w.x, w.top - 40, 'confetti', {
          speed: { min: 200, max: 500 },
          angle: { min: 200, max: 340 },
          rotate: { min: 0, max: 360 },
          lifespan: 1400,
          gravityY: 500,
          tint: CONFETTI_COLORS,
          emitting: false,
        })
        .explode(80);
      Input.slots[w.player]?.rumble(1, 600);
    }

    // Pluie de confettis
    const confetti = this.add.particles(0, -10, 'confetti', {
      x: { min: 0, max: GAME_WIDTH },
      speedY: { min: 120, max: 260 },
      speedX: { min: -60, max: 60 },
      rotate: { min: 0, max: 360 },
      lifespan: 4000,
      quantity: 3,
      frequency: 40,
      tint: CONFETTI_COLORS,
      gravityY: 60,
    });
    this.time.delayedCall(3500, () => confetti.stop());
    this.cameras.main.flash(250, 255, 255, 255);
  }
}
