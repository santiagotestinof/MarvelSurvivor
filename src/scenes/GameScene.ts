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
import { AutoAttackSystem } from '../systems/AutoAttackSystem';
import { CameraRig } from '../systems/CameraRig';
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
  private waves!: WaveSystem;
  private round!: RoundController;
  private frozen = false;

  constructor() {
    super(SCENE_KEYS.game);
  }

  create(): void {
    this.frozen = false;
    const map = new TestMap(this);
    map.build();
    this.physics.world.setBounds(0, 0, map.widthPx, map.heightPx);

    this.player = createCharacter(this, IRON_MAN_ID, map.spawn.x, map.spawn.y);
    this.physics.add.collider(this.player, map.obstacles);

    this.enemies = this.physics.add.group();
    this.attack = new AutoAttackSystem(this, this.player, this.player.definition.stats.attack, this.enemies);
    this.waves = new WaveSystem(this, this.enemies, this.player, { width: map.widthPx, height: map.heightPx }, (e) =>
      this.round.onEnemyKilled(e),
    );
    this.round = new RoundController(this.time.now, this.player, this.waves, this.enemies);

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
    this.moveInput = new CompositeMoveInput([new KeyboardMoveInput(this), { getVector: () => hud.touchVector }]);

    new CameraRig(this, this.player, { width: map.widthPx, height: map.heightPx });

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.scene.stop(SCENE_KEYS.hud));
  }

  getHudState(): HudState {
    return this.round.getHudState(this.time.now);
  }

  update(time: number): void {
    if (this.round.ended) {
      if (!this.frozen) {
        this.frozen = true;
        this.physics.pause();
        if (this.round.phase === 'lost') this.player.defeat();
      }
      return;
    }

    this.player.step(this.moveInput.getVector());
    this.attack.update(time);
    for (const enemy of this.enemies.getChildren() as Enemy[]) {
      if (enemy.active) enemy.chase(this.player.x, this.player.y - 6);
    }
    this.round.update(time);
  }
}
