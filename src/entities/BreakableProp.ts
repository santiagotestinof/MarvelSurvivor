import Phaser from 'phaser';
import { BREAKABLE_PROPS } from '../config/gameplayConfig';

export type BreakableKind = keyof typeof BREAKABLE_PROPS;

/** Cantidad de etapas visuales de desgaste en los spritesheets de caja y piedra (0 = sano, 3 = muy roto). */
const DAMAGE_STAGES = 4;

/** Objeto del mapa (caja, roca) que se va agrietando según la vida perdida y suelta oro al romperse. */
export class BreakableProp {
  private readonly maxHealth: number;
  private health: number;
  private broken = false;
  private readonly baseX: number;

  constructor(
    readonly kind: BreakableKind,
    private readonly image: Phaser.GameObjects.Image,
    /** Cuerpo de colisión estático (está en el grupo de obstáculos). */
    readonly collider: Phaser.GameObjects.Rectangle,
    private readonly onBroken: (prop: BreakableProp) => void,
  ) {
    this.maxHealth = BREAKABLE_PROPS[kind].health;
    this.health = this.maxHealth;
    this.baseX = image.x;
    this.image.setFrame(0);
    collider.setData('prop', this);
  }

  get x(): number {
    return this.collider.x;
  }

  /** Centro del objeto (hacia donde se apunta). */
  get y(): number {
    return this.collider.y;
  }

  get isBroken(): boolean {
    return this.broken;
  }

  /** Cantidad de oro que suelta al romperse. */
  rollGold(): number {
    const { min, max } = BREAKABLE_PROPS[this.kind].gold;
    return Phaser.Math.Between(min, max);
  }

  takeDamage(amount: number): void {
    if (this.broken) return;
    this.health -= amount;
    if (this.health <= 0) {
      this.break();
      return;
    }

    // Actualiza el cuadro de grietas según qué porcentaje de vida perdió (estilo Minecraft).
    const lostRatio = Phaser.Math.Clamp(1 - this.health / this.maxHealth, 0, 0.999);
    const stage = Math.min(DAMAGE_STAGES - 1, Math.floor(lostRatio * DAMAGE_STAGES));
    this.image.setFrame(stage);

    // Destello corto, sacudida lateral y astillas/escombros al recibir el golpe.
    this.image.setTintFill(0xffffff);
    this.image.scene.time.delayedCall(55, () => this.image.active && this.image.clearTint());
    this.image.scene.tweens.add({
      targets: this.image,
      x: this.baseX + Phaser.Math.Between(-2, 2),
      duration: 35,
      yoyo: true,
      onComplete: () => {
        if (this.image.active) this.image.x = this.baseX;
      },
    });
    this.spawnChips(3);
  }

  /** Pequeñas astillas de madera o escombros de piedra que saltan al golpear o romper. */
  private spawnChips(count: number): void {
    const scene = this.image.scene;
    const color = this.kind === 'crate' ? 0xb07a35 : 0x8b909a;
    for (let i = 0; i < count; i++) {
      const chip = scene.add
        .rectangle(this.x + Phaser.Math.Between(-4, 4), this.y - Phaser.Math.Between(2, 8), 2, 2, color)
        .setDepth(this.image.depth + 1);
      scene.tweens.add({
        targets: chip,
        x: chip.x + Phaser.Math.Between(-10, 10),
        y: chip.y + Phaser.Math.Between(-6, 8),
        alpha: 0,
        duration: 220,
        onComplete: () => chip.destroy(),
      });
    }
  }

  private break(): void {
    this.broken = true;
    this.image.setFrame(DAMAGE_STAGES - 1);
    this.spawnChips(7);
    // Al destruir el collider se libera el paso (sale del grupo de obstáculos y pierde el cuerpo).
    this.collider.destroy();
    this.onBroken(this);
    this.image.setTintFill(0xffffff);
    this.image.scene.tweens.add({
      targets: this.image,
      alpha: 0,
      scaleX: 1.3,
      scaleY: 0.5,
      duration: 180,
      onComplete: () => this.image.destroy(),
    });
  }
}
