import Phaser from 'phaser';
import type { MonsterDef, MonsterTypeId } from '../monsters';
import type { Player } from './Player';

const SPAWN_MS = 700; // inoffensif pendant son apparition

/** Ce que la scène fournit aux monstres pour agir sur le monde. */
export interface MonsterWorld {
  shoot(from: Monster, angle: number, kind: 'goo' | 'orb'): void;
  explode(m: Monster): void;
  summon(type: MonsterTypeId, x: number, y: number): void;
  pointNear(x: number, y: number, distance: number): { x: number; y: number };
}

type Phase = 'move' | 'windup' | 'dash' | 'fuse' | 'faded';

/** Monstre piloté par son type (voir `monsters.ts`). */
export class Monster extends Phaser.Physics.Arcade.Image {
  declare body: Phaser.Physics.Arcade.Body;
  private hp: number;
  private readonly maxHp: number;
  private readonly awakeAt: number;
  private frozenUntil = 0;
  private phase: Phase = 'move';
  private phaseUntil = 0;
  private readonly dashDir = new Phaser.Math.Vector2();
  /** Prochaine action spéciale : tir, disparition, charge, anneau… */
  private nextActionAt: number;
  private nextSummonAt: number;
  private nextChargeAt: number;
  private enraged = false;

  constructor(scene: Phaser.Scene, x: number, y: number, readonly def: MonsterDef, hpMultiplier = 1) {
    super(scene, x, y, def.texture);
    scene.add.existing(this);
    scene.physics.add.existing(this);
    this.maxHp = Math.max(1, Math.round(def.hp * hpMultiplier));
    this.hp = this.maxHp;
    const now = scene.time.now;
    this.awakeAt = now + SPAWN_MS;
    this.nextActionAt = now + SPAWN_MS + Phaser.Math.Between(800, 2000);
    this.nextSummonAt = now + 7000;
    this.nextChargeAt = now + 4000;
  }

  /** À appeler après l'ajout au groupe physique (qui réinitialise les propriétés du corps). */
  init(): this {
    const r = this.def.radius;
    this.setCircle(r, this.width / 2 - r, this.height / 2 - r).setCollideWorldBounds(true).setBounce(1);
    if (this.isBoss) this.setImmovable(true); // les autres monstres ne le poussent pas
    this.setAlpha(0).setScale(0.3);
    this.scene.tweens.add({ targets: this, alpha: this.baseAlpha, scale: 1, duration: SPAWN_MS, ease: 'Back.Out' });
    return this;
  }

  get isBoss(): boolean {
    return this.def.id === 'boss';
  }

  get hpRatio(): number {
    return Math.max(0, this.hp / this.maxHp);
  }

  get isAwake(): boolean {
    return this.scene.time.now >= this.awakeAt;
  }

  get isFrozen(): boolean {
    return this.scene.time.now < this.frozenUntil;
  }

  /** Inoffensif pendant son apparition, gelé ou disparu. */
  get isDangerous(): boolean {
    return this.isAwake && !this.isFrozen && this.phase !== 'faded';
  }

  /** Un spectre disparu ne peut pas être touché. */
  get isHittable(): boolean {
    return this.phase !== 'faded';
  }

  private get baseAlpha(): number {
    return this.def.id === 'spectre' ? 0.8 : 1;
  }

  freeze(durationMs: number) {
    const d = this.isBoss ? durationMs * 0.3 : durationMs; // le boss résiste au froid
    this.frozenUntil = this.scene.time.now + d;
    this.applyTint();
    this.scene.time.delayedCall(d, () => this.active && this.applyTint());
  }

  /** Renvoie true si le monstre meurt. */
  damage(amount: number): boolean {
    if (!this.isHittable) return false;
    this.hp -= amount;
    this.setTint(0xffffff).setTintMode(Phaser.TintModes.FILL); // flash blanc
    this.scene.time.delayedCall(60, () => this.active && this.applyTint());
    return this.hp <= 0;
  }

  private applyTint() {
    if (this.isFrozen) this.setTintMode(Phaser.TintModes.MULTIPLY).setTint(0x80deea);
    else if (this.enraged) this.setTintMode(Phaser.TintModes.MULTIPLY).setTint(0xff8a80);
    else this.clearTint();
  }

  /** Une frame de comportement. `targets` = joueurs visibles. */
  act(targets: Player[], world: MonsterWorld) {
    if (!this.isAwake || this.isFrozen) {
      if (this.phase !== 'faded') this.body.setVelocity(0, 0);
      return;
    }
    const now = this.scene.time.now;
    const target = this.nearest(targets);
    switch (this.def.id) {
      case 'fusee':
        return this.charger(target, now);
      case 'cracheur':
        return this.spitter(target, now, world);
      case 'bombe':
        return this.bomber(target, now, world);
      case 'spectre':
        return this.ghost(target, now, world);
      case 'boss':
        return this.boss(target, now, world);
      default:
        return this.chase(target);
    }
  }

  // ─── Comportements ───────────────────────────────────────────────────

  private chase(target: Player | undefined, speed = this.def.speed) {
    if (!target) {
      this.body.velocity.lerp(Phaser.Math.Vector2.ZERO, 0.04);
      return;
    }
    // Virage progressif : on peut esquiver un monstre en se décalant au dernier moment
    this.steer(target.x - this.x, target.y - this.y, speed);
  }

  /** Fusée : s'approche, se gonfle, puis fonce en ligne droite. */
  private charger(target: Player | undefined, now: number) {
    if (this.dashStep(now, 650, 450)) return;
    this.chase(target);
    if (target && now >= this.nextActionAt && this.distanceTo(target) < 420) {
      this.startWindup(target, now, 500);
      this.nextActionAt = now + Phaser.Math.Between(2000, 3000);
    }
  }

  /** Cracheur : garde ses distances, tourne autour et crache de la glu. */
  private spitter(target: Player | undefined, now: number, world: MonsterWorld) {
    if (!target) return this.chase(undefined);
    const dx = target.x - this.x;
    const dy = target.y - this.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 250) this.steer(-dx, -dy, this.def.speed);
    else if (dist > 380) this.steer(dx, dy, this.def.speed);
    else this.steer(-dy, dx, this.def.speed * 0.6);
    if (now >= this.nextActionAt) {
      this.nextActionAt = now + 2000;
      world.shoot(this, Math.atan2(dy, dx), 'goo');
      this.scene.tweens.add({ targets: this, scale: { from: 1.2, to: 1 }, duration: 200 });
    }
  }

  /** Bombe : s'approche, s'allume, explose. */
  private bomber(target: Player | undefined, now: number, world: MonsterWorld) {
    if (this.phase === 'fuse') {
      this.body.setVelocity(0, 0);
      this.setTint(Math.floor(now / 80) % 2 ? 0xff5252 : 0xffffff);
      if (now >= this.phaseUntil) world.explode(this);
      return;
    }
    this.chase(target);
    if (target && this.distanceTo(target) < 90) {
      this.phase = 'fuse';
      this.phaseUntil = now + 800;
      this.scene.tweens.add({ targets: this, scale: 1.35, duration: 800 });
    }
  }

  /** Spectre : traverse les murs, disparaît et réapparaît près de sa cible. */
  private ghost(target: Player | undefined, now: number, world: MonsterWorld) {
    if (this.phase === 'faded') {
      if (now < this.phaseUntil) return;
      this.phase = 'move';
      if (target) {
        const p = world.pointNear(target.x, target.y, 170);
        this.body.reset(p.x, p.y);
      }
      this.scene.tweens.add({ targets: this, alpha: this.baseAlpha, duration: 250 });
      return;
    }
    this.chase(target);
    if (now >= this.nextActionAt) {
      this.phase = 'faded';
      this.phaseUntil = now + 1200;
      this.nextActionAt = now + 1200 + Phaser.Math.Between(3000, 4500);
      this.body.setVelocity(0, 0);
      this.scene.tweens.add({ targets: this, alpha: 0.1, duration: 200 });
    }
  }

  /** Roi Gloubi : 3 phases selon ses points de vie. */
  private boss(target: Player | undefined, now: number, world: MonsterWorld) {
    const stage = this.hpRatio > 2 / 3 ? 1 : this.hpRatio > 1 / 3 ? 2 : 3;
    if (stage === 3 && !this.enraged) {
      this.enraged = true;
      this.applyTint();
      this.scene.cameras.main.shake(400, 0.01);
    }
    if (this.dashStep(now, 700, 600)) return;

    this.chase(target, this.def.speed * (stage === 3 ? 1.6 : 1));

    // Anneau de projectiles
    if (now >= this.nextActionAt) {
      const n = stage === 3 ? 16 : 12;
      const offset = Math.random() * Math.PI * 2;
      for (let i = 0; i < n; i++) world.shoot(this, offset + (i / n) * Math.PI * 2, 'orb');
      this.nextActionAt = now + (stage === 1 ? 2600 : stage === 2 ? 2200 : 1800);
    }
    // Invocation de Fusées
    if (stage >= 2 && now >= this.nextSummonAt) {
      world.summon('fusee', this.x - 90, this.y);
      world.summon('fusee', this.x + 90, this.y);
      this.nextSummonAt = now + 7000;
    }
    // Charge enragée
    if (stage === 3 && target && now >= this.nextChargeAt) {
      this.startWindup(target, now, 600);
      this.nextChargeAt = now + 5000;
    }
  }

  // ─── Utilitaires ─────────────────────────────────────────────────────

  private startWindup(target: Player, now: number, durationMs: number) {
    this.phase = 'windup';
    this.phaseUntil = now + durationMs;
    this.dashDir.set(target.x - this.x, target.y - this.y).normalize();
    this.scene.tweens.add({ targets: this, scale: 1.25, duration: durationMs / 2, yoyo: true });
  }

  /** Gère préparation puis ruée ; renvoie true tant que la charge est en cours. */
  private dashStep(now: number, speed: number, dashMs: number): boolean {
    if (this.phase === 'windup') {
      this.body.velocity.lerp(Phaser.Math.Vector2.ZERO, 0.3);
      if (now >= this.phaseUntil) {
        this.phase = 'dash';
        this.phaseUntil = now + dashMs;
        this.body.setVelocity(this.dashDir.x * speed, this.dashDir.y * speed);
      }
      return true;
    }
    if (this.phase === 'dash') {
      if (now >= this.phaseUntil) this.phase = 'move';
      return true;
    }
    return false;
  }

  private steer(dx: number, dy: number, speed: number) {
    const v = new Phaser.Math.Vector2(dx, dy).normalize().scale(speed);
    this.body.velocity.lerp(v, 0.04);
    this.setFlipX(this.body.velocity.x < 0);
  }

  private nearest(players: Player[]): Player | undefined {
    let best: Player | undefined;
    let bestDist = Infinity;
    for (const p of players) {
      const d = this.distanceTo(p);
      if (d < bestDist) {
        best = p;
        bestDist = d;
      }
    }
    return best;
  }

  private distanceTo(p: Player): number {
    return Phaser.Math.Distance.Between(this.x, this.y, p.x, p.y);
  }
}
