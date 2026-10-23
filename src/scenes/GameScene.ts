import Phaser from 'phaser';
import { createCharacter } from '../characters/registry';
import { IRON_MAN_ID } from '../characters/ironman/ironManDefinition';
import { SCENE_KEYS } from '../config/sceneKeys';
import { ROUND } from '../config/gameplayConfig';
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
import { RangedAttackSystem } from '../systems/RangedAttackSystem';
import { RoundController, type HudState } from '../systems/RoundController';
import { WaveSystem } from '../systems/WaveSystem';
import { TestMap } from '../world/TestMap';
import type { HudScene } from './HudScene';

export type HudSnapshot = HudState & ProgressState;

export class GameScene extends Phaser.Scene {
  private player!: Character;
  private moveInput!: MoveInput;
  private enemies!: Phaser.Physics.Arcade.Group;
  private attack!: AutoAttackSystem;
  private missiles!: MissileWeapon;
  private rangedAttacks!: RangedAttackSystem;
  private waves!: WaveSystem;
  private round!: RoundController;
  private frozen = false;
  private stats = new PlayerStats();
  private progression = new ProgressionSystem();
  private taken: Record<string, number> = {};
  private gems: XpGem[] = [];
  private hud!: HudScene;
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
    this.gems = [];
    const map = new TestMap(this);
    map.build();
    this.physics.world.setBounds(0, 0, map.widthPx, map.heightPx);

    this.player = createCharacter(this, IRON_MAN_ID, map.spawn.x, map.spawn.y);
    this.physics.add.collider(this.player, map.obstacles);

    this.enemies = this.physics.add.group();
    this.physics.add.collider(this.enemies, map.obstacles);
    this.physics.add.collider(this.enemies, this.enemies);
    this.attack = new AutoAttackSystem(this, this.player, this.player.definition.stats.attack, this.enemies, this.stats);
    this.missiles = new MissileWeapon(this, this.player, this.enemies, this.stats);
    this.rangedAttacks = new RangedAttackSystem(this, this.player, { width: map.widthPx, height: map.heightPx });
    this.waves = new WaveSystem(this, this.enemies, this.player, { width: map.widthPx, height: map.heightPx }, (e) => {
      this.dropGem(e);
      this.round.onEnemyKilled(e);
    });
    this.round = new RoundController(0, this.player, this.waves, this.enemies);

    this.physics.add.overlap(this.player, this.enemies, (_p, e) => {
      const enemy = e as Enemy;
      if (!enemy.dying) this.player.takeDamage(enemy.contactDamage);
    });
    this.physics.add.overlap(this.attack.projectiles, this.enemies, (p, e) => {
      const projectile = p as Projectile;
      const enemy = e as Enemy;
      if (enemy.dying || !projectile.canHit(enemy)) return;
      enemy.takeDamage(projectile.damage);
      if (projectile.registerHit(enemy)) projectile.destroy();
    });

    this.scene.stop(SCENE_KEYS.hud);
    this.scene.launch(SCENE_KEYS.hud);
    const hud = this.scene.get(SCENE_KEYS.hud) as HudScene;
    this.hud = hud;
    this.moveInput = new CompositeMoveInput([new KeyboardMoveInput(this), { getVector: () => hud.touchVector }]);

    new CameraRig(this, this.player, { width: map.widthPx, height: map.heightPx });

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.scene.stop(SCENE_KEYS.hud));
  }

  getHudState(): HudSnapshot {
    return { ...this.round.getHudState(this.clock), ...this.progression.getState() };
  }

  private dropGem(enemy: Enemy): void {
    if (enemy.kind.xpValue > 0) this.gems.push(new XpGem(this, enemy.x, enemy.y - 4, enemy.kind.xpValue));
  }

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
      }
      return;
    }

    this.clock += delta;
    const now = this.clock;
    this.player.step(this.moveInput.getVector());
    this.attack.update(now);
    this.missiles.update(now, delta);
    this.updateGems(delta);
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
    this.rangedAttacks.update(now, delta, activeEnemies);
    this.round.update(now);

    if (this.progression.pendingLevelUps > 0 && !this.round.ended) this.openLevelUp();
  }
}
