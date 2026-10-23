import Phaser from 'phaser';
import { createCharacter } from '../characters/registry';
import { IRON_MAN_ID } from '../characters/ironman/ironManDefinition';
import { SCENE_KEYS } from '../config/sceneKeys';
import { GOLD, PROGRESSION, ROUND } from '../config/gameplayConfig';
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
import { pickUpgradeChoices, type UpgradeContext, type UpgradeDefinition } from '../progression/upgrades';
import { AutoAttackSystem } from '../systems/AutoAttackSystem';
import { CameraRig } from '../systems/CameraRig';
import { MissileWeapon } from '../systems/MissileWeapon';
import { RoundController, type HudState } from '../systems/RoundController';
import { WaveSystem } from '../systems/WaveSystem';
import { TestMap } from '../world/TestMap';
import type { HudScene } from './HudScene';

/** Oro de la ronda: lo juntado hasta ahora y, al terminar, lo que se guarda en el progreso. */
export interface GoldState {
  gold: number;
  goldPayout: number | null;
}

/** Estado que dibuja el HUD: ronda + experiencia + oro. */
export type HudSnapshot = HudState & ProgressState & GoldState;

/** Una ronda: oleadas de enemigos, ataque automático, jefe final y resultado. */
export class GameScene extends Phaser.Scene {
  private player!: Character;
  private moveInput!: MoveInput;
  private enemies!: Phaser.Physics.Arcade.Group;
  private attack!: AutoAttackSystem;
  private missiles!: MissileWeapon;
  private waves!: WaveSystem;
  private round!: RoundController;
  private frozen = false;
  private stats = new PlayerStats();
  private progression = new ProgressionSystem();
  /** Veces que se eligió cada mejora en esta ronda (algunas tienen requisitos, como la evolución). */
  private taken: Record<string, number> = {};
  private pickups: Pickup[] = [];
  private gold = 0;
  /** Oro que se guardó al terminar la ronda (null mientras se juega). */
  private goldPayout: number | null = null;
  private hud!: HudScene;
  /** Reloj de la ronda: no avanza mientras se elige una mejora. */
  private clock = 0;

  constructor() {
    super(SCENE_KEYS.game);
  }

  create(): void {
    this.frozen = false;
    const testMode = new URLSearchParams(window.location.search).get('test') === '1';
    this.clock = testMode ? Math.max(0, ROUND.durationMs - 60_000) : 0;
    this.stats = new PlayerStats();
    this.progression = new ProgressionSystem();
    this.taken = {};
    this.pickups = [];
    this.gold = 0;
    this.goldPayout = null;
    const map = new TestMap(this);
    map.build();
    this.physics.world.setBounds(0, 0, map.widthPx, map.heightPx);

    this.player = createCharacter(this, IRON_MAN_ID, map.spawn.x, map.spawn.y);
    this.physics.add.collider(this.player, map.obstacles);
    applyMetaUpgrades({ stats: this.stats, player: this.player });
    map.onPropBroken = (prop) => this.dropPropGold(prop);

    this.enemies = this.physics.add.group();
    this.physics.add.collider(this.enemies, map.obstacles);
    this.physics.add.collider(this.enemies, this.enemies);
    this.attack = new AutoAttackSystem(this, this.player, this.player.definition.stats.attack, this.enemies, this.stats, () => map.breakables);
    this.missiles = new MissileWeapon(this, this.player, this.enemies, this.stats, (x, y, radius, damage) =>
      map.damagePropsInRadius(x, y, radius, damage),
    );
    this.waves = new WaveSystem(this, this.enemies, this.player, { width: map.widthPx, height: map.heightPx }, (e) => {
      this.dropLoot(e);
      this.round.onEnemyKilled(e);
    });
    this.round = new RoundController(0, this.player, this.waves, this.enemies);

    // Enemigos que tocan al jugador le hacen daño (con invulnerabilidad corta).
    this.physics.add.overlap(this.player, this.enemies, (_p, e) => {
      const enemy = e as Enemy;
      if (!enemy.dying) this.player.takeDamage(enemy.contactDamage);
    });
    // Proyectiles que tocan enemigos.
    this.physics.add.overlap(this.attack.projectiles, this.enemies, (p, e) => {
      const projectile = p as Projectile;
      const enemy = e as Enemy;
      if (enemy.dying || !projectile.canHit(enemy)) return;
      enemy.takeDamage(projectile.damage);
      if (projectile.registerHit(enemy)) projectile.destroy();
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

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.scene.stop(SCENE_KEYS.hud));
  }

  getHudState(): HudSnapshot {
    return {
      ...this.round.getHudState(this.clock),
      ...this.progression.getState(),
      gold: Math.floor(this.gold),
      goldPayout: this.goldPayout,
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
  }

  /** Mueve lo que se junta hacia el jugador cuando está cerca y suma lo que llega. */
  private updatePickups(delta: number): void {
    const radiusSq = this.stats.pickupRadius ** 2;
    const targetY = this.player.y - 8;
    this.pickups = this.pickups.filter((pickup) => {
      if (!pickup.isMagnetized) {
        const dx = this.player.x - pickup.x;
        const dy = targetY - pickup.y;
        if (dx * dx + dy * dy <= radiusSq) pickup.magnetize();
      }
      if (pickup.isMagnetized && pickup.moveToward(this.player.x, targetY, delta)) {
        if (pickup.kind === 'xp') this.progression.addXp(pickup.value * this.stats.xpMult);
        else this.gold += pickup.value * this.stats.goldMult;
        pickup.destroy();
        return false;
      }
      return true;
    });
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
    const ctx: UpgradeContext = { stats: this.stats, player: this.player, missiles: this.missiles, taken: this.taken };
    const choices = pickUpgradeChoices(PROGRESSION.upgradeChoices, ctx);
    this.scene.pause();
    this.hud.showUpgrades(this.progression.level, choices, (choice: UpgradeDefinition) => {
      choice.apply(ctx);
      this.taken[choice.id] = (this.taken[choice.id] ?? 0) + 1;
      this.scene.resume();
    });
  }

  update(_time: number, delta: number): void {
    if (this.round.ended) {
      if (!this.frozen) {
        this.frozen = true;
        this.physics.pause();
        if (this.round.phase === 'lost') this.player.defeat();
        this.bankGold();
      }
      return;
    }

    this.clock += delta;
    const now = this.clock;
    this.player.step(this.moveInput.getVector());
    this.attack.update(now);
    this.missiles.update(now, delta);
    this.updatePickups(delta);
    const activeEnemies = (this.enemies.getChildren() as Enemy[]).filter((enemy) => enemy.active && !enemy.dying);
    for (const enemy of activeEnemies) {
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
    this.round.update(now);

    if (this.progression.pendingLevelUps > 0 && !this.round.ended) this.openLevelUp();
  }
}
