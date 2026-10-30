import Phaser from 'phaser';
import { Sound } from '../audio/Sound';
import { FONT, GAME_HEIGHT, GAME_WIDTH } from '../config';
import { Input } from '../input/InputManager';
import type { Ghost, KeyMoment, ReplayFrame } from '../replay';

export interface ReplayData {
  frames: ReplayFrame[];
  key: KeyMoment;
  /** Tampon final : « K.O. ! », « BOSS VAINCU ! »… */
  stamp: string;
  stampColor: string;
  /** Appelé à la fin (ou si on passe le replay) : la partie enchaîne sur le podium. */
  onDone: () => void;
}

const REWIND_MS = 700;
const SPEED = 0.5;
const BULLET_SPEED = 0.15;
/** Fenêtre autour du moment fort jouée en « bullet time ». */
const BULLET_WINDOW_MS = 350;
const ECHOES = [12, 8, 4]; // décalages (en images) des traînées, de la plus ancienne à la plus récente
const BAR_H = 70;
/** Ⓐ sert aussi au dash : on ne l'accepte pour passer qu'après ce délai (☰ marche tout de suite). */
const SKIP_WITH_A_AFTER_MS = 1200;
/** Le tampon final arrive quand l'explosion est à son maximum. */
const STAMP_DELAY_MS = 350;

type Phase = 'rewind' | 'play' | 'finale' | 'done';

/**
 * Action replay des dernières secondes, rejoué par-dessus l'arène figée :
 * rembobinage VHS, ralenti cinéma avec traînées, bullet time sur le moment fort, puis tampon final.
 */
export class ReplayScene extends Phaser.Scene {
  private replay!: ReplayData;
  private phase: Phase = 'rewind';
  private phaseStart = 0;
  private startedAt = 0;
  private replayT = 0;
  private bulletTime = false;
  /** Caméra virtuelle partagée par cette scène et la partie (zoom, centre, rotation). */
  private cam = { zoom: 1, x: GAME_WIDTH / 2, y: GAME_HEIGHT / 2, rot: 0 };

  private world!: Phaser.GameObjects.Container;
  private images: Phaser.GameObjects.Image[] = [];
  private texts: Phaser.GameObjects.Text[] = [];
  private usedImages = 0;
  private usedTexts = 0;

  private ui!: Phaser.GameObjects.Container;
  private speedLines!: Phaser.GameObjects.Graphics;
  private scanlines!: Phaser.GameObjects.TileSprite;
  private recDot!: Phaser.GameObjects.Arc;
  private label!: Phaser.GameObjects.Text;
  private timecode!: Phaser.GameObjects.Text;
  private speedLabel!: Phaser.GameObjects.Text;

  constructor() {
    super('Replay');
  }

  create(data: ReplayData) {
    this.replay = data;
    this.images = [];
    this.texts = [];
    this.bulletTime = false;
    this.startedAt = this.time.now;
    this.cam = { zoom: 1, x: GAME_WIDTH / 2, y: GAME_HEIGHT / 2, rot: 0 };
    if (data.frames.length < 2) {
      this.finish();
      return;
    }
    Sound.playMusic(null);
    Sound.sfx('rewind');

    this.world = this.add.container(0, 0);
    this.buildUi();
    // Deux caméras : l'une zoome sur le jeu rejoué, l'autre garde l'habillage fixe à l'écran
    const uiCam = this.cameras.add(0, 0, GAME_WIDTH, GAME_HEIGHT);
    uiCam.ignore(this.world);
    this.cameras.main.ignore(this.ui);

    this.setPhase('rewind');
  }

  update(time: number, delta: number) {
    if (this.phase === 'done') return;
    Input.update(this.game.loop.frame);
    // ☰ ou Ⓐ : passer le replay
    const canSkipWithA = time - this.startedAt > SKIP_WITH_A_AFTER_MS;
    if (Input.slots.some((s) => s?.state.startPressed || (canSkipWithA && s?.state.actionPressed))) {
      this.finish();
      return;
    }

    const frames = this.replay.frames;
    const first = frames[0].t;
    const last = frames[frames.length - 1].t;
    this.scanlines.tilePositionY += delta * 0.05;
    this.recDot.setVisible(Math.floor(time / 400) % 2 === 0);

    if (this.phase === 'rewind') {
      // Les images défilent à l'envers à toute vitesse, avec des parasites horizontaux
      const p = Math.min(1, (time - this.phaseStart) / REWIND_MS);
      this.renderAt(first + (last - first) * (1 - p), false);
      this.world.x = Phaser.Math.Between(-8, 8);
      if (p >= 1) {
        this.world.x = 0;
        this.replayT = first;
        this.setPhase('play');
      }
    } else if (this.phase === 'play') {
      const key = this.replay.key;
      const inBullet = Math.abs(this.replayT - key.t) < BULLET_WINDOW_MS;
      if (inBullet && !this.bulletTime) this.enterBulletTime();
      this.bulletTime = inBullet;
      this.replayT += delta * (inBullet ? BULLET_SPEED : SPEED);

      // La caméra se rapproche du moment fort, beaucoup plus en bullet time
      const targetZoom = inBullet ? 1.9 : 1.25;
      const follow = inBullet ? 0.12 : 0.03;
      this.cam.zoom += (targetZoom - this.cam.zoom) * 0.06;
      this.cam.x += (key.x - this.cam.x) * follow;
      this.cam.y += (key.y - this.cam.y) * follow;
      this.cam.rot = Math.sin(time / 900) * 0.02;

      this.speedLabel.setText(inBullet ? `×${BULLET_SPEED}  BULLET TIME` : `×${SPEED}`).setColor(inBullet ? '#ff5252' : '#ffffff');
      this.drawSpeedLines(inBullet);
      this.timecode.setText(`00:0${((this.replayT - first) / 1000).toFixed(2)}`);
      this.renderAt(this.replayT, true);
      if (this.replayT >= last) this.setPhase('finale');
    }
    this.applyCamera();
  }

  // ─── Phases ──────────────────────────────────────────────────────────

  private setPhase(phase: Phase) {
    this.phase = phase;
    this.phaseStart = this.time.now;
    if (phase === 'play') {
      this.label.setText('● REPLAY');
    } else if (phase === 'finale') {
      this.finale();
    }
  }

  private enterBulletTime() {
    Sound.sfx('slowmo');
    this.cameras.main.flash(120, 255, 255, 255);
    this.tweens.add({ targets: this.speedLabel, scale: { from: 1.6, to: 1 }, duration: 300, ease: 'Back.Out' });
  }

  /** Image figée finale : flash, zoom percutant, étincelles et tampon. */
  private finale() {
    const { key, stamp, stampColor } = this.replay;
    this.renderAt(this.replay.frames[this.replay.frames.length - 1].t, false);
    this.speedLines.clear();
    this.speedLabel.setText('■ PAUSE').setColor('#ffd54f');
    // Zoom percutant (un peu moins serré qu'avant, pour que l'explosion tienne à l'écran)
    this.tweens.add({ targets: this.cam, zoom: 1.8, rot: -0.06, x: key.x, y: key.y, duration: 320, ease: 'Back.Out' });
    this.bigExplosion(key.x, key.y);

    // Lignes d'impact en étoile + tampon qui s'écrase
    const rays = this.add.graphics();
    this.ui.add(rays);
    rays.lineStyle(6, 0xffffff, 0.8);
    for (let i = 0; i < 24; i++) {
      const a = (i / 24) * Math.PI * 2;
      rays.lineBetween(GAME_WIDTH / 2 + Math.cos(a) * 220, GAME_HEIGHT / 2 + Math.sin(a) * 220, GAME_WIDTH / 2 + Math.cos(a) * 900, GAME_HEIGHT / 2 + Math.sin(a) * 900);
    }
    rays.setAlpha(0);
    this.tweens.add({ targets: rays, alpha: { from: 1, to: 0 }, duration: 700, delay: STAMP_DELAY_MS });

    const text = this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT / 2, stamp, {
        fontFamily: FONT,
        fontSize: '120px',
        fontStyle: 'bold',
        color: stampColor,
        stroke: '#000000',
        strokeThickness: 16,
      })
      .setOrigin(0.5)
      .setShadow(0, 10, '#000000', 0, true, true)
      .setScale(4)
      .setAlpha(0)
      .setAngle(-25);
    this.ui.add(text);
    // Le tampon s'écrase quand l'explosion est à son maximum
    this.tweens.add({ targets: text, scale: 1, alpha: 1, angle: -8, duration: 380, delay: STAMP_DELAY_MS, ease: 'Back.Out' });
    this.tweens.add({ targets: text, scale: 1.08, duration: 500, yoyo: true, repeat: 2, delay: STAMP_DELAY_MS + 400, ease: 'Sine.InOut' });

    // Retour en douceur vers le podium
    this.time.delayedCall(2600, () => {
      this.tweens.add({ targets: this.cam, zoom: 1, rot: 0, x: GAME_WIDTH / 2, y: GAME_HEIGHT / 2, duration: 450, ease: 'Cubic.InOut' });
      this.tweens.add({ targets: [text, this.world], alpha: 0, duration: 400 });
      this.time.delayedCall(450, () => this.finish());
    });
  }

  /** Grosse explosion en plusieurs couches au point d'impact (dans le monde rejoué, donc zoomée). */
  private bigExplosion(x: number, y: number) {
    const fire = [0xffffff, 0xffeb3b, 0xff9800, 0xff3d00];
    Sound.sfx('impact');
    this.time.delayedCall(90, () => Sound.sfx('explosion'));

    const gameCam = this.scene.get('Game').cameras.main;
    for (const cam of [this.cameras.main, gameCam]) {
      cam.flash(450, 255, 190, 90);
      cam.shake(900, 0.022);
    }

    // 1. Boule de feu : couches lumineuses qui gonflent puis se dissipent
    fire.forEach((color, i) => {
      const core = this.add.circle(x, y, 40 + i * 18, color, 0.9).setBlendMode(Phaser.BlendModes.ADD).setScale(0.2);
      this.world.add(core);
      this.tweens.add({ targets: core, scale: 3 + i * 0.4, alpha: 0, duration: 320 + i * 140, ease: 'Cubic.Out', onComplete: () => core.destroy() });
    });

    // 2. Ondes de choc successives
    for (let i = 0; i < 3; i++) {
      const ring = this.add.circle(x, y, 50).setStrokeStyle(10 - i * 2, i === 0 ? 0xffffff : 0xffd54f, 1).setScale(0.2);
      this.world.add(ring);
      this.tweens.add({ targets: ring, scale: 6 + i, alpha: 0, duration: 500 + i * 200, delay: i * 120, ease: 'Cubic.Out', onComplete: () => ring.destroy() });
    }

    // 3. Débris : étincelles et éclats de roche projetés qui retombent
    const sparks = this.add.particles(x, y, 'spark', {
      speed: { min: 300, max: 950 },
      lifespan: 1300,
      gravityY: 700,
      scale: { start: 1.8, end: 0 },
      tint: fire,
      blendMode: Phaser.BlendModes.ADD,
      emitting: false,
    });
    const debris = this.add.particles(x, y, 'rock', {
      speed: { min: 200, max: 650 },
      lifespan: 1400,
      gravityY: 900,
      rotate: { min: 0, max: 360 },
      scale: { min: 0.15, max: 0.45 },
      emitting: false,
    });
    this.world.add([sparks, debris]);
    sparks.explode(140);
    debris.explode(24);

    // 4. Explosions secondaires en chaîne autour du point d'impact
    for (let i = 0; i < 6; i++) {
      this.time.delayedCall(120 + i * 90, () => {
        const a = Math.random() * Math.PI * 2;
        const d = Phaser.Math.Between(50, 150);
        const bx = x + Math.cos(a) * d;
        const by = y + Math.sin(a) * d;
        const blast = this.add.circle(bx, by, 30, Phaser.Utils.Array.GetRandom(fire), 0.9).setBlendMode(Phaser.BlendModes.ADD).setScale(0.3);
        this.world.add(blast);
        this.tweens.add({ targets: blast, scale: 2.2, alpha: 0, duration: 380, ease: 'Cubic.Out', onComplete: () => blast.destroy() });
        sparks.explode(18, bx - x, by - y);
        if (i % 2 === 0) Sound.sfx('explosion');
      });
    }

    // 5. Fumée qui monte et se dissipe
    for (let i = 0; i < 12; i++) {
      const smoke = this.add
        .circle(x + Phaser.Math.Between(-60, 60), y + Phaser.Math.Between(-40, 40), Phaser.Math.Between(25, 45), 0x37474f, 0.6)
        .setScale(0.4)
        .setAlpha(0);
      this.world.add(smoke);
      this.tweens.add({
        targets: smoke,
        scale: Phaser.Math.FloatBetween(2, 3.2),
        alpha: { from: 0.55, to: 0 },
        y: smoke.y - Phaser.Math.Between(60, 140),
        duration: Phaser.Math.Between(1200, 1800),
        delay: 200 + i * 40,
        ease: 'Sine.Out',
        onComplete: () => smoke.destroy(),
      });
    }
  }

  private finish() {
    if (this.phase === 'done') return;
    this.phase = 'done';
    const gameCam = this.scene.get('Game').cameras.main;
    gameCam.setZoom(1).setRotation(0).centerOn(GAME_WIDTH / 2, GAME_HEIGHT / 2);
    this.replay.onDone();
    this.scene.stop();
  }

  /** Applique la caméra virtuelle à cette scène et à la partie, pour que l'arène suive le zoom. */
  private applyCamera() {
    for (const cam of [this.cameras.main, this.scene.get('Game').cameras.main]) {
      cam.setZoom(this.cam.zoom).setRotation(this.cam.rot).centerOn(this.cam.x, this.cam.y);
    }
  }

  // ─── Rendu des images enregistrées ───────────────────────────────────

  /** Affiche l'image enregistrée la plus proche de `t`, avec des traînées si demandé. */
  private renderAt(t: number, echoes: boolean) {
    const frames = this.replay.frames;
    let idx = frames.length - 1;
    while (idx > 0 && frames[idx].t > t) idx--;
    this.usedImages = 0;
    this.usedTexts = 0;
    if (echoes) {
      ECHOES.forEach((offset, k) => {
        if (idx - offset >= 0) this.drawFrame(frames[idx - offset], 0.12 + k * 0.08, true);
      });
    }
    this.drawFrame(frames[idx], 1, false);
    for (let i = this.usedImages; i < this.images.length; i++) this.images[i].setVisible(false);
    for (let i = this.usedTexts; i < this.texts.length; i++) this.texts[i].setVisible(false);
  }

  private drawFrame(frame: ReplayFrame, alpha: number, echo: boolean) {
    for (const g of frame.ghosts) {
      if (g.text !== undefined) {
        if (!echo) this.drawText(g);
      } else {
        this.drawImage(g, alpha, echo);
      }
    }
  }

  private drawImage(g: Ghost, alpha: number, echo: boolean) {
    let img = this.images[this.usedImages];
    if (!img) {
      img = this.add.image(0, 0, g.key!);
      this.world.add(img);
      this.images.push(img);
    }
    this.usedImages++;
    if (img.texture.key !== g.key) img.setTexture(g.key!);
    img.setVisible(true).setPosition(g.x, g.y).setRotation(g.rotation).setScale(g.scaleX, g.scaleY).setFlipX(g.flipX).setAlpha(g.alpha * alpha);
    if (echo) img.setTintMode(Phaser.TintModes.FILL).setTint(0x80d8ff); // traînée lumineuse
    else if (g.fill) img.setTintMode(Phaser.TintModes.FILL).setTint(g.tint);
    else img.setTintMode(Phaser.TintModes.MULTIPLY).setTint(g.tint);
  }

  private drawText(g: Ghost) {
    let txt = this.texts[this.usedTexts];
    if (!txt) {
      txt = this.add.text(0, 0, '').setOrigin(0.5);
      this.world.add(txt);
      this.texts.push(txt);
    }
    this.usedTexts++;
    // Ne refait le rendu du texte que si son style change (coûteux)
    const style = `${g.fontSize}|${g.color}|${g.stroke}|${g.strokeThickness}`;
    if (txt.name !== style) {
      txt.setStyle({ fontFamily: FONT, fontSize: g.fontSize, fontStyle: 'bold', color: g.color, stroke: g.stroke, strokeThickness: g.strokeThickness });
      txt.name = style;
    }
    txt.setText(g.text!).setVisible(true).setPosition(g.x, g.y).setRotation(g.rotation).setScale(g.scaleX, g.scaleY).setAlpha(g.alpha);
  }

  // ─── Habillage « cinéma » ────────────────────────────────────────────

  private buildUi() {
    this.ui = this.add.container(0, 0);
    this.ensureTextures();

    const tint = this.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x3355ff, 0.07).setOrigin(0).setBlendMode(Phaser.BlendModes.ADD);
    const vignette = this.add.image(0, 0, 'replay-vignette').setOrigin(0);
    this.scanlines = this.add.tileSprite(0, 0, GAME_WIDTH, GAME_HEIGHT, 'replay-scanline').setOrigin(0).setAlpha(0.18);
    this.speedLines = this.add.graphics();

    const top = this.add.rectangle(0, -BAR_H, GAME_WIDTH, BAR_H, 0x000000).setOrigin(0);
    const bottom = this.add.rectangle(0, GAME_HEIGHT, GAME_WIDTH, BAR_H, 0x000000).setOrigin(0);
    this.tweens.add({ targets: top, y: 0, duration: 300, ease: 'Cubic.Out' });
    this.tweens.add({ targets: bottom, y: GAME_HEIGHT - BAR_H, duration: 300, ease: 'Cubic.Out' });

    this.recDot = this.add.circle(40, BAR_H / 2, 10, 0xff1744);
    this.label = this.add.text(60, BAR_H / 2, '◀◀ REWIND', { fontFamily: FONT, fontSize: '30px', fontStyle: 'bold', color: '#ffffff' }).setOrigin(0, 0.5);
    this.timecode = this.add
      .text(GAME_WIDTH - 30, BAR_H / 2, '00:00.00', { fontFamily: 'monospace', fontSize: '26px', fontStyle: 'bold', color: '#ffffff' })
      .setOrigin(1, 0.5);
    this.speedLabel = this.add
      .text(40, GAME_HEIGHT - BAR_H / 2, '◀◀ ×8', { fontFamily: FONT, fontSize: '24px', fontStyle: 'bold', color: '#ffffff' })
      .setOrigin(0, 0.5);
    const skip = this.add
      .text(GAME_WIDTH - 30, GAME_HEIGHT - BAR_H / 2, '☰ / Ⓐ passer', { fontFamily: FONT, fontSize: '20px', color: '#9aa0b4' })
      .setOrigin(1, 0.5);

    // Les textes des bandes noires arrivent avec elles
    for (const t of [this.recDot, this.label, this.timecode, this.speedLabel, skip]) {
      t.setAlpha(0);
      this.tweens.add({ targets: t, alpha: 1, duration: 300, delay: 200 });
    }
    this.ui.add([tint, vignette, this.scanlines, this.speedLines, top, bottom, this.recDot, this.label, this.timecode, this.speedLabel, skip]);
  }

  /** Lignes de vitesse façon manga, redessinées à chaque image pendant le bullet time. */
  private drawSpeedLines(active: boolean) {
    const g = this.speedLines;
    g.clear();
    if (!active) return;
    const cx = GAME_WIDTH / 2;
    const cy = GAME_HEIGHT / 2;
    for (let i = 0; i < 46; i++) {
      const a = Math.random() * Math.PI * 2;
      const r1 = Phaser.Math.Between(330, 430);
      const r2 = r1 + Phaser.Math.Between(150, 450);
      g.lineStyle(Phaser.Math.Between(2, 5), 0xffffff, Phaser.Math.FloatBetween(0.25, 0.6));
      g.lineBetween(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1, cx + Math.cos(a) * r2, cy + Math.sin(a) * r2);
    }
  }

  /** Vignettage et lignes de balayage générés une seule fois. */
  private ensureTextures() {
    if (!this.textures.exists('replay-vignette')) {
      const canvas = this.textures.createCanvas('replay-vignette', GAME_WIDTH, GAME_HEIGHT)!;
      const ctx = canvas.getContext();
      const grad = ctx.createRadialGradient(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_HEIGHT * 0.35, GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH * 0.65);
      grad.addColorStop(0, 'rgba(0,0,0,0)');
      grad.addColorStop(1, 'rgba(0,0,0,0.75)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
      canvas.refresh();
    }
    if (!this.textures.exists('replay-scanline')) {
      const canvas = this.textures.createCanvas('replay-scanline', 4, 4)!;
      const ctx = canvas.getContext();
      ctx.fillStyle = 'rgba(0,0,0,0.9)';
      ctx.fillRect(0, 0, 4, 1);
      canvas.refresh();
    }
  }
}
