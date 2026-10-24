import Phaser from 'phaser';
import { createCharacter } from '../characters/registry';
import { SCENE_KEYS } from '../config/sceneKeys';
import { GOLD, PROGRESSION, PROP_MAGNET_CHANCE, REVIVAL, ROUND } from '../config/gameplayConfig';
import type { Character } from '../entities/Character';
import type { Enemy } from '../entities/Enemy';
import type { Projectile } from '../entities/Projectile';
import { CompositeMoveInput } from '../input/CompositeMoveInput';
import { KeyboardMoveInput } from '../input/KeyboardMoveInput';
import type { MoveInput } from '../input/MoveInput';
import { Pickup } from '../entities/Pickup';
import type { BreakableProp } from '../entities/BreakableProp';
import { applyMetaUpgrades } from '../meta/metaUpgrades';
import { saveData } from '../meta/saveData';
import { PlayerStats } from '../progression/PlayerStats';
import { ProgressionSystem, type ProgressState } from '../progression/ProgressionSystem';
import { passiveTypesTaken, passivesTaken, pickUpgradeChoices, type UpgradeContext, type UpgradeDefinition } from '../progression/upgrades';
import { AutoAttackSystem } from '../systems/AutoAttackSystem';
import { BossAttackSystem } from '../systems/BossAttackSystem';
import { CameraRig } from '../systems/CameraRig';
import { HERO_WEAPONS, type HeroWeapon } from '../systems/HeroWeapons';
import { MissileWeapon } from '../systems/MissileWeapon';
import { MeleeAttackSystem } from '../systems/MeleeAttackSystem';
import { RangedAttackSystem } from '../systems/RangedAttackSystem';
import { RoundController, type HudState } from '../systems/RoundController';
import { TIME_STOP, TimeStopUltimate } from '../systems/TimeStopUltimate';
import { WaveSystem } from '../systems/WaveSystem';
import { damageArea } from '../systems/areaDamage';
import { TestMap } from '../world/TestMap';
import type { HudScene } from './HudScene';

/** Oro de la ronda: lo juntado hasta ahora y, al terminar, lo que se guarda en el progreso. */
export interface GoldState {
  gold: number;
  goldPayout: number | null;
}

/** Estado que dibuja el HUD: ronda + experiencia + oro. */
export type HudSnapshot = HudState & ProgressState & GoldState & { passives: { id: string; count: number }[] };

/** Una ronda: oleadas de enemigos, ataque automático, jefe final y resultado. */
export class GameScene extends Phaser.Scene {
  private player!: Character;
  private moveInput!: MoveInput;
  private enemies!: Phaser.Physics.Arcade.Group;
  private attack!: AutoAttackSystem;
  private missiles!: MissileWeapon;
  private rangedAttacks!: RangedAttackSystem;
  private meleeAttacks!: MeleeAttackSystem;
  private bossAttacks!: BossAttackSystem;
  private waves!: WaveSystem;
  private round!: RoundController;
  private frozen = false;
  private stats = new PlayerStats();
  private progression = new ProgressionSystem();
  /** Veces que se eligió cada mejora en esta ronda (algunas tienen requisitos, como la evolución). */
  private taken: Record<string, number> = {};
  private heroWeapon: HeroWeapon | null = null;
  /** Mejoras desterradas en esta ronda (no vuelven a salir). */
  private banished = new Set<string>();
  /** Usos de repetir, saltear y desterrar con los que empezó la ronda. */
  private toolTotals = { reroll: 0, skip: 0, banish: 0 };
  private pickups: Pickup[] = [];
  private gold = 0;
  /** Oro que se guardó al terminar la ronda (null mientras se juega). */
  private goldPayout: number | null = null;
  private hud!: HudScene;
  /** Reloj de la ronda: no avanza mientras se elige una mejora. */
  private clock = 0;
  private ultimateKey: Phaser.Input.Keyboard.Key | null = null;
  private ironManFlyingUntil = 0;
  private timeStop: TimeStopUltimate | null = null;
  private nextUltimateShotAt = 0;
  private ultimateReadyAt = 0;
  private ironManFlightEffect: Phaser.GameObjects.Container | null = null;
  private ironManBaseMoveSpeed = 0;
  private ironManBaseScaleX = 1;
  private ironManBaseScaleY = 1;
  private nextIronManCloudAt = 0;
  private environmentObstacles!: Phaser.Physics.Arcade.StaticGroup;
  private playerObstacleCollider!: Phaser.Physics.Arcade.Collider;

  constructor() {
    super(SCENE_KEYS.game);
  }

  create(): void {
    this.frozen = false;
    const testParam = new URLSearchParams(window.location.search).get('test');
    const testMode = testParam === '1';
    const doombotTest = testParam === 'doombots';
    this.clock = testMode ? Math.max(0, ROUND.durationMs - 60_000) : 0;
    this.ironManFlyingUntil = 0;
    this.timeStop = null;
    this.nextUltimateShotAt = 0;
    this.ultimateReadyAt = 0;
    this.ironManFlightEffect?.destroy();
    this.ironManFlightEffect = null;
    this.nextIronManCloudAt = 0;
    this.stats = new PlayerStats();
    this.progression = new ProgressionSystem();
    this.taken = {};
    this.pickups = [];
    this.banished = new Set();
    this.gold = 0;
    this.goldPayout = null;
    const map = new TestMap(this);
    map.build();
    this.environmentObstacles = map.obstacles;
    this.physics.world.setBounds(0, 0, map.widthPx, map.heightPx);

    // Al recibir un golpe la cámara vibra más cuanto más duele.
    this.events.off('player-hurt');
    this.events.on('player-hurt', (dealt: number, maxHealth: number) => {
      const strength = Phaser.Math.Clamp(dealt / (maxHealth * 0.2), 0.3, 1);
      this.cameras.main.shake(70 + 50 * strength, 0.0008 + 0.0022 * strength);
    });

    this.player = createCharacter(this, saveData.selectedCharacter, map.spawn.x, map.spawn.y);
    this.ultimateKey = this.input.keyboard?.addKey(Phaser.Input.Keyboard.KeyCodes.E) ?? null;
    if (this.player.definition.id === 'strange') this.timeStop = new TimeStopUltimate(this, this.player);
    this.playerObstacleCollider = this.physics.add.collider(this.player, map.obstacles);
    applyMetaUpgrades({ stats: this.stats, player: this.player });
    this.ironManBaseMoveSpeed = this.player.moveSpeed;
    this.ironManBaseScaleX = this.player.scaleX;
    this.ironManBaseScaleY = this.player.scaleY;
    this.toolTotals = { reroll: this.stats.rerolls, skip: this.stats.skips, banish: this.stats.banishes };
    map.onPropBroken = (prop) => this.dropPropGold(prop);

    this.enemies = this.physics.add.group();
    this.physics.add.collider(this.enemies, map.obstacles);
    this.physics.add.collider(this.enemies, this.enemies);
    this.attack = new AutoAttackSystem(
      this,
      this.player,
      this.player.definition.stats.attack,
      this.enemies,
      this.stats,
      () => map.breakables,
    );

    this.heroWeapon =
      HERO_WEAPONS[this.player.definition.id]?.create({
        scene: this,
        owner: this.player,
        enemies: this.enemies,
        stats: this.stats,
        props: () => map.breakables,
      }) ?? null;

    this.missiles = new MissileWeapon(
      this,
      this.player,
      this.enemies,
      this.stats,
      (x, y, radius, damage) =>
        map.damagePropsInRadius(x, y, radius, damage),
      () => map.breakables,
    );
    // Los minimisiles son el arma principal de Iron Man.
    if (this.player.definition.stats.attack.kind === 'rocket') this.missiles.unlock();

    this.rangedAttacks = new RangedAttackSystem(
      this,
      this.player,
      { width: map.widthPx, height: map.heightPx },
    );
    this.meleeAttacks = new MeleeAttackSystem(
      this.player,
      () => this.clock < this.ironManFlyingUntil,
    );

    this.waves = new WaveSystem(this, this.enemies, this.player, { width: map.widthPx, height: map.heightPx }, (e) => {
      this.dropLoot(e);
      this.round.onEnemyKilled(e);
    }, this.stats, doombotTest);
    this.bossAttacks = new BossAttackSystem(
      this,
      this.player,
      this.waves,
      { width: map.widthPx, height: map.heightPx },
    );
    this.round = new RoundController(0, this.player, this.waves, this.enemies);

    // Proyectiles que tocan enemigos.
    this.physics.add.overlap(this.attack.projectiles, this.enemies, (p, e) => {
      const projectile = p as Projectile;
      const enemy = e as Enemy;
      if (enemy.dying || !projectile.canHit(enemy)) return;
      enemy.takeDamage(projectile.damage);
      if (projectile.slow && !enemy.dying) {
        // El jefe no queda inmóvil del todo: solo se frena mucho.
        const factor = projectile.slow.factor === 0 && enemy.kind.id === 'overlord' ? 0.5 : projectile.slow.factor;
        enemy.applySlow(projectile.slow.ms, factor);
      }
      if (projectile.isBouncer) projectile.rebound(enemy);
      else if (projectile.registerHit(enemy)) projectile.destroy();
    });

    // Los disparos del repulsor también rompen cajas y rocas (las atraviesan, como a los enemigos con perforación).
    this.physics.add.overlap(this.attack.projectiles, map.obstacles, (p, o) => {
      const projectile = p as Projectile;
      const prop = (o as Phaser.GameObjects.GameObject).getData('prop') as BreakableProp | undefined;
      if (!prop || prop.isBroken || !projectile.canHit(prop)) return;
      projectile.markHit(prop);
      prop.takeDamage(projectile.damage);
    });

    // HUD (vida, tiempo, joystick táctil) en una escena aparte encima.
    this.scene.stop(SCENE_KEYS.hud);
    this.scene.launch(SCENE_KEYS.hud);
    const hud = this.scene.get(SCENE_KEYS.hud) as HudScene;
    this.hud = hud;
    this.moveInput = new CompositeMoveInput([new KeyboardMoveInput(this), { getVector: () => hud.touchVector }]);

    new CameraRig(this, this.player, { width: map.widthPx, height: map.heightPx });

    // Al volver del menú (CONTINUAR) la ronda sigue en pausa hasta que el jugador toque SEGUIR.
    this.events.on(Phaser.Scenes.Events.WAKE, () => this.scene.pause());
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scene.stop(SCENE_KEYS.hud);
      this.meleeAttacks.destroy();
      this.rangedAttacks.destroy();
    });
  }

  isIronManSelected(): boolean {
    return this.player?.definition.id === 'ironman';
  }

  /** ¿El héroe elegido tiene ultimate? (Iron Man: vuelo · Doctor Strange: tiempo detenido). */
  hasUltimate(): boolean {
    return this.isIronManSelected() || this.timeStop !== null;
  }

  /** Estado de la ultimate para el control del HUD. */
  getUltimateState(): { active: boolean; remainingMs: number; activeRemainingMs: number; activeLabel: string } {
    const stopActive = this.timeStop?.isActive(this.clock) ?? false;
    const active = stopActive || (this.isIronManSelected() && this.clock < this.ironManFlyingUntil);
    const activeRemainingMs = stopActive
      ? (this.timeStop?.remainingMs(this.clock) ?? 0)
      : active
        ? Math.max(0, this.ironManFlyingUntil - this.clock)
        : 0;
    return {
      active,
      remainingMs: active ? 0 : Math.max(0, this.ultimateReadyAt - this.clock),
      activeRemainingMs,
      activeLabel: stopActive ? 'TIEMPO' : 'VUELO',
    };
  }

  /** Activa el vuelo de Iron Man con E o desde el botón táctil del HUD. */
  activateUltimate(): void {
    if (this.timeStop) {
      if (this.round.ended || this.frozen || this.player.isDead) return;
      if (this.timeStop.isActive(this.clock) || this.clock < this.ultimateReadyAt) return;
      this.timeStop.start(this.clock);
      return;
    }
    if (this.player.definition.id !== 'ironman' || this.round.ended || this.frozen || this.player.isDead) return;
    if (this.clock < this.ironManFlyingUntil || this.clock < this.ultimateReadyAt) return;
    this.ironManFlyingUntil = this.clock + 5000;
    this.playerObstacleCollider.active = false;
    this.nextUltimateShotAt = this.clock + 500;
    this.nextIronManCloudAt = this.clock + 180;
    this.player.setFlightHeight(9);
    this.player.setMoveSpeed(this.player.moveSpeed * (125 / 85.5));
    this.player.setScale(this.ironManBaseScaleX * 1.08, this.ironManBaseScaleY * 1.08);
    this.player.setTint(0xb9f4ff);
    this.ironManFlightEffect?.destroy();

    // Propulsores y resplandor bajo los pies para que el vuelo se distinga del movimiento normal.
    const flightShadow = this.add.ellipse(0, 13, 30, 10, 0x43dfff, 0.25);
    const leftGlow = this.add.ellipse(-7, 5, 11, 23, 0x47cfff, 0.32);
    const rightGlow = this.add.ellipse(7, 5, 11, 23, 0x47cfff, 0.32);
    const leftThruster = this.add.ellipse(-7, 5, 7, 22, 0xffa640, 0.98);
    const rightThruster = this.add.ellipse(7, 5, 7, 22, 0xffa640, 0.98);
    const leftCore = this.add.ellipse(-7, 5, 3.5, 15, 0xd7fbff, 1);
    const rightCore = this.add.ellipse(7, 5, 3.5, 15, 0xd7fbff, 1);
    this.ironManFlightEffect = this.add.container(this.player.x, this.player.y + 7, [
      flightShadow, leftGlow, rightGlow, leftThruster, rightThruster, leftCore, rightCore,
    ]).setDepth(this.player.y - 1);
    this.tweens.add({
      targets: [leftGlow, rightGlow, leftThruster, rightThruster, leftCore, rightCore],
      scaleY: { from: 0.7, to: 1.3 },
      alpha: { from: 0.55, to: 1 },
      duration: 100,
      yoyo: true,
      repeat: -1,
    });
  }

  private updateUltimate(now: number): void {
    if (this.timeStop) {
      if (this.timeStop.update(now, this.enemies.getChildren() as Enemy[])) this.ultimateReadyAt = now + TIME_STOP.cooldownMs;
      return;
    }
    if (this.player.definition.id !== 'ironman' || now >= this.ironManFlyingUntil) {
      if (this.ironManFlyingUntil > 0 && now >= this.ironManFlyingUntil) {
        this.ironManFlyingUntil = 0;
        this.ultimateReadyAt = now + 40_000;
        this.player.setFlightHeight(0);
        this.moveIronManToNearestFreeSpot();
        this.playerObstacleCollider.active = true;
        this.player.setMoveSpeed(this.ironManBaseMoveSpeed);
        this.player.setScale(this.ironManBaseScaleX, this.ironManBaseScaleY);
        this.player.clearTint();
        this.ironManFlightEffect?.destroy();
        this.ironManFlightEffect = null;
      }
      return;
    }

    // Leve flotación vertical para que el personaje no quede rígido en el aire.
    this.player.setFlightHeight(8 + Math.sin(now / 180) * 2);
    this.ironManFlightEffect?.setPosition(this.player.x, this.player.y + 7).setDepth(this.player.y - 1);
    if (now >= this.nextIronManCloudAt) {
      this.spawnIronManCloud();
      this.nextIronManCloudAt = now + Phaser.Math.Between(260, 420);
    }
    while (now >= this.nextUltimateShotAt && this.nextUltimateShotAt < this.ironManFlyingUntil) {
      const impactX = this.player.x;
      const impactY = this.player.y - 8;
      // Cada misil hace 1,5 veces el daño anterior: 12 -> 18.
      this.spawnIronManUltimateMissile(impactX, impactY, 25);
      this.nextUltimateShotAt += 500;
    }
  }

  /**
   * Al aterrizar, busca el punto libre más cercano para evitar que Iron Man quede
   * incrustado en un árbol, una roca, una caja o una estructura del escenario.
   */
  private moveIronManToNearestFreeSpot(): void {
    const body = this.player.body as Phaser.Physics.Arcade.Body;
    const obstacles = this.environmentObstacles.getChildren() as Phaser.GameObjects.Rectangle[];
    const blockedRects = obstacles
      .map((object) => object.body as Phaser.Physics.Arcade.StaticBody)
      .filter((obstacleBody) => obstacleBody && obstacleBody.enable)
      .map((obstacleBody) => new Phaser.Geom.Rectangle(
        obstacleBody.x, obstacleBody.y, obstacleBody.width, obstacleBody.height,
      ));
    const currentX = body.x;
    const currentY = body.y;
    const bounds = this.physics.world.bounds;
    const isFree = (x: number, y: number): boolean => {
      const candidate = new Phaser.Geom.Rectangle(x, y, body.width, body.height);
      if (x < bounds.left || y < bounds.top || x + body.width > bounds.right || y + body.height > bounds.bottom) return false;
      return !blockedRects.some((obstacle) => Phaser.Geom.Intersects.RectangleToRectangle(candidate, obstacle));
    };

    if (isFree(currentX, currentY)) return;

    // Búsqueda en anillos: el primer punto libre es el más cercano en la cuadrícula de 8 px.
    const step = 8;
    const maxRadius = Math.max(bounds.width, bounds.height);
    for (let radius = step; radius <= maxRadius; radius += step) {
      for (let dx = -radius; dx <= radius; dx += step) {
        for (const dy of [-radius, radius]) {
          if (isFree(currentX + dx, currentY + dy)) {
            this.player.setPosition(this.player.x + dx, this.player.y + dy);
            body.updateFromGameObject();
            return;
          }
        }
      }
      for (let dy = -radius + step; dy < radius; dy += step) {
        for (const dx of [-radius, radius]) {
          if (isFree(currentX + dx, currentY + dy)) {
            this.player.setPosition(this.player.x + dx, this.player.y + dy);
            body.updateFromGameObject();
            return;
          }
        }
      }
    }
  }

  /** Misil visible que cae sobre la posición actual del jugador y aplica el daño al impactar. */
  private spawnIronManUltimateMissile(targetX: number, targetY: number, damage: number): void {
    const startX = targetX + Phaser.Math.Between(-22, 22);
    const startY = targetY - 105;
    const trail = this.add.ellipse(0, -13, 5, 23, 0xffa34a, 0.55);
    const body = this.add.rectangle(0, 0, 7, 17, 0xdce8f2, 1);
    body.setStrokeStyle(1, 0x536779, 1);
    const nose = this.add.triangle(0, 11, -4, -2, 4, -2, 0, 5, 0xff6045, 1);
    const finLeft = this.add.triangle(-5, 5, 0, -3, -5, 4, 0, 5, 0xe84f43, 1);
    const finRight = this.add.triangle(5, 5, 0, -3, 5, 4, 0, 5, 0xe84f43, 1);
    const missile = this.add.container(startX, startY, [trail, body, nose, finLeft, finRight]);
    missile.setDepth(999_999);
    this.tweens.add({
      targets: missile,
      x: targetX,
      y: targetY,
      duration: 260,
      ease: 'Quad.easeIn',
      onComplete: () => {
        missile.destroy();
        damageArea(this.enemies, [], targetX, targetY, 30, damage);
        // Destello cálido pequeño; se elimina el antiguo círculo azul de impacto.
        const flash = this.add.star(targetX, targetY, 7, 2, 6, 0xffa34a, 0.8).setDepth(999_998);
        this.tweens.add({
          targets: flash,
          scale: 1.8,
          alpha: 0,
          duration: 170,
          onComplete: () => flash.destroy(),
        });
      },
    });
  }

  /** Pequeñas nubes de estela: aparecen de forma espaciada y se desvanecen rápido. */
  private spawnIronManCloud(): void {
    const x = this.player.x + Phaser.Math.Between(-9, 9);
    const y = this.player.y + Phaser.Math.Between(7, 17);
    const puff = this.add.container(x, y);
    const shade = Phaser.Math.Between(0, 1) ? 0xe5f8ff : 0xc9eefa;
    const parts = [
      this.add.ellipse(-4, 1, 11, 7, shade, 0.22),
      this.add.ellipse(2, -1, 13, 9, shade, 0.25),
      this.add.ellipse(7, 2, 9, 6, 0xffffff, 0.2),
    ];
    puff.add(parts);
    puff.setDepth(this.player.y - 2);
    this.tweens.add({
      targets: puff,
      x: x + Phaser.Math.Between(-12, 12),
      y: y + Phaser.Math.Between(12, 20),
      alpha: 0,
      scaleX: 1.45,
      scaleY: 1.3,
      duration: 520,
      onComplete: () => puff.destroy(),
    });
  }

  getHudState(): HudSnapshot {
    return {
      ...this.round.getHudState(this.clock),
      ...this.progression.getState(),
      gold: Math.floor(this.gold),
      goldPayout: this.goldPayout,
      passives: passivesTaken(this.taken),
    };
  }

  /** Al morir un enemigo: gema de experiencia y, con cierta chance, una moneda. */
  private dropLoot(enemy: Enemy): void {
    const { xpValue, gold } = enemy.kind;
    if (xpValue > 0) this.pickups.push(new Pickup(this, enemy.x, enemy.y - 4, 'xp', xpValue));
    if (gold && Math.random() < gold.chance * this.stats.goldChanceMult) {
      this.pickups.push(new Pickup(this, enemy.x + 4, enemy.y - 2, 'gold', gold.value));
    }
  }

  /** Al romperse una caja o roca: monedas repartidas alrededor. */
  private dropPropGold(prop: BreakableProp): void {
    const coins = prop.rollGold();
    for (let i = 0; i < coins; i++) {
      const x = prop.x + Phaser.Math.Between(-10, 10);
      const y = prop.y + Phaser.Math.Between(-6, 8);
      this.pickups.push(new Pickup(this, x, y, 'gold', 1));
    }
    if (Math.random() < PROP_MAGNET_CHANCE) this.pickups.push(new Pickup(this, prop.x, prop.y - 4, 'magnet', 0));
  }

  /** Mueve lo que se junta hacia el jugador cuando está cerca y suma lo que llega. */
  private updatePickups(delta: number): void {
    const radiusSq = this.stats.pickupRadius ** 2;
    const targetY = this.player.y - 8;
    let pulledAll = false;
    this.pickups = this.pickups.filter((pickup) => {
      if (!pickup.isMagnetized) {
        const dx = this.player.x - pickup.x;
        const dy = targetY - pickup.y;
        if (dx * dx + dy * dy <= radiusSq) pickup.magnetize();
      }
      if (pickup.isMagnetized && pickup.moveToward(this.player.x, targetY, delta)) {
        if (pickup.kind === 'xp') this.progression.addXp(pickup.value * this.stats.xpMult);
        else if (pickup.kind === 'gold') this.gold += pickup.value * this.stats.goldMult;
        else pulledAll = true;
        pickup.destroy();
        return false;
      }
      return true;
    });
    // Imán: toda la experiencia que hay en el piso, en todo el mapa, va hacia el jugador.
    if (pulledAll) for (const pickup of this.pickups) if (pickup.kind === 'xp') pickup.magnetize();
  }

  /** Al terminar la ronda: decide cuánto oro se guarda (todo si gana, la mitad si pierde). */
  private bankGold(): void {
    const won = this.round.phase === 'won';
    const total = won ? this.gold + GOLD.bossBonus * this.stats.goldMult : this.gold * GOLD.defeatKeepRatio;
    this.goldPayout = Math.floor(total);
    saveData.addGold(this.goldPayout);
  }

  /** Pausa la ronda y ofrece mejoras al HUD; al elegir, se aplica y se sigue. */
  private openLevelUp(): void {
    this.progression.pendingLevelUps--;
    this.scene.pause();
    this.offerUpgrades();
  }

  private upgradeContext(): UpgradeContext {
    return {
      stats: this.stats,
      player: this.player,
      missiles: this.missiles,
      taken: this.taken,
      basicKind: this.player.definition.stats.attack.kind,
      heroId: this.player.definition.id,
      heroWeapon: this.heroWeapon,
    };
  }

  /** Sortea las opciones y las muestra; repetir y desterrar vuelven acá con otras opciones. */
  private offerUpgrades(): void {
    const ctx = this.upgradeContext();
    const stats = this.stats;
    this.hud.showUpgrades({
      level: this.progression.level,
      choices: pickUpgradeChoices(PROGRESSION.upgradeChoices, ctx, this.banished),
      note: `Mejoras pasivas: ${passiveTypesTaken(this.taken)}/${PROGRESSION.maxPassiveTypes} tipos`,
      tools: {
        reroll: { left: stats.rerolls, total: this.toolTotals.reroll },
        skip: { left: stats.skips, total: this.toolTotals.skip },
        banish: { left: stats.banishes, total: this.toolTotals.banish },
      },
      onPick: (choice: UpgradeDefinition) => {
        choice.apply(ctx);
        this.taken[choice.id] = (this.taken[choice.id] ?? 0) + 1;
        this.scene.resume();
      },
      onReroll: () => {
        this.spendTool('rerolls');
        this.offerUpgrades();
      },
      onSkip: () => {
        this.spendTool('skips');
        this.progression.addXp(this.progression.xpToNext * PROGRESSION.skipXpRatio);
        this.scene.resume();
      },
      onBanish: (choice: UpgradeDefinition) => {
        this.spendTool('banishes');
        this.banished.add(choice.id);
        this.offerUpgrades();
      },
    });
  }

  /** Gasta un uso de repetir, saltear o desterrar (la mejora permanente Conservar puede evitarlo). */
  private spendTool(tool: 'rerolls' | 'skips' | 'banishes'): void {
    if (Math.random() >= this.stats.preserveChance) this.stats[tool]--;
  }

  /** Si hay una resurrección disponible, vuelve a la vida y aleja a los enemigos de alrededor. */
  private tryRevive(): boolean {
    if (!this.player.isDead || this.stats.revivals <= 0) return false;
    this.stats.revivals--;
    this.player.revive(REVIVAL.healthRatio, REVIVAL.protectedMs);
    for (const enemy of this.enemies.getChildren() as Enemy[]) {
      if (!enemy.active || enemy.dying || enemy.kind.id === 'overlord') continue;
      if (Phaser.Math.Distance.Between(enemy.x, enemy.y, this.player.x, this.player.y) <= REVIVAL.blastRadius) enemy.takeDamage(REVIVAL.blastDamage);
    }
    const blast = this.add.circle(this.player.x, this.player.y, REVIVAL.blastRadius, 0xffffff, 0.6).setDepth(999_999).setScale(0.2);
    this.tweens.add({ targets: blast, scale: 1, alpha: 0, duration: 400, onComplete: () => blast.destroy() });
    return true;
  }

  update(_time: number, delta: number): void {
    if (this.round.ended) {
      if (!this.frozen) {
        this.frozen = true;
        this.timeStop?.cancel(this.enemies.getChildren() as Enemy[]);
        this.ironManFlightEffect?.destroy();
        this.ironManFlightEffect = null;
        this.ironManFlyingUntil = 0;
        this.player.setFlightHeight(0);
        this.moveIronManToNearestFreeSpot();
        this.playerObstacleCollider.active = true;
        this.player.setMoveSpeed(this.ironManBaseMoveSpeed);
        this.player.setScale(this.ironManBaseScaleX, this.ironManBaseScaleY);
        this.player.clearTint();
        this.physics.pause();
        if (this.round.phase === 'lost') this.player.defeat();
        this.bankGold();
      }
      return;
    }

    this.clock += delta;
    const now = this.clock;
    if (this.ultimateKey && Phaser.Input.Keyboard.JustDown(this.ultimateKey)) this.activateUltimate();
    this.updateUltimate(now);
    this.player.step(this.moveInput.getVector());
    this.attack.update(now);
    this.missiles.update(now, delta);
    this.heroWeapon?.update(now, delta);
    this.updatePickups(delta);
    const regenPerSecond = this.stats.regenPerSecond + (this.player.definition.id === 'hulk' ? 0.2 : 0);
    if (regenPerSecond > 0) this.player.heal((regenPerSecond * delta) / 1000);
    const activeEnemies = (this.enemies.getChildren() as Enemy[]).filter((enemy) => enemy.active && !enemy.dying);
    const currentSpeedScale = this.waves.getScaling(now / ROUND.durationMs).speed;
    for (const enemy of activeEnemies) {
      enemy.syncTimeSpeed(currentSpeedScale);
      let separationX = 0;
      let separationY = 0;
      for (let otherIndex = 0; otherIndex < activeEnemies.length; otherIndex++) {
        const other = activeEnemies[otherIndex];
        if (enemy === other) continue;
        let dx = enemy.x - other.x;
        let dy = enemy.y - other.y;
        let distance = Math.hypot(dx, dy);
        const spacing = enemy.kind.id === 'overlord' || other.kind.id === 'overlord' ? 27 : 17;
        if (distance < spacing) {
          if (distance < 0.001) {
            const angle = ((activeEnemies.indexOf(enemy) + 1) * 2.399963229728653 + (otherIndex + 1)) % (Math.PI * 2);
            dx = Math.cos(angle);
            dy = Math.sin(angle);
            distance = 1;
          }
          const strength = (spacing - distance) / spacing;
          separationX += (dx / distance) * strength;
          separationY += (dy / distance) * strength;
        }
      }
      const separationLength = Math.hypot(separationX, separationY);
      if (separationLength > 0) {
        separationX /= separationLength;
        separationY /= separationLength;
      }
      enemy.chase(this.player.x, this.player.y - 6, separationX, separationY);
    }
    this.tryRevive();
    const timeStopped = this.timeStop?.isActive(now) ?? false;
    if (!timeStopped) this.rangedAttacks.update(now, delta, activeEnemies);
    this.meleeAttacks.update(now, activeEnemies);
    this.round.update(now);
    if (!timeStopped) this.bossAttacks.update(now, delta, this.round.currentBoss);


    if (this.progression.pendingLevelUps > 0 && !this.round.ended) this.openLevelUp();
  }
}
