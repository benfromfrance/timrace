import Phaser from 'phaser';
import type { ChallengeDef } from '../challenges';
import { FONT, GAME_HEIGHT, GAME_WIDTH } from '../config';

/** Heures de disparition des bandeaux affichés, pour les empiler sans chevauchement. */
let activeUntil: number[] = [];

/** Bandeau « Défi réussi » qui glisse depuis le bas de l'écran. */
export function showChallengeToast(scene: Phaser.Scene, challenge: ChallengeDef, delayMs = 0) {
  const now = performance.now();
  activeUntil = activeUntil.filter((t) => t > now);
  const slot = activeUntil.length;
  activeUntil.push(now + delayMs + 4000);
  const y = GAME_HEIGHT - 70 - slot * 78;
  const reward = challenge.reward ? `\nDébloqué : ${challenge.reward.label}` : '';
  const box = scene.add.container(GAME_WIDTH / 2, GAME_HEIGHT + 60, [
    scene.add.rectangle(0, 0, 560, 68, 0x1b1f30, 0.95).setStrokeStyle(3, 0xffd54f),
    scene.add
      .text(0, 0, `🏆 Défi réussi : ${challenge.name}${reward}`, { fontFamily: FONT, fontSize: '22px', fontStyle: 'bold', color: '#ffd54f', align: 'center' })
      .setOrigin(0.5),
  ]);
  box.setDepth(100);
  scene.tweens.add({ targets: box, y, delay: delayMs, duration: 400, ease: 'Back.Out' });
  scene.tweens.add({
    targets: box,
    alpha: 0,
    delay: delayMs + 3600,
    duration: 400,
    onComplete: () => box.destroy(),
  });
}
