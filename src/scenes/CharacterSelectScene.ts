import Phaser from 'phaser';
import { Sound } from '../audio/Sound';
import { Progress } from '../challenges';
import { CHARACTERS } from '../characters';
import { FONT, GAME_HEIGHT, GAME_WIDTH, PLAYER_COLORS, PLAYER_NAMES, css } from '../config';
import { Input } from '../input/InputManager';
import { Match } from '../match';

interface Panel {
  avatar: Phaser.GameObjects.Image;
  ring: Phaser.GameObjects.Image;
  emoji: Phaser.GameObjects.Text;
  name: Phaser.GameObjects.Text;
  trait: Phaser.GameObjects.Text;
  power: Phaser.GameObjects.Text;
  description: Phaser.GameObjects.Text;
  status: Phaser.GameObjects.Text;
  icons: Phaser.GameObjects.Text[];
  cursor: Phaser.GameObjects.Image;
}

/** Chaque joueur choisit son personnage (◀ ▶) et valide avec Ⓐ. */
export class CharacterSelectScene extends Phaser.Scene {
  private choice: number[] = [];
  private ready: boolean[] = [];
  private panels: Panel[] = [];

  constructor() {
    super('CharacterSelect');
  }

  create() {
    this.choice = Match.characters.map((c) => CHARACTERS.indexOf(c));
    Sound.playMusic('menu');
    const n = Match.playerCount;
    this.ready = Array(n).fill(false);

    this.add
      .text(GAME_WIDTH / 2, 50, 'Choisissez votre personnage', { fontFamily: FONT, fontSize: '44px', fontStyle: 'bold', color: '#ffffff' })
      .setOrigin(0.5);
    if (n > 1) this.add.rectangle(GAME_WIDTH / 2, GAME_HEIGHT / 2 + 30, 2, GAME_HEIGHT - 160, 0x2a2f45);

    // Seul : un panneau centré ; à deux : un panneau par moitié d'écran
    const panelX = (i: number) => (n === 1 ? GAME_WIDTH / 2 : i === 0 ? GAME_WIDTH * 0.25 : GAME_WIDTH * 0.75);
    this.panels = Array.from({ length: n }, (_, i) => this.buildPanel(i, panelX(i)));
    for (let i = 0; i < n; i++) this.refresh(i);
  }

  update() {
    Input.update(this.game.loop.frame);
    if (!Input.hasPlayers(Match.playerCount)) {
      this.scene.start('Lobby'); // une manette a été débranchée
      return;
    }

    Input.slots.slice(0, Match.playerCount).forEach((source, i) => {
      if (!source) return;
      const s = source.state;
      if (!this.ready[i]) {
        if (s.navX !== 0) {
          this.choice[i] = (this.choice[i] + s.navX + CHARACTERS.length) % CHARACTERS.length;
          source.rumble(0.15, 30);
          Sound.sfx('uiMove');
          this.refresh(i, true);
        }
        if (s.actionPressed) {
          if (!Progress.isUnlocked('character', CHARACTERS[this.choice[i]].id)) {
            Sound.sfx('uiError'); // personnage verrouillé
            source.rumble(0.4, 200);
            this.tweens.add({ targets: this.panels[i].emoji, x: '+=8', duration: 50, yoyo: true, repeat: 3 });
            return;
          }
          this.ready[i] = true;
          source.rumble(0.5, 120);
          Sound.sfx('uiConfirm');
          this.refresh(i);
        } else if (s.backPressed) {
          Sound.sfx('uiBack');
          this.scene.start('Lobby');
        }
      } else if (s.backPressed) {
        this.ready[i] = false;
        Sound.sfx('uiBack');
        this.refresh(i);
      }
    });

    if (this.ready.every(Boolean)) {
      Match.characters = this.choice.map((c) => CHARACTERS[c]);
      this.scene.start('MatchSetup');
    }
  }

  private buildPanel(i: number, x: number): Panel {
    const color = css(PLAYER_COLORS[i]);
    this.add.text(x, 120, PLAYER_NAMES[i], { fontFamily: FONT, fontSize: '30px', fontStyle: 'bold', color }).setOrigin(0.5);

    const avatar = this.add.image(x, 230, 'player').setScale(2.4);
    const ring = this.add.image(x, 230, 'ring').setScale(2.15).setTint(PLAYER_COLORS[i]);
    const emoji = this.add.text(x, 230, '', { fontSize: '56px' }).setOrigin(0.5);
    this.add.text(x - 150, 230, '◀', { fontFamily: FONT, fontSize: '40px', color }).setOrigin(0.5);
    this.add.text(x + 150, 230, '▶', { fontFamily: FONT, fontSize: '40px', color }).setOrigin(0.5);

    const name = this.add.text(x, 330, '', { fontFamily: FONT, fontSize: '40px', fontStyle: 'bold', color: '#ffffff' }).setOrigin(0.5);
    const trait = this.add.text(x, 372, '', { fontFamily: FONT, fontSize: '20px', fontStyle: 'italic', color: '#9aa0b4' }).setOrigin(0.5);
    const power = this.add.text(x, 418, '', { fontFamily: FONT, fontSize: '26px', fontStyle: 'bold', color: '#ffd54f' }).setOrigin(0.5);
    const description = this.add
      .text(x, 450, '', { fontFamily: FONT, fontSize: '20px', color: '#d0d4e4', align: 'center', wordWrap: { width: 460 } })
      .setOrigin(0.5, 0);

    // Bandeau de tous les personnages, le choix courant entouré
    const spacing = 62;
    const startX = x - ((CHARACTERS.length - 1) * spacing) / 2;
    const cursor = this.add.image(0, 560, 'ring').setTint(PLAYER_COLORS[i]);
    const icons = CHARACTERS.map((c, k) => this.add.text(startX + k * spacing, 560, c.emoji, { fontSize: '30px' }).setOrigin(0.5));

    const status = this.add.text(x, 640, '', { fontFamily: FONT, fontSize: '24px', fontStyle: 'bold', align: 'center' }).setOrigin(0.5);
    return { avatar, ring, emoji, name, trait, power, description, status, icons, cursor };
  }

  private refresh(i: number, animate = false) {
    const p = this.panels[i];
    const c = CHARACTERS[this.choice[i]];
    const lock = Progress.isUnlocked('character', c.id) ? undefined : Progress.lockFor('character', c.id);
    if (lock) {
      p.avatar.setTint(0x3a3f55);
      p.emoji.setText('🔒');
      p.name.setText('???');
      p.trait.setText('Personnage verrouillé');
      p.power.setText(`Défi : ${lock.name}`);
      p.description.setText(lock.description);
    } else {
      p.avatar.setTint(c.color);
      p.emoji.setText(c.emoji);
      p.name.setText(c.name);
      p.trait.setText(c.trait);
      p.power.setText(`Ⓨ ${c.power.name}`);
      p.description.setText(`${c.power.description}\n(recharge ${c.power.cooldownMs / 1000} s)`);
    }
    p.icons.forEach((icon, k) => {
      const unlocked = Progress.isUnlocked('character', CHARACTERS[k].id);
      icon.setText(unlocked ? CHARACTERS[k].emoji : '🔒').setAlpha(k === this.choice[i] ? 1 : 0.4);
    });
    p.cursor.setX(p.icons[this.choice[i]].x);

    if (this.ready[i]) {
      p.status.setText('✔ PRÊT !\n(Ⓑ pour changer)').setColor('#9ccc65');
      this.tweens.add({ targets: [p.avatar, p.ring, p.emoji], scale: (t: Phaser.GameObjects.Image) => t.scale * 1.12, duration: 120, yoyo: true });
    } else {
      p.status.setText('◀ ▶ choisir  ·  Ⓐ valider').setColor('#ffffff');
    }
    if (animate) this.tweens.add({ targets: [p.avatar, p.emoji], angle: { from: -12, to: 0 }, duration: 200, ease: 'Back.Out' });
  }
}
