import Phaser from 'phaser';
import { createCharacter } from '../characters/registry';
import { IRON_MAN_ID } from '../characters/ironman/ironManDefinition';
import { SCENE_KEYS } from '../config/sceneKeys';
import type { Character } from '../entities/Character';
import type { Enemy } from '../entities/Enemy';
import type { Projectile } from '../entities/Projectile';
import { CompositeMoveInput } from '../input/CompositeMoveInput';
import { KeyboardMoveInput } from '../input/KeyboardMoveInput';
import type { MoveInput } from '../input/MoveInput';
import { XpGem } from '../entities/XpGem';
import { PROGRESSION } from '../config/gameplayConfig';
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
  private gems: XpGem[] = [];
  private hud!: HudScene;
  /** Reloj de la ronda: no avanza mientras se elige una mejora. */
  private clock = 0;

  constructor() {
    super(SCENE_KEYS.game);
  }

  create(): void {
    this.frozen = false;
    this.clock = 0;
    this.stats = new PlayerStats();
    this.progression = new ProgressionSystem();
    this.gems = [];
    const map = new TestMap(this);
    map.build();
    this.physics.world.setBounds(0, 0, map.widthPx, map.heightPx);

    this.player = createCharacter(this, IRON_MAN_ID, map.spawn.x, map.spawn.y);
    this.physics.add.collider(this.player, map.obstacles);

    this.enemies = this.physics.add.group();
    this.attack = new AutoAttackSystem(this, this.player, this.player.definition.stats.attack, this.enemies, this.stats);
    this.missiles = new MissileWeapon(this, this.player, this.enemies, this.stats);
    this.waves = new WaveSystem(this, this.enemies, this.player, { width: map.widthPx, height: map.heightPx }, (e) => {
      this.dropGem(e);
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
      if (!projectile.active || enemy.dying) return;
      enemy.takeDamage(projectile.damage);
      projectile.destroy();
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

  getHudState(): HudState & ProgressState {
    return { ...this.round.getHudState(this.clock), ...this.progression.getState() };
  }

  private dropGem(enemy: Enemy): void {
    if (enemy.kind.xpValue > 0) this.gems.push(new XpGem(this, enemy.x, enemy.y - 4, enemy.kind.xpValue));
  }

  /** Mueve las gemas cercanas hacia el jugador y suma la experiencia de las que llegan. */
  private updateGems(delta: number): void {
    const radiusSq = this.stats.pickupRadius ** 2;
    const targetY = this.player.y - 8;
    this.gems = this.gems.filter((gem) => {
      if (!gem.isMagnetized) {
        const dx = this.player.x - gem.x;
        const dy = targetY - gem.y;
        if (dx * dx + dy * dy <= radiusSq) gem.magnetize();
      }
      if (gem.isMagnetized && gem.moveToward(this.player.x, targetY, delta)) {
        this.progression.addXp(gem.value);
        gem.destroy();
        return false;
      }
      return true;
    });
  }

  /** Pausa la ronda y ofrece mejoras al HUD; al elegir, se aplica y se sigue. */
  private openLevelUp(): void {
    this.progression.pendingLevelUps--;
    const ctx: UpgradeContext = { stats: this.stats, player: this.player, missiles: this.missiles };
    const choices = pickUpgradeChoices(PROGRESSION.upgradeChoices, ctx);
    this.scene.pause();
    this.hud.showUpgrades(this.progression.level, choices, (choice: UpgradeDefinition) => {
      choice.apply(ctx);
      this.scene.resume();
    });
  }

  update(_time: number, delta: number): void {
    if (this.round.ended) {
      if (!this.frozen) {
        this.frozen = true;
        this.physics.pause();
        if (this.round.phase === 'lost') this.player.defeat();
      }
      return;
    }

    this.clock += delta;
    const now = this.clock;
    this.player.step(this.moveInput.getVector());
    this.attack.update(now);
    this.missiles.update(now, delta);
    this.updateGems(delta);
    for (const enemy of this.enemies.getChildren() as Enemy[]) {
      if (enemy.active) enemy.chase(this.player.x, this.player.y - 6);
    }
    this.round.update(now);

    if (this.progression.pendingLevelUps > 0 && !this.round.ended) this.openLevelUp();
  }
}
