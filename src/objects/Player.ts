import Phaser from 'phaser';
import { Sound } from '../audio/Sound';
import type { CharacterDef } from '../characters';
import { PLAYER_COLORS } from '../config';
import type { ControlSource } from '../input/Controls';
import { WEAPONS, type WeaponDef } from '../weapons';

const SPEED = 320;
const DASH_SPEED = 900;
const DASH_MS = 160;
const DASH_COOLDOWN_MS = 700;
const INVULNERABLE_MS = 1500;
const SWORD_DURATION_MS = 5000;
const SWING_COOLDOWN_MS = 350;
const SLOW_FACTOR = 0.4; // vitesse restante quand on est touché par un missile

/** Effets temporaires déclenchés par les pouvoirs. */
export type EffectId = 'shield' | 'magnet' | 'shadow';

export class Player extends Phaser.Physics.Arcade.Image {
  declare body: Phaser.Physics.Arcade.Body;
  score = 0;
  readonly color: number;
  private dashUntil = 0;
  private nextDashAt = 0;
  private nextFireAt = 0;
  private slowUntil = 0;
  private invulnerableUntil = 0;
  weapon: WeaponDef = WEAPONS.missile;
  private weaponUntil = 0;
  private swordUntil = 0;
  /** Épée rangée (Ⓑ) : on tire normalement, le temps restant continue de s'écouler. */
  swordSheathed = false;
  private nextSwingAt = 0;
  private swingAngle = 0; // animé pendant un coup d'épée
  private nextPowerAt = 0;
  private readonly effects = new Map<EffectId, number>();
  readonly facing = new Phaser.Math.Vector2(1, 0);

  // Accessoires qui suivent le joueur
  private readonly ring: Phaser.GameObjects.Image;
  private readonly emblem: Phaser.GameObjects.Text;
  private readonly shieldSprite: Phaser.GameObjects.Image;
  private readonly swordSprite: Phaser.GameObjects.Image;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    readonly index: number,
    readonly character: CharacterDef,
    readonly controls: ControlSource,
    private readonly grip = 0.25,
  ) {
    super(scene, x, y, 'player');
    this.color = character.color;
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.setTint(this.color).setCircle(24).setCollideWorldBounds(true).setBounce(0.6).setDrag(1400);
    // L'anneau à la couleur du joueur (J1 / J2) permet de distinguer deux personnages identiques
    this.ring = scene.add.image(x, y, 'ring').setTint(PLAYER_COLORS[index]);
    this.emblem = scene.add.text(x, y, character.emoji, { fontSize: '24px' }).setOrigin(0.5);
    this.shieldSprite = scene.add.image(x, y, 'shield-bubble').setVisible(false);
    this.swordSprite = scene.add.image(x, y, 'sword').setOrigin(0.15, 0.5).setVisible(false);
  }

  get isDashing(): boolean {
    return this.scene.time.now < this.dashUntil;
  }

  get isSlowed(): boolean {
    return this.scene.time.now < this.slowUntil;
  }

  hasEffect(id: EffectId, now = this.scene.time.now): boolean {
    return (this.effects.get(id) ?? 0) > now;
  }

  addEffect(id: EffectId, durationMs: number) {
    this.effects.set(id, this.scene.time.now + durationMs);
  }

  /** Les monstres ignorent un joueur invisible. */
  isTargetable(now: number): boolean {
    return !this.hasEffect('shadow', now);
  }

  tick(now: number) {
    const { moveX, moveY, actionPressed, backPressed } = this.controls.state;
    if (backPressed && now < this.swordUntil) this.toggleSword();
    const speedFactor = (this.isSlowed ? SLOW_FACTOR : 1) * this.character.speed;
    const dir = new Phaser.Math.Vector2(moveX, moveY);
    if (dir.lengthSq() > 1) dir.normalize();
    if (dir.lengthSq() > 0.01) this.facing.copy(dir).normalize();

    if (actionPressed && now >= this.nextDashAt) {
      this.dashUntil = now + DASH_MS;
      this.nextDashAt = now + DASH_COOLDOWN_MS;
      this.body.setVelocity(this.facing.x * DASH_SPEED * speedFactor, this.facing.y * DASH_SPEED * speedFactor);
      this.controls.rumble(0.25, 60);
      Sound.sfx('dash');
    }

    if (!this.isDashing) {
      // Accélère vers la vitesse cible : contrôle analogique fluide au stick (faible adhérence = glisse)
      const target = dir.scale(SPEED * speedFactor);
      this.body.velocity.lerp(target, this.grip);
    }

    const shadow = this.hasEffect('shadow', now);
    this.ring.setPosition(this.x, this.y).setAlpha(shadow ? 0.25 : 1);
    this.emblem.setPosition(this.x, this.y).setAlpha(shadow ? 0.1 : 1);
    this.shieldSprite.setPosition(this.x, this.y).setVisible(this.hasEffect('shield', now));

    this.swordSprite.setVisible(this.hasSword(now));
    if (this.swordSprite.visible) {
      this.swordSprite.setPosition(this.x + this.facing.x * 18, this.y + this.facing.y * 18);
      this.swordSprite.setRotation(this.facing.angle() + this.swingAngle);
      // Clignote pendant la dernière seconde
      this.swordSprite.setAlpha(this.swordUntil - now < 1000 && Math.floor(now / 100) % 2 ? 0.3 : 1);
    }

    if (shadow) this.setAlpha(0.1);
    else if (now < this.invulnerableUntil) this.setAlpha(Math.floor(now / 80) % 2 ? 0.3 : 1);
    else this.setAlpha(now < this.nextDashAt && !this.isDashing ? 0.75 : 1);
    // Ralenti : le rond clignote en gris
    this.setTint(this.isSlowed && Math.floor(now / 100) % 2 === 0 ? 0x8a8fa3 : this.color);
  }

  /** Renvoie true si le joueur déclenche son pouvoir cette frame (la scène applique l'effet). */
  tryPower(now: number): boolean {
    if (!this.controls.state.powerPressed || now < this.nextPowerAt) return false;
    this.nextPowerAt = now + this.character.power.cooldownMs;
    this.controls.rumble(0.5, 120);
    return true;
  }

  powerCooldownLeft(now: number): number {
    return Math.max(0, this.nextPowerAt - now);
  }

  /** Temps restant du bonus en cours (0 avec l'arme de base). */
  weaponTimeLeft(now: number): number {
    return this.weapon.bonusDurationMs ? Math.max(0, this.weaponUntil - now) : 0;
  }

  equip(weapon: WeaponDef, now: number) {
    this.weapon = weapon;
    this.weaponUntil = now + (weapon.bonusDurationMs ?? 0);
    this.nextFireAt = now;
    this.controls.rumble(0.5, 150);
  }

  /** Épée en main (et pas rangée). */
  hasSword(now: number): boolean {
    return now < this.swordUntil && !this.swordSheathed;
  }

  private toggleSword() {
    this.swordSheathed = !this.swordSheathed;
    this.swingAngle = 0;
    this.controls.rumble(0.2, 50);
  }

  swordTimeLeft(now: number): number {
    return Math.max(0, this.swordUntil - now);
  }

  giveSword(now: number) {
    this.swordUntil = now + SWORD_DURATION_MS;
    this.swordSheathed = false;
    this.controls.rumble(0.5, 150);
  }

  /** Renvoie true si le joueur donne un coup d'épée cette frame. */
  trySwing(now: number): boolean {
    if (!this.hasSword(now) || !this.controls.state.firePressed || now < this.nextSwingAt) return false;
    this.nextSwingAt = now + SWING_COOLDOWN_MS;
    this.scene.tweens.add({ targets: this, swingAngle: { from: -1.4, to: 1.4 }, duration: 160, ease: 'Cubic.Out', onComplete: () => (this.swingAngle = 0) });
    this.controls.rumble(0.3, 60);
    return true;
  }

  /** Double impulsion bien reconnaissable quand on gagne une étoile. */
  starRumble() {
    this.controls.rumble(0.8, 90);
    // setTimeout plutôt que l'horloge de la scène, qui se fige à la victoire
    setTimeout(() => this.controls.rumble(0.8, 90), 160);
  }

  /** Renvoie l'arme utilisée si le joueur tire cette frame (la scène crée alors le projectile). */
  tryFire(now: number): WeaponDef | null {
    if (this.weapon.bonusDurationMs && now >= this.weaponUntil) this.weapon = WEAPONS.missile;
    const { fire, firePressed } = this.controls.state;
    if (!(this.weapon.auto ? fire : firePressed) || now < this.nextFireAt) return null;
    this.nextFireAt = now + this.weapon.cooldownMs;
    this.controls.rumble(this.weapon.auto ? 0.08 : 0.15, 40);
    return this.weapon;
  }

  slowDown(durationMs: number) {
    // Les impacts prolongent le ralentissement sans jamais le raccourcir
    this.slowUntil = Math.max(this.slowUntil, this.scene.time.now + durationMs);
    this.controls.rumble(0.7, 180);
  }

  /** Les tirs et les coups n'ont aucun effet (bouclier ou invisibilité). */
  isUntouchable(now = this.scene.time.now): boolean {
    return this.hasEffect('shield', now) || this.hasEffect('shadow', now);
  }

  /** Touché par un monstre, la lave ou une épée. Renvoie false si le joueur est protégé. */
  hurt(from: Phaser.Math.Vector2): boolean {
    const now = this.scene.time.now;
    if (now < this.invulnerableUntil || this.isUntouchable(now)) return false;
    this.invulnerableUntil = now + INVULNERABLE_MS;
    this.knockback(from, 700);
    return true;
  }

  knockback(from: Phaser.Math.Vector2, force: number) {
    const push = new Phaser.Math.Vector2(this.x - from.x, this.y - from.y).normalize().scale(force * this.character.knockbackTaken);
    this.body.setVelocity(push.x, push.y);
    this.dashUntil = this.scene.time.now + 200; // empêche le joueur de contrer immédiatement
    this.controls.rumble(0.9, 220);
  }
}
