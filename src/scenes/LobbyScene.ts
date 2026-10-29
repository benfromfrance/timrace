import Phaser from 'phaser';
import { Sound } from '../audio/Sound';
import { CHALLENGES, Progress } from '../challenges';
import { CHARACTERS } from '../characters';
import { FONT, GAME_HEIGHT, GAME_WIDTH, PLAYER_COLORS, PLAYER_NAMES, css } from '../config';
import { Input, MAX_PLAYERS } from '../input/InputManager';
import { Match } from '../match';
import { Stats } from '../stats';

const TITLE = 'TIMCAR';
const CARD_W = 380;
const CARD_H = 210;
const CARD_Y = 380;
const PARADE_Y = 540;

interface SlotCard {
  root: Phaser.GameObjects.Container;
  empty: Phaser.GameObjects.Container;
  joined: Phaser.GameObjects.Container;
  icon: Phaser.GameObjects.Text;
  label: Phaser.GameObjects.Text;
  wasJoined: boolean;
}

/** Écran d'accueil : rejoindre (Ⓐ), quitter (Ⓑ), lancer (☰ seul, Ⓐ ou ☰ à deux), défis (Ⓨ), statistiques (Ⓧ). */
export class LobbyScene extends Phaser.Scene {
  private cards: SlotCard[] = [];
  private actionHint!: Phaser.GameObjects.Text;
  private padHint!: Phaser.GameObjects.Text;
  private soundHint!: Phaser.GameObjects.Text;
  private starfield: { img: Phaser.GameObjects.Image; speed: number }[] = [];
  private sparks!: Phaser.GameObjects.Particles.ParticleEmitter;
  private leaving = false;

  constructor() {
    super('Lobby');
  }

  create() {
    this.leaving = false;
    this.cameras.main.fadeIn(400, 5, 6, 12);
    Sound.playMusic('menu');

    this.buildBackground();
    this.buildParade();
    this.buildTitle();
    this.buildChallengesBadge();

    this.sparks = this.add
      .particles(0, 0, 'spark', {
        speed: { min: 100, max: 320 },
        lifespan: 600,
        scale: { start: 1.2, end: 0 },
        emitting: false,
      })
      .setDepth(20);

    this.cards = Array.from({ length: MAX_PLAYERS }, (_, i) => this.buildCard(i, GAME_WIDTH / 2 + (i === 0 ? -260 : 260)));

    // Bandeau de consignes
    this.add.graphics().fillStyle(0x0b0d18, 0.75).fillRoundedRect(GAME_WIDTH / 2 - 420, 600, 840, 74, 37).setDepth(5);
    this.actionHint = this.add
      .text(GAME_WIDTH / 2, 624, '', { fontFamily: FONT, fontSize: '24px', fontStyle: 'bold', color: '#ffffff' })
      .setOrigin(0.5)
      .setDepth(6);
    this.padHint = this.add.text(GAME_WIDTH / 2, 655, '', { fontFamily: FONT, fontSize: '17px', color: '#9aa0b4' }).setOrigin(0.5).setDepth(6);
    this.soundHint = this.add.text(GAME_WIDTH / 2, GAME_HEIGHT - 18, '', { fontFamily: FONT, fontSize: '17px', color: '#c5cae9' }).setOrigin(0.5).setDepth(6);

    const off = Input.onChange(() => this.refresh());
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, off);
    this.refresh();
  }

  update(_time: number, delta: number) {
    // Défilement du champ d'étoiles (parallaxe : les plus grosses vont plus vite)
    for (const s of this.starfield) {
      s.img.y += (s.speed * delta) / 1000;
      if (s.img.y > GAME_HEIGHT + 4) {
        s.img.y = -4;
        s.img.x = Phaser.Math.Between(0, GAME_WIDTH);
      }
    }

    Input.update(this.game.loop.frame);
    if (this.leaving) return;

    // Seuls les joueurs déjà présents avant cette frame peuvent lancer : le Ⓐ qui fait rejoindre ne lance pas
    const starters = Input.slots.filter((s) => s !== null);

    this.soundHint.setText(
      !Sound.unlocked
        ? '🔇 Cliquez dans la page ou appuyez sur une touche du clavier pour activer le son'
        : Sound.isMuted
          ? '🔇 Son coupé (M pour le remettre)'
          : '🔊 M : couper le son',
    );

    if (Input.any((s) => s.state.powerPressed)) {
      Sound.sfx('uiConfirm');
      this.leaveTo('Challenges');
      return;
    }
    if (Input.any((s) => s.state.firePressed)) {
      Sound.sfx('uiConfirm');
      this.leaveTo('Stats');
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
      this.leaveTo('CharacterSelect');
    }
  }

  private leaveTo(scene: string) {
    this.leaving = true;
    this.cameras.main.fadeOut(250, 5, 6, 12);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => this.scene.start(scene));
  }

  // ─── Décor ───────────────────────────────────────────────────────────

  private buildBackground() {
    // Ciel nocturne en dégradé
    this.add.graphics().fillGradientStyle(0x0b0e24, 0x0b0e24, 0x241133, 0x2a0f22, 1).fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    // Nébuleuses qui respirent
    const nebulae: [number, number, number, number][] = [
      [220, 160, 260, 0x4fc3f7],
      [1080, 220, 300, 0xce93d8],
      [640, 620, 360, 0xff7043],
    ];
    for (const [x, y, r, color] of nebulae) {
      const n = this.add.circle(x, y, r, color, 0.07).setBlendMode(Phaser.BlendModes.ADD);
      this.tweens.add({
        targets: n,
        scale: { from: 0.9, to: 1.15 },
        alpha: { from: 0.6, to: 1 },
        duration: Phaser.Math.Between(3500, 5000),
        yoyo: true,
        repeat: -1,
        ease: 'Sine.InOut',
      });
    }

    // Champ d'étoiles scintillant
    this.starfield = Array.from({ length: 90 }, () => {
      const scale = Phaser.Math.FloatBetween(0.15, 0.6);
      const img = this.add
        .image(Phaser.Math.Between(0, GAME_WIDTH), Phaser.Math.Between(0, GAME_HEIGHT), 'spark')
        .setScale(scale)
        .setAlpha(Phaser.Math.FloatBetween(0.3, 0.9));
      this.tweens.add({ targets: img, alpha: 0.1, duration: Phaser.Math.Between(800, 2200), yoyo: true, repeat: -1, delay: Phaser.Math.Between(0, 2000) });
      return { img, speed: 8 + scale * 40 };
    });

    // Étoiles du jeu qui flottent en tournant
    for (let i = 0; i < 7; i++) {
      const star = this.add
        .image(Phaser.Math.Between(60, GAME_WIDTH - 60), Phaser.Math.Between(60, 500), 'star')
        .setAlpha(0.25)
        .setScale(Phaser.Math.FloatBetween(0.6, 1.2));
      this.tweens.add({ targets: star, y: star.y - Phaser.Math.Between(15, 35), duration: Phaser.Math.Between(2000, 3500), yoyo: true, repeat: -1, ease: 'Sine.InOut' });
      this.tweens.add({ targets: star, angle: 360, duration: Phaser.Math.Between(6000, 12000), repeat: -1 });
    }
  }

  /** Les personnages traversent l'écran en courant, poursuivis par des monstres. */
  private buildParade() {
    // Sol lumineux sous le défilé
    this.add.rectangle(GAME_WIDTH / 2, PARADE_Y + 30, GAME_WIDTH, 2, 0xffffff, 0.12);

    const parade = this.add.container(-700, PARADE_Y);
    CHARACTERS.forEach((c, i) => {
      const runner = this.add.container(620 - i * 70, 0, [
        this.add.image(0, 0, 'player').setTint(c.color).setScale(0.8),
        this.add.image(0, 0, 'ring').setTint(c.color).setScale(0.75).setAlpha(0.8),
        this.add.text(0, 0, c.emoji, { fontSize: '20px' }).setOrigin(0.5),
      ]);
      parade.add(runner);
      this.tweens.add({ targets: runner, y: -12, duration: 170 + i * 12, yoyo: true, repeat: -1, ease: 'Quad.Out', delay: i * 60 });
    });
    (['monster-fusee', 'monster-gloubi', 'monster-mitose'] as const).forEach((key, i) => {
      const monster = this.add.image(120 - i * 85, 0, key).setScale(key === 'monster-mitose' ? 0.8 : 1);
      parade.add(monster);
      this.tweens.add({ targets: monster, y: -6, scaleX: monster.scaleX * 1.08, duration: 220 + i * 30, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
    });
    this.tweens.add({ targets: parade, x: GAME_WIDTH + 120, duration: 13000, repeat: -1, repeatDelay: 1500 });
  }

  private buildTitle() {
    const colors = CHARACTERS.map((c) => c.color);
    const spacing = 92;
    const startX = GAME_WIDTH / 2 - ((TITLE.length - 1) * spacing) / 2;
    [...TITLE].forEach((letter, i) => {
      const t = this.add
        .text(startX + i * spacing, -120, letter, {
          fontFamily: FONT,
          fontSize: '120px',
          fontStyle: 'bold',
          color: css(colors[i % colors.length]),
          stroke: '#0b0d18',
          strokeThickness: 14,
        })
        .setOrigin(0.5)
        .setShadow(0, 8, '#000000', 0, true, true);
      // Chute avec rebond, puis ondulation continue
      this.tweens.add({
        targets: t,
        y: 125,
        duration: 700,
        delay: 150 + i * 90,
        ease: 'Bounce.Out',
        onComplete: () => {
          this.tweens.add({ targets: t, y: 113, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.InOut', delay: i * 120 });
          this.tweens.add({ targets: t, angle: { from: -4, to: 4 }, duration: 1300, yoyo: true, repeat: -1, ease: 'Sine.InOut', delay: i * 150 });
        },
      });
    });

    const tagline = this.add
      .text(GAME_WIDTH / 2, 218, '⚔️ Duel   ·   🤝 Coopération   ·   🦸 Solo', { fontFamily: FONT, fontSize: '26px', fontStyle: 'bold', color: '#e8eaf6' })
      .setOrigin(0.5)
      .setAlpha(0);
    this.tweens.add({ targets: tagline, alpha: 1, y: 210, duration: 600, delay: 900 });
  }

  private buildChallengesBadge() {
    const badge = this.add.container(GAME_WIDTH - 130, 40, [
      this.add
        .graphics()
        .fillStyle(0x0b0d18, 0.8)
        .fillRoundedRect(-110, -24, 220, 48, 24)
        .lineStyle(2, 0xffd54f)
        .strokeRoundedRect(-110, -24, 220, 48, 24),
      this.add
        .text(0, 0, `🏆 ${Progress.doneCount}/${CHALLENGES.length}   Ⓨ Défis`, { fontFamily: FONT, fontSize: '20px', fontStyle: 'bold', color: '#ffd54f' })
        .setOrigin(0.5),
    ]);
    this.tweens.add({ targets: badge, scale: 1.06, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.InOut' });

    this.add.container(130, 40, [
      this.add
        .graphics()
        .fillStyle(0x0b0d18, 0.8)
        .fillRoundedRect(-110, -24, 220, 48, 24)
        .lineStyle(2, 0x4fc3f7)
        .strokeRoundedRect(-110, -24, 220, 48, 24),
      this.add.text(0, 0, `📊 ${Stats.summary.games} parties   Ⓧ Stats`, { fontFamily: FONT, fontSize: '19px', fontStyle: 'bold', color: '#4fc3f7' }).setOrigin(0.5),
    ]);
  }

  // ─── Cartes joueur ───────────────────────────────────────────────────

  private buildCard(i: number, x: number): SlotCard {
    const color = PLAYER_COLORS[i];
    const bg = this.add
      .graphics()
      .fillStyle(0x12152a, 0.85)
      .fillRoundedRect(-CARD_W / 2, -CARD_H / 2, CARD_W, CARD_H, 22)
      .lineStyle(3, color, 0.9)
      .strokeRoundedRect(-CARD_W / 2, -CARD_H / 2, CARD_W, CARD_H, 22);
    const header = this.add
      .text(0, -CARD_H / 2 + 28, PLAYER_NAMES[i].toUpperCase(), { fontFamily: FONT, fontSize: '24px', fontStyle: 'bold', color: css(color) })
      .setOrigin(0.5);

    // Place libre : bouton Ⓐ (vert, comme sur la manette Xbox) qui pulse
    const aButton = this.add.container(0, 0, [
      this.add.circle(0, 0, 34, 0x43a047).setStrokeStyle(4, 0xa5d6a7),
      this.add.text(0, 1, 'A', { fontFamily: FONT, fontSize: '38px', fontStyle: 'bold', color: '#ffffff' }).setOrigin(0.5),
    ]);
    this.tweens.add({ targets: aButton, scale: 1.15, duration: 600, yoyo: true, repeat: -1, ease: 'Sine.InOut', delay: i * 300 });
    const empty = this.add.container(0, 0, [
      aButton,
      this.add.text(0, 58, 'Appuie pour rejoindre', { fontFamily: FONT, fontSize: '20px', color: '#c5cae9' }).setOrigin(0.5),
      this.add.text(0, 82, 'clavier : Espace ou Entrée', { fontFamily: FONT, fontSize: '15px', color: '#7986cb' }).setOrigin(0.5),
    ]);

    // Place prise : périphérique + statut
    const icon = this.add.text(0, -8, '🎮', { fontSize: '56px' }).setOrigin(0.5);
    const label = this.add.text(0, 44, '', { fontFamily: FONT, fontSize: '19px', color: '#ffffff' }).setOrigin(0.5);
    const joined = this.add.container(0, 0, [
      icon,
      label,
      this.add.text(0, 76, '✔ Prêt   ·   Ⓑ quitter', { fontFamily: FONT, fontSize: '17px', fontStyle: 'bold', color: '#9ccc65' }).setOrigin(0.5),
    ]);
    this.tweens.add({ targets: icon, angle: { from: -6, to: 6 }, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.InOut' });

    const root = this.add.container(x, CARD_Y + 40, [bg, header, empty, joined]).setAlpha(0).setDepth(10);
    this.tweens.add({ targets: root, alpha: 1, y: CARD_Y, duration: 500, delay: 600 + i * 150, ease: 'Back.Out' });
    return { root, empty, joined, icon, label, wasJoined: false };
  }

  private refresh() {
    Input.slots.forEach((source, i) => {
      const card = this.cards[i];
      const isJoined = source !== null;
      card.empty.setVisible(!isJoined);
      card.joined.setVisible(isJoined);
      if (source) {
        card.icon.setText(source.id.startsWith('kb') ? '⌨️' : '🎮');
        card.label.setText(source.label);
      }
      if (isJoined !== card.wasJoined) {
        if (isJoined) {
          // Petit saut et étincelles à l'arrivée d'un joueur
          this.tweens.add({ targets: card.root, scale: { from: 1.12, to: 1 }, duration: 350, ease: 'Back.Out' });
          this.sparks.setParticleTint(PLAYER_COLORS[i]).explode(28, card.root.x, CARD_Y);
        } else {
          this.tweens.add({ targets: card.root, x: card.root.x + 10, duration: 50, yoyo: true, repeat: 3 });
        }
        card.wasJoined = isJoined;
      }
    });

    const count = Input.joinedCount;
    this.actionHint.setText(
      count === 2
        ? 'Ⓐ ou ☰ : C’EST PARTI !'
        : count === 1
          ? '☰ jouer seul   ·   ou attends le 2e joueur'
          : 'Appuie sur Ⓐ pour rejoindre la partie',
    );
    this.actionHint.setColor(count === 2 ? '#ffd54f' : '#ffffff');
    this.tweens.killTweensOf(this.actionHint);
    this.actionHint.setScale(1);
    if (count === 2) this.tweens.add({ targets: this.actionHint, scale: 1.08, duration: 450, yoyo: true, repeat: -1, ease: 'Sine.InOut' });

    const pads = Input.connectedPadCount;
    this.padHint.setText(
      (pads === 0
        ? 'Aucune manette détectée : branche une manette Xbox et appuie sur un bouton'
        : `🎮 ${pads} manette${pads > 1 ? 's' : ''} détectée${pads > 1 ? 's' : ''}`) + '   ·   au clavier, ☰ = R ou Retour arrière',
    );
  }
}
