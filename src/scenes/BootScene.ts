import Phaser from 'phaser';

/** Génère les textures de base (pas d'assets externes pour l'instant). */
export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  preload() {
    // Placez vos sprites/sons dans /public et chargez-les ici, ex :
    // this.load.image('player', 'sprites/player.png');
  }

  create() {
    const g = this.add.graphics();

    g.fillStyle(0xffffff).fillCircle(24, 24, 24);
    g.generateTexture('player', 48, 48).clear();

    g.fillStyle(0xffd54f).fillPoints(starPoints(16, 16, 16, 7, 5), true);
    g.generateTexture('star', 32, 32).clear();

    g.fillStyle(0xffffff).fillRoundedRect(0, 0, 22, 8, 4);
    g.fillStyle(0xff5252).fillTriangle(22, 0, 30, 4, 22, 8);
    g.generateTexture('missile', 30, 8).clear();

    g.fillStyle(0xffffff).fillRoundedRect(0, 0, 12, 5, 2);
    g.generateTexture('bullet', 12, 5).clear();

    this.generateMonsters(g);

    // Boomerang (en V) et mine
    g.fillStyle(0xffffff).fillTriangle(0, 4, 26, 0, 26, 8).fillTriangle(26, 0, 30, 4, 26, 8);
    g.fillTriangle(0, 4, 4, 28, 10, 26);
    g.generateTexture('boomerang', 30, 30).clear();
    g.fillStyle(0x455a64).fillCircle(12, 12, 11);
    g.lineStyle(2, 0x90a4ae).strokeCircle(12, 12, 11);
    g.fillStyle(0xff1744).fillCircle(12, 12, 4);
    g.generateTexture('mine', 24, 24).clear();

    // Cœur de soin (coopération)
    g.fillStyle(0xff5252).fillCircle(9, 10, 9).fillCircle(23, 10, 9).fillTriangle(0.5, 13, 31.5, 13, 16, 30);
    g.fillStyle(0xffffff, 0.8).fillCircle(7, 7, 3);
    g.generateTexture('heart', 32, 31).clear();

    // Caisse d'arme bonus
    g.fillStyle(0x3a3f55).fillRoundedRect(0, 0, 36, 36, 6);
    g.lineStyle(3, 0x9ccc65).strokeRoundedRect(1.5, 1.5, 33, 33, 6);
    g.fillStyle(0x9ccc65);
    for (const y of [10, 17, 24]) g.fillRect(8, y, 20, 3);
    g.generateTexture('weapon-crate', 36, 36).clear();

    g.fillStyle(0xffd54f).fillPoints(
      [[0, 28], [0, 8], [10, 16], [20, 0], [30, 16], [40, 8], [40, 28]].map(([x, y]) => new Phaser.Math.Vector2(x, y)),
      true,
    );
    g.fillStyle(0xff5252).fillCircle(20, 21, 4);
    g.generateTexture('crown', 40, 28).clear();

    // Anneau de couleur du joueur et bulle de bouclier
    g.lineStyle(4, 0xffffff).strokeCircle(30, 30, 27);
    g.generateTexture('ring', 60, 60).clear();
    g.fillStyle(0x81c784, 0.25).fillCircle(40, 40, 38);
    g.lineStyle(3, 0xc8e6c9).strokeCircle(40, 40, 37);
    g.generateTexture('shield-bubble', 80, 80).clear();

    g.fillStyle(0xff7043).fillCircle(9, 9, 9);
    g.fillStyle(0xffeb3b).fillCircle(9, 9, 4);
    g.generateTexture('fireball', 18, 18).clear();

    // Épée pointant vers la droite (poignée à gauche, origine de rotation)
    g.fillStyle(0x6d4c41).fillRect(0, 7, 12, 6);
    g.fillStyle(0xffd54f).fillRect(12, 2, 5, 16);
    g.fillStyle(0xe0e6f0).fillTriangle(17, 6, 17, 14, 56, 10);
    g.generateTexture('sword', 56, 20).clear();

    g.fillStyle(0xffffff).fillRect(0, 0, 10, 6);
    g.generateTexture('confetti', 10, 6).clear();

    g.fillStyle(0xffffff).fillCircle(4, 4, 4);
    g.generateTexture('spark', 8, 8).destroy();

    this.scene.start('Lobby');
  }

  /** Un blob avec deux yeux, décliné par type de monstre. */
  private generateMonsters(g: Phaser.GameObjects.Graphics) {
    const blob = (key: string, size: number, color: number, extra?: (c: number, r: number) => void) => {
      const c = size / 2;
      const r = size / 2 - 2;
      g.fillStyle(color).fillCircle(c, c, r);
      const eyeR = r * 0.28;
      const ex = r * 0.38;
      const ey = c - r * 0.15;
      g.fillStyle(0xffffff).fillCircle(c - ex, ey, eyeR).fillCircle(c + ex, ey, eyeR);
      g.fillStyle(0x000000).fillCircle(c - ex + eyeR * 0.3, ey + eyeR * 0.2, eyeR * 0.5).fillCircle(c + ex + eyeR * 0.3, ey + eyeR * 0.2, eyeR * 0.5);
      extra?.(c, r);
      g.generateTexture(key, size, size).clear();
    };
    const teeth = (c: number, r: number) => {
      g.fillStyle(0x000000).fillRect(c - r * 0.5, c + r * 0.3, r, r * 0.3);
      g.fillStyle(0xffffff)
        .fillTriangle(c - r * 0.4, c + r * 0.3, c - r * 0.2, c + r * 0.3, c - r * 0.3, c + r * 0.5)
        .fillTriangle(c + r * 0.2, c + r * 0.3, c + r * 0.4, c + r * 0.3, c + r * 0.3, c + r * 0.5);
    };

    blob('monster-gloubi', 44, 0x8e24aa, teeth);
    blob('monster-fusee', 34, 0xff9800, (c, r) => {
      // Sourcils froncés
      g.lineStyle(3, 0x000000).lineBetween(c - r * 0.7, c - r * 0.55, c - r * 0.1, c - r * 0.3).lineBetween(c + r * 0.7, c - r * 0.55, c + r * 0.1, c - r * 0.3);
    });
    blob('monster-cracheur', 46, 0x43a047, (c, r) => {
      g.fillStyle(0x1b5e20).fillCircle(c, c + r * 0.45, r * 0.25);
      g.fillStyle(0xb2ff59).fillCircle(c + r * 0.1, c + r * 0.75, r * 0.1);
    });
    blob('monster-bombe', 40, 0x37474f, (c, r) => {
      g.fillStyle(0xbcaaa4).fillRect(c - 3, 0, 6, 8);
      g.fillStyle(0xffeb3b).fillCircle(c, 2, 4);
      g.lineStyle(2, 0xff5252).lineBetween(c - r * 0.3, c + r * 0.45, c + r * 0.3, c + r * 0.45);
    });
    blob('monster-spectre', 46, 0xe3f2fd, (c, r) => {
      g.fillStyle(0x263238).fillEllipse(c, c + r * 0.45, r * 0.35, r * 0.5);
    });
    blob('monster-mitose', 62, 0xec407a, (c, r) => {
      g.fillStyle(0xf8bbd0).fillCircle(c, c + r * 0.45, r * 0.22);
    });
    blob('monster-mini', 30, 0xf48fb1);
    blob('boss-gloubi', 140, 0x6a1b9a, (c, r) => {
      teeth(c, r);
      // Couronne
      g.fillStyle(0xffd54f).fillPoints(
        [[c - 34, c - r * 0.55], [c - 34, c - r * 0.95], [c - 17, c - r * 0.75], [c, c - r * 1.02], [c + 17, c - r * 0.75], [c + 34, c - r * 0.95], [c + 34, c - r * 0.55]].map(
          ([x, y]) => new Phaser.Math.Vector2(x, y),
        ),
        true,
      );
      g.fillStyle(0xff5252).fillCircle(c, c - r * 0.68, 5);
    });

    // Reine Givre : bleu glacé, couronne de pics de glace
    blob('boss-givre', 140, 0x4fc3f7, (c, r) => {
      g.fillStyle(0xe1f5fe);
      for (const dx of [-36, -18, 0, 18, 36]) g.fillTriangle(c + dx - 9, c - r * 0.55, c + dx + 9, c - r * 0.55, c + dx, c - r * (dx === 0 ? 1.02 : 0.88));
      g.fillStyle(0x01579b).fillEllipse(c, c + r * 0.45, r * 0.5, r * 0.18);
    });
    // Golem de Lave : roche sombre et fissures incandescentes
    blob('boss-golem', 140, 0x4e342e, (c, r) => {
      g.lineStyle(5, 0xff6d00);
      g.lineBetween(c - r * 0.7, c - r * 0.1, c - r * 0.3, c + r * 0.2).lineBetween(c - r * 0.3, c + r * 0.2, c - r * 0.45, c + r * 0.6);
      g.lineBetween(c + r * 0.6, c - r * 0.5, c + r * 0.35, c - r * 0.1).lineBetween(c + r * 0.35, c - r * 0.1, c + r * 0.7, c + r * 0.3);
      g.fillStyle(0xff6d00).fillRect(c - r * 0.4, c + r * 0.35, r * 0.8, r * 0.18);
      g.fillStyle(0xffd180).fillCircle(c - r * 0.38, c - r * 0.15, 5).fillCircle(c + r * 0.38, c - r * 0.15, 5);
    });
    // Spectre Ancien : pâle, yeux vides, couronne spectrale
    blob('boss-spectre', 140, 0xd1c4e9, (c, r) => {
      g.fillStyle(0x311b92).fillCircle(c - r * 0.38, c - r * 0.15, r * 0.22).fillCircle(c + r * 0.38, c - r * 0.15, r * 0.22);
      g.fillStyle(0xb388ff).fillCircle(c - r * 0.38, c - r * 0.15, 6).fillCircle(c + r * 0.38, c - r * 0.15, 6);
      g.fillStyle(0x311b92).fillEllipse(c, c + r * 0.45, r * 0.35, r * 0.5);
      g.fillStyle(0x7e57c2).fillPoints(
        [[c - 30, c - r * 0.6], [c - 22, c - r * 0.95], [c, c - r * 0.7], [c + 22, c - r * 0.95], [c + 30, c - r * 0.6]].map(([x, y]) => new Phaser.Math.Vector2(x, y)),
        true,
      );
    });

    // Projectiles ennemis
    g.fillStyle(0x76ff03).fillCircle(8, 8, 8);
    g.fillStyle(0x33691e).fillCircle(10, 6, 3);
    g.generateTexture('goo', 16, 16).clear();
    g.fillStyle(0xe040fb).fillCircle(10, 10, 10);
    g.fillStyle(0xffffff).fillCircle(10, 10, 4);
    g.generateTexture('orb', 20, 20).clear();
    g.fillStyle(0xb3e5fc).fillTriangle(0, 3, 16, 0, 16, 6).fillTriangle(16, 0, 20, 3, 16, 6);
    g.generateTexture('shard', 20, 6).clear();
    g.fillStyle(0x5d4037).fillCircle(15, 15, 15);
    g.fillStyle(0xff6d00).fillCircle(11, 12, 4).fillCircle(19, 19, 3);
    g.lineStyle(2, 0x3e2723).strokeCircle(15, 15, 14);
    g.generateTexture('rock', 30, 30).clear();
  }
}

function starPoints(cx: number, cy: number, outer: number, inner: number, n: number) {
  const pts: Phaser.Math.Vector2[] = [];
  for (let i = 0; i < n * 2; i++) {
    const r = i % 2 === 0 ? outer : inner;
    const a = (Math.PI * i) / n - Math.PI / 2;
    pts.push(new Phaser.Math.Vector2(cx + Math.cos(a) * r, cy + Math.sin(a) * r));
  }
  return pts;
}
