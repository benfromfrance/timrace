import Phaser from 'phaser';
import type { ArenaDef, Rect } from '../arenas';
import { Sound } from '../audio/Sound';
import { Progress, type ChallengeDef, type ChallengeId } from '../challenges';
import { COOP_LIVES, FONT, GAME_HEIGHT, GAME_WIDTH, PLAYER_COLORS, SCORE_TO_WIN, SOLO_BOSS_HP, TEAM_SPEED_BONUS, css } from '../config';
import { Input } from '../input/InputManager';
import { Match, starTarget, type GameMode } from '../match';
import { MONSTERS, pickMonsterType, type MonsterTypeId } from '../monsters';
import { Monster, type MonsterWorld } from '../objects/Monster';
import { Player } from '../objects/Player';
import { BONUS_WEAPONS, WEAPONS, type WeaponDef } from '../weapons';
import type { PodiumData } from './PodiumScene';
import { showChallengeToast } from '../ui/toast';

const CRATE_SPAWN_DELAY_MS = 7000; // délai avant l'apparition d'une nouvelle caisse d'arme
const DROPPED_STAR_LIFETIME_MS = 6000;
const SWORD_REACH = 60; // distance du centre de la zone de frappe devant le joueur
const SWORD_HIT_RADIUS = 48;
const TELEPORT_DISTANCE = 240;
const FROST_RADIUS = 260;
const MAGNET_PULL = 0.08;
const BUMPER_FORCE = 750;
const SWORD_DAMAGE = 4;
const BLAST_RADIUS = 120;
const MAX_SUMMONED = 7; // limite de monstres pendant le combat de boss
const BOSS_BONUS_LIVES = 2;
const HEART_SPAWN_MS = { min: 12000, max: 18000 }; // délai aléatoire entre deux cœurs
const HEART_LIFETIME_MS = 8000;
const HOMING_TURN = 4; // rad/s
const BOOMERANG_OUT_MS = 400;
const MINE_ARM_MS = 600;
const MINE_TRIGGER = 60;
const ENEMY_SHOTS = {
  goo: { speed: 380, lifetimeMs: 2500 }, // ralentit
  orb: { speed: 300, lifetimeMs: 3500 }, // blesse
};

/** Apparition des monstres : fixe en duel, de plus en plus intense en coopération et en solo. */
const MONSTER_SPAWN: Record<GameMode, { everyMs: number; max: (elapsedMs: number) => number }> = {
  versus: { everyMs: 4000, max: (_elapsedMs: number) => 3 },
  coop: { everyMs: 2500, max: (elapsedMs: number) => Math.min(9, 4 + Math.floor(elapsedMs / 15000)) },
  solo: { everyMs: 3200, max: (elapsedMs: number) => Math.min(6, 3 + Math.floor(elapsedMs / 20000)) },
};

type Img = Phaser.Physics.Arcade.Image;

/**
 * Duel : ramassez les étoiles, foncez (Ⓐ) sur l'adversaire, tirez (Ⓧ) pour le ralentir,
 * utilisez le pouvoir de votre personnage (Ⓨ). Le premier à SCORE_TO_WIN gagne.
 * Coopération / solo : ramassez starTarget() étoiles avant de perdre vos COOP_LIVES cœurs.
 *
 * Dans les deux modes : caisses d'armes bonus, monstres (tuer un monstre donne une épée 5 s),
 * et l'arène choisie (murs, plots, lave, sol glacé).
 * Atteindre l'objectif déclenche le combat contre le boss final (affaibli en solo).
 */
export class GameScene extends Phaser.Scene {
  private arena!: ArenaDef;
  /** Coopération ou solo : vies partagées, étoiles communes, boss final, pas de tir ami. */
  private teamMode = false;
  private players: Player[] = [];
  private star!: Img;
  private missiles!: Phaser.Physics.Arcade.Group;
  private crate!: Img;
  private crateIcon!: Phaser.GameObjects.Text;
  private mines: Phaser.GameObjects.Image[] = [];
  // Compteurs de la partie, pour les défis
  private cratesPicked: number[] = [];
  private droppedPicked: number[] = [];
  private livesLostInBoss = 0;
  /** Défis réussis pendant la partie ; ceux de la fin sont affichés sur le podium. */
  private endAchievements: ChallengeDef[] = [];
  private heart!: Img;
  private heartToken = 0; // identifie le cœur en cours, pour l'expiration
  private monsters!: Phaser.Physics.Arcade.Group;
  private enemyShots!: Phaser.Physics.Arcade.Group;
  private world!: MonsterWorld;
  private bossPhase = false;
  private boss: Monster | null = null;
  private bossBar!: Phaser.GameObjects.Graphics;
  private droppedStars!: Phaser.Physics.Arcade.Group;
  private obstacles!: Phaser.Physics.Arcade.StaticGroup;
  private lava!: Phaser.Physics.Arcade.StaticGroup;
  private hudTexts: Phaser.GameObjects.Text[] = [];
  private teamText!: Phaser.GameObjects.Text;
  private sparks!: Phaser.GameObjects.Particles.ParticleEmitter;
  private teamScore = 0;
  private lives = COOP_LIVES;
  private startedAt = 0;
  private over = false;

  constructor() {
    super('Game');
  }

  create() {
    this.over = false;
    this.time.paused = false; // l'horloge reste en pause après une fin de partie, même au redémarrage
    this.arena = Match.arena;
    this.teamMode = Match.mode !== 'versus';
    this.teamScore = 0;
    this.lives = COOP_LIVES;
    this.startedAt = this.time.now;
    this.bossPhase = false;
    this.boss = null;
    this.mines = [];
    this.cratesPicked = [0, 0];
    this.droppedPicked = [0, 0];
    this.livesLostInBoss = 0;
    this.endAchievements = [];
    Sound.playMusic('battle');

    this.physics.world.setBounds(0, 0, GAME_WIDTH, GAME_HEIGHT);
    this.add.grid(GAME_WIDTH / 2, GAME_HEIGHT / 2, GAME_WIDTH, GAME_HEIGHT, 64, 64, this.arena.bg, 1, this.arena.grid, 1);
    this.buildArena();

    this.players = Input.slots.slice(0, Match.playerCount).map((source, i) => {
      if (!source) throw new Error(`Aucune entrée pour le joueur ${i + 1}`);
      const { x, y } = this.arena.spawns[i];
      return new Player(this, x, y, i, Match.characters[i], source, this.arena.grip, this.teamMode ? TEAM_SPEED_BONUS : 1);
    });
    if (!this.teamMode) {
      const [p1, p2] = this.players;
      this.physics.add.collider(p1, p2, () => this.onClash(p1, p2));
    }
    this.physics.add.collider(this.players, this.obstacles, (p, o) => this.onBump(p as Player, o as Phaser.GameObjects.Shape));
    this.physics.add.overlap(this.players, this.lava, (p, l) => this.onLava(p as Player, l as Phaser.GameObjects.Rectangle));

    this.star = this.physics.add.image(0, 0, 'star');
    this.respawnStar();
    for (const p of this.players) this.physics.add.overlap(p, this.star, () => this.collect(p));

    this.missiles = this.physics.add.group();
    for (const p of this.players) {
      this.physics.add.overlap(p, this.missiles, (_p, m) => this.onMissileHit(p, m as Img));
    }
    this.physics.add.overlap(this.missiles, this.obstacles, (proj) => this.destroyProjectile(proj as Img));

    this.crate = this.physics.add.image(0, 0, 'weapon-crate');
    this.crateIcon = this.add.text(0, 0, '', { fontSize: '20px' }).setOrigin(0.5).setVisible(false);
    this.crate.disableBody(true, true);
    for (const p of this.players) this.physics.add.overlap(p, this.crate, () => this.pickCrate(p));
    this.scheduleCrate();

    // Cœurs de soin : seulement en équipe (coop / solo), les seuls modes avec des vies
    this.heart = this.physics.add.image(0, 0, 'heart');
    this.heart.disableBody(true, true);
    this.tweens.add({ targets: this.heart, scale: { from: 1, to: 1.2 }, duration: 400, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
    if (this.teamMode) {
      for (const p of this.players) this.physics.add.overlap(p, this.heart, () => this.pickHeart(p));
      this.scheduleHeart();
    }

    this.monsters = this.physics.add.group();
    this.physics.add.collider(this.monsters, this.monsters);
    // Le spectre et le boss traversent les murs
    this.physics.add.collider(this.monsters, this.obstacles, undefined, (m) => !(m as Monster).def.passWalls);
    for (const p of this.players) {
      this.physics.add.overlap(p, this.monsters, (_p, m) => this.onMonsterTouch(p, m as Monster));
    }
    this.physics.add.overlap(this.missiles, this.monsters, (proj, m) => this.onMonsterShot(proj as Img, m as Monster));
    this.time.addEvent({ delay: MONSTER_SPAWN[Match.mode].everyMs, loop: true, callback: () => this.spawnMonster() });

    this.enemyShots = this.physics.add.group();
    for (const p of this.players) {
      this.physics.add.overlap(p, this.enemyShots, (_p, shot) => this.onEnemyShot(p, shot as Img));
    }
    this.physics.add.overlap(this.enemyShots, this.obstacles, (shot) => this.destroyProjectile(shot as Img));
    this.world = {
      shoot: (from, angle, kind) => this.enemyShoot(from, angle, kind),
      explode: (m) => this.explode(m),
      summon: (type, x, y) => {
        if (this.monsters.countActive() < MAX_SUMMONED) this.spawnMonsterAt(type, x, y);
      },
      pointNear: (x, y, d) => this.pointNear(x, y, d),
    };

    this.droppedStars = this.physics.add.group();
    this.physics.add.collider(this.droppedStars, this.obstacles);
    for (const p of this.players) {
      this.physics.add.overlap(p, this.droppedStars, (_p, s) => this.pickDroppedStar(p, s as Img));
    }

    this.sparks = this.add.particles(0, 0, 'spark', {
      speed: { min: 80, max: 260 },
      lifespan: 450,
      scale: { start: 1, end: 0 },
      emitting: false,
    });

    this.buildHud();
  }

  update(time: number) {
    Input.update(this.game.loop.frame);
    if (this.over) return; // l'écran de fin (PodiumScene) prend la main

    // Manette débranchée en pleine partie → retour au lobby
    if (!Input.hasPlayers(Match.playerCount)) {
      this.scene.start('Lobby');
      return;
    }

    this.refreshHud();
    const targets = this.players.filter((p) => p.isTargetable(time));
    for (const m of [...this.monsters.getChildren()] as Monster[]) if (m.active) m.act(targets, this.world);
    for (const p of this.players) {
      p.tick(time);
      if (p.tryPower(time)) this.usePower(p);
      if (p.hasSword(time)) {
        if (p.trySwing(time)) this.swingSword(p);
      } else {
        const weapon = p.tryFire(time);
        if (weapon) this.fireProjectile(p, weapon);
      }
      if (p.hasEffect('magnet', time)) this.pullStars(p);
    }
    this.updateProjectiles(time);
    this.checkMines(time);
  }

  // ─── Arène ───────────────────────────────────────────────────────────

  private buildArena() {
    this.obstacles = this.physics.add.staticGroup();
    this.lava = this.physics.add.staticGroup();

    for (const r of this.arena.lava) {
      const pool = this.add.rectangle(r.x + r.w / 2, r.y + r.h / 2, r.w, r.h, 0xff5722).setStrokeStyle(4, 0xffab40);
      this.lava.add(pool);
      this.tweens.add({ targets: pool, alpha: { from: 0.6, to: 1 }, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.InOut' });
    }
    for (const r of this.arena.walls) {
      const wall = this.add.rectangle(r.x + r.w / 2, r.y + r.h / 2, r.w, r.h, this.arena.wallColor).setStrokeStyle(3, 0xffffff, 0.2);
      this.obstacles.add(wall);
    }
    for (const b of this.arena.bumpers) {
      const bumper = this.add.circle(b.x, b.y, b.r, this.arena.wallColor).setStrokeStyle(5, 0xffffff, 0.8);
      this.obstacles.add(bumper);
      (bumper.body as Phaser.Physics.Arcade.StaticBody).setCircle(b.r);
      bumper.setData('bumper', true);
    }
  }

  /** Le point (x, y) est-il à au moins `margin` px de tout obstacle et de la lave ? */
  private isFree(x: number, y: number, margin: number): boolean {
    const inRect = (r: Rect) => x > r.x - margin && x < r.x + r.w + margin && y > r.y - margin && y < r.y + r.h + margin;
    return (
      !this.arena.walls.some(inRect) &&
      !this.arena.lava.some(inRect) &&
      !this.arena.bumpers.some((b) => Phaser.Math.Distance.Between(x, y, b.x, b.y) < b.r + margin)
    );
  }

  private randomFreePoint(margin = 50): { x: number; y: number } {
    for (let i = 0; i < 50; i++) {
      const x = Phaser.Math.Between(80, GAME_WIDTH - 80);
      const y = Phaser.Math.Between(100, GAME_HEIGHT - 80);
      if (this.isFree(x, y, margin)) return { x, y };
    }
    return { x: GAME_WIDTH / 2, y: 120 };
  }

  private onBump(p: Player, o: Phaser.GameObjects.Shape) {
    if (!o.getData('bumper')) return;
    const push = new Phaser.Math.Vector2(p.x - o.x, p.y - o.y).normalize().scale(BUMPER_FORCE);
    p.body.setVelocity(push.x, push.y);
    p.controls.rumble(0.4, 80);
    this.tweens.add({ targets: o, scale: { from: 1.15, to: 1 }, duration: 200, ease: 'Back.Out' });
  }

  private onLava(p: Player, pool: Phaser.GameObjects.Rectangle) {
    // Repoussé hors du bassin, depuis son centre
    this.hitPlayer(p, pool.x, pool.y);
  }

  // ─── Combat ──────────────────────────────────────────────────────────

  private onClash(a: Player, b: Player) {
    if (a.isDashing === b.isDashing) return;
    const [attacker, victim] = a.isDashing ? [a, b] : [b, a];
    if (victim.isUntouchable()) return;
    victim.knockback(new Phaser.Math.Vector2(attacker.x, attacker.y), 1100);
    this.sparks.setParticleTint(attacker.color).explode(16, victim.x, victim.y);
    this.cameras.main.shake(120, 0.006);
  }

  private fireProjectile(p: Player, weapon: WeaponDef, fixedAngle?: number) {
    Sound.sfx(weapon.sound);
    if (weapon.behavior === 'mine') return this.placeMine(p, weapon);
    const base = fixedAngle ?? p.facing.angle();
    const n = weapon.pellets ?? 1;
    for (let i = 0; i < n; i++) {
      const fanOffset = n > 1 ? (i / (n - 1) - 0.5) * (weapon.fan ?? 0) : 0;
      this.spawnProjectile(p, weapon, base + fanOffset + Phaser.Math.FloatBetween(-weapon.spread, weapon.spread));
    }
  }

  private spawnProjectile(p: Player, weapon: WeaponDef, angle: number) {
    const dir = new Phaser.Math.Vector2(Math.cos(angle), Math.sin(angle));
    const m = this.missiles.create(p.x + dir.x * 34, p.y + dir.y * 34, weapon.texture) as Img;
    m.setData({
      owner: p.index,
      slowMs: weapon.slowMs,
      damage: weapon.damage,
      behavior: weapon.behavior,
      pierce: weapon.pierce ?? false,
      hits: new Set<unknown>(), // cibles déjà touchées (projectiles perçants)
      speed: weapon.projectileSpeed,
      bornAt: this.time.now,
      returning: false,
    }).setRotation(angle);
    if (!weapon.keepColors) m.setTint(p.color);
    // Hitbox ronde centrée : les corps Arcade ne pivotent pas avec le sprite
    const r = Math.min(m.width, m.height) / 2 + 2;
    m.setCircle(r, m.width / 2 - r, m.height / 2 - r);
    m.setVelocity(dir.x * weapon.projectileSpeed, dir.y * weapon.projectileSpeed);
    this.time.delayedCall(weapon.projectileLifetimeMs, () => m.destroy());
  }

  /** Têtes chercheuses et boomerangs : pilotés à chaque frame. */
  private updateProjectiles(now: number) {
    const dt = this.game.loop.delta / 1000;
    for (const m of this.missiles.getChildren() as Img[]) {
      const behavior = m.getData('behavior');
      if (behavior === 'homing') {
        const target = this.nearestEnemy(m.getData('owner'), m.x, m.y);
        if (!target) continue;
        const current = Math.atan2(m.body!.velocity.y, m.body!.velocity.x);
        const wanted = Phaser.Math.Angle.Between(m.x, m.y, target.x, target.y);
        const angle = Phaser.Math.Angle.RotateTo(current, wanted, HOMING_TURN * dt);
        const speed = m.getData('speed');
        m.setVelocity(Math.cos(angle) * speed, Math.sin(angle) * speed).setRotation(angle);
      } else if (behavior === 'boomerang') {
        m.rotation += 25 * dt;
        if (now - m.getData('bornAt') > BOOMERANG_OUT_MS) m.setData('returning', true);
        if (m.getData('returning')) {
          const owner = this.players[m.getData('owner')];
          this.physics.moveToObject(m, owner, 750);
          if (Phaser.Math.Distance.Between(m.x, m.y, owner.x, owner.y) < 30) m.destroy(); // rattrapé
        }
      }
    }
  }

  /** Cible la plus proche pour une tête chercheuse : monstres, et l'adversaire en duel. */
  private nearestEnemy(ownerIndex: number, x: number, y: number): { x: number; y: number } | null {
    const candidates: { x: number; y: number }[] = (this.monsters.getChildren() as Monster[]).filter((m) => m.active && m.isHittable);
    if (!this.teamMode) {
      for (const p of this.players) if (p.index !== ownerIndex && p.isTargetable(this.time.now) && !p.isUntouchable()) candidates.push(p);
    }
    let best: { x: number; y: number } | null = null;
    let bestDist = Infinity;
    for (const c of candidates) {
      const d = Phaser.Math.Distance.Between(x, y, c.x, c.y);
      if (d < bestDist) {
        best = c;
        bestDist = d;
      }
    }
    return best;
  }

  /** Mine posée derrière le joueur ; s'arme après un court délai. */
  private placeMine(p: Player, weapon: WeaponDef) {
    const mine = this.add.image(p.x - p.facing.x * 34, p.y - p.facing.y * 34, 'mine').setAlpha(0.5);
    mine.setData({ owner: p.index, armAt: this.time.now + MINE_ARM_MS });
    this.mines.push(mine);
    this.time.delayedCall(MINE_ARM_MS, () => mine.active && mine.setAlpha(1));
    this.time.delayedCall(weapon.projectileLifetimeMs, () => {
      this.mines = this.mines.filter((m) => m !== mine);
      mine.destroy();
    });
  }

  private checkMines(now: number) {
    for (const mine of [...this.mines]) {
      if (!mine.active || now < mine.getData('armAt')) continue;
      const owner: number = mine.getData('owner');
      const near = (x: number, y: number, r: number) => Phaser.Math.Distance.Between(mine.x, mine.y, x, y) < MINE_TRIGGER + r;
      const triggered =
        (this.monsters.getChildren() as Monster[]).some((m) => m.active && m.isHittable && near(m.x, m.y, m.def.radius)) ||
        (!this.teamMode && this.players.some((p) => p.index !== owner && !p.isUntouchable() && near(p.x, p.y, 24)));
      if (triggered) {
        this.mines = this.mines.filter((m) => m !== mine);
        mine.destroy();
        this.blast(mine.x, mine.y, owner);
      }
    }
  }

  private destroyProjectile(proj: Img) {
    if (!proj.active) return;
    if (proj.getData('behavior') === 'boomerang') {
      proj.setData('returning', true); // rebondit sur l'obstacle et revient
      return;
    }
    this.sparks.setParticleTint(0xffffff).explode(5, proj.x, proj.y);
    proj.destroy();
  }

  private onMissileHit(target: Player, m: Img) {
    if (!m.active || m.getData('owner') === target.index) return; // on ne se touche pas soi-même
    if (this.teamMode || target.hasEffect('shadow')) return; // pas de tir ami ; l'invisible est traversé
    if (target.hasEffect('shield')) {
      this.destroyProjectile(m); // le bouclier bloque
      return;
    }
    if (m.getData('pierce')) {
      const hits: Set<unknown> = m.getData('hits');
      if (hits.has(target)) return;
      hits.add(target);
    }
    target.slowDown(m.getData('slowMs'));
    this.sparks.setParticleTint(0xff5252).explode(14, m.x, m.y);
    Sound.sfx('hit');
    if (!m.getData('pierce')) m.destroy();
  }

  private swingSword(p: Player) {
    Sound.sfx('swing');
    const hx = p.x + p.facing.x * SWORD_REACH;
    const hy = p.y + p.facing.y * SWORD_REACH;
    if (!this.teamMode) {
      for (const other of this.players) {
        if (other !== p && Phaser.Math.Distance.Between(hx, hy, other.x, other.y) < SWORD_HIT_RADIUS + 24) {
          this.sparks.setParticleTint(0xe0e6f0).explode(18, other.x, other.y);
          Sound.sfx('hit');
          this.hitPlayer(other, p.x, p.y);
        }
      }
    }
    for (const m of [...this.monsters.getChildren()] as Monster[]) {
      if (m.active && Phaser.Math.Distance.Between(hx, hy, m.x, m.y) < SWORD_HIT_RADIUS + m.def.radius) {
        this.sparks.setParticleTint(0xe0e6f0).explode(8, m.x, m.y);
        Sound.sfx('hit');
        if (m.damage(SWORD_DAMAGE)) this.killMonster(m, p);
      }
    }
  }

  /** Coup reçu (monstre, lave ou épée) : recul, puis perte d'une étoile (duel) ou d'un cœur (coop). */
  private hitPlayer(p: Player, fromX: number, fromY: number) {
    if (this.over || !p.hurt(new Phaser.Math.Vector2(fromX, fromY))) return;
    this.cameras.main.shake(100, 0.004);
    Sound.sfx('hurt');
    if (this.teamMode) {
      this.lives--;
      if (this.bossPhase) this.livesLostInBoss++;
      this.cameras.main.flash(200, 120, 0, 0);
      if (this.lives <= 0) this.endGame('lose', null);
    } else if (p.score > 0) {
      p.score--;
      this.dropStar(p.x, p.y);
    }
    this.refreshHud();
  }

  // ─── Pouvoirs ────────────────────────────────────────────────────────

  private usePower(p: Player) {
    Sound.sfx('power');
    const power = p.character.power;
    switch (power.id) {
      case 'teleport':
        return this.teleport(p);
      case 'frost':
        return this.frostWave(p, power.durationMs ?? 2500);
      case 'nova':
        for (let i = 0; i < 12; i++) this.fireProjectile(p, WEAPONS.fireball, (i / 12) * Math.PI * 2);
        this.cameras.main.shake(150, 0.005);
        return;
      case 'shield':
      case 'magnet':
      case 'shadow':
        p.addEffect(power.id, power.durationMs ?? 3000);
        this.sparks.setParticleTint(p.color).explode(16, p.x, p.y);
        return;
    }
  }

  /** Saute le plus loin possible devant soi, sans atterrir dans un mur ou de la lave. */
  private teleport(p: Player) {
    for (let d = TELEPORT_DISTANCE; d >= 40; d -= 20) {
      const x = Phaser.Math.Clamp(p.x + p.facing.x * d, 30, GAME_WIDTH - 30);
      const y = Phaser.Math.Clamp(p.y + p.facing.y * d, 30, GAME_HEIGHT - 30);
      if (this.isFree(x, y, 28)) {
        this.sparks.setParticleTint(p.color).explode(16, p.x, p.y);
        p.body.reset(x, y);
        this.sparks.explode(16, x, y);
        return;
      }
    }
  }

  private frostWave(p: Player, durationMs: number) {
    const wave = this.add.circle(p.x, p.y, FROST_RADIUS, 0x80deea, 0.15).setStrokeStyle(6, 0x80deea).setScale(0.05);
    this.tweens.add({ targets: wave, scale: 1, alpha: 0, duration: 450, ease: 'Cubic.Out', onComplete: () => wave.destroy() });
    for (const m of this.monsters.getChildren() as Monster[]) {
      if (Phaser.Math.Distance.Between(p.x, p.y, m.x, m.y) < FROST_RADIUS) m.freeze(durationMs);
    }
    if (!this.teamMode) {
      for (const other of this.players) {
        if (other !== p && !other.isUntouchable() && Phaser.Math.Distance.Between(p.x, p.y, other.x, other.y) < FROST_RADIUS) {
          other.slowDown(durationMs);
        }
      }
    }
  }

  /** Aimant : attire l'étoile principale et les étoiles tombées. */
  private pullStars(p: Player) {
    if (this.star.active) {
      this.star.setPosition(
        Phaser.Math.Linear(this.star.x, p.x, MAGNET_PULL),
        Phaser.Math.Linear(this.star.y, p.y, MAGNET_PULL),
      );
    }
    for (const s of this.droppedStars.getChildren() as Img[]) {
      this.physics.moveToObject(s, p, 500);
    }
  }

  // ─── Monstres ────────────────────────────────────────────────────────

  private spawnMonster() {
    const elapsed = this.time.now - this.startedAt;
    if (this.over || this.bossPhase || this.monsters.countActive() >= MONSTER_SPAWN[Match.mode].max(elapsed)) return;
    // Apparaît sur un bord, loin des joueurs et hors des obstacles
    for (let attempt = 0; attempt < 10; attempt++) {
      const edge = Phaser.Math.Between(0, 3);
      const x = edge === 0 ? 40 : edge === 1 ? GAME_WIDTH - 40 : Phaser.Math.Between(40, GAME_WIDTH - 40);
      const y = edge === 2 ? 40 : edge === 3 ? GAME_HEIGHT - 40 : Phaser.Math.Between(40, GAME_HEIGHT - 40);
      if (this.isFree(x, y, 30) && this.players.every((p) => Phaser.Math.Distance.Between(x, y, p.x, p.y) > 250)) {
        this.spawnMonsterAt(pickMonsterType(elapsed).id, x, y);
        return;
      }
    }
  }

  private spawnMonsterAt(type: MonsterTypeId, x: number, y: number, hpMultiplier = 1): Monster {
    const m = new Monster(
      this,
      Phaser.Math.Clamp(x, 40, GAME_WIDTH - 40),
      Phaser.Math.Clamp(y, 40, GAME_HEIGHT - 40),
      MONSTERS[type],
      hpMultiplier,
    );
    this.monsters.add(m);
    return m.init();
  }

  /** Un point libre à environ `distance` de (x, y), dans l'arène. */
  private pointNear(x: number, y: number, distance: number): { x: number; y: number } {
    for (let i = 0; i < 12; i++) {
      const a = Phaser.Math.FloatBetween(0, Math.PI * 2);
      const px = x + Math.cos(a) * distance;
      const py = y + Math.sin(a) * distance;
      if (px > 40 && px < GAME_WIDTH - 40 && py > 40 && py < GAME_HEIGHT - 40 && this.isFree(px, py, 30)) return { x: px, y: py };
    }
    return { x, y };
  }

  private enemyShoot(from: Monster, angle: number, kind: 'goo' | 'orb') {
    const cfg = ENEMY_SHOTS[kind];
    Sound.sfx('enemyShot');
    const dist = from.def.radius + 10;
    const shot = this.enemyShots.create(from.x + Math.cos(angle) * dist, from.y + Math.sin(angle) * dist, kind) as Img;
    shot.setData('kind', kind).setCircle(shot.width / 2 - 1, 1, 1);
    shot.setVelocity(Math.cos(angle) * cfg.speed, Math.sin(angle) * cfg.speed);
    this.time.delayedCall(cfg.lifetimeMs, () => shot.destroy());
  }

  private onEnemyShot(p: Player, shot: Img) {
    if (!shot.active || this.over || p.hasEffect('shadow')) return;
    if (!p.hasEffect('shield')) {
      if (shot.getData('kind') === 'goo') {
        p.slowDown(1500);
        this.sparks.setParticleTint(0x76ff03).explode(10, shot.x, shot.y);
      } else {
        this.hitPlayer(p, shot.x, shot.y);
      }
    }
    this.destroyProjectile(shot);
  }

  /** Explosion de la Bombe : blesse joueurs et monstres alentour. */
  private explode(m: Monster) {
    if (!m.active) return;
    const { x, y } = m;
    m.destroy();
    this.blast(x, y, null);
  }

  /**
   * Explosion (Bombe ou mine) : blesse joueurs et monstres alentour.
   * `ownerIndex` = poseur de la mine (épargné, et pas de dégâts aux joueurs en équipe) ; null = monstre.
   */
  private blast(x: number, y: number, ownerIndex: number | null) {
    Sound.sfx('explosion');
    const blast = this.add.circle(x, y, BLAST_RADIUS, 0xff9800, 0.5).setScale(0.2);
    this.tweens.add({ targets: blast, scale: 1, alpha: 0, duration: 350, ease: 'Cubic.Out', onComplete: () => blast.destroy() });
    this.sparks.setParticleTint(0xff9800).explode(30, x, y);
    this.cameras.main.shake(200, 0.008);
    const spareTeam = ownerIndex !== null && this.teamMode;
    for (const p of this.players) {
      if (p.index === ownerIndex || spareTeam) continue;
      if (Phaser.Math.Distance.Between(x, y, p.x, p.y) < BLAST_RADIUS + 24) this.hitPlayer(p, x, y);
    }
    const killer = ownerIndex !== null ? this.players[ownerIndex] : null;
    let kills = 0;
    for (const other of [...this.monsters.getChildren()] as Monster[]) {
      if (!other.active || Phaser.Math.Distance.Between(x, y, other.x, other.y) > BLAST_RADIUS + other.def.radius) continue;
      if (other.damage(other.isBoss ? 6 : 99)) {
        this.killMonster(other, killer); // réaction en chaîne possible
        kills++;
      }
    }
    if (kills >= 3) this.achieve('chain-reaction');
  }

  private onMonsterTouch(p: Player, m: Monster) {
    if (!m.isDangerous) return;
    if (p.hasEffect('shield') && !m.isBoss) {
      // Le bouclier repousse les monstres
      const push = new Phaser.Math.Vector2(m.x - p.x, m.y - p.y).normalize().scale(600);
      m.body.setVelocity(push.x, push.y);
      return;
    }
    this.hitPlayer(p, m.x, m.y);
  }

  private onMonsterShot(proj: Img, m: Monster) {
    if (!proj.active || !m.active || !m.isHittable) return; // traverse un spectre disparu
    const pierce: boolean = proj.getData('pierce');
    if (pierce) {
      const hits: Set<unknown> = proj.getData('hits');
      if (hits.has(m)) return;
      hits.add(m);
    }
    this.sparks.setParticleTint(0xce93d8).explode(8, proj.x, proj.y);
    if (m.damage(proj.getData('damage'))) this.killMonster(m, this.players[proj.getData('owner')]);
    if (!pierce) proj.destroy();
  }

  /** `killer` = joueur qui reçoit l'épée (null pour une explosion). */
  private killMonster(m: Monster, killer: Player | null) {
    if (!m.active) return;
    const { x, y, def } = m;
    if (def.id === 'bombe') {
      this.explode(m); // tuée, elle explose quand même
    } else {
      this.sparks.setParticleTint(0x8e24aa).explode(30, x, y);
      Sound.sfx('monsterDie');
      m.destroy();
    }
    for (const c of Progress.addStat('monstersKilled')) this.showAchievement(c);
    if (def.id === 'mitose') {
      this.spawnMonsterAt('mini', x - 25, y);
      this.spawnMonsterAt('mini', x + 25, y);
    }
    if (def.id === 'boss') this.onBossDefeated(x, y);
    else killer?.giveSword(this.time.now);
  }

  // ─── Boss final (coopération et solo) ────────────────────────────────────────

  private startBossFight() {
    this.bossPhase = true;
    this.star.disableBody(true, true);
    for (const m of [...this.monsters.getChildren()] as Monster[]) {
      this.sparks.setParticleTint(0x8e24aa).explode(20, m.x, m.y);
      m.destroy();
    }
    this.enemyShots.clear(true, true);
    this.lives = Math.min(COOP_LIVES, this.lives + BOSS_BONUS_LIVES);
    Sound.sfx('bossRoar');
    Sound.playMusic('boss');

    const banner = this.add
      .text(GAME_WIDTH / 2, GAME_HEIGHT / 2, `⚠ BOSS FINAL ⚠\n👑 ${MONSTERS.boss.name}\n+${BOSS_BONUS_LIVES} ❤`, {
        fontFamily: FONT,
        fontSize: '64px',
        fontStyle: 'bold',
        align: 'center',
        color: '#ff5252',
        stroke: '#000000',
        strokeThickness: 10,
      })
      .setOrigin(0.5)
      .setDepth(30)
      .setScale(0);
    this.tweens.add({ targets: banner, scale: 1, duration: 500, ease: 'Back.Out' });
    this.tweens.add({ targets: banner, alpha: 0, delay: 2200, duration: 400, onComplete: () => banner.destroy() });
    this.cameras.main.shake(600, 0.008);
    for (const p of this.players) p.controls.rumble(1, 500);

    this.time.delayedCall(2000, () => {
      if (!this.over) this.boss = this.spawnMonsterAt('boss', GAME_WIDTH / 2, 150, Match.mode === 'solo' ? SOLO_BOSS_HP : 1);
    });
  }

  private onBossDefeated(x: number, y: number) {
    this.boss = null;
    // Ses invocations et projectiles disparaissent avec lui : plus rien ne peut coûter un cœur
    for (const m of [...this.monsters.getChildren()] as Monster[]) {
      this.sparks.setParticleTint(0x8e24aa).explode(15, m.x, m.y);
      m.destroy();
    }
    this.enemyShots.clear(true, true);
    // Série d'explosions avant l'écran de victoire
    for (let i = 0; i < 6; i++) {
      this.time.delayedCall(i * 120, () => {
        this.sparks.setParticleTint(Phaser.Utils.Array.GetRandom([0xffd54f, 0xff9800, 0xe040fb])).explode(30, x + Phaser.Math.Between(-60, 60), y + Phaser.Math.Between(-60, 60));
      });
    }
    this.cameras.main.shake(700, 0.012);
    for (const p of this.players) p.controls.rumble(1, 700);
    this.time.delayedCall(900, () => this.endGame('win', null));
  }

  // ─── Étoiles et caisses ──────────────────────────────────────────────

  /** L'étoile perdue est éjectée au sol, ramassable par n'importe qui pendant un moment. */
  private dropStar(x: number, y: number) {
    const s = this.droppedStars.create(x, y, 'star') as Img;
    const angle = Phaser.Math.FloatBetween(0, Math.PI * 2);
    s.setCollideWorldBounds(true).setBounce(0.8).setDrag(500);
    s.setVelocity(Math.cos(angle) * 380, Math.sin(angle) * 380);
    s.setData('pickableAt', this.time.now + 400); // sinon on la ramasse aussitôt
    this.time.delayedCall(DROPPED_STAR_LIFETIME_MS - 1500, () => {
      if (s.active) this.tweens.add({ targets: s, alpha: 0.2, duration: 150, yoyo: true, repeat: 4 });
    });
    this.time.delayedCall(DROPPED_STAR_LIFETIME_MS, () => s.destroy());
  }

  private pickDroppedStar(p: Player, s: Img) {
    if (!s.active || this.time.now < s.getData('pickableAt')) return;
    if (++this.droppedPicked[p.index] >= 5) this.achieve('thief');
    this.gainStar(p, s.x, s.y);
    s.destroy();
  }

  private collect(p: Player) {
    this.gainStar(p, this.star.x, this.star.y);
    if (!this.over && !this.bossPhase) this.respawnStar();
  }

  private gainStar(p: Player, x: number, y: number) {
    p.score++;
    p.starRumble();
    Sound.sfx('star');
    this.sparks.setParticleTint(0xffd54f).explode(20, x, y);
    if (this.teamMode) {
      this.teamScore++;
      if (this.teamScore >= starTarget(Match.mode) && !this.bossPhase) this.startBossFight();
    } else if (p.score >= SCORE_TO_WIN) {
      this.endGame('win', p);
    }
    this.refreshHud();
  }

  private respawnStar() {
    const { x, y } = this.randomFreePoint();
    this.star.setPosition(x, y);
  }

  private scheduleCrate() {
    this.time.delayedCall(CRATE_SPAWN_DELAY_MS, () => {
      if (this.over) return;
      const { x, y } = this.randomFreePoint();
      const weapon: WeaponDef = Phaser.Utils.Array.GetRandom(BONUS_WEAPONS);
      this.crate.enableBody(true, x, y, true, true).setData('weapon', weapon);
      this.crateIcon.setText(weapon.icon).setPosition(x, y).setVisible(true);
      this.crate.setScale(0);
      this.crateIcon.setScale(0);
      this.tweens.add({ targets: [this.crate, this.crateIcon], scale: 1, duration: 250, ease: 'Back.Out' });
    });
  }

  private pickCrate(p: Player) {
    if (!this.crate.active) return;
    const weapon: WeaponDef = this.crate.getData('weapon');
    p.equip(weapon, this.time.now);
    Sound.sfx('crate');
    this.floatText(this.crate.x, this.crate.y, `${weapon.icon} ${weapon.label}`, '#9ccc65');
    this.sparks.setParticleTint(0x9ccc65).explode(20, this.crate.x, this.crate.y);
    this.crate.disableBody(true, true);
    this.crateIcon.setVisible(false);
    if (++this.cratesPicked[p.index] >= 5) this.achieve('collector');
    this.scheduleCrate();
  }

  private scheduleHeart() {
    this.time.delayedCall(Phaser.Math.Between(HEART_SPAWN_MS.min, HEART_SPAWN_MS.max), () => {
      if (this.over) return;
      this.scheduleHeart();
      if (this.heart.active || this.lives >= COOP_LIVES) return; // inutile si l'équipe est en pleine forme
      const { x, y } = this.randomFreePoint();
      this.heart.enableBody(true, x, y, true, true).setAlpha(1);
      const token = ++this.heartToken;
      this.time.delayedCall(HEART_LIFETIME_MS - 2000, () => {
        if (token === this.heartToken && this.heart.active) {
          this.tweens.add({ targets: this.heart, alpha: 0.2, duration: 150, yoyo: true, repeat: 6 });
        }
      });
      this.time.delayedCall(HEART_LIFETIME_MS, () => {
        if (token === this.heartToken) this.heart.disableBody(true, true);
      });
    });
  }

  private pickHeart(p: Player) {
    if (!this.heart.active || this.lives >= COOP_LIVES) return;
    this.lives++;
    Sound.sfx('heart');
    this.heartToken++; // annule l'expiration programmée
    const { x, y } = this.heart;
    this.heart.disableBody(true, true);
    this.sparks.setParticleTint(0xff5252).explode(20, x, y);
    p.controls.rumble(0.6, 150);
    const label = this.add
      .text(x, y, '+1 ❤', { fontFamily: FONT, fontSize: '28px', fontStyle: 'bold', color: '#ff5252', stroke: '#000000', strokeThickness: 5 })
      .setOrigin(0.5)
      .setDepth(25);
    this.tweens.add({ targets: label, y: y - 60, alpha: 0, duration: 900, ease: 'Cubic.Out', onComplete: () => label.destroy() });
    this.refreshHud();
  }

  // ─── Interface ───────────────────────────────────────────────────────

  private buildHud() {
    this.hudTexts = this.players.map((_p, i) =>
      this.add
        .text(i === 0 ? 24 : GAME_WIDTH - 24, 16, '', {
          fontFamily: FONT,
          fontSize: '24px',
          fontStyle: 'bold',
          align: i === 0 ? 'left' : 'right',
          color: css(PLAYER_COLORS[i]),
          stroke: '#000000',
          strokeThickness: 4,
        })
        .setOrigin(i === 0 ? 0 : 1, 0)
        .setDepth(20),
    );
    this.teamText = this.add
      .text(GAME_WIDTH / 2, 16, '', { fontFamily: FONT, fontSize: '30px', fontStyle: 'bold', color: '#ffffff', stroke: '#000000', strokeThickness: 5 })
      .setOrigin(0.5, 0)
      .setDepth(20)
      .setVisible(this.teamMode);
    this.bossBar = this.add.graphics().setDepth(20);
    this.refreshHud();
  }

  private refreshHud() {
    const now = this.time.now;
    this.players.forEach((p, i) => {
      const lines = [`J${i + 1} ${p.character.emoji} ${p.character.name}${this.teamMode ? '' : ` : ${p.score}`}`];
      const cooldown = p.powerCooldownLeft(now);
      lines.push(cooldown > 0 ? `${p.character.power.name} ${Math.ceil(cooldown / 1000)}s` : `Ⓨ ${p.character.power.name} prêt`);
      const weaponLeft = p.weaponTimeLeft(now);
      if (weaponLeft > 0) lines.push(`${p.weapon.label} ${Math.ceil(weaponLeft / 1000)}s`);
      const swordLeft = p.swordTimeLeft(now);
      if (swordLeft > 0) lines.push(`Épée ${Math.ceil(swordLeft / 1000)}s${p.swordSheathed ? ' (rangée, Ⓑ)' : ''}`);
      this.hudTexts[i].setText(lines.join('\n'));
    });
    if (this.teamMode) {
      const hearts = '❤'.repeat(Math.max(0, this.lives)) + '♡'.repeat(COOP_LIVES - Math.max(0, this.lives));
      this.teamText.setText(this.bossPhase ? `👑 ${MONSTERS.boss.name}     ${hearts}` : `⭐ ${this.teamScore} / ${starTarget(Match.mode)}     ${hearts}`);
    }
    this.bossBar.clear();
    if (this.boss?.active) {
      const w = 480;
      const x = GAME_WIDTH / 2 - w / 2;
      this.bossBar.fillStyle(0x000000, 0.6).fillRoundedRect(x - 4, 56, w + 8, 22, 6);
      this.bossBar.fillStyle(this.boss.hpRatio > 1 / 3 ? 0xe040fb : 0xff5252).fillRoundedRect(x, 60, w * this.boss.hpRatio, 14, 4);
    }
  }

  /** Valide un défi ; l'annonce attend le podium si la partie est finie. */
  private achieve(id: ChallengeId) {
    const c = Progress.complete(id);
    if (c) this.showAchievement(c);
  }

  private showAchievement(c: ChallengeDef) {
    if (this.over) this.endAchievements.push(c);
    else showChallengeToast(this, c);
  }

  private floatText(x: number, y: number, text: string, color: string) {
    const label = this.add
      .text(x, y, text, { fontFamily: FONT, fontSize: '24px', fontStyle: 'bold', color, stroke: '#000000', strokeThickness: 5 })
      .setOrigin(0.5)
      .setDepth(25);
    this.tweens.add({ targets: label, y: y - 60, alpha: 0, duration: 1000, ease: 'Cubic.Out', onComplete: () => label.destroy() });
  }

  private endGame(outcome: 'win' | 'lose', winner: Player | null) {
    if (this.over) return;
    this.over = true;
    this.physics.pause();
    this.time.paused = true; // fige aussi les apparitions de monstres et de caisses
    if (outcome === 'win') {
      if (Match.mode === 'versus') this.achieve('first-win');
      else {
        this.achieve('regicide');
        if (this.livesLostInBoss === 0) this.achieve('untouchable');
        if (Match.mode === 'solo') this.achieve('lone-hero');
      }
    }
    const data: PodiumData = {
      mode: Match.mode,
      outcome,
      winnerIndex: winner?.index ?? null,
      scores: this.players.map((p) => p.score),
      teamScore: this.teamScore,
      reachedBoss: this.bossPhase,
      achievements: this.endAchievements,
    };
    this.scene.launch('Podium', data);
  }
}
